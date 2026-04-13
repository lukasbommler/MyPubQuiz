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

const CATEGORY_ICONS = {
  'Geography': '🌍', 'Science': '🔬', 'Pop Culture': '🎬',
  'Sports': '⚽', 'History': '📜', 'Food & Drink': '🍽️'
};

// TYPE_LABELS are built dynamically so they respect the active UI language
function getTypeLabels() {
  return {
    'multiple_choice': t('type_multiple_choice'),
    'word_order':      t('type_word_order'),
    'estimation':      t('type_estimation'),
  };
}

// Apply translations and set active lang button on load
document.addEventListener('DOMContentLoaded', applyI18n);

// ── Screens ───────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'screen-enter'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active', 'screen-enter');
  el.addEventListener('animationend', () => el.classList.remove('screen-enter'), { once: true });
}

// ── Host button steps ─────────────────────────────────────────────────────────
function setStep(step) {
  ['btn-send-question','btn-replace','btn-show-answers','btn-next','btn-end-round'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  document.getElementById('correct-reveal').classList.add('hidden');

  if (step === 'idle')      { document.getElementById('btn-send-question').classList.remove('hidden'); document.getElementById('btn-replace').classList.remove('hidden'); }
  if (step === 'sent')      { document.getElementById('btn-show-answers').classList.remove('hidden'); document.getElementById('btn-end-round').classList.remove('hidden'); }
  if (step === 'answering') { document.getElementById('btn-end-round').classList.remove('hidden'); startTimer(currentQuestion?.time_limit || 20); }
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
      <span class="cat-icon">${CATEGORY_ICONS[cat] || '❓'}</span>
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
socket.emit('host-join', { code, hostToken });
socket.on('error', ({ message }) => alert('Error: ' + message));

socket.on('host-joined', ({ event, teams: teamList, questions, lang, hostTeamId: savedHostTeamId, reconnectState }) => {
  allQuestions = questions;
  document.getElementById('header-code').textContent = code;

  // Restore host-plays state on reconnect
  if (savedHostTeamId) {
    hostTeamId = savedHostTeamId;
    hostPlaysMode = true;
    document.getElementById('host-plays-toggle').checked = true;
    document.getElementById('host-player-name').classList.remove('hidden');
  }

  const gameUrl = `${location.origin}/game/${code}`;
  document.getElementById('lobby-share-link').value = gameUrl;
  new QRCode(document.getElementById('lobby-qr'), {
    text: gameUrl, width: 150, height: 150, colorDark: '#7c3aed', colorLight: '#ffffff'
  });

  const allCats = [...new Set(questions.map(q => q.category))];
  buildConfigPanel('category-checkboxes', 'type-radios', 'match-count', allCats, 'multiple_choice');

  teamList.forEach(t => addTeam(t));

  // Sync question language to the UI language (unless mid-game where it's locked in)
  if (event.status !== 'running' && event.status !== 'finished') {
    socket.emit('set-language', { code, lang: window.MPQ_LANG });
  }

  if (event.status === 'running') {
    showScreen('screen-game');
    if (reconnectState) restoreHostGame(reconnectState);
  } else if (event.status === 'round-over') {
    showScreen('screen-round-over');
    buildConfigPanel('ro-category-checkboxes', 'ro-type-radios', 'ro-match-count', allCats, 'multiple_choice');
  } else if (event.status === 'finished') {
    showScreen('screen-gameover');
  } else {
    showScreen('screen-lobby');
  }
});

function restoreHostGame(rs) {
  const q = rs.currentQuestion;
  if (!q) return;

  currentQuestion = q;
  currentRound = (q.roundIndex ?? 0) + 1;

  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-round-info').textContent = `Round ${currentRound}`;
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

  // Restore answers log
  rs.answers.forEach(({ teamId, answer, isCorrect, points }) => {
    const team = teams[teamId];
    if (!team) return;
    const row = document.createElement('div');
    row.className = `answer-log-row ${isCorrect ? 'correct-log' : 'wrong-log'}`;
    const display = q.type === 'multiple_choice' ? 'ABCD'[parseInt(answer)] || answer : answer;
    row.innerHTML = `
      <span class="answer-log-name">${escapeHtml(team.name)}</span>
      <span style="color:var(--text2);font-size:.8rem">${display}</span>
      <span class="answer-log-result ${isCorrect ? 'ok' : 'bad'}">${isCorrect ? `+${points}` : '✗'}</span>`;
    document.getElementById('answers-log').appendChild(row);
  });

  const step = rs.currentStep;

  if (step === 'question-text') {
    renderQuestionPreview(q);
    setStep('sent');
  } else if (step === 'answers-shown') {
    renderQuestionPreview(q);
    setStep('answering');
    if (rs.timerRemaining > 0) startTimer(rs.timerRemaining);
  } else if (step === 'revealed') {
    renderQuestionPreview(q);
    const cv = document.getElementById('correct-value');
    if (q.type === 'multiple_choice') cv.textContent = q.answers[rs.correct];
    else if (q.type === 'estimation') cv.textContent = `${rs.correct} ${q.unit || ''}`;
    else if (q.type === 'word_order') cv.textContent = rs.correct.map(i => q.words[i]).join(' → ');
    updateScoreboard('scoreboard', rs.scores);
    renderHostDistribution(rs.distribution);
    setStep('revealed');
  } else {
    // step is null — question arrived at host but not yet sent to players
    renderQuestionPreview(q);
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
  if (hostPlaysMode) document.getElementById('host-player-name').focus();
});

// ── Server confirms host team ─────────────────────────────────────────────────
socket.on('host-team-created', ({ teamId }) => {
  hostTeamId = teamId;
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
  if (confirm('End this round early and go to standings?')) socket.emit('end-round', { code });
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
  hostAnswered = false;

  document.getElementById('q-category').textContent = q.category;
  document.getElementById('q-round-info').textContent = `Round ${currentRound}`;
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

  if (hostPlaysMode) {
    // Hide question content until it's sent to players
    document.getElementById('question-text').textContent = MPQ_LANG === 'de' ? '⏳ Frage bereit — sende sie, wenn du bereit bist' : '⏳ Question ready — send it when you\'re ready';
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
        <span class="answer-letter">${'ABCD'[i]}</span>${escapeHtml(a)}
      </div>`).join('');
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
        opts.querySelectorAll('.host-answer-btn').forEach(b => b.disabled = true);
        btn.classList.add('host-answer-selected');
        socket.emit('host-submit-answer', { code, answer: String(btn.dataset.index),
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
      document.getElementById('host-est-submit').disabled = true;
      socket.emit('host-submit-answer', { code, answer: val,
        timeTaken: Date.now() - hostAnswerStartTime });
      showHostAnswerFeedback(t('submitted_val', { val, unit: q.unit || '' }));
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
      document.getElementById('host-wo-submit').disabled = true;
      socket.emit('host-submit-answer', { code, answer: JSON.stringify(wordOrder),
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

socket.on('host-step', ({ step }) => {
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
    if (hostPlaysMode && currentQuestion && !hostAnswered) {
      showHostAnswerOptions(currentQuestion);
    }
  }
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
socket.on('answer-revealed', ({ correct, scores, distribution }) => {
  setStep('revealed');
  const cv = document.getElementById('correct-value');
  if (currentQuestion?.type === 'multiple_choice') cv.textContent = currentQuestion.answers[correct];
  else if (currentQuestion?.type === 'estimation') cv.textContent = `${correct} ${currentQuestion.unit || ''}`;
  else if (currentQuestion?.type === 'word_order') cv.textContent = correct.map(i => currentQuestion.words[i]).join(' → ');
  updateScoreboard('scoreboard', scores);
  renderHostDistribution(distribution);

  if (hostPlaysMode && currentQuestion) {
    // Show the full answer preview with correct answer highlighted
    renderQuestionPreview(currentQuestion);
    // Always hide the answer buttons on reveal — the correct answer is visible
    // in answers-preview and correct-reveal, so the "Your Answer" section adds no value
    document.getElementById('host-answer-area').classList.add('hidden');
  }
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
        <div style="width:${pct}%;background:var(--green);height:100%;border-radius:4px;transition:width .6s"></div>
      </div>
      <span style="font-size:.85rem;color:var(--text2)">✓ ${dist.correct} correct &nbsp; ✗ ${dist.wrong} wrong</span>
    </div>`;
  }
}

socket.on('scores-updated', ({ scores }) => {
  updateScoreboard('scoreboard', scores);
  updateScoreboard('round-over-scoreboard', scores);
});
socket.on('first-correct', ({ team, points, questionType }) => {
  const label = questionType === 'estimation' ? t('best_estimate_label') : t('first_correct_label');
  showBuzz(team, points, label);
});

// ── Round over ────────────────────────────────────────────────────────────────
socket.on('round-over', ({ scores, roundNum }) => {
  stopTimer();
  showScreen('screen-round-over');
  document.getElementById('round-over-badge').textContent = t('round_complete', { num: roundNum });
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
  // Classic Olympic layout: 2nd left, 1st centre, 3rd right
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const rankOf = t => scores.indexOf(t) + 1;
  const blockHeights = { 1: 140, 2: 95, 3: 65 };
  const blockDelays  = { 1: 1.3, 2: 0.7, 3: 0.4 };
  const entryDelays  = { 1: 1.45, 2: 0.85, 3: 0.5 };

  let html = `<div class="podium-stage">
    <div class="podium-entries">`;

  for (const t of podiumOrder) {
    const rank = rankOf(t);
    const initials = t.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    html += `
      <div class="podium-entry p${rank}" style="--entry-delay:${entryDelays[rank]}s">
        <div class="podium-avatar">
          ${t.selfie ? `<img src="${escapeHtml(t.selfie)}" alt="">` : `<span>${escapeHtml(initials)}</span>`}
        </div>
        <div class="podium-name">${escapeHtml(t.name)}</div>
        <div class="podium-score">${t.score} pts</div>
      </div>`;
  }

  html += `</div><div class="podium-blocks">`;
  for (const t of podiumOrder) {
    const rank = rankOf(t);
    html += `<div class="podium-block b${rank}" style="--block-height:${blockHeights[rank]}px;--block-delay:${blockDelays[rank]}s">${rankEmoji(rank - 1)}</div>`;
  }
  html += `</div></div>`;

  // Full standings below podium
  html += `<div class="podium-all-scores">` +
    scores.map((t, i) => `
      <div class="podium-score-row ${i === 0 ? 'winner' : ''}">
        <span class="psr-rank">${rankEmoji(i)}</span>
        <span class="psr-name">${escapeHtml(t.name)}</span>
        <span class="psr-pts">${t.score} pts</span>
      </div>`).join('') +
    `</div>`;

  document.getElementById('final-podium').innerHTML = html;

  // Staggered: fanfare when 1st place block starts rising, confetti just after
  setTimeout(() => Sounds.victory(), 1300);
  setTimeout(() => Sounds.launchConfetti(), 1500);
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
        <button onclick="adjustScore('${t.id}',1)">+</button>
        <button onclick="adjustScore('${t.id}',-1)">-</button>
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
function showBuzz(team, points, label) {
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('buzz-team-name').textContent = team.name;
  document.getElementById('buzz-points').textContent = `+${points} pts`;
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
socket.on('lone-hero', ({ team, points }) => showSpecialOverlay('lone-hero-overlay', 'lone-hero-team', 'lone-hero-points', team, points));
socket.on('precise-estimate', ({ team, points }) => showSpecialOverlay('precise-overlay', 'precise-team', 'precise-points', team, points));

function showSpecialOverlay(overlayId, teamId, ptsId, team, points) {
  document.getElementById(teamId).textContent = team.name;
  document.getElementById(ptsId).textContent = points > 0 ? `+${points} pts` : '';
  const overlay = document.getElementById(overlayId);
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 4000);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function rankEmoji(i) { return ['🥇','🥈','🥉'][i] || `${i+1}.`; }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
