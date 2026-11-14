import { expect, type Page } from '@playwright/test';

export async function start(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.locator('video')).toBeVisible();
}
