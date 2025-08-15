from flask import Flask, render_template, request, jsonify
import os
import json
from dotenv import load_dotenv

# Gemini SDK
import google.generativeai as genai

# Load .env
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in .env")

genai.configure(api_key=GEMINI_KEY)

app = Flask(__name__)

# Home page
@app.route("/")
def home():
    return render_template("index.html")

# Quiz endpoint: Gemini-generated questions
@app.route("/quiz", methods=["POST"])
def generate_quiz():
    data = request.get_json() or {}
    topic = data.get("topic", "").strip()
    difficulty = data.get("difficulty", "auto").strip().lower()

    if not topic:
        return jsonify({"ok": False, "error": "Missing topic"}), 400

    # Gemini prompt: strict JSON for 5 MCQs
    prompt = f"""
    You are an assistant that generates educational multiple-choice quizzes.
    Produce exactly 5 questions on "{topic}".
    Each question should include:
      - "question": string
      - "options": array of 4 strings
      - "answer": index (0-3)
      - "explanation": short string
    Difficulty: {difficulty}
    Output STRICT JSON: an array of 5 objects. Do NOT output anything else.
    """

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        text = resp.text if hasattr(resp, "text") else str(resp)

        # Parse JSON
        try:
            quiz = json.loads(text)
        except Exception:
            import re
            m = re.search(r"(\[.*\])", text, flags=re.S)
            if m:
                quiz = json.loads(m.group(1))
            else:
                return jsonify({"ok": False, "error": "Could not parse model output as JSON", "raw": text}), 500

        # Validate structure
        if not isinstance(quiz, list) or len(quiz) != 5:
            return jsonify({"ok": False, "error": "Model returned unexpected structure", "raw": text}), 500

        for i, q in enumerate(quiz):
            if not all(k in q for k in ("question","options","answer","explanation")):
                return jsonify({"ok": False, "error": f"Question {i} missing fields", "raw": text}), 500
            if not isinstance(q["options"], list) or len(q["options"]) < 4:
                return jsonify({"ok": False, "error": f"Question {i} must have 4 options", "raw": text}), 500

        return jsonify({"ok": True, "questions": quiz})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
