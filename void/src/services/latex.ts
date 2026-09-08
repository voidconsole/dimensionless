// src/services/latex.ts
// Pure LaTeX-subset tokenizer + parser (no React / React Native imports) so it
// can be unit-tested directly. Rendering lives in components/MathView.tsx.

const LETTER = /[a-zA-Z]/;

const GREEK_LOWER: Record<string, string> = {
        alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε",
        varepsilon: "ϵ", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
        iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ",
        omicron: "ο", pi: "π", varpi: "ϖ", rho: "ρ", varrho: "ϱ",
        sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "φ",
        varphi: "ϕ", chi: "χ", psi: "ψ", omega: "ω",
};

const GREEK_UPPER: Record<string, string> = {
        Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ",
        Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYMBOLS: Record<string, string> = {
        times: "×", cdot: "⋅", cdotp: "⋅", div: "÷", pm: "±", mp: "∓",
        neq: "≠", ne: "≠", leq: "≤", le: "≤", geq: "≥", ge: "≥",
        approx: "≈", equiv: "≡", sim: "∼", simeq: "≃", cong: "≅",
        infty: "∞", partial: "∂", nabla: "∇",
        rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
        Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
        mapsto: "↦", to: "→", gets: "←",
        in: "∈", notin: "∉", subset: "⊂", supset: "⊃",
        subseteq: "⊆", supseteq: "⊇",
        cup: "∪", cap: "∩", setminus: "∖",
        forall: "∀", exists: "∃", nexists: "∄",
        emptyset: "∅", varnothing: "∅",
        propto: "∝",
        and: "∧", lor: "∨", or: "∨", wedge: "∧", vee: "∨",
        perp: "⊥", parallel: "∥", angle: "∠", triangle: "△",
        ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
        prime: "′", hbar: "ℏ", ell: "ℓ", aleph: "ℵ",
        degree: "°", circ: "∘",
        langle: "⟨", rangle: "⟩",
        lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉",
        lbrace: "{", rbrace: "}", backslash: "\\",
        vert: "|", Vert: "‖", uparrow: "↑", downarrow: "↓",
        updownarrow: "↕", dag: "†", ddag: "‡",
        coloneqq: ":=", colon: ":",
        bigcup: "⋃", bigcap: "⋂", bigoplus: "⊕", bigotimes: "⊗",
        sum: "∑", prod: "∏", int: "∫", oint: "∮", iint: "∬", iiint: "∭",
        plusminus: "±",
};

const ACCENTS: Record<string, string> = {
        hat: "\u0302", tilde: "\u0303", bar: "\u0304", vec: "\u20D7",
        dot: "\u0307", ddot: "\u0308", acute: "\u0301", grave: "\u0300",
        breve: "\u0306", check: "\u030C", widehat: "\u0302", widetilde: "\u0303",
};

const ENV_DELIMS: Record<string, [string, string]> = {
        matrix: ["", ""],
        smallmatrix: ["", ""],
        pmatrix: ["(", ")"],
        bmatrix: ["[", "]"],
        Bmatrix: ["{", "}"],
        vmatrix: ["|", "|"],
        Vmatrix: ["‖", "‖"],
        cases: ["{", ""],
        aligned: ["", ""],
        align: ["", ""],
        array: ["", ""],
        split: ["", ""],
};

export type Tok =
        | { t: "char"; v: string }
        | { t: "cmd"; v: string }
        | { t: "sup" }
        | { t: "sub" }
        | { t: "lbrace" }
        | { t: "rbrace" }
        | { t: "amp" }
        | { t: "linebreak" };

export type MathNode =
        | { kind: "text"; value: string }
        | { kind: "group"; children: MathNode[] }
        | { kind: "script"; base: MathNode; sub?: MathNode; sup?: MathNode }
        | { kind: "frac"; num: MathNode; den: MathNode; parens?: boolean }
        | { kind: "sqrt"; radicand: MathNode; index?: MathNode }
        | { kind: "op"; symbol: string; isLim?: boolean }
        | { kind: "textmode"; value: string; style?: "bold" | "italic" }
        | { kind: "leftright"; left: string; right: string; inner: MathNode[] }
        | { kind: "env"; name: string; rows: MathNode[][][] };

function tokenize(src: string): Tok[] {
        const toks: Tok[] = [];
        let i = 0;
        const n = src.length;
        let pendingSpace = false;

        const flushSpace = () => {
                if (pendingSpace) {
                        toks.push({ t: "char", v: " " });
                        pendingSpace = false;
                }
        };

        while (i < n) {
                const c = src[i];
                if (c === " " || c === "\t" || c === "\n" || c === "\r") {
                        pendingSpace = true;
                        i++;
                        continue;
                }
                if (c === "\\") {
                        if (src[i + 1] === "\\") {
                                flushSpace();
                                toks.push({ t: "linebreak" });
                                i += 2;
                                continue;
                        }
                        if (i + 1 < n) {
                                const d = src[i + 1];
                                if (LETTER.test(d)) {
                                        let j = i + 1;
                                        while (j < n && LETTER.test(src[j])) j++;
                                        flushSpace();
                                        toks.push({ t: "cmd", v: src.slice(i + 1, j) });
                                        i = j;
                                        continue;
                                }
                                flushSpace();
                                toks.push({ t: "cmd", v: d });
                                i += 2;
                                continue;
                        }
                        flushSpace();
                        toks.push({ t: "char", v: "\\" });
                        i++;
                        continue;
                }
                flushSpace();
                if (c === "^") toks.push({ t: "sup" });
                else if (c === "_") toks.push({ t: "sub" });
                else if (c === "{") toks.push({ t: "lbrace" });
                else if (c === "}") toks.push({ t: "rbrace" });
                else if (c === "&") toks.push({ t: "amp" });
                else toks.push({ t: "char", v: c });
                i++;
        }
        flushSpace();
        return toks;
}

class Parser {
        toks: Tok[];
        pos = 0;

        constructor(toks: Tok[]) {
                this.toks = toks;
        }

        peek(): Tok | undefined {
                return this.toks[this.pos];
        }

        next(): Tok | undefined {
                return this.toks[this.pos++];
        }

        eof(): boolean {
                return this.pos >= this.toks.length;
        }

        parse(): MathNode[] {
                return this.parseSeq();
        }

        parseSeq(): MathNode[] {
                const left: MathNode[] = [];
                while (!this.eof()) {
                        const tok = this.peek()!;
                        if (tok.t === "rbrace") break;
                        if (tok.t === "cmd" && (tok.v === "right" || tok.v === "end")) break;
                        if (tok.t === "cmd" && (tok.v === "over" || tok.v === "atop" || tok.v === "choose")) {
                                this.next();
                                const den = this.parseSeq();
                                return [
                                        {
                                                kind: "frac",
                                                num: { kind: "group", children: left },
                                                den: { kind: "group", children: den },
                                                parens: tok.v === "choose",
                                        },
                                ];
                        }
                        const atom = this.parseAtom();
                        if (atom) left.push(this.applyScripts(atom));
                }
                return left;
        }

        parseGroup(): MathNode {
                const t = this.next();
                if (t?.t === "lbrace") {
                        const children = this.parseSeq();
                        this.next(); // rbrace
                        return { kind: "group", children };
                }
                return { kind: "group", children: [] };
        }

        parseGroupArg(): MathNode {
                if (this.peek()?.t === "lbrace") return this.parseGroup();
                const atom = this.parseAtom();
                return atom ?? { kind: "group", children: [] };
        }

        parseAtom(): MathNode | null {
                const tok = this.peek();
                if (!tok) return null;
                if (tok.t === "char") {
                        this.next();
                        return { kind: "text", value: tok.v };
                }
                if (tok.t === "lbrace") return this.parseGroup();
                if (tok.t === "sup" || tok.t === "sub") {
                        this.next();
                        return null;
                }
                if (tok.t === "cmd") {
                        this.next();
                        return this.parseCommand(tok.v);
                }
                return null;
        }

        applyScripts(base: MathNode): MathNode {
                let sub: MathNode | undefined;
                let sup: MathNode | undefined;
                while (!this.eof()) {
                        const tok = this.peek()!;
                        if (tok.t === "sup") {
                                this.next();
                                sup = this.parseScriptArg();
                        } else if (tok.t === "sub") {
                                this.next();
                                sub = this.parseScriptArg();
                        } else break;
                }
                if (sub || sup) return { kind: "script", base, sub, sup };
                return base;
        }

        parseScriptArg(): MathNode {
                if (this.peek()?.t === "lbrace") return this.parseGroup();
                const atom = this.parseAtom();
                return atom ?? { kind: "group", children: [] };
        }

        parseDelim(): string {
                const tok = this.peek();
                if (!tok) return ".";
                if (tok.t === "cmd") {
                        this.next();
                        switch (tok.v) {
                                case "langle": return "⟨";
                                case "rangle": return "⟩";
                                case "lbrace": case "{": return "{";
                                case "rbrace": case "}": return "}";
                                case "lfloor": return "⌊";
                                case "rfloor": return "⌋";
                                case "lceil": return "⌈";
                                case "rceil": return "⌉";
                                case "vert": case "|": return "|";
                                case "Vert": return "‖";
                                case "backslash": return "\\";
                                case "uparrow": return "↑";
                                case "downarrow": return "↓";
                                case "updownarrow": return "↕";
                                default: return ".";
                        }
                }
                if (tok.t === "char") {
                        this.next();
                        return tok.v === "." ? "." : tok.v;
                }
                return ".";
        }

        parseUntilBracket(): MathNode[] {
                const nodes: MathNode[] = [];
                while (!this.eof()) {
                        const tok = this.peek()!;
                        if (tok.t === "char" && tok.v === "]") {
                                this.next();
                                break;
                        }
                        const atom = this.parseAtom();
                        if (atom) nodes.push(this.applyScripts(atom));
                }
                return nodes;
        }

        parseCommand(v: string): MathNode | null {
                switch (v) {
                        case "frac": case "dfrac": case "tfrac": {
                                const num = this.parseGroupArg();
                                const den = this.parseGroupArg();
                                return { kind: "frac", num, den };
                        }
                        case "binom": {
                                const num = this.parseGroupArg();
                                const den = this.parseGroupArg();
                                return { kind: "frac", num, den, parens: true };
                        }
                        case "sqrt": {
                                let index: MathNode | undefined;
                                if (this.peek()?.t === "char" && (this.peek() as any).v === "[") {
                                        this.next();
                                        const idx = this.parseUntilBracket();
                                        index = { kind: "group", children: idx };
                                }
                                const radicand = this.parseGroupArg();
                                return { kind: "sqrt", radicand, index };
                        }
                        case "sum": return { kind: "op", symbol: "∑" };
                        case "prod": return { kind: "op", symbol: "∏" };
                        case "int": return { kind: "op", symbol: "∫" };
                        case "iint": return { kind: "op", symbol: "∬" };
                        case "iiint": return { kind: "op", symbol: "∭" };
                        case "oint": return { kind: "op", symbol: "∮" };
                        case "lim": return { kind: "op", symbol: "lim", isLim: true };
                        case "limsup": return { kind: "op", symbol: "lim sup", isLim: true };
                        case "liminf": return { kind: "op", symbol: "lim inf", isLim: true };
                        case "max": case "min": case "sup": case "inf": case "argmin": case "argmax":
                                return { kind: "op", symbol: v, isLim: true };
                        case "text": {
                                const g = this.parseGroupArg();
                                return { kind: "textmode", value: flattenText(g) };
                        }
                        case "mathrm": case "operatorname": {
                                const g = this.parseGroupArg();
                                return { kind: "textmode", value: flattenText(g) };
                        }
                        case "mathbf": case "boldsymbol": {
                                const g = this.parseGroupArg();
                                return { kind: "textmode", value: flattenText(g), style: "bold" };
                        }
                        case "mathit": case "mathcal": case "mathscr": {
                                const g = this.parseGroupArg();
                                return { kind: "textmode", value: flattenText(g), style: "italic" };
                        }
                        case "mathbb": case "mathfrak": case "mathsf": case "mathtt": {
                                const g = this.parseGroupArg();
                                return { kind: "textmode", value: flattenText(g) };
                        }
                        case "color": case "textcolor": {
                                this.parseGroupArg();
                                const g = this.parseGroupArg();
                                return { kind: "group", children: (g as any).children ?? [] };
                        }
                        case "left": {
                                const left = this.parseDelim();
                                const inner = this.parseSeq();
                                let right = ".";
                                if (this.peek()?.t === "cmd" && (this.peek() as any).v === "right") {
                                        this.next();
                                        right = this.parseDelim();
                                }
                                return { kind: "leftright", left, right, inner };
                        }
                        case "right":
                                return null;
                        case "begin":
                                return this.parseEnv();
                        case "end": {
                                this.parseGroupArg();
                                return null;
                        }
                        case "limits": case "nolimits":
                                return null;
                        case "over": case "atop": case "choose":
                                return null;
                        case ",": case ":": case ";": case " ":
                                return { kind: "text", value: " " };
                        case "!": case "negthinspace":
                                return { kind: "text", value: "" };
                        case "quad":
                                return { kind: "text", value: "  " };
                        case "qquad":
                                return { kind: "text", value: "    " };
                        case "prime":
                                return { kind: "text", value: "′" };
                        case "hat": case "tilde": case "bar": case "vec": case "dot":
                        case "ddot": case "acute": case "grave": case "breve": case "check":
                        case "widehat": case "widetilde": {
                                const g = this.parseGroupArg();
                                const accent = ACCENTS[v] ?? "";
                                return { kind: "text", value: accent + flattenText(g) };
                        }
                        case "overbrace": case "underbrace": case "overleftarrow": case "overrightarrow":
                                return { kind: "text", value: flattenText(this.parseGroupArg()) };
                        default: {
                                if (GREEK_LOWER[v]) return { kind: "text", value: GREEK_LOWER[v] };
                                if (GREEK_UPPER[v]) return { kind: "text", value: GREEK_UPPER[v] };
                                if (SYMBOLS[v]) return { kind: "text", value: SYMBOLS[v] };
                                if (v.length === 1 && "()[]|{}.+-=*/".includes(v)) {
                                        return { kind: "text", value: v };
                                }
                                return { kind: "text", value: `\\${v}` };
                        }
                }
        }

        parseEnv(): MathNode | null {
                if (this.peek()?.t !== "lbrace") return null;
                this.next();
                let name = "";
                while (this.peek() && (this.peek() as any).t !== "rbrace") {
                        const t = this.next();
                        if (t?.t === "char") name += t.v;
                        else if (t?.t === "cmd") name += "\\" + t.v;
                }
                this.next(); // rbrace

                const rows: MathNode[][][] = [];
                let cells: MathNode[] = [];
                let row: MathNode[][] = [];

                while (!this.eof()) {
                        const tok = this.peek()!;
                        if (tok.t === "cmd" && tok.v === "end") {
                                this.next();
                                if (this.peek()?.t === "lbrace") {
                                        this.next();
                                        while (this.peek() && (this.peek() as any).t !== "rbrace") {
                                                this.next();
                                        }
                                        this.next();
                                }
                                break;
                        }
                        if (tok.t === "linebreak") {
                                this.next();
                                row.push(cells);
                                rows.push(row);
                                cells = [];
                                row = [];
                                continue;
                        }
                        if (tok.t === "amp") {
                                this.next();
                                row.push(cells);
                                cells = [];
                                continue;
                        }
                        const atom = this.parseAtom();
                        if (atom) cells.push(this.applyScripts(atom));
                }
                row.push(cells);
                rows.push(row);
                return { kind: "env", name: name.trim(), rows };
        }
}

function flattenText(node: MathNode): string {
        switch (node.kind) {
                case "text": return node.value;
                case "textmode": return node.value;
                case "group": return node.children.map(flattenText).join("");
                case "script":
                        return (
                                flattenText(node.base) +
                                (node.sub ? flattenText(node.sub) : "") +
                                (node.sup ? flattenText(node.sup) : "")
                        );
                default: return "";
        }
}

export function parseLatex(src: string): MathNode[] {
        try {
                return new Parser(tokenize(src)).parse();
        } catch {
                return [{ kind: "text", value: src }];
        }
}

// Flatten an AST back to its literal text (used to compute \text{} values).
export function mathToText(node: MathNode): string {
        return flattenText(node);
}

export { ENV_DELIMS, GREEK_LOWER, GREEK_UPPER, SYMBOLS };
