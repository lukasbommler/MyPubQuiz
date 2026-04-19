const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { execSync } = require('child_process');

const db = require('./db');
const { loadQuestions, flagQuestion, getFlags, dismissFlag } = require('./questions-db');
const questionsByLang = { en: [], de: [] }; // loaded at startup

// Returns the question list for a given game code (falls back to 'en')
function getQ(code) {
  const lang = gameState[code]?.lang || 'en';
  return questionsByLang[lang] || questionsByLang.en;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function safeQuestion(q, index, total) {
  const safe = { ...q, index, total };
  delete safe.correct;
  delete safe.correct_value;
  return safe;
}

// For word_order the correct answer is [0,1,2,...] — the words array in order
function correctAnswer(q) {
  if (q.type === 'word_order') return q.words.map((_, i) => i);
  return q.correct ?? q.correct_value;
}

// In-memory game state (ephemeral, not persisted)
const gameState = {}; // code -> { lang, buzzedTeams, timerInterval, ... }

// ─── REST Routes ──────────────────────────────────────────────────────────────

app.post('/api/event/create', (req, res) => {
  let code = generateCode();
  while (db.codeExists(code)) code = generateCode();
  const hostToken = uuidv4();
  db.createEvent(code, hostToken);
  console.log(`[GAME] created code=${code}`);
  res.json({ code, hostToken });
});

// Accepts { base64: "data:image/jpeg;base64,..." }
app.post('/api/team/:teamId/selfie', express.json({ limit: '8mb' }), (req, res) => {
  const { teamId } = req.params;
  const team = db.getTeam(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const { base64 } = req.body;
  if (!base64 || !base64.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image' });

  // Strip the data URL header and save as file
  const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Bad base64' });
  const ext = matches[1] === 'png' ? 'png' : 'jpg';
  const filename = `${uuidv4()}.${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));

  const selfieUrl = `/uploads/${filename}`;
  db.updateTeam(teamId, { selfie: selfieUrl });

  io.to(`host:${team.event_code}`).emit('team-selfie-updated', { teamId, selfieUrl });
  res.json({ selfieUrl });
});

app.get('/api/questions', (req, res) => {
  const lang = req.query.lang || 'en';
  const qs = questionsByLang[lang] || questionsByLang.en;
  const categories = [...new Set(qs.map(q => q.category))];
  res.json({ total: qs.length, categories });
});

// ─── Admin logs page ──────────────────────────────────────────────────────────

const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';

app.get('/admin/logs', (req, res) => {
  if (!requireAdmin(req, res)) return;

  let lines = '';
  try {
    lines = execSync('journalctl -u quizapp --no-pager -n 300 --output=short-iso', { timeout: 5000 }).toString();
  } catch {
    lines = '(could not read journal — run as root or grant journalctl access)';
  }

  const escaped = lines.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const colored = escaped
    .replace(/(\[CONN\][^\n]*)/g, '<span class="conn">$1</span>')
    .replace(/(\[GAME\] created[^\n]*)/g,      '<span class="created">$1</span>')
    .replace(/(\[GAME\] team-joined[^\n]*)/g,  '<span class="team">$1</span>')
    .replace(/(\[GAME\] round-started[^\n]*)/g,'<span class="round">$1</span>')
    .replace(/(\[GAME\] answer[^\n]*correct=true[^\n]*)/g, '<span class="correct">$1</span>')
    .replace(/(\[GAME\] answer[^\n]*correct=false[^\n]*)/g,'<span class="wrong">$1</span>')
    .replace(/(\[GAME\] revealed[^\n]*)/g,     '<span class="revealed">$1</span>')
    .replace(/(\[GAME\] round-over[^\n]*)/g,   '<span class="roundover">$1</span>')
    .replace(/(\[GAME\] ended[^\n]*)/g,        '<span class="ended">$1</span>');

  const totalGames  = db.db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  const totalTeams  = db.db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
  const activeGames = Object.values(gameState).filter(s => s.currentStep !== null).length;

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>QuizApp Logs</title>
  <meta http-equiv="refresh" content="15">
  <style>
    body  { background:#0a0a0a; color:#ccc; font:13px/1.5 monospace; margin:0; padding:1rem; }
    h1    { color:#fff; font-size:1.1rem; margin:0 0 .5rem; }
    .stats { display:flex; gap:2rem; margin-bottom:1rem; }
    .stat  { background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:.5rem 1rem; }
    .stat strong { display:block; font-size:1.4rem; color:#fff; }
    .stat span   { font-size:.75rem; color:#888; }
    pre   { background:#111; border:1px solid #222; border-radius:8px; padding:1rem;
            overflow-x:auto; white-space:pre-wrap; word-break:break-all; }
    .conn     { color:#666; }
    .created  { color:#60a5fa; }
    .team     { color:#a78bfa; }
    .round    { color:#fbbf24; }
    .correct  { color:#34d399; }
    .wrong    { color:#f87171; }
    .revealed { color:#94a3b8; }
    .roundover{ color:#fb923c; }
    .ended    { color:#f43f5e; }
    .hint { font-size:.75rem; color:#555; margin-bottom:.5rem; }
  </style></head><body>
  <h1>QuizApp — Live Logs</h1>
  <a style="color:#60a5fa;font-size:.85rem;display:inline-block;margin-bottom:1rem;text-decoration:none" href="/admin/flags">🚩 Flagged questions →</a>
  <div class="stats">
    <div class="stat"><strong>${totalGames}</strong><span>Total games</span></div>
    <div class="stat"><strong>${totalTeams}</strong><span>Total teams</span></div>
    <div class="stat"><strong>${activeGames}</strong><span>Active rounds</span></div>
    <div class="stat"><strong>${io.engine.clientsCount}</strong><span>Connected now</span></div>
  </div>
  <div class="hint">Auto-refreshes every 15s &nbsp;·&nbsp; Showing last 300 journal lines</div>
  <pre>${colored}</pre>
  </body></html>`);
});

// ─── Admin flags page ─────────────────────────────────────────────────────────

function requireAdmin(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).send('Unauthorized');
    return false;
  }
  const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (user !== 'admin' || pass !== ADMIN_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).send('Unauthorized');
    return false;
  }
  return true;
}

