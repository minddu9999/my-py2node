// ==========================================
// ⚡ 나만의 AI 전기설비 도우미 - 프론트엔드 로직
// (Streamlit UI 의 바닐라 JS 포팅)
// ==========================================
"use strict";

const AI_AVATAR_URL = "https://cdn.phototourl.com/free/2026-07-23-15287eb1-a0dc-42f5-895b-ba283e857248.png";

// ---------- 상태 ----------
const state = {
  user: null,            // { id, displayUserId } | null
  chats: [],             // [{ id, title, messages: [] }]
  currentChatId: null,
  refSelection: [],      // 과거 대화 참고로 선택한 chat id 목록 (로그인 전용, 최대 3)
  pendingImage: null,    // { dataUrl, name } | null
  sending: false,
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $("sidebar"),
  sidebarToggle: $("sidebarToggle"),
  authBox: $("authBox"),
  userBox: $("userBox"),
  greeting: $("greeting"),
  loginForm: $("loginForm"),
  signupForm: $("signupForm"),
  chatList: $("chatList"),
  refSection: $("refSection"),
  refList: $("refList"),
  refStatus: $("refStatus"),
  imageInput: $("imageInput"),
  imagePreviewBox: $("imagePreviewBox"),
  imagePreview: $("imagePreview"),
  imageClearBtn: $("imageClearBtn"),
  exportBtn: $("exportBtn"),
  importInput: $("importInput"),
  guestBanner: $("guestBanner"),
  refBanner: $("refBanner"),
  caption: $("caption"),
  messages: $("messages"),
  emptyInfo: $("emptyInfo"),
  chatInput: $("chatInput"),
  sendBtn: $("sendBtn"),
  newChatBtn: $("newChatBtn"),
  logoutBtn: $("logoutBtn"),
  toastBox: $("toastBox"),
};

// ---------- 유틸 ----------
function uuid() {
  return (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    .replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    }));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text) {
  if (window.marked && window.DOMPurify) {
    return DOMPurify.sanitize(marked.parse(text, { breaks: true }));
  }
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  els.toastBox.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ---------- 게스트 대화 저장 (브라우저 닫으면 사라짐 = sessionStorage) ----------
function persistGuest() {
  if (state.user) return;
  sessionStorage.setItem("guest_chats", JSON.stringify(state.chats));
  sessionStorage.setItem("guest_current_chat_id", state.currentChatId || "");
}

function loadGuest() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("guest_chats") || "[]");
    if (Array.isArray(saved) && saved.length) state.chats = saved;
  } catch { /* 무효한 저장값 무시 */ }
  const cur = sessionStorage.getItem("guest_current_chat_id");
  if (cur && state.chats.some((c) => c.id === cur)) state.currentChatId = cur;
}

// ---------- 대화 관리 ----------
function ensureChats() {
  // 대화 목록이 없거나 비어있으면 기본 대화 1개 생성 (Python 로직 동일)
  if (!state.chats.length) {
    const id = uuid();
    state.chats = [{ id, title: "새로운 대화 1", messages: [] }];
  }
  // 현재 대화 ID가 없거나 유효하지 않으면 첫 번째 대화로 (KeyError 방지)
  if (!state.currentChatId || !state.chats.some((c) => c.id === state.currentChatId)) {
    state.currentChatId = state.chats[0].id;
  }
}

function currentChat() {
  return state.chats.find((c) => c.id === state.currentChatId);
}

function createChat(title) {
  const id = uuid();
  const finalTitle = title || `새로운 대화 ${state.chats.length + 1}`;
  state.chats.push({ id, title: finalTitle, messages: [] });
  state.currentChatId = id;
  persistGuest();
  renderAll();
  return state.chats[state.chats.length - 1];
}

// ---------- 렌더링 ----------
function renderAll() {
  ensureChats();
  renderAccount();
  renderChatList();
  renderRefSection();
  renderImageSection();
  renderBannerAndCaption();
  renderMessages();
}

function renderAccount() {
  if (state.user) {
    els.authBox.classList.add("hidden");
    els.userBox.classList.remove("hidden");
    els.greeting.innerHTML = `👋 안녕하세요, <b>${escapeHtml(state.user.displayUserId)}</b>님!`;
  } else {
    els.authBox.classList.remove("hidden");
    els.userBox.classList.add("hidden");
  }
}

