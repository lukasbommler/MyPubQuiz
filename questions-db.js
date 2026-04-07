const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'questions.db');

let _db = null;

async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    _db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    _db = new SQL.Database();
  }
  _db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category      TEXT    NOT NULL,
      type          TEXT    NOT NULL,
      time_limit    INTEGER NOT NULL DEFAULT 20,
      correct_index INTEGER,
      correct_value REAL,
      correct_order TEXT
    )
  `);
  _db.run(`
    CREATE TABLE IF NOT EXISTS translations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      lang          TEXT    NOT NULL,
      question_text TEXT    NOT NULL,
      answers       TEXT,
      words         TEXT,
      hint          TEXT,
      unit          TEXT,
      UNIQUE(question_id, lang)
    )
  `);
  return _db;
}

function save() {
  if (!_db) return;
  fs.writeFileSync(dbPath, Buffer.from(_db.export()));
}

async function loadQuestions(lang = 'en') {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT
      q.id, q.category, q.type, q.time_limit,
      q.correct_index, q.correct_value, q.correct_order,
      t.question_text, t.answers, t.words, t.hint, t.unit
    FROM questions q
    JOIN translations t ON t.question_id = q.id AND t.lang = ?
    ORDER BY q.id
  `);
  stmt.bind([lang]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  return rows.map(r => ({
    id:            r.id,
    category:      r.category,
    type:          r.type,
    time_limit:    r.time_limit,
    question:      r.question_text,
    answers:       r.answers       ? JSON.parse(r.answers)       : undefined,
    correct:       r.correct_index !== null ? r.correct_index    : undefined,
    correct_value: r.correct_value !== null ? r.correct_value    : undefined,
    unit:          r.unit          || undefined,
    words:         r.words         ? JSON.parse(r.words)         : undefined,
    correct_order: r.correct_order ? JSON.parse(r.correct_order) : undefined,
    hint:          r.hint          || undefined,
  }));
}

module.exports = { getDb, loadQuestions, save };
