/**
 * Centipede - Modern Reimagining
 * Features: Organic movement, mushroom growth effects, particle trails
 */

class Centipede extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.centipede = [];
        this.mushrooms = [];
        this.bullets = [];
        this.spiders = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Game settings
        this.gridSize = 20; 
        this.cols = 40;
        this.rows = 30;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(400);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.createPlayer();
        this.createCentipede();
        this.createMushrooms();
        this.bullets = [];
        this.spiders = [];
        this.spiderTimer = 0;
    }

    createPlayer() {
        this.player = {
            x: this.canvas.width / 2 - 15,
            y: this.canvas.height - 40,
            width: 30,
            height: 30,
            speed: 300,
            color: '#00ff00',
            glowColor: '#00ff00'
        };
    }

    createCentipede() {
        this.centipede = [];
        const segments = 12 + this.level * 2;

        for (let i = 0; i < segments; i++) {
            this.centipede.push({
                x: this.canvas.width / 2 - i * 15,
                y: 50 + (i % 2) * 20,
                width: 25,
                height: 20,
                speed: 80 + this.level * 10,
                direction: 1,
                segment: i,
                color: i === 0 ? '#ff0000' : '#ff6600',
                glowColor: '#ff3300',
                turning: false,
                turnTimer: 0
            });
        }
    }

    createMushrooms() {
        this.mushrooms = [];
        const mushroomCount = 30 + this.level * 5;

        for (let i = 0; i < mushroomCount; i++) {
            let x, y, valid;
            let attempts = 0;

            do {
                valid = true;
                x = Math.random() * (this.canvas.width - 100) + 50;
                y = Math.random() * (this.canvas.height - 150) + 100;

                // Don't spawn too close to player start
                if (Math.abs(x - this.canvas.width / 2) < 100 &&
                    Math.abs(y - (this.canvas.height - 40)) < 100) {
                    valid = false;
                }
                attempts++;
            } while (!valid && attempts < 10);

            this.mushrooms.push({
                x: x,
                y: y,
                width: 20,
                height: 20,
                health: 4,
                maxHealth: 4,
                color: '#ff69b4',
                glowColor: '#ff1493',
                growing: true,
                growTimer: 0
            });
        }
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space') {
            this.shoot();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    shoot() {
        this.bullets.push({
            x: this.player.x + this.player.width / 2 - 3,
            y: this.player.y,
            width: 6,
            height: 15,
            vx: 0,
            vy: -500,
            color: '#00ffff',
            glowColor: '#00ffff'
        });

        this.audio.playShoot();
    }

    update(dt) {
        // Player movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.x -= this.player.speed * dt;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.x += this.player.speed * dt;
        }
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            this.player.y -= this.player.speed * dt;
        }
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            this.player.y += this.player.speed * dt;
        }

        // Keep player in bounds
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
        this.player.y = Math.max(50, Math.min(this.canvas.height - this.player.height, this.player.y));

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.y += bullet.vy * dt;
            if (bullet.y < 0) {
                this.bullets.splice(index, 1);
            }
        });

        // Update centipede
        this.updateCentipede(dt);

        // Update spiders
        this.updateSpiders(dt);

        // Update mushrooms
        this.mushrooms.forEach(mushroom => {
            if (mushroom.growing) {
                mushroom.growTimer += dt;
                if (mushroom.growTimer > 0.5) {
                    mushroom.growing = false;
                }
            }
        });

        // Check collisions
        this.checkCollisions();

        // Update particles
        this.particles.update(dt);
    }

    updateCentipede(dt) {
        let head = this.centipede[0];

        if (!head) return;

        // Move head
        head.x += head.speed * head.direction * dt;

        // Check wall collision
        if (head.x <= 0 || head.x >= this.canvas.width - head.width) {
            head.direction *= -1;
            head.y += this.gridSize;
            head.turning = true;
        }

        // Check mushroom collision
        this.mushrooms.forEach(mushroom => {
            if (this.rectCollision(head, mushroom) && !head.turning) {
                head.direction *= -1;
                head.y += this.gridSize;
                head.turning = true;
            }
        });

        head.turning = false;

        // Follow head with body segments
        for (let i = 1; i < this.centipede.length; i++) {
            const segment = this.centipede[i];
            const prev = this.centipede[i - 1];

            const dx = prev.x - segment.x;
            const dy = prev.y - segment.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 15) {
                segment.x += (dx / dist) * 15;
                segment.y += (dy / dist) * 15;
            }

            // Segment also turns at obstacles
            this.mushrooms.forEach(mushroom => {
                if (this.rectCollision(segment, mushroom)) {
                    segment.direction = prev.direction;
                    segment.y += this.gridSize;
                }
            });
        }

        // Centipede reaches bottom - wrap to top
        if (head.y > this.canvas.height - 50) {
            this.centipede.forEach(seg => {
                seg.y = 50 + seg.segment * 0;
            });
        }
    }

    updateSpiders(dt) {
        this.spiderTimer += dt;

        // Spawn spider periodically
        if (this.spiderTimer > 5 && this.spiders.length < 2) {
            this.spiderTimer = 0;
            this.spiders.push({
                x: Math.random() < 0.5 ? 0 : this.canvas.width - 40,
                y: 60 + Math.random() * 100,
                width: 35,
                height: 25,
                vx: (Math.random() + 1) * 100 * (Math.random() < 0.5 ? 1 : -1),
                vy: (Math.random() - 0.5) * 50,
                color: '#ff0066',
                glowColor: '#ff0033',
                frame: 0
            });
        }

        // Update spider positions
        this.spiders.forEach(spider => {
            spider.x += spider.vx * dt;
            spider.y += spider.vy * dt;
            spider.frame += dt * 10;

            // Bounce off walls
            if (spider.x <= 0 || spider.x >= this.canvas.width - spider.width) {
                spider.vx *= -1;
            }
            if (spider.y <= 50 || spider.y >= this.canvas.height - spider.height) {
                spider.vy *= -1;
            }

            // Remove off-screen spiders
            if (spider.x < -50 || spider.x > this.canvas.width + 50) {
                this.spiders = this.spiders.filter(s => s !== spider);
            }
        });
    }

    checkCollisions() {
        // Bullets vs centipede segments
        this.bullets.forEach((bullet, bIndex) => {
            this.centipede.forEach((segment, sIndex) => {
                if (this.rectCollision(bullet, segment)) {
                    this.bullets.splice(bIndex, 1);

                    // Split centipede at hit point
                    const mushroom = this.createMushroomAt(segment.x, segment.y);

                    // Create particles
                    this.particles.explode(
                        segment.x + segment.width / 2,
                        segment.y + segment.height / 2,
                        { colors: ['#ff6600', '#ff0000'], count: 15 }
                    );

                    this.audio.playSynth('square', { frequency: 200, slideTo: 100, duration: 0.1, volume: 0.1 });

                    // Remove hit segment and create new centipede from remainder
                    if (sIndex < this.centipede.length - 1) {
                        this.centipede.splice(sIndex, 1);
                    }

                    this.addScore(10);

                    // Check if all segments destroyed
                    if (this.centipede.length === 0) {
                        this.nextLevel();
                    }
                }
            });
        });

        // Bullets vs spiders
        this.bullets.forEach((bullet, bIndex) => {
            this.spiders.forEach((spider, sIndex) => {
                if (this.rectCollision(bullet, spider)) {
                    this.bullets.splice(bIndex, 1);
                    this.spiders.splice(sIndex, 1);

                    this.particles.explode(
                        spider.x + spider.width / 2,
                        spider.y + spider.height / 2,
                        { colors: ['#ff0066', '#ffffff'], count: 20 }
                    );

                    this.addScore(100);
                    this.audio.playSynth('sawtooth', { frequency: 300, slideTo: 100, duration: 0.15, volume: 0.1 });
                }
            });
        });

        // Bullets vs mushrooms
        this.bullets.forEach((bullet, bIndex) => {
            this.mushrooms.forEach((mushroom, mIndex) => {
                if (this.rectCollision(bullet, mushroom)) {
                    this.bullets.splice(bIndex, 1);
                    mushroom.health--;

                    this.particles.trail(
                        mushroom.x + mushroom.width / 2,
                        mushroom.y + mushroom.height / 2,
                        { color: '#ff69b4', count: 3 }
                    );

                    if (mushroom.health <= 0) {
                        this.mushrooms.splice(mIndex, 1);
                        this.addScore(5);
                    }
                }
            });
        });

        // Centipede vs player
        this.centipede.forEach(segment => {
            if (this.rectCollision(
                { x: segment.x + 5, y: segment.y + 5, width: segment.width - 10, height: segment.height - 10 },
                { x: this.player.x + 5, y: this.player.y + 5, width: this.player.width - 10, height: this.player.height - 10 }
            )) {
                this.handlePlayerHit();
            }
        });

        // Spider vs player
        this.spiders.forEach(spider => {
            if (this.rectCollision(
                { x: spider.x + 5, y: spider.y + 5, width: spider.width - 10, height: spider.height - 10 },
                { x: this.player.x + 5, y: this.player.y + 5, width: this.player.width - 10, height: this.player.height - 10 }
            )) {
                this.handlePlayerHit();
            }
        });
    }

    createMushroomAt(x, y) {
        this.mushrooms.push({
            x: x,
            y: y,
            width: 20,
            height: 20,
            health: 4,
            maxHealth: 4,
            color: '#ff69b4',
            glowColor: '#ff1493',
            growing: true,
            growTimer: 0
        });
    }

    handlePlayerHit() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: ['#00ff00', '#ffffff'], count: 40 }
        );
        this.shake(8);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.3, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            this.player.x = this.canvas.width / 2 - 15;
            this.player.y = this.canvas.height - 40;
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(500);
        this.bullets = [];
        this.spiders = [];
        this.createCentipede();
        this.createMushrooms();

        this.audio.playSynth('sine', { frequency: 440, slideTo: 880, duration: 0.4, volume: 0.2 });
    }

    render() {
        // Clear with dark background
        this.clear('#0a0a1a');

        // Draw mushrooms
        this.mushrooms.forEach(mushroom => {
            this.drawMushroom(mushroom);
        });

        // Draw centipede
        this.centipede.forEach((segment, index) => {
            this.drawCentipedeSegment(segment, index);
        });

        // Draw spiders
        this.spiders.forEach(spider => {
            this.drawSpider(spider);
        });

        // Draw player
        this.drawPlayer();

        // Draw bullets
        this.bullets.forEach(bullet => {
            this.renderer.drawGlowingRect(
                bullet.x,
                bullet.y,
                bullet.width,
                bullet.height,
                { color: bullet.color, glowColor: bullet.glowColor, glowBlur: 15 }
            );
        });

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawMushroom(mushroom) {
        const { x, y, width, height, color, glowColor, health, maxHealth, growing } = mushroom;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();

        // Grow animation
        let scale = 1;
        if (growing) {
            scale = 0.5 + Math.sin(mushroom.growTimer * Math.PI * 2) * 0.5;
        }

        this.ctx.translate(cx, cy);
        this.ctx.scale(scale, scale);

        this.renderer.setGlow(glowColor, 10);

        // Mushroom cap
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(0, -5, width / 2, Math.PI, 0);
        this.ctx.fill();

        // Spots on cap (fewer as health decreases)
        this.ctx.fillStyle = '#ffffff';
        const spots = Math.ceil(health / maxHealth * 6);
        for (let i = 0; i < spots; i++) {
            const angle = (i / spots) * Math.PI - Math.PI / 2;
            const sx = Math.cos(angle) * 6;
            const sy = Math.sin(angle) * 6 - 5;
            this.ctx.beginPath();
            this.ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Stem
        this.ctx.fillStyle = '#deb887';
        this.ctx.fillRect(-6, 0, 12, height / 2);

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawCentipedeSegment(segment, index) {
        const { x, y, width, height, color, glowColor } = segment;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Wiggle animation
        const wiggle = Math.sin(Date.now() / 50 + index) * 3;
        this.ctx.rotate(wiggle * Math.PI / 180);

        this.renderer.setGlow(glowColor, 15);

        // Body segments get smaller toward tail
        const sizeMultiplier = 1 - (index / this.centipede.length) * 0.3;
        const segWidth = width * sizeMultiplier;
        const segHeight = height * sizeMultiplier;

        // Main body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, segWidth / 2, segHeight / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Legs
        this.ctx.fillStyle = '#ff3300';
        const legCount = 4 + Math.floor(index / 3);
        for (let i = 0; i < legCount; i++) {
            const legY = -segHeight / 4 + (i * segHeight) / legCount;
            const legOffset = Math.sin(Date.now() / 30 + index) * 5;

            // Left leg
            this.ctx.beginPath();
            this.ctx.ellipse(-segWidth / 2 - 4, legY, 6, 3, -0.3 + legOffset * 0.02, 0, Math.PI * 2);
            this.ctx.fill();

            // Right leg
            this.ctx.beginPath();
            this.ctx.ellipse(segWidth / 2 + 4, legY, 6, 3, 0.3 - legOffset * 0.02, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Head features (only for head segment)
        if (index === 0) {
            // Antennae
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-5, -segHeight / 2);
            this.ctx.lineTo(-10, -segHeight / 2 - 10);
            this.ctx.moveTo(5, -segHeight / 2);
            this.ctx.lineTo(10, -segHeight / 2 - 10);
            this.ctx.stroke();

            // Eyes
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(-6, -segHeight / 4, 4, 0, Math.PI * 2);
            this.ctx.arc(6, -segHeight / 4, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawSpider(spider) {
        const { x, y, width, height, color, glowColor, frame } = spider;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 15);

        // Body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, width / 3, height / 3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Legs - animated
        const legPhase = Math.sin(frame) * 0.3;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        for (let i = 0; i < 4; i++) {
            const legY = -10 + i * 7;
            const legAngle = (i % 2 === 0 ? 1 : -1) * legPhase;

            // Left leg
            this.ctx.beginPath();
            this.ctx.moveTo(-8, legY);
            this.ctx.lineTo(-20 - Math.sin(legAngle) * 10, legY + Math.cos(legAngle) * 5);
            this.ctx.stroke();

            // Right leg
            this.ctx.beginPath();
            this.ctx.moveTo(8, legY);
            this.ctx.lineTo(20 + Math.sin(legAngle) * 10, legY + Math.cos(legAngle) * 5);
            this.ctx.stroke();
        }

        // Eyes
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(-4, -5, 3, 0, Math.PI * 2);
        this.ctx.arc(4, -5, 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 20);

        // Ship body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -height / 2);
        this.ctx.lineTo(width / 2, height / 2);
        this.ctx.lineTo(0, height / 2 - 8);
        this.ctx.lineTo(-width / 2, height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Cockpit
        this.ctx.fillStyle = '#00ffff';
        this.ctx.beginPath();
        this.ctx.arc(0, -5, 8, 0, Math.PI * 2);
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

        // Lives
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 30;
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.moveTo(lx, 20);
            this.ctx.lineTo(lx + 8, 30);
            this.ctx.lineTo(lx - 8, 30);
            this.ctx.closePath();
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
                    const newGame = new Centipede(this.container);
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
    module.exports = Centipede;
}
