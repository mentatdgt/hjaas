// The 10/10 finale: a gentle shower of tiny mushrooms over the room, under a second and a half.
import { asset } from './assets';
import { gsap } from './motion';

const COUNT = 16;
const ARTS = [1, 2, 4, 7, 8, 3, 9, 6];

/** Lets tiny mushrooms fall through `area` (a screen rect) inside `layer`. Cleans up after itself. */
export function shower(layer: HTMLElement, area: DOMRect): void {
  const origin = layer.getBoundingClientRect();
  const left = area.left - origin.left;
  const top = area.top - origin.top;
  const pieces: HTMLImageElement[] = [];
  const timeline = gsap.timeline({ onComplete: () => pieces.forEach((piece) => piece.remove()) });

  for (let i = 0; i < COUNT; i++) {
    const piece = document.createElement('img');
    piece.className = 'hj-confetti';
    piece.src = asset(`mushrooms/mushroom_${String(ARTS[i % ARTS.length]).padStart(2, '0')}.webp`);
    piece.alt = '';
    const size = 15 + Math.random() * 11;
    // Spread across the width, each one nudged off its column so the fall never reads as a grid.
    const x = left + ((i + 0.5 + (Math.random() - 0.5) * 0.9) / COUNT) * area.width;
    piece.style.height = `${size}px`;
    piece.style.left = `${x}px`;
    piece.style.top = `${top - 30}px`;
    layer.append(piece);
    pieces.push(piece);

    const start = Math.pow(Math.random(), 1.4) * 0.42; // most start early, a few trail in
    const fall = 0.82 + Math.random() * 0.22;
    const drop = area.height * (0.42 + Math.random() * 0.36) + 30;
    const spin = (Math.random() - 0.5) * 90;
    timeline.fromTo(
      piece,
      { y: 0, x: 0, rotation: spin * 0.3, opacity: 0 },
      { y: drop, x: (Math.random() - 0.5) * 46, rotation: spin, duration: fall, ease: 'sine.in' },
      start,
    );
    timeline.to(piece, { opacity: 1, duration: 0.1, ease: 'none' }, start);
    timeline.to(piece, { opacity: 0, duration: fall * 0.34, ease: 'none' }, start + fall * 0.66);
  }
}
