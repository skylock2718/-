import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { goto, toast } from '../../app/game';
import { audio } from '../../audio/audio';
import { allCards, getCard } from '../../core/registry';
import type { CardType } from '../../core/types';
import { copyLimit, DECK_SIZE, deckLegal, presetsFor, validateDeck } from '../../data/decks';
import { HEROES, heroById } from '../../data/heroes';
import { loadDecks, saveDecks, type SavedDeck } from '../../run/meta';
import { CardView } from '../components/CardView';
import { Portrait } from '../components/Bits';
import { Icon } from '../icons';
import { RARITY_NAMES } from '../text';

const TYPES: { id: CardType | 'all'; name: string }[] = [
  { id: 'all', name: '全部' },
  { id: 'unit', name: '人物' },
  { id: 'spell', name: '法术' },
  { id: 'equip', name: '装备' },
  { id: 'terrain', name: '地形' },
];

export function DeckBuilder() {
  const [heroId, setHeroId] = useState('hero-paladin');
  const h = heroById(heroId);
  const [cards, setCards] = useState<string[]>(() => presetsFor(h.cls)[0]?.cards.slice() ?? []);
  const [name, setName] = useState('我的牌组');
  const [editing, setEditing] = useState<string | null>(null);
  const [type, setType] = useState<CardType | 'all'>('all');
  const [cost, setCost] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<SavedDeck[]>(() => loadDecks());

  const pool = useMemo(
    () =>
      allCards()
        .filter((c) => deckLegal(c, h.cls))
        .sort((a, b) => (a.pool === 'neutral' ? 1 : 0) - (b.pool === 'neutral' ? 1 : 0) || a.cost - b.cost || a.name.localeCompare(b.name)),
    [h.cls],
  );
  const shown = pool.filter(
    (c) =>
      (type === 'all' || c.type === type) &&
      (cost == null || (cost >= 6 ? c.cost >= 6 : c.cost === cost)) &&
      (!query || c.name.includes(query) || (c.text ?? '').includes(query)),
  );
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const problems = validateDeck(cards, h.cls);
  const curve = Array.from({ length: 8 }, (_, i) => cards.filter((id) => Math.min(7, getCard(id).cost) === i).length);
  const maxCurve = Math.max(1, ...curve);

  const add = (id: string) => {
    const def = getCard(id);
    if (cards.length >= DECK_SIZE) {
      audio.play('error');
      toast(`牌组最多 ${DECK_SIZE} 张`);
      return;
    }
    if ((counts.get(id) ?? 0) >= copyLimit(def)) {
      audio.play('error');
      toast(`【${def.name}】最多 ${copyLimit(def)} 张`);
      return;
    }
    audio.play('card');
    setCards([...cards, id]);
  };
  const remove = (id: string) => {
    const i = cards.lastIndexOf(id);
    if (i < 0) return;
    audio.play('page');
    setCards(cards.filter((_, j) => j !== i));
  };
  const switchHero = (id: string) => {
    if (id === heroId) return;
    const nh = heroById(id);
    setHeroId(id);
    setCards(presetsFor(nh.cls)[0]?.cards.slice() ?? []);
    setEditing(null);
    setName('我的牌组');
  };
  const save = () => {
    if (problems.length) {
      audio.play('error');
      toast(problems[0]);
      return;
    }
    const id = editing ?? `d${Date.now().toString(36)}`;
    const deck: SavedDeck = { id, name: name.trim() || '未命名牌组', heroId, cards: [...cards], updated: Date.now() };
    const next = [deck, ...saved.filter((d) => d.id !== id)];
    saveDecks(next);
    setSaved(next);
    setEditing(id);
    audio.play('buff');
    toast('牌组已保存，可以在自由对战中使用');
  };
  const del = (id: string) => {
    const next = saved.filter((d) => d.id !== id);
    saveDecks(next);
    setSaved(next);
    if (editing === id) setEditing(null);
  };
  const list = [...counts.entries()].map(([id, n]) => ({ def: getCard(id), n })).sort((a, b) => a.def.cost - b.def.cost || a.def.name.localeCompare(b.def.name));
  const mine = saved.filter((d) => d.heroId === heroId);
  return (
    <div class="deck-builder">
      <div class="hs-top">
        <button class="btn" onClick={() => void goto('title')}>
          <Icon name="return-arrow" /> 返回
        </button>
        <h2 class="title-font">牌组构筑</h2>
        <button class="btn" onClick={() => void goto('skirmish')}>
          前往自由对战 <Icon name="fast-forward-button" />
        </button>
      </div>
      <div class="db-heroes">
        {HEROES.map((x) => (
          <button class={`db-hero ${x.id === heroId ? 'on' : ''}`} style={{ '--hc': x.color } as JSX.CSSProperties} onClick={() => switchHero(x.id)}>
            <Portrait icon={x.icon} colors={x.colors} size={44} ring={x.id === heroId ? x.color : 'transparent'} />
            <span>
              <b>{x.name}</b>
              <small>{x.title}</small>
            </span>
          </button>
        ))}
      </div>
      <div class="db-body">
        <div class="db-pool panel">
          <div class="db-filters">
            <div class="seg">
              {TYPES.map((t) => (
                <button class={type === t.id ? 'on' : ''} onClick={() => setType(t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
            <div class="seg costs">
              <button class={cost == null ? 'on' : ''} onClick={() => setCost(null)}>
                全部
              </button>
              {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                <button class={cost === c ? 'on' : ''} onClick={() => setCost(cost === c ? null : c)}>
                  {c === 6 ? '6+' : c}
                </button>
              ))}
            </div>
            <input class="db-search" placeholder="搜索名称或描述" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
          </div>
          <div class="db-grid">
            {shown.map((c) => {
              const n = counts.get(c.id) ?? 0;
              const full = n >= copyLimit(c);
              return (
                <div class={`db-card ${n ? 'in' : ''}`}>
                  <CardView def={c} size={138} playable={!full && cards.length < DECK_SIZE} dim={full} onClick={() => add(c.id)} />
                  {n > 0 && (
                    <span class="db-count" onClick={() => remove(c.id)} data-tip="点击移出一张">
                      ×{n}
                    </span>
                  )}
                  <small class={`db-rarity r-${c.rarity}`}>{RARITY_NAMES[c.rarity]}</small>
                </div>
              );
            })}
            {!shown.length && <div class="dim">没有符合条件的卡牌</div>}
          </div>
        </div>
        <aside class="db-deck panel">
          <input class="db-name" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} maxLength={16} />
          <div class={`db-total ${cards.length === DECK_SIZE ? 'ok' : ''}`}>
            {cards.length} / {DECK_SIZE}
          </div>
          <div class="db-curve">
            {curve.map((n, i) => (
              <div class="dc-col" data-tip={`${i === 7 ? '7+' : i} 费：${n} 张`}>
                <i style={{ height: `${(n / maxCurve) * 100}%` }} />
                <small>{i === 7 ? '7+' : i}</small>
              </div>
            ))}
          </div>
          <div class="db-list">
            {list.map(({ def, n }) => (
              <button class={`db-line r-${def.rarity}`} onClick={() => remove(def.id)} style={{ '--c2': def.colors?.[1] ?? '#555' } as JSX.CSSProperties}>
                <span class="dl-cost">{def.cost}</span>
                <span class="dl-name">{def.name}</span>
                <span class="dl-n">×{n}</span>
              </button>
            ))}
            {!list.length && <div class="dim">点击左侧卡牌加入牌组</div>}
          </div>
          {problems.length > 0 && cards.length > 0 && <div class="db-problems">{problems[0]}</div>}
          <div class="db-actions">
            <button class="btn gold" onClick={save}>
              <Icon name="save" /> 保存
            </button>
            <button
              class="btn"
              onClick={() => {
                setCards([]);
                setEditing(null);
                setName('我的牌组');
              }}
            >
              清空
            </button>
          </div>
          <div class="db-presets">
            <h4>预组</h4>
            {presetsFor(h.cls).map((d) => (
              <button
                class="btn small"
                data-tip={d.text}
                onClick={() => {
                  setCards(d.cards.slice());
                  setEditing(null);
                  setName(`${d.name}（改）`);
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
          {mine.length > 0 && (
            <div class="db-presets">
              <h4>已保存</h4>
              {mine.map((d) => (
                <span class="db-saved">
                  <button
                    class={`btn small ${editing === d.id ? 'on' : ''}`}
                    onClick={() => {
                      setCards(d.cards.slice());
                      setEditing(d.id);
                      setName(d.name);
                    }}
                  >
                    {d.name}
                  </button>
                  <button class="btn small danger" data-tip="删除" onClick={() => del(d.id)}>
                    <Icon name="trash-can" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
