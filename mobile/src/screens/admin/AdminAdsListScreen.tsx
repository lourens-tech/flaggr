import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminAd } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminAds'>,
  NativeStackScreenProps<AdminStackParamList>
>;

const PLACEMENTS: Array<{ label: string; value: AdminAd['placement'] }> = [
  { label: 'Home', value: 'home' },
  { label: 'Rewards Shop', value: 'rewards_shop' },
];

export function AdminAdsListScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ads, loadAds } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [placement, setPlacement] = useState<AdminAd['placement']>('home');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadAds();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const filtered = ads.filter((a) => a.placement === placement);

  const renderItem = ({ item }: { item: AdminAd }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('AdminAdEdit', { adId: item.id })}
      activeOpacity={0.8}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="megaphone-outline" size={20} color={colors.clubGreen} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title || '(untitled ad)'}</Text>
        <Text style={styles.subtitle}>{item.clicks} clicks{item.active ? '' : ' · inactive'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ad Space</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminAdEdit', {})}
            hitSlop={8}
            accessibilityLabel="Add Ad"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={28} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.placementToggle}>
        {PLACEMENTS.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPlacement(p.value)}
            style={[styles.placementPill, placement === p.value && styles.placementPillActive]}
          >
            <Text style={[styles.placementText, placement === p.value && styles.placementTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No ads in this slot yet — tap + to add one.</Text>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  placementToggle: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: screenPadding, paddingTop: spacing.md },
  placementPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.mintBgAlt },
  placementPillActive: { backgroundColor: colors.darkGreen },
  placementText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.textPrimary },
  placementTextActive: { color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.imagePlaceholder },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary, marginTop: 2 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
