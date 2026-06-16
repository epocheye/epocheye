import React, {type PropsWithChildren} from 'react';
import {View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const AuthLiquidBackground: React.FC<PropsWithChildren> = ({children}) => {
  return (
    <View className="flex-1 overflow-hidden bg-black">
      <LinearGradient
        colors={['#0A0A0C', '#100E15', '#0A0A0C']}
        locations={[0, 0.52, 1]}
        start={{x: 0.12, y: 0}}
        end={{x: 0.9, y: 1}}
        style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
      />

      <View
        className="absolute w-[220px] h-[220px] rounded-full bg-[rgba(255,255,255,0.05)]"
        style={{top: -40, right: -30}}
      />
      <View
        className="absolute w-[260px] h-[260px] rounded-full bg-[rgba(203,168,98,0.12)]"
        style={{bottom: -60, left: -40}}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.76)']}
        locations={[0, 0.58, 1]}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
      />

      <View className="flex-1">{children}</View>
    </View>
  );
};

export default AuthLiquidBackground;
