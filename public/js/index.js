// Apply translations immediately on load
applyI18n();

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

    const qrDiv = document.getElementById('qr-div');
    qrDiv.innerHTML = '';
    new QRCode(qrDiv, {
      text: gameUrl,
      width: 160,
      height: 160,
      colorDark: '#7c3aed',
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
