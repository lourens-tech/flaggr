// Admin-side Course Guide actions, dispatched from api/admin/index.ts:
// a club's GM uploads scorecard photos, and a super_admin imports the course
// map file built from them (see docs/Course-Maps.md) and publishes it.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './db';
import { HttpError } from './http';
import type { AuthedAdmin } from './auth';
import { logAudit } from './auditLog';
import { sendEmail } from './email';
import { renderBrandedEmailHtml, emailParagraph } from './emailTemplate';
import { checkCourseMap, type CourseMapFile } from '../../mobile/src/golf/courseMap';

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
// Base64 length, not raw bytes — same ceiling as logos and covers.
const MAX_PHOTO_BASE64_LENGTH = 2_000_000;
const MAX_PHOTOS_PER_CLUB = 12;
// A course map file is mostly coordinates; Strand's is about 120 KB.
const MAX_MAP_JSON_LENGTH = 3_500_000;
// Several photos usually go up together — email the Flagrr team once per batch.
const UPLOAD_EMAIL_QUIET_MINUTES = 30;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'lourens@ewosolutions.com';
const UUID = /^[0-9a-f-]{36}$/i;

export const COURSE_ADMIN_GOLF_ACTIONS = ['courseMapStatus', 'scorecardPhoto', 'scorecardPhotoUpload', 'scorecardPhotoDelete'];
export const SUPER_ADMIN_GOLF_ACTIONS = [
  'superAdminGolfCourses',
  'superAdminGolfCourse',
  'superAdminScorecardPhotos',
  'superAdminScorecardPhoto',
  'superAdminGolfCourseImport',
  'superAdminGolfCoursePublish',
  'superAdminGolfCourseDelete',
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function requireId(v: unknown, what: string): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new HttpError(400, `${what} is required.`);
  return v;
}

export type CourseMapStage = 'not_started' | 'photos_received' | 'building' | 'live';

async function photoList(courseId: string) {
  return (await sql`
    select p.id, p.created_at, a.first_name, a.last_name
    from scorecard_photos p left join admins a on a.id = p.uploaded_by
    where p.course_id = ${courseId} order by p.created_at
  `) as Array<{ id: string; created_at: string; first_name: string | null; last_name: string | null }>;
}

const photoDto = (p: Awaited<ReturnType<typeof photoList>>[number]) => ({
  id: p.id,
  createdAt: p.created_at,
  uploadedBy: p.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : null,
});

/** The course_admin's view: their photos and how far their map has got. */
async function courseMapStatus(courseId: string) {
  const [photos, maps] = await Promise.all([
    photoList(courseId),
    sql`select status, published_at from golf_courses where club_id = ${courseId}` as unknown as Promise<Array<{ status: string; published_at: string | null }>>,
  ]);
  const map = maps[0];
  const stage: CourseMapStage = map?.status === 'live' ? 'live' : map ? 'building' : photos.length ? 'photos_received' : 'not_started';
  return { stage, publishedAt: map?.published_at ?? null, photos: photos.map(photoDto), maxPhotos: MAX_PHOTOS_PER_CLUB };
}

export async function handleCourseAdminGolfAction(
  action: string,
  admin: AuthedAdmin & { courseId: string },
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  if (!COURSE_ADMIN_GOLF_ACTIONS.includes(action)) return false;
  const courseId = admin.courseId;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (action === 'courseMapStatus' && req.method === 'GET') {
    res.status(200).json(await courseMapStatus(courseId));
    return true;
  }

  if (action === 'scorecardPhoto' && req.method === 'GET') {
    const id = requireId(req.query.id, 'A photo id');
    const rows = (await sql`select image_data from scorecard_photos where id = ${id} and course_id = ${courseId}`) as Array<{ image_data: string }>;
    if (!rows[0]) throw new HttpError(404, 'Photo not found.');
    res.status(200).json({ imageData: rows[0].image_data });
    return true;
  }

  if (action === 'scorecardPhotoUpload' && req.method === 'POST') {
    const imageBase64 = body.imageBase64;
    if (typeof imageBase64 !== 'string' || !DATA_URI_PATTERN.test(imageBase64)) throw new HttpError(400, 'Upload a JPEG, PNG or WebP photo.');
    if (imageBase64.length > MAX_PHOTO_BASE64_LENGTH) throw new HttpError(400, 'That photo is too large. Try a smaller one.');
    const [counts, recent] = await Promise.all([
      sql`select count(*)::int as n from scorecard_photos where course_id = ${courseId}` as unknown as Promise<Array<{ n: number }>>,
      sql`
        select exists (select 1 from scorecard_photos where course_id = ${courseId}
          and created_at > now() - make_interval(mins => ${UPLOAD_EMAIL_QUIET_MINUTES})) as recent
      ` as unknown as Promise<Array<{ recent: boolean }>>,
    ]);
    if ((counts[0]?.n ?? 0) >= MAX_PHOTOS_PER_CLUB) {
      throw new HttpError(400, `You can upload up to ${MAX_PHOTOS_PER_CLUB} photos. Delete one to add another.`);
    }
    await sql`insert into scorecard_photos (course_id, image_data, uploaded_by) values (${courseId}, ${imageBase64}, ${admin.id})`;
    if (!recent[0]?.recent) {
      const club = (await sql`select name from courses where id = ${courseId}`) as Array<{ name: string }>;
      const clubName = club[0]?.name ?? 'A club';
      try {
        await sendEmail({
          to: CONTACT_EMAIL,
          subject: `Scorecard photos from ${clubName}`,
          html: renderBrandedEmailHtml({
            eyebrow: 'Course map',
            heading: `${escapeHtml(clubName)} sent their scorecard`,
            bodyHtml:
              emailParagraph(`${escapeHtml(admin.firstName)} ${escapeHtml(admin.lastName)} uploaded scorecard photos for <strong style="color:#1F1F1F;">${escapeHtml(clubName)}</strong>.`) +
              emailParagraph('Open Course maps in the super admin console to see them and build the club’s course map.'),
          }),
        });
      } catch (err) {
        console.error('Scorecard upload email failed', err);
      }
    }
    await logAudit({
      adminId: admin.id,
      adminName: `${admin.firstName} ${admin.lastName}`.trim(),
      adminRole: admin.role,
      action: 'scorecard_photo_upload',
      targetType: 'course',
      targetId: courseId,
    });
    res.status(200).json(await courseMapStatus(courseId));
    return true;
  }

  if (action === 'scorecardPhotoDelete' && req.method === 'POST') {
    const id = requireId(body.id, 'A photo id');
    await sql`delete from scorecard_photos where id = ${id} and course_id = ${courseId}`;
    res.status(200).json(await courseMapStatus(courseId));
    return true;
  }

  return false;
}

