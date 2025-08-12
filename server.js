const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Facebook = require('facebook-dl');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }
    try {
        const api = new Facebook();
        const videoInfo = await api.fbdl(url);
        if (videoInfo.code !== 200 || !videoInfo.results || !videoInfo.results.quality) {
            return res.status(404).json({ error: 'Video not found or not public' });
        }
        // Prefer HD, fallback to SD
        const videoUrl = videoInfo.results.quality.hd || videoInfo.results.quality.sd;
        if (!videoUrl) {
            return res.status(404).json({ error: 'No downloadable video found' });
        }
        res.json({
            videoUrl,
            title: videoInfo.results.title,
            thumbnail: videoInfo.results.thumbnail,
            duration: videoInfo.results.duration
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch video' });
    }
});

app.use(express.static('public'));

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
