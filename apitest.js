import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env file");
  process.exit(1);
}

// Create a Gemini client
const genAI = new GoogleGenerativeAI(API_KEY);

async function runTest() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Hello Gemini! Can you say hi in a fun way?";

    const result = await model.generateContent(prompt);
    console.log("✅ Gemini API Response:", result.response.text());
  } catch (err) {
    console.error("❌ API Error:", err);
  }
}

runTest();
