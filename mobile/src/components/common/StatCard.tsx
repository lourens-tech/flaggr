import React from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

interface Props {
  label: string;
  value: string | number;
  deltaPct: number;
  width?: DimensionValue;
}

export function StatCard({ label, value, deltaPct, width = '47%' }: Props) {
  const positive = deltaPct >= 0;
  return (
    <View style={[styles.card, { width }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <View style={styles.deltaRow}>
        <Ionicons
          name={positive ? 'arrow-up' : 'arrow-down'}
          size={10}
          color={positive ? colors.positive : colors.negative}
        />
        <Text style={[styles.delta, { color: positive ? colors.positive : colors.negative }]}>
          {Math.abs(deltaPct)}% vs Last Year
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.clubGreen,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    gap: 4,
  },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.darkGreen },
  value: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.darkGreen },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  delta: { fontFamily: fontFamily.body, fontSize: fontSize.tiny },
});
