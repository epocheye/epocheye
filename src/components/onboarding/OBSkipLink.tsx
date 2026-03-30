import React from 'react';
import {Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import {FONTS} from '../../core/constants/theme';

interface Props {
  label?: string;
  onPress: () => void;
}

const OBSkipLink: React.FC<Props> = ({label = 'Skip for now', onPress}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      hitSlop={{top: 10, bottom: 10, left: 20, right: 20}}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    padding: 12,
  },
  text: {
    color: '#8C93A0',
    fontSize: 14,
    fontFamily: Platform.select({
      ios: FONTS.regular,
      android: FONTS.regular,
    }),
  },
});

export default OBSkipLink;
