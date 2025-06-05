const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const fs = require('fs');
const logPath = path.join(__dirname, 'chat-log.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 닉네임 ↔ 소켓ID 매핑
const socketIdToNickname = new Map();
const nicknameToSocketId = new Map();

// 유틸: 타임스탬프 (YYYY-MM-DD HH:mm:ss)
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

// 유틸: 닉네임 유효성 및 중복 체크
function isValidNickname(nickname) {
  return (
    typeof nickname === 'string' &&
    !!nickname.trim() &&
    !nicknameToSocketId.has(nickname)
  );
}

// 채팅 메시지 로그 저장 함수
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
    // 파일 저장 실패 시 서버 콘솔에만 에러 출력
    console.error('채팅 로그 저장 실패:', e);
  }
}

// 정적 파일 경로: /client 폴더 기준
app.use(express.static(path.join(__dirname, '../client')));

io.on('connection', (socket) => {
  // 닉네임 설정
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

  // 채팅 메시지 수신
  socket.on('chat_message', (msg) => {
    const nickname = socketIdToNickname.get(socket.id);
    if (!nickname || typeof msg !== 'string' || !msg.trim()) return;

    const chatData = {
      nickname,
      message: msg,
      timestamp: getTimestamp(),
    };

    // 모든 클라이언트에 메시지 전송
    io.emit('chat_message', chatData);

    // 메시지 로그 파일에 저장
    saveMessageToLog(chatData);
  });

  // 연결 해제 시 닉네임 정리
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