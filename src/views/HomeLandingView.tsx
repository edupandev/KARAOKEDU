import React, { useState } from 'react';
import { Tv, Smartphone, Mic2, Sparkles, Music, Users, Radio } from 'lucide-react';

interface HomeLandingViewProps {
  onSelectTvHost: (roomCode: string) => void;
  onSelectMobileController: (roomCode: string) => void;
}

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  onSelectTvHost,
  onSelectMobileController,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const handleCreateNewRoom = () => {
    // Generate readable random PIN e.g. KARA-9281
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < 4; i++) {
      pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newRoomCode = `KARA-${pin}`;
    onSelectTvHost(newRoomCode);
  };

  const handleJoinExistingRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCodeInput.trim()) {
      onSelectMobileController(roomCodeInput.trim().toUpperCase());
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0d19] text-white flex flex-col justify-between p-6 md:p-12 font-outfit select-none relative overflow-hidden">
      {/* Background Decorative Ambient Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-600/20 via-pink-600/10 to-transparent rounded-full filter blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-pink-500 p-0.5 box-glow-cyan">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-cyan-300" />
            </div>
          </div>
          <span className="text-xl font-black font-orbitron tracking-wider text-white">
            KARAOKEDU
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-full">
          <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
          <span>Festa Interativa em Tempo Real</span>
        </div>
      </header>

      {/* Hero Content Area */}
      <main className="relative z-10 max-w-4xl mx-auto w-full my-auto py-12 text-center flex flex-col items-center">
        {/* Neon Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold font-mono mb-6 shadow-lg shadow-cyan-500/10">
          <Sparkles className="w-4 h-4 text-pink-400" />
          <span>Smart TV + Fila no Celular por QR Code</span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl md:text-7xl font-black font-orbitron tracking-tight text-white mb-6 leading-tight">
          O KARAOKÊ DA SUA FESTA <br />
          <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 bg-clip-text text-transparent text-glow-cyan">
            NA TELA GRANDE!
          </span>
        </h1>

        <p className="text-base md:text-xl text-slate-300 max-w-2xl font-light leading-relaxed mb-12">
          Abra a interface na sua <strong className="text-cyan-400">Smart TV</strong>. Seus convidados escaneiam o <strong className="text-pink-400">QR Code</strong> pelo celular para buscar músicas e montar a fila em tempo real!
        </p>

        {/* Mode Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* OPTION A: SMART TV DISPLAY */}
          <div className="bg-slate-900/90 border-2 border-cyan-500/40 hover:border-cyan-400 rounded-3xl p-8 flex flex-col justify-between text-left shadow-2xl box-glow-cyan transition-all hover:scale-[1.02]">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-6">
                <Tv className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold font-orbitron text-white mb-2">
                Modo Smart TV (Host)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Exiba a tela de karaokê na TV com QR Code, vídeos do YouTube e fila de reprodução automática.
              </p>
            </div>

            <button
              onClick={handleCreateNewRoom}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-orbitron rounded-2xl text-base tracking-wider shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Tv className="w-5 h-5 fill-slate-950" />
              <span>Criar Sala na Smart TV</span>
            </button>
          </div>

          {/* OPTION B: MOBILE CONTROLLER */}
          <div className="bg-slate-900/90 border-2 border-pink-500/40 hover:border-pink-400 rounded-3xl p-8 flex flex-col justify-between text-left shadow-2xl box-glow-pink transition-all hover:scale-[1.02]">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 mb-6">
                <Smartphone className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold font-orbitron text-white mb-2">
                Modo Celular (Fila)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Entre na sala de uma TV para pedir músicas, ver quem vai cantar e mandar reações em tempo real.
              </p>
            </div>

            <form onSubmit={handleJoinExistingRoom} className="space-y-3">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="DIGITE O PIN (EX: KARA-8821)"
                className="w-full bg-slate-950 border border-pink-500/40 rounded-xl px-4 py-3 text-center text-sm font-bold font-orbitron text-pink-300 placeholder-slate-600 focus:outline-none focus:border-pink-400 tracking-widest uppercase"
              />
              <button
                type="submit"
                disabled={!roomCodeInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-yellow-400 text-slate-950 font-black font-orbitron rounded-2xl text-base tracking-wider shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Smartphone className="w-5 h-5 fill-slate-950" />
                <span>Entrar na Fila pelo Celular</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <span>KARAOKEDU © {new Date().getFullYear()} — Karaokê Interativo Full Stack</span>
        <div className="flex items-center gap-4">
          <span>YouTube IFrame Player API</span>
          <span>·</span>
          <span>Sockets em Tempo Real</span>
          <span>·</span>
          <span>QR Code Sync</span>
        </div>
      </footer>
    </div>
  );
};
