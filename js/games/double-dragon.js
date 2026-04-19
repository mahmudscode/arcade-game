/**
 * Double Dragon - Modern Reimagining
 * Features: Beat-em-up combat, combo system, special moves
 */

class DoubleDragon extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.enemies = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Combat system
        this.combo = 0;
        this.comboTimer = 0;
        this.specialMeter = 0;
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
        this.enemies = [];
        this.combo = 0;
        this.comboTimer = 0;
        this.specialMeter = 0;
        this.attackCooldown = 0;
        this.specialAttack = false;
    }

    createPlayer() {
        this.player = {
            x: 100,
            y: 450,
            width: 50,
            height: 70,
            vx: 0,
            vy: 0,
            speed: 200,
            color: '#0066ff',
            glowColor: '#0099ff',
            direction: 'right',
            state: 'idle', // idle, walking, punching, kicking, special, hit
            frame: 0,
            attackFrame: 0,
            hitStun: 0
        };
    }

    spawnEnemy(x, y, type) {
        const enemyTypes = {
            thug: { width: 50, height: 70, color: '#8B0000', glowColor: '#ff0000', health: 3, speed: 80, damage: 10 },
            bruiser: { width: 60, height: 75, color: '#006400', glowColor: '#00ff00', health: 5, speed: 60, damage: 15 },
            ninja: { width: 45, height: 65, color: '#4B0082', glowColor: '#9932cc', health: 2, speed: 150, damage: 8 }
        };

        const data = enemyTypes[type] || enemyTypes.thug;

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
            damage: data.damage,
            direction: 'left',
            state: 'idle',
            frame: 0,
            attackCooldown: 0,
            hitStun: 0
        });
    }

    handleKeyDownGame(e) {
        if (e.code === 'KeyZ' || e.code === 'Space') {
            this.punch();
        }
        if (e.code === 'KeyX') {
            this.kick();
        }
        if (e.code === 'KeyC' && this.specialMeter >= 100) {
            this.specialMove();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    punch() {
        if (this.attackCooldown <= 0 && this.player.state !== 'hit' && this.player.state !== 'punching') {
            this.player.state = 'punching';
            this.player.attackFrame = 0;
            this.attackCooldown = 0.4;

            // Check hit
            this.checkAttackHit(25, 15);
            this.audio.playSynth('square', { frequency: 200, slideTo: 150, duration: 0.1, volume: 0.15 });
        }
    }

    kick() {
        if (this.attackCooldown <= 0 && this.player.state !== 'hit' && this.player.state !== 'kicking') {
            this.player.state = 'kicking';
            this.player.attackFrame = 0;
            this.attackCooldown = 0.5;

            // Check hit
            this.checkAttackHit(35, 25);
            this.audio.playSynth('square', { frequency: 150, slideTo: 100, duration: 0.15, volume: 0.15 });
        }
    }

    specialMove() {
        if (this.player.state !== 'hit') {
            this.player.state = 'special';
            this.player.attackFrame = 0;
            this.specialMeter = 0;

            // Area attack
            this.enemies.forEach(enemy => {
                if (enemy.state !== 'dead' && Math.abs(enemy.x - this.player.x) < 200) {
                    enemy.health -= 3;
                    enemy.hitStun = 1;
                    enemy.x += this.player.direction === 'right' ? 50 : -50;
                    this.particles.explode(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2,
                        { colors: ['#ffff00', '#ffffff'], count: 20 }
                    );
                }
            });

            this.audio.playSynth('sawtooth', { frequency: 300, slideTo: 600, duration: 0.4, volume: 0.2 });
        }
    }

    checkAttackHit(range, damage) {
        const attackX = this.player.direction === 'right' ?
            this.player.x + this.player.width :
            this.player.x - range;

        this.enemies.forEach(enemy => {
            if (enemy.state === 'dead' || enemy.hitStun > 0) return;

            if (attackX < enemy.x + enemy.width &&
                attackX + range > enemy.x &&
                this.player.y < enemy.y + enemy.height &&
                this.player.y + this.player.height > enemy.y) {

                enemy.health -= damage;
                enemy.hitStun = 0.3;
                enemy.x += this.player.direction === 'right' ? 30 : -30;

                // Hit effect
                this.particles.explode(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    { colors: ['#ffffff', '#ff0000'], count: 15 }
                );

                // Combo
                this.combo++;
                this.comboTimer = 2;
                this.addScore(damage * 10 * this.combo);

                // Special meter
                this.specialMeter = Math.min(100, this.specialMeter + 10);

                if (enemy.health <= 0) {
                    enemy.state = 'dead';
                    this.addScore(500 * (1 + this.combo * 0.1));
                    this.particles.explode(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2,
                        { colors: [enemy.color, '#ffffff'], count: 40 }
                    );
                    this.audio.playExplosion();
                } else {
                    this.audio.playSynth('square', { frequency: 150, slideTo: 100, duration: 0.1, volume: 0.1 });
                }
            }
        });
    }

    update(dt) {
        // Player movement
        if (this.player.state !== 'hit' && this.player.state !== 'punching' && this.player.state !== 'kicking' && this.player.state !== 'special') {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                this.player.vx = -this.player.speed;
                this.player.direction = 'left';
                this.player.state = 'walking';
            } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                this.player.vx = this.player.speed;
                this.player.direction = 'right';
                player.state = 'walking';
            } else {
                this.player.vx = 0;
                if (this.player.state === 'walking') {
                    this.player.state = 'idle';
                }
            }
        }

        // Fix: player variable reference
        const player = this.player;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            player.vx = player.speed;
            player.direction = 'right';
            player.state = 'walking';
        }

        this.player.x += this.player.vx * dt;

        // Keep in bounds
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        // Update attack frames
        if (this.player.state === 'punching' || this.player.state === 'kicking' || this.player.state === 'special') {
            this.player.attackFrame += dt * 10;
            if (this.player.attackFrame > 5) {
                this.player.state = 'idle';
            }
        }

        // Update hit stun
        if (this.player.hitStun > 0) {
            this.player.hitStun -= dt;
            if (this.player.hitStun <= 0) {
                this.player.state = 'idle';
            }
        }

        // Update cooldowns
        this.attackCooldown -= dt;

        // Update combo
        if (this.combo > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }

        // Spawn enemies
        if (this.enemies.length < 4 + this.level && Math.random() < 0.02) {
            const types = ['thug', 'bruiser', 'ninja'];
            this.spawnEnemy(
                this.canvas.width + 50,
                450 + Math.random() * 50,
                types[Math.floor(Math.random() * types.length)]
            );
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.state === 'dead') return;

            enemy.frame += dt * 5;

            if (enemy.hitStun > 0) {
                enemy.hitStun -= dt;
                return;
            }

            // AI - move toward player
            const dx = this.player.x - enemy.x;
            const dist = Math.abs(dx);

            if (dist > 60) {
                enemy.vx = dx > 0 ? enemy.speed : -enemy.speed;
                enemy.direction = dx > 0 ? 'right' : 'left';
                enemy.state = 'walking';
            } else {
                enemy.vx = 0;
                enemy.state = 'idle';

                // Attack
                enemy.attackCooldown -= dt;
                if (enemy.attackCooldown <= 0) {
                    this.checkEnemyAttack(enemy);
                    enemy.attackCooldown = 1 + Math.random();
                }
            }

            enemy.x += enemy.vx * dt;

            // Keep in bounds
            enemy.x = Math.max(0, Math.min(this.canvas.width - enemy.width, enemy.x));
        });

        // Remove dead enemies
        this.enemies = this.enemies.filter(e => e.state !== 'dead');

        // Update particles
        this.particles.update(dt);

        // Animation
        if (this.player.vx !== 0) {
            this.player.frame += dt * 10;
        }
    }

    checkEnemyAttack(enemy) {
        if (this.rectCollision(
            { x: this.player.x + 10, y: this.player.y + 10, width: this.player.width - 20, height: this.player.height - 20 },
            { x: enemy.x + 10, y: enemy.y + 10, width: enemy.width - 20, height: enemy.height - 20 }
        )) {
            this.player.hitStun = 0.5;
            this.player.state = 'hit';
            this.player.x += enemy.direction === 'right' ? -30 : 30;
            this.shake(5);

            this.particles.explode(
                this.player.x + this.player.width / 2,
                this.player.y + this.player.height / 2,
                { colors: ['#ff0000', '#ffffff'], count: 20 }
            );

            this.audio.playSynth('sawtooth', { frequency: 100, slideTo: 50, duration: 0.2, volume: 0.15 });
        }
    }

    render() {
        // Clear with gradient background (street scene)
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#1a0033');
        bgGradient.addColorStop(0.5, '#331a4d');
        bgGradient.addColorStop(1, '#001a33');
        this.clear(bgGradient);

        // Draw background elements (buildings silhouette)
        this.drawBackground();

        // Draw ground
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 520, this.canvas.width, 80);

        // Draw enemies
        this.enemies.forEach(enemy => {
            this.drawEnemy(enemy);
        });

        // Draw player
        this.drawPlayer();

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawBackground() {
        // Building silhouettes
        this.ctx.fillStyle = '#0d0d1a';
        const buildings = [
            { x: 50, width: 100, height: 200 },
            { x: 180, width: 80, height: 150 },
            { x: 300, width: 120, height: 250 },
            { x: 450, width: 90, height: 180 },
            { x: 580, width: 110, height: 220 },
            { x: 720, width: 100, height: 160 }
        ];

        buildings.forEach(b => {
            this.ctx.fillRect(b.x, 600 - b.height, b.width, b.height);

            // Windows
            this.ctx.fillStyle = '#332244';
            for (let wy = 600 - b.height + 20; wy < 580; wy += 40) {
                for (let wx = b.x + 10; wx < b.x + b.width - 10; wx += 30) {
                    if (Math.random() < 0.7) {
                        this.ctx.fillRect(wx, wy, 20, 25);
                    }
                }
            }
            this.ctx.fillStyle = '#0d0d1a';
        });

        // Moon
        this.ctx.fillStyle = '#ffffcc';
        this.ctx.beginPath();
        this.ctx.arc(700, 100, 40, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, glowColor, type, frame, state, hitStun, health, maxHealth } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (enemy.direction === 'right') {
            this.ctx.scale(-1, 1);
        }

        // Flash when hit
        if (hitStun > 0) {
            this.ctx.globalAlpha = 0.5 + Math.sin(frame * 20) * 0.5;
        }

        this.renderer.setGlow(glowColor, 15);

        if (type === 'bruiser') {
            // Large muscular enemy
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Muscles
            this.ctx.beginPath();
            this.ctx.arc(-width / 2 + 10, -height / 2 + 15, 12, 0, Math.PI * 2);
            this.ctx.arc(width / 2 - 10, -height / 2 + 15, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Head
            this.ctx.fillStyle = '#cc9977';
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 5, 15, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === 'ninja') {
            // Ninja - agile
            this.ctx.fillStyle = color;

            // Body
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2 - 5, height / 2 - 10, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Head (covered)
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 10, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Eye slit
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(3, -height / 2 + 8, 8, 3);
        } else {
            // Thug - standard
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Head
            this.ctx.fillStyle = '#cc9977';
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 5, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Bandana
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(-width / 2, -height / 2 + 5, width, 8);
        }

        // Health bar
        if (health < maxHealth) {
            this.ctx.fillStyle = '#330000';
            this.ctx.fillRect(-20, -height / 2 - 15, 40, 5);
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(-20, -height / 2 - 15, 40 * (health / maxHealth), 5);
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor, direction, state, frame, attackFrame, hitStun } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (direction === 'left') {
            this.ctx.scale(-1, 1);
        }

        // Flash when hit
        if (hitStun > 0) {
            this.ctx.globalAlpha = 0.5 + Math.sin(frame * 20) * 0.5;
        }

        this.renderer.setGlow(glowColor, 20);

        if (state === 'punching') {
            // Punch pose
            const punchExt = Math.min(1, attackFrame / 3) * 30;

            // Body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Punching arm
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, -height / 2 + 20, 20 + punchExt, 15);

            // Fist
            this.ctx.fillStyle = '#ffcc99';
            this.ctx.fillRect(15 + punchExt, -height / 2 + 18, 15, 15);
        } else if (state === 'kicking') {
            // Kick pose
            const kickExt = Math.min(1, attackFrame / 3) * 40;

            // Body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Kicking leg
            this.ctx.fillStyle = '#000088';
            this.ctx.fillRect(0, height / 2 - 20, 30 + kickExt, 15);
        } else if (state === 'special') {
            // Special move - spinning kick
            this.ctx.rotate(attackFrame * 0.5);

            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Spin effect
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 50, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            // Idle or walking
            const legOffset = state === 'walking' ? Math.sin(frame) * 15 : 0;

            // Body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Head
            this.ctx.fillStyle = '#ffcc99';
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 10, 14, 0, Math.PI * 2);
            this.ctx.fill();

            // Hair
            this.ctx.fillStyle = '#663300';
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 8, 14, Math.PI, 0);
            this.ctx.fill();

            // Bandana tails
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(-width / 2, -height / 2 + 10, width, 8);
            this.ctx.fillRect(-width / 2 - 15, -height / 2 + 10, 15, 8);

            // Legs
            this.ctx.fillStyle = '#000088';
            this.ctx.fillRect(-width / 2 + 5, height / 2 - 20, 15, 20 + legOffset);
            this.ctx.fillRect(width / 2 - 20, height / 2 - 20, 15, 20 - legOffset);
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

        // Combo
        if (this.combo > 1) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${this.combo} HIT COMBO!`, this.canvas.width / 2, 50);
        }

        // Lives
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 30;
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(lx, 20, 25, 15);
        }

        // Special meter
        const barWidth = 150;
        const barHeight = 12;
        const x = this.canvas.width / 2 - barWidth / 2;
        const y = 20;

        this.ctx.fillStyle = '#330066';
        this.ctx.fillRect(x, y, barWidth, barHeight);
        this.ctx.fillStyle = this.specialMeter >= 100 ? '#ffff00' : '#9932cc';
        this.ctx.fillRect(x, y, barWidth * (this.specialMeter / 100), barHeight);

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, barWidth, barHeight);

        if (this.specialMeter >= 100) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PRESS C FOR SPECIAL!', this.canvas.width / 2, y - 5);
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
                    const newGame = new DoubleDragon(this.container);
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
    module.exports = DoubleDragon;
}
