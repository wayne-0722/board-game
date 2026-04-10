# Portfolio Case Study: Board Game Answer System

## One-Line Summary

A mobile-first realtime answer and scoring system built to support a physical board-game event with shared rooms, synchronized game state, wrong-answer buzz-in and live scoring.

## Context

The physical board game provides the on-site activity and hardware interaction. This web system acts as the digital companion layer. Players use their phones to join a room, submit answers, react during buzz-in windows and follow score changes without installing an app.

The event target is around 100 players for a short activity. Long-term data retention is not required, so the system prioritizes realtime reliability, simple operations and low deployment overhead.

## Problem

Running the game manually creates several operational risks:

- The host must track room state, turn order, answer status and score changes at the same time.
- Wrong-answer buzz-in needs fast and fair synchronization across multiple phones.
- Players mainly use mobile devices, so controls must be reachable and visible during a live event.
- A public URL is required for event access, but the app still needs WebSocket support.

## Solution

The project uses a custom Node.js server that runs Next.js and Socket.IO together. The server owns the game session state and broadcasts snapshots to all players in the same room. The client uses Zustand to store the latest session snapshot and to send typed actions through Socket.IO.

The UI is mobile-first for actual players and includes a desktop portfolio landing page for presentation and testing.

## Key Features

- Room-based player join flow using a two-digit session code.
- Lobby, turn, question, buzz-in, scoring and reflection states.
- Server-side validation for game flow actions.
- Floating buzz-in UI optimized for phone use.
- Public deployment on Render as a Node Web Service.
- Optional Redis support through `REDIS_URL` for future persistence or scaling.

## Technical Highlights

- Socket.IO rooms keep all players in the same session synchronized.
- Server-side guards prevent invalid state transitions, such as advancing the turn while a buzz-in window is open.
- The app can run without a database for short live events, reducing setup and operational risk.
- Render deployment uses a custom start command instead of a static-only deployment, which is required for Socket.IO.

## My Contribution

- Built the Next.js player entry and session screens.
- Designed the Socket.IO client/server event flow.
- Implemented session state, scoring, buzz-in and reflection behavior.
- Fixed gameplay flow issues around wrong-answer buzz-in and reflection exit thresholds.
- Prepared the project for public deployment on Render.
- Cleaned the repository into a portfolio-ready structure.

## Result

The system can be opened from a public URL, supports mobile player entry, synchronizes state in realtime and keeps the core gameplay rules on the server. It demonstrates practical realtime application development, deployment judgment and mobile-first interaction design for an offline event.
