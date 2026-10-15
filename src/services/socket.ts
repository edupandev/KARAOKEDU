import { io, Socket } from 'socket.io-client';

class HybridSocket {
  private ioSocket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private currentRoomId: string = 'KARA-8821';
  private pollingInterval: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isFallbackMode: boolean = false;
  private lastPollTimestamp: number = 0;

  constructor() {
    const customUrl = import.meta.env.VITE_SOCKET_URL;
    
    // Attempt standard Socket.IO connection
    this.ioSocket = io(customUrl || undefined, {
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      timeout: 3000,
    });

    // If native socket connects, use native WebSocket
    this.ioSocket.on('connect', () => {
      console.log('⚡ Socket.IO native connection established!');
      this.isFallbackMode = false;
      this.stopPolling();
    });

    // If native socket fails (e.g. Serverless Vercel deployment), activate HTTP + BroadcastChannel fallback
    this.ioSocket.on('connect_error', () => {
      if (!this.isFallbackMode) {
        console.warn('⚠️ Native Socket.IO unavailable. Switching to Vercel Serverless Sync mode.');
        this.enableFallbackMode();
      }
    });

    // Setup BroadcastChannel for 0ms same-device/browser sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('karaoke_sync_channel');
      this.broadcastChannel.onmessage = (event) => {
        const { eventName, data, roomId } = event.data || {};
        if (roomId === this.currentRoomId && eventName) {
          this.triggerListeners(eventName, data);
        }
      };
    }
  }

  private enableFallbackMode() {
    this.isFallbackMode = true;
    this.startPolling();
  }

  private startPolling() {
    if (this.pollingInterval) return;
    
    // Poll every 1.2s on Vercel for real-time room state sync
    this.pollingInterval = setInterval(async () => {
      if (!this.currentRoomId) return;
      try {
        const res = await fetch(`/api/room?roomId=${encodeURIComponent(this.currentRoomId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lastUpdated && data.lastUpdated > this.lastPollTimestamp) {
            this.lastPollTimestamp = data.lastUpdated;

            this.triggerListeners('room:state', {
              code: data.code,
              queue: data.queue || [],
              currentSong: data.currentSong || null,
              isPlaying: data.isPlaying,
              currentTime: data.currentTime || 0,
              users: data.users || [],
              hostConnected: true,
            });

            this.triggerListeners('room:updated', {
              queue: data.queue || [],
              currentSong: data.currentSong || null,
              users: data.users || [],
              isPlaying: data.isPlaying,
            });

            this.triggerListeners('queue:updated', {
              queue: data.queue || [],
              currentSong: data.currentSong || null,
            });

            this.triggerListeners('playback:change', {
              currentSong: data.currentSong || null,
              isPlaying: data.isPlaying,
            });

            if (data.reactions && data.reactions.length > 0) {
              const latest = data.reactions[data.reactions.length - 1];
              if (latest && latest.timestamp > Date.now() - 2500) {
                this.triggerListeners('reaction:received', latest);
              }
            }
          }
        }
      } catch (e) {
        // quiet fallback
      }
    }, 1200);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  public get id(): string {
    return this.ioSocket?.id || `client-${Math.random().toString(36).substring(2, 8)}`;
  }

  public emit(eventName: string, payload?: any): this {
    if (payload?.roomId) {
      this.currentRoomId = payload.roomId;
    }

    // Always attempt native socket emit
    if (this.ioSocket && this.ioSocket.connected) {
      this.ioSocket.emit(eventName, payload);
      return this;
    }

    // BroadcastChannel local zero-latency sync
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        eventName,
        data: payload,
        roomId: this.currentRoomId,
      });
    }

    // HTTP Serverless Fallback via /api/room
    fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: eventName, ...payload }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (eventName === 'queue:add') {
            this.triggerListeners('queue:updated', {
              queue: data.queue,
              currentSong: data.currentSong,
              addedSong: data.addedSong,
            });
            this.triggerListeners('playback:change', {
              currentSong: data.currentSong,
              isPlaying: true,
            });
          } else if (eventName === 'playback:next') {
            this.triggerListeners('queue:updated', {
              queue: data.queue,
              currentSong: data.currentSong,
            });
            this.triggerListeners('playback:change', {
              currentSong: data.currentSong,
              isPlaying: data.isPlaying,
            });
          } else if (eventName === 'reaction:send' && data.reaction) {
            this.triggerListeners('reaction:received', data.reaction);
          } else if (eventName === 'room:join' && data.roomState) {
            this.triggerListeners('room:state', data.roomState);
          }
        }
      })
      .catch((err) => {
        console.warn('HTTP fallback action error:', err);
      });

    return this;
  }

  public on(eventName: string, callback: Function): this {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);

    if (this.ioSocket) {
      this.ioSocket.on(eventName, (...args: any[]) => callback(...args));
    }
    return this;
  }

  public off(eventName: string, callback?: Function): this {
    if (callback && this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.delete(callback);
    } else {
      this.listeners.delete(eventName);
    }

    if (this.ioSocket) {
      this.ioSocket.off(eventName);
    }
    return this;
  }

  private triggerListeners(eventName: string, data: any) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in ${eventName} listener:`, e);
        }
      });
    }
  }

  public disconnect() {
    this.stopPolling();
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    if (this.ioSocket) {
      this.ioSocket.disconnect();
    }
  }
}

let socketInstance: any = null;

export function getSocket(): any {
  if (!socketInstance) {
    socketInstance = new HybridSocket();
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
