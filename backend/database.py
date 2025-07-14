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

def close_mongo_connection():
    client.close()