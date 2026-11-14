import { expect, test } from '@playwright/test';

test('Sin permiso de cámara: mensaje en español y Reintentar', async ({ page }) => {
  // The first request is refused; the second (after "Reintentar") uses the real fake camera.
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    let calls = 0;
    md.getUserMedia = (c?: MediaStreamConstraints) =>
      calls++ === 0 ? Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) : real(c);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('No tenemos permiso para usar la cámara');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.locator('video')).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
});
