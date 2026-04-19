const MAX_LENGTH_MM = 9998;
const POST_INTERVAL_MM = 2000;

class RailDrafter {
    constructor() {
        this.canvas = document.getElementById('draftCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.inputs = {
            length: document.getElementById('railLength'),
            holes: document.getElementById('holeCount'),
            specs: document.getElementById('specs')
        };
        this.labels = {
            distance: document.getElementById('live-distance')
        };
        
        // --- NEW: Panning State Architecture ---
        this.pan = { x: 0, y: 0 };
        this.drag = { active: false, startX: 0, startY: 0 };
        this.renderPending = false; // Flag for requestAnimationFrame throttling
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.inputs.length.addEventListener('input', () => this.queueRender());
        this.inputs.holes.addEventListener('input', () => this.queueRender());
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        
        this.bindPanningEvents();
        this.queueRender();
    }

    /**
     * Binds unified pointer events (handles both Mouse and Touch natively).
     * This avoids writing duplicate logic for touchstart vs mousedown.
     */
    bindPanningEvents() {
        // Use pointer events for cross-device support (iOS/Android/Windows Touch)
        this.canvas.addEventListener('pointerdown', (e) => {
            this.drag.active = true;
            this.drag.startX = e.clientX - this.pan.x;
            this.drag.startY = e.clientY - this.pan.y;
            this.canvas.style.cursor = 'grabbing';
            this.canvas.setPointerCapture(e.pointerId); // Prevent event loss if dragged off canvas
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.drag.active) return;
            
            // Calculate new pan coordinates
            const nextPanX = e.clientX - this.drag.startX;
            const nextPanY = e.clientY - this.drag.startY;
            
            // SECURITY/UX: Clamp the panning to prevent losing the asset in the void
            // Assuming max safe pan bounds based on maximum rail scaling
            const maxPan = 2000; 
            this.pan.x = Math.max(-maxPan, Math.min(nextPanX, maxPan));
            this.pan.y = Math.max(-maxPan, Math.min(nextPanY, maxPan));

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
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width - 40; 
        this.canvas.height = rect.height - 100;
        
        // Reset pan on resize to prevent getting stuck
        this.pan = { x: 0, y: 0 }; 
        this.queueRender();
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

    /**
     * PERFORMANCE: requestAnimationFrame throttle.
     * Prevents rendering more than 60fps during rapid pointer movements.
     */
    queueRender() {
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => this.render());
        }
    }

    render() {
        this.renderPending = false; // Reset throttle flag

        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const holes = this.sanitizeNumeric(this.inputs.holes.value, 20);
        
        this.labels.distance.textContent = `${lengthMm} mm`;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        // Clear absolute workspace (before translation)
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, width, height);

        // --- APPLY PANNING MATRIX ---
        ctx.save();
        ctx.translate(this.pan.x, this.pan.y);

        const paddingX = 40;
        const drawWidth = width - (paddingX * 2);
        const railHeight = 40;
        const startY = height / 2 - railHeight / 2;

        const scale = drawWidth / MAX_LENGTH_MM;
        const currentDrawWidth = lengthMm * scale;

        // Draw Center Line (Datum)
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#555';
        ctx.moveTo(paddingX, height / 2);
        ctx.lineTo(paddingX + drawWidth, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Rail Body
        ctx.fillStyle = '#95a5a6';
        ctx.fillRect(paddingX, startY, currentDrawWidth, railHeight);

        // Draw Support Posts
        ctx.fillStyle = '#f39c12';
        for (let pos = 0; pos <= lengthMm; pos += POST_INTERVAL_MM) {
            const postX = paddingX + (pos * scale);
            ctx.fillRect(postX - 5, startY - 10, 10, railHeight + 20);
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText(`${pos}mm`, postX - 15, startY - 15);
            ctx.fillStyle = '#f39c12'; 
        }

        // Draw Holes
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

        // Draw Dimension Line
        ctx.strokeStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(paddingX, startY + railHeight + 30);
        ctx.lineTo(paddingX + currentDrawWidth, startY + railHeight + 30);
        ctx.stroke();

        ctx.restore(); // Revert pan matrix to prevent cumulative translation
    }

    exportPDF() {
        // (Unchanged from previous code)
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

        // PDF Snapshot must ignore panning. 
        // We temporarily reset pan to capture the canvas perfectly centered.
        const tempPan = { ...this.pan };
        this.pan = { x: 0, y: 0 };
        this.render(); // Render un-panned version
        
        const canvasData = this.canvas.toDataURL("image/png", 1.0);
        doc.addImage(canvasData, 'PNG', 15, 120, 250, 60);
        
        this.pan = tempPan; // Restore user's pan
        this.render();      // Render panned version back to screen

        doc.save(`Rail_WorkOrder_${length}mm_${Date.now()}.pdf`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RailDrafter();
});
