import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

export interface PdfPipelineSection {
    sectionContent: string;
    codeBlocks: string[] | null;
    chunkIndex: number;
    kind: "TEXT" | "TABLE" | "FIGURE";
    pageStart: number | null;
    pageEnd: number | null;
}

export interface PdfFidelityMetrics {
    extractedChars: number;
    afterStripChars: number;
    afterClusterChars: number;
    finalChunkChars: number;
    stripRetention: number;
    clusterRetention: number;
    chunkRetention: number;
    overallRetention: number;
}

interface DoclingPayload {
    sections: PdfPipelineSection[];
    fidelity: PdfFidelityMetrics;
}

function resolveServiceDir(): string {
    return path.resolve(process.cwd(), "services", "docling");
}

function resolvePythonBin(serviceDir: string): string {
    const override = process.env.MEMEX_PYTHON_BIN;
    if (override && override.trim().length > 0) return override;
    if (process.platform === "win32") {
        return path.join(serviceDir, ".venv", "Scripts", "python.exe");
    }
    return path.join(serviceDir, ".venv", "bin", "python");
}

function runDocling(pythonBin: string, scriptPath: string, pdfPath: string, cwd: string): Promise<DoclingPayload> {
    return new Promise((resolve, reject) => {
        const child = spawn(pythonBin, [scriptPath, pdfPath], {
            cwd,
            env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
            stdio: ["ignore", "pipe", "pipe"],
        });
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        child.stdout.on("data", c => stdoutChunks.push(c));
        child.stderr.on("data", c => stderrChunks.push(c));
        child.on("error", err => reject(err));
        child.on("close", code => {
            const stderr = Buffer.concat(stderrChunks).toString("utf8");
            if (code !== 0) {
                reject(new Error(`docling exited with code ${code}: ${stderr.trim()}`));
                return;
            }
            const stdout = Buffer.concat(stdoutChunks).toString("utf8");
            try {
                const parsed = JSON.parse(stdout) as DoclingPayload;
                resolve(parsed);
            } catch (parseErr) {
                reject(new Error(`failed to parse docling output: ${(parseErr as Error).message}\nstdout: ${stdout.slice(0, 500)}\nstderr: ${stderr.slice(0, 500)}`));
            }
        });
    });
}

export async function runPdfPipeline(fileContent: ArrayBuffer): Promise<{ sections: PdfPipelineSection[]; fidelity: PdfFidelityMetrics }> {
    const serviceDir = resolveServiceDir();
    const pythonBin = resolvePythonBin(serviceDir);
    const scriptPath = path.join(serviceDir, "process.py");

    const workDir = await mkdtemp(path.join(tmpdir(), "memex-pdf-"));
    const pdfPath = path.join(workDir, "input.pdf");
    try {
        await writeFile(pdfPath, Buffer.from(fileContent));
        const payload = await runDocling(pythonBin, scriptPath, pdfPath, serviceDir);
        return { sections: payload.sections, fidelity: payload.fidelity };
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
