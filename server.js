console.log('Starting application...');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

console.log('Loading modules...');
let Facebook, ytdl, instagramGetUrl;
try {
    console.log('Loading facebook-dl...');
    Facebook = require('facebook-dl');
    console.log('Facebook module loaded');
    
    console.log('Loading @distube/ytdl-core...');
    ytdl = require('@distube/ytdl-core');
    console.log('YouTube module loaded');
    
    console.log('Loading instagram-url-direct...');
    const instagramModule = require('instagram-url-direct');
    instagramGetUrl = instagramModule.instagramGetUrl;
    console.log('Instagram module loaded');
    
    console.log('All modules loaded successfully');
} catch (err) {
    console.error('Error loading modules:', err.message);
    console.error('Stack:', err.stack);
    
    // Try to continue with just working modules
    console.log('Attempting to load modules individually...');
    try {
        Facebook = require('facebook-dl');
        console.log('Facebook OK');
    } catch (e) {
        console.log('Facebook failed:', e.message);
    }
    
    try {
        const instagramModule = require('instagram-url-direct');
        instagramGetUrl = instagramModule.instagramGetUrl;
        console.log('Instagram OK');
    } catch (e) {
        console.log('Instagram failed:', e.message);
    }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log('Setting up routes...');

// Simplified download endpoint with better error handling
app.post('/api/download', async (req, res) => {
    console.log('Received request:', req.body);
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }
    
    try {
        const platform = detectPlatform(url);
        console.log(`Detected platform: ${platform} for URL: ${url}`);
        
        let result;
        switch (platform) {
            case 'facebook':
                if (!Facebook) {
                    return res.status(500).json({ error: 'Facebook module not available' });
                }
                result = await downloadFacebook(url);
                break;
            case 'youtube':
                if (!ytdl) {
                    return res.status(500).json({ error: 'YouTube module not available' });
                }
                result = await downloadYouTube(url);
                break;
            case 'instagram':
                if (!instagramGetUrl) {
                    return res.status(500).json({ error: 'Instagram module not available' });
                }
                result = await downloadInstagram(url);
                break;
            default:
                return res.status(400).json({ error: 'Unsupported platform. Please use Facebook, YouTube, or Instagram URLs.' });
        }
        
        res.json(result);
    } catch (err) {
        console.error('Error in download route:', err);
        res.status(500).json({ error: `Failed to fetch video: ${err.message}` });
    }
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        modules: {
            facebook: !!Facebook,
            youtube: !!ytdl,
            instagram: true, // Using custom implementation
            axios: true
        }
    });
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

console.log('Starting server on port', PORT);

const server = app.listen(PORT, (err) => {
    if (err) {
        console.error('Failed to start server:', err);
    } else {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('You can test the API at: http://localhost:' + PORT + '/api/test');
    }
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

// Platform detection function
function detectPlatform(url) {
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        return 'facebook';
    } else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube.com/shorts')) {
        return 'youtube';
    } else if (url.includes('instagram.com')) {
        return 'instagram';
    }
    return 'unknown';
}

// Simplified Facebook function
async function downloadFacebook(url) {
    console.log('Attempting to download Facebook video:', url);
    try {
        const api = new Facebook();
        console.log('Created Facebook API instance');
        
        const videoInfo = await api.fbdl(url);
        console.log('Got video info:', JSON.stringify(videoInfo, null, 2));
        
        if (videoInfo.code !== 200 || !videoInfo.results || !videoInfo.results.quality) {
            throw new Error('Video not found or not public');
        }
        
        const videoUrl = videoInfo.results.quality.hd || videoInfo.results.quality.sd;
        if (!videoUrl) {
            throw new Error('No downloadable video found');
        }
        
        return {
            platform: 'Facebook',
            videoUrl,
            title: videoInfo.results.title,
            thumbnail: videoInfo.results.thumbnail,
            duration: videoInfo.results.duration
        };
    } catch (error) {
        console.error('Facebook download error:', error);
        throw error;
    }
}

