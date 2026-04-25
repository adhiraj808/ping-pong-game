# 🏓 Pong Game - Online Multiplayer Edition

A modern, high-performance Pong game featuring Online Multiplayer, Local PvP, and AI modes. Built with pure JavaScript, HTML5 Canvas, and WebSockets for real-time competitive gameplay.

## 🚀 Features

- 🌐 **Online Multiplayer**: Host or join rooms using unique 4-digit codes via WebSockets.
- 👥 **Local PvP**: Play with a friend on the same device.
- 🤖 **AI Opponent**: Three difficulty levels (Easy, Medium, Hard) to test your skills.
- 🏆 **Customizable Matches**: Set custom match points (5, 10, 15, or any custom value).
- 📱 **Mobile Optimized**: Responsive design with intuitive touch zones and PWA support.
- 🌈 **Modern UI**: Neon aesthetics with smooth animations, Orbitron typography, and interactive feedback.
- ⚡ **Real-time Performance**: Optimized WebSocket relay for low-latency online play.

## 🎮 How to Play

### Local Play
1. Open `client/index.html` in your browser.
2. Select **Local PvP** or **Play vs AI**.
3. **Controls**:
   - **Player 1 (Left)**: `W` (Up) / `S` (Down)
   - **Player 2 (Right)**: `↑` (Up) / `↓` (Down)
   - **Mobile**: Touch the left side for Player 1, right side for Player 2.

### Online Multiplayer
1. **Start the Server**:
   ```bash
   npm install
   npm start
   ```
   The server runs on `ws://localhost:3000`.
2. **Open the Game**: Open `client/index.html` on two different devices or tabs.
3. **Host**: Click **Host Online**, and share the generated 4-digit code.
4. **Join**: Click **Join Online**, enter the code provided by the host.

## 🛠️ Technical Stack

- **Frontend**: HTML5 Canvas, Vanilla JavaScript (ES6+), CSS3 (Flexbox/Grid).
- **Backend**: Node.js with `ws` (WebSockets) for game state synchronization.
- **Design**: Responsive layout, PWA manifest, and Google Fonts (Orbitron).

## 📂 Project Structure

```text
├── client/
│   ├── index.html      # Game UI & structure
│   ├── style.css       # Neon aesthetics & animations
│   ├── script.js       # Core game engine & networking
│   └── assets/         # Icons & PWA manifest
├── server/
│   └── server.js       # WebSocket relay server
├── package.json        # Dependencies & start scripts
└── README.md           # Documentation
```

## 📜 License
This project is licensed under the ISC License.
