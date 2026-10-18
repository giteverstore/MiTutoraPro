// Opt-in local investigation marks; excluded from production behavior.
export function phase5Mark(name, detail) {
  if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e')
    && globalThis.__YCODERS_PHASE5_TRACE__ === true) {
    globalThis.performance?.mark(`phase5:${name}`, detail ? { detail } : undefined);
  }
}
