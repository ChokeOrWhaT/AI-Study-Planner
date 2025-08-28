import os
import uuid
import json
import random
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
# removed flask_socketio (group chat removed)
from werkzeug.utils import secure_filename
from sqlalchemy.exc import OperationalError
from mistral import ask_mistral
import google.generativeai as genai
from dotenv import load_dotenv


# =====================================================
# Environment setup
# =====================================================
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in .env")
genai.configure(api_key=GEMINI_KEY)

# =====================================================
# Flask app setup
# =====================================================
app = Flask(__name__)
app.secret_key = "your_secret_key"  # Change this to a secure value
bcrypt = Bcrypt(app)
# SocketIO/group-chat removed

# File upload config
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "txt"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

# Database config
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# =====================================================
# Models
# =====================================================
class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

class Note(db.Model):
    __tablename__ = "note"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    attachment = db.Column(db.String(255))  # uploaded file name

# Subject model for Subject Focus Wheel
class Subject(db.Model):
    __tablename__ = "subject"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

# Removed Group, GroupMember, Message models (group chat removed)

# =====================================================
# Helpers
# =====================================================
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def unique_filename(original_name: str) -> str:
    name = secure_filename(original_name)
    base, ext = os.path.splitext(name)
    return f"{uuid.uuid4().hex}{ext.lower()}"

def delete_file_if_exists(filename: str):
    if not filename:
        return
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    if os.path.exists(path):
        os.remove(path)

def ensure_attachment_column():
    try:
        result = db.session.execute(db.text("PRAGMA table_info(note);"))
        cols = [row[1] for row in result]
        if "attachment" not in cols:
            db.session.execute(db.text("ALTER TABLE note ADD COLUMN attachment VARCHAR(255);"))
            db.session.commit()
    except Exception:
        db.session.rollback()

def init_db():
    try:
        db.create_all()
        ensure_attachment_column()
    except Exception as e:
        print("Error creating/upgrading database:", e)

# =====================================================
# Routes: Home
# =====================================================
@app.route("/")
def index():
    return render_template("index.html")

# =====================================================
# Auth: Signup / Login / Logout
# =====================================================
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        if not username or not password:
            flash("Username and password cannot be empty!", "error")
            return redirect(url_for('signup'))
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        try:
            user = User(username=username, password=hashed_password)
            db.session.add(user)
            db.session.commit()
            flash('Account created! Please log in.', 'success')
            return redirect(url_for('login'))
        except db.exc.IntegrityError:
            db.session.rollback()
            flash('Username already taken.', 'error')
            return redirect(url_for('signup'))
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            session['username'] = username
            flash('Logged in successfully!', 'success')
            return redirect(url_for('dashboard'))
        flash('Invalid username or password.', 'error')
        return redirect(url_for('login'))
    return render_template('login.html')

# =====================================================
# Dashboard with Subject Focus Wheel
# =====================================================

# Simple TASK suggestions (you can expand)

TASKS = {
    "Math": [
        "Solve 5 practice problems",
        "Review formulas",
        "Work on past exam questions"
    ],
    "Science": [
        "Summarize today’s notes",
        "Draw a diagram",
        "Revise key definitions"
    ],
    "History": [
        "Memorize 5 dates",
        "Summarize a topic",
        "Write a timeline"
    ],
    "English": [
        "Read a chapter",
        "Write a short essay",
        "Revise vocabulary"
    ],
    "default": [
        "Do a short review",
        "Practice active recall",
        "Summarize in your own words"
    ]
}


# Dashboard
@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        flash('Please log in.', 'error')
        return redirect(url_for('login'))
    user = User.query.filter_by(username=session['username']).first()
    if not user:
        session.pop('username', None)
        flash('User not found.', 'error')
        return redirect(url_for('login'))
    
    # Get user's subjects (if any)
    try:
        subjects = Subject.query.filter_by(user_id=user.id).all()
    except Exception:
        subjects = []
    return render_template('dashboard.html', username=session['username'], subjects=subjects)

# Add Subject
@app.route('/add_subject', methods=['POST'])
def add_subject():
    if 'username' not in session:
        flash('Please log in.', 'error')
        return redirect(url_for('login'))
    user = User.query.filter_by(username=session['username']).first()
    if not user:
        session.pop('username', None)
        flash('User not found.', 'error')
        return redirect(url_for('login'))
    
    subject_name = request.form.get('subject_name', '').strip()
    if not subject_name:
        flash('Subject name cannot be empty.', 'error')
        return redirect(url_for('dashboard'))
    
    if Subject.query.filter_by(user_id=user.id, name=subject_name).first():
        flash('Subject already exists.', 'error')
        return redirect(url_for('dashboard'))
    
    subject = Subject(name=subject_name, user_id=user.id)
    db.session.add(subject)
    db.session.commit()
    # Reset recent subjects when a new subject is added
    session.pop('recent_subjects', None)
    flash('Subject added!', 'success')
    return redirect(url_for('dashboard'))

