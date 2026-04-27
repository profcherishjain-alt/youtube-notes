// VideoNotes — Puppeteer Screenshot Server
// Exact frame capture karta hai YouTube videos ka
//
// Local setup:
//   npm install express cors puppeteer
//   node server.js
//
// Render.com deploy:
//   Build Command: npm install && npx puppeteer browsers install chrome
//   Start Command: node server.js

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ]
  });
  return browserInstance;
}

// GET /api/frame?videoId=xxx&t=123
app.get('/api/frame', async (req, res) => {
  const { videoId, t } = req.query;
  if (!videoId || t === undefined) {
    return res.status(400).json({ error: 'videoId aur t (seconds) chahiye' });
  }

  const seconds = Math.max(0, parseInt(t) || 0);
  console.log(`📸 Frame capture: ${videoId} @ ${seconds}s`);

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${seconds}&autoplay=1&mute=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1`;

    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('video', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    const videoEl = await page.$('video');
    let screenshotBuffer;

    if (videoEl) {
      screenshotBuffer = await videoEl.screenshot({ type: 'jpeg', quality: 90 });
    } else {
      screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 85 });
    }

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(screenshotBuffer);
    console.log(`✅ Done: ${videoId} @ ${seconds}s`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, async () => {
  console.log(`✅ Server: http://localhost:${PORT}`);
  try { await getBrowser(); console.log('✅ Browser ready!'); }
  catch (e) { console.warn('⚠️ Browser pre-warm failed:', e.message); }
});

process.on('SIGTERM', async () => {
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});
