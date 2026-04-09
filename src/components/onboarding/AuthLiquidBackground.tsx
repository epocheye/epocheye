import React, { type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const AuthLiquidBackground: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#000000', '#070707', '#000000']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.accentPrimary} />
      <View style={styles.accentSecondary} />

      <LinearGradient
        colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.76)']}
        locations={[0, 0.58, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  accentPrimary: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  accentSecondary: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(212,134,10,0.08)',
  },
});

export default AuthLiquidBackground;
