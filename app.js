const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_LENGTH_MM = 9998;
const VISUAL_POST_INTERVAL_MM = 2000; 

// Architectural Constants
const RAIL_HEIGHT = 30;
const RAIL_GAP = 90; 
const POST_WIDTH = 60;
const POST_HEIGHT = (RAIL_HEIGHT * 2) + RAIL_GAP + 40; 
const CONNECTOR_LENGTH = 715;
const CONNECTOR_LUGS = 5;

class RailDrafterSVG {
    constructor() {
        this.svg = document.getElementById('draftWorkspace');
        
        // Dynamic Input Matrix
        this.inputs = {
            length: document.getElementById('railLength'),
            holes: document.getElementById('holeCount'),
            posOffset: document.getElementById('posOffset'),
            negOffset: document.getElementById('negOffset'),
            postOffsetVal: document.getElementById('postOffsetVal'),
            postOffsetRef: document.getElementById('postOffsetRef'),
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
        
        // Bind all inputs to trigger live render
        Object.values(this.inputs).forEach(input => {
            if(input.tagName === 'INPUT' || input.tagName === 'SELECT') {
                input.addEventListener('input', () => this.render());
            }
        });
        
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(0.8));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(1.2));
        document.getElementById('btn-recenter').addEventListener('click', () => this.recenterCamera());

