// ── Init ──────────────────────────────────────────────────────────────────────
const code = location.pathname.split('/').pop();
const params = new URLSearchParams(location.search);
const hostToken = params.get('token');

if (!hostToken) { alert('Missing host token. Go back to the home page.'); }

const socket = io();
let timerInterval = null;
let currentQuestion = null;
let teams = {};

// ── Screen helper ─────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Host button steps: idle → sent → answering → revealed
// idle     = question loaded on host, players waiting
// sent     = question text sent to players
// answering = answer options shown, teams can answer
// revealed = results shown to players
function setStep(step) {
  const btnSend    = document.getElementById('btn-send-question');
  const btnAnswers = document.getElementById('btn-show-answers');
  const btnReveal  = document.getElementById('btn-reveal');
  const btnNext    = document.getElementById('btn-next');
  const btnEnd     = document.getElementById('btn-end');

  // Reset all
  [btnSend, btnAnswers, btnReveal, btnNext].forEach(b => {
    b.classList.add('hidden');
    b.disabled = false;
  });
  document.getElementById('correct-reveal').classList.add('hidden');

  if (step === 'idle') {
    btnSend.classList.remove('hidden');
    btnEnd.classList.remove('hidden');
  } else if (step === 'sent') {
    btnAnswers.classList.remove('hidden');
    btnEnd.classList.remove('hidden');
  } else if (step === 'answering') {
    btnReveal.classList.remove('hidden');
    btnEnd.classList.remove('hidden');
    startTimer(currentQuestion?.time_limit || 20);
  } else if (step === 'revealed') {
    document.getElementById('correct-reveal').classList.remove('hidden');
    btnNext.classList.remove('hidden');
    btnEnd.classList.remove('hidden');
    stopTimer();
  }
}

// ── Connect ───────────────────────────────────────────────────────────────────
socket.emit('host-join', { code, hostToken });

socket.on('error', ({ message }) => alert(`Error: ${message}`));

// ── Host joined ───────────────────────────────────────────────────────────────
socket.on('host-joined', ({ event, teams: teamList, questions }) => {
  document.getElementById('header-code').textContent = code;

  const gameUrl = `${location.origin}/game/${code}`;
  document.getElementById('lobby-share-link').value = gameUrl;
  new QRCode(document.getElementById('lobby-qr'), { text: gameUrl, width: 160, height: 160, colorDark: '#7c3aed', colorLight: '#ffffff' });

  document.getElementById('q-count-info').textContent = `${questions.length} questions loaded`;

  teamList.forEach(t => addTeam(t));

  if (event.status === 'running') showScreen('screen-game');
  else if (event.status === 'finished') showScreen('screen-gameover');
  else showScreen('screen-lobby');
});

// ── Lobby copy button ─────────────────────────────────────────────────────────
document.getElementById('lobby-copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('lobby-share-link').value);
  const btn = document.getElementById('lobby-copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 2000);
});

// ── Teams ─────────────────────────────────────────────────────────────────────
socket.on('team-arrived', ({ team }) => addTeam(team));

socket.on('team-selfie-updated', ({ teamId, selfieUrl }) => {
  teams[teamId] = { ...teams[teamId], selfie: selfieUrl };
  const img = document.querySelector(`[data-team-id="${teamId}"] img`);
  if (img) { img.src = selfieUrl; img.classList.remove('hidden'); }
  const init = document.querySelector(`[data-team-id="${teamId}"] .team-initials`);
  if (init) init.classList.add('hidden');
});

function addTeam(team) {
  teams[team.id] = team;
  updateTeamCount();

  const grid = document.getElementById('team-grid');
  let card = document.querySelector(`[data-team-id="${team.id}"]`);
  if (!card) {
    card = document.createElement('div');
    card.className = 'team-card';
    card.dataset.teamId = team.id;
    grid.appendChild(card);
  }
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  card.innerHTML = `
    <div class="team-avatar">
      ${team.selfie ? `<img src="${team.selfie}" alt="">` : `<span class="team-initials">${initials}</span>`}
    </div>
    <div class="team-card-name">${escapeHtml(team.name)}</div>
  `;

  const startBtn = document.getElementById('start-btn');
  const count = Object.keys(teams).length;
  startBtn.disabled = count < 1;
  startBtn.textContent = `Start Game (${count} team${count !== 1 ? 's' : ''})`;
}

