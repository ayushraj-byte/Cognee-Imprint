// Content script — runs on claude.ai
// Intercepts messages, injects memories, extracts new facts, detects contradictions

(async function () {
  const USER_ID_KEY = "cme_user_id";
  let userId = await getUserId();
  let pendingContradiction = null;
  let conversationHistory = [];
  let isProcessing = false;

  // ── User ID ────────────────────────────────────────────

  async function getUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get([USER_ID_KEY], (result) => {
        if (result[USER_ID_KEY]) {
          resolve(result[USER_ID_KEY]);
        } else {
          const id = crypto.randomUUID();
          chrome.storage.local.set({ [USER_ID_KEY]: id }, () => resolve(id));
        }
      });
    });
  }

  // ── Fetch interceptor — inject memories into Claude.ai requests ──

  const originalFetch = window.fetch;
  window.fetch = async function (url, options) {
    // Intercept the Claude.ai conversation API call
    if (
      typeof url === "string" &&
      url.includes("claude.ai") &&
      url.includes("/api/organizations") &&
      url.includes("/chat_conversations") &&
      options?.method === "POST"
    ) {
      try {
        const body = JSON.parse(options.body);

        // Extract the user's current message
        const userMessage = body.prompt || body.text || "";
        if (userMessage) {
          // 1. Check contradiction BEFORE sending
          const contradictionResult = await chrome.runtime.sendMessage({
            type: "CHECK_CONTRADICTION",
            payload: { userId, message: userMessage },
          });

          if (contradictionResult?.hasContradiction) {
            pendingContradiction = contradictionResult.contradictions;
            showContradictionBadge(contradictionResult.contradictions);
          }

          // 2. Fetch relevant memories to inject
          const memoryResult = await chrome.runtime.sendMessage({
            type: "GET_MEMORIES",
            payload: { userId, query: userMessage.slice(0, 200) },
          });

          const memories = memoryResult?.memories || [];

          // 3. Inject memories into system prompt if present
          if (memories.length > 0 && body.system_prompt !== undefined) {
            const memoryContext = formatMemoryContext(memories);
            body.system_prompt = (body.system_prompt || "") + "\n\n" + memoryContext;
            options.body = JSON.stringify(body);
          }

          // Track user message for extraction after response
          conversationHistory.push({ role: "user", content: userMessage });
        }
      } catch (err) {
        console.warn("[Imprint] Intercept error:", err);
      }
    }

    const response = await originalFetch.call(this, url, options);

    // After response — extract memories from the completed exchange
    if (
      typeof url === "string" &&
      url.includes("claude.ai") &&
      url.includes("/chat_conversations") &&
      !isProcessing
    ) {
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

  // ── MutationObserver — capture Claude's response text ──

  function extractMemoriesAfterDelay() {
    // Wait for the response to finish streaming (3s debounce)
    setTimeout(async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        const assistantMessages = document.querySelectorAll(
          '[data-testid="assistant-message"]'
        );

        if (assistantMessages.length === 0) {
          isProcessing = false;
          return;
        }

        const lastAssistant =
          assistantMessages[assistantMessages.length - 1].textContent?.trim();

        if (lastAssistant && conversationHistory.length > 0) {
          const lastUserMsg = conversationHistory[conversationHistory.length - 1];
          conversationHistory.push({
            role: "assistant",
            content: lastAssistant.slice(0, 2000),
          });

          // Extract and save memories from the last exchange
          const result = await chrome.runtime.sendMessage({
            type: "SAVE_MEMORIES",
            payload: {
              userId,
              messages: [lastUserMsg, conversationHistory[conversationHistory.length - 1]],
              source: window.location.href,
            },
          });

          if (result?.contradictions?.length > 0) {
            pendingContradiction = result.contradictions;
            showContradictionBadge(result.contradictions);
          }

          // Update badge count
          updateMemoryCount();
        }
      } catch (err) {
        console.warn("[Imprint] Memory extraction error:", err);
      } finally {
        isProcessing = false;
      }
    }, 3000);
  }

  // ── Contradiction badge UI ────────────────────────────

  function showContradictionBadge(contradictions) {
    // Remove existing badge
    document.getElementById("cme-contradiction-badge")?.remove();

    const badge = document.createElement("div");
    badge.id = "cme-contradiction-badge";
    badge.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #ef4444;
      color: white;
      border-radius: 12px;
      padding: 12px 16px;
      font-family: -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 500;
      max-width: 320px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 99999;
      cursor: pointer;
      animation: cme-slide-in 0.3s ease;
    `;

    const first = contradictions[0];
    badge.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:16px;">⚠️</span>
        <strong>Contradiction detected</strong>
        <span id="cme-close" style="margin-left:auto;cursor:pointer;opacity:0.7;">✕</span>
      </div>
      <div style="font-size:12px;opacity:0.9;">${first.explanation}</div>
      <div style="margin-top:8px;font-size:11px;opacity:0.7;">
        Was: "${first.existingMemoryContent?.slice(0, 60)}..."
      </div>
    `;

    // Add animation keyframes
    if (!document.getElementById("cme-styles")) {
      const style = document.createElement("style");
      style.id = "cme-styles";
      style.textContent = `
        @keyframes cme-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    badge.addEventListener("click", () => badge.remove());
    badge.querySelector("#cme-close")?.addEventListener("click", () => badge.remove());

    document.body.appendChild(badge);

    // Auto-dismiss after 8s
    setTimeout(() => badge?.remove(), 8000);
  }

  // ── Memory count in extension icon ───────────────────

  async function updateMemoryCount() {
    const result = await chrome.runtime.sendMessage({
      type: "GET_MEMORIES",
      payload: { userId },
    });
    const count = result?.memories?.length || 0;
    chrome.runtime.sendMessage({ type: "UPDATE_BADGE", payload: { count } });
  }

  // ── Listen for messages from popup ───────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_USER_ID") {
      sendResponse({ userId });
    }
    if (message.type === "GET_PENDING_CONTRADICTION") {
      sendResponse({ contradictions: pendingContradiction });
      pendingContradiction = null;
    }
    return true;
  });

  console.log("[Imprint] Active — userId:", userId);
})();
