const code = location.pathname.split('/').pop();
const hostToken = new URLSearchParams(location.search).get('token');
if (!hostToken) alert('Missing host token.');

const socket = io();
let timerInterval = null;
let currentQuestion = null;
let teams = {};
let allQuestions = []; // { index, category, type } — received from server
let currentRound = 0;

// ── Host-plays mode ───────────────────────────────────────────────────────────
let hostPlaysMode = false;
let hostTeamId = null;
let hostAnswered = false;
let hostAnswerStartTime = null;
let hostSubmittedAnswer = null;
let hostWasCorrect = false;

// Answer per team for the current question, shown in the scoreboard rows
let answerMarks = {};   // teamId -> { display, isCorrect }
let answersRevealed = false;

// TYPE_LABELS are built dynamically so they respect the active UI language
function getTypeLabels() {
  return {
    'multiple_choice': t('type_multiple_choice'),
    'word_order':      t('type_word_order'),
    'estimation':      t('type_estimation'),
    'truth_or_lie':    t('type_truth_or_lie'),
  };
}

// Apply translations and set active lang button on load
document.addEventListener('DOMContentLoaded', applyI18n);

// ── Screens ───────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'screen-enter'));
  const el = document.getElementById(id);
  if (!el) return;
  document.body.dataset.screen = id; // drives page layout and colour in host.css
  el.classList.add('active', 'screen-enter');
  el.addEventListener('animationend', () => el.classList.remove('screen-enter'), { once: true });
}

