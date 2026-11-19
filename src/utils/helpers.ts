/**
 * Pure, worklet-safe helpers for the range slider.
 *
 * "Position" is the distance (in points) of a thumb's start edge from the
 * start of the track, in the range `[0, trackLength]` where
 * `trackLength = containerWidth - thumbWidth`.
 */

export type ThumbType = 'low' | 'high';

export interface RangeConfig {
  min: number;
  max: number;
  /** 0 = continuous */
  step: number;
  minRange: number;
  /** decimals used to remove floating point noise (0.1 + 0.2) */
  decimals: number;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/** Number of decimals of a number, e.g. 0.25 -> 2, 1e-7 -> 7. */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) {
    return 0;
  }
  const text = String(value).toLowerCase();
  const [base = '', exponent] = text.split('e');
  const fraction = base.split('.')[1]?.length ?? 0;
  const exp = exponent ? parseInt(exponent, 10) : 0;
  return Math.max(0, fraction - exp);
}

const finite = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Repairs inconsistent props so the slider never ends up in an invalid state. */
export function normalizeConfig(
  minProp: number,
  maxProp: number,
  stepProp: number | undefined,
  minRangeProp: number | undefined
): RangeConfig {
  const min = finite(minProp, 0);
  const max = Math.max(finite(maxProp, min), min);
  const range = max - min;
  const rawStep = finite(stepProp, 0);
  const step = rawStep > 0 ? rawStep : 0;
  const minRange = clamp(finite(minRangeProp, 0), 0, range);
  const decimals = Math.min(
    12,
    Math.max(decimalsOf(step), decimalsOf(min), decimalsOf(minRange))
  );
  return { min, max, step, minRange, decimals };
}

/** Rounds away floating point noise, e.g. 0.30000000000000004 -> 0.3. */
export function roundTo(value: number, decimals: number): number {
  'worklet';
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Snaps a value to the closest step inside `[min, max]`. `max` is always
 * reachable, even when the range is not a multiple of the step.
 */
export function snapToStep(value: number, config: RangeConfig): number {
  'worklet';
  const { min, max, step, decimals } = config;
  const clamped = clamp(value, min, max);
  if (step <= 0 || max === min) {
    return clamped;
  }
  const lastStep = Math.floor((max - min) / step + 1e-9);
  const lastOnGrid = min + lastStep * step;
  // between the last grid value and max: snap to the closer of the two
  if (clamped > lastOnGrid) {
    return clamped - lastOnGrid < max - clamped
      ? roundTo(lastOnGrid, decimals)
      : max;
  }
  const steps = Math.round((clamped - min) / step);
  return roundTo(clamp(min + steps * step, min, max), decimals);
}

/** Thumb position for a value. */
export function valueToPosition(
  value: number,
  min: number,
  max: number,
  trackLength: number
): number {
  'worklet';
  if (max <= min || trackLength <= 0) {
    return 0;
  }
  return clamp(((value - min) / (max - min)) * trackLength, 0, trackLength);
}

/** Snapped value for a thumb position. */
export function positionToValue(
  position: number,
  trackLength: number,
  config: RangeConfig
): number {
  'worklet';
  const { min, max } = config;
  if (trackLength <= 0 || max <= min) {
    return min;
  }
  const ratio = clamp(position / trackLength, 0, 1);
  return snapToStep(min + ratio * (max - min), config);
}

/** Values one thumb may take, given the other one. */
export function limitsFor(
  type: ThumbType,
  low: number,
  high: number,
  config: RangeConfig,
  disableRange: boolean
): [number, number] {
  'worklet';
  const { min, max, minRange } = config;
  if (disableRange) {
    return [min, max];
  }
  return type === 'low'
    ? [min, Math.max(min, high - minRange)]
    : [Math.min(max, low + minRange), max];
}

/**
 * Which thumb a touch at `x` should move. When both thumbs are drawn at the
 * same place the answer depends on the drag direction, so `'tie'` is returned.
 */
export function pickThumb(
  x: number,
  lowCenter: number,
  highCenter: number
): ThumbType | 'tie' {
  'worklet';
  if (Math.abs(lowCenter - highCenter) < 0.5) {
    return 'tie';
  }
  return Math.abs(x - lowCenter) <= Math.abs(x - highCenter) ? 'low' : 'high';
}

/**
 * Resolves a tie: moving towards larger values picks the high thumb.
 * `direction` is the sign of the movement in value space.
 */
export function resolveTie(direction: number, atMax: boolean): ThumbType {
  'worklet';
  if (direction > 0) {
    return atMax ? 'low' : 'high';
  }
  if (direction < 0) {
    return 'low';
  }
  return atMax ? 'low' : 'high';
}

/**
 * Normalizes incoming `low`/`high` props: clamps them to the range, keeps
 * `low <= high` and the minimum distance.
 */
export function normalizeValues(
  lowProp: number | undefined,
  highProp: number | undefined,
  config: RangeConfig,
  disableRange: boolean
): { low: number; high: number } {
  const { min, max, minRange } = config;
  let low = clamp(finite(lowProp, min), min, max);
  let high = disableRange ? max : clamp(finite(highProp, max), min, max);
  if (disableRange) {
    return { low, high };
  }
  if (low > high) {
    const t = low;
    low = high;
    high = t;
  }
  if (high - low < minRange) {
    high = Math.min(max, low + minRange);
    low = Math.max(min, high - minRange);
  }
  return { low, high };
}

/** Step used by accessibility increment/decrement actions. */
export function accessibilityStep(config: RangeConfig): number {
  if (config.step > 0) {
    return config.step;
  }
  const range = config.max - config.min;
  return range > 0 ? range / 100 : 0;
}
