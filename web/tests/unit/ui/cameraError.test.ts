import { describe, expect, it } from 'vitest';
import { cameraErrorMessage } from '../../../src/ui/cameraError';

const dom = (name: string) => Object.assign(new Error(name), { name });

describe('cameraErrorMessage', () => {
  it('permission denied', () => expect(cameraErrorMessage(dom('NotAllowedError'))).toMatch(/permiso/));
  it('no camera', () => expect(cameraErrorMessage(dom('NotFoundError'))).toMatch(/No encontramos ninguna cámara/));
  it('camera busy', () => expect(cameraErrorMessage(dom('NotReadableError'))).toMatch(/otra app/));
  it('unsupported browser', () => expect(cameraErrorMessage('unsupported')).toMatch(/navegador/));
  it('anything else gets a generic message, never empty', () => {
    expect(cameraErrorMessage(42)).toMatch(/No pudimos encender la cámara/);
  });
});
