import {
  InventorySlot,
  CraftingRecipe,
  ResourceType,
  PlayerVitals,
  ItemDef,
} from './types';
import { ITEM_REGISTRY } from './items';

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dist = distance(x1, y1, x2, y2);
  return dist < r1 + r2;
}

export function getItemCount(inventory: InventorySlot[], item: ResourceType): number {
  return inventory
    .filter((slot) => slot.item === item)
    .reduce((sum, slot) => sum + slot.count, 0);
}

export function canCraftRecipe(inventory: InventorySlot[], recipe: CraftingRecipe): boolean {
  for (const mat of recipe.materials) {
    if (getItemCount(inventory, mat.item) < mat.count) {
      return false;
    }
  }
  return true;
}

export function deductCraftingMaterials(
  inventory: InventorySlot[],
  recipe: CraftingRecipe
): InventorySlot[] {
  let updated = inventory.map((slot) => ({ ...slot }));
  for (const mat of recipe.materials) {
    let remainingToDeduct = mat.count;
    for (let i = 0; i < updated.length && remainingToDeduct > 0; i++) {
      if (updated[i].item === mat.item) {
        if (updated[i].count <= remainingToDeduct) {
          remainingToDeduct -= updated[i].count;
          updated[i].count = 0;
        } else {
          updated[i].count -= remainingToDeduct;
          remainingToDeduct = 0;
        }
      }
    }
  }
  return updated.filter((slot) => slot.count > 0);
}

export function addToInventory(
  inventory: InventorySlot[],
  item: ResourceType,
  count: number,
  maxSlots: number = 24
): { updatedInventory: InventorySlot[]; addedCount: number; overflow: number } {
  const itemDef: ItemDef | undefined = ITEM_REGISTRY[item];
  const maxStack = itemDef ? itemDef.maxStack : 50;
  let remainingToAdd = count;
  const updated: InventorySlot[] = inventory.map((s) => ({ ...s }));

  // 1. Try filling existing non-full stacks
  for (const slot of updated) {
    if (slot.item === item && slot.count < maxStack) {
      const space = maxStack - slot.count;
      const toAdd = Math.min(space, remainingToAdd);
      slot.count += toAdd;
      remainingToAdd -= toAdd;
      if (remainingToAdd <= 0) break;
    }
  }

  // 2. Add new slots if inventory has room
  while (remainingToAdd > 0 && updated.length < maxSlots) {
    const toAdd = Math.min(maxStack, remainingToAdd);
    updated.push({ item, count: toAdd });
    remainingToAdd -= toAdd;
  }

  const addedCount = count - remainingToAdd;
  return {
    updatedInventory: updated,
    addedCount,
    overflow: remainingToAdd,
  };
}

export function removeFromInventory(
  inventory: InventorySlot[],
  item: ResourceType,
  count: number
): { updatedInventory: InventorySlot[]; success: boolean } {
  if (getItemCount(inventory, item) < count) {
    return { updatedInventory: inventory, success: false };
  }
  let remaining = count;
  const updated = inventory.map((s) => ({ ...s }));
  for (let i = 0; i < updated.length && remaining > 0; i++) {
    if (updated[i].item === item) {
      if (updated[i].count <= remaining) {
        remaining -= updated[i].count;
        updated[i].count = 0;
      } else {
        updated[i].count -= remaining;
        remaining = 0;
      }
    }
  }
  return {
    updatedInventory: updated.filter((s) => s.count > 0),
    success: true,
  };
}

export interface EnvironmentConditions {
  ambientRadiation: number; // e.g. 0 to 10 rad/s
  ambientTemperature: number; // e.g. 15 (day) to -5 (cold night)
  isNearCampfire: boolean;
  hasTorch: boolean;
  radResistance: number; // 0.0 to 1.0 (from gasmask)
  armorWarmth: number; // e.g. 15 from coat
}

