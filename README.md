# 🎬 WatchParty — Real-time Synchronized Video Watching

A full-stack Watch Party app built with **Node.js + Express + Socket.io**.
Watch videos together in sync with friends, with chat and admin controls.

---

## 📁 Project Structure

```
watchparty/
├── server.js              ← Express + Socket.io backend
├── package.json
├── README.md
└── public/
    ├── index.html         ← Main HTML (lobby + app layout)
    ├── css/
    │   └── style.css      ← All styles (dark theme, responsive)
    └── js/
        ├── VideoAdapter.js  ← Modular player wrapper (swap for YouTube easily)
        └── app.js           ← All client-side sync logic
```

---

## 🚀 Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# 3. Open in browser
# → http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev    # requires nodemon (included in devDependencies)
```

---

## 🎮 How to Use

1. Open `http://localhost:3000` in your browser
2. Enter your name → click **Create New Room**
3. Copy the **Room ID** from the top bar (⎘ button)
4. Share the Room ID with friends → they open the URL, enter name, paste ID → **Join Room**
5. As host: paste a video URL in the **SRC** bar or click a **Quick Load** sample
6. Play, pause, seek — all viewers stay in sync automatically!

---

## ⚙️ How Sync Works

### Infinite Loop Prevention (Two-Layer Defense)

**The Problem:**  
Native video events (`play`, `pause`, `seeked`) fire for both user clicks AND programmatic changes. Without protection, receiving a remote `pause` → calling `video.pause()` → fires `pause` event → emits back to server → infinite loop.

**Layer 1 — `isSyncingRemote` flag (client-side)**

```js
// In app.js
function applyRemote(fn) {
  state.isSyncingRemote = true;   // set flag BEFORE change
  try { fn(); }
  finally { setTimeout(() => { state.isSyncingRemote = false; }, 50); }
}

// In event listener:
player.onPause(() => {
  if (state.isSyncingRemote) return;  // ← SKIP if programmatic
  socket.emit('video_pause', ...);
});
```

**Layer 2 — Server broadcasts to others only**

```js
// In server.js — socket.to() excludes the sender
socket.to(roomId).emit('video_pause', { currentTime });
```

### Late-Joiner Sync

When a new user joins mid-session, the server computes the live playback position:

```js
function liveCurrentTime(room) {
  if (!room.isPlaying) return room.currentTime;
  const elapsed = (Date.now() - room.lastUpdatedAt) / 1000;
  return room.currentTime + elapsed;  // accounts for playback since last event
}
```

This is sent in the `room_state` event so the new viewer jumps to the right timestamp.

---

## 🔌 Swapping the Video Player (YouTube / Vimeo)

All sync logic in `app.js` uses only the `VideoAdapter` interface.  
To swap in the YouTube IFrame API:

1. Edit `public/js/VideoAdapter.js` only
2. Replace each method:

```js
// Native <video>     →    YouTube IFrame API
play()               →    this.player.playVideo()
pause()              →    this.player.pauseVideo()
seek(t)              →    this.player.seekTo(t, true)
getCurrentTime()     →    this.player.getCurrentTime()
setSrc(url)          →    this.player.loadVideoByUrl(url)
onPlay(fn)           →    YT onStateChange → YT.PlayerState.PLAYING
onPause(fn)          →    YT onStateChange → YT.PlayerState.PAUSED
```

`app.js`, `server.js`, and `style.css` remain **100% unchanged**.

---

## ✨ Features

| Feature | Details |
|---|---|
| Room system | Unique Room IDs, create or join |
| Video sync | Play, Pause, Seek — all synced in real-time |
| Loop prevention | `isSyncingRemote` flag + server-side broadcast exclusion |
| Late-joiner sync | Auto-seeks to current timestamp on join |
| Admin controls | Only the room creator controls the video |
| Host handoff | If admin leaves, next user is auto-promoted |
| Chat | Real-time sidebar chat with timestamps |
| User list | Shows everyone currently in the room with avatars |
| Responsive | Works on mobile and desktop |

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express, Socket.io
- **Frontend:** Vanilla HTML5 / CSS3 / JavaScript (no framework)
- **Fonts:** Syne + DM Mono (Google Fonts)
