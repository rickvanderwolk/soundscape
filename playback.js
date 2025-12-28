class PlaybackEngine {
    constructor(canvasEngine, soundMapper) {
        this.canvasEngine = canvasEngine;
        this.soundMapper = soundMapper;

        this.isPlaying = false;
        this.playbackSpeed = 7; // 1-10 scale (faster default)
        this.scanPosition = 0;
        this.scanWidth = 1; // Width of the scan line in pixels
        this.lastScanTime = 0;

        this.onPlaybackUpdate = null;
    }

    start() {
        if (this.isPlaying) {
            return;
        }

        console.log('[Playback] Starting scan loop...');
        this.isPlaying = true;
        this.scanPosition = 0;
        this.lastScanTime = performance.now();
        this.scan();
        console.log('[Playback] Scan loop initiated');
    }

    stop() {
        this.isPlaying = false;
        this.scanPosition = 0;

        // Trigger update
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

        // Calculate time-based advancement
        const deltaTime = now - this.lastScanTime;

        // Advance every 50-150ms depending on speed (more predictable timing)
        const intervalMs = 200 - (this.playbackSpeed * 15); // Speed 1 = 185ms, Speed 10 = 50ms

        if (deltaTime >= intervalMs) {
            // Advance to next column
            this.scanPosition++;

            // Loop back to start when we reach the end
            if (this.scanPosition >= canvas.width) {
                this.scanPosition = 0;
            }

            const x = Math.floor(this.scanPosition);

            // Get image data for current scan column
            const imageData = ctx.getImageData(x, 0, this.scanWidth, canvas.height);

            // Sample every 8 pixels vertically
            const sampleInterval = 8;
            let soundsTriggered = 0;

            // Process pixels in this column
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
                    // Only play if audio context is running
                    const audioContext = this.soundMapper.audioEngine.audioContext;
                    if (audioContext && audioContext.state === 'running') {
                        // Log first trigger at every 50th position
                        if (soundsTriggered === 0 && x % 50 === 0) {
                            console.log(`[Playback] 🔊 Triggered ${soundParams.instrument} at x:${x} y:${y} vol:${(soundParams.volume * 0.8).toFixed(2)}`);
                        }
                        this.soundMapper.audioEngine.playInstrumentByName(
                            soundParams.instrument,
                            undefined,
                            soundParams.volume * 0.8  // Increased from 0.5 to 0.8
                        );
                        soundsTriggered++;
                    } else if (audioContext && audioContext.state === 'suspended') {
                        // Try to resume on first sound trigger
                        console.warn('[Playback] Audio context suspended, trying to resume...');
                        audioContext.resume().catch(err => {
                            console.error('[Playback] Failed to resume audio context:', err);
                        });
                    }
                }
            }

            // Log scan results every 10 positions (but only if sounds were triggered)
            if (x % 10 === 0 && soundsTriggered > 0) {
                console.log(`[Playback] Scan position: ${x} 🔊 Sounds triggered in this column: ${soundsTriggered}`);
            } else if (x % 100 === 0) {
                console.log(`[Playback] Scan position: ${x} (no sounds)`);
            }

            // Trigger visual update
            if (this.onPlaybackUpdate) {
                this.onPlaybackUpdate(x);
            }

            this.lastScanTime = now;
        }

        // Continue scanning
        requestAnimationFrame(() => this.scan());
    }

    setPlaybackUpdateCallback(callback) {
        this.onPlaybackUpdate = callback;
    }
}
