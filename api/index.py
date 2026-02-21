from flask import Flask, request, jsonify
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.lib.mongodb import get_database

app = Flask(__name__)

# CORS decorator
def add_cors_headers(f):
    def wrapper(*args, **kwargs):
        response = f(*args, **kwargs)
        if isinstance(response, tuple):
            response, status = response
        else:
            status = 200
        if request.method == 'OPTIONS':
            return '', status
        return response
    wrapper.__name__ = f.__name__
    return wrapper

@app.before_request
def handle_preflight():
    if request.method == 'OPTIONS':
        return '', 204

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# Game State Routes
@app.route('/api/game-state', methods=['GET', 'POST', 'PUT', 'OPTIONS'])
def game_state():
    db = get_database()
    if db is None:
        return jsonify({
            'success': False,
            'error': 'Database not configured'
        }), 503
    
    try:
        if request.method == 'GET':
            game_states = db['gamestate']
            game_state = game_states.find_one({'type': 'current'})
            
            if not game_state:
                game_state = {
                    'type': 'current',
                    'status': 'idle',
                    'startedAt': None,
                    'pausedAt': None,
                    'updatedAt': datetime.utcnow(),
                    'version': 0
                }
                game_states.insert_one(game_state)
            
            if '_id' in game_state:
                game_state['_id'] = str(game_state['_id'])
            
            return jsonify({
                'success': True,
                'gameState': game_state
            }), 200
        
        elif request.method in ['POST', 'PUT']:
            data = request.get_json() or {}
            status = data.get('status')
            
            if not status or status not in ['idle', 'playing', 'paused']:
                return jsonify({
                    'success': False,
                    'error': 'Invalid status'
                }), 400
            
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
            
            return jsonify({
                'success': True,
                'gameState': result
            }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Players Routes
@app.route('/api/players', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
def players():
    db = get_database()
    if db is None:
        return jsonify({
            'success': False,
            'error': 'Database not configured',
            'players': []
        }), 503
    
    try:
        if request.method == 'GET':
            players_collection = db['players']
            all_players = list(players_collection.find({}).sort('joinedAt', -1))
            
            for player in all_players:
                player['_id'] = str(player['_id'])
            
            return jsonify({
                'success': True,
                'players': all_players
            }), 200
        
        elif request.method == 'POST':
            data = request.get_json() or {}
            name = data.get('name', '').strip()
            
            if not name:
                return jsonify({
                    'success': False,
                    'error': 'Name is required'
                }), 400
            
            players_collection = db['players']
            new_player = {
                'name': name,
                'joinedAt': datetime.utcnow(),
                'score': 0,
                'isActive': True
            }
            
            result = players_collection.insert_one(new_player)
            new_player['_id'] = str(result.inserted_id)
            
            return jsonify({
                'success': True,
                'player': new_player
            }), 201
        
        elif request.method == 'DELETE':
            players_collection = db['players']
            players_collection.delete_many({})
            
            return jsonify({
                'success': True,
                'message': 'All players removed'
            }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Events Route (Long Polling)
@app.route('/api/events', methods=['GET', 'OPTIONS'])
def events():
    db = get_database()
    if db is None:
        return jsonify({
            'success': False,
            'error': 'Database not configured'
        }), 503
    
    try:
        last_version = int(request.args.get('lastVersion', 0))
        game_states = db['gamestate']
        game_state = game_states.find_one({'type': 'current'})
        current_version = game_state.get('version', 0) if game_state else 0
        
        if current_version > last_version:
            players_collection = db['players']
            players = list(players_collection.find({}).sort('joinedAt', -1))
            
            if game_state and '_id' in game_state:
                game_state['_id'] = str(game_state['_id'])
            for player in players:
                player['_id'] = str(player['_id'])
            
            return jsonify({
                'success': True,
                'hasUpdate': True,
                'version': current_version,
                'gameState': game_state,
                'players': players,
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        
        return jsonify({
            'success': True,
            'hasUpdate': False,
            'version': current_version,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Admin Routes
@app.route('/api/admin', methods=['POST', 'OPTIONS'])
def admin():
    db = get_database()
    if db is None:
        return jsonify({
            'success': False,
            'error': 'Database not configured'
        }), 503
    
    try:
        data = request.get_json() or {}
        action = data.get('action')
        
        if not action or action not in ['start', 'pause', 'restart', 'stop']:
            return jsonify({
                'success': False,
                'error': 'Invalid action'
            }), 400
        
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
            players.update_many({}, {'$set': {'score': 0}})
        elif action == 'stop':
            new_status = 'idle'
            additional_updates['startedAt'] = None
            additional_updates['pausedAt'] = None
        
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
        
        return jsonify({
            'success': True,
            'action': action,
            'gameState': result,
            'message': f'Game {action}ed successfully'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
