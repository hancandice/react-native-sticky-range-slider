import React, { type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  type PanResponderGestureState,
  type StyleProp,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";

import Rail from "./Rail";
import RailSelected from "./RailSelected";
import TextValue from "./TextValue";
import Thumb from "./Thumb";
import { clamp, getValueForPosition, isLowCloser } from "../utils/helpers";
import { useLowHigh, useSelectedRail, useWidthLayout } from "../hooks";

const trueFunc = () => true;
const falseFunc = () => false;

export interface SliderProps extends ViewProps {
  min: number;
  max: number;
  minRange?: number;
  step: number;
  low?: number;
  high?: number;
  onValueChanged?: (low: number, high: number) => void;
  renderThumb?: () => ReactNode;
  renderRail?: () => ReactNode;
  renderRailSelected?: () => ReactNode;
  renderLowValue?: (low: number) => ReactNode;
  renderHighValue?: (high: number) => ReactNode;
  pannableAreaStyle?: StyleProp<ViewStyle>;
}

const Slider: React.FC<SliderProps> = ({
  min,
  max,
  minRange = 0,
  step,
  low: lowProp,
  high: highProp,
  onValueChanged,
  renderThumb = () => <Thumb />,
  renderRail = () => <Rail />,
  renderRailSelected = () => <RailSelected />,
  renderLowValue = (low) => <TextValue value={low} />,
  renderHighValue = (high) => <TextValue value={high} />,
  pannableAreaStyle,
  ...restProps
}) => {
  const { inPropsRef, inPropsRefPrev, setLow, setHigh } = useLowHigh(
    lowProp,
    highProp,
    min,
    max,
    step
  );
  const lowThumbXRef = useRef(new Animated.Value(0));
  const highThumbXRef = useRef(new Animated.Value(0));
  const pointerX = useRef(new Animated.Value(0)).current;
  const { current: lowThumbX } = lowThumbXRef;
  const { current: highThumbX } = highThumbXRef;

  const gestureStateRef = useRef({ isLow: true, lastValue: 0, lastPosition: 0 });

  const containerWidthRef = useRef(0);
  const [thumbWidth, setThumbWidth] = useState(0);

  const { selectedRailStyle, updateSelectedRail } = useSelectedRail(
    inPropsRef,
    containerWidthRef,
    thumbWidth
  );

  const updateThumbs = useCallback(() => {
    const { current: containerWidth } = containerWidthRef;
    if (!thumbWidth || !containerWidth) {
      return;
    }
    const { low, high } = inPropsRef.current;

    const highPosition = ((high - min) / (max - min)) * (containerWidth - thumbWidth);
    highThumbXRef.current.setValue(highPosition);

    const lowPosition = ((low - min) / (max - min)) * (containerWidth - thumbWidth);
    lowThumbXRef.current.setValue(lowPosition);
    updateSelectedRail();
    onValueChanged?.(low, high);
  }, [inPropsRef, max, min, onValueChanged, thumbWidth, updateSelectedRail]);

  useEffect(() => {
    const { lowPrev, highPrev } = inPropsRefPrev;
    if (
      (lowProp !== undefined && lowProp !== lowPrev) ||
      (highProp !== undefined && highProp !== highPrev)
    ) {
      updateThumbs();
    }
  }, [highProp, inPropsRefPrev, lowProp, updateThumbs]);

  useEffect(() => {
    updateThumbs();
  }, [updateThumbs]);

  const handleContainerLayout = useWidthLayout(containerWidthRef, updateThumbs);
  const handleThumbLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const {
        layout: { width },
      } = nativeEvent;
      if (thumbWidth !== width) {
        setThumbWidth(width);
      }
    },
    [thumbWidth]
  );

  const lowStyles = useMemo(() => {
    return { transform: [{ translateX: lowThumbX }] };
  }, [lowThumbX]);

  const highStyles = useMemo(() => {
    return [styles.highThumbContainer, { transform: [{ translateX: highThumbX }] }];
  }, [highThumbX]);

  const railContainerStyles = useMemo(() => {
    return [styles.railsContainer, { marginHorizontal: thumbWidth / 2 }];
  }, [thumbWidth]);

  const lowThumb = renderThumb();
  const highThumb = renderThumb();

  const { panHandlers } = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: falseFunc,
        onMoveShouldSetPanResponderCapture: falseFunc,
        onPanResponderTerminationRequest: falseFunc,
        onPanResponderTerminate: trueFunc,
        onShouldBlockNativeResponder: trueFunc,

        onMoveShouldSetPanResponder: (
          evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => Math.abs(gestureState.dx) > 2 * Math.abs(gestureState.dy),

        onPanResponderGrant: ({ nativeEvent }, gestureState) => {
          const { numberActiveTouches } = gestureState;
          if (numberActiveTouches > 1) {
            return;
          }
          const { locationX: downX, pageX } = nativeEvent;
          const containerX = pageX - downX;

          const containerWidth = containerWidthRef.current;

          const lowPosition =
            thumbWidth / 2 +
            ((inPropsRef.current.low - inPropsRef.current.min) /
              (inPropsRef.current.max - inPropsRef.current.min)) *
              (containerWidth - thumbWidth);
          const highPosition =
            thumbWidth / 2 +
            ((inPropsRef.current.high - inPropsRef.current.min) /
              (inPropsRef.current.max - inPropsRef.current.min)) *
              (containerWidth - thumbWidth);

          const isLow = isLowCloser(downX, lowPosition, highPosition);
          gestureStateRef.current.isLow = isLow;

          const handlePositionChange = (positionInView: number) => {
            const minValue = isLow ? inPropsRef.current.min : inPropsRef.current.low + minRange;
            const maxValue = isLow ? inPropsRef.current.high - minRange : inPropsRef.current.max;
            const value = clamp(
              getValueForPosition(
                positionInView,
                containerWidth,
                thumbWidth,
                inPropsRef.current.min,
                inPropsRef.current.max,
                inPropsRef.current.step
              ),
              minValue,
              maxValue
            );
            if (gestureStateRef.current.lastValue === value) {
              return;
            }
            const availableSpace = containerWidth - thumbWidth;
            const absolutePosition =
              ((value - inPropsRef.current.min) /
                (inPropsRef.current.max - inPropsRef.current.min)) *
              availableSpace;
            gestureStateRef.current.lastValue = value;
            gestureStateRef.current.lastPosition = absolutePosition + thumbWidth / 2;
            (isLow ? lowThumbXRef.current : highThumbXRef.current).setValue(absolutePosition);
            onValueChanged?.(
              isLow ? value : inPropsRef.current.low,
              isLow ? inPropsRef.current.high : value
            );
            (isLow ? setLow : setHigh)(value);

            updateSelectedRail();
          };
          handlePositionChange(downX);
          pointerX.removeAllListeners();
          pointerX.addListener(({ value: pointerPosition }) => {
            const positionInView = pointerPosition - containerX;
            handlePositionChange(positionInView);
          });
        },

        onPanResponderMove: Animated.event([null, { moveX: pointerX }], { useNativeDriver: false }),
      }),
    [
      inPropsRef,
      minRange,
      onValueChanged,
      pointerX,
      setHigh,
      setLow,
      thumbWidth,
      updateSelectedRail,
    ]
  );

  return (
    <>
      <View {...restProps}>
        <View onLayout={handleContainerLayout} style={styles.controlsContainer}>
          <View style={railContainerStyles}>
            {renderRail()}
            <Animated.View style={selectedRailStyle as any}>{renderRailSelected()}</Animated.View>
          </View>
          <Animated.View style={lowStyles} onLayout={handleThumbLayout}>
            <View style={styles.value}>{renderLowValue(inPropsRef.current.low)}</View>
            {lowThumb}
          </Animated.View>
          <Animated.View style={highStyles}>
            <View style={styles.value}>{renderHighValue(inPropsRef.current.high)}</View>
            {highThumb}
          </Animated.View>
        </View>
      </View>
      <View
        {...panHandlers}
        style={[styles.touchableArea, pannableAreaStyle]}
        collapsable={false}
      />
    </>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  highThumbContainer: {
    position: "absolute",
  },
  railsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
  },
  touchableArea: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  value: {
    position: "absolute",
    top: -20,
    width: 40,
  },
});

export default memo(Slider);
