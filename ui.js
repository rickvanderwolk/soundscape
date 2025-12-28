// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize engines
    const audioEngine = new AmbientAudioEngine();
    const canvasEngine = new CanvasEngine('drawingCanvas');
    const soundMapper = new SoundMapper(audioEngine);
    const playbackEngine = new PlaybackEngine(canvasEngine, soundMapper);

    let audioInitialized = false;
    const startOverlay = document.getElementById('startOverlay');
    const startButton = document.getElementById('startButton');

    // Check if device is mobile/touch
    const isTouchDevice = ('ontouchstart' in window) ||
                         (navigator.maxTouchPoints > 0) ||
                         (navigator.msMaxTouchPoints > 0);

    // Op touch devices, toon de overlay meteen
    if (isTouchDevice && startOverlay) {
        console.log('[UI] Touch device detected, showing start button');
        startOverlay.style.display = 'flex';
    }

    // Initialize audio on first user interaction
    async function initAudio() {
        if (!audioInitialized) {
            try {
                console.log('[Audio] Initializing audio engine...');
                audioEngine.init();
                console.log('[Audio] Initial audio context state:', audioEngine.audioContext.state);

                // Force resume to ensure context starts (critical for Safari/iOS)
                if (audioEngine.audioContext) {
                    console.log('[Audio] Calling resume on audio context...');
                    await audioEngine.audioContext.resume();

                    // Give Safari/iOS time to actually start the context
                    let retries = 0;
                    while (audioEngine.audioContext.state !== 'running' && retries < 5) {
                        console.log(`[Audio] Waiting for running state... (attempt ${retries + 1}, current: ${audioEngine.audioContext.state})`);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await audioEngine.audioContext.resume();
                        retries++;
                    }

                    console.log('[Audio] Final audio context state:', audioEngine.audioContext.state);
                }

                // Only proceed if we have a running context
                if (audioEngine.audioContext.state === 'running') {
                    console.log('[Audio] ✓ Audio context is running, playing test sound...');

                    // Play test sound to "unlock" audio
                    audioEngine.playInstrumentByName('sparkle', undefined, 0.5);

                    audioInitialized = true;

                    // Give the test sound a moment to actually play
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Hide overlay if visible
                    if (startOverlay && !startOverlay.classList.contains('hidden')) {
                        startOverlay.classList.add('hidden');
                        console.log('[UI] Overlay hidden');
                    }

                    // Start playback
                    console.log('[Playback] Starting playback engine...');
                    playbackEngine.start();
                    console.log('[Playback] ✓ Playback started');

                    return true; // Success
                } else {
                    console.error('[Audio] ✗ Audio context failed to start, state:', audioEngine.audioContext.state);
                    return false; // Failed
                }
            } catch (error) {
                console.error('[Audio] Error initializing audio:', error);
                return false; // Failed
            }
        } else if (audioEngine.audioContext && audioEngine.audioContext.state === 'suspended') {
            // If already initialized but suspended, just resume
            console.log('[Audio] Audio was suspended, resuming...');
            try {
                await audioEngine.audioContext.resume();
                console.log('[Audio] Resumed, state:', audioEngine.audioContext.state);

                // Start playback if not playing
                if (!playbackEngine.isPlaying && audioEngine.audioContext.state === 'running') {
                    console.log('[Playback] Starting playback after resume...');
                    playbackEngine.start();
                }
                return true;
            } catch (error) {
                console.error('[Audio] Error resuming audio:', error);
                return false;
            }
        } else if (!playbackEngine.isPlaying && audioEngine.audioContext && audioEngine.audioContext.state === 'running') {
            // Already initialized and running, just start playback if needed
            console.log('[Playback] Audio already running, starting playback...');
            playbackEngine.start();
            return true;
        }
        return true;
    }

    // Start button handler
    if (startButton) {
        startButton.addEventListener('click', async () => {
            startButton.disabled = true;
            await initAudio();
        });
    }

    // Op desktop: automatisch bij eerste interactie
    if (!isTouchDevice) {
        console.log('[UI] Desktop detected, auto-init on first click');
        const autoInit = async () => {
            await initAudio();
        };
        document.addEventListener('click', autoInit, { once: true });
        canvasEngine.canvas.addEventListener('mousedown', autoInit, { once: true });
    }

    // Resume audio if page becomes visible again (iOS background handling)
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && audioInitialized && audioEngine.audioContext) {
            if (audioEngine.audioContext.state === 'suspended') {
                console.log('[Audio] Page visible again, resuming audio...');
                try {
                    await audioEngine.audioContext.resume();
                    if (!playbackEngine.isPlaying) {
                        playbackEngine.start();
                    }
                } catch (error) {
                    console.error('[Audio] Resume error:', error);
                }
            }
        }
    });

    // Initialize color palette
    const colorPalette = document.getElementById('colorPalette');
    const colors = soundMapper.getColors();

    colors.forEach((color, index) => {
        const btn = document.createElement('button');
        btn.className = 'color-btn';
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        if (index === 0) btn.classList.add('active');

        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            canvasEngine.setColor(color);
        });

        colorPalette.appendChild(btn);
    });

    // Set initial color
    canvasEngine.setColor(colors[0]);

    // Brush size controls
    const brushSizes = [3, 5, 8, 12, 18, 25, 35, 50];
    let currentBrushIndex = 3; // Start at size 12

    const brushSmaller = document.getElementById('brushSmaller');
    const brushLarger = document.getElementById('brushLarger');

    function updateBrushSize() {
        canvasEngine.setBrushSize(brushSizes[currentBrushIndex]);
        brushSmaller.disabled = currentBrushIndex === 0;
        brushLarger.disabled = currentBrushIndex === brushSizes.length - 1;
    }

    brushSmaller.addEventListener('click', () => {
        if (currentBrushIndex > 0) {
            currentBrushIndex--;
            updateBrushSize();
        }
    });

    brushLarger.addEventListener('click', () => {
        if (currentBrushIndex < brushSizes.length - 1) {
            currentBrushIndex++;
            updateBrushSize();
        }
    });

    updateBrushSize();

    // Undo button
    const undoBtn = document.getElementById('undoBtn');
    undoBtn.addEventListener('click', () => {
        canvasEngine.undo();
        updateUndoButton();
    });

    function updateUndoButton() {
        undoBtn.disabled = canvasEngine.strokes.length === 0;
    }
    updateUndoButton();

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', () => {
        canvasEngine.clear();
        updateUndoButton();
    });

    // Update undo button and play sounds when drawing
    canvasEngine.setDrawCallback((drawParams) => {
        updateUndoButton();

        // Play sound while drawing
        if (drawParams && audioInitialized && audioEngine.audioContext && audioEngine.audioContext.state === 'running') {
            soundMapper.mapToSound(drawParams);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            canvasEngine.undo();
            updateUndoButton();
        }

        // [ for smaller brush
        if (e.key === '[') {
            e.preventDefault();
            brushSmaller.click();
        }

        // ] for larger brush
        if (e.key === ']') {
            e.preventDefault();
            brushLarger.click();
        }

        // Number keys 1-9 for colors (0 = 10th color)
        if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            const colorBtn = colorPalette.children[index];
            if (colorBtn) colorBtn.click();
        }
        if (e.key === '0') {
            const colorBtn = colorPalette.children[9];
            if (colorBtn) colorBtn.click();
        }
    });
});
