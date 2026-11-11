// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMING_SOON_AUTOPLAY_MS, ComingSoonCarousel, comingSoonPromotions } from '../../src/home/ComingSoonCarousel';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const activeSlide = (container) => container.querySelector('.coming-soon-carousel__slide.is-active');

describe('Home Coming Soon carousel', () => {
  it('renders all configured SVG promotions with one active slide', () => {
    const { container } = render(<ComingSoonCarousel />);
    expect(comingSoonPromotions).toHaveLength(3);
    expect(container.querySelectorAll('.coming-soon-carousel__slide')).toHaveLength(3);
    expect(container.querySelectorAll('.coming-soon-carousel__slide.is-active')).toHaveLength(1);
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-1.svg');
    expect(container.querySelectorAll('.coming-soon-carousel__slide[aria-hidden="true"]')).toHaveLength(2);
  });

  it('supports wrapping previous/next navigation and direct dot selection', () => {
    const { container } = render(<ComingSoonCarousel />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous promotion' }));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-3.svg');
    fireEvent.click(screen.getByRole('button', { name: 'Next promotion' }));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-1.svg');
    fireEvent.click(screen.getByRole('button', { name: 'Show promotion 2' }));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-2.svg');
    expect(screen.getByRole('button', { name: 'Show promotion 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('autoplays every five seconds and pauses while hovered or focused', () => {
    vi.useFakeTimers();
    const { container } = render(<ComingSoonCarousel />);
    const carousel = screen.getByRole('region', { name: 'Coming soon promotions' });
    act(() => vi.advanceTimersByTime(COMING_SOON_AUTOPLAY_MS));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-2.svg');
    fireEvent.mouseEnter(carousel);
    act(() => vi.advanceTimersByTime(COMING_SOON_AUTOPLAY_MS));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-2.svg');
    fireEvent.mouseLeave(carousel);
    act(() => vi.advanceTimersByTime(COMING_SOON_AUTOPLAY_MS));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-3.svg');
    fireEvent.focus(screen.getByRole('button', { name: 'Next promotion' }));
    act(() => vi.advanceTimersByTime(COMING_SOON_AUTOPLAY_MS));
    expect(activeSlide(container).querySelector('img')).toHaveAttribute('src', '/assets/home/coming-soon/coming-soon-3.svg');
  });

  it('uses a bounded responsive track and disables motion for reduced-motion users', () => {
    const css = readFileSync('src/styles/pages/home.css', 'utf8');
    expect(css).toMatch(/\.coming-soon-carousel__track \{[\s\S]*?transition: transform 500ms ease;/);
    expect(css).toMatch(/\.coming-soon-carousel__slide img \{[\s\S]*?width: 100%;[\s\S]*?height: auto;[\s\S]*?object-fit: contain;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.coming-soon-carousel__track[\s\S]*?transition: none;/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*?\.home-dashboard-aside \{[\s\S]*?width: 100%;/);
  });
});
