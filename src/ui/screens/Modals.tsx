import { useState } from 'preact/hooks';
import { app, closeModal, openModal, toast, updateSettings, type Modal } from '../../app/game';
import { resetTips } from '../battle/TipCoach';
import { useStore, type Settings } from '../../app/store';
import { audio } from '../../audio/audio';
import { canUpgrade, cardOf, getCard } from '../../core/registry';
import type { CardInst } from '../../core/types';
import { battleContext, concede, flow, quitToTitle } from '../../run/flow';
import { CardView } from '../components/CardView';
import { RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';
import { CodexView } from './Codex';
import { RulesText } from './Rules';

export function ModalHost() {
  const m = useStore(app, (s) => s.modal);
  if (!m) return null;
  const cancel = () => {
    if (m.kind === 'deck') m.onCancel?.();
    closeModal();
  };
  return (
    <div class="modal-back" onClick={cancel}>
      <div class={`modal panel modal-${m.kind}`} onClick={(e) => e.stopPropagation()}>
        <button class="modal-x btn icon" onClick={cancel} data-tip="关闭">
          <Icon name={UI_ICONS.close} />
        </button>
        <ModalBody m={m} cancel={cancel} />
      </div>
    </div>
  );
}

function ModalBody({ m, cancel }: { m: Modal; cancel: () => void }) {
  switch (m.kind) {
    case 'settings':
      return <SettingsPanel />;
    case 'deck':
      return <DeckModal m={m} cancel={cancel} />;
    case 'codex':
      return (
        <>
          <h2>图鉴</h2>
          <CodexView />
        </>
      );
    case 'help':
      return <HelpPanel />;
    case 'confirm':
      return (
        <div class="confirm">
          {m.text.split('\n').map((l) => (
            <p>{l}</p>
          ))}
          <div class="confirm-btns">
            <button
              class="btn gold"
              onClick={() => {
                closeModal();
                m.onYes();
              }}
            >
              {m.yes ?? '确定'}
            </button>
            <button class="btn" onClick={closeModal}>
              {m.no ?? '取消'}
            </button>
            {m.extra && (
              <button
                class={`btn ${m.extra.danger ? 'danger' : ''}`}
                onClick={() => {
                  closeModal();
                  m.extra!.onClick();
                }}
              >
                {m.extra.label}
              </button>
            )}
          </div>
        </div>
      );
    case 'relic':
      return (
        <div class="confirm">
          <RelicIcon id={m.id} size={64} />
        </div>
      );
    case 'battleMenu':
      return <BattleMenu />;
  }
}

// ======================================================================== deck

const TYPE_ORDER: Record<string, number> = { unit: 0, spell: 1, equip: 2, terrain: 3, curse: 4 };

function DeckModal({ m, cancel }: { m: Extract<Modal, { kind: 'deck' }>; cancel: () => void }) {
  useStore(flow, (s) => s.rev);
  const [hover, setHover] = useState<number | null>(null);
  const run = flow.get().run;
  const deck: CardInst[] = run ? [...run.deck] : [];
  deck.sort((a, b) => {
    const da = getCard(a.id);
    const db = getCard(b.id);
    return (TYPE_ORDER[da.type] ?? 9) - (TYPE_ORDER[db.type] ?? 9) || da.cost - db.cost || da.name.localeCompare(db.name);
  });
  const picking = m.pick && m.pick !== 'view';
  const verb: Record<string, string> = { upgrade: '升级', remove: '移除', transform: '变化', duplicate: '复制', replace: '替换' };
  return (
    <div class="deck-modal">
      <h2>{m.title ?? '牌组'}</h2>
      {m.sub && <p class="dm-sub">{m.sub}</p>}
      {m.incoming && (
        <div class="dm-incoming">
          <span>新卡牌</span>
          <CardView id={m.incoming.id} up={m.incoming.up} size={150} tilt={false} />
        </div>
      )}
      <div class="dm-count">
        {deck.length} 张{run ? ` / 上限 ${run.deckCap}` : ''}
        {picking && <em>点击一张牌{verb[m.pick!] ?? '选择'}</em>}
      </div>
      <div class="dm-grid">
        {deck.map((c) => {
          const ok = !m.filter || m.filter(c.iid);
          const showUp = m.pick === 'upgrade' && hover === c.iid && canUpgrade(c);
          return (
            <div class={`dm-card ${picking ? (ok ? 'pickable' : 'blocked') : ''}`} onMouseEnter={() => setHover(c.iid)} onMouseLeave={() => setHover(null)}>
              <CardView
                def={showUp ? cardOf({ id: c.id, up: true }) : undefined}
                id={c.id}
                up={showUp || c.up}
                size={140}
                playable={!!picking && ok}
                dim={!!picking && !ok}
                onClick={() => {
                  if (!picking || !ok) return;
                  audio.play('card');
                  m.onPick?.(c.iid);
                }}
              />
              {showUp && <span class="dm-up-tag">升级后</span>}
            </div>
          );
        })}
      </div>
      {picking && (
        <div class="dm-foot">
          <button class="btn" onClick={cancel}>
            {m.cancelLabel ?? '取消'}
          </button>
        </div>
      )}
    </div>
  );
}

// ======================================================================== settings

function Slider({ label, k, min, max, step, fmt }: { label: string; k: keyof Settings; min: number; max: number; step: number; fmt?: (v: number) => string }) {
  const v = useStore(app, (s) => s.settings[k]) as number;
  return (
    <label class="set-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onInput={(e) => updateSettings({ [k]: Number((e.target as HTMLInputElement).value) } as Partial<Settings>)} />
      <b>{fmt ? fmt(v) : `${Math.round(v * 100)}%`}</b>
    </label>
  );
}

function Toggle({ label, k, tip }: { label: string; k: keyof Settings; tip?: string }) {
  const v = useStore(app, (s) => s.settings[k]) as boolean;
  return (
    <label class="set-row toggle" data-tip={tip}>
      <span>{label}</span>
      <button
        class={`switch ${v ? 'on' : ''}`}
        onClick={() => {
          audio.play('click');
          updateSettings({ [k]: !v } as Partial<Settings>);
        }}
      >
        <i />
      </button>
    </label>
  );
}

function SettingsPanel() {
  const q = useStore(app, (s) => s.settings.quality);
  return (
    <div class="settings">
      <h2>设置</h2>
      <div class="set-group">
        <h3>
          <Icon name={UI_ICONS.sound} /> 声音
        </h3>
        <Slider label="主音量" k="master" min={0} max={1} step={0.05} />
        <Slider label="音乐" k="music" min={0} max={1} step={0.05} />
        <Slider label="音效" k="sfx" min={0} max={1} step={0.05} />
      </div>
      <div class="set-group">
        <h3>
          <Icon name={UI_ICONS.dice} /> 骰子与节奏
        </h3>
        <Slider label="动画速度" k="animSpeed" min={0.5} max={3} step={0.25} fmt={(v) => `${v}×`} />
        <Slider label="掷骰速度" k="diceSpeed" min={0.5} max={3} step={0.25} fmt={(v) => `${v}×`} />
        <Toggle label="显示 3D 骰子" k="showDice" tip="关闭后只显示掷骰结果的数字" />
        <Toggle label="业力骰" k="karmic" tip="连续失败后提高下一次的成功率（博德之门 3 同款）。对新开始的战斗生效。" />
        <Toggle label="命运重掷提示" k="fatePrompt" tip="关键检定失败且有命运点时，询问是否重掷" />
      </div>
      <div class="set-group">
        <h3>
          <Icon name="cog" /> 画面
        </h3>
        <div class="set-row">
          <span>画质</span>
          <div class="seg">
            {(['low', 'medium', 'high'] as const).map((x) => (
              <button class={q === x ? 'on' : ''} onClick={() => updateSettings({ quality: x })}>
                {x === 'low' ? '流畅' : x === 'medium' ? '均衡' : '精美'}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="屏幕震动" k="shake" />
        <Toggle label="新手提示" k="tips" />
        <div class="set-row toggle">
          <span>重新显示所有提示</span>
          <button
            class="btn small"
            onClick={() => {
              resetTips();
              updateSettings({ tips: true });
              toast('新手提示已重置');
            }}
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================================================== help

function HelpPanel() {
  const [tab, setTab] = useState<'rules' | 'credits'>('rules');
  return (
    <div class="help">
      <h2>玩法说明</h2>
      <div class="seg center">
        <button class={tab === 'rules' ? 'on' : ''} onClick={() => setTab('rules')}>
          规则
        </button>
        <button class={tab === 'credits' ? 'on' : ''} onClick={() => setTab('credits')}>
          制作与致谢
        </button>
      </div>
      {tab === 'rules' ? (
        <RulesText />
      ) : (
        <div class="credits">
          <p>
            <b>命骰远征 · DICEBOUND</b> —— 跑团式卡牌战棋 Roguelite。程序、规则、卡牌、事件文本、3D 场景、骰子、粒子特效与程序化音乐/音效均为本项目原创。
          </p>
          <p>设计参考：博德之门 3、D&amp;D 5e、Duelyst、Faeria、杀戮尖塔、陷阵之志、神界：原罪 2、最终幻想战略版、Dicey Dungeons、Balatro。</p>
          <h3>素材授权</h3>
          <ul>
            <li>
              图标：<b>game-icons.net</b>（Lorc、Delapouite 等作者），以 CC BY 3.0 授权使用。
            </li>
            <li>
              标题字体：<b>Ma Shan Zheng（马善政毛笔楷书）</b>，SIL Open Font License 1.1。
            </li>
            <li>
              数字字体：<b>Cinzel</b>（Natanael Gama），SIL Open Font License 1.1。
            </li>
            <li>3D 引擎：three.js（MIT）；界面：Preact（MIT）。</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ======================================================================== battle menu

function BattleMenu() {
  const ctx = battleContext();
  return (
    <div class="battle-menu">
      <h2>暂停</h2>
      <button class="btn big gold" onClick={closeModal}>
        <Icon name={UI_ICONS.play} /> 继续战斗
      </button>
      <button class="btn big" onClick={() => openModal({ kind: 'settings' })}>
        <Icon name={UI_ICONS.settings} /> 设置
      </button>
      <button class="btn big" onClick={() => openModal({ kind: 'help' })}>
        <Icon name={UI_ICONS.question} /> 玩法说明
      </button>
      {ctx === 'run' && (
        <button class="btn big" onClick={() => void quitToTitle()} data-tip="远征会保存在进入这场战斗之前；下次继续时战斗将重新开始。">
          <Icon name={UI_ICONS.flee} /> 保存并返回主菜单
        </button>
      )}
      {ctx === 'skirmish' && (
        <button class="btn big" onClick={() => void quitToTitle()}>
          <Icon name={UI_ICONS.flee} /> 退出对战
        </button>
      )}
      {ctx && (
        <button
          class="btn big danger"
          onClick={() =>
            openModal({
              kind: 'confirm',
              text: ctx === 'run' ? '投降意味着这次远征失败。\n确定要投降吗？' : '确定要投降吗？',
              yes: '投降',
              no: '再想想',
              onYes: () => concede(),
            })
          }
        >
          <Icon name="truce" /> 投降
        </button>
      )}
    </div>
  );
}
