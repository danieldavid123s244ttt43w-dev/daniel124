import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Real-Time Multiplayer State
interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  weapon?: string;
  isSprinting?: boolean;
  isSwinging?: boolean;
  color: string;
  lastPing: number;
}

interface SharedStructure {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  isLit?: boolean;
  fuelLeft?: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: number;
  isSystem?: boolean;
}

const players = new Map<string, { ws: WebSocket; data: RemotePlayer }>();
const sharedStructures: SharedStructure[] = [
  {
    id: 'server_campfire_hub',
    type: 'campfire',
    x: 0,
    y: 0,
    hp: 200,
    maxHp: 200,
    radius: 28,
    isLit: true,
    fuelLeft: 9999,
  },
];
const chatHistory: ChatMessage[] = [
  {
    id: 'sys_init',
    sender: 'Emergency Radio',
    text: 'Broadcast frequency online. Co-op survivor tracking active across the forest sectors.',
    time: Date.now(),
    isSystem: true,
  },
];

const SURVIVOR_COLORS = ['#38bdf8', '#34d399', '#facc15', '#fb923c', '#c084fc', '#f43f5e'];

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg: object, excludeWs?: WebSocket) {
  const str = JSON.stringify(msg);
  for (const client of players.values()) {
    if (client.ws.readyState === WebSocket.OPEN && client.ws !== excludeWs) {
      client.ws.send(str);
    }
  }
}

wss.on('connection', (ws) => {
  let playerId: string | null = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const now = Date.now();

      switch (data.type) {
        case 'join': {
          playerId = data.id || `survivor_${Math.random().toString(36).substring(2, 8)}`;
          const color = SURVIVOR_COLORS[players.size % SURVIVOR_COLORS.length];
          const playerData: RemotePlayer = {
            id: playerId,
            name: data.name || `Survivor-${Math.floor(Math.random() * 900 + 100)}`,
            x: data.x || 0,
            y: data.y || 0,
            angle: data.angle || 0,
            hp: data.hp || 100,
            maxHp: data.maxHp || 100,
            weapon: data.weapon,
            color,
            lastPing: now,
          };

          players.set(playerId, { ws, data: playerData });

          // Send current state to newly joined player
          const currentRemotePlayers = Array.from(players.values())
            .filter((p) => p.data.id !== playerId)
            .map((p) => p.data);

          ws.send(
            JSON.stringify({
              type: 'init',
              selfId: playerId,
              color,
              players: currentRemotePlayers,
              structures: sharedStructures,
              chat: chatHistory.slice(-20),
            })
          );

          // Broadcast new player joined to all other clients
          broadcast(
            {
              type: 'player:joined',
              player: playerData,
            },
            ws
          );

          // System chat message
          const joinChatMsg: ChatMessage = {
            id: `chat_${now}_${Math.random()}`,
            sender: 'Radio Network',
            text: `${playerData.name} entered the Ashwood sector.`,
            time: now,
            isSystem: true,
          };
          chatHistory.push(joinChatMsg);
          broadcast({ type: 'chat:message', message: joinChatMsg });
          break;
        }

        case 'player:update': {
          if (!playerId || !players.has(playerId)) return;
          const entry = players.get(playerId)!;
          entry.data.x = data.x;
          entry.data.y = data.y;
          entry.data.angle = data.angle;
          entry.data.hp = data.hp;
          entry.data.weapon = data.weapon;
          entry.data.isSprinting = data.isSprinting;
          entry.data.isSwinging = data.isSwinging;
          entry.data.lastPing = now;

          // Broadcast delta to others
          broadcast(
            {
              type: 'player:moved',
              id: playerId,
              x: data.x,
              y: data.y,
              angle: data.angle,
              hp: data.hp,
              weapon: data.weapon,
              isSprinting: data.isSprinting,
              isSwinging: data.isSwinging,
            },
            ws
          );
          break;
        }

        case 'player:action': {
          if (!playerId) return;
          broadcast(
            {
              type: 'player:action',
              id: playerId,
              action: data.action, // 'swing' | 'arrow' | 'shotgun'
              x: data.x,
              y: data.y,
              angle: data.angle,
            },
            ws
          );
          break;
        }

        case 'structure:create': {
          const st: SharedStructure = {
            id: data.structure.id || `st_${Date.now()}`,
            type: data.structure.type,
            x: data.structure.x,
            y: data.structure.y,
            hp: data.structure.hp || 100,
            maxHp: data.structure.maxHp || 100,
            radius: data.structure.radius || 24,
            isLit: data.structure.isLit,
            fuelLeft: data.structure.fuelLeft,
          };
          // Avoid duplicate structures
          if (!sharedStructures.some((s) => s.id === st.id)) {
            sharedStructures.push(st);
            broadcast({ type: 'structure:created', structure: st });
          }
          break;
        }

        case 'chat:send': {
          if (!playerId || !players.has(playerId)) return;
          const sender = players.get(playerId)!.data.name;
          const msg: ChatMessage = {
            id: `chat_${now}_${Math.random()}`,
            sender,
            text: (data.text || '').substring(0, 140),
            time: now,
          };
          chatHistory.push(msg);
          if (chatHistory.length > 50) chatHistory.shift();

          const broadcastPayload = { type: 'chat:message', message: msg };
          ws.send(JSON.stringify(broadcastPayload));
          broadcast(broadcastPayload, ws);
          break;
        }

        case 'ping': {
          if (playerId && players.has(playerId)) {
            players.get(playerId)!.data.lastPing = now;
          }
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch {
      // Ignore malformed packets
    }
  });

  ws.on('close', () => {
    if (playerId && players.has(playerId)) {
      const p = players.get(playerId)!.data;
      players.delete(playerId);
      broadcast({ type: 'player:left', id: playerId });

      const leaveMsg: ChatMessage = {
        id: `leave_${Date.now()}`,
        sender: 'Radio Network',
        text: `${p.name} signal lost in the forest.`,
        time: Date.now(),
        isSystem: true,
      };
      chatHistory.push(leaveMsg);
      broadcast({ type: 'chat:message', message: leaveMsg });
    }
  });
});

// Periodic heartbeat sweep
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of players.entries()) {
    if (now - entry.data.lastPing > 30000) {
      entry.ws.terminate();
      players.delete(id);
      broadcast({ type: 'player:left', id });
    }
  }
}, 10000);

// API route for health check & server status
app.get('/api/status', (_req, res) => {
  res.json({
    onlineSurvivors: players.size,
    sharedStructures: sharedStructures.length,
    status: 'operational',
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
