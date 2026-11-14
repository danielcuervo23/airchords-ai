import { expect, test } from '@playwright/test';

/**
 * Simulates iOS: the AudioContext reports 'suspended' and resume() does nothing until the test
 * allows it (like a gesture that did not count, or a phone call interruption).
 */
test('Si el audio queda suspendido aparece "Toca para activar el sonido" y un toque lo activa', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __allowResume: boolean };
    w.__allowResume = false;
    const unlocked = new WeakSet<BaseAudioContext>();
    const desc = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state')!;
    Object.defineProperty(BaseAudioContext.prototype, 'state', {
      configurable: true,
      get(this: BaseAudioContext) {
        return unlocked.has(this) ? desc.get!.call(this) : 'suspended';
      },
    });
    const realResume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function (this: AudioContext) {
      if (!w.__allowResume) return Promise.resolve();
      unlocked.add(this);
      return realResume.call(this).then(() => {
        this.dispatchEvent(new Event('statechange'));
      });
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const gate = page.getByRole('button', { name: 'Toca para activar el sonido' });
  await expect(gate).toBeVisible();

  await page.evaluate(() => ((window as unknown as { __allowResume: boolean }).__allowResume = true));
  await gate.click();
  await expect(gate).toBeHidden();
});

test('Con el audio funcionando no aparece el aviso', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.locator('video')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toca para activar el sonido' })).toBeHidden();
});
