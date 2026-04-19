/**
 * Bubble Bobble - Modern Reimagining
 * Features: Bubble physics, enemy trapping, co-op support
 */

class BubbleBobble extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player1 = null;
        this.player2 = null;
        this.twoPlayer = false;
        this.enemies = [];
        this.bubbles = [];
        this.platforms = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Physics
        this.gravity = 300;
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
        this.createPlayer1();
        this.player2 = null;
        this.enemies = [];
        this.bubbles = [];
        this.bubbleTimer = 0;
    }

    createLevel() {
        this.platforms = [];

        // Create platform layout
        const platformData = [
            { x: 0, y: 550, width: 800 },
            { x: 0, y: 450, width: 350 },
            { x: 450, y: 450, width: 350 },
            { x: 100, y: 350, width: 600 },
            { x: 0, y: 250, width: 300 },
            { x: 500, y: 250, width: 300 },
            { x: 150, y: 150, width: 500 },
            { x: 250, y: 80, width: 300 }
        ];

        platformData.forEach(data => {
            this.platforms.push({
                x: data.x,
                y: data.y,
                width: data.width,
                height: 20,
                color: '#8B4513',
                glowColor: '#CD853F',
                passThrough: true
            });
        });
    }

    createPlayer1() {
        this.player1 = {
            x: 100,
            y: 500,
            width: 35,
            height: 40,
            vx: 0,
            vy: 0,
            speed: 200,
            jumpForce: -350,
            onGround: false,
            color: '#00ff00',
            glowColor: '#00ff88',
            direction: 'right',
            frame: 0,
            bubbleCooldown: 0,
            id: 1
        };
    }

    createPlayer2() {
        this.player2 = {
            x: 200,
            y: 500,
            width: 35,
            height: 40,
            vx: 0,
            vy: 0,
            speed: 200,
            jumpForce: -350,
            onGround: false,
            color: '#0088ff',
            glowColor: '#00ccff',
            direction: 'right',
            frame: 0,
            bubbleCooldown: 0,
            id: 2,
            active: true
        };
    }

    spawnEnemy() {
        const enemyTypes = ['zenchan', 'pulun'];
        const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

        this.enemies.push({
            x: 400 + Math.random() * 200,
            y: 100 + Math.random() * 200,
            width: 35,
            height: 35,
            vx: 50,
            vy: 0,
            speed: 40 + this.level * 5,
            type: type,
            color: type === 'zenchan' ? '#ff6600' : '#ff0066',
            glowColor: type === 'zenchan' ? '#ff8833' : '#ff3388',
            state: 'alive', // alive, inBubble, floating, dead
            bubbleTimer: 0,
            frame: 0,
            direction: 'left'
        });
    }

    createBubble(x, y, owner) {
        this.bubbles.push({
            x: x,
            y: y,
            vx: owner.direction === 'right' ? 250 : -250,
            vy: -50,
            width: 30,
            height: 35,
            owner: owner,
            state: 'flying', // flying, landed, popped
            timer: 3, // seconds before auto-pop
            color: owner.id === 1 ? '#00ff88' : '#00ccff',
            glowColor: owner.id === 1 ? '#00ffcc' : '#0088ff',
            trappedEnemy: null
        });
    }

    handleKeyDownGame(e) {
        // Player 1 controls
        if (e.code === 'KeyD') {
            this.player1.direction = 'right';
        }
        if (e.code === 'KeyA') {
            this.player1.direction = 'left';
        }
        if (e.code === 'KeyW' || e.code === 'Space') {
            this.jump(this.player1);
        }
        if (e.code === 'KeyF') {
            this.shootBubble(this.player1);
        }

        // Player 2 controls (if active)
        if (this.player2 && this.player2.active) {
            if (e.code === 'ArrowRight') {
                this.player2.direction = 'right';
            }
            if (e.code === 'ArrowLeft') {
                this.player2.direction = 'left';
            }
            if (e.code === 'ArrowUp') {
                this.jump(this.player2);
            }
            if (e.code === 'Enter') {
                this.shootBubble(this.player2);
            }
        }

        // Start 2-player mode
        if (e.code === 'KeyT' && !this.player2) {
            this.createPlayer2();
        }

        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    jump(player) {
        if (player.onGround) {
            player.vy = player.jumpForce;
            player.onGround = false;
            this.audio.playSynth('sine', { frequency: 400, slideTo: 600, duration: 0.1, volume: 0.1 });
        }
    }

    shootBubble(player) {
        if (player.bubbleCooldown <= 0) {
            this.createBubble(
                player.x + player.width / 2 - 15,
                player.y + player.height / 2,
                player
            );
            player.bubbleCooldown = 0.3;
            this.audio.playSynth('sine', { frequency: 600, slideTo: 800, duration: 0.15, volume: 0.1 });
        }
    }

    update(dt) {
        // Update players
        [this.player1, this.player2].forEach(player => {
            if (!player || !player.active) return;

            // Horizontal movement
            if (player.direction === 'right') {
                player.vx = player.speed;
            } else {
                player.vx = -player.speed;
            }

            // Apply gravity
            player.vy += this.gravity * dt;

            // Update position
            player.x += player.vx * dt;
            player.y += player.vy * dt;

            // Platform collision
            player.onGround = false;
            this.platforms.forEach(platform => {
                if (player.x + player.width > platform.x &&
                    player.x < platform.x + platform.width &&
                    player.y + player.height > platform.y &&
                    player.y + player.height < platform.y + platform.height + 15 &&
                    player.vy >= 0) {
                    player.y = platform.y - player.height;
                    player.vy = 0;
                    player.onGround = true;
                }
            });

            // Keep in bounds
            player.x = Math.max(0, Math.min(this.canvas.width - player.width, player.x));

            // Update cooldown
            player.bubbleCooldown -= dt;

            // Animation
            if (player.vx !== 0) {
                player.frame += dt * 10;
            }
        });

        // Spawn enemies
        if (this.enemies.length < 4 + this.level && Math.random() < 0.01) {
            this.spawnEnemy();
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.state === 'dead') return;

            enemy.frame += dt * 5;

            if (enemy.state === 'inBubble') {
                // Floating in bubble
                enemy.bubbleTimer += dt;
                enemy.y -= 30 * dt; // Float up

                // Check if bubble popped
                const inBubble = this.bubbles.find(b => b.trappedEnemy === enemy);
                if (!inBubble || enemy.bubbleTimer > 5) {
                    // Break free
                    enemy.state = 'alive';
                    enemy.bubbleTimer = 0;
                    this.audio.playSynth('square', { frequency: 200, slideTo: 300, duration: 0.15, volume: 0.1 });
                }
                return;
            }

            if (enemy.state === 'floating') {
                // Popped from bubble, falling
                enemy.vy += this.gravity * dt;
                enemy.y += enemy.vy * dt;

                if (enemy.y > this.canvas.height) {
                    enemy.state = 'dead';
                    this.addScore(500);
                    this.particles.explode(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height / 2,
                        { colors: [enemy.color, '#ffffff'], count: 30 }
                    );
                }
                return;
            }

            // Alive - moving AI
            enemy.x += enemy.vx * dt;

            // Change direction at walls or randomly
            if (enemy.x <= 0 || enemy.x >= this.canvas.width - enemy.width) {
                enemy.vx *= -1;
                enemy.direction = enemy.vx > 0 ? 'right' : 'left';
            }

            // Apply gravity
            enemy.vy += this.gravity * dt;
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

            // Change direction randomly
            if (Math.random() < 0.01) {
                enemy.vx *= -1;
                enemy.direction = enemy.vx > 0 ? 'right' : 'left';
            }

            // Check collision with players
            [this.player1, this.player2].forEach(player => {
                if (!player || !player.active) return;

                if (this.rectCollision(
                    { x: player.x + 5, y: player.y + 5, width: player.width - 10, height: player.height - 10 },
                    { x: enemy.x + 5, y: enemy.y + 5, width: enemy.width - 10, height: enemy.height - 10 }
                )) {
                    this.handlePlayerHit(player);
                }
            });
        });

        // Update bubbles
        this.bubbles.forEach((bubble, index) => {
            if (bubble.state === 'popped') return;

            bubble.timer -= dt;
            if (bubble.timer <= 0) {
                this.popBubble(bubble);
                return;
            }

            if (bubble.state === 'flying') {
                bubble.x += bubble.vx * dt;

                // Apply gravity
                bubble.vy += 50 * dt;
                bubble.y += bubble.vy * dt;

                // Check wall collision
                if (bubble.x <= 0 || bubble.x >= this.canvas.width - bubble.width) {
                    bubble.vx *= -1;
                }

                // Check platform collision
                this.platforms.forEach(platform => {
                    if (bubble.x + bubble.width > platform.x &&
                        bubble.x < platform.x + platform.width &&
                        bubble.y + bubble.height > platform.y &&
                        bubble.y < platform.y + platform.height) {
                        bubble.vy *= -0.5;
                        bubble.y = platform.y - bubble.height;
                        if (Math.abs(bubble.vy) < 10) {
                            bubble.state = 'landed';
                            bubble.vy = 0;
                        }
                    }
                });

                // Check enemy collision
                if (bubble.state === 'flying' && !bubble.trappedEnemy) {
                    this.enemies.forEach(enemy => {
                        if (enemy.state === 'alive' &&
                            this.rectCollision(bubble, enemy)) {
                            // Trap enemy
                            bubble.trappedEnemy = enemy;
                            bubble.state = 'landed';
                            bubble.vx = 0;
                            enemy.state = 'inBubble';
                            enemy.bubbleTimer = 0;
                            this.audio.playSynth('sine', { frequency: 500, slideTo: 700, duration: 0.2, volume: 0.1 });
                        }
                    });
                }
            }
        });

        // Remove old bubbles
        this.bubbles = this.bubbles.filter(b => b.state !== 'popped' && b.timer > 0);

        // Check win condition
        const aliveEnemies = this.enemies.filter(e => e.state === 'alive' || e.state === 'inBubble' || e.state === 'floating');
        if (aliveEnemies.length === 0 && this.enemies.length > 0) {
            this.nextLevel();
        }

        // Update particles
        this.particles.update(dt);
    }

    popBubble(bubble) {
        bubble.state = 'popped';

        if (bubble.trappedEnemy) {
            // Enemy breaks free
            bubble.trappedEnemy.state = 'alive';
            bubble.trappedEnemy.bubbleTimer = 0;
        }

        this.particles.explode(
            bubble.x + bubble.width / 2,
            bubble.y + bubble.height / 2,
            { colors: [bubble.color, '#ffffff'], count: 20 }
        );
        this.audio.playSynth('sine', { frequency: 800, slideTo: 400, duration: 0.15, volume: 0.1 });
    }

    handlePlayerHit(player) {
        this.particles.explode(
            player.x + player.width / 2,
            player.y + player.height / 2,
            { colors: [player.color, '#ffffff'], count: 40 }
        );
        this.shake(8);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.3, volume: 0.2 });

        if (player.id === 1) {
            this.removeLife();
        } else if (this.player2 && this.player2.active) {
            this.player2.active = false;
        }

        if (this.lives > 0 || (this.player2 && this.player2.active)) {
            player.x = 100 + (player.id - 1) * 100;
            player.y = 500;
            player.vy = 0;
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(1000);
        this.enemies = [];
        this.bubbles = [];

        // Restore player 2 if lost
        if (this.player2) {
            this.player2.active = true;
        }

        this.audio.playSynth('sine', { frequency: 523, slideTo: 1047, duration: 0.5, volume: 0.2 });
    }

    render() {
        // Clear with gradient background
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#001133');
        bgGradient.addColorStop(1, '#003366');
        this.clear(bgGradient);

        // Draw platforms
        this.platforms.forEach(platform => {
            this.drawPlatform(platform);
        });

        // Draw bubbles
        this.bubbles.forEach(bubble => {
            this.drawBubble(bubble);
        });

        // Draw enemies
        this.enemies.forEach(enemy => {
            if (enemy.state !== 'dead') {
                this.drawEnemy(enemy);
            }
        });

        // Draw players
        this.drawPlayer(this.player1);
        if (this.player2 && this.player2.active) {
            this.drawPlayer(this.player2);
        }

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawPlatform(platform) {
        const { x, y, width, height, color, glowColor } = platform;

        this.ctx.save();
        this.renderer.setGlow(glowColor, 10);

        // Platform body
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        // Top highlight
        this.ctx.fillStyle = '#CD853F';
        this.ctx.fillRect(x, y, width, 5);

        // Rivets
        this.ctx.fillStyle = '#654321';
        for (let rx = x + 20; rx < x + width; rx += 50) {
            this.ctx.beginPath();
            this.ctx.arc(rx, y + 10, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawBubble(bubble) {
        const { x, y, width, height, color, glowColor, trappedEnemy, timer } = bubble;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 15);

        // Bubble body
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Bubble shine
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.beginPath();
        this.ctx.ellipse(-8, -8, 6, 4, -0.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Timer indicator
        const timerRatio = timer / 3;
        this.ctx.strokeStyle = timerRatio < 0.3 ? '#ff0000' : 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, height / 2 + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * timerRatio));
        this.ctx.stroke();

        // Trapped enemy
        if (trappedEnemy) {
            this.ctx.save();
            this.ctx.scale(0.7, 0.7);
            this.ctx.fillStyle = trappedEnemy.color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Scared eyes
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(-4, -3, 4, 0, Math.PI * 2);
            this.ctx.arc(4, -3, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, glowColor, type, frame, state } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 15);

        if (state === 'inBubble') {
            // Just draw the enemy inside bubble (bubble renders separately)
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.5;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, width / 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        } else if (state === 'floating') {
            // Ghost form
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(0, -10, width / 2 - 5, Math.PI, 0);
            this.ctx.lineTo(width / 2 - 5, height / 2);
            // Wavy bottom
            for (let i = 0; i < 3; i++) {
                const wx = -width / 2 + 5 + (i * width / 3);
                this.ctx.lineTo(wx + width / 6, height / 2 - 5 + Math.sin(frame + i) * 5);
            }
            this.ctx.lineTo(-width / 2 + 5, height / 2);
            this.ctx.closePath();
            this.ctx.fill();
        } else {
            // Normal enemy
            if (type === 'zenchan') {
                // Zenchan - orange monster
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, width / 2, height / 2 - 5, 0, 0, Math.PI * 2);
                this.ctx.fill();

                // Stripes
                this.ctx.fillStyle = '#663300';
                for (let i = -10; i < 10; i += 8) {
                    this.ctx.fillRect(i, -10, 4, 20);
                }

                // Eyes
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(-8, -5, 6, 0, Math.PI * 2);
                this.ctx.arc(8, -5, 6, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillStyle = '#ff0000';
                this.ctx.beginPath();
                this.ctx.arc(-8, -5, 3, 0, Math.PI * 2);
                this.ctx.arc(8, -5, 3, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Pulun - pink monster
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(0, -5, width / 2 - 5, Math.PI, 0);
                this.ctx.lineTo(width / 2 - 5, height / 2);

                // Wavy bottom
                for (let i = 0; i < 4; i++) {
                    const wx = -width / 2 + 5 + (i * width / 4);
                    const offset = Math.sin(frame * 2 + i) * 5;
                    this.ctx.lineTo(wx + width / 8, height / 2 + offset);
                }
                this.ctx.closePath();
                this.ctx.fill();

                // Eyes
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(-6, -8, 5, 0, Math.PI * 2);
                this.ctx.arc(6, -8, 5, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillStyle = '#000000';
                this.ctx.beginPath();
                this.ctx.arc(-6, -8, 2, 0, Math.PI * 2);
                this.ctx.arc(6, -8, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer(player) {
        const { x, y, width, height, color, glowColor, direction, frame } = player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (direction === 'left') {
            this.ctx.scale(-1, 1);
        }

        this.renderer.setGlow(glowColor, 20);

        // Body (dinosaur-like)
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 5, width / 2 - 5, height / 2 - 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Belly
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 8, width / 3, height / 3 - 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Head
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(8, -15, 14, 0, Math.PI * 2);
        this.ctx.fill();

        // Snout
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(15, -12, 10, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(10, -18, 5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(12, -18, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Tail
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(-15, 5);
        const tailWag = Math.sin(frame) * 10;
        this.ctx.lineTo(-30, 0 + tailWag);
        this.ctx.lineTo(-15, -5);
        this.ctx.closePath();
        this.ctx.fill();

        // Feet
        this.ctx.fillStyle = color;
        const footOffset = Math.sin(frame) * 5;
        this.ctx.beginPath();
        this.ctx.ellipse(-8, 15 + footOffset, 8, 5, 0, 0, Math.PI * 2);
        this.ctx.ellipse(8, 15 - footOffset, 8, 5, 0, 0, Math.PI * 2);
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

        // Lives (bub icons)
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 30;
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.arc(lx, 25, 10, 0, Math.PI * 2);
            this.ctx.fill();
            // Little tail
            this.ctx.beginPath();
            this.ctx.moveTo(lx - 7, 25);
            this.ctx.lineTo(lx - 15, 25);
            this.ctx.stroke();
        }

        // Player 2 indicator
        if (this.player2 && !this.player2.active) {
            this.ctx.fillStyle = '#666666';
            this.ctx.fillText('P2 OUT', 280, 35);
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
                    const newGame = new BubbleBobble(this.container);
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
    module.exports = BubbleBobble;
}
