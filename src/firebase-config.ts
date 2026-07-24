// Firebase client-side config — PUBLIC by design, safe to commit
export const firebaseConfig = {
  apiKey: "AIzaSyBTIJMCFt7_RVeCo0SSWprCnaP0NdDaoIA",
  authDomain: "insta-reel-brain.firebaseapp.com",
  projectId: "insta-reel-brain",
  storageBucket: "insta-reel-brain.firebasestorage.app",
  messagingSenderId: "789381027002",
  appId: "1:789381027002:web:12d6433d96be6fe7f25e83",
  measurementId: "G-72TM6842NB",
}

// Gemini API key — injected at build time via GitHub Actions secrets
// For local dev, set GEMINI_API_KEY in a .env file (already gitignored)
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ""
