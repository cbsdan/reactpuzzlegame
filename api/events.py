import json
from datetime import datetime
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.lib.mongodb import get_database

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

def handler(request):
    """Vercel serverless handler for events/SSE API"""
    
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
        if request.method == 'GET':
            # Get query parameters
            query_params = request.query if hasattr(request, 'query') else {}
            last_version = int(query_params.get('lastVersion', [0])[0] if isinstance(query_params.get('lastVersion'), list) else query_params.get('lastVersion', 0))
            
            # Get current game state
            game_states = db['gamestate']
            game_state = game_states.find_one({'type': 'current'})
            current_version = game_state.get('version', 0) if game_state else 0
            
            # Check if there are updates
            if current_version > last_version:
                players_collection = db['players']
                players = list(players_collection.find({}).sort('joinedAt', -1))
                
                # Convert ObjectIds to strings
                if game_state and '_id' in game_state:
                    game_state['_id'] = str(game_state['_id'])
                for player in players:
                    player['_id'] = str(player['_id'])
                
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': True,
                        'hasUpdate': True,
                        'version': current_version,
                        'gameState': game_state,
                        'players': players,
                        'timestamp': datetime.utcnow().isoformat()
                    }, default=str)
                }
            
            # No updates - use long polling with timeout
            # Note: Vercel has a 30s timeout, so we check for 25s max
            start_time = time.time()
            timeout = 25
            
            while time.time() - start_time < timeout:
                time.sleep(1)  # Check every second
                
                latest_game_state = game_states.find_one({'type': 'current'})
                latest_version = latest_game_state.get('version', 0) if latest_game_state else 0
                
                if latest_version > last_version:
                    players_collection = db['players']
                    players = list(players_collection.find({}).sort('joinedAt', -1))
                    
                    # Convert ObjectIds to strings
                    if latest_game_state and '_id' in latest_game_state:
                        latest_game_state['_id'] = str(latest_game_state['_id'])
                    for player in players:
                        player['_id'] = str(player['_id'])
                    
                    return {
                        'statusCode': 200,
                        'headers': CORS_HEADERS,
                        'body': json.dumps({
                            'success': True,
                            'hasUpdate': True,
                            'version': latest_version,
                            'gameState': latest_game_state,
                            'players': players,
                            'timestamp': datetime.utcnow().isoformat()
                        }, default=str)
                    }
            
            # Timeout - no updates
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'hasUpdate': False,
                    'version': current_version,
                    'timestamp': datetime.utcnow().isoformat()
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
        print(f'Events API error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
