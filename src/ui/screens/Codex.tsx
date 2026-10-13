import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { goto } from '../../app/game';
import { KEYWORD_NAMES, STATUS_NAMES } from '../../core/battle';
import { allCards, allPassives, allPotions } from '../../core/registry';
import type { Keyword, NodeKind, StatusId, SurfaceType, TerrainType } from '../../core/types';
import { CardView } from '../components/CardView';
import { PotionIcon, RelicIcon } from '../components/Bits';
import { Icon, NODE_DESC, NODE_ICON, NODE_NAME, STATUS_COLOR, STATUS_DESC, STATUS_ICON, SURFACE_DESC, SURFACE_NAME, TERRAIN_DESC, TERRAIN_NAME, KEYWORD_ICON } from '../icons';
import { KEYWORD_DESC, POOL_NAMES } from '../text';
import { RulesText } from './Rules';

type Tab = 'cards' | 'relics' | 'feats' | 'potions' | 'keywords' | 'status' | 'terrain' | 'rules';

const TABS: { id: Tab; name: string }[] = [
  { id: 'cards', name: '卡牌' },
  { id: 'relics', name: '遗物' },
  { id: 'feats', name: '专长' },
  { id: 'potions', name: '药水' },
  { id: 'keywords', name: '关键词' },
  { id: 'status', name: '状态' },
  { id: 'terrain', name: '地形与资源点' },
  { id: 'rules', name: '规则' },
];

const POOLS = ['paladin', 'ranger', 'wizard', 'rogue', 'necro', 'neutral', 'curse'];
const RARITY_ORDER: Record<string, number> = { starter: 0, common: 1, uncommon: 2, rare: 3, shop: 4, event: 5, boss: 6 };
const RARITY_LABEL: Record<string, string> = { starter: '初始', common: '普通', uncommon: '罕见', rare: '稀有', boss: '首领', shop: '商店', event: '事件' };

export function CodexView({ initial = 'cards' }: { initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);
  const [pool, setPool] = useState('paladin');
  const [up, setUp] = useState(false);
  return (
    <div class="codex">
      <div class="codex-tabs seg">
        {TABS.map((t) => (
          <button class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div class="codex-body">
        {tab === 'cards' && (
          <>
            <div class="codex-sub">
              <div class="seg">
                {POOLS.map((p) => (
                  <button class={pool === p ? 'on' : ''} onClick={() => setPool(p)}>
                    {POOL_NAMES[p]}
                  </button>
                ))}
              </div>
              <label class="check">
                <input type="checkbox" checked={up} onChange={(e) => setUp((e.target as HTMLInputElement).checked)} /> 显示升级版
              </label>
            </div>
            <div class="codex-cards">
              {allCards()
                .filter((c) => c.pool === pool)
                .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
                .map((c) => (
                  <CardView id={c.id} up={up && !!c.up} size={150} />
                ))}
            </div>
          </>
        )}
        {tab === 'relics' && (
          <div class="codex-list">
            {allPassives()
              .filter((p) => p.kind === 'relic')
              .sort((a, b) => (RARITY_ORDER[a.rarity ?? 'common'] ?? 9) - (RARITY_ORDER[b.rarity ?? 'common'] ?? 9))
              .map((r) => (
                <div class="codex-row">
                  <RelicIcon id={r.id} size={40} />
                  <div>
                    <b>
                      {r.name}
                      <em class={`rar r-${r.rarity}`}>
                        {RARITY_LABEL[r.rarity ?? 'common']}
                        {r.hero ? ` · ${POOL_NAMES[r.hero] ?? ''}专属` : ''}
                      </em>
                    </b>
                    <span>{r.text}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
        {tab === 'feats' && (
          <div class="codex-list">
            {allPassives()
              .filter((p) => p.kind === 'feat')
              .map((r) => (
                <div class="codex-row">
                  <RelicIcon id={r.id} size={40} />
                  <div>
                    <b>{r.name}</b>
                    <span>{r.text}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
        {tab === 'potions' && (
          <div class="codex-list">
            {allPotions().map((p) => (
              <div class="codex-row">
                <PotionIcon id={p.id} size={40} />
                <div>
                  <b>{p.name}</b>
                  <span>{p.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'keywords' && (
          <div class="codex-list two">
            {(Object.keys(KEYWORD_DESC) as Keyword[]).map((k) => (
              <div class="codex-row">
                <span class="cx-ic">
                  <Icon name={KEYWORD_ICON[k] ?? 'star-formation'} />
                </span>
                <div>
                  <b>{KEYWORD_NAMES[k]}</b>
                  <span>{KEYWORD_DESC[k]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'status' && (
          <div class="codex-list two">
            {(Object.keys(STATUS_DESC) as StatusId[]).map((k) => (
              <div class="codex-row">
                <span class="cx-ic" style={{ color: STATUS_COLOR[k] } as JSX.CSSProperties}>
                  <Icon name={STATUS_ICON[k]} />
                </span>
                <div>
                  <b>{STATUS_NAMES[k]}</b>
                  <span>{STATUS_DESC[k]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'terrain' && (
          <div class="codex-list two">
            {(Object.keys(TERRAIN_NAME) as TerrainType[]).map((k) => (
              <div class="codex-row">
                <span class={`cx-ic terrain t-${k}`} />
                <div>
                  <b>{TERRAIN_NAME[k]}</b>
                  <span>{TERRAIN_DESC[k]}</span>
                </div>
              </div>
            ))}
            {(Object.keys(SURFACE_NAME) as SurfaceType[]).map((k) => (
              <div class="codex-row">
                <span class={`cx-ic surface s-${k}`} />
                <div>
                  <b>{SURFACE_NAME[k]}</b>
                  <span>{SURFACE_DESC[k]}</span>
                </div>
              </div>
            ))}
            {(Object.keys(NODE_NAME) as NodeKind[]).map((k) => (
              <div class="codex-row">
                <span class="cx-ic node">
                  <Icon name={NODE_ICON[k]} />
                </span>
                <div>
                  <b>{NODE_NAME[k]}</b>
                  <span>{NODE_DESC[k]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'rules' && <RulesText />}
      </div>
    </div>
  );
}

export function CodexScreen() {
  return (
    <div class="codex-screen">
      <div class="hs-top">
        <button class="btn" onClick={() => void goto('title')}>
          <Icon name="return-arrow" /> 返回
        </button>
        <h2 class="title-font">图鉴</h2>
        <span />
      </div>
      <div class="panel codex-panel">
        <CodexView />
      </div>
    </div>
  );
}
