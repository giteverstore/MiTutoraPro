import { useEffect, useRef } from 'react';
import lottie from 'lottie-web/build/player/lottie_light_canvas';

const FIRE_ASSET = '/assets/animations/daily-challenge-fire.json';

export default function DailyChallengeFirePlayer() {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const animation = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'canvas',
      path: FIRE_ASSET,
      autoplay: true,
      loop: true,
      rendererSettings: {
        clearCanvas: true,
        preserveAspectRatio: 'xMidYMid meet',
      },
    });
    return () => animation.destroy();
  }, []);
  return <div ref={containerRef} className="challenge-completion-fire-canvas" />;
}