// YouTube download function - Updated to handle Shorts and other formats
async function downloadYouTube(url) {
    try {
        console.log('Attempting YouTube download:', url);
        
        // Normalize YouTube URLs (including Shorts)
        let videoId = extractYouTubeId(url);
        if (!videoId) {
            throw new Error('Could not extract YouTube video ID');
        }
        
        const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('Normalized URL:', normalizedUrl);
        
        const info = await ytdl.getInfo(normalizedUrl);
        console.log('YouTube info received:', info.videoDetails.title);
        
        // Try to get the best available format
        let format;
        try {
            // First try to get format with both video and audio
            format = ytdl.chooseFormat(info.formats, { 
                quality: 'highest',
                filter: 'audioandvideo'
            });
        } catch (e) {
            console.log('No combined format found, trying video only...');
            try {
                // Fallback to video only
                format = ytdl.chooseFormat(info.formats, { 
                    quality: 'highest',
                    filter: 'video'
                });
            } catch (e2) {
                console.log('No video format found, trying audio only...');
                // Last resort - audio only
                format = ytdl.chooseFormat(info.formats, { 
                    quality: 'highest',
                    filter: 'audio'
                });
            }
        }
        
        if (!format) {
            throw new Error('No downloadable format found');
        }
        
        console.log('Selected format:', format.qualityLabel || format.audioQuality, format.container);
        
        return {
            platform: 'YouTube',
            videoUrl: format.url,
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails && info.videoDetails.thumbnails.length > 0 
                ? info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url 
                : null,
            duration: info.videoDetails.lengthSeconds ? 
                formatDuration(info.videoDetails.lengthSeconds) : null,
            author: info.videoDetails.author.name,
            quality: format.qualityLabel || format.audioQuality || 'Unknown',
            container: format.container,
            isShort: url.includes('/shorts/') || (info.videoDetails.lengthSeconds && info.videoDetails.lengthSeconds <= 60)
        };
        
    } catch (error) {
        console.error('YouTube download error:', error);
        throw new Error(`YouTube video download failed: ${error.message}`);
    }
}

// Helper function to extract YouTube video ID from various URL formats
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}

// Helper function to format duration
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Updated Instagram download function using the correct import
async function downloadInstagram(url) {
    try {
        console.log('Attempting Instagram download:', url);
        
        if (!instagramGetUrl) {
            throw new Error('Instagram module not available');
        }
        
        const data = await instagramGetUrl(url);
        console.log('Instagram data received:', JSON.stringify(data, null, 2));
        
        if (!data.url_list || data.url_list.length === 0) {
            throw new Error('No downloadable content found in Instagram post');
        }
        
        // Get the first media URL (usually highest quality)
        const mediaUrl = data.url_list[0];
        const mediaDetails = data.media_details && data.media_details[0];
        
        return {
            platform: 'Instagram',
            videoUrl: mediaUrl,
            title: data.post_info ? `Post by @${data.post_info.owner_username}` : 'Instagram Content',
            thumbnail: null, // Removed thumbnail
            author: data.post_info ? data.post_info.owner_fullname || data.post_info.owner_username : null,
            likes: data.post_info ? data.post_info.likes : null,
            mediaType: mediaDetails ? mediaDetails.type : 'unknown',
            isVerified: data.post_info ? data.post_info.is_verified : false
        };
        
    } catch (error) {
        console.error('Instagram download error:', error);
        
        // Fallback to alternative methods
        const postId = extractInstagramId(url);
        if (postId) {
            return {
                platform: 'Instagram',
                videoUrl: null,
                title: 'Instagram Content - Use Alternative Method',
                thumbnail: null,
                alternativeMethod: true,
                message: 'Direct download failed. Try the alternative methods below.',
                originalUrl: url
            };
        }
        
        throw new Error(`Instagram download failed: ${error.message}`);
    }
}

// Helper function to extract Instagram post ID
function extractInstagramId(url) {
    const regex = /(?:instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9-_]+))/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
