import { sql } from './db';

export interface MemberRosterRow {
  memberNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
}

export interface RosterUploadResult {
  rosterCount: number;
  verifiedCount: number;
}

export interface RosterStatus {
  count: number;
  lastUploadedAt: string | null;
}

export const MAX_ROSTER_ROWS = 5000;

type ColumnKey = 'memberNumber' | 'firstName' | 'lastName' | 'email';

// Tolerant of header spelling variation across different membership-system
// exports — matched case-insensitively against the file's header row.
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  memberNumber: ['member number', 'membership number', 'member no', 'member no.', 'member id', 'membership no'],
  firstName: ['first name', 'firstname', 'name'],
  lastName: ['last name', 'lastname', 'surname'],
  email: ['email', 'email address'],
};

// Minimal RFC 4180 line splitter — handles quoted cells containing commas
// or escaped quotes, which a plain String.split(',') would break on.
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

// Splits raw CSV (or comma-delimited PDF-extracted text — see
// memberRosterFileParsing.ts) into a 2D array of trimmed cell strings, one
// row per non-empty line.
export function csvToTable(csvContent: string): string[][] {
  return csvContent
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)
    .map((line) => splitCsvLine(line).map((c) => c.trim()));
}

// Shared by every source format (CSV, Excel, PDF — see
// memberRosterFileParsing.ts) once it's been reduced to a plain 2D table:
// the first row is the header, matched tolerantly against HEADER_ALIASES,
// everything after is data.
export function parseMemberRosterTable(table: string[][]): MemberRosterRow[] {
  if (table.length === 0) throw new Error('The file is empty');

  const headerCells = table[0].map((c) => c.toLowerCase());
  const findColumn = (aliases: string[]): number => headerCells.findIndex((h) => aliases.includes(h));

  const columns: Record<ColumnKey, number> = {
    memberNumber: findColumn(HEADER_ALIASES.memberNumber),
    firstName: findColumn(HEADER_ALIASES.firstName),
    lastName: findColumn(HEADER_ALIASES.lastName),
    email: findColumn(HEADER_ALIASES.email),
  };
  if (columns.firstName === -1 || columns.lastName === -1 || columns.email === -1) {
    throw new Error('The file must have First Name, Last Name, and Email columns');
  }

  const rows: MemberRosterRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const firstName = cells[columns.firstName]?.trim();
    const lastName = cells[columns.lastName]?.trim();
    const email = cells[columns.email]?.trim();
    if (!firstName || !lastName || !email) continue; // skip incomplete rows rather than failing the whole upload
    rows.push({
      memberNumber: columns.memberNumber !== -1 ? cells[columns.memberNumber]?.trim() || null : null,
      firstName,
      lastName,
      email,
    });
  }
  if (rows.length === 0) throw new Error('No valid member rows found in the file');
  if (rows.length > MAX_ROSTER_ROWS) throw new Error(`The file has too many rows (max ${MAX_ROSTER_ROWS})`);
  return rows;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

// Re-checks every member whose home club is `courseId` against that club's
// current roster — a member newly on the list gets unlocked, one no longer
// on it loses verified status (and, going forward, tier progress) until the
// next matching upload. Names/emails are compared trimmed + lowercased
// rather than relying on column collation, since `users` isn't citext.
async function recheckCourseMembers(courseId: string): Promise<{ verifiedCount: number }> {
  const rows = (await sql`
    with matches as (
      select u.id as user_id, (r.id is not null) as matched
      from users u
      left join member_roster r
        on r.course_id = u.course_id
       and lower(trim(r.first_name)) = lower(trim(u.first_name))
       and lower(trim(r.last_name)) = lower(trim(u.last_name))
       and lower(trim(r.email::text)) = lower(trim(u.email::text))
      where u.course_id = ${courseId}
    )
    update users u
    set verified_member = m.matched,
        verified_at = case
          when m.matched and not u.verified_member then now()
          when not m.matched then null
          else u.verified_at
        end
    from matches m
    where u.id = m.user_id
    returning u.verified_member
  `) as Array<{ verified_member: boolean }>;
  return { verifiedCount: rows.filter((r) => r.verified_member).length };
}

// Full replace — matches a fresh export from the club's own membership
// system each time, and avoids stale entries a merge/append would leave
// behind for members who've left the club.
export async function replaceMemberRoster(courseId: string, rows: MemberRosterRow[]): Promise<RosterUploadResult> {
  await sql`delete from member_roster where course_id = ${courseId}`;

  for (const batch of chunk(rows, 200)) {
    await sql.transaction(
      batch.map(
        (row) => sql`
          insert into member_roster (course_id, member_number, first_name, last_name, email)
          values (${courseId}, ${row.memberNumber}, ${row.firstName}, ${row.lastName}, ${row.email})
        `,
      ),
    );
  }

  const { verifiedCount } = await recheckCourseMembers(courseId);
  return { rosterCount: rows.length, verifiedCount };
}

// Checked at signup time, before any bulk re-check has run for this club.
export async function matchesRoster(courseId: string, firstName: string, lastName: string, email: string): Promise<boolean> {
  const rows = (await sql`
    select 1 as found from member_roster
    where course_id = ${courseId}
      and lower(trim(first_name)) = lower(trim(${firstName}))
      and lower(trim(last_name)) = lower(trim(${lastName}))
      and lower(trim(email::text)) = lower(trim(${email}))
    limit 1
  `) as Array<{ found: number }>;
  return rows.length > 0;
}

export async function getRosterStatus(courseId: string): Promise<RosterStatus> {
  const rows = (await sql`
    select count(*)::int as count, max(created_at) as last_uploaded_at
    from member_roster where course_id = ${courseId}
  `) as Array<{ count: number; last_uploaded_at: string | null }>;
  return { count: rows[0].count, lastUploadedAt: rows[0].last_uploaded_at };
}
