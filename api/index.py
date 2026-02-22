from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from bson.objectid import ObjectId
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import os
import secrets
import random

# --- Inline MongoDB connection (avoids module import issues on Vercel) ---
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
# -------------------------------------------------------------------------

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

def generate_passkey():
    """Generate a 6-character passkey"""
    return secrets.token_hex(3).upper()

def generate_target_number():
    """Generate a 4-digit number with all unique digits (first digit non-zero)"""
    first = random.randint(1, 9)
    rest = random.sample([d for d in range(0, 10) if d != first], 3)
    return str(first) + ''.join(str(d) for d in rest)

def generate_clues(number):
    """Generate 3 mystery clues for the target number without revealing it"""
    digits = [int(d) for d in number]
    digit_sum = sum(digits)
    max_digit = max(digits)
    even_count = sum(1 for d in digits if d % 2 == 0)
    odd_count = 4 - even_count
    first_digit = digits[0]
    last_digit = digits[-1]
    clues = [
        f"The sum of all four digits is {digit_sum}",
        f"There {'is' if even_count == 1 else 'are'} {even_count} even digit{'s' if even_count != 1 else ''} in the code",
        f"The first digit is greater than {first_digit - 1} and the last digit is {'even' if last_digit % 2 == 0 else 'odd'}",
    ]
    return clues

def get_bulls_cows(target, guess):
    """Calculate bulls (correct position) and cows (correct digit, wrong position)"""
    bulls = sum(t == g for t, g in zip(target, guess))
    cows = sum(min(target.count(d), guess.count(d)) for d in set(guess)) - bulls
    return bulls, cows

