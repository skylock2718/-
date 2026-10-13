import { render } from 'preact';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import './ui/styles/base.css';
import './ui/styles/card.css';
import './ui/styles/battle.css';
import './ui/styles/screens.css';
import { registerContent } from './data/index';
import { initStage } from './app/stage';
import { app } from './app/game';
import { audio } from './audio/audio';
import { App } from './ui/App';
import { flow } from './run/flow';

registerContent();

const worldHost = document.getElementById('world')!;
const uiHost = document.getElementById('ui')!;
const settings = app.get().settings;
audio.setVolumes(settings.master, settings.music, settings.sfx);

try {
  const stage = initStage(worldHost, settings);
  stage.applySettings(settings);
} catch (e) {
  console.error(e);
  worldHost.innerHTML = '<div class="no-webgl">你的浏览器不支持 WebGL，无法显示 3D 战场。请使用最新版 Chrome / Edge / Firefox / Safari。</div>';
}

render(<App />, uiHost);

// audio needs a user gesture
const unlock = () => {
  audio.init();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('done');
    setTimeout(() => boot.remove(), 700);
  }
});

// expose for debugging / automated tests
(window as unknown as { __app: typeof app; __flow: typeof flow }).__app = app;
(window as unknown as { __flow: typeof flow }).__flow = flow;
