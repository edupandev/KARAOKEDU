export interface User {
  id: string;
  name: string;
  avatar: string;
  isHost?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  thumbnail: string;
  duration?: string;
  addedBy: User;
  keyAdjustment?: string; // e.g. 'Tom Original', '+1 Semitom', '-2 Semitons'
  addedAt: number;
}

export interface RoomState {
  code: string;
  queue: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  users: User[];
  hostConnected: boolean;
}

export interface Reaction {
  id: string;
  type: 'clap' | 'fire' | 'sing' | 'love' | 'cheers' | 'mic';
  userName: string;
  userAvatar: string;
  timestamp: number;
  x: number; // 5% to 95% across screen
}

export interface SearchResult {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnail: string;
  channelTitle?: string;
  duration?: string;
  isKaraokeVerified?: boolean;
  genre?: string[]; // e.g. ['sertanejo', 'pop']
  keywords?: string[]; // e.g. ['evidencias', 'chitaozinho', 'chora me liga']
}
