console.log('Starting application...');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');

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

// Enhanced download endpoint
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
                result = await downloadFacebookVideo(url);
                break;
            case 'youtube':
                result = await downloadYouTube(url);
                break;
            case 'instagram':
                result = await downloadInstagram(url);
                break;
            case 'tiktok':
                result = await downloadTikTok(url);
                break;
            default:
                return res.status(400).json({ error: 'Unsupported platform. Please use Facebook, YouTube, Instagram, or TikTok URLs.' });
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
            facebook: true, // Now using custom implementation
            youtube: !!ytdl,
            instagram: true, // Using custom implementation
            tiktok: true, // New platform added
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

// Enhanced platform detection function
function detectPlatform(url) {
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        return 'facebook';
    } else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube.com/shorts')) {
        return 'youtube';
    } else if (url.includes('instagram.com')) {
        return 'instagram';
    } else if (url.includes('tiktok.com')) {
        return 'tiktok';
    }
    return 'unknown';
}

// Completely new Facebook download implementation that handles reels and videos better
async function downloadFacebookVideo(url) {
    console.log('Attempting to download Facebook video with enhanced method:', url);
    
    try {
        // First try with facebook-dl package if available
        if (Facebook) {
            try {
                const api = new Facebook();
                const videoInfo = await api.fbdl(url);
                
                if (videoInfo.code === 200 && videoInfo.results && videoInfo.results.quality) {
                    const videoUrl = videoInfo.results.quality.hd || videoInfo.results.quality.sd;
                    if (videoUrl) {
                        return {
                            platform: 'Facebook',
                            videoUrl,
                            title: videoInfo.results.title || 'Facebook Video',
                            thumbnail: videoInfo.results.thumbnail,
                            duration: videoInfo.results.duration
                        };
                    }
                }
                console.log('facebook-dl package failed, trying alternative method');
            } catch (err) {
                console.log('facebook-dl error:', err.message);
            }
        }
        
        // If facebook-dl fails or is not available, try direct method
        // Handle FB Reels and Videos using direct method
        const normalizedUrl = normalizeFacebookUrl(url);
        
        // First try to fetch the page and look for HD video URL
        const response = await axios.get(normalizedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml'
            }
        });
        
        const html = response.data;
        
        // Look for HD video URL
        let videoUrl = extractFacebookVideoUrl(html);
        let title = extractFacebookTitle(html) || 'Facebook Video';
        let thumbnail = extractFacebookThumbnail(html);
        
        if (!videoUrl) {
            // If HD URL not found, try to find SD URL
            const sdUrl = extractFacebookSDVideoUrl(html);
            if (sdUrl) {
                videoUrl = sdUrl;
            } else {
                throw new Error('No video URL found in the Facebook page');
            }
        }
        
        return {
            platform: 'Facebook',
            videoUrl,
            title,
            thumbnail,
            isReel: url.includes('/reel/'),
            alternativeMethod: true
        };
    } catch (error) {
        console.error('Facebook download error:', error);
        
        // Return a fallback option
        return {
            platform: 'Facebook',
            videoUrl: null,
            title: 'Facebook Video - Use Alternative Method',
            thumbnail: null,
            alternativeMethod: true,
            message: 'Direct download failed. Try the alternative methods below.',
            originalUrl: url
        };
    }
}

// Helper functions for Facebook
function normalizeFacebookUrl(url) {
    // Convert mobile links to desktop
    url = url.replace('m.facebook.com', 'www.facebook.com');
    
    // Handle shortened fb.watch URLs
    if (url.includes('fb.watch')) {
        // For fb.watch links, we need to follow redirects
        // This is handled automatically by axios
    }
    
    return url;
}

function extractFacebookVideoUrl(html) {
    try {
        // Look for HD video URL
        const hdMatch = html.match(/hd_src:"([^"]+)"/);
        if (hdMatch && hdMatch[1]) {
            return hdMatch[1].replace(/\\/g, '');
        }
        
        // Look for sd_src
        const sdMatch = html.match(/sd_src:"([^"]+)"/);
        if (sdMatch && sdMatch[1]) {
            return sdMatch[1].replace(/\\/g, '');
        }
        
        // Look for video with playable_url
        const playableMatch = html.match(/"playable_url":"([^"]+)"/);
        if (playableMatch && playableMatch[1]) {
            return playableMatch[1].replace(/\\/g, '');
        }
        
        // Try another pattern for video URLs
        const videoMatch = html.match(/"video_url":"([^"]+)"/);
        if (videoMatch && videoMatch[1]) {
            return videoMatch[1].replace(/\\/g, '');
        }
        
        return null;
    } catch (e) {
        console.error('Error extracting Facebook video URL:', e);
        return null;
    }
}

