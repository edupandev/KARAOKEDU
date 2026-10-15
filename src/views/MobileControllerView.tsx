import React, { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';
import { RoomState, SearchResult, Song } from '../types';
import { POPULAR_KARAOKE_CATALOG, GENRE_PRESETS, filterCatalogByQuery } from '../data/karaokeCatalog';
import { Search, Music, Sparkles, Heart, Plus, Trash2, Mic, Flame, Volume2, CheckCircle2, UserCheck, RefreshCw, X, Link, Youtube, Tv } from 'lucide-react';

interface MobileControllerViewProps {
  roomCodeFromUrl: string;
  onBackToHome?: () => void;
}

const AVATAR_OPTIONS = ['🎤', '🎙️', '🕺', '🎧', '👑', '🌟', '🎸', '🍺', '⚡', '💖'];
const KEY_OPTIONS = ['Tom Original', '+1 Semitom', '-1 Semitom', '+2 Semitons', '-2 Semitons'];

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const MobileControllerView: React.FC<MobileControllerViewProps> = ({
  roomCodeFromUrl,
  onBackToHome,
}) => {
  const [roomCode, setRoomCode] = useState(roomCodeFromUrl || 'KARA-8821');
  const [userName, setUserName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎤');
  const [isJoined, setIsJoined] = useState(false);

  // App Tabs
  const [activeTab, setActiveTab] = useState<'search' | 'link' | 'queue' | 'trending' | 'cheer'>('search');

  // Search & Link State
  const [searchQuery, setSearchQuery] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedArtist, setPastedArtist] = useState('');

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedKey, setSelectedKey] = useState('Tom Original');
  const [isMiniPlayerExpanded, setIsMiniPlayerExpanded] = useState(false);

  // Feedback Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Room State
  const [roomState, setRoomState] = useState<RoomState>({
    code: roomCode,
    queue: [],
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    users: [],
    hostConnected: false,
  });

  useEffect(() => {
    // If room code changes from URL
    if (roomCodeFromUrl) {
      setRoomCode(roomCodeFromUrl.toUpperCase());
    }
  }, [roomCodeFromUrl]);

  // Handle Socket events
  useEffect(() => {
    if (!isJoined) return;

    const socket = getSocket();

    // Join room event
    socket.emit('room:join', {
      roomId: roomCode,
      user: {
        id: `user-${socket.id}`,
        name: userName || 'Cantor Secreto',
        avatar: selectedAvatar,
      },
    });

    // Listeners
    socket.on('room:state', (state: RoomState) => {
      setRoomState(state);
    });

    socket.on('room:updated', (data: { queue: Song[]; currentSong: Song | null; users: any[]; isPlaying: boolean }) => {
      setRoomState((prev) => ({
        ...prev,
        queue: data.queue ?? prev.queue,
        currentSong: data.currentSong !== undefined ? data.currentSong : prev.currentSong,
        users: data.users ?? prev.users,
        isPlaying: data.isPlaying !== undefined ? data.isPlaying : prev.isPlaying,
      }));
    });

    socket.on('queue:updated', (data: { queue: Song[]; currentSong: Song | null; addedSong?: Song }) => {
      setRoomState((prev) => ({
        ...prev,
        queue: data.queue,
        currentSong: data.currentSong !== undefined ? data.currentSong : prev.currentSong,
      }));

      if (data.addedSong && data.addedSong.addedBy?.name === userName) {
        showToast(`Música "${data.addedSong.title}" adicionada com sucesso!`);
      }
    });

    socket.on('playback:change', (data: { currentSong: Song | null; isPlaying: boolean }) => {
      setRoomState((prev) => ({
        ...prev,
        currentSong: data.currentSong,
        isPlaying: data.isPlaying,
      }));
    });

    return () => {
      socket.off('room:state');
      socket.off('room:updated');
      socket.off('queue:updated');
      socket.off('playback:change');
    };
  }, [isJoined, roomCode, userName, selectedAvatar]);

  // Debounce search when user types custom query
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;

    const timer = setTimeout(() => {
      handleSearch(searchQuery, 'all');
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Perform Karaoke Search with query and genre
  const handleSearch = async (queryToSearch?: string, genreToSearch?: string) => {
    const q = queryToSearch !== undefined ? queryToSearch : searchQuery;
    const g = genreToSearch !== undefined ? genreToSearch : selectedGenre;

    // Direct YouTube link detection in search box
    const directYtId = extractYouTubeId(q);
    if (directYtId) {
      setSearchResults([
        {
          youtubeId: directYtId,
          title: `Vídeo do YouTube (${directYtId})`,
          artist: 'Link Direto',
          thumbnail: `https://img.youtube.com/vi/${directYtId}/hqdefault.jpg`,
          channelTitle: 'YouTube',
          duration: '3:30',
          isKaraokeVerified: true,
        },
      ]);
      return;
    }

    // Instant local catalog check for zero-latency UI
    const localMatches = filterCatalogByQuery(q, q ? 'all' : g);
    if (localMatches.length > 0) {
      setSearchResults(localMatches);
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/search-karaoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, genre: g }),
      });
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error('Search error:', err);
      const fallback = filterCatalogByQuery(q, q ? 'all' : g);
      if (fallback.length > 0) {
        setSearchResults(fallback);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Instant input change handler
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim() && selectedGenre !== 'all') {
      setSelectedGenre('all');
    }

    // Direct YouTube URL detection
    const directYtId = extractYouTubeId(text);
    if (directYtId) {
      setSearchResults([
        {
          youtubeId: directYtId,
          title: `Vídeo do YouTube (${directYtId})`,
          artist: 'Link Direto do YouTube',
          thumbnail: `https://img.youtube.com/vi/${directYtId}/hqdefault.jpg`,
          channelTitle: 'YouTube',
          duration: '3:30',
          isKaraokeVerified: true,
        },
      ]);
      return;
    }

    // Local instant filter
    const localFiltered = filterCatalogByQuery(text, 'all');
    if (localFiltered.length > 0) {
      setSearchResults(localFiltered);
    }
  };
  // Handler for adding direct YouTube video URL
  const handleAddPastedLink = (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = extractYouTubeId(pastedUrl);
    if (!ytId) {
      showToast('Link do YouTube inválido. Cole uma URL como https://www.youtube.com/watch?v=...');
      return;
    }

    const title = pastedTitle.trim() || `Vídeo do YouTube (${ytId})`;
    const artist = pastedArtist.trim() || 'Link Direto do Convidado';

    const socket = getSocket();
    const newSong: Song = {
      id: `song-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      artist,
      youtubeId: ytId,
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      duration: '3:30',
      addedBy: {
        id: socket.id || `user-${Date.now()}`,
        name: userName || 'Anônimo',
        avatar: selectedAvatar,
      },
      keyAdjustment: selectedKey,
      addedAt: Date.now(),
    };

    socket.emit('queue:add', { roomId: roomCode, song: newSong });
    setPastedUrl('');
    setPastedTitle('');
    setPastedArtist('');
    showToast('Link do vídeo adicionado à fila com sucesso!');
    setActiveTab('queue');
  };

  // Add Song to Queue
  const handleAddSong = (item: SearchResult) => {
    const socket = getSocket();
    const newSong: Song = {
      id: `song-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: item.title,
      artist: item.artist,
      youtubeId: item.youtubeId,
      thumbnail: item.thumbnail,
      duration: item.duration || '3:30',
      addedBy: {
        id: socket.id || `user-${Date.now()}`,
        name: userName || 'Anônimo',
        avatar: selectedAvatar,
      },
      keyAdjustment: selectedKey,
      addedAt: Date.now(),
    };

    socket.emit('queue:add', { roomId: roomCode, song: newSong });
  };

  // Remove own song
  const handleRemoveSong = (songId: string) => {
    const socket = getSocket();
    socket.emit('queue:remove', { roomId: roomCode, songId });
    showToast('Música removida da fila.');
  };

  // Send Party Reaction
  const handleSendReaction = (type: 'clap' | 'fire' | 'sing' | 'love' | 'cheers' | 'mic') => {
    const socket = getSocket();
    socket.emit('reaction:send', {
      roomId: roomCode,
      type,
      userName: userName || 'Anônimo',
      userAvatar: selectedAvatar,
    });
    showToast(`Reação enviada para a TV! 🎉`);
  };

  // STEP 1: JOIN ROOM / USER INITIALIZATION
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#0b0d19] text-white flex flex-col justify-between p-6 font-outfit select-none">
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto w-full py-8">
          {/* Neon Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-pink-500 p-1 box-glow-cyan mb-4">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
              <Mic className="w-10 h-10 text-cyan-300 animate-pulse" />
            </div>
          </div>

          <h1 className="text-3xl font-black font-orbitron tracking-wider bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 bg-clip-text text-transparent mb-1">
            KARAOKEDU
          </h1>
          <p className="text-xs text-cyan-300 uppercase tracking-widest font-mono mb-8">
            Controle do Convidado
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (userName.trim()) setIsJoined(true);
            }}
            className="w-full bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-2xl"
          >
            {/* Room Code Field */}
            <div className="text-left space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Código da Sala (PIN)
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="EX: KARA-8821"
                required
                className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-4 py-3 text-center text-xl font-bold font-orbitron text-cyan-300 focus:outline-none focus:border-cyan-400 tracking-widest uppercase"
              />
            </div>

            {/* User Name Field */}
            <div className="text-left space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Seu Nome ou Apelido
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ex: João Cantor, Maria Diva..."
                required
                maxLength={20}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-pink-500 font-semibold"
              />
            </div>

            {/* Avatar Picker */}
            <div className="text-left space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Escolha seu Avatar
              </label>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
                      selectedAvatar === emoji
                        ? 'bg-gradient-to-tr from-cyan-500 to-pink-500 scale-110 shadow-lg border-2 border-white'
                        : 'bg-slate-950 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!userName.trim()}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 via-pink-500 to-yellow-400 text-slate-950 font-black font-orbitron rounded-2xl text-lg uppercase tracking-wider shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Entrar na Sala 🎤
            </button>
          </form>
        </div>

        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="text-xs text-slate-500 hover:text-slate-300 text-center py-2"
          >
            ← Voltar para Tela Inicial
          </button>
        )}
      </div>
    );
  }

  // STEP 2: ACTIVE MOBILE CONTROLLER DASHBOARD
  return (
    <div className={`min-h-screen bg-[#0b0d19] text-white flex flex-col font-outfit select-none ${roomState.currentSong ? 'pb-36' : 'pb-20'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-gradient-to-r from-cyan-600 to-pink-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
          <span className="text-xs font-bold font-outfit">{toastMessage}</span>
        </div>
      )}

      {/* Top Mobile Bar */}
      <header className="px-4 py-3 bg-slate-950 border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{selectedAvatar}</span>
          <div>
            <h2 className="font-bold text-sm text-white">{userName}</h2>
            <span className="text-[10px] text-cyan-400 font-mono font-bold">
              SALA: {roomState.code}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSearch()}
            className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Currently Playing Sticky Banner */}
      {roomState.currentSong && (
        <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-slate-900 to-pink-950/80 border border-pink-500/40 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl animate-pulse">🎤</span>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest block">TOCANDO NA TV</span>
              <h3 className="font-bold text-xs text-white truncate">{roomState.currentSong.title}</h3>
              <p className="text-[11px] text-slate-400 truncate">{roomState.currentSong.artist}</p>
            </div>
          </div>
          <span className="text-xs bg-pink-500/20 text-pink-300 font-bold px-2 py-1 rounded-full shrink-0 border border-pink-500/30">
            {roomState.currentSong.addedBy?.avatar} {roomState.currentSong.addedBy?.name}
          </span>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 p-4">
        {/* TAB 1: BUSCA DE MÚSICAS */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Search Input Box wrapped in Form for Mobile Keyboards */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch(searchQuery, 'all');
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Nome da música ou artista..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-9 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => handleQueryChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    title="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-5 bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-slate-950 rounded-2xl text-sm shadow-md active:scale-95 transition-all"
              >
                {isSearching ? '...' : 'Buscar'}
              </button>
            </form>

            {/* Key Transposition Helper */}
            <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1.5">
                Ajustar Tom da Sua Música:
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {KEY_OPTIONS.map((keyOpt) => (
                  <button
                    key={keyOpt}
                    onClick={() => setSelectedKey(keyOpt)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedKey === keyOpt
                        ? 'bg-yellow-400 text-slate-950 shadow'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {keyOpt}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre Filter Presets */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {GENRE_PRESETS.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => {
                    setSelectedGenre(genre.id);
                    handleSearch(searchQuery, genre.id);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedGenre === genre.id
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="space-y-2.5 mt-2">
              {searchResults.length > 0 ? (
                <>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Resultados ({searchResults.length})
                  </h3>

                  {searchResults.map((item) => (
                    <div
                      key={item.youtubeId}
                      className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-md hover:border-cyan-500/40 transition-all"
                    >
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-14 h-14 object-cover rounded-xl border border-slate-700 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-white truncate leading-snug">{item.title}</h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{item.artist}</p>
                        <span className="text-[10px] text-cyan-400 font-mono inline-block mt-1">
                          {item.channelTitle || 'Karaokê'} · {item.duration || '3:30'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddSong(item)}
                        className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shrink-0 active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Fila</span>
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="py-10 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6">
                  <Search className="w-10 h-10 text-cyan-400/40 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-bold text-slate-200">Pesquise suas Músicas</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Digite o nome da música ou cantor no campo acima para buscar no YouTube ou selecione uma categoria.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FILA EM TEMPO REAL */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white font-orbitron">Fila da Sala</h3>
              <span className="text-xs text-cyan-400 font-bold bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                {roomState.queue.length} Músicas
              </span>
            </div>

            {roomState.queue.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
                <Music className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-300">Nenhuma música na fila!</p>
                <p className="text-xs text-slate-500 mt-1">Seja o primeiro a pedir uma música na aba Busca.</p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="mt-4 px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Buscar Músicas 🔍
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {roomState.queue.map((song, index) => {
                  const isMySong = song.addedBy?.name === userName;
                  return (
                    <div
                      key={song.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isMySong
                          ? 'bg-gradient-to-r from-pink-950/40 via-slate-900 to-slate-900 border-pink-500/50'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-sm font-black text-cyan-400 w-5 text-center shrink-0">
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-white truncate">{song.title}</h4>
                          <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-pink-300 font-medium">
                              {song.addedBy?.avatar} {song.addedBy?.name}
                            </span>
                            {song.keyAdjustment && (
                              <span className="text-[10px] bg-slate-800 text-yellow-300 px-1.5 py-0.2 rounded font-mono">
                                {song.keyAdjustment}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isMySong && (
                        <button
                          onClick={() => handleRemoveSong(song.id)}
                          className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs transition-all shrink-0"
                          title="Remover minha música"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: POPULARES & HITS DE KARAOKÊ */}
        {activeTab === 'trending' && (
          <div className="space-y-3">
            <h3 className="font-bold text-base text-white font-orbitron">Clássicos de Karaokê</h3>
            <p className="text-xs text-slate-400">As mais cantadas de todos os tempos. Adicione em 1 toque!</p>

            <div className="space-y-2.5 mt-3">
              {POPULAR_KARAOKE_CATALOG.map((item) => (
                <div
                  key={item.youtubeId}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-white truncate">{item.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{item.artist}</p>
                  </div>
                  <button
                    onClick={() => handleAddSong(item)}
                    className="px-3 py-1.5 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs shrink-0"
                  >
                    + Pedir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: EAÇÃO E INTERAÇÃO COM A TV */}
        {activeTab === 'cheer' && (
          <div className="space-y-5 text-center">
            <div>
              <h3 className="font-bold text-lg text-white font-orbitron">Animar a Festa na TV 🎆</h3>
              <p className="text-xs text-slate-400 mt-1">Toque nos botões para disparar efeitos visuais e aplausos na tela grande!</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSendReaction('clap')}
                className="p-5 bg-slate-900 border-2 border-yellow-500/40 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-4xl">👏</span>
                <span className="font-bold text-sm text-yellow-300">Mandou Bem!</span>
              </button>

              <button
                onClick={() => handleSendReaction('fire')}
                className="p-5 bg-slate-900 border-2 border-orange-500/40 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-4xl">🔥</span>
                <span className="font-bold text-sm text-orange-400">Pegando Fogo!</span>
              </button>

              <button
                onClick={() => handleSendReaction('sing')}
                className="p-5 bg-slate-900 border-2 border-cyan-500/40 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-4xl">🎤</span>
                <span className="font-bold text-sm text-cyan-300">Solta a Voz!</span>
              </button>

              <button
                onClick={() => handleSendReaction('love')}
                className="p-5 bg-slate-900 border-2 border-pink-500/40 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-4xl">💖</span>
                <span className="font-bold text-sm text-pink-400">Que Afinação!</span>
              </button>

              <button
                onClick={() => handleSendReaction('cheers')}
                className="p-5 bg-slate-900 border-2 border-amber-500/40 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-4xl">🍺</span>
                <span className="font-bold text-sm text-amber-300">Tim-Tim!</span>
              </button>

              <button
                onClick={() => handleSendReaction('mic')}
                className="p-5 bg-slate-900 border-2 border-purple-500/40 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <span className="text-4xl">🎙️</span>
                <span className="font-bold text-sm text-purple-300">Show Solo!</span>
              </button>
            </div>
          </div>
        )}
        {/* TAB 1.5: COLAR LINK DIRETO DO YOUTUBE */}
        {activeTab === 'link' && (
          <form onSubmit={handleAddPastedLink} className="space-y-4">
            <div className="bg-slate-900/90 border border-pink-500/40 p-5 rounded-3xl space-y-4 shadow-xl box-glow-pink">
              <div className="flex items-center gap-2 text-pink-400 font-bold text-sm">
                <Youtube className="w-5 h-5 text-red-500 shrink-0" />
                <span className="font-orbitron">Colar Link Direto do YouTube</span>
              </div>

              <p className="text-xs text-slate-300">
                Copie o link de qualquer vídeo ou karaokê no aplicativo do YouTube e cole abaixo para tocar na TV:
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  URL ou Link do Vídeo *
                </label>
                <input
                  type="text"
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  placeholder="Ex: https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Nome da Música / Título (Opcional)
                </label>
                <input
                  type="text"
                  value={pastedTitle}
                  onChange={(e) => setPastedTitle(e.target.value)}
                  placeholder="Ex: Evidências"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Artista / Cantor (Opcional)
                </label>
                <input
                  type="text"
                  value={pastedArtist}
                  onChange={(e) => setPastedArtist(e.target.value)}
                  placeholder="Ex: Chitãozinho & Xororó"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={!pastedUrl.trim()}
                className="w-full py-4 bg-gradient-to-r from-pink-500 via-cyan-500 to-yellow-400 text-slate-950 font-black font-orbitron rounded-2xl text-sm shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Tocar este Vídeo na TV 🎬</span>
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Floating Mini Player on Mobile */}
      {roomState.currentSong && (
        <div className="fixed bottom-16 left-3 right-3 z-30 transition-all duration-300">
          {/* Expanded Video Preview Box */}
          {isMiniPlayerExpanded && (
            <div className="mb-2 bg-slate-950 border border-cyan-500/50 rounded-2xl p-2.5 shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-800 text-xs font-bold text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-pink-400" /> Mini Player Karaokê
                </span>
                <button
                  onClick={() => setIsMiniPlayerExpanded(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
                  title="Fechar vídeo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-video w-full rounded-xl overflow-hidden mt-2 bg-black border border-slate-800 relative shadow-inner">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${roomState.currentSong.youtubeId}?autoplay=0&controls=1&modestbranding=1`}
                  title={roomState.currentSong.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </div>
          )}

          {/* Mini Player Dock Bar */}
          <div className="bg-slate-950/95 border border-cyan-500/40 p-2.5 rounded-2xl flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md box-glow-cyan">
            <button
              onClick={() => setIsMiniPlayerExpanded(!isMiniPlayerExpanded)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
            >
              <div className="relative shrink-0">
                <img
                  src={roomState.currentSong.thumbnail}
                  alt={roomState.currentSong.title}
                  className="w-11 h-11 object-cover rounded-xl border border-cyan-500/40"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[10px] text-pink-400 font-bold uppercase tracking-wider truncate">
                  <span>🎤 CANTANDO: {roomState.currentSong.addedBy?.avatar} {roomState.currentSong.addedBy?.name || 'Convidado'}</span>
                </div>
                <h4 className="font-bold text-xs text-white truncate leading-snug">
                  {roomState.currentSong.title}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {roomState.currentSong.artist}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsMiniPlayerExpanded(!isMiniPlayerExpanded)}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-800 transition-all active:scale-95"
                title="Abrir ou fechar vídeo no celular"
              >
                <Tv className="w-3.5 h-3.5 text-pink-400" />
                <span>{isMiniPlayerExpanded ? 'Fechar' : 'Mini Vídeo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Mobile Tab Bar Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 px-2 py-2 flex items-center justify-around z-40">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'search' ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-400'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Busca</span>
        </button>

        <button
          onClick={() => setActiveTab('link')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'link' ? 'text-pink-400 font-bold bg-pink-950/40' : 'text-slate-400'
          }`}
        >
          <Link className="w-5 h-5" />
          <span>Colar Link</span>
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all relative ${
            activeTab === 'queue' ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-400'
          }`}
        >
          <Music className="w-5 h-5" />
          <span>Fila</span>
          {roomState.queue.length > 0 && (
            <span className="absolute -top-1 right-1 bg-pink-500 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {roomState.queue.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('trending')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'trending' ? 'text-yellow-400 font-bold bg-yellow-950/40' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>Hits</span>
        </button>

        <button
          onClick={() => setActiveTab('cheer')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'cheer' ? 'text-amber-400 font-bold bg-amber-950/40' : 'text-slate-400'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span>Animar</span>
        </button>
      </nav>
    </div>
  );
};
