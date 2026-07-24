import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { AdminApiError, type SuperAdminCourseCreateResponse } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseCreate'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 4;

// Onboards a brand-new club onto Flagrr: course details -> its first course
// admin -> review and send -> success. Replaces manually inserting rows into
// Postgres, which is how every course/course_admin before this feature
// existed. Same wizard shape as AdminStaffEditScreen's add-staff flow.
export function SuperAdminCourseCreateScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createSuperAdminCourse } = useAdmin();

  const [step, setStep] = useState(0);
  const [courseName, setCourseName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<SuperAdminCourseCreateResponse | null>(null);

  const validateCourseDetails = () => {
    if (!courseName.trim()) {
      showAlert('Missing info', 'Course name is required.');
      return false;
    }
    if (contactEmail.trim() && !EMAIL_PATTERN.test(contactEmail.trim())) {
      showAlert('Invalid email', 'Enter a valid contact email address.');
      return false;
    }
    return true;
  };

  const validateAdminDetails = () => {
    if (!adminFirstName.trim() || !adminEmail.trim()) {
      showAlert('Missing info', 'Admin first name and email are required.');
      return false;
    }
    if (!EMAIL_PATTERN.test(adminEmail.trim())) {
      showAlert('Invalid email', 'Enter a valid admin email address.');
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    setSaving(true);
    try {
      const result = await createSuperAdminCourse({
        courseName: courseName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        adminFirstName: adminFirstName.trim(),
        adminLastName: adminLastName.trim(),
        adminEmail: adminEmail.trim(),
      });
      setCreated(result);
      setStep(3);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : 'Something went wrong. Please try again.';
      showAlert('Couldn’t create course', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="New Course" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <View style={styles.progressRow}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <>
            <Text style={styles.title}>Course Details</Text>
            <View style={{ height: spacing.md }} />
            <TextField placeholder="Course Name" variant="onLight" value={courseName} onChangeText={setCourseName} />
            <View style={{ height: spacing.md }} />
            <TextField
              placeholder="Contact Email (optional)"
              variant="onLight"
              autoCapitalize="none"
              keyboardType="email-address"
              value={contactEmail}
              onChangeText={setContactEmail}
            />
            <View style={{ height: spacing.lg }} />
            <PillButton
              label="Next: Course Admin"
              onPress={() => {
                if (validateCourseDetails()) setStep(1);
              }}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>Course Admin Details</Text>
            <Text style={styles.helpText}>Who will manage {courseName || 'this club'} day to day.</Text>
            <View style={{ height: spacing.md }} />
            <TextField placeholder="First Name" variant="onLight" value={adminFirstName} onChangeText={setAdminFirstName} />
            <View style={{ height: spacing.md }} />
            <TextField placeholder="Last Name" variant="onLight" value={adminLastName} onChangeText={setAdminLastName} />
            <View style={{ height: spacing.md }} />
            <TextField
              placeholder="Email"
              variant="onLight"
              autoCapitalize="none"
              keyboardType="email-address"
              value={adminEmail}
              onChangeText={setAdminEmail}
            />
            <Text style={styles.helpText}>
              They'll log in with this email and a temporary password, and set their own password the first time
              they log in.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton
              label="Next: Review"
              onPress={() => {
                if (validateAdminDetails()) setStep(2);
              }}
            />
            <TouchableOpacity onPress={() => setStep(0)} style={styles.backButton} disabled={saving}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>Review and Send</Text>
            <View style={{ height: spacing.md }} />
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLabel}>Course</Text>
              <Text style={styles.reviewValue}>{courseName.trim()}</Text>
              {contactEmail.trim() ? (
                <>
                  <View style={{ height: spacing.sm }} />
                  <Text style={styles.reviewLabel}>Contact Email</Text>
                  <Text style={styles.reviewValue}>{contactEmail.trim()}</Text>
                </>
              ) : null}
              <View style={{ height: spacing.sm }} />
              <Text style={styles.reviewLabel}>Course Admin</Text>
              <Text style={styles.reviewValue}>{adminFirstName.trim()} {adminLastName.trim()}</Text>
              <View style={{ height: spacing.sm }} />
              <Text style={styles.reviewLabel}>Admin Email</Text>
              <Text style={styles.reviewValue}>{adminEmail.trim()}</Text>
            </View>
            <Text style={styles.helpText}>
              A temporary password will be generated and emailed to the course admin, along with a login link.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Create Course" onPress={handleSend} loading={saving} />
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton} disabled={saving}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {step === 3 && created ? (
          <>
            <Ionicons name="checkmark-circle" size={48} color={colors.clubGreen} style={styles.successIcon} />
            <Text style={styles.title}>Course Created</Text>
            <Text style={styles.helpTextCentered}>
              {created.course.name} is live, and {created.admin.firstName} has been emailed their login details.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Done" onPress={() => navigation.goBack()} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: screenPadding, paddingTop: spacing.md },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.inputBorder },
  progressDotActive: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding, paddingBottom: spacing.xl * 2 },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.title, color: colors.textPrimary },
  helpText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  helpTextCentered: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reviewCard: {
    backgroundColor: colors.mintBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reviewLabel: { fontFamily: fontFamily.body, fontSize: fontSize.tiny, color: colors.textSecondary },
  reviewValue: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textPrimary, marginTop: 2 },
  successIcon: { alignSelf: 'center', marginBottom: spacing.sm },
  backButton: { alignItems: 'center', marginTop: spacing.md },
  backButtonText: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.body, color: colors.textSecondary },
});
}
