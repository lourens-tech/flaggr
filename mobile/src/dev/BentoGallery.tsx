import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useBento } from '../context/ThemeContext';
import { bentoBrand } from '../theme/bento';
import { showAlert } from '../utils/alert';
import { BentoRow, BentoRowGroup, ChatBubble, ChatDay, EmptyState, LoadError, PickerSheet, StatusPill } from '../components/bento/parts';
import {
  Appear,
  BentoButton,
  BentoField,
  BentoScreen,
  BentoSheet,
  BentoTabBarView,
  BentoTile,
  BentoToggle,
  Body,
  CountUp,
  Eyebrow,
  FillBar,
  GlassIconButton,
  H1,
  Label,
  Ring,
  SegmentedControl,
  showToast,
} from '../components/bento';

// Dev-only gallery of the Bento foundation components (web build, `?bento`
// or `?bento=dark` in the URL; see App.tsx). Never reachable in production:
// App.tsx only renders it when __DEV__ is true. The numbers here are sample
// values for checking layout, not product data.

const TABS4 = ['Home', 'Course', 'Rewards', 'Profile'];
const TABS6 = ['Home', 'Course', 'MyGolf', 'Rewards', 'Activity', 'Profile'];

export function BentoGallery() {
  const [picker, setPicker] = useState(false);
  const [pick, setPick] = useState<string | null>('bookings');
  const { t } = useBento();
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [share, setShare] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [six, setSix] = useState(false);
  const [tab, setTab] = useState(0);
  const tabs = (six ? TABS6 : TABS4).map((name) => ({ key: name, name }));

  return (
    <View style={{ flex: 1 }}>
      <BentoScreen tabBar>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Bento · Phase 1</Eyebrow>
            <H1 style={{ marginTop: 6 }}>Foundation{'\n'}components</H1>
          </View>
          <GlassIconButton icon="bell" badge onPress={() => showToast('Toast', 'Grows out of the island for ~3 s')} accessibilityLabel="Show toast" />
        </View>
        <View style={{ height: 10 }} />

        <View style={{ flexDirection: 'row', gap: 12, height: 348 }}>
          <Appear style={{ flex: 1.2 }}>
            <BentoTile tone="hero" style={{ flex: 1 }} innerStyle={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 14, color: t.onHeroMuted }}>Hero tile</Text>
                <CountUp value={12480} style={{ fontFamily: 'Fraunces_700Bold', fontSize: 42, lineHeight: 44, letterSpacing: -1.2, color: '#FFFFFF', marginTop: 10 }} />
              </View>
              <Ring progress={0.64} color={bentoBrand.lime} track="rgba(255,255,255,0.14)">
                <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 19, color: '#FFFFFF' }}>64%</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>ring</Text>
              </Ring>
              <BentoButton label="Lime" variant="lime" nub compact onPress={() => {}} />
            </BentoTile>
          </Appear>
          <View style={{ flex: 1, gap: 12 }}>
            <Appear style={{ flex: 1 }}>
              <BentoTile style={{ flex: 1 }} innerStyle={{ justifyContent: 'space-between' }} padding={15}>
                <Body muted style={{ fontSize: 13 }}>Tile</Body>
                <View>
                  <CountUp value={6} style={{ fontFamily: 'Fraunces_700Bold', fontSize: 38, color: t.ink }} />
                  <FillBar progress={0.75} color={t.accent} track={t.track} style={{ marginTop: 10 }} />
                </View>
              </BentoTile>
            </Appear>
            <Appear style={{ flex: 1 }}>
              <BentoTile style={{ flex: 1 }} onPress={() => setSheet(true)} accessibilityLabel="Open sheet" innerStyle={{ justifyContent: 'flex-end' }}>
                <Label>Pressable tile</Label>
                <Body muted style={{ fontSize: 13 }}>Opens the sheet</Body>
              </BentoTile>
            </Appear>
          </View>
        </View>

        <Appear>
          <BentoTile>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.ink }}>Segmented</Text>
              <SegmentedControl
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'month', label: 'Month' },
                  { value: 'year', label: 'Year' },
                  { value: 'all', label: 'All' },
                ]}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.hair }}>
              <View style={{ flex: 1 }}>
                <Label>Toggle</Label>
                <Body muted style={{ fontSize: 13 }}>{share ? 'On' : 'Off'}</Body>
              </View>
              <BentoToggle value={share} onValueChange={setShare} accessibilityLabel="Sample toggle" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: t.hair }}>
              <View style={{ flex: 1 }}>
                <Label>Tab bar layout</Label>
                <Body muted style={{ fontSize: 13 }}>{six ? '6 tabs + Scan (live app)' : '4 tabs + Scan (design)'}</Body>
              </View>
              <BentoToggle value={six} onValueChange={(v) => { setSix(v); setTab(0); }} accessibilityLabel="Six tabs" />
            </View>
          </BentoTile>
        </Appear>

        <BentoButton label="Primary with nub" nub onPress={() => {}} />
        <BentoButton label="Primary" onPress={() => {}} />
        <BentoButton label="Secondary" variant="secondary" onPress={() => {}} />
        <BentoButton label="Disabled" disabled onPress={() => {}} />

        <BentoField label="Text field" placeholder="e.g. 082 123 4567" helper="Helper text sits below, 13 pt muted." />
        <BentoField label="With an error" value="short" error="Your new password must be at least 8 characters." onChangeText={() => {}} />
        <BentoField label="With an icon" placeholder="DD / MM / YYYY" rightIcon="calendar" />
        <BentoField label="Multiline" multiline placeholder="Tell us more" />

        <Appear>
          <BentoTile>
            <Label style={{ marginBottom: 12 }}>Dialogs</Label>
            <View style={{ gap: 10 }}>
              <BentoButton
                label="Alert · two buttons"
                variant="secondary"
                onPress={() =>
                  showAlert('Delete this round?', 'It will be removed from your scorecards and My Golf stats. This can’t be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive' },
                  ])
                }
              />
              <BentoButton label="Alert · one button" variant="secondary" onPress={() => showAlert('This is not a valid slip', 'Please scan a valid slip.', [{ text: 'Try Again' }])} />
              <BentoButton label="Sheet" variant="secondary" onPress={() => setSheet(true)} />
              <BentoButton label="Toast" variant="secondary" onPress={() => showToast('Receipt submitted', 'Your receipt is being reviewed')} />
            </View>
          </BentoTile>
        </Appear>

        {/* Phase 3 shared parts (components/bento/parts.tsx) */}
        <BentoRowGroup>
          <BentoRow icon="bell" label="Notification Preferences" onPress={() => showToast('Row pressed')} />
          <BentoRow icon="profile" label="Appearance" value="Light" onPress={() => showToast('Row pressed')} />
          <BentoRow icon="info" label="Delete account" tone="danger" onPress={() => showToast('Row pressed')} />
          <BentoRow label="Receipt scanned" sublabel="Earned · 24 Nov" trailing={<StatusPill label="Under review" tone="warn" />} />
        </BentoRowGroup>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill label="Approved" tone="accent" />
          <StatusPill label="Under review" tone="warn" />
          <StatusPill label="Already redeemed" tone="muted" />
          <StatusPill label="Expired" tone="danger" />
        </View>
        <EmptyState icon="activity" title="No activity yet" body="Play a round or scan a receipt to get started." actionLabel="Scan a receipt" onAction={() => showToast('Scan')} />
        <LoadError onRetry={() => showToast('Retry')} />
        <BentoTile>
          <ChatDay label="Today" />
          <View style={{ gap: 10, marginTop: 8 }}>
            <ChatBubble mine text="Hi, can we book a four-ball for Saturday morning?" meta="09:58" />
            <ChatBubble mine={false} text="07:36 is open for four. Shall I put it in your name?" meta="Pro shop · 10:42" />
          </View>
        </BentoTile>
        <BentoButton label="Picker sheet" variant="secondary" onPress={() => setPicker(true)} />
        <PickerSheet
          visible={picker}
          title="Type of enquiry"
          options={[{ value: 'bookings', label: 'Bookings' }, { value: 'receipts', label: 'Receipts' }, { value: 'general', label: 'General', sublabel: 'Anything else' }]}
          selected={pick}
          onSelect={(v) => { setPick(v); setPicker(false); }}
          onClose={() => setPicker(false)}
          searchPlaceholder="Search"
        />

        {[1, 2, 3].map((n) => (
          <Appear key={n}>
            <BentoTile>
              <Label>Below the fold {n}</Label>
              <Body muted>Reveals as it scrolls into view.</Body>
            </BentoTile>
          </Appear>
        ))}
      </BentoScreen>

      <BentoTabBarView tabs={tabs} activeIndex={tab} onTabPress={(_t, i) => setTab(i)} onScanPress={() => showToast('Scan pressed')} />

      <BentoSheet
        visible={sheet}
        title="Sheet title"
        subtitle="Rises with a slight overshoot; the backdrop dims."
        onClose={() => setSheet(false)}
        footer={<BentoButton label="Done" onPress={() => setSheet(false)} style={{ flex: 1 }} />}
      >
        <View style={{ borderRadius: 20, backgroundColor: t.seg, paddingHorizontal: 16, paddingVertical: 2 }}>
          {[
            ['Row label', 'Value'],
            ['Another row', 'Value'],
          ].map(([a, b], i) => (
            <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
              <Body muted>{a}</Body>
              <Body style={{ fontWeight: '600' }}>{b}</Body>
            </View>
          ))}
        </View>
      </BentoSheet>
    </View>
  );
}
