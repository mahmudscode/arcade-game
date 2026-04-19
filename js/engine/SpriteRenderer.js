/**
 * SpriteRenderer.js - Modern sprite rendering with neon effects and gradients
 * For Retro Arcade Classics
 */

class SpriteRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.glowEnabled = true;
        this.layerStack = [];
    }

    // Enable glow effect
    setGlow(color, blur = 20) {
        if (this.glowEnabled) {
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = blur; 
        }
    }

    clearGlow() {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
    }

    // Draw a glowing rectangle
    drawGlowingRect(x, y, width, height, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            gradient = null,
            rotation = 0,
            alpha = 1
        } = options;

        this.ctx.save();
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(rotation);

        this.setGlow(glowColor, glowBlur);
        this.ctx.globalAlpha = alpha;

        if (gradient) {
            this.ctx.fillStyle = this.createGradient(-width/2, -height/2, width/2, height/2, gradient);
        } else {
            this.ctx.fillStyle = color;
        }

        this.ctx.fillRect(-width / 2, -height / 2, width, height);

        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a glowing circle
    drawGlowingCircle(x, y, radius, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            gradient = null,
            alpha = 1
        } = options;

        this.ctx.save();
        this.setGlow(glowColor, glowBlur);
        this.ctx.globalAlpha = alpha;

        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (gradient) {
            const grad = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.forEach(([stop, color]) => grad.addColorStop(stop, color));
            this.ctx.fillStyle = grad;
        } else {
            this.ctx.fillStyle = color;
        }

        this.ctx.fill();
        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a glowing polygon
    drawGlowingPolygon(points, x, y, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            scale = 1,
            rotation = 0,
            alpha = 1
        } = options;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        this.ctx.scale(scale, scale);

        this.setGlow(glowColor, glowBlur);
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;

        this.ctx.beginPath();
        points.forEach(([px, py], i) => {
            if (i === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        });
        this.ctx.closePath();
        this.ctx.fill();

        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a neon-style line
    drawNeonLine(x1, y1, x2, y2, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 15,
            width = 2,
            dashed = false
        } = options;

        this.ctx.save();
        this.setGlow(glowColor, glowBlur);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;

        if (dashed) {
            this.ctx.setLineDash(dashed);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a glowing sprite (image)
    drawGlowingSprite(image, x, y, options = {}) {
        const {
            width = image.width,
            height = image.height,
            glowColor = '#ffffff',
            glowBlur = 15,
            rotation = 0,
            alpha = 1,
            flipX = false,
            flipY = false
        } = options;

        this.ctx.save();
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(rotation);
        this.ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

        this.setGlow(glowColor, glowBlur);
        this.ctx.globalAlpha = alpha;

        this.ctx.drawImage(image, -width / 2, -height / 2, width, height);

        this.clearGlow();
        this.ctx.restore();
    }

    // Draw text with glow effect
    drawGlowingText(text, x, y, options = {}) {
        const {
            size = 24,
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            font = 'Arial',
            align = 'left',
            bold = false,
            italic = false
        } = options;

        this.ctx.save();
        this.setGlow(glowColor, glowBlur);
        this.ctx.fillStyle = color;
        this.ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${font}`;
        this.ctx.textAlign = align;
        this.ctx.fillText(text, x, y);
        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a gradient rectangle
    drawGradientRect(x, y, width, height, colors, options = {}) {
        const {
            direction = 'horizontal', // horizontal, vertical, diagonal
            glowColor = null,
            glowBlur = 0,
            rotation = 0,
            alpha = 1
        } = options;

        this.ctx.save();
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(rotation);
        this.ctx.globalAlpha = alpha;

        let gradient;
        if (direction === 'horizontal') {
            gradient = this.ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
        } else if (direction === 'vertical') {
            gradient = this.ctx.createLinearGradient(0, -height / 2, 0, height / 2);
        } else { // diagonal
            gradient = this.ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
        }

        colors.forEach(([stop, color]) => {
            gradient.addColorStop(stop, color);
        });

        if (glowColor) {
            this.setGlow(glowColor, glowBlur);
        }

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(-width / 2, -height / 2, width, height);

        this.clearGlow();
        this.ctx.restore();
    }

    // Create a gradient helper
    createGradient(x1, y1, x2, y2, colors) {
        const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
        colors.forEach(([stop, color]) => {
            gradient.addColorStop(stop, color);
        });
        return gradient;
    }

    // Draw a pulsing circle (for power-ups, etc.)
    drawPulsingCircle(x, y, baseRadius, time, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            pulseSpeed = 0.005,
            pulseAmount = 0.2
        } = options;

        const pulse = Math.sin(time * pulseSpeed) * pulseAmount + 1;
        const radius = baseRadius * pulse;

        this.drawGlowingCircle(x, y, radius, { color, glowColor, glowBlur });
    }

    // Draw a star shape
    drawStar(x, y, points, outerRadius, innerRadius, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            rotation = -Math.PI / 2,
            alpha = 1
        } = options;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);

        this.setGlow(glowColor, glowBlur);
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;

        this.ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;

            if (i === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();

        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a rounded rectangle
    drawRoundedRect(x, y, width, height, radius, options = {}) {
        const {
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            gradient = null,
            alpha = 1
        } = options;

        this.ctx.save();
        this.setGlow(glowColor, glowBlur);
        this.ctx.globalAlpha = alpha;

        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();

        if (gradient) {
            this.ctx.fillStyle = this.createGradient(x, y, x + width, y + height, gradient);
        } else {
            this.ctx.fillStyle = color;
        }

        this.ctx.fill();
        this.clearGlow();
        this.ctx.restore();
    }

    // Draw a character/emoji with glow
    drawCharacter(char, x, y, options = {}) {
        const {
            size = 48,
            color = '#ffffff',
            glowColor = color,
            glowBlur = 20,
            font = 'Arial'
        } = options;

        this.ctx.save();
        this.setGlow(glowColor, glowBlur);
        this.ctx.fillStyle = color;
        this.ctx.font = `${size}px ${font}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(char, x, y);
        this.clearGlow();
        this.ctx.restore();
    }

    // Draw multiple sprites in a batch (for efficiency)
    batchDraw(drawCalls) {
        // Group by blend mode/glow settings for batching
        this.ctx.save();

        drawCalls.forEach(call => {
            if (call.glow) {
                this.setGlow(call.glowColor || call.color, call.glowBlur || 20);
            }
            if (call.alpha) {
                this.ctx.globalAlpha = call.alpha;
            }

            // Execute the draw call
            call.fn(this.ctx);

            if (call.glow) {
                this.clearGlow();
            }
            this.ctx.globalAlpha = 1;
        });

        this.ctx.restore();
    }

    // Layer management for complex scenes
    pushLayer() {
        this.ctx.save();
        this.layerStack.push(true);
    }

    popLayer() {
        if (this.layerStack.length > 0) {
            this.ctx.restore();
            this.layerStack.pop();
        }
    }

    // Draw with a composite operation
    withComposite(operation, drawFn) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = operation;
        drawFn();
        this.ctx.restore();
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpriteRenderer;
}
