const code = location.pathname.split('/').pop();
const hostToken = new URLSearchParams(location.search).get('token');
if (!hostToken) alert('Missing host token.');

const socket = io();
let timerInterval = null;
let currentQuestion = null;
let teams = {};
let allQuestions = []; // { index, category, type } — received from server
let currentRound = 0;

const CATEGORY_ICONS = {
  'Geography': '🌍', 'Science': '🔬', 'Pop Culture': '🎬',
  'Sports': '⚽', 'History': '📜', 'Food & Drink': '🍽️'
};
const TYPE_LABELS = {
  'multiple_choice': 'Multiple Choice',
  'word_order': 'Word Ordering',
  'estimation': 'Estimation'
};

// ── Screens ───────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Host button steps ─────────────────────────────────────────────────────────
function setStep(step) {
  ['btn-send-question','btn-show-answers','btn-reveal','btn-next'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  document.getElementById('correct-reveal').classList.add('hidden');

  if (step === 'idle')      document.getElementById('btn-send-question').classList.remove('hidden');
  if (step === 'sent')      document.getElementById('btn-show-answers').classList.remove('hidden');
  if (step === 'answering') { document.getElementById('btn-reveal').classList.remove('hidden'); startTimer(currentQuestion?.time_limit || 20); }
  if (step === 'revealed')  { document.getElementById('btn-next').classList.remove('hidden'); stopTimer(); document.getElementById('correct-reveal').classList.remove('hidden'); }
}

// ── Config panel ──────────────────────────────────────────────────────────────
function buildConfigPanel(checkboxesId, radiosId, countId, defaultCats, defaultType) {
  const categories = [...new Set(allQuestions.map(q => q.category))];
  const types = [...new Set(allQuestions.map(q => q.type))];

  // Category checkboxes
  document.getElementById(checkboxesId).innerHTML = categories.map(cat => `
    <label class="checkbox-label">
      <input type="checkbox" class="cat-cb" value="${cat}" ${defaultCats.includes(cat) ? 'checked' : ''}>
      <span class="cat-icon">${CATEGORY_ICONS[cat] || '❓'}</span>
      <span>${cat}</span>
    </label>
  `).join('');

  // Type radios
  document.getElementById(radiosId).innerHTML = types.map(t => `
    <label class="radio-label">
      <input type="radio" name="${radiosId}" class="type-radio" value="${t}" ${t === defaultType ? 'checked' : ''}>
      <span>${TYPE_LABELS[t] || t}</span>
    </label>
  `).join('') + `
    <label class="radio-label disabled-option">
      <input type="radio" disabled>
      <span>Picture Puzzle <em>(coming soon)</em></span>
    </label>
  `;

  // Live count update
  const update = () => updateCount(checkboxesId, radiosId, countId);
  document.getElementById(checkboxesId).addEventListener('change', update);
  document.getElementById(radiosId).addEventListener('change', update);
  update();
}

function updateCount(checkboxesId, radiosId, countId) {
  const cats = [...document.querySelectorAll(`#${checkboxesId} .cat-cb:checked`)].map(cb => cb.value);
  const typeEl = document.querySelector(`#${radiosId} .type-radio:checked`);
  const type = typeEl?.value;
  const count = allQuestions.filter(q => cats.includes(q.category) && q.type === type).length;
  document.getElementById(countId).textContent = `${count} question${count !== 1 ? 's' : ''} match this selection`;
  return { cats, type, count };
}

function getConfig(checkboxesId, radiosId, pointsCorrectId, pointsBonusId) {
  const cats = [...document.querySelectorAll(`#${checkboxesId} .cat-cb:checked`)].map(cb => cb.value);
  const typeEl = document.querySelector(`#${radiosId} .type-radio:checked`);
  const pointsCorrect = parseInt(document.getElementById(pointsCorrectId)?.value) || 1;
  const pointsBonus = parseInt(document.getElementById(pointsBonusId)?.value) || 0;
  return { categories: cats, questionType: typeEl?.value, pointsCorrect, pointsBonus };
}

// ── Connect ───────────────────────────────────────────────────────────────────
socket.emit('host-join', { code, hostToken });
socket.on('error', ({ message }) => alert('Error: ' + message));

socket.on('host-joined', ({ event, teams: teamList, questions }) => {
  allQuestions = questions;
  document.getElementById('header-code').textContent = code;

  const gameUrl = `${location.origin}/game/${code}`;
  document.getElementById('lobby-share-link').value = gameUrl;
  new QRCode(document.getElementById('lobby-qr'), {
    text: gameUrl, width: 150, height: 150, colorDark: '#7c3aed', colorLight: '#ffffff'
  });

  const allCats = [...new Set(questions.map(q => q.category))];
  buildConfigPanel('category-checkboxes', 'type-radios', 'match-count', allCats, 'multiple_choice');

  teamList.forEach(t => addTeam(t));

  if (event.status === 'running') showScreen('screen-game');
  else if (event.status === 'round-over') showScreen('screen-round-over');
  else if (event.status === 'finished') showScreen('screen-gameover');
  else showScreen('screen-lobby');
});

document.getElementById('lobby-copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('lobby-share-link').value);
  const btn = document.getElementById('lobby-copy-btn');
  btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000);
});