function extractFacebookSDVideoUrl(html) {
    try {
        // Alternative SD URL pattern
        const sdMatch = html.match(/"playable_url":"([^"]+)"/);
        if (sdMatch && sdMatch[1]) {
            return sdMatch[1].replace(/\\/g, '');
        }
        return null;
    } catch (e) {
        console.error('Error extracting Facebook SD video URL:', e);
        return null;
    }
}

function extractFacebookTitle(html) {
    try {
        // Try to extract title
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1];
        }
        return null;
    } catch (e) {
        console.error('Error extracting Facebook title:', e);
        return null;
    }
}

function extractFacebookThumbnail(html) {
    try {
        // Try to extract thumbnail
        const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (thumbMatch && thumbMatch[1]) {
            return thumbMatch[1];
        }
        return null;
    } catch (e) {
        console.error('Error extracting Facebook thumbnail:', e);
        return null;
    }
}

// Enhanced YouTube download function with better handling of different formats
async function downloadYouTube(url) {
    try {
        console.log('Attempting YouTube download with enhanced method:', url);
        
        // Normalize YouTube URLs (including Shorts)
        let videoId = extractYouTubeId(url);
        if (!videoId) {
            throw new Error('Could not extract YouTube video ID');
        }
        
        const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('Normalized URL:', normalizedUrl);
        
        // Check if ytdl is available
        if (!ytdl) {
            // Fallback to alternative API if ytdl is not available
            return await downloadYouTubeAlternative(normalizedUrl, videoId);
        }
        
        const info = await ytdl.getInfo(normalizedUrl);
        console.log('YouTube info received:', info.videoDetails.title);
        
        // Get both audio and video formats for better options
        let videoFormats = ytdl.filterFormats(info.formats, format => format.hasVideo);
        let audioFormats = ytdl.filterFormats(info.formats, format => format.hasAudio);
        
        // Sort by quality
        videoFormats.sort((a, b) => {
            // Parse resolution to numeric values for comparison
            const getRes = format => {
                const res = format.qualityLabel || '';
                const match = res.match(/(\d+)p/);
                return match ? parseInt(match[1]) : 0;
            };
            return getRes(b) - getRes(a);
        });
        
        audioFormats.sort((a, b) => {
            const getBitrate = format => format.audioBitrate || 0;
            return getBitrate(b) - getBitrate(a);
        });
        
        // Get best audio and video formats
        const bestVideo = videoFormats[0];
        const bestAudio = audioFormats[0];
        
        // Try to get a format with both audio and video (for direct playback)
        const combinedFormats = ytdl.filterFormats(info.formats, format => format.hasVideo && format.hasAudio);
        combinedFormats.sort((a, b) => {
            // Parse resolution to numeric values for comparison
            const getRes = format => {
                const res = format.qualityLabel || '';
                const match = res.match(/(\d+)p/);
                return match ? parseInt(match[1]) : 0;
            };
            return getRes(b) - getRes(a);
        });
        
        // Select best combined format if available
        const bestCombined = combinedFormats.length > 0 ? combinedFormats[0] : null;
        
        // Determine which format to use
        let format = bestCombined || bestVideo;
        const isAudioOnly = !format.hasVideo;
        
        if (!format) {
            throw new Error('No downloadable format found');
        }
        
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
            quality: format.qualityLabel || format.audioBitrate + 'kbps' || 'Unknown',
            container: format.container,
            isShort: url.includes('/shorts/') || (info.videoDetails.lengthSeconds && info.videoDetails.lengthSeconds <= 60),
            isAudioOnly: isAudioOnly,
            views: info.videoDetails.viewCount,
            likes: info.videoDetails.likes
        };
        
    } catch (error) {
        console.error('YouTube download error:', error);
        // Try alternative method if ytdl fails
        try {
            const videoId = extractYouTubeId(url);
            if (videoId) {
                return await downloadYouTubeAlternative(url, videoId);
            }
        } catch (altError) {
            console.error('Alternative YouTube method also failed:', altError);
        }
        
        throw new Error(`YouTube video download failed: ${error.message}`);
    }
}

