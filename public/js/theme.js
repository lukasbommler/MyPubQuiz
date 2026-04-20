// Set theme immediately (in <head>) to prevent flash
const _t = localStorage.getItem('quiz-theme') || 'dark';
document.documentElement.setAttribute('data-theme', _t);

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('quiz-theme', next);
  _syncThemeBtns(next);
}

function _syncThemeBtns(theme) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀ Light' : '🌙 Dark';
  });
}

document.addEventListener('DOMContentLoaded', function () {
  _syncThemeBtns(document.documentElement.getAttribute('data-theme'));
});
