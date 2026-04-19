/**
 * Frogger - Modern Reimagining
 * Features: Water effects with shaders, particle splashes, smooth animations
 */

class Frogger extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.frog = null;
        this.logs = [];
        this.turtles = [];
        this.cars = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Game settings
        this.gridSize = 50;
        this.lanes = {
            water: [1, 2, 3, 4],
            road: [8, 9, 10, 11],
            safe: [0, 5, 6, 7, 12]
        }; 

        // Frogger goals
        this.frogHomes = [];
        this.filledHomes = [];

        // Movement
        this.moveCooldown = 0;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(300);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.frog = {
            x: 7 * this.gridSize,
            y: 12 * this.gridSize,
            width: 40,
            height: 40,
            color: '#00ff00',
            glowColor: '#00ff00',
            onLog: false,
            logSpeed: 0
        };

        this.createLogs();
        this.createTurtles();
        this.createCars();
        this.createFrogHomes();
        this.filledHomes = [];
    }

    createLogs() {
        this.logs = [];
        const logConfigs = [
            { y: 1, speed: 1.5, length: 3, count: 2 },
            { y: 2, speed: -1.2, length: 2, count: 3 },
            { y: 3, speed: 1.8, length: 2, count: 2 },
            { y: 4, speed: -1.0, length: 4, count: 1 }
        ];

        logConfigs.forEach(config => {
            for (let i = 0; i < config.count; i++) {
                this.logs.push({
                    x: (i * 4 + config.y) * this.gridSize / config.count,
                    y: config.y * this.gridSize + 50,
                    width: config.length * this.gridSize,
                    height: 40,
                    speed: config.speed,
                    color: '#8B4513',
                    glowColor: '#CD853F'
                });
            }
        });
    }

    createTurtles() {
        this.turtles = [];
        const turtleConfigs = [
            { y: 1, speed: 1.3, count: 3, size: 2 },
            { y: 2, speed: -1.5, count: 2, size: 3 },
            { y: 3, speed: 1.0, count: 4, size: 1 },
            { y: 4, speed: -1.1, count: 2, size: 2 }
        ];

        turtleConfigs.forEach(config => {
            for (let i = 0; i < config.count; i++) {
                const turtleGroup = [];
                for (let j = 0; j < config.size; j++) {
                    turtleGroup.push({
                        x: (i * 5 + j) * this.gridSize + 100,
                        y: config.y * this.gridSize + 50,
                        width: 45,
                        height: 35,
                        speed: config.speed,
                        color: '#228B22',
                        glowColor: '#32CD32',
                        submerged: false,
                        submergeTimer: 0
                    });
                }
                this.turtles.push(...turtleGroup);
            }
        });
    }

    createCars() {
        this.cars = [];
        const carConfigs = [
            { y: 8, speed: -2, type: 'sedan' },
            { y: 9, speed: 1.5, type: 'truck' },
            { y: 10, speed: -2.5, type: 'sports' },
            { y: 11, speed: 1.8, type: 'racing' }
        ];

        carConfigs.forEach((config, idx) => {
            for (let i = 0; i < 2; i++) {
                const carType = this.getCarType(config.type);
                this.cars.push({
                    x: i * 400 + (idx * 100),
                    y: config.y * this.gridSize + 50,
                    width: carType.width,
                    height: 35,
                    speed: config.speed + (Math.random() * 0.5 - 0.25),
                    color: carType.color,
                    glowColor: carType.glow,
                    type: config.type,
                    headlights: true
                });
            }
        });
    }

    getCarType(type) {
        const types = {
            sedan: { width: 70, color: '#4169E1', glow: '#6495ED' },
            truck: { width: 100, color: '#DC143C', glow: '#FF6347' },
            sports: { width: 60, color: '#FFD700', glow: '#FFA500' },
            racing: { width: 65, color: '#FF1493', glow: '#FF69B4' }
        };
        return types[type] || types.sedan;
    }

    createFrogHomes() {
        this.frogHomes = [];
        for (let i = 0; i < 5; i++) {
            this.frogHomes.push({
                x: (i * 2 + 1) * this.gridSize + 25,
                y: 50,
                width: 45,
                height: 40,
                filled: false,
                color: '#9370DB'
            });
        }
    }

    handleKeyDownGame(e) {
        if (this.moveCooldown > 0) return;

        const oldX = this.frog.x;
        const oldY = this.frog.y;

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.frog.y -= this.gridSize;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.frog.y = Math.min(this.frog.y + this.gridSize, 12 * this.gridSize);
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.frog.x -= this.gridSize;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.frog.x = Math.min(this.frog.x + this.gridSize, 15 * this.gridSize - this.frog.width);
                break;
            case 'KeyP':
                this.pause();
                return;
        }

        // Keep frog in bounds
        this.frog.x = Math.max(0, Math.min(15 * this.gridSize - this.frog.width, this.frog.x));

        // Create jump particles
        this.particles.trail(
            oldX + this.frog.width / 2,
            oldY + this.frog.height / 2,
            { color: '#00ff00', count: 5 }
        );

        this.audio.playSynth('sine', { frequency: 400, slideTo: 600, duration: 0.1, volume: 0.1 });
        this.moveCooldown = 0.15;
    }

    handleKeyUpGame(e) {
        // Handle key releases
    }

    update(dt) {
        this.moveCooldown -= dt;

        // Update logs
        this.logs.forEach(log => {
            log.x += log.speed;
            if (log.speed > 0 && log.x > this.canvas.width) {
                log.x = -log.width;
            } else if (log.speed < 0 && log.x + log.width < 0) {
                log.x = this.canvas.width;
            }
        });

        // Update turtles
        this.turtles.forEach(turtle => {
            turtle.x += turtle.speed;
            if (turtle.speed > 0 && turtle.x > this.canvas.width) {
                turtle.x = -turtle.width;
            } else if (turtle.speed < 0 && turtle.x + turtle.width < 0) {
                turtle.x = this.canvas.width;
            }

            // Submerge animation
            turtle.submergeTimer += dt;
            if (turtle.submergeTimer > 3) {
                turtle.submerged = true;
                if (turtle.submergeTimer > 5) {
                    turtle.submerged = false;
                    turtle.submergeTimer = 0;
                }
            }
        });

        // Update cars
        this.cars.forEach(car => {
            car.x += car.speed;
            if (car.speed > 0 && car.x > this.canvas.width + 100) {
                car.x = -car.width - 100;
            } else if (car.speed < 0 && car.x + car.width < -100) {
                car.x = this.canvas.width + 100;
            }

            // Headlight effect
            car.headlightOffset = (car.headlightOffset || 0) + dt * 10;
        });

        // Check if frog is on log or turtle
        this.frog.onLog = false;
        this.frog.logSpeed = 0;

        // Check log collision
        this.logs.forEach(log => {
            if (this.checkFrogOnObject(log)) {
                this.frog.onLog = true;
                this.frog.logSpeed = log.speed;
            }
        });

        // Check turtle collision
        let onTurtle = false;
        this.turtles.forEach(turtle => {
            if (!turtle.submerged && this.checkFrogOnObject(turtle)) {
                this.frog.onLog = true;
                this.frog.logSpeed = turtle.speed;
                onTurtle = true;
            }
        });

        // Move frog with log/turtle
        if (this.frog.onLog) {
            this.frog.x += this.frog.logSpeed;
            // Create water splash particles
            if (Math.random() < 0.3) {
                this.particles.trail(
                    this.frog.x + this.frog.width / 2,
                    this.frog.y + this.frog.height,
                    { color: '#0066ff', count: 1 }
                );
            }
        }

        // Check car collisions
        this.cars.forEach(car => {
            if (this.rectCollision(
                { x: this.frog.x + 10, y: this.frog.y + 10, width: this.frog.width - 20, height: this.frog.height - 20 },
                { x: car.x + 5, y: car.y + 5, width: car.width - 10, height: car.height - 10 }
            )) {
                this.handleDeath();
            }
        });

        // Check if frog fell in water
        if (!this.frog.onLog && this.frog.y < 6 * this.gridSize && this.frog.y > 50) {
            this.handleDeath();
        }

        // Check if frog reached home row
        if (this.frog.y < 100) {
            this.checkFrogHome();
        }

        // Update particles
        this.particles.update(dt);
    }

    checkFrogOnObject(obj) {
        return this.frog.x + this.frog.width > obj.x &&
               this.frog.x < obj.x + obj.width &&
               this.frog.y + this.frog.height > obj.y &&
               this.frog.y < obj.y + obj.height;
    }

    handleDeath() {
        this.particles.explode(
            this.frog.x + this.frog.width / 2,
            this.frog.y + this.frog.height / 2,
            { colors: ['#00ff00', '#ffffff'], count: 30 }
        );
        this.shake(5);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.3, volume: 0.2 });
        this.removeLife();
        this.resetFrog();
    }

    resetFrog() {
        this.frog.x = 7 * this.gridSize;
        this.frog.y = 12 * this.gridSize;
        this.frog.onLog = false;
        this.frog.logSpeed = 0;
    }

    checkFrogHome() {
        this.frogHomes.forEach((home, index) => {
            if (!home.filled &&
                this.frog.x > home.x - 20 &&
                this.frog.x < home.x + home.width + 20 &&
                this.frog.y < home.y + home.height) {

                home.filled = true;
                this.filledHomes.push(index);
                this.addScore(100);

                this.particles.explode(
                    home.x + home.width / 2,
                    home.y + home.height / 2,
                    { colors: ['#00ff00', '#ffff00'], count: 20 }
                );
                this.audio.playSynth('sine', { frequency: 800, slideTo: 1200, duration: 0.2, volume: 0.15 });

                if (this.filledHomes.length >= 5) {
                    this.nextLevel();
                } else {
                    this.resetFrog();
                }
            }
        });

        // Frog went too far left or right in home row
        if (this.frog.y < 80 && !this.frogHomes.some(h =>
            this.frog.x > h.x - 30 && this.frog.x < h.x + h.width + 30)) {
            this.handleDeath();
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(500);
        this.filledHomes = [];
        this.frogHomes.forEach(h => h.filled = false);
        this.resetFrog();

        // Increase difficulty
        this.logs.forEach(log => log.speed *= 1.1);
        this.turtles.forEach(t => t.speed *= 1.1);
        this.cars.forEach(c => c.speed *= 1.1);

        this.audio.playSynth('sine', { frequency: 523, slideTo: 1047, duration: 0.5, volume: 0.2 });
    }

    render() {
        // Clear with dark background
        this.clear('#0a0a20');

        // Draw background elements
        this.drawBackground();

        // Draw frog homes (top row)
        this.frogHomes.forEach(home => {
            this.renderer.drawGlowingRect(
                home.x,
                home.y,
                home.width,
                home.height,
                {
                    color: home.filled ? '#00ff00' : home.color,
                    glowColor: home.filled ? '#00ff00' : home.color,
                    glowBlur: home.filled ? 20 : 10,
                    alpha: 0.8
                }
            );

            if (home.filled) {
                // Draw happy frog in home
                this.ctx.fillStyle = '#00ff00';
                this.ctx.beginPath();
                this.ctx.arc(home.x + home.width/2, home.y + home.height/2, 15, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });

        // Draw water section
        this.drawWaterSection();

        // Draw safe median
        this.drawMedian();

        // Draw road section
        this.drawRoadSection();

        // Draw starting area
        this.drawStartingArea();

        // Draw frog
        this.drawFrog();

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawBackground() {
        // Top home area
        this.ctx.fillStyle = '#1a1a3a';
        this.ctx.fillRect(0, 0, this.canvas.width, 100);

        // Water gradient
        const waterGradient = this.ctx.createLinearGradient(0, 100, 0, 300);
        waterGradient.addColorStop(0, '#001133');
        waterGradient.addColorStop(1, '#003366');
        this.ctx.fillStyle = waterGradient;
        this.ctx.fillRect(0, 100, this.canvas.width, 200);

        // Median
        this.ctx.fillStyle = '#2d5a27';
        this.ctx.fillRect(0, 300, this.canvas.width, 50);

        // Road gradient
        const roadGradient = this.ctx.createLinearGradient(0, 350, 0, 550);
        roadGradient.addColorStop(0, '#333333');
        roadGradient.addColorStop(1, '#1a1a1a');
        this.ctx.fillStyle = roadGradient;
        this.ctx.fillRect(0, 350, this.canvas.width, 200);

        // Starting area
        this.ctx.fillStyle = '#2d5a27';
        this.ctx.fillRect(0, 550, this.canvas.width, 100);
    }

    drawWaterSection() {
        // Water ripple effects
        const time = Date.now() / 1000;
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.strokeStyle = '#0066ff';
        this.ctx.lineWidth = 2;

        for (let i = 0; i < 5; i++) {
            const y = 120 + i * 45;
            const offset = Math.sin(time + i) * 10;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + offset);
            for (let x = 0; x < this.canvas.width; x += 30) {
                this.ctx.lineTo(x, y + offset + Math.sin(x / 50 + time) * 5);
            }
            this.ctx.stroke();
        }
        this.ctx.restore();

        // Draw logs
        this.logs.forEach(log => {
            this.renderer.drawGlowingRect(
                log.x,
                log.y,
                log.width,
                log.height,
                {
                    color: log.color,
                    glowColor: log.glowColor,
                    glowBlur: 10,
                    alpha: 0.9
                }
            );

            // Log detail lines
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            for (let i = 1; i < 4; i++) {
                const lx = log.x + (log.width / 4) * i;
                this.ctx.beginPath();
                this.ctx.moveTo(lx, log.y + 5);
                this.ctx.lineTo(lx, log.y + log.height - 5);
                this.ctx.stroke();
            }
        });

        // Draw turtles
        this.turtles.forEach(turtle => {
            if (turtle.submerged) {
                // Draw submerged turtle outline
                this.ctx.save();
                this.ctx.globalAlpha = 0.3;
                this.renderer.drawGlowingRect(
                    turtle.x,
                    turtle.y,
                    turtle.width,
                    turtle.height,
                    { color: '#1a5a1a', glowColor: '#228B22', glowBlur: 5 }
                );
                this.ctx.restore();
            } else {
                this.renderer.drawGlowingRect(
                    turtle.x,
                    turtle.y,
                    turtle.width,
                    turtle.height,
                    {
                        color: turtle.color,
                        glowColor: turtle.glowColor,
                        glowBlur: 10,
                        alpha: 0.9
                    }
                );

                // Turtle shell detail
                this.ctx.fillStyle = '#1a5a1a';
                this.ctx.beginPath();
                this.ctx.ellipse(
                    turtle.x + turtle.width / 2,
                    turtle.y + turtle.height / 2,
                    turtle.width / 3,
                    turtle.height / 3,
                    0, 0, Math.PI * 2
                );
                this.ctx.fill();
            }
        });
    }

    drawMedian() {
        // Grass with flower details
        this.ctx.fillStyle = '#2d5a27';
        this.ctx.fillRect(0, 300, this.canvas.width, 50);

        // Flower decorations
        const time = Date.now() / 500;
        for (let i = 0; i < 20; i++) {
            const x = (i * 43 + 25) % this.canvas.width;
            const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'];
            this.ctx.fillStyle = colors[i % colors.length];
            this.ctx.globalAlpha = 0.7 + Math.sin(time + i) * 0.3;
            this.ctx.beginPath();
            this.ctx.arc(x, 325, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }

    drawRoadSection() {
        // Lane markers
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([20, 20]);

        for (let i = 0; i < 4; i++) {
            const y = 375 + i * 50;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        this.ctx.setLineDash([]);

        // Draw cars
        this.cars.forEach(car => {
            // Car body
            this.renderer.drawGlowingRect(
                car.x,
                car.y,
                car.width,
                car.height,
                {
                    color: car.color,
                    glowColor: car.glowColor,
                    glowBlur: 15,
                    alpha: 0.9
                }
            );

            // Car windows
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.fillRect(
                car.x + car.width * 0.2,
                car.y + 5,
                car.width * 0.5,
                car.height * 0.5
            );

            // Headlights
            const headlightX = car.speed > 0 ? car.x + car.width - 5 : car.x + 5;
            this.ctx.fillStyle = '#ffff00';
            this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.5;
            this.ctx.beginPath();
            this.ctx.arc(headlightX, car.y + 10, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;

            // Headlight beam
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            const gradient = this.ctx.createLinearGradient(
                headlightX, car.y + 10,
                headlightX + (car.speed > 0 ? 60 : -60), car.y + 10
            );
            gradient.addColorStop(0, '#ffff00');
            gradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            if (car.speed > 0) {
                this.ctx.moveTo(headlightX, car.y + 5);
                this.ctx.lineTo(headlightX + 60, car.y);
                this.ctx.lineTo(headlightX + 60, car.y + 20);
                this.ctx.lineTo(headlightX, car.y + 15);
            } else {
                this.ctx.moveTo(headlightX, car.y + 5);
                this.ctx.lineTo(headlightX - 60, car.y);
                this.ctx.lineTo(headlightX - 60, car.y + 20);
                this.ctx.lineTo(headlightX, car.y + 15);
            }
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    drawStartingArea() {
        // Grass texture
        this.ctx.fillStyle = '#2d5a27';
        this.ctx.fillRect(0, 550, this.canvas.width, 100);

        // Starting position marker
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.strokeRect(7 * this.gridSize - 5, 555, 50, 90);
        this.ctx.setLineDash([]);

        // Starting lily pad
        this.ctx.fillStyle = '#228B22';
        this.ctx.beginPath();
        this.ctx.ellipse(
            7 * this.gridSize + 20,
            600,
            30,
            20,
            0, 0, Math.PI * 2
        );
        this.ctx.fill();
    }

    drawFrog() {
        const { x, y, width, height } = this.frog;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Glow effect
        this.renderer.setGlow(this.frog.glowColor, 20);

        // Legs
        this.ctx.fillStyle = '#00cc00';
        const legOffset = Math.sin(Date.now() / 100) * 5;

        // Back legs
        this.ctx.beginPath();
        this.ctx.ellipse(-15, 15, 8, 12, -0.3, 0, Math.PI * 2);
        this.ctx.ellipse(15, 15, 8, 12, 0.3, 0, Math.PI * 2);
        this.ctx.fill();

        // Body
        this.ctx.fillStyle = '#00ff00';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Front legs
        this.ctx.fillStyle = '#00cc00';
        this.ctx.beginPath();
        this.ctx.ellipse(-12, -8, 6, 10, -0.2, 0, Math.PI * 2);
        this.ctx.ellipse(12, -8, 6, 10, 0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-8, -10, 6, 0, Math.PI * 2);
        this.ctx.arc(8, -10, 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-8, -10, 3, 0, Math.PI * 2);
        this.ctx.arc(8, -10, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Eye shine
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-6, -12, 2, 0, Math.PI * 2);
        this.ctx.arc(10, -12, 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawHUD() {
        // Score
        this.renderer.drawGlowingText(`SCORE: ${this.score}`, 20, 35, {
            size: 24,
            color: '#00ff00',
            glowColor: '#00ff00'
        });

        // Level
        this.renderer.drawGlowingText(`LEVEL ${this.level}`, this.canvas.width - 120, 35, {
            size: 24,
            color: '#ffff00',
            glowColor: '#ffff00'
        });

        // Lives (frog icons)
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 35;
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.arc(lx, 25, 10, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Homes filled indicator
        this.ctx.fillStyle = '#9370DB';
        for (let i = 0; i < 5; i++) {
            const hx = this.canvas.width / 2 - 60 + i * 30;
            if (this.filledHomes.includes(i)) {
                this.ctx.fillStyle = '#00ff00';
            } else {
                this.ctx.fillStyle = '#444444';
            }
            this.ctx.beginPath();
            this.ctx.arc(hx + 15, 25, 8, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    onStateChange(newState) {
        if (newState === 'gameover') {
            this.renderer.drawGlowingText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30, {
                size: 48,
                color: '#ff0000',
                glowColor: '#ff0000',
                align: 'center'
            });
            this.renderer.drawGlowingText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20, {
                size: 28,
                color: '#ffffff',
                glowColor: '#ffffff',
                align: 'center'
            });
            this.renderer.drawGlowingText('Press ESC or Click to Restart', this.canvas.width / 2, this.canvas.height / 2 + 70, {
                size: 20,
                color: '#888888',
                glowColor: '#888888',
                align: 'center'
            });

            const restartHandler = () => {
                this.destroy();
                document.removeEventListener('keydown', restartHandler);
                this.canvas.removeEventListener('click', restartHandler);
                setTimeout(() => {
                    const newGame = new Frogger(this.container);
                    newGame.start();
                }, 100);
            };

            document.addEventListener('keydown', restartHandler);
            this.canvas.addEventListener('click', restartHandler);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Frogger;
}