function renderChatList() {
  els.chatList.innerHTML = "";
  for (const chat of state.chats) {
    const li = document.createElement("li");
    li.textContent = chat.title;
    if (chat.id === state.currentChatId) li.classList.add("active");
    li.addEventListener("click", () => {
      if (state.currentChatId !== chat.id) {
        state.currentChatId = chat.id;
        persistGuest();
        renderAll();
      }
      els.sidebar.classList.remove("open");
    });
    els.chatList.appendChild(li);
  }
  els.exportBtn.disabled = (currentChat()?.messages || []).length === 0;
}

function renderRefSection() {
  if (!state.user) {
    els.refSection.classList.add("hidden");
    return;
  }
  els.refSection.classList.remove("hidden");

  const others = state.chats.filter((c) => c.id !== state.currentChatId);
  els.refList.innerHTML = "";

  // 현재 선택 목록 정합성 유지 (삭제/변경된 대화 제거)
  state.refSelection = state.refSelection.filter((id) => others.some((c) => c.id === id));

  if (!others.length) {
    els.refList.innerHTML = `<div class="caption">참고할 다른 대화가 없습니다.</div>`;
  } else {
    for (const chat of others) {
      const label = document.createElement("label");
      const isChecked = state.refSelection.includes(chat.id);
      const disabled = !isChecked && state.refSelection.length >= 3;
      if (disabled) label.classList.add("disabled");
      label.title = "이 대화를 참고 자료로 포함";
      label.innerHTML = `<input type="checkbox" ${isChecked ? "checked" : ""} ${disabled ? "disabled" : ""} /> 📖 ${escapeHtml(chat.title)}`;
      label.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) {
          if (state.refSelection.length < 3) state.refSelection.push(chat.id);
        } else {
          state.refSelection = state.refSelection.filter((id) => id !== chat.id);
        }
        sessionStorage.setItem("ref_selection", JSON.stringify(state.refSelection));
        renderRefSection();
        renderBannerAndCaption();
      });
      els.refList.appendChild(label);
    }
  }

  els.refStatus.textContent = state.refSelection.length
    ? `✨ ${state.refSelection.length}개 대화 참고 중`
    : "참고할 대화를 선택하지 않았습니다.";
}

function renderImageSection() {
  if (state.pendingImage) {
    els.imagePreview.src = state.pendingImage.dataUrl;
    els.imagePreviewBox.classList.remove("hidden");
    els.imageInput.value = "";
  } else {
    els.imagePreviewBox.classList.add("hidden");
    els.imagePreview.src = "";
  }
}

function renderBannerAndCaption() {
  els.guestBanner.classList.toggle("hidden", !!state.user);

  if (state.user && state.refSelection.length) {
    const titles = state.refSelection
      .map((id) => state.chats.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => escapeHtml(c.title));
    if (titles.length) {
      els.refBanner.innerHTML = `📚 <b>참고 중인 과거 대화:</b> ${titles.join(", ")}`;
      els.refBanner.classList.remove("hidden");
      return;
    }
  }
  els.refBanner.classList.add("hidden");

  const chat = currentChat();
  const displayUserId = state.user ? state.user.displayUserId : "게스트";
  els.caption.innerHTML = `📌 <b>현재 대화:</b> ${escapeHtml(chat.title)} | 👤 ${escapeHtml(displayUserId)}`;
}

function buildMessageBubble(role, content) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (role === "user") {
    avatar.textContent = "👤";
  } else {
    const img = document.createElement("img");
    img.src = AI_AVATAR_URL;
    img.alt = "AI";
    avatar.appendChild(img);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  appendContentToBubble(bubble, content);

  wrap.append(avatar, bubble);
  return wrap;
}

function appendContentToBubble(bubble, content) {
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === "text") {
        const span = document.createElement("div");
        span.innerHTML = renderMarkdown(item.text);
        bubble.appendChild(span);
      } else if (item.type === "image_url" && item.image_url && item.image_url.url) {
        const img = document.createElement("img");
        img.src = item.image_url.url;
        img.alt = "첨부 이미지";
        bubble.appendChild(img);
      }
    }
  } else if (typeof content === "string") {
    bubble.innerHTML = renderMarkdown(content);
  }
}

