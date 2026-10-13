import { useEffect, useState } from 'preact/hooks';

/** window size that re-renders the component on resize / rotation */
export function useViewport(): { w: number; h: number } {
  const [s, set] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const f = () => set({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('orientationchange', f);
    };
  }, []);
  return s;
}
