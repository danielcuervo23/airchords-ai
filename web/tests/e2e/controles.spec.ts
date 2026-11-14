import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('Cambiar el sonido actualiza la etiqueta', async ({ page }) => {
  await start(page);
  const picker = page.getByRole('button', { name: /^Sonido/ });
  await expect(picker).toContainText('Piano');
  await picker.click();
  // v1 shows six sounds: Guitarra is hidden (it made no sound).
  await expect(page.getByRole('radiogroup', { name: 'Sonido' }).getByRole('radio')).toHaveCount(6);
  await expect(page.getByRole('radio', { name: 'Guitarra' })).toHaveCount(0);
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

test('Ningún texto pide abrir la boca: el sonido solo cambia con el selector', async ({ page }) => {
  await start(page);
  await expect(page.locator('body')).not.toContainText(/boca/i);
  await page.getByRole('button', { name: /Guía/ }).first().click();
  await expect(page.getByRole('region', { name: 'Guía de gestos' })).not.toContainText(/boca/i);
});
