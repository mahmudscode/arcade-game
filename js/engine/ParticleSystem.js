/**
 * ParticleSystem.js - Modern particle effects for Retro Arcade Classics
 * Supports explosions, trails, sparkles, and custom particle behaviors
 */

class ParticleSystem {
    constructor(maxParticles = 1000) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.emitters = [];
        this.pool = [];

        // Pre-allocate particle pool for performance
        for (let i = 0; i < maxParticles; i++) {
            this.pool.push(this.createParticle());
        }
    }

    createParticle() { 
        return {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            life: 0,
            maxLife: 0,
            size: 0,
            sizeDecay: 0,
            color: '#ffffff',
            color2: null, // For gradient particles
            alpha: 1,
            alphaDecay: 0,
            gravity: 0,
            drag: 0,
            rotation: 0,
            rotationSpeed: 0,
            shape: 'circle', // circle, square, triangle, star
            blendMode: 'lighter', // lighter, source-over, screen
            active: false
        };
    }

    getParticle() {
        if (this.pool.length > 0) {
            const particle = this.pool.pop();
            particle.active = true;
            return particle;
        }

        // If pool is empty, recycle oldest particle
        const oldParticle = this.particles.find(p => p.active);
        if (oldParticle) {
            return oldParticle;
        }

        return null;
    }

    emit(options) {
        const {
            x,
            y,
            count = 1,
            vxMin = 0,
            vxMax = 0,
            vyMin = 0,
            vyMax = 0,
            lifeMin = 500,
            lifeMax = 1000,
            sizeMin = 2,
            sizeMax = 5,
            sizeDecay = 0,
            color = '#ffffff',
            color2 = null,
            alphaDecay = 0,
            gravity = 0,
            drag = 0,
            shape = 'circle',
            blendMode = 'lighter',
            spread = 360,
            spreadStart = 0,
            speedMin = 0,
            speedMax = 0
        } = options;

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) continue;

            // Position
            particle.x = x + (Math.random() - 0.5) * (options.xSpread || 0);
            particle.y = y + (Math.random() - 0.5) * (options.ySpread || 0);

            // Velocity - either directional or radial spread
            if (speedMin !== 0 || speedMax !== 0) {
                const angle = (spreadStart + Math.random() * spread) * Math.PI / 180;
                const speed = speedMin + Math.random() * (speedMax - speedMin);
                particle.vx = Math.cos(angle) * speed;
                particle.vy = Math.sin(angle) * speed;
            } else {
                particle.vx = vxMin + Math.random() * (vxMax - vxMin);
                particle.vy = vyMin + Math.random() * (vyMax - vyMin);
            }

            // Life
            particle.life = lifeMin + Math.random() * (lifeMax - lifeMin);
            particle.maxLife = particle.life;

            // Size
            particle.size = sizeMin + Math.random() * (sizeMax - sizeMin);
            particle.sizeDecay = sizeDecay;

            // Color
            particle.color = color;
            particle.color2 = color2;

            // Physics
            particle.gravity = gravity;
            particle.drag = drag;
            particle.alphaDecay = alphaDecay;

            // Appearance
            particle.shape = shape;
            particle.blendMode = blendMode;

            // Rotation
            particle.rotation = Math.random() * Math.PI * 2;
            particle.rotationSpeed = (Math.random() - 0.5) * 0.2;

            this.particles.push(particle);
        }
    }

    // Explosion effect
    explode(x, y, options = {}) {
        const {
            count = 30,
            colors = ['#ff6b6b', '#feca57', '#ff9ff3', '#ffffff'],
            sizeMin = 3,
            sizeMax = 8,
            speedMin = 2,
            speedMax = 10,
            lifeMin = 300,
            lifeMax = 800
        } = options;

        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.emit({
                x,
                y,
                color,
                sizeMin,
                sizeMax,
                speedMin,
                speedMax,
                spread: 360,
                lifeMin,
                lifeMax,
                gravity: 0.1,
                drag: 0.02,
                alphaDecay: 0.002
            });
        }
    }

    // Trail effect (for player movement)
    trail(x, y, options = {}) {
        const {
            count = 2,
            color = '#00ffff',
            sizeMin = 2,
            sizeMax = 4,
            lifeMin = 200,
            lifeMax = 400,
            vxMin = -0.5,
            vxMax = 0.5,
            vyMin = -0.5,
            vyMax = 0.5
        } = options;

        this.emit({
            x,
            y,
            count,
            color,
            sizeMin,
            sizeMax,
            vxMin,
            vxMax,
            vyMin,
            vyMax,
            lifeMin,
            lifeMax,
            alphaDecay: 0.005,
            drag: 0.1
        });
    }

    // Sparkle effect (for power-ups, collectibles)
    sparkle(x, y, options = {}) {
        const {
            count = 10,
            colors = ['#ffff00', '#00ffff', '#ff00ff', '#00ff00'],
            sizeMin = 2,
            sizeMax = 4,
            speedMin = 1,
            speedMax = 3,
            lifeMin = 400,
            lifeMax = 800
        } = options;

        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const angle = (i / count) * Math.PI * 2;
            const speed = speedMin + Math.random() * (speedMax - speedMin);

            this.emit({
                x,
                y,
                color,
                sizeMin,
                sizeMax,
                vxMin: Math.cos(angle) * speed,
                vxMax: Math.cos(angle) * speed,
                vyMin: Math.sin(angle) * speed,
                vyMax: Math.sin(angle) * speed,
                lifeMin,
                lifeMax,
                drag: 0.05,
                alphaDecay: 0.003,
                shape: 'star'
            });
        }
    }

    // Smoke effect
    smoke(x, y, options = {}) {
        const {
            count = 5,
            color = '#888888',
            sizeMin = 10,
            sizeMax = 20,
            lifeMin = 800,
            lifeMax = 1500,
            speedMin = 1,
            speedMax = 2
        } = options;

        this.emit({
            x,
            y,
            count,
            color,
            sizeMin,
            sizeMax,
            vyMin: -speedMax,
            vyMax: -speedMin,
            vxMin: -0.5,
            vxMax: 0.5,
            lifeMin,
            lifeMax,
            drag: 0.02,
            alphaDecay: 0.001,
            blendMode: 'source-over'
        });
    }

    // Fire effect
    fire(x, y, options = {}) {
        const {
            count = 10,
            colors = ['#ff4500', '#ff6347', '#ffa500', '#ffff00'],
            sizeMin = 5,
            sizeMax = 15,
            lifeMin = 300,
            lifeMax = 600,
            speedMin = 2,
            speedMax = 5
        } = options;

        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.emit({
                x,
                y,
                color,
                sizeMin: sizeMin + Math.random() * 5,
                sizeMax: sizeMax,
                vyMin: -speedMax,
                vyMax: -speedMin,
                vxMin: -1,
                vxMax: 1,
                lifeMin: lifeMin + Math.random() * 200,
                lifeMax,
                drag: 0.02,
                alphaDecay: 0.003,
                blendMode: 'lighter'
            });
        }
    }

    // Create an emitter for continuous particle emission
    createEmitter(options) {
        const emitter = {
            x: options.x || 0,
            y: options.y || 0,
            interval: options.interval || 100,
            lastEmit: 0,
            options: { ...options },
            active: true
        };
        this.emitters.push(emitter);
        return emitter;
    }

    removeEmitter(emitter) {
        const index = this.emitters.indexOf(emitter);
        if (index > -1) {
            this.emitters.splice(index, 1);
        }
    }

    update(dt) {
        const deltaTime = dt * 1000; // Convert to ms

        // Update emitters
        this.emitters.forEach(emitter => {
            if (!emitter.active) return;

            emitter.lastEmit += deltaTime;
            if (emitter.lastEmit >= emitter.interval) {
                this.emit({
                    ...emitter.options,
                    x: emitter.x,
                    y: emitter.y
                });
                emitter.lastEmit = 0;
            }
        });

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (!p.active) {
                this.particles.splice(i, 1);
                continue;
            }

            // Update life
            p.life -= deltaTime;

            if (p.life <= 0) {
                p.active = false;
                this.particles.splice(i, 1);
                this.pool.push(p);
                continue;
            }

            // Apply physics
            p.vx *= (1 - p.drag);
            p.vy *= (1 - p.drag);
            p.vy += p.gravity;

            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Update size
            if (p.sizeDecay !== 0) {
                p.size += p.sizeDecay;
                if (p.size <= 0) {
                    p.active = false;
                    this.particles.splice(i, 1);
                    this.pool.push(p);
                    continue;
                }
            }

            // Update alpha
            if (p.alphaDecay !== 0) {
                p.alpha -= p.alphaDecay;
                if (p.alpha <= 0) {
                    p.active = false;
                    this.particles.splice(i, 1);
                    this.pool.push(p);
                    continue;
                }
            }

            // Update rotation
            p.rotation += p.rotationSpeed;
        }
    }

    render(ctx) {
        // Sort particles by blend mode for better batching
        const additiveParticles = this.particles.filter(p => p.blendMode === 'lighter');
        const normalParticles = this.particles.filter(p => p.blendMode !== 'lighter');

        // Render normal particles
        normalParticles.forEach(p => this.renderParticle(ctx, p));

        // Render additive particles
        if (additiveParticles.length > 0) {
            ctx.globalCompositeOperation = 'lighter';
            additiveParticles.forEach(p => this.renderParticle(ctx, p));
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    renderParticle(ctx, p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        const alpha = Math.max(0, Math.min(1, p.alpha));

        if (p.color2) {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            gradient.addColorStop(0, p.color);
            gradient.addColorStop(1, p.color2);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = p.color;
        }

        // Apply alpha to color
        ctx.globalAlpha = alpha;

        switch (p.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(0, p.size), 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'square':
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                break;

            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(0, -p.size);
                ctx.lineTo(p.size, p.size);
                ctx.lineTo(-p.size, p.size);
                ctx.closePath();
                ctx.fill();
                break;

            case 'star':
                this.renderStar(ctx, 0, 0, 5, p.size, p.size / 2);
                break;
        }

        ctx.restore();
    }

    renderStar(ctx, x, y, points, outerRadius, innerRadius) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
    }

    // Clear all particles
    clear() {
        this.particles.forEach(p => {
            p.active = false;
            this.pool.push(p);
        });
        this.particles = [];
        this.emitters.forEach(e => e.active = false);
        this.emitters = [];
    }

    // Get particle count for debugging
    getCount() {
        return this.particles.filter(p => p.active).length;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParticleSystem;
}
