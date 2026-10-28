// Shapes the golf API returns (api/_lib/golf.ts), shared with the app.

import type { CourseMapFile, Gender, Layout } from './courseMap';
import type { Format, HoleEntry, RoundHole } from './scoring';
import type { Club } from './holeGeometry';
import type { GolfStats } from './stats';

export interface GolfProfileDto {
  handicapIndex: number | null;
  ratingGender: Gender;
  format: Format;
  allowance: 0.95 | 1;
  bag: Club[] | null; // null = the app's sample distances
  trackStats: boolean;
}

export interface GolfCourseSummaryDto {
  id: string;
  name: string;
  location: string;
  holeCount: number;
  isHome: boolean;
  logoUrl: string | null;
}

export interface RoundDto {
  id: string;
  golfCourseId: string | null;
  courseName: string;
  teeId: string;
  teeName: string;
  teeColor: string;
  ratingGender: Gender;
  layout: Layout;
  format: Format;
  allowance: number;
  handicapIndex: number | null;
  courseRating: number;
  slope: number;
  par: number;
  courseHandicap: number | null;
  playingHandicap: number | null;
  holes: RoundHole[];
  entries: HoleEntry[];
  trackStats: boolean;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
}

export interface GolfHomeDto {
  clubName: string;
  isPlaceholderClub: boolean;
  homeCourse: GolfCourseSummaryDto | null; // null until the club's map is live
  courses: GolfCourseSummaryDto[]; // every live map
  recentCourseIds: string[];
  inProgress: RoundDto | null;
  profile: GolfProfileDto;
}

export interface GolfCourseDto extends GolfCourseSummaryDto {
  map: CourseMapFile;
}

export interface GolfStatsDto {
  period: 'month' | 'year' | 'all';
  clubName: string;
  homeMapLive: boolean;
  anyCourseLive: boolean;
  totalRounds: number; // all time, any period
  handicapIndex: number | null;
  trackStats: boolean;
  stats: GolfStats;
}
