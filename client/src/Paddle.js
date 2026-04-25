export class Paddle {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.dy = 0;
        this.speed = 8;
        this.score = 0;
    }

    update(canvasHeight) {
        this.y += this.dy;
        // Boundary checks
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > canvasHeight) this.y = canvasHeight - this.height;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
