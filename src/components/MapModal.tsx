import { useState, useRef, useEffect } from 'react';
import { X, Navigation, Radio, MapPin, ZoomIn, ZoomOut, Compass, ShieldAlert, Crosshair, Users } from 'lucide-react';
import { WORLD_POIS, WORLD_SIZE } from '../game/worldGen';
import { RemoteSurvivor } from '../game/multiplayer';
import { PlacedStructure } from '../game/types';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerX: number;
  playerY: number;
  playerAngle: number;
  remoteSurvivors: RemoteSurvivor[];
  structures: PlacedStructure[];
  customWaypoint: { x: number; y: number; label: string } | null;
  onSetWaypoint: (wp: { x: number; y: number; label: string } | null) => void;
}

export function MapModal({
  isOpen,
  onClose,
  playerX,
  playerY,
  playerAngle,
  remoteSurvivors,
  structures,
  customWaypoint,
  onSetWaypoint,
}: MapModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(0.18); // Map scale
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedPOI, setSelectedPOI] = useState<string | null>(null);

  // Center pan on player when opening
  useEffect(() => {
    if (isOpen) {
      setPanX(-playerX * zoom);
      setPanY(-playerY * zoom);
    }
  }, [isOpen, playerX, playerY, zoom]);

  // Render tactical topographic cartography
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2 + panX;
    const centerY = height / 2 + panY;

    // Helper: convert world (x, y) to map canvas (sx, sy)
    const toMapScreen = (wx: number, wy: number) => ({
      x: centerX + wx * zoom,
      y: centerY + wy * zoom,
    });

    // 1. Clear background
    ctx.fillStyle = '#0a0f0d';
    ctx.fillRect(0, 0, width, height);

    // 2. Map border bounds
    const halfWorld = WORLD_SIZE / 2;
    const topLeft = toMapScreen(-halfWorld, -halfWorld);
    const mapDim = WORLD_SIZE * zoom;

    // Forest territory base
    ctx.fillStyle = '#141e17';
    ctx.fillRect(topLeft.x, topLeft.y, mapDim, mapDim);

    // Tactical Sector Grids (A1 to F6)
    const gridSize = 600; // 6x6 sectors
    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
    const rows = ['1', '2', '3', '4', '5', '6'];

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.12)';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';

    for (let c = 0; c <= 6; c++) {
      const wx = -halfWorld + c * gridSize;
      const sPos = toMapScreen(wx, -halfWorld);
      ctx.beginPath();
      ctx.moveTo(sPos.x, topLeft.y);
      ctx.lineTo(sPos.x, topLeft.y + mapDim);
      ctx.stroke();

      if (c < 6) {
        ctx.fillText(cols[c], sPos.x + (gridSize * zoom) / 2 - 4, topLeft.y + 14);
      }
    }

    for (let r = 0; r <= 6; r++) {
      const wy = -halfWorld + r * gridSize;
      const sPos = toMapScreen(-halfWorld, wy);
      ctx.beginPath();
      ctx.moveTo(topLeft.x, sPos.y);
      ctx.lineTo(topLeft.x + mapDim, sPos.y);
      ctx.stroke();

      if (r < 6) {
        ctx.fillText(rows[r], topLeft.x + 8, sPos.y + (gridSize * zoom) / 2 + 4);
      }
    }

    // 3. Biome regions & topography
    // Swamp region
    const swampPos = toMapScreen(1050, 400);
    const swampGrad = ctx.createRadialGradient(swampPos.x, swampPos.y, 10, swampPos.x, swampPos.y, 350 * zoom);
    swampGrad.addColorStop(0, 'rgba(42, 53, 28, 0.7)');
    swampGrad.addColorStop(1, 'rgba(42, 53, 28, 0)');
    ctx.fillStyle = swampGrad;
    ctx.beginPath();
    ctx.arc(swampPos.x, swampPos.y, 350 * zoom, 0, Math.PI * 2);
    ctx.fill();

    // Highway 84 Asphalt Ribbon
    const hwyStart = toMapScreen(-halfWorld, 950);
    const hwyEnd = toMapScreen(halfWorld, 950);
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = Math.max(4, 24 * zoom);
    ctx.beginPath();
    ctx.moveTo(hwyStart.x, hwyStart.y);
    ctx.lineTo(hwyEnd.x, hwyEnd.y);
    ctx.stroke();
    // Yellow dashed lane divider
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(hwyStart.x, hwyStart.y);
    ctx.lineTo(hwyEnd.x, hwyEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radiation Crater Zone
    const craterPos = toMapScreen(-850, -750);
    const craterRad = 360 * zoom;
    const radGrad = ctx.createRadialGradient(craterPos.x, craterPos.y, 5, craterPos.x, craterPos.y, craterRad);
    radGrad.addColorStop(0, 'rgba(132, 204, 22, 0.65)');
    radGrad.addColorStop(0.5, 'rgba(101, 163, 13, 0.35)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(craterPos.x, craterPos.y, craterRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(craterPos.x, craterPos.y, craterRad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Placed structures (Campfires / Shelters)
    for (const st of structures) {
      const sPos = toMapScreen(st.x, st.y);
      if (st.type === 'campfire') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(sPos.x - 3, sPos.y - 3, 6, 6);
      }
    }

    // 5. Points of Interest (POIs)
    for (const poi of WORLD_POIS) {
      const sPos = toMapScreen(poi.x, poi.y);

      ctx.save();
      ctx.fillStyle = poi.type === 'crater' ? '#84cc16' : poi.type === 'bunker' ? '#38bdf8' : '#facc15';
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(poi.name, sPos.x, sPos.y - 10);
      ctx.restore();
    }

    // 6. Custom Waypoint Beacon
    if (customWaypoint) {
      const wpPos = toMapScreen(customWaypoint.x, customWaypoint.y);
      ctx.save();
      // Pulsating ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wpPos.x, wpPos.y, 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(wpPos.x, wpPos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`WAYPOINT: ${customWaypoint.label}`, wpPos.x, wpPos.y + 18);
      ctx.restore();
    }

    // 7. Multiplayer Remote Survivors
    for (const remote of remoteSurvivors) {
      const rPos = toMapScreen(remote.x, remote.y);
      ctx.save();
      ctx.fillStyle = remote.color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(rPos.x, rPos.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(remote.name, rPos.x, rPos.y - 8);
      ctx.restore();
    }

    // 8. Local Player GPS marker
    const pPos = toMapScreen(playerX, playerY);
    ctx.save();
    ctx.translate(pPos.x, pPos.y);

    // Direction cone
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 32, playerAngle - 0.45, playerAngle + 0.45);
    ctx.closePath();
    ctx.fill();

    // Player blip
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('YOU', 0, -12);
    ctx.restore();

    // Map outer border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, mapDim, mapDim);
  }, [isOpen, zoom, panX, panY, playerX, playerY, playerAngle, remoteSurvivors, structures, customWaypoint]);

  if (!isOpen) return null;

  // Handle map canvas click to drop custom waypoint
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2 + panX;
    const centerY = canvas.height / 2 + panY;

    const worldX = Math.round((clickX - centerX) / zoom);
    const worldY = Math.round((clickY - centerY) / zoom);

    // Check bounds
    const halfWorld = WORLD_SIZE / 2;
    if (Math.abs(worldX) <= halfWorld && Math.abs(worldY) <= halfWorld) {
      onSetWaypoint({
        x: worldX,
        y: worldY,
        label: `Sector [${worldX > 0 ? '+' : ''}${worldX}, ${worldY > 0 ? '+' : ''}${worldY}]`,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons === 1) {
      setIsDragging(true);
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.08, Math.min(0.65, prev * zoomFactor)));
  };

  const centerOnPlayer = () => {
    setPanX(-playerX * zoom);
    setPanY(-playerY * zoom);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-none pointer-events-auto">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100 tracking-wide">
                Tactical Sector Cartography
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>Ashwood Forest Wilderness</span>
                <span>·</span>
                <span>Sector Scale: 3600m²</span>
                <span>·</span>
                <span>GPS Grid: A1–F6</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-lg text-xs font-mono text-slate-300">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>{remoteSurvivors.length + 1} Survivors Tracked</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close Map"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Map Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden select-none">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            className="w-full h-full cursor-crosshair"
          />

          {/* Floating Map Controls */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="flex flex-col bg-slate-900/90 border border-slate-700 rounded-lg p-1 shadow-lg">
              <button
                onClick={() => setZoom((z) => Math.min(0.65, z * 1.25))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.08, z * 0.8))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={centerOnPlayer}
                className="p-2 text-sky-400 hover:text-sky-300 hover:bg-slate-800 rounded transition-colors"
                title="Center on Survivor"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>

            {customWaypoint && (
              <button
                onClick={() => onSetWaypoint(null)}
                className="px-3 py-1.5 bg-rose-950/80 border border-rose-700/60 text-rose-300 text-xs font-mono rounded-lg hover:bg-rose-900 transition-colors shadow-lg"
              >
                Clear Beacon
              </button>
            )}
          </div>

          {/* GPS Coordinates HUD Overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg px-4 py-2 text-xs font-mono text-slate-300 shadow-lg space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">SURVIVOR COORD:</span>
              <span className="text-emerald-400 font-bold tabular-nums">
                X: {playerX > 0 ? `+${Math.round(playerX)}` : Math.round(playerX)}m, Y:{' '}
                {playerY > 0 ? `+${Math.round(playerY)}` : Math.round(playerY)}m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">AZIMUTH:</span>
              <span className="text-sky-400 font-bold tabular-nums">
                {Math.round(((playerAngle * 180) / Math.PI + 360) % 360)}°
              </span>
              <span className="text-slate-500">· CLICK MAP TO DROP BEACON</span>
            </div>
          </div>

          {/* Map Legend */}
          <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 shadow-lg space-y-1.5">
            <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Cartography Key</div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>You (Survivor)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Allied Survivors</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Military POIs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400" />
              <span>Radiation Crater</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>Campfires / Shelter</span>
            </div>
          </div>
        </div>

        {/* POI Fast Travel / Sector Guide Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Click any map coordinate to deploy a localized navigation beacon.</span>
          <span className="text-slate-500">Press M to toggle map</span>
        </div>
      </div>
    </div>
  );
}
