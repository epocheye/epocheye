/**
 * The people of the magic window — who stood here, and on whose authority we
 * say so. Keyed by site, because there is now more than one.
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
  /**
   * Floor level they stand on, metres, default 0. The fort has one ground
   * plane; the palace is two-storey in the same frame — ground colonnade 0.0,
   * darbar hall 2.60 — so anyone upstairs must say so or they stand through
   * the floor into the colonnade below.
   */
  floorM?: number;
  /** Bearing they face, in the same convention as the scene's viewpoints. */
  headingDeg: number;
  /**
   * Viewpoint ids this person can actually be SEEN from. Optional; omitted
   * means "assume visible", which is what the fort wants — one figure on one
   * open ground plane. The palace needs it: Purnaiah stands on the first
   * floor, and from the ground colonnade he is behind a ceiling. Without this
   * the "someone is here" prompt points at a man in another storey.
   */
  visibleFrom?: string[];
  /**
   * CDN key prefix for this figure's recorded lines, if they have been voiced.
   * Line n (1-based) is `${voiceKeyPrefix}line_${n}_${lang}.mp3`, resolved
   * through buildAudioUrl like any other clip.
   *
   * WHY RECORDED AND NOT SYNTHESISED ON THE DEVICE. The alternative — and what
   * this replaces for Purnaiah — is Android's own TextToSpeech (SpeechModule.kt).
   * That is whatever voice the handset ships, it differs between phones, and it
   * shares nothing with the guide narration the visitor has had in their ears
   * for the previous six stops. A figure who sounds like a satnav mid-guide is
   * worse than a figure who says nothing.
   *
   * Recorded in en-IN-Chirp3-HD-Achird, deliberately a different voice from the
   * guide's Aoede: he is a person being quoted, not the narrator.
   *
   * OMITTED means fall back to device TTS, which is what the fort's Tipu figure
   * still does. Removing that fallback would silence him.
   */
  voiceKeyPrefix?: string;
  /** What they say. Every entry carries its tier and source. */
  lines: {
    text: string;
    tier: 'CONFIRMED' | 'INFERRED' | 'DISPUTED' | 'NOT-A-CLAIM';
    source: string;
  }[];
}

