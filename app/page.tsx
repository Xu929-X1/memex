import { Button } from "@/components/ui/button";
import Link from "next/link";



export default function Home() {
  const quoteData = {
    quote: "Consider a future device ... in which an individual stores all his books, records, and communications, and which is mechanized so that it may be consulted with exceeding speed and flexibility. It is an enlarged intimate supplement to his memory.",
    author: "Vannevar Bush"
  }
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-8 py-6">
        <span className="font-mono text-sm font-semibold tracking-tight">
          memex
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-12">
        {quoteData && (
          <figure className="max-w-2xl text-center flex flex-col gap-4">
            <blockquote className="text-xl leading-relaxed text-foreground/80 font-light italic">
              {quoteData.quote}
            </blockquote>
            <figcaption className="text-sm text-muted-foreground">
              — {quoteData.author}
            </figcaption>
          </figure>
        )}

        <div className="flex gap-3">
          <Button>
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="secondary" >
            <Link href="/register">Register</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
