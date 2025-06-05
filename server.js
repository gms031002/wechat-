const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 닉네임 ↔ 소켓ID 매핑
const socketIdToNickname = new Map();
const nicknameToSocketId = new Map();

// 정적 파일 제공 (client 폴더 기준)
app.use(express.static(path.join(__dirname, './')));

// 타임스탬프 생성 함수 (YYYY-MM-DD HH:mm)
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
    pad(now.getMinutes())
  );
}

// 닉네임 유효성 및 중복 체크 함수
function isValidNickname(nickname) {
  return (
    typeof nickname === 'string' &&
    !!nickname.trim() &&
    !nicknameToSocketId.has(nickname)
  );
}

// 소켓 연결 처리
io.on('connection', (socket) => {
  // 닉네임 설정 요청 수신
  socket.on('set_nickname', (nickname) => {
    if (!isValidNickname(nickname)) {
      socket.emit('nickname_status', {
        success: false,
        error: 'DUPLICATE_OR_INVALID',
        message: '이미 존재하거나 올바르지 않은 닉네임입니다.',
      });
      return;
    }

    // 닉네임 등록
    socketIdToNickname.set(socket.id, nickname);
    nicknameToSocketId.set(nickname, socket.id);

    socket.emit('nickname_status', {
      success: true,
      nickname,
      message: '닉네임 등록 성공',
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

    io.emit('chat_message', chatData);
  });

  // 연결 종료 시 닉네임 정리
  socket.on('disconnect', () => {
    const nickname = socketIdToNickname.get(socket.id);
    if (nickname) {
      socketIdToNickname.delete(socket.id);
      nicknameToSocketId.delete(nickname);
    }
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
