// Placeholders shown by the loading.tsx files while a page's data is being fetched.
// They copy the real layout (side rail + content) so nothing jumps when the page arrives.
export const Bar = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-full bg-cream ${className}`} />;
const Block = ({ className = "" }: { className?: string }) => <div className={`animate-pulse rounded-[1.75rem] bg-background ${className}`} />;

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Block className="space-y-3 p-5">
      <div className="flex gap-2"><Bar className="h-9 w-24" /><Bar className="h-9 w-24" /><Bar className="h-9 w-24" /></div>
      {Array.from({ length: rows }, (_, i) => <Bar key={i} className="h-12 w-full !rounded-2xl" />)}
    </Block>
  );
}

export function PageSkeleton({ tiles = 3, table = true }: { tiles?: number; table?: boolean }) {
  return (
    <div className="tw flex min-h-screen w-full bg-cream/60" aria-busy="true" aria-label="Loading">
      <aside className="hidden w-64 shrink-0 space-y-3 bg-background p-5 lg:block">
        <Bar className="h-9 w-36" />
        {Array.from({ length: 6 }, (_, i) => <Bar key={i} className="h-10 w-full" />)}
      </aside>
      <main className="min-w-0 flex-1 space-y-6 p-4 md:p-8">
        <div className="space-y-2"><Bar className="h-9 w-64" /><Bar className="h-4 w-80 max-w-full" /></div>
        {tiles > 0 && <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: tiles }, (_, i) => <Block key={i} className="h-24" />)}</div>}
        {table ? <TableSkeleton /> : <Block className="h-64" />}
      </main>
    </div>
  );
}

export function ResidentSkeleton() {
  return (
    <div className="tw min-h-screen bg-cream/60" aria-busy="true" aria-label="Loading">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-6 flex items-center gap-3"><Bar className="h-10 w-10" /><Bar className="h-8 w-40" /></div>
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5"><Block className="h-80" /><Block className="h-36" /></div>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Block key={i} className="h-20" />)}</div>
            <Bar className="h-12 w-full" />
            <Block className="h-72" />
          </div>
        </div>
      </main>
    </div>
  );
}
