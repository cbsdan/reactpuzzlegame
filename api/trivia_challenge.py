from flask import Blueprint, request, jsonify
from datetime import datetime
from bson.objectid import ObjectId

try:
    from .db import get_database
except ImportError:
    from db import get_database

trivia_challenge_bp = Blueprint('trivia_challenge', __name__)

@trivia_challenge_bp.route('/api/rooms/<room_id>/trivia-answer', methods=['POST'])
def submit_trivia_answer(room_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503

    try:
        room_oid = ObjectId(room_id)
        data = request.get_json() or {}
        player_id = data.get('playerId')
        points_earned = int(data.get('pointsEarned', 0))
        total_score = int(data.get('totalScore', 0))
        total_questions = int(data.get('totalQuestionsAnswered', 0))
        is_correct = bool(data.get('isCorrect', False))
        current_round = int(data.get('currentRound', 1))

        if not player_id:
            return jsonify({'success': False, 'error': 'playerId required'}), 400

        game_states = db['gamestate']
        game_state = game_states.find_one({'roomId': room_oid})

        if not game_state or game_state.get('status') != 'playing':
            return jsonify({'success': False, 'error': 'Game is not active'}), 400

        trivia_config = game_state.get('triviaConfig') or {}
        total_rounds = trivia_config.get('rounds', 3)
        q_per_round = trivia_config.get('questionsPerRound', 5)
        total_possible = total_rounds * q_per_round
        is_completed = total_questions >= total_possible

        players_collection = db['players']

        # Read current state to accumulate correct answers
        player_doc = players_collection.find_one({'_id': ObjectId(player_id)})
        prev_correct = 0
        if player_doc:
            tc = player_doc.get('triviaChallenge') or {}
            prev_correct = tc.get('correctAnswers', 0)

        new_correct = prev_correct + (1 if is_correct else 0)

        update_fields = {
            'score': max(0, total_score),
            'solved': is_completed,
            'triviaChallenge.score': max(0, total_score),
            'triviaChallenge.completed': is_completed,
            'triviaChallenge.currentRound': current_round,
            'triviaChallenge.questionsAnswered': total_questions,
            'triviaChallenge.correctAnswers': new_correct,
        }

        if is_completed:
            update_fields['triviaChallenge.solvedAt'] = datetime.utcnow()

        players_collection.update_one(
            {'_id': ObjectId(player_id), 'roomId': room_oid},
            {'$set': update_fields}
        )

        # Increment version so leaderboard refreshes for all
        game_states.update_one({'roomId': room_oid}, {'$inc': {'version': 1}})

        return jsonify({
            'success': True,
            'score': total_score,
            'completed': is_completed,
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
