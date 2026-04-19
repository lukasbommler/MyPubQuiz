// Fetches questions from Google Sheets (published CSV) and seeds questions.db
// Usage: node scripts/seed-questions.js

const { parse } = require('csv-parse/sync');
const { getDb, save } = require('../questions-db');

const SHEET_URL = process.env.SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSin2kMk1VbbfKPcrBvIlBXE38KKahkgOnQw3IQcEoagjFSj5uHur8oM94shEsnf9Yo4xTOq1bVI2uK/pub?gid=0&single=true&output=csv';

async function seed() {
  console.log('Fetching questions from Google Sheets...');
  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`);
  const csv = await res.text();

  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  console.log(`Parsed ${rows.length} rows`);

  const db = await getDb();
  db.run('DELETE FROM questions');

  let inserted = 0;
  let skipped  = 0;

  for (const row of rows) {
    const {
      id: source_id,
      type, language, category, question,
      answer_a, answer_b, answer_c, answer_d,
      correct, correct_value, unit, words
    } = row;

    if (!type || !question) { skipped++; continue; }

    let answersJson  = null;
    let correctIndex = null;
    let correctVal   = null;
    let wordsJson    = null;

    if (type === 'multiple_choice') {
      const answers = [answer_a, answer_b, answer_c, answer_d].filter(Boolean);
      if (answers.length < 2) { skipped++; continue; }
      answersJson  = JSON.stringify(answers);
      correctIndex = ['A','B','C','D'].indexOf((correct || '').toUpperCase());
      if (correctIndex === -1) correctIndex = 0;

    } else if (type === 'estimation') {
      correctVal = parseFloat(correct_value);
      if (isNaN(correctVal)) { skipped++; continue; }

    } else if (type === 'word_order') {
      const wordArr = (words || '').split('|').map(w => w.trim()).filter(Boolean);
      if (wordArr.length < 2) { skipped++; continue; }
      wordsJson = JSON.stringify(wordArr);

    } else {
      skipped++; continue;
    }

    db.run(
      `INSERT INTO questions
         (source_id, type, category, language, question, answers, correct, correct_value, unit, words)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source_id ? parseInt(source_id) : null,
        type,
        category,
        language || 'en',
        question,
        answersJson,
        correctIndex,
        correctVal,
        unit || null,
        wordsJson,
      ]
    );
    inserted++;
  }

  save();
  console.log(`Done — ${inserted} inserted, ${skipped} skipped`);
}

seed().catch(err => { console.error(err); process.exit(1); });
