import React, { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { fontFamily, fontSize, screenPadding, spacing } from '../../theme';
import { useThemeColors, type ThemeColors } from '../../context/ThemeContext';

// Registered under RootStack (member), AdminStack (course_admin/staff), and
// SuperAdminStack (super_admin/support_agent) alike — only goBack() is used,
// so the prop type is kept loose instead of tying it to one param list.
interface Props {
  navigation: { goBack: () => void };
}

const LAST_UPDATED = 'July 2026';

interface Section {
  heading: string;
  body: string[];
}

// Platform-wide content — deliberately not club-specific (no club name,
// logo, or per-club branching), since Flagrr is the operator of the
// platform every Club's members and staff use, not any one Club.
const TERMS_SECTIONS: Section[] = [
  {
    heading: '1. Acceptance of These Terms',
    body: [
      'Welcome to Flagrr. These Terms of Use ("Terms") govern your access to and use of the Flagrr mobile app and website (the "App"). By creating an account or otherwise using the App, you agree to be bound by these Terms and by the Privacy Policy below. If you do not agree, please do not use the App.',
    ],
  },
  {
    heading: '2. What Flagrr Is',
    body: [
      'Flagrr is a loyalty platform used by members of participating golf clubs ("Clubs") to earn Flagrr Cash for eligible spend and activity, track progress through membership tiers, and redeem Flagrr Cash for rewards offered by their Club. Flagrr provides the technology platform; each Club is an independent business responsible for its own products, services, pricing, and reward fulfilment.',
    ],
  },
  {
    heading: '3. Eligibility',
    body: [
      'You must be at least 18 years old, or the age of majority where you live, to create a Flagrr account. By registering, you confirm the information you provide is accurate and that you meet this requirement.',
    ],
  },
  {
    heading: '4. Your Account',
    body: [
      'You’re responsible for keeping your login credentials confidential and for all activity on your account. Tell us right away if you suspect unauthorised access. You can change your password at any time from your Profile, or use "Forgot Password" if you’re locked out.',
    ],
  },
  {
    heading: '5. Flagrr Cash and Rewards',
    body: [
      'Flagrr Cash is a loyalty currency with no monetary value. It cannot be bought, sold, transferred between accounts, exchanged for cash, or redeemed for anything other than rewards made available in the App.',
      'Flagrr Cash is earned based on eligible receipts you submit and other qualifying activity, using the rules shown in the App (including your Club’s own catalog and your current membership tier).',
      'We and your Club may withhold, adjust, or reverse Flagrr Cash — and may reject, hold, or reverse a reward redemption — where we reasonably believe a receipt, transaction, or account activity is fraudulent, duplicated, or submitted in error.',
      'Rewards are subject to availability and to the Club’s own terms for using a reward once redeemed (for example, presenting a voucher within its stated validity period).',
      'Membership tiers, earning rates, and reward catalogs are set by us and by each Club and may change over time.',
    ],
  },
  {
    heading: '6. Submitting Receipts',
    body: [
      'When you submit a receipt for Flagrr Cash, you confirm it reflects a genuine transaction and that you haven’t previously submitted it. Submitting the same receipt more than once, submitting an altered or fraudulent receipt, or otherwise trying to manipulate your balance breaches these Terms and may result in reversed Flagrr Cash, suspension, or account termination.',
    ],
  },
  {
    heading: '7. Acceptable Use',
    body: [
      'You agree not to use the App for any unlawful purpose, attempt to gain unauthorised access to any account or system, interfere with the App’s normal operation, or use automated means to interact with the App without our permission.',
    ],
  },
  {
    heading: '8. Your Relationship With Your Club',
    body: [
      'Your Club is responsible for the goods and services it sells, the accuracy of its reward catalog, and honouring rewards redeemed through the App. Flagrr isn’t a party to, and isn’t responsible for, any transaction between you and your Club.',
    ],
  },
  {
    heading: '9. Intellectual Property',
    body: [
      'The App — including its design, text, graphics, and underlying software — is owned by Flagrr or its licensors and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the App beyond what ordinary use of the App itself allows.',
    ],
  },
  {
    heading: '10. Suspension and Termination',
    body: [
      'We may suspend or terminate your account if we reasonably believe you’ve breached these Terms or engaged in fraudulent activity, or if required to do so by law. You can close your own account at any time from Profile > Delete Account, which permanently removes your data as described in the Privacy Policy below.',
    ],
  },
  {
    heading: '11. Disclaimers',
    body: [
      'The App is provided "as is." We don’t guarantee it will be uninterrupted, error-free, or available at all times. To the fullest extent the law allows, Flagrr isn’t liable for indirect, incidental, or consequential loss arising from your use of the App.',
    ],
  },
  {
    heading: '12. Changes to These Terms',
    body: [
      'We may update these Terms from time to time. If we make material changes, we’ll let you know in the App. Continuing to use the App after changes take effect means you accept the updated Terms.',
    ],
  },
  {
    heading: '13. Governing Law',
    body: [
      'These Terms are governed by the laws of South Africa, without regard to conflict-of-law principles.',
    ],
  },
  {
    heading: '14. Contact',
    body: ['Questions about these Terms can be sent through the Contact Us page in the App.'],
  },
];

const PRIVACY_SECTIONS: Section[] = [
  {
    heading: '1. Introduction',
    body: [
      'This Privacy Policy explains what personal information Flagrr collects, how we use it, and the choices you have. It applies to everyone who uses the Flagrr App, across every participating Club.',
    ],
  },
  {
    heading: '2. Information We Collect',
    body: [
      'Account information: name, email address, phone number, date of birth, and the Club you select as your home club.',
      'Profile information you choose to add: a profile photo.',
      'Activity information: receipts you submit (including the photo and the data extracted from it), Flagrr Cash earned and redeemed, rewards and vouchers, membership tier and streak history, and any support messages or enquiries you send.',
      'Technical information: a push-notification device token if you enable notifications, and the session information needed to keep you signed in.',
    ],
  },
  {
    heading: '3. How We Use Your Information',
    body: [
      'We use your information to operate your loyalty account (calculating and awarding Flagrr Cash, tracking tier and streak progress, issuing and validating reward vouchers), verify your membership with your Club, detect and prevent fraud (for example, duplicate or manipulated receipts), respond to enquiries and support requests, send you service and — where you’ve opted in — promotional notifications, and maintain and improve the App.',
    ],
  },
  {
    heading: '4. How We Share Your Information',
    body: [
      'With your Club: your Club’s administrators and staff can see what’s needed to run your loyalty account with them and to validate reward redemptions — your name, contact details, activity, and receipts.',
      'With service providers: we use third-party providers for things like hosting, database storage, and sending emails, who process data on our behalf only as needed to provide those services.',
      'For legal reasons: we may disclose information if required by law, or to protect the rights, safety, or property of Flagrr, our Clubs, or our members.',
      'We do not sell your personal information.',
    ],
  },
  {
    heading: '5. Data Retention',
    body: [
      'We keep your information for as long as your account is active. If you delete your account, your profile, receipts, activity history, vouchers, and support/enquiry messages are permanently removed, aside from anything we’re required to retain for legal or accounting purposes.',
    ],
  },
  {
    heading: '6. Your Rights and Choices',
    body: [
      'Access and export: download a copy of your personal data at any time from Profile > Export My Data.',
      'Correction: update your name, phone, email, and birthday at any time from Profile > Edit Profile.',
      'Deletion: permanently delete your account and data at any time from Profile > Delete Account.',
      'Notification preferences: choose which categories of push notification you receive (Account Activity, Support Replies, Announcements) from Profile > Notification Preferences, or turn off notifications entirely at the operating-system level.',
      'Depending on where you live, you may have further rights under applicable data protection law (for example, South Africa’s Protection of Personal Information Act). Contact us through the Contact Us page to exercise any of these rights.',
    ],
  },
  {
    heading: '7. Push Notifications',
    body: [
      'If you enable push notifications, we send you updates about your own account (receipts, redemptions, tier and streak bonuses), replies to enquiries or support tickets you’ve raised, and — unless you opt out — announcements from your Club or from Flagrr. Change what you receive at any time in Notification Preferences.',
    ],
  },
  {
    heading: '8. Security',
    body: [
      'We use reasonable technical and organisational measures to protect your information, including encrypted connections between the App and our servers and password hashing for account credentials. No method of transmission or storage is completely secure, and we can’t guarantee absolute security.',
    ],
  },
  {
    heading: '9. Children’s Privacy',
    body: [
      'The App isn’t directed at children, and you must be at least 18 (or the age of majority where you live) to create an account. We don’t knowingly collect personal information from anyone below that age.',
    ],
  },
  {
    heading: '10. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. If we make material changes, we’ll let you know in the App. The "Last updated" date at the top of this page shows when it was last revised.',
    ],
  },
  {
    heading: '11. Contact Us',
    body: [
      'Questions about this Privacy Policy, or requests relating to your personal information, can be sent through the Contact Us page in the App.',
    ],
  },
];

function SectionBlock({ section, styles }: { section: Section; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{section.heading}</Text>
      {section.body.map((paragraph, i) => (
        <Text key={i} style={[styles.paragraph, i > 0 ? styles.paragraphSpacing : null]}>
          {section.body.length > 1 ? `• ${paragraph}` : paragraph}
        </Text>
      ))}
    </View>
  );
}

export function TermsPrivacyScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Terms and Privacy" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <Text style={styles.docTitle}>Terms of Use</Text>
        {TERMS_SECTIONS.map((section) => (
          <SectionBlock key={section.heading} section={section} styles={styles} />
        ))}

        <View style={styles.divider} />

        <Text style={styles.docTitle}>Privacy Policy</Text>
        {PRIVACY_SECTIONS.map((section) => (
          <SectionBlock key={section.heading} section={section} styles={styles} />
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafeArea: { backgroundColor: colors.clubGreen },
  content: { padding: screenPadding },
  lastUpdated: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.tiny,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  docTitle: {
    fontFamily: fontFamily.headingDisplay,
    fontSize: fontSize.title,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  sectionBlock: { marginBottom: spacing.lg },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  paragraph: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textSecondary, lineHeight: 20 },
  paragraphSpacing: { marginTop: 6 },
});
}