// ── Host button steps ─────────────────────────────────────────────────────────
function setStep(step) {
  ['btn-send-question','btn-replace','btn-show-answers','btn-next','btn-end-round'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  document.getElementById('correct-reveal').classList.add('hidden');
  document.body.dataset.step = step; // step bar + colour field

  if (step === 'idle')      { document.getElementById('btn-send-question').classList.remove('hidden'); document.getElementById('btn-replace').classList.remove('hidden'); }
  if (step === 'sent')      { document.getElementById('btn-show-answers').classList.remove('hidden'); document.getElementById('btn-end-round').classList.remove('hidden'); }
  if (step === 'answering') { document.getElementById('btn-end-round').classList.remove('hidden'); }
  if (step === 'revealed')  {
    const isLastQuestion = currentQuestion && (currentQuestion.roundIndex + 1 >= currentQuestion.roundTotal);
    if (!isLastQuestion) document.getElementById('btn-next').classList.remove('hidden');
    document.getElementById('btn-end-round').classList.remove('hidden');
    stopTimer();
    document.getElementById('correct-reveal').classList.remove('hidden');
  }
}

// ── Config panel ──────────────────────────────────────────────────────────────
function buildConfigPanel(checkboxesId, radiosId, countId, defaultCats, defaultType) {
  const categories = [...new Set(allQuestions.map(q => q.category))];
  const types = [...new Set(allQuestions.map(q => q.type))];

  // Category checkboxes
  document.getElementById(checkboxesId).innerHTML = categories.map(cat => `
    <label class="checkbox-label">
      <input type="checkbox" class="cat-cb" value="${cat}" ${defaultCats.includes(cat) ? 'checked' : ''}>
      <span>${cat}</span>
    </label>
  `).join('');

  // Type radios
  const typeLabels = getTypeLabels();
  document.getElementById(radiosId).innerHTML = types.map(tp => `
    <label class="radio-label">
      <input type="radio" name="${radiosId}" class="type-radio" value="${tp}" ${tp === defaultType ? 'checked' : ''}>
      <span>${typeLabels[tp] || tp}</span>
    </label>
  `).join('') + `
    <label class="radio-label disabled-option">
      <input type="radio" disabled>
      <span>Picture Puzzle <em>(${t('coming_soon')})</em></span>
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
  const countText = MPQ_LANG === 'de'
    ? `${count} Frage${count !== 1 ? 'n' : ''} passen zur Auswahl`
    : `${count} question${count !== 1 ? 's' : ''} match this selection`;
  document.getElementById(countId).textContent = countText;
  return { cats, type, count };
}

function getConfig(checkboxesId, radiosId, pointsCorrectId, pointsBonusId, pointsSpecialId, timeLimitId) {
  const cats = [...document.querySelectorAll(`#${checkboxesId} .cat-cb:checked`)].map(cb => cb.value);
  const typeEl = document.querySelector(`#${radiosId} .type-radio:checked`);
  const pointsCorrect = parseInt(document.getElementById(pointsCorrectId)?.value) || 1;
  const pointsBonus = parseInt(document.getElementById(pointsBonusId)?.value) || 0;
  const pointsSpecial = Math.max(0, parseInt(document.getElementById(pointsSpecialId)?.value) || 0);
  const timeLimitSecs = Math.max(5, Math.min(300, parseInt(document.getElementById(timeLimitId)?.value) || 20));
  return { categories: cats, questionType: typeEl?.value, pointsCorrect, pointsBonus, pointsSpecial, timeLimitSecs };
}

// ── Connect ───────────────────────────────────────────────────────────────────
// Register as host on every (re)connect. Phones drop the socket whenever the screen locks;
// after a reconnect the server only treats this socket as the host once host-join is sent again.
let hostJoinedBefore = false;
const reconnectBanner = document.getElementById('reconnect-banner');
socket.on('connect', () => {
  reconnectBanner.classList.add('hidden');
  socket.emit('host-join', { code, hostToken });
});
socket.on('disconnect', () => reconnectBanner.classList.remove('hidden'));
socket.on('error', ({ message }) => alert('Error: ' + message));

socket.on('host-joined', ({ event, teams: teamList, questions, hostTeamId: savedHostTeamId, reconnectState }) => {
  const firstJoin = !hostJoinedBefore;
  hostJoinedBefore = true;
  allQuestions = questions;
  document.getElementById('header-code').textContent = code;
  document.getElementById('lobby-code').textContent = code;
  document.getElementById('tv-link').href = `/tv/${code}`;

  // Restore host-plays state on reconnect
  if (savedHostTeamId) {
    hostTeamId = savedHostTeamId;
    hostPlaysMode = true;
    document.getElementById('host-plays-toggle').checked = true;
    document.getElementById('host-player-name').classList.remove('hidden');
  }

  const allCats = [...new Set(questions.map(q => q.category))];
  if (firstJoin) {
    const gameUrl = `${location.origin}/game/${code}`;
    document.getElementById('lobby-share-link').value = gameUrl;
    new QRCode(document.getElementById('lobby-qr'), {
      text: gameUrl, width: 180, height: 180, colorDark: '#161616', colorLight: '#ffffff'
    });
    buildConfigPanel('category-checkboxes', 'type-radios', 'match-count', allCats, 'multiple_choice');
  }

  teamList.forEach(t => addTeam(t));

  // Sync question language to the UI language (unless mid-game where it's locked in).
  // Only on the first join: on a reconnect it would rebuild the setup and lose the host's choices.
  if (firstJoin && event.status !== 'running' && event.status !== 'finished') {
    socket.emit('set-language', { code, lang: window.MPQ_LANG });
  }

  if (event.status === 'running') {
    showScreen('screen-game');
    if (reconnectState) restoreHostGame(reconnectState);
  } else if (event.status === 'round-over') {
    // On a reconnect between rounds the host stays where they were (standings or setup)
    if (firstJoin) {
      showScreen('screen-round-over');
      buildConfigPanel('ro-category-checkboxes', 'ro-type-radios', 'ro-match-count', allCats, 'multiple_choice');
    }
  } else if (event.status === 'finished') {
    showScreen('screen-gameover');
  } else if (firstJoin) {
    showScreen('screen-lobby');
  }
});

function restoreHostGame(rs) {
  const q = rs.currentQuestion;
  if (!q) return;

  currentQuestion = q;
  currentRound = (q.roundIndex ?? 0) + 1;
  const step = rs.currentStep;

  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-round-info').textContent = t('round_n', { n: currentRound });
  document.getElementById('q-progress').textContent = `${q.roundIndex + 1} / ${q.roundTotal}`;
  document.getElementById('q-type-badge').textContent = getTypeLabels()[q.type] || q.type;
  document.getElementById('timer-fill').style.width = '100%';
  document.getElementById('timer-fill').className = 'timer-fill';
  document.getElementById('answers-log').innerHTML = '';
  document.getElementById('host-distribution').classList.add('hidden');
  document.getElementById('host-answer-area').classList.add('hidden');
  document.getElementById('host-answer-feedback').classList.add('hidden');
  document.getElementById('answers-preview').classList.add('hidden');
  document.getElementById('words-preview').classList.add('hidden');
  document.getElementById('estimation-preview').classList.add('hidden');

  // Has the playing host already answered this question?
  const hostAnswer = hostTeamId ? rs.answers.find(a => a.teamId === hostTeamId) : null;
  hostAnswered = !!hostAnswer;
  hostSubmittedAnswer = hostAnswer ? hostAnswer.answer : null;
  hostWasCorrect = !!hostAnswer?.isCorrect;

  // Answers so far: scoreboard badges + log (hidden from a playing host until the reveal)
  answersRevealed = step === 'revealed';
  answerMarks = {};
  pendingLog = [];
  if (rs.scores) updateScoreboard('scoreboard', rs.scores);
  rs.answers.forEach(a => recordAnswer(a, false));

  // A playing host must not see the options or the correct answer before the reveal
  const showPreview = !hostPlaysMode || step === 'revealed';
  const showText = () => { document.getElementById('question-text').textContent = q.question; };

  if (step === 'question-text') {
    showPreview ? renderQuestionPreview(q) : showText();
    setStep('sent');
  } else if (step === 'answers-shown') {
    showPreview ? renderQuestionPreview(q) : showText();
    setStep('answering');
    if (rs.timerRemaining > 0) {
      const tl = q?.time_limit || rs.timerRemaining;
      const dl = rs.questionStartedAt ? rs.questionStartedAt + 3600 + tl * 1000 : (Date.now() + rs.timerRemaining * 1000);
      startTimer(tl, dl);
    }
    if (hostPlaysMode) {
      if (!hostAnswered) showHostAnswerOptions(q);
      else {
        document.getElementById('host-answer-area').classList.remove('hidden');
        document.getElementById('host-answer-options').innerHTML = '';
        showHostAnswerFeedback(t('locked_in_host'));
      }
    }
  } else if (step === 'revealed') {
    renderQuestionPreview(q);
    const cv = document.getElementById('correct-value');
    if (q.type === 'multiple_choice') cv.textContent = q.answers[rs.correct];
    else if (q.type === 'truth_or_lie') cv.textContent = rs.correct === 0 ? t('truth_btn') : t('lie_btn');
    else if (q.type === 'estimation') cv.textContent = `${rs.correct} ${q.unit || ''}`;
    else if (q.type === 'word_order') cv.textContent = rs.correct.map(i => q.words[i]).join(' → ');
    renderHostDistribution(rs.distribution);
    setStep('revealed');
  } else {
    // step is null — question arrived at host but not yet sent to players
    if (showPreview) renderQuestionPreview(q);
    else document.getElementById('question-text').textContent = t('question_ready_host');
    setStep('idle');
  }
}

// ── Language selector ─────────────────────────────────────────────────────────
socket.on('language-changed', ({ questions }) => {
  allQuestions = questions;
  const allCats = [...new Set(questions.map(q => q.category))];
  buildConfigPanel('category-checkboxes', 'type-radios', 'match-count', allCats, 'multiple_choice');
  buildConfigPanel('ro-category-checkboxes', 'ro-type-radios', 'ro-match-count', allCats, 'multiple_choice');
});

// ── Host-plays toggle ─────────────────────────────────────────────────────────
document.getElementById('host-plays-toggle').addEventListener('change', (e) => {
  hostPlaysMode = e.target.checked;
  document.getElementById('host-player-name').classList.toggle('hidden', !hostPlaysMode);
  document.getElementById('host-selfie-area').classList.toggle('hidden', !hostPlaysMode);
  if (hostPlaysMode) document.getElementById('host-player-name').focus();
});

document.getElementById('host-player-name').addEventListener('blur', () => {
  if (!hostPlaysMode || hostTeamId) return;
  const name = document.getElementById('host-player-name').value.trim();
  if (name) socket.emit('host-register-player', { code, playerName: name });
});

document.getElementById('host-selfie-btn').addEventListener('click', () => {
  document.getElementById('host-selfie-input').click();
});

let hostSelfieFile = null;

document.getElementById('host-selfie-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  hostSelfieFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById('host-selfie-preview');
    preview.src = ev.target.result;
    preview.classList.remove('hidden');
    document.getElementById('host-selfie-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

function resizeImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Server confirms host team ─────────────────────────────────────────────────
socket.on('host-team-created', ({ teamId }) => {
  hostTeamId = teamId;
  if (hostSelfieFile) {
    resizeImage(hostSelfieFile, 800, 800, 0.8).then(base64 => {
      return fetch(`/api/team/${teamId}/selfie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 })
      });
    }).catch(() => {}); // non-critical
    hostSelfieFile = null;
  }
});

document.getElementById('lobby-copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('lobby-share-link').value);
  const btn = document.getElementById('lobby-copy-btn');
  btn.textContent = t('copied_btn'); setTimeout(() => { btn.textContent = t('copy_host_btn'); }, 2000);
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
  const { categories, questionType, pointsCorrect, pointsBonus, pointsSpecial, timeLimitSecs } = getConfig('category-checkboxes', 'type-radios', 'pts-correct', 'pts-bonus', 'pts-special', 'time-limit');
  if (!categories.length || !questionType) return;
  // Only send hostPlayerName if playing and team not yet created
  const hostPlayerName = (hostPlaysMode && !hostTeamId)
    ? document.getElementById('host-player-name').value.trim() : null;
  if (hostPlaysMode && !hostTeamId && !hostPlayerName) {
    document.getElementById('host-player-name').focus(); return;
  }
  socket.emit('start-round', { code, categories, questionType, pointsCorrect, pointsBonus, pointsSpecial, timeLimitSecs,
    ...(hostPlayerName ? { hostPlayerName } : {}) });
});

document.getElementById('btn-next-round').addEventListener('click', () => {
  const { categories, questionType, pointsCorrect, pointsBonus, pointsSpecial, timeLimitSecs } = getConfig('ro-category-checkboxes', 'ro-type-radios', 'ro-pts-correct', 'ro-pts-bonus', 'ro-pts-special', 'ro-time-limit');
  if (!categories.length || !questionType) return;
  socket.emit('start-round', { code, categories, questionType, pointsCorrect, pointsBonus, pointsSpecial, timeLimitSecs });
});

document.getElementById('btn-show-scoreboard').addEventListener('click', () => {
  socket.emit('show-scoreboard', { code });
});

document.getElementById('btn-end-round').addEventListener('click', () => {
  showConfirm(t('confirm_end_round'), () => socket.emit('end-round', { code }));
});

document.getElementById('btn-final-end').addEventListener('click', () => {
  showConfirm(t('confirm_end_game'), () => socket.emit('end-game', { code }));
});

// ── Round started ─────────────────────────────────────────────────────────────
socket.on('round-started', ({ roundNum }) => {
  currentRound = roundNum;
  showScreen('screen-game');
});

// ── Question (host only) ──────────────────────────────────────────────────────
socket.on('question-host', (q) => {
  currentQuestion = q;
  hostAnswered = false;
  hostSubmittedAnswer = null;
  hostWasCorrect = false;
  Sounds.questionStart();

  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-round-info').textContent = t('round_n', { n: currentRound });
  document.getElementById('q-progress').textContent = `${q.roundIndex + 1} / ${q.roundTotal}`;
  document.getElementById('q-type-badge').textContent = getTypeLabels()[q.type] || q.type;
  document.getElementById('answers-log').innerHTML = '';
  document.getElementById('host-distribution').classList.add('hidden');
  document.getElementById('host-distribution').innerHTML = '';
  document.getElementById('timer-fill').style.width = '100%';
  document.getElementById('timer-fill').className = 'timer-fill';
  document.getElementById('answers-preview').classList.add('hidden');
  document.getElementById('words-preview').classList.add('hidden');
  document.getElementById('estimation-preview').classList.add('hidden');
  document.getElementById('host-answer-area').classList.add('hidden');
  document.getElementById('host-answer-feedback').classList.add('hidden');
  document.getElementById('host-your-answer').classList.add('hidden');
  document.getElementById('host-flag-btn').classList.add('hidden');

  answerMarks = {};
  answersRevealed = false;
  pendingLog = [];
  ensureScoreboard();
  ['buzz-overlay', 'lone-hero-overlay', 'precise-overlay', 'worst-overlay'].forEach(id => document.getElementById(id).classList.add('hidden'));

  if (hostPlaysMode) {
    // Hide question content until it's sent to players
    document.getElementById('question-text').textContent = t('question_ready_host');
  } else {
    renderQuestionPreview(q);
  }
  setStep('idle');
});

// Renders question text + answer options in the host preview panel.
// In play mode only called after reveal (shows correct answer then).
function renderQuestionPreview(q) {
  document.getElementById('question-text').textContent = q.question;
  if (q.type === 'multiple_choice') {
    const el = document.getElementById('answers-preview');
    el.classList.remove('hidden');
    el.innerHTML = q.answers.map((a, i) => `
      <div class="answer-option${i === q.correct ? ' correct' : ''}">
        <span class="answer-letter">${'ABCD'[i]}</span><span class="answer-text">${escapeHtml(a)}</span>${i === q.correct ? `<span class="answer-correct-tag">${escapeHtml(t('correct_tag'))}</span>` : ''}
      </div>`).join('');
  } else if (q.type === 'truth_or_lie') {
    const el = document.getElementById('answers-preview');
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="answer-option tol-preview-option${q.correct === 0 ? ' correct' : ''}">
        <span class="answer-text">${escapeHtml(t('truth_btn'))}</span>${q.correct === 0 ? `<span class="answer-correct-tag">${escapeHtml(t('correct_tag'))}</span>` : ''}
      </div>
      <div class="answer-option tol-preview-option${q.correct === 1 ? ' correct' : ''}">
        <span class="answer-text">${escapeHtml(t('lie_btn'))}</span>${q.correct === 1 ? `<span class="answer-correct-tag">${escapeHtml(t('correct_tag'))}</span>` : ''}
      </div>`;
  } else if (q.type === 'word_order') {
    const el = document.getElementById('words-preview');
    el.classList.remove('hidden');
    el.innerHTML = q.words.map(w => `<span class="word-chip-preview">${escapeHtml(w)}</span>`).join('');
  } else if (q.type === 'estimation') {
    const el = document.getElementById('estimation-preview');
    el.classList.remove('hidden');
    document.getElementById('estimation-submissions').innerHTML = '';
    document.getElementById('correct-value').textContent = `${q.correct_value} ${q.unit || ''}`;
  }
}

// ── Host answer submission (playing mode) ─────────────────────────────────────
function showHostAnswerOptions(q) {
  const area = document.getElementById('host-answer-area');
  const opts = document.getElementById('host-answer-options');
  area.classList.remove('hidden');
  document.getElementById('host-answer-feedback').classList.add('hidden');
  hostAnswerStartTime = Date.now();

  if (q.type === 'multiple_choice') {
    const shuffled = [...q.answers.keys()].sort(() => Math.random() - 0.5);
    opts.innerHTML = shuffled.map((origIdx, pos) => `
      <button class="host-answer-btn" data-index="${origIdx}">
        <span class="answer-letter">${'ABCD'[pos]}</span>
        <span>${escapeHtml(q.answers[origIdx])}</span>
      </button>`).join('');
    opts.querySelectorAll('.host-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (hostAnswered) return;
        hostAnswered = true;
        hostSubmittedAnswer = String(btn.dataset.index);
        opts.querySelectorAll('.host-answer-btn').forEach(b => b.disabled = true);
        btn.classList.add('host-answer-selected');
        Sounds.submit();
        socket.emit('host-submit-answer', { code, answer: hostSubmittedAnswer,
          timeTaken: Date.now() - hostAnswerStartTime });
        showHostAnswerFeedback(t('locked_in_host'));
      });
    });

  } else if (q.type === 'estimation') {
    opts.innerHTML = `
      <div class="host-est-row">
        <input type="number" id="host-est-input" class="host-est-input" placeholder="Your estimate...">
        <span class="host-est-unit">${escapeHtml(q.unit || '')}</span>
        <button class="btn btn-primary" id="host-est-submit">Submit</button>
      </div>`;
    document.getElementById('host-est-submit').addEventListener('click', () => {
      if (hostAnswered) return;
      const val = document.getElementById('host-est-input').value.trim();
      if (!val || isNaN(val)) { document.getElementById('host-est-input').focus(); return; }
      hostAnswered = true;
      hostSubmittedAnswer = val;
      document.getElementById('host-est-submit').disabled = true;
      Sounds.submit();
      socket.emit('host-submit-answer', { code, answer: val,
        timeTaken: Date.now() - hostAnswerStartTime });
      showHostAnswerFeedback(t('submitted_val', { val, unit: q.unit || '' }));
    });

  } else if (q.type === 'truth_or_lie') {
    opts.innerHTML = `
      <div class="host-tol-btns">
        <button class="tol-btn tol-truth host-tol-btn" data-index="0">${t('truth_btn')}</button>
        <button class="tol-btn tol-lie   host-tol-btn" data-index="1">${t('lie_btn')}</button>
      </div>`;
    opts.querySelectorAll('.host-tol-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (hostAnswered) return;
        hostAnswered = true;
        hostSubmittedAnswer = String(btn.dataset.index);
        opts.querySelectorAll('.host-tol-btn').forEach(b => b.disabled = true);
        btn.classList.add('host-answer-selected');
        Sounds.submit();
        socket.emit('host-submit-answer', { code, answer: hostSubmittedAnswer,
          timeTaken: Date.now() - hostAnswerStartTime });
        showHostAnswerFeedback(t('locked_in_host'));
      });
    });

  } else if (q.type === 'word_order') {
    let wordOrder = [];
    opts.innerHTML = `
      <div class="host-wo-zone" id="host-wo-zone"><span class="wo-hint">${t('tap_words')}</span></div>
      <div class="host-wo-chips" id="host-wo-chips"></div>
      <button class="btn btn-primary" id="host-wo-submit" style="margin-top:0.5rem">${t('submit_order')}</button>`;
    const chipsEl = document.getElementById('host-wo-chips');
    const zoneEl  = document.getElementById('host-wo-zone');

    [...q.words.keys()].sort(() => Math.random() - 0.5).forEach(origIdx => {
      const chip = document.createElement('div');
      chip.className = 'host-wo-chip';
      chip.textContent = q.words[origIdx];
      chip.dataset.wordIndex = origIdx;
      chip.addEventListener('click', () => {
        if (hostAnswered) return;
        if (chip.classList.contains('in-zone')) {
          wordOrder = wordOrder.filter(i => i !== origIdx);
          chip.classList.remove('in-zone');
          chipsEl.appendChild(chip);
        } else {
          wordOrder.push(origIdx);
          chip.classList.add('in-zone');
          zoneEl.querySelector('.wo-hint')?.remove();
          zoneEl.appendChild(chip);
        }
      });
      chipsEl.appendChild(chip);
    });

    document.getElementById('host-wo-submit').addEventListener('click', () => {
      if (hostAnswered) return;
      if (wordOrder.length !== q.words.length) return;
      hostAnswered = true;
      hostSubmittedAnswer = JSON.stringify(wordOrder);
      document.getElementById('host-wo-submit').disabled = true;
      Sounds.submit();
      socket.emit('host-submit-answer', { code, answer: hostSubmittedAnswer,
        timeTaken: Date.now() - hostAnswerStartTime });
      showHostAnswerFeedback(t('order_submitted'));
    });
  }
}

function showHostAnswerFeedback(text) {
  const fb = document.getElementById('host-answer-feedback');
  fb.textContent = text;
  fb.classList.remove('hidden');
}

// ── Step buttons ──────────────────────────────────────────────────────────────
document.getElementById('btn-send-question').addEventListener('click', () => socket.emit('send-question', { code }));
document.getElementById('btn-replace').addEventListener('click', () => socket.emit('replace-question', { code }));
document.getElementById('btn-show-answers').addEventListener('click', () => socket.emit('show-answers', { code }));
document.getElementById('btn-next').addEventListener('click', () => socket.emit('next-question', { code }));

socket.on('host-step', ({ step, startedAt }) => {
  if (step === 'question-sent') {
    setStep('sent');
    if (hostPlaysMode && currentQuestion) {
      // Now reveal question text — same moment as players
      document.getElementById('question-text').textContent = currentQuestion.question;
      if (currentQuestion.type === 'estimation') {
        // Show the estimation preview shell but NOT the correct value yet
        const el = document.getElementById('estimation-preview');
        el.classList.remove('hidden');
        document.getElementById('estimation-submissions').innerHTML = '';
        document.getElementById('correct-value').textContent = '';
      }
    }
  }
  if (step === 'answers-shown') {
    setStep('answering');
    // Delay matches the 3-2-1-GO countdown on player screens (4 × 900ms = 3600ms)
    [900, 1800, 2700].forEach(ms => setTimeout(() => Sounds.countdownTick(), ms));
    setTimeout(() => Sounds.countdownGo(), 3600);
    const _tl = currentQuestion?.time_limit || 20;
    setTimeout(() => startTimer(_tl, null), 3600);
    // For estimation + truth_or_lie, question-sent is skipped — reveal question text here instead
    if (currentQuestion?.type === 'estimation' || currentQuestion?.type === 'truth_or_lie') {
      document.getElementById('question-text').textContent = currentQuestion.question;
      document.getElementById('correct-value').textContent = '';
      if (currentQuestion.type === 'estimation' && !hostPlaysMode) {
        const el = document.getElementById('estimation-preview');
        el.classList.remove('hidden');
        document.getElementById('estimation-submissions').innerHTML = '';
      }
    }
    if (hostPlaysMode && currentQuestion && !hostAnswered) {
      // Show 3-2-1-GO countdown before unlocking answers, same timing as players
      const area = document.getElementById('host-answer-area');
      const opts = document.getElementById('host-answer-options');
      area.classList.remove('hidden');
      document.getElementById('host-answer-feedback').classList.add('hidden');
      let count = 3;
      opts.innerHTML = `<div class="host-countdown">${count}</div>`;
      const cdInterval = setInterval(() => {
        count--;
        if (count > 0) {
          opts.innerHTML = `<div class="host-countdown">${count}</div>`;
        } else if (count === 0) {
          opts.innerHTML = `<div class="host-countdown host-countdown-go">GO</div>`;
        } else {
          clearInterval(cdInterval);
          showHostAnswerOptions(currentQuestion);
        }
      }, 900);
    }
  }
});

// ── Answers log ───────────────────────────────────────────────────────────────
socket.on('answer-received', a => recordAnswer(a, true));

// Answers the playing host may only see after the reveal (all question types)
let pendingLog = [];

// One team's answer: scoreboard badge, answer log row, estimation chip.
// A playing host sees only that a team has answered, not what, until the reveal.
function recordAnswer({ teamId, isCorrect, points, answer }, live) {
  const team = teams[teamId];
  if (!team) return;
  if (teamId === hostTeamId && isCorrect) hostWasCorrect = true;
  answerMarks[teamId] = { answer, isCorrect };
  const entry = { teamId, isCorrect, points, answer };
  if (isHiddenFromHost(teamId)) pendingLog.push(entry);
  else appendLogRow(entry, live);
  refreshScoreboardMarks();
}

function isHiddenFromHost(teamId) {
  return hostPlaysMode && !answersRevealed && teamId !== hostTeamId;
}

function appendLogRow({ teamId, isCorrect, points, answer }, atTop) {
  const team = teams[teamId];
  if (!team) return;
  const row = document.createElement('div');
  row.className = `answer-log-row ${isCorrect ? 'correct-log' : 'wrong-log'}`;
  row.innerHTML = `
    <span class="answer-log-name">${escapeHtml(team.name)}</span>
    <span class="answer-log-answer">${escapeHtml(shortAnswer(answer) || '')}</span>
    <span class="answer-log-result ${isCorrect ? 'ok' : 'bad'}">${isCorrect ? `+${points}` : '0'}</span>`;
  const log = document.getElementById('answers-log');
  atTop ? log.prepend(row) : log.appendChild(row);

  if (currentQuestion?.type === 'estimation' && !answersRevealed) {
    const chip = document.createElement('div');
    chip.className = 'est-submission-chip';
    chip.textContent = `${team.name}: ${answer}`;
    document.getElementById('estimation-submissions').appendChild(chip);
  }
}

// ── Reveal ────────────────────────────────────────────────────────────────────
socket.on('answer-revealed', ({ correct, scores, distribution, estimationWinnerIds }) => {
  answersRevealed = true;
  pendingLog.forEach(entry => appendLogRow(entry, true));
  pendingLog = [];
  if (currentQuestion?.type === 'estimation') {
    // An estimate is only "correct" once the closest team(s) are known
    Object.keys(answerMarks).forEach(id => { answerMarks[id].isCorrect = estimationWinnerIds?.includes(id) ?? false; });
  }
  setStep('revealed');
  const cv = document.getElementById('correct-value');
  if (currentQuestion?.type === 'multiple_choice') cv.textContent = currentQuestion.answers[correct];
  else if (currentQuestion?.type === 'truth_or_lie') cv.textContent = correct === 0 ? t('truth_btn') : t('lie_btn');
  else if (currentQuestion?.type === 'estimation') cv.textContent = `${correct} ${currentQuestion.unit || ''}`;
  else if (currentQuestion?.type === 'word_order') cv.textContent = correct.map(i => currentQuestion.words[i]).join(' → ');
  updateScoreboard('scoreboard', scores);
  // Playing host sees the same number-line chart as players (no names/values leaked pre-reveal)
  if (hostPlaysMode && distribution?.type === 'estimation') {
    renderHostDistributionNumberLine(distribution);
  } else {
    renderHostDistribution(distribution);
  }

  if (hostPlaysMode && currentQuestion) {
    if (currentQuestion.type === 'estimation' && hostTeamId)
      hostWasCorrect = estimationWinnerIds?.includes(hostTeamId) ?? false;
    if (hostAnswered) hostWasCorrect ? Sounds.correct() : Sounds.wrong();
    // Show the full answer preview with correct answer highlighted
    renderQuestionPreview(currentQuestion);
    document.getElementById('host-answer-area').classList.add('hidden');

    // Show "Your Answer" label
    const yourAnswerEl = document.getElementById('host-your-answer');
    if (yourAnswerEl && hostSubmittedAnswer !== null) {
      let yourText = '';
      if (currentQuestion.type === 'multiple_choice') {
        yourText = t('your_answer_label') + ': ' + (currentQuestion.answers[parseInt(hostSubmittedAnswer)] ?? hostSubmittedAnswer);
      } else if (currentQuestion.type === 'truth_or_lie') {
        yourText = parseInt(hostSubmittedAnswer) === 0 ? t('tol_your_truth') : t('tol_your_lie');
      } else if (currentQuestion.type === 'estimation') {
        yourText = t('your_answer_label') + ': ' + hostSubmittedAnswer + (currentQuestion.unit ? ' ' + currentQuestion.unit : '');
      } else if (currentQuestion.type === 'word_order') {
        try {
          const order = JSON.parse(hostSubmittedAnswer);
          yourText = t('your_answer_label') + ': ' + order.map(i => currentQuestion.words[i]).join(' → ');
        } catch (e) {}
      }
      yourAnswerEl.textContent = yourText;
      yourAnswerEl.classList.remove('hidden');
    } else if (yourAnswerEl) {
      yourAnswerEl.classList.add('hidden');
    }

    // Show flag button on reveal
    const hostFlagBtn = document.getElementById('host-flag-btn');
    if (hostFlagBtn) {
      hostFlagBtn.classList.remove('hidden');
      hostFlagBtn.textContent = t('report_issue');
      hostFlagBtn.disabled = false;
    }
  }
});

// ── Host flag question (playing mode) ─────────────────────────────────────────
const hostFlagBtn    = document.getElementById('host-flag-btn');
const hostFlagModal  = document.getElementById('host-flag-modal');
const hostFlagCancel = document.querySelector('#host-flag-modal .flag-cancel');

hostFlagBtn.addEventListener('click', () => hostFlagModal.classList.remove('hidden'));
hostFlagCancel.addEventListener('click', () => hostFlagModal.classList.add('hidden'));
hostFlagModal.addEventListener('click', e => { if (e.target === hostFlagModal) hostFlagModal.classList.add('hidden'); });

document.querySelectorAll('#host-flag-modal .flag-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const reason = btn.dataset.reason;
    if (!currentQuestion) return;
    socket.emit('flag-question', {
      sourceId:     currentQuestion.source_id ?? null,
      lang:         currentQuestion.language ?? null,
      questionText: currentQuestion.question,
      reason,
    });
    hostFlagModal.classList.add('hidden');
    hostFlagBtn.textContent = t('reported');
    hostFlagBtn.disabled = true;
  });
});

