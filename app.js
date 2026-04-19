const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_LENGTH_MM = 9998;
const VISUAL_POST_INTERVAL_MM = 2000; 

// SCALED Architectural Constants (4x)
const RAIL_HEIGHT = 120; // 30 * 4
const RAIL_GAP = 360;    // 90 * 4
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
        this.renderAndRecenter();
    }

    bindGestureEngine() {
        let tsX = 0, tsY = 0;
        window.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; }, {passive:true});
        window.addEventListener('touchend', e => {
            let dx = e.changedTouches[0].clientX - tsX;
            let dy = e.changedTouches[0].clientY - tsY;
            if (window.innerWidth > window.innerHeight) {
                if (Math.abs(dx) > 70 && tsX > window.innerWidth - 80) this.toggleDrawer(dx < 0);
            } else {
                if (Math.abs(dy) > 70 && tsY > window.innerHeight - 80) this.toggleDrawer(dy < 0);
            }
        }, {passive:true});
    }

    toggleDrawer(isOpen) {
        this.isDrawerOpen = isOpen;
        this.ui.drawer.classList.toggle('open', isOpen);
        this.ui.overlay.classList.toggle('active', isOpen);
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

    applyCamera() { this.svg.setAttribute('viewBox', `${this.camera.x} ${this.camera.y} ${this.camera.width} ${this.camera.height}`); }

    adjustZoom(f) {
        const nw = this.camera.width * f; const nh = this.camera.height * f;
        this.camera.x -= (nw - this.camera.width)/2; this.camera.y -= (nh - this.camera.height)/2;
        this.camera.width = nw; this.camera.height = nh; this.applyCamera();
    }

    renderAndRecenter() { this.render(); this.recenterCamera(); }

    recenterCamera() {
        const pad = (this.boundingBox.maxX - this.boundingBox.minX) * 0.15;
        this.camera.width = (this.boundingBox.maxX - this.boundingBox.minX) + (pad * 2);
        this.camera.height = this.camera.width * (this.svg.clientHeight / this.svg.clientWidth);
        this.camera.x = this.boundingBox.minX - pad;
        this.camera.y = this.boundingBox.minY - ((this.camera.height - (this.boundingBox.maxY - this.boundingBox.minY))/2);
        this.applyCamera();
    }

    resizeWorkspace() { this.recenterCamera(); }

    drawDim(x1, y, x2, txt, color, uiScale) {
        const g = this.createNode('g', { stroke: color, 'stroke-width': 3 * uiScale });
        g.appendChild(this.createNode('line', { x1, y1: y, x2, y2: y }));
        g.appendChild(this.createNode('line', { x1, y1: y-20*uiScale, x2: x1, y2: y+20*uiScale }));
        g.appendChild(this.createNode('line', { x1: x2, y1: y-20*uiScale, x2: x2, y2: y+20*uiScale }));
        const t = this.createNode('text', { x: x1+(x2-x1)/2, y: y-15*uiScale, fill: color, 'text-anchor': 'middle', 'font-size': `${24*uiScale}px`, stroke: 'none', 'font-family': 'monospace' });
        t.textContent = txt; g.appendChild(t); return g;
    }

    render() {
        const pLen = parseInt(this.inputs.posLength.value) || 0;
        const nLen = parseInt(this.inputs.negLength.value) || 0;
        const maxLen = Math.max(pLen, nLen);
        const uiScale = Math.max(1.5, maxLen / 800);

        while(this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

        const topY = 0; const botY = topY + RAIL_HEIGHT + RAIL_GAP;
        this.boundingBox = { minX: 0, maxX: maxLen, minY: -200 * uiScale, maxY: botY + 400 * uiScale };

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
                const t = this.createNode('text', { x: p, y: topY-60*uiScale, fill: '#fff', 'text-anchor': 'middle', 'font-size': `${18*uiScale}px` });
                t.textContent = `${p}mm`; g.appendChild(t);
            }
            this.svg.appendChild(g);
        });

        // 2. Rails
        this.svg.appendChild(this.createNode('rect', { x: 0, y: topY, width: pLen, height: RAIL_HEIGHT, fill: '#bdc3c7', stroke: '#e74c3c', 'stroke-width': 4 }));
        this.svg.appendChild(this.createNode('rect', { x: 0, y: botY, width: nLen, height: RAIL_HEIGHT, fill: '#bdc3c7', stroke: '#3498db', 'stroke-width': 4 }));

        // 3. Connectors & Staggered Dimensions
        const drawConn = (off, y, color, side) => {
            if (isNaN(off) || off < 0) return;
            const g = this.createNode('g', { opacity: 0.9 });
            g.appendChild(this.createNode('rect', { x: off, y: y-10, width: CONNECTOR_LENGTH, height: RAIL_HEIGHT+20, fill: '#777', stroke: color, 'stroke-width': 3, rx: 5 }));
            const step = CONNECTOR_LENGTH / 6;
            for(let i=1; i<=5; i++) g.appendChild(this.createNode('circle', { cx: off + step*i, cy: y+RAIL_HEIGHT/2, r: 10*uiScale, fill: '#111' }));
            this.svg.appendChild(g);
            this.svg.appendChild(this.drawDim(0, y + (side === 'top' ? -100*uiScale : RAIL_HEIGHT+100*uiScale), off, `${off}mm Offset`, color, uiScale));
        };

        drawConn(parseInt(this.inputs.posOffset.value), topY, '#e74c3c', 'top');
        drawConn(parseInt(this.inputs.negOffset.value), botY, '#3498db', 'bot');

        // 4. Absolute Rail Dimensions (Staggered)
        this.svg.appendChild(this.drawDim(0, topY + RAIL_HEIGHT/2, pLen, `POS: ${pLen}mm`, '#e74c3c', uiScale * 0.8));
        this.svg.appendChild(this.drawDim(0, botY + RAIL_HEIGHT/2, nLen, `NEG: ${nLen}mm`, '#3498db', uiScale * 0.8));
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'l', format: 'letter' });
        doc.text("Asymmetric Power Rail Work Order", 15, 20);
        doc.text(`POS Rail: ${this.inputs.posLength.value}mm | NEG Rail: ${this.inputs.negLength.value}mm`, 15, 30);
        
        const vb = this.svg.getAttribute('viewBox');
        const svgData = new XMLSerializer().serializeToString(this.svg);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width * 2; canvas.height = img.height * 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#2a2a35'; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 50, 250, 120);
            doc.save(`Rail_WO_${Date.now()}.pdf`);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
}
new RailDrafterSVG();