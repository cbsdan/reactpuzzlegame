import os
from pymongo import MongoClient

_mongo_client = None

def get_mongodb_client():
    global _mongo_client
    if _mongo_client is not None:
        return _mongo_client
    mongodb_uri = os.environ.get('MONGODB_URI')
    if not mongodb_uri:
        return None
    try:
        _mongo_client = MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=60000,
            connectTimeoutMS=60000,
            socketTimeoutMS=60000,
            retryWrites=True,
            retryReads=True,
            maxPoolSize=10,
            minPoolSize=1,
            waitQueueTimeoutMS=60000
        )
        _mongo_client.admin.command('ping')
        return _mongo_client
    except Exception:
        return None

def get_database():
    client = get_mongodb_client()
    if client is None:
        return None
    return client['reactpuzzlegame']
