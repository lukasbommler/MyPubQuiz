const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const db = require('./db');
const { loadQuestions } = require('./questions-db');
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

// ─── Pages ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/host/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/game/:code', (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {

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
        currentQuestion: q ? { ...q, index: qIndex, roundIndex: state.roundIndex ?? 0, roundTotal: state.roundQuestionIndices?.length ?? 1 } : null,
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
  socket.on('start-round', ({ code, categories, questionType, pointsCorrect, pointsBonus, hostPlayerName }) => {
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
      currentStep: null,
      questionStartedAt: null,
    };

    db.updateEvent(code, { status: 'running', current_question_index: indices[0] });
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
    io.to(`host:${code}`).emit('host-step', { step: 'question-sent' });
    if (gameState[code]) gameState[code].currentStep = 'question-text';
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
    const safe = { ...safeQuestion(q, event.current_question_index, getQ(code).length), roundIndex: state.roundIndex ?? 0, roundTotal: state.roundQuestionIndices?.length ?? 1 };
    io.to(`room:${code}`).except(`host:${code}`).emit('question-answers', safe);
    io.to(`room:${code}`).emit('question-start', { index: event.current_question_index, timeLimit: q.time_limit });
    io.to(`host:${code}`).emit('host-step', { step: 'answers-shown' });
    if (gameState[code]) {
      gameState[code].currentStep = 'answers-shown';
      gameState[code].questionStartedAt = Date.now();
      // Auto-reveal once the time limit expires
      gameState[code].autoRevealTimeout = setTimeout(() => doRevealAnswer(code), q.time_limit * 1000);
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

    io.to(`host:${code}`).emit('answer-received', { teamId, isCorrect, points, answer, timeTaken });
    // Tell team their answer is locked in — correctness hidden until reveal
    socket.emit('answer-acknowledged', { received: true });
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
    state.currentStep = null;
    state.questionStartedAt = null;
    state.distribution = null;

    if (state.roundIndex >= state.roundQuestionIndices.length) {
      db.updateEvent(code, { status: 'round-over' });
      const scores = db.getScoresByEvent(code);
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
  });

  // ── End game ────────────────────────────────────────────────────────────────
  socket.on('end-game', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    endGame(code);
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

  // Handle estimation winner
  let estimationWinnerId = null;
  if (q.type === 'estimation') {
    const answers = db.getAnswersByQuestion(code, qIndex);
    let minDiff = Infinity;
    for (const a of answers) {
      const diff = Math.abs(parseFloat(a.answer) - q.correct_value);
      if (diff < minDiff) minDiff = diff;
    }
    const tied = answers.filter(a => Math.abs(parseFloat(a.answer) - q.correct_value) === minDiff);
    tied.sort((a, b) => a.time_ms - b.time_ms);
    const winner = tied[0];
    if (winner) {
      const pts = state.pointsCorrect ?? 1;
      const bonus = tied.length > 1 ? (state.pointsBonus ?? 0) : 0;
      const total = pts + bonus;
      db.addScore(winner.team_id, total);
      db.updateAnswer(winner.id, { is_correct: 1, points_awarded: total });
      estimationWinnerId = winner.team_id;
      const winnerTeam = db.getTeam(winner.team_id);
      state.firstCorrectTeam = winnerTeam;
      state.firstCorrectPoints = total;
      state.estimationWinnerId = estimationWinnerId;
    }
  }

  const scores = db.getScoresByEvent(code);

  const allAnswers = db.getAnswersByQuestion(code, qIndex);
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

  io.to(`room:${code}`).emit('answer-revealed', {
    correct: correctAnswer(q),
    scores,
    estimationWinnerId,
    distribution,
  });

  if (state.firstCorrectTeam) {
    setTimeout(() => {
      io.to(`room:${code}`).emit('first-correct', {
        team: state.firstCorrectTeam,
        points: state.firstCorrectPoints
      });
    }, 1500);
  }
}

function sendQuestion(code, index) {
  const q = getQ(code)[index];
  if (!q) return;
  const state = gameState[code] || {};
  const roundIndex = state.roundIndex ?? 0;
  const roundTotal = state.roundQuestionIndices?.length ?? 1;
  // Only send to host — players receive via send-question / show-answers
  io.to(`host:${code}`).emit('question-host', {
    ...q, index, roundIndex, roundTotal
  });
}

function endGame(code) {
  db.updateEvent(code, { status: 'finished' });
  const scores = db.getScoresByEvent(code);
  io.to(`room:${code}`).emit('game-over', { scores });
}

// ─── Start ────────────────────────────────────────────────────────────────────

Promise.all([loadQuestions('en'), loadQuestions('de')]).then(([en, de]) => {
  questionsByLang.en = en;
  questionsByLang.de = de;
  console.log(`Loaded ${en.length} EN + ${de.length} DE questions`);
  server.listen(PORT, () => console.log(`Quiz App running at http://localhost:${PORT}`));
}).catch(err => { console.error('Failed to load questions:', err); process.exit(1); });
