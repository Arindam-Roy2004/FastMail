import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbort } from './api';

type Options = {
  pollMs?: number;
  enabled?: boolean;
};

export type Resource<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  fetching: boolean;
  reload: () => Promise<void>;
};

type Result<T> = { key: string; data: T | undefined; error: unknown };

export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[], options: Options = {}): Resource<T> {
  const { pollMs, enabled = true } = options;
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<Result<T> | null>(null);
  const [fetching, setFetching] = useState(false);
  const loaderRef = useRef(loader);
  const keyRef = useRef(key);
  const controllerRef = useRef<AbortController | null>(null);

  // Declared first, so it runs before the fetch effect below sees a new key.
  useEffect(() => {
    loaderRef.current = loader;
    keyRef.current = key;
  });

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const runKey = keyRef.current;
    setFetching(true);
    try {
      const data = await loaderRef.current(controller.signal);
      if (controller.signal.aborted) return;
      setResult({ key: runKey, data, error: null });
    } catch (err) {
      if (isAbort(err) || controller.signal.aborted) return;
      setResult((prev) => (prev?.key === runKey ? { ...prev, error: err } : { key: runKey, data: undefined, error: err }));
    } finally {
      if (controllerRef.current === controller) setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    return () => controllerRef.current?.abort();
  }, [enabled, key, run]);

  useEffect(() => {
    if (!enabled || !pollMs) return;
    let timer: number | undefined;
    const tick = () => {
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await run();
        tick();
      }, pollMs);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, pollMs, run]);

  const current = result?.key === key ? result : null;
  return {
    data: current?.data,
    error: current?.error ?? null,
    loading: enabled && current === null,
    fetching,
    reload: run,
  };
}
