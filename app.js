const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_LENGTH_MM = 9998;
const VISUAL_POST_INTERVAL_MM = 2000; 

// Scaled Architectural Constants (4x)
const RAIL_HEIGHT = 120; 
const RAIL_GAP = 360;    
const POST_WIDTH = 60;
const POST_HEIGHT = (RAIL_HEIGHT * 2) + RAIL_GAP + 80; 
const CONNECTOR_LENGTH = 715;
const CONNECTOR_LUGS = 5;

class RailDrafterSVG {
    constructor() {
        this.svg = document.getElementById('draftWorkspace');
        this.ui = {
            drawer: document.getElementById('configDrawer'),
            overlay: document.getElementById('drawerOverlay'),
            openBtn: document.getElementById('openMenuBtn'),
            closeBtn: document.getElementById('closeMenuBtn'),
            pullTab: document.getElementById('pullTab')
        };
        this.inputs = {
            posLength: document.getElementById('posLength'),
            negLength: document.getElementById('negLength'),
            posOffset: document.getElementById('posOffset'),
            negOffset: document.getElementById('negOffset'),
            postOffsetVal: document.getElementById('postOffsetVal'),
            postOffsetRef: document.getElementById('postOffsetRef'),
            specs: document.getElementById('specs')
        };
        
        this.camera = { x: 0, y: 0, width: 2000, height: 1000 };
        this.drag = { active: false, startX: 0, startY: 0, startCamX: 0, startCamY: 0 };
        this.boundingBox = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
        this.isDrawerOpen = false;

        this.init();
    }

