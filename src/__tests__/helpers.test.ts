import {
  accessibilityStep,
  clamp,
  decimalsOf,
  limitsFor,
  normalizeConfig,
  normalizeValues,
  pickThumb,
  positionToValue,
  resolveTie,
  roundTo,
  snapToStep,
  valueToPosition,
} from '../utils/helpers';

const cfg = (min: number, max: number, step: number, minRange = 0) =>
  normalizeConfig(min, max, step, minRange);

describe('clamp / roundTo / decimalsOf', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
  });
  it('rounds away floating point noise', () => {
    expect(roundTo(0.1 + 0.2, 1)).toBe(0.3);
  });
  it('counts decimals', () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(1e-7)).toBe(7);
    expect(decimalsOf(NaN)).toBe(0);
  });
});

describe('normalizeConfig', () => {
  it('repairs bad props', () => {
    expect(normalizeConfig(10, 5, -1, 100)).toEqual({
      min: 10,
      max: 10,
      step: 0,
      minRange: 0,
      decimals: 0,
    });
    expect(normalizeConfig(0, 10, NaN, 20).minRange).toBe(10);
  });
});

describe('snapToStep', () => {
  it('snaps to the closest step', () => {
    const c = cfg(0, 100, 10);
    expect(snapToStep(14, c)).toBe(10);
    expect(snapToStep(15, c)).toBe(20);
    expect(snapToStep(-3, c)).toBe(0);
    expect(snapToStep(130, c)).toBe(100);
  });
  it('works with decimal steps', () => {
    const c = cfg(0, 1, 0.1);
    expect(snapToStep(0.33, c)).toBe(0.3);
    expect(snapToStep(0.7000001, c)).toBe(0.7);
  });
  it('keeps max reachable when the range is not a multiple of step', () => {
    const c = cfg(0, 10, 3);
    expect(snapToStep(9.2, c)).toBe(9);
    expect(snapToStep(9.8, c)).toBe(10);
    expect(snapToStep(10, c)).toBe(10);
  });
  it('handles a step larger than the range', () => {
    const c = cfg(0, 5, 7);
    expect(snapToStep(2, c)).toBe(0);
    expect(snapToStep(3, c)).toBe(5);
  });
  it('is continuous with step 0', () => {
    expect(snapToStep(3.14159, cfg(0, 10, 0))).toBe(3.14159);
  });
  it('handles min == max', () => {
    expect(snapToStep(4, cfg(3, 3, 1))).toBe(3);
  });
  it('handles negative ranges', () => {
    expect(snapToStep(-7.4, cfg(-10, 10, 0.5))).toBe(-7.5);
  });
});

describe('valueToPosition / positionToValue', () => {
  it('maps values to positions linearly', () => {
    expect(valueToPosition(50, 0, 100, 300)).toBe(150);
    expect(valueToPosition(200, 0, 100, 300)).toBe(300);
    expect(valueToPosition(5, 5, 5, 300)).toBe(0);
    expect(valueToPosition(5, 0, 10, 0)).toBe(0);
  });
  it('round-trips through the step grid', () => {
    const c = cfg(18, 60, 1);
    for (let v = 18; v <= 60; v++) {
      expect(positionToValue(valueToPosition(v, 18, 60, 333), 333, c)).toBe(v);
    }
  });
  it('clamps positions outside the track', () => {
    const c = cfg(0, 10, 1);
    expect(positionToValue(-50, 100, c)).toBe(0);
    expect(positionToValue(500, 100, c)).toBe(10);
    expect(positionToValue(50, 0, c)).toBe(0);
  });
});

describe('limitsFor', () => {
  const c = cfg(0, 100, 1, 10);
  it('keeps the thumbs apart by minRange', () => {
    expect(limitsFor('low', 20, 50, c, false)).toEqual([0, 40]);
    expect(limitsFor('high', 20, 50, c, false)).toEqual([30, 100]);
  });
  it('never returns an inverted interval', () => {
    expect(limitsFor('low', 0, 5, c, false)).toEqual([0, 0]);
    expect(limitsFor('high', 95, 100, c, false)).toEqual([100, 100]);
  });
  it('ignores the other thumb with disableRange', () => {
    expect(limitsFor('low', 20, 50, c, true)).toEqual([0, 100]);
  });
});

describe('pickThumb / resolveTie', () => {
  it('picks the closest thumb', () => {
    expect(pickThumb(10, 0, 100)).toBe('low');
    expect(pickThumb(90, 0, 100)).toBe('high');
    expect(pickThumb(50, 0, 100)).toBe('low');
  });
  it('reports a tie when the thumbs overlap', () => {
    expect(pickThumb(50, 50, 50)).toBe('tie');
  });
  it('resolves a tie with the drag direction', () => {
    expect(resolveTie(1, false)).toBe('high');
    expect(resolveTie(-1, false)).toBe('low');
    expect(resolveTie(1, true)).toBe('low');
    expect(resolveTie(0, false)).toBe('high');
  });
});

describe('normalizeValues', () => {
  const c = cfg(0, 100, 1, 10);
  it('defaults to the full range', () => {
    expect(normalizeValues(undefined, undefined, c, false)).toEqual({
      low: 0,
      high: 100,
    });
  });
  it('clamps, orders and enforces minRange', () => {
    expect(normalizeValues(-5, 500, c, false)).toEqual({ low: 0, high: 100 });
    expect(normalizeValues(50, 20, c, false)).toEqual({ low: 20, high: 50 });
    expect(normalizeValues(50, 52, c, false)).toEqual({ low: 50, high: 60 });
    expect(normalizeValues(98, 99, c, false)).toEqual({ low: 90, high: 100 });
  });
  it('pins high to max with disableRange', () => {
    expect(normalizeValues(40, 50, c, true)).toEqual({ low: 40, high: 100 });
  });
});

describe('accessibilityStep', () => {
  it('uses the step, or 1% of the range for continuous sliders', () => {
    expect(accessibilityStep(cfg(0, 10, 2))).toBe(2);
    expect(accessibilityStep(cfg(0, 200, 0))).toBe(2);
    expect(accessibilityStep(cfg(5, 5, 0))).toBe(0);
  });
});
