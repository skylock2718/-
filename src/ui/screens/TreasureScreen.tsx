import { useState } from 'preact/hooks';
import { useStore } from '../../app/store';
import { audio } from '../../audio/audio';
import { getPassive } from '../../core/registry';
import { claimGold, claimRelic, finishRewards, flow } from '../../run/flow';
import { RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';
import { RunHeader } from './RunHeader';

export function TreasureScreen() {
  useStore(flow, (s) => s.rev);
  const run = flow.get().run;
  const pr = run?.pending;
  const [open, setOpen] = useState(() => !!(pr?.claimed.gold || pr?.claimed.relic));
  if (!run || !pr) return null;
  const doOpen = () => {
    if (open) return;
    setOpen(true);
    audio.play('gold');
    setTimeout(() => audio.play('fate'), 350);
  };
  const relic = pr.relic ? getPassive(pr.relic) : null;
  return (
    <div class="run-screen treasure-screen">
      <RunHeader title="宝藏" />
      <div class="treasure-body">
        <div class={`chest ${open ? 'open' : ''}`} onClick={doOpen}>
          <div class="chest-rays" />
          <div class="chest-base" />
          <div class="chest-lid" />
          <div class="chest-lock">
            <Icon name={UI_ICONS.lock} />
          </div>
          {!open && <div class="chest-hint">点击打开宝箱</div>}
        </div>
        {open && (
          <div class="treasure-loot panel">
            <h2 class="title-font">宝箱里有……</h2>
            {pr.gold > 0 && (
              <button class={`reward-row ${pr.claimed.gold ? 'claimed' : ''}`} onClick={claimGold} disabled={pr.claimed.gold}>
                <span class="rr-ic gold">
                  <Icon name={UI_ICONS.gold} />
                </span>
                <span class="rr-text">{pr.gold} 金币</span>
                {pr.claimed.gold && <Icon name={UI_ICONS.check} class="rr-done" />}
              </button>
            )}
            {relic && pr.relic && (
              <button class={`reward-row relic ${pr.claimed.relic ? 'claimed' : ''}`} onClick={claimRelic} disabled={pr.claimed.relic}>
                <RelicIcon id={pr.relic} size={40} />
                <span class="rr-text">
                  {relic.name}
                  <small>{relic.text}</small>
                </span>
                {pr.claimed.relic && <Icon name={UI_ICONS.check} class="rr-done" />}
              </button>
            )}
            <button
              class="btn gold big"
              onClick={() => {
                if (pr.relic && !pr.claimed.relic) claimRelic();
                void finishRewards();
              }}
            >
              继续前进 <Icon name="fast-forward-button" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
