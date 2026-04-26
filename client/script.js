// Enhanced Pong with Online Multiplayer (Host/Join), Local PvP/AI, and Bug Fixes

// -------------------------------
// Config
// -------------------------------
function getWebSocketUrl() {
    const configuredUrl = window.PONG_CONFIG?.wsUrl || window.PONG_WS_URL;

    if (configuredUrl && configuredUrl.trim()) {
        return normalizeWebSocketUrl(configuredUrl.trim());
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    return `${protocol}//${host}`;
}

function normalizeWebSocketUrl(url) {
    if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`;
    if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`;
    if (url.startsWith('ws://') || url.startsWith('wss://')) return url;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url}`;
}

const CONFIG = {
    canvasDesktop: { w: 800, h: 400 },
    paddle: { width: 10, height: 100, speed: 8 },
    ball: { size: 10, speed: 5 },
    ai: {
        profiles: {
            easy: { speed: 0.52, deadZone: 28, errorPct: 0.18, recovery: 0.2 },
            medium: { speed: 0.78, deadZone: 16, errorPct: 0.09, recovery: 0.45 },
            hard: { speed: 1.04, deadZone: 7, errorPct: 0.025, recovery: 0.75 }
        }
    },
    serverUrl: getWebSocketUrl()
};

// -------------------------------
// State
// -------------------------------
const state = {
    mode: '', // 'Player' | 'AI' | 'Online'
    aiDifficulty: 'medium',
    matchPoint: 10,
    isRunning: false,
    isPaused: false,
    p1Score: 0,
    p2Score: 0,
    canvas: null,
    ctx: null,
    p1: null,
    p2: null,
    ball: null,
    animationFrameId: null,
    activePointers: new Map(),
    keys: { w: false, s: false, ArrowUp: false, ArrowDown: false },
    online: {
        ws: null,
        isHost: false,
        roomCode: '',
        connected: false,
        opponentJoined: false
    }
};

// -------------------------------
// Init
// -------------------------------
document.addEventListener('DOMContentLoaded', () => {
    state.canvas = document.getElementById('gameCanvas');
    state.ctx = state.canvas.getContext('2d');
    setCanvasSize();
    initObjects();
    initUIEvents();
    initInput();
    applyMobileOptimizations();
});

function setCanvasSize() {
    const previousWidth = state.canvas.width || CONFIG.canvasDesktop.w;
    const previousHeight = state.canvas.height || CONFIG.canvasDesktop.h;
    const viewportWidth = getViewportWidth();
    const viewportHeight = getViewportHeight();
    const touchLayout = isTouchDevice();
    const landscape = viewportWidth > viewportHeight;
    const maxWidth = Math.min(CONFIG.canvasDesktop.w, Math.max(280, viewportWidth - 32));
    const maxHeight = touchLayout
        ? Math.max(150, viewportHeight * (landscape ? 0.48 : 0.34))
        : Math.min(CONFIG.canvasDesktop.h, Math.max(220, viewportHeight * 0.52));
    const width = Math.min(maxWidth, maxHeight * 2);

    state.canvas.width = Math.round(width);
    state.canvas.height = Math.round(width / 2);

    if (state.p1 && state.p2 && state.ball) {
        scaleObjects(previousWidth, previousHeight);
    }
}

function initObjects() {
    const paddleWidth = getPaddleWidth();
    const paddleHeight = getPaddleHeight();
    state.p1 = { x: 0, y: state.canvas.height / 2 - paddleHeight / 2, w: paddleWidth, h: paddleHeight };
    state.p2 = { x: state.canvas.width - paddleWidth, y: state.canvas.height / 2 - paddleHeight / 2, w: paddleWidth, h: paddleHeight };
    state.ball = { x: state.canvas.width / 2, y: state.canvas.height / 2, dx: getBallSpeed(), dy: getBallSpeed(), r: getBallRadius() };
}

function scaleObjects(previousWidth, previousHeight) {
    const xRatio = state.canvas.width / previousWidth;
    const yRatio = state.canvas.height / previousHeight;
    const paddleWidth = getPaddleWidth();
    const paddleHeight = getPaddleHeight();
    const ballRadius = getBallRadius();
    const ballSpeed = getBallSpeed();

    state.p1.w = paddleWidth;
    state.p2.w = paddleWidth;
    state.p1.h = paddleHeight;
    state.p2.h = paddleHeight;
    state.p1.y = clamp(state.p1.y * yRatio, 0, state.canvas.height - state.p1.h);
    state.p2.x = state.canvas.width - state.p2.w;
    state.p2.y = clamp(state.p2.y * yRatio, 0, state.canvas.height - state.p2.h);
    state.ball.x = clamp(state.ball.x * xRatio, 0, state.canvas.width);
    state.ball.y = clamp(state.ball.y * yRatio, 0, state.canvas.height);
    state.ball.r = ballRadius;
    state.ball.dx = Math.sign(state.ball.dx || 1) * ballSpeed;
    state.ball.dy = Math.sign(state.ball.dy || 1) * ballSpeed;
}

function getPaddleWidth() {
    return Math.round(clamp(state.canvas.width * 0.014, 8, 12));
}

function getPaddleHeight() {
    return Math.round(Math.min(CONFIG.paddle.height, Math.max(54, state.canvas.height * 0.28)));
}

function getPaddleSpeed() {
    return clamp(state.canvas.height * 0.022, 5, 9);
}

function getBallRadius() {
    return Math.round(clamp(state.canvas.width * 0.0125, 6, CONFIG.ball.size));
}

function getBallSpeed() {
    return clamp(state.canvas.width * 0.007, 3.5, CONFIG.ball.speed);
}

// -------------------------------
// UI / Events
// -------------------------------
function initUIEvents() {
    byId('vsAI', el => el.addEventListener('click', () => showModal('difficultyModal')));
    byId('vsPlayer', el => el.addEventListener('click', () => startGame('Player')));
    byId('hostGame', el => el.addEventListener('click', hostOnlineGame));
    byId('joinGame', el => el.addEventListener('click', joinOnlineGame));
    byId('confirmJoinBtn', el => el.addEventListener('click', confirmJoinRoom));
    byId('cancelOnline', el => el.addEventListener('click', cancelOnlineSetup));
    byId('playAgainBtn', el => el.addEventListener('click', () => { hideModal('gameOverModal'); restartGame(); }));
    byId('backToMenuBtn', el => el.addEventListener('click', () => { hideModal('gameOverModal'); resetGame(); }));

    byId('matchPoint', el => el.addEventListener('change', (e) => {
        const customInput = document.getElementById('customMatchPoint');
        if (e.target.value === 'custom') {
            customInput.classList.remove('hidden');
        } else {
            customInput.classList.add('hidden');
        }
    }));

    // Custom match point input handler
    byId('customMatchPoint', el => el.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 10;
        if (val > 0 && val <= 99) {
            document.getElementById('matchPoint').value = 'custom';
        }
    }));

    document.querySelectorAll('.difficulty-buttons button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const diff = e.currentTarget.dataset.difficulty || 'medium';
            hideModal('difficultyModal');
            startGame('AI', diff);
        });
    });

    byId('cancelDifficulty', el => el.addEventListener('click', () => hideModal('difficultyModal')));
    byId('homeBtn', el => el.addEventListener('click', quitToMenu));
    byId('pauseBtn', el => el.addEventListener('click', togglePause));
    byId('restartBtn', el => el.addEventListener('click', restartGame));

    window.addEventListener('resize', debounce(() => {
        setCanvasSize();
        draw();
    }, 120));
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', debounce(() => {
            setCanvasSize();
            draw();
        }, 120));
    }
}

function initInput() {
    document.addEventListener('keydown', (e) => {
        if (e.key in state.keys) {
            state.keys[e.key] = true;
            // Prevent arrow keys and space from scrolling the page
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
        }
        if (e.key === 'Escape') togglePause();
    });
    document.addEventListener('keyup', (e) => {
        if (e.key in state.keys) state.keys[e.key] = false;
    });

    byId('leftTouchZone', zone => initZonePointerControls(zone, 'left'));
    byId('rightTouchZone', zone => initZonePointerControls(zone, 'right'));
    byId('gameCanvas', canvas => initCanvasPointerControls(canvas));
}

function initZonePointerControls(zone, side) {
    zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        zone.setPointerCapture(e.pointerId);
        handleZonePointer(e, side);
        zone.classList.add('is-pressed');
    });
    zone.addEventListener('pointermove', (e) => {
        if (e.pressure === 0 && e.pointerType !== 'mouse') return;
        handleZonePointer(e, side);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(eventName => {
        zone.addEventListener(eventName, () => {
            handleZoneEnd(side);
            zone.classList.remove('is-pressed');
        });
    });
}

function handleZonePointer(e, side) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top; const H = rect.height;
    const up = y < H * 0.4, down = y > H * 0.6;
    if (side === 'left') { state.keys.w = up; state.keys.s = down; }
    else if (state.mode !== 'AI') { state.keys.ArrowUp = up; state.keys.ArrowDown = down; }
}
function handleZoneEnd(side) {
    if (side === 'left') { state.keys.w = false; state.keys.s = false; }
    else { state.keys.ArrowUp = false; state.keys.ArrowDown = false; }
    const z = document.getElementById(side === 'left' ? 'leftTouchZone' : 'rightTouchZone');
    if (z) z.style.transform = 'scale(1)';
}

function initCanvasPointerControls(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
        if (!state.isRunning || state.isPaused) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const side = getCanvasPointerSide(e);
        state.activePointers.set(e.pointerId, side);
        movePaddleToPointer(side, e.clientY);
    });

    canvas.addEventListener('pointermove', (e) => {
        const side = state.activePointers.get(e.pointerId);
        if (!side || !state.isRunning || state.isPaused) return;
        e.preventDefault();
        movePaddleToPointer(side, e.clientY);
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(eventName => {
        canvas.addEventListener(eventName, (e) => {
            state.activePointers.delete(e.pointerId);
        });
    });
}

function getCanvasPointerSide(e) {
    const rect = state.canvas.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
}

function movePaddleToPointer(side, clientY) {
    const paddle = side === 'left' ? state.p1 : state.p2;

    if (!paddle || !canControlSide(side)) return;

    const rect = state.canvas.getBoundingClientRect();
    const canvasY = ((clientY - rect.top) / rect.height) * state.canvas.height;
    paddle.y = clamp(canvasY - paddle.h / 2, 0, state.canvas.height - paddle.h);
}

function canControlSide(side) {
    if (state.mode === 'AI') return side === 'left';
    if (state.mode === 'Online') return state.online.isHost ? side === 'left' : side === 'right';
    return true;
}

// -------------------------------
// Online Logic
// -------------------------------
function initWebSocket() {
    return new Promise((resolve, reject) => {
        if (state.online.ws) state.online.ws.close();
        state.online.ws = new WebSocket(CONFIG.serverUrl);
        state.online.ws.onopen = () => {
            state.online.connected = true;
            resolve();
        };
        state.online.ws.onerror = (err) => reject(err);
        state.online.ws.onmessage = handleServerMessage;
        state.online.ws.onclose = () => {
            state.online.connected = false;
            if (state.isRunning && state.mode === 'Online') {
                alert('Connection lost');
                resetGame();
            }
        };
    });
}

function handleServerMessage(ev) {
    let msg;

    try {
        msg = JSON.parse(ev.data);
    } catch (err) {
        console.warn('Ignoring invalid server message', err);
        return;
    }

    switch (msg.type) {
        case 'hosted':
            state.online.roomCode = msg.code;
            byId('displayRoomCode', el => el.textContent = msg.code);
            byId('onlineModalStatus', el => el.textContent = 'Waiting for opponent...');
            break;
        case 'joined':
            state.online.roomCode = msg.code;
            state.online.opponentJoined = true;
            startGame('Online');
            break;
        case 'playerJoined':
            state.online.opponentJoined = true;
            startGame('Online');
            break;
        case 'state':
            if (!state.online.isHost) {
                state.p1.y = msg.p1Y;
                state.ball.x = msg.ball.x;
                state.ball.y = msg.ball.y;
                state.p1Score = msg.score.p1;
                state.p2Score = msg.score.p2;
                updScore();
            }
            break;
        case 'input':
            if (state.online.isHost) {
                state.p2.y = msg.p2Y;
            }
            break;
        case 'disconnected':
            alert('Opponent disconnected');
            resetGame();
            break;
        case 'error':
            alert(msg.message);
            cancelOnlineSetup();
            break;
    }
}

async function hostOnlineGame() {
    try {
        resetOnlineState();
        showModal('onlineModal');
        byId('onlineModalStatus', el => el.textContent = 'Connecting to server...');
        byId('hostSection', el => el.classList.remove('hidden'));
        byId('joinSection', el => el.classList.add('hidden'));
        state.online.isHost = true;
        await initWebSocket();
        sendOnline({ type: 'host' });
    } catch (e) {
        alert('Could not connect to server. Make sure server.js is running.');
        cancelOnlineSetup();
    }
}

async function joinOnlineGame() {
    try {
        resetOnlineState();
        showModal('onlineModal');
        byId('roomCodeInput', el => el.value = ''); // Clear previous code
        byId('onlineModalStatus', el => el.textContent = 'Connecting to server...');
        byId('joinSection', el => el.classList.remove('hidden'));
        byId('hostSection', el => el.classList.add('hidden'));
        state.online.isHost = false;
        await initWebSocket();
        byId('onlineModalStatus', el => el.textContent = 'Ready to join');
    } catch (e) {
        alert('Could not connect to server.');
        cancelOnlineSetup();
    }
}

function confirmJoinRoom() {
    const code = document.getElementById('roomCodeInput').value.trim();
    if (!/^\d{4}$/.test(code)) return alert('Enter a 4-digit numeric code');
    sendOnline({ type: 'join', code });
}

function cancelOnlineSetup() {
    if (state.online.ws) {
        state.online.ws.close();
        state.online.ws = null;
    }
    resetOnlineState();
    hideModal('onlineModal');
}

function resetOnlineState() {
    state.online.roomCode = '';
    state.online.connected = false;
    state.online.opponentJoined = false;
}

function sendOnline(payload) {
    const ws = state.online.ws;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (state.mode === 'Online') {
            alert('Connection lost');
            resetGame();
        }
        return false;
    }

    try {
        ws.send(JSON.stringify(payload));
        return true;
    } catch (err) {
        console.warn('WebSocket send failed', err);
        if (state.mode === 'Online') {
            alert('Connection lost');
            resetGame();
        }
        return false;
    }
}

// -------------------------------
// Game flow
// -------------------------------
function startGame(mode, diff = 'medium') {
    state.mode = mode;
    state.aiDifficulty = diff;

    state.matchPoint = getSelectedMatchPoint();

    state.isRunning = true;
    state.isPaused = false;
    state.p1Score = 0;
    state.p2Score = 0;
    hideModal('onlineModal');
    hideModal('difficultyModal');
    byId('menu', el => el.classList.add('hidden'));
    byId('gameUI', el => el.classList.remove('hidden'));
    document.body.classList.add('game-active');

    setCanvasSize();
    initObjects();
    updScore();

    let modeText = 'Local PvP';
    if (mode === 'AI') modeText = `Player vs AI (${uc(diff)})`;
    if (mode === 'Online') modeText = `Online: ${state.online.isHost ? 'Host' : 'Client'} (Room ${state.online.roomCode})`;
    byId('gameModeDisplay', el => el.textContent = modeText);

    startLoop();
}

function togglePause() {
    if (state.mode === 'Online') return; // Cannot pause online games easily
    state.isPaused = !state.isPaused;
    byId('pauseBtn', el => {
        el.innerHTML = `<span class="btn-icon">${state.isPaused ? '▶️' : '⏸️'}</span>`;
        el.title = state.isPaused ? 'Resume Game' : 'Pause Game';
    });
    if (!state.isPaused) startLoop();
}

function restartGame() {
    if (state.mode === 'Online') return;
    state.p1Score = 0;
    state.p2Score = 0;
    updScore();
    initObjects();
    state.isRunning = true;
    state.isPaused = false;
    byId('pauseBtn', el => el.innerHTML = '<span class="btn-icon">⏸️</span>');
    startLoop();
}

function quitToMenu() {
    resetGame();
}

function resetGame() {
    state.isRunning = false;
    state.isPaused = false;
    stopLoop();
    if (state.online.ws) {
        state.online.ws.close();
        state.online.ws = null;
    }
    resetOnlineState();
    resetKeys();
    state.activePointers.clear();
    state.mode = '';
    document.body.classList.remove('game-active');
    byId('pauseBtn', el => {
        el.innerHTML = '<span class="btn-icon">⏸️</span>';
        el.title = 'Pause';
    });
    hideModal('gameOverModal');
    hideModal('difficultyModal');
    hideModal('onlineModal');
    byId('gameUI', el => el.classList.add('hidden'));
    byId('menu', el => el.classList.remove('hidden'));
}

function startLoop() {
    stopLoop();
    loop();
}

function stopLoop() {
    if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
}

function loop() {
    if (!state.isRunning || state.isPaused) {
        state.animationFrameId = null;
        return;
    }
    update();
    draw();
    state.animationFrameId = requestAnimationFrame(loop);
}

function update() {
    const c = state.canvas, p1 = state.p1, p2 = state.p2, b = state.ball;

    // Local input handling
    if (state.mode === 'Online') {
        if (state.online.isHost) {
            handlePaddleMove(p1, state.keys.w, state.keys.s);
            updateBallPhysics();
            // Send state to client
            sendOnline({
                type: 'state',
                p1Y: p1.y,
                ball: { x: b.x, y: b.y },
                score: { p1: state.p1Score, p2: state.p2Score }
            });
        } else {
            handlePaddleMove(p2, state.keys.ArrowUp, state.keys.ArrowDown);
            // Send input to host
            sendOnline({
                type: 'input',
                p2Y: p2.y
            });
        }
    } else {
        // Local or AI mode
        handlePaddleMove(p1, state.keys.w, state.keys.s);

        if (state.mode === 'Player') {
            handlePaddleMove(p2, state.keys.ArrowUp, state.keys.ArrowDown);
        } else {
            updateAIPaddle();
        }
        updateBallPhysics();
    }
}

function updateAIPaddle() {
    const profile = getAIProfile();
    const b = state.ball, p2 = state.p2, c = state.canvas;
    const movingTowardAI = b.dx > 0;
    const predictedCenter = movingTowardAI
        ? predictBallYToPaddle()
        : c.height / 2 + (b.y - c.height / 2) * profile.recovery;
    const missOffset = movingTowardAI ? getAIMissOffset(profile) : 0;
    const targetY = clamp(predictedCenter + missOffset - p2.h / 2, 0, c.height - p2.h);
    const distance = targetY - p2.y;

    if (Math.abs(distance) <= profile.deadZone) return;

    const maxMove = getPaddleSpeed() * profile.speed;
    p2.y = clamp(p2.y + clamp(distance, -maxMove, maxMove), 0, c.height - p2.h);
}

function getAIProfile() {
    return CONFIG.ai.profiles[state.aiDifficulty] || CONFIG.ai.profiles.medium;
}

function getAIMissOffset(profile) {
    const b = state.ball;
    const wave = Math.sin((b.x * 0.045) + (b.y * 0.025) + state.p1Score + (state.p2Score * 1.7));
    return wave * state.canvas.height * profile.errorPct;
}

function handlePaddleMove(p, up, down) {
    const speed = getPaddleSpeed();
    if (up) p.y -= speed;
    if (down) p.y += speed;
    p.y = clamp(p.y, 0, state.canvas.height - p.h);
}

function updateBallPhysics() {
    const b = state.ball, p1 = state.p1, p2 = state.p2, c = state.canvas;
    b.x += b.dx;
    b.y += b.dy;

    // Wall bounce
    if (b.y <= 0 || b.y >= c.height - b.r) {
        b.dy = -b.dy;
        b.y = b.y <= 0 ? 0 : c.height - b.r; // Nudge out
    }

    // Paddle collisions
    if (b.dx < 0 && b.x <= p1.x + p1.w && b.x >= p1.x && b.y + b.r >= p1.y && b.y <= p1.y + p1.h) {
        hitPaddle(p1, false);
    }
    if (b.dx > 0 && b.x + b.r >= p2.x && b.x <= p2.x + p2.w && b.y + b.r >= p2.y && b.y <= p2.y + p2.h) {
        hitPaddle(p2, true);
    }

    // Score
    if (b.x < 0) score('p2');
    if (b.x > c.width) score('p1');
}

function hitPaddle(p, isRight) {
    const b = state.ball;
    b.dx = -b.dx;
    const rel = (b.y + b.r / 2 - p.y) / p.h;
    b.dy = (rel - 0.5) * 10;
    b.dx *= 1.1; // Speed up

    // Nudge out
    if (isRight) b.x = p.x - b.r - 1;
    else b.x = p.x + p.w + 1;
}

function score(side) {
    if (side === 'p1') { state.p1Score++; addScoreFx('player1Score'); }
    else { state.p2Score++; addScoreFx('player2Score'); }
    updScore();

    if (state.p1Score >= state.matchPoint || state.p2Score >= state.matchPoint) {
        endGame(state.p1Score >= state.matchPoint ? 'Player 1' : 'Player 2');
    } else {
        centerBall();
    }
}

function endGame(winner) {
    state.isRunning = false;
    stopLoop();
    byId('winnerTitle', el => el.textContent = `🎉 ${winner} Wins!`);
    byId('finalScore', el => el.textContent = `Final Score: ${state.p1Score} - ${state.p2Score}`);
    showModal('gameOverModal');
}

function updScore() {
    byId('player1Score', el => el.textContent = state.p1Score);
    byId('player2Score', el => el.textContent = state.p2Score);
}

function centerBall() {
    const b = state.ball;
    b.x = state.canvas.width / 2;
    b.y = state.canvas.height / 2;
    b.r = getBallRadius();
    b.dx = getBallSpeed() * (Math.random() > 0.5 ? 1 : -1);
    b.dy = getBallSpeed() * (Math.random() > 0.5 ? 1 : -1);
}

// -------------------------------
// Draw
// -------------------------------
function draw() {
    const ctx = state.ctx, c = state.canvas, p1 = state.p1, p2 = state.p2, b = state.ball;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, c.width, c.height);

    // dotted bg
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < c.width; i += 40) for (let j = 0; j < c.height; j += 40) ctx.fillRect(i, j, 2, 2);

    // center line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([10, 15]);
    ctx.beginPath(); ctx.moveTo(c.width / 2, 0); ctx.lineTo(c.width / 2, c.height); ctx.stroke();
    ctx.setLineDash([]);

    // paddles
    drawPaddle(p1, '#4ecdc4');
    drawPaddle(p2, '#ff6b6b');

    // ball
    drawBall(b);

    // Canvas score (fallback)
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(state.p1Score, c.width / 4, 60);
    ctx.fillText(state.p2Score, 3 * c.width / 4, 60);
}

function drawPaddle(p, color) {
    const ctx = state.ctx;
    ctx.fillStyle = color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.shadowBlur = 0;
}

function drawBall(b) {
    const ctx = state.ctx;
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
}

function addScoreFx(id) {
    byId(id, el => {
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 500);
    });
}

// -------------------------------
// Helpers
// -------------------------------
function isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isTouchDevice(); }
function isTouchDevice() { return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches; }
function applyMobileOptimizations() { if (isTouchDevice()) document.body.classList.add('touch-device'); }
function byId(id, fn) { const el = document.getElementById(id); if (el) fn(el); return el; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function getViewportWidth() { return window.visualViewport ? window.visualViewport.width : window.innerWidth; }
function getViewportHeight() { return window.visualViewport ? window.visualViewport.height : window.innerHeight; }
function getSelectedMatchPoint() {
    const matchPointSelect = document.getElementById('matchPoint').value;
    const rawValue = matchPointSelect === 'custom' ? document.getElementById('customMatchPoint').value : matchPointSelect;
    return clamp(parseInt(rawValue, 10) || 10, 1, 99);
}
function resetKeys() { Object.keys(state.keys).forEach(key => { state.keys[key] = false; }); }
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
function predictBallYToPaddle() {
    const b = state.ball, c = state.canvas, p2 = state.p2;
    let x = b.x, y = b.y, dx = b.dx, dy = b.dy;

    if (dx <= 0) {
        return clamp(y, 0, c.height);
    }

    // Simulate ball trajectory to right paddle edge
    for (let step = 0; step < 1000 && x < p2.x; step++) {
        x += dx;
        y += dy;

        // Wall bounce
        if (y <= b.r) {
            y = b.r;
            dy = Math.abs(dy);
        } else if (y >= c.height - b.r) {
            y = c.height - b.r;
            dy = -Math.abs(dy);
        }
    }

    return clamp(y, b.r, c.height - b.r);
}

function uc(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function showModal(id) { byId(id, el => el.classList.remove('hidden')); }
function hideModal(id) { byId(id, el => el.classList.add('hidden')); }
