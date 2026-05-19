import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { verifyOAuthState } from '../../_lib/oauth-state.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query as Record<string, string | undefined>;
  const origin = process.env.ADMIN_ORIGIN ?? 'http://localhost:5173';

  if (!code || !state || !verifyOAuthState(state)) {
    res.status(400).send('Invalid OAuth state — please try logging in again.');
    return;
  }

  try {
    // Exchange authorization code for GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.ADMIN_GITHUB_CLIENT_ID,
        client_secret: process.env.ADMIN_GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      res.status(400).send(`GitHub token exchange failed: ${tokenData.error ?? 'unknown'}`);
      return;
    }

    // Fetch GitHub user to verify identity
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const user = (await userRes.json()) as { login: string };

    if (user.login.toLowerCase() !== (process.env.ADMIN_GITHUB_USERNAME ?? '').toLowerCase()) {
      res.status(403).send(`Access denied. Only @${process.env.ADMIN_GITHUB_USERNAME} can access the admin panel.`);
      return;
    }

    const token = jwt.sign(
      { admin: true, username: user.login },
      process.env.ADMIN_JWT_SECRET!,
      { expiresIn: '8h' },
    );

    res.redirect(`${origin}/admin?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[admin] OAuth callback error:', err);
    res.status(500).send('Authentication error. Please try again.');
  }
}
