// Generic hook: callers pass the dependency list, and `load` is a new function every render,
// so the exhaustive-deps rule can't check this file statically.
/* oxlint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, type DependencyList } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
}

/**
 * Runs `load` whenever `deps` change and aborts the previous request.
 * Keeps the previous `data` while reloading, so views can dim instead of flashing empty.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: undefined, loading: false });
      },
      (err: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => ({ ...previous, error: (err as Error).message, loading: false }));
        }
      },
    );
    return () => controller.abort();
  }, deps);

  return state;
}
