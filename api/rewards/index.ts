import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { withErrorHandling } from '../_lib/http';

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authed = await requireAuthedUser(req);

  const rows = (await sql`
    select id, title, description, image_url, cost, category
    from rewards
    where course_id = ${authed.courseId} and active = true
    order by cost
  `) as Array<{
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    cost: number;
    category: string;
  }>;

  res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      imageUrl: r.image_url,
      cost: r.cost,
      category: r.category,
    })),
  );
});
