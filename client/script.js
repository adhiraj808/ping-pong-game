// Enhanced Pong with Online Multiplayer (Host/Join), Local PvP/AI, and Bug Fixes

// -------------------------------
// Config
// -------------------------------
const CONFIG = {
	canvasDesktop: { w: 800, h: 400 },
	mobileScale: { wPct: 0.9, hPct: 0.45 },
	paddle: { width: 10, height: 100, speed: 8 },
	ball: { size: 10, speed: 5 },
	ai: { speeds: { easy: 0.6, medium: 0.8, hard: 0.95 }, react: { easy: 50, medium: 30, hard: 10 } },
	serverUrl: `ws://${window.location.hostname}:3000`
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
	if (isMobile()) {
		const w = Math.min(window.innerWidth * CONFIG.mobileScale.wPct, CONFIG.canvasDesktop.w);
		const h = Math.min(window.innerHeight * CONFIG.mobileScale.hPct, CONFIG.canvasDesktop.h);
		state.canvas.width = Math.round(w);
		state.canvas.height = Math.round(h);
	} else {
		state.canvas.width = CONFIG.canvasDesktop.w;
		state.canvas.height = CONFIG.canvasDesktop.h;
	}
}

function initObjects() {
	state.p1 = { x: 0, y: state.canvas.height / 2 - CONFIG.paddle.height / 2, w: CONFIG.paddle.width, h: CONFIG.paddle.height };
	state.p2 = { x: state.canvas.width - CONFIG.paddle.width, y: state.canvas.height / 2 - CONFIG.paddle.height / 2, w: CONFIG.paddle.width, h: CONFIG.paddle.height };
	state.ball = { x: state.canvas.width / 2, y: state.canvas.height / 2, dx: CONFIG.ball.speed, dy: CONFIG.ball.speed, r: CONFIG.ball.size };
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
	byId('pauseBtn', el => el.addEventListener('click', togglePause));
	byId('restartBtn', el => el.addEventListener('click', restartGame));

	window.addEventListener('resize', () => { setCanvasSize(); initObjects(); });
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

	// Touch zones
	byId('leftTouchZone', zone => {
		zone.addEventListener('touchstart', (e) => handleZoneTouch(e, 'left'), { passive: false });
		zone.addEventListener('touchmove', (e) => handleZoneMove(e, 'left'), { passive: false });
		zone.addEventListener('touchend', () => handleZoneEnd('left'));
	});
	byId('rightTouchZone', zone => {
		zone.addEventListener('touchstart', (e) => handleZoneTouch(e, 'right'), { passive: false });
		zone.addEventListener('touchmove', (e) => handleZoneMove(e, 'right'), { passive: false });
		zone.addEventListener('touchend', () => handleZoneEnd('right'));
	});
}

function handleZoneTouch(e, side) { e.preventDefault(); handleZoneMove(e, side); e.currentTarget.style.transform = 'scale(0.96)'; }
function handleZoneMove(e, side) {
	e.preventDefault();
	const t = e.touches[0]; const rect = e.currentTarget.getBoundingClientRect();
	const y = t.clientY - rect.top; const H = rect.height;
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
	const msg = JSON.parse(ev.data);
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
		showModal('onlineModal');
		byId('onlineModalStatus', el => el.textContent = 'Connecting to server...');
		byId('hostSection', el => el.classList.remove('hidden'));
		byId('joinSection', el => el.classList.add('hidden'));
		state.online.isHost = true;
		await initWebSocket();
		state.online.ws.send(JSON.stringify({ type: 'host' }));
	} catch (e) {
		alert('Could not connect to server. Make sure server.js is running.');
		hideModal('onlineModal');
	}
}

async function joinOnlineGame() {
	try {
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
		hideModal('onlineModal');
	}
}

function confirmJoinRoom() {
	const code = document.getElementById('roomCodeInput').value;
	if (code.length !== 4) return alert('Enter a 4-digit code');
	state.online.ws.send(JSON.stringify({ type: 'join', code }));
}

function cancelOnlineSetup() {
	if (state.online.ws) state.online.ws.close();
	hideModal('onlineModal');
}

