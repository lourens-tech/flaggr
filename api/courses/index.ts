import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { withErrorHandling } from '../_lib/http';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rows = (await sql`
    select id, name, slug, logo_url from courses order by name
  `) as Array<{ id: string; name: string; slug: string; logo_url: string | null }>;

  res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      logoUrl: r.logo_url,
    })),
  );
});
