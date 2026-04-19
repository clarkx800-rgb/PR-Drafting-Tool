const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_LENGTH_MM = 9998;
const VISUAL_POST_INTERVAL_MM = 2000; 

// Architectural Geometry Constants
const RAIL_HEIGHT = 30;
const RAIL_GAP = 90; 
const POST_WIDTH = 60;
const POST_HEIGHT = (RAIL_HEIGHT * 2) + RAIL_GAP + 40; 
const CONNECTOR_LENGTH = 715;
const CONNECTOR_LUGS = 5;

class RailDrafterSVG {
    constructor() {
        this.svg = document.getElementById('draftWorkspace');
        
        // Drawer UI Nodes
        this.ui = {
            drawer: document.getElementById('configDrawer'),
            overlay: document.getElementById('drawerOverlay'),
            openBtn: document.getElementById('openMenuBtn'),
            closeBtn: document.getElementById('closeMenuBtn'),
            pullTab: document.getElementById('pullTab')
        };

        // Data Inputs (Custom Holes Purged)
        this.inputs = {
            length: document.getElementById('railLength'),
            posOffset: document.getElementById('posOffset'),
            negOffset: document.getElementById('negOffset'),
            postOffsetVal: document.getElementById('postOffsetVal'),
            postOffsetRef: document.getElementById('postOffsetRef'),
            specs: document.getElementById('specs')
        };
        this.labels = { distance: document.getElementById('live-distance') };
        
        this.camera = { x: 0, y: 0, width: 1000, height: 1000 };
        this.drag = { active: false, startX: 0, startY: 0, startCamX: 0, startCamY: 0 };
        this.boundingBox = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
        this.isDrawerOpen = false;

        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.resizeWorkspace());
        
        // UI Bindings
        this.ui.openBtn.addEventListener('click', () => this.toggleDrawer(true));
        this.ui.closeBtn.addEventListener('click', () => this.toggleDrawer(false));
        this.ui.overlay.addEventListener('click', () => this.toggleDrawer(false)); 
        this.ui.pullTab.addEventListener('click', () => this.toggleDrawer(!this.isDrawerOpen));