export function updateVitals(
  vitals: PlayerVitals,
  dt: number,
  env: EnvironmentConditions
): PlayerVitals {
  const next = { ...vitals };

  // 1. Hunger decay: normal is 0.25/s, sprinting is 0.65/s
  const hungerDrainRate = next.isSprinting ? 0.65 : 0.25;
  next.hunger = Math.max(0, next.hunger - hungerDrainRate * dt);

  // 2. Thirst decay: normal is 0.35/s, sprinting is 0.85/s
  const thirstDrainRate = next.isSprinting ? 0.85 : 0.35;
  next.thirst = Math.max(0, next.thirst - thirstDrainRate * dt);

  // 3. Radiation intake:
  if (env.ambientRadiation > 0) {
    const effectiveRadIntake = env.ambientRadiation * (1 - Math.min(0.9, env.radResistance));
    next.radiation = Math.min(next.maxRadiation, next.radiation + effectiveRadIntake * dt);
  } else {
    // Natural slight biological cleansing
    next.radiation = Math.max(0, next.radiation - 0.08 * dt);
  }
  next.isRadPoisoned = next.radiation >= 60;

  // 4. Body Temperature:
  // Base effective temp
  let effectiveTemp = env.ambientTemperature + env.armorWarmth;
  if (env.isNearCampfire) effectiveTemp += 30;
  if (env.hasTorch) effectiveTemp += 8;

  if (effectiveTemp < 10) {
    // Freezing
    const coolingRate = 0.25 * (10 - effectiveTemp);
    next.bodyTemp = Math.max(30, next.bodyTemp - coolingRate * dt * 0.05);
  } else if (effectiveTemp > 25 && next.bodyTemp < 37) {
    // Warming back up
    next.bodyTemp = Math.min(37, next.bodyTemp + 0.5 * dt);
  }

  // 5. Stamina regeneration or consumption
  if (next.isSprinting) {
    next.stamina = Math.max(0, next.stamina - 28 * dt);
    if (next.stamina <= 0) {
      next.isSprinting = false;
    }
  } else {
    // Regen rate is slower if starving or dehydrated
    let regenMult = 1.0;
    if (next.hunger <= 10) regenMult *= 0.5;
    if (next.thirst <= 10) regenMult *= 0.5;
    next.stamina = Math.min(next.maxStamina, next.stamina + 22 * regenMult * dt);
  }

  // 6. Health consequences:
  let damageToTake = 0;
  // Starvation
  if (next.hunger <= 0) damageToTake += 2.5 * dt;
  // Dehydration
  if (next.thirst <= 0) damageToTake += 3.8 * dt;
  // Radiation sickness
  if (next.radiation >= 80) damageToTake += 5.0 * dt;
  else if (next.radiation >= 60) damageToTake += 1.8 * dt;
  // Hypothermia
  if (next.bodyTemp < 34) damageToTake += 3.0 * dt;

  // Passive heal when well-fed, hydrated, not freezing, and rads < 20
  if (
    damageToTake === 0 &&
    next.hunger >= 75 &&
    next.thirst >= 75 &&
    next.radiation < 20 &&
    next.bodyTemp >= 36
  ) {
    next.health = Math.min(next.maxHealth, next.health + 1.2 * dt);
  }

  next.health = Math.max(0, next.health - damageToTake);

  return next;
}

export interface DayCycleInfo {
  hour: number;
  minute: number;
  phase: 'dawn' | 'noon' | 'dusk' | 'night';
  lightIntensity: number; // 0.08 (pitch night) to 1.0 (midday)
  ambientColor: string;
  isNight: boolean;
}

export function calculateDayPhase(dayTimeMinutes: number): DayCycleInfo {
  // dayTimeMinutes is 0 to 1440 (0 = midnight, 360 = 6am, 720 = 12pm, 1080 = 6pm, 1260 = 9pm)
  const normTime = ((dayTimeMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normTime / 60);
  const minute = Math.floor(normTime % 60);

  let phase: 'dawn' | 'noon' | 'dusk' | 'night';
  let lightIntensity: number;
  let ambientColor: string;
  let isNight = false;

  if (normTime >= 360 && normTime < 480) {
    // 06:00 to 08:00 Dawn
    phase = 'dawn';
    const progress = (normTime - 360) / 120;
    lightIntensity = 0.2 + progress * 0.6; // 0.2 to 0.8
    ambientColor = '#e69966';
  } else if (normTime >= 480 && normTime < 1080) {
    // 08:00 to 18:00 Noon
    phase = 'noon';
    const distFromNoon = Math.abs(normTime - 780) / 300;
    lightIntensity = 1.0 - distFromNoon * 0.2; // 0.8 to 1.0
    ambientColor = '#f4f6e8';
  } else if (normTime >= 1080 && normTime < 1260) {
    // 18:00 to 21:00 Dusk
    phase = 'dusk';
    const progress = (normTime - 1080) / 180;
    lightIntensity = 0.8 - progress * 0.65; // 0.8 to 0.15
    ambientColor = '#bf6a3b';
  } else {
    // 21:00 to 06:00 Night
    phase = 'night';
    isNight = true;
    lightIntensity = 0.08;
    ambientColor = '#0b1326';
  }

  return {
    hour,
    minute,
    phase,
    lightIntensity,
    ambientColor,
    isNight,
  };
}

export function calculateWeaponDamage(
  weaponId: ResourceType | undefined,
  targetType: 'tree' | 'rock' | 'mutant'
): { damage: number; toolBonus: boolean } {
  if (!weaponId) {
    // Bare hands
    return { damage: targetType === 'mutant' ? 6 : 4, toolBonus: false };
  }

  const def = ITEM_REGISTRY[weaponId];
  if (!def) {
    return { damage: 5, toolBonus: false };
  }

  const baseDmg = def.damage || 8;

  if (targetType === 'tree') {
    if (def.toolType === 'axe') {
      return { damage: baseDmg * 2.5, toolBonus: true };
    }
    return { damage: baseDmg * 0.4, toolBonus: false };
  }

  if (targetType === 'rock') {
    if (def.toolType === 'pickaxe') {
      return { damage: baseDmg * 2.5, toolBonus: true };
    }
    return { damage: baseDmg * 0.3, toolBonus: false };
  }

  // Mutant
  return { damage: baseDmg, toolBonus: true };
}
