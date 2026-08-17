/**
 * DRY RUN — the whole visitor chain, at a desk.
 *
 * `guiding -> resolving -> locked` has never once executed. Three Bangalore Fort
 * trips were spent discovering, on first contact, that a step nobody had ever run
 * did not work: the range gate had no escape so the camera never opened, the
 * target was never chosen without a GPS fix, and the card layer leaked itself to
 * death. Every one of those is decidable without a monument.
 *
 * So this drives the real screen against a fake station and a fake native view,
 * and asserts on what it ASKS NATIVE TO DO — the geospatial pose it places, the
 * cloud anchor it resolves, the layer it hangs — rather than on what it renders.
 * Those calls are the contract with the world; the pixels are not.
 */
import React from 'react';
import ReactTestRenderer, {type ReactTestInstance} from 'react-test-renderer';
import {Text} from 'react-native';

// ── The native view, replaced by a recorder ─────────────────────────────────
interface NativeCalls {
  placeGeospatialAnchor: unknown[][];
  resolveCloudAnchor: unknown[][];
  placeDiscoveryCards: unknown[][];
  setTapTargets: unknown[][];
}
const mockNativeCalls: NativeCalls = {
  placeGeospatialAnchor: [],
  resolveCloudAnchor: [],
  placeDiscoveryCards: [],
  setTapTargets: [],
};
/** Latest props the screen handed the native view — the event callbacks live here. */
let mockArProps: Record<string, any> | null = null;

jest.mock('../../src/native/EpocheyeDetectARView', () => {
  const React_ = require('react');
  const Mock = React_.forwardRef((props: any, ref: any) => {
    mockArProps = props;
    React_.useImperativeHandle(ref, () => ({
      placeGeospatialAnchor: (...a: unknown[]) =>
        mockNativeCalls.placeGeospatialAnchor.push(a),
      resolveCloudAnchor: (...a: unknown[]) =>
        mockNativeCalls.resolveCloudAnchor.push(a),
      placeDiscoveryCards: (...a: unknown[]) =>
        mockNativeCalls.placeDiscoveryCards.push(a),
      setTapTargets: (...a: unknown[]) => mockNativeCalls.setTapTargets.push(a),
      clearDiscoveryLayer: jest.fn(),
      markAlignmentPoint: jest.fn(),
      applyAlignment: jest.fn(),
    }));
    return null;
  });
  return {__esModule: true, default: Mock};
});

// ── Everything the screen leans on, stubbed to a known state ────────────────
const STATION = {
  id: 'st-1',
  monument_id: 'bangalore-fort',
  title: 'Courtyard, facing the Delhi Gate',
  active: true,
  stand_lat: 12.96274,
  stand_lng: 77.57598,
  stand_alt: 900,
  face_bearing_deg: 47,
  view_radius_max_m: 60,
  geo_lat: 12.9628,
  geo_lng: 77.5759,
  geo_alt: 900.5,
  geo_qx: 0,
  geo_qy: 0.38,
  geo_qz: 0,
  geo_qw: 0.92,
  cloud_anchor_id: 'ua-cloud-1',
  cloud_anchor_expiry: '2027-08-15T00:00:00Z',
  model_id: 'bangalore_fort_recon_v2',
  model_scale: 1,
  captured_horiz_acc_m: 2.4,
  captured_yaw_acc_deg: 7,
};

let mockStationsResponse: any = {success: true, data: {stations: [STATION]}};
jest.mock('../../src/utils/api/ar', () => ({
  listViewingStations: jest.fn(() => Promise.resolve(mockStationsResponse)),
}));

jest.mock('../../src/services/glbSource', () => ({
  resolveModelGlb: jest.fn(() => Promise.resolve('file:///fort.glb')),
}));

let mockCurrentLocation: {latitude: number; longitude: number} | null = null;
const mockEnsureLocationTracking = jest.fn(() => Promise.resolve());
jest.mock('../../src/stores/placesStore', () => ({
  usePlacesStore: (selector: (s: any) => unknown) =>
    selector({currentLocation: mockCurrentLocation, ensureLocationTracking: mockEnsureLocationTracking}),
}));

jest.mock('../../src/shared/hooks/useARCapability', () => ({
  useARCapability: () => ({capability: 'ready'}),
  isNonArCapability: () => false,
}));
jest.mock('../../src/shared/hooks/useARSafetyGate', () => ({
  useARSafetyGate: () => ({acknowledged: true, acknowledge: jest.fn(), exit: jest.fn()}),
}));
jest.mock('../../src/shared/hooks/useHeading', () => ({
  useHeading: () => ({heading: 0}),
}));
jest.mock('../../src/shared/hooks/useActiveMonument', () => ({
  useActiveMonument: () => ({slug: 'bangalore-fort'}),
}));
jest.mock('../../src/shared/auth/isAdminUser', () => ({
  isAdminUser: () => false,
}));
jest.mock('react-i18next', () => ({
  // Echo the key so assertions read against something stable rather than copy.
  useTranslation: () => ({t: (k: string) => k}),
}));
jest.mock('react-native-safe-area-context', () => {
  const {View} = require('react-native');
  return {SafeAreaView: View, useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0})};
});
jest.mock('lucide-react-native', () => ({X: () => null}));
// The two notices pull in linear-gradient/svg, which this project does not
// transform for Jest. Neither renders in these tests (the safety gate is already
// acknowledged and the device reports as AR-capable), so stub them rather than
// widen transformIgnorePatterns for the whole repo.
jest.mock('../../src/components/ui/ARSafetyNotice', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/ui/ARCapabilityNotice', () => ({
  __esModule: true,
  default: () => null,
}));

