import { describe, expect, it } from 'vitest';
import { gelName, gelVar } from '../../../src/ui/gel';

describe('sign to gel colour', () => {
  it('maps each degree to its token', () => {
    expect(gelVar(1)).toBe('var(--g1)');
    expect(gelVar(5)).toBe('var(--g5)');
    expect(gelVar(7)).toBe('var(--g7)');
  });
  it('names the colour in Spanish for the video text alternative', () => {
    expect(gelName(1)).toBe('ámbar');
    expect(gelName(2)).toBe('rosa');
    expect(gelName(5)).toBe('celeste');
  });
});
