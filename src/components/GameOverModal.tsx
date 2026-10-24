import { Skull, RotateCcw, Home, Award } from 'lucide-react';
import { GameStats } from '../game/types';

interface GameOverModalProps {
  isOpen: boolean;
  stats: GameStats;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function GameOverModal({ isOpen, stats, onRestart, onReturnTitle }: GameOverModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-none pointer-events-auto select-none">
      <div className="w-full max-w-lg bg-slate-950 border border-rose-900/60 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-center">
        {/* Skull Icon */}
        <div className="w-16 h-16 rounded-full bg-rose-950/80 border border-rose-700/60 flex items-center justify-center mx-auto text-rose-500 shadow-lg">
          <Skull className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-mono text-rose-400 uppercase tracking-widest font-bold">
            Expedition Terminated
          </span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">You Have Succumbed</h2>
          <p className="text-sm font-mono text-slate-400">
            {stats.causeOfDeath || 'Lost to the Ashwood Forest'}
          </p>
        </div>

        {/* End-of-Run Progress Metrics (Ultra-mode requirement: 3-4 tabular-nums tiles) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-left">
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Days Survived</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {stats.daysSurvived}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Mutants Slain</span>
            <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {stats.enemiesDefeated}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Scavenged</span>
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {stats.resourcesScavenged}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Built</span>
            <span className="text-2xl font-bold font-mono text-sky-400 tabular-nums">
              {stats.structuresBuilt}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            data-start="true"
            onClick={onRestart}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm uppercase rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again (Respawn in Clearing)</span>
          </button>

          <button
            onClick={onReturnTitle}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Return to Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
