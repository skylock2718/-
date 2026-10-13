import { useEffect, useState } from 'preact/hooks';
import { showBackdrop } from '../../app/backdrop';
import { goto, openModal } from '../../app/game';
import { audio } from '../../audio/audio';
import { loadMeta, loadRun } from '../../run/meta';
import { continueRun } from '../../run/flow';
import { ACT_NAMES } from '../../run/run';
import { heroById } from '../../data/heroes';
import { Icon, UI_ICONS } from '../icons';

export function TitleScreen() {
  const [saved] = useState(() => loadRun());
  const meta = loadMeta();
  useEffect(() => {
    showBackdrop('verdant');
    audio.music('title');
  }, []);
  const item = (label: string, sub: string, icon: string, onClick: () => void, primary = false) => (
    <button
      class={`title-item ${primary ? 'primary' : ''}`}
      onClick={() => {
        audio.play('click');
        onClick();
      }}
      onMouseEnter={() => audio.play('hover')}
    >
      <Icon name={icon} class="ti-icon" />
      <span class="ti-label">{label}</span>
      <small>{sub}</small>
    </button>
  );
  let savedLine = '';
  if (saved) {
    try {
      const h = heroById(saved.heroId);
      savedLine = `${h.name} · 第 ${saved.act} 幕「${ACT_NAMES[saved.act]}」· ${saved.hp}/${saved.maxHp} 生命`;
    } catch {
      savedLine = '';
    }
  }
  return (
    <div class="title-screen">
      <div class="title-logo">
        <div class="tl-die">
          <Icon name="dice-twenty-faces-twenty" />
        </div>
        <h1 class="title-font">命骰远征</h1>
        <div class="tl-en">DICEBOUND</div>
        <div class="tl-sub">跑团式卡牌战棋 · Roguelite Dice-Tactics Card Battler</div>
      </div>
      <nav class="title-menu">
        {saved && item('继续远征', savedLine, UI_ICONS.play, () => void continueRun(), true)}
        {item('新的远征', '选择英雄，踏上三幕远征', UI_ICONS.map, () => void goto('heroSelect'), !saved)}
        {item('自由对战', '1v1 · 三人/四人混战 · 2v2 · 本地多人', UI_ICONS.battle, () => void goto('skirmish'))}
        {item('牌组构筑', '为自由对战组建 20 张牌的牌组', 'card-random', () => void goto('deckbuilder'))}
        {item('卡牌图鉴', '卡牌 · 遗物 · 药水 · 关键词 · 规则', UI_ICONS.book, () => void goto('codex'))}
        <div class="title-row">
          <button class="btn" onClick={() => openModal({ kind: 'settings' })}>
            <Icon name={UI_ICONS.settings} /> 设置
          </button>
          <button class="btn" onClick={() => openModal({ kind: 'help' })}>
            <Icon name={UI_ICONS.question} /> 玩法说明
          </button>
        </div>
      </nav>
      <div class="title-foot">
        {meta.runs > 0 && (
          <span>
            远征 {meta.runs} 次 · 胜利 {meta.wins} 次 · 天然 20 ×{meta.nat20}
          </span>
        )}
        <span class="credits-link" onClick={() => openModal({ kind: 'help' })}>
          图标 game-icons.net (CC BY 3.0) · 字体 Ma Shan Zheng / Cinzel (OFL)
        </span>
      </div>
    </div>
  );
}
