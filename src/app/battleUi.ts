import type { DiceRoll } from '../core/dice';
import type { CardDef, RollEvent } from '../core/types';
import { Store, Ticker } from './store';

export interface LogLine {
  id: number;
  text: string;
  tone?: string;
}

export interface RollView {
  id: number;
  roll: RollEvent;
  /** whose dice: player colour index */
  owner: number;
  phase: 'rolling' | 'done';
  damage?: { roll: DiceRoll; extra: { label: string; roll: DiceRoll }[]; label: string; total: number } | null;
}

export interface CheckView {
  roll: RollEvent;
  phase: 'ready' | 'rolling' | 'done';
  human: boolean;
  resolve: (() => void) | null;
}

export interface RerollView {
  roll: RollEvent;
  fate: number;
  resolve: (yes: boolean) => void;
}

export interface BannerView {
  id: number;
  text: string;
  sub?: string;
  tone?: string;
}

export interface PlayedCardView {
  id: number;
  card: CardDef;
  up: boolean;
  owner: number;
}

export interface BattleUiState {
  log: LogLine[];
  banner: BannerView | null;
  roll: RollView | null;
  check: CheckView | null;
  reroll: RerollView | null;
  played: PlayedCardView | null;
  busy: boolean;
  aiThinking: boolean;
  showLog: boolean;
}

export const battleUi = new Store<BattleUiState>({
  log: [],
  banner: null,
  roll: null,
  check: null,
  reroll: null,
  played: null,
  busy: false,
  aiThinking: false,
  showLog: true,
});

/** bumped whenever battle state that the HUD shows may have changed */
export const battleTick = new Ticker();

let lid = 1;
export function nextId(): number {
  return lid++;
}

export function resetBattleUi(): void {
  battleUi.set({ log: [], banner: null, roll: null, check: null, reroll: null, played: null, busy: false, aiThinking: false });
}
