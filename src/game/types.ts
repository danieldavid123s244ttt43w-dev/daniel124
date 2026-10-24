export type ResourceType =
  | 'wood'
  | 'stone'
  | 'scrap_metal'
  | 'cloth'
  | 'electronic_parts'
  | 'chemical_reagents'
  | 'canned_food'
  | 'clean_water'
  | 'irradiated_water'
  | 'raw_meat'
  | 'cooked_meat'
  | 'wild_berries'
  | 'antirad_meds'
  | 'bandage'
  | 'stone_hatchet'
  | 'makeshift_knife'
  | 'scrap_pickaxe'
  | 'hunting_bow'
  | 'arrow'
  | 'scrap_shotgun'
  | 'shotgun_shells'
  | 'hazmat_mask'
  | 'padded_jacket'
  | 'torch'
  | 'campfire'
  | 'wooden_barricade'
  | 'storage_crate'
  | 'sleeping_bag'
  | 'spike_trap';

export type ItemCategory = 'resource' | 'tool' | 'weapon' | 'armor' | 'consumable' | 'structure';

export type EquipSlot = 'mainhand' | 'offhand' | 'head' | 'torso';

export interface ItemDef {
  id: ResourceType;
  name: string;
  category: ItemCategory;
  description: string;
  maxStack: number;
  equipSlot?: EquipSlot;
  // Attributes
  damage?: number;
  attackRange?: number;
  attackSpeed?: number; // attacks per second
  toolType?: 'axe' | 'pickaxe' | 'knife';
  toolPower?: number;
  armor?: number;
  radResistance?: number; // 0.0 - 1.0 (reduces radiation gain)
  warmth?: number;
  // Consumable restores
  healAmount?: number;
  hungerAmount?: number;
  thirstAmount?: number;
  radReduction?: number;
  consumeTime?: number;
  isBuilding?: boolean;
  structureType?: 'campfire' | 'wooden_barricade' | 'storage_crate' | 'sleeping_bag' | 'spike_trap';
}

export interface InventorySlot {
  item: ResourceType;
  count: number;
}

export interface CraftingRecipe {
  id: string;
  result: ResourceType;
  resultCount: number;
  category: 'survival' | 'tools' | 'weapons' | 'defense' | 'medical';
  title: string;
  description: string;
  requiresStation?: 'none' | 'workbench' | 'campfire';
  materials: { item: ResourceType; count: number }[];
}

export interface PlayerVitals {
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  thirst: number;
  maxThirst: number;
  radiation: number;
  maxRadiation: number;
  stamina: number;
  maxStamina: number;
  bodyTemp: number; // 37 is normal, <34 hypothermia
  isSprinting: boolean;
  isBleeding: boolean;
  isRadPoisoned: boolean;
}

export type EnemyType = 'ghoul_stalker' | 'toxic_spitter' | 'mutant_brute' | 'infected_wolf' | 'mutant_boar';

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  angle: number;
  state: 'idle' | 'patrol' | 'alert' | 'charge' | 'attack_windup' | 'flee' | 'dead';
  stateTimer: number;
  telegraphTimer: number;
  telegraphMax: number;
  attackCooldown: number;
  attackRange: number;
  damage: number;
  targetX: number;
  targetY: number;
  hitFlashTimer: number;
  koTimer: number;
  dropItems: { item: ResourceType; count: number; chance: number }[];
}

export type WorldResourceType = 'pine_tree' | 'iron_boulder' | 'berry_bush' | 'scrap_car' | 'military_crate' | 'radiation_crater' | 'bunker_door';

export interface WorldResourceNode {
  id: string;
  type: WorldResourceType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  harvestTool?: 'axe' | 'pickaxe' | 'knife' | 'hand';
  yieldItem: ResourceType;
  yieldCount: number;
  secondaryYield?: { item: ResourceType; count: number };
  depleted: boolean;
  respawnTime?: number;
  radEmission?: number; // Radiation per second when nearby
}

export interface PlacedStructure {
  id: string;
  type: 'campfire' | 'wooden_barricade' | 'storage_crate' | 'sleeping_bag' | 'spike_trap';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  isLit?: boolean;
  fuelLeft?: number; // in seconds
  storedItems?: InventorySlot[];
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isPlayer: boolean;
  rangeLeft: number;
  type: 'arrow' | 'pellet' | 'acid_spit';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export type WeatherType = 'clear' | 'fog' | 'acid_rain' | 'radioactive_ash';

export interface WorldState {
  dayTime: number; // 0 to 1440 (minutes in day, 1 min real = 1 hr game)
  dayCount: number;
  weather: WeatherType;
  weatherTimer: number;
}

export interface GameStats {
  daysSurvived: number;
  enemiesDefeated: number;
  resourcesScavenged: number;
  itemsCrafted: number;
  structuresBuilt: number;
  distanceTraveled: number;
  causeOfDeath?: string;
}
