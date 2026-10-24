import {
  PlayerVitals,
  InventorySlot,
  ResourceType,
  EnemyEntity,
  WorldResourceNode,
  PlacedStructure,
  Projectile,
  Particle,
  FloatingText,
  GameStats,
  EquipSlot,
} from './types';
import { ITEM_REGISTRY } from './items';
import {
  distance,
  checkCircleCollision,
  addToInventory,
  removeFromInventory,
  updateVitals,
  calculateDayPhase,
  calculateWeaponDamage,
  EnvironmentConditions,
} from './rules';
import { generateWorldNodes, WORLD_POIS, WORLD_SIZE } from './worldGen';
import { sounds } from './audio';

export interface GameEngineCallbacks {
  onVitalsChange: (vitals: PlayerVitals) => void;
  onInventoryChange: (inventory: InventorySlot[]) => void;
  onEquipChange: (equipped: Partial<Record<EquipSlot, ResourceType>>) => void;
  onDayCycleChange: (hour: number, minute: number, day: number, phase: string) => void;
  onPlayerPosChange: (x: number, y: number) => void;
  onNearPOIChange: (poiName: string | null) => void;
  onRadiationWarning: (radLevel: number) => void;
  onGameOver: (stats: GameStats) => void;
  onNotification: (msg: string) => void;
  onStorageOpen?: (structure: PlacedStructure) => void;
  onLocalPlayerUpdate?: (x: number, y: number, angle: number, hp: number, weapon?: string, isSprinting?: boolean, isSwinging?: boolean) => void;
  onLocalPlayerAction?: (action: string, x: number, y: number, angle: number) => void;
  onStructureBuilt?: (structure: PlacedStructure) => void;
}

export interface RemotePlayerRender {
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
}

