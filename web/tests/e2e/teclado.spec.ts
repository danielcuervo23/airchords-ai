import { expect, test } from '@playwright/test';

test('Se puede usar solo con el teclado', async ({ page }) => {
  await page.goto('/');
  const cta = page.getByRole('button', { name: 'Empezar' });
  await cta.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('video')).toBeVisible();

  const sound = page.getByRole('button', { name: /^Sonido/ });
  await sound.focus();
  await page.keyboard.press('Enter');
  await expect(sound).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('radio', { name: 'Piano' })).toBeFocused();
  await page.keyboard.press('ArrowDown'); // native radios: arrow keys move and select
  await expect(sound).toContainText('Guitarra');
  await expect(sound).toBeFocused(); // picking closes the sheet and returns focus

  await sound.press('Enter');
  await page.keyboard.press('Escape');
  await expect(sound).toHaveAttribute('aria-expanded', 'false');
  await expect(sound).toBeFocused();
});
