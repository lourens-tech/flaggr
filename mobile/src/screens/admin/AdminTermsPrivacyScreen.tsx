import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAdminTheme } from '../../context/ThemeContext';
import { useAdmin } from '../../context/AdminContext';
import { useIsDesktopNav } from '../../hooks/useIsDesktopNav';
import { adminFont, adminRadius } from '../../theme/admin';
import { AdminDesktopFrame } from '../../components/admin/desktop/AdminDesktopFrame';
import { SuperAdminDesktopFrame } from '../../components/admin/desktop/SuperAdminDesktopFrame';
import { AdminMobileHeader } from '../../components/admin/AdminMobileHeader';
import { LAST_UPDATED, PRIVACY_SECTIONS, TERMS_SECTIONS, type Section } from '../profile/TermsPrivacyScreen';

// Terms and Privacy for every admin role: the same text as the member
// screen, kept inside the console window (sidebar on desktop, admin header
// on phones) instead of the member app's green header.
export function AdminTermsPrivacyScreen() {
  const { c } = useAdminTheme();
  const { admin } = useAdmin();
  const isDesktop = useIsDesktopNav();
  const isFlagrr = admin.role === 'super_admin' || admin.role === 'support_agent';

  const body = (
    <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.edge }]}>
      <Text style={[styles.updated, { color: c.ink3 }]}>Last updated: {LAST_UPDATED}</Text>
      <Doc title="Terms of Use" sections={TERMS_SECTIONS} />
      <View style={[styles.divider, { backgroundColor: c.edge }]} />
      <Doc title="Privacy Policy" sections={PRIVACY_SECTIONS} />
    </View>
  );

  if (isDesktop) {
    const profileKey = isFlagrr ? 'SuperAdminProfile' : admin.role === 'staff' ? 'AdminStaffProfile' : 'AdminCourseProfile';
    return isFlagrr ? (
      <SuperAdminDesktopFrame activeKey={profileKey} breadcrumb="Profile › Terms and Privacy" showRail={false}>
        {body}
      </SuperAdminDesktopFrame>
    ) : (
      <AdminDesktopFrame activeKey={profileKey} breadcrumb="Club Settings › Terms and Privacy" showRail={false}>
        {body}
      </AdminDesktopFrame>
    );
  }

  return (
    <View style={styles.screen}>
      <AdminMobileHeader title="Terms and Privacy" />
      <ScrollView contentContainerStyle={styles.phoneContent}>{body}</ScrollView>
    </View>
  );
}

function Doc({ title, sections }: { title: string; sections: Section[] }) {
  const { c } = useAdminTheme();
  return (
    <View>
      <Text accessibilityRole="header" style={[styles.docTitle, { color: c.ink }]}>{title}</Text>
      {sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.ink }]}>{s.heading}</Text>
          {s.body.map((p, i) => (
            <Text key={i} style={[styles.paragraph, { color: c.ink2 }, i > 0 && { marginTop: 6 }]}>
              {s.body.length > 1 ? `• ${p}` : p}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  phoneContent: { paddingHorizontal: 16, paddingBottom: 40 },
  tile: { borderRadius: adminRadius.md, borderWidth: StyleSheet.hairlineWidth, padding: 24, maxWidth: 760 },
  updated: { ...adminFont.body, fontSize: 13, marginBottom: 16 },
  docTitle: { ...adminFont.title, fontSize: 26, marginBottom: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 28 },
  section: { marginBottom: 20 },
  sectionTitle: { ...adminFont.bodyBold, fontSize: 16, marginBottom: 6 },
  paragraph: { ...adminFont.body, fontSize: 14.5, lineHeight: 21 },
});