def get_digit_results(target, guess):
    """Return per-digit result list: 'bull', 'cow', or 'miss' for each position"""
    results = ['miss'] * 4
    target_remaining = list(target)
    # First pass: bulls (right digit, right spot)
    for i in range(4):
        if guess[i] == target[i]:
            results[i] = 'bull'
            target_remaining[i] = None
    # Second pass: cows (right digit, wrong spot)
    for i in range(4):
        if results[i] == 'bull':
            continue
        if guess[i] in target_remaining:
            results[i] = 'cow'
            target_remaining[target_remaining.index(guess[i])] = None
    return results

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
    except:
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
        
        # Check if game is already in progress
        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': room['_id']})
        if game_state and game_state.get('status', 'idle') != 'idle':
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
        
        if not action or action not in ['start', 'pause', 'resume', 'restart', 'stop', 'clear-sessions', 'delete-session']:
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
        
        if action == 'start':
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
            # Reset all player progress for the new game
            players_collection.update_many(
                {'roomId': room_oid},
                {'$set': {
                    'score': 0, 'solved': False,
                    'numberMystery': {'score': 0, 'solved': False, 'guessCount': 0, 'solvedAt': None},
                    'stickmanMystery': {
                        'score': 0, 'solved': False, 'wrongAttempts': 0, 'stageScores': [],
                        'solvedAt': None, 'progress': None, 'posX': None, 'posZ': None, 'posAngle': None
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
            # Reset player scores so they aren't double-counted (session snapshot already captured them)
            players_collection.update_many(
                {'roomId': room_oid},
                {'$set': {
                    'score': 0, 'solved': False,
                    'numberMystery': {'score': 0, 'solved': False, 'guessCount': 0, 'solvedAt': None},
                    'stickmanMystery': {
                        'score': 0, 'solved': False, 'wrongAttempts': 0, 'stageScores': [],
                        'solvedAt': None, 'progress': None, 'posX': None, 'posZ': None, 'posAngle': None
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

@app.route('/api/rooms/<room_id>/guess', methods=['POST'])
def submit_guess(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    
    try:
        room_oid = ObjectId(room_id)
        data = request.get_json() or {}
        player_id = data.get('playerId')
        guess = str(data.get('guess', '')).strip()
        
        if not player_id:
            return jsonify({'success': False, 'error': 'playerId required'}), 400
        if not guess or len(guess) != 4 or not guess.isdigit():
            return jsonify({'success': False, 'error': 'Guess must be a 4-digit number'}), 400
        
        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': room_oid})
        
        if not game_state or game_state.get('status') != 'playing':
            return jsonify({'success': False, 'error': 'Game is not active'}), 400
        
        target = game_state.get('targetNumber')
        if not target:
            return jsonify({'success': False, 'error': 'No target number set'}), 400
        
        bulls, cows = get_bulls_cows(target, guess)
        digit_results = get_digit_results(target, guess)
        is_correct = (bulls == 4)
        
        score = 0
        if is_correct:
            # Calculate score
            started_at = game_state.get('startedAt')
            if started_at:
                elapsed = (datetime.utcnow() - started_at).total_seconds()
            else:
                elapsed = 0
            # Score = 1000 - time penalty - guess penalty (but floor at 0)
            # We pass guess count from client
            guess_count = int(data.get('guessCount', 1))
            score = max(0, int(1000 - elapsed * 3 - guess_count * 50))
            
            # Update player — root fields (denorm) + numberMystery sub-doc
            players_collection = db['players']
            players_collection.update_one(
                {'_id': ObjectId(player_id)},
                {'$set': {
                    'score': score,
                    'solved': True,
                    'numberMystery': {
                        'score': score,
                        'solved': True,
                        'guessCount': guess_count,
                        'solvedAt': datetime.utcnow(),
                    }
                }}
            )
            
            # Increment version so all clients get update
            game_states.update_one({'roomId': room_oid}, {'$inc': {'version': 1}})
        
        return jsonify({
            'success': True,
            'bulls': bulls,
            'cows': cows,
            'digitResults': digit_results,
            'isCorrect': is_correct,
            'score': score,
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Submit a text answer (Stickman Mystery and future text-answer games)
@app.route('/api/rooms/<room_id>/answer', methods=['POST'])
def submit_answer(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503

    try:
        room_oid = ObjectId(room_id)
        data = request.get_json() or {}
        player_id = data.get('playerId')
        answer = str(data.get('answer', '')).strip()
        time_left = int(data.get('timeLeft', 0))
        wrong_attempts = int(data.get('wrongAttempts', 0))

        if not player_id or not answer:
            return jsonify({'success': False, 'error': 'playerId and answer are required'}), 400

        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': room_oid})

        if not game_state or game_state.get('status') != 'playing':
            return jsonify({'success': False, 'error': 'Game is not active'}), 400

        game_type = game_state.get('gameType', '')
        players_collection = db['players']
        score = 0
        is_correct = False

        if game_type == 'stickman-mystery':
            # Stickman has multi-stage scoring computed client-side; trust totalScore
            total_score = int(data.get('totalScore', 0))
            # The client validates each stage answer locally, so we accept and record
            is_correct = True
            score = max(0, total_score)
            players_collection.update_one(
                {'_id': ObjectId(player_id)},
                {'$set': {
                    'score': score,
                    'solved': True,
                    'stickmanMystery': {
                        'score': score,
                        'solved': True,
                        'wrongAttempts': wrong_attempts,
                        'stageScores': data.get('stageScores', []),
                        'solvedAt': datetime.utcnow(),
                    }
                }}
            )
            game_states.update_one({'roomId': room_oid}, {'$inc': {'version': 1}})
        else:
            correct_answer = str(game_state.get('mysteryAnswer', '')).strip()
            is_correct = answer.upper() == correct_answer.upper()

            if is_correct:
                # Score = 1000 − elapsed*2 − wrongAttempts*100  (elapsed = 300 − timeLeft)
                elapsed = 300 - max(0, time_left)
                score = max(0, int(1000 - elapsed * 2 - wrong_attempts * 100))

                players_collection.update_one(
                    {'_id': ObjectId(player_id)},
                    {'$set': {
                        'score': score,
                        'solved': True,
                        'numberMystery': {
                            'score': score,
                            'solved': True,
                            'guessCount': wrong_attempts + 1,
                            'solvedAt': datetime.utcnow(),
                        }
                    }}
                )
                game_states.update_one({'roomId': room_oid}, {'$inc': {'version': 1}})

        return jsonify({
            'success': True,
            'isCorrect': is_correct,
            'score': score,
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Events Route (Long Polling) - Updated for rooms
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
            
            return jsonify({
                'success': True,
                'hasUpdate': True,
                'version': current_version,
                'playersCount': current_players_count,
                'gameState': game_state,
                'players': players,
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        
        # No game-state update but always return fresh player list (progress data updates every 150ms)
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



# ── Multiplayer position sync for Stickman game ──────────────────────
@app.route('/api/rooms/<room_id>/sync-position', methods=['POST'])
def sync_position(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        room_oid = ObjectId(room_id)
        data = request.get_json() or {}
        player_id = data.get('playerId')
        x = float(data.get('x', 0))
        z = float(data.get('z', 0))
        angle = float(data.get('angle', 0))
        current_stage = data.get('stage')  # which stage this player is on

        if not player_id:
            return jsonify({'success': False, 'error': 'playerId required'}), 400

        players_collection = db['players']

        # Build update — position + optional Stickman-specific progress data
        update_fields = {
            # Keep top-level pos fields for stage-filter queries
            'posX': x, 'posZ': z, 'posAngle': angle,
            # Also write into namespaced sub-doc
            'stickmanMystery.posX': x,
            'stickmanMystery.posZ': z,
            'stickmanMystery.posAngle': angle,
            'posUpdatedAt': datetime.utcnow()
        }
        if current_stage is not None:
            update_fields['currentStage'] = int(current_stage)
        progress = data.get('progress')
        if progress and isinstance(progress, dict):
            update_fields['progress'] = progress                    # legacy top-level
            update_fields['stickmanMystery.progress'] = progress    # namespaced
            # Mirror live accumulated score to both root and sub-doc
            if 'score' in progress:
                update_fields['score'] = int(progress['score'])
                update_fields['stickmanMystery.score'] = int(progress['score'])

        # Update this player's position
        players_collection.update_one(
            {'_id': ObjectId(player_id), 'roomId': room_oid},
            {'$set': update_fields}
        )

        # Read & clear any pending push for this player
        player_doc = players_collection.find_one_and_update(
            {'_id': ObjectId(player_id), 'roomId': room_oid, 'pendingPushX': {'$exists': True}},
            {'$unset': {'pendingPushX': '', 'pendingPushZ': ''}},
            return_document=False  # return the doc BEFORE clearing so we read the push
        )
        pending_push = None
        if player_doc and 'pendingPushX' in player_doc:
            pending_push = {'fx': player_doc['pendingPushX'], 'fz': player_doc['pendingPushZ']}

        # Get all players' positions in this room — filter by same stage if set
        pos_filter = {'roomId': room_oid, 'posX': {'$exists': True}}
        if current_stage is not None:
            pos_filter['currentStage'] = int(current_stage)
        all_players = list(players_collection.find(
            pos_filter,
            {'_id': 1, 'name': 1, 'posX': 1, 'posZ': 1, 'posAngle': 1}
        ))

        positions = []
        for p in all_players:
            positions.append({
                'playerId': str(p['_id']),
                'name': p.get('name', ''),
                'x': p.get('posX', 0),
                'z': p.get('posZ', 0),
                'angle': p.get('posAngle', 0),
            })

        return jsonify({
            'success': True,
            'positions': positions,
            'pendingPush': pending_push,
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/rooms/<room_id>/push', methods=['POST'])
def push_player(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        room_oid = ObjectId(room_id)
        data = request.get_json() or {}
        target_id = data.get('targetId')
        fx = float(data.get('forceX', 0))
        fz = float(data.get('forceZ', 0))

        if not target_id:
            return jsonify({'success': False, 'error': 'targetId required'}), 400

        players_collection = db['players']
        players_collection.update_one(
            {'_id': ObjectId(target_id), 'roomId': room_oid},
            {'$set': {'pendingPushX': fx, 'pendingPushZ': fz}}
        )

        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
