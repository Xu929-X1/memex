import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
