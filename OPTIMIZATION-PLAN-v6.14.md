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

## Phase 2.6 — 渲染 body 陈旧防护（用户报告的一次性 bug 追加，2026-08-29）

**现象**：划词后本地数据保存成功，但单词本不显示卡片；点刷新等重渲染按钮无反应；重启 Zotero 恢复；此后关开/重装插件均无法复现（时序竞态）。

**排查结论**：b2~b4 未改动渲染链路（git diff 核对，51 个 hunk 全在翻译/热键/存储函数）。症状与代码注释自认的已知问题吻合——"插件重载后旧 body 可能仍连接"（registerItemPaneSection.onInit 注释）。定位到两个机制：
- **机制 A（已修）**：`_refreshItemPane` 选渲染 body 时，信任 `_currentPaneContext.body`（仅判 isConnected）或取文档中**第一个** `.wordtranslator-pane-body`，都不校验是否为最新初始化的 body；上下文被旧 body 污染后，渲染与刷新全部写进不可见旧 body。
- **机制 B（待证据）**：重载竞态下新旧插件实例短暂并存，显示的 pane 属于旧实例（`_itemWords` 停留在旧状态）。无法从代码侧单方面排除，若复现需依赖日志。

**改动点**（addon.js）
1. `onInit` 记录 `this._latestPaneUID`（最新初始化 body 的 uid）；
2. 新增统一入口 `_resolvePaneBody(doc, contextBody)`：context body 最新 → 直接用；存在更新 uid 的连接 body → 切换并打日志；兜底取第一个连接 body；**多个 body 同时连接时一律输出诊断日志**（uid 列表），未来 issue 可据此一锤定音；
3. `_refreshItemPane` 改用该入口。

**回归断言**（_smoke.js S6）：陈旧 context 切换 / 最新保持 / 断连选最新 / 无 latest 回退 / 全不可用返回 null / 单 body 正常路径。

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

## Phase 3 — 存储与生命周期（bug #3 孤儿文件 / #4 flushAll 语义）— 已完成 2026-08-29

1. **Notifier observer**：init 中 `registerItemNotifier()` 注册 `["item"]` 观察者（id 存 `_notifierID`，shutdown 现有注销代码从此生效）；`delete`+`item` 事件逐 id 清理 `_itemWords` / `_wordBookViewState` / 搜索定时器 / `words/<id>.json`（空列表写入 = 删文件）。trash 故意不处理（回收站可恢复）；删除附件 id 不命中 pane id 键，天然安全。删除前先 `cancelPendingSave` 防止防抖定时器把已删文件写回。
2. **flushAll 真语义**（storage.js）：`saveWordsForItemDebounced` 把待写数据记入 `_pendingSaves`；`flushAll` 清定时器后逐条立即落盘并清空 pending；新增 `cancelPendingSave(itemID)`。
3. shutdown 顺序复核：`_flushAndPersistWords`（内部先 flushAll 真落盘 + 全量写双保险）→ dict.flush() → 注销 observer/section/pane——现有顺序即正确，未改动。

**回归断言**（_smoke.js S7/S7b）：防抖合并、窗口内不落盘、flushAll 真落盘并清空、到期自动落盘、cancelPendingSave 丢弃、空转安全；observer 注册捕获、delete 清理、trash 忽略、非 item 类型忽略、无关 id 忽略。真实文件 IO 由 b 版人工验证。

---

## Phase 4 — 全库清理（纯减法，无行为变更）— 已完成 2026-08-29

