import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, SkipForward, Play, Pause, Youtube, RefreshCw, Volume2, VolumeX, Maximize2 } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  youtubeId: string;
  songTitle?: string;
  songArtist?: string;
  isPlaying?: boolean;
  onSongEnded: () => void;
  className?: string;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  youtubeId,
  songTitle = '',
  songArtist = '',
  isPlaying = true,
  onSongEnded,
  className = '',
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [useSearchEmbed, setUseSearchEmbed] = useState(false);
  const [isAutoRecovering, setIsAutoRecovering] = useState(false);

  const cleanTitle = songTitle.trim() || 'Karaokê';
  const cleanArtist = songArtist.trim();
  const searchQuery = `${cleanTitle} ${cleanArtist} karaoke`.trim();
  const directWatchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

  // Reset fallback state when youtubeId changes
  useEffect(() => {
    setHasError(false);
    setErrorCode(null);
    setUseSearchEmbed(false);
    setIsAutoRecovering(false);
  }, [youtubeId]);

  // 1. Load official YouTube IFrame API Script
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiLoaded(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsApiLoaded(true);
    };
  }, []);

  // 2. Auto-recovery when an embedding error occurs (150, 101, 2, 5)
  const triggerAutoUnblockRecovery = async () => {
    setIsAutoRecovering(true);
    console.log(`Auto-recovery triggered for restricted video ${youtubeId}. Query: ${searchQuery}`);

    // Try 1: YouTube Search Playlist API
    if (playerRef.current && typeof playerRef.current.loadPlaylist === 'function') {
      try {
        playerRef.current.loadPlaylist({
          listType: 'search',
          list: searchQuery,
        });
        setHasError(false);
        setIsAutoRecovering(false);
        return;
      } catch (err) {
        console.warn('loadPlaylist recovery failed:', err);
      }
    }

    // Try 2: Fetch alternative video ID from backend
    try {
      const res = await fetch('/api/search-karaoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const altVideo = data.results.find((r: any) => r.youtubeId && r.youtubeId !== youtubeId) || data.results[0];
        if (altVideo && altVideo.youtubeId && playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById({ videoId: altVideo.youtubeId });
          setHasError(false);
          setIsAutoRecovering(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend alternative fetch failed:', e);
    }

    // Try 3: Direct YouTube Search Playlist iFrame Embed
    setUseSearchEmbed(true);
    setHasError(false);
    setIsAutoRecovering(false);
  };

  // Initialize YT.Player
  useEffect(() => {
    if (!isApiLoaded || !youtubeId || useSearchEmbed) return;

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        playerRef.current.loadVideoById({
          videoId: youtubeId,
          startSeconds: 0,
        });
      } catch (err) {
        console.error('YouTube API loadVideoById error:', err);
      }
      return;
    }

    if (playerContainerRef.current) {
      try {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (isPlaying && event.target?.playVideo) {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 0) {
                onSongEnded();
              }
            },
            onError: (event: any) => {
              console.warn('YouTube IFrame Player Error Code:', event.data);
              setErrorCode(event.data);
              setHasError(true);

              // Automatically recover for embed-restricted videos (error 150, 101, 2)
              triggerAutoUnblockRecovery();
            },
          },
        });
      } catch (e) {
        console.error('Failed to construct YT.Player:', e);
        setUseSearchEmbed(true);
      }
    }
  }, [isApiLoaded, youtubeId, useSearchEmbed]);

  // Play / Pause sync
  useEffect(() => {
    if (!playerRef.current || useSearchEmbed) return;
    try {
      if (isPlaying && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      } else if (!isPlaying && typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      // ignore state sync
    }
  }, [isPlaying, useSearchEmbed]);

  const toggleMute = () => {
    if (!playerRef.current) return;
    try {
      if (playerRef.current.isMuted()) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (e) {
      console.error('Mute error:', e);
    }
  };

  const handleOpenPopupPlayer = () => {
    const popupUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
    window.open(popupUrl, 'YouTubeKaraokePopout', 'width=1024,height=600,menubar=no,toolbar=no');
  };

  return (
    <div className={`relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-cyan-500/30 flex flex-col items-center justify-center shadow-2xl ${className}`}>
      {/* Player Container */}
      <div className="w-full h-full aspect-video bg-black flex items-center justify-center relative">
        {useSearchEmbed ? (
          /* Search Playlist Embed Fallback (Bypasses individual video ID embed restrictions) */
          <iframe
            src={`https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(searchQuery)}&autoplay=1&controls=1&enablejsapi=1`}
            title={`${cleanTitle} - Karaokê Sem Bloqueio`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full aspect-video border-0 rounded-2xl z-10"
          />
        ) : (
          <div ref={playerContainerRef} className="w-full h-full aspect-video" />
        )}
      </div>

      {/* Persistent Controls Overlay Bar */}
      <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 border border-slate-800 p-2.5 rounded-2xl flex items-center justify-between gap-2 z-20 backdrop-blur-md shadow-2xl text-xs font-outfit">
        <div className="flex items-center gap-2 truncate min-w-0">
          <Youtube className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-slate-200 font-bold truncate">
            {cleanTitle} {cleanArtist && `— ${cleanArtist}`}
          </span>
        </div>

        {/* API Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {!useSearchEmbed && (
            <button
              onClick={toggleMute}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-all"
              title={isMuted ? 'Ativar som' : 'Mutar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
          )}

          <button
            onClick={onSongEnded}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-pink-500 text-slate-950 font-bold rounded-lg flex items-center gap-1 shadow transition-all text-[11px]"
          >
            <span>Pular</span>
            <SkipForward className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
