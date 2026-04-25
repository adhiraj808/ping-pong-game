const { useState, useEffect, useRef, useCallback } = React;

const CONFIG = {
    canvasDesktop: { w: 800, h: 400 },
    paddle: { width: 12, height: 90, speed: 8 },
    ball: { size: 10, speed: 5 },
    ai: { 
        speeds: { easy: 0.5, medium: 0.75, hard: 0.95 }, 
        react: { easy: 60, medium: 35, hard: 10 } 
    },
    colors: {
        p1: '#4ecdc4',
        p2: '#ff6b6b',
        ball: '#fff',
        wood: '#2c1810'
    }
};

const App = () => {
    const [view, setView] = useState('MENU'); // MENU, DIFFICULTY, ONLINE_MODAL, GAME
    const [mode, setMode] = useState(''); // Player, AI, Online
    const [difficulty, setDifficulty] = useState('medium');
    const [scores, setScores] = useState({ p1: 0, p2: 0 });
    const [roomCode, setRoomCode] = useState('');
    const [onlineStatus, setOnlineStatus] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [matchPoint, setMatchPoint] = useState(10);

    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    const gameStateRef = useRef({
        isRunning: false,
        p1: { y: 155 },
        p2: { y: 155 },
        ball: { x: 400, y: 200, dx: 5, dy: 5 },
        keys: {}
    });

    const serverUrl = window.location.origin.replace(/^http/, 'ws');

    // -------------------------------
    // WebSocket Logic
    // -------------------------------
    const initWebSocket = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (wsRef.current) wsRef.current.close();
            const ws = new WebSocket(serverUrl);
            wsRef.current = ws;

            ws.onopen = () => resolve(ws);
            ws.onerror = (err) => reject(err);
            ws.onmessage = (ev) => {
                const msg = JSON.parse(ev.data);
                handleServerMessage(msg);
            };
            ws.onclose = () => {
                if (gameStateRef.current.isRunning && mode === 'Online') {
                    alert('Connection lost');
                    resetToMenu();
                }
            };
        });
    }, [mode, serverUrl]);

    const handleServerMessage = (msg) => {
        switch (msg.type) {
            case 'hosted':
                setRoomCode(msg.code);
                setOnlineStatus('Waiting for opponent...');
                break;
            case 'joined':
            case 'playerJoined':
                setRoomCode(msg.code);
                startGame('Online');
                break;
            case 'state':
                if (!isHost) {
                    gameStateRef.current.p1.y = msg.p1Y;
                    gameStateRef.current.ball = msg.ball;
                    setScores(msg.score);
                }
                break;
            case 'input':
                if (isHost) {
                    gameStateRef.current.p2.y = msg.p2Y;
                }
                break;
            case 'disconnected':
                alert('Opponent disconnected');
                resetToMenu();
                break;
            case 'error':
                alert(msg.message);
                setView('MENU');
                break;
        }
    };

    // -------------------------------
    // Game Logic
    // -------------------------------
    const startGame = (m, diff = 'medium') => {
        setMode(m);
        setDifficulty(diff);
        setScores({ p1: 0, p2: 0 });
        gameStateRef.current = {
            isRunning: true,
            p1: { y: 155 },
            p2: { y: 155 },
            ball: { x: 400, y: 200, dx: CONFIG.ball.speed, dy: CONFIG.ball.speed },
            keys: {}
        };
        setView('GAME');
    };

    const resetToMenu = () => {
        gameStateRef.current.isRunning = false;
        if (wsRef.current) wsRef.current.close();
        setView('MENU');
    };

    useEffect(() => {
        if (view !== 'GAME') return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let frameId;

        const update = () => {
            const state = gameStateRef.current;
            const { p1, p2, ball, keys } = state;

            if (mode === 'Online') {
                if (isHost) {
                    movePaddle(p1, keys['w'], keys['s']);
                    updateBallPhysics();
                    wsRef.current.send(JSON.stringify({
                        type: 'state',
                        p1Y: p1.y,
                        ball: { x: ball.x, y: ball.y },
                        score: scores
                    }));
                } else {
                    movePaddle(p2, keys['ArrowUp'], keys['ArrowDown']);
                    wsRef.current.send(JSON.stringify({
                        type: 'input',
                        p2Y: p2.y
                    }));
                }
            } else {
                movePaddle(p1, keys['w'], keys['s']);
                if (mode === 'Player') {
                    movePaddle(p2, keys['ArrowUp'], keys['ArrowDown']);
                } else {
                    // AI Logic
                    const aiSpeed = CONFIG.ai.speeds[difficulty];
                    const targetY = ball.y - CONFIG.paddle.height / 2;
                    if (Math.abs(p2.y - targetY) > CONFIG.ai.react[difficulty]) {
                        p2.y += (p2.y < targetY ? 1 : -1) * CONFIG.paddle.speed * aiSpeed;
                    }
                }
                updateBallPhysics();
            }
        };

        const movePaddle = (p, up, down) => {
            if (up && p.y > 0) p.y -= CONFIG.paddle.speed;
            if (down && p.y < CONFIG.canvasDesktop.h - CONFIG.paddle.height) p.y += CONFIG.paddle.speed;
        };

        const updateBallPhysics = () => {
            const state = gameStateRef.current;
            const { ball, p1, p2 } = state;

            ball.x += ball.dx;
            ball.y += ball.dy;

            if (ball.y <= 0 || ball.y >= CONFIG.canvasDesktop.h - CONFIG.ball.size) {
                ball.dy *= -1;
            }

            // Paddle collisions
            if (ball.dx < 0 && ball.x <= CONFIG.paddle.width && ball.y + CONFIG.ball.size >= p1.y && ball.y <= p1.y + CONFIG.paddle.height) {
                ball.dx *= -1.1;
                ball.x = CONFIG.paddle.width + 1;
            }
            if (ball.dx > 0 && ball.x + CONFIG.ball.size >= CONFIG.canvasDesktop.w - CONFIG.paddle.width && ball.y + CONFIG.ball.size >= p2.y && ball.y <= p2.y + CONFIG.paddle.height) {
                ball.dx *= -1.1;
                ball.x = CONFIG.canvasDesktop.w - CONFIG.paddle.width - CONFIG.ball.size - 1;
            }

            // Scoring
            if (ball.x < 0) scorePoint('p2');
            if (ball.x > CONFIG.canvasDesktop.w) scorePoint('p1');
        };

        const scorePoint = (side) => {
            setScores(prev => {
                const next = { ...prev, [side]: prev[side] + 1 };
                if (next[side] >= matchPoint) {
                    alert(`${side === 'p1' ? 'Player 1' : 'Player 2'} Wins!`);
                    resetToMenu();
                } else {
                    resetBall();
                }
                return next;
            });
        };

        const resetBall = () => {
            gameStateRef.current.ball = {
                x: CONFIG.canvasDesktop.w / 2,
                y: CONFIG.canvasDesktop.h / 2,
                dx: CONFIG.ball.speed * (Math.random() > 0.5 ? 1 : -1),
                dy: CONFIG.ball.speed * (Math.random() > 0.5 ? 1 : -1)
            };
        };

        const draw = () => {
            const { p1, p2, ball } = gameStateRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Vintage Background
            ctx.fillStyle = '#1a0f0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Center line
            ctx.strokeStyle = 'rgba(244, 236, 216, 0.2)';
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.stroke();

            // Paddles (Wooden style)
            ctx.fillStyle = '#5d3a37';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, p1.y, CONFIG.paddle.width, CONFIG.paddle.height);
            ctx.fillRect(canvas.width - CONFIG.paddle.width, p2.y, CONFIG.paddle.width, CONFIG.paddle.height);
            
            // Ball
            ctx.fillStyle = '#f4ecd8';
            ctx.beginPath();
            ctx.arc(ball.x + 5, ball.y + 5, CONFIG.ball.size / 2, 0, Math.PI * 2);
            ctx.fill();
        };

        const loop = () => {
            if (!gameStateRef.current.isRunning) return;
            update();
            draw();
            frameId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(frameId);
    }, [view, mode, difficulty, isHost, scores, matchPoint]);

    // Input Handling
    useEffect(() => {
        const handleDown = (e) => gameStateRef.current.keys[e.key] = true;
        const handleUp = (e) => gameStateRef.current.keys[e.key] = false;
        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
        };
    }, []);

    // -------------------------------
    // Render Functions
    // -------------------------------
    const renderMenu = () => (
        <div className="menu">
            <div className="logo-section">
                <h1>Classical Pong</h1>
                <p>— Vintage Arcade Edition —</p>
            </div>
            <div className="button-group">
                <button className="vintage-btn" onClick={() => startGame('Player')}>Local PvP</button>
                <button className="vintage-btn" onClick={() => setView('DIFFICULTY')}>Vs AI</button>
                <button className="vintage-btn" onClick={async () => {
                    setIsHost(true);
                    setView('ONLINE_MODAL');
                    setOnlineStatus('Connecting...');
                    try {
                        const ws = await initWebSocket();
                        ws.send(JSON.stringify({ type: 'host' }));
                    } catch { alert('Server unavailable'); setView('MENU'); }
                }}>Host Online</button>
                <button className="vintage-btn" onClick={() => {
                    setIsHost(false);
                    setView('ONLINE_MODAL');
                    setOnlineStatus('Enter code to join');
                }}>Join Online</button>
            </div>
            <div style={{marginTop: '20px'}}>
                <label style={{marginRight: '10px'}}>Match Point:</label>
                <select value={matchPoint} onChange={(e) => setMatchPoint(Number(e.target.value))}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={21}>21</option>
                </select>
            </div>
        </div>
    );

    const renderOnlineModal = () => (
        <div className="modal-overlay">
            <div className="vintage-panel modal-content">
                <h2>{isHost ? 'Hosting Room' : 'Join Room'}</h2>
                <p style={{textAlign: 'center', margin: '20px 0'}}>{onlineStatus}</p>
                
                {isHost && roomCode && (
                    <div style={{fontSize: '3rem', textAlign: 'center', fontFamily: 'monospace', letterSpacing: '10px'}}>
                        {roomCode}
                    </div>
                )}
                
                {!isHost && (
                    <div style={{display: 'flex', gap: '10px', flexDirection: 'column'}}>
                        <input 
                            type="text" 
                            maxLength="4" 
                            placeholder="4-digit code"
                            style={{padding: '10px', textAlign: 'center', fontSize: '1.5rem'}}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter' && e.target.value.length === 4) {
                                    setOnlineStatus('Joining...');
                                    const ws = await initWebSocket();
                                    ws.send(JSON.stringify({ type: 'join', code: e.target.value }));
                                }
                            }}
                        />
                    </div>
                )}
                
                <button className="vintage-btn secondary" style={{width: '100%', marginTop: '20px'}} onClick={resetToMenu}>Cancel</button>
            </div>
        </div>
    );

    const renderDifficulty = () => (
        <div className="modal-overlay">
            <div className="vintage-panel modal-content">
                <h2>Select Skill Level</h2>
                <div className="button-group" style={{gridTemplateColumns: '1fr', marginTop: '20px'}}>
                    <button className="vintage-btn" onClick={() => startGame('AI', 'easy')}>Easy</button>
                    <button className="vintage-btn" onClick={() => startGame('AI', 'medium')}>Medium</button>
                    <button className="vintage-btn" onClick={() => startGame('AI', 'hard')}>Hard</button>
                    <button className="vintage-btn secondary" onClick={() => setView('MENU')}>Back</button>
                </div>
            </div>
        </div>
    );

    const renderGame = () => (
        <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            <div className="game-hud">
                <div className="score-display">{scores.p1}</div>
                <div style={{textAlign: 'center'}}>
                    <h3 style={{fontSize: '0.8rem'}}>First to {matchPoint}</h3>
                    <button className="vintage-btn secondary" style={{padding: '5px 10px', fontSize: '0.7rem'}} onClick={resetToMenu}>Quit</button>
                </div>
                <div className="score-display">{scores.p2}</div>
            </div>
            <div className="canvas-wrapper">
                <canvas 
                    ref={canvasRef} 
                    width={CONFIG.canvasDesktop.w} 
                    height={CONFIG.canvasDesktop.h} 
                />
                <div className="mobile-controls">
                    <div className="touch-zone" 
                        onTouchStart={() => gameStateRef.current.keys['w'] = true}
                        onTouchEnd={() => gameStateRef.current.keys['w'] = false}
                    />
                    <div className="touch-zone" 
                        onTouchStart={() => gameStateRef.current.keys['s'] = true}
                        onTouchEnd={() => gameStateRef.current.keys['s'] = false}
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className="app-container">
            {view === 'MENU' && renderMenu()}
            {view === 'DIFFICULTY' && renderDifficulty()}
            {view === 'ONLINE_MODAL' && renderOnlineModal()}
            {view === 'GAME' && renderGame()}
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
