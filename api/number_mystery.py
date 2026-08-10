from flask import Blueprint, request, jsonify
from datetime import datetime
from bson.objectid import ObjectId
import random

try:
    from .db import get_database
except ImportError:
    from db import get_database

number_mystery_bp = Blueprint('number_mystery', __name__)

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

@number_mystery_bp.route('/api/rooms/<room_id>/guess', methods=['POST'])
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
