import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { BattleController } from '../../app/battleController';
import { battleTick, battleUi } from '../../app/battleUi';
import { useStore, useTicker } from '../../app/store';
import { ABILITY_NAMES, DMG_NAMES, KEYWORD_NAMES, SAVE_NAMES, STATUS_NAMES, type Unit } from '../../core/battle';
import { diceToString, formatMod } from '../../core/dice';
import { cardOf, getPassive, getPotion } from '../../core/registry';
import type { Keyword, RollEvent } from '../../core/types';
import { DiceTray } from '../../render/dice3d';
import { audio } from '../../audio/audio';
import { CardView } from '../components/CardView';
import { DMG_COLOR, Icon, NODE_DESC, NODE_ICON, NODE_NAME, STATUS_COLOR, STATUS_DESC, STATUS_ICON, SURFACE_DESC, SURFACE_NAME, TERRAIN_DESC, TERRAIN_NAME, UI_ICONS } from '../icons';
import { KEYWORD_DESC, keywordLabel, TRIBE_NAMES } from '../text';

export function BattleScreen({ ctl }: { ctl: BattleController }) {
  useTicker(battleTick);
  const trayHost = useRef<HTMLDivElement>(null);
  const bigHost = useRef<HTMLDivElement>(null);
  const trays = useRef<{ small: DiceTray | null; big: DiceTray | null }>({ small: null, big: null });

  useEffect(() => {
    if (trayHost.current && !trays.current.small) {
      trays.current.small = new DiceTray(trayHost.current, false);
      trays.current.small.onBounce = (s) => audio.play('diceLand', { vol: 0.3 + s * 0.5 });
    }
    ctl.setTrays(trays.current.small, () => {
      if (!trays.current.big && bigHost.current) trays.current.big = new DiceTray(bigHost.current, true);
      trays.current.big?.resize();
      return trays.current.big;
    });
    return () => {
      trays.current.small?.dispose();
      trays.current.big?.dispose();
      trays.current = { small: null, big: null };
    };
  }, [ctl]);

  const b = ctl.battle;
  const me = ctl.human;
  return (
    <div class="battle-hud">
      <PlayerBars ctl={ctl} />
      <TurnBadge ctl={ctl} />
      <UnitPanel ctl={ctl} />
      <div class="dice-zone">
        <div class="dice-tray" ref={trayHost} />
        <RollReadout />
      </div>
      <CombatLog />
      <HoverTip ctl={ctl} />
      <ModeHint ctl={ctl} />
      <div class="bottom-left">
        <ManaBar ctl={ctl} />
        <DeckInfo ctl={ctl} />
        <Potions ctl={ctl} />
      </div>
      <Hand ctl={ctl} />
      <div class="bottom-right">
        <HeroPower ctl={ctl} />
        <EndTurn ctl={ctl} />
      </div>
      <CamControls ctl={ctl} />
      <PlayedCard />
      <Banner />
      <RerollPrompt />
      <CheckModal host={bigHost} />
      {b.over && <div class={`battle-end-flash ${b.winner === me ? 'win' : 'lose'}`} />}
    </div>
  );
}

// ======================================================================== top bars

function PlayerBars({ ctl }: { ctl: BattleController }) {
  const b = ctl.battle;
  const me = ctl.human;
  const others = b.players.filter((p) => p.id !== me);
  return (
    <>
      <div class="pbar me">
        <PlayerPanel ctl={ctl} pid={me} mine />
      </div>
      <div class="pbar foes">
        {others.map((p) => (
          <PlayerPanel ctl={ctl} pid={p.id} />
        ))}
      </div>
    </>
  );
}