async function downloadYouTubeAlternative(url, videoId) {
    // Alternative method using simple API
    const info = await axios.get(`https://yt-downloader-api.herokuapp.com/info?videoId=${videoId}`);
    
    if (info.data && info.data.formats) {
        // Find the best format
        const formats = info.data.formats;
        let bestFormat = null;
        let bestQuality = 0;
        
        for (const format of formats) {
            if (format.qualityLabel) {
                const match = format.qualityLabel.match(/(\d+)p/);
                if (match) {
                    const quality = parseInt(match[1]);
                    if (quality > bestQuality) {
                        bestQuality = quality;
                        bestFormat = format;
                    }
                }
            }
        }
        
        if (bestFormat) {
            return {
                platform: 'YouTube',
                videoUrl: bestFormat.url,
                title: info.data.title || 'YouTube Video',
                thumbnail: info.data.thumbnail,
                author: info.data.author,
                quality: bestFormat.qualityLabel || 'Unknown',
                alternativeMethod: true
            };
        }
    }
    
    throw new Error('Could not find video information');
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

// Enhanced Instagram download function with multiple fallback methods
async function downloadInstagram(url) {
    console.log('Attempting Instagram download with enhanced method:', url);
    
    // Try multiple methods in sequence
    const methods = [
        tryInstagramGetUrl,
        tryInstagramDirectScrape,
        tryInstagramGraphql
    ];
    
    let lastError = null;
    
    for (const method of methods) {
        try {
            const result = await method(url);
            if (result && result.videoUrl) {
                return {
                    platform: 'Instagram',
                    ...result
                };
            }
        } catch (error) {
            console.log(`Instagram method failed: ${error.message}`);
            lastError = error;
            // Continue to next method
        }
    }
    
    // All methods failed, return fallback options
    return {
        platform: 'Instagram',
        videoUrl: null,
        title: 'Instagram Content - Use Alternative Method',
        thumbnail: null,
        alternativeMethod: true,
        message: `Direct download failed: ${lastError?.message || 'Unknown error'}. Try the alternative methods below.`,
        originalUrl: url
    };
}

// Method 1: Using instagram-url-direct package
async function tryInstagramGetUrl(url) {
    if (!instagramGetUrl) {
        throw new Error('Instagram module not available');
    }
    
    const data = await instagramGetUrl(url);
    
    if (!data.url_list || data.url_list.length === 0) {
        throw new Error('No downloadable content found in Instagram post');
    }
    
    // Get the first media URL (usually highest quality)
    const mediaUrl = data.url_list[0];
    
    return {
        videoUrl: mediaUrl,
        title: data.post_info ? `Post by @${data.post_info.owner_username}` : 'Instagram Content',
        author: data.post_info ? data.post_info.owner_username : null,
        likes: data.post_info ? data.post_info.likes : null,
        mediaType: data.media_type || 'video',
        isVerified: data.post_info ? data.post_info.is_verified : false,
        isReel: url.includes('/reel/')
    };
}

// Method 2: Direct scraping approach
async function tryInstagramDirectScrape(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    
    const html = response.data;
    
    // Look for video URL in different formats
    let videoUrl = null;
    
    // Method 1: Look for video element
    const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/);
    if (videoMatch && videoMatch[1]) {
        videoUrl = videoMatch[1];
    }
    
    // Method 2: Look for video in JSON data
    if (!videoUrl) {
        const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                if (jsonData.video) {
                    videoUrl = jsonData.video.contentUrl;
                }
            } catch (e) {
                console.log('Error parsing JSON data:', e);
            }
        }
    }
    
    // Method 3: Look for video in shared_data
    if (!videoUrl) {
        const sharedDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/);
        if (sharedDataMatch && sharedDataMatch[1]) {
            try {
                const sharedData = JSON.parse(sharedDataMatch[1]);
                const media = sharedData.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
                if (media && media.video_url) {
                    videoUrl = media.video_url;
                }
            } catch (e) {
                console.log('Error parsing shared data:', e);
            }
        }
    }
    
    if (!videoUrl) {
        throw new Error('No video URL found in Instagram post');
    }
    
    // Extract title and other metadata
    const title = html.match(/<meta property="og:title" content="([^"]+)"/) || [];
    const thumbnail = html.match(/<meta property="og:image" content="([^"]+)"/) || [];
    
    return {
        videoUrl,
        title: title[1] || 'Instagram Video',
        thumbnail: thumbnail[1] || null,
        mediaType: 'video',
        isReel: url.includes('/reel/')
    };
}

