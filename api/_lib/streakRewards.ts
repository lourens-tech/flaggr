import { sql } from './db';
import type { StreakInfo } from './streak';

// Milestone schedule: every 4 weeks of an unbroken streak earns a Flagrr
// Cash bonus. Escalates for the first three milestones, then repeats at the
// 12-week amount indefinitely so a long streak keeps paying out.
const STREAK_MILESTONE_BONUSES = [100, 200, 300]; // index 0 = 4 weeks, 1 = 8 weeks, 2 = 12+ weeks (repeating)

function streakMilestoneBonus(weeks: number): number | null {
  if (weeks < 4 || weeks % 4 !== 0) return null;
  const milestoneIndex = weeks / 4 - 1;
  return STREAK_MILESTONE_BONUSES[Math.min(milestoneIndex, STREAK_MILESTONE_BONUSES.length - 1)];
}

export interface NextStreakMilestone {
  weeks: number;
  amount: number;
}

// The next upcoming milestone from the member's current streak length, for
// display (e.g. "3 more weeks to a 200 Flagrr Cash bonus").
export function nextStreakMilestone(currentWeeks: number): NextStreakMilestone {
  const remainder = currentWeeks % 4;
  const weeks = remainder === 0 ? currentWeeks + 4 : currentWeeks + (4 - remainder);
  return { weeks, amount: streakMilestoneBonus(weeks)! };
}

// Grants the Flagrr Cash bonus for a streak milestone the member has just
// reached, if not already claimed for this specific streak run (identified
// by its activeSince start date) — so a broken-then-restarted streak can
// earn the same milestone again, but a single ongoing streak can't double up
// on repeated calls. There's no cron job in this app, so "the app gets
// opened" is the trigger, same as the tier perks.
export async function grantDueStreakReward(userId: string, streak: Pick<StreakInfo, 'weeks' | 'activeSince'>): Promise<void> {
  const amount = streakMilestoneBonus(streak.weeks);
  if (!amount) return;

  const claimed = (await sql`
    insert into streak_rewards_granted (user_id, active_since, weeks, amount)
    values (${userId}, ${streak.activeSince}, ${streak.weeks}, ${amount})
    on conflict (user_id, active_since, weeks) do nothing
    returning user_id
  `) as Array<{ user_id: string }>;
  if (claimed.length === 0) return;

  await sql.transaction([
    sql`
      update points_accounts
      set balance = balance + ${amount}, total_earned = total_earned + ${amount}
      where user_id = ${userId}
    `,
    sql`
      insert into activity (user_id, type, title, subtitle, amount)
      values (${userId}, 'earn', 'Streak bonus', ${`${streak.weeks}-week streak`}, ${amount})
    `,
    sql`
      insert into notifications (user_id, title, body)
      values (${userId}, 'Streak bonus!', ${`You've kept a ${streak.weeks}-week streak going — enjoy ${amount} Flagrr Cash.`})
    `,
  ]);
}
