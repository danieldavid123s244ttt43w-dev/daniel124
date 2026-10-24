import React, { useState } from 'react';
import {
  Heart,
  Utensils,
  Droplets,
  Radio,
  Flame,
  Zap,
  Map as MapIcon,
  Hammer,
  BookOpen,
  Volume2,
  VolumeX,
  Pause,
  MessageSquare,
  Users,
  Compass as CompassIcon,
} from 'lucide-react';
import { PlayerVitals, InventorySlot, ResourceType, EquipSlot } from '../game/types';
import { ITEM_REGISTRY } from '../game/items';
import { RemoteSurvivor, ChatEntry } from '../game/multiplayer';
import { WORLD_POIS } from '../game/worldGen';
import { distance } from '../game/rules';

interface GameHUDProps {
  vitals: PlayerVitals;
  inventory: InventorySlot[];
  equipped: Partial<Record<EquipSlot, ResourceType>>;
  selectedHotbarIdx: number;
  onSelectHotbar: (idx: number) => void;
  dayTime: { hour: number; minute: number; day: number; phase: string };
  playerX: number;
  playerY: number;
  playerAngle: number;
  nearPOI: string | null;
  remoteSurvivors: RemoteSurvivor[];
  customWaypoint: { x: number; y: number; label: string } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenMap: () => void;
  onOpenInventory: () => void;
  onOpenGuide: () => void;
  onPause: () => void;
  chatMessages: ChatEntry[];
  onSendChat: (text: string) => void;
  notification: string | null;
}

