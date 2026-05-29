import React from 'react';

export type ChangeType = 'new' | 'fix' | 'change' | 'remove' | 'hotfix';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: { type: ChangeType; text: React.ReactNode }[];
}

/**
 * Changelog entries, newest first.
 * To publish an update: prepend a new entry and bump the version string.
 * Any user whose lastSeenVersion differs from CHANGELOG[0].version will see
 * the modal automatically on next load.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.8.3',
    date: 'May 28, 2026',
    title: 'Session Onboarding & Security Fixes',
    changes: [
      { type: 'fix',    text: React.createElement(React.Fragment, null, 'Fixed a data leak where the session code and write token were persisted in ', React.createElement('code', { style: { fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: '0.88em' } }, 'localStorage'), ', causing a previous session to silently reopen on next visit.') },
      { type: 'new',    text: 'Added a Recent Sessions list to the share setup screen. Quickly rejoin any of your last 8 sessions without needing a code! Note that you will still need to enter a password for password-protected sessions.' },
      { type: 'fix',    text: 'New sheets are no longer pre-filled with encounter data before the encounter is named; the planner now opens clean after setup.' },
      { type: 'fix',    text: 'Opening "Session by code" from the setup screen and cancelling now correctly returns to the setup screen instead of dropping into the planner.' },
      { type: 'fix',    text: 'Admin panel: session list now loads significantly faster by fetching only the required fields.' },
    ],
  },
  {
    version: '1.8.2',
    date: 'May 27, 2026',
    title: 'Tank Buster Filter & PIP Improvements',
    changes: [
      { type: 'new',    text: 'Added a TB (tank buster) row tag: mark any action as a tank buster via the Edit Action modal.' },
      { type: 'new',    text: 'TB filter button next to Solo in the job toggle bar: instantly hides all non-tank-buster rows with no performance overhead.' },
      { type: 'new',    text: 'Row tags (TB, Tank, Heal, DPS, Note) now appear in the PIP window with coloured left borders, tinted backgrounds, and inline badges.' },
      { type: 'new',    text: React.createElement(React.Fragment, null, 'PIP window now auto-colours rows by job role when no explicit tag is set: ', React.createElement('span', { style: { color: '#93c5fd' } }, 'blue'), ' for tanks, ', React.createElement('span', { style: { color: '#86efac' } }, 'green'), ' for healers, ', React.createElement('span', { style: { color: '#fca5a5' } }, 'red'), ' for DPS.') },
      { type: 'new',    text: 'PIP window now shows mitigations that are still active (within their duration) at each mechanic, with remaining duration displayed on each chip.' },
      { type: 'fix',    text: 'PIP skill durations now correctly account for encounter level (e.g. Reprisal shows 10s below level 98, 15s at level 100).' },
      { type: 'fix',    text: 'PIP role colours are now consistent on all rows; the "next action" green highlight no longer overrides the job-role colour.' },
      { type: 'fix',    text: 'Opening a session from the admin view no longer triggers a spurious write-access error; the session opens read-only with a clear indicator.' },
    ],
  },
  {
    version: '1.8.1',
    date: 'May 21, 2026',
    title: 'Plan Safety & Changelog',
    changes: [
      { type: 'new',    text: 'Closing a plan now requires typing its name to confirm, preventing accidental deletion.' },
      { type: 'new',    text: 'Added this changelog; opens automatically on first visit and after every update.' },
      { type: 'change', text: 'Added current version to footer for easier debug, including commit hash.'},
      { type: 'new',    text: 'Added a disclaimer screen on first launch with terms of use and important notices.' },
    ],
  },
  {
    version: '1.8.0',
    date: 'May 19-20, 2026',
    title: 'PIP Phase Collapse & Localization Fixes',
    changes: [
      { type: 'new',    text: 'PIP window phases can now be collapsed for a cleaner per-job view.' },
      { type: 'new',    text: 'Skill predecessor mapping for improved precondition tracking.' },
      { type: 'new',    text: 'Cancel button added to the session join password prompt.' },
      { type: 'fix',    text: 'Precondition tooltip now displays localized skill names.' },
      { type: 'fix',    text: 'Phase toggle now uses a ref for reliable event handling.' },
      { type: 'fix',    text: 'FFlogs import: importPartyComp now correctly defaults to false.' },
      { type: 'fix',    text: 'Fixed app layout overflow on smaller screens.' },
      { type: 'change', text: 'Improved hover effects throughout the mitigation grid.' },
    ],
  },
  {
    version: '1.7.0',
    date: 'May 19, 2026',
    title: 'FFlogs Polish & Sync Robustness',
    changes: [
      { type: 'new',    text: 'Solo mode toggle in job filter for single-target planning.' },
      { type: 'new',    text: 'Phase filter for FFlogs ability assignment display.' },
      { type: 'new',    text: 'FFlogs ability assignment now handles merged child abilities correctly.' },
      { type: 'fix',    text: 'Remote plan sync now properly replaces a blank local state instead of merging.' },
      { type: 'fix',    text: 'Scrollbar height and border-radius styling improvements.' },
      { type: 'fix',    text: 'Various sync state parameter and planNames mapping fixes.' },
    ],
  },
  {
    version: '1.6.0',
    date: 'May 12-19, 2026',
    title: 'Session Join by Code & Admin Server',
    changes: [
      { type: 'new',    text: 'Sessions can now be joined by entering a 6-character code.' },
      { type: 'new',    text: 'Leave session button with confirmation dialog.' },
      { type: 'new',    text: 'Echo channel added to macro export options.' },
      { type: 'new',    text: 'Admin server with GitHub OAuth and Firestore session management.' },
      { type: 'fix',    text: 'Macro builder now correctly accesses the mitigation grid.' },
      { type: 'fix',    text: 'API TypeScript config, import paths, and QueryDocumentSnapshot fixes.' },
    ],
  },
  {
    version: '1.5.0',
    date: 'May 11-12, 2026',
    title: 'FFlogs Import Enhancements',
    changes: [
      { type: 'new',    text: 'FFlogs import: boss attack timestamps captured for precise action placement.' },
      { type: 'new',    text: 'FFlogs import: combatant HP and mitigation detection.' },
      { type: 'new',    text: 'FFlogs import: ability merging to consolidate overlapping entries.' },
      { type: 'new',    text: 'Invulnerability skill detection with HPBar visual feedback.' },
      { type: 'change', text: 'PIP window shows a fallback message on unsupported browsers.' },
      { type: 'change', text: 'Action timing lookups now use binary search for better performance.' },
    ],
  },
  {
    version: '1.4.0',
    date: 'May 10-11, 2026',
    title: 'Viewer Mode & Cooldown Control',
    changes: [
      { type: 'new',    text: 'Viewer mode: join a session as read-only with a separate view-only link.' },
      { type: 'new',    text: 'Write token system: editors and viewers get distinct access levels.' },
      { type: 'new',    text: 'syncVersion state to keep multi-client sessions consistent.' },
      { type: 'new',    text: 'Force-checkable skill flag: certain skills can always be toggled regardless of state.' },
      { type: 'new',    text: 'Announce delay input in macro export (startBeforeEngage offset).' },
      { type: 'new',    text: 'Allow Cooldown Override setting to bypass cooldown conflict checks.' },
      { type: 'fix',    text: 'Remote plan application now replaces a blank local state rather than merging into it.' },
    ],
  },
  {
    version: '1.3.0',
    date: 'May 10, 2026',
    title: 'Macro Export, PIP Window & Annotations',
    changes: [
      { type: 'new',    text: 'Macro export modal: generate in-game FFXIV macros from your plan.' },
      { type: 'new',    text: 'PIP (Picture-in-Picture) window for a floating per-job mitigation overlay.' },
      { type: 'new',    text: 'FFlogs import: pull ability usage directly from a FFLogs report.' },
      { type: 'new',    text: 'Action notes: attach a text note to any row.' },
      { type: 'new',    text: 'Row tagging: mark rows as tank / heal / dps / note for visual grouping.' },
      { type: 'new',    text: 'Per-job notes on action rows, visible in the PIP window.' },
      { type: 'change', text: 'Optimized action row rendering and Vite build chunking.' },
    ],
  },
  {
    version: '1.2.0',
    date: 'May 10, 2026',
    title: 'Internationalization, Clear Tools & Session Security',
    changes: [
      { type: 'new',    text: 'Full internationalization: Japanese, English, German, French, Korean, and Chinese.' },
      { type: 'new',    text: 'Clear mitigations modal with three scopes: current phase, current plan, or all plans.' },
      { type: 'new',    text: 'Clear custom actions: requires typing the plan name to confirm.' },
      { type: 'new',    text: 'Passcode gate: optionally lock the app behind a passcode.' },
      { type: 'new',    text: 'Session password protection for private shared sessions.' },
      { type: 'new',    text: 'Session settings (maxHP, tankHP, encounter level) now sync across clients.' },
      { type: 'new',    text: 'Host waiting state: joiners see a holding screen until the host connects.' },
      { type: 'change', text: 'Improved mitigation grid table layout and readability.' },
    ],
  },
  {
    version: '1.1.0',
    date: 'May 9, 2026',
    title: 'Multi-Plan, OOBE & Firebase Sync',
    changes: [
      { type: 'new',    text: 'Multiple plans supported via a tab bar: add, rename, and switch plans.' },
      { type: 'new',    text: 'OOBE (first-run setup) screen to name your first encounter.' },
      { type: 'new',    text: 'Custom phase management: add, rename, and delete phases.' },
      { type: 'new',    text: 'Firebase real-time sync: share a session code to collaborate live.' },
      { type: 'new',    text: 'Session code refresh dialog.' },
      { type: 'new',    text: 'Share error banner when the sync session is unreachable.' },
      { type: 'fix',    text: 'Echo loop prevention: remote updates no longer trigger a redundant push.' },
      { type: 'fix',    text: 'Cell blocked logic now correctly accounts for cooldown coverage.' },
    ],
  },
  {
    version: '1.0.0',
    date: 'May 9, 2026',
    title: 'Initial Release',
    changes: [
      { type: 'new',    text: 'Mitigation planner grid for FFXIV savage and ultimate raids.' },
      { type: 'new',    text: 'Per-role and per-job mitigation tracking with toggle checkboxes.' },
      { type: 'new',    text: 'Cooldown and effect coverage indicators on each cell.' },
      { type: 'new',    text: 'Action editing modal: customize name, time, damage type, and damage value.' },
      { type: 'new',    text: 'Encounter level filtering: skills not available at the selected level are hidden.' },
      { type: 'new',    text: 'LB1/LB2 columns injected automatically when LB3 is present.' },
      { type: 'new',    text: 'Custom action management: add actions beyond the base encounter data.' },
      { type: 'new',    text: 'Git commit hash displayed in the footer.' },
    ],
  },
];

/** The version string users must have seen to suppress the modal. */
export const CURRENT_VERSION = CHANGELOG[0].version;