function renderHostDistribution(dist) {
  const el = document.getElementById('host-distribution');
  if (!dist || !el) return;
  el.classList.remove('hidden');

  if (dist.type === 'multiple_choice') {
    const max = Math.max(...dist.counts, 1);
    el.innerHTML = dist.labels.map((label, i) => {
      const count = dist.counts[i];
      const pct = Math.round((count / max) * 100);
      const isCorrect = i === dist.correct;
      return `<div class="host-dist-row ${isCorrect ? 'host-dist-correct' : ''}">
        <span class="host-dist-label">${escapeHtml(label)}</span>
        <div class="host-dist-bar-wrap">
          <div class="host-dist-bar" style="width:${pct}%"></div>
        </div>
        <span class="host-dist-count">${count}</span>
      </div>`;
    }).join('');
  } else if (dist.type === 'estimation') {
    el.innerHTML = dist.submissions.map(s => `
      <div class="host-dist-est-row ${s.value === dist.correctValue ? 'host-dist-correct' : ''}">
        <span>${escapeHtml(s.name)}</span>
        <span>${s.value} ${dist.unit}</span>
      </div>`).join('') || `<span style="color:var(--text2);font-size:.85rem">${t('no_submissions')}</span>`;
  } else if (dist.type === 'word_order') {
    const pct = dist.total ? Math.round((dist.correct / dist.total) * 100) : 0;
    el.innerHTML = `<div class="host-dist-wo">
      <div class="host-dist-wo-bar">
        <div class="host-dist-wo-fill" style="width:${pct}%"></div>
      </div>
      <span class="host-dist-wo-text">${escapeHtml(t('got_right', { n: dist.correct }))} · ${escapeHtml(t('got_wrong', { n: dist.wrong }))}</span>
    </div>`;
  } else if (dist.type === 'truth_or_lie') {
    const max = Math.max(...dist.counts, 1);
    el.innerHTML = [t('truth_btn'), t('lie_btn')].map((label, i) => `<div class="host-dist-row ${i === dist.correct ? 'host-dist-correct' : ''}">
        <span class="host-dist-label">${escapeHtml(label)}</span>
        <div class="host-dist-bar-wrap"><div class="host-dist-bar" style="width:${Math.round((dist.counts[i] / max) * 100)}%"></div></div>
        <span class="host-dist-count">${dist.counts[i]}</span>
      </div>`).join('');
  }
}

