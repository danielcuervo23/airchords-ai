import { describe, expect, it, vi } from 'vitest';
import { createLatestWins, createPulse } from '../../../src/audio/control';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

describe('createLatestWins', () => {
  it('marks an older request stale when a newer one was made, whatever resolves last', async () => {
    const d: Record<string, ReturnType<typeof deferred<string>>> = { a: deferred(), b: deferred() };
    const loader = createLatestWins((k: string) => d[k]!.promise);
    const first = loader.request('a');
    const second = loader.request('b');
    d.b!.resolve('B');
    d.a!.resolve('A');
    expect(await second).toEqual({ value: 'B', stale: false });
    expect(await first).toEqual({ value: 'A', stale: true });
  });

  it('builds once for concurrent requests of the same key', async () => {
    const d = deferred<string>();
    const build = vi.fn(() => d.promise);
    const loader = createLatestWins(build);
    const p1 = loader.request('a');
    const p2 = loader.request('a');
    d.resolve('A');
    await Promise.all([p1, p2]);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('reuses a finished build', async () => {
    const build = vi.fn(async () => 'A');
    const loader = createLatestWins(build);
    await loader.request('a');
    await loader.request('a');
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed build so a retry builds again', async () => {
    const build = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok');
    const loader = createLatestWins(build);
    await expect(loader.request('a')).rejects.toThrow('x');
    expect((await loader.request('a')).value).toBe('ok');
  });

  it('exposes finished values for disposal', async () => {
    const loader = createLatestWins(async (k: string) => k.toUpperCase());
    await loader.request('a');
    expect(loader.values()).toEqual(['A']);
  });
});

describe('createPulse', () => {
  function fakeTimers() {
    let n = 0;
    const active = new Set<number>();
    return {
      active,
      setInterval: vi.fn(() => (active.add(++n), n)),
      clearInterval: vi.fn((id: number) => void active.delete(id)),
    };
  }

  it('does not restart when the interval is unchanged', () => {
    const t = fakeTimers();
    const pulse = createPulse(t);
    pulse.set(500, () => undefined);
    pulse.set(500, () => undefined);
    pulse.set(500, () => undefined);
    expect(t.setInterval).toHaveBeenCalledTimes(1);
    expect(t.clearInterval).not.toHaveBeenCalled();
  });

  it('restarts when the interval changes', () => {
    const t = fakeTimers();
    const pulse = createPulse(t);
    pulse.set(500, () => undefined);
    pulse.set(400, () => undefined);
    expect(t.setInterval).toHaveBeenCalledTimes(2);
    expect(t.active.size).toBe(1);
  });

  it('calls the latest callback without restarting', () => {
    const t = fakeTimers();
    const pulse = createPulse(t);
    const a = vi.fn();
    const b = vi.fn();
    pulse.set(500, a);
    pulse.set(500, b);
    const tick = (t.setInterval.mock.calls[0] as unknown as [() => void])[0];
    tick();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('stops, and null interval stops too', () => {
    const t = fakeTimers();
    const pulse = createPulse(t);
    pulse.set(500, () => undefined);
    pulse.stop();
    expect(t.active.size).toBe(0);
    pulse.set(500, () => undefined);
    pulse.set(null, () => undefined);
    expect(t.active.size).toBe(0);
  });
});
