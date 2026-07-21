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
    select r.id, r.title, r.description, r.image_url, r.category,
           v.id as variant_id, v.label, v.rand_value, v.cost, v.sort_order
    from rewards r
    join reward_variants v on v.reward_id = r.id and v.active = true
    where r.course_id = ${authed.courseId} and r.active = true
    order by r.title, v.sort_order
  `) as Array<{
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    category: string;
    variant_id: string;
    label: string;
    rand_value: number | null;
    cost: number;
    sort_order: number;
  }>;

  const rewardsById = new Map<
    string,
    {
      id: string;
      title: string;
      description: string;
      imageUrl: string | null;
      category: string;
      variants: Array<{ id: string; label: string; randValue: number | null; cost: number }>;
    }
  >();

  for (const row of rows) {
    let reward = rewardsById.get(row.id);
    if (!reward) {
      reward = {
        id: row.id,
        title: row.title,
        description: row.description,
        imageUrl: row.image_url,
        category: row.category,
        variants: [],
      };
      rewardsById.set(row.id, reward);
    }
    reward.variants.push({ id: row.variant_id, label: row.label, randValue: row.rand_value, cost: row.cost });
  }

  res.status(200).json(
    Array.from(rewardsById.values()).sort((a, b) => a.variants[0].cost - b.variants[0].cost),
  );
});
