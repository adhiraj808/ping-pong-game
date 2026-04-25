export class Ball {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.reset();
        this.radius = 10;
        this.speed = 5;
    }

    reset() {
        this.x = this.canvasWidth / 2;
        this.y = this.canvasHeight / 2;
        // Randomize initial direction
        const angle = (Math.random() * Math.PI / 2) - Math.PI / 4; // -45 to 45 degrees
        const direction = Math.random() > 0.5 ? 1 : -1;
        this.dx = direction * Math.cos(angle) * 5;
        this.dy = Math.sin(angle) * 5;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;

        // Top and bottom wall collision
        if (this.y - this.radius <= 0 || this.y + this.radius >= this.canvasHeight) {
            this.dy *= -1;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.closePath();
    }
}
