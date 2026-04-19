const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_LENGTH_MM = 9998;
const POST_INTERVAL_MM = 2000;

// Dual Rail Architecture Constants
const RAIL_HEIGHT = 40;
const RAIL_GAP = 60; // Space between pos and neg rails
const POST_WIDTH = 60;
const POST_HEIGHT = (RAIL_HEIGHT * 2) + RAIL_GAP + 40; // Overhangs rails by 20px on top/bottom

class RailDrafterSVG {
    constructor() {
        this.svg = document.getElementById('draftWorkspace');
        
        this.inputs = {
            length: document.getElementById('railLength'),
            holes: document.getElementById('holeCount'),
            specs: document.getElementById('specs')
        };
        this.labels = { distance: document.getElementById('live-distance') };
        
        // Native SVG Camera State
        this.camera = { x: 0, y: 0, width: 1000, height: 1000 };
        this.drag = { active: false, startX: 0, startY: 0, startCamX: 0, startCamY: 0 };
        
        this.init();
    }

    init() {
        this.resizeWorkspace();
        window.addEventListener('resize', () => this.resizeWorkspace());
        
        this.inputs.length.addEventListener('input', () => this.render());
        this.inputs.holes.addEventListener('input', () => this.render());
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(0.8));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(1.2));
        document.getElementById('btn-recenter').addEventListener('click', () => this.recenterCamera());

        this.bindCameraEvents();
        this.render();
    }

    // --- SECURITY: Secure DOM Node Builder ---
    // Prevents XSS by strictly using element creation rather than innerHTML strings
    createNode(tag, attributes) {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attributes)) {
            el.setAttribute(key, value);
        }
        return el;
    }

    bindCameraEvents() {
        this.svg.addEventListener('pointerdown', (e) => {
            this.drag.active = true;
            this.drag.startX = e.clientX;
            this.drag.startY = e.clientY;
            this.drag.startCamX = this.camera.x;
            this.drag.startCamY = this.camera.y;
            this.svg.setPointerCapture(e.pointerId);
        });

        this.svg.addEventListener('pointermove', (e) => {
            if (!this.drag.active) return;
            
            // Calculate physical pixel to SVG unit ratio
            const rect = this.svg.getBoundingClientRect();
            const ratioX = this.camera.width / rect.width;
            const ratioY = this.camera.height / rect.height;

            const dx = (e.clientX - this.drag.startX) * ratioX;
            const dy = (e.clientY - this.drag.startY) * ratioY;

            // Invert dx/dy to drag the camera opposite to pointer movement
            this.camera.x = this.drag.startCamX - dx;
            this.camera.y = this.drag.startCamY - dy;
            this.applyCamera();
        });

        const endDrag = (e) => {
            this.drag.active = false;
            if (e.pointerId) this.svg.releasePointerCapture(e.pointerId);
        };

        this.svg.addEventListener('pointerup', endDrag);
        this.svg.addEventListener('pointercancel', endDrag);

        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1.1 : 0.9;
            this.adjustZoom(factor);
        }, { passive: false });
    }

    applyCamera() {
        // Native SVG hardware-accelerated manipulation
        this.svg.setAttribute('viewBox', `${this.camera.x} ${this.camera.y} ${this.camera.width} ${this.camera.height}`);
    }

    adjustZoom(factor) {
        const newWidth = this.camera.width * factor;
        const newHeight = this.camera.height * factor;
        
        // Offset X and Y to zoom into the center of the current view
        this.camera.x -= (newWidth - this.camera.width) / 2;
        this.camera.y -= (newHeight - this.camera.height) / 2;
        
        this.camera.width = newWidth;
        this.camera.height = newHeight;
        this.applyCamera();
    }

    recenterCamera() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        // Add 200mm padding to framing
        this.camera.width = lengthMm + 400; 
        this.camera.height = this.camera.width * (this.svg.clientHeight / this.svg.clientWidth);
        this.camera.x = -200;
        this.camera.y = -(this.camera.height / 2) + 100;
        this.applyCamera();
    }

    resizeWorkspace() {
        this.recenterCamera();
    }

    sanitizeNumeric(val, max) {
        let parsed = parseInt(val, 10);
        return (isNaN(parsed) || parsed < 0) ? 0 : Math.min(parsed, max);
    }

    render() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const holes = this.sanitizeNumeric(this.inputs.holes.value, 40);
        this.labels.distance.textContent = `${lengthMm} mm`;

        // Clear existing DOM securely
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }

        const topRailY = 0;
        const bottomRailY = topRailY + RAIL_HEIGHT + RAIL_GAP;

        // 1. Draw FR4 Insulator Posts (Back Layer)
        for (let pos = 0; pos <= lengthMm; pos += POST_INTERVAL_MM) {
            const postGroup = this.createNode('g', {});
            
            // FR4 Base Block
            const fr4 = this.createNode('rect', {
                x: pos - (POST_WIDTH / 2),
                y: topRailY - 20,
                width: POST_WIDTH,
                height: POST_HEIGHT,
                fill: '#5d6d7e', rx: 5
            });
            
            // Mounting Bolt Details
            const bolt1 = this.createNode('circle', { cx: pos, cy: topRailY - 10, r: 4, fill: '#bdc3c7' });
            const bolt2 = this.createNode('circle', { cx: pos, cy: bottomRailY + RAIL_HEIGHT + 10, r: 4, fill: '#bdc3c7' });

            postGroup.appendChild(fr4);
            postGroup.appendChild(bolt1);
            postGroup.appendChild(bolt2);
            this.svg.appendChild(postGroup);
        }

        // 2. Draw Positive Rail (Top)
        const posRail = this.createNode('rect', {
            x: 0, y: topRailY, width: lengthMm, height: RAIL_HEIGHT,
            fill: '#bdc3c7', stroke: '#e74c3c', 'stroke-width': 2 // Red outline for Positive
        });
        
        // 3. Draw Negative Rail (Bottom)
        const negRail = this.createNode('rect', {
            x: 0, y: bottomRailY, width: lengthMm, height: RAIL_HEIGHT,
            fill: '#bdc3c7', stroke: '#3498db', 'stroke-width': 2 // Blue outline for Negative
        });

        this.svg.appendChild(posRail);
        this.svg.appendChild(negRail);

        // 4. Draw Drill Holes
        if (holes > 0 && lengthMm > 0) {
            const spacing = lengthMm / (holes + 1);
            for (let i = 1; i <= holes; i++) {
                const holeX = spacing * i;
                // Top Rail Hole
                this.svg.appendChild(this.createNode('circle', {
                    cx: holeX, cy: topRailY + (RAIL_HEIGHT/2), r: 5, fill: '#1e1e24'
                }));
                // Bottom Rail Hole
                this.svg.appendChild(this.createNode('circle', {
                    cx: holeX, cy: bottomRailY + (RAIL_HEIGHT/2), r: 5, fill: '#1e1e24'
                }));
            }
        }
        
        // 5. Draw Dimension Line
        const dimGroup = this.createNode('g', { stroke: '#ff6b6b', 'stroke-width': 2 });
        dimGroup.appendChild(this.createNode('line', { x1: 0, y1: bottomRailY + 100, x2: lengthMm, y2: bottomRailY + 100 }));
        dimGroup.appendChild(this.createNode('line', { x1: 0, y1: bottomRailY + 80, x2: 0, y2: bottomRailY + 120 }));
        dimGroup.appendChild(this.createNode('line', { x1: lengthMm, y1: bottomRailY + 80, x2: lengthMm, y2: bottomRailY + 120 }));
        
        const dimText = this.createNode('text', {
            x: lengthMm / 2, y: bottomRailY + 90, fill: '#ff6b6b', 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '24px', stroke: 'none'
        });
        dimText.textContent = `${lengthMm} mm Total Drop`;
        dimGroup.appendChild(dimText);

        this.svg.appendChild(dimGroup);
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const length = this.inputs.length.value;
        const notes = this.inputs.specs.value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        doc.setFontSize(18);
        doc.text("Dual-Bus Power Rail - Work Order", 15, 20);
        doc.setFontSize(12);
        doc.text(`Target Length: ${length} mm`, 15, 30);
        doc.text(`Total Drill Holes: ${this.inputs.holes.value * 2} (${this.inputs.holes.value} per rail)`, 15, 40);
        doc.text(`FR4 Insulator Posts Evaluated: ${Math.floor(length / POST_INTERVAL_MM) + 1}`, 15, 50);
        doc.text("Engineering Notes:", 15, 65);
        doc.text(doc.splitTextToSize(notes, 250), 15, 75);

        // --- SVG TO PDF ARCHITECTURE ---
        // 1. Temporarily reframe the viewBox to exactly fit the content, regardless of user zoom
        const originalViewBox = this.svg.getAttribute('viewBox');
        this.svg.setAttribute('viewBox', `-50 -50 ${parseInt(length) + 100} ${POST_HEIGHT + 150}`);

        // 2. Serialize SVG DOM to string
        const svgData = new XMLSerializer().serializeToString(this.svg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        // 3. Load into an Image object to rasterize it safely without external APIs
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            // Fill background so the PDF doesn't have a transparent/black box
            ctx.fillStyle = '#2a2a35';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            const pngData = canvas.toDataURL('image/png');
            doc.addImage(pngData, 'PNG', 15, 120, 250, (canvas.height * 250) / canvas.width);
            doc.save(`DualRail_WO_${length}mm_${Date.now()}.pdf`);
            
            // Restore user's camera view and cleanup
            this.svg.setAttribute('viewBox', originalViewBox);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RailDrafterSVG();
});
