import { useEffect, useRef, useState } from 'react';

const CELEBRATION_DURATION_MS = 2200;
const loadCanvasConfetti = () => import('canvas-confetti');
const prefersReducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssColor = (name, fallback) => {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};
const celebrationPalette = () => [
  cssColor('--color-accent', '#2563eb'),
  cssColor('--color-success', '#3f6658'),
  cssColor('--color-coin', '#facc15'),
  '#a855f7',
];

// Decorative only. Completion state and its existing success message remain authoritative.
export function CompletionCelebration({ event, duration = CELEBRATION_DURATION_MS, confettiLoader = loadCanvasConfetti }) {
  const [active, setActive] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const timers = useRef(new Set());
  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
  };
  useEffect(() => {
    if (!event || running.current || prefersReducedMotion()) return undefined;
    running.current = true;
    setActive(true);
    void confettiLoader().then((module) => {
      if (!mounted.current) return;
      const confetti = module.default ?? module;
      const colors = celebrationPalette();
      const shared = { colors, disableForReducedMotion: true, ticks: 105, zIndex: 120 };
      confetti({ ...shared, particleCount: 58, angle: 62, spread: 58, startVelocity: 46, origin: { x: 0.08, y: 0.86 } });
      confetti({ ...shared, particleCount: 58, angle: 118, spread: 58, startVelocity: 46, origin: { x: 0.92, y: 0.86 } });
      schedule(() => confetti({ ...shared, particleCount: 36, spread: 78, startVelocity: 34, origin: { x: 0.5, y: 0.56 } }), 180);
      schedule(() => confetti({ ...shared, particleCount: 24, spread: 96, startVelocity: 28, gravity: 0.9, origin: { x: 0.5, y: 0.4 } }), 430);
      schedule(() => {
        running.current = false;
        setActive(false);
      }, duration);
    }).catch(() => {
      if (!mounted.current) return;
      running.current = false;
      setActive(false);
    });
    return undefined;
  }, [event, duration, confettiLoader]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
      running.current = false;
    };
  }, []);
  return active ? <span className="completion-celebration" aria-hidden="true" hidden /> : null;
}
