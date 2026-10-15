import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Music, Sparkles, Volume2, Mic2 } from 'lucide-react';

interface KaraokeLyricsPlayerProps {
  title: string;
  artist: string;
  keyAdjustment?: string;
  singerName?: string;
  singerAvatar?: string;
  onSongEnded: () => void;
  className?: string;
}

// Sample structured lyrics database for popular songs + dynamic fallback generator
const LYRICS_DATABASE: Record<string, string[]> = {
  "evidências": [
    "Quando eu digo que não quero mais você",
    "É porque eu te quero",
    "Eu tenho medo de te perder e aipor isso fingo",
    "E me afasto de você...",
    "Mas é mentira! Eu te amo!",
    "Chega de mentiras, de negar o meu desejo",
    "Eu te quero mais que tudo, eu preciso do seu beijo!",
    "Nessa loucura de dizer que não te quero",
    "Vou negando as evidências, fingindo que não posso mais te amar!",
    "Mas pra que viver fingindo, se eu não posso enganar meu coração?",
    "Eu sei que te amo! 🎤"
  ],
  "bohemian rhapsody": [
    "Is this the real life? Is this just fantasy?",
    "Caught in a landslide, no escape from reality...",
    "Open your eyes, look up to the skies and see!",
    "I'm just a poor boy, I need no sympathy",
    "Because I'm easy come, easy go, little high, little low",
    "Any way the wind blows doesn't really matter to me... to me!",
    "Mama, just killed a man...",
    "Put a gun against his head, pulled my trigger, now he's dead",
    "Mama, life had just begun...",
    "But now I've gone and thrown it all away!",
    "Galileo! Galileo! Figaró! Magnifico! 🎶"
  ],
  "cheia de manias": [
    "Cheia de manias, toda dengosa...",
    "Menina bonita, sabe que é charmosa!",
    "Com esse seu jeito de me provocar",
    "Vem me dando beijos, me fazendo amar!",
    "Então se apaga a luz, me leva pro seu quarto",
    "E no escurinho, me faz o seu escravo!",
    "Didididididi-ê, didididididi-ê!",
    "Didididididi-ê, não se afaste de mim! 🥁"
  ],
  "infiel": [
    "Isso não é erro, é traição...",
    "Você não tem respeito por mim!",
    "Iates e carros não compram coração",
    "E você fez comigo o que não se faz...",
    "Iates e festas não vão te salvar",
    "Infiel! Eu te peguei na mentira!",
    "Infiel! Agora vai chorar na minha porta! 💔"
  ],
  "i want it that way": [
    "You are my fire, the one desire",
    "Believe when I say: I want it that way!",
    "But we are two worlds apart, can't reach to your heart",
    "When you say that I want it that way...",
    "Tell me why? Ain't nothin' but a heartache!",
    "Tell me why? Ain't nothin' but a mistake!",
    "Tell me why? I never wanna hear you say:",
    "I want it that way! ✨"
  ]
};

