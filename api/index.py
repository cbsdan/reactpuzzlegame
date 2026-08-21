from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from bson.objectid import ObjectId
import secrets

try:
    from .db import get_database
except ImportError:
    from db import get_database

try:
    from .number_mystery import number_mystery_bp, generate_target_number, generate_clues
except ImportError:
    from number_mystery import number_mystery_bp, generate_target_number, generate_clues

try:
    from .stickman_mystery import stickman_mystery_bp
except ImportError:
    from stickman_mystery import stickman_mystery_bp

try:
    from .trivia_challenge import trivia_challenge_bp
except ImportError:
    from trivia_challenge import trivia_challenge_bp

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

# Register game-specific blueprints
app.register_blueprint(number_mystery_bp)
app.register_blueprint(stickman_mystery_bp)
app.register_blueprint(trivia_challenge_bp)

def generate_passkey():
    """Generate a 6-character passkey"""
    return secrets.token_hex(3).upper()

def get_room_by_id(db, room_id):
    """Get a room by ID and include its players and gameState"""
    try:
        rooms = db['rooms']
        room = rooms.find_one({'_id': ObjectId(room_id)})
        
        if not room:
            return None
        
        # Get players for this room
        players_collection = db['players']
        players = list(players_collection.find({'roomId': ObjectId(room_id)}))
        
        # Get game state for this room
        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': ObjectId(room_id)})
        
        # Convert IDs to strings
        room['_id'] = str(room['_id'])
        room['adminId'] = str(room['adminId'])
        
        for player in players:
            player['_id'] = str(player['_id'])
            player['roomId'] = str(player['roomId'])
        
        if game_state:
            game_state['_id'] = str(game_state['_id'])
            game_state['roomId'] = str(game_state['roomId'])
        
        room['players'] = players
        room['gameState'] = game_state
        if game_state:
            game_state.pop('targetNumber', None)  # never expose to clients
        
        return room
    except Exception:
        return None

