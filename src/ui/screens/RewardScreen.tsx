import { useStore } from '../../app/store';
import { getPassive, getPotion } from '../../core/registry';
import { claimBossRelic, claimCard, claimGold, claimPotion, claimRelic, finishRewards, flow, skipCards } from '../../run/flow';
import { CardView } from '../components/CardView';
import { Divider, PotionIcon, RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';
import { RunHeader } from './RunHeader';

const SOURCE_TITLE = { battle: '胜利！', elite: '击败精英！', boss: '首领陨落！', treasure: '宝藏', event: '奇遇' };

export function RewardScreen() {
  useStore(flow, (s) => s.rev);
  const last = useStore(flow, (s) => s.lastBattle);
  const run = flow.get().run;
  const pr = run?.pending;
  if (!run || !pr) return null;
  const fromBattle = pr.source === 'battle' || pr.source === 'elite' || pr.source === 'boss';
  return (
    <div class="run-screen reward-screen">
      <RunHeader title="战利品" />
      <div class="reward-body">
        <div class={`reward-panel panel src-${pr.source}`}>
          <h2 class="title-font">{SOURCE_TITLE[pr.source]}</h2>
          {fromBattle && last && (
            <div class="battle-summary">
              <span>
                <Icon name={UI_ICONS.sword} /> {last.name}
              </span>
              <span>{last.rounds} 回合</span>
              <span>造成 {last.dmg} 伤害</span>
              <span>击杀 {last.kills}</span>
              {last.crits > 0 && <span class="hl">暴击 ×{last.crits}</span>}
              {last.nat20 > 0 && <span class="hl">天然 20 ×{last.nat20}</span>}
              <span>+{last.xp} 经验</span>
              {last.levelUps > 0 && <span class="hl lv">升级！</span>}
            </div>
          )}
          <Divider />
          <div class="reward-list">
            {pr.gold > 0 && (
              <button class={`reward-row ${pr.claimed.gold ? 'claimed' : ''}`} onClick={claimGold} disabled={pr.claimed.gold}>
                <span class="rr-ic gold">
                  <Icon name={UI_ICONS.gold} />
                </span>
                <span class="rr-text">{pr.gold} 金币</span>
                {pr.claimed.gold && <Icon name={UI_ICONS.check} class="rr-done" />}
              </button>
            )}
            {pr.potion && (
              <button class={`reward-row ${pr.claimed.potion ? 'claimed' : ''}`} onClick={claimPotion} disabled={pr.claimed.potion}>
                <PotionIcon id={pr.potion} size={34} />
                <span class="rr-text">
                  {getPotion(pr.potion).name}
                  <small>{getPotion(pr.potion).text}</small>
                </span>
                {pr.claimed.potion && <Icon name={UI_ICONS.check} class="rr-done" />}
              </button>
            )}
            {pr.relic && (
              <button class={`reward-row relic ${pr.claimed.relic ? 'claimed' : ''}`} onClick={claimRelic} disabled={pr.claimed.relic}>
                <RelicIcon id={pr.relic} size={38} />
                <span class="rr-text">
                  {getPassive(pr.relic)?.name}
                  <small>{getPassive(pr.relic)?.text}</small>
                </span>
                {pr.claimed.relic && <Icon name={UI_ICONS.check} class="rr-done" />}
              </button>
            )}
          </div>
          {pr.bossRelics && pr.bossRelics.length > 0 && (
            <div class={`boss-relics ${pr.claimed.boss ? 'claimed' : ''}`}>
              <h3 class="title-font">首领遗物 · 三选一</h3>
              <div class="br-list">
                {pr.bossRelics.map((id) => {
                  const r = getPassive(id)!;
                  const taken = pr.claimed.boss && run.relics.includes(id);
                  return (
                    <button class={`br-item ${taken ? 'taken' : ''}`} disabled={pr.claimed.boss} onClick={() => claimBossRelic(id)}>
                      <RelicIcon id={id} size={56} />
                      <b>{r.name}</b>
                      <span class="br-text">{r.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {pr.cards.map((row, ri) => (
            <div class={`card-choice ${pr.claimed.cards[ri] ? 'claimed' : ''}`}>
              <h3 class="title-font">{pr.claimed.cards[ri] ? '已选择' : '选择一张牌加入牌组'}</h3>
              <div class="cc-row">
                {row.map((id, i) => (
                  <div class="cc-slot" style={{ animationDelay: `${i * 0.09}s` }}>
                    <CardView id={id} up={pr.cardsUp[ri]?.[i]} size={178} playable={!pr.claimed.cards[ri]} dim={pr.claimed.cards[ri]} onClick={() => void claimCard(ri, i)} />
                  </div>
                ))}
              </div>
              {!pr.claimed.cards[ri] && (
                <button class="btn small" onClick={() => skipCards(ri)}>
                  跳过
                </button>
              )}
            </div>
          ))}
          <div class="reward-foot">
            <span class="deck-count">
              牌组 {run.deck.length}/{run.deckCap}
            </span>
            <button class="btn gold big" onClick={() => void finishRewards()}>
              继续前进 <Icon name="fast-forward-button" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
