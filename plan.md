     Context

     The user wants to build a web-based arcade platform featuring classic arcade games from the 70s-80s era with modern, updated graphics. This is an expansion of the existing arcade-website project which
     currently has 20 simple JavaScript games (Snake, Tetris, Pac-Man, etc.) with basic canvas rendering.

     Games to Implement (13 classic titles):
     1. Pac-Man
     2. Donkey Kong
     3. Space Invaders
     4. Galaga
     5. Frogger
     6. Asteroids
     7. Centipede
     8. Dig Dug
     9. Q*bert
     10. Bubble Bobble
     11. Contra
     12. Double Dragon
     13. Ghosts 'n Goblins

     Key Vision: These shouldn't be pixel-perfect emulations, but rather reimaginings with modern visual effects like:
     - Neon/glow effects
     - Particle systems
     - Smooth animations
     - Gradient colors and shaders
     - Modern UI overlays
     - Dynamic lighting effects

     ---
     Recommended Approach

     Architecture Overview

     Build each game as a self-contained module using HTML5 Canvas with a shared game engine framework for:
     - Input handling
     - Audio management
     - Particle effects
     - Sprite rendering with modern effects
     - Game loop management

     File Structure

     arcade-website/
     ├── index.html              # Update with new game cards
     ├── css/
     │   └── styles.css          # Enhanced styles for modern UI
     ├── js/
     │   ├── main.js             # App initialization
     │   ├── games.js            # Game registry (existing)
     │   ├── engine/
     │   │   ├── GameEngine.js   # Shared game loop, input, audio
     │   │   ├── ParticleSystem.js
     │   │   ├── SpriteRenderer.js
     │   │   └── AudioController.js
     │   └── games/
     │       ├── pacman.js
     │       ├── donkey-kong.js
     │       ├── space-invaders.js
     │       ├── galaga.js
     │       ├── frogger.js
     │       ├── asteroids.js
     │       ├── centipede.js
     │       ├── dig-dug.js
     │       ├── qbert.js
     │       ├── bubble-bobble.js
     │       ├── contra.js
     │       ├── double-dragon.js
     │       └── ghosts-n-goblins.js
     ├── assets/
     │   ├── sprites/            # Modern sprite sheets
     │   └── audio/              # Sound effects, music
     └── games/                  # Keep existing simple games separate

     ---
     Implementation Phases

     Phase 1: Core Engine (Week 1)

     Files to create:
     - js/engine/GameEngine.js - Base game class with:
       - RequestAnimationFrame game loop
       - Delta time calculation
       - State management (start, play, pause, gameover)
       - Canvas context wrapper
     - js/engine/ParticleSystem.js - Reusable particle effects:
       - Explosion particles
       - Trail effects
       - Power-up sparkles
       - Death animations
     - js/engine/SpriteRenderer.js - Modern rendering:
       - Glow effects (shadowBlur)
       - Gradient fills
       - Rotation/scaling transforms
       - Layer-based rendering
     - js/engine/AudioController.js - Sound management:
       - Web Audio API integration
       - Sound pool for SFX
       - Background music looping

     Phase 2: First 3 Games - Proof of Concept (Week 2)

     Start with simpler games to establish patterns:

     Game 1: Space Invaders (js/games/space-invaders.js)
     - Modern take: Neon alien designs, particle explosions
     - Features:
       - Glowing alien sprites with gradient colors
       - Particle bursts on alien death
       - Smooth player movement with trail effect
       - Modern HUD with score multipliers
       - Power-up system (spread shot, shield, speed boost)

     Game 2: Asteroids (js/games/asteroids.js)
     - Modern take: Geometric neon shapes with physics
     - Features:
       - Glowing polygon asteroids
       - Thruster particle trails
       - Screen shake on collisions
       - Fragmentation effects when asteroids split
       - Power-ups with visual indicators

     Game 3: Pac-Man (js/games/pacman.js)
     - Modern take: Neon maze with dynamic lighting
     - Features:
       - Glowing maze walls with pulse effect
       - Pac-Man with trail effect
       - Ghost AI with visible pathfinding hints
       - Power pellet ghost vulnerability (blue glow + shake)
       - Particle effects when eating dots

     Phase 3: Mid-Tier Games (Week 3-4)

     Frogger - Water effects with shaders, particle splashes
     Galaga - Formation flying with swoop attacks, bomb effects
     Centipede - Organic movement, mushroom growth effects
     Dig Dug - Dirt particle effects, enemy inflation animation
     Q*bert - Isometric cube rendering with shadows, character bounce

     Phase 4: Complex Games (Week 5-6)

     Donkey Kong - Platform physics, barrel rolling animations
     Bubble Bobble - Bubble physics, enemy trapping, co-op support
     Contra - Run-and-gun mechanics, multiple weapon types
     Double Dragon - Beat-em-up combat, combo system
     Ghosts 'n Goblins - Armor mechanics, enemy variety, platforming

     ---
     Technical Details

     Shared Game Engine API

     // Example usage in each game module
     class SpaceInvaders extends GameEngine {
         init() {
             this.player = new Player(this.canvas);
             this.aliens = this.createAlienGrid();
             this.particles = new ParticleSystem();
         }

         update(dt) {
             this.player.update(dt);
             this.aliens.update(dt);
             this.particles.update(dt);
             this.checkCollisions();
         }

         render() {
             this.clear();
             this.renderer.drawGlowingSprite(this.player);
             this.aliens.forEach(a => this.renderer.drawAlien(a));
             this.particles.render(this.ctx);
             this.renderHUD();
         }
     }

     Visual Style Guidelines

     ┌──────────────┬───────────────────────────────────────────────────┐
     │    Effect    │                  Implementation                   │
     ├──────────────┼───────────────────────────────────────────────────┤
     │ Neon Glow    │ ctx.shadowBlur = 20; ctx.shadowColor = color;     │
     ├──────────────┼───────────────────────────────────────────────────┤
     │ Gradients    │ ctx.createLinearGradient() for all sprites        │
     ├──────────────┼───────────────────────────────────────────────────┤
     │ Particles    │ Array of {x, y, vx, vy, life, color, size}        │
     ├──────────────┼───────────────────────────────────────────────────┤
     │ Screen Shake │ Offset canvas by random small amount              │
     ├──────────────┼───────────────────────────────────────────────────┤
     │ Trails       │ Semi-transparent background fill instead of clear │
     └──────────────┴───────────────────────────────────────────────────┘

     Input Handling

     Support both keyboard and touch:
     - Arrow keys / WASD for movement
     - Space / Z for primary action
     - X / Shift for secondary action
     - Touch controls for mobile (virtual D-pad)

     ---
     Critical Files to Modify

     Existing files to update:
     1. index.html - Add game cards for 13 new games
     2. js/games.js - Add game definitions with modern icons
     3. css/styles.css - Add styles for game-specific UI elements

     New files to create:
     1. js/engine/GameEngine.js
     2. js/engine/ParticleSystem.js
     3. js/engine/SpriteRenderer.js
     4. js/engine/AudioController.js
     5. js/games/*.js (13 game files)

     ---
     Verification Strategy

     1. Unit Testing: Test engine components independently
       - ParticleSystem creates/updates/destroys particles correctly
       - Input handler captures all key events
       - Game loop maintains 60fps
     2. Integration Testing:
       - Load each game in modal
       - Verify controls respond correctly
       - Check score tracking works
     3. Visual Testing:
       - Run each game for 2+ minutes
       - Verify particle effects trigger on events
       - Confirm glow effects render on all sprites
       - Test on different screen sizes
     4. Performance:
       - Chrome DevTools FPS meter should show 55-60fps
       - No memory leaks (check heap over time)
       - Particle count capped at reasonable limit

     ---
     Future Enhancements (Out of Scope)

     - Multiplayer/netplay
     - Save system / high scores backend
     - Achievement system
     - Custom skin editor
     - Level editor
     - Mobile app wrapping

     ---
     Summary