export class SurvivalEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameEngineCallbacks;

  // Running loop state
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private hitstopTimer: number = 0;
  private cameraShake: number = 0;

  // Viewport / Camera
  public cameraX: number = 0;
  public cameraY: number = 0;

  // Player state
  public playerX: number = 0;
  public playerY: number = 0;
  public playerVx: number = 0;
  public playerVy: number = 0;
  public playerAngle: number = 0;
  public playerRadius: number = 18;
  public playerRollTimer: number = 0;
  public playerRollMax: number = 0.28;
  public playerAttackCooldown: number = 0;
  public playerSwingAngle: number = 0;
  public isSwinging: boolean = false;
  public flashlightOn: boolean = true;

  // Stats & Vitals
  public vitals: PlayerVitals = {
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
  };

  // Inventory & Equipment
  public inventory: InventorySlot[] = [
    { item: 'makeshift_knife', count: 1 },
    { item: 'clean_water', count: 2 },
    { item: 'canned_food', count: 2 },
    { item: 'bandage', count: 2 },
    { item: 'wood', count: 10 },
    { item: 'torch', count: 1 },
  ];
  public equipped: Partial<Record<EquipSlot, ResourceType>> = {
    mainhand: 'makeshift_knife',
  };
  public selectedHotbarIdx: number = 0; // 0 to 5

  // World entities
  public nodes: WorldResourceNode[] = [];
  public enemies: EnemyEntity[] = [];
  public structures: PlacedStructure[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  // World Day/Night & Weather
  public dayTimeMinutes: number = 540; // Starts at 09:00 AM (bright morning)
  public dayCount: number = 1;
  public weather: 'clear' | 'fog' | 'acid_rain' = 'clear';

  // Game tracking
  public stats: GameStats = {
    daysSurvived: 1,
    enemiesDefeated: 0,
    resourcesScavenged: 0,
    itemsCrafted: 0,
    structuresBuilt: 0,
    distanceTraveled: 0,
  };

  // Input states
  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();
  private mouseScreenX: number = 0;
  private mouseScreenY: number = 0;
  private isMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;

  // Build placement mode
  public structureToPlace: ResourceType | null = null;

  // Multiplayer survivors & waypoints
  public remoteSurvivors: Map<string, RemotePlayerRender> = new Map();
  public customWaypoint: { x: number; y: number; label: string } | null = null;
  private networkBroadcastTimer: number = 0;

  // Geigertick throttle
  private geigerTimer: number = 0;
  private stepSoundTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    this.initWorld();
    this.setupListeners();
  }

  public setRemoteSurvivors(survivors: RemotePlayerRender[]) {
    const activeIds = new Set(survivors.map((s) => s.id));
    for (const id of this.remoteSurvivors.keys()) {
      if (!activeIds.has(id)) {
        this.remoteSurvivors.delete(id);
      }
    }
    for (const s of survivors) {
      const existing = this.remoteSurvivors.get(s.id);
      if (existing) {
        existing.targetX = s.targetX;
        existing.targetY = s.targetY;
        existing.targetAngle = s.targetAngle;
        existing.hp = s.hp;
        existing.weapon = s.weapon;
        existing.isSprinting = s.isSprinting;
        existing.isSwinging = s.isSwinging;
      } else {
        this.remoteSurvivors.set(s.id, { ...s });
      }
    }
  }

  public setCustomWaypoint(wp: { x: number; y: number; label: string } | null) {
    this.customWaypoint = wp;
  }

  public addRemoteStructure(st: { id: string; type: string; x: number; y: number; hp: number; radius: number; isLit?: boolean; fuelLeft?: number }) {
    if (!this.structures.some((s) => s.id === st.id)) {
      this.structures.push({
        id: st.id,
        type: st.type as PlacedStructure['type'],
        x: st.x,
        y: st.y,
        hp: st.hp,
        maxHp: st.hp,
        radius: st.radius,
        isLit: st.isLit,
        fuelLeft: st.fuelLeft,
      });
      sounds.playAxeChop();
      this.addFloatingText('Allied Structure Placed', st.x, st.y - 20, '#6ee7b7');
    }
  }

  public handleRemoteAction(data: { id: string; action: string; x: number; y: number; angle: number }) {
    if (data.action === 'swing') {
      sounds.playSwing();
      for (let i = 0; i < 4; i++) {
        this.spawnParticle(data.x, data.y, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, '#94a3b8', 0.2, 2);
      }
    } else if (data.action === 'arrow') {
      sounds.playArrowShoot();
      this.projectiles.push({
        id: `rem_arrow_${Date.now()}`,
        x: data.x,
        y: data.y,
        vx: Math.cos(data.angle) * 480,
        vy: Math.sin(data.angle) * 480,
        radius: 4,
        damage: 42,
        isPlayer: true,
        rangeLeft: 380,
        type: 'arrow',
      });
    } else if (data.action === 'shotgun') {
      sounds.playShotgun();
      for (let i = -2; i <= 2; i++) {
        const spread = data.angle + i * 0.08;
        this.projectiles.push({
          id: `rem_pellet_${Date.now()}_${i}`,
          x: data.x,
          y: data.y,
          vx: Math.cos(spread) * 550,
          vy: Math.sin(spread) * 550,
          radius: 3,
          damage: 18,
          isPlayer: true,
          rangeLeft: 220,
          type: 'pellet',
        });
      }
    }
  }

  private initWorld() {
    this.nodes = generateWorldNodes(7341);
    this.spawnInitialEnemies();

    // Starter campfire near player
    this.structures.push({
      id: 'starter_fire',
      type: 'campfire',
      x: 35,
      y: 20,
      hp: 100,
      maxHp: 100,
      radius: 24,
      isLit: true,
      fuelLeft: 300,
    });
  }

  private spawnInitialEnemies() {
    this.enemies = [];

    // Swarmers / Ghouls scattered in middle wilderness
    const ghoulPositions = [
      { x: 300, y: -200 },
      { x: -350, y: 250 },
      { x: 500, y: 400 },
      { x: -600, y: -300 },
      { x: 750, y: 700 },
    ];
    ghoulPositions.forEach((pos, i) => {
      this.enemies.push(this.createEnemy(`ghoul_${i}`, 'ghoul_stalker', pos.x, pos.y));
    });

    // Toxic Spitters near Swamps
    const spitterPositions = [
      { x: 900, y: 350 },
      { x: 1150, y: 550 },
      { x: 800, y: 500 },
    ];
    spitterPositions.forEach((pos, i) => {
      this.enemies.push(this.createEnemy(`spitter_${i}`, 'toxic_spitter', pos.x, pos.y));
    });

    // Armored Brute near Ground Zero Crater
    this.enemies.push(this.createEnemy('brute_alpha', 'mutant_brute', -800, -700));

    // Skittish game (Boars) for hunting food
    const boarPositions = [
      { x: -150, y: -250 },
      { x: 200, y: -350 },
      { x: -400, y: 150 },
    ];
    boarPositions.forEach((pos, i) => {
      this.enemies.push(this.createEnemy(`boar_${i}`, 'mutant_boar', pos.x, pos.y));
    });
  }

  private createEnemy(id: string, type: EnemyEntity['type'], x: number, y: number): EnemyEntity {
    switch (type) {
      case 'ghoul_stalker':
        return {
          id,
          type,
          x,
          y,
          radius: 17,
          hp: 45,
          maxHp: 45,
          speed: 120,
          angle: 0,
          state: 'idle',
          stateTimer: 2,
          telegraphTimer: 0,
          telegraphMax: 0.35,
          attackCooldown: 1.2,
          attackRange: 38,
          damage: 16,
          targetX: x,
          targetY: y,
          hitFlashTimer: 0,
          koTimer: 0,
          dropItems: [
            { item: 'cloth', count: 2, chance: 0.8 },
            { item: 'raw_meat', count: 1, chance: 0.5 },
          ],
        };
      case 'toxic_spitter':
        return {
          id,
          type,
          x,
          y,
          radius: 19,
          hp: 60,
          maxHp: 60,
          speed: 85,
          angle: 0,
          state: 'idle',
          stateTimer: 2,
          telegraphTimer: 0,
          telegraphMax: 0.65,
          attackCooldown: 2.2,
          attackRange: 260,
          damage: 22,
          targetX: x,
          targetY: y,
          hitFlashTimer: 0,
          koTimer: 0,
          dropItems: [
            { item: 'chemical_reagents', count: 2, chance: 0.9 },
            { item: 'irradiated_water', count: 1, chance: 0.6 },
          ],
        };
      case 'mutant_brute':
        return {
          id,
          type,
          x,
          y,
          radius: 32,
          hp: 220,
          maxHp: 220,
          speed: 70,
          angle: 0,
          state: 'idle',
          stateTimer: 3,
          telegraphTimer: 0,
          telegraphMax: 0.8,
          attackCooldown: 2.5,
          attackRange: 55,
          damage: 40,
          targetX: x,
          targetY: y,
          hitFlashTimer: 0,
          koTimer: 0,
          dropItems: [
            { item: 'scrap_metal', count: 6, chance: 1.0 },
            { item: 'raw_meat', count: 3, chance: 0.9 },
            { item: 'antirad_meds', count: 1, chance: 0.5 },
          ],
        };
      case 'mutant_boar':
        return {
          id,
          type,
          x,
          y,
          radius: 18,
          hp: 35,
          maxHp: 35,
          speed: 130,
          angle: 0,
          state: 'idle',
          stateTimer: 3,
          telegraphTimer: 0,
          telegraphMax: 0.2,
          attackCooldown: 1.5,
          attackRange: 25,
          damage: 8,
          targetX: x,
          targetY: y,
          hitFlashTimer: 0,
          koTimer: 0,
          dropItems: [
            { item: 'raw_meat', count: 2, chance: 1.0 },
            { item: 'cloth', count: 2, chance: 0.7 },
          ],
        };
      default:
        return {
          id,
          type: 'infected_wolf',
          x,
          y,
          radius: 16,
          hp: 40,
          maxHp: 40,
          speed: 135,
          angle: 0,
          state: 'idle',
          stateTimer: 2,
          telegraphTimer: 0,
          telegraphMax: 0.3,
          attackCooldown: 1.0,
          attackRange: 32,
          damage: 14,
          targetX: x,
          targetY: y,
          hitFlashTimer: 0,
          koTimer: 0,
          dropItems: [{ item: 'raw_meat', count: 1, chance: 0.8 }],
        };
    }
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keysHeld.has(code)) {
        this.keysJustPressed.add(code);
      }
      this.keysHeld.add(code);

      // Number keys 1-6 for hotbar
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(code)) {
        const slotIdx = parseInt(code.replace('Digit', '')) - 1;
        this.selectHotbarSlot(slotIdx);
      }

      // 'F' toggles flashlight
      if (code === 'KeyF') {
        this.flashlightOn = !this.flashlightOn;
        this.callbacks.onNotification(this.flashlightOn ? 'Flashlight On' : 'Flashlight Off');
      }

      // 'E' for interaction / harvesting
      if (code === 'KeyE') {
        this.interactNearest();
      }

      // Space for dodge roll
      if (code === 'Space') {
        this.performDodgeRoll();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      this.keysJustPressed.clear();
      this.isMouseDown = false;
      this.isRightMouseDown = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseScreenX = e.clientX - rect.left;
      this.mouseScreenY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      sounds.startAmbience();
      if (e.button === 0) {
        this.isMouseDown = true;
        this.handlePrimaryAction();
      } else if (e.button === 2) {
        e.preventDefault();
        this.isRightMouseDown = true;
        this.cancelBuildOrUseItem();
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    sounds.startAmbience();
    document.body.dataset.state = 'playing';
    requestAnimationFrame((t) => this.tick(t));
  }

  public pause() {
    this.isPaused = true;
    document.body.dataset.state = 'paused';
  }

  public resume() {
    this.isPaused = false;
    this.lastTime = performance.now();
    document.body.dataset.state = 'playing';
  }

  public restart() {
    this.vitals = {
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
    };
    this.playerX = 0;
    this.playerY = 0;
    this.playerVx = 0;
    this.playerVy = 0;
    this.cameraX = 0;
    this.cameraY = 0;
    this.dayTimeMinutes = 540;
    this.dayCount = 1;
    this.inventory = [
      { item: 'makeshift_knife', count: 1 },
      { item: 'clean_water', count: 2 },
      { item: 'canned_food', count: 2 },
      { item: 'bandage', count: 2 },
      { item: 'wood', count: 10 },
      { item: 'torch', count: 1 },
    ];
    this.equipped = { mainhand: 'makeshift_knife' };
    this.stats = {
      daysSurvived: 1,
      enemiesDefeated: 0,
      resourcesScavenged: 0,
      itemsCrafted: 0,
      structuresBuilt: 0,
      distanceTraveled: 0,
    };
    this.structures = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.initWorld();
    this.resume();
  }

  public selectHotbarSlot(idx: number) {
    if (idx >= 0 && idx < 6) {
      this.selectedHotbarIdx = idx;
      const slot = this.inventory[idx];
      if (slot) {
        const def = ITEM_REGISTRY[slot.item];
        if (def && (def.category === 'weapon' || def.category === 'tool')) {
          this.equipped.mainhand = slot.item;
          this.callbacks.onEquipChange(this.equipped);
          sounds.playSwing();
        } else if (def && def.isBuilding) {
          this.structureToPlace = slot.item;
          this.callbacks.onNotification(`Selected ${def.name} for placement. Left-click to place.`);
        }
      }
    }
  }

  public equipItem(item: ResourceType) {
    const def = ITEM_REGISTRY[item];
    if (!def || !def.equipSlot) return;

    this.equipped[def.equipSlot] = item;
    this.callbacks.onEquipChange(this.equipped);
    sounds.playSwing();
    this.callbacks.onNotification(`Equipped ${def.name}`);
  }

  public unequipItem(slot: EquipSlot) {
    delete this.equipped[slot];
    this.callbacks.onEquipChange(this.equipped);
  }

  public useConsumable(item: ResourceType) {
    const def = ITEM_REGISTRY[item];
    if (!def || def.category !== 'consumable') return;

    const removed = removeFromInventory(this.inventory, item, 1);
    if (!removed.success) return;

    this.inventory = removed.updatedInventory;
    this.callbacks.onInventoryChange(this.inventory);

    sounds.playEatOrDrink();

    if (def.healAmount) {
      this.vitals.health = Math.min(this.vitals.maxHealth, this.vitals.health + def.healAmount);
      this.addFloatingText(`+${def.healAmount} HP`, this.playerX, this.playerY - 25, '#4ade80');
    }
    if (def.hungerAmount) {
      this.vitals.hunger = Math.min(this.vitals.maxHunger, this.vitals.hunger + def.hungerAmount);
      this.addFloatingText(`+${def.hungerAmount} Food`, this.playerX, this.playerY - 40, '#facc15');
    }
    if (def.thirstAmount) {
      this.vitals.thirst = Math.min(this.vitals.maxThirst, this.vitals.thirst + def.thirstAmount);
      this.addFloatingText(`+${def.thirstAmount} Water`, this.playerX, this.playerY - 55, '#38bdf8');
    }
    if (def.radReduction) {
      this.vitals.radiation = Math.max(0, this.vitals.radiation - def.radReduction);
      if (def.radReduction > 0) {
        this.addFloatingText(`-${def.radReduction} Rads`, this.playerX, this.playerY - 25, '#a3e635');
      } else {
        this.addFloatingText(`+${Math.abs(def.radReduction)} Rads!`, this.playerX, this.playerY - 25, '#ef4444');
      }
    }
    this.callbacks.onVitalsChange(this.vitals);
  }

  public setStructureToPlace(item: ResourceType | null) {
    this.structureToPlace = item;
  }

  private cancelBuildOrUseItem() {
    if (this.structureToPlace) {
      this.structureToPlace = null;
      this.callbacks.onNotification('Placement cancelled');
    }
  }

  private performDodgeRoll() {
    if (this.playerRollTimer > 0 || this.vitals.stamina < 20) return;
    this.vitals.stamina -= 20;
    this.playerRollTimer = this.playerRollMax;
    sounds.playSwing();

    // Direction based on movement keys, or facing angle
    let dx = 0;
    let dy = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) dy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) dy += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) dx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) dx += 1;

    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.playerAngle);
      dy = Math.sin(this.playerAngle);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    this.playerVx = dx * 340;
    this.playerVy = dy * 340;

    // Roll particles
    for (let i = 0; i < 8; i++) {
      this.spawnParticle(this.playerX, this.playerY, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, '#94a3b8', 0.25, 3);
    }
  }

  private handlePrimaryAction() {
    const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);

    // 1. Placement of structure
    if (this.structureToPlace) {
      const dist = distance(this.playerX, this.playerY, worldMouse.x, worldMouse.y);
      if (dist > 140) {
        this.callbacks.onNotification('Too far to place structure!');
        return;
      }

      const def = ITEM_REGISTRY[this.structureToPlace];
      if (!def || !def.structureType) return;

      const rem = removeFromInventory(this.inventory, this.structureToPlace, 1);
      if (rem.success) {
        this.inventory = rem.updatedInventory;
        this.callbacks.onInventoryChange(this.inventory);

        const newStruct: PlacedStructure = {
          id: `struct_${Date.now()}`,
          type: def.structureType,
          x: worldMouse.x,
          y: worldMouse.y,
          hp: 120,
          maxHp: 120,
          radius: def.structureType === 'campfire' ? 24 : 28,
          isLit: true,
          fuelLeft: 360,
          storedItems: def.structureType === 'storage_crate' ? [] : undefined,
        };
        this.structures.push(newStruct);
        this.callbacks.onStructureBuilt?.(newStruct);

        this.stats.structuresBuilt++;
        sounds.playAxeChop();
        this.addFloatingText(`Built ${def.name}`, worldMouse.x, worldMouse.y - 20, '#6ee7b7');
        this.structureToPlace = null;
      }
      return;
    }

    // 2. Weapon / Tool Action
    if (this.playerAttackCooldown > 0) return;

    const mainhand = this.equipped.mainhand;
    const def = mainhand ? ITEM_REGISTRY[mainhand] : null;

    if (mainhand === 'hunting_bow') {
      // Check for arrows
      const removedArrow = removeFromInventory(this.inventory, 'arrow', 1);
      if (!removedArrow.success) {
        this.callbacks.onNotification('No arrows in inventory!');
        return;
      }
      this.inventory = removedArrow.updatedInventory;
      this.callbacks.onInventoryChange(this.inventory);

      sounds.playArrowShoot();
      this.playerAttackCooldown = 0.85;

      const angle = Math.atan2(worldMouse.y - this.playerY, worldMouse.x - this.playerX);
      this.projectiles.push({
        id: `arrow_${Date.now()}`,
        x: this.playerX + Math.cos(angle) * 20,
        y: this.playerY + Math.sin(angle) * 20,
        vx: Math.cos(angle) * 480,
        vy: Math.sin(angle) * 480,
        radius: 4,
        damage: 42,
        isPlayer: true,
        rangeLeft: 380,
        type: 'arrow',
      });
      this.callbacks.onLocalPlayerAction?.('arrow', this.playerX, this.playerY, angle);
      return;
    }

    if (mainhand === 'scrap_shotgun') {
      const removedShell = removeFromInventory(this.inventory, 'shotgun_shells', 1);
      if (!removedShell.success) {
        this.callbacks.onNotification('No shotgun shells!');
        return;
      }
      this.inventory = removedShell.updatedInventory;
      this.callbacks.onInventoryChange(this.inventory);

      sounds.playShotgun();
      this.playerAttackCooldown = 1.1;
      this.triggerCameraShake(8);

      const baseAngle = Math.atan2(worldMouse.y - this.playerY, worldMouse.x - this.playerX);
      // Fire 5 buckshot pellets
      for (let i = -2; i <= 2; i++) {
        const spread = baseAngle + i * 0.08 + (Math.random() - 0.5) * 0.04;
        this.projectiles.push({
          id: `pellet_${Date.now()}_${i}`,
          x: this.playerX + Math.cos(spread) * 24,
          y: this.playerY + Math.sin(spread) * 24,
          vx: Math.cos(spread) * 550,
          vy: Math.sin(spread) * 550,
          radius: 3,
          damage: 18,
          isPlayer: true,
          rangeLeft: 220,
          type: 'pellet',
        });
      }
      this.callbacks.onLocalPlayerAction?.('shotgun', this.playerX, this.playerY, baseAngle);
      return;
    }

    // Melee attack / harvesting swing
    this.isSwinging = true;
    this.playerSwingAngle = -0.8;
    this.playerAttackCooldown = def && def.attackSpeed ? 1 / def.attackSpeed : 0.55;
    sounds.playSwing();
    this.callbacks.onLocalPlayerAction?.('swing', this.playerX, this.playerY, this.playerAngle);

    // Check hit against nearby enemies
    const attackRange = def?.attackRange || 55;
    const playerAimAngle = Math.atan2(worldMouse.y - this.playerY, worldMouse.x - this.playerX);

    let hitSomething = false;

    // Check enemies first
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const d = distance(this.playerX, this.playerY, enemy.x, enemy.y);
      if (d <= attackRange + enemy.radius) {
        const angleToTarget = Math.atan2(enemy.y - this.playerY, enemy.x - this.playerX);
        let angleDiff = Math.abs(playerAimAngle - angleToTarget);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        if (angleDiff < 1.1) {
          hitSomething = true;
          const dmgCalc = calculateWeaponDamage(mainhand, 'mutant');
          this.applyDamageToEnemy(enemy, dmgCalc.damage, angleToTarget);
        }
      }
    }

    // Check harvestable nodes if no enemy hit
    if (!hitSomething) {
      for (const node of this.nodes) {
        if (node.depleted) continue;
        const d = distance(this.playerX, this.playerY, node.x, node.y);
        if (d <= attackRange + node.radius) {
          hitSomething = true;
          this.harvestNode(node, mainhand);
          break;
        }
      }
    }
  }

  private harvestNode(node: WorldResourceNode, toolId: ResourceType | undefined) {
    const isTree = node.type === 'pine_tree';
    const isRock = node.type === 'iron_boulder' || node.type === 'scrap_car';

    const dmgInfo = calculateWeaponDamage(toolId, isTree ? 'tree' : isRock ? 'rock' : 'mutant');
    const actualDamage = dmgInfo.damage;
    node.hp -= actualDamage;

    if (isTree) {
      sounds.playAxeChop();
      for (let i = 0; i < 6; i++) {
        this.spawnParticle(node.x, node.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, '#b45309', 0.4, 3);
      }
    } else {
      sounds.playPickaxeClink();
      for (let i = 0; i < 6; i++) {
        this.spawnParticle(node.x, node.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, '#94a3b8', 0.4, 3);
      }
    }

    if (node.hp <= 0) {
      node.depleted = true;
      let yieldAmount = node.yieldCount;
      if (dmgInfo.toolBonus) yieldAmount = Math.round(yieldAmount * 1.5);

      const addRes = addToInventory(this.inventory, node.yieldItem, yieldAmount);
      this.inventory = addRes.updatedInventory;
      this.callbacks.onInventoryChange(this.inventory);

      this.stats.resourcesScavenged += yieldAmount;
      const itemDef = ITEM_REGISTRY[node.yieldItem];
      this.addFloatingText(`+${yieldAmount} ${itemDef.name}`, node.x, node.y - 30, '#fef08a');

      // Secondary yield
      if (node.secondaryYield) {
        const secRes = addToInventory(this.inventory, node.secondaryYield.item, node.secondaryYield.count);
        this.inventory = secRes.updatedInventory;
        this.callbacks.onInventoryChange(this.inventory);
        const secDef = ITEM_REGISTRY[node.secondaryYield.item];
        this.addFloatingText(`+${node.secondaryYield.count} ${secDef.name}`, node.x, node.y - 45, '#e2e8f0');
      }

      sounds.playCraftSuccess();
    }
  }

  private interactNearest() {
    // Interacting with crates, berry bushes, campfires, or storage crates
    let nearestDist = 70;
    let targetNode: WorldResourceNode | null = null;

    for (const node of this.nodes) {
      if (node.depleted) continue;
      const d = distance(this.playerX, this.playerY, node.x, node.y);
      if (d < nearestDist && (node.type === 'military_crate' || node.type === 'berry_bush')) {
        nearestDist = d;
        targetNode = node;
      }
    }

    if (targetNode) {
      targetNode.depleted = true;
      const addRes = addToInventory(this.inventory, targetNode.yieldItem, targetNode.yieldCount);
      this.inventory = addRes.updatedInventory;
      this.callbacks.onInventoryChange(this.inventory);
      this.stats.resourcesScavenged += targetNode.yieldCount;
      const def = ITEM_REGISTRY[targetNode.yieldItem];
      this.addFloatingText(`Scavenged +${targetNode.yieldCount} ${def.name}`, targetNode.x, targetNode.y - 25, '#38bdf8');
      sounds.playCraftSuccess();
      return;
    }

    // Check campfire or storage crate
    for (const st of this.structures) {
      const d = distance(this.playerX, this.playerY, st.x, st.y);
      if (d < 65) {
        if (st.type === 'campfire') {
          // Add fuel
          const woodCount = removeFromInventory(this.inventory, 'wood', 2);
          if (woodCount.success) {
            this.inventory = woodCount.updatedInventory;
            this.callbacks.onInventoryChange(this.inventory);
            st.fuelLeft = (st.fuelLeft || 0) + 180;
            st.isLit = true;
            this.callbacks.onNotification('Added wood to campfire (+3 mins warmth)');
            sounds.playAxeChop();
          } else {
            this.callbacks.onNotification('Need 2 Wood to refuel campfire');
          }
          return;
        } else if (st.type === 'sleeping_bag') {
          // Sleep until dawn (06:00 = 360 min)
          if (calculateDayPhase(this.dayTimeMinutes).isNight) {
            this.dayTimeMinutes = 380;
            this.dayCount++;
            this.stats.daysSurvived = this.dayCount;
            this.vitals.stamina = this.vitals.maxStamina;
            this.callbacks.onNotification('Slept safely until sunrise. Morning has broken.');
            this.addFloatingText('Rested & Warmed', this.playerX, this.playerY - 30, '#fef08a');
          } else {
            this.callbacks.onNotification('Can only sleep when night falls.');
          }
          return;
        }
      }
    }
  }

  private applyDamageToEnemy(enemy: EnemyEntity, damage: number, knockbackAngle: number) {
    enemy.hp -= damage;
    enemy.hitFlashTimer = 0.08;
    this.hitstopTimer = 0.04;
    this.triggerCameraShake(damage > 30 ? 6 : 3);
    sounds.playHitFlesh();

    // Knockback
    enemy.x += Math.cos(knockbackAngle) * 16;
    enemy.y += Math.sin(knockbackAngle) * 16;

    this.addFloatingText(`-${damage}`, enemy.x, enemy.y - 20, '#ef4444');

    // Blood / mutation particles
    for (let i = 0; i < 10; i++) {
      this.spawnParticle(enemy.x, enemy.y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, '#dc2626', 0.4, 4);
    }

    if (enemy.hp <= 0 && enemy.state !== 'dead') {
      enemy.state = 'dead';
      enemy.koTimer = 0.5;
      this.stats.enemiesDefeated++;
      this.triggerCameraShake(8);

      // Drops
      for (const drop of enemy.dropItems) {
        if (Math.random() <= drop.chance) {
          const res = addToInventory(this.inventory, drop.item, drop.count);
          this.inventory = res.updatedInventory;
          this.callbacks.onInventoryChange(this.inventory);
          const dropDef = ITEM_REGISTRY[drop.item];
          this.addFloatingText(`Looted: +${drop.count} ${dropDef.name}`, enemy.x, enemy.y - 35, '#34d399');
        }
      }
    }
  }

  public applyDamageToPlayer(amount: number, cause: string) {
    if (this.playerRollTimer > 0) return; // Invulnerable during roll

    // Torso armor mitigation
    const torsoItem = this.equipped.torso ? ITEM_REGISTRY[this.equipped.torso] : null;
    const armor = torsoItem?.armor || 0;
    const actualDamage = Math.max(4, Math.round(amount * (1 - armor / 30)));

    this.vitals.health -= actualDamage;
    this.triggerCameraShake(10);
    this.hitstopTimer = 0.05;
    sounds.playPlayerHurt();

    this.addFloatingText(`-${actualDamage}`, this.playerX, this.playerY - 20, '#f87171');

    for (let i = 0; i < 8; i++) {
      this.spawnParticle(this.playerX, this.playerY, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, '#ef4444', 0.35, 3);
    }

    this.callbacks.onVitalsChange(this.vitals);

    if (this.vitals.health <= 0) {
      this.handlePlayerDeath(cause);
    }
  }

  private handlePlayerDeath(cause: string) {
    this.isPaused = true;
    sounds.playGameOver();
    document.body.dataset.state = 'gameover';
    this.stats.causeOfDeath = cause;
    this.callbacks.onGameOver(this.stats);
  }

  private triggerCameraShake(trauma: number) {
    this.cameraShake = Math.max(this.cameraShake, trauma);
  }

  public screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: sx + this.cameraX - this.canvas.width / 2,
      y: sy + this.cameraY - this.canvas.height / 2,
    };
  }

  public worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx - this.cameraX + this.canvas.width / 2,
      y: wy - this.cameraY + this.canvas.height / 2,
    };
  }

  private spawnParticle(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number) {
    this.particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
  }

  private addFloatingText(text: string, x: number, y: number, color: string) {
    this.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      life: 1.2,
      maxLife: 1.2,
      vy: -24,
    });
  }

  // Main 60fps Loop
  private tick(timestamp: number) {
    if (!this.isRunning) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.min(rawDt, 0.05);

    if (!this.isPaused) {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.updateSimulation(dt);
      }
    }

    this.render();
    this.keysJustPressed.clear();

    requestAnimationFrame((t) => this.tick(t));
  }

  private updateSimulation(dt: number) {
    // 1. Advance Day/Night time (1 real second = 1 game minute)
    this.dayTimeMinutes += dt * 1.5;
    if (this.dayTimeMinutes >= 1440) {
      this.dayTimeMinutes -= 1440;
      this.dayCount++;
      this.stats.daysSurvived = this.dayCount;
    }
    const dayPhase = calculateDayPhase(this.dayTimeMinutes);
    this.callbacks.onDayCycleChange(dayPhase.hour, dayPhase.minute, this.dayCount, dayPhase.phase);

    // 2. Player Input Movement
    let moveX = 0;
    let moveY = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveY -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveY += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) moveX -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) moveX += 1;

    const isMoving = moveX !== 0 || moveY !== 0;
    const isSprintKey = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    this.vitals.isSprinting = isMoving && isSprintKey && this.vitals.stamina > 5;

    let targetSpeed = 140;
    if (this.vitals.isSprinting) targetSpeed = 220;

    if (this.playerRollTimer > 0) {
      this.playerRollTimer -= dt;
    } else {
      if (isMoving) {
        const len = Math.hypot(moveX, moveY);
        const normX = moveX / len;
        const normY = moveY / len;
        this.playerVx = normX * targetSpeed;
        this.playerVy = normY * targetSpeed;

        this.stepSoundTimer += dt;
        if (this.stepSoundTimer > (this.vitals.isSprinting ? 0.28 : 0.42)) {
          sounds.playFootstep();
          this.stepSoundTimer = 0;
        }

        this.stats.distanceTraveled += targetSpeed * dt * 0.05;
      } else {
        this.playerVx *= 0.7;
        this.playerVy *= 0.7;
      }
    }

    // Apply movement
    this.playerX += this.playerVx * dt;
    this.playerY += this.playerVy * dt;

    // Bounds clamp
    const halfWorld = WORLD_SIZE / 2;
    this.playerX = Math.max(-halfWorld, Math.min(halfWorld, this.playerX));
    this.playerY = Math.max(-halfWorld, Math.min(halfWorld, this.playerY));

    // Player aim angle towards mouse
    const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
    this.playerAngle = Math.atan2(worldMouse.y - this.playerY, worldMouse.x - this.playerX);

    // Swing recovery
    if (this.playerAttackCooldown > 0) {
      this.playerAttackCooldown -= dt;
    }
    if (this.isSwinging) {
      this.playerSwingAngle += dt * 14;
      if (this.playerSwingAngle >= 0.8) {
        this.isSwinging = false;
        this.playerSwingAngle = 0;
      }
    }

    // 3. Environmental radiation & temperature check
    let currentAmbientRad = 0;
    for (const poi of WORLD_POIS) {
      if (poi.radZone) {
        const d = distance(this.playerX, this.playerY, poi.x, poi.y);
        if (d < poi.radZone.radius) {
          const falloff = 1 - d / poi.radZone.radius;
          currentAmbientRad = Math.max(currentAmbientRad, poi.radZone.intensity * falloff);
        }
      }
    }
    // Radiation craters
    for (const node of this.nodes) {
      if (node.radEmission && node.radEmission > 0) {
        const d = distance(this.playerX, this.playerY, node.x, node.y);
        if (d < 160) {
          const falloff = 1 - d / 160;
          currentAmbientRad = Math.max(currentAmbientRad, node.radEmission * falloff);
        }
      }
    }

    // Geiger counter clicks
    if (currentAmbientRad > 0.4) {
      this.geigerTimer += dt;
      const interval = Math.max(0.08, 0.6 / currentAmbientRad);
      if (this.geigerTimer >= interval) {
        sounds.playGeigerClick();
        this.geigerTimer = 0;
      }
      this.callbacks.onRadiationWarning(currentAmbientRad);
    }

    // Campfire warmth check
    let isNearCampfire = false;
    for (const st of this.structures) {
      if (st.type === 'campfire' && st.isLit) {
        const d = distance(this.playerX, this.playerY, st.x, st.y);
        if (d < 120) isNearCampfire = true;

        if (st.fuelLeft !== undefined) {
          st.fuelLeft -= dt;
          if (st.fuelLeft <= 0) st.isLit = false;
        }
      }
    }

    // Head/Torso protective gear
    const headDef = this.equipped.head ? ITEM_REGISTRY[this.equipped.head] : null;
    const torsoDef = this.equipped.torso ? ITEM_REGISTRY[this.equipped.torso] : null;
    const radResistance = headDef?.radResistance || 0;
    const armorWarmth = torsoDef?.warmth || 0;
    const hasTorch = this.equipped.offhand === 'torch';

    // Ambient temp: 18 during day, down to -4 during deep night
    const ambientTemp = dayPhase.isNight ? -4 : 18;

    const envConditions: EnvironmentConditions = {
      ambientRadiation: currentAmbientRad,
      ambientTemperature: ambientTemp,
      isNearCampfire,
      hasTorch,
      radResistance,
      armorWarmth,
    };

    // Update vitals
    this.vitals = updateVitals(this.vitals, dt, envConditions);
    this.callbacks.onVitalsChange(this.vitals);

    if (this.vitals.health <= 0) {
      const cause = this.vitals.radiation >= 80
        ? 'Lethal Radiation Sickness'
        : this.vitals.hunger <= 0
        ? 'Starvation in the Ashwood'
        : this.vitals.thirst <= 0
        ? 'Severe Dehydration'
        : 'Hypothermia / Freezing Winds';
      this.handlePlayerDeath(cause);
      return;
    }

    // 4. Update Enemies
    this.updateEnemies(dt);

    // 5. Update Projectiles
    this.updateProjectiles(dt);

    // 6. Update Particles & Text
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // 7. Camera Tracking with smooth damping
    const targetCamX = this.playerX;
    const targetCamY = this.playerY;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    this.cameraY += (targetCamY - this.cameraY) * 0.12;

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 20);
    }

    this.callbacks.onPlayerPosChange(this.playerX, this.playerY);

    // POI proximity check
    let nearestPOI: string | null = null;
    for (const poi of WORLD_POIS) {
      if (distance(this.playerX, this.playerY, poi.x, poi.y) < 180) {
        nearestPOI = poi.name;
        break;
      }
    }
    this.callbacks.onNearPOIChange(nearestPOI);

    // 8. Remote Survivors Smooth Interpolation
    for (const remote of this.remoteSurvivors.values()) {
      remote.x += (remote.targetX - remote.x) * 0.22;
      remote.y += (remote.targetY - remote.y) * 0.22;
      remote.angle += (remote.targetAngle - remote.angle) * 0.22;
    }

    // 9. Periodic Network Broadcast (every 50ms)
    this.networkBroadcastTimer += dt;
    if (this.networkBroadcastTimer >= 0.05) {
      this.networkBroadcastTimer = 0;
      this.callbacks.onLocalPlayerUpdate?.(
        this.playerX,
        this.playerY,
        this.playerAngle,
        this.vitals.health,
        this.equipped.mainhand,
        this.vitals.isSprinting,
        this.isSwinging
      );
    }
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.state === 'dead') {
        enemy.koTimer -= dt;
        if (enemy.koTimer <= 0) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= dt;
      if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

      const distToPlayer = distance(enemy.x, enemy.y, this.playerX, this.playerY);

      // AI Decision policies based on type
      if (enemy.type === 'mutant_boar') {
        // Skittish game: flees if player gets within 160
        if (distToPlayer < 160) {
          enemy.state = 'flee';
          const angleAway = Math.atan2(enemy.y - this.playerY, enemy.x - this.playerX);
          enemy.x += Math.cos(angleAway) * enemy.speed * dt;
          enemy.y += Math.sin(angleAway) * enemy.speed * dt;
          enemy.angle = angleAway;
        } else {
          // Wander idly
          enemy.stateTimer -= dt;
          if (enemy.stateTimer <= 0) {
            enemy.angle = Math.random() * Math.PI * 2;
            enemy.stateTimer = 2 + Math.random() * 3;
          }
          enemy.x += Math.cos(enemy.angle) * 20 * dt;
          enemy.y += Math.sin(enemy.angle) * 20 * dt;
        }
        continue;
      }

      if (enemy.type === 'toxic_spitter') {
        // Kiter: keeps distance around 180-240, fires acid projectiles with telegraph
        if (distToPlayer < 350) {
          enemy.angle = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x);

          if (enemy.telegraphTimer > 0) {
            enemy.telegraphTimer -= dt;
            if (enemy.telegraphTimer <= 0) {
              // Fire acid projectile
              this.projectiles.push({
                id: `spit_${Date.now()}`,
                x: enemy.x + Math.cos(enemy.angle) * 20,
                y: enemy.y + Math.sin(enemy.angle) * 20,
                vx: Math.cos(enemy.angle) * 240,
                vy: Math.sin(enemy.angle) * 240,
                radius: 7,
                damage: enemy.damage,
                isPlayer: false,
                rangeLeft: 300,
                type: 'acid_spit',
              });
              enemy.attackCooldown = 2.4;
            }
          } else if (distToPlayer < 140) {
            // Back up
            enemy.x -= Math.cos(enemy.angle) * enemy.speed * dt;
            enemy.y -= Math.sin(enemy.angle) * enemy.speed * dt;
          } else if (distToPlayer > 260) {
            // Advance
            enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
            enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
          } else if (enemy.attackCooldown <= 0) {
            // Start spit telegraph
            enemy.telegraphTimer = enemy.telegraphMax;
            sounds.playEnemyTelegraph('toxic_spitter');
          }
        }
        continue;
      }

      if (enemy.type === 'mutant_brute') {
        // Behemoth Brute: charges in a straight line after telegraph roar
        if (distToPlayer < 400) {
          enemy.angle = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x);

          if (enemy.state === 'attack_windup') {
            enemy.telegraphTimer -= dt;
            if (enemy.telegraphTimer <= 0) {
              enemy.state = 'charge';
              enemy.stateTimer = 1.2;
              enemy.targetX = this.playerX;
              enemy.targetY = this.playerY;
            }
          } else if (enemy.state === 'charge') {
            const chargeAngle = Math.atan2(enemy.targetY - enemy.y, enemy.targetX - enemy.x);
            enemy.x += Math.cos(chargeAngle) * (enemy.speed * 3.2) * dt;
            enemy.y += Math.sin(chargeAngle) * (enemy.speed * 3.2) * dt;

            // Dust particles
            this.spawnParticle(enemy.x, enemy.y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, '#78716c', 0.25, 5);

            if (distance(enemy.x, enemy.y, this.playerX, this.playerY) < enemy.radius + this.playerRadius) {
              this.applyDamageToPlayer(enemy.damage, 'Crushed by Mutant Behemoth Charge');
              enemy.state = 'idle';
              enemy.attackCooldown = 2.0;
            }

            enemy.stateTimer -= dt;
            if (enemy.stateTimer <= 0) {
              enemy.state = 'idle';
              enemy.attackCooldown = 2.2;
            }
          } else {
            // Approach player
            enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
            enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;

            if (distToPlayer < 180 && enemy.attackCooldown <= 0) {
              enemy.state = 'attack_windup';
              enemy.telegraphTimer = enemy.telegraphMax;
              sounds.playEnemyTelegraph('mutant_brute');
            }
          }
        }
        continue;
      }

      // Default Ghoul Stalker: Swarmer chaser
      if (distToPlayer < 360) {
        enemy.angle = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x);

        if (enemy.telegraphTimer > 0) {
          enemy.telegraphTimer -= dt;
          if (enemy.telegraphTimer <= 0) {
            // Strike
            if (distToPlayer <= enemy.attackRange + this.playerRadius) {
              this.applyDamageToPlayer(enemy.damage, 'Torn apart by Ashwood Ghoul');
            }
            enemy.attackCooldown = 1.3;
          }
        } else if (distToPlayer <= enemy.attackRange) {
          if (enemy.attackCooldown <= 0) {
            enemy.telegraphTimer = enemy.telegraphMax;
            sounds.playEnemyTelegraph('ghoul_stalker');
          }
        } else {
          // Pursue player
          enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
          enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
        }
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const stepDist = Math.hypot(p.vx * dt, p.vy * dt);
      p.rangeLeft -= stepDist;

      if (p.isPlayer) {
        // Check hits on enemies
        let hit = false;
        for (const enemy of this.enemies) {
          if (enemy.state === 'dead') continue;
          if (checkCircleCollision(p.x, p.y, p.radius, enemy.x, enemy.y, enemy.radius)) {
            const hitAngle = Math.atan2(p.vy, p.vx);
            this.applyDamageToEnemy(enemy, p.damage, hitAngle);
            hit = true;
            break;
          }
        }
        if (hit || p.rangeLeft <= 0) {
          this.projectiles.splice(i, 1);
        }
      } else {
        // Enemy projectile hitting player
        if (checkCircleCollision(p.x, p.y, p.radius, this.playerX, this.playerY, this.playerRadius)) {
          this.applyDamageToPlayer(p.damage, 'Acid-corroded by Toxic Spitter');
          this.vitals.radiation = Math.min(100, this.vitals.radiation + 12);
          this.addFloatingText('+12 Rads!', this.playerX, this.playerY - 40, '#bef264');
          this.projectiles.splice(i, 1);
        } else if (p.rangeLeft <= 0) {
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  // 2D Canvas World & Atmosphere Rendering
  private render() {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Apply camera shake
    ctx.save();
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShake > 0) {
      shakeX = (Math.random() - 0.5) * this.cameraShake * 1.5;
      shakeY = (Math.random() - 0.5) * this.cameraShake * 1.5;
    }
    ctx.translate(shakeX, shakeY);

    // 1. Draw Forest Terrain / Ground
    this.renderGround(ctx, width, height);

    // 2. Draw World Resource Nodes & Foliage
    this.renderNodes(ctx);

    // 3. Draw Placed Structures
    this.renderStructures(ctx);

    // 4. Draw Enemies
    this.renderEnemies(ctx);

    // 5. Draw Remote Survivors (Multiplayer)
    this.renderRemoteSurvivors(ctx);

    // 6. Draw Local Player
    this.renderPlayer(ctx);

    // 7. Draw Projectiles & Particles
    this.renderProjectilesAndParticles(ctx);

    // 8. Draw Custom Waypoint Beacon
    this.renderWaypointBeacon(ctx);

    // 9. Day / Night Atmosphere Lighting & Flashlight Cone (Lightmask)
    this.renderLightingAndAtmosphere(ctx, width, height);

    // 8. Draw In-world Floating Numbers & Interaction Prompts
    this.renderWorldUI(ctx);

    ctx.restore();
  }

  private renderGround(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Base forest dirt / pine needle floor
    ctx.fillStyle = '#1c2118';
    ctx.fillRect(0, 0, width, height);

    const startX = Math.floor((this.cameraX - width / 2) / 64) * 64;
    const endX = startX + width + 128;
    const startY = Math.floor((this.cameraY - height / 2) / 64) * 64;
    const endY = startY + height + 128;

    // Subtle grid texture of moss patches and dead leaf clutter
    for (let x = startX; x < endX; x += 64) {
      for (let y = startY; y < endY; y += 64) {
        const screen = this.worldToScreen(x, y);
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const rand = hash - Math.floor(hash);

        if (rand > 0.6) {
          ctx.fillStyle = '#262f22'; // Moss patch
          ctx.beginPath();
          ctx.arc(screen.x + 32, screen.y + 32, 14 + rand * 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (rand < 0.25) {
          ctx.fillStyle = '#151912'; // Mud puddle
          ctx.fillRect(screen.x + 8, screen.y + 8, 28, 20);
        }
      }
    }

    // Draw POI Ground Marks
    for (const poi of WORLD_POIS) {
      const scr = this.worldToScreen(poi.x, poi.y);
      if (poi.radZone) {
        // Glowing radioactive scorched crater ring
        const radScreenRadius = poi.radZone.radius;
        const grad = ctx.createRadialGradient(scr.x, scr.y, 10, scr.x, scr.y, radScreenRadius);
        grad.addColorStop(0, 'rgba(132, 204, 22, 0.45)');
        grad.addColorStop(0.6, 'rgba(74, 222, 128, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, radScreenRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderNodes(ctx: CanvasRenderingContext2D) {
    for (const node of this.nodes) {
      if (node.depleted) continue;
      const scr = this.worldToScreen(node.x, node.y);

      // Simple frustum culling
      if (scr.x < -80 || scr.x > this.canvas.width + 80 || scr.y < -80 || scr.y > this.canvas.height + 80) {
        continue;
      }

      if (node.type === 'pine_tree') {
        // Tree trunk shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(scr.x + 4, scr.y + 6, node.radius * 0.9, node.radius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Layered pine canopy (dark evergreen needles)
        ctx.fillStyle = '#163820';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y - 12, node.radius * 1.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1f4d2c';
        ctx.beginPath();
        ctx.arc(scr.x - 2, scr.y - 18, node.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#2c683b';
        ctx.beginPath();
        ctx.arc(scr.x - 4, scr.y - 24, node.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (node.type === 'iron_boulder') {
        // Rock boulder
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(scr.x + 2, scr.y + 4, node.radius, node.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        // Rusted iron veins
        ctx.fillStyle = '#b45309';
        ctx.fillRect(scr.x - 6, scr.y - 4, 12, 3);
      } else if (node.type === 'military_crate') {
        // Supply chest
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(scr.x - 14, scr.y - 6, 28, 20);

        ctx.fillStyle = '#3f4f38'; // Olive drab
        ctx.fillRect(scr.x - 12, scr.y - 10, 24, 18);
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(scr.x - 12, scr.y - 10, 24, 18);
      } else if (node.type === 'berry_bush') {
        // Shrub with red/purple berries
        ctx.fillStyle = '#1e3a1e';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, node.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(scr.x + i * 5, scr.y + (i % 2) * 5, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (node.type === 'scrap_car') {
        // Overturned rusted vehicle
        ctx.fillStyle = '#522b29';
        ctx.fillRect(scr.x - 24, scr.y - 14, 48, 28);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.strokeRect(scr.x - 24, scr.y - 14, 48, 28);
      }
    }
  }

  private renderStructures(ctx: CanvasRenderingContext2D) {
    for (const st of this.structures) {
      const scr = this.worldToScreen(st.x, st.y);
      if (st.type === 'campfire') {
        // Stone ring
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, st.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, st.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        if (st.isLit) {
          // Animated flickering fire core
          const flameSize = 10 + Math.sin(Date.now() * 0.015) * 4;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, flameSize, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(scr.x, scr.y, flameSize * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (st.type === 'wooden_barricade') {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(scr.x - 20, scr.y - 8, 40, 16);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.strokeRect(scr.x - 20, scr.y - 8, 40, 16);
      } else if (st.type === 'sleeping_bag') {
        ctx.fillStyle = '#065f46';
        ctx.fillRect(scr.x - 16, scr.y - 10, 32, 20);
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(scr.x - 14, scr.y - 8, 10, 16);
      }
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      const scr = this.worldToScreen(enemy.x, enemy.y);

      // Frustum culling
      if (scr.x < -60 || scr.x > this.canvas.width + 60 || scr.y < -60 || scr.y > this.canvas.height + 60) {
        continue;
      }

      ctx.save();
      ctx.translate(scr.x, scr.y);
      ctx.rotate(enemy.angle);

      // Hit flash
      const isFlashing = enemy.hitFlashTimer > 0;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.radius, enemy.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.type === 'ghoul_stalker') {
        ctx.fillStyle = isFlashing ? '#ffffff' : '#450a0a';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Claws
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(enemy.radius - 2, -6);
        ctx.lineTo(enemy.radius + 8, -8);
        ctx.moveTo(enemy.radius - 2, 6);
        ctx.lineTo(enemy.radius + 8, 8);
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#eab308';
        ctx.fillRect(enemy.radius * 0.4, -4, 3, 3);
        ctx.fillRect(enemy.radius * 0.4, 2, 3, 3);
      } else if (enemy.type === 'toxic_spitter') {
        ctx.fillStyle = isFlashing ? '#ffffff' : '#14532d';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Bioluminescent venom sacs
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(-4, -6, 5, 0, Math.PI * 2);
        ctx.arc(-4, 6, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'mutant_brute') {
        // Armored Behemoth
        ctx.fillStyle = isFlashing ? '#ffffff' : '#292524';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Chitin plates
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        // Mutant Boar
        ctx.fillStyle = isFlashing ? '#ffffff' : '#57534e';
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.radius, enemy.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Telegraph Ring / Sight Line
      if (enemy.telegraphTimer > 0) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, enemy.attackRange, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Health bar above enemy if damaged
      if (enemy.hp < enemy.maxHp && enemy.state !== 'dead') {
        const barW = 32;
        const barH = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(scr.x - barW / 2, scr.y - enemy.radius - 12, barW, barH);
        const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = hpPct > 0.4 ? '#ef4444' : '#b91c1c';
        ctx.fillRect(scr.x - barW / 2, scr.y - enemy.radius - 12, barW * hpPct, barH);
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const scr = this.worldToScreen(this.playerX, this.playerY);

    ctx.save();
    ctx.translate(scr.x, scr.y);
    ctx.rotate(this.playerAngle);

    // Roll squash-stretch
    if (this.playerRollTimer > 0) {
      ctx.scale(0.85, 1.2);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 0, this.playerRadius, this.playerRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Survivor Trenchcoat / Combat Fatigues)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, this.playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Head / Gasmask
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(this.playerRadius * 0.4, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Gasmask respirator visor
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(this.playerRadius * 0.6, -3, 3, 6);

    // Weapon held in hand
    const mainhand = this.equipped.mainhand;
    if (mainhand) {
      ctx.save();
      ctx.translate(this.playerRadius * 0.6, 8);
      ctx.rotate(this.playerSwingAngle);

      if (mainhand === 'stone_hatchet' || mainhand === 'scrap_pickaxe') {
        ctx.fillStyle = '#78350f'; // Handle
        ctx.fillRect(0, -2, 18, 4);
        ctx.fillStyle = '#94a3b8'; // Head
        ctx.fillRect(14, -6, 6, 12);
      } else if (mainhand === 'hunting_bow') {
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(10, 0, 14, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      } else if (mainhand === 'scrap_shotgun') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, -3, 24, 6);
      } else {
        // Knife
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, -2, 12, 4);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private renderProjectilesAndParticles(ctx: CanvasRenderingContext2D) {
    // Projectiles
    for (const p of this.projectiles) {
      const scr = this.worldToScreen(p.x, p.y);
      if (p.type === 'arrow') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        const angle = Math.atan2(p.vy, p.vx);
        ctx.beginPath();
        ctx.moveTo(scr.x, scr.y);
        ctx.lineTo(scr.x - Math.cos(angle) * 12, scr.y - Math.sin(angle) * 12);
        ctx.stroke();
      } else if (p.type === 'pellet') {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'acid_spit') {
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Particles
    for (const pt of this.particles) {
      const scr = this.worldToScreen(pt.x, pt.y);
      const alpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  private renderLightingAndAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const dayPhase = calculateDayPhase(this.dayTimeMinutes);
    const darknessAlpha = 1.0 - dayPhase.lightIntensity;

    if (darknessAlpha <= 0.05) return; // Full daylight

    // Create a dark overlay that hides unlit areas
    const playerScr = this.worldToScreen(this.playerX, this.playerY);

    ctx.save();
    // Destination-out lighting mask
    // We render a canvas overlay
    const lightCanvas = document.createElement('canvas');
    lightCanvas.width = width;
    lightCanvas.height = height;
    const lCtx = lightCanvas.getContext('2d')!;

    // Fill with night darkness
    lCtx.fillStyle = `rgba(5, 8, 15, ${darknessAlpha.toFixed(2)})`;
    lCtx.fillRect(0, 0, width, height);

    lCtx.globalCompositeOperation = 'destination-out';

    // 1. Ambient circle around player
    const ambientGrad = lCtx.createRadialGradient(playerScr.x, playerScr.y, 10, playerScr.x, playerScr.y, 65);
    ambientGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lCtx.fillStyle = ambientGrad;
    lCtx.beginPath();
    lCtx.arc(playerScr.x, playerScr.y, 65, 0, Math.PI * 2);
    lCtx.fill();

    // 2. Flashlight beam
    if (this.flashlightOn) {
      lCtx.save();
      lCtx.translate(playerScr.x, playerScr.y);
      lCtx.rotate(this.playerAngle);

      const beamLength = 260;
      const beamAngle = 0.55; // 30 degrees cone
      const beamGrad = lCtx.createRadialGradient(0, 0, 10, 0, 0, beamLength);
      beamGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      beamGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.85)');
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lCtx.fillStyle = beamGrad;
      lCtx.beginPath();
      lCtx.moveTo(0, 0);
      lCtx.arc(0, 0, beamLength, -beamAngle, beamAngle);
      lCtx.closePath();
      lCtx.fill();
      lCtx.restore();
    }

    // 3. Campfires light up their perimeter
    for (const st of this.structures) {
      if (st.type === 'campfire' && st.isLit) {
        const fireScr = this.worldToScreen(st.x, st.y);
        const fireGrad = lCtx.createRadialGradient(fireScr.x, fireScr.y, 15, fireScr.x, fireScr.y, 180);
        fireGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        fireGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.7)');
        fireGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lCtx.fillStyle = fireGrad;
        lCtx.beginPath();
        lCtx.arc(fireScr.x, fireScr.y, 180, 0, Math.PI * 2);
        lCtx.fill();
      }
    }

    ctx.drawImage(lightCanvas, 0, 0);
    ctx.restore();
  }

  private renderWorldUI(ctx: CanvasRenderingContext2D) {
    // Floating damage & loot texts
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (const ft of this.floatingTexts) {
      const scr = this.worldToScreen(ft.x, ft.y);
      const alpha = ft.life / ft.maxLife;
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillText(ft.text, scr.x, scr.y);
      ctx.globalAlpha = 1.0;
    }

    // Build placement ghost preview
    if (this.structureToPlace) {
      const worldMouse = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
      const scr = this.worldToScreen(worldMouse.x, worldMouse.y);
      const dist = distance(this.playerX, this.playerY, worldMouse.x, worldMouse.y);
      const inRange = dist <= 140;

      ctx.save();
      ctx.strokeStyle = inRange ? '#34d399' : '#ef4444';
      ctx.fillStyle = inRange ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(inRange ? 'Left-Click to Build' : 'Too Far', scr.x, scr.y + 36);
      ctx.restore();
    }
  }

  private renderRemoteSurvivors(ctx: CanvasRenderingContext2D) {
    for (const remote of this.remoteSurvivors.values()) {
      const scr = this.worldToScreen(remote.x, remote.y);

      // Frustum culling
      if (scr.x < -80 || scr.x > this.canvas.width + 80 || scr.y < -80 || scr.y > this.canvas.height + 80) {
        continue;
      }

      ctx.save();
      ctx.translate(scr.x, scr.y);
      ctx.rotate(remote.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.playerRadius, this.playerRadius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = remote.color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, this.playerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Tactical vest
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, this.playerRadius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(this.playerRadius * 0.4, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Visor
      ctx.fillStyle = remote.color || '#38bdf8';
      ctx.fillRect(this.playerRadius * 0.6, -3, 3, 6);

      // Weapon
      if (remote.weapon) {
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(this.playerRadius * 0.6, 6, 14, 4);
      }

      ctx.restore();

      // Nameplate & Mini Health Bar above remote player
      ctx.save();
      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      const textW = ctx.measureText(remote.name).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(scr.x - textW / 2 - 4, scr.y - this.playerRadius - 26, textW + 8, 16);
      ctx.strokeStyle = remote.color || '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(scr.x - textW / 2 - 4, scr.y - this.playerRadius - 26, textW + 8, 16);

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(remote.name, scr.x, scr.y - this.playerRadius - 14);

      // Mini Health Bar
      const barW = 34;
      const barH = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(scr.x - barW / 2, scr.y - this.playerRadius - 8, barW, barH);
      const hpPct = Math.max(0, Math.min(1, remote.hp / remote.maxHp));
      ctx.fillStyle = remote.color || '#38bdf8';
      ctx.fillRect(scr.x - barW / 2, scr.y - this.playerRadius - 8, barW * hpPct, barH);
      ctx.restore();
    }
  }

  private renderWaypointBeacon(ctx: CanvasRenderingContext2D) {
    if (!this.customWaypoint) return;
    const scr = this.worldToScreen(this.customWaypoint.x, this.customWaypoint.y);

    ctx.save();
    const pulse = (Math.sin(Date.now() * 0.005) + 1) * 0.5;

    // Pulsating ground ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 16 + pulse * 14, 0, Math.PI * 2);
    ctx.stroke();

    // Laser vertical beam shooting to the heavens
    const beamGrad = ctx.createLinearGradient(scr.x, scr.y, scr.x, scr.y - 600);
    beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
    beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.3)');
    beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(scr.x - 3, scr.y - 600, 6, 600);

    // Beacon marker icon
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(`BEACON: ${this.customWaypoint.label}`, scr.x, scr.y - 20);
    ctx.restore();
  }
}
