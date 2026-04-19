/**
 * Dig Dug - Modern Reimagining
 * Features: Dirt particle effects, enemy inflation animation, tunnel digging
 */

class DigDug extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.player = null;
        this.enemies = [];
        this.rocks = [];
        this.dirtParticles = [];
        this.particles = null;
        this.renderer = null;
        this.audio = null;

        // Grid settings
        this.gridSize = 40;
        this.cols = 20; 
        this.rows = 15;
        this.dirtGrid = [];

        // Digging
        this.digging = false;
        this.digDirection = null;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(400);
        this.audio = new AudioController();
        this.audio.init();

        this.resetGame();
    }

    resetGame() {
        this.createDirtGrid();
        this.createPlayer();
        this.createEnemies();
        this.createRocks();
        this.dirtParticles = [];
        this.pumpCooldown = 0;
    }

    createDirtGrid() {
        this.dirtGrid = [];
        for (let row = 0; row < this.rows; row++) {
            this.dirtGrid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                // Leave some empty spaces for tunnels
                if (row === 0 || col === 0 || col === this.cols - 1 ||
                    (row === 1 && col > 2 && col < this.cols - 2) ||
                    (Math.random() < 0.1 && row > 2)) {
                    this.dirtGrid[row][col] = null;
                } else {
                    this.dirtGrid[row][col] = {
                        health: 1,
                        type: Math.random() < 0.3 ? 'rock' : 'dirt',
                        color: Math.random() < 0.5 ? '#8B4513' : '#A0522D'
                    };
                }
            }
        }

        // Clear starting area
        const startRow = Math.floor(this.rows / 2);
        const startCol = Math.floor(this.cols / 2);
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const r = startRow + dr;
                const c = startCol + dc;
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
                    this.dirtGrid[r][c] = null;
                }
            }
        }
    }

    createPlayer() {
        this.player = {
            x: (Math.floor(this.cols / 2)) * this.gridSize + 10,
            y: (Math.floor(this.rows / 2)) * this.gridSize + 10,
            width: 30,
            height: 35,
            speed: 200,
            color: '#0066ff',
            glowColor: '#0099ff',
            direction: 'right',
            pumping: false,
            pumpLength: 0,
            inflatingEnemy: null
        };
    }

    createEnemies() {
        this.enemies = [];
        const enemyTypes = ['pooka', 'fygar'];

        for (let i = 0; i < 4 + this.level; i++) {
            let validPosition = false;
            let x, y, row, col;

            while (!validPosition) {
                col = Math.floor(Math.random() * this.cols);
                row = Math.floor(Math.random() * this.rows);
                x = col * this.gridSize + 10;
                y = row * this.gridSize + 10;

                // Make sure it's in an empty cell
                if (this.dirtGrid[row] && this.dirtGrid[row][col] === null) {
                    validPosition = true;
                }
            }

            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            this.enemies.push({
                x: x,
                y: y,
                width: 35,
                height: 35,
                speed: 60 + this.level * 5,
                type: type,
                color: type === 'pooka' ? '#ff6600' : '#00cc66',
                glowColor: type === 'pooka' ? '#ff8833' : '#00ff88',
                state: 'chase', // chase, flee, inflated, dead
                direction: 'left',
                inflateTimer: 0,
                deathTimer: 0,
                frame: 0
            });
        }
    }

    createRocks() {
        this.rocks = [];
        const rockPositions = [
            { row: 2, col: 5 }, { row: 2, col: 15 },
            { row: 5, col: 3 }, { row: 5, col: 17 },
            { row: 8, col: 8 }, { row: 8, col: 12 },
            { row: 11, col: 5 }, { row: 11, col: 15 }
        ];

        rockPositions.forEach(pos => {
            if (pos.row < this.rows && pos.col < this.cols) {
                this.rocks.push({
                    x: pos.col * this.gridSize + 5,
                    y: pos.row * this.gridSize,
                    width: 30,
                    height: 30,
                    state: 'resting', // resting, falling, landed
                    fallSpeed: 0,
                    color: '#696969',
                    glowColor: '#808080'
                });
            }
        });
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space') {
            this.startPump();
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    startPump() {
        // Find nearest enemy in pump direction
        let nearestEnemy = null;
        let minDist = Infinity;

        this.enemies.forEach(enemy => {
            if (enemy.state === 'inflated' || enemy.state === 'dead') return;

            let inRange = false;
            let dist = 0;

            if (this.player.direction === 'right' && enemy.y > this.player.y - 20 && enemy.y < this.player.y + 20 && enemy.x > this.player.x) {
                dist = enemy.x - this.player.x;
                inRange = dist < 200;
            } else if (this.player.direction === 'left' && enemy.y > this.player.y - 20 && enemy.y < this.player.y + 20 && enemy.x < this.player.x) {
                dist = this.player.x - enemy.x;
                inRange = dist < 200;
            } else if (this.player.direction === 'up' && enemy.x > this.player.x - 20 && enemy.x < this.player.x + 20 && enemy.y < this.player.y) {
                dist = this.player.y - enemy.y;
                inRange = dist < 200;
            } else if (this.player.direction === 'down' && enemy.x > this.player.x - 20 && enemy.x < this.player.x + 20 && enemy.y > this.player.y) {
                dist = enemy.y - this.player.y;
                inRange = dist < 200;
            }

            if (inRange && dist < minDist) {
                minDist = dist;
                nearestEnemy = enemy;
            }
        });

        if (nearestEnemy) {
            this.player.pumping = true;
            this.player.inflatingEnemy = nearestEnemy;
            this.player.pumpLength = 0;
        }
    }

    update(dt) {
        // Player movement
        let dx = 0, dy = 0;
        let newCol, newRow;

        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            dx = -this.player.speed * dt;
            this.player.direction = 'left';
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            dx = this.player.speed * dt;
            this.player.direction = 'right';
        }
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            dy = -this.player.speed * dt;
            this.player.direction = 'up';
        }
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            dy = this.player.speed * dt;
            this.player.direction = 'down';
        }

        // Calculate new position
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // Check if we can move there (dirt collision)
        newCol = Math.floor((newX + this.player.width / 2) / this.gridSize);
        newRow = Math.floor((newY + this.player.height / 2) / this.gridSize);

        // Check dirt grid collision
        if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols) {
            if (this.dirtGrid[newRow][newCol] !== null) {
                // Dig through dirt
                this.digDirt(newRow, newCol, dt);
            } else {
                // Move freely
                this.player.x = newX;
                this.player.y = newY;
            }
        } else {
            // Out of bounds - don't move
            if (dx !== 0) this.player.x = newX;
            if (dy !== 0) this.player.y = newY;
        }

        // Keep player in bounds
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
        this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.height, this.player.y));

        // Update pump
        if (this.player.pumping && this.player.inflatingEnemy) {
            this.player.pumpLength += dt * 30;
            this.player.inflatingEnemy.inflateTimer += dt;

            // Check if enemy is fully inflated
            if (this.player.inflatingEnemy.inflateTimer > 2) {
                this.popEnemy(this.player.inflatingEnemy);
                this.player.pumping = false;
                this.player.inflatingEnemy = null;
                this.player.pumpLength = 0;
            }
        } else {
            this.player.pumping = false;
            this.player.inflatingEnemy = null;
            this.player.pumpLength = 0;
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.state === 'dead') {
                enemy.deathTimer += dt;
                if (enemy.deathTimer > 1) {
                    enemy.state = 'respawning';
                }
                return;
            }

            if (enemy.state === 'inflated') return;

            enemy.frame += dt * 5;

            // Simple AI - move toward player
            const dirX = this.player.x - enemy.x;
            const dirY = this.player.y - enemy.y;
            const dist = Math.sqrt(dirX * dirX + dirY * dirY);

            if (dist > 0) {
                const moveX = (dirX / dist) * enemy.speed * dt;
                const moveY = (dirY / dist) * enemy.speed * dt;

                // Check if enemy can move (no dirt)
                const enemyCol = Math.floor((enemy.x + enemy.width / 2) / this.gridSize);
                const enemyRow = Math.floor((enemy.y + enemy.height / 2) / this.gridSize);

                if (this.dirtGrid[enemyRow] && this.dirtGrid[enemyRow][enemyCol] === null) {
                    enemy.x += moveX;
                    enemy.y += moveY;
                }
            }

            // Check collision with player
            if (enemy.state !== 'inflated' &&
                this.rectCollision(
                    { x: enemy.x + 5, y: enemy.y + 5, width: enemy.width - 10, height: enemy.height - 10 },
                    { x: this.player.x + 5, y: this.player.y + 5, width: this.player.width - 10, height: this.player.height - 10 }
                )) {
                this.handlePlayerHit();
            }
        });

        // Update rocks
        this.rocks.forEach(rock => {
            if (rock.state === 'falling') {
                rock.fallSpeed += 500 * dt;
                rock.y += rock.fallSpeed * dt;

                // Check if landed
                const rockRow = Math.floor((rock.y + rock.height) / this.gridSize);
                const rockCol = Math.floor((rock.x + rock.width / 2) / this.gridSize);

                if (rockRow >= this.rows || (this.dirtGrid[rockRow] && this.dirtGrid[rockRow][rockCol] !== null)) {
                    rock.state = 'landed';
                    rock.fallSpeed = 0;

                    // Create impact particles
                    this.particles.explode(
                        rock.x + rock.width / 2,
                        rock.y + rock.height,
                        { colors: ['#808080', '#696969'], count: 20 }
                    );
                    this.audio.playSynth('square', { frequency: 100, slideTo: 50, duration: 0.2, volume: 0.15 });

                    // Check if crushed enemy
                    this.enemies.forEach(enemy => {
                        if (enemy.state !== 'dead' &&
                            rock.x < enemy.x + enemy.width &&
                            rock.x + rock.width > enemy.x &&
                            rock.y < enemy.y + enemy.height &&
                            rock.y + rock.height > enemy.y) {
                            this.popEnemy(enemy, true);
                        }
                    });
                }
            }
        });

        // Update dirt particles
        this.dirtParticles.forEach((particle, index) => {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 500 * dt; // Gravity
            particle.life -= dt;

            if (particle.life <= 0) {
                this.dirtParticles.splice(index, 1);
            }
        });

        // Respawn enemies
        const respawningEnemies = this.enemies.filter(e => e.state === 'respawning');
        if (respawningEnemies.length > 0) {
            const enemy = respawningEnemies[0];
            // Find empty spot
            let col, row;
            do {
                col = Math.floor(Math.random() * this.cols);
                row = 0; // Start from top
            } while (this.dirtGrid[row][col] !== null);

            enemy.x = col * this.gridSize + 10;
            enemy.y = row * this.gridSize + 10;
            enemy.state = 'chase';
            enemy.inflateTimer = 0;
        }

        // Check win condition
        const aliveEnemies = this.enemies.filter(e => e.state !== 'dead' && e.state !== 'respawning' && e.state !== 'inflated');
        if (aliveEnemies.length === 0 && !this.enemies.some(e => e.state === 'inflated')) {
            this.nextLevel();
        }
    }

    digDirt(row, col, dt) {
        if (this.dirtGrid[row][col]) {
            this.dirtGrid[row][col].health -= dt * 2;

            // Create dirt particles
            for (let i = 0; i < 3; i++) {
                this.dirtParticles.push({
                    x: col * this.gridSize + this.gridSize / 2,
                    y: row * this.gridSize + this.gridSize / 2,
                    vx: (Math.random() - 0.5) * 200,
                    vy: (Math.random() - 0.5) * 200,
                    size: Math.random() * 5 + 2,
                    color: this.dirtGrid[row][col].color,
                    life: 1
                });
            }

            if (this.dirtGrid[row][col].health <= 0) {
                this.dirtGrid[row][col] = null;
                this.addScore(10);
                this.audio.playSynth('square', { frequency: 300, slideTo: 200, duration: 0.1, volume: 0.1 });
            }
        }
    }

    popEnemy(enemy, byRock = false) {
        enemy.state = 'inflated';

        // Inflate animation then pop
        const inflateDuration = 0.5;
        let inflateTime = 0;

        const inflateInterval = setInterval(() => {
            inflateTime += 0.1;
            if (inflateTime >= inflateDuration) {
                clearInterval(inflateInterval);

                // Pop!
                enemy.state = 'dead';
                enemy.deathTimer = 0;

                this.particles.explode(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    { colors: [enemy.color, '#ffffff'], count: 30 }
                );

                this.addScore(byRock ? 400 : 1000);
                this.audio.playSynth('sine', { frequency: 400, slideTo: 800, duration: 0.3, volume: 0.2 });
            }
        }, 100);
    }

    handlePlayerHit() {
        this.particles.explode(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            { colors: ['#0066ff', '#ffffff'], count: 40 }
        );
        this.shake(8);
        this.audio.playSynth('sawtooth', { frequency: 150, slideTo: 50, duration: 0.3, volume: 0.2 });
        this.removeLife();

        if (this.lives > 0) {
            // Reset player position
            const startRow = Math.floor(this.rows / 2);
            const startCol = Math.floor(this.cols / 2);
            this.player.x = startCol * this.gridSize + 10;
            this.player.y = startRow * this.gridSize + 10;
        }
    }

    nextLevel() {
        this.level++;
        this.addScore(500);
        this.createDirtGrid();
        this.createPlayer();
        this.createEnemies();
        this.createRocks();
        this.dirtParticles = [];

        this.audio.playSynth('sine', { frequency: 440, slideTo: 880, duration: 0.4, volume: 0.2 });
    }

    render() {
        // Clear with dark background
        this.clear('#1a0a00');

        // Draw dirt grid
        this.drawDirtGrid();

        // Draw rocks
        this.rocks.forEach(rock => {
            this.drawRock(rock);
        });

        // Draw enemies
        this.enemies.forEach(enemy => {
            if (enemy.state !== 'respawning') {
                this.drawEnemy(enemy);
            }
        });

        // Draw player
        this.drawPlayer();

        // Draw pump beam
        if (this.player.pumping && this.player.inflatingEnemy) {
            this.drawPumpBeam();
        }

        // Draw dirt particles
        this.dirtParticles.forEach(particle => {
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.life;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawDirtGrid() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const dirt = this.dirtGrid[row][col];
                if (dirt) {
                    const x = col * this.gridSize;
                    const y = row * this.gridSize;

                    this.ctx.fillStyle = dirt.color;
                    this.ctx.fillRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);

                    // Dirt texture
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    for (let i = 0; i < 3; i++) {
                        const dx = x + 5 + Math.random() * 25;
                        const dy = y + 5 + Math.random() * 25;
                        this.ctx.beginPath();
                        this.ctx.arc(dx, dy, 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
            }
        }
    }

    drawRock(rock) {
        const { x, y, width, height, color, glowColor, state } = rock;

        this.ctx.save();
        this.renderer.setGlow(glowColor, 10);

        // Rock body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();

        if (state === 'falling') {
            // Tilted when falling
            this.ctx.translate(x + width / 2, y + height / 2);
            this.ctx.rotate(Math.sin(Date.now() / 50) * 0.1);
            this.ctx.translate(-x - width / 2, -y - height / 2);
        }

        // Irregular rock shape
        this.ctx.moveTo(x + width / 2, y);
        this.ctx.lineTo(x + width, y + height / 3);
        this.ctx.lineTo(x + width * 0.8, y + height);
        this.ctx.lineTo(x + width * 0.2, y + height);
        this.ctx.lineTo(x, y + height / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Rock texture
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x + width / 3, y + height / 3, 5, 0, Math.PI * 2);
        this.ctx.arc(x + width * 2 / 3, y + height / 2, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawEnemy(enemy) {
        const { x, y, width, height, color, glowColor, type, state, frame } = enemy;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        this.renderer.setGlow(glowColor, 15);

        if (state === 'inflated') {
            // Draw inflated enemy
            const scale = 1.5 + Math.sin(frame) * 0.2;
            this.ctx.scale(scale, scale);
        }

        if (type === 'pooka') {
            // Pooka - round orange creature
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2, height / 2 - 5, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Goggles
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(-8, -5, 8, 0, Math.PI * 2);
            this.ctx.arc(8, -5, 8, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(-8, -5, 4, 0, Math.PI * 2);
            this.ctx.arc(8, -5, 4, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Fygars - green dragon
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, width / 2, height / 3, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Wings
            this.ctx.fillStyle = color;
            const wingFlap = Math.sin(frame * 2) * 10;
            this.ctx.beginPath();
            this.ctx.moveTo(-10, -5);
            this.ctx.lineTo(-20, -15 + wingFlap);
            this.ctx.lineTo(-5, -10);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(10, -5);
            this.ctx.lineTo(20, -15 - wingFlap);
            this.ctx.lineTo(5, -10);
            this.ctx.closePath();
            this.ctx.fill();

            // Fire breath animation
            if (Math.random() < 0.02) {
                this.ctx.fillStyle = '#ff6600';
                this.ctx.beginPath();
                this.ctx.moveTo(15, 0);
                this.ctx.lineTo(35, -5);
                this.ctx.lineTo(35, 5);
                this.ctx.closePath();
                this.ctx.fill();
            }

            // Eyes
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(8, -3, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPlayer() {
        const { x, y, width, height, color, glowColor, direction } = this.player;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.save();
        this.ctx.translate(cx, cy);

        // Rotate based on direction
        if (direction === 'left') {
            this.ctx.scale(-1, 1);
        } else if (direction === 'up') {
            this.ctx.rotate(-Math.PI / 2);
        } else if (direction === 'down') {
            this.ctx.rotate(Math.PI / 2);
        }

        this.renderer.setGlow(glowColor, 15);

        // Body
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 5, width / 3, height / 3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Head
        this.ctx.fillStyle = '#ffcc99';
        this.ctx.beginPath();
        this.ctx.arc(0, -8, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // Helmet
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(0, -10, 12, Math.PI, 0);
        this.ctx.fill();

        // Pump
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(10, 0, 20, 8);

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawPumpBeam() {
        if (!this.player.inflatingEnemy) return;

        const startX = this.player.x + this.player.width / 2;
        const startY = this.player.y + this.player.height / 2;
        const endX = this.player.inflatingEnemy.x + this.player.inflatingEnemy.width / 2;
        const endY = this.player.inflatingEnemy.y + this.player.inflatingEnemy.height / 2;

        this.ctx.save();
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 4 + this.player.pumpLength / 10;
        this.ctx.globalAlpha = 0.7;

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        // Pump pulse
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.lineDashOffset = -this.player.pumpLength;
        this.ctx.stroke();

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
            this.ctx.fillStyle = '#0066ff';
            this.ctx.beginPath();
            this.ctx.arc(lx, 25, 10, 0, Math.PI * 2);
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
                    const newGame = new DigDug(this.container);
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
    module.exports = DigDug;
}
