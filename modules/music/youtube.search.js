'use strict';

// NEW: [Area 7] YouTube search proxy using YouTube Data API v3

const https = require('https');

/**
 * Search YouTube for music videos.
 * Uses YouTube Data API v3 (free: 10,000 units/day, search = 100 units).
 * Falls back gracefully if no API key is configured.
 */
async function searchYouTube(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY not configured');
  }

  const url = `https://www.googleapis.com/youtube/v3/search?` +
    `part=snippet&q=${encodeURIComponent(query)}` +
    `&type=video&maxResults=6` +
    `&videoCategoryId=10` +  // Music category
    `&key=${apiKey}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'YouTube API error'));
            return;
          }
          const results = (parsed.items || []).map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.medium?.url || 
                       item.snippet.thumbnails?.default?.url || ''
          }));
          resolve(results);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

module.exports = { searchYouTube };