import SiteReconstructionScreen from '../../src/screens/Main/SiteReconstructionScreen';

// ── helpers ─────────────────────────────────────────────────────────────────
function texts(root: ReactTestInstance): string[] {
  return root
    .findAllByType(Text)
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children))
    .filter((s): s is string => typeof s === 'string');
}

/** The pressable whose rendered text contains `needle`. */
function pressableWith(root: ReactTestInstance, needle: string) {
  return root
    .findAll(
      n =>
        typeof n.props?.onPress === 'function' &&
        texts(n).some(s => s.includes(needle)),
      {deep: true},
    )
    .pop();
}

async function mount() {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <SiteReconstructionScreen
        route={{params: {venueSlug: 'bangalore-fort'}} as any}
        navigation={{replace: jest.fn(), goBack: jest.fn()} as any}
      />,
    );
  });
  return r;
}

beforeEach(() => {
  mockNativeCalls.placeGeospatialAnchor = [];
  mockNativeCalls.resolveCloudAnchor = [];
  mockNativeCalls.placeDiscoveryCards = [];
  mockNativeCalls.setTapTargets = [];
  mockArProps = null;
  mockCurrentLocation = null;
  mockStationsResponse = {success: true, data: {stations: [STATION]}};
  mockEnsureLocationTracking.mockClear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('visitor chain', () => {
  it('starts location tracking instead of assuming another screen did', async () => {
    // Reached cold — deep link, process restart in the car park — nothing else has
    // asked for a fix, so without this the screen waits for a location forever.
    await mount();
    expect(mockEnsureLocationTracking).toHaveBeenCalled();
  });

  it('says so plainly when no station has been authored', async () => {
    mockStationsResponse = {success: true, data: {stations: []}};
    const r = await mount();
    expect(texts(r.root)).toContain('reconstruction.none');
  });

  it('guides from out of range without opening the camera', async () => {
    // ~250 m away.
    mockCurrentLocation = {latitude: 12.9650, longitude: 77.5760};
    const r = await mount();
    expect(texts(r.root).some(s => s.startsWith('reconstruction.away'))).toBe(true);
    expect(mockArProps).toBeNull();
    expect(mockNativeCalls.placeGeospatialAnchor).toHaveLength(0);
  });

  it('offers an escape when GPS says out of range and waiting has failed', async () => {
    // THE bug that ended a site visit: the range test is a GPS test, GPS at this
    // fort errs by 20 m, and `showAr` keys off the range test — so the visitor
    // stood at the monument being told to walk to it, with no camera on screen to
    // argue with. There must be a way through.
    mockCurrentLocation = {latitude: 12.9650, longitude: 77.5760};
    const r = await mount();
    expect(pressableWith(r.root, 'reconstruction.showAnyway')).toBeUndefined();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(12_000);
    });
    const escape = pressableWith(r.root, 'reconstruction.showAnyway');
    expect(escape).toBeDefined();

    await ReactTestRenderer.act(async () => {
      escape!.props.onPress();
    });
    // The camera opens. Placement still waits for Earth TRACKING — that is a real
    // ARCore requirement (createAnchor refuses without it), not a gate we chose.
    expect(mockArProps).not.toBeNull();
    expect(mockNativeCalls.placeGeospatialAnchor).toHaveLength(0);

    // Earth arrives, tracking but with a POOR fix — well outside the 3 m / 12 deg
    // ideal. The override must carry through it, or the escape only moved the
    // dead end one step further along.
    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialState({
        earthState: 'ENABLED',
        trackingState: 'TRACKING',
        horizontalAccuracy: 14.2,
        orientationYawAccuracy: 31,
      });
    });
    // Placed at the AUTHORED pose — not at the visitor's GPS position, which is
    // the whole point of the geospatial anchor.
    expect(mockNativeCalls.placeGeospatialAnchor).toHaveLength(1);
    expect(mockNativeCalls.placeGeospatialAnchor[0]).toEqual([
      STATION.geo_lat,
      STATION.geo_lng,
      STATION.geo_alt,
      STATION.geo_qx,
      STATION.geo_qy,
      STATION.geo_qz,
      STATION.geo_qw,
    ]);
  });

  it('reaches a target even when a GPS fix never arrives', async () => {
    // No fix at all: without a fallback there is no model id to resolve and no
    // pose to place, so the override releases the range gate onto nothing.
    mockCurrentLocation = null;
    const r = await mount();
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(12_000);
    });
    const escape = pressableWith(r.root, 'reconstruction.showAnyway');
    expect(escape).toBeDefined();
    await ReactTestRenderer.act(async () => {
      escape!.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialState({
        earthState: 'ENABLED',
        trackingState: 'TRACKING',
        horizontalAccuracy: 9,
        orientationYawAccuracy: 20,
      });
    });
    expect(mockNativeCalls.placeGeospatialAnchor).toHaveLength(1);
  });

  it('locks, snaps to the cloud anchor and hangs the discovery layer', async () => {
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    const r = await mount();
    // In range, but the accuracy gate still holds it until Earth is good.
    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialState({
        earthState: 'ENABLED',
        trackingState: 'TRACKING',
        horizontalAccuracy: 2.0,
        orientationYawAccuracy: 6,
      });
    });
    expect(mockNativeCalls.placeGeospatialAnchor).toHaveLength(1);

    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialAnchorEvent({phase: 'place', state: 'SUCCESS'});
    });
    expect(mockNativeCalls.resolveCloudAnchor[0]).toEqual([STATION.cloud_anchor_id]);
    expect(mockNativeCalls.placeDiscoveryCards.length).toBeGreaterThan(0);
    expect(mockNativeCalls.setTapTargets.length).toBeGreaterThan(0);
    expect(texts(r.root)).toContain(STATION.title);
  });

  it('re-hangs the layer when the cloud anchor replaces the geospatial one', async () => {
    // The resolve clears the current anchor, taking the cards with it. This was a
    // real bug: the fort locked and the twenty cards silently vanished.
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    await mount();
    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialState({
        earthState: 'ENABLED',
        trackingState: 'TRACKING',
        horizontalAccuracy: 2.0,
        orientationYawAccuracy: 6,
      });
      mockArProps!.onGeospatialAnchorEvent({phase: 'place', state: 'SUCCESS'});
    });
    const before = mockNativeCalls.placeDiscoveryCards.length;
    await ReactTestRenderer.act(async () => {
      mockArProps!.onCloudAnchorEvent({phase: 'resolve', state: 'SUCCESS'});
    });
    expect(mockNativeCalls.placeDiscoveryCards.length).toBeGreaterThan(before);
  });

  it('skips an expired cloud anchor but still shows the reconstruction', async () => {
    // Degraded, never absent — the geospatial pose stands on its own.
    mockStationsResponse = {
      success: true,
      data: {
        stations: [{...STATION, cloud_anchor_expiry: '2020-01-01T00:00:00Z'}],
      },
    };
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    await mount();
    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialState({
        earthState: 'ENABLED',
        trackingState: 'TRACKING',
        horizontalAccuracy: 2.0,
        orientationYawAccuracy: 6,
      });
      mockArProps!.onGeospatialAnchorEvent({phase: 'place', state: 'SUCCESS'});
    });
    expect(mockNativeCalls.resolveCloudAnchor).toHaveLength(0);
    expect(mockNativeCalls.placeDiscoveryCards.length).toBeGreaterThan(0);
  });

  it('returns to guiding when the placement fails, rather than hanging', async () => {
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    const r = await mount();
    await ReactTestRenderer.act(async () => {
      mockArProps!.onGeospatialState({
        earthState: 'ENABLED',
        trackingState: 'TRACKING',
        horizontalAccuracy: 2.0,
        orientationYawAccuracy: 6,
      });
      mockArProps!.onGeospatialAnchorEvent({
        phase: 'place',
        state: 'ERROR_EARTH_NOT_TRACKING',
      });
    });
    expect(texts(r.root).some(s => s.startsWith('reconstruction.'))).toBe(true);
    expect(mockNativeCalls.placeDiscoveryCards).toHaveLength(0);
  });

  it('does not arm depth it has no use for', async () => {
    // Arming depthMode makes ARCore run depth inference every frame. With occlusion
    // off, that result was computed and discarded for the whole session — pure heat.
    // This is the assertion that turns "we left an expensive subsystem on" into a
    // desk failure rather than a phone shutting down at a monument.
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    await mount();
    expect(mockArProps!.depthArmed).toBeFalsy();
    expect(mockArProps!.depthOcclusionEnabled).toBe(false);
  });

  it('does not force depth occlusion on at reconstruction range', async () => {
    // ARCore depth is trustworthy to about 5 m; a viewing station stands 20-40 m
    // back. Forced on, the occlusion test culled the whole model and the visitor
    // saw nothing. Proven at Bangalore Fort 2026-08-15.
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    await mount();
    expect(mockArProps!.depthOcclusionEnabled).toBe(false);
  });

  it('keeps the surveyed metres instead of normalising the fort to half a metre', async () => {
    mockCurrentLocation = {latitude: STATION.stand_lat, longitude: STATION.stand_lng};
    await mount();
    expect(mockArProps!.modelTrueScale).toBe(true);
    expect(mockArProps!.modelScale).toBe(1);
  });
});
