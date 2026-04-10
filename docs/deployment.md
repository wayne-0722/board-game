# Deployment Notes

## Render Settings

- Service type: Web Service
- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Node version: 20
- Health check path: `/`

The repository also includes `render.yaml` for service configuration.

## Environment Variables

Required:

- None for the default single-instance in-memory setup.

Optional:

- `REDIS_URL` enables Redis-backed session storage.

Do not manually set `PORT` on Render. Render provides the port value and the app reads it from `process.env.PORT`.

## Scaling Guidance

For one short event with around 100 players and no data retention requirement, one paid Render instance is enough.

Do not enable multiple instances unless the app is updated with:

- Redis-backed session storage.
- Socket.IO Redis adapter for cross-instance room broadcasts.
- A tested reconnect and recovery plan.

## Verification Checklist

- `npm run build` passes locally.
- `/` returns the portfolio landing page.
- `/session` loads without a compile error.
- `/socket.io/?EIO=4&transport=polling` returns a Socket.IO handshake response.
- Two browsers can join the same room and receive shared state updates.
