# Board Game Answer System

桌遊硬體配套的即時答題與計分系統。玩家使用手機瀏覽器加入同一場活動，系統負責房間同步、題目顯示、答題判定、錯答搶答、分數更新與回合推進。

## Tech Stack

- Next.js 14 + React + TypeScript
- Tailwind CSS
- Zustand client state
- Socket.IO realtime sync
- Node.js custom server
- In-memory session store, with optional Redis support via `REDIS_URL`
- Render Web Service deployment

## Main Flow

1. 玩家進入 `/`，手機版顯示活動入口圖，電腦版直接顯示測試/加入頁。
2. 玩家輸入房號加入活動。
3. `/session` 統一處理 lobby、答題、搶答、反思與結算流程。
4. Socket.IO 將 session state 推送給同房間玩家。
5. 錯答時開啟搶答視窗，避免原答題者直接跳過搶答流程。

## Project Structure

- `server.ts` - custom Next.js + Socket.IO server entry
- `src/server/realtimeServer.ts` - realtime event handling and game flow guards
- `src/server/mockSessionStore.ts` - session state, scoring, buzz and reflection logic
- `src/store/gameStore.ts` - client socket connection and Zustand store
- `app/page.tsx` - join entry page
- `app/session/page.tsx` - unified gameplay page
- `src/lib/questions.ts` - question loader
- `mockQuestions_with_penalty.json` - question data
- `docs/board-game-answer-system-report.md` - portfolio technical report

## Local Development

```bash
npm install
npm run dev
```

The development server binds to `0.0.0.0:3000`, so mobile devices on the same LAN can open `http://<host-ip>:3000`.

## Production

```bash
npm run build
npm start
```

Render can use:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Environment: Node 20
- Optional env var: `REDIS_URL`, only needed if session persistence or multiple instances are required

For a single short event without data retention, one Render instance with in-memory session state is enough. Do not scale to multiple instances unless Redis and a Socket.IO adapter are added.
