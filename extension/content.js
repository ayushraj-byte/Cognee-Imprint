// Imprint content script — claude.ai · chatgpt.com · gemini.google.com
// Intercepts messages, injects memories, extracts new facts, detects contradictions

(async function () {
  const USER_ID_KEY    = "cme_user_id";
  const PRIVACY_KEY    = "cme_privacy_mode";
  let userId           = await getUserId();
  let pendingContradiction = null;
  let conversationHistory  = [];
  let isProcessing         = false;

  // ── Detect platform ────────────────────────────────────
  const HOST = window.location.hostname;
  const PLATFORM =
    HOST.includes("claude.ai")  ? "claude"   :
    HOST.includes("chatgpt.com")? "chatgpt"  :
    HOST.includes("gemini")     ? "gemini"   : "unknown";

  // ── User ID ────────────────────────────────────────────
  async function getUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get([USER_ID_KEY], (result) => {
        if (result[USER_ID_KEY]) { resolve(result[USER_ID_KEY]); return; }
        const id = crypto.randomUUID();
        chrome.storage.local.set({ [USER_ID_KEY]: id }, () => resolve(id));
      });
    });
  }

  async function isPrivacyMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get([PRIVACY_KEY], r => resolve(!!r[PRIVACY_KEY]));
    });
  }

  // ── Fetch interceptor ──────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = async function (url, options) {
    const urlStr = typeof url === "string" ? url : url instanceof Request ? url.url : String(url);

    // ── Claude.ai intercept ──
    if (PLATFORM === "claude" &&
        urlStr.includes("/api/organizations") &&
        urlStr.includes("/chat_conversations") &&
        options?.method === "POST") {
      try {
        if (!(await isPrivacyMode())) {
          const body = JSON.parse(options.body);
          const userMessage = body.prompt || body.text || "";
          if (userMessage) {
            const memoryResult = await chrome.runtime.sendMessage({ type: "GET_MEMORIES", payload: { userId, query: userMessage.slice(0, 200) } });
            const memories = memoryResult?.memories || [];
            const contradictionResult = await chrome.runtime.sendMessage({ type: "CHECK_CONTRADICTION", payload: { userId, message: userMessage, memories } });
            if (contradictionResult?.hasContradiction) {
              pendingContradiction = contradictionResult.contradictions;
              showContradictionBadge(contradictionResult.contradictions, "claude");
            }
            if (memories.length > 0 && body.system_prompt !== undefined) {
              body.system_prompt = (body.system_prompt || "") + "\n\n" + formatMemoryContext(memories);
              options.body = JSON.stringify(body);
            }
            conversationHistory.push({ role: "user", content: userMessage });
          }
        }
      } catch (err) { console.warn("[Imprint] Claude intercept error:", err); }
    }

    // ── ChatGPT intercept ──
    if (PLATFORM === "chatgpt" &&
        urlStr.includes("/backend-api/conversation") &&
        options?.method === "POST") {
      try {
        if (!(await isPrivacyMode())) {
          const body = JSON.parse(options.body);
          const userMsg = body.messages?.findLast?.((m) => m.role === "user")?.content;
          const text = typeof userMsg === "string" ? userMsg : userMsg?.[0]?.text || "";
          if (text) {
            const memoryResult = await chrome.runtime.sendMessage({ type: "GET_MEMORIES", payload: { userId, query: text.slice(0, 200) } });
            const memories = memoryResult?.memories || [];
            if (memories.length > 0) {
              const injection = formatMemoryContext(memories);
              // Inject as the first system message if possible
              if (!body.system_prompt) {
                body.system_prompt = injection;
              } else {
                body.system_prompt = injection + "\n\n" + body.system_prompt;
              }
              options = { ...options, body: JSON.stringify(body) };
            }
            conversationHistory.push({ role: "user", content: text });
            showPlatformBadge("chatgpt", memories.length);
          }
        }
      } catch (err) { console.warn("[Imprint] ChatGPT intercept error:", err); }
    }

    // ── Gemini intercept ──
    if (PLATFORM === "gemini" &&
        (urlStr.includes("generativelanguage.googleapis.com") || urlStr.includes("bard.google.com")) &&
        options?.method === "POST") {
      try {
        if (!(await isPrivacyMode())) {
          const body = JSON.parse(options.body);
          const parts = body.contents?.findLast?.((c) => c.role === "user")?.parts;
          const text = parts?.[0]?.text || "";
          if (text) {
            const memoryResult = await chrome.runtime.sendMessage({ type: "GET_MEMORIES", payload: { userId, query: text.slice(0, 200) } });
            const memories = memoryResult?.memories || [];
            if (memories.length > 0) {
              const injection = { role: "user", parts: [{ text: "[IMPRINT CONTEXT]\n" + formatMemoryContext(memories) + "\n[END IMPRINT]\n\nNow answering the user:" }] };
              if (body.contents) body.contents = [injection, ...body.contents];
              options = { ...options, body: JSON.stringify(body) };
            }
            conversationHistory.push({ role: "user", content: text });
            showPlatformBadge("gemini", memories.length);
          }
        }
      } catch (err) { console.warn("[Imprint] Gemini intercept error:", err); }
    }

    const response = await originalFetch.call(this, url, options);

    // After-response extraction (Claude only — others have different streaming)
    if (PLATFORM === "claude" &&
        urlStr.includes("/chat_conversations") &&
        !isProcessing) {
      extractMemoriesAfterDelay();
    }

    return response;
  };

  function formatMemoryContext(memories) {
    const grouped = {};
    for (const m of memories) {
      if (!grouped[m.topic]) grouped[m.topic] = [];
      grouped[m.topic].push(m.content);
    }
    let context = "=== What you know about this user (from past conversations) ===\n";
    for (const [topic, items] of Object.entries(grouped)) {
      context += `\n[${topic.toUpperCase()}]\n`;
      context += items.map((i) => `• ${i}`).join("\n");
    }
    context += "\n\nUse this knowledge naturally without explicitly referencing memory.";
    return context;
  }

  // ── Platform badge (non-claude) ────────────────────────
  function showPlatformBadge(platform, count) {
    document.getElementById("cme-platform-badge")?.remove();
    if (!count) return;
    const colors = { chatgpt: "#10a37f", gemini: "#4285f4" };
    const names  = { chatgpt: "ChatGPT", gemini: "Gemini" };
    const badge  = document.createElement("div");
    badge.id = "cme-platform-badge";
    badge.style.cssText = `position:fixed;bottom:20px;right:20px;background:${colors[platform] || "#555"};color:white;border-radius:10px;padding:9px 14px;font-family:-apple-system,sans-serif;font-size:12px;font-weight:500;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:cme-slide-in 0.3s ease;`;
    badge.textContent = `🧠 Imprint injected ${count} memories into ${names[platform] || platform}`;
    ensureAnimStyles();
    document.body.appendChild(badge);
    setTimeout(() => badge?.remove(), 4000);
  }

  // ── Memory extraction after Claude response ────────────
  function extractMemoriesAfterDelay() {
    setTimeout(async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        if (await isPrivacyMode()) { isProcessing = false; return; }
        const assistantMessages = document.querySelectorAll('[data-testid="assistant-message"]');
        if (!assistantMessages.length) { isProcessing = false; return; }
        const lastAssistant = assistantMessages[assistantMessages.length - 1].textContent?.trim();
        if (lastAssistant && conversationHistory.length > 0) {
          const lastUserMsg = conversationHistory[conversationHistory.length - 1];
          conversationHistory.push({ role: "assistant", content: lastAssistant.slice(0, 2000) });
          const result = await chrome.runtime.sendMessage({
            type: "SAVE_MEMORIES",
            payload: { userId, messages: [lastUserMsg, conversationHistory[conversationHistory.length - 1]], source: PLATFORM },
          });
          if (result?.contradictions?.length > 0) {
            pendingContradiction = result.contradictions;
            showContradictionBadge(result.contradictions, PLATFORM);
          }
          updateMemoryCount();
        }
      } catch (err) { console.warn("[Imprint] Extraction error:", err); }
      finally { isProcessing = false; }
    }, 3000);
  }

  // ── Contradiction badge ────────────────────────────────
  function showContradictionBadge(contradictions, platform) {
    document.getElementById("cme-contradiction-badge")?.remove();
    const badge = document.createElement("div");
    badge.id = "cme-contradiction-badge";
    badge.style.cssText = `position:fixed;bottom:80px;right:20px;background:#ef4444;color:white;border-radius:12px;padding:12px 16px;font-family:-apple-system,sans-serif;font-size:13px;font-weight:500;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:99999;cursor:pointer;animation:cme-slide-in 0.3s ease;`;
    const first = contradictions[0];
    badge.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:16px;">⚠️</span>
        <strong>Contradiction detected</strong>
        <span id="cme-close" style="margin-left:auto;cursor:pointer;opacity:0.7;">✕</span>
      </div>
      <div style="font-size:12px;opacity:0.9;">${first.explanation || "You said something different before."}</div>
      <div style="margin-top:8px;font-size:11px;opacity:0.7;">Was: "${String(first.existingMemoryContent || "").slice(0, 60)}…"</div>
      <div style="margin-top:6px;font-size:10px;opacity:0.5;">Resolve in Dashboard → Conflicts</div>
    `;
    ensureAnimStyles();
    badge.addEventListener("click", () => badge.remove());
    badge.querySelector("#cme-close")?.addEventListener("click", () => badge.remove());
    document.body.appendChild(badge);
    setTimeout(() => badge?.remove(), 10000);
  }

  function ensureAnimStyles() {
    if (document.getElementById("cme-styles")) return;
    const style = document.createElement("style");
    style.id = "cme-styles";
    style.textContent = `@keyframes cme-slide-in{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;
    document.head.appendChild(style);
  }

  // ── Memory count badge ─────────────────────────────────
  async function updateMemoryCount() {
    const result = await chrome.runtime.sendMessage({ type: "GET_MEMORIES", payload: { userId } });
    const count = result?.memories?.length || 0;
    chrome.runtime.sendMessage({ type: "UPDATE_BADGE", payload: { count } });
  }

  // ── Message listener ───────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_USER_ID") sendResponse({ userId, platform: PLATFORM });
    if (message.type === "GET_PENDING_CONTRADICTION") {
      sendResponse({ contradictions: pendingContradiction, platform: PLATFORM });
      pendingContradiction = null;
    }
    return true;
  });

  // ── Auto-save on tab/window change ────────────────────
  let lastVisibilitySave = 0;

  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) return;
    if (conversationHistory.length === 0 || isProcessing) return;
    const now = Date.now();
    if (now - lastVisibilitySave < 2 * 60 * 1000) return; // max once per 2 min
    lastVisibilitySave = now;
    extractMemoriesAfterDelay();
  });

  window.addEventListener("pagehide", async () => {
    if (conversationHistory.length === 0 || isProcessing) return;
    const now = Date.now();
    if (now - lastVisibilitySave < 2 * 60 * 1000) return;
    lastVisibilitySave = now;
    extractMemoriesAfterDelay();
  });

  console.log(`[Imprint] Active on ${PLATFORM} — userId:`, userId);
})();
