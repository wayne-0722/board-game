# Architecture

## System Overview

```txt
Mobile players
  -> HTTPS / Socket.IO
  -> Render Web Service
  -> Node.js custom server
  -> Next.js app + Socket.IO server
  -> In-memory session store
```

The web application is deployed as a Node service instead of a static site because the project requires Socket.IO connections and server-owned session state.

## Main Components

- `server.ts` starts the custom HTTP server, mounts Next.js and initializes Socket.IO.
- `src/server/realtimeServer.ts` handles Socket.IO events, room membership and game action validation.
- `src/server/mockSessionStore.ts` owns session state, scoring rules, buzz-in rules and reflection state.
- `src/realtime/events.ts` defines the typed client/server event contract.
- `src/store/gameStore.ts` manages the client socket connection and latest session snapshot.
- `app/page.tsx` provides the portfolio landing page and room entry flow.
- `app/session/page.tsx` provides the unified gameplay interface.

## Realtime Flow

```txt
Player action
  -> client emits Socket.IO event
  -> server validates actor and current session state
  -> server updates session
  -> server broadcasts `session_snapshot`
  -> all clients render the new state
```

This flow keeps the server as the source of truth. The client does not decide whether a turn can advance or whether a player can answer. It only sends an action request.

## Session Storage

The default storage is in-memory. This is intentional for the current event model:

- Around 100 players.
- Short event duration.
- No long-term data retention requirement.
- One Render instance.

Redis support is available through `REDIS_URL`, but scaling to multiple instances should also add a Socket.IO Redis adapter so room broadcasts and state access stay consistent.

## Important Constraints

- Do not redeploy during a live event if using in-memory sessions, because active rooms will be lost.
- Do not run multiple Render instances without Redis-backed state and Socket.IO adapter support.
- Keep critical game rules on the server, not only in the React UI.
