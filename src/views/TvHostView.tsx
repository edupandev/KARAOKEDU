import React, { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';
import { Reaction, RoomState, Song } from '../types';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { KaraokeLyricsPlayer } from '../components/KaraokeLyricsPlayer';
import { ReactionOverlay } from '../components/ReactionOverlay';
import { Music, Play, SkipForward, Volume2, Users, Radio, Sparkles, Mic2, Tv, Film } from 'lucide-react';

interface TvHostViewProps {
  initialRoomCode?: string;
  onBackToHome?: () => void;
}

export const TvHostView: React.FC<TvHostViewProps> = ({ initialRoomCode, onBackToHome }) => {
  const [roomState, setRoomState] = useState<RoomState>({
    code: initialRoomCode || 'KARA-MAIN',
    queue: [],
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    users: [],
    hostConnected: true,
  });

  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [playerSource, setPlayerSource] = useState<'weblyrics' | 'youtube'>('weblyrics');

  useEffect(() => {
    const socket = getSocket();
    const roomCode = initialRoomCode || 'KARA-8821';

    // Construct mobile controller join URL
    const baseUrl = window.location.origin;
    const fullJoinUrl = `${baseUrl}/?room=${roomCode}`;
    setJoinUrl(fullJoinUrl);

    // Join room as Host TV
    socket.emit('room:join', {
      roomId: roomCode,
      user: {
        id: `tv-host-${Date.now()}`,
        name: 'Smart TV Display',
        avatar: '📺',
      },
      isHost: true,
    });

    // Listen to Room State
    socket.on('room:state', (state: RoomState) => {
      setRoomState(state);
    });

    // Listen to Room Updates
    socket.on('room:updated', (data: { queue: Song[]; currentSong: Song | null; users: any[]; isPlaying: boolean }) => {
      setRoomState((prev) => ({
        ...prev,
        queue: data.queue ?? prev.queue,
        currentSong: data.currentSong !== undefined ? data.currentSong : prev.currentSong,
        users: data.users ?? prev.users,
        isPlaying: data.isPlaying !== undefined ? data.isPlaying : prev.isPlaying,
      }));
    });

    // Listen to Queue Updates
    socket.on('queue:updated', (data: { queue: Song[]; currentSong: Song | null }) => {
      setRoomState((prev) => ({
        ...prev,
        queue: data.queue,
        currentSong: data.currentSong !== undefined ? data.currentSong : prev.currentSong,
      }));
    });

    // Listen to Playback Change
    socket.on('playback:change', (data: { currentSong: Song | null; isPlaying: boolean }) => {
      setRoomState((prev) => ({
        ...prev,
        currentSong: data.currentSong,
        isPlaying: data.isPlaying,
      }));
    });

    // Listen to Reaction Broadcasts
    socket.on('reaction:received', (reaction: Reaction) => {
      setReactions((prev) => [...prev.slice(-12), reaction]);
      // Remove reaction after animation finishes
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3500);
    });

    // Listen to Host Remote Control Actions
    socket.on('host:action', ({ action }: { action: string }) => {
      if (action === 'skip') {
        handleNextSong();
      } else if (action === 'pause' || action === 'play') {
        setRoomState((prev) => ({ ...prev, isPlaying: action === 'play' }));
      }
    });

    return () => {
      socket.off('room:state');
      socket.off('room:updated');
      socket.off('queue:updated');
      socket.off('playback:change');
      socket.off('reaction:received');
      socket.off('host:action');
    };
  }, [initialRoomCode]);

  const handleNextSong = () => {
    const socket = getSocket();
    socket.emit('playback:next', { roomId: roomState.code });
  };

  const unlockAudio = () => {
    setAudioUnlocked(true);
  };

  return (
    <div className="relative w-screen h-screen bg-[#0b0d19] text-white overflow-hidden flex flex-col font-outfit select-none">
      {/* Background Ambient Glow FX (TV optimized) */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-pink-600/10 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Floating Reaction Overlay */}
      <ReactionOverlay reactions={reactions} />

      {/* Top Header Bar Contract (Smart TV Display) */}
      <header className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-cyan-500/20 bg-slate-950/80">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToHome}
            className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded-xl p-1 transition-all"
            title="Voltar ao início"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-pink-500 p-0.5 shadow-lg shadow-cyan-500/30">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Mic2 className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black font-orbitron tracking-wider bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 bg-clip-text text-transparent text-glow-cyan">
                KARAOKEDU
              </h1>
              <span className="text-xs tracking-widest text-cyan-300 font-mono uppercase block -mt-1">
                Smart TV Host Display
              </span>
            </div>
          </button>
        </div>

        {/* Room Code Badge & Connected Guests & Standalone Window Button */}
        <div className="flex items-center gap-4">
          <a
            href={`${window.location.origin}/?mode=tv&room=${roomState.code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all"
            title="Abrir a tela da TV em uma janela própria de exibição"
          >
            <Tv className="w-4 h-4" />
            <span>Abrir TV em Nova Aba ↗</span>
          </a>

          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-sm font-semibold">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>{roomState.users.length} Conectado(s)</span>
          </div>

          <div className="flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-cyan-950 to-pink-950 border-2 border-cyan-400 rounded-2xl box-glow-cyan">
            <Radio className="w-5 h-5 text-pink-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">CÓDIGO DA SALA</span>
              <span className="text-2xl font-black font-orbitron text-cyan-300 tracking-widest text-glow-cyan">
                {roomState.code}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 p-6 flex gap-6 overflow-hidden">
        {roomState.currentSong ? (
          /* ACTIVE PLAYBACK MODE: Video Player + Upcoming Queue */
          <div className="w-full h-full flex gap-6">
            {/* Main Video Stage */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Currently Playing Singer Banner */}
              <div className="flex items-center justify-between px-6 py-3.5 bg-gradient-to-r from-slate-900/90 via-slate-900/90 to-pink-950/80 border border-cyan-500/30 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-3xl p-2 bg-slate-800 rounded-xl border border-cyan-400/40 shrink-0">
                    {roomState.currentSong.addedBy?.avatar || '🎤'}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40 rounded-full font-mono">
                        CANTANDO AGORA
                      </span>
                      <span className="text-sm text-cyan-300 font-medium">
                        Cantor(a): <strong className="text-white font-bold">{roomState.currentSong.addedBy?.name || 'Convidado'}</strong>
                      </span>
                      {roomState.currentSong.keyAdjustment && (
                        <span className="text-xs bg-slate-800 text-yellow-300 px-2 py-0.5 rounded-md border border-yellow-500/30 font-mono">
                          {roomState.currentSong.keyAdjustment}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-white truncate mt-0.5 font-orbitron">
                      {roomState.currentSong.title}
                    </h2>
                    <p className="text-sm text-slate-400 truncate">{roomState.currentSong.artist}</p>
                  </div>
                </div>

                {/* Host Control Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleNextSong}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-pink-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all text-xs font-orbitron"
                  >
                    <SkipForward className="w-4 h-4 stroke-[2.5]" />
                    <span>Próxima Música</span>
                  </button>
                </div>
              </div>

              {/* YouTube Video Player Stage */}
              <div className="flex-1 min-h-0 relative">
                <YouTubePlayer
                  youtubeId={roomState.currentSong.youtubeId}
                  songTitle={roomState.currentSong.title}
                  songArtist={roomState.currentSong.artist}
                  isPlaying={roomState.isPlaying}
                  onSongEnded={handleNextSong}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Sidebar: Up Next Queue & QR Code Shortcut */}
            <div className="w-96 flex flex-col gap-4 shrink-0">
              {/* Upcoming Queue List */}
              <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-pink-400" />
                    <h3 className="font-bold text-lg font-orbitron text-slate-200">Próximas Fila</h3>
                  </div>
                  <span className="text-xs bg-slate-800 text-cyan-400 font-bold px-2.5 py-1 rounded-full border border-cyan-500/30">
                    {roomState.queue.length} em espera
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1">
                  {roomState.queue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                      <Sparkles className="w-10 h-10 text-cyan-500/40 mb-2 animate-bounce" />
                      <p className="text-sm font-medium">A fila está vazia!</p>
                      <p className="text-xs text-slate-400 mt-1">Aponte a câmera para o QR Code para adicionar músicas.</p>
                    </div>
                  ) : (
                    roomState.queue.map((song, index) => (
                      <div
                        key={song.id}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                          index === 0
                            ? 'bg-gradient-to-r from-pink-950/40 to-slate-900 border-pink-500/40 shadow-md'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <span className="font-mono text-sm font-bold text-cyan-400 w-6 text-center shrink-0">
                          #{index + 1}
                        </span>
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-700 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-100 truncate">{song.title}</h4>
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
                    ))
                  )}
                </div>
              </div>

              {/* Side Compact QR Code Widget */}
              <div className="p-4 bg-slate-950/90 border border-cyan-500/30 rounded-2xl flex items-center gap-4 shadow-xl">
                <QRCodeDisplay url={joinUrl} size={110} />
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-pink-400 font-bold uppercase tracking-wider block">QUER CANTAR TAMBÉM?</span>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">Escaneie com a câmera do celular</p>
                  <p className="text-xs text-cyan-400 font-mono mt-1 font-bold">PIN: {roomState.code}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* STANDBY MODE: Central QR Code + Room Join Instructions + Animated Visuals */
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 relative">
            {/* Ambient Animated Karaoke Disco Badge */}
            <div className="mb-6 relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500 via-pink-500 to-yellow-400 p-1 animate-pulse-glow mx-auto shadow-2xl">
                <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                  <Mic2 className="w-12 h-12 text-cyan-300" />
                </div>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-black font-orbitron tracking-wide mb-3 bg-gradient-to-r from-cyan-300 via-pink-400 to-yellow-300 bg-clip-text text-transparent">
              PRONTO PARA O SHOW?
            </h2>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-light mb-8">
              Aponte a câmera do seu celular para o <span className="text-cyan-400 font-bold">QR Code</span> e escolha suas músicas favoritas para entrar na fila em tempo real!
            </p>

            {/* Central QR Code Stage */}
            <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-900/90 border-2 border-cyan-500/50 p-8 rounded-3xl shadow-2xl box-glow-cyan max-w-3xl">
              <div className="relative">
                <QRCodeDisplay url={joinUrl} size={240} />
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl w-full">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    CÓDIGO DA SALA (PIN)
                  </span>
                  <div className="text-4xl font-black font-orbitron text-pink-400 tracking-widest text-glow-pink">
                    {roomState.code}
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-slate-300">
                  <div className="flex items-center justify-center md:justify-start gap-2 text-cyan-300 font-semibold">
                    <span>1.</span> Abra a câmera do celular ou acesse a URL
                  </div>
                  <div className="text-xs font-mono text-cyan-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-cyan-500/30 truncate max-w-xs">
                    {joinUrl}
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-slate-300">
                    <span>2.</span> Escolha seu apelido e pesquise a música
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-pink-300 font-semibold">
                    <span>3.</span> Toque em "+ Adicionar à Fila" e arrase!
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Autoplay Unlock Banner for Smart TV Browser Policies */}
      {!audioUnlocked && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-pink-600 to-cyan-600 text-white px-6 py-3 rounded-2xl shadow-2xl border-2 border-white/40 flex items-center gap-4 animate-bounce">
          <Volume2 className="w-6 h-6 animate-pulse" />
          <span className="text-sm font-bold font-outfit">
            Smart TV: Clique na tela uma vez para liberar a execução automática do áudio!
          </span>
          <button
            onClick={unlockAudio}
            className="px-4 py-1.5 bg-white text-slate-950 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all shadow-md"
          >
            Ativar Áudio
          </button>
        </div>
      )}
    </div>
  );
};
