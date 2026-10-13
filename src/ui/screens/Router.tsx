import { useEffect } from 'preact/hooks';
import { showBackdrop } from '../../app/backdrop';
import type { Screen } from '../../app/game';
import type { BiomeId } from '../../core/types';
import { useStore } from '../../app/store';
import { audio, type Track } from '../../audio/audio';
import { flow } from '../../run/flow';
import { ACT_BIOME } from '../../run/run';
import { CodexScreen } from './Codex';
import { DeckBuilder } from './DeckBuilder';
import { EndScreen } from './EndScreen';
import { EventScreen } from './EventScreen';
import { HeroSelect } from './HeroSelect';
import { LevelUpScreen } from './LevelUpScreen';
import { MapScreen } from './MapScreen';
import { RestScreen } from './RestScreen';
import { RewardScreen } from './RewardScreen';
import { ShopScreen } from './ShopScreen';
import { SkirmishScreen } from './SkirmishScreen';
import { TreasureScreen } from './TreasureScreen';

const MUSIC: Partial<Record<Screen, Track>> = {
  heroSelect: 'title',
  skirmish: 'title',
  deckbuilder: 'title',
  codex: 'title',
  map: 'map',
  reward: 'map',
  shop: 'map',
  event: 'map',
  treasure: 'map',
  levelup: 'map',
  rest: 'camp',
  end: 'camp',
};

export function ScreenRouter({ screen }: { screen: Screen }) {
  const run = useStore(flow, (s) => s.run);
  const act = run?.act ?? 1;
  const inRun = screen === 'map' || screen === 'reward' || screen === 'shop' || screen === 'event' || screen === 'treasure' || screen === 'levelup' || screen === 'rest';
  useEffect(() => {
    if (inRun && run) showBackdrop((ACT_BIOME[act] || 'verdant') as BiomeId, [run.heroId]);
    else if (screen === 'end') showBackdrop('astral');
    else showBackdrop('verdant');
  }, [screen, act, inRun, run?.heroId]);
  useEffect(() => {
    const t = MUSIC[screen];
    if (t !== undefined) audio.music(t);
  }, [screen]);
  switch (screen) {
    case 'heroSelect':
      return <HeroSelect />;
    case 'map':
      return <MapScreen />;
    case 'reward':
      return <RewardScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'rest':
      return <RestScreen />;
    case 'event':
      return <EventScreen />;
    case 'treasure':
      return <TreasureScreen />;
    case 'levelup':
      return <LevelUpScreen />;
    case 'end':
      return <EndScreen />;
    case 'skirmish':
      return <SkirmishScreen />;
    case 'deckbuilder':
      return <DeckBuilder />;
    case 'codex':
      return <CodexScreen />;
    default:
      return null;
  }
}
