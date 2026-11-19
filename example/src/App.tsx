import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { EdgeCases } from './EdgeCases';
import { Showcase } from './Showcase';

const TABS = ['Showcase', 'Edge cases'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const dark = useColorScheme() === 'dark';
  const [tab, setTab] = useState<Tab>('Showcase');
  const showcaseDark = dark;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.flex, showcaseDark ? styles.bgDark : styles.bgLight]}
        >
          <StatusBar style={showcaseDark ? 'light' : 'dark'} />
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(t)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: active
                        ? showcaseDark
                          ? '#F2F2F7'
                          : '#1C1C1E'
                        : showcaseDark
                          ? '#2C2C2E'
                          : '#E5E5EA',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      active !== showcaseDark ? styles.white : styles.ink,
                    ]}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {tab === 'Showcase' ? <Showcase /> : <EdgeCases />}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  tabText: { fontWeight: '600' },
  bgDark: { backgroundColor: '#000' },
  bgLight: { backgroundColor: '#F2F2F7' },
  white: { color: '#FFFFFF' },
  ink: { color: '#1C1C1E' },
});
