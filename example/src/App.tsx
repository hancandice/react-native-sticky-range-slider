import { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import RangeSlider, { type ThumbType } from 'react-native-sticky-range-slider';

const MIN_AGE = 18;
const MAX_AGE = 60;
const THUMB_RADIUS = 12;

const Thumb = (type: ThumbType) => (
  <View style={[styles.thumb, type === 'high' ? styles.high : styles.low]} />
);
const Rail = () => <View style={styles.rail} />;
const RailSelected = () => <View style={styles.railSelected} />;

function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

/** The demo from the README (also used to reproduce issue #1 in a Modal). */
function AgeRange({ onClose }: { onClose?: () => void }) {
  const [low, setLow] = useState(MIN_AGE);
  const [high, setHigh] = useState(MAX_AGE);
  const [disableRange, setDisableRange] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [completed, setCompleted] = useState(0);

  const handleValueChange = useCallback((newLow: number, newHigh: number) => {
    setLow(newLow);
    setHigh(newHigh);
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {disableRange ? 'Set your age' : 'Set age range'}
      </Text>
      <RangeSlider
        style={styles.slider}
        min={MIN_AGE}
        max={MAX_AGE}
        step={1}
        minRange={5}
        low={low}
        high={high}
        onValueChanged={handleValueChange}
        onSlidingComplete={() => setCompleted((c) => c + 1)}
        renderLowValue={(value) => (
          <Text style={styles.valueText}>{value}</Text>
        )}
        renderHighValue={(value) => (
          <Text style={styles.valueText}>
            {value === MAX_AGE ? `${value}+` : value}
          </Text>
        )}
        renderThumb={Thumb}
        renderRail={Rail}
        renderRailSelected={RailSelected}
        disableRange={disableRange}
        disabled={disabled}
        inverted={inverted}
        testID="age-slider"
      />
      <Text style={styles.status} testID="age-status">
        low {low} · high {high} · completed {completed}
        {disabled ? ' · disabled' : ''}
      </Text>
      <View style={styles.row}>
        <Button
          title={disableRange ? 'Range' : 'Single'}
          onPress={() => setDisableRange((d) => !d)}
        />
        <Button
          title={disabled ? 'Enable' : 'Disable'}
          onPress={() => setDisabled((d) => !d)}
        />
        <Button
          title={inverted ? 'LTR' : 'RTL'}
          onPress={() => setInverted((d) => !d)}
        />
        <Button
          title="Set 30–40"
          onPress={() => {
            setLow(30);
            setHigh(40);
          }}
        />
        <Button
          title="Set 50–20 (bad)"
          onPress={() => {
            setLow(50);
            setHigh(20);
          }}
        />
        {onClose && <Button title="Close" onPress={onClose} />}
      </View>
    </View>
  );
}

function EdgeCases() {
  const [value, setValue] = useState('');
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Uncontrolled · step 0.1 · min 0 max 1</Text>
      <RangeSlider
        style={styles.slider}
        min={0}
        max={1}
        step={0.1}
        onValueChanged={(l, h) => setValue(`${l} – ${h}`)}
      />
      <Text style={styles.status}>{value || 'drag me'}</Text>
      <Text style={styles.title}>step (7) larger than range (5)</Text>
      <RangeSlider style={styles.slider} min={0} max={5} step={7} />
      <Text style={styles.title}>min == max</Text>
      <RangeSlider style={styles.slider} min={3} max={3} step={1} />
    </View>
  );
}

export default function App() {
  const [modal, setModal] = useState<null | 'fullScreen' | 'pageSheet'>(null);
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.flex}>
          <StatusBar style="dark" />
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.header}>react-native-sticky-range-slider</Text>
            <AgeRange />
            <View style={styles.row}>
              <Button
                title="Open in Modal"
                onPress={() => setModal('fullScreen')}
              />
              {Platform.OS === 'ios' && (
                <Button
                  title="Open in pageSheet Modal"
                  onPress={() => setModal('pageSheet')}
                />
              )}
            </View>
            <EdgeCases />
          </ScrollView>
          <Modal
            visible={modal != null}
            animationType="slide"
            presentationStyle={modal ?? undefined}
            onRequestClose={() => setModal(null)}
          >
            {/* No GestureHandlerRootView here on purpose (issue #1). */}
            <View style={styles.modal}>
              <Text style={styles.header}>Inside a React Native Modal</Text>
              <AgeRange onClose={() => setModal(null)} />
            </View>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 16, gap: 16 },
  modal: { flex: 1, padding: 16, paddingTop: 64, backgroundColor: '#fff' },
  header: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  slider: { marginTop: 24, marginBottom: 8 },
  status: { textAlign: 'center', color: '#444' },
  valueText: { color: '#222', fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '600' },
  thumb: {
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    borderWidth: 3,
    borderColor: 'white',
  },
  low: { backgroundColor: '#8338ec' },
  high: { backgroundColor: '#06d6a0' },
  rail: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ccc' },
  railSelected: { height: 4, borderRadius: 2, backgroundColor: '#8338ec' },
});
