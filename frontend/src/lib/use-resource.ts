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

export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[], options: Options = {}): Resource<T> {
  const { pollMs, enabled = true } = options;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [fetching, setFetching] = useState(false);
  const [settled, setSettled] = useState(false);
  const loaderRef = useRef(loader);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setFetching(true);
    try {
      const result = await loaderRef.current(controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (isAbort(err) || controller.signal.aborted) return;
      setError(err);
    } finally {
      if (controllerRef.current === controller) {
        setFetching(false);
        setSettled(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // New query: forget the old result so the list shows skeletons, not stale rows.
    setData(undefined);
    setSettled(false);
    void run();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

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

  return { data, error, loading: enabled && !settled && data === undefined, fetching, reload: run };
}
