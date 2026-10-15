import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  reactions: any[];
  lastUpdated: number;
}

// Global in-memory rooms store for serverless execution
const rooms = (globalThis as any).__KARAOKE_ROOMS__ || new Map<string, ServerRoom>();
(globalThis as any).__KARAOKE_ROOMS__ = rooms;

function getOrCreateRoom(code: string): ServerRoom {
  const upperCode = (code || 'KARA-8821').toUpperCase().trim();
  if (!rooms.has(upperCode)) {
    rooms.set(upperCode, {
      code: upperCode,
      queue: [],
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      users: [],
      reactions: [],
      lastUpdated: Date.now(),
    });
  }
  return rooms.get(upperCode)!;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET /api/room?roomId=KARA-8821
  if (req.method === 'GET') {
    const roomId = (req.query.roomId as string) || 'KARA-8821';
    const room = getOrCreateRoom(roomId);
    return res.status(200).json({
      code: room.code,
      queue: room.queue,
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      users: room.users,
      reactions: room.reactions || [],
      lastUpdated: room.lastUpdated,
    });
  }

  // POST /api/room (Actions: join, queue:add, queue:remove, playback:next, reaction:send)
  if (req.method === 'POST') {
    const { action, roomId = 'KARA-8821', user, song, songId, type, userName, userAvatar, isPlaying } = req.body || {};
    const room = getOrCreateRoom(roomId);

    if (action === 'room:join') {
      if (user) {
        const newUser: ServerUser = {
          id: user.id || `user-${Date.now()}`,
          name: user.name || 'Convidado',
          avatar: user.avatar || '🎤',
          socketId: `http-${Date.now()}`,
        };
        room.users = room.users.filter((u) => u.id !== newUser.id);
        room.users.push(newUser);
      }
      room.lastUpdated = Date.now();
      return res.status(200).json({
        success: true,
        roomState: {
          code: room.code,
          queue: room.queue,
          currentSong: room.currentSong,
          isPlaying: room.isPlaying,
          currentTime: room.currentTime,
          users: room.users,
          hostConnected: true,
        },
      });
    }

    if (action === 'queue:add' && song) {
      const formattedSong: ServerSong = {
        ...song,
        id: song.id || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        addedAt: Date.now(),
      };

      if (!room.currentSong) {
        room.currentSong = formattedSong;
        room.isPlaying = true;
        room.currentTime = 0;
      } else {
        room.queue.push(formattedSong);
      }

      room.lastUpdated = Date.now();
      return res.status(200).json({
        success: true,
        queue: room.queue,
        currentSong: room.currentSong,
        addedSong: formattedSong,
      });
    }

    if (action === 'queue:remove' && songId) {
      room.queue = room.queue.filter((s) => s.id !== songId);
      room.lastUpdated = Date.now();
      return res.status(200).json({
        success: true,
        queue: room.queue,
        currentSong: room.currentSong,
      });
    }

    if (action === 'playback:next') {
      if (room.queue.length > 0) {
        room.currentSong = room.queue.shift() || null;
        room.isPlaying = true;
        room.currentTime = 0;
      } else {
        room.currentSong = null;
        room.isPlaying = false;
        room.currentTime = 0;
      }
      room.lastUpdated = Date.now();
      return res.status(200).json({
        success: true,
        queue: room.queue,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
      });
    }

    if (action === 'playback:state_update') {
      if (typeof isPlaying === 'boolean') {
        room.isPlaying = isPlaying;
      }
      room.lastUpdated = Date.now();
      return res.status(200).json({ success: true, isPlaying: room.isPlaying });
    }

    if (action === 'reaction:send') {
      const reaction = {
        id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: type || 'clap',
        userName: userName || 'Anônimo',
        userAvatar: userAvatar || '🎤',
        timestamp: Date.now(),
        x: Math.floor(Math.random() * 85) + 5,
      };
      if (!room.reactions) room.reactions = [];
      room.reactions.push(reaction);
      // Keep last 20 reactions
      if (room.reactions.length > 20) {
        room.reactions = room.reactions.slice(-20);
      }
      room.lastUpdated = Date.now();
      return res.status(200).json({ success: true, reaction });
    }

    return res.status(200).json({
      code: room.code,
      queue: room.queue,
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      users: room.users,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
