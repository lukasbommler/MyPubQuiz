// ── i18n ──────────────────────────────────────────────────────────────────────
// i18n.js is loaded before play.js — applyI18n() runs on DOMContentLoaded
document.addEventListener('DOMContentLoaded', applyI18n);

// ── Init ──────────────────────────────────────────────────────────────────────
const code = location.pathname.split('/').pop();
const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: Infinity });

let myTeam = null;
let myTeamId = localStorage.getItem(`quiz_team_${code}`);
let hasJoinedThisSession = false; // true once team-joined fires for the first time
let questionStartTime = null;
let timerInterval = null;
let currentQuestion = null;
let answered = false;
let wordOrder = [];
let myAnswerCorrect = false; // remembered for reveal screen
let mySubmittedAnswer = null; // raw answer value, shown on reveal

// ── Screen helper ─────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.play-screen').forEach(s => s.classList.remove('active', 'screen-enter'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active', 'screen-enter');
  el.addEventListener('animationend', () => el.classList.remove('screen-enter'), { once: true });
}

// ── Page setup ────────────────────────────────────────────────────────────────
document.getElementById('join-code').textContent = code;

// ── Join ──────────────────────────────────────────────────────────────────────
document.getElementById('join-btn').addEventListener('click', () => {
  const name = document.getElementById('team-name-input').value.trim();
  if (!name) { document.getElementById('team-name-input').focus(); return; }
  socket.emit('team-join', { code, teamName: name, teamId: myTeamId });
});

document.getElementById('team-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('join-btn').click();
});

// ── Connection / reconnection ─────────────────────────────────────────────────
const reconnectBanner = document.getElementById('reconnect-banner');

socket.on('disconnect', () => {
  reconnectBanner.classList.remove('hidden');
});

socket.on('connect', () => {
  reconnectBanner.classList.add('hidden');
  // If we've already joined this session or have a stored ID (page refresh), silently rejoin
  if (myTeam) {
    socket.emit('team-join', { code, teamId: myTeam.id });
  } else if (hasJoinedThisSession && myTeamId) {
    socket.emit('team-join', { code, teamId: myTeamId });
  }
});

// ── Team joined ───────────────────────────────────────────────────────────────
socket.on('team-joined', ({ team, eventStatus, allTeams }) => {
  const isReconnect = hasJoinedThisSession;
  hasJoinedThisSession = true;
  myTeam = team;
  myTeamId = team.id;
  localStorage.setItem(`quiz_team_${code}`, team.id);

  if (!isReconnect) {
    if (eventStatus === 'running') showWaiting();
    else if (eventStatus === 'finished') showScreen('screen-gameover-play');
    else {
      showScreen('screen-selfie');
      // Pre-populate existing teams (joined before us)
      if (allTeams) {
        document.getElementById('teams-in-lobby').innerHTML = '';
        allTeams.forEach(t => addTeamChip(t, false));
        const countEl = document.getElementById('lobby-teams-count');
        if (countEl) countEl.textContent = allTeams.length;
      }
    }
  }
});

// ── Selfie ────────────────────────────────────────────────────────────────────
document.getElementById('take-selfie-btn').addEventListener('click', () => {
  document.getElementById('selfie-input').click();
});

