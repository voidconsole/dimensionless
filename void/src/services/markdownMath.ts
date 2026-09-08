// src/services/markdownMath.ts
// Converts LaTeX-style math delimiters ($...$ and $$...$$) into constructs that
// react-native-markdown-display can route through custom render rules:
//   - display math  -> fenced code block tagged with MATH_BLOCK_LANG
//   - inline math   -> inline code span prefixed with MATH_INLINE_MARKER
// Both are intercepted by the custom code_inline / fence rules in
// NoteMarkdown and rendered by <MathView />.

export const MATH_INLINE_MARKER = "\u2063VOID_MATH\u2063";
export const MATH_BLOCK_LANG = "voidmath";

// Heuristic so plain "$5" or "$10.99" is never treated as math, while "$x$",
// "$E=mc^2$", "$\frac{1}{2}$", "$\mu + a$" and friends are.
function looksLikeLatex(content: string): boolean {
        const t = content.trim();
        if (!t) return false;
        // explicit LaTeX command or math operator/symbol => math even with spaces
        if (/\\[a-zA-Z]+/.test(t)) return true;
        if (/[{}^_=+\-*\/<>~]/.test(t)) return true;
        if (/[α-ωΑ-Ω∑∏∫∮√∞∈≠≤≥±×÷·→←↔⇒⇐∆ΘΛΞΠΣΦΨΩ]/.test(t)) return true;
        // multi-word plain text is never math (keeps "$5 and $10" literal)
        if (t.includes(" ")) return false;
        // short letter runs are math variables ($x$, $xy$); digits are currency
        if (/^[a-zA-Z]+$/.test(t) && t.length <= 8) return true;
        return false;
}

function findFenceEnd(
        src: string,
        start: number,
        run: number,
): number {
        const re = new RegExp(`(^|\\n)[\\t ]{0,3}\`{${run}}`, "g");
        re.lastIndex = start;
        const m = re.exec(src);
        if (!m) return -1;
        return m.index;
}

/**
 * Replaces $...$ / $$...$$ math with code-span / fenced-code equivalents that
 * the markdown renderer can detect. Code blocks, inline code spans and escaped
 * characters are left untouched.
 */
export function preprocessMath(src: string): string {
        let out = "";
        let i = 0;
        const n = src.length;

        while (i < n) {
                const c = src[i];

                // escaped character — copy verbatim
                if (c === "\\" && i + 1 < n) {
                        const d = src[i + 1];
                        if (d === "$" || d === "`" || d === "\\" || d === "*" || d === "_") {
                                out += c + d;
                                i += 2;
                                continue;
                        }
                }

                // display math \[...\]
                if (c === "\\" && src[i + 1] === "[") {
                        const close = src.indexOf("\\]", i + 2);
                        if (close !== -1) {
                                const content = src.slice(i + 2, close).trim();
                                if (content && !content.includes("````")) {
                                        out +=
                                                "\n````" +
                                                MATH_BLOCK_LANG +
                                                "\n" +
                                                content +
                                                "\n````\n";
                                        i = close + 2;
                                        continue;
                                }
                        }
                }

                // inline math \(...\)
                if (c === "\\" && src[i + 1] === "(") {
                        const close = src.indexOf("\\)", i + 2);
                        if (close !== -1) {
                                const content = src.slice(i + 2, close).trim();
                                if (content) {
                                        out += `\`${MATH_INLINE_MARKER}${content}\``;
                                        i = close + 2;
                                        continue;
                                }
                        }
                }

                // fenced code block ```...```
                if (c === "`") {
                        let run = 0;
                        while (i + run < n && src[i + run] === "`") run++;
                        const atLineStart = i === 0 || src[i - 1] === "\n";
                        if (atLineStart && run >= 3) {
                                const end = findFenceEnd(src, i + run, run);
                                if (end === -1) {
                                        out += src.slice(i);
                                        i = n;
                                        continue;
                                }
                                // include the closing fence line
                                let lineEnd = end;
                                while (lineEnd < n && src[lineEnd] !== "\n") lineEnd++;
                                out += src.slice(i, lineEnd);
                                i = lineEnd;
                                continue;
                        }
                        // inline code span — find a closing run of equal length
                        let j = i + run;
                        let closed = false;
                        while (j < n) {
                                let k = 0;
                                while (j + k < n && src[j + k] === "`") k++;
                                if (k === run) {
                                        closed = true;
                                        break;
                                }
                                j += Math.max(1, k);
                        }
                        if (closed) {
                                out += src.slice(i, j + run);
                                i = j + run;
                                continue;
                        }
                        out += c;
                        i++;
                        continue;
                }

                // display math $$...$$
                if (c === "$" && src[i + 1] === "$") {
                        const close = src.indexOf("$$", i + 2);
                        if (close !== -1) {
                                const content = src.slice(i + 2, close).trim();
                                if (content && !content.includes("````")) {
                                        out += "\n````" + MATH_BLOCK_LANG + "\n" + content + "\n````\n";
                                        i = close + 2;
                                        continue;
                                }
                        }
                        out += c + src[i + 1];
                        i += 2;
                        continue;
                }

                // inline math $...$
                if (c === "$") {
                        let j = i + 1;
                        let close = -1;
                        while (j < n) {
                                if (src[j] === "$" && src[j - 1] !== "\\") {
                                        close = j;
                                        break;
                                }
                                j++;
                        }
                        if (close !== -1) {
                                const content = src.slice(i + 1, close);
                                if (
                                        content.trim().length > 0 &&
                                        !content.includes("```") &&
                                        looksLikeLatex(content)
                                ) {
                                        out += `\`${MATH_INLINE_MARKER}${content}\``;
                                        i = close + 1;
                                        continue;
                                }
                        }
                        out += c;
                        i++;
                        continue;
                }

                out += c;
                i++;
        }

        return out;
}

// ---- URL helpers for paste-to-link ----

export const URL_PATTERN =
        /^(https?:\/\/|www\.)[^\s<>]+$/i;

// Heuristic for auto-wrapping pasted text as math: backslash commands, math
// symbols, or x^2 / a_i style super/subscripts.
export function looksLikeLatexPaste(text: string): boolean {
        const t = text.trim();
        if (!t) return false;
        if (/\\[a-zA-Z]+/.test(t)) return true;
        if (/[∑∏∫∮√∞∈∉≠≤≥≈≡±×÷·→←↔⇒⇐∆ΘΛΞΠΣΦΨΩα-ωΑ-Ω∂∇]/.test(t)) return true;
        if (/[a-zA-Z0-9][\^_][a-zA-Z0-9{]/.test(t)) return true;
        return false;
}

export function urlToMarkdownLink(url: string): string {
        let u = url.trim();
        if (u.startsWith("www.")) u = `https://${u}`;
        let label = u;
        try {
                const host = new URL(u).hostname.replace(/^www\./, "");
                label = host || u;
        } catch {
                label = u.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        }
        return `[${label}](${u})`;
}
