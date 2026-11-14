/** Small injectable control helpers for the engine (no Tone.js, unit-tested). */

export interface Loaded<V> { value: V; stale: boolean }

/**
 * Builds values by key, caching the in-flight/finished promise (no duplicate builds), and
 * tags each result as stale when a newer request was made meanwhile ("latest wins").
 * Failed builds are forgotten so a retry builds again.
 */
export function createLatestWins<K, V>(build: (key: K) => Promise<V>) {
  const cache = new Map<K, Promise<V>>();
  const done = new Map<K, V>();
  let token = 0;
  return {
    async request(key: K): Promise<Loaded<V>> {
      const mine = ++token;
      let p = cache.get(key);
      if (!p) {
        p = build(key).then(
          (v) => (done.set(key, v), v),
          (e: unknown) => {
            cache.delete(key);
            throw e;
          },
        );
        cache.set(key, p);
      }
      const value = await p;
      return { value, stale: mine !== token };
    },
    values: (): V[] => [...done.values()],
  };
}

export interface IntervalApi<H> {
  setInterval(fn: () => void, ms: number): H;
  clearInterval(handle: H): void;
}

/** A repeating timer that only restarts when the interval actually changes (keeps its phase otherwise). */
export function createPulse<H>(api: IntervalApi<H>) {
  let handle: H | null = null;
  let current: number | null = null;
  let callback: () => void = () => undefined;
  const stop = (): void => {
    if (handle !== null) api.clearInterval(handle);
    handle = null;
    current = null;
  };
  return {
    set(intervalMs: number | null, fn: () => void): void {
      callback = fn;
      if (intervalMs === current) return;
      stop();
      if (intervalMs === null) return;
      current = intervalMs;
      handle = api.setInterval(() => callback(), intervalMs);
    },
    stop,
  };
}
