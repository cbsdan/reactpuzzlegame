import json
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.lib.mongodb import get_database

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

def handler(request):
    """Vercel serverless handler for admin API"""
    
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
                'error': 'Database not configured. Please set MONGODB_URI in environment.'
            })
        }
    
    try:
        if request.method == 'POST':
            # Parse request body
            try:
                body = json.loads(request.body) if isinstance(request.body, str) else json.loads(request.body.decode('utf-8'))
            except:
                body = {}
            
            action = body.get('action')
            
            if not action or action not in ['start', 'pause', 'restart', 'stop']:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Invalid action'
                    })
                }
            
            game_states = db['gamestate']
            players = db['players']
            
            new_status = None
            additional_updates = {}
            
            if action == 'start':
                new_status = 'playing'
                additional_updates['startedAt'] = datetime.utcnow()
                additional_updates['pausedAt'] = None
            elif action == 'pause':
                new_status = 'paused'
                additional_updates['pausedAt'] = datetime.utcnow()
            elif action == 'restart':
                new_status = 'playing'
                additional_updates['startedAt'] = datetime.utcnow()
                additional_updates['pausedAt'] = None
                # Reset player scores
                players.update_many({}, {'$set': {'score': 0}})
            elif action == 'stop':
                new_status = 'idle'
                additional_updates['startedAt'] = None
                additional_updates['pausedAt'] = None
            
            # Update game state and increment version
            update_data = {
                'status': new_status,
                'updatedAt': datetime.utcnow(),
                **additional_updates
            }
            
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
                    'action': action,
                    'gameState': result,
                    'message': f'Game {action}ed successfully'
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
        print(f'Admin API error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
