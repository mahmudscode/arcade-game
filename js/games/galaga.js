/**
 * Galaga - Modern Reimagining
 * Features: Formation flying, swoop attacks, particle bomb effects
 */

class Galaga extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Formation settings
        this.formationCols = 8;
        this.formationRows = 4; 
        this.formationX = 100;
        this.formationY = 80;
        this.formationDir = 1;
        this.formationSpeed = 0.5;

        // Swooping enemies
        this.swoopingEnemies = [];
        this.swoopTimer = 0;

        // Star background
        this.stars = [];

        // Fighter capture
        this.capturedFighter = null;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(500);
        this.audio = new AudioController();
        this.audio.init();

        this.createStars();
        this.resetGame();
    }

    resetGame() {
        this.createPlayer();
        this.createEnemies();
        this.bullets = [];
        this.enemyBullets = [];
        this.swoopingEnemies = [];
        this.capturedFighter = null;
        this.formationX = 100;
        this.formationDir = 1;
        this.formationSpeed = 0.5 + (this.level - 1) * 0.1;
        this.shootCooldown = 0;
    }

    createPlayer() {
        this.player = {
            x: this.canvas.width / 2 - 25,
            y: this.canvas.height - 70,
            width: 50,
            height: 40,
            speed: 400,
            color: '#0088ff',
            glowColor: '#00ffff',
            invincible: false,
            invincibleTimer: 0
        };
    }

    createEnemies() {
        this.enemies = [];
        const enemyTypes = [
            { row: 0, color: '#ff0066', points: 300, wings: 'butterfly' },
            { row: 1, color: '#ff6600', points: 200, wings: 'bee' },
            { row: 2, color: '#ffff00', points: 150, wings: 'moth' },
            { row: 3, color: '#00ff00', points: 100, wings: 'basic' }
        ];

        for (let row = 0; row < this.formationRows; row++) {
            for (let col = 0; col < this.formationCols; col++) {
                const type = enemyTypes.find(t => t.row === row) || enemyTypes[3];
                this.enemies.push({
                    x: this.formationX + col * 65,
                    y: this.formationY + row * 50,
                    col: col,
                    row: row,
                    width: 45,
                    height: 35,
                    color: type.color,
                    points: type.points,
                    wings: type.wings,
                    alive: true,
                    inFormation: true,
                    swooping: false,
                    swoopAngle: 0,
                    frame: 0,
                    engineGlow: true
                });
            }
        }
    }

    createStars() {
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 20 + 5,
                brightness: Math.random()
            });
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

    shoot() {
        this.bullets.push({
            x: this.player.x + this.player.width / 2 - 3,
            y: this.player.y,
            width: 6,
            height: 20,
            vx: 0,
            vy: -600,
            color: '#00ffff',
            glowColor: '#00ffff'
        });

        this.audio.playShoot();
        this.shootCooldown = 0.2;
    }

    spawnEnemyBullet(enemy) {
        this.enemyBullets.push({
            x: enemy.x + enemy.width / 2 - 4,
            y: enemy.y + enemy.height,
            width: 8,
            height: 16,
            vx: Math.sin(enemy.swoopAngle) * 100,
            vy: 250 + Math.random() * 100,
            color: '#ff3366',
            glowColor: '#ff0044',
            spiral: enemy.spiralBullet || false
        });
    }

    startSwoop(enemy) {
        enemy.inFormation = false;
        enemy.swooping = true;
        enemy.swoopAngle = Math.PI / 2;
        enemy.swoopStartX = enemy.x;
        enemy.swoopStartY = enemy.y;
        enemy.swoopTargetX = this.player.x;
        enemy.swoopTimer = 0;
        enemy.spiralBullet = Math.random() < 0.3;
    }

    update(dt) {
        // Update stars
        this.stars.forEach(star => {
            star.y += star.speed * dt;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });

        // Update shoot cooldown
        this.shootCooldown -= dt;

        // Player movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.x -= this.player.speed * dt;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.x += this.player.speed * dt;
        }
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        // Player trail
        if (this.keys['ArrowLeft'] || this.keys['ArrowRight'] || this.keys['KeyA'] || this.keys['KeyD']) {
            this.particles.trail(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height,
                { color: '#0088ff', count: 2 }
            );
        }

        // Update formation movement
        let shouldReverse = false;
        this.enemies.forEach(enemy => {
            if (enemy.inFormation && enemy.alive) {
                enemy.x += this.formationSpeed * this.formationDir;
                enemy.frame += dt * 10;

                if (enemy.x <= 50 || enemy.x >= this.canvas.width - enemy.width - 50) {
                    shouldReverse = true;
                }
            }
        });

        if (shouldReverse) {
            this.formationDir *= -1;
            // Move formation down slightly
            this.enemies.forEach(enemy => {
                if (enemy.inFormation && enemy.alive) {
                    enemy.y += 10;
                }
            });
        }

        // Swoop timer
        this.swoopTimer += dt;
        if (this.swoopTimer > 2 && this.enemies.some(e => e.inFormation && e.alive)) {
            this.swoopTimer = 0;
            // Pick random enemy to swoop
            const formationEnemies = this.enemies.filter(e => e.inFormation && e.alive);
            if (formationEnemies.length > 0) {
                const enemy = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
                this.startSwoop(enemy);
            }
        }

        // Update swooping enemies
        this.enemies.forEach(enemy => {
            if (enemy.swooping && enemy.alive) {
                enemy.swoopTimer += dt;
                enemy.swoopAngle += dt * 2;

                // Swoop pattern - spiral down
                const progress = enemy.swoopTimer / 4;
                enemy.x = enemy.swoopStartX + Math.sin(enemy.swoopAngle) * 150 * progress;
                enemy.y = enemy.swoopStartY + progress * 400;

                // Shoot during swoop
                if (Math.random() < 0.02 && enemy.y < this.canvas.height - 200) {
                    this.spawnEnemyBullet(enemy);
                }

                // Enemy returns to formation or wraps around
                if (enemy.y > this.canvas.height + 50) {
                    enemy.swooping = false;
                    enemy.inFormation = true;
                    enemy.y = this.formationY + enemy.row * 50;
                    enemy.x = this.formationX + enemy.col * 65;
                }
            }
        });

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.y += bullet.vy * dt;
            if (bullet.y < -20) {
                this.bullets.splice(index, 1);
            }
        });

        this.enemyBullets.forEach((bullet, index) => {
            bullet.y += bullet.vy * dt;
            bullet.x += bullet.vx * dt;

            if (bullet.y > this.canvas.height) {
                this.enemyBullets.splice(index, 1);
            }
        });

        // Check collisions
        this.checkCollisions();

        // Check if enemies reached bottom
        this.enemies.forEach(enemy => {
            if (enemy.alive && enemy.y > this.player.y) {
                this.gameOver();
            }
        });

        // Update particles
        this.particles.update(dt);

        // Update player invincibility
        if (this.player.invincible) {
            this.player.invincibleTimer -= dt;
            if (this.player.invincibleTimer <= 0) {
                this.player.invincible = false;
            }
        }
    }

    checkCollisions() {
        // Player bullets vs enemies
        this.bullets.forEach((bullet, bIndex) => {
            this.enemies.forEach((enemy) => {
                if (!enemy.alive) return;

                if (this.rectCollision(
                    { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height },
                    { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height }
                )) {
                    enemy.alive = false;
                    this.bullets.splice(bIndex, 1);
                    this.addScore(enemy.points);

                    // Explosion effect
                    this.particles.explode(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2,
                        { colors: [enemy.color, '#ffffff', '#ffff00'], count: 25 }
                    );
                    this.audio.playSynth('square', { frequency: 300, slideTo: 100, duration: 0.2, volume: 0.15 });
                }
            });
        });

        // Enemy bullets vs player
        if (!this.player.invincible) {
            this.enemyBullets.forEach((bullet, index) => {
                if (this.rectCollision(
                    { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height },
                    { x: this.player.x + 5, y: this.player.y + 5, width: this.player.width - 10, height: this.player.height - 10 }
                )) {
                    this.handlePlayerHit();
                    this.enemyBullets.splice(index, 1);
                }
            });

            // Enemy body collision with player
            this.enemies.forEach(enemy => {
                if (enemy.alive && !this.player.invincible &&
                    this.rectCollision(
                        { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height },
                        { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height }
                    )) {
                    this.handlePlayerHit();
                }
            });
        }
    }

    handlePlayerHit() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: ['#0088ff', '#ffffff'], count: 50 }
        );
        this.shake(10);
        this.audio.playSynth('sawtooth', { frequency: 200, slideTo: 50, duration: 0.4, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            this.player.invincible = true;
            this.player.invincibleTimer = 2;
        }
    }

    render() {
        // Clear with black background
        this.clear('#000011');

        // Draw starfield
        this.drawStarfield();

        // Draw swooping enemies
        this.enemies.forEach(enemy => {
            if (enemy.alive) {
                this.drawEnemy(enemy);
            }
        });

        // Draw player
        if (!this.player.invincible || Math.floor(Date.now() / 100) % 2 === 0) {
            this.drawPlayer();
        }

        // Draw player bullets
        this.bullets.forEach(bullet => {
            this.renderer.drawGlowingRect(
                bullet.x,
                bullet.y,
                bullet.width,
                bullet.height,
                { color: bullet.color, glowColor: bullet.glowColor, glowBlur: 15 }
            );
        });

        // Draw enemy bullets
        this.enemyBullets.forEach(bullet => {
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

    drawStarfield() {
        this.ctx.save();
        this.stars.forEach(star => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, wings, frame } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Rotate if swooping
        if (enemy.swooping) {
            this.ctx.rotate(Math.sin(enemy.swoopAngle) * 0.3);
        }

        this.renderer.setGlow(color, 15);

        // Wing animation
        const wingFlap = Math.sin(frame) * 15;

        // Different enemy designs
        switch (wings) {
            case 'butterfly':
                // Large colorful wings
                this.ctx.fillStyle = color;
                this.ctx.save();
                this.ctx.translate(-15, 0);
                this.ctx.rotate(-wingFlap * Math.PI / 180);
                this.ctx.beginPath();
                this.ctx.ellipse(-10, 0, 15, 20, -0.3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();

                this.ctx.save();
                this.ctx.translate(15, 0);
                this.ctx.rotate(wingFlap * Math.PI / 180);
                this.ctx.beginPath();
                this.ctx.ellipse(10, 0, 15, 20, 0.3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();

                // Body
                this.ctx.fillStyle = '#ff6699';
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            case 'bee':
                // Striped body with small wings
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // Stripes
                this.ctx.fillStyle = '#000000';
                for (let i = -10; i <= 10; i += 8) {
                    this.ctx.fillRect(i, -8, 4, 16);
                }

                // Small wings
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                this.ctx.beginPath();
                this.ctx.ellipse(-15, -5, 12, 8, -0.5, 0, Math.PI * 2);
                this.ctx.ellipse(15, -5, 12, 8, 0.5, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            case 'moth':
                // Triangular wings
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.moveTo(-20, -10);
                this.ctx.lineTo(20, -10);
                this.ctx.lineTo(0, 15);
                this.ctx.closePath();
                this.ctx.fill();

                // Wing pattern
                this.ctx.fillStyle = '#884400';
                this.ctx.beginPath();
                this.ctx.arc(-10, -5, 5, 0, Math.PI * 2);
                this.ctx.arc(10, -5, 5, 0, Math.PI * 2);
                this.ctx.fill();
                break;

            default:
                // Basic beetle shape
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // Pincers
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(-15, 10);
                this.ctx.lineTo(-20, 15);
                this.ctx.moveTo(15, 10);
                this.ctx.lineTo(20, 15);
                this.ctx.stroke();
        }

        // Eyes
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(-6, -5, 4, 0, Math.PI * 2);
        this.ctx.arc(6, -5, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Engine glow
        this.ctx.fillStyle = '#ff6600';
        this.ctx.globalAlpha = 0.7 + Math.sin(frame * 2) * 0.3;
        this.ctx.beginPath();
        this.ctx.arc(0, 18, 6, 0, Math.PI * 2);
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

        // Main fighter body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -height / 2);
        this.ctx.lineTo(width / 2, height / 2);
        this.ctx.lineTo(0, height / 2 - 10);
        this.ctx.lineTo(-width / 2, height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Cockpit
        this.ctx.fillStyle = '#00ffff';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -5, 8, 12, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Wings
        this.ctx.fillStyle = '#0066cc';
        this.ctx.fillRect(-width / 2 - 10, 0, 12, 20);
        this.ctx.fillRect(width / 2 - 2, 0, 12, 20);

        // Engine flame
        this.ctx.fillStyle = '#ff6600';
        this.ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 50) * 0.2;
        this.ctx.beginPath();
        this.ctx.moveTo(-8, height / 2);
        this.ctx.lineTo(0, height / 2 + 20 + Math.random() * 10);
        this.ctx.lineTo(8, height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Invincibility shield
        if (this.player.invincible) {
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, width, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawHUD() {
        // Score
        this.renderer.drawGlowingText(`SCORE: ${this.score}`, 20, 35, {
            size: 24,
            color: '#00ffff',
            glowColor: '#00ffff'
        });

        // Level
        this.renderer.drawGlowingText(`LEVEL ${this.level}`, this.canvas.width - 120, 35, {
            size: 24,
            color: '#ffff00',
            glowColor: '#ffff00'
        });

        // Lives (fighter icons)
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 30;
            this.ctx.fillStyle = '#0088ff';
            this.ctx.beginPath();
            this.ctx.moveTo(lx, 20);
            this.ctx.lineTo(lx + 8, 30);
            this.ctx.lineTo(lx, 28);
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
                    const newGame = new Galaga(this.container);
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
    module.exports = Galaga;
}
