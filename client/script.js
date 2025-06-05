const socket = io();

const nicknameContainer = document.getElementById('nickname-container');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');
const nicknameError = document.getElementById('nickname-error');

const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

let myNickname = '';

nicknameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  if (!nickname) return;
  socket.emit('set_nickname', nickname);
});

socket.on('nickname_status', (data) => {
  if (data.success) {
    myNickname = data.nickname;
    nicknameContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    chatInput.focus();
  } else {
    nicknameError.textContent = '이미 존재하는 닉네임입니다.';
    nicknameInput.focus();
  }
});

nicknameInput.addEventListener('input', () => {
  nicknameError.textContent = '';
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit('chat_message', msg);
  appendMessage(myNickname, msg, true);
  chatInput.value = '';
});

socket.on('chat_message', ({ nickname, message }) => {
  if (nickname !== myNickname) {
    appendMessage(nickname, message, false);
  }
});

function appendMessage(nickname, message, isSelf) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message' + (isSelf ? ' self' : '');
  msgDiv.innerHTML = `<strong>${escapeHtml(nickname)}</strong>: ${escapeHtml(message)}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function(m) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m];
  });
}