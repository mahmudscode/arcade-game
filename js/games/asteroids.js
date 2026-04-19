/**
 * Asteroids - Modern Reimagining
 * Features: Neon geometric shapes, particle trails, screen shake, fragmentation effects
 */

class Asteroids extends GameEngine {
    constructor(container) {
        super(container, { width: 800, height: 600 });

        this.ship = null;
        this.asteroids = [];
        this.bullets = [];
        this.particles = null;
        this.renderer = null;

        // Game settings
        this.bulletCooldown = 0;
        this.bulletDelay = 0.2;
        this.thrusting = false;
        this.invulnerable = 0; 
    }

    init() {
        this.renderer = new SpriteRenderer(this.ctx);
        this.particles = new ParticleSystem(500);
        this.audio = new AudioController();
        this.audio.init();

        this.createShip();
        this.createAsteroidField();
        this.bullets = [];
        this.bulletCooldown = 0;
        this.invulnerable = 3; // 3 seconds invulnerable at start
    }

    createShip() {
        this.ship = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            angle: -Math.PI / 2,
            vx: 0,
            vy: 0,
            rotationSpeed: 0,
            thrust: 0,
            size: 15,
            color: '#00ffff',
            glowColor: '#00ffff'
        };
    }

    createAsteroidField() {
        this.asteroids = [];
        const numAsteroids = 5 + this.level;

        for (let i = 0; i < numAsteroids; i++) {
            this.asteroids.push(this.createAsteroid(
                Math.random() * this.canvas.width,
                Math.random() * this.canvas.height,
                'large'
            ));
        }
    }

    createAsteroid(x, y, size) {
        const sizes = {
            large: { radius: 40, points: 100, sides: 8 },
            medium: { radius: 20, points: 50, sides: 7 },
            small: { radius: 10, points: 25, sides: 6 }
        };

        const config = sizes[size];
        const vertices = [];
        const irregularity = 0.4;

        for (let i = 0; i < config.sides; i++) {
            const angle = (i / config.sides) * Math.PI * 2;
            const variance = 1 + (Math.random() - 0.5) * irregularity;
            vertices.push({
                x: Math.cos(angle) * config.radius * variance,
                y: Math.sin(angle) * config.radius * variance
            });
        }

        return {
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 2,
            vertices: vertices,
            radius: config.radius,
            size: size,
            points: config.points,
            color: this.getRandomAsteroidColor(),
            glowColor: '#ff6600',
            alive: true
        };
    }

    getRandomAsteroidColor() {
        const colors = ['#888888', '#aaaaaa', '#666666', '#996633', '#887766'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    handleKeyDownGame(e) {
        if (e.code === 'Space') {
            if (this.bulletCooldown <= 0) {
                this.shoot();
            }
        }
        if (e.code === 'KeyP') {
            this.pause();
        }
    }

    shoot() {
        const cos = Math.cos(this.ship.angle);
        const sin = Math.sin(this.ship.angle);

        this.bullets.push({
            x: this.ship.x + cos * this.ship.size,
            y: this.ship.y + sin * this.ship.size,
            vx: cos * 500 + this.ship.vx * 0.5,
            vy: sin * 500 + this.ship.vy * 0.5,
            life: 1.5,
            color: '#ff6600',
            glowColor: '#ff6600'
        });

        // Small recoil
        this.ship.vx -= cos * 20;
        this.ship.vy -= sin * 20;

        this.audio.playShoot();
        this.bulletCooldown = this.bulletDelay;
    }

    update(dt) {
        // Update cooldowns
        this.bulletCooldown -= dt;
        if (this.invulnerable > 0) {
            this.invulnerable -= dt;
        }

        // Ship rotation
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.ship.rotationSpeed = -5;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.ship.rotationSpeed = 5;
        } else {
            this.ship.rotationSpeed = 0;
        }

        this.ship.angle += this.ship.rotationSpeed * dt;

        // Ship thrust
        this.thrusting = this.keys['ArrowUp'] || this.keys['KeyW'];
        if (this.thrusting) {
            this.ship.thrust = 200;
            const cos = Math.cos(this.ship.angle);
            const sin = Math.sin(this.ship.angle);
            this.ship.vx += cos * this.ship.thrust * dt;
            this.ship.vy += sin * this.ship.thrust * dt;

            // Thrust particles
            for (let i = 0; i < 3; i++) {
                this.particles.emit({
                    x: this.ship.x - cos * this.ship.size,
                    y: this.ship.y - sin * this.ship.size,
                    vx: this.ship.vx + (Math.random() - 0.5) * 50,
                    vy: this.ship.vy + (Math.random() - 0.5) * 50,
                    color: '#ff6600',
                    color2: '#ffff00',
                    sizeMin: 3,
                    sizeMax: 8,
                    lifeMin: 100,
                    lifeMax: 300,
                    spread: 30,
                    spreadStart: (this.ship.angle - Math.PI / 2) * 180 / Math.PI - 15,
                    speedMin: 50,
                    speedMax: 100
                });
            }
        }

        // Apply drag
        this.ship.vx *= 0.99;
        this.ship.vy *= 0.99;

        // Update ship position
        this.ship.x += this.ship.vx * dt;
        this.ship.y += this.ship.vy * dt;

        // Wrap around screen
        this.wrapPosition(this.ship);

        // Update bullets
        this.bullets.forEach((bullet, index) => {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            bullet.life -= dt;

            // Wrap bullets
            this.wrapPosition(bullet);

            if (bullet.life <= 0) {
                this.bullets.splice(index, 1);
            }
        });

        // Update asteroids
        this.asteroids.forEach(asteroid => {
            if (!asteroid.alive) return;

            asteroid.x += asteroid.vx * dt;
            asteroid.y += asteroid.vy * dt;
            asteroid.rotation += asteroid.rotationSpeed * dt;

            this.wrapPosition(asteroid);
        });

        // Check collisions
        this.checkCollisions();

        // Check level complete
        const aliveAsteroids = this.asteroids.filter(a => a.alive);
        if (aliveAsteroids.length === 0) {
            this.nextLevel();
        }

        // Update particles
        this.particles.update(dt);
    }

    wrapPosition(obj) {
        if (obj.x < -50) obj.x = this.canvas.width + 50;
        if (obj.x > this.canvas.width + 50) obj.x = -50;
        if (obj.y < -50) obj.y = this.canvas.height + 50;
        if (obj.y > this.canvas.height + 50) obj.y = -50;
    }

    checkCollisions() {
        // Bullets vs asteroids
        this.bullets.forEach((bullet, bIndex) => {
            this.asteroids.forEach((asteroid) => {
                if (!asteroid.alive) return;

                if (this.circleCollision(
                    { x: bullet.x, y: bullet.y, radius: 3 },
                    { x: asteroid.x, y: asteroid.y, radius: asteroid.radius }
                )) {
                    // Destroy asteroid
                    asteroid.alive = false;
                    this.bullets.splice(bIndex, 1);
                    this.addScore(asteroid.points);

                    // Explosion
                    this.particles.explode(asteroid.x, asteroid.y, {
                        colors: [asteroid.color, '#ff6600', '#ffffff'],
                        count: 15,
                        speedMin: 50,
                        speedMax: 150
                    });

                    this.shake(5);
                    this.audio.playSynth('square', { frequency: 150, slideTo: 50, duration: 0.15, volume: 0.15 });

                    // Split into smaller asteroids
                    if (asteroid.size === 'large') {
                        this.spawnFragments(asteroid.x, asteroid.y, 'medium', 2);
                    } else if (asteroid.size === 'medium') {
                        this.spawnFragments(asteroid.x, asteroid.y, 'small', 3);
                    }
                }
            });
        });

        // Ship vs asteroids
        if (this.invulnerable <= 0) {
            this.asteroids.forEach(asteroid => {
                if (!asteroid.alive) return;

                if (this.circleCollision(
                    { x: this.ship.x, y: this.ship.y, radius: this.ship.size * 0.7 },
                    { x: asteroid.x, y: asteroid.y, radius: asteroid.radius }
                )) {
                    this.destroyShip();
                }
            });
        }
    }

    spawnFragments(x, y, size, count) {
        for (let i = 0; i < count; i++) {
            const fragment = this.createAsteroid(x, y, size);
            fragment.vx = (Math.random() - 0.5) * 100;
            fragment.vy = (Math.random() - 0.5) * 100;
            fragment.rotationSpeed = (Math.random() - 0.5) * 4;
            this.asteroids.push(fragment);
        }
    }

    destroyShip() {
        // Death explosion
        this.particles.explode(this.ship.x, this.ship.y, {
            colors: [this.ship.color, '#ffffff', '#ff6600'],
            count: 80,
            speedMin: 100,
            speedMax: 300
        });

        this.shake(15);
        this.audio.playExplosion();
        this.removeLife();

        if (this.lives > 0) {
            this.createShip();
            this.invulnerable = 3;
            this.bullets = [];
        }
    }

    nextLevel() {
        this.level++;
        this.bullets = [];
        this.createAsteroidField();
        this.createShip();
        this.invulnerable = 2;
        this.audio.playPowerUp();
    }

    render() {
        // Clear with trail effect for motion blur feel
        this.clearWithTrail(0.3);

        // Draw bullets
        this.bullets.forEach(bullet => {
            this.renderer.drawGlowingCircle(bullet.x, bullet.y, 3, {
                color: bullet.color,
                glowColor: bullet.glowColor,
                glowBlur: 15
            });
        });

        // Draw asteroids
        this.asteroids.forEach(asteroid => {
            if (!asteroid.alive) return;
            this.drawAsteroid(asteroid);
        });

        // Draw ship (if invulnerable, blink)
        if (this.invulnerable <= 0 || Math.floor(Date.now() / 100) % 2 === 0) {
            this.drawShip();
        }

        // Draw particles
        this.particles.render(this.ctx);

        // Draw HUD
        this.drawHUD();
    }

    drawShip() {
        const { x, y, angle, size, color, glowColor } = this.ship;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        this.renderer.setGlow(glowColor, 20);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';

        // Draw ship triangle
        this.ctx.beginPath();
        this.ctx.moveTo(size, 0);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.lineTo(-size * 0.4, 0);
        this.ctx.lineTo(-size * 0.7, -size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Inner glow
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(size * 0.5, 0);
        this.ctx.lineTo(-size * 0.3, size * 0.4);
        this.ctx.lineTo(-size * 0.2, 0);
        this.ctx.lineTo(-size * 0.3, -size * 0.4);
        this.ctx.closePath();
        this.ctx.fill();

        this.renderer.clearGlow();
        this.ctx.restore();
    }

    drawAsteroid(asteroid) {
        const { x, y, rotation, vertices, radius, color, glowColor } = asteroid;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);

        this.renderer.setGlow(glowColor, 15);

        // Draw asteroid shape
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(136, 136, 136, 0.2)';

        this.ctx.beginPath();
        vertices.forEach((v, i) => {
            if (i === 0) {
                this.ctx.moveTo(v.x, v.y);
            } else {
                this.ctx.lineTo(v.x, v.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Inner details
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < vertices.length; i += 2) {
            const v = vertices[i];
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(v.x * 0.5, v.y * 0.5);
            this.ctx.stroke();
        }

        // Crater details
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const craterCount = Math.floor(radius / 10);
        for (let i = 0; i < craterCount; i++) {
            const cx = (Math.random() - 0.5) * radius * 0.8;
            const cy = (Math.random() - 0.5) * radius * 0.8;
            const cr = Math.random() * radius * 0.2 + 2;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, cr, 0, Math.PI * 2);
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

        // Lives
        for (let i = 0; i < this.lives; i++) {
            this.ctx.save();
            this.ctx.translate(150 + i * 35, 25);
            this.ctx.scale(0.5, 0.5);
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(-10, 10);
            this.ctx.lineTo(-5, 0);
            this.ctx.lineTo(-10, -10);
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Invulnerability indicator
        if (this.invulnerable > 0) {
            this.renderer.drawGlowingText('SHIELD', 20, 60, {
                size: 14,
                color: '#0088ff',
                glowColor: '#0088ff'
            });
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
                    const newGame = new Asteroids(this.container);
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
    module.exports = Asteroids;
}
