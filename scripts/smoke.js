// Smoke test: plays one full game (host + 2 players + TV) in a real browser and
// screenshots every stage at phone portrait, phone landscape and TV size.
//
// Usage:  node scripts/smoke.js [outDir] [lang]
//   - starts its own server on port 3100 (questions.db must exist)
//   - uses the installed Microsoft Edge via playwright-core (no browser download)
//   - writes PNGs + errors.txt to scripts/smoke-out/<outDir>
// Exit code 1 if any page logged a console error or a step timed out.

const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, 'smoke-out', process.argv[2] || 'run');
const LANG = process.argv[3] || 'en';

const PHONE = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const DESKTOP = { width: 1440, height: 900 };
const TV = { width: 1280, height: 720 };

const errors = [];
let shotNo = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, ['app.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT) },
    });
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    srv.stdout.on('data', d => {
      if (/listening|running|port/i.test(String(d))) { clearTimeout(timer); resolve(srv); }
    });
    srv.stderr.on('data', d => errors.push(`[server] ${d}`));
  });
}

async function newPage(browser, name, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, locale: LANG });
  await ctx.addInitScript(lang => { try { localStorage.setItem('mpq_lang', lang); } catch (e) {} }, LANG);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`[${name}] ${m.text()}`);
  });
  page.on('response', r => { if (r.status() >= 400) errors.push(`[${name}] HTTP ${r.status()} ${r.url()}`); });
  page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
  return page;
}

