import { useState } from 'preact/hooks';
import { useStore } from '../../app/store';
import { getPassive, getPotion } from '../../core/registry';
import { buyCard, buyPotion, buyRelic, buyRemoval, flow, leaveNode } from '../../run/flow';
import { removePrice } from '../../run/run';
import { CardView } from '../components/CardView';
import { Portrait, PotionIcon, RelicIcon } from '../components/Bits';
import { Icon, UI_ICONS } from '../icons';
import { RunHeader } from './RunHeader';

const QUIPS = [
  '「随便看看，摸坏了要赔哦。」',
  '「这些可都是从龙穴里捡回来的——呃，大部分是。」',
  '「金币在哪儿都好使，朋友。」',
  '「今天打折！……对你来说。」',
  '「别问来路，问就是祖传的。」',
];

export function ShopScreen() {
  useStore(flow, (s) => s.rev);
  const run = flow.get().run;
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);
  const shop = run?.shop;
  if (!run || !shop) return null;
  const price = (n: number, sold?: boolean) => (
    <div class={`price ${sold ? 'sold' : run.gold < n ? 'poor' : ''}`}>
      {sold ? (
        '已售出'
      ) : (
        <>
          <Icon name={UI_ICONS.gold} /> {n}
        </>
      )}
    </div>
  );
  const rp = removePrice(run);
  return (
    <div class="run-screen shop-screen">
      <RunHeader title="商店" />
      <div class="shop-body">
        <div class="shop-panel panel">
          <div class="shop-head">
            <Portrait icon="hooded-figure" colors={['#1a1206', '#7a5a22', '#ffe8b0']} size={74} />
            <div>
              <h2 class="title-font">流浪商人</h2>
              <p>{quip}</p>
            </div>
          </div>
          <section class="shop-cards">
            {shop.cards.map((c, i) => (
              <div class={`shop-item ${c.sold ? 'sold' : ''}`}>
                <CardView id={c.id} up={c.up} size={150} playable={!c.sold && run.gold >= c.price} dim={c.sold} onClick={() => !c.sold && void buyCard(i)} />
                {price(c.price, c.sold)}
              </div>
            ))}
          </section>
          <div class="shop-lower">
            <section class="shop-relics">
              <h3 class="title-font">遗物</h3>
              <div class="sr-row">
                {shop.relics.map((r, i) => {
                  const def = getPassive(r.id)!;
                  return (
                    <button class={`shop-relic ${r.sold ? 'sold' : ''}`} disabled={r.sold} onClick={() => buyRelic(i)}>
                      <RelicIcon id={r.id} size={48} />
                      <b>{def.name}</b>
                      <small>{def.text}</small>
                      {price(r.price, r.sold)}
                    </button>
                  );
                })}
              </div>
            </section>
            <section class="shop-potions">
              <h3 class="title-font">药水</h3>
              <div class="sr-row">
                {shop.potions.map((p, i) => (
                  <button class={`shop-potion ${p.sold ? 'sold' : ''}`} disabled={p.sold} onClick={() => buyPotion(i)}>
                    <PotionIcon id={p.id} size={42} />
                    <b>{getPotion(p.id).name}</b>
                    {price(p.price, p.sold)}
                  </button>
                ))}
              </div>
            </section>
            <section class="shop-remove">
              <h3 class="title-font">服务</h3>
              <button class={`remove-service ${shop.removeUsed ? 'sold' : ''}`} disabled={shop.removeUsed} onClick={() => void buyRemoval()}>
                <span class="rs-ic">
                  <Icon name={UI_ICONS.remove} />
                </span>
                <b>移除一张牌</b>
                <small>精简牌组，让好牌更常出现</small>
                {price(rp, shop.removeUsed)}
              </button>
            </section>
          </div>
          <div class="shop-foot">
            <button class="btn big" onClick={() => void leaveNode()}>
              离开商店 <Icon name="fast-forward-button" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