// Method 3: Try GraphQL API
async function tryInstagramGraphql(url) {
    // Extract post ID from URL
    const match = url.match(/\/p\/([^\/]+)\/|\/reel\/([^\/]+)\//);
    if (!match) {
        throw new Error('Could not extract Instagram post ID');
    }
    
    const postId = match[1] || match[2];
    const graphqlUrl = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables={"shortcode":"${postId}"}`;
    
    const response = await axios.get(graphqlUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    
    if (!response.data || !response.data.data || !response.data.data.shortcode_media) {
        throw new Error('No media found in GraphQL response');
    }
    
    const media = response.data.data.shortcode_media;
    let videoUrl = null;
    
    if (media.is_video && media.video_url) {
        videoUrl = media.video_url;
    }
    
    if (!videoUrl) {
        throw new Error('No video URL found in GraphQL data');
    }
    
    return {
        videoUrl,
        title: `Post by @${media.owner.username || 'unknown'}`,
        author: media.owner.username,
        likes: media.edge_media_preview_like?.count,
        thumbnail: media.display_url,
        isVerified: media.owner.is_verified,
        isReel: url.includes('/reel/')
    };
}

// Helper function to extract Instagram post ID
function extractInstagramId(url) {
    const regex = /(?:instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9-_]+))/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// New TikTok download function
async function downloadTikTok(url) {
    console.log('Attempting to download TikTok video:', url);
    
    try {
        // Normalize the URL
        url = url.split('?')[0]; // Remove query parameters
        
        // Use a more reliable third-party API
        const response = await axios.get(`https://tiktok-video-no-watermark.p.rapidapi.com/download`, {
            params: { url },
            headers: {
                'X-RapidAPI-Key': '7f67f2d3e5msh86c150b5d9afbd4p1e8b68jsn308cbd3b86c7',
                'X-RapidAPI-Host': 'tiktok-video-no-watermark.p.rapidapi.com'
            }
        });
        
        if (!response.data || !response.data.data) {
            throw new Error('Invalid response from TikTok API');
        }
        
        const data = response.data.data;
        
        return {
            platform: 'TikTok',
            videoUrl: data.play || data.hdplay || data.wmplay,
            title: data.title || 'TikTok Video',
            thumbnail: data.cover,
            author: data.author && data.author.nickname,
            likes: data.digg_count,
            comments: data.comment_count,
            shares: data.share_count,
            duration: data.duration ? formatDuration(data.duration) : null
        };
    } catch (error) {
        console.error('TikTok download error:', error);
        
        // Try alternative method
        try {
            return await downloadTikTokAlternative(url);
        } catch (altError) {
            console.error('Alternative TikTok method also failed:', altError);
            
            // Return fallback options
            return {
                platform: 'TikTok',
                videoUrl: null,
                title: 'TikTok Video - Use Alternative Method',
                alternativeMethod: true,
                message: 'Direct download failed. Try the alternative methods below.',
                originalUrl: url
            };
        }
    }
}

// Alternative TikTok download method
async function downloadTikTokAlternative(url) {
    // Direct scraping approach
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 5
    });
    
    const html = response.data;
    
    // Try to extract video URL
    const videoUrlMatch = html.match(/"playAddr":"([^"]+)"/);
    if (!videoUrlMatch || !videoUrlMatch[1]) {
        throw new Error('No video URL found in TikTok page');
    }
    
    const videoUrl = videoUrlMatch[1].replace(/\\u002F/g, '/');
    
    // Extract other metadata
    const titleMatch = html.match(/"desc":"([^"]+)"/);
    const authorMatch = html.match(/"nickname":"([^"]+)"/);
    const thumbnailMatch = html.match(/"cover":"([^"]+)"/);
    
    return {
        platform: 'TikTok',
        videoUrl,
        title: titleMatch && titleMatch[1] ? titleMatch[1] : 'TikTok Video',
        author: authorMatch && authorMatch[1] ? authorMatch[1] : null,
        thumbnail: thumbnailMatch && thumbnailMatch[1] ? thumbnailMatch[1].replace(/\\u002F/g, '/') : null,
        alternativeMethod: true
    };
}
