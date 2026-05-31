# Rewritten Mitigation Planner

A collaborative FFXIV raid mitigation planner built with React, TypeScript, and Firebase. Plan and coordinate party mitigation cooldowns for high-end raid encounters in real time.

## Features

- **Mitigation grid** - Drag-and-drop skill assignments onto a timeline of raid mechanics
- **Real-time collaboration** - Share plans via link; multiple users can edit simultaneously through Firebase Firestore sync
- **Multi-plan tabs** - Manage multiple plans per session with named tabs
- **FFlogs import** - Pull encounter timelines directly from FFlogs reports
- **Macro export** - Generate in-game macro text from your plan
- **Skill database** - Browse all mitigation/healing skills with detailed stats
- **Multi-language** - UI available in JP, EN, DE, FR, KO, CN
- **Admin panel** - View and manage active sessions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| State | Zustand (persisted to localStorage) |
| Backend sync | Firebase Firestore (real-time onSnapshot) |
| API routes | Vercel serverless functions (`/api/`) |
| Admin server | Express (local dev on port 3001) |
| Package manager | pnpm |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable` or install globally)
- A Firebase project with Firestore enabled

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Starts the Vite dev server at `http://localhost:5173`.

### Build

```bash
pnpm build
```

Outputs production bundle to `dist/`.

### Lint

```bash
pnpm lint
```

## Project Structure

```
src/
├── App.tsx              # Main app shell, session/sync lifecycle
├── store.ts             # Zustand store (plans, settings, persist)
├── calc.ts              # Mitigation math
├── i18n.ts              # Translation strings
├── types.ts             # Shared TypeScript interfaces
├── components/          # UI components (grid, modals, dialogs)
├── data/                # Static data (skills.json, encounter data, changelog)
└── lib/                 # Firebase client, plan sync helpers
api/
├── _lib/               # Shared utils (auth, Firebase admin, OAuth state)
└── admin/              # Admin API routes (sessions, auth)
server/
└── src/index.ts        # Express admin server (local dev)
```

## Deployment

The app deploys to **Vercel**. The `vercel.json` configures SPA fallback routing and the `/api` directory is deployed as serverless functions automatically.

Firestore security rules are in `firestore.rules`.

## License

Private - not open source. Code is provided for viewing and research purposes only.
