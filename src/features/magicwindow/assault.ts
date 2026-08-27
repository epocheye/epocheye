/**
 * The storm of Bangalore Fort, 21 March 1791.
 *
 * WHAT IS DOCUMENTED: that it happened, where, when, by whom, and in what
 * order. WHAT IS NOT: how it looked. Troop positions, numbers in frame, the
 * visual detail of the assault — none of that is recorded by anybody.
 *
 * So this animates the SEQUENCE and treats the rendering as declared
 * visualisation. Nothing is drawn that states something no source records:
 * no smoke from a battery position, no counted figures, no fire, no collapsing
 * masonry. Each step reveals a LOCATED element and says what it is.
 *
 * The atmospheric treatment is presentational — haze and grading assert
 * nothing. The one place effects do real work is as the uncertainty language:
 * the rampart fading upward where its height becomes illegible, the ditch
 * losing definition as it descends. That is built into the model itself.
 */

export interface AssaultStep {
  step: number;
  when: string;
  title: string;
  text: string;
  /** Where to stand for this step, by viewpoint id. */
  viewpoint?: string;
  /** Whether anything is added to the model at this step. */
  drawn: boolean;
}

export const ASSAULT: AssaultStep[] = [
  {
    step: 1,
    when: '5 February 1791',
    title: 'Cornwallis arrives',
    text:
      'The army comes up before Bangalore. Nothing is drawn for this step — ' +
      'where it camped is not something this model can show.',
    drawn: false,
  },
  {
    step: 2,
    when: '7 February',
    title: 'The pettah is taken',
    text:
      'The town falls first, by assault. The pettah lay outside these walls ' +
      'and is not modelled: no source describes it closely enough to build.',
    drawn: false,
  },
  {
    step: 3,
    when: 'February–March',
    title: 'The batteries open',
    text:
      'Battery E, located to within about fifteen metres. What is shown is ' +
      'where it stood, not what it looked like or what came out of it.',
    viewpoint: 'VP5_the_breach',
    drawn: true,
  },
  {
    step: 4,
    when: 'March',
    title: 'Fire on the curtain',
    text:
      'Five lines of fire, derived from the plan. They mark what was under ' +
      'fire. They are not a claim about smoke, flame or the sound of it.',
    viewpoint: 'VP5_the_breach',
    drawn: true,
  },
  {
    step: 5,
    when: 'by 21 March',
    title: 'The curtain is breached',
    text:
      'Engineers under Captain Kyd breach the north rampart near the Delhi ' +
      'Gate. The struck stretch runs 158.3 metres. The breach itself is NOT ' +
      'drawn — no source gives its shape, so you are shown where it was and ' +
      'the wall as it stood, not a hole invented to fit.',
    viewpoint: 'VP5_the_breach',
    drawn: true,
  },
  {
    step: 6,
    when: 'the night of 21 March 1791',
    title: 'The storm',
    text:
      'The Madras Pioneers under Lieutenant Colin Mackenzie cross the ditch ' +
      'with scaling ladders and enter by the great round tower. The entry ' +
      'point is located to about fifteen metres. It was dark, and how it ' +
      'looked is not recorded by anyone who wrote it down.',
    viewpoint: 'VP5_the_breach',
    drawn: true,
  },
  {
    step: 7,
    when: 'in the breach',
    title: 'Bahadur Khan is killed',
    text:
      'The killedar, whom Tipu had appointed governor of the upper fort, dies ' +
      'defending it. He is attested as an eyewitness account by Roderick ' +
      'Mackenzie. No portrait of him exists.',
    viewpoint: 'VP5_the_breach',
    drawn: false,
  },
  {
    step: 8,
    when: 'after',
    title: 'The count',
    text:
      'Fortescue records over a thousand defenders buried after the storm, ' +
      'and fewer than five hundred British casualties across the whole siege. ' +
      'Those are the numbers that survive. The fort held for six weeks.',
    viewpoint: 'VP6_above_the_fort',
    drawn: false,
  },
];
