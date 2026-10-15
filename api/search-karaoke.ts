import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { POPULAR_KARAOKE_CATALOG, filterCatalogByQuery } from '../src/data/karaokeCatalog.js';

function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { query = '' } = req.body || {};
    const cleanQuery = typeof query === 'string' ? query.trim() : '';

    if (!cleanQuery) {
      return res.status(200).json({ results: POPULAR_KARAOKE_CATALOG });
    }

    // Direct YouTube Link / ID pasted into search box
    const directYtId = extractYouTubeId(cleanQuery);
    if (directYtId) {
      return res.status(200).json({
        results: [
          {
            youtubeId: directYtId,
            title: `Vídeo do YouTube (${directYtId})`,
            artist: 'Link Direto',
            thumbnail: `https://img.youtube.com/vi/${directYtId}/hqdefault.jpg`,
            channelTitle: 'YouTube',
            duration: '3:30',
            isKaraokeVerified: true,
          },
        ],
      });
    }

    const searchQuery = cleanQuery.toLowerCase().includes('karaoke') || cleanQuery.toLowerCase().includes('karaokê')
      ? cleanQuery
      : `${cleanQuery} karaoke`;

    let youtubeResults: Array<{
      title: string;
      artist: string;
      youtubeId: string;
      channelTitle: string;
      duration: string;
    }> = [];

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    // 1. Official YouTube Data API v3 search
    if (apiKey) {
      try {
        const ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
        const ytRes = await fetch(ytApiUrl);
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          if (ytData.items && ytData.items.length > 0) {
            youtubeResults = ytData.items
              .map((item: any) => {
                const snippet = item.snippet || {};
                const rawTitle = snippet.title || 'Karaokê';
                let title = rawTitle;
                let artist = snippet.channelTitle || 'YouTube Karaokê';
                if (rawTitle.includes('-')) {
                  const parts = rawTitle.split('-');
                  artist = parts[0].trim();
                  title = parts.slice(1).join('-').trim();
                }
                return {
                  title,
                  artist,
                  youtubeId: item.id?.videoId || '',
                  channelTitle: snippet.channelTitle || 'YouTube Karaokê',
                  duration: '3:30',
                };
              })
              .filter((item: any) => item.youtubeId);
          }
        }
      } catch (ytErr) {
        console.warn('YouTube Data API search failed:', ytErr);
      }
    }

    // 2. Gemini AI Search
    if (youtubeResults.length === 0 && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `The user is searching for a karaoke video on YouTube: "${searchQuery}".
Return 6 real, highly relevant YouTube video search results matching "${cleanQuery}".
Return JSON array with objects: title, artist, youtubeId (11-char ID), channelTitle, duration.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  youtubeId: { type: Type.STRING },
                  channelTitle: { type: Type.STRING },
                  duration: { type: Type.STRING },
                },
                required: ['title', 'artist', 'youtubeId', 'channelTitle', 'duration'],
              },
            },
          },
        });

        if (response.text) {
          youtubeResults = JSON.parse(response.text.trim());
        }
      } catch (geminiErr) {
        console.error('Gemini YouTube search error:', geminiErr);
      }
    }

    // 3. Local matches
    const localMatches = filterCatalogByQuery(cleanQuery);

    if (youtubeResults.length > 0) {
      const formattedResults = youtubeResults.map((item) => ({
        youtubeId: item.youtubeId,
        title: item.title,
        artist: item.artist,
        thumbnail: `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`,
        channelTitle: item.channelTitle || 'YouTube Karaokê',
        duration: item.duration || '3:30',
        isKaraokeVerified: true,
      }));

      const combined = [...localMatches, ...formattedResults];
      const uniqueResults = Array.from(new Map(combined.map((i) => [i.youtubeId, i])).values());
      return res.status(200).json({ results: uniqueResults });
    }

    if (localMatches.length > 0) {
      return res.status(200).json({ results: localMatches });
    }

    return res.status(200).json({
      results: [
        {
          youtubeId: 'qCzA32V3f2w',
          title: `${cleanQuery} (Karaokê)`,
          artist: cleanQuery,
          thumbnail: 'https://img.youtube.com/vi/qCzA32V3f2w/hqdefault.jpg',
          channelTitle: 'YouTube Karaokê',
          duration: '3:30',
          isKaraokeVerified: true,
        },
      ],
    });
  } catch (error) {
    console.error('Vercel API error:', error);
    return res.status(500).json({ error: 'Failed to search karaoke' });
  }
}
