'use client';

export function WaveformViz({
  active,
  volume,
}: {
  active: boolean;
  volume: number;
}) {
  return (
    <div className="flex items-end gap-[2px] h-6">
      {Array.from({ length: 12 }).map((_, i) => {
        const height = active ? Math.max(4, volume * 40 * Math.random()) : 4;
        return (
          <div
            key={i}
            className="w-[2px] bg-cyan rounded-full transition-all"
            style={{ height }}
          />
        );
      })}
    </div>
  );
}