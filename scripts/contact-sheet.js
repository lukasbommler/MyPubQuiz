// Builds a contact sheet PNG from smoke-test screenshots for quick visual review.
// Usage: node scripts/contact-sheet.js <run> <filter-regex> <out.png> [columns] [thumbWidth]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const [run, filter, out, cols = '6', thumb = '260'] = process.argv.slice(2);
  const dir = path.join(__dirname, 'smoke-out', run);
  const re = new RegExp(filter);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && re.test(f));
  const cells = files.map(f => {
    const data = fs.readFileSync(path.join(dir, f)).toString('base64');
    return `<figure><img src="data:image/png;base64,${data}"><figcaption>${f.replace('.png', '')}</figcaption></figure>`;
  }).join('');
  const html = `<html><body style="margin:0;padding:12px;background:#ddd;font:11px sans-serif">
    <div style="display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:10px;align-items:start">${cells}</div>
    <style>figure{margin:0}img{width:100%;display:block;border:1px solid #999}figcaption{padding-top:3px;word-break:break-all}</style></body></html>`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: Number(cols) * (Number(thumb) + 10) + 24, height: 600 } });
  await page.setContent(html);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`${files.length} images -> ${out}`);
})();
