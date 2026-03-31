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
        startOverlay.style.display = 'flex';
    }

    // Initialize audio on first user interaction
    async function initAudio() {
        if (!audioInitialized) {
            try {
                audioEngine.init();

                // Force resume to ensure context starts (critical for Safari/iOS)
                if (audioEngine.audioContext) {
                    await audioEngine.audioContext.resume();

                    let retries = 0;
                    while (audioEngine.audioContext.state !== 'running' && retries < 5) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await audioEngine.audioContext.resume();
                        retries++;
                    }
                }

                if (audioEngine.audioContext.state === 'running') {
                    audioEngine.playInstrumentByName('sparkle', undefined, 0.5);

                    audioInitialized = true;

                    await new Promise(resolve => setTimeout(resolve, 100));

                    if (startOverlay && !startOverlay.classList.contains('hidden')) {
                        startOverlay.classList.add('hidden');
                    }

                    playbackEngine.start();

                    return true;
                } else {
                    return false;
                }
            } catch (error) {
                console.error('[Audio] Error initializing audio:', error);
                return false;
            }
        } else if (audioEngine.audioContext && audioEngine.audioContext.state === 'suspended') {
            try {
                await audioEngine.audioContext.resume();

                if (!playbackEngine.isPlaying && audioEngine.audioContext.state === 'running') {
                    playbackEngine.start();
                }
                return true;
            } catch (error) {
                console.error('[Audio] Error resuming audio:', error);
                return false;
            }
        } else if (!playbackEngine.isPlaying && audioEngine.audioContext && audioEngine.audioContext.state === 'running') {
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
