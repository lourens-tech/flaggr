import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Share, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import type { ReferralInfo } from '../../api/client';
import { friendlyError } from '../../utils/errors';
import { bentoBrand, bentoType } from '../../theme/bento';
import { Appear, BentoButton, BentoIcon, BentoScreen, BentoTile, FillBar, LoadError, type BentoIconName } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'Referral'>;

// The board's photo is a design-canvas image; the app's own Flagrr golf photo stands in (also the admin backdrop).
const HERO_PHOTO = require('../../../assets/images/strand-golf-club-fairway.jpg');

export function ReferralScreen({ navigation }: Props) {
  const { t } = useBento();
  const { getReferralInfo } = useApp();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Owner decision (24 Nov 2026): a failed load shows a message with Try again, which runs the same load.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await getReferralInfo());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [getReferralInfo]);

  useEffect(() => {
    load();
    // Once on open, as before (not on refocus).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    if (!info) return;
    try {
      await Share.share({
        message: `Join me on Flagrr! Use my referral code ${info.code} when you sign up and we both earn Flagrr Cash.`,
      });
    } catch {
      // Share sheet dismissed/cancelled — nothing to do.
    }
  };

  const capped = info ? info.redeemedCount >= info.maxRedemptions : false;
  const progressText = info
    ? capped
      ? `You've reached the ${info.maxRedemptions}-referral limit — thank you!`
      : `${info.redeemedCount} of ${info.maxRedemptions} referral bonuses earned`
    : '';

  return (
    <BentoScreen title="Refer a Friend" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />
      {/* Hero: photo, title, code and Share (G-E-ReferralCapped) */}
      <Appear>
        <BentoTile tone="hero" padding={0}>
          <Image source={HERO_PHOTO} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.55 }} />
          <LinearGradient colors={['rgba(31,66,52,0.3)', 'rgba(31,66,52,0.96)']} locations={[0, 0.72]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ paddingTop: 96, paddingHorizontal: 18, paddingBottom: 18 }}>
            <Text style={[bentoType.h1, { fontSize: 30, lineHeight: 31, color: t.onHero }]}>Earn Flagrr Cash</Text>
            {info ? (
              <>
                <View
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(205,222,92,0.6)',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Your referral code</Text>
                  <Text selectable style={{ fontSize: 26, fontWeight: '500', letterSpacing: 0.12 * 26, color: bentoBrand.lime, marginTop: 4 }}>
                    {info.code}
                  </Text>
                </View>
                <BentoButton label="Share My Code" variant="lime" nub onPress={handleShare} style={{ marginTop: 14 }} />
              </>
            ) : null}
          </View>
        </BentoTile>
      </Appear>

      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      ) : error ? (
        <LoadError title="Couldn’t load your referral code" body={error} onRetry={load} />
      ) : info ? (
        <>
          <Appear>
            <BentoTile>
              <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{progressText}</Text>
              <FillBar
                progress={info.maxRedemptions > 0 ? info.redeemedCount / info.maxRedemptions : 0}
                color={t.accent}
                track={t.track}
                accessibilityLabel={progressText}
                style={{ marginTop: 12 }}
              />
            </BentoTile>
          </Appear>

          <Appear>
            <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 22, lineHeight: 24, letterSpacing: -0.44, color: t.ink, marginTop: 6 }]}>
              How it works
            </Text>
          </Appear>

          <Appear>
            <BentoTile padding={0} innerStyle={{ paddingHorizontal: 16 }}>
              <Explainer icon="profile" title="Refer a friend" lead="When a friend signs up and enters your code, you get " amount={`${info.memberBonus} Flagrr Cash`} />
              <Explainer icon="golfFlag" title="Refer a golf club" lead="When a golf club signs up for Flagrr using your code, you get " amount={`${info.courseBonus} Flagrr Cash`} divider />
            </BentoTile>
          </Appear>

          <Appear>
            <Text style={{ fontSize: 13, lineHeight: 20, color: t.muted }}>
              Your bonus is credited as soon as your friend's account is created, or once a referred club's first payment clears — you'll see it in your Activity feed and get a notification.
            </Text>
          </Appear>
        </>
      ) : null}
    </BentoScreen>
  );
}

function Explainer({ icon, title, lead, amount, divider }: { icon: BentoIconName; title: string; lead: string; amount: string; divider?: boolean }) {
  const { t } = useBento();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, borderTopWidth: divider ? 1 : 0, borderTopColor: t.hair }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <BentoIcon name={icon} size={20} color={t.accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{title}</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: t.muted, marginTop: 2 }}>
          {lead}
          <Text style={{ fontWeight: '700', color: t.ink }}>{amount}</Text>.
        </Text>
      </View>
    </View>
  );
}