function PlayerPanel({ ctl, pid, mine }: { ctl: BattleController; pid: number; mine?: boolean }) {
  const b = ctl.battle;
  const p = b.player(pid);
  const hero = b.units.get(p.heroUid);
  const hp = hero?.hp ?? 0;
  const max = hero?.maxHp ?? 1;
  const active = b.active === pid && !b.over;
  const [c1, c2, c3] = p.commander.colors ?? ['#222', '#555', '#fff'];
  return (
    <div class={`ppanel ${active ? 'active' : ''} ${p.alive ? '' : 'dead'}`} style={{ '--team': p.color } as JSX.CSSProperties}>
      <div class="pp-portrait" style={{ background: `radial-gradient(circle at 50% 40%, ${c2}, ${c1})` }} onClick={() => hero && !hero.dead && ctl.selectUnit(hero.uid)}>
        <Icon name={p.commander.icon} color={c3} />
      </div>
      <div class="pp-body">
        <div class="pp-name">
          {p.name}
          {p.commander.title && <small>{p.commander.title}</small>}
        </div>
        <div class="pp-hp">
          <div class="fill" style={{ width: `${Math.max(0, (hp / max) * 100)}%` }} />
          <span>
            <Icon name={UI_ICONS.hp} /> {Math.max(0, hp)} / {max}
          </span>
          {hero && <em class="pp-ac"><Icon name={UI_ICONS.ac} />{b.acOf(hero)}</em>}
        </div>
        <div class="pp-res">
          <span class="fate" title="命运点：失败的 d20 可以花 1 点重掷">
            {Array.from({ length: p.maxFate }, (_, i) => (
              <Icon name={UI_ICONS.fate} class={i < p.fate ? 'on' : 'off'} />
            ))}
          </span>
          {!mine && (
            <>
              <span title="法力">
                <Icon name={UI_ICONS.mana} /> {p.mana}/{p.maxMana}
              </span>
              <span title="手牌">
                <Icon name="card-pickup" /> {p.hand.length}
              </span>
            </>
          )}
        </div>
        {mine && <RelicRow pid={pid} ctl={ctl} />}
        {!mine && p.passives.length > 0 && <RelicRow pid={pid} ctl={ctl} small />}
      </div>
    </div>
  );
}

function RelicRow({ ctl, pid, small }: { ctl: BattleController; pid: number; small?: boolean }) {
  const p = ctl.battle.player(pid);
  const list = p.passives.map((id) => getPassive(id)).filter((x): x is NonNullable<typeof x> => !!x && x.kind !== 'modifier');
  if (!list.length) return null;
  return (
    <div class={`relic-row ${small ? 'small' : ''}`}>
      {list.map((r) => (
        <span class={`relic k-${r.kind}`} data-tip={`${r.name}：${r.text}`}>
          <Icon name={r.icon} />
        </span>
      ))}
    </div>
  );
}

function TurnBadge({ ctl }: { ctl: BattleController }) {
  const b = ctl.battle;
  const ai = useStore(battleUi, (s) => s.aiThinking);
  const p = b.player(b.active);
  return (
    <div class={`turn-badge ${ctl.isHumanTurn ? 'mine' : 'theirs'}`}>
      <div class="tb-round">第 {b.round} 轮</div>
      <div class="tb-who" style={{ color: p.color }}>
        {ctl.isHumanTurn ? '你的回合' : `${p.name} 行动中${ai ? '…' : ''}`}
      </div>
    </div>
  );
}

// ======================================================================== unit panel

