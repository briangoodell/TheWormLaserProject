(() => {
const pad = document.getElementById("laserPad");
const bar = document.getElementById("laserBar");
const worm = document.getElementById("worm");
const glow = document.getElementById("glow");
const exprInput = document.getElementById("expr");
const errEl = document.getElementById("exprError");

const clamp01 = (t) => Math.max(0, Math.min(1, t));

// --- Safe expression evaluator (no eval) ---
// Supports:
// numbers, x, y, pi, e
// + - * / ^, parentheses
// functions: sin cos tan asin acos atan sqrt abs floor ceil round min max clamp
const FUNCS = {
sin: Math.sin, cos: Math.cos, tan: Math.tan,
asin: Math.asin, acos: Math.acos, atan: Math.atan,
sqrt: Math.sqrt, abs: Math.abs,
floor: Math.floor, ceil: Math.ceil, round: Math.round,
min: Math.min, max: Math.max,
clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
};

function tokenize(s) {
const tokens = [];
let i = 0;

const isSpace = (c) => /\s/.test(c);
const isDigit = (c) => /[0-9]/.test(c);
const isAlpha = (c) => /[A-Za-z_]/.test(c);

while (i < s.length) {
    const c = s[i];
    if (isSpace(c)) { i++; continue; }

    // number
    if (isDigit(c) || (c === "." && isDigit(s[i+1]))) {
    let j = i + 1;
    while (j < s.length && /[0-9.]/.test(s[j])) j++;
    const num = Number(s.slice(i, j));
    if (!Number.isFinite(num)) throw new Error("Invalid number");
    tokens.push({ type: "num", value: num });
    i = j;
    continue;
    }

    // identifier (var or func)
    if (isAlpha(c)) {
    let j = i + 1;
    while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
    const name = s.slice(i, j).toLowerCase();
    tokens.push({ type: "id", value: name });
    i = j;
    continue;
    }

    // operators / punctuation
    if ("+-*/^(),".includes(c)) {
    tokens.push({ type: "op", value: c });
    i++;
    continue;
    }

    throw new Error(`Unexpected character: "${c}"`);
}
return tokens;
}

// Shunting-yard to RPN, with support for functions + unary minus
function toRPN(tokens) {
const out = [];
const stack = [];

const prec = { "u-": 4, "^": 3, "*": 2, "/": 2, "+": 1, "-": 1 };
const rightAssoc = { "^": true, "u-": true };

// Track function argument counts
const argCountStack = [];

let prev = null;
for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];

    if (t.type === "num") {
    out.push(t);
    prev = t;
    continue;
    }

    if (t.type === "id") {
    // If next token is "(" => function call
    const next = tokens[k + 1];
    if (next && next.type === "op" && next.value === "(") {
        stack.push({ type: "func", value: t.value });
        // We'll set arg count when we hit '('
    } else {
        out.push(t); // variable/constant
    }
    prev = t;
    continue;
    }

    if (t.type === "op") {
    if (t.value === "(") {
        stack.push(t);
        // if previous on stack is a func, start arg count
        const prevStack = stack[stack.length - 2];
        if (prevStack && prevStack.type === "func") argCountStack.push(0);
        prev = t;
        continue;
    }

    if (t.value === ")") {
        while (stack.length && stack[stack.length - 1].value !== "(") {
        out.push(stack.pop());
        }
        if (!stack.length) throw new Error("Mismatched parentheses");
        stack.pop(); // pop "("

        // If top is func, pop it too
        if (stack.length && stack[stack.length - 1].type === "func") {
        const fn = stack.pop();
        // Arg count: commas + 1 if there was an argument; 0 if empty ()
        let argc = argCountStack.pop() ?? 0;
        // Detect empty call: prev token was "("
        const empty = prev && prev.type === "op" && prev.value === "(";
        argc = empty ? 0 : (argc + 1);
        out.push({ type: "call", value: fn.value, argc });
        }

        prev = t;
        continue;
    }

    if (t.value === ",") {
        // function argument separator
        while (stack.length && stack[stack.length - 1].value !== "(") {
        out.push(stack.pop());
        }
        if (!stack.length) throw new Error("Misplaced comma");
        if (!argCountStack.length) throw new Error("Comma outside function call");
        argCountStack[argCountStack.length - 1] += 1;
        prev = t;
        continue;
    }

    // operator
    let op = t.value;
    // unary minus if at start or after operator or after "(" or ","
    if (op === "-" && (!prev || (prev.type === "op" && prev.value !== ")") || prev.type === "call")) {
        // Actually: treat as unary if previous token is null OR previous is an operator other than ')'
        // (The above line is conservative; if it misbehaves, we can simplify.)
        op = "u-";
    }

    const o1 = op;
    while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "op") break;
        const o2 = top.value;
        if (o2 === "(") break;

        const p1 = prec[o1], p2 = prec[o2];
        if (p2 > p1 || (p2 === p1 && !rightAssoc[o1])) {
        out.push(stack.pop());
        } else break;
    }
    stack.push({ type: "op", value: o1 });
    prev = t;
    continue;
    }
}

while (stack.length) {
    const t = stack.pop();
    if (t.value === "(" || t.value === ")") throw new Error("Mismatched parentheses");
    out.push(t);
}

return out;
}

