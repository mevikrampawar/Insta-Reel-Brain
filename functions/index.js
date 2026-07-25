const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const ALLOWED_ORIGINS = [
  "https://mevikrampawar.github.io",
  "http://localhost:5173",
];

function setCors(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

exports.apifyProxy = onRequest({ region: "us-central1" }, async (req, res) => {
  const origin = req.headers.origin || "";
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { apifyApiKey, endpoint, method = "POST", payload } = req.body;

  if (!apifyApiKey || !endpoint) {
    res.status(400).json({ error: "Missing apifyApiKey or endpoint" });
    return;
  }

  try {
    const fetchOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyApiKey.trim()}`,
      },
    };
    if (method !== "GET" && payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const apiRes = await fetch(
      `https://api.apify.com/v2/${endpoint}`,
      fetchOptions
    );

    const contentType = apiRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await apiRes.json();
      res.status(apiRes.status).json(data);
    } else {
      const text = await apiRes.text();
      res.status(apiRes.status).send(text);
    }
  } catch (err) {
    console.error("Apify proxy error:", err);
    res.status(502).json({ error: "Proxy request failed" });
  }
});
