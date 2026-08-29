# 单词翻译插件 v6.14 优化方案（分阶段）

> 基于 v6.13.1 源码（build/addon/）的全量代码审查结论制定。
> 行号以 6.13.1 为准，后续改动后可能漂移，以函数名为准。
> 执行约定：每个 Phase 独立提交（commit）、独立打 b 版 xpi 实测、`node build/_smoke.js` 必须通过后才进入下一阶段。
> 目标版本：6.14.0（b1、b2… 逐阶段递增；正式版走 release 流程）。
> 分支：`optimize/v6.14`（等指令后创建，所有 Phase 在该分支上进行，完成后合回 main）。

---

## 用户已定的边界（不要在执行中重新讨论）

- **不做**"按高亮色筛选单词本"（用户明确排除，高亮色保持纯手动标记用途）。
- **暂不做**（挂起清单，见文末）：预编译 exe 分发、轮询异步化、API Key 加密、完整 i18n、源码目录迁移。
- 所有 UI 文案保持中文硬编码（与现状一致）。

---

## Phase 0 — 分支与安全网（基建，纯增不改）

**目标**：建立回归测试底线与分支主线，先于任何业务代码修改。

**改动点**
1. 创建分支 `optimize/v6.14`。
2. 扩写 `build/_smoke.js` 为冒烟测试骨架：
   - vm 沙箱 stub（Zotero / Services / Components / ChromeUtils），按 bootstrap.js 的加载顺序依次加载 storage.js → config-schema.js → dict.js → addon.js；
   - 基线断言：四模块加载成功、`Zotero.WordTranslator` 导出、关键方法存在（`translate` / `_addWordForReader` / `_renderPaneBody` / `_bindHotkeyResetListener`）、`WordTranslatorConfig.normalize` 幂等（normalize(normalize(x)) === normalize(x)）；
   - 约定：`node build/_smoke.js` 退出码 0 即通过；后续每个修复 Phase 向其追加回归断言。
3. 仓库卫生：
   - `.gitignore` 重存为 UTF-8（当前是 GBK 乱码）；追加 `build/*.xpi`；
   - `build/addon/prefs.js` 中过期预置版本 `6.10.2`：grep 确认无读取方后删除该 pref；
   - 根目录 `update.json` 与 `build/addon/update.json` 双份：在两份文件头加注释说明"发布时需手工同步"。

**验收**：smoke 通过；分支存在；`git status` 不再显示 36 个 xpi。
**提交**：`chore: v6.14 优化分支基建（冒烟测试骨架 + 仓库卫生）`

---

## Phase 1 — 快捷键子系统：修复失效的状态重置监听（bug #1，风险最高，单独做）

**目标**：恢复 `_bindHotkeyResetListener`（addon.js:1555-1655）的设计语义。现状：`clear` 箭头函数在 1589 行被多余 `}` 提前闭合，后续代码引用未定义的 `reason` 抛 ReferenceError 被空 catch 吞掉 → blur/pagehide/deactivate 监听从未注册，但窗口已被标记 `__wordTranslatorHotkeyResetBound = true`，永不自愈（已用 vm 沙箱实证）。

**改动点**（仅 addon.js）
1. 重写 `clear` 函数体，按 1568-1572 注释的设计意图恢复语义分支：
   - `window blur` + main-window → 清状态（补回丢失的 `if (reason === "window blur" && isMainWindow) {` 包裹）；
   - `window deactivate` + main-window 且有进行中会话（mouseDown / selectionReady / popupContext）→ 保留会话；
   - `document hidden` + main-window → 清状态；
   - reader 内 blur 且有 pending 选区 → 保留；
   - 其余 → 清状态；
   - 每个分支只保留一次 `_clearSelectionTranslateState` + 一条 debugLog（删除 1583-1588、1606-1610 两处重复粘贴的语句）。
2. `__wordTranslatorHotkeyResetBound` 标记移到"监听注册成功"（`_hotkeyResetHandlers.set(win, relRecs)`）之后设置；失败路径不标记，允许下次重试。
3. 该函数外层 `catch (e) {}` → `catch (e) { Zotero.debug("[WordTranslator] reset-listener ERROR: " + e) }`（全库空 catch 治理统一放 Phase 4，此处只修本函数）。

