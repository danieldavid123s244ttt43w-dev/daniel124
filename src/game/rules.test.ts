import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distance,
  checkCircleCollision,
  canCraftRecipe,
  deductCraftingMaterials,
  addToInventory,
  removeFromInventory,
  updateVitals,
  calculateDayPhase,
  calculateWeaponDamage,
  getItemCount,
} from './rules';
import { CRAFTING_RECIPES } from './items';
import { InventorySlot, PlayerVitals } from './types';

test('distance calculates accurate Euclidean distance', () => {
  assert.equal(distance(0, 0, 3, 4), 5);
  assert.equal(distance(10, 10, 10, 10), 0);
  assert.equal(distance(0, 0, 0, 10), 10);
});

test('checkCircleCollision accurately detects overlapping and disjoint circles', () => {
  // Overlapping
  assert.equal(checkCircleCollision(0, 0, 10, 15, 0, 10), true);
  // Touching
  assert.equal(checkCircleCollision(0, 0, 10, 20, 0, 10), false);
  // Far apart
  assert.equal(checkCircleCollision(0, 0, 5, 50, 50, 5), false);
});

test('inventory management handles stacking and capacity', () => {
  let inv: InventorySlot[] = [
    { item: 'wood', count: 40 },
    { item: 'stone', count: 10 },
  ];

  // Adding 20 wood: should fill the existing stack to 50 (maxStack 50) and create a second slot with 10
  const result = addToInventory(inv, 'wood', 20, 10);
  assert.equal(result.addedCount, 20);
  assert.equal(result.overflow, 0);
  assert.equal(getItemCount(result.updatedInventory, 'wood'), 60);
  assert.equal(result.updatedInventory.length, 3);

  // Removing items
  const removeRes = removeFromInventory(result.updatedInventory, 'wood', 25);
  assert.equal(removeRes.success, true);
  assert.equal(getItemCount(removeRes.updatedInventory, 'wood'), 35);

  // Attempting to remove more than available fails safely
  const failRemove = removeFromInventory(removeRes.updatedInventory, 'wood', 100);
  assert.equal(failRemove.success, false);
});

test('crafting recipe checking and deduction', () => {
  const hatchetRecipe = CRAFTING_RECIPES.find((r) => r.id === 'craft_stone_hatchet');
  assert.ok(hatchetRecipe);

  const insufficientInv: InventorySlot[] = [
    { item: 'wood', count: 4 }, // Needs 6
    { item: 'stone', count: 10 },
  ];
  assert.equal(canCraftRecipe(insufficientInv, hatchetRecipe), false);

  const sufficientInv: InventorySlot[] = [
    { item: 'wood', count: 10 },
    { item: 'stone', count: 4 },
  ];
  assert.equal(canCraftRecipe(sufficientInv, hatchetRecipe), true);

  const afterDeduction = deductCraftingMaterials(sufficientInv, hatchetRecipe);
  assert.equal(getItemCount(afterDeduction, 'wood'), 4);
  assert.equal(getItemCount(afterDeduction, 'stone'), 0);
});

test('day cycle correctly maps time of day to phase and lighting', () => {
  // Midnight (00:00 = 0)
  const midnight = calculateDayPhase(0);
  assert.equal(midnight.phase, 'night');
  assert.equal(midnight.isNight, true);
  assert.equal(midnight.hour, 0);

  // Midday (12:00 = 720)
  const midday = calculateDayPhase(720);
  assert.equal(midday.phase, 'noon');
  assert.equal(midday.isNight, false);
  assert.equal(midday.hour, 12);
  assert.ok(midday.lightIntensity >= 0.8);

  // Dusk (19:00 = 1140)
  const dusk = calculateDayPhase(1140);
  assert.equal(dusk.phase, 'dusk');
  assert.equal(dusk.hour, 19);
});

test('vitals decay and radiation mechanics', () => {
  const initialVitals: PlayerVitals = {
    health: 100,
    maxHealth: 100,
    hunger: 100,
    maxHunger: 100,
    thirst: 100,
    maxThirst: 100,
    radiation: 0,
    maxRadiation: 100,
    stamina: 100,
    maxStamina: 100,
    bodyTemp: 37,
    isSprinting: false,
    isBleeding: false,
    isRadPoisoned: false,
  };

  // 10 seconds of normal idle in safe zone
  const step1 = updateVitals(initialVitals, 10, {
    ambientRadiation: 0,
    ambientTemperature: 20,
    isNearCampfire: false,
    hasTorch: false,
    radResistance: 0,
    armorWarmth: 0,
  });

  assert.ok(step1.hunger < 100);
  assert.ok(step1.thirst < 100);
  assert.equal(step1.health, 100); // Health stays full if hunger & thirst > 0

  // Entering high radiation zone (5 rad/s)
  const step2 = updateVitals(step1, 15, {
    ambientRadiation: 5,
    ambientTemperature: 20,
    isNearCampfire: false,
    hasTorch: false,
    radResistance: 0,
    armorWarmth: 0,
  });

  assert.ok(step2.radiation > 70);
  assert.equal(step2.isRadPoisoned, true);
});

test('weapon tool bonuses against harvestable resources', () => {
  // Axe vs Tree
  const axeOnTree = calculateWeaponDamage('stone_hatchet', 'tree');
  assert.equal(axeOnTree.toolBonus, true);
  assert.ok(axeOnTree.damage >= 50);

  // Knife vs Tree (inefficient)
  const knifeOnTree = calculateWeaponDamage('makeshift_knife', 'tree');
  assert.equal(knifeOnTree.toolBonus, false);
  assert.ok(knifeOnTree.damage < 15);

  // Pickaxe vs Rock
  const pickOnRock = calculateWeaponDamage('scrap_pickaxe', 'rock');
  assert.equal(pickOnRock.toolBonus, true);
  assert.ok(pickOnRock.damage >= 50);
});
