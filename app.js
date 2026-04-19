const MAX_LENGTH_MM = 9998;
const POST_INTERVAL_MM = 2000;

// Camera Security/Stability Bounds
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5.0;
const MAX_PAN = 3000;

class RailDrafter {
    constructor() {
        this.canvas = document.getElementById('draftCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.inputs = {
            length: document.getElementById('railLength'),
            holes: document.getElementById('holeCount'),
            specs: document.getElementById('specs')
        };
        this.labels = { distance: document.getElementById('live-distance') };
        
        // 2D Camera State
        this.camera = { panX: 0, panY: 0, zoom: 1.0 };
        this.drag = { active: false, startX: 0, startY: 0 };
        this.renderPending = false; 
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Data Inputs
        this.inputs.length.addEventListener('input', () => this.queueRender());
        this.inputs.holes.addEventListener('input', () => this.queueRender());
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        
        // UI Camera Controls
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(1.2));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(0.8));
        document.getElementById('btn-recenter').addEventListener('click', () => this.recenterCamera());

        this.bindPointerEvents();
        this.queueRender();
    }

    bindPointerEvents() {
        // Panning (Touch & Mouse)
        this.canvas.addEventListener('pointerdown', (e) => {
            this.drag.active = true;
            this.drag.startX = e.clientX - this.camera.panX;
            this.drag.startY = e.clientY - this.camera.panY;
            this.canvas.style.cursor = 'grabbing';
            this.canvas.setPointerCapture(e.pointerId); 
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.drag.active) return;
            
            const nextPanX = e.clientX - this.drag.startX;
            const nextPanY = e.clientY - this.drag.startY;
            
            // Clamp pan to prevent losing drawing
            this.camera.panX = Math.max(-MAX_PAN, Math.min(nextPanX, MAX_PAN));
            this.camera.panY = Math.max(-MAX_PAN, Math.min(nextPanY, MAX_PAN));
            this.queueRender();
        });

        const endDrag = (e) => {
            this.drag.active = false;
            this.canvas.style.cursor = 'default';
            if (e.pointerId) this.canvas.releasePointerCapture(e.pointerId);
        };

        this.canvas.addEventListener('pointerup', endDrag);
        this.canvas.addEventListener('pointercancel', endDrag);
        this.canvas.addEventListener('pointerout', endDrag);

        // Mouse Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault(); // Prevent page scroll while over canvas
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            this.adjustZoom(zoomFactor);
        }, { passive: false }); // Requires passive: false to allow e.preventDefault()
    }

    adjustZoom(factor) {
        let newZoom = this.camera.zoom * factor;
        // Clamp zoom to prevent memory/rendering crashes
        this.camera.zoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
        this.queueRender();
    }

    recenterCamera() {
        this.camera = { panX: 0, panY: 0, zoom: 1.0 };
        this.queueRender();
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width - 40; 
        this.canvas.height = rect.height - 100;
        this.recenterCamera();
    }

    sanitizeNumeric(val, max) {
        let parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed < 0) return 0;
        if (parsed > max) return max;
        return parsed;
    }

    sanitizeString(str) {
        return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    queueRender() {
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => this.render());
        }
    }

    render() {
        this.renderPending = false;

        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const holes = this.sanitizeNumeric(this.inputs.holes.value, 20);
        this.labels.distance.textContent = `${lengthMm} mm`;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        // Reset Transform to identity matrix for absolute clearing
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, width, height);

        // --- CAMERA TRANSFORMATION MATRIX ---
        ctx.save();
        
        // 1. Apply user panning
        ctx.translate(this.camera.panX, this.camera.panY);
        
        // 2. Translate origin to center of canvas
        ctx.translate(width / 2, height / 2);
        
        // 3. Apply Zoom scale
        ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // 4. Translate back to top-left to resume standard drawing logic
        ctx.translate(-width / 2, -height / 2);

        // --- DRAWING LOGIC ---
        const paddingX = 40;
        const drawWidth = width - (paddingX * 2);
        const railHeight = 40;
        const startY = height / 2 - railHeight / 2;
        const scale = drawWidth / MAX_LENGTH_MM;
        const currentDrawWidth = lengthMm * scale;

        // Center Line
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#555';
        ctx.moveTo(paddingX, height / 2);
        ctx.lineTo(paddingX + drawWidth, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rail Body
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(paddingX, startY, currentDrawWidth, railHeight);

        // Support Posts
        ctx.fillStyle = '#f39c12';
        for (let pos = 0; pos <= lengthMm; pos += POST_INTERVAL_MM) {
            const postX = paddingX + (pos * scale);
            ctx.fillRect(postX - 5, startY - 10, 10, railHeight + 20);
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText(`${pos}mm`, postX - 15, startY - 15);
            ctx.fillStyle = '#f39c12'; 
        }

        // Drill Holes
        if (holes > 0 && lengthMm > 0) {
            ctx.fillStyle = '#1e1e24';
            const spacing = currentDrawWidth / (holes + 1);
            for (let i = 1; i <= holes; i++) {
                const holeX = paddingX + (spacing * i);
                ctx.beginPath();
                ctx.arc(holeX, height / 2, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Dimension Line
        ctx.strokeStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(paddingX, startY + railHeight + 30);
        ctx.lineTo(paddingX + currentDrawWidth, startY + railHeight + 30);
        ctx.stroke();

        ctx.restore(); // Revert transformation matrix
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const length = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const notes = this.sanitizeString(this.inputs.specs.value);

        doc.setFontSize(18);
        doc.text("Power Rail - Cutting & Preparation Work Order", 15, 20);
        doc.setFontSize(12);
        doc.text(`Target Length: ${length} mm`, 15, 30);
        doc.text(`Required Drill Holes: ${this.inputs.holes.value}`, 15, 40);
        doc.text(`Support Posts Evaluated: ${Math.floor(length / POST_INTERVAL_MM) + 1}`, 15, 50);
        doc.text("Engineering Notes:", 15, 65);
        
        const splitNotes = doc.splitTextToSize(notes, 250);
        doc.text(splitNotes, 15, 75);

        // SECURITY & QA: Snapshot must be perfectly framed.
        // Cache the user's current camera state, force a recenter, render, capture, and restore.
        const cachedCamera = { ...this.camera };
        this.camera = { panX: 0, panY: 0, zoom: 1.0 };
        this.render(); 
        
        const canvasData = this.canvas.toDataURL("image/png", 1.0);
        doc.addImage(canvasData, 'PNG', 15, 120, 250, 60);
        
        this.camera = cachedCamera; 
        this.render();      

        doc.save(`Rail_WorkOrder_${length}mm_${Date.now()}.pdf`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RailDrafter();
});
