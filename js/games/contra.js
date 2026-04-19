/**
 * Contra - Modern Reimagining
 * Features: Run-and-gun mechanics, multiple weapon types, explosive effects
 */

class Contra extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.platforms = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Weapon system
        this.weapons = { 
            normal: { name: 'Normal', fireRate: 0.3, bulletSpeed: 600, damage: 1, spread: 1 },
            spread: { name: 'Spread', fireRate: 0.4, bulletSpeed: 500, damage: 1, spread: 3 },
            laser: { name: 'Laser', fireRate: 0.2, bulletSpeed: 800, damage: 2, spread: 1 },
            machinegun: { name: 'Machine Gun', fireRate: 0.08, bulletSpeed: 700, damage: 1, spread: 1 }
        };

        this.levelWidth = 2000;
        this.cameraX = 0;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(600);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.createLevel();
        this.createPlayer();
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.fireCooldown = 0;
        this.weapon = 'normal';
        this.weaponTimer = 0;
    }

    createLevel() {
        this.platforms = [];

        // Ground platform
        this.platforms.push({ x: 0, y: 550, width: 2000, height: 50, color: '#4a4a4a', glowColor: '#666666' });

        // Elevated platforms
        const platformData = [
            { x: 200, y: 450, width: 150 },
            { x: 450, y: 380, width: 120 },
            { x: 650, y: 300, width: 200 },
            { x: 950, y: 400, width: 150 },
            { x: 1200, y: 350, width: 180 },
            { x: 1500, y: 280, width: 200 },
            { x: 1800, y: 200, width: 150 }
        ];

        platformData.forEach(data => {
            this.platforms.push({
                x: data.x,
                y: data.y,
                width: data.width,
                height: 20,
                color: '#8B4513',
                glowColor: '#CD853F'
            });
        });

        // Walls
        this.platforms.push({ x: -20, y: 0, width: 20, height: 600, color: '#333333', glowColor: '#555555' });
        this.platforms.push({ x: 2000, y: 0, width: 20, height: 600, color: '#333333', glowColor: '#555555' });
    }

    createPlayer() {
        this.player = {
            x: 100,
            y: 500,
            width: 35,
            height: 50,
            vx: 0,
            vy: 0,
            speed: 250,
            jumpForce: -400,
            onGround: false,
            color: '#0066ff',
            glowColor: '#0099ff',
            direction: 'right',
            frame: 0,
            state: 'running' // running, jumping, shooting
        };
    }

    spawnEnemy(x, y, type) {
        const enemyTypes = {
            soldier: { width: 30, height: 45, color: '#8B0000', glowColor: '#ff0000', health: 1, speed: 50 },
            running: { width: 30, height: 45, color: '#006400', glowColor: '#00ff00', health: 1, speed: 100 },
            turret: { width: 50, height: 40, color: '#4B0082', glowColor: '#9932cc', health: 3, speed: 0 },
            boss: { width: 80, height: 70, color: '#800080', glowColor: '#ff00ff', health: 20, speed: 30 }
        };

        const data = enemyTypes[type] || enemyTypes.soldier;

        this.enemies.push({
            x: x,
            y: y,
            width: data.width,
            height: data.height,
            vx: 0,
            vy: 0,
            speed: data.speed,
            color: data.color,
            glowColor: data.glowColor,
            type: type,
            health: data.health,
            maxHealth: data.health,
            direction: 'left',
            state: 'alive',
            shootCooldown: 0,
            frame: 0
        });
    }

    spawnPowerUp(x, y) {
        const types = ['spread', 'laser', 'machinegun', 'life'];
        const type = types[Math.floor(Math.random() * types.length)];

        this.particles.push({
            x: x,
            y: y,
            vx: 0,
            vy: -100,
            width: 25,
            height: 25,
            type: 'powerup',
            powerUpType: type,
            color: type === 'life' ? '#00ff00' : '#ffff00',
            glowColor: type === 'life' ? '#00ff88' : '#ffaa00',
            frame: 0
        });
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space' || e.code === 'KeyZ') {
            this.fire();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    fire() {
        if (this.fireCooldown <= 0) {
            const weapon = this.weapons[this.weapon];
            const centerX = this.player.x + this.player.width / 2;
            const centerY = this.player.y + this.player.height / 2;

            if (weapon.spread > 1) {
                // Spread shot
                for (let i = 0; i < weapon.spread; i++) {
                    const angle = -Math.PI / 2 + (i / (weapon.spread - 1)) * Math.PI / 3;
                    this.bullets.push({
                        x: centerX,
                        y: centerY,
                        vx: Math.cos(angle) * weapon.bulletSpeed,
                        vy: Math.sin(angle) * weapon.bulletSpeed,
                        width: 8,
                        height: 8,
                        color: '#00ffff',
                        glowColor: '#00ffff',
                        damage: weapon.damage
                    });
                }
            } else {
                // Normal shot - direction based
                const dirX = this.player.direction === 'right' ? 1 : -1;
                this.bullets.push({
                    x: centerX,
                    y: centerY,
                    vx: dirX * weapon.bulletSpeed,
                    vy: 0,
                    width: 10,
                    height: 6,
                    color: '#00ffff',
                    glowColor: '#00ffff',
                    damage: weapon.damage
                });
            }

            this.fireCooldown = weapon.fireRate;
            this.audio.playShoot();
        }
    }

    update(dt) {
        // Player movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.vx = -this.player.speed;
            this.player.direction = 'left';
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.vx = this.player.speed;
            this.player.direction = 'right';
        } else {
            this.player.vx = 0;
        }

        // Jump
        if ((this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space']) && this.player.onGround) {
            this.player.vy = this.player.jumpForce;
            this.player.onGround = false;
            this.audio.playSynth('sine', { frequency: 300, slideTo: 500, duration: 0.15, volume: 0.1 });
        }

        // Apply gravity
        this.player.vy += this.gravity * dt;

        // Update position
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;

        // Platform collision
        this.player.onGround = false;
        this.platforms.forEach(platform => {
            if (this.player.x + this.player.width > platform.x &&
                this.player.x < platform.x + platform.width &&
                this.player.y + this.player.height > platform.y &&
                this.player.y + this.player.height < platform.y + platform.height + 15 &&
                this.player.vy >= 0) {
                this.player.y = platform.y - this.player.height;
                this.player.vy = 0;
                this.player.onGround = true;
            }
        });

        // Keep in bounds
        this.player.x = Math.max(0, Math.min(this.levelWidth - this.player.width, this.player.x));

        // Update camera
        this.cameraX = Math.max(0, Math.min(this.levelWidth - this.canvas.width, this.player.x - this.canvas.width / 2));

        // Fire cooldown
        this.fireCooldown -= dt;

        // Weapon timer
        if (this.weapon !== 'normal') {
            this.weaponTimer -= dt;
            if (this.weaponTimer <= 0) {
                this.weapon = 'normal';
            }
        }

        // Spawn enemies
        if (this.enemies.length < 5 + this.level && Math.random() < 0.02) {
            const x = this.player.x + 400 + Math.random() * 400;
            const y = 500;
            const types = ['soldier', 'running', 'turret'];
            this.spawnEnemy(Math.min(x, this.levelWidth - 100), y, types[Math.floor(Math.random() * types.length)]);
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.state === 'dead') return;

            enemy.frame += dt * 5;

            if (enemy.type === 'running') {
                // Run toward player
                const dir = enemy.x > this.player.x ? -1 : 1;
                enemy.x += dir * enemy.speed * dt;
                enemy.direction = dir > 0 ? 'right' : 'left';
            } else if (enemy.type === 'turret') {
                // Shoot at player
                enemy.shootCooldown -= dt;
                if (enemy.shootCooldown <= 0 && Math.abs(enemy.x - this.player.x) < 400) {
                    this.spawnEnemyBullet(enemy);
                    enemy.shootCooldown = 2;
                }
            } else if (enemy.type === 'boss') {
                // Boss behavior
                enemy.shootCooldown -= dt;
                if (enemy.shootCooldown <= 0) {
                    // Spread shot
                    for (let i = 0; i < 5; i++) {
                        const angle = Math.PI + (i - 2) * 0.3;
                        this.enemyBullets.push({
                            x: enemy.x + enemy.width / 2,
                            y: enemy.y + enemy.height / 2,
                            vx: Math.cos(angle) * 200,
                            vy: Math.sin(angle) * 200,
                            width: 12,
                            height: 12,
                            color: '#ff0066',
                            glowColor: '#ff0044'
                        });
                    }
                    enemy.shootCooldown = 1.5;
                }
            } else {
                // Soldier - occasional shooting
                enemy.shootCooldown -= dt;
                if (enemy.shootCooldown <= 0 && Math.abs(enemy.x - this.player.x) < 300) {
                    this.spawnEnemyBullet(enemy);
                    enemy.shootCooldown = 1.5 + Math.random();
                }
            }

            // Check collision with player
            if (this.rectCollision(
                { x: this.player.x + 5, y: this.player.y + 5, width: this.player.width - 10, height: this.player.height - 10 },
                { x: enemy.x + 5, y: enemy.y + 5, width: enemy.width - 10, height: enemy.height - 10 }
            )) {
                this.handlePlayerHit();
            }
        });

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;

            // Remove off-screen bullets
            if (bullet.x < this.cameraX - 50 || bullet.x > this.cameraX + this.canvas.width + 50 ||
                bullet.y < -50 || bullet.y > this.canvas.height + 50) {
                this.bullets.splice(index, 1);
                return;
            }

            // Check enemy collision
            this.enemies.forEach(enemy => {
                if (enemy.state === 'dead') return;

                if (this.rectCollision(bullet, enemy)) {
                    enemy.health -= bullet.damage;
                    this.bullets.splice(index, 1);

                    // Hit effect
                    this.particles.trail(bullet.x, bullet.y, { color: '#00ffff', count: 5 });

                    if (enemy.health <= 0) {
                        enemy.state = 'dead';
                        this.addScore(enemy.type === 'boss' ? 5000 : enemy.type === 'turret' ? 500 : 100);

                        // Explosion
                        this.particles.explode(
                            enemy.x + enemy.width / 2,
                            enemy.y + enemy.height / 2,
                            { colors: [enemy.color, '#ff6600', '#ffffff'], count: 30 }
                        );
                        this.audio.playExplosion();

                        // Chance for powerup
                        if (Math.random() < 0.3) {
                            this.spawnPowerUp(enemy.x, enemy.y);
                        }
                    } else {
                        this.audio.playSynth('square', { frequency: 200, slideTo: 100, duration: 0.1, volume: 0.1 });
                    }
                }
            });
        });

        // Update enemy bullets
        this.enemyBullets.forEach((bullet, index) => {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;

            if (bullet.x < this.cameraX - 50 || bullet.x > this.cameraX + this.canvas.width + 50 ||
                bullet.y < -50 || bullet.y > this.canvas.height + 50) {
                this.enemyBullets.splice(index, 1);
                return;
            }

            // Check player collision
            if (this.rectCollision(
                bullet,
                { x: this.player.x + 5, y: this.player.y + 5, width: this.player.width - 10, height: this.player.height - 10 }
            )) {
                this.handlePlayerHit();
                this.enemyBullets.splice(index, 1);
            }
        });

        // Remove dead enemies
        this.enemies = this.enemies.filter(e => e.state !== 'dead');

        // Update particles
        this.particles.update(dt);

        // Animation
        if (this.player.vx !== 0) {
            this.player.frame += dt * 12;
        }
    }

    spawnEnemyBullet(enemy) {
        const dirX = enemy.x > this.player.x ? -1 : 1;
        this.enemyBullets.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            vx: dirX * 300,
            vy: 0,
            width: 10,
            height: 10,
            color: '#ff3366',
            glowColor: '#ff0044'
        });
    }

    handlePlayerHit() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: ['#0066ff', '#ffffff'], count: 50 }
        );
        this.shake(10);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.4, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            this.player.x = Math.max(100, this.cameraX + 100);
            this.player.y = 500;
            this.player.vy = 0;
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(1000);
        this.createLevel();
        this.createPlayer();
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.weapon = 'normal';

        this.audio.playSynth('sine', { frequency: 523, slideTo: 1047, duration: 0.5, volume: 0.2 });
    }

    render() {
        // Clear with dark background
        this.clear('#0a0a1a');

        this.ctx.save();
        this.ctx.translate(-this.cameraX, 0);

        // Draw platforms
        this.platforms.forEach(platform => {
            this.drawPlatform(platform);
        });

        // Draw enemies
        this.enemies.forEach(enemy => {
            this.drawEnemy(enemy);
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

        this.ctx.restore();

        // Draw particles (not affected by camera)
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawPlatform(platform) {
        const { x, y, width, height, color, glowColor } = platform;

        this.ctx.save();
        this.renderer.setGlow(glowColor, 10);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        // Top highlight
        this.ctx.fillStyle = glowColor;
        this.ctx.fillRect(x, y, width, 3);

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, glowColor, type, frame, health, maxHealth } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (enemy.direction === 'right') {
            this.ctx.scale(-1, 1);
        }

        this.renderer.setGlow(glowColor, 15);

        if (type === 'boss') {
            // Boss - large alien
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Spikes
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const sx = Math.cos(angle) * (width / 2 + 10);
                const sy = Math.sin(angle) * (height / 2 + 10);
                this.ctx.beginPath();
                this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Eye
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === 'turret') {
            // Turret
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Cannon
            this.ctx.fillStyle = glowColor;
            this.ctx.fillRect(0, -10, 30, 20);
        } else {
            // Soldier
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Head
            this.ctx.fillStyle = '#ffcc99';
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 10, 10, 0, Math.PI * 2);
            this.ctx.fill();

            // Helmet
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 8, 10, Math.PI, 0);
            this.ctx.fill();

            // Gun
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(5, 0, 20, 8);
        }

        // Health bar for boss
        if (type === 'boss' && health < maxHealth) {
            this.ctx.fillStyle = '#330000';
            this.ctx.fillRect(-40, -height / 2 - 20, 80, 8);
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(-40, -height / 2 - 20, 80 * (health / maxHealth), 8);
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor, direction, frame } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (direction === 'left') {
            this.ctx.scale(-1, 1);
        }

        this.renderer.setGlow(glowColor, 20);

        // Body
        this.ctx.fillStyle = color;
        this.ctx.fillRect(-width / 2, -height / 2 + 20, width, height - 20);

        // Bandana
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(-width / 2, -height / 2 + 5, width, 10);
        this.ctx.fillRect(-width / 2 - 8, -height / 2 + 5, 8, 5);

        // Head
        this.ctx.fillStyle = '#ffcc99';
        this.ctx.fillRect(-width / 2 + 5, -height / 2, width - 10, 15);

        // Muscles
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(-width / 2 + 8, -height / 2 + 25, 8, 0, Math.PI * 2);
        this.ctx.arc(width / 2 - 8, -height / 2 + 25, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Gun
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(5, -5, 35, 10);

        // Legs (animated)
        const legOffset = Math.sin(frame) * 10;
        this.ctx.fillStyle = '#000088';
        this.ctx.fillRect(-width / 2 + 3, height / 2 - 15 + legOffset, 10, 15);
        this.ctx.fillRect(width / 2 - 13, height / 2 - 15 - legOffset, 10, 15);

        // Weapon indicator
        if (this.weapon !== 'normal') {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(this.weapons[this.weapon].name.toUpperCase(), -20, -height / 2 - 10);
        }

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
        this.renderer.drawGlowingText(`STAGE ${this.level}`, this.canvas.width - 120, 35, {
            size: 24,
            color: '#ffff00',
            glowColor: '#ffff00'
        });

        // Lives
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 25;
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(lx, 18, 20, 14);
        }

        // Weapon timer
        if (this.weapon !== 'normal') {
            const barWidth = 100;
            const barHeight = 8;
            const x = this.canvas.width / 2 - barWidth / 2;
            const y = 25;

            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(x, y, barWidth, barHeight);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillRect(x, y, barWidth * (this.weaponTimer / 10), barHeight);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.weapons[this.weapon].name, this.canvas.width / 2, y - 5);
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
                    const newGame = new Contra(this.container);
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
    module.exports = Contra;
}