    init() {
        // Handle race conditions with requestAnimationFrame
        requestAnimationFrame(() => {
            this.resizeWorkspace();
            this.renderAndRecenter();
        });

        window.addEventListener('resize', () => this.resizeWorkspace());
        
        this.ui.openBtn.addEventListener('click', () => this.toggleDrawer(true));
        this.ui.closeBtn.addEventListener('click', () => this.toggleDrawer(false));
        this.ui.overlay.addEventListener('click', () => this.toggleDrawer(false));
        this.ui.pullTab.addEventListener('click', () => this.toggleDrawer(!this.isDrawerOpen));

        Object.values(this.inputs).forEach(input => {
            input.addEventListener('input', () => this.renderAndRecenter());
        });

        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(0.8));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(1.2));
        document.getElementById('btn-recenter').addEventListener('click', () => this.recenterCamera());

        this.bindCameraEvents();
        this.bindGestureEngine();
    }

    toggleDrawer(isOpen) {
        this.isDrawerOpen = isOpen;
        this.ui.drawer.classList.toggle('open', isOpen);
        this.ui.overlay.classList.toggle('active', isOpen);
    }

    bindGestureEngine() {
        let tsX = 0, tsY = 0;
        window.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; }, {passive:true});
        window.addEventListener('touchend', e => {
            let dx = e.changedTouches[0].clientX - tsX;
            let dy = e.changedTouches[0].clientY - tsY;
            const isLandscape = window.innerWidth > window.innerHeight;
            if (isLandscape) {
                if (Math.abs(dx) > 70 && tsX > window.innerWidth - 80) this.toggleDrawer(dx < 0);
            } else {
                if (Math.abs(dy) > 70 && tsY > window.innerHeight - 80) this.toggleDrawer(dy < 0);
            }
        }, {passive:true});
    }

    createNode(tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        for (let k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }

    bindCameraEvents() {
        this.svg.addEventListener('pointerdown', e => {
            this.drag.active = true;
            this.drag.startX = e.clientX; this.drag.startY = e.clientY;
            this.drag.startCamX = this.camera.x; this.drag.startCamY = this.camera.y;
            this.svg.setPointerCapture(e.pointerId);
        });
        this.svg.addEventListener('pointermove', e => {
            if (!this.drag.active) return;
            const r = this.svg.getBoundingClientRect();
            this.camera.x = this.drag.startCamX - (e.clientX - this.drag.startX) * (this.camera.width / r.width);
            this.camera.y = this.drag.startCamY - (e.clientY - this.drag.startY) * (this.camera.height / r.height);
            this.applyCamera();
        });
        this.svg.addEventListener('pointerup', e => { this.drag.active = false; this.svg.releasePointerCapture(e.pointerId); });
        this.svg.addEventListener('wheel', e => { e.preventDefault(); this.adjustZoom(e.deltaY > 0 ? 1.1 : 0.9); }, {passive:false});
    }

    applyCamera() { 
        if (isNaN(this.camera.x) || isNaN(this.camera.width)) return;
        this.svg.setAttribute('viewBox', `${this.camera.x} ${this.camera.y} ${this.camera.width} ${this.camera.height}`); 
    }

    adjustZoom(f) {
        const nw = this.camera.width * f; const nh = this.camera.height * f;
        this.camera.x -= (nw - this.camera.width)/2; this.camera.y -= (nh - this.camera.height)/2;
        this.camera.width = nw; this.camera.height = nh; this.applyCamera();
    }

    renderAndRecenter() { this.render(); this.recenterCamera(); }

    recenterCamera() {
        const h = this.svg.clientHeight || 500;
        const w = this.svg.clientWidth || 1000;
        const pad = (this.boundingBox.maxX - this.boundingBox.minX) * 0.2;
        this.camera.width = Math.max(100, (this.boundingBox.maxX - this.boundingBox.minX) + (pad * 2));
        this.camera.height = this.camera.width * (h / w);
        this.camera.x = this.boundingBox.minX - pad;
        this.camera.y = this.boundingBox.minY - ((this.camera.height - (this.boundingBox.maxY - this.boundingBox.minY))/2);
        this.applyCamera();
    }

    resizeWorkspace() { this.recenterCamera(); }

    /**
     * CAD-Style Dimension Drawing
     * Places text centered above the dimension line.
     */
    drawDim(x1, y, x2, txt, color, uiScale, isOffset = false) {
        const g = this.createNode('g', { stroke: color, 'stroke-width': 3 * uiScale });
        const tickSize = 25 * uiScale;
        
        // Horizontal Line
        g.appendChild(this.createNode('line', { x1, y1: y, x2, y2: y }));
        // Vertical End Ticks
        g.appendChild(this.createNode('line', { x1, y1: y - tickSize/2, x2: x1, y2: y + tickSize/2 }));
        g.appendChild(this.createNode('line', { x1: x2, y1: y - tickSize/2, x2: x2, y2: y + tickSize/2 }));
        
        // Text Label
        const t = this.createNode('text', { 
            x: x1 + (x2 - x1) / 2, 
            y: y - 10 * uiScale, 
            fill: color, 
            'text-anchor': 'middle', 
            'font-size': `${26 * uiScale}px`, 
            'font-family': 'monospace', 
            stroke: 'none',
            'font-weight': 'bold'
        });
        t.textContent = txt;
        g.appendChild(t);
        return g;
    }

    render() {
        const pLen = parseInt(this.inputs.posLength.value) || 0;
        const nLen = parseInt(this.inputs.negLength.value) || 0;
        const maxLen = Math.max(pLen, nLen);
        const uiScale = Math.max(1.5, maxLen / 1200);

        while(this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

        const topY = 0; 
        const botY = topY + RAIL_HEIGHT + RAIL_GAP;
        
        // Establish expanded bounding box to accommodate external dimension lines
        this.boundingBox = { 
            minX: 0, 
            maxX: maxLen, 
            minY: topY - 300 * uiScale, 
            maxY: botY + RAIL_HEIGHT + 300 * uiScale 
        };

        // 1. Posts
        const postOff = parseInt(this.inputs.postOffsetVal.value) || 0;
        let posts = [];
        if (this.inputs.postOffsetRef.value === 'right') {
            for (let p = maxLen - postOff; p >= 0; p -= VISUAL_POST_INTERVAL_MM) posts.unshift(p);
        } else {
            for (let p = postOff; p <= maxLen; p += VISUAL_POST_INTERVAL_MM) posts.push(p);
        }

        posts.forEach((p, i) => {
            const isStruc = (i === 0 || i === posts.length - 1);
            const g = this.createNode('g', { opacity: isStruc ? 1 : 0.2 });
            g.appendChild(this.createNode('rect', { x: p-30, y: topY-40, width: 60, height: POST_HEIGHT, fill: '#555', rx: 5 }));
            if (isStruc) {
                const t = this.createNode('text', { x: p, y: topY-150*uiScale, fill: '#fff', 'text-anchor': 'middle', 'font-size': `${20*uiScale}px`, 'font-family': 'monospace' });
                t.textContent = `${p}mm`; g.appendChild(t);
            }
            this.svg.appendChild(g);
        });

        // 2. Rails
        this.svg.appendChild(this.createNode('rect', { x: 0, y: topY, width: pLen, height: RAIL_HEIGHT, fill: '#777', stroke: '#e74c3c', 'stroke-width': 4 }));
        this.svg.appendChild(this.createNode('rect', { x: 0, y: botY, width: nLen, height: RAIL_HEIGHT, fill: '#777', stroke: '#3498db', 'stroke-width': 4 }));

        // 3. Connectors & Off-Axis Offset Dimensions
        const drawConn = (off, y, color, side) => {
            if (isNaN(off) || off < 0) return;
            const g = this.createNode('g', { opacity: 1 });
            // Splice Plate
            g.appendChild(this.createNode('rect', { x: off, y: y-10, width: CONNECTOR_LENGTH, height: RAIL_HEIGHT+20, fill: '#999', stroke: color, 'stroke-width': 3, rx: 5 }));
            // Drill Holes
            const step = CONNECTOR_LENGTH / 6;
            for(let i=1; i<=5; i++) g.appendChild(this.createNode('circle', { cx: off + step*i, cy: y+RAIL_HEIGHT/2, r: 8*uiScale, fill: '#111' }));
            this.svg.appendChild(g);
            
            // External Offset Dimension
            const dimY = (side === 'top') ? topY - 200 * uiScale : botY + RAIL_HEIGHT + 200 * uiScale;
            this.svg.appendChild(this.drawDim(0, dimY, off, `${off}mm Offset`, color, uiScale));
        };

        drawConn(parseInt(this.inputs.posOffset.value), topY, '#e74c3c', 'top');
        drawConn(parseInt(this.inputs.negOffset.value), botY, '#3498db', 'bot');

        // 4. Absolute Rail Dimensions (Staggered & External)
        const pDimY = topY - 80 * uiScale;
        const nDimY = botY + RAIL_HEIGHT + 80 * uiScale;
        this.svg.appendChild(this.drawDim(0, pDimY, pLen, `POS: ${pLen}mm`, '#e74c3c', uiScale));
        this.svg.appendChild(this.drawDim(0, nDimY, nLen, `NEG: ${nLen}mm`, '#3498db', uiScale));
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'l', format: 'letter' });
        doc.setFontSize(16);
        doc.text("Asymmetric CAD Rail Draft - Letter Format", 15, 20);
        
        const originalViewBox = this.svg.getAttribute('viewBox');
        // Snapshot crop: focus on full bounding box
        this.svg.setAttribute('viewBox', `${this.boundingBox.minX} ${this.boundingBox.minY} ${this.boundingBox.maxX - this.boundingBox.minX} ${this.boundingBox.maxY - this.boundingBox.minY}`);

        const svgData = new XMLSerializer().serializeToString(this.svg);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 2400; canvas.height = 1200; // High-res capture
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#2a2a35'; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 40, 250, 140);
            doc.save(`Rail_CAD_WO_${Date.now()}.pdf`);
            this.svg.setAttribute('viewBox', originalViewBox);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
}
new RailDrafterSVG();