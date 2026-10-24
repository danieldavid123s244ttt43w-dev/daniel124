import { X, BookOpen, AlertTriangle, Shield, Flame, Crosshair } from 'lucide-react';
import guideBgImage from '../assets/images/survivor_guide_bg_1792640214725.jpg';

interface SurvivalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SurvivalGuideModal({ isOpen, onClose }: SurvivalGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-none pointer-events-auto select-none">
      <div
        className="relative w-full max-w-4xl h-[85vh] bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.90) 60%, rgba(15, 23, 42, 0.75) 100%), url(${guideBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
            <BookOpen className="w-5 h-5" />
            <span>Emergency Field Survival Manual (Declassified)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 text-sm text-slate-300 font-sans">
          {/* Section 1: Core Survival Rules */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase font-mono">
              <Flame className="w-4 h-4" />
              <span>Priority 1: Thermoregulation & Sustenance</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              When darkness falls over the Ashwood forest, ambient temperatures plummet below freezing. Hypothermia sets in rapidly unless you remain beside a lit Campfire or hold an ignited pitch torch. Craft a sleeping bag to sleep through hazardous nocturnal hours.
            </p>
          </div>

          {/* Section 2: Radiation & Dead Zones */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-lime-400 font-bold text-xs uppercase font-mono">
              <AlertTriangle className="w-4 h-4" />
              <span>Priority 2: Ionizing Fallout Management</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              Listen closely to your personal Geiger counter audio clicks. Rapid ticking indicates intense radiation spikes near craters and toxic swamp beds. Accumulating over 60 Roentgens induces lethal radiation poisoning. Craft a Lead-Lined Gasmask and Antirad Injectors to survive high-risk sectors.
            </p>
          </div>

          {/* Section 3: Hostile Mutated Fauna */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase font-mono">
              <Crosshair className="w-4 h-4" />
              <span>Priority 3: Threat Identification & Defense</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-1">
                <span className="font-bold text-slate-100 block">Ashwood Ghoul</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Fast, swarming carnivore. Emits an audible screech before lunging. Dodge roll with Space to evade its claw arc.
                </p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-1">
                <span className="font-bold text-slate-100 block">Toxic Spitter</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Ranged mutant lurking in swamps. Telegraphs bile attack with a red ground marker ring. Fires caustic radioactive slime.
                </p>
              </div>
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg space-y-1">
                <span className="font-bold text-slate-100 block">Armored Behemoth</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Massive brute roaming the ground zero crater. Telegraphs charge with a deep roar and dust cloud. Dodge sideways immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Real Map & Navigation */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase font-mono">
              <Shield className="w-4 h-4" />
              <span>Priority 4: Tactical Map & Waypoints</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              Press [M] at any time to open your topographic sector map. You can click anywhere on the cartographic grid to drop a high-altitude laser beacon that beams directly into the forest sky and locks onto your HUD compass.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Verdant Ashes Survival Protocols</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold uppercase transition-colors"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