**回归断言**（追加到 _smoke.js）
- fake window 调 `_bindHotkeyResetListener(win, "main-window")` → addEventListener 恰好 3 次（blur/pagehide/deactivate），`_hotkeyResetHandlers.size === 1`；
- `role="main-window"` 下模拟 blur → `_selectionTranslateSession` 被清；模拟 deactivate + 活跃会话 → 不被清。

**b 版实测场景**：① 划词翻译一次后不关面板，继续划第二个词（历史故障：首次触发后状态被清）；② Alt+Tab 切走再切回，直接划词（历史故障：修饰键残留）。
**风险**：状态机代码，是全方案行为回归风险最高的一处 → 独立成 Phase，单独打 b 版验证。

---

## Phase 2 — 翻译链路修复（bug #2 SSE / #5 pending / #6 Claude 提示词 / #7 全量重写）

**改动点**（仅 addon.js）
1. **SSE 流式解析**（~4930-4965）：
   - 抽纯函数 `_parseSSEChunk(buffer, chunk)` → `{ events, rest }`，带跨 chunk 行缓冲，换行用 `"\n"`（当前 `chunk.split("\\n")` 拆的是字面量反斜杠+n，必然解析失败）；
   - `translate()` 流式分支改用该函数；`[DONE]` 处理、`data: ` 前缀解析不变。
2. **Claude 适配器接入自定义提示词**（_translateClaude，4667-4693）：
   - 抽公共函数 `_buildPromptMessages(text)` → `{ system, user }`（依据 promptMode 的 split/combined 两模式），OpenAI 兼容路径与 Claude 路径共用；
   - Claude：split 模式 → `system` 顶层字段 + user 消息；combined 模式 → 全并入 user 消息（Anthropic 协议）。
3. **pending 状态布尔化**（bug #5）：
   - 常量化 `STATUS_TRANSLATING = "翻译中…"`、`STATUS_FAILED = "翻译失败"`，替换散落的 `"翻译中…" / "正在翻译…"`（2634/2650/2008 等）；
   - `_addWordForReader` 已存在卡片分支（2609-2648）改用 `existingCard.pending` 判断：`pending=true` → 重译；`translation === STATUS_FAILED` → **也走重译**（当前被当"已有译文"跳过）；有真实译文 → 维持"最近使用重排"行为；
   - `_renderCard` / `_updateTempEditArea` 的字符串依赖点同步改。
4. **`_persistWords` 局部化**（bug #7）：
   - 新增 `_persistWordsForItem(itemID)` 只调度单项防抖保存；add/delete/highlight/dictMode/sort 等业务调用点全部改为单项版；
   - 全量版保留给旧数据迁移（_loadWordsFromDisk）与 shutdown 双保险。

**回归断言**：`_buildPromptMessages` split/combined 两模式输出；`_parseSSEChunk` 跨包拼接（JSON 被劈成两段）；pending 分支用 stub translate 计数断言"失败卡重复划词会重译"。
**b 版实测**：DeepSeek/OpenAI 正常翻译；Claude 官方 API + 自定义提示词生效；故意断网制造"翻译失败"卡后重新划词 → 自动重译。

---

## Phase 2.5 — 临时编辑框流式上屏与尺寸修复（用户反馈追加，2026-08-29）

**背景**：用户指出流式输出（onChunk）的原始设计意图就是让临时编辑框随译文逐字长高，但该接线在历史迭代中丢失；且实测"第二次译文返回时文本框尺寸基本不再调整"。

**改动点**（addon.js）
1. **恢复流式接线**：`_translateWithTimeout(text, timeoutMs, onChunk)` 透传 onChunk；`_addWordForReader` 与 `_retryTranslationForCard` 在调用时传入回调 → 实时 `_updateTempEditArea(word, partial)`（每个 chunk 都触发重算尺寸）。OpenAI 兼容路径为真流式；适配器类 provider 与无 fetch 环境在拿到完整结果后一次性回调（`translate()` 末尾补 onChunk 契约，`streamed` 标记防双回调）。
2. **`translate()` 流式门控加保险**：流式分支额外要求 `typeof fetch === "function"`，否则自动回退非流式请求——避免主进程无 fetch 时划词翻译直接报错。
3. **`_resizeTempEditArea` 加固**：① `scrollHeight` 读到 0（弹窗隐藏/未渲染）时保持原高度不塌缩为单行；② 下一帧 rAF 校正由"只放大"改为"偏大偏小都校正"（容差 0.5px）；③ 流式时每次增量都触发重算，天然自我修复。

