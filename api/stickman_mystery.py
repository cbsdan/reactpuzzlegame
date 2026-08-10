from flask import Blueprint, request, jsonify
from datetime import datetime
from bson.objectid import ObjectId

try:
    from .db import get_database
except ImportError:
    from db import get_database

stickman_mystery_bp = Blueprint('stickman_mystery', __name__)

# Submit a text answer (Stickman Mystery and future text-answer games)
@stickman_mystery_bp.route('/api/rooms/<room_id>/answer', methods=['POST'])
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
                # Score = 1000 - elapsed*2 - wrongAttempts*100 (elapsed = 300 - timeLeft)
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


# Multiplayer position sync for Stickman game
@stickman_mystery_bp.route('/api/rooms/<room_id>/sync-position', methods=['POST'])
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


@stickman_mystery_bp.route('/api/rooms/<room_id>/push', methods=['POST'])
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
