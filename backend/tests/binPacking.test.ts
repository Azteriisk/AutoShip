import { describe, it, expect } from 'vitest';
import { binPackingService } from '../src/services/binPackingService.js';
import { Item } from '../src/types/index.js';

describe('BinPackingService', () => {
  it('should pack a single flat lightweight item (T-Shirt) into a Padded Envelope', () => {
    const tshirt: Item = {
      id: 'tshirt_1',
      name: 'Cotton T-Shirt',
      quantity: 1,
      price: 25.0,
      weightOz: 7.0,
      lengthIn: 9.0,
      widthIn: 7.0,
      heightIn: 0.8,
    };

    const result = binPackingService.packItems([tshirt]);

    expect(result.presetId).toBe('preset_padded_envelope');
    expect(result.presetName).toBe('Padded Bubble Mailer');
    // Total weight = item weight (7 oz) + envelope tare (1.5 oz) = 8.5 oz
    expect(result.totalWeightOz).toBe(8.5);
    expect(result.totalWeightLbs).toBe(0.53);
    expect(result.itemsPacked).toHaveLength(1);
  });

  it('should select Small Box when item is too thick for envelope but fits small box', () => {
    const compactItem: Item = {
      id: 'compact_1',
      name: 'Luxury Soap Box',
      quantity: 1,
      price: 15.0,
      weightOz: 12.0,
      lengthIn: 5.0,
      widthIn: 3.5,
      heightIn: 2.2, // > 1.5 in so cannot fit in envelope, but fits 6x4x3 box
    };

    const result = binPackingService.packItems([compactItem]);

    expect(result.presetId).toBe('preset_small_box');
    expect(result.presetName).toBe('Small Box');
    // Tare weight of small box is 3 oz -> 12 + 3 = 15 oz
    expect(result.totalWeightOz).toBe(15.0);
  });

  it('should escalate to Medium Box when items volume or dimensions exceed Small Box', () => {
    const hoodie: Item = {
      id: 'hoodie_1',
      name: 'Winter Hoodie',
      quantity: 2,
      price: 60.0,
      weightOz: 24.0,
      lengthIn: 11.0,
      widthIn: 8.5,
      heightIn: 3.5,
    };

    const result = binPackingService.packItems([hoodie]);

    // Small box is 6x4x3, hoodie is 11x8.5x3.5, so must be at least medium or large
    expect(['preset_medium_box', 'preset_large_box']).toContain(result.presetId);
    expect(result.totalWeightOz).toBeGreaterThan(48.0);
  });

  it('should enforce max weight constraints on package presets', () => {
    // 6 small lead weights: small dimensions (3x2x1) but heavy (90 oz total)
    // Small box max weight is 80 oz, so it must escalate to Medium Box (max 320 oz)
    const heavyItem: Item = {
      id: 'lead_weights',
      name: 'Barbell Clamp Weights',
      quantity: 1,
      price: 40.0,
      weightOz: 90.0,
      lengthIn: 4.0,
      widthIn: 3.0,
      heightIn: 2.0,
    };

    const result = binPackingService.packItems([heavyItem]);

    expect(result.presetId).not.toBe('preset_small_box');
    expect(result.presetId).toBe('preset_medium_box');
  });

  it('should create a custom oversized box when items exceed largest standard preset', () => {
    const hugeGuitar: Item = {
      id: 'guitar_case',
      name: 'Acoustic Guitar in Case',
      quantity: 1,
      price: 450.0,
      weightOz: 240.0,
      lengthIn: 44.0,
      widthIn: 18.0,
      heightIn: 9.0,
    };

    const result = binPackingService.packItems([hugeGuitar]);

    expect(result.presetId).toBe('preset_custom_oversized');
    expect(result.lengthIn).toBeGreaterThanOrEqual(44.0);
  });
});
