import { type MutableRefObject, useCallback, useMemo, useRef } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";
import { clamp } from "../utils/helpers";

export const useLowHigh = (
  lowProp: number | undefined,
  highProp: number | undefined,
  min: number,
  max: number,
  step: number
) => {
  const validLowProp = lowProp === undefined ? min : clamp(lowProp, min, max);
  const validHighProp = highProp === undefined ? max : clamp(highProp, min, max);
  const inPropsRef = useRef({
    low: validLowProp,
    high: validHighProp,
    step,
    min: validLowProp,
    max: validHighProp,
  });
  const { low: lowState, high: highState } = inPropsRef.current;
  const inPropsRefPrev = { lowPrev: lowState, highPrev: highState };

  const low = clamp(lowProp === undefined ? lowState : lowProp, min, max);
  const high = clamp(highProp === undefined ? highState : highProp, min, max);

  Object.assign(inPropsRef.current, { low, high, min, max });

  const setLow = (value: number) => (inPropsRef.current.low = value);
  const setHigh = (value: number) => (inPropsRef.current.high = value);
  return { inPropsRef, inPropsRefPrev, setLow, setHigh };
};

export const useWidthLayout = (
  widthRef: MutableRefObject<number>,
  callback?: (width: number) => void
) => {
  return useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const {
        layout: { width },
      } = nativeEvent;
      const { current: w } = widthRef;
      if (w !== width) {
        widthRef.current = width;
        if (callback) {
          callback(width);
        }
      }
    },
    [callback, widthRef]
  );
};

interface InProps {
  low: number;
  high: number;
  min: number;
  max: number;
  step: number;
}

export const useSelectedRail = (
  inPropsRef: MutableRefObject<InProps>,
  containerWidthRef: MutableRefObject<number>,
  thumbWidth: number
) => {
  const { current: left } = useRef(new Animated.Value(0));
  const { current: right } = useRef(new Animated.Value(0));
  const updateSelectedRail = useCallback(() => {
    const { low, high, min, max } = inPropsRef.current;
    const { current: containerWidth } = containerWidthRef;
    const fullScale = (max - min) / (containerWidth - thumbWidth);
    const leftValue = (low - min) / fullScale;
    const rightValue = (max - high) / fullScale;
    left.setValue(leftValue);
    right.setValue(rightValue);
  }, [containerWidthRef, inPropsRef, left, right, thumbWidth]);
  const selectedRailStyle = useMemo(
    () => ({
      position: "absolute",
      left,
      right,
    }),
    [left, right]
  );
  return { selectedRailStyle, updateSelectedRail };
};
