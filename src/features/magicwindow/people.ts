/**
 * The people of Bangalore Fort — who stood here, and on whose authority we say so.
 *
 * EVERY line a figure speaks is tiered exactly like a dimension. A reconstruction
 * that invents a person's words is doing the same thing as one that invents a
 * wall height, and it is harder to spot, because a quoted sentence carries more
 * conviction than a number.
 *
 * WHO WAS ACTUALLY HERE. Tipu Sultan did NOT defend Bangalore Fort in March 1791
 * — he was campaigning, and the citadel was held for him by an appointed
 * governor. Placing him at the breach would be a plain historical error and the
 * kind that spreads. What IS recorded is that he inspected the place.
 */

export interface MagicWindowPerson {
  id: string;
  /** Model id resolved through glbSource (CloudFront → cache → bundled). */
  modelId: string;
  name: string;
  /** One line under the name, shown before they speak. */
  role: string;
  /** Where they stand, authored plan frame: [east, north] metres. */
  position: [number, number];
  /** Compass bearing they face. */
  headingDeg: number;
  /** What they say. Every entry carries its tier and source. */
  lines: {
    text: string;
    tier: 'CONFIRMED' | 'INFERRED' | 'DISPUTED' | 'NOT-A-CLAIM';
    source: string;
  }[];
}

export const MAGIC_WINDOW_PEOPLE: MagicWindowPerson[] = [
  {
    id: 'tipu_inspecting',
    modelId: 'tipu_figure_royal9',
    name: 'Tipu Sultan',
    role: 'inspecting the forts of Bangalore',
    // Just inside the Delhi Gate, on the axis of the entry, facing the gate —
    // where somebody inspecting the defences would stand and look back out.
    position: [0, -14],
    headingDeg: 0,
    lines: [
      {
        text:
          'He came here to look at the walls. His own record has him "making a ' +
          'progress, slightly attended, for the purpose of inspecting the forts ' +
          'of Bangalore".',
        tier: 'CONFIRMED',
        source: "Tipu Sultan's letters; phaseA-addendum.md §4",
      },
      {
        text:
          'His orders about this place are a governor’s, not a soldier’s — to ' +
          'employ the labourers belonging to the fort in building quarters, to ' +
          'see to the provisioning of it in good time, and "to examine carefully ' +
          'into all affairs relating to the fort".',
        tier: 'CONFIRMED',
        source: 'Letter CCCXXIV, to Ghulam Husain Khan, Munshoor of Bangalore',
      },
      {
        text:
          'He was not here when it fell. On the night of 21 March 1791 the ' +
          'citadel was held for him by Bahadur Khan, once Foujdar of Kishingiri, ' +
          'whom he had appointed governor of the upper fort.',
        tier: 'CONFIRMED',
        source: 'phaseA-addendum.md §4, quoting the appointment directly',
      },
      {
        text:
          'The stone you are standing in front of is older than him. The fort ' +
          'was rebuilt in stone in 1761 by the killedar Ibrahim Sahib, in the ' +
          'first year of Hyder Ali’s reign.',
        tier: 'CONFIRMED',
        source: 'Rice 1897 Vol. II, printed p.46',
      },
    ],
  },
  {
    id: 'garrison_soldier_breach',
    modelId: 'garrison_soldier_v2',
    name: 'A soldier of the garrison',
    role: 'one of the men who held the upper fort',
    // Just inside the breach, in view of VP5, turned back toward the visitor.
    position: [3.4, 37.7],
    headingDeg: 326,
    lines: [
      {
        text:
          'I am not a portrait of anybody. No likeness of any man who defended ' +
          'this fort survives. What you can trust is the clothing: it is copied ' +
          'from a study made by Robert Home, who was with the army here.',
        tier: 'NOT-A-CLAIM',
        source:
          'Home, Robert (1752-1834), study of a soldier of Tipu Sultan’s army, ' +
          '1793-94. V&A O68017, public domain',
      },
      {
        text:
          'The long coat with the white spots is the one the Company officers ' +
          'called a Tyger Jacket. With it went a red and white muslin turban ' +
          'and a red sash at the waist. My feet are bare because his were.',
        tier: 'CONFIRMED',
        source: 'Home 1793-94; contemporary description of Tipu’s infantry dress',
      },
      {
        text:
          'The man who commanded here was Bahadur Khan, once Foujdar of ' +
          'Kishingiri, appointed by Tipu as governor of the upper fort. He did ' +
          'not leave it. He was killed defending this breach.',
        tier: 'CONFIRMED',
        source: 'phaseA-addendum.md §4, quoting the appointment directly',
      },
      {
        text:
          'It was opened on the night of 21 March 1791, by engineers under ' +
          'Captain Kyd. The struck stretch of wall runs 158.3 metres away east ' +
          'of you. The shape of the breach itself is not modelled — no source ' +
          'records it, so we have not invented it.',
        tier: 'CONFIRMED',
        source: 'Siege narrative; breach geometry ILLEGIBLE on RCIN 735001',
      },
    ],
  },
];


/**
 * PHASE 4 BLOCKING TEST — Khronos CesiumMan.
 *
 * The brief requires proving the renderer plays glTF skeletal animation BEFORE
 * anything is generated. This is the free Khronos reference sample: 1 skin, 19
 * joints, 1 animation, 57 channels, JOINTS_0 present — verified by parsing the
 * GLB, not assumed.
 *
 * It is a TEST FIXTURE, never a heritage claim. It is deliberately kept out of
 * MAGIC_WINDOW_PEOPLE so it can never be mistaken for someone who stood here.
 */
export const RIG_TEST_MODEL_ID = 'khronos_cesium_man';

/** Placed on the avenue, well clear of anything evidenced. */
export const RIG_TEST_PLACEMENT = {east: 40, north: -300, heading: 0};
