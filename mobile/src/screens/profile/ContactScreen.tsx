import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { FaqAccordion } from '../../components/common/FaqAccordion';
import { faqs } from '../../data/faqData';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { bentoLayout as L, bentoType } from '../../theme/bento';
import { BentoButton, BentoField, BentoIcon, BentoScreen, PickerSheet } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'Contact'>;

// Brand words (owner decision 24 Nov 2026): "Rewards and Flagrr Cash", not "Rewards and Points" (G-E-ContactTypes).
const ENQUIRY_TYPES = ['Rewards and Flagrr Cash', 'Receipts', 'Membership', 'Technical Issue', 'Other'] as const;
const TYPE_PLACEHOLDER = 'Choose Type Of Support Enquiry';

// Layout from G-E-ContactFAQ / ContactTypes / ContactSubmitting.
export function ContactScreen({ navigation }: Props) {
  const { t } = useBento();
  const { user, sendContactEnquiry } = useApp();
  const [name, setName] = useState(user.firstName);
  const [surname, setSurname] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [email, setEmail] = useState(user.email);
  const [enquiryType, setEnquiryType] = useState('');
  const [message, setMessage] = useState('');
  const [showTypes, setShowTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      showAlert('Add a message', 'Let us know what your enquiry is about before sending.');
      return;
    }
    setSubmitting(true);
    try {
      const enquiryId = await sendContactEnquiry({ name, surname, phone, email, enquiryType, message: message.trim() });
      navigation.replace('EnquiryChat', { enquiryId });
    } catch (err) {
      showAlert('Couldn’t send your enquiry', friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BentoScreen title="Contact Us" onBack={() => navigation.goBack()}>
      <View style={{ height: 2 }} />
      <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 30, lineHeight: 31, color: t.ink }]}>
        Have Any Questions?
      </Text>

      <Pressable
        onPress={() => navigation.navigate('MyEnquiries')}
        accessibilityRole="button"
        accessibilityLabel="View my previous enquiries"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
      >
        <BentoIcon name="chatBubble" size={18} color={t.accent} strokeWidth={1.8} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.accent }}>View my previous enquiries</Text>
        <BentoIcon name="chevronRight" size={16} color={t.accent} strokeWidth={1.8} />
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <BentoField label="Name" value={name} onChangeText={setName} containerStyle={{ flex: 1 }} />
        <BentoField label="Surname" value={surname} onChangeText={setSurname} containerStyle={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <BentoField label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} containerStyle={{ flex: 1 }} />
        <BentoField label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} containerStyle={{ flex: 1 }} />
      </View>

      {/* Enquiry type: a bottom sheet (owner decision 24 Nov 2026). Optional: none chosen is filed as General. */}
      <View style={{ gap: 8 }}>
        <Text style={[bentoType.label, { color: t.ink }]}>Enquiry type</Text>
        <Pressable
          onPress={() => setShowTypes(true)}
          accessibilityRole="button"
          accessibilityLabel={`Enquiry type: ${enquiryType || TYPE_PLACEHOLDER}`}
          style={{
            minHeight: L.controlHeight,
            borderRadius: L.fieldRadius,
            borderWidth: 1,
            borderColor: t.hair,
            backgroundColor: t.tile,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text style={{ flex: 1, fontSize: 16, color: enquiryType ? t.ink : t.muted }}>{enquiryType || TYPE_PLACEHOLDER}</Text>
          <BentoIcon name="chevronDown" size={18} color={t.muted} strokeWidth={1.8} />
        </Pressable>
      </View>

      <BentoField label="Message" placeholder="Type Your Message Here" value={message} onChangeText={setMessage} multiline />

      <BentoButton label="Submit Enquiry" nub onPress={handleSubmit} loading={submitting} />

      <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 22, lineHeight: 24, letterSpacing: -0.44, color: t.ink }]}>
        Frequently Asked Questions
      </Text>
      <FaqAccordion items={faqs} initialOpenIndex={0} />

      <PickerSheet
        visible={showTypes}
        title="Enquiry type"
        subtitle={TYPE_PLACEHOLDER}
        options={ENQUIRY_TYPES.map((v) => ({ value: v, label: v }))}
        selected={enquiryType || null}
        onSelect={(v) => {
          setEnquiryType(v);
          setShowTypes(false);
        }}
        onClose={() => setShowTypes(false)}
      />
    </BentoScreen>
  );
}
