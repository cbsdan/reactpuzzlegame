import json
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.lib.mongodb import get_database

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

def handler(request):
    """Vercel serverless handler for players API"""
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': ''
        }
    
    db = get_database()
    
    if db is None:
        return {
            'statusCode': 503,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': 'Database not configured. Please set MONGODB_URI in environment.',
                'players': []
            }, default=str)
        }
    
    try:
        if request.method == 'GET':
            players_collection = db['players']
            all_players = list(players_collection.find({}).sort('joinedAt', -1))
            
            # Convert ObjectId to string
            for player in all_players:
                player['_id'] = str(player['_id'])
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'players': all_players
                }, default=str)
            }
        
        elif request.method == 'POST':
            # Parse request body
            try:
                body = json.loads(request.body) if isinstance(request.body, str) else json.loads(request.body.decode('utf-8'))
            except:
                body = {}
            
            name = body.get('name', '').strip()
            
            if not name:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Name is required'
                    })
                }
            
            players_collection = db['players']
            
            new_player = {
                'name': name,
                'joinedAt': datetime.utcnow(),
                'score': 0,
                'isActive': True
            }
            
            result = players_collection.insert_one(new_player)
            new_player['_id'] = str(result.inserted_id)
            
            return {
                'statusCode': 201,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'player': new_player
                }, default=str)
            }
        
        elif request.method == 'DELETE':
            players_collection = db['players']
            players_collection.delete_many({})
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'message': 'All players removed'
                })
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Method not allowed'
                })
            }
    
    except Exception as e:
        print(f'Players API error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
