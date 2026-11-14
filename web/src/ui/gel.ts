import type { Degree } from '../music/theory';

const NAMES = ['ámbar', 'rosa', 'violeta', 'menta', 'celeste', 'coral', 'paja'] as const;

/** The colour follows the degree, never the note name (DESIGN.md, "The 7 chord gels"). */
export const gelVar = (d: Degree): string => `var(--g${d})`;
export const gelName = (d: Degree): string => NAMES[d - 1]!;