interface GolfCourseRow {
  id: string;
  club_id: string | null;
  club_name: string | null;
  name: string;
  location: string;
  hole_count: number;
  status: 'draft' | 'live';
  map: CourseMapFile;
  imported_at: string;
  published_at: string | null;
  rounds: number;
}

async function golfCourseDetail(id: string) {
  const rows = (await sql`
    select g.id, g.club_id, c.name as club_name, g.name, g.location, g.hole_count, g.status, g.map, g.imported_at, g.published_at,
      (select count(*)::int from golf_rounds r where r.golf_course_id = g.id) as rounds
    from golf_courses g left join courses c on c.id = g.club_id
    where g.id = ${id}
  `) as GolfCourseRow[];
  const g = rows[0];
  if (!g) throw new HttpError(404, 'Course map not found.');
  const check = checkCourseMap(g.map);
  return {
    id: g.id,
    clubId: g.club_id,
    clubName: g.club_name,
    name: g.name,
    location: g.location,
    holeCount: g.hole_count,
    status: g.status,
    importedAt: g.imported_at,
    publishedAt: g.published_at,
    rounds: g.rounds,
    blockers: check.blockers,
    notes: Array.isArray(g.map.notes) ? g.map.notes.filter((n) => typeof n === 'string') : [],
    tees: g.map.tees.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      totalLength: t.lengths.every((l) => l != null) ? t.lengths.reduce<number>((s, l) => s + (l ?? 0), 0) : null,
      ratings: t.ratings,
    })),
    par: { men: g.map.card.men?.par.reduce((s, p) => s + p, 0) ?? null, ladies: g.map.card.ladies?.par.reduce((s, p) => s + p, 0) ?? null },
  };
}

function auditFor(admin: AuthedAdmin) {
  return { adminId: admin.id, adminName: `${admin.firstName} ${admin.lastName}`.trim(), adminRole: admin.role };
}

