import { Compass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="bg-muted rounded-full p-4">
        <Compass className="text-muted-foreground size-7" />
      </div>
      <div className="space-y-2">
        <p className="text-primary font-mono text-sm">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground max-w-md">The page you are looking for doesn’t exist or has moved.</p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Open dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
