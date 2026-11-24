import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import { prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { PopIn } from '../../components/motion';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, CountUp } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptSuccess'>;

// Rays around the success badge (Receipt submitted board).
function Burst() {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x1: 80 + Math.cos(a) * 52, y1: 80 + Math.sin(a) * 52, x2: 80 + Math.cos(a) * 70, y2: 80 + Math.sin(a) * 70 };
  });
  return (
    <Svg width={160} height={160} viewBox="0 0 160 160" style={{ position: 'absolute', opacity: 0.55 }}>
      {rays.map((r, i) => (
        <Line key={i} {...r} stroke={bentoBrand.lime} strokeWidth={2.2} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

// Gently pulsing dot for "being reviewed".
function PulseDot() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.45, duration: 1200, useNativeDriver }),
        Animated.timing(v, { toValue: 1, duration: 1200, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bentoBrand.lime, opacity: v }} />;
}

export function ReceiptSuccessScreen({ route, navigation }: Props) {
  const { t } = useBento();
  const { pointsAwarded, flagged } = route.params;

  return (
    <BentoScreen>
      <View style={{ height: 10 }} />
      <Appear>
        <BentoTile tone="hero" padding={0}>
          <View style={{ paddingTop: 30, paddingHorizontal: 22, paddingBottom: 26, alignItems: 'center' }}>
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <Burst />
              <PopIn delay={150} from={0.4} style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center' }}>
                <BentoIcon name="check" size={40} color={bentoBrand.fairway} strokeWidth={2.4} />
              </PopIn>
            </View>
            <Text style={[bentoType.eyebrow, { color: bentoBrand.lime }]}>Your reward</Text>
            <CountUp
              value={`+${pointsAwarded} FC`}
              accessibilityLabel={`${pointsAwarded} Flagrr Cash`}
              style={[bentoType.number, { fontSize: 64, lineHeight: 66, letterSpacing: -1.9, color: '#FFFFFF', marginTop: 8, textAlign: 'center' }]}
            />
            <Text accessibilityRole="header" style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 22, lineHeight: 26, color: '#FFFFFF', marginTop: 10, textAlign: 'center' }}>
              Submitted successfully!
            </Text>
            {flagged ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <PulseDot />
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>Your receipt is being reviewed</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.9)', marginTop: 10, textAlign: 'center' }}>
                +{pointsAwarded} Flagrr Cash have been added to your wallet!
              </Text>
            )}
          </View>
        </BentoTile>
      </Appear>

      <Appear>
        <BentoTile>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: flagged ? t.warnBg : t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <BentoIcon name={flagged ? 'info' : 'receipt'} size={20} color={flagged ? t.warnInk : t.accent} strokeWidth={1.8} />
            </View>
            <Text style={[bentoType.body, { flex: 1, color: t.ink }]}>
              {flagged
                ? `This receipt was flagged for manual review. Once approved, ${pointsAwarded} Flagrr Cash will be added to your balance — no action is needed from you. You can check its status anytime under Profile > Receipt History.`
                : 'Your new Flagrr Cash balance is now available in your wallet and ready to redeem on rewards.\n\nPlay more rounds, scan your receipts, and redeem rewards to unlock higher membership tiers and exclusive benefits.'}
            </Text>
          </View>
        </BentoTile>
      </Appear>

      <View style={{ height: 6 }} />
      <BentoButton label="View Current Balance" nub onPress={() => navigation.navigate('Main')} />
      <BentoButton label="Submit Another Receipt" variant="secondary" onPress={() => navigation.replace('ScanReceipt')} />
    </BentoScreen>
  );
}
