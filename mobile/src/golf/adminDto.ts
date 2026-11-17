// Shapes the admin course-map actions (api/_lib/golfAdmin.ts) and the admin
// Golf pages (api/_lib/golfClub.ts) return.

import type { Gender, TeeRatings } from './courseMap';
import type { Format } from './scoring';
import type { GolfStats } from './stats';
import type { RoundDto } from './dto';
import type { GolfClubSummary, GolfLatestRound, GolfMemberRow, GolfPeriod, GolfSeriesPoint } from './clubStats';

export interface ScorecardPhoto {
  id: string;
  createdAt: string;
  uploadedBy: string | null;
}

/** not_started: no photos yet · photos_received: waiting for Flagrr to build
 * the map · building: a draft map exists · live: members can play it. */
export type CourseMapStage = 'not_started' | 'photos_received' | 'building' | 'live';

export interface CourseMapStatus {
  stage: CourseMapStage;
  publishedAt: string | null;
  photos: ScorecardPhoto[];
  maxPhotos: number;
}

export interface SuperAdminGolfCourseSummary {
  id: string;
  name: string;
  location: string;
  holeCount: number;
  status: 'draft' | 'live';
  importedAt: string;
  publishedAt: string | null;
  blockerCount: number;
}

export interface SuperAdminGolfCourses {
  clubs: Array<{
    clubId: string;
    clubName: string;
    archived: boolean;
    photoCount: number;
    lastPhotoAt: string | null;
    golfCourse: SuperAdminGolfCourseSummary | null;
  }>;
  awayCourses: SuperAdminGolfCourseSummary[];
}

export interface SuperAdminGolfCourseDetail {
  id: string;
  clubId: string | null;
  clubName: string | null;
  name: string;
  location: string;
  holeCount: number;
  status: 'draft' | 'live';
  importedAt: string;
  publishedAt: string | null;
  rounds: number;
  blockers: string[];
  notes: string[];
  tees: Array<{ id: string; name: string; color: string; totalLength: number | null; ratings: Partial<Record<Gender, TeeRatings>> }>;
  par: { men: number | null; ladies: number | null };
}

// --- Golf on the admin dashboards (api/_lib/golfClub.ts) ---
// Only rounds a club's own members play on the club's own course, and only
// from members who share their rounds with the club (on unless they turn it
// off in My Golf).

export type GolfMapStatus = 'live' | 'draft' | null; // null: no course map yet

export interface GolfClubOverviewDto {
  period: GolfPeriod;
  clubId: string;
  clubName: string;
  golfCourseId: string | null;
  courseName: string | null;
  mapStatus: GolfMapStatus;
  summary: GolfClubSummary;
  roundsDeltaPct: number; // 0 for "all"
  series: GolfSeriesPoint[];
  members: GolfMemberRow[];
  latest: GolfLatestRound[];
}

export interface GolfMemberDetailDto {
  period: GolfPeriod;
  clubName: string;
  courseName: string | null;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    tier: string;
    handicapIndex: number | null;
    format: Format;
    allowance: number;
    trackStats: boolean;
  };
  stats: GolfStats;
}

export interface GolfScorecardDto {
  clubName: string;
  member: { id: string; firstName: string; lastName: string };
  round: RoundDto;
  // The member's other rounds on the course, newest first, for previous/next.
  previousRoundId: string | null;
  nextRoundId: string | null;
}

export interface SuperAdminGolfClubRow {
  courseId: string;
  name: string;
  logoUrl: string | null;
  mapStatus: GolfMapStatus;
  membersPlaying: number;
  rounds: number;
  basis: 18 | 9 | null;
  pointsAverage: number | null;
  playedToHandicapPct: number | null;
  lastPlayedAt: string | null;
}

export interface SuperAdminGolfBestRound {
  roundId: string;
  userId: string;
  memberName: string;
  courseId: string;
  clubName: string;
  teeName: string;
  teeColor: string;
  points: number;
  completedAt: string;
}

export interface SuperAdminGolfDto {
  period: GolfPeriod;
  totals: {
    rounds: number;
    roundsDeltaPct: number;
    membersPlaying: number;
    clubs: number;
    liveMaps: number;
    pointsAverage: number | null; // 18-hole rounds
  };
  clubs: SuperAdminGolfClubRow[];
  best: SuperAdminGolfBestRound[];
  series: GolfSeriesPoint[];
}