function renderHostDistributionNumberLine(dist) {
  const el = document.getElementById('host-distribution');
  if (!dist || !el) return;
  if (!dist.submissions.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const values  = dist.submissions.map(s => s.value);
  const allVals = [...values, dist.correctValue];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const pos = v => Math.round(((v - min) / range) * 100);
  el.innerHTML = `
    <div class="dist-numberline">
      <div class="dist-nl-track">
        <div class="dist-nl-correct" style="left:${pos(dist.correctValue)}%" title="Correct: ${dist.correctValue}"></div>
        ${dist.submissions.map(s => `
          <div class="dist-nl-dot ${s.value === dist.correctValue ? 'dist-nl-winner' : ''}"
               style="left:${pos(s.value)}%"
               title="${escapeHtml(s.name)}: ${s.value}">
          </div>`).join('')}
      </div>
      <div class="dist-nl-labels">
        ${dist.submissions.map(s => `
          <div class="dist-nl-chip ${s.value === dist.correctValue ? 'dist-nl-winner' : ''}"
               style="left:${pos(s.value)}%">
            ${s.value}
          </div>`).join('')}
      </div>
    </div>
    <div class="dist-nl-legend">
      <span class="dist-nl-correct-label">${escapeHtml(t('answer_label', { value: dist.correctValue, unit: dist.unit || '' }))}</span>
    </div>`;
}

socket.on('scores-updated', ({ scores }) => {
  updateScoreboard('scoreboard', scores);
  updateScoreboard('round-over-scoreboard', scores);
});
socket.on('first-correct', ({ team, points, questionType }) => {
  const label = questionType === 'estimation' ? t('best_estimate_label') : t('first_correct_label');
  showBuzz(team, points, label);
  Sounds.firstCorrect();
});

// ── Round over ────────────────────────────────────────────────────────────────
socket.on('round-over', ({ scores, roundNum }) => {
  stopTimer();

  // Show standings screen first
  document.getElementById('host-standings-badge').textContent = t('round_complete', { num: roundNum });
  const _standRanks = assignRanks(scores);
  document.getElementById('host-standings-scores').innerHTML = scores.map((team, i) => {
    const rank = rankLabel(_standRanks[i]);
    const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    const avatarHtml = team.selfie
      ? `<img src="${escapeHtml(team.selfie)}" alt="">`
      : `<span class="init">${initials}</span>`;
    return `<div class="score-row">
      <span class="score-rank">${rank}</span>
      <div class="score-avatar">${avatarHtml}</div>
      <span class="score-name">${escapeHtml(team.name)}</span>
      <span class="score-pts">${team.score}</span>
    </div>`;
  }).join('');
  showScreen('screen-host-standings');

  // Pre-build config panel in background so it's ready when host clicks Keep Playing
  updateScoreboard('round-over-scoreboard', scores);
  document.getElementById('round-over-badge').textContent = t('round_complete', { num: roundNum });
  const allCats = [...new Set(allQuestions.map(q => q.category))];
  buildConfigPanel('ro-category-checkboxes', 'ro-type-radios', 'ro-match-count', allCats, 'multiple_choice');
});

document.getElementById('btn-keep-playing').addEventListener('click', () => {
  showScreen('screen-round-over');
});

document.getElementById('btn-end-game-standings').addEventListener('click', () => {
  showConfirm(t('confirm_end_game'), () => socket.emit('end-game', { code }));
});

// ── Game over ─────────────────────────────────────────────────────────────────
socket.on('game-over', ({ scores }) => {
  stopTimer();
  showScreen('screen-gameover');

  const top3 = scores.slice(0, 3);
  // Classic Olympic layout: 2nd left, 1st centre, 3rd right
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const _goRanks = assignRanks(scores);
  const posOf = t => scores.indexOf(t) + 1;
  const rankOf = t => _goRanks[scores.indexOf(t)];
  const blockHeights = { 1: 140, 2: 95, 3: 65 };
  const blockDelays  = { 1: 1.3, 2: 0.7, 3: 0.4 };
  const entryDelays  = { 1: 1.45, 2: 0.85, 3: 0.5 };

  let html = `<div class="podium-stage">
    <div class="podium-entries">`;

  for (const t of podiumOrder) {
    const pos = posOf(t);
    const rank = rankOf(t);
    const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    html += `
      <div class="podium-entry p${pos}" style="--entry-delay:${entryDelays[pos]}s">
        <div class="podium-avatar">
          ${t.selfie ? `<img src="${escapeHtml(t.selfie)}" alt="">` : `<span>${escapeHtml(initials)}</span>`}
        </div>
        <div class="podium-name">${escapeHtml(t.name)}</div>
        <div class="podium-score">${t.score} ${t_('pts_short')}</div>
      </div>`;
  }

  html += `</div><div class="podium-blocks">`;
  for (const t of podiumOrder) {
    const pos = posOf(t);
    const rank = rankOf(t);
    html += `<div class="podium-block b${pos}" style="--block-height:${blockHeights[pos]}px;--block-delay:${blockDelays[pos]}s">${rankLabel(rank)}</div>`;
  }
  html += `</div></div>`;

  // Full standings below podium
  html += `<div class="podium-all-scores">` +
    scores.map((t, i) => `
      <div class="podium-score-row ${i === 0 ? 'winner' : ''}">
        <span class="psr-rank">${rankLabel(_goRanks[i])}</span>
        <span class="psr-name">${escapeHtml(t.name)}</span>
        <span class="psr-pts">${t.score}</span>
      </div>`).join('') +
    `</div>`;

  document.getElementById('final-podium').innerHTML = html;

  // Staggered: fanfare when 1st place block starts rising, confetti just after
  setTimeout(() => Sounds.victory(), 1300);
  setTimeout(() => Sounds.launchConfetti(), 1500);
});

// ── Scoreboard ────────────────────────────────────────────────────────────────
function updateScoreboard(elId, scores) {
  const _ranks = assignRanks(scores);
  document.getElementById(elId).innerHTML = scores.map((t, i) => {
    const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    return `<div class="score-row" data-score-team="${t.id}">
      <span class="score-rank">${rankLabel(_ranks[i])}</span>
      <div class="score-avatar">
        <img src="${t.selfie||''}" alt="" class="${t.selfie?'':'hidden'}">
        <span class="init${t.selfie?' hidden':''}">${initials}</span>
      </div>
      <span class="score-name">${escapeHtml(t.name)}</span>
      <span class="score-answer" data-answer-for="${t.id}"></span>
      <span class="score-pts">${t.score}</span>
      <div class="score-adj">
        <button onclick="adjustScore('${t.id}',-1)" aria-label="-1">−</button>
        <button onclick="adjustScore('${t.id}',1)" aria-label="+1">+</button>
      </div>
    </div>`;
  }).join('');
  if (elId === 'scoreboard') refreshScoreboardMarks();
}

window.adjustScore = (teamId, delta) => socket.emit('adjust-score', { code, teamId, delta });

window.setHostLang = function (lang) {
  setLang(lang);
  socket.emit('set-language', { code, lang });
};

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer(seconds, deadline) {
  stopTimer();
  const fill = document.getElementById('timer-fill');
  fill.style.width = '100%'; fill.className = 'timer-fill';
  const end = deadline ?? (Date.now() + seconds * 1000);
  timerInterval = setInterval(() => {
    const remainingMs = end - Date.now();
    const remaining = Math.max(0, remainingMs / 1000);
    const pct = Math.min(100, Math.max(0, (remaining / seconds) * 100));
    fill.style.width = `${pct}%`;
    fill.className = 'timer-fill' + (pct < 30 ? ' danger' : pct < 60 ? ' warning' : '');
    if (remaining <= 3 && remaining > 0) Sounds.urgentTick();
    else if (pct < 60 && remaining > 0) Sounds.tick();
    if (remainingMs <= 0) stopTimer();
  }, 1000);
}
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

// ── Buzz ──────────────────────────────────────────────────────────────────────
function showBuzz(team, points, label) {
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('buzz-team-name').textContent = team.name;
  const buzzPts = document.getElementById('buzz-points');
  buzzPts.textContent = points > 0 ? `+${points} ${t('pts_short')}` : '';
  buzzPts.style.display = points > 0 ? '' : 'none';
  if (label) document.querySelector('#buzz-overlay .buzz-label').textContent = label;
  const img = document.getElementById('buzz-selfie');
  const init = document.getElementById('buzz-initials');
  if (team.selfie) { img.src = team.selfie; img.style.display = 'block'; init.textContent = ''; }
  else { img.style.display = 'none'; init.textContent = initials; }
  const overlay = document.getElementById('buzz-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 3500);
}

// ── Special animations ────────────────────────────────────────────────────────
socket.on('lone-hero', ({ team, points }) => { showSpecialOverlay('lone-hero-overlay', 'lone-hero-team', 'lone-hero-points', team, points); Sounds.soloCorrect(); });
socket.on('precise-estimate', ({ team, points }) => showSpecialOverlay('precise-overlay', 'precise-team', 'precise-points', team, points));
socket.on('worst-estimate', ({ team }) => { showSpecialOverlay('worst-overlay', 'worst-team', null, team, 0); Sounds.offTheCharts(); });

function showSpecialOverlay(overlayId, teamId, ptsId, team, points) {
  document.getElementById(teamId).textContent = team.name;
  if (ptsId) document.getElementById(ptsId).textContent = points > 0 ? `+${points} ${t('pts_short')}` : '';
  const img   = document.getElementById(overlayId + '-selfie');
  const inits = document.getElementById(overlayId + '-initials');
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  if (team.selfie) { img.src = team.selfie; img.style.display = 'block'; inits.textContent = ''; }
  else             { img.style.display = 'none'; inits.textContent = initials; }
  const overlay = document.getElementById(overlayId);
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 4000);
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function showConfirm(message, onConfirm) {
  const modal  = document.getElementById('confirm-modal');
  const msgEl  = document.getElementById('confirm-message');
  const okBtn  = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');
  msgEl.textContent = message;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  const handleOk = () => { close(); onConfirm(); cleanup(); };
  const handleCancel = () => { close(); cleanup(); };
  const handleKey = (e) => { if (e.key === 'Escape') { close(); cleanup(); } };
  function cleanup() {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKey);
  }
  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKey);
}

