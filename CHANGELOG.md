# Changelog

## 1.0.0 — unreleased

Rewrite on Reanimated worklets and Gesture Handler: dragging and thumb/rail animation run on the UI thread;
the JS thread only re-renders the value labels once per step.

### Breaking

- New peer dependencies: `react-native-reanimated` (≥ 3.16, Reanimated 4 supported) and
  `react-native-gesture-handler` (≥ 2.20, v3 supported).
- `onValueChanged` is only called for user changes (drag, tap, accessibility action). It is no longer called on
  mount, on layout or when `low`/`high` props change.
- `pannableAreaStyle` is deprecated and ignored; use `hitSlop`.
- The slider is at least 44 pt tall and value labels are centered above the thumbs.

### Fixed

- Thumbs could not be dragged inside a React Native `<Modal>` on Android (issue #1, Expo SDK 53+): the slider
  renders a nested `GestureHandlerRootView`, so no app-side setup is needed.
- `package.json` had no `main` entry (CommonJS consumers and Jest could not resolve the package).
- Overlapping thumbs (`low === high`) picked a thumb by touch side; the drag direction now decides.
- Floating point noise with decimal steps (`0.30000000000000004`).
- `max` was not reachable when `max - min` is not a multiple of `step`.
- Invalid props (`low > high`, values outside the range, `minRange` larger than the range, `max < min`,
  `step <= 0`) are normalized instead of producing a broken slider.
- The enlarged touch area extended outside its parent and never received touches.
- Props changed during a drag are applied when the drag ends.

### Added

- `onSlidingStart`, `onSlidingComplete`, `inverted` (defaults to `I18nManager.isRTL`), `hitSlop`,
  `thumbAccessibilityLabel`, `formatAccessibilityValue`.
- Tap on the rail moves the closest thumb.
- Accessibility: each thumb is an `adjustable` element (Android `SeekBar`) with value, range and
  increment/decrement actions.
- Named export `RangeSlider` and types `RangeSliderProps`, `ThumbType`.
- ESM + CommonJS builds with `exports`, `sideEffects: false`, strict TypeScript types with JSDoc.
- Expo SDK 58 example app (React Native 0.88, New Architecture).

## 0.1.7

Last release of the PanResponder implementation.
