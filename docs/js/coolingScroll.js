const SOURCES = [
"cooling_stage_images/v1.jpg",
"cooling_stage_images/v2.jpg",
"cooling_stage_images/v3.jpg",
"cooling_stage_images/v4.jpg",
"cooling_stage_images/v5.jpg",
"cooling_stage_images/v6.jpg",
];

// Vertical crop anchor within the "cover" crop:
// 0   = align to top (show top of the image)
// 0.5 = centered
// 1   = align to bottom (show bottom of the image)
const Y_ANCHOR = 0.23;
document.documentElement.style.setProperty("--ypos", `${Y_ANCHOR * 100}%`);

// Pause briefly on each image before blending (Apple-ish)
const HOLD = 0.22; // 0..0.8

const section = document.getElementById("blendSection");
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (t) => t * t * (3 - 2 * t);

const handoffSection = document.getElementById("handoffSection");
const handoffOverlay = document.getElementById("handoffOverlay");
const handoffOverlayImg = document.getElementById("handoffOverlayImg");
const handoffTarget = document.getElementById("handoffTarget");
const imageHeadline = document.getElementById("imageHeadline");

// how round the image gets when it lands
const TARGET_RADIUS_PX = 22;

// optional: keep full-screen briefly before it starts moving
const HANDOFF_HOLD_START = 0.08;
// optional: keep it landed briefly at the end
const HANDOFF_HOLD_END = 0.06;

const lerp = (a, b, t) => a + (b - a) * t;

function sectionProgress(sec) {
const rect = sec.getBoundingClientRect();
const vh = window.innerHeight;
const total = rect.height - vh;
const scrolledInto = -rect.top;
return total > 0 ? clamp01(scrolledInto / total) : 0;
}

function heldEase(t) {
// Adds “holds” at ends: 0..holdStart stays 0, (1-holdEnd)..1 stays 1
const hs = HANDOFF_HOLD_START;
const he = HANDOFF_HOLD_END;
if (t <= hs) return 0;
if (t >= 1 - he) return 1;
const u = (t - hs) / (1 - hs - he);
return smoothstep(u);
}


section.style.height = `${Math.max(2, SOURCES.length) * 80}vh`;

function loadImages(srcs) {
return Promise.all(srcs.map(src => new Promise((res, rej) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Failed to load: ${src}`));
    img.src = src;
})));
}

function getCanvasCssSize() {
const r = canvas.getBoundingClientRect();
return { cw: r.width, ch: r.height };
}

function resizeCanvas() {
const dpr = window.devicePixelRatio || 1;
const { cw, ch } = getCanvasCssSize();
canvas.width = Math.max(1, Math.round(cw * dpr));
canvas.height = Math.max(1, Math.round(ch * dpr));
// draw in CSS pixels
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawCover(img, alpha = 1, yAnchor = 1) {
const { cw, ch } = getCanvasCssSize();
const iw = img.naturalWidth || img.width;
const ih = img.naturalHeight || img.height;

const s = Math.max(cw / iw, ch / ih);
const dw = iw * s;
const dh = ih * s;

// Center horizontally
const dx = (cw - dw) / 2;

// For vertical, anchor within the available crop so we don't reveal blank bars
// If dh > ch, extraCrop = dh - ch. yAnchor=0 => dy=0 (top), 0.5 => center, 1 => bottom.
let dy;
if (dh > ch) {
    const extra = dh - ch;
    const a = Math.max(0, Math.min(1, yAnchor));
    dy = -extra * a;
} else {
    // no vertical crop; just center
    dy = (ch - dh) / 2;
}

ctx.globalAlpha = alpha;
ctx.drawImage(img, dx, dy, dw, dh);
}

function getProgress() {
const rect = section.getBoundingClientRect();
const vh = window.innerHeight;
const total = rect.height - vh;
const scrolledInto = -rect.top;
return total > 0 ? clamp01(scrolledInto / total) : 0;
}

function makeBlender(images, hold = 0.2) {
return function render() {
    const t = getProgress();
    const n = images.length;
    if (n === 0) return;

    const { cw, ch } = getCanvasCssSize();
    ctx.clearRect(0, 0, cw, ch);

    if (n === 1) {
    drawCover(images[0], 1, Y_ANCHOR);
    ctx.globalAlpha = 1;
    return;
    }

    const segs = n - 1;
    const s = t * segs;
    const i = Math.min(n - 2, Math.max(0, Math.floor(s)));
    let f = s - i;

    const h = Math.max(0, Math.min(0.8, hold));
    if (f < h) f = 0;
    else if (f > 1 - h) f = 1;
    else f = (f - h) / (1 - 2 * h);

    f = smoothstep(f);

    drawCover(images[i], 1, Y_ANCHOR);
    drawCover(images[i + 1], f, Y_ANCHOR);
    ctx.globalAlpha = 1;
};
}

function updateHandoff() {
const rect = handoffSection.getBoundingClientRect();
const vh = window.innerHeight;

const HANDOFF_DURATION_VH = 1.1; // try 0.9 (snappier) to 1.4 (slower)
const p = clamp01((vh - rect.top) / (vh * HANDOFF_DURATION_VH));

if (p <= 0) {
    canvas.style.opacity = "1";
    imageHeadline.style.opacity = "1";
    handoffOverlay.style.opacity = "0";
    handoffTarget.style.opacity = "0";
    return;
}

canvas.style.opacity = "0";
imageHeadline.style.opacity = "0";
handoffOverlay.style.opacity = "1";

const e = heldEase(p);

const start = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

const endRect = handoffTarget.getBoundingClientRect();
const end = { left: endRect.left, top: endRect.top, width: endRect.width, height: endRect.height };

const L = lerp(start.left, end.left, e);
const T = lerp(start.top, end.top, e);
const W = lerp(start.width, end.width, e);
const H = lerp(start.height, end.height, e);

handoffOverlay.style.left = `${L}px`;
handoffOverlay.style.top = `${T}px`;
handoffOverlay.style.width = `${W}px`;
handoffOverlay.style.height = `${H}px`;

const r = lerp(0, TARGET_RADIUS_PX, e);
handoffOverlayImg.style.borderRadius = `${r}px`;

if (p >= 0.999) {
    handoffOverlay.style.opacity = "0";
    handoffTarget.style.opacity = "1";
    imageHeadline.style.opacity = "0";

} else {
    handoffTarget.style.opacity = "0";
}
}


let render = () => {};
let ticking = false;
function onScroll() {
if (!ticking) {
    ticking = true;
    requestAnimationFrame(() => {
    render();
    updateHandoff();
    ticking = false;
    });
}
}


(async function init() {
const imgs = await loadImages(SOURCES);
resizeCanvas();
render = makeBlender(imgs, HOLD);
render();
updateHandoff();


window.addEventListener("scroll", onScroll, { passive: true });
// window.addEventListener("resize", () => { resizeCanvas(); render(); });
window.addEventListener("resize", () => {
    resizeCanvas();
    render();
    updateHandoff();
});

})().catch(err => console.error(err));