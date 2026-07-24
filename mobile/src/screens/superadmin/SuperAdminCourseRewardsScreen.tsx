import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { AdminReward } from '../../data/adminTypes';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseRewards'>;

const CATEGORY_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  rounds: 'golf',
  experiences: 'star-four-points-outline',
  'pro-shop': 'shopping',
  practice: 'golf-tee',
  dining: 'silverware-fork-knife',
};

function priceLabelFor(item: AdminReward): string {
  const prices = item.variants
    .filter((v) => v.active !== false)
    .map((v) => v.cost ?? 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return 'No active variants';
  if (prices.length === 1) return `${prices[0].toLocaleString()} Flagrr Cash`;
  return `${prices[0].toLocaleString()}–${prices[prices.length - 1].toLocaleString()} Flagrr Cash`;
}

// Same grid/card layout as AdminRewardsListScreen (the course_admin's own
// Rewards tab), rewired for an explicit courseId param so a super_admin can
// view and override any club's rewards from the Courses tab's "Manage
// Rewards" button, instead of relying on session-implicit scoping.
export function SuperAdminCourseRewardsScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { courseId, courseName, fbPerRand } = route.params;
  const { getSuperAdminRewards } = useAdmin();
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRewards(await getSuperAdminRewards(courseId));
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t load rewards', message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await load();
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId]),
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader
          title={courseName}
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity
              onPress={() => navigation.navigate('SuperAdminRewardEdit', { courseId, fbPerRand })}
              hitSlop={8}
              accessibilityLabel="Add Reward"
              accessibilityRole="button"
            >
              <Ionicons name="add-circle" size={26} color={colors.white} />
            </TouchableOpacity>
          }
        />
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : rewards.length === 0 ? (
        <Text style={styles.emptyText}>No rewards yet — tap + to create the first one.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {rewards.map((reward) => (
              <TouchableOpacity
                key={reward.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('SuperAdminRewardEdit', { courseId, fbPerRand, rewardId: reward.id })}
              >
                {reward.imageUrl ? (
                  <Image source={{ uri: reward.imageUrl }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imageFallback]}>
                    <MaterialCommunityIcons
                      name={CATEGORY_ICON[reward.category] ?? 'gift'}
                      size={40}
                      color={colors.lime}
                    />
                  </View>
                )}
                {!reward.active ? (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactive</Text>
                  </View>
                ) : null}

                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>{reward.title}</Text>
                  <Text style={styles.description} numberOfLines={2}>{reward.description}</Text>
                  <Text style={styles.cost}>{priceLabelFor(reward)}</Text>

                  <View style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.darkGreen} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { paddingHorizontal: screenPadding, paddingTop: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  card: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 112, backgroundColor: colors.imagePlaceholder },
  imageFallback: { backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  inactiveBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  inactiveBadgeText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.white },
  body: { padding: spacing.sm + 4, gap: 4 },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.cardTitle, color: colors.textPrimary },
  description: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cost: { fontFamily: fontFamily.heading, fontSize: fontSize.label, color: colors.textPrimary, marginTop: 2 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingVertical: 10,
    marginTop: 4,
  },
  editButtonText: { fontFamily: fontFamily.heading, fontSize: 12, color: colors.darkGreen },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
