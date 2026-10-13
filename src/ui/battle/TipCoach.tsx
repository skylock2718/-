import { useState } from 'preact/hooks';
import type { BattleController } from '../../app/battleController';
import { battleTick } from '../../app/battleUi';
import { app, updateSettings } from '../../app/game';
import { useStore, useTicker } from '../../app/store';
import { audio } from '../../audio/audio';
import { cardOf } from '../../core/registry';
import { Icon, UI_ICONS } from '../icons';

/**
 * Contextual coaching for new players: one short tip at a time, triggered by
 * what is happening on the board, each shown once (remembered locally).
 */

const KEY = 'dicebound.tipsSeen';

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(s: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export function resetTips(): void {
  saveSeen(new Set());
}

interface Tip {
  id: string;
  title: string;
  icon: string;
  text: string;
  when: (c: BattleController) => boolean;
}

function hasPlayableUnit(c: BattleController): boolean {
  const b = c.battle;
  return b.player(c.human).hand.some((h) => cardOf(h).type === 'unit' && b.canPlay(c.human, h).ok);
}

const TIPS: Tip[] = [
  {
    id: 'hero',
    title: '你的英雄',
    icon: UI_ICONS.crown,
    text: '蓝色底座的立牌是你的英雄。点击它，高亮的格子就是它能走到的地方，再点目标格子即可移动。英雄倒下，战斗就失败了。',
    when: (c) => c.battle.round === 1 && c.state.get().mode.kind === 'idle',
  },
  {
    id: 'summon',
    title: '召唤单位',
    icon: 'card-play',
    text: '点选下方发光的人物牌，再点击金色格子，就能在英雄身边召唤单位。左下角的蓝色水晶是你的法力，每回合上限 +1。',
    when: (c) => hasPlayableUnit(c) && c.state.get().mode.kind !== 'unit',
  },
  {
    id: 'attack',
    title: '掷骰攻击',
    icon: UI_ICONS.dice,
    text: '把鼠标移到敌人身上会显示命中率：d20 + 命中加值 ≥ 目标 AC 才算命中。从高处攻击 +2，两侧夹击获得优势。点击敌人即可攻击。',
    when: (c) => c.state.get().mode.kind === 'unit',
  },
  {
    id: 'nodes',
    title: '资源点',
    icon: 'crystal-growth',
    text: '发光的法力泉、命运神龛和召唤法阵都能占领：让单位停在上面，每回合都会带来收益。敌人也会来抢！',
    when: (c) => c.battle.round >= 2,
  },
  {
    id: 'fate',
    title: '命运点',
    icon: UI_ICONS.fate,
    text: '头像下方的金色骰子是命运点。关键的 d20 检定失败时，可以消耗 1 点命运重掷。',
    when: (c) => c.battle.round >= 2 && c.battle.player(c.human).fate > 0,
  },
  {
    id: 'end',
    title: '结束回合',
    icon: UI_ICONS.endTurn,
    text: '行动完毕后点击右下角「结束回合」（或按空格）。下回合法力回满，并抽 2 张牌。',
    when: (c) => c.battle.player(c.human).mana === 0 && c.state.get().mode.kind === 'idle',
  },
  {
    id: 'camera',
    title: '镜头与威胁',
    icon: UI_ICONS.threat,
    text: '拖动右键旋转、滚轮缩放、Q/E 转 90°。按 T 显示所有敌人的威胁范围，Tab 切换还能行动的单位。',
    when: (c) => c.battle.round >= 3,
  },
];

export function TipCoach({ ctl }: { ctl: BattleController }) {
  useTicker(battleTick);
  useStore(ctl.state, (s) => s.mode.kind);
  const enabled = useStore(app, (s) => s.settings.tips);
  const [seen, setSeen] = useState(loadSeen);
  if (!enabled || !ctl.canInput) return null;
  const tip = TIPS.find((t) => !seen.has(t.id) && t.when(ctl));
  if (!tip) return null;
  const dismiss = () => {
    audio.play('page');
    const next = new Set(seen);
    next.add(tip.id);
    saveSeen(next);
    setSeen(next);
  };
  return (
    <div class="tip-coach" key={tip.id}>
      <div class="tc-head">
        <Icon name={tip.icon} />
        <b>{tip.title}</b>
        <span class="tc-count">
          {TIPS.filter((t) => seen.has(t.id)).length + 1}/{TIPS.length}
        </span>
      </div>
      <p>{tip.text}</p>
      <div class="tc-btns">
        <button class="btn small gold" onClick={dismiss}>
          知道了
        </button>
        <button class="btn small" onClick={() => updateSettings({ tips: false })}>
          关闭提示
        </button>
      </div>
    </div>
  );
}
