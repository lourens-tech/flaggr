import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList, AdminTabParamList } from '../../navigation/types';
import { useAdmin } from '../../context/AdminContext';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import type { AdminReward } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'AdminRewards'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AdminRewardsListScreen({ navigation }: Props) {
  const { rewards, loadRewards } = useAdmin();
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadRewards();
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

  const renderItem = ({ item }: { item: AdminReward }) => {
    const priceRange = item.variants
      .filter((v) => v.active !== false)
      .map((v) => v.cost ?? 0)
      .sort((a, b) => a - b);
    const priceLabel =
      priceRange.length === 0
        ? 'No active variants'
        : priceRange.length === 1
          ? `${priceRange[0].toLocaleString()} FC`
          : `${priceRange[0].toLocaleString()}–${priceRange[priceRange.length - 1].toLocaleString()} FC`;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('AdminRewardEdit', { rewardId: item.id })}
        activeOpacity={0.8}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="gift-outline" size={20} color={colors.clubGreen} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.subtitle}>{priceLabel}</Text>
        </View>
        {!item.active ? (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactive</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rewards</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminRewardEdit', {})}
            hitSlop={8}
            accessibilityLabel="Add Reward"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={28} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={rewards}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No rewards yet — tap + to create your first one.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  header: {
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  listContent: { padding: screenPadding, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
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
  inactiveBadge: { backgroundColor: '#F2F2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  inactiveBadgeText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
