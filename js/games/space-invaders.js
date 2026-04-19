/**
 * Space Invaders - Modern Reimagining
 * Features: Neon aliens, particle explosions, smooth animations, power-ups
 */

class SpaceInvaders extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.aliens = [];
        this.bullets = [];
        this.alienBullets = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Game settings
        this.alienRows = 5;
        this.alienCols = 10;
        this.alienDirection = 1;
        this.alienSpeed = 0.5;
        this.alienDropAmount = 20;
        this.shootCooldown = 0;
        this.shootDelay = 0.25;

        // Power-ups
        this.powerUps = [];
        this.activePowerUp = null;
        this.powerUpTimer = 0;

        // Wave management
        this.wave = 1;
        this.score = 0;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(500);
        this.audio = new AudioController();
        this.audio.init();

        this.createPlayer();
        this.createAliens();
        this.bullets = [];
        this.alienBullets = [];
        this.powerUps = [];
        this.activePowerUp = null;
        this.alienDirection = 1;
        this.alienSpeed = 0.5 + (this.wave - 1) * 0.1;
        this.shootCooldown = 0;
 
        this.onScoreChange = (score) => {
            // Could update UI here
        };
    }

    createPlayer() {
        this.player = {
            x: this.canvas.width / 2 - 25,
            y: this.canvas.height - 60,
            width: 50,
            height: 30,
            speed: 400,
            color: '#00ffff',
            glowColor: '#00ffff'
        };
    }

    createAliens() {
        this.aliens = [];
        const colors = ['#ff0066', '#ff6600', '#ffff00', '#00ff00', '#00ffff'];
        const points = [30, 20, 15, 10, 5];

        for (let row = 0; row < this.alienRows; row++) {
            for (let col = 0; col < this.alienCols; col++) {
                this.aliens.push({
                    x: col * 60 + 50,
                    y: row * 45 + 50,
                    width: 40,
                    height: 30,
                    row: row,
                    col: col,
                    color: colors[row],
                    points: points[row],
                    type: row,
                    frame: 0,
                    alive: true
                });
            }
        }
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space' && this.shootCooldown <= 0) {
            this.shoot();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    handleKeyUpGame(e) {
        // Handle key releases if needed
    }

    handleTouchStart(x, y) {
        // Touch to shoot
        if (this.shootCooldown <= 0) {
            this.shoot();
        }
    }

    handleTouchMove(x, y) {
        // Move player to touch X position
        if (this.player) {
            this.player.x = x - this.player.width / 2;
            this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
        }
    }

    shoot() {
        const bulletType = this.activePowerUp === 'spread' ? 'spread' : 'normal';

        if (bulletType === 'spread') {
            // Three bullets in spread pattern
            for (let i = -1; i <= 1; i++) {
                this.bullets.push({
                    x: this.player.x + this.player.width / 2,
                    y: this.player.y,
                    width: 4,
                    height: 15,
                    vx: i * 100,
                    vy: -500,
                    color: '#00ff00',
                    glowColor: '#00ff00'
                });
            }
        } else {
            this.bullets.push({
                x: this.player.x + this.player.width / 2 - 2,
                y: this.player.y,
                width: 4,
                height: 15,
                vx: 0,
                vy: -500,
                color: '#00ff00',
                glowColor: '#00ff00'
            });
        }

        this.audio.playShoot();
        this.shootCooldown = this.shootDelay;
    }

    spawnAlienBullet(alien) {
        this.alienBullets.push({
            x: alien.x + alien.width / 2 - 3,
            y: alien.y + alien.height,
            width: 6,
            height: 12,
            vx: 0,
            vy: 200 + Math.random() * 100,
            color: '#ff0066',
            glowColor: '#ff0066'
        });
    }

    spawnPowerUp(x, y) {
        const types = ['spread', 'shield', 'speed', 'bomb'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = {
            spread: '#00ff00',
            shield: '#0088ff',
            speed: '#ffff00',
            bomb: '#ff0000'
        };

        this.powerUps.push({
            x: x,
            y: y,
            width: 25,
            height: 25,
            vx: 0,
            vy: 100,
            type: type,
            color: colors[type],
            active: true,
            frame: 0
        });
    }

    update(dt) {
        // Update shoot cooldown
        this.shootCooldown -= dt;

        // Player movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.x -= this.player.speed * dt;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.x += this.player.speed * dt;
        }

        // Speed power-up
        const speedMultiplier = this.activePowerUp === 'speed' ? 1.5 : 1;
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        // Update player trail
        if (this.keys['ArrowLeft'] || this.keys['ArrowRight'] || this.keys['KeyA'] || this.keys['KeyD']) {
            this.particles.trail(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height,
                { color: this.player.color, count: 2 }
            );
        }

        // Update aliens
        let shouldDrop = false;
        let shouldReverse = false;

        this.aliens.forEach(alien => {
            if (!alien.alive) return;

            alien.x += this.alienSpeed * this.alienDirection;

            // Check edges
            if (alien.x <= 10 || alien.x >= this.canvas.width - alien.width - 10) {
                shouldReverse = true;
            }

            // Random shooting
            if (Math.random() < 0.0005 * this.wave && alien.y < this.canvas.height - 150) {
                this.spawnAlienBullet(alien);
            }
        });

        if (shouldReverse) {
            this.alienDirection *= -1;
            shouldDrop = true;
        }

        if (shouldDrop) {
            this.aliens.forEach(alien => {
                alien.y += this.alienDropAmount;
                // Check if aliens reached player
                if (alien.y + alien.height >= this.player.y) {
                    this.gameOver();
                }
            });
        }

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;

            // Remove off-screen bullets
            if (bullet.y < -20) {
                this.bullets.splice(index, 1);
            }
        });

        this.alienBullets.forEach((bullet, index) => {
            bullet.y += bullet.vy * dt;

            if (bullet.y > this.canvas.height) {
                this.alienBullets.splice(index, 1);
            }
        });

        // Update power-ups
        this.powerUps.forEach((powerUp, index) => {
            powerUp.y += powerUp.vy * dt;
            powerUp.frame += dt * 5;

            if (powerUp.y > this.canvas.height) {
                this.powerUps.splice(index, 1);
            }

            // Check collision with player
            if (this.rectCollision(
                { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height },
                { x: powerUp.x, y: powerUp.y, width: powerUp.width, height: powerUp.height }
            )) {
                this.activatePowerUp(powerUp.type);
                this.powerUps.splice(index, 1);
                this.audio.playPowerUp();
            }
        });

        // Update power-up timer
        if (this.activePowerUp) {
            this.powerUpTimer -= dt;
            if (this.powerUpTimer <= 0) {
                this.activePowerUp = null;
            }
        }

        // Check collisions
        this.checkCollisions();

        // Check wave complete
        const aliveAliens = this.aliens.filter(a => a.alive);
        if (aliveAliens.length === 0) {
            this.nextWave();
        }

        // Update particles
        this.particles.update(dt);
    }

    checkCollisions() {
        // Player bullets vs aliens
        this.bullets.forEach((bullet, bIndex) => {
            this.aliens.forEach((alien) => {
                if (!alien.alive) return;

                if (this.rectCollision(
                    { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height },
                    { x: alien.x, y: alien.y, width: alien.width, height: alien.height }
                )) {
                    alien.alive = false;
                    this.bullets.splice(bIndex, 1);
                    this.addScore(alien.points);

                    // Explosion effect
                    this.particles.explode(
                        alien.x + alien.width / 2,
                        alien.y + alien.height / 2,
                        { colors: [alien.color, '#ffffff'], count: 20 }
                    );
                    this.audio.playSynth('square', { frequency: 200, slideTo: 50, duration: 0.15, volume: 0.1 });

                    // Chance to spawn power-up
                    if (Math.random() < 0.1) {
                        this.spawnPowerUp(alien.x + alien.width / 2, alien.y + alien.height / 2);
                    }
                }
            });
        });

        // Alien bullets vs player
        const playerRect = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };

        this.alienBullets.forEach((bullet, index) => {
            if (this.rectCollision(
                { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height },
                playerRect
            )) {
                if (this.activePowerUp === 'shield') {
                    this.activePowerUp = null;
                    this.powerUpTimer = 0;
                    this.alienBullets.splice(index, 1);
                    this.audio.playSynth('sine', { frequency: 300, duration: 0.2, volume: 0.2 });
                } else {
                    this.particles.explode(
                        this.player.x + this.player.width / 2,
                        this.player.y + this.player.height / 2,
                        { colors: [this.player.color, '#ffffff'], count: 50 }
                    );
                    this.shake(10);
                    this.gameOver();
                }
            }
        });

        // Aliens vs player (body collision)
        this.aliens.forEach(alien => {
            if (!alien.alive) return;
            if (this.rectCollision(
                { x: alien.x, y: alien.y, width: alien.width, height: alien.height },
                playerRect
            )) {
                this.gameOver();
            }
        });
    }

    activatePowerUp(type) {
        this.activePowerUp = type;
        this.powerUpTimer = 8; // 8 seconds

        const messages = {
            spread: 'SPREAD SHOT!',
            shield: 'SHIELD!',
            speed: 'SPEED BOOST!',
            bomb: 'BOMB!'
        };

        if (type === 'bomb') {
            // Destroy all aliens
            this.aliens.forEach(alien => {
                if (alien.alive) {
                    alien.alive = false;
                    this.addScore(alien.points);
                    this.particles.explode(
                        alien.x + alien.width / 2,
                        alien.y + alien.height / 2,
                        { count: 15 }
                    );
                }
            });
            this.audio.playExplosion();
        }
    }

    nextWave() {
        this.wave++;
        this.bullets = [];
        this.alienBullets = [];
        this.powerUps = [];
        this.activePowerUp = null;
        this.createAliens();
        this.audio.playPowerUp();

        // Show wave message
        setTimeout(() => {
            this.audio.playSynth('sine', { frequency: 440, slideTo: 880, duration: 0.3, volume: 0.2 });
        }, 100);
    }

    render() {
        // Clear with trail effect
        this.clearWithTrail(0.2);

        // Draw starfield background
        this.drawStarfield();

        // Draw power-ups
        this.powerUps.forEach(powerUp => {
            const pulse = Math.sin(powerUp.frame) * 0.2 + 0.8;
            this.renderer.drawGlowingRect(
                powerUp.x,
                powerUp.y,
                powerUp.width,
                powerUp.height,
                {
                    color: powerUp.color,
                    glowColor: powerUp.color,
                    glowBlur: 20 * pulse,
                    alpha: pulse
                }
            );

            // Draw power-up icon
            this.renderer.drawGlowingText(
                powerUp.type.charAt(0).toUpperCase(),
                powerUp.x + powerUp.width / 2,
                powerUp.y + powerUp.height / 2 + 5,
                { size: 18, color: '#ffffff', glowColor: powerUp.color }
            );
        });

        // Draw player
        this.drawPlayer();

        // Draw aliens
        this.aliens.forEach(alien => {
            if (!alien.alive) return;
            this.drawAlien(alien);
        });

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

        this.alienBullets.forEach(bullet => {
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

        // Draw power-up indicator
        if (this.activePowerUp) {
            this.drawPowerUpIndicator();
        }
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor } = this.player;

        // Draw ship body (triangle)
        this.ctx.save();
        this.ctx.translate(x + width / 2, y + height / 2);

        this.renderer.setGlow(glowColor, 20);
        this.ctx.fillStyle = color;

        // Main body
        this.ctx.beginPath();
        this.ctx.moveTo(0, -height / 2);
        this.ctx.lineTo(width / 2, height / 2);
        this.ctx.lineTo(0, height / 2 - 5);
        this.ctx.lineTo(-width / 2, height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Cockpit
        this.ctx.fillStyle = '#0088ff';
        this.ctx.beginPath();
        this.ctx.arc(0, -5, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Shield effect
        if (this.activePowerUp === 'shield') {
            this.ctx.strokeStyle = '#0088ff';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, width, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawAlien(alien) {
        const { x, y, width, height, color, type } = alien;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.renderer.setGlow(color, 15);
        this.ctx.fillStyle = color;

        // Different alien designs based on row/type
        switch (type) {
            case 0: // Top row - octopus-like
                this.ctx.beginPath();
                this.ctx.arc(cx, cy - 5, 12, Math.PI, 0);
                this.ctx.lineTo(x + width, cy + 8);
                // Tentacles
                const wave = Math.sin(Date.now() / 100) * 3;
                for (let i = 0; i < 4; i++) {
                    const tx = x + 8 + i * 10;
                    const ty = cy + 8 + (i % 2 === 0 ? wave : -wave);
                    this.ctx.lineTo(tx, ty);
                }
                this.ctx.closePath();
                this.ctx.fill();
                break;

            case 1: // Crab-like
                this.ctx.fillRect(x + 8, y + 5, width - 16, height - 10);
                // Claws
                this.ctx.fillRect(x, y + 8, 8, 6);
                this.ctx.fillRect(x + width - 8, y + 8, 8, 6);
                break;

            case 2: // Classic invader
                this.ctx.fillRect(x + 5, y, width - 10, height - 8);
                this.ctx.fillRect(x, y + 8, width, 8);
                // Antennae
                this.ctx.fillRect(x + 5, y - 5, 4, 8);
                this.ctx.fillRect(x + width - 9, y - 5, 4, 8);
                break;

            case 3: // Simple blob
                this.ctx.beginPath();
                this.ctx.ellipse(cx, cy, width / 2, height / 2 - 5, 0, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            default: // Basic
                this.ctx.fillRect(x, y, width, height);
        }

        // Eyes
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(cx - 8, cy - 3, 5, 5);
        this.ctx.fillRect(cx + 3, cy - 3, 5, 5);

        this.renderer.clearGlow();
    }

    drawStarfield() {
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = 0.5;

        // Simple procedural stars based on time
        const time = Date.now() / 1000;
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(i * 132.1 + time * 0.1) * 0.5 + 0.5) * this.canvas.width;
            const y = (Math.cos(i * 54.7 + time * 0.05) * 0.5 + 0.5) * this.canvas.height;
            const size = Math.sin(i * 7.3 + time) * 0.5 + 1;
            this.ctx.globalAlpha = Math.abs(Math.sin(time + i)) * 0.5 + 0.3;
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    drawHUD() {
        // Score
        this.renderer.drawGlowingText(`SCORE: ${this.score}`, 20, 35, {
            size: 24,
            color: '#00ff00',
            glowColor: '#00ff00'
        });

        // Wave
        this.renderer.drawGlowingText(`WAVE ${this.wave}`, this.canvas.width - 120, 35, {
            size: 24,
            color: '#ffff00',
            glowColor: '#ffff00'
        });

        // Lives (using player icons)
        for (let i = 0; i < this.lives; i++) {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.beginPath();
            const lx = 150 + i * 30;
            this.ctx.moveTo(lx, 25);
            this.ctx.lineTo(lx + 8, 35);
            this.ctx.lineTo(lx - 8, 35);
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    drawPowerUpIndicator() {
        const messages = {
            spread: 'SPREAD SHOT',
            shield: 'SHIELD',
            speed: 'SPEED',
            bomb: 'BOMB'
        };

        const barWidth = 150;
        const barHeight = 10;
        const x = this.canvas.width / 2 - barWidth / 2;
        const y = 50;

        // Background
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(x, y, barWidth, barHeight);

        // Fill based on timer
        const fillWidth = (this.powerUpTimer / 8) * barWidth;
        this.ctx.fillStyle = this.getPowerUpColor(this.activePowerUp);
        this.ctx.fillRect(x, y, fillWidth, barHeight);

        // Text
        this.renderer.drawGlowingText(
            messages[this.activePowerUp],
            this.canvas.width / 2,
            y - 5,
            { size: 16, color: '#ffffff', glowColor: this.getPowerUpColor(this.activePowerUp), align: 'center' }
        );
    }

    getPowerUpColor(type) {
        const colors = {
            spread: '#00ff00',
            shield: '#0088ff',
            speed: '#ffff00',
            bomb: '#ff0000'
        };
        return colors[type] || '#ffffff';
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

            // Add restart handler
            const restartHandler = () => {
                this.destroy();
                document.removeEventListener('keydown', restartHandler);
                this.canvas.removeEventListener('click', restartHandler);
                setTimeout(() => {
                    const newGame = new SpaceInvaders(this.container);
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
    module.exports = SpaceInvaders;
}
