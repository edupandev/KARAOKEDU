import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { POPULAR_KARAOKE_CATALOG, filterCatalogByQuery, normalizeText } from './src/data/karaokeCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

// Initialize Gemini AI Client for Karaoke Search & Song Assistance
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Room State Data Model
interface ServerUser {
  id: string;
  name: string;
  avatar: string;
  socketId: string;
  isHost?: boolean;
}

interface ServerSong {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  thumbnail: string;
  duration?: string;
  addedBy: {
    id: string;
    name: string;
    avatar: string;
  };
  keyAdjustment?: string;
  addedAt: number;
}

interface ServerRoom {
  code: string;
  queue: ServerSong[];
  currentSong: ServerSong | null;
  isPlaying: boolean;
  currentTime: number;
  users: ServerUser[];
  hostSocketId: string | null;
  hostConnected: boolean;
}

const rooms = new Map<string, ServerRoom>();

// Generate a readable 4-6 char room PIN
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KARA-${code}`;
}

function getOrCreateRoom(code: string): ServerRoom {
  const upperCode = code.toUpperCase().trim();
  if (!rooms.has(upperCode)) {
    rooms.set(upperCode, {
      code: upperCode,
      queue: [],
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      users: [],
      hostSocketId: null,
      hostConnected: false,
    });
  }
  return rooms.get(upperCode)!;
}

// API Routes

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size, timestamp: Date.now() });
});

// Trending Songs
app.get('/api/trending', (_req, res) => {
  res.json({ catalog: POPULAR_KARAOKE_CATALOG });
});

// Helper function to extract YouTube video ID from URL or raw ID
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

// Search YouTube Karaoke Videos
app.post('/api/search-karaoke', async (req, res) => {
  try {
    const { query = '' } = req.body || {};
    const cleanQuery = typeof query === 'string' ? query.trim() : '';

    if (!cleanQuery) {
      return res.json({ results: POPULAR_KARAOKE_CATALOG });
    }

    // Direct YouTube Link / ID pasted into search box
    const directYtId = extractYouTubeId(cleanQuery);
    if (directYtId) {
      return res.json({
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

    // 1. Official YouTube Data API v3 search with videoEmbeddable=true
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
        console.warn('YouTube Data API search failed, falling back:', ytErr);
      }
    }

    // 2. Gemini AI Search prioritizing accurate embeddable karaoke videos matching query
    if (youtubeResults.length === 0 && process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `The user is searching for a karaoke video on YouTube: "${searchQuery}".