app.get('/admin/flags', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const flags = await getFlags();

  // Group by source_id (null source_id each counted separately)
  const grouped = {};
  for (const f of flags) {
    const key = f.source_id ?? `_${f.id}`;
    if (!grouped[key]) grouped[key] = { source_id: f.source_id, question_text: f.question_text, language: f.language, flags: [] };
    grouped[key].flags.push(f);
  }
  const groups = Object.values(grouped).sort((a, b) => b.flags.length - a.flags.length);

  const e = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const rows = groups.map(g => {
    const flagRows = g.flags.map(f => `
      <tr>
        <td>${e(f.reason === 'incorrect' ? '❌ Wrong answer' : '❓ Nonsensical')}</td>
        <td>${e(f.game_code ?? '—')}</td>
        <td>${e(f.flagged_at)}</td>
        <td><a href="/admin/flags/${f.id}/dismiss" class="dismiss" onclick="return confirm('Dismiss this flag?')">dismiss</a></td>
      </tr>`).join('');
    return `
      <tr class="group-header">
        <td colspan="4">
          <span class="sid">${g.source_id != null ? 'ID ' + e(g.source_id) : 'no source_id'}</span>
          <span class="lang">${e(g.language ?? '?')}</span>
          <span class="count">${g.flags.length}×</span>
          <span class="qtext">${e(g.question_text)}</span>
        </td>
      </tr>
      ${flagRows}`;
  }).join('');

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>QuizApp — Flagged Questions</title>
  <style>
    body  { background:#0a0a0a; color:#ccc; font:13px/1.5 monospace; margin:0; padding:1rem; }
    h1    { color:#fff; font-size:1.1rem; margin:0 0 .5rem; }
    .stats { display:flex; gap:2rem; margin-bottom:1rem; }
    .stat  { background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:.5rem 1rem; }
    .stat strong { display:block; font-size:1.4rem; color:#fff; }
    .stat span   { font-size:.75rem; color:#888; }
    table { width:100%; border-collapse:collapse; background:#111; border:1px solid #222; border-radius:8px; overflow:hidden; }
    th { background:#1a1a1a; color:#888; font-size:.75rem; text-align:left; padding:.4rem .75rem; }
    td { padding:.35rem .75rem; border-top:1px solid #1a1a1a; vertical-align:top; }
    .group-header td { background:#161616; padding:.5rem .75rem; border-top:2px solid #2a2a2a; }
    .sid   { color:#60a5fa; margin-right:.5rem; font-weight:700; }
    .lang  { color:#888; margin-right:.5rem; font-size:.8rem; }
    .count { color:#f97316; font-weight:700; margin-right:.75rem; }
    .qtext { color:#e2e8f0; }
    .dismiss { color:#f87171; text-decoration:none; }
    .dismiss:hover { text-decoration:underline; }
    .empty { color:#555; padding:1rem; }
    a.back { color:#60a5fa; font-size:.85rem; display:inline-block; margin-bottom:1rem; text-decoration:none; }
    a.back:hover { text-decoration:underline; }
  </style></head><body>
  <h1>QuizApp — Flagged Questions</h1>
  <a class="back" href="/admin/logs">← Logs</a>
  <div class="stats">
    <div class="stat"><strong>${flags.length}</strong><span>Total flags</span></div>
    <div class="stat"><strong>${groups.length}</strong><span>Unique questions</span></div>
  </div>
  ${flags.length === 0 ? '<p class="empty">No flagged questions yet.</p>' : `
  <table>
    <thead><tr><th>Reason</th><th>Game</th><th>When</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
  </body></html>`);
});

app.get('/admin/flags/:id/dismiss', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  await dismissFlag(req.params.id);
  res.redirect('/admin/flags');
});

// ─── Pages ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/host/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/game/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[CONN] connected  id=${socket.id} total=${io.engine.clientsCount}`);
  socket.on('disconnect', () => {
    const role = socket.data?.role ?? 'unknown';
    const code = socket.data?.code ?? '-';
    console.log(`[CONN] disconnected id=${socket.id} role=${role} code=${code} total=${io.engine.clientsCount}`);
  });

  // ── Host joins ──────────────────────────────────────────────────────────────
  socket.on('host-join', ({ code, hostToken }) => {
    const event = db.getEvent(code);
    if (!event || event.host_token !== hostToken) {
      socket.emit('error', { message: 'Invalid host token' });
      return;
    }
    socket.join(`host:${code}`);
    socket.join(`room:${code}`);
    socket.data = { role: 'host', code };
    console.log(`[GAME] host-joined code=${code}`);

    const teams = db.getTeamsByEvent(code);
    const lang = gameState[code]?.lang || 'en';
    const qs = questionsByLang[lang] || questionsByLang.en;
    const state = gameState[code];

    // Build reconnect snapshot so the host panel can restore itself
    let reconnectState = null;
    if (state && event.status === 'running') {
      const qIndex = event.current_question_index;
      const q = qs[qIndex];
      const elapsed = state.questionStartedAt ? Math.floor((Date.now() - state.questionStartedAt) / 1000) : 0;
      const remaining = q ? Math.max(0, q.time_limit - elapsed) : 0;
      const scores = db.getScoresByEvent(code);
      const answers = db.getAnswersByQuestion(code, qIndex);
      reconnectState = {
        currentStep: state.currentStep,
        currentQuestion: q ? { ...q, index: qIndex, roundIndex: state.roundIndex ?? 0, roundTotal: state.roundQuestionIndices?.length ?? 1, time_limit: state.timeLimitSecs ?? q.time_limit } : null,
        timerRemaining: remaining,
        scores,
        answers: answers.map(a => ({ teamId: a.team_id, answer: a.answer, isCorrect: !!a.is_correct, points: a.points_awarded })),
        distribution: state.distribution ?? null,
        correct: q ? correctAnswer(q) : null,
        estimationWinnerId: state.estimationWinnerId ?? null,
      };
    }

    socket.emit('host-joined', {
      event,
      teams,
      lang,
      questions: qs.map((q, i) => ({ index: i, category: q.category, type: q.type, question: q.question })),
      currentQuestionIndex: event.current_question_index,
      hostTeamId: state?.hostTeamId || null,
      reconnectState,
    });
  });

  // ── Team joins ──────────────────────────────────────────────────────────────
  socket.on('team-join', ({ code, teamName, teamId }) => {
    const event = db.getEvent(code);
    if (!event) { socket.emit('error', { message: 'Game not found' }); return; }

    let team = null;
    if (teamId) team = db.getTeamByEventAndId(teamId, code);

    if (!team) {
      if (!teamName) { socket.emit('error', { message: 'Team name required' }); return; }
      team = db.createTeam(uuidv4(), code, teamName.trim().substring(0, 30));
      console.log(`[GAME] team-joined code=${code} team="${team.name}"`);
    }

    socket.join(`room:${code}`);
    socket.join(`team:${team.id}`);
    socket.data = { role: 'team', code, teamId: team.id };

    const allTeams = db.getTeamsByEvent(code);
    socket.emit('team-joined', { team, eventStatus: event.status, currentQuestionIndex: event.current_question_index, allTeams });
    io.to(`room:${code}`).emit('team-arrived', { team, totalTeams: allTeams.length });

    if (event.status === 'running') {
      const state = gameState[code];
      const qIndex = event.current_question_index;
      const q = getQ(code)[qIndex];
      if (q && state) {
        const safe = { ...safeQuestion(q, qIndex, getQ(code).length), roundIndex: state.roundIndex ?? 0, roundTotal: state.roundQuestionIndices?.length ?? 1 };
        const alreadyAnswered = db.hasAnswered(code, team.id, qIndex);

        if (state.currentStep === 'question-text') {
          socket.emit('question-text', safe);
        } else if (state.currentStep === 'answers-shown') {
          socket.emit('question-text', safe);
          socket.emit('question-answers', safe);
          if (!alreadyAnswered) {
            const elapsed = Math.floor((Date.now() - (state.questionStartedAt || Date.now())) / 1000);
            const remaining = Math.max(1, q.time_limit - elapsed);
            socket.emit('question-start', { index: qIndex, timeLimit: remaining });
          }
        } else if (state.currentStep === 'revealed') {
          const scores = db.getScoresByEvent(code);
          const correct = correctAnswer(q);
          socket.emit('question-text', safe);
          socket.emit('question-answers', safe);
          socket.emit('answer-revealed', { correct, scores, estimationWinnerId: state.estimationWinnerId ?? null, distribution: state.distribution ?? null });
        }
      }
    }
  });

  // ── Start round (works from lobby and between rounds) ───────────────────────
  socket.on('start-round', ({ code, categories, questionType, pointsCorrect, pointsBonus, pointsSpecial, timeLimitSecs, hostPlayerName }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event || event.status === 'running' || event.status === 'finished') return;

    const prev = gameState[code] || {};
    const roundNum = (prev.roundNum || 0) + 1;
    const usedIndices = prev.usedIndices || new Set();

    // Host player team — create on first round if playing
    let hostTeamId = prev.hostTeamId || null;
    if (hostPlayerName && !hostTeamId) {
      const hostTeam = db.createTeam(uuidv4(), code, hostPlayerName.trim().substring(0, 30));
      hostTeamId = hostTeam.id;
      socket.join(`team:${hostTeamId}`);
      const allTeams = db.getTeamsByEvent(code);
      io.to(`room:${code}`).emit('team-arrived', { team: hostTeam, totalTeams: allTeams.length });
    }
    if (hostTeamId) socket.emit('host-team-created', { teamId: hostTeamId });

    const indices = getQ(code)
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) => categories.includes(q.category) && q.type === questionType && !usedIndices.has(i))
      .map(({ i }) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    if (!indices.length) {
      socket.emit('error', { message: 'No questions match that selection.' });
      return;
    }

    indices.forEach(i => usedIndices.add(i));

    gameState[code] = {
      lang: prev.lang || 'en',
      usedIndices,
      hostTeamId,
      firstCorrectTeam: null, firstCorrectPoints: 0,
      roundQuestionIndices: indices,
      roundIndex: 0,
      roundNum,
      pointsCorrect: Math.max(1, parseInt(pointsCorrect) || 1),
      pointsBonus: Math.max(0, parseInt(pointsBonus) || 0),
      pointsSpecial: Math.max(0, parseInt(pointsSpecial) || 0),
      timeLimitSecs: Math.max(5, Math.min(300, parseInt(timeLimitSecs) || 20)),
      currentStep: null,
      questionStartedAt: null,
    };

    db.updateEvent(code, { status: 'running', current_question_index: indices[0] });
    const teamCount = db.getTeamsByEvent(code).length;
    console.log(`[GAME] round-started code=${code} round=${roundNum} teams=${teamCount} type=${questionType}`);
    io.to(`room:${code}`).emit('round-started', { roundNum, total: indices.length });
    sendQuestion(code, indices[0]);
  });

  // ── Host sends question text to players (step 1) ─────────────────────────
  socket.on('send-question', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;
    const q = getQ(code)[event.current_question_index];
    if (!q) return;
    const state = gameState[code] || {};
    const safe = { ...safeQuestion(q, event.current_question_index, getQ(code).length), roundIndex: state.roundIndex ?? 0, roundTotal: state.roundQuestionIndices?.length ?? 1 };
    io.to(`room:${code}`).except(`host:${code}`).emit('question-text', safe);

    // Estimation: skip the separate show-answers step — send input field immediately
    if (q.type === 'estimation' && gameState[code]) {
      const effectiveTimeLimit = gameState[code].timeLimitSecs ?? q.time_limit;
      io.to(`room:${code}`).except(`host:${code}`).emit('question-answers', safe);
      io.to(`room:${code}`).emit('question-start', { index: event.current_question_index, timeLimit: effectiveTimeLimit });
      io.to(`host:${code}`).emit('host-step', { step: 'answers-shown' });
      gameState[code].currentStep = 'answers-shown';
      gameState[code].questionStartedAt = Date.now();
      gameState[code].autoRevealTimeout = setTimeout(() => doRevealAnswer(code), effectiveTimeLimit * 1000);
    } else {
      io.to(`host:${code}`).emit('host-step', { step: 'question-sent' });
      if (gameState[code]) gameState[code].currentStep = 'question-text';
    }
  });

  // ── Replace current question (idle step only, before it's sent to players) ─
  socket.on('replace-question', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event || event.status !== 'running') return;
    const state = gameState[code];
    if (!state || state.currentStep !== null) return; // only before question is sent

    const currentIndex = event.current_question_index;
    const currentQ = getQ(code)[currentIndex];
    if (!currentQ) return;

    // Find a replacement with same type + category that hasn't been used
    const candidates = getQ(code)
      .map((q, i) => ({ q, i }))
      .filter(({ q, i }) =>
        i !== currentIndex &&
        !state.usedIndices.has(i) &&
        q.type === currentQ.type &&
        q.category === currentQ.category
      );

    if (!candidates.length) {
      socket.emit('error', { message: 'No replacement available for this type and category.' });
      return;
    }

    const { q: newQ, i: newIndex } = candidates[Math.floor(Math.random() * candidates.length)];

    // Swap indices: return old to the pool, mark new as used
    state.usedIndices.delete(currentIndex);
    state.usedIndices.add(newIndex);

    const roundPos = state.roundQuestionIndices.indexOf(currentIndex);
    if (roundPos !== -1) state.roundQuestionIndices[roundPos] = newIndex;

    db.updateEvent(code, { current_question_index: newIndex });

    io.to(`host:${code}`).emit('question-host', {
      ...newQ, index: newIndex, roundIndex: state.roundIndex, roundTotal: state.roundQuestionIndices.length
    });
  });

  // ── Host reveals answer options to players (step 2) ───────────────────────
  socket.on('show-answers', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;
    const q = getQ(code)[event.current_question_index];
    if (!q) return;
    const state = gameState[code] || {};
    if (state.currentStep === 'answers-shown') return; // estimation already advanced past this
    const safe = { ...safeQuestion(q, event.current_question_index, getQ(code).length), roundIndex: state.roundIndex ?? 0, roundTotal: state.roundQuestionIndices?.length ?? 1 };
    const effectiveTimeLimit = state.timeLimitSecs ?? q.time_limit;
    io.to(`room:${code}`).except(`host:${code}`).emit('question-answers', safe);
    io.to(`room:${code}`).emit('question-start', { index: event.current_question_index, timeLimit: effectiveTimeLimit });
    io.to(`host:${code}`).emit('host-step', { step: 'answers-shown' });
    if (gameState[code]) {
      gameState[code].currentStep = 'answers-shown';
      gameState[code].questionStartedAt = Date.now();
      // Auto-reveal once the time limit expires
      gameState[code].autoRevealTimeout = setTimeout(() => doRevealAnswer(code), effectiveTimeLimit * 1000);
    }
  });

  // ── Submit answer ───────────────────────────────────────────────────────────
  socket.on('submit-answer', ({ code, answer, timeTaken }) => {
    if (socket.data?.role !== 'team') return;
    const { teamId } = socket.data;
    const event = db.getEvent(code);
    if (!event || event.status !== 'running') return;

    const qIndex = event.current_question_index;
    const q = getQ(code)[qIndex];
    if (!q) return;

    if (db.hasAnswered(code, teamId, qIndex)) return;

    let isCorrect = false;
    if (q.type === 'multiple_choice') {
      isCorrect = parseInt(answer) === q.correct;
    } else if (q.type === 'word_order') {
      try { isCorrect = JSON.stringify(JSON.parse(answer)) === JSON.stringify(correctAnswer(q)); } catch (e) {}
    }

    const state = gameState[code];
    const basePoints = state?.pointsCorrect ?? 1;
    const bonusPoints = state?.pointsBonus ?? 0;
    const isFirst = isCorrect && !state?.firstCorrectTeam;
    let points = 0;

    if (isCorrect) {
      points = basePoints + (isFirst ? bonusPoints : 0);
      db.addScore(teamId, points);
    }

    db.recordAnswer(code, teamId, qIndex, String(answer), isCorrect, points, timeTaken);

    if (isFirst) {
      state.firstCorrectTeam = db.getTeam(teamId);
      state.firstCorrectPoints = points;
    }

    const teamName = db.getTeam(teamId)?.name ?? teamId;
    console.log(`[GAME] answer code=${code} team="${teamName}" q=${qIndex} type=${q.type} correct=${isCorrect} pts=${points} ms=${timeTaken}`);
    io.to(`host:${code}`).emit('answer-received', { teamId, isCorrect, points, answer, timeTaken });
    // Tell team their answer is locked in — correctness hidden until reveal
    socket.emit('answer-acknowledged', { received: true });

    // Auto-reveal early if every team has now answered
    checkAllAnswered(code, qIndex);
  });

  // ── Reveal results (step 3) — now triggered automatically by timer ────────
  socket.on('reveal-answer', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    doRevealAnswer(code);
  });

  // ── Next question ───────────────────────────────────────────────────────────
  socket.on('next-question', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;

    const state = gameState[code];
    if (state.autoRevealTimeout) { clearTimeout(state.autoRevealTimeout); state.autoRevealTimeout = null; }
    state.roundIndex++;
    state.firstCorrectTeam = null;
    state.firstCorrectPoints = 0;
    state.estimationWinnerId = null;
    state.loneHeroTeam = null;
    state.loneHeroPoints = 0;
    state.preciseTeam = null;
    state.precisePoints = 0;
    state.currentStep = null;
    state.questionStartedAt = null;
    state.distribution = null;

    if (state.roundIndex >= state.roundQuestionIndices.length) {
      db.updateEvent(code, { status: 'round-over' });
      const scores = db.getScoresByEvent(code);
      const top3 = scores.slice(0, 3).map((t, i) => `${i + 1}.${t.name}(${t.score})`).join(' ');
      console.log(`[GAME] round-over code=${code} round=${state.roundNum} teams=${scores.length} top3="${top3}"`);
      io.to(`room:${code}`).emit('round-over', { scores, roundNum: state.roundNum });
      return;
    }

    const nextQIndex = state.roundQuestionIndices[state.roundIndex];
    db.updateEvent(code, { current_question_index: nextQIndex });
    sendQuestion(code, nextQIndex);
  });

  // ── Show scoreboard to players ───────────────────────────────────────────────
  socket.on('show-scoreboard', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const scores = db.getScoresByEvent(code);
    const state = gameState[code];
    io.to(`room:${code}`).except(`host:${code}`).emit('scoreboard-shown', { scores, roundNum: state?.roundNum ?? 1 });
  });

  // ── Adjust score ────────────────────────────────────────────────────────────
  socket.on('adjust-score', ({ code, teamId, delta }) => {
    if (socket.data?.role !== 'host') return;
    db.addScore(teamId, delta);
    const scores = db.getScoresByEvent(code);
    io.to(`room:${code}`).emit('scores-updated', { scores });
  });

  // ── Set language (lobby only) ────────────────────────────────────────────────
  socket.on('set-language', ({ code, lang }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event || event.status === 'running') return; // can't change mid-game
    if (!questionsByLang[lang]) return;
    if (!gameState[code]) gameState[code] = {};
    gameState[code].lang = lang;
    const qs = questionsByLang[lang];
    socket.emit('language-changed', {
      lang,
      questions: qs.map((q, i) => ({ index: i, category: q.category, type: q.type })),
    });
  });

  // ── End round early ─────────────────────────────────────────────────────────
  socket.on('end-round', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event || event.status !== 'running') return;
    const state = gameState[code] || {};
    if (state.autoRevealTimeout) { clearTimeout(state.autoRevealTimeout); state.autoRevealTimeout = null; }
    db.updateEvent(code, { status: 'round-over' });
    const scores = db.getScoresByEvent(code);
    io.to(`room:${code}`).emit('round-over', { scores, roundNum: state.roundNum ?? 1 });
  });

  // ── Host submits answer (when playing along) ────────────────────────────────
  socket.on('host-submit-answer', ({ code, answer, timeTaken }) => {
    if (socket.data?.role !== 'host') return;
    const state = gameState[code];
    if (!state?.hostTeamId) return;
    const teamId = state.hostTeamId;

    const event = db.getEvent(code);
    if (!event || event.status !== 'running') return;

    const qIndex = event.current_question_index;
    const q = getQ(code)[qIndex];
    if (!q || db.hasAnswered(code, teamId, qIndex)) return;

    let isCorrect = false;
    if (q.type === 'multiple_choice') {
      isCorrect = parseInt(answer) === q.correct;
    } else if (q.type === 'word_order') {
      try { isCorrect = JSON.stringify(JSON.parse(answer)) === JSON.stringify(correctAnswer(q)); } catch (e) {}
    }

    const basePoints = state.pointsCorrect ?? 1;
    const bonusPoints = state.pointsBonus ?? 0;
    const isFirst = isCorrect && !state.firstCorrectTeam;
    let points = 0;

    if (isCorrect) {
      points = basePoints + (isFirst ? bonusPoints : 0);
      db.addScore(teamId, points);
    }

    db.recordAnswer(code, teamId, qIndex, String(answer), isCorrect, points, timeTaken);

    if (isFirst) {
      state.firstCorrectTeam = db.getTeam(teamId);
      state.firstCorrectPoints = points;
    }

    socket.emit('answer-received', { teamId, isCorrect, points, answer, timeTaken });

    // Auto-reveal early if every team has now answered
    checkAllAnswered(code, qIndex);
  });

  // ── End game ────────────────────────────────────────────────────────────────
  socket.on('end-game', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    endGame(code);
  });

  // ── Flag question ───────────────────────────────────────────────────────────
  socket.on('flag-question', async ({ sourceId, lang, questionText, reason }) => {
    const code = socket.data?.code;
    const validReasons = ['incorrect', 'nonsensical'];
    if (!validReasons.includes(reason) || !questionText) return;
    await flagQuestion(sourceId ?? null, lang ?? null, questionText, reason, code ?? null);
    console.log(`[FLAG] code=${code ?? '-'} sourceId=${sourceId ?? '-'} reason=${reason}`);
    socket.emit('flag-question-ack');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function doRevealAnswer(code) {
  const state = gameState[code];
  // Guard against double-reveal (e.g. timeout fires after host already moved on)
  if (!state || state.currentStep === 'revealed') return;

  // Cancel pending timeout if called early (e.g. from socket handler)
  if (state.autoRevealTimeout) { clearTimeout(state.autoRevealTimeout); state.autoRevealTimeout = null; }

  const event = db.getEvent(code);
  if (!event) return;
  const qIndex = event.current_question_index;
  const q = getQ(code)[qIndex];
  if (!q) return;

  const allAnswers = db.getAnswersByQuestion(code, qIndex);
  const specialPts = state.pointsSpecial ?? 0;

  // ── Estimation: closest wins; speed bonus only if multiple tied; precision bonus if within 2% ──
  let estimationWinnerId = null;
  if (q.type === 'estimation') {
    if (allAnswers.length > 0) {
      let minDiff = Infinity;
      for (const a of allAnswers) {
        const diff = Math.abs(parseFloat(a.answer) - q.correct_value);
        if (diff < minDiff) minDiff = diff;
      }
      const tied = allAnswers.filter(a => Math.abs(parseFloat(a.answer) - q.correct_value) === minDiff);
      tied.sort((a, b) => a.time_ms - b.time_ms);
      const winner = tied[0];
      if (winner) {
        const pts = state.pointsCorrect ?? 1;
        // Speed bonus only when multiple teams tie for closest
        const speedBonus = tied.length > 1 ? (state.pointsBonus ?? 0) : 0;
        const total = pts + speedBonus;
        db.addScore(winner.team_id, total);
        db.updateAnswer(winner.id, { is_correct: 1, points_awarded: total });
        estimationWinnerId = winner.team_id;
        const winnerTeam = db.getTeam(winner.team_id);
        state.firstCorrectTeam = winnerTeam;
        state.firstCorrectPoints = total;
        state.estimationWinnerId = estimationWinnerId;

        // Precision bonus: winner's answer must be exactly correct
        if (specialPts > 0 && parseFloat(winner.answer) === q.correct_value) {
          db.addScore(winner.team_id, specialPts);
          state.preciseTeam = winnerTeam;
          state.precisePoints = specialPts;
        }
      }
    }
  }

  // ── MC / Word Order: lone correct bonus if exactly 1 team answered correctly ──
  if (q.type === 'multiple_choice' || q.type === 'word_order') {
    const correctAnswerers = allAnswers.filter(a => a.is_correct);
    if (correctAnswerers.length === 1) {
      if (specialPts > 0) db.addScore(correctAnswerers[0].team_id, specialPts);
      state.loneHeroTeam = db.getTeam(correctAnswerers[0].team_id);
      state.loneHeroPoints = specialPts;
    }
  }

  // Fetch scores after all bonuses have been awarded
  const scores = db.getScoresByEvent(code);

  let distribution = null;
  if (q.type === 'multiple_choice') {
    const counts = new Array(q.answers.length).fill(0);
    for (const a of allAnswers) {
      const idx = parseInt(a.answer);
      if (idx >= 0 && idx < counts.length) counts[idx]++;
    }
    distribution = { type: 'multiple_choice', counts, labels: q.answers, correct: q.correct };
  } else if (q.type === 'estimation') {
    const submissions = allAnswers
      .map(a => ({ name: db.getTeam(a.team_id)?.name || '?', value: parseFloat(a.answer) }))
      .sort((a, b) => a.value - b.value);
    distribution = { type: 'estimation', submissions, correctValue: q.correct_value, unit: q.unit || '' };
  } else if (q.type === 'word_order') {
    const correct = allAnswers.filter(a => a.is_correct).length;
    distribution = { type: 'word_order', correct, wrong: allAnswers.length - correct, total: allAnswers.length };
  }

  state.currentStep = 'revealed';
  state.distribution = distribution;

  const correctCount = allAnswers.filter(a => a.is_correct).length;
  console.log(`[GAME] revealed code=${code} q=${qIndex} type=${q.type} answered=${allAnswers.length} correct=${correctCount}`);

  io.to(`room:${code}`).emit('answer-revealed', {
    correct: correctAnswer(q),
    scores,
    estimationWinnerId,
    distribution,
  });

  // First-correct buzz at 1500ms (buzz shows for 3500ms, ends ~5000ms after reveal)
  // Capture values now — next-question resets them on the live state object
  const buzzTeam = state.firstCorrectTeam;
  const buzzPoints = state.firstCorrectPoints;
  if (buzzTeam) {
    const buzzType = q.type;
    setTimeout(() => {
      io.to(`room:${code}`).emit('first-correct', { team: buzzTeam, points: buzzPoints, questionType: buzzType });
    }, 1500);
  }

  // Special animation at 5500ms — after buzz has finished
  const specialDelay = buzzTeam ? 5500 : 1000;
  const loneTeam = state.loneHeroTeam;
  const lonePoints = state.loneHeroPoints;
  const preciseTeam = state.preciseTeam;
  const precisePoints = state.precisePoints;

  const hasSpecialAnim = !!(loneTeam || preciseTeam);

  if (loneTeam) {
    setTimeout(() => {
      io.to(`room:${code}`).emit('lone-hero', { team: loneTeam, points: lonePoints });
    }, specialDelay);
  } else if (preciseTeam) {
    setTimeout(() => {
      io.to(`room:${code}`).emit('precise-estimate', { team: preciseTeam, points: precisePoints });
    }, specialDelay);
  }

  // Worst estimate: furthest-away team, shown after all other animations finish
  if (q.type === 'estimation' && allAnswers.length >= 2) {
    let maxDiff = -Infinity;
    for (const a of allAnswers) {
      const diff = Math.abs(parseFloat(a.answer) - q.correct_value);
      if (diff > maxDiff) maxDiff = diff;
    }
    const worstAnswer = allAnswers
      .filter(a => Math.abs(parseFloat(a.answer) - q.correct_value) === maxDiff)
      .sort((a, b) => b.time_ms - a.time_ms)[0]; // pick slowest if tied
    if (worstAnswer && worstAnswer.team_id !== estimationWinnerId) {
      const worstTeam = db.getTeam(worstAnswer.team_id);
      if (worstTeam) {
        const worstDelay = specialDelay + (hasSpecialAnim ? 4500 : 500);
        setTimeout(() => {
          io.to(`room:${code}`).emit('worst-estimate', { team: worstTeam });
        }, worstDelay);
      }
    }
  }
}

function checkAllAnswered(code, qIndex) {
  const state = gameState[code];
  if (!state || state.currentStep !== 'answers-shown') return;
  const allTeams = db.getTeamsByEvent(code);
  const allAnswers = db.getAnswersByQuestion(code, qIndex);
  if (allAnswers.length >= allTeams.length) {
    if (state.autoRevealTimeout) { clearTimeout(state.autoRevealTimeout); state.autoRevealTimeout = null; }
    doRevealAnswer(code);
  }
}

function sendQuestion(code, index) {
  const q = getQ(code)[index];
  if (!q) return;
  const state = gameState[code] || {};
  const roundIndex = state.roundIndex ?? 0;
  const roundTotal = state.roundQuestionIndices?.length ?? 1;
  // Override time_limit with host-configured value so the host timer is correct
  const time_limit = state.timeLimitSecs ?? q.time_limit;
  // Only send to host — players receive via send-question / show-answers
  io.to(`host:${code}`).emit('question-host', {
    ...q, index, roundIndex, roundTotal, time_limit
  });
}

function endGame(code) {
  db.updateEvent(code, { status: 'finished' });
  const scores = db.getScoresByEvent(code);
  console.log(`[GAME] ended code=${code} teams=${scores.length} top="${scores[0]?.name ?? '-'}" score=${scores[0]?.score ?? 0}`);
  io.to(`room:${code}`).emit('game-over', { scores });
}

// ─── Start ────────────────────────────────────────────────────────────────────

Promise.all([loadQuestions('en'), loadQuestions('de')]).then(([en, de]) => {
  questionsByLang.en = en;
  questionsByLang.de = de;
  console.log(`Loaded ${en.length} EN + ${de.length} DE questions`);
  server.listen(PORT, () => console.log(`Quiz App running at http://localhost:${PORT}`));
}).catch(err => { console.error('Failed to load questions:', err); process.exit(1); });
