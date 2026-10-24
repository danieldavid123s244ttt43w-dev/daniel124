import { useEffect, useRef, useState, useCallback } from 'react';
import { SurvivalEngine } from './game/engine';
import { MultiplayerClient, RemoteSurvivor, ChatEntry } from './game/multiplayer';
import { PlayerVitals, InventorySlot, ResourceType, EquipSlot, GameStats, PlacedStructure } from './game/types';
import { sounds } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { MapModal } from './components/MapModal';
import { InventoryModal } from './components/InventoryModal';
import { SurvivalGuideModal } from './components/SurvivalGuideModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SurvivalEngine | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);

  // App & Game State Machine: 'title' | 'playing' | 'paused' | 'gameover'
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');

  // Modals
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Live HUD states (throttled from engine)
  const [vitals, setVitals] = useState<PlayerVitals>({
    health: 100,
    maxHealth: 100,
    hunger: 95,
    maxHunger: 100,
    thirst: 90,
    maxThirst: 100,
    radiation: 4,
    maxRadiation: 100,
    stamina: 100,
    maxStamina: 100,
    bodyTemp: 37,
    isSprinting: false,
    isBleeding: false,
    isRadPoisoned: false,
  });

  const [inventory, setInventory] = useState<InventorySlot[]>([]);
  const [equipped, setEquipped] = useState<Partial<Record<EquipSlot, ResourceType>>>({
    mainhand: 'makeshift_knife',
  });
  const [selectedHotbarIdx, setSelectedHotbarIdx] = useState(0);
  const [dayTime, setDayTime] = useState({ hour: 9, minute: 0, day: 1, phase: 'noon' });
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, angle: 0 });
  const [nearPOI, setNearPOI] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [gameOverStats, setGameOverStats] = useState<GameStats>({
    daysSurvived: 1,
    enemiesDefeated: 0,
    resourcesScavenged: 0,
    itemsCrafted: 0,
    structuresBuilt: 0,
    distanceTraveled: 0,
  });

  // Multiplayer states
  const [remoteSurvivors, setRemoteSurvivors] = useState<RemoteSurvivor[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [customWaypoint, setCustomWaypoint] = useState<{ x: number; y: number; label: string } | null>(null);

  // Notification helper
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  // Initialize Canvas Engine & Multiplayer Client
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // Canvas resize handling
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Initialize Multiplayer Client
    const mpClient = new MultiplayerClient({
      onStatusChange: (_connected, count) => {
        if (count > 1) {
          showNotification(`${count} survivors connected in the sector.`);
        }
      },
      onPlayersChange: (players) => {
        setRemoteSurvivors(players);
        if (engineRef.current) {
          engineRef.current.setRemoteSurvivors(players);
        }
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-30), msg]);
        if (!msg.isSystem) {
          showNotification(`[Radio] ${msg.sender}: ${msg.text}`);
        }
      },
      onRemoteAction: (act) => {
        if (engineRef.current) {
          engineRef.current.handleRemoteAction(act);
        }
      },
      onRemoteStructure: (st) => {
        if (engineRef.current) {
          engineRef.current.addRemoteStructure(st);
        }
      },
    });
    mpClientRef.current = mpClient;

    // Initialize Survival Engine
    const engine = new SurvivalEngine(canvas, {
      onVitalsChange: (v) => setVitals({ ...v }),
      onInventoryChange: (inv) => setInventory([...inv]),
      onEquipChange: (eq) => setEquipped({ ...eq }),
      onDayCycleChange: (h, m, d, phase) => setDayTime({ hour: h, minute: m, day: d, phase }),
      onPlayerPosChange: (x, y) => {
        setPlayerPos((prev) => ({ ...prev, x, y, angle: engine.playerAngle }));
      },
      onNearPOIChange: (poi) => setNearPOI(poi),
      onRadiationWarning: (_rad) => {},
      onGameOver: (stats) => {
        setGameOverStats(stats);
        setGameState('gameover');
      },
      onNotification: (msg) => showNotification(msg),
      onLocalPlayerUpdate: (x, y, angle, hp, weapon, isSprinting, isSwinging) => {
        mpClient.sendPlayerUpdate(x, y, angle, hp, weapon, isSprinting, isSwinging);
      },
      onLocalPlayerAction: (action, x, y, angle) => {
        mpClient.sendAction(action, x, y, angle);
      },
      onStructureBuilt: (st) => {
        mpClient.sendStructureCreated(st);
      },
    });

    engineRef.current = engine;
    setInventory(engine.inventory);
    setEquipped(engine.equipped);

    // Auto-start support (?autostart=1)
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.start();
      mpClient.connect();
      setGameState('playing');
    }

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      mpClient.disconnect();
    };
  }, [showNotification]);

  // Global key bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space or Enter on Title Screen starts game
      if (gameState === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        handleStartGame();
        return;
      }

      // Map toggle [M]
      if (e.code === 'KeyM') {
        if (gameState === 'playing' || gameState === 'paused') {
          setIsMapOpen((prev) => !prev);
          sounds.playSwing();
        }
      }

      // Inventory / Crafting toggle [KeyC or Tab]
      if (e.code === 'KeyC' || e.code === 'Tab') {
        e.preventDefault();
        if (gameState === 'playing' || gameState === 'paused') {
          setIsInventoryOpen((prev) => !prev);
          sounds.playSwing();
        }
      }

      // Field Guide toggle [KeyH]
      if (e.code === 'KeyH') {
        setIsGuideOpen((prev) => !prev);
      }

      // Pause toggle [KeyP or Escape]
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (isMapOpen) {
          setIsMapOpen(false);
          return;
        }
        if (isInventoryOpen) {
          setIsInventoryOpen(false);
          return;
        }
        if (isGuideOpen) {
          setIsGuideOpen(false);
          return;
        }

        if (gameState === 'playing') {
          engineRef.current?.pause();
          setGameState('paused');
        } else if (gameState === 'paused') {
          engineRef.current?.resume();
          setGameState('playing');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isMapOpen, isInventoryOpen, isGuideOpen]);

  // Handlers
  const handleStartGame = (chosenName?: string) => {
    if (chosenName && mpClientRef.current) {
      mpClientRef.current.playerName = chosenName;
    }
    mpClientRef.current?.connect();
    engineRef.current?.start();
    setGameState('playing');
  };

  const handleResume = () => {
    engineRef.current?.resume();
    setGameState('playing');
  };

  const handleRestart = () => {
    engineRef.current?.restart();
    setGameState('playing');
  };

  const handleReturnTitle = () => {
    engineRef.current?.pause();
    document.body.dataset.state = 'title';
    setGameState('title');
  };

  const handleToggleMute = () => {
    const nextMuted = sounds.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleSetCustomWaypoint = (wp: { x: number; y: number; label: string } | null) => {
    setCustomWaypoint(wp);
    if (engineRef.current) {
      engineRef.current.setCustomWaypoint(wp);
    }
    if (wp) {
      showNotification(`Navigation beacon deployed at [${wp.x}, ${wp.y}]`);
      sounds.playCraftSuccess();
    } else {
      showNotification('Navigation beacon cleared');
    }
  };

  const handleSelectHotbar = (idx: number) => {
    setSelectedHotbarIdx(idx);
    engineRef.current?.selectHotbarSlot(idx);
  };

  const handleEquipItem = (item: ResourceType) => {
    engineRef.current?.equipItem(item);
  };

  const handleUnequipItem = (slot: EquipSlot) => {
    engineRef.current?.unequipItem(slot);
  };

  const handleUseConsumable = (item: ResourceType) => {
    engineRef.current?.useConsumable(item);
  };

  const handleSelectStructureToPlace = (item: ResourceType) => {
    engineRef.current?.setStructureToPlace(item);
  };

  const handleSendChat = (text: string) => {
    mpClientRef.current?.sendChat(text);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-slate-100 font-sans">
      {/* 60 FPS Isolated Canvas Renderer */}
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
      />

      {/* Screen 1: Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenGuide={() => setIsGuideOpen(true)}
        />
      )}

      {/* Screen 2: Active Gameplay HUD */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <GameHUD
          vitals={vitals}
          inventory={inventory}
          equipped={equipped}
          selectedHotbarIdx={selectedHotbarIdx}
          onSelectHotbar={handleSelectHotbar}
          dayTime={dayTime}
          playerX={playerPos.x}
          playerY={playerPos.y}
          playerAngle={playerPos.angle}
          nearPOI={nearPOI}
          remoteSurvivors={remoteSurvivors}
          customWaypoint={customWaypoint}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenMap={() => setIsMapOpen(true)}
          onOpenInventory={() => setIsInventoryOpen(true)}
          onOpenGuide={() => setIsGuideOpen(true)}
          onPause={() => {
            engineRef.current?.pause();
            setGameState('paused');
          }}
          chatMessages={chatMessages}
          onSendChat={handleSendChat}
          notification={notification}
        />
      )}

      {/* Real Topographic Tactical Map Modal */}
      <MapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        playerX={playerPos.x}
        playerY={playerPos.y}
        playerAngle={playerPos.angle}
        remoteSurvivors={remoteSurvivors}
        structures={engineRef.current?.structures || []}
        customWaypoint={customWaypoint}
        onSetWaypoint={handleSetCustomWaypoint}
      />

      {/* Inventory & Workbench Crafting Modal */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        inventory={inventory}
        onUpdateInventory={(inv) => {
          setInventory(inv);
          if (engineRef.current) engineRef.current.inventory = inv;
        }}
        equipped={equipped}
        onEquipItem={handleEquipItem}
        onUnequipItem={handleUnequipItem}
        onUseConsumable={handleUseConsumable}
        onStructureSelected={handleSelectStructureToPlace}
      />

      {/* Field Survival Guide Modal */}
      <SurvivalGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Pause Modal */}
      <PauseModal
        isOpen={gameState === 'paused'}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
        onOpenMap={() => setIsMapOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameState === 'gameover'}
        stats={gameOverStats}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
      />
    </div>
  );
}
