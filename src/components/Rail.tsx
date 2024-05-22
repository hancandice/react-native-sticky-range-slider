import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { COLORS } from "../constants/colors";

const Rail = () => <View style={styles.rail} />;

export default memo(Rail);

const styles = StyleSheet.create({
  rail: {
    flex: 1,
    height: 3,
    borderRadius: 3,
    backgroundColor: COLORS.grey,
  },
});
