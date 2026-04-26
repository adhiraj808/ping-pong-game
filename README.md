# 🏓 Pong Game - Online Multiplayer Edition

A modern, high-performance Pong game featuring Online Multiplayer, Local PvP, and AI modes. Built with pure JavaScript, HTML5 Canvas, and WebSockets for real-time competitive gameplay.

## 🚀 Features

- 🌐 **Online Multiplayer**: Host or join rooms using 4-digit codes
- 👥 **Local PvP**: Play with a friend on the same device
- 🤖 **AI Opponent**: Three difficulty levels (Easy, Medium, Hard)
- 📱 **Mobile Optimized**: Responsive design with intuitive touch controls
- 🌈 **Modern UI**: Neon aesthetics with smooth animations and transitions
- ⚡ **Low Latency**: Optimized WebSocket communication for online play

## 🎮 How to Play

### Local Play
1. Start the app with `npm start`.
2. Open `http://localhost:3000` in your browser.
3. Select **Local PvP** or **Play vs AI**.
4. Controls:
   - **Player 1 (Left)**: `W` (Up) / `S` (Down)
   - **Player 2 (Right)**: `↑` (Up) / `↓` (Down)

### Online Multiplayer
1. Start the multiplayer server:
   ```bash
   npm start
   ```
2. Open `http://localhost:3000` on two different tabs or devices on your network.
3. **To Host**: Click **Host Online**, share the 4-digit code.
4. **To Join**: Click **Join Online**, enter the code.

## 🛠️ Technical Setup

### Installation
```bash
npm install
```

### Running the Server
```bash
npm start
```

## 🚢 Deployment

### Recommended: Render Web Service
Use Render as a **Web Service** so the Node server and WebSocket multiplayer run in the same long-lived process.

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/healthz`
- Node Version: `18` or newer

### Vercel Note
Vercel is a good fit for static frontends, but this project uses a custom long-running Node WebSocket server. If you deploy this exact app to Vercel, the static UI can load, but online multiplayer will need an external realtime provider or a separate WebSocket server.

### Vercel Frontend + Render Backend
For Vercel, deploy this repo as the frontend and deploy the same repo separately on Render as the WebSocket backend.

1. Deploy backend on Render as a Web Service.
2. Copy the Render URL, for example `https://your-pong-server.onrender.com`.
3. In Vercel, add an environment variable:
   ```text
   PONG_WS_URL=wss://your-pong-server.onrender.com
   ```
4. In Vercel project settings, use:
   ```text
   Build Command: npm run build:vercel
   Output Directory: .
   ```
5. Deploy. The Vercel frontend will use `client/config.js` to connect online multiplayer to the Render WebSocket server.

## 📂 Project Structure

```text
├── client/
│   ├── index.html      # Main game entry point
│   ├── style.css       # Styles and animations
│   ├── script.js       # Core game logic
│   └── manifest.json   # PWA manifest
├── server/
│   └── server.js       # WebSocket relay server
└── package.json        # Dependencies and scripts
```

## 📜 License
MIT License
