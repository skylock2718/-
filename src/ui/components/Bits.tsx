import type { JSX } from 'preact';
import { getPassive, getPotion } from '../../core/registry';
import { Icon, UI_ICONS } from '../icons';

/** small shared presentational pieces used across the run screens */

const RARITY_LABEL: Record<string, string> = {
  starter: '初始',
  common: '普通',
  uncommon: '罕见',
  rare: '稀有',
  boss: '首领',
  shop: '商店',
  event: '事件',
};

export function relicTip(id: string): string {
  const r = getPassive(id);
  if (!r) return id;
  const kind = r.kind === 'feat' ? '专长' : r.kind === 'hero' ? '英雄被动' : r.kind === 'curse' ? '诅咒' : `${RARITY_LABEL[r.rarity ?? 'common'] ?? ''}遗物`;
  return `${r.name}（${kind}）\n${r.text}${r.flavor ? `\n「${r.flavor}」` : ''}`;
}

export function RelicIcon({ id, size, onClick, class: cls }: { id: string; size?: number; onClick?: () => void; class?: string }) {
  const r = getPassive(id);
  if (!r) return null;
  return (
    <span class={`relic-ic k-${r.kind} r-${r.rarity ?? 'common'} ${cls ?? ''}`} data-tip={relicTip(id)} onClick={onClick} style={size ? ({ '--s': `${size}px` } as JSX.CSSProperties) : undefined}>
      <Icon name={r.icon} />
    </span>
  );
}

export function potionTip(id: string): string {
  const p = getPotion(id);
  return `${p.name}\n${p.text}`;
}

export function PotionIcon({ id, size, onClick, empty }: { id: string | null; size?: number; onClick?: () => void; empty?: boolean }) {
  if (!id || empty) {
    return (
      <span class="potion-ic empty" data-tip="空的药水栏" style={size ? ({ '--s': `${size}px` } as JSX.CSSProperties) : undefined}>
        <Icon name={UI_ICONS.potion} />
      </span>
    );
  }
  const p = getPotion(id);
  return (
    <span class="potion-ic" data-tip={potionTip(id)} onClick={onClick} style={{ '--pc': p.color, ...(size ? { '--s': `${size}px` } : {}) } as JSX.CSSProperties}>
      <Icon name={p.icon} />
    </span>
  );
}

export function Portrait({ icon, colors, size = 64, ring, class: cls }: { icon: string; colors?: [string, string, string]; size?: number; ring?: string; class?: string }) {
  const [c1, c2, c3] = colors ?? ['#1a1410', '#5a4a36', '#f3e9d2'];
  return (
    <div
      class={`portrait ${cls ?? ''}`}
      style={{ width: `${size}px`, height: `${size}px`, background: `radial-gradient(circle at 50% 38%, ${c2}, ${c1} 78%)`, '--ring': ring ?? 'var(--gold)' } as JSX.CSSProperties}
    >
      <div class="portrait-rays" />
      <Icon name={icon} color={c3} size={size * 0.62} />
    </div>
  );
}

export function HpBar({ hp, max, wide }: { hp: number; max: number; wide?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  return (
    <div class={`hpbar ${wide ? 'wide' : ''} ${pct < 30 ? 'low' : ''}`}>
      <div class="fill" style={{ width: `${pct}%` }} />
      <span>
        <Icon name={UI_ICONS.hp} /> {hp} / {max}
      </span>
    </div>
  );
}

export function Gold({ n, big }: { n: number; big?: boolean }) {
  return (
    <span class={`gold-badge ${big ? 'big' : ''}`}>
      <Icon name={UI_ICONS.gold} /> {n}
    </span>
  );
}

/** decorative divider with a centered diamond */
export function Divider() {
  return (
    <div class="divider">
      <span />
      <i />
      <span />
    </div>
  );
}