document.getElementById('selfie-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById('selfie-preview');
    preview.src = ev.target.result;
    preview.classList.remove('hidden');
    document.getElementById('selfie-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

document.getElementById('selfie-done-btn').addEventListener('click', () => {
  // Navigate to lobby immediately — don't make the player wait for the upload
  showWaiting();

  const fileInput = document.getElementById('selfie-input');
  if (fileInput.files.length > 0 && myTeam) {
    // Upload in the background after navigating
    resizeAndUploadSelfie(fileInput.files[0]);
  }
});

async function resizeAndUploadSelfie(file) {
  try {
    // Resize to max 800×800 at 80% JPEG quality — keeps payload well under 1 MB
    const base64 = await resizeImage(file, 800, 800, 0.8);
    const res = await fetch(`/api/team/${myTeam.id}/selfie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64 })
    });
    const data = await res.json();
    if (!data.selfieUrl) return;

    myTeam.selfie = data.selfieUrl;

    // Update the waiting-screen avatar
    const waitingImg = document.getElementById('waiting-selfie');
    const waitingInits = document.getElementById('waiting-initials');
    if (waitingImg) {
      waitingImg.src = data.selfieUrl;
      waitingImg.classList.remove('hidden');
      if (waitingInits) waitingInits.classList.add('hidden');
    }

    // Update own chip in the lobby teams grid
    const myChipAvatar = document.querySelector(`[data-chip="${myTeam.id}"] .chip-avatar`);
    if (myChipAvatar) {
      myChipAvatar.innerHTML = `<img src="${escapeHtml(data.selfieUrl)}" alt="">`;
    }
  } catch (e) { /* non-critical — selfie is optional */ }
}

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
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function showWaiting(statusText) {
  if (!myTeam) return;
  showScreen('screen-waiting');
  const initials = myTeam.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('waiting-team-name').textContent = myTeam.name;
  document.getElementById('waiting-initials').textContent = initials;
  if (myTeam.selfie) {
    document.getElementById('waiting-selfie').src = myTeam.selfie;
    document.getElementById('waiting-selfie').classList.remove('hidden');
    document.getElementById('waiting-initials').classList.add('hidden');
  }
  if (statusText) document.getElementById('lobby-status-text').textContent = statusText;
}

function addTeamChip(team, animate) {
  const grid = document.getElementById('teams-in-lobby');
  if (document.querySelector(`[data-chip="${team.id}"]`)) return;
  const chip = document.createElement('div');
  chip.className = 'lobby-team-chip' + (animate ? ' chip-pop' : '');
  chip.dataset.chip = team.id;
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  chip.innerHTML = `
    <div class="chip-avatar">
      ${team.selfie ? `<img src="${escapeHtml(team.selfie)}" alt="">` : `<span>${escapeHtml(initials)}</span>`}
    </div>
    <span class="chip-name">${escapeHtml(team.name)}</span>
  `;
  if (team.id === myTeamId) chip.classList.add('chip-mine');
  grid.appendChild(chip);
}

// ── Team arrived in lobby ─────────────────────────────────────────────────────
socket.on('team-arrived', ({ team, totalTeams }) => {
  addTeamChip(team, true);
  const countEl = document.getElementById('lobby-teams-count');
  if (countEl) countEl.textContent = totalTeams;
});

// ── Round started ─────────────────────────────────────────────────────────────
socket.on('round-started', ({ roundNum, total }) => {
  roundEnded = false;
  if (myTeam) showWaiting(t('round_starting', { num: roundNum, total }));
});

// ── Round over ────────────────────────────────────────────────────────────────
let roundEnded = false; // guards against countdown callback overriding waiting screen

socket.on('round-over', ({ scores, roundNum }) => {
  roundEnded = true;
  stopTimer();
  countdownActive = false;
  document.getElementById('countdown-overlay').classList.add('hidden');
  showRoundOver(scores, roundNum);
});

function showRoundOver(scores, roundNum) {
  showScreen('screen-round-over-play');
  document.getElementById('round-complete-badge').textContent = t('round_complete_badge', { num: roundNum });
  document.getElementById('round-over-scores-play').innerHTML = (scores || []).map((team, i) => `
    <div class="reveal-score-row ${team.id === myTeamId ? 'my-team' : ''}">
      <span class="reveal-score-rank">${rankEmoji(i)}</span>
      <span class="reveal-score-name">${escapeHtml(team.name)}</span>
      <span class="reveal-score-pts">${team.score} pts</span>
    </div>`).join('');
}

socket.on('scoreboard-shown', ({ scores, roundNum }) => {
  showScreen('screen-round-over-play');
  document.getElementById('round-complete-badge').textContent = t('round_standings', { num: roundNum });
  document.getElementById('round-over-scores-play').innerHTML = scores.map((team, i) => `
    <div class="reveal-score-row ${team.id === myTeamId ? 'my-team' : ''}">
      <span class="reveal-score-rank">${rankEmoji(i)}</span>
      <span class="reveal-score-name">${escapeHtml(team.name)}</span>
      <span class="reveal-score-pts">${team.score} pts</span>
    </div>`).join('');
});

// ── STEP 1: Host sends question text only ─────────────────────────────────────
socket.on('question-text', (q) => {
  currentQuestion = q;
  answered = false;
  wordOrder = [];
  myAnswerCorrect = false;
  mySubmittedAnswer = null;
  roundEnded = false; // clear stale flag so reconnect doesn't block the countdown callback
  showQuestionText(q);
});

// ── STEP 2: Host shows answer options — with 3-2-1-GO countdown ──────────────
let pendingTimeLimit = null;
let countdownActive = false;

socket.on('question-answers', (q) => {
  currentQuestion = q;
  startCountdown(() => {
    showAnswerOptions(q);
    questionStartTime = Date.now();
    Sounds.questionStart();
    if (pendingTimeLimit !== null) {
      startAllTimers(pendingTimeLimit);
      pendingTimeLimit = null;
    }
  });
});

socket.on('question-start', ({ timeLimit }) => {
  if (countdownActive) {
    pendingTimeLimit = timeLimit; // held until countdown finishes
  } else {
    startAllTimers(timeLimit);
  }
});

function startCountdown(onDone) {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-number');
  const steps   = [3, 2, 1, 'GO'];
  let i = 0;
  countdownActive = true;
  overlay.classList.remove('hidden');

  function tick() {
    const val = steps[i];
    numEl.textContent = val;
    numEl.className = 'countdown-number' + (val === 'GO' ? ' go' : '');
    // restart animation
    numEl.style.animation = 'none';
    numEl.offsetHeight; // reflow
    numEl.style.animation = '';

    if (val === 'GO') Sounds.countdownGo();
    else Sounds.countdownTick();

    i++;
    if (i < steps.length) {
      setTimeout(tick, 900);
    } else {
      setTimeout(() => {
        overlay.classList.add('hidden');
        countdownActive = false;
        if (!roundEnded) onDone();
      }, 900);
    }
  }
  tick();
}

// ── STEP 3: Host reveals results ──────────────────────────────────────────────
socket.on('answer-revealed', ({ correct, scores, estimationWinnerId, distribution }) => {
  stopTimer();
  showReveal(correct, scores, estimationWinnerId, distribution);
});

// ── First correct flash (after reveal) ───────────────────────────────────────
socket.on('first-correct', ({ team, points, questionType }) => {
  const label = questionType === 'estimation' ? t('best_estimate_label') : t('first_correct_label');
  showBuzz(team, points, label);
  Sounds.buzz();
});

// ── Lone hero / Precise estimate animations ───────────────────────────────────
socket.on('lone-hero', ({ team, points }) => showPlaySpecial('play-lone-hero-overlay', 'play-lone-hero-team', 'play-lone-hero-points', team, points));
socket.on('precise-estimate', ({ team, points }) => showPlaySpecial('play-precise-overlay', 'play-precise-team', 'play-precise-points', team, points));
socket.on('worst-estimate', ({ team }) => showPlaySpecial('play-worst-overlay', 'play-worst-team', null, team, 0));

function showPlaySpecial(overlayId, teamElId, ptsElId, team, points) {
  document.getElementById(teamElId).textContent = team.name;
  if (ptsElId) document.getElementById(ptsElId).textContent = points > 0 ? `+${points} pts` : '';
  const img   = document.getElementById(overlayId + '-selfie');
  const inits = document.getElementById(overlayId + '-initials');
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  if (team.selfie) { img.src = team.selfie; img.style.display = 'block'; inits.textContent = ''; }
  else             { img.style.display = 'none'; inits.textContent = initials; }
  const overlay = document.getElementById(overlayId);
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 4000);
}

// ── Game over ─────────────────────────────────────────────────────────────────
socket.on('game-over', ({ scores }) => {
  stopTimer();
  showScreen('screen-gameover-play');

  const myRank = scores.findIndex(t => t.id === myTeamId) + 1;
  const myScore = scores.find(t => t.id === myTeamId)?.score ?? 0;

  const rankBadge = document.getElementById('gameover-rank-badge');
  const scoreDisplay = document.getElementById('gameover-score-display');

  if (myRank === 1)      { rankBadge.textContent = '🥇 You Won!';   rankBadge.className = 'gameover-rank-badge gold'; }
  else if (myRank === 2) { rankBadge.textContent = '🥈 2nd Place';  rankBadge.className = 'gameover-rank-badge silver'; }
  else if (myRank === 3) { rankBadge.textContent = '🥉 3rd Place';  rankBadge.className = 'gameover-rank-badge bronze'; }
  else if (myRank > 0)   { rankBadge.textContent = `#${myRank}`;    rankBadge.className = 'gameover-rank-badge'; }
  rankBadge.classList.remove('hidden');

  scoreDisplay.textContent = `${myScore} pts`;
  scoreDisplay.classList.remove('hidden');

  document.getElementById('final-scores-play').innerHTML = scores.map((team, i) => `
    <div class="final-score-row ${i === 0 ? 'winner' : ''} ${team.id === myTeamId ? 'my-team' : ''}">
      <span class="final-score-rank">${rankEmoji(i)}</span>
      <span class="final-score-name">${escapeHtml(team.name)}</span>
      <span class="final-score-pts">${team.score} pts</span>
    </div>
  `).join('');

  if (myRank > 0 && myRank <= 3) setTimeout(() => Sounds.launchConfetti(), 400);
});

// ── Standby / waiting screens ─────────────────────────────────────────────────
function showWaitingForQuestion() {
  if (myTeam) showWaiting('Get ready! Question coming soon...');
}

// ── Show question text only (no answers yet) ──────────────────────────────────
function showQuestionText(q) {
  // Pick the right screen but hide the interactive parts
  if (q.type === 'multiple_choice') {
    setupMCScreen(q, false);
    showScreen('screen-mc');
  } else if (q.type === 'estimation') {
    setupEstimationScreen(q, false);
    showScreen('screen-estimation');
  } else if (q.type === 'word_order') {
    setupWordOrderScreen(q, false);
    showScreen('screen-wordorder');
  }
}

// ── Show answer options and enable interaction ────────────────────────────────
function showAnswerOptions(q) {
  if (q.type === 'multiple_choice') setupMCScreen(q, true);
  else if (q.type === 'estimation') setupEstimationScreen(q, true);
  else if (q.type === 'word_order') setupWordOrderScreen(q, true);
}

// ── Multiple Choice ───────────────────────────────────────────────────────────
function setupMCScreen(q, showAnswers) {
  document.getElementById('mc-category').textContent = q.category;
  document.getElementById('mc-progress').textContent = `${(q.roundIndex ?? 0) + 1} / ${q.roundTotal ?? q.total}`;
  document.getElementById('mc-question-text').textContent = q.question;
  document.getElementById('mc-feedback').classList.add('hidden');
  document.getElementById('mc-timer-fill').style.width = '100%';
  document.getElementById('mc-timer-fill').className = 'play-timer-fill';

  const container = document.getElementById('mc-answers');
  const letters = ['A', 'B', 'C', 'D'];

  if (!showAnswers) {
    container.innerHTML = `<div class="waiting-answers-hint">${t('waiting_answers')}</div>`;
    return;
  }

  const shuffled = q.answers.map((_, i) => i).sort(() => Math.random() - 0.5);
  container.innerHTML = shuffled.map((origIdx, displayIdx) => `
    <button class="mc-btn" data-index="${origIdx}">
      <span class="mc-letter">${letters[displayIdx]}</span>
      ${escapeHtml(q.answers[origIdx])}
    </button>
  `).join('');

  container.querySelectorAll('.mc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      btn.classList.add('selected');
      container.querySelectorAll('.mc-btn').forEach(b => b.disabled = true);
      submitAnswer(String(btn.dataset.index));
      showLockedIn();
      playSound('submit');
    });
  });
}

