import { useStore } from '../../app/store';
import { getPassive } from '../../core/registry';
import { chooseFeat, flow } from '../../run/flow';
import { Icon } from '../icons';
import { RunHeader } from './RunHeader';

export function LevelUpScreen() {
  useStore(flow, (s) => s.rev);
  const run = flow.get().run;
  if (!run) return null;
  const choices = run.featChoices ?? [];
  const pendingLevel = run.level - (run.levelUps ?? 1) + 1;
  return (
    <div class="run-screen levelup-screen">
      <RunHeader title="升级" />
      <div class="levelup-body">
        <div class="lu-burst" />
        <div class="lu-head">
          <div class="lu-level">
            <span>等级</span>
            <b>{pendingLevel}</b>
          </div>
          <h2 class="title-font">升级！</h2>
          <p>最大生命 +3。选择一项专长——它会伴随你直到远征结束。</p>
        </div>
        <div class="feat-list">
          {choices.map((id, i) => {
            const f = getPassive(id);
            if (!f) return null;
            return (
              <button class="feat-card" style={{ animationDelay: `${i * 0.12}s` }} onClick={() => void chooseFeat(id)}>
                <span class="fc-ic">
                  <Icon name={f.icon} />
                </span>
                <b class="title-font">{f.name}</b>
                <span class="fc-text">{f.text}</span>
                {f.flavor && <i class="fc-flavor">「{f.flavor}」</i>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
