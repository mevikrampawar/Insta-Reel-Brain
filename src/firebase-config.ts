// Firebase config — safe to commit
export const firebaseConfig = {
  apiKey: "AIzaSyBTIJMCFt7_RVeCo0SSWprCnaP0NdDaoIA",
  authDomain: "insta-reel-brain.firebaseapp.com",
  projectId: "insta-reel-brain",
  storageBucket: "insta-reel-brain.firebasestorage.app",
  messagingSenderId: "789381027002",
  appId: "1:789381027002:web:12d6433d96be6fe7f25e83",
  measurementId: "G-72TM6842NB",
}

// Groq API key — free tier (30 RPM, no billing required)
// Get from: https://console.groq.com
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ""
