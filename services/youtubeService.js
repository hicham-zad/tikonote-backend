import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import { Innertube } from 'youtubei.js';
import ytdl from '@distube/ytdl-core';
import axios from 'axios';

let youtubeClient = null;

const getYoutubeClient = async () => {
  if (!youtubeClient) {
    youtubeClient = await Innertube.create();
  }
  return youtubeClient;
};

export const extractYouTubeTranscript = async (url) => {
  const videoId = extractVideoId(url);
  console.log(`🎥 Attempting to extract transcript for video ID: ${videoId}`);
  console.log(`📺 Full URL: ${url}`);

  try {
    // Strategy 1: Fast Scraper (youtube-transcript)
    console.log('⚡️ Strategy 1: Attempting fast scraper...');
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcriptData && transcriptData.length > 0) {
      console.log(`✅ Strategy 1 success! Segments: ${transcriptData.length}`);
      const text = transcriptData.map(segment => segment.text).join(' ');
      return {
        text,
        title: `YouTube Video ${videoId}`,
        duration: null,
        videoId
      };
    }
  } catch (error) {
    console.warn(`⚠️ Strategy 1 failed: ${error.message}`);
    // Fall through to strategy 2
  }

  try {
    // Strategy 2: Robust Client (youtubei.js)
    console.log('🛡️ Strategy 2: Attempting robust client (InnerTube)...');
    const youtube = await getYoutubeClient();
    const info = await youtube.getInfo(videoId);

    // Attempt primary transcript extraction
    let transcriptData;
    try {
      transcriptData = await info.getTranscript();
    } catch (innerErr) {
      console.warn('Primary transcript extraction failed, attempting captions fallback:', innerErr.message);
      // Fallback: use captions if available
      if (info.captions && typeof info.captions.getTranscript === 'function') {
        transcriptData = await info.captions.getTranscript();
      } else {
        throw innerErr; // rethrow if no fallback
      }
    }

    if (transcriptData && transcriptData.transcript?.content?.body?.initial_segments) {
      console.log('✅ Strategy 2 success!');

      const segments = transcriptData.transcript.content.body.initial_segments;
      const text = segments
        .map(segment => segment.snippet.text)
        .join(' ');

      return {
        text,
        title: info.basic_info.title || `YouTube Video ${videoId}`,
        duration: info.basic_info.duration || null,
        videoId,
      };
    } else {
      throw new Error('No transcript data found in robust client response');
    }

  } catch (error) {
    console.warn('❌ Strategy 2 failed:', error.message);
    // Fall through to strategy 3
  }

  try {
    // Strategy 3: ytdl-core + XML parsing
    console.log('📼 Strategy 3: Attempting ytdl-core extraction...');
    // ytdl.getInfo requires the full URL
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    const captions = info.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (captions && captions.length > 0) {
      // Prefer English, but take the first one available
      const track = captions.find(t => t.languageCode === 'en') || captions[0];
      const transcriptUrl = track.baseUrl;

      console.log(`Fetching transcript from: ${transcriptUrl}`);

      // Retry logic for 429 errors
      let attempts = 0;
      const maxAttempts = 3;
      let xml = null;

      while (attempts < maxAttempts) {
        try {
          const response = await axios.get(transcriptUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          });
          xml = response.data;
          break; // Success
        } catch (err) {
          attempts++;
          console.warn(`Attempt ${attempts} failed: ${err.message}`);
          if (attempts >= maxAttempts) throw err;
          await new Promise(r => setTimeout(r, 1500 * attempts)); // Backoff with slightly longer delay
        }
      }

      // Simple regex to extract text to avoid extra cheerio dependency overhead
      // XML format: <text ...>Content</text>

      const cleanText = (str) => {
        return str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      };

      if (xml) {
        const matches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/g)];
        const text = matches.map(m => cleanText(m[1])).join(' ');

        if (text.length > 0) {
          console.log('✅ Strategy 3 success!');
          return {
            text,
            title: info.videoDetails.title || `YouTube Video ${videoId}`,
            duration: info.videoDetails.lengthSeconds,
            videoId,
          };
        }
      }
    }
    throw new Error('No captions found via ytdl-core');

  } catch (error) {
    console.error('❌ Strategy 3 failed:', error.message);

    // Final Error Fallback
    if (error.message.includes('No captions')) {
      throw new Error('This video has no captions. Please try another video.');
    }
    throw new Error('Unable to extract transcript. This video may have no captions. Please try another video.');
  }

};

// Helper to extract video ID from various YouTube URL formats
export const extractVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/, // Support YouTube Shorts
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube URL');
};