# Rooms Routes
@app.route('/api/rooms', methods=['POST'])
def create_room():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        rooms = db['rooms']
        game_states = db['gamestate']
        
        passkey = generate_passkey()
        
        # Create new room
        room_doc = {
            'passkey': passkey,
            'adminId': ObjectId(),  # Placeholder, could be user ID
            'createdAt': datetime.utcnow(),
            'isActive': True
        }
        
        result = rooms.insert_one(room_doc)
        room_id = result.inserted_id
        
        # Create game state for this room
        game_state_doc = {
            'roomId': room_id,
            'status': 'idle',
            'startedAt': None,
            'pausedAt': None,
            'updatedAt': datetime.utcnow(),
            'version': 0
        }
        
        game_states.insert_one(game_state_doc)
        
        # Get the full room
        room = get_room_by_id(db, str(room_id))
        
        return jsonify({
            'success': True,
            'room': room
        }), 201
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/join', methods=['POST'])
def join_room():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        data = request.get_json() or {}
        passkey = data.get('passkey', '').strip().upper()
        player_name = data.get('playerName', '').strip()
        
        if not passkey:
            return jsonify({'success': False, 'error': 'Passkey is required'}), 400
        if not player_name:
            return jsonify({'success': False, 'error': 'Player name is required'}), 400
        
        rooms = db['rooms']
        players_collection = db['players']
        
        # Find room by passkey
        room = rooms.find_one({'passkey': passkey, 'isActive': True})
        
        if not room:
            return jsonify({'success': False, 'error': 'Invalid room passkey'}), 404
        
        # Check if game is already in progress (allow trivia-challenge to be joined in progress)
        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': room['_id']})
        if game_state and game_state.get('status', 'idle') != 'idle':
            game_type = game_state.get('gameType')
            if game_type != 'trivia-challenge':
                return jsonify({'success': False, 'error': 'Game is already in progress. You cannot join right now.'}), 403
        
        # Add player to room
        new_player = {
            'roomId': room['_id'],
            'name': player_name,
            'score': 0,
            'joinedAt': datetime.utcnow(),
            'isActive': True
        }
        
        result = players_collection.insert_one(new_player)
        new_player['_id'] = str(result.inserted_id)
        new_player['roomId'] = str(new_player['roomId'])
        
        # Get full room
        full_room = get_room_by_id(db, str(room['_id']))
        
        return jsonify({
            'success': True,
            'player': new_player,
            'room': full_room
        }), 201
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/players', methods=['GET', 'POST'])
def room_players(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        room_oid = ObjectId(room_id)
        players_collection = db['players']
        
        if request.method == 'GET':
            # Get all players in the room
            players = list(players_collection.find({'roomId': room_oid}).sort('joinedAt', -1))
            
            for player in players:
                player['_id'] = str(player['_id'])
                player['roomId'] = str(player['roomId'])
            
            return jsonify({
                'success': True,
                'players': players
            }), 200
        
        elif request.method == 'POST':
            data = request.get_json() or {}
            name = data.get('name', '').strip()
            
            if not name:
                return jsonify({'success': False, 'error': 'Name is required'}), 400
            
            # Add player
            new_player = {
                'roomId': room_oid,
                'name': name,
                'score': 0,
                'joinedAt': datetime.utcnow(),
                'isActive': True
            }
            
            result = players_collection.insert_one(new_player)
            new_player['_id'] = str(result.inserted_id)
            new_player['roomId'] = str(new_player['roomId'])
            
            # Return updated players list
            players = list(players_collection.find({'roomId': room_oid}).sort('joinedAt', -1))
            for player in players:
                player['_id'] = str(player['_id'])
                player['roomId'] = str(player['roomId'])
            
            return jsonify({
                'success': True,
                'player': new_player,
                'players': players
            }), 201
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/players/<player_id>', methods=['DELETE'])
def remove_room_player(room_id, player_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        room_oid = ObjectId(room_id)
        player_oid = ObjectId(player_id)
        players_collection = db['players']
        
        # Remove player
        result = players_collection.delete_one({'_id': player_oid, 'roomId': room_oid})
        
        if result.deleted_count == 0:
            return jsonify({'success': False, 'error': 'Player not found'}), 404
        
        # Return updated players list
        players = list(players_collection.find({'roomId': room_oid}).sort('joinedAt', -1))
        for player in players:
            player['_id'] = str(player['_id'])
            player['roomId'] = str(player['roomId'])
        
        return jsonify({
            'success': True,
            'players': players
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/admin', methods=['POST'])
def room_admin_action(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        room_oid = ObjectId(room_id)
        data = request.get_json() or {}
        action = data.get('action')
        game_type = data.get('gameType')
        
        if not action or action not in ['start', 'pause', 'resume', 'restart', 'stop', 'clear-sessions', 'delete-session', 'update-config']:
            return jsonify({'success': False, 'error': 'Invalid action'}), 400
        
        game_states = db['gamestate']
        players_collection = db['players']
        
        # Ensure gamestate doc exists
        existing_state = game_states.find_one({'roomId': room_oid})
        if not existing_state:
            game_states.insert_one({
                'roomId': room_oid,
                'status': 'idle',
                'startedAt': None,
                'pausedAt': None,
                'updatedAt': datetime.utcnow(),
                'version': 0
            })
        
        new_status = None
        additional_updates = {}
        
        if action == 'update-config':
            # Push updated triviaConfig to the existing game state without touching status
            trivia_config = data.get('triviaConfig')
            if trivia_config is not None:
                additional_updates['triviaConfig'] = trivia_config
            stickman_config = data.get('stickmanConfig')
            if stickman_config is not None:
                additional_updates['stickmanConfig'] = stickman_config
            # Update in DB and return immediately
            result = game_states.find_one_and_update(
                {'roomId': room_oid},
                {
                    '$set': {**additional_updates, 'updatedAt': datetime.utcnow()},
                    '$inc': {'version': 1}
                },
                return_document=True
            )
            if result:
                result['_id'] = str(result['_id'])
                result['roomId'] = str(result['roomId'])
                result.pop('targetNumber', None)
                result.pop('mysteryAnswer', None)
            return jsonify({'success': True, 'action': action, 'gameState': result}), 200
        elif action == 'start':
            new_status = 'playing'
            additional_updates['startedAt'] = datetime.utcnow()
            additional_updates['pausedAt'] = None
            additional_updates['totalPausedMs'] = 0
            # Preserve existing sessions; only set sessionNumber to 1 if no prior sessions exist
            current_sessions = existing_state.get('sessions', []) if existing_state else []
            next_session_num = (max((s.get('sessionNumber', 0) for s in current_sessions), default=0) + 1) if current_sessions else 1
            additional_updates['sessionNumber'] = next_session_num
            if game_type:
                additional_updates['gameType'] = game_type
                if game_type == 'number-mystery':
                    target = generate_target_number()
                    clues = generate_clues(target)
                    additional_updates['targetNumber'] = target  # stored server-side
                    additional_updates['clues'] = clues           # safe to expose
                elif game_type == 'stickman-mystery':
                    additional_updates['mysteryAnswer'] = 'LIGHT'
                    additional_updates['mysteryQuestion'] = 'All five clues describe the same thing. What am I?'
                    # Store admin custom configuration if provided
                    stickman_config = data.get('stickmanConfig')
                    if stickman_config:
                        additional_updates['stickmanConfig'] = stickman_config
                    else:
                        additional_updates['stickmanConfig'] = None
                elif game_type == 'trivia-challenge':
                    trivia_config = data.get('triviaConfig')
                    if trivia_config:
                        additional_updates['triviaConfig'] = trivia_config
                    elif existing_state and existing_state.get('triviaConfig'):
                        additional_updates['triviaConfig'] = existing_state.get('triviaConfig')
                    else:
                        additional_updates['triviaConfig'] = {}
            # Reset all player progress for the new game
            players_collection.update_many(
                {'roomId': room_oid},
                {'$set': {
                    'score': 0, 'solved': False,
                    'numberMystery': {'score': 0, 'solved': False, 'guessCount': 0, 'solvedAt': None},
                    'stickmanMystery': {
                        'score': 0, 'solved': False, 'wrongAttempts': 0, 'stageScores': [],
                        'solvedAt': None, 'progress': None, 'posX': None, 'posZ': None, 'posAngle': None
                    },
                    'triviaChallenge': {
                        'score': 0, 'completed': False, 'currentRound': 0,
                        'questionsAnswered': 0, 'correctAnswers': 0, 'solvedAt': None
                    }
                }}
            )
        elif action == 'pause':
            new_status = 'paused'
            additional_updates['pausedAt'] = datetime.utcnow()
        elif action == 'resume':
            # Resume from pause: accumulate paused duration
            new_status = 'playing'
            existing_state = existing_state or game_states.find_one({'roomId': room_oid})
            paused_at = existing_state.get('pausedAt') if existing_state else None
            prev_total = existing_state.get('totalPausedMs', 0) if existing_state else 0
            if paused_at:
                pause_delta = (datetime.utcnow() - paused_at).total_seconds() * 1000
                additional_updates['totalPausedMs'] = int(prev_total + pause_delta)
            additional_updates['pausedAt'] = None
        elif action == 'restart':
            existing_state = game_states.find_one({'roomId': room_oid})
            current_session_num = existing_state.get('sessionNumber', 1) if existing_state else 1

            # Snapshot current session scores before resetting
            current_players = list(players_collection.find({'roomId': room_oid}))
            game_type_snap = existing_state.get('gameType', '') if existing_state else ''
            session_scores = []
            for p in current_players:
                entry = {
                    'playerId': str(p['_id']),
                    'name': p.get('name', ''),
                    'score': p.get('score', 0),
                    'solved': p.get('solved', False),
                }
                if game_type_snap == 'number-mystery':
                    nm = p.get('numberMystery') or {}
                    entry['numberMystery'] = {
                        'score': nm.get('score', p.get('score', 0)),
                        'solved': nm.get('solved', p.get('solved', False)),
                        'guessCount': nm.get('guessCount', 0),
                    }
                elif game_type_snap == 'stickman-mystery':
                    sm = p.get('stickmanMystery') or {}
                    entry['stickmanMystery'] = {
                        'score': sm.get('score', p.get('score', 0)),
                        'solved': sm.get('solved', p.get('solved', False)),
                        'wrongAttempts': sm.get('wrongAttempts', 0),
                        'stageScores': sm.get('stageScores', []),
                    }
                elif game_type_snap == 'trivia-challenge':
                    tc = p.get('triviaChallenge') or {}
                    entry['triviaChallenge'] = {
                        'score': tc.get('score', p.get('score', 0)),
                        'completed': tc.get('completed', False),
                        'questionsAnswered': tc.get('questionsAnswered', 0),
                        'correctAnswers': tc.get('correctAnswers', 0),
                    }
                session_scores.append(entry)
            winner = max(session_scores, key=lambda x: x['score'], default=None) if session_scores else None
            session_snapshot = {
                'sessionNumber': current_session_num,
                'endedAt': datetime.utcnow(),
                'scores': session_scores,
                'winner': winner
            }
            game_states.update_one({'roomId': room_oid}, {'$push': {'sessions': session_snapshot}})

            new_status = 'playing'
            additional_updates['startedAt'] = datetime.utcnow()
            additional_updates['pausedAt'] = None
            additional_updates['totalPausedMs'] = 0
            additional_updates['sessionNumber'] = current_session_num + 1
            players_collection.update_many(
                {'roomId': room_oid},
                {'$set': {
                    'score': 0, 'solved': False,
                    'numberMystery': {'score': 0, 'solved': False, 'guessCount': 0, 'solvedAt': None},
                    'stickmanMystery': {
                        'score': 0, 'solved': False, 'wrongAttempts': 0, 'stageScores': [],
                        'solvedAt': None, 'progress': None, 'posX': None, 'posZ': None, 'posAngle': None
                    },
                    'triviaChallenge': {
                        'score': 0, 'completed': False, 'currentRound': 0,
                        'questionsAnswered': 0, 'correctAnswers': 0, 'solvedAt': None
                    }
                }}
            )
            # Generate new target if game type exists
            gt = existing_state.get('gameType') if existing_state else None
            if gt == 'number-mystery':
                target = generate_target_number()
                clues = generate_clues(target)
                additional_updates['targetNumber'] = target
                additional_updates['clues'] = clues
            elif gt == 'stickman-mystery':
                additional_updates['mysteryAnswer'] = 'LIGHT'
                additional_updates['mysteryQuestion'] = 'All five clues describe the same thing. What am I?'
        elif action == 'clear-sessions':
            game_states.update_one(
                {'roomId': room_oid},
                {'$set': {'sessions': []}, '$inc': {'version': 1}}
            )
            result = game_states.find_one({'roomId': room_oid})
            if result:
                result['_id'] = str(result['_id'])
                result['roomId'] = str(result['roomId'])
                result.pop('targetNumber', None)
            return jsonify({'success': True, 'action': action, 'gameState': result}), 200
        elif action == 'delete-session':
            session_number = data.get('sessionNumber')
            if session_number is None:
                return jsonify({'success': False, 'error': 'sessionNumber required'}), 400
            game_states.update_one(
                {'roomId': room_oid},
                {'$pull': {'sessions': {'sessionNumber': session_number}}, '$inc': {'version': 1}}
            )
            result = game_states.find_one({'roomId': room_oid})
            if result:
                result['_id'] = str(result['_id'])
                result['roomId'] = str(result['roomId'])
                result.pop('targetNumber', None)
            return jsonify({'success': True, 'action': action, 'gameState': result}), 200
        elif action == 'stop':
            existing_state = game_states.find_one({'roomId': room_oid})
            if existing_state and existing_state.get('status') != 'idle':
                current_session_num = existing_state.get('sessionNumber', 1)
                current_players = list(players_collection.find({'roomId': room_oid}))
                game_type_snap = existing_state.get('gameType', '') if existing_state else ''
                session_scores = []
                for p in current_players:
                    entry = {
                        'playerId': str(p['_id']),
                        'name': p.get('name', ''),
                        'score': p.get('score', 0),
                        'solved': p.get('solved', False),
                    }
                    if game_type_snap == 'number-mystery':
                        nm = p.get('numberMystery') or {}
                        entry['numberMystery'] = {
                            'score': nm.get('score', p.get('score', 0)),
                            'solved': nm.get('solved', p.get('solved', False)),
                            'guessCount': nm.get('guessCount', 0),
                        }
                    elif game_type_snap == 'stickman-mystery':
                        sm = p.get('stickmanMystery') or {}
                        entry['stickmanMystery'] = {
                            'score': sm.get('score', p.get('score', 0)),
                            'solved': sm.get('solved', p.get('solved', False)),
                            'wrongAttempts': sm.get('wrongAttempts', 0),
                            'stageScores': sm.get('stageScores', []),
                        }
                    elif game_type_snap == 'trivia-challenge':
                        tc = p.get('triviaChallenge') or {}
                        entry['triviaChallenge'] = {
                            'score': tc.get('score', p.get('score', 0)),
                            'completed': tc.get('completed', False),
                            'questionsAnswered': tc.get('questionsAnswered', 0),
                            'correctAnswers': tc.get('correctAnswers', 0),
                        }
                    session_scores.append(entry)
                winner = max(session_scores, key=lambda x: x['score'], default=None) if session_scores else None
                session_snapshot = {
                    'sessionNumber': current_session_num,
                    'endedAt': datetime.utcnow(),
                    'scores': session_scores,
                    'winner': winner
                }
                game_states.update_one({'roomId': room_oid}, {'$push': {'sessions': session_snapshot}})

            new_status = 'idle'
            additional_updates['startedAt'] = None
            additional_updates['pausedAt'] = None
            additional_updates['totalPausedMs'] = 0
            additional_updates['gameType'] = None
            additional_updates['targetNumber'] = None
            additional_updates['clues'] = None
            additional_updates['mysteryAnswer'] = None
            additional_updates['mysteryQuestion'] = None
            additional_updates['stickmanConfig'] = None
            additional_updates['triviaConfig'] = None
            # Reset player scores so they aren't double-counted (session snapshot already captured them)
            players_collection.update_many(
                {'roomId': room_oid},
                {'$set': {
                    'score': 0, 'solved': False,
                    'numberMystery': {'score': 0, 'solved': False, 'guessCount': 0, 'solvedAt': None},
                    'stickmanMystery': {
                        'score': 0, 'solved': False, 'wrongAttempts': 0, 'stageScores': [],
                        'solvedAt': None, 'progress': None, 'posX': None, 'posZ': None, 'posAngle': None
                    },
                    'triviaChallenge': {
                        'score': 0, 'completed': False, 'currentRound': 0,
                        'questionsAnswered': 0, 'correctAnswers': 0, 'solvedAt': None
                    }
                }}
            )
        
        update_data = {
            'status': new_status,
            'updatedAt': datetime.utcnow(),
            **additional_updates
        }
        
        result = game_states.find_one_and_update(
            {'roomId': room_oid},
            {
                '$set': update_data,
                '$inc': {'version': 1}
            },
            return_document=True
        )
        
        if result:
            result['_id'] = str(result['_id'])
            result['roomId'] = str(result['roomId'])
            # Never send secret answers to clients via admin action responses
            result.pop('targetNumber', None)
            result.pop('mysteryAnswer', None)
        
        return jsonify({
            'success': True,
            'action': action,
            'gameState': result
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/game-state', methods=['GET'])
def room_game_state(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        room_oid = ObjectId(room_id)
        game_states = db['gamestate']
        
        game_state = game_states.find_one({'roomId': room_oid})
        
        if not game_state:
            game_state = {
                'roomId': room_oid,
                'status': 'idle',
                'startedAt': None,
                'pausedAt': None,
                'updatedAt': datetime.utcnow(),
                'version': 0
            }
            game_states.insert_one(game_state)
        
        if '_id' in game_state:
            game_state['_id'] = str(game_state['_id'])
        game_state['roomId'] = str(game_state['roomId'])
        
        return jsonify({
            'success': True,
            'gameState': game_state
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Events Route (Long Polling)
@app.route('/api/events', methods=['GET'])
def events():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        last_version = int(request.args.get('lastVersion', 0))
        last_players_count = int(request.args.get('lastPlayersCount', -1))
        room_id = request.args.get('roomId')
        
        if not room_id:
            return jsonify({
                'success': True,
                'hasUpdate': False,
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        
        room_oid = ObjectId(room_id)
        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': room_oid})
        current_version = game_state.get('version', 0) if game_state else 0
        
        # Always get players list
        players_collection = db['players']
        players = list(players_collection.find({'roomId': room_oid}).sort('joinedAt', -1))
        current_players_count = len(players)
        
        # Check if there's an update (game state changed OR players list changed)
        has_game_update = current_version > last_version
        has_players_update = current_players_count != last_players_count
        has_update = has_game_update or has_players_update
        
        is_admin = request.args.get('isAdmin', 'false').lower() == 'true'

        # Always serialize players so progress/stage data stays live
        for player in players:
            player['_id'] = str(player['_id'])
            player['roomId'] = str(player['roomId'])

        if has_update:
            if game_state and '_id' in game_state:
                game_state['_id'] = str(game_state['_id'])
            if game_state:
                game_state['roomId'] = str(game_state['roomId'])
                if not is_admin:
                    game_state.pop('targetNumber', None)  # only strip for non-admins
                    game_state.pop('mysteryAnswer', None)
                    # Strip correct answers from trivia questions for players
                    trivia_cfg = game_state.get('triviaConfig')
                    if trivia_cfg and isinstance(trivia_cfg, dict):
                        questions = trivia_cfg.get('questions')
                        if questions and isinstance(questions, dict):
                            stripped = {}
                            for cat_name, cat_data in questions.items():
                                if isinstance(cat_data, dict):
                                    qs = cat_data.get('questions', [])
                                    stripped[cat_name] = {
                                        **cat_data,
                                        'questions': [{k: v for k, v in q.items() if k != 'answer'} for q in qs]
                                    }
                                elif isinstance(cat_data, list):
                                    stripped[cat_name] = [{k: v for k, v in q.items() if k != 'answer'} for q in cat_data]
                                else:
                                    stripped[cat_name] = cat_data
                            trivia_cfg['questions'] = stripped
            
            return jsonify({
                'success': True,
                'hasUpdate': True,
                'version': current_version,
                'playersCount': current_players_count,
                'gameState': game_state,
                'players': players,
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        
        # No game-state update but always return fresh player list
        return jsonify({
            'success': True,
            'hasUpdate': False,
            'version': current_version,
            'playersCount': current_players_count,
            'players': players,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
