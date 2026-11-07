// 界面文案的唯一来源。改文案只改这里，改完运行 npm run check:words。
// 变量写成 {name} 的形式，由 fill() 或 t() 替换。

export const COPY = {
  app: {
    name: '共享和弦',
  },
  share: {
    title: '共享和弦 · 专属音乐邀请函',
  },
  login: {
    title: '共享和弦',
    subtitle: '一封写给你的音乐邀请函',
    agreePrefix: '我已阅读并同意',
    terms: '《用户协议》',
    and: '和',
    privacy: '《隐私保护指引》',
    button: '微信登录',
    needAgree: '请先阅读并勾选协议',
  },
  name: {
    title: '邀请函上怎么称呼你？',
    editTitle: '修改称呼',
    placeholder: '输入称呼，或使用微信昵称',
    hint: '最多 10 个字，只保存在你的手机上',
    submit: '下一步',
    save: '保存',
    errEmpty: '请填写称呼',
    errTooLong: '称呼最多 10 个字',
    errBadChar: '称呼只能包含中文、字母、数字、空格和“·”',
    errReserved: '这个称呼暂不可用，换一个吧',
    errReview: '这个称呼没有通过微信的内容检查，换一个吧',
  },
  draw: {
    title: '请抽取您的专属邀请函',
    button: '点击抽取',
    preparing: '正在准备你的邀请函…',
    rules: '规则说明',
    rulesBody: '免费参与，画面 {videos} 款、音乐 {audios} 首自由搭配或随机组合。首次随机抽取各组合机会相同；重新抽取会避开当前组合。本机只保存最新的一封，不涉及任何付费、奖励或兑换。',
    redrawNotice: '原来的邀请函款式已更新，请重新抽取',
  },
  select: {
    entry: '自己选一封',
    title: '挑一张童年入场券',
    subtitle: '四段旧时光，配上你想听的那首歌',
    backgrounds: '选择画面',
    audios: '选择音乐',
    confirm: '生成这封邀请函',
    random: '随机抽一封',
    change: '换一封邀请函',
    back: '返回我的邀请函',
    backToDraw: '回到小电视',
    posterError: '封面暂时无法加载，可继续选择',
    chooseError: '请选择有效的画面和音乐',
    door: '游乐园入口',
    swing: '童年秋千',
    carousel: '旋转木马',
    ferris: '黄昏摩天轮',
    track01: '音乐 01',
    track02: '音乐 02',
    track03: '音乐 03',
    track04: '音乐 04',
  },
  inv: {
    to: '致 {name}',
    release: '{date} 发行',
    tapToOpen: '轻触信封，打开邀请函',
    tapToClose: '轻触封皮收起',
    memoryLabel: '写给小时候的自己',
    loading: '正在拆开这封童年的来信…',
    loadingHint: '先看看这张来自旧时光的明信片',
    loadSlow: '画面还在路上，网络可能有点慢',
    buffering: '画面正在缓冲…',
    loadFail: '这封来信暂时没有打开',
    loadFailTip: '检查网络后重新试一次，或换一封',
    retry: '重新打开',
    aiNotice: '画面含 AI 生成内容',
    changeName: '修改称呼',
    legal: '协议与隐私',
  },
  legal: {
    title: '协议与隐私',
    termsTab: '用户协议',
    privacyTab: '隐私保护指引',
    updatedAt: '更新日期：{date}',
    openWechatPrivacy: '查看微信隐私保护指引',
    deleteData: '删除我的数据',
    deleteConfirm: '将删除保存在本机的称呼、同意记录和邀请函款式，删除后需要重新登录。',
    deleteDone: '已删除',
  },
  common: {
    ok: '知道了',
    cancel: '取消',
    confirm: '确定',
  },
  update: {
    title: '发现新版本',
    body: '新版本已准备好，重启后即可使用',
    restart: '重启',
  },
} as const

type Copy = typeof COPY

export type CopyKey = {
  [G in keyof Copy]: `${G & string}.${keyof Copy[G] & string}`
}[keyof Copy]

export type CopyVars = Record<string, string | number>

export function fill(template: string, vars: CopyVars = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match: string, key: string) => {
    const value = vars[key]
    if (value === undefined) throw new Error(`fill: missing variable "${key}" in "${template}"`)
    return String(value)
  })
}

export function t(key: CopyKey, vars?: CopyVars): string {
  const [group, item] = key.split('.') as [keyof Copy, string]
  const table: Record<string, string> = COPY[group]
  const template = table[item]
  if (template === undefined) throw new Error(`t: unknown key "${key}"`)
  return fill(template, vars)
}
