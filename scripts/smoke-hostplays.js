// Host-plays smoke test: the host joins as a team and answers along with 2 players.
// Every step is checked, including real-phone situations:
//   - the host's connection drops mid-question (screen lock) and comes back
//   - one player's phone clock runs 90 s ahead of the server
//   - the host moves on while a "first correct" moment is still on screen
// Usage: node scripts/smoke-hostplays.js [outDir] [port] [appDir]
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'smoke-out', process.argv[2] || 'hostplays');
const PORT = Number(process.argv[3] || 3101);
const APP = process.argv[4] || path.join(__dirname, '..');
const BASE = `http://localhost:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
let failures = 0;
let shotNo = 0;
const note = (ok, msg) => {
  if (!ok) failures++;
  const line = `${ok ? 'PASS' : 'FAIL'}  ${msg}`;
  log.push(line);
  console.log(line);
};

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, ['app.js'], { cwd: APP, env: { ...process.env, PORT: String(PORT) } });
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    srv.stdout.on('data', d => { if (/running/i.test(String(d))) { clearTimeout(timer); resolve(srv); } });
  });
}

async function page(browser, name, viewport, mobile, clockShiftMs = 0) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('mpq_lang', 'en'); } catch (e) {} });
  if (clockShiftMs) {
    // Simulate a phone whose clock is off compared to the server
    await ctx.addInitScript(shift => {
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + shift;
    }, clockShiftMs);
  }
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.on('pageerror', e => note(false, `[${name}] page error: ${e.message}`));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) note(false, `[${name}] console: ${m.text()}`);
  });
  return p;
}

async function shot(p, label) {
  await sleep(250);
  await p.screenshot({ path: path.join(OUT, `${String(++shotNo).padStart(2, '0')}-${label}.png`) });
}

async function hostScore(host, name) {
  return host.$$eval('#scoreboard .score-row', (rows, n) => {
    const row = rows.find(r => r.querySelector('.score-name')?.textContent === n);
    return row ? Number(row.querySelector('.score-pts').textContent) : null;
  }, name);
}

// Which original answer index is correct for the host: the host preview tags it after the reveal,
// but before that we read it from a player's reveal later. Here we simply answer and compare scores.
async function playQuestion(ctx, label, { hostDropsConnection = false } = {}) {
  const { host, players } = ctx;
  await host.click('#btn-send-question');
  await sleep(600);
  note(!(await host.isVisible('#answers-preview')), `[${label}] playing host does not see the answer options after sending the text`);
  await host.click('#btn-show-answers');
  await sleep(4700); // 3-2-1-GO + render

  if (hostDropsConnection) {
    // Screen lock / network blip: socket drops and reconnects
    await host.evaluate(() => { socket.disconnect(); });
    await sleep(500);
    note(await host.isVisible('#reconnect-banner'), `[${label}] host sees "Reconnecting" while offline`);
    await host.evaluate(() => { socket.connect(); });
    await sleep(1500);
    note(!(await host.isVisible('#reconnect-banner')), `[${label}] "Reconnecting" disappears after the reconnect`);
    note(!(await host.isVisible('#answers-preview')), `[${label}] after a reconnect the playing host still does not see the answers`);
    await shot(host, `${label}-host-after-reconnect`);
  }

  const hostBtns = await host.$$eval('#host-answer-options .host-answer-btn', els => els.map(e => ({ disabled: e.disabled, selected: e.classList.contains('host-answer-selected') })));
  note(hostBtns.length === 4, `[${label}] host gets 4 answer buttons (${hostBtns.length})`);
  note(hostBtns.every(b => !b.disabled && !b.selected), `[${label}] no host answer is pre-selected or locked`);

  for (const [i, p] of players.entries()) {
    const enabled = await p.$$eval('#mc-answers .mc-btn', els => els.length === 4 && els.every(e => !e.disabled));
    const overlay = await p.evaluate(() => [...document.querySelectorAll('.buzz-overlay, .special-overlay')].some(o => !o.classList.contains('hidden')));
    note(enabled && !overlay, `[${label}] player ${i + 1} can select an answer (buttons enabled, nothing covering them)`);
  }

  await players[0].locator('#mc-answers .mc-btn').nth(1).click();
  await sleep(600);
  const marks = await host.$$eval('#scoreboard .score-answer', els => els.map(e => e.textContent.trim()).filter(Boolean));
  const logRows = await host.$$eval('#answers-log .answer-log-row', els => els.length);
  note(marks.length === 0, `[${label}] scoreboard shows only "answered", not the answer (${JSON.stringify(marks)})`);
  note(logRows === 0, `[${label}] answer log stays empty for the playing host until the reveal (${logRows} rows)`);

  const before = await hostScore(host, 'Hosty');
  await host.locator('#host-answer-options .host-answer-btn').nth(0).click();
  await sleep(400);
  note(await host.isVisible('#host-answer-feedback'), `[${label}] host sees "locked in" after answering`);
  await players[1].locator('#mc-answers .mc-btn').nth(2).click();

  await players[0].waitForSelector('#screen-reveal.active');
  await sleep(1000);
  await shot(host, `${label}-host-revealed`);
  const after = await hostScore(host, 'Hosty');
  const hostAnswerCounted = await host.$$eval('#answers-log .answer-log-row .answer-log-name', els => els.some(e => e.textContent === 'Hosty'));
  note(after !== null, `[${label}] host team in the results after the reveal (score ${before} -> ${after})`);
  note(hostAnswerCounted, `[${label}] the server counted the host's answer (host row in the answer log)`);
  const logAfter = await host.$$eval('#answers-log .answer-log-row', els => els.length);
  note(logAfter === 3, `[${label}] after the reveal the host sees all 3 answers (${logAfter})`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const { code, hostToken } = await (await fetch(`${BASE}/api/event/create`, { method: 'POST' })).json();
    const host = await page(browser, 'host', { width: 390, height: 844 }, true);
    await host.goto(`${BASE}/host/${code}?token=${hostToken}`);

    const players = [];
    for (const [name, shift] of [['Alpha', 0], ['Bravo', 90_000]]) {
      const p = await page(browser, name, { width: 390, height: 844 }, true, shift);
      await p.goto(`${BASE}/game/${code}`);
      await p.fill('#team-name-input', name);
      await p.click('#join-btn');
      await p.click('#selfie-done-btn');
      players.push(p);
    }

    await host.click('#host-plays-label');
    note(await host.isChecked('#host-plays-toggle'), 'switch turns "I\'m playing too" on');
    await host.fill('#host-player-name', 'Hosty');
    await host.click('#start-btn');
    await host.waitForSelector('#screen-game.active');
    await sleep(800);

    const boardNames = await host.$$eval('#scoreboard .score-name', els => els.map(e => e.textContent));
    note(boardNames.includes('Hosty'), `host team on the scoreboard (${boardNames.join(', ')})`);
    note(!(await host.isVisible('#answers-preview')), 'playing host does not see the answer options before sending');

    const ctx = { host, players };
    await playQuestion(ctx, 'q1');

    // Move on right away, while the "first correct" moment is still showing on the players' phones
    await host.click('#btn-next');
    await sleep(300);
    await playQuestion(ctx, 'q2-reconnect', { hostDropsConnection: true });

    await shot(players[1], 'player-clock-ahead-reveal');

    // End the round after the host's connection dropped once
    await host.click('#btn-end-round');
    note(await host.isVisible('#confirm-modal'), 'end round asks for confirmation');
    await host.click('#confirm-ok');
    const hostStandings = await host.waitForSelector('#screen-host-standings.active', { timeout: 8000 }).then(() => true, () => false);
    note(hostStandings, 'after a reconnect, "End round" works: host sees the standings');
    const playerRoundOver = await players[0].waitForSelector('#screen-round-over-play.active', { timeout: 8000 }).then(() => true, () => false);
    note(playerRoundOver, 'players see "round complete"');
    await shot(host, 'host-round-ended');

    // Second round, end it while answers are still open
    await host.click('#btn-keep-playing');
    await host.click('#btn-next-round');
    await host.waitForSelector('#screen-game.active');
    await sleep(600);
    await host.click('#btn-send-question');
    await sleep(600);
    await host.click('#btn-show-answers');
    await sleep(2000);
    await host.evaluate(() => { socket.disconnect(); socket.connect(); });
    await sleep(1500);
    await host.click('#btn-end-round');
    await host.click('#confirm-ok');
    const midRound = await host.waitForSelector('#screen-host-standings.active', { timeout: 8000 }).then(() => true, () => false);
    note(midRound, '"End round" also works while answers are still open (after another reconnect)');
  } catch (e) {
    note(false, `script: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
    server.kill();
    fs.writeFileSync(path.join(OUT, 'results.txt'), log.join('\n'));
    console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
    process.exit(failures ? 1 : 0);
  }
})();
