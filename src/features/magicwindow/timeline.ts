/**
 * The documented states of Bangalore Fort.
 *
 * Each carries its own evidence standing, and the RENDERING differs accordingly
 * — the brief's requirement that uncertainty be visible in the model, not only
 * in a caption. Two of these five have evidence too thin to model naively, and
 * they are the two that look different for that reason.
 */

export interface FortState {
  id: number;
  label: string;
  years: string;
  tier: 'INFERENCE' | 'STRONG' | 'CONFIRMED' | 'EXTENT-UNRECORDED';
  /** What the visitor is looking at, and what it withholds. */
  note: string;
}

export const FORT_STATES: FortState[] = [
  {
    id: 1,
    label: 'Kempe Gowda’s mud fort',
    years: 'c.1537–1687',
    tier: 'INFERENCE',
    note:
      'An earthen bank and nothing else. No contemporary plan of this fort ' +
      'exists, so its shape is not known — the only thread to this footprint ' +
      'is that Rice calls the 1761 work a rebuild in stone. It is drawn as the ' +
      'least certain thing on screen because that is what it is.',
  },
  {
    id: 2,
    label: 'Hyder Ali’s stone fort',
    years: 'c.1761–1791',
    tier: 'STRONG',
    note:
      'The fort at its height, rebuilt in stone in 1761 by the killedar ' +
      'Ibrahim Sahib. This is the state the evidence supports best and the one ' +
      'everything else is measured against.',
  },
  {
    id: 3,
    label: 'After the storm',
    years: '21 March 1791',
    tier: 'STRONG',
    note:
      'The same fabric, with the siege marked on it: the battery, the fire ' +
      'lines, the struck stretch and the point of entry. The breach itself is ' +
      'not modelled — no source gives its shape, so what is shown is where it ' +
      'was, not what it looked like.',
  },
  {
    id: 4,
    label: 'Partial demolition',
    years: 'c.1860',
    tier: 'EXTENT-UNRECORDED',
    note:
      'The Nicholas Bros photograph shows two bastions and barracks still ' +
      'standing, but which two is not established. So this state does not ' +
      'pretend to know: what survives today is solid, and the rest of the ' +
      'circuit is a ghost beside it — more stood here then, and how much is ' +
      'unrecorded.',
  },
  {
    id: 5,
    label: 'What survives',
    years: 'today',
    tier: 'CONFIRMED',
    note:
      'The Delhi Gate and the curtain either side of it — roughly 47 by 48 ' +
      'metres of a fort that was a mile round. Everything else you have been ' +
      'walking through is under the market and the roads.',
  },
];