// ── Teams ─────────────────────────────────────────────────────────────────────
socket.on('team-arrived', ({ team }) => addTeam(team));

socket.on('team-selfie-updated', ({ teamId, selfieUrl }) => {
  if (teams[teamId]) teams[teamId].selfie = selfieUrl;
  const card = document.querySelector(`[data-team-id="${teamId}"]`);
  if (card) {
    const img = card.querySelector('.team-avatar img');
    const init = card.querySelector('.team-initials');
    if (img) { img.src = selfieUrl; img.classList.remove('hidden'); }
    if (init) init.classList.add('hidden');
  }
  document.querySelectorAll(`[data-score-team="${teamId}"] .score-avatar`).forEach(el => {
    const img = el.querySelector('img');
    const init = el.querySelector('.init');
    if (img) { img.src = selfieUrl; img.classList.remove('hidden'); }
    if (init) init.classList.add('hidden');
  });
});

function addTeam(team) {
  teams[team.id] = team;
  const count = Object.keys(teams).length;
  document.getElementById('team-count').textContent = count;
  document.getElementById('team-count-lobby').textContent = count;

  if (count >= 1) {
    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-hint').classList.add('hidden');
  }

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
      <img src="${team.selfie || ''}" alt="" class="${team.selfie ? '' : 'hidden'}">
      <span class="team-initials${team.selfie ? ' hidden' : ''}">${initials}</span>
    </div>
    <div class="team-card-name">${escapeHtml(team.name)}</div>
  `;
}

// ── Start / next round ────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  const { categories, questionType, pointsCorrect, pointsBonus } = getConfig('category-checkboxes', 'type-radios', 'pts-correct', 'pts-bonus');
  if (!categories.length || !questionType) return;
  socket.emit('start-round', { code, categories, questionType, pointsCorrect, pointsBonus });
});

document.getElementById('btn-next-round').addEventListener('click', () => {
  const { categories, questionType, pointsCorrect, pointsBonus } = getConfig('ro-category-checkboxes', 'ro-type-radios', 'ro-pts-correct', 'ro-pts-bonus');
  if (!categories.length || !questionType) return;
  socket.emit('start-round', { code, categories, questionType, pointsCorrect, pointsBonus });
});

document.getElementById('btn-show-scoreboard').addEventListener('click', () => {
  socket.emit('show-scoreboard', { code });
});

document.getElementById('btn-end').addEventListener('click', () => {
  if (confirm('End game?')) socket.emit('end-game', { code });
});
document.getElementById('btn-final-end').addEventListener('click', () => {
  if (confirm('End game and show final results?')) socket.emit('end-game', { code });
});

// ── Round started ─────────────────────────────────────────────────────────────
socket.on('round-started', ({ roundNum, total }) => {
  currentRound = roundNum;
  showScreen('screen-game');
});

// ── Question (host only) ──────────────────────────────────────────────────────
socket.on('question-host', (q) => {
  currentQuestion = q;
  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-round-info').textContent = `Round ${currentRound}`;
  document.getElementById('q-progress').textContent = `${q.roundIndex + 1} / ${q.roundTotal}`;
  document.getElementById('q-type-badge').textContent = TYPE_LABELS[q.type] || q.type;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('answers-log').innerHTML = '';
  document.getElementById('timer-fill').style.width = '100%';
  document.getElementById('timer-fill').className = 'timer-fill';

  const answersPreview = document.getElementById('answers-preview');
  const wordsPreview = document.getElementById('words-preview');
  const estimationPreview = document.getElementById('estimation-preview');
  answersPreview.classList.add('hidden');
  wordsPreview.classList.add('hidden');
  estimationPreview.classList.add('hidden');

  if (q.type === 'multiple_choice') {
    answersPreview.classList.remove('hidden');
    answersPreview.innerHTML = q.answers.map((a, i) => `
      <div class="answer-option${i === q.correct ? ' correct' : ''}">
        <span class="answer-letter">${'ABCD'[i]}</span>${escapeHtml(a)}
      </div>`).join('');
  } else if (q.type === 'word_order') {
    wordsPreview.classList.remove('hidden');
    wordsPreview.innerHTML = q.words.map(w => `<span class="word-chip-preview">${escapeHtml(w)}</span>`).join('');
  } else if (q.type === 'estimation') {
    estimationPreview.classList.remove('hidden');
    document.getElementById('estimation-submissions').innerHTML = '';
    document.getElementById('correct-value').textContent = `${q.correct_value} ${q.unit || ''}`;
  }
  setStep('idle');
});

// ── Step buttons ──────────────────────────────────────────────────────────────
document.getElementById('btn-send-question').addEventListener('click', () => socket.emit('send-question', { code }));
document.getElementById('btn-show-answers').addEventListener('click', () => socket.emit('show-answers', { code }));
document.getElementById('btn-reveal').addEventListener('click', () => socket.emit('reveal-answer', { code }));
document.getElementById('btn-next').addEventListener('click', () => socket.emit('next-question', { code }));

socket.on('host-step', ({ step }) => {
  if (step === 'question-sent') setStep('sent');
  if (step === 'answers-shown') setStep('answering');
});

// ── Answers log ───────────────────────────────────────────────────────────────
socket.on('answer-received', ({ teamId, isCorrect, points, answer }) => {
  const team = teams[teamId];
  if (!team) return;
  const row = document.createElement('div');
  row.className = `answer-log-row ${isCorrect ? 'correct-log' : 'wrong-log'}`;
  const display = currentQuestion?.type === 'multiple_choice' ? 'ABCD'[parseInt(answer)] || answer : answer;
  row.innerHTML = `
    <span class="answer-log-name">${escapeHtml(team.name)}</span>
    <span style="color:var(--text2);font-size:.8rem">${display}</span>
    <span class="answer-log-result ${isCorrect ? 'ok' : 'bad'}">${isCorrect ? `+${points}` : '✗'}</span>`;
  document.getElementById('answers-log').prepend(row);

  if (currentQuestion?.type === 'estimation') {
    const chip = document.createElement('div');
    chip.className = 'est-submission-chip';
    chip.textContent = `${team.name}: ${answer}`;
    document.getElementById('estimation-submissions').appendChild(chip);
  }
});

// ── Reveal ────────────────────────────────────────────────────────────────────
socket.on('answer-revealed', ({ correct, scores }) => {
  setStep('revealed');
  const cv = document.getElementById('correct-value');
  if (currentQuestion?.type === 'multiple_choice') cv.textContent = currentQuestion.answers[correct];
  else if (currentQuestion?.type === 'estimation') cv.textContent = `${correct} ${currentQuestion.unit || ''}`;
  else if (currentQuestion?.type === 'word_order') cv.textContent = correct.map(i => currentQuestion.words[i]).join(' → ');
  updateScoreboard('scoreboard', scores);
});

socket.on('scores-updated', ({ scores }) => updateScoreboard('scoreboard', scores));
socket.on('first-correct', ({ team, points }) => showBuzz(team, points));

// ── Round over ────────────────────────────────────────────────────────────────
socket.on('round-over', ({ scores, roundNum }) => {
  stopTimer();
  showScreen('screen-round-over');
  document.getElementById('round-over-badge').textContent = `Round ${roundNum} Complete!`;
  updateScoreboard('round-over-scoreboard', scores);

  // Build config panel for next round (same defaults)
  const allCats = [...new Set(allQuestions.map(q => q.category))];
  buildConfigPanel('ro-category-checkboxes', 'ro-type-radios', 'ro-match-count', allCats, 'multiple_choice');
});

// ── Game over ─────────────────────────────────────────────────────────────────
socket.on('game-over', ({ scores }) => {
  stopTimer();
  showScreen('screen-gameover');
  const top3 = scores.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  document.getElementById('final-podium').innerHTML = order.map(t => {
    const rank = t === top3[0] ? 1 : t === top3[1] ? 2 : 3;
    return `<div class="podium-item ${rank===1?'first':''}">
      <span class="podium-rank">${rankEmoji(rank-1)}</span>
      <span class="podium-name">${escapeHtml(t.name)}</span>
      <span class="podium-score">${t.score} pts</span>
    </div>`;
  }).join('');
});

// ── Scoreboard ────────────────────────────────────────────────────────────────
function updateScoreboard(elId, scores) {
  document.getElementById(elId).innerHTML = scores.map((t, i) => {
    const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    return `<div class="score-row" data-score-team="${t.id}">
      <span class="score-rank">${rankEmoji(i)}</span>
      <div class="score-avatar">
        <img src="${t.selfie||''}" alt="" class="${t.selfie?'':'hidden'}">
        <span class="init${t.selfie?' hidden':''}">${initials}</span>
      </div>
      <span class="score-name">${escapeHtml(t.name)}</span>
      <span class="score-pts">${t.score}</span>
      <div class="score-adj">
        <button onclick="adjustScore('${t.id}',50)">+</button>
        <button onclick="adjustScore('${t.id}',-50)">-</button>
      </div>
    </div>`;
  }).join('');
}

window.adjustScore = (teamId, delta) => socket.emit('adjust-score', { code, teamId, delta });

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer(seconds) {
  stopTimer();
  const fill = document.getElementById('timer-fill');
  fill.style.width = '100%'; fill.className = 'timer-fill';
  let remaining = seconds;
  timerInterval = setInterval(() => {
    remaining--;
    const pct = (remaining / seconds) * 100;
    fill.style.width = `${pct}%`;
    fill.className = 'timer-fill' + (pct < 30 ? ' danger' : pct < 60 ? ' warning' : '');
    if (remaining <= 0) stopTimer();
  }, 1000);
}
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

// ── Buzz ──────────────────────────────────────────────────────────────────────
function showBuzz(team, points) {
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('buzz-team-name').textContent = team.name;
  document.getElementById('buzz-points').textContent = `+${points} pts`;
  const img = document.getElementById('buzz-selfie');
  const init = document.getElementById('buzz-initials');
  if (team.selfie) { img.src = team.selfie; img.style.display = 'block'; init.textContent = ''; }
  else { img.style.display = 'none'; init.textContent = initials; }
  const overlay = document.getElementById('buzz-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 3500);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function rankEmoji(i) { return ['🥇','🥈','🥉'][i] || `${i+1}.`; }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
