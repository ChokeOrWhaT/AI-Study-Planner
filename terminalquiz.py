# terminal_quiz.py
import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load API key from .env
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in .env")

genai.configure(api_key=GEMINI_KEY)

def generate_quiz(topic, difficulty="auto"):
    prompt = f"""
    You are a helpful assistant that generates educational multiple-choice quizzes.
    Produce exactly 3 MCQ questions about the topic: "{topic}".
    For each question return: question (string), options (array of 4 strings), answer (index 0-3), explanation (short string).
    Difficulty preference: {difficulty}.
    Output must be STRICT JSON: an array of 3 objects.
    Do NOT output any extra commentary or text.
    """
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content(prompt)
    text = resp.text if hasattr(resp, "text") else str(resp)
    
    # parse JSON safely
    try:
        quiz = json.loads(text)
    except Exception:
        import re
        m = re.search(r"(\[.*\])", text, flags=re.S)
        if m:
            quiz = json.loads(m.group(1))
        else:
            raise ValueError("Could not parse Gemini response as JSON:\n" + text)
    return quiz

def run_terminal_quiz():
    topic = input("Enter a topic for your quiz: ").strip()
    if not topic:
        print("Topic cannot be empty.")
        return
    questions = generate_quiz(topic)
    score = 0
    for i, q in enumerate(questions):
        print(f"\nQ{i+1}: {q['question']}")
        for idx, opt in enumerate(q['options']):
            print(f"{idx+1}. {opt}")
        ans = input("Your answer (1-4): ").strip()
        if ans.isdigit() and int(ans)-1 == q['answer']:
            print("Correct ✅")
            score += 1
        else:
            print(f"Incorrect ❌ | Correct: {q['options'][q['answer']]} | {q['explanation']}")
    print(f"\nQuiz finished! Your score: {score}/{len(questions)}")

if __name__ == "__main__":
    run_terminal_quiz()
