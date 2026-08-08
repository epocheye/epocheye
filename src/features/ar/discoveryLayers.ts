/**
 * Authored AR discovery layers, keyed by venue slug.
 *
 * Poses are in the ANCHOR'S OWN local frame — the same right-handed, Y-up, metres
 * frame as the site's GLB, origin at the intersection of the two measured wall
 * lines at ground level. The station's captured geospatial pose is what orients
 * that frame on the earth, so nothing here needs a true north (the photogrammetry
 * capture never yielded one — see research/AR-discovery-layer-record.md).
 *
 * GENERATED from heritage_assets/bangalore-fort/output/ar_cards_manifest.json and
 * ar_tap_targets.json. Do not hand-edit; regenerate with scratchpad/make_manifest.py.
 */

/** One card: pose + the text drawn by EpocheyeArCardRenderer.renderDiscovery. */
export interface DiscoveryCard {
  id: string;
  /** metres, anchor-local */
  x: number;
  y: number;
  z: number;
  /** degrees about +Y; the direction the card faces */
  yaw: number;
  /** card width in metres */
  w: number;
  title: string;
  /** evidence tier and source, e.g. "CONFIRMED · C. Mackenzie 1791, key 4" */
  meta: string;
  body: string;
  accent: 'green' | 'muted';
}

/** A named part of the reconstruction a tap can resolve to. */
export interface TapTarget {
  id: string;
  label: string;
  /** [x, y, z] metres, anchor-local */
  min: [number, number, number];
  max: [number, number, number];
}

export interface DiscoveryLayer {
  cards: DiscoveryCard[];
  tapTargets: TapTarget[];
}

