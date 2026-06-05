const API_BASE = "https://claude-memory-enhancer.vercel.app";

let currentUserId = null;
let activeTab = "memories";

// ── Init ──────────────────────────────────────────────

async function init() {
  // Get userId from content script
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const isOnClaude = tabs[0]?.url?.includes("claude.ai");

  if (isOnClaude) {
    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        type: "GET_USER_ID",
      });
      currentUserId = response?.userId;
    } catch {
      currentUserId = await getStoredUserId();
    }
  } else {
    currentUserId = await getStoredUserId();
    // Show inactive status
    document.querySelector(".status-dot").style.background = "#f59e0b";
    document.querySelector(".status-dot").style.boxShadow = "0 0 6px #f59e0b";
    document.querySelector(".status-text").textContent = "Open Claude.ai to activate";
  }

  if (currentUserId) {
    document.getElementById("user-id-display").textContent = currentUserId;
    await loadMemories();
    await loadUserInfo();
    await checkPendingContradictions(tabs[0], isOnClaude);
  }
}

async function getStoredUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["cme_user_id"], (r) => resolve(r.cme_user_id || null));
  });
}

// ── Load memories ─────────────────────────────────────

async function loadMemories() {
  try {
    const res = await fetch(
      `${API_BASE}/api/memories?userId=${currentUserId}`
    );
    const data = await res.json();
    const memories = data.memories || [];

    document.getElementById("memory-count").textContent =
      `${memories.length} memories`;

    renderMemories(memories);
  } catch {
    document.getElementById("memory-count").textContent = "Offline";
  }
}

function renderMemories(memories) {
  const list = document.getElementById("memories-list");

  if (!memories.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">💭</div>
        <div>No memories yet.</div>
        <div style="margin-top:4px;">Start chatting on Claude.ai!</div>
      </div>`;
    return;
  }

  list.innerHTML = memories
    .slice(0, 20)
    .map((m) => {
      const ago = timeAgo(m.createdAt);
      const pinIcon = m.pinned ? "📌 " : "";
      return `
      <div class="memory-item">
        <span class="memory-topic">${m.topic}</span>
        <div class="memory-content">${pinIcon}${escapeHtml(m.content)}</div>
        <div class="memory-time">${ago}${m.contradicts?.length ? " • ⚠️ flagged" : ""}</div>
      </div>`;
    })
    .join("");
}

// ── Load user info ────────────────────────────────────

async function loadUserInfo() {
  try {
    const res = await fetch(`${API_BASE}/api/user?userId=${currentUserId}`);
    const user = await res.json();

    const badge = document.getElementById("tier-badge");
    if (user.tier === "byok") {
      badge.textContent = "BYOK — Unlimited";
      badge.className = "tier-badge tier-byok";
    } else {
      badge.textContent = `Free (${user.messageCount}/20 today)`;
      badge.className = "tier-badge tier-free";
    }
  } catch {
    // ignore
  }
}

// ── Check contradiction alerts ────────────────────────

async function checkPendingContradictions(tab, isOnClaude) {
  if (!isOnClaude || !tab) return;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PENDING_CONTRADICTION",
    });
    if (response?.contradictions?.length) {
      showContradictionAlert(response.contradictions);
    }
  } catch {
    // content script may not be loaded yet
  }
}

function showContradictionAlert(contradictions) {
  const alert = document.getElementById("contradiction-alert");
  const body = document.getElementById("contradiction-body");

  const first = contradictions[0];
  body.textContent = first.explanation;
  alert.classList.add("visible");
}

// ── Save API key ──────────────────────────────────────

async function saveApiKey() {
  const input = document.getElementById("api-key-input");
  const key = input.value.trim();

  if (!key || !key.startsWith("sk-ant-")) {
    input.style.borderColor = "#ef4444";
    setTimeout(() => (input.style.borderColor = ""), 2000);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, apiKey: key }),
    });
    const data = await res.json();

    if (data.success) {
      input.value = "";
      input.placeholder = "Key saved!";
      await loadUserInfo();
    }
  } catch {
    input.style.borderColor = "#ef4444";
  }
}

// ── Tab switching ─────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) =>
    c.classList.remove("active")
  );

  event.currentTarget.classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");
}

// ── Update dashboard link with userId ─────────────────

function updateDashboardLink() {
  if (currentUserId) {
    document.getElementById("dashboard-link").href =
      `${API_BASE}/dashboard?userId=${currentUserId}`;
  }
}

// ── Utils ─────────────────────────────────────────────

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Make switchTab and saveApiKey available globally for onclick handlers
window.switchTab = switchTab;
window.saveApiKey = saveApiKey;

init().then(updateDashboardLink);
