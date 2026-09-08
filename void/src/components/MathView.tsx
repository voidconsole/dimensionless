// src/components/MathView.tsx
// Renders a parsed LaTeX-subset AST (see services/latex.ts) as nested React
// Native Text/View elements so it works identically on native and web. Unknown
// or malformed input degrades gracefully to literal text.
import React, { useMemo } from "react";
import { Text, View, StyleSheet, Platform } from "react-native";
import { parseLatex, ENV_DELIMS } from "../services/latex";
import type { MathNode } from "../services/latex";
import { COLORS } from "../theme/index";

const INLINE_BASE = 15;
const DISPLAY_BASE = 19;
const LINE_COLOR = "rgba(255,255,255,0.5)";

function renderNodes(
        nodes: MathNode[],
        size: number,
        display: boolean,
): React.ReactNode[] {
        return nodes.map((node, i) => (
                <React.Fragment key={i}>{renderNode(node, size, display)}</React.Fragment>
        ));
}

function renderNode(
        node: MathNode,
        size: number,
        display: boolean,
): React.ReactNode {
        switch (node.kind) {
                case "text":
                        return node.value;
                case "group":
                        return renderNodes(node.children, size, display);
                case "textmode":
                        return (
                                <Text style={[mS.textmode, node.style === "bold" && { fontWeight: "700" }, node.style === "italic" && { fontStyle: "italic" }]}>
                                        {node.value}
                                </Text>
                        );
                case "script":
                        return renderScript(node, size, display);
                case "frac":
                        return renderFrac(node, size);
                case "sqrt":
                        return renderSqrt(node, size);
                case "leftright": {
                        return (
                                <Text>
                                        <Text style={{ fontSize: size * 1.12 }}>{node.left === "." ? "" : node.left}</Text>
                                        {renderNodes(node.inner, size, display)}
                                        <Text style={{ fontSize: size * 1.12 }}>{node.right === "." ? "" : node.right}</Text>
                                </Text>
                        );
                }
                case "env":
                        return renderEnv(node, size);
                default:
                        return null;
        }
}

function renderScript(
        node: Extract<MathNode, { kind: "script" }>,
        size: number,
        display: boolean,
): React.ReactNode {
        const sub = node.sub;
        const sup = node.sup;

        // stacked limits for operators in display math
        if (node.base.kind === "op" && display && (sub || sup)) {
                return (
                        <View style={mS.limStack}>
                                {sup && (
                                        <Text style={{ fontSize: size * 0.6, lineHeight: size * 0.72 }}>
                                                {renderNode(sup, size * 0.6, display)}
                                        </Text>
                                )}
                                <Text style={{ fontSize: size * 1.25, lineHeight: size * 1.4 }}>
                                        {node.base.symbol}
                                </Text>
                                {sub && (
                                        <Text style={{ fontSize: size * 0.6, lineHeight: size * 0.72 }}>
                                                {renderNode(sub, size * 0.6, display)}
                                        </Text>
                                )}
                        </View>
                );
        }

        if (node.base.kind === "op" && node.base.isLim) {
                // \lim in inline mode renders the "lim" text with sub below
                return (
                        <Text>
                                <Text style={[mS.limText, { fontSize: size * 0.92 }]}>
                                        {node.base.symbol}
                                </Text>
                                {sub && (
                                        <Text style={{ fontSize: size * 0.62, lineHeight: size * 0.75 }}>
                                                {renderNode(sub, size * 0.62, display)}
                                        </Text>
                                )}
                        </Text>
                );
        }

        const baseEl = renderNode(node.base, size, display);

        if (Platform.OS === "web") {
                return (
                        <Text>
                                {baseEl}
                                {sup && (
                                        <Text style={{ fontSize: size * 0.66, lineHeight: size * 0.8, verticalAlign: "super" } as any}>
                                                {renderNode(sup, size * 0.66, display)}
                                        </Text>
                                )}
                                {sub && (
                                        <Text style={{ fontSize: size * 0.66, lineHeight: size * 0.8, verticalAlign: "sub" } as any}>
                                                {renderNode(sub, size * 0.66, display)}
                                        </Text>
                                )}
                        </Text>
                );
        }

        // native: stacked mini-column so sup sits above, sub sits on the baseline
        const small: any = { fontSize: size * 0.6, lineHeight: size * 0.68 };
        return (
                <Text>
                        {baseEl}
                        <View style={mS.nativeStack}>
                                <View style={mS.nativeRow}>
                                        {sup ? (
                                                <Text style={small}>{renderNode(sup, size * 0.6, display)}</Text>
                                        ) : (
                                                <Text style={small}>{"\u200B"}</Text>
                                        )}
                                </View>
                                <View style={mS.nativeRow}>
                                        {sub ? (
                                                <Text style={small}>{renderNode(sub, size * 0.6, display)}</Text>
                                        ) : (
                                                <Text style={small}>{"\u200B"}</Text>
                                        )}
                                </View>
                        </View>
                </Text>
        );
}

