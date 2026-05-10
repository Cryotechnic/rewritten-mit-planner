import React, { useState } from 'react';
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
      masterData {
        actors(type: "Player") { id name type subType }
        abilities { gameID name }
      }
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

const GET_DAMAGE_QUERY = `
query GetDamage($code: String!, $fightId: Int!, $startTime: Float!, $endTime: Float!) {
  reportData {
    report(code: $code) {
      events(fightIDs: [$fightId], startTime: $startTime, endTime: $endTime, dataType: DamageTaken) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

const GET_FRIENDLY_CASTS_QUERY = `
query GetFriendlyCasts($code: String!, $fightId: Int!, $startTime: Float!, $endTime: Float!) {
  reportData {
    report(code: $code) {
      events(fightIDs: [$fightId], startTime: $startTime, endTime: $endTime, dataType: Casts, hostilityType: Friendlies) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

async function paginateEvents(token: string, query: string, code: string, fightId: number, startTime: number, endTime: number): Promise<unknown[]> {
  let all: unknown[] = [];
  let pageStart = startTime;
  for (let page = 0; page < 10; page++) {
    const data = await gqlQuery(token, query, { code, fightId, startTime: pageStart, endTime });
    const { data: events, nextPageTimestamp } = data.reportData.report.events;
    if (events) all = [...all, ...events];
    if (!nextPageTimestamp) break;
    pageStart = nextPageTimestamp;
  }
  return all;
}

interface FightInfo {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  difficulty: number | null;
  kill: boolean | null;
}

interface Actor {
  id: number;
  name: string;
  subType: string;
}

interface AbilityInfo {
  gameID: number;
  name: string;
}

interface CastEvent {
  timestamp: number;
  abilityGameID?: number;
  ability?: { name: string; guid?: number };
}

interface DamageEvent {
  timestamp: number;
  abilityGameID?: number;
  ability?: { name: string };
  amount?: number;
  unmitigatedAmount?: number;
}

interface FriendlyCastEvent {
  timestamp: number;
  abilityGameID?: number;
  ability?: { name: string };
  sourceID?: number;
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

interface AbilityAssignment {
  name: string;
  timeSec: number;
  included: boolean;
  phaseIdx: number;
  damageHit: number | null;
  nearbyCasts: string[]; // "JOB: Ability Name"
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
  const { setShowJobs, setActionOverride, renamePlan, activePlanId, replaceAllCustomActions } = useStore();
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
  const [abilities, setAbilities] = useState<AbilityInfo[]>([]);
  const [selectedFightId, setSelectedFightId] = useState<number | null>(null);

  const [partyJobs, setPartyJobs] = useState<string[]>([]); // EN abbreviations
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [timelineMatches, setTimelineMatches] = useState<TimelineMatch[]>([]);
  const [selectedMatchIndices, setSelectedMatchIndices] = useState<Set<number>>(new Set());
  const [importPartyComp, setImportPartyComp] = useState(true);
  const [importFullTimeline, setImportFullTimeline] = useState(false);
  const [abilityAssignments, setAbilityAssignments] = useState<AbilityAssignment[]>([]);
  const [selectedAbilityIndices, setSelectedAbilityIndices] = useState<Set<number>>(new Set());
  const [bulkPhaseIdx, setBulkPhaseIdx] = useState(0);
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [expandedAbilityRows, setExpandedAbilityRows] = useState<Set<number>>(new Set());
  const [rawAbilityNames, setRawAbilityNames] = useState<string[]>([]);
  const [showRawNames, setShowRawNames] = useState(false);
  const [selectedFightName, setSelectedFightName] = useState<string>('');

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
      setAbilities(data.reportData.report.masterData?.abilities ?? []);
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
    setSelectedJobs(new Set(jobs));
    setSelectedFightName(fight.name ?? '');
    setError(null);
    setStep('fetching_events');

    try {
      // Build ability ID → name map from masterData
      const abilityMap: Record<number, string> = {};
      for (const ab of abilities) abilityMap[ab.gameID] = ab.name;

      function resolveAbilityName(e: { abilityGameID?: number; ability?: { name: string } }): string | null {
        if (e.ability?.name) return e.ability.name;
        if (e.abilityGameID != null) return abilityMap[e.abilityGameID] ?? null;
        return null;
      }

      // Fetch boss casts, damage taken, and friendly casts in parallel
      const [allEvents, allDamageEvents, allFriendlyCasts] = await Promise.all([
        paginateEvents(token, GET_EVENTS_QUERY, reportCode, fight.id, fight.startTime, fight.endTime),
        paginateEvents(token, GET_DAMAGE_QUERY, reportCode, fight.id, fight.startTime, fight.endTime),
        paginateEvents(token, GET_FRIENDLY_CASTS_QUERY, reportCode, fight.id, fight.startTime, fight.endTime),
      ]);

      // Build ability damage map: name → max unmitigated (or mitigated) damage per hit
      const abilityDamageMap: Record<string, number> = {};
      for (const e of allDamageEvents as DamageEvent[]) {
        const name = resolveAbilityName(e);
        if (!name) continue;
        const dmg = e.unmitigatedAmount ?? e.amount ?? 0;
        if (dmg > (abilityDamageMap[name] ?? 0)) abilityDamageMap[name] = dmg;
      }

      // Build actor ID → job abbreviation
      const actorJobMap: Record<number, string> = {};
      for (const a of actors) actorJobMap[a.id] = FFLOGS_JOB_MAP[a.subType] ?? a.subType;

      // Sorted friendly casts for nearby lookup
      const friendlyCastsSorted = (allFriendlyCasts as FriendlyCastEvent[])
        .map((e) => {
          const job = e.sourceID != null ? actorJobMap[e.sourceID] : null;
          const aName = resolveAbilityName(e);
          return job && aName ? { timeSec: (e.timestamp - fight.startTime) / 1000, label: `${job}: ${aName}` } : null;
        })
        .filter((x): x is { timeSec: number; label: string } => x !== null)
        .sort((a, b) => a.timeSec - b.timeSec);

      function getNearbyCasts(bossTimeSec: number): string[] {
        const lo = bossTimeSec - 30, hi = bossTimeSec + 5;
        const seen = new Set<string>();
        const result: string[] = [];
        for (const c of friendlyCastsSorted) {
          if (c.timeSec < lo) continue;
          if (c.timeSec > hi) break;
          if (!seen.has(c.label)) { seen.add(c.label); result.push(c.label); }
        }
        return result;
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
          const ev = (allEvents as CastEvent[]).find((e) => {
            const name = resolveAbilityName(e);
            if (!name) return false;
            const hay = name.toLowerCase().trim();
            return hay === needle || hay.includes(needle) || needle.includes(hay);
          });
          if (ev) {
            const evName = resolveAbilityName(ev) ?? action.name;
            matches.push({
              phaseIdx: pi,
              phaseName: phase.name,
              actionRow: action.row,
              actionName: action.name,
              currentTimeSec,
              newTimeSec: (ev.timestamp - fight.startTime) / 1000,
              abilityName: evName,
            });
          }
        }
      }

      const uniqueNames = [...new Set(
        (allEvents as CastEvent[]).map((e) => resolveAbilityName(e)).filter((n): n is string => !!n)
      )].sort((a, b) => a.localeCompare(b));
      const noMatches = matches.length === 0;
      setRawAbilityNames(uniqueNames);
      setTimelineMatches(matches);
      setSelectedMatchIndices(new Set(matches.map((_, i) => i)));
      setImportFullTimeline(noMatches);
      // Build per-ability assignment list (deduplicated, ordered by first occurrence)
      if (noMatches) {
        const seen2 = new Set<string>();
        const assignments: AbilityAssignment[] = [];
        for (const e of allEvents) {
          const name = resolveAbilityName(e as CastEvent);
          if (!name || seen2.has(name)) continue;
          seen2.add(name);
          const timeSec = ((e as CastEvent).timestamp - fight.startTime) / 1000;
          assignments.push({ name, timeSec, included: true, phaseIdx: 0, damageHit: abilityDamageMap[name] ?? null, nearbyCasts: getNearbyCasts(timeSec) });
        }
        setAbilityAssignments(assignments);
      }
      setStep('preview');
    } catch (e) {
      setError(String(e));
      setStep('select_fight');
    }
  }

  function handleApply() {
    if (importPartyComp && selectedJobs.size > 0) {
      const allPresentJobs = new Set<string>();
      for (const phase of allPhases) {
        for (const sc of phase.skillCols) allPresentJobs.add(sc.job);
      }
      const newShowJobs: Record<string, boolean> = {};
      for (const jpJob of allPresentJobs) {
        const abbr = JOB_DISPLAY_NAMES[jpJob];
        if (!abbr || !selectedJobs.has(abbr)) newShowJobs[jpJob] = false;
      }
      setShowJobs(newShowJobs);
    }
    if (importFullTimeline) {
      // Group assignments by phase
      const byPhase: Record<number, import('../types').Action[]> = {};
      let row = 0;
      for (const a of abilityAssignments) {
        if (!a.included) { row++; continue; }
        if (!byPhase[a.phaseIdx]) byPhase[a.phaseIdx] = [];
        byPhase[a.phaseIdx].push({
          row,
          timeSec: a.timeSec,
          name: a.name,
          type: null,
          damageHit: a.damageHit ?? null,
          damageDot: null,
          damageTick: null,
          mitStates: {},
        });
        row++;
      }
      replaceAllCustomActions(byPhase);
    } else {
      for (const idx of selectedMatchIndices) {
        const m = timelineMatches[idx];
        setActionOverride(m.phaseIdx, m.actionRow, { timeSec: m.newTimeSec });
      }
    }
    if (selectedFightName) renamePlan(activePlanId, selectedFightName);
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
                      {fight.kill ? 'Kill' : 'Wipe'} · {(() => { const s = Math.round((fight.endTime - fight.startTime) / 1000); return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')} (${s}s)`; })()}
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
                {partyJobs.map((j) => {
                  const active = importPartyComp && selectedJobs.has(j);
                  return (
                    <button
                      key={j}
                      disabled={!importPartyComp}
                      onClick={() => setSelectedJobs(prev => {
                        const next = new Set(prev);
                        next.has(j) ? next.delete(j) : next.add(j);
                        return next;
                      })}
                      style={{
                        padding: '2px 8px',
                        background: active ? '#1e2d5e' : '#111827',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: active ? '#7c9fff' : '#475569',
                        border: `1px solid ${active ? '#3b5cc4' : '#2d3154'}`,
                        cursor: importPartyComp ? 'pointer' : 'default',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {j}
                    </button>
                  );
                })}
                {partyJobs.length === 0 && (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>No jobs detected.</span>
                )}
              </div>
            </div>

            {/* Full timeline import — per-ability assignment table (shown when no matches) */}
            {timelineMatches.length === 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={importFullTimeline} onChange={(e) => setImportFullTimeline(e.target.checked)} />
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#fbbf24' }}>
                      Import full FFLogs timeline ({abilityAssignments.filter(a => a.included).length} abilities)
                    </span>
                  </label>
                  {importFullTimeline && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setAbilityAssignments(a => a.map(x => ({ ...x, included: true })))}>All</button>
                      <button style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setAbilityAssignments(a => a.map(x => ({ ...x, included: false })))}>None</button>
                    </div>
                  )}
                </div>
                {importFullTimeline && (
                  <div style={{ border: '1px solid #2d3154', borderRadius: '6px', overflow: 'hidden' }}>
                    {/* Bulk-assign toolbar */}
                    {allPhases.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: '#0d1020', borderBottom: '1px solid #2d3154', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {selectedAbilityIndices.size > 0 ? `${selectedAbilityIndices.size} selected` : 'Click rows to select'}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Assign selected to:</span>
                        <select
                          value={bulkPhaseIdx}
                          onChange={(e) => setBulkPhaseIdx(Number(e.target.value))}
                          style={{ background: '#181c2e', border: '1px solid #2d3154', borderRadius: '4px', color: '#e2e8f0', fontSize: '11px', padding: '2px 4px', cursor: 'pointer' }}
                        >
                          {allPhases.map((p, pi) => (
                            <option key={pi} value={pi}>{p.name || `Phase ${pi + 1}`}</option>
                          ))}
                        </select>
                        <button
                          disabled={selectedAbilityIndices.size === 0}
                          onClick={() => {
                            setAbilityAssignments(prev => prev.map((x, j) => selectedAbilityIndices.has(j) ? { ...x, phaseIdx: bulkPhaseIdx } : x));
                            setSelectedAbilityIndices(new Set());
                          }}
                          style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: selectedAbilityIndices.size > 0 ? '#1d3a8a' : '#1e2235', color: selectedAbilityIndices.size > 0 ? '#e2e8f0' : '#475569', fontSize: '11px', cursor: selectedAbilityIndices.size > 0 ? 'pointer' : 'default' }}
                        >
                          Apply
                        </button>
                      </div>
                    )}
                    {/* Ability rows */}
                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      {abilityAssignments.map((a, i) => {
                        const isSelected = selectedAbilityIndices.has(i);
                        return (
                          <React.Fragment key={i}>
                            <div
                              onClick={(e) => {
                              if (e.shiftKey && lastSelectedIdx !== null) {
                                const lo = Math.min(lastSelectedIdx, i), hi = Math.max(lastSelectedIdx, i);
                                setSelectedAbilityIndices(prev => {
                                  const next = new Set(prev);
                                  for (let k = lo; k <= hi; k++) next.add(k);
                                  return next;
                                });
                              } else {
                                setSelectedAbilityIndices(prev => {
                                  const next = new Set(prev);
                                  next.has(i) ? next.delete(i) : next.add(i);
                                  return next;
                                });
                                setLastSelectedIdx(i);
                              }
                            }}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: isSelected ? 'rgba(124,159,255,0.14)' : a.included ? 'rgba(124,159,255,0.04)' : 'transparent', borderBottom: i < abilityAssignments.length - 1 && !expandedAbilityRows.has(i) ? '1px solid #1e2235' : 'none', opacity: a.included ? 1 : 0.4, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <input
                              type="checkbox"
                              checked={a.included}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setAbilityAssignments(prev => prev.map((x, j) => j === i ? { ...x, included: e.target.checked } : x))}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#475569', whiteSpace: 'nowrap', minWidth: '40px' }}>{formatTime(a.timeSec)}</span>
                            <span style={{ flex: 1, fontSize: '12px', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            {a.nearbyCasts.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedAbilityRows(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; }); }}
                                style={{ fontSize: '10px', color: '#475569', background: 'none', border: '1px solid #2d3154', borderRadius: '3px', padding: '0 4px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                              >
                                {expandedAbilityRows.has(i) ? '▲' : '▼'} {a.nearbyCasts.length}
                              </button>
                            )}
                            {a.damageHit != null && (
                              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>⚔ {a.damageHit.toLocaleString()}</span>
                            )}
                            {allPhases.length > 1 && (
                              <span style={{ fontSize: '11px', color: isSelected ? '#7c9fff' : '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {allPhases[a.phaseIdx]?.name || `Phase ${a.phaseIdx + 1}`}
                              </span>
                            )}
                            </div>
                            {expandedAbilityRows.has(i) && a.nearbyCasts.length > 0 && (
                              <div style={{ padding: '3px 8px 4px 32px', background: '#0d1020', borderBottom: i < abilityAssignments.length - 1 ? '1px solid #1e2235' : 'none', fontSize: '10px', color: '#475569', lineHeight: 1.6 }}>
                                {a.nearbyCasts.join(' · ')}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!importFullTimeline && (
                  <p style={{ fontSize: '12px', color: '#92400e', margin: '4px 0 0 24px' }}>
                    No action rows matched boss ability names. Check the box to replace the action list with FFLogs casts.
                  </p>
                )}
              </div>
            )}

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
                  {' '}Use the ability list below to see what FFLogs returned.
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

            {/* Raw FFLogs ability names (debug) */}
            {rawAbilityNames.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid #1e2235', paddingTop: '12px' }}>
                <button
                  style={{ background: 'none', border: 'none', color: '#475569', fontSize: '12px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setShowRawNames((v) => !v)}
                >
                  <span style={{ fontSize: '10px' }}>{showRawNames ? '▾' : '▸'}</span>
                  Boss ability names from FFLogs ({rawAbilityNames.length})
                </button>
                {showRawNames && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                    {rawAbilityNames.map((name) => (
                      <span
                        key={name}
                        style={{
                          padding: '2px 7px',
                          background: '#111827',
                          border: '1px solid #2d3154',
                          borderRadius: '10px',
                          fontSize: '11px',
                          color: '#94a3b8',
                          cursor: 'default',
                        }}
                        title={name}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && (
          <div className="modal-body">
            <p style={{ color: '#86efac', fontSize: '14px', lineHeight: 1.6 }}>
              Import complete.
              {selectedFightName && ` Plan renamed to "${selectedFightName}".`}
              {importFullTimeline && ` Imported ${rawAbilityNames.length} unique boss abilities as the timeline.`}
              {!importFullTimeline && selectedMatchIndices.size > 0 && ` Updated ${selectedMatchIndices.size} action timing${selectedMatchIndices.size !== 1 ? 's' : ''}.`}
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
