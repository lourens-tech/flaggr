import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../context/AppContext';
import { useBento } from '../../context/ThemeContext';
import type { FeedbackCategory } from '../../api/client';
import { showAlert } from '../../utils/alert';
import { friendlyError } from '../../utils/errors';
import { haptic } from '../../utils/haptics';
import { bentoType } from '../../theme/bento';
import { BentoButton, BentoField, BentoIcon, BentoScreen, type BentoIconName } from '../../components/bento';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveFeedback'>;

const CATEGORIES: Array<{ value: FeedbackCategory; label: string; icon: BentoIconName }> = [
  { value: 'bug', label: 'Bug Found', icon: 'alertTriangle' },
  { value: 'general_feedback', label: 'General Feedback', icon: 'chatBubble' },
  { value: 'improvement', label: 'Improvement Idea', icon: 'sparkle' },
];

// Goes straight to the Flagrr team (as an email + a Support Centre ticket),
// not the member's own club — see ContactScreen for the club-routed enquiry
// flow this is deliberately separate from. Layout from AppFeedback / G-E-FeedbackSending.
export function GiveFeedbackScreen({ navigation }: Props) {
  const { t } = useBento();
  const { sendFeedback } = useApp();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      showAlert('Choose a category', 'Let us know what kind of feedback this is before sending.');
      return;
    }
    if (!message.trim()) {
      showAlert('Add a message', 'Tell us more before sending your feedback.');
      return;
    }
    setSubmitting(true);
    try {
      await sendFeedback({ category, message: message.trim() });
      showAlert('Thanks for the feedback!', 'The Flagrr team has received it.', [{ text: 'Back', onPress: () => navigation.goBack() }]);
    } catch (err) {
      showAlert('Couldn’t send feedback', friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BentoScreen title="Give Feedback" onBack={() => navigation.goBack()}>
      <View style={{ height: 4 }} />
      <Text accessibilityRole="header" style={[bentoType.h1, { fontSize: 30, lineHeight: 31, color: t.ink }]}>
        Help Us Improve Flagrr
      </Text>
      <Text style={[bentoType.label, { color: t.ink }]}>What kind of feedback is this?</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="What kind of feedback is this?" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => {
          const on = category === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => {
                if (!on) haptic.selection();
                setCategory(c.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              aria-checked={on}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                height: 44,
                paddingHorizontal: 15,
                borderRadius: 999,
                backgroundColor: on ? t.accent : t.tile,
                boxShadow: on ? undefined : `0 0 0 1px ${t.hair}`,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <BentoIcon name={c.icon} size={18} color={on ? t.accentInk : t.ink} strokeWidth={1.8} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: on ? t.accentInk : t.ink }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <BentoField label="Your message" placeholder="What's on your mind?" value={message} onChangeText={setMessage} multiline />
      <View style={{ height: 4 }} />
      <BentoButton label="Send Feedback" nub onPress={handleSubmit} loading={submitting} />
    </BentoScreen>
  );
}