**回归断言**（_smoke.js S5）：流式端到端（fetch 桩返回真实 SSE 分包，onChunk 累积值 === 最终返回值）；无 fetch 回退非流式并单次回调。
**b 版实测**：划词后临时编辑框应随译文逐字变长（OpenAI 兼容 provider 最明显）；第二次及以后划词，译文返回时文本框高度必须跟随内容；断网失败卡重译后高度恢复。

---

## Phase 3 — 存储与生命周期（bug #3 孤儿文件 / #4 flushAll 语义）

**改动点**
1. **注册 Notifier observer**（bug #3）：
   - init 中 `Zotero.Notifier.registerObserver({ notify }, ["item"], "wordtranslator")`，id 存入 `this._notifierID`（让 shutdown 里现有 unregister 代码生效）；
   - 处理 `delete` 事件：对每个 id，若 `_itemWords.has(id)` → 删除 `words/<id>.json`、清理 `_itemWords` / `_wordBookViewState` / `_wordBookSearchTimers` 对应键；
   - 只处理 `delete`；`trash`（移入回收站）**故意不处理**——回收站恢复后单词本仍在，是合理行为（代码注释写明）；
   - 附件/父条目换算无需特殊处理：单词数据本来就按 pane id（父条目）存，删除附件 id 不会命中 `_itemWords` 的键，天然安全。
2. **flushAll 改为真 flush**（bug #4，storage.js:301-306）：
   - `saveWordsForItemDebounced` 把待写数据记入 `this._pendingSaves[key] = { itemID, list }`；
   - `flushAll()`：清定时器 → 逐条立即 `_writeFileAtomically` 落盘 → 清空 pending（名称与调用方语义从此一致，消除"调了 flushAll 却丢数据"的陷阱）；
   - `_flushAndPersistWords` 保留全量写作为 shutdown 双保险，但依赖 flushAll 兜住防抖窗口。
3. shutdown 顺序复核：flushAll（落盘）→ dict.flush() → 注销 observer / section / pane。

**回归断言**：vm 内断言防抖合并行为与 `_pendingSaves` 状态流转（真实文件 IO 由 b 版人工验证）。
**b 版实测**：删除一个有条目单词的条目 → words/ 下对应 json 消失；重启 Zotero 无报错。

---

## Phase 4 — 全库清理（纯减法，无行为变更）

**改动点**
1. 删除 7 个死方法（grep 实测全库仅定义无调用）：`_matchSelectionTranslateKey`、`_isSelectionHotkeyKeyUp`、`_inSelectionHotkeySession`、`_matchCustomHotkeyMods`、`_matchCustomHotkeyKey`、`_readTextFile`、`_clearAllWordsStore`。
2. bridge-hook.cs：删除 `-StartedFile` 参数与 `_startedFile` 相关逻辑（addon.js 从不传该参数）；exe 会在下次启动时重新编译，无兼容问题。
3. 未声明即用的实例属性集中到对象头部声明：`_lastAutoWord`、`_lastAutoTime`、`_lastHotkeyKey`、`_lastHotkeyTime`、`_lastPrefsRefresh`、`_lastPrefsMtime`、`_readerTabHandlers`、`_hotkeyToolbarHandler`、`_notifierID`、`_prefsPaneID` 等（逐个 grep 归位）。
4. 编辑残留清理：重复注释（2645-2646）、重复 debugLog（2681-2682）、"udpate"→"update" 等 typo。
5. 空 catch 治理（addon.js / storage.js / dict.js / preferences.js）：按"吞错必须有痕"原则——兜底路径改 `_debugLog(...)`；确实可忽略的加 `// intentionally ignored` 注释。不做大规模重构，只加日志。
6. `_debugLog` 降噪分级：`_debugLog(msg, level)`，`level === "trace"`（keydown/mousedown/popup 等高频触发类日志）仅在 debugLog 开启时输出到控制台；普通日志维持现状。

**验收**：`node --check` 全过；smoke 通过；grep 七个死方法名计数为 0。
**风险**：低。b 版重点回归快捷键与划词（Phase 4 涉及其文件区域最多）。

---

## Phase 5 — addon.js 模块拆分（纯移动，行为不变）

**目标**：把 5010 行单体拆为 5 个文件，为 Phase 6-8 的功能开发提供可读的落点。

