import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SuperAdminStackParamList } from '../../navigation/types';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminButton, PageTitle, Tile } from '../../components/admin/ui';
import { AdminApiError, type SuperAdminCourseCreateResponse } from '../../api/adminClient';
import { showAlert } from '../../utils/alert';
import { spacing } from '../../theme';
import { useAdminTheme } from '../../context/ThemeContext';
import { adminFont, adminRadius, type AdminColors } from '../../theme/admin';

type Props = NativeStackScreenProps<SuperAdminStackParamList, 'SuperAdminCourseCreate'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_COUNT = 4;

// Onboards a brand-new club onto Flagrr: course details -> its first course
// admin -> review and send -> success. Replaces manually inserting rows into
// Postgres, which is how every course/course_admin before this feature
// existed. Same wizard shape as AdminStaffEditScreen's add-staff flow.
export function SuperAdminCourseCreateScreen({ navigation }: Props) {
  const { c } = useAdminTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const isDesktop = useIsDesktopNav();
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

  const progressRow = (
    <View style={[styles.progressRow, !isDesktop && styles.progressRowPhone]} accessibilityLabel={`Step ${Math.min(step + 1, STEP_COUNT)} of ${STEP_COUNT}`}>
      {Array.from({ length: STEP_COUNT }).map((_, i) => (
        <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
      ))}
    </View>
  );

  const wizardBody = (
    <>
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
            <AdminButton label="Back" variant="plain" onPress={() => setStep(0)} disabled={saving} style={styles.backButton} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>Review and Send</Text>
            <View style={{ height: spacing.md }} />
            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Course</Text>
                <Text style={styles.reviewValue}>{courseName.trim()}</Text>
              </View>
              {contactEmail.trim() ? (
                <View style={[styles.reviewRow, styles.reviewRowRule]}>
                  <Text style={styles.reviewLabel}>Contact Email</Text>
                  <Text style={styles.reviewValue}>{contactEmail.trim()}</Text>
                </View>
              ) : null}
              <View style={[styles.reviewRow, styles.reviewRowRule]}>
                <Text style={styles.reviewLabel}>Course Admin</Text>
                <Text style={styles.reviewValue}>{adminFirstName.trim()} {adminLastName.trim()}</Text>
              </View>
              <View style={[styles.reviewRow, styles.reviewRowRule]}>
                <Text style={styles.reviewLabel}>Admin Email</Text>
                <Text style={styles.reviewValue}>{adminEmail.trim()}</Text>
              </View>
            </View>
            <Text style={styles.helpText}>
              A temporary password will be generated and emailed to the course admin, along with a login link.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Create Course" onPress={handleSend} loading={saving} />
            <AdminButton label="Back" variant="plain" onPress={() => setStep(1)} disabled={saving} style={styles.backButton} />
          </>
        ) : null}

        {step === 3 && created ? (
          <>
            <Ionicons name="checkmark-circle" size={56} color={c.accentText} style={styles.successIcon} />
            <Text style={[styles.title, styles.titleCentered]}>Course Created</Text>
            <Text style={styles.helpTextCentered}>
              {created.course.name} has been created, and {created.admin.firstName} has been emailed their login details.
            </Text>
            <View style={{ height: spacing.lg }} />
            <PillButton label="Done" onPress={() => navigation.goBack()} />
          </>
        ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <SuperAdminDesktopFrame activeKey="SuperAdminCourses" breadcrumb="Courses › New Course" showRail={false}>
        <PageTitle>New Course</PageTitle>
        <Tile style={styles.dCard}>
          {progressRow}
          <View style={{ height: spacing.lg }} />
          {wizardBody}
        </Tile>
      </SuperAdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="New Course" />

      {progressRow}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Tile>{wizardBody}</Tile>
      </ScrollView>
    </View>
  );
}

function createStyles(c: AdminColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressRowPhone: { paddingHorizontal: 16, paddingBottom: 4 },
  progressDot: { flex: 1, height: 4, borderRadius: adminRadius.pill, backgroundColor: c.fill },
  progressDotActive: { backgroundColor: c.segOn },
  content: { padding: 16, paddingBottom: spacing.xl * 2 },
  title: { ...adminFont.title, fontSize: 28, letterSpacing: -0.4, color: c.ink },
  titleCentered: { textAlign: 'center' },
  helpText: {
    ...adminFont.body,
    fontSize: 13,
    lineHeight: 19,
    color: c.ink2,
    marginTop: spacing.md,
  },
  helpTextCentered: {
    ...adminFont.body,
    fontSize: 15,
    lineHeight: 21,
    color: c.ink2,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reviewCard: {
    backgroundColor: c.fill,
    borderRadius: adminRadius.sm,
    paddingHorizontal: 14,
  },
  reviewRow: { paddingVertical: 11 },
  reviewRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.edge },
  reviewLabel: { ...adminFont.body, fontSize: 12.5, color: c.ink2 },
  reviewValue: { ...adminFont.bodySemiBold, fontSize: 15, color: c.ink, marginTop: 2 },
  successIcon: { alignSelf: 'center', marginBottom: spacing.sm },
  backButton: { alignSelf: 'center', marginTop: spacing.sm, height: 44 },
  dCard: { maxWidth: 520, marginTop: 16, padding: 24 },
});
}
