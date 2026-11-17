import type { Transition } from 'framer-motion';

/**
 * Apple expresses springs as damping + response rather than mass/stiffness.
 * Motion's `bounce` + `duration` map onto that: bounce 0 is critically damped
 * (no overshoot), and duration is the response time, not a fixed length.
 */
export const spring = (bounce: number, duration: number): Transition => ({
  type: 'spring',
  bounce,
  duration,
});

/** Default for anything the user did not throw: graceful, no overshoot. */
export const SPRING_UI = spring(0, 0.35);

/** Sheets and drawers, per Apple's own values (damping 0.8 / response 0.3). */
export const SPRING_SHEET = spring(0.18, 0.3);

/** Only for motion that followed a flick — overshoot has to be earned. */
export const SPRING_MOMENTUM = spring(0.22, 0.4);

/** Reduced motion keeps the state change legible but removes the travel. */
export const REDUCED_TRANSITION: Transition = { duration: 0.14, ease: 'easeOut' };

/**
 * Apple's momentum projection from *Designing Fluid Interfaces*: where the
 * finger would come to rest, not where it was released. The textbook
 * v²/(2·decel) form is not what iOS ships.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary — real things slow before they stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