export function GameHUD({
  vitals,
  inventory,
  equipped,
  selectedHotbarIdx,
  onSelectHotbar,
  dayTime,
  playerX,
  playerY,
  playerAngle,
  nearPOI,
  remoteSurvivors,
  customWaypoint,
  isMuted,
  onToggleMute,
  onOpenMap,
  onOpenInventory,
  onOpenGuide,
  onPause,
  chatMessages,
  onSendChat,
  notification,
}: GameHUDProps) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendChat(chatInput.trim());
      setChatInput('');
      setIsChatOpen(false);
    }
  };

  // Convert playerAngle to compass degrees (0-360)
  const deg = Math.round(((playerAngle * 180) / Math.PI + 360) % 360);

  // Time format
  const hourStr = dayTime.hour.toString().padStart(2, '0');
  const minStr = dayTime.minute.toString().padStart(2, '0');

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none flex flex-col justify-between p-4 md:p-6">
      {/* TOP BAR: Compass, Sector Info, Top-Right Mini Radar & Utility Controls */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: Day & Weather & Vitals Telemetry */}
        <div className="flex flex-col gap-2 max-w-[55%] sm:max-w-none">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-950/85 border border-slate-800/90 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-mono text-slate-300 shadow-lg pointer-events-auto">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold whitespace-nowrap shrink-0">
              <span>DAY {dayTime.day}</span>
              <span>·</span>
              <span className="tabular-nums">{hourStr}:{minStr}</span>
            </div>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <div className="capitalize text-slate-400 text-[11px] sm:text-xs">{dayTime.phase}</div>
            {nearPOI && (
              <>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <span className="text-emerald-400 font-sans font-semibold truncate text-[11px] sm:text-xs">{nearPOI}</span>
              </>
            )}
          </div>

          {/* Allied Survivors nearby badge */}
          {remoteSurvivors.length > 0 && (
            <div className="flex flex-col gap-1 bg-slate-950/80 border border-slate-800/80 p-2 rounded-lg text-[11px] font-mono text-slate-300 max-w-xs pointer-events-auto">
              <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800/60">
                <span className="flex items-center gap-1 text-sky-400">
                  <Users className="w-3 h-3" />
                  <span>ALLIED SURVIVORS</span>
                </span>
                <span className="text-slate-500 tabular-nums">({remoteSurvivors.length})</span>
              </div>
              {remoteSurvivors.slice(0, 3).map((r) => {
                const dist = Math.round(distance(playerX, playerY, r.x, r.y));
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-200" style={{ color: r.color }}>
                      {r.name}
                    </span>
                    <span className="text-slate-400 tabular-nums shrink-0">{dist}m</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: Compass Heading Ribbon */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-800/90 px-4 py-1.5 rounded-xl text-xs font-mono text-slate-200 shadow-lg pointer-events-auto">
            <CompassIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-emerald-400 tabular-nums">{deg}°</span>
            <span className="text-slate-500">·</span>
            <span className="font-semibold text-slate-300">
              {deg >= 337 || deg < 23
                ? 'NORTH'
                : deg >= 23 && deg < 68
                ? 'NORTH-EAST'
                : deg >= 68 && deg < 113
                ? 'EAST'
                : deg >= 113 && deg < 158
                ? 'SOUTH-EAST'
                : deg >= 158 && deg < 203
                ? 'SOUTH'
                : deg >= 203 && deg < 248
                ? 'SOUTH-WEST'
                : deg >= 248 && deg < 293
                ? 'WEST'
                : 'NORTH-WEST'}
            </span>
            {customWaypoint && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-sky-400 font-bold">
                  BEACON {Math.round(distance(playerX, playerY, customWaypoint.x, customWaypoint.y))}m
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right: Mini-Radar & Top Utility Buttons */}
        <div className="flex items-start gap-3">
          {/* Circular Tactical Mini-Radar (clickable to open Real Map) */}
          <div
            onClick={onOpenMap}
            title="Click to open Tactical Real Map (M)"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-950/90 border border-slate-700/80 shadow-2xl relative overflow-hidden flex items-center justify-center cursor-pointer pointer-events-auto hover:border-emerald-500 transition-colors"
          >
            {/* Radar Sweep Ring */}
            <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
            <div className="absolute inset-4 rounded-full border border-emerald-500/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-[1px] bg-emerald-500/20" />
              <div className="h-full w-[1px] bg-emerald-500/20 absolute" />
            </div>

            {/* Radar player center */}
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 z-10 shadow" />

            {/* Waypoint on Radar */}
            {customWaypoint && (() => {
              const dx = customWaypoint.x - playerX;
              const dy = customWaypoint.y - playerY;
              const d = Math.hypot(dx, dy);
              const radarScale = 0.08;
              const clampedD = Math.min(d * radarScale, 46);
              const angle = Math.atan2(dy, dx);
              const rx = Math.cos(angle) * clampedD;
              const ry = Math.sin(angle) * clampedD;
              return (
                <div
                  style={{ transform: `translate(${rx}px, ${ry}px)` }}
                  className="absolute w-2 h-2 rounded-full bg-sky-300 ring-2 ring-sky-500 animate-ping"
                />
              );
            })()}

            {/* Allied Survivors on Radar */}
            {remoteSurvivors.map((rem) => {
              const dx = rem.x - playerX;
              const dy = rem.y - playerY;
              const d = Math.hypot(dx, dy);
              if (d > 500) return null;
              const rx = (dx / 500) * 44;
              const ry = (dy / 500) * 44;
              return (
                <div
                  key={rem.id}
                  style={{ transform: `translate(${rx}px, ${ry}px)`, backgroundColor: rem.color }}
                  className="absolute w-2 h-2 rounded-full ring-1 ring-white/50"
                  title={rem.name}
                />
              );
            })}

            <div className="absolute bottom-1 text-[9px] font-mono font-bold text-emerald-400/80 uppercase">
              RADAR [M]
            </div>
          </div>

          {/* Quick Utility Icon Buttons */}
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              onClick={onOpenMap}
              className="p-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 transition-colors"
              title="Open Real Map (M)"
              aria-label="Map"
            >
              <MapIcon className="w-4 h-4 text-emerald-400" />
            </button>
            <button
              onClick={onOpenInventory}
              className="p-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 transition-colors"
              title="Open Crafting & Inventory (C / Tab)"
              aria-label="Crafting"
            >
              <Hammer className="w-4 h-4 text-amber-400" />
            </button>
            <button
              onClick={onOpenGuide}
              className="p-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 transition-colors"
              title="Field Survival Guide (H)"
              aria-label="Guide"
            >
              <BookOpen className="w-4 h-4 text-sky-400" />
            </button>
            <button
              onClick={onToggleMute}
              className="p-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 transition-colors"
              title="Mute / Unmute (M)"
              aria-label="Audio"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={onPause}
              className="p-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 transition-colors"
              title="Pause Game (P / Esc)"
              aria-label="Pause"
            >
              <Pause className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* CENTER NOTIFICATION TOAST */}
      {notification && (
        <div className="mx-auto my-auto bg-slate-950/90 border border-emerald-500/40 px-5 py-2.5 rounded-xl text-xs font-mono text-emerald-300 shadow-2xl animate-fade-in pointer-events-auto">
          {notification}
        </div>
      )}

      {/* BOTTOM SECTION: Vitals Gauges, Equipment Hotbar, and Multiplayer Radio Chat */}
      <div className="flex flex-col gap-3">
        {/* Chat / Radio Drawer (Press Enter or click radio) */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1 pointer-events-auto max-w-md w-full">
            {/* Recent Radio Transmissions */}
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pointer-events-auto">
              {chatMessages.slice(-3).map((msg) => (
                <div
                  key={msg.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono ${
                    msg.isSystem
                      ? 'bg-emerald-950/70 border border-emerald-800/40 text-emerald-300'
                      : 'bg-slate-950/80 border border-slate-800/60 text-slate-200'
                  }`}
                >
                  <span className="font-bold text-slate-400 mr-2">{msg.sender}:</span>
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Quick Radio Input */}
            <form onSubmit={handleChatSubmit} className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Broadcast radio message to forest survivors... (Enter)"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-lg"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold font-mono rounded-lg transition-colors shrink-0 shadow-lg"
              >
                Send
              </button>
            </form>
          </div>

          {/* Action Hint Prompt */}
          <div className="hidden md:flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400">
            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">E</span>
            <span>Interact / Scavenge</span>
            <span className="text-slate-600">·</span>
            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">SPACE</span>
            <span>Dodge Roll</span>
          </div>
        </div>

        {/* Vitals HUD & Hotbar Container */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4 bg-slate-950/90 border border-slate-800/90 p-2.5 sm:p-3 rounded-2xl shadow-2xl pointer-events-auto">
          {/* Vitals Gauges */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-4 w-full lg:w-auto">
            {/* Health */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-rose-400">
                <span className="flex items-center gap-0.5 sm:gap-1 font-bold">
                  <Heart className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-rose-500 shrink-0" />
                  <span>HP</span>
                </span>
                <span className="tabular-nums font-bold">{Math.round(vitals.health)}</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.health))}%` }}
                />
              </div>
            </div>

            {/* Hunger */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-amber-400">
                <span className="flex items-center gap-0.5 sm:gap-1 font-bold">
                  <Utensils className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                  <span>HUN</span>
                </span>
                <span className="tabular-nums font-bold">{Math.round(vitals.hunger)}</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.hunger))}%` }}
                />
              </div>
            </div>

            {/* Thirst */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-sky-400">
                <span className="flex items-center gap-0.5 sm:gap-1 font-bold">
                  <Droplets className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-sky-400 shrink-0" />
                  <span>H2O</span>
                </span>
                <span className="tabular-nums font-bold">{Math.round(vitals.thirst)}</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.thirst))}%` }}
                />
              </div>
            </div>

            {/* Radiation */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-lime-400">
                <span className="flex items-center gap-0.5 sm:gap-1 font-bold">
                  <Radio className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${vitals.radiation > 50 ? 'animate-pulse text-lime-300' : ''}`} />
                  <span>RAD</span>
                </span>
                <span className="tabular-nums font-bold">{Math.round(vitals.radiation)}</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    vitals.radiation > 60 ? 'bg-lime-400' : 'bg-lime-600'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, vitals.radiation))}%` }}
                />
              </div>
            </div>

            {/* Stamina */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-emerald-400">
                <span className="flex items-center gap-0.5 sm:gap-1 font-bold">
                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-emerald-400 shrink-0" />
                  <span>STM</span>
                </span>
                <span className="tabular-nums font-bold">{Math.round(vitals.stamina)}</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-100"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.stamina))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Hotbar Slots (1 to 6) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full pb-0.5">
            {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
              const slot = inventory[slotIdx];
              const def = slot ? ITEM_REGISTRY[slot.item] : null;
              const isSelected = selectedHotbarIdx === slotIdx;

              return (
                <button
                  key={slotIdx}
                  onClick={() => onSelectHotbar(slotIdx)}
                  className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-500">
                    {slotIdx + 1}
                  </span>
                  {def ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-200 text-center px-1 truncate max-w-[44px]">
                        {def.name}
                      </span>
                      {slot.count > 1 && (
                        <span className="absolute bottom-1 right-1.5 text-[10px] font-mono font-bold text-emerald-400 tabular-nums">
                          {slot.count}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-800" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
