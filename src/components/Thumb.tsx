import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { COLORS } from "../constants/colors";


const THUMB_RADIUS = 10;

const Thumb = () => <View style={styles.thumb} />;

const styles = StyleSheet.create({
  thumb: {
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    borderWidth: 1,
    borderColor: COLORS.white,
    backgroundColor: COLORS.purple,
  },
});

export default memo(Thumb);
