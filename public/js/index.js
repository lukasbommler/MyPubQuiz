// ── Create Game ───────────────────────────────────────────────────────────────
document.getElementById('create-btn').addEventListener('click', async () => {
  const btn = document.getElementById('create-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  try {
    const res = await fetch('/api/event/create', { method: 'POST' });
    const { code, hostToken } = await res.json();

    const gameUrl = `${location.origin}/game/${code}`;
    const hostUrl = `${location.origin}/host/${code}?token=${hostToken}`;

    document.getElementById('game-code-display').textContent = code;
    document.getElementById('share-link').value = gameUrl;
    document.getElementById('host-link').href = hostUrl;

    new QRCode(document.getElementById('qr-div'), {
      text: gameUrl,
      width: 180,
      height: 180,
      colorDark: '#7c3aed',
      colorLight: '#ffffff'
    });

    document.getElementById('landing-options').classList.add('hidden');
    document.getElementById('created-card').classList.remove('hidden');
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Create Game';
    alert('Error: ' + e.message);
  }
});

document.getElementById('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('share-link').value);
  const btn = document.getElementById('copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy Link', 2000);
});

// ── Join Game ─────────────────────────────────────────────────────────────────
document.getElementById('join-btn').addEventListener('click', () => {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (code.length < 4) {
    document.getElementById('join-code-input').focus();
    return;
  }
  location.href = `/game/${code}`;
});

document.getElementById('join-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('join-btn').click();
});

// Auto-uppercase as user types
document.getElementById('join-code-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});
