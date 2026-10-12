# Mr Pryer Maths V7.4 Cosmos — Render Multiplayer Server

This folder contains the V7.4 Cosmos Enhanced Edition HTML game plus a Node.js WebSocket server for two-player multiplayer lobbies. The app and server are designed for Render Web Services.

## Deploy to Render

1. Upload the **contents of this folder** to the root of a GitHub repository. The repository root must contain `package.json`, `server.js`, `README.md`, and `public/index.html`. Do not upload an extra parent folder around them.
2. In Render choose **New + → Web Service** and connect the repository.
3. Set **Root Directory** to blank if the files are at repository root.
4. Use **Build Command** `npm install` and **Start Command** `npm start`. Use Node 18 or newer.
5. Deploy and open the HTTPS URL Render provides. The game auto-fills the WebSocket address as `wss://YOUR-SERVICE.onrender.com/ws`. Keep the `/ws` path.
6. Open the game on both devices. The Commander hosts and shares the six-character code; the other player joins as a Pilot.

## Multiplayer Alpha features

- Commander/Pilot names, lobby screen and six-character room codes.
- Two-player crew manifest, live session leaderboard and lobby chat.
- Commander host panel with Co-op/Versus mode and a mischief toggle.
- Launch control, support action (makes the next hint free), and cooldown-limited harmless prank actions (question shake, five-second Time Attack penalty, or five-coin prank).
- Session score updates from local XP/correct-answer stats and an in-game sidebar leaderboard.
- `/health` status endpoint and `/ws` secure WebSocket endpoint (TLS is provided by Render).

## Alpha limitations

This is a real multiplayer lobby/action layer, but **the maths campaign is still mostly local to each browser**. The leaderboard receives score reports; it does not yet enforce one shared authoritative question/answer stream, synchronise lives/level progression, or provide a permanent worldwide ranking. Room state is in memory, so rooms disappear when the server restarts or the Commander disconnects. A Render free instance may sleep when idle, so its first request can take a little while.

## Health check

Visit `https://YOUR-SERVICE.onrender.com/health`. A healthy server returns JSON with `ok: true`, the alpha service name, room count, and connected client count.
