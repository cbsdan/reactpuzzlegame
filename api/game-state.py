import json
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.lib.mongodb import get_database

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

def handler(request):
    """Vercel serverless handler for game state API"""
    
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
                'gameState': None
            }, default=str)
        }
    
    try:
        if request.method == 'GET':
            game_states = db['gamestate']
            game_state = game_states.find_one({'type': 'current'})
            
            if not game_state:
                # Initialize default game state
                game_state = {
                    'type': 'current',
                    'status': 'idle',
                    'startedAt': None,
                    'pausedAt': None,
                    'updatedAt': datetime.utcnow(),
                    'version': 0
                }
                game_states.insert_one(game_state)
            
            # Convert ObjectId to string
            if '_id' in game_state:
                game_state['_id'] = str(game_state['_id'])
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'gameState': game_state
                }, default=str)
            }
        
        elif request.method in ['POST', 'PUT']:
            # Parse request body
            try:
                body = json.loads(request.body) if isinstance(request.body, str) else json.loads(request.body.decode('utf-8'))
            except:
                body = {}
            
            status = body.get('status')
            admin_action = body.get('adminAction')
            
            if not status or status not in ['idle', 'playing', 'paused']:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Invalid status'
                    })
                }
            
            game_states = db['gamestate']
            
            update_data = {
                'status': status,
                'updatedAt': datetime.utcnow()
            }
            
            if status == 'playing':
                update_data['startedAt'] = datetime.utcnow()
                update_data['pausedAt'] = None
            elif status == 'paused':
                update_data['pausedAt'] = datetime.utcnow()
            elif status == 'idle':
                update_data['startedAt'] = None
                update_data['pausedAt'] = None
            
            # Increment version
            result = game_states.find_one_and_update(
                {'type': 'current'},
                {
                    '$set': update_data,
                    '$inc': {'version': 1}
                },
                upsert=True,
                return_document=True
            )
            
            if result and '_id' in result:
                result['_id'] = str(result['_id'])
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'gameState': result,
                    'action': admin_action or status
                }, default=str)
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
        print(f'Game state API error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