function renderMessages() {
  els.messages.innerHTML = "";
  const chat = currentChat();
  for (const message of chat.messages) {
    els.messages.appendChild(buildMessageBubble(message.role, message.content));
  }
  els.emptyInfo.classList.toggle("hidden", chat.messages.length > 0);
  scrollToBottom();
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

// ---------- API ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
  return data;
}

async function initSession() {
  try {
    const data = await api("/api/auth/me");
    state.user = data.user || null;
    if (state.user) {
      try {
        state.refSelection = JSON.parse(sessionStorage.getItem("ref_selection") || "[]");
        if (!Array.isArray(state.refSelection)) state.refSelection = [];
      } catch { state.refSelection = []; }
    }
  } catch { state.user = null; }

  if (state.user) {
    await loadChatsFromServer();
  } else {
    loadGuest();
  }
}

async function loadChatsFromServer() {
  try {
    const data = await api("/api/chats");
    state.chats = data.chats || [];
  } catch (e) {
    showToast(`대화 목록 불러오기 실패: ${e.message}`, "error");
    state.chats = [];
  }
}

// ---------- 로그인 / 회원가입 / 로그아웃 ----------
async function handleLogin(e) {
  e.preventDefault();
  const userId = $("loginUserId").value.trim();
  const password = $("loginPassword").value;
  if (!userId || !password) {
    showToast("아이디와 비밀번호를 모두 입력해주세요.", "error");
    return;
  }
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ userId, password }),
    });
    state.user = data.user;
    els.loginForm.reset();
    showToast(data.message || "로그인 성공!", "success");
    try {
      state.refSelection = JSON.parse(sessionStorage.getItem("ref_selection") || "[]");
      if (!Array.isArray(state.refSelection)) state.refSelection = [];
    } catch { state.refSelection = []; }
    await loadChatsFromServer();
    renderAll();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const userId = $("signupUserId").value.trim();
  const password = $("signupPassword").value;
  const confirmPassword = $("signupConfirm").value;

  if (!userId || !password || !confirmPassword) {
    showToast("모든 필드를 입력해주세요.", "error");
    return;
  }
  if (userId.length < 3) {
    showToast("아이디는 3자 이상이어야 합니다.", "error");
    return;
  }
  if (password !== confirmPassword) {
    showToast("비밀번호가 일치하지 않습니다.", "error");
    return;
  }
  if (password.length < 6) {
    showToast("비밀번호는 6자 이상이어야 합니다.", "error");
    return;
  }
  try {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ userId, password, confirmPassword }),
    });
    state.user = data.user;
    els.signupForm.reset();
    showToast(data.message || "회원가입 완료!", "success");
    await loadChatsFromServer();
    renderAll();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch { /* 무시 */ }
  state.user = null;
  state.refSelection = [];
  state.chats = [];
  state.currentChatId = null;
  loadGuest();
  renderAll();
  showToast("로그아웃되었습니다.", "success");
}

// ---------- 이미지 업로드 ----------
function handleImageSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!/image\/(png|jpe?g|webp)/i.test(file.type)) {
    showToast("지원 형식: PNG, JPG, JPEG, WEBP", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.pendingImage = { dataUrl: reader.result, name: file.name };
    renderImageSection();
  };
  reader.readAsDataURL(file);
}

