import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { colors } from '../theme';

export type MascotMood = 'idle' | 'happy' | 'cheer' | 'sad' | 'think';

// Zumi's mascot is blue in every mood; only the shade shifts so the mood still reads.
const MOOD_COLORS: Record<MascotMood, string> = {
  idle: colors.blue,
  happy: colors.blue,
  cheer: '#0EA5E9',
  sad: '#63B9E8',
  think: colors.blueDark,
};

export function Mascot({ mood = 'idle', size = 84 }: { mood?: MascotMood; size?: number }) {
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -4, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    pop.setValue(0.86);
    Animated.spring(pop, { toValue: 1, friction: 3, tension: 140, useNativeDriver: true }).start();
  }, [mood, pop]);

  if (size <= 0) return null;

  const eyeHeight = mood === 'sad' ? 4 : mood === 'cheer' ? 6 : 9;
  const smile = mood === 'sad' ? 0 : 1;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: MOOD_COLORS[mood],
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: bob }, { scale: pop }],
        borderWidth: 4,
        borderColor: 'rgba(2,132,199,0.2)',
      }}
    >
      <View style={{ flexDirection: 'row', gap: size * 0.16, marginTop: size * 0.02 }}>
        <View style={{ width: size * 0.14, height: eyeHeight, borderRadius: 99, backgroundColor: colors.white }} />
        <View style={{ width: size * 0.14, height: eyeHeight, borderRadius: 99, backgroundColor: colors.white }} />
      </View>
      <View
        style={{
          marginTop: size * 0.1,
          width: size * 0.3,
          height: size * 0.14,
          borderBottomWidth: 4,
          borderColor: colors.white,
          borderRadius: size * 0.15,
          transform: [{ rotate: smile ? '0deg' : '180deg' }],
        }}
      />
      <View style={{ position: 'absolute', right: size * 0.08, bottom: size * 0.16, flexDirection: 'row', gap: 3 }}>
        <View style={{ width: size * 0.08, height: 3, borderRadius: 2, backgroundColor: 'rgba(2,132,199,0.28)' }} />
        <View style={{ width: size * 0.08, height: 3, borderRadius: 2, backgroundColor: 'rgba(2,132,199,0.28)' }} />
      </View>
    </Animated.View>
  );
}