export const KaraokeLyricsPlayer: React.FC<KaraokeLyricsPlayerProps> = ({
  title,
  artist,
  keyAdjustment = 'Tom Original',
  singerName = 'Convidado',
  singerAvatar = '🎤',
  onSongEnded,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Get or generate lyrics lines
  const cleanTitleKey = title.toLowerCase().trim();
  let lyricsLines = LYRICS_DATABASE[cleanTitleKey];

  if (!lyricsLines) {
    // Generate custom lyrics layout
    lyricsLines = [
      `🎵 Solta a voz! MÚSICA: ${title}`,
      `ARTISTA: ${artist}`,
      "Prepare-se... 3... 2... 1...",
      `É o show do(a) ${singerName}!`,
      "♪ ♫ ♩ ♬ ♪ ♫ ♩ ♬",
      `Cante no tom: ${keyAdjustment}`,
      `E o vento vai levando a nossa canção...`,
      `Sinta a batida, acompanhe a melodia!`,
      `Você está arrasando no karaokê! 🌟`,
      `A plateia foi ao delírio! 👏`,
      "♪ ♫ ♩ ♬ Finall! 🎉"
    ];
  }

  // Lyrics scrolling timer
  useEffect(() => {
    if (!isPlaying) return;

    const totalDurationMs = lyricsLines.length * 6000; // 6 sec per line
    const stepIntervalMs = 200;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (stepIntervalMs / totalDurationMs) * 100;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => onSongEnded(), 1000);
          return 100;
        }

        // Calculate active line index based on progress
        const calculatedIndex = Math.min(
          Math.floor((next / 100) * lyricsLines.length),
          lyricsLines.length - 1
        );
        setCurrentLineIndex(calculatedIndex);

        return next;
      });
    }, stepIntervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, lyricsLines, onSongEnded]);

  return (
    <div className={`relative w-full h-full bg-gradient-to-b from-[#0e1329] via-[#090d1f] to-[#04060f] rounded-3xl overflow-hidden border-2 border-cyan-500/40 p-8 flex flex-col justify-between shadow-2xl box-glow-cyan select-none ${className}`}>
      {/* Background Animated Equalizer & Lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-500 via-pink-500 to-yellow-400 rounded-full filter blur-[150px] animate-pulse-glow" />
      </div>

      {/* Top Song Info Bar */}
      <div className="relative z-10 flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="text-3xl p-2 bg-slate-800 rounded-xl border border-cyan-400/40">
            {singerAvatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black bg-pink-500/20 text-pink-300 border border-pink-500/40 rounded-full font-mono uppercase">
                KARAOKÊ HD WEB
              </span>
              <span className="text-xs text-cyan-300 font-semibold">
                Cantando: <strong className="text-white font-bold">{singerName}</strong>
              </span>
            </div>
            <h2 className="text-xl font-black text-white font-orbitron mt-0.5 truncate">{title}</h2>
            <p className="text-xs text-slate-400 truncate">{artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-800 text-yellow-300 px-3 py-1 rounded-xl border border-yellow-500/30 font-mono font-bold">
            {keyAdjustment}
          </span>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 bg-cyan-500 text-slate-950 font-bold rounded-xl hover:scale-105 transition-all shadow"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
          </button>
        </div>
      </div>

      {/* Synchronized Karaoke Lyrics Display Center */}
      <div className="relative z-10 my-auto py-8 text-center space-y-6 max-w-4xl mx-auto w-full">
        {lyricsLines.map((line, idx) => {
          const isCurrent = idx === currentLineIndex;
          const isPast = idx < currentLineIndex;
          const isFuture = idx > currentLineIndex;

          if (Math.abs(idx - currentLineIndex) > 2) return null; // Show only active range

          return (
            <div
              key={idx}
              className={`transition-all duration-500 font-orbitron ${
                isCurrent
                  ? 'text-3xl md:text-5xl font-black text-white text-glow-cyan scale-110 tracking-wide'
                  : isPast
                  ? 'text-lg md:text-xl text-slate-600 font-semibold blur-[0.5px]'
                  : 'text-lg md:text-xl text-cyan-400/60 font-semibold'
              }`}
            >
              {isCurrent && <span className="inline-block mr-3 animate-bounce">🎤</span>}
              <span>{line}</span>
              {isCurrent && <span className="inline-block ml-3 animate-bounce">✨</span>}
            </div>
          );
        })}
      </div>

      {/* Progress & Equalizer Footer */}
      <div className="relative z-10 space-y-3 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md">
        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-yellow-300 rounded-full transition-all duration-300 shadow-md shadow-cyan-500/50"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-mono font-bold">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="w-4 h-4 text-pink-400 animate-spin" />
            <span>0% RESTRIÇÃO - 100% LIBERADO PARA QUALQUER TELA</span>
          </div>

          <button
            onClick={onSongEnded}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-pink-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow hover:opacity-90 transition-all font-outfit"
          >
            <span>Próxima Música</span>
            <SkipForward className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
