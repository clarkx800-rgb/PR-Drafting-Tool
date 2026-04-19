const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_LENGTH_MM = 9998;
const VISUAL_POST_INTERVAL_MM = 2000; 

// Architectural Constants
const RAIL_HEIGHT = 30;
const RAIL_GAP = 90; 
const POST_WIDTH = 60;
const POST_HEIGHT = (RAIL_HEIGHT * 2) + RAIL_GAP + 40; 

// STL Component Constants
const CONNECTOR_LENGTH = 715;
const CONNECTOR_LUGS = 5;

class RailDrafterSVG {
    constructor() {
        this.svg = document.getElementById('draftWorkspace');
        
        this.inputs = {
            length: document.getElementById('railLength'),
            holes: document.getElementById('holeCount'),
            connectorOffset: document.getElementById('connectorOffset'),
            specs: document.getElementById('specs')
        };
        this.labels = { distance: document.getElementById('live-distance') };
        
        this.camera = { x: 0, y: 0, width: 1000, height: 1000 };
        this.drag = { active: false, startX: 0, startY: 0, startCamX: 0, startCamY: 0 };
        
        this.init();
    }

    init() {
        this.resizeWorkspace();
        window.addEventListener('resize', () => this.resizeWorkspace());
        
        this.inputs.length.addEventListener('input', () => this.render());
        this.inputs.holes.addEventListener('input', () => this.render());
        this.inputs.connectorOffset.addEventListener('input', () => this.render()); // Trigger render on offset change
        
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(0.8));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(1.2));
        document.getElementById('btn-recenter').addEventListener('click', () => this.recenterCamera());

        this.bindCameraEvents();
        this.render();
    }

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
            const rect = this.svg.getBoundingClientRect();
            const dx = (e.clientX - this.drag.startX) * (this.camera.width / rect.width);
            const dy = (e.clientY - this.drag.startY) * (this.camera.height / rect.height);
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
            this.adjustZoom(e.deltaY > 0 ? 1.1 : 0.9);
        }, { passive: false });
    }

    applyCamera() {
        this.svg.setAttribute('viewBox', `${this.camera.x} ${this.camera.y} ${this.camera.width} ${this.camera.height}`);
    }

    adjustZoom(factor) {
        const newWidth = this.camera.width * factor;
        const newHeight = this.camera.height * factor;
        this.camera.x -= (newWidth - this.camera.width) / 2;
        this.camera.y -= (newHeight - this.camera.height) / 2;
        this.camera.width = newWidth;
        this.camera.height = newHeight;
        this.applyCamera();
    }

    recenterCamera() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        this.camera.width = lengthMm + 400; 
        this.camera.height = this.camera.width * (this.svg.clientHeight / this.svg.clientWidth);
        this.camera.x = -200;
        this.camera.y = -(this.camera.height / 2) + 100;
        this.applyCamera();
    }

    resizeWorkspace() { this.recenterCamera(); }

    sanitizeNumeric(val, max) {
        let parsed = parseInt(val, 10);
        return (isNaN(parsed) || parsed < 0) ? 0 : Math.min(parsed, max);
    }

    render() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const holes = this.sanitizeNumeric(this.inputs.holes.value, 40);
        const connectorOffset = parseInt(this.inputs.connectorOffset.value, 10);
        
        this.labels.distance.textContent = `${lengthMm} mm`;

        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

        const topRailY = 0;
        const bottomRailY = topRailY + RAIL_HEIGHT + RAIL_GAP;

        // --- 1. Draw FR4 Posts ---
        let postPositions = [];
        if (lengthMm >= 0) {
            postPositions.push(0); 
            for (let pos = VISUAL_POST_INTERVAL_MM; pos < lengthMm; pos += VISUAL_POST_INTERVAL_MM) {
                postPositions.push(pos);
            }
            if (lengthMm > 0) postPositions.push(lengthMm); 
        }

        postPositions.forEach((pos, index) => {
            const isStructural = (index === 0 || index === postPositions.length - 1);
            const postGroup = this.createNode('g', {});
            
            const fr4 = this.createNode('rect', {
                x: pos - (POST_WIDTH / 2), y: topRailY - 20,
                width: POST_WIDTH, height: POST_HEIGHT,
                fill: '#5d6d7e', rx: 5,
                opacity: isStructural ? "1.0" : "0.3" 
            });
            
            const bolt1 = this.createNode('circle', { cx: pos, cy: topRailY - 10, r: 4, fill: '#bdc3c7', opacity: isStructural ? "1.0" : "0.3" });
            const bolt2 = this.createNode('circle', { cx: pos, cy: bottomRailY + RAIL_HEIGHT + 10, r: 4, fill: '#bdc3c7', opacity: isStructural ? "1.0" : "0.3" });

            postGroup.appendChild(fr4);
            postGroup.appendChild(bolt1);
            postGroup.appendChild(bolt2);

            if (isStructural) {
                const text = this.createNode('text', {
                    x: pos, y: topRailY - 30, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '16px'
                });
                text.textContent = `ABS: ${pos}mm`;
                postGroup.appendChild(text);
            }

            this.svg.appendChild(postGroup);
        });

        // --- 2. Draw Main Power Rails ---
        this.svg.appendChild(this.createNode('rect', {
            x: 0, y: topRailY, width: lengthMm, height: RAIL_HEIGHT,
            fill: '#bdc3c7', stroke: '#e74c3c', 'stroke-width': 2 
        }));
        
        this.svg.appendChild(this.createNode('rect', {
            x: 0, y: bottomRailY, width: lengthMm, height: RAIL_HEIGHT,
            fill: '#bdc3c7', stroke: '#3498db', 'stroke-width': 2 
        }));

        // --- 3. Draw 5-Lug Connector (If Offset Provided) ---
        if (!isNaN(connectorOffset) && connectorOffset >= 0) {
            const connGroup = this.createNode('g', {});
            
            // Draw connector plates on both rails. Made slightly taller (+10px) to indicate an overlay plate.
            connGroup.appendChild(this.createNode('rect', {
                x: connectorOffset, y: topRailY - 5, width: CONNECTOR_LENGTH, height: RAIL_HEIGHT + 10,
                fill: '#7f8c8d', stroke: '#e74c3c', 'stroke-width': 2, opacity: '0.85', rx: 4
            }));
            connGroup.appendChild(this.createNode('rect', {
                x: connectorOffset, y: bottomRailY - 5, width: CONNECTOR_LENGTH, height: RAIL_HEIGHT + 10,
                fill: '#7f8c8d', stroke: '#3498db', 'stroke-width': 2, opacity: '0.85', rx: 4
            }));

            // Calculate even distribution for 5 lugs across 715mm
            const lugSpacing = CONNECTOR_LENGTH / (CONNECTOR_LUGS + 1);
            for (let i = 1; i <= CONNECTOR_LUGS; i++) {
                const lugX = connectorOffset + (lugSpacing * i);
                // Top Connector Holes
                connGroup.appendChild(this.createNode('circle', { cx: lugX, cy: topRailY + (RAIL_HEIGHT/2), r: 6, fill: '#1e1e24', stroke: '#ff6b6b', 'stroke-width': 1 }));
                // Bottom Connector Holes
                connGroup.appendChild(this.createNode('circle', { cx: lugX, cy: bottomRailY + (RAIL_HEIGHT/2), r: 6, fill: '#1e1e24', stroke: '#ff6b6b', 'stroke-width': 1 }));
            }
            
            // Connector Dimension Label
            const connText = this.createNode('text', {
                x: connectorOffset + (CONNECTOR_LENGTH/2), y: topRailY - 15, fill: '#f1c40f', 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '14px'
            });
            connText.textContent = `5-Lug Plate (715mm) @ ${connectorOffset}mm`;
            connGroup.appendChild(connText);

            this.svg.appendChild(connGroup);
        }

        // --- 4. Draw Custom Standard Holes ---
        if (holes > 0 && lengthMm > 0) {
            const spacing = lengthMm / (holes + 1);
            for (let i = 1; i <= holes; i++) {
                const holeX = spacing * i;
                this.svg.appendChild(this.createNode('circle', { cx: holeX, cy: topRailY + (RAIL_HEIGHT/2), r: 5, fill: '#1e1e24' }));
                this.svg.appendChild(this.createNode('circle', { cx: holeX, cy: bottomRailY + (RAIL_HEIGHT/2), r: 5, fill: '#1e1e24' }));
            }
        }
        
        // --- 5. Draw Total Dimension Line ---
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
        const connectorOffset = parseInt(this.inputs.connectorOffset.value, 10);
        const notes = this.inputs.specs.value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        doc.setFontSize(18);
        doc.text("Dual-Bus Power Rail - Work Order", 15, 20);
        doc.setFontSize(12);
        doc.text(`Target Length: ${length} mm`, 15, 30);
        doc.text(`Custom Drill Holes: ${this.inputs.holes.value * 2} (${this.inputs.holes.value} per rail)`, 15, 40);
        doc.text(`Structural FR4 Anchors Evaluated: 2 (Absolute 0mm & ${length}mm)`, 15, 50);
        
        // Add Splice/Connector details to the manifest
        if (!isNaN(connectorOffset) && connectorOffset >= 0) {
            doc.text(`Hardware: 5-Lug Splice Connector (715mm)`, 15, 60);
            doc.text(`Connector Drill Coordinates: Initiated at ${connectorOffset}mm from Anchor 0`, 15, 70);
            doc.text("Engineering Notes:", 15, 85);
            doc.text(doc.splitTextToSize(notes, 250), 15, 95);
        } else {
            doc.text("Engineering Notes:", 15, 65);
            doc.text(doc.splitTextToSize(notes, 250), 15, 75);
        }

        const originalViewBox = this.svg.getAttribute('viewBox');
        this.svg.setAttribute('viewBox', `-50 -50 ${parseInt(length) + 100} ${POST_HEIGHT + 150}`);

        const svgData = new XMLSerializer().serializeToString(this.svg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#2a2a35';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            const pngData = canvas.toDataURL('image/png');
            doc.addImage(pngData, 'PNG', 15, 120, 250, (canvas.height * 250) / canvas.width);
            doc.save(`DualRail_WO_${length}mm_${Date.now()}.pdf`);
            
            this.svg.setAttribute('viewBox', originalViewBox);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RailDrafterSVG();
});