from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from bson.objectid import ObjectId

try:
    from .db import get_database
except ImportError:
    from db import get_database

trivia_challenge_bp = Blueprint('trivia_challenge', __name__)

DEFAULT_TRIVIA_CATEGORIES = {
    "Movies": {
        "icon": "🎬",
        "questions": [
            {
                "difficulty": 1,
                "question": "Who directed Titanic?",
                "choices": ["James Cameron", "Steven Spielberg", "Christopher Nolan", "Ridley Scott"],
                "answer": 0,
            },
            {
                "difficulty": 2,
                "question": "Which movie features the fictional world of Pandora?",
                "choices": ["Avatar", "Alien", "Dune", "Thor"],
                "answer": 0,
            },
            {
                "difficulty": 3,
                "question": "Who played the Joker in The Dark Knight?",
                "choices": ["Joaquin Phoenix", "Heath Ledger", "Jared Leto", "Jack Nicholson"],
                "answer": 1,
            },
            {
                "difficulty": 4,
                "question": "What year was Jurassic Park released?",
                "choices": ["1991", "1992", "1993", "1994"],
                "answer": 2,
            },
            {
                "difficulty": 5,
                "question": "Which film won the first Academy Award for Best Picture?",
                "choices": ["Sunrise", "Wings", "The Jazz Singer", "All Quiet on the Western Front"],
                "answer": 1,
            },
        ],
    },
    "Gaming": {
        "icon": "🎮",
        "questions": [
            {
                "difficulty": 1,
                "question": "What is Mario's brother's name?",
                "choices": ["Luigi", "Yoshi", "Wario", "Toad"],
                "answer": 0,
            },
            {
                "difficulty": 2,
                "question": "Master Chief is the protagonist of which franchise?",
                "choices": ["Halo", "Call of Duty", "Battlefield", "Destiny"],
                "answer": 0,
            },
            {
                "difficulty": 3,
                "question": "Geralt of Rivia is the main character of which series?",
                "choices": ["Skyrim", "The Witcher", "Dragon Age", "World of Warcraft"],
                "answer": 1,
            },
            {
                "difficulty": 4,
                "question": "What year did the original Nintendo Entertainment System launch in North America?",
                "choices": ["1983", "1985", "1987", "1990"],
                "answer": 1,
            },
            {
                "difficulty": 5,
                "question": "In the original God of War, which mythology did Kratos fight against?",
                "choices": ["Norse", "Greek", "Roman", "Egyptian"],
                "answer": 1,
            },
        ],
    },
    "Science": {
        "icon": "🔬",
        "questions": [
            {
                "difficulty": 1,
                "question": "What is the chemical formula for water?",
                "choices": ["H2O", "CO2", "NaCl", "O2"],
                "answer": 0,
            },
            {
                "difficulty": 2,
                "question": "Which planet is closest to the Sun?",
                "choices": ["Earth", "Venus", "Mercury", "Mars"],
                "answer": 2,
            },
            {
                "difficulty": 3,
                "question": "What is the approximate speed of light?",
                "choices": ["300,000 km/s", "30,000 km/s", "3,000 km/s", "500,000 km/s"],
                "answer": 0,
            },
            {
                "difficulty": 4,
                "question": "What is the chemical symbol for Gold?",
                "choices": ["Ag", "Au", "Gd", "Go"],
                "answer": 1,
            },
            {
                "difficulty": 5,
                "question": "What is the name of the phenomenon where particles appear to communicate instantly across any distance?",
                "choices": ["Superposition", "Quantum Entanglement", "Wave Collapse", "Tunneling"],
                "answer": 1,
            },
        ],
    },
    "History": {
        "icon": "📜",
        "questions": [
            {
                "difficulty": 1,
                "question": "Who was the first President of the United States?",
                "choices": ["George Washington", "Thomas Jefferson", "Abraham Lincoln", "John Adams"],
                "answer": 0,
            },
            {
                "difficulty": 2,
                "question": "In which year did World War II end?",
                "choices": ["1943", "1944", "1945", "1946"],
                "answer": 2,
            },
            {
                "difficulty": 3,
                "question": "Which ancient civilization built the Machu Picchu complex?",
                "choices": ["Aztec", "Maya", "Inca", "Olmec"],
                "answer": 2,
            },
            {
                "difficulty": 4,
                "question": "The Rosetta Stone helped decode which writing system?",
                "choices": ["Cuneiform", "Egyptian Hieroglyphs", "Linear A", "Sanskrit"],
                "answer": 1,
            },
            {
                "difficulty": 5,
                "question": "Which treaty ended the Thirty Years' War in 1648?",
                "choices": ["Treaty of Versailles", "Treaty of Tordesillas", "Peace of Westphalia", "Treaty of Utrecht"],
                "answer": 2,
            },
        ],
    },
    "Technology": {
        "icon": "💻",
        "questions": [
            {
                "difficulty": 1,
                "question": "What does 'CPU' stand for?",
                "choices": ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"],
                "answer": 0,
            },
            {
                "difficulty": 2,
                "question": "Who is the co-founder of Apple Inc.?",
                "choices": ["Bill Gates", "Steve Jobs", "Mark Zuckerberg", "Jeff Bezos"],
                "answer": 1,
            },
            {
                "difficulty": 3,
                "question": "What programming language is known as the 'language of the web'?",
                "choices": ["Python", "Java", "JavaScript", "C++"],
                "answer": 2,
            },
            {
                "difficulty": 4,
                "question": "In what year was the World Wide Web invented?",
                "choices": ["1985", "1989", "1993", "1995"],
                "answer": 1,
            },
            {
                "difficulty": 5,
                "question": "Which company developed the first commercially successful graphical user interface?",
                "choices": ["IBM", "Xerox PARC", "Apple", "Microsoft"],
                "answer": 2,
            },
        ],
    },
}

