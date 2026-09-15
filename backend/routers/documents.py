from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Form, Request, status
from fastapi.responses import JSONResponse
import os
import tempfile
# Lazy import to avoid loading heavy deps during test imports
_RecursiveCharacterTextSplitter = None

def _get_text_splitter():
    global _RecursiveCharacterTextSplitter
    if _RecursiveCharacterTextSplitter is None:
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError:  # legacy langchain<0.2 layout
            from langchain.text_splitter import RecursiveCharacterTextSplitter
        _RecursiveCharacterTextSplitter = RecursiveCharacterTextSplitter
    return _RecursiveCharacterTextSplitter
from typing import List, Optional, cast
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timedelta, timezone
import numpy as np
from backend.models import Document, DocumentChunk, KnowledgeSpace, KnowledgeSpaceCreate, KnowledgeSpaceUpdate, User, UserRole
from backend.database import get_db
from backend.auth import get_current_user
from backend.rate_limiter import limiter
from backend.utils.rag import embed_documents, _get_embedding_model
import uuid

# Optional MIME type verification by magic bytes
try:
    import magic
    _MAGIC_AVAILABLE = True
except Exception:
    _MAGIC_AVAILABLE = False

_ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
}

_EXTENSION_TO_MIME = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
}

def _verify_mime_type(content: bytes, ext: str) -> bool:
    if not _MAGIC_AVAILABLE:
        return True  # Graceful fallback if libmagic is unavailable
    try:
        detected = magic.from_buffer(content, mime=True)
        if detected in _ALLOWED_MIME_TYPES:
            return True
        # Some systems detect .docx as application/octet-stream; allow expected mapping
        expected = _EXTENSION_TO_MIME.get(ext)
        if expected and detected == 'application/octet-stream' and ext in ('.docx', '.xlsx'):
            return True
        return False
    except Exception:
        return True  # Fail open on magic parsing errors

# Python 3.12-friendly document extractors (lazy-loaded)
_PdfReader = None
_DocxDocument = None
_load_workbook = None

def _get_pdf_reader():
    global _PdfReader
    if _PdfReader is None:
        from pypdf import PdfReader
        _PdfReader = PdfReader
    return _PdfReader

def _get_docx_document():
    global _DocxDocument
    if _DocxDocument is None:
        from docx import Document as DocxDocument
        _DocxDocument = DocxDocument
    return _DocxDocument

def _get_load_workbook():
    global _load_workbook
    if _load_workbook is None:
        from openpyxl import load_workbook
        _load_workbook = load_workbook
    return _load_workbook

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
    expires_at: Optional[datetime] = None

class DocumentReference(BaseModel):
    conversation_id: str
    document_id: str
    filename: str
    content_type: str
    knowledge_space_id: Optional[str] = None

class KnowledgeSpaceDetail(BaseModel):
    space: KnowledgeSpace
    documents: List[dict]

async def _get_or_create_default_space(db, current_user: User) -> str:
    existing = await db.knowledge_spaces.find_one({
        "owner_email": current_user.email,
        "scope": "user",
        "name": "My Knowledge",
    })
    if existing:
        return existing["id"]

    now = datetime.now(timezone.utc)
    space = KnowledgeSpace(
        name="My Knowledge",
        description="Personal documents and uploads",
        owner_email=current_user.email,
        scope="user",
        created_at=now,
        updated_at=now,
    )
    await db.knowledge_spaces.insert_one(space.dict())
    return space.id

def _department_value(user: User) -> Optional[str]:
    """Return the raw department string for a user (Department is a str enum)."""
    dept = getattr(user, "department", None)
    return getattr(dept, "value", dept)


async def _assert_space_access(db, current_user: User, knowledge_space_id: str) -> dict:
    """Fetch a space and verify the user may access it.

    Access: space owner, department member (department-scoped spaces), or admin.
    All denials return 404 to avoid leaking space existence.
    """
    space = await db.knowledge_spaces.find_one({"id": knowledge_space_id})
    if not space:
        raise HTTPException(status_code=404, detail="Knowledge space not found")
    if current_user.role == UserRole.ADMIN:
        return space
    if space.get("owner_email") == current_user.email:
        return space
    if (space.get("scope") == "department"
            and space.get("department")
            and space.get("department") == _department_value(current_user)):
        return space
    raise HTTPException(status_code=404, detail="Knowledge space not found")

@router.get("/spaces", response_model=List[KnowledgeSpace])
@limiter.limit("60/minute")
async def list_knowledge_spaces(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    visibility_filter = {
        "$or": [
            {"owner_email": current_user.email},
            {"scope": "department", "department": _department_value(current_user)},
        ]
    }
    spaces = await db.knowledge_spaces.find(visibility_filter).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=None)

    # Auto-create the personal default space when the user has none of their own
    if skip == 0 and not any(s.get("owner_email") == current_user.email for s in spaces):
        await _get_or_create_default_space(db, current_user)
        spaces = await db.knowledge_spaces.find(visibility_filter).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=None)

    return [KnowledgeSpace(**space) for space in spaces]

