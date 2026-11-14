import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('Créditos menciona cada licencia y vuelve al instrumento', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Créditos', exact: true }).click();
  const main = page.getByRole('region', { name: 'Créditos' });
  await expect(main.getByRole('heading', { name: 'Créditos', level: 1 })).toBeVisible();
  for (const licence of ['CC-BY 3.0', 'CC0 1.0', 'MIT', 'Apache 2.0', 'SIL Open Font License']) {
    await expect(main).toContainText(licence);
  }
  await expect(page.locator('body')).not.toContainText('Spider-Man');
  await main.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.locator('video')).toBeVisible();
});

test('La guía de gestos muestra las 7 señas', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /Guía/ }).first().click();
  const guide = page.getByRole('region', { name: 'Guía de gestos' });
  await expect(guide.getByRole('listitem')).toHaveCount(7);
  await expect(guide).toContainText('Pulgar arriba');
});
