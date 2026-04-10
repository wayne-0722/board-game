# Board Game Answer System

A portfolio-ready realtime answer and scoring system built for a physical board-game event. Players join from mobile browsers, share a room, answer questions, trigger buzz-in windows after wrong answers, and receive synchronized score updates.

Live demo: https://board-game-oclb.onrender.com

## What This Project Shows

- Mobile-first UX for an offline tabletop activity.
- Realtime multi-player synchronization with Socket.IO rooms.
- Server-side game-flow guards for turn ownership, answer submission, buzz-in and reflection exit.
- Render deployment using a custom Node.js server for WebSocket support.
- A simple session model that fits short live events without long-term data retention.

## Tech Stack

- Next.js 14, React 18, TypeScript
- Tailwind CSS
- Zustand client store
- Node.js custom server
- Socket.IO server/client
- In-memory session store, with optional Redis support through `REDIS_URL`
- Render Web Service

## Core Flow

1. A player opens `/` on a mobile browser.
2. The mobile splash screen displays the event artwork and a transparent entry button over the image CTA.
3. The player enters a two-digit room code and joins `/session`.
4. The server broadcasts session snapshots to everyone in the same Socket.IO room.
5. Players move through lobby, turn selection, question answering, wrong-answer buzz-in, scoring and reflection.
6. Server-side guards prevent invalid actions, such as skipping the buzz window while it is open.

## Project Structure

- `server.ts` - custom Next.js and Socket.IO server entry.
- `src/server/realtimeServer.ts` - Socket.IO event handlers and action validation.
- `src/server/mockSessionStore.ts` - session state, scoring, buzz-in and reflection rules.
- `src/store/gameStore.ts` - client socket connection and Zustand state.
- `src/realtime/events.ts` - typed client/server realtime contracts.
- `app/page.tsx` - portfolio landing page and room entry.
- `app/session/page.tsx` - unified gameplay screen.
- `src/lib/questions.ts` - question loader.
- `mockQuestions_with_penalty.json` - question data.
- `docs/board-game-answer-system-report.md` - portfolio technical report.

## Local Development

```bash
npm install
npm run dev
```

The local server binds to `0.0.0.0:3000`, so phones on the same LAN can open `http://<host-ip>:3000`.

## Production Build

```bash
npm run build
npm start
```

Render settings:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Runtime: Node 20
- Optional env var: `REDIS_URL`

For one short event with around 100 players and no data retention requirement, one Render instance with in-memory state is enough. Do not scale to multiple instances unless Redis and a Socket.IO adapter are added.
