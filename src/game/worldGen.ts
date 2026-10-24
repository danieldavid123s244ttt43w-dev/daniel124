import { WorldResourceNode, WorldResourceType, ResourceType } from './types';

export interface WorldPOI {
  name: string;
  x: number;
  y: number;
  type: 'camp' | 'bunker' | 'crater' | 'highway' | 'swamp' | 'tower';
  description: string;
  radZone?: { radius: number; intensity: number };
}

export const WORLD_SIZE = 3600;

export const WORLD_POIS: WorldPOI[] = [
  {
    name: 'Survivor Awakening Clearing',
    x: 0,
    y: 0,
    type: 'camp',
    description: 'A sheltered pine hollow with dried timber and a freshwater spring.',
  },
  {
    name: 'Derelict Convoy (Hwy 84)',
    x: 250,
    y: 950,
    type: 'highway',
    description: 'Overturned military transport trucks and armored scout cars packed with scrap metal.',
  },
  {
    name: 'Irradiated Ground Zero Crater',
    x: -850,
    y: -750,
    type: 'crater',
    description: 'Glassed soil and intense ionizing radiation. Lurking grounds of the Armored Behemoth.',
    radZone: { radius: 360, intensity: 4.5 },
  },
  {
    name: 'Outpost Bunker 09',
    x: 950,
    y: -850,
    type: 'bunker',
    description: 'Heavy reinforced blast hatch guarding pre-war electronics and medical supplies.',
    radZone: { radius: 200, intensity: 1.2 },
  },
  {
    name: 'Blackmoss Swamp',
    x: 1050,
    y: 400,
    type: 'swamp',
    description: 'Toxic wetland shrouded in perpetual fog. Abundant chemical reagents and night ghouls.',
    radZone: { radius: 280, intensity: 2.0 },
  },
  {
    name: 'Forest Watchtower Overlook',
    x: -950,
    y: 550,
    type: 'tower',
    description: 'A decaying wooden ranger firetower overlooking the expansive pine canopy.',
  },
];

// Seeded pseudorandom generator for deterministic reproducible world generation
function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateWorldNodes(seed: number = 4289): WorldResourceNode[] {
  const rand = pseudoRandom(seed);
  const nodes: WorldResourceNode[] = [];
  let idCounter = 0;

  const addNode = (
    type: WorldResourceType,
    x: number,
    y: number,
    radius: number,
    hp: number,
    yieldItem: ResourceType,
    yieldCount: number,
    harvestTool?: 'axe' | 'pickaxe' | 'knife' | 'hand',
    secondaryYield?: { item: ResourceType; count: number },
    radEmission: number = 0
  ) => {
    nodes.push({
      id: `node_${++idCounter}`,
      type,
      x,
      y,
      radius,
      hp,
      maxHp: hp,
      yieldItem,
      yieldCount,
      harvestTool,
      secondaryYield,
      depleted: false,
      radEmission,
    });
  };

  // 1. Initial starter resources near player spawn (0, 0)
  addNode('pine_tree', -60, -50, 24, 60, 'wood', 8, 'axe');
  addNode('pine_tree', 70, -40, 26, 60, 'wood', 8, 'axe');
  addNode('pine_tree', -40, 60, 22, 60, 'wood', 8, 'axe');
  addNode('iron_boulder', 60, 60, 20, 75, 'stone', 6, 'pickaxe', { item: 'scrap_metal', count: 2 });
  addNode('berry_bush', -80, 20, 16, 20, 'wild_berries', 4, 'hand');
  addNode('military_crate', 30, -75, 18, 25, 'clean_water', 2, 'hand', { item: 'bandage', count: 2 });

  // 2. Generate pine forest throughout map (avoiding POI centers)
  for (let i = 0; i < 220; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 90 + rand() * (WORLD_SIZE / 2 - 120);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    // Skip crater center
    const distToCrater = Math.hypot(x - (-850), y - (-750));
    if (distToCrater < 160) continue;

    const r = 20 + rand() * 10;
    addNode('pine_tree', x, y, r, 60 + Math.floor(rand() * 40), 'wood', 6 + Math.floor(rand() * 6), 'axe');
  }

  // 3. Generate river stones & scrap boulders
  for (let i = 0; i < 110; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 100 + rand() * (WORLD_SIZE / 2 - 140);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;

    const isMetalRich = rand() > 0.45;
    addNode(
      'iron_boulder',
      x,
      y,
      18 + rand() * 8,
      80 + Math.floor(rand() * 40),
      isMetalRich ? 'scrap_metal' : 'stone',
      4 + Math.floor(rand() * 4),
      'pickaxe',
      isMetalRich ? { item: 'stone', count: 4 } : { item: 'scrap_metal', count: 2 }
    );
  }

  // 4. Wild berry bushes
  for (let i = 0; i < 60; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 70 + rand() * (WORLD_SIZE / 2 - 160);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    addNode('berry_bush', x, y, 16, 20, 'wild_berries', 3 + Math.floor(rand() * 3), 'hand');
  }

  // 5. Military crates and scavenge caches around Highway and Bunker
  const crateSpawns = [
    { x: 230, y: 920, item: 'canned_food' as ResourceType, cnt: 3 },
    { x: 280, y: 980, item: 'electronic_parts' as ResourceType, cnt: 2 },
    { x: 200, y: 970, item: 'cloth' as ResourceType, cnt: 5 },
    { x: 920, y: -820, item: 'electronic_parts' as ResourceType, cnt: 3 },
    { x: 980, y: -880, item: 'antirad_meds' as ResourceType, cnt: 2 },
    { x: 940, y: -910, item: 'clean_water' as ResourceType, cnt: 3 },
    { x: 1020, y: 380, item: 'chemical_reagents' as ResourceType, cnt: 4 },
    { x: 1100, y: 440, item: 'chemical_reagents' as ResourceType, cnt: 4 },
    { x: -940, y: 530, item: 'cloth' as ResourceType, cnt: 4 },
    { x: -970, y: 570, item: 'canned_food' as ResourceType, cnt: 2 },
    { x: -780, y: -700, item: 'scrap_metal' as ResourceType, cnt: 8 },
  ];

  for (const c of crateSpawns) {
    addNode('military_crate', c.x, c.y, 18, 30, c.item, c.cnt, 'hand', { item: 'cloth', count: 2 });
  }

  // 6. Abandoned derelict cars along highway
  const carSpawns = [
    { x: 210, y: 900 },
    { x: 260, y: 940 },
    { x: 310, y: 1000 },
    { x: 180, y: 1050 },
  ];
  for (const car of carSpawns) {
    addNode('scrap_car', car.x, car.y, 30, 160, 'scrap_metal', 10, 'pickaxe', { item: 'electronic_parts', count: 2 });
  }

  // 7. Ground zero radiation anomaly
  addNode('radiation_crater', -850, -750, 65, 9999, 'chemical_reagents', 5, 'hand', undefined, 5.0);

  return nodes;
}
