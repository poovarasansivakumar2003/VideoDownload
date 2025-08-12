console.log('Starting application...');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

console.log('Loading Facebook module...');
let Facebook;
try {
    Facebook = require('facebook-dl');
    console.log('Facebook module loaded successfully');
} catch (err) {
    console.error('Error loading facebook-dl:', err.message);
    process.exit(1);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log('Setting up routes...');

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
        console.error('Error in download route:', err);
        res.status(500).json({ error: 'Failed to fetch video' });
    }
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

console.log('Starting server on port', PORT);

app.listen(PORT, (err) => {
    if (err) {
        console.error('Failed to start server:', err);
    } else {
        console.log(`Server running on http://localhost:${PORT}`);
    }
}).on('error', (err) => {
    console.error('Server error:', err);
});
