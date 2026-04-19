/**
 * Donkey Kong - Modern Reimagining
 * Features: Platform physics, barrel rolling animations, climbing ladders
 */

class DonkeyKong extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.donkeyKong = null;
        this.pauline = null;
        this.barrels = [];
        this.platforms = [];
        this.ladders = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Physics
        this.gravity = 400;
        this.barrelTimer = 0; 
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(400);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.createLevel();
        this.createPlayer();
        this.createDonkeyKong();
        this.createPauline();
        this.barrels = [];
        this.barrelTimer = 0;
    }

    createLevel() {
        this.platforms = [];
        this.ladders = [];

        // Create sloped platforms (going up)
        const platformData = [
            { y: 550, width: 750, slope: 0 },
            { y: 470, width: 750, slope: 1 },
            { y: 390, width: 750, slope: 0 },
            { y: 310, width: 750, slope: 1 },
            { y: 230, width: 750, slope: 0 },
            { y: 150, width: 400, slope: 0 } // Top platform
        ];

        platformData.forEach((data, index) => {
            const x = data.slope ? 50 : 0;
            const w = data.width;
            this.platforms.push({
                x: x,
                y: data.y,
                width: w,
                height: 20,
                slope: data.slope,
                color: '#ff6b6b',
                glowColor: '#ff8888'
            });
        });

        // Create ladders
        const ladderData = [
            { x: 650, y: 470, height: 80 },
            { x: 100, y: 390, height: 80 },
            { x: 600, y: 310, height: 80 },
            { x: 150, y: 230, height: 80 },
            { x: 500, y: 150, height: 80 },
            { x: 350, y: 550, height: 80 } // Random ladder
        ];

        ladderData.forEach(data => {
            this.ladders.push({
                x: data.x,
                y: data.y,
                width: 30,
                height: data.height,
                color: '#4d96ff',
                glowColor: '#6ba7ff'
            });
        });
    }

    createPlayer() {
        this.player = {
            x: 50,
            y: 500,
            width: 30,
            height: 40,
            vx: 0,
            vy: 0,
            speed: 250,
            jumpForce: -400,
            onGround: false,
            onLadder: false,
            climbing: false,
            color: '#ff0000',
            glowColor: '#ff4444',
            direction: 'right',
            frame: 0
        };
    }

    createDonkeyKong() {
        this.donkeyKong = {
            x: 50,
            y: 100,
            width: 80,
            height: 60,
            frame: 0,
            state: 'idle', // idle, throw, taunt
            timer: 0
        };
    }

    createPauline() {
        this.pauline = {
            x: 320,
            y: 110,
            width: 25,
            height: 35,
            frame: 0,
            state: 'waiting'
        };
    }

    spawnBarrel() {
        this.barrels.push({
            x: this.donkeyKong.x + this.donkeyKong.width,
            y: this.donkeyKong.y + 30,
            width: 28,
            height: 28,
            vx: 100,
            vy: 0,
            rotation: 0,
            onGround: false,
            color: '#8B4513',
            glowColor: '#CD853F'
        });
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space') {
            this.jump();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    jump() {
        if (this.player.onGround && !this.player.climbing) {
            this.player.vy = this.player.jumpForce;
            this.player.onGround = false;
            this.audio.playSynth('square', { frequency: 300, slideTo: 500, duration: 0.15, volume: 0.1 });
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

        // Ladder climbing
        this.player.onLadder = this.checkLadderCollision();

        if (this.player.onLadder) {
            if (this.keys['ArrowUp'] || this.keys['KeyW']) {
                this.player.climbing = true;
                this.player.vy = -150;
            } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
                this.player.climbing = true;
                this.player.vy = 150;
            } else if (this.player.climbing) {
                this.player.vy = 0;
            }
        } else {
            this.player.climbing = false;
            // Apply gravity
            this.player.vy += this.gravity * dt;
        }

        // Update player position
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;

        // Platform collision
        this.player.onGround = false;
        this.platforms.forEach(platform => {
            if (this.checkPlatformCollision(platform)) {
                this.player.y = platform.y - this.player.height;
                this.player.vy = 0;
                this.player.onGround = true;

                // Move player with slope
                if (platform.slope) {
                    this.player.x += platform.slope * this.player.speed * dt;
                }
            }
        });

        // Keep player in bounds
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        // Update Donkey Kong
        this.donkeyKong.frame += dt * 5;
        this.donkeyKong.timer += dt;

        // Spawn barrels
        if (this.donkeyKong.timer > 3) {
            this.donkeyKong.timer = 0;
            this.donkeyKong.state = 'throw';
            this.spawnBarrel();
            this.audio.playSynth('square', { frequency: 150, slideTo: 100, duration: 0.2, volume: 0.15 });
        } else {
            this.donkeyKong.state = 'idle';
        }

        // Update barrels
        this.barrels.forEach((barrel, index) => {
            // Apply gravity
            barrel.vy += this.gravity * dt;

            // Move barrel
            barrel.x += barrel.vx * dt;
            barrel.y += barrel.vy * dt;

            // Rotation
            barrel.rotation += barrel.vx * 0.05;

            // Platform collision for barrels
            barrel.onGround = false;
            this.platforms.forEach(platform => {
                if (barrel.y + barrel.height > platform.y &&
                    barrel.y < platform.y + platform.height &&
                    barrel.x + barrel.width > platform.x &&
                    barrel.x < platform.x + platform.width) {

                    if (barrel.vy > 0 && barrel.y + barrel.height <= platform.y + 10) {
                        barrel.y = platform.y - barrel.height;
                        barrel.vy = 0;
                        barrel.onGround = true;

                        // Change direction at edge or randomly
                        if (barrel.x <= platform.x + 10 || barrel.x + barrel.width >= platform.x + platform.width - 10) {
                            barrel.vx *= -1;
                        }
                    }
                }
            });

            // Remove barrels that fall off screen
            if (barrel.y > this.canvas.height) {
                this.barrels.splice(index, 1);
            }

            // Check collision with player
            if (this.checkBarrelPlayerCollision(barrel)) {
                this.handlePlayerHit();
            }
        });

        // Check win condition (reach Pauline)
        if (this.checkWinCondition()) {
            this.nextLevel();
        }

        // Update particles
        this.particles.update(dt);

        // Update player animation
        if (this.player.vx !== 0 || this.player.climbing) {
            this.player.frame += dt * 10;
        }
    }

    checkLadderCollision() {
        for (const ladder of this.ladders) {
            if (this.player.x + this.player.width > ladder.x &&
                this.player.x < ladder.x + ladder.width &&
                this.player.y + this.player.height > ladder.y &&
                this.player.y < ladder.y + ladder.height) {
                return true;
            }
        }
        return false;
    }

    checkPlatformCollision(platform) {
        return this.player.x + this.player.width > platform.x &&
               this.player.x < platform.x + platform.width &&
               this.player.y + this.player.height > platform.y &&
               this.player.y + this.player.height < platform.y + platform.height + 10 &&
               this.player.vy >= 0;
    }

    checkBarrelPlayerCollision(barrel) {
        return this.player.x < barrel.x + barrel.width &&
               this.player.x + this.player.width > barrel.x &&
               this.player.y < barrel.y + barrel.height &&
               this.player.y + this.player.height > barrel.y;
    }

    checkWinCondition() {
        return this.player.x > this.pauline.x - 50 &&
               this.player.x < this.pauline.x + this.pauline.width + 50 &&
               this.player.y > this.pauline.y - 50 &&
               this.player.y < this.pauline.y + this.pauline.height;
    }

    handlePlayerHit() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: ['#ff0000', '#ffffff'], count: 40 }
        );
        this.shake(10);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.3, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            this.player.x = 50;
            this.player.y = 500;
            this.player.vx = 0;
            this.player.vy = 0;
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(1000);
        this.barrels = [];

        // Increase difficulty
        this.player.speed = Math.min(400, this.player.speed + 20);

        this.audio.playSynth('sine', { frequency: 523, slideTo: 1047, duration: 0.5, volume: 0.2 });
    }

    render() {
        // Clear with dark background
        this.clear('#0a0a1a');

        // Draw platforms
        this.platforms.forEach(platform => {
            this.drawPlatform(platform);
        });

        // Draw ladders
        this.ladders.forEach(ladder => {
            this.drawLadder(ladder);
        });

        // Draw Donkey Kong
        this.drawDonkeyKong();

        // Draw Pauline
        this.drawPauline();

        // Draw barrels
        this.barrels.forEach(barrel => {
            this.drawBarrel(barrel);
        });

        // Draw player
        this.drawPlayer();

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawPlatform(platform) {
        const { x, y, width, height, color, glowColor } = platform;

        this.ctx.save();
        this.renderer.setGlow(glowColor, 10);

        // Platform body with girder pattern
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        // Girder pattern - X shapes
        this.ctx.strokeStyle = '#cc5555';
        this.ctx.lineWidth = 2;
        const girderSpacing = 40;
        for (let gx = x; gx < x + width; gx += girderSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(gx, y);
            this.ctx.lineTo(gx + 20, y + height);
            this.ctx.moveTo(gx + 20, y);
            this.ctx.lineTo(gx, y + height);
            this.ctx.stroke();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawLadder(ladder) {
        const { x, y, width, height, color, glowColor } = ladder;

        this.ctx.save();
        this.renderer.setGlow(glowColor, 10);

        // Ladder sides
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, 5, height);
        this.ctx.fillRect(x + width - 5, y, 5, height);

        // Ladder rungs
        this.ctx.fillStyle = '#6ba7ff';
        const rungSpacing = 15;
        for (let ry = y; ry < y + height; ry += rungSpacing) {
            this.ctx.fillRect(x, ry, width, 4);
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawDonkeyKong() {
        const { x, y, width, height, frame, state } = this.donkeyKong;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Body
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 10, width / 2, height / 2 - 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Head
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.arc(0, -15, 20, 0, Math.PI * 2);
        this.ctx.fill();

        // Face
        this.ctx.fillStyle = '#CD853F';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -10, 15, 12, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-8, -15, 5, 0, Math.PI * 2);
        this.ctx.arc(8, -15, 5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-8, -15, 2, 0, Math.PI * 2);
        this.ctx.arc(8, -15, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Arms - animate based on state
        const armAngle = state === 'throw' ? Math.sin(frame) * 0.5 : Math.sin(frame * 0.5) * 0.2;

        this.ctx.fillStyle = '#8B4513';
        this.ctx.save();
        this.ctx.translate(-25, 0);
        this.ctx.rotate(armAngle - 0.5);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 20, 12, 25, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.save();
        this.ctx.translate(25, 0);
        this.ctx.rotate(-armAngle + 0.5);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 20, 12, 25, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.restore();
    }

    drawPauline() {
        const { x, y, width, height, frame } = this.pauline;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Dress
        this.ctx.fillStyle = '#ff69b4';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -10);
        this.ctx.lineTo(-10, 15);
        this.ctx.lineTo(10, 15);
        this.ctx.closePath();
        this.ctx.fill();

        // Head
        this.ctx.fillStyle = '#ffcc99';
        this.ctx.beginPath();
        this.ctx.arc(0, -15, 10, 0, Math.PI * 2);
        this.ctx.fill();

        // Hair
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.arc(0, -18, 10, Math.PI, 0);
        this.ctx.fill();

        // Help bubble
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('HELP!', 15, -25);

        this.ctx.restore();
    }

    drawBarrel(barrel) {
        const { x, y, width, height, rotation, color, glowColor } = barrel;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(rotation);

        this.renderer.setGlow(glowColor, 10);

        // Barrel body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Barrel bands
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(-width / 2 + 5, 0);
        this.ctx.lineTo(width / 2 - 5, 0);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(-width / 2 + 8, -8);
        this.ctx.lineTo(width / 2 - 8, 8);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(-width / 2 + 8, 8);
        this.ctx.lineTo(width / 2 - 8, -8);
        this.ctx.stroke();

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor, direction, frame, climbing } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Flip based on direction
        if (direction === 'left') {
            this.ctx.scale(-1, 1);
        }

        this.renderer.setGlow(glowColor, 15);

        if (climbing) {
            // Climbing pose
            const legOffset = Math.sin(frame) * 10;

            // Body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-10, -10, 20, 25);

            // Legs
            this.ctx.fillStyle = '#0000ff';
            this.ctx.fillRect(-10, 10, 8, 12 + legOffset);
            this.ctx.fillRect(2, 10, 8, 12 - legOffset);

            // Arms
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-15, -10, 8, 20);
            this.ctx.fillRect(7, -10, 8, 20);
        } else {
            // Running pose
            const legOffset = Math.sin(frame) * 8;

            // Body
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-10, -10, 20, 25);

            // Overalls
            this.ctx.fillStyle = '#0000ff';
            this.ctx.fillRect(-10, 5, 20, 15);

            // Legs
            this.ctx.fillStyle = '#0000ff';
            this.ctx.fillRect(-10, 15, 8, 10 + legOffset);
            this.ctx.fillRect(2, 15, 8, 10 - legOffset);

            // Arms
            this.ctx.fillStyle = color;
            this.ctx.fillRect(-15, -5, 8, 15);
            this.ctx.fillRect(7, -5, 8, 15);
        }

        // Head
        this.ctx.fillStyle = '#ffcc99';
        this.ctx.beginPath();
        this.ctx.arc(0, -15, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // Hat
        this.ctx.fillStyle = color;
        this.ctx.fillRect(-12, -22, 24, 8);
        this.ctx.fillRect(-8, -27, 16, 8);

        // Eyes
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(5, -15, 2, 0, Math.PI * 2);
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
            this.ctx.fillStyle = '#ff0000';
            this.ctx.fillRect(lx, 15, 20, 20);
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
                    const newGame = new DonkeyKong(this.container);
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
    module.exports = DonkeyKong;
}
