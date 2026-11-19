import { memo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

export interface Palette {
  thumb: string;
  rail: string;
  selectedRail: string;
  label: string;
}

export const LIGHT: Palette = {
  thumb: '#FFFFFF',
  rail: '#C7C7CC',
  selectedRail: '#007AFF',
  label: '#1C1C1E',
};

export const DARK: Palette = {
  thumb: '#FFFFFF',
  rail: '#48484A',
  selectedRail: '#0A84FF',
  label: '#F2F2F7',
};

export const THUMB_SIZE = 28;

export const DefaultThumb = memo(({ color }: { color: string }) => (
  <View style={[styles.thumb, { backgroundColor: color }]} />
));

export const DefaultRail = memo(({ color }: { color: string }) => (
  <View style={[styles.rail, { backgroundColor: color }]} />
));

export const DefaultRailSelected = memo(({ color }: { color: string }) => (
  <View style={[styles.railSelected, { backgroundColor: color }]} />
));

export const DefaultLabel = memo(
  ({
    text,
    color,
    style,
  }: {
    text: string;
    color: string;
    style?: StyleProp<TextStyle>;
  }) => <Text style={[styles.label, { color }, style]}>{text}</Text>
);

const styles = StyleSheet.create({
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
      default: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      },
    }),
  },
  rail: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  railSelected: {
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
