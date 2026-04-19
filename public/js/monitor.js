const code = location.pathname.split('/').pop();
const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: Infinity });

let currentQuestion = null;
let timerInterval   = null;
let roundNum        = 0;
let teamCount       = 0;
let countdownActive = false;
let pendingTimeLimit = null;

// ── Utils ──────────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showScreen(id) {
  document.querySelectorAll('.mon-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function initials(name) {
  return String(name).split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

function avatar(team, size = '') {
  return team.selfie
    ? `<img src="${esc(team.selfie)}" alt="">`
    : `<span class="mon-init ${size}">${initials(team.name)}</span>`;
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  const fill = document.getElementById('mon-timer-fill');
  if (fill) { fill.style.width = '0%'; fill.className = 'mon-timer-fill'; }
}

function startTimer(seconds) {
  stopTimer();
  const fill = document.getElementById('mon-timer-fill');
  if (!fill || seconds <= 0) return;
  const total = seconds;
  const start = Date.now();
  fill.style.width = '100%';
  fill.className = 'mon-timer-fill';
  timerInterval = setInterval(() => {
    const elapsed   = (Date.now() - start) / 1000;
    const remaining = Math.max(0, total - elapsed);
    fill.style.width = ((remaining / total) * 100) + '%';
    if (remaining <= 5)             fill.className = 'mon-timer-fill danger';
    else if (remaining <= total * 0.3) fill.className = 'mon-timer-fill warning';
    if (remaining <= 0) stopTimer();
  }, 80);
}

// ── Countdown overlay ─────────────────────────────────────────────────────────
function startCountdown(onDone) {
  const overlay = document.getElementById('mon-countdown-overlay');
  const numEl   = document.getElementById('mon-countdown-number');
  if (!overlay || !numEl) { onDone?.(); return; }
  const steps = [3, 2, 1, 'GO'];
  let i = 0;
  countdownActive = true;
  overlay.classList.remove('hidden');
  function tick() {
    numEl.textContent  = steps[i];
    numEl.className    = 'mon-countdown-number' + (steps[i] === 'GO' ? ' go' : '');
    i++;
    if (i < steps.length) setTimeout(tick, 900);
    else {
      overlay.classList.add('hidden');
      countdownActive = false;
      onDone?.();
      if (pendingTimeLimit !== null) {
        startTimer(pendingTimeLimit);
        pendingTimeLimit = null;
      }
    }
  }
  tick();
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
function updateScoreboard(scores) {
  const el = document.getElementById('mon-scoreboard');
  if (!el) return;
  const ranks = ['🥇','🥈','🥉'];
  el.innerHTML = scores.map((team, i) => `
    <div class="mon-score-row">
      <span class="mon-score-rank">${ranks[i] || (i + 1) + '.'}</span>
      <div class="mon-score-avatar">${avatar(team)}</div>
      <span class="mon-score-name">${esc(team.name)}</span>
      <span class="mon-score-pts">${team.score} pts</span>
    </div>`).join('');
}

// ── Question display ──────────────────────────────────────────────────────────
function showQuestion(q) {
  currentQuestion = q;

  // Stats bar
  document.getElementById('mon-round-label').textContent    = `Round ${roundNum}`;
  document.getElementById('mon-q-label').textContent        = `Q ${(q.roundIndex ?? 0) + 1} / ${q.roundTotal ?? '?'}`;
  document.getElementById('mon-category-label').textContent = q.category || '';

  // Reset reveal area
  const revealArea = document.getElementById('mon-reveal-area');
  if (revealArea) revealArea.classList.add('hidden');
  document.getElementById('mon-distribution').innerHTML  = '';
  document.getElementById('mon-correct-banner').textContent = '';

  document.getElementById('mon-question-text').textContent = q.question;

  const area = document.getElementById('mon-answers-area');
  area.innerHTML = '';
  area.className = 'mon-answers-area';

  if (q.type === 'multiple_choice' && q.answers) {
    area.className += ' mon-answers-mc';
    area.innerHTML = q.answers.map((a, i) => `
      <div class="mon-mc-btn" data-idx="${i}">
        <span class="mon-mc-letter">${['A','B','C','D'][i]}</span>
        <span class="mon-mc-text">${esc(a)}</span>
      </div>`).join('');

  } else if (q.type === 'estimation') {
    area.innerHTML = `<div class="mon-est-placeholder">
      <span class="mon-est-icon">🔢</span>
      Teams are estimating…${q.unit ? ' <em>(' + esc(q.unit) + ')</em>' : ''}
    </div>`;

  } else if (q.type === 'word_order' && q.words) {
    area.className += ' mon-answers-wo';
    const shuffled = [...q.words.keys()].sort(() => Math.random() - 0.5);
    area.innerHTML = `<div class="mon-wo-chips">${
      shuffled.map(i => `<div class="mon-wo-chip">${esc(q.words[i])}</div>`).join('')
    }</div>`;
  }
}

// ── Reveal ────────────────────────────────────────────────────────────────────
function showReveal(correct, distribution, q) {
  if (!q) return;
  const revealArea    = document.getElementById('mon-reveal-area');
  const correctBanner = document.getElementById('mon-correct-banner');
  revealArea.classList.remove('hidden');

  if (q.type === 'multiple_choice') {
    const label = q.answers?.[correct] ?? String(correct);
    correctBanner.textContent = `✓ ${label}`;
    document.querySelectorAll('.mon-mc-btn').forEach((btn, i) => {
      btn.classList.remove('correct', 'wrong');
      btn.classList.add(i === correct ? 'correct' : 'wrong');
    });
  } else if (q.type === 'estimation') {
    correctBanner.textContent = `✓ ${correct} ${q.unit || ''}`;
  } else if (q.type === 'word_order') {
    const order = Array.isArray(correct) ? correct : [];
    correctBanner.textContent = `✓ ${order.map(i => q.words[i]).join(' → ')}`;
  }

  if (distribution) renderDistribution(distribution, q);
}

// ── Distribution charts ───────────────────────────────────────────────────────
function renderDistribution(dist, q) {
  const el = document.getElementById('mon-distribution');
  if (!el) return;

  if (dist.type === 'multiple_choice') {
    const max = Math.max(...dist.counts, 1);
    const total = dist.counts.reduce((a, b) => a + b, 0) || 1;
    el.innerHTML = dist.labels.map((label, i) => {
      const count   = dist.counts[i];
      const pct     = Math.round((count / max) * 100);
      const sharePct = Math.round((count / total) * 100);
      const correct = i === dist.correct;
      return `
        <div class="mon-dist-row ${correct ? 'mon-dist-correct' : ''}">
          <span class="mon-dist-letter">${['A','B','C','D'][i]}</span>
          <span class="mon-dist-label">${esc(label)}</span>
          <div class="mon-dist-bar-wrap">
            <div class="mon-dist-bar" style="width:${pct}%"></div>
          </div>
          <span class="mon-dist-count">${count} <small>${sharePct}%</small></span>
        </div>`;
    }).join('');

  } else if (dist.type === 'estimation') {
    if (!dist.submissions?.length) return;
    const values  = dist.submissions.map(s => s.value);
    const allVals = [...values, dist.correctValue];
    const min     = Math.min(...allVals);
    const max     = Math.max(...allVals);
    const range   = max - min || 1;
    const pos     = v => Math.round(((v - min) / range) * 100);

    el.innerHTML = `
      <div class="mon-numberline">
        <div class="mon-nl-track">
          <div class="mon-nl-correct-line" style="left:${pos(dist.correctValue)}%"></div>
          ${dist.submissions.map(s => `
            <div class="mon-nl-dot ${s.value === dist.correctValue ? 'winner' : ''}"
                 style="left:${pos(s.value)}%" title="${esc(s.name)}: ${s.value}"></div>`).join('')}
        </div>
        <div class="mon-nl-labels">
          ${dist.submissions.slice(0, 16).map(s => `
            <div class="mon-nl-chip ${s.value === dist.correctValue ? 'winner' : ''}"
                 style="left:${pos(s.value)}%">
              <div class="mon-nl-chip-name">${esc(s.name)}</div>
              <div>${s.value}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="mon-nl-legend">▼ Correct answer: <strong>${dist.correctValue} ${esc(dist.unit || '')}</strong></div>`;

  } else if (dist.type === 'word_order') {
    const total  = dist.total || 1;
    const pct    = Math.round((dist.correct / total) * 100);
    const wrongPct = 100 - pct;
    el.innerHTML = `
      <div class="mon-wo-dist">
        <div class="mon-wo-bar-wrap">
          <div class="mon-wo-seg correct" style="width:${pct}%"></div>
          <div class="mon-wo-seg wrong"   style="width:${wrongPct}%"></div>
        </div>
        <div class="mon-wo-labels">
          <span class="mon-wo-correct-lbl">✓ ${dist.correct} correct (${pct}%)</span>
          <span class="mon-wo-wrong-lbl">✗ ${dist.wrong} wrong (${wrongPct}%)</span>
        </div>
      </div>
      ${q?.type === 'word_order' && Array.isArray(dist.correctOrder)
        ? `<div class="mon-wo-correct-order">${dist.correctOrder.map(i => `<span class="mon-wo-chip">${esc(q.words[i])}</span>`).join('<span class="mon-wo-arrow">→</span>')}</div>`
        : ''}`;
  }
}

// ── Lobby helpers ─────────────────────────────────────────────────────────────
function renderLobby(teams) {
  const grid = document.getElementById('mon-lobby-teams');
  if (!grid) return;
  grid.innerHTML = teams.map(team => `
    <div class="mon-lobby-chip" data-chip="${esc(team.id)}">
      <div class="mon-lobby-avatar">${avatar(team)}</div>
      <span>${esc(team.name)}</span>
    </div>`).join('');
}

function addTeamChip(team) {
  const grid = document.getElementById('mon-lobby-teams');
  if (!grid) return;
  if (grid.querySelector(`[data-chip="${esc(team.id)}"]`)) return; // already present
  const chip = document.createElement('div');
  chip.className      = 'mon-lobby-chip';
  chip.dataset.chip   = team.id;
  chip.innerHTML      = `<div class="mon-lobby-avatar">${avatar(team)}</div><span>${esc(team.name)}</span>`;
  grid.appendChild(chip);
}

// ── Standings / Game over ─────────────────────────────────────────────────────
function showStandings(scores, rn) {
  showScreen('screen-standings');
  const badge = document.getElementById('mon-standings-badge');
  const grid  = document.getElementById('mon-standings-grid');
  if (badge) badge.textContent = `Round ${rn} Complete!`;
  if (!grid) return;
  const ranks = ['🥇','🥈','🥉'];
  grid.innerHTML = scores.map((team, i) => `
    <div class="mon-standings-row">
      <span class="mon-standings-rank">${ranks[i] || (i + 1) + '.'}</span>
      <div class="mon-standings-avatar">${avatar(team, 'lg')}</div>
      <span class="mon-standings-name">${esc(team.name)}</span>
      <span class="mon-standings-pts">${team.score} pts</span>
    </div>`).join('');
}

function showGameOver(scores) {
  showScreen('screen-gameover');
  const podium = document.getElementById('mon-podium');
  const list   = document.getElementById('mon-final-list');

  // Podium: display order 2nd · 1st · 3rd
  if (podium) {
    const top3 = scores.slice(0, 3);
    const order = [1, 0, 2].filter(i => top3[i]);
    podium.innerHTML = order.map(i => {
      const team = top3[i];
      const heights = { 0: '160px', 1: '120px', 2: '90px' };
      const labels  = { 0: '🥇', 1: '🥈', 2: '🥉' };
      return `
        <div class="mon-podium-entry p${i + 1}">
          <div class="mon-podium-avatar">${avatar(team, 'xl')}</div>
          <div class="mon-podium-name">${esc(team.name)}</div>
          <div class="mon-podium-score">${team.score} pts</div>
          <div class="mon-podium-block" style="height:${heights[i]}">
            <span>${labels[i]}</span>
          </div>
        </div>`;
    }).join('');
  }

  if (list) {
    list.innerHTML = scores.slice(3).map((team, i) => `
      <div class="mon-final-row">
        <span class="mon-final-rank">${i + 4}.</span>
        <div class="mon-final-avatar">${avatar(team)}</div>
        <span class="mon-final-name">${esc(team.name)}</span>
        <span class="mon-final-pts">${team.score} pts</span>
      </div>`).join('');
  }
}

// ── Overlay helper ────────────────────────────────────────────────────────────
function flashOverlay(id, ms) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), ms);
}

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('connect', () => {
  document.getElementById('reconnect-banner').classList.add('hidden');
  socket.emit('monitor-join', { code });
});

socket.on('disconnect', () => {
  document.getElementById('reconnect-banner').classList.remove('hidden');
});

socket.on('error', ({ message }) => {
  alert('Monitor: ' + message);
});

socket.on('monitor-joined', ({ event, teams, roundNum: rn, reconnectState }) => {
  teamCount = teams.length;
  roundNum  = rn || 0;
  document.getElementById('mon-code-display').textContent = code;
  document.getElementById('mon-teams-label').textContent  = `${teamCount} team${teamCount !== 1 ? 's' : ''}`;
  renderLobby(teams);

  if (reconnectState) {
    const { currentStep, currentQuestion: q, timerRemaining, answeredCount, totalTeams, scores, distribution, correct } = reconnectState;
    roundNum  = reconnectState.roundNum || rn || 1;
    teamCount = totalTeams ?? teams.length;
    showScreen('screen-game');
    if (q) showQuestion(q);
    if (scores) updateScoreboard(scores);
    setTally(answeredCount ?? 0, teamCount);

    if (currentStep === 'answers-shown' && timerRemaining > 0) startTimer(timerRemaining);
    else if (currentStep === 'revealed' && q)                  showReveal(correct, distribution, q);
  } else {
    showScreen('screen-lobby');
  }
});

socket.on('team-arrived', ({ team, totalTeams }) => {
  teamCount = totalTeams;
  document.getElementById('mon-teams-label').textContent = `${teamCount} team${teamCount !== 1 ? 's' : ''}`;
  addTeamChip(team);
});

socket.on('round-started', ({ roundNum: rn }) => {
  roundNum = rn;
  showScreen('screen-game');
  document.getElementById('mon-round-label').textContent = `Round ${rn}`;
  setTally(0, teamCount);
});

socket.on('question-text', (q) => {
  currentQuestion = q;
  showScreen('screen-game');
  showQuestion(q);
  stopTimer();
  setTally(0, teamCount);
});

socket.on('question-answers', (q) => {
  currentQuestion = q;
  showQuestion(q);
  startCountdown();
});

socket.on('question-start', ({ timeLimit }) => {
  if (countdownActive) pendingTimeLimit = timeLimit;
  else startTimer(timeLimit);
});

socket.on('answer-tally', ({ count, total }) => {
  teamCount = total;
  setTally(count, total);
});

socket.on('answer-revealed', ({ correct, scores, distribution }) => {
  stopTimer();
  countdownActive  = false;
  pendingTimeLimit = null;
  if (scores) updateScoreboard(scores);
  showReveal(correct, distribution, currentQuestion);
});

socket.on('first-correct', ({ team, points, questionType }) => {
  document.getElementById('mon-buzz-icon').textContent  = questionType === 'estimation' ? '🎯' : '⚡';
  document.getElementById('mon-buzz-title').textContent = questionType === 'estimation' ? 'Best Estimate!' : 'First Correct!';
  document.getElementById('mon-buzz-name').textContent  = team.name;
  document.getElementById('mon-buzz-pts').textContent   = `+${points} pts`;
  document.getElementById('mon-buzz-avatar').innerHTML  = `<div class="mon-buzz-av">${avatar(team, 'xl')}</div>`;
  flashOverlay('mon-buzz-overlay', 4000);
});

socket.on('lone-hero', ({ team, points }) => {
  document.getElementById('mon-buzz-icon').textContent  = '🦸';
  document.getElementById('mon-buzz-title').textContent = 'Solo Correct!';
  document.getElementById('mon-buzz-name').textContent  = team.name;
  document.getElementById('mon-buzz-pts').textContent   = `+${points} pts`;
  document.getElementById('mon-buzz-avatar').innerHTML  = `<div class="mon-buzz-av">${avatar(team, 'xl')}</div>`;
  flashOverlay('mon-buzz-overlay', 4000);
});

socket.on('precise-estimate', ({ team, points }) => {
  document.getElementById('mon-buzz-icon').textContent  = '🎯';
  document.getElementById('mon-buzz-title').textContent = 'Spot On!';
  document.getElementById('mon-buzz-name').textContent  = team.name;
  document.getElementById('mon-buzz-pts').textContent   = `+${points} pts`;
  document.getElementById('mon-buzz-avatar').innerHTML  = `<div class="mon-buzz-av">${avatar(team, 'xl')}</div>`;
  flashOverlay('mon-buzz-overlay', 3500);
});

socket.on('worst-estimate', ({ team }) => {
  document.getElementById('mon-buzz-icon').textContent  = '📉';
  document.getElementById('mon-buzz-title').textContent = 'Off the Charts!';
  document.getElementById('mon-buzz-name').textContent  = team.name;
  document.getElementById('mon-buzz-pts').textContent   = '';
  document.getElementById('mon-buzz-avatar').innerHTML  = `<div class="mon-buzz-av">${avatar(team, 'xl')}</div>`;
  flashOverlay('mon-buzz-overlay', 3000);
});

socket.on('round-over',      ({ scores, roundNum: rn }) => { stopTimer(); showStandings(scores, rn); });
socket.on('scoreboard-shown',({ scores, roundNum: rn }) => { showStandings(scores, rn); });
socket.on('game-over',       ({ scores })               => { stopTimer(); showGameOver(scores); });

// ── Tally helper ──────────────────────────────────────────────────────────────
function setTally(count, total) {
  const el = document.getElementById('mon-tally');
  if (el) el.textContent = `${count} / ${total} answered`;
}