const FORT_PEOPLE: MagicWindowPerson[] = [
  {
    id: 'tipu_inspecting',
    modelId: 'tipu_figure_royal9',
    name: 'Tipu Sultan',
    role: 'inspecting the forts of Bangalore',
    // Just inside the Delhi Gate, on the axis of the entry, facing the gate —
    // where somebody inspecting the defences would stand and look back out.
    position: [0, -14],
    headingDeg: 0,
    /**
     * VP2 ONLY, AND IT IS THE LEAST BAD CHOICE RATHER THAN A GOOD ONE.
     *
     * This list exists to fix a real defect: both fort figures omitted
     * `visibleFrom`, and `personVisible` treats an omitted list as "visible
     * everywhere", so `people.find` returned THIS man at every viewpoint and the
     * garrison soldier below could never be selected at all. The palace carries
     * a test against exactly that (magicWindowPeople.test.ts); the fort did not.
     *
     * MEASURED AGAINST EVERY SHIPPED FORT VIEWPOINT, he is only ever distant:
     *
     *   VP2_over_the_barbican         40.2 m   -4.75 deg off axis   2.42 deg tall
     *   VP1_DelhiGate_from_the_north  84.8 m   +5.84                1.15 deg
     *   VP4_along_the_circuit        226.7 m   -5.34                0.43 deg
     *   VP6_above_the_fort           299.2 m   +0.00                0.33 deg
     *   every other viewpoint: outside the 10.47 deg horizontal half-angle
     *
     * 2.42 degrees is about a twentieth of the frame — a speck, not a person.
     * VP2 is named because it is the only viewpoint that frames him at all, not
     * because it works. THE PLACEMENT IS THE REAL PROBLEM: he stands 40 m from
     * the nearest camera that can see him, which is the same class of fault as
     * the palace's P4. Fixing that means re-placing him against fort evidence,
     * which is a separate piece of work at a different venue and is NOT done
     * here. His four CONFIRMED lines are untouched either way.
     */
    visibleFrom: ['VP2_over_the_barbican'],
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
    /**
     * VP5, which this figure's own comment already named and the geometry
     * confirms: 6.0 m away, 0.35 deg off axis, 15.9 deg tall. He is properly
     * framed — the only figure at this venue that is.
     *
     * He was UNREACHABLE until now. Both fort people omitted `visibleFrom`, and
     * `find` returns the first match, so Tipu above answered for every viewpoint
     * including this one and this man was never selected anywhere.
     */
    visibleFrom: ['VP5_the_breach'],
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
 * THE PALACE. Positions are the BUILDING's own frame, not a compass frame:
 * +X along the facade toward the NNE end, +Y into the building, origin at the
 * centre of the principal (ESE) facade, and a heading of 0 means +Y. That is
 * the same frame `PALACE_VIEWPOINTS` uses, converted once in the emitter, so
 * a person and a viewpoint can be read against each other directly.
 */
const PALACE_PEOPLE: MagicWindowPerson[] = [
  {
    id: 'purnaiah_darbar',
    // `_amp` is the SAME rig with its idle clip amplified 4x about the clip's
    // own mean pose. The original moved the hands 27.7 mm across a 4-second
    // cycle - about 16 px at this viewpoint - which the device reported, fairly,
    // as "does not move". Amplified it is 110.6 mm. Built by
    // heritage_assets/.../tools/amplify_idle.py; the height still skins to
    // 1.680 m with the feet on the floor.
    modelId: 'figures/tipu-summer-palace-bengaluru/purnaiah_idle_amp',
    name: 'Purnaiah',
    // Role, not rank-in-1791: he was Tipu's finance minister and styled Dewan.
    role: 'Tipu’s finance minister',
    // Darbar hall, first floor.
    //
    // MOVED, because the first placement was computed against the AUTHORED
    // field of view and the delivered one is three times narrower. `fovDeg` is
    // handed to Filament as a focal length, and Filament derives the VERTICAL
    // angle from a 24 mm sensor height (sceneview-4.18.0 names the constant
    // FILAMENT_SENSOR_HEIGHT_MM = 24.0). So an authored 62 deg arrives as
    // 43.7 deg vertical and about 20.9 deg horizontal in portrait - a
    // horizontal HALF-angle of 10.5 deg, not the 31 deg the old arithmetic
    // assumed. At (1.6, 12.0) he sat 28.1 deg off the P5 axis: not distant,
    // not occluded, simply outside the frame.
    //
    // At (0.45, 14.0) he is 5.02 m from P5 and 5.1 deg off its axis, which
    // leaves him comfortably inside a 10.5 deg half-angle on any phone aspect,
    // and 43% of the screen height with his feet in shot. Still clear of both
    // light wells (y 0-3.75 and 18.75-22.5), and the P5 sightline clears the
    // y=11.25 pillar row by 1.67 m.
    position: [0.45, 14.0],
    floorM: 2.6,
    // Turned back toward whoever is standing at P5, computed from the two
    // positions rather than eyeballed: atan2(0 - 0.45, 9.0 - 14.0) = 185.1 deg.
    headingDeg: 185,
    // P5 ONLY, and that is a measurement rather than a preference. At the
    // delivered 10.5 deg horizontal half-angle none of the other first-floor
    // stops can see him: P6 shares P5's eye but pitches up 35 deg, so its frame
    // runs +13.2 to +56.8 deg and his head is at +0.9; P4 looks down -X and he
    // is 55.5 deg off it; P9 faces 223.3 deg and he is 21.9 deg off. Listing
    // them would point the visitor at a man who is not on screen.
    visibleFrom: ['P5'],
    voiceKeyPrefix: 'audio/tipu-summer-palace-bengaluru/figures/purnaiah_darbar/',
    lines: [
      {
        text:
          'This face is a real one. It is taken from an oil portrait painted ' +
          'from life by Thomas Hickey — a sitting, not a reconstruction. It is ' +
          'the best likeness evidence anywhere in this building’s research, ' +
          'better than the one for Tipu himself, which is a contested profile.',
        tier: 'CONFIRMED',
        source:
          'Thomas Hickey, “Purniya, Chief Minister of Mysore”, c.1801, oil on ' +
          'canvas. Yale Center for British Art, B1973.1.22. CC0',
      },
      {
        text:
          'The clothes are the weak part, and you should know it. Hickey ' +
          'painted him in 1801, two years after Tipu was killed, when he ' +
          'served a restored Wodeyar raja under the Company. What he wore in ' +
          'Tipu’s durbar in the 1790s is not recorded anywhere. The face is ' +
          'unaffected by that; the coat is not.',
        tier: 'DISPUTED',
        source: 'evidence.md, DISPUTED §1 — 1801 dress, not 1791 dress',
      },
      {
        text:
          'He served Tipu as finance minister from December 1782 until Tipu ' +
          'died in May 1799 — the whole life of this building. In the war of ' +
          '1792 he commanded a rocket unit of 131 men himself.',
        tier: 'INFERRED',
        source:
          'Biography from a tertiary source; uncontested, but not a primary ' +
          'record. His presence in the government is attested throughout',
      },
      {
        text:
          'That he stood in THIS room is not attested. No source places any ' +
          'named person anywhere inside this palace. He is here because he was ' +
          'in Tipu’s government for its entire life, and someone has to show ' +
          'you the scale of the hall.',
        tier: 'NOT-A-CLAIM',
        source: 'evidence.md §S1 — presence at this building not separately attested',
      },
      {
        text:
          'Below the thigh, everything is invented. Hickey’s canvas stops ' +
          'there — no hem, no trousers, no shoes. So is the back of him, and ' +
          'his height, and how he stood.',
        tier: 'NOT-A-CLAIM',
        source: 'evidence.md §S1, “What this image does NOT support”',
      },
    ],
  },

  // ── THE FOUR REMAINING FIGURES ─────────────────────────────────────
  //
  // Every placement below is a STAGING DECISION, not an evidence claim, and each
  // one says so in its own NOT-A-CLAIM line. The ledger is unambiguous
  // (figure-court/evidence.md:75-78, :121-135): no source places any named
  // person anywhere inside this palace. What the record attaches to the building
  // is Hyder Ali commencing it, Tipu completing it, and the artists who drew it.
  //
  // Three of these four are TYPE figures and may never carry a personal name on
  // screen (evidence.md:399-400). Their costume is evidenced; their faces are
  // not, and their lines say so.
  //
  // POSITIONS ARE COMPUTED AGAINST THE DELIVERED FRUSTUM, never the authored
  // 62 deg. `fovDeg` reaches Filament as a focal length and comes back as a
  // 10.47 deg horizontal HALF-angle and 21.83 deg vertical. Placing against 62
  // is exactly how Purnaiah ended up 28 deg off axis and off screen; the first
  // draft of Hyder Ali below made the same mistake at 13.8 deg and was moved.
  // Each entry records its off-axis angle, screen height and whether the feet
  // are in shot.
  //
  // `visibleFrom` IS ONE STOP EACH AND DISJOINT. `people.find` returns the first
  // match, so an overlap would make the later person unreachable — which is the
  // state FORT_PEOPLE is already in, both omitting `visibleFrom` so the second
  // can never be selected.

  {
    id: 'guard_threshold',
    // `_amp`: the raw idle moves 5 of 24 joints by 2.85 deg at the shoulder,
    // about three pixels at this distance over a four-second cycle. See
    // heritage_assets/.../tools/amplify_idle.py.
    modelId: 'figures/tipu-summer-palace-bengaluru/guard_idle_amp',
    name: 'A court attendant',
    role: 'one of the men who kept the doors',
    // Front colonnade, ground floor, in the centre bay a visitor walks into.
    // From P1 (0, 1.9, eye 1.6): 4.64 m away, 7.4 deg off axis, feet 19.0 deg
    // below the eye against a 21.8 deg half-angle so they stay in shot, and he
    // stands 45% of the screen height. Mid-bay between the x = +-1.875 pillars,
    // clear of the y = 3.75 and 7.5 rows and of both light wells.
    position: [0.6, 6.5],
    floorM: 0,
    // atan2(0 - 0.6, 1.9 - 6.5) = 187.4 deg, computed from the two positions.
    headingDeg: 187,
    visibleFrom: ['P1'],
    lines: [
      {
        text:
          'The clothes are real. They were painted from sketches made on the ' +
          'spot at Srirangapatna in February 1792, by an artist who came with ' +
          'Cornwallis’s army — so this is Mysore court dress of exactly this ' +
          'decade, observed rather than imagined.',
        tier: 'CONFIRMED',
        source:
          'Robert Home, “The Reception of the Mysorean Hostage Princes”, ' +
          'c.1793. National Army Museum 1976-11-86. PD-Art',
      },
      {
        text:
          'The face is not his. No one recorded the face of any doorkeeper ' +
          'here, so this one was made up. That is why he has no name — he is a ' +
          'type, not a person, and putting a name on him would be an invention ' +
          'dressed as a record.',
        tier: 'NOT-A-CLAIM',
        source: 'evidence.md §S6 — costume CONFIRMED, no named individual buildable',
      },
      {
        text:
          'That anyone stood in this doorway is not attested either. He is ' +
          'here because a threshold is where a guard stands, and because you ' +
          'need a person beside these pillars to feel how big they are.',
        tier: 'NOT-A-CLAIM',
        source: 'No source places any named person inside this palace',
      },
    ],
  },

  {
    id: 'rocketman_arcade',
    modelId: 'figures/tipu-summer-palace-bengaluru/rocketman_idle_amp',
    name: 'A rocket-man of Tipu’s army',
    role: 'one of the men who fired the iron rockets',
    // Down the arcade, ground floor. From P2 (7.5, 1.9, eye 1.6) looking -X:
    // 7.01 m away, 3.3 deg off axis, feet 12.9 deg below the eye, 30% of the
    // screen height. He stands in the run of the colonnade so the 18.75 m of
    // receding arches has something human against it, which is what P2 is for.
    position: [0.5, 2.3],
    floorM: 0,
    // atan2(7.5 - 0.5, 1.9 - 2.3) = 93.3 deg.
    headingDeg: 93,
    visibleFrom: ['P2'],
    lines: [
      {
        text:
          'Two men who were here wrote down what this uniform looked like, ' +
          'separately, and they agree: a purple coat scattered with white ' +
          'spots, a red sash, a wide flat turban, bare lower legs. One was a ' +
          'Royal Artillery officer on campaign against Mysore in these exact ' +
          'years.',
        tier: 'CONFIRMED',
        source:
          'Capt. Charles Gold, “Oriental Drawings” (1806), sketched 1791–1798; ' +
          'corroborated by Robert Home, Madras 1793–94',
      },
      {
        text:
          'The spots are spots, not stripes. The tiger-stripe emblem you will ' +
          'hear about elsewhere in this building is not on this coat, and ' +
          'painting it on would be inventing an emblem.',
        tier: 'CONFIRMED',
        source:
          'evidence.md §S5 — “spotted, not striped”; forbidden to render as bubri',
      },
      {
        text:
          'His face is invented, like the guard’s, and for the same reason. ' +
          'And nothing records a rocket-man standing in this colonnade — he is ' +
          'here to give you the length of it.',
        tier: 'NOT-A-CLAIM',
        source:
          'evidence.md §S4 — type figure; no named individual, no attested presence',
      },
    ],
  },

  {
    id: 'cavalryman_stair',
    modelId: 'figures/tipu-summer-palace-bengaluru/cavalryman_idle_amp',
    name: 'A Mysore trooper',
    role: 'one of the cavalry',
    // Head of the NNE stair, first floor. From P4 (8, 3, eye 4.2) looking -X:
    // 5.51 m away, 4.2 deg off axis, feet 16.2 deg below the eye, 39% of the
    // screen height. On the 2.6 m floor, so he stands on it rather than through
    // it into the colonnade below.
    //
    // PLACED AT THE OWNER'S DIRECTION, and the objection is recorded rather than
    // buried: research/figure-court/build-record.md:284-319 recommended dropping
    // this figure before it was built, notes the source is an 82 x 90 px crop
    // upscaled eight times in which "his face is three blobs", and predicts he
    // "does not match Purnaiah, the guard or the rocketman". He is on the upper
    // floor and alone in frame, which is the least unkind place for him.
    position: [2.5, 3.4],
    floorM: 2.6,
    // atan2(8 - 2.5, 3 - 3.4) = 94.2 deg.
    headingDeg: 94,
    visibleFrom: ['P4'],
    lines: [
      {
        text:
          'This one is the thinnest evidence of the four. The costume comes ' +
          'from a battle painting — a copy of the Pollilur mural — where the ' +
          'whole rider is about eighty pixels tall. It tells you the colours ' +
          'and roughly the dress. It does not tell you a face.',
        tier: 'INFERRED',
        source:
          '“The Battle of Pollilur”, early 19th c. copy of the Daria Daulat ' +
          'Bagh mural, private collection. evidence.md §S7 — corroborate only',
      },
      {
        text:
          'So the face is invented, and so is most of the detail. He is a ' +
          'type, not a man, and he has no name for that reason.',
        tier: 'NOT-A-CLAIM',
        source:
          'evidence.md:399-400 — type figures are captioned as types, never named',
      },
      {
        text:
          'Cavalry did not stand at the top of a staircase. He is here so the ' +
          'upper floor is not empty, and because this is the one spot where he ' +
          'is not standing next to a better-evidenced figure.',
        tier: 'NOT-A-CLAIM',
        source:
          'Staging decision; no source places any named person inside this palace',
      },
    ],
  },

  {
    id: 'tipu_lawn',
    // THE SAME GLB THE ARRIVAL STEP ALREADY PLACES, deliberately, and it costs
    // nothing extra: LawnStep downloads `tipu_figure_royal9` at step 1, so by
    // the time a visitor reaches the magic window it is a cache hit. It is the
    // one palace figure with a talking clip (Idle_02,
    // Talk_with_Right_Hand_Open, Thoughtful_Walk); the other five are idle-only.
    //
    // ITS SCALE WAS MEASURED, NOT ASSUMED. journeyConfig.ts warns of a 100x unit
    // mismatch in this skeleton and normalises him with scaleToUnits; the magic
    // window has no scale control at all (MagicWindowFigure carries east, north,
    // up and heading and nothing else), so an unnormalised rig with a live
    // armature scale would arrive 100x wrong. Checked directly against the file:
    // jointWorld x inverseBind is the identity to 0.0117 with a residual scale
    // of exactly 1.0000, and the bind-pose bbox is 1.700 m. He renders at 1.70 m
    // here, alongside Purnaiah at 1.68 and the guard at 1.66. The warning is
    // stale for royal9.
    modelId: 'tipu_figure_royal9',
    name: 'Tipu Sultan',
    role: 'who finished this house and named it',
    // OUTSIDE, at external ground level -0.70 m, on the lawn where the arrival
    // step already stands him. From P0 (0, -14, eye 0.90): 6.44 m away, 6.2 deg
    // off axis inside the 10.47 deg delivered half-angle, feet 14.0 deg below
    // the eye and head 0.9 deg above it — comfortably inside the 21.8 deg
    // vertical half-angle, so he is whole in frame rather than cropped.
    //
    // WHY HE IS HERE AND NOT INSIDE. Not because the record forbids it — he
    // lived in this house — but because P0 is the one viewpoint whose stop is
    // the script he is already recorded speaking. His two other written scripts
    // (`the_pillars`, `the_lost_colour` in tipu_voice.py) land on P2 and P5,
    // both occupied, and exist on the CDN only in the retired Neural2-B voice.
    position: [0.7, -7.6],
    floorM: -0.7,
    // atan2(0 - 0.7, -14 - (-7.6)) = 186.2 deg — facing the visitor at P0.
    headingDeg: 186,
    visibleFrom: ['P0'],
    voiceKeyPrefix: 'audio/tipu-summer-palace-bengaluru/figures/tipu_lawn/',
    lines: [
      {
        text:
          'I am not a recording. No likeness of me was ever taken from life, ' +
          'and no words of mine about this house survive. What you hear was ' +
          'written for me.',
        tier: 'NOT-A-CLAIM',
        // The same sentence opens the arrival welcome, on purpose: a visitor
        // who meets him twice should be told twice, in his own voice, before
        // he says anything that sounds like testimony.
        source:
          'figure-tipu/evidence.md, "The governing problem"; journey welcome, first sentence',
      },
      {
        text:
          'My father began it in 1781 and died the year after, without seeing ' +
          'a room of it finished. It was completed in my reign, in the year ' +
          'you would count as seventeen ninety-one.',
        tier: 'CONFIRMED',
        source:
          'figure-tipu/script-fact-trace.md §A; migration 079 timeline and founder',
      },
      {
        text:
          'It is built of teak, not of stone, as a fort is. That was the ' +
          'point. A fort is for holding. This was for living in, in the hot ' +
          'months, with the air moving through it.',
        tier: 'CONFIRMED',
        source:
          'figure-tipu/script-fact-trace.md §A; migration 079 architecture.typology',
      },
      {
        text:
          'They called it Rashk-e-Jannat. The Envy of Heaven. You may judge ' +
          'for yourself whether that was ever fair.',
        tier: 'CONFIRMED',
        // The name is sourced; the closing sentence is manner, not matter, and
        // makes no claim — the rule script-fact-trace.md works to.
        source: 'figure-tipu/script-fact-trace.md §A; migration 079 one_line',
      },
      {
        text:
          'The face is inferred, not recorded. It is worked from a portrait ' +
          'painted in my lifetime and kept in my own family — but even that ' +
          'identification is contested, and no photograph of me exists or ' +
          'ever could.',
        tier: 'DISPUTED',
        source:
          'figure-tipu/evidence.md S1 (BL, attributed G. F. Cherry c. 1792, ' +
          'descent through Prince Ghulam Muhammad) and its DISPUTED section',
      },
    ],
  },
  {
    id: 'hyderali_lawn',
    modelId: 'figures/tipu-summer-palace-bengaluru/hyderali_idle_amp',
    name: 'Hyder Ali',
    role: 'who began this building and never saw it finished',
    // OUTSIDE, on the lawn, at the external ground level of -0.70 m - not on the
    // plinth. From P0 (0, -14, eye 0.9): 6.59 m away, 9.6 deg off axis inside a
    // 10.47 deg half-angle, feet 13.7 deg below the eye, 33% of the screen.
    //
    // OUTSIDE IS THE POINT, and it is the one placement here the record
    // positively supports. He commenced the palace inside the fort in 1781 and
    // died in 1782, so he never entered a finished room of it - which is what
    // the `palace_overview` narration already tells the visitor. Standing him on
    // the lawn looking at it is the evidenced position.
    //
    // MOVED TO THE FAR CORNER, AND WHY THE OLD NUMBERS ARE GONE. The comment
    // above is kept because the reasoning still holds; only the viewpoint it was
    // framed against has changed. He was at (-1.1, -7.5) heading 170, framed from
    // P0 — a first draft at x = -1.60 was 13.8 deg off axis and off screen, the
    // identical fault that moved Purnaiah, so it went to -1.10.
    //
    // P0 now belongs to Tipu, so that framing constraint is void and replaced by
    // framing from P0b (-8.0, -14.0), the far corner of the same lawn. Against
    // the DELIVERED 10.47 deg horizontal half-angle:
    //
    //   from P0b heading 14 : +0.04 deg off axis, 6.18 m, feet 14.5 deg below
    //                         the eye, head 0.9 deg above    IN, dead centre
    //   from P0  heading 0  : -47.29 deg off axis            OUT, as intended
    //   Tipu from P0b       : +39.66 deg off axis            OUT, as intended
    //
    // The two men are 1.8 m apart at their old positions, which is why no single
    // distant view can hold one without the other; separating them meant moving
    // him, and nothing in the record ties him to a spot on the lawn — only to
    // being on it. See palace.ts P0b for why a second viewpoint rather than two
    // figures at P0.
    //
    // NO LIKENESS BADGE ON SCREEN, at the owner's direction. The face is a
    // documented fabrication (build-record.md:120-122) and build-record.md:140-141
    // requires that if this figure is labelled it must not be captioned in a way
    // implying the face is documented. It carries no badge - consistent with
    // every other figure here, where the tier lives in the record and the visitor
    // hears the sentence - and the third line below states the fabrication
    // outright, which is what satisfies that requirement.
    position: [-6.5, -8.0],
    floorM: -0.7,
    // Facing P0b: atan2(-8.0 - (-6.5), -14.0 - (-8.0)) = atan2(-1.5, -6.0)
    // = 194.0 deg. He looks back down the lawn at the viewpoint, which is also
    // the direction the building's front runs away from him.
    headingDeg: 194,
    /**
     * BACK ON THE LAWN, AT HIS OWN VIEWPOINT.
     *
     * He was stood down here with an EMPTY array — and `[]` is not the same as
     * omitting the field: `personVisible` reads
     * `!person.visibleFrom || person.visibleFrom.includes(id)`, so an omitted
     * list means "visible everywhere" and an empty one means the `find` in
     * MagicWindowScreen never matches him anywhere. That distinction is a trap
     * worth keeping named here rather than rediscovering.
     *
     * WHY HE WENT AWAY. The palace had two different men standing on the same
     * ground in two different surfaces — Tipu on the lawn in AR through
     * JOURNEY_HOSTS, Hyder Ali on the lawn at P0 in the magic window — and a
     * visitor who walked the journey met both with no way to know it was the same
     * place. That was the real fault. Removing him fixed it and cost three
     * sourced lines, including the 1846-engraving finding, which is the strongest
     * piece of scepticism anywhere in this file.
     *
     * WHY HE COULD NOT JUST MOVE INSIDE. Every free viewpoint (P3, P6, P9) is an
     * interior, and his own second line below says standing him in a room he
     * never entered "would be the one thing the record actually rules out about
     * him". Relocating him indoors would have made the figure contradict itself.
     *
     * WHAT CHANGED. P0b — the far corner of the same lawn — separates the two men
     * without putting either of them anywhere the record refuses. P0 is Tipu's
     * and stays Tipu's; this list names P0b and nothing else, so the two sets are
     * disjoint and no viewpoint can resolve to both.
     *
     * EVERYTHING BELOW IS UNCHANGED — three lines, their tiers and their sources.
     * Only the position, the heading and this one field moved.
     */
    visibleFrom: ['P0b'],
    lines: [
      {
        text:
          'He began this building in 1781, inside the walls of the fort, and ' +
          'died the year after. He never saw a room of it finished. His son ' +
          'completed it in 1791 and named it the envy of heaven.',
        tier: 'CONFIRMED',
        source:
          'evidence.md §S3 — commencement 1781, death 1782; ASI and published sources',
      },
      {
        text:
          'That is why he is out here and not inside. Standing him in a room ' +
          'he never entered would be the one thing the record actually rules ' +
          'out about him.',
        tier: 'NOT-A-CLAIM',
        source: 'Staging decision, argued from the commencement and death dates',
      },
      {
        text:
          'The face is the weakest thing in this reconstruction. Every widely ' +
          'circulated portrait of him descends from an engraving made in 1846 ' +
          'to illustrate a novel, forty-seven years after he died. Two men who ' +
          'met him wrote that he wore no beard and no moustache at all.',
        tier: 'DISPUTED',
        source:
          'figure-hyder-ali/evidence.md W1 (Maistre de la Tour) and W2 (Kirmani), ' +
          'both CONFIRMED; build-record.md:120-122 on the 1846 Keck/Dickes engraving',
      },
    ],
  },
];

/**
 * The people of one site. Empty for a scene with nobody in it, so the caller
 * never has to know which sites have figures — the scene's `hasFigure` flag and
 * this list are derived from the same fact.
 */
export function peopleFor(slug: string): MagicWindowPerson[] {
  if (slug === 'tipu-summer-palace-bengaluru') return PALACE_PEOPLE;
  if (slug === 'bangalore-fort') return FORT_PEOPLE;
  return [];
}

/**
 * PHASE 4 BLOCKING TEST — Khronos CesiumMan.
 *
 * The brief requires proving the renderer plays glTF skeletal animation BEFORE
 * anything is generated. This is the free Khronos reference sample: 1 skin, 19
 * joints, 1 animation, 57 channels, JOINTS_0 present — verified by parsing the
 * GLB, not assumed.
 *
 * It is a TEST FIXTURE, never a heritage claim. It is deliberately kept out of
 * every `peopleFor` list so it can never be mistaken for someone who stood here.
 */
export const RIG_TEST_MODEL_ID = 'khronos_cesium_man';

/** Placed on the avenue, well clear of anything evidenced. */
export const RIG_TEST_PLACEMENT = {east: 40, north: -300, heading: 0};