// ── Estimation ────────────────────────────────────────────────────────────────
function setupEstimationScreen(q, showAnswers) {
  document.getElementById('est-category').textContent = q.category;
  document.getElementById('est-progress').textContent = `${(q.roundIndex ?? 0) + 1} / ${q.roundTotal ?? q.total}`;
  document.getElementById('est-question-text').textContent = q.question;
  document.getElementById('est-unit').textContent = q.unit || '';
  document.getElementById('est-input').value = '';
  document.getElementById('est-feedback').classList.add('hidden');
  document.getElementById('est-timer-fill').style.width = '100%';
  document.getElementById('est-timer-fill').className = 'play-timer-fill';

  const wrap = document.getElementById('est-input').parentElement;
  const submitBtn = document.getElementById('est-submit-btn');

  if (!showAnswers) {
    wrap.style.display = 'none';
    submitBtn.style.display = 'none';
    document.getElementById('est-feedback').textContent = t('waiting_input');
    document.getElementById('est-feedback').classList.remove('hidden');
    document.getElementById('est-feedback').className = 'est-feedback';
  } else {
    wrap.style.display = '';
    submitBtn.style.display = '';
    submitBtn.disabled = false;
  }
}

document.getElementById('est-submit-btn').addEventListener('click', () => {
  if (answered) return;
  const val = document.getElementById('est-input').value.trim();
  if (!val || isNaN(val)) { document.getElementById('est-input').focus(); return; }
  answered = true;
  document.getElementById('est-submit-btn').disabled = true;
  submitAnswer(val);
  showLockedIn('est-feedback', t('submitted_play', { val, unit: currentQuestion?.unit || '' }));
  playSound('submit');
});

