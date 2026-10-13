import type { BiomeId } from '../core/types';
import { HEROES } from '../data/heroes';
import { TitleScene } from '../render/titleScene';
import { TEAM_COLORS } from '../run/setup';
import { getStage } from './stage';

/**
 * The slowly turning diorama shown behind every menu screen. Screens ask for
 * a biome; the scene is only rebuilt when the biome (or hero line-up) changes.
 */

let scene: TitleScene | null = null;
let key = '';

export function showBackdrop(biome: BiomeId, heroIds?: string[], die = true): void {
  const stage = getStage();
  if (!stage) return;
  const ids = heroIds ?? HEROES.map((h) => h.id);
  const k = `${biome}|${ids.join(',')}|${die}`;
  if (scene && key === k) return;
  scene?.dispose();
  const heroes = ids
    .map((id) => HEROES.find((h) => h.id === id))
    .filter((h): h is (typeof HEROES)[number] => !!h)
    .map((h, i) => ({ icon: h.icon, colors: h.colors as [string, string, string], name: h.name, team: i === 0 && heroIds ? TEAM_COLORS[0] : h.color }));
  try {
    scene = new TitleScene(stage, biome, heroes, die);
    key = k;
    // the backdrop is decoration: a gentle frame rate keeps menus snappy and cool
    stage.world.fpsCap = 30;
  } catch (e) {
    console.error(e);
    scene = null;
    key = '';
  }
}

export function hideBackdrop(): void {
  const stage = getStage();
  if (stage) stage.world.fpsCap = 0;
  scene?.dispose();
  scene = null;
  key = '';
}
