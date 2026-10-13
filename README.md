# 命骰远征 · DICEBOUND

> 跑团式卡牌战棋 · Roguelite Dice-Tactics Card Battler

在一张有高低差的 3D 微缩沙盘上，用 20 张牌召唤你的小队；每一次攻击、豁免、检定都由骰子决定。走过分支路线，拿遗物、学专长，直到推翻操纵命运的「骰主」。

- **骰子检定**：博德之门 3 式的 d20 检定——命中 vs AC、豁免 vs DC、优势/劣势、大成功/大失败、命运点重掷、业力骰，所有加值都透明地拆解给你看，并且有真正在桌面上滚动的 3D 多面骰。
- **卡牌召唤**：5 位英雄 × 每人 2 种以上流派，人物牌召唤单位上场，法术、装备与地形牌改变战局。牌组上限 20 张，必须取舍。
- **高低差与地形**：高处命中 +2、远程射程 +1、坠落与推撞伤害、悬崖遮挡视线；油与火爆燃、闪电沿水导电、寒冰冻结湖面。
- **资源点与事件点**：法力泉、命运神龛、召唤法阵、治愈泉，以及需要检定的宝箱、祭坛、符文石。
- **局内肉鸽成长**：杀戮尖塔式的三幕分支地图，战斗 / 精英 / 事件 / 商店 / 篝火 / 宝藏 / 首领；遗物、专长、药水、卡牌升级与移除；天命等级（进阶难度）。
- **自由对战**：1v1、三人/四人混战、2v2，可与 AI 对战、本地热座多人，或观看 AI 互殴；配套牌组构筑器。

## 快速开始

需要 Node.js 18+。

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 生成静态站点到 dist/
npm run preview  # 预览构建结果
npm test         # 单元测试（内容完整性、地图生成、AI 对战）
npm run sim      # AI 对 AI 平衡性模拟：npm run sim -- 10 a2-
```

构建产物是纯静态文件（`base: './'`），可以直接部署到 GitHub Pages、任意静态托管或本地打开。仓库内附带 GitHub Pages 工作流（`.github/workflows/pages.yml`）：在仓库设置中把 Pages 来源设为 *GitHub Actions* 即可。

## 怎么玩

| 操作 | 说明 |
| --- | --- |
| 左键 | 选择单位 / 卡牌，再点击目标格子执行 |
| 右键 / Esc | 取消；空闲时 Esc 打开菜单 |
| 拖动左键 / 右键 | 平移 / 旋转镜头，滚轮缩放 |
| Q / E | 镜头旋转 90° |
| 空格 | 结束回合 |
| Tab / H / T | 切换单位 / 选中英雄 / 显示敌方威胁范围 |
| 1 ~ 9 | 选择手牌 |

- 击败敌方英雄即胜利，你的英雄倒下即失败。
- 每回合法力上限 +1（最多 9），抽 2 张牌；每回合可以换 1 张牌、用 1 次英雄技能。
- 悬停在目标上可以看到命中率、伤害与全部加值。
- 游戏内「玩法说明」与「图鉴 → 规则」有完整规则。

## 项目结构

```
src/
  core/       规则引擎（与渲染无关，可无头运行）
    rng.ts dice.ts board.ts battle.ts ai.ts mapgen.ts registry.ts types.ts
  data/       内容：英雄、卡牌、遗物/专长、药水、遭遇、事件、预组
  run/        远征层：状态与地图生成、奖励/商店、存档与元进度、流程控制
  render/     three.js：沙盘、立牌单位、粒子与特效、3D 骰子、标题场景
  audio/      WebAudio 程序化音效与生成式音乐
  app/        战斗控制器（输入/AI/表现）、全局状态与场景切换
  ui/         Preact 界面：战斗 HUD、卡牌、各个界面与弹窗
scripts/      图标提取、字体子集化、平衡性模拟
docs/DESIGN.md  设计文档（参考游戏与机制拆解）
```

战斗引擎以事件流驱动（`await io.emit(event)`），表现层（3D、骰子、HUD）只负责把事件演出来；同一个引擎可以无头运行，用于 AI 模拟与单元测试。所有随机数都来自可序列化的种子 RNG，远征可以随时存档与继续。

## 素材与致谢

- 图标：[game-icons.net](https://game-icons.net)（Lorc、Delapouite 等作者），CC BY 3.0。构建时只提取用到的图标（`scripts/gen-icons.mjs`）。
- 标题字体：Ma Shan Zheng（马善政毛笔楷书），SIL Open Font License 1.1；仓库中只包含按游戏文本子集化后的字体（`scripts/subset-font.py`）。
- 数字字体：Cinzel，SIL Open Font License 1.1（@fontsource）。
- 引擎与界面：three.js、Preact（MIT）。
- 设计参考：博德之门 3、D&D 5e、Duelyst、Faeria、杀戮尖塔、陷阵之志、神界：原罪 2、最终幻想战略版、Dicey Dungeons、Balatro。详见 [docs/DESIGN.md](docs/DESIGN.md)。

其余代码、规则、卡牌与事件文本、3D 场景、特效与音频均为本项目原创。
