# Board Game Answer System

Live demo: https://board-game-oclb.onrender.com

## Project Overview

Board Game Answer System is a realtime web companion for a physical board-game event. The physical board game provides the on-site experience, while this web app handles mobile room entry, answer submission, wrong-answer buzz-in, score synchronization and reflection rounds.

The project is designed for short live events with around 100 players and no long-term data retention requirement. It uses a custom Node.js server so Next.js and Socket.IO can run together on the same deployed service.

## Features

- Mobile-first player entry flow with a two-digit room code.
- Desktop portfolio landing page for demo and presentation.
- Realtime session synchronization with Socket.IO rooms.
- Unified gameplay screen for lobby, turn, question, buzz-in, scoring and reflection states.
- Server-side flow validation to prevent invalid actions, such as skipping a buzz-in window while it is open.
- Floating buzz-in UI optimized for phone use during a live event.
- In-memory session storage for simple single-event operation.
- Optional Redis-backed session storage through `REDIS_URL`.
- Render-ready deployment configuration.

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Node.js custom server
- Socket.IO server/client
- Redis client, optional through `REDIS_URL`
- Render Web Service

## Folder Structure

```txt
.
├── app/
│   ├── page.tsx              # Portfolio landing page and room entry
│   ├── session/page.tsx      # Unified gameplay screen
│   ├── lobby|play|question|reflect/
│   │   └── page.tsx          # Redirect routes into /session
│   ├── layout.tsx            # Root layout and metadata
│   └── globals.css           # Global styles
├── components/
│   ├── Toast.tsx             # Global toast message UI
│   └── ui/Button.tsx         # Shared button component
├── src/
│   ├── lib/questions.ts      # Question data loader
│   ├── realtime/events.ts    # Typed Socket.IO event contracts
│   ├── server/
│   │   ├── realtimeServer.ts # Socket.IO handlers and game-flow guards
│   │   └── mockSessionStore.ts # Session state, scoring, buzz-in and reflection logic
│   └── store/gameStore.ts    # Client socket connection and Zustand store
├── docs/
│   ├── README.md
│   ├── portfolio-case-study.md
│   ├── architecture.md
│   ├── demo-guide.md
│   └── deployment.md
├── server.ts                 # Custom Next.js + Socket.IO server entry
├── mockQuestions_with_penalty.json
├── S__4063236.jpg            # Mobile entry artwork
├── render.yaml               # Render deployment config
├── .env.example              # Optional Redis env example
└── package.json
```

## Setup / Install

Requirements:

- Node.js 20
- npm

Install dependencies:

```bash
npm install
```

Optional Redis setup:

```bash
cp .env.example .env
```

Then set `REDIS_URL` only if you need Redis-backed session storage. The default local and single-instance deployment mode does not require environment variables.

## Run Instructions

Development:

```bash
npm run dev
```

The local server binds to `0.0.0.0:3000`, so phones on the same LAN can open:

```txt
http://<host-ip>:3000
```

Production build:

```bash
npm run build
```

Production start:

```bash
npm start
```

Render deployment settings:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Runtime: Node 20
- Optional environment variable: `REDIS_URL`

## Game Flow

1. A player opens `/` from a mobile browser.
2. The mobile splash screen displays the event artwork and a transparent entry button over the image CTA.
3. The player enters a two-digit room code and joins the shared session.
4. The server places the socket in the matching Socket.IO room.
5. The game moves through lobby, turn selection, question answering, wrong-answer buzz-in, scoring and reflection.
6. Each accepted action updates the server-owned session state.
7. The server broadcasts a `session_snapshot` to all players in the same room.
8. Each client renders the latest synchronized game state.

## Known Issues / Future Improvements

- Current default state storage is in-memory. A redeploy or server restart will clear active rooms unless Redis is configured.
- Multiple Render instances should not be enabled without Redis-backed state and a Socket.IO Redis adapter.
- The current flow is optimized for short live events, not long-term account-based history.
- A host/admin control panel would make event operation easier.
- Result export, such as CSV or a dedicated ranking page, could improve post-event reporting.
- Hardware event integration could be added so the physical board-game device can trigger web actions directly.
