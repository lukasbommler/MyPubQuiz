const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'questions.db');

let _db = null;

async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, 'node_modules/sql.js/dist', file),
  });
  // Load from disk if available (written by seed script), otherwise create empty
  if (fs.existsSync(dbPath)) {
    _db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    _db = new SQL.Database();
  }
  _db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT    NOT NULL,
      category      TEXT    NOT NULL,
      language      TEXT    NOT NULL DEFAULT 'en',
      question      TEXT    NOT NULL,
      answers       TEXT,
      correct       INTEGER,
      correct_value REAL,
      unit          TEXT,
      words         TEXT,
      time_limit    INTEGER NOT NULL DEFAULT 20
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
    SELECT * FROM questions WHERE language = ? ORDER BY id
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
    question:      r.question,
    answers:       r.answers       ? JSON.parse(r.answers)       : undefined,
    correct:       r.correct       !== null ? r.correct          : undefined,
    correct_value: r.correct_value !== null ? r.correct_value    : undefined,
    unit:          r.unit          || undefined,
    words:         r.words         ? JSON.parse(r.words)         : undefined,
  }));
}

module.exports = { getDb, loadQuestions, save };
