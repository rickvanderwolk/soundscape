class CanvasEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Canvas settings
        this.setupCanvas();

        // Drawing state
        this.isDrawing = false;
        this.currentColor = '#FF6B6B';
        this.currentBrushSize = 10;
        this.currentTool = 'draw'; // 'draw' or 'eraser'

        // Stroke history for undo
        this.strokes = [];
        this.currentStroke = null;

        // Event tracking for sound
        this.lastDrawTime = 0;
        this.drawSpeed = 0;
        this.onDrawCallback = null;

        // Setup event listeners
        this.setupEventListeners();
    }

    setupCanvas() {
        // Set canvas to full screen
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Set default styles
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Fill background with current theme color
        this.fillBackground();
    }

    fillBackground() {
        // Get background color from CSS variable
        const bgColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-color').trim();

        // Fill canvas background
        this.ctx.save();
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });

        // Resize handler
        window.addEventListener('resize', () => {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.setupCanvas();
            this.ctx.putImageData(imageData, 0, 0);
        });
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        // Ensure coordinates are within bounds
        return {
            x: Math.max(0, Math.min(x, this.canvas.width)),
            y: Math.max(0, Math.min(y, this.canvas.height))
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCoordinates(e);

        // Start new stroke
        this.currentStroke = {
            tool: this.currentTool,
            color: this.currentColor,
            size: this.currentBrushSize,
            points: [coords]
        };

        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);

        // Set style based on tool
        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
        }
        this.ctx.lineWidth = this.currentBrushSize;

        this.lastDrawTime = Date.now();
    }

    draw(e) {
        if (!this.isDrawing) return;

        const coords = this.getCoordinates(e);
        this.currentStroke.points.push(coords);

        // Calculate draw speed (pixels per millisecond)
        const now = Date.now();
        const timeDelta = now - this.lastDrawTime;
        if (timeDelta > 0 && this.currentStroke.points.length > 1) {
            const prevPoint = this.currentStroke.points[this.currentStroke.points.length - 2];
            const distance = Math.sqrt(
                Math.pow(coords.x - prevPoint.x, 2) +
                Math.pow(coords.y - prevPoint.y, 2)
            );
            this.drawSpeed = distance / timeDelta;
        }
        this.lastDrawTime = now;

        // Draw line to new point
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();

        // Trigger sound callback if drawing (not erasing)
        if (this.currentTool === 'draw' && this.onDrawCallback) {
            this.onDrawCallback({
                x: coords.x,
                y: coords.y,
                color: this.currentColor,
                size: this.currentBrushSize,
                speed: this.drawSpeed,
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height
            });
        }
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        this.isDrawing = false;
        this.ctx.closePath();

        // Save stroke to history
        if (this.currentStroke && this.currentStroke.points.length > 0) {
            this.strokes.push(this.currentStroke);
            this.currentStroke = null;
        }

        // Reset composite operation
        this.ctx.globalCompositeOperation = 'source-over';
        this.drawSpeed = 0;
    }

    setColor(color) {
        this.currentColor = color;
    }

    setBrushSize(size) {
        this.currentBrushSize = size;
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    undo() {
        if (this.strokes.length === 0) return;

        // Remove last stroke
        this.strokes.pop();

        // Redraw everything
        this.redraw();
    }

    clear() {
        this.fillBackground();
        this.strokes = [];
    }

    redraw() {
        // Clear canvas and fill with background
        this.fillBackground();

        // Redraw all strokes
        this.strokes.forEach(stroke => {
            if (stroke.points.length === 0) return;

            this.ctx.beginPath();
            this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

            if (stroke.tool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
            } else {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = stroke.color;
            }
            this.ctx.lineWidth = stroke.size;

            for (let i = 1; i < stroke.points.length; i++) {
                this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }

            this.ctx.stroke();
            this.ctx.closePath();
        });

        // Reset composite operation
        this.ctx.globalCompositeOperation = 'source-over';
    }

    getImageData() {
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    setDrawCallback(callback) {
        this.onDrawCallback = callback;
    }
}
