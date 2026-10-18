// Session state shared by the panel and the target overlay: whether the
// target tool is on, the latest original-colour frame it reads, and Auto's
// status. Built on the host's zustand `create` so components subscribe like
// core's.

import type { FrameSample } from "./frame";
import { api } from "./runtime";
import type { StoreApi } from "./safelight";

export type AutoStatus = "idle" | "busy" | "failed";

/** A rendered frame and the photo it shows. */
export interface SampledFrame {
  photoId: string;
  sample: FrameSample;
}

export interface Session {
  target: boolean;
  /** The open photo rendered with B&W bypassed, for the target tool. */
  frame: SampledFrame | null;
  auto: AutoStatus;
  /** Turning the tool off drops the frame, so it can't be sampled on another
   *  photo before that photo's own render lands. */
  setTarget(on: boolean): void;
  setFrame(frame: SampledFrame | null): void;
  setAuto(status: AutoStatus): void;
}

/** The frame's pixels if it shows the open photo, else none: a frame left from
 *  the previous photo would read the wrong colours under the pointer. */
export function sampleOf(frame: SampledFrame | null, photoId: string | null): FrameSample | null {
  return frame && photoId !== null && frame.photoId === photoId ? frame.sample : null;
}

let session: StoreApi<Session> | null = null;

export function initStore(): void {
  session = api().stores.create<Session>((set) => ({
    target: false,
    frame: null,
    auto: "idle",
    setTarget: (target) => set(target ? { target } : { target, frame: null }),
    setFrame: (frame) => set({ frame }),
    setAuto: (auto) => set({ auto }),
  }));
}

export function store(): StoreApi<Session> {
  if (!session) throw new Error("[black-and-white] store() called before activate()");
  return session;
}
