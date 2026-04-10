# Demo Guide

## Live Demo

Public URL: https://board-game-oclb.onrender.com

## Suggested Demo Script

1. Open the live URL on desktop to show the portfolio landing page.
2. Open the same URL on a phone to show the mobile-first entry screen.
3. Enter a two-digit room code, for example `12`.
4. Join the same room from a second browser or phone.
5. Show that the session state is shared through Socket.IO.
6. Walk through the gameplay flow: lobby, start game, answer question, wrong-answer buzz-in, score update and reflection.

## What To Explain During The Demo

- The physical board game is the main activity; this app is the realtime answer and scoring layer.
- Socket.IO is used because players need immediate state updates without polling.
- The server owns the game rules, so invalid actions are rejected even if a button appears on one client.
- In-memory state is enough for the current requirement because the event does not need long-term data retention.

## Known Operational Notes

- First load on Render may take longer if the service has been idle.
- Active rooms are not preserved across redeploys unless Redis is configured.
- For a real event, use one paid Render instance and avoid deploying while the activity is running.
