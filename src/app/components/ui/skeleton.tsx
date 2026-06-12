import { cn } from "../../utils/cn";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-slate-800", className)}
      {...props}
    />
  );
}

export { Skeleton };

// Skeleton presets
export function SkeletonCard() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-1/4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-pulse pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-12 w-40 rounded-2xl" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 flex items-center gap-5">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 opacity-50" />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 space-y-5">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="w-12 h-12 rounded-xl" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40">
          <SkeletonChart />
        </div>
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40">
          <SkeletonChart />
        </div>
      </div>
    </div>
  );
}