# Spin route for Subject Focus Wheel
@app.route('/spin', methods=['GET', 'POST'])
def spin():
    if 'username' not in session:
        return jsonify({'error': 'Please log in.'}), 401
    user = User.query.filter_by(username=session['username']).first()
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    
    subjects = Subject.query.filter_by(user_id=user.id).all()
    subject_names = [s.name for s in subjects] or ["Math", "Science", "History", "English"]  # Fallback if no subjects
    
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        if data.get('reset'):
            session.pop('recent_subjects', None)
            return jsonify({'message': 'Subject selection reset'})
    
    # Get recently used subjects
    recent_subjects = session.get('recent_subjects', [])
    
    # Filter out the last used subject (if any) to avoid immediate repetition
    available_subjects = [s for s in subject_names if s not in recent_subjects[-1:]]
    if not available_subjects:
        # If all subjects have been used recently, reset the recent list
        available_subjects = subject_names
        recent_subjects = []
    
    # Select a random subject from available ones
    selected_subject = random.choice(available_subjects)
    
    # Update recent subjects (keep only the last 2 to allow variety)
    recent_subjects.append(selected_subject)
    if len(recent_subjects) > 2:
        recent_subjects.pop(0)
    session['recent_subjects'] = recent_subjects
    
    selected_task = random.choice(TASKS.get(selected_subject, TASKS["default"]))
    return jsonify({'subject': selected_subject, 'task': selected_task})

# Logout (single definition)
@app.route('/logout')
def logout():
    session.pop('username', None)
    session.pop('recent_subjects', None)
    flash('Logged out.', 'success')
    return redirect(url_for('login'))

# =====================================================
# Notes System
# =====================================================
@app.route('/notes')
def notes_index():
    if 'username' not in session:
        flash('Please log in.', 'error')
        return redirect(url_for('login'))
    try:
        notes = Note.query.order_by(Note.id.desc()).all()
    except OperationalError:
        init_db()
        notes = []
    return render_template('notes.html', notes=notes)

@app.route('/add', methods=['POST'])
def add_note():
    if 'username' not in session:
        flash('Please log in.', 'error')
        return redirect(url_for('login'))
    title = request.form.get('title', '').strip()
    content = request.form.get('content', '').strip()
    if not title or not content:
        flash("Title and content cannot be empty!", "error")
        return redirect(url_for('notes_index'))
    file = request.files.get('attachment')
    filename = None
    if file and file.filename:
        if not allowed_file(file.filename):
            flash("Unsupported file type.", "error")
            return redirect(url_for('notes_index'))
        filename = unique_filename(file.filename)
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
    db.session.add(Note(title=title, content=content, attachment=filename))
    db.session.commit()
    flash("Note added!", "success")
    return redirect(url_for('notes_index'))

@app.route('/edit/<int:id>', methods=['POST'])
def edit_note(id):
    if 'username' not in session:
        flash('Please log in.', 'error')
        return redirect(url_for('login'))
    note = Note.query.get_or_404(id)
    new_title = request.form.get('title', '').strip()
    new_content = request.form.get('content', '').strip()
    if not new_title or not new_content:
        flash("Title and content cannot be empty!", "error")
        return redirect(url_for('notes_index'))
    file = request.files.get('attachment')
    if file and file.filename:
        if not allowed_file(file.filename):
            flash("Unsupported file type.", "error")
            return redirect(url_for('notes_index'))
        if note.attachment:
            delete_file_if_exists(note.attachment)
        filename = unique_filename(file.filename)
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
        note.attachment = filename
    note.title = new_title
    note.content = new_content
    db.session.commit()
    flash("Note updated!", "success")
    return redirect(url_for('notes_index'))

@app.route('/delete/<int:id>')
def delete_note(id):
    if 'username' not in session:
        flash('Please log in.', 'error')
        return redirect(url_for('login'))
    note = Note.query.get_or_404(id)
    if note.attachment:
        delete_file_if_exists(note.attachment)
    db.session.delete(note)
    db.session.commit()
    flash("Note deleted!", "success")
    return redirect(url_for('notes_index'))

# =====================================================
# AI Chat (Mistral)
# =====================================================
@app.route("/chat_ai", methods=["POST"])
def chat_ai():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"reply": "Please type a message."}), 400
    try:
        reply = ask_mistral(user_message)
    except Exception as e:
        reply = f"Error: {str(e)}"
    return jsonify({"reply": reply}), 200

# =====================================================
# Gemini Quiz Generator
# =====================================================
@app.route("/quiz", methods=["POST"])
def generate_quiz():
    data = request.get_json() or {}
    topic = data.get("topic", "").strip()
    difficulty = data.get("difficulty", "auto").strip().lower()
    if not topic:
        return jsonify({"ok": False, "error": "Missing topic"}), 400
    prompt = f"""
    You are an assistant that generates educational multiple-choice quizzes.
    Produce exactly 5 questions on \"{topic}\".
    Each question should include:
      - \"question\": string
      - \"options\": array of 4 strings
      - \"answer\": index (0-3)
      - \"explanation\": short string
    Difficulty: {difficulty}
    Output STRICT JSON: an array of 5 objects. Do NOT output anything else.
    """
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        text = resp.text if hasattr(resp, "text") else str(resp)
        try:
            quiz = json.loads(text)
        except Exception:
            import re
            m = re.search(r"(\[.*\])", text, flags=re.S)
            if m:
                quiz = json.loads(m.group(1))
            else:
                return jsonify({"ok": False, "error": "Could not parse model output", "raw": text}), 500
        if not isinstance(quiz, list) or len(quiz) != 5:
            return jsonify({"ok": False, "error": "Unexpected structure", "raw": text}), 500
        return jsonify({"ok": True, "questions": quiz})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# =====================================================
# Run app
# =====================================================
if __name__ == '__main__':
    with app.app_context():
        init_db()
    # Run the Flask app normally (SocketIO removed)
    app.run(debug=True, host='0.0.0.0', port=5000)
