// Imprint popup — privacy mode, multi-platform status, memories, API key

const API_BASE    = "https://imprint-ebon.vercel.app";
const PRIVACY_KEY = "cme_privacy_mode";
const API_KEY_KEY = "cme_api_key";
const USER_ID_KEY = "cme_user_id";

const PLATFORM_LABELS  = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini" };
const PLATFORM_CLASSES = { claude: "pill-claude", chatgpt: "pill-chatgpt", gemini: "pill-gemini" };

let currentUserId = null;

// ── Privacy mode ───────────────────────────────────────────

function applyPrivacyUI(isOn) {
  const toggle = document.getElementById("privacy-toggle");
  const banner = document.getElementById("privacy-banner");
  const dot    = document.getElementById("status-dot");
  if (toggle) toggle.checked = isOn;
  if (banner) banner.classList.toggle("visible", isOn);
  if (dot) {
    dot.style.background = isOn ? "#ef4444" : "#4eecd8";
    dot.style.boxShadow  = isOn ? "0 0 6px #ef4444" : "0 0 6px #4eecd8";
  }
}

function togglePrivacy() {
  chrome.storage.local.get([PRIVACY_KEY], (r) => {
    const next = !r[PRIVACY_KEY];
    chrome.storage.local.set({ [PRIVACY_KEY]: next }, () => applyPrivacyUI(next));
  });
}
window.togglePrivacy = togglePrivacy;

// ── Tab switching ──────────────────────────────────────────

function switchTab(name, event) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  event.currentTarget.classList.add("active");
  document.getElementById("tab-" + name).classList.add("active");
}
window.switchTab = switchTab;

// ── API key ────────────────────────────────────────────────

async function saveApiKey() {
  const input = document.getElementById("api-key-input");
  const key   = input?.value?.trim();
  if (!key || !key.startsWith("sk-ant-")) {
    if (input) input.style.borderColor = "#ef4444";
    setTimeout(() => { if (input) input.style.borderColor = ""; }, 2000);
    return;
  }
  try {
    const res  = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, apiKey: key }),
    });
    const data = await res.json();
    if (data.success) {
      input.value       = "";
      input.placeholder = "Key saved!";
      loadUserInfo();
    }
  } catch {
    chrome.storage.local.set({ [API_KEY_KEY]: key });
    const badge = document.getElementById("tier-badge");
    if (badge) { badge.textContent = "BYOK · Unlimited"; badge.className = "tier-badge tier-byok"; }
    if (input) { input.value = ""; input.placeholder = "Key saved locally!"; }
  }
}
window.saveApiKey = saveApiKey;

// ── Platform status bar ────────────────────────────────────

function updatePlatformStatus(platform) {
  const pill = document.getElementById("platform-pill");
  const text = document.getElementById("status-text");
  if (!platform || platform === "unknown") {
    if (pill) { pill.textContent = ""; pill.className = "platform-pill pill-inactive"; }
    if (text) text.textContent = "Open Claude, ChatGPT or Gemini";
    return;
  }
  const label = PLATFORM_LABELS[platform] || platform;
  if (pill) { pill.textContent = label; pill.className = `platform-pill ${PLATFORM_CLASSES[platform] || "pill-inactive"}`; }
  if (text) text.textContent = "Active on";
}

// ── Contradiction alert ────────────────────────────────────

function showContradictionAlert(contradictions) {
  const box  = document.getElementById("contradiction-alert");
  const body = document.getElementById("contradiction-body");
  if (!box || !body || !contradictions?.length) return;
  const c = contradictions[0];
  body.textContent = c.explanation || "You said something different in a prior session. Open Dashboard → Conflicts to resolve.";
  box.classList.add("visible");
}

// ── Memories ───────────────────────────────────────────────

const TOPIC_COLORS = {
  projects: "#4eecd8", work: "#4eecd8", feedback: "#f59e0b",
  user: "#a78bfa", reference: "#60a5fa", personal: "#f472b6",
};