def parse_object_id(val):
    if not val:
        return None
    try:
        return ObjectId(val)
    except Exception:
        return None

def serialize_category(cat, question_count=0):
    return {
        'id': str(cat['_id']),
        'name': cat.get('name', ''),
        'icon': cat.get('icon', '❓'),
        'numberOfQuestions': question_count,
        'createdAt': cat.get('createdAt').isoformat() if isinstance(cat.get('createdAt'), datetime) else cat.get('createdAt'),
        'updatedAt': cat.get('updatedAt').isoformat() if isinstance(cat.get('updatedAt'), datetime) else cat.get('updatedAt')
    }

def serialize_question(q):
    return {
        'id': str(q['_id']),
        'categoryId': str(q.get('categoryId', '')),
        'question': q.get('question', ''),
        'difficulty': q.get('difficulty', 1),
        'choices': q.get('choices', []),
        'answer': q.get('answer', 0),
        'createdAt': q.get('createdAt').isoformat() if isinstance(q.get('createdAt'), datetime) else q.get('createdAt'),
        'updatedAt': q.get('updatedAt').isoformat() if isinstance(q.get('updatedAt'), datetime) else q.get('updatedAt')
    }

def ensure_trivia_defaults(db):
    """Seed default categories and questions if db collections are empty"""
    categories_coll = db['trivia_categories']
    questions_coll = db['trivia_questions']

    if categories_coll.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        for cat_name, cat_data in DEFAULT_TRIVIA_CATEGORIES.items():
            cat_doc = {
                'name': cat_name,
                'icon': cat_data.get('icon', '❓'),
                'createdAt': now,
                'updatedAt': now
            }
            res = categories_coll.insert_one(cat_doc)
            cat_id = res.inserted_id

            for q in cat_data.get('questions', []):
                q_doc = {
                    'categoryId': cat_id,
                    'question': q['question'],
                    'difficulty': q.get('difficulty', 1),
                    'choices': q.get('choices', []),
                    'answer': q.get('answer', 0),
                    'createdAt': now,
                    'updatedAt': now
                }
                questions_coll.insert_one(q_doc)


