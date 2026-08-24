# Error Handling and Recovery

MiTutora uses layered React error boundaries so a render failure is contained at the smallest useful domain while preserving the learner's surrounding context.

- `GlobalErrorBoundary` protects application startup and provides a final recovery path.
- AppShell page boundaries keep shared navigation available when one page fails.
- Learning, compiler, Practice, Challenges, and exam boundaries isolate higher-risk content and runtime surfaces.

Recovery states use semantic alerts, move focus to the recovery heading, and offer a targeted retry plus an optional back action. A diagnostic ID helps correlate reports without exposing stack traces or implementation details. Detailed error logging is development-only; existing typed service/content errors and user-facing async states remain responsible for non-render failures.

Error boundaries do not catch arbitrary event-handler or detached asynchronous errors. Those paths must reject with typed errors and surface their own actionable state.
