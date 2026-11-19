import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  I18nManager,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type Insets,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  accessibilityStep,
  clamp,
  limitsFor,
  normalizeConfig,
  normalizeValues,
  pickThumb,
  positionToValue,
  resolveTie,
  roundTo,
  valueToPosition,
  type ThumbType,
} from '../utils/helpers';
import Rail from './Rail';
import RailSelected from './RailSelected';
import TextValue from './TextValue';
import Thumb from './Thumb';

export interface RangeSliderProps extends ViewProps {
  /** Smallest selectable value. */
  min: number;
  /** Largest selectable value. */
  max: number;
  /**
   * Distance between selectable values. Use `0` for a continuous slider.
   * `max` is always selectable, even if `max - min` is not a multiple of `step`.
   */
  step: number;
  /** Minimum distance between `low` and `high`. Ignored when `disableRange`. @default 0 */
  minRange?: number;
  /**
   * Value of the low thumb. When provided the slider follows this prop
   * (controlled); otherwise it keeps its own state starting at `min`.
   */
  low?: number;
  /** Value of the high thumb. Controlled like `low`; defaults to `max`. */
  high?: number;
  /**
   * Called whenever the user changes a value (drag, tap, accessibility
   * action) – once per step, not on every frame. Not called for prop changes.
   */
  onValueChanged?: (low: number, high: number) => void;
  /** Called when the user starts dragging a thumb. */
  onSlidingStart?: (thumb: ThumbType) => void;
  /** Called once the user releases the thumb (or after a tap / accessibility action). */
  onSlidingComplete?: (low: number, high: number) => void;
  /** Renders a thumb. Both thumbs should have the same width. */
  renderThumb?: (type: ThumbType) => ReactNode;
  /** Renders the full rail. Should stretch (`flex: 1`). */
  renderRail?: () => ReactNode;
  /** Renders the selected part of the rail. */
  renderRailSelected?: () => ReactNode;
  /** Renders the label that follows the low thumb. Return `null` to hide it. */
  renderLowValue?: (low: number) => ReactNode;
  /** Renders the label that follows the high thumb. Return `null` to hide it. */
  renderHighValue?: (high: number) => ReactNode;
  /** Use a single thumb (`low`) instead of a range. @default false */
  disableRange?: boolean;
  /** Ignore user interaction. @default false */
  disabled?: boolean;
  /**
   * Lay the slider out from right to left (`min` on the right).
   * @default I18nManager.isRTL
   */
  inverted?: boolean;
  /**
   * Extra touchable area around the slider. The slider itself is at least
   * 44 points tall. @default { horizontal: 12, vertical: 8 }
   */
  hitSlop?: Insets | number;
  /** Accessibility label of a thumb. @default 'Minimum' / 'Maximum' ('Value' with disableRange) */
  thumbAccessibilityLabel?: (type: ThumbType) => string;
  /** Text read by screen readers for a value. @default String(value) */
  formatAccessibilityValue?: (value: number) => string;
  /**
   * @deprecated No longer used: the whole slider (at least 44pt tall) is
   * touchable. Use `hitSlop` to enlarge it.
   */
  pannableAreaStyle?: StyleProp<ViewStyle>;
}

/** @deprecated Use `RangeSliderProps`. */
export type SliderProps = RangeSliderProps;

const MIN_TOUCH_SIZE = 44;
const DEFAULT_HIT_SLOP: Insets = {
  top: 8,
  bottom: 8,
  left: 12,
  right: 12,
};

const LOW = 1;
const HIGH = 2;
const TIE = 3;

const defaultRenderThumb = () => <Thumb />;
const defaultRenderRail = () => <Rail />;
const defaultRenderRailSelected = () => <RailSelected />;
const defaultRenderValue = (value: number) => <TextValue value={value} />;
const defaultLabel = (type: ThumbType, disableRange: boolean) =>
  disableRange ? 'Value' : type === 'low' ? 'Minimum' : 'Maximum';

const toHitSlop = (slop: Insets | number | undefined) => {
  const s =
    typeof slop === 'number'
      ? { top: slop, bottom: slop, left: slop, right: slop }
      : (slop ?? DEFAULT_HIT_SLOP);
  return {
    top: s.top ?? 0,
    bottom: s.bottom ?? 0,
    left: s.left ?? 0,
    right: s.right ?? 0,
  };
};

