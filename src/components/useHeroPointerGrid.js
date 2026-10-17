import { useEffect, useRef } from 'react';

export function useHeroPointerGrid() {
  const heroRef = useRef(null);
  const heroRectRef = useRef(null);
  const heroPointerRef = useRef(null);
  const heroFrameRef = useRef(0);

  useEffect(() => () => window.cancelAnimationFrame(heroFrameRef.current), []);

  const onPointerEnter = (event) => {
    if (event.pointerType === 'touch') return;
    heroRectRef.current = heroRef.current?.getBoundingClientRect() ?? null;
    heroRef.current?.classList.add('is-pointer-active');
  };

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return;
    heroPointerRef.current = { x: event.clientX, y: event.clientY };
    if (heroFrameRef.current) return;
    heroFrameRef.current = window.requestAnimationFrame(() => {
      heroFrameRef.current = 0;
      const rect = heroRectRef.current;
      const pointer = heroPointerRef.current;
      if (!rect || !pointer || !heroRef.current) return;
      heroRef.current.style.setProperty('--hero-pointer-x', `${pointer.x - rect.left}px`);
      heroRef.current.style.setProperty('--hero-pointer-y', `${pointer.y - rect.top}px`);
    });
  };

  const onPointerLeave = (event) => {
    if (event.pointerType === 'touch') return;
    heroRef.current?.classList.remove('is-pointer-active');
  };

  return { heroRef, onPointerEnter, onPointerMove, onPointerLeave };
}
