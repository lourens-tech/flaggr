import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { CommonActions, StackActions } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { ScanFlowParamList } from '../../navigation/types';
import { useBento } from '../../context/ThemeContext';
import { haptic } from '../../utils/haptics';
import { bentoBrand, bentoType } from '../../theme/bento';
import { prefersReducedMotion, useNativeDriver } from '../../theme/motion';
import { PopIn } from '../../components/motion';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, CountUp, showToast } from '../../components/bento';

type Props = StackScreenProps<ScanFlowParamList, 'ReceiptSuccess'>;

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
  // The receipt is in: one success tap as the screen arrives.
  useEffect(() => haptic.success(), []);

  return (
    <BentoScreen>
      <View style={{ height: 10 }} />
      <Appear>
        <BentoTile tone="hero" padding={0}>
          <View style={{ paddingTop: 30, paddingHorizontal: 22, paddingBottom: 26, alignItems: 'center' }}>
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <Burst />
              <PopIn delay={150} from={0.4} style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: bentoBrand.lime, alignItems: 'center', justifyContent: 'center' }}>
                <BentoIcon name="check" size={40} color={bentoBrand.fairway} strokeWidth={2.6} />
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
              // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no "wallet".
              <Text style={{ fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.88)', marginTop: 10, textAlign: 'center' }}>
                {pointsAwarded} Flagrr Cash added and ready to spend.
              </Text>
            )}
          </View>
        </BentoTile>
      </Appear>

      <Appear>
        <BentoTile>
          {/* Kept boards G-B-SuccessApproved / G-B-SuccessFlagged; brand words (owner decision 24 Nov 2026): no "wallet" or "balance". */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: flagged ? t.warnBg : t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <BentoIcon name={flagged ? 'info' : 'receipt'} size={22} color={flagged ? t.warnInk : t.accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              {flagged ? (
                <Text style={[styles.info, { color: t.ink }]}>
                  This receipt was flagged for manual review. Once approved, {pointsAwarded} Flagrr Cash will be added to your Flagrr Cash — no action is needed from you. You can check its status anytime under Profile &gt; Receipt History.
                </Text>
              ) : (
                <>
                  <Text style={[styles.info, { color: t.ink }]}>Your new Flagrr Cash is ready to redeem on rewards at your club.</Text>
                  <Text style={[styles.info, { color: t.ink }]}>Play more rounds, scan your receipts, and redeem rewards to unlock higher membership tiers and exclusive benefits.</Text>
                </>
              )}
            </View>
          </View>
        </BentoTile>
      </Appear>

      <View style={{ height: 6 }} />
      {/* Closes the whole scan flow and shows Home (owner's choice, 24 Nov 2026); Back can't return here. */}
      {/* Label: brand words (owner decision 24 Nov 2026), kept board wording. The "Receipt submitted" toast
          (owner-approved copy) follows once the flow has closed, as in the prototype (450 ms after leaving). */}
      <BentoButton
        label="View My Flagrr Cash"
        nub
        onPress={() => {
          navigation.dispatch(StackActions.popTo('Main', { screen: 'Home' }));
          setTimeout(() => showToast('Receipt submitted', flagged ? `+${pointsAwarded} FC once your club approves it` : undefined), 450);
        }}
      />
      {/* A fresh scanner in place of the whole flow (one camera screen, as in the prototype); Close then leaves the flow. */}
      <BentoButton label="Submit Another Receipt" variant="secondary" onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'ScanReceipt' }] }))} />
    </BentoScreen>
  );
}

const styles = StyleSheet.create({
  // Info tile copy: 14 pt at 1.5 line height (kept boards G-B-Success*).
  info: { fontSize: 14, lineHeight: 21 },
});