function renderFrac(
        node: Extract<MathNode, { kind: "frac" }>,
        size: number,
): React.ReactNode {
        const inner = (
                <View style={mS.frac}>
                        <Text style={{ fontSize: size * 0.8, lineHeight: size * 1.05 }}>
                                {renderNode(node.num, size * 0.8, false)}
                        </Text>
                        <View style={[mS.fracLine, { backgroundColor: LINE_COLOR }]} />
                        <Text style={{ fontSize: size * 0.8, lineHeight: size * 1.05 }}>
                                {renderNode(node.den, size * 0.8, false)}
                        </Text>
                </View>
        );
        if (node.parens) {
                return (
                        <Text>
                                <Text style={{ fontSize: size * 0.9 }}>{"("}</Text>
                                {inner}
                                <Text style={{ fontSize: size * 0.9 }}>{")"}</Text>
                        </Text>
                );
        }
        return inner;
}

function renderSqrt(
        node: Extract<MathNode, { kind: "sqrt" }>,
        size: number,
): React.ReactNode {
        return (
                <Text>
                        {node.index && (
                                <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.7 }}>
                                        {renderNode(node.index, size * 0.55, false)}
                                </Text>
                        )}
                        <Text style={{ fontSize: size * 1.02 }}>{"√"}</Text>
                        <View style={mS.radical}>
                                <View style={{ borderTopWidth: 1, borderTopColor: LINE_COLOR, paddingHorizontal: 2 }}>
                                        <Text>{renderNode(node.radicand, size, false)}</Text>
                                </View>
                        </View>
                </Text>
        );
}

function renderEnv(
        node: Extract<MathNode, { kind: "env" }>,
        size: number,
): React.ReactNode {
        const delims = ENV_DELIMS[node.name] ?? ["", ""];
        const isCases = node.name === "cases";
        return (
                <View style={mS.envWrap}>
                        <Text style={{ fontSize: size * 1.35, lineHeight: size * 1.6 }}>
                                {delims[0] === "{" ? "{" : delims[0]}
                        </Text>
                        <View style={mS.envBody}>
                                {node.rows.map((row, ri) => (
                                        <View key={ri} style={mS.envRow}>
                                                {row.map((cell, ci) => (
                                                        <View
                                                                key={ci}
                                                                style={[mS.envCell, isCases && ci > 0 && { alignItems: "flex-start" }]}
                                                        >
                                                                <Text>
                                                                        {renderNodes(cell, size, false)}
                                                                </Text>
                                                        </View>
                                                ))}
                                        </View>
                                ))}
                        </View>
                        <Text style={{ fontSize: size * 1.35, lineHeight: size * 1.6 }}>
                                {delims[1]}
                        </Text>
                </View>
        );
}

const mS = StyleSheet.create({
        textmode: { fontStyle: "normal" },
        limText: { fontWeight: "600", fontStyle: "italic" },
        limStack: { alignItems: "center", justifyContent: "center", marginHorizontal: 2 },
        nativeStack: { flexDirection: "column", alignItems: "center", justifyContent: "center", marginHorizontal: 1 },
        nativeRow: { flexDirection: "row", justifyContent: "center" },
        frac: { alignItems: "center", justifyContent: "center", marginHorizontal: 2 },
        fracLine: { width: "100%", height: 1, marginVertical: 1 },
        radical: { marginRight: 2, justifyContent: "center" },
        envWrap: { flexDirection: "row", alignItems: "center" },
        envBody: { alignItems: "center" },
        envRow: { flexDirection: "row", alignItems: "center" },
        envCell: { paddingHorizontal: 4, minWidth: 12, alignItems: "center" },
});

export function MathView({
        latex,
        display = false,
}: {
        latex: string;
        display?: boolean;
}) {
        const nodes = useMemo(() => parseLatex(latex), [latex]);
        const size = display ? DISPLAY_BASE : INLINE_BASE;

        const content = renderNodes(nodes, size, display);

        if (display) {
                return (
                        <View style={{ alignItems: "center", justifyContent: "center", marginVertical: 4 }}>
                                <Text style={{ color: COLORS.textPrimary, fontSize: size, lineHeight: size * 1.5 }}>
                                        {content}
                                </Text>
                        </View>
                );
        }
        return (
                <Text style={{ color: COLORS.textPrimary, fontSize: size, lineHeight: size * 1.45 }}>
                        {content}
                </Text>
        );
}
