import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAuthedUser } from '../_lib/auth';
import { HttpError, withErrorHandling } from '../_lib/http';

const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_BASE64_LENGTH = 2_000_000; // ~1.5MB decoded, comfortably above a 480px-wide JPEG

interface UpdateAvatarBody {
  imageBase64?: string;
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  const authed = await requireAuthedUser(req);

  if (req.method === 'POST') {
    const body = req.body as UpdateAvatarBody;
    const imageBase64 = body.imageBase64;

    if (!imageBase64 || !DATA_URI_PATTERN.test(imageBase64)) {
      throw new HttpError(400, 'imageBase64 must be a jpeg/png/webp data URI');
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      throw new HttpError(400, 'Image is too large');
    }

    await sql`update users set avatar_url = ${imageBase64} where id = ${authed.id}`;
    res.status(200).json({ avatarUrl: imageBase64 });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
});
