import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  url: string;
  size?: number;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ url, size = 200, className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!url) return;
    
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: {
        dark: '#00f3ff', // Cyan neon lines
        light: '#0f172a', // Dark background
      },
      errorCorrectionLevel: 'M',
    })
      .then((data) => setDataUrl(data))
      .catch((err) => console.error('QR Code generation error:', err));
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`flex items-center justify-center bg-slate-900 border border-cyan-500/30 rounded-xl ${className}`}
      >
        <span className="text-xs text-cyan-400 animate-pulse">Carregando QR...</span>
      </div>
    );
  }

  return (
    <div className={`p-2 bg-slate-950 border-2 border-cyan-500/50 rounded-2xl shadow-lg shadow-cyan-500/20 inline-block ${className}`}>
      <img 
        src={dataUrl} 
        alt="QR Code da Sala de Karaokê" 
        style={{ width: size, height: size }} 
        className="rounded-xl block" 
      />
    </div>
  );
};
