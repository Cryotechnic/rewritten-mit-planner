import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

// ── Env validation ───────────────────────────────────────────────────────────

const {
  ADMIN_GITHUB_CLIENT_ID,
  ADMIN_GITHUB_CLIENT_SECRET,
  ADMIN_GITHUB_USERNAME,
  ADMIN_JWT_SECRET,
  ADMIN_ORIGIN = 'http://localhost:5173',
  FIREBASE_SERVICE_ACCOUNT,
  PORT = '3001',
} = process.env;

const required = [
  'ADMIN_GITHUB_CLIENT_ID',
  'ADMIN_GITHUB_CLIENT_SECRET',
  'ADMIN_GITHUB_USERNAME',
  'ADMIN_JWT_SECRET',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[admin-server] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// ── Firebase Admin SDK ───────────────────────────────────────────────────────

if (FIREBASE_SERVICE_ACCOUNT) {
  // Explicit service account: supports JSON string or file path
  const raw = FIREBASE_SERVICE_ACCOUNT.trim();
  const sa: ServiceAccount = raw.startsWith('{')
    ? JSON.parse(raw)
    : JSON.parse(readFileSync(raw, 'utf8'));
  initializeApp({ credential: cert(sa) });
} else {
  // Application Default Credentials (Cloud Run, GCE, etc.)
  initializeApp();
}

const db = getFirestore();

// ── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// CSRF state store (in-memory, 10-min TTL)
const oauthStates = new Map<string, number>();

function cleanOAuthStates(): void {
  const cutoff = Date.now() - 600_000;
  for (const [k, t] of oauthStates) if (t < cutoff) oauthStates.delete(k);
}

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), ADMIN_JWT_SECRET!) as { admin: boolean };
    if (!payload.admin) throw new Error('not admin');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Auth routes ──────────────────────────────────────────────────────────────

// Step 1: Redirect browser to GitHub OAuth
app.get('/api/admin/auth/github', (_req, res) => {
  cleanOAuthStates();
  const state = randomUUID();
  oauthStates.set(state, Date.now());
  const params = new URLSearchParams({
    client_id: ADMIN_GITHUB_CLIENT_ID!,
    scope: 'read:user',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Step 2: Handle GitHub OAuth callback
app.get('/api/admin/auth/callback', async (req, res) => {
  const { code, state } = req.query as Record<string, string | undefined>;

  if (!code || !state || !oauthStates.has(state)) {
    res.status(400).send('Invalid OAuth state, please try logging in again.');
    return;
  }
  oauthStates.delete(state);

  try {
    // Exchange authorization code for GitHub access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: ADMIN_GITHUB_CLIENT_ID,
        client_secret: ADMIN_GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      res.status(400).send(`GitHub token exchange failed: ${tokenData.error ?? 'unknown'}`);
      return;
    }

    // Fetch GitHub user profile to verify identity
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const user = (await userRes.json()) as { login: string };

    if (user.login.toLowerCase() !== ADMIN_GITHUB_USERNAME!.toLowerCase()) {
      res.status(403).send(
        `Access denied. Only @${ADMIN_GITHUB_USERNAME} can access the admin panel.`,
      );
      return;
    }

    // Issue a signed JWT valid for 8 hours
    const token = jwt.sign(
      { admin: true, username: user.login },
      ADMIN_JWT_SECRET!,
      { expiresIn: '8h' },
    );

    res.redirect(`${ADMIN_ORIGIN}/admin?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('[admin-server] OAuth callback error:', err);
    res.status(500).send('Authentication error. Please try again.');
  }
});

// ── Admin API: session types ──────────────────────────────────────────────────

interface SessionRow {
  id: string;
  encrypted: boolean;
  clientId: string;
  updatedAt: number;
  planCount?: number;
  planNames?: string[];
  encounterLevel?: number;
  maxHP?: number;
  tankHP?: number;
  writeToken?: string;
}

// ── Admin API: list sessions ─────────────────────────────────────────────────

app.get('/api/admin/sessions', requireAdmin, async (_req, res) => {
  try {
    const snap = await db.collection('sessions').get();

    const rows: SessionRow[] = snap.docs.map((docSnap) => {
      const d = docSnap.data();
      const encrypted = 'ciphertext' in d;
      const base: SessionRow = {
        id: docSnap.id,
        encrypted,
        clientId: d.clientId as string,
        updatedAt: d.updatedAt as number,
        writeToken: d.writeToken as string | undefined,
      };

      if (!encrypted && typeof d.json === 'string') {
        try {
          const parsed = JSON.parse(d.json) as {
            plans?: Record<string, { name?: string }>;
            settings?: {
              maxHP?: number;
              tankHP?: number;
              encounterLevel?: number;
            };
          };
          base.planCount = parsed.plans ? Object.keys(parsed.plans).length : undefined;
          base.planNames = parsed.plans
            ? Object.values(parsed.plans).map((p) => p.name ?? 'Untitled')
            : undefined;
          base.encounterLevel = parsed.settings?.encounterLevel;
          base.maxHP = parsed.settings?.maxHP;
          base.tankHP = parsed.settings?.tankHP;
        } catch {
          /* malformed JSON, return base metadata only */
        }
      }

      return base;
    });

    // Sort newest first
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(rows);
  } catch (err) {
    console.error('[admin-server] List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ── Admin API: delete session ─────────────────────────────────────────────────

app.delete('/api/admin/sessions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  // Validate ID format (matches Firestore rules)
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(id)) {
    res.status(400).json({ error: 'Invalid session ID format' });
    return;
  }

  try {
    await db.collection('sessions').doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin-server] Delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ── Admin API: token info (for UI to verify token on load) ───────────────────

app.get('/api/admin/me', requireAdmin, (req, res) => {
  const token = req.headers.authorization!.slice(7);
  const payload = jwt.decode(token) as { username: string; exp: number };
  res.json({ username: payload.username, exp: payload.exp });
});

// ── Start server ─────────────────────────────────────────────────────────────

app.listen(Number(PORT), () => {
  console.log(`[admin-server] Running on http://localhost:${PORT}`);
  console.log(`[admin-server] Frontend origin: ${ADMIN_ORIGIN}`);
  console.log(`[admin-server] Admin GitHub user: @${ADMIN_GITHUB_USERNAME}`);
});
