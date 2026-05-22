import { useState, useEffect, useCallback } from 'react';

// ── Inject admin global styles (keyframes, body reset) ────────────────────────
const _adminStyle = document.createElement('style');
_adminStyle.textContent = [
  '@keyframes spin { to { transform: rotate(360deg); } }',
  'body { margin: 0; padding: 0; background: #0f1117; }',
].join('\n');
document.head.appendChild(_adminStyle);

// ── Types ────────────────────────────────────────────────────────────────────

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
}

type AuthState = 'checking' | 'unauthenticated' | 'authenticated';

// ── Token helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'admin_jwt';

function loadStoredToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return null;
    const { exp } = JSON.parse(atob(t.split('.')[1])) as { exp: number };
    if (exp * 1000 < Date.now()) { localStorage.removeItem(TOKEN_KEY); return null; }
    return t;
  } catch { return null; }
}

function parseUsername(token: string): string {
  try { return (JSON.parse(atob(token.split('.')[1])) as { username: string }).username; }
  catch { return ''; }
}

// ── Root component ────────────────────────────────────────────────────────────

export default function AdminApp() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  // On mount: pick up token from OAuth redirect URL param, or from localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
      setToken(urlToken);
      setUsername(parseUsername(urlToken));
      setAuthState('authenticated');
      return;
    }
    const stored = loadStoredToken();
    if (stored) {
      setToken(stored);
      setUsername(parseUsername(stored));
      setAuthState('authenticated');
      return;
    }
    setAuthState('unauthenticated');
  }, []);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sessions', { headers: authHeaders() });
      if (res.status === 401) { setAuthState('unauthenticated'); return; }
      if (!res.ok) throw new Error(await res.text());
      setSessions(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (authState === 'authenticated') loadSessions();
  }, [authState, loadSessions]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/sessions/${deleteTarget}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      setSessions((prev) => prev?.filter((s) => s.id !== deleteTarget) ?? null);
      setDeleteTarget(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSessions(null);
    setAuthState('unauthenticated');
  };

  // ── Render: checking ──
  if (authState === 'checking') {
    return <div style={S.center}><div style={S.spinner} /></div>;
  }

  // ── Render: login ──
  if (authState === 'unauthenticated') {
    return (
      <div style={S.center}>
        <div style={S.loginCard}>
          <div style={S.loginIcon}>⚙️</div>
          <h1 style={S.loginTitle}>Admin Panel</h1>
          <p style={S.loginSub}>MIT Planner: Session Management</p>
          <a href="/api/admin/auth/github" style={S.loginBtn}>
            <GitHubIcon />
            Sign in with GitHub
          </a>
          <p style={S.loginNote}>Only the configured admin account can sign in.</p>
        </div>
      </div>
    );
  }

  // ── Render: dashboard ──
  const filtered = (sessions ?? []).filter(
    (s) =>
      !search ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.planNames?.some((n) => n.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div style={S.page}>
      <style>{`.admin-open-link:hover{background:rgba(99,102,241,0.25)!important;border-color:#6366f1!important}.admin-delete-btn:hover{background:rgba(239,68,68,0.15)!important;border-color:#ef4444!important}`}</style>
      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: 20 }}>⚙️</span>
          <span style={S.headerTitle}>Admin Panel</span>
          <span style={S.headerSep}>·</span>
          <span style={S.headerSub}>MIT Planner</span>
        </div>
        <div style={S.headerRight}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={S.openAppLink}>Open Planner ↗</a>
          <span style={S.userChip}>@{username}</span>
          <button onClick={logout} style={S.logoutBtn}>Sign out</button>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={S.main}>

        {/* Toolbar */}
        <div style={S.toolbar}>
          {sessions && (
            <>
              <StatBadge label="Total" value={sessions.length} color="#a5b4fc" />
              <StatBadge label="Encrypted" value={sessions.filter((s) => s.encrypted).length} color="#93c5fd" />
              <StatBadge label="Plain" value={sessions.filter((s) => !s.encrypted).length} color="#86efac" />
            </>
          )}
          <input
            style={S.searchInput}
            placeholder="Search by ID or plan name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={loadSessions} disabled={loading} style={S.refreshBtn}>
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={S.errorBanner}>
            <span><strong>Error:</strong> {error}</span>
            <button onClick={() => setError(null)} style={S.dismissBtn}>✕</button>
          </div>
        )}

        {/* Sessions table */}
        {!sessions && loading && (
          <div style={S.emptyState}>Loading sessions…</div>
        )}

        {sessions && (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {(['Session ID', 'Type', 'Last Updated', 'Plans', 'Settings', ''] as const).map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#6b7280', padding: '36px 0' }}>
                      {search ? 'No sessions match your search.' : 'No sessions found.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <SessionTableRow
                      key={s.id}
                      session={s}
                      onDelete={() => setDeleteTarget(s.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div style={S.overlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>Delete Session?</h2>
            <p style={S.modalBody}>
              Session <code style={S.inlineCode}>{deleteTarget}</code> will be permanently
              removed from Firestore. This cannot be undone, and any users currently
              connected to this session will lose sync.
            </p>
            <div style={S.modalActions}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={S.cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={S.deleteConfirmBtn}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={S.statBadge}>
      <span style={{ ...S.statValue, color }}>{value}</span>
      <span style={S.statLabel}>{label}</span>
    </div>
  );
}

function SessionTableRow({
  session: s,
  onDelete,
}: {
  session: SessionRow;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(s.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tr>
      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={S.codeChip}>{s.id}</code>
          <button onClick={copyId} style={S.miniBtn}>{copied ? '✓' : 'Copy'}</button>
        </div>
      </td>
      <td style={S.td}>
        <span style={{ ...S.typeBadge, ...(s.encrypted ? S.badgeLocked : S.badgePlain) }}>
          {s.encrypted ? '🔒 Encrypted' : '📄 Plain'}
        </span>
      </td>
      <td style={S.td}>
        <span style={S.dimText}>{new Date(s.updatedAt).toLocaleString()}</span>
      </td>
      <td style={S.td}>
        {s.encrypted ? (
          <span style={S.hiddenText}>hidden</span>
        ) : s.planNames?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {s.planNames.map((n, i) => (
              <span key={i} style={S.planTag}>{n || 'Untitled'}</span>
            ))}
          </div>
        ) : (
          <span style={S.dimText}>—</span>
        )}
      </td>
      <td style={S.td}>
        {s.encrypted ? (
          <span style={S.hiddenText}>hidden</span>
        ) : (
          <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
            {s.encounterLevel !== undefined && <div>Level {s.encounterLevel}</div>}
            {s.maxHP !== undefined && (
              <div>HP {s.maxHP.toLocaleString()} / {s.tankHP?.toLocaleString()}</div>
            )}
          </div>
        )}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <a
            href={`/?join=${s.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-open-link"
            style={S.openAppLink}
          >Open ↗</a>
          <button onClick={onDelete} className="admin-delete-btn" style={S.deleteRowBtn}>Delete</button>
        </div>
      </td>
    </tr>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.04-.01-2.04-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f1117', color: '#f3f4f6', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f1117' },
  spinner: { width: 36, height: 36, border: '3px solid #1f2937', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.75s linear infinite' },

  // Login
  loginCard: { background: '#161b27', borderRadius: 16, padding: '48px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 30px 80px rgba(0,0,0,0.7)', maxWidth: 380, width: '90%', border: '1px solid #1f2937' },
  loginIcon: { fontSize: 44, marginBottom: 4 },
  loginTitle: { margin: 0, fontSize: 24, fontWeight: 700, color: '#f9fafb' },
  loginSub: { margin: 0, color: '#6b7280', fontSize: 14 },
  loginBtn: { display: 'inline-flex', alignItems: 'center', gap: 10, background: '#24292f', color: '#f0f6fc', padding: '12px 24px', borderRadius: 9, textDecoration: 'none', fontWeight: 600, fontSize: 15, marginTop: 8, border: '1px solid rgba(240,246,252,0.12)' },
  loginNote: { margin: '4px 0 0', color: '#4b5563', fontSize: 12, textAlign: 'center' },

  // Header
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 56, background: '#161b27', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 10 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontWeight: 700, fontSize: 16, color: '#f9fafb' },
  headerSep: { color: '#374151', fontSize: 18 },
  headerSub: { color: '#6b7280', fontSize: 13 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userChip: { background: '#1f2937', color: '#9ca3af', padding: '4px 13px', borderRadius: 20, fontSize: 13, border: '1px solid #374151' },
  logoutBtn: { background: 'transparent', border: '1px solid #374151', color: '#9ca3af', padding: '5px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 13 },
  openAppLink: { display: 'inline-flex', alignItems: 'center', gap: 4, color: '#a5b4fc', fontSize: 12, textDecoration: 'none', border: '1px solid #3730a3', background: 'transparent', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' as const },

  // Main
  main: { padding: '24px 28px', maxWidth: 1320, margin: '0 auto' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  statBadge: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#161b27', border: '1px solid #1f2937', borderRadius: 10, padding: '8px 18px', minWidth: 72 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  searchInput: { flex: 1, minWidth: 220, background: '#161b27', border: '1px solid #374151', color: '#f3f4f6', padding: '8px 14px', borderRadius: 8, fontSize: 14, outline: 'none' },
  refreshBtn: { background: '#1f2937', border: '1px solid #374151', color: '#d1d5db', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' },

  // Error
  errorBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#450a0a', color: '#fca5a5', padding: '11px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #7f1d1d' },
  dismissBtn: { background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' },
  emptyState: { textAlign: 'center', color: '#6b7280', padding: '64px 0', fontSize: 14 },

  // Table
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid #1f2937' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '10px 16px', textAlign: 'left', background: '#161b27', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #1f2937', whiteSpace: 'nowrap' },
  td: { padding: '12px 16px', borderBottom: '1px solid #161b27', verticalAlign: 'middle' },
  codeChip: { fontFamily: '"JetBrains Mono", "Courier New", monospace', background: '#1f2937', color: '#a5b4fc', padding: '3px 9px', borderRadius: 6, fontSize: 14, letterSpacing: '0.08em' },
  miniBtn: { background: '#1f2937', border: '1px solid #374151', color: '#9ca3af', padding: '3px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' },
  typeBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  badgeLocked: { background: '#172554', color: '#93c5fd' },
  badgePlain: { background: '#052e16', color: '#86efac' },
  dimText: { color: '#6b7280', fontSize: 13 },
  hiddenText: { color: '#374151', fontSize: 13, fontStyle: 'italic' },
  planTag: { display: 'inline-block', background: '#1f2937', color: '#d1d5db', padding: '2px 9px', borderRadius: 5, fontSize: 12 },
  deleteRowBtn: { background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { background: '#161b27', borderRadius: 14, padding: '32px 36px', maxWidth: 480, width: '90%', boxShadow: '0 30px 90px rgba(0,0,0,0.7)', border: '1px solid #1f2937' },
  modalTitle: { margin: '0 0 14px', color: '#f87171', fontSize: 20, fontWeight: 700 },
  modalBody: { margin: '0 0 28px', color: '#d1d5db', fontSize: 14, lineHeight: 1.7 },
  inlineCode: { fontFamily: '"JetBrains Mono", monospace', background: '#1f2937', color: '#a5b4fc', padding: '2px 7px', borderRadius: 4, fontSize: 13 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { background: '#1f2937', border: '1px solid #374151', color: '#d1d5db', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  deleteConfirmBtn: { background: '#dc2626', border: 'none', color: '#fff', padding: '9px 22px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