        // Input Data Bindings
        Object.values(this.inputs).forEach(input => {
            if(input.tagName === 'INPUT' || input.tagName === 'SELECT') {
                input.addEventListener('input', () => this.renderAndRecenter());
            }
        });
        
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            this.exportPDF();
            this.toggleDrawer(false); 
        });
        
        // Camera Bindings
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(0.8));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(1.2));
        document.getElementById('btn-recenter').addEventListener('click', () => this.recenterCamera());

        this.bindCameraEvents();
        this.bindGestureEngine();
        this.renderAndRecenter();
    }

    // Dynamic Edge-Swipe Engine
    bindGestureEngine() {
        let touchStartX = 0, touchStartY = 0;
        const SWIPE_THRESHOLD = 60; 

        window.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('touchend', e => {
            if(!touchStartX || !touchStartY) return;
            let endX = e.changedTouches[0].clientX;
            let endY = e.changedTouches[0].clientY;
            
            // Detect aspect ratio to determine gesture axis
            const isLandscape = window.innerWidth > window.innerHeight;
            
            if (!this.isDrawerOpen) {
                if (isLandscape) {
                    // Swipe left from right edge
                    if (touchStartX > window.innerWidth - 60 && (touchStartX - endX) > SWIPE_THRESHOLD) {
                        this.toggleDrawer(true);
                    }
                } else {
                    // Swipe up from bottom edge
                    if (touchStartY > window.innerHeight - 60 && (touchStartY - endY) > SWIPE_THRESHOLD) {
                        this.toggleDrawer(true);
                    }
                }
            } else {
                // Swipe to close
                if (isLandscape && (endX - touchStartX) > SWIPE_THRESHOLD) {
                    this.toggleDrawer(false);
                } else if (!isLandscape && (endY - touchStartY) > SWIPE_THRESHOLD) {
                    this.toggleDrawer(false);
                }
            }
            touchStartX = 0; touchStartY = 0;
        }, { passive: true });
    }

    toggleDrawer(isOpen) {
        this.isDrawerOpen = isOpen;
        if (isOpen) {
            this.ui.drawer.classList.add('open');
            this.ui.overlay.classList.add('active');
        } else {
            this.ui.drawer.classList.remove('open');
            this.ui.overlay.classList.remove('active');
        }
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

    renderAndRecenter() {
        this.render();
        this.recenterCamera();
    }

    recenterCamera() {
        const padX = (this.boundingBox.maxX - this.boundingBox.minX) * 0.1;
        this.camera.width = (this.boundingBox.maxX - this.boundingBox.minX) + (padX * 2);
        
        // Auto-scale aspect ratio detection
        const aspect = this.svg.clientHeight / this.svg.clientWidth;
        this.camera.height = this.camera.width * aspect;
        
        this.camera.x = this.boundingBox.minX - padX;
        this.camera.y = this.boundingBox.minY - ((this.camera.height - (this.boundingBox.maxY - this.boundingBox.minY)) / 2);
        this.applyCamera();
    }

    resizeWorkspace() { this.recenterCamera(); }

    sanitizeNumeric(val, max) {
        let parsed = parseInt(val, 10);
        return (isNaN(parsed) || parsed < 0) ? 0 : Math.min(parsed, max);
    }

    getOptionalNumeric(val) {
        let parsed = parseInt(val, 10);
        return isNaN(parsed) ? null : parsed;
    }

    drawDimension(x1, y, x2, labelText, color, uiScale) {
        const dimGroup = this.createNode('g', { stroke: color, 'stroke-width': 2 * uiScale });
        const tickHeight = 15 * uiScale;
        const fontSize = 18 * uiScale;

        dimGroup.appendChild(this.createNode('line', { x1: x1, y1: y, x2: x2, y2: y }));
        dimGroup.appendChild(this.createNode('line', { x1: x1, y1: y - tickHeight, x2: x1, y2: y + tickHeight }));
        dimGroup.appendChild(this.createNode('line', { x1: x2, y1: y - tickHeight, x2: x2, y2: y + tickHeight }));
        
        const dimText = this.createNode('text', {
            x: x1 + ((x2 - x1) / 2), y: y - (tickHeight * 0.8), fill: color, 
            'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': `${fontSize}px`, stroke: 'none'
        });
        dimText.textContent = labelText;
        dimGroup.appendChild(dimText);
        return dimGroup;
    }

    render() {
        const lengthMm = this.sanitizeNumeric(this.inputs.length.value, MAX_LENGTH_MM);
        const posOffset = this.getOptionalNumeric(this.inputs.posOffset.value);
        const negOffset = this.getOptionalNumeric(this.inputs.negOffset.value);
        const postOffsetVal = this.sanitizeNumeric(this.inputs.postOffsetVal.value, MAX_LENGTH_MM);
        const postOffsetRef = this.inputs.postOffsetRef.value;

        this.labels.distance.textContent = `${lengthMm} mm`;
        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

        const uiScale = Math.max(1, lengthMm / 1000); 
        const topRailY = 0;
        const bottomRailY = topRailY + RAIL_HEIGHT + RAIL_GAP;

        this.boundingBox = { minX: 0, maxX: lengthMm, minY: topRailY - (80 * uiScale), maxY: bottomRailY + (120 * uiScale) };

        let postPositions = [];
        if (lengthMm >= 0) {
            let clampedOffset = Math.min(postOffsetVal, lengthMm);
            if (postOffsetRef === 'right') {
                for (let pos = lengthMm - clampedOffset; pos >= 0; pos -= VISUAL_POST_INTERVAL_MM) { postPositions.unshift(pos); }
            } else {
                for (let pos = clampedOffset; pos <= lengthMm; pos += VISUAL_POST_INTERVAL_MM) { postPositions.push(pos); }
            }
        }

        postPositions.forEach((pos, index) => {
            const isStructural = (index === 0 || index === postPositions.length - 1);
            const postGroup = this.createNode('g', {});
            
            postGroup.appendChild(this.createNode('rect', {
                x: pos - (POST_WIDTH / 2), y: topRailY - 20, width: POST_WIDTH, height: POST_HEIGHT,
                fill: '#5d6d7e', rx: 5, opacity: isStructural ? "1.0" : "0.3" 
            }));
            
            if (isStructural) {
                const text = this.createNode('text', {
                    x: pos, y: topRailY - (40 * uiScale), fill: '#fff', 
                    'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': `${16 * uiScale}px`
                });
                text.textContent = `ANCHOR: ${pos}mm`;
                postGroup.appendChild(text);
            }
            this.svg.appendChild(postGroup);
        });

        this.svg.appendChild(this.createNode('rect', {
            x: 0, y: topRailY, width: lengthMm, height: RAIL_HEIGHT, fill: '#bdc3c7', stroke: '#e74c3c', 'stroke-width': 2 * uiScale 
        }));
        this.svg.appendChild(this.createNode('rect', {
            x: 0, y: bottomRailY, width: lengthMm, height: RAIL_HEIGHT, fill: '#bdc3c7', stroke: '#3498db', 'stroke-width': 2 * uiScale 
        }));

        const drawConnector = (railOffset, baseRailY, railColor, dimYOffset) => {
            if (railOffset !== null && railOffset >= 0) {
                const connGroup = this.createNode('g', {});
                connGroup.appendChild(this.createNode('rect', {
                    x: railOffset, y: baseRailY - 5, width: CONNECTOR_LENGTH, height: RAIL_HEIGHT + 10,
                    fill: '#7f8c8d', stroke: railColor, 'stroke-width': 2 * uiScale, opacity: '0.85', rx: 4
                }));
                const lugSpacing = CONNECTOR_LENGTH / (CONNECTOR_LUGS + 1);
                for (let i = 1; i <= CONNECTOR_LUGS; i++) {
                    const lugX = railOffset + (lugSpacing * i);
                    connGroup.appendChild(this.createNode('circle', { 
                        cx: lugX, cy: baseRailY + (RAIL_HEIGHT/2), r: 6 * (uiScale * 0.5), fill: '#1e1e24', stroke: '#f1c40f', 'stroke-width': 1 * uiScale 
                    }));
                }
                
                const actualYOffset = baseRailY + (dimYOffset * uiScale);
                if (actualYOffset < this.boundingBox.minY) this.boundingBox.minY = actualYOffset - (30 * uiScale);
                if (actualYOffset > this.boundingBox.maxY) this.boundingBox.maxY = actualYOffset + (30 * uiScale);

                this.svg.appendChild(this.drawDimension(0, actualYOffset, railOffset, `${railOffset}mm Offset`, railColor, uiScale));
                this.svg.appendChild(connGroup);
            }
        };

        drawConnector(posOffset, topRailY, '#e74c3c', -80);
        drawConnector(negOffset, bottomRailY, '#3498db', RAIL_HEIGHT + 80);

        const totalDimY = bottomRailY + RAIL_HEIGHT + (140 * uiScale);
        if (totalDimY > this.boundingBox.maxY) this.boundingBox.maxY = totalDimY + (30 * uiScale);
        this.svg.appendChild(this.drawDimension(0, totalDimY, lengthMm, `${lengthMm} mm Total Drop`, '#ff6b6b', uiScale));
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', format: 'letter' }); 
        
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
        // Custom holes text stripped entirely from document logic
        doc.text(`Anchor Configuration: Initiated ${postOffsetVal}mm from ${postOffsetRef} Tip`, 15, 38);

        let yPointer = 50;
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

        const originalViewBox = this.svg.getAttribute('viewBox');
        
        const padX = (this.boundingBox.maxX - this.boundingBox.minX) * 0.05;
        const padY = (this.boundingBox.maxY - this.boundingBox.minY) * 0.1;
        const pdfViewWidth = (this.boundingBox.maxX - this.boundingBox.minX) + (padX * 2);
        const pdfViewHeight = (this.boundingBox.maxY - this.boundingBox.minY) + (padY * 2);
        
        this.svg.setAttribute('viewBox', `${this.boundingBox.minX - padX} ${this.boundingBox.minY - padY} ${pdfViewWidth} ${pdfViewHeight}`);

        const svgData = new XMLSerializer().serializeToString(this.svg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width * 2; 
            canvas.height = img.height * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2); 
            ctx.fillStyle = '#2a2a35';
            ctx.fillRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0);
            
            const printableWidth = 249.4;
            const scaledHeight = (img.height * printableWidth) / img.width;
            
            const pngData = canvas.toDataURL('image/png', 1.0);
            doc.addImage(pngData, 'PNG', 15, yPointer + 25, printableWidth, scaledHeight);
            doc.save(`DualRail_WO_${length}mm_${Date.now()}.pdf`);
            
            this.svg.setAttribute('viewBox', originalViewBox);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }
}

document.addEventListener('DOMContentLoaded', () => { new RailDrafterSVG(); });