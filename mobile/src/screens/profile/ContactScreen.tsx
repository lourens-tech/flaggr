import React, { useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { PillButton } from '../../components/common/PillButton';
import { FaqAccordion } from '../../components/common/FaqAccordion';
import { faqs } from '../../data/faqData';
import { colors, fontFamily, fontSize, radius, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Contact'>;

const ENQUIRY_TYPES = ['Rewards & Points', 'Receipts', 'Membership', 'Technical Issue', 'Other'];

export function ContactScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [enquiryType, setEnquiryType] = useState('');
  const [message, setMessage] = useState('');
  const [showTypes, setShowTypes] = useState(false);

  const handleSubmit = () => {
    Alert.alert('Enquiry sent', 'Thanks — our team will get back to you shortly.');
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ScreenHeader title="Contact Us" onBack={() => navigation.goBack()} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Have Any Questions?</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField variant="onLight" placeholder="Name" value={name} onChangeText={setName} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField variant="onLight" placeholder="Surname" value={surname} onChangeText={setSurname} />
            </View>
          </View>
          <View style={{ height: spacing.sm }} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField variant="onLight" placeholder="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField variant="onLight" placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>
          </View>
          <View style={{ height: spacing.sm }} />

          <TouchableOpacity style={styles.dropdown} onPress={() => setShowTypes((v) => !v)}>
            <Text style={[styles.dropdownText, !enquiryType && { color: colors.textSecondary }]}>
              {enquiryType || 'Choose Type Of Support Enquiry'}
            </Text>
            <Ionicons name={showTypes ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {showTypes ? (
            <View style={styles.dropdownList}>
              {ENQUIRY_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setEnquiryType(type);
                    setShowTypes(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ height: spacing.sm }} />
          <TextInput
            placeholder="Type Your Message Here"
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            style={styles.messageInput}
          />

          <View style={{ height: spacing.lg }} />
          <PillButton label="Submit Enquiry" onPress={handleSubmit} />
        </View>

        <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
        <FaqAccordion items={faqs} initialOpenIndex={0} />

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerSafeArea: { backgroundColor: colors.darkGreen },
  heroContent: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, paddingTop: spacing.md },
  heroTitle: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.white },
  content: { padding: screenPadding },
  formCard: { backgroundColor: colors.white, marginTop: -spacing.xl },
  row: { flexDirection: 'row', gap: spacing.sm },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F6F8',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    height: 53,
    paddingHorizontal: spacing.md,
  },
  dropdownText: { fontFamily: fontFamily.body, fontSize: fontSize.body, color: colors.textPrimary },
  dropdownList: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: radius.md, marginTop: 4 },
  dropdownItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  dropdownItemText: { fontFamily: fontFamily.body, fontSize: fontSize.small, color: colors.textPrimary },
  messageInput: {
    backgroundColor: '#F5F6F8',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  sectionLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.small, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
});
