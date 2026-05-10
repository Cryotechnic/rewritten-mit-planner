import { useState } from 'react';
import type { Phase } from '../types';
import { useStore, JOB_DISPLAY_NAMES } from '../store';

const FFLOGS_TOKEN_URL = 'https://www.fflogs.com/oauth/token';
const FFLOGS_GQL_URL = 'https://www.fflogs.com/api/v2/client';

// FFLogs subType (English) → EN job abbreviation
const FFLOGS_JOB_MAP: Record<string, string> = {
  Paladin:      'PLD',
  Warrior:      'WAR',
  DarkKnight:   'DRK',
  Gunbreaker:   'GNB',
  WhiteMage:    'WHM',
  Astrologian:  'AST',
  Scholar:      'SCH',
  Sage:         'SGE',
  Monk:         'MNK',
  Dragoon:      'DRG',
  Ninja:        'NIN',
  Samurai:      'SAM',
  Reaper:       'RPR',
  Viper:        'VPR',
  Bard:         'BRD',
  Machinist:    'MCH',
  Dancer:       'DNC',
  BlackMage:    'BLM',
  Summoner:     'SMN',
  RedMage:      'RDM',
  Pictomancer:  'PCT',
};

function parseReportCode(input: string): string | null {
  const urlMatch = input.match(/\/reports\/([A-Za-z0-9]{16})/);
  if (urlMatch) return urlMatch[1];
  const raw = input.trim();
  if (/^[A-Za-z0-9]{16}$/.test(raw)) return raw;
  return null;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(FFLOGS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Auth failed (${res.status}). Check your client ID and secret.`);
  const data = await res.json();
  if (!data.access_token) throw new Error('No access token returned.');
  return data.access_token;
}

async function gqlQuery(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(FFLOGS_GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`FFLogs API error (${res.status}).`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

const GET_REPORT_QUERY = `
query GetReport($code: String!) {
  reportData {
    report(code: $code) {
      fights(killType: All) { id name startTime endTime difficulty kill }
      masterData { actors(type: "Player") { id name type subType } }
    }
  }
}`;

const GET_EVENTS_QUERY = `
query GetEvents($code: String!, $fightId: Int!, $startTime: Float!, $endTime: Float!) {
  reportData {
    report(code: $code) {
      events(fightIDs: [$fightId], startTime: $startTime, endTime: $endTime, dataType: Casts, hostilityType: Enemies) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

interface FightInfo {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  difficulty: number | null;
  kill: boolean | null;
}

interface Actor {
  name: string;
  subType: string;
}

interface CastEvent {
  timestamp: number;
  ability: { name: string };
}

interface TimelineMatch {
  phaseIdx: number;
  phaseName: string;
  actionRow: number;
  actionName: string;
  currentTimeSec: number | null;
  newTimeSec: number;
  abilityName: string;
}

interface Props {
  allPhases: Phase[];
  onClose: () => void;
}

type Step = 'credentials' | 'fetching_report' | 'select_fight' | 'fetching_events' | 'preview' | 'done';

function formatTime(sec: number): string {
  const sign = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60).toString().padStart(2, '0');
  return `${sign}${m}:${s}`;
}

export default function FFlogsImportModal({ allPhases, onClose }: Props) {
  const { setShowJobs, setActionOverride } = useStore();
  const { actionOverrides, baseActionsCleared, customActions } = useStore((s) => s.plans[s.activePlanId]);

  const [reportUrl, setReportUrl] = useState('');
  const [clientId, setClientId] = useState(() => localStorage.getItem('fflogs_client_id') ?? '');
  const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('fflogs_client_secret') ?? '');
  const [step, setStep] = useState<Step>('credentials');
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState('');
  const [reportCode, setReportCode] = useState('');
  const [fights, setFights] = useState<FightInfo[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedFightId, setSelectedFightId] = useState<number | null>(null);

  const [partyJobs, setPartyJobs] = useState<string[]>([]); // EN abbreviations
  const [timelineMatches, setTimelineMatches] = useState<TimelineMatch[]>([]);
  const [selectedMatchIndices, setSelectedMatchIndices] = useState<Set<number>>(new Set());
  const [importPartyComp, setImportPartyComp] = useState(true);

  async function handleFetchReport() {
    const code = parseReportCode(reportUrl);
    if (!code) { setError('Could not parse report code from the URL.'); return; }
    setError(null);
    localStorage.setItem('fflogs_client_id', clientId);
    localStorage.setItem('fflogs_client_secret', clientSecret);
    setStep('fetching_report');
    try {
      const tok = await getAccessToken(clientId, clientSecret);
      setToken(tok);
      setReportCode(code);
      const data = await gqlQuery(tok, GET_REPORT_QUERY, { code });
      setFights(data.reportData.report.fights ?? []);
      setActors(data.reportData.report.masterData?.actors ?? []);
      setStep('select_fight');
    } catch (e) {
      setError(String(e));
      setStep('credentials');
    }
  }

  async function handleLoadFight() {
    if (selectedFightId === null) return;
    const fight = fights.find((f) => f.id === selectedFightId)!;

    const jobs = [...new Set(
      actors.map((a) => FFLOGS_JOB_MAP[a.subType]).filter(Boolean)
    )];
    setPartyJobs(jobs);
    setError(null);
    setStep('fetching_events');

    try {
      // Paginate through all enemy casts (cap at 10 pages to be safe)
      let allEvents: CastEvent[] = [];
      let pageStart = fight.startTime;
      for (let page = 0; page < 10; page++) {
        const data = await gqlQuery(token, GET_EVENTS_QUERY, {
          code: reportCode,
          fightId: fight.id,
          startTime: pageStart,
          endTime: fight.endTime,
        });
        const { data: events, nextPageTimestamp } = data.reportData.report.events;
        if (events) allEvents = [...allEvents, ...events];
        if (!nextPageTimestamp) break;
        pageStart = nextPageTimestamp;
      }

      // Match FFLogs cast events to planner action rows by name
      const matches: TimelineMatch[] = [];
      for (let pi = 0; pi < allPhases.length; pi++) {
        const phase = allPhases[pi];
        const base = baseActionsCleared ? [] : phase.actions.filter((a) => !!a.name);
        const custom = customActions[pi] ?? [];
        for (const action of [...base, ...custom]) {
          if (!action.name) continue;
          const override = actionOverrides[pi]?.[action.row];
          const currentTimeSec = override?.timeSec !== undefined ? override.timeSec : action.timeSec;
          const needle = action.name.toLowerCase().trim();
          const ev = allEvents.find((e) => {
            const hay = e.ability.name.toLowerCase().trim();
            return hay === needle || hay.includes(needle) || needle.includes(hay);
          });
          if (ev) {
            matches.push({
              phaseIdx: pi,
              phaseName: phase.name,
              actionRow: action.row,
              actionName: action.name,
              currentTimeSec,
              newTimeSec: (ev.timestamp - fight.startTime) / 1000,
              abilityName: ev.ability.name,
            });
          }
        }
      }

      setTimelineMatches(matches);
      setSelectedMatchIndices(new Set(matches.map((_, i) => i)));
      setStep('preview');
    } catch (e) {
      setError(String(e));
      setStep('select_fight');
    }
  }

  function handleApply() {
    if (importPartyComp && partyJobs.length > 0) {
      const allPresentJobs = new Set<string>();
      for (const phase of allPhases) {
        for (const sc of phase.skillCols) allPresentJobs.add(sc.job);
      }
      const newShowJobs: Record<string, boolean> = {};
      for (const jpJob of allPresentJobs) {
        const abbr = JOB_DISPLAY_NAMES[jpJob];
        if (!abbr || !partyJobs.includes(abbr)) newShowJobs[jpJob] = false;
      }
      setShowJobs(newShowJobs);
    }
    for (const idx of selectedMatchIndices) {
      const m = timelineMatches[idx];
      setActionOverride(m.phaseIdx, m.actionRow, { timeSec: m.newTimeSec });
    }
    setStep('done');
  }

  const loading = step === 'fetching_report' || step === 'fetching_events';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: '580px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">Import from FFLogs</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Step: credentials */}
        {(step === 'credentials' || step === 'fetching_report') && (
          <div className="modal-body" style={{ overflowY: 'auto' }}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', lineHeight: 1.5 }}>
              Uses the{' '}
              <a href="https://www.fflogs.com/api/v2/client" target="_blank" rel="noreferrer" style={{ color: '#7c9fff' }}>
                FFLogs GraphQL v2 API
              </a>
              {' '}with client credentials OAuth. Create a client at{' '}
              <a href="https://www.fflogs.com/api/clients/" target="_blank" rel="noreferrer" style={{ color: '#7c9fff' }}>
                fflogs.com/api/clients/
              </a>{' '}
              using the <strong style={{ color: '#cbd5e1' }}>Client Credentials</strong> grant type.
            </p>
            <div className="modal-field">
              <label>Report URL or Code</label>
              <input
                className="modal-input"
                placeholder="https://www.fflogs.com/reports/XXXXXXXXXXXXXXXX"
                value={reportUrl}
                onChange={(e) => setReportUrl(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="modal-field">
              <label>Client ID</label>
              <input
                className="modal-input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
                disabled={loading}
              />
            </div>
            <div className="modal-field">
              <label>Client Secret</label>
              <input
                className="modal-input"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="off"
                disabled={loading}
              />
            </div>
            {error && <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
          </div>
        )}

        {/* Step: select fight */}
        {(step === 'select_fight' || step === 'fetching_events') && (
          <div className="modal-body" style={{ overflowY: 'auto' }}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Select a fight to import:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {fights
                .filter((f) => f.name && f.name !== 'Trash')
                .map((fight) => (
                  <button
                    key={fight.id}
                    disabled={step === 'fetching_events'}
                    onClick={() => setSelectedFightId(fight.id)}
                    style={{
                      padding: '8px 12px',
                      background: selectedFightId === fight.id ? '#1e2d5e' : '#181c2e',
                      border: `1px solid ${selectedFightId === fight.id ? '#7c9fff' : '#2d3154'}`,
                      borderRadius: '6px',
                      color: '#e2e8f0',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: step === 'fetching_events' ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>
                      {fight.name}
                      {fight.difficulty != null && (
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                          ({fight.difficulty})
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '11px', color: fight.kill ? '#86efac' : '#f87171', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      {fight.kill ? 'Kill' : 'Wipe'} · {Math.round((fight.endTime - fight.startTime) / 1000)}s
                    </span>
                  </button>
                ))}
            </div>
            {error && <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && (
          <div className="modal-body" style={{ overflowY: 'auto' }}>
            {/* Party composition */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={importPartyComp} onChange={(e) => setImportPartyComp(e.target.checked)} />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Import party composition</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '24px' }}>
                {partyJobs.map((j) => (
                  <span
                    key={j}
                    style={{
                      padding: '2px 8px',
                      background: importPartyComp ? '#1e2d5e' : '#111827',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: importPartyComp ? '#7c9fff' : '#475569',
                      border: '1px solid #2d3154',
                    }}
                  >
                    {j}
                  </span>
                ))}
                {partyJobs.length === 0 && (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>No jobs detected.</span>
                )}
              </div>
            </div>

            {/* Timeline matches */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Timeline matches ({timelineMatches.length})
                </span>
                {timelineMatches.length > 0 && (
                  <button
                    style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      if (selectedMatchIndices.size === timelineMatches.length)
                        setSelectedMatchIndices(new Set());
                      else
                        setSelectedMatchIndices(new Set(timelineMatches.map((_, i) => i)));
                    }}
                  >
                    {selectedMatchIndices.size === timelineMatches.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              {timelineMatches.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#64748b' }}>
                  No action rows matched FFLogs ability names. Action names must overlap with the boss cast names in FFLogs (case-insensitive).
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {timelineMatches.map((m, i) => (
                    <label
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '5px 6px',
                        borderRadius: '4px',
                        background: selectedMatchIndices.has(i) ? 'rgba(124,159,255,0.06)' : 'transparent',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMatchIndices.has(i)}
                        onChange={(e) => {
                          const next = new Set(selectedMatchIndices);
                          if (e.target.checked) next.add(i); else next.delete(i);
                          setSelectedMatchIndices(next);
                        }}
                      />
                      <span style={{ flex: 1, fontSize: '12px', color: '#cbd5e1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#475569', fontSize: '10px', marginRight: '4px' }}>[{m.phaseName}]</span>
                        {m.actionName}
                        {m.abilityName.toLowerCase() !== m.actionName.toLowerCase() && (
                          <span style={{ color: '#334155', fontSize: '10px' }}> ← {m.abilityName}</span>
                        )}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#475569', textDecoration: 'line-through', whiteSpace: 'nowrap' }}>
                        {m.currentTimeSec !== null ? formatTime(m.currentTimeSec) : '—'}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#86efac', whiteSpace: 'nowrap' }}>
                        → {formatTime(m.newTimeSec)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <div className="modal-body">
            <p style={{ color: '#86efac', fontSize: '14px', lineHeight: 1.6 }}>
              Import complete.
              {selectedMatchIndices.size > 0 && ` Updated ${selectedMatchIndices.size} action timing${selectedMatchIndices.size !== 1 ? 's' : ''}.`}
              {importPartyComp && ' Party composition applied.'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <div />
          <div className="modal-footer-right">
            {step === 'done' && (
              <button className="modal-btn save" onClick={onClose}>Close</button>
            )}
            {(step === 'credentials' || step === 'fetching_report') && (
              <>
                <button className="modal-btn cancel" onClick={onClose} disabled={loading}>Cancel</button>
                <button
                  className="modal-btn save"
                  onClick={handleFetchReport}
                  disabled={loading || !reportUrl.trim() || !clientId.trim() || !clientSecret.trim()}
                >
                  {loading ? 'Fetching…' : 'Fetch Report'}
                </button>
              </>
            )}
            {(step === 'select_fight' || step === 'fetching_events') && (
              <>
                <button className="modal-btn cancel" onClick={() => setStep('credentials')} disabled={step === 'fetching_events'}>Back</button>
                <button
                  className="modal-btn save"
                  onClick={handleLoadFight}
                  disabled={selectedFightId === null || step === 'fetching_events'}
                >
                  {step === 'fetching_events' ? 'Loading events…' : 'Load Fight'}
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button className="modal-btn cancel" onClick={() => setStep('select_fight')}>Back</button>
                <button
                  className="modal-btn save"
                  onClick={handleApply}
                  disabled={!importPartyComp && selectedMatchIndices.size === 0}
                >
                  Import
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
