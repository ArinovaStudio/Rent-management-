export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">R</span>
      <span className="text-lg font-medium tracking-tight text-gray-900">Rental <span className="text-gray-500">Portal</span></span>
    </div>
  );
}