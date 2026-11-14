import { expect, test } from '@playwright/test';

test('Se puede usar solo con el teclado: flechas para mirar, Enter para elegir, Escape para cancelar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('video')).toBeVisible();

  const sound = page.getByRole('button', { name: /^Sonido/ });
  await sound.focus();
  await page.keyboard.press('Enter');
  await expect(sound).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('radio', { name: 'Piano' })).toBeFocused();

  // Browsing with the arrows moves the selection but does not change the sound yet.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'Violín' })).toBeFocused();
  await expect(sound).toHaveAttribute('aria-expanded', 'true');
  await expect(sound).toContainText('Piano');

  // Enter confirms, closes and returns focus.
  await page.keyboard.press('Enter');
  await expect(sound).toContainText('Violín');
  await expect(sound).toHaveAttribute('aria-expanded', 'false');
  await expect(sound).toBeFocused();

  // Escape cancels: the browsed option is dropped and the previous one stays.
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(sound).toHaveAttribute('aria-expanded', 'false');
  await expect(sound).toBeFocused();
  await expect(sound).toContainText('Violín');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: 'Violín' })).toBeChecked();
  await page.keyboard.press('Escape');

  // Tabbing out of an open sheet closes it.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(sound).toHaveAttribute('aria-expanded', 'false');
});
