import { Ball } from './Ball.js';
import { Paddle } from './Paddle.js';
import { AI } from './AI.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        const paddleWidth = 10;
        const paddleHeight = 100;

        this.player1 = new Paddle(20, this.height / 2 - paddleHeight / 2, paddleWidth, paddleHeight, '#3498db');
        this.player2 = new Paddle(this.width - 30, this.height / 2 - paddleHeight / 2, paddleWidth, paddleHeight, '#e74c3c');
        this.ball = new Ball(this.width, this.height);

        // Game State
        this.gameMode = 'single'; // 'single', 'multi-host', or 'multi-guest'
        this.ai = new AI(this.player2, this.ball, 'medium');
        
        // Networking
        this.socket = null;
        this.roomId = null;
        this.isHost = false;

        this.keys = {};
        this.setupControls();
    }

    initNetwork(socket, roomId, isHost) {
        this.socket = socket;
        this.roomId = roomId;
        this.isHost = isHost;
        this.gameMode = isHost ? 'multi-host' : 'multi-guest';

        this.socket.on('opponentMove', (y) => {
            if (this.isHost) {
                this.player2.y = y;
            } else {
                this.player1.y = y;
            }
        });

        this.socket.on('ballUpdate', (data) => {
            if (!this.isHost) {
                this.ball.x = data.x;
                this.ball.y = data.y;
                this.player1.score = data.score1;
                this.player2.score = data.score2;
            }
        });
    }

    setupControls() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    handleInput() {
        if (this.gameMode === 'multi-guest') {
            // Guest controls Player 2
            this.player2.dy = 0;
            if (this.keys['ArrowUp'] || this.keys['KeyW']) this.player2.dy = -this.player2.speed;
            if (this.keys['ArrowDown'] || this.keys['KeyS']) this.player2.dy = this.player2.speed;
            
            this.socket.emit('paddleMove', { roomId: this.roomId, y: this.player2.y });
        } else {
            // Player 1 input (Local or Host)
            this.player1.dy = 0;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) this.player1.dy = -this.player1.speed;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) this.player1.dy = this.player1.speed;

            if (this.gameMode === 'multi-host') {
                this.socket.emit('paddleMove', { roomId: this.roomId, y: this.player1.y });
            }

            // Player 2 control
            if (this.gameMode === 'single') {
                this.ai.update(performance.now());
            }
            // In multi-host, player2.y is updated via socket event 'opponentMove'
        }
    }

    checkCollisions() {
        // Only the host calculates ball collisions to ensure consistency
        if (this.gameMode === 'multi-guest') return;

        if (this.ball.dx < 0) {
            if (this.ball.x - this.ball.radius <= this.player1.x + this.player1.width &&
                this.ball.y >= this.player1.y && this.ball.y <= this.player1.y + this.player1.height) {
                this.ball.dx *= -1.05;
                this.ball.x = this.player1.x + this.player1.width + this.ball.radius;
            }
        } else {
            if (this.ball.x + this.ball.radius >= this.player2.x &&
                this.ball.y >= this.player2.y && this.ball.y <= this.player2.y + this.player2.height) {
                this.ball.dx *= -1.05;
                this.ball.x = this.player2.x - this.ball.radius;
            }
        }

        if (this.ball.x < 0) {
            this.player2.score++;
            this.ball.reset();
        } else if (this.ball.x > this.width) {
            this.player1.score++;
            this.ball.reset();
        }

        if (this.gameMode === 'multi-host') {
            this.socket.emit('ballSync', {
                roomId: this.roomId,
                x: this.ball.x,
                y: this.ball.y,
                score1: this.player1.score,
                score2: this.player2.score
            });
        }
    }

    update() {
        this.handleInput();
        this.player1.update(this.height);
        this.player2.update(this.height);
        
        // Ball only updates on host or single player
        if (this.gameMode !== 'multi-guest') {
            this.ball.update();
        }
        
        this.checkCollisions();
    }

    draw() {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.setLineDash([10, 10]);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 2, 0);
        this.ctx.lineTo(this.width / 2, this.height);
        this.ctx.stroke();

        this.player1.draw(this.ctx);
        this.player2.draw(this.ctx);
        this.ball.draw(this.ctx);

        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(this.player1.score, this.width / 4, 50);
        this.ctx.fillText(this.player2.score, (this.width / 4) * 3, 50);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    start() {
        this.loop();
    }
}
