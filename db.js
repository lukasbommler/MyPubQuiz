// In-memory store with JSON file persistence — no native compilation needed
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'quiz-data.json');

let store = { events: {}, teams: {}, answers: [] };

// Load persisted data on startup
if (fs.existsSync(DATA_FILE)) {
  try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) {}
}

// Cleanup events older than 24 hours
const cutoff = Date.now() - 86400 * 1000;
for (const code of Object.keys(store.events)) {
  if (store.events[code].created_at < cutoff) {
    delete store.events[code];
    for (const id of Object.keys(store.teams)) {
      if (store.teams[id].event_code === code) delete store.teams[id];
    }
    store.answers = store.answers.filter(a => a.event_code !== code);
  }
}

function save() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(store)); } catch (e) {}
}

// ── Events ────────────────────────────────────────────────────────────────────
function createEvent(code, hostToken) {
  store.events[code] = { code, host_token: hostToken, status: 'lobby', current_question_index: 0, created_at: Date.now() };
  save();
}

function getEvent(code) { return store.events[code] || null; }

function updateEvent(code, fields) {
  if (!store.events[code]) return;
  Object.assign(store.events[code], fields);
  save();
}

function codeExists(code) { return !!store.events[code]; }

// ── Teams ─────────────────────────────────────────────────────────────────────
function createTeam(id, eventCode, name) {
  store.teams[id] = { id, event_code: eventCode, name, selfie: null, score: 0, joined_at: Date.now() };
  save();
  return store.teams[id];
}

function getTeam(id) { return store.teams[id] || null; }

function getTeamByEventAndId(id, eventCode) {
  const t = store.teams[id];
  return t && t.event_code === eventCode ? t : null;
}

function getTeamsByEvent(code) {
  return Object.values(store.teams)
    .filter(t => t.event_code === code)
    .sort((a, b) => a.joined_at - b.joined_at);
}

function updateTeam(id, fields) {
  if (!store.teams[id]) return;
  Object.assign(store.teams[id], fields);
  save();
}

function addScore(teamId, pts) {
  if (!store.teams[teamId]) return;
  store.teams[teamId].score = (store.teams[teamId].score || 0) + pts;
  save();
}

function getScoresByEvent(code) {
  return getTeamsByEvent(code).sort((a, b) => b.score - a.score);
}

// ── Answers ───────────────────────────────────────────────────────────────────
let answerIdCounter = store.answers.length;

function recordAnswer(eventCode, teamId, questionIndex, answer, isCorrect, pointsAwarded, timeMs) {
  const rec = { id: ++answerIdCounter, event_code: eventCode, team_id: teamId, question_index: questionIndex, answer, is_correct: isCorrect ? 1 : 0, points_awarded: pointsAwarded, time_ms: timeMs, answered_at: Date.now() };
  store.answers.push(rec);
  save();
  return rec;
}

function hasAnswered(eventCode, teamId, questionIndex) {
  return store.answers.some(a => a.event_code === eventCode && a.team_id === teamId && a.question_index === questionIndex);
}

function getAnswersByQuestion(eventCode, questionIndex) {
  return store.answers.filter(a => a.event_code === eventCode && a.question_index === questionIndex);
}

function updateAnswer(id, fields) {
  const a = store.answers.find(a => a.id === id);
  if (a) { Object.assign(a, fields); save(); }
}

module.exports = {
  createEvent, getEvent, updateEvent, codeExists,
  createTeam, getTeam, getTeamByEventAndId, getTeamsByEvent, updateTeam, addScore, getScoresByEvent,
  recordAnswer, hasAnswered, getAnswersByQuestion, updateAnswer
};
