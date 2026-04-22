/**
 * GameEngine.js - Base game engine for Retro Arcade Classics
 * Provides game loop, state management, input handling, and canvas utilities
 */

class GameEngine {
    constructor(container, options = {}) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.options = {
            width: options.width || 800,
            height: options.height || 600,
            fps: options.fps || 60,
            ...options
        }; 

        // Set canvas size
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.cssText = 'max-width: 100%; border-radius: 10px; outline: none;';
        this.canvas.tabIndex = 0; // Make canvas focusable
        this.container.appendChild(this.canvas);

        // Game state
        this.state = 'idle'; // idle, running, paused, gameover
        this.score = 0;
        this.lives = 3;
        this.level = 1;

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.fpsCounter = 0;

        // Input state
        this.keys = {};
        this.touchX = null;
        this.touchY = null;
        this.touchActive = false;

        // Callbacks
        this.onScoreChange = null;
        this.onLivesChange = null;
        this.onGameOver = null;
        this.onLevelComplete = null;

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleWindowBlur = this.handleWindowBlur.bind(this);

        // Setup input listeners
        this.setupInputListeners();
    }

    setupInputListeners() {
        // Use window for keyboard listeners to capture events regardless of focus
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('blur', this.handleWindowBlur);

        // Click to focus canvas for keyboard input
        this.canvas.addEventListener('click', () => {
            this.canvas.focus();
        });

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.touchX = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            this.touchY = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
            this.touchActive = true;
            this.handleTouchStart(this.touchX, this.touchY);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.touchX = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            this.touchY = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
            this.handleTouchMove(this.touchX, this.touchY);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchActive = false;
            this.handleTouchEnd();
        });
    }

    handleKeyDown(e) {
        // Prevent default for game keys to stop page scrolling
        const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP', 'Escape'];
        if (gameKeys.includes(e.code)) {
            e.preventDefault();
        }

        this.keys[e.code] = true;
        this.keys[e.key] = true;

        // Handle pause
        if (e.code === 'Escape' && this.state === 'running') {
            this.pause();
        } else if (e.code === 'Escape' && this.state === 'paused') {
            this.resume();
        }

        // Handle game-specific input
        if (this.state === 'running') {
            this.handleKeyDownGame(e);
        }
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
        this.keys[e.key] = false;

        if (this.state === 'running') {
            this.handleKeyUpGame(e);
        }
    }

    handleWindowBlur() {
        // Reset pressed-state keys if the tab/window focus changes.
        this.keys = {};
    }

    // Override these in game classes
    handleKeyDownGame(e) {}
    handleKeyUpGame(e) {}
    handleTouchStart(x, y) {}
    handleTouchMove(x, y) {}
    handleTouchEnd() {}
    init() {}
    update(dt) {}
    render() {}
    onStateChange(newState) {}

    start() {
        this.state = 'running';
        this.lastTime = performance.now();
        this.init();
        this.canvas.focus(); // Focus canvas for keyboard input
        // Ensure canvas stays focused for keyboard input
        this.canvas.addEventListener('blur', () => this.canvas.focus());
        requestAnimationFrame(this.gameLoop);
        this.onStateChange('running');
    }

    pause() {
        this.state = 'paused';
        this.onStateChange('paused');
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'running';
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop);
            this.onStateChange('running');
        }
    }

    stop() {
        this.state = 'idle';
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('blur', this.handleWindowBlur);
        this.onStateChange('idle');
    }

    gameOver() {
        this.state = 'gameover';
        if (this.onGameOver) {
            this.onGameOver(this.score);
        }
        this.onStateChange('gameover');
    }

    gameLoop(currentTime = 0) {
        if (this.state !== 'running') return;

        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap delta time to prevent spiral of death
        if (this.deltaTime > 0.1) this.deltaTime = 0.1;

        // Update FPS counter
        this.frameCount++;
        this.accumulator += this.deltaTime;
        if (this.accumulator >= 1) {
            this.fpsCounter = this.frameCount;
            this.frameCount = 0;
            this.accumulator = 0;
        }

        // Update game logic
        this.update(this.deltaTime);

        // Render
        this.render();

        // Continue loop
        requestAnimationFrame(this.gameLoop);
    }

    // Utility methods
    clear(color = '#000000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    clearWithTrail(strength = 0.1) {
        this.ctx.fillStyle = `rgba(0, 0, 0, ${strength})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setGlow(color, blur = 20) {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = blur;
    }

    clearGlow() {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
    }

    createGradient(x1, y1, x2, y2, colors) {
        const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
        colors.forEach(([stop, color]) => {
            gradient.addColorStop(stop, color);
        });
        return gradient;
    }

    addScore(points) {
        this.score += points;
        if (this.onScoreChange) {
            this.onScoreChange(this.score);
        }
    }

    addLife(count = 1) {
        this.lives += count;
        if (this.onLivesChange) {
            this.onLivesChange(this.lives);
        }
    }

    removeLife(count = 1) {
        this.lives -= count;
        if (this.lives <= 0) {
            this.gameOver();
        } else if (this.onLivesChange) {
            this.onLivesChange(this.lives);
        }
    }

    nextLevel() {
        this.level++;
        if (this.onLevelComplete) {
            this.onLevelComplete(this.level);
        }
    }

    // Screen shake effect
    shake(intensity = 10) {
        const shakeDuration = 200; // ms
        const startTime = performance.now();

        const shakeLoop = () => {
            const elapsed = performance.now() - startTime;
            if (elapsed >= shakeDuration) {
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                return;
            }

            const progress = elapsed / shakeDuration;
            const currentIntensity = intensity * (1 - progress);
            const dx = (Math.random() - 0.5) * 2 * currentIntensity;
            const dy = (Math.random() - 0.5) * 2 * currentIntensity;

            this.ctx.setTransform(1, 0, 0, 1, dx, dy);
            requestAnimationFrame(shakeLoop);
        };

        shakeLoop();
    }

    // Draw text with outline
    drawText(text, x, y, options = {}) {
        const {
            size = 24,
            color = '#ffffff',
            align = 'left',
            outline = false,
            outlineColor = '#000000',
            font = 'Arial'
        } = options;

        this.ctx.font = `${size}px ${font}`;
        this.ctx.textAlign = align;

        if (outline) {
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(text, x, y);
        }

        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
    }

    // Draw centered text
    drawCenteredText(text, y, options = {}) {
        options.align = 'center';
        this.drawText(text, this.canvas.width / 2, y, options);
    }

    // Check collision between two rectangles
    rectCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    // Check collision between two circles
    circleCollision(circle1, circle2) {
        const dx = circle2.x - circle1.x;
        const dy = circle2.y - circle1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < circle1.radius + circle2.radius;
    }

    // Check collision between circle and rectangle
    circleRectCollision(circle, rect) {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
        const dx = circle.x - closestX;
        const dy = circle.y - closestY;
        return (dx * dx + dy * dy) < (circle.radius * circle.radius);
    }

    // Get canvas for external use
    getCanvas() {
        return this.canvas;
    }

    getContext() {
        return this.ctx;
    }

    // Destroy and cleanup
    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('blur', this.handleWindowBlur);
        this.container.innerHTML = '';
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameEngine;
}
