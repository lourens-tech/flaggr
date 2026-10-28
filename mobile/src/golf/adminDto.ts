// Shapes the admin course-map actions return (api/_lib/golfAdmin.ts).

import type { Gender, TeeRatings } from './courseMap';

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
