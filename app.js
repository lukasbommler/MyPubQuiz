const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const db = require('./db');
const questions = require('./questions.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.json());
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
  delete safe.correct_order;
  return safe;
}

// In-memory game state (ephemeral, not persisted)
const gameState = {}; // code -> { buzzedTeams: [], timerInterval }

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
  const categories = [...new Set(questions.map(q => q.category))];
  res.json({ total: questions.length, categories });
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
    socket.emit('host-joined', {
      event,
      teams,
      questions: questions.map((q, i) => ({ index: i, category: q.category, type: q.type, question: q.question })),
      currentQuestionIndex: event.current_question_index
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

    socket.emit('team-joined', { team, eventStatus: event.status, currentQuestionIndex: event.current_question_index });
    io.to(`host:${code}`).emit('team-arrived', { team });

    if (event.status === 'running') {
      const q = questions[event.current_question_index];
      if (q) socket.emit('question', safeQuestion(q, event.current_question_index, questions.length));
    }
  });

  // ── Start game ──────────────────────────────────────────────────────────────
  socket.on('start-game', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event || event.status !== 'lobby') return;

    db.updateEvent(code, { status: 'running', current_question_index: 0 });
    gameState[code] = { firstCorrectTeam: null, firstCorrectPoints: 0 };

    io.to(`room:${code}`).emit('game-started');
    sendQuestion(code, 0); // sends only to host
  });

  // ── Host sends question text to players (step 1) ─────────────────────────
  socket.on('send-question', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;
    const q = questions[event.current_question_index];
    if (!q) return;
    const safe = safeQuestion(q, event.current_question_index, questions.length);
    io.to(`room:${code}`).except(`host:${code}`).emit('question-text', safe);
    io.to(`host:${code}`).emit('host-step', { step: 'question-sent' });
  });

  // ── Host reveals answer options to players (step 2) ───────────────────────
  socket.on('show-answers', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;
    const q = questions[event.current_question_index];
    if (!q) return;
    const safe = safeQuestion(q, event.current_question_index, questions.length);
    io.to(`room:${code}`).except(`host:${code}`).emit('question-answers', safe);
    io.to(`room:${code}`).emit('question-start', { index: event.current_question_index, timeLimit: q.time_limit });
    io.to(`host:${code}`).emit('host-step', { step: 'answers-shown' });
  });

  // ── Submit answer ───────────────────────────────────────────────────────────
  socket.on('submit-answer', ({ code, answer, timeTaken }) => {
    if (socket.data?.role !== 'team') return;
    const { teamId } = socket.data;
    const event = db.getEvent(code);
    if (!event || event.status !== 'running') return;

    const qIndex = event.current_question_index;
    const q = questions[qIndex];
    if (!q) return;

    if (db.hasAnswered(code, teamId, qIndex)) return;

    let isCorrect = false;
    if (q.type === 'multiple_choice') {
      isCorrect = parseInt(answer) === q.correct;
    } else if (q.type === 'word_order') {
      try { isCorrect = JSON.stringify(JSON.parse(answer)) === JSON.stringify(q.correct_order); } catch (e) {}
    }

    let points = 0;
    if (isCorrect) {
      const timeBonus = q.time_bonus ? Math.max(0, Math.round((1 - timeTaken / (q.time_limit * 1000)) * 50)) : 0;
      points = q.points + timeBonus;
      db.addScore(teamId, points);
    }

    db.recordAnswer(code, teamId, qIndex, String(answer), isCorrect, points, timeTaken);

    // Store first correct team — revealed only when host clicks Reveal Results
    const state = gameState[code];
    if (state && isCorrect && !state.firstCorrectTeam) {
      state.firstCorrectTeam = db.getTeam(teamId);
      state.firstCorrectPoints = points;
    }

    io.to(`host:${code}`).emit('answer-received', { teamId, isCorrect, points, answer, timeTaken });
    // Tell team their answer is locked in — correctness hidden until reveal
    socket.emit('answer-acknowledged', { received: true });
  });

  // ── Reveal results (step 3) ───────────────────────────────────────────────
  socket.on('reveal-answer', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;

    const qIndex = event.current_question_index;
    const q = questions[qIndex];
    if (!q) return;

    // Handle estimation winner
    if (q.type === 'estimation') {
      const answers = db.getAnswersByQuestion(code, qIndex);
      let closest = null, closestDiff = Infinity;
      for (const a of answers) {
        const diff = Math.abs(parseInt(a.answer) - q.correct_value);
        if (diff < closestDiff) { closestDiff = diff; closest = a; }
      }
      if (closest) {
        db.addScore(closest.team_id, q.points);
        db.updateAnswer(closest.id, { is_correct: 1, points_awarded: q.points });
        const winner = db.getTeam(closest.team_id);
        if (gameState[code]) {
          gameState[code].firstCorrectTeam = winner;
          gameState[code].firstCorrectPoints = q.points;
        }
      }
    }

    const scores = db.getScoresByEvent(code);

    // Send results to players first
    io.to(`room:${code}`).emit('answer-revealed', {
      correct: q.correct ?? q.correct_value ?? q.correct_order,
      scores
    });

    // Flash fastest correct team after a short delay
    const state = gameState[code];
    if (state?.firstCorrectTeam) {
      setTimeout(() => {
        io.to(`room:${code}`).emit('first-correct', {
          team: state.firstCorrectTeam,
          points: state.firstCorrectPoints
        });
      }, 1500);
    }
  });

  // ── Next question ───────────────────────────────────────────────────────────
  socket.on('next-question', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    const event = db.getEvent(code);
    if (!event) return;

    const nextIndex = event.current_question_index + 1;
    if (nextIndex >= questions.length) { endGame(code); return; }

    db.updateEvent(code, { current_question_index: nextIndex });
    gameState[code] = { firstCorrectTeam: null, firstCorrectPoints: 0 };
    sendQuestion(code, nextIndex); // sends only to host
  });

  // ── Adjust score ────────────────────────────────────────────────────────────
  socket.on('adjust-score', ({ code, teamId, delta }) => {
    if (socket.data?.role !== 'host') return;
    db.addScore(teamId, delta);
    const scores = db.getScoresByEvent(code);
    io.to(`room:${code}`).emit('scores-updated', { scores });
  });

  // ── End game ────────────────────────────────────────────────────────────────
  socket.on('end-game', ({ code }) => {
    if (socket.data?.role !== 'host') return;
    endGame(code);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendQuestion(code, index) {
  const q = questions[index];
  if (!q) return;
  // Only send to host — players receive question via send-question / show-answers
  io.to(`host:${code}`).emit('question-host', { ...q, index, total: questions.length });
}

function endGame(code) {
  db.updateEvent(code, { status: 'finished' });
  const scores = db.getScoresByEvent(code);
  io.to(`room:${code}`).emit('game-over', { scores });
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\nQuiz App running at http://localhost:${PORT}\n`);
});
