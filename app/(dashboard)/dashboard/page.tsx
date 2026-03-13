'use client'
import { routeHelper } from "@/app/route-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorBody } from "@/utils/api/response";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SourceType = "PDF" | "MARKDOWN" | "TEXT" | "NOTION" | "WEB";

interface Document {
    id: string;
    documentTitle: string;
    sourceType: SourceType;
    createdAt: string;
    sectionCount: number;
}

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
    PDF: "PDF",
    MARKDOWN: "Markdown",
    TEXT: "Text",
    NOTION: "Notion",
    WEB: "Web",
};

const MODEL_OPTIONS = [
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
];

export default function DashboardPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);

    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    const [title, setTitle] = useState("");
    const [model, setModel] = useState("gpt-4o-mini");
    const [uploading, setUploading] = useState(false);

    async function fetchDocuments() {
        try {
            const res = await axios.get(routeHelper.documents.get);
            setDocuments(res.data.data);
        } catch {
            toast.error("Failed to load documents");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchDocuments();
    }, []);

    async function handleUpload(e: React.FormEvent) {
        e.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file || !title) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentTitle", title);
        formData.append("model", model);

        setUploading(true);
        try {
            await axios.post(routeHelper.ingest.file, formData);
            toast.success("Document ingested successfully");
            setTitle("");
            if (fileRef.current) fileRef.current.value = "";
            fetchDocuments();
        } catch (err) {
            const body = (err as AxiosError).response?.data as ErrorBody;
            toast.error(body?.error?.message ?? "Upload failed");
        } finally {
            setUploading(false);
        }
    }

    async function handleLogout() {
        await axios.post(routeHelper.logout);
        router.push("/login");
    }

    const totalSections = documents.reduce((sum, d) => sum + d.sectionCount, 0);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-semibold">Memex</h1>
                <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{loading ? "—" : documents.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Sections indexed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{loading ? "—" : totalSections}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Upload */}
                <Card>
                    <CardHeader><CardTitle>Ingest a document</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpload} className="flex flex-col gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Document title</Label>
                                <Input
                                    id="title"
                                    placeholder="My document"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    required
                                    disabled={uploading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="file">
                                    File <span className="text-muted-foreground text-xs">(PDF, MD, TXT)</span>
                                </Label>
                                <Input disabled={uploading} id="file" type="file" accept=".pdf,.md,.txt" ref={fileRef} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="model">Model</Label>
                                <select
                                    id="model"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    {MODEL_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <Button type="submit" disabled={uploading} className="self-end">
                                {uploading ? "Processing…" : "Upload & ingest"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Document list */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">Your documents</h2>
                    {loading ? (
                        <p className="text-muted-foreground text-sm">Loading…</p>
                    ) : documents.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No documents yet. Upload one above.</p>
                    ) : (
                        documents.map(doc => (
                            <Card key={doc.id}>
                                <CardContent className="flex items-center justify-between py-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="font-medium">{doc.documentTitle}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {SOURCE_TYPE_LABELS[doc.sourceType]} · {doc.sectionCount} sections · {new Date(doc.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