function updateTeamCount() {
  document.getElementById('team-count').textContent = Object.keys(teams).length;
}

// ── Start game ────────────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  socket.emit('start-game', { code });
});

socket.on('game-started', () => showScreen('screen-game'));

// ── Question received (host only) ─────────────────────────────────────────────
socket.on('question-host', (q) => {
  currentQuestion = q;

  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-progress').textContent = `${q.index + 1} / ${q.total}`;
  document.getElementById('q-type-badge').textContent = typeLabel(q.type);
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('answers-log').innerHTML = '';
  document.getElementById('timer-fill').style.width = '100%';
  document.getElementById('timer-fill').className = 'timer-fill';

  // Show answer preview on host screen
  const answersPreview = document.getElementById('answers-preview');
  const wordsPreview = document.getElementById('words-preview');
  const estimationPreview = document.getElementById('estimation-preview');
  answersPreview.classList.add('hidden');
  wordsPreview.classList.add('hidden');
  estimationPreview.classList.add('hidden');

  if (q.type === 'multiple_choice') {
    answersPreview.classList.remove('hidden');
    const letters = ['A', 'B', 'C', 'D'];
    answersPreview.innerHTML = q.answers.map((a, i) => `
      <div class="answer-option" id="opt-${i}">
        <span class="answer-letter">${letters[i]}</span>
        ${escapeHtml(a)}
      </div>
    `).join('');
    // Highlight correct answer immediately for host
    setTimeout(() => {
      document.querySelectorAll('.answer-option').forEach((el, i) => {
        el.classList.toggle('correct', i === q.correct);
      });
    }, 50);
  } else if (q.type === 'word_order') {
    wordsPreview.classList.remove('hidden');
    wordsPreview.innerHTML = q.words.map(w => `<span class="word-chip-preview">${escapeHtml(w)}</span>`).join('');
  } else if (q.type === 'estimation') {
    estimationPreview.classList.remove('hidden');
    document.getElementById('estimation-submissions').innerHTML = '';
    const correctEl = document.getElementById('correct-value');
    if (correctEl) correctEl.textContent = `${q.correct_value} ${q.unit || ''}`;
  }

  setStep('idle');
});

// ── Host step buttons ─────────────────────────────────────────────────────────
document.getElementById('btn-send-question').addEventListener('click', () => {
  socket.emit('send-question', { code });
});

document.getElementById('btn-show-answers').addEventListener('click', () => {
  socket.emit('show-answers', { code });
});

document.getElementById('btn-reveal').addEventListener('click', () => {
  socket.emit('reveal-answer', { code });
});

document.getElementById('btn-next').addEventListener('click', () => {
  socket.emit('next-question', { code });
});

document.getElementById('btn-end').addEventListener('click', () => {
  if (confirm('End the game now?')) socket.emit('end-game', { code });
});

// Server confirms each step
socket.on('host-step', ({ step }) => {
  if (step === 'question-sent') setStep('sent');
  if (step === 'answers-shown') setStep('answering');
});

// ── Answer received ───────────────────────────────────────────────────────────
socket.on('answer-received', ({ teamId, isCorrect, points, answer, timeTaken }) => {
  const team = teams[teamId];
  if (!team) return;

  const log = document.getElementById('answers-log');
  const row = document.createElement('div');
  row.className = `answer-log-row ${isCorrect ? 'correct-log' : 'wrong-log'}`;

  const displayAnswer = currentQuestion?.type === 'multiple_choice'
    ? ['A','B','C','D'][parseInt(answer)] || answer
    : answer;

  row.innerHTML = `
    <span class="answer-log-name">${escapeHtml(team.name)}</span>
    <span style="color:var(--text2);font-size:0.8rem">${displayAnswer}</span>
    <span class="answer-log-result ${isCorrect ? 'ok' : 'bad'}">${isCorrect ? `+${points}` : '✗'}</span>
  `;
  log.prepend(row);

  if (currentQuestion?.type === 'estimation') {
    const chip = document.createElement('div');
    chip.className = 'est-submission-chip';
    chip.textContent = `${team.name}: ${answer}`;
    document.getElementById('estimation-submissions').appendChild(chip);
  }
});

