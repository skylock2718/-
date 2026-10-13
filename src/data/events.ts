import type { Ability } from '../core/types';

export interface Outcome {
  text: string;
  gold?: number;
  hp?: number;
  maxHp?: number;
  healPct?: number;
  cards?: { id: string; up?: boolean }[];
  randomCard?: 'any' | 'rare' | 'equip' | 'unit';
  cardChoice?: 'event' | 'rare';
  curse?: string[];
  relic?: string | 'random' | 'rare' | 'boss';
  potion?: string | number;
  upgradeRandom?: number;
  choose?: 'upgrade' | 'remove' | 'transform' | 'duplicate';
  removeCurse?: boolean;
  fight?: string;
  xp?: number;
  losePotion?: boolean;
}

export interface EventOption {
  label: string;
  hint?: string;
  check?: { ability?: Ability; dc: number };
  cost?: { gold?: number; hp?: number; potion?: boolean };
  requires?: { gold?: number; potion?: boolean; deckSpace?: boolean; curse?: boolean; act?: number[] };
  success: Outcome;
  fail?: Outcome;
  table?: { min: number; outcome: Outcome }[];
}

export interface EventDef {
  id: string;
  title: string;
  acts: number[];
  icon: string;
  colors: [string, string];
  text: string;
  options: EventOption[];
}

const LEAVE: EventOption = { label: '离开', hint: '什么也不发生', success: { text: '你决定不节外生枝，继续赶路。' } };