// ── Word Order ────────────────────────────────────────────────────────────────
function setupWordOrderScreen(q, showAnswers) {
  document.getElementById('wo-category').textContent = q.category;
  document.getElementById('wo-progress').textContent = `${(q.roundIndex ?? 0) + 1} / ${q.roundTotal ?? q.total}`;
  document.getElementById('wo-question-text').textContent = q.question;
  document.getElementById('wo-feedback').classList.add('hidden');
  document.getElementById('wo-timer-fill').style.width = '100%';
  document.getElementById('wo-timer-fill').className = 'play-timer-fill';
  document.getElementById('wo-submit-btn').disabled = false;

  wordOrder = [];
  const chipsContainer = document.getElementById('word-chips');
  const dropZone = document.getElementById('word-drop-zone');

  if (!showAnswers) {
    chipsContainer.innerHTML = '';
    dropZone.innerHTML = `<p class="drop-hint">${t('waiting_words')}</p>`;
    document.getElementById('wo-submit-btn').style.display = 'none';
    return;
  }

  document.getElementById('wo-submit-btn').style.display = '';
  dropZone.innerHTML = `<p class="drop-hint">${t('tap_words_play')}</p>`;

  const shuffled = [...q.words.keys()].sort(() => Math.random() - 0.5);
  chipsContainer.innerHTML = '';

  shuffled.forEach(originalIndex => {
    const chip = document.createElement('div');
    chip.className = 'word-chip';
    chip.textContent = q.words[originalIndex];
    chip.dataset.wordIndex = originalIndex;
    chip.addEventListener('click', () => {
      if (answered) return;
      if (chip.classList.contains('in-zone')) {
        wordOrder = wordOrder.filter(i => i !== originalIndex);
        chip.classList.remove('in-zone');
        chipsContainer.appendChild(chip);
      } else {
        wordOrder.push(originalIndex);
        chip.classList.add('in-zone');
        const hint = dropZone.querySelector('.drop-hint');
        if (hint) hint.remove();
        dropZone.appendChild(chip);
      }
    });
    chipsContainer.appendChild(chip);
  });
}

