/**
 * scaleDiscoveryLayer — the transform that keeps the 20 Bangalore Fort discovery
 * cards registered to the reconstruction when it is previewed at less than true
 * size indoors.
 *
 * Cards hang off the ANCHOR, not the model node, so without this the model
 * shrinks and the cards stay 48 m apart, through the walls of the room.
 */
import {
  scaleDiscoveryLayer,
  type DiscoveryLayer,
} from '../../src/features/ar/discoveryLayers';

const layer: DiscoveryLayer = {
  cards: [
    {
      id: 'c1',
      x: 10,
      y: 4,
      z: -20,
      yaw: 48.8,
      w: 1.2,
      title: 'Delhi Gate',
      meta: 'CONFIRMED · C. Mackenzie 1791',
      body: 'body',
      accent: 'green',
    },
  ],
  tapTargets: [
    {
      id: 't1',
      label: 'Rampart',
      min: [-23.5, 0, -31.9],
      max: [23.6, 13.5, 16.5],
    },
  ],
};

describe('scaleDiscoveryLayer', () => {
  it('is identity at k = 1 and returns the same reference', () => {
    expect(scaleDiscoveryLayer(layer, 1)).toBe(layer);
  });

  it('scales card position and width', () => {
    const {cards} = scaleDiscoveryLayer(layer, 0.02);
    expect(cards[0].x).toBeCloseTo(0.2, 10);
    expect(cards[0].y).toBeCloseTo(0.08, 10);
    expect(cards[0].z).toBeCloseTo(-0.4, 10);
    expect(cards[0].w).toBeCloseTo(0.024, 10);
  });

  it('leaves yaw untouched — rotation is scale-invariant', () => {
    expect(scaleDiscoveryLayer(layer, 0.02).cards[0].yaw).toBe(48.8);
    expect(scaleDiscoveryLayer(layer, 0.1).cards[0].yaw).toBe(48.8);
  });

  it('preserves card text so the preview shows the real content', () => {
    const {cards} = scaleDiscoveryLayer(layer, 0.1);
    expect(cards[0].title).toBe('Delhi Gate');
    expect(cards[0].meta).toBe('CONFIRMED · C. Mackenzie 1791');
    expect(cards[0].accent).toBe('green');
  });

  it('scales tap-target boxes on every axis', () => {
    const {tapTargets} = scaleDiscoveryLayer(layer, 0.1);
    expect(tapTargets[0].min).toEqual([-2.35, 0, -3.19]);
    expect(tapTargets[0].max[1]).toBeCloseTo(1.35, 10);
  });

  it('does not mutate the input', () => {
    scaleDiscoveryLayer(layer, 0.02);
    expect(layer.cards[0].x).toBe(10);
    expect(layer.tapTargets[0].max[1]).toBe(13.5);
  });

  it('refuses nonsense factors rather than collapsing the layer', () => {
    expect(scaleDiscoveryLayer(layer, 0)).toBe(layer);
    expect(scaleDiscoveryLayer(layer, -1)).toBe(layer);
    expect(scaleDiscoveryLayer(layer, NaN)).toBe(layer);
  });
});