        this.bindCameraEvents();
        this.render();
    }

    createNode(tag, attributes) {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attributes)) { el.setAttribute(key, value); }
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

    applyCamera() { this.svg.setAttribute('viewBox', `${this.camera.x} ${this.camera.y} ${this.camera.width} ${this.camera.height}`); }

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

    // Handles optional inputs (blanks) securely
    getOptionalNumeric(val) {
        let parsed = parseInt(val, 10);
        return isNaN(parsed) ? null : parsed;
    }

    // CAD-Style Dimensioning Tool
    drawDimension(x1, y, x2, labelText, color) {
        const dimGroup = this.createNode('g', { stroke: color, 'stroke-width': 2 });
        // Main Line
        dimGroup.appendChild(this.createNode('line', { x1: x1, y1: y, x2: x2, y2: y }));
        // Edge Tick Marks
        dimGroup.appendChild(this.createNode('line', { x1: x1, y1: y - 10, x2: x1, y2: y + 10 }));
        dimGroup.appendChild(this.createNode('line', { x1: x2, y1: y - 10, x2: x2, y2: y + 10 }));
        // Text
        const dimText = this.createNode('text', {
            x: x1 + ((x2 - x1) / 2), y: y - 10, fill: color, 
            'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': '18px', stroke: 'none'
        });
        dimText.textContent = labelText;
        dimGroup.appendChild(dimText);
        return dimGroup;
    }

    render() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const holes = this.sanitizeNumeric(this.inputs.holes.value, 40);
        
        const posOffset = this.getOptionalNumeric(this.inputs.posOffset.value);
        const negOffset = this.getOptionalNumeric(this.inputs.negOffset.value);
        
        const postOffsetVal = this.sanitizeNumeric(this.inputs.postOffsetVal.value, MAX_LENGTH_MM);
        const postOffsetRef = this.inputs.postOffsetRef.value; // 'left' or 'right'

        this.labels.distance.textContent = `${lengthMm} mm`;

        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

        const topRailY = 0;
        const bottomRailY = topRailY + RAIL_HEIGHT + RAIL_GAP;

        // --- 1. Bidirectional Post Propagation Math ---
        let postPositions = [];
        if (lengthMm >= 0) {
            // Clamp starting offset to not exceed total rail length
            let clampedOffset = Math.min(postOffsetVal, lengthMm);
            
            if (postOffsetRef === 'right') {
                // Propagate from right to left
                for (let pos = lengthMm - clampedOffset; pos >= 0; pos -= VISUAL_POST_INTERVAL_MM) {
                    postPositions.unshift(pos); // Unshift maintains left-to-right drawing order
                }
            } else {
                // Propagate from left to right
                for (let pos = clampedOffset; pos <= lengthMm; pos += VISUAL_POST_INTERVAL_MM) {
                    postPositions.push(pos);
                }
            }
        }

        // --- 2. Draw FR4 Posts ---
        postPositions.forEach((pos, index) => {
            const isStructural = (index === 0 || index === postPositions.length - 1);
            const postGroup = this.createNode('g', {});
            
            const fr4 = this.createNode('rect', {
                x: pos - (POST_WIDTH / 2), y: topRailY - 20, width: POST_WIDTH, height: POST_HEIGHT,
                fill: '#5d6d7e', rx: 5, opacity: isStructural ? "1.0" : "0.3" 
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
                text.textContent = `ANCHOR: ${pos}mm`;
                postGroup.appendChild(text);
            }
            this.svg.appendChild(postGroup);
        });

        // --- 3. Draw Main Power Rails ---
        this.svg.appendChild(this.createNode('rect', {
            x: 0, y: topRailY, width: lengthMm, height: RAIL_HEIGHT, fill: '#bdc3c7', stroke: '#e74c3c', 'stroke-width': 2 
        }));
        this.svg.appendChild(this.createNode('rect', {
            x: 0, y: bottomRailY, width: lengthMm, height: RAIL_HEIGHT, fill: '#bdc3c7', stroke: '#3498db', 'stroke-width': 2 
        }));

        // --- 4. Draw 5-Lug Connectors (Independent Rails) ---
        const drawConnector = (railOffset, baseRailY, railColor, dimYOffset) => {
            if (railOffset !== null && railOffset >= 0) {
                const connGroup = this.createNode('g', {});
                // Plate Body
                connGroup.appendChild(this.createNode('rect', {
                    x: railOffset, y: baseRailY - 5, width: CONNECTOR_LENGTH, height: RAIL_HEIGHT + 10,
                    fill: '#7f8c8d', stroke: railColor, 'stroke-width': 2, opacity: '0.85', rx: 4
                }));
                // Drill Distribution
                const lugSpacing = CONNECTOR_LENGTH / (CONNECTOR_LUGS + 1);
                for (let i = 1; i <= CONNECTOR_LUGS; i++) {
                    const lugX = railOffset + (lugSpacing * i);
                    connGroup.appendChild(this.createNode('circle', { 
                        cx: lugX, cy: baseRailY + (RAIL_HEIGHT/2), r: 6, fill: '#1e1e24', stroke: '#f1c40f', 'stroke-width': 1 
                    }));
                }
                // Offset Dimension Indicator
                this.svg.appendChild(this.drawDimension(0, baseRailY + dimYOffset, railOffset, `${railOffset}mm Offset`, railColor));
                this.svg.appendChild(connGroup);
            }
        };

        // Draw Pos Connector (Dim line placed 40px ABOVE rail)
        drawConnector(posOffset, topRailY, '#e74c3c', -40);
        // Draw Neg Connector (Dim line placed 70px BELOW rail)
        drawConnector(negOffset, bottomRailY, '#3498db', RAIL_HEIGHT + 40);


        // --- 5. Draw Custom Standard Holes ---
        if (holes > 0 && lengthMm > 0) {
            const spacing = lengthMm / (holes + 1);
            for (let i = 1; i <= holes; i++) {
                const holeX = spacing * i;
                this.svg.appendChild(this.createNode('circle', { cx: holeX, cy: topRailY + (RAIL_HEIGHT/2), r: 5, fill: '#1e1e24' }));
                this.svg.appendChild(this.createNode('circle', { cx: holeX, cy: bottomRailY + (RAIL_HEIGHT/2), r: 5, fill: '#1e1e24' }));
            }
        }
        
        // --- 6. Draw Total Length Dimension ---
        this.svg.appendChild(this.drawDimension(0, bottomRailY + RAIL_HEIGHT + 90, lengthMm, `${lengthMm} mm Total Drop`, '#ff6b6b'));
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const length = this.inputs.length.value;
        const posOffset = this.getOptionalNumeric(this.inputs.posOffset.value);
        const negOffset = this.getOptionalNumeric(this.inputs.negOffset.value);
        const postOffsetVal = this.inputs.postOffsetVal.value;
        const postOffsetRef = this.inputs.postOffsetRef.value === 'left' ? "Left (0mm)" : "Right (Rail End)";
        const notes = this.inputs.specs.value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        doc.setFontSize(18);
        doc.text("Dual-Bus Power Rail - Work Order", 15, 20);
        
        doc.setFontSize(11);
        doc.text(`Target Length: ${length} mm`, 15, 30);
        doc.text(`Custom Drill Holes: ${this.inputs.holes.value * 2} (${this.inputs.holes.value} per rail)`, 15, 38);
        
        // Dynamic Anchor Logging
        doc.text(`Anchor Configuration: Initiated ${postOffsetVal}mm from ${postOffsetRef} Tip`, 15, 46);

        // Hardware Manifest Logging
        let yPointer = 58;
        doc.setFontSize(12);
        doc.text("Hardware Manifest:", 15, yPointer);
        doc.setFontSize(11);
        
        if (posOffset !== null) {
            yPointer += 8;
            doc.text(`[POS] 5-Lug Splice (715mm) - Offset: ${posOffset}mm from 0`, 20, yPointer);
        }
        if (negOffset !== null) {
            yPointer += 8;
            doc.text(`[NEG] 5-Lug Splice (715mm) - Offset: ${negOffset}mm from 0`, 20, yPointer);
        }
        if (posOffset === null && negOffset === null) {
            yPointer += 8;
            doc.text(`No Splice Connectors Required.`, 20, yPointer);
        }

        yPointer += 15;
        doc.setFontSize(12);
        doc.text("Engineering Notes:", 15, yPointer);
        doc.setFontSize(10);
        doc.text(doc.splitTextToSize(notes, 250), 15, yPointer + 8);

        // SVG Capture Logic
        const originalViewBox = this.svg.getAttribute('viewBox');
        this.svg.setAttribute('viewBox', `-50 -100 ${parseInt(length) + 100} ${POST_HEIGHT + 250}`);

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
            doc.addImage(pngData, 'PNG', 15, yPointer + 25, 250, (canvas.height * 250) / canvas.width);
            doc.save(`DualRail_WO_${length}mm_${Date.now()}.pdf`);
            
            this.svg.setAttribute('viewBox', originalViewBox);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
}

document.addEventListener('DOMContentLoaded', () => { new RailDrafterSVG(); });