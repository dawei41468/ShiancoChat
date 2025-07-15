import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

# MongoDB connection details
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

if not mongo_url or not db_name:
    raise ValueError("Missing required environment variables. Please ensure MONGO_URL and DB_NAME are set in your .env file.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Dependency function to get the database session
async def get_db():
    return db

async def delete_user(user_email: str):
    # Find all conversations belonging to the user
    user_conversations = db.conversations.find({"user_email": user_email})
    conversation_ids = [conv["_id"] async for conv in user_conversations]

    # Delete all messages associated with these conversations
    if conversation_ids:
        await db.messages.delete_many({"conversation_id": {"$in": conversation_ids}})

    # Delete all conversations belonging to the user
    await db.conversations.delete_many({"user_email": user_email})

    # Delete the user document
    await db.users.delete_one({"email": user_email})

def close_mongo_connection():
    client.close()