const RangeSlider = ({
  min: minProp,
  max: maxProp,
  step: stepProp,
  minRange: minRangeProp = 0,
  low: lowProp,
  high: highProp,
  onValueChanged,
  onSlidingStart,
  onSlidingComplete,
  renderThumb = defaultRenderThumb,
  renderRail = defaultRenderRail,
  renderRailSelected = defaultRenderRailSelected,
  renderLowValue = defaultRenderValue,
  renderHighValue = defaultRenderValue,
  disableRange = false,
  disabled = false,
  inverted = I18nManager.isRTL,
  hitSlop,
  thumbAccessibilityLabel,
  formatAccessibilityValue,
  pannableAreaStyle,
  ...restProps
}: RangeSliderProps) => {
  const config = useMemo(
    () =>
      normalizeConfig(
        minProp,
        maxProp,
        stepProp,
        disableRange ? 0 : minRangeProp
      ),
    [disableRange, maxProp, minProp, minRangeProp, stepProp]
  );

  if (__DEV__ && pannableAreaStyle != null) {
    warnOnce(
      'react-native-sticky-range-slider: `pannableAreaStyle` is deprecated and ignored. The whole slider is touchable; use `hitSlop` to enlarge it.'
    );
  }

  const initial = useMemo(
    () => normalizeValues(lowProp, highProp, config, disableRange),
    // only for the very first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // values rendered by React (labels, accessibility); updated once per step
  const [display, setDisplay] = useState(initial);

  // UI thread state
  const low = useSharedValue(initial.low);
  const high = useSharedValue(initial.high);
  const active = useSharedValue(0);
  const grabOffset = useSharedValue(0);
  const trackLength = useSharedValue(0);
  const thumbSize = useSharedValue(0);

  const [containerWidth, setContainerWidth] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);

  // latest callbacks without re-creating the gestures on every render
  const callbacks = useRef({
    onValueChanged,
    onSlidingStart,
    onSlidingComplete,
  });
  callbacks.current = { onValueChanged, onSlidingStart, onSlidingComplete };

  // Props that change while the user drags are applied once the drag ends.
  const pendingSync = useRef(false);
  const [syncTick, setSyncTick] = useState(0);

  // Sync with props (controlled) or re-validate internal state (uncontrolled).
  useEffect(() => {
    if (active.value !== 0) {
      pendingSync.current = true;
      return;
    }
    const next = normalizeValues(
      lowProp ?? low.value,
      highProp ?? high.value,
      config,
      disableRange
    );
    low.value = next.low;
    high.value = next.high;
    setDisplay((prev) =>
      prev.low === next.low && prev.high === next.high ? prev : next
    );
  }, [active, config, disableRange, high, highProp, low, lowProp, syncTick]);

  useEffect(() => {
    trackLength.value = Math.max(0, containerWidth - thumbWidth);
    thumbSize.value = thumbWidth;
  }, [containerWidth, thumbSize, thumbWidth, trackLength]);

  const handleChange = useCallback((l: number, h: number) => {
    setDisplay({ low: l, high: h });
    callbacks.current.onValueChanged?.(l, h);
  }, []);

  const handleStart = useCallback((type: ThumbType) => {
    callbacks.current.onSlidingStart?.(type);
  }, []);

  const handleComplete = useCallback((l: number, h: number) => {
    callbacks.current.onSlidingComplete?.(l, h);
    if (pendingSync.current) {
      pendingSync.current = false;
      setSyncTick((t) => t + 1);
    }
  }, []);

  const slop = toHitSlop(hitSlop);
  const {
    top: slopTop,
    bottom: slopBottom,
    left: slopLeft,
    right: slopRight,
  } = slop;

  const gesture = useMemo(() => {
    /** Logical position (0 = min side) of a thumb's start edge under touch x. */
    const logicalPosition = (x: number) => {
      'worklet';
      const raw = x - thumbSize.value / 2;
      return inverted ? trackLength.value - raw : raw;
    };

    /** Moves a thumb to a logical position; returns true when the value changed. */
    const moveTo = (type: number, position: number) => {
      'worklet';
      const thumb: ThumbType = type === HIGH ? 'high' : 'low';
      const [lo, hi] = limitsFor(
        thumb,
        low.value,
        high.value,
        config,
        disableRange
      );
      const value = roundTo(
        clamp(positionToValue(position, trackLength.value, config), lo, hi),
        config.decimals
      );
      const target = type === HIGH ? high : low;
      if (target.value === value) {
        return;
      }
      target.value = value;
      runOnJS(handleChange)(low.value, high.value);
    };

    const choose = (x: number, direction: number) => {
      'worklet';
      if (disableRange) {
        return LOW;
      }
      const track = trackLength.value;
      const half = thumbSize.value / 2;
      const lowPos = valueToPosition(low.value, config.min, config.max, track);
      const highPos = valueToPosition(
        high.value,
        config.min,
        config.max,
        track
      );
      const picked = pickThumb(
        logicalPosition(x) + half,
        lowPos + half,
        highPos + half
      );
      if (picked === 'tie') {
        if (direction === 0) {
          return TIE;
        }
        return resolveTie(direction, high.value >= config.max) === 'high'
          ? HIGH
          : LOW;
      }
      return picked === 'high' ? HIGH : LOW;
    };

    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .hitSlop({
        top: slopTop,
        bottom: slopBottom,
        left: slopLeft,
        right: slopRight,
      })
      .onStart((e) => {
        'worklet';
        const startX = e.x - e.translationX;
        const dx = inverted ? -e.translationX : e.translationX;
        const type = choose(startX, Math.sign(dx));
        active.value = type === TIE ? LOW : type;
        const track = trackLength.value;
        const value = active.value === HIGH ? high.value : low.value;
        const thumbPos = valueToPosition(value, config.min, config.max, track);
        const offset = logicalPosition(startX) - thumbPos;
        // grabbing the thumb itself must not make it jump
        grabOffset.value =
          Math.abs(offset) <= thumbSize.value / 2 + 8 ? offset : 0;
        runOnJS(handleStart)(active.value === HIGH ? 'high' : 'low');
        moveTo(active.value, logicalPosition(e.x) - grabOffset.value);
      })
      .onUpdate((e) => {
        'worklet';
        if (active.value === 0) {
          return;
        }
        moveTo(active.value, logicalPosition(e.x) - grabOffset.value);
      })
      .onFinalize(() => {
        'worklet';
        if (active.value === 0) {
          return;
        }
        active.value = 0;
        runOnJS(handleComplete)(low.value, high.value);
      });

    const tap = Gesture.Tap()
      .enabled(!disabled)
      .maxDistance(8)
      .hitSlop({
        top: slopTop,
        bottom: slopBottom,
        left: slopLeft,
        right: slopRight,
      })
      .onEnd((e, success) => {
        'worklet';
        if (!success) {
          return;
        }
        let type = choose(e.x, 0);
        if (type === TIE) {
          const track = trackLength.value;
          const pos = valueToPosition(low.value, config.min, config.max, track);
          type = logicalPosition(e.x) > pos ? HIGH : LOW;
          if (type === HIGH && high.value >= config.max) {
            type = LOW;
          }
        }
        moveTo(type, logicalPosition(e.x));
        runOnJS(handleComplete)(low.value, high.value);
      });

    return Gesture.Race(pan, tap);
  }, [
    active,
    config,
    disableRange,
    disabled,
    grabOffset,
    handleChange,
    handleComplete,
    handleStart,
    high,
    slopBottom,
    slopLeft,
    slopRight,
    slopTop,
    inverted,
    low,
    thumbSize,
    trackLength,
  ]);

  // physical (left-to-right) position of a thumb
  const lowStyle = useAnimatedStyle(() => {
    const track = trackLength.value;
    const pos = valueToPosition(low.value, config.min, config.max, track);
    return { transform: [{ translateX: inverted ? track - pos : pos }] };
  });

  const highStyle = useAnimatedStyle(() => {
    const track = trackLength.value;
    const pos = valueToPosition(high.value, config.min, config.max, track);
    return { transform: [{ translateX: inverted ? track - pos : pos }] };
  });

  const selectedStyle = useAnimatedStyle(() => {
    const track = trackLength.value;
    const lowPos = valueToPosition(low.value, config.min, config.max, track);
    const highPos = disableRange
      ? 0
      : valueToPosition(high.value, config.min, config.max, track);
    let start: number;
    let end: number;
    if (disableRange) {
      start = 0;
      end = lowPos;
    } else {
      start = lowPos;
      end = highPos;
    }
    if (inverted) {
      const s = track - end;
      end = track - start;
      start = s;
    }
    return { left: start, width: Math.max(0, end - start) };
  });

  const handleContainerLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      setContainerWidth(nativeEvent.layout.width);
    },
    []
  );

  const handleThumbLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      setThumbWidth(nativeEvent.layout.width);
      setThumbHeight(nativeEvent.layout.height);
    },
    []
  );

  const a11yStep = accessibilityStep(config);
  const format = formatAccessibilityValue ?? String;

  const onAccessibilityAction = useCallback(
    (type: ThumbType, event: AccessibilityActionEvent) => {
      if (disabled) {
        return;
      }
      const { actionName } = event.nativeEvent;
      const delta =
        actionName === 'increment'
          ? a11yStep
          : actionName === 'decrement'
            ? -a11yStep
            : 0;
      if (delta === 0) {
        return;
      }
      const [lo, hi] = limitsFor(
        type,
        low.value,
        high.value,
        config,
        disableRange
      );
      const current = type === 'low' ? low.value : high.value;
      const next = roundTo(clamp(current + delta, lo, hi), config.decimals);
      if (next === current) {
        return;
      }
      if (type === 'low') {
        low.value = next;
      } else {
        high.value = next;
      }
      handleChange(low.value, high.value);
      handleComplete(low.value, high.value);
    },
    [
      a11yStep,
      config,
      disableRange,
      disabled,
      handleChange,
      handleComplete,
      high,
      low,
    ]
  );

  const thumbA11y = (type: ThumbType) => {
    const [lo, hi] = limitsFor(
      type,
      display.low,
      display.high,
      config,
      disableRange
    );
    const value = type === 'low' ? display.low : display.high;
    return {
      accessible: true,
      accessibilityRole: 'adjustable' as const,
      accessibilityLabel:
        thumbAccessibilityLabel?.(type) ?? defaultLabel(type, disableRange),
      // min/max/now must be integers on Android; otherwise only the text is set
      accessibilityValue:
        Number.isInteger(lo) && Number.isInteger(hi) && Number.isInteger(value)
          ? { min: lo, max: hi, now: value, text: format(value) }
          : { text: format(value) },
      accessibilityState: { disabled },
      accessibilityActions: [
        { name: 'increment' as const },
        { name: 'decrement' as const },
      ],
      onAccessibilityAction: (event: AccessibilityActionEvent) =>
        onAccessibilityAction(type, event),
    };
  };

  // A nested GestureHandlerRootView behaves like a plain view when an outer one
  // exists; on its own it makes the slider work inside <Modal> on Android.
  return (
    <GestureHandlerRootView {...restProps} style={[restProps.style]}>
      <GestureDetector gesture={gesture}>
        <View
          onLayout={handleContainerLayout}
          style={[
            styles.controls,
            { height: Math.max(MIN_TOUCH_SIZE, thumbHeight) },
          ]}
          collapsable={false}
        >
          <View
            pointerEvents="none"
            style={[
              styles.rails,
              { left: thumbWidth / 2, right: thumbWidth / 2 },
            ]}
          >
            {renderRail()}
            <Animated.View style={[styles.selected, selectedStyle]}>
              {renderRailSelected()}
            </Animated.View>
          </View>
          <Animated.View
            {...thumbA11y('low')}
            style={[styles.thumbSlot, lowStyle]}
          >
            <View onLayout={handleThumbLayout}>
              <View pointerEvents="none" style={styles.value}>
                {renderLowValue(display.low)}
              </View>
              {renderThumb('low')}
            </View>
          </Animated.View>
          {!disableRange && (
            <Animated.View
              {...thumbA11y('high')}
              style={[styles.thumbSlot, highStyle]}
            >
              <View>
                <View pointerEvents="none" style={styles.value}>
                  {renderHighValue(display.high)}
                </View>
                {renderThumb('high')}
              </View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const warned = new Set<string>();
function warnOnce(message: string) {
  if (!warned.has(message)) {
    warned.add(message);
    console.warn(message);
  }
}

const styles = StyleSheet.create({
  controls: {
    // positions are computed manually and mirrored for RTL
    direction: 'ltr',
  },
  rails: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selected: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  thumbSlot: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  value: {
    position: 'absolute',
    bottom: '100%',
    left: -40,
    right: -40,
    alignItems: 'center',
    marginBottom: 2,
  },
});

export default memo(RangeSlider);
