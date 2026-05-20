import * as path from "node:path";
import { pathToFileURL } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfImageRef, PdfItem, PdfPage } from "./types";

let standardFontDataUrlCache: string | null = null;

function getStandardFontDataUrl(): string {
    if (standardFontDataUrlCache) return standardFontDataUrlCache;
    const nodeRequire = eval("require") as NodeRequire;
    const pkgPath = nodeRequire.resolve("pdfjs-dist/package.json");
    const url = pathToFileURL(path.join(path.dirname(pkgPath), "standard_fonts/")).href;
    standardFontDataUrlCache = url.endsWith("/") ? url : `${url}/`;
    return standardFontDataUrlCache;
}

const PAINT_IMAGE_OPS = new Set<number>();

function initImageOps() {
    if (PAINT_IMAGE_OPS.size > 0) return;
    const OPS = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS;
    if (OPS) {
        if (typeof OPS.paintImageXObject === "number") PAINT_IMAGE_OPS.add(OPS.paintImageXObject);
        if (typeof OPS.paintInlineImageXObject === "number") PAINT_IMAGE_OPS.add(OPS.paintInlineImageXObject);
        if (typeof OPS.paintJpegXObject === "number") PAINT_IMAGE_OPS.add(OPS.paintJpegXObject);
        if (typeof OPS.paintImageMaskXObject === "number") PAINT_IMAGE_OPS.add(OPS.paintImageMaskXObject);
    }
}

async function extractImageRefs(page: any, pageNumber: number): Promise<PdfImageRef[]> {
    initImageOps();
    const refs: PdfImageRef[] = [];
    try {
        const opList = await page.getOperatorList();
        const OPS = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS;
        const transformOp = OPS?.transform;
        let lastTransform: number[] | null = null;
        for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i];
            const args = opList.argsArray[i];
            if (typeof transformOp === "number" && fn === transformOp && Array.isArray(args)) {
                lastTransform = args as number[];
                continue;
            }
            if (PAINT_IMAGE_OPS.has(fn)) {
                if (lastTransform && lastTransform.length >= 6) {
                    const [a, , , d, e, f] = lastTransform;
                    refs.push({
                        page: pageNumber,
                        bbox: {
                            x: e,
                            y: f,
                            w: Math.abs(a),
                            h: Math.abs(d),
                        },
                    });
                }
            }
        }
    } catch {
        // operator list optional; skip on failure
    }
    return refs;
}

export async function extractPages(fileContent: ArrayBuffer): Promise<PdfPage[]> {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
    const pdf = await pdfjsLib.getDocument({
        data: fileContent,
        standardFontDataUrl: getStandardFontDataUrl(),
    }).promise;
    const pages: PdfPage[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const items: PdfItem[] = [];
        for (const raw of content.items) {
            const it = raw as any;
            if (typeof it.str !== "string") continue;
            const transform = it.transform as number[] | undefined;
            if (!transform || transform.length < 6) continue;
            const x = transform[4];
            const y = transform[5];
            const h = typeof it.height === "number" ? it.height : Math.abs(transform[3] ?? 0);
            const w = typeof it.width === "number" ? it.width : 0;
            items.push({
                str: it.str,
                x,
                y,
                w,
                h,
                page: pageNum,
            });
        }
        const imageRefs = await extractImageRefs(page, pageNum);
        pages.push({
            page: pageNum,
            width: viewport.width,
            height: viewport.height,
            items,
            imageRefs,
        });
    }
    return pages;
}
