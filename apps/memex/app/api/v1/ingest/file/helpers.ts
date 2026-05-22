import { chunk } from "@/utils/AI/semanticChunk/chunk";
import { AppError } from "@/utils/api/Errors";
import { Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { runPdfPipeline, type PdfFidelityMetrics } from "@/utils/AI/pipeline/pdf";

export type SectionKind = "TEXT" | "TABLE" | "FIGURE";

export interface FileParseSection {
    sectionContent: string;
    codeBlocks: string[] | null;
    chunkIndex: number;
    kind?: SectionKind;
    pageStart?: number | null;
    pageEnd?: number | null;
}

export interface FileParseResult {
    sections: FileParseSection[];
    pdfFidelity?: PdfFidelityMetrics;
}

const MARKDOWN_SECTION_STRATEGIES = {
    heading: (node: RootContent, sections: FileParseResult["sections"], currentSectionContent: string[], currentCodeBlocks: string[], currentChunkIndex: number) => {
        if (currentSectionContent.length > 0 || currentCodeBlocks.length > 0) {
            const sectionContent = currentSectionContent.join("\n");
            const codeBlocks = currentCodeBlocks.length > 0 ? [...currentCodeBlocks] : null;
            sections.push({ sectionContent, codeBlocks, chunkIndex: currentChunkIndex });
            currentSectionContent.splice(0, currentSectionContent.length)
            currentCodeBlocks.splice(0, currentCodeBlocks.length)
        }
        const headingNode = node as Extract<RootContent, { type: "heading" }>;
        const headingText = headingNode.children
            .filter(child => child.type === "text")
            .map(child => (child as Extract<RootContent, { type: "text" }>).value)
            .join(" ");
        currentSectionContent.push(headingText);
    },
    paragraph: (node: RootContent, currentSectionContent: string[]) => {
        const paragraphNode = node as Extract<RootContent, { type: "paragraph" }>;
        const paragraphText = paragraphNode.children
            .filter(child => child.type === "text")
            .map(child => (child as Extract<RootContent, { type: "text" }>).value)
            .join(" ");
        currentSectionContent.push(paragraphText);
    },
    code: (node: RootContent, currentCodeBlocks: string[]) => {
        const codeNode = node as Extract<RootContent, { type: "code" }>;
        currentCodeBlocks.push(codeNode.value);
    },
    list: (node: RootContent, currentSectionContent: string[]) => {
        const listNode = node as Extract<RootContent, { type: "list" }>;
        for (const item of listNode.children) {
            const texts: string[] = [];
            function extractText(n: any) {
                if (n.type === "text") texts.push(n.value);
                if (n.type === "link") {
                    if (n.children) n.children.forEach(extractText);
                }
                if (n.children) n.children.forEach(extractText);
            }
            item.children.forEach(extractText);
            if (texts.length > 0) currentSectionContent.push(texts.join(" "));
        }
    }
} as const;

export async function parseMarkdown(file: File): Promise<FileParseResult> {
    const fileContent = await file.text();
    const ast = fromMarkdown(fileContent);
    let currentCodeBlocks: string[] = [];
    let currentSectionContent: string[] = [];
    function extractSections(root: Root | RootContent): FileParseResult["sections"] {
        const sections: FileParseResult["sections"] = [];
        if ("children" in root) {
            if (root.children.length === 0) {
                return sections;
            } else {
                for (const node of root.children) {
                    const nodeType = node.type as keyof typeof MARKDOWN_SECTION_STRATEGIES;
                    if (nodeType in MARKDOWN_SECTION_STRATEGIES) {
                        if (nodeType === "heading") {
                            MARKDOWN_SECTION_STRATEGIES[nodeType](node, sections, currentSectionContent, currentCodeBlocks, sections.length);
                        } else if (nodeType === "paragraph") {
                            MARKDOWN_SECTION_STRATEGIES[nodeType](node, currentSectionContent);
                        } else if (nodeType === "code") {
                            MARKDOWN_SECTION_STRATEGIES[nodeType](node, currentCodeBlocks);
                        } else if (nodeType === "list") {
                            MARKDOWN_SECTION_STRATEGIES["list"](node, currentSectionContent);
                        }
                    }
                }
            }

        }
        if (currentSectionContent.length > 0 || currentCodeBlocks.length > 0) {
            const sectionContent = currentSectionContent.join("\n");
            const codeBlocks = currentCodeBlocks.length > 0 ? [...currentCodeBlocks] : null;
            sections.push({ sectionContent, codeBlocks, chunkIndex: sections.length });
        }
        return sections;
    }

    return { sections: extractSections(ast) };
}


export async function parseText(text: string): Promise<FileParseResult> {
    const chunks = await chunk(text);

    const sections = chunks.map((c, i) => ({
        sectionContent: c.join(" "),
        chunkIndex: i,
        codeBlocks: null //TODO: Will Support in the Future 
    }));

    return { sections: sections };
}
export async function parsePDF(file: File): Promise<FileParseResult> {
    const fileContent = await file.arrayBuffer();
    const { sections, fidelity } = await runPdfPipeline(fileContent);
    const totalText = sections.reduce((n, s) => n + s.sectionContent.length, 0);
    if (totalText < 100) {
        throw AppError.badRequest("PDF appears to be image-based and cannot be parsed. Please use a text-based PDF.");
    }
    return { sections, pdfFidelity: fidelity };
}

