export interface BBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface PdfItem {
    str: string;
    x: number;
    y: number;
    w: number;
    h: number;
    page: number;
}

export interface PdfPage {
    page: number;
    width: number;
    height: number;
    items: PdfItem[];
    imageRefs: PdfImageRef[];
}

export interface PdfImageRef {
    page: number;
    bbox: BBox;
}

export type PdfBlock =
    | { kind: "TEXT"; page: number; text: string }
    | { kind: "TABLE"; page: number; rows: string[][]; markdown: string }
    | { kind: "FIGURE"; page: number; caption: string | null; bbox: BBox };
