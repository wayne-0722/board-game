# Board Turn Mock

Mobile-first Next.js 14 prototype for a turn-based anti-fraud quiz flow. Uses Tailwind CSS, TypeScript, and Zustand with localStorage persistence (session code + player info).

## Scripts

- `npm install`
- `npm run dev` — start app router dev server
- `npm run build` — production build
- `npm start` — start built app

## Routes

- `/` join with short session code
- `/lobby` waiting room, confirm seat, start when 2+ confirmed
- `/play` turn control + question lock flow
- `/question` answer + explanation + handoff

Mock data lives in `src/lib/questions.ts` and state in `src/store/gameStore.ts`. API placeholders: `src/services/api.ts`.

## Mock backend (in-memory)
- Simple Next.js API routes under `app/api/session/*` keep session state in-memory.
- Run `npm run dev` on one machine; other devices on the same LAN can join via that dev server host/IP with the same session code to share state.
