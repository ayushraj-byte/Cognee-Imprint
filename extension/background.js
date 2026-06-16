// Service worker — handles API calls from content script

const API_BASE = "https://imprint-ebon.vercel.app";
const USER_ID_KEY = "cme_user_id";

// ── Right-click context menu ───────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "imprint-save-selection",
    title: "🧠 Save to Imprint",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "imprint-save-selection") return;
  const text = info.selectionText?.trim();
  if (!text) return;

  const userId = await getStoredUserId();
  if (!userId) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Imprint",
      message: "Open the Imprint extension popup and sign in first.",
    });
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, content: text, topic: "general", source: "extension" }),
    });
    const data = await res.json();
    const preview = text.length > 72 ? text.slice(0, 72) + "…" : text;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: data.memory ? "Imprint — Saved ✓" : "Imprint — Failed",
      message: data.memory ? `"${preview}"` : "Could not save. Check your connection.",
    });
  } catch {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Imprint — Error",
      message: "Network error. Memory not saved.",
    });
  }
});

async function getStoredUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([USER_ID_KEY], (r) => resolve(r[USER_ID_KEY] || null));
  });
}

// ── Message handler ────────────────────────────────────────
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
      return checkContradiction(payload.userId, payload.message, payload.memories);

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

async function checkContradiction(userId, message, existingMemories) {
  // Local contradiction check — compare new message against existing memories
  // No API call needed; catches obvious flip-flops (e.g. "I use React" vs "I don't use React")
  if (!existingMemories || existingMemories.length === 0) {
    return { hasContradiction: false, contradictions: [] };
  }

  const msgLower = message.toLowerCase();
  const contradictions = [];

  for (const mem of existingMemories) {
    const memLower = (mem.content || "").toLowerCase();
    // Detect negation flips: memory says X, new message says "not X" or vice versa
    const keywords = memLower.split(/\s+/).filter(w => w.length > 4).slice(0, 6);
    const overlap = keywords.filter(k => msgLower.includes(k));
    if (overlap.length >= 2) {
      const memHasNot = /\b(not|don't|doesn't|never|no longer|stopped)\b/.test(memLower);
      const msgHasNot = /\b(not|don't|doesn't|never|no longer|stopped)\b/.test(msgLower);
      if (memHasNot !== msgHasNot) {
        contradictions.push({
          existingMemoryId: mem.memoryId,
          existingMemoryContent: mem.content,
          explanation: `Possible conflict with saved memory: "${mem.content}"`,
        });
      }
    }
  }

  return {
    hasContradiction: contradictions.length > 0,
    contradictions,
  };
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
