import { describe, expect, it } from 'vitest';
import { APP_NAME } from '../../src/version';

describe('smoke', () => {
  it('suma y expone el nombre de la app', () => {
    expect(1 + 1).toBe(2);
    expect(APP_NAME).toBe('instrumento-gestos');
  });
});
