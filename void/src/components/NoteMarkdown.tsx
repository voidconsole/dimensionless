// src/components/NoteMarkdown.tsx
// Shared markdown renderer used by both the editor preview and NoteCard. It
// wires LaTeX support into react-native-markdown-display via custom rules and
// resolves local attachment tokens ({{att:id}}) into inline markdown.
import React from "react";
import { Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { COLORS, FONTS } from "../theme/index";
import {
        preprocessMath,
        MATH_INLINE_MARKER,
        MATH_BLOCK_LANG,
} from "../services/markdownMath";
import { MathView } from "./MathView";
import type { Attachment } from "../services/github";

export const noteMarkdownStyles: any = {
        body: {
                fontSize: 14.5,
                lineHeight: 22,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sans,
                marginBottom: 10,
                letterSpacing: 0.08,
        },
        heading1: {
                fontSize: 19,
                lineHeight: 26,
                fontWeight: "600",
                color: COLORS.textPrimary,
                marginTop: 8,
                marginBottom: 8,
        },
        heading2: {
                fontSize: 17,
                lineHeight: 24,
                fontWeight: "600",
                color: COLORS.textPrimary,
                marginTop: 8,
                marginBottom: 6,
        },
        heading3: {
                fontSize: 15.5,
                lineHeight: 22,
                fontWeight: "600",
                color: COLORS.textPrimary,
                marginTop: 6,
                marginBottom: 6,
        },
        heading4: {
                fontSize: 15,
                lineHeight: 22,
                fontWeight: "600",
                color: COLORS.textPrimary,
                marginTop: 4,
                marginBottom: 4,
        },
        heading5: { fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
        heading6: { fontSize: 15, lineHeight: 22, color: COLORS.textPrimary },
        strong: { fontWeight: "700" },
        em: { fontStyle: "italic" },
        s: { textDecorationLine: "line-through" },
        blockquote: {
                backgroundColor: "rgba(255,255,255,0.03)",
                borderLeftWidth: 2,
                borderLeftColor: "rgba(255,255,255,0.15)",
                paddingLeft: 10,
                paddingVertical: 4,
                borderRadius: 4,
                opacity: 0.85,
                marginVertical: 6,
        },
        code_inline: {
                backgroundColor: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.7)",
                fontFamily: FONTS.mono,
                fontSize: 12,
                paddingHorizontal: 4,
                borderRadius: 3,
        },
        code_block: {
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.7)",
        },
        fence: {
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.7)",
                fontFamily: FONTS.mono,
                fontSize: 12,
                padding: 10,
                borderRadius: 8,
                marginVertical: 6,
        },
        link: { color: COLORS.accentBlue },
        hr: {
                backgroundColor: "rgba(255,255,255,0.08)",
                height: 1,
                marginVertical: 10,
        },
        bullet_list_icon: { color: "rgba(255,255,255,0.4)" },
        ordered_list_icon: { color: "rgba(255,255,255,0.4)" },
};

export function attachmentToMarkdown(att: Attachment): string {
        if (att.type === "image") return `![${att.name}](${att.uri})`;
        return `[${att.name}](${att.uri})`;
}

function resolveAttachmentTokens(
        source: string,
        attachments: Attachment[] | undefined,
): string {
        const byId = new Map((attachments ?? []).map((a) => [a.id, a]));
        // `attr` was emitted by an older editor build; keep accepting it so
        // persisted notes render instead of silently losing their images.
        return source.replace(
                /\{\{att(?:r)?\s*:\s*([^}]+?)\}\}/g,
                (_, id: string) => {
                        const attachment = byId.get(id.trim());
                        return attachment ? attachmentToMarkdown(attachment) : "";
                },
        );
}

const mathRules: any = {
        code_inline: (
                node: any,
                children: any,
                parent: any,
                styles: any,
                inheritedStyles: any,
        ) => {
                const content: string = node.content;
                if (typeof content === "string" && content.startsWith(MATH_INLINE_MARKER)) {
                        return (
                                <MathView
                                        key={node.key}
                                        latex={content.slice(MATH_INLINE_MARKER.length)}
                                />
                        );
                }
                return (
                        <Text key={node.key} style={[inheritedStyles, styles.code_inline]}>
                                {content}
                        </Text>
                );
        },
        fence: (
                node: any,
                children: any,
                parent: any,
                styles: any,
                inheritedStyles: any,
        ) => {
                let content: string = node.content;
                if (typeof content === "string" && content.endsWith("\n")) {
                        content = content.slice(0, -1);
                }
                const info = String(node.sourceInfo ?? "")
                        .trim()
                        .toLowerCase();
                if (info === MATH_BLOCK_LANG || info === "math") {
                        return (
                                <View
                                        key={node.key}
                                        style={{ alignItems: "center", marginVertical: 8 }}
                                >
                                        <MathView latex={content} display />
                                </View>
                        );
                }
                return (
                        <Text key={node.key} style={[inheritedStyles, styles.fence]}>
                                {content}
                        </Text>
                );
        },
};

export function NoteMarkdown({
        source,
        attachments,
        style,
        preview = false,
}: {
        source: string;
        attachments?: Attachment[];
        style?: Record<string, any>;
        preview?: boolean;
}) {
        const processed = React.useMemo(() => {
                let withAtts = resolveAttachmentTokens(source ?? "", attachments);
                if (preview) {
                        // cards: drop image markdown so broken/loading images never
                        // render as large empty (black) boxes
                        withAtts = withAtts.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
                }
                return preprocessMath(withAtts);
        }, [source, attachments, preview]);

        return (
                <Markdown style={style ?? noteMarkdownStyles} rules={mathRules}>
                        {processed}
                </Markdown>
        );
}

export function stripLocalAttachmentTokens(source: string): string {
        return (source ?? "").replace(
                /\{\{att(?:r)?\s*:\s*[^}]+?\}\}/g,
                "",
        );
}

export { preprocessMath };
