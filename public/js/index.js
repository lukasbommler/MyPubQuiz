// Apply translations immediately on load
applyI18n();

fetch('/api/question-count').then(r => r.json()).then(({ count }) => {
  document.getElementById('question-count').textContent = count.toLocaleString() + '+';
}).catch(() => {
  document.getElementById('question-count').closest('.hero-stat').style.display = 'none';
});

// ── Create Game ───────────────────────────────────────────────────────────────
async function createGame() {
  const btn  = document.getElementById('create-btn');
  const btn2 = document.getElementById('create-btn-2');
  [btn, btn2].forEach(b => { if (b) { b.disabled = true; b.textContent = t('creating'); } });

  try {
    const res = await fetch('/api/event/create', { method: 'POST' });
    const { code, hostToken } = await res.json();

    const gameUrl = `${location.origin}/game/${code}`;
    const hostUrl = `${location.origin}/host/${code}?token=${hostToken}`;

    document.getElementById('game-code-display').textContent = code;
    document.getElementById('share-link').value = gameUrl;
    document.getElementById('host-link').href = hostUrl;
    document.getElementById('tv-link-created').href = `/tv/${code}`;

    const qrDiv = document.getElementById('qr-div');
    qrDiv.innerHTML = '';
    new QRCode(qrDiv, {
      text: gameUrl,
      width: 160,
      height: 160,
      colorDark: '#161616',
      colorLight: '#ffffff'
    });

    document.getElementById('created-overlay').classList.remove('hidden');
  } catch (e) {
    alert('Error creating game: ' + e.message);
  } finally {
    [btn, btn2].forEach(b => { if (b) { b.disabled = false; b.textContent = t('hero_cta'); } });
  }
}

document.getElementById('create-btn').addEventListener('click', createGame);
document.getElementById('create-btn-2').addEventListener('click', createGame);

document.getElementById('created-close').addEventListener('click', () => {
  document.getElementById('created-overlay').classList.add('hidden');
});

// Close overlay on backdrop click
document.getElementById('created-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

document.getElementById('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('share-link').value);
  const btn = document.getElementById('copy-btn');
  btn.textContent = t('copied_btn');
  setTimeout(() => { btn.textContent = t('copy_btn'); }, 2000);
});

// ── Join Game ─────────────────────────────────────────────────────────────────
function joinGame() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (code.length < 4) { document.getElementById('join-code-input').focus(); return; }
  location.href = `/game/${code}`;
}

document.getElementById('join-btn').addEventListener('click', joinGame);

document.getElementById('join-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinGame();
});

document.getElementById('join-code-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

// ── Try one: a real catalogue question, played in the page only ──────────────
const TRY_QUESTION = {
  en: {
    category: 'Other',
    question: 'What is “moral licensing”?',
    answers: ['Having a licence to teach ethics', 'Doing something “good” gives us a subconscious permission to do something “bad” later', 'A type of religion', 'Following the law'],
  },
  de: {
    category: 'Sonstiges',
    question: 'Was ist „Moralisches Lizenzieren“?',
    answers: ['Eine Lizenz für Ethikunterricht haben', 'Dass eine „gute“ Tat uns die unbewusste Erlaubnis gibt, später etwas „Schlechtes“ zu tun', 'Eine Religionsart', 'Dem Gesetz folgen'],
  },
};
const TRY_CORRECT = 1;
let tryPick = null;

function renderTry() {
  const q = TRY_QUESTION[window.MPQ_LANG] || TRY_QUESTION.en;
  document.getElementById('try-meta').textContent = `${q.category} · 20 s`;
  document.getElementById('try-question').textContent = q.question;
  const answers = document.getElementById('try-answers');
  answers.innerHTML = q.answers.map((a, i) => `
    <button type="button" class="try-answer" data-index="${i}">
      <span class="try-letter">${'ABCD'[i]}</span><span>${a}</span>
    </button>`).join('');
  answers.querySelectorAll('.try-answer').forEach(btn => btn.addEventListener('click', () => {
    if (tryPick !== null) return; // one tap locks the answer in, like in the game
    tryPick = parseInt(btn.dataset.index);
    showTryResult();
  }));
  if (tryPick !== null) showTryResult();
}

function showTryResult() {
  const section = document.getElementById('try');
  const correct = tryPick === TRY_CORRECT;
  section.classList.toggle('is-correct', correct);
  section.classList.toggle('is-wrong', !correct);
  document.querySelectorAll('.try-answer').forEach(btn => {
    const i = parseInt(btn.dataset.index);
    btn.disabled = true;
    btn.classList.toggle('correct', i === TRY_CORRECT);
    btn.classList.toggle('picked', i === tryPick && !correct);
  });
  const verdict = document.getElementById('try-verdict');
  verdict.textContent = correct ? t('try_correct') : t('try_wrong', { letter: 'ABCD'[TRY_CORRECT] });
  verdict.classList.remove('hidden');
}

// Re-render the demo when the language changes
const _setLang = window.setLang;
window.setLang = lang => { _setLang(lang); renderTry(); };

renderTry();