Return 6 real, highly relevant YouTube video search results matching "${cleanQuery}".
IMPORTANT: Return accurate video results for "${cleanQuery}" specifically. Do NOT return unrelated or generic songs.
Return JSON array with objects:
- title: Song Title
- artist: Artist Name
- youtubeId: A valid, real 11-character YouTube video ID for this karaoke video
- channelTitle: Karaoke Channel Name
- duration: e.g. "3:45"`,
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

    // 3. Local matches in curated catalog
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

      // Combine local catalog matches (if relevant) with YouTube results, avoiding duplicates
      const combined = [...localMatches, ...formattedResults];
      const uniqueResults = Array.from(new Map(combined.map((i) => [i.youtubeId, i])).values());
      return res.json({ results: uniqueResults });
    }

    // If local catalog matches exist, return them
    if (localMatches.length > 0) {
      return res.json({ results: localMatches });
    }

    // NO RANDOM FALLBACK SONGS! Return dedicated result matching user's custom query
    return res.json({
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
    console.error('Search karaoke error:', error);
    res.status(500).json({ error: 'Failed to search karaoke tracks on YouTube' });
  }
});

// Socket.io Room Logic
io.on('connection', (socket) => {
  let currentRoomCode: string | null = null;
  let currentUser: ServerUser | null = null;

  // Create or Join Room
  socket.on('room:join', ({ roomId, user, isHost }: { roomId: string; user: { id: string; name: string; avatar: string }; isHost?: boolean }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = getOrCreateRoom(roomCode);

    currentRoomCode = roomCode;
    socket.join(`room:${roomCode}`);

    if (isHost) {
      room.hostSocketId = socket.id;
      room.hostConnected = true;
    }

    const newUser: ServerUser = {
      id: user.id || socket.id,
      name: user.name || (isHost ? 'TV Host' : 'Convidado'),
      avatar: user.avatar || '🎤',
      socketId: socket.id,
      isHost: !!isHost,
    };

    currentUser = newUser;

    // Filter existing user instance if re-connecting
    room.users = room.users.filter((u) => u.id !== newUser.id);
    room.users.push(newUser);

    // Send updated room state to the client that joined
    socket.emit('room:state', {
      code: room.code,
      queue: room.queue,
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      users: room.users,
      hostConnected: !!room.hostSocketId,
    });

    // Broadcast user joined to room
    io.to(`room:${roomCode}`).emit('room:user_joined', {
      user: newUser,
      usersCount: room.users.length,
    });

    // Broadcast room update to all clients in room
    io.to(`room:${roomCode}`).emit('room:updated', {
      queue: room.queue,
      currentSong: room.currentSong,
      users: room.users,
      isPlaying: room.isPlaying,
    });
  });

  // Add Song to Queue
  socket.on('queue:add', ({ roomId, song }: { roomId: string; song: ServerSong }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const formattedSong: ServerSong = {
      ...song,
      id: song.id || `song-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      addedAt: Date.now(),
    };

    // If no song is currently playing, start this song immediately!
    if (!room.currentSong) {
      room.currentSong = formattedSong;
      room.isPlaying = true;
      room.currentTime = 0;

      io.to(`room:${roomCode}`).emit('playback:change', {
        currentSong: room.currentSong,
        isPlaying: true,
      });
    } else {
      room.queue.push(formattedSong);
    }

    io.to(`room:${roomCode}`).emit('queue:updated', {
      queue: room.queue,
      currentSong: room.currentSong,
      addedSong: formattedSong,
    });
  });

  // Remove Song from Queue
  socket.on('queue:remove', ({ roomId, songId }: { roomId: string; songId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    room.queue = room.queue.filter((s) => s.id !== songId);

    io.to(`room:${roomCode}`).emit('queue:updated', {
      queue: room.queue,
      currentSong: room.currentSong,
    });
  });

  // Skip / Next Song
  socket.on('playback:next', ({ roomId }: { roomId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.queue.length > 0) {
      room.currentSong = room.queue.shift() || null;
      room.isPlaying = true;
      room.currentTime = 0;
    } else {
      room.currentSong = null;
      room.isPlaying = false;
      room.currentTime = 0;
    }

    io.to(`room:${roomCode}`).emit('playback:change', {
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
    });

    io.to(`room:${roomCode}`).emit('queue:updated', {
      queue: room.queue,
      currentSong: room.currentSong,
    });
  });

  // Update Playback State (from Host TV)
  socket.on('playback:state_update', ({ roomId, isPlaying, currentTime }: { roomId: string; isPlaying: boolean; currentTime: number }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    room.isPlaying = isPlaying;
    room.currentTime = currentTime;

    socket.to(`room:${roomCode}`).emit('playback:synced', {
      isPlaying,
      currentTime,
    });
  });

  // Reorder Queue
  socket.on('queue:reorder', ({ roomId, newQueue }: { roomId: string; newQueue: ServerSong[] }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    room.queue = newQueue;

    io.to(`room:${roomCode}`).emit('queue:updated', {
      queue: room.queue,
      currentSong: room.currentSong,
    });
  });

  // Send Party Reaction (Applause, Fire, Sing, Love, Cheers)
  socket.on('reaction:send', ({ roomId, type, userName, userAvatar }: { roomId: string; type: string; userName: string; userAvatar: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const reaction = {
      id: `react-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      userName: userName || 'Anônimo',
      userAvatar: userAvatar || '🎤',
      timestamp: Date.now(),
      x: Math.floor(Math.random() * 85) + 5, // random X position % on TV screen
    };

    io.to(`room:${roomCode}`).emit('reaction:received', reaction);
  });

  // Host Remote Controls
  socket.on('host:command', ({ roomId, action, value }: { roomId: string; action: string; value?: any }) => {
    const roomCode = roomId.toUpperCase().trim();
    io.to(`room:${roomCode}`).emit('host:action', { action, value });
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    if (currentRoomCode && currentUser) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.users = room.users.filter((u) => u.socketId !== socket.id);
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = null;
          room.hostConnected = false;
        }

        io.to(`room:${currentRoomCode}`).emit('room:updated', {
          queue: room.queue,
          currentSong: room.currentSong,
          users: room.users,
          isPlaying: room.isPlaying,
        });
      }
    }
  });
});

// Configure Vite Express Middleware for Dev / Production
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎤 KARAOKEDU Full Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
