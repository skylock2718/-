import { useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { diceToString } from '../../core/dice';
import { cardOf } from '../../core/registry';
import type { CardDef } from '../../core/types';
import { Icon, UI_ICONS } from '../icons';
import { cardText, KEYWORD_DESC, keywordByName, keywordList, richParts, typeLine } from '../text';
import { DMG_COLOR } from '../icons';

export interface CardViewProps {
  id?: string;
  up?: boolean;
  def?: CardDef;
  cost?: number;
  size?: number;
  playable?: boolean;
  selected?: boolean;
  dim?: boolean;
  onClick?: (e: MouseEvent) => void;
  onHover?: (over: boolean) => void;
  tilt?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  badge?: string;
  showKeywords?: boolean;
}

/**
 * A playing card: procedural art (gradient + game-icon silhouette), rarity
 * frame, mouse-follow 3D tilt and holographic shine for rare+ cards.
 */
export function CardView(p: CardViewProps) {
  const def = p.def ?? cardOf({ id: p.id!, up: !!p.up });
  const ref = useRef<HTMLDivElement>(null);
  const size = p.size ?? 170;
  const [c1, c2, glyph] = def.colors ?? ['#181b22', '#4d5668', '#eef3fb'];
  const cost = p.cost ?? def.cost;
  const costDiff = cost - def.cost;
  const text = cardText(def);
  const kws = p.showKeywords === false ? [] : keywordList(def.type === 'unit' ? def.unit?.kw : def.type === 'equip' ? def.equip?.kw : undefined);
  const u = def.unit;
  const onMove = (e: MouseEvent) => {
    if (p.tilt === false || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty('--rx', `${(-y * 16).toFixed(2)}deg`);
    ref.current.style.setProperty('--ry', `${(x * 20).toFixed(2)}deg`);
    ref.current.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
    ref.current.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty('--rx', '0deg');
    ref.current.style.setProperty('--ry', '0deg');
    p.onHover?.(false);
  };
  const cls = ['card', `r-${def.rarity}`, `t-${def.type}`, p.playable ? 'playable' : '', p.selected ? 'selected' : '', p.dim ? 'dim' : '', p.up ? 'upgraded' : '', p.class ?? ''].join(' ');
  return (
    <div
      ref={ref}
      class={cls}
      style={{ '--cw': `${size}px`, '--c1': c1, '--c2': c2, '--glyph': glyph, ...(p.style ?? {}) } as JSX.CSSProperties}
      onMouseMove={onMove as never}
      onMouseEnter={() => p.onHover?.(true)}
      onMouseLeave={onLeave}
      onClick={p.onClick as never}
    >
      <div class="card-inner">
        <div class="card-art">
          <div class="art-rays" />
          <Icon name={def.icon} class="art-icon" />
          <div class="art-vignette" />
        </div>
        <div class={`card-cost ${costDiff < 0 ? 'cheaper' : costDiff > 0 ? 'pricier' : ''}`}>
          <span>{cost}</span>
        </div>
        {def.fate ? (
          <div class="card-fate" title="命运点消耗">
            <Icon name={UI_ICONS.fate} />
            <span>{def.fate}</span>
          </div>
        ) : null}
        <div class="card-name">
          <span>{def.name}</span>
        </div>
        <div class="card-type">{typeLine(def)}</div>
        <div class="card-text">
          {kws.length > 0 && (
            <div class="card-kws">
              {kws.map((k) => (
                <span class="kw" title={KEYWORD_DESC[k.k]}>
                  {k.label}
                </span>
              ))}
            </div>
          )}
          <div class="card-desc">
            {richParts(text).map((part) =>
              part.kw ? (
                <b class="kw-inline" title={keywordByName(part.text) ? KEYWORD_DESC[keywordByName(part.text)!] : undefined}>
                  {part.text}
                </b>
              ) : (
                part.text
              ),
            )}
          </div>
          {!text && kws.length > 0 && (
            <div class="card-kwdesc">
              {kws.slice(0, 2).map((k) => (
                <div>{KEYWORD_DESC[k.k]}</div>
              ))}
            </div>
          )}
          {def.flavor && !text && kws.length === 0 && <div class="card-flavor">{def.flavor}</div>}
        </div>
        {u && (
          <div class="card-stats">
            <span class="st atk" title={`命中 +${u.atk}，伤害 ${diceToString(u.dmg)}`}>
              <Icon name={UI_ICONS.atk} />
              <b>+{u.atk}</b>
              <i style={{ color: DMG_COLOR[u.dmgType ?? 'physical'] }}>{diceToString(u.dmg)}</i>
            </span>
            <span class="st ac" title="护甲等级 AC">
              <Icon name={UI_ICONS.ac} />
              <b>{u.ac}</b>
            </span>
            <span class="st hp" title="生命">
              <Icon name={UI_ICONS.hp} />
              <b>{u.hp}</b>
            </span>
            <span class="st mv" title={`移动 ${u.move}${u.range > 1 ? `，射程 ${u.range}` : ''}`}>
              <Icon name={u.range > 1 ? UI_ICONS.range : UI_ICONS.move} />
              <b>{u.range > 1 ? u.range : u.move}</b>
            </span>
          </div>
        )}
        <div class="card-gem" />
        {p.badge && <div class="card-badge">{p.badge}</div>}
        <div class="card-shine" />
      </div>
    </div>
  );
}

/** small inline "card name" chip used in logs / lists */
export function CardChip({ id, up }: { id: string; up?: boolean }) {
  const def = cardOf({ id, up: !!up });
  return (
    <span class={`card-chip r-${def.rarity}`} style={{ '--c2': def.colors?.[1] ?? '#555' } as JSX.CSSProperties}>
      <Icon name={def.icon} />
      {def.name}
    </span>
  );
}
