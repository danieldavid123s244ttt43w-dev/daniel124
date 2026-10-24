import { useState } from 'react';
import { X, Hammer, Backpack, Shield, Sword, Heart, Sparkles, Check, AlertCircle } from 'lucide-react';
import { InventorySlot, ResourceType, EquipSlot, CraftingRecipe } from '../game/types';
import { ITEM_REGISTRY, CRAFTING_RECIPES } from '../game/items';
import { canCraftRecipe, deductCraftingMaterials, addToInventory, getItemCount } from '../game/rules';
import { sounds } from '../game/audio';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventorySlot[];
  onUpdateInventory: (inv: InventorySlot[]) => void;
  equipped: Partial<Record<EquipSlot, ResourceType>>;
  onEquipItem: (item: ResourceType) => void;
  onUnequipItem: (slot: EquipSlot) => void;
  onUseConsumable: (item: ResourceType) => void;
  onStructureSelected?: (item: ResourceType) => void;
}

export function InventoryModal({
  isOpen,
  onClose,
  inventory,
  onUpdateInventory,
  equipped,
  onEquipItem,
  onUnequipItem,
  onUseConsumable,
  onStructureSelected,
}: InventoryModalProps) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'crafting'>('inventory');
  const [craftCategory, setCraftCategory] = useState<string>('all');
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const selectedSlot = selectedSlotIdx !== null ? inventory[selectedSlotIdx] : null;
  const selectedItemDef = selectedSlot ? ITEM_REGISTRY[selectedSlot.item] : null;

  const filteredRecipes = CRAFTING_RECIPES.filter((r) => {
    if (craftCategory === 'all') return true;
    return r.category === craftCategory;
  });

  const handleCraft = (recipe: CraftingRecipe) => {
    if (!canCraftRecipe(inventory, recipe)) return;

    // Deduct materials
    const afterDeduction = deductCraftingMaterials(inventory, recipe);
    // Add result
    const added = addToInventory(afterDeduction, recipe.result, recipe.resultCount);
    onUpdateInventory(added.updatedInventory);
    sounds.playCraftSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-none pointer-events-auto select-none">
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'inventory'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Backpack className="w-4 h-4" />
              <span>Backpack & Equipment</span>
            </button>
            <button
              onClick={() => setActiveTab('crafting')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'crafting'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>Survival Workbench</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 1: Inventory & Equipment */}
        {activeTab === 'inventory' ? (
          <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
            {/* Left: 24 Slot Backpack Grid */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-slate-400">
                <span>Rucksack Capacity (24 Slots)</span>
                <span className="tabular-nums font-bold text-slate-300">{inventory.length}/24</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 overflow-y-auto p-1 max-h-[55vh]">
                {Array.from({ length: 24 }).map((_, idx) => {
                  const slot = inventory[idx];
                  const def = slot ? ITEM_REGISTRY[slot.item] : null;
                  const isSelected = selectedSlotIdx === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlotIdx(idx)}
                      className={`h-20 rounded-xl p-2 flex flex-col items-center justify-between border transition-all ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-400 shadow-md shadow-emerald-500/10'
                          : slot
                          ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/60 border-slate-900'
                      }`}
                    >
                      {def ? (
                        <>
                          <span className="text-[11px] font-bold text-slate-200 text-center leading-tight line-clamp-2">
                            {def.name}
                          </span>
                          <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                            <span className="capitalize text-[9px] text-slate-500">{def.category}</span>
                            {slot.count > 1 && (
                              <span className="font-bold text-emerald-400 tabular-nums">x{slot.count}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-800 text-xs font-mono">
                          {idx + 1}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Equipment Slots & Item Inspector */}
            <div className="w-full md:w-72 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-slate-800 md:pl-6">
              {/* Equipped Gear Slots */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Combat Loadout</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Head */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Headgear</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {equipped.head ? ITEM_REGISTRY[equipped.head].name : 'None'}
                    </span>
                  </div>
                  {/* Torso */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Torso Armor</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {equipped.torso ? ITEM_REGISTRY[equipped.torso].name : 'None'}
                    </span>
                  </div>
                  {/* Mainhand */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Primary Hand</span>
                    <span className="font-bold text-emerald-400 truncate block">
                      {equipped.mainhand ? ITEM_REGISTRY[equipped.mainhand].name : 'Fists'}
                    </span>
                  </div>
                  {/* Offhand */}
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Offhand Gear</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {equipped.offhand ? ITEM_REGISTRY[equipped.offhand].name : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Item Detail */}
              {selectedItemDef && selectedSlot ? (
                <div className="flex-1 flex flex-col justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">{selectedItemDef.name}</span>
                      <span className="text-xs font-mono text-emerald-400 capitalize">
                        {selectedItemDef.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedItemDef.description}</p>

                    {/* Stats pills */}
                    <div className="flex flex-wrap gap-2 pt-2 text-[11px] font-mono text-slate-400">
                      {selectedItemDef.damage && <span>DMG: {selectedItemDef.damage}</span>}
                      {selectedItemDef.armor && <span>ARMOR: +{selectedItemDef.armor}</span>}
                      {selectedItemDef.radResistance && (
                        <span>RAD RES: {Math.round(selectedItemDef.radResistance * 100)}%</span>
                      )}
                      {selectedItemDef.warmth && <span>WARMTH: +{selectedItemDef.warmth}°</span>}
                      {selectedItemDef.healAmount && (
                        <span className="text-emerald-400">HEAL: +{selectedItemDef.healAmount}</span>
                      )}
                      {selectedItemDef.hungerAmount && (
                        <span className="text-amber-400">FOOD: +{selectedItemDef.hungerAmount}</span>
                      )}
                      {selectedItemDef.thirstAmount && (
                        <span className="text-sky-400">WATER: +{selectedItemDef.thirstAmount}</span>
                      )}
                    </div>
                  </div>

                  {/* Context Actions */}
                  <div className="flex flex-col gap-2 pt-4">
                    {selectedItemDef.category === 'consumable' && (
                      <button
                        onClick={() => onUseConsumable(selectedSlot.item)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs uppercase rounded-lg transition-colors"
                      >
                        Consume / Use
                      </button>
                    )}
                    {selectedItemDef.equipSlot && (
                      <button
                        onClick={() => onEquipItem(selectedSlot.item)}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase rounded-lg transition-colors"
                      >
                        Equip to {selectedItemDef.equipSlot}
                      </button>
                    )}
                    {selectedItemDef.isBuilding && (
                      <button
                        onClick={() => {
                          onStructureSelected?.(selectedSlot.item);
                          onClose();
                        }}
                        className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs uppercase rounded-lg transition-colors"
                      >
                        Place in World
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl">
                  Select an item from your pack to inspect attributes or equip.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tab 2: Crafting Workbench */
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Category Filter Bar */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 shrink-0">
              {['all', 'tools', 'weapons', 'defense', 'survival', 'medical'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCraftCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors ${
                    craftCategory === cat
                      ? 'bg-emerald-600 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Recipes Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1">
              {filteredRecipes.map((recipe) => {
                const canCraft = canCraftRecipe(inventory, recipe);
                const outDef = ITEM_REGISTRY[recipe.result];

                return (
                  <div
                    key={recipe.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-slate-100">{recipe.title}</span>
                        <span className="text-[10px] font-mono text-emerald-400 uppercase">
                          {recipe.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{recipe.description}</p>

                      {/* Required Ingredients */}
                      <div className="flex flex-wrap gap-2 text-xs font-mono">
                        {recipe.materials.map((mat) => {
                          const currentCount = getItemCount(inventory, mat.item);
                          const hasEnough = currentCount >= mat.count;
                          const matDef = ITEM_REGISTRY[mat.item];

                          return (
                            <span
                              key={mat.item}
                              className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                                hasEnough
                                  ? 'bg-slate-800 text-slate-300'
                                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                              }`}
                            >
                              <span>{matDef ? matDef.name : mat.item}:</span>
                              <span className="font-bold tabular-nums">
                                {currentCount}/{mat.count}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      disabled={!canCraft}
                      onClick={() => handleCraft(recipe)}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        canCraft
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-md cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Hammer className="w-3.5 h-3.5" />
                      <span>Craft Item</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
