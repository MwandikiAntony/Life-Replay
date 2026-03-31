'use client';

interface VolumeMeterProps {
  volume: number; // 0–100
}

export function VolumeMeter({ volume }: VolumeMeterProps) {
  const bars = 12;
  const filledBars = Math.round((volume / 100) * bars);

  return (
    <div className="flex items-end gap-0.5 h-5">
      {Array.from({ length: bars }).map((_, i) => {
        const isFilled = i < filledBars;
        const isHigh = i > bars * 0.75;
        const isMid = i > bars * 0.5;
        const color = isHigh ? '#f43f5e' : isMid ? '#f59e0b' : '#00d4ff';

        return (
          <div
            key={i}
            className="w-1 rounded-sm transition-all duration-75"
            style={{
              height: `${30 + (i / bars) * 70}%`,
              background: isFilled ? color : 'rgba(255,255,255,0.08)',
            }}
          />
        );
      })}
    </div>
  );
}

interface WaveformVizProps {
  active: boolean;
  volume: number;
}

export function WaveformViz({ active, volume }: WaveformVizProps) {
  const barCount = 18;
  const intensity = Math.max(0.2, volume / 100);

  return (
    <div className="flex items-center gap-[2px] h-8">
      {Array.from({ length: barCount }).map((_, i) => {
        const baseHeight = 20 + Math.sin((i / barCount) * Math.PI) * 60;
        const height = active ? baseHeight * intensity : 3;
        const delay = (i / barCount) * 0.8;

        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-cyan/60"
            style={{
              height: `${Math.max(3, height)}%`,
              animationDelay: `${delay}s`,
              animation: active ? `waveform-bounce ${0.6 + (i % 4) * 0.15}s ease-in-out infinite ${delay}s` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
