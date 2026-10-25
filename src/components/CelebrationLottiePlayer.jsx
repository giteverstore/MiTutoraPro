import { useCallback, useEffect, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const CELEBRATION_ASSET = '/assets/animations/celebration.lottie';

export default function CelebrationLottiePlayer({ onComplete }) {
  const player = useRef(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const handleComplete = useCallback(() => complete.current(), []);
  const detach = useCallback(() => {
    player.current?.removeEventListener('complete', handleComplete);
    player.current = null;
  }, [handleComplete]);
  const attach = useCallback((instance) => {
    detach();
    player.current = instance;
    instance?.addEventListener('complete', handleComplete);
  }, [detach, handleComplete]);
  useEffect(() => detach, [detach]);
  return <DotLottieReact src={CELEBRATION_ASSET} autoplay loop={false} dotLottieRefCallback={attach} className="completion-celebration__player" />;
}
