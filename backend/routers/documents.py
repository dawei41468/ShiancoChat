from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
import os
import tempfile
from unstructured.partition.auto import partition
from typing import Optional
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timedelta
from sentence_transformers import SentenceTransformer
from backend.models import Document, DocumentChunk, User
from backend.database import get_db
from backend.auth import get_current_user
import uuid
import numpy as np

# Initialize embedding model
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

import logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/documents",
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)

logger.info("Documents router initialized")

# Document expires after 24 hours by default
DOCUMENT_TTL_HOURS = 24

class DocumentResponse(BaseModel):
    filename: str
    content: str
    content_type: str
    document_id: str
    expires_at: datetime

class DocumentReference(BaseModel):
    conversation_id: str
    document_id: str
    filename: str
    content_type: str

@router.post("")
async def save_document_reference(document_ref: DocumentReference):
    """Save document reference without processing content"""
    db = await get_db()
    
    # Check if document exists
    existing = await db.documents.find_one({"_id": document_ref.document_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update document with reference info
    await db.documents.update_one(
        {"_id": document_ref.document_id},
        {"$set": {
            "conversation_id": document_ref.conversation_id,
            "filename": document_ref.filename,
            "content_type": document_ref.content_type
        }}
    )
    
    return {"status": "success", "document_id": document_ref.document_id}

@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    conversation_id: Optional[str] = None
):
    """Handle file upload and text extraction"""
    tmp_file_path = None  # Initialize before try block
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    filepath = Path(file.filename)
    ext = filepath.suffix.lower()
    if ext not in ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.jpg']:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:  # 10MB limit
                raise HTTPException(status_code=400, detail="File too large (max 10MB)")
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        # Extract text
        elements = partition(tmp_file_path)
        text = "\n\n".join([str(el) for el in elements])
        
        # Chunk text for better handling (simple implementation)
        chunks = simple_text_splitter(text, chunk_size=1000, chunk_overlap=200)
        
        # Create document record
        document_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=DOCUMENT_TTL_HOURS)
        db = await get_db()

        # Store document and chunks without embeddings first
        document = {
            "_id": document_id,
            "filename": file.filename,
            "user_email": current_user.email,
            "content": text,
            "content_type": file.content_type or "application/octet-stream",
            "expires_at": expires_at,
            "conversation_id": conversation_id,
            "created_at": datetime.utcnow(),
            "chunk_count": len(chunks)
        }

        from pymongo import InsertOne
        
        # Insert document and chunks
        await db.documents.insert_one(document)
        
        if chunks:
            chunk_operations = [
                InsertOne({
                    "document_id": document_id,
                    "chunk_index": i,
                    "content": chunk,
                    "embedding": None,  # Placeholder
                    "created_at": datetime.utcnow()
                }) for i, chunk in enumerate(chunks)
            ]
            await db.document_chunks.bulk_write(chunk_operations)
        
        # Schedule background task for embedding computation
        if background_tasks:
            background_tasks.add_task(compute_embeddings, db, document_id, chunks)
        else:
            logger.warning("BackgroundTasks not provided, embeddings will not be computed in background")
        
        # Clean up
        os.unlink(tmp_file_path)
        
        return JSONResponse({
            "filename": file.filename,
            "content": text,
            "content_type": file.content_type,
            "document_id": document_id,
            "expires_at": expires_at.isoformat()
        })
        
    except Exception as e:
        # Clean up if error occurs
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except:
                pass
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )

@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Delete a document by ID"""
    db = await get_db()
    # Delete document and its chunks
    result = await db.documents.delete_one({"_id": document_id})
    await db.document_chunks.delete_many({"document_id": document_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "success"}

@router.post("/cleanup")
async def cleanup_documents():
    """Clean up expired documents"""
    db = await get_db()
    now = datetime.utcnow()
    
    # Find expired documents
    expired_docs = await db.documents.find({
        "expires_at": {"$lt": now}
    }).to_list(1000)  # Large enough number to get all expired docs
    
    if not expired_docs:
        return {"status": "success", "deleted": 0}
    
    doc_ids = [doc["_id"] for doc in expired_docs]
    
    # Delete documents and their chunks
    await db.documents.delete_many({"_id": {"$in": doc_ids}})
    await db.document_chunks.delete_many({"document_id": {"$in": doc_ids}})
    
    return {"status": "success", "deleted": len(doc_ids)}

async def compute_embeddings(db, document_id: str, chunks: list):
    """Background task to compute and update chunk embeddings"""
    try:
        chunk_embeddings = []
        for chunk in chunks:
            try:
                embedding = np.array(embedding_model.encode(chunk)).tolist()
                chunk_embeddings.append(embedding)
            except Exception as e:
                logger.error(f"Error generating embedding for chunk: {str(e)}")
                chunk_embeddings.append(None)
        
        # Update chunks with embeddings
        from pymongo import UpdateOne
        operations = [
            UpdateOne(
                {"document_id": document_id, "chunk_index": i},
                {"$set": {"embedding": embedding}}
            ) for i, embedding in enumerate(chunk_embeddings)
        ]
        
        if operations:
            await db.document_chunks.bulk_write(operations)
    except Exception as e:
        logger.error(f"Error in background embedding task: {str(e)}")

def simple_text_splitter(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list:
    """Simple text splitter implementation without langchain dependency"""
    if not text:
        return []
    
    # Split by paragraphs first
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        # If adding this paragraph would exceed chunk size, finalize current chunk
        if current_chunk and len(current_chunk) + len(paragraph) + 2 > chunk_size:
            chunks.append(current_chunk.strip())
            # Start new chunk with overlap from previous chunk
            if chunk_overlap > 0:
                # Take last chunk_overlap characters from previous chunk
                overlap_start = max(0, len(current_chunk) - chunk_overlap)
                current_chunk = current_chunk[overlap_start:] + "\n\n" + paragraph
            else:
                current_chunk = paragraph
        else:
            if current_chunk:
                current_chunk += "\n\n" + paragraph
            else:
                current_chunk = paragraph
    
    # Add the last chunk if it's not empty
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks