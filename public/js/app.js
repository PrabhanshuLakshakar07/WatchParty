'use strict';

// ── DOM shortcuts ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Utilities ──────────────────────────────────────────────────────────────
const COLORS = ['#e8ff47','#7b5ea7','#4dffa0','#ff4d6d','#47c4ff','#ffa347','#ff47e8','#47ffda'];

function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[h];
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function genRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

let _tt;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 3000);
}

let _st;
function flashSync() {
  const el = $('sync-badge');
  el.classList.add('show');
  clearTimeout(_st);
  _st = setTimeout(() => el.classList.remove('show'), 1800);
}

function hideNoSrc() {
  const el = $('no-src');
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 300);
}

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  roomId:          null,
  username:        null,
  isAdmin:         false,
  isSyncingRemote: false,
};

// ── Socket + Player ────────────────────────────────────────────────────────
const socket = io();
const player = new VideoAdapter($('video-player'));

// ─────────────────────────────────────────────────────────────────────────
//  setAdminUI — uses direct style.display (no class toggle, 100% reliable)
// ─────────────────────────────────────────────────────────────────────────
function setAdminUI(isAdmin) {
  state.isAdmin = isAdmin;
  const adminBar = $('admin-bar');
  const sampleBar = $('sample-bar');
  const adminBadge = $('admin-badge');
  const viewerNote = $('viewer-note');

  if (isAdmin) {
    adminBar.style.setProperty('display', 'flex', 'important');
    sampleBar.style.setProperty('display', 'flex', 'important');
    adminBadge.style.setProperty('display', 'flex', 'important');
    viewerNote.style.setProperty('display', 'none', 'important');
    player.showControls();
    console.log("Admin bars should be visible now");
  } else {
    // ... rest of your code
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  enterRoom — switches to app view immediately
// ─────────────────────────────────────────────────────────────────────────
// app.js ke enterRoom function ko aise update karo
function enterRoom(roomId, username, isAdmin) {
  state.roomId = roomId;
  state.username = username;
  
  // Lobby chhupao aur App dikhao
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('app').classList.add('active');
  document.getElementById('topbar-room-id').textContent = roomId;

  // Thoda sa delay (0ms) do taaki DOM update ho jaye, phir Admin UI set karo
  setTimeout(() => {
    setAdminUI(isAdmin);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────
//  applyRemote — wraps programmatic player changes
//  Sets isSyncingRemote so native events don't re-emit (loop prevention)
// ─────────────────────────────────────────────────────────────────────────
function applyRemote(fn) {
  state.isSyncingRemote = true;
  try { fn(); }
  finally { setTimeout(() => { state.isSyncingRemote = false; }, 60); }
}

// ─────────────────────────────────────────────────────────────────────────
//  VIDEO EVENTS → SOCKET EMIT
//  Guard: skip if programmatic (isSyncingRemote) or not admin
// ─────────────────────────────────────────────────────────────────────────
player.onPlay(() => {
  if (state.isSyncingRemote || !state.isAdmin) return;
  socket.emit('video_play', { roomId: state.roomId, currentTime: player.getCurrentTime() });
});
player.onPause(() => {
  if (state.isSyncingRemote || !state.isAdmin) return;
  socket.emit('video_pause', { roomId: state.roomId, currentTime: player.getCurrentTime() });
});
player.onSeeked(() => {
  if (state.isSyncingRemote || !state.isAdmin) return;
  socket.emit('video_seek', { roomId: state.roomId, currentTime: player.getCurrentTime() });
});

// ─────────────────────────────────────────────────────────────────────────
//  INCOMING SOCKET EVENTS
// ─────────────────────────────────────────────────────────────────────────

socket.on('room_state', ({ videoSrc, currentTime, isPlaying, isAdmin }) => {
  setAdminUI(isAdmin);
  if (videoSrc) {
    hideNoSrc();
    applyRemote(() => {
      player.setSrc(videoSrc);
      $('src-input').value = videoSrc;
      $('video-player').addEventListener('loadedmetadata', () => {
        applyRemote(() => {
          player.seek(currentTime);
          if (isPlaying) player.play().catch(() => {});
        });
      }, { once: true });
    });
    flashSync();
    toast('Synced to room!');
  }
});

socket.on('video_play', ({ currentTime }) => {
  applyRemote(() => { player.seek(currentTime); player.play().catch(() => {}); });
  flashSync();
});

socket.on('video_pause', ({ currentTime }) => {
  applyRemote(() => { player.seek(currentTime); player.pause(); });
  flashSync();
});

socket.on('video_seek', ({ currentTime }) => {
  applyRemote(() => player.seek(currentTime));
  flashSync();
});

socket.on('video_src_change', ({ videoSrc }) => {
  hideNoSrc();
  applyRemote(() => {
    player.setSrc(videoSrc);
    $('src-input').value = videoSrc;
  });
  toast('Video loaded!');
  flashSync();
});

socket.on('user_list', users => {
  $('user-count').textContent = `${users.length} watching`;
  $('users-list').innerHTML = users.map(u => {
    const c = avatarColor(u.username);
    return `<div class="user-item">
      <div class="avatar" style="background:${c}20;color:${c}">${u.username[0].toUpperCase()}</div>
      <span class="user-name">${escHtml(u.username)}</span>
      ${u.isAdmin ? '<span class="user-crown">👑</span>' : ''}
    </div>`;
  }).join('');
});

socket.on('chat_message', msg => {
  const el = document.createElement('div');
  if (msg.system) {
    el.className = 'chat-system';
    el.textContent = msg.text;
  } else {
    const c = avatarColor(msg.username);
    el.className = 'chat-msg';
    el.innerHTML = `
      <div class="chat-meta">
        <span class="chat-author" style="color:${c}">${escHtml(msg.username)}</span>
        <span class="chat-time">${fmtTime(msg.timestamp)}</span>
      </div>
      <div class="chat-text">${escHtml(msg.text)}</div>`;
  }
  const box = $('chat-messages');
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
});

socket.on('promoted_to_admin', () => {
  setAdminUI(true);
  toast('You are now the host! 👑');
});

// ─────────────────────────────────────────────────────────────────────────
//  LOBBY BUTTONS
// ─────────────────────────────────────────────────────────────────────────
$('create-btn').addEventListener('click', () => {
  const username = $('username-input').value.trim();
  if (!username) return toast('Enter your name first');
  const roomId = genRoomId();
  socket.emit('join_room', { roomId, username });
  enterRoom(roomId, username, true);
});

$('join-btn').addEventListener('click', () => {
  const username = $('username-input').value.trim();
  const roomId   = $('room-input').value.trim().toUpperCase();
  if (!username) return toast('Enter your name first');
  if (!roomId)   return toast('Enter a Room ID');
  socket.emit('join_room', { roomId, username });
  enterRoom(roomId, username, false);
});

[$('username-input'), $('room-input')].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') $('join-btn').click(); });
});

// ─────────────────────────────────────────────────────────────────────────
//  TOPBAR: COPY ROOM ID
// ─────────────────────────────────────────────────────────────────────────
$('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomId)
    .then(() => toast('Room ID copied!'))
    .catch(() => toast('Room ID: ' + state.roomId));
});

// ─────────────────────────────────────────────────────────────────────────
//  ADMIN: LOAD VIDEO
// ─────────────────────────────────────────────────────────────────────────
function loadSrc(src) {
  if (!src) return toast('Paste a video URL first');
  socket.emit('video_src_change', { roomId: state.roomId, videoSrc: src });
}

$('src-btn').addEventListener('click', () => loadSrc($('src-input').value.trim()));
$('src-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('src-btn').click(); });

document.querySelectorAll('.sample-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const src = btn.dataset.src;
    $('src-input').value = src;
    loadSrc(src);
    toast('Loading: ' + btn.textContent.trim());
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  SIDEBAR TABS
// ─────────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  CHAT
// ─────────────────────────────────────────────────────────────────────────
function sendChat() {
  const text = $('chat-input').value.trim();
  if (!text || !state.roomId) return;
  socket.emit('chat_message', { roomId: state.roomId, text });
  $('chat-input').value = '';
}
$('chat-send').addEventListener('click', sendChat);
$('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
///local
$('local-file-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    toast("Uploading video to server... please wait");

    const formData = new FormData();
    formData.append('video', file);

    // 1. Server par file bhejo
    const response = await fetch('/upload-video', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();

    if (data.success) {
        // 2. Uploaded link ko sab doston ko broadcast karo
        socket.emit('video_src_change', { 
            roomId: state.roomId, 
            videoSrc: data.url 
        });
        toast("Video uploaded and shared!");
    }
};