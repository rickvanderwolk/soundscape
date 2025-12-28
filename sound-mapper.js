class SoundMapper {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;

        // Define 12 colors and their corresponding ambient instruments
        this.colorInstrumentMap = [
            { color: '#7B68EE', name: 'Drone', instrument: 'drone' },
            { color: '#87CEEB', name: 'Shimmer', instrument: 'shimmer' },
            { color: '#DDA0DD', name: 'Pad', instrument: 'pad' },
            { color: '#F0E68C', name: 'Bell', instrument: 'bell' },
            { color: '#B0E0E6', name: 'Wind', instrument: 'wind' },
            { color: '#98D8C8', name: 'Rain', instrument: 'rain' },
            { color: '#4682B4', name: 'Ocean', instrument: 'ocean' },
            { color: '#FFD700', name: 'Sparkle', instrument: 'sparkle' },
            { color: '#FF69B4', name: 'Swoosh', instrument: 'swoosh' },
            { color: '#AFEEEE', name: 'Breath', instrument: 'breath' },
            { color: '#E6E6FA', name: 'Crystal', instrument: 'crystal' },
            { color: '#483D8B', name: 'Void', instrument: 'void' }
        ];

        // Track last trigger time per color to prevent spam
        this.lastTriggerTime = {};
        this.minTriggerInterval = 50; // milliseconds
    }

    getColors() {
        return this.colorInstrumentMap.map(item => item.color);
    }

    getInstrumentForColor(color) {
        const mapping = this.colorInstrumentMap.find(item => item.color === color);
        return mapping ? mapping.instrument : 'kick1';
    }

    getInstrumentName(color) {
        const mapping = this.colorInstrumentMap.find(item => item.color === color);
        return mapping ? mapping.name : 'Unknown';
    }

    getColorInstrumentMap() {
        return this.colorInstrumentMap;
    }

    /**
     * Map drawing parameters to sound parameters
     * @param {Object} params - Drawing parameters
     * @param {number} params.x - X coordinate (0 to canvasWidth)
     * @param {number} params.y - Y coordinate (0 to canvasHeight)
     * @param {string} params.color - Current color
     * @param {number} params.size - Brush size
     * @param {number} params.speed - Drawing speed
     * @param {number} params.canvasWidth - Canvas width
     * @param {number} params.canvasHeight - Canvas height
     */
    mapToSound(params) {
        const { x, y, color, size, speed, canvasWidth, canvasHeight } = params;

        // Get instrument from color
        const instrument = this.getInstrumentForColor(color);

        // Throttle triggers per color
        const now = Date.now();
        const lastTime = this.lastTriggerTime[color] || 0;
        if (now - lastTime < this.minTriggerInterval) {
            return null; // Skip this trigger
        }
        this.lastTriggerTime[color] = now;

        // Map Y position to volume (top = louder, bottom = quieter)
        // Invert Y so top is higher value
        const normalizedY = 1 - (y / canvasHeight);
        const baseVolume = 0.3 + (normalizedY * 0.4); // Range: 0.3 to 0.7

        // Map brush size to volume multiplier
        const sizeMultiplier = 0.7 + (size / 40); // Larger brush = louder
        const volume = Math.min(baseVolume * sizeMultiplier, 1.0);

        // Map speed to trigger frequency (faster drawing = more frequent triggers)
        // This is handled by the throttle mechanism, but we could use it for effects

        // Trigger the sound
        if (!this.audioEngine.audioContext) {
            console.warn('[SoundMapper] Audio context not initialized');
            return null;
        }

        // Log occasionally to verify sounds are playing
        if (Math.random() < 0.05) { // 5% of the time
            console.log(`[SoundMapper] 🎨 Drawing ${instrument} at (${Math.floor(x)}, ${Math.floor(y)}) vol:${volume.toFixed(2)}`);
        }

        this.audioEngine.playInstrumentByName(instrument, undefined, volume);

        return {
            instrument,
            volume,
            x,
            y
        };
    }

    /**
     * Map pixel data to sound for playback mode
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Uint8ClampedArray} pixelData - RGBA values
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    mapPixelToSound(x, y, pixelData, canvasWidth, canvasHeight) {
        // Extract RGB values
        const r = pixelData[0];
        const g = pixelData[1];
        const b = pixelData[2];
        const a = pixelData[3];

        // Skip if pixel is transparent (not drawn)
        if (a < 10) {
            return null;
        }

        // Skip if pixel is background color (white or dark)
        // Check for white background (light mode)
        if (r > 250 && g > 250 && b > 250) {
            return null;
        }
        // Check for dark background (dark mode)
        if (r < 20 && g < 20 && b < 20) {
            return null;
        }

        // Convert RGB to hex color
        const hexColor = '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('').toUpperCase();

        // Find closest matching color
        const closestColor = this.findClosestColor(hexColor);
        if (!closestColor) {
            return null;
        }

        const instrument = this.getInstrumentForColor(closestColor);

        // Map Y position to volume (inverted: top = louder)
        const normalizedY = 1 - (y / canvasHeight);
        const volume = 0.3 + (normalizedY * 0.5); // Range: 0.3 to 0.8

        // Always log when we find a colored pixel during playback
        console.log(`[SoundMapper] ✓ Found ${instrument} at (${x}, ${y}) RGBA: ${r} ${g} ${b} vol:${volume.toFixed(2)}`);


        return {
            instrument,
            volume,
            color: closestColor,
            x,
            y
        };
    }

    /**
     * Find the closest color from our palette to a given hex color
     */
    findClosestColor(hexColor) {
        const rgb = this.hexToRgb(hexColor);
        if (!rgb) return null;

        let closestColor = null;
        let minDistance = Infinity;

        this.colorInstrumentMap.forEach(item => {
            const paletteRgb = this.hexToRgb(item.color);
            if (!paletteRgb) return;

            // Calculate color distance (Euclidean distance in RGB space)
            const distance = Math.sqrt(
                Math.pow(rgb.r - paletteRgb.r, 2) +
                Math.pow(rgb.g - paletteRgb.g, 2) +
                Math.pow(rgb.b - paletteRgb.b, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestColor = item.color;
            }
        });

        return closestColor;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}
