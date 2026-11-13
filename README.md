# dsh-intelligent-ui

把 DSH 的回答从「一段文字」升级成「一个能用的小界面」——参照 ChatGPT 的 Intelligent UI，用 DSH 原生插件方式实现（**不改 DSH 本体**）。

模型不再只回 Markdown，而是回一棵**可交互的组件树**：地图、时间线、图片墙、表单、图表、本地计算器。用户点选、填表、拖滑块后，结果再流回对话。

> 参考实现：[thesysdev/open-intelligent-ui](https://github.com/thesysdev/open-intelligent-ui)（OpenUI 标准的开源复刻）。本项目沿用「万物皆插件」的思路，做成一个 DSH bundle。

---

## 它能做什么

| 类别 | 组件 |
|---|---|
| 布局 / 结构 | `heading`、`text`、`meta`（信息胶囊）、`table` |
| 视觉 | `map`（自带示意图，**不依赖外部地图瓦片**）、`timeline`、`gallery`、`chart`(bar/line/pie) |
| 交互（本地重算，不发请求） | `calculator`（滑块 → 公式实时计算）、`form` 内全部字段 |
| 交互（显式提交才回到 Agent） | `form` 的提交按钮 |

`form` 支持字段：`segmented`、`radioCards`、`select`、`checkbox`、`slider`、`time`、`text`、`textarea`。

---

## 安装

### 方式一：本地开发（推荐）

用 DSH 的插件管理工具安装本目录（绝对路径）：

```text
plugin_manager  action: install_bundle
target: D:\workspace\my\dsh-intelligent-ui
```

或命令行：

```bash
dsh plugin --profile desktop add link:D:\workspace\my\dsh-intelligent-ui
```

安装后刷新页面加载 Client 插件。`cordis.patch.yml` 只 `insert` 一行 Host 插件；Client 入口由 `package.json` 的 `dsh.client` 自动加载。开发验证使用专用 `test` profile：

```bash
dsh plugin --profile test add link:D:/workspace/my/dsh-intelligent-ui
dsh --profile test --no-open --port 49513
```

当前槽位接口已对照 DSH `0.2.2-rc.1` 验证。

### 方式二：发布到 npm 后

```bash
dsh plugin --profile desktop add dsh-intelligent-ui
```

### 卸载

```text
plugin_manager  action: remove_bundle  target: dsh-intelligent-ui
```

---

## 使用

直接对 Agent 说：

> 帮我规划北京中轴线一日游，用「智能界面」展示地图、时间线和照片，最后给我一个可以改偏好的表单。

模型会在合适的时候调用 `intelligent_ui` 工具，参数是一棵 `spec` 组件树，聊天里就会渲染成卡片。示例见 [`examples/beijing-route.json`](./examples/beijing-route.json)。

---

## 交互模型（已确认：方案 A）

- **纯本地交互**：滑块、筛选、表单取值、本地计算器 —— 全部在卡片内完成，**不调用模型、不发消息**，省 token、响应快。
- **显式提交**：只有点「提交 / 生成」时，卡片才把表单值按 `submitTemplate` 拼成一条自然语言请求，通过卡片自身会话范围内的 `inputActions.setDraft` 填进输入框，用户回车后才发回给 Agent。
  - 若当前环境取不到 `inputActions`，卡片会显示明确反馈、请求预览和“复制”按钮；只有主动点击复制才写入剪贴板。

---

## 安全与脱敏

### 1) 运行时文本掩码（附加能力）

`lib/sanitize.js` 用本地启发式正则匹配下列文本，命中后显示为 `***`。这是插件自身的实现，并非 GitHub Secret Scanning 的规则库或服务：

- GitHub token：`ghp_/gho_/ghu_/ghs_/ghr_`、`github_pat_`
- 云/厂商密钥：`AKIA…`、`xox*`、`AIza…`、`sk-…`、`sk-ant-…`
- 通用：JWT、`Bearer …`、URL 里的 `user:pass@`、`api_key/secret/token/password = …`、PEM 私钥
- 常见 PII：邮箱、手机号、身份证号、银行卡（**Luhn 校验通过**才掩）

渲染前（`sanitizeDeep`）和提交前（`redactString`）都会处理命中的文本。它不会清除原始工具参数或会话日志，也不能覆盖所有密钥格式。`client.js` 内维护浏览器使用的内联副本。用户要求的开发者姓名和提交邮箱脱敏见下一节。

### 2) 开发者身份脱敏（GitHub noreply 方式）

本仓库的开发身份已按 GitHub 隐私邮箱方式脱敏：

- `.trellis/.developer`：`name=Misaka10091`（不再使用真实姓名）
- `.trellis/workspace/`、`task.json` 的 creator/assignee 同步替换
- Git 提交身份（**仓库本地配置**）：

  ```bash
  git config user.name  "Misaka10091"
  git config user.email "27477663+Misaka10091@users.noreply.github.com"
  ```

> 换成你自己的 GitHub 隐私邮箱即可（GitHub → Settings → Emails → Keep my email addresses private，把 `<ID>+<username>@users.noreply.github.com` 填到 `user.email`）。

---

## 插件化边界：哪些能插件化，哪些必须改本体

| 需求 | 做法 | 是否改本体 |
|---|---|---|
| 注册 `intelligent_ui` 工具 | Host bundle `apply()` 里 `ctx.tools.register(defineTool())` | 否（插件） |
| 执行过程中的状态 | Client `tool.call.toolview` 键控 slot，展示简短状态 | 否（插件） |
| 回合完成后持续显示完整卡片 | Client `conversation.chat.turnTail`，读取宿主已经配对的成功工具结果 | 否（插件） |
| 主题 / 样式 | 只用 `--dsw-alias-*` 主题 token，自带样式表 | 否（插件） |
| 把提交填回输入框 | 回答卡片自身的会话范围 `inputActions.setDraft` | 否（插件） |
| locale / 图标 | `locale/*.json` + `icon.svg` | 否（插件） |
| 原生会话事件 / 核心渲染的契约变更 | 本次不需要；只有现有扩展点不足时才评估独立本体 patch | 本次无修改 |
| 新的派生数据 / Host Remote | 属于可扩展能力，需按宿主的注册协议接入；本次复用已有 Chat 数据，不增加服务 | 本次无需新增 |

结论：本插件 100% 通过 bundle patch + 受支持的 slot 完成，**没有修改 DSH 源码**。

---

## `spec` 结构速查

```jsonc
{
  "version": 1,
  "title": "…",
  "subtitle": "…",
  "meta": [{ "icon": "walk|clock|pin|ticket|info|star", "text": "…", "tone": "info|success|warning|danger" }],
  "blocks": [
    { "type": "heading", "title": "…", "subtitle": "…" },
    { "type": "text", "text": "段落用空行分隔" },
    { "type": "map", "markers": [{ "label": "…", "lat": 0, "lng": 0, "tone": "info" }], "route": [[0,0]] },
    { "type": "timeline", "items": [{ "time": "09:00", "title": "…", "desc": "…", "tag": "…" }] },
    { "type": "gallery", "items": [{ "src": "https://…", "title": "…", "caption": "…" }] },
    { "type": "table", "columns": ["A"], "rows": [["1"]], "caption": "…" },
    { "type": "chart", "kind": "bar|line|pie", "labels": ["Q1"], "series": [1] },
    { "type": "calculator", "label": "…", "min": 0, "max": 10, "step": 1, "value": 5, "unit": "…", "formula": "v * 0.75" },
    { "type": "form", "title": "…", "fields": [{ "type": "segmented", "name": "pace", "label": "节奏", "options": [{ "value": "a", "label": "A" }] }],
      "submitLabel": "提交", "submitTemplate": "节奏={{pace}}" }
  ]
}
```

`calculator.formula` 只允许 `v`、数字与 `+ - * / ( )`，由内置的**无 eval 解析器**计算。

---

## 开发与验证

```bash
node --check index.js
node --check client.js
npm test          # 客户端槽位、回合归属、提交回填、工具结果、规格与文本掩码回归
```

完整卡片属于回答内容，显示在每轮回答末尾；工具执行过程只保留简短状态。宿主将执行过程折叠后，卡片仍应可见。已有会话刷新后会从宿主 Chat 模型恢复卡片，无需再次调用模型；单纯的表单编辑仍是浏览器内状态，刷新会恢复规格中的初始值。

验收必须等回合完成，然后验证：

- 执行过程默认折叠时，完整卡片可见；展开、再折叠不会生成第二份完整卡片。
- 刷新页面、切换会话再返回，卡片仍能恢复。
- `element.checkVisibility({ contentVisibilityAuto: true })` 为真，祖先没有 `hidden` / `hidden="until-found"`；仅统计 DOM 数量不足以证明可见。
- 表单改值不发消息，显式提交只回填该会话的输入框，中文占位符正确替换。
- 控制台无 `slot entry crashed` 或插件异常。

## 许可

MIT