document.getElementById('wo-submit-btn').addEventListener('click', () => {
  if (answered) return;
  if (wordOrder.length !== currentQuestion?.words?.length) {
    const fb = document.getElementById('wo-feedback');
    fb.textContent = t('place_all_words');
    fb.className = 'wo-feedback wrong-fb';
    fb.classList.remove('hidden');
    return;
  }
  answered = true;
  document.getElementById('wo-submit-btn').disabled = true;
  submitAnswer(JSON.stringify(wordOrder));
  showLockedIn();
  playSound('submit');
});

// ── Locked in state ───────────────────────────────────────────────────────────
function showLockedIn(fbId, text) {
  // Generic: show a "locked in" message on whichever feedback element is relevant
  const fbIds = fbId ? [fbId] : ['mc-feedback', 'est-feedback', 'wo-feedback'];
  fbIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text || t('locked_in_play');
      el.className = el.className.replace(/correct-fb|wrong-fb|correct_fb/g, '').trim();
      el.style.background = 'rgba(124,58,237,0.15)';
      el.style.color = 'var(--accent2)';
      el.classList.remove('hidden');
    }
  });
}

// ── Submit answer ─────────────────────────────────────────────────────────────
function submitAnswer(answer) {
  mySubmittedAnswer = answer;
  const timeTaken = Date.now() - (questionStartTime || Date.now());
  socket.emit('submit-answer', { code, answer, timeTaken });
  Sounds.submit();
}

socket.on('answer-acknowledged', () => {
  // Answer logged on server — UI already updated by showLockedIn()
});