export async function handleSuperAdminGolfAction(action: string, admin: AuthedAdmin, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!SUPER_ADMIN_GOLF_ACTIONS.includes(action)) return false;
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (action === 'superAdminGolfCourses' && req.method === 'GET') {
    const [clubs, maps] = await Promise.all([
      sql`
        select c.id, c.name, c.archived_at, count(p.id)::int as photo_count, max(p.created_at) as last_photo_at
        from courses c left join scorecard_photos p on p.course_id = c.id
        where c.is_placeholder = false
        group by c.id order by c.name
      ` as unknown as Promise<Array<{ id: string; name: string; archived_at: string | null; photo_count: number; last_photo_at: string | null }>>,
      sql`select id, club_id, name, location, hole_count, status, map, imported_at, published_at from golf_courses order by name` as unknown as Promise<
        Array<Omit<GolfCourseRow, 'club_name' | 'rounds'>>
      >,
    ]);
    const mapDto = (g: (typeof maps)[number]) => ({
      id: g.id,
      name: g.name,
      location: g.location,
      holeCount: g.hole_count,
      status: g.status,
      importedAt: g.imported_at,
      publishedAt: g.published_at,
      blockerCount: checkCourseMap(g.map).blockers.length,
    });
    res.status(200).json({
      clubs: clubs.map((c) => {
        const g = maps.find((m) => m.club_id === c.id);
        return {
          clubId: c.id,
          clubName: c.name,
          archived: c.archived_at != null,
          photoCount: c.photo_count,
          lastPhotoAt: c.last_photo_at,
          golfCourse: g ? mapDto(g) : null,
        };
      }),
      awayCourses: maps.filter((m) => !m.club_id).map(mapDto),
    });
    return true;
  }

  if (action === 'superAdminGolfCourse' && req.method === 'GET') {
    res.status(200).json(await golfCourseDetail(requireId(req.query.id, 'A course map id')));
    return true;
  }

  if (action === 'superAdminScorecardPhotos' && req.method === 'GET') {
    const courseId = requireId(req.query.courseId, 'A club id');
    res.status(200).json((await photoList(courseId)).map(photoDto));
    return true;
  }

  if (action === 'superAdminScorecardPhoto' && req.method === 'GET') {
    const id = requireId(req.query.id, 'A photo id');
    const rows = (await sql`select image_data from scorecard_photos where id = ${id}`) as Array<{ image_data: string }>;
    if (!rows[0]) throw new HttpError(404, 'Photo not found.');
    res.status(200).json({ imageData: rows[0].image_data });
    return true;
  }

  if (action === 'superAdminGolfCourseImport' && req.method === 'POST') {
    const text = body.mapJson;
    if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'Choose a course map file.');
    if (text.length > MAX_MAP_JSON_LENGTH) throw new HttpError(400, 'That file is too large for a course map.');
    let map: CourseMapFile;
    try {
      map = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'That file is not valid JSON.');
    }
    const check = checkCourseMap(map);
    if (check.errors.length) {
      res.status(400).json({ error: 'The course map file has problems.', problems: check.errors });
      return true;
    }
    const clubId = body.clubId == null ? null : requireId(body.clubId, 'A club id');
    const golfCourseId = body.golfCourseId == null ? null : requireId(body.golfCourseId, 'A course map id');

    type Existing = { id: string; status: string; club_id: string | null };
    let existing: Existing | undefined;
    if (golfCourseId) {
      existing = ((await sql`select id, status, club_id from golf_courses where id = ${golfCourseId}`) as Existing[])[0];
      if (!existing) throw new HttpError(404, 'Course map not found.');
    } else if (clubId) {
      const club = (await sql`select id from courses where id = ${clubId} and is_placeholder = false`) as Array<{ id: string }>;
      if (!club[0]) throw new HttpError(404, 'Club not found.');
      existing = ((await sql`select id, status, club_id from golf_courses where club_id = ${clubId}`) as Existing[])[0];
    }
    // A live map stays live only if the new file is just as complete.
    if (existing?.status === 'live' && check.blockers.length) {
      res.status(400).json({ error: 'This map is live, so the new file must be complete. Unpublish it first, or fix:', problems: check.blockers });
      return true;
    }

    let id: string;
    if (existing) {
      await sql`
        update golf_courses set map = ${JSON.stringify(map)}::jsonb, name = ${map.name.trim()}, location = ${map.location.trim()},
          hole_count = ${map.holeCount}, imported_by = ${admin.id}, imported_at = now()
        where id = ${existing.id}
      `;
      id = existing.id;
    } else {
      const rows = (await sql`
        insert into golf_courses (club_id, name, location, hole_count, map, imported_by)
        values (${clubId}, ${map.name.trim()}, ${map.location.trim()}, ${map.holeCount}, ${JSON.stringify(map)}::jsonb, ${admin.id})
        returning id
      `) as Array<{ id: string }>;
      id = rows[0].id;
    }
    await logAudit({ ...auditFor(admin), action: 'golf_course_import', targetType: 'golf_course', targetId: id, targetLabel: map.name });
    res.status(200).json(await golfCourseDetail(id));
    return true;
  }

  if (action === 'superAdminGolfCoursePublish' && req.method === 'POST') {
    const id = requireId(body.id, 'A course map id');
    const live = body.live === true;
    const detail = await golfCourseDetail(id);
    if (live && detail.blockers.length) {
      res.status(400).json({ error: 'This map can’t go live yet:', problems: detail.blockers });
      return true;
    }
    await sql`
      update golf_courses set status = ${live ? 'live' : 'draft'},
        published_at = case when ${live} then coalesce(published_at, now()) else published_at end
      where id = ${id}
    `;
    await logAudit({ ...auditFor(admin), action: live ? 'golf_course_publish' : 'golf_course_unpublish', targetType: 'golf_course', targetId: id, targetLabel: detail.name });
    res.status(200).json(await golfCourseDetail(id));
    return true;
  }

  if (action === 'superAdminGolfCourseDelete' && req.method === 'POST') {
    const id = requireId(body.id, 'A course map id');
    const detail = await golfCourseDetail(id);
    if (detail.status === 'live') throw new HttpError(400, 'Unpublish the map before deleting it.');
    // Rounds already played keep their own copy of the card (golf_course_id is set null).
    await sql`delete from golf_courses where id = ${id}`;
    await logAudit({ ...auditFor(admin), action: 'golf_course_delete', targetType: 'golf_course', targetId: id, targetLabel: detail.name });
    res.status(200).json({ ok: true });
    return true;
  }

  return false;
}
