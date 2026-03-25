import { chunk } from "@/utils/AI/semanticChunk/chunk";
import { AppError } from "@/utils/api/Errors";
import { Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";


export interface FileParseResult {
    sections: {
        sectionContent: string,
        codeBlocks: string[] | null,
        chunkIndex: number
    }[]
}

const MARKDOWN_SECTION_STRATEGIES = {
    heading: (node: RootContent, headingStack: { depth: number; val: string }[], sections: FileParseResult["sections"], currentSectionContent: string[], currentCodeBlocks: string[], currentChunkIndex: number) => {
        if (currentSectionContent.length > 0 || currentCodeBlocks.length > 0) {
            const headingContext = headingStack.map(h => h.val).join(" > ");
            const sectionContent = currentSectionContent.join("\n");
            const codeBlocks = currentCodeBlocks.length > 0 ? [...currentCodeBlocks] : null;
            sections.push({ sectionContent, codeBlocks, chunkIndex: currentChunkIndex });
            currentSectionContent.splice(0, currentSectionContent.length)
            currentCodeBlocks.splice(0, currentCodeBlocks.length)
        }
        const headingNode = node as Extract<RootContent, { type: "heading" }>;
        const currentHeadingDepth = headingNode.depth;
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].depth >= currentHeadingDepth) {
            headingStack.pop();
        }
        const headingText = headingNode.children
            .filter(child => child.type === "text")
            .map(child => (child as Extract<RootContent, { type: "text" }>).value)
            .join(" ");
        headingStack.push({ depth: currentHeadingDepth, val: headingText });
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
    const headingStack: {
        depth: number;
        val: string;
    }[] = [];
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
                            MARKDOWN_SECTION_STRATEGIES[nodeType](node, headingStack, sections, currentSectionContent, currentCodeBlocks, sections.length);
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
            const headingContext = headingStack.map(h => h.val).join(" > ");
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
    pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
    const pdf = await pdfjsLib.getDocument({ data: fileContent }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ");
        fullText += pageText + "\n";
    }
    if (fullText.trim().length < 100) {
        throw AppError.badRequest("PDF appears to be image-based and cannot be parsed. Please use a text-based PDF.");
    }
    return await parseText(fullText);
}

