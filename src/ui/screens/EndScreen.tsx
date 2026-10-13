import { useEffect } from 'preact/hooks';
import { goto } from '../../app/game';
import { useStore } from '../../app/store';
import { audio } from '../../audio/audio';
import { heroById } from '../../data/heroes';
import { flow, rematch } from '../../run/flow';
import { MAX_ASCENSION, unlockedAscension } from '../../run/meta';
import { ACT_NAMES } from '../../run/run';
import { CardChip } from '../components/CardView';
import { Portrait, RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';

function fmtTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} 小时 ${m % 60} 分` : `${m} 分钟`;
}

export function EndScreen() {
  const ending = useStore(flow, (s) => s.ending);
  useEffect(() => {
    if (ending?.kind === 'run') audio.play(ending.win ? 'victory' : 'defeat');
  }, [ending]);
  if (!ending) {
    return (
      <div class="end-screen">
        <button class="btn" onClick={() => void goto('title')}>
          返回主菜单
        </button>
      </div>
    );
  }
  if (ending.kind === 'skirmish') {
    const winners = ending.players.filter((p) => p.team === ending.winnerTeam);
    return (
      <div class={`end-screen ${ending.won || !ending.hasHuman ? 'win' : 'lose'}`}>
        <div class="end-panel panel">
          <div class="end-banner title-font">{!ending.hasHuman ? '对战结束' : ending.won ? '胜利' : '败北'}</div>
          <div class="end-sub">
            {winners.length ? `${winners.map((w) => w.name).join('、')} 获胜` : '无人生还'} · {ending.rounds} 回合
          </div>
          <table class="sk-table">
            <thead>
              <tr>
                <th>指挥官</th>
                <th>伤害</th>
                <th>承伤</th>
                <th>击杀</th>
                <th>召唤</th>
                <th>暴击</th>
                <th>天然 20</th>
              </tr>
            </thead>
            <tbody>
              {ending.players.map((p) => (
                <tr class={p.team === ending.winnerTeam ? 'won' : ''}>
                  <td>
                    <span class="sk-dot" style={{ background: p.color }} />
                    {p.name}
                    {p.team === ending.winnerTeam && <Icon name={UI_ICONS.crown} class="sk-crown" />}
                  </td>
                  <td>{p.stats.dmgDealt}</td>
                  <td>{p.stats.dmgTaken}</td>
                  <td>{p.stats.kills}</td>
                  <td>{p.stats.summons}</td>
                  <td>{p.stats.crits}</td>
                  <td>{p.stats.nat20}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="end-btns">
            <button class="btn gold big" onClick={() => void rematch()}>
              <Icon name={UI_ICONS.dice} /> 再来一局
            </button>
            <button class="btn big" onClick={() => void goto('skirmish')}>
              修改对战设置
            </button>
            <button class="btn big" onClick={() => void goto('title')}>
              主菜单
            </button>
          </div>
        </div>
      </div>
    );
  }
  const { record, win, run } = ending;
  const h = heroById(ending.heroId);
  const s = record.stats;
  const unlocked = unlockedAscension(h.id);
  const newUnlock = win && record.ascension + 1 === unlocked && unlocked <= MAX_ASCENSION;
  const stat = (label: string, v: string | number) => (
    <div class="es-stat">
      <span>{label}</span>
      <b>{v}</b>
    </div>
  );
  return (
    <div class={`end-screen ${win ? 'win' : 'lose'}`}>
      <div class="end-panel panel">
        <Portrait icon={h.icon} colors={h.colors} size={96} ring={win ? '#ffe08a' : '#ff4d5e'} class="end-portrait" />
        <div class="end-banner title-font">{win ? '天命已改写' : '远征终结'}</div>
        <div class="end-sub">
          {win
            ? `${h.name} 击败了骰主，夺回了天命之骰。`
            : `${h.name} 倒在了第 ${record.act} 幕「${ACT_NAMES[record.act] ?? ''}」${ending.killedBy ? `——${ending.killedBy}` : ''}。`}
        </div>
        {newUnlock && (
          <div class="end-unlock">
            <Icon name={UI_ICONS.star} /> 解锁 天命 {unlocked}
          </div>
        )}
        <div class="end-score">
          <span>得分</span>
          <b>{record.score}</b>
        </div>
        <div class="es-grid">
          {stat('等级', record.level)}
          {stat('走过层数', s.floors)}
          {stat('战斗', s.battles)}
          {stat('精英', s.elites)}
          {stat('首领', s.bosses)}
          {stat('击杀', s.kills)}
          {stat('造成伤害', s.dmgDealt)}
          {stat('承受伤害', s.dmgTaken)}
          {stat('暴击', s.crits)}
          {stat('天然 20', s.nat20)}
          {stat('天然 1', s.nat1)}
          {stat('检定 成/败', `${s.checksPassed}/${s.checksFailed}`)}
          {stat('获得金币', s.goldEarned)}
          {stat('用时', fmtTime(record.ms))}
        </div>
        <div class="end-relics">
          {run.relics.map((id) => (
            <RelicIcon id={id} size={32} />
          ))}
        </div>
        <div class="end-deck">
          {run.deck.map((c) => (
            <CardChip id={c.id} up={c.up} />
          ))}
        </div>
        <div class="end-btns">
          <button class="btn gold big" onClick={() => void goto('heroSelect')}>
            <Icon name={UI_ICONS.map} /> 新的远征
          </button>
          <button class="btn big" onClick={() => void goto('title')}>
            主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
