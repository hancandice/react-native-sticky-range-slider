# Changelog

## 1.0.0

Rewrite on Reanimated worklets and Gesture Handler: dragging and thumb/rail/label animation run on the
UI thread; the JS thread only re-renders the labels when their text changes.

### Breaking

- New peer dependencies: `react-native-reanimated` (`>=3.16.0 <5`) and `react-native-gesture-handler`
  (`>=2.20.0 <4`).
- `onValueChange` is only called for user changes (drag, tap, accessibility action) — not on mount, on layout
  or when `low`/`high` props change.
- New default look: 28 pt white thumbs with a soft shadow, 4 pt rails (`#C7C7CC` / `#007AFF`, dark-mode aware),
  13 pt semibold tabular labels in reserved space above the rail (`labelPosition`), at least 44 pt touch height.
- `pannableAreaStyle` is ignored; use `hitSlop`.

### Deprecated

- `onValueChanged` → `onValueChange` (still works, one-time `__DEV__` warning).

### Added

- `step` is optional (default `1`); `step={0}` makes the slider continuous.
- Labels merge into one centred "low – high" label when they touch and stay inside the slider at both ends.
- `thumbColor`, `railColor`, `selectedRailColor`, `labelStyle`, `formatLabel`, `labelPosition`, `inverted`
  (defaults to `I18nManager.isRTL`), `hitSlop`, `onSlidingStart`, `onSlidingComplete`,
  `thumbAccessibilityLabel`, `formatAccessibilityValue`; `renderThumb(type, { pressed, disabled })`.
- Disabled state renders at 38 % opacity.
- Tap on the rail moves the closest thumb; taps on a thumb leave it in place.
- Motion: taps and accessibility actions animate (150 ms, ease-out cubic), the pressed thumb springs to 1.15×,
  `ReduceMotion.System` is honoured.
- Accessibility: each thumb is an `adjustable` element (Android `SeekBar`) with value, range and
  increment/decrement actions; the slider's `accessibilityLabel` prefixes the thumb labels.
- Named export `RangeSlider`, types `RangeSliderProps`, `ThumbType`, `ThumbState`.
- ESM + CommonJS builds with `exports`, `sideEffects: false`, strict TypeScript with JSDoc,
  `yarn typecheck:min` (Reanimated 3.16 / Gesture Handler 2.20 / React 18), CI workflow.
- Expo SDK 58 example app (React Native 0.88, New Architecture) with a filters showcase.

### Fixed

- Thumbs could not be dragged inside a React Native `<Modal>` on Android (#1, Expo SDK 53+): the slider renders a
  nested `GestureHandlerRootView`, so no app-side setup is needed.
- `package.json` had no `main` entry (CommonJS consumers and Jest could not resolve the package).
- Overlapping thumbs (`low === high`) picked a thumb by touch side; the drag direction now decides.
- Floating point noise with decimal steps; a decimal `max` (e.g. `10.5` with `step={1}`) could be exceeded.
- `max` was not reachable when `max - min` is not a multiple of `step`.
- `minRange` that is not a multiple of `step` pushed thumbs off the step grid; initial values were not snapped.
- Invalid props (`low > high`, values out of range, `minRange` larger than the range, `max < min`, `step < 0`)
  are normalized instead of producing a broken slider.
- The enlarged touch area extended outside its parent and never received touches.
- Props changed during a drag are applied when the drag ends; thumbs no longer render at 0 on the first frame.

## 0.1.7

Last release of the PanResponder implementation.
