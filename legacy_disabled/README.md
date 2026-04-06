Legacy HTTP session routes and client were moved here to disable them at runtime.

- `http_api_backup/`: old `app/api/session/*` routes
- `http_client_backup/`: old `src/services/api.ts`

The active multiplayer flow is now Socket.IO driven through the realtime server and zustand store.
