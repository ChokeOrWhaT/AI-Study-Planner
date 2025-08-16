import subprocess
import json

def ask_mistral(question):
    ollama_path = r"C:\Users\Nihar Gunaji Sawant\AppData\Local\Programs\Ollama\ollama.exe"

    process = subprocess.run(
        [ollama_path, "run", "mistral", question],
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    output = process.stdout.strip()

    # Try to parse as JSON if possible, otherwise return raw text
    try:
        parsed = json.loads(output)
        return parsed.get("response") or parsed.get("completion") or output
    except json.JSONDecodeError:
        return output

if __name__ == "__main__":
    print("Type 'exit' or 'quit' to stop.")
    while True:
        q = input("You: ")
        if q.lower() in ["exit", "quit"]:
            break
        reply = ask_mistral(q)
        print("Mistral:", reply)
