import { useEffect, useState } from 'preact/hooks';

/**
 * Global tooltip: any element with a `data-tip` attribute shows a styled
 * tooltip near the cursor (replaces native title tooltips).
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    let current: HTMLElement | null = null;
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null;
      current = el;
      if (el && el.dataset.tip) setTip({ text: el.dataset.tip, x: e.clientX, y: e.clientY });
      else setTip(null);
    };
    const move = (e: MouseEvent) => {
      if (current && current.dataset.tip) setTip({ text: current.dataset.tip, x: e.clientX, y: e.clientY });
    };
    const out = (e: MouseEvent) => {
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]');
      if (!to) {
        current = null;
        setTip(null);
      }
    };
    const down = () => {
      current = null;
      setTip(null);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseout', out);
    document.addEventListener('pointerdown', down);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseout', out);
      document.removeEventListener('pointerdown', down);
    };
  }, []);
  if (!tip) return null;
  const left = Math.min(window.innerWidth - 300, tip.x + 16);
  const top = tip.y > window.innerHeight - 120 ? tip.y - 70 : tip.y + 18;
  return (
    <div class="tooltip" style={{ left: `${left}px`, top: `${top}px` }}>
      {tip.text}
    </div>
  );
}
