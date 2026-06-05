// Service worker — handles API calls from content script

const API_BASE = "https://claude-memory-enhancer.vercel.app"; // update after deploy

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    console.error("Background error:", err);
    sendResponse({ error: err.message });
  });
  return true; // keep channel open for async response
});

async function handleMessage(message) {
  const { type, payload } = message;

  switch (type) {
    case "GET_MEMORIES":
      return fetchMemories(payload.userId, payload.query);

    case "SAVE_MEMORIES":
      return saveMemories(payload.userId, payload.messages, payload.source);

    case "CHECK_CONTRADICTION":
      return checkContradiction(payload.userId, payload.message);

    case "GET_USER":
      return getUser(payload.userId);

    case "SAVE_API_KEY":
      return saveApiKey(payload.userId, payload.apiKey);

    default:
      return { error: "Unknown message type" };
  }
}

async function fetchMemories(userId, query) {
  const url = query
    ? `${API_BASE}/api/memories?userId=${userId}&search=${encodeURIComponent(query)}`
    : `${API_BASE}/api/memories?userId=${userId}`;

  const res = await fetch(url);
  return res.json();
}

async function saveMemories(userId, messages, source) {
  const res = await fetch(`${API_BASE}/api/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, messages, source }),
  });
  return res.json();
}

async function checkContradiction(userId, message) {
  const res = await fetch(`${API_BASE}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, message }),
  });
  return res.json();
}

async function getUser(userId) {
  const res = await fetch(`${API_BASE}/api/user?userId=${userId}`);
  return res.json();
}

async function saveApiKey(userId, apiKey) {
  const res = await fetch(`${API_BASE}/api/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, apiKey }),
  });
  return res.json();
}
