# React Native Sticky Range Slider 🌟

A pure TS component offering a customizable range slider optimized for performance. <br />It supports dragging functionalities for selecting a range of values, with values that **smoothly follow the thumb**.<br /> This component is fully compatible with both **Android** and **iOS** platforms. <br />Primarily forked from [rn-range-slider](https://www.npmjs.com/package/rn-range-slider).

## Features ✨
* **Optimized Performance**:  Designed to ensure smooth and responsive interactions even with complex UI components.
* **Full Customization**: Highly customizable to fit your application's specific requirements.
* **Cross-Platform Compatibility**: Works seamlessly on both Android and iOS platforms.
* **Responsive**: Provides a responsive user experience, adapting to various screen sizes and orientations.
* **Programmatic Control**: Offers methods to programmatically control the slider behavior.


## Preview 🦋

<p align="center">
<img src="https://github.com/hancandice/react-native-sticky-range-slider/assets/64334381/352d075d-22f2-41eb-a0da-84631ccea7c0" width="369">
</p>


## Installation 📦

```sh
npm install react-native-sticky-range-slider
```
```sh
yarn add react-native-sticky-range-slider
```

## Usage 🚀

```jsx
import React, { useCallback, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import RangeSlider from "react-native-sticky-range-slider";

const MIN_AGE = 18;
const MAX_AGE = 60;

const Thumb = (type: "high" | "low") => (
  <View
    style={[styles.thumb, { backgroundColor: type === "high" ? "lime" : "purple" }]}
  />
);
const Rail = () => <View style={styles.rail} />;
const RailSelected = () => <View style={styles.railSelected} />;

const App = () => {
  const [min, setMin] = useState(MIN_AGE);
  const [max, setMax] = useState(MAX_AGE);
  const [disableRange, setDisableRange] = useState(false);

  const handleValueChange = useCallback((newLow: number, newHigh: number) => {
    setMin(newLow);
    setMax(newHigh);
  }, []);

  const handleToggle = () => {
    setDisableRange((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{disableRange ? "Set your age" : "Set Age Range"}</Text>
      <RangeSlider
        style={styles.slider}
        min={MIN_AGE}
        max={MAX_AGE}
        step={1}
        minRange={5}
        low={min}
        high={max}
        onValueChanged={handleValueChange}
        renderLowValue={(value) => <Text style={styles.valueText}>{value}</Text>}
        renderHighValue={(value) => (
          <Text style={styles.valueText}>{value === MAX_AGE ? `+${value}` : value}</Text>
        )}
        renderThumb={Thumb}
        renderRail={Rail}
        renderRailSelected={RailSelected}
        disableRange={disableRange}
      />
      <Button
        onPress={handleToggle}
        title={disableRange ? "Switch to double control" : "Switch to single control"}
      />
    </View>
  );
};

const THUMB_RADIUS = 10;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  slider: {
    marginVertical: 20,
  },
  valueText: {
    color: "black",
  },
  thumb: {
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    borderWidth: 3,
    borderColor: "black",
    backgroundColor: "red",
  },
  rail: {
    flex: 1,
    height: 3,
    borderRadius: 3,
    backgroundColor: "grey",
  },
  railSelected: {
    height: 3,
    backgroundColor: "red",
  },
});

export default App;
```

### Props 🎨

| Name                 | Description                                                                                                                                                                                                                                                                                          | Type                                                   |                   Default Value                   |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------|:-------------------------------------------------:|
| `min`                | Minimum value for the slider.                                                                                                                                                                                                                                                   | `number`                                              |                  _**required**_                   |
| `max`                | Maximum value for the slider.                                                                                                                                                                                                                                | `number`                                              |                  _**required**_                   |
| `minRange`                | Minimum range between the low and high values. <br /> It is set to `0` if **disableRange** is `true`.                                                                                                                                  | `number`                                              |                  _**0**_                   |
| `step`                | Step value for the slider.                                                                                                                                                                                                              | `number`                                              |                  _**required**_                   |
| `low`                | Low value for the slider.                                                                                                                                                                                                  | `number`                                              |                  _**required**_                   |
| `high`                | High value for the slider.                                                                                                                                                                              | `number`                                                   |                 _**required**_                  |
| `onValueChanged`                | Callback function that gets called when the slider values change. Receives the new low and high values as arguments.                                                                                                                                               | `(low: number, high: number) => void`                                                   |                 _**required**_                  |
| `renderThumb`                | 	Function to render the thumb component. Accepts a type parameter which can be either high or low.                                                                                                                         | `(type: 'high' or 'low') => React.ReactNode`                                                 |                 _**Default Thumb**_                  |
| `renderRail`                | 	Function to render the rail component.                                                                                                       | `() => React.ReactNode`                                                   |                 _**Default Rail**_                  |
| `renderRailSelected`                | 	Function to render the selected rail component.                                                                                                       | `() => React.ReactNode`                                                   |                 _**Default RailSelected**_                  |
| `renderLowValue`                | 	Function to render the component displaying the low value. Receives the low value as an argument.                                                                                 | `(low: number) => React.ReactNode`                                                   |                 _**Default LowValueText**_                  |
| `renderHighValue`                | 	Function to render the component displaying the high value. Receives the high value as an argument.                                                        | `(high: number) => React.ReactNode`                                                   |                 _**Default HighValueText**_                  |
| `pannableAreaStyle`                | 	Style for the pannable area.                                                                        | `StyleProp<ViewStyle>`                                                   |                 _**Default Pannable Area Style**_                  |
| `disableRange`                | 	When set to `true`, the slider functions as a standard slider with a single control.                                                                       | `boolean`                                                   |                 _**false**_                  |
| `disabled`                | 	User interactions will be ignored when set to `true`.                                           | `boolean`                                                   |                 _**false**_                  |



## Contributions 🤝
Contributions are welcome! If you have any suggestions, feature requests, or bug reports, feel free to open an issue or submit a pull request. Let's make this component even better together! 😃

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
