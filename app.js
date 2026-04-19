/**
 * Power Rail Drafter Logic
 * Handles 2D Context, Input Sanitization, and Secure PDF Generation.
 */

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
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Bind input events for live updates
        this.inputs.length.addEventListener('input', () => this.render());
        this.inputs.holes.addEventListener('input', () => this.render());
        
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        
        this.render();
    }

    resizeCanvas() {
        // High-DPI screen support to prevent blurry canvas lines
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width - 40; 
        this.canvas.height = rect.height - 100;
        this.render();
    }

    /**
     * SECURITY: Sanitize numeric inputs to prevent injection or logic crashes
     * @param {string|number} val 
     * @param {number} max 
     */
    sanitizeNumeric(val, max) {
        let parsed = parseInt(val, 10);
        if (isNaN(parsed) || parsed < 0) return 0;
        if (parsed > max) return max;
        return parsed;
    }

    /**
     * SECURITY: Strip basic HTML tags from notes to prevent XSS if data is ever reused
     */
    sanitizeString(str) {
        return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    render() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const holes = this.sanitizeNumeric(this.inputs.holes.value, 20);
        
        this.labels.distance.textContent = `${lengthMm} mm`;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        // Clear workspace
        ctx.clearRect(0, 0, width, height);

        // Drawing Constants
        const paddingX = 40;
        const drawWidth = width - (paddingX * 2);
        const railHeight = 40;
        const startY = height / 2 - railHeight / 2;

        // Scale factor: pixels per mm based on max length
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
        ctx.fillStyle = '#95a5a6'; // Rail color
        ctx.fillRect(paddingX, startY, currentDrawWidth, railHeight);

        // Draw Support Posts (Every 2000mm)
        ctx.fillStyle = '#f39c12'; // Post color
        for (let pos = 0; pos <= lengthMm; pos += POST_INTERVAL_MM) {
            const postX = paddingX + (pos * scale);
            // Post visual
            ctx.fillRect(postX - 5, startY - 10, 10, railHeight + 20);
            
            // Post text
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText(`${pos}mm`, postX - 15, startY - 15);
            ctx.fillStyle = '#f39c12'; 
        }

        // Draw Holes
        if (holes > 0 && lengthMm > 0) {
            ctx.fillStyle = '#1e1e24'; // Match bg to look like a hole
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
    }

    exportPDF() {
        // Utilize jsPDF from window object
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
        // Split text to handle line breaks securely within PDF constraints
        const splitNotes = doc.splitTextToSize(notes, 250);
        doc.text(splitNotes, 15, 75);

        // Capture Canvas and append to PDF
        const canvasData = this.canvas.toDataURL("image/png", 1.0);
        doc.addImage(canvasData, 'PNG', 15, 120, 250, 60);

        // Force download
        doc.save(`Rail_WorkOrder_${length}mm_${Date.now()}.pdf`);
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    new RailDrafter();
});