1. 删除死方法 **8 个**（计划 7 个 + 执行中发现的 `_hasFreshPendingSelection`）：`_matchSelectionTranslateKey`、`_isSelectionHotkeyKeyUp`、`_inSelectionHotkeySession`、`_matchCustomHotkeyMods`、`_matchCustomHotkeyKey`、`_readTextFile`、`_clearAllWordsStore`、`_hasFreshPendingSelection`；shutdown 中 `_hotkeyNotifierID` 死注销块删除。
2. bridge-hook.cs：`-StartedFile` 参数与 `_startedFile` 相关逻辑（声明/解析/写标记/删除）全部移除。
3. 未声明实例属性集中到对象头部声明：`_lastAutoWord/_lastAutoTime/_lastHotkeyKey/_lastHotkeyTime/_lastPrefsRefresh/_lastPrefsMtime/_readerTabHandlers/_hotkeyToolbarHandler/_notifierID/_prefsPaneID`。
4. 编辑残留清理："退耀"×2、"udpate"→"update"、`紓存` 重复注释头合并。
5. 空 catch 治理（最终决策）：shutdown 外层 catch 加日志（此处静默失败曾让死代码藏数十版本）；其余 123 处均为**单语句可选操作守卫**（预读/可选绑定/清理尝试），判定为有意为之保留——逐个加日志属纯噪音，详见 commit。
6. `_debugLog(msg, level)` 分级：`level === "trace"` 的高频路径（划词 popup ×4、全局 keydown/keyup、reader mousedown/mouseup ×2）仅在偏好页开启 debugLog 时输出，普通日志维持始终输出。

**验收**：node --check ×7 全过；smoke 74/74；死方法 grep 全为 0。

---

## Phase 5 — addon.js 模块拆分（纯移动，行为不变）— 已完成 2026-08-29

拆分以一次性解析脚本机械执行（按成员边界逐行归桶、行数守恒校验，拆后脚本已删）：
- **addon.js**（794 行）：core 65 成员——对象定义、init/shutdown、存储、更新检查、偏好桥接；
- **hotkey.js**（1443 行，43 成员）：划词会话、快捷键匹配、reset 监听、临时编辑框、`_addWordForReader`；
- **xbutton-bridge.js**（601 行，18 成员）：`_xbuttonBridge` 全家、Subprocess/编译/轮询；
- **wordbook-pane.js**（1319 行，57 成员）：ItemPane section、渲染、分页搜索、卡片操作；
- **translate.js**（912 行，34 成员）：16 家适配器、`translate`、TTS、词典兜底。

机制：各模块 `var WordTranslatorModule_X = {...}; Object.assign(WordTranslator, ...)`，bootstrap/smoke 在 addon.js 之后加载（hotkey → bridge → pane → translate），`this` 绑定不变。
**硬校验**：拆分前导出 217 成员名快照（build/_wt_keys_baseline.json），smoke 断言拆分后集合完全一致（PASS）；node --check ×5 全过；行数守恒 5013 = 778+1433+591+1309+902。降级预案未触发。

---

## Phase 6 — 渲染性能：单词本局部重渲染 — 已完成 2026-08-29

**改动点**（落在 wordbook-pane.js）
1. `_renderPaneBody` 拆两层：`_buildPaneChrome(doc, itemID, pageInfo)`（头部四行：标题/API/排序/字典行/搜索框/翻页控件，仅全量渲染时重建）+ `_renderCardList(doc, body, itemID, rawWords, pageInfo)`（卡片列表区 + 翻页控件状态同步，返回 false 表示外壳不存在）。
2. `_applyWordBookView` 增加快路径：上下文条目与 `body.dataset.chromeItemID` **双一致**且 body 可用 → 只调 `_renderCardList`，不触发官方 pane 刷新（不闪、不丢搜索框焦点）；否则回退慢路径（`_triggerPaneRefresh` 自愈 + 全量）。forceFull 选项强制慢路径。
3. 搜索输入不再被销毁 → 删除 `_onWordBookSearchTrigger` 的焦点/光标恢复 hack。
4. 排序按钮与字典模式按钮改为点击时自更新外观（原依赖全量重绘刷写）；刷新按钮 `_repairWordBookPane` 传 forceFull 走全量自愈。
5. 防错位护栏：外壳构建时打 `chromeItemID` 标记，快路径要求上下文条目与外壳条目双一致，杜绝 onItemChange 先到而 onRender 未跑时把 B 条目卡片渲染进 A 条目外壳。

