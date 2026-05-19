import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {TEXT, TYPE} from '../../constants/onboarding';

interface Props {
  label?: string;
  onPress: () => void;
}

const OBSkipLink: React.FC<Props> = ({label = 'Skip for now', onPress}) => {
  return (
    <TouchableOpacity
      className="self-center p-[14px]"
      onPress={onPress}
      hitSlop={{top: 10, bottom: 10, left: 20, right: 20}}>
      <Text style={{...TYPE.uiSmall, color: TEXT.dim}}>{label}</Text>
    </TouchableOpacity>
  );
};

export default OBSkipLink;
