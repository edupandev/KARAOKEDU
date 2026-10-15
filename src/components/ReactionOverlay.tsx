import React from 'react';
import { Reaction } from '../types';

interface ReactionOverlayProps {
  reactions: Reaction[];
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({ reactions }) => {
  if (!reactions || reactions.length === 0) return null;

  const getEmojiForType = (type: string) => {
    switch (type) {
      case 'clap': return '👏';
      case 'fire': return '🔥';
      case 'sing': return '🎤';
      case 'love': return '💖';
      case 'cheers': return '🍺';
      case 'mic': return '🎙️';
      default: return '🎉';
    }
  };

  const getLabelForType = (type: string) => {
    switch (type) {
      case 'clap': return 'Mandou bem!';
      case 'fire': return 'Pegando fogo!';
      case 'sing': return 'Solta o som!';
      case 'love': return 'Que voz!';
      case 'cheers': return 'Saúde!';
      default: return 'Festa!';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {reactions.map((react) => (
        <div
          key={react.id}
          style={{ left: `${react.x}%` }}
          className="absolute bottom-10 animate-float-up flex flex-col items-center"
        >
          <div className="text-5xl filter drop-shadow-[0_0_15px_rgba(0,243,255,0.8)] scale-125">
            {getEmojiForType(react.type)}
          </div>
          <div className="mt-1 px-2.5 py-1 bg-slate-900/90 border border-cyan-400/50 rounded-full text-xs font-bold text-cyan-300 shadow-lg font-outfit whitespace-nowrap flex items-center gap-1">
            <span>{react.userAvatar}</span>
            <span className="font-semibold text-white">{react.userName}:</span>
            <span className="text-pink-400">{getLabelForType(react.type)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