function relativeTime(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function renderMemories(memories) {
  const list = document.getElementById("memories-list");
  if (!list) return;
  if (!memories?.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">💭</div>
        <div>No memories yet.</div>
        <div style="margin-top:4px;color:rgba(255,255,255,0.15)">Start chatting on Claude, ChatGPT, or Gemini!</div>
      </div>`;
    return;
  }
  list.innerHTML = memories.slice(0, 20).map(m => {
    const color      = TOPIC_COLORS[m.topic] || "#4eecd8";
    const source     = m._raw?.source || m.source || "";
    const sourceTag  = source ? `<span class="memory-source">· ${escHtml(source)}</span>` : "";
    const pinIcon    = m.pinned ? '<span style="font-size:9px;margin-left:4px;color:#f59e0b">📌</span>' : "";
    const flagged    = m.contradicts?.length ? ' <span style="color:#ef4444;font-size:9px">⚠</span>' : "";
    return `
      <div class="memory-item">
        <div>
          <span class="memory-topic" style="background:${color}18;color:${color}">${escHtml(m.topic || "general")}</span>${pinIcon}
        </div>
        <div class="memory-content">${escHtml(m.content)}${flagged}</div>
        <div class="memory-time">${relativeTime(m.createdAt)}${sourceTag}</div>
      </div>`;
  }).join("");
}

async function loadMemories() {
  const countEl = document.getElementById("memory-count");
  try {
    const res      = await fetch(`${API_BASE}/api/memories?userId=${encodeURIComponent(currentUserId)}`);
    const data     = await res.json();
    const memories = Array.isArray(data) ? data : (data.memories || []);
    if (countEl) countEl.textContent = `${memories.length} memor${memories.length === 1 ? "y" : "ies"}`;
    renderMemories(memories);
  } catch {
    if (countEl) countEl.textContent = "Offline";
    renderMemories([]);
  }
}

async function loadUserInfo() {
  try {
    const res  = await fetch(`${API_BASE}/api/user?userId=${encodeURIComponent(currentUserId)}`);
    const user = await res.json();
    const badge = document.getElementById("tier-badge");
    if (!badge) return;
    if (user.tier === "byok") {
      badge.textContent = "BYOK · Unlimited";
      badge.className   = "tier-badge tier-byok";
    } else {
      badge.textContent = `Free · ${user.messageCount ?? 0}/20 today`;
      badge.className   = "tier-badge tier-free";
    }
  } catch {
    // Fallback: check local storage for saved key
    chrome.storage.local.get([API_KEY_KEY], (r) => {
      if (r[API_KEY_KEY]) {
        const badge = document.getElementById("tier-badge");
        if (badge) { badge.textContent = "BYOK · Unlimited"; badge.className = "tier-badge tier-byok"; }
      }
    });
  }
}

// ── Get userId + platform from active tab content script ───

async function getTabContext() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) { resolve({ userId: null, platform: "unknown", contradictions: null }); return; }
      chrome.tabs.sendMessage(tab.id, { type: "GET_USER_ID" }, (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve({ userId: null, platform: "unknown", contradictions: null });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "GET_PENDING_CONTRADICTION" }, (cRes) => {
          if (chrome.runtime.lastError) {
            resolve({ userId: res.userId || null, platform: res.platform || "unknown", contradictions: null });
            return;
          }
          resolve({
            userId: res.userId || null,
            platform: res.platform || "unknown",
            contradictions: cRes?.contradictions || null,
          });
        });
      });
    });
  });
}

// ── Main init ──────────────────────────────────────────────

async function init() {
  // Load and apply privacy mode immediately
  chrome.storage.local.get([PRIVACY_KEY, USER_ID_KEY], async (stored) => {
    applyPrivacyUI(!!stored[PRIVACY_KEY]);

    // Try to get context from the active AI tab
    const { userId, platform, contradictions } = await getTabContext();
    currentUserId = userId || stored[USER_ID_KEY] || null;

    updatePlatformStatus(platform);
    if (contradictions?.length) showContradictionAlert(contradictions);

    // Show user ID
    const uidEl = document.getElementById("user-id-display");
    if (uidEl) uidEl.textContent = currentUserId || "Not detected — visit Claude, ChatGPT or Gemini first";

    // Update dashboard link
    const link = document.getElementById("dashboard-link");
    if (link && currentUserId) link.href = `${API_BASE}/dashboard?userId=${encodeURIComponent(currentUserId)}`;

    if (!currentUserId) {
      const countEl = document.getElementById("memory-count");
      if (countEl) countEl.textContent = "0 memories";
      renderMemories([]);
      return;
    }

    await Promise.all([loadMemories(), loadUserInfo()]);
  });
}

document.addEventListener("DOMContentLoaded", init);