// ── Answer status in the scoreboard ───────────────────────────────────────────
// Short label of a team's answer: the letter for multiple choice, Truth/Lie, the number, or a check for word order.
function shortAnswer(answer) {
  const type = currentQuestion?.type;
  if (type === 'multiple_choice') return 'ABCD'[parseInt(answer)] || String(answer);
  if (type === 'truth_or_lie') return parseInt(answer) === 0 ? t('truth_btn') : t('lie_btn');
  if (type === 'word_order') return '';
  return String(answer);
}

const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

function refreshScoreboardMarks() {
  document.querySelectorAll('#scoreboard .score-answer').forEach(el => {
    const mark = answerMarks[el.dataset.answerFor];
    const label = mark && !isHiddenFromHost(el.dataset.answerFor) ? shortAnswer(mark.answer) : '';
    el.innerHTML = mark ? (label ? escapeHtml(label) : CHECK_SVG) : '';
    el.className = 'score-answer' + (mark ? ' answered' : '') +
      (mark && answersRevealed ? (mark.isCorrect ? ' is-correct' : ' is-wrong') : '');
  });
}

// Before the first reveal the scoreboard has no scores yet: list the teams with 0 so answers can show up.
function ensureScoreboard() {
  if (document.querySelector('#scoreboard .score-row')) { refreshScoreboardMarks(); return; }
  const list = Object.values(teams).map(tm => ({ id: tm.id, name: tm.name, selfie: tm.selfie, score: tm.score || 0 }));
  if (list.length) updateScoreboard('scoreboard', list.sort((a, b) => b.score - a.score));
}

// −/+ buttons next to number inputs (points, seconds)
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-stepper]');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.stepper);
  const min = input.min !== '' ? Number(input.min) : -Infinity;
  const max = input.max !== '' ? Number(input.max) : Infinity;
  const next = Math.min(max, Math.max(min, (Number(input.value) || 0) + Number(btn.dataset.delta)));
  input.value = next;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function assignRanks(scores) { return scores.map(s => scores.filter(o => o.score > s.score).length + 1); }
function rankLabel(rank) { return String(rank); }
// Templates below name their loop variable `t`, which shadows the translate function
const t_ = (...args) => window.t(...args);
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
