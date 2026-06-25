export function calculateStageProgress(p: { stage: string; current: number; total?: number }): number {
  const total = p.total ?? 1;
  if (p.stage === 'exploring') {
    if (total <= 1) return 5;
    return Math.min(20, (p.current / total) * 20);
  }
  if (p.stage === 'processing') {
    return 20 + Math.min(70, (p.current / total) * 70);
  }
  if (p.stage === 'finalizing') {
    return 95 + Math.min(5, (p.current / total) * 5);
  }
  return Math.min(95, (p.current / total) * 100);
}

export function getDateRange(scanType: "day" | "week" | "month" | "year" | "custom", startDate?: Date, endDate?: Date): { start: Date; end: Date } {
  if (scanType === "custom" && startDate && endDate) {
    return { start: startDate, end: endDate };
  }
  const now = new Date();
  const start = new Date();
  switch (scanType) {
    case "day": start.setHours(0, 0, 0, 0); break;
    case "week": start.setDate(now.getDate() - 7); break;
    case "month": start.setMonth(now.getMonth() - 1); break;
    case "year": start.setFullYear(now.getFullYear() - 1); break;
  }
  return { start, end: now };
}
