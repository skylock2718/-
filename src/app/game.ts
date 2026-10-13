import type { BattleSetup } from '../core/battle';
import { audio } from '../audio/audio';
import { BattleController, type BattleResult } from './battleController';
import { hideBackdrop } from './backdrop';
import { getStage } from './stage';
import { loadSettings, saveSettings, Store, type Settings } from './store';

export type Screen = 'title' | 'heroSelect' | 'map' | 'battle' | 'reward' | 'shop' | 'rest' | 'event' | 'treasure' | 'levelup' | 'end' | 'skirmish' | 'deckbuilder' | 'codex';

export type Modal =
  | { kind: 'settings' }
  | {
      kind: 'deck';
      title?: string;
      sub?: string;
      pick?: 'upgrade' | 'remove' | 'transform' | 'duplicate' | 'replace' | 'view';
      onPick?: (iid: number) => void;
      onCancel?: () => void;
      cancelLabel?: string;
      filter?: (iid: number) => boolean;
      /** card about to enter the deck (replace mode) */
      incoming?: { id: string; up: boolean };
    }
  | { kind: 'relic'; id: string }
  | { kind: 'codex' }
  | { kind: 'help' }
  | { kind: 'confirm'; text: string; onYes: () => void; yes?: string; no?: string; extra?: { label: string; danger?: boolean; onClick: () => void } }
  | { kind: 'battleMenu' };

export interface AppState {
  screen: Screen;
  settings: Settings;
  modal: Modal | null;
  battle: BattleController | null;
  /** fade overlay during transitions */
  fading: boolean;
  toast: { id: number; text: string } | null;
}

export const app = new Store<AppState>({
  screen: 'title',
  settings: loadSettings(),
  modal: null,
  battle: null,
  fading: false,
  toast: null,
});

let toastId = 1;
export function toast(text: string): void {
  const id = toastId++;
  app.set({ toast: { id, text } });
  setTimeout(() => {
    if (app.get().toast?.id === id) app.set({ toast: null });
  }, 2300);
}

window.addEventListener('toast', (e) => toast((e as CustomEvent<string>).detail));
window.addEventListener('battle-menu', () => {
  if (app.get().screen === 'battle' && !app.get().modal) openModal({ kind: 'battleMenu' });
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.get().modal) {
    const m = app.get().modal;
    if (m?.kind === 'deck') m.onCancel?.();
    closeModal();
  }
});

export function updateSettings(patch: Partial<Settings>): void {
  const s = { ...app.get().settings, ...patch };
  saveSettings(s);
  app.set({ settings: s });
  audio.setVolumes(s.master, s.music, s.sfx);
  getStage()?.applySettings(s);
  app.get().battle?.updateSettings(s);
}

/** fade to black, swap screen, fade back */
export async function goto(screen: Screen, before?: () => void | Promise<void>): Promise<void> {
  app.set({ fading: true });
  await new Promise((r) => setTimeout(r, 320));
  await before?.();
  app.set({ screen, modal: null });
  await new Promise((r) => setTimeout(r, 60));
  app.set({ fading: false });
}

export function openModal(m: Modal): void {
  app.set({ modal: m });
}

export function closeModal(): void {
  app.set({ modal: null });
}

/** Start a battle scene. onEnd receives the result after the victory/defeat beat. */
export async function startBattle(setup: BattleSetup, humans: number[], onEnd: (r: BattleResult) => void, music: 'battle' | 'boss' = 'battle'): Promise<void> {
  const stage = getStage();
  if (!stage) {
    toast('3D 舞台不可用（需要 WebGL）');
    return;
  }
  await goto('battle', () => {
    hideBackdrop();
    app.get().battle?.dispose();
    const ctl = new BattleController(stage, setup, humans, app.get().settings, (r) => onEnd(r));
    app.set({ battle: ctl });
  });
  audio.music(music);
  const ctl = app.get().battle!;
  void ctl.start();
}

export function endBattleScene(): void {
  app.get().battle?.dispose();
  app.set({ battle: null });
}
