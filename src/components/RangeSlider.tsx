import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  I18nManager,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type AccessibilityActionEvent,
  type Insets,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  accessibilityStep,
  cleanValue,
  clamp,
  defaultFormat,
  labelLeft,
  labelsCollide,
  limitsFor,
  normalizeConfig,
  normalizeValues,
  pickThumb,
  positionToValue,
  resolveTie,
  snapToStep,
  valueToPosition,
  type ThumbType,
} from '../utils/helpers';
import {
  DARK,
  DefaultLabel,
  DefaultRail,
  DefaultRailSelected,
  DefaultThumb,
  LIGHT,
} from './defaults';

/** State passed to `renderThumb`. */
export interface ThumbState {
  /** The thumb is being dragged. */
  pressed: boolean;
  /** The slider is disabled. */
  disabled: boolean;
}

export interface RangeSliderProps extends ViewProps {
  /** Smallest selectable value. */
  min: number;
  /** Largest selectable value. */
  max: number;
  /**
   * Distance between selectable values; `0` makes the slider continuous.
   * `max` is always selectable, even if `max - min` is not a multiple of `step`.
   * @default 1
   */
  step?: number;
  /** Minimum distance between `low` and `high`. Ignored with `disableRange`. @default 0 */
  minRange?: number;
  /**
   * Value of the low thumb. When provided the slider follows this prop
   * (controlled); otherwise it keeps its own state starting at `min`.
   * Values are clamped and snapped to the step grid.
   */
  low?: number;
  /** Value of the high thumb. Controlled like `low`; defaults to `max`. */
  high?: number;
  /**
   * Called whenever the user changes a value (drag, tap, accessibility
   * action): once per step, or on every frame of a drag when `step` is `0`.
   * Not called when you change `low`/`high` yourself.
   */
  onValueChange?: (low: number, high: number) => void;
  /** @deprecated Renamed to `onValueChange`. */
  onValueChanged?: (low: number, high: number) => void;
  /** Called when the user starts dragging a thumb. */
  onSlidingStart?: (thumb: ThumbType) => void;
  /** Called once the user releases the thumb (or after a tap / accessibility action). */
  onSlidingComplete?: (low: number, high: number) => void;
  /** Renders a thumb. Both thumbs should have the same size. */
  renderThumb?: (type: ThumbType, state: ThumbState) => ReactNode;
  /** Renders the full rail. Should stretch (`flex: 1`). */
  renderRail?: () => ReactNode;
  /** Renders the selected part of the rail. */
  renderRailSelected?: () => ReactNode;
  /** Renders the label of the low thumb. Return `null` to hide it. */
  renderLowValue?: (low: number) => ReactNode;
  /** Renders the label of the high thumb. Return `null` to hide it. */
  renderHighValue?: (high: number) => ReactNode;
  /**
   * Text of the default labels. Labels (and `renderLowValue` /
   * `renderHighValue`) re-render only when this text changes.
   * @default String(value) (2 decimals at most when `step` is 0)
   */
  formatLabel?: (value: number) => string;
  /**
   * `'top'` reserves room above the rail for the labels (they never overlap
   * the content above); `'none'` hides them. @default 'top'
   */
  labelPosition?: 'top' | 'none';
  /** Color of the default thumbs. @default '#FFFFFF' */
  thumbColor?: string;
  /** Color of the default rail. @default '#C7C7CC' ('#48484A' in dark mode) */
  railColor?: string;
  /** Color of the default selected rail. @default '#007AFF' ('#0A84FF' in dark mode) */
  selectedRailColor?: string;
  /** Style of the default labels (13pt, semibold, tabular numbers). */
  labelStyle?: StyleProp<TextStyle>;
  /** Use a single thumb (`low`) instead of a range. @default false */
  disableRange?: boolean;
  /** Ignore user interaction and render at 38% opacity. @default false */
  disabled?: boolean;
  /**
   * Lay the slider out from right to left (`min` on the right).
   * @default I18nManager.isRTL
   */
  inverted?: boolean;
  /**
   * Extra touchable area around the slider. The slider itself is at least
   * 44 points tall. @default { top: 8, bottom: 8, left: 12, right: 12 }
   */
  hitSlop?: Insets | number;
  /**
   * Accessibility label of a thumb. When omitted, the slider's
   * `accessibilityLabel` is used as a prefix of 'Minimum' / 'Maximum' / 'Value'.
   */
  thumbAccessibilityLabel?: (type: ThumbType) => string;
  /** Text read by screen readers for a value. @default formatLabel */
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
const LABEL_GAP = 6;
const LABEL_SPACING = 4;
const GRAB_SLOP = 8;
const DEFAULT_HIT_SLOP: Insets = { top: 8, bottom: 8, left: 12, right: 12 };
const PRESS_SPRING = {
  damping: 18,
  stiffness: 250,
  reduceMotion: ReduceMotion.System,
};
const SEEK_TIMING = {
  duration: 150,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

const LOW = 1;
const HIGH = 2;
const TIE = 3;

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

const warned = new Set<string>();
function warnOnce(message: string) {
  if (__DEV__ && !warned.has(message)) {
    warned.add(message);
    console.warn(`react-native-sticky-range-slider: ${message}`);
  }
}

const RangeSlider = ({
  min: minProp,
  max: maxProp,
  step: stepProp = 1,
  minRange: minRangeProp = 0,
  low: lowProp,
  high: highProp,
  onValueChange,
  onValueChanged,
  onSlidingStart,
  onSlidingComplete,
  renderThumb,
  renderRail,
  renderRailSelected,
  renderLowValue,
  renderHighValue,
  formatLabel,
  labelPosition = 'top',
  thumbColor,
  railColor,
  selectedRailColor,
  labelStyle,
  disableRange = false,
  disabled = false,
  inverted = I18nManager.isRTL,
  hitSlop,
  thumbAccessibilityLabel,
  formatAccessibilityValue,
  pannableAreaStyle,
  accessibilityLabel: rootAccessibilityLabel,
  style,
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

  if (pannableAreaStyle != null) {
    warnOnce(
      '`pannableAreaStyle` is deprecated and ignored. The whole slider is touchable; use `hitSlop` to enlarge it.'
    );
  }
  if (onValueChanged != null) {
    warnOnce('`onValueChanged` is deprecated, use `onValueChange`.');
  }

  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK : LIGHT;
  const colors = {
    thumb: thumbColor ?? palette.thumb,
    rail: railColor ?? palette.rail,
    selectedRail: selectedRailColor ?? palette.selectedRail,
    label: palette.label,
  };

  const format = useCallback(
    (value: number) =>
      formatLabel ? formatLabel(value) : defaultFormat(value, config),
    [config, formatLabel]
  );

  const initial = useMemo(
    () => normalizeValues(lowProp, highProp, config, disableRange),
    // only for the very first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // values rendered by React (labels, accessibility): updated when their text changes
  const [display, setDisplay] = useState(initial);
  const [pressed, setPressed] = useState<ThumbType | null>(null);

  // UI thread state: logical values, drawn values (animated), layout
  const low = useSharedValue(initial.low);
  const high = useSharedValue(initial.high);
  const lowDrawn = useSharedValue(initial.low);
  const highDrawn = useSharedValue(initial.high);
  const lowPress = useSharedValue(1);
  const highPress = useSharedValue(1);
  const active = useSharedValue(0);
  const grabOffset = useSharedValue(0);
  const containerSize = useSharedValue(0);
  const trackLength = useSharedValue(0);
  const thumbSize = useSharedValue(0);
  const lowLabelWidth = useSharedValue(0);
  const highLabelWidth = useSharedValue(0);
  const mergedLabelWidth = useSharedValue(0);

  const [containerWidth, setContainerWidth] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [labelHeight, setLabelHeight] = useState(0);
  const thumbWidthRef = useRef(0);

  // latest callbacks, without re-creating the gestures on every render
  const callbacks = useRef({
    onChange: onValueChange ?? onValueChanged,
    onSlidingStart,
    onSlidingComplete,
    format,
  });
  useLayoutEffect(() => {
    callbacks.current = {
      onChange: onValueChange ?? onValueChanged,
      onSlidingStart,
      onSlidingComplete,
      format,
    };
  });

  // props that change while the user drags are applied once the drag ends
  const pendingSync = useRef(false);
  const [syncTick, setSyncTick] = useState(0);

  // Sync with props (controlled) or re-validate the internal state (uncontrolled).
  useLayoutEffect(() => {
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
    lowDrawn.value = next.low;
    highDrawn.value = next.high;
    setDisplay((prev) =>
      prev.low === next.low && prev.high === next.high ? prev : next
    );
  }, [
    active,
    config,
    disableRange,
    high,
    highDrawn,
    highProp,
    low,
    lowDrawn,
    lowProp,
    syncTick,
  ]);

  const lastLabelKey = useRef('');
  const updateDisplay = useCallback((l: number, h: number) => {
    const f = callbacks.current.format;
    const key = `${f(l)}\u0000${f(h)}`;
    if (key !== lastLabelKey.current) {
      lastLabelKey.current = key;
      setDisplay({ low: l, high: h });
    }
  }, []);

  const handleChange = useCallback(
    (l: number, h: number) => {
      updateDisplay(l, h);
      callbacks.current.onChange?.(l, h);
    },
    [updateDisplay]
  );

  const handleStart = useCallback((type: ThumbType) => {
    setPressed(type);
    callbacks.current.onSlidingStart?.(type);
  }, []);

  const handleComplete = useCallback(
    (l: number, h: number) => {
      setPressed(null);
      // make sure the labels show the final values
      lastLabelKey.current = '';
      updateDisplay(l, h);
      callbacks.current.onSlidingComplete?.(l, h);
      if (pendingSync.current) {
        pendingSync.current = false;
        setSyncTick((t) => t + 1);
      }
    },
    [updateDisplay]
  );

  const slop = toHitSlop(hitSlop);
  const {
    top: slopTop,
    bottom: slopBottom,
    left: slopLeft,
    right: slopRight,
  } = slop;

  const gesture = useMemo(() => {
    const hit = {
      top: slopTop,
      bottom: slopBottom,
      left: slopLeft,
      right: slopRight,
    };

    /** Logical position (0 = min side) of a thumb's start edge under touch x. */
    const logicalPosition = (x: number) => {
      'worklet';
      const raw = x - thumbSize.value / 2;
      return inverted ? trackLength.value - raw : raw;
    };

    const positionOf = (value: number) => {
      'worklet';
      return valueToPosition(value, config.min, config.max, trackLength.value);
    };

    /** Moves a thumb to a logical position. */
    const moveTo = (type: number, position: number, animate: boolean) => {
      'worklet';
      const thumb: ThumbType = type === HIGH ? 'high' : 'low';
      const [lo, hi] = limitsFor(
        thumb,
        low.value,
        high.value,
        config,
        disableRange
      );
      const value = clamp(
        positionToValue(position, trackLength.value, config),
        lo,
        hi
      );
      const target = type === HIGH ? high : low;
      const drawn = type === HIGH ? highDrawn : lowDrawn;
      if (target.value === value) {
        return;
      }
      target.value = value;
      drawn.value = animate ? withTiming(value, SEEK_TIMING) : value;
      runOnJS(handleChange)(low.value, high.value);
    };

    const choose = (x: number, direction: number) => {
      'worklet';
      if (disableRange) {
        return LOW;
      }
      const half = thumbSize.value / 2;
      const picked = pickThumb(
        logicalPosition(x) + half,
        positionOf(low.value) + half,
        positionOf(high.value) + half
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

    const press = (type: number, scale: number) => {
      'worklet';
      (type === HIGH ? highPress : lowPress).value = withSpring(
        scale,
        PRESS_SPRING
      );
    };

    const pan = Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .hitSlop(hit)
      .onStart((e) => {
        'worklet';
        const startX = e.x - e.translationX;
        const dx = inverted ? -e.translationX : e.translationX;
        const type = choose(startX, Math.sign(dx));
        active.value = type === TIE ? LOW : type;
        const value = active.value === HIGH ? high.value : low.value;
        const offset = logicalPosition(startX) - positionOf(value);
        // grabbing the thumb itself must not make it jump
        grabOffset.value =
          Math.abs(offset) <= thumbSize.value / 2 + GRAB_SLOP ? offset : 0;
        press(active.value, 1.15);
        runOnJS(handleStart)(active.value === HIGH ? 'high' : 'low');
        moveTo(active.value, logicalPosition(e.x) - grabOffset.value, false);
      })
      .onUpdate((e) => {
        'worklet';
        if (active.value === 0) {
          return;
        }
        moveTo(active.value, logicalPosition(e.x) - grabOffset.value, false);
      })
      .onFinalize(() => {
        'worklet';
        if (active.value === 0) {
          return;
        }
        press(active.value, 1);
        active.value = 0;
        runOnJS(handleComplete)(low.value, high.value);
      });

    const tap = Gesture.Tap()
      .enabled(!disabled)
      .maxDistance(8)
      .hitSlop(hit)
      .onEnd((e, success) => {
        'worklet';
        if (!success) {
          return;
        }
        let type = choose(e.x, 0);
        if (type === TIE) {
          type = logicalPosition(e.x) > positionOf(low.value) ? HIGH : LOW;
          if (type === HIGH && high.value >= config.max) {
            type = LOW;
          }
        }
        const value = type === HIGH ? high.value : low.value;
        // a tap on a thumb keeps it where it is
        if (
          Math.abs(logicalPosition(e.x) - positionOf(value)) <=
          thumbSize.value / 2 + GRAB_SLOP
        ) {
          return;
        }
        moveTo(type, logicalPosition(e.x), true);
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
    highDrawn,
    highPress,
    inverted,
    low,
    lowDrawn,
    lowPress,
    slopBottom,
    slopLeft,
    slopRight,
    slopTop,
    thumbSize,
    trackLength,
  ]);

  /** Physical (left-to-right) x of a thumb's left edge. */
  const physical = (drawn: SharedValue<number>) => {
    'worklet';
    const track = trackLength.value;
    const pos = valueToPosition(drawn.value, config.min, config.max, track);
    return inverted ? track - pos : pos;
  };

  const lowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: physical(lowDrawn) }, { scale: lowPress.value }],
  }));

  const highStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: physical(highDrawn) },
      { scale: highPress.value },
    ],
  }));

  const selectedStyle = useAnimatedStyle(() => {
    const lowX = physical(lowDrawn);
    let start: number;
    let end: number;
    if (disableRange) {
      start = inverted ? lowX : 0;
      end = inverted ? trackLength.value : lowX;
    } else {
      const highX = physical(highDrawn);
      start = Math.min(lowX, highX);
      end = Math.max(lowX, highX);
    }
    return { left: start, width: Math.max(0, end - start) };
  });

  // Labels: centred on the thumbs, kept inside the slider, merged when they touch.
  const ready = () => {
    'worklet';
    return containerSize.value > 0 && thumbSize.value > 0;
  };

  const merged = (half: number) => {
    'worklet';
    if (disableRange || labelPosition === 'none') {
      return false;
    }
    return labelsCollide(
      physical(lowDrawn) + half,
      lowLabelWidth.value,
      physical(highDrawn) + half,
      highLabelWidth.value,
      containerSize.value,
      LABEL_SPACING
    );
  };

  const lowLabelStyle = useAnimatedStyle(() => {
    const half = thumbSize.value / 2;
    return {
      opacity: ready() && !merged(half) ? 1 : 0,
      transform: [
        {
          translateX: labelLeft(
            physical(lowDrawn) + half,
            lowLabelWidth.value,
            containerSize.value
          ),
        },
      ],
    };
  });

  const highLabelStyle = useAnimatedStyle(() => {
    const half = thumbSize.value / 2;
    return {
      opacity: ready() && !merged(half) ? 1 : 0,
      transform: [
        {
          translateX: labelLeft(
            physical(highDrawn) + half,
            highLabelWidth.value,
            containerSize.value
          ),
        },
      ],
    };
  });

  const mergedLabelStyle = useAnimatedStyle(() => {
    const half = thumbSize.value / 2;
    const center = (physical(lowDrawn) + physical(highDrawn)) / 2 + half;
    return {
      opacity: ready() && merged(half) ? 1 : 0,
      transform: [
        {
          translateX: labelLeft(
            center,
            mergedLabelWidth.value,
            containerSize.value
          ),
        },
      ],
    };
  });

  const handleContainerLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const { width } = nativeEvent.layout;
      containerSize.value = width;
      trackLength.value = Math.max(0, width - thumbWidthRef.current);
      setContainerWidth(width);
    },
    [containerSize, trackLength]
  );

  const handleThumbLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const { width, height } = nativeEvent.layout;
      thumbWidthRef.current = width;
      thumbSize.value = width;
      trackLength.value = Math.max(0, containerSize.value - width);
      setThumbWidth(width);
      setThumbHeight(height);
    },
    [containerSize, thumbSize, trackLength]
  );

  const measureLabel = useCallback(
    (target: SharedValue<number>) =>
      ({ nativeEvent }: LayoutChangeEvent) => {
        target.value = nativeEvent.layout.width;
        const h = nativeEvent.layout.height;
        setLabelHeight((prev) => Math.max(prev, h));
      },
    []
  );

  const a11yStep = accessibilityStep(config);
  const a11yFormat = formatAccessibilityValue ?? format;

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
      const raw = clamp(current + delta, lo, hi);
      const next =
        config.step > 0 ? snapToStep(raw, config) : cleanValue(raw, config);
      const bounded = clamp(next, lo, hi);
      if (bounded === current) {
        return;
      }
      if (type === 'low') {
        low.value = bounded;
        lowDrawn.value = withTiming(bounded, SEEK_TIMING);
      } else {
        high.value = bounded;
        highDrawn.value = withTiming(bounded, SEEK_TIMING);
      }
      callbacks.current.onChange?.(low.value, high.value);
      handleComplete(low.value, high.value);
    },
    [
      a11yStep,
      config,
      disableRange,
      disabled,
      handleComplete,
      high,
      highDrawn,
      low,
      lowDrawn,
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
    const name = defaultLabel(type, disableRange);
    return {
      accessible: true,
      accessibilityRole: 'adjustable' as const,
      accessibilityLabel:
        thumbAccessibilityLabel?.(type) ??
        (rootAccessibilityLabel ? `${rootAccessibilityLabel}, ${name}` : name),
      // min/max/now must be integers on Android; otherwise only the text is set
      accessibilityValue:
        Number.isInteger(lo) && Number.isInteger(hi) && Number.isInteger(value)
          ? { min: lo, max: hi, now: value, text: a11yFormat(value) }
          : { text: a11yFormat(value) },
      accessibilityState: { disabled },
      accessibilityActions: [
        { name: 'increment' as const },
        { name: 'decrement' as const },
      ],
      onAccessibilityAction: (event: AccessibilityActionEvent) =>
        onAccessibilityAction(type, event),
    };
  };

  const label = (value: number, render?: (v: number) => ReactNode) =>
    render ? (
      render(value)
    ) : (
      <DefaultLabel
        text={format(value)}
        color={colors.label}
        style={labelStyle}
      />
    );

  const thumb = (type: ThumbType) =>
    renderThumb ? (
      renderThumb(type, { pressed: pressed === type, disabled })
    ) : (
      <DefaultThumb color={colors.thumb} />
    );

  const measured = containerWidth > 0 && thumbWidth > 0;
  const showLabels = labelPosition !== 'none';

  // A nested GestureHandlerRootView behaves like a plain view under the app's
  // root view (Android logs that it is "already enabled"); on its own, inside
  // a React Native <Modal>, it is what lets Android deliver the gestures.
  return (
    <GestureHandlerRootView
      {...restProps}
      style={[style, disabled && styles.disabled]}
    >
      {showLabels && (
        <View
          pointerEvents="none"
          style={[styles.labels, { height: labelHeight + LABEL_GAP }]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Animated.View
            style={[styles.label, lowLabelStyle]}
            onLayout={measureLabel(lowLabelWidth)}
          >
            {label(display.low, renderLowValue)}
          </Animated.View>
          {!disableRange && (
            <>
              <Animated.View
                style={[styles.label, highLabelStyle]}
                onLayout={measureLabel(highLabelWidth)}
              >
                {label(display.high, renderHighValue)}
              </Animated.View>
              <Animated.View
                style={[styles.label, styles.mergedLabel, mergedLabelStyle]}
                onLayout={measureLabel(mergedLabelWidth)}
              >
                {label(display.low, renderLowValue)}
                <Text style={[{ color: colors.label }, labelStyle]}>
                  {' – '}
                </Text>
                {label(display.high, renderHighValue)}
              </Animated.View>
            </>
          )}
        </View>
      )}
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
            {renderRail ? renderRail() : <DefaultRail color={colors.rail} />}
            <Animated.View style={[styles.selected, selectedStyle]}>
              {renderRailSelected ? (
                renderRailSelected()
              ) : (
                <DefaultRailSelected color={colors.selectedRail} />
              )}
            </Animated.View>
          </View>
          <Animated.View
            {...thumbA11y('low')}
            style={[styles.thumbSlot, !measured && styles.hidden, lowStyle]}
          >
            <View onLayout={handleThumbLayout}>{thumb('low')}</View>
          </Animated.View>
          {!disableRange && (
            <Animated.View
              {...thumbA11y('high')}
              style={[styles.thumbSlot, !measured && styles.hidden, highStyle]}
            >
              <View>{thumb('high')}</View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.38,
  },
  hidden: {
    opacity: 0,
  },
  labels: {
    direction: 'ltr',
  },
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
  label: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  mergedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default memo(RangeSlider);
