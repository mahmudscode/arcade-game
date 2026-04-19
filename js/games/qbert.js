/**
 * Q*bert - Modern Reimagining
 * Features: Isometric cube rendering, character bounce effects, dynamic lighting
 */

class Qbert extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.pyramid = [];
        this.enemies = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Pyramid settings
        this.rows = 7;
        this.cubeSize = 50;
        this.startX = 400;
        this.startY = 150;

        // Disc movement
        this.discs = []; 
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(300);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.createPyramid();
        this.createPlayer();
        this.enemies = [];
        this.discs = [];
        this.moveCooldown = 0;
        this.allCubesColored = false;
    }

    createPyramid() {
        this.pyramid = [];

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col <= row; col++) {
                const x = this.startX + (col - row / 2) * this.cubeSize;
                const y = this.startY + row * (this.cubeSize * 0.85);

                this.pyramid.push({
                    row: row,
                    col: col,
                    x: x,
                    y: y,
                    width: this.cubeSize,
                    height: this.cubeSize * 0.85,
                    color: '#8B008B',
                    targetColor: '#FFD700',
                    currentColor: '#8B008B',
                    colorProgress: 0,
                    isColored: false
                });
            }
        }
    }

    createPlayer() {
        // Start at top of pyramid
        this.player = {
            row: 0,
            col: 0,
            x: this.startX,
            y: this.startY,
            width: 35,
            height: 40,
            color: '#FF6600',
            glowColor: '#FF8833',
            bouncing: false,
            bounceHeight: 0,
            direction: 'center'
        };
        this.updatePlayerPosition();
    }

    getCubeAtPosition(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col > row) {
            return null;
        }
        return this.pyramid.find(c => c.row === row && c.col === col);
    }

    updatePlayerPosition() {
        const cube = this.getCubeAtPosition(this.player.row, this.player.col);
        if (cube) {
            this.player.x = cube.x + cube.width / 2 - this.player.width / 2;
            this.player.y = cube.y - this.player.bounceHeight;
        }
    }

    handleKeyDownGame(e) {
        if (this.moveCooldown > 0) return;

        let newRow = this.player.row;
        let newCol = this.player.col;

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                if (this.player.col > 0) {
                    newRow--;
                    newCol--;
                }
                break;
            case 'ArrowDown':
            case 'KeyS':
                if (this.player.col < this.player.row) {
                    newRow++;
                    newCol++;
                } else {
                    newRow++;
                }
                break;
            case 'ArrowLeft':
            case 'KeyA':
                if (this.player.col > 0) {
                    newRow--;
                }
                break;
            case 'ArrowRight':
            case 'KeyD':
                if (this.player.col < this.player.row) {
                    newRow++;
                    newCol++;
                }
                break;
            case 'KeyP':
                this.pause();
                return;
        }

        // Check if move is valid
        const targetCube = this.getCubeAtPosition(newRow, newCol);
        if (targetCube) {
            this.player.row = newRow;
            this.player.col = newCol;
            this.player.bouncing = true;
            this.player.bounceHeight = 0;
            this.player.direction = this.getDirection(newRow, newCol);

            // Jump sound
            this.audio.playSynth('sine', { frequency: 400, slideTo: 600, duration: 0.1, volume: 0.1 });

            // Color the cube
            targetCube.colorProgress = 1;
            targetCube.isColored = true;

            this.moveCooldown = 0.2;
        } else {
            // Invalid move - check if falling off pyramid
            this.handleFallOff();
        }
    }

    getDirection(newRow, newCol) {
        if (newRow < this.player.row) return 'up-left';
        if (newRow > this.player.row && newCol > this.player.col) return 'down-right';
        if (newRow > this.player.row) return 'down-left';
        return 'right';
    }

    handleFallOff() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height,
            { colors: ['#FF6600', '#ffffff'], count: 30 }
        );
        this.shake(5);
        this.audio.playSynth('sawtooth', { frequency: 200, slideTo: 50, duration: 0.3, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            this.player.row = 0;
            this.player.col = 0;
            this.updatePlayerPosition();
        }
    }

    spawnEnemy() {
        const enemyTypes = ['redball', 'greenball', 'samsam'];
        const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

        // Start enemy at edge of pyramid
        const startRow = Math.floor(Math.random() * this.rows);
        const startCol = Math.random() < 0.5 ? 0 : startRow;

        this.enemies.push({
            row: startRow,
            col: startCol,
            x: 0,
            y: 0,
            width: 35,
            height: 35,
            type: type,
            color: type === 'redball' ? '#ff0000' : type === 'greenball' ? '#00ff00' : '#0000ff',
            glowColor: type === 'redball' ? '#ff4444' : '#44ff44',
            speed: 0.5 + this.level * 0.1,
            direction: 'chase',
            moveTimer: 0
        });
        this.updateEnemyPosition(this.enemies[this.enemies.length - 1]);
    }

    updateEnemyPosition(enemy) {
        const cube = this.getCubeAtPosition(enemy.row, enemy.col);
        if (cube) {
            enemy.x = cube.x + cube.width / 2 - enemy.width / 2;
            enemy.y = cube.y;
        }
    }

    update(dt) {
        // Update move cooldown
        this.moveCooldown -= dt;

        // Update player bounce
        if (this.player.bouncing) {
            this.player.bounceHeight += dt * 200;
            if (this.player.bounceHeight > 30) {
                this.player.bouncing = false;
                this.player.bounceHeight = 0;
            }
            this.updatePlayerPosition();
        }

        // Update cube colors
        this.pyramid.forEach(cube => {
            if (cube.colorProgress > 0 && !cube.isColored) {
                cube.colorProgress -= dt * 0.5;
                if (cube.colorProgress <= 0) {
                    cube.colorProgress = 0;
                }
            }
        });

        // Check if all cubes are colored
        const uncoloredCubes = this.pyramid.filter(c => !c.isColored);
        if (uncoloredCubes.length === 0 && !this.allCubesColored) {
            this.allCubesColored = true;
            this.nextLevel();
            return;
        }

        // Spawn enemies periodically
        if (this.enemies.length < 2 + this.level && Math.random() < 0.01) {
            this.spawnEnemy();
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.moveTimer += dt;
            if (enemy.moveTimer > 0.5) {
                enemy.moveTimer = 0;

                // Simple chase AI
                const dx = this.player.row - enemy.row;
                const dy = this.player.col - enemy.col;

                let newRow = enemy.row;
                let newCol = enemy.col;

                if (Math.abs(dx) > Math.abs(dy)) {
                    if (dx > 0) newRow++;
                    else newRow--;
                } else {
                    if (dy > 0) newCol++;
                    else newCol--;
                }

                // Check if valid move
                if (this.getCubeAtPosition(newRow, newCol)) {
                    enemy.row = newRow;
                    enemy.col = newCol;
                    this.updateEnemyPosition(enemy);
                }
            }

            // Check collision with player
            if (enemy.row === this.player.row && enemy.col === this.player.col) {
                this.handlePlayerHit();
            }
        });

        // Update particles
        this.particles.update(dt);
    }

    handlePlayerHit() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: [this.player.color, '#ffffff'], count: 40 }
        );
        this.shake(8);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.3, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            this.player.row = 0;
            this.player.col = 0;
            this.updatePlayerPosition();

            // Clear some enemies
            this.enemies = this.enemies.slice(0, 1);
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(1000);
        this.allCubesColored = false;

        // Reset pyramid colors
        this.pyramid.forEach(cube => {
            cube.isColored = false;
            cube.colorProgress = 0;
        });

        // Reset player
        this.player.row = 0;
        this.player.col = 0;
        this.updatePlayerPosition();

        // Clear enemies
        this.enemies = [];

        this.audio.playSynth('sine', { frequency: 523, slideTo: 1047, duration: 0.5, volume: 0.2 });
    }

    render() {
        // Clear with gradient background
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#1a0033');
        bgGradient.addColorStop(1, '#000022');
        this.clear(bgGradient);

        // Draw stars
        this.drawStars();

        // Draw pyramid
        this.pyramid.forEach(cube => {
            this.drawCube(cube);
        });

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

    drawStars() {
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        const time = Date.now() / 1000;

        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(i * 132.1 + time * 0.1) * 0.5 + 0.5) * this.canvas.width;
            const y = (Math.cos(i * 54.7 + time * 0.05) * 0.5 + 0.5) * this.canvas.height;
            const brightness = 0.3 + Math.sin(time * 2 + i) * 0.7;
            this.ctx.globalAlpha = brightness;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawCube(cube) {
        const { x, y, width, height, color, targetColor, currentColor, colorProgress, isColored } = cube;
        const cx = x + width / 2;
        const cy = y;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Calculate current color based on progress
        let displayColor = color;
        if (isColored) {
            displayColor = targetColor;
        } else if (colorProgress > 0) {
            // Interpolate between colors
            displayColor = color;
        }

        // Isometric cube - draw three faces
        // Top face (diamond)
        this.ctx.fillStyle = this.lightenColor(displayColor, 30);
        this.ctx.beginPath();
        this.ctx.moveTo(0, -height / 2);
        this.ctx.lineTo(width / 2, 0);
        this.ctx.lineTo(0, height / 2);
        this.ctx.lineTo(-width / 2, 0);
        this.ctx.closePath();
        this.ctx.fill();

        // Left face
        this.ctx.fillStyle = this.darkenColor(displayColor, 20);
        this.ctx.beginPath();
        this.ctx.moveTo(-width / 2, 0);
        this.ctx.lineTo(0, height / 2);
        this.ctx.lineTo(0, height);
        this.ctx.lineTo(-width / 2, height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Right face
        this.ctx.fillStyle = displayColor;
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2, 0);
        this.ctx.lineTo(0, height / 2);
        this.ctx.lineTo(0, height);
        this.ctx.lineTo(width / 2, height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Glow effect for colored cubes
        if (isColored) {
            this.ctx.shadowColor = targetColor;
            this.ctx.shadowBlur = 20;
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillStyle = targetColor;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -height / 2 - 5);
            this.ctx.lineTo(width / 2 + 5, 0);
            this.ctx.lineTo(0, height / 2 + 5);
            this.ctx.lineTo(-width / 2 - 5, 0);
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Color progress indicator
        if (colorProgress > 0 && !isColored) {
            this.ctx.strokeStyle = targetColor;
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = colorProgress;
            this.ctx.strokeRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10);
        }

        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor, bounceHeight, direction } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2 - this.player.bounceHeight;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 20);

        // Body (sphere)
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Gradient highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(-5, -5, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.ellipse(-6, -3, 6, 8, 0, 0, Math.PI * 2);
        this.ctx.ellipse(6, -3, 6, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-6, -3, 3, 0, Math.PI * 2);
        this.ctx.arc(6, -3, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Nose (long snout)
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 10, 12, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Nostrils
        this.ctx.fillStyle = '#663300';
        this.ctx.beginPath();
        this.ctx.arc(-4, 10, 2, 0, Math.PI * 2);
        this.ctx.arc(4, 10, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Feet
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(-10, height / 2 - 5, 8, 5, 0, 0, Math.PI * 2);
        this.ctx.ellipse(10, height / 2 - 5, 8, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, glowColor, type } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 15);

        if (type === 'redball') {
            // Red ball - simple sphere
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Angry eyes
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
        } else if (type === 'greenball') {
            // Green ball - snake-like
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2, height / 3, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Tongue
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(10, 5);
            this.ctx.lineTo(20, 0);
            this.ctx.lineTo(25, 5);
            this.ctx.moveTo(20, 0);
            this.ctx.lineTo(25, -5);
            this.ctx.stroke();

            // Eyes
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(-5, -8, 5, 0, Math.PI * 2);
            this.ctx.arc(5, -8, 5, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Sam Sam - blue creature with crown
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(0, 5, width / 2 - 5, Math.PI, 0);
            this.ctx.fill();

            // Crown
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            this.ctx.moveTo(-15, -5);
            this.ctx.lineTo(-15, -15);
            this.ctx.lineTo(-5, -8);
            this.ctx.lineTo(5, -15);
            this.ctx.lineTo(15, -8);
            this.ctx.lineTo(15, -5);
            this.ctx.closePath();
            this.ctx.fill();

            // Eyes
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(-8, 0, 5, 0, Math.PI * 2);
            this.ctx.arc(8, 0, 5, 0, Math.PI * 2);
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

        // Lives (Q*bert icons)
        for (let i = 0; i < this.lives; i++) {
            const lx = 150 + i * 35;
            this.ctx.fillStyle = '#FF6600';
            this.ctx.beginPath();
            this.ctx.arc(lx, 25, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Little nose
            this.ctx.fillStyle = '#663300';
            this.ctx.beginPath();
            this.ctx.arc(lx + 8, 25, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Progress indicator
        const coloredCount = this.pyramid.filter(c => c.isColored).length;
        const totalCount = this.pyramid.length;
        const progress = coloredCount / totalCount;

        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(this.canvas.width / 2 - 100, 30, 200, 15);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(this.canvas.width / 2 - 100, 30, 200 * progress, 15);
    }

    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
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
                    const newGame = new Qbert(this.container);
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
    module.exports = Qbert;
}
