/**
 * Ambient Audio Engine - Web Audio API voor atmosferische soundscapes
 * Langdurige, dromerige geluiden voor ambient soundscapes
 */

class AmbientAudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.reverb = null;
        this.compressor = null;

        // Node tracking to prevent resource exhaustion
        this.activeNodes = 0;
        this.maxActiveNodes = 120;

        // Cached noise buffers (reused instead of recreated)
        this.noiseBuffers = {};
    }

    /**
     * Initialiseer de audio context
     */
    init() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Compressor/limiter to prevent clipping
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.005;
        this.compressor.release.value = 0.15;

        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8;

        // Create reverb for ambient feel
        this.createReverb();

        // Chain: sources -> reverb -> masterGain -> compressor -> destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.audioContext.destination);
    }

    /**
     * Get or create a cached noise buffer of given duration
     */
    getNoiseBuffer(duration) {
        const key = duration.toFixed(1);
        if (!this.noiseBuffers[key]) {
            const bufferSize = this.audioContext.sampleRate * duration;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffers[key] = buffer;
        }
        return this.noiseBuffers[key];
    }

    /**
     * Check if we can spawn new audio nodes, track active count
     */
    acquireNode(count = 1) {
        if (this.activeNodes >= this.maxActiveNodes) {
            return false;
        }
        this.activeNodes += count;
        return true;
    }

    releaseNodes(count = 1) {
        this.activeNodes = Math.max(0, this.activeNodes - count);
    }

    createReverb() {
        const reverbTime = 3.0;
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * reverbTime;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        this.reverb = this.audioContext.createConvolver();
        this.reverb.buffer = impulse;

        // Connect reverb to master gain
        this.reverb.connect(this.masterGain);
    }

    /**
     * Drone - Lange aanhoudende toon
     */
    playDrone(time = 0, volume = 1) {
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 2.0;
        const freqs = [220, 220.5, 221];

        if (!this.acquireNode(freqs.length)) return;

        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(volume * 0.3, t + 0.3);
            gain.gain.linearRampToValueAtTime(volume * 0.3, t + duration - 0.5);
            gain.gain.linearRampToValueAtTime(0, t + duration);

            osc.connect(gain);
            gain.connect(this.reverb);

            osc.start(t);
            osc.stop(t + duration);
            osc.onended = () => this.releaseNodes(1);
        });
    }

    /**
     * Shimmer - Hoge, sprankelende tonen
     */
    playShimmer(time = 0, volume = 1) {
        if (!this.acquireNode(1)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 1.5;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(2400, t + duration);

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(800, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 0.4, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);

        osc.start(t);
        osc.stop(t + duration);
        osc.onended = () => this.releaseNodes(1);
    }

    /**
     * Pad - Warme, zachte achtergrondtoon
     */
    playPad(time = 0, volume = 1) {
        const harmonics = [1, 1.5, 2, 3];
        if (!this.acquireNode(harmonics.length)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 2.5;
        const baseFreq = 130;

        harmonics.forEach((ratio, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(baseFreq * ratio, t);

            const harmVolume = volume * 0.1 / (i + 1);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(harmVolume, t + 0.5);
            gain.gain.linearRampToValueAtTime(0, t + duration);

            osc.connect(gain);
            gain.connect(this.reverb);

            osc.start(t);
            osc.stop(t + duration);
            osc.onended = () => this.releaseNodes(1);
        });
    }

    /**
     * Bell - Klokachtig, resonerend geluid
     */
    playBell(time = 0, volume = 1) {
        const frequencies = [800, 1200, 1600, 2000];
        if (!this.acquireNode(frequencies.length)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 3.0;

        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(volume * 0.35, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(gain);
            gain.connect(this.reverb);

            osc.start(t);
            osc.stop(t + duration);
            osc.onended = () => this.releaseNodes(1);
        });
    }

    /**
     * Wind - Ruisachtig windgeluid
     */
    playWind(time = 0, volume = 1) {
        if (!this.acquireNode(1)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 2.0;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = this.getNoiseBuffer(duration);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.linearRampToValueAtTime(800, t + duration);
        filter.Q.value = 1;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 0.1, t + 0.3);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);

        noise.start(t);
        noise.stop(t + duration);
        noise.onended = () => this.releaseNodes(1);
    }

    /**
     * Rain - Regendruppels
     */
    playRain(time = 0, volume = 1) {
        if (!this.acquireNode(3)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;

        for (let i = 0; i < 3; i++) {
            const delay = Math.random() * 0.05;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1500 + Math.random() * 500, t + delay);

            filter.type = 'highpass';
            filter.frequency.value = 1000;

            gain.gain.setValueAtTime(volume * 0.3, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(t + delay);
            osc.stop(t + delay + 0.1);
            osc.onended = () => this.releaseNodes(1);
        }
    }

    /**
     * Ocean - Golfgeluid
     */
    playOcean(time = 0, volume = 1) {
        if (!this.acquireNode(1)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 3.0;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = this.getNoiseBuffer(duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(400, t + duration / 2);
        filter.frequency.linearRampToValueAtTime(200, t + duration);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 0.15, t + 0.5);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);

        noise.start(t);
        noise.stop(t + duration);
        noise.onended = () => this.releaseNodes(1);
    }

    /**
     * Sparkle - Korte, hoge tonen
     */
    playSparkle(time = 0, volume = 1) {
        if (!this.acquireNode(2)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;

        for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            const freq = 2000 + Math.random() * 2000;
            osc.frequency.setValueAtTime(freq, t + i * 0.05);

            gain.gain.setValueAtTime(volume * 0.35, t + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.3);

            osc.connect(gain);
            gain.connect(this.reverb);

            osc.start(t + i * 0.05);
            osc.stop(t + i * 0.05 + 0.3);
            osc.onended = () => this.releaseNodes(1);
        }
    }

    /**
     * Swoosh - Sweeping geluid
     */
    playSwoosh(time = 0, volume = 1) {
        if (!this.acquireNode(1)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 1.2;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + duration);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(2000, t + duration);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 0.2, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);

        osc.start(t);
        osc.stop(t + duration);
        osc.onended = () => this.releaseNodes(1);
    }

    /**
     * Breath - Ademachtig geluid
     */
    playBreath(time = 0, volume = 1) {
        if (!this.acquireNode(1)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 1.5;

        const noise = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        noise.buffer = this.getNoiseBuffer(duration);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, t);
        filter.Q.value = 2;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 0.12, t + 0.5);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);

        noise.start(t);
        noise.stop(t + duration);
        noise.onended = () => this.releaseNodes(1);
    }

    /**
     * Crystal - Kristalachtig geluid
     */
    playCrystal(time = 0, volume = 1) {
        const freqs = [1100, 1650, 2200];
        if (!this.acquireNode(freqs.length)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 2.0;

        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.linearRampToValueAtTime(freq * 0.98, t + duration);

            gain.gain.setValueAtTime(volume * 0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(gain);
            gain.connect(this.reverb);

            osc.start(t);
            osc.stop(t + duration);
            osc.onended = () => this.releaseNodes(1);
        });
    }

    /**
     * Void - Diep, zwevend geluid
     */
    playVoid(time = 0, volume = 1) {
        if (!this.acquireNode(1)) return;
        const ctx = this.audioContext;
        const t = time || ctx.currentTime;
        const duration = 3.0;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.linearRampToValueAtTime(50, t + duration);

        filter.type = 'lowpass';
        filter.frequency.value = 200;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * 0.2, t + 0.8);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb);

        osc.start(t);
        osc.stop(t + duration);
        osc.onended = () => this.releaseNodes(1);
    }

    /**
     * Play instrument by name
     */
    playInstrumentByName(instrumentName, time = 0, volume = 1) {
        if (!this.audioContext) return;

        switch(instrumentName) {
            case 'drone':
                this.playDrone(time, volume);
                break;
            case 'shimmer':
                this.playShimmer(time, volume);
                break;
            case 'pad':
                this.playPad(time, volume);
                break;
            case 'bell':
                this.playBell(time, volume);
                break;
            case 'wind':
                this.playWind(time, volume);
                break;
            case 'rain':
                this.playRain(time, volume);
                break;
            case 'ocean':
                this.playOcean(time, volume);
                break;
            case 'sparkle':
                this.playSparkle(time, volume);
                break;
            case 'swoosh':
                this.playSwoosh(time, volume);
                break;
            case 'breath':
                this.playBreath(time, volume);
                break;
            case 'crystal':
                this.playCrystal(time, volume);
                break;
            case 'void':
                this.playVoid(time, volume);
                break;
            default:
                this.playDrone(time, volume);
        }
    }
}
