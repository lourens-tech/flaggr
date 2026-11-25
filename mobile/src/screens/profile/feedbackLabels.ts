import type { PillTone } from '../../components/bento';
import type { FeedbackCategory, FeedbackStatus } from '../../data/types';

// Give Feedback's category names, reused as the My Feedback row and thread titles.
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug Found',
  general_feedback: 'General Feedback',
  improvement: 'Improvement Idea',
};

export function feedbackTitle(category: FeedbackCategory | null): string {
  return category ? FEEDBACK_CATEGORY_LABELS[category] : 'Feedback';
}

// Status words approved with the My Feedback mockup (25 Nov 2026).
export const FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; tone: PillTone }> = {
  open: { label: 'Sent', tone: 'warn' },
  in_progress: { label: 'In progress', tone: 'accent' },
  resolved: { label: 'Resolved', tone: 'muted' },
};
