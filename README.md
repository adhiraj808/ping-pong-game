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
1. Open `client/index.html` in your browser.
2. Select **Local PvP** or **Play vs AI**.
3. Controls:
   - **Player 1 (Left)**: `W` (Up) / `S` (Down)
   - **Player 2 (Right)**: `↑` (Up) / `↓` (Down)

### Online Multiplayer
1. Start the multiplayer server:
   ```bash
   npm start
   ```
2. Open `client/index.html` on two different devices/tabs.
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

## 📂 Project Structure

```text
├── client/
│   ├── index.html      # Main game entry point
│   ├── style.css       # Styles and animations
│   ├── script.js       # Core game logic
│   └── assets/         # Favicon and PWA manifest
├── server/
│   └── server.js       # WebSocket relay server
└── package.json        # Dependencies and scripts
```

## 📜 License
MIT License
