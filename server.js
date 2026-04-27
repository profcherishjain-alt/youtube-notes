// VideoNotes — Proxy Server
// YouTube ke exact frame fetch karne ke liye
// 
// Setup:
//   npm install express axios cors
//   node server.js
//
// Deploy on Render.com (free):
//   1. GitHub pe push karo
//   2. render.com pe "New Web Service" banao
//   3. Build command: npm install
//   4. Start command: node server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

// YouTube storyboard data fetch karna
// Ye endpoint video ka storyboard spec return karta hai
app.get('/api/storyboard', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  try {
    // YouTube's internal video info endpoint
    const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = response.data;

    // Extract storyboard spec from YouTube's ytInitialPlayerResponse
    const match = html.match(/"storyboards":\{"playerStoryboardSpecRenderer":\{"spec":"([^"]+)"/);
    if (!match) {
      return res.status(404).json({ error: 'Storyboard nahi mila', fallback: true });
    }

    const spec = decodeURIComponent(match[1]);
    res.json({ spec, videoId });
  } catch (err) {
    console.error('Storyboard fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// YouTube storyboard image tile proxy (CORS bypass)
app.get('/api/tile', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('url required');

  try {
    const response = await axios.get(decodeURIComponent(url), {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/'
      }
    });

    res.set('Content-Type', response.headers['content-type'] || 'image/webp');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(response.data);
  } catch (err) {
    res.status(500).send('Tile fetch failed');
  }
});

app.listen(PORT, () => {
  console.log(`✅ VideoNotes server chal raha hai: http://localhost:${PORT}`);
});