const LAYERS: Record<string, DiscoveryLayer> = {
  'bangalore-fort': {
    cards: [
          {
                "id": "bfort_card_nomortar",
                "x": 9.119,
                "y": 1.45,
                "z": 7.385,
                "yaw": 138.8,
                "w": 1.75,
                "title": "There Is No Mortar Line",
                "meta": "CONFIRMED · colour measurement, 28 July 2026",
                "body": "Look at the joints in front of you. Measured in colour, the joint lines are the same stone as the block faces — thirty to thirty-eight points darker in lightness, identical in hue. They read as shadow, not as pointing.",
                "accent": "green"
          },
          {
                "id": "bfort_card_breach",
                "x": 6.729,
                "y": 2.55,
                "z": 5.293,
                "yaw": 138.8,
                "w": 1.75,
                "title": "Through This Breach",
                "meta": "CONFIRMED · Home 1794, plate 30",
                "body": "On the night of 21 March 1791 the storming party entered at the breach in the great tower. The batteries stood about 450 yards off, to the north-north-east.",
                "accent": "green"
          },
          {
                "id": "bfort_card_rampart",
                "x": 4.34,
                "y": 1.45,
                "z": 3.201,
                "yaw": 138.8,
                "w": 1.75,
                "title": "26 Feet Thick",
                "meta": "CONFIRMED · C. Mackenzie 1791, key 1",
                "body": "“Rampart […] feet high, 26 feet thick, faced with Stone.” The height is written on the sheet at Windsor and is still unread — which is why the wall above you fades out rather than ending.",
                "accent": "green"
          },
          {
                "id": "bfort_card_claycore",
                "x": 1.95,
                "y": 2.55,
                "z": 1.109,
                "yaw": 138.8,
                "w": 1.75,
                "title": "Stone Only on the Outside",
                "meta": "CORROBORATED · Home 1794 p.6; Hunter 1804",
                "body": "Watching the breaching guns, an eyewitness wrote they “soon demolished the stone facing; but the solid body of the rampart, which was of red clay, crumbled but slowly.” A period aquatint shows that reddish core as a band.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_gatesize",
                "x": -0.44,
                "y": 1.45,
                "z": -0.983,
                "yaw": 138.8,
                "w": 1.75,
                "title": "Nobody Measured This Gate",
                "meta": "UNRECORDED · documented absence, all sources",
                "body": "Passage depth, opening height and width, springing height, wall thickness. Searched through every period source and the official record, and absent from all of them. Only proportions survive — not one figure in feet or metres.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_archprofile",
                "x": -2.83,
                "y": 2.55,
                "z": -3.076,
                "yaw": 138.8,
                "w": 1.75,
                "title": "Round Arch, or Pointed?",
                "meta": "DISPUTED · Hunter 1804 vs Home 1794",
                "body": "Two artists drew this entrance differently. One shows a semicircular arch with bare voussoirs; the other a pointed, four-centred arch in an ornamented frame. Measured off the plates it runs 2.4–2.9 times taller than wide. Neither reading is averaged away.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_height",
                "x": -5.22,
                "y": 1.45,
                "z": -5.168,
                "yaw": 138.8,
                "w": 1.75,
                "title": "The Missing Number",
                "meta": "ILLEGIBLE · RCIN 735001, Windsor",
                "body": "Mackenzie wrote the rampart's height on his 1791 sheet. At the resolution we can obtain, the digits are about eight pixels tall and unreadable. That is why the wall above you stops without a top.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_batter",
                "x": -7.61,
                "y": 2.55,
                "z": -7.26,
                "yaw": 138.8,
                "w": 1.75,
                "title": "Why It Leans",
                "meta": "INFERRED · scan + photo silhouettes",
                "body": "The wall slopes back about 7 degrees as it rises — a batter. Measured two ways from the surviving fabric, not taken from a book. It sheds shot and stops the base being undermined.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_parapet",
                "x": -10.0,
                "y": 1.45,
                "z": -9.352,
                "yaw": 138.8,
                "w": 1.75,
                "title": "Five Feet High, Five Feet Thick",
                "meta": "CONFIRMED · R. Mackenzie 1799, vol. II p.43",
                "body": "The parapet along the rampart walk was five feet high and five feet thick — chest height, and as deep as it was tall. Cover to crouch behind and fire over, not a walled chamber.",
                "accent": "green"
          },
          {
                "id": "bfort_card_scan",
                "x": -12.389,
                "y": 2.55,
                "z": -11.444,
                "yaw": 138.8,
                "w": 1.75,
                "title": "What Survives",
                "meta": "MEASURED · photogrammetry, 28 July 2026",
                "body": "Everything solid here was photographed and measured. Everything above the break line is reconstruction from documents — and it fades out where the evidence does.",
                "accent": "green"
          },
          {
                "id": "bfort_card_mudfort",
                "x": -14.779,
                "y": 1.45,
                "z": -13.536,
                "yaw": 138.8,
                "w": 1.75,
                "title": "The Older Fort Sat Inside This One",
                "meta": "CONFIRMED · Buchanan, journey of 1800, printed pp.44–46",
                "body": "The stone fort is not the first fort here, and it does not follow the first one's line. A traveller in 1800 found the ruins of the older mud wall “in the centre of the fort” — a smaller enclosure standing inside this one.",
                "accent": "green"
          },
          {
                "id": "bfort_card_ditch",
                "x": 20.893,
                "y": 1.45,
                "z": -23.183,
                "yaw": 48.8,
                "w": 1.75,
                "title": "The Great Ditch",
                "meta": "CONFIRMED · C. Mackenzie 1791, key 4",
                "body": "“Great Ditch; from 110 to 100 feet broad.” About 30 metres — close to four times the thickness of the 26-foot stone rampart it defended. You are standing where it ran.",
                "accent": "green"
          },
          {
                "id": "bfort_card_ditchwater",
                "x": 18.671,
                "y": 2.55,
                "z": -20.644,
                "yaw": 48.8,
                "w": 1.75,
                "title": "A Dry Ditch That Wasn’t Quite",
                "meta": "CORROBORATED · three accounts, 1791–1799",
                "body": "Was there water in it? Mostly not — three accounts agree it was largely dry in March 1791. Yet the surveyor still marks a “Wet part of the Ditch; the water good.” “Dry moat” oversimplifies it.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_covertway",
                "x": 16.448,
                "y": 1.45,
                "z": -18.105,
                "yaw": 48.8,
                "w": 1.75,
                "title": "The Covert Way",
                "meta": "CONFIRMED, conditional · C. Mackenzie 1791, key 6",
                "body": "“Reduced to 20 feet broad where the ditch is widened.” A floor, not a figure — the general breadth is unrecorded, so the defences ran deeper than the numbers we can prove.",
                "accent": "green"
          },
          {
                "id": "bfort_card_faussebraye",
                "x": 14.225,
                "y": 2.55,
                "z": -15.566,
                "yaw": 48.8,
                "w": 1.75,
                "title": "The Lower Work",
                "meta": "CONFIRMED material, UNRECORDED width · C. Mackenzie 1791, key 3",
                "body": "“Fausse Braye, faced with stone; the parapet of mud, 6 feet high.” We know what it was made of and how tall its parapet stood. Nobody recorded how wide it was.",
                "accent": "green"
          },
          {
                "id": "bfort_card_gates",
                "x": 12.003,
                "y": 1.45,
                "z": -13.028,
                "yaw": 48.8,
                "w": 1.75,
                "title": "Two Gates, Not Six",
                "meta": "CONFIRMED · four independent sources",
                "body": "Delhi Gate to the north, Mysore Gate to the south. The six-gate list on the site board conflates the fort with the pete that once surrounded it.",
                "accent": "green"
          },
          {
                "id": "bfort_card_plan_egg",
                "x": 9.78,
                "y": 2.55,
                "z": -10.489,
                "yaw": 48.8,
                "w": 1.75,
                "title": "An Egg, Not an Oval",
                "meta": "CONFIRMED · R. Mackenzie 1799, vol. II p.43",
                "body": "An officer at the siege wrote the fort “in shape approaches an egg, although by the model it appears to have been originally designed for an exact oval.” One end blunter than the other. That model has never been found.",
                "accent": "green"
          },
          {
                "id": "bfort_card_cavaliers",
                "x": 7.558,
                "y": 1.45,
                "z": -7.95,
                "yaw": 48.8,
                "w": 1.75,
                "title": "Five Cavaliers",
                "meta": "CONFIRMED · C. Mackenzie 1791, key 9",
                "body": "Five raised platforms, five guns apiece, overlooked the whole work — “of good masonry, parapets 12 feet thick,” strengthened with stockades on the face attacked. Where any of them stood is unrecorded.",
                "accent": "green"
          },
          {
                "id": "bfort_card_innerrampart",
                "x": 5.335,
                "y": 2.55,
                "z": -5.411,
                "yaw": 48.8,
                "w": 1.75,
                "title": "An Inner Rampart, Marked Out",
                "meta": "DISPUTED · C. Mackenzie 1791, key 2",
                "body": "The survey key records a second work: “Additional rampart 20 feet high; with embrazures marked out, to be opened as occasion may require.” Marked out, not opened — it may have been proposed rather than built.",
                "accent": "muted"
          },
          {
                "id": "bfort_card_retrench",
                "x": 3.112,
                "y": 1.45,
                "z": -2.872,
                "yaw": 48.8,
                "w": 1.75,
                "title": "They Were Still Digging",
                "meta": "CONFIRMED · C. Mackenzie 1791, key p.p",
                "body": "The garrison was still cutting defences when the storm came. The engineer’s key has the attackers “crossing the retrenchments lately made by the enemy 15 feet wide” — trenches thrown up inside the walls in the last days.",
                "accent": "green"
          }
    ],
    tapTargets: [
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -2.92,
                      7.37,
                      -16.46
                ],
                "max": [
                      -0.7,
                      12.43,
                      -14.35
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -5.22,
                      7.37,
                      -16.45
                ],
                "max": [
                      -1.0,
                      12.43,
                      -14.35
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -6.89,
                      7.37,
                      -16.69
                ],
                "max": [
                      -3.89,
                      12.43,
                      -14.56
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -8.49,
                      7.37,
                      -22.9
                ],
                "max": [
                      -1.42,
                      12.43,
                      -14.99
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -9.99,
                      7.37,
                      -22.91
                ],
                "max": [
                      -2.26,
                      12.43,
                      -15.65
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -10.92,
                      7.37,
                      -23.66
                ],
                "max": [
                      -4.26,
                      12.43,
                      -16.52
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -12.18,
                      7.37,
                      -24.53
                ],
                "max": [
                      -5.63,
                      12.43,
                      -17.21
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -13.26,
                      7.37,
                      -20.86
                ],
                "max": [
                      -10.75,
                      12.43,
                      -18.4
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      6.13,
                      7.37,
                      -21.64
                ],
                "max": [
                      8.07,
                      12.43,
                      -20.18
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      0.39,
                      7.37,
                      -24.84
                ],
                "max": [
                      7.77,
                      12.43,
                      -18.79
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -0.66,
                      7.37,
                      -24.2
                ],
                "max": [
                      6.74,
                      12.43,
                      -17.55
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -1.55,
                      7.37,
                      -23.31
                ],
                "max": [
                      5.53,
                      12.43,
                      -16.49
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      1.26,
                      7.37,
                      -18.1
                ],
                "max": [
                      4.16,
                      12.43,
                      -15.63
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -0.44,
                      7.37,
                      -17.37
                ],
                "max": [
                      3.1,
                      12.43,
                      -14.98
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -1.0,
                      7.37,
                      -16.68
                ],
                "max": [
                      1.24,
                      12.43,
                      -14.55
                ]
          },
          {
                "id": "bangalore-fort-bastion",
                "label": "The Bastions",
                "min": [
                      -1.25,
                      7.37,
                      -14.96
                ],
                "max": [
                      -0.62,
                      11.36,
                      -14.46
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.79,
                      10.67,
                      -5.18
                ],
                "max": [
                      0.37,
                      11.13,
                      0.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -4.45,
                      11.01,
                      -4.0
                ],
                "max": [
                      0.37,
                      11.13,
                      0.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.79,
                      10.67,
                      -5.18
                ],
                "max": [
                      0.37,
                      11.01,
                      0.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.6,
                      11.01,
                      -10.32
                ],
                "max": [
                      0.2,
                      12.53,
                      -4.0
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -4.82,
                      11.01,
                      -10.32
                ],
                "max": [
                      -0.94,
                      12.53,
                      -5.89
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      16.62,
                      10.67,
                      -31.72
                ],
                "max": [
                      23.6,
                      12.53,
                      -26.33
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      16.21,
                      11.01,
                      -31.55
                ],
                "max": [
                      18.79,
                      12.53,
                      -28.91
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      15.19,
                      11.01,
                      -29.91
                ],
                "max": [
                      17.36,
                      12.53,
                      -27.74
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      13.76,
                      11.01,
                      -28.28
                ],
                "max": [
                      15.93,
                      12.53,
                      -26.11
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      12.33,
                      11.01,
                      -27.11
                ],
                "max": [
                      14.91,
                      12.53,
                      -24.48
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      11.92,
                      11.01,
                      -26.65
                ],
                "max": [
                      14.5,
                      12.53,
                      -24.01
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      10.9,
                      11.01,
                      -25.01
                ],
                "max": [
                      13.07,
                      12.53,
                      -22.84
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.79,
                      7.47,
                      -31.82
                ],
                "max": [
                      23.6,
                      12.53,
                      0.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      8.04,
                      11.01,
                      -22.22
                ],
                "max": [
                      10.62,
                      12.53,
                      -19.58
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      7.63,
                      11.01,
                      -21.75
                ],
                "max": [
                      10.21,
                      12.53,
                      -19.11
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      6.61,
                      11.01,
                      -20.12
                ],
                "max": [
                      8.78,
                      12.53,
                      -17.95
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      5.18,
                      11.01,
                      -18.48
                ],
                "max": [
                      7.35,
                      12.53,
                      -16.31
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      4.78,
                      11.01,
                      -18.48
                ],
                "max": [
                      7.35,
                      12.53,
                      -15.85
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      3.75,
                      11.01,
                      -16.85
                ],
                "max": [
                      5.92,
                      12.53,
                      -14.68
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      2.32,
                      11.01,
                      -15.22
                ],
                "max": [
                      4.49,
                      12.53,
                      -13.05
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.91,
                      7.47,
                      -31.82
                ],
                "max": [
                      23.6,
                      12.53,
                      0.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      0.49,
                      11.01,
                      -13.59
                ],
                "max": [
                      3.06,
                      12.53,
                      -10.95
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -0.53,
                      11.01,
                      -11.95
                ],
                "max": [
                      1.63,
                      12.53,
                      -9.78
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -0.94,
                      11.01,
                      -10.32
                ],
                "max": [
                      0.2,
                      12.53,
                      -8.15
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      5.62,
                      5.39,
                      9.49
                ],
                "max": [
                      12.0,
                      11.52,
                      16.47
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      4.45,
                      5.39,
                      8.47
                ],
                "max": [
                      10.84,
                      11.52,
                      15.45
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      3.29,
                      5.39,
                      7.45
                ],
                "max": [
                      9.67,
                      11.52,
                      14.43
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      2.12,
                      5.39,
                      6.43
                ],
                "max": [
                      8.51,
                      11.52,
                      13.41
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      0.96,
                      5.39,
                      5.41
                ],
                "max": [
                      7.34,
                      11.52,
                      12.39
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -0.2,
                      5.39,
                      4.39
                ],
                "max": [
                      6.18,
                      11.99,
                      11.37
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.29,
                      5.39,
                      3.37
                ],
                "max": [
                      5.02,
                      11.99,
                      11.26
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.29,
                      5.39,
                      2.36
                ],
                "max": [
                      3.85,
                      11.99,
                      11.26
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -3.69,
                      5.39,
                      5.7
                ],
                "max": [
                      -1.13,
                      11.52,
                      8.32
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.29,
                      7.39,
                      5.27
                ],
                "max": [
                      -2.29,
                      13.52,
                      7.44
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -7.18,
                      5.39,
                      2.65
                ],
                "max": [
                      -4.62,
                      10.51,
                      5.26
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -8.35,
                      5.39,
                      1.63
                ],
                "max": [
                      -5.79,
                      11.52,
                      4.24
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -9.51,
                      5.39,
                      -9.85
                ],
                "max": [
                      1.95,
                      11.52,
                      3.23
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -10.67,
                      5.39,
                      -10.86
                ],
                "max": [
                      0.78,
                      13.52,
                      2.21
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -11.84,
                      5.39,
                      -11.88
                ],
                "max": [
                      -0.38,
                      13.52,
                      1.19
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -13.0,
                      5.39,
                      -12.9
                ],
                "max": [
                      -1.54,
                      11.52,
                      0.17
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -14.16,
                      5.39,
                      -13.92
                ],
                "max": [
                      -2.71,
                      11.52,
                      -0.85
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -15.33,
                      5.39,
                      -14.94
                ],
                "max": [
                      -3.87,
                      11.52,
                      -1.87
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -16.49,
                      5.39,
                      -15.96
                ],
                "max": [
                      -5.03,
                      11.52,
                      -2.89
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -17.65,
                      5.39,
                      -10.89
                ],
                "max": [
                      -11.27,
                      11.52,
                      -3.9
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -18.82,
                      5.39,
                      -11.9
                ],
                "max": [
                      -12.43,
                      11.52,
                      -4.92
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -19.98,
                      5.39,
                      -12.92
                ],
                "max": [
                      -13.6,
                      11.52,
                      -5.94
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -21.14,
                      5.39,
                      -13.94
                ],
                "max": [
                      -14.76,
                      11.52,
                      -6.96
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -22.31,
                      5.39,
                      -14.96
                ],
                "max": [
                      -15.92,
                      11.52,
                      -7.98
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -23.47,
                      5.39,
                      -15.98
                ],
                "max": [
                      -17.09,
                      11.52,
                      -9.0
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      16.42,
                      7.39,
                      -31.95
                ],
                "max": [
                      23.4,
                      13.52,
                      -25.56
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      15.4,
                      7.39,
                      -30.78
                ],
                "max": [
                      22.38,
                      13.52,
                      -24.4
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      14.38,
                      7.39,
                      -29.62
                ],
                "max": [
                      21.36,
                      13.52,
                      -23.23
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      13.36,
                      7.39,
                      -28.45
                ],
                "max": [
                      20.34,
                      13.52,
                      -22.07
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      12.33,
                      7.39,
                      -27.29
                ],
                "max": [
                      19.32,
                      13.52,
                      -20.9
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      11.31,
                      7.39,
                      -26.12
                ],
                "max": [
                      18.3,
                      13.52,
                      -19.74
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      10.29,
                      7.39,
                      -24.96
                ],
                "max": [
                      17.28,
                      13.52,
                      -18.57
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      9.27,
                      7.39,
                      -23.79
                ],
                "max": [
                      16.26,
                      13.52,
                      -17.4
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      8.25,
                      7.39,
                      -22.62
                ],
                "max": [
                      15.24,
                      13.52,
                      -16.24
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      7.23,
                      7.39,
                      -21.46
                ],
                "max": [
                      14.22,
                      13.52,
                      -15.07
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      6.21,
                      7.39,
                      -20.29
                ],
                "max": [
                      13.2,
                      13.52,
                      -13.91
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      5.19,
                      7.39,
                      -19.13
                ],
                "max": [
                      12.17,
                      13.52,
                      -12.74
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      4.17,
                      7.39,
                      -17.96
                ],
                "max": [
                      11.15,
                      13.52,
                      -11.58
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      3.15,
                      7.39,
                      -16.8
                ],
                "max": [
                      10.13,
                      13.52,
                      -10.41
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      2.13,
                      7.39,
                      -15.63
                ],
                "max": [
                      9.11,
                      13.52,
                      -9.24
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      1.11,
                      7.39,
                      -14.46
                ],
                "max": [
                      8.09,
                      13.52,
                      -8.08
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      0.09,
                      7.39,
                      -13.3
                ],
                "max": [
                      7.07,
                      13.52,
                      -6.91
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -0.93,
                      5.39,
                      -12.13
                ],
                "max": [
                      6.05,
                      13.52,
                      -5.75
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -1.95,
                      7.39,
                      -10.97
                ],
                "max": [
                      5.03,
                      13.52,
                      -4.58
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -2.97,
                      7.39,
                      -9.8
                ],
                "max": [
                      4.01,
                      11.99,
                      -3.42
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.29,
                      5.39,
                      5.83
                ],
                "max": [
                      -3.3,
                      13.52,
                      7.44
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      5.59,
                      0.0,
                      9.46
                ],
                "max": [
                      12.0,
                      5.39,
                      16.47
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      4.4,
                      0.0,
                      8.42
                ],
                "max": [
                      10.81,
                      5.39,
                      15.43
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      3.21,
                      0.0,
                      7.38
                ],
                "max": [
                      9.62,
                      5.39,
                      14.39
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      2.02,
                      0.0,
                      6.34
                ],
                "max": [
                      8.43,
                      5.39,
                      13.35
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      0.84,
                      0.0,
                      5.3
                ],
                "max": [
                      7.24,
                      5.39,
                      12.31
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -0.35,
                      0.0,
                      4.26
                ],
                "max": [
                      6.06,
                      5.39,
                      11.26
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -1.54,
                      0.0,
                      3.22
                ],
                "max": [
                      4.87,
                      5.39,
                      10.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -2.73,
                      0.0,
                      2.18
                ],
                "max": [
                      3.68,
                      5.39,
                      9.18
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -3.92,
                      0.0,
                      1.14
                ],
                "max": [
                      2.49,
                      5.39,
                      8.14
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.11,
                      0.0,
                      0.1
                ],
                "max": [
                      1.3,
                      5.39,
                      7.1
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -6.29,
                      0.0,
                      -0.94
                ],
                "max": [
                      0.11,
                      5.39,
                      6.06
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -7.48,
                      0.0,
                      -1.98
                ],
                "max": [
                      -1.07,
                      5.39,
                      5.02
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -8.67,
                      0.0,
                      -3.02
                ],
                "max": [
                      -2.26,
                      5.39,
                      3.98
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -9.86,
                      0.0,
                      -4.06
                ],
                "max": [
                      -3.45,
                      5.39,
                      2.94
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -11.05,
                      0.0,
                      -5.1
                ],
                "max": [
                      -4.64,
                      5.39,
                      1.9
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -12.24,
                      0.0,
                      -6.14
                ],
                "max": [
                      -5.83,
                      5.39,
                      0.86
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -13.42,
                      0.0,
                      -7.18
                ],
                "max": [
                      -7.02,
                      5.39,
                      -0.18
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -14.61,
                      0.0,
                      -8.22
                ],
                "max": [
                      -8.2,
                      5.39,
                      -1.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -15.8,
                      0.0,
                      -9.26
                ],
                "max": [
                      -9.39,
                      5.39,
                      -2.26
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -16.99,
                      0.0,
                      -10.3
                ],
                "max": [
                      -10.58,
                      5.39,
                      -3.3
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -18.18,
                      0.0,
                      -11.34
                ],
                "max": [
                      -11.77,
                      5.39,
                      -4.34
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -19.37,
                      0.0,
                      -12.38
                ],
                "max": [
                      -12.96,
                      5.39,
                      -5.38
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -20.56,
                      0.0,
                      -13.43
                ],
                "max": [
                      -14.15,
                      5.39,
                      -6.42
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -21.74,
                      0.0,
                      -14.47
                ],
                "max": [
                      -15.34,
                      5.39,
                      -7.46
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -22.93,
                      0.0,
                      -15.51
                ],
                "max": [
                      -16.52,
                      5.39,
                      -8.5
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -23.47,
                      0.0,
                      -15.98
                ],
                "max": [
                      -17.71,
                      5.39,
                      -9.54
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      16.4,
                      0.0,
                      -31.95
                ],
                "max": [
                      23.4,
                      7.39,
                      -25.54
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      15.36,
                      0.0,
                      -30.76
                ],
                "max": [
                      22.36,
                      7.39,
                      -24.35
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      14.32,
                      0.0,
                      -29.57
                ],
                "max": [
                      21.32,
                      7.39,
                      -23.16
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      13.28,
                      0.0,
                      -28.38
                ],
                "max": [
                      20.28,
                      7.39,
                      -21.98
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      12.24,
                      0.0,
                      -27.2
                ],
                "max": [
                      19.24,
                      7.39,
                      -20.79
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      11.19,
                      0.0,
                      -26.01
                ],
                "max": [
                      18.2,
                      7.39,
                      -19.6
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      10.15,
                      0.0,
                      -24.82
                ],
                "max": [
                      17.16,
                      7.39,
                      -18.41
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      9.11,
                      0.0,
                      -23.63
                ],
                "max": [
                      16.12,
                      7.39,
                      -17.22
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      8.07,
                      0.0,
                      -22.44
                ],
                "max": [
                      15.08,
                      7.39,
                      -16.03
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      7.03,
                      0.0,
                      -21.25
                ],
                "max": [
                      14.04,
                      7.39,
                      -14.85
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      5.99,
                      0.0,
                      -20.07
                ],
                "max": [
                      13.0,
                      7.39,
                      -13.66
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      4.95,
                      0.0,
                      -18.88
                ],
                "max": [
                      11.96,
                      7.39,
                      -12.47
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      3.91,
                      0.0,
                      -17.69
                ],
                "max": [
                      10.92,
                      7.39,
                      -11.28
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      2.87,
                      0.0,
                      -16.5
                ],
                "max": [
                      9.87,
                      7.39,
                      -10.09
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      1.83,
                      0.0,
                      -15.31
                ],
                "max": [
                      8.83,
                      7.39,
                      -8.9
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      0.79,
                      0.0,
                      -14.12
                ],
                "max": [
                      7.79,
                      7.39,
                      -7.71
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -0.25,
                      0.0,
                      -12.93
                ],
                "max": [
                      6.75,
                      7.39,
                      -6.53
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -1.29,
                      0.0,
                      -11.75
                ],
                "max": [
                      5.71,
                      7.39,
                      -5.34
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -2.33,
                      0.0,
                      -10.56
                ],
                "max": [
                      4.67,
                      7.39,
                      -4.15
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -3.37,
                      0.0,
                      -9.37
                ],
                "max": [
                      3.63,
                      7.39,
                      -2.96
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -4.41,
                      0.0,
                      -8.18
                ],
                "max": [
                      2.59,
                      7.39,
                      -1.77
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -5.45,
                      0.0,
                      -6.99
                ],
                "max": [
                      1.55,
                      7.39,
                      -0.58
                ]
          },
          {
                "id": "bangalore-fort-rampart",
                "label": "The Rampart",
                "min": [
                      -6.03,
                      0.0,
                      -5.8
                ],
                "max": [
                      0.51,
                      7.39,
                      0.08
                ]
          }
    ],
  },
};

export function discoveryLayerFor(slug?: string | null): DiscoveryLayer | null {
  if (!slug) return null;
  return LAYERS[slug] ?? null;
}
