// Session state shared by the panel and the target tool: whether the target
// tool is on, and Auto's status. Built on the host's zustand `create` so
// components subscribe like core's.

import { api } from "./runtime";
import type { StoreApi } from "./safelight";

export type AutoStatus = "idle" | "busy" | "failed";

export interface Session {
  target: boolean;
  auto: AutoStatus;
  setTarget(on: boolean): void;
  setAuto(status: AutoStatus): void;
}

let session: StoreApi<Session> | null = null;

export function initStore(): void {
  session = api().stores.create<Session>((set) => ({
    target: false,
    auto: "idle",
    setTarget: (target) => set({ target }),
    setAuto: (auto) => set({ auto }),
  }));
}

export function store(): StoreApi<Session> {
  if (!session) throw new Error("[black-and-white] store() called before activate()");
  return session;
}
