import React, { memo } from "react";
import { StyleSheet, Text } from "react-native";
import { COLORS } from "../constants/colors";

const TextValue = ({ value }: { value: number }) => <Text style={styles.text}>{value}</Text>;

export default memo(TextValue);

const styles = StyleSheet.create({
  text: {
    color: COLORS.purple,
  },
});
