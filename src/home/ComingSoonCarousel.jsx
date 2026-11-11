import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const comingSoonPromotions = Object.freeze([
  { id: 'code-visualizer', src: '/assets/home/coming-soon/coming-soon-1.svg', alt: 'Coming soon: Code Visualizer — see your code come to life.' },
  { id: 'ai-mock-interviews', src: '/assets/home/coming-soon/coming-soon-2.svg', alt: 'Coming soon: AI Mock Interviews — practice smarter, interview better, get hired.' },
  { id: 'ai-resume-builder', src: '/assets/home/coming-soon/coming-soon-3.svg', alt: 'Coming soon: AI Resume Builder — create a professional resume powered by AI.' },
]);

export const COMING_SOON_AUTOPLAY_MS = 5000;

export function ComingSoonCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerVersion, setTimerVersion] = useState(0);
  const count = comingSoonPromotions.length;

  useEffect(() => {
    if (paused) return undefined;
    const timer = globalThis.setInterval(() => setActiveIndex((current) => (current + 1) % count), COMING_SOON_AUTOPLAY_MS);
    return () => globalThis.clearInterval(timer);
  }, [count, paused, timerVersion]);

  const select = (index) => {
    setActiveIndex((index + count) % count);
    setTimerVersion((version) => version + 1);
  };

  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
  };

  return <section
    className="coming-soon-carousel"
    aria-label="Coming soon promotions"
    aria-roledescription="carousel"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)}
    onBlurCapture={handleBlur}
  >
    <div className="coming-soon-carousel__viewport">
      <div className="coming-soon-carousel__track" style={{ '--coming-soon-slide': activeIndex }}>
        {comingSoonPromotions.map((promotion, index) => <div
          className={`coming-soon-carousel__slide${index === activeIndex ? ' is-active' : ''}`}
          key={promotion.id}
          aria-hidden={index === activeIndex ? undefined : 'true'}
        >
          <img src={promotion.src} alt={index === activeIndex ? promotion.alt : ''} draggable="false" />
        </div>)}
      </div>
    </div>
    <button className="coming-soon-carousel__arrow coming-soon-carousel__arrow--previous" type="button" aria-label="Previous promotion" onClick={() => select(activeIndex - 1)}><ChevronLeft aria-hidden="true" size={18} /></button>
    <button className="coming-soon-carousel__arrow coming-soon-carousel__arrow--next" type="button" aria-label="Next promotion" onClick={() => select(activeIndex + 1)}><ChevronRight aria-hidden="true" size={18} /></button>
    <div className="coming-soon-carousel__dots" aria-label="Choose a promotion">
      {comingSoonPromotions.map((promotion, index) => <button key={promotion.id} type="button" aria-label={`Show promotion ${index + 1}`} aria-pressed={index === activeIndex} onClick={() => select(index)} />)}
    </div>
  </section>;
}
