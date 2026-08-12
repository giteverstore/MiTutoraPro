# Proctoring audio evidence

MiTutora processes microphone samples locally. Silero VAD supplies speech probability; secondary browser-side heuristics estimate sustained music, media, ambient noise, and keyboard-like transient activity. Raw audio is neither persisted nor sent to Firebase.

Keyboard evidence is intentionally temporal. A high-crest, high-frequency impulse is recorded as a transient candidate, but it cannot become a typing condition unless enough candidates form a continuous cluster for the configured persistence period. Isolated clicks and short taps are suppressed before they reach the monitoring lifecycle. Once active, a typing condition is represented by one lifecycle violation that updates until recovery rather than generating an event per audio frame.

These heuristics are evidence signals, not sound identification guarantees. Mouse and trackpad clicks, mechanical and laptop keyboards, desk vibration, fans, air conditioning, music, and background conversations can overlap acoustically. Classification therefore combines confidence, temporal persistence, duration, and context. Silero speech probability remains independent from transient filtering and is never replaced by volume-only classification.

The candidate camera preview reuses the same local `CameraService` stream consumed by vision inference. It does not request a second stream, record video, retain frames, or upload camera media.
