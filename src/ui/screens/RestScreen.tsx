import { useState } from 'preact/hooks';
import { useStore } from '../../app/store';
import { canUpgrade } from '../../core/registry';
import { flow, hasCurse, leaveNode, restAction, restHealAmount } from '../../run/flow';
import { Icon, UI_ICONS } from '../icons';
import { RunHeader } from './RunHeader';

export function RestScreen() {
  useStore(flow, (s) => s.rev);
  const run = flow.get().run;
  const [msg, setMsg] = useState<string | null>(null);
  if (!run) return null;
  const done = !!run.nodeDone;
  const heal = Math.min(restHealAmount(run), run.maxHp - run.hp);
  const upgradable = run.deck.some((c) => canUpgrade(c));
  const opts: { k: 'heal' | 'smith' | 'train' | 'purify'; name: string; icon: string; text: string; ok: boolean }[] = [
    { k: 'heal', name: '休息', icon: UI_ICONS.rest, text: `回复 ${heal} 点生命`, ok: true },
    { k: 'smith', name: '锻造', icon: 'anvil-impact', text: upgradable ? '升级牌组中的一张牌' : '没有可以升级的牌', ok: upgradable },
    { k: 'train', name: '训练', icon: 'weight-lifting-up', text: '获得 2 点经验', ok: true },
  ];
  if (hasCurse(run)) opts.push({ k: 'purify', name: '净化', icon: 'fire-silhouette', text: '把一张诅咒投入篝火', ok: true });
  const act = async (k: (typeof opts)[number]['k']) => {
    const m = await restAction(k);
    if (m) setMsg(m);
  };
  return (
    <div class="run-screen rest-screen">
      <RunHeader title="篝火" />
      <div class="rest-body">
        <div class="campfire">
          <div class="cf-glow" />
          <div class="cf-logs" />
          <div class="cf-flame f1" />
          <div class="cf-flame f2" />
          <div class="cf-flame f3" />
          {Array.from({ length: 12 }, (_, i) => (
            <i class="cf-spark" style={{ left: `${40 + ((i * 37) % 22)}%`, animationDelay: `${(i * 0.37) % 2.4}s`, animationDuration: `${1.8 + ((i * 13) % 10) / 10}s` }} />
          ))}
        </div>
        <h2 class="title-font rest-title">篝火</h2>
        <p class="rest-sub">火光驱散了寒意。在天亮之前，你只来得及做一件事。</p>
        {!done ? (
          <div class="rest-options">
            {opts.map((o) => (
              <button class={`rest-opt ${o.ok ? '' : 'disabled'}`} disabled={!o.ok} onClick={() => void act(o.k)}>
                <span class="ro-ic">
                  <Icon name={o.icon} />
                </span>
                <b class="title-font">{o.name}</b>
                <small>{o.text}</small>
              </button>
            ))}
          </div>
        ) : (
          <div class="rest-done panel">
            <p>{msg ?? '你已经在这里休整过了。'}</p>
            <button class="btn gold big" onClick={() => void leaveNode()}>
              继续前进 <Icon name="fast-forward-button" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