**回归断言**（_smoke.js S8，迷你假 DOM）：列表重绘卡片数与分页一致、页码/总页/禁用态同步、快路径不触发全量刷新、forceFull 走全量、跨条目不走快路径、无外壳返回 false。成员基线更新至 219（+_buildPaneChrome/_renderCardList）。
**b 版实测**：搜索连续输入不丢焦点、翻页流畅不闪；条目切换/重载后面板正常（自愈不回归）；排序与字典模式按钮外观即时正确。

---

## Phase 7 — 功能 A：单词本导出 + 译文级缓存 — 已完成 2026-08-29

**1. 导出**
- 入口：单词本头部新增"导出"按钮 → 固定定位菜单（复用 _cardMenu 外部关闭机制）：CSV / Markdown / Anki × 当前条目 / 全部条目合并；
- 数据：`_collectExportSections`（空条目跳过；标题取 Zotero.Items，取不到回退"条目 <id>"）+ `_exportDictSummary`（dict-cache 的音标/词性/释义）；
- 格式：CSV `word,translation,phonetic,pos,meaning,highlight,item`（BOM + 引号转义）；Markdown 多节 `## 标题` + `- **word** -- 译文 [音标] pos. meaning`；Anki tsv 正面=单词、背面=`译文<br>[音标] pos. meaning`（tab/换行清洗为空格）；
- 保存：首选 `Zotero.FilePicker`（modeSave）；不可用/取消时兜底写 `<数据目录>/exports/`（时间戳后缀防覆盖）并 toast 通知；写盘用 `Zotero.File.putContentsAsync`。

**2. 译文缓存**
- storage.js：`translation-cache.json`（word → {translation, ts}，LRU 2000，同 dict-cache 裁剪策略）；
- addon.js core：`_translationCache` 内存层 + `_loadTranslationCache`（init 载入）+ `_getCachedTranslation/_setCachedTranslation`（800ms 防抖落盘）+ `_flushTranslationCache`（shutdown 落盘）；
- hotkey.js `_addWordForReader`：命中缓存直接填卡不调 API（词典行仍由 _enrichDict 独立补全）；`_retryTranslationForCard`（↻）绕过读缓存、成功后回写（改提示词重译即更新全局缓存）。

**回归断言**（_smoke.js S9）：缓存载入/大小写归一/写入/flush；收集当前与全部条目、空条目跳过；CSV BOM+表头+引号转义；MD 分节；Anki 清洗；文件名清洗。成员基线更新至 233。

---

## Phase 8 — 功能 B：{{context}} 上下文提示词 + TTS 配置化 + 离线例句兜底 — 已完成 2026-08-29

**1. {{context}}（默认关）**
- config-schema：`promptUseContext: false`；hotkey.js `_getSelectionContext(reader, word)`：从 reader iframe `getSelection()` 取选区，定位目标词前后各 ~120 字符（仅作素材不作触发依据，取不到返回空串），上限 400 字符；
- translate.js `_buildPromptParts(text, context)`：开启时模板 `{{context}}` 替换为上下文；模板未写占位符且确有上下文时自动附加"（该词所在上下文：…）"；关闭/无上下文时占位符清空。`translate(text, apiOverride, onChunk, context)` 透传，Claude 适配器签名加 context 同步支持；
- 缓存互斥：开启且确有上下文时绕过词级译文缓存（读+写都不走），避免跨语境复用译文；
- 偏好页提示词区加开关与说明（默认关）。

**2. TTS 配置化**：DEFAULTS `ttsApiModel: "tts-1"` / `ttsApiVoice: "alloy"`（normalize 回填）；偏好页 TTS API 区两个输入框（即时保存+回显）；`_speakRegistry.api` 与偏好页 testTTSApi 读取配置。

**3. 离线例句兜底**：dict.js `_doLookup` 在 ecdict 命中且无例句且非纯离线模式时，调 `_fetchExamplesInBackground(word)`——后台拉 youdao blng_sents_part，合并进缓存条目并落盘、重渲染当前单词本；失败静默；`_exampleFetching` 并发去重。

**回归断言**（_smoke.js S10）：{{context}} 替换/自动附加/清空三态、开关关闭；TTS 配置保留与缺省；离线例句补抓合并+落盘标记。成员基线 234（+_getSelectionContext）。

