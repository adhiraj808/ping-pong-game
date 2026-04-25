export class AI {
    constructor(paddle, ball, difficulty = 'medium') {
        this.paddle = paddle;
        this.ball = ball;
        this.difficulty = difficulty;
        
        // Settings for different difficulties
        this.configs = {
            easy: {
                speedModifier: 0.5,
                reactionDelay: 200, // ms
                errorMargin: 40     // pixels of "laziness"
            },
            medium: {
                speedModifier: 0.75,
                reactionDelay: 100,
                errorMargin: 20
            },
            hard: {
                speedModifier: 1.0,
                reactionDelay: 0,
                errorMargin: 5,
                prediction: true
            }
        };

        this.lastUpdateTime = 0;
        this.targetY = paddle.y + paddle.height / 2;
    }

    setDifficulty(level) {
        if (this.configs[level]) {
            this.difficulty = level;
        }
    }

    update(currentTime) {
        const config = this.configs[this.difficulty];

        // Artificial reaction delay
        if (currentTime - this.lastUpdateTime < config.reactionDelay) return;
        this.lastUpdateTime = currentTime;

        let targetY = this.ball.y;

        // Hard difficulty prediction logic
        if (config.prediction && this.ball.dx > 0) {
            // Predict where the ball will hit based on trajectory
            const timeToHit = (this.paddle.x - this.ball.x) / this.ball.dx;
            if (timeToHit > 0) {
                let predictedY = this.ball.y + (this.ball.dy * timeToHit);
                
                // Handle wall bounces in prediction
                const canvasHeight = this.ball.canvasHeight;
                while (predictedY < 0 || predictedY > canvasHeight) {
                    if (predictedY < 0) predictedY = -predictedY;
                    if (predictedY > canvasHeight) predictedY = canvasHeight - (predictedY - canvasHeight);
                }
                targetY = predictedY;
            }
        }

        // Apply error margin (AI doesn't always aim for the perfect center)
        const center = this.paddle.y + this.paddle.height / 2;
        
        if (Math.abs(center - targetY) > config.errorMargin) {
            if (center < targetY) {
                this.paddle.dy = this.paddle.speed * config.speedModifier;
            } else {
                this.paddle.dy = -this.paddle.speed * config.speedModifier;
            }
        } else {
            this.paddle.dy = 0;
        }
    }
}
