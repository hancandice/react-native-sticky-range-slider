import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/colors';

const RailSelected = () => <View style={styles.railSelected} />;

export default memo(RailSelected);

const styles = StyleSheet.create({
  railSelected: {
    height: 3,
    backgroundColor: COLORS.purple,
  },
});