# ── Statistics & Summary APIs ──────────────────────────────────────
@trivia_challenge_bp.route('/api/trivia/counts', methods=['GET'])
def get_trivia_counts():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        ensure_trivia_defaults(db)
        categories_coll = db['trivia_categories']
        questions_coll = db['trivia_questions']

        categories = list(categories_coll.find().sort('name', 1))
        cat_summaries = []
        total_questions = 0

        for cat in categories:
            q_count = questions_coll.count_documents({'categoryId': cat['_id']})
            total_questions += q_count
            cat_summaries.append(serialize_category(cat, q_count))

        return jsonify({
            'success': True,
            'numberOfCategories': len(categories),
            'numberOfQuestions': total_questions,
            'categories': cat_summaries
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Category Management APIs ──────────────────────────────────────
@trivia_challenge_bp.route('/api/trivia/categories', methods=['GET'])
def get_categories():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        ensure_trivia_defaults(db)
        categories_coll = db['trivia_categories']
        questions_coll = db['trivia_questions']

        categories = list(categories_coll.find().sort('name', 1))
        result = []
        for cat in categories:
            q_count = questions_coll.count_documents({'categoryId': cat['_id']})
            result.append(serialize_category(cat, q_count))

        return jsonify({
            'success': True,
            'categories': result,
            'numberOfCategories': len(result)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/categories', methods=['POST'])
def create_category():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        data = request.get_json() or {}
        name = str(data.get('name', '')).strip()
        icon = str(data.get('icon', '❓')).strip() or '❓'

        if not name:
            return jsonify({'success': False, 'error': 'Category name is required'}), 400

        categories_coll = db['trivia_categories']
        if categories_coll.find_one({'name': {'$regex': f'^{name}$', '$options': 'i'}}):
            return jsonify({'success': False, 'error': 'Category with this name already exists'}), 400

        now = datetime.now(timezone.utc)
        doc = {
            'name': name,
            'icon': icon,
            'createdAt': now,
            'updatedAt': now
        }
        res = categories_coll.insert_one(doc)
        doc['_id'] = res.inserted_id

        return jsonify({'success': True, 'category': serialize_category(doc, 0)}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/categories/<category_id>', methods=['GET'])
def get_category(category_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        cat_oid = parse_object_id(category_id)
        if not cat_oid:
            return jsonify({'success': False, 'error': 'Invalid category ID'}), 400

        categories_coll = db['trivia_categories']
        questions_coll = db['trivia_questions']

        cat = categories_coll.find_one({'_id': cat_oid})
        if not cat:
            return jsonify({'success': False, 'error': 'Category not found'}), 404

        questions = list(questions_coll.find({'categoryId': cat_oid}).sort('difficulty', 1))
        serialized_questions = [serialize_question(q) for q in questions]

        result = serialize_category(cat, len(questions))
        result['questions'] = serialized_questions

        return jsonify({'success': True, 'category': result}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/categories/<category_id>', methods=['PUT'])
def update_category(category_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        cat_oid = parse_object_id(category_id)
        if not cat_oid:
            return jsonify({'success': False, 'error': 'Invalid category ID'}), 400

        data = request.get_json() or {}
        categories_coll = db['trivia_categories']
        questions_coll = db['trivia_questions']

        cat = categories_coll.find_one({'_id': cat_oid})
        if not cat:
            return jsonify({'success': False, 'error': 'Category not found'}), 404

        update_fields = {'updatedAt': datetime.now(timezone.utc)}
        if 'name' in data:
            new_name = str(data['name']).strip()
            if not new_name:
                return jsonify({'success': False, 'error': 'Category name cannot be empty'}), 400
            existing = categories_coll.find_one({
                'name': {'$regex': f'^{new_name}$', '$options': 'i'},
                '_id': {'$ne': cat_oid}
            })
            if existing:
                return jsonify({'success': False, 'error': 'Another category with this name already exists'}), 400
            update_fields['name'] = new_name

        if 'icon' in data:
            update_fields['icon'] = str(data['icon']).strip() or '❓'

        categories_coll.update_one({'_id': cat_oid}, {'$set': update_fields})
        updated_cat = categories_coll.find_one({'_id': cat_oid})
        q_count = questions_coll.count_documents({'categoryId': cat_oid})

        return jsonify({'success': True, 'category': serialize_category(updated_cat, q_count)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/categories/<category_id>', methods=['DELETE'])
def delete_category(category_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        cat_oid = parse_object_id(category_id)
        if not cat_oid:
            return jsonify({'success': False, 'error': 'Invalid category ID'}), 400

        categories_coll = db['trivia_categories']
        questions_coll = db['trivia_questions']

        cat = categories_coll.find_one({'_id': cat_oid})
        if not cat:
            return jsonify({'success': False, 'error': 'Category not found'}), 404

        questions_coll.delete_many({'categoryId': cat_oid})
        categories_coll.delete_one({'_id': cat_oid})

        return jsonify({'success': True, 'message': 'Category and associated questions deleted successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Question Management APIs ──────────────────────────────────────
@trivia_challenge_bp.route('/api/trivia/questions', methods=['GET'])
def get_questions():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        ensure_trivia_defaults(db)
        questions_coll = db['trivia_questions']
        query = {}

        cat_id = request.args.get('category_id') or request.args.get('categoryId')
        if cat_id:
            c_oid = parse_object_id(cat_id)
            if c_oid:
                query['categoryId'] = c_oid
            else:
                return jsonify({'success': False, 'error': 'Invalid category ID'}), 400

        difficulty = request.args.get('difficulty')
        if difficulty is not None:
            query['difficulty'] = int(difficulty)

        questions = list(questions_coll.find(query).sort([('categoryId', 1), ('difficulty', 1)]))
        result = [serialize_question(q) for q in questions]

        return jsonify({
            'success': True,
            'questions': result,
            'numberOfQuestions': len(result)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions', methods=['POST'])
def create_question():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        data = request.get_json() or {}
        cat_id = data.get('categoryId')
        question_text = str(data.get('question', '')).strip()
        difficulty = int(data.get('difficulty', 1))
        choices = data.get('choices', [])
        answer = int(data.get('answer', 0))

        if not cat_id:
            return jsonify({'success': False, 'error': 'categoryId is required'}), 400
        cat_oid = parse_object_id(cat_id)
        if not cat_oid:
            return jsonify({'success': False, 'error': 'Invalid categoryId'}), 400

        categories_coll = db['trivia_categories']
        if not categories_coll.find_one({'_id': cat_oid}):
            return jsonify({'success': False, 'error': 'Category does not exist'}), 404

        if not question_text:
            return jsonify({'success': False, 'error': 'Question text is required'}), 400

        if not isinstance(choices, list) or len(choices) < 2:
            return jsonify({'success': False, 'error': 'Question must have at least 2 choices/options'}), 400

        cleaned_choices = [str(c).strip() for c in choices if str(c).strip()]
        if len(cleaned_choices) < 2:
            return jsonify({'success': False, 'error': 'Question must have at least 2 non-empty choices'}), 400

        if answer < 0 or answer >= len(cleaned_choices):
            return jsonify({'success': False, 'error': f'Answer index must be between 0 and {len(cleaned_choices) - 1}'}), 400

        now = datetime.now(timezone.utc)
        doc = {
            'categoryId': cat_oid,
            'question': question_text,
            'difficulty': max(1, min(5, difficulty)),
            'choices': cleaned_choices,
            'answer': answer,
            'createdAt': now,
            'updatedAt': now
        }
        res = db['trivia_questions'].insert_one(doc)
        doc['_id'] = res.inserted_id

        return jsonify({'success': True, 'question': serialize_question(doc)}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions/<question_id>', methods=['GET'])
def get_question(question_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        q = db['trivia_questions'].find_one({'_id': q_oid})
        if not q:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        return jsonify({'success': True, 'question': serialize_question(q)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions/<question_id>', methods=['PUT'])
def update_question(question_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        questions_coll = db['trivia_questions']
        q = questions_coll.find_one({'_id': q_oid})
        if not q:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        data = request.get_json() or {}
        update_fields = {'updatedAt': datetime.now(timezone.utc)}

        if 'question' in data:
            qt = str(data['question']).strip()
            if not qt:
                return jsonify({'success': False, 'error': 'Question text cannot be empty'}), 400
            update_fields['question'] = qt

        if 'difficulty' in data:
            update_fields['difficulty'] = max(1, min(5, int(data['difficulty'])))

        if 'categoryId' in data:
            c_oid = parse_object_id(data['categoryId'])
            if not c_oid or not db['trivia_categories'].find_one({'_id': c_oid}):
                return jsonify({'success': False, 'error': 'Invalid categoryId'}), 400
            update_fields['categoryId'] = c_oid

        choices = data.get('choices', q.get('choices', []))
        if 'choices' in data:
            if not isinstance(choices, list) or len(choices) < 2:
                return jsonify({'success': False, 'error': 'At least 2 choices required'}), 400
            cleaned_choices = [str(c).strip() for c in choices if str(c).strip()]
            if len(cleaned_choices) < 2:
                return jsonify({'success': False, 'error': 'At least 2 non-empty choices required'}), 400
            update_fields['choices'] = cleaned_choices
            choices = cleaned_choices

        if 'answer' in data or 'choices' in data:
            ans = int(data.get('answer', q.get('answer', 0)))
            if ans < 0 or ans >= len(choices):
                return jsonify({'success': False, 'error': f'Answer index must be between 0 and {len(choices) - 1}'}), 400
            update_fields['answer'] = ans

        questions_coll.update_one({'_id': q_oid}, {'$set': update_fields})
        updated_q = questions_coll.find_one({'_id': q_oid})

        return jsonify({'success': True, 'question': serialize_question(updated_q)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions/<question_id>', methods=['DELETE'])
def delete_question(question_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        questions_coll = db['trivia_questions']
        res = questions_coll.delete_one({'_id': q_oid})
        if res.deleted_count == 0:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        return jsonify({'success': True, 'message': 'Question deleted successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Option Management APIs ──────────────────────────────────────────
@trivia_challenge_bp.route('/api/trivia/questions/<question_id>/options', methods=['GET'])
def get_options(question_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        q = db['trivia_questions'].find_one({'_id': q_oid})
        if not q:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        choices = q.get('choices', [])
        answer_idx = q.get('answer', 0)
        options = [
            {'index': i, 'text': text, 'isCorrect': (i == answer_idx)}
            for i, text in enumerate(choices)
        ]

        return jsonify({
            'success': True,
            'questionId': str(q['_id']),
            'options': options,
            'answerIndex': answer_idx
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions/<question_id>/options', methods=['POST'])
def add_option(question_id):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        questions_coll = db['trivia_questions']
        q = questions_coll.find_one({'_id': q_oid})
        if not q:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        data = request.get_json() or {}
        option_text = str(data.get('option') or data.get('text') or '').strip()
        if not option_text:
            return jsonify({'success': False, 'error': 'Option text is required'}), 400

        is_correct = bool(data.get('isCorrect', False))
        choices = list(q.get('choices', []))
        choices.append(option_text)
        new_answer = len(choices) - 1 if is_correct else q.get('answer', 0)

        update_fields = {
            'choices': choices,
            'answer': new_answer,
            'updatedAt': datetime.now(timezone.utc)
        }
        questions_coll.update_one({'_id': q_oid}, {'$set': update_fields})
        updated_q = questions_coll.find_one({'_id': q_oid})

        return jsonify({'success': True, 'question': serialize_question(updated_q)}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions/<question_id>/options/<int:option_index>', methods=['PUT'])
def update_option(question_id, option_index):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        questions_coll = db['trivia_questions']
        q = questions_coll.find_one({'_id': q_oid})
        if not q:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        choices = list(q.get('choices', []))
        if option_index < 0 or option_index >= len(choices):
            return jsonify({'success': False, 'error': 'Option index out of range'}), 400

        data = request.get_json() or {}
        option_text = str(data.get('option') or data.get('text') or '').strip()
        if not option_text:
            return jsonify({'success': False, 'error': 'Option text cannot be empty'}), 400

        choices[option_index] = option_text
        new_answer = q.get('answer', 0)

        if data.get('isCorrect') is True:
            new_answer = option_index

        update_fields = {
            'choices': choices,
            'answer': new_answer,
            'updatedAt': datetime.now(timezone.utc)
        }
        questions_coll.update_one({'_id': q_oid}, {'$set': update_fields})
        updated_q = questions_coll.find_one({'_id': q_oid})

        return jsonify({'success': True, 'question': serialize_question(updated_q)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@trivia_challenge_bp.route('/api/trivia/questions/<question_id>/options/<int:option_index>', methods=['DELETE'])
def delete_option(question_id, option_index):
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503
    try:
        q_oid = parse_object_id(question_id)
        if not q_oid:
            return jsonify({'success': False, 'error': 'Invalid question ID'}), 400

        questions_coll = db['trivia_questions']
        q = questions_coll.find_one({'_id': q_oid})
        if not q:
            return jsonify({'success': False, 'error': 'Question not found'}), 404

        choices = list(q.get('choices', []))
        if len(choices) <= 2:
            return jsonify({'success': False, 'error': 'Question must retain at least 2 choices'}), 400

        if option_index < 0 or option_index >= len(choices):
            return jsonify({'success': False, 'error': 'Option index out of range'}), 400

        current_answer = q.get('answer', 0)
        choices.pop(option_index)

        if current_answer == option_index:
            new_answer = 0
        elif current_answer > option_index:
            new_answer = current_answer - 1
        else:
            new_answer = current_answer

        update_fields = {
            'choices': choices,
            'answer': new_answer,
            'updatedAt': datetime.now(timezone.utc)
        }
        questions_coll.update_one({'_id': q_oid}, {'$set': update_fields})
        updated_q = questions_coll.find_one({'_id': q_oid})

        return jsonify({'success': True, 'question': serialize_question(updated_q)}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ── In-Game Trivia Answer Submission API ────────────────────────────
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

        time_taken = float(data.get('timeTaken', 0.0))
        total_time_taken = float(data.get('totalTimeTaken', 0.0))

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

        player_doc = players_collection.find_one({'_id': ObjectId(player_id)})
        prev_correct = 0
        prev_total_time = 0.0
        if player_doc:
            tc = player_doc.get('triviaChallenge') or {}
            prev_correct = tc.get('correctAnswers', 0)
            prev_total_time = float(tc.get('totalTimeTaken', 0.0))

        new_correct = prev_correct + (1 if is_correct else 0)
        new_total_time = total_time_taken if total_time_taken > 0 else (prev_total_time + time_taken)

        update_fields = {
            'score': max(0, total_score),
            'solved': is_completed,
            'triviaChallenge.score': max(0, total_score),
            'triviaChallenge.completed': is_completed,
            'triviaChallenge.currentRound': current_round,
            'triviaChallenge.questionsAnswered': total_questions,
            'triviaChallenge.correctAnswers': new_correct,
            'triviaChallenge.totalTimeTaken': round(new_total_time, 2),
        }

        if is_completed:
            update_fields['triviaChallenge.solvedAt'] = datetime.now(timezone.utc)

        players_collection.update_one(
            {'_id': ObjectId(player_id), 'roomId': room_oid},
            {'$set': update_fields}
        )

        game_states.update_one({'roomId': room_oid}, {'$inc': {'version': 1}})

        return jsonify({
            'success': True,
            'score': total_score,
            'completed': is_completed,
            'totalTimeTaken': round(new_total_time, 2),
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Plain Text Question Importer API ────────────────────────────────
import re

def parse_plain_text_questions(raw_text, default_difficulty=1):
    """
    Parses plain text containing questions in the format:
    1. Question text
    A. Choice 1
    B. Choice 2
    C. Choice 3
    D. Choice 4
    Answer: B
    """
    if not raw_text or not isinstance(raw_text, str):
        return []

    text = raw_text.replace('\r\n', '\n').replace('\r', '\n').strip()
    if not text:
        return []

    lines = [line.strip() for line in text.split('\n')]
    blocks = []
    current_block = []

    question_start_re = re.compile(r'^(?:\d+[\.\)]|Q\d+[:\.]?)\s*', re.IGNORECASE)

    for line in lines:
        if not line:
            if current_block:
                blocks.append(current_block)
                current_block = []
            continue

        has_answer = any(re.match(r'^(?:Answer|Ans|Correct)[:\s]', l, re.IGNORECASE) for l in current_block)
        if question_start_re.match(line) and current_block and (has_answer or len(current_block) >= 3):
            blocks.append(current_block)
            current_block = []

        current_block.append(line)

    if current_block:
        blocks.append(current_block)

    parsed_questions = []

    for block in blocks:
        q_text = ""
        choices = []
        answer_str = ""

        choice_re = re.compile(r'^(?:[A-Da-d0-9][\.\)]|[A-Da-d0-9]\s*[-–—])\s*(.+)')
        answer_re = re.compile(r'^(?:Answer|Ans|Correct)[:\s]*\s*(.+)', re.IGNORECASE)

        for line in block:
            ans_match = answer_re.match(line)
            if ans_match:
                answer_str = ans_match.group(1).strip()
                continue

            choice_match = choice_re.match(line)
            if choice_match:
                choices.append(choice_match.group(1).strip())
                continue

            if not choices and not answer_str:
                clean_line = question_start_re.sub('', line).strip()
                if clean_line:
                    if q_text:
                        q_text += " " + clean_line
                    else:
                        q_text = clean_line

        if not q_text or len(choices) < 2:
            continue

        answer_idx = 0
        if answer_str:
            upper_ans = answer_str.strip().upper()
            if len(upper_ans) == 1 and 'A' <= upper_ans <= 'Z':
                answer_idx = ord(upper_ans) - ord('A')
            elif upper_ans.isdigit():
                idx = int(upper_ans)
                answer_idx = idx - 1 if idx >= 1 else 0
            else:
                found = False
                for idx, c in enumerate(choices):
                    if c.lower() == answer_str.lower():
                        answer_idx = idx
                        found = True
                        break
                if not found:
                    answer_idx = 0

        answer_idx = max(0, min(len(choices) - 1, answer_idx))

        parsed_questions.append({
            'question': q_text,
            'difficulty': max(1, min(5, int(default_difficulty))),
            'choices': choices,
            'answer': answer_idx
        })

    return parsed_questions


@trivia_challenge_bp.route('/api/trivia/import-text', methods=['POST'])
def import_text():
    db = get_database()
    if db is None:
        return jsonify({'success': False, 'error': 'Database not configured'}), 503

    try:
        data = request.get_json() or {}
        cat_id = data.get('categoryId') or data.get('category_id')
        cat_name = str(data.get('categoryName') or data.get('category_name') or '').strip()
        raw_text = data.get('text', '')
        difficulty = int(data.get('difficulty', 1))

        if not raw_text:
            return jsonify({'success': False, 'error': 'Question text content is required'}), 400

        categories_coll = db['trivia_categories']
        questions_coll = db['trivia_questions']

        target_cat = None
        if cat_id:
            c_oid = parse_object_id(cat_id)
            if c_oid:
                target_cat = categories_coll.find_one({'_id': c_oid})

        if not target_cat and cat_name:
            target_cat = categories_coll.find_one({'name': {'$regex': f'^{cat_name}$', '$options': 'i'}})
            if not target_cat:
                now = datetime.now(timezone.utc)
                doc = {'name': cat_name, 'icon': '❓', 'createdAt': now, 'updatedAt': now}
                res = categories_coll.insert_one(doc)
                doc['_id'] = res.inserted_id
                target_cat = doc

        if not target_cat:
            first_cat = categories_coll.find_one()
            if first_cat:
                target_cat = first_cat
            else:
                return jsonify({'success': False, 'error': 'No valid category found or specified'}), 400

        parsed = parse_plain_text_questions(raw_text, default_difficulty=difficulty)
        if not parsed:
            return jsonify({'success': False, 'error': 'Could not parse any valid questions from the text provided.'}), 400

        now = datetime.now(timezone.utc)
        inserted_questions = []

        for q in parsed:
            q_doc = {
                'categoryId': target_cat['_id'],
                'question': q['question'],
                'difficulty': q['difficulty'],
                'choices': q['choices'],
                'answer': q['answer'],
                'createdAt': now,
                'updatedAt': now
            }
            res = questions_coll.insert_one(q_doc)
            q_doc['_id'] = res.inserted_id
            inserted_questions.append(serialize_question(q_doc))

        return jsonify({
            'success': True,
            'count': len(inserted_questions),
            'categoryId': str(target_cat['_id']),
            'categoryName': target_cat.get('name', ''),
            'questions': inserted_questions
        }), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

