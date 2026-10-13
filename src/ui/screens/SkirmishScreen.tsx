import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { goto } from '../../app/game';
import { audio } from '../../audio/audio';
import type { BiomeId } from '../../core/types';
import { PRESET_DECKS, presetsFor } from '../../data/decks';
import { HEROES, heroById } from '../../data/heroes';
import { flow, startSkirmish, type SkirmishConfig, type SkirmishMode, type SkirmishSide } from '../../run/flow';
import { loadDecks } from '../../run/meta';
import { TEAM_COLORS } from '../../run/setup';
import { Portrait } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';

const MODES: { id: SkirmishMode; name: string; text: string; n: number }[] = [
  { id: '1v1', name: '1 v 1', text: '经典对决', n: 2 },
  { id: 'ffa3', name: '三人混战', text: '各自为战，最后站着的人获胜', n: 3 },
  { id: 'ffa4', name: '四人混战', text: '四方乱斗，大地图', n: 4 },
  { id: '2v2', name: '2 v 2', text: '蓝绿 对 红黄（相邻出生点为队友）', n: 4 },
];

const BIOMES: { id: BiomeId; name: string }[] = [
  { id: 'verdant', name: '翡翠林地' },
  { id: 'ashen', name: '灰烬荒原' },
  { id: 'astral', name: '星穹尖塔' },
];

const AI_LEVELS = [
  { v: 0.35, name: 'AI · 简单' },
  { v: 0.65, name: 'AI · 普通' },
  { v: 0.9, name: 'AI · 困难' },
];

interface DeckOption {
  key: string;
  name: string;
  cards: string[];
}

function deckOptions(heroId: string): DeckOption[] {
  const h = heroById(heroId);
  const out: DeckOption[] = presetsFor(h.cls).map((d) => ({ key: d.id, name: `预组 · ${d.name}`, cards: d.cards }));
  for (const d of loadDecks().filter((x) => x.heroId === h.id && x.cards.length === 20)) out.push({ key: `custom-${d.id}`, name: `自定 · ${d.name}`, cards: d.cards });
  out.push({ key: 'starter', name: '初始牌组（12 张）', cards: h.starterDeck });
  return out;
}

function randomSide(ai: boolean, aiLevel: number): SkirmishSide {
  const h = HEROES[Math.floor(Math.random() * HEROES.length)];
  const d = deckOptions(h.id)[Math.floor(Math.random() * 2)];
  return { heroId: h.id, deck: d.cards, deckName: d.name, ai, aiLevel };
}

function defaultConfig(): SkirmishConfig {
  const me = deckOptions('hero-ranger')[0];
  return {
    mode: '1v1',
    biome: 'verdant',
    size: 9,
    sides: [{ heroId: 'hero-ranger', deck: me.cards, deckName: me.name, ai: false, aiLevel: 0.65 }, randomSide(true, 0.65)],
  };
}