// -------------------------------
// Game flow
// -------------------------------
function startGame(mode, diff = 'medium') {
	state.mode = mode;
	state.aiDifficulty = diff;

	// Set match point from menu selection
	const matchPointSelect = document.getElementById('matchPoint').value;
	if (matchPointSelect === 'custom') {
		state.matchPoint = parseInt(document.getElementById('customMatchPoint').value) || 10;
	} else {
		state.matchPoint = parseInt(matchPointSelect) || 10;
	}

	state.isRunning = true;
	state.isPaused = false;
	state.p1Score = 0;
	state.p2Score = 0;
	updScore();
	initObjects();

	hideModal('onlineModal');
	hideModal('difficultyModal');
	byId('menu', el => el.classList.add('hidden'));
	byId('gameUI', el => el.classList.remove('hidden'));

	let modeText = 'Local PvP';
	if (mode === 'AI') modeText = `Player vs AI (${uc(diff)})`;
	if (mode === 'Online') modeText = `Online: ${state.online.isHost ? 'Host' : 'Client'} (Room ${state.online.roomCode})`;
	byId('gameModeDisplay', el => el.textContent = modeText);

	loop();
}

function togglePause() {
	if (state.mode === 'Online') return; // Cannot pause online games easily
	state.isPaused = !state.isPaused;
	byId('pauseBtn', el => {
		el.innerHTML = `<span class="btn-icon">${state.isPaused ? '▶️' : '⏸️'}</span>`;
		el.title = state.isPaused ? 'Resume Game' : 'Pause Game';
	});
	if (!state.isPaused) loop();
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
	loop();
}

function resetGame() {
	state.isRunning = false;
	state.isPaused = false;
	if (state.online.ws) state.online.ws.close();
	byId('gameUI', el => el.classList.add('hidden'));
	byId('menu', el => el.classList.remove('hidden'));
}

function loop() {
	if (!state.isRunning || state.isPaused) return;
	update();
	draw();
	requestAnimationFrame(loop);
}

function update() {
	const c = state.canvas, p1 = state.p1, p2 = state.p2, b = state.ball;

	// Local input handling
	if (state.mode === 'Online') {
		if (state.online.isHost) {
			handlePaddleMove(p1, state.keys.w, state.keys.s);
			updateBallPhysics();
			// Send state to client
			state.online.ws.send(JSON.stringify({
				type: 'state',
				p1Y: p1.y,
				ball: { x: b.x, y: b.y },
				score: { p1: state.p1Score, p2: state.p2Score }
			}));
		} else {
			handlePaddleMove(p2, state.keys.ArrowUp, state.keys.ArrowDown);
			// Send input to host
			state.online.ws.send(JSON.stringify({
				type: 'input',
				p2Y: p2.y
			}));
		}
	} else {
		// Local or AI mode
		handlePaddleMove(p1, state.keys.w, state.keys.s);

		if (state.mode === 'Player') {
			handlePaddleMove(p2, state.keys.ArrowUp, state.keys.ArrowDown);
		} else {
			// Enhanced AI with trajectory prediction
			const aiS = CONFIG.ai.speeds[state.aiDifficulty], react = CONFIG.ai.react[state.aiDifficulty];
			const predictedY = predictBallYToPaddle();
			const target = predictedY - p2.h / 2;
			if (Math.abs(p2.y - target) > react) {
				p2.y += (p2.y < target ? 1 : -1) * CONFIG.paddle.speed * aiS;
			}
		}
		updateBallPhysics();
	}
}

function handlePaddleMove(p, up, down) {
	if (up && p.y > 0) p.y -= CONFIG.paddle.speed;
	if (down && p.y < state.canvas.height - p.h) p.y += CONFIG.paddle.speed;
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
	b.dx = CONFIG.ball.speed * (Math.random() > 0.5 ? 1 : -1);
	b.dy = CONFIG.ball.speed * (Math.random() > 0.5 ? 1 : -1);
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
function isMobile() { return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0); }
function applyMobileOptimizations() { if (isMobile()) { byId('leftTouchZone', el => el.style.display = 'block'); byId('rightTouchZone', el => el.style.display = 'block'); } }
function byId(id, fn) { const el = document.getElementById(id); if (el) fn(el); return el; }
function predictBallYToPaddle() {
	const b = state.ball, c = state.canvas, p2 = state.p2;
	let x = b.x, y = b.y, dx = b.dx, dy = b.dy;

	// Simulate ball trajectory to right paddle edge
	while (x < p2.x) {
		x += dx;
		y += dy;

		// Wall bounce
		if (y <= 0 || y >= c.height - b.r) dy = -dy;

		// Prevent infinite loop
		if (Math.abs(dx) < 0.1) break;
	}

	return Math.max(0, Math.min(c.height - p2.h, y));
}

function uc(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function showModal(id) { byId(id, el => el.classList.remove('hidden')); }
function hideModal(id) { byId(id, el => el.classList.add('hidden')); }
