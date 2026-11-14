import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('Inicio explica la app y promete privacidad', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tus manos encienden los acordes');
  await expect(page.getByText('La cámara se procesa solo en tu dispositivo')).toBeVisible();
});

test('Al pulsar Empezar aparece el video y el aviso de manos se va cuando hay una mano', async ({ page }) => {
  await start(page);
  await expect(page.getByText('Esperando tus manos…')).toBeHidden({ timeout: 10_000 });
  const display = page.getByTestId('chord-display');
  await expect(display).toContainText('C');
  await expect(display).toContainText('Do mayor · tono Do mayor');
  await expect(page.getByRole('status').filter({ hasText: 'Suena Do mayor' })).toHaveCount(1);
});
