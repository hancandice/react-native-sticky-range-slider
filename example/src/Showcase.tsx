import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import RangeSlider from 'react-native-sticky-range-slider';

const money = (v: number) => '$' + v.toLocaleString('en-US');

export function Showcase() {
  const dark = useColorScheme() === 'dark';
  const c = dark ? darkColors : lightColors;
  const [price, setPrice] = useState({ low: 120, high: 640 });
  const [rating, setRating] = useState(4.2);
  const [age, setAge] = useState({ low: 25, high: 40 });

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.page}
    >
      <Text style={[styles.heading, { color: c.text }]}>Filters</Text>

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: c.text }]}>Price</Text>
          <Text style={[styles.value, { color: c.muted }]}>
            {money(price.low)} – {money(price.high)}
          </Text>
        </View>
        <RangeSlider
          min={0}
          max={1000}
          step={10}
          minRange={50}
          low={price.low}
          high={price.high}
          formatLabel={money}
          onValueChange={(low, high) => setPrice({ low, high })}
          accessibilityLabel="Price"
          testID="price-slider"
        />
        <Text style={[styles.caption, { color: c.muted }]}>
          Default styling · labels merge when the thumbs meet
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: c.text }]}>Age</Text>
          <Text style={[styles.value, { color: c.muted }]}>
            {age.low} – {age.high === 65 ? '65+' : age.high}
          </Text>
        </View>
        <RangeSlider
          min={18}
          max={65}
          low={age.low}
          high={age.high}
          minRange={3}
          onValueChange={(low, high) => setAge({ low, high })}
          formatLabel={(v) => (v === 65 ? '65+' : String(v))}
          thumbColor="#FF2D55"
          selectedRailColor="#FF2D55"
          railColor={dark ? '#3A3A3C' : '#F2D7DE'}
          labelStyle={styles.ageLabel}
          accessibilityLabel="Age"
        />
        <Text style={[styles.caption, { color: c.muted }]}>
          Custom colours · thumbColor, railColor, selectedRailColor, labelStyle
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: c.text }]}>Minimum rating</Text>
          <Text style={[styles.value, { color: c.muted }]}>
            ★ {rating.toFixed(1)}
          </Text>
        </View>
        <RangeSlider
          min={1}
          max={5}
          step={0.1}
          disableRange
          low={rating}
          onValueChange={(low) => setRating(low)}
          formatLabel={(v) => '★ ' + v.toFixed(1)}
          selectedRailColor="#FF9500"
          accessibilityLabel="Minimum rating"
        />
        <Text style={[styles.caption, { color: c.muted }]}>
          Single thumb · step 0.1
        </Text>
      </View>
    </ScrollView>
  );
}

const lightColors = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#6C6C70',
};
const darkColors = {
  bg: '#000000',
  card: '#1C1C1E',
  text: '#F2F2F7',
  muted: '#8E8E93',
};

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  heading: { fontSize: 28, fontWeight: '700' },
  card: { borderRadius: 16, padding: 20, gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: '600' },
  value: { fontSize: 15, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13 },
  ageLabel: { color: '#FF2D55' },
});
