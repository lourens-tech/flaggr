import React, { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { bentoBrand, bentoType } from '../../theme/bento';
import { PopIn } from '../../components/motion';
import { Appear, BentoButton, BentoScreen, BentoTile } from '../../components/bento';
import { LinearGradient } from 'expo-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'Voucher'>;

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' });

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function VoucherScreen({ route, navigation }: Props) {
  const { t } = useBento();
  const { vouchers, rewards, points, user } = useApp();
  const voucher = vouchers.find((v) => v.id === route.params.voucherId);
  const [imageFailed, setImageFailed] = useState(false);

  if (!voucher) {
    return (
      <BentoScreen title="Voucher" onBack={() => navigation.goBack()}>
        <BentoTile>
          <Text style={[bentoType.body, { color: t.muted, textAlign: 'center' }]}>Voucher not found.</Text>
        </BentoTile>
      </BentoScreen>
    );
  }

  const reward = rewards.find((r) => r.id === voucher.rewardId);
  const title = `${voucher.rewardTitle}${voucher.variantLabel && voucher.variantLabel !== 'Standard' ? ` — ${voucher.variantLabel}` : ''}`;

  return (
    <BentoScreen title="Voucher" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />

      {/* The ticket: reward photo, then a fairway stub with the QR and code. */}
      <Appear>
        <View style={{ borderRadius: 28, overflow: 'hidden', boxShadow: `0 0 0 1px ${t.ring}, ${t.shadow}` }}>
          <View style={{ height: 176, backgroundColor: bentoBrand.fairway, justifyContent: 'flex-end' }}>
            {reward?.imageUrl && !imageFailed ? (
              <Image source={{ uri: reward.imageUrl }} onError={() => setImageFailed(true)} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            ) : null}
            <LinearGradient colors={['rgba(10,24,17,0)', 'rgba(10,24,17,0.82)']} locations={[0.35, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 28, lineHeight: 32, letterSpacing: -0.28, color: '#FFFFFF' }} accessibilityRole="header">
                {title}
              </Text>
              {user.homeClub ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.86)', marginTop: 4 }}>{user.homeClub}</Text> : null}
            </View>
          </View>

          <View style={{ backgroundColor: bentoBrand.fairway, paddingVertical: 24, paddingHorizontal: 22, alignItems: 'center' }}>
            {/* Ticket notches and perforation */}
            <View pointerEvents="none" style={{ position: 'absolute', top: -14, left: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: t.ground }} />
            <View pointerEvents="none" style={{ position: 'absolute', top: -14, right: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: t.ground }} />
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 22, right: 22, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)' }} />

            <Text style={[bentoType.eyebrow, { color: bentoBrand.lime }]}>Reward Redeemed</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)', marginTop: 8, maxWidth: 290, textAlign: 'center' }}>
              Your reward has been successfully redeemed. Present your QR code or voucher code at the club to claim.
            </Text>
            <PopIn delay={220} from={0.8} style={{ marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF' }}>
              <View accessible accessibilityRole="image" accessibilityLabel="Voucher QR code">
                <QRCode value={voucher.qrValue} size={150} backgroundColor="#FFFFFF" color="#111412" />
              </View>
            </PopIn>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 14 }}>Voucher Code</Text>
            <Text selectable style={{ fontFamily: MONO, fontSize: 20, fontWeight: '500', letterSpacing: 1.6, color: bentoBrand.lime, marginTop: 4, textAlign: 'center' }}>
              {voucher.code}
            </Text>
          </View>
        </View>
      </Appear>

      <Appear>
        <BentoTile padding={0}>
          <View style={{ paddingHorizontal: 16 }}>
            <Row label="Redeemed" value={formatDay(voucher.issuedAt)} />
            {voucher.expiresAt ? <Row label="Expires" value={formatDay(voucher.expiresAt)} divider /> : null}
            <Row label="Cost" value={`${voucher.cost.toLocaleString()} FC`} divider />
            <Row label="Balance left" value={`${points.balance.toLocaleString()} FC`} divider />
          </View>
        </BentoTile>
      </Appear>

      <BentoButton label="Back to Rewards" nub onPress={() => navigation.navigate('Main')} />
    </BentoScreen>
  );
}

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const { t } = useBento();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: divider ? 1 : 0, borderTopColor: t.hair }}>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.ink }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{value}</Text>
    </View>
  );
}