// ── Reveal screen ─────────────────────────────────────────────────────────────
function showReveal(correct, scores, estimationWinnerId, distribution) {
  flagBtn.textContent = '🚩 Report issue';
  flagBtn.disabled = false;
  flagModal.classList.add('hidden');

  // Show correct/wrong on the answer screen briefly before switching to reveal
  if (currentQuestion?.type === 'multiple_choice') {
    document.querySelectorAll('.mc-btn').forEach(btn => {
      btn.disabled = true;
      if (parseInt(btn.dataset.index) === correct) btn.classList.add('correct');
      else if (btn.classList.contains('selected')) btn.classList.add('wrong');
    });
    // Reset inline style from showLockedIn
    const fb = document.getElementById('mc-feedback');
    if (fb) { fb.style.background = ''; fb.style.color = ''; }
  }

  setTimeout(() => {
    showScreen('screen-reveal');

    // Was my answer correct?
    const resultEl = document.getElementById('reveal-result');
    let wasCorrect = false;
    if (currentQuestion?.type === 'multiple_choice') {
      wasCorrect = document.querySelector('.mc-btn.correct.selected') != null;
    } else if (currentQuestion?.type === 'word_order') {
      wasCorrect = JSON.stringify(wordOrder) === JSON.stringify(correct);
    } else if (currentQuestion?.type === 'estimation') {
      wasCorrect = estimationWinnerId != null && estimationWinnerId === myTeamId;
    }

    resultEl.textContent = answered ? (wasCorrect ? t('correct_str') : t('wrong_str')) : t('not_answered');
    resultEl.className = `reveal-result ${wasCorrect ? 'win' : 'lose'}`;
    if (answered) wasCorrect ? Sounds.correct() : Sounds.wrong();

    const correctAnswerEl = document.getElementById('reveal-correct-answer');
    if (currentQuestion?.type === 'multiple_choice') {
      correctAnswerEl.textContent = t('correct_label', { answer: currentQuestion.answers[correct] });
    } else if (currentQuestion?.type === 'estimation') {
      correctAnswerEl.textContent = t('answer_label', { value: correct, unit: currentQuestion.unit || '' });
    } else if (currentQuestion?.type === 'word_order') {
      correctAnswerEl.textContent = t('order_label', { order: correct.map(i => currentQuestion.words[i]).join(' → ') });
    }

    const yourAnswerEl = document.getElementById('reveal-your-answer');
    if (answered && mySubmittedAnswer !== null && currentQuestion) {
      let yourText = '';
      if (currentQuestion.type === 'multiple_choice') {
        yourText = t('your_answer_label') + ': ' + (currentQuestion.answers[parseInt(mySubmittedAnswer)] ?? mySubmittedAnswer);
      } else if (currentQuestion.type === 'estimation') {
        yourText = t('your_answer_label') + ': ' + mySubmittedAnswer + (currentQuestion.unit ? ' ' + currentQuestion.unit : '');
      } else if (currentQuestion.type === 'word_order') {
        try {
          const order = JSON.parse(mySubmittedAnswer);
          yourText = t('your_answer_label') + ': ' + order.map(i => currentQuestion.words[i]).join(' → ');
        } catch (e) {}
      }
      yourAnswerEl.textContent = yourText;
      yourAnswerEl.classList.remove('hidden');
    } else {
      yourAnswerEl.classList.add('hidden');
    }

    document.getElementById('reveal-points').textContent = '';

    renderDistribution(distribution);

    document.getElementById('reveal-scoreboard').innerHTML = '';
  }, 800);
}

