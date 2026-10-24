import { Item, PackagePreset, PackedPackage } from '../types/index.js';
import { db } from '../db/database.js';

export interface BinPackingOptions {
  presets?: PackagePreset[];
  packingFactor?: number; // default 0.82 (accounts for packing peanuts / bubble wrap / void)
  dimDivisor?: number; // domestic carrier standard 166
}

export class BinPackingService {
  private defaultPresets: PackagePreset[];
  private packingFactor: number;
  private dimDivisor: number;

  constructor(options?: BinPackingOptions) {
    this.defaultPresets = options?.presets || db.getPresets();
    this.packingFactor = options?.packingFactor || 0.82;
    this.dimDivisor = options?.dimDivisor || 166;
  }

  /**
   * Sort dimensions in descending order [max, mid, min]
   */
  private sortDimensions(l: number, w: number, h: number): [number, number, number] {
    return [l, w, h].sort((a, b) => b - a) as [number, number, number];
  }

  /**
   * Check if a single item can physically fit inside a container considering 3D rotation
   */
  private canItemFitInContainer(
    itemDims: [number, number, number],
    boxDims: [number, number, number]
  ): boolean {
    return (
      itemDims[0] <= boxDims[0] &&
      itemDims[1] <= boxDims[1] &&
      itemDims[2] <= boxDims[2]
    );
  }

  /**
   * Selects optimal box preset and packages the given cart items
   */
  public packItems(items: Item[], customPresets?: PackagePreset[]): PackedPackage {
    if (!items || items.length === 0) {
      throw new Error('Cannot pack an empty items list');
    }

    const presets = customPresets || db.getPresets() || this.defaultPresets;

    let totalItemWeightOz = 0;
    let totalItemVolumeCuIn = 0;
    let maxSingleDimension = 0;
    let maxItemDims: [number, number, number] = [0, 0, 0];

    const itemsPackedSummary: { id: string; name: string; quantity: number }[] = [];

    // Analyze all items
    for (const item of items) {
      const qty = Math.max(1, item.quantity || 1);
      const weight = Math.max(0.1, item.weightOz || 8); // default to 8 oz if missing
      const l = Math.max(1, item.lengthIn || 4);
      const w = Math.max(1, item.widthIn || 4);
      const h = Math.max(0.5, item.heightIn || 1);

      const itemVol = l * w * h;
      totalItemWeightOz += weight * qty;
      totalItemVolumeCuIn += itemVol * qty;

      const sortedItemDims = this.sortDimensions(l, w, h);
      maxItemDims = [
        Math.max(maxItemDims[0], sortedItemDims[0]),
        Math.max(maxItemDims[1], sortedItemDims[1]),
        Math.max(maxItemDims[2], sortedItemDims[2]),
      ];
      maxSingleDimension = Math.max(maxSingleDimension, sortedItemDims[0]);

      itemsPackedSummary.push({
        id: item.id || item.sku || `item_${itemsPackedSummary.length + 1}`,
        name: item.name || 'Custom Item',
        quantity: qty,
      });
    }

    // Sort presets by volume ascending to pick the smallest box that fits
    const sortedPresets = [...presets].sort((a, b) => {
      const volA = a.lengthIn * a.widthIn * a.heightIn;
      const volB = b.lengthIn * b.widthIn * b.heightIn;
      return volA - volB;
    });

    let selectedPreset: PackagePreset | null = null;

    // Check each candidate preset
    for (const preset of sortedPresets) {
      const boxVolume = preset.lengthIn * preset.widthIn * preset.heightIn;
      const effectiveCapacity = boxVolume * this.packingFactor;

      // 1. Weight capacity check
      if (totalItemWeightOz > preset.maxWeightOz) {
        continue;
      }

      // 2. Volume capacity check
      if (totalItemVolumeCuIn > effectiveCapacity) {
        continue;
      }

      // 3. Dimensional bounds check (with rotation)
      const sortedBoxDims = this.sortDimensions(
        preset.lengthIn,
        preset.widthIn,
        preset.heightIn
      );

      if (!this.canItemFitInContainer(maxItemDims, sortedBoxDims)) {
        continue;
      }

      // 4. Special envelope constraint: Envelope only fits flat items (height <= 1.5 in)
      if (preset.type === 'envelope') {
        if (maxItemDims[2] > 1.5 || totalItemWeightOz > 64) {
          continue;
        }
      }

      selectedPreset = preset;
      break;
    }

    // If no standard preset fits, construct a custom box
    if (!selectedPreset) {
      const requiredVol = totalItemVolumeCuIn / this.packingFactor;
      const customLength = Math.ceil(Math.max(maxItemDims[0] + 1.5, 12));
      const customWidth = Math.ceil(Math.max(maxItemDims[1] + 1.5, 10));
      const customHeight = Math.ceil(
        Math.max(maxItemDims[2] + 1.5, requiredVol / (customLength * customWidth))
      );

      selectedPreset = {
        id: 'preset_custom_oversized',
        name: `Custom Oversized Box (${customLength}"x${customWidth}"x${customHeight}")`,
        type: 'custom',
        lengthIn: customLength,
        widthIn: customWidth,
        heightIn: customHeight,
        maxWeightOz: 1600, // 100 lbs
        tareWeightOz: Math.round((customLength * customWidth * customHeight) / 100) + 8,
      };
    }

    const tareWeightOz = selectedPreset.tareWeightOz || 4.0;
    const totalWeightOz = totalItemWeightOz + tareWeightOz;
    const totalWeightLbs = Math.round((totalWeightOz / 16) * 100) / 100;

    // Dimensional Weight: (L * W * H) / 166
    const boxVol = selectedPreset.lengthIn * selectedPreset.widthIn * selectedPreset.heightIn;
    const dimWeightLbs = Math.round((boxVol / this.dimDivisor) * 100) / 100;
    const billableWeightLbs = Math.max(totalWeightLbs, dimWeightLbs);

    const packingEfficiency = Math.min(
      100,
      Math.max(1, Math.round((totalItemVolumeCuIn / boxVol) * 100))
    );

    return {
      presetId: selectedPreset.id,
      presetName: selectedPreset.name,
      lengthIn: selectedPreset.lengthIn,
      widthIn: selectedPreset.widthIn,
      heightIn: selectedPreset.heightIn,
      itemWeightOz: Math.round(totalItemWeightOz * 10) / 10,
      tareWeightOz: Math.round(tareWeightOz * 10) / 10,
      totalWeightOz: Math.round(totalWeightOz * 10) / 10,
      totalWeightLbs,
      billableWeightLbs,
      itemsPacked: itemsPackedSummary,
      packingEfficiencyPercent: packingEfficiency,
    };
  }
}

export const binPackingService = new BinPackingService();