**拆分方案**（保持"单一 WordTranslator 对象 + loadSubScript 注入"模式不变）
| 新文件 | 内容（按成员整体迁移） | 规模 |
|---|---|---|
| `content/scripts/hotkey.js` | 划词会话、快捷键匹配、reset 监听、`_selectionTranslate*` 全家 | ~1500 行 |
| `content/scripts/xbutton-bridge.js` | `_xbuttonBridge` 全家、Subprocess/编译/轮询 | ~700 行 |
| `content/scripts/wordbook-pane.js` | ItemPane section 注册、`_renderPaneBody`/`_renderCard`/CSS/分页搜索 | ~1100 行 |
| `content/scripts/translate.js` | `translate()`、16 家适配器、`_speakRegistry`/TTS | ~1100 行 |
| `addon.js`（保留） | 对象定义、init/shutdown、存储、更新检查、入口桥接 | ~700 行 |

**机制**：addon.js 先定义对象与核心成员；各模块文件形如
`var WordTranslatorModule_hotkey = { ...方法组... }; if (typeof WordTranslator !== "undefined") Object.assign(WordTranslator, WordTranslatorModule_hotkey);`
bootstrap.js 加载顺序：storage → config-schema → dict → **addon → hotkey → xbutton-bridge → wordbook-pane → translate**（addon.js 内不再直接调用 init，仍由 bootstrap 末尾 `Zotero.WordTranslator.init()` 触发——现状已如此）。
低风险原因：所有方法内部均为 `this.xxx` 引用，assign 到同一对象后 `this` 绑定不变；嵌套对象（`_speakRegistry`、`_translateAdapters`、`_wordBookSearchStrategies`）随所属模块整体迁移，不拆散。

**防回归硬校验**：拆分前用 smoke 记录 `Object.keys(WordTranslator).sort()` 快照，拆分后 diff 必须为空（防同名覆盖/漏迁）。
**降级预案**：若实测出现隐藏耦合导致行为差异且 24h 内无法定位 → 回退本 Phase，保持单文件，仅补分节注释；Phase 6-8 在单文件上继续（主线不卡死）。

---

## Phase 6 — 渲染性能：单词本局部重渲染

**改动点**（Phase 5 后落在 wordbook-pane.js）
1. `_renderPaneBody` 拆两层：
   - `_renderPaneChrome(doc, body, item)`：头部四行（标题/API/排序/字典行/搜索框/翻页控件）——仅条目切换或全局配置变更时重建；
   - `_renderCardList(doc, body, pageInfo)`：卡片列表区——搜索/翻页/增删/高亮/重译时只重绘这一层。
2. `_applyWordBookView` 改调 `_renderCardList`；搜索输入框不再被销毁 → 删除 `_onWordBookSearchTrigger` 里恢复焦点/光标的 hack（现 3525-3537）。
3. 对外接口不变：onRender / `_refreshItemPane(itemID, viewInfo)` 条目切换仍走全量；插件重载自愈路径（`_triggerPaneRefresh` → onRender）不动。
4. `_currentPaneContext`、`_panelUIDs`、`body._wtRefresh` 的重锚逻辑保持原语义。

**b 版实测**：搜索框连续输入不丢焦点；长列表（>50 词）翻页流畅度；插件重载/重开 PDF 后面板正常显示（自愈不回归）。

---

## Phase 7 — 功能 A：单词本导出 + 译文级缓存

**1. 导出（用户价值最高）**
- 入口：单词本头部新增"导出"按钮 → 菜单：CSV / Markdown / Anki tsv × 当前条目 / 全部条目合并；
- 数据组装：`_itemWords` + dict-cache（音标/词性/释义）+ 高亮色 + 条目标题；
- 格式：
  - CSV：`word,translation,phonetic,pos,meaning,highlight,item`（UTF-8 **带 BOM**，保证 Excel/WPS 中文不乱码）；
  - Markdown：按条目分节的无序列表；
  - Anki tsv：正面 = 单词，背面 = `译文<br>音标 词性.释义`（制表符分隔，可直接导入 Anki）；
- 保存路径：`Zotero.FilePicker`（Zotero 7 封装），默认文件名 `单词本-<条目标题>-<日期>.<ext>`；
- 实现：新函数 `_exportWordBook(itemIDOrNull, format)`，落在 wordbook-pane.js。

