/**
 * AudioController.js - Web Audio API wrapper for Retro Arcade Classics
 * Handles sound effects, background music, and audio pooling
 */

class AudioController {
    constructor(options = {}) {
        this.options = {
            masterVolume: options.masterVolume ?? 0.7,
            sfxVolume: options.sfxVolume ?? 0.8,
            musicVolume: options.musicVolume ?? 0.5,
            ...options
        };

        this.audioContext = null;
        this.sounds = new Map();
        this.music = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.masterGain = null; 
        this.initialized = false;
        this.muted = false;

        // Sound pool for repeated SFX
        this.soundPool = new Map();
        this.maxPoolSize = 10;
    }

    // Initialize audio context (must be called after user interaction)
    async init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create gain nodes
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.muted ? 0 : this.options.masterVolume;

            this.sfxGain = this.audioContext.createGain();
            this.sfxGain.connect(this.masterGain);
            this.sfxGain.gain.value = this.options.sfxVolume;

            this.musicGain = this.audioContext.createGain();
            this.musicGain.connect(this.masterGain);
            this.musicGain.gain.value = this.options.musicVolume;

            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    // Ensure audio context is running (browsers suspend it until user interaction)
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Load a sound file
    async loadSound(name, url) {
        if (!this.initialized) await this.init();

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds.set(name, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.warn(`Failed to load sound: ${url}`, e);
            return null;
        }
    }

    // Load multiple sounds
    async loadSounds(soundMap) {
        const promises = Object.entries(soundMap).map(
            ([name, url]) => this.loadSound(name, url)
        );
        return Promise.all(promises);
    }

    // Play a sound effect
    play(name, options = {}) {
        if (!this.initialized || !this.sounds.has(name)) return null;

        const {
            volume = 1,
            playbackRate = 1,
            loop = false,
            startTime = 0,
            duration = null
        } = options;

        const buffer = this.sounds.get(name);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.playbackRate.value = playbackRate;

        // Create gain for this instance
        const gain = this.audioContext.createGain();
        gain.connect(this.sfxGain);
        gain.gain.value = volume;

        source.connect(gain);

        // Play the sound
        const playTime = this.audioContext.currentTime + startTime;
        source.start(playTime, 0, duration);

        // Store for potential stopping
        const soundInstance = { source, gain };
        if (!this.soundPool.has(name)) {
            this.soundPool.set(name, []);
        }
        const pool = this.soundPool.get(name);
        pool.push(soundInstance);

        // Clean up pool when done
        source.onended = () => {
            const idx = pool.indexOf(soundInstance);
            if (idx > -1) pool.splice(idx, 1);
        };

        // Limit pool size
        while (pool.length > this.maxPoolSize) {
            const old = pool.shift();
            old.source.stop();
        }

        return soundInstance;
    }

    // Stop all instances of a sound
    stop(name) {
        if (!this.soundPool.has(name)) return;

        const pool = this.soundPool.get(name);
        pool.forEach(instance => {
            try {
                instance.source.stop();
            } catch (e) {
                // Already stopped
            }
        });
        pool.length = 0;
    }

    // Stop all sounds
    stopAll() {
        this.soundPool.forEach((pool, name) => {
            this.stop(name);
        });
    }

    // Play background music
    async playMusic(url, options = {}) {
        if (!this.initialized) await this.init();

        const {
            volume = 1,
            loop = true,
            fadeTime = 1
        } = options;

        try {
            // Stop existing music
            if (this.music) {
                this.stopMusic(fadeTime);
            }

            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            this.music = this.audioContext.createBufferSource();
            this.music.buffer = audioBuffer;
            this.music.loop = loop;

            const gain = this.audioContext.createGain();
            gain.connect(this.musicGain);
            gain.gain.value = 0;

            this.music.connect(gain);
            this.music.start();

            // Fade in
            gain.gain.linearRampToValueAtTime(
                volume,
                this.audioContext.currentTime + fadeTime
            );

            return this.music;
        } catch (e) {
            console.warn(`Failed to load music: ${url}`, e);
            return null;
        }
    }

    // Stop background music
    stopMusic(fadeTime = 1) {
        if (!this.music) return;

        // Find the gain node connected to music
        const musicGain = this.musicGain;

        // Fade out
        musicGain.gain.linearRampToValueAtTime(
            0,
            this.audioContext.currentTime + fadeTime
        );

        // Stop after fade
        setTimeout(() => {
            if (this.music) {
                this.music.stop();
                this.music = null;
            }
        }, fadeTime * 1000);
    }

    // Generate a synthesized sound effect (no external files needed)
    playSynth(type, options = {}) {
        if (!this.initialized) {
            this.init();
        }

        const {
            frequency = 440,
            duration = 0.1,
            volume = 0.3,
            type: waveType = 'square',
            slideTo = null,
            attack = 0.01,
            decay = 0.1
        } = options;

        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        oscillator.connect(gain);
        gain.connect(this.sfxGain);

        oscillator.type = waveType;
        oscillator.frequency.value = frequency;

        // Volume envelope
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + attack);
        gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + attack + decay + duration);

        // Frequency slide
        if (slideTo !== null) {
            oscillator.frequency.linearRampToValueAtTime(
                slideTo,
                this.audioContext.currentTime + duration
            );
        }

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration + attack + decay);

        return { oscillator, gain };
    }

    // Preset synth sounds for arcade games
    playJump() {
        this.playSynth('square', {
            frequency: 150,
            slideTo: 300,
            duration: 0.2,
            volume: 0.2
        });
    }

    playShoot() {
        this.playSynth('square', {
            frequency: 800,
            slideTo: 200,
            duration: 0.1,
            volume: 0.15,
            decay: 0.05
        });
    }

    playExplosion() {
        // Noise-based explosion
        this.playNoise(0.3, 0.3);
    }

    playCollect() {
        this.playSynth('sine', {
            frequency: 880,
            duration: 0.1,
            volume: 0.2
        });
    }

    playPowerUp() {
        this.playSynth('sine', {
            frequency: 440,
            slideTo: 880,
            duration: 0.3,
            volume: 0.2
        });
    }

    playHit() {
        this.playSynth('sawtooth', {
            frequency: 100,
            slideTo: 50,
            duration: 0.2,
            volume: 0.2
        });
    }

    playGameOver() {
        // Descending arpeggio
        [440, 349, 277, 220].forEach((freq, i) => {
            setTimeout(() => {
                this.playSynth('sawtooth', {
                    frequency: freq,
                    duration: 0.3,
                    volume: 0.2
                });
            }, i * 200);
        });
    }

    // Generate noise for explosions
    playNoise(duration = 0.3, volume = 0.3) {
        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        // Lowpass filter for better explosion sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
        return { noise, filter, gain };
    }

    // Volume controls
    setMasterVolume(value) {
        this.options.masterVolume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.options.masterVolume;
        }
    }

    setSfxVolume(value) {
        this.options.sfxVolume = Math.max(0, Math.min(1, value));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.options.sfxVolume;
        }
    }

    setMusicVolume(value) {
        this.options.musicVolume = Math.max(0, Math.min(1, value));
        if (this.musicGain) {
            this.musicGain.gain.value = this.options.musicVolume;
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.options.masterVolume;
        }
        return this.muted;
    }

    setMute(value) {
        this.muted = value;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.options.masterVolume;
        }
    }

    // Cleanup
    destroy() {
        this.stopAll();
        this.stopMusic(0);
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioController;
}
