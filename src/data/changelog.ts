export type ChangeType = 'new' | 'fix' | 'change' | 'remove';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: { type: ChangeType; text: string }[];
}

/**
 * Changelog entries — newest first.
 * To publish an update: prepend a new entry and bump the version string.
 * Any user whose lastSeenVersion differs from CHANGELOG[0].version will see
 * the modal automatically on next load.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: 'May 21, 2026',
    title: 'Changelog & Plan Safety',
    changes: [
      { type: 'new',    text: 'Added this changelog — shows automatically whenever the app updates.' },
      { type: 'new',    text: 'Closing a plan now requires typing its name to confirm, preventing accidental deletion.' },
    ],
  },
];

/** The version string users must have seen to suppress the modal. */
export const CURRENT_VERSION = CHANGELOG[0].version;