// ── Answer distribution ───────────────────────────────────────────────────────
function renderDistribution(dist) {
  const el = document.getElementById('reveal-distribution');
  if (!dist || !el) { el?.classList.add('hidden'); return; }
  el.classList.remove('hidden');

  if (dist.type === 'multiple_choice') {
    const max = Math.max(...dist.counts, 1);
    el.innerHTML = dist.labels.map((label, i) => {
      const count = dist.counts[i];
      const pct   = Math.round((count / max) * 100);
      const isCorrect = i === dist.correct;
      return `
        <div class="dist-row ${isCorrect ? 'dist-correct' : ''}">
          <span class="dist-label">${escapeHtml(label)}</span>
          <div class="dist-bar-wrap">
            <div class="dist-bar" style="width:${pct}%"></div>
          </div>
          <span class="dist-count">${count}</span>
        </div>`;
    }).join('');

  } else if (dist.type === 'estimation') {
    if (!dist.submissions.length) { el.classList.add('hidden'); return; }
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
        <span class="dist-nl-correct-label">▼ ${dist.correctValue} ${dist.unit}</span>
      </div>`;

  } else if (dist.type === 'word_order') {
    const total = dist.total || 1;
    const pct   = Math.round((dist.correct / total) * 100);
    el.innerHTML = `
      <div class="dist-wo">
        <div class="dist-wo-bar-wrap">
          <div class="dist-wo-correct" style="width:${pct}%"></div>
          <div class="dist-wo-wrong"   style="width:${100 - pct}%"></div>
        </div>
        <div class="dist-wo-labels">
          <span class="dist-wo-c">${t('got_right', { n: dist.correct })}</span>
          <span class="dist-wo-w">${t('got_wrong', { n: dist.wrong })}</span>
        </div>
      </div>`;
  }
}

// ── Buzz overlay ──────────────────────────────────────────────────────────────
function showBuzz(team, points, label) {
  const overlay = document.getElementById('play-buzz-overlay');
  const initials = team.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('play-buzz-team-name').textContent = team.name;
  document.getElementById('play-buzz-points').textContent = `+${points} pts`;
  if (label) document.querySelector('#play-buzz-overlay .buzz-label').textContent = label;
  const selfieImg = document.getElementById('play-buzz-selfie');
  const initialsEl = document.getElementById('play-buzz-initials');
  if (team.selfie) { selfieImg.src = team.selfie; selfieImg.style.display = 'block'; initialsEl.textContent = ''; }
  else { selfieImg.style.display = 'none'; initialsEl.textContent = initials; }
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 3500);
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startAllTimers(seconds) {
  stopTimer();
  const fills = ['mc-timer-fill', 'est-timer-fill', 'wo-timer-fill'].map(id => document.getElementById(id));
  let remaining = seconds;
  timerInterval = setInterval(() => {
    remaining--;
    const pct = (remaining / seconds) * 100;
    fills.forEach(f => {
      if (!f) return;
      f.style.width = `${pct}%`;
      f.className = pct < 30 ? 'play-timer-fill danger' : pct < 60 ? 'play-timer-fill warning' : 'play-timer-fill';
    });
    if (remaining <= 3 && remaining > 0) Sounds.urgentTick();
    else if (pct < 60 && remaining > 0) Sounds.tick();
    if (remaining <= 0) { stopTimer(); lockAnswers(); }
  }, 1000);
}

function lockAnswers() {
  // Disable all interactive answer elements
  document.querySelectorAll('.mc-btn').forEach(b => b.disabled = true);
  document.getElementById('est-submit-btn').disabled = true;
  document.getElementById('est-input').disabled = true;
  document.getElementById('wo-submit-btn').disabled = true;
  // Show "Time's up!" only if the player hasn't answered yet
  if (!answered) {
    ['mc-feedback', 'est-feedback', 'wo-feedback'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '⏰ Time\'s up!';
        el.style.background = '';
        el.style.color = '';
        el.classList.remove('hidden');
      }
    });
  }
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── Sound ─────────────────────────────────────────────────────────────────────
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'submit') {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
}

// ── Flag question ─────────────────────────────────────────────────────────────
const flagBtn    = document.getElementById('flag-btn');
const flagModal  = document.getElementById('flag-modal');
const flagCancel = document.querySelector('.flag-cancel');

flagBtn.addEventListener('click', () => flagModal.classList.remove('hidden'));
flagCancel.addEventListener('click', () => flagModal.classList.add('hidden'));
flagModal.addEventListener('click', e => { if (e.target === flagModal) flagModal.classList.add('hidden'); });

document.querySelectorAll('.flag-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const reason = btn.dataset.reason;
    if (!currentQuestion) return;
    socket.emit('flag-question', {
      sourceId:     currentQuestion.source_id ?? null,
      lang:         currentQuestion.language ?? null,
      questionText: currentQuestion.question,
      reason,
    });
    flagModal.classList.add('hidden');
    flagBtn.textContent = '✓ Reported';
    flagBtn.disabled = true;
  });
});

socket.on('flag-question-ack', () => {
  flagBtn.textContent = '✓ Reported';
  flagBtn.disabled = true;
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function rankEmoji(i) { return ['🥇', '🥈', '🥉'][i] || `${i + 1}.`; }
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

