import { Play, RotateCcw, Home, Volume2, VolumeX, BookOpen, Map } from 'lucide-react';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenMap: () => void;
  onOpenGuide: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function PauseModal({
  isOpen,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenMap,
  onOpenGuide,
  isMuted,
  onToggleMute,
}: PauseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-none pointer-events-auto select-none">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Simulation Frozen</span>
          <h2 className="text-2xl font-bold text-white tracking-tight">Game Paused</h2>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onResume}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm uppercase rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Survival</span>
          </button>

          <button
            onClick={onOpenMap}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Map className="w-4 h-4 text-emerald-400" />
            <span>Open Real Map (M)</span>
          </button>

          <button
            onClick={onOpenGuide}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Field Codex & Bestiary</span>
          </button>

          <button
            onClick={onToggleMute}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? 'Unmute Sound' : 'Mute Sound'}</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 font-bold text-xs uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Forest Expedition</span>
          </button>

          <button
            onClick={onReturnTitle}
            className="w-full py-2.5 bg-transparent hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-bold text-xs uppercase rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Return to Title Screen</span>
          </button>
        </div>

        <div className="text-center text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-900">
          Press P or ESC to toggle pause
        </div>
      </div>
    </div>
  );
}
