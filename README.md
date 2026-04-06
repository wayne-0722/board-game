# Board Turn Mock

Socket.IO based Next.js 14 prototype for a turn-based anti-fraud quiz flow.

## Scripts

- `npm install`
- `npm run dev` starts the custom server with Next.js and Socket.IO
- `npm run build` builds the Next.js app
- `npm start` starts the production server

## Routes

- `/` join a room with a 2-digit session code
- `/session` unified room flow for lobby, play, question, and reflection
- `/lobby`, `/play`, `/question`, `/reflect` redirect to `/session`

## Realtime flow

- Server entry: `server.ts`
- Socket.IO server: `src/server/realtimeServer.ts`
- Session state: `src/server/mockSessionStore.ts`
- Client store: `src/store/gameStore.ts`

## LAN usage

- The server binds to `0.0.0.0:3000`
- Devices on the same LAN can open `http://<host-ip>:3000`
- Example on this machine: `http://192.168.0.102:3000`

## Notes

- Legacy HTTP API backups are stored under `legacy_disabled/`
- Mock questions live in `src/lib/questions.ts` and `mockQuestions_with_penalty.json`
