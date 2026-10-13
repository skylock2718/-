import { app, closeModal } from '../app/game';
import { useStore } from '../app/store';
import { BattleScreen } from './battle/BattleScreen';
import { TooltipLayer } from './components/Tooltip';
import { TitleScreen } from './screens/TitleScreen';
import { ScreenRouter } from './screens/Router';
import { ModalHost } from './screens/Modals';

export function App() {
  const screen = useStore(app, (s) => s.screen);
  const battle = useStore(app, (s) => s.battle);
  const fading = useStore(app, (s) => s.fading);
  const toast = useStore(app, (s) => s.toast);
  return (
    <>
      {screen === 'title' && <TitleScreen />}
      {screen === 'battle' && battle && <BattleScreen ctl={battle} />}
      {screen !== 'title' && screen !== 'battle' && <ScreenRouter screen={screen} />}
      <ModalHost />
      <TooltipLayer />
      {toast && (
        <div class="toast" key={toast.id} onClick={() => app.set({ toast: null })}>
          {toast.text}
        </div>
      )}
      <div class={`screen-fade ${fading ? 'on' : ''}`} />
    </>
  );
}

export { closeModal };
