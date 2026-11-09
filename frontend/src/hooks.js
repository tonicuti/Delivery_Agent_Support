import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

/** Fetch `path`, optionally re-fetching every `interval` ms while the tab is visible. */
export function usePoll(path, { interval = 0, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, updatedAt: null });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const data = await api.get(path);
      if (ticket === latest.current) {
        setState({ data, error: null, loading: false, updatedAt: new Date() });
      }
    } catch (error) {
      if (ticket === latest.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [path]);

  useEffect(() => {
    // A new path is a different resource: never show the previous one's data while it loads.
    setState({ data: null, error: null, loading: true, updatedAt: null });
    reload();
    return () => {
      latest.current++;
    };
  }, [reload]);

  useEffect(() => {
    if (!interval || !enabled) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) reload();
    }, interval);
    return () => clearInterval(id);
  }, [interval, enabled, reload]);

  return { ...state, reload };
}
