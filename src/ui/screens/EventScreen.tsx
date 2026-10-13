import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { app } from '../../app/game';
import { useStore } from '../../app/store';
import { audio } from '../../audio/audio';
import { ABILITY_NAMES } from '../../core/battle';
import { formatMod } from '../../core/dice';
import { DiceTray } from '../../render/dice3d';
import { eventById, type EventOption } from '../../data/events';
import { checkChance, chooseEventOption, finishEvent, flow, optionState, resolveEventOutcome } from '../../run/flow';
import type { CheckRoll } from '../../run/run';
import { Icon, UI_ICONS } from '../icons';
import { RunHeader } from './RunHeader';

export function EventScreen() {
  useStore(flow, (s) => s.rev);
  const run = flow.get().run;
  if (!run?.eventId) return null;
  const ev = eventById(run.eventId);
  const view = run.eventView;
  const [c1, c2] = ev.colors;
  return (
    <div class="run-screen event-screen">
      <RunHeader title="事件" />
      <div class="event-body">
        <div class="event-panel panel">
          <div class="event-art" style={{ background: `radial-gradient(circle at 50% 42%, ${c2}, ${c1} 75%)` }}>
            <div class="ea-rays" />
            <Icon name={ev.icon} class="ea-icon" />
            <div class="ea-motes">
              {Array.from({ length: 14 }, (_, i) => (
                <i style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i * 0.61) % 5}s`, animationDuration: `${5 + ((i * 7) % 5)}s` }} />
              ))}
            </div>
          </div>
          <div class="event-content">
            <h2 class="title-font">{ev.title}</h2>
            <div class="event-text">
              {ev.text.split('\n').map((p) => (p.trim() ? <p>{p}</p> : null))}
            </div>
            {!view && (
              <div class="event-options">
                {ev.options.map((o, i) => (
                  <OptionButton opt={o} onClick={() => void chooseEventOption(i)} />
                ))}
              </div>
            )}
            {view && view.phase === 'result' && (
              <div class="event-result">
                <div class="er-chosen">
                  <Icon name="quill-ink" /> {ev.options[view.option]?.label}
                  {view.roll && (
                    <span class={`er-roll ${view.roll.kind === 'table' ? 'table' : view.roll.success ? 'ok' : 'fail'}`}>
                      <Icon name={UI_ICONS.fate} /> {view.roll.kind === 'table' ? `d20 = ${view.roll.nat}` : `${view.roll.total} vs DC ${view.roll.dc} · ${view.roll.success ? '成功' : '失败'}`}
                    </span>
                  )}
                </div>
                {view.outcome.text && <p class="er-text">{view.outcome.text}</p>}
                {view.lines.length > 0 && (
                  <ul class="er-lines">
                    {view.lines.map((l) => (
                      <li>{l}</li>
                    ))}
                  </ul>
                )}
                <button class={`btn big ${run.eventFight ? 'danger' : 'gold'}`} disabled={!view.applied} onClick={() => void finishEvent()}>
                  {run.eventFight ? (
                    <>
                      <Icon name={UI_ICONS.battle} /> 迎战！
                    </>
                  ) : run.pending ? (
                    <>
                      查看奖励 <Icon name="fast-forward-button" />
                    </>
                  ) : (
                    <>
                      继续前进 <Icon name="fast-forward-button" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {view && view.phase === 'rolling' && view.roll && <EventRoll roll={view.roll} label={ev.options[view.option]?.label ?? ''} />}
    </div>
  );
}

function OptionButton({ opt, onClick }: { opt: EventOption; onClick: () => void }) {
  const run = flow.get().run!;
  const st = optionState(run, opt);
  const chance = opt.check ? checkChance(run, opt.check.ability, opt.check.dc) : null;
  const costs: string[] = [];
  if (opt.cost?.gold) costs.push(`-${opt.cost.gold} 金币`);
  if (opt.cost?.hp) costs.push(`-${opt.cost.hp} 生命`);
  if (opt.cost?.potion) costs.push('-1 药水');
  return (
    <button class={`event-opt ${st.ok ? '' : 'disabled'}`} disabled={!st.ok} onClick={onClick} onMouseEnter={() => st.ok && audio.play('hover')}>
      <div class="eo-main">
        {opt.check && (
          <span class={`eo-check ${opt.check.ability ?? 'luck'}`}>
            <Icon name={UI_ICONS.fate} />
            {opt.check.ability ? `${ABILITY_NAMES[opt.check.ability]} DC ${opt.check.dc}` : `运气 DC ${opt.check.dc}`}
          </span>
        )}
        {opt.table && (
          <span class="eo-check luck">
            <Icon name={UI_ICONS.fate} />
            d20
          </span>
        )}
        <span class="eo-label">{opt.label}</span>
      </div>
      <div class="eo-sub">
        {opt.hint && <span class="eo-hint">{opt.hint}</span>}
        {costs.map((c) => (
          <span class="eo-cost">{c}</span>
        ))}
        {chance != null && <span class={`eo-chance ${chance >= 0.65 ? 'good' : chance >= 0.4 ? 'mid' : 'bad'}`}>成功率 {Math.round(chance * 100)}%</span>}
        {!st.ok && <span class="eo-req">{st.reason}</span>}
      </div>
    </button>
  );
}

/** BG3-style ability check: the big d20, the DC, the modifier breakdown. */
function EventRoll({ roll, label }: { roll: CheckRoll; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const tray = useRef<DiceTray | null>(null);
  const [phase, setPhase] = useState<'ready' | 'rolling' | 'done'>('ready');
  useEffect(() => {
    if (host.current && !tray.current) {
      tray.current = new DiceTray(host.current, true);
      tray.current.speed = app.get().settings.diceSpeed;
      tray.current.onBounce = (s) => audio.play('diceLand', { vol: 0.3 + s * 0.5 });
    }
    return () => {
      tray.current?.dispose();
      tray.current = null;
    };
  }, []);
  const flat = roll.mods.reduce((a, m) => a + m.value, 0);
  const doRoll = async () => {
    if (phase !== 'ready') return;
    setPhase('rolling');
    audio.play('dice');
    const glow = roll.nat === 20 ? 'crit' : roll.nat === 1 ? 'fumble' : null;
    await tray.current?.roll([{ sides: 20, value: roll.nat, theme: roll.kind === 'table' ? 'gold' : 'check', glow }]);
    setPhase('done');
    if (roll.kind === 'table') audio.play('fate');
    else if (roll.nat === 20) audio.play('nat20');
    else if (roll.nat === 1) audio.play('nat1');
    else audio.play(roll.success ? 'buff' : 'miss');
  };
  const title = roll.kind === 'table' ? '命运之骰' : roll.ability ? `${ABILITY_NAMES[roll.ability]}检定` : '运气检定';
  return (
    <div class="check-modal open event-roll" onClick={() => phase === 'done' && void resolveEventOutcome()}>
      <div class="cm-panel" onClick={(e) => e.stopPropagation()}>
        <div class="cm-title">{title}</div>
        <div class="cm-label">{label}</div>
        {roll.kind !== 'table' && (
          <div class="cm-dc">
            <span>难度</span>
            <b>{roll.dc}</b>
          </div>
        )}
        <div class="cm-dice" ref={host} />
        {roll.mods.length > 0 && (
          <div class="cm-mods">
            {roll.mods.map((m) => (
              <span>
                {m.label} {formatMod(m.value)}
              </span>
            ))}
            <span class="sum">合计 {formatMod(flat)}</span>
          </div>
        )}
        {phase === 'ready' && (
          <button class="btn gold big roll-btn" onClick={() => void doRoll()}>
            <Icon name={UI_ICONS.dice} /> 掷骰
          </button>
        )}
        {phase === 'done' && (
          <div class={`cm-result ${roll.kind === 'table' || roll.success ? 'ok' : 'fail'}`} style={{ cursor: 'pointer' } as JSX.CSSProperties} onClick={() => void resolveEventOutcome()}>
            {roll.luckyFrom && <div class="cm-lucky">幸运！重掷了天然 1</div>}
            <div class="cm-total">
              {roll.kind === 'table' ? (
                <>
                  天然 <b>{roll.nat}</b>
                </>
              ) : (
                <>
                  {roll.nat} {formatMod(flat)} = <b>{roll.total}</b>
                </>
              )}
            </div>
            <div class="cm-verdict">{roll.kind === 'table' ? '命运已定' : roll.nat === 20 ? '大成功！' : roll.nat === 1 ? '大失败！' : roll.success ? '成功' : '失败'}</div>
            <small>点击继续</small>
          </div>
        )}
      </div>
    </div>
  );
}