function UnitPanel({ ctl }: { ctl: BattleController }) {
  const st = useStore(ctl.state, (s) => s);
  const b = ctl.battle;
  const uid = st.mode.kind === 'unit' || st.mode.kind === 'ability' ? st.mode.uid : st.hover?.uid ?? null;
  const u = uid != null ? b.unit(uid) : undefined;
  if (!u) return null;
  const owner = b.player(u.owner);
  const mine = u.owner === ctl.human;
  const kws = (Object.keys(u.kw) as Keyword[]).filter((k) => b.kw(u, k) > 0);
  for (const t of u.tempKw) if (!kws.includes(t.kw)) kws.push(t.kw);
  const [c1, c2, c3] = u.colors ?? ['#222', '#555', '#fff'];
  const canAbility = mine && u.ability && b.canAct(u) && u.abilityCd <= 0 && ctl.canInput;
  return (
    <div class="unit-panel" style={{ '--team': owner.color } as JSX.CSSProperties}>
      <div class="up-head">
        <div class="up-portrait" style={{ background: `radial-gradient(circle at 50% 40%, ${c2}, ${c1})` }}>
          <Icon name={u.icon} color={c3} />
        </div>
        <div>
          <div class="up-name">
            {u.name}
            {u.up && <span class="up-plus">+</span>}
          </div>
          <div class="up-sub">
            {owner.name}
            {u.tribe.length > 0 && ` · ${u.tribe.map((t) => TRIBE_NAMES[t]).join('·')}`}
          </div>
        </div>
      </div>
      <div class="up-stats">
        <Stat icon={UI_ICONS.hp} label="生命" value={`${u.hp}/${u.maxHp}`} />
        <Stat icon={UI_ICONS.ac} label="AC" value={String(b.acOf(u))} />
        <Stat icon={UI_ICONS.atk} label="命中" value={formatMod(b.atkOf(u))} />
        <Stat icon={UI_ICONS.sword} label="伤害" value={diceToString(u.dmg) + (u.equipDmg.length ? '+' + u.equipDmg.join('+') : '')} color={DMG_COLOR[u.dmgType]} tip={`${DMG_NAMES[u.dmgType]}伤害`} />
        <Stat icon={UI_ICONS.move} label="移动" value={mine && b.active === u.owner ? `${u.mp}/${b.moveOf(u)}` : String(b.moveOf(u))} />
        <Stat icon={UI_ICONS.range} label="射程" value={String(b.baseRange(u))} />
        <Stat icon="mountain-climbing" label="攀爬" value={String(b.jumpOf(u))} />
        <Stat icon="shield-reflect" label="豁免" value={`${formatMod(u.saves.fort)}/${formatMod(u.saves.ref)}/${formatMod(u.saves.will)}`} tip="强韧 / 反射 / 意志" />
      </div>
      {kws.length > 0 && (
        <div class="up-kws">
          {kws.map((k) => (
            <span class="kw" data-tip={KEYWORD_DESC[k]}>
              {keywordLabel(k, b.kw(u, k))}
            </span>
          ))}
        </div>
      )}
      {u.statuses.length > 0 && (
        <div class="up-status">
          {u.statuses.map((s) => (
            <span class="st" style={{ color: STATUS_COLOR[s.id] }} data-tip={`${STATUS_NAMES[s.id]}：${STATUS_DESC[s.id]}`}>
              <Icon name={STATUS_ICON[s.id]} />
              {STATUS_NAMES[s.id]}
              {s.turns < 99 && <i>{s.turns}</i>}
            </span>
          ))}
        </div>
      )}
      {(u.resist.length > 0 || u.immune.length > 0 || u.vuln.length > 0) && (
        <div class="up-res">
          {u.immune.length > 0 && <span>免疫：{u.immune.map((d) => DMG_NAMES[d]).join('、')}</span>}
          {u.resist.length > 0 && <span>抗性：{u.resist.map((d) => DMG_NAMES[d]).join('、')}</span>}
          {u.vuln.length > 0 && <span class="bad">弱点：{u.vuln.map((d) => DMG_NAMES[d]).join('、')}</span>}
        </div>
      )}
      {u.equipment.length > 0 && (
        <div class="up-equip">
          {u.equipment.map((e) => {
            const d = cardOf({ id: e.id, up: e.up });
            return (
              <span data-tip={`${d.name}：${d.text}`}>
                <Icon name={d.icon} /> {d.name}
              </span>
            );
          })}
        </div>
      )}
      {u.ability && (
        <button class={`btn ability ${canAbility ? '' : 'disabled'}`} onClick={() => ctl.useAbility(u.uid)} data-tip={u.ability.text}>
          <Icon name={u.ability.icon} /> {u.ability.name}
          {u.abilityCd > 0 && <small>冷却 {u.abilityCd}</small>}
        </button>
      )}
      {mine && b.active === u.owner && (
        <div class="up-state">
          {u.sick ? '召唤失调：下回合才能行动' : `${u.actions > 0 ? '可以行动' : '已行动'} · ${u.mp > 0 ? `剩余移动 ${u.mp}` : '移动耗尽'}`}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color, tip }: { icon: string; label: string; value: string; color?: string; tip?: string }) {
  return (
    <div class="stat" data-tip={tip ?? label}>
      <Icon name={icon} />
      <span class="lbl">{label}</span>
      <b style={color ? { color } : undefined}>{value}</b>
    </div>
  );
}

// ======================================================================== hover tooltip

function HoverTip({ ctl }: { ctl: BattleController }) {
  const st = useStore(ctl.state, (s) => s);
  const h = st.hover;
  if (!h) return null;
  const b = ctl.battle;
  const t = b.board.get(h.pos);
  const pv = h.preview;
  const style = { left: `${h.screen.x + 18}px`, top: `${h.screen.y + 14}px` };
  return (
    <div class="hover-tip" style={style}>
      {pv && (
        <div class={`atk-preview ${pv.ok ? '' : 'blocked'}`}>
          <div class="ap-head">
            <span class="ap-hit">
              命中 <b>{Math.round(pv.hit * 100)}%</b>
            </span>
            <span class="ap-crit">暴击 {Math.round(pv.crit * 100)}%</span>
            {pv.adv !== 0 && <span class={`ap-adv ${pv.adv > 0 ? 'good' : 'bad'}`}>{pv.adv > 0 ? '优势' : '劣势'}</span>}
          </div>
          <div class="ap-dmg">
            伤害 <b>{pv.min}–{pv.max}</b> <small>（{pv.dmg}）</small>
            {pv.kill > 0.05 && <em> 击杀 {Math.round(pv.kill * 100)}%</em>}
          </div>
          <div class="ap-mods">
            {pv.mods.map((m) => (
              <span class={m.adv === 1 || (m.value ?? 0) > 0 || (m.dice && !m.dice.startsWith('-')) ? 'good' : m.adv === -1 || (m.value ?? 0) < 0 || m.dice?.startsWith('-') ? 'bad' : ''}>
                {m.label} {m.value !== undefined ? formatMod(m.value) : m.dice ? m.dice : m.adv === 1 ? '优势' : '劣势'}
              </span>
            ))}
            <span>vs AC {pv.ac}</span>
          </div>
          {pv.extras.length > 0 && <div class="ap-extra">{pv.extras.map((e) => `${e.label} ${e.dice}`).join(' · ')}</div>}
          {!pv.ok && pv.reason && <div class="ap-reason">{pv.reason}</div>}
        </div>
      )}
      <div class="tile-info">
        <b>{TERRAIN_NAME[t.terrain]}</b> · 高度 {t.h}
        <div class="ti-desc">{TERRAIN_DESC[t.terrain]}</div>
        {t.surface && (
          <div class="ti-surf">
            <b>{SURFACE_NAME[t.surface]}</b>（{t.surfaceTurns < 99 ? `${t.surfaceTurns} 回合` : '持续'}）：{SURFACE_DESC[t.surface]}
          </div>
        )}
        {t.node && (
          <div class="ti-node">
            <Icon name={NODE_ICON[t.node.kind]} /> <b>{NODE_NAME[t.node.kind]}</b>
            {t.node.owner != null && <span style={{ color: b.player(t.node.owner).color }}> · {b.player(t.node.owner).name}</span>}
            {t.node.used && <span> · 已触发</span>}
            <div class="ti-desc">{NODE_DESC[t.node.kind]}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeHint({ ctl }: { ctl: BattleController }) {
  const st = useStore(ctl.state, (s) => s.mode);
  if (st.kind === 'idle' || st.kind === 'unit') return null;
  const b = ctl.battle;
  let text = '';
  if (st.kind === 'card') {
    const inst = b.player(ctl.human).hand.find((c) => c.iid === st.iid);
    const def = inst ? cardOf(inst) : null;
    text = def ? (def.type === 'unit' ? `选择召唤位置：${def.name}` : def.type === 'equip' ? `选择装备对象：${def.name}` : `选择目标：${def.name}`) : '';
  } else if (st.kind === 'power') text = `选择英雄技能目标：${b.player(ctl.human).commander.power?.name}`;
  else if (st.kind === 'potion') text = `选择药水目标`;
  else if (st.kind === 'ability') text = '选择技能目标';
  else if (st.kind === 'replace') text = '换牌：点击一张手牌，将它洗回牌库并抽一张新牌';
  return (
    <div class="mode-hint">
      {text}
      <button class="btn small" onClick={() => ctl.cancel()}>
        取消（右键/Esc）
      </button>
    </div>
  );
}

// ======================================================================== bottom

function ManaBar({ ctl }: { ctl: BattleController }) {
  const p = ctl.battle.player(ctl.human);
  const n = Math.max(p.maxMana, p.mana);
  return (
    <div class="mana-bar" data-tip="法力：每回合上限 +1（最多 9），回合开始补满；控制法力泉额外获得">
      <div class="mana-num">
        <b>{p.mana}</b>/{p.maxMana}
      </div>
      <div class="mana-crystals">
        {Array.from({ length: Math.min(12, n) }, (_, i) => (
          <span class={`crystal ${i < p.mana ? 'on' : ''} ${i >= p.maxMana ? 'bonus' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function DeckInfo({ ctl }: { ctl: BattleController }) {
  const p = ctl.battle.player(ctl.human);
  const mode = useStore(ctl.state, (s) => s.mode.kind);
  return (
    <div class="deck-info">
      <span class="pile" data-tip={`牌库：${p.deck.length} 张`}>
        <Icon name={UI_ICONS.deck} />
        <b>{p.deck.length}</b>
      </span>
      <span class="pile" data-tip={`弃牌堆：${p.discard.length} 张（牌库用完后洗回）`}>
        <Icon name={UI_ICONS.discard} />
        <b>{p.discard.length}</b>
      </span>
      <button class={`btn small replace ${mode === 'replace' ? 'on' : ''} ${p.replaced || p.noReplace || !ctl.canInput ? 'disabled' : ''}`} onClick={() => ctl.toggleReplace()} data-tip="每回合一次：把一张手牌洗回牌库，换一张新的">
        <Icon name={UI_ICONS.replace} /> 换牌
      </button>
    </div>
  );
}

function Potions({ ctl }: { ctl: BattleController }) {
  const p = ctl.battle.player(ctl.human);
  if (!p.potions.length) return null;
  return (
    <div class="potions">
      {p.potions.map((id, i) => {
        if (!id) return <span class="potion empty" />;
        const d = getPotion(id);
        return (
          <span class={`potion ${ctl.canInput ? '' : 'disabled'}`} style={{ '--pc': d.color } as JSX.CSSProperties} onClick={() => ctl.usePotion(i)} data-tip={`${d.name}：${d.text}`}>
            <Icon name={d.icon} color={d.color} />
          </span>
        );
      })}
    </div>
  );
}

function Hand({ ctl }: { ctl: BattleController }) {
  const b = ctl.battle;
  const p = b.player(ctl.human);
  const mode = useStore(ctl.state, (s) => s.mode);
  const [hover, setHover] = useState<number | null>(null);
  const n = p.hand.length;
  const mid = (n - 1) / 2;
  const spread = Math.min(64, 520 / Math.max(1, n));
  return (
    <div class={`hand ${mode.kind === 'replace' ? 'replacing' : ''}`}>
      {p.hand.map((c, i) => {
        const off = i - mid;
        const sel = mode.kind === 'card' && mode.iid === c.iid;
        const can = ctl.canInput && b.canPlay(ctl.human, c).ok;
        const hov = hover === c.iid;
        const style: JSX.CSSProperties = {
          transform: hov || sel ? `translate(${off * spread}px, -64px) scale(1.32)` : `translate(${off * spread}px, ${Math.abs(off) * Math.abs(off) * 3}px) rotate(${off * 4}deg)`,
          zIndex: hov || sel ? 50 : 10 + i,
        };
        return (
          <div class="hand-slot" style={style} key={c.iid}>
            <CardView id={c.id} up={c.up} cost={b.costOf(p, c)} size={132} playable={can} selected={sel} dim={!can && mode.kind !== 'replace'} onClick={() => ctl.selectCard(c)} onHover={(o) => setHover((h) => (o ? c.iid : h === c.iid ? null : h))} class="in-hand" />
            <span class="hotkey">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

function HeroPower({ ctl }: { ctl: BattleController }) {
  const b = ctl.battle;
  const p = b.player(ctl.human);
  const pw = p.commander.power;
  const mode = useStore(ctl.state, (s) => s.mode.kind);
  if (!pw) return null;
  const can = ctl.canInput && b.canHeroPower(ctl.human).ok;
  return (
    <button class={`hero-power ${can ? 'ready' : 'disabled'} ${mode === 'power' ? 'on' : ''} ${p.powerUsed ? 'used' : ''}`} onClick={() => ctl.heroPower()} data-tip={`英雄技能【${pw.name}】（${pw.cost} 法力，每回合一次）：${pw.text}`}>
      <Icon name={pw.icon} />
      <span class="hp-cost">{pw.cost}</span>
      <span class="hp-name">{pw.name}</span>
    </button>
  );
}

function EndTurn({ ctl }: { ctl: BattleController }) {
  const b = ctl.battle;
  const busy = useStore(battleUi, (s) => s.busy);
  const mine = ctl.isHumanTurn;
  // glow when nothing useful left to do
  const idle = mine && !busy && b.unitsOf(ctl.human).every((u) => !b.canAct(u) || b.attackTargets(u).length === 0) && b.player(ctl.human).hand.every((c) => !b.canPlay(ctl.human, c).ok);
  return (
    <button class={`end-turn ${mine && !busy ? 'ready' : 'waiting'} ${idle ? 'pulse' : ''}`} onClick={() => ctl.endTurn()} data-tip="结束回合（空格）">
      <Icon name={UI_ICONS.endTurn} />
      <span>{mine ? (busy ? '结算中…' : '结束回合') : '敌方回合'}</span>
    </button>
  );
}

function CamControls({ ctl }: { ctl: BattleController }) {
  const threat = useStore(ctl.state, (s) => s.showThreat);
  const cam = ctl.stage.world.cam;
  return (
    <div class="cam-controls">
      <button class="btn icon" data-tip="向左旋转视角（Q）" onClick={() => cam.rotate(-1)}>
        <Icon name={UI_ICONS.rotateL} />
      </button>
      <button class="btn icon" data-tip="向右旋转视角（E）" onClick={() => cam.rotate(1)}>
        <Icon name={UI_ICONS.rotateR} />
      </button>
      <button class={`btn icon ${threat ? 'on' : ''}`} data-tip="显示所有敌人的威胁范围（T）" onClick={() => ctl.toggleThreat()}>
        <Icon name={UI_ICONS.threat} />
      </button>
    </div>
  );
}

// ======================================================================== log, dice readout

function CombatLog() {
  const log = useStore(battleUi, (s) => s.log);
  const show = useStore(battleUi, (s) => s.showLog);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <div class={`combat-log ${show ? '' : 'collapsed'}`}>
      <div class="cl-head" onClick={() => battleUi.set({ showLog: !show })}>
        <Icon name={UI_ICONS.log} /> 战斗记录 <span>{show ? '▾' : '▸'}</span>
      </div>
      {show && (
        <div class="cl-body" ref={ref}>
          {log.slice(-40).map((l) => (
            <div class={`cl-line t-${l.tone ?? 'info'}`} key={l.id}>
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function rollTitle(r: RollEvent): string {
  if (r.kind === 'attack') return '攻击检定';
  if (r.kind === 'save') return '豁免检定';
  return '技能检定';
}

function RollReadout() {
  const rv = useStore(battleUi, (s) => s.roll);
  if (!rv) return null;
  const r = rv.roll;
  const done = rv.phase === 'done';
  const flat = r.mods.reduce((a, m) => a + (m.value ?? 0), 0);
  return (
    <div class={`roll-readout ${done ? 'done' : ''} ${done ? (r.success ? 'ok' : 'fail') : ''} ${r.crit ? 'crit' : ''}`}>
      {r.d20.rolls.length > 0 && (
        <>
          <div class="rr-label">
            {rollTitle(r)} · {r.label}
          </div>
          <div class="rr-line">
            <span class="rr-d20">
              🎲 {done ? r.d20.nat : '…'}
              {r.d20.rolls.length > 1 && done && <small>（{r.d20.adv > 0 ? '优势' : '劣势'}：{r.d20.rolls.join(' / ')}）</small>}
            </span>
            <span class="rr-mod">{formatMod(flat)}</span>
            {r.bonusRolls.map((x) => (
              <span class="rr-mod">
                {x.label} {formatMod(x.value)}
              </span>
            ))}
            {done && (
              <span class="rr-total">
                = <b>{r.total}</b> vs {r.kind === 'attack' ? 'AC' : 'DC'} {r.target}
              </span>
            )}
          </div>
          {done && (
            <div class="rr-result">
              {r.d20.nat === 20 ? '大成功！' : r.fumble ? '大失败！' : r.success ? (r.kind === 'attack' ? '命中' : '成功') : r.kind === 'attack' ? '未命中' : '失败'}
              {r.crit && r.kind === 'attack' && ' · 暴击'}
              {r.karmic && <small class="karmic">业力骰</small>}
              {r.reroll && <small class="rerolled">已重掷</small>}
            </div>
          )}
        </>
      )}
      {rv.damage && (
        <div class="rr-dmg">
          {rv.damage.label}：{rv.damage.roll.dice.map((d) => d.v).join('+') || '0'}
          {rv.damage.roll.mod ? formatMod(rv.damage.roll.mod) : ''}
          {rv.damage.extra.map((e) => (
            <span>
              {' '}
              {e.label} {e.roll.total >= 0 ? '+' : ''}
              {e.roll.total}
            </span>
          ))}{' '}
          = <b>{rv.damage.total}</b>
        </div>
      )}
    </div>
  );
}

// ======================================================================== center overlays

function Banner() {
  const b = useStore(battleUi, (s) => s.banner);
  if (!b) return null;
  return (
    <div class={`banner tone-${b.tone ?? 'info'}`} key={b.id}>
      <div class="bn-text">{b.text}</div>
      {b.sub && <div class="bn-sub">{b.sub}</div>}
    </div>
  );
}

function PlayedCard() {
  const p = useStore(battleUi, (s) => s.played);
  if (!p) return null;
  return (
    <div class="played-card" key={p.id}>
      <CardView def={p.card} size={200} tilt={false} />
    </div>
  );
}

function RerollPrompt() {
  const r = useStore(battleUi, (s) => s.reroll);
  if (!r) return null;
  return (
    <div class="reroll-prompt">
      <div class="rp-title">
        <Icon name={UI_ICONS.fate} /> 检定失败 —— 命运可以改写
      </div>
      <div class="rp-body">
        {r.roll.label}：掷出 {r.roll.d20.nat}，总计 {r.roll.total}，需要 {r.roll.target}
      </div>
      <div class="rp-btns">
        <button class="btn gold" onClick={() => r.resolve(true)}>
          消耗 1 命运点重掷（剩 {r.fate}）
        </button>
        <button class="btn" onClick={() => r.resolve(false)}>
          接受结果
        </button>
      </div>
    </div>
  );
}

function CheckModal({ host }: { host: { current: HTMLDivElement | null } }) {
  const c = useStore(battleUi, (s) => s.check);
  const r = c?.roll;
  const flat = r ? r.mods.reduce((a, m) => a + (m.value ?? 0), 0) : 0;
  return (
    <div class={`check-modal ${c ? 'open' : ''}`} onClick={() => c?.phase === 'done' && c.resolve?.()}>
      <div class="cm-panel" onClick={(e) => e.stopPropagation()}>
        {r && (
          <>
            <div class="cm-title">{r.ability ? `${ABILITY_NAMES[r.ability]}检定` : '检定'}</div>
            <div class="cm-label">{r.label.replace(/ DC \d+$/, '')}</div>
            <div class="cm-dc">
              <span>难度</span>
              <b>{r.target}</b>
            </div>
          </>
        )}
        <div class="cm-dice" ref={host} />
        {r && (
          <div class="cm-mods">
            {r.mods.map((m) => (
              <span>
                {m.label} {formatMod(m.value ?? 0)}
              </span>
            ))}
            <span class="sum">合计 {formatMod(flat)}</span>
          </div>
        )}
        {c?.phase === 'ready' && c.human && (
          <button class="btn gold big roll-btn" onClick={() => c.resolve?.()}>
            <Icon name={UI_ICONS.dice} /> 掷骰
          </button>
        )}
        {c?.phase === 'done' && r && (
          <div class={`cm-result ${r.success ? 'ok' : 'fail'}`}>
            <div class="cm-total">
              {r.d20.nat} {formatMod(flat)} = <b>{r.total}</b>
            </div>
            <div class="cm-verdict">{r.d20.nat === 20 ? '大成功！' : r.fumble ? '大失败！' : r.success ? '成功' : '失败'}</div>
            {c.human && <small>点击任意处继续</small>}
          </div>
        )}
      </div>
    </div>
  );
}

export { SAVE_NAMES, KEYWORD_NAMES };
export type { Unit };