export const EVENTS: EventDef[] = [
  {
    id: 'ev-caravan',
    title: '陷入泥沼的商队',
    acts: [1, 2],
    icon: 'horse-head',
    colors: ['#2a1c0e', '#6a4a22'],
    text: '一辆满载货物的马车陷在泥里，车轮已经没进去一半。胖乎乎的商人急得满头大汗：「好心的旅人！帮帮我！哥布林随时会闻着味儿过来！」\n\n路边的灌木里，确实有几串新鲜的小脚印。',
    options: [
      { label: '帮忙把车推出来', check: { ability: 'str', dc: 12 }, hint: '金币', success: { text: '你肩膀一顶，马车「咕」地一声冲出泥坑。商人塞给你一袋沉甸甸的金币。', gold: 60 }, fail: { text: '你脚下一滑，扭伤了腰。马车最后还是推出来了，商人有些过意不去地给了你一点钱。', hp: -6, gold: 20 } },
      { label: '说服商人给你点好东西', check: { ability: 'cha', dc: 13 }, hint: '一张稀有卡牌', success: { text: '「好吧好吧，就当交个朋友！」他从货箱底层抽出一个油布包。', randomCard: 'rare' }, fail: { text: '商人眯起眼睛：「推车可以，敲竹杠不行。」他头也不回地走了。' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-idol',
    title: '低语的神像',
    acts: [1, 2, 3],
    icon: 'totem-head',
    colors: ['#1a1206', '#8a6a10'],
    text: '废弃的神龛上供着一尊金色的小神像。你靠近时，它发出只有你能听见的低语：「带我走……我会让你变得强大……」\n\n它说的「强大」，听起来不太像好事。',
    options: [
      { label: '拿走神像', hint: '获得遗物【诅咒神像】，牌组加入诅咒【厄运】', success: { text: '神像在你手心里微微发烫。你感到力量涌入手臂——以及某种冰冷的东西，悄悄缠上了你的运气。', relic: 'relic-cursedidol', curse: ['curse-misfortune'] } },
      { label: '尝试净化神像', check: { ability: 'wis', dc: 14 }, hint: '一件随机稀有遗物', success: { text: '你低声祷告，神像表面的金漆剥落，露出里面一件古老的护符。低语声消失了。', relic: 'rare' }, fail: { text: '神像尖叫起来，一股黑气钻进你的胸口。', hp: -5, curse: ['curse-misfortune'] } },
      LEAVE,
    ],
  },
  {
    id: 'ev-tavern',
    title: '独眼赌徒的酒馆',
    acts: [1, 2, 3],
    icon: 'rolling-dices',
    colors: ['#24080f', '#8a2234'],
    text: '酒馆角落里，一个独眼赌徒摇着骰盅：「新来的？玩一把？规则很简单——掷 d20，点数大于等于 11 就算你赢，翻倍奉还。」\n\n他的另一只眼睛藏在眼罩下，你总觉得那后面有什么在发光。',
    options: [
      { label: '下注 30 金币', requires: { gold: 30 }, cost: { gold: 30 }, check: { dc: 11 }, hint: '50%：赢回 60', success: { text: '骰子停在一个漂亮的数字上。赌徒啧了一声，推给你一摞金币。', gold: 60 }, fail: { text: '「手气不好啊，朋友。」他笑眯眯地把钱扫进口袋。' } },
      { label: '下注 75 金币，挑战高点数', requires: { gold: 75 }, cost: { gold: 75 }, check: { dc: 14 }, hint: '35%：赢回 200', success: { text: '全场安静了一瞬，随后爆发出欢呼。赌徒的笑容僵在脸上。', gold: 200 }, fail: { text: '骰子滚了两圈，停在一个小得可怜的数字上。' } },
      { label: '出老千', check: { ability: 'dex', dc: 15 }, hint: '获得 100 金币，失败挨揍', success: { text: '你的灌铅骰子完美地完成了任务。赌徒盯着你看了很久，最终还是付了钱。', gold: 100 }, fail: { text: '「骗子！」你被三个壮汉扔出了酒馆，钱袋也被摸走了一些。', hp: -8, gold: -20 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-knight',
    title: '迷途的骑士',
    acts: [1, 2],
    icon: 'black-knight-helm',
    colors: ['#14161c', '#4a5468'],
    text: '一名浑身是血的骑士靠在树下，盔甲上的纹章已经认不出来了。「我的队伍……都没了。」他咳嗽着，「求你……」',
    options: [
      { label: '把一瓶药水给他', requires: { potion: true }, cost: { potion: true }, hint: '获得人物牌【佣兵团长】', success: { text: '骑士喝下药水，脸色渐渐红润。他单膝跪地：「从今往后，我的剑为你而挥。」', cards: [{ id: 'neu-captain' }] } },
      { label: '为他包扎伤口', check: { ability: 'wis', dc: 12 }, hint: '获得强化的【佣兵剑士】与金币', success: { text: '伤口处理得很干净。骑士把剩下的盘缠分给你，并推荐了一位老战友。', cards: [{ id: 'neu-sellsword', up: true }], gold: 30 }, fail: { text: '你下手太重，骑士在剧痛中本能地挥了一拳。', hp: -4 } },
      { label: '扒走他的装备', hint: '获得一张随机装备牌，牌组加入诅咒【羞耻】', success: { text: '骑士没有反抗，只是用失望的眼神看着你。', randomCard: 'equip', curse: ['curse-shame'] } },
      LEAVE,
    ],
  },
  {
    id: 'ev-tower',
    title: '废弃的法师塔',
    acts: [1, 2, 3],
    icon: 'spell-book',
    colors: ['#0e1638', '#3f4bb0'],
    text: '塔顶的书桌上摊着一本魔法书，书页自己在翻动。字迹像活物一样蠕动，似乎在等待一个读得懂它的人。',
    options: [
      { label: '研读魔法书', check: { ability: 'int', dc: 15 }, hint: '随机升级 2 张牌', success: { text: '咒文在你脑海中展开。你对自己的战术有了新的理解。', upgradeRandom: 2 }, fail: { text: '书页猛地合上，一道奥术闪电把你轰出了窗外。', hp: -8 } },
      { label: '撕下几页带走', hint: '获得【灵感药剂】', success: { text: '这几页纸也许能派上用场。', potion: 'pot-elixir' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-spring',
    title: '月光之泉',
    acts: [1, 2, 3],
    icon: 'drink-me',
    colors: ['#06202a', '#2f8fb8'],
    text: '林间空地上有一汪泉水，在月光下闪着银光。泉边的石碑上刻着：「饮者得其所应得。」',
    options: [
      {
        label: '喝一口泉水（掷 d20 听天由命）',
        hint: '可能回复、增加生命上限、获得遗物……或者更糟',
        success: { text: '' },
        table: [
          { min: 1, outcome: { text: '泉水苦涩刺骨，你的身体一阵虚弱。', maxHp: -3 } },
          { min: 5, outcome: { text: '清凉的泉水洗去了疲惫。', hp: 15 } },
          { min: 12, outcome: { text: '泉水在你体内化作暖流，你感到前所未有的强壮。', maxHp: 5, hp: 5 } },
          { min: 18, outcome: { text: '泉底有东西在闪光——你捞起了一件遗物！', relic: 'random' } },
        ],
      },
      { label: '先观察水的颜色', check: { ability: 'wis', dc: 13 }, hint: '回复全部生命', success: { text: '你确认泉水无害，痛快地洗了个澡。所有伤口都愈合了。', healPct: 100 }, fail: { text: '你看了半天也没看出个所以然，决定还是别冒险了。' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-riddle',
    title: '哥布林谜语人',
    acts: [1],
    icon: 'goblin-head',
    colors: ['#121a06', '#5a7a22'],
    text: '一只戴着破礼帽的哥布林拦住去路，晃着一个钱袋：「回答我的谜语，钱袋归你！答错了……嘿嘿，你的钱袋归我！」\n\n「什么东西有二十张脸，却从不说话？」',
    options: [
      { label: '回答谜语', check: { ability: 'int', dc: 12 }, hint: '45 金币', success: { text: '「骰子！」哥布林气得把礼帽摔在地上，但还是交出了钱袋。', gold: 45 }, fail: { text: '「错！是二十个哑巴！」它抢了你一把金币，一溜烟跑了。', gold: -15 } },
      { label: '直接抢钱袋', check: { ability: 'str', dc: 14 }, hint: '70 金币，失败会引来战斗', success: { text: '哥布林被你拎了起来，乖乖交出了钱袋。', gold: 70 }, fail: { text: '它吹了声口哨，树丛里跳出一群同伙！', fight: 'a1-scouts' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-battlefield',
    title: '古战场',
    acts: [1, 2, 3],
    icon: 'crossed-bones',
    colors: ['#0c1012', '#46585e'],
    text: '锈蚀的刀剑插在土里，像一片金属的麦田。风穿过头盔的眼洞，发出呜呜的声音。这里埋葬着一支被遗忘的军队。',
    options: [
      { label: '搜寻有用的装备', check: { ability: 'wis', dc: 12 }, hint: '一张随机装备牌', success: { text: '在一具骸骨的怀里，你找到了一件保存完好的装备。', randomCard: 'equip' }, fail: { text: '你的动静惊醒了长眠的士兵……', fight: 'a2-undead' } },
      { label: '为亡者祈祷', hint: '回复 8 生命，移除一张诅咒，获得经验', success: { text: '风停了。你仿佛听见一声叹息，然后是长久的安宁。', hp: 8, removeCurse: true, xp: 1 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-smith',
    title: '流浪铁匠',
    acts: [1, 2, 3],
    icon: 'anvil',
    colors: ['#1c1408', '#7a5a2a'],
    text: '一个矮人铁匠推着装满工具的小车，炉火在车尾噼啪作响。「打磨武器，修补盔甲，童叟无欺！」',
    options: [
      { label: '支付 40 金币：升级一张牌', requires: { gold: 40 }, cost: { gold: 40 }, hint: '选择一张牌升级', success: { text: '铁锤叮叮当当，火星四溅。', choose: 'upgrade' } },
      { label: '支付 90 金币：大修', requires: { gold: 90 }, cost: { gold: 90 }, hint: '随机升级 2 张牌并获得一张装备牌', success: { text: '矮人干得满头大汗，最后还送了你一件小玩意儿。', upgradeRandom: 2, randomCard: 'equip' } },
      { label: '讨价还价', check: { ability: 'cha', dc: 14 }, hint: '免费升级一张牌', success: { text: '「行吧行吧，看你顺眼！」', choose: 'upgrade' }, fail: { text: '「没钱就别耽误我做生意。」' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-witch',
    title: '命运女巫',
    acts: [1, 2, 3],
    icon: 'witch-face',
    colors: ['#160828', '#7a32b0'],
    text: '帐篷里烟雾缭绕，老妇人的手指在水晶球上滑动：「我看见了你的牌……有一张，你并不需要。让我把它变成别的东西吧。」',
    options: [
      { label: '让她改变一张牌', hint: '移除一张牌，换成一张随机的职业牌', success: { text: '那张牌在她手中化作青烟，又重新凝聚成新的模样。', choose: 'transform' } },
      { label: '请她占卜命运', check: { ability: 'cha', dc: 13 }, hint: '一件遗物', success: { text: '「你的线很长，很亮。」她递给你一件信物。', relic: 'random' }, fail: { text: '水晶球裂开了一道缝。「……你不该来的。」', curse: ['curse-misfortune'] } },
      LEAVE,
    ],
  },
  {
    id: 'ev-wolf',
    title: '受伤的狼',
    acts: [1, 2],
    icon: 'wolf-head',
    colors: ['#1a1206', '#7a5228'],
    text: '一头灰狼的后腿被捕兽夹夹住了，它冲你龇牙低吼，但眼神里更多的是恐惧。',
    options: [
      { label: '安抚并解救它', check: { ability: 'wis', dc: 12 }, hint: '获得强化的人物牌【灰狼】', success: { text: '灰狼舔了舔你的手。从此，你的队伍里多了一个毛茸茸的伙伴。', cards: [{ id: 'rng-wolf', up: true }] }, fail: { text: '它狠狠咬了你一口，然后一瘸一拐地逃走了。', hp: -5 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-campfire',
    title: '篝火边的旅人',
    acts: [1, 2, 3],
    icon: 'campfire',
    colors: ['#2a1206', '#8a4a18'],
    text: '几个旅人围坐在篝火旁，招呼你过去烤烤火。有人在弹鲁特琴，有人在讲故事。',
    options: [
      { label: '安静地听他们讲故事', hint: '回复 10 生命，获得经验', success: { text: '火光温暖，故事动人。你睡了一个好觉。', hp: 10, xp: 1 } },
      { label: '讲一个你自己的冒险', check: { ability: 'cha', dc: 12 }, hint: '经验与金币', success: { text: '你讲得绘声绘色，旅人们听得入了迷，纷纷往你的帽子里丢钱。', xp: 2, gold: 30 }, fail: { text: '你讲到一半忘了结局，场面一度十分尴尬。' } },
    ],
  },
  {
    id: 'ev-messenger',
    title: '骰主的使者',
    acts: [2, 3],
    icon: 'card-joker',
    colors: ['#1a0c26', '#6a2aa0'],
    text: '一个戴着笑脸面具的人凭空出现：「我的主人欣赏你的勇气。他愿意给你一份礼物——当然，礼物总是有价格的。」',
    options: [
      { label: '接受交易', hint: '获得一件首领遗物，牌组加入【赌债】与【厄运】', success: { text: '面具人鞠了一躬，留下一个精致的盒子，和两张写满小字的契约。', relic: 'boss', curse: ['curse-debt', 'curse-misfortune'] } },
      { label: '识破他的诡计', check: { ability: 'wis', dc: 15 }, hint: '一件遗物与 50 金币', success: { text: '你看穿了契约里的陷阱条款。面具人尴尬地留下赔礼，消失了。', relic: 'random', gold: 50 }, fail: { text: '他的笑声在你脑子里回荡了好几天。', hp: -10 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-temple',
    title: '破败的神殿',
    acts: [1, 2, 3],
    icon: 'ancient-columns',
    colors: ['#2a2208', '#a08a4a'],
    text: '神殿的穹顶塌了一半，阳光照在积满灰尘的祭坛上。墙角有一个上锁的捐献箱。',
    options: [
      { label: '在祭坛前祈祷', check: { ability: 'wis', dc: 13 }, hint: '移除一张牌并回复 10 生命', success: { text: '一阵温暖的光包围了你，某个沉重的负担消失了。', choose: 'remove', hp: 10 }, fail: { text: '神明似乎在睡觉。' } },
      { label: '撬开捐献箱', check: { ability: 'dex', dc: 14 }, hint: '80 金币，但会背负【羞耻】', success: { text: '箱子里的钱比你想象的多。你的良心有点疼。', gold: 80, curse: ['curse-shame'] }, fail: { text: '箱子上有机关！一根毒针扎进了你的手指。', hp: -8 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-mirror',
    title: '无底之镜',
    acts: [2, 3],
    icon: 'magic-portal',
    colors: ['#06040e', '#3a1a66'],
    text: '一面没有边框的镜子悬浮在半空。镜中的你，手里拿着和你一样的牌——但它在冲你眨眼。',
    options: [
      { label: '触碰镜面', requires: { deckSpace: true }, hint: '复制一张牌', success: { text: '镜中人把一张牌递了出来。', choose: 'duplicate' } },
      { label: '打碎镜子', hint: '一件稀有遗物，牌组加入【厄运】', success: { text: '镜子碎成千万片。碎片中有一枚闪亮的东西——以及七年的霉运。', relic: 'rare', curse: ['curse-misfortune'] } },
      LEAVE,
    ],
  },
  {
    id: 'ev-lavabridge',
    title: '熔岩之桥',
    acts: [2],
    icon: 'volcano',
    colors: ['#2a0802', '#c2410c'],
    text: '唯一的石桥在三步之前断了，下面是翻滚的熔岩。对岸的岩缝里，似乎卡着一个背包。',
    options: [
      { label: '助跑跳过去', check: { ability: 'dex', dc: 13 }, hint: '金币与药水', success: { text: '你稳稳落地，顺手捡起了那个背包。', gold: 60, potion: 1 }, fail: { text: '你的脚后跟被熔岩燎了一下。', hp: -12 } },
      { label: '绕远路', hint: '失去 4 生命', success: { text: '热浪烤得你头晕眼花，但总算平安通过。', hp: -4 } },
    ],
  },
  {
    id: 'ev-firealtar',
    title: '余烬祭坛',
    acts: [2],
    icon: 'fire-shrine',
    colors: ['#2a0802', '#8a2a0c'],
    text: '黑曜石祭坛上燃着永不熄灭的火焰。火焰低语：「喂饱我。」',
    options: [
      { label: '献祭一张牌', hint: '移除一张牌，最大生命 +6', success: { text: '火焰吞下了那张牌，一股暖流注入你的四肢。', choose: 'remove', maxHp: 6, hp: 6 } },
      { label: '献上鲜血', hint: '失去 10 生命，随机升级 2 张牌', success: { text: '你的血滴在火中嘶嘶作响。你的武器似乎也被淬炼了。', hp: -10, upgradeRandom: 2 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-dragon',
    title: '沉睡的巨龙',
    acts: [2, 3],
    icon: 'dragon-head',
    colors: ['#2a1406', '#b8862a'],
    text: '洞穴深处，一头巨龙盘在金山上酣睡，每一次呼吸都让洞顶落下碎石。金币离你只有十步远。',
    options: [
      { label: '蹑手蹑脚地偷金币', check: { ability: 'dex', dc: 16 }, hint: '【龙之宝藏】（150 金币），失败会惊醒它', success: { text: '你屏住呼吸，装满了口袋，倒退着离开了洞穴。巨龙咂了咂嘴，翻了个身。', relic: 'relic-dragonhoard' }, fail: { text: '一枚金币从你口袋里滑落，「叮」——巨龙睁开了眼睛。', fight: 'a3-wyrm' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-chess',
    title: '骷髅棋手',
    acts: [1, 2, 3],
    icon: 'chess-knight',
    colors: ['#0c1012', '#46585e'],
    text: '一具骷髅坐在棋盘前，对面的椅子空着。它抬起一根指骨，示意你坐下。「赢了，我的宝贝归你。输了……你就留下来陪我。」',
    options: [
      { label: '和它下一盘', check: { ability: 'int', dc: 14 }, hint: '一件遗物', success: { text: '「将军。」骷髅的下巴掉了下来，它笑着把一件遗物推到你面前。', relic: 'random' }, fail: { text: '你输了。骷髅没有为难你，但你回过神时浑身冰冷、疲惫不堪。', hp: -6, curse: ['curse-exhaustion'] } },
      LEAVE,
    ],
  },
  {
    id: 'ev-rift',
    title: '星界裂隙',
    acts: [3],
    icon: 'vortex',
    colors: ['#06040e', '#5a2aa0'],
    text: '空间被撕开了一道口子，里面是旋转的群星。你能感觉到另一边有东西——很多东西。',
    options: [
      {
        label: '伸手进去（掷 d20）',
        hint: '看运气',
        success: { text: '' },
        table: [
          { min: 1, outcome: { text: '某种东西抓住了你的手腕，你拼命挣脱时被拖伤了。', hp: -8, curse: ['curse-misfortune'] } },
          { min: 6, outcome: { text: '你摸到了一个瓶子和几枚陌生的硬币。', potion: 1, gold: 40 } },
          { min: 16, outcome: { text: '你的指尖碰到了一件散发着星光的宝物。', relic: 'rare' } },
        ],
      },
      LEAVE,
    ],
  },
  {
    id: 'ev-cauldron',
    title: '无人看管的大锅',
    acts: [1, 2, 3],
    icon: 'cauldron',
    colors: ['#0c1a06', '#5c8a1c'],
    text: '女巫的小屋空无一人，大锅里的药剂咕嘟咕嘟冒着泡，旁边摆着一排瓶瓶罐罐和一本配方书。',
    options: [
      { label: '照着配方调药', check: { ability: 'int', dc: 13 }, hint: '获得 2 瓶随机药水', success: { text: '你调出了两瓶颜色漂亮的药剂。', potion: 2 }, fail: { text: '大锅「砰」地炸了，你满脸焦黑。', hp: -7 } },
      { label: '把整口锅搬走', hint: '获得遗物【女巫的酿造】（药水栏 +1）', success: { text: '锅很沉，但值得。', relic: 'relic-witchbrew' } },
      LEAVE,
    ],
  },
  {
    id: 'ev-training',
    title: '佣兵训练场',
    acts: [1, 2],
    icon: 'sword-brandish',
    colors: ['#14161c', '#5a6478'],
    text: '训练场上，一名独臂教官正在吼新兵。看到你，他咧嘴一笑：「来两手？」',
    options: [
      { label: '刻苦训练', hint: '失去 8 生命，获得大量经验', success: { text: '你练到浑身酸痛，但感觉自己脱胎换骨。', hp: -8, xp: 3 } },
      { label: '挑战教官', check: { ability: 'str', dc: 13 }, hint: '升级一张牌并获得 20 金币', success: { text: '教官揉着下巴大笑：「好小子！」他指点了你几招，还请你喝了酒。', choose: 'upgrade', gold: 20 }, fail: { text: '教官一只手就把你撂倒了。', hp: -10 } },
      LEAVE,
    ],
  },
  {
    id: 'ev-library',
    title: '被遗忘的图书馆',
    acts: [2, 3],
    icon: 'bookshelf',
    colors: ['#1a1206', '#6a4a2a'],
    text: '书架高到看不见顶。空气里漂浮着发光的字母，一本本书自己飞来飞去，像一群安静的鸟。',
    options: [
      { label: '随便翻翻', hint: '从 3 张牌中选择 1 张', success: { text: '有几本书主动落到了你的手里。', cardChoice: 'event' } },
      { label: '寻找禁书', check: { ability: 'int', dc: 15 }, hint: '从 3 张高稀有度牌中选择 1 张', success: { text: '你在最深处找到了一本被锁链缠着的书。', cardChoice: 'rare' }, fail: { text: '锁链缠住了你的影子。', curse: ['curse-misfortune'] } },
      LEAVE,
    ],
  },
  {
    id: 'ev-shrine',
    title: '路边的命运神龛',
    acts: [1, 2, 3],
    icon: 'dice-twenty-faces-twenty',
    colors: ['#241806', '#b8862a'],
    text: '路边的小神龛里供着一枚石刻的二十面骰。传说，向它献上金币的人会得到命运的眷顾。',
    options: [
      { label: '投入 25 金币', requires: { gold: 25 }, cost: { gold: 25 }, hint: '随机升级 1 张牌，获得经验', success: { text: '石骰微微发光。你觉得今天会是个好日子。', upgradeRandom: 1, xp: 1 } },
      { label: '拿走供品', check: { ability: 'dex', dc: 12 }, hint: '35 金币', success: { text: '没人看见。大概。', gold: 35 }, fail: { text: '石骰滚落下来，正好砸在你的脚上。', hp: -5, curse: ['curse-misfortune'] } },
      LEAVE,
    ],
  },
];

export function eventById(id: string): EventDef {
  return EVENTS.find((e) => e.id === id) ?? EVENTS[0];
}
