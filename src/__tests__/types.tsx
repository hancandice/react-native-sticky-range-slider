// Type-level tests (checked by `yarn typecheck` and `yarn typecheck:min`).
import { View } from 'react-native';
import RangeSlider, { RangeSlider as Named, type ThumbState } from '../index';

export function Usage() {
  return (
    <>
      <RangeSlider
        min={0}
        max={100}
        onValueChange={(low, high) => low + high}
        renderThumb={(type, state: ThumbState) => (
          <View style={{ opacity: state.pressed ? 0.5 : 1 }} key={type} />
        )}
        thumbColor="#fff"
        labelPosition="none"
      />
      <Named min={0} max={1} step={0} disableRange disabled />
    </>
  );
}
