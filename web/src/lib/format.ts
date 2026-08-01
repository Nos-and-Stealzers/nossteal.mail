export function formatBytes(bytes: number | string | null | undefined): string {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function usagePercent(used: number | string, limit: number | string): number {
  const u = Number(used ?? 0);
  const l = Number(limit ?? 0);
  if (!l) return 0;
  return Math.min(100, Math.round((u / l) * 100));
}
