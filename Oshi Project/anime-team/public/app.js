// ── State ──────────────────────────────────────────────
let token = localStorage.getItem("anime_token") || null;
let currentUser = JSON.parse(localStorage.getItem("anime_user") || "null");

// ── Init ───────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  if (token && currentUser) {
    showApp();
  } else {
    showAuth();
  }
});

// ── Auth helpers ───────────────────────────────────────
function showAuth() {
  document.getElementById("authPage").classList.remove("hidden");
  document.getElementById("appPage").classList.add("hidden");
}

function showApp() {
  document.getElementById("authPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");
  document.getElementById("navNickname").textContent = currentUser.nickname;
  showTab("feed");
}

function showLogin() {
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("signupForm").classList.add("hidden");
}

function showSignup() {
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("signupForm").classList.remove("hidden");
}

// ── API helper ─────────────────────────────────────────
async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

// ── Signup ─────────────────────────────────────────────
async function signup() {
  const nickname = document.getElementById("signupNickname").value.trim();
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value;

  const { ok, data } = await api("POST", "/auth/signup", { nickname, username, password });
  if (!ok) return showError("signupError", data.error);

  token = data.token;
  currentUser = { username: data.username, nickname: data.nickname };
  localStorage.setItem("anime_token", token);
  localStorage.setItem("anime_user", JSON.stringify(currentUser));
  showApp();
}

// ── Login ──────────────────────────────────────────────
async function login() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { ok, data } = await api("POST", "/auth/login", { username, password });
  if (!ok) return showError("loginError", data.error);

  token = data.token;
  currentUser = { username: data.username, nickname: data.nickname };
  localStorage.setItem("anime_token", token);
  localStorage.setItem("anime_user", JSON.stringify(currentUser));
  showApp();
}

// ── Logout ─────────────────────────────────────────────
function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem("anime_token");
  localStorage.removeItem("anime_user");
  showAuth();
  showLogin();
}

// ── Tab Navigation ─────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.add("hidden"));

  if (tab === "feed") {
    document.getElementById("feedTab").classList.remove("hidden");
    document.querySelectorAll(".nav-tab")[0].classList.add("active");
    loadPosts();
  } else {
    document.getElementById("watchlistTab").classList.remove("hidden");
    document.querySelectorAll(".nav-tab")[1].classList.add("active");
    loadWatchlist();
  }
}

// ── POSTS ──────────────────────────────────────────────
async function loadPosts() {
  const { ok, data } = await api("GET", "/posts");
  const container = document.getElementById("postsList");

  if (!ok || data.length === 0) {
    container.innerHTML = `<p class="empty-msg">No posts yet. Be the first to share! 🎌</p>`;
    return;
  }

  container.innerHTML = data.map((post) => renderPost(post)).join("");
}

function renderPost(post) {
  const isOwner = currentUser && currentUser.username === post.username;
  const time = new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const commentsHtml = (post.comments || []).map((c) => `
    <div class="comment-item">
      <div class="comment-author">${esc(c.author)}</div>
      <div class="comment-text">${esc(c.content)}</div>
    </div>
  `).join("");

  return `
    <div class="card" id="post-${post.id}">
      <div class="post-header">
        <div>
          <div class="post-author">${esc(post.author)}</div>
          <div class="post-meta">${time}</div>
        </div>
        ${isOwner ? `<button class="delete-btn" onclick="deletePost('${post.id}')">🗑 Delete</button>` : ""}
      </div>
      ${post.anime ? `<span class="post-anime-tag">📺 ${esc(post.anime)}</span>` : ""}
      <div class="post-title">${esc(post.title)}</div>
      <div class="post-content">${esc(post.content)}</div>
      <div class="comments-section">
        <div id="comments-${post.id}">${commentsHtml}</div>
        <div class="comment-form">
          <input class="field" type="text" id="commentInput-${post.id}" placeholder="Add a comment..." />
          <button class="btn btn-outline sm" onclick="addComment('${post.id}')">Reply</button>
        </div>
      </div>
    </div>
  `;
}

async function createPost() {
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const anime = document.getElementById("postAnime").value.trim();

  const { ok, data } = await api("POST", "/posts", { title, content, anime });
  if (!ok) return showError("postError", data.error);

  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postAnime").value = "";
  loadPosts();
}

async function deletePost(id) {
  if (!confirm("Delete this post?")) return;
  await api("DELETE", `/posts/${id}`);
  loadPosts();
}

async function addComment(postId) {
  const input = document.getElementById(`commentInput-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  const { ok, data } = await api("POST", `/posts/${postId}/comments`, { content });
  if (!ok) return alert(data.error);

  input.value = "";
  const container = document.getElementById(`comments-${postId}`);
  container.innerHTML += `
    <div class="comment-item">
      <div class="comment-author">${esc(data.author)}</div>
      <div class="comment-text">${esc(data.content)}</div>
    </div>
  `;
}

// ── WATCHLIST ──────────────────────────────────────────
async function loadWatchlist() {
  const { ok, data } = await api("GET", "/watchlist");
  const container = document.getElementById("watchlistItems");

  if (!ok || data.length === 0) {
    container.innerHTML = `<p class="empty-msg">No anime in the watchlist yet. Add one! 📺</p>`;
    return;
  }

  container.innerHTML = data.map((item) => renderWatchItem(item)).join("");
}

function renderWatchItem(item) {
  const isOwner = currentUser && currentUser.username === item.username;
  const statusClass = item.status === "Watching" ? "status-watching" : item.status === "Completed" ? "status-completed" : "status-plan";

  return `
    <div class="card" id="watch-${item.id}">
      <div class="post-header">
        <div>
          <div class="post-title">${esc(item.title)}</div>
          <span class="watch-status ${statusClass}">${esc(item.status)}</span>
        </div>
        ${isOwner ? `<button class="delete-btn" onclick="removeWatch('${item.id}')">🗑 Remove</button>` : ""}
      </div>
      ${item.genre ? `<div class="watch-info">Genre: ${esc(item.genre)}</div>` : ""}
      ${item.notes ? `<div class="watch-info">📝 ${esc(item.notes)}</div>` : ""}
      <div class="watch-addedby">Added by ${esc(item.addedBy)}</div>
    </div>
  `;
}

async function addToWatchlist() {
  const title = document.getElementById("watchTitle").value.trim();
  const genre = document.getElementById("watchGenre").value.trim();
  const status = document.getElementById("watchStatus").value;
  const notes = document.getElementById("watchNotes").value.trim();

  const { ok, data } = await api("POST", "/watchlist", { title, genre, status, notes });
  if (!ok) return showError("watchError", data.error);

  document.getElementById("watchTitle").value = "";
  document.getElementById("watchGenre").value = "";
  document.getElementById("watchNotes").value = "";
  loadWatchlist();
}

async function removeWatch(id) {
  if (!confirm("Remove from watchlist?")) return;
  await api("DELETE", `/watchlist/${id}`);
  loadWatchlist();
}

// ── Utility ────────────────────────────────────────────
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
