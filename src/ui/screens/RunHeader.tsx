import { useState } from 'preact/hooks';
import { openModal } from '../../app/game';
import { useStore } from '../../app/store';
import { getPassive } from '../../core/registry';
import { abandonRun, discardPotion, flow, quitToTitle } from '../../run/flow';
import { ACT_NAMES, hero, potionSlots, xpForNext, XP_LEVELS } from '../../run/run';
import { Gold, HpBar, Portrait, PotionIcon, RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';

/** The expedition status bar shown on every run screen. */
export function RunHeader({ title }: { title?: string }) {
  useStore(flow, (s) => s.rev);
  const run = flow.get().run;
  const [potionMenu, setPotionMenu] = useState<number | null>(null);
  if (!run) return null;
  const h = hero(run);
  const next = xpForNext(run);
  const prev = XP_LEVELS[run.level - 1] ?? 0;
  const xpPct = next == null ? 100 : ((run.xp - prev) / Math.max(1, next - prev)) * 100;
  const slots = potionSlots(run);
  const feats = run.feats;
  return (
    <header class="run-header">
      <div class="rh-hero">
        <Portrait icon={h.icon} colors={h.colors} size={52} ring={h.color} />
        <div class="rh-hero-body">
          <div class="rh-name">
            {h.name}
            <small>{h.title}</small>
            <span class="rh-level" data-tip={next == null ? `等级 ${run.level}（已满级）` : `等级 ${run.level} · 经验 ${run.xp}/${next}\n升级时选择一项专长，最大生命 +3。`}>
              Lv.{run.level}
              <i style={{ width: `${xpPct}%` }} />
            </span>
          </div>
          <HpBar hp={run.hp} max={run.maxHp} />
        </div>
      </div>
      <div class="rh-mid">
        <div class="rh-act">
          <b class="title-font">第 {run.act} 幕 · {ACT_NAMES[run.act]}</b>
          <small>
            {title ?? ''} · 已走过 {run.stats.floors} 层{run.ascension ? ` · 天命 ${run.ascension}` : ''}
          </small>
        </div>
        <Gold n={run.gold} />
        <div class="rh-potions">
          {Array.from({ length: slots }, (_, i) => run.potions[i] ?? null).map((p, i) => (
            <span class="rh-potion-wrap">
              <PotionIcon id={p} size={30} onClick={() => setPotionMenu(potionMenu === i ? null : i)} />
              {potionMenu === i && p && (
                <div class="potion-pop" onMouseLeave={() => setPotionMenu(null)}>
                  <small>药水只能在战斗中使用</small>
                  <button
                    class="btn small danger"
                    onClick={() => {
                      discardPotion(i);
                      setPotionMenu(null);
                    }}
                  >
                    <Icon name={UI_ICONS.remove} /> 丢弃
                  </button>
                </div>
              )}
            </span>
          ))}
        </div>
      </div>
      <div class="rh-relics">
        {run.relics.map((id) => (
          <RelicIcon id={id} size={30} />
        ))}
        {feats.length > 0 && <span class="rh-sep" />}
        {feats.map((id) => (getPassive(id) ? <RelicIcon id={id} size={26} class="feat" /> : null))}
      </div>
      <div class="rh-actions">
        <button class="btn rh-deck" data-tip="查看牌组" onClick={() => openModal({ kind: 'deck', title: '牌组', pick: 'view' })}>
          <Icon name={UI_ICONS.deck} />
          <b>
            {run.deck.length}/{run.deckCap}
          </b>
        </button>
        <button class="btn icon" data-tip="设置" onClick={() => openModal({ kind: 'settings' })}>
          <Icon name={UI_ICONS.settings} />
        </button>
        <button
          class="btn icon"
          data-tip="菜单"
          onClick={() =>
            openModal({
              kind: 'confirm',
              text: '远征进度会自动保存。\n要返回主菜单，还是放弃这次远征？',
              yes: '保存并返回主菜单',
              no: '继续远征',
              onYes: () => void quitToTitle(),
              extra: { label: '放弃远征', danger: true, onClick: () => void abandonRun() },
            })
          }
        >
          <Icon name="hamburger-menu" />
        </button>
      </div>
    </header>
  );
}
