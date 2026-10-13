import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { useStore } from '../../app/store';
import { audio } from '../../audio/audio';
import { getPassive } from '../../core/registry';
import { beginBattle, chooseNode, flow, pendingEncounter } from '../../run/flow';
import { ACT_NAMES, ACT_SUB, reachableNodes, type NodeKind, type RunNode } from '../../run/run';
import { Portrait } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';
import { RunHeader } from './RunHeader';
import { useViewport } from '../useViewport';

export const NODE_INFO: Record<NodeKind, { name: string; icon: string; color: string; desc: string }> = {
  battle: { name: '战斗', icon: UI_ICONS.battle, color: '#d8c8a4', desc: '普通遭遇战。胜利后获得金币、三选一卡牌，可能掉落药水。' },
  elite: { name: '精英', icon: UI_ICONS.elite, color: '#ff7a4a', desc: '强大的敌人。胜利必定获得一件遗物，卡牌奖励稀有度更高。' },
  event: { name: '事件', icon: UI_ICONS.event, color: '#8ad0ff', desc: '未知的遭遇：做出选择、进行属性检定，结果由骰子决定。' },
  shop: { name: '商店', icon: UI_ICONS.shop, color: '#ffd36a', desc: '购买卡牌、遗物与药水，或花钱移除一张牌。' },
  rest: { name: '篝火', icon: UI_ICONS.rest, color: '#ff9a3a', desc: '休息回复生命、锻造升级卡牌，或训练获得经验。' },
  treasure: { name: '宝藏', icon: UI_ICONS.treasure, color: '#ffe08a', desc: '一只宝箱：获得遗物与金币。' },
  boss: { name: '首领', icon: UI_ICONS.boss, color: '#ff3a5a', desc: '本幕的首领。击败它才能前往下一幕。' },
};

const ROW_H = 96;

