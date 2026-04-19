import React from 'react';
import {Text, TouchableOpacity, StyleSheet} from 'react-native';
import {TEXT, TYPE} from '../../constants/onboarding';

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
    padding: 14,
  },
  text: {
    ...TYPE.uiSmall,
    color: TEXT.dim,
  },
});

export default OBSkipLink;
