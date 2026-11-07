import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/api.js";
import { humanize } from "@/format.js";

const EMPTY = {
  playbooks: {}, roles: ["dispatcher"], decisions: [], dismiss_reasons: {}, languages: {}, stale_after_minutes: 90,
  labels: { features: {}, stock: {}, stages: {}, actions: {}, decisions: {}, roles: {} },
};
const MetaContext = createContext(EMPTY);
const RoleContext = createContext({ role: "dispatcher", setRole: () => {} });
const ROLE_KEY = "console-role";

export const useMeta = () => useContext(MetaContext);
export const useRole = () => useContext(RoleContext);

/** Everyday names for codes (actions, roles, stock...), with a readable fallback. */
export function useWords() {
  const { labels } = useMeta();
  return useMemo(() => ({
    action: (id) => labels.actions[id] ?? humanize(id),
    role: (id) => labels.roles[id] ?? humanize(id),
    decision: (id) => labels.decisions[id] ?? humanize(id),
    feature: (name) => labels.features[name] ?? String(name).replace(/_/g, " "),
    stock: (id) => labels.stock[id] ?? humanize(id),
    stage: (id) => labels.stages[id] ?? humanize(id),
  }), [labels]);
}

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(EMPTY);
  useEffect(() => {
    api.get("/api/meta").then(setMeta).catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

/** The decision log keeps a role, never a person's name. */
export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(() => {
    try {
      return localStorage.getItem(ROLE_KEY) || "dispatcher";
    } catch {
      return "dispatcher";
    }
  });
  const value = useMemo(() => ({
    role,
    setRole: (next) => {
      setRoleState(next);
      try {
        localStorage.setItem(ROLE_KEY, next);
      } catch {
        /* blocked storage: the choice then lasts for this visit only */
      }
    },
  }), [role]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
