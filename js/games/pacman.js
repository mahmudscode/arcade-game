/**
 * Pac-Man - Modern Reimagining
 * Features: Neon maze with dynamic lighting, ghost AI, trail effects, particle effects
 */

class PacMan extends GameEngine {
    constructor(container) {
        super(container, { width: 560, height: 620 });

        this.pacman = null;
        this.ghosts = [];
        this.dots = [];
        this.powerPellets = [];
        this.particles = null;
        this.renderer = null;

        // Maze settings
        this.cellSize = 20;
        this.maze = [];
        this.mazeLayout = null;

        // Game state
        this.ghostMode = 'normal'; // normal, frightened, eaten
        this.ghostModeTimer = 0;
        this.combo = 0;
        this.isDying = false;
        this.lastKeyPressed = '';
        this.lastKeyTime = 0;
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(300);
        this.audio = new AudioController();
        this.audio.init();

        this.createMaze();
        this.createPacman();
        this.createGhosts();
        this.createDots();
        this.ghostMode = 'normal';
        this.ghostModeTimer = 0;
        this.combo = 0;
        this.isDying = false;
    }

    createMaze() {
        // 0 = empty, 1 = wall, 2 = dot, 3 = power pellet, 4 = ghost house
        // 28 columns x 31 rows (classic layout simplified)
        const layout = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
            [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
            [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
            [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
            [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
            [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
            [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
            [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
            [0,0,0,0,0,1,2,1,1,0,1,1,1,4,4,1,1,1,0,1,1,2,1,0,0,0,0,0],
            [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
            [0,0,0,0,0,0,2,0,0,0,1,4,4,4,4,4,4,1,0,0,0,2,0,0,0,0,0,0],
            [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
            [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
            [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
            [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
            [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
            [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
            [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
            [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
            [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
            [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
            [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
            [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
            [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];

        this.mazeLayout = layout;
        this.maze = [];

        for (let row = 0; row < layout.length; row++) {
            this.maze[row] = [];
            for (let col = 0; col < layout[row].length; col++) {
                this.maze[row][col] = layout[row][col];
            }
        }
    }

    createPacman() {
        this.pacman = {
            x: 14, // Start in the middle
            y: 23,
            direction: { x: -1, y: 0 },
            nextDirection: { x: -1, y: 0 },
            speed: 0.15,
            mouthAngle: 0.2,
            mouthOpen: true,
            mouthSpeed: 0.15,
            color: '#ffff00',
            glowColor: '#ffff00'
        };
    }

    createGhosts() {
        const ghostData = [
            { name: 'blinky', x: 14, y: 11, color: '#ff0000', scatterTarget: { x: 25, y: 0 } },
            { name: 'pinky', x: 13, y: 14, color: '#ffb8ff', scatterTarget: { x: 2, y: 0 } },
            { name: 'inky', x: 14, y: 14, color: '#00ffff', scatterTarget: { x: 27, y: 30 } },
            { name: 'clyde', x: 13, y: 14, color: '#ffb852', scatterTarget: { x: 0, y: 30 } }
        ];

        this.ghosts = ghostData.map(data => ({
            ...data,
            direction: { x: 0, y: -1 },
            speed: 0.1,
            mode: 'scatter', // scatter, chase, frightened, eaten
            modeTimer: 0,
            x: data.x,
            y: data.y
        }));

        this.ghostModeTimer = 0;
        this.currentGhostMode = 0;
        this.ghostModeSchedule = [
            { mode: 'scatter', duration: 7 },
            { mode: 'chase', duration: 20 },
            { mode: 'scatter', duration: 7 },
            { mode: 'chase', duration: 20 },
            { mode: 'scatter', duration: 5 },
            { mode: 'chase', duration: 20 },
            { mode: 'scatter', duration: 5 },
            { mode: 'chase', duration: Infinity }
        ];
    }

    createDots() {
        this.dots = [];
        this.powerPellets = [];

        for (let row = 0; row < this.maze.length; row++) {
            for (let col = 0; col < this.maze[row].length; col++) {
                if (this.maze[row][col] === 2) {
                    this.dots.push({ x: col, y: row });
                } else if (this.maze[row][col] === 3) {
                    this.powerPellets.push({ x: col, y: row, active: true });
                }
            }
        }
    }

    setNextDirectionFromEvent(e) {
        const code = e.code;
        const key = e.key;
        this.lastKeyPressed = code || key;
        this.lastKeyTime = Date.now();

        if (code === 'ArrowUp' || code === 'KeyW' || key === 'w' || key === 'W') {
            this.pacman.nextDirection = { x: 0, y: -1 };
            return true;
        }
        if (code === 'ArrowDown' || code === 'KeyS' || key === 's' || key === 'S') {
            this.pacman.nextDirection = { x: 0, y: 1 };
            return true;
        }
        if (code === 'ArrowLeft' || code === 'KeyA' || key === 'a' || key === 'A') {
            this.pacman.nextDirection = { x: -1, y: 0 };
            return true;
        }
        if (code === 'ArrowRight' || code === 'KeyD' || key === 'd' || key === 'D') {
            this.pacman.nextDirection = { x: 1, y: 0 };
            return true;
        }

        return false;
    }

    handleKeyDown(e) {
        // Allow restart from game-over state
        if (e.code === 'Space' && this.state === 'gameover') {
            e.preventDefault();
            this.destroy();
            setTimeout(() => {
                const newGame = new PacMan(this.container);
                newGame.start();
            }, 100);
            return;
        }

        // Record key for debug display
        this.lastKeyPressed = e.code || e.key;
        this.lastKeyTime = Date.now();

        super.handleKeyDown(e);
    }

    handleKeyDownGame(e) {
        const handled = this.setNextDirectionFromEvent(e);
        if (handled) {
            this.tryApplyDirection(this.pacman.nextDirection);
        }
    }

    canMove(x, y, dir) {
        // Sample slightly ahead from current float position to avoid mid-cell lockups.
        const sampleOffset = 0.51;
        const newX = Math.round(x + dir.x * sampleOffset);
        const newY = Math.round(y + dir.y * sampleOffset);

        // Handle tunnel
        if (newX < 0 || newX >= this.maze[0].length) {
            return true;
        }

        if (newY < 0 || newY >= this.maze.length) {
            return false;
        }

        return this.maze[newY][newX] !== 1;
    }

    tryApplyDirection(dir) {
        if (!dir || (dir.x === 0 && dir.y === 0)) return false;

        const x = this.pacman.x;
        const y = this.pacman.y;
        const distToCenter = Math.sqrt(
            Math.pow(x - Math.round(x), 2) + Math.pow(y - Math.round(y), 2)
        );

        if (distToCenter < 0.51 && this.canMove(x, y, dir)) {
            this.pacman.direction = { ...dir };
            this.pacman.x = Math.round(x);
            this.pacman.y = Math.round(y);
            return true;
        }

        return false;
    }

    update(dt) {
        // Update ghost mode schedule
        if (this.ghostMode !== 'frightened') {
            const schedule = this.ghostModeSchedule[this.currentGhostMode];
            this.ghostModeTimer += dt;

            if (this.ghostModeTimer >= schedule.duration) {
                this.currentGhostMode = (this.currentGhostMode + 1) % this.ghostModeSchedule.length;
                const nextSchedule = this.ghostModeSchedule[this.currentGhostMode];
                this.ghostModeTimer = 0;

                // Switch all ghosts
                this.ghosts.forEach(ghost => {
                    if (ghost.mode !== 'eaten') {
                        ghost.mode = nextSchedule.mode;
                    }
                });
            }
        }

        // Update frightened mode timer
        if (this.ghostMode === 'frightened') {
            this.ghostModeTimer -= dt;
            if (this.ghostModeTimer <= 0) {
                this.ghostMode = 'normal';
                this.combo = 0;
                this.ghosts.forEach(ghost => {
                    if (ghost.mode === 'frightened') {
                        ghost.mode = 'chase';
                    }
                });
            }
        }

        // Update Pac-Man
        this.updatePacman(dt);

        // Update ghosts
        this.ghosts.forEach(ghost => this.updateGhost(ghost, dt));

        // Check collisions
        this.checkCollisions();

        // Check win condition
        if (this.dots.length === 0 && this.powerPellets.filter(p => p.active).length === 0) {
            setTimeout(() => {
                this.nextLevel();
            }, 500);
        }

        // Update particles
        this.particles.update(dt);

        // Update mouth animation
        this.pacman.mouthAngle += this.pacman.mouthSpeed * (this.pacman.mouthOpen ? 1 : -1);
        if (this.pacman.mouthAngle >= 0.4) this.pacman.mouthOpen = false;
        if (this.pacman.mouthAngle <= 0.05) this.pacman.mouthOpen = true;
    }

    updatePacman(dt) {
        const { speed } = this.pacman;

        // Apply queued turn as soon as we are aligned enough with the grid.
        this.tryApplyDirection(this.pacman.nextDirection);

        // Move in current direction
        if (this.canMove(this.pacman.x, this.pacman.y, this.pacman.direction)) {
            this.pacman.x += this.pacman.direction.x * speed;
            this.pacman.y += this.pacman.direction.y * speed;

            // Handle tunnel wrapping
            if (this.pacman.x < -0.5) {
                this.pacman.x = this.maze[0].length - 0.5;
            } else if (this.pacman.x > this.maze[0].length - 0.5) {
                this.pacman.x = -0.5;
            }

            // Eat dots
            this.eatDot();
        } else {
            // If blocked, snap to grid so turns can be accepted reliably.
            this.pacman.x = Math.round(this.pacman.x);
            this.pacman.y = Math.round(this.pacman.y);

            // Try to turn; if can't, keep current direction (do NOT set to 0,0).
            this.tryApplyDirection(this.pacman.nextDirection);
        }
    }

    eatDot() {
        const px = Math.round(this.pacman.x);
        const py = Math.round(this.pacman.y);

        // Regular dots
        const dotIndex = this.dots.findIndex(d => d.x === px && d.y === py);
        if (dotIndex !== -1) {
            this.dots.splice(dotIndex, 1);
            this.addScore(10);
            this.audio.playSynth('sine', { frequency: 400 + Math.random() * 100, duration: 0.05, volume: 0.1 });
        }

        // Power pellets
        this.powerPellets.forEach(pellet => {
            if (pellet.active && pellet.x === px && pellet.y === py) {
                pellet.active = false;
                this.addScore(50);
                this.activatePowerMode();
                this.audio.playPowerUp();

                // Particle effect
                this.particles.sparkle(
                    px * this.cellSize + this.cellSize / 2,
                    py * this.cellSize + this.cellSize / 2,
                    { colors: ['#ffff00', '#ffffff'] }
                );
            }
        });
    }

    activatePowerMode() {
        this.ghostMode = 'frightened';
        this.ghostModeTimer = 7;
        this.combo = 0;

        this.ghosts.forEach(ghost => {
            if (ghost.mode !== 'eaten') {
                ghost.mode = 'frightened';
                // Reverse direction
                ghost.direction = { x: -ghost.direction.x, y: -ghost.direction.y };
            }
        });
    }

    updateGhost(ghost, dt) {
        const speed = ghost.mode === 'frightened' ? 0.07 :
                      ghost.mode === 'eaten' ? 0.2 : 0.1;

        // Move ghost
        if (this.canMoveGhost(ghost.x, ghost.y, ghost.direction)) {
            ghost.x += ghost.direction.x * speed;
            ghost.y += ghost.direction.y * speed;

            // Handle tunnel
            if (ghost.x < -0.5) ghost.x = this.maze[0].length - 0.5;
            if (ghost.x > this.maze[0].length - 0.5) ghost.x = -0.5;
        }

        // Decide direction at intersections
        const cellX = Math.round(ghost.x);
        const cellY = Math.round(ghost.y);
        const distToCenter = Math.sqrt(
            Math.pow(ghost.x - cellX, 2) + Math.pow(ghost.y - cellY, 2)
        );

        if (distToCenter < 0.3) {
            this.chooseGhostDirection(ghost, cellX, cellY);
            ghost.x = cellX;
            ghost.y = cellY;
        }

        // Return to ghost house if eaten
        if (ghost.mode === 'eaten' && cellX === 13 && cellY === 14) {
            ghost.mode = 'chase';
        }
    }

    canMoveGhost(x, y, dir) {
        const newX = Math.round(x + dir.x);
        const newY = Math.round(y + dir.y);

        if (newX < 0 || newX >= this.maze[0].length) return true;
        if (newY < 0 || newY >= this.maze.length) return false;

        const cell = this.maze[newY][newX];
        return cell !== 1;
    }

    chooseGhostDirection(ghost, x, y) {
        const directions = [
            { x: 0, y: -1 }, // up
            { x: 0, y: 1 },  // down
            { x: -1, y: 0 }, // left
            { x: 1, y: 0 }   // right
        ];

        // Can't reverse direction (except when frightened)
        const validDirections = directions.filter(dir => {
            if (ghost.mode !== 'frightened' &&
                dir.x === -ghost.direction.x && dir.y === -ghost.direction.y) {
                return false;
            }
            return this.canMoveGhost(x, y, dir);
        });

        if (validDirections.length === 0) {
            // Reverse if stuck
            ghost.direction = { x: -ghost.direction.x, y: -ghost.direction.y };
            return;
        }

        // Get target based on mode
        let target;
        if (ghost.mode === 'frightened') {
            // Random direction when frightened
            const randomDir = validDirections[Math.floor(Math.random() * validDirections.length)];
            ghost.direction = randomDir;
            return;
        } else if (ghost.mode === 'eaten') {
            target = { x: 13, y: 14 }; // Ghost house
        } else if (ghost.mode === 'scatter') {
            target = ghost.scatterTarget;
        } else {
            // Chase mode - different behaviors
            target = this.getChaseTarget(ghost);
        }

        // Choose direction that minimizes distance to target
        let bestDir = validDirections[0];
        let bestDist = Infinity;

        validDirections.forEach(dir => {
            const newX = x + dir.x;
            const newY = y + dir.y;
            const dist = Math.pow(newX - target.x, 2) + Math.pow(newY - target.y, 2);

            if (dist < bestDist) {
                bestDist = dist;
                bestDir = dir;
}       
        });

        ghost.direction = bestDir;
    }

    getChaseTarget(ghost) {
        const px = Math.round(this.pacman.x);
        const py = Math.round(this.pacman.y);
        const dx = this.pacman.direction.x;
        const dy = this.pacman.direction.y;

        switch (ghost.name) {
            case 'blinky':
                // Direct chase
                return { x: px, y: py };
            case 'pinky':
                // Target 4 tiles ahead
                return { x: px + dx * 4, y: py + dy * 4 };
            case 'inky':
                // Complex targeting (simplified)
                return { x: px + dx * 2, y: py + dy * 2 };
            case 'clyde':
                // Random when close
                const dist = Math.sqrt(Math.pow(ghost.x - px, 2) + Math.pow(ghost.y - py, 2));
                if (dist < 8) {
                    return ghost.scatterTarget;
                }
                return { x: px, y: py };
            default:
                return { x: px, y: py };
        }
    }

    checkCollisions() {
        if (this.isDying) return;

        this.ghosts.forEach(ghost => {
            const dist = Math.sqrt(
                Math.pow(ghost.x - this.pacman.x, 2) + Math.pow(ghost.y - this.pacman.y, 2)
            );

            if (dist < 0.8) {
                if (ghost.mode === 'frightened') {
                    // Eat ghost
                    ghost.mode = 'eaten';
                    this.combo++;
                    const points = 200 * Math.pow(2, this.combo - 1);
                    this.addScore(points);

                    // Particle effect
                    this.particles.explode(
                        ghost.x * this.cellSize + this.cellSize / 2,
                        ghost.y * this.cellSize + this.cellSize / 2,
                        { colors: [ghost.color, '#ffffff'], count: 30 }
                    );

                    this.audio.playSynth('sawtooth', {
                        frequency: 800,
                        slideTo: 200,
                        duration: 0.2,
                        volume: 0.2
                    });
                } else if (ghost.mode !== 'eaten') {
                    // Pac-Man dies
                    this.pacmanDeath();
                }
            }
        });
    }

    pacmanDeath() {
        if (this.isDying || this.state !== 'running') return;
        this.isDying = true;

        // Death animation
        this.particles.explode(
            this.pacman.x * this.cellSize + this.cellSize / 2,
            this.pacman.y * this.cellSize + this.cellSize / 2,
            { colors: ['#ffff00', '#ffffff'], count: 50, speedMin: 100, speedMax: 200 }
        );

        this.audio.playGameOver();
        this.shake(10);
        this.removeLife();

        if (this.lives > 0) {
            setTimeout(() => {
                this.createPacman();
                this.ghosts.forEach(ghost => {
                    ghost.x = ghost.name === 'blinky' ? 14 : 13;
                    ghost.y = ghost.name === 'blinky' ? 11 : 14;
                    ghost.mode = 'scatter';
                    ghost.direction = { x: 0, y: -1 };
                });
                this.isDying = false;
            }, 1500);
        } else {
            this.isDying = false;
        }
    }

    nextLevel() {
        this.level++;
        this.createMaze();
        this.createPacman();
        this.createGhosts();
        this.createDots();
        this.audio.playPowerUp();
    }

    render() {
        this.clear('#000000');

        // Draw maze walls
        this.drawMaze();

        // Draw dots
        this.dots.forEach(dot => {
            this.renderer.drawGlowingCircle(
                dot.x * this.cellSize + this.cellSize / 2,
                dot.y * this.cellSize + this.cellSize / 2,
                2,
                { color: '#ffb897', glowColor: '#ffb897', glowBlur: 5 }
            );
        });

        // Draw power pellets
        this.powerPellets.forEach(pellet => {
            if (!pellet.active) return;
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
            this.renderer.drawGlowingCircle(
                pellet.x * this.cellSize + this.cellSize / 2,
                pellet.y * this.cellSize + this.cellSize / 2,
                7 * pulse,
                { color: '#ffb897', glowColor: '#ffb897', glowBlur: 15 * pulse }
            );
        });

        // Draw ghosts
        this.ghosts.forEach(ghost => this.drawGhost(ghost));

        // Draw Pac-Man
        this.drawPacman();

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();

        // DEBUG: Draw input state
        this.drawDebugInfo();
    }

    drawDebugInfo() {
        const now = Date.now();
        const timeSinceKey = now - this.lastKeyTime;
        const keyDisplay = timeSinceKey < 200 ? this.lastKeyPressed : '(none)';

        const debugLines = [
            `STATE: ${this.state}`,
            `KEYS: ${keyDisplay}`,
            `DIR: (${this.pacman.direction.x}, ${this.pacman.direction.y})`,
            `NEXT: (${this.pacman.nextDirection.x}, ${this.pacman.nextDirection.y})`,
            `POS: (${this.pacman.x.toFixed(2)}, ${this.pacman.y.toFixed(2)})`,
            `LIVES: ${this.lives}`,
            `DYING: ${this.isDying}`
        ];

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, this.canvas.height - 110, 200, 110);

        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';

        debugLines.forEach((line, i) => {
            this.ctx.fillText(line, 10, this.canvas.height - 95 + i * 15);
        });
    }

    drawMaze() {
        this.ctx.strokeStyle = '#1a44a0';
        this.ctx.lineWidth = 2;
        this.renderer.setGlow('#2a66c0', 10);

        for (let row = 0; row < this.maze.length; row++) {
            for (let col = 0; col < this.maze[row].length; col++) {
                if (this.maze[row][col] === 1) {
                    const x = col * this.cellSize;
                    const y = row * this.cellSize;

                    // Draw wall with glow
                    this.ctx.fillStyle = 'rgba(26, 68, 160, 0.3)';
                    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
                    this.ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
                }
            }
        }

        this.renderer.clearGlow();
    }

    drawPacman() {
        const x = this.pacman.x * this.cellSize + this.cellSize / 2;
        const y = this.pacman.y * this.cellSize + this.cellSize / 2;
        const radius = this.cellSize / 2 - 2;

        // Calculate rotation based on direction
        let angle = 0;
        if (this.pacman.direction.x === 1) angle = 0;
        if (this.pacman.direction.x === -1) angle = Math.PI;
        if (this.pacman.direction.y === -1) angle = -Math.PI / 2;
        if (this.pacman.direction.y === 1) angle = Math.PI / 2;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        this.renderer.setGlow(this.pacman.glowColor, 20);
        this.ctx.fillStyle = this.pacman.color;

        // Draw Pac-Man with mouth
        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, this.pacman.mouthAngle, Math.PI * 2 - this.pacman.mouthAngle);
        this.ctx.lineTo(0, 0);
        this.ctx.closePath();
        this.ctx.fill();

        // Eye
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(radius * 0.3, -radius * 0.5, 2, 0, Math.PI * 2);
        this.ctx.fill();

        this.renderer.clearGlow();
        this.ctx.restore();

        // Trail effect
        if (this.pacman.direction.x !== 0 || this.pacman.direction.y !== 0) {
            this.particles.trail(x, y, {
                color: this.pacman.color,
                count: 1,
                lifeMin: 100,
                lifeMax: 200
            });
        }
    }

    drawGhost(ghost) {
        const x = ghost.x * this.cellSize + this.cellSize / 2;
        const y = ghost.y * this.cellSize + this.cellSize / 2;
        const radius = this.cellSize / 2 - 2;

        let color = ghost.color;
        let glowColor = ghost.color;

        if (ghost.mode === 'frightened') {
            const flash = this.ghostModeTimer < 2 && Math.floor(Date.now() / 100) % 2 === 0;
            color = flash ? '#ffffff' : '#0000ff';
            glowColor = color;
        } else if (ghost.mode === 'eaten') {
            color = 'transparent';
            glowColor = 'transparent';
        }

        this.ctx.save();
        this.ctx.translate(x, y);

        this.renderer.setGlow(glowColor, ghost.mode === 'frightened' ? 10 : 15);

        // Ghost body
        if (ghost.mode !== 'eaten') {
            this.ctx.fillStyle = color;

            // Top half (dome)
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, Math.PI, 0);
            this.ctx.lineTo(radius, radius);

            // Wavy bottom
            const wave = Math.sin(Date.now() / 100) * 2;
            for (let i = 0; i < 4; i++) {
                const wx = radius - (i + 0.5) * (radius * 2 / 4);
                const wy = radius + (i % 2 === 0 ? wave : -wave);
                this.ctx.lineTo(wx, wy);
            }

            this.ctx.lineTo(-radius, radius);
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Eyes
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(-radius * 0.4, -radius * 0.2, radius * 0.35, 0, Math.PI * 2);
        this.ctx.arc(radius * 0.4, -radius * 0.2, radius * 0.35, 0, Math.PI * 2);
        this.ctx.fill();

        // Pupils
        this.ctx.fillStyle = '#0000ff';
        const px = ghost.direction.x * 2;
        const py = ghost.direction.y * 2;
        this.ctx.beginPath();
        this.ctx.arc(-radius * 0.4 + px, -radius * 0.2 + py, radius * 0.15, 0, Math.PI * 2);
        this.ctx.arc(radius * 0.4 + px, -radius * 0.2 + py, radius * 0.15, 0, Math.PI * 2);
        this.ctx.fill();

        // Frightened face
        if (ghost.mode === 'frightened') {
            this.ctx.strokeStyle = '#ffb897';
            this.ctx.lineWidth = 1;

            // Wavy mouth
            this.ctx.beginPath();
            for (let i = -3; i <= 3; i++) {
                const mx = i * 4;
                const my = radius * 0.5 + Math.sin(i) * 3;
                if (i === -3) {
                    this.ctx.moveTo(mx, my);
                } else {
                    this.ctx.lineTo(mx, my);
                }
            }
            this.ctx.stroke();
        }

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawHUD() {
        // Score
        this.renderer.drawGlowingText(`SCORE: ${this.score}`, 10, 25, {
            size: 18,
            color: '#ffffff',
            glowColor: '#ffffff'
        });

        // Level
        this.renderer.drawGlowingText(`LEVEL ${this.level}`, this.canvas.width - 100, 25, {
            size: 18,
            color: '#ffff00',
            glowColor: '#ffff00'
        });

        // Lives
        for (let i = 0; i < this.lives - 1; i++) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.beginPath();
            const lx = 100 + i * 25;
            this.ctx.arc(lx, 15, 10, 0.2 * Math.PI, 1.8 * Math.PI);
            this.ctx.lineTo(lx, 15);
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Combo indicator
        if (this.combo > 1) {
            this.renderer.drawGlowingText(`${this.combo}x COMBO!`, this.canvas.width / 2, 25, {
                size: 20,
                color: '#ff00ff',
                glowColor: '#ff00ff',
                align: 'center'
            });
        }
    }

    onStateChange(newState) {
        if (newState === 'gameover') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
            this.renderer.drawGlowingText('Press SPACE to Restart', this.canvas.width / 2, this.canvas.height / 2 + 70, {
                size: 20,
                color: '#888888',
                glowColor: '#888888',
                align: 'center'
            });
        }
    }

    stop() {
        super.stop();
    }

    destroy() {
        super.destroy();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PacMan;
}