function evalRPN(rpn, vars) {
const st = [];
for (const t of rpn) {
    if (t.type === "num") st.push(t.value);
    else if (t.type === "id") {
    const name = t.value;
    if (name === "pi") st.push(Math.PI);
    else if (name === "e") st.push(Math.E);
    else if (name in vars) st.push(vars[name]);
    else throw new Error(`Unknown identifier: ${name}`);
    }
    else if (t.type === "op") {
    if (t.value === "u-") {
        if (st.length < 1) throw new Error("Bad unary minus");
        st.push(-st.pop());
        continue;
    }
    if (st.length < 2) throw new Error("Bad operator");
    const b = st.pop(), a = st.pop();
    switch (t.value) {
        case "+": st.push(a + b); break;
        case "-": st.push(a - b); break;
        case "*": st.push(a * b); break;
        case "/": st.push(a / b); break;
        case "^": st.push(Math.pow(a, b)); break;
        default: throw new Error(`Unknown operator: ${t.value}`);
    }
    }
    else if (t.type === "call") {
    const fn = FUNCS[t.value];
    if (!fn) throw new Error(`Unknown function: ${t.value}`);
    if (st.length < t.argc) throw new Error(`Not enough args for ${t.value}()`);
    const args = st.splice(st.length - t.argc, t.argc);
    const out = fn(...args);
    st.push(out);
    }
    else {
    throw new Error("Bad token");
    }
}
if (st.length !== 1) throw new Error("Expression did not resolve to a single value");
return st[0];
}

let compiled = null;
function compileExpression(s) {
const tokens = tokenize(s);
const rpn = toRPN(tokens);
return (vars) => evalRPN(rpn, vars);
}

function setError(msg) {
errEl.textContent = msg || "";
exprInput.style.borderColor = msg ? "rgba(180,0,0,0.6)" : "rgba(0,0,0,0.14)";
}

// compile on input (debounced lightly)
let compileTimer = null;
function requestCompile() {
clearTimeout(compileTimer);
compileTimer = setTimeout(() => {
    try {
    compiled = compileExpression(exprInput.value);
    setError("");
    } catch (e) {
    compiled = null;
    setError(e.message || "Invalid expression");
    }
}, 120);
}
exprInput.addEventListener("input", requestCompile);
requestCompile();

// --- Interaction / weathervane cursor ---
let last = null;        // last pointer position in px
let lastAngle = 0;      // for smoothing rotation
let lastBar01 = 0;      // for smoothing bar
let autoMin = Infinity, autoMax = -Infinity;

function getNormXY(clientX, clientY) {
const r = pad.getBoundingClientRect();
const x = (clientX - r.left) / r.width;
const y = (clientY - r.top) / r.height;
return { x: clamp01(x), y: clamp01(y), rect: r, px: clientX - r.left, py: clientY - r.top };
}

function updateUI(eLike) {
const { x, y, rect, px, py } = getNormXY(eLike.clientX, eLike.clientY);

// Worm position
worm.style.opacity = "1";
worm.style.left = px + "px";
worm.style.top  = py + "px";
glow.style.opacity = "1";
glow.style.left = px + "px";
glow.style.top  = py + "px";


// Compute motion vector for direction
if (last) {
    const dx = px - last.px;
    const dy = py - last.py;
    const speed2 = dx*dx + dy*dy;

    if (speed2 > 0.5) {
    // weathervane behind motion
    const target = Math.atan2(dy, dx) + Math.PI;

    // wrap-aware angle smoothing:
    const s = 0.25; // smoothing factor
    const delta = Math.atan2(Math.sin(target - lastAngle), Math.cos(target - lastAngle));
    lastAngle = lastAngle + delta * s;
    }

}
last = { px, py };

worm.style.transform = `translate(-50%, -50%) rotate(${(lastAngle * 180 / Math.PI).toFixed(1)}deg)`;

// Evaluate expression to bar value
let raw = 0;
if (compiled) {
    try {
    raw = compiled({ x, y });
    if (!Number.isFinite(raw)) throw new Error("Expression returned non-finite number");
    setError("");
    } catch (err) {
    setError(err.message || "Error evaluating expression");
    raw = 0;
    }
}

let value01;
value01 = clamp01(raw);


// Smooth bar (lerp)
const smooth = 0.2;
lastBar01 = lastBar01 * smooth + value01 * (1 - smooth);

// Drive glow from laser intensity (0..1)
const intensity = clamp01(lastBar01);

// Tune these to taste
const minAlpha = 0.08;
const maxAlpha = 1;

const alpha  = minAlpha + (maxAlpha - minAlpha) * intensity;

glow.style.opacity = alpha.toFixed(3);


bar.style.height = (lastBar01 * 100).toFixed(1) + "%";
}

function onMove(e) { updateUI(e); }
function onLeave() { worm.style.opacity = "0"; last = null; }
function onTouch(e) { if (e.touches.length) updateUI(e.touches[0]); }

pad.addEventListener("mousemove", onMove);
pad.addEventListener("mouseleave", onLeave);
pad.addEventListener("touchstart", onTouch, { passive: true });
pad.addEventListener("touchmove", onTouch, { passive: true });
pad.addEventListener("touchend", onLeave);

// Reset auto-normalize range when changing mode or expression
function resetAuto() { autoMin = Infinity; autoMax = -Infinity; }
exprInput.addEventListener("input", resetAuto);
})();