async function shot(page, label, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await sleep(250);
  shotNo += 1;
  const file = path.join(OUT, `${String(shotNo).padStart(3, '0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
}

// Host screenshots at all three sizes; the host stays at desktop size in between.
async function hostShots(host, label) {
  await shot(host, `host-${label}-desktop`, DESKTOP);
  await shot(host, `host-${label}-landscape`, LANDSCAPE);
  await shot(host, `host-${label}-portrait`, PHONE);
  await host.setViewportSize(DESKTOP);
}

async function answer(player, type, n) {
  if (type === 'multiple_choice') {
    await player.locator('#mc-answers .mc-btn').nth(n % 4).click();
  } else if (type === 'truth_or_lie') {
    await player.locator('#tol-buttons .tol-btn').nth(n % 2).click();
  } else if (type === 'estimation') {
    await player.fill('#est-input', String(100 + n * 50));
    await player.click('#est-submit-btn');
  } else if (type === 'word_order') {
    const chips = player.locator('#word-chips .word-chip');
    const count = await chips.count();
    for (let i = 0; i < count; i++) await chips.first().click();
    await player.click('#wo-submit-btn');
  }
}

async function playQuestion(ctx, type, qNo) {
  const { host, players, tv } = ctx;
  const p1 = players[0];
  const tag = `${type}-q${qNo}`;

  await hostShots(host, `${tag}-ready`);
  await host.click('#btn-send-question');

  const skipsText = type === 'estimation' || type === 'truth_or_lie';
  if (!skipsText) {
    await sleep(600);
    await shot(p1, `player-${tag}-question-text`);
    await shot(tv, `tv-${tag}-question-text`);
    await hostShots(host, `${tag}-text-sent`);
    await host.click('#btn-show-answers');
  }

  await sleep(1200);
  await shot(p1, `player-${tag}-countdown`);
  await shot(tv, `tv-${tag}-countdown`);
  await sleep(3000);
  await shot(p1, `player-${tag}-answering`);
  await shot(tv, `tv-${tag}-answering`);

  await answer(p1, type, 0);
  await sleep(400);
  await shot(p1, `player-${tag}-locked-in`);
  await hostShots(host, `${tag}-answering`);

  await answer(players[1], type, 1);
  // All teams answered -> server auto-reveals
  await p1.waitForSelector('#screen-reveal.active', { timeout: 15000 });
  await sleep(1700);
  await shot(p1, `player-${tag}-moment`);
  await shot(tv, `tv-${tag}-moment`);
  // Special moments (solo correct, spot on, off the charts) follow ~5.5 s after the reveal
  await sleep(4300);
  await shot(p1, `player-${tag}-moment2`);
  await p1.waitForFunction(() =>
    ![...document.querySelectorAll('.buzz-overlay, .special-overlay')].some(o => !o.classList.contains('hidden')),
    null, { timeout: 15000 });
  await tv.waitForFunction(() =>
    ![...document.querySelectorAll('.mon-overlay')].some(o => !o.classList.contains('hidden')),
    null, { timeout: 15000 });
  await shot(p1, `player-${tag}-reveal`);
  await shot(players[1], `player2-${tag}-reveal`);
  await shot(tv, `tv-${tag}-reveal`);
  await hostShots(host, `${tag}-revealed`);
}

async function endRound(ctx, label) {
  const { host, players, tv } = ctx;
  await host.click('#btn-end-round');
  await host.click('#confirm-ok');
  await host.waitForSelector('#screen-host-standings.active', { timeout: 10000 });
  await sleep(500);
  await hostShots(host, `${label}-standings`);
  await shot(players[0], `player-${label}-round-over`);
  await shot(tv, `tv-${label}-round-over`);
  await host.click('#btn-keep-playing');
  await sleep(300);
  await hostShots(host, `${label}-next-round-setup`);
  await host.click('#btn-show-scoreboard');
  await sleep(500);
  await shot(players[0], `player-${label}-scoreboard-shown`);
}

async function startRound(host, type, configIds) {
  // The radio inputs are visually hidden behind styled labels, so set them directly
  await host.$eval(`#${configIds.radios} .type-radio[value="${type}"]`, el => {
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await host.fill(`#${configIds.time}`, '15');
  await host.click(configIds.button);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let failed = false;

  try {
    const res = await fetch(`${BASE}/api/event/create`, { method: 'POST' });
    const { code, hostToken } = await res.json();

    const landing = await newPage(browser, 'landing', PHONE, true);
    await landing.goto(BASE + '/');
    await shot(landing, 'landing-phone');
    await landing.screenshot({ path: path.join(OUT, `${String(++shotNo).padStart(3, '0')}-landing-phone-full.png`), fullPage: true });
    await landing.locator('#try-answers .try-answer').nth(2).click();
    await landing.locator('#try').scrollIntoViewIfNeeded();
    await shot(landing, 'landing-phone-try-answered');
    await shot(landing, 'landing-desktop', DESKTOP);
    await landing.evaluate(() => window.scrollTo(0, 0));
    await landing.click('#create-btn');
    await landing.waitForSelector('#created-overlay:not(.hidden)', { timeout: 10000 });
    await sleep(500);
    await shot(landing, 'landing-created-desktop');
    await shot(landing, 'landing-created-phone', PHONE);
    for (const page of ['faq', 'blog', 'impressum', 'datenschutz']) {
      await landing.goto(`${BASE}/${page}.html`);
      await shot(landing, `content-${page}-phone`, PHONE);
      await shot(landing, `content-${page}-desktop`, DESKTOP);
    }
    await landing.setViewportSize(PHONE);
    await landing.goto(`${BASE}/blog.html`);
    await landing.locator('.blog-card').first().click();
    await shot(landing, 'content-blog-article-phone');

    const host = await newPage(browser, 'host', DESKTOP, false);
    await host.goto(`${BASE}/host/${code}?token=${hostToken}`);
    const tv = await newPage(browser, 'tv', TV, false);
    await tv.goto(`${BASE}/tv/${code}`);

    const players = [];
    for (const name of ['The Quizzly Bears', 'Les Quizérables']) {
      const p = await newPage(browser, name, PHONE, true);
      await p.goto(`${BASE}/game/${code}`);
      if (!players.length) await shot(p, 'player-join');
      await p.fill('#team-name-input', name);
      await p.click('#join-btn');
      await p.waitForSelector('#screen-selfie.active', { timeout: 10000 });
      if (!players.length) await shot(p, 'player-selfie');
      await p.click('#selfie-done-btn');
      await p.waitForSelector('#screen-waiting.active', { timeout: 10000 });
      players.push(p);
    }
    await sleep(500);
    await shot(players[0], 'player-lobby');
    await shot(tv, 'tv-lobby');
    await hostShots(host, 'lobby');

    const ctx = { host, players, tv };
    const lobbyCfg = { radios: 'type-radios', time: 'time-limit', button: '#start-btn' };
    const nextCfg = { radios: 'ro-type-radios', time: 'ro-time-limit', button: '#btn-next-round' };

    // Round 1: multiple choice, two questions (covers "Next question")
    await startRound(host, 'multiple_choice', lobbyCfg);
    await sleep(400);
    await shot(players[0], 'player-round-starting');
    await playQuestion(ctx, 'multiple_choice', 1);
    await host.click('#btn-next');
    await sleep(400);
    await playQuestion(ctx, 'multiple_choice', 2);
    await endRound(ctx, 'round1');

    // Rounds 2-4: one question each
    let round = 2;
    for (const type of ['estimation', 'word_order', 'truth_or_lie']) {
      // A type only appears in the setup when the catalogue has questions of it
      if (!(await host.$(`#ro-type-radios .type-radio[value="${type}"]`))) {
        console.log(`skipping ${type}: no questions of this type in questions.db`);
        continue;
      }
      await startRound(host, type, nextCfg);
      await sleep(400);
      await playQuestion(ctx, type, 1);
      await endRound(ctx, `round${round}`);
      round += 1;
    }

    await host.click('#btn-final-end');
    await host.click('#confirm-ok');
    await host.waitForSelector('#screen-gameover.active', { timeout: 10000 });
    await sleep(2500);
    await hostShots(host, 'game-over');
    await shot(players[0], 'player-game-over');
    await shot(players[1], 'player2-game-over');
    await shot(tv, 'tv-game-over');
  } catch (e) {
    failed = true;
    errors.push(`[smoke] ${e.stack || e.message}`);
  } finally {
    await browser.close();
    server.kill();
  }

  fs.writeFileSync(path.join(OUT, 'errors.txt'), errors.join('\n') || 'no errors\n');
  console.log(`${shotNo} screenshots -> ${OUT}`);
  console.log(errors.length ? `${errors.length} error(s):\n${errors.join('\n')}` : 'no errors');
  process.exit(failed || errors.length ? 1 : 0);
}

main();
