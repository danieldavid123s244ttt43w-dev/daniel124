import { useState } from 'react';
import { Volume2, VolumeX, Users, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import titleBgImage from '../assets/images/title_bg_1792640213276.jpg';

interface TitleScreenProps {
  onStart: (playerName: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenGuide: () => void;
}

export function TitleScreen({ onStart, isMuted, onToggleMute, onOpenGuide }: TitleScreenProps) {
  const [playerName, setPlayerName] = useState<string>(() => {
    return `Stalker-${Math.floor(Math.random() * 899 + 100)}`;
  });
  const [difficulty, setDifficulty] = useState<'normal' | 'hardcore'>('normal');

  const handleStartGame = () => {
    onStart(playerName.trim() || 'Survivor');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between p-8 md:p-12 bg-black select-none overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(10, 15, 12, 0.94) 0%, rgba(10, 15, 12, 0.75) 45%, rgba(10, 15, 12, 0.4) 100%), url(${titleBgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Top Bar with world info and audio control */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3 text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SECTOR 04 CO-OP FREQUENCY ACTIVE</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">HOSTILE FALLOUT ZONE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Field Codex</span>
          </button>
          <button
            onClick={onToggleMute}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 transition-colors"
            aria-label="Toggle Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Center-Left Title Lockup */}
      <div className="max-w-xl my-auto z-10 space-y-6">
        {/* Custom SVG Title Lockup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-emerald-500 uppercase">
            <span>Post-Apocalyptic Open World Survival</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white uppercase font-sans">
            Verdant <span className="text-emerald-400">Ashes</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 font-normal leading-relaxed max-w-lg">
            An irradiated evergreen forest reclaimed by nature and mutated horrors. Scavenge derelict convoys, harvest timber, forge weapons, and survive the freezing nights alongside other survivors.
          </p>
        </div>

        {/* Multiplayer Callsign Input */}
        <div className="space-y-3 bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl max-w-md">
          <label htmlFor="callsign-input" className="block text-xs font-mono text-slate-400 uppercase tracking-wider">
            Survivor Callsign (Multiplayer Tag)
          </label>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              id="callsign-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={16}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              placeholder="Enter Callsign..."
            />
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
            <span className="text-slate-500">Survival Difficulty:</span>
            <button
              onClick={() => setDifficulty('normal')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                difficulty === 'normal'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scavenger
            </button>
            <button
              onClick={() => setDifficulty('hardcore')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                difficulty === 'hardcore'
                  ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hardcore
            </button>
          </div>
        </div>

        {/* Primary Start Button */}
        <div>
          <button
            data-start="true"
            onClick={handleStartGame}
            className="w-full max-w-md py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-base tracking-wide uppercase rounded-xl transition-all shadow-lg hover:shadow-emerald-600/30 flex items-center justify-center gap-3 cursor-pointer"
          >
            <span>Enter the Forest</span>
            <span className="text-xs px-2 py-0.5 bg-black/20 rounded font-mono">SPACE / ENTER</span>
          </button>
        </div>
      </div>

      {/* Bottom Clean Control Hints (Ultra-mode compliance: single flat line) */}
      <div className="z-10 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
        <span>WASD Move</span>
        <span>·</span>
        <span>Shift Sprint</span>
        <span>·</span>
        <span>Space Roll</span>
        <span>·</span>
        <span>Left-Click Attack/Harvest</span>
        <span>·</span>
        <span>E Scavenge</span>
        <span>·</span>
        <span>C Crafting</span>
        <span>·</span>
        <span>M Real Map</span>
        <span>·</span>
        <span>F Flashlight</span>
        <span>·</span>
        <span>1-6 Hotbar</span>
      </div>
    </div>
  );
}