@router.post("/spaces", response_model=KnowledgeSpace)
@limiter.limit("20/minute")
async def create_knowledge_space(
    request: Request,
    space_data: KnowledgeSpaceCreate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    name = space_data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Knowledge space name is required")

    scope = space_data.scope or "user"
    if scope == "department":
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can create department spaces")
        if not space_data.department:
            raise HTTPException(status_code=400, detail="Department is required for department-scoped spaces")
        existing = await db.knowledge_spaces.find_one({
            "scope": "department",
            "department": getattr(space_data.department, "value", space_data.department),
            "name": name,
        })
    elif scope == "user":
        existing = await db.knowledge_spaces.find_one({
            "owner_email": current_user.email,
            "name": name,
        })
    else:
        raise HTTPException(status_code=400, detail="Invalid scope")
    if existing:
        raise HTTPException(status_code=400, detail="Knowledge space already exists")

    now = datetime.now(timezone.utc)
    space = KnowledgeSpace(
        name=name,
        description=space_data.description,
        scope=scope,
        department=space_data.department if scope == "department" else None,
        owner_email=current_user.email,
        created_at=now,
        updated_at=now,
    )
    await db.knowledge_spaces.insert_one(space.dict())
    return space

@router.get("/spaces/{space_id}", response_model=KnowledgeSpaceDetail)
@limiter.limit("60/minute")
async def get_knowledge_space(
    request: Request,
    space_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    space_doc = await _assert_space_access(db, current_user, space_id)
    documents = await db.documents.find({
        "knowledge_space_id": space_id,
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)

    return {
        "space": KnowledgeSpace(**space_doc),
        "documents": [{
            "document_id": doc["_id"],
            "filename": doc.get("filename", ""),
            "content_type": doc.get("content_type", ""),
            "chunk_count": doc.get("chunk_count", 0),
            "created_at": doc.get("created_at"),
            "expires_at": doc.get("expires_at"),
            "indexing_status": doc.get("indexing_status", "pending"),
        } for doc in documents],
    }

@router.patch("/spaces/{space_id}", response_model=KnowledgeSpace)
@limiter.limit("20/minute")
async def update_knowledge_space(
    request: Request,
    space_id: str,
    space_data: KnowledgeSpaceUpdate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    existing = await _assert_space_access(db, current_user, space_id)
    if existing.get("scope") == "department" and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can modify department spaces")
    if existing.get("name") == "My Knowledge" and existing.get("scope") == "user":
        raise HTTPException(status_code=400, detail="Default knowledge space cannot be modified")
    update_data = {}

    if space_data.name is not None:
        name = space_data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Knowledge space name is required")
        dup_filter = {"name": name, "id": {"$ne": space_id}}
        if existing.get("scope") == "department":
            dup_filter["scope"] = "department"
            dup_filter["department"] = existing.get("department")
        else:
            dup_filter["owner_email"] = current_user.email
        duplicate = await db.knowledge_spaces.find_one(dup_filter)
        if duplicate:
            raise HTTPException(status_code=400, detail="Knowledge space already exists")
        update_data["name"] = name

    if space_data.description is not None:
        update_data["description"] = space_data.description

    if not update_data:
        return KnowledgeSpace(**existing)

    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.knowledge_spaces.update_one({"id": space_id}, {"$set": update_data})
    updated = await db.knowledge_spaces.find_one({"id": space_id})
    return KnowledgeSpace(**updated)

@router.delete("/spaces/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_knowledge_space(
    request: Request,
    space_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    space = await _assert_space_access(db, current_user, space_id)
    if space.get("scope") == "department" and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete department spaces")
    if space.get("name") == "My Knowledge" and space.get("scope") == "user":
        raise HTTPException(status_code=400, detail="Default knowledge space cannot be deleted")

    # Delete every document in the space regardless of uploader
    documents = await db.documents.find({"knowledge_space_id": space_id}).to_list(length=None)
    document_ids = [doc["_id"] for doc in documents]
    if document_ids:
        await db.document_chunks.delete_many({"document_id": {"$in": document_ids}})
        await db.documents.delete_many({"_id": {"$in": document_ids}})

    await db.knowledge_spaces.delete_one({"id": space_id})
    return None

@router.get("/spaces/{space_id}/documents", response_model=List[dict])
@limiter.limit("60/minute")
async def list_knowledge_space_documents(
    request: Request,
    space_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    await _assert_space_access(db, current_user, space_id)
    documents = await db.documents.find({
        "knowledge_space_id": space_id,
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    return [{
        "document_id": doc["_id"],
        "filename": doc.get("filename", ""),
        "content_type": doc.get("content_type", ""),
        "chunk_count": doc.get("chunk_count", 0),
        "created_at": doc.get("created_at"),
        "expires_at": doc.get("expires_at"),
        "indexing_status": doc.get("indexing_status", "pending"),
    } for doc in documents]

@router.post("")
@limiter.limit("30/minute")
async def save_document_reference(
    request: Request,
    document_ref: DocumentReference,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Save document reference without processing content"""
    existing = await db.documents.find_one({
        "_id": document_ref.document_id,
        "user_email": current_user.email,
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")

    conversation = await db.conversations.find_one({
        "id": document_ref.conversation_id,
        "user_email": current_user.email,
    })
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found or not owned by user")
    
    # Update document with reference info
    await db.documents.update_one(
        {"_id": document_ref.document_id, "user_email": current_user.email},
        {"$set": {
            "conversation_id": document_ref.conversation_id,
            "filename": document_ref.filename,
            "content_type": document_ref.content_type,
            "knowledge_space_id": document_ref.knowledge_space_id or existing.get("knowledge_space_id"),
            # Attaching a document to a knowledge space persists it (clears TTL)
            "expires_at": None if (document_ref.knowledge_space_id or existing.get("knowledge_space_id")) else existing.get("expires_at"),
        }}
    )

    await db.document_chunks.update_many(
        {"document_id": document_ref.document_id},
        {"$set": {
            "user_email": current_user.email,
            "conversation_id": document_ref.conversation_id,
            "knowledge_space_id": document_ref.knowledge_space_id or existing.get("knowledge_space_id"),
        }}
    )
    
    return {"status": "success", "document_id": document_ref.document_id}

@router.post("/upload")
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    conversation_id: Optional[str] = Form(None),
    knowledge_space_id: Optional[str] = Form(None),
    db=Depends(get_db),
):
    """Handle file upload and text extraction"""
    tmp_file_path = None  # Initialize before try block
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    filepath = Path(file.filename)
    ext = filepath.suffix.lower()
    if ext not in ['.pdf', '.docx', '.txt', '.xlsx']:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if conversation_id:
        conversation = await db.conversations.find_one({
            "id": conversation_id,
            "user_email": current_user.email,
        })
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found or not owned by user")

    if knowledge_space_id:
        await _assert_space_access(db, current_user, knowledge_space_id)
    else:
        knowledge_space_id = await _get_or_create_default_space(db, current_user)
    
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:  # 10MB limit
                raise HTTPException(status_code=400, detail="File too large (max 10MB)")
            if not _verify_mime_type(content, ext):
                raise HTTPException(
                    status_code=400,
                    detail="File content does not match the declared type. Possible spoofed extension."
                )
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        # Extract text using Python 3.12-compatible libraries
        def extract_text_from_file(path: str, ext: str) -> str:
            try:
                if ext == '.pdf':
                    text_parts = []
                    reader = _get_pdf_reader()(path)
                    for page in reader.pages:
                        page_text = page.extract_text() or ''
                        if page_text:
                            text_parts.append(page_text)
                    return '\n'.join(text_parts)
                elif ext == '.docx':
                    doc = _get_docx_document()(path)
                    paras = [p.text for p in doc.paragraphs if p.text]
                    # Extract text from tables as well
                    for table in getattr(doc, 'tables', []):
                        for row in table.rows:
                            paras.append('\t'.join(cell.text for cell in row.cells))
                    return '\n'.join(paras)
                elif ext == '.xlsx':
                    wb = _get_load_workbook()(path, data_only=True)
                    lines = []
                    for ws in wb.worksheets:
                        for row in ws.iter_rows(values_only=True):
                            str_vals = [str(v) for v in row if isinstance(v, (str, int, float)) and v is not None]
                            if str_vals:
                                lines.append('\t'.join(str_vals))
                    return '\n'.join(lines)
                elif ext == '.txt':
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        return f.read()
                else:
                    return ''
            except Exception:
                # Fallthrough on any parsing error
                return ''

        text = extract_text_from_file(tmp_file_path, ext)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")
        
        # Chunk text for better handling
        TextSplitter = _get_text_splitter()
        text_splitter = TextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(text)
        
        # Create document record. Conversation attachments are ad-hoc and expire;
        # documents uploaded straight into a knowledge space library persist.
        document_id = str(uuid.uuid4())
        expires_at = (
            datetime.now(timezone.utc) + timedelta(hours=DOCUMENT_TTL_HOURS)
            if conversation_id else None
        )
        # Store document and chunks without embeddings first
        document = {
            "_id": document_id,
            "filename": file.filename,
            "user_email": current_user.email,
            "knowledge_space_id": knowledge_space_id,
            "content": text,
            "content_type": file.content_type or "application/octet-stream",
            "expires_at": expires_at,
            "conversation_id": conversation_id,
            "created_at": datetime.now(timezone.utc),
            "chunk_count": len(chunks),
            "indexing_status": "pending",
        }

        # Insert document and then chunks (embeddings to be added in background)
        await db.documents.insert_one(document)
        if chunks:
            await db.document_chunks.insert_many([
                {
                    "document_id": document_id,
                    "knowledge_space_id": knowledge_space_id,
                    "chunk_index": i,
                    "content": chunk,
                    "embedding": None,
                    "user_email": current_user.email,
                    "conversation_id": conversation_id,
                    "created_at": datetime.now(timezone.utc)
                } for i, chunk in enumerate(chunks)
            ])
        
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
            "knowledge_space_id": knowledge_space_id,
            "expires_at": expires_at.isoformat() if expires_at else None
        })
        
    except HTTPException:
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except OSError:
                pass
        raise
    except Exception as e:
        # Clean up if error occurs
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except OSError:
                pass
        logger.error(f"Error processing upload: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing the file. Please try again later."
        )

@router.get("/{document_id}", response_model=DocumentResponse)
@limiter.limit("60/minute")
async def get_document(request: Request, document_id: str, current_user: User = Depends(get_current_user)):
    """Fetch a document by ID for the current user"""
    db = await get_db()
    doc = await db.documents.find_one({"_id": document_id, "user_email": current_user.email})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(
        filename=doc.get("filename", ""),
        content=doc.get("content", ""),
        content_type=doc.get("content_type", "application/octet-stream"),
        document_id=doc.get("_id"),
        expires_at=doc.get("expires_at")
    )

@router.delete("/{document_id}")
@limiter.limit("30/minute")
async def delete_document(request: Request, document_id: str, current_user: User = Depends(get_current_user)):
    """Delete a document by ID"""
    db = await get_db()
    # Delete document and its chunks (owner, or admin for shared space docs)
    doc_filter = {"_id": document_id}
    if current_user.role != UserRole.ADMIN:
        doc_filter["user_email"] = current_user.email
    result = await db.documents.delete_one(doc_filter)
    # Only delete chunks if the document delete actually occurred
    if result.deleted_count:
        await db.document_chunks.delete_many({"document_id": document_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "success"}

@router.post("/cleanup")
@limiter.limit("10/minute")
async def cleanup_documents(request: Request, current_user: User = Depends(get_current_user)):
    """Clean up expired documents"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to clean up documents",
        )
    db = await get_db()
    now = datetime.now(timezone.utc)
    
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

async def compute_embeddings(db, document_id: str, chunks: list, max_retries: int = 3):
    """Background task to compute and update chunk embeddings with retry."""
    import asyncio
    last_error = None
    for attempt in range(max_retries):
        try:
            # Use the shared embed_documents function for consistency
            chunk_embeddings = await embed_documents(chunks)

            if not chunk_embeddings:
                logger.error("No embeddings generated for chunks")
                await db.documents.update_one(
                    {"_id": document_id},
                    {"$set": {"indexing_status": "failed"}}
                )
                return

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
                await db.documents.update_one(
                    {"_id": document_id},
                    {"$set": {"indexing_status": "indexed"}}
                )
                logger.info(f"Computed and stored {len(operations)} embeddings for document {document_id}")
                return
        except Exception as e:
            last_error = e
            logger.error(f"Embedding attempt {attempt + 1}/{max_retries} failed for document {document_id}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # exponential backoff: 1s, 2s, 4s

    # All retries exhausted
    logger.error(f"Embedding failed permanently for document {document_id}: {last_error}")
    try:
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": {"indexing_status": "failed"}}
        )
    except Exception as db_err:
        logger.error(f"Failed to update document status to failed: {db_err}")


@router.get("/dead-letter")
@limiter.limit("30/minute")
async def list_dead_letter_documents(
    request: Request,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """List documents that failed embedding permanently (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view dead-letter documents"
        )
    failed_docs = await db.documents.find(
        {"indexing_status": "failed"}
    ).sort("created_at", -1).to_list(length=None)
    return {
        "documents": [{
            "document_id": doc["_id"],
            "filename": doc.get("filename", ""),
            "user_email": doc.get("user_email", ""),
            "knowledge_space_id": doc.get("knowledge_space_id"),
            "created_at": doc.get("created_at"),
            "chunk_count": doc.get("chunk_count", 0),
        } for doc in failed_docs]
    }
