import React, { useEffect, useState } from 'react';
import { HomeLandingView } from './views/HomeLandingView';
import { TvHostView } from './views/TvHostView';
import { MobileControllerView } from './views/MobileControllerView';

export default function App() {
  const [viewMode, setViewMode] = useState<'home' | 'tv' | 'mobile'>('home');
  const [activeRoomCode, setActiveRoomCode] = useState<string>('KARA-8821');

  useEffect(() => {
    // Check URL query parameters for auto routing (e.g. from scanning QR Code)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const modeParam = urlParams.get('mode');
    const path = window.location.pathname;

    if (roomParam) {
      setActiveRoomCode(roomParam.toUpperCase());
      setViewMode('mobile');
    } else if (modeParam === 'tv' || path === '/tv' || path === '/host') {
      setViewMode('tv');
    }
  }, []);

  const handleSelectTvHost = (roomCode: string) => {
    setActiveRoomCode(roomCode);
    setViewMode('tv');
    // Update URL query string without reloading page
    const newUrl = `${window.location.pathname}?mode=tv&room=${roomCode}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleSelectMobileController = (roomCode: string) => {
    setActiveRoomCode(roomCode);
    setViewMode('mobile');
    const newUrl = `${window.location.pathname}?room=${roomCode}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleBackToHome = () => {
    setViewMode('home');
    window.history.pushState({ path: '/' }, '', '/');
  };

  return (
    <div className="w-full min-h-screen bg-[#0b0d19]">
      {viewMode === 'home' && (
        <HomeLandingView
          onSelectTvHost={handleSelectTvHost}
          onSelectMobileController={handleSelectMobileController}
        />
      )}

      {viewMode === 'tv' && (
        <TvHostView
          initialRoomCode={activeRoomCode}
          onBackToHome={handleBackToHome}
        />
      )}

      {viewMode === 'mobile' && (
        <MobileControllerView
          roomCodeFromUrl={activeRoomCode}
          onBackToHome={handleBackToHome}
        />
      )}
    </div>
  );
}
