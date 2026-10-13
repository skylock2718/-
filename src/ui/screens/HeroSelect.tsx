import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { goto } from '../../app/game';
import { audio } from '../../audio/audio';
import { diceToString } from '../../core/dice';
import { ABILITY_NAMES } from '../../core/battle';
import { abilityMod, formatMod } from '../../core/dice';
import { getPassive } from '../../core/registry';
import type { Ability } from '../../core/types';
import { HEROES } from '../../data/heroes';
import { startNewRun } from '../../run/flow';
import { ASCENSION_TEXT, unlockedAscension } from '../../run/meta';
import { CardChip } from '../components/CardView';
import { Portrait, RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';

const ABILS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function HeroSelect() {
  const [idx, setIdx] = useState(0);
  const h = HEROES[idx];
  const maxAsc = unlockedAscension(h.id);
  const [asc, setAsc] = useState(0);
  const a = Math.min(asc, maxAsc);
  const relic = getPassive(h.starterRelic);
  const st = h.stats;
  return (
    <div class="hero-select" style={{ '--hc': h.color } as JSX.CSSProperties}>
      <div class="hs-top">
        <button class="btn" onClick={() => void goto('title')}>
          <Icon name="return-arrow" /> 返回
        </button>
        <h2 class="title-font">选择你的英雄</h2>
        <span />
      </div>
      <div class="hs-roster">
        {HEROES.map((x, i) => (
          <button
            class={`hs-hero ${i === idx ? 'on' : ''}`}
            style={{ '--hc': x.color } as JSX.CSSProperties}
            onClick={() => {
              audio.play('card');
              setIdx(i);
            }}
            onMouseEnter={() => audio.play('hover')}
          >
            <Portrait icon={x.icon} colors={x.colors} size={84} ring={x.color} />
            <b class="title-font">{x.name}</b>
            <small>{x.title}</small>
          </button>
        ))}
      </div>
      <div class="hs-detail panel" key={h.id}>
        <div class="hs-left">
          <Portrait icon={h.icon} colors={h.colors} size={168} ring={h.color} class="hs-big" />
          <h1 class="title-font">{h.name}</h1>
          <div class="hs-title">
            {h.title} · {h.role}
          </div>
          <p class="hs-desc">{h.desc}</p>
          <div class="hs-stats">
            <span data-tip="生命">
              <Icon name={UI_ICONS.hp} /> {st.hp}
            </span>
            <span data-tip="护甲等级 AC">
              <Icon name={UI_ICONS.ac} /> {st.ac}
            </span>
            <span data-tip={`命中 +${st.atk}，伤害 ${diceToString(st.dmg)}`}>
              <Icon name={UI_ICONS.atk} /> +{st.atk} · {diceToString(st.dmg)}
            </span>
            <span data-tip="移动">
              <Icon name={UI_ICONS.move} /> {st.move}
            </span>
            <span data-tip="射程">
              <Icon name={UI_ICONS.range} /> {st.range}
            </span>
          </div>
          <div class="hs-abils">
            {ABILS.map((k) => (
              <div class={`hs-ab ${h.castAbility === k ? 'cast' : ''}`} data-tip={h.castAbility === k ? `施法属性：法术 DC 与法术命中由它决定` : ABILITY_NAMES[k]}>
                <small>{ABILITY_NAMES[k]}</small>
                <b>{h.abilities[k]}</b>
                <i>{formatMod(abilityMod(h.abilities[k]))}</i>
              </div>
            ))}
          </div>
        </div>
        <div class="hs-right">
          <section>
            <h3>
              <Icon name={h.power?.icon ?? UI_ICONS.star} /> 英雄技能 · {h.power?.name} <em>{h.power?.cost} 法力</em>
            </h3>
            <p>{h.power?.text}</p>
          </section>
          <section>
            <h3>
              <Icon name="aura" /> 被动 · {h.passiveText.name}
            </h3>
            <p>{h.passiveText.text}</p>
          </section>
          {relic && (
            <section class="hs-relic">
              <h3>
                <RelicIcon id={relic.id} size={26} /> 初始遗物 · {relic.name}
              </h3>
              <p>{relic.text}</p>
            </section>
          )}
          <section>
            <h3>
              <Icon name="crossroad" /> 流派
            </h3>
            <div class="hs-styles">
              {h.styles.map((s) => (
                <div class="hs-style">
                  <b>{s.name}</b>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3>
              <Icon name={UI_ICONS.deck} /> 初始牌组（{h.starterDeck.length} 张，上限 20）
            </h3>
            <div class="hs-deck">
              {h.starterDeck.map((id) => (
                <CardChip id={id} />
              ))}
            </div>
          </section>
          <div class="hs-start">
            <div class="hs-asc">
              <span>天命等级</span>
              <div class="asc-pips">
                {Array.from({ length: maxAsc + 1 }, (_, i) => (
                  <button class={`asc-pip ${i === a ? 'on' : ''}`} onClick={() => setAsc(i)} data-tip={`天命 ${i}：${ASCENSION_TEXT.slice(1, i + 1).join(' ') || ASCENSION_TEXT[0]}`}>
                    {i}
                  </button>
                ))}
              </div>
              <small>{a === 0 ? ASCENSION_TEXT[0] : `叠加：${ASCENSION_TEXT.slice(1, a + 1).join(' ')}`}</small>
              {maxAsc === 0 && <small class="dim">以该英雄通关即可解锁更高的天命等级</small>}
            </div>
            <button class="btn gold big hs-go" onClick={() => void startNewRun(h.id, a)}>
              <Icon name={UI_ICONS.map} /> 踏上远征
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
