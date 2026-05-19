import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createOAuthState } from '../../../_lib/oauth-state';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const state = createOAuthState();
  const params = new URLSearchParams({
    client_id: process.env.ADMIN_GITHUB_CLIENT_ID!,
    scope: 'read:user',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
