import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('Cambiar el sonido actualiza la etiqueta', async ({ page }) => {
  await start(page);
  const picker = page.getByRole('button', { name: /^Sonido/ });
  await expect(picker).toContainText('Piano');
  await picker.click();
  await page.getByRole('radio', { name: 'Cristal' }).check();
  await expect(picker).toContainText('Cristal');
});

test('Elegir una canción guiada muestra sus acordes y el primer gesto', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Guiada' }).click();
  await page.getByRole('button', { name: /^Canción/ }).click();
  await page.getByRole('radio', { name: /City of Stars/ }).check();
  await expect(page.getByText('Acordes de City of Stars')).toBeVisible();
  const cue = page.getByTestId('guided-cue');
  await expect(cue).toContainText('Pulgar arriba');
  await expect(cue).toContainText('iv');
  await expect(cue).toContainText('Gm');
});

test('Modo automático: lista de acordes y tempo de 60 a 160', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Automático' }).click();
  await expect(page.getByTestId('auto-list').getByRole('listitem').first()).toBeVisible();
  const tempo = page.getByRole('slider', { name: /Tempo/ });
  await expect(tempo).toHaveAttribute('min', '60');
  await expect(tempo).toHaveAttribute('max', '160');
});

test('El selector de tono ofrece las 24 tonalidades', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /^Tono/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Tono' }).getByRole('radio')).toHaveCount(24);
  await page.getByRole('radio', { name: 'Sol mayor' }).check();
  await expect(page.getByRole('button', { name: /^Tono/ })).toContainText('Sol mayor');
});
