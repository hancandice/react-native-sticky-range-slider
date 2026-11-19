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
    Math.max(
      decimalsOf(step),
      decimalsOf(min),
      decimalsOf(max),
      decimalsOf(minRange)
    )
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
 * Removes floating point noise without snapping: stepped sliders round to the
 * decimals of their props, continuous sliders (`step = 0`) keep 12
 * significant digits.
 */
export function cleanValue(value: number, config: RangeConfig): number {
  'worklet';
  const cleaned =
    config.step > 0
      ? roundTo(value, config.decimals)
      : Number(value.toPrecision(12));
  return clamp(cleaned, config.min, config.max);
}

/** Largest value on the step grid that is <= value (max counts as on the grid). */
export function gridFloor(value: number, config: RangeConfig): number {
  'worklet';
  const { min, max, step } = config;
  if (step <= 0 || value >= max) {
    return cleanValue(value, config);
  }
  const n = Math.floor((value - min) / step + 1e-9);
  return cleanValue(min + n * step, config);
}

/** Smallest value on the step grid that is >= value (max counts as on the grid). */
export function gridCeil(value: number, config: RangeConfig): number {
  'worklet';
  const { min, max, step } = config;
  if (step <= 0) {
    return cleanValue(value, config);
  }
  const n = Math.ceil((value - min) / step - 1e-9);
  const v = min + n * step;
  return v > max ? max : cleanValue(v, config);
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
      ? clamp(roundTo(lastOnGrid, decimals), min, max)
      : max;
  }
  const steps = Math.round((clamped - min) / step);
  return clamp(roundTo(min + steps * step, decimals), min, max);
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
  if (minRange <= 0) {
    return type === 'low' ? [min, high] : [low, max];
  }
  // keep the limits on the step grid so that both thumbs stay on it
  return type === 'low'
    ? [min, Math.max(min, gridFloor(high - minRange, config))]
    : [Math.min(max, gridCeil(low + minRange, config)), max];
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
  let low = snapToStep(finite(lowProp, min), config);
  let high = disableRange ? max : snapToStep(finite(highProp, max), config);
  if (disableRange) {
    return { low, high };
  }
  if (low > high) {
    const t = low;
    low = high;
    high = t;
  }
  if (high - low < minRange) {
    high = Math.min(max, gridCeil(low + minRange, config));
    if (high - low < minRange) {
      low = Math.max(min, gridFloor(high - minRange, config));
    }
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

/** Default label text: the value, with 2 decimals at most for continuous sliders. */
export function defaultFormat(value: number, config: RangeConfig): string {
  if (config.step > 0) {
    return String(value);
  }
  return String(Number(value.toFixed(2)));
}

/**
 * Left edge of a label of `width` centred on `center`, kept inside
 * `[0, containerWidth]`.
 */
export function labelLeft(
  center: number,
  width: number,
  containerWidth: number
): number {
  'worklet';
  if (width >= containerWidth) {
    return (containerWidth - width) / 2;
  }
  return clamp(center - width / 2, 0, containerWidth - width);
}

/** Whether two labels centred on the thumbs would touch (with `gap` between them). */
export function labelsCollide(
  lowCenter: number,
  lowWidth: number,
  highCenter: number,
  highWidth: number,
  containerWidth: number,
  gap: number
): boolean {
  'worklet';
  const lowLeft = labelLeft(lowCenter, lowWidth, containerWidth);
  const highLeft = labelLeft(highCenter, highWidth, containerWidth);
  const [a, aw, b] =
    lowLeft <= highLeft
      ? [lowLeft, lowWidth, highLeft]
      : [highLeft, highWidth, lowLeft];
  return a + aw + gap > b;
}
