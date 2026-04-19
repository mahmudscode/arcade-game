/**
 * Ghosts 'n Goblins - Modern Reimagining
 * Features: Armor mechanics, enemy variety, challenging platforming
 */

class GhostsNGoblins extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.platforms = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Armor system
        this.armorState = 'gold'; // gold, bronze, none
        this.armorHealth = 2;

        // Weapon system 
        this.weapon = 'lance'; // lance, dagger, magic
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(500);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.createLevel();
        this.createPlayer();
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.armorState = 'gold';
        this.armorHealth = 2;
        this.weapon = 'lance';
        this.fireCooldown = 0;
    }

    createLevel() {
        this.platforms = [];

        // Ground with gaps
        const groundSegments = [
            { x: 0, width: 300 },
            { x: 350, width: 250 },
            { x: 650, width: 150 }
        ];

        groundSegments.forEach(seg => {
            this.platforms.push({
                x: seg.x,
                y: 550,
                width: seg.width,
                height: 50,
                color: '#4a3728',
                glowColor: '#6b5344',
                type: 'ground'
            });
        });

        // Elevated platforms
        const platformData = [
            { x: 150, y: 450, width: 120 },
            { x: 350, y: 380, width: 100 },
            { x: 550, y: 300, width: 150 },
            { x: 200, y: 220, width: 100 },
            { x: 450, y: 150, width: 200 },
            { x: 700, y: 400, width: 80 }
        ];

        platformData.forEach(data => {
            this.platforms.push({
                x: data.x,
                y: data.y,
                width: data.width,
                height: 20,
                color: '#8B4513',
                glowColor: '#CD853F',
                type: 'platform'
            });
        });

        // Gravestones (obstacles)
        this.gravestones = [
            { x: 200, y: 520, width: 30, height: 40 },
            { x: 500, y: 520, width: 30, height: 40 },
            { x: 750, y: 520, width: 30, height: 40 }
        ];
    }

    createPlayer() {
        this.player = {
            x: 50,
            y: 500,
            width: 40,
            height: 60,
            vx: 0,
            vy: 0,
            speed: 180,
            jumpForce: -380,
            onGround: false,
            color: '#C0C0C0',
            glowColor: '#E0E0E0',
            direction: 'right',
            frame: 0,
            state: 'idle',
            attackFrame: 0,
            hitStun: 0,
            invincible: false,
            invincibleTimer: 0
        };
    }

    spawnEnemy(x, y, type) {
        const enemyTypes = {
            zombie: { width: 40, height: 55, color: '#2d5016', glowColor: '#3d6026', health: 2, speed: 40, type: 'ground' },
            ghost: { width: 45, height: 50, color: '#8B008B', glowColor: '#FF00FF', health: 1, speed: 80, type: 'flying' },
            skeleton: { width: 35, height: 55, color: '#F5F5DC', glowColor: '#ffffff', health: 2, speed: 60, type: 'ground' },
            demon: { width: 50, height: 60, color: '#8B0000', glowColor: '#ff0000', health: 4, speed: 50, type: 'ground' }
        };

        const data = enemyTypes[type] || enemyTypes.zombie;

        this.enemies.push({
            x: x,
            y: y,
            width: data.width,
            height: data.height,
            vx: data.type === 'flying' ? (Math.random() < 0.5 ? 50 : -50) : 0,
            vy: 0,
            speed: data.speed,
            color: data.color,
            glowColor: data.glowColor,
            type: type,
            enemyType: data.type,
            health: data.health,
            maxHealth: data.health,
            direction: 'left',
            state: 'alive',
            frame: 0,
            shootCooldown: Math.random() * 2
        });
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space' || e.code === 'KeyZ') {
            this.attack();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    attack() {
        if (this.fireCooldown <= 0 && this.player.state !== 'hit' && this.player.hitStun <= 0) {
            this.player.state = 'attacking';
            this.player.attackFrame = 0;
            this.fireCooldown = 0.4;

            // Create projectile based on weapon
            const dirX = this.player.direction === 'right' ? 1 : -1;

            if (this.weapon === 'lance') {
                this.projectiles.push({
                    x: this.player.x + (dirX > 0 ? this.player.width : 0),
                    y: this.player.y + this.player.height / 2 - 5,
                    vx: dirX * 400,
                    vy: 0,
                    width: 40,
                    height: 10,
                    color: '#C0C0C0',
                    glowColor: '#ffffff',
                    damage: 1
                });
            } else if (this.weapon === 'dagger') {
                this.projectiles.push({
                    x: this.player.x + this.player.width / 2,
                    y: this.player.y + this.player.height / 2,
                    vx: dirX * 500,
                    vy: -100,
                    width: 15,
                    height: 15,
                    color: '#FFD700',
                    glowColor: '#ffff00',
                    damage: 1
                });
            } else if (this.weapon === 'magic') {
                // Magic fireball
                this.projectiles.push({
                    x: this.player.x + this.player.width / 2,
                    y: this.player.y + this.player.height / 2,
                    vx: dirX * 350,
                    vy: 0,
                    width: 25,
                    height: 25,
                    color: '#ff6600',
                    glowColor: '#ff0000',
                    damage: 2
                });
            }

            this.audio.playSynth('square', { frequency: 300, slideTo: 200, duration: 0.15, volume: 0.15 });
        }
    }

    update(dt) {
        const gravity = 400;

        // Player movement
        if (this.player.hitStun <= 0) {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                this.player.vx = -this.player.speed;
                this.player.direction = 'left';
            } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                this.player.vx = this.player.speed;
                this.player.direction = 'right';
            } else {
                this.player.vx = 0;
            }

            if ((this.keys['ArrowUp'] || this.keys['KeyW']) && this.player.onGround) {
                this.player.vy = this.player.jumpForce;
                this.player.onGround = false;
                this.audio.playSynth('sine', { frequency: 300, slideTo: 500, duration: 0.15, volume: 0.1 });
            }
        }

        // Apply gravity
        if (!this.player.onGround) {
            this.player.vy += gravity * dt;
        }

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
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        // Update attack frame
        if (this.player.state === 'attacking') {
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

        // Update invincibility
        if (this.player.invincible) {
            this.player.invincibleTimer -= dt;
            if (this.player.invincibleTimer <= 0) {
                this.player.invincible = false;
            }
        }

        // Update cooldowns
        this.fireCooldown -= dt;

        // Spawn enemies
        if (this.enemies.length < 5 + this.level && Math.random() < 0.02) {
            const types = ['zombie', 'ghost', 'skeleton', 'demon'];
            const type = types[Math.floor(Math.random() * types.length)];
            let ex, ey;

            if (type === 'ghost') {
                ex = Math.random() < 0.5 ? -50 : this.canvas.width + 50;
                ey = 100 + Math.random() * 300;
            } else {
                ex = this.canvas.width + 50;
                ey = 500;
            }

            this.spawnEnemy(ex, ey, type);
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.state === 'dead') return;

            enemy.frame += dt * 5;

            if (enemy.enemyType === 'flying') {
                // Flying enemy - sine wave pattern
                enemy.x += enemy.vx * dt;
                enemy.y += Math.sin(enemy.frame) * 2;

                if (enemy.x < -100) enemy.x = this.canvas.width + 100;
                if (enemy.x > this.canvas.width + 100) enemy.x = -100;

                enemy.direction = enemy.vx > 0 ? 'right' : 'left';
            } else {
                // Ground enemy - walk toward player
                const dx = this.player.x - enemy.x;
                if (Math.abs(dx) > 50) {
                    enemy.vx = dx > 0 ? enemy.speed : -enemy.speed;
                } else {
                    enemy.vx = 0;
                }
                enemy.x += enemy.vx * dt;
                enemy.direction = enemy.vx > 0 ? 'right' : 'left';

                // Apply gravity
                enemy.vy += gravity * dt;
                enemy.y += enemy.vy * dt;

                // Platform collision
                let onGround = false;
                this.platforms.forEach(platform => {
                    if (enemy.x + enemy.width > platform.x &&
                        enemy.x < platform.x + platform.width &&
                        enemy.y + enemy.height > platform.y &&
                        enemy.y + enemy.height < platform.y + platform.height + 15 &&
                        enemy.vy >= 0) {
                        enemy.y = platform.y - enemy.height;
                        enemy.vy = 0;
                        onGround = true;
                    }
                });
            }

            // Shoot at player
            enemy.shootCooldown -= dt;
            if (enemy.shootCooldown <= 0 && Math.abs(enemy.x - this.player.x) < 400) {
                this.spawnEnemyProjectile(enemy);
                enemy.shootCooldown = 2 + Math.random();
            }

            // Check collision with player
            if (!this.player.invincible && this.rectCollision(
                { x: this.player.x + 10, y: this.player.y + 10, width: this.player.width - 20, height: this.player.height - 20 },
                { x: enemy.x + 5, y: enemy.y + 5, width: enemy.width - 10, height: enemy.height - 10 }
            )) {
                this.handlePlayerHit();
            }
        });

        // Update projectiles
        this.projectiles.forEach((proj, index) => {
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;

            // Remove off-screen
            if (proj.x < -100 || proj.x > this.canvas.width + 100) {
                this.projectiles.splice(index, 1);
                return;
            }

            // Check enemy collision
            this.enemies.forEach(enemy => {
                if (enemy.state === 'dead') return;

                if (this.rectCollision(proj, enemy)) {
                    enemy.health -= proj.damage;
                    this.projectiles.splice(index, 1);

                    // Hit effect
                    this.particles.trail(proj.x, proj.y, { color: proj.glowColor, count: 5 });

                    if (enemy.health <= 0) {
                        enemy.state = 'dead';
                        this.addScore(enemy.type === 'demon' ? 500 : enemy.type === 'ghost' ? 200 : 100);

                        this.particles.explode(
                            enemy.x + enemy.width / 2,
                            enemy.y + enemy.height / 2,
                            { colors: [enemy.color, '#ffffff'], count: 30 }
                        );
                        this.audio.playSynth('square', { frequency: 200, slideTo: 50, duration: 0.2, volume: 0.15 });
                    }
                }
            });
        });

        // Update enemy projectiles
        this.enemyProjectiles.forEach((proj, index) => {
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.vy += 200 * dt; // Gravity for some projectiles

            if (proj.x < -100 || proj.x > this.canvas.width + 100 || proj.y > this.canvas.height + 100) {
                this.enemyProjectiles.splice(index, 1);
                return;
            }

            // Check player collision
            if (!this.player.invincible && this.rectCollision(
                proj,
                { x: this.player.x + 10, y: this.player.y + 10, width: this.player.width - 20, height: this.player.height - 20 }
            )) {
                this.handlePlayerHit();
                this.enemyProjectiles.splice(index, 1);
            }
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

    spawnEnemyProjectile(enemy) {
        const dirX = enemy.x > this.player.x ? -1 : 1;
        const speed = 200;

        this.enemyProjectiles.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            vx: dirX * speed,
            vy: 0,
            width: 15,
            height: 15,
            color: enemy.type === 'ghost' ? '#8B008B' : '#00ff00',
            glowColor: enemy.type === 'ghost' ? '#FF00FF' : '#00ff00'
        });
    }

    handlePlayerHit() {
        this.armorHealth--;

        // Armor loss effect
        if (this.armorHealth <= 0) {
            if (this.armorState === 'gold') {
                this.armorState = 'bronze';
                this.armorHealth = 1;
                this.player.color = '#CD7F32';
                this.player.glowColor = '#CD7F32';
            } else if (this.armorState === 'bronze') {
                this.armorState = 'none';
                this.armorHealth = 0;
                this.player.color = '#ffcc99';
                this.player.glowColor = '#ffcc99';
            } else {
                // No armor - lose life
                this.particles.explode(
                    this.player.x + this.player.width / 2,
                    this.player.y + this.player.height / 2,
                    { colors: ['#ff0000', '#ffffff'], count: 50 }
                );
                this.shake(10);
                this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.4, volume: 0.2 });
                this.removeLife();

                if (this.lives > 0) {
                    this.respawnPlayer();
                }
                return;
            }
        }

        // Armor hit effect
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: [this.player.color, '#ffffff'], count: 20 }
        );

        this.player.hitStun = 0.5;
        this.player.state = 'hit';
        this.player.invincible = true;
        this.player.invincibleTimer = 1.5;
        this.player.x += this.player.direction === 'right' ? -30 : 30;

        this.audio.playSynth('square', { frequency: 150, slideTo: 100, duration: 0.2, volume: 0.15 });
    }

    respawnPlayer() {
        this.player.x = 50;
        this.player.y = 500;
        this.player.vy = 0;
        this.player.hitStun = 0;
        this.player.invincible = true;
        this.player.invincibleTimer = 2;
        this.armorState = 'gold';
        this.armorHealth = 2;
        this.player.color = '#C0C0C0';
        this.player.glowColor = '#E0E0E0';
    }

    render() {
        // Clear with spooky background
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#0a001a');
        bgGradient.addColorStop(0.5, '#1a0033');
        bgGradient.addColorStop(1, '#1a0a00');
        this.clear(bgGradient);

        // Draw background (graveyard scene)
        this.drawBackground();

        // Draw platforms
        this.platforms.forEach(platform => {
            this.drawPlatform(platform);
        });

        // Draw gravestones
        this.gravestones.forEach(gs => {
            this.drawGravestone(gs);
        });

        // Draw enemies
        this.enemies.forEach(enemy => {
            this.drawEnemy(enemy);
        });

        // Draw player
        this.drawPlayer();

        // Draw projectiles
        this.projectiles.forEach(proj => {
            this.renderer.drawGlowingRect(
                proj.x,
                proj.y,
                proj.width,
                proj.height,
                { color: proj.color, glowColor: proj.glowColor, glowBlur: 15 }
            );
        });

        // Draw enemy projectiles
        this.enemyProjectiles.forEach(proj => {
            this.ctx.fillStyle = proj.color;
            this.ctx.shadowColor = proj.glowColor;
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(proj.x + proj.width / 2, proj.y + proj.height / 2, proj.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawBackground() {
        // Moon
        this.ctx.fillStyle = '#ffffcc';
        this.ctx.beginPath();
        this.ctx.arc(700, 80, 50, 0, Math.PI * 2);
        this.ctx.fill();

        // Crosses in background
        this.ctx.fillStyle = '#1a0a2a';
        const crosses = [100, 250, 400, 550, 700];
        crosses.forEach(cx => {
            this.ctx.fillRect(cx, 480, 8, 50);
            this.ctx.fillRect(cx - 15, 500, 30, 8);
        });

        // Fog
        this.ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
        const time = Date.now() / 2000;
        for (let i = 0; i < 5; i++) {
            const fx = (i * 200 + time * 50) % (this.canvas.width + 200) - 100;
            this.ctx.beginPath();
            this.ctx.ellipse(fx, 560, 100, 30, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawPlatform(platform) {
        const { x, y, width, height, color, glowColor } = platform;

        this.ctx.save();
        this.renderer.setGlow(glowColor, 10);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        // Stone texture
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let tx = x + 10; tx < x + width; tx += 30) {
            this.ctx.fillRect(tx, y + 5, 20, 3);
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawGravestone(gs) {
        const { x, y, width, height } = gs;

        this.ctx.fillStyle = '#666666';
        this.ctx.beginPath();
        this.ctx.arc(x + width / 2, y + height / 2, width / 2, Math.PI, 0);
        this.ctx.fillRect(x, y + height / 2, width, height / 2);
        this.ctx.fill();

        // RIP text
        this.ctx.fillStyle = '#888888';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RIP', x + width / 2, y + height / 2 + 5);
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, glowColor, type, frame, enemyType } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (enemy.direction === 'right') {
            this.ctx.scale(-1, 1);
        }

        this.renderer.setGlow(glowColor, 15);

        if (type === 'zombie') {
            // Zombie - shambling
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Arms out
            this.ctx.fillRect(0, -height / 2 + 15, 25, 10);

            // Head
            this.ctx.fillStyle = '#4a6020';
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 10, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Glowing eyes
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.arc(5, -height / 2 + 8, 3, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === 'ghost') {
            // Ghost - floating
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(0, -10, width / 2 - 5, Math.PI, 0);

            // Wavy bottom
            for (let i = 0; i < 4; i++) {
                const wx = -width / 2 + 5 + (i * width / 4);
                this.ctx.lineTo(wx + width / 8, height / 2 + Math.sin(frame + i) * 8);
            }
            this.ctx.closePath();
            this.ctx.fill();

            // Eyes
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(-8, -10, 5, 0, Math.PI * 2);
            this.ctx.arc(8, -10, 5, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === 'skeleton') {
            // Skeleton
            this.ctx.fillStyle = color;

            // Ribs
            for (let i = 0; i < 5; i++) {
                this.ctx.fillRect(-width / 2 + 5, -height / 2 + 20 + i * 8, width - 10, 3);
            }

            // Spine
            this.ctx.fillRect(-3, -height / 2 + 15, 6, height - 25);

            // Skull
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 10, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Eye sockets
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(-4, -height / 2 + 8, 4, 0, Math.PI * 2);
            this.ctx.arc(4, -height / 2 + 8, 4, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === 'demon') {
            // Demon
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Horns
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.moveTo(-15, -height / 2);
            this.ctx.lineTo(-25, -height / 2 - 20);
            this.ctx.lineTo(-5, -height / 2);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(15, -height / 2);
            this.ctx.lineTo(25, -height / 2 - 20);
            this.ctx.lineTo(5, -height / 2);
            this.ctx.closePath();
            this.ctx.fill();

            // Wings
            this.ctx.fillStyle = '#4a0000';
            this.ctx.beginPath();
            this.ctx.moveTo(-width / 2, 0);
            this.ctx.lineTo(-40, -30);
            this.ctx.lineTo(-width / 2, 20);
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(width / 2, 0);
            this.ctx.lineTo(40, -30);
            this.ctx.lineTo(width / 2, 20);
            this.ctx.fill();

            // Eyes
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(-10, -height / 2 + 15, 5, 0, Math.PI * 2);
            this.ctx.arc(10, -height / 2 + 15, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor, direction, state, frame, attackFrame, invincible } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (direction === 'left') {
            this.ctx.scale(-1, 1);
        }

        // Flash when invincible
        if (invincible && Math.floor(frame * 10) % 2 === 0) {
            this.ctx.globalAlpha = 0.5;
        }

        this.renderer.setGlow(glowColor, 15);

        if (state === 'attacking') {
            // Attack pose
            const lanceExt = Math.min(1, attackFrame / 3) * 30;

            // Body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Lance
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(0, -height / 2 + 20, 30 + lanceExt, 6);

            // Lance tip
            this.ctx.fillStyle = '#C0C0C0';
            this.ctx.beginPath();
            this.ctx.moveTo(25 + lanceExt, -height / 2 + 17);
            this.ctx.lineTo(45 + lanceExt, -height / 2 + 23);
            this.ctx.lineTo(25 + lanceExt, -height / 2 + 29);
            this.ctx.closePath();
            this.ctx.fill();
        } else {
            // Idle or walking
            const legOffset = this.player.vx !== 0 ? Math.sin(frame) * 12 : 0;

            // Armor body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-width / 2, -height / 2, width, height);

            // Chest plate detail
            this.ctx.strokeStyle = glowColor;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-width / 2 + 5, -height / 2 + 10, width - 10, 25);

            // Helmet
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(0, -height / 2 + 10, 14, Math.PI, 0);
            this.ctx.fill();

            // Visor
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(5, -height / 2 + 8, 12, 6);

            // Legs
            this.ctx.fillStyle = '#666666';
            this.ctx.fillRect(-width / 2 + 5, height / 2 - 20, 12, 20 + legOffset);
            this.ctx.fillRect(width / 2 - 17, height / 2 - 20, 12, 20 - legOffset);

            // Cape
            this.ctx.fillStyle = '#8B0000';
            this.ctx.beginPath();
            this.ctx.moveTo(-width / 2, -height / 2 + 15);
            this.ctx.lineTo(-width / 2 - 15 - Math.sin(frame) * 5, height / 2 - 10);
            this.ctx.lineTo(-width / 2, height / 2 - 10);
            this.ctx.closePath();
            this.ctx.fill();
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
        this.renderer.drawGlowingText(`LEVEL ${this.level}`, this.canvas.width - 120, 35, {
            size: 24,
            color: '#ffff00',
            glowColor: '#ffff00'
        });

        // Armor indicator
        this.ctx.fillStyle = this.armorState === 'gold' ? '#FFD700' : this.armorState === 'bronze' ? '#CD7F32' : '#666666';
        this.ctx.fillRect(150, 20, 60, 15);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.armorState === 'none' ? 'NO ARMOR' : this.armorState.toUpperCase() + ' ARMOR', 150, 32);

        // Lives
        for (let i = 0; i < this.lives; i++) {
            const lx = 250 + i * 25;
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.moveTo(lx, 25);
            this.ctx.lineTo(lx + 8, 32);
            this.ctx.lineTo(lx - 8, 32);
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
                    const newGame = new GhostsNGoblins(this.container);
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
    module.exports = GhostsNGoblins;
}
