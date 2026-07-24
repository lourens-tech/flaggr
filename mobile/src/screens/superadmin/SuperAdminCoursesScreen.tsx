import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList, SuperAdminTabParamList } from '../../navigation/types';
import { TextField } from '../../components/common/TextField';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';
import type { SuperAdminCourseSummary } from '../../data/adminTypes';

type Props = CompositeScreenProps<
  BottomTabScreenProps<SuperAdminTabParamList, 'SuperAdminCourses'>,
  NativeStackScreenProps<SuperAdminStackParamList>
>;

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
};

export function SuperAdminCoursesScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { superAdminCourses, loadSuperAdminCourses, cancelSuperAdminCourseSubscription, reactivateSuperAdminCourseSubscription } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return superAdminCourses;
    return superAdminCourses.filter(
      (c) => c.name.toLowerCase().includes(query) || c.slug.toLowerCase().includes(query),
    );
  }, [superAdminCourses, search]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadSuperAdminCourses();
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

  const handleCancelSubscription = (course: SuperAdminCourseSummary) => {
    showAlert(
      'Cancel this subscription?',
      `${course.name} will be marked as canceled. You can reactivate it again at any time.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setPendingCourseId(course.id);
            try {
              await cancelSuperAdminCourseSubscription(course.id);
            } catch (err) {
              const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
              showAlert('Couldn’t cancel subscription', message);
            } finally {
              setPendingCourseId(null);
            }
          },
        },
      ],
    );
  };

  const handleReactivateSubscription = async (course: SuperAdminCourseSummary) => {
    setPendingCourseId(course.id);
    try {
      await reactivateSuperAdminCourseSubscription(course.id);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t reactivate subscription', message);
    } finally {
      setPendingCourseId(null);
    }
  };

  const renderItem = ({ item }: { item: SuperAdminCourseSummary }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        {item.subscriptionStatus ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{SUBSCRIPTION_LABELS[item.subscriptionStatus] ?? item.subscriptionStatus}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardSlug} numberOfLines={1}>{item.slug}</Text>
      <View style={styles.cardStatsRow}>
        <View style={styles.cardStat}>
          <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.cardStatText}>{item.memberCount} members</Text>
        </View>
        <View style={styles.cardStat}>
          <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.cardStatText}>{item.adminCount} admin{item.adminCount === 1 ? '' : 's'}</Text>
        </View>
      </View>
      {item.onboardingCompletedAt === null ? <Text style={styles.pendingText}>Setup pending</Text> : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('SuperAdminCourseAds', { courseId: item.id, courseName: item.name })}
        >
          <Ionicons name="megaphone-outline" size={14} color={colors.clubGreen} />
          <Text style={styles.actionButtonText}>Manage Ads</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('SuperAdminCourseRewards', {
              courseId: item.id,
              courseName: item.name,
              fbPerRand: item.fbPerRand,
            })
          }
        >
          <Ionicons name="gift-outline" size={14} color={colors.clubGreen} />
          <Text style={styles.actionButtonText}>Manage Rewards</Text>
        </TouchableOpacity>
        {item.subscriptionStatus === 'canceled' ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleReactivateSubscription(item)}
            disabled={pendingCourseId === item.id}
          >
            <Ionicons name="refresh-outline" size={14} color={colors.clubGreen} />
            <Text style={styles.actionButtonText}>Reactivate</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCancelSubscription(item)}
            disabled={pendingCourseId === item.id}
          >
            <Ionicons name="close-circle-outline" size={14} color={colors.negative} />
            <Text style={[styles.actionButtonText, { color: colors.negative }]}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Courses</Text>
            <Text style={styles.headerSubtitle}>
              {superAdminCourses.length} club{superAdminCourses.length === 1 ? '' : 's'} on Flagrr
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('SuperAdminCourseCreate')}
            hitSlop={8}
            accessibilityLabel="Add Course"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.searchArea}>
        <TextField placeholder="Search courses" variant="onLight" icon="search" value={search} onChangeText={setSearch} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.clubGreen} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {superAdminCourses.length === 0 ? 'No courses yet — tap + to add one.' : 'No courses match your search.'}
            </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenPadding,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontFamily: fontFamily.headingDisplay, fontSize: fontSize.title, color: colors.white },
  headerSubtitle: { fontFamily: fontFamily.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  searchArea: { paddingHorizontal: screenPadding, paddingTop: spacing.md },
  listContent: { padding: screenPadding, gap: spacing.sm },
  card: {
    backgroundColor: colors.mintBg,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary },
  cardSlug: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  cardStatsRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  statusBadge: { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontFamily: fontFamily.bodySemiBold, fontSize: 10, color: colors.textPrimary },
  pendingText: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, rowGap: spacing.xs, marginTop: spacing.xs },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.tiny, color: colors.clubGreen },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
}