function jitter(id: number, act: number, k: number): number {
  const x = Math.sin(id * 127.1 + act * 311.7 + k * 74.7) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

export function MapScreen() {
  useStore(flow, (s) => s.rev);
  const actIntro = useStore(flow, (s) => s.actIntro);
  const run = flow.get().run;
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<RunNode | null>(null);
  const vp = useViewport();

  useEffect(() => {
    if (!actIntro) return;
    audio.play('page');
    const t = setTimeout(() => flow.set({ actIntro: null }), 3200);
    return () => clearTimeout(t);
  }, [actIntro]);

  const map = run?.map;
  const rows = (map?.rows ?? 8) + 1;
  const height = rows * ROW_H + 80;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !run) return;
    const row = run.pos != null ? (run.map.nodes.find((n) => n.id === run.pos)?.row ?? 0) : -1;
    const y = height - 60 - (row + 1) * ROW_H - el.clientHeight * 0.55;
    el.scrollTop = Math.max(0, y);
  }, [run?.act, run?.pos]);

  if (!run || !map) return null;
  const reach = new Set(reachableNodes(run).map((n) => n.id));
  const enc = pendingEncounter(run);
  const width = Math.max(300, Math.min(640, vp.w - 24));
  const pos = (n: RunNode) => {
    if (n.kind === 'boss') return { x: width / 2, y: 70 };
    const x = ((n.col + 0.5) / map.cols) * (width - 60) + 30 + jitter(n.id, map.act, 1) * 34 * (width / 640);
    const y = height - 60 - n.row * ROW_H + jitter(n.id, map.act, 2) * 26;
    return { x, y };
  };
  const visitedPath = new Set<string>();
  // edges along the visited trail
  const visited = map.nodes.filter((n) => n.visited);
  for (const a of visited) for (const b of a.next) if (map.nodes[b]?.visited) visitedPath.add(`${a.id}-${b}`);
  const locked = run.entered != null || !!run.pending;
  return (
    <div class="run-screen map-screen">
      <RunHeader title="远征地图" />
      <div class="map-body">
        <div class="map-scroll" ref={scroller}>
          <div class="map-parchment" style={{ width: `${width}px`, height: `${height}px` }}>
            <div class="map-title title-font">{ACT_NAMES[run.act]}</div>
            <svg class="map-edges" width={width} height={height}>
              {map.nodes.map((n) =>
                n.next.map((id) => {
                  const m = map.nodes.find((x) => x.id === id);
                  if (!m) return null;
                  const a = pos(n);
                  const b = pos(m);
                  const done = visitedPath.has(`${n.id}-${id}`);
                  const live = run.pos === n.id && reach.has(id);
                  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class={`${done ? 'done' : ''} ${live ? 'live' : ''}`} />;
                }),
              )}
            </svg>
            {map.nodes.map((n) => {
              const p = pos(n);
              const info = NODE_INFO[n.kind];
              const canGo = reach.has(n.id) && !locked;
              const current = run.pos === n.id;
              const cls = ['map-node', `k-${n.kind}`, canGo ? 'reach' : '', n.visited ? 'visited' : '', current ? 'current' : ''].join(' ');
              return (
                <button
                  class={cls}
                  style={{ left: `${p.x}px`, top: `${p.y}px`, '--nc': info.color } as JSX.CSSProperties}
                  onClick={() => canGo && void chooseNode(n.id)}
                  onMouseEnter={() => {
                    setHover(n);
                    if (canGo) audio.play('hover');
                  }}
                  onMouseLeave={() => setHover(null)}
                  data-tip={`${info.name}\n${info.desc}`}
                >
                  <Icon name={info.icon} />
                  {n.visited && !current && <span class="mn-check" />}
                </button>
              );
            })}
          </div>
        </div>
        <aside class="map-legend panel">
          <h3 class="title-font">图例</h3>
          {(Object.keys(NODE_INFO) as NodeKind[]).map((k) => (
            <div class={`ml-row ${hover?.kind === k ? 'hl' : ''}`} style={{ '--nc': NODE_INFO[k].color } as JSX.CSSProperties}>
              <span class="ml-ic">
                <Icon name={NODE_INFO[k].icon} />
              </span>
              {NODE_INFO[k].name}
            </div>
          ))}
          <p class="ml-hint">从地图底部出发，沿路线向上前进。每一层只能选择与当前位置相连的节点。</p>
        </aside>
      </div>
      {actIntro && (
        <div class="act-intro" onClick={() => flow.set({ actIntro: null })}>
          <div class="ai-num">第 {['', '一', '二', '三'][actIntro] ?? actIntro} 幕</div>
          <div class="ai-name title-font">{ACT_NAMES[actIntro]}</div>
          <div class="ai-sub">{ACT_SUB[actIntro]}</div>
        </div>
      )}
      {enc && !actIntro && (
        <div class="modal-back">
          <div class={`encounter-card panel k-${enc.kind}`}>
            <div class="ec-kind">{enc.kind === 'boss' ? '首领战' : enc.kind === 'elite' ? '精英战' : '遭遇战'}</div>
            <Portrait icon={enc.commander.icon} colors={enc.commander.colors} size={110} ring={enc.kind === 'boss' ? '#ff3a5a' : enc.kind === 'elite' ? '#ff7a4a' : 'var(--gold)'} />
            <h2 class="title-font">{enc.name}</h2>
            <div class="ec-cmd">
              {enc.commander.name}
              {enc.commander.title ? ` · ${enc.commander.title}` : ''}
              <span>
                <Icon name={UI_ICONS.hp} /> {enc.commander.stats.hp}
              </span>
              <span>
                <Icon name={UI_ICONS.ac} /> {enc.commander.stats.ac}
              </span>
            </div>
            <p class="ec-intro">{enc.intro}</p>
            {(enc.traits ?? []).length > 0 && (
              <div class="ec-traits">
                {(enc.traits ?? []).map((t) => {
                  const p = getPassive(t);
                  return p ? (
                    <div class="ec-trait">
                      <Icon name={p.icon} />
                      <b>{p.name}</b>
                      <span>{p.text}</span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <button class="btn gold big" onClick={() => void beginBattle()}>
              <Icon name={UI_ICONS.dice} /> 掷先攻，开战！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