---

## Phase 8.1 — 临时文本框宽×高双向自适应（用户报告 bug 追加，2026-08-29）

**现象**：第二次译文返回时，译文较短则尺寸自适应正常；译文长到出现滚动条时，高度调整卡在中间（滚动条停在中部）。

**根因**：旧 `_resizeTempEditArea` 在**活体 textarea 上单帧测量**——"改高 → 弹窗面板重排 → 滚动条挤占可用宽度 → 换行变化 → 单帧测量值过期"的反馈回路，且无一帧以上的校正机会。

**重设计**（新函数 `_fitTempEditArea`，`_resizeTempEditArea` 降为兼容入口，三个调用点不变）：
1. **幽灵元素离线测量**：隐藏 div 套用与 textarea 一致的字体/内边距/换行规则，测量与活体完全解耦，反馈回路消除；
2. **宽度自适应**：文本最长自然行宽（pre + max-content），夹在 [180px, min(480px, 窗口宽×0.7)]；宽度确定后再按该宽度测所需高度（10 行封顶，超出滚动）；
3. **多帧收敛**：应用后逐帧复核，宽度在帧间变化（面板仍在收敛）就继续重算，稳定或 3 帧封顶结束；rAF 不可达时由 400ms 超时兜底清理测量器；
4. 创建样式去掉 `width:100%` / `max-width:100%`（否则长译文无法撑宽弹窗）。

**验收**：node --check + smoke 101/101（成员基线 235，+_fitTempEditArea）；真实 DOM 行为（滚动条场景、面板宽度收敛）由 b 版人工验证。

### Phase 8.2 — 宽度预算修正（用户截图反馈，b14）

截图显示：长译文把 textarea 撑到 480px 上限，冲出下拉面板、被右侧边栏遮挡，且创建时整段全选导致整片高亮刺眼。修正：
1. 宽度上限改为**四者最小**：480px 绝对上限 / 窗口宽 70% / **所在弹窗面板内容宽**（向上遍历找 panel/annotation-popup，宽-24）/ **textarea 左缘到窗口右缘的可用空间**——不再撑破面板、不被侧边栏遮挡；
2. 创建时不再 `select()` 整段全选，光标置于末尾便于编辑。

---

## Phase 9 — 文档、声明与发布 — 文档部分已完成 2026-08-29

**分支盘点结论（合并前必读）**：仓库共 9 个分支。`feature/powertoys-installer` 与 `optimize/p0~p5`（7 个）已完全并入 main，无独有提交，属陈旧指针可随时清理；**`feature/deeplx` 是唯一未并入的分支**（领先 main 3 个提交），但其核心功能 deeplx-selfhosted 已存在于 main/6.14（实现逐字一致），其余内容为历史产物快照（旧版 xpi 存档、api_request_lab 探测文档、参考插件解包），**保留作存档、不并入**（并入会带入 4.6 万行历史内容与大量冲突）；是否删除由用户决定。

**已完成（b15）**：
1. README 新增「安全与兼容性说明」：① 侧键桥接——PowerShell 编译可能触发杀软提示（误报，放行）、系统级钩子在所有应用中接管侧键；② 非官方接口（Google/DeepL 免费）随时可能失效；③ 界面仅中文。存储树补全 dict-cache/translation-cache/exports。
2. README 数据隐私与偏好页「保存目录」区：注明 `api-config.json` 明文保存 API Key，勿外分享。

**待用户确认后执行（发布边界）**：
1. b 系列实测通过 → 定版提交（manifest 6.14.0，去掉 b 后缀）+ 打 `wordtranslator-6.14.0.xpi`；
2. 合并 `optimize/v6.14` 回 main（快进合并，main 无分叉）；
3. 推送 + 按 GitHub Release 规范发布（标题「单词翻译 for Zotero 6.14.0」、tag v6.14.0、附 xpi）；
4. 同步两份 update.json 新增 6.14.0 条目（**必须在 release 发布后**，否则更新源会指向不存在的下载链接）。

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
