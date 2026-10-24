export interface RemoteSurvivor {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  targetAngle: number;
  hp: number;
  maxHp: number;
  weapon?: string;
  isSprinting?: boolean;
  isSwinging?: boolean;
  color: string;
  lastUpdate: number;
}

export interface ChatEntry {
  id: string;
  sender: string;
  text: string;
  time: number;
  isSystem?: boolean;
}

export interface MultiplayerCallbacks {
  onStatusChange: (connected: boolean, playerCount: number) => void;
  onPlayersChange: (players: RemoteSurvivor[]) => void;
  onChatMessage: (msg: ChatEntry) => void;
  onRemoteAction?: (action: { id: string; action: string; x: number; y: number; angle: number }) => void;
  onRemoteStructure?: (structure: { id: string; type: string; x: number; y: number; hp: number; radius: number; isLit?: boolean; fuelLeft?: number }) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerCallbacks;
  public selfId: string | null = null;
  public playerName: string;
  public isConnected: boolean = false;
  public remotePlayers: Map<string, RemoteSurvivor> = new Map();
  public chatMessages: ChatEntry[] = [];
  private updateInterval: number | null = null;
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;

  constructor(callbacks: MultiplayerCallbacks, defaultName?: string) {
    this.callbacks = callbacks;
    this.playerName = defaultName || `Survivor-${Math.floor(Math.random() * 899 + 100)}`;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.callbacks.onStatusChange(true, this.remotePlayers.size + 1);

        // Send join packet
        this.send({
          type: 'join',
          name: this.playerName,
          x: 0,
          y: 0,
          angle: 0,
          hp: 100,
          maxHp: 100,
        });

        // Start ping heartbeat
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = window.setInterval(() => {
          this.send({ type: 'ping' });
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlePacket(data);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onStatusChange(false, 1);
        if (this.pingInterval) clearInterval(this.pingInterval);

        // Attempt reconnection after 3 seconds
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        // Will trigger onclose
      };
    } catch {
      // Offline fallback
    }
  }

  private handlePacket(data: { [key: string]: unknown }) {
    const type = data.type as string;

    switch (type) {
      case 'init': {
        this.selfId = data.selfId as string;
        const initialPlayers = (data.players as RemoteSurvivor[]) || [];
        this.remotePlayers.clear();
        for (const p of initialPlayers) {
          this.remotePlayers.set(p.id, {
            ...p,
            targetX: p.x,
            targetY: p.y,
            targetAngle: p.angle,
            lastUpdate: Date.now(),
          });
        }
        if (Array.isArray(data.chat)) {
          this.chatMessages = data.chat as ChatEntry[];
        }
        this.notifyPlayersChanged();
        break;
      }

      case 'player:joined': {
        const p = data.player as RemoteSurvivor;
        if (p.id !== this.selfId) {
          this.remotePlayers.set(p.id, {
            ...p,
            targetX: p.x,
            targetY: p.y,
            targetAngle: p.angle,
            lastUpdate: Date.now(),
          });
          this.notifyPlayersChanged();
        }
        break;
      }

      case 'player:moved': {
        const id = data.id as string;
        if (id && id !== this.selfId) {
          const existing = this.remotePlayers.get(id);
          if (existing) {
            existing.targetX = data.x as number;
            existing.targetY = data.y as number;
            existing.targetAngle = data.angle as number;
            existing.hp = data.hp as number;
            existing.weapon = data.weapon as string | undefined;
            existing.isSprinting = data.isSprinting as boolean | undefined;
            existing.isSwinging = data.isSwinging as boolean | undefined;
            existing.lastUpdate = Date.now();
          }
        }
        break;
      }

      case 'player:action': {
        if (this.callbacks.onRemoteAction) {
          this.callbacks.onRemoteAction(data as unknown as { id: string; action: string; x: number; y: number; angle: number });
        }
        break;
      }

      case 'player:left': {
        const id = data.id as string;
        if (id) {
          this.remotePlayers.delete(id);
          this.notifyPlayersChanged();
        }
        break;
      }

      case 'structure:created': {
        if (this.callbacks.onRemoteStructure && data.structure) {
          this.callbacks.onRemoteStructure(data.structure as unknown as { id: string; type: string; x: number; y: number; hp: number; radius: number; isLit?: boolean; fuelLeft?: number });
        }
        break;
      }

      case 'chat:message': {
        const msg = data.message as ChatEntry;
        if (msg) {
          this.chatMessages.push(msg);
          if (this.chatMessages.length > 50) this.chatMessages.shift();
          this.callbacks.onChatMessage(msg);
        }
        break;
      }
    }
  }

  private notifyPlayersChanged() {
    this.callbacks.onPlayersChange(Array.from(this.remotePlayers.values()));
    this.callbacks.onStatusChange(this.isConnected, this.remotePlayers.size + 1);
  }

  public sendPlayerUpdate(x: number, y: number, angle: number, hp: number, weapon?: string, isSprinting?: boolean, isSwinging?: boolean) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({
      type: 'player:update',
      x,
      y,
      angle,
      hp,
      weapon,
      isSprinting,
      isSwinging,
    });
  }

  public sendAction(action: string, x: number, y: number, angle: number) {
    if (!this.isConnected) return;
    this.send({
      type: 'player:action',
      action,
      x,
      y,
      angle,
    });
  }

  public sendStructureCreated(structure: { id: string; type: string; x: number; y: number; hp: number; radius: number; isLit?: boolean; fuelLeft?: number }) {
    if (!this.isConnected) return;
    this.send({
      type: 'structure:create',
      structure,
    });
  }

  public sendChat(text: string) {
    if (!this.isConnected || !text.trim()) return;
    this.send({
      type: 'chat:send',
      text: text.trim(),
    });
  }

  private send(data: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
