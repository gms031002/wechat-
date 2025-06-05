const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const fs = require('fs');
const logPath = path.join(__dirname, 'chat-log.json');

// ✅ Firebase Admin SDK 추가
const admin = require('firebase-admin');
const firebaseKey = require('./serverfirebase-key.json'); // 인증 키 파일명 확인

admin.initializeApp({
  credential: admin.credential.cert(firebaseKey),
});
const db = admin.firestore();
const chatCollection = db.collection('chatMessages');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const socketIdToNickname = new Map();
const nicknameToSocketId = new Map();

function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    now.getFullYear() +
    '-' +
    pad(now.getMonth() + 1) +
    '-' +
    pad(now.getDate()) +
    ' ' +
    pad(now.getHours()) +
    ':' +
    pad(now.getMinutes()) +
    ':' +
    pad(now.getSeconds())
  );
}

function isValidNickname(nickname) {
  return (
    typeof nickname === 'string' &&
    !!nickname.trim() &&
    !nicknameToSocketId.has(nickname)
  );
}

function saveMessageToLog({ nickname, message, timestamp }) {
  let logArr = [];
  try {
    if (fs.existsSync(logPath)) {
      const data = fs.readFileSync(logPath, 'utf8');
      logArr = JSON.parse(data);
      if (!Array.isArray(logArr)) logArr = [];
    }
  } catch (e) {
    logArr = [];
  }
  logArr.push({ nickname, message, timestamp });
  try {
    fs.writeFileSync(logPath, JSON.stringify(logArr, null, 2), 'utf8');
  } catch (e) {
    console.error('채팅 로그 저장 실패:', e);
  }
}

io.on('connection', (socket) => {
  socket.on('set_nickname', (nickname) => {
    if (!isValidNickname(nickname)) {
      socket.emit('nickname_status', {
        success: false,
        message: '이미 존재하거나 올바르지 않은 닉네임입니다.',
        error: 'DUPLICATE_OR_INVALID',
      });
      return;
    }
    socketIdToNickname.set(socket.id, nickname);
    nicknameToSocketId.set(nickname, socket.id);
    socket.emit('nickname_status', {
      success: true,
      message: '닉네임 등록 성공',
      nickname,
    });
  });

  socket.on('chat_message', (msg) => {
    const nickname = socketIdToNickname.get(socket.id);
    if (!nickname || typeof msg !== 'string' || !msg.trim()) return;

    const chatData = {
      nickname,
      message: msg,
      timestamp: getTimestamp(),
    };

    io.emit('chat_message', chatData);
    saveMessageToLog(chatData);

    // ✅ Firebase Firestore 저장
    chatCollection.add(chatData).catch((err) => {
      console.error('Firebase 저장 실패:', err);
    });
  });

  socket.on('disconnect', () => {
    const nickname = socketIdToNickname.get(socket.id);
    if (nickname) {
      socketIdToNickname.delete(socket.id);
      nicknameToSocketId.delete(nickname);
    }
  });
});

server.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
