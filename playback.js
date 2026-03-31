class PlaybackEngine {
    constructor(canvasEngine, soundMapper) {
        this.canvasEngine = canvasEngine;
        this.soundMapper = soundMapper;

        this.isPlaying = false;
        this.playbackSpeed = 7;
        this.scanPosition = 0;
        this.scanWidth = 1;
        this.lastScanTime = 0;

        // Per-instrument throttle to prevent flooding
        this.lastInstrumentTime = {};
        this.instrumentCooldown = 100; // ms per instrument

        this.onPlaybackUpdate = null;
    }

    start() {
        if (this.isPlaying) {
            return;
        }

        this.isPlaying = true;
        this.scanPosition = 0;
        this.lastScanTime = performance.now();
        this.scan();
    }

    stop() {
        this.isPlaying = false;
        this.scanPosition = 0;

        if (this.onPlaybackUpdate) {
            this.onPlaybackUpdate(null);
        }
    }

    setSpeed(speed) {
        this.playbackSpeed = Math.max(1, Math.min(10, speed));
    }

    scan() {
        if (!this.isPlaying) {
            return;
        }

        const now = performance.now();
        const canvas = this.canvasEngine.canvas;
        const ctx = this.canvasEngine.ctx;

        const deltaTime = now - this.lastScanTime;
        const intervalMs = 200 - (this.playbackSpeed * 15);

        if (deltaTime >= intervalMs) {
            this.scanPosition++;

            if (this.scanPosition >= canvas.width) {
                this.scanPosition = 0;
            }

            const x = Math.floor(this.scanPosition);

            const imageData = ctx.getImageData(x, 0, this.scanWidth, canvas.height);

            const sampleInterval = 8;

            for (let y = 0; y < canvas.height; y += sampleInterval) {
                const index = (y * this.scanWidth) * 4;
                const pixelData = imageData.data.slice(index, index + 4);

                const soundParams = this.soundMapper.mapPixelToSound(
                    x,
                    y,
                    pixelData,
                    canvas.width,
                    canvas.height
                );

                if (soundParams) {
                    const audioContext = this.soundMapper.audioEngine.audioContext;
                    if (audioContext && audioContext.state === 'running') {
                        // Per-instrument throttle
                        const lastTime = this.lastInstrumentTime[soundParams.instrument] || 0;
                        if (now - lastTime < this.instrumentCooldown) {
                            continue;
                        }
                        this.lastInstrumentTime[soundParams.instrument] = now;

                        this.soundMapper.audioEngine.playInstrumentByName(
                            soundParams.instrument,
                            undefined,
                            soundParams.volume * 0.8,
                            soundParams.pitch,
                            soundParams.pan,
                            soundParams.reverbMix
                        );
                    } else if (audioContext && audioContext.state === 'suspended') {
                        audioContext.resume().catch(() => {});
                    }
                }
            }

            if (this.onPlaybackUpdate) {
                this.onPlaybackUpdate(x);
            }

            this.lastScanTime = now;
        }

        requestAnimationFrame(() => this.scan());
    }

    setPlaybackUpdateCallback(callback) {
        this.onPlaybackUpdate = callback;
    }
}
