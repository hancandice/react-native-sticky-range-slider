import { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import RangeSlider, {
  type ThumbState,
  type ThumbType,
} from 'react-native-sticky-range-slider';

const MIN_AGE = 18;
const MAX_AGE = 60;
const THUMB_RADIUS = 12;

const Thumb = (type: ThumbType, state: ThumbState) => (
  <View
    style={[
      styles.thumb,
      type === 'high' ? styles.high : styles.low,
      state.pressed && styles.thumbPressed,
    ]}
  />
);
const Rail = () => <View style={styles.rail} />;
const RailSelected = () => <View style={styles.railSelected} />;

export function Button({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
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

/** The 0.x README demo, custom render props (also reproduces issue #1 in a Modal). */
function useCard() {
  return useColorScheme() === 'dark' ? dark : undefined;
}

function AgeRange({ onClose }: { onClose?: () => void }) {
  const dc = useCard();
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
    <View style={[styles.card, dc?.card]}>
      <Text style={[styles.title, dc?.text]}>
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
        onValueChange={handleValueChange}
        onSlidingComplete={() => setCompleted((c) => c + 1)}
        renderLowValue={(value) => (
          <Text style={[styles.valueText, dc?.text]}>{value}</Text>
        )}
        renderHighValue={(value) => (
          <Text style={[styles.valueText, dc?.text]}>
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
      <Text style={[styles.status, dc?.muted]} testID="age-status">
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

function Labeled({
  title,
  value,
  children,
}: {
  title: string;
  value?: string;
  children: React.ReactNode;
}) {
  const lc = useCard();
  return (
    <View style={styles.edge}>
      <Text style={[styles.edgeTitle, lc?.text]}>{title}</Text>
      {children}
      {value != null && (
        <Text style={[styles.status, lc?.muted]} testID={`${title}-value`}>
          {value}
        </Text>
      )}
    </View>
  );
}

function Values() {
  const [continuous, setContinuous] = useState('');
  const [decimalMax, setDecimalMax] = useState('');
  const [merge, setMerge] = useState({ low: 40, high: 46 });
  const d = useCard();
  return (
    <View style={[styles.card, d?.card]}>
      <Labeled title="Continuous (step 0)" value={continuous || 'drag me'}>
        <RangeSlider
          min={0}
          max={1}
          step={0}
          onValueChange={(l, h) => setContinuous(`${l} – ${h}`)}
          accessibilityLabel="Continuous"
        />
      </Labeled>
      <Labeled title="max 10.5, step 1" value={decimalMax || 'drag me'}>
        <RangeSlider
          min={0}
          max={10.5}
          step={1}
          onValueChange={(l, h) => setDecimalMax(`${l} – ${h}`)}
          accessibilityLabel="Decimal max"
        />
      </Labeled>
      <Labeled
        title="Labels merge (minRange 0)"
        value={`${merge.low} – ${merge.high}`}
      >
        <RangeSlider
          min={0}
          max={100}
          low={merge.low}
          high={merge.high}
          onValueChange={(low, high) => setMerge({ low, high })}
          accessibilityLabel="Merge"
        />
      </Labeled>
      <Labeled title="Disabled">
        <RangeSlider min={0} max={100} low={20} high={70} disabled />
      </Labeled>
      <Labeled title="step (7) larger than range (5)">
        <RangeSlider min={0} max={5} step={7} />
      </Labeled>
      <Labeled title="min == max">
        <RangeSlider min={3} max={3} />
      </Labeled>
    </View>
  );
}

export function EdgeCases() {
  const [modal, setModal] = useState<null | 'fullScreen' | 'pageSheet'>(null);
  const d = useCard();
  return (
    <>
      <ScrollView contentContainerStyle={[styles.scroll, d?.page]}>
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
        <Values />
      </ScrollView>
      <Modal
        visible={modal != null}
        animationType="slide"
        presentationStyle={modal ?? undefined}
        onRequestClose={() => setModal(null)}
      >
        {/* No GestureHandlerRootView here on purpose (issue #1). */}
        <SafeAreaProvider>
          <SafeAreaView style={[styles.modal, d?.page]}>
            <Text style={[styles.header, d?.text]}>
              Inside a React Native Modal
            </Text>
            <AgeRange onClose={() => setModal(null)} />
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, backgroundColor: '#fafafa' },
  modal: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 12,
  },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, gap: 8 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  slider: { marginBottom: 8 },
  status: { textAlign: 'center', color: '#444' },
  valueText: { color: '#222', fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  edge: { gap: 4, marginBottom: 12 },
  edgeTitle: { fontWeight: '600', color: '#222' },
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
  thumbPressed: { borderColor: '#ddd' },
  low: { backgroundColor: '#8338ec' },
  high: { backgroundColor: '#06d6a0' },
  rail: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ccc' },
  railSelected: { height: 4, borderRadius: 2, backgroundColor: '#8338ec' },
});

const dark = StyleSheet.create({
  page: { backgroundColor: '#000' },
  card: { backgroundColor: '#1C1C1E' },
  text: { color: '#F2F2F7' },
  muted: { color: '#8E8E93' },
});
