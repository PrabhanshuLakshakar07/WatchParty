/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║          WatchParty — Socket.io Server                   ║
 * ║  Node.js + Express + Socket.io                           ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');
const multer    = require('multer');

// 1. Sabse pehle Express App initialize karo
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// 2. Multer Configuration (App ke baad)
const storage = multer.diskStorage({
    destination: 'public/uploads/', 
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// 3. Static Files Middleware
app.use(express.static(path.join(__dirname, 'public')));

// 4. File Upload Route (Yaha ab 'app' define ho chuka hai, error nahi aayega)
app.post('/upload-video', upload.single('video'), (req, res) => {
    if (req.file) {
        // Upload hone ke baad client ko path bhejo
        const videoUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, url: videoUrl });
    } else {
        res.status(400).json({ success: false, message: "No file uploaded" });
    }
});

// ── In-Memory Room Store ────────────────────────────────────────────────────
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      adminId:       null,
      videoSrc:      '',
      currentTime:   0,
      isPlaying:     false,
      lastUpdatedAt: Date.now(),
      users:         new Map(),
    });
  }
  return rooms.get(roomId);
}

function getRoomUserList(room) {
  return Array.from(room.users.values());
}

function liveCurrentTime(room) {
  if (!room.isPlaying) return room.currentTime;
  const elapsed = (Date.now() - room.lastUpdatedAt) / 1000;
  return room.currentTime + elapsed;
}

// ── Socket.io Events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  socket.on('join_room', ({ roomId, username }) => {
    if (!roomId || !username) return;

    socket.join(roomId);
    const room    = getOrCreateRoom(roomId);
    const isAdmin = room.users.size === 0;

    if (isAdmin) room.adminId = socket.id;

    room.users.set(socket.id, { id: socket.id, username, isAdmin });
    socket.data = { roomId, username, isAdmin };

    socket.emit('room_state', {
      videoSrc:    room.videoSrc,
      currentTime: liveCurrentTime(room),
      isPlaying:   room.isPlaying,
      isAdmin,
      adminId:     room.adminId,
    });

    io.to(roomId).emit('user_list', getRoomUserList(room));
    io.to(roomId).emit('chat_message', {
      system:    true,
      text:      `${username} joined the room`,
      timestamp: Date.now(),
    });

    console.log(`[JOIN] "${username}" → room "${roomId}"`);
  });

  socket.on('video_play', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminId !== socket.id) return;
    room.isPlaying     = true;
    room.currentTime   = currentTime;
    room.lastUpdatedAt = Date.now();
    socket.to(roomId).emit('video_play', { currentTime });
  });

  socket.on('video_pause', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminId !== socket.id) return;
    room.isPlaying     = false;
    room.currentTime   = currentTime;
    room.lastUpdatedAt = Date.now();
    socket.to(roomId).emit('video_pause', { currentTime });
  });

  socket.on('video_seek', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminId !== socket.id) return;
    room.currentTime   = currentTime;
    room.lastUpdatedAt = Date.now();
    socket.to(roomId).emit('video_seek', { currentTime });
  });

  socket.on('video_src_change', ({ roomId, videoSrc }) => {
    const room = rooms.get(roomId);
    if (!room || room.adminId !== socket.id) return;
    room.videoSrc      = videoSrc;
    room.currentTime   = 0;
    room.isPlaying     = false;
    room.lastUpdatedAt = Date.now();
    io.to(roomId).emit('video_src_change', { videoSrc });
  });

  socket.on('chat_message', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const user = room.users.get(socket.id);
    if (!user) return;
    io.to(roomId).emit('chat_message', {
      system:    false,
      username:  user.username,
      isAdmin:   user.isAdmin,
      text:      text.slice(0, 500),
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    const { roomId, username } = socket.data || {};
    const room = rooms.get(roomId);
    if (!room) return;

    room.users.delete(socket.id);

    if (room.adminId === socket.id && room.users.size > 0) {
      const [newAdminId, newAdmin] = room.users.entries().next().value;
      newAdmin.isAdmin = true;
      room.adminId     = newAdminId;
      io.to(newAdminId).emit('promoted_to_admin');
    }

    if (room.users.size === 0) {
      rooms.delete(roomId);
    } else {
      io.to(roomId).emit('user_list', getRoomUserList(room));
    }
  });
});

// ── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 WatchParty running → http://localhost:${PORT}\n`);
});