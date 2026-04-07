const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'questions.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category      TEXT    NOT NULL,
    type          TEXT    NOT NULL,
    time_limit    INTEGER NOT NULL DEFAULT 20,
    correct_index INTEGER,
    correct_value REAL,
    correct_order TEXT
  );
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
  );
`);

// Load all questions for a given language and return them as a flat array
// matching the shape the rest of app.js expects (same as questions.json did).
function loadQuestions(lang = 'en') {
  const rows = db.prepare(`
    SELECT
      q.id, q.category, q.type, q.time_limit,
      q.correct_index, q.correct_value, q.correct_order,
      t.question_text, t.answers, t.words, t.hint, t.unit
    FROM questions q
    JOIN translations t ON t.question_id = q.id AND t.lang = ?
    ORDER BY q.id
  `).all(lang);

  return rows.map(r => ({
    id:            r.id,
    category:      r.category,
    type:          r.type,
    time_limit:    r.time_limit,
    question:      r.question_text,
    // multiple_choice
    answers:       r.answers       ? JSON.parse(r.answers)       : undefined,
    correct:       r.correct_index !== null ? r.correct_index    : undefined,
    // estimation
    correct_value: r.correct_value !== null ? r.correct_value    : undefined,
    unit:          r.unit          || undefined,
    // word_order
    words:         r.words         ? JSON.parse(r.words)         : undefined,
    correct_order: r.correct_order ? JSON.parse(r.correct_order) : undefined,
    hint:          r.hint          || undefined,
  }));
}

module.exports = { loadQuestions, db };
