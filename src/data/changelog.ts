import React from 'react';
import skillsData from './skills.json';

export type ChangeType = 'new' | 'fix' | 'change' | 'remove' | 'hotfix';

// Build a lookup of EN skill name -> icon URL
const SKILL_ICON_MAP: Record<string, string> = {};
for (const s of skillsData as { nameEN: string | null; icon: string | null }[]) {
  if (s.nameEN && s.icon && !SKILL_ICON_MAP[s.nameEN]) {
    SKILL_ICON_MAP[s.nameEN] = s.icon;
  }
}

// Pre-build a single regex matching all known skill names (longest first to avoid partial matches)
const ALL_SKILL_NAMES = Object.keys(SKILL_ICON_MAP).sort((a, b) => b.length - a.length);
const SKILL_RE = new RegExp(
  `(${ALL_SKILL_NAMES.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'g',
);

/** Auto-detects skill names in text and renders them with their icons. */
function withIcons(text: string): React.ReactNode {
  const parts = text.split(SKILL_RE);
  if (parts.length === 1) return text;
  return React.createElement(React.Fragment, null, ...parts.map((part, i) => {
    const icon = SKILL_ICON_MAP[part];
    if (icon) {
      return React.createElement('span', { key: i, style: { whiteSpace: 'nowrap' } },
        React.createElement('img', {
          src: icon, alt: part, width: 16, height: 16,
          style: { verticalAlign: 'text-bottom', marginRight: 2 },
        }),
        part,
      );
    }
    return part;
  }));
}

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
    version: '1.8.8',
    date: 'June 1, 2026',
    title: 'Scholar Succor & FFLogs UI Fix',
    changes: [
      { type: 'new', text: withIcons('Added Scholar\'s Succor as a standard mitigation column in data.') },
      { type: 'fix', text: 'FFLogs importer: circle selector for phase assignment is now disabled until the ability checkbox is checked.' },
    ],
  },
  {
    version: '1.8.7',
    date: 'June 1, 2026',
    title: 'Inline Damage Editing & Custom Job Order',
    changes: [
      { type: 'new', text: withIcons('Double-clicking a damage cell now allows inline editing of the damage value without opening the full Edit Action modal.') },
      { type: 'new', text: withIcons('Job columns can now be reordered by dragging and dropping the job toggle buttons in the toolbar. Custom order persists across sessions.') },
      { type: 'new', text: 'FFLogs importer: dedicated selection column with Windows-style multi-select (Click, Ctrl+Click, Shift+Click, Ctrl+Shift+Click).' },
      { type: 'new', text: 'FFLogs importer: clear selection button appears when rows are selected.' },
      { type: 'new', text: 'Phase tabs can now be renamed by double-clicking them.' },
      { type: 'change', text: withIcons('FFLogs import modal now includes a step-by-step guide on how to create an API client and obtain credentials.') },
      { type: 'fix', text: 'FFLogs importer: selection now persists when switching between phase tabs.' },
      { type: 'fix', text: 'FFLogs importer: improved visibility of merge, occurrence count, and nearby casts buttons.' },
      { type: 'fix', text: 'FFLogs importer: mitigations now correctly apply to all phases, not just the first.' },
      { type: 'fix', text: withIcons('Intervention now correctly calculates all 3 mitigation layers: base 10%, Knight\'s Resolve +10%, and +10% when Rampart/Sentinel/Guardian is active on the same row.') },
    ],
  },
  {
    version: '1.8.6',
    date: 'May 31, 2026',
    title: 'PLD Skill Fixes',
    changes: [
      { type: 'fix', text: withIcons('Divine Veil now correctly contributes a 10% max HP barrier to the Barrier column instead of boosting other barriers.') },
      { type: 'fix', text: withIcons('Bulwark now applies a 10% physical and magic damage reduction, reflecting 100% block rate uptime during its effect window.') },
    ],
  },
  {
    version: '1.8.5',
    date: 'May 31, 2026',
    title: 'Single-Target Skill Fix',
    changes: [
      { type: 'new',    text: withIcons('Mitigation from skills active on earlier rows (e.g. Reprisal, Feint) now automatically propagates into Mit%/Mitigated/Barrier calculations on subsequent rows within the effect window.') },
      { type: 'new',    text: withIcons('Heart of Corundum and Intervention are now always checkable on all rows, matching The Blackest Night and Oblation behavior.') },
      { type: 'change', text: withIcons('Holy Sheltron now uses the Knight\'s Resolve window (~28% mit / 4s) for calculations, since you always time the hit in the strong phase. Hovering the skill header shows the full breakdown.') },
      { type: 'change', text: withIcons('Heart of Corundum now uses the Clarity window (~28% mit / 4s) for calculations. Hovering the skill header shows the full breakdown.') },
      { type: 'change', text: withIcons('Tank self-mitigation (Rampart, Shadow Wall, Heart of Corundum, Oblation, Intervention, The Blackest Night, etc.) and invulnerabilities are now excluded from Mit%/Mitigated/Barrier calculations unless the row is tagged as TB (tank buster).') },
      { type: 'fix',    text: withIcons('Fixed column hover highlighting disappearing after toggling a skill checkbox.') },
      { type: 'fix',    text: withIcons('Fixed Feint, Addle, Dismantle, and Nature\'s Minne being unclickable on custom (inserted) rows. These single-target skills now remain selectable when they provide mitigation or buff values.') },
    ],
  },
  {
    version: '1.8.4',
    date: 'May 30, 2026',
    title: 'Session Link & Naming Fixes',
    changes: [
      { type: 'new',    text: withIcons('Users with write access are now required to name untitled plans before proceeding, preventing "Untitled" sessions from being created.') },
      { type: 'new',    text: withIcons('Admin panel: added separate "Open" (read-only) and "Edit" (write access) buttons for each session.') },
      { type: 'fix',    text: withIcons('Share links now use a query parameter for the write token instead of a URL hash fragment, preventing tokens from being stripped by ad blockers or browser extensions.') },
      { type: 'fix',    text: withIcons('Plans from previously joined sessions no longer bleed into new sessions when opening a different link.') },
      { type: 'fix',    text: withIcons('Plan rename now correctly pushes to database immediately, fixing a race condition where the subscription echo could overwrite the new name.') },
      { type: 'fix',    text: React.createElement(React.Fragment, null, 'Fixed cross-session token contamination caused by stale write tokens persisted in ', React.createElement('code', { style: { fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: '0.88em' } }, 'localStorage'), '.') },
      { type: 'remove', text: withIcons('Removed the "Restore encounter data" button to prevent accidental usage during World Race scenario.') },
    ],
  },
  {
    version: '1.8.3',
    date: 'May 28, 2026',
    title: 'Session Onboarding & Security Fixes',
    changes: [
      { type: 'new',    text: withIcons('Added a Recent Sessions list to the share setup screen. Quickly rejoin any of your last 8 sessions without needing a code! Note that you will still need to enter a password for password-protected sessions.') },
      { type: 'fix',    text: React.createElement(React.Fragment, null, 'Fixed a data leak where the session code and write token were persisted in ', React.createElement('code', { style: { fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: '0.88em' } }, 'localStorage'), ', causing a previous session to silently reopen on next visit.') },
      { type: 'fix',    text: withIcons('New sheets are no longer pre-filled with encounter data before the encounter is named; the planner now opens clean after setup.') },
      { type: 'fix',    text: withIcons('Opening "Session by code" from the setup screen and cancelling now correctly returns to the setup screen instead of dropping into the planner.') },
      { type: 'fix',    text: withIcons('Admin panel: session list now loads significantly faster by fetching only the required fields.') },
    ],
  },
  {
    version: '1.8.2',
    date: 'May 27, 2026',
    title: 'Tank Buster Filter & PIP Improvements',
    changes: [
      { type: 'new',    text: withIcons('Added a TB (tank buster) row tag: mark any action as a tank buster via the Edit Action modal.') },
      { type: 'new',    text: withIcons('TB filter button next to Solo in the job toggle bar: instantly hides all non-tank-buster rows with no performance overhead.') },
      { type: 'new',    text: withIcons('Row tags (TB, Tank, Heal, DPS, Note) now appear in the PIP window with coloured left borders, tinted backgrounds, and inline badges.') },
      { type: 'new',    text: React.createElement(React.Fragment, null, 'PIP window now auto-colours rows by job role when no explicit tag is set: ', React.createElement('span', { style: { color: '#93c5fd' } }, 'blue'), ' for tanks, ', React.createElement('span', { style: { color: '#86efac' } }, 'green'), ' for healers, ', React.createElement('span', { style: { color: '#fca5a5' } }, 'red'), ' for DPS.') },
      { type: 'new',    text: withIcons('PIP window now shows mitigations that are still active (within their duration) at each mechanic, with remaining duration displayed on each chip.') },
      { type: 'fix',    text: withIcons('PIP skill durations now correctly account for encounter level (e.g. Reprisal shows 10s below level 98, 15s at level 100).') },
      { type: 'fix',    text: withIcons('PIP role colours are now consistent on all rows; the "next action" green highlight no longer overrides the job-role colour.') },
      { type: 'fix',    text: withIcons('Opening a session from the admin view no longer triggers a spurious write-access error; the session opens read-only with a clear indicator.') },
    ],
  },
  {
    version: '1.8.1',
    date: 'May 21, 2026',
    title: 'Plan Safety & Changelog',
    changes: [
      { type: 'new',    text: withIcons('Closing a plan now requires typing its name to confirm, preventing accidental deletion.') },
      { type: 'new',    text: withIcons('Added this changelog; opens automatically on first visit and after every update.') },
      { type: 'new',    text: withIcons('Added a disclaimer screen on first launch with terms of use and important notices.') },
      { type: 'change', text: withIcons('Added current version to footer for easier debug, including commit hash.')},
    ],
  },
  {
    version: '1.8.0',
    date: 'May 19-20, 2026',
    title: 'PIP Phase Collapse & Localization Fixes',
    changes: [
      { type: 'new',    text: withIcons('PIP window phases can now be collapsed for a cleaner per-job view.') },
      { type: 'new',    text: withIcons('Skill predecessor mapping for improved precondition tracking.') },
      { type: 'new',    text: withIcons('Cancel button added to the session join password prompt.') },
      { type: 'fix',    text: withIcons('Precondition tooltip now displays localized skill names.') },
      { type: 'fix',    text: withIcons('Phase toggle now uses a ref for reliable event handling.') },
      { type: 'fix',    text: withIcons('FFlogs import: importPartyComp now correctly defaults to false.') },
      { type: 'fix',    text: withIcons('Fixed app layout overflow on smaller screens.') },
      { type: 'change', text: withIcons('Improved hover effects throughout the mitigation grid.') },
    ],
  },
  {
    version: '1.7.0',
    date: 'May 19, 2026',
    title: 'FFlogs Polish & Sync Robustness',
    changes: [
      { type: 'new',    text: withIcons('Solo mode toggle in job filter for single-target planning.') },
      { type: 'new',    text: withIcons('Phase filter for FFlogs ability assignment display.') },
      { type: 'new',    text: withIcons('FFlogs ability assignment now handles merged child abilities correctly.') },
      { type: 'fix',    text: withIcons('Remote plan sync now properly replaces a blank local state instead of merging.') },
      { type: 'fix',    text: withIcons('Scrollbar height and border-radius styling improvements.') },
      { type: 'fix',    text: withIcons('Various sync state parameter and planNames mapping fixes.') },
    ],
  },
  {
    version: '1.6.0',
    date: 'May 12-19, 2026',
    title: 'Session Join by Code & Admin Server',
    changes: [
      { type: 'new',    text: withIcons('Sessions can now be joined by entering a 6-character code.') },
      { type: 'new',    text: withIcons('Leave session button with confirmation dialog.') },
      { type: 'new',    text: withIcons('Echo channel added to macro export options.') },
      { type: 'new',    text: withIcons('Admin server with GitHub OAuth and Firestore session management.') },
      { type: 'fix',    text: withIcons('Macro builder now correctly accesses the mitigation grid.') },
      { type: 'fix',    text: withIcons('API TypeScript config, import paths, and QueryDocumentSnapshot fixes.') },
    ],
  },
  {
    version: '1.5.0',
    date: 'May 11-12, 2026',
    title: 'FFlogs Import Enhancements',
    changes: [
      { type: 'new',    text: withIcons('FFlogs import: boss attack timestamps captured for precise action placement.') },
      { type: 'new',    text: withIcons('FFlogs import: combatant HP and mitigation detection.') },
      { type: 'new',    text: withIcons('FFlogs import: ability merging to consolidate overlapping entries.') },
      { type: 'new',    text: withIcons('Invulnerability skill detection with HPBar visual feedback.') },
      { type: 'change', text: withIcons('PIP window shows a fallback message on unsupported browsers.') },
      { type: 'change', text: withIcons('Action timing lookups now use binary search for better performance.') },
    ],
  },
  {
    version: '1.4.0',
    date: 'May 10-11, 2026',
    title: 'Viewer Mode & Cooldown Control',
    changes: [
      { type: 'new',    text: withIcons('Viewer mode: join a session as read-only with a separate view-only link.') },
      { type: 'new',    text: withIcons('Write token system: editors and viewers get distinct access levels.') },
      { type: 'new',    text: withIcons('syncVersion state to keep multi-client sessions consistent.') },
      { type: 'new',    text: withIcons('Force-checkable skill flag: certain skills can always be toggled regardless of state.') },
      { type: 'new',    text: withIcons('Announce delay input in macro export (startBeforeEngage offset).') },
      { type: 'new',    text: withIcons('Allow Cooldown Override setting to bypass cooldown conflict checks.') },
      { type: 'fix',    text: withIcons('Remote plan application now replaces a blank local state rather than merging into it.') },
    ],
  },
  {
    version: '1.3.0',
    date: 'May 10, 2026',
    title: 'Macro Export, PIP Window & Annotations',
    changes: [
      { type: 'new',    text: withIcons('Macro export modal: generate in-game FFXIV macros from your plan.') },
      { type: 'new',    text: withIcons('PIP (Picture-in-Picture) window for a floating per-job mitigation overlay.') },
      { type: 'new',    text: withIcons('FFlogs import: pull ability usage directly from a FFLogs report.') },
      { type: 'new',    text: withIcons('Action notes: attach a text note to any row.') },
      { type: 'new',    text: withIcons('Row tagging: mark rows as tank / heal / dps / note for visual grouping.') },
      { type: 'new',    text: withIcons('Per-job notes on action rows, visible in the PIP window.') },
      { type: 'change', text: withIcons('Optimized action row rendering and Vite build chunking.') },
    ],
  },
  {
    version: '1.2.0',
    date: 'May 10, 2026',
    title: 'Internationalization, Clear Tools & Session Security',
    changes: [
      { type: 'new',    text: withIcons('Full internationalization: Japanese, English, German, French, Korean, and Chinese.') },
      { type: 'new',    text: withIcons('Clear mitigations modal with three scopes: current phase, current plan, or all plans.') },
      { type: 'new',    text: withIcons('Clear custom actions: requires typing the plan name to confirm.') },
      { type: 'new',    text: withIcons('Passcode gate: optionally lock the app behind a passcode.') },
      { type: 'new',    text: withIcons('Session password protection for private shared sessions.') },
      { type: 'new',    text: withIcons('Session settings (maxHP, tankHP, encounter level) now sync across clients.') },
      { type: 'new',    text: withIcons('Host waiting state: joiners see a holding screen until the host connects.') },
      { type: 'change', text: withIcons('Improved mitigation grid table layout and readability.') },
    ],
  },
  {
    version: '1.1.0',
    date: 'May 9, 2026',
    title: 'Multi-Plan, OOBE & Firebase Sync',
    changes: [
      { type: 'new',    text: withIcons('Multiple plans supported via a tab bar: add, rename, and switch plans.') },
      { type: 'new',    text: withIcons('OOBE (first-run setup) screen to name your first encounter.') },
      { type: 'new',    text: withIcons('Custom phase management: add, rename, and delete phases.') },
      { type: 'new',    text: withIcons('Firebase real-time sync: share a session code to collaborate live.') },
      { type: 'new',    text: withIcons('Session code refresh dialog.') },
      { type: 'new',    text: withIcons('Share error banner when the sync session is unreachable.') },
      { type: 'fix',    text: withIcons('Echo loop prevention: remote updates no longer trigger a redundant push.') },
      { type: 'fix',    text: withIcons('Cell blocked logic now correctly accounts for cooldown coverage.') },
    ],
  },
  {
    version: '1.0.0',
    date: 'May 9, 2026',
    title: 'Initial Release',
    changes: [
      { type: 'new',    text: withIcons('Mitigation planner grid for FFXIV savage and ultimate raids.') },
      { type: 'new',    text: withIcons('Per-role and per-job mitigation tracking with toggle checkboxes.') },
      { type: 'new',    text: withIcons('Cooldown and effect coverage indicators on each cell.') },
      { type: 'new',    text: withIcons('Action editing modal: customize name, time, damage type, and damage value.') },
      { type: 'new',    text: withIcons('Encounter level filtering: skills not available at the selected level are hidden.') },
      { type: 'new',    text: withIcons('LB1/LB2 columns injected automatically when LB3 is present.') },
      { type: 'new',    text: withIcons('Custom action management: add actions beyond the base encounter data.') },
      { type: 'new',    text: withIcons('Git commit hash displayed in the footer.') },
    ],
  },
];

/** The version string users must have seen to suppress the modal. */
export const CURRENT_VERSION = CHANGELOG[0].version;