export function SkirmishScreen() {
  const [cfg, setCfg] = useState<SkirmishConfig>(() => flow.get().skirmish ?? defaultConfig());
  const set = (patch: Partial<SkirmishConfig>) => setCfg({ ...cfg, ...patch });
  const setMode = (m: SkirmishMode) => {
    const n = MODES.find((x) => x.id === m)!.n;
    const sides = cfg.sides.slice(0, n);
    while (sides.length < n) sides.push(randomSide(true, 0.65));
    setCfg({ ...cfg, mode: m, sides, size: n > 2 ? Math.max(cfg.size, 11) : cfg.size });
  };
  const setSide = (i: number, patch: Partial<SkirmishSide>) => {
    const sides = cfg.sides.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setCfg({ ...cfg, sides });
  };
  const teamOf = (i: number) => (cfg.mode === '2v2' ? (i < 2 ? 0 : 1) : i);
  const humans = cfg.sides.filter((s) => !s.ai).length;
  return (
    <div class="skirmish-screen">
      <div class="hs-top">
        <button class="btn" onClick={() => void goto('title')}>
          <Icon name="return-arrow" /> 返回
        </button>
        <h2 class="title-font">自由对战</h2>
        <button class="btn" onClick={() => void goto('deckbuilder')}>
          <Icon name="card-random" /> 牌组构筑
        </button>
      </div>
      <div class="sk-body panel">
        <section class="sk-section">
          <h3>模式</h3>
          <div class="sk-modes">
            {MODES.map((m) => (
              <button class={`sk-mode ${cfg.mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
                <b>{m.name}</b>
                <small>{m.text}</small>
              </button>
            ))}
          </div>
        </section>
        <section class="sk-section sk-row">
          <div>
            <h3>战场</h3>
            <div class="seg">
              {BIOMES.map((b) => (
                <button class={cfg.biome === b.id ? 'on' : ''} onClick={() => set({ biome: b.id })}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3>地图大小</h3>
            <div class="seg">
              {[9, 11, 13].map((n) => (
                <button class={cfg.size === n ? 'on' : ''} onClick={() => set({ size: n })}>
                  {n}×{n}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section class="sk-section">
          <h3>参战者 {humans > 1 && <small class="dim">（多名玩家轮流在同一设备上操作）</small>}</h3>
          <div class="sk-sides">
            {cfg.sides.map((s, i) => {
              const h = heroById(s.heroId);
              const decks = deckOptions(s.heroId);
              const color = TEAM_COLORS[i % TEAM_COLORS.length];
              return (
                <div class="sk-side" style={{ '--team': color } as JSX.CSSProperties}>
                  <div class="sk-side-head">
                    <span class="sk-team">{cfg.mode === '2v2' ? `队伍 ${teamOf(i) + 1}` : `玩家 ${i + 1}`}</span>
                    <select
                      value={s.ai ? String(s.aiLevel) : 'human'}
                      onChange={(e) => {
                        const v = (e.target as HTMLSelectElement).value;
                        setSide(i, v === 'human' ? { ai: false } : { ai: true, aiLevel: Number(v) });
                      }}
                    >
                      <option value="human">玩家操作</option>
                      {AI_LEVELS.map((l) => (
                        <option value={String(l.v)}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div class="sk-heroes">
                    {HEROES.map((x) => (
                      <button
                        class={`sk-hero ${x.id === s.heroId ? 'on' : ''}`}
                        data-tip={`${x.name} · ${x.title}\n${x.role}`}
                        onClick={() => {
                          audio.play('click');
                          const d = deckOptions(x.id)[0];
                          setSide(i, { heroId: x.id, deck: d.cards, deckName: d.name });
                        }}
                      >
                        <Portrait icon={x.icon} colors={x.colors} size={40} ring={x.id === s.heroId ? color : 'transparent'} />
                      </button>
                    ))}
                  </div>
                  <div class="sk-hero-name">
                    <b>{h.name}</b> · {h.title}
                  </div>
                  <select
                    class="sk-deck"
                    value={decks.find((d) => d.name === s.deckName)?.key ?? decks[0].key}
                    onChange={(e) => {
                      const d = decks.find((x) => x.key === (e.target as HTMLSelectElement).value)!;
                      setSide(i, { deck: d.cards, deckName: d.name });
                    }}
                  >
                    {decks.map((d) => (
                      <option value={d.key}>{d.name}</option>
                    ))}
                  </select>
                  <small class="sk-deck-text">{PRESET_DECKS.find((d) => `预组 · ${d.name}` === s.deckName && d.hero === h.cls)?.text ?? `${s.deck.length} 张牌`}</small>
                </div>
              );
            })}
          </div>
        </section>
        <div class="sk-foot">
          <span class="dim">{humans === 0 ? '没有玩家参战：将以观战模式进行。' : humans > 1 ? '热座模式：轮到谁谁来操作。' : ''}</span>
          <button class="btn gold big" onClick={() => void startSkirmish(cfg)}>
            <Icon name={UI_ICONS.battle} /> 开战
          </button>
        </div>
      </div>
    </div>
  );
}