**2. 译文缓存**
- storage.js 新增 `translation-cache.json`：`word → { translation, ts }`，LRU 上限 2000（复用 dict-cache 的裁剪策略与落盘时机）；
- `_addWordForReader`：查缓存命中 → 直接填卡（不调 API，仍触发 `_enrichDict` 补词典行）；未命中 → 调 API 后写缓存；
- `_retryTranslationForCard`（卡片 ↻）**强制绕过缓存**重新请求——用户改提示词后靠 ↻ 刷新；
- 缓存 key 用小写化原词（与 dict.js `_norm` 一致）。

**b 版实测**：同一词在第二条文献添加瞬时显示；导出文件用 Excel 打开中文正常；↻ 后译文随新提示词更新。

---

## Phase 8 — 功能 B：{{context}} 上下文提示词 + TTS 配置化 + 离线例句兜底

**1. {{context}} 上下文（默认关）**
- DEFAULTS 加 `promptUseContext: false`；promptUser/promptGlobal 模板支持 `{{context}}` 占位符；
- 上下文获取：popup 事件时从 PDF iframe 的 selection range 提取选区前后各 ~120 字符作为素材（**仅作上下文，不作为触发依据**——getSelection 不可信的老结论只针对"触发文本"，这里取不到就传空串，不影响主流程）；
- `_buildPromptMessages(text, context)` 扩展（Phase 2 已抽出，顺路），Claude 路径同步；
- 偏好页提示词区加开关 + 说明文案；
- b 版验收：开启后划 `cell` / `plant` 等歧义词，译文应贴合所在句子。

**2. TTS API 配置化**
- DEFAULTS 加 `ttsApiModel: "tts-1"`、`ttsApiVoice: "alloy"`；normalize 回填；偏好页 TTS API 区两个输入框；
- `_speakRegistry.api` 与偏好页 `testTTSApi` 读取配置（当前两处硬编码 tts-1/alloy）。

**3. ecdict 离线例句兜底**
- dict.js：ecdict 命中且无例句时，**entry 先返回**（不阻塞首绘），随后异步拉 youdao `blng_sents_part` 例句，合并进 entry 并更新 dict-cache → 触发一次重渲染；
- 失败静默；断网时保持现状（无例句）。

---

## Phase 9 — 文档、声明与发布

1. README 增补三段声明：
   - **鼠标侧键桥接**：运行时经 PowerShell 编译 bridge-hook.exe，可能触发杀软提示（放行即可）；钩子为系统级，开启期间鼠标侧键在所有应用中由本插件接管；
   - **非官方接口**：Google / DeepLX 为逆向接口，随时可能失效（偏好页已有标注，README 同步）；
   - **界面语言**：当前仅中文。
2. 偏好页"保存目录"区加一句提示：`api-config.json` 含 API Key 明文，请勿把该文件分享给他人。
3. 定版 6.14.0：manifest.json 版本 → 根目录与 build/addon 两份 update.json 同步新增条目 → 正式版 release（按既有 release 命名规范）。
4. 合并 `optimize/v6.14` 回 main（等指令执行）。

---

## 挂起清单（本版不做，防止主线膨胀）

| 项 | 不做的理由 |
|---|---|
| 按高亮色筛选单词本 | 用户明确排除 |
| 预编译 exe 随包分发 | 待杀软误报实际发生在用户侧出现再评估 |
| 侧键轮询异步化 / worker | 现状开销可接受（文件通常不存在，仅 exists() 检查） |
| API Key 加密存储 | 行业常态，Phase 9 只加提示文案 |
| 完整 i18n | 工程量大收益低，README 声明"仅中文" |
| 源码目录 build/ 迁移 src/ | 牵动打包脚本与既有约定，收益低 |

---

## 执行纪律

1. 顺序执行 Phase 0 → 9，不跳步、不并行混线；每个 Phase 一个 commit，信息前缀 `fix:` / `refactor:` / `feat:` / `chore:`。
2. 每 Phase 结束：`node --check` × 全部 js + `node build/_smoke.js` + 打 b 版 xpi → 用户在 Zotero 实测通过后才进入下一 Phase。
3. Phase 5（拆分）有降级预案，Phase 1（状态机）与 Phase 6（渲染重构）是行为回归风险最高的两处，b 版必须人工验证清单里的场景。
4. 行号在后续 Phase 中会漂移，执行时以函数名/符号定位。