// ── Answer revealed ───────────────────────────────────────────────────────────
socket.on('answer-revealed', ({ correct, scores }) => {
  setStep('revealed');

  // Show correct answer text
  const correctValue = document.getElementById('correct-value');
  if (currentQuestion?.type === 'multiple_choice') {
    correctValue.textContent = currentQuestion.answers[correct];
  } else if (currentQuestion?.type === 'estimation') {
    correctValue.textContent = `${correct} ${currentQuestion.unit || ''}`;
  } else if (currentQuestion?.type === 'word_order') {
    correctValue.textContent = correct.map(i => currentQuestion.words[i]).join(' → ');
  }

  updateScoreboard(scores);
});

socket.on('scores-updated', ({ scores }) => updateScoreboard(scores));

socket.on('first-correct', ({ team, points }) => showBuzz(team, points));

// ── Game over ─────────────────────────────────────────────────────────────────
socket.on('game-over', ({ scores }) => {
  stopTimer();
  showScreen('screen-gameover');
  renderPodium(scores);
});

// ── Scoreboard ────────────────────────────────────────────────────────────────
function updateScoreboard(scores) {
  document.getElementById('scoreboard').innerHTML = scores.map((t, i) => {
    const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    return `
      <div class="score-row">
        <span class="score-rank">${rankEmoji(i)}</span>
        <div class="score-avatar">
          ${t.selfie ? `<img src="${t.selfie}" alt="">` : initials}
        </div>
        <span class="score-name">${escapeHtml(t.name)}</span>
        <span class="score-pts">${t.score}</span>
        <div class="score-adj">
          <button onclick="adjustScore('${t.id}', 50)">+</button>
          <button onclick="adjustScore('${t.id}', -50)">-</button>
        </div>
      </div>
    `;
  }).join('');
}

window.adjustScore = (teamId, delta) => socket.emit('adjust-score', { code, teamId, delta });

function renderPodium(scores) {
  const top3 = scores.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  document.getElementById('final-podium').innerHTML = order.map(t => {
    const rank = t === top3[0] ? 1 : t === top3[1] ? 2 : 3;
    return `
      <div class="podium-item ${rank === 1 ? 'first' : ''}">
        <span class="podium-rank">${rankEmoji(rank - 1)}</span>
        <span class="podium-name">${escapeHtml(t.name)}</span>
        <span class="podium-score">${t.score} pts</span>
      </div>
    `;
  }).join('');
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer(seconds) {
  stopTimer();
  const fill = document.getElementById('timer-fill');
  fill.style.width = '100%';
  fill.className = 'timer-fill';
  let remaining = seconds;
  timerInterval = setInterval(() => {
    remaining--;
    const pct = (remaining / seconds) * 100;
    fill.style.width = `${pct}%`;
    if (pct < 30) fill.className = 'timer-fill danger';
    else if (pct < 60) fill.className = 'timer-fill warning';
    if (remaining <= 0) stopTimer();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── Buzz overlay ──────────────────────────────────────────────────────────────
function showBuzz(team, points) {
  const overlay = document.getElementById('buzz-overlay');
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('buzz-team-name').textContent = team.name;
  document.getElementById('buzz-points').textContent = `+${points} pts`;
  const selfieImg = document.getElementById('buzz-selfie');
  const initialsEl = document.getElementById('buzz-initials');
  if (team.selfie) { selfieImg.src = team.selfie; selfieImg.style.display = 'block'; initialsEl.textContent = ''; }
  else { selfieImg.style.display = 'none'; initialsEl.textContent = initials; }
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 3500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function typeLabel(type) {
  return { multiple_choice: 'Multiple Choice', estimation: 'Estimation', word_order: 'Word Order' }[type] || type;
}
function rankEmoji(i) { return ['🥇', '🥈', '🥉'][i] || `${i + 1}.`; }
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
