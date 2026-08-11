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
      {/* TEXT.dim (0.22 alpha) lands around 1.8:1 on the dark background — well
          under the 4.5:1 floor, so this read as disabled rather than tappable.
          It is a real choice ("Not now"), so it gets a legible weight. */}
      <Text style={{...TYPE.uiSmall, color: TEXT.secondary}}>{label}</Text>
    </TouchableOpacity>
  );
};

export default OBSkipLink;