// ---------- JSON 백업 / 불러오기 ----------
function handleExport() {
  const chat = currentChat();
  if (!chat || !chat.messages.length) return;
  const json = JSON.stringify(chat.messages, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const displayUserId = state.user ? state.user.displayUserId : "게스트";
  a.download = `${chat.title}_${displayUserId}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function handleImport(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = JSON.parse(reader.result);
      if (!Array.isArray(loaded)) throw new Error("대화 형식이 올바르지 않습니다.");
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      createChat(`📂 ${nameWithoutExt}`);
      const chat = currentChat();
      chat.messages = loaded;
      persistGuest();
      renderAll();
      showToast("대화를 성공적으로 불러왔습니다!", "success");
    } catch (err) {
      showToast(`파일 읽기 오류: ${err.message}`, "error");
    } finally {
      els.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

// ---------- 메시지 전송 (SSE 스트리밍) ----------
function setSending(on) {
  state.sending = on;
  els.sendBtn.disabled = on;
  els.chatInput.disabled = on;
}

async function sendMessage() {
  if (state.sending) return;
  const prompt = els.chatInput.value.trim();
  if (!prompt) return;

  const chat = currentChat();
  if (chat.messages.length === 0) {
    chat.title = prompt.length > 15 ? prompt.slice(0, 15) + "..." : prompt;
  }

  // 사용자 메시지 구성 (멀티모달: 텍스트 + 선택적으로 이미지)
  const userContent = [{ type: "text", text: prompt }];
  if (state.pendingImage) {
    userContent.push({ type: "image_url", image_url: { url: state.pendingImage.dataUrl } });
    state.pendingImage = null; // 전송 후 초기화 (중복 전송 방지)
  }
  const finalUserMessage =
    userContent.length === 1
      ? { role: "user", content: prompt }
      : { role: "user", content: userContent };

  chat.messages.push(finalUserMessage);
  persistGuest();

  els.chatInput.value = "";
  autoResize();
  renderChatList();
  renderBannerAndCaption();
  renderMessages();

  // 스트리밍 응답용 빈 말풍선
  const streamBubble = buildMessageBubble("assistant", "");
  els.messages.appendChild(streamBubble);
  const bubbleEl = streamBubble.querySelector(".bubble");
  els.emptyInfo.classList.add("hidden");
  scrollToBottom();

  setSending(true);
  let full = "";
  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: chat.id,
        title: chat.title,
        messages: chat.messages,
        refChatIds: state.user ? state.refSelection : [],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `서버 오류 (${res.status})`);
    }
    if (!res.body) throw new Error("스트리밍을 지원하지 않는 브라우저입니다.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === "delta" && evt.delta) {
          full += evt.delta;
          bubbleEl.innerHTML = renderMarkdown(full);
          scrollToBottom();
        } else if (evt.type === "done") {
          full = evt.content || full;
          bubbleEl.innerHTML = renderMarkdown(full);
        } else if (evt.type === "error") {
          streamError = new Error(evt.error);
        }
      }
    }
    if (streamError) throw streamError;

    chat.messages.push({ role: "assistant", content: full });
    persistGuest();
  } catch (err) {
    // Python 과 동일: 오류는 화면에 표시만 하고 대화에는 저장하지 않음
    bubbleEl.innerHTML = `<span class="error-text">${escapeHtml(err.message)}</span>`;
  } finally {
    setSending(false);
    streamBubble.remove();
    renderMessages();
    renderChatList();
  }
}

// ---------- 입력창 자동 높이 조절 ----------
function autoResize() {
  const el = els.chatInput;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

// ---------- 이벤트 바인딩 ----------
function bindEvents() {
  // 탭 전환
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab === "login" ? els.loginForm : els.signupForm;
      const other = tab.dataset.tab === "login" ? els.signupForm : els.loginForm;
      target.classList.remove("hidden");
      other.classList.add("hidden");
    });
  });

  els.loginForm.addEventListener("submit", handleLogin);
  els.signupForm.addEventListener("submit", handleSignup);
  els.logoutBtn.addEventListener("click", handleLogout);
  els.newChatBtn.addEventListener("click", () => {
    createChat();
    els.sidebar.classList.remove("open");
  });

  els.imageInput.addEventListener("change", handleImageSelect);
  els.imageClearBtn.addEventListener("click", () => {
    state.pendingImage = null;
    renderImageSection();
  });

  els.exportBtn.addEventListener("click", handleExport);
  els.importInput.addEventListener("change", handleImport);

  els.sendBtn.addEventListener("click", sendMessage);
  els.chatInput.addEventListener("input", autoResize);
  els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  els.sidebarToggle.addEventListener("click", () => els.sidebar.classList.toggle("open"));
}

// ---------- 시작 ----------
(async function main() {
  bindEvents();
  await initSession();
  renderAll();
})();
