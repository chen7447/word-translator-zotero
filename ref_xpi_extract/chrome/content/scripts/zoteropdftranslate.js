"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // package.json
  var version2, config, homepage;
  var init_package = __esm({
    "package.json"() {
      version2 = "2.4.6";
      config = {
        addonName: "Translate for Zotero",
        addonID: "zoteropdftranslate@euclpts.com",
        addonRef: "zoteropdftranslate",
        prefsPrefix: "extensions.zotero.ZoteroPDFTranslate",
        addonInstance: "PDFTranslate"
      };
      homepage = "https://github.com/windingwind/zotero-pdf-translate#readme";
    }
  });

  // src/utils/prefs.ts
  function getPref(key) {
    return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  }
  function setPref(key, value) {
    return Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
  }
  function clearPref(key) {
    return Zotero.Prefs.clear(`${config.prefsPrefix}.${key}`, true);
  }
  function getPrefJSON(key) {
    try {
      return JSON.parse(String(getPref(key) || "{}"));
    } catch (e) {
      setPref(key, "{}");
    }
    return {};
  }
  var init_prefs = __esm({
    "src/utils/prefs.ts"() {
      "use strict";
      init_package();
    }
  });

  // src/utils/locale.ts
  function initLocale() {
    const l10n = new (typeof Localization === "undefined" ? ztoolkit.getGlobal("Localization") : Localization)([`${config.addonRef}-addon.ftl`], true);
    addon.data.locale = {
      current: l10n
    };
  }
  function getString(...inputs) {
    if (inputs.length === 1) {
      return _getString(inputs[0]);
    } else if (inputs.length === 2) {
      if (typeof inputs[1] === "string") {
        return _getString(inputs[0], { branch: inputs[1] });
      } else {
        return _getString(inputs[0], inputs[1]);
      }
    } else {
      throw new Error("Invalid arguments");
    }
  }
  function _getString(localeString, options = {}) {
    const localStringWithPrefix = `${config.addonRef}-${localeString}`;
    const { branch, args } = options;
    const pattern = addon.data.locale?.current.formatMessagesSync([
      { id: localStringWithPrefix, args }
    ])[0];
    if (!pattern) {
      return localStringWithPrefix;
    }
    if (branch && pattern.attributes) {
      for (const attr of pattern.attributes) {
        if (attr.name === branch) {
          return attr.value;
        }
      }
      return pattern.attributes[branch] || localStringWithPrefix;
    } else {
      return pattern.value || localStringWithPrefix;
    }
  }
  function getLocaleID(id) {
    return `${config.addonRef}-${id}`;
  }
  var init_locale = __esm({
    "src/utils/locale.ts"() {
      "use strict";
      init_package();
    }
  });

  // src/modules/settings/manageKeys.ts
  var manageKeys_exports = {};
  __export(manageKeys_exports, {
    manageKeysDialog: () => manageKeysDialog
  });
  async function manageKeysDialog() {
    const dialog = new ztoolkit.Dialog(2, 1);
    const secrets = getPrefJSON("secretObj");
    const dialogData = {
      secrets: JSON.stringify(secrets, null, 2),
      updateSuccess: false
    };
    dialog.setDialogData(dialogData).addCell(
      0,
      0,
      {
        tag: "div",
        namespace: "html",
        styles: {
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          padding: "20px"
        },
        children: [
          {
            tag: "label",
            namespace: "html",
            properties: {
              innerHTML: getString("service-manageKeys-head")
            },
            styles: {
              marginBottom: "5px"
            }
          },
          {
            tag: "textarea",
            namespace: "html",
            attributes: {
              "data-bind": "secrets",
              "data-prop": "value",
              rows: "25",
              cols: "70"
            },
            styles: {
              fontFamily: "monospace",
              whiteSpace: "pre",
              overflowX: "auto",
              padding: "8px"
            }
          }
        ]
      },
      false
    ).addButton(getString("service-manageKeys-close"), "close").addButton(getString("service-manageKeys-save"), "save", {
      callback: () => {
        const textarea = dialog.window?.document.querySelector(
          `textarea[data-bind="secrets"]`
        );
        if (textarea) {
          dialogData.secrets = textarea.value;
        }
      }
    }).open(getString("service-manageKeys-title"));
    if (dialogData.unloadLock && dialogData.unloadLock.promise) {
      try {
        await dialogData.unloadLock.promise;
      } catch (error) {
        console.error("Error waiting for dialog to close:", error);
      }
    }
    if (dialogData._lastButtonId === "save") {
      try {
        const parsedSecrets = JSON.parse(dialogData.secrets);
        setPref("secretObj", JSON.stringify(parsedSecrets));
        dialogData.updateSuccess = true;
        addon.hooks.onReaderTabPanelRefresh();
      } catch (e) {
        if (dialog.window) {
          Zotero.alert(
            dialog.window,
            "Error",
            `Failed to save keys: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
    return dialogData.updateSuccess;
  }
  var init_manageKeys = __esm({
    "src/modules/settings/manageKeys.ts"() {
      "use strict";
      init_prefs();
      init_locale();
    }
  });

  // src/modules/settings/renameServices.ts
  var renameServices_exports = {};
  __export(renameServices_exports, {
    renameServicesDialog: () => renameServicesDialog
  });
  async function renameServicesDialog() {
    const dialog = new ztoolkit.Dialog(4, 1);
    const dialogData = {
      customgpt1: getPref("renameServices.customgpt1"),
      customgpt2: getPref("renameServices.customgpt2"),
      customgpt3: getPref("renameServices.customgpt3")
    };
    dialog.setDialogData(dialogData).addCell(
      0,
      0,
      {
        tag: "div",
        namespace: "html",
        styles: {
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "15px 20px",
          alignItems: "center",
          padding: "20px"
        },
        children: [
          {
            tag: "label",
            namespace: "html",
            properties: {
              innerHTML: getString("service-renameServices-head")
            },
            styles: {
              gridColumn: "1 / span 2",
              marginBottom: "5px"
            }
          },
          {
            tag: "label",
            namespace: "html",
            attributes: {
              for: "customgpt1"
            },
            properties: {
              innerHTML: getString("service-customgpt1")
            }
          },
          {
            tag: "input",
            id: "customgpt1",
            attributes: {
              "data-bind": "customgpt1",
              "data-prop": "value",
              type: "string",
              placeholder: "Maximum 15 characters",
              maxlength: "15"
            }
          },
          {
            tag: "label",
            namespace: "html",
            attributes: {
              for: "customgpt2"
            },
            properties: {
              innerHTML: getString("service-customgpt2")
            }
          },
          {
            tag: "input",
            id: "customgpt2",
            attributes: {
              "data-bind": "customgpt2",
              "data-prop": "value",
              type: "string",
              placeholder: "Maximum 15 characters",
              maxlength: "15"
            }
          },
          {
            tag: "label",
            namespace: "html",
            attributes: {
              for: "customgpt3"
            },
            properties: {
              innerHTML: getString("service-customgpt3")
            }
          },
          {
            tag: "input",
            id: "customgpt3",
            attributes: {
              "data-bind": "customgpt3",
              "data-prop": "value",
              type: "string",
              placeholder: "Maximum 15 characters",
              maxlength: "15"
            }
          },
          {
            tag: "label",
            namespace: "html",
            properties: {
              innerHTML: getString("service-renameServices-hint")
            },
            styles: {
              gridColumn: "1 / span 2",
              fontSize: "0.9rem"
            }
          }
        ]
      },
      false
    ).addButton(getString("service-renameServices-close"), "close").addButton(getString("service-renameServices-save"), "save").open(getString("service-renameServices-title"));
    await dialogData.unloadLock?.promise;
    switch (dialogData._lastButtonId) {
      case "save":
        {
          setPref("renameServices.customgpt1", dialogData.customgpt1);
          setPref("renameServices.customgpt2", dialogData.customgpt2);
          setPref("renameServices.customgpt3", dialogData.customgpt3);
        }
        break;
      default:
        break;
    }
  }
  var init_renameServices = __esm({
    "src/modules/settings/renameServices.ts"() {
      "use strict";
      init_prefs();
      init_locale();
    }
  });

  // node_modules/zotero-plugin-toolkit/dist/chunk-Cl8Af3a2.js
  var __defProp2 = Object.defineProperty;
  var __export2 = (target, all) => {
    for (var name in all) __defProp2(target, name, {
      get: all[name],
      enumerable: true
    });
  };

  // node_modules/zotero-plugin-toolkit/dist/index.js
  var version = "5.1.0-beta.9";
  var DebugBridge = class DebugBridge2 {
    static version = 2;
    static passwordPref = "extensions.zotero.debug-bridge.password";
    get version() {
      return DebugBridge2.version;
    }
    _disableDebugBridgePassword;
    get disableDebugBridgePassword() {
      return this._disableDebugBridgePassword;
    }
    set disableDebugBridgePassword(value) {
      this._disableDebugBridgePassword = value;
    }
    get password() {
      return BasicTool.getZotero().Prefs.get(DebugBridge2.passwordPref, true);
    }
    set password(v) {
      BasicTool.getZotero().Prefs.set(DebugBridge2.passwordPref, v, true);
    }
    constructor() {
      this._disableDebugBridgePassword = false;
      this.initializeDebugBridge();
    }
    static setModule(instance) {
      if (!instance.debugBridge?.version || instance.debugBridge.version < DebugBridge2.version) instance.debugBridge = new DebugBridge2();
    }
    initializeDebugBridge() {
      const debugBridgeExtension = {
        noContent: true,
        doAction: async (uri) => {
          const Zotero$1 = BasicTool.getZotero();
          const window$1 = Zotero$1.getMainWindow();
          const uriString = uri.spec.split("//").pop();
          if (!uriString) return;
          const params = {};
          uriString.split("?").pop()?.split("&").forEach((p) => {
            params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
          });
          const skipPasswordCheck = toolkitGlobal_default.getInstance()?.debugBridge.disableDebugBridgePassword;
          let allowed = false;
          if (skipPasswordCheck) allowed = true;
          else if (typeof params.password === "undefined" && typeof this.password === "undefined") allowed = window$1.confirm(`External App ${params.app} wants to execute command without password.
Command:
${(params.run || params.file || "").slice(0, 100)}
If you do not know what it is, please click Cancel to deny.`);
          else allowed = this.password === params.password;
          if (allowed) {
            if (params.run) try {
              const AsyncFunction = Object.getPrototypeOf(async () => {
              }).constructor;
              const f = new AsyncFunction("Zotero,window", params.run);
              await f(Zotero$1, window$1);
            } catch (e) {
              Zotero$1.debug(e);
              window$1.console.log(e);
            }
            if (params.file) try {
              Services.scriptloader.loadSubScript(params.file, {
                Zotero: Zotero$1,
                window: window$1
              });
            } catch (e) {
              Zotero$1.debug(e);
              window$1.console.log(e);
            }
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://ztoolkit-debug"] = debugBridgeExtension;
    }
  };
  var PluginBridge = class PluginBridge2 {
    static version = 1;
    get version() {
      return PluginBridge2.version;
    }
    constructor() {
      this.initializePluginBridge();
    }
    static setModule(instance) {
      if (!instance.pluginBridge?.version || instance.pluginBridge.version < PluginBridge2.version) instance.pluginBridge = new PluginBridge2();
    }
    initializePluginBridge() {
      const { AddonManager } = _importESModule("resource://gre/modules/AddonManager.sys.mjs");
      const Zotero$1 = BasicTool.getZotero();
      const pluginBridgeExtension = {
        noContent: true,
        doAction: async (uri) => {
          try {
            const uriString = uri.spec.split("//").pop();
            if (!uriString) return;
            const params = {};
            uriString.split("?").pop()?.split("&").forEach((p) => {
              params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
            });
            if (params.action === "install" && params.url) {
              if (params.minVersion && Services.vc.compare(Zotero$1.version, params.minVersion) < 0 || params.maxVersion && Services.vc.compare(Zotero$1.version, params.maxVersion) > 0) throw new Error(`Plugin is not compatible with Zotero version ${Zotero$1.version}.The plugin requires Zotero version between ${params.minVersion} and ${params.maxVersion}.`);
              const addon2 = await AddonManager.getInstallForURL(params.url);
              if (addon2 && addon2.state === AddonManager.STATE_AVAILABLE) {
                addon2.install();
                hint("Plugin installed successfully.", true);
              } else throw new Error(`Plugin ${params.url} is not available.`);
            }
          } catch (e) {
            Zotero$1.logError(e);
            hint(e.message, false);
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://plugin"] = pluginBridgeExtension;
    }
  };
  function hint(content, success) {
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline("Plugin Toolkit");
    progressWindow.progress = new progressWindow.ItemProgress(success ? "chrome://zotero/skin/tick.png" : "chrome://zotero/skin/cross.png", content);
    progressWindow.progress.setProgress(100);
    progressWindow.show();
    progressWindow.startCloseTimer(5e3);
  }
  var ToolkitGlobal = class ToolkitGlobal2 {
    debugBridge;
    pluginBridge;
    prompt;
    currentWindow;
    constructor() {
      initializeModules(this);
      this.currentWindow = BasicTool.getZotero().getMainWindow();
    }
    /**
    * Get the global unique instance of `class ToolkitGlobal`.
    * @returns An instance of `ToolkitGlobal`.
    */
    static getInstance() {
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") _Zotero = Zotero;
        else _Zotero = BasicTool.getZotero();
      } catch {
      }
      if (!_Zotero) return void 0;
      let requireInit = false;
      if (!("_toolkitGlobal" in _Zotero)) {
        _Zotero._toolkitGlobal = new ToolkitGlobal2();
        requireInit = true;
      }
      const currentGlobal = _Zotero._toolkitGlobal;
      if (currentGlobal.currentWindow !== _Zotero.getMainWindow()) {
        checkWindowDependentModules(currentGlobal);
        requireInit = true;
      }
      if (requireInit) initializeModules(currentGlobal);
      return currentGlobal;
    }
  };
  function initializeModules(instance) {
    new BasicTool().log("Initializing ToolkitGlobal modules");
    setModule(instance, "prompt", {
      _ready: false,
      instance: void 0
    });
    DebugBridge.setModule(instance);
    PluginBridge.setModule(instance);
  }
  function setModule(instance, key, module) {
    if (!module) return;
    if (!instance[key]) instance[key] = module;
    for (const moduleKey in module) instance[key][moduleKey] ??= module[moduleKey];
  }
  function checkWindowDependentModules(instance) {
    instance.currentWindow = BasicTool.getZotero().getMainWindow();
    instance.prompt = void 0;
  }
  var toolkitGlobal_default = ToolkitGlobal;
  var BasicTool = class BasicTool2 {
    /**
    * configurations.
    */
    _basicOptions;
    _console;
    /**
    * @deprecated Use `patcherManager` instead.
    */
    patchSign = "zotero-plugin-toolkit@3.0.0";
    static _version = version;
    /**
    * Get version - checks subclass first, then falls back to parent
    */
    get _version() {
      return version;
    }
    get basicOptions() {
      return this._basicOptions;
    }
    /**
    *
    * @param data Pass an BasicTool instance to copy its options.
    */
    constructor(data2) {
      this._basicOptions = {
        log: {
          _type: "toolkitlog",
          disableConsole: false,
          disableZLog: false,
          prefix: ""
        },
        get debug() {
          if (this._debug) return this._debug;
          this._debug = toolkitGlobal_default.getInstance()?.debugBridge || {
            disableDebugBridgePassword: false,
            password: ""
          };
          return this._debug;
        },
        api: { pluginID: "zotero-plugin-toolkit@windingwind.com" },
        listeners: {
          callbacks: {
            onMainWindowLoad: /* @__PURE__ */ new Set(),
            onMainWindowUnload: /* @__PURE__ */ new Set(),
            onPluginUnload: /* @__PURE__ */ new Set()
          },
          _mainWindow: void 0,
          _plugin: void 0
        }
      };
      try {
        if (typeof globalThis.ChromeUtils?.importESModule !== "undefined" || typeof globalThis.ChromeUtils?.import !== "undefined") {
          const { ConsoleAPI } = _importESModule("resource://gre/modules/Console.sys.mjs");
          this._console = new ConsoleAPI({ consoleID: `${this._basicOptions.api.pluginID}-${Date.now()}` });
        }
      } catch {
      }
      this.updateOptions(data2);
    }
    getGlobal(k) {
      if (typeof globalThis[k] !== "undefined") return globalThis[k];
      const _Zotero = BasicTool2.getZotero();
      try {
        const window$1 = _Zotero.getMainWindow();
        switch (k) {
          case "Zotero":
          case "zotero":
            return _Zotero;
          case "window":
            return window$1;
          case "windows":
            return _Zotero.getMainWindows();
          case "document":
            return window$1.document;
          case "ZoteroPane":
          case "ZoteroPane_Local":
            return _Zotero.getActiveZoteroPane();
          default:
            return window$1[k];
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }
    /**
    * If it's an XUL element
    * @param elem
    */
    isXULElement(elem) {
      return elem.namespaceURI === "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    }
    /**
    * Create an XUL element
    *
    * For Zotero 6, use `createElementNS`;
    *
    * For Zotero 7+, use `createXULElement`.
    * @param doc
    * @param type
    * @example
    * Create a `<menuitem>`:
    * ```ts
    * const compat = new ZoteroCompat();
    * const doc = compat.getWindow().document;
    * const elem = compat.createXULElement(doc, "menuitem");
    * ```
    */
    createXULElement(doc, type) {
      return doc.createXULElement(type);
    }
    /**
    * Output to both Zotero.debug and console.log
    * @param data e.g. string, number, object, ...
    */
    log(...data2) {
      if (data2.length === 0) return;
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") _Zotero = Zotero;
        else _Zotero = BasicTool2.getZotero();
      } catch {
      }
      let options;
      if (data2[data2.length - 1]?._type === "toolkitlog") options = data2.pop();
      else options = this._basicOptions.log;
      try {
        if (options.prefix) data2.splice(0, 0, options.prefix);
        if (!options.disableConsole) {
          let _console;
          if (typeof console !== "undefined") _console = console;
          else if (_Zotero) _console = _Zotero.getMainWindow()?.console;
          if (!_console) {
            if (!this._console) return;
            _console = this._console;
          }
          if (_console.groupCollapsed) _console.groupCollapsed(...data2);
          else _console.group(...data2);
          _console.trace();
          _console.groupEnd();
        }
        if (!options.disableZLog) {
          if (typeof _Zotero === "undefined") return;
          _Zotero.debug(data2.map((d) => {
            try {
              return typeof d === "object" ? JSON.stringify(d) : String(d);
            } catch {
              _Zotero.debug(d);
              return "";
            }
          }).join("\n"));
        }
      } catch (e) {
        if (_Zotero) Zotero.logError(e);
        else console.error(e);
      }
    }
    /**
    * Patch a function
    * @deprecated Use {@link PatchHelper} instead.
    * @param object The owner of the function
    * @param funcSign The signature of the function(function name)
    * @param ownerSign The signature of patch owner to avoid patching again
    * @param patcher The new wrapper of the patched function
    */
    patch(object, funcSign, ownerSign, patcher) {
      if (object[funcSign][ownerSign]) throw new Error(`${String(funcSign)} re-patched`);
      this.log("patching", funcSign, `by ${ownerSign}`);
      object[funcSign] = patcher(object[funcSign]);
      object[funcSign][ownerSign] = true;
    }
    /**
    * Add a Zotero event listener callback
    * @param type Event type
    * @param callback Event callback
    */
    addListenerCallback(type, callback) {
      if (["onMainWindowLoad", "onMainWindowUnload"].includes(type)) this._ensureMainWindowListener();
      if (type === "onPluginUnload") this._ensurePluginListener();
      this._basicOptions.listeners.callbacks[type].add(callback);
    }
    /**
    * Remove a Zotero event listener callback
    * @param type Event type
    * @param callback Event callback
    */
    removeListenerCallback(type, callback) {
      this._basicOptions.listeners.callbacks[type].delete(callback);
      this._ensureRemoveListener();
    }
    /**
    * Remove all Zotero event listener callbacks when the last callback is removed.
    */
    _ensureRemoveListener() {
      const { listeners } = this._basicOptions;
      if (listeners._mainWindow && listeners.callbacks.onMainWindowLoad.size === 0 && listeners.callbacks.onMainWindowUnload.size === 0) {
        Services.wm.removeListener(listeners._mainWindow);
        delete listeners._mainWindow;
      }
      if (listeners._plugin && listeners.callbacks.onPluginUnload.size === 0) {
        Zotero.Plugins.removeObserver(listeners._plugin);
        delete listeners._plugin;
      }
    }
    /**
    * Ensure the main window listener is registered.
    */
    _ensureMainWindowListener() {
      if (this._basicOptions.listeners._mainWindow) return;
      const mainWindowListener = {
        onOpenWindow: (xulWindow) => {
          const domWindow = xulWindow.docShell.domWindow;
          const onload = async () => {
            domWindow.removeEventListener("load", onload, false);
            if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") return;
            for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowLoad) try {
              cbk(domWindow);
            } catch (e) {
              this.log(e);
            }
          };
          domWindow.addEventListener("load", () => onload(), false);
        },
        onCloseWindow: async (xulWindow) => {
          const domWindow = xulWindow.docShell.domWindow;
          if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") return;
          for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowUnload) try {
            cbk(domWindow);
          } catch (e) {
            this.log(e);
          }
        }
      };
      this._basicOptions.listeners._mainWindow = mainWindowListener;
      Services.wm.addListener(mainWindowListener);
    }
    /**
    * Ensure the plugin listener is registered.
    */
    _ensurePluginListener() {
      if (this._basicOptions.listeners._plugin) return;
      const pluginListener = { shutdown: (...args) => {
        for (const cbk of this._basicOptions.listeners.callbacks.onPluginUnload) try {
          cbk(...args);
        } catch (e) {
          this.log(e);
        }
      } };
      this._basicOptions.listeners._plugin = pluginListener;
      Zotero.Plugins.addObserver(pluginListener);
    }
    updateOptions(source) {
      if (!source) return this;
      if (source instanceof BasicTool2) this._basicOptions = source._basicOptions;
      else this._basicOptions = source;
      return this;
    }
    static getZotero() {
      if (typeof Zotero !== "undefined") return Zotero;
      const { Zotero: _Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
      return _Zotero;
    }
  };
  var ManagerTool = class extends BasicTool {
    _ensureAutoUnregisterAll() {
      this.addListenerCallback("onPluginUnload", (params, _reason) => {
        if (params.id !== this.basicOptions.api.pluginID) return;
        this.unregisterAll();
      });
    }
  };
  function unregister(tools) {
    Object.values(tools).forEach((tool) => {
      if (tool instanceof ManagerTool || typeof tool?.unregisterAll === "function") tool.unregisterAll();
    });
  }
  function makeHelperTool(cls, options) {
    return new Proxy(cls, { construct(target, args) {
      const _origin = new cls(...args);
      if (_origin instanceof BasicTool) _origin.updateOptions(options);
      else _origin._version = BasicTool._version;
      return _origin;
    } });
  }
  function _importESModule(path) {
    if (typeof ChromeUtils.import === "undefined") return ChromeUtils.importESModule(path, { global: "contextual" });
    if (path.endsWith(".sys.mjs")) path = path.replace(/\.sys\.mjs$/, ".jsm");
    return ChromeUtils.import(path);
  }
  var ClipboardHelper = class extends BasicTool {
    transferable;
    clipboardService;
    filePath = "";
    constructor() {
      super();
      this.transferable = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
      this.clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
      this.transferable.init(null);
    }
    addText(source, type = "text/plain") {
      const str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
      str.data = source;
      if (type === "text/unicode") type = "text/plain";
      this.transferable.addDataFlavor(type);
      this.transferable.setTransferData(type, str, source.length * 2);
      return this;
    }
    addImage(source) {
      const parts = source.split(",");
      if (!parts[0].includes("base64")) return this;
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = this.getGlobal("window").atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const imgTools = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
      let mimeType;
      let img;
      if (this.getGlobal("Zotero").platformMajorVersion >= 102) {
        img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
        mimeType = "application/x-moz-nativeimage";
      } else {
        mimeType = `image/png`;
        img = Components.classes["@mozilla.org/supports-interface-pointer;1"].createInstance(Components.interfaces.nsISupportsInterfacePointer);
        img.data = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mimeType);
      }
      this.transferable.addDataFlavor(mimeType);
      this.transferable.setTransferData(mimeType, img, 0);
      return this;
    }
    addFile(path) {
      const file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      file.initWithPath(path);
      this.transferable.addDataFlavor("application/x-moz-file");
      this.transferable.setTransferData("application/x-moz-file", file);
      this.filePath = path;
      return this;
    }
    copy() {
      try {
        this.clipboardService.setData(this.transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
      } catch (e) {
        if (this.filePath && Zotero.isMac) Zotero.Utilities.Internal.exec(`/usr/bin/osascript`, [`-e`, `set the clipboard to POSIX file "${this.filePath}"`]);
        else throw e;
      }
      return this;
    }
  };
  var UITool = class extends BasicTool {
    get basicOptions() {
      return this._basicOptions;
    }
    /**
    * Store elements created with this instance
    *
    * @remarks
    * > What is this for?
    *
    * In bootstrap plugins, elements must be manually maintained and removed on exiting.
    *
    * This API does this for you.
    */
    elementCache;
    constructor(base) {
      super(base);
      this.elementCache = [];
      if (!this._basicOptions.ui) this._basicOptions.ui = {
        enableElementRecord: true,
        enableElementJSONLog: false,
        enableElementDOMLog: true
      };
    }
    /**
    * Remove all elements created by `createElement`.
    *
    * @remarks
    * > What is this for?
    *
    * In bootstrap plugins, elements must be manually maintained and removed on exiting.
    *
    * This API does this for you.
    */
    unregisterAll() {
      this.elementCache.forEach((e) => {
        try {
          e?.deref()?.remove();
        } catch (e$1) {
          this.log(e$1);
        }
      });
    }
    createElement(...args) {
      const doc = args[0];
      const tagName = args[1].toLowerCase();
      let props = args[2] || {};
      if (!tagName) return;
      if (typeof args[2] === "string") props = {
        namespace: args[2],
        enableElementRecord: args[3]
      };
      if (typeof props.enableElementJSONLog !== "undefined" && props.enableElementJSONLog || this.basicOptions.ui.enableElementJSONLog) this.log(props);
      props.properties = props.properties || props.directAttributes;
      props.children = props.children || props.subElementOptions;
      let elem;
      if (tagName === "fragment") {
        const fragElem = doc.createDocumentFragment();
        elem = fragElem;
      } else {
        let realElem = props.id && (props.checkExistenceParent ? props.checkExistenceParent : doc).querySelector(`#${props.id}`);
        if (realElem && props.ignoreIfExists) return realElem;
        if (realElem && props.removeIfExists) {
          realElem.remove();
          realElem = void 0;
        }
        if (props.customCheck && !props.customCheck(doc, props)) return void 0;
        if (!realElem || !props.skipIfExists) {
          let namespace = props.namespace;
          if (!namespace) {
            const mightHTML = HTMLElementTagNames.includes(tagName);
            const mightXUL = XULElementTagNames.includes(tagName);
            const mightSVG = SVGElementTagNames.includes(tagName);
            if (Number(mightHTML) + Number(mightXUL) + Number(mightSVG) > 1) this.log(`[Warning] Creating element ${tagName} with no namespace specified. Found multiply namespace matches.`);
            if (mightHTML) namespace = "html";
            else if (mightXUL) namespace = "xul";
            else if (mightSVG) namespace = "svg";
            else namespace = "html";
          }
          if (namespace === "xul") realElem = this.createXULElement(doc, tagName);
          else realElem = doc.createElementNS({
            html: "http://www.w3.org/1999/xhtml",
            svg: "http://www.w3.org/2000/svg"
          }[namespace], tagName);
          if (typeof props.enableElementRecord !== "undefined" ? props.enableElementRecord : this.basicOptions.ui.enableElementRecord) this.elementCache.push(new WeakRef(realElem));
        }
        if (props.id) realElem.id = props.id;
        if (props.styles && Object.keys(props.styles).length) Object.keys(props.styles).forEach((k) => {
          const v = props.styles[k];
          typeof v !== "undefined" && (realElem.style[k] = v);
        });
        if (props.properties && Object.keys(props.properties).length) Object.keys(props.properties).forEach((k) => {
          const v = props.properties[k];
          typeof v !== "undefined" && (realElem[k] = v);
        });
        if (props.attributes && Object.keys(props.attributes).length) Object.keys(props.attributes).forEach((k) => {
          const v = props.attributes[k];
          typeof v !== "undefined" && realElem.setAttribute(k, String(v));
        });
        if (props.classList?.length) realElem.classList.add(...props.classList);
        if (props.listeners?.length) props.listeners.forEach(({ type, listener, options }) => {
          listener && realElem.addEventListener(type, listener, options);
        });
        elem = realElem;
      }
      if (props.children?.length) {
        const subElements = props.children.map((childProps) => {
          childProps.namespace = childProps.namespace || props.namespace;
          return this.createElement(doc, childProps.tag, childProps);
        }).filter((e) => e);
        elem.append(...subElements);
      }
      if (typeof props.enableElementDOMLog !== "undefined" ? props.enableElementDOMLog : this.basicOptions.ui.enableElementDOMLog) this.log(elem);
      return elem;
    }
    /**
    * Append element(s) to a node.
    * @param properties See {@link ElementProps}
    * @param container The parent node to append to.
    * @returns A Node that is the appended child (aChild),
    *          except when aChild is a DocumentFragment,
    *          in which case the empty DocumentFragment is returned.
    */
    appendElement(properties, container) {
      return container.appendChild(this.createElement(container.ownerDocument, properties.tag, properties));
    }
    /**
    * Inserts a node before a reference node as a child of its parent node.
    * @param properties See {@link ElementProps}
    * @param referenceNode The node before which newNode is inserted.
    * @returns Node
    */
    insertElementBefore(properties, referenceNode) {
      if (referenceNode.parentNode) return referenceNode.parentNode.insertBefore(this.createElement(referenceNode.ownerDocument, properties.tag, properties), referenceNode);
      else this.log(`${referenceNode.tagName} has no parent, cannot insert ${properties.tag}`);
    }
    /**
    * Replace oldNode with a new one.
    * @param properties See {@link ElementProps}
    * @param oldNode The child to be replaced.
    * @returns The replaced Node. This is the same node as oldChild.
    */
    replaceElement(properties, oldNode) {
      if (oldNode.parentNode) return oldNode.parentNode.replaceChild(this.createElement(oldNode.ownerDocument, properties.tag, properties), oldNode);
      else this.log(`${oldNode.tagName} has no parent, cannot replace it with ${properties.tag}`);
    }
    /**
    * Parse XHTML to XUL fragment. For Zotero 6.
    *
    * To load preferences from a Zotero 7's `.xhtml`, use this method to parse it.
    * @param str xhtml raw text
    * @param entities dtd file list ("chrome://xxx.dtd")
    * @param defaultXUL true for default XUL namespace
    */
    parseXHTMLToFragment(str, entities = [], defaultXUL = true) {
      const parser = new DOMParser();
      const xulns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      const htmlns = "http://www.w3.org/1999/xhtml";
      const wrappedStr = `${entities.length ? `<!DOCTYPE bindings [ ${entities.reduce((preamble, url, index) => {
        return `${preamble}<!ENTITY % _dtd-${index} SYSTEM "${url}"> %_dtd-${index}; `;
      }, "")}]>` : ""}
      <html:div xmlns="${defaultXUL ? xulns : htmlns}"
          xmlns:xul="${xulns}" xmlns:html="${htmlns}">
      ${str}
      </html:div>`;
      this.log(wrappedStr, parser);
      const doc = parser.parseFromString(wrappedStr, "text/xml");
      this.log(doc);
      if (doc.documentElement.localName === "parsererror") throw new Error("not well-formed XHTML");
      const range = doc.createRange();
      range.selectNodeContents(doc.querySelector("div"));
      return range.extractContents();
    }
  };
  var HTMLElementTagNames = [
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr"
  ];
  var XULElementTagNames = [
    "action",
    "arrowscrollbox",
    "bbox",
    "binding",
    "bindings",
    "box",
    "broadcaster",
    "broadcasterset",
    "button",
    "browser",
    "checkbox",
    "caption",
    "colorpicker",
    "column",
    "columns",
    "commandset",
    "command",
    "conditions",
    "content",
    "deck",
    "description",
    "dialog",
    "dialogheader",
    "editor",
    "grid",
    "grippy",
    "groupbox",
    "hbox",
    "iframe",
    "image",
    "key",
    "keyset",
    "label",
    "listbox",
    "listcell",
    "listcol",
    "listcols",
    "listhead",
    "listheader",
    "listitem",
    "member",
    "menu",
    "menubar",
    "menuitem",
    "menulist",
    "menupopup",
    "menuseparator",
    "observes",
    "overlay",
    "page",
    "popup",
    "popupset",
    "preference",
    "preferences",
    "prefpane",
    "prefwindow",
    "progressmeter",
    "radio",
    "radiogroup",
    "resizer",
    "richlistbox",
    "richlistitem",
    "row",
    "rows",
    "rule",
    "script",
    "scrollbar",
    "scrollbox",
    "scrollcorner",
    "separator",
    "spacer",
    "splitter",
    "stack",
    "statusbar",
    "statusbarpanel",
    "stringbundle",
    "stringbundleset",
    "tab",
    "tabbrowser",
    "tabbox",
    "tabpanel",
    "tabpanels",
    "tabs",
    "template",
    "textnode",
    "textbox",
    "titlebar",
    "toolbar",
    "toolbarbutton",
    "toolbargrippy",
    "toolbaritem",
    "toolbarpalette",
    "toolbarseparator",
    "toolbarset",
    "toolbarspacer",
    "toolbarspring",
    "toolbox",
    "tooltip",
    "tree",
    "treecell",
    "treechildren",
    "treecol",
    "treecols",
    "treeitem",
    "treerow",
    "treeseparator",
    "triple",
    "vbox",
    "window",
    "wizard",
    "wizardpage"
  ];
  var SVGElementTagNames = [
    "a",
    "animate",
    "animateMotion",
    "animateTransform",
    "circle",
    "clipPath",
    "defs",
    "desc",
    "ellipse",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "filter",
    "foreignObject",
    "g",
    "image",
    "line",
    "linearGradient",
    "marker",
    "mask",
    "metadata",
    "mpath",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "radialGradient",
    "rect",
    "script",
    "set",
    "stop",
    "style",
    "svg",
    "switch",
    "symbol",
    "text",
    "textPath",
    "title",
    "tspan",
    "use",
    "view"
  ];
  var DialogHelper = class extends UITool {
    /**
    * Passed to dialog window for data-binding and lifecycle controls. See {@link DialogHelper.setDialogData}
    */
    dialogData;
    /**
    * Dialog window instance
    */
    window;
    elementProps;
    /**
    * Create a dialog helper with row \* column grids.
    * @param row
    * @param column
    */
    constructor(row, column) {
      super();
      if (row <= 0 || column <= 0) throw new Error(`row and column must be positive integers.`);
      this.elementProps = {
        tag: "vbox",
        attributes: { flex: 1 },
        styles: {
          width: "100%",
          height: "100%"
        },
        children: []
      };
      for (let i = 0; i < Math.max(row, 1); i++) {
        this.elementProps.children.push({
          tag: "hbox",
          attributes: { flex: 1 },
          children: []
        });
        for (let j = 0; j < Math.max(column, 1); j++) this.elementProps.children[i].children.push({
          tag: "vbox",
          attributes: { flex: 1 },
          children: []
        });
      }
      this.elementProps.children.push({
        tag: "hbox",
        attributes: {
          flex: 0,
          pack: "end"
        },
        children: []
      });
      this.dialogData = {};
    }
    /**
    * Add a cell at (row, column). Index starts from 0.
    * @param row
    * @param column
    * @param elementProps Cell element props. See {@link ElementProps}
    * @param cellFlex If the cell is flex. Default true.
    */
    addCell(row, column, elementProps, cellFlex = true) {
      if (row >= this.elementProps.children.length || column >= this.elementProps.children[row].children.length) throw new Error(`Cell index (${row}, ${column}) is invalid, maximum (${this.elementProps.children.length}, ${this.elementProps.children[0].children.length})`);
      this.elementProps.children[row].children[column].children = [elementProps];
      this.elementProps.children[row].children[column].attributes.flex = cellFlex ? 1 : 0;
      return this;
    }
    /**
    * Add a control button to the bottom of the dialog.
    * @param label Button label
    * @param id Button id.
    * The corresponding id of the last button user clicks before window exit will be set to `dialogData._lastButtonId`.
    * @param options Options
    * @param [options.noClose] Don't close window when clicking this button.
    * @param [options.callback] Callback of button click event.
    */
    addButton(label, id, options = {}) {
      id = id || `btn-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`;
      this.elementProps.children[this.elementProps.children.length - 1].children.push({
        tag: "vbox",
        styles: { margin: "10px" },
        children: [{
          tag: "button",
          namespace: "html",
          id,
          attributes: {
            type: "button",
            "data-l10n-id": label
          },
          properties: { innerHTML: label },
          listeners: [{
            type: "click",
            listener: (e) => {
              this.dialogData._lastButtonId = id;
              if (options.callback) options.callback(e);
              if (!options.noClose) this.window.close();
            }
          }]
        }]
      });
      return this;
    }
    /**
    * Dialog data.
    * @remarks
    * This object is passed to the dialog window.
    *
    * The control button id is in `dialogData._lastButtonId`;
    *
    * The data-binding values are in `dialogData`.
    * ```ts
    * interface DialogData {
    *   [key: string | number | symbol]: any;
    *   loadLock?: { promise: Promise<void>; resolve: () => void; isResolved: () => boolean }; // resolve after window load (auto-generated)
    *   loadCallback?: Function; // called after window load
    *   unloadLock?: { promise: Promise<void>; resolve: () => void }; // resolve after window unload (auto-generated)
    *   unloadCallback?: Function; // called after window unload
    *   beforeUnloadCallback?: Function; // called before window unload when elements are accessable.
    * }
    * ```
    * @param dialogData
    */
    setDialogData(dialogData) {
      this.dialogData = dialogData;
      return this;
    }
    /**
    * Open the dialog
    * @param title Window title
    * @param windowFeatures
    * @param windowFeatures.width Ignored if fitContent is `true`.
    * @param windowFeatures.height Ignored if fitContent is `true`.
    * @param windowFeatures.left
    * @param windowFeatures.top
    * @param windowFeatures.centerscreen Open window at the center of screen.
    * @param windowFeatures.resizable If window is resizable.
    * @param windowFeatures.fitContent Resize the window to content size after elements are loaded.
    * @param windowFeatures.noDialogMode Dialog mode window only has a close button. Set `true` to make maximize and minimize button visible.
    * @param windowFeatures.alwaysRaised Is the window always at the top.
    */
    open(title, windowFeatures = {
      centerscreen: true,
      resizable: true,
      fitContent: true
    }) {
      this.window = openDialog(this, `dialog-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`, title, this.elementProps, this.dialogData, windowFeatures);
      return this;
    }
  };
  function openDialog(dialogHelper, targetId, title, elementProps, dialogData, windowFeatures = {
    centerscreen: true,
    resizable: true,
    fitContent: true
  }) {
    dialogData = dialogData || {};
    if (!dialogData.loadLock) {
      let loadResolve;
      let isLoadResolved = false;
      const loadPromise = new Promise((resolve) => {
        loadResolve = resolve;
      });
      loadPromise.then(() => {
        isLoadResolved = true;
      });
      dialogData.loadLock = {
        promise: loadPromise,
        resolve: loadResolve,
        isResolved: () => isLoadResolved
      };
    }
    if (!dialogData.unloadLock) {
      let unloadResolve;
      const unloadPromise = new Promise((resolve) => {
        unloadResolve = resolve;
      });
      dialogData.unloadLock = {
        promise: unloadPromise,
        resolve: unloadResolve
      };
    }
    let featureString = `resizable=${windowFeatures.resizable ? "yes" : "no"},`;
    if (windowFeatures.width || windowFeatures.height) featureString += `width=${windowFeatures.width || 100},height=${windowFeatures.height || 100},`;
    if (windowFeatures.left) featureString += `left=${windowFeatures.left},`;
    if (windowFeatures.top) featureString += `top=${windowFeatures.top},`;
    if (windowFeatures.centerscreen) featureString += "centerscreen,";
    if (windowFeatures.noDialogMode) featureString += "dialog=no,";
    if (windowFeatures.alwaysRaised) featureString += "alwaysRaised=yes,";
    const win = dialogHelper.getGlobal("openDialog")("about:blank", targetId || "_blank", featureString, dialogData);
    dialogData.loadLock?.promise.then(() => {
      win.document.head.appendChild(dialogHelper.createElement(win.document, "title", {
        properties: { innerText: title },
        attributes: { "data-l10n-id": title }
      }));
      let l10nFiles = dialogData.l10nFiles || [];
      if (typeof l10nFiles === "string") l10nFiles = [l10nFiles];
      l10nFiles.forEach((file) => {
        win.document.head.appendChild(dialogHelper.createElement(win.document, "link", { properties: {
          rel: "localization",
          href: file
        } }));
      });
      dialogHelper.appendElement({
        tag: "fragment",
        children: [
          {
            tag: "style",
            properties: { innerHTML: style }
          },
          {
            tag: "link",
            properties: {
              rel: "stylesheet",
              href: "chrome://global/skin/global.css"
            }
          },
          {
            tag: "link",
            properties: {
              rel: "stylesheet",
              href: "chrome://zotero-platform/content/zotero.css"
            }
          }
        ]
      }, win.document.head);
      replaceElement(elementProps, dialogHelper);
      win.document.body.appendChild(dialogHelper.createElement(win.document, "fragment", { children: [elementProps] }));
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach((elem) => {
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData && dialogData[bindKey]) if (bindProp) elem[bindProp] = dialogData[bindKey];
        else elem.setAttribute(bindAttr || "value", dialogData[bindKey]);
      });
      if (windowFeatures.fitContent) setTimeout(() => {
        win.sizeToContent();
      }, 300);
      win.focus();
    }).then(() => {
      dialogData?.loadCallback && dialogData.loadCallback();
    });
    dialogData.unloadLock?.promise.then(() => {
      dialogData?.unloadCallback && dialogData.unloadCallback();
    });
    win.addEventListener("DOMContentLoaded", function onWindowLoad(_ev) {
      win.arguments[0]?.loadLock?.resolve();
      win.removeEventListener("DOMContentLoaded", onWindowLoad, false);
    }, false);
    win.addEventListener("beforeunload", function onWindowBeforeUnload(_ev) {
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach((elem) => {
        const dialogData$1 = this.window.arguments[0];
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData$1) if (bindProp) dialogData$1[bindKey] = elem[bindProp];
        else dialogData$1[bindKey] = elem.getAttribute(bindAttr || "value");
      });
      this.window.removeEventListener("beforeunload", onWindowBeforeUnload, false);
      dialogData?.beforeUnloadCallback && dialogData.beforeUnloadCallback();
    });
    win.addEventListener("unload", function onWindowUnload(_ev) {
      if (!this.window.arguments[0]?.loadLock?.isResolved()) return;
      this.window.arguments[0]?.unloadLock?.resolve();
      this.window.removeEventListener("unload", onWindowUnload, false);
    });
    if (win.document.readyState === "complete") win.arguments[0]?.loadLock?.resolve();
    return win;
  }
  function replaceElement(elementProps, uiTool) {
    let checkChildren = true;
    if (elementProps.tag === "select") {
      let is140 = false;
      try {
        is140 = Number.parseInt(Services.appinfo.platformVersion.match(/^\d+/)[0]) >= 140;
      } catch {
        is140 = false;
      }
      if (!is140) {
        checkChildren = false;
        const customSelectProps = {
          tag: "div",
          classList: ["dropdown"],
          listeners: [{
            type: "mouseleave",
            listener: (ev) => {
              const select = ev.target.querySelector("select");
              select?.blur();
            }
          }],
          children: [Object.assign({}, elementProps, {
            tag: "select",
            listeners: [{
              type: "focus",
              listener: (ev) => {
                const select = ev.target;
                const dropdown = select.parentElement?.querySelector(".dropdown-content");
                dropdown && (dropdown.style.display = "block");
                select.setAttribute("focus", "true");
              }
            }, {
              type: "blur",
              listener: (ev) => {
                const select = ev.target;
                const dropdown = select.parentElement?.querySelector(".dropdown-content");
                dropdown && (dropdown.style.display = "none");
                select.removeAttribute("focus");
              }
            }]
          }), {
            tag: "div",
            classList: ["dropdown-content"],
            children: elementProps.children?.map((option) => ({
              tag: "p",
              attributes: { value: option.properties?.value },
              properties: { innerHTML: option.properties?.innerHTML || option.properties?.textContent },
              classList: ["dropdown-item"],
              listeners: [{
                type: "click",
                listener: (ev) => {
                  const select = ev.target.parentElement?.previousElementSibling;
                  select && (select.value = ev.target.getAttribute("value") || "");
                  select?.blur();
                }
              }]
            }))
          }]
        };
        for (const key in elementProps) delete elementProps[key];
        Object.assign(elementProps, customSelectProps);
      } else {
        const children = elementProps.children || [];
        const randomString2 = CSS.escape(`${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`);
        if (!elementProps.id) elementProps.id = `select-${randomString2}`;
        const selectId = elementProps.id;
        const popupId = `popup-${randomString2}`;
        const popup = uiTool.appendElement({
          tag: "menupopup",
          namespace: "xul",
          id: popupId,
          children: children.map((option) => ({
            tag: "menuitem",
            attributes: {
              value: option.properties?.value,
              label: option.properties?.innerHTML || option.properties?.textContent
            }
          })),
          listeners: [{
            type: "command",
            listener: (ev) => {
              if (ev.target?.tagName !== "menuitem") return;
              const select = uiTool.window.document.getElementById(selectId);
              const menuitem = ev.target;
              if (select) {
                select.value = menuitem.getAttribute("value") || "";
                select.blur();
              }
              popup.hidePopup();
            }
          }]
        }, uiTool.window.document.body);
        if (!elementProps.listeners) elementProps.listeners = [];
        elementProps.listeners.push(...[{
          type: "click",
          listener: (ev) => {
            const select = ev.target;
            const rect = select.getBoundingClientRect();
            let left = rect.left + uiTool.window.scrollX;
            let top = rect.bottom + uiTool.window.scrollY;
            if (uiTool.getGlobal("Zotero").isMac) {
              left += uiTool.window.screenLeft;
              top += uiTool.window.screenTop + rect.height;
            }
            fixMenuPopup(popup, uiTool);
            popup.openPopup(null, "", left, top, false, false);
            select.setAttribute("focus", "true");
          }
        }]);
      }
    } else if (elementProps.tag === "a") {
      const href = elementProps?.properties?.href || "";
      elementProps.properties ??= {};
      elementProps.properties.href = "javascript:void(0);";
      elementProps.attributes ??= {};
      elementProps.attributes["zotero-href"] = href;
      elementProps.listeners ??= [];
      elementProps.listeners.push({
        type: "click",
        listener: (ev) => {
          const href$1 = ev.target?.getAttribute("zotero-href");
          href$1 && uiTool.getGlobal("Zotero").launchURL(href$1);
        }
      });
      elementProps.classList ??= [];
      elementProps.classList.push("zotero-text-link");
    }
    if (checkChildren) elementProps.children?.forEach((child) => replaceElement(child, uiTool));
  }
  var style = `
html {
  color-scheme: light dark;
}
.zotero-text-link {
  -moz-user-focus: normal;
  color: -moz-nativehyperlinktext;
  text-decoration: underline;
  border: 1px solid transparent;
  cursor: pointer;
}
.dropdown {
  position: relative;
  display: inline-block;
}
.dropdown-content {
  display: none;
  position: absolute;
  background-color: var(--material-toolbar);
  min-width: 160px;
  box-shadow: 0px 0px 5px 0px rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  padding: 5px 0 5px 0;
  z-index: 999;
}
.dropdown-item {
  margin: 0px;
  padding: 5px 10px 5px 10px;
}
.dropdown-item:hover {
  background-color: var(--fill-quinary);
}
`;
  function fixMenuPopup(popup, uiTool) {
    for (const item of popup.querySelectorAll("menuitem")) if (!item.innerHTML) uiTool.appendElement({
      tag: "fragment",
      children: [
        {
          tag: "image",
          namespace: "xul",
          classList: ["menu-icon"],
          attributes: { "aria-hidden": "true" }
        },
        {
          tag: "label",
          namespace: "xul",
          classList: ["menu-text"],
          properties: { value: item.getAttribute("label") || "" },
          attributes: {
            crop: "end",
            "aria-hidden": "true"
          }
        },
        {
          tag: "label",
          namespace: "xul",
          classList: ["menu-highlightable-text"],
          properties: { textContent: item.getAttribute("label") || "" },
          attributes: {
            crop: "end",
            "aria-hidden": "true"
          }
        },
        {
          tag: "label",
          namespace: "xul",
          classList: ["menu-accel"],
          attributes: { "aria-hidden": "true" }
        }
      ]
    }, item);
  }
  var FilePickerHelper = class extends BasicTool {
    title;
    mode;
    filters;
    suggestion;
    directory;
    window;
    filterMask;
    constructor(title, mode, filters, suggestion, window$1, filterMask, directory) {
      super();
      this.title = title;
      this.mode = mode;
      this.filters = filters;
      this.suggestion = suggestion;
      this.directory = directory;
      this.window = window$1;
      this.filterMask = filterMask;
    }
    async open() {
      const Backend = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs").FilePicker;
      const fp = new Backend();
      fp.init(this.window || this.getGlobal("window"), this.title, this.getMode(fp));
      for (const [label, ext] of this.filters || []) fp.appendFilter(label, ext);
      if (this.filterMask) fp.appendFilters(this.getFilterMask(fp));
      if (this.suggestion) fp.defaultString = this.suggestion;
      if (this.directory) fp.displayDirectory = this.directory;
      const userChoice = await fp.show();
      switch (userChoice) {
        case fp.returnOK:
        case fp.returnReplace:
          return this.mode === "multiple" ? fp.files : fp.file;
        default:
          return false;
      }
    }
    getMode(fp) {
      switch (this.mode) {
        case "open":
          return fp.modeOpen;
        case "save":
          return fp.modeSave;
        case "folder":
          return fp.modeGetFolder;
        case "multiple":
          return fp.modeOpenMultiple;
        default:
          return 0;
      }
    }
    getFilterMask(fp) {
      switch (this.filterMask) {
        case "all":
          return fp.filterAll;
        case "html":
          return fp.filterHTML;
        case "text":
          return fp.filterText;
        case "images":
          return fp.filterImages;
        case "xml":
          return fp.filterXML;
        case "apps":
          return fp.filterApps;
        case "urls":
          return fp.filterAllowURLs;
        case "audio":
          return fp.filterAudio;
        case "video":
          return fp.filterVideo;
        default:
          return 1;
      }
    }
  };
  var GuideHelper = class extends BasicTool {
    _steps = [];
    constructor() {
      super();
    }
    addStep(step) {
      this._steps.push(step);
      return this;
    }
    addSteps(steps) {
      this._steps.push(...steps);
      return this;
    }
    async show(doc) {
      if (!doc?.ownerGlobal) throw new Error("Document is required.");
      const guide = new Guide(doc.ownerGlobal);
      await guide.show(this._steps);
      const promise = new Promise((resolve) => {
        guide._panel.addEventListener("guide-finished", () => resolve(guide));
      });
      await promise;
      return guide;
    }
    async highlight(doc, step) {
      if (!doc?.ownerGlobal) throw new Error("Document is required.");
      const guide = new Guide(doc.ownerGlobal);
      await guide.show([step]);
      const promise = new Promise((resolve) => {
        guide._panel.addEventListener("guide-finished", () => resolve(guide));
      });
      await promise;
      return guide;
    }
  };
  var Guide = class {
    _window;
    _id = `guide-${Zotero.Utilities.randomString()}`;
    _panel;
    _header;
    _body;
    _footer;
    _progress;
    _closeButton;
    _prevButton;
    _nextButton;
    _steps;
    _noClose;
    _closed;
    _autoNext;
    _currentIndex;
    initialized;
    _cachedMasks = [];
    get content() {
      return this._window.MozXULElement.parseXULToFragment(`
      <panel id="${this._id}" class="guide-panel" type="arrow" align="top" noautohide="true">
          <html:div class="guide-panel-content">
              <html:div class="guide-panel-header"></html:div>
              <html:div class="guide-panel-body"></html:div>
              <html:div class="guide-panel-footer">
                  <html:div class="guide-panel-progress"></html:div>
                  <html:div class="guide-panel-buttons">
                      <button id="prev-button" class="guide-panel-button" hidden="true"></button>
                      <button id="next-button" class="guide-panel-button" hidden="true"></button>
                      <button id="close-button" class="guide-panel-button" hidden="true"></button>
                  </html:div>
              </html:div>
          </html:div>
          <html:style>
              .guide-panel {
                  background-color: var(--material-menu);
                  color: var(--fill-primary);
              }
              .guide-panel-content {
                  display: flex;
                  flex-direction: column;
                  padding: 0;
              }
              .guide-panel-header {
                  font-size: 1.2em;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              .guide-panel-header:empty {
                display: none;
              }
              .guide-panel-body {
                  align-items: center;
                  display: flex;
                  flex-direction: column;
                  white-space: pre-wrap;
              }
              .guide-panel-body:empty {
                display: none;
              }
              .guide-panel-footer {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  margin-top: 10px;
              }
              .guide-panel-progress {
                  font-size: 0.8em;
              }
              .guide-panel-buttons {
                  display: flex;
                  flex-direction: row;
                  flex-grow: 1;
                  justify-content: flex-end;
              }
          </html:style>
      </panel>
  `);
    }
    get currentStep() {
      if (!this._steps) return void 0;
      return this._steps[this._currentIndex];
    }
    get currentTarget() {
      const step = this.currentStep;
      if (!step?.element) return void 0;
      let elem;
      if (typeof step.element === "function") elem = step.element();
      else if (typeof step.element === "string") elem = this._window.document.querySelector(step.element);
      else if (!step.element) elem = this._window.document.documentElement || void 0;
      else elem = step.element;
      return elem;
    }
    get hasNext() {
      return this._steps && this._currentIndex < this._steps.length - 1;
    }
    get hasPrevious() {
      return this._steps && this._currentIndex > 0;
    }
    get hookProps() {
      return {
        config: this.currentStep,
        state: {
          step: this._currentIndex,
          steps: this._steps,
          controller: this
        }
      };
    }
    get panel() {
      return this._panel;
    }
    constructor(win) {
      this._window = win;
      this._noClose = false;
      this._closed = false;
      this._autoNext = true;
      this._currentIndex = 0;
      const doc = win.document;
      const content = this.content;
      if (content) doc.documentElement?.append(doc.importNode(content, true));
      this._panel = doc.querySelector(`#${this._id}`);
      this._header = this._panel.querySelector(".guide-panel-header");
      this._body = this._panel.querySelector(".guide-panel-body");
      this._footer = this._panel.querySelector(".guide-panel-footer");
      this._progress = this._panel.querySelector(".guide-panel-progress");
      this._closeButton = this._panel.querySelector("#close-button");
      this._prevButton = this._panel.querySelector("#prev-button");
      this._nextButton = this._panel.querySelector("#next-button");
      this._closeButton.addEventListener("click", async () => {
        if (this.currentStep?.onCloseClick) await this.currentStep.onCloseClick(this.hookProps);
        this.abort();
      });
      this._prevButton.addEventListener("click", async () => {
        if (this.currentStep?.onPrevClick) await this.currentStep.onPrevClick(this.hookProps);
        this.movePrevious();
      });
      this._nextButton.addEventListener("click", async () => {
        if (this.currentStep?.onNextClick) await this.currentStep.onNextClick(this.hookProps);
        this.moveNext();
      });
      this._panel.addEventListener("popupshown", this._handleShown.bind(this));
      this._panel.addEventListener("popuphidden", this._handleHidden.bind(this));
      this._window.addEventListener("resize", this._centerPanel);
    }
    async show(steps) {
      if (steps) {
        this._steps = steps;
        this._currentIndex = 0;
      }
      const index = this._currentIndex;
      this._noClose = false;
      this._closed = false;
      this._autoNext = true;
      const step = this.currentStep;
      if (!step) return;
      const elem = this.currentTarget;
      if (step.onBeforeRender) {
        await step.onBeforeRender(this.hookProps);
        if (index !== this._currentIndex) {
          await this.show();
          return;
        }
      }
      if (step.onMask) step.onMask({ mask: (_e) => this._createMask(_e) });
      else this._createMask(elem);
      let x;
      let y = 0;
      let position = step.position || "after_start";
      if (position === "center") {
        position = "overlap";
        x = this._window.innerWidth / 2;
        y = this._window.innerHeight / 2;
      }
      this._panel.openPopup(elem, step.position || "after_start", x, y, false, false);
    }
    hide() {
      this._panel.hidePopup();
    }
    abort() {
      this._closed = true;
      this.hide();
      this._steps = void 0;
    }
    moveTo(stepIndex) {
      if (!this._steps) {
        this.hide();
        return;
      }
      if (stepIndex < 0) stepIndex = 0;
      if (!this._steps[stepIndex]) {
        this._currentIndex = this._steps.length;
        this.hide();
        return;
      }
      this._autoNext = false;
      this._noClose = true;
      this.hide();
      this._noClose = false;
      this._autoNext = true;
      this._currentIndex = stepIndex;
      this.show();
    }
    moveNext() {
      this.moveTo(this._currentIndex + 1);
    }
    movePrevious() {
      this.moveTo(this._currentIndex - 1);
    }
    _handleShown() {
      if (!this._steps) return;
      const step = this.currentStep;
      if (!step) return;
      this._header.innerHTML = step.title || "";
      this._body.innerHTML = step.description || "";
      this._panel.querySelectorAll(".guide-panel-button").forEach((elem) => {
        elem.hidden = true;
        elem.disabled = false;
      });
      let showButtons = step.showButtons;
      if (!showButtons) {
        showButtons = [];
        if (this.hasPrevious) showButtons.push("prev");
        if (this.hasNext) showButtons.push("next");
        else showButtons.push("close");
      }
      if (showButtons?.length) showButtons.forEach((btn) => {
        this._panel.querySelector(`#${btn}-button`).hidden = false;
      });
      if (step.disableButtons) step.disableButtons.forEach((btn) => {
        this._panel.querySelector(`#${btn}-button`).disabled = true;
      });
      if (step.showProgress) {
        this._progress.hidden = false;
        this._progress.textContent = step.progressText || `${this._currentIndex + 1}/${this._steps.length}`;
      } else this._progress.hidden = true;
      this._closeButton.label = step.closeBtnText || "Done";
      this._nextButton.label = step.nextBtnText || "Next";
      this._prevButton.label = step.prevBtnText || "Previous";
      if (step.onRender) step.onRender(this.hookProps);
      if (step.position === "center") {
        this._centerPanel();
        this._window.setTimeout(this._centerPanel, 10);
      }
    }
    async _handleHidden() {
      this._removeMask();
      this._header.innerHTML = "";
      this._body.innerHTML = "";
      this._progress.textContent = "";
      if (!this._steps) return;
      const step = this.currentStep;
      if (step && step.onExit) await step.onExit(this.hookProps);
      if (!this._noClose && (this._closed || !this.hasNext)) {
        this._panel.dispatchEvent(new this._window.CustomEvent("guide-finished"));
        this._panel.remove();
        this._window.removeEventListener("resize", this._centerPanel);
        return;
      }
      if (this._autoNext) this.moveNext();
    }
    _centerPanel = () => {
      const win = this._window;
      this._panel.moveTo(win.screenX + win.innerWidth / 2 - this._panel.clientWidth / 2, win.screenY + win.innerHeight / 2 - this._panel.clientHeight / 2);
    };
    _createMask(targetElement) {
      const doc = targetElement?.ownerDocument || this._window.document;
      const NS = "http://www.w3.org/2000/svg";
      const svg = doc.createElementNS(NS, "svg");
      svg.id = "guide-panel-mask";
      svg.style.position = "fixed";
      svg.style.top = "0";
      svg.style.left = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.zIndex = "9999";
      const mask = doc.createElementNS(NS, "mask");
      mask.id = "mask";
      const fullRect = doc.createElementNS(NS, "rect");
      fullRect.setAttribute("x", "0");
      fullRect.setAttribute("y", "0");
      fullRect.setAttribute("width", "100%");
      fullRect.setAttribute("height", "100%");
      fullRect.setAttribute("fill", "white");
      mask.appendChild(fullRect);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const targetRect = doc.createElementNS(NS, "rect");
        targetRect.setAttribute("x", rect.left.toString());
        targetRect.setAttribute("y", rect.top.toString());
        targetRect.setAttribute("width", rect.width.toString());
        targetRect.setAttribute("height", rect.height.toString());
        targetRect.setAttribute("fill", "black");
        mask.appendChild(targetRect);
      }
      const maskedRect = doc.createElementNS(NS, "rect");
      maskedRect.setAttribute("x", "0");
      maskedRect.setAttribute("y", "0");
      maskedRect.setAttribute("width", "100%");
      maskedRect.setAttribute("height", "100%");
      maskedRect.setAttribute("mask", "url(#mask)");
      maskedRect.setAttribute("opacity", "0.7");
      svg.appendChild(mask);
      svg.appendChild(maskedRect);
      this._cachedMasks.push(new WeakRef(svg));
      doc.documentElement?.appendChild(svg);
    }
    _removeMask() {
      this._cachedMasks.forEach((ref) => {
        const mask = ref.deref();
        if (mask) mask.remove();
      });
      this._cachedMasks = [];
    }
  };
  var LargePrefHelper = class extends BasicTool {
    keyPref;
    valuePrefPrefix;
    innerObj;
    hooks;
    /**
    *
    * @param keyPref The preference name for storing the keys of the data.
    * @param valuePrefPrefix The preference name prefix for storing the values of the data.
    * @param hooks Hooks for parsing the values of the data.
    * - `afterGetValue`: A function that takes the value of the data as input and returns the parsed value.
    * - `beforeSetValue`: A function that takes the key and value of the data as input and returns the parsed key and value.
    * If `hooks` is `"default"`, no parsing will be done.
    * If `hooks` is `"parser"`, the values will be parsed as JSON.
    * If `hooks` is an object, the values will be parsed by the hooks.
    */
    constructor(keyPref, valuePrefPrefix, hooks = "default") {
      super();
      this.keyPref = keyPref;
      this.valuePrefPrefix = valuePrefPrefix;
      if (hooks === "default") this.hooks = defaultHooks;
      else if (hooks === "parser") this.hooks = parserHooks;
      else this.hooks = {
        ...defaultHooks,
        ...hooks
      };
      this.innerObj = {};
    }
    /**
    * Get the object that stores the data.
    * @returns The object that stores the data.
    */
    asObject() {
      return this.constructTempObj();
    }
    /**
    * Get the Map that stores the data.
    * @returns The Map that stores the data.
    */
    asMapLike() {
      const mapLike = {
        get: (key) => this.getValue(key),
        set: (key, value) => {
          this.setValue(key, value);
          return mapLike;
        },
        has: (key) => this.hasKey(key),
        delete: (key) => this.deleteKey(key),
        clear: () => {
          for (const key of this.getKeys()) this.deleteKey(key);
        },
        forEach: (callback) => {
          return this.constructTempMap().forEach(callback);
        },
        get size() {
          return this._this.getKeys().length;
        },
        entries: () => {
          return this.constructTempMap().values();
        },
        keys: () => {
          const keys = this.getKeys();
          return keys[Symbol.iterator]();
        },
        values: () => {
          return this.constructTempMap().values();
        },
        [Symbol.iterator]: () => {
          return this.constructTempMap()[Symbol.iterator]();
        },
        [Symbol.toStringTag]: "MapLike",
        _this: this
      };
      return mapLike;
    }
    /**
    * Get the keys of the data.
    * @returns The keys of the data.
    */
    getKeys() {
      const rawKeys = Zotero.Prefs.get(this.keyPref, true);
      const keys = rawKeys ? JSON.parse(rawKeys) : [];
      for (const key of keys) {
        const value = "placeholder";
        this.innerObj[key] = value;
      }
      return keys;
    }
    /**
    * Set the keys of the data.
    * @param keys The keys of the data.
    */
    setKeys(keys) {
      keys = [...new Set(keys.filter((key) => key))];
      Zotero.Prefs.set(this.keyPref, JSON.stringify(keys), true);
      for (const key of keys) {
        const value = "placeholder";
        this.innerObj[key] = value;
      }
    }
    /**
    * Get the value of a key.
    * @param key The key of the data.
    * @returns The value of the key.
    */
    getValue(key) {
      const value = Zotero.Prefs.get(`${this.valuePrefPrefix}${key}`, true);
      if (typeof value === "undefined") return;
      const { value: newValue } = this.hooks.afterGetValue({ value });
      this.innerObj[key] = newValue;
      return newValue;
    }
    /**
    * Set the value of a key.
    * @param key The key of the data.
    * @param value The value of the key.
    */
    setValue(key, value) {
      const { key: newKey, value: newValue } = this.hooks.beforeSetValue({
        key,
        value
      });
      this.setKey(newKey);
      Zotero.Prefs.set(`${this.valuePrefPrefix}${newKey}`, newValue, true);
      this.innerObj[newKey] = newValue;
    }
    /**
    * Check if a key exists.
    * @param key The key of the data.
    * @returns Whether the key exists.
    */
    hasKey(key) {
      return this.getKeys().includes(key);
    }
    /**
    * Add a key.
    * @param key The key of the data.
    */
    setKey(key) {
      const keys = this.getKeys();
      if (!keys.includes(key)) {
        keys.push(key);
        this.setKeys(keys);
      }
    }
    /**
    * Delete a key.
    * @param key The key of the data.
    */
    deleteKey(key) {
      const keys = this.getKeys();
      const index = keys.indexOf(key);
      if (index > -1) {
        keys.splice(index, 1);
        delete this.innerObj[key];
        this.setKeys(keys);
      }
      Zotero.Prefs.clear(`${this.valuePrefPrefix}${key}`, true);
      return true;
    }
    constructTempObj() {
      return new Proxy(this.innerObj, {
        get: (target, prop, receiver) => {
          this.getKeys();
          if (typeof prop === "string" && prop in target) this.getValue(prop);
          return Reflect.get(target, prop, receiver);
        },
        set: (target, p, newValue, receiver) => {
          if (typeof p === "string") {
            if (newValue === void 0) {
              this.deleteKey(p);
              return true;
            }
            this.setValue(p, newValue);
            return true;
          }
          return Reflect.set(target, p, newValue, receiver);
        },
        has: (target, p) => {
          this.getKeys();
          return Reflect.has(target, p);
        },
        deleteProperty: (target, p) => {
          if (typeof p === "string") {
            this.deleteKey(p);
            return true;
          }
          return Reflect.deleteProperty(target, p);
        }
      });
    }
    constructTempMap() {
      const map = /* @__PURE__ */ new Map();
      for (const key of this.getKeys()) map.set(key, this.getValue(key));
      return map;
    }
  };
  var defaultHooks = {
    afterGetValue: ({ value }) => ({ value }),
    beforeSetValue: ({ key, value }) => ({
      key,
      value
    })
  };
  var parserHooks = {
    afterGetValue: ({ value }) => {
      try {
        value = JSON.parse(value);
      } catch {
        return { value };
      }
      return { value };
    },
    beforeSetValue: ({ key, value }) => {
      value = JSON.stringify(value);
      return {
        key,
        value
      };
    }
  };
  var PatchHelper = class extends BasicTool {
    options;
    constructor() {
      super();
      this.options = void 0;
    }
    setData(options) {
      this.options = options;
      const Zotero$1 = this.getGlobal("Zotero");
      const { target, funcSign, patcher } = options;
      const origin = target[funcSign];
      this.log("patching ", funcSign);
      target[funcSign] = function(...args) {
        if (options.enabled) try {
          return patcher(origin).apply(this, args);
        } catch (e) {
          Zotero$1.logError(e);
        }
        return origin.apply(this, args);
      };
      return this;
    }
    enable() {
      if (!this.options) throw new Error("No patch data set");
      this.options.enabled = true;
      return this;
    }
    disable() {
      if (!this.options) throw new Error("No patch data set");
      this.options.enabled = false;
      return this;
    }
  };
  var icons = {
    success: "chrome://zotero/skin/tick.png",
    fail: "chrome://zotero/skin/cross.png"
  };
  var ProgressWindowHelper = class {
    win;
    lines;
    closeTime;
    /**
    *
    * @param header window header
    * @param options
    * @param options.window
    * @param options.closeOnClick
    * @param options.closeTime
    * @param options.closeOtherProgressWindows
    */
    constructor(header, options = {
      closeOnClick: true,
      closeTime: 5e3
    }) {
      this.win = new (BasicTool.getZotero()).ProgressWindow(options);
      this.lines = [];
      this.closeTime = options.closeTime || 5e3;
      this.win.changeHeadline(header);
      if (options.closeOtherProgressWindows) BasicTool.getZotero().ProgressWindowSet.closeAll();
    }
    /**
    * Create a new line
    * @param options
    * @param options.type
    * @param options.icon
    * @param options.text
    * @param options.progress
    * @param options.idx
    */
    createLine(options) {
      const icon = this.getIcon(options.type, options.icon);
      const line = new this.win.ItemProgress(icon || "", options.text || "");
      if (typeof options.progress === "number") line.setProgress(options.progress);
      this.lines.push(line);
      this.updateIcons();
      return this;
    }
    /**
    * Change the line content
    * @param options
    * @param options.type
    * @param options.icon
    * @param options.text
    * @param options.progress
    * @param options.idx
    */
    changeLine(options) {
      if (this.lines?.length === 0) return this;
      const idx = typeof options.idx !== "undefined" && options.idx >= 0 && options.idx < this.lines.length ? options.idx : 0;
      const icon = this.getIcon(options.type, options.icon);
      if (icon) this.lines[idx].setItemTypeAndIcon(icon);
      options.text && this.lines[idx].setText(options.text);
      typeof options.progress === "number" && this.lines[idx].setProgress(options.progress);
      this.updateIcons();
      return this;
    }
    show(closeTime = void 0) {
      this.win.show();
      typeof closeTime !== "undefined" && (this.closeTime = closeTime);
      if (this.closeTime && this.closeTime > 0) this.win.startCloseTimer(this.closeTime);
      setTimeout(this.updateIcons.bind(this), 50);
      return this;
    }
    /**
    * Set custom icon uri for progress window
    * @param key
    * @param uri
    */
    static setIconURI(key, uri) {
      icons[key] = uri;
    }
    getIcon(type, defaultIcon) {
      return type && type in icons ? icons[type] : defaultIcon;
    }
    updateIcons() {
      try {
        this.lines.forEach((line) => {
          const box = line._image;
          const icon = box.dataset.itemType;
          if (icon && !box.style.backgroundImage.includes("progress_arcs")) box.style.backgroundImage = `url(${box.dataset.itemType})`;
        });
      } catch {
      }
    }
    changeHeadline(text, icon, postText) {
      this.win.changeHeadline(text, icon, postText);
      return this;
    }
    addLines(labels, icons$1) {
      this.win.addLines(labels, icons$1);
      return this;
    }
    addDescription(text) {
      this.win.addDescription(text);
      return this;
    }
    startCloseTimer(ms, requireMouseOver) {
      this.win.startCloseTimer(ms, requireMouseOver);
      return this;
    }
    close() {
      this.win.close();
      return this;
    }
  };
  var SettingsDialogHelper = class extends DialogHelper {
    settingsHandlers = null;
    autoSaveButtonIds = /* @__PURE__ */ new Set();
    settingBindings = /* @__PURE__ */ new Map();
    /**
    * Create a settings dialog helper.
    * Uses a 2-column grid layout by default (label column + control column)
    */
    constructor() {
      super(1, 2);
      this.elementProps = {
        tag: "vbox",
        attributes: { flex: 1 },
        styles: {
          width: "100%",
          height: "100%",
          padding: "20px"
        },
        children: [{
          tag: "div",
          classList: ["settings-grid"],
          styles: {
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "15px 20px",
            alignItems: "center",
            marginBottom: "20px"
          },
          children: []
        }, {
          tag: "hbox",
          attributes: {
            flex: 0,
            pack: "end"
          },
          styles: { marginTop: "20px" },
          children: []
        }]
      };
    }
    /**
    * Set the setting handlers for getting and setting values.
    * @param getSetting Function to get a setting value by key
    * @param setSetting Function to set a setting value by key
    */
    setSettingHandlers(getSetting, setSetting) {
      this.settingsHandlers = {
        getSetting,
        setSetting
      };
      return this;
    }
    /**
    * Add a setting row with label and form control.
    * @param label Label text for the setting
    * @param settingKey The key used to store/retrieve the setting
    * @param controlProps Properties for the form control element
    * @param options Additional options
    * @param options.valueType Type of the setting value for proper conversion
    * @param options.labelProps Properties for the label element
    * @param options.condition Optional condition function to determine if the setting should be added
    *                          (returns true to add, false to skip)
    * @returns The SettingsDialogHelper instance for chaining
    */
    addSetting(label, settingKey, controlProps, options = {}) {
      const { valueType = "string", labelProps = {}, condition } = options;
      if (condition && !condition()) return this;
      const controlId = `setting-${settingKey}-${Zotero.Utilities.randomString()}`;
      this.settingBindings.set(controlId, {
        key: settingKey,
        valueType
      });
      const gridContainer = this.elementProps.children[0];
      const labelElement = {
        tag: "label",
        attributes: { for: controlId },
        properties: { textContent: label },
        styles: {
          fontWeight: "500",
          textAlign: "right",
          paddingRight: "10px"
        },
        ...labelProps
      };
      const controlElement = {
        ...controlProps,
        id: controlId,
        attributes: {
          ...controlProps.attributes,
          "data-setting-key": settingKey,
          "data-setting-type": valueType
        }
      };
      if (this.settingsHandlers) {
        const currentValue = this.settingsHandlers.getSetting(settingKey);
        this.setControlValue(controlElement, currentValue, valueType);
      }
      gridContainer.children.push(labelElement, controlElement);
      return this;
    }
    /**
    * Add a static row (label + static element) to the settings grid. This is not a form control.
    * @param label Label text for the row
    * @param staticElementProps Properties for the static element (e.g., text, icon, etc.)
    * @param options Additional options
    * @param options.labelProps Properties for the label element
    * @param options.condition Optional condition function to determine if the row should be added
    * @returns The SettingsDialogHelper instance for chaining
    */
    addStaticRow(label, staticElementProps, options = {}) {
      const { labelProps = {}, condition } = options;
      if (condition && !condition()) return this;
      const gridContainer = this.elementProps.children[0];
      const labelElement = {
        tag: "label",
        properties: { textContent: label },
        styles: {
          fontWeight: "500",
          textAlign: "right",
          paddingRight: "10px"
        },
        ...labelProps
      };
      const staticElement = {
        ...staticElementProps,
        attributes: { ...staticElementProps.attributes }
      };
      gridContainer.children.push(labelElement, staticElement);
      return this;
    }
    /**
    * Add a control button that will auto-save settings when clicked.
    * @param label Button label
    * @param id Button id
    * @param options Button options
    * @param options.noClose Don't close window when clicking this button
    * @param options.validate Validation function for settings data
    * @param options.callback Callback of button click event
    */
    addAutoSaveButton(label, id, options = {}) {
      id = id || `btn-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`;
      this.autoSaveButtonIds.add(id);
      return this.addButton(label, id, {
        ...Object.assign({}, options, { noClose: true }),
        callback: async (ev) => {
          if (options.validate) {
            const data2 = this.getAllSettingsData();
            const validationResult = await options.validate(data2);
            if (validationResult !== true) {
              this.window.alert(validationResult);
              return;
            }
          }
          this.saveAllSettings();
          if (options.callback) options.callback(ev);
          if (!options.noClose) this.window.close();
        }
      });
    }
    /**
    * Save all settings using the setting handlers.
    */
    saveAllSettings() {
      if (!this.settingsHandlers) {
        console.warn("SettingsDialog: No setting handlers configured");
        return;
      }
      const settingsData = this.getAllSettingsData();
      Object.entries(settingsData).forEach(([key, value]) => {
        this.settingsHandlers.setSetting(key, value);
      });
    }
    /**
    * Collect and return all current setting values from the dialog controls.
    */
    getAllSettingsData() {
      const data2 = {};
      if (this.window) {
        const settingControls = this.window.document.querySelectorAll("[data-setting-key]");
        settingControls.forEach((control) => {
          const settingKey = control.getAttribute("data-setting-key");
          const valueType = control.getAttribute("data-setting-type");
          if (settingKey) data2[settingKey] = this.getControlValue(control, valueType);
        });
      }
      return data2;
    }
    /**
    * Load all settings from the setting handlers.
    */
    loadAllSettings() {
      if (!this.settingsHandlers || !this.window) return;
      const settingControls = this.window.document.querySelectorAll("[data-setting-key]");
      settingControls.forEach((control) => {
        const settingKey = control.getAttribute("data-setting-key");
        const valueType = control.getAttribute("data-setting-type");
        if (settingKey) {
          const value = this.settingsHandlers.getSetting(settingKey);
          this.setControlValueOnElement(control, value, valueType);
        }
      });
    }
    /**
    * Override the open method to handle setting loading after window opens.
    */
    open(title, windowFeatures = {
      centerscreen: true,
      resizable: true,
      fitContent: true
    }) {
      const originalLoadCallback = this.dialogData.loadCallback;
      this.dialogData.loadCallback = () => {
        this.loadAllSettings();
        this.window.document.body.style.overflow = "hidden";
        if (windowFeatures.fitContent) this.window.sizeToContent();
        if (originalLoadCallback) originalLoadCallback();
      };
      const originalBeforeUnloadCallback = this.dialogData.beforeUnloadCallback;
      this.dialogData.beforeUnloadCallback = () => {
        if (this.dialogData._lastButtonId && this.autoSaveButtonIds.has(this.dialogData._lastButtonId)) this.saveAllSettings();
        if (originalBeforeUnloadCallback) originalBeforeUnloadCallback();
      };
      return super.open(title, windowFeatures);
    }
    /**
    * Set control value based on element type and value type.
    */
    setControlValue(element, value, _valueType) {
      if (value === void 0 || value === null) return;
      switch (element.tag) {
        case "input": {
          const inputType = element.attributes?.type || "text";
          if (inputType === "checkbox" || inputType === "radio") element.attributes = {
            ...element.attributes,
            checked: Boolean(value)
          };
          else element.attributes = {
            ...element.attributes,
            value: String(value)
          };
          break;
        }
        case "select":
          element.attributes = {
            ...element.attributes,
            value: String(value)
          };
          break;
        case "textarea":
          element.properties = {
            ...element.properties,
            value: String(value)
          };
          break;
        default:
          element.properties = {
            ...element.properties,
            textContent: String(value)
          };
      }
    }
    /**
    * Set control value on an actual DOM element.
    */
    setControlValueOnElement(element, value, _valueType) {
      if (value === void 0 || value === null) return;
      const tagName = element.tagName.toLowerCase();
      switch (tagName) {
        case "input": {
          const inputElement = element;
          if (inputElement.type === "checkbox" || inputElement.type === "radio") inputElement.checked = Boolean(value);
          else inputElement.value = String(value);
          break;
        }
        case "select":
          element.value = String(value);
          break;
        case "textarea":
          element.value = String(value);
          break;
        default:
          element.textContent = String(value);
      }
    }
    /**
    * Get control value from a DOM element with proper type conversion.
    */
    getControlValue(element, valueType) {
      const tagName = element.tagName.toLowerCase();
      let rawValue;
      switch (tagName) {
        case "input": {
          const inputElement = element;
          if (inputElement.type === "checkbox" || inputElement.type === "radio") rawValue = inputElement.checked;
          else rawValue = inputElement.value;
          break;
        }
        case "select":
          rawValue = element.value;
          break;
        case "textarea":
          rawValue = element.value;
          break;
        default:
          rawValue = element.textContent || "";
      }
      switch (valueType) {
        case "number":
          return typeof rawValue === "string" ? Number(rawValue) : rawValue;
        case "boolean":
          return typeof rawValue === "boolean" ? rawValue : Boolean(rawValue);
        case "string":
        default:
          return String(rawValue);
      }
    }
  };
  var VirtualizedTableHelper = class extends BasicTool {
    props;
    localeStrings;
    containerId;
    treeInstance;
    window;
    React;
    ReactDOM;
    VirtualizedTable;
    IntlProvider;
    constructor(win) {
      super();
      this.window = win;
      const Zotero$1 = this.getGlobal("Zotero");
      const _require = win.require;
      this.React = _require("react");
      this.ReactDOM = _require("react-dom");
      this.VirtualizedTable = _require("components/virtualized-table");
      this.IntlProvider = _require("react-intl").IntlProvider;
      this.props = {
        id: `vtable-${Zotero$1.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`,
        getRowCount: () => 0
      };
      this.localeStrings = Zotero$1.Intl.strings;
    }
    setProp(...args) {
      if (args.length === 1) Object.assign(this.props, args[0]);
      else if (args.length === 2) this.props[args[0]] = args[1];
      return this;
    }
    /**
    * Set locale strings, which replaces the table header's label if matches. Default it's `Zotero.Intl.strings`
    * @param localeStrings
    */
    setLocale(localeStrings) {
      Object.assign(this.localeStrings, localeStrings);
      return this;
    }
    /**
    * Set container element id that the table will be rendered on.
    * @param id element id
    */
    setContainerId(id) {
      this.containerId = id;
      return this;
    }
    /**
    * Render the table.
    * @param selectId Which row to select after rendering
    * @param onfulfilled callback after successfully rendered
    * @param onrejected callback after rendering with error
    */
    render(selectId, onfulfilled, onrejected) {
      const refreshSelection = () => {
        this.treeInstance.invalidate();
        if (typeof selectId !== "undefined" && selectId >= 0) this.treeInstance.selection.select(selectId);
        else this.treeInstance.selection.clearSelection();
      };
      if (!this.treeInstance) new Promise((resolve) => {
        const vtableProps = Object.assign({}, this.props, { ref: (ref) => {
          this.treeInstance = ref;
          resolve(void 0);
        } });
        if (vtableProps.getRowData && !vtableProps.renderItem) Object.assign(vtableProps, { renderItem: this.VirtualizedTable.makeRowRenderer(vtableProps.getRowData) });
        const elem = this.React.createElement(this.IntlProvider, {
          locale: Zotero.locale,
          messages: Zotero.Intl.strings
        }, this.React.createElement(this.VirtualizedTable, vtableProps));
        const container = this.window.document.getElementById(this.containerId);
        this.ReactDOM.createRoot(container).render(elem);
      }).then(() => {
        this.getGlobal("setTimeout")(() => {
          refreshSelection();
        });
      }).then(onfulfilled, onrejected);
      else refreshSelection();
      return this;
    }
  };
  var FieldHookManager = class extends ManagerTool {
    data = {
      getField: {},
      setField: {},
      isFieldOfBase: {}
    };
    patchHelpers = {
      getField: new PatchHelper(),
      setField: new PatchHelper(),
      isFieldOfBase: new PatchHelper()
    };
    constructor(base) {
      super(base);
      const _thisHelper = this;
      for (const type of Object.keys(this.patchHelpers)) {
        const helper = this.patchHelpers[type];
        helper.setData({
          target: this.getGlobal("Zotero").Item.prototype,
          funcSign: type,
          patcher: (original) => function(field, ...args) {
            const originalThis = this;
            const handler = _thisHelper.data[type][field];
            if (typeof handler === "function") try {
              return handler(field, args[0], args[1], originalThis, original);
            } catch (e) {
              return field + String(e);
            }
            return original.apply(originalThis, [field, ...args]);
          },
          enabled: true
        });
      }
    }
    register(type, field, hook) {
      this.data[type][field] = hook;
    }
    unregister(type, field) {
      delete this.data[type][field];
    }
    unregisterAll() {
      this.data.getField = {};
      this.data.setField = {};
      this.data.isFieldOfBase = {};
      this.patchHelpers.getField.disable();
      this.patchHelpers.setField.disable();
      this.patchHelpers.isFieldOfBase.disable();
    }
  };
  var wait_exports = {};
  __export2(wait_exports, {
    waitForReader: () => waitForReader,
    waitUntil: () => waitUntil,
    waitUntilAsync: () => waitUntilAsync,
    waitUtilAsync: () => waitUtilAsync
  });
  var basicTool = new BasicTool();
  function waitUntil(condition, callback, interval = 100, timeout = 1e4) {
    const start = Date.now();
    const intervalId = basicTool.getGlobal("setInterval")(() => {
      if (condition()) {
        basicTool.getGlobal("clearInterval")(intervalId);
        callback();
      } else if (Date.now() - start > timeout) basicTool.getGlobal("clearInterval")(intervalId);
    }, interval);
  }
  var waitUtilAsync = waitUntilAsync;
  function waitUntilAsync(condition, interval = 100, timeout = 1e4) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const intervalId = basicTool.getGlobal("setInterval")(() => {
        if (condition()) {
          basicTool.getGlobal("clearInterval")(intervalId);
          resolve();
        } else if (Date.now() - start > timeout) {
          basicTool.getGlobal("clearInterval")(intervalId);
          reject(/* @__PURE__ */ new Error("timeout"));
        }
      }, interval);
    });
  }
  async function waitForReader(reader) {
    await reader._initPromise;
    await reader._lastView.initializedPromise;
    if (reader.type === "pdf") await reader._lastView._iframeWindow.PDFViewerApplication.initializedPromise;
  }
  var KeyboardManager = class extends ManagerTool {
    _keyboardCallbacks = /* @__PURE__ */ new Set();
    _cachedKey;
    id;
    constructor(base) {
      super(base);
      this.id = `kbd-${Zotero.Utilities.randomString()}`;
      this._ensureAutoUnregisterAll();
      this.addListenerCallback("onMainWindowLoad", this.initKeyboardListener);
      this.addListenerCallback("onMainWindowUnload", this.unInitKeyboardListener);
      this.initReaderKeyboardListener();
      for (const win of Zotero.getMainWindows()) this.initKeyboardListener(win);
    }
    /**
    * Register a keyboard event listener.
    * @param callback The callback function.
    */
    register(callback) {
      this._keyboardCallbacks.add(callback);
    }
    /**
    * Unregister a keyboard event listener.
    * @param callback The callback function.
    */
    unregister(callback) {
      this._keyboardCallbacks.delete(callback);
    }
    /**
    * Unregister all keyboard event listeners.
    */
    unregisterAll() {
      this._keyboardCallbacks.clear();
      this.removeListenerCallback("onMainWindowLoad", this.initKeyboardListener);
      this.removeListenerCallback("onMainWindowUnload", this.unInitKeyboardListener);
      for (const win of Zotero.getMainWindows()) this.unInitKeyboardListener(win);
    }
    initKeyboardListener = this._initKeyboardListener.bind(this);
    unInitKeyboardListener = this._unInitKeyboardListener.bind(this);
    initReaderKeyboardListener() {
      Zotero.Reader.registerEventListener("renderToolbar", (event) => this.addReaderKeyboardCallback(event), this._basicOptions.api.pluginID);
      Zotero.Reader._readers.forEach((reader) => this.addReaderKeyboardCallback({ reader }));
    }
    async addReaderKeyboardCallback(event) {
      const reader = event.reader;
      const initializedKey = `_ztoolkitKeyboard${this.id}Initialized`;
      await waitForReader(reader);
      if (!reader._iframeWindow) return;
      if (reader._iframeWindow[initializedKey]) return;
      this._initKeyboardListener(reader._iframeWindow);
      waitUntil(() => !Components.utils.isDeadWrapper(reader._internalReader) && reader._internalReader?._primaryView?._iframeWindow, () => this._initKeyboardListener(reader._internalReader._primaryView?._iframeWindow));
      reader._iframeWindow[initializedKey] = true;
    }
    _initKeyboardListener(win) {
      if (!win) return;
      win.addEventListener("keydown", this.triggerKeydown);
      win.addEventListener("keyup", this.triggerKeyup);
    }
    _unInitKeyboardListener(win) {
      if (!win) return;
      win.removeEventListener("keydown", this.triggerKeydown);
      win.removeEventListener("keyup", this.triggerKeyup);
    }
    triggerKeydown = (e) => {
      if (!this._cachedKey) this._cachedKey = new KeyModifier(e);
      else this._cachedKey.merge(new KeyModifier(e), { allowOverwrite: false });
      this.dispatchCallback(e, { type: "keydown" });
    };
    triggerKeyup = async (e) => {
      if (!this._cachedKey) return;
      const currentShortcut = new KeyModifier(this._cachedKey);
      this._cachedKey = void 0;
      this.dispatchCallback(e, {
        keyboard: currentShortcut,
        type: "keyup"
      });
    };
    dispatchCallback(...args) {
      this._keyboardCallbacks.forEach((cbk) => cbk(...args));
    }
  };
  var KeyModifier = class KeyModifier2 {
    accel = false;
    shift = false;
    control = false;
    meta = false;
    alt = false;
    key = "";
    useAccel = false;
    constructor(raw, options) {
      this.useAccel = options?.useAccel || false;
      if (typeof raw === "undefined") {
      } else if (typeof raw === "string") {
        raw = raw || "";
        raw = this.unLocalized(raw);
        this.accel = raw.includes("accel");
        this.shift = raw.includes("shift");
        this.control = raw.includes("control");
        this.meta = raw.includes("meta");
        this.alt = raw.includes("alt");
        this.key = raw.replace(/(accel|shift|control|meta|alt|[ ,\-])/g, "").toLocaleLowerCase();
      } else if (raw instanceof KeyModifier2) this.merge(raw, { allowOverwrite: true });
      else {
        if (options?.useAccel) if (Zotero.isMac) this.accel = raw.metaKey;
        else this.accel = raw.ctrlKey;
        this.shift = raw.shiftKey;
        this.control = raw.ctrlKey;
        this.meta = raw.metaKey;
        this.alt = raw.altKey;
        if (![
          "Shift",
          "Meta",
          "Ctrl",
          "Alt",
          "Control"
        ].includes(raw.key)) this.key = raw.key;
      }
    }
    /**
    * Merge another KeyModifier into this one.
    * @param newMod the new KeyModifier
    * @param options
    * @param options.allowOverwrite
    * @returns KeyModifier
    */
    merge(newMod, options) {
      const allowOverwrite = options?.allowOverwrite || false;
      this.mergeAttribute("accel", newMod.accel, allowOverwrite);
      this.mergeAttribute("shift", newMod.shift, allowOverwrite);
      this.mergeAttribute("control", newMod.control, allowOverwrite);
      this.mergeAttribute("meta", newMod.meta, allowOverwrite);
      this.mergeAttribute("alt", newMod.alt, allowOverwrite);
      this.mergeAttribute("key", newMod.key, allowOverwrite);
      return this;
    }
    /**
    * Check if the current KeyModifier equals to another KeyModifier.
    * @param newMod the new KeyModifier
    * @returns true if equals
    */
    equals(newMod) {
      if (typeof newMod === "string") newMod = new KeyModifier2(newMod);
      if (this.shift !== newMod.shift || this.alt !== newMod.alt || this.key.toLowerCase() !== newMod.key.toLowerCase()) return false;
      if (this.accel || newMod.accel) {
        if (Zotero.isMac) {
          if ((this.accel || this.meta) !== (newMod.accel || newMod.meta) || this.control !== newMod.control) return false;
        } else if ((this.accel || this.control) !== (newMod.accel || newMod.control) || this.meta !== newMod.meta) return false;
      } else if (this.control !== newMod.control || this.meta !== newMod.meta) return false;
      return true;
    }
    /**
    * Get the raw string representation of the KeyModifier.
    */
    getRaw() {
      const enabled = [];
      this.accel && enabled.push("accel");
      this.shift && enabled.push("shift");
      this.control && enabled.push("control");
      this.meta && enabled.push("meta");
      this.alt && enabled.push("alt");
      this.key && enabled.push(this.key);
      return enabled.join(",");
    }
    /**
    * Get the localized string representation of the KeyModifier.
    */
    getLocalized() {
      const raw = this.getRaw();
      if (Zotero.isMac) return raw.replaceAll("control", "\u2303").replaceAll("alt", "\u2325").replaceAll("shift", "\u21E7").replaceAll("meta", "\u2318");
      else return raw.replaceAll("control", "Ctrl").replaceAll("alt", "Alt").replaceAll("shift", "Shift").replaceAll("meta", "Win");
    }
    /**
    * Get the un-localized string representation of the KeyModifier.
    */
    unLocalized(raw) {
      if (Zotero.isMac) return raw.replaceAll("\u2303", "control").replaceAll("\u2325", "alt").replaceAll("\u21E7", "shift").replaceAll("\u2318", "meta");
      else return raw.replaceAll("Ctrl", "control").replaceAll("Alt", "alt").replaceAll("Shift", "shift").replaceAll("Win", "meta");
    }
    mergeAttribute(attribute, value, allowOverwrite) {
      if (allowOverwrite || !this[attribute]) this[attribute] = value;
    }
  };
  var MenuManager = class extends ManagerTool {
    ui;
    constructor(base) {
      super(base);
      this.ui = new UITool(this);
    }
    /**
    * Insert an menu item/menu(with popup)/menuseprator into a menupopup
    * @remarks
    * options:
    * ```ts
    * export interface MenuitemOptions {
    *   tag: "menuitem" | "menu" | "menuseparator";
    *   id?: string;
    *   label?: string;
    *   // data url (chrome://xxx.png) or base64 url (data:image/png;base64,xxx)
    *   icon?: string;
    *   class?: string;
    *   styles?: { [key: string]: string };
    *   hidden?: boolean;
    *   disabled?: boolean;
    *   oncommand?: string;
    *   commandListener?: EventListenerOrEventListenerObject;
    *   // Attributes below are used when type === "menu"
    *   popupId?: string;
    *   onpopupshowing?: string;
    *   subElementOptions?: Array<MenuitemOptions>;
    * }
    * ```
    * @param menuPopup
    * @param options
    * @param insertPosition
    * @param anchorElement The menuitem will be put before/after `anchorElement`. If not set, put at start/end of the menupopup.
    * @example
    * Insert menuitem with icon into item menupopup
    * ```ts
    * // base64 or chrome:// url
    * const menuIcon = "chrome://addontemplate/content/icons/favicon@0.5x.png";
    * ztoolkit.Menu.register("item", {
    *   tag: "menuitem",
    *   id: "zotero-itemmenu-addontemplate-test",
    *   label: "Addon Template: Menuitem",
    *   oncommand: "alert('Hello World! Default Menuitem.')",
    *   icon: menuIcon,
    * });
    * ```
    * @example
    * Insert menu into file menupopup
    * ```ts
    * ztoolkit.Menu.register(
    *   "menuFile",
    *   {
    *     tag: "menu",
    *     label: "Addon Template: Menupopup",
    *     subElementOptions: [
    *       {
    *         tag: "menuitem",
    *         label: "Addon Template",
    *         oncommand: "alert('Hello World! Sub Menuitem.')",
    *       },
    *     ],
    *   },
    *   "before",
    *   Zotero.getMainWindow().document.querySelector(
    *     "#zotero-itemmenu-addontemplate-test"
    *   )
    * );
    * ```
    */
    register(menuPopup, options, insertPosition = "after", anchorElement) {
      let popup;
      if (typeof menuPopup === "string") popup = this.getGlobal("document").querySelector(MenuSelector[menuPopup]);
      else popup = menuPopup;
      if (!popup) return false;
      const doc = popup.ownerDocument;
      const genMenuElement = (menuitemOption) => {
        const elementOption = {
          tag: menuitemOption.tag,
          id: menuitemOption.id,
          namespace: "xul",
          attributes: {
            label: menuitemOption.label || "",
            hidden: Boolean(menuitemOption.hidden),
            disabled: Boolean(menuitemOption.disabled),
            class: menuitemOption.class || "",
            oncommand: menuitemOption.oncommand || ""
          },
          classList: menuitemOption.classList,
          styles: menuitemOption.styles || {},
          listeners: [],
          children: []
        };
        if (menuitemOption.icon) {
          if (!this.getGlobal("Zotero").isMac) if (menuitemOption.tag === "menu") elementOption.attributes.class += " menu-iconic";
          else elementOption.attributes.class += " menuitem-iconic";
          elementOption.styles["list-style-image"] = `url(${menuitemOption.icon})`;
        }
        if (menuitemOption.commandListener) elementOption.listeners?.push({
          type: "command",
          listener: menuitemOption.commandListener
        });
        if (menuitemOption.tag === "menuitem") {
          elementOption.attributes.type = menuitemOption.type || "";
          elementOption.attributes.checked = menuitemOption.checked || false;
        }
        const menuItem = this.ui.createElement(doc, menuitemOption.tag, elementOption);
        if (menuitemOption.isHidden || menuitemOption.getVisibility) popup?.addEventListener("popupshowing", async (ev) => {
          let hidden;
          if (menuitemOption.isHidden) hidden = await menuitemOption.isHidden(menuItem, ev);
          else if (menuitemOption.getVisibility) {
            const visible = await menuitemOption.getVisibility(menuItem, ev);
            hidden = typeof visible === "undefined" ? void 0 : !visible;
          }
          if (typeof hidden === "undefined") return;
          if (hidden) menuItem.setAttribute("hidden", "true");
          else menuItem.removeAttribute("hidden");
        });
        if (menuitemOption.isDisabled) popup?.addEventListener("popupshowing", async (ev) => {
          const disabled = await menuitemOption.isDisabled(menuItem, ev);
          if (typeof disabled === "undefined") return;
          if (disabled) menuItem.setAttribute("disabled", "true");
          else menuItem.removeAttribute("disabled");
        });
        if ((menuitemOption.tag === "menuitem" || menuitemOption.tag === "menuseparator") && menuitemOption.onShowing) popup?.addEventListener("popupshowing", async (ev) => {
          await menuitemOption.onShowing(menuItem, ev);
        });
        if (menuitemOption.tag === "menu") {
          const subPopup = this.ui.createElement(doc, "menupopup", {
            id: menuitemOption.popupId,
            attributes: { onpopupshowing: menuitemOption.onpopupshowing || "" }
          });
          menuitemOption.children?.forEach((childOption) => {
            subPopup.append(genMenuElement(childOption));
          });
          menuItem.append(subPopup);
        }
        return menuItem;
      };
      const topMenuItem = genMenuElement(options);
      if (popup.childElementCount) {
        if (!anchorElement) anchorElement = insertPosition === "after" ? popup.lastElementChild : popup.firstElementChild;
        anchorElement[insertPosition](topMenuItem);
      } else popup.appendChild(topMenuItem);
    }
    unregister(menuId) {
      this.getGlobal("document").querySelector(`#${menuId}`)?.remove();
    }
    unregisterAll() {
      this.ui.unregisterAll();
    }
  };
  var MenuSelector = /* @__PURE__ */ (function(MenuSelector$1) {
    MenuSelector$1["menuFile"] = "#menu_FilePopup";
    MenuSelector$1["menuEdit"] = "#menu_EditPopup";
    MenuSelector$1["menuView"] = "#menu_viewPopup";
    MenuSelector$1["menuGo"] = "#menu_goPopup";
    MenuSelector$1["menuTools"] = "#menu_ToolsPopup";
    MenuSelector$1["menuHelp"] = "#menu_HelpPopup";
    MenuSelector$1["collection"] = "#zotero-collectionmenu";
    MenuSelector$1["item"] = "#zotero-itemmenu";
    return MenuSelector$1;
  })(MenuSelector || {});
  var Prompt = class {
    ui;
    base;
    get document() {
      return this.base.getGlobal("document");
    }
    /**
    * Record the last text entered
    */
    lastInputText = "";
    /**
    * Default text
    */
    defaultText = {
      placeholder: "Select a command...",
      empty: "No commands found."
    };
    /**
    * It controls the max line number of commands displayed in `commandsNode`.
    */
    maxLineNum = 12;
    /**
    * It controls the max number of suggestions.
    */
    maxSuggestionNum = 100;
    /**
    * The top-level HTML div node of `Prompt`
    */
    promptNode;
    /**
    * The HTML input node of `Prompt`.
    */
    inputNode;
    /**
    * Save all commands registered by all addons.
    */
    commands = [];
    /**
    * Initialize `Prompt` but do not create UI.
    */
    constructor() {
      this.base = new BasicTool();
      this.ui = new UITool();
      this.initializeUI();
    }
    /**
    * Initialize `Prompt` UI and then bind events on it.
    */
    initializeUI() {
      this.addStyle();
      this.createHTML();
      this.initInputEvents();
      this.registerShortcut();
    }
    createHTML() {
      this.promptNode = this.ui.createElement(this.document, "div", {
        styles: { display: "none" },
        children: [{
          tag: "div",
          styles: {
            position: "fixed",
            left: "0",
            top: "0",
            backgroundColor: "transparent",
            width: "100%",
            height: "100%"
          },
          listeners: [{
            type: "click",
            listener: () => {
              this.promptNode.style.display = "none";
            }
          }]
        }]
      });
      this.promptNode.appendChild(this.ui.createElement(this.document, "div", {
        id: `zotero-plugin-toolkit-prompt`,
        classList: ["prompt-container"],
        children: [
          {
            tag: "div",
            classList: ["input-container"],
            children: [{
              tag: "input",
              classList: ["prompt-input"],
              attributes: {
                type: "text",
                placeholder: this.defaultText.placeholder
              }
            }, {
              tag: "div",
              classList: ["cta"]
            }]
          },
          {
            tag: "div",
            classList: ["commands-containers"]
          },
          {
            tag: "div",
            classList: ["instructions"],
            children: [
              {
                tag: "div",
                classList: ["instruction"],
                children: [{
                  tag: "span",
                  classList: ["key"],
                  properties: { innerText: "\u2191\u2193" }
                }, {
                  tag: "span",
                  properties: { innerText: "to navigate" }
                }]
              },
              {
                tag: "div",
                classList: ["instruction"],
                children: [{
                  tag: "span",
                  classList: ["key"],
                  properties: { innerText: "enter" }
                }, {
                  tag: "span",
                  properties: { innerText: "to trigger" }
                }]
              },
              {
                tag: "div",
                classList: ["instruction"],
                children: [{
                  tag: "span",
                  classList: ["key"],
                  properties: { innerText: "esc" }
                }, {
                  tag: "span",
                  properties: { innerText: "to exit" }
                }]
              }
            ]
          }
        ]
      }));
      this.inputNode = this.promptNode.querySelector("input");
      this.document.documentElement.appendChild(this.promptNode);
    }
    /**
    * Show commands in a new `commandsContainer`
    * All other `commandsContainer` is hidden
    * @param commands Command[]
    * @param clear remove all `commandsContainer` if true
    */
    showCommands(commands, clear = false) {
      if (clear) this.promptNode.querySelectorAll(".commands-container").forEach((e) => e.remove());
      this.inputNode.placeholder = this.defaultText.placeholder;
      const commandsContainer = this.createCommandsContainer();
      for (const command of commands) {
        try {
          if (!command.name || command.when && !command.when()) continue;
        } catch {
          continue;
        }
        commandsContainer.appendChild(this.createCommandNode(command));
      }
    }
    /**
    * Create a `commandsContainer` div element, append to `commandsContainer` and hide others.
    * @returns commandsNode
    */
    createCommandsContainer() {
      const commandsContainer = this.ui.createElement(this.document, "div", { classList: ["commands-container"] });
      this.promptNode.querySelectorAll(".commands-container").forEach((e) => {
        e.style.display = "none";
      });
      this.promptNode.querySelector(".commands-containers").appendChild(commandsContainer);
      return commandsContainer;
    }
    /**
    * Return current displayed `commandsContainer`
    * @returns
    */
    getCommandsContainer() {
      return [...Array.from(this.promptNode.querySelectorAll(".commands-container"))].find((e) => {
        return e.style.display !== "none";
      });
    }
    /**
    * Create a command item for `Prompt` UI.
    * @param command
    * @returns
    */
    createCommandNode(command) {
      const commandNode = this.ui.createElement(this.document, "div", {
        classList: ["command"],
        children: [{
          tag: "div",
          classList: ["content"],
          children: [{
            tag: "div",
            classList: ["name"],
            children: [{
              tag: "span",
              properties: { innerText: command.name }
            }]
          }, {
            tag: "div",
            classList: ["aux"],
            children: command.label ? [{
              tag: "span",
              classList: ["label"],
              properties: { innerText: command.label }
            }] : []
          }]
        }],
        listeners: [{
          type: "mousemove",
          listener: () => {
            this.selectItem(commandNode);
          }
        }, {
          type: "click",
          listener: async () => {
            await this.execCallback(command.callback);
          }
        }]
      });
      commandNode.command = command;
      return commandNode;
    }
    /**
    * Called when `enter` key is pressed.
    */
    trigger() {
      [...Array.from(this.promptNode.querySelectorAll(".commands-container"))].find((e) => e.style.display !== "none").querySelector(".selected").click();
    }
    /**
    * Called when `escape` key is pressed.
    */
    exit() {
      this.inputNode.placeholder = this.defaultText.placeholder;
      if (this.promptNode.querySelectorAll(".commands-containers .commands-container").length >= 2) {
        this.promptNode.querySelector(".commands-container:last-child").remove();
        const commandsContainer = this.promptNode.querySelector(".commands-container:last-child");
        commandsContainer.style.display = "";
        commandsContainer.querySelectorAll(".commands").forEach((e) => e.style.display = "flex");
        this.inputNode.focus();
      } else this.promptNode.style.display = "none";
    }
    async execCallback(callback) {
      if (Array.isArray(callback)) this.showCommands(callback);
      else await callback(this);
    }
    /**
    * Match suggestions for user's entered text.
    */
    async showSuggestions(inputText) {
      const _w = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]/;
      const jw = /\s/;
      const Ww = /[\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F]/;
      function Yw(e$1, t, n, i) {
        if (e$1.length === 0) return 0;
        let r = 0;
        r -= Math.max(0, e$1.length - 1), r -= i / 10;
        const o = e$1[0][0];
        return r -= (e$1[e$1.length - 1][1] - o + 1 - t) / 100, r -= o / 1e3, r -= n / 1e4;
      }
      function $w(e$1, t, n, i) {
        if (e$1.length === 0) return null;
        for (var r = n.toLowerCase(), o = 0, a = 0, s = [], l = 0; l < e$1.length; l++) {
          const c = e$1[l];
          const u = r.indexOf(c, a);
          if (u === -1) return null;
          const h = n.charAt(u);
          if (u > 0 && !_w.test(h) && !Ww.test(h)) {
            const p = n.charAt(u - 1);
            if (h.toLowerCase() !== h && p.toLowerCase() !== p || h.toUpperCase() !== h && !_w.test(p) && !jw.test(p) && !Ww.test(p)) if (i) {
              if (u !== a) {
                a += c.length, l--;
                continue;
              }
            } else o += 1;
          }
          if (s.length === 0) s.push([u, u + c.length]);
          else {
            const d = s[s.length - 1];
            d[1] < u ? s.push([u, u + c.length]) : d[1] = u + c.length;
          }
          a = u + c.length;
        }
        return {
          matches: s,
          score: Yw(s, t.length, r.length, o)
        };
      }
      function Gw(e$1) {
        for (var t = e$1.toLowerCase(), n = [], i = 0, r = 0; r < t.length; r++) {
          const o = t.charAt(r);
          jw.test(o) ? (i !== r && n.push(t.substring(i, r)), i = r + 1) : (_w.test(o) || Ww.test(o)) && (i !== r && n.push(t.substring(i, r)), n.push(o), i = r + 1);
        }
        return i !== t.length && n.push(t.substring(i, t.length)), {
          query: e$1,
          tokens: n,
          fuzzy: t.split("")
        };
      }
      function Xw(e$1, t) {
        if (e$1.query === "") return {
          score: 0,
          matches: []
        };
        const n = $w(e$1.tokens, e$1.query, t, false);
        return n || $w(e$1.fuzzy, e$1.query, t, true);
      }
      const e = Gw(inputText);
      let container = this.getCommandsContainer();
      if (container.classList.contains("suggestions")) this.exit();
      if (inputText.trim() == "") return true;
      const suggestions = [];
      this.getCommandsContainer().querySelectorAll(".command").forEach((commandNode) => {
        const spanNode = commandNode.querySelector(".name span");
        const spanText = spanNode.innerText;
        const res = Xw(e, spanText);
        if (res) {
          commandNode = this.createCommandNode(commandNode.command);
          let spanHTML = "";
          let i = 0;
          for (let j = 0; j < res.matches.length; j++) {
            const [start, end] = res.matches[j];
            if (start > i) spanHTML += spanText.slice(i, start);
            spanHTML += `<span class="highlight">${spanText.slice(start, end)}</span>`;
            i = end;
          }
          if (i < spanText.length) spanHTML += spanText.slice(i, spanText.length);
          commandNode.querySelector(".name span").innerHTML = spanHTML;
          suggestions.push({
            score: res.score,
            commandNode
          });
        }
      });
      if (suggestions.length > 0) {
        suggestions.sort((a, b) => b.score - a.score).slice(this.maxSuggestionNum);
        container = this.createCommandsContainer();
        container.classList.add("suggestions");
        suggestions.forEach((suggestion) => {
          container.appendChild(suggestion.commandNode);
        });
        return true;
      } else {
        const anonymousCommand = this.commands.find((c) => !c.name && (!c.when || c.when()));
        if (anonymousCommand) await this.execCallback(anonymousCommand.callback);
        else this.showTip(this.defaultText.empty);
        return false;
      }
    }
    /**
    * Bind events of pressing `keydown` and `keyup` key.
    */
    initInputEvents() {
      this.promptNode.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          let selectedIndex;
          const allItems = [...Array.from(this.getCommandsContainer().querySelectorAll(".command"))].filter((e) => e.style.display != "none");
          selectedIndex = allItems.findIndex((e) => e.classList.contains("selected"));
          if (selectedIndex != -1) {
            allItems[selectedIndex].classList.remove("selected");
            selectedIndex += event.key == "ArrowUp" ? -1 : 1;
          } else if (event.key == "ArrowUp") selectedIndex = allItems.length - 1;
          else selectedIndex = 0;
          if (selectedIndex == -1) selectedIndex = allItems.length - 1;
          else if (selectedIndex == allItems.length) selectedIndex = 0;
          allItems[selectedIndex].classList.add("selected");
          const commandsContainer = this.getCommandsContainer();
          commandsContainer.scrollTo(0, commandsContainer.querySelector(".selected").offsetTop - commandsContainer.offsetHeight + 7.5);
          allItems[selectedIndex].classList.add("selected");
        }
      });
      this.promptNode.addEventListener("keyup", async (event) => {
        if (event.key == "Enter") this.trigger();
        else if (event.key == "Escape") if (this.inputNode.value.length > 0) this.inputNode.value = "";
        else this.exit();
        else if (["ArrowUp", "ArrowDown"].includes(event.key)) return;
        const currentInputText = this.inputNode.value;
        if (currentInputText == this.lastInputText) return;
        this.lastInputText = currentInputText;
        window.setTimeout(async () => {
          await this.showSuggestions(currentInputText);
        });
      });
    }
    /**
    * Create a commandsContainer and display a text
    */
    showTip(text) {
      const tipNode = this.ui.createElement(this.document, "div", {
        classList: ["tip"],
        properties: { innerText: text }
      });
      const container = this.createCommandsContainer();
      container.classList.add("suggestions");
      container.appendChild(tipNode);
      return tipNode;
    }
    /**
    * Mark the selected item with class `selected`.
    * @param item HTMLDivElement
    */
    selectItem(item) {
      this.getCommandsContainer().querySelectorAll(".command").forEach((e) => e.classList.remove("selected"));
      item.classList.add("selected");
    }
    addStyle() {
      const style$1 = this.ui.createElement(this.document, "style", {
        namespace: "html",
        id: "prompt-style"
      });
      style$1.innerText = `
      .prompt-container * {
        box-sizing: border-box;
      }
      .prompt-container {
        ---radius---: 10px;
        position: fixed;
        left: 25%;
        top: 10%;
        width: 50%;
        border-radius: var(---radius---);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-size: 18px;
        box-shadow: 0px 1.8px 7.3px rgba(0, 0, 0, 0.071),
                    0px 6.3px 24.7px rgba(0, 0, 0, 0.112),
                    0px 30px 90px rgba(0, 0, 0, 0.2);
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
        background-color: var(--material-background) !important;
        border: var(--material-border-quarternary) !important;
      }
      
      /* input */
      .prompt-container .input-container  {
        width: 100%;
      }

      .input-container input {
        width: -moz-available;
        height: 40px;
        padding: 24px;
        border: none;
        outline: none;
        font-size: 18px;
        margin: 0 !important;
        border-radius: var(---radius---);
        background-color: var(--material-background);
      }
      
      .input-container .cta {
        border-bottom: var(--material-border-quarternary);
        margin: 5px auto;
      }
      
      /* results */
      .commands-containers {
        width: 100%;
        height: 100%;
      }
      .commands-container {
        max-height: calc(${this.maxLineNum} * 35.5px);
        width: calc(100% - 12px);
        margin-left: 12px;
        margin-right: 0%;
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      .commands-container .command {
        display: flex;
        align-content: baseline;
        justify-content: space-between;
        border-radius: 5px;
        padding: 6px 12px;
        margin-right: 12px;
        margin-top: 2px;
        margin-bottom: 2px;
      }
      .commands-container .command .content {
        display: flex;
        width: 100%;
        justify-content: space-between;
        flex-direction: row;
        overflow: hidden;
      }
      .commands-container .command .content .name {
        white-space: nowrap; 
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .commands-container .command .content .aux {
        display: flex;
        align-items: center;
        align-self: center;
        flex-shrink: 0;
      }
      
      .commands-container .command .content .aux .label {
        font-size: 15px;
        color: var(--fill-primary);
        padding: 2px 6px;
        background-color: var(--color-background);
        border-radius: 5px;
      }
      
      .commands-container .selected {
          background-color: var(--material-mix-quinary);
      }

      .commands-container .highlight {
        font-weight: bold;
      }

      .tip {
        color: var(--fill-primary);
        text-align: center;
        padding: 12px 12px;
        font-size: 18px;
      }

      /* instructions */
      .instructions {
        display: flex;
        align-content: center;
        justify-content: center;
        font-size: 15px;
        height: 2.5em;
        width: 100%;
        border-top: var(--material-border-quarternary);
        color: var(--fill-secondary);
        margin-top: 5px;
      }
      
      .instructions .instruction {
        margin: auto .5em;  
      }
      
      .instructions .key {
        margin-right: .2em;
        font-weight: 600;
      }
    `;
      this.document.documentElement.appendChild(style$1);
    }
    registerShortcut() {
      this.document.addEventListener("keydown", (event) => {
        if (event.shiftKey && event.key.toLowerCase() == "p") {
          if (event.originalTarget.isContentEditable || "value" in event.originalTarget || this.commands.length == 0) return;
          event.preventDefault();
          event.stopPropagation();
          if (this.promptNode.style.display == "none") {
            this.promptNode.style.display = "flex";
            if (this.promptNode.querySelectorAll(".commands-container").length == 1) this.showCommands(this.commands, true);
            this.promptNode.focus();
            this.inputNode.focus();
          } else this.promptNode.style.display = "none";
        }
      }, true);
    }
  };
  var PromptManager = class extends ManagerTool {
    prompt;
    /**
    * Save the commands registered from this manager
    */
    commands = [];
    constructor(base) {
      super(base);
      const globalCache = toolkitGlobal_default.getInstance()?.prompt;
      if (!globalCache) throw new Error("Prompt is not initialized.");
      if (!globalCache._ready) {
        globalCache._ready = true;
        globalCache.instance = new Prompt();
      }
      this.prompt = globalCache.instance;
    }
    /**
    * Register commands. Don't forget to call `unregister` on plugin exit.
    * @param commands Command[]
    * @example
    * ```ts
    * let getReader = () => {
    *   return BasicTool.getZotero().Reader.getByTabID(
    *     (Zotero.getMainWindow().Zotero_Tabs).selectedID
    *   )
    * }
    *
    * register([
    *   {
    *     name: "Split Horizontally",
    *     label: "Zotero",
    *     when: () => getReader() as boolean,
    *     callback: (prompt: Prompt) => getReader().menuCmd("splitHorizontally")
    *   },
    *   {
    *     name: "Split Vertically",
    *     label: "Zotero",
    *     when: () => getReader() as boolean,
    *     callback: (prompt: Prompt) => getReader().menuCmd("splitVertically")
    *   }
    * ])
    * ```
    */
    register(commands) {
      commands.forEach((c) => c.id ??= c.name);
      this.prompt.commands = [...this.prompt.commands, ...commands];
      this.commands = [...this.commands, ...commands];
      this.prompt.showCommands(this.commands, true);
    }
    /**
    * You can delete a command registed before by its name.
    * @remarks
    * There is a premise here that the names of all commands registered by a single plugin are not duplicated.
    * @param id Command.name
    */
    unregister(id) {
      this.prompt.commands = this.prompt.commands.filter((c) => c.id != id);
      this.commands = this.commands.filter((c) => c.id != id);
    }
    /**
    * Call `unregisterAll` on plugin exit.
    */
    unregisterAll() {
      this.prompt.commands = this.prompt.commands.filter((c) => {
        return this.commands.every((_c) => _c.id != c.id);
      });
      this.commands = [];
    }
  };
  var ExtraFieldTool = class extends BasicTool {
    /**
    * Get all extra fields
    * @param item
    */
    getExtraFields(item, backend = "custom") {
      const extraFiledRaw = item.getField("extra");
      if (backend === "default") return this.getGlobal("Zotero").Utilities.Internal.extractExtraFields(extraFiledRaw).fields;
      else {
        const map = /* @__PURE__ */ new Map();
        const nonStandardFields = [];
        extraFiledRaw.split("\n").forEach((line) => {
          const split = line.split(": ");
          if (split.length >= 2 && split[0]) map.set(split[0], split.slice(1).join(": "));
          else nonStandardFields.push(line);
        });
        map.set("__nonStandard__", nonStandardFields.join("\n"));
        return map;
      }
    }
    /**
    * Get extra field value by key. If it does not exists, return undefined.
    * @param item
    * @param key
    */
    getExtraField(item, key) {
      const fields = this.getExtraFields(item);
      return fields.get(key);
    }
    /**
    * Replace extra field of an item.
    * @param item
    * @param fields
    */
    async replaceExtraFields(item, fields) {
      const kvs = [];
      if (fields.has("__nonStandard__")) {
        kvs.push(fields.get("__nonStandard__"));
        fields.delete("__nonStandard__");
      }
      fields.forEach((v, k) => {
        kvs.push(`${k}: ${v}`);
      });
      item.setField("extra", kvs.join("\n"));
      await item.saveTx();
    }
    /**
    * Set an key-value pair to the item's extra field
    * @param item
    * @param key
    * @param value
    */
    async setExtraField(item, key, value) {
      const fields = this.getExtraFields(item);
      if (value === "" || typeof value === "undefined") fields.delete(key);
      else fields.set(key, value);
      await this.replaceExtraFields(item, fields);
    }
  };
  var ReaderTool = class extends BasicTool {
    /**
    * Get the selected tab reader.
    * @param waitTime Wait for n MS until the reader is ready
    */
    async getReader(waitTime = 5e3) {
      const Zotero_Tabs = this.getGlobal("Zotero_Tabs");
      if (Zotero_Tabs.selectedType !== "reader") return void 0;
      let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
      let delayCount = 0;
      const checkPeriod = 50;
      while (!reader && delayCount * checkPeriod < waitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkPeriod));
        reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
        delayCount++;
      }
      await reader?._initPromise;
      return reader;
    }
    /**
    * Get all window readers.
    */
    getWindowReader() {
      const Zotero_Tabs = this.getGlobal("Zotero_Tabs");
      const windowReaders = [];
      const tabs = Zotero_Tabs._tabs.map((e) => e.id);
      for (let i = 0; i < Zotero.Reader._readers.length; i++) {
        let flag = false;
        for (let j = 0; j < tabs.length; j++) if (Zotero.Reader._readers[i].tabID === tabs[j]) {
          flag = true;
          break;
        }
        if (!flag) windowReaders.push(Zotero.Reader._readers[i]);
      }
      return windowReaders;
    }
    /**
    * Get Reader tabpanel deck element.
    * @deprecated - use item pane api
    * @alpha
    */
    getReaderTabPanelDeck() {
      const deck = this.getGlobal("window").document.querySelector(".notes-pane-deck")?.previousElementSibling;
      return deck;
    }
    /**
    * Add a reader tabpanel deck selection change observer.
    * @deprecated - use item pane api
    * @alpha
    * @param callback
    */
    async addReaderTabPanelDeckObserver(callback) {
      await waitUtilAsync(() => !!this.getReaderTabPanelDeck());
      const deck = this.getReaderTabPanelDeck();
      const observer = new (this.getGlobal("MutationObserver"))(async (mutations) => {
        mutations.forEach(async (mutation) => {
          const target = mutation.target;
          if (target.classList.contains("zotero-view-tabbox") || target.tagName === "deck") callback();
        });
      });
      observer.observe(deck, {
        attributes: true,
        attributeFilter: ["selectedIndex"],
        subtree: true
      });
      return observer;
    }
    /**
    * Get the selected annotation data.
    * @param reader Target reader
    * @returns The selected annotation data.
    */
    getSelectedAnnotationData(reader) {
      const annotation = reader?._internalReader._lastView._selectionPopup?.annotation;
      return annotation;
    }
    /**
    * Get the text selection of reader.
    * @param reader Target reader
    * @returns The text selection of reader.
    */
    getSelectedText(reader) {
      return this.getSelectedAnnotationData(reader)?.text ?? "";
    }
  };
  var ZoteroToolkit = class extends BasicTool {
    static _version = BasicTool._version;
    UI = new UITool(this);
    Reader = new ReaderTool(this);
    ExtraField = new ExtraFieldTool(this);
    FieldHooks = new FieldHookManager(this);
    Keyboard = new KeyboardManager(this);
    Prompt = new PromptManager(this);
    Menu = new MenuManager(this);
    Clipboard = makeHelperTool(ClipboardHelper, this);
    FilePicker = makeHelperTool(FilePickerHelper, this);
    Patch = makeHelperTool(PatchHelper, this);
    ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
    VirtualizedTable = makeHelperTool(VirtualizedTableHelper, this);
    Dialog = makeHelperTool(DialogHelper, this);
    LargePrefObject = makeHelperTool(LargePrefHelper, this);
    Guide = makeHelperTool(GuideHelper, this);
    constructor() {
      super();
    }
    /**
    * Unregister everything created by managers.
    */
    unregisterAll() {
      unregister(this);
    }
  };

  // src/api.ts
  init_prefs();
  init_package();
  async function translate(raw, serviceOrOptions) {
    let currentService;
    let candidateServices = [];
    let service;
    let isDeprecatedCall = false;
    if (!serviceOrOptions || typeof serviceOrOptions === "string" || Array.isArray(serviceOrOptions)) {
      service = serviceOrOptions;
      isDeprecatedCall = true;
    } else if (typeof serviceOrOptions === "object") {
      service = serviceOrOptions.service;
    }
    serviceOrOptions = serviceOrOptions || {};
    if (!isDeprecatedCall && !serviceOrOptions.pluginID) {
      throw `[Translate for Zotero:api.translate] pluginID is required since 1.1.0-23. Please contact the plugin developer for more information.`;
    }
    if (isDeprecatedCall) {
      Zotero.warn(
        new Error(
          "[Translate for Zotero:api.translate] This call is deprecated. Please use `translate(raw, options)` instead."
        )
      );
    }
    if (typeof service === "string") {
      currentService = service;
    } else if (Array.isArray(service)) {
      currentService = service[0];
      candidateServices = service.slice(1);
    } else {
      currentService = getPref("translateSource");
    }
    const data2 = {
      id: `${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`,
      type: "custom",
      raw,
      result: "",
      audio: [],
      service: currentService,
      candidateServices,
      itemId: isDeprecatedCall ? -1 : serviceOrOptions.itemID || -1,
      status: "waiting",
      extraTasks: [],
      silent: true,
      langfrom: isDeprecatedCall ? void 0 : serviceOrOptions.langfrom,
      langto: isDeprecatedCall ? void 0 : serviceOrOptions.langto,
      callerID: isDeprecatedCall ? "unknown caller with translate for zotero api" : serviceOrOptions.pluginID
    };
    await addon.data.translate.services.runTranslationTask(data2, {
      noDisplay: true
    });
    return data2;
  }
  function getTemporaryRefreshHandler(options) {
    const translateTask = options?.task;
    if (translateTask && translateTask.type !== "text") {
      return () => {
      };
    }
    const newTick = `${Zotero.Utilities.randomString()}-${Date.now()}`;
    addon.data.translate.refreshTick = newTick;
    return () => {
      if (addon.data.translate.refreshTick === newTick) {
        addon.hooks.onReaderPopupRefresh();
        addon.hooks.onReaderTabPanelRefresh();
      }
    };
  }
  function getServices() {
    return addon.data.translate.services.getAllServices().map((service) => Object.assign({}, service));
  }
  function getVersion() {
    return version2;
  }
  var api_default = {
    translate,
    getServices,
    getVersion,
    getTemporaryRefreshHandler
  };

  // src/hooks.ts
  init_package();
  init_locale();

  // src/modules/preferenceWindow.ts
  init_package();

  // node_modules/n-gram/index.js
  var bigram = nGram(2);
  var trigram = nGram(3);
  function nGram(n) {
    if (typeof n !== "number" || Number.isNaN(n) || n < 1 || n === Number.POSITIVE_INFINITY) {
      throw new Error("`" + n + "` is not a valid argument for `n-gram`");
    }
    return grams;
    function grams(value) {
      const nGrams = [];
      if (value === null || value === void 0) {
        return nGrams;
      }
      const source = typeof value.slice === "function" ? value : String(value);
      let index = source.length - n + 1;
      if (index < 1) {
        return nGrams;
      }
      while (index--) {
        nGrams[index] = source.slice(index, index + n);
      }
      return nGrams;
    }
  }

  // node_modules/collapse-white-space/index.js
  var js = /\s+/g;
  var html = /[\t\n\v\f\r ]+/g;
  function collapseWhiteSpace(value, options) {
    if (!options) {
      options = {};
    } else if (typeof options === "string") {
      options = { style: options };
    }
    const replace = options.preserveLineEndings ? replaceLineEnding : replaceSpace;
    return String(value).replace(
      options.style === "html" ? html : js,
      options.trim ? trimFactory(replace) : replace
    );
  }
  function replaceLineEnding(value) {
    const match = /\r?\n|\r/.exec(value);
    return match ? match[0] : " ";
  }
  function replaceSpace() {
    return " ";
  }
  function trimFactory(replace) {
    return dropOrReplace;
    function dropOrReplace(value, index, all) {
      return index === 0 || index + value.length === all.length ? "" : replace(value);
    }
  }

  // node_modules/trigram-utils/index.js
  var own = {}.hasOwnProperty;
  function clean(value) {
    if (value === null || value === void 0) {
      return "";
    }
    return collapseWhiteSpace(String(value).replace(/[\u0021-\u0040]+/g, " ")).trim().toLowerCase();
  }
  function trigrams(value) {
    return trigram(" " + clean(value) + " ");
  }
  function asDictionary(value) {
    const values = trigrams(value);
    const dictionary = {};
    let index = -1;
    while (++index < values.length) {
      if (own.call(dictionary, values[index])) {
        dictionary[values[index]]++;
      } else {
        dictionary[values[index]] = 1;
      }
    }
    return dictionary;
  }
  function asTuples(value) {
    const dictionary = asDictionary(value);
    const tuples = [];
    let trigram2;
    for (trigram2 in dictionary) {
      if (own.call(dictionary, trigram2)) {
        tuples.push([trigram2, dictionary[trigram2]]);
      }
    }
    tuples.sort(sort);
    return tuples;
  }
  function sort(a, b) {
    return a[1] - b[1];
  }

  // node_modules/franc/expressions.js
  var expressions = {
    cmn: /[\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFA6D\uFA70-\uFAD9]|\uD81B[\uDFE2\uDFE3\uDFF0\uDFF1]|[\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879\uD880-\uD883\uD885-\uD887][\uDC00-\uDFFF]|\uD869[\uDC00-\uDEDF\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF39\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uD884[\uDC00-\uDF4A\uDF50-\uDFFF]|\uD888[\uDC00-\uDFAF]/g,
    Latin: /[A-Za-z\u00AA\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u02E0-\u02E4\u1D00-\u1D25\u1D2C-\u1D5C\u1D62-\u1D65\u1D6B-\u1D77\u1D79-\u1DBE\u1E00-\u1EFF\u2071\u207F\u2090-\u209C\u212A\u212B\u2132\u214E\u2160-\u2188\u2C60-\u2C7F\uA722-\uA787\uA78B-\uA7CA\uA7D0\uA7D1\uA7D3\uA7D5-\uA7D9\uA7F2-\uA7FF\uAB30-\uAB5A\uAB5C-\uAB64\uAB66-\uAB69\uFB00-\uFB06\uFF21-\uFF3A\uFF41-\uFF5A]|\uD801[\uDF80-\uDF85\uDF87-\uDFB0\uDFB2-\uDFBA]|\uD837[\uDF00-\uDF1E\uDF25-\uDF2A]/g,
    Cyrillic: /[\u0400-\u0484\u0487-\u052F\u1C80-\u1C88\u1D2B\u1D78\u2DE0-\u2DFF\uA640-\uA69F\uFE2E\uFE2F]|\uD838[\uDC30-\uDC6D\uDC8F]/g,
    Arabic: /[\u0600-\u0604\u0606-\u060B\u060D-\u061A\u061C-\u061E\u0620-\u063F\u0641-\u064A\u0656-\u066F\u0671-\u06DC\u06DE-\u06FF\u0750-\u077F\u0870-\u088E\u0890\u0891\u0898-\u08E1\u08E3-\u08FF\uFB50-\uFBC2\uFBD3-\uFD3D\uFD40-\uFD8F\uFD92-\uFDC7\uFDCF\uFDF0-\uFDFF\uFE70-\uFE74\uFE76-\uFEFC]|\uD803[\uDE60-\uDE7E\uDEFD-\uDEFF]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB\uDEF0\uDEF1]/g,
    ben: /[\u0980-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09FE]/g,
    Devanagari: /[\u0900-\u0950\u0955-\u0963\u0966-\u097F\uA8E0-\uA8FF]|\uD806[\uDF00-\uDF09]/g,
    jpn: /[\u3041-\u3096\u309D-\u309F]|\uD82C[\uDC01-\uDD1F\uDD32\uDD50-\uDD52]|\uD83C\uDE00|[\u30A1-\u30FA\u30FD-\u30FF\u31F0-\u31FF\u32D0-\u32FE\u3300-\u3357\uFF66-\uFF6F\uFF71-\uFF9D]|\uD82B[\uDFF0-\uDFF3\uDFF5-\uDFFB\uDFFD\uDFFE]|\uD82C[\uDC00\uDD20-\uDD22\uDD55\uDD64-\uDD67]|[\u3400-\u4DB5\u4E00-\u9FAF]/g,
    jav: /[\uA980-\uA9CD\uA9D0-\uA9D9\uA9DE\uA9DF]/g,
    kor: /[\u1100-\u11FF\u302E\u302F\u3131-\u318E\u3200-\u321E\u3260-\u327E\uA960-\uA97C\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/g,
    tel: /[\u0C00-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3C-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C5D\u0C60-\u0C63\u0C66-\u0C6F\u0C77-\u0C7F]/g,
    tam: /[\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BFA]|\uD807[\uDFC0-\uDFF1\uDFFF]/g,
    guj: /[\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AF1\u0AF9-\u0AFF]/g,
    kan: /[\u0C80-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDD\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1-\u0CF3]/g,
    mal: /[\u0D00-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4F\u0D54-\u0D63\u0D66-\u0D7F]/g,
    Myanmar: /[\u1000-\u109F\uA9E0-\uA9FE\uAA60-\uAA7F]/g,
    pan: /[\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A76]/g,
    Ethiopic: /[\u1200-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u137C\u1380-\u1399\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E]|\uD839[\uDFE0-\uDFE6\uDFE8-\uDFEB\uDFED\uDFEE\uDFF0-\uDFFE]/g,
    tha: /[\u0E01-\u0E3A\u0E40-\u0E5B]/g,
    sin: /[\u0D81-\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2-\u0DF4]|\uD804[\uDDE1-\uDDF4]/g,
    ell: /[\u0370-\u0373\u0375-\u0377\u037A-\u037D\u037F\u0384\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03E1\u03F0-\u03FF\u1D26-\u1D2A\u1D5D-\u1D61\u1D66-\u1D6A\u1DBF\u1F00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FC4\u1FC6-\u1FD3\u1FD6-\u1FDB\u1FDD-\u1FEF\u1FF2-\u1FF4\u1FF6-\u1FFE\u2126\uAB65]|\uD800[\uDD40-\uDD8E\uDDA0]|\uD834[\uDE00-\uDE45]/g,
    khm: /[\u1780-\u17DD\u17E0-\u17E9\u17F0-\u17F9\u19E0-\u19FF]/g,
    hye: /[\u0531-\u0556\u0559-\u058A\u058D-\u058F\uFB13-\uFB17]/g,
    sat: /[\u1C50-\u1C7F]/g,
    bod: /[\u0F00-\u0F47\u0F49-\u0F6C\u0F71-\u0F97\u0F99-\u0FBC\u0FBE-\u0FCC\u0FCE-\u0FD4\u0FD9\u0FDA]/g,
    Hebrew: /[\u0591-\u05C7\u05D0-\u05EA\u05EF-\u05F4\uFB1D-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFB4F]/g,
    kat: /[\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u10FF\u1C90-\u1CBA\u1CBD-\u1CBF\u2D00-\u2D25\u2D27\u2D2D]/g,
    lao: /[\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECE\u0ED0-\u0ED9\u0EDC-\u0EDF]/g,
    zgh: /[\u2D30-\u2D67\u2D6F\u2D70\u2D7F]/g,
    iii: /[\uA000-\uA48C\uA490-\uA4C6]/g,
    aii: /[\u0700-\u070D\u070F-\u074A\u074D-\u074F\u0860-\u086A]/g
  };

  // node_modules/franc/data.js
  var data = {
    Latin: {
      spa: " de|de |os | la| a |la | y |\xF3n |i\xF3n|es |ere|rec|ien|o a|der|ci\xF3|cho|ech|en |a p|ent|a l|aci|el |na |ona|e d| co|as |da | to|al |ene| en|tod| pe|e l| el|ho |nte| su|per|a t|ad | ti|ers|tie| se|rso|son|e s| pr|o d|oda|te |cia|n d| es|dad|ida| in|ne |est|ion|cio|s d|con|a e| po|men| li|n e|nci|res|su |to |tra| re| lo|tad| na|los|a s| o |ia |que| pa|r\xE1 |pro| un|s y|ual|s e|lib|nac|do |ra |er |a d|ue | qu|e e|sta|nal|ar |nes|ica|a c|ser|or |ter|se |por|cci|io |del|l d|des|ado|les|one|a a|ndi| so| cu|s p|ale|s n|ame|par|ici|oci|una|ber|s t|rta|com| di|dos|e a|imi|o s|e c|ert|las|o p|ant|dic|nto| al|ara|ibe|enc|o e|s l|cas| as|e p|ten|ali|o t|soc|y l|n c|nta|so |tos|y a|ria|n t|die|a u| fu|no |l p|ial|qui|dis|s o|hos|gua|igu| ig| ca|sar|l t| ma|l e|pre| ac|tiv|s a|re |nad|vid|era| tr|ier|cua|n p|ta |cla|ade|bre|s s|esa|ntr|ecc|a i| le|lid|das|d d|ido|ari|ind|ada|nda|fun|mie|ca |tic|eli|y d|nid|e i|odo|ios|o y|esp|iva|y e|mat|bli|r a|dr\xE1|tri|cti|tal|rim|ont|er\xE1|us |sus|end|pen|tor|ito|ond|ori|uie|lig|n a|ist|rac|lar|rse|tar|mo |omo|ibr|n l|edi|med| me|nio|a y|eda|isf|lo |aso|l m|ias|ico|lic|ple|ste|act|tec|ote|rot|ele|ura| ni|ie |adi|u p|seg|s i|un |und|a n|lqu|alq|o i|inc|sti| si|n s|ern",
      eng: "the| th| an|he |nd |ion|and| to|to |tio| of|on |of | in|al |ati|or |ght|igh|rig| ri|ne |ent|one|ll |is |as |ver|ed | be|e r|in |t t|all|eve|ht | or|ery|s t|ty | ev|e h|yon| ha|ryo|e a|be |his| fr|ng |d t|has| sh|ing| hi|sha| pr| co| re|hal|nal|y a|s a|n t|ce |men|ree|fre|e s|l b|nat|for|ts |nt |n a|ity|ry |her|nce|ect|d i| pe|pro|n o|cti| fo|e e|ly |es | no|ona|ny |any|er |re |f t|e o| de|s o| wi|ter|nte|e i|ons| en| ar|res|ers|y t|per|d f| a | on|ith|l a|e t|oci|soc|lit| as| se|dom|edo|eed|nti|s e|t o|oth|wit| di|equ|t a|ted|st |y o|int|e p| ma| so| na|l o|e c|ch |d a|enc|th |are|ns |ic | un| fu|tat|ial|cia| ac|hts|nit|qua| eq| al|om |e w|d o|f h|ali|ote|n e| wh|r t|sta|ge |thi|o a|tit|ual|an |te |ess| ch|le |ary|e f|by | by|y i|tec|uni|o t|o o| li|no | la|s r| su|inc|led|rot|con| pu| he|ere|imi|r a|ntr| st| ot|eli|age|dis|s d|tle|itl|hou|son|duc|edu| wo|ate|ble|ces|at | at| fa|com|ive|o s|eme|o e|aw |law|tra|und|pen|nde|unt|oun|n s|s f|f a|tho|ms | is|act|cie|cat|uca| ed|anc|wor|ral|t i| me|o f|ily|pri|ren|ose|s c|en |d n|l c|ful|rar|nta|nst| ag|l p|min|din|sec|y e| tr|rso|ich|hic|whi|cou|ern|uri|r o|tic|iti|igi|lig|rat|rth|t f|oms|rit|d r|ee |e b|era|rou|se |ay |rs | ho|abl|e u",
      por: "de | de| se|\xE3o |os |to |em | e |do |o d| di|er |ito|eit|ser|ent|\xE7\xE3o| a |dir|ire|rei|o s|ade|dad|uma|as |no |e d| to|nte| co|o t|tod| ou|men|que|s e|man| pr| in| qu|es | te|hum|odo|e a|da | hu|ano|te |al |tem|o e|s d|ida|m d| pe| re|o a|ou |r h|e s|cia|a e| li|o p| es|res| do| da| \xE0 |ual| em| su|a\xE7\xE3|dos|a p|tra|est|ia |con|pro|ar |e p|is | na|r\xE1 |qua|a d| pa|com|ais|o c|ame|er\xE1| po|uer|sta|ber|ter| o |ess|ra |e e|das|o \xE0|nto|nal|o o|a c|ido|rda|erd| as|nci|sua|ona|des|ibe|lib|e t|ado|s n|ua |s t|ue | so|ica|ma |lqu|alq|tos|m s|a l|per|ada|oci|soc|cio|a n|par|aci|s a|pre|ont|m o|ura|a s| um|ion|e o|or |e r|pel|nta|ntr|a i|io |nac|\xEAnc|str|ali|ria|nst| tr|a q|int|o n|a o|ca |ela|u\xE7\xE3|lid|e l| at|sen|ese|r d|s p|egu|seg|vid|pri|sso|\xE9m |ime|tic|dis|ra\xE7|eci|ara| ca|nid|tru|\xF5es|ass|seu|por|a a|m p| ex|so |r i|e\xE7\xE3|te\xE7|ote|rot| le| ma|ing|a t|ran|era|rio|l d|eli|\xE7a |sti| ne|cid|ern|utr|out|r e|e c|tad|gua|igu| ig| os|s o|ru\xE7|ins|\xE7\xF5e|ios| fa|e n|sse| no|re |art|r p|rar|u p|inc|lei|cas|ico|u\xE9m|gu\xE9|ngu|nin| ni|gur|la |pen|n\xE7a|na |i\xE7\xE3|i\xE3o|cie|ist|sem|ta |ele|e f|om |tro| ao|rel|m a|s s|tar|eda|ied|uni|e m|s i|a f|ias| cu| ac|r a|\xE1 a|rem|ei |omo|rec|for|s f|esc|ant|\xE0 s| vi|o q|ver|a u|nda|und|fun",
      ind: "an |ang|ng | da|ak | pe|ata| se| ke| me|dan| di| be|ber|kan|ran|hak|per|yan| ya|nga|nya|gan| at|ara| ha|eng|asa|ora|men|n p|n k|erh|rha|n d|ya |ap |at |as |tan|n b|ala|a d| or|a s|san|tas|eti|uk |pen|g b|set|ntu|n y|tia|iap|k m|eba|aan| un|n s|tuk|k a|p o|am |lam| ma|unt| de|ter|bas|beb|dak|end|i d|pun|mem|tau|dal|ama|keb|aka|ika|n m| ba|di |ma | sa|den|au |nda|n h|eri| ti|ela|k d|un |n a|ebe|ana|ah |ra |ida|uka| te|al |ada|ri |ole|tid|ngg|lak|leh|dap|a p|dil|g d|ena|eh |gar|na |ert|apa|um |tu |atu|a m|sam|ila|har|n t|asi|ban|erl|t d|bat|uat|ta |lan|adi|h d|neg| ne|kum|mas|nan|pat|aha| in|l d|emp|sem|rus|sua|ser|uan|era|ari|erb|kat|man|a b|g s|rta|ai |nny|n u|ung|ndi|han|uku|huk| hu|sa |ers|in | la|ka | su|ann|car|kes|aku|dip|i s|a a|erk|n i|lai|rga|aru|k h|i m|rka|a u|us |nak|emb|gga|nta|iba| pu|ind|s p|ent|mel|ina|min|ian|dar|ni |rma|lua|rik|ndu|lin|sia|rbu|g p|k s|da |aya|ese|u d|ega|nas|ar |ipe|yar|sya|ik |aga| ta|ain|ua |arg|uar|iny|pem|ut |si |dun|eor|seo|rak|ngs|ami|kel|ini|g t|dik|mer|emu|aks|rat|uru|ewa|il |enu|any|kep|pel|asu|rli|ia |dir|jam|mba|mat|pan|g m|ses|sar|das|kuk|bol|ili|u k|gsa|u p|a k|ern|ant|raa|t p|ema|mua|idi|did|t s|i k|rin|erm|esu|ger|elu|nja|enj|ga |dit",
      fra: " de|es |de |ion|nt |tio|et |ne |on | et|ent|le |oit|e d| la|e p|la |it | \xE0 |t d|roi|dro| dr| le|t\xE9 |e s|ati|te |re | to|s d|men|tou|e l|ns | pe| co|son|que| au| so|e a|onn|out| un| qu| sa| pr|ute|eme| l\u2019|t \xE0| a |e e|con|des| pa|ue |ers|e c| li|a d|per|ont|s e|t l|les|ts |tre|s l|ant| ou|cti|rso|ou |ce |ux |\xE0 l|nne|ons|it\xE9|en |un | en|er |une|n d|sa |lle| in|nte|e t| se|lib|res|a l|ire| d\u2019| re|\xE9 d|nat|iqu|ur |r l|t a|s s|aux|par|nal|a p|ans|dan|qui|t p| d\xE9|pro|s p|air| ne| fo|ert|s a|nce|au |ui |ect|du |ond|ale|lit| po|san| ch|\xE9s | na|us |com|our|ali|tra| ce|al |e o|e n|rt\xE9|ber|ibe|tes|r d|e r|its| di|\xEAtr|pou|\xE9t\xE9|s c|\xE0 u|ell|int|fon|oci|soc|ut |ter| da|aut|ien|rai| do|iss|s n| ma|bli|ge |est|s o| du|ona|n p|pri|rs |\xE9ga| \xEAt|ous|ens|ar |age|s t| su|cia|u d|cun|rat| es|ir |n c|e m| \xE9t|t \xEA|a c| ac|ote|n t|ein| tr|a s|ndi|e q|sur|\xE9e |ser|l n| pl|anc|lig|t s|n e|s i|t e| \xE9g|ain|omm|act|ntr|tec|gal|ul | nu| vi|me |nda|ind|soi|st | te|pay|tat|era|il |rel|n a|dis|n s|pr\xE9|peu|rit|\xE9 e|t \xE9|bre|sen|ill|l\u2019a|d\u2019a| mo|ass|lic|art| pu|abl|nta|t c|rot| on| lo|ure|l\u2019e|ava|ten|nul|ivi|t i|ess|ys |ays| fa|ine|eur|r\xE9s|cla|t\xE9s|oir|eut|e f|utr|doi|ibr|ais|ins|\xE9ra|\u2019en|i\xE9t|l e|s \xE9|nt\xE9| r\xE9|ssi| as|nse|ces|\xE9 a",
      deu: "en |er |der|ein| un|nd |und|ung|cht|ich| de|sch|ng | ge|ine|ech|gen|rec|che|ie | re|eit| au|ht |die| di| ha|ch | da|ver| zu|lic|t d|in |auf| ei| in| be|hen|nde|n d|uf |ede| ve|it |ten|n s|sei|at |jed| je| se|and|rei|s r|den|ter|ne |hat|t a|r h|zu |das|ode| od|as |es | an|fre|nge| we|n u|run| fr|ere|e u|lle|ner|nte|hei|ese| so|rde|wer|ige| al|ers|n g|hte|d d| st|n j|lei|all|n a|nen|ege|ent|bei|g d|erd|t u|ren|nsc|chu| gr|kei|ens|le |ben|aft|haf|cha|tli|ges|e s| si|men| vo|lun|em |r s|ion|te |len|gru|gun|tig|unt|uch|spr|n e|ft |ei |e f| wi| sc|r d|n n|geh|r g|dar|sta|erk| er|r e|sen|eic|gle| gl|lie|e e|tz |fen|n i|nie|f g|t w|des|chl|ite|ihe|eih|ies|ruc|st |ist|n w|h a|n z|e a| ni|ang|rf |arf|gem|ale|ati|on |he |t s|ach| na|end|n o|pru|ans|sse|ern|aat|taa|ehe|e d|hli|hre|int|tio|her|nsp|de |mei| ar|r a|ffe|e b|wie|erf|abe|hab|ndl|n v|sic|t i|han|ema|nat|ber|ied|geg|d s|nun|d f|ind| me|gke|igk|ie\xDF| fa|igu|hul|r v|dig|rch|urc|dur| du|utz|hut|tra|aus|alt|bes|str|ell|ste|ger|r o|esc|e g|rbe|arb|ohn|r b|mit|d g|r w|ntl|sow|n h|nne|etz|raf|dlu| ih|lte|man|iem|erh|eru| is|dem|lan|rt |son|isc|eli|rel|n r|e i|rli|r i| mi|e m|ild|bil| bi|eme| en|ins|f\xFCr| f\xFC|gel|\xF6ff| \xF6f|owi|ill|wil|e v|ric|f e",
      jav: "ng |an | ka|ang|ing|kan| sa|ak |lan| la|hak| pa| ha|ara|ne |abe| in|n k|ngg|ong|ane|nga|ant|won|uwo| an| uw|nin|ata|n u|en |ra |tan| da|ran|ana| ma|nth|ake|ben|beb|hi |ke |sab|nda| ng|adi|thi|nan|a k| ba|san|asa|ni |e h|e k|g k| ut|pan|awa| be|eba|gan|g p|dan| wa|bas|aka|dha|yan|sa |arb|man| di|wa |g d| na|g n|ban| tu|n s|ung|wen|g s|rbe|dar|dak|di |g u|ora|aya|be |ah |a s|eni| or|han|as | pr|a n|na |iya|a a|kar|at |a l|mar|uwe|duw|uta|und|n p|asi|pa | si|ala|n n| un|kab|oni|ya |i h|gar|g b|yat|tum|ta |n m|i k|apa|taw| li|ani| ke|al |ka |kal|ngk|ega| ne|nal|n i|g a|ggo|ina|we |ena|dad|iba|awi|aga|a p| ta|sar|adh|awe|and|uju|ind|min|sin|ndu|uwa|gge|n l|ggu|ngs|n b|a b|pra|iji|n a|ha | bi|kat|go | ku|e p|ron|kak|ngu|a u|gsa|war|nya|g t|pad|bis|k b|i w|ae |wae| nd|ali|a m|er |sak|e s|ku |liy|ama|i l|eh |isa|arg|n t|a d|kap|i s|ayo|gay| pe|ndh|bad|pri|neg|tow|uto|eda|bed|il |ih | ik|ur |k k|rta|art|i p|rga|lak|ami|ro |aro|yom|r k|e d|a w|kon|rib|eng|ger|g l|ras|dil| ti|k l|rap|mra|uma| pi|k h|n d|gaw|wat|ga |k n|ar |per| we|oma|k p|jro|ajr|saj|ase|ini|ken|saw|ona|nas|kas|h k|i t| um|tin|wo | me|aba|rak|pag|yar|sya|t k| te| mu|ngl| ni|i b|men|ate|a i|aku|ebu|a t| du|g m|owo|mat| lu|amp",
      vie: "ng |\u0323c |\u0301c | qu|a\u0300 | th|nh | ng|\u0323i |\u0300n |va\u0300| va| nh|uy\xEA| ph|quy| ca|\xEA\u0300n|y\xEA\u0300|\u0300nh|\u0300i |\u0323t | ch|o\u0301 | tr|ng\u01B0|i n| gi|g\u01B0\u01A1|\u01A1\u0300i|\u01B0\u01A1\u0300|\u0301t | co|\u01B0\u01A1\u0323| cu|a\u0301c|\u01B0\u0323 |\u01A1\u0323c| kh| \u0111\u01B0|\u0111\u01B0\u01A1| t\u01B0|co\u0301| ha|\xF4ng|c t| \u0111\xEA|n t|i \u0111|i\u0300n|\u0300u |ca\u0301|gia|\u0301i |o\u0323i|mo\u0323| mo|\xEA\u0300u|i\xEA\u0323|\u0111\xEA\u0300|u c|nh\u01B0|pha| ba| bi|\xE2\u0301t|\u0309a |u\u0309a|cu\u0309|h\xF4n| \u0111\xF4|g t|\u0301 q|\u0303ng| ti|t\u01B0\u0323|t c|\u0323n | la|n \u0111|n c|n n|hi\xEA|ch |ay |hay| vi|\xE2n | \u0111i| na|ba\u0309| ho|do | do| t\xF4| hi|\xF4\u0323i|ha\u0301|i\u0323 |na\u0300|\u0300 t|\u01A1\u0301i|h\xE2n| m\xF4|\u0301p |a\u0300n|\u0323 d|\u0301ch|\u0323p |\u0300o |a\u0300o|kh\xF4|\u0301n |\xF4\u0323t|m\xF4\u0323| h\xF4|ia |\xF4\u0301c|c h|h\u01B0\u0303|i v|g n|\u0301ng|u\xF4\u0301|qu\xF4|h t|\xF4n |\xEAn |n v|nh\xE2|\u0323 t| b\xE2|i c|g v|\u0309ng|i\xEA\u0301|c c|\xE2\u0323t|th\u01B0|h\u01B0 |\u01B0\u01A1\u0301|\u0309n | v\u01A1| c\xF4|c \u0111| \u0111o| s\u01B0|t t|\xF4\u0323c|\u01B0\u0303n|v\u01A1\u0301| v\xEA|a\u0309 |\u0323ng|g \u0111|\u0309o |a\u0309o|u\xE2\u0323| \u0111a|bi\u0323|la\u0300|s\u01B0\u0323|b\xE2\u0301|ha\u0300|h\xF4\u0323|i t|a\u0309n|h\u01B0\u01A1|\u0300ng|tro|\u0309m |o v| mi|\xEA\u0309 |u\u0323c|i h|\u01B0\u0301c|a\u0301p|g c|\u0303 h|ia\u0301|n b|\u0309i |a m|h c|c\xF4n|\xEA\u0323n|\u01A1\u0301c|ha\u0323|\u0111\xF4\u0323| du| c\u01B0|a c|n h|tha|a\u0303 | xa|\u0301o |a\u0301o|i\u0301n|\u0300y |g b| h\u01B0|g h|ong|ron|\u0300 c|cho|\u0300 n|mi\u0300|\u01B0\u0323c|h v|c b| lu|i b|\xEA\u0323 |ai |\xEA\u0301 |\u0323 c|xa\u0303|kha|c q|i\xEA\u0309|t\xF4\u0323|\xF4\u0301i|\u0111\xF4\u0301|a\u0301 |hoa|o h|h \u0111|ca\u0309|n l|ho\u0323|ti\xEA|y t|\u0309 c|a\u0323i|a\u0301n|\u0300 \u0111|oa\u0300|y \u0111|chi|\u0309 n|ph\xE2|\xEA\u0300 |thu|i\xEAn|du\u0323|o c|i m|lu\xE2|c p|\xF4\u0301n|c l|\u0301 c|u\u0303n|cu\u0303|c g|c n|qua|n g|c m|o n|a\u0309i|ha\u0309|\u0301 t|ho |v\xEA\u0300| t\xE2| h\u01A1|o t|\u01A1\u0309 |h\u01B0\u0301|hi\u0300|vi\xEA|\u0300m |\u0309 t|\u0111o\u0301|th\xF4|\u01B0\u0301 |c\u01B0\u0301|hi\u0301|\u0301nh|a\u0300y|\u01A1\u0309n|\u01B0\u01A1\u0309| b\u0103|tri| ta|m v|c v|\u01A1\u0323p|h\u01A1\u0323|h m| n\u01B0|\xEA\u0301t|thi|\u0103\u0323c|ngh|uy ",
      ita: " di|to | in|ion|la | de|di |re |e d|ne | e |zio|rit|a d|one|o d|ni |le |lla|itt|ess| al|iri|dir|tto|ent|ell|i i|del|ndi|ere|ind|o a| co|te |t\xE0 |ti |a s|uo |e e|gni|azi| pr|idu|ivi|duo|vid|div|ogn| og| es|i e| ha|all|ale|nte|e a|men|ser| su| ne|e l|za |i d|per|a p|ha | pe| un|con|no |sse|li |e i| o | so| li| la|pro|ia |o i|e p|o s|i s|in |ato|o h|na |e s|a l|e o|nza|ali|tti|o p|ta |so |ber|ibe|lib|o e|un | a | ri|ua |il | il|nto|pri|el | po|una|are|ame| qu|a c|ro |oni|nel|e n| ad|ual|gli|sua|ond| re|a a|i c|ri |o o|sta|ita|i o| le|ad |i a|ers|enz|ssi|\xE0 e|it\xE0|gua|i p|e c|io | pa|ter|soc|nal|ona|naz|ist|cia|rso|ver|a e|i r|tat|lle|sia| si|rio|tra|che| se|rt\xE0|ert|anz|eri|tut|\xE0 d|he | da|al |ant|qua|on |ari|o c| st|oci|er |dis|tri|si |ed | ed|ono| tu|ei |dei|uzi|com|att|a n|opr|rop|par|nes|i l|zza|ese|res|ien|son| eg|n c|ont|nti|pos|int|ico|r\xE0 |sun|ial|lit|sen|pre|tta|dev|nit|era|eve|ll |l i| l |nda|ina|non| no|o n|ria|str|d a|art|se |ssu|ica|raz|ett|sci|gio|ati|egu| na|i u|utt|ve | ma|do |e r|ssa|sa |a f|n p|fon| ch|d u|rim| fo|a t| sc|tr\xE0|otr|pot|n i| cu|l p|ra |ezz|a o|ini|sso|dic|ltr|uni|cie| ra|i n|ruz|tru|ste| is|der|l m|a r|pie|lia|est|dal|nta| at|tal|ntr| pu|nno|ann|ten|vit|a v",
      tur: " ve| ha|ve |ir |ler|hak| he|her|in |lar|r h|bir|ya |er |ak |kk\u0131|akk|eti| ka| bi|eya|an |eri|iye|yet|ara|ek | ol|de |vey|\u0131n |\u0131r |nda|ar\u0131|esi|\u0131n\u0131|d\u0131r| ta|tle|e h|as\u0131|etl|e k| va|\u0131 v|s\u0131n|ile|ne |rke|erk|ard|ine| sa|\u0131nd|ini|k h|k\u0131n|ama|le |tin|rd\u0131|var|a v| me|e m|na |sin|ere|k v| \u015Fa| bu|lan|kes|dir|rin|dan| ma|k\u0131 |mak|\u015Fah|da | te|mek| ge|n\u0131 | hi|nin|en |n h| se|lik|rle|ana|lma|e a|\u0131 h|r \u015F|ill|si | de|aya|zdi|izd|aiz|hai|ret|hi\xE7|\u0131na| i\u015F|e b| ba|kla|et | h\xFC|r\u0131n|n k|ola|nma|e t| ya|eme|riy|n v|e i|a h|li |mil|eli|ket|ik |kar|irl|h\xFCr|im |evl|mes|e d|ahs|ma |rak|ala|let|lle|un | ed|rri|\xFCrr|bu | mi|i v|dil| il| e\u015F|n i|la |el |mal| m\xFC| ko|e g|se | ki|mas|lek|mle|mem|n b|ili|e e|ser| i\xE7|n s|din| di|es |mel|eke|tir|\u015Fit|e\u015Fi|r b|akl|yla|n m|len| ke|edi|oru|nde|re |ele|ni |t\xFCr|a k|eye|\u0131k |ken|u\u011Fu| uy|eml|erd|ede|ame| g\xF6|e s|i m|tim|i b|rde|r\u015F\u0131|ar\u015F|a s|it |t v|siy|ar |rme|est|bes|rbe|erb|te |al\u0131| an|ndi|end|hs\u0131|unm|r\u0131 |kor|n\u0131n| ce|maz|mse|ims|kim|i\xE7 | ay|a m|lam|ri |s\u0131z|a b|ade|n t|nam|lme|ilm|k g|il |tme|etm|r v|e v|n e|\u011Fre|\xF6\u011Fr| \xF6\u011F|al |\u0131yl|olm|vle|\u015Fma|i s|ger|me | da|ind|lem|i o|may|cak|\xE7in|i\xE7i|nun|kan|ye |e y|r t|az |\xE7 k|ece|s\u0131 |eni| mu|ulu|und|den|lun| fa|\u015F\u0131 |ahi|l v|r a|san|kat| so|enm| ev|i\u015F ",
      pol: " pr|nie|pra| i |nia|ie |go |ani|raw|ia | po|ego| do|wie|iek|awo| ni|owi|ch |ek |do | ma|wo |a p|\u015Bci|ci |ej | cz| za| w |ych|o\u015Bc|rze|prz| ka|wa |eni| na| je|a\u017Cd|ka\u017C|ma |z\u0142o|cz\u0142|no\u015B|o d|\u0142ow|y c|dy |\u017Cdy|i p|wol| lu|ny |oln| wy|stw| wo|ub |lub|lno|rod|k m|twa|dzi|na | sw|rzy|aj\u0105|ecz|czn|sta| sp|owa|o p|spo|i w|kie|a w|zys|obo|est|neg|a\u0107 |mi |cze|e w|nyc|nic|jak| ja|wsz| z |jeg|wan|\u0144st|o s|a i|awa|e p|yst|pos|pow| r\xF3|o o|j\u0105c|ony|nej|owo|dow|\xF3w | ko|kol|aki|bez|rac|sze|iej| in|zen|pod|i i|ni | ro|cy |o w|zan|e\u0144s|no |zne|a s|lwi|olw|ez |odn|r\xF3w|odz|o u|ne |i n|i k|czy| be|acj|wob|inn| ob|\xF3wn|zie| ws|aln|orz|nik|o n|icz|zyn|\u0142ec|o\u0142e|po\u0142|aro|nar|a j|i z|t\u0119p|st\u0119|ien|cza|o z|ym |zec|ron|i l|ami| os|kra| kr|owe| od|ji |cji|mie|a z|bod|swo|dni|zes|e\u0142n|pe\u0142|iu |edn|iko|a n|raj| st|odo|zna|wyc|em |lni|szy|wia|nym|\u0105 p|j\u0105 |ze\u0144|iec|pie|st |jes| to|sob|kt\xF3|ale|y w|ieg|och|du |ini|war|zaw|nny|roz|i o|wej|i\u0119 |si\u0119| si|nau| or|o r|kor|e s|pop|zas|niu|z p|owy|w k|ywa| ta|ymi|hro|chr| oc|jed|ki |o t|ogo|oby|ran|any|oso|a o|t\xF3r| kt|w z|dne|to |tan|h i|nan|ejs|ada|a k|iem|aw |h p|wni|ucz|ora|a d| w\u0142|ian| dz| mo|e m|awi|\u0107 s|gan|zez|mu |taw|dst|wi\u0105|w c|y p|kow|o j|i m|y s|bow|kog|by |j o|ier|mow|sza|b o|ju |yna",
      swh: "a k| ya|na |wa |ya | ku|a m| na| ha|i y| wa|a h|a n|ana|aki|ki |la |hak| ka|kwa|tu | kw| ma|li |a a|ila|i k| ki|ni |a w|ali|a u| an| mt|ke |mtu|a y|ake|ati|kil|ka |ika|kat|ili|te |ote|we |a s|e k|ia |zi |u a|za |azi|ifa|ma |yak|yo |i n|ama| yo|au | au|e a|kut|amb|o y|ha |asi|fa |u w|hal|ara|sha|ish|ata|ayo| as|tik|u k| za|i z|ina|u n|mba|uhu|hi |hur|cha|yot|ru |uru|wat| ch|eri|ngi|e y|u y|i a|aif|tai| sh|nay|chi|ra |ani| bi| uh|sa | hi|i h|awa|iwa|a j|ti |mu |o k|ja |kan|uli|iwe|any|i w| am|e n|end|atu|kaz|o h|ria|her|she|shi|nch| nc|uta|ye |wak|ii |ele|ami|adh|eza| wo|iki|oja|moj|jam| ja|aka|bu |kam|kul|mat|fan|a l|agu|ind|ne |iri|lim|wen|da |kup|uto|i m|a b|ini|wan|bil| ta|sta|dha| sa| ni|ao | hu|e w|wot| zi|rik|kuf|aji|ta |wez|nya|har| ye|e m|si |lin| ut|ine|gin|ing| la|a t|zim|imu|ima|tak|e b|uni|ibu|azo|kos|yan|nye|uba|ari|ahi|nde|asa|ri |ham|dhi|eli|hir|ush|pat| nd|kus|maa|di |nda|oa |bar|bo |mbo|oka|tok|ndw|ala|wal| si|uzi|hii|tah|i s|o n|liw| el|upa|zin|hag|a c|ndi|ais|mai|eny|mwe|aa |ewe| al|ndo|e h|lo |umi|kuh|jib|osa|mam|a z|ufu|dwa|u i| in|iyo|nyi| ny|u m|sil|ang|o w|guz|zwa|uwa|kuw|hil|saw|uch|ufa|laz|und|aha|ua | mw|bal| lo|o l|a i|del|nun|anu|nji| ba|lik|le |uku|i i",
      sun: "an |na |eun|ng | ka|ana| sa| di|ang|ung|un |nga|ak | ha|keu| ba|a b| an|nu |hak| bo|anu|ata|nan|a h|ina| je|aha|ga |ah |awa|jeu| na|ara|ing|oga|bog|gan| ng|asa|kan|a s|ha |ae |bae|n k|a k| pa|a p|sah|g s|sar| si|sin|a n|din|n s|ma | at|aga|a a|tan| ku| ma|n a|san|man|wa |lah|pan|taw|u d|ra |ari|eu | pi|gar| pe|kat| te|n p|sa |per|a d|a m|e b|aan|ban|ran|ala|ike|n n|kum| ti|ama|a j|pik|ima|n d|al |at | ja|ila|ta |nda|bas|rim|teu|n b|eba|beb|udu|aya|ika|ngg|nag|kab|rta|art| me|ola|k n|uma|atu|aba|g k|adi|aca| po|ngt|nar|una|ate|oh |boh|awe|di |tin|asi|uku|n h|dan|aka|iba|car|sac|gaw|are|ent|um |jen|abe|u s|dil|pol|ar |ku |kud|u m|upa|han| hu|ake|bar|ur |hna|aru|h s|a t|sak|wat|kaw| so|n t|pa |mpa|du |ngk|g d|ena|huk| mi|mas|ngs|ti |n j|ka |aku|ren|n m| ta|law|isa| tu|und|a u|h a|tay|ula|aja|ali|nte|gsa|en |gam| wa|ieu|ere|k h|jal|h b|il |dit|ngu|lan|asu|yun|ayu|gta|k d|a r|g n|mah|uda|dip|kas|rup|geu| be|ter|sej|min|ri |ern|u p|k k|amp|ura|kal|e a|k a|ut |g b|nak|bis| bi|k p|tes|end|we |h k|tun|uan| un| de|u n|h t|ksa|u k|ian|wil|u b|ona|nas|uka|rak|eje| se|ami| ke|war| ra| ie|k j|eh |ya |lma|alm|pen|tur|wan|lak|h j|g a|ean|up |rga|arg|r k|u t| ne|deu|gal|gke|e t|h p| ge|g t| da|i n",
      ron: " de|re | \xEEn|\u0219i |are|de | \u0219i|te |ul | sa|rep|e d|ea |ept|dre|tul|e a| dr|ie |\xEEn |ptu|le |ate|la |e p| la| pe|ori| pr|ce |e s| or|au |tat| ar|ice|ii |or |a s| fi| a |ric|ale|per| co|n\u0103 |\u0103 a|rea|ers|i s| li|sau| ca|rso|ent|lor|a\u021Bi|al |a d|e o|men|l l|ei |e c|pri|an\u0103| ac| re|uri|ber|ibe|lib|a p|oan|soa| in|i l|ter| al| s\u0103|tea|l\u0103 |car|t\u0103\u021B|s\u0103 |tur|i a|i d|nal| ni|ri |ita|e \xEE|e \u0219|se |ilo|in |ia |\u021Bie|pre|fie|\u021Bii|\u0103\u021Bi|con|ere|e f|a o|eni|nte| nu| se|ace|ire|ici| cu|i \xEE|a c|i n|a l|pen|ui |nu |\u0103ri|al\u0103|ona|l d|r\u0103 |ert|ril| su|ntr|n c|rin| as|ni |i o|eri|t\u0103 |c\u0103 |ile|\u0103 d|i c|e n|ele|sa | mo|i p|fi |sal|tor|va |oci|soc|nic|pro| un| tr|est|in\u021B|a \xEE|uni|n m|a a| di|ecu|lui|sta|lit| po|tre|gal|ega|oat|ra |act|\u0103 \xEE|leg|u d|e l|nde|int|a f|n a| so|na\u021B|ara|i f|uie|iun| to|tar|ste|ces|rar|at | ce|eme|i \u0219|rec|dep| c\u0103| o | \xEEm|bui|ebu|reb| eg| na|m\xE2n|ntu|ili|v\u0103\u021B|\xE2nd|iei|r \u0219|bil|pli|od |mod|res|din|e e|c\u021Bi| au|ali|\u0103 p|\u0103 f|\xEEmp|ial|cia|ion|\u0103 c|dec|nta| om|it\u0103| fa|\u021B\u0103 |cu |tra|\u0103\u021B\u0103|nv\u0103|\xEEnv|\xE2t |ite|i i|lic| pu| ex|riv|tri|rot|\u021Ba |\u021Bi |l c|rta|imi|ulu|\u021Bio|ic\u0103|lig|rel|ta |cla|t \xEE|nt |nit|e m|\xE2nt|\u0103m\xE2|\u021B\u0103m|ger|n\u021Ba|ru |tru|gur|u c|bli|abi|at\u0103|art|par|ar |rim|iva|l \u0219| sc|ime|nim|era|sup|ind|u a|dic|ic | st| va|ini|igi|e r",
      hau: "da | da|in |a k|ya |a d| ya|an |a a| ko| wa|na | a |sa | ha|kin|wan|ta | ba|a s| ta|a y|a h|wa |ko | na|n d|a t|ba |ma |n a| ma|iya|hak|asa| sa|ar |ata|yan| za|akk|a w|ama| ka|i d|iki|a m|owa|a b| ci| mu| sh|anc|nci|kow|a z|ai |nsa|a c|shi| \u0199a|cik|ne |ana|i k|ci |kki|e d|a \u0199| ku|su |n y|uma|ka |uwa|kum|hi |a n|utu| yi|ani| ga| ra|aka|ali|mut|\u2018ya|tar| do|\u0257an|ars| \u2018y|sam|\u0199as|nda|ane|man|tum|i a|yi |ni | du|ada| su|and|a g|cin| ad|a i|ke | \u0257a|n k|yin|um |e m| ab|ins|nan|ki |mi |ami|yar|min|oka|re |i b|kam|mas|i y|mat|za |ann|en |a\u0257a| ja|m n|li |duk|dai|e s|n s|ra |n w|n h|aik| ai|ida|ga |san|rsa|aba|sar|ce |nin| la|o n|ban|nna|kan|abi|una|dam|me |ara|i m|hal|a r|add|are|n j|abu| ne|zai|a \u0257|wat|ari| \u0199u|on |ans|wa\u0257|ame|ake|kar|din|zam| fa|a l|\u0199un|buw|r d| hu|oki|kok|a \u2018|u d|n t|abb|aur| id|rin|yak|dok|kiy|ray|jam|n b|ubu|bub|n m|i s| an|am |ili|bba|omi|dan|gam|ayu|ash|nce|tsa|ayi|har|yya|ika|bin|han|kko|rsu|aif|imi|fa | am|i i|dom| ki|yuw|dun|o a|fan|n \u0199|aya|fi |n r|she|uni|bay|riy|n \u2018|sab| iy|bat|tab|aga| ir|mar|o w|i w|sha|awa| ak|uns|unc|tun|u k| il|\u0257in|mfa|amf|aci|ewa|kas|lin|n n|don|n i|ure|ifi|lai|dda| ts|iri|aye|un |tan|wad|gwa|afi| ay|ace|mba|amb|aid|nta|ant|war|lim|kya| al|a\u0257i",
      fuv: "de | e |e n| ha|nde|la | wa|ina| ka|akk| nd|\u0257o |na | in|e e|hak|al |di |i h|kke|ii |um |ko |ala|ndi| mu| ne|lla| jo|wal|e\u0257\u0257|ne\u0257|all|mum| fo|kal|jog|ke |aaw|taa| ko|eed|\u0257\u0257o|aa | le|ji |ade|aad|laa|o k| ng|e h| ta|re |ogi|a j|e w|e m|nnd|gii|e l|ley|awa|aag|ede|waa|e k|gu |e d| go|gal|\u0253e |ti |fot|aan|eyd|ydi|\u0257e |ee | re|ol |oto|i e|oti|m e|taw|nga|a i|kee|to |ann|eji|am |ni | wo|een|goo|eej|e f| he|enn|gol|agu|pot| po|dee|ay | fa|ka |a k|ond|oot| de|a f|o f|a n|wa |maa|ota|le |hay|i k|o n|ngo|e j|o t| ja|\xF1aa|hee|nka|i w|awi|a w|ngu|der| to|e t|dim|i n|fof|i f|e g|tee|naa|aak| do|too|a e|ndo|ren|dii|oor|er |o e|i m|of | sa| so|gaa|ani|kam| ma| \xF1a|o w|i l|u m|kaa|ima|dir| ba|igg|lig| li|aar| \u0253e|o i|e s| o |e r|so |ooj| nj| la|won|awo|dow|woo|faw|and|e i|ore|nge|nan|are|a t|tin|aam| mo|\u0257ee|ita|ira|aa\u0257|e p|nng|ma |ank|yan|nda|oo |e \u0253|njo|ude|nee|e y|e a|je | ya|en |ine|iin| di|ral| na|\u0257i |und| hu|inn|\u014Bde|a\u014Bd|ja\u014B|a d|den| fe| te|go | su|a h|haa|tal|e\u0257e|e b|y g|baa|tde| yi|\u0257\u0257a|o h|ii\u0257|ow | da|do |l n|alt| ho|l e|aga|mii| aa|a a|ama|nna|m t| ke|edd|oga|m w|l m|o j|a\u0257e|ree|oje|yee| no|ele|ne |ago| pa| al|guu|wi |ge |aa\u0253|daa|ind|dew|i j|jey| je|ent|tan|o \u0257|ge\u0257| ge|\xF1ee|a l| \u0257u|kko|mak|a s| ga",
      bos: " pr| i |je |rav|na |ma |pra| na|ima| sv|a s|da |a p|vo |nje|ko |ako|anj|o i| po|avo|ja |e s|a i|ti | im| da| u |sva|no |ju | za|o n|va |i p|ili|vak|li | ko|ne | il|koj| ne|nja| dr|ost| sl|van|im |i s|u s|i i|a n|ava|ije|a u| bi|stv|se |a d|om |jed|bod|obo|lob|slo| se| ra|ih |sti| ob| je|pri|enj|dru|u i|o d|iti|voj|raz|ova|dje| os|e i|lo |e p| nj|uje|i d|bra|tre| tr| su|jeg|i n|u z|a k|og |u p|oje|cij|reb|a o|a b|lju|i u|ran|mij|ni |nos|jen|ba |edn|svo| iz|jel|pro|e d|\u017Eav|bit| ni|i o|sta|a z|avn|vje| ka|bil|ovo|a j|aju|ist|nih|tu |red|gov| od|e o|oji| sm|lje|o k|ilo|ji |aci|e u|e n|pre|o p|eba|u o|su |vim|i\u010Dn| sa|u n| dj|a t|ija|\u010Dno|jem|r\u017Ea|dr\u017E|elj|stu|dna|odn|eni|za |iva|olj|\u0161ti|nom|em |du |vno|smi|jer|e b|de |pos|m i| do|u d|nak|a r|obr| mo|lja|nim|ego| kr|tit|kri|ve |nju|an |iko|nik|nu |i m|nog|eno|sno| st|e k|tup|rug|ka |oda|riv|vol|aln|m s|itu|a\u0161t|za\u0161|ani|sam|akv|ovi|osn|rod|aro| mi|tva|dno|nst|jan|ak |ite|vi\u010D|rad|u m| ta|dst|tiv|nac|rim|kon|ku |odu|\u017Eiv|amo|tvo|tel|pod|g p|nov|ina|nar| vj|o s|i b|oj | ov|ave|vu |ans|oja|zov|azo|ude|bud| bu|e t|i v|din|edi|nic|tan|nap|mje| is|jal|slu|pun|eds|o o|zak|jav|i k|m p|tno|ivo|ere|ni\u010D|m n|jim|kak|ada|vni|ugi| ro|mov|ven|pol|to |te | vr",
      hrv: " pr| i |ma |rav|ima|pra|je |na | sv|ti | na|a p|vo |vat|ko |a s|nje| po|anj|avo|o i|tko| im|a i|sva|no |i p|e s|ja |o n| za|ju |ili| u |va |li | bi|ne |i s|atk| il|iti|da | ne| ko| dr| sl|van|nja|koj|ije| ra|ova| os|u s|i i|ost|bod|obo|lob|slo|pri|a n|om |jed|ati|ih |im |voj|ava| ob|stv|se | mo|i u|bit|dru| je| se|dje|i o|enj| ka|i n|sti|lo |u i|svo|mij|ni |e i|raz|a o|e n|bra|o p| su|a b|u p|ran|a k|og |i d|bil|ako|e p|a d|edn|aju|mor|eni| nj|iva|jel|\u017Eav| ni|a z|avn|ovi|eno|ra |oje|a j| da|a u|ora|jeg| iz|nih|r\u017Ea|dr\u017E|oji|sno|nit|jen|vje|ilo|cij|oda|nim| dj|pro|tit|u z|e d|red|nom|jem| od|nos|sta|nov|osn| sm|lje|o s|ji |ovo|stu|pos|vim| do|odn|rad|ist| sa|e o|tu |nju|em |gov|o d|rod|i m|jer|aci|oj |pre|m i|nak|dna|a r|lju|uje|e m|obr|za |olj|ve |o o|m s|an |nu |du |aro|vno|smi|aln|e k|o k|i b|e u|tva|u u|tup|rug|dno|u o|su |u d|ka |vol| ta|ija|itu|\u0161ti|a\u0161t|za\u0161|itk|\u017Eiv|ani|sam|elj| st|sob|oso|nar|akv|ada| mi|te |ona|nst|jan|lja|i v|ite|ego|elo|rim|ku |odu|amo|tvo|tel|jim|pod|nog|vi |ina| vj|to |e b|ans|zov|azo|ak | sk|edi|tan|oju|pun|pot|oti|kon|zak|i k|m p|tno|ivo|ere|ni\u010D|kak|vni|ugi| ro|mov|ven|\u0161tv| be|ara|kla|ave|u b|avi|oja|jal|u m|dni|mje|rak|din|\u0107i |ju\u010D|klj|nic|u k|nap|obi|atn",
      nld: "en |an |de | de| he|ing|cht| en|der|van| va|ng |een|et |ech| ge| ee|n e|rec| re|n v|n d|nde|ver| be|er |ede|den| op|het|n i| te|lij|gen|zij| zi|ht |ijk|eli| in|t o| ve|op |and|ten|ke |ijn|e v|jn |ied| on|eft| ie|sch|n z|n o|aan|ft |eid|te |oor| we|ond|eef|ere|hee|id |in |rde|n w|t r|aar|rij|ord|wor|ens|of | of|hei|n g| vr| vo| aa|r h|hte| wo|n h|al |nd |vri|e o|ren|le |or |n a|jke|lle|eni|n b|ij |e e|g v| st|ige|die|e g|men|nge|t h|e b| za|e s|om |t e|ati|wel|erk|sta|ers| al| om|n t|zal|dig| me|ste|voo|ter|gin|re |ege|ge |g e|bes|nat| na|eke|che|ig |gel|nie|nst|e a|nig|est|e w|erw|r d|end|ona|d v|jhe|ijh|d e|ele| di|ie | do|del|n n|at |it | da|tie|e r|elk|ich|jk |vol|ijd|tel|min|len|str|lin|n s|per|t d|han| zo|hap|cha|wet| to|ven| ni|aat|ion|tio|taa|lke|eze|met|ard|waa|uit|sti|e n|doo|pen|eve|el |toe|ale|ien|ach|st |ns | wa|eme|nin|e d|bij| gr|n m|p v|esc|t w|ont|ite|man|ema| ma|nal|g o|rin|hed|t a|t v|beg|all|ijs|wij|rwi|e h| bi|gro|p d|rmi|erm|her|oon| pe|eit|kin|t z|iet|iem|e i|gem|igi| an|d o|r e|ete|e m|js | hu|oep|g z|edi|arb|zen|tin|ron|daa|teg|g t|raf|tra|eri|soo|nsc|t b| er|lan| la|ern|ar |lit|zon|d z|ze |dez|eho|d m|tig|loo|mee|ger|ali|gev|ije|ezi|gez|nli|l v|tij|eer| ar",
      srp: " pr| i |rav|na |pra| na|ma | sv|ima|da |ja |a p|vo |je |ko |ti |avo| po|a i|ako|a s| za| u |ju |o i| im|nje|i p|va |sva|anj|vak| da|o n|nja|e s|ost| ko|a n|li |ili|ne |om | ne|i s| sl| il| dr|no |koj|u s|ava| ra|og |slo|im |enj|sti|bod|obo|lob|iti|a o|stv|i u|a d|ni |jed|u p|pri|edn| bi|i i|a k|o d|sta|ih |dru|a u| je| os| ni|nos|pro|aju|i o|ran| de| su|u i|se |van|ova|i d|cij| ob|uje|red|\u017Eav|e i|i n|voj|e p|a j|dna| se| od|ve | ka|eni|r\u017Ea|dr\u017E|a z|avn|aci|ovo|u u|m i|oja| iz|lja| nj|ija|u z|e o|rod|jen|lje|e b|raz|jan|lju|svo|za |gov|i\u010Dn| st|nov|sno|osn|du |ji |pre| tr|su |vu |odn|a b|jeg|nim|nih|tu |tit|\u0161ti|ku |nom|bit|e d|me |iko|\u010Dno|oji|lo |vno|nik|e n|\u0111en|ika|bez|ara|de |u o|vim|nak| sa|u n|riv|ave|an |olj|vol| kr|o p|sme|e k|nog| ov|e u|tva|bra|rug|reb|tre|u d|oda| mo| vr|vlj|avl|ego|jav|del|m s|kri|o k|a\u0161t|za\u0161|nju| sm|ani| li|dno|e\u0111u|aln|la |akv|oj |\u0161en|kom|stu|ugi|avi|a r|ka |rad|oju|tan|odi|vi\u010D|tav|itu|ude|bud| bu|pot|odu|\u017Eiv|ere|m n|tvo|ilo|bil|aro|ovi|por|eno|\u0161tv|nac|ove|m p|tup|pos|rem|dni|ba |nst|a t|ast|iva|e m|vre|nu |be\u0111|ist|pun|en |te |dst|rot|zak|ao |kao|i k|ju\u0107|o s|st |sam|ter|nar| me|i m|kol|e r|u\u0161t|ru\u0161|ver|kak| be|i b|kla|ada|eba|ena|ona| on|tvu|ans| do|rak|slu",
      ckb: " he| \xFB |\xEAn | bi| ma|na |in |maf| di|an |xwe| xw|ku | ku|kes| de| ji|her|kir|iya|ya |rin|iri|ji |bi |es | ne|ye |y\xEAn|e b|er |af\xEA|tin|ke | an|iy\xEA|eye|rke|erk|we | be|e h|de | we|hey|f\xEA |i b|y\xEA |ina| b\xEA| li|diy|ber|li |re |\xEE \xFB|n\xEA |\xEA d| se| ci|eke|di |w\xEE | na|\xEE y|af |ete|hem| w\xEE|sti| ki|r\xEE |k\xEE |\xEE a|yek|n d|kar| te|ne |y\xEE |i h|e k|t\xEE |t\xEA |a w|e d|\xEE b|s m|ast|n b|be |yan|ser|tew|net| tu| ew|hev|aza|ara|\xFB b|n k|adi|ev |zad| az|ras|est|an\xEA| ya|n h|n \xFB|wed| t\xEA|wek|bat|bo | bo| y\xEA|st |n n|\xEA k|dan|\xEA h|ema|\xEA b|iye|\xEE h|din|b\xFBn|r k|ek\xEE| me|par|\xFBna|ta |wle|ewl|\xEE m| ke|nav|ewe|man|\xEA t|d\xEE |\xFB m|m\xFB |em\xFB|a m|ika|e \xFB|n w|a x|\xEA m|e n| ta|ela|n j|ey\xEA|n x|civ|wey|ana| re|khe|ekh|bik|k\xEA |j\xEE |f h|er\xEE| pa|\xEEna|bin|erb|vak|iva|a s| ni|cih|v\xEA |e j|ari| p\xEA|\xEE d|n\xEAn|ike|e t|a k|\xEA x| ye|n a|ey\xEE|n e|ama|b\xEA |ar |ewa|at\xEA|bes|rbe|av |ibe|ist|m\xEE |tem|awa|are|h\xEE |geh|nge|ing|nek|n\xFBn|an\xFB|qan| qa|v\xEE |rti|uke|tuk| \u015Fe|eza| da|u d|\xFB a|f \xFB|edi| ra|tu |tiy|t\xEAn| mi|xeb| ge|h\xEEn| h\xEE|et\xEA|\xEE j|st\xEE|mal|bib|ra |i d|e m|mam|i a|nik|i m|\xEE k| wi|\xFBn | ko|a \u015F|\xEA j|riy|lat|wel|e e|ine|ane|\xFB h|\xEEn |a d|siy|end|aye| za|ija|a n|\xEE n|ek |tek|yet|mbe|emb|\xFB d|rov|iro|mir|eba| xe|m\xEAn| \xEAn| hu|n\xEEn|an\xEE|t \xFB|ten|n m|dem|\xEA \xFB|en\xEA|te |art|i r| j\xEE|u j|ek\xEA|dew",
      yor: " n\xED|ti |\u1ECD\u0301 |n\xED | l\xE1| \u1EB9\u0300|\xE0n |\u1EB9\u0301 |kan|t\xED | t\xED|an |\u1EB9\u0300 |t\u1ECD\u0301|\u1ECD\u0300 | \u1EB9n|\u1ECDn |w\u1ECDn|\xED \u1EB9|b\xED |\xE1ti|l\xE1t|\u0300t\u1ECD|\u1EB9\u0300t| gb| \xE0t| \xE0w|n l|\xE0ti| a |l\u1EB9\u0300|\u1EB9n\xEC| \xF3 |k\u1ECD\u0300| l\xF3|\xEC k|s\xED |\u1ECD\u0300k| k\u1ECD|ra |ni |\xE0b\xED|t\xE0b| t\xE0|n\xEC | s\xED|\u0300ka|\u1ECD\u0300\u1ECD|n \u1EB9|\xE0w\u1ECD|n t|\xF3 n|\u0300\u1ECD\u0300|\xEDl\u1EB9|or\xED|l\xF3 | w\u1ECD|t\xF3 |d\xE8 |\xECy\xE0|\xFAn | t\xF3| or|\xED \xEC|\xE8d\xE8|k\xF2 |\u2010\xE8d|\u0300\u2010\xE8|\u1EB9\u0300\u2010|r\xEDl|\xED \xF3|r\u1EB9\u0300|\xED \xE0| s\xEC|y\xE0n|gbo|\u1E63e | k\xF2|\xED a| r\u1EB9| j\u1EB9|s\xEC | b\xE1|r\xE0n| \u1E63e|w\u1ECD\u0301|n\xECy|f\xFAn| f\xFA|n \xE0|ba |n n|gb\xE0|gb\u1ECD|j\u1EB9\u0301|un |\xEC\xED | k\xED|gba|\xE8n\xEC| \xE8n|b\xE1 |\u0301 l|a k| ka|d\u1ECD\u0300|k\xED | \xF2m|in | fi|b\xF2 |fi |b\u1EB9\u0301|\u1ECDd\u1ECD|b\u1ECDd|\u0301 s|hun|n\xFA |n\xEDn|w\xE0 |ira|nir|\xF2m\xEC|\xECgb| \xECg|\u0301 t|\u1EB9ni|\xEDn\xFA|i l|\xECni|m\xECn|b\xE0 |\xE1\xE0 |i \xEC|ohu| oh|\xED i|ara| ti|bo |\xF2 l| p\xE9|r\xFA |\xEDr\xE0| \u1ECD\u0300|\xED \xF2|ogb|k\u1ECD\u0301|p\u1ECD\u0300|\xF3 b|\xE0 t|i n|l\u1ECD\u0301|\u1EB9\u0301n| \xECb|y\xEC\xED|gb\xE9|g\u1EB9\u0301|bog|\xF3\xF2 |y\xF3\xF2| y\xF3|n k|p\xE9 |d\xE1 |\u0301w\u1ECD|\u1ECD\u0301w|\xE0 l|\xED k| w\xE0|n o|j\u1ECD | ir|\u1ECD\u0300r|\xFA \xEC|\u0301 \xE0|\xF3 s|i t|\u1E63\u1EB9\u0301|\u0300k\u1ECD|\xED t|y\xE9 |l\xE8 | l\xE8|fin|\xE0b\xF2| l\u1ECD|\xE0 n|\xF9j\u1ECD|w\xF9j|ir\xFA|\xF3 j| ar|\xED w|a w| \xECm|\xFA \xE0|\u0300 t|\xF2fi| \xF2f| \xE0\xE0|f\u1EB9\u0301|\xE0w\xF9|\u0301ni|w\xF9 |\xEC\xEDr|m\xEC\xED| m\xEC|l\xE1\xEC| y\xEC|\xED g|\u1ECD\u0301n|n s|i \u1EB9|\u1EB9\u0300k|\xE0gb|\xEDgb|n\xEDg|a n| k\xFA|l\xE1\xE0|\xED o|n\xE1\xE0| n\xE1|k\u1EB9\u0301|\xEDpa|n\xEDp|\xECn | \xECk|b\xE9 |i g|\u1ECDm\u1ECD| \u1ECDm|i \xE0|i\u1E63\u1EB9|\u0300 \xE0|\xECm\u1ECD|n a|n f|j\u1EB9 |y\xED |\u0301 \u1ECD|\xF3 d|\u0301 \xF2| d\xE1| m\xFA|\xE0\xE0b|\xE1b\u1EB9|l\xE1b|\xECb\xE1|\xF2 g|j\xFA |i o|l\xFA | \xE8t|\u0300 \u1EB9|t\u1ECD\u0300|de |\u0300 n|i \xF2| \xECy|k\xE0n|\u0301n | b\xED| i\u1E63|m\u1ECD\u0300|e \u1EB9|\u0300 l| f\xE0|\xE8y\xED| \xE8y| \xECd|m\u1ECD\u0301|d\xE9 |\u0300 k|\u0301 p|\xF2 t|m\xFA | f\u1EB9| \xECj|r\xED |\xECk\u1EB9|n\xECk|\xECn\xED|n \xEC|n \xE8|s\xECn|\xE8 \u1EB9| i |r\u1ECD\u0300| \xE0n|\u0301 b|\xF9n |\u0301gb|\u1ECD\u0301g|d\u1ECD\u0301| d\u1ECD|\xED n|rin|\u0300 j",
      uzn: "ish|an |lar|ga |ir | bi|ar | va|da |iga| hu|va |bir|sh |uqu|quq|huq| ha|shi| bo|r b|gan|a e|ida| ta|ini|lis|adi|ng |dir|lik|iy |ili|o\u02BBl|har|ari| o\u02BB|uqi|ins|lan|hi |ing|dan|nin|kin| yo|son|nso| in| mu|on |qig| ma|ega|r i|bo\u02BB| eg|o\u02BBz|ni |gad|ash|i b|ki |oki|ila|yok|a b|n b|osh|ala|at |in |r h|erk| er|lga| qa|rki|h h| sh|i h|ara|n m| ba|nis|ik |igi|lig|bos|ri |qil|a t|bil|las|eti| et|n o|ani|nli|kla|i v|a q|a h|a o|yat| qo|im |a s|i m|iya|atl|oli|osi|siy|qla|cha|til| ol|ati|a y|mas|qar|inl|lat| qi|ta\u02BC|ham|gi |ib |\u02BBli|mla|h v|\u02BBz |hun|n e|mum| da| bu| to|un |mki|umk|sha|tla|ris|iro|ha |rch|bar|iri|oya|ali| be|i o|asi|aro| ke|i t|rla| te|arc|hda|shu|tis|n h|tga| sa| xa|rak|lin|ada|ola|imo|hqa|shq|li | tu|aml|lla|sid| as|nid|a i| ki|ch |n t|nda|k b|era|siz|or |hla|a m|r v|eng|ten|mat|mda|amd|lim|miy|y t|ayo|i a|ino|ilg|tni| is|ana|as |ema| em|ech|a a|tar|kat|aka|ak |rat| de|aza|ill| si| so|g\u02BBi|uql|n q|oda|\u02BCli|a\u02BCl|nik| ni|tda|uch|gin|a u|him|uni|sit|ay |qon| ja|atn|kim|h k|hec| he|\u02BBzi|lak|ker|ikl| ch|liy|lli|chi|ur |zar|shl|rig|irl|dam|koh|iko|a d|am |n v|rti|tib|yot|tal|chu| uc|sla|rin|sos|aso| un|na | ka|muh|dig|asl|lma|ra |bu |ush|xal|\u02BBlg|i k|ekl|r d|qat|aga|i q|oiy|mil| mi|qa |i s|jin",
      zlm: "an |ang| ke|ng | se| da|ada|ara|dan| pe|ran| be|ak |ber|hak|ata|ala|a s|ah |nya| me|da |per|n s|ya | di|kan|lah|n k|aan|gan|dal|pad|kep|a p|n d|erh|eba|nga|yan|rha| ya|nda|ora|tia|asa| ha|ama|epa| or|iap|ap |a b| at| ma|eti|ra |tau|n a|set|au | ba|pa | ad|n p|tan|p o|eng|a d|men|apa|h b|h d|dak|man|a a|ter| te|k k| sa|n b|ana|g a|end|leh|ole|a k|am |n y|aka|eh |lam|bas|beb|n m| un|pen|sa |keb|sam|n t| ti|ela|san|car|uan|ma |di |han|ega|ban|eri|at |sia|a m|ika|kes|ian|gar|seb|ta |mas|und|neg|nan|ngs|i d|erl|na |epe|emb|bar| la|atu|kla|pem|mem|emu|eca|sec|ngg|nny|any|bol|al |aha|gsa|ebe|ind|akl|n h|erk|ung|ena| bo|a t| ap|ers| de|in |tu |pun|as |agi|ann|g b|bag| ne|ain|hen| he|era|rat|sem| su|adi|lan|g s|dia|mat|ses|iad| ta|iha|g t|tin|k m|k h|i k|gi |i s|ing|uka|enu|den|lai|k d|ert|ti |rka|aja|rga|lua|ker|mel|dun|ndu|lin|rli|nak|ntu|esi|aya|un |uat|jua| in|rma|erm|ai |emp|kem|ri |dil|ua |uk |h m|l d|g m|mba|kat|ese|tik|ni |ini| an|mpu|ka |dar|mar|rja|erj|arg|u k|sua| ol|esa|dap|ar |g u|si |ent|g d| pu|awa|iri|dir|sal|gam|mbe|n i|har|a h|raa|ema|tar|i a|saa|ira|ari|pel|jar|laj|uju|tuj|rak|ura|uar|elu|t d|unt|il |wen|asi|gga|ipa|ksa|tuk|ula|sek|sas|ibu|rta|sep|rsa|nta|ati|ila|mua|yar",
      ibo: "a n|e n|ke | na| \u1ECD |na | b\u1EE5|\u1ECD b|nwe|nye|ere|re | n |ya |la | nk|ye | nw| ma|e \u1ECD| ya| ik|a o|a \u1ECD|ma |\u1EE5la|b\u1EE5l|ike| on|nke|e i|a m|ony|\u1EE5 n|kik|iki|b\u1EE5 | a |ka |wer|ta |i n|do |di | nd| ga|a a|e a|a i|he |kwa| ok| ob|e o|hi |any|ga\u2010|ha |d\u1EE5 | mm|ndi|\u1ECD n|wa |r\u1EE5 |e m|che|a e|oke|wu |aka|ite|o n|a g|odo|bod|obo| d\u1ECB| ez|ara|we | ih|a\u2010e|h\u1ECB |ri |n o|zi |mma|chi|d\u1ECB |ghi|\u1EE5ta|iri|ihe| an| oh|a y|gba|\u1EE5 \u1ECD| \u1ECDz| ak| iw|nya|te |iwu| nt|ro |oro|e \u1ECB|z\u1ECD |ezi|me |e e|u n|her|ohe| si|a\u2010a|i m|ala|\u1EE5 i| ka|akw| in|gh\u1ECB|kpe|n e|p\u1EE5t| e |i i|i o|ide|inw|\u1EE5 o|h\u1EE5 |ah\u1EE5|weg|ra |o i|kpa|ad\u1EE5|mad|si |sit|a s| me|sor|i \u1ECD|gid|edo|u o|e y|n a| en|tar|ozu|toz|bi |be |\u1EE5 m|\u1EE5r\u1EE5|\u1ECDr\u1EE5| \u1ECDr|mak|uso|ama|de |\u1ECB o| \u1ECDn|\u1ECDz\u1ECD|ch\u1ECB|egh|enw|ap\u1EE5|ru | to|i a|a \u1EE5|osi|r\u1ECB |wet|hed|nch| nc| eb| al|n\u1ECDd|\u1ECDn\u1ECD|uru|sir| kw|yer|ji |eny| mk|\u1ECBr\u1ECB|eta| us|tu |\u1ECD d|u \u1ECD| o |ba | mb|\u1ECDd\u1EE5|\u1ECBch| ch|a d|pa | ag|kwe| ha|a u|e s|mkp|n u|nta|ebe|n \u1ECD|o m|kwu|nkw|nwa|obi| \u1ECBk|esi|i e|nha| nh|le |ile|nil| ni|eme| og|e k|n i|ch\u1ECD|o y|as\u1ECB|otu| ot|ram|u m|\u1ECBgh|d\u1ECBg|zu |n\u1ECD |mba| gb|e g|\u1ECB m|\u1ECDch|ich|pe |agb|i \u1ECB|uch|z\u1EE5z|uny|wun|\u1ECDr\u1ECD| nn|na\u2010| di|ge |oge|iji| ij|\u1ECDha| \u1ECDh|ikp|egi|meg|o o|\u1EE5h\u1EE5|h\u1EE5h|mah|n \u1EE5|\u1ECD g|\u1ECDta|ek\u1ECD|\u1ECB n|kw\u1EE5|agh|\u1EE5m\u1EE5|ban|kpu|okp| ah|\u1ECBkp|a k|ime| im|z\u1EE5 |\u1EE5z\u1EE5|\u1ECDz\u1EE5| \u1EE5z|lit|ali|nat",
      ceb: "sa | sa|ng |ang| ka| pa|an |ga |nga| ma|pag| ng|on |a p|od |kat|ay | an|g m|a k|ug |ana| ug|ung|ata|ngo|atu|n s|ala|san|d s|tun|ag |a m|god|g s|a a|a s|g k|g p|yon|n u|ong|tag|usa|pan|ing|una|mat|g u|mga| mg|y k| us|ali|syo| o |aga|tan|iya|kin|dun|nay|man|nan|a i| na|ina|nsa|isa|bis|a b|adu| ad|n n| bi|asy|asa|lay|awa|lan|non|a n|nas|o s|al |agp|lin|nal|wal| wa|ili|was|gaw|han| iy| ki|nah|ban|nag|yan|ahi|n k|gan| gi|him| di|a u| ba| un|ini|ama|ya |kas|asu|n a|g a|gka|agk|kan|ags|agt|l n|a g|kag| ta|imo|uns|sam| su|g n|n o|gal|kal|og |taw|aho|uka|gpa|ipo|ika|o p|a t| og| si|gsa|g t|aba|ano|gla|y s|o a|aki|hat|kau|sud|gpi|a w|g i|aha|ot |ran|i s|n m|bal|lip|gon|ud | ga|li |uba|ig |ara|g d|na |kab|aka|gba|ngl|ayo| la| hu|a h|ati|d a|d n| pu| in|uga|ok |ihi|d u|ma |may|awo|agb|ami|say|apa|pod|uha|t n|agh|buh|ins|ad | ub| bu|at |iin|a d|ip |uta|sal|hon|wo |ho |tra|lak|iko|as |aod|bah|mo |aug|ona|dil|gik|sos|lih|pin| pi|k s|nin|oon|abu|la |rab|hun| ti|mah|tar|t s|ngb|uma|hin|bat|lao|mak|it | at|s s|sno|asn|ni |aan|ahu| hi|agi|n p|inu|ulo|y p| ni|iha|mag|o n|duk|edu| ed|a e|til|ura|tin|kip|agl|gay|g h|g b|ato|ghi|nab|kon|in |ter|o u|o o|yal|sya|osy| so|tik| re| tr|hig|a o|ha |but|pak|aya",
      tgl: "ng |ang| pa|an |sa | ka| sa|at | ma| ng|apa|ala|ata|g p|pan|pag|ay | an| na|ara| at|tan|a p|pat|n a| ba|ga |awa|rap|kar|g k|aya|lan|g m|n n|g b|nga|mga| mg|a k|na |ama|n s|a a|gan|yan|gka| ta|may|tao|agk|asa|man|aka|ao |y m|ana|g a|nan|aha|kan|y k|baw|kal|a m|g n|ing|wat| y |t t|pam|a n|o y|ban| la|ali|san|wal|mag| o |g i|aga|lay|any|g s|in |nya|yon|kas|a s|isa|una|ong|aan|kat|t p| wa|ina|tay|ya |on |o m|ila|ag |nta|t n|aba|ili| ay|o a| ga|no |a i|gal|ant|han|t s|kap|kak|lah|ari|agt|agp|ran|g l|lin|as |lal|gaw|ans|to |ito| it|hay|wa |t m| is|pap|mam|nsa|ahi|nag|bat|lip|gta| di|gay|gpa|pin| si|ngk|ung|aki|y n|iti|tat|ano|yaa|y s|mal|hat|kai|sal|hin|uma|mak|di |agi|pun|ihi|a l|i a|ira|gga|nah|s n|ap | ha|usa|nin|o p|gin|ipu|ika|ngi|i n|lag|la |y p|ini|g t|uka|nap| tu|a g|tas|aru|ipa| ip|li |al |n o|a o|t k|alo| pi|sin|syo|asy|ita|aho|nar|par|o s|pak|t a|uha|sas|gsa|ags|kin|a h|iba|lit|ula|o n|nak|a t| bu|duk|kab|sam|g e|ain|ami|mas|lab|ani|kil|it | al|agb|buh|a b|g g|ba | ib|iyo|ri |yag|ad | da|edu| ed|anl|ma |ais|iga|mba|tun|ipi| ki|od |ayu| li|lih|sar|gi |g w|pah|wir|oob|loo|agg|nli|bay|map|git|mil|ok |hon|ngg|sah|iya|pas|g h|agl|tar|ngu|amb|uku|ayo|s a|p n|n m|rus|i m|l a|abu| aa",
      hun: "en | sz| va| a |\xE9s |min|ek | \xE9s| mi|jog| jo|an |ind|nek|sze|s\xE1g|nde|a v|den|oga|sza|val|ga |m\xE9l|ala|em\xE9|gy |n a|van|zem|ele| me|egy|\xE9ly| eg|zab|t\xE1s| az|n s|bad|aba|ni |az |gye| el|ak | se|meg|sen|\xE9ny|s\xE9g|k j|yne|lyn| ne|ben|lam|tt |t a|et |agy|oz |hoz|vag|zet| te|n m|ez |nak|int|re |et\xE9|tet|mel|tel|s a|em |ely|let|hez| al|s s| ki|ete|at\xE1|z a| le|yen|es |ra |t\xE9s|ell|nt |sem|t s|len|nem|a s|ese|nki|enk|a m|\xE1s\xE1|i m|ban|kin|k m|szt| \xE1l|ame|k\xF6z|k a|ds\xE1|ads|l\xF3 | k\xF6|\xE1s |ly |on |\xE9be|tat|a t|n v|\xE1ll|m\xE9n| v\xE9|nye|k\xFCl|l\u0151 |a n| cs|i \xE9|ok |\xE9sz|\xE9rt|lla|lap|\xE1go|gok|nyi|tek| ke|nd |\xE9te|ami|z\xE9s|yes|szo|t m|a a|het|fel|lat|lem|lle|el |z e|s e|k \xE9|mbe|emb|el\xE9|ot |lis|vet|kor|\xE1g |olg| am|sz\xE1|ehe|leh|ogo|ott|\xFCl |nte|\xE9le|i v|ogy|hog| ho|kel|n k|tes|nl\u0151|enl|ss\xE1|\xE1za|h\xE1z|\xE9g |vel|\xE1ba|lek|\xE9ge| ha|a h|r\xE9s| fe|\xE1ny|del|el\u0151|\xE1t |al\xE1|art|tar|zto|z\xE1s|t\u0151 |yil|koz|tko|al\xF3|s k|i e|\xE1rs|t\xE1r|mze|emz| ny|m\xE1s|ett|ny |fej|ass|zas| h\xE1|d a|t \xE9|is |\xE9s\xE9|ez\xE9|t\xE9b| mu|\xE1so|s\xEDt|lye|elm|\xE9de|v\xE9d|ine|t k|os |it |izt|biz| bi|y a|m l|tot|a j|atk|n\xE9l|t n|ti | m\xE1|ai |l\xE1s|eve|nev|zte| b\xE1|sel|ll |al |ere|n e|unk|mun|t e| ak|ife|kif|ako|s \xE9| \xE9r|\xE1na| es|s t|got|s\xFCl| be|v\xE1l|csa|se |\xE9se|ad |ges|tos|ja | gy|asz|ten|lm\xE9| t\xE1|eze|\xE1rm|b\xE1r|ess|l s|\xFCle",
      azj: " v\u0259|v\u0259 |\u0259r |ir | h\u0259| bi| h\xFC| ol|\xFCqu|h\xFCq|quq|na |in |lar|h\u0259r|d\u0259 | \u015F\u0259|bir|l\u0259r|lik|mal|r b|lma|r h| t\u0259|\u0259xs|\u015F\u0259x|\u0259n |dir|uqu|una|an |ali|a m| ma|ikd|ini|r \u015F|d\u0259n|ar |il\u0259|qun|aq |as\u0131| ya|m\u0259k|y\u0259t| m\u0259| m\xFC|kdi|\u0259si|\u0259k |ilm|nin|nd\u0259|olm|\u0259ti|\u0259 y|sin|xs |nda|lm\u0259|yy\u0259|i v| qa| az|olu|iyy|ya |ind|zad|qla|\xFCn |ni |l\u0259 |tin|n m|aza|ar\u0131|\u0259t |n t|maq|lun|l\u0131q|\u0259 b|un |nun|q v|n h|dan|\u0131n | et|tm\u0259|\u0259r\u0259| \xF6z|da |\u0259 v| on|\u0259 a|\u0131na|\u0131n\u0131|bil|a b|s\u0131 |il |\u0259mi|ara|si | di|\u0259 m|\u0259ri|rl\u0259| va|\u0259 h|etm|\u0131\u011F\u0131|ama|dl\u0131|adl|rin|b\u0259r|r\u0131n|n i|m\xFCd|n\u0131n| he|mas|ik |n a|dil|al\u0131|irl|\u0259l\u0259|\xFCda|s\u0131n|\u0131nd|xsi|li |\u0259 d|n\u0259 | b\u0259|\u0259ya| in|\u0259 i|l\u0259t| s\u0259|n\u0131 | i\u015F|an\u0131|e\xE7 |he\xE7|q h|eyn|\u0259 e|d\u0131r| da|asi|r\u0131 |i\u015F |ifa|l\u0131\u011F|i s|fi\u0259|afi|daf| ed|m\u0259z|u v|kil| ha|ola|n v|\u0259ni|\u0131r |uq |unm| bu| as|sia|osi|sos|ili|\u0131d\u0131|l\u0131d|nma|\u0131q |in\u0259|\u0259ra|sil|xil|axi|dax|ad\u0259|man|a h|\u0259 o|onu|a q|\u0259z | ki|se\xE7| se|\u0131 h|min|lan|\u0259d\u0259|bu |raq|l\u0131 |\u0131l\u0131|al |\u0259 q|r v|nla|hsi|\u0259hs|t\u0259h|\xF6z |ist| is|m\u0259s| \u0259s|ina|\u0259 t|\u0259tl|a v|i\u0259 |n b|t\u0259r| ta| c\u0259|edi|ala|kim|qu |i t|ulm|m\u0259h|n o|aya|\u0131 o|ial| so|ill|siy| d\u0259|var|ins|mi |\u011F\u0131 |nik|r i|aql|k h|t\u0259m|tam|\xE7\xFCn|\xFC\xE7\xFC| \xFC\xE7|\u011F\u0131n|sas|\u0259sa|z h|\u0259m\u0259|zam| za|sti|r\u0259f|n e|r a|ild|h\u0259m|\u0131ql|yan|may|n \u0259|m\u0259n|mil| mi|\u0259qi|din|n d|t\xFCn| d\xF6|miy|kah|ika| ni|fad|tif|l o|s\u0259r|yni| ey|ana|l\u0259n|am |ril|ay\u0259|a\u015F\u0131",
      ces: " pr|n\xED | a | ne|pr\xE1|r\xE1v|na |ost| po|ho | sv|o n| na|vo |neb|\xE1vo|bo |ebo|nos|m\xE1 | m\xE1|a\u017Ed|ka\u017E| ka| ro|ch |d\xFD |\u017Ed\xFD|ti |ou |a s| p\u0159| za|\xE1n\xED|\xE1 p| je| v |svo|\xE9ho| st|\xFD m|sti|n\u011B | by|obo|vob|ter|pro|en\xED|bod| z\xE1| sp|\xED a|rod|kte|by |mu |u p|o p| n\xE1|v\xE1n|jak| ja|a p|o v|\xED n|ov\xE1|oli|v\xED |spo|roz| kt|mi |\xED p|ny | ma|\xEDm |i a|do | so|odn|\xE1ro|n\xE1r|li |n\xE9 |tv\xED|at |\xFDch|a z| vy|byl|vol|en |\xFDt |b\xFDt| b\xFD|t s|tn\xED|stn|o s|\xED b|to | do|sv\xE9|v\xE9 |ran|ejn|z\xE1k|eho|jeh|nes|p\u0159\xED|m\xED |\u010Din|kol|aj\xED|sou| v\u0161|\xEDch|it |n\xFDm|\xFDm |nu |hra|nou|u s|\xE9mu| k |du |\u017Een|pod| ze|kla|a v|stv|pol|dn\xED|er\xE9|m p|st\xE1|je |ci |e\u010Dn| ni|n\xE9h|a n|ak\xE9|\xE1va|maj|em |rov|\xED m|k\xE9 |ole|n\xFDc|ova| ve|ako| ta|i k|chr|och| oc|kon|i p|\xED v|sm\xED|esm|kdo|st |i n|o z|ave|odu|bez| to|sta|ech|j\xED |o d|sob|se | se|\xED s|\xFDmi|i s| i |i v| vz|n\xEDm|pra|ln\u011B|p\u0159i|t\xE1t|ste|a j|aby| ab| s |oln|a o|m n|\u010Den|slu|\u0159\xEDs| os|zem|mez| \u010Di|ln\xED|\xE1ln|oci|jin| ji|y b|\xED z|y s|va |v\u0161e|t v|ovn|chn|d\u011Bl|n\xEDc|le\u010D| pl|vat| vo|vin|rav|vou|lad|inn|\xE9 v|anu|tej|u k|stu|est| tr|ky |ikd|nik|ivo|nit|zen|u o|n\xE9m|nez|i\xE1l|\xEDho|len|ens|o\u017Ee|oko|k\xE9h|rac|ven|\xED k|e s|l\xE1n|\u011Bl\xE1|zd\u011B|vzd|t k|din|odi|t\xED | od|r\xE9 |tup|pov|pln|\u0161t\u011B|\xE1kl|nno|tak|er\xE1|\u0159ed|o a|a t|res|j\xEDc| mu|u z|rok| ob|\u010Dno|u a|y k|i j|\xE9 n|lu\u0161|\xEDsl|oso|ci\xE1|soc|n\xEDh|o j|ck\xE9",
      run: "ra |we |wa |e a| mu|a k|se | n | um| ku|ira|ash|tu |ntu|a i|mu |umu|mun|unt|ere|zwa|ege|ye |ora|teg|a n|a a|ing|ko | bi|sho|iri| ar| we|shi|aba|e n|ese|go |a m|o a|gu |uba|ngo|nga|hir| ca|ugu|obo|hob|za |ndi|ish|gih| at|ara|wes| kw|ger|ate|a b| ba| gu|e k|can|ama|ung|bor|u w|mwe|di | ab|nke|ke |kwi|ka |ank|yo |ezw|n u|na |iwe|e m|rez|ri |a g|gir| am|igi|e i|ro |a u|ngi|e b|ban| ak| in|ari|n i|hug|ihu|e u|riz|ang|nta| vy|ata| ub|and|aka|rwa| nt|kur|ta |iki|kan|iza|u b|ran|sha|o n|i n| ig|ivy| iv|ahi|bah|u n|ana| bu| as|aku|ga |uko|o u|ho | ka|ose|ubu|ako|guk|ite|o y|ba |i b|any|kir|o k|aho|iye|kub|amw|nye|aha| ng|o m|nya| it|re | im|o b|izw|kun|hin|e c|vyo|o i|vyi|ngu|uri|imi|imw|gin|ene|u m|zi |ha |kug|bur|uru|jwe| zi|u g|era|aga|ron|abi| y |e y| uk|gek|ani| gi|eye|ind|wo |u a|i a| ib|i i|ras|bat|gan|amb|n a|onk|rik|ne |ihe|agi|kor| ic|ze |tun|ibi|wub|nge|o z|tse|nka|he |rek|twa|gen|eko|mat|ber| ah|ni |ush|umw| bw|mak|bik|ury|yiw|bwo| nk|ma |no |kiz|uro|gis|aro|ika| ya|gus|y i|wir|ugi|uki| ki|a c|ryo|bir| ma| yi|iro|bwa|mur|eng|ukw|hat|tan|utu|wit|w i| mw|y a|mbe| ha|uza|ham|rah| is|irw|o v|umv|ura|eny|him|eka|bak|bun| ny|bo |yig|kuv|wab|key|eke|yer|vye|i y|ita|ya |a r| ko|kwa|o c",
      plt: "ny |na |ana| ny|a n|sy |y f|a a|aha|ra | ma|nan|n n|any|y n|a m|y m|y a| fi|an |tra|han|ara| fa| am|ka | ts| na|in |ami| mi|a t|olo|min|man|iza|lon| iz|fan| ol| ha| sy|aka|a i|reh|ay |ian|tsy|ina| ar|on |o a|etr|het|ona|y o|o h|zan|y t|a h|ala| hi|a f|y h|ehe|ira|a s|zo |y i|ndr|jo | jo|n j| an| az|ran|dia| dr|y s|fah|ena|ire|tan|dre| zo|mba| ka|m p|afa| di|n d|and|azo|zy |amp|ia |ren|iny|rah|y z|ry |ika|oan|ao |amb|lal|ho | ho|isy|ony|tsa|asa|a d|ha |fia|mis|ava|ray| pi|am |dra| to|rin| ta|ant|eo |zay|rai|tsi|itr|sa | fo| ra|van|ova|nen|azy| vo|mpi|ari|o f|tok|a k| ir|kan|oto|mah|ly |sia| la|n i|voa|haf|a r|ito|y k|oka|y r|y l|ano|ita|ene|its|ial|zon|aza|ain| re| as|fot|aro|fit|nat|nin|aly|har| ko|ham| no|fa |ary|atr|ila|ata|iha|nam|kon|oko| sa|elo|nja|anj|ive|isa|oa |dy |y d|o m|nto|ank|o n|otr|pan|fir|air|sir|ty |a v|sam|o s|tov|mit|rak|reo|o t|pia|tao| ao|no |y v|iar|a e|a z|hit|hoa| it|to |za |ton|eha|end|vy |idi|tin|ati|adi|lna|aln|rov|ban| za|nga|hah|oni|osi|sos|vah|ino|ity| at|hia|pir|ifa|omb|ame|era|vel|kar|va |tso|jak|fid|ifi|ais|o i|idy|la |ama|ba | pa|tot|ani|rar|mpa|haz|kam| eo| il|iva|aho|nao|n k|ato|lah|ovy| te|dro|lan|ela| mo| si|fin|miv|san|koa| he|aso| mb|sak|kav",
      qug: "ta | ka|ka |na |una|cha|ash|ari|a k|ana|pak|ish|ach|hka|shk|mi |kta|hay|man| ch|apa|ak |rin|ata|kun|har|akt|ita| ha|ami|lla| pa|ama|pas|shp| ma|tak|ay\xF1|y\xF1i|in |sh |ina|uku|nka|chi|aka|a c|yta|kuy|all|tap|a h|kan| tu|\xF1it|tuk| ru|run|chu|an |pay|ayt|ris| ki|aku|hpa|ank|a p|kam| sh|nam|a s|uy |i k|ayp|nak|pi |nta|a m| li|ay |lia|hin|kaw|nap|ant|tam|a t|iri|nat| wa|y r|kay|aws| ya|n t|ypa|wsa|pa |lak|shi|a a|lli|iku|hu |n k|iak|yay|kis| al|shu|a w|ipa| sa| il|api|kas|yku|yac|kat|a r|huk|i c|wan|hik|a i|ill|ush| ti|ayk|hpi| ku|kac|say|hun|uya|ila|ika|yuy|pir|ich|mac|ima|a y|yll|ayl|i p|kin|a l| wi|kus| yu|lan|tan|llu|kpi| ta| pi|aya|la |yan|awa| ni|kak|lat|rik|war|ull|kll|li |ink|nch|un |akp|n s|may| ay|uch|i s|nac|sha|iki|kik|h m|ukt|pip|tin|n p|iya|nal|aki| ri|ura|tik|mak|ypi|i m|i w|n m|his|k i|riy|iwa|y h| hu|han|akl|k t|mas|pik|kap| \xF1a|u t|nmi|nis|k a|i y|k l|kar| im|i i|wil|yma|aym|ksi|iks|uma| su|h k|has| ak|unk|huc|kir|anc|k m|pal|k k|ik |i\xF1i| i\xF1|ma |n y|mun| mu|mam|tac|a n|i t|k r|sam|ian|asi|k h|was|ywa|iyt|llp|san|sum|ray|si |pan|nki|tar| ii|u k|\xF1ik|uk |i\xF1a|kuk|wpa|awp|akk|a u|wat|uri| mi|yar|uyk|ayw|h c|ha |tay|rmi|arm|uta|las|yka|llk|kul|wi\xF1|ati|ska| ll|kit|n h|uti|kic|mat",
      mad: "an |eng|ng |ban| sa| ka|dha|ren| se| ba|ak | ha|adh|hak| dh|ang|se | pa|aba|a s|na |aga|ha | or|n s|ore|ara| ag|gad|are|ana|n o|ngg|ale|gan|a k|ala|dhu|tab|sar|ota|asa|eba| ot| ke|sab|ba |wi |uwi|abb|i h|huw|aan|n k|a b|bba| ta| ma|pan|hal|bas|ako|dhi|ra |kab|em |beb|ka |lak|gi |lem|g a|eka|n b|ama|nga|san|at |ong|ran|nge|a o|ggu|sa |a d|ane|n p|ken|par|aja|man|gar|ata|nek|apa| na|agi|abe| ga|e e|sal|a a|tan|g s|al |kal|gen|ta |i s|aka|e a|a p|a e| la| pe|nan| an|era|e d| e | be|n a| al|ena|uy |guy|n n|ate| bi|mas|e k|kat|uan|oan|kon|k k|a m|i d|g e|n t|g k|ada|koa|lan|ela| da|bad|ma |ne |as |lab|ega| mo|ar |car|one|i p|bi |kaa|bat|ri |on |pon| so|e b|le |ah |abi|ase|adi|epa| ep|k h|and|pam|te |ok |ste|aon|om |oko|aha|ari|ona|asi|ter| di|di |pad|e s|sad|yar|neg|ton|set|rga|ost|mos|gap|nda|a l|har|i k|ina| a | ng|kom|isa|si |a t|a h| kl|jan|daj|iga|hig|idh|hid|ndh|n m|ngs|tto|ett|arg|la |k b|ler|k d|nna| to|nao|n d|mat| ca|tad|bis|aya|epo|aen| po|bin|nya|kas|k s|n h|sya|nta|gsa|en |ant|n g|kar|i e|das|e t|e p|iba| pr|g p| ho| el|i a|hi |os |sao|uwa|tes| ja|nag|nas|lae|sia|t s|k o|nto|int|yat|arn|m p|duw|adu|eta| ko|i b|ni |g n|kla|rak|ame|mpo|jua|sok|aso|ggi|eja|pel|jam|ele| et|dil",
      nya: "ali|ndi|a m|a k| nd|wa |na | al|yen| ku|nth|ra |di |se |nse| mu|a n|thu|hu |nga| wa|la |mun|u a|unt|iye| ka|ce |ace| lo|a l|ang|e a| la| pa|liy|a u|ens| ma|idw|ons|dwa|e m|i n|ala|kha|lo |li |ira|era|ene|ga |ana|za |o m| mo|yo |o w| ci|we |dzi|ko |o l|and|dan|hal|zik|chi|oyo|pa |ner|ulu|ena|moy| um|a p| da|ape|kap|ka |iko| an|pen|a c|to |ito|hit|nch| nc|iri|lir|wac|umo|e k|lu |a a|aye| dz|kuk|a z|dwe|tha|mal| za|ing|ufu|mu |ro |ful| uf|o c|i d|lin|e l|zo |edw| zo|o a|mwa|u w|iro|o n|lan|amu|ere| mw|nzi|dza|alo|ri | li|fun|lid|gan|so | ca|kul|ofu|nso|o z|ulo|unz|o k|mul|lam|i c|san|a b|kwa| na|a d| a |una|u k|i l|nkh|ant|aku|ca |cit|oli|ipo|dip|ama|lac|wir|han|yan|osa|uli|tsa|i m|pon|kup|u d|ti |gwi|ukh|ung|hun|lon|ank|nda|iki|ina| ko|ao |diz|phu|ati|oma|i a|tsi|pat|iya|siy|kut| ya|zid|eze|ma |i k|mer|ome|mol|u n|u o|aph|ogw|izo|mba|sid|ku |sam|awi|adz| ad|izi|ula|say|e n|khu| kh|rez|vom|bvo|okh|lok|win|akh|o o| am| on|zir|map| zi|eza|ja |go |ngo|ika|its|ats|osi|gwe| co|isa|ya |haw|ani|o p|zi |ndu|kho|ezo|kir|uni|i u| ay|lal|gal|sa |bom| bo|ola|amb|wak|ha |ba |nja|anj|ban| ba|iza| bu|udz|ngw|bun|oye|o d|nal|kus|i p|i o|i y|wi | nt|e p| si|aka|ne |men|jir|nji|sed|ets|end|eka|uma|du ",
      zyb: "bou|iz |aeu|enz|eng|uz | bo|ih |oux|nz | di|ing|z g|ux |uq |dih|ngh| ca|ng |gen|ung|z c| mi|miz|ij |cae|z d| gi| de| ge|euq|you| ci|ngz|ouj|aen|uj | yi|ien|gya| gu|ngj|mbo| mb|zli|dae|gij|cin|ang|j d|nae| se| ba|z y|euz| cu|de |x m|oz |j g|ouz|x b|li |z b|h g| da| yo|nj |xna|oxn|rox| ro|h c|nzl|vei|yau|wz |z m|ix | si|i c|iq |gh |j b| cw|nda|yin| hi| nd|dan|vun|inh| ga|can|ei |cun|yie|q g|hoz|bau| li| gy|wyo|cwy|z h|gue|gz |gun|faz|unz|yen|uh |den|ciz| go|q c|gj | bi|ej |aej| fa|hin|zci| wn|j n|goz|gai|au |z s|q d| vu|h m|gva|hu |auj|ouq|az |h d|ya |uek|ci |nh |u d|ou |sou|jso|gjs|din|awz|enj| do|h s|eve|sev|z r|nq |sin|nhy|g g|g b|liz|kgy|ekg|sen|eix|wng|lij|ngq|bin|i d|ghc| ha|bae|hix|h y|j c|ghg|i b|ouh|en |n d|h f|j s|z v|j y|law|hci|anh|inz|q y|nei|anj|ozc|ez |enh|q s|aiq|uen|zsi|zda|hye|ujc|e c|siz|eiz|anz|g y|i g|q n|bie| ne| ae|giz|u c|hgy|g d|gda|ngd|cou| la|z l|auy|ai |in |iuz|zdi|jhu|ujh|yuz| du|j m| fu|cuz|eiq|g c|gzd| co|uyu|coz|zbi|biu| dw|i s|i n|aw |dun|yun|izy|daw| he|nho| ho|enq|x l|cie|q b|cij|uzl|x d|iuj|awj| ya|eij|dei|nde|sae|izc|wnq|wnh|sei|h b|aih|gzs|bwn|a d|u g|ngg|jca|e b|ran| ra|hcu| me|iet|van| bu|guh|hen|si |wnj| ve|u b|azl|inj|gak|gan|ozg|siu|yaw|i m",
      kin: "ra | ku|se | mu|a k|ntu|tu |nga|umu|ye | um|unt|mun|e n| gu|we |ira|a n| n |wa |ere|mu |ko |gom|a b|e a| ab|li |e k|mba|a a|e b|aba|ga |e u|ba |omb|o k| ba|a u|ose|u b|o a| cy|ash|eng| ag|kwi| bu|za |gih|ren|ndi| ub|ang|yo |aka|gu |igi| ib|a g|a m| nt|uli|o b|ama|ihu|e i|nta| ak|ago|ro |ora| ka|ugu|hug|di |iye|ban| am|cya|ku |ta | bw|and|sha|re | ig|gan|ubu|na | kw|obo| by| bi|a i|yan|ka |sho|kub|era|ese| we|kan|aga|hob|bor|ana|byo|ura|uru|ibi|rwa|wes|u w|no |uko|i m|mo |u a|ure|ili|uba|o n|uha|uga|n a| im|ish|bwa|bwo|wiy|ali|ber|ze |ne |ush|are|o i|u m|ger|bur|ran| ki| no|ane|bye| y |ege|teg|guh| uk|n i|rag|i a|ya |u g|e m|anz|bo |abo|gar|wo |y i|ho |age|ind|o m|eke|a s|ara|zir|ite|kug|kim|aci| as|u n|ani|kir|mbe| gi|yos|kur|ugo|gir|e c|iza|aho|i b|tur|ata|o u| se|u u|zo |i i|aha|nge|mwe|iro|akw|any|eza|uki|imi|o y|ate|u k|iki|atu|bat| in|go |tan|n u|bos| bo| na|hak|iby| at|ihe|ung|ha |bul|kar|eye|eko|gek|nya|o g|shy|e y|awe|ngo|bit|mul|nzi|rer|bag|ge |imw|bah|cir|gac|bak|je |gez|imu|eze|tse|ets|mat| ru|irw|he | ni| ur| yi|ako|ngi| ng|i n|rez|ubi|gus|fit|afi|ugi|uka|amb|o c|utu|ufa|ruk|mug|bas|bis|uku|hin|e g|ige|amo|ing| af|yem|ni | ry|a r|gaz|te |erw|bwe|ubw|hwa|iko| al|ant|zi ",
      zul: "nge|oku| ng|a n|lo |ung|nga|la |le | no|elo|lun| um|e n|wa |we |gel|e u|ele|nel|thi|ke |nom|ezi|ma |ntu|oma|hi |o n|ngo|tu |nke|onk|o l|uth|ni |a u|lek|unt| wo|o e| lo|mun|umu|pha| ku|ang|ho |kwe|ulu| ne|won|une|lul|elu| un|a i|gok|kul|ath|hla|lok|khe|eni|tho|ela|zwe|akh|kel|a k|enz|ana|ban|aka|u u|ing|ule|elw|kho|uku|ala|lwa|gen| uk|wen|ama|na |e k|ko |gan|a e|he |zin|enk|o y| ez|kat| kw|lan|eth|het|o o| ok|okw|i n|nzi|aba|e a|hak|lel|lwe|eko|ane|ka |so |yo |ayo|o a|uhl|nku|nye| na|thu|mph|do |ben|ise|kut|ike|kun| is| im|hol|obu|fan|i k|e w|nhl|nok|ini|and|kuh|ukh|kuk| ak|e i|isi|aph|zi |ile|eki|ekh| ba|eka|the|a a| le| ye|kwa|e e|fut| fu|za |mal| ab|ebe|isa| em|o w|kub|mth|i w|ndl|emp|any|olo|ga | ko|nen|nis|alu|ith|eli|ndo|seb|nda| ya|i i|eke|vik|ake|uba|abe|ezw|yok|ba |ale|zo |olu|ume|ye |esi|kil|khu|yen|emi|nez|hlo|a l|ase|ula|kek|a o|iph|o u|no |azw|kan|mel|uny|ne |ufa|ahl|lin|hul|ant|und|sa |enh|kus|kuv|lak| in|o i|din|kom|amb|zis|ind|ola|uph|wez|eng|yez|phe|phi|mba|nya|han|kuf|nem|isw|ani|iyo| iy|fun| yo|uvi|i a|ene|izi| el|cal|i e|eze|ano|nay|hwe|kup|lal|uyo|ubu|kol|oko|ulo| la|e l|tha|nan|mfu|hon|nza|hin| ey|omp|da |bo |ilu|wak|lon|iso|kug|nka|ink|i l|sek|eku| ek|thw|gez",
      swe: "ar |er |tt |ch |och| oc|ing|\xE4tt|ill|r\xE4t|en | ti|til|f\xF6r|ll | r\xE4|nde| f\xF6|var|et |and| en|ell| ha|om |het|lle|lig|de |nin| de|ng | in| fr|as |ler| el|gen|nva|und|att|env|r h| i |r r|ska|fri| so|har|der| at|\xF6r |ter|all|t t| ut|den|ka |lla|som|av |sam|ghe|ga | sk| vi| av|ete|la |ens|t a| si|r s|iga|igh|tig| va|ig |a s| st|ion|ra |tti|a o| \xE4r|ten|ns |t e|na | be|han| un| an| sa|a f| la| gr| m\xE5|nge|n s|vis|lan|m\xE5 |ati|nat| \xE5t|an |nna| li| al|t f|ans|nsk|sni|gru|\xE4ll|tio|ad | me|isk|kli|s f|t i|st\xE4|t s|ri |med|sta|h r|lik|da |dig|ta |r o|run|on | re|lag|tta|\xE4r |kap|a i|a r|\xE4nd|erv|n e|kte|n f|rvi|nom|itt|id | mo|sky|r e|ver|\xE4ns|vil|gt |igt| na|tan|uta|dra|t o|ro |isn| fa|kal|ihe|rih|erk|r u|e s|per|l v|vid|one|rel|ber|ran|ot |mot|ndl|d f|ed |ika|m\xE4n|l s|bet|t b|dd |ydd|kyd|n o|s s|str|n m|tet|sin|r f| om|rna|int|r i|end|nad|l a|ap |ers|nda|t v|ent|rbe|arb| h\xE4|ets|h\xE4l|amh|ckl|gar|nga|r m|je |rje|arj|n i|s e|lin|r t|i s|r\xE4n| pe|ilk|t l|ern|p\xE5 | p\xE5|t\xE4l|d e|dom|ege|g e|tni|r a|lit|ras| s\xE5|lln|kil|ski|enn|i o|a d|er\xE4|n a|ara| ge|\xE4ro|a m| ar|t d|ilj|els|yck| ve|g o|fr\xE5|nas|tra|ess|del|m s|liv|l l|in |v s|g a|ast|e e|val|son|rso|e t|age|nd | eg|ial|cia|oci|soc|upp|igi|eli|g s|rkl|gad|ndr|nte|\xF6ra",
      lin: "na | na| ya|ya |a m| mo|to | ko|li |a b| li|o n| bo|i n|a y|a n|ki |a l|kok|la | ma|zal|i y|oki| pe|ngo|ali|pe |so |nso|oto|ons| ba|ala|mot|a k|eng|nyo|eko|o e|nge|yon| ny|kol|lik|iko|a e|o y|ang|ye | ye|oko|ma |o a|go | ek|ko |e m|aza|te |olo|sal|ama|si | az|mak|e b|lo | te|ta |isa|ako|amb|sen|ong|e n|ela|oyo|i k|ani| es|o m|ni |osa| to|ban|bat|a t|mba|ing|yo | oy|eli|a p|mbo|o p|mi | mi| nd|ba |i m|bok|i p|isi|mok|lis|nga|ge |nde|koz|bo |gel|ato|o t|mos|aka|oba|ese|lam|kop| ez|lon|den|omb|o b|ota|sa |ga |e a|e y|eza|kos|lin|esa|e e|kob|e k|sam|kot|kan|bot|ika|ngi|kam|ka | po|gom|oli|ope|yan|elo| lo|ata| el|bon|oka|po |bik|ate| bi|a s|i t|i b|omi|pes|wa | se|oza|lok|bom|oke|som|zwa|mis|i e|bek|iki| at|ola|ti |ozw|lib|o l|osu|oso|e t|nda|ase|ele|kel|omo|bos|su |usu|sus|bal|i l|ami|o o|bak| nz|pon|tel|mob|mu | ep|nza|asi|mbi|ati|kat|le |gi |ana|oti|ndi|tan|a o|wan|obe|kum|nya|mab|bis|nis|opo|tal|mat| ka|bol|and|aye|baz|u y|eta| ta|ne |ene|emb|sem|e l|gis|ben| ak| en|mal|obo|gob|ike|se |ibo|\u2019te| \u2019t|umb| so|mik|oku|be |mbe|bi |i a|eni|i o| mb|tey|san| et|abo|ebe|geb|eba|yeb|bu | as|ote|sik|ema|eya|ibe|mib|ai |pai|mwa|kes|da |may|boz|amu|a a|kom|mel|ona|ebi|ia |ina|tin| ti|bwa|sol|son",
      som: " ka|ka |ay |uu |an |yo |oo |aan|aha| wa|da | qo| in| u |sha| xa|a i|ada|iyo| iy|ma |ama| ah| la|qof|aa |hay|ga |a a|a w|ah | dh|a s| da|in |xaq| oo|a d|aad|yah|eey| le|isa|lee|u l|q u|aq | si|taa|eya|ast|la |of |iya|sa |y i|u x|sta|kas|xuu|uxu|wux| wu|iis|nuu|inu|ro | am| ma|a q|wax|dha|ala|kal|nay|f k|a k|le |ku | ku| sh|o i|a l|ta |maa|a u|dii|loo| lo|o a|ale|ara|ana|iga|o d| uu|ha |lo |o m|o x|doo|aro|kar|yaa|gu |si |ima|na | xo| fa|adk|do |a x|ad |aas| qa| so|a o| ba|lag| aa| he|dka|adi|soo|o k|aqa| is|ash|u d|had| ga|eed|san|u k|a m|iin|i k| ca|u s|n l|yad|rka|axa|elo|hel|aga|hii|o h|o q| ha|id |n k| mi|baa| xu|har|xor|aar|ax |mad|add|nta|mid|aal|waa|haa|ina|qaa|daa|agu|ark|o w|nka|u h|dad|ihi| bu| ho|naa|n a|ays|haq|a h|o l| gu|o s|aya|saa|lka| ee| sa|dda|ab |nim|quu|gga|ank|kii|rci|arc|n s|a g| ji|gel| ge|eli|ysa|a f|siy|int|laa|uuq|uqu|xuq| mu|i a|uur|mar|ra |iri|o u| ci|riy|ya |ado|alk|dal|ee |al |rri|ayn|asa| di|ooc|aam|ofk|oon|to |ayo|dar| xi|dhi|jee|a c| ay|yih|a j|ban|caa|lad|sho|d k|ida|uqd|agg|sag|ras|bar|ar | ko| ra|o f|gaa|gal|fal|u a| de| ya|o c|ii |xay|eel|aab|sig|aba|orr|hoo|u q|y d|ed |ho |sad|qda|h q|fka|n i|xag|n x|qay|lsh|uls|bul|u w|jin| do|raa| ug|ido|ood",
      hms: "ang|gd |ngd|ib | na|nan|ex | ji|eb |id |d n|b n|ud | li|nl |ad | le|jid|leb|l l| ga|ot | me|x n|anl|aot|mex|d g|b l|d d|ob |gs |ngs|jan| ne|ul | ni|nja| nj|lib|ong|nd | zh|jex| je|b j| sh|ngb| gh|gb | gu|gao|l n|han| ad|gan| da|t n| wu|il |x g|nb |b m| nh|she|is |l j|d l|nha|l g|d j|b g|el |end|wud|nex|gho|d s|d z|oul|hob|ub |nis| ch| ya|it |b y|eib| gi|s g|lie| yo| zi|oud|s j|d b|nx | de|es |d y| hu|uel|gue|ies|aob|you| ba|d m|chu|gia|dao|b d|s n|zib| go|zha|eit|hei|al |hud| do|nt |ol | fa|t g|hen|ut |gx |ngx|ab |fal|x j|b z|ian|d h|don|b w|t j|iad|nen| xi|gou|d c|b h|hao|x z|nib|anx|ant|gua| mi|s z|dan|ox |inl|hib|lil|uan|and| xa|b x| se|x m|uib|hui|d x|anb|enl| we|od |enb| du|at |ix |s m|bao| ho|hub| ng|zhi|jil|l s|yad|t m|t l|yan| ze| ju|heb|had|os |aos|t h|l d|nga| he|b a|xan|b s|sen|xin|dud|jul|d a|lou| lo|dei|d w| bi|b c| di|zhe|gt |ngt|x l|bad|x b| ja|hon|zho|blo| bl|d k| ma|deb|l z|wei| yi| qi|b b|x d|d p|eud| ge|x a|can| ca|t w|lol| si|hol|s w|aod|pao| pa|ren| re|x s|eut|pud| pu|aox|mis|gl |ngl|x w|zei|gon|enx|gha|s a|b f|l y|oub|eab|hea| to|did| ko|unb|ghu|t p|x c|geu|t s|x x|jao|ed |t c|l m|l h|jib|ax |l c|d f|nia| pi|eul|d r| no|min|l t|heu|ux |tou|ns |s y|iel|s l|hun",
      hnj: "it | zh| ni|ab |at |ang| sh|nit| do|uat|os |ax |ox |ol |nx |ob | nd|t d|zhi|nf |x n|if |uax| mu|d n|tab| ta| cu|mua|cua|as |ad |ef |uf |id |dos|gd |ngd|hit|ib |us |enx|f n|she|s d|t l|nb |ux |x z|ed |inf|b n|l n|t n|aob|b z| lo|ong|ix |dol| go|zhe|f g| ho| yi|t z|d z|b d| le|euf|d s|ut |yao| yo| zi|gb |ngb|ndo|enb|len| dr|zha|uab|dro|hox| ge|nen| ne|han| ja|das|x d|x c|x j|f z|shi|f h|il | da|oux|nda|s n|nd |s z|b g| ny|heu| de|gf |ngf| du|od |gox| na|uad| gu|inx|b c| ya|uef| xa| ji|ous| ua| hu|xan|hen|zhu|nil|jai|rou|t g|f d| la|enf|ged|ik | bu|nya|you|f y|lob|af |bua|uk |is |yin|out|of |l m|ud |hua| qi|ot |t s| ba|ait| kh|s s|nad| di|aib|x l|lol| id|dou|ex |aod|bao| re| ga|d d|b y|las|hed|b h|b s|f b|t y|jua| ju| dl|x s|hue|b l| xi|zif|dus|b b|x g|hif|x y|hai| nz|sha| li|x t| be|d j|und|hun|ren|d y|hef|xin| ib|b t|l d|aos|s l| ha|gai|nzh|gx |ngx| ao|s b|s x|el |gt |ngt|hik|aid|s t|x m|f l|f t| pi|aof|t r|eb | gh|s y|d l|gua| bi| za| fu|t h| zu|hou|deu|lb | lb|d g| mo|b k| bo|iao|ros|gon|eut|x h|al |uaf|hab|t t|k n|f x|hix|pin|yua| no|t b|ak | zo|s m| nb| we|d b|gha|f s|mol|euk|dax|l b|nof| ko|lou|guk|end|uas|t k|dis|dan|yol|uan|d t|x b|lan|t m| ch|jix|x x| hl|aox|zis|x i|et | ro",
      ilo: "ti |iti|an |nga|ga | ng| it| pa|en | ma| ka| a | ke| ti|ana|pan|ken|ang|a n|agi|a k|n a|gan|a m|a a|lin|ali|aya|man|int|teg|n t|i p|nte| na|awa|a p|na |kal|ng |dag|git|ega|sa |da |add|way|n i|n n|no |ysa|al |dda|n k|ada|aba|nag|nna|ngg|eys| me|a i|i a|mey|ann|pag|wen|i k|gal|gga| tu|enn| da| sa|nno| we|ung| ad|tun|mai| ba|l m| ag|ya |i s|i n|yan|nan|ata|nak| si|aka|kad|aan|kas|asa|wan|ami|aki|ay |li |i m|apa|yaw|a t|mak| an|i t|g k|a s|ina|eng|ala|ika|ama|ong|ara|ili|dad| aw|gpa|nai|et |yon|ani|aik|on |at |oma|sin|bal|ipa|n d|uma|g i|ket|ag |in |aen|n p|ram|sab|aga|nom|ino|lya|ily|syo|i b| ki|nia|agp|gim|kab|asi|kin|iam|ags|bab|oy |toy|n m|agt| ta|bag|sia|g a|gil|mil| um|o p|ngi|n w|i i|pad|pap|daa|iwa|naa|eg |ias|ed |nat|bae|o k|saa|san|pam|gsa|ta |kit|ma |dum|yto|tan|i e|t n|uka|t k|apu|lan|sta|sal| li|a b|ari|g n|den|mid|ad |o i|y a|ida|ar |aar|y n|dey| de| wa|a d|ak |bia|ao |tao|min|asy|mon|imo| gi|maa|sap|abi|i u|aib|kni|i l|gin|ged|o a| ar|kap|pul|eyt|abs|ibi| am|akn|i g|kip|isu|g t|bas|nay|ing|i d|kar|ban|iba|nib|t i|as |d n|y i|ura|a w|nal|aad|i w|lak|adu|kai|bsa|duk|edu| ed|may|agb|agk|tra|gge|sol|aso|agr|ngs|ian|ila|dde|edd|tal|aip|kua|umi|pay|sas|ita|pak|g d|ulo|inn|aw ",
      uig: "ish| he|ini|gha|in |ili| bo|sh |bol| we|ing|nin|we |shq|quq|oqu|hoq| ho|ush|ng |qa |ni |qil|hqa|en |lis|n b|dem|shi| ad|lik|ade|hem| qi|nda|ki |em |e a|iy |din|qan|igh|uq |ge |et |han|and| bi|ige|her|tin|olu|aq |ash|idi|luq|daq|erq|ha | te|let| ya|iti|liq|kin|me |mme|emm|rqa|lus|iki| qa|de | ba|aki|yak|uql|a h|men|rim|an | er|qlu| be|shk|du |d\xF6l| d\xF6|hri|ile|lgh|esh|q h|rki|erk|i w|uqi| me|\xF6le|ime|ehr|nli|iq |ara|ar |lar|a b| \xF6z|da |ik |i b|beh|hi |len|h h|ila|ayd|may|ke | ar|che|shl|nis|ydu|lin| k\xE9|bil| mu|e q| ig|er |olm|\xE9li|inl|tni|yet|lma|q a|ek |asi|hli|e b| as| sh|u h|hke|ali|ari|siy|shu|a i|e h| qo|rli|bir|emd| tu|ler|iye| is|ett|qi |i k|mde|he |bar|\xF6zi|etl|lid|tur|e t| al|nun|kil|tis|mni|qig|uru| je|ima|bas| ji|rek|\xE9re|k\xE9r|r b|raw|awa| ma|a a|anu|\xE9ti|ida|emn| bu|iqi|i y|jin| sa|e e| xi|mus|k h|iri|tes|ayi|nay|ina|dil|adi|i h|zin| \xE9l|she|i q|n h|hek|n w|min|n q|tti|ti | ch|ip |iya|\xE9ri|tid|his|alg|pal|apa|les|sas|asa|e m|p q|uch|niy|qti|siz|isi|n a|il |rni|uni|chi|tim| ij|ris|i s| xa|ir |ghu|met|n i|m i| ta|atn| pa|tle|lim|gen| de|ich|kap| ka|g h|q b|i a|\xFCn |h\xFCn|ch\xFC|\xFCch|q q|und|sht|sit|rus|lig| to| iy|ale|y m|e d|aiy|mai|jti|ijt|eli|i d|i t|si |rqi|e i|arl|hu |ami|rin| h\xF6|etn",
      hat: " li|ou |an |wa |li |on | po|pou|yon|te | yo|oun| mo|un |mou|en |ak | na|n p|nan| dw|dwa| ki| f\xE8|tou| pa| to| ak|ki |syo|se |yo |i p| ko|gen| ge|\xE8t | sa| la| se|out|n d|ut |pa |u l|n s|ite|n n| ch|n k| de|t p|n l|cha|kon|e l|e d| re|asy|nn |f\xE8 |a a|i s|ans|f\xE8t| a |a p|sa |swa|ni | ka|\xF2t |n y|t m|n a|i k|hak|pi |n m|ote|men| me| so|i l|a l|lit|epi| pe| si|enn|e p|e s| ep|nm |i t|yen|k m|t l|eyi| an| ni|e n| l\xF2|a f| ap|yi |pey|i a|son|l\xF2t|ns |san|e k|n e|ay |n t|man|ali| os|a s|e a| pr|al |e m|osw|n f|enm|sou| ma|ap |e y| ba|ran|a k| tr|lwa|n g|aso|lib|i d| p\xE8|ant|i g|la | ta|sos|i m|i n|ka |a c|a y|nal|anm| di|pwo| pw|ye |e t|je |k l|de | vi|ksy|t k|nen|ons|a t|alw|lal|ete| le|ta |res|ava|he |che|ati| fa|ken|oke| ok|tan|osy| pi|bli|le |tis|a g|kal|nas|a d|sye|l\xE8 |lek|a m|a n|u y|eks|re |\xE8 l|o p|tra|i f|onn|aye|way| en|ik |ze |kla|kou| sw|a r| za|ide|di |a b|vay|rav|p\xE8s|wot|ont|kot|k k|jan|o t|ona|ras|isy|sya|van|ib |\xE8 a| t\xE8|k a|p\xF2t| ne|pre|esp|\xF2l |\xE8so|ach|i o|it |ist|e r|is |s k|n o|\xE8te|u f|nsa|t a|dev|las|u t|nte| l\xE8|i r|l k| k\xF2|sip|tek|ri |pas|pra|k p|nt | ja| te|ond|yal|pan|fas|iti|fan|si | ra|u d|ife|dek|b\xE8t|ib\xE8|u k|ret|k\xF2l|ek\xF2|lon|wen|s a|vle| vl|ent| aj|ibl|ini|np\xF2|enp| as|\xE8 s",
      hil: "nga|ang| ka|ng | sa|ga |an |sa | ng| pa| ma|ag |on |pag| an|a p|san|n s|ata|a k|ung|kag|n n|a m|kat| ta|gan|ags|ay |tar|gsa|tag|g p|run|aru|a s|ala|g k|kon|g m|man|a t|ing|agp|n k| si|may|y k|g t|mga| mg|g s|a i|a n|mag|ya |gpa|sin|n a|uko|yon|la |hil| uk|od |gin|ina|ahi|g i|kas|syo|ili|g a|iya| gi|pan|ban|way|ana|tan| pu| in|lwa|ilw|in |asa|lin|n p|gka|aya|nan|han| iy|at |g n|wal|aha|apa|o m|al |a g|lan|aba|gba| wa|kah| na|o s|a a|kab|agk|pat|ong|no |ano|ngs|pun|yan|aki|isa|o n|ali|ini|agb|nag|aga|a d|a h|ngk|i s|asy|abu|dap| hi| da|aho|agt|n m|di |n u|sal|til|sod|gso|ni |uga|mat|bah|bat|asu|a b|ato|ati| la|iba|sil|ngo|uha| su|nah|ulo|na | ba|pas| pr|ida| di|ngb|aka| ko|gay|lal|paa|o a|d s|ton|agh|pro|y n|uan|bis|ot |asi|i m|ka | is|ksy|atu|him|ila|y s|tao|gi |agi|aag|aan|o k|non|k s|ula|sul|tek|sug|gua| bi|gon|yo |n d| ib|uli| du|duk|ho |iko|hin| ed|a e|bot|ind|do |ron|aro|i a|abi|lab|eks|ote|rot|ugu|to |mak|as |s n|n b| o |n o|ad |m s|gal|una| hu| tu|but|kal|ika|a l|yag|hay|pah|nta|int|ama|pam|hat| al|uka|edu|ko |g e|ghi|lik|ami|ndi|sta|ok |tok|tra|os |abo|om |alo|dal|kin|n t|hi |a w|i n|da |kda|akd|tak|lig|inu|t n|d k|ao |kaa|par|aay|rab|awa|kau|mo |gla|gko|d a|ado|g o|lo |lon",
      sna: "wa |a k|ana|na | mu|ro | ku|a m| zv|nhu|mun|hu |dze|oku|a n|aka|che|zer|unh| ch|chi|ero|kan|ka |odz|kod| ne|zvi|rwa| pa| an|se |ra |e a|nek|va |ane|o y| we|kut| ka|ke |ake|iri|dzi|eko| yo|cha|ese|ach|ika| no|zva|ngu|ano|yok|ri |wes|u w|ang|yik|nyi|eku|ung|idz|ech|uva| dz|ipi|a z|irw|van| va|nge|iro|wan|o i|ani|nga|ich|wo |eng|ti |udz|o n|tan|ira|a y|a c|dza|sun|vak|nok| ya|a p|kwa|i p|e k|ita|rir|ko |ga |hip|unu|hec|edz| ma|ara|bat|guk|nun|sha|zwa|dzw|hen|o m|zve|o c|mo |kuv|a d|eny|ema|uta|uti| rw|ta |ino|twa|o a|pac|dzo|yak|wak| kw|i z|kus|zir|kur|rus|ere|nem|e z|emo|tem|gar| ha| ak|o k|rwo|uko|mwe|ata|e n|we |o r|and|za |zo |a i|yo |da |pan|erw|ezv|pi |asi|rud|usu|hak|uka|han| ic|guv|pir|a a|ari|isi|emu|aan|uch|re |hur|kwe|ura| in|uru|oru|kub|fan|anh|ush|hek| ye|ute|ran| ac| iy|ong|mut|i m|a r|ina|sin|pas|ait|nor|uye| uy|a u|sa |asa|i i|era|nen|omu|uit|kui|u a| ny|kud|kuc|e m|aru|uwa|uba|nir|a s|cho|enz|ndi|aga|kun|i a|sva|ge |vin|get|hap|o z| wa|sar|o p|no |muk|itw|uri|mat|ama| ko|kuw|usa|ofa|nof|kuz|vo |a v|uma|mag|wen|e p|yor|pam|emh|swa| hu|ne |ye |ete|vic|uzv|ava|ose|si |ayo|mir|apa|ton|vem|nez|do |i h|adz|azv|zan|nza|zid|mum|imb|bas|mba|mus|iki|e c|osv|hos|mho|vis|ngo|ite",
      xho: "lo |nge|lun|oku|elo|ye |ung|nye| ng|nga|e n|la |tu |ntu| ku|a n|o l|ele|e u|lek|yo |gel|o n|nel|ho | na|ke |wa |a k| um| lo|ko |ulu|o e| ne|nke|onk|elu|any|mnt|we |ama|lul| kw|umn| wo|kub|ngo|une| no|eko|won|enz|ule| un|a u|ela|le |kun|kan|ba |a i| ok|ang|lwa|eyo|oka|alu|uba|lok|lel|ukh|kuk|aku|ala|aph|akh|kwe|ley|eth|the|u u|khe|het|nok|pha|ezi|ile|uny|use|ath|eki|khu|zwe|kul|kho|e k|wen|gok|na |o y|sel|a e| ez| uk|o o|ane|ana|hul|e a|tho| in|enk|o k|nam|o w|uku|kil|he | yo|unt|ent|ni |obu|nku|esi|ing|o z|ayo|ya |hi |lwe|phi|ban|fun|ben|elw|o a|uhl|ndl|nzi|gan|eli|olu|eni|hus|kwa|aba|ha |und|gen|uth|lal|ntl|e o|ink|hla|ise|iph|seb|ebe|isw|thi| zo|ume|kut|a a|isa|kel|izw|e i|za | ba| ab|sha|tya|een|yal|mth|i k|uph|sa | lw|alo|lan|dle|tha|lin|zi |ase|nay|i n|pho| ak|man|mal|wak|zo |bel| im|mfu|int|swa|ngu|do |nee|ene|ulo|o u|a o|tla|ezo|ga |wan|han|sen|kuh|kus|ety| es| ya| le|eng| el|kup|azi|ka |e e|olo|ubu|bal|and| se|o s|fan|okw|ant|o i|tsh|li |lis|sis|ale| en|phu| ol|ham|iso|lak|bo |mny|okh|nte|mel|ziz|sek| am|zin| ul| ub|nen|e w|ong|zel|emf|nan|ndo|yok|ube|nya|yen|len|gal|ili|e l|be |abe|ali| ph|a y|wam|aka|amn|men|lum|rhu|urh|eka|dla|u k|oli|iba| ko|thw|imf| wa|nda| is|nza| be",
      min: "an |ak |ang| ma| ka| da|yo |ara|nyo| sa| ha|ran|ng |nan|hak| pa| ba|dan| di|ata| pu|ura|pun|kan| na|man|ok |nda|ala|o h|uak|asa|k m|ntu|k u| ti|uny|ah | ur|n k| un|tua|n d|n b|and|n s|unt|ek |g p|iok|tio|jo |n p|tau| at|dak| ta|aka|pan|au |ind|ama|pek|dap|aan|ape|nga|k d|n m|uan|tan|lia|sua|gan|amo|bas|kat|gar|o p| in|n n| jo|mo |at |mar|ado|o t|ari|di |k s|n a|am |lam| su|o d|iah|par|ban|tu |sam|adi|o s|ika|lak|ian|ko |dal|um |san| la|ai |ega|neg| ne|k k|uka|al |asi|ant|aga|bat|dek|o m|mas|eba|beb|asu|mal|n u|tar|aku|ri |kal|ana|in |atu|ti |ato|sar|ngg|lan|alu|rad|aro|ali|un |ami|o u|k h|ro |car|o b|amp|mam| bu|dok|dia|aha|n t|to |rat|ka |ila|a d|sia|anu|yar|sya|i d|sur|sas|kum|as |pam|aca|k t|ati|kar|eka|dil|any|lo |i m|h d|iba|k b|u d|kab|u p|o a|o k|kam|lai|aba|ard|dua|ndu|lin|k p|ajo|raj|han|bai|ra |n i|uku|huk|itu|dar|aya|uli|mpa|amb|i k|ain|rde|abe|did|ili| li|sac|sti| mu|bul|n h|i p|nny|k a| ko|ras|bad|k n|ndi|rga|arg|iko|tam|a n|kaw|i j|ga | an|nta|k l|apa|ida|jam|alo|sal|l d|u k| hu|das|tik|mat|dik|ia |idi|uju|lua|pul|kuk| pi|ann|il |iny|i t|bak|ust|mus|uah|pri|aja| ja|n j|h p|sio|ar |ada|oka|ngk|sa |gam|min|ik |mbe| ad|si |m d|kaa|sat|i n|i a|usi|rak|asy|aki|rik|kny|ulo",
      afr: "ie |die|en | di| en|an |ing|ng |van| re| va|reg|te |e r|et |e v|een|e e| ge| be| te|eg |n d|le |ens|n h| he|het|ver|t d|lke|nie| in|ke |lik|of | el|e o|nde| ve|al | to|elk| op| ni| of|g t|der|id |and|eid|aan|kee|ge |ot |tot|de |hei|e b| vr| we|om | sa| aa|ord|er |e w|ige|g v|n v|ers|in |sal|nd |erk|e s| vo|dig|vry|wor|n s|asi|eni| wa| om| de|bes|rd | wo|\u2019n | \u2019n| on|ond|at |ska|ede|esk|sy |nig|e t|oor|ns |men|g o|aak|eli|kap| me|lle|vol|n a|edi|din|g e|uit|op |e g|gte|rdi|aar|ik |erd|el |ak |sta| st|ap |egt|se | sy|ele|gin|sie|min|ker|ere|is | so|yhe|ryh|es |ike|wat|e n|e d|del|wer|end|ale|n o|ur |eur|s o|per| hu|re |gel|ten|deu|e k| as|it |ema|gem|nas|ger|d s| is|rin|ewe|eme|ite|ter|as |n e|soo|oed|s v|ees|wet|red|e h|d v| al|ies| ma|nsk|ig |e i|ier|hie| hi|r d|t e|man|kin|nal|ona|d o|ske|ien|e a|eri|wee|ir |vir| vi| na|n w|iem|t v|s e|r e|ion|sio|nte|tel|eke| da|taa| gr|oon|rso| pe|tee|ort|n b|d e|lyk|ely|ese|e m|sia|ont|ans| ty|rde|ind|d t|nge|d d|g s|voe|n t|ndi|rmi|erm| sl|ren|maa|d w|lan|l g|hed|t a|n g|hul|n r|waa|t g|all|pvo|opv|ang|dee|nli|osi|sos|mee|wel|k o|kan| ka|raa|spr|nsp|nse|den|aat|gen|t s|g a|ste|est|str|lin|l v|sek|d n|ern|arb|daa|s d|ods|r m|t i|yke|met|rs |n i",
      lua: "wa |ne | mu| ne|a m|a k| ku|di | di| bu|e b|bwa|tu |udi| bw|a d|a b|ntu|e m|nga|i b|i n|shi|la |mun|yi | ba|adi|unt|u b| dy|nde|ung|ons|ya |mu |na |ga |end|nsu|a n|buk|e k| ma|any|u m|nyi|esh|de |lu |idi|ika|u n|su |ku |yon|i m| ka| mw| yo|u y|we | ud|wen|ken|dya|ji | kw|u d|mwa| an| bi|dik|sha|tun| ci|ha |hi |kes|oke|kok|bwe|kwa|dit|nji|kan|ka |mwe|ibw|yen|itu|ba |u u|ena|ang|le |ban|ala|enj|a a|e n|uko|uke|ans|u a|ana|bul| wa|nda|did|umw|ish| a |ila|bad|e d|mbu|kal|du |ndu|hin|kum|aka|nso|nan|a c|ele|ela|kwi|bu |nsh|ind|i k|sun|i d|i a|ula|ye | na|dye|u w|mba|alu|mak|ant| pa|lon| by|kus| mi|amb|gan|dil|dim|mud| cy| ns|kub|lel|u k|da |bud|enz|ond|ako|ile|e c|umb|diy|mus|abu|ja |dis|aku|bid|mal|umu|kad|dib|imu|cya|kuk|kud|so | me|ilu|ulu|ngu|ta |bak|akw|u c|iba|ush| ke|wik|eng|uba|wil|elu|und|kwe| mo|a p|omb|nza|iye|pa |mum|man|bya|kup|wu |muk|aci|a u|som|atu|ukw|upe|uka|e a|bis|kak|ngi|nge|pet|ilo|ama|iko|iku|mik|utu|ong|ulo|iki|and| um|mat|kul|uja|isu|gil|ale|nka|ata| mb|san|dif|ifu|ole|lwi|ulw|za |cik|lam|bel|awu| ya|wab|lum|ubi|sam|isa|aa | aa|fun|kon|bum| lu|eta|mbe|wel|kol| be|ane|ame| ad| tu|men|upa|tup|uku|omu|mom| my|mul|ing|ma |o u|pik|kab|cil|aji|me |uyi|kuy|o b|bon| bo",
      fin: "en |ise|on |ais|ja |ta |an | ja|sta|n o|ist|keu|ike|oik|ell|lla|een| oi|n t| on| va|n j|aan|kai|la | ta|lis| jo|sen|lli|a o|uks|sel|tai|a j| ka|us |in |n k|a t|eus|sa |ksi|n s|\xE4\xE4n|\xE4n |kse|nen|jok|see|oka|ai |tta|ssa|taa|mis|aa |nsa|ses|apa|t\xE4 | se|ans|den|est|tt\xE4|all|kan|t\xE4\xE4| yh|lai|sia|ill|\xE4 o|a v|itt|ett|vap|aik|ia |h\xE4n| h\xE4|ast|a k| tu|n e|ust|kun|eis|ess|ti |sti|per|\xE4 j|n v|ain|n y|k\xE4 |n p|n m| t\xE4|ine|isi|\xE4ne|yks|ude|\xE4 t|a m| pe|tei|tee| mi|a s|a p|val|unn|tuk|s\xE4 |a h|sek|utt|ll\xE4|ste|yht|ava|lta|ien| sa|l\xE4 |oll| ei|ss\xE4|n a|n h|st\xE4| ke|alt|suu|isu|sal|tet|ois|tav|a a|ikk|sty|ek\xE4|a y|etu| ku|vaa| te|hte| mu|pau|stu|iin|toi| to|lle| he| ri|muk| la|n l|\xE4\xE4 | ra| ol|nno| ma|ei |uut|iit| su|oma|ami|tam|ten|att|dis|tur|aut|m\xE4\xE4|n r|\xE4m\xE4|maa|oon|jul| ju|ute|iaa|et |kki|tie|ide|\xE4 m|kaa|suo| si|saa|i s|rva|urv|v\xE4l|lin|tus|rus|eru|nna|sku|isk|lii|oli|uol|a r|sii|ite|a e|hen| ko|sil|euk| sy| ty|ty\xF6|pet|ope|ali|avi|paa|si |iss|voi|tyk|\xE4 v|oja|vat|vas| yk|joi|vai|t\xE4m|kil|enk|mai|mie|tti|iel|rii|nk\xE4|min|hmi|yhd|lit|ens| pu|uka|ita|ka |omi|aas|kka|jaa|uoj| ed|ala|oit|t\xE4y|i t|int|il\xF6|nki|eel|\xE4 s| al|eli|lee|un |k\xE4\xE4|oht|koh|va |eid|tun|ttu|le |na |ihm| ih|aal| av|aat|i v|non|tte|ytt|yyt|ulk|eud|van",
      slk: " pr| a |pr\xE1|r\xE1v| po|ho |vo |na | na|ost| ro| ne|ie |nos|ch |\xE1vo|kto|ebo|m\xE1 | m\xE1|a\u017Ed|ka\u017E| ka|bo |leb|ale| al|o n|ani|d\xFD |\u017Ed\xFD|ia |ne |om |ti |\xE9ho| v | je|ova| za|\xE1 p|\xFD m|mi |eni|to |n\xE9 | sl|tor|van|a p|sti|voj|o v| kt|nia|lob|slo| sv|mu |rov|rod|\xFDch|svo| z\xE1| by|o p| n\xE1|a\u0165 | ma|nie| sp|e s|ej |nu |je |n\xE9h|o a|\xE1va|bod|obo|a s|e a|by |a n|oci| vy|o s|odn|a z|n\xFD |en\xFD|mie|\xE1ro|roz|ovn|spo|u p|eho|nes|u a|n\xE1r|kla|a v|i a| sa|jeh|y\u0165 |by\u0165|e v|stn|va |a m|sa |n\xFDc|n\xFDm| k |ran|och|pre|a o|\xE9mu|a k|i\u0165 |aj\xFA| do| v\u0161|ov |\u010Din|hra|z\xE1k|tre| ni|s\u0165 |u s|pr\xED|stv|pod| ob| s\xFA|a r|v\u0161e|\xFDmi|oje|\xFDm |pri|kon|i p|vna|est|e b|smi|esm|os\u0165| \u010Di|or\xE9|lad| in|pol|\u017Een|bez|\xE1ci|a a|u k|maj|\u0161et| vo|e z|\u0165 s|t\xE1t|i k|pro|chr| oc|nak|bol| bo| tr|i s|iu |\u010Den|ny |du | ho|\u0165 v|j\xFA |del|ami|dov|va\u0165|ko | vz|rav|pra|lne|r\xE9 |\u0161t\xE1| ta|anu|nom|aby| ab|res|vo\u013E|ikt|n\xFA |niu|slu|kra|edz|e p|odu|\xE1ln| so|o\u017Ee| de|\xE9 v|etk|n\xED |ok | pl|k\xFDm|ako| \u0161t|vin|str|ou |\xE9 p|m p|inn|r\xEDs|kej|stu|nik|med|tvo|por| to| kr|de |sta|pov|i\xE1l|ens|ak\xE9|hoc|r\xE1c|o d|en\xE9|m a|lan|ela|zde|vzd|o\u010Dn|olo| ak|lo\u010D| st|in\xFD|\xEDm |ast|dne|ju |oju| od|an\xED|tup|i n|rej| ve|pln|adn|tak|\xFA p|j\xFAc| s |o\u013En|\u010Dno|ivo|obe|lu\u0161|sob|oso| os|jin|aji|raj|in\xE1|ade| \u017Ei|ven|vod|ci\xE1|soc|dno|bo\u017E|\xE1bo|n\xE1b|o r|k\xE9h",
      tuk: "lar| bi| we|we |da | he|ada| ha|dyr|er |an |r b|ir |ydy| \xFDa|bir|y\u0148 |yna|na |yr | ad|ary|dam|lyd|de |kly|yny| \xF6z|lan|r a|her|hak|akl|aga|kla|i\u0148 |am |ara|mag|ili|r h|ga |ala|ler|dan|en |a h|\xF6z |ar |ny\u0148|gyn|ini|ne |bil|li |len|atl|nda| ed| ga|\u2010da|ygy|a\u2010d|ine| de|uku|huk|e h|lyg|edi|a g|\xFDa\u2010|dil| bo|kuk|lma|eri|tly|ryn|asy|a d|eti|ny |ly |ni\u0148|dir| hu|\u2010de|aza|ge |\xFDan|ile|a\xFDy|e d|zat| az|hem| g\xF6|ama|lyk|\xFDet|den|nde|any|ynd|ykl|ukl|\xE4ge|m\xE4g|im | du|a w|a \xFD|gin|m\u2010d|em\u2010|in | je|n e|bol| hi| di|e a| be|p b|ra |e \xF6|mak| go|ni |mez|ilm|aly|ril|n b|sy |syn|rla|esi|ry\u0148|gal| ma|etm|nma|ede| sa|lme|i\xE7 |hi\xE7|e g|a b|lin|igi|ele|rin|iri|de\u0148| do|ak |lik|anm|dal| ka|mal|n h|kan| ba| \xFDe|i\xFDa|gat| ge|al |y b|y\xFDe|ti\u0148|let|ard|tle|n \xFD|ere|agy|ora|gor|nme|inm| gu| ki|sas|esa| es|r e|bu | bu|gar|tla|ill|\xFDle|lig|sin|\u0148 \xFD|mel|e b|end|n a|\xFDar|\u0148 h|rda|y w| et|tyn| d\xF6| i\u015F|\xE7in| ar|z h|r d|\xFDda|\u0148 g|nun|\xFCnd|yly|\u0148 w|ez |yp |kim|\xFDa\u015F|olm| \xE7\xE4|g\xF6r|dur| \xE4h|si\xFD|and|da\xFD|eli|mil|e\xFDl|be\xFD|erk| er|a\xFDa|kin|ek |ndi| yn|ola|ry |r w|lim|a\xFDl|gy\xFD|et |e m|i \xFD|agt|wag| se|dol|a \xF6|n w|i b|e\u0148 |n p|anu|z\xFCn|\xF6z\xFC|m \xF6|i g|\xE7 k|a\u015Fa|rma|ana|ldi|my |hal|\xE4hl|asi|ram|kda|\xFDyn|gda|agd|\u015Fyn|ip |lip|gel| mi|din|rle| me|at |j\xFCn|pj\xFC|\xFCpj| \xFCp|\xFDla|mgy|emg|jem|gur",
      dan: "er |og | og|til|et | ti|der|en | de|for|il | re| fo|ret|ing| ha|lig|de |nde| en|lle|hed|els|ver|ar |und|ed |har|ell|den|ge |ler|lse|and|r h|t t|se |ng |hve| el|enh| fr|at |e e|e o|ig |nhv| i |gen|ede|ska|ige| at|es |le |ghe|r r| in|e f|fri| me|nge|al |igh|nne|nin|l a| be| sk| af|r e|ion|af |re |han| st|om | so|r s|e s| an|eli|ne |r o| p\xE5|tig|esk|or |del|ati|p\xE5 |r f| er|enn| al|ens| un| he|tio|ndl|med| si|end|kal|nat|g f|ske|ns |tte|ent|ter|det|ke |lin|som|e r| ud|ett|g o|sky|e a| ve|nte|n s|r d|tti|sni|t s|lde|vil|ale|ind|ans|r a|kel| hv|dig| li|men|ren|old|hol| na| gr|ihe|rih|sam|v\xE6r|e i|e m|s f|age| vi|d d|g h|str|\xE6re|te |ilk|g t|r i|nal|ona|e n|rel|run|gru|d e|nd |ers| sa|r u|ere|ger|e t|tel|bes| m\xE5|t i|per|lan|isk|dli|ors|rin|e d|kab| mo| v\xE6|all|ejd|bej|rbe|arb|gte|mme|ved|e h|m\xE5 |n m|igt|res|kke|l h|sig|ld |l e| fa| ar|n f|r k|ets|rsk|t o|t f|it |t d|t v|g i|ytt|kyt|ven|ove|g e|ste|r t|eri|tet|lke| om|\xF8re|e g|fun|orm|d a|oge|nog| no|g a|erk|kra| kr|d h|od |mod|g d|g s|ie |erv|ene|em |sta|nst| ku|isn|vis|rvi|g m|t a|ner|tes|r\xE6n|s s|n h|int| la|ikk|el | op|lit|n a|g u|av |rav|ts |dre|t m|e u|s o|ore|l f|rit|ndi|lag|l t|ffe|rli|n e| fu|yld|dan|n o|rke|ive|raf|tra|dom| tr|i s|l l",
      nob: "er |og | og|en |til| ha| ti| re|ett| de|ing|ret|il |tt |et |lle|for|ar | en|ver|ell|om | fo|ng |har|r h|het|ler|lig| so|hve|t t| el|ter|nne|som|enh|and|de |av |nhv|ska| \xE5 | i |le |r r|den|e e| fr|ig |r s|nde|els|se |e o| er|enn| me| st|lse|al |re |fri|tte| sk|han|or | be| in|ke | av| ut|ghe|r e|esk|nge|te |es | p\xE5|ete|der|nin|ten|p\xE5 |igh|ed |l \xE5|kal|ge |unn| sa|ent|e s|eli|n s|rin|ne |g f|itt|sam|lik|gen|t s|end|jon|sjo|asj| an|r o|g s|t o|men| al| si|lin|mme|med|g o|ner|dig|n m|ren|nte|ige|inn|e f| gr|e r|r f| ve|sni|sky|g e|del|ens|und|res|det|isk|gru|ihe|rih|tig|tti|kte|ans|g t|tel| li| un|lan|nas|t i|m e|r u|ske|e m|ns |ekt|str|t e|ers|per|ale|kke| he|rel|run| ar|kap|mot| mo|all|eid|bei|rbe|arb|e t| vi|bes|g r|ven|s f|eri| m\xE5|n e|e g| na|nn |e d|kra| kr|ot |ndl|ere|erd|rit|\xE6re|vis|ger|ffe|id |e a|ytt|kyt|g h| et|tes| sl|i s|m\xE5 | la|dom|l e|n o| fa|rav|r k|t f|nes|v\xE6r|ta |sta|ste|\xE5 d|ndi|g d|bar|l f|isn|rvi|g a|vil|nnl|r m|t d|jen|dli|e b|gre|e h|ikk|el |l o|nal|ona|opp|r a|on |n a|noe| no|ute|erk|v p|ts |e i|dre|g m|ie |gan|erv|org|ser|tat|ang|at |t v|s o|tli|fen|an |e n|ik |g i|\xE5 s|lov| lo|r l|t a|lt |ove|aff|rdi|m s|l l|nse|r t|n h| pe|sli| gj| ik|d d|old|hol|ial|sia|osi|sos",
      suk: "na | mu| bu|we | na|hu |a n|ya | gu|a b|nhu|wa |a g|a m|unh| ya|mun|li |ili|ali|bul|i m|ilw| ba| bo|uli|han|mu |lil| al|e n|u a|bo |la |ose|kwe|ang|ulu|lwe|kil| wi|i b| se|ga |ina|le |ge |kge|ekg|sek|bi |e b|e y|lo |and|i n|yo |ila|se |lu |a s|lin|gil|ngi|akw|aki|abi| gw|si |nsi| ns|dak| nu|ng\u2019|gan|u b|o g|ilo|nul|e g|ka |nga|ile|a w|ada|u m|gwi| ka| ad|ubi|lwa|ani|ban|o a| ly|ndi|a l| ng|jo |g\u2019w|a i|ho |ayo|ika|dik|e k| ma|anh|gul|u n|o b| ji|o n|yab|iya|wiy|lag|ula|yak|o l|ma |ing|gi |gub|biz|lan|shi|iwa|ja | li|iha|mo |o j|wen|o s|lya|a a|ola| ku|jil|win| ga| sh|agi|ha |iga|uga|a k|iti|oma| nd|uyo|iza|za |i a|a y|yos| ha| mi| lu|iko|ndu|pan|ji |nil|ala|bos|ene|a u|ele|nhy|u g|nik|o w|iki| mh|nda|uhu|duh|hay|aji|ana| ja|gwa|nay|i y|ong|aya|mil|o m|da |lug|man|e i|abo|aga|okw| ab|nek|ngh|dul|e m|aha|uma|ubu|bus|sol|wig|ki |nya|ung|iji| gi|wit|iso|som|twa|udu|imo|eki|\u2019we|hya|gut|iku|e u|uso|u l| il|but|mha|any| um|bal|ujo|kuj|aka|tum|waj| we|ko |ugu|bud|lon|a h|utu| uy| is|jiw|ale|e a|a j|sha|ita|lit|ibi|lyo|u w|g\u2019h| ij|upa|tog|ida|omb|yom|ajo|atw|mat|bok|ulo|gup|lik| ul|ize| at|uto|ze |kan|ulw|u u|sho|ish|hil|ike|kal|mah|umu|je |ule|mbi| ih|kaj| lo|ti |wik|\u2019ha|eni|yiw|umo|ito|ba ",
      als: "t\xEB | t\xEB|dhe|he | dh|\xEB d|n\xEB |et |\xEB t|imi|p\xEBr|ejt|rej|dre|e t| dr|it | e | p\xEB| n\xEB|gji|\xEB p|sht|jit| gj|jt\xEB|\xEBr |het|ith|ve | ve| li|ush| sh| ka| i |t t|a t|kus|hku|j\xEB |sh | ku|e p|ka |se | pa|me |e n|mit|s\xEB | nj|\xEB n|thk|\xEBn |\xEB k|e d|\xEB s|in |ose|lir|h k|et\xEB| os| si|ara|n e|nj\xEB|t d|tet| ba|jer|ohe|jet|\xEB m|rim| nd|\xEB b|e k|e s|eve|eti| du|nd\xEB|r\xEB |\xEB g|t\xEBn|vet|eri|ra | me| q\xEB|t n|do |es |iri|e l|duh|d\xEBr|shk|und|si | as|re |end| ng|uhe|ndi|\xEBsi|ga |nga|min|q\xEB |hte|ime|ash|mi |tje|i n|jes|ris|\xEB v|ri | ar|nje|r n| pe|\xEB i|ur |uk |nuk| nu|tar|i p|at |en |an\xEB|ta |jta|e m| pu|e v|ar |sim|is\xEB|gje|art|\xEB l| ma|\xEB r| s\xEB|ht |ish|i d|or | mb| je|lim|e a| ko|uar|\xEB e|cil|bar|mar|t\xEBs|edh|\xEBm |sh\xEB|ave|shm|nal|t a|\xEB j|ari|ht\xEB| ci|k d|im |snj|asn|kom|igj|t p|\xEBs |\xEBrk| de| k\xEB|a n|\xEB a|ir\xEB|bas|es\xEB| pr|tim|hme|ke |per|pri|vep|mun|roh|t s|oj\xEB|\xEB c|tit|lli|omb|lit|par|i s| tj|s s|ij |tij|shi| fa|le |ale| ti|roj|bro|mbr|ali|\xEB q|nim| mu| t |n k|ti |t i|ven|uri|q\xEBr|in\xEB|ik |esi| ra|at\xEB|ras|t m|\xEBri|je |h\xEB |pun|i i|e b|nd |jen|mev|a g|\xEB f|n p|ona|son|rso|ers|epr|tes|\xEBsh| \xEBs|ft\xEB|oft|ore|ror|oq\xEB|hoq|sho|\xEBta|zim|ar\xEB|kur|rat|k\xEBt|\xEBzo|i t|ill|ars|ite|ind|r d|rin| pl|ie |\xEBrf|\xEB z|a p|rte|h\xEBm|r p|tyr|bli|res|ike|te |kun|m t|lig|a d|ia ",
      sag: "t\xEE | t\xEE|na | na| ng|ngb|a n|lo | lo|nga|g\xF6 |ng\xF6|gbi|bi |n\xEE |zo |ang|la |\xEE l| wa| s\xF4|s\xF4 |gan| zo|a t|\xEEng|o n|i t|l\xEEn| al|g\xFC |ng\xFC|wal|ala|\xF6 t|al\xEE|a l| k\xFB| nd|\xEE k|\xF4 a| l\xEA|\xE2 t|\xEE n|\xEB t|\xFB\xEA |k\xFB\xEA|\xEA t| mb|\xEE m|\xE4ng|ko | te|o k|\xF6r\xF6|e n|o a|g\xEB |l\xEAg|g\xE2 |ng\xE2|\xEE b|\xEBp\xEB|p\xEBp| p\xEB|\xF4ko|a \xE2|\xEE \xE2|\xEAg\xEB|m\xFB |\xEE s|d\xF6r|\xF6d\xF6|k\xF6d|\xEF n|a k|\xEBe |p\xEBe|\xFC t| k\xF6| \xF4k|ter|a z|kua|ke |eke|yek| ay|\xEE t|\xEA n|ua |b\xEAn|o t|t\xEF |ra | am|aye|\xEE d|\xFB n|\xEA a|r\xEA |er\xEA|\xE2 n|\xEAn\xEE|mb\xEA|r\xF6 |\xE2ng|am\xFB|a y|a m|ga | du| ku|\xEE g| y\xE2|a s|ro |oro|dut| \xE2l|y\xE2 |ng\xF4|\xE4 t| n\xEE| \xE2m|ut\xEF|r\xE4 |ar\xE4|\xE2la|b\xEA |\xF6 n|l\xEF |\xF6ng|o s|a p|\xEE z|\xF6n\xEE|ten|i n|gba|ne |ene| s\xEA|ba |e t| gb|ndo|i\xE4 |di\xE4|ndi|\xF6 k|nd\xF6| g\xEF|ara|\xEFng|\xEE w|l\xEB |do |\xEF t|a w|\xFBng|war| \xE2n|a a|y\xEA | \xE2k| da|\xEE a|ban|o w|t\xEBn| t\xEB|\xE2ra|s\xE2r|n\xEB |d\xF6 |\xEE p|o \xF4|z\xF6n|nz\xF6| m\xE4|\xF4ng|se |da |nd\xE2|s\xEAn|t\xF6n| t\xF6|e a|\xEBn\xEB|\xEB s|\xFCng| nz|o p|k\xE2n| k\xE2|a g|b\xE2 | ko|o l|r\xF6s| b\xEA|\xF4i |g\xF4i|\xEEr\xEE|\xEAnd|ana|ta |\xEE f| po| s\xE2|mb\xE2|\xE2mb| s\xEF|\xEBng|mba|zar| za|ib\xEA| m\xFB|\xEBt\xEF|b\xEBt|mb\xEB|i p| as|fa |t\xE4n|e z|l\xEA |sor|mar| ma|s\xEF |i s|a b|amb|od\xEB|kod|b\xFBn|\xEB n|\xEAse|s\xEAs|\xF6s\xEA|o m|du | af|d\xEB |bor| bo|\xEA s|g\xEA |ng\xEA|\xF4 n|\xE4 s|\xE4t\xE4|b\xE4t|\xFC n|\xEB \xF4|ata|bat|\xE4l\xEB|p\xE4l|kp\xE4| kp|\xF6 w|p\xEB |r\xE4n|\xE4r\xE4|s\xE4r| s\xE4|g\xEF | \xE2z| ad|\xF6 m|g\xEE |\xEFg\xEE|b\xEEr|mb\xEE|afa|r\xEB |er\xEB|\xFBe |k\xFBe| \xE2s|\xF6n |gb\xE2|e l| mo|\xE2l\xEF|w\xE2l|\xEA w|\xE4 w|i \xF4|\xE4 a|p\xE4 |\xFC s|yam| ya|\xE2zo| \xE2b",
      nno: " de| og|og | ha|er |lle|en |ar |til| ti|il | re|ett|et |ret|om |le |har|tt | al|all|re |ing| \xE5 |ell|and| sk|ska| i |det| fr|t t|an | ei| so|enn|ne |ler| el|den|e s|ver| me|l \xE5|leg|e h| ve| p\xE5|al | fo|dom|for|p\xE5 |av |ein| sa|ten|n s|som|sam|fri|nne|r r|ei |ere|men|gje| st|de |e o| gj|je |nde|kal|dei|st |eg |tte| in|han|i s|ast|r s|ski|t o|med|rid|or |lan|ter|t e| an|ed |r f|te |t s|kje|ge | sl| av|r k|ido|e t| er|ke |jon|sjo|asj|nas|unn| ut|g f|g s|n o|g o|nga|\xE5 f|e a|der|ng |e f| gr|kil| f\xE5|r d|ske|esk| si|lik|e i|n m|ste|at |ern|ona|n e|lag|kra| kr|e n|in |t a|ren| la|nte|e d|nin|e k|nn |tan|na |seg|v p|rav|nsk|ins|me |ame|nes|e m|bei|\xE5 v|itt|eid|a s|ege|f\xE5 |e r|\xE5r |e v|lov|r a| fa|gru|sla|ld |rbe|arb|ome|kap|jen|n t|jel| mo|r l|sta|ane| tr| li| m\xE5| at|kkj|ikk| ik|kan| ka| lo| na|n a|dre|ndr|ha |g g| ar|n d|eld| se|id |ot |mot|\xE5 s|va |t i|gen|nle|t d|n i|ale|ige|nal|rel|run|ag |oko|nok| no|d a|nad|fr\xE5|l d|\xE5 a|ild|var| kv|ve |erd|e e|inn|e u|g i|r h|kte|dig|gar|lin|god| vi|str|i e|l h|nge|end|t h|r o|r g|bli| bl|int|eig|nna|on |se |uta|t f|l f|e g|nom|amf|sin|pet|k\xE5r|vil|ga |m\xE5l|ene|ent|ig |fer|are|d d|g a|rn |ova|ele|g e|ik |g t|per|ens|gre| om|rt |und| un|rna|\xF8ve|h\xF8v|l e|ial|sia",
      mos: " n | a |e\u0303n| se|a t| ne|a s|\u0303n |se\u0303| ye|e n| ta| pa|n t| t\u0269| so|t\u0269 | la|nin| ni|\xE3a |f\xE3a| f\xE3| t\xF5| bu|ng |t\xF5e| b |ye |a n|or | te|a a|la |\xF5e |tar|e\u0303 | ya|ne |pa | to|ed |ned|sor|e t|te\u0303|aan|uud|buu|g n|r n| ma|maa|n y|ud |a y|n m|ra |\xE3 n|paa|n p|ara|em |a b| wa|d f|n b|n d|\u0303ng|s\xE3 | t\u028A|eng|b\xE3 |n w|an |g\xE3 |og |me |ins| na|e b|b\u0269 | b\u0269| ka|\u0269 b|am |g a|d b|aam|ge\u0303|taa|mb |ore|\u0269 n|yel|\u028A\u028Am|\xE3mb|ab |a m|t\u028A\u028A|wa |a l| b\xE3| ba|tog|ga |m n|re |ba |ng\xE3|nd |aab|aa |yaa| s\xE3|na | t\u0169| s\xF5| da|aoo|n n| y\u0269|\xE3 y|ame| me|aal|dat|n s|b s|ing|\xE3ng|d n|\u0269 y|\xE3 t|\xE3 s| k\xE3|lg |m t|oor|r s|d s|\u0303nd|nge|el |neb|b y|nga|ar |gr |kao| b\u028A|d\xE3 |to |v\u0269\u0269| v\u0269|egd|seg|men|saa|nsa| le|a k|at |ngr|n k|w\xE3 | w\xE3|g t|oog|b\u0169m| b\u0169|a p|d\u0269 |\u028Am |ren|\u0269\u0269m|\xE3ad|\u028Amd|da |b t|\u0169mb|y\u0269 |b\xE3m|b n|d a|ya |g s|eb |l s| yi|ke\u0303| ke|r\xE3 | s\u0269|m s| ti| y\xE3| we|oab|soa| f | z\u0129|b k|m b|oga|go |gd\u0269|a z|\xF5ng|s\xF5n|aor|t\u0169 |\u0269m |b p|\xE3 p|ilg| mi|in | ko|al |ka | no|\u0269 s|p\u028Ag| p\u028A|gam|\u0303 n|lem|\u0129nd|b b|\xE3 f|le |te |iid|uii|bui|ell|wil| wi|s a|oa |r t|e y|a g|aas|e s|\u0269 t|ik |we\u0303| ra|g b|t\u0169u|e p| y\xF5|oy |noy|a r| z\xE3|aba|ull|\u0169 n|m\xE3 |k\xE3a|eem|kat|aka|wak|s n|nda|ll |gre|kog|loa|alo|lal|\xE3 k|mb\xE3|md |e\u0303e|k n|ag |r b|o t|eg | g\xE3|n g|seb|\u028Age|eb\xE3|o a|b\xE3n|sul| su|m y|bao|n z|ate|\xE3 w|kam|mik",
      cat: " de| i | a |la | la|es | se|de | pe|per|tat|i\xF3 |ent|ret|dre|at |a p| dr|a l|ona|nt |men|ci\xF3|ts |na |aci|al |en |t a|ls | el| to|et |tot|a s|el | co|s d|ers|er |a t|que| en|s i|ta |e l| pr|t d|rso| qu| o | ll|son|ion|t\xE9 | t\xE9|ns |\xE9 d|sev|ita|als|ota| in| l\u2019|est|cio| re| al| un|cia|ons|ame|del|res|ar |ual|lli|s e|va |nal|ia |con|ser|les|i a|r\xE0 | no|pro|els|eva|nac|a c|s p|i l|nci| le|ue |no | so| ca|a d|sta|r a|s l|l\u2019e|ert|s a|a i|re | d\u2019|l d|una|ues|ter|rta|e c|ats|t i|n d|s n|a u|cci|s o| pa| es| na|l p|vol|sen|ber|ibe|lib|s t|t e|ure|l i|lit|er\xE0|ant|da |ici|oci|soc|ra |tra|ens| di|gua|igu| ma|nta|ali|ene|tes| ni|a a|nte|a e|\xE9s |o s|tre|alt|r s|com|ets|i e|par|cti|ect|ten|cte|ote|us |eta|mit|ial|om |se |i d|s s|e d|i p|pre|un |ntr|r l|ecc| tr|seg|l t|ada|dic|eme|qua|ica|eli|\xF3 d|aqu| aq|\xE8nc| ig|ir |iva|ssi|lic|t t|des|o p| ac|ont|act|ing|egu|ria| te|int|ndi| fo|a m| po|lig|lle|inc|ist|nse|cla|hom|ltr|i i|cie|ess|ura|ass|a f|e t|bli|seu|tal|tec|rot|\xFA n|g\xFA |ng\xFA|nin|tac|pen|nde|t s|ic |s f|\xF3 a|ol |evo|lse|tic|dis|cap|rac|mat|iur|liu|man|ll |itj| mi|olu|e i|art|uni|rti|esp|l s|le |ble|eri|os |sos|ies| as| ob|e p|n e|s q|tri|tiu|i c| ar|ni |tur|t n|gur|vid| vi|a v|ran|\xE0ri|ind| si|\u2019es| fa",
      sot: " le|le |ng |ho | mo| e | ho|a l|e m|ya | bo|a h|lo | ya|ong|ba | ba| ka|na | ts|e t|tho|a b|mon|o y|o e|a m|elo|la |ets|olo|sa |oth|g l|oke|eng|kel|a k|ka | na| di|ang|mot|tla|a t|tsa|tok| se| ha|e b|o t| o |wa | tl|o l|e e|o b| to|pa |e k|lok|ha |aba|apa| a |e h|o n|so |tse|a e|hab|jha|tjh|tso|tsh|kap|se |ana|oko|ela|g o|a s|o m|let|loh|a d|e l|kol|set| ma|a a|bol|ohi|tsw|ele|hi |dit|eth| ke|lan| kg|o s|o h|eo |bo |g m|ke |ala|phe| me|etj|ola|o k| ph|aha| mm|ohl|ebe|lwa|a n|g k|swa|e d|bot| th|di | sa|atl|ena|hle|mol|tlo|ae |hae|abe|g y|ats|lat|i b|seb|to |otl|ane|g b|moh|mel|edi|lek|a f|the|wan|efe|nan|g t|e s|o a|han|ito|me |hlo| hl|shi|rel|ire|lao|kgo|hel|g h| en|g e|nah|ona|bet|man| fu|ell|kga|eha|a p|its|get|kge|mme|swe|si |thu|mat|uma|fum| ef|bel|len|ume|lal|hat|ban|kan|we |bat|tsi|ing|ato|e n|ao |o f|lel|hir|hla|sen| eo|she|pha|ano|eka|ile|fen|i k|tlh|lap|ots|fet|hal|din| ko|hen| fe|heo|got|hwa|elw|a y|i m|o o|bon|hol|son|dis|o p|alo| lo|boh|uto|hut|ben|nya|tha|abo|ita|aka|ama|ose|mab|iso|shw|e y|i l|het|oho|o d|tum| tu|llo|oll| wa|hil|ath|mos|oka|mmo|ikg|mo |uso|hah|emo|adi|boi|llw|dik|nts|lle|non|sel|all| yo|tle|e i|ike|rab|wen|meh|ame|lho|mee|ken| si|eny|oph|yal|pan|g s",
      bcl: "an | sa|in | na|ng |sa |na | pa|nin|ang| ni| ka| ma|pag| an|n s|ion|sin|asi| as|on |cio|n n|a m| de|n a|ban|a n|a p|kan|rec|ere|der|aro|cho|ech|aci|ga |a s|n d|o n| la|mga| mg|g s|n p|o s|man|sar| o |ho |n l|asa|n k|ay |n m|wa |gwa|igw|al | ig|mba|amb|kat|o i|sai|ong|lam|ata|ro |os |iya|a a|ara|o a|agk|apa|kas|tal|a k|yan|aiy|gka|nac|ali|may|g p|san|ina|aba|a d|lin| ba| da|ag |nka|ink|o m|yo |a i|iba|aka| in|ad |ing| ga|ent|no |ayo|nta|par| pr|ano|ini|hay|aha|iri|dap|ida|abo|han|sta|nal|kai|og |agt|at |pat| co|a g|ant|pro|g n|nte|n i|t n|ia |cia|con| si|dad|do |o k|a b|tan|ron|l n|s a|mag|ran|g m|aki|s n|men|es |g d|y n|tra| so|ona|a l|ra |min|agp|uha|n b|g o|a o|n o|a c|g k|mak|aya|hos|as |ado|o p|ter|bas|ags|i n|lan|ba |g i|bos|gab|bah|li |ico|l a|kap|cci|ecc|tec|ami|isa|imi|ton|ial| re|en |g a|tay|pin|n e|ili|rab|bal|hon|ote|rot|rim|cri|ast|gpa|y m|say|iis|sii|pan|sad|nag| se|ala|gan|bil|n c|nda|d a| di|nga|taw|gta|i a|ios| es|pak|bo |aan|res| pu|a e|sab|ey |ley| le|atu|buh|mit|om |abi|e s|kab|ika|rin|ici|gsa|ale|ica|ni |ipa|nci|ind|nan| ip|cac|waa|nwa|anw| ed|lid|nes|ura|le |ibo|uli| hu|sal| gi|awe|gaw|agi|y p|to |air| bu|rar|int|ito|ndi|kam|dir|agh|oci|soc|lig| li|aen|lar| bi",
      glg: " de|de |os |i\xF3n| a | e |to |da |en |ci\xF3|\xF3n |der|n d|ere|ito| se|a p|eit|rei|ent|as | co|ade| pe|dad|aci|per| te|do |o d|nte|e a|ten|men| to|e d|al | pr|rso|ers|s e|a t|tod|que|soa| ou|ida| da|te | in| po|s d|oa |cia|es |o a|est| \xE1 |ra |oda| do| li|a e| es|a s|ou |con|e e|res|tra| re|nci| o |s\xFAa| s\xFA|pro|a d|o e| pa|ar |e c|tos|lib|ue | qu|r\xE1 | na|ser|a a|er |\xFAa | ca|ter|ia |dos| en|er\xE1|e s|ica|a c|sta|s p|ber|nac|s n|s s| no|e o|a o| ni|ns | un|ado|e p|o \xE1|io |cci|era|nin|des|nal|is |\xF3ns|ame|nto| so|or |se |com|pre|par|no |o t|o p|ona|e n|sen|s t|por|ais|das| as|cto|\xE1 s|eme|cio|ha |nha|unh|ara|rda|erd|ant|ici|n p|n s|ibe|n e| di|cas|nta| ac|ont|n t|dic|ndi|oci|soc|ion|ing|s o|enc|tiv|so |ali| ma|o s|a u|ngu|tad|e i|ese| me|lic|seu|ect|n c|lid|vid|ria| tr|e t|eli|e l|gua|igu| ig|l e|o m|r a|re |cti|act|ntr|ecc|ual|rec|a l|ido|nde|ind|o n|a n|cal|dis|ta | os|o \xF3|r d|iva|ada|mat|ste|fun| fu|tri| \xF3 |\xE1 p|tor|nda|pen|na |on |n a|o o|ori|uer|lqu|alq|ca |rac|n o|tar|nid|bre|ibr|lo |aso|esp|a v|a i|ode|pod|und|s a|tec|ote|rot|tes|ena|ura|\xEDn |u\xEDn|gu\xED|egu|seg|ita|ome|ari|s i|ase| fa|ond|ial|tic|ixi|inc|sti|ist|cla|cie|e r|omo|s c|man|bal|spe|ati|edi|med|uni|ios|isf| sa|ias|ren| mo|lle|co |ico",
      lit: "as |ir | ir|eis|tei| te|uri|ti |s t|iek|is |os | ki|us |vie|ri |tur|ai | tu| pa|ien| vi|ali|i t|\u017Emo|s\u0119 |is\u0119| \u017Em|mog|kie|ena|ais| ne|ini|kvi|ekv| la|gus|lai|ogu|nas|\u0117s |m\u0105 | \u012F | jo| b\u016B|s \u017E|vis| ar|b\u016Bt| su|ant|mo |i\u0173 | ka|s i| pr|s s|mas|pri|isv|\u016Bti|oki|s k|s a|ar | sa|sav| ti| ap| ta|tin|kai|\u0119 \u012F|ama|i b|s v|in\u0117|isi|im\u0105|s n|val|imo|jo |aci|gal| nu|s p|rin|men|i p| ku|dar|cij|sta|kur|nim|je |li |i k|tas|ms |i i|arb|ina|sin|jos| na|mis|lyg|i v|i s|asi|tik|ijo|oti|vo |mok|tie| mo| va|t\u0173 |i\u0161k|aik|iam|tai|aut|s b|lin|kit|eik|r t| ly|ntu|jim| i\u0161|tuo|sty|\u0105 i|r p|ega|neg|ma | \u012Fs| re| be|i n|s j|is\u0117|n\u0117s|si |yb\u0117|din|\u012Fst|tat|aus|es |nti|kia|i a|m\u0173 |ara|oje|aud| ga|iai| at|tis|avo|r l|suo|isu|ek |tyb|\u0105 k|am |mos|pag|aug|aty|ie\u0161|rie|int|nt |sva| ve|gyv|ava|tar|\u0161al| da|o n|ima|kal| sk|kla|omi|ip |aip|o a|ito|r j|avi|\u0173 i|ven|yve|als|j\u0173 |kim|alt|ika|agr|nuo|sau|ymo|kio|tym|tu |\u0161ka|nam|eka|uti|lie| \u0161a|oma|nac|kin|iki|tok| \u0161i| ji|s g|s l|ksl|ink|vai|ome|pat|o l|rei|o p|o t|ios|psa|aps|io |san|ni\u0173|uo |min|nie| ni| as|v\u0119 |ver|o k|ikl|cia|oci|soc|r k|eli|yti| to|\u0173 t|irt|ki\u0173|s \u0161|pas|udo|u k| or|uom|uok|eny|eno|im\u0173|sla|i \u012F|ati|t\u0105 |a t|lst|vei|ran|\u0117ji|ary|tim|usi|a k|lti|gas|uot|tos|ist|ndi|\u0117ms|j\u0105 |o v|g\u0105 ",
      umb: "kwe| om|e o|oku| ok|a o|a k|nda| kw|ko | ly|da |wen|la |end|nu |unu|mun|omu|wa |oko|ka |o l| ko|kwa|omo|mok|iwa|le |we |o y|i o|okw|te |eka|mwe|olo| vy|a v|osi|o k|ali|ete| ey|lyo|wet|si |yok| yo|lo |vo |ang|ong|kut|sok|iso|u e|u o|a e|a l|ye |oci|gi |eye|oka|fek|ofe|nde|i\xF1g|nga|o o|ata|\xF1gi| li|eci| nd|i k|ngi|wat|kal|ilo|ovo|vyo| va|pan| oc|li |so |a y|owi|ci |kuk|e k|nge|wi\xF1| al|avo|kul|lon|ga |ing|ili|e l|ale|lom|ala|ge |ovi|ta |ngo|ati| ya|imw|go |eli|vya|a a|uli| ol|he |ahe|iha|ele|ika| wo| ku|lil|isa|a u|ti |yo |alo|kol|o v| ov|lis|i v|lya|lin|cih|uti| yi|yal|ako|ukw| lo|wav|ung|akw|ikw|yos|val|tiw|upa| ye|onj|i l|lim|and|uka| vo| el|gol|sa |su |kok|aka|e y|lyu|\xF1go| ka|yov|vik|e v|eko|yah|gis|omw| wa| la|lik|e u|ava|tav|olw|ila|e e|vak|kov|omb|aso|a c|tis| ce|tat|iyo|epa|dec|a n|va |u c|eso|ela|ama|kat| ek|kup| ha|o e|co |ekw|asu|has|yon|asi|yow| ke|i c|upi| ci|wil|cit|ole|eyo| co|liw| yu| ca|kas| ec|uta|yim|wal|yol|kiy|e w|yuk|lye| of|o w|o c|i a|ita|ola|lwi|uva|lit|iti|njo| on|apo|ipa|sil| um|lof|wam|kun|i e|anj|cel|del|han| ak|u y|a\xF1g| up|o a|tun|atu|kak|yik|yof|iki|eti|fet|o\xF1g|lo\xF1|ulo|koc|yi |wiw|kwi| ow| os|kuv|ndu| es|vos|yel|uyu|mak|san|mbo|jon|i w|ngu|oco|lok|yas|e n",
      tsn: " le|le | mo|ng |go | ts|we |gwe| go|ya |ong| ya|lo |ngw| bo| e | di|a l|tsh|sa |e t|elo|a g|tlh|tsa|e m|olo|a b|wa |na |e l|o y|o t|a t|wan| kg|eng|kgo|o n| tl|a k|mon|la | na|ets|ane|mo | o |hwa|shw|tse| ba|e e|nel|a m|ka | ga|tla|ots|o m| ka|ele|o l|ba |e d|dit|e g|got|di | a |se | se|ang|a d|otl|bot|e o|lho|o e|ga |lol|e b| nn|a n|lha|so |lel|tso|o b|seg|ose|let|ola|ego|gol|o o|g l|kan|eka|nng|e k| ma|aka|atl|mol|sen|o g|aba|ela|its|los|tho|ano|gat|oth|yo |agi|tsw|e n|e y|len| yo|hab|o k|to | th|o s| nt|lhe|ho |agw|gag|g y|kga|mel|rel|ire|tlo|o a|ana|lek|iwa|aga|bon|g m|tir|edi|\u0161ha|t\u0161h|lao|g k|i k|tle|ntl| te|dir|ao |e s|lwa|hir|shi|a e|pe |o d|any|a a|i l|a s|ale|alo|a y|g t|jwa| jw|hol|mot|gi |kwa|dik|lon|etl|tet| wa|mai|swe|set|thu|ko |non|ats| me|han|ume|ala| mm|nya|iti|he |bat|hut|nna|ira|itl|no | ne|ro |iro|nan|elw|she|ona|i b|hot|oag|log|a p|wen|i t|ikg|adi| ti|o i|lat|g g|ame|mog|bo |okg|hel|tha| sa|nag|bod|emo|nyo|isi|ile|hok|ogo|uto|si |pa | it| ko|the|diw|ope| op|tek|it\u0161|odi|rwa|sep| ph| kw|pol|gis|bok|me |o j|aag|baa|hop|yal|opa|are|kar|ing|oke|ato|lam|bak|leb|ke | ke|amo|eny|gwa|mok|g n|nye|swa|boa|tum| ja|gan|g a|hag|gon|lan|net|mme| la|ban| fe|ika|rag|ne |g e|nen",
      vec: " de|de | \u0142a|\u0142a |el | el|ion|ar | e |sio|on |to |e \u0142|o d|rit| in|par| pa| co|a \u0142|eri|\u0142e |ga |der|t\xE0 |a d| ga|un | a |a s|asi|n e| i |ito|e i|a e| on|te |onj|e d|ti |\u2019l |ent|con|int|l d| re|nte|s\xF3 | s\xF3|l g|o a|he | da|a p|e a| \u0142e| pr|jun|nju|da |che| o |e c|sar|e e| ch|a\u0142e|n c|na |e o|it\xE0| na|e\u2019l|art|ta |ens|\xE8sa| \xE8s|e p|men| po| se|tar|a c|sa |bar|a\u0142i|o e|ona|e n| so| \u0142i|i d|i e|pro|dar|e s|\xE0 d|nas|na\u0142|sta|i i|sia|r\xE0 |ars|osi|ze |rso|n d|a n|eze|nji|se |ro |esi|nta|ara|iba|\u0142ib|nsa|tut| l\u2019|tri|ame|o o|ar\xE0|ist|a g|usi|i s| cu|io |ita|nes| ne|rt\xE0| tu|r \u0142| un|nto| ma| si|l p|ond|sos|tra|so |nsi|sun|esu|\xE0 p|e r|iti|ji |onp|ren|ont|tes|ste|in |ia |de\u2019|l s|rio|isi|ra |dis|ras|ghe|\u0142i |e f|sie|r d|i p|man|r e|nda|res|ca |nca|anc|a a|str|a i|o i|go | st| fa|n o|ia\u0142|sen|\u2019st| \u2019s|i c|ntr|ien| di|o c|ver|est|r a|o p|nti|l m|pie|nde|son|ego|ega|ari|r i|var| an|rim|a\u2019l|i o|e m|pod|imi| al|n p|pre|o s|co |ani|ri |uti|rus|tru|l\u2019i|et\xE0|e l| ca|ato| fo|\xF3 d|\u0142it| a\u2019|ant|dez| cr| me|ten|\xE0 \xE8|oda|\xF3 p|\xE0 o|den|en | vi|a v|o n|ne |rte|ltr|teg|nio|ini|or |sti|una|e\u0142i|i g| ze|\xE0 e|npa|ni |ers|a r|a \xE8| su|com| vo|ans|ja |\xE0 i| ar|fon|esp|tro|ote|rot|ura|re |o \u0142|cia|r t|\xE0 c|min|ene|alt|opi|eso|o\u0142o|n s|ute|e t|rse|anj",
      nso: "go | le|le | go|a g|lo |ba |o y|ng | ma|ka | di|ya | ya| ka| mo|a m|et\u0161|a l|elo| t\u0161|a k|ang|e m|o l|na |e t|man|wa |o t| bo|tok| a |e g|la |a b| ga|a t|we |oke| se|gwe|kel| ba|\u0161a |o a|o m|t\u0161a| na|e l|o k|t\u0161e|a s| to| o |ele|a d|o b|ago|ego|dit|t\u0161h|o g|oba|gob|e d|tho| e |\u0161o |ngw| ye|ong|g l|di |o n| tl|ga |swa|let|olo|tla|t\u0161w|mo |ane|ho |\u0161e |oko|aba|\u0161ha| kg|t\u0161o|wan|ela|hab| sw| th|g o|ola|ye |e b|a n|kgo|\u0161wa|eo |set|ito|e s|ona|log|mol| wa|se |oth|ao |eth|ogo|thu|to |eng|a y|o d|hut|e k|o s|net|kol|lok|a a|gag|rel|ire|e e|nag|agw| wo|ana|o w| yo|hlo|lel| bj|\u0161we|alo|aga|leg|wag| ph|yo |lwa|mel|pha|wo |get|kge|ano|aka|ato|lat|din|o o|hir|\u0161eg|o e|ala|mok|\u0161om| la|mog|nya|e y|lao| ts|mot|i g|ke | ke|kan|iti| me|kar|g y|gwa|eba|ohl|\u0161hi|hel|phe|oph|bo |bot|ume|pol|a w|sa | sa|gon| lo| am|are|gel|ale|a p|len|e n|at\u0161|it\u0161|rwa|o f|emo|edi|bon|bja|ta |tle|ban|no |u\u0161o|tlh|amo|wel|i\u0161o|ing|ge | ge|the|leb|o \u0161|ko |hla|bop|dir|e a|ahl|aem|mae|ntl|\u0161on| mm|mon| fi|lek|oka|uto|omo|i b|ret|ape|oge|lal| nn|o\u0161o|pel|okg|abo|gab|lon|lag|yeo|a f|ile|mo\u0161|kga|dik|\u0161i |yal|i l|tlo|a e|tsh|otl|elw|odi|i t| fe|med|dum|mal|ora|oll|hol| nt|jo |boi|lwe|i s|bat|hom|lho|ikg|tha|nel|mu\u0161|mmu|ha |apa|ne |adi|eny|iri|\u0161al",
      ban: "ng |an | sa|ang|ing|san| ma|rin|ane| pa|ne |n s|ak | ka| ke| ha|hak| ri|nga|ma | ng| ja|in |sal|lan| pe|n k|uwe|iri|g s|ara|alu|lui|gan|uir|duw|adu|mad|adi|yan|nma|anm|jan|asa|n p|we |g p|g j|pun|a s|a m|man|e h|nge|tan|n m|awi| la|kan|nin|ra |uta| ne|pan|ur | tu|ih |ala|aya|n n|wan|eng|nte|un |ngg|tur|ah | da|en | ut|ana|bas|beb|nan|lih| wi|apa| ta|are|aha|ent|iad|wia|eba|han|ian|ani|ten|din|wi |taw|aan|a n|gar|asi|n w|pen|ebe|da |ika|ngk|a p|keb|ama|ata|aje|n r|aka|ipu|kal|e s|saj|g n|nen|g k|ado|oni|ron|ero|jer|ela|dan|ate|ka |anu|dos|dad|nya|al |aki|i k|a t| wa|ami|ren|ksa|ega|sak|gka|nay|ewa|mar|nik|ep |e p|aks|ndi|sar|iwa|upa|era|neg|oli|ina|uni| pu| se|h s|pat|ban|lak|h p|rep|os |ran|a k|ali|ngs|aga|sa |ar |e m|ung|atu|arg|n l|usa|sam|ngu|ewe|tat|nip|swa| sw|n t| pi|n d|i n|a u|kat|osa|eda| mu|ena|e k| me|r n|lah|k r|nda|ayo|ida|um |uku|k p|gsa|kew| ba|ras|r p|wen|par|pak|k h|eka| ny|i m|end|ari|yom|gay|kab|uan|pa |gi |kin|kum|huk| hu|n u|h r|war|dik|mal|g t|ta |ti |sti|sap| su|s k|per| in|ntu|pol| po|car|rga|pin|eh |r m|tah|ant|nus|mi |idi|did|rya|ary| pr|ngi|kar|pag|gew|ha |k k|min|uru|ut |tut|ita|eta|dil|oma|ri |ust|mus|ira|g d|sio|gam| ag|as |abi|i p|g h|g r|il |awa|lar",
      bug: "na |ng | na|eng| ri|ang|nge|nna|ngn|gng|ge |sen| ma|app| si| ta|nap|ase|a r| pa|ddi|a n|ri |tau|a t|ale|edd|au |ega|ria| ha|ai |hak|len|e n|ias|ak |ga |a a|pun|inn|ing|ass|a s|nai|pa |nin|sin|ppu|ini|are|gen| ru|ngi|upa|g r|una|rup|ana|ye | ye|gi |ama|i h|lal|man|asa|enn|ara|le |i r|ila| de| ke|ssa|g n|ae | as|e a|san|a m|din|a p|di |sed|ane| se|e r|u n|ada|ann|ala|ren|e p| la|da |lan| we|nas|aga|ipa|i a|e s|pan| ad|wed|reg| ar|sal|pad|ole|i n|g a|lai|asi|pas|a k|i s|ung|rip|g s|ena|jam|ola| pe|ran|ppa|e m|i l|akk|gan|ngk|ong|map|ril|aji|ttu|kan|gar|neg| ne|gka|att|g m|ain| ja|nar|ett| e |k r|i p|nan|i t|ra |e d|ban|gag|bas|eba|beb|ata|sib|nen|i m|unn|iba| mo| wa|ebe|keb|uwe|de | te| sa|par|kel|g p| ba|kun|ura|a d|uru|mas|aka|bol| al|u r|ko |we |kol|tu |add|o r|e y| hu|pol| po|mak|deg| at|bbi|ian|elo|kko|ell|auw|nga|cen|iga|nat|g t|dan| di| tu|apa|uku|huk|ro |tte|ma |ngs|atu|leb|iko|sik|ssi|rga|arg|ekk|rel|uan|la |an |ece|pat|gau| to|ele|a w|e w|a y|lu |a b|gsa|sil|rus|ie |ire|ebb|oe |wet|rek|llu|ppi|tun|dec|wa |awa|baw|u w|ten|ter|ka |per|mat|g y|pak| an|lua|sse|pig|dde|nre|anr|ton|olo| ia|caj|nca|ona|nro|onr|sa |tur|k n|e h|u p|bir|lin|a e|eri|mae|e k|si |elu|a l|tam|ru |ntu|ade",
      knc: "nz\u0259|ro | a |be |ye | k\u0259|z\u0259 |mbe| ka|a k| ha|akk|abe|kki|hak|ndu| nd|a n|a a| ya| la|ad\u0259|ben|aye|en |inz|kin|yay|\u0259be|ji | mb|lan|ma |d\u0259 |eji|bej|\u0259 a|o a|aro|\u0259la|du |e m|k\u0259l|\u0259na|k\u0259n| ba| ga|ga |lar|e a|u y|an |rd\u0259| ad|anz|shi| sh|ard|\u0259ga| ku|au | au|e h|n k|a s|uro|wa | na| ye|so |obe| sa|ara|iya|kal|ama| n\u0259| su|amb|n n|in |\u0259nd|ndo|kur|inb|d\u0259g|u a|kam|na | fa| nz|and|ida|ba |\u0259 k|awa|la |nyi|a b| fu|d\u0259b|a l|n\u0259m|sur|e s|aso|ana|gan| ci| ab|a d|t\u0259 |a g|kar|d\u0259n|uru|a y|baa|\u0259 n|ru | da|wo |\u0259ra|ndi|ya | s\u0259|t\u0259n|ade|gad|asa|ta |aar|aa |al | as|aya|i k| du|e n| ta|uwu|din| t\u0259|nam|ata|e k|o k|am |a f|o n|t\u0259g|i a|\u0259mk|\u0259 s|nba|awu|iga|nga|wu |ala|utu|o w|da |nza|z\u0259g|\u0259li|gin|ima|z\u0259n|u k|adi|owu|cid|\u0259wa| wa|san|\u0259gi|laa|awo|de |bem|fut|n a|wan|rad|do |ali|i n|mka|e l|u s|z\u0259b|o s|ayi|wur|n y|ibe|iwa|\u0259g\u0259|za |mar|a t|wal|m\u0259r| m\u0259|tu |nd\u0259|az\u0259|wum|fuw|kun|g\u0259n|uma| ng|o g|ema|yir|gay|o h|on |tam|kat|ada|lmu|ilm| il|jam| ja|dob| ny|d\u0259w|yaw| ay|\u0259n |hir|i s|liw|ela|bel|how| ho|at\u0259|nat|iro|aid|z\u0259l|lt\u0259|hi |tin|dum|nbe|o t|\u0259 f|irt|rta|n d|kiw|a h| wo|mu |sad|\u0259 h|\u0259d\u0259|taw|lil|dal|sha|n f|iwo|o f|enz|diy|\u0259di|s\u0259d|yi |\u0259ny|ang|nab|nya|wob|unz| aw| ra| ji|lam| al|nad|wow|ram|\u0259 y|dar|a i|ut\u0259| yi|u n|di |kas|fan|\u0259nz|t\u0259b",
      kng: " ya|na |ya |a k| na|a y|a m| ku|a n|u y|and|a b| mu|wan| ba| lu|yin|tu |ve |yan| ki|ka | yi|nda| mp|a l|di |ndi|la |ana|ntu|si |so |da |ons|e n|mpe|nso|aka| ke|pe |mun|unt|lu |i y|alu|sal| ma|o m|luv|ta |ina|nza|ke |u m|e y|uve|ndu|ala|u n|i m|za |ban|amb|u k|isa|fwa| ko|to |kon|ayi|ma |du |kim|ulu|o y|kan| me|wa |usa|kus|anz|ama|ang|end| ve|yon|nyo| ny|a v|a d| to|i k|nsi|ins|i n|sa |mos| mo|mbu|e k|und| bi|osi| fw|ika|kuz|len|uti|imp|mab|uka|ata| le|ind|vwa|tin|pwa|mpw|kuk|ba | at|kis|adi|mba|olo|ngu|bu | di|uta|mut|lo |sam| sa|sik|isi|e m|su |ila|ula|e l|mu |usu|abu|nga| nz|lus|yi |yay|ngi|but|o n|ni | nt| ka|dya|kak|dil|esa|amu|ti |imv|o k| bu|bal|e b|wu |awu|kul|ant|gu |ngo|inz|bun|a t|mpa|utu|dis| dy|nka|ank|mvu|kin|u f|iku|ong|uzi|zwa|i l|bim|sad| mb|vuk|dik|uzw|lam|tan|mef|idi|kat|lwa|fun|kuv|ga |ken|bak|ing|luz|baw|bis|yal|uya|luy|bay|nsa|mak|usi|mus|nta|ibu|kub|a a|atu|ufu|uvw|i a|ani|swa|uza| ni|ela|tuk|kol|lak|uso|ola| ns|twa|uko|pam|kut|bam|i s|eng|ku |umb|don|ndo|yak|i t|iti|mbi|eta| nk|iki|gi |uku|a s|luk|sol|nzo|te |nak|oko|mam|tal|efw|pes|dib|u b|ati|gid|uke|nu | nd|umu| vw|ilw|dus|luf|zo |u t|mvw|met|bum| ng|sul|ima|wel|kwe|ukw|zol|yam|ota|kot|lan|zit|i b|i v|kun",
      ibb: " nd|ke |e u| mm|ndi| ke|me |de |e n| em|o e|en |nye|mme|owo| en| ow|wo |yen|ene|mi |emi|ye |i e|e e|eny| un|nen|eke|une|edi| ek|e o| uk|et |n n|ne |e i|n e|e m| ed|e k| ye| es|ana|em | id|ede|esi| mb|un |di | nk|iet|kpo|na |ukp|sie|kem|kpu| in|kie|eme|did|ie |idu| nt|nam|am |ndo|o u|o o|mo |o n|mmo|yun|t e|din|dib|kpe| uf|o m|ked|nyu|no |ded|o k|an |on |nkp|e a|du |m e|iny|kpa|po |ho | kp|ade|om |ina|dut|ono| ub|m u|uke|bo |ikp|i o| ki|ini|bet|mbe|ida|t m|ode|in |oho|wem|uwe| uw|bio|ut | ot|ru |uru|pur|uto|ni |i m|do |fen|omo|dom|u u|ok | us|to |dik|iso| ut|mde|tom|ibo| is|n i|ri |o i|oki|mok|edu|ide| et|a n| on| ak|diy|ak |nek|a e|n o|i u|man|u o|puk|akp|pan|idi|m n| ob|ara| or|a m|op |a k|t k| ny|ema| as|io |kar|pon|nwa| ik|oto|boh|ubo|n k|ufo| an|i k|m k|k n|pem|uka|o a|i n|uk |ed |wed|nwe| nw|usu|uan|te |mad|ti |e y|a u|asa| mi|obi| ef|n m|m m|dud|sun|n y|ka |o y| ey|t i|ro |oro|ond| of|ra |aba|tod|fin|re |nte|nde|ko |efe| ab|k u|dis|n u| eb|ony|pa |nti|pe |med|da |ndu|mbo|eye|dem|aha|ban|ena|nka|san|i a|sop|ibi|sin|ion|eko|se |he |ruk|oru|eto|sua|d e|odu| od|a o|mba|ama|fok|iok|a a|anw|mek|so |ufe|m o|kon|k m|ha | se|si |asi|bas|ufi|ito|dit|ere|ike|son|ori|pep|fon|u n|a y|bon",
      lug: "a o| ok| mu|wa |oku|nga|mu |ga | ob|a e|tu |ntu|bwa|na |a a|ba |ang|ra |a m| ng|wan|aba| n |a n|li |oba|a k|unt|la | ab|era|a b|ibw|mun|u n|ka |ali|tee|ate|i m|uli|bul|obu|eek|u a| bu|dde|za | ku|ana|ban|sa |edd|ala| eb|mbe|iri|ye |gwa|emb|omu| om| ek|u b|ant|ira|e o|n o|be |amu| en|eki|kwa| er|dem| ed| ki|nna|okw|ama|kuk|eer| ye|eri|kus| ba|ggw|kol| wa| em|usa|ula| am|inz| ly|eka|any|ola|i e|ina|kwe|o e| eg| ky|ekw|u m|mus| bw|kir|ere|ebi|u e|ri |n e|uyi|a y|y o|a l|onn|uso|u k|ger|e e|bal|egg|o o|mat|zib|izi|aan| at|awa|no |ko |yo |bwe|yin|kul|bir|zes|wal|aga|nge|ako|gan|ebw|nza|lin|esa|e m|oze| ma|riz| te|nyi|kut|ya |ufu|kub|sin|we |ngi|obo|kan|nka|yen|eby|y e|gir|eta|una|aka|lye|tuu|wo |bee|u o|ku |i y|ino|kin|e b|a w|isa|o b|sob|zi |e n|wam|imu|e l|uku|bon|de |san| by|ata|wat|iko|kuy| ag|boz| al|ngo|lwa|umu|ulu|utu|uki|ewa|taa|o n|ong|si |nsi|by |e k|muk|usi|rwa|ne |i o|i n|enk|bye|rir|ma |kug|mbi|iza|lal|uko|kis|enn| og|ole|kye|a g|asa|add|ani|nya|sib|ens|ni |ini|uka|i k| aw|uga|gi |yam|n a|tab|uma|umb|kyo|wen|uwa|bib|wee|ing|a z| ey|ze |emu|ete| et|tew|a t|yiz|mul|awo|u g|nzi| kw|tal|o a|o k|fun|afu|and|i b|ibi|ung|ro |amb|igi|aku|saa|baa|nyu|yig|ayi|gya|wet|kik|go |a s|ti ",
      ace: "an |ng |eun| ha|ang|oe |peu|ak |on |ngo|gon|ah |nya| ta|na | ny|ung| ng|reu|yan| na| pe|ure|meu|roe| ke|eut|hak|keu| me| ba| ur|at |teu|ee |han|a h|dro|ban| di|ara| be|ata|g n|iep|tie|am |eur| sa|nan|jeu|ut |n n|ep |eug|tap|seu| la| te| ti|uga|e n|euk| da|ala| at|a n|eba|beb|awa|ong|ra |tan|n t|eum|eh |n b|p u|ih | se|nda|h n|a t|a b|h t|ape|eu | pi|oh |eub|e p|lam|e t|ai | ma|um | si|dan|eul|asa|t n|und|neu|ana|n p| wa|n a|bah|lah|and|lan|wa |euh|n k|nyo|n h|eus|ula| bu|k t| je| dr|anj| pa|ma |g s|n m|h p|eng|nga|ran|n d|om |hai|a s|yoe|e b|mas|san|ngg| ra|ta |beu|g d|nje|taw|uka|ek |a k|una|a m|ura|yar|sya|gan|soe|n s| li|sid|ya |sab|aka|k n|ka |dum|ndu|har|ot |di |idr|aya| ka|kat|e u|e d|ok |a p|bat|aba|euj|gah|adi|lak|pat|et |n j| ja|kom|uko|kan|en |asi|ari|t t|aan|un |h d|sa |ame|ate|ama|sia|oih|usa|h h|g k|i n|sal|ila|bue|dee|lin|h b|ieh|g p|bak|aja|huk|ade|k m|dip| in|lee|uny|uh |rak|dar|uta| so|gar| ne|nto|ant|rat|uja|h s|aro| le|g h|nta|ep\u2010|ina|k a|uma|t b| ji|don|gro| hu|k h|ile|t h|t s|ngs|gam|aga| ag|m p|n l|heu|e s|ahe|a l|ane|e a|ggr|\u2010ti|p\u2010t|g b|ue |toe|jam|oe\u2010|eud|k k|ngk|ika|ino|ute|ie |wah|ham|n u|taa|yat|k b|tam|sam|a d|ia |man|use|t l|uk | an|aso|ga |g m| ya|ri ",
      bam: " ka|ka |ni |a k|an | ni|kan| b\u025B| la|i k|la |ya |n k|ye | ye|\u0254g\u0254|na |li |\u025B\u025B |b\u025B\u025B|\u025B k|ali| ma| i |man|sir|ra | da|en |ama|g\u0254 |wal| wa|ira|n n| k\u025B|m\u0254g| ja|a n|a b| mi|ma |a d|ana| m\u0254| ba|\u2019i |\u0254r\u0254|min| o |iya| si| sa|in |ara| na| k\u0254|i m|i j|dan| k\u2019|i d|a s|len| jo|b\u025B |jam|a m|\u025Br\u025B|i n| n\u2019|a l|a y|k\u0254n| f\u025B|k\u025B | t\u025B|iri|ari|\u2019a |aw |\u025B s|a i|\u0254n\u0254|i t|\u025B b|n b|ani| an|riy|sar|\u025B m|t\u025B |r\u0254 |ko |a w|i b|si |asi|a t|k\u2019i|\u025Bn |o j|a f|a j| fa|den|aya|n\u0254 |n y|i s|ale| de|ang|aar|baa|ila|ala|kal| di|inn|tig|o b|\u025B j|\u0272a |i f|olo|nu |nnu|osi|jos|raw|kun|ati|e k|w n|\u025B n|aga| se|\u0254 m|n\u025B |in\u025B|nti| ta|lan|b\u0254 |i y|\u0254 b|don|ga |ugu|a a|f\u025Bn|da | j\u025B|ig\u025B|\u0254n |\u0272\u0254g| \u0272\u0254|n\u0272a|u k|ada|bil|abi|r\u025B |n\u2019i|o l|\u0254 k| fo| a | ti|aba|nw |jo |n i|a \u0272|go |\u0254 s|i\u0272\u025B|o m|y\u0254r|n o|n\u2019a|ri |h\u0254r|i h|g\u0254n|afa|kab|un | ko|i l|aka|lak|on |e m|igi|a o| b\u0254|o f| s\u0254|n f| fi|ant| h\u0254| c\u025B|\u025B l|dam| ha|aay|maa|fur| fu| ku| t\u0254|ti |ile|gu |m\u025Bn|riw|e b|\u2019o |e f|iwa|\u025B y|uya|nna|n m| do|ago|nga|kar|nka| du|o k|\u0272\u025B |n w| j\u0254|iir|n d|fan|oma|lom|wol|nin|n j|c\u025B |u b|ili|a h|nen|\u0272\u025Bn|ade|\u025B\u025Br|u d|nba|ru |uru|t\u0254n|\u025Bku|j\u025B |dil|gan|i i|sug| su|w l|\u025Bm\u025B|w k|uma|ew |f\u025B |aju|\u0254 o|di\u0272|\u025B i|\u0254 n|s\u0254r|isi|\u025Bya|ank| t\u2019|\u0254n\u0272|r\u0254n|i \u0272|wa | b\u2019|taa|anb|mad|had|lu |yir| yi|amu|aam|lad|\u025Bna| \u0272\u025B|sag",
      tzm: "en | ye| d |an | n |ur | s |ad | ad|h\u0323e|lh\u0323| lh| gh|agh|n i| i |\u0323eq|d y|n t|eqq| ta|ett|qq |s l|dan| is|gh |la |hur|ell|ra |d t|r s|ghu|is | na| am|nag|i t|mda|ll |n g|a y|yet|t i| te| ti|di |n a|l a| di|akk|in |ara|a d|n d| ar|ma |ghe|n l|ull|it |edd|dd |kul| ku|amd| ur| id| wa| we| ma|a n|q a|li |rt | yi| ak|d a|as |a t|lla|men|es |d i|a i| le|sen|lli|lel|a a|n s|t t|ar |na |n n|eg | tm|n y| dd|tta|t a| as|r a|ken|kw |kkw|twa|i w|n u|d u|deg|mur|t n| tu|s d| ag|at |wen|gar|i l|win|ttu|wak|n w| tl| de|s t|d\u0323e|i n|hel|d l|tam| se|rfa|wan|w d|urt|er |h d|iya|gi |sse|yes|erf|zer| tt| ik|ddu|q i|h\u0323u| in|tle|nt |hed|r i|wa |arw|mga|idd|sef|fan|ize|n m| im|ya |udd|ttw|i u|uh\u0323|mad|tim|s n|i d|emd|wem|tmu|ef |ame|rwa|i g|\u0323en|id\u0323|ddi|ih\u0323|ili|ess| u |el |t d|awa|msa|lan|a l|kke|tte|ikh|em |wad|way|\u0323ud|s y|mma|s k|i i|ant| ya|siy|\u0323r\u0323|un |agi|dda|til|khe|med|tes|ana|taw|l n|d n|chu|all|yek|am |g w|ah\u0323|r d| iz| ne|nun|anu|qan|lqa| lq|t l|iwi| ss|den|gha|ert|der|nes|man|tag|s u|hwa|ehw|yeh|ala|ila|lna|eln| la|r\u0323r|ray|s\u0323e|yed|iwe|n k| l\xE2|yen|ile| il|ha |ski|esk|lt |hul|ekh|del|i a|kra| kr|yn |ayn|a s|h a|ir |ezm|net|eh\u0323|awi|ki |u a|leq|fel| fe|ssi|use|ine|il |r t|tem|edm|hef|ail|aw |naw|yas|asi",
      kmb: "a k|la | ku|ya |ala| mu| ki|a m|kal| o |u k|o k|ni | ni| ky|mu | dy|dya|a o|lu |ang| ya|tok|kya|nga|na |so |oso|a n|oka|nge|mba|i k|a d|kut|xi | wa|kwa| ka|mut|hu |elu|thu|ba |uth| kw|uka|gel|ka |a i|wal|wa |uto|ene|ban|ga |i m|kuk|ku | mb|e k|u m|ne |ana|kik|u n|a y|ngu|iji| ng|u y|ela|u w|i y|ixi| mw|kit|kel|ye |ika|wen|isa|nda|ji |oke|u i| ji|ena|and|und|kil|ilu|ung|ke |iba|ila|aka|a w|o w|yos|ten|kus|ulu|kub|e m|ta |alu|sa |oxi|mox|amb|olo|kum|gu |wos| wo|wat|ate|muk|gan|lo |tun|du |ndu| it|mwe|kan|san|kis|ita|o m|luk|imo|ong| ph|kye|a t|i d| ye|di |ato|nji|kij|sok|idi| ix|u d|kud|u u|ula|tes|we |e o| ke|a s|o i| di|uku|da |udi|ma |lun|lak|eng|ele|wij|yat| we|nu |wan|uba|e n|hal|pha| se|e y|yen|kib|a j|uke|ki |o n| yo|ito|itu|a u|i n|jin|kwe| im|lon|u o|uta|su |i w|ja | ja|utu|kat|iki|fol|ute| ut|kul|i u| en|kim|adi|ikw|tal|esa|nde|dal|yan|ngo|fun| ko|jil|eny|i o|uki|nen| ik|umu|lel|atu| uf|ing|uso|vwa|o y|esu|u j|ge |ufu|lan|o d|nyo|jya|uma|i j|jix|ukw|usa|unj|ite|o a|kuz|sak|dib|kyo|mun| os|mbo|imb|go |kos|u p|ijy| ib| tu|te |i i| a |han|xil|exi| il|kam|dit| un|a a|ilo|gam|kwi|tul|ivw|ubu|lul|a p| so|iku|uni|se |oko|o o|mwi|ote| to|kex| uk| bh|ufo|e a|ind|bul|sen|inu|ngh|kiv",
      lun: "ng | mu|la | ku|a k|di |aku|tu |chi|g a| a |ntu|mun|ma | ch|a n|unt|a m|ndi|ela| we| na|aka|ima|ind|jim|eji| ni|i m| in|u w|a i|wu |i k|a w|shi|awu|hi |lon|u m|wej|sha|ing|kul|wa |nak|i n|ala| ja|na |ung| kw|muk|ulo|kum|ka |a c|hak|cha|iku|ewa|wen|a h| wa|g o|u j|kut| ha|ana|vu |ovu| ov|yi |idi|u c|him|nik|ong|adi|mbi|kwa|jak|kuk| an|ang|tun|bi |nsh|tel|ha |esh|amu|han|kus|kwi|ate|ila| he|uch|ula|imb|ilu|a a|kew|enk|uku|mu |u a|hin|a y|zat|nke|u n|kal|hel|ond|i a|ham|eka|eng|mwi|a d|itu|and|del|nde|wak|ins|nin|i c| ya|ona|mon|ina|nji|i h|ach| yi|ama| ak|nat| mw|nyi|kin|umo|lu |ata|uma|sak|ku |udi|ta |ati|uza|kuz|mul|wes|ich|i y|awa|u k|uta|muc|i j|wal|uka|kuy|uke|wit| di|yid|naw|kam|bul|ayi|wan| ko|i i|kad|waw|akw|ni |ken|ji |uki|iha|dik|u y|g e|ush|mbu|si |osi|kos|ahi|ika|ish|kud|ash|twe|atw|any|dil|hih| ye|da |eni|kwe|wil|imu|dim|li |ya |kun|yin|g i|nan|yan|win|iwa|din|tam|etu|ant|amb|mwe|his|nda|hik|til|ule|umu|was|inj|jin|hu |nam|mpi|iki|wah|hiw|kuh|jil| da|eyi|ney| ne|isa|hid|usa|jaw|wat|wun|tan|umb| ma|uya|una|end|lun|pin| ji|ahu|nka|omw| om| ny| i |hen|che|yej|wik|u h|eta|tal|kuc|ulu|sem|wet|fwe|twa|utw|uyi| hi|iji|iwu|mpe|omp|ilo|yil|nic| en|a e|iyi| at|haw|lek|mba|emb| ew",
      war: "an |nga|ga | ng| pa| ha| ka|han|pag| hi|in | ma| an|ata|mga|hin| mg|kat|ay |ya |a m|a p|gan|on |da |n n|n h|ug |n p|n k|ung| ug|iya|a h|a k|ha |n i|adu|n m|dun|tad|ada| iy|sa | o |ara|may|a n| ta| di|a t|n a| na|y k|o h|pan|kad|tag|n u|yon|ags|ud |o n|ang|al |a s|ana|gsa|gad|a u|o p|man|syo|asa|ala| ba|ag | in|a i|g h|n b|agp|asy|awo|ray|war| wa|to |a d|wo |a a|usa| us|g a|nas|ina|was|taw|nal|ing|gpa|ali|iri|dir|agt|i h|ra |ng |aha|ri |bal|san|ad |kas|aka|g p|o a|a b|ida|awa|hat|no |g m|ini|uga|ahi|y h|o m|tan|ili| bu|uha|buh|gka|agi|bah|aba|i n| su|tal|him|at |pin| pi|hiy|kan|int|mo |n t|did|a o|aya|sya| ko| tu|nah|nan|iba| bi|n o|od |agb|la |kon|lwa|alw|gba|aho|tra|uro|o u|l n|ona|yo |ho |pam|o k|agk|ano|d a|sud|asu|gin|ngo|ni | la|hi |as |rab|uma|ton|os |par| sa|sal|ati|ko |iko|upa|lin|ami|gar|ban|n d|ern|gi |aag|abu|a g|kal|d h|aga|yan|n e|yal|d m|gtu|ak |mil|rin|ba |lip|mah|aud|lau|ka | so| ig|lig|ama| ki|ihi|tik|ras|aso|mag|gud|g i|tun|g k|duk|osy|sos|kau|uka| un|hon|n s| pu| ib|ro |imo|tub|mak|pak|ila|n w|yer|bye|ent|ito|ika|amo|it |sug|n g|dad|ira|edu| ed|tum|aup|ngb|til|non|anu|pod|upo|sak|sam|ari| pr|agh|alu|ato|ta |nta|gon|lik|bli|s h|d i|k h|uyo|ig |uli|bul|dto|adt|isa",
      dyu: "a\u2019 | k\xE1| k\xE0|ye | ye|k\xE0 | \xE0 |ni |la | b\u025B|\xE1n |k\xE1n| la| ni|ya\u2019| i |\u0254g\u0254|ya |k\xE1 |m\u0254g|a k| m\u0254|b\u025B\u025B|\xE1 k|\u025B\u025B |na |\u0254r\u0254|n k| m\xED|\u2019 y|m\xEDn|\xEDn |i y|\u2019 k| be|\u2019 l|be | ya| k\u025B|te |ma |\xE0 k|\u2019 m| te| j\xE0| w\xE1|n n|nya|\u025B k|\u025Br\u025B|i\u2019 |a b|w\xE1l|ra |\xE0ma|\xE1li| \xF2 |ima| n\xED|j\xE0m|\u025Bn |g\u0254 | m\xE0|e k|\xE0 l|\u0254\u2019 |lim|n\xED |n\u2019 | l\xE1|iya| k\u0254|\xE0 \xE0|o\u2019 |e \xE0|e b| h\xE1|r\u025B |ana|man|r\u0254 |n b|i k| s\xE0|\u025B y|\xE0 m|e s|\xE0 b|li\u2019|\u0254n\u0254|k\u0254n|h\xE1k| d\xED|gb\u025B| b\xE1|n y|ara|b\u025Bn|\u2019 s|k\u025B |m\xE0 | b\u0254|\u2019 n| k\xF3|aw |\u2019 b| s\u0254|riy|\xE0 y|a m|n\u0254 |e m|s\xE0r|a j| s\xED| f\xE0|\u0254 k|\xE0ni|\xE0 s| gb|k\u025Br|s\u0254r|y\u025Br| y\u025B| f\u025B|g\u0254\u2019|n m|b\xE1a| s\xEC| t\xE1|\xE0ri|na\u2019|e w|y\u0254r|a d|i m|a s|a n|\xE1k\u025B| l\xE0|l\xE1 |\xE1ar|d\xED |\xE0 i|ali|a f|en | c\u025B|b\u0254 |an\u2019| d\xE0|yaw|\xF3lo|\u2019 t|d\xE9n|\xECgi|s\xECg| \xE0n|\u2019 f| s\xE9|\u0254 s|\xE1na|\u025Bra|\xF3go|b\u025Br| \xF3 |a t|w n|\u0254n |ra\u2019|e i|\xE0 t|i \xE0|\xE0 d|si |se | se|\u2019 d| a |aya| \u0272\xE1| t\u0254|c\xF3g| c\xF3|s\xED |f\u025Bn|i b|\xE0ra| m\xE1|\u025Bya|lan|k\xE0l|\xE1 d|\u025B l|\u0254 \xE0|nga|n s|a w|\xE0ng|li |a \xE0|\u025B\u2019 |\xE0 n|ko | \xED | d\u0254|g\u0254n|e \xF2|a y|t\xE1 |\xED i|i t|\xE0la| na| d\xF2|so\u2019|u\u2019 |e\u2019 |r\u0254\u2019|a i|a g|ina|kan|nin|\u0254ny|a h|k\xF3 | \xF9 |ili|\u0254 b|w l|k\u025By|e n|den|ama| d\xE9|f\xFAr| f\xFA|i n|i \u0272|\xFAny|d\xFAn| d\xFA|ma\u2019|k\xF9n| k\xF9|\xF2n |d\xF2n|i l|e d|ga |nna|go |\xF2 k|i s|len|k\xE9l| k\xE9|\xED t| n\xE0|\u025B n|a c|i f|\u025Bnn|d\xE0n|\xED \xE0| l\u0254|d\u0254 |tig|\xE1ki|r\u0254n|h\u0254r| w\xF3|da\u2019|gid|\u0272\u0254g| \u0272\u0254|la\u2019|\xFAru|\xF2 b|ow | b\xE8| f\xE1|\u025B t| y\u0254|\u0254 y|j\u0254n|\xECna|m\xECn| m\xEC|\u0272\xE1n|\u025B b|e j|in |\xED y|\xE9le|b\xF3l|\xE0ga|\xEDin|d\xEDi",
      wol: "am | ci|ci | sa|sa\xF1|a\xF1 | na|it | ak| am| mb|lu |ak |aa |\xF1 s|mu |na |m n|ne | ko|al | ku|baa|mba|te | mu|ko | wa|a s|\xF1u | ni|u n| te| ne|nit|u a|e a| lu|t k|i a|oo |u m|ar |ku |ay | it|pp | do|u k|gu |u y|\xE9ew|r\xE9e| r\xE9|war| ta| \xF1u|i w| bu|xal|llu|\xE9pp|oom| li|u c|on | xa|ul |\xE0ll|w\xE0l| w\xE0|loo| yo| di|kk | ya| aa|u d| gu|yoo|oon|i d|i b|m\xEBn| m\xEB|fee|doo|bu |nn | bo|ew |e m|o c|r n| xe|eex|i m|boo| yi|nam|aay|m a| nj|ara| du|ju |xee|yu |en |een|naa|uy |ana|enn|aar|aju| bi|taa|ama|igg|oot| l\xE9|yi | pa|di | aj|ti |\xEBn |okk|k s|taw|lig|g\xE9e|ral|ee |u l|i l|m m|und|dun| de|li |u j|n w|an |w m|ala| me|eet| se|axa|ata| ba| so|n t|a a| d\xEB|m c|yam|mi |\xE9ey|gg\xE9|ota| gi|ir |ewa| an|a m|aam| ja| ke|ngu|om | su|a d|see|amu| ay|ax |ex |wfe|awf|dam| mi| ng|ey |p l|i n|o n|u t|a n|ool|jaa|ken|une| ye|la |n m|k l|kan|a l|et | yu|bok|mbo|u x|i t|\xE0ng|j\xE0n| s\xEB|k i|nee|i j|e b|men|ok |em |ndi|i k|\xF1 \xF1| lo|m g|nda|\xF1oo|kun|opp|ali| ti|laa|j a|l x|n n|lee|nd | da|ada|aad|are|nj\xE0|eem|y d| fe| jo|y a|l\xE9p|tee|aw |l c|wam|k c|n a|l l|nja|\xEBng|le |a b| mo|aan| fa|e n|m r|oxa|dox|n c|l a|ska|ask| as|aat|a c|mul|l b|aax|u s|y t|eg | j\xEB|k n|ng |g m|gi |gir|k t|\xEBy |s\xEBy|\xEBra|g\xF3o|kku|u\xF1u| b\xE9|tax|ba |e s|m s|i r|i c|k b|a\xF1u|t a|u w",
      nds: "en |at |un | da|n d| de|een|dat| un|de |t d| ee| he|cht|n s|n e|sch|ht |er |ech| wa|rec|tt | si| to|vun| vu|ett|ten| re| ge|n h|ver|nne|k u|elk| el|t w|ien|lk |sie|to |het|gen|n u|t u|n w|orr| an|n v|r d| in| ve|ch |war|ann| or|\xF6r |t r|rn | f\xF6|it |rer|ner|f\xF6r| st|rre|den|t g|n f|up | up|eit|t a|t e|rie| fr|aar|nd |ich| sc|chu|wat|n g|fri|nn |ege|on |oon|rrn|daa|t h| bi|is | is|rt |ell| se|hte|len|n o|n k| ma|kee|in |ik |lt |e s| mi|n i|aat| we| na|ven|hei|t s|t t|hn |lle|n t|n m| dr|ok | ok|doo|ers| ke|se |lie| s\xFC|nsc|ken|n a|arr|sta|\xFCnn|gel|r s|ren|rd |che|ll |ill|he |e a|nen|ene|men|ie |ins|ahn| gr| wi|ede|kt |\xF6ff|r\xF6f|dr\xF6|raa|sik|llt|n b|an |kan|ard|und|e g|gru|dee|ff |s d|sse|s\xFCn|all| ka|run| d\xF6|eke|st | do|ere| \xFCn|ehe|ebb|heb| gl|min|e e|ens|taa|rch|\xF6rc|d\xF6r|ig |nee|maa| so|al |aal|cho|tsc|e f|ieh|e v|t v|\xFCnd|iet|t m|enn|p s|el |h\xF6r| wo|t o|t n| fa|iht|eih|hen| al| ar|bei|rbe|arb|pp |upp|hup|e w|ehr| eh|utt| be| ut|na |inn|nre|lan|nst|ats|huu|as |weg|t f|e r|\xF6ve|eel|et | ni|mut| mu|pen|t b|a d|wen|ul |uul|e d| ah|str|eve|lic|ert|aak|hee|t k|ste|erk|\xFCss|d\xFCs| d\xFC|t i|der|iek|e m|mit|d d|nic|ent|gt |anr|set| as|aaf|tra|art|oot|r t| eg|ach|t l|l s|ter|akt|and|ame|hon|nat|n \xFC|r e|ite",
      fuf: " e | ka| ha|ndi|al |de |di |and| no|han|no | ma|o h|nde|e d|aa |e n|dyi|he |i e|un |a n|ala|dhi|yi |la |gol|re |dho|ka |eed|ho | wo|kal| dy|maa|dhe|o k| bh| ne|ko |ann|ni |hi | dh|bhe| nd|edd|won|ol |e e|ddh| mu|haa|ned|mun|e m| le| sa|i m| go|nnd|taa|aan|e h| fo|ede|eyd|ley|dan|e k|gal|aad|ii |i k|o n|sar|ond| fa|en |dya| ko|e b|tta|a k| he|ow |ana|uud|adh|iya|riy|yaa|bha|aak|ani|ett|het|ngu|aar|ydi|ari|i d|e f|i n|tal|le |ral|ira|ita|oni|ya |oo |na |nga|goo|dir|ndh|nda|ee |ydh| ta|e l|are|e g|ina|n n| wa|faa|fow| hu|i w| fi|akk|naa|ree|e w|udh|yan|ugo|i h|to |oto|nan| ng|oot|dyo|udy|oll|ore|fii|kko|mak|e s| da|a d|l m|on |dhu|dii|iid|ude|aam|i f|a e|o f|ady|den|n m|yee| on|e t|laa| la| na|l d|e a|idy|l n|l e|fot|ke |awt|lle|oor|in |o e| do|ubh|n k|a h|a b|a o|tan| ya|yng|att| ho|an |ake|nya|hen|a l|ewa|hun|i s|i t|mo |amu|te |n e|huu|taw|tor| o | ad|lli|onn|bon| bo|dee|bhu| an|ere|hoo|n h| ny|woo|iin|o w| mo|ku |er |der|ota|n f|dha|ant|l h|wti|tin| ke|tit|l l|yam|o b|aal|l s|a f|guu|ell|edy| se|und|n d| ga|ago|a t|eyn| ku|l g|gur|ama|a w|a m|oon|ndu|rew|waa|u m|nee|mu |tii|ri |nta|hin|wal|kaw|bhi| de|tug|dud|ure|uur|hey| fe|wad|do | si|too|o s|ing| te|tay|eta|o t|adu|ang|rda|urd",
      vmw: "tth|la |thu|a e|na |a m|ana|we |hu |kha| mu|a o|awe|ela|wa | ed|to |ire|ala|hal|dir|edi|ito|eit|rei|ni |mut|aan| wa|a w|u o|akh| on|a n|haa|ya | ni|o y|a a| yo|wak|utt|nla| ot| oh|iwa|ka |okh|att|oha| n\u2019|the|oth|mwa|mul|ari|ne | si|iya|aku|apo|lap|unl|kun|aka| el| wi|tha|ott| ok|ha |oni|e m|e a| at|ale|le | sa|e n| va|ene|ihi| aw|owa|o o|ett|e s|ele|hen|hav|oot|lel|ta |moo|ula|amu|iha| kh| en|e o|han|o n| ak|o a|ota| mo|i a|e w|po | mw|row|nro|ara|\u2019we|anl|i m|e e|de |ade|aya|a s|waw|ihe|ra |hel|eli|dad|a i|o s|ina|vo |a\u2019w|nak| ah|lan|i e|i o|ika|sin| et|wi |eri|n\u2019a|onr| ya|ri |var|ona|liw|hiy|nna|aa |wal|u a|a v|kan|oli| so|ko |huk|her|hiw|riw|avo|u e|wan|thi|aha|kel| an|eko|tek|hwa|sa |yot|itt|e k|uku|laa|riy|una|hun|ntt|yar|khw|ane|ath|pon|e y|o e|iwe|lei|ali|kho|wih| ep|n\u2019e| es|ida|ani| a |nih|n\u2019h|vih|avi|him|ei |lo | ma|aki|kum|i n|i w|nkh|uth| nn|a y|ahi|ile|rda|erd|ber|ibe|lib|i v|ia |ute|ole| it|som|i s|yok| na|ola|nuw|nnu| eh| yi|va |mih|saa|lih|hop|\u2019at|man|hik|a k|ikh|iri|nin|mu |elo|\u2019el|yaw|tte|mur|ont|ila|lik|hol|u s|uma|ma |uwi|inn|ehi|u y|nal|kin|saw|enk|in\u2019|nan| wo|tti|ena|mak| ek|pel|ope|oma|sik|epo|ulu|ro |ira|wir|nli|pwe|mpw|emp|lem|sil|pot|tel| oo|iko|esi|n\u2019o|era",
      ewe: "me |le |ame|e a|wo |kp\u0254|\u0192e | am| si|\u0256e | me| wo| le|si |sia|e d|a\u0256e|esi|be |p\u0254 |e l|la |e w| \u0256e| la| \u0192e| kp|na |e e| m\u0254| du| be|a a| a\u0256|nye| dz|e s| \u014Bu|uk\u0254|duk| na|e n|ome|ye |dzi|e m|kpl|e b|nya|\u0254kp|p\u0254k|\u0254 a|ple|ke |\u0254 l|\u0254nu|woa| o |iwo| nu|\u0254 m| al|evi|u a|awo|mes|\u0256ek|nu |\u014Bu |o a|\u0254w\u0254|e \u0256|n\u0254 |ekp|gbe|m\u0254n|k\u0254 |\u0254me|e\u0192e|eke|lo |alo| e\u0192|i n| ny|o n|o m|ya |dze| ab|ia |e \u014B|e k|siw|iam|o d|ubu|bub| bu|o k|zi |ukp|li |a m|w\u0254 |nuk|mek| ha|i s|kpe|e \u0192|eny|any|\u0254 s| go|e g| li|mev|\u014But|eme|akp|a\u0303 |an\u0254|gom| ey|bl\u0254|d\u0254w|m\u0254 | w\xF2|en\u0254|tso|iny|\u0254\u0256e|b\u0254 |oma|\u0254na|a k| ta|e t|to |n\u0254n| gb|ia\u0256|\u0256es|\u0254e |bu |egb|a s|vi | \u0192o| d\u0254| he| to|a \u0192|o e|\u0256o | \u0256o|ele|w\u0254w|aw\u0254|i l| an|l\u0254\u0256|abl|\u0192om|e h|i w|a n|w\u0254n|i d|ene|oto|yen|\u0254 \u0256|meg|i a|\u0254 \u0192|x\u0254 |ti | ts|afi|wom|agb| ag|nan|so |uwo|o g|\u0254n\u0254| vo|e\u0256o|t\u0254 |a l|et\u0254| at|o \u0192| ad|ee |se | se|ne | x\u0254|gb\u0254|uti| ma|ovo|vov|vin|\u0254wo|w\xF2a|i b|i t|a \u014B|a d| af|ats|e\u014Bu|e x|\u0256ok|o l| ne|ado|e v|de |\u0254 b|ta |eye| ka|g\u0254m| g\u0254|te |a e|ben| es|ana|a t|i \u0256|r\u0254\u0303|mee|o t| ak|ewo|\u0254 k|s\u0254 |i o|\u0254 e|i m|ema|ded|e\u0303 |man| el|yi |\u0256ev|ata|odz|e\u0256e|u s|k\u0254m|ate|da | xe|ax\u0254| en| aw|edz|ui |buw|heh|uny|pe\u0256|o s|ze |i e| s\u0254|bet|a g|ud\u0254|ehe|ada|o \u014B|o h|abe|he |o w|ts\u0254|u \u0256|ku |isi|kui|oku|\u0254 n| ke|ma |e o| t\u0254|men|ade|dz\u0254|o\u0256o",
      slv: " pr|in |rav| in|do |pra|ti |avi|anj| do|nje|vic|je |o d|no |li |ih |a p|ega| vs|o i|ost| za|ne | po|ga |ja | dr|co |ico|ako|vsa| v |kdo|sak| ka|ali|ima| im|e s|sti| na|van|i s| ne|akd|svo| sv| al|nja|nih|ma |pri|i d|stv|nos|o p|dru|i p|o s|pre|e n|jo | iz|red|iti| de|i i|neg|o v|ki |avn|vo |ni |em |i v|oli|a v|a i| so| nj|jan|obo|vob|ova|na | ki|ati| bi| ob|ko |ego|i z|tva|gov|r\u017Ea|dr\u017E|i n|kol|i k|e v|kak| ra|bod|se |eva|ru\u017E|jeg|e i|vlj| sk|\u017Een| mo|e p|sto|nak|ena| se|del|n p|ter|\u017Eav|jem|kon|sme|a d|voj|lja| ni|enj|pol| en|ovo| te| ta|va |imi|zak| st|bit| sm|var|a n|i o| z |mi |ve |kat|di |pos|lov|nsk|me |kr\u0161|aro| sp|o k|n s|en | je|tvo|odn|vat|ate|a z|vol|ri |ed |ju |sta|a s| va|ji |sam|a k|o a| s |ene|u\u017Ei|rug|ora|mor|jen|ans|elo|avl|itv|e m|eja|dej|rst|vne|nan|ove|e b| me|lje|r\u0161n|akr|nar|\u010Din|\u017Eiv|\u010Den|i m|o z|so |eni|rod|pno|za |oln|dol|h i|olj|tak|ars|nju|ebn|mu |o o|i\u010Dn|cij|aci|\u0161\u010Di|h p|vi\u010D| ve|raz|nst|ajo|ode|kup|sku|e d|v n|u s|otr|nim|jav|\u0161ne|vi |vni|rim|kaz|ta |ovi|ski|n n|\u010De |ose|v s|o t|da |ev |nik|rem| ko|ara|n d|bra|e o|ijo|si |i u|ra |\u017Eev|ra\u017E|vez|dov|ons|zni|obr| ja| sa|ljn|elj|dst|dis|bre|i b|m v|zna|sod|nem|\u0161ni|ina|an |seb|pro|ere|oji|mej|amo|skr| bo|edn|med|iko|ust|mo\u017E",
      ayr: "apa|nak| ja|aka|ata| ma|aki|asi|a\xF1a|ana|aqe|\xF1ap|cha|aw |mar|ti |jha|iw |paw|pat|spa|ark|tak|ama| ch|ani| ta|una|jh |hat|kap|kan|a j|jaq|rka| uk|a m|aru|ki |kis|jan|taq| ar|pa |qe | wa|na |a a|niw|may|kas|iti|ach|i j| kh|ayn|ina|pan| mu| ya|ati|a u|yni|ha | am|amp|w k|as |uka|i\xF1a|sa |mun|at |hit|isp|t a|is |ch |ka |khi|\xF1an|e m|an |isi|oqa|ru |asp|si\xF1|ejh|ta |qha|kam|h a|ajh|pjh|at\xE4| u\xF1|han|mpi|sis|sti| in|ita|qen|ham|\xF1at|\xE4\xF1a|t\xE4\xF1|sin|rus| sa|ma |iri|ara|sit|yas|\xF1ja|ska| ut|yat| ku|arj|qat|tis|tap|kha|pas| ji|ura|u\xF1j|jam|a y|nin|nch|ka\xF1| ju|ha\xF1|ukh|na\xF1|kat|qas|i t|noq|rjh|lir|ili|\xF1a |kun|tas| ka|ans|tha|kak|utj|w m|aya|pi | as|i u|nka|us |aqa|kiw|a t|has|jil| lu|tat|sna|tan|tay|w u|ino|i m|in |w j|rak|s a|apj|jas|nsa|asn|pis|i a|mas|wak| ay|w t|i c|njh|ipa| a |s j|s m|chi|kaj|sip|ra\xF1|lur|mp |ta\xF1|a k|uki|rin|upa|iru|hac|ena|uya|muy|amu|wa |a i|llu|yll|ayl|api|hap|nip|ak |aqh|yaq|n m|a c|tja|eqa|uch|ayk|isa|ank|asa|sap|k a|anq|awa|s u|lan|h j|pam|i y| pa|ask|h u|a w|ap |juc|anc|run|nap|ri |ali|auk|inc|nir| aj|tir|ast|ink|anj|isk|kar|jac|ist|ni |usk|khu|yan|mat|a s| ap|pka|en |\xF1as|sir|qer|i k|kit|heq|che|m\xE4 | m\xE4|s k|e j|yt |ayt|way|qa\xF1|naq|nas|n j|sar|war|s w|s c|ika|hik|a l|t u|hus|h k",
      bem: " uk|uku|la |wa |a i|kwa|a u|ali|ta | mu|a n| na|ya |amb| ya| in|ata|sam|shi|ula|nsa|nga|ang| ku|bu |mbu|wat|se |nse| pa|ins|ons|kul| ba|li | no|aku|lo |ngu|nan|a m|gu | al|ala|mo |a a|fya|a k|ntu|yak| ca|ikw|ing|u u|lik|na |e a|ili|alo|nok| on|u y| um|tu |a p|ga |o n|mu |lwa|lin|sha|i n|ka |ila| ci|ku |uli|oku|ika|and|ulu|ukw|ana|kup|akw|ko |ama|we |cal|a c|amo|umu|aka|a b|aba|kus|lil|o u|cit|kan|yal|mbi|ndu|mul|pa |o a|ish|le |ile|o b|hi |u m|bal|kub|u c|kal|u a|uci|ba |ne |unt|e u|any|ton|kwe| sh|po |ha |yo |bul| fi| if|nsh| ab|du |kuc| fy|e n|abu|ung|u n|cil|nka| ne|kum|a l|fwa|o c|lan|o i|i u|a f|kut| am|und|ush|nda|kuk|afw|no |gan|pan|upo|a o|win|aya|ale|bi | ta|ify|utu| ng| ka|tun| bu|int|wil|fwi|u b|pam|lam|apo|way|ako| ic|bil|ans|uko|apa|wab|mun|ma |nya|cin|ban|tan|wal|ela|o y|ine| af|imi|lul|kap|ngw| li|ubu|e b|mas|nta| ma|ilw|ti |iti|gil|ngi|eka|imb| im|twa|e k|uma|umw|i k|tul|pat| ak|gwa|u k|ita|onk|ant|bom|usa|a s|but|eng|e p|iwa|umo|ici|o f|afu|sa |da |atu| ns| is| wa|mut|o m|nto|ont|uka|baf|ilo|min|mba|kuf|ini|u s|pok|ye |ily|men|kwi|hiw|pal|ind|ute|cak|mak|tak| at|ash|u i|lel|ina|alw|lu |asa|asu|kat|o o|aik|ubo|suk|ule|ufy|upe|e i|til|lya|pak|nam|mwi|efw|lef|ate|tek",
      emk: " ka|a k|ka | a |an |la | la| ma|kan|na |a l|a a|n k|ya |ni |ama|a m|ma |\u025B\u025B | di|lu | ja| b\u025B|ana|aka|man|di |a b|b\u025B\u025B|iya|d\u0254 |a d|ara|jam| si|a s|m\u0254\u0254| m\u0254| sa| d\u0254|en |\u0254\u0254 | t\u025B|alu|i s|da |t\u025B |sar|den|a j|riy|ila| ye|ani| k\u025B| i |i a|ye |ari| ni|n d|kak|\u025B k|\u025Bn |a t| ba| al|i d|ra |nna|len|\u0272a |aar|n m| se| bo|olo|\u0254n |sil|ele|\u0254d\u0254|n n| k\u0254|i k|ank|\u0254 a|baa|e k|a \u0272|se |bol|\u025B d|lo |u d|kel| s\u0254| na| da|n s| ke|\u0254n\u0254|fan|a f| fa| de|nda|a i|\u025B s|ade|ada|m\u025Bn|ala|i b| mi|and|\u0254 s|lak|\u025B m|\u025B y|li | ha|d\u0254n|s\u0254d|nu | ko|\u0254 b|k\u0254n|ina| su|\u025Bda|k\u025Bd| wo|han| m\u025B|kar|ko |aya|a n|\u0254 m|i m|n\u0254 |\u0254 k|\u0272\u0254\u0254|n a|ata|\u0254ya|n\u0272a|nnu| wa|n b|in |nka|k\u025B |olu|a h|i l|dan| an|mad|le | le|ran| gb|a g|u l|e m|i j|si |kun| ku|u m|\u025Bn\u025B|ii |suu|lat|enn|nad|nin|on |don| \u0272a|\u025B l|aji|\u025B b|mak|u k|yan|a w|u s|\u025Bnn|i t|sii|n t| \u0272\u0254|wo |dam| ad|awa|law|u t|\u0254nn|\u025Bd\u025B|nba|enb|b\u0254 |ibi|jib|waj|gb\u025B|\u0272in| \u0272i|o m|nan| l\u0254|f\u025B | f\u025B|b\u025Bn|din|kol|f\u025Bn|af\u025B|maf|su |usu|uus|taa|u y|e a|ta | ta|aba|\u0254r\u0254| d\u025B|d\u025B\u025B|asa|iri|mir|ba |udu|fud| fu|ini|b\u025Bd|aha|dah|du | b\u0254|\u0254 j|tan|dal|te |ida|lan|biy|ant| do| te|i w|k\u0254d|\u0272\u025B |l\u0254n|\u0254\u0254y|min|\u025B j|nal|n\u025Bn|\u0254\u0254n|aam|e b|ili|kil|nki|en\u0272| du|nni|wan|tii|was|d\u025B |a y|o s|\u025Bb\u025B|bay|ali|l\u0254 |f\u0254l| f\u0254|\u025B a|\u0254 n| t\u0254|bil| bi|e i|nfa|anf|iil|e f|\u0254 l|san|\u0254 d",
      bci: "an | \u0254 |be | be|un | i |wla|ran|kwl|la |sra| sr|in |n b| kw|n s|k\u025B | k\u025B|n k|le |a k|n n| nu| ng|l\u025B |nun| a |n i|man|n \u0254|\u025B n|n m|kun|a b|e k|i s| ku|\u025Bn |nga| su|mun| n | ti| fa| mu|su |ga |ti | ni|e n|e a|\u0254 f| li|\u025B \u0254|nin|a n|e s|a s|i n|\u0254 n|a \u0254| le|tin| at|\u0254 k|wa |ati|\u0254 l|\u025B i| s\u0254|ta |ata|fat|\u025B b| ma| m\u0254| sa|m\u0254 |s\u0254 |a a|i\u025B |akw|di | s\u025B|vle|nvl| nv|lak| kl|\u025B m|i b|i k|li\u025B|d\u025B |nd\u025B| nd|s\u025B | wu| yo|lik|\u0254 \u0254|n a| ka|\u0254 t|\u025B s| mm|e w|yo | di|i a|ba |ngb|ke | an|und|sa |a m|m\u025Bn|e t|uma| fi|ike| ju|e y| m\u025B|mla|mml|\u0254 b| ny|i i| bo| ye| si| aw| y\u025B|e m|bo |e b|fa |n f|ndi|\u0254 i|i f|e i|o n| tr|jum|\u025B a|a w|kan|i w|wie|wun|a y|n l|y\u025B |awa|\u0254 y|ge |nge|ing|u\u025B |ie |ka | f\u0254|b a| b | fl| o | wl| wi|fin|tra|klu|i m|lo | uf|a i|ang|\u0254un|f\u0254u|n t|gba| wa|ua |uwa|luw|flu|o i|b\u0254 |wuk|uan|fl\u025B|e l|ye |n y|nan|n w| ba|\u0254b\u0254|b\u0254b|\u0254 d|o \u0254|ufl|nz\u025B|anz|kpa| kp|\u025B k|al\u025B|dan| ak|e \u0254|sie|te | af| b\u0254|lun|nyi|kle|nua|u m|lu | na|u i|il\u025B|i t|z\u025B |fu\u025B|\u025B w|a t|ika|u b|\u0254 s|anm|b\u025Bn|gb\u025B| bl|ci |aci|i \u0254|n u|o m|wl\u025B|i l| bu|se | se|e f|i\u025Bn|wo | wo|bu |el\u025B| yi|afi|uka|a j|i j|ian|nma|san|u n|aka|anu|u s|a l|unm|\u0254 w|nda|ote|vot| vo|fi\u025B|e j|wan| k\u0254| ja|o b|usu|\u0254n |n j|anw|\u0254l\u025B| j\u0254|w a| w |kac|o s| ya|i y|ngu| e |u \u0254|dil|tua|yi |yan|nya|ja ",
      bum: "e a|od |an | mo|e n|mod|ne |am |se | ab|e m| me| os|ai | ai| ng| ak|ose| y | an|e e|y a| nn|le |d o|nna|a a| be| en| dz|nam|ele|ane|i n|nde|i a|n a|de |a m|i\xF1 |end| a |ie |na | na|a n|bel|abe|e d| as|nyi|ki |a b|ngu| ya| ay|ven|mve|ge |m a|ul |gul|da |li |ya | ki|asu|be | bo| e |su | et|oe |l y|i m|yi\xF1|dzi|ebe|yia|eny|ene| mv|i e|ian|ala|e b|nge|en |og | mb|ili|e y| mi|ege|bod|tob| ma|nda|ayi| at|e k|la |abo|\xF1 m|ban|bog|\xF1 a|ve |om |eti| to|bo | ny|fe | bi|e v|o a|g a|d m|fil| fi|dzo|mem|ben| se|abi| si|beb| nd|n e|woe| wo| fe| ek|zie|aye|oan| nt|emv|ia |bia|ato|e f| ad| da|ga |nga|n m|u m| ve|mbo|a e| te|ial|sie|me |ond|ug |lug|m e|obo| al|do |n b|uan|ae |n k|di |k m|e s|e\xF1 |zia|e t|d b|to | ba|alu|ako|o m|si |a s| di|oba|ma |edz|man|ama|n y|m w| vo|n n|d a|bi |aka|m y|min|\u014Dk |k\u014Dk|ak\u014D|zen|em | nk|\xF1 d|mis|tie|i b|ali|kom| es|eku| ze|ii |mam|zi\xF1| zi|ndo|o e|s a|i d|ye |a\xF1 |ake|vom|a f| ev| eb|m m|fam| fa|men|lu |ulu|\xF1 e| mf|dze|boa|gan|sog|tso|s m|is |sal|esa|ses|teg|ese|yeg|mon|u a|kua|any|ela|ad |lad|ete|und|kun|nku|uma|aku|o n|e o|bon|ui |dza|\xF3 m|\xF1 n|adi|e z|die|tii|us |ebo|meb|a d|zo |u n|med|nye|kam|l a|voe|deg|da\xF1|ol |ke |l n|yae|kya|aky|m s|eki|d e|kal|m o|te |oga|nts|i s|omo",
      epo: "aj | la|la |kaj| ka|oj |on | de|iu |raj| ra|as |ajt|de | \u0109i|a\u016D | li|j k|eco|\u0109iu|ia |jn | pr|o k|e l| al|est| a\u016D| ki| es|jto|co |kon| ko|en |tas|n k|an | en|pro| po|a p|ta |io |ere|ber|ibe|lib|j p|n a| ne| se|o d|to |aci|kiu| in|o e|a k|ajn|j l|ton| pe|do |o a|cio|j e|jta|iaj|eni|ro | ha|taj|ita|rec|lia|toj|ado|vas|hav|per| re|a a|o \u0109|sta|iuj| si|a l|stu|cia|j r|ala|n p| ri|ekt|je | je|ter|tu |nac|al |j d| di|tra|sia|ava|nta|a s| so| aj|sen| ti|ali|uj |a r|nec|int|n d|s r|ent|kto|oci|soc|por|ega|j a|n l|rim|ojn|u h|e s|s l|or |a e|u a|j \u0109|pri|ntr|ont|evi|u r|n j|re |nte|ata| fa| pl| na|ika|igi|tiu|laj|gal| eg|ra\u016D|cev|ice|ric|ne | ku|\u011Di |lan| ju|nen|j s|n s|no |era|pre| el|ian|bla|ebl|vi |tek|e a| pu|don|u s|u e|ers|art| su|i\u011Do|j n|o p|igo|ren|e p|ons|li |j i|ena|er |len|ple|n r|ote|rot|sti|s e|for|n \u0109|niu|imi|son|tat|o n|o r|u l|con|ili|duk|bor|abo|lab|edu| ed|tan|i\u011Di|ioj|is |ni |uzi|lo | ek|res|men|un |dis|e e|el | ma|erv|i e|ern|ato|\u011Do |a d|lig|go |\u0109i |coj|unu|ti |la\u016D|moj|hom| ho|kad|kun|edz| ce|\u015Dta| \u015Dt|i k|zo | ar|n i|u k|ra |kri| ag| kr|j f| vi|ura|nda|ono|rso|par|ndo|and|jur|far|ven|\u016D s|ka |eli|sek|\u0109u | \u0109u|kia|kla|ini|uka|r l|ele|rto| pa|i l|ora|edo|le | ge|l l|opr|ive|ziv|luz",
      pam: "ng |ing|ang|an | ka| pa|g k| at|ala|at | ma|g p| ki|apa|kin|lan|g m|ata|yan|pam|kar|ara|pat|tan| in| ba|pan|n a|aya|ung| a |g a|g b|rap|ama|man| ni|nin|n k|tin|ati|n i|tun|a a|iya|bal| me|ami| la| di| iy|asa| o |etu|nga|mag|met|ban|in |din|a k|nan|a i|ya |mak| na|ari| mi|kay|aka|yun|ipa| sa|sa | al|rin|a m|na |kal|ant|g s|par|ana|al |ali|ika| da|t k|san|gan|ran|lay|u m|nu |g l|un |a n|atu|kat|awa|a p|t m|ti |iti|syu|mip|ila|aba|n n|la |kas|as |ili|nsa|wa |kap|mal|ra |n d|aki|g n|t p|g i|anu|t a|tas|ans|ita|iwa|uli|i a|mil|a d|bat|sal|ira|li |una|lal| it| pr|dap|ral|ad |usa|o p|kab| an|mik|tul|e p|nte|iba|tau|be |ag |s a|aga| e |lit|mas|wan|lir| ta|abe|g e|abi|n o|n p|lip| li|lam|pro|n l|te |au |kan|g g|ap | ar|ani|alu|e k|it |sab|ale|a b|t i|eng|tek|uri|lab|ail|l a|nti|mam|i i|gaw| tu|ily|ian|liw|inu|da |g d|g t|bra|obr|u i|mba|ina|aru|abu|ie |bie|mit|am |o k|lya|pun|o a|a o|asy|gga|lub|pag|gal|bla|abl|en |len|lat| bi|pak|tur|lin|ksy|eks|ote|rot|e m|ril|sar|u a|u n|tu |gpa|agp|n m| ke| pi|ipu|ka |wal| re|ta |tik|ngg|nap|rti|art|ema|gam|ko |kia|kai|aun|d a|tad|nta|amb|a l|rus|g o| ya|lak|bus| ga|gob|dan|sas|ags|nun| nu|sak| ag|e d|a e|agl|are|bil|ndi|and| pe|iyu|rel|kul|i k|upa|isa",
      tiv: "an | u | na|nan| sh|en | a |shi|ha | i |sha|a i|or | er|er | ma|u n|n i|han|ar |n s|gh |r n|n u|a m|in |y\xF4 |n a|na |n n|hin| ha|u a|a u|a k|mba|n m|a n|nge| lu|kwa|man|n k|ana| ke| ve|r u| kw| mb| ga|ren|lu |a t|agh|ir |ga |aor|mao| y\xF4|a s|nma|anm|ang|wag| ia|gen|a a|ba |ma | ci| ng| gb|i n|ken|ere|ian| or|aa | kp|e u| ta|ve |r i|ii |gu |ngu| la|ity| he|om |a h|hen|n g|ge |la | ts|n t|e n|oo |gba|kpa|u i|ese|se |aha|cii|r m|tar|r s| ka|ol | ne|tom|u k|ugh|ish| ku|ev | it|doo|ior|n e|on |ene|u s|hi | de|n h| te|yol|oug|a v| to|igh|u t|ty\xF4|ind|i u|i d|ima|iyo|h u|paa|a l|ua |ndi|o u|him| is|r k|i m|ie |hie|tes|u e|yan|hir|ker|di |e s|uma|r a|a e| do|m u|nen|era| io|e a| ya|un | as|ne |tin|ee |mak|u h|tse|n y| za|a g| in|bar| mi|ka |i a|ron|\xF4ro| iy|men|ase|e e|de |\xF4 i|a o|nah|ave| zu|gbe|ran| ti|i v|io |u l| ik|r t|n l| ig| mk|nja|inj|eng|ant| wa|e h|mi |a d|ra |kur| ij|a y|end|hio|lun|l i|r l|av | fa|u z|h s|e i|do |ndo|i k|i i|ta |nta|ake|ash|uan|zua|u m|e m|i l|a w|ura|\xF4m |m\xF4m|vou| vo|i e|iji|e k| hi|da |nda|ghi|kig|iky|see|v s|a f|n c|was|ce |ace|mac|soo| so|r c| mt|vir|ivi|civ|zou|mzo| mz|a c|nev|ves|emb|sen|jir| m\xF4|e l|e g|i y|een|uer|lue|alu| al|u u|\xF4 u|zan| im|\xF4nd|n z|e y|em ",
      tpi: "ng |ong|lon| lo|im | ol| na|la |ela|pel| ma| yu|at |ait|gat|ri | ra|na | bi|ol |t l|it |rai| ka| o |mi |umi|bil|yum|ilo|man|t r| i |eri|ing|iga| ig|mer|ara| wa|i o|rap|tin|ta |eta|get|lge|olg| sa|wan|ap |ain|ape|nar|in |a m|ini|ant| no|i i|em |m o|g k|n o|sim|an |as |mas|i n| wo|yu |nme|anm|wok|g y| me|kai| ga|ok |tri| pa| ha|ntr|kan|g o|m n|a l| st|g s|i b|a i|g w|a k|g l|i m|g n|gut|ama|isi|o m|l n|sam|kim| in|lo |pim|aim|kam|p l|sin|amt|a s| gu|i l|tai|mti| ko|t w| la| ki|m l|en |g b|tpe|no |nog|m k|a t|utp|tap|sta|m y|nim|nap|api|g p|tu |ts |a p|nem|i y| tu|kis|lai|oga|tim|spe|isp|its|a o|a n|nka|map|nta|l i|usi|g g|o i|s b|sem|lse|ols| sk|n s|t n|m s|g t| ti|luk| lu|ni |iki|o b|sen|o l|os |et |iti|kin|dis| di|a y|asi|pas|ane|ari| pi|ili|ina|o k|aus|s i|ot |a h| ba|npe|anp|nin|aun|yet| ye|ik |lim|gti|ngt|m g|i g|pik|aik|u y|sai|kot|ut |k b|uti|aut|kau|pos|sap|un |a g|s o| ta|am |ve |ave|sav|i s|s n|t o|ank|a w| fr|ul |kul|sku|ti |m b|go | go|u n|g h|n i|ese|i w| ne|ati|vim|ivi|ali|t m|n b|gav|o n|apo|rau|n m|l m|hap|o w|oli|s l|es |les|ple|m m| em|l s|a r|m i|fri|liv|hal| si|bun|pai|dau|nsa|ins|upe| hu|g r|kom|ana|san|n r|nis|gar|aga|bag|n n| pe|m p|m w|s s|avm|uka| as|g m|g e",
      ven: "na | na| mu|a m| vh| u |ha |we |a n|wa |tsh|hu |a u|\u1E45we| ts| ya|lo |ya |ana|nga|vha|ho |o y|u\u1E45w|a v|thu|ane|mu\u1E45|shi|e n| dz|vhu| pf|elo| kh|nel|ga |a p|a t|fan|ne | zw| ng|pfa|sha|u n|uth|aho| a |a k|mut| ka| hu|a h|ele|kan|kha|o n|edz|wo |dza|zwa|la |u m|a z| mb|e u|dzi|hum|si |i n| wa|a d|mul|e a|zwi|u t|fho|ang|\u1E13o | ha|u s|o v|gan|olo|vho|ela| \u1E13o|lwa|o d|hol| i |ula|aka|o m|no |za |o k|hi |he |shu|han|o t|zo |ofh|lel|led|rel|low|u v|awe|tsi|hak| sh| ma|ka |mbo|ano|e k|yo |elw|a i|a s|bof|ngo|o i| te|nah|owo|i\u1E45w|hil|its|o h|dzo|zi |dzw|mba|lan|e m|i k|sa | mi| si|ing|one|hon|and|ush|go |isa|li |het|e v|a l|swa|ire|sir|i h|i t|a \u1E13| nd| lu|eth|umb|hat| fh|dzh| it|ine|wi |avh|khe|u k|ea |tea|unz|ni |\u1E71he|ath|ndu|hen|ila|u a|mo |wah|kon|ulo|vhe|wan|o w|u w|mis|a a|a y|i \u1E13|isw| an|iwa|hus|hel|e y| sa|alo|mbu| \u1E3Da|o\u1E71h|le |du |mus|o a|uts|ayo|tel|nda|amb|uvh| ho|vel|fun|i v|zan| ny|a w|zwo|o \u1E3D|pfu|u i|adz|hut| bv|kat|lay|hav|hit|afh| \u1E13i|evh|i m| ko| li|umi|a\u1E45w|so |fha|ene|nyi|she| o |mal| i\u1E45|n\u1E13a|mel|zhe|ivh|zit|hii|san|lis|ili|eli|ala|hul|u h|o u|ura|bul|nzo|umo|i i|mbi|haw|hin|o z|u \u1E13| th|o f|oni|lus| yo|alu|lwo|\u1E13a |an\u1E13|fhe|zhi|u d|eah|usi|a \u1E71| re|une|ite|ere|rer|hur|mbe|hal|lul|ule|thi",
      ssw: "nge|ntf|e n| le|tfu|eku| ng|a n|o l|la |lo |fu |khe| ku|nga|tsi| ne|le |unt| lo|he |mun|a l|nkh|ma |si |ele|elo|ung|nom|oma| no| um|wa |ni |ent|lel|lek|eli|lun|kut|ko |nel|gel|eni|pha| ba|onk| la|e l| em|ats|tfo|a k|e u|o n|e k|nye|hla|ela|umu|ban|oku|ulu|aka|akh|lil|won|ema|lok|lul|hul|a e|eti|ala|tse|khu|uts|ilu|i l| wo|ane|ye |nti|ndl|ang| na|ule|ve |we |esi|nek|na |ke |any|aph|ana|fo |set| li| ye| un|ale|lan|u u|hat|une|te |e b|eko|aba| ka|kwe|and|gan|lwa|ka |gen|tin|nem|phi|fan|wen|ben|mph|nal|kan|i n|ile|lal| ek|i k|gek|kel|o y|lab|ant|seb|u l|len|ahl|\u2010ke|let|e e|ako|ebe|lom|ive|be |ing|a b|kha|etf|uhl|ba |isw|kus|kho|ukh|yel|wo | kw|ikh|o k| im|uma|kat|kub|ne |ndz|sit|alo|ise|ini|omu|uph|abe|ngu|e i|alu|mal|nak|a i|kuv|sen|tis|kun|elw|lwe|e w|iph| in|fun|enk|sek|eke|dle|ti |lin|ase|a a|sa |use|hak|gab|a\u2010k|e a|les|kul|nen|kuh|ta |cal| ti|isa|tfw|ona|swa|ene|ma\u2010|hol|jen|ali|eki|bon| se|to |fol|utf|yen|ula|o e|lon|kuk|ike|liv|sel|ute|sik|lak|eng|hi |ume|kuf|alw|int|sha|nhl| ya|its|i e|fut|i a|und| bu|i u| ab|ebu|emb|dza|ndv|kil|emp|had|yak|ets|ifa|vik|emt|phe|emi|ite| si|tsa|kwa|u n|dla|a u|olo|imi|o m|han|gap|nan|ufa|ata|wem|mts|end|uvi|i w|ekh|owo|low|ind|i i|uba|mel|vum|dvo",
      nyn: "omu| om|a o| ku|tu |ntu|wa |ari| ob|ra |a k|obu|mun|uri|mu |unt|a n| mu|nga|ri | na|ho |e o|bwa|aba|rik|a e|gye|han|ga |ang|oku|a a|bur| bu|iku|re |ush|aha|iri|uga|ka |i m|ndi|sho|ain|kur|u a|we |ere|ira|ibw|ire|na |e n|ne |ine|iha|aho|ung|and|e k|ye | eb|a b|ban|eki|ing|bug| ni| ab|ba |kut|ura|uba|be |ro |u b|sa | kw|bir|ebi|u n|kwe|e b|gir| ok|i n|kir|zi |abe| bw| ah|o o|kub|i k|gab|ish|sha|era|o e| no| ai|u o|ate|tee| ek|di |rwa|ha |kuk|rin|mer|wah|kwa|i b|bwe| ba|ant|zib|u m|end|ngo|i a|ngi|bus|nib|ama|baa|kuh|iro|iki|eka|eek|i o|nar|o g|go |kug|ya |kan| ka|ngy|ana| ar|o b|agi| ti| or|hi |shi| gw|eme|ash|gan|bwo|o k|rag|uru|ute|ris|ja |mur|ora|tar| nk|she|o a|i e|oro|iba|yes|wee|tek|ara| en|bya|ija|mus| ha|kus|mwe|eir|hem| ne|obw| n |eih|rir|za | we|ekw|naa|yen|o n|uta|iho|rih|har| by|egy| er|e e|amb|da |nda|rei|gi |wen|kwi|aar|eby|rer|yam|a y|isa|yaa|nko| bi|aka|sib|aab|ind|riz|uku|irw|si |nsi|ens|iin|aij|mub|a r|ugi|oon|ata|ki |dii|nka|utu|bas|hob|aga|kor|uko|n o|eri|bye| am|amu|ika|ham|mut|umu|nok|aat|izi|uzi|o m|ebw|oba|emi| em|rim|azi|uka|rye|ona|okw|u k|e a|kum|tuu|ibi|ahu|gwa|bor|mo |aas| ya|ent|ete|u e|ori| ei|bo |ani|amw|aah| ky|uma|eer|der|nde|ugy|a z|ikw|tih|ong|yob",
      yao: "ndu|chi| wa|du |akw|aku|a m|kwe| ch|und|ni | mu|wak|mun|la |e m| ak|wa |wan|amb| ku|ulu|mbo|ali|u w|we |ila|kut|lu |bo | ma|kwa|a n|ful|ufu|le |se |a k| ni|hil|nga|ose|ete|e u|ang|jwa| jw| ga|na |kul| uf|lam|ne |amu|aka|son| na|e a| pa|oni|u j| so|ngo|wal|and|go |mwa| yi|te |wet|ana|uti|nda|yak|che|lij|gan|i a|a c|ele|cha|o s|e n|jos| ya|o c|ijo|i m|ti |pa |ga | mw|kam|ya |ula|asa|ala|ind|yin|e k|isy|ich|kas|ile|li | ka|ili|o m|ani|si |ach|u a|nam|ela|jil|ikw|a w|mul|yo |uch|aga|a u|hak|asi|kap|gal|kus|mbi|mba|mal|ma |ule|ape|o a|lan|i w|imb|pe |his| al|e w|end|a p|usi|ika|uli| ng|ope|sye|a j|aji|kum|ase|i k|ine|pen| ja|lem|him|u y|e c|mas|ka |och|ena|ekw|sya|ako|kup|a y|any|man|ane|ten|kol|hel|i y|ola|i u|wo |wam|e y| ul|kwi| kw|awo|gam|cho|gak|o n|eng|sen|pel| mp|iwa|da |gwa|sop|jo | ji|mch|ite|ama| li|ngw|hik|syo|u g|mpe|je |oso|ye |emw|ujo|duj|uwa|kuw|bom|ja |i g|mus|waj| mc|iga|tam|upi|jak|ong|dan|a s|sa |was|ole|nde|nji|ene|oma|nya|poc|ons|lo |apo|a l|i n|alo|mka|ale|one|o k|lil|uma|lic|ung|i j|ban| bo|mag|ata|usa|win|lik|hos|o g|sik|lig|lek|kan|anj|iku|pan|ing|u m|wu | aw| mm|eje|uku| yo|omb|pak|a a|he |hin|e s|esy|nag|muc|iji|lwa|mma|kal|ba |nil|uta| nd|awa|i p|ipa|no |ano",
      lvs: "as |\u012Bba|ies|tie|bas|ai |un | un| ti|s\u012Bb|es\u012B|ien|ir | ir|vie| vi| va|bu |am |\u012Bbu|iem|m i|em | ne|s u|r t|vai| uz| pa|uz |ena|\u0101s |pie| pi| iz| sa|nam|dz\u012B|\u0161an|isk|ar | ar|kvi|ikv| ik|vi\u0146|br\u012B| br|es |r\u012Bv| ka| at|u u| ci|i i|s p|cij| no|edr|in\u0101|\u0101ci|s v|i\u0146a|dr\u012B|dar|s t|u p|u a|p\u0101r| pr|i a|ot |nu |s s| la|z\u012Bb|ska| ie|aiz|jas|ija|v\u012Bb| j\u0101| ap|\u012Bb\u0101|\u012Bgi|vis|arb|t\u012Bb|gu | st|k\u0101 |s i|val|\u012Bv\u012B|\u0101m |\u012Bdz|st |ied|bai|\u012Bgu|s b|\u0146a |t p|ar\u012B|lst|als|ana|s n|gi |l\u012Bd|s l|mu |umu|kas|jum|ju |iju|kum|u i|ba |u n|izs|n p| ai|\u0101 v| da|n\u012Bg|ama|u k|u v|i v|rdz|son| t\u0101|kst|\u012Bks|r\u012Bk|ned| so|iec|s k|aj\u0101|cit|sav|l\u012Bt|st\u012B|pil|u d|t v|per| pe|b\u0101 |n\u012Bb|i n|not|st\u0101| dz|s d|m u|ras|tu |cie|n v|kat|\u0101 a|mat|en\u0101| li|evi|nev| k\u0101|kur|aut|nas| p\u0101|sk\u0101| re|a a|a v|k\u0101d|ebk|jeb| je|bez| be|j\u0101 |l\u012Bb|i u|i p|bie|tik| ta|n i|pam|mie|ard|sar|zsa|n\u0101c|iku|lik|iet|r j|b\u016Bt|rso|ers|du |ikt|sta|ci\u0101|oci|soc|c\u012Bb|tis|r\u012Bb|\u0101da|t\u012Bt|\u012Bt\u012B|gl\u012B|zgl|izg|abi|ul\u012B|aul|lau|tra|atr| l\u012B|ais|tot|atv|umi|nod|anu|t s|a u|ram|ier| ku|a p|t\u0101s|kt |kl\u0101|a s|ta |ant|i\u0101l|ma | ve|n b|n\u0101t|ekl|ret|pre|\u0101 u|lv\u0113|ilv|cil|j\u0101b|sab|eja|o\u0161i|m\u0113r|\u0101ti|ro\u0161|dro|pat|m k|kri|rie|\u016Bt |m v|\u0113t |t t|z\u012Bv|\u012Bga|a i|kar|atk|nea|ts |\u0101du|\u0101t |s m|l\u0101s|n\u0101l| na|ec\u012B|tas|i\u0123i|li\u0123|eli|rel|uma|sas| ga|s g|et |m p",
      quz: "una|an |nan|as |pas|apa|ana|cha| ka|lla|man| ru| ll|sqa|run|qa |aq | ma|ach|ta |pa |paq|npa|mi |taq|na | ch|a r|kun|hay|anp|tin|nta|nch|yta|chu|asq|chi|aku|lap|ant|qan|kuy|in |ama|aqm| wa|qmi|a a|ay | ya|ata|nap|ati|ipa|wan| ju|ina|a k|aqa| at|may| ja|a l|aqt|ayt|a m|kan|ima| pi|n k|s m|nin|ank|tap|anc|qta|his|hu |pip| mu|n j|all|a c|spa|uku|ypa|qpa|iku|yac|pi | pa|ion|uch|naq|pan|n m|a p|kam|un |han|ayp|a j|aci|nac|awa|n r|laq|s k|nma|anm|usa|aus|kau|isq|k a|n l|cio|asp|lan|n c|ayk|yan|nak|oq |yoq|ayn|inc|nat|uy |n p|yku| im|mun|jin| ji| yu|i k|has|q j|tan|inp|tuk| tu|n y|ura|kay|uyt|kus|\xF1a | na| sa|is |nmi|s t|s w| qa|mac|tun|atu|jat|asi|yni|uya|api|pac|nk | ay|kaq|tiy|waw|inm|ech| de|n t| ri|q k|a y|ma |hik|nti|sin|kas|lin|lli| al|ari|nku|juc|was|nal| aj|i m|pay|rmi|arm|war|a q|yay|yuy|q y|say|i p| ti|usq| an| as|qti|n a|npi|pap|hur|a w|rec|ere|der|ita|q c|rim|s p|aqp|s y|yqa|iyo|niy|ani|i l|unt|s j|juj|kin|iya|q a|huy|a s|ywa|nka|sap|u l|ras|int|sta|uma|kuk|piq|iqp|hak|tay| ta|qas|q r|ypi|maq| su|ash|y r|uj |qsi|lak|heq|che|min|a t| ni|yma|t a|s a| ki|uyp|q q| re|muc|nqa|cho|unc|yas|s l|ayo|y l|qha| qh|ist|pur| pu|la |ill|mas|nam|pis|isp|hap|q w|lat| si|mik|y k|y s|ayq|pat|ali",
      src: " de|de |e s| sa|os |tu | a | su|tzi|one|sa |ne |ent| in|ion| e |a s|su |der|zio|u d|ret|e d|as |ess|ere|es |men| pr| pe|et |ten|ade|etu|nte| cu|ale|er |re | so|s i|atz| te|in | un| s |ene|a p|zi |ida|e e| on|sos| es|e t|nzi|onz|are|chi| si|le |te |s d| is|dad|u s|a d|net|u a|e c|tad|sse|ame|sso|t d| ch| o |son|at |pro|e i|i p|e a|pes|e p|nt |ntu| co|na |a c|du |hi |u e| li|e o|s e|int|s a| at|sas|un |cun|nu |per| po|ter|n s|ber|ser|nes|tra|zia| di|res|ro |s c|si |adu|sta|nat|s p|unu|era|ia |t s|tos|t a|da |nal|pod|u c| re|s s|sua|ona|ica|ist|ibe|lib|rar|egu|ntr|s o|ua |a a|o s|pre|ntz|ant| ne|ust| da|ndi|una|rta| fa|ode|u p|a e| to|est|nta|a l| pa|u o|und|ra |ada|ert|iss| na|otu|con| ma|a u|ae |dae|o a|otz|dis|eru|cus|les|a i|pet|lid|ali|i s|iat|sia|u t|sot|rat|epe|s n|tot|ssi|t e|ime|unt| ca| as|a n|ind|sti|eto|st |etz|lic|ont|a b|a t|iu |fun|ta |ine|a o| se|nen|nid|suo|s f| tr|ass|e u|nda| fu|ial|ena|sen|das|ghe|e f|pen|ual|gua| eg|pri| fi|par|a f|ria|u i|for|t p|emo|seg|ner|icu|tut| no|eli|run|det|itu|dep|inn|man|tar|lu |dos|r p|art| pu| bo|cum|ina|i d|ura|u n|tes|mos|nem|gur| bi|idu|nde|cu |ata|us |o d|tic|e l|e r|cam|des|\xE8nt|din|ral|cas|uni|ios|com|u l|ado|sio|fin|nsi|n a|ire",
      rup: "ri | sh|ari|i s|hi |shi| a | ca|ti |ea |i a|tsi|rea|i c|tu | s |ndr|dre|i n|a a|ptu|ept|rep|c\xE2 | nd| un| di|la | la|i l|i u|a s| tu|ear|di |ui |lui| li|are|a l| ar|un |\xE2 s|li |caf|ati|tat|afi|lje|fi | lu|ats|ic\xE2|\xE2 t|ei |r\xE2 |b\xE2 |n\xE2 |ib\xE2|car|i t|jei|si |ali| c\xE2|tul|hib| hi|s h|t\xE2 |or |u c|n a|\xE2 c| in| cu|ul |i d|ilj| ti|\xE2 a|a p|a c|a n|lor|tea|u s| al|int| co|u a|cu |tur|ber|ibe|lib| ic|lu |i p|eas|ts\xE2|i i|u p|sea|lji|min|u l| nu|\xE2 n|nal| pi| pr|ii |url|rar|nu |sta|ots|al\xE2|ji | po|\xE2 p|sti| ts|sii| si|al |oat|can|til|ura|\xE2 l|an\xE2|its|i f|l\xE2 |nat|ina|ist|ert|s\xE2 |i m| st|sia| so|pri|\xE2 d|poa|ips| fa|sht|tut|tse| ac| ap|\xE2nd|t c|ita|nts|gur|a d|sot|ent|sh |lip| su| as|ate| lj|ur\xE2|pur| \xE2n|at |ili|uni|a i|ona|\xE2 i| de|\xE2ts|ash|zea|i e|ucr|luc|it\xE2|un\xE2| ma|act|bli| pu|nit| sc|con|tar|alt| mi|nde|ind|t\xE2t|hti|ntu|rli|ilo|ntr|par|r s|a t|apu|imi|rim|mlu| ni|com|igu|sig|rta|i b|ial| na|tic|l l|ica|est|tsl|\xE2lj|art|pse|chi|iti|unt|sun| ea|r a|adz|l s|tlu|at\xE2|ter|sit|asi|pi |apt|ia |rlo|\xE2r\xE2|f\xE2r| f\xE2|oml|uts|scu| ba|na |lit|ndu|pis|dit|gal|ega| eg|fac|s f|ru |ac\xE2|c\xE2r|ead|atl|ra | ta|ar\xE2|cul|rti|nte| cr|iil|i v|lic|ubl|pub|vre| vr|s l|cri|nom|sc\xE2|asc|nji|ire|ion|aes| ae| du|rt\xE2|idi|ini|sin|eal|uti|cru|vit",
      sco: " th|the|he |nd | an|and|al | o |ae | in|es |in |t t| ta|cht|or |tae|ich|ric| ri|ion| aw| be|is |s t|tio|ht |bod|dy |ody|s a|e a| he|e r|ent|on | co|his|hes| or| na|ati|wbo|awb|ty | fr| hi|be |e t|n t| sh|ts |sha|er |hal|nal| on|y h|ng |l b|ree|fre|ing|l a|e o|y a| pe|o t|it | ti|e s|ter|s o|air| ma|nat|for|n a|nt |il |til|aw | fo|ona|e c|ny |ony|tit|nti| a |men|ity|e w|at |d t|t o| wi|her|e f|dom|edo|eed|d f|d a|ce |con|an |e i|e e|r t|nte|ar |lit|oun| re|ic |n o|nae|t i| it|ont|sta|oci|soc| as|y i|r i|ith|ne |ane|ons|ed | di| so|ly | wa| fa| pr|y s|ers| ha| se|int|und|e g| st| de| fu| en|nce|hts|d o|o h|res|com| no|le |e h|nin|r a|ie |e p|ear|ial|r o| la|inc|ite|wi |re |ual|qua|equ| eq|ns | le|ess|ali| pu|en |per|e m|cia|as |thi|lt |elt|rit| is|d i| we|imi|din|ild|eil|nor|r h|t n|e b|tri|ntr|ir |iou|eli|ge |lan|s r|s f|ms |tel|cie| me|lea|fai|y t|hat|tha|l t|law|g a|om |y o|sec|e l|ver| tr|ds |r b|l o|iti|un |cti|dis|e d|s d|id |hei|ld |are|rou| un|omm|s c| at|ssi|war|n h|me | ac|ten|bei|t a|uni|eme|tho|rt | ga|s n|m o|hau| li|tie|g o|rni| wh|s w|rie|ern| gr|mai|tat|n n|ica|igi|age|n w|oms|s e|d s| ar|nit|ee |n f|man|arn|rk |ark|eri|ral|e u|k a|el |te |ose|pos|ak |ces|s h| ch|lic",
      tso: " ku|ku |ni |a k|hi |i n| ni|a n| a |ka |i k|wa | ya|na |ya |fan| ma|la | ti| hi|nel|iwa|a m|ane|hu |a t| sv|ela| na| ka|lo |svi|u n|mbe|nhu| \xE0 | mu|u k|a w|eli|ndz|li |vi |be |kum|ihi|umb|i l|wu |ele|elo|mun| wu|a h|a l|nfa|u l| fa|liw| va|aka|wih| wi|unh|nga|lan| nf|a s| wa|u y|u h|iku|tik| ng|i m|u t| xi|va |o y|le |i a|nu |yel|amb|e k| le|anu|han| ha|isa|ana|eni|a x|lel|ma | kh|a a| la|ga |ndl|i h| li| nt|irh| ko| \xE8 |a y|ti |ani|ta |sa |in |kwe|u a|i w|any|lek|u v|pfu| ye|van|yen|u w|i s|yi |tir|\xE0 n|and| nd|mel|e y|eke|i t|a v|n k| lo|\xE0 k|isi| kw|hin|we |ang|\xE8 k|wan|aye|ko |a f|mah|rhu|i y|end|ham|mba|u f|lul|ulu|hul|khu|kwa|nti|hla|ngo|kel| si|eka|dle|dzi|may|ule|aha|u s|u m|i \xE0|ati|thx| th|dze|nth|anh|eki|oko|eyi|u \xE0| l\xE8|mat|n w|xi |fum|vu |nye|zis|i f|thl|lok|rhi|ava|a \xE8|lak|o n|mbi|t\xE0 |mu |ke |tin|ond|o l|ngu|e n| dj|ong| mi|siw|a \xE0|vik|lwe| ts|uma|naw| t\xE0|hak|\xE8li|\xE0 m| l\xE0|xa |ume|u p|sik|gan|e a|wak|xiw|ind|u d|esv|les|ike|wey| lw|e h|awu|mha| h\xE0| ta|za |dza|i x|nyi|ths|fun|avu|wav|kot|ki |jon|djo|rha|umu|ba |sin|ha |xih|kar|lon|hxu|\xE0wu| nh|to |ung|a u|ola|kol|ali|fu |int|akw|nan|\xE0kw|gul|sun|wen|ikw|gom|kon|sva|kho|hel|sem|tse|sek| y |zen|\xEChi|l\xE0 |mi |e w|hlo|e m|exi|lex|nya",
      men: " ng|\u0254\u0254 |a n|i n|ti | gb| ti| i |i l|ngi| ma|gi |aa | nu| k\u0254|a k|ia |ma | na| ye| ta|k\u0254\u0254|\u025B\u025B |ei | a |hu |bi |gbi|a m|na | hu|a t|i y| l\u0254|u g|ya | nd|ii |i h|a h|i m|\u0254ny| k\u025B|\u025B n|nya|l\u0254n|mia| mi|\u0254 t|uu |ng\u0254|\u0254 i|ee |nga|l\u0254 |la |ao |tao| kp|i t|ye |nge|\u0254 n|i g|gaa|g\u0254 |i k| le|hou|a y|ung|ni |ind| y\u025B|e n|nuu|a l|nda| hi|umu|num|hin|mu |ugb|hug|oun|k\u025B\u025B|eng|gba|a a|maa|a i| \u0254\u0254|da |\u0254l\u0254|ahu|le |i i| sa|nd\u0254| ji|a w|\u0254ma|mah|y\u025B |e t| lo|saw|o k| va|ta |gb\u0254|u n|i w|li |va |u k|bat| ho| ya|sia|lei|ahi|e a|i j|nde|e m| ki|yei|isi| wo|kpa|d\u0254l|gbu|\u0254 k|ge |awa| gu|wei|awe|e k|ila|ani| wa| ii|ji |aho|ale|ndu|kp\u025B| ha|k\u0254l|a g|gb\u025B|wa |nah|i b|yek|ein|yil|bua|at\u025B| la| ny|t\u025B |\u025B t|kp\u0254|taa| \u025B\u025B|\u0254 s|ie |\u025B k| we|b\u0254m|kpe|ekp|hei|nun|uni|\u025Bi |u t|\u025B y|\u025Bl\u025B|gen|te |ote|wot|\u0254 g|ama|i \u025B|ul\u0254|gul|lee|k\u025B |eke|pe |tii|\u0254 y|p\u025Bl|yen|b\u025B\u025B|e y|\u025B g|\u0254le|ga |a b| t\u0254|u w|aah|baa|lek|o g|a v|bu | he|ili|kia|uvu|aal|j\u0254\u0254|aj\u0254|maj|nye| b\u025B| s\u0254|l\u0254l|ka |\u025Bmb| wi| ka|e h|iti|akp|ang|b\u025Bm| ba|u m|u \u0254| yi|\u025B i|e g|lii|uah|nuv|l\u025B\u025B|gua|y\u025Bn|s\u0254\u0254|ui | l\u025B|dei| pe|i p|mbo|uam|ong|lon|ngo|oko|lok|a p|a s|haa|i v|ula|hii|yee|yan|u a|ati|wat|hi |ke |wee|e i|u i|ew\u0254|\u0254 h|wu |ny\u025B|oi |\u0254hu|\u025B h|u y|vuu|boi|paw|\u025Bng|wie|\u025B w| ga|l\u025B |\u0254\u0254h|bla|\u025B a|\u0254li|ua |m\u025Bi|am\u025B|oma",
      fon: " e |na | na| \u0256o|\u0254n |\u0256o |nu |o n|kpo| nu| \u0254 | kp|m\u025B | m\u025B| gb| \xE9 |t\u0254n|po |do |yi | si| t\u0254| al| to|gb\u025B|w\u025B |bo |e n|\u0256e |l\u025B | l\u025B| do|lo |in | bo|e \u0256|\u025Bn |o a| w\u025B|\u025Bt\u0254|to |t\u0254 |\u0254 e|sin|o e|a n|\u025B b|ac\u025B| ac|o t|nyi| ny|\u0254 \u0256|okp|n\u0254 |ee |b\u025Bt|\u0256ok|c\u025B |\u025B \u0254|b\u0254 |an |\u025B n|a \u0256| \u0256e|\u025B \u0256|o \u0254|n e|ji |\u0254 n| b\u0254| \u01CE | en|m\u0254 | m\u0254|n b| hw|i \u0256|alo|lin|n n|\u0254 \xE9|n a|n\u025B |\u025B e|un |o \u0256|bi | bi|m\u025B\u0256| yi|i n| ye|kpl| jl| wa|\u025B\u0256e|en\u025B| ji|u e|i e| \u0256\u0254|al\u0254|a d|n m|\u0254 b|\xE9 n|nun|h\u025Bn| h\u025B|e m|e e|\u0254 m|e k|\u0256\u0254 | n\u0254|l\u0254 |\u025B \xE9|\xE9 \u0256|odo|gb\u0254|wa |n k|a y|kpa|s\u025Bn|a s|\u0256ee|\u025B k|a t|jlo|\u0254 w|\u0254 t| s\u025B|e j|k\u0254n|\u0254 g|nnu|inu|pod|b\u0254n|o g|e s|\u0254 s|un\u0254|n \u0256|\u0254 a|o s|a b|n t|hw\u025B|o j|e w|o m|i t|b\u025B |xu |ixu|six|e\u0256e|et\u0254|\u0254 k|l\u0254n|b\u01D0 | b\u01D0| we| ka|nuk|o h|n \u0254|ba |z\u0254n|uk\u0254|a m|\u025B a|n d|ma |o l|hwe|si |u k|az\u0254| az|ema|wem|ogu|tog|nm\u025B|o y|s\u0254 | s\u0254|ali|\u025B l|j\u025B |n l|ayi| ay|\u025B s|pl\u0254| z\u0254|a z|\u0256\xE8 |i k|onu|n w|u w|u a|u m|a e|hun|o b| lo|gun|n s|e \u0254|ka |dan|o d|gan| i |a g|i w|\u0256\xF3 | \u0256\xF3|n g|wu |u t|yet|\u025B g|su | su|oko|a j|\u025B w| hu|\u025Bnn|obo|u l|kw\u025B| ga|a w|i s| fi|a l| ee|pan|lee| le|\u025B t| \u025B |e b|evo|\u0256ev| wu|u g|i a| ma|\u0256i | \u0256i|ye |o w|isi|sis|z\u0254 |\u01D0 \u0256|o k|n\xFA | n\xFA| vi|ple|em\u025B|we | \u0256 |w\u025Bn| ba|o \xE9|nya| da|\u0254 h|gba|\u025B m|fi |ya |kan| j\u025B|e g|i m|jij|m\u025Bt|\u0254nu|u n|nu\u0256| e\u0256|e t|xo |\u0254 y| li|enu|wen|\u0254m\u025B",
      nhn: "aj |tla| ti| tl|ej |j t| ma|li |a t|tij|an |i t|sej|kaj|eki|uan| to| no| te|ij |j m| ua|chi| se|noj| ki|ma |ika|laj|j k|j u|pa |tle|man|aka|oj |ka |lis|ech|tek|se |uaj|ano|ise|iaj|tec|amp|iua|ali|pia|j n|och| mo|pan|mpa|a k|kua| pa|n t|is |ya | am|uel| ue|eli|ual|ili|en |len|kit|ajt|a m|jto|j s|kin|ijp|amo|ia |jki|tim| ke|mo |hi |ant|ama|ani|noc|opa|oli|aua|j i|ase|tli|nek|itl| ik|ijk|tok|nij|imo|ati|kam|jpi|tik|ipa|one|tis| o |oua|tit|ra |ara|par|nop|tl |jya|a s|iti|lal|cht|ok |ojk| ku|o t|kiu| ka|maj|kej|lak|leu|alt|ijt|mej|lau|kia|ana|ki |kij| ak|jka|n n|lam|i m|mon|e t|til|s t|nti|j a|k t|ita|kip|kem|j p|lan|jtl|tep|lti|lat|ema|uat|ose|iki| ip|ats| ni|ntl|ajy|e a|stl|ach|tou|eua|tot|kat|uam|atl|eui|toj|ni |nau|nka|ist|epa|ite|ale|pal|oka|tia|ajk|ini|j o|tsa|n m|ipi|kui|eyi|uey|jua|a i|n k|mat|nit|i n|oju|a a|onk| on|o o|uik|uil|n s|ken|ijn|ank|a n|ote|i u|i k|otl| sa|kon|as |ino|hiu|xtl|tos|its|tsi|n a|oyo|eka|chp|san|mpo|uak|ko |a u|tol|oke|yek|yol| ya|uas|pam|nok|tin|aui|htl|o k|sij|yok| me|nem|las|jke|ejy|hti|jne|nko|jti| ax|mac|emi| in|i i|mot|oui|ame|yi |lit|i a|kol|jku|sek|epe|lte|pil|nan|axt|ami|ejk|ine|int|ojt|ate|ias|ela|mel|aku|ina|uis|etl|kis|mik|ito|ui |ak | ye|ona",
      dip: " ku|en |ic | bi|bi |ku | yi| ke|yic|an | ci|aan|raa| th|c b| ka|n e|n a| eb|ci | ra|c k|\u014B y|kua|i l|i k|ka |in |th |ben|ny |ebe|kem| ek| al|eme|men| ye|k e|h\xF6m|nh\xF6| nh|\xF6m |ai |al\u025B|l\u025B\u0308|i y| lo|n k|t k|c e|thi| la| er|\u025B\u0308\u014B|\u0254c |\u0308\u014B |k\u0254c|ek |yen|ua |m k|de |t e|\u014B k|a l|ok |aci| te|n b|at |u l|ith|n t| ep| ac|k k|it |i r| lu| e |uat|ke |u k|aai|o\u014B |te |cin|ken|e y|e\u014B |ui |epi|baa|ath| l\u025B|tho|\u025B\u014B |hin|era|n c|e w| mi|a c|hii|lau|h k|ek\u0254|n y|el | ti|u t|l k|au |kek|nde|l\u025B\u014B| pa|n r|n l| et|h e|a k|u b|nhi|a t|th\xF6|pio|la |c t|e k|ot |rot| k\u0254|iny|pin|\u014B e|ak |loo| le| pi|i e|eba|\xEBk |ik |im |iim|\u014B n|oi | ro| ny| tu|kak| el|i m| k\xF6|hok|y k|pan| we| ba|i t|iic|m e|u n|ye |oc |ioc|loi|k a|lui|wic| wi|e c|and|e l|eu |pir|i p|wen|\u025Bt | l\xF6| li|mit|\xEB\u014B |eth|yit| ey|\xF6\u014B |u m|nyo| aw|e e|i b| ew|i d|den|any|iit|iek| aa|k t|uc |k\xF6u| ko|leu|ir |r e|t t|e r| dh|\xF6k |uee|tue|y b|e t|eny|uny|oo\u014B|i c|cit|u c|n w| ya|l e| ec|kic|h\xF6\u014B|ee\u014B|dhi|a p|uan|m b|ut | ak|yii|y e|ewe|wuc|awu| m\u025B|pat|i n|ien| ed|h t|uk |tii|\xF6un|lie|\u025B\u0308n|elo|am |cii|r k|t c|wel|l\xF6i| w\u025B|bai|th\xEB|u y|tha|eku| en|k c|th\u025B|h\xF6k|\u025B\u025Bt|il |hil| c\u0254|ie\u014B|cie|\xF6ny|k\xF6n|aku|m r|tic|oui|lou|ale|t a|war| wa|eka|ynh|nyn|kue|eke|eri|oth|yoo|lo\u014B|p k|up |k y|m a|y r|die",
      kde: "na | na|la |nu | va| wa|a k| ku|ila|wa |a w|unu| mu|a v|chi|mun|e n|a m|a n|van|ya |ele|ana|le | ch|amb|ave|sa |lam|asa| vi|ohe|mbo|aka|u a|was|e v|bo | n\u2019|ne |e m|ke |u v|vel| pa|ala|a u|ake| av|hil|ika|ng\u2019|ing|ngo|he |a l|ve |ile|anu|ela|vak|any| ma|vil| li|a a|go |a i|wun|uku|ili|lan|bel|mbe|ene| mw|nda|kuw|ama|nya|ola|ali|kol|kan| di|g\u2019a|au | au|emb|den|eng|lik|uni|wak|a d|\u2019an|e a|lem|ong|o v|ulu|kuk|an\u2019| ak|ach|a p|kal|ma |dya|n\u2019n|lew|mad|aya|and|mwa|uwu|kum|ye |a c| vy|apa|va |ava|ane|hel|mbi|kut|o m|hi |we |ula|ole|u m|umi|din|ton|ji |nji|nil|ewa| il|voh|ade|und|ni |kul|dye|dan|kay|uko|idy|kav|tuk|nan|kam|ka |ia |lia|eli| dy| in|ndo|ond|hin| la|uva| ul|ani|vya|i n|o n|wen|mwe|da |e k|e u|o c|lel|pal|nje|yik|aha|uwa|lil|n\u2019t|nga|ata| ka|she|pan|cho|ang|no |u i|lon|ulo|lim|uli|\u2019ch|dil|hev|i w|u l|e w|mba|niw|mil|ba |yoh|uma| um| kw|u n|wal|vin|vyo| an|bi |a s| ya|dol|hoh|u c|awa|lin| al|ilo|\u2019ni|e p|ale|n\u2019c|mu |imu|lun|kup|yak|yac|\u2019ma|n\u2019m|mah|atu|wav|kuv|hon| lu|i v|hih|jel|utu|hap|uka|o l|u w|itu|ga |o a|i d|umb|a y|inj|taw|ita|lit|lek|val|e c|oko|aku|me |bu |paw|kuy|mak|e i|yen|iho|amw|woh| ih|iku|pil|kun|onj|tul|nah|awu|ahe|i a|kat|mat| wu|pac|ina|olo|uto|ech|kwa|i c|li |ngi",
      kbp: "aa | pa|se | se|na |n\u025B | n\u025B| wa| y\u0254|y\u028A |\u0256\u025B |a\u0256\u025B|a w|\u025Bw\u025B|\u025Bna|\u025B s|\u0269 \u025B|paa|a \u025B| \u025By| \u025Bw| \u025B |\u025B p|e \u025B|wa\u0256|\u025B \u025B|e p|a p|w\u025Bn| p\u0269|y\u0254 |y\u0269 |a\u0263 |\u025By\u028A|\u0254\u0254 |\u028A\u028A | ta|ala|y\u0254\u0254|y\u025B |\u0254 p|a n| \u0269 |yaa|taa|\u028A n|a a|\u028A \u025B| t\u0254|\u028A w|z\u0269 |la |w\u025B\u025B|n\u0269 | an|\u025B t| k\u0269|an\u0269|\u025B y|ma\u0263|\u025B n|n\u0254\u0254| n\u0254|\u025By\u0269|\u0254m |t\u0254m|\u0269 t| we| p\u028A|\u0269 p|\u025B \u0256|\u0269\u0263 | \u014Bg|ama|kpa|a t|\u0269y\u025B|ay\u0269|a k| t\u028A| k\u028A| p\u0254|daa| w\u025B|pa |\u028A t|\u028A p|t\u028A |\u028A y| \u025Bs|wal| p\u025B| na|\u0254\u0254y| ya|f\u025By| \u0256\u0269|\u0256\u0269 |\u0254\u0256\u0254|\u0254 \u025B| \u025Bl|i \u025B|\u0269 \u0256|w\u025B |\u025B k|\u025B\u025B | t\u0269|\u0269 n|pa\u0263|\u0269 s|\u025Bja| \u025Bj|\u0256\u0254 | \u0256\u0254|\u0254 s|\u025Bla| \u025Bk|a s| mb|\u0269 y|\u025Bya|pal|a y|\u028Ama|\u0254y\u028A|a \u0269|ja\u0256|\u0256\u0254\u0256|kpe|\u0269z\u0269|\u0269na| \xF1\u0269|yi |eyi|k\u025B |b\u028A |mb\u028A|\u028A k|m\u0269y|t\u028Am|al\u0269|\u014Bgb|\u025Bz\u0269| fa|\u028Ay\u028A|\u0269 \u0269|\u0269f\u025B| \u025Bt|k\u0269 |wey|ma |l\u0269 |\u0254\u0254l|nda|\u0269ma|gb\u025B|sam| sa|li | l\u025B|\u0269s\u0269|akp|pak|\u0263t\u028A|ya |lab|s\u0269 |\u014B p|p\u0269f|day|and|kan|\u0263 \u025B|s\u0254\u0254| ye|\u0269m |k\u0269m| kp|uli|kul|\u025By\u025B|\u028Am\u0269|laa|iya|\u0269 k|e e| \u0256o|\u028A s| ha|a\u028A |ma\u028A| \u0256e|a\u0263t|\u0254 k|\u0254 y|a l| ke|p\u0269z|\u014Bg\u028A|\u0263 p| k\u025B|eki|\u0254\u014B |a\u014B |t\u0269 |\u025Bh\u025B|b\u025By|\u028A \u014B|p\u028A |ba | s\u0254| \u025Bd|n\u028Am| n\u028A| pe|\u0256\u028A |ada|pad|\u0263na|le | le|\u028A \u0256|\xF1\u0269n|pe |z\u0269\u0263|\u025Bp\u0269|naa|g\u028A |\xF1\u0269m|\u0263 t|a \xF1| la|hal|\u025Bda| \u025B\u0256|nd\u028A|m n|z\u028A\u028A|\u0256e |ana|ak\u0269|b\u0269 |ab\u0269|l\u025B |\u025B\u025Bn|m t|\u0254y\u0254|ekp| \u025Bp|d\u028A |t\u0269\u014B|\u025Bk\u025B|\u0256am| \u0256a|ina|ma\u014B|al\u028A|uku|suk| su|k\u028A |\u025Bs\u0254|\u025Bt\u0269|lal|\u025B l|t\u025B |e l|l\u028A | k\u0254|\u0269l\u0269|\u025B\u025Bk|i p|pan| t\u025B|\u014B\u014B |aka|p\u0269w|b\u028Ay|ab\u028A|nab|lak|ee |yee|e w|\u028Ana|m p|e t|ye |iye|uu |a \u0256|n\u0256\u0269| n\u0256|d\u0269 |eek|pee|ga |\u014Bga|ya\u0263|a m",
      tem: "a \u028C|uni| \u0254 |ni |wun| wu| t\u0259|yi | ka| yi| \u028C\u014B|ka | k\u0259| k\u028C|t\u0259k|k\u0259 |\u0254\u014B |\u0259k\u0259| a\u014B|mar|n\u025B | \u028Cm|ma |i t| th|ri | \u0254w| a |i k|a k| ma|i m|ari| ba|wa |tha| k\u0254| m\u028C|\u0254wa|th\u0254|ba |\u0254m | o |l\u0254m|\u028Cma|k\u0254 |i \u0254|a y|\u2010e |o w|\u014B k|a a|al\u0254|te |i o|hal|\u0254 b|a\u014B |\u0254 y|a m|\u014Bth|\u014B y| r\u028C| \u028Ct| m\u0259|kom|ema|yem|m\u028C |\u0254 k|om | ye|h\u0254f|\u0254f | m\u0254|th |e \u0254|\u025B t|\u028Cn\u025B| \u014Ba| s\u0254| gb| ro|\u028C\u014Bt|\u0254 t|\u028Cth|a \u0254|ar |y\u025B |\u028Cte|m k|\u028C\u014B |m \u028C|h\u0254 |ank|wan|\u014Ba |an\u025B|\u014B \u0254|\u014B\u0254\u014B| \u014B\u0254|nko|r\u028Cw|k\u028Cm|ki |k\u0259t| y\u025B| te|a t|\u028Cwa|\u0254 \u028C|\u028Cm\u028C|e a|k\u028Ct|thi|i r|\u0259m |ra |k\u0259l|a w|\u0259 k| y\u0254|\u028Cme|me |a r|m\u0254 |k\u0259p|a\u014Bf|\u0259\u014B |e t|pa |\u0259th|f\u0259m|a\u2010e|\u0259l\u0259|l\u0259\u014B|\u025B k|\u028C k|\u014Be |y\u0254 |ro |r\u028C |\u0254 m|gba|th\u0259|\u014Bf\u0259|li |\u0259 b| \u028Ck|\u0259 t| r\u0259|m r|\u025B \u028C|i \u028C|\u028C\u014Be|ta | ta|e m|bot|\u0259pa|n\u028Cn|m a|ma\u2010|s\u0254\u014B|k\u0259s|e w| ra|t\u0259m|\u014B t| t\u028C|ath|gb\u0259|\u028Ck\u0259|\u0259 s|\u025Bth|\u0254 a| bo|i a|\u014B a|\u014B b|\u025B \u014B| b\u025B|\u028Cr\u028C|nth|ant|\u0259li|b\u0259l|o \u0254|\u0254k\u0254| p\u0259| t\u0254|\u0259s |e y|kar|nka|ran|r k|\u028Cl\u0259|\u0259yi|m t|\u0259 y|s\u0254 |\u0254 \u0254|\u014Bgb|t\u028C\u014B|\u0254th|s\u0254t|m\u028Cy|t k|ot |ith|\u025B m|t\u0254\u014B|t\u0259t|l\u0259s|m\u0254\u014B|r\u0259k|\u0254 r|th\u025B| po|t\u0259 |wop| wo|gb\u028C|f \u028C|\u028Cyi|\u028C \u028C|e k|\u025B a|m\u028Cs|\u0259 g|\u0259n\u028C|h\u0259n|b\u025B |ara|pan|hit| \u028Cr|k\u0254\u014B|a \u025B| wa|iki|\u0254 g|to | to|l\u0254k|o t|\u025B r|e\u014B |m\u028Cl|gb\u025B|\u028Cgb|hi |pi |tho|m\u0259 |\u014B\u028Cn|\u0259r |o\u014B |ro\u014B|m \u014B|h\u025B |po |i\u2010e|m\u028Ct|\u028C t|\u028Cy |ti |\u2010o |f \u014B|op |\u0254 w|na |sh\u0254|nsh|ekr|sek|\u028Cse|a\u014Bk|bas|m\u0259t|ra\u014B|k\u028Cr|\u028Ct\u028C|wat| \u025Bm|h k|i y|han|\u0259k | ya|k\u0259b|k\u0254n|yik|ayi|yir|p\u0259y|\u028C \u0254|\u025B\u014B |\u0259te",
      toi: " ku|a k|wa |a m| mu|la |e k|a a|ula|ali|ya |i a|de |ang|aku|tu |kwa|aan|ntu|na |lim| al|ulu|lwa|mun|ngu|luk|ele|gul|mwi|wi |gwa|kub|imw|ons| oo|oon|se |nse|ant|zyi|unt|ela|si | ak| ba| an|and|a b|ala| ci|uki|isi|nyi|ide|kid|zya| lw|ba | kw|uny|eel|laa| ul|cis|yin|kun|uli| zy| ka|tel|nte|ina|kul|kuk| ma|ili|waa|uba|wee|kwe|ede|led|nda|we |mul|nga|kus|da |izy|kut|wab|ana|i m| ya|ukw|o k|amb|yan|ka |e a|lil| bu| am|uci|a l|ilw|a c|li |sal|ban|e m|e u|u o|ila|bwa|aka|bo |bul|akw|wak|ale|kal|o a|i k|amu|bil|umi|bel|mbu|lan|usa|egw|abi|lo |awo|kuy|kup|igw|ko |uko|kak|wo |law|aci|i b|u b|ati|o l|yig|asy|ubu|wii|ika| bw|le | mb|ga |ung|kum|kka|ku |ndi|aam|muk|cit|mal|bun|yo |ukk|ind| wa|i c|bi |aya|ne |ene|len|mo | ab|upe|a n|mbi|eya|kuc| lu|ndu|a y|syi|u z|uta|ile|abo|u a|a z|ita|uka|aba|bal|imo|ley|iin|yi |ti |u u|lik|du |asi|yak|o y|u k|ube|iko|cik|zum|muc|ani|ule|mil| mi|mbo|twa|e b|umu|was|di |o n|ngw|lwe|nzy|peg|zye|abu|buk|kwi|liz| nk|i n|bam|ta |kab|alw|eka|mas|u m|imb|onz|kon|sya|miz|gan|tal| we|uum|no |yil|int|lem|del|nde|end|mbe|uya|oba|azy|iyo|i z|lek| ng|o o|cii|i o|a u|mba|mu |a o|ako|yik|yeg|ezy|a w|mi |ni |omb|kom|o b|syo|iya|usi|min| ca|e c|aul|lau|uku| aa|yee|ama|yal|kam",
      ekk: "sel|le |se |ja | ja|use|ise|mis|\xF5ig| va|ele|ste|ust|gus|us |igu|st | v\xF5| \xF5i|dus| on|on |el |te |ma |al |iga|v\xF5i|a v| in|nim|ini|da |e j| te|ist| ig|ime|l o|lik|mes|e k|\xF5i |est| ko|l i| ka|end|iku|ese|adu|gal| se|e v|tus|lt |ami|n \xF5|ema|aba|vab|a k| ra|lis|val|a i|atu| ku|tsi|ud | mi|ada|ali|e t| ta|ta |stu|ast|ks |ole|tam|sta|nda|es |ell|tes| pe|e s|ik |a t|is |i v|ahe|rah|t v|ava|bad|kul|ine|ne |t k|vah|ei | ei|e e|ga | ol|lus|kon|s v|ida|s t|gi |a r|mat|ioo|tud|tel|kus|oma| om|dse|k\xF5i|teg|ees|i t|aal|ndu|a s|a j|ing|a a|iel|s k|vas|tse| ee|tem|ul |igi|lle|s s|i s|ili|vus|uta|elt| sa|aja|e a|eks|min|its|asu|a p|s o|sus|sli|i m|oni|oon|sio|ses|e o|ete|abi|\xFChi|ega| ki|ari|emi|si |i e| ke|uma| ri|usl|ahv|ats|eva|lev|ab |pea|eis|nis|rds|\xF5rd|v\xF5r|sed| k\xF5|t\xF6\xF6| ni| ab| \xFCh|rid|nna|saa|teo|sek|ni |kor|ale|imi|ait|t i|sik|isi|eli|e \xF5|dis|ots| so|ata|lem|eab|\xFCks|tum|dam| m\xF5|a o|\xF5ik|idu|har| t\xF6|e h|nin|alt|onn|ite|ult|e m|mal|isk|kai|ead|sea|koh|d k|as |jal|p\xF5h| p\xF5|aks|rit|hvu|dum|een|e p| \xFCk|s j|set|ed |ng |bie|a \xFC|uri|s a|kin|ald|e r|t m|eri|i k| al|eel|lli|eta|dad|ule|elu|s p|i p|rii|hel| to|ndi|lse|als|iaa|sia|sot|rat|ara| k\xE4| ve|and|umi| su|de |etu| v\xE4|na | s\xFC| ha|a m|e i|lit|lu |per|nud",
      snk: "an | a |na | na|re |a n| su| ga|a k|ga | ka|a a|en |su | se|a s|ta |ma |e s| ta|ser|ere|ama| i |aan| ra|un |nta| ma|n s|do | ki| ja|a g|jam|ne |nan| do| nt|ana| da| ya|ane|wa |\u014Ba |n \u014B|ri |e k|u k|a d| \u014Ba|ndi|ni |ra |raa| ku|taq|maa| si| ba|a r|tan| ke|aaw| sa|ren|gan|and|a b| be|a i|awa|di |i s|oxo|aqu|oro|kit|me |lli| go|tta|ini|ya |a j|ari|a m| xa|iri|aar|oll|gol|a t|e m|i a|i k|xo |sir|n d|aax|lle|a y|be |on |baa|n g|ran|din|ara|u r|e d|u n|qu | so|axu|are|o a|a f|ke | wa| ko| an|man|xar|dan|kan|ron|sor|li |de |nu |fo | fo| no|kuu|n t|pa |nde|n k|i g|len| \xF1a| du|n n|nme|aad|u b|ang|axa|e y| fa| mo|ppa|app|kap|o k|o s| fe|ell|a x|att|kat|ure|i x|xun|e n|aba|mox|ti |i t|n y|yan|enm|ada|n f| bo|n b|a \xF1| yi|i m|u t| di|da |iti|qun|nga|u a|xu |itt| ha|le |i d|sel|i n| me|ill|e t|riy|o b|ro |u d|du |saa| re|dam|haa|ind|xa |n x|ono|i i|nen|lla| mu|ond| ro|o n|udo|uud|ant|aga|ku |la | wu|nma|eye| tu|edd|fed|nox|no |o d|uur|sar|gu |e g|kil|\xF1aa|ire| bi|inm|ken|e b|tey|ite|ira|yu |a w|ina|iin|yi | xo|n w|o t|taa|ka |u s|an\u014B|uga|und|i r|ore|bur|i b|fan|iba|xib| xi|een|u m|ogu|bog|bag|oqu|noq|oor|e r|bir| ti|i j|ban|ye |dii|o m|anm|ene|kka| ye|\xF1a |rey| le|i\xF1a|ita|mun|ura|kaf|ank|e i|li\u014B| li",
      cjk: " ku|a k|yi |nyi| ny|la | ci|a n|a c|wa |we | mu| ha|nga|i k|ga |ana|uli|kul|a m|esw|ela|ze |mwe| ka|ha |sa |tel|a h|swe|ung|ci |a u|ate|ma | wa|u m|kwa|han|e m|kut| mw|uci|mbu|mut|nji|nat|ya |uth|e k|na |pwa|kup|thu| ma|wes| ca|ji |kan| ya|lit|hu |i m|aku|asa|i n|mu | ul|ca |ang|e a|ina|anj|ali|imb|cip|amb|mba|i c|li |e n|i u|ka |muk|a i|awa|naw| na|fuc|ifu|uta|upw|ing|ize|ula|lin| xi|ukw|lim|ong| kw| an|ite|xim|ta |ita|umw|ulo|umu|has|kuh|kha|u c|ala|nge| mb|wo |ila| ce|cif|a a|kus|ama|tam|mwi|ili|te |imw|bu |o k| ng|ba |ipw|lo |bun|ikh|wik|ulu|mo |ufu| ak|o m|utu|ngu|imo|mil| mi|ko |a w|kun|ciz|i y|a y|kuk|eny|aze|aci|pwe|aka|o n|yum|uha|uka|e w|o y|lon|kum|e u|cim|ku |swa|e h|e c|mbi|emu|no |nal|a x|was|fun| un|uma| ja|usa| li|wil|uze| ye|o w|isa|o c|nda|ngi| es|kat|e y| in|aha|waz|yul|esa|yes|una|wen|aco|i h|cik|ema|pem|nyu|ika|kal|bi | ik|mah|zan|aso|so | uf|ata| iz|apw|tum|tal|o l|wam|iku|sak|ja | up|kwo|umb|oze|yoz|uni|ges|cen|kuz|wak|mul|wan|ulw|o u|cyu| cy|u i|e i|tan|mun| um|kuc|ngw|cin|co |go |ngo|da |ipe|ge |lem| uk| yo|lwi|nin|ikw|u k|kuf|uso|i w|upi|lum|gwe|uki|upu|and|pha|ces|ond|i j|man|ile|ule|uku|gik|akw|ino|ele| if|hac|tha|cil|eka|za |vul|uvu|hel|lu | it|ke |lya",
      ada: "mi | e |n\u025B | n\u0254| n\u025B|n\u0254 | he|he |\u0254 n| a | ng|e n|a n|k\u025B | k\u025B|aa |\u025B e|bl\u0254| bl|i k|i n|g\u025B |ng\u025B|\u025B n|l\u0254 |e b| mi| ma| ko|\u025B h| ts|ko |\u025B a|e h| ni|hi |\u025B\u025B |\u0254 k|a m|i h| \u0254 |tsu|ma |ami|a k| ny|\u0254 f|oo |loo|i a| be|ya |e m|be |ni | kp|o n| si|si |nya|emi|\u025B m|f\u025B\u025B| f\u025B|laa|a h|a b|e j|a t| hi|e k|umi| ka|kpa| je|\u0254 h|e s| lo| ye|\u0254 e|i t|pee|omi|m\u025B | pe|mla|i m| wo|je | ha|\u0254mi|\u0254 m|maa|sum|ke |i b|o e|\u025B k|\u0254 t|alo| ml|ee | sa|\u025B \u0254|\u0254\u0254 |ha | na|l\u025B | l\u025B|a a|i l|\u0254\u0301 |a s|\u025B s| h\u025B| gb| su|n\u0254\u0301|e p| al|e\u0254 |\u025B b|ne |i s|\u025Bmi| fa|uaa|sua| b\u0254|\u0254 a| to| ji|o k|kaa|b\u0254 |a e|ihi|u n|e \u0254|o a|yem|ane|e w|su\u0254|imi|e y| ke|\u025B y|\u025B t| hu|san| we| j\u0254|\u0254hi|l\u0254h|e e|ahi|i j| bu|\u025B j|pa | ja| ku|wom|ng\u0254|a j|him| bi|ue |e a| ya|tom|\u0254 b|gba|o m|jam|\u0301 k|fa |ake|\u025B p|uu |ba |hla| hl|sa |\u0254 s|hu |e f|h\u025B\u025B|u\u0254 | tu|e t|ji |ts\u0254|j\u0254m|i \u0254|kuu|kak|\u025B g|a l|wo | s\u0254|tue|o h| gu|isi|\u0254 y|s\u025B |o b|s\u0254\u0254|g\u0254 |ia | ju| k\u0254|eem|e l|akp|pak|li |e g|s\u0254s|a p|u\u025B | yi|ti |sis| s\u025B|to |\u0254 l|\u0254 w|\u025B w|y\u025Bm|na |hia| nu|\u0254s\u0254|ye | m\u025B|sem|ase|kas|hi\u0254|naa|\xEDhi|n\xEDh| n\xED|kpe|usu|uam|on\u025B|kon|nih|ee\u0254|mah|o l|a w|lam|\u0254\u025B |s\u0254\u025B| pu|h\u025B | ba|gu |a g|a y|\u025Bti|p\u025Bt|kp\u025B|o s| f\u0254|bi |nyu|o j|we |se |uo |suo|ade| ad|bua|su |ngm| fi|i\u0254 |u k|haa|o\u0254 |koj| am|\u0254 \u0254|\u025Bp\u025B|i p|i e|gu\u025B| wa|io |jio|bam|\u0254 j|yo ",
      quy: "chi|nch|hik|anc| ka|una|man|aq |pas|ana|kun|as |paq|nan|kan|ikp|cha|sqa|qa |ik |apa|aku|ech|kpa| de|cho|rec|ere|der|spa| ma|asq|am |an |taq|pa |nam| ru| ch|yoq|ta |na |a k|ina|mi |qan|ima| ll|aqa|lli|oyo|hoy|ant|ach|run|nap| im|pi |nak|hay|asp|ayn|wan|q k|ipa|nta|hin|oq |cio| hi|iw |liw|inc|ion|aci|chu|lla|pip|nas|npa|nin|qmi|kay|kas|ota|a m|anp| hu|all|nac| na|yna| ya|ari|api|i k|w r|nku|iku|in |a c|ama| pi|may|hu |kuy|ay |nma|has|onc|hon| ot| wa|aqm|anm|a p|n h|ata| li|ikm|hwa|chw|ma |awa|a d|qta|ara|pan|m d|pap|yku|yni|a l|kma|q l|ich|kin|huk|a r| ha|yan|uwa| ca|nqa|kta|ikt|q m|a i|n k|kpi|mun| sa|cas|usp|q h|wsa|aws|kaw|bre|ibr|lib|lin| al|k c| mu|ask|kus|a h|s l|ank|q d|yta|e k|tap|q c|mpa|pak|ski|qaq|ien|i c| qa|tin|re |nni|uch|isq|a s|was|ern|s m|a a|ayk|onn|s y|oqm|aqt|ruw|qpa|aqp|par|amp| am|nmi|ley| le|ayp|nat|i h|yma|onk|law|ier|map|a f|war|ita| ni|naq|yac|tar|naw|ayt|sak|n a|anq| pa|a q|aya|val| va|ypi|sti|ast|ura|n c|m p|s o|w n|rno|bie|obi|gob| go|rma|qar|nit|m i| ta|say|haw|s i|k l|asa|k h|rur|pun|wac|onm|tan| fa|tam|kap|oqt|i d|s c|ici| ju|a t|ras|ran|uy |uku| tu|qay|k k|ku |q i|arm|uk |a y|nti|awk|um |igu|esq|k m|sap|ati|aw |a o|asi|n p|sic|isp|aru|ukl|ten|pti|qku",
      rmn: "aj | te|te |en | sa| le|el | si|si |aka|sar|pen|les|kaj|es |ipe|sav|qe |j t| ha| th|ja |hak| e |and| o |ave|i l|ar |ta |esq| an|a s|sqe| ma| ja|ia |nas| ta|imn|e t|as |mna|kas|e s|haj|tha|s s|ark|asq|e a|nd |i t|s h|rka| na| i | pe|mes|isa|vel|cia| bi|ne |bar|kan| aj| me|avo|utn|the|e k|lo |o s|est|qo |e p|n s|ard|hem|a a| av| so| ba| pr|\xF5l |a t|mat|ima|l p|e r|e m|e o| ka|man|orr|e d| di|o t|rel|sqo|re | ov|ika| re|qi | ak|enq|ere|vor|e b|res|ove|avi|ve |ver|o a|n t|o m|akh|rak|rim|a p|no |ana| ra|sti|d o|len|aja|rre|but| va|sqi|ker|r s|de |ata|ren|ali|ara|ste|ti |e l|r t|vip| ke|na |i s|ang|\xE0ci|tim|nqe|kon| ph|n a|nip| de|j b|\xE0lo|al | pa| bu|are|vi |d\xF5l| ni|tar| ko|na\u015B| pu|o k|n n|l a| po|\u015Baj| \u015Ba|on |lim|er |ari|i a|ven|pe |\u015Bti|a\u015Bt|a l|o p|e n|dik|rd\xF5|nik|l s|tis|ast|tne|a m|a e|erd|ndi|ni |pes|rin|j s|e h|aba|rab|khe|tni|eme|uti|rip|uj |amu|ano|\u0107ar|a j|\u0107a |la |khl|l t|e z|do |o z|ri |mut|kri|alo|soc|i p|so |ran|del|kar|nu\u015B|anu|pra|din|nge|nis|ut\u0103|rde|vo |muj|mam|i d|n\u0107a|en\u0107|ate|uni| as|iko| zi|rdo|l o|j p|eri|emu|ane|i b|o j|oci|i r|a d|ing| je|i\xE0l|e e|l l|\u0275ar| za|tes|\u0107ha|pal| vi|l b|\u0275e |l e|a\u0107a|one|kin|to |ziv|imi|a n|per|ter|ris| kr|s a| st|o b| \u0107h|a i|kla|da |nda|e j|ekh|jek",
      bin: "e o|ne | ne|an |en |be | o |e e|wan|mwa|n n|vbe|mwe|emw|evb|na |omw|e n| em|in | na|ie |gha|n e| gh|re | om|wen|e a|ha | ke|e i|n o|gie|bo | vb|wee| kh|win| ir|vbo| ev|o n|gbe|he |hia|nmw|o r|a r|o k| no|ogi|nog|kev|tin|eti| et| mw|e u|mwi|a g|ra | ya|een|ee |a n|a o|ke | re| we|rri|ghe|ogh| og|a e|n k| a |ia |ya |o g|ien| uh| rr|ye |khi|ran|ira|ere|a m|a k|ian| ot|ro |n i|ovb|o m| ye|egb| ra|hi |de |kpa| eg| hi|n y|o e|hae| ok|a y|eke|mie| mi| gb|o y|ba |oto|rhi|n m| iw| ru| er|arr| ar|unm|rro| ov|e k|okp|aen|n a|hek|khe|nna|inn|ugi|hie|a u|ru |ae |to |wun|mwu|hun|otu|i k|i n|a v|nde|and| do| or|uem|rue|dom|n w|oba|iob|rio|e r|tu |ze |ehe|pa |e v| ma|aya|iru|iwi|ma | rh|un |uhu|yan|mo |gba|e y|o h| la|a i|rie|irr|ai |uhi|ho |u o|ren|yi | ni|egh|u e|u a| ug|ugh| al| iy|beh|aan|a d|n g|gho|ue |onm|ghi|anm|iko| ai|ene|i r|a a|aze| az|khu|i e|bi |vbi| i |yaa| yi| ek|hin|bie|on | ay|emo| od|aro|obo|e d|rov|o w|e g|ii |nii|se |kom| ow|ron|kha|o v| se|a s|rre| de|lug|alu|owa|wu |a w|aa |e w| bi|a b|n h|dia|fue|ifu| if|ebe| eb|ode|sa | os|nug|anu|wa |oo |gue|uwu| uw|ese|bug|vbu| en|n r| lo|n l|ugb|kug|la |uyi| uy|i v|o o|i g|rra|aku| ab| es|abe|aik|oro|enr| eh|eha|o a|a l|we |n u|i o|okh",
      gaa: "m\u0254 | ni|ni |k\u025B | ak|l\u025B |\u025B a|\u025B m| m\u0254|ak\u025B| ko| he|gb\u025B|i a|\u025B\u025B | l\u025B|\u0254 n|\u025B e|ko |aa |b\u025B |y\u025B |i e| k\u025B|\u0254 k| y\u025B|li |\u025B h| ml|egb|oo |f\u025B\u025B| f\u025B|shi|a\u014B |heg|mli|\u0254\u0254 |a a| es| gb|i n|loo|\u025B n|ma\u014B| ma|\u025B k|i k| n\u0254|\u0254 y|n\u0254 |\u0254 f| al|he |esa| sh|alo| ek|\u0254 m|ii |am\u0254| eh| en|em\u0254|ji |naa|b\u0254 |e n|fee|o a|oni|kon|o n|ee | hu|o e| b\u0254|i m|hi | am|\u0254 l|hu |tsu|um\u0254|\u025Bi |aaa|na |nii|sum|sa |\u0254m\u0254|ena|i y|\u025Bji|n\u025B\u025B| n\u025B|\u025B g|baa|eem|\u0254 e|a l|kw\u025B|y\u0254\u0254|e\u0254 |am\u025B|ts\u0254| sa|ana| ts|saa|k\u025Bj|\u0254 a|ehe|a m|toi|eli|yel|aji|i l| ah|m\u025Bi| at|e e|gba|a n| an|ane|hi\u025B| na|eko|eye| ey|o h|kom|mla| kr| ej| as|\u014B n|san| ay|i s|nit|ash|ek\u025B|ha |e k|ne | hi|i h|\u025B t|esh|efe|i\u0254 |its|ia\u014B|ku |o k|ats|kpa| kp|ome|gb\u0254|ets| ab|\u0254 b|\u025B b|ye | et|a e|shw|oko|a k| b\u025B|\u0254 h|\u025B y| af| ku|s\u025B |ts\u025B|\u014B h|u\u0254 |\u014B\u014B | to|\u014Bm\u025B|\u025B s| m\u025B|oi |m\u0254\u0254|aye|hwe| ef|la |ehi|rok|kro| ji|\u014B k|o m|aka|akw|o y| lo|o s|j\u025B | ny|e a|\u014Bm\u0254| ba|bii|aan|\u014Bts|\u025B\u014Bt|i\u025B\u014B|di\u025B| di|ai |u k|o l|\u014B m| eb|\u0254 s|aha|ny\u0254|i j|a h|\u025B l|w\u025B |usu| aw| ja|su\u0254|eni|i f|agb| ag|b\u0254m|sem|bua|any|\u025B d|i b|maj|m\u025Bb|a s|e\u014Bm|awo|e b|afe|hik| yi|u e|e s|ish|nak|an\u0254|hey|\u014B a|o g|jam|u m|o b|a\u014Bm| y\u0254|b\u025Bi|ye\u0254| su|ny\u025B|hew|me |\u0254 g|\u0254se| ee|il\u025B|hil|ihi|hih|las|\u0303la|a\u0303l|ba\u0303| \u014Bm|nyo|te |esu|kai|ate|\u014Bma|eee|\u025Bm\u0254|\u025Bia| eg|al\u025B|jia|\u0254\u014B |ala|wal|hi\u0254|\u025B f|his",
      ndo: "na |oku| na|wa |a o|a n| om| uu| ok|e o|ong|ka |uth|mba| ne|ntu|ba |tu |omu|nge|he |a u|the|uut|emb|hem|o o|o n|ehe|unt|e n|a w|nga|kal| wo| ke|ang| iy|lon|mun|no |lo |la |o i|ku | no|oka|keh|ulu|u n|we |shi|a m|ala|ko |ga |a k|ge |eng|nen|u k|ilo|osh|ngo|han|a y|elo|gwa|ngu|ye |li |ano|hil| mo|gul|ana|luk|a e|tha|dhi|uka| pa|lwa|go |ath|ho |man|kwa|ta |oma| sh|a p|wan|thi|uko| ko|wok| ta|ha |mwe|ya |wo |e p| yo|gel|a i|e m| os|nka|ika|uun|hi | ka|o g|sho|ema| li|kuk|iya|o w|i n|ith|and|men|ame|gam|ele|pan|opa|ash|ndj|po |hik|yom| po|le |ing|alo| el|olo|sha|kul|nok|ilw|kug|o k|a a|adh|aka|lat|aa |pam| ye|kan|iyo|mbo| we|kut|nin|e e|umb|onk|ndu| go|ike|ond|non|gan|omo|una|a s| e |mon| ga|ela|und|waa| ng|yok|ne |ulo|amw|oye| oy|aan|a l|iil|okw|eta| a |wen| ku|i k| gw|aku|igw|ila|a t| nd|ina|yuu|ene|ke | on| dh|iye|mo |pau|bo |him|lyo|o s|ula|wat|ota|yon|e t|eko|yaa|o e| me|a g|yop|e g|lun|alu|ngw|omb|ane| th|yi |o y| ii|nom|ili|dho|ono|mok|uga|vet|eho|ome|kun|iyu|i m|ali|epa| ni|lwe|opo|lok|oko|hok|i o|lol|djo|ung|oon|i t| yi|alw| ot|ukw|uuk|uki|egu|mii|o m| wu| mb|awa|naw|edh|ani|kat|nwa|enw|e k|taa|ont|a h|u t|lel|uni|ndo|wom| mw|she|ola|pwa|dyo|ndy|nem|ndi|yeh|aye|fut|nek|udh|omi"
    },
    Cyrillic: {
      rus: " \u043F\u0440| \u0438 |\u0440\u0430\u0432| \u043D\u0430|\u043F\u0440\u0430|\u0441\u0442\u0432|\u0433\u043E |\u0435\u043D\u0438|\u0432\u043E |\u043E\u0432\u0435| \u043A\u0430|\u043D\u0430 |\u0442\u044C | \u043F\u043E|\u0438\u044F |\u043E \u043D| \u043E\u0431|\u0435\u0442 | \u0432 |\u0441\u0432\u043E| \u0441\u0432|\u0430\u0432\u043E|\u0430\u043D\u0438|\u043E\u0441\u0442|\u043E\u0433\u043E|\u044B\u0439 |\u0430\u0436\u0434|\u043B\u043E\u0432|\u0442 \u043F| \u0438\u043C|\u043D\u0438\u044F| \u0447\u0435| \u0441\u043E|\u0435\u043B\u043E|\u0438\u043C\u0435| \u043D\u0435|\u043B\u044C\u043D|\u043B\u0438 |\u0447\u0435\u043B|\u043A\u0430\u0436|\u0435\u0441\u0442|\u0432\u0435\u043A|\u0430\u0442\u044C|\u043E\u0432\u0430|\u0438\u043B\u0438| \u0440\u0430|\u0435\u043A |\u0439 \u0447|\u0434\u044B\u0439|\u0436\u0434\u044B| \u0434\u043E|\u0438\u0435 |\u0435\u0435\u0442|\u043C\u0435\u0435|\u043D\u043E | \u0438\u043B|\u0438\u0438 |\u0441\u044F |\u0435\u0433\u043E|\u043E\u0431\u043E|\u0438 \u043F|\u043D\u0438\u0435|\u043A \u0438| \u0431\u044B|\u0438 \u0441|\u0438 \u0438|\u043C\u0438 |\u0431\u043E\u0434|\u0432\u043E\u0431|\u0432\u0430\u043D| \u0437\u0430|\u043E\u0439 |\u044B\u0445 |\u043E\u043C |\u043B\u0435\u043D|\u0430\u0446\u0438|\u0435\u043D\u043D|\u043E \u0441|\u043E \u043F|\u044C\u043D\u043E|\u0442\u0432\u0430|\u0442\u0432\u043E|\u043F\u0440\u0438|\u043D\u043E\u0433|\u0430\u043B\u044C|\u0430\u043A\u043E|\u0432\u0430 |\u0438 \u043D|\u0441\u0442\u0438|\u043D\u044B\u0445|\u0442\u043E |\u0431\u0440\u0430|\u043E\u043B\u0436|\u0434\u043E\u043B|\u0441\u0442\u043E|\u0438 \u0432|\u043D\u044B\u043C|\u043E\u0435 | \u0435\u0433|\u043D\u043E\u0432|\u0438\u0445 |\u0435\u043B\u044C|\u0442\u0435\u043B|\u0442\u0438 |\u043D\u043E\u0441|\u043D\u0435 |\u043F\u043E\u043B|\u0440\u0430\u0437| \u0432\u0441|\u0438 \u043E| \u043B\u0438|\u0438 \u0440|\u044B\u0442\u044C|\u0431\u044B\u0442|\u0432\u043B\u0435|\u0440\u0435\u0434|\u0438\u044E |\u0442\u043E\u0440| \u043E\u0441|\u044C\u0441\u044F|\u0442\u044C\u0441|\u043E\u0434\u0438|\u0449\u0435\u0441|\u044F \u0438|\u043A\u0430\u043A|\u043F\u0440\u043E|\u0436\u0435\u043D|\u044B\u043C |\u043F\u0440\u0435|\u0430 \u0441|\u0441\u043D\u043E|\u0435 \u0434|\u043D\u043D\u043E|\u043E \u0438|\u0438\u0439 | \u043A\u043E|\u043E \u0432| \u043D\u0438| \u0434\u0435|\u0441\u0442\u0443|\u043B\u0436\u043D|\u0441\u043E\u0432|\u0435 \u0432|\u043D\u043E\u043C|\u043E\u043B\u044C|\u0440\u0430\u043D|\u043E\u0436\u0435|\u0438\u0447\u0435|\u0435\u0439 |\u0430\u0441\u0442|\u043D\u043D\u044B| \u043E\u0442|\u0442\u0443\u043F|\u043C \u0438|\u043E\u0434\u043D|\u0437\u043E\u0432|\u0440\u0435\u0441| \u043C\u043E|\u043E\u0441\u0443|\u043B\u044F |\u043E\u0441\u043D|\u0430 \u043E|\u0432\u0435\u043D| \u0442\u043E|\u043E \u0431|\u0448\u0435\u043D|\u0442\u0432\u0435|\u043E\u0431\u0449|\u0430 \u0438|\u0435 \u043C|\u044C\u043D\u044B|\u043E\u0431\u0440|\u0432\u0435\u0440|\u0447\u0435\u043D|\u044F \u043D|\u0436\u043D\u043E|\u0447\u0435\u0441|\u0430\u043A |\u043B\u0438\u0447|\u043D\u0438\u0438|\u0435 \u0438|\u0432\u0441\u0435|\u0431\u0449\u0435|\u0432\u0430\u0442|\u0435\u0441\u043F|\u043C\u043E\u0436|\u0439 \u0438|\u043D\u043E\u0435|\u043E \u0434|\u0431\u0435\u0441| \u0432\u043E|\u044F \u0432|\u0434\u0443 | \u0441\u0442|\u0434\u043D\u043E|\u043E\u043D\u0430|\u043D\u0430\u0446|\u0434\u0435\u043D|\u0435\u0436\u0434|\u0445 \u0438| \u0431\u0435|\u0438 \u0434|\u043D\u044B |\u0434\u043E\u0441|\u0434\u043B\u044F| \u0434\u043B| \u0442\u0430|\u043B\u044C\u0441|\u0430\u0442\u0435|\u0446\u0438\u0438|\u044F \u043F|\u0443\u044E |\u0438\u0442\u0435|\u0435 \u043E|\u043D\u043E\u0439|\u043F\u043E\u0434|\u043E\u0442\u043E|\u0441\u0442\u0440|\u0441\u0442\u0430| \u043C\u0435|\u0435\u043B\u0438| \u0440\u0435|\u044F \u043A|\u0442\u043E\u044F|\u0430\u043C\u0438|\u0435\u043D |\u044C \u0432|\u044E \u0438|\u0430\u0437\u043E|\u0433\u043E\u0441|\u043C \u043F|\u044C \u043F|\u0442 \u0431|\u0436\u0435\u0442|\u0443\u0447\u0430|\u0441\u0443\u0434|\u044C\u0441\u0442|\u0434\u0441\u0442|\u0449\u0438\u0442|\u0430\u0449\u0438|\u0437\u0430\u0449|\u043A\u043E\u043D|\u043D\u0438\u044E|\u0430\u043C |\u043E\u0434\u0443|\u0435\u0440\u0435|\u0433\u0440\u0430|\u043F\u0435\u0447|\u043E \u043E|\u043E\u0440\u043E|\u043A\u043E\u0442|\u0438 \u043A|\u0442\u0440\u0430|\u043D\u0438\u043A|\u0443\u0449\u0435|\u0446\u0438\u0430|\u043E\u0446\u0438|\u0441\u043E\u0446|\u043D\u0430\u043B|\u0435\u0441\u043A|\u043E \u0440|\u043A\u043E\u0433|\u0434\u0440\u0443| \u0434\u0440|\u043D\u0438 |\u0430\u0432\u0430|\u043D\u0441\u0442|\u0435\u043C |\u0430\u0432\u043D|\u044B\u043C\u0438|\u0435\u0434\u0441|\u0434\u0438\u043D|\u0434\u043E\u0432| \u0433\u043E| \u0432\u044B|\u0432 \u043A|\u044B\u0435 |\u043E\u0431\u0435|\u043C\u0443 |\u044F \u0435|\u0441\u043B\u0443|\u0443\u0434\u0430|\u0442\u0430\u043A|\u043A\u043E\u0439|\u0442\u0443 |\u0438\u0442\u0443|\u0437\u0430\u043A|\u0445\u043E\u0434|\u0432\u043E\u043B|\u0440\u0430\u0431|\u043A\u0442\u043E|\u0438\u043A\u0442|\u0438\u0447\u043D|\u043D\u0438\u0447|\u043E\u0442 |\u0438\u043D\u0430| \u043A |\u0442\u0435\u0440|\u0440\u043E\u0434|\u043D\u0430\u0440",
      ukr: "\u043D\u0430 | \u043F\u0440|\u043F\u0440\u0430| \u0456 |\u0440\u0430\u0432| \u043D\u0430| \u043F\u043E|\u043D\u044F |\u043D\u043D\u044F| \u0437\u0430|\u043E\u0433\u043E|\u0442\u0438 |\u0432\u043E |\u0433\u043E | \u043A\u043E|\u0430\u0432\u043E| \u043C\u0430|\u043B\u044E\u0434|\u043E \u043D| \u043D\u0435| \u043B\u044E|\u044E\u0434\u0438|\u043E\u0436\u043D|\u043A\u043E\u0436|\u043B\u044C\u043D|\u0436\u043D\u0430|\u0434\u0438\u043D|\u0430\u0442\u0438|\u0430\u0454 |\u0438\u0445 |\u0438\u043D\u0430|\u043F\u043E\u0432|\u0441\u0432\u043E| \u0441\u0432|\u0430\u043D\u043D|\u0454 \u043F|\u043C\u0430\u0454|\u0430\u0431\u043E|\u0430 \u043B| \u0431\u0443|\u043D\u0435 |\u0435\u043D\u043D|\u0431\u043E | \u0430\u0431|\u0430 \u043C|\u043E\u0432\u0438|\u043D\u0456 | \u0432\u0438| \u043E\u0441|\u0430\u0446\u0456|\u0432\u0438\u043D| \u0442\u0430|\u0431\u0435\u0437|\u043E\u0431\u043E| \u0432\u0456| \u044F\u043A|\u0435\u0440\u0435| \u0434\u043E|\u0456 \u043F|\u0443\u0432\u0430|\u043E \u043F|\u0430\u043B\u044C|\u043D\u0438\u0445|\u043E\u043C |\u043C\u0438 |\u0456\u043B\u044C|\u043D\u043E\u0433|\u0442\u0430 |\u0438\u0439 |\u043F\u0440\u0438|\u043E\u044E |\u0442\u044C |\u0441\u0442\u0430| \u043E\u0431|\u0432\u0430\u043D|\u0438\u043D\u043D|\u0442\u0456 |\u043E\u0441\u0442| \u0443 |\u0441\u044F |\u0432\u0430\u0442|\u0431\u0443\u0442|\u0438\u0441\u0442| \u043C\u043E|\u0435\u0437\u043F|\u0443\u0442\u0438|\u043D\u043E\u0432|\u043F\u0435\u0440|\u0456\u0457 |\u0438 \u043F|\u0431\u043E\u0434|\u0432\u043E\u0431|\u0441\u0442\u0432| \u0432 |\u043E \u0432|\u0432\u0456\u0434| \u0431\u0435|\u0430\u043A\u043E|\u043F\u0456\u0434|\u0442\u0438\u0441|\u043A\u043E\u043D|\u043D\u043E |\u0432\u0430 |\u043D\u043D\u0456|\u0456 \u0441|\u0430 \u043F|\u0441\u0442\u0456| \u0441\u043F|\u043D\u0438\u0439|\u0434\u0443 |\u044C\u043D\u043E|\u043E\u043D\u0430| \u0456\u043D|\u0434\u043D\u043E|\u043D\u0438\u043C|\u0456\u0439 |\u0430 \u0437|\u043D\u0443 |\u043C\u043E\u0436|\u0457\u0457 | \u0457\u0457|\u043B\u044F |\u0441\u043E\u0431|\u043C\u0443 |\u043E\u0457 |\u044F\u043A\u043E| \u043F\u0435| \u0440\u0430|\u0456\u0434 | \u0434\u0435|\u0456 \u0432|\u0438 \u0456|\u0447\u0438\u043D|\u0432\u043D\u043E|\u043E\u043C\u0443|\u043D\u043E\u043C|\u0443 \u043F|\u0456 \u043D|\u0430 \u0441| \u0441\u0443|\u0430 \u043E|\u043D\u0435\u043D|\u0438\u0441\u044F|\u043E\u0432\u043E|\u043D\u0430\u043D|\u043E\u0434\u043D|\u0443 \u0432|\u0456 \u0434|\u0430\u0432\u0430|\u0456\u0434\u043D|\u0440\u0456\u0432| \u0440\u0456|\u0456 \u0440|\u0438\u043C\u0438|\u0432\u0456\u043B|\u0438\u043C |\u0446\u0456\u0457|\u043E \u0434|\u0430 \u0432|\u0441\u0442\u0443|\u043E\u0434\u0443|\u0431\u0443\u0434|\u043E\u0432\u0430| \u043F\u0456| \u043D\u0456|\u044F \u043D|\u0435 \u043F|\u043D\u0430\u0446|\u0438 \u0441|\u043D\u043D\u0430| \u043E\u0434| \u0440\u043E|\u043D\u043E\u0441|\u044C\u043D\u0438|\u044E\u0442\u044C|\u0438 \u0437|\u043A\u0438 |\u0456 \u0437|\u0430 \u0431|\u0441\u043F\u0440|\u0447\u0435\u043D|\u0436\u0435 |\u043E\u0436\u0435|\u0435 \u043C|\u043E\u0432\u043D|\u0440\u0438\u043C|\u0435 \u0431|\u0442\u043E |\u043D\u0456\u0445|\u043E\u0441\u043E|\u0443\u0434\u044C|\u0432\u0456 | \u0440\u0435| \u0441\u0442|\u0440\u0430\u0446|\u0434\u043E | \u0441\u043E|\u0440\u043E\u0437|\u043B\u0435\u043D|\u0432\u043D\u0438|\u0456\u0432\u043D|\u0440\u043E\u0434| \u0432\u0441|\u0441\u043F\u0456|\u043A\u043E\u0432|\u0437\u043F\u0435|\u0456\u0432 |\u0434\u043B\u044F| \u0434\u043B|\u0457 \u043E|\u0445\u0438\u0441|\u0430\u0445\u0438|\u0437\u0430\u0445|\u2010\u044F\u043A|\u044C\u2010\u044F|\u0434\u044C\u2010|\u044F \u0456|\u0442\u0430\u043A|\u0437\u043D\u0430|\u0437\u0430\u0431|\u0441\u0442\u044C|\u0442\u0443 |\u043D\u043E\u044E|\u0430 \u043D|\u0442\u043E\u0440|\u0441\u043D\u043E|\u043E \u0441|\u0436\u0435\u043D|\u0446\u0456\u0430|\u043E\u0446\u0456|\u0441\u043E\u0446|\u0456\u043D\u0448|\u0456 \u043C|\u043A\u043B\u0430|\u0438 \u0432|\u0442\u0435\u0440| \u0434\u0456|\u0456\u0441\u0442|\u043E\u0432\u0456|\u0443 \u0441|\u044F \u0432|\u0430\u0440\u043E|\u0441\u0456 |\u0432\u0456\u0442|\u0441\u0432\u0456|\u043E\u0441\u0432|\u0440\u043E\u0431|\u043F\u0456\u043B|\u0440\u0435\u0441|\u0437\u0430 |\u043F\u0435\u0447|\u0430\u0431\u0435|\u043A\u0443 |\u043B\u0438\u0432|\u0435\u0440\u0436|\u0434\u0435\u0440|\u0432 \u0456|\u0430\u0432\u043D|\u0442\u0430\u0432|\u0430\u0432 |\u0430\u043C\u0438|\u043A\u043E\u043C|\u0432\u043B\u0435|\u043E \u0431|\u044C \u043F| \u0449\u043E|\u0457\u0445 |\u0442\u0432\u043E|\u0445\u0442\u043E|\u0456\u0445\u0442|\u043A\u043E\u0433| \u043A\u0440|\u0430\u043D\u043E|\u0442\u0430\u043D|\u0456\u0430\u043B|\u043D\u0430\u043B|\u043D\u044C |\u0445 \u043F|\u0436\u043D\u043E|\u043B\u0435\u0436|\u0430\u043B\u0435|\u043F\u0440\u043E|\u0442\u0432\u0430|\u0440\u0430\u0442|\u043E \u043E|\u0445 \u0432|\u043D\u0430\u0440|\u043B\u044C\u0441|\u0446\u0456\u0439|\u043A\u043E\u0440|\u0447\u0430\u0441|\u0440\u0436\u0430|\u0457 \u0441|\u0438\u043D\u0443|\u0434\u0441\u0442|\u043E \u0437|\u0440\u0430\u0437|\u043C\u0456\u043D|\u0430 \u0440|\u0437\u0430\u043A",
      bos: " \u043F\u0440| \u0438 |\u0440\u0430\u0432|\u043D\u0430 |\u043C\u0430 |\u043F\u0440\u0430| \u043D\u0430|\u0438\u043C\u0430| \u0441\u0432|\u0430 \u0441|\u0434\u0430 |\u0430 \u043F|\u0432\u043E |\u0458\u0435 |\u043A\u043E |\u0430\u043A\u043E|\u043E \u0438| \u043F\u043E|\u0430\u0432\u043E|\u0435 \u0441|\u0430 \u0438|\u0442\u0438 | \u0438\u043C| \u0434\u0430| \u0443 |\u0441\u0432\u0430|\u043D\u043E | \u0437\u0430|\u043E \u043D|\u0432\u0430 |\u0438 \u043F|\u0438\u043B\u0438|\u0432\u0430\u043A|\u043B\u0438 | \u043A\u043E|\u043D\u0435 | \u0438\u043B|\u043A\u043E\u0458| \u043D\u0435| \u0434\u0440|\u043E\u0441\u0442| \u0441\u043B|\u045A\u0430 |\u0438\u043C |\u0438 \u0441|\u0443 \u0441|\u0438 \u0438|\u0430\u0432\u0430|\u0438\u0458\u0435|\u0430 \u0443| \u0431\u0438|\u0441\u0442\u0432|\u0441\u0435 |\u0432\u0430\u045A|\u0430 \u0434|\u043E\u043C |\u0458\u0435\u0434|\u0431\u043E\u0434|\u043E\u0431\u043E|\u043B\u043E\u0431|\u0441\u043B\u043E| \u0441\u0435| \u0440\u0430|\u0438\u0445 |\u0441\u0442\u0438|\u0430 \u043D|\u045A\u0435 | \u043E\u0431| \u0458\u0435|\u043F\u0440\u0438|\u0434\u0440\u0443|\u0443 \u0438|\u0458\u0443 |\u043E \u0434|\u0438\u0442\u0438|\u0432\u043E\u0458|\u0440\u0430\u0437|\u0430\u045A\u0435|\u043E\u0432\u0430|\u0434\u0458\u0435| \u043E\u0441|\u0435 \u0438|\u043B\u043E |\u0435 \u043F|\u0430\u045A\u0430|\u0443\u0458\u0435|\u0438 \u0434|\u0431\u0440\u0430|\u0442\u0440\u0435| \u0442\u0440| \u0441\u0443|\u0443 \u0437|\u0430 \u043A|\u043E\u0433 |\u0443 \u043F|\u043E\u0458\u0435|\u0446\u0438\u0458|\u0440\u0435\u0431|\u0430 \u043E|\u0430 \u0431| \u045A\u0435|\u0438 \u0443|\u043C\u0438\u0458|\u043D\u0438 |\u043D\u043E\u0441|\u0431\u0430 |\u0435\u0434\u043D|\u0441\u0432\u043E|\u045A\u0435\u0433| \u0438\u0437|\u043F\u0440\u043E|\u0435 \u0434|\u0436\u0430\u0432|\u0431\u0438\u0442| \u043D\u0438|\u0438 \u043E|\u0441\u0442\u0430|\u0430 \u0437|\u0430\u0432\u043D|\u0432\u0458\u0435| \u043A\u0430|\u0431\u0438\u043B|\u043E\u0432\u043E|\u0430 \u0458|\u0430\u0458\u0443|\u0438\u0441\u0442|\u0438 \u043D|\u043D\u0438\u0445|\u0458\u0435\u043B|\u0442\u0443 |\u0440\u0435\u0434|\u0433\u043E\u0432| \u043E\u0434|\u0435 \u043E|\u043E\u0458\u0438| \u0441\u043C|\u0458\u0430 |\u043E \u043A|\u0438\u043B\u043E|\u0430\u0446\u0438|\u0435 \u0443|\u043F\u0440\u0435|\u043E \u043F|\u0435\u0431\u0430|\u0443 \u043E|\u0441\u0443 |\u0432\u0438\u043C|\u0438\u0447\u043D| \u0441\u0430| \u0434\u0458|\u0430 \u0442|\u0438\u0458\u0430|\u0448\u0442\u0438|\u0447\u043D\u043E|\u0440\u0436\u0430|\u0434\u0440\u0436|\u0441\u0442\u0443|\u0434\u043D\u0430|\u043E\u0434\u043D|\u0435\u043D\u0438|\u0437\u0430 |\u0438\u0432\u0430|\u043D\u043E\u043C|\u0435\u043C |\u0434\u0443 |\u0440\u0430\u043D|\u0432\u043D\u043E|\u0441\u043C\u0438|\u0458\u0435\u0440|\u0435 \u0431|\u0435 \u043D|\u0434\u0435 |\u043F\u043E\u0441|\u043C \u0438| \u0434\u043E|\u0443 \u0434|\u043D\u0430\u043A|\u0430 \u0440|\u043E\u0431\u0440| \u043C\u043E|\u043D\u0438\u043C|\u0435\u0433\u043E| \u043A\u0440|\u0442\u0438\u0442|\u043A\u0440\u0438|\u0432\u0435 |\u0430\u043D |\u0438\u043A\u043E|\u043D\u0438\u043A|\u043D\u0443 |\u0438 \u043C|\u043D\u043E\u0433|\u0435\u043D\u043E|\u0441\u043D\u043E|\u0435 \u043A|\u0442\u0443\u043F|\u0440\u0443\u0433|\u043A\u0430 |\u043E\u0434\u0430|\u0440\u0438\u0432|\u0432\u043E\u0459|\u0430\u043B\u043D|\u043C \u0441|\u0438\u0442\u0443|\u0430\u0448\u0442|\u0437\u0430\u0448|\u0430\u043D\u0438|\u0441\u0430\u043C| \u0441\u0442|\u0430\u043A\u0432|\u043E\u0432\u0438|\u043E\u0441\u043D|\u0440\u043E\u0434|\u0430\u0440\u043E| \u043C\u0438|\u0458\u0438 |\u0442\u0432\u0430|\u0434\u043D\u043E|\u043D\u0441\u0442|\u0430\u043A |\u0438\u0442\u0435|\u0459\u0443 |\u0432\u0438\u0447|\u0440\u0430\u0434|\u0443 \u043D|\u0443 \u043C| \u0442\u0430|\u0434\u0441\u0442|\u0442\u0438\u0432|\u043D\u0430\u0446|\u0440\u0438\u043C|\u043A\u043E\u043D|\u043A\u0443 |\u045A\u0443 |\u043E\u0434\u0443|\u0436\u0438\u0432|\u0430\u043C\u043E|\u0442\u0432\u043E|\u0442\u0435\u0459|\u043F\u043E\u0434|\u0435\u045B\u0443|\u0433 \u043F|\u043D\u043E\u0432|\u0438\u043D\u0430|\u043D\u0430\u0440| \u0432\u0458|\u0438 \u0431|\u043E\u0458 | \u043E\u0432|\u0430\u0432\u0435|\u0432\u0443 |\u0430\u043D\u0441|\u043E\u0458\u0430|\u0437\u043E\u0432|\u0430\u0437\u043E|\u0443\u0434\u0435|\u0431\u0443\u0434| \u0431\u0443|\u0435 \u0442|\u0438 \u0432|\u0435\u045A\u0430|\u0435\u0434\u0438|\u043D\u0438\u0446|\u043D\u0430\u043F|\u043C\u0458\u0435| \u0438\u0441|\u0441\u043B\u0443|\u0435\u0434\u0441|\u043E \u043E|\u0437\u0430\u043A|\u0438 \u043A|\u043C \u043F|\u0442\u043D\u043E|\u0438\u0432\u043E|\u0435\u0440\u0435|\u043D\u0438\u0447|\u043A\u0430\u043A|\u0430\u0434\u0430|\u0432\u043D\u0438|\u0443\u0433\u0438| \u0440\u043E|\u043C\u043E\u0432|\u0432\u0435\u043D|\u043E \u0441|\u0442\u043E |\u0442\u0435 | \u0432\u0440| \u0431\u0435|\u0430\u0440\u0430|\u043A\u043B\u0430| \u0431\u0440|\u0443 \u0431|\u0443 \u0443|\u0438 \u0442|\u043E\u043D\u0430| \u043E\u043D|\u0430\u0432\u0438|\u0458\u0430\u043B|\u0434\u043D\u0438| \u0441\u043A",
      srp: " \u043F\u0440| \u0438 |\u0440\u0430\u0432|\u043D\u0430 |\u043F\u0440\u0430| \u043D\u0430|\u043C\u0430 | \u0441\u0432|\u0438\u043C\u0430|\u0434\u0430 |\u0430 \u043F|\u0432\u043E |\u043A\u043E |\u0442\u0438 |\u0430\u0432\u043E| \u043F\u043E|\u0430 \u0438|\u0430\u043A\u043E|\u0430 \u0441| \u0437\u0430| \u0443 |\u043E \u0438| \u0438\u043C|\u0438 \u043F|\u0432\u0430 |\u0441\u0432\u0430|\u0432\u0430\u043A| \u0434\u0430|\u043E \u043D|\u0435 \u0441|\u043E\u0441\u0442| \u043A\u043E|\u045A\u0430 |\u043B\u0438 |\u0438\u043B\u0438|\u043D\u0435 |\u043E\u043C | \u043D\u0435|\u0430 \u043D| \u0441\u043B| \u0438\u043B|\u0458\u0435 | \u0434\u0440|\u0438 \u0441|\u043D\u043E |\u043A\u043E\u0458|\u0443 \u0441|\u0430\u0432\u0430| \u0440\u0430|\u043E\u0433 |\u0441\u043B\u043E|\u0458\u0443 |\u0438\u043C |\u0441\u0442\u0438|\u0431\u043E\u0434|\u043E\u0431\u043E|\u043B\u043E\u0431|\u0438\u0442\u0438|\u0430 \u043E|\u0441\u0442\u0432|\u0438 \u0443|\u0430 \u0434|\u043D\u0438 |\u0458\u0435\u0434|\u0443 \u043F|\u043F\u0440\u0438|\u0435\u0434\u043D| \u0431\u0438|\u0438 \u0438|\u0430 \u043A|\u043E \u0434|\u0441\u0442\u0430|\u0438\u0445 |\u0434\u0440\u0443|\u0430 \u0443| \u0458\u0435|\u0430\u045A\u0430| \u043E\u0441| \u043D\u0438|\u043D\u043E\u0441|\u043F\u0440\u043E|\u0430\u0458\u0443|\u0438 \u043E| \u0434\u0435| \u0441\u0443|\u0443 \u0438|\u0441\u0435 |\u045A\u0435 |\u0458\u0430 |\u043E\u0432\u0430|\u0438 \u0434|\u0446\u0438\u0458| \u043E\u0431|\u0443\u0458\u0435|\u0440\u0435\u0434|\u0436\u0430\u0432|\u0435 \u0438|\u0435 \u043F|\u0430 \u0458|\u0434\u043D\u0430| \u0441\u0435| \u043E\u0434|\u0432\u0435 | \u043A\u0430|\u0435\u043D\u0438|\u0440\u0436\u0430|\u0434\u0440\u0436|\u0430 \u0437|\u0430\u0432\u043D|\u0435\u045A\u0430|\u0430\u0446\u0438|\u0432\u043E\u0458|\u043E\u0432\u043E|\u0443 \u0443|\u043C \u0438|\u043E\u0458\u0430|\u0432\u0430\u045A| \u0438\u0437|\u0438\u0458\u0430|\u0443 \u0437|\u0430\u045A\u0435|\u0440\u0430\u043D|\u0435 \u043E|\u0440\u043E\u0434|\u0438 \u043D|\u0435 \u0431|\u0440\u0430\u0437|\u0437\u0430 | \u045A\u0435|\u0433\u043E\u0432|\u0438\u0447\u043D| \u0441\u0442|\u043D\u043E\u0432|\u0441\u043D\u043E|\u043E\u0441\u043D|\u0434\u0443 |\u043F\u0440\u0435| \u0442\u0440|\u0441\u0443 |\u0432\u0443 |\u043E\u0434\u043D|\u0430 \u0431|\u0441\u0432\u043E|\u045A\u0435\u0433|\u043D\u0438\u043C|\u043D\u0438\u0445|\u0442\u0443 |\u0442\u0438\u0442|\u0448\u0442\u0438|\u043A\u0443 |\u043D\u043E\u043C|\u0431\u0438\u0442|\u0435 \u0434|\u043C\u0435 |\u0438\u043A\u043E|\u0447\u043D\u043E|\u043E\u0458\u0438|\u043B\u043E |\u0432\u043D\u043E|\u043D\u0438\u043A|\u0438\u043A\u0430|\u0431\u0435\u0437|\u0430\u0440\u0430|\u0434\u0435 |\u0443 \u043E|\u0432\u0438\u043C|\u043D\u0430\u043A| \u0441\u0430|\u0440\u0438\u0432|\u0430\u0432\u0435|\u0430\u043D |\u0432\u043E\u0459| \u043A\u0440|\u043E \u043F|\u0441\u043C\u0435|\u0435 \u043A|\u043D\u043E\u0433|\u0458\u0438 | \u043E\u0432|\u0435 \u0443|\u0442\u0432\u0430|\u0431\u0440\u0430|\u0440\u0443\u0433|\u0440\u0435\u0431|\u0442\u0440\u0435|\u0443 \u0434|\u043E\u0434\u0430| \u043C\u043E| \u0432\u0440|\u0430\u0432\u0459|\u0443 \u043D|\u0435\u0433\u043E|\u0434\u0435\u043B|\u043C \u0441|\u043A\u0440\u0438|\u043E \u043A|\u0430\u0448\u0442|\u0437\u0430\u0448|\u045A\u0443 | \u0441\u043C|\u0430\u043D\u0438| \u043B\u0438|\u0434\u043D\u043E|\u0435\u0452\u0443|\u0430\u043B\u043D|\u043B\u0430 |\u0430\u043A\u0432|\u043E\u0458 |\u043A\u043E\u043C|\u0441\u0442\u0443|\u0443\u0433\u0438|\u0430\u0432\u0438|\u0430 \u0440|\u043A\u0430 |\u0440\u0430\u0434|\u043E\u0434\u0438|\u0432\u0438\u0447|\u0442\u0430\u0432|\u0438\u0442\u0443|\u0443\u0434\u0435|\u0431\u0443\u0434| \u0431\u0443|\u043F\u043E\u0442|\u043E\u0434\u0443|\u0436\u0438\u0432|\u0435\u0440\u0435|\u0442\u0432\u043E|\u0438\u043B\u043E|\u0431\u0438\u043B|\u0430\u0440\u043E|\u0435 \u043D|\u043E\u0432\u0438|\u043F\u043E\u0440|\u0435\u043D\u043E|\u0448\u0442\u0432|\u043D\u0430\u0446|\u043E\u0432\u0435|\u043C \u043F|\u0442\u0443\u043F|\u043F\u043E\u0441|\u0440\u0435\u043C|\u0434\u043D\u0438|\u0431\u0430 |\u043D\u0441\u0442|\u0430 \u0442|\u043E\u0458\u0443|\u0430\u0441\u0442|\u0438\u0432\u0430|\u0435 \u043C|\u0432\u0440\u0435|\u0432\u0459\u0430|\u043D\u0443 |\u0431\u0435\u0452|\u0438\u0441\u0442|\u0435\u043D |\u0442\u0435 |\u0434\u0441\u0442|\u0440\u043E\u0442|\u0437\u0430\u043A|\u0430\u043E |\u043A\u0430\u043E|\u0438 \u043A|\u0458\u0443\u045B|\u043E \u0441|\u0441\u0442 |\u0441\u0430\u043C|\u043C \u043D|\u0442\u0435\u0440|\u043D\u0430\u0440| \u043C\u0435|\u0438 \u043C|\u043A\u043E\u043B|\u0435 \u0440|\u0443\u0448\u0442|\u0440\u0443\u0448|\u0432\u0435\u0440|\u043A\u0430\u043A| \u0431\u0435|\u0438 \u0431|\u043A\u043B\u0430|\u0430\u0434\u0430|\u0435\u0431\u0430|\u0435\u043D\u0430|\u043E\u043D\u0430| \u043E\u043D|\u0442\u0432\u0443|\u0430\u043D\u0441| \u0434\u043E|\u0440\u0430\u043A|\u0441\u043B\u0443|\u0438 \u0432|\u043D\u0438\u0446|\u0443 \u043A|\u043C\u0435\u043D|\u0432\u0440\u0448|\u0435\u043C\u0435|\u0435\u0434\u0441|\u0438\u0432\u0438|\u043E \u043E|\u0458\u0430\u0432",
      uzn: "\u0430\u043D |\u043B\u0430\u0440|\u0433\u0430 |\u0438\u0440 | \u0431\u0438|\u0430\u0440 | \u0432\u0430|\u0434\u0430 |\u0438\u0433\u0430| \u04B3\u0443|\u0432\u0430 |\u0431\u0438\u0440|\u0443\u049B\u0443|\u049B\u0443\u049B|\u04B3\u0443\u049B| \u04B3\u0430|\u0440 \u0431|\u0433\u0430\u043D|\u0438\u0448 |\u0438\u0434\u0430| \u0442\u0430|\u0430 \u044D|\u0438\u043D\u0438|\u0430\u0434\u0438|\u043D\u0433 |\u0434\u0438\u0440|\u0438\u0448\u0438|\u043B\u0438\u043A|\u043B\u0438\u0448|\u0438\u0439 |\u0438\u043B\u0438|\u0430\u0440\u0438|\u0443\u049B\u0438|\u04B3\u0430\u0440|\u043B\u0430\u043D|\u0438\u043D\u0433|\u0448\u0438 |\u0434\u0430\u043D|\u043D\u0438\u043D|\u0438\u043D\u0441|\u043A\u0438\u043D|\u0441\u043E\u043D|\u043D\u0441\u043E| \u0438\u043D| \u043C\u0443|\u049B\u0438\u0433| \u043C\u0430|\u043E\u043D |\u0440 \u0438| \u0431\u045E|\u044D\u0433\u0430| \u044D\u0433| \u045E\u0437|\u043D\u0438 |\u0431\u045E\u043B|\u0433\u0430\u0434|\u0438 \u0431|\u043A\u0438 |\u0438\u043B\u0430|\u0451\u043A\u0438| \u0451\u043A|\u0430 \u0431|\u043D \u0431|\u0438\u043D |\u0440 \u04B3|\u0430\u043B\u0430|\u044D\u0440\u043A| \u044D\u0440|\u043B\u0433\u0430| \u049B\u0430|\u0440\u043A\u0438|\u0448 \u04B3|\u0438 \u04B3|\u043D \u043C| \u0431\u043E| \u0431\u0430|\u0438\u043A |\u0430\u0440\u0430|\u0438\u0433\u0438|\u043B\u0438\u0433|\u0440\u0438 |\u049B\u0438\u043B|\u0430 \u0442|\u0431\u0438\u043B| \u044D\u0442|\u043D\u0438\u0448|\u043D\u043B\u0438|\u043A\u043B\u0430|\u0438 \u0432|\u0431\u043E\u0448|\u044D\u0442\u0438|\u0430\u043D\u0438|\u0438\u043C |\u0438 \u043C|\u043E\u043B\u0438|\u049B\u043B\u0430|\u0430 \u04B3|\u043B\u0430\u0448|\u0430\u0442\u043B|\u0442\u0438\u043B|\u0430 \u049B| \u043E\u043B|\u043E\u0441\u0438|\u043C\u0430\u0441|\u049B\u0430\u0440|\u0438\u043D\u043B|\u043B\u0430\u0442| \u049B\u0438|\u0442\u0430\u044A|\u04B3\u0430\u043C|\u0433\u0438 |\u0438\u0431 |\u043C\u043B\u0430|\u045E\u0437 |\u043D \u044D|\u043C\u0443\u043C| \u0434\u0430| \u0431\u0443|\u0430\u0442 |\u0448 \u0432|\u0443\u043D |\u0430\u0442\u0438|\u043C\u043A\u0438|\u0443\u043C\u043A|\u0442\u043B\u0430|\u0438\u0440\u043E|\u045E\u043B\u0438|\u0431\u0430\u0440|\u0438\u0440\u0438|\u0440\u0438\u0448|\u0438\u044F\u0442|\u0430\u043B\u0438| \u0431\u0435| \u049B\u043E|\u0430 \u0448|\u0430\u0440\u043E| \u043A\u0435|\u0438 \u0442|\u0440\u043B\u0430| \u0442\u0435|\u0447\u0430 |\u0440\u0447\u0430|\u0430\u0440\u0447|\u0430 \u045E| \u0448\u0443|\u0442\u0438\u0448|\u043D \u04B3|\u0442\u0433\u0430| \u0441\u0430|\u0430\u0441\u0438| \u0445\u0430|\u0440\u0430\u043A|\u043B\u0438\u043D|\u043E\u043B\u0430|\u0438\u043C\u043E|\u0448\u049B\u0430|\u043B\u0438 | \u0442\u0443|\u0430\u043C\u043B|\u043B\u043B\u0430|\u0441\u0438\u0434|\u043D \u045E| \u0430\u0441|\u043D\u0438\u0434|\u0430 \u0438| \u043A\u0438|\u043D \u0442|\u043D\u0434\u0430|\u043A \u0431|\u0435\u0440\u0430|\u043E\u0448\u049B|\u0441\u0438\u0437|\u043E\u0440 |\u0430 \u043C|\u0440 \u0432|\u0435\u043D\u0433|\u0442\u0435\u043D|\u043C\u0430\u0442|\u043C\u0434\u0430|\u0430\u043C\u0434|\u043B\u0438\u043C|\u0439 \u0442|\u044F\u0442 |\u0438 \u0430|\u0438\u043D\u043E|\u0438\u043B\u0433| \u0442\u043E|\u0442\u043D\u0438|\u0430\u043D\u0430|\u0430\u0441 |\u044D\u043C\u0430| \u044D\u043C|\u0430 \u0451| \u0448\u0430|\u0430\u0448 |\u0430 \u0430|\u0442\u0430\u0440|\u043A\u0430\u0442|\u0430\u043A\u0430|\u0430\u043A | \u0434\u0435|\u0430\u0437\u0430|\u0438\u043B\u043B|\u0441\u0438\u0439| \u0441\u0438| \u0441\u043E|\u0443\u049B\u043B|\u043D \u049B|\u043E\u0434\u0430|\u044A\u043B\u0438|\u0430\u044A\u043B|\u043D\u0438\u043A|\u0430\u0434\u0430| \u043D\u0438|\u0442\u0434\u0430|\u0433\u0438\u043D|\u0443\u043D\u0438|\u0441\u0438\u0442|\u0430\u0439 |\u049B\u043E\u043D|\u043D \u043E| \u0436\u0430|\u043A\u0438\u043C|\u0435\u0447 |\u04B3\u0435\u0447| \u04B3\u0435|\u045E\u0437\u0438|\u043B\u0430\u043A|\u043A\u0435\u0440|\u0438\u043A\u043B|\u043B\u043B\u0438|\u0443\u0440 |\u0437\u0430\u0440|\u0448\u043B\u0430|\u0440\u0438\u0433|\u0438\u0440\u043B|\u0434\u0430\u043C|\u043A\u043E\u04B3|\u0438\u043A\u043E|\u0430 \u0434|\u0430\u043C |\u043D \u0432|\u0440\u0442\u0438|\u0442\u0438\u0431|\u0442\u0430\u043B| \u0438\u0448|\u0447\u0443\u043D|\u0443\u0447\u0443| \u0443\u0447|\u0441\u043B\u0430|\u0430 \u0443|\u0440\u0438\u043D|\u0441\u043E\u0441|\u0430\u0441\u043E| \u0443\u043D|\u043D\u0430 | \u043A\u0430|\u043C\u0443\u04B3|\u0434\u0438\u0433|\u0447 \u043A|\u0430\u0441\u043B|\u043B\u043C\u0430|\u0440\u0430 |\u0431\u0443 |\u0445\u0430\u043B|\u045E\u043B\u0433|\u0438 \u043A|\u0435\u043A\u043B|\u0440 \u0434|\u049B\u0430\u0442|\u0430\u0433\u0430|\u0438 \u049B|\u043E\u0438\u0439|\u043C\u0438\u043B| \u043C\u0438|\u049B\u0430 |\u0438 \u0441|\u0436\u0438\u043D| \u0436\u0438|\u0441\u0438\u043D|\u0440\u043E\u0440|\u0430 \u0432|\u043B\u0430\u0434|\u0430 \u043E|\u0442\u043B\u0438|\u043C\u0438\u044F|\u043D \u0438|\u0430\u0431 |\u0442\u0438\u0440|\u0437 \u043C|\u0434\u0430\u0432|\u0440\u0433\u0430|\u0430\u0433\u0438|\u0430 \u043A|\u043D\u043B\u0430|\u0430\u049B\u0442|\u0432\u0430\u049B|\u0430\u0440\u0442|\u0430\u0451\u0442|\u043B\u0430\u0431",
      azj: " \u0432\u04D9|\u0432\u04D9 |\u04D9\u0440 |\u0438\u0440 | \u04BB\u04D9| \u0431\u0438| \u04BB\u04AF| \u043E\u043B|\u04AF\u0433\u0443|\u04BB\u04AF\u0433|\u0433\u0443\u0433|\u043D\u0430 |\u0438\u043D |\u043B\u0430\u0440|\u04BB\u04D9\u0440|\u0434\u04D9 | \u0448\u04D9|\u0431\u0438\u0440|\u043B\u04D9\u0440|\u043B\u0438\u043A|\u043C\u0430\u043B|\u0440 \u0431|\u043B\u043C\u0430|\u0440 \u04BB| \u0442\u04D9|\u04D9\u0445\u0441|\u0448\u04D9\u0445|\u04D9\u043D |\u0434\u0438\u0440|\u0443\u0433\u0443|\u0443\u043D\u0430|\u0430\u043D |\u0430\u043B\u0438|\u0430 \u043C| \u043C\u0430|\u0438\u043A\u0434|\u0438\u043D\u0438|\u0440 \u0448|\u0434\u04D9\u043D|\u0430\u0440 |\u0438\u043B\u04D9|\u0433\u0443\u043D|\u0430\u0433 |\u0430\u0441\u044B| \u0458\u0430|\u043C\u04D9\u043A|\u0458\u04D9\u0442| \u043C\u04D9| \u043C\u04AF|\u043A\u0434\u0438|\u04D9\u0441\u0438|\u04D9\u043A |\u0438\u043B\u043C|\u043D\u0438\u043D|\u043D\u0434\u04D9|\u043E\u043B\u043C|\u04D9\u0442\u0438|\u04D9 \u0458|\u0441\u0438\u043D|\u0445\u0441 |\u043D\u0434\u0430|\u043B\u043C\u04D9|\u0458\u0458\u04D9|\u0438 \u0432| \u0433\u0430| \u0430\u0437|\u043E\u043B\u0443|\u0438\u0458\u0458|\u0458\u0430 |\u0438\u043D\u0434|\u0437\u0430\u0434|\u0433\u043B\u0430|\u04AF\u043D |\u043D\u0438 |\u043B\u04D9 |\u0442\u0438\u043D|\u043D \u043C|\u0430\u0437\u0430|\u0430\u0440\u044B|\u04D9\u0442 |\u043D \u0442|\u043C\u0430\u0433|\u043B\u0443\u043D|\u043B\u044B\u0433|\u04D9 \u0431|\u0443\u043D |\u043D\u0443\u043D|\u0433 \u0432|\u043D \u04BB|\u0434\u0430\u043D|\u044B\u043D | \u0435\u0442|\u0442\u043C\u04D9|\u04D9\u0440\u04D9| \u04E9\u0437|\u0434\u0430 |\u04D9 \u0432| \u043E\u043D|\u04D9 \u0430|\u044B\u043D\u0430|\u044B\u043D\u044B|\u0431\u0438\u043B|\u0430 \u0431|\u0441\u044B |\u0438\u043B |\u04D9\u043C\u0438|\u0430\u0440\u0430|\u0441\u0438 | \u0434\u0438|\u04D9 \u043C|\u04D9\u0440\u0438|\u0440\u043B\u04D9| \u0432\u0430|\u04D9 \u04BB|\u0435\u0442\u043C|\u044B\u0493\u044B|\u0430\u043C\u0430|\u0434\u043B\u044B|\u0430\u0434\u043B|\u0440\u0438\u043D|\u0431\u04D9\u0440|\u0440\u044B\u043D|\u043D \u0438|\u043C\u04AF\u0434|\u043D\u044B\u043D| \u04BB\u0435|\u043C\u0430\u0441|\u0438\u043A |\u043D \u0430|\u0434\u0438\u043B|\u0430\u043B\u044B|\u0438\u0440\u043B|\u04D9\u043B\u04D9|\u04AF\u0434\u0430|\u0441\u044B\u043D|\u044B\u043D\u0434|\u0445\u0441\u0438|\u043B\u0438 |\u04D9 \u0434|\u043D\u04D9 | \u0431\u04D9|\u04D9\u0458\u0430| \u0438\u043D|\u04D9 \u0438|\u043B\u04D9\u0442| \u0441\u04D9|\u043D\u044B | \u0438\u0448|\u0430\u043D\u044B|\u0435\u0447 |\u04BB\u0435\u0447|\u0433 \u04BB|\u0435\u0458\u043D|\u04D9 \u0435|\u0434\u044B\u0440| \u0434\u0430|\u0430\u0441\u0438|\u0440\u044B |\u0438\u0448 |\u0438\u0444\u0430|\u043B\u044B\u0493|\u0438 \u0441|\u0444\u0438\u04D9|\u0430\u0444\u0438|\u0434\u0430\u0444| \u0435\u0434|\u043C\u04D9\u0437|\u0443 \u0432|\u043A\u0438\u043B| \u04BB\u0430|\u043E\u043B\u0430|\u043D \u0432|\u04D9\u043D\u0438|\u044B\u0440 |\u0443\u0433 |\u0443\u043D\u043C| \u0431\u0443| \u0430\u0441|\u0441\u0438\u0430|\u043E\u0441\u0438|\u0441\u043E\u0441|\u0438\u043B\u0438|\u044B\u0434\u044B|\u043B\u044B\u0434|\u043D\u043C\u0430|\u044B\u0433 |\u0438\u043D\u04D9|\u04D9\u0440\u0430|\u0441\u0438\u043B|\u0445\u0438\u043B|\u0430\u0445\u0438|\u0434\u0430\u0445|\u0430\u0434\u04D9|\u043C\u0430\u043D|\u0430 \u04BB|\u04D9 \u043E|\u043E\u043D\u0443|\u0430 \u0433|\u04D9\u0437 | \u043A\u0438|\u0441\u0435\u0447| \u0441\u0435|\u044B \u04BB|\u043C\u0438\u043D|\u043B\u0430\u043D|\u04D9\u0434\u04D9|\u0431\u0443 |\u0440\u0430\u0433|\u043B\u044B |\u044B\u043B\u044B|\u0430\u043B |\u04D9 \u0433|\u0440 \u0432|\u043D\u043B\u0430|\u04BB\u0441\u0438|\u04D9\u04BB\u0441|\u0442\u04D9\u04BB|\u04E9\u0437 |\u0438\u0441\u0442| \u0438\u0441|\u043C\u04D9\u0441| \u04D9\u0441|\u0438\u043D\u0430|\u04D9 \u0442|\u04D9\u0442\u043B|\u0430 \u0432|\u0438\u04D9 |\u043D \u0431|\u0442\u04D9\u0440| \u0442\u0430| \u04B9\u04D9|\u0435\u0434\u0438|\u0430\u043B\u0430|\u043A\u0438\u043C|\u0433\u0443 |\u0438 \u0442|\u0443\u043B\u043C|\u043C\u04D9\u04BB|\u043D \u043E|\u0430\u0458\u0430|\u044B \u043E|\u0438\u0430\u043B| \u0441\u043E|\u0438\u043B\u043B|\u0441\u0438\u0458| \u0434\u04D9|\u0432\u0430\u0440|\u0438\u043D\u0441|\u043C\u0438 |\u0493\u044B |\u043D\u0438\u043A|\u0440 \u0438|\u0430\u0433\u043B|\u043A \u04BB|\u0442\u04D9\u043C|\u0442\u0430\u043C|\u0447\u04AF\u043D|\u04AF\u0447\u04AF| \u04AF\u0447|\u0493\u044B\u043D|\u0441\u0430\u0441|\u04D9\u0441\u0430|\u0437 \u04BB|\u04D9\u043C\u04D9|\u0437\u0430\u043C| \u0437\u0430|\u0441\u0442\u0438|\u0440\u04D9\u0444|\u043D \u0435|\u0440 \u0430|\u0438\u043B\u0434|\u04BB\u04D9\u043C|\u044B\u0433\u043B|\u0458\u0430\u043D|\u043C\u0430\u0458|\u043D \u04D9|\u043C\u04D9\u043D|\u043C\u0438\u043B| \u043C\u0438|\u04D9\u0433\u0438|\u0434\u0438\u043D|\u043D \u0434|\u0442\u04AF\u043D| \u0434\u04E9|\u043C\u0438\u0458|\u043A\u0430\u04BB|\u0438\u043A\u0430| \u043D\u0438|\u0444\u0430\u0434|\u0442\u0438\u0444|\u043B \u043E|\u0441\u04D9\u0440|\u0458\u043D\u0438| \u0435\u0458|\u0430\u043D\u0430|\u043B\u04D9\u043D|\u0430\u043C |\u0440\u0438\u043B|\u0430\u0458\u04D9|\u0430\u0448\u044B",
      koi: "\u043D\u044B |\u04E7\u043D | \u0431\u044B|\u0434\u0430 | \u043F\u0440|\u043B\u04E7\u043D|\u0440\u0430\u0432| \u043C\u043E|\u043F\u0440\u0430| \u0434\u0430|\u0431\u044B\u0434| \u0432\u0435|\u043E\u0440\u0442|\u043B\u04E7 |\u04E7\u0439 |\u043C\u043E\u0440|\u04E7\u043C |\u0430\u0432\u043E| \u043D\u0435|\u0432\u043E |\u044B\u0434 |\u044B\u0441 |\u043D\u04E7\u0439|\u044B\u043D |\u043C \u043F|\u0434 \u043C|\u044B\u043D\u044B|\u0442\u043D\u044B| \u0430\u0441|\u0442\u04E7\u043C|\u043B\u044C\u043D| \u044D\u043C|\u0432\u0435\u0440|\u0441\u044C |\u044C\u043D\u04E7|\u044D\u043C |\u043D \u044D|\u0442\u043B\u04E7| \u043A\u044B|\u0441\u04E7 | \u043F\u043E|\u0435\u0440\u043C|\u0441\u044C\u04E7|\u0440\u0442\u043B|\u0430\u043B\u044C| \u043A\u04E7|\u044D\u0437 | \u04E7\u0442|\u04E7 \u0432|\u0442\u043E |\u0435\u0442\u043E|\u043D\u0435\u0442|\u044B\u043B\u04E7| \u043A\u043E|\u0442\u0448\u04E7| \u043E\u0442| \u0438 |\u044B \u0441|\u0431\u044B |\u04E7 \u0431|\u0441\u0442\u0432|\u043A\u04E7\u0440| \u0432\u04E7|\u0448\u04E7\u043C|\u043A\u044B\u0442|\u0442\u0430 |\u043D\u0430 |\u0437 \u0432| \u0441\u0435| \u0434\u043E|\u0432\u043E\u043B|\u04E7\u0441 | \u0441\u044B|\u044B \u0430|\u043E\u043B\u0430|\u0440\u043C\u04E7|\u0430\u0441 |\u043E\u0437 | \u043E\u0437| \u0441\u0456|\u0430 \u0441|\u0442\u0432\u043E|\u0441 \u043E| \u0432\u044B|\u043B\u0456\u0441|\u04E7 \u043A|\u044B\u0442\u0448|\u04E7 \u0434|\u0438\u0441 |\u0456\u0441\u044C|\u04E7\u0442\u043D|\u0430\u0441\u044C| \u043E\u043B| \u043D\u0430|\u0430\u0446\u0438| \u044D\u0442|\u0430 \u0432|\u0437\u043B\u04E7|\u0441\u0435\u0442| \u0432\u043E| \u0447\u0443|\u043B\u0430\u0441|\u043B\u0430\u043D|\u043C\u04E7 |\u0442\u044B\u0441|\u0440\u0442\u044B|\u04E7\u0440\u0442|\u044B \u043F|\u04E7\u0442\u043B|\u043E \u0441|\u044D\u0442\u0430|\u0434\u0437 |\u043A\u04E7\u0442|\u04E7\u0434\u043D|\u0432\u043D\u044B| \u043C\u044B|\u043D \u043D|\u0443\u0434\u0436| \u0443\u0434|\u0432\u044B\u043B|\u04E7 \u043C|\u0440\u0442\u0456|\u043E\u0440\u0439|\u0438\u0441\u044C| \u0441\u043E|\u0432\u043E\u044D|\u044B\u0434\u04E7|\u0439 \u043E|\u043A\u043E\u043B| \u0433\u043E|\u0441 \u0441|\u0441\u0441\u0438|\u0441\u044B\u043B|\u044B\u0441\u043B|\u0439\u044B\u043D|\u043A\u0438\u043D|\u043E\u043B\u04E7|\u0442\u04E7\u043D| \u0441\u044C|\u0430\u043D\u0430|\u04E7\u0440 |\u0446\u0438\u044F|\u0430 \u0434|\u04E7\u043C\u04E7| \u0432\u0438|\u0437 \u043A| \u044D\u0437|\u044B \u0431|\u0442\u04E7\u0433|\u04E7\u0442 |\u043C\u04E7\u0434|\u0435\u0441\u0442|\u043E\u0441\u0442|\u04E7\u043D\u044B|\u0442\u0438\u0440|\u043E\u0442\u0438|\u0443\u043A\u04E7|\u0447\u0443\u043A|\u043D \u043F|\u043E\u043D\u0434|\u043F\u043E\u043D|\u0441\u043B\u04E7|\u043A\u0435\u0440| \u043A\u0435| \u043E\u0431|\u0441\u0438\u0441|\u0441\u0443\u0434|\u0430 \u043D|\u0434\u043E\u0440|\u043A\u043E\u043D|\u043D\u0435\u043A|\u043D \u0431|\u043B\u04E7\u0442|\u0441 \u0432|\u0442\u0456 |\u044C\u04E7\u0440|\u0442\u0440\u0430| \u0441\u0442|\u043D\u0430\u043B|\u043E\u043D\u0430|\u043D\u0430\u0446|\u043D \u043A|\u043A\u04E7\u0434|\u04E7\u0433 |\u0441\u043A\u04E7|\u0442\u044C |\u0435\u0442\u04E7|\u0434\u04E7\u0441|\u0431\u044B\u0442|\u0440\u043D\u044B|\u04E7 \u043D|\u0442\u0441\u04E7|\u0440\u0440\u0435|\u0430 \u0431|\u043D\u0434\u0430|\u0441 \u0434|\u0430\u0441\u0441|\u044B \u043A|\u0430\u0441\u043B| \u043B\u043E|\u044C\u043D\u044B|\u0441\u044C\u043D|\u044B \u043C|\u0435\u043A\u0438|\u044B \u0434| \u043C\u04E7|\u044C \u043C|\u044B \u043D|\u044B\u0442\u04E7| \u043C\u0435|\u0440\u0439\u04E7|\u0438\u0430\u043B|\u0439 \u0434|\u0438\u0442\u04E7|\u0430 \u043A|\u04E7\u0441\u044C|\u043C\u04E7\u0441|\u043E\u0432\u043D|\u0437\u044B\u043D|\u0430 \u043F|\u043E\u0442\u0441| \u043B\u0438|\u043E\u043B\u044F|\u04E7 \u0430|\u043E\u0441\u0443|\u04E7\u044F |\u043D\u04E7\u044F|\u0435\u0437\u043B|\u0440\u0435\u0437|\u043C\u0435\u0434|\u0441 \u043C| \u0441\u044D|\u044C \u043A|\u0440\u0439\u044B|\u0430\u043A\u043E|\u0437\u0430\u043A| \u0437\u0430|\u044C\u044B\u043D|\u043D\u043D\u0451|\u043C\u04E7\u043B|\u0443\u043C\u04E7| \u0443\u043C|\u044B \u0443|\u043D \u0432|\u043C \u0434|\u043D \u0441| \u0434\u0437|\u043D \u043E|\u0440\u0430\u043D|\u0441\u0442\u0440|\u043E\u0437\u044C|\u043F\u043E\u0437|\u0437 \u043F|\u043E \u0434|\u0446\u0438\u0430|\u043E\u0446\u0438|\u0441\u043E\u0446|\u0438\u043E\u043D|\u0430 \u043C|\u0435\u0441\u043A|\u0447\u0435\u0441|\u043D\u04E7 |\u0437 \u0434|\u0442\u0441\u044C|\u0431\u04E7\u0440| \u0431\u04E7| \u043E\u0432|\u0432\u0435\u0441|\u043A\u044B\u0434|\u04E7 \u0441|\u0432\u043E\u044B|\u043A\u043E\u0434|\u0442\u043A\u043E|\u04E7\u0442\u043A|\u043E\u043B\u044C|\u0434\u0431\u044B|\u0435\u0434\u0431|\u0441\u044C\u044B|\u0447\u044B\u043D|\u0442\u0447\u044B|\u04E7\u0442\u0447|\u0442\u043B\u0430|\u043C\u04E7\u043D|\u0441\u043B\u0430|\u0439\u04E7\u0437| \u0439\u04E7|\u0442 \u0432|\u044B \u0438|\u0435\u0437 |\u043E \u0432|\u043E\u043D\u044B|\u0439\u04E7 |\u0430\u043D\u043D|\u04E7\u043B\u044C| \u043F\u044B|\u0430\u043D |\u043D\u04E7\u0441|\u043D\u0438\u0442| \u0441\u0443|\u043C \u0441",
      bel: " \u043F\u0440|\u043F\u0440\u0430| \u0456 |\u0430\u0432\u0430|\u043D\u0430 |\u0440\u0430\u0432| \u043D\u0430| \u043F\u0430|\u043D\u044B |\u0432\u0430 |\u0430\u0431\u043E|\u0446\u044C | \u0430\u0431|\u0430\u0435 | \u043C\u0430|\u0430\u0432\u0435|\u0430\u043D\u043D|\u0430\u0446\u044B|\u0441\u0432\u0430| \u0441\u0432|\u0435 \u043F|\u043B\u044C\u043D| \u0447\u0430|\u043D\u0435 |\u043D\u043D\u044F|\u0430\u043B\u0430|\u0430 \u043D|\u0430\u0439 |\u043B\u0430\u0432|\u0447\u0430\u043B| \u043A\u043E| \u0430\u0434| \u043D\u0435|\u0433\u0430 |\u043E\u0436\u043D|\u043A\u043E\u0436|\u0432\u0435\u043A|\u043D\u044F | \u044F\u043A|\u0436\u043D\u044B|\u044B \u0447|\u043C\u0430\u0435|\u0430 \u043F|\u0430\u0433\u0430|\u0431\u043E |\u0435\u043A |\u0430 \u0430|\u0446\u0430 |\u0446\u0446\u0430| \u045E | \u0437\u0430|\u044B\u0445 |\u043F\u0430\u0432|\u0430 \u0441|\u0433\u043E |\u0432\u0456\u043D|\u0434\u043D\u0430|\u0431\u043E\u0434|\u043C\u0456 |\u0432\u0430\u0431|\u0432\u0430\u043D|\u0430\u043C | \u0432\u044B| \u0441\u0430| \u0434\u0430|\u0441\u0442\u0430|\u0430\u0432\u0456|\u043D\u043D\u0435|\u0430\u0441\u0446|\u043D\u0430\u0439|\u0446\u044B\u044F|\u043D\u0430\u0433|\u0430\u0440\u0430|\u0456 \u043D|\u043A \u043C|\u044F\u0433\u043E| \u044F\u0433|\u044C\u043D\u0430|\u043F\u0440\u044B|\u0430\u0446\u044C|\u0456 \u043F|\u043E\u0434\u043D|\u0441\u0442\u0432|\u0430\u043C\u0430|\u043D\u044B\u0445| \u0431\u044B|\u0442\u0432\u0430|\u0434\u0437\u0435|\u0430\u043B\u044C| \u0440\u0430|\u043D\u0456 |\u0456 \u0441|\u0456 \u0430|\u044B\u0446\u044C|\u0430 \u0431|\u0435\u043D\u043D|\u043B\u0435\u043D|\u0446\u0456 |\u043E\u045E\u043D|\u044B\u043C |\u0440\u0430\u0446|\u0456\u043D\u043D|\u0456\u0445 | \u0430\u0441| \u0442\u0430|\u0442\u043E |\u043D\u0430\u0441|\u044F\u043A\u0456| \u0434\u0437|\u0447\u044B\u043D|\u043E\u043B\u044C|\u0456 \u0434|\u0430\u0432\u043E|\u0430\u0434 | \u043D\u0456|\u0441\u0446\u0456|\u044B\u043C\u0456|\u043D\u044B\u043C|\u0431\u044B\u0446|\u044F \u043F|\u044C\u043D\u044B|\u044B\u044F |\u0430\u0440\u043E|\u0430\u043D\u0430|\u0456\u043D\u0430|\u0456 \u0456|\u0440\u0430\u0434| \u0433\u0440|\u043B\u044F |\u045E\u043B\u0435|\u043E \u043F|\u0430 \u045E|\u0440\u044B\u043C|\u043F\u0430\u0434|\u044B\u0456 | \u0456\u043D|\u0430\u043C\u0456|\u0434\u0437\u044F|\u0440\u0430\u043C|\u0446\u044B\u0456|\u0430\u0431\u0430|\u0430 \u0456|\u0434\u0443 |\u0436\u043D\u0430|\u045E\u043D\u0430|\u043D\u0430\u043B|\u043D\u0430\u0446|\u0440\u044B |\u044D\u0442\u0430|\u0433\u044D\u0442| \u0433\u044D|\u043D\u0435\u043D|\u0434\u0430 |\u0430\u0445 |\u0433\u0440\u0430|\u043A\u0430\u0446|\u0443\u043A\u0430|\u0430 \u0437|\u043A\u0456 |\u0430\u0434\u0441|\u045E \u0456|\u043D\u0441\u0442|\u044D\u043D\u043D|\u044F \u0430|\u043D\u043D\u0456|\u043E\u0434\u0443|\u0430 \u0440|\u043D\u043D\u0430|\u0445\u043E\u0434|\u043D\u0430\u043D|\u043F\u0435\u0440|\u0445 \u043F| \u0443 |\u0430\u0434\u0437|\u0456 \u0440|\u043C\u0430\u0434|\u043C \u043F|\u0435 \u043C|\u0430\u0434\u0443|\u0434\u0441\u0442|\u0434\u043B\u044F| \u0434\u043B|\u043E\u045E |\u043D\u0430\u0435|\u0456 \u043C|\u0430\u043A\u043E| \u043A\u0430|\u044B \u045E|\u0431\u0430\u0440|\u0435 \u0430|\u0430\u0446\u0446|\u0443\u044E |\u044B\u0446\u0446|\u0441\u0430\u043C|\u044F\u045E\u043B|\u0430\u043B\u0435|\u0440\u043E\u0434|\u0440\u0430\u0431| \u043F\u0435|\u0448\u0442\u043E| \u045E\u0441|\u0430\u0434\u043D| \u0441\u0443|\u0440\u043E\u045E| \u0440\u043E|\u0434\u0443\u043A|\u043B\u044E\u0431|\u044C \u0441| \u0448\u043B|\u0440\u0430\u0437|\u043D\u0430\u0432|\u0437\u043D\u0430|\u0432\u043E\u043B|\u0443\u0434\u0437|\u0430\u0434\u0430|\u0436\u044B\u0446|\u0447\u043D\u0430|\u0432\u0435 |\u0430 \u0442|\u0430\u0441\u043D|\u0441\u0430\u0446|\u0435\u0440\u0430| \u0440\u044D|\u044F\u043A\u043E|\u043A\u043B\u0430|\u0430\u043D\u044B| \u0448\u0442|\u044C \u0443|\u0430\u044E\u0446|\u043D\u0430\u0440| \u0443\u0441|\u0441\u043E\u0431|\u0430\u0441\u043E|\u043F\u0430\u043C|\u044F \u045E|\u0430\u0432\u044F|\u0447\u044D\u043D|\u0432\u043E\u045E|\u0442\u0430\u043A|\u043D\u0443 |\u044E \u0430|\u044C \u043F|\u0437\u0430\u043A|\u043A\u0430\u0440|\u0435 \u0456|\u044C \u0430|\u0431\u0435\u0441|\u0456\u044F |\u043A\u0456\u044F|\u0445 \u0456|\u0437\u0430\u0431|\u0430\u0441\u0430|\u0456\u043C |\u0436\u0430\u0432|\u0456 \u0437|\u043B\u0435\u0436|\u0442\u0430\u043D|\u0430\u0445\u043E|\u044F\u043B\u044C|\u044B\u044F\u043B|\u043E \u0441|\u044F\u043D\u0430|\u043A\u0430\u043D|\u0430\u043A\u0430|\u0456\u043D\u0448|\u0430\u043B\u0456|\u0432\u044B | \u043C\u043E|\u043D\u0430\u0445|\u044F \u044F|\u043C \u043D|\u043E\u0433\u0430| \u0431\u0435|\u0439 \u0434|\u043E \u0430| \u0441\u0442|\u0435\u043D\u044B|\u0456 \u045E|\u0430 \u0434|\u0435\u0441\u043F|\u0448\u043B\u044E|\u0446\u0446\u044F|\u044B \u0456|\u044B\u0441\u0442|\u0440\u044B\u0441|\u043B\u044E\u0447|\u043A\u043B\u044E|\u0442\u0430\u0446|\u0443\u043B\u044C|\u044B\u043D\u0441|\u0430\u0447\u044B|\u0441\u043F\u0440| \u0441\u043F|\u0430\u045E |\u044B\u043C\u0430|\u0430\u0440\u044B|\u043A\u0430\u043C|\u0435 \u045E|\u0456 \u043A|\u043A\u043E\u043D",
      bul: " \u043D\u0430|\u043D\u0430 | \u043F\u0440|\u0442\u043E | \u0438 |\u0440\u0430\u0432|\u0434\u0430 | \u0434\u0430|\u043F\u0440\u0430|\u0441\u0442\u0432|\u0432\u0430 |\u0430 \u0441|\u0430 \u043F|\u0432\u043E |\u043D\u043E |\u0438\u0442\u0435|\u0442\u0430 |\u043E \u0438|\u0435\u043D\u0438| \u0437\u0430|\u043D\u0435 | \u043D\u0435|\u0430 \u043D| \u0432\u0441|\u0432\u0430\u043D|\u0430\u0432\u043E|\u043E\u0442\u043E|\u0435 \u043D|\u043E \u043D|\u0430 \u0438|\u043A\u0438 |\u0438\u0435 |\u0442\u0435 |\u043D\u0438 |\u0438\u043C\u0430| \u0438\u043C|\u043B\u0438 |\u0438\u043B\u0438|\u0438\u044F | \u043F\u043E|\u043E\u0432\u0435|\u0430\u043D\u0435|\u0447\u043E\u0432|\u043C\u0430 | \u0447\u043E|\u0438 \u0447|\u0430 \u0434|\u043D\u0438\u0435|\u0438 \u0434|\u0435\u0441\u0442| \u0438\u043B|\u0430\u043D\u0438|\u0432\u0435\u043A|\u0432\u0441\u0435| \u043E\u0431|\u0435\u043A |\u0435\u043A\u0438|\u0441\u0435\u043A|\u0430\u0432\u0430|\u0442\u0432\u043E|\u0441\u0432\u043E| \u0441\u0432|\u0432\u043E\u0442|\u0430 \u0432|\u0438 \u0441|\u043E\u0441\u0442| \u0440\u0430|\u043E\u0432\u0430|\u0430 \u043E|\u0435 \u0438|\u0432\u0430\u0442|\u0438 \u043D|\u0435 \u043F|\u043A \u0438|\u0430 \u0431| \u0432 |\u0438 \u043F|\u043B\u043D\u043E|\u043E \u0434| \u0441\u0435|\u0440\u0430\u0437|\u0435\u0442\u043E|\u044A\u0434\u0435|\u0431\u044A\u0434| \u0431\u044A|\u043F\u0440\u0438|\u0430\u0442\u0430| \u043A\u043E| \u0442\u0440| \u043E\u0441| \u0441\u044A|\u0431\u043E\u0434|\u043E\u0431\u043E|\u0432\u043E\u0431|\u0430\u0442 |\u0437\u0430 |\u0442\u0435\u043B| \u0435 |\u0430\u0446\u0438|\u043E \u0441|\u0434\u0435 |\u043E \u043F|\u0435\u043D |\u0431\u0440\u0430|\u0438 \u0432| \u043E\u0442|\u0441\u0435 |\u043D\u0438\u044F|\u0430\u043B\u043D| \u0434\u0435|\u0435\u0433\u043E|\u043D\u0435\u0433| \u0438\u0437|\u043E\u0442 |\u0440\u0430\u043D|\u044F\u0442\u0430|\u043A\u0430\u043A|\u043E\u0434\u0438|\u0435 \u0441|\u0438 \u0438|\u0434\u0435\u043D|\u043F\u0440\u0435|\u0431\u0432\u0430|\u044F\u0431\u0432|\u0440\u044F\u0431|\u0442\u0440\u044F|\u043D\u0438\u0442| \u043A\u0430|\u044F\u0432\u0430|\u043F\u0440\u043E|\u0441\u0442 |\u0430 \u0437|\u0433\u043E\u0432|\u0432\u0435\u043D|\u0442\u0432\u0435|\u043E \u043E|\u0430 \u0440|\u0430\u043A\u0432|\u043E \u0432|\u0438 \u0437|\u0440\u0435\u0434|\u043D\u043E\u0441|\u0438\u044F\u0442|\u0435 \u0434|\u0449\u0435\u0441|\u043D\u043E\u0432| \u043D\u0438|\u0446\u0438\u044F| \u0434\u043E|\u0439\u0441\u0442|\u043E \u0442|\u0435 \u0442|\u0440\u0436\u0430|\u044A\u0440\u0436|\u0434\u044A\u0440|\u0435\u043D\u043E|\u043F\u043E\u043B| \u0441 |\u043E\u0431\u0440|\u0442\u0432\u0430|\u043D\u043E\u0442|\u0440\u0435\u0441|\u0435\u0439\u0441|\u0438 \u043E|\u0435 \u0432|\u043A\u043E\u0439|\u043E\u0431\u0449|\u043B\u0435\u043D|\u043E\u043D\u0430|\u043D\u0430\u0446|\u0438\u0447\u0435|\u0435\u0437 |\u0431\u0435\u0437| \u0431\u0435|\u0435\u0436\u0434|\u0443\u0432\u0430|\u0432\u0438\u0442|\u0440\u0438 |\u0437\u0430\u043A|\u0438 \u043A| \u043B\u0438|\u0430 \u0435|\u043F\u043E\u0434|\u0435\u043B\u0438|\u043D\u0438\u043A|\u0441\u0438 |\u0435 \u043E|\u0430 \u0442|\u0430\u0432\u043D|\u0438 \u0440|\u0442 \u0441|\u043A\u0430 |\u043E\u0435\u0442|\u0435\u043B\u043D|\u043D\u0435\u043D|\u043E\u0439 |\u0433\u0440\u0430|\u0436\u0435\u043D|\u0434\u0440\u0443| \u0440\u0435|\u0430 \u043A|\u0441\u043D\u043E|\u043E\u0441\u043D|\u043B\u0438\u0447|\u0437\u0438 | \u0442\u0430|\u0441\u0430 |\u043D\u0441\u0442|\u0432\u043D\u0438|\u0447\u043A\u0438|\u0438\u0447\u043A|\u0441\u0438\u0447|\u0432\u0441\u0438|\u043B\u044E\u0447|\u043A\u043B\u044E|\u0434\u043D\u043E| \u043C\u043E|\u0435\u043C\u0435|\u0430 \u0443|\u0438\u0437\u0432|\u0442\u0432\u0438|\u0434\u0435\u0439|\u044F \u043D|\u043A\u0440\u0438|\u0430\u0442\u043E|\u043E \u0440|\u0439 \u043D|\u0438\u043A\u043E|\u0438\u0447\u043D|\u0436\u0430\u0432| \u0434\u044A| \u0442\u043E|\u0431\u0449\u0435|\u0438\u0430\u043B| \u0441\u043E|\u043B\u0438\u0442|\u0442 \u043D| \u0441\u0438|\u0442 \u0438|\u043E\u0434\u043D|\u0436\u0434\u0430|\u0437\u043E\u0432|\u0430\u0437\u043E|\u0443\u0447\u0430| \u0433\u0440|\u043A\u043E\u0435|\u0442\u044A\u043F|\u0441\u0442\u044A|\u0432\u043E\u043B|\u043B\u043D\u0438|\u0441\u0440\u0435| \u0441\u0440|\u043A\u0432\u0430|\u043A\u043E\u043D|\u0442\u043D\u043E|\u0430\u043A\u0430|\u0438 \u0443|\u043A\u043E |\u0433\u0430\u043D|\u043E\u0434\u0430|\u0447\u0435\u043D|\u043B\u0441\u0442|\u0435\u043B\u0441|\u0441\u0442\u0440| \u043A\u044A|\u0441\u0442\u0430|\u0440\u043E\u0434|\u043D\u0430\u0440|\u0438 \u043C|\u043D\u0430\u043B|\u0440\u0443\u0433| \u0434\u0440|\u0447\u0435\u0441|\u0432\u044A\u0437|\u0434\u0438 | \u0441\u0430| \u0442\u0435|\u0441\u0442\u043E|\u0434\u043E\u0441|\u0440\u0430\u0436|\u0440\u0435\u0437|\u0447\u0440\u0435|\u0433\u0430\u0442|\u0435\u043E\u0431|\u0430 \u043C|\u043E \u0435|\u0438\u043D\u0435|\u0430\u0441\u0442|\u043E\u0432\u043E|\u0447\u043D\u043E|\u0430\u0432\u0435|\u043C\u0443 | \u043C\u0443|\u0430\u043D\u043E|\u0438\u0442\u0430|\u0438\u043C\u0438|\u0430\u043A\u043E|\u043D\u0430\u043A|\u043B\u0430\u0433|\u043E\u0432\u0438",
      kaz: "\u043D\u0435 | \u049B\u04B1|\u0435\u043D |\u04B1\u049B\u044B| \u0431\u0430| \u049B\u0430|\u049B\u04B1\u049B|\u044B\u049B |\u0493\u0430 | \u0436\u04D9|\u04D9\u043D\u0435|\u0436\u04D9\u043D| \u043D\u0435| \u0431\u043E|\u0434\u0435 |\u0434\u0430\u043C|\u0430\u0434\u0430|\u0430 \u049B|\u0442\u0430\u0440|\u044B\u043D\u0430| \u0430\u0434|\u044B\u043B\u044B| \u04D9\u0440|\u044B\u04A3 |\u0430\u043D |\u0456\u043D |\u049B\u044B\u043B|\u0430\u0440 |\u0435\u043C\u0435|\u043D\u0430 |\u0440 \u0430|\u043B\u044B\u049B|\u0443\u0493\u0430|\u0430\u043B\u0430|\u044B\u049B\u0442| \u04E9\u0437|\u043C\u0435\u0441|\u04D9\u0440 | \u0436\u0430|\u043C\u0435\u043D|\u044B\u0493\u044B|\u043B\u044B | \u0434\u0435|\u049B\u0442\u0430|\u043D\u044B\u04A3|\u043D \u049B|\u0493\u0430\u043D|\u0456\u043D\u0435|\u0431\u0430\u0441|\u0430\u0440\u044B| \u043C\u0435| \u049B\u043E|\u0435\u043A\u0435|\u044B\u043D |\u0434\u0430 |\u0435 \u049B|\u0434\u044B |\u0430\u0441\u044B|\u0441\u0435 |\u0435\u0441\u0435|\u0430\u043C |\u0431\u043E\u043B|\u0430\u043D\u0434|\u043D\u0435\u043C| \u0431\u0456|\u0430\u0440\u0430|\u044B \u0431|\u0441\u0442\u0430|\u0442\u0430\u043D|\u043D\u0434\u044B|\u043D \u0431|\u0456\u04A3 |\u0435 \u0431|\u0456\u043B\u0456|\u0442\u0438\u0456| \u0442\u0438|\u0431\u0430\u0440|\u0493\u044B |\u043D\u0434\u0435|\u0435\u0442\u0442|\u0438\u0456\u0441|\u049B\u044B\u0493|\u0456\u0441 |\u043B\u0430\u0440|\u0433\u0435 |\u044B \u0442|\u0456\u043D\u0434|\u0456\u043A |\u0431\u0456\u0440| \u0431\u0435| \u043A\u0435|\u0430\u043B\u0443|\u0435 \u0430|\u0430\u043B\u044B|\u043B\u0443\u044B|\u0430 \u0436|\u0435\u0440\u0456|\u043E\u043B\u044B| \u0442\u0435|\u049B\u044B\u049B|\u043D \u043A| \u0442\u0430|\u043D \u0436|\u0493\u044B\u043D|\u0442\u0442\u0456|\u0456\u043D\u0456|\u0442\u044B\u043D| \u0435\u0440|\u043D\u0434\u0430|\u0456\u043C | \u0441\u0430|\u0435 \u0436|\u0430\u0442\u044B| \u0430\u0440|\u0440\u0493\u0430|\u0435\u0442\u0456|\u0430\u043D\u0430|\u044B \u04D9|\u0443\u044B\u043D|\u043B\u0493\u0430|\u04E9\u0437\u0456|\u043E\u0441\u0442|\u0435\u0433\u0456|\u0442\u0456\u043A|\u049B\u0430 |\u0441\u049B\u0430|\u0440\u044B\u043D|\u043A\u0456\u043D|\u043B\u0443\u0493|\u04A3 \u049B|\u043D\u0456\u04A3|\u0443\u044B |\u0431\u043E\u0441|\u0430\u0441\u049B|\u049B\u0430\u0440|\u0434\u044B\u049B|\u043D\u0430\u043D|\u043C\u044B\u0441|\u043C\u043D\u044B|\u0430\u043C\u043D|\u044B \u043C|\u0430\u0439\u0434|\u043A\u0435 | \u0436\u0435|\u0437\u0456\u043D|\u0440\u0434\u0435|\u0440\u0456\u043D|\u0435 \u0442|\u0433\u0435\u043D|\u044B\u043F |\u0440\u044B |\u0442\u0456 |\u0441\u044B\u043D|\u049B\u0430\u043C|\u0434\u0435\u043D|\u0456 \u0431|\u0433\u0456\u0437|\u0440\u0430\u043B|\u0435 \u04E9|\u043B\u0430\u043D|\u0441\u044B |\u0430\u043C\u0430|\u0442\u0442\u0430|\u0442\u044B\u049B|\u0431\u0435\u0440|\u0434\u0456 |\u0431\u0456\u043B|\u0440\u043A\u0456|\u04E9\u0437 |\u0437\u0434\u0435|\u043A\u0435\u0442|\u049B\u043E\u0440|\u0434\u0430\u0439|\u0443\u0433\u0435|\u044B \u0435|\u044B\u043D\u0434|\u043D\u0435\u0433|\u043E\u043D\u044B|\u0435\u0439 |\u043C\u0435\u0442|\u0430\u043D\u044B|\u0430 \u0442|\u0436\u0430\u0441|\u0430\u0443\u044B|\u043B\u0433\u0435|\u0430\u0441\u0430|\u0435\u0433\u0435|\u0434\u0430\u0440|\u0440\u0443 |\u0430\u0443 |\u0435\u0440\u043A|\u044B \u0436|\u0440\u044B\u043B| \u0442\u043E|\u043D \u043D|\u0435 \u043D|\u0442\u0456\u043D|\u0456\u0440 |\u0441\u0456\u0437|\u0442\u0435\u0440|\u043B\u043C\u0430|\u0456 \u0442|\u043A\u0456\u043C| \u0430\u043B|\u0440 \u043C|\u043B\u0456\u043A| \u043C\u04AF|\u0435 \u043C|\u0442\u04AF\u0440| \u0442\u04AF|\u043A\u0435\u043B|\u043B\u044B\u043F|\u0435\u04A3 |\u0442\u0435\u04A3|\u0440\u043B\u044B|\u043B\u0456\u043C|\u0440\u0434\u044B|\u0430\u0440\u0434|\u0430\u0442\u0442|\u0441 \u0431|\u044B\u0440\u044B|\u0441\u044B\u0437|\u044B\u0441 |\u0435\u043B\u0433|\u0434\u0430\u043B|\u0439\u0434\u0430|\u043E\u0440\u0493|\u0440\u049B\u044B|\u0430\u0440\u049B| \u0436\u04AF|\u0442\u0430\u043B|\u044B\u043B\u043C|\u0430 \u0431|\u0456\u0433\u0456|\u043B\u0434\u0435|\u0456\u0437 |\u049B\u0442\u044B| \u0435\u0448|\u0434\u0435\u0439|\u0430\u0439 |\u0436\u0430\u0493|\u043A\u0442\u0456|\u0456\u043A\u0442|\u0433\u0456\u043D| \u04D9\u043B|\u0442\u0442\u044B|\u04B1\u043B\u0442| \u04B1\u043B|\u0435 \u0434|\u044B\u043D\u044B|\u043B\u0456\u043D|\u0440 \u0431|\u0435\u043B\u0435|\u043A\u04B1\u049B| \u043A\u04B1|\u0430\u043C\u0434|\u043C \u0431| \u0435\u0442|\u043E\u0493\u0430|\u049B\u04B1\u0440| \u043A\u04E9|\u0430\u0493\u0430|\u0442\u043E\u043B|\u0448\u0456\u043D|\u0430\u0439\u044B| \u049B\u044B|\u049B\u0430\u043B|\u0436\u0435\u043A|\u0456 \u043D|\u0435\u0441 |\u0430\u0493\u044B|\u0435 \u043E|\u0435\u043B\u0456| \u0435\u043B|\u043D \u0435|\u0437\u0456 |\u0448\u043A\u0456|\u0435\u0448\u043A|\u043E\u043B\u0443|\u0446\u0438\u044F|\u043C\u0430\u0441|\u0493\u0434\u0430|\u0430\u0493\u0434|\u043B\u0442\u0442|\u0456\u043C\u0434|\u043D\u044B\u043C| \u0434\u0430|\u0430 \u0434|\u04D9\u0441\u0456|\u0441 \u04D9|\u049B\u0430\u0442|\u0456\u0440\u0456| \u0441\u043E|\u04A3 \u0431|\u0430\u0437\u0430|\u043C\u0434\u0430|\u0430\u0439\u043B| \u0430\u0441|\u0493\u0430\u043C|\u049B\u043E\u0493",
      tat: " \u04BB\u04D9|\u043B\u0430\u0440|\u0433\u0430 |\u043A\u0443\u043A|\u043E\u043A\u0443|\u0445\u043E\u043A| \u0445\u043E|\u04D9\u043C |\u0440\u0433\u0430|\u04BB\u04D9\u043C| \u043A\u0435| \u0431\u0435|\u0430\u0440 |\u0435\u0448\u0435|\u04D9\u0440 |\u0430\u043D |\u043A\u0435\u0448|\u043B\u04D9\u0440|\u0433\u04D9 | \u0431\u0430|\u0435\u04A3 |\u043D\u0435\u04A3| \u0431\u0443|\u043A\u043B\u0430|\u0440\u0433\u04D9|\u044B\u0440\u0433|\u04BB\u04D9\u0440| \u0442\u0438| \u0442\u043E|\u0440 \u043A|\u0434\u0430 |\u0435\u043D\u0435|\u0431\u0435\u0440|\u04D9\u043D |\u0434\u04D9 | \u04AF\u0437|\u0430 \u0442|\u0442\u043E\u0440|\u0435\u043D | \u043A\u0430|\u043D\u04D9 | \u0430\u043B|\u044B \u0431|\u043D\u0430 |\u0433\u0430\u043D|\u0430\u0440\u0430|\u0438\u0440\u0435|\u0431\u0443\u043B| \u0434\u04D9|\u0431\u0430\u0440|\u0435\u043D\u04D9|\u0443\u043A\u043B|\u0442\u0438\u0435|\u0430 \u0445| \u0438\u0442|\u0438\u0435\u0448|\u0430\u0440\u044B|\u043A\u044B |\u043A\u0430 |\u04D9 \u0442|\u043D \u0431|\u0443\u043A\u044B| \u0438\u0440|\u0435\u043A\u043B|\u0435\u043B\u0435|\u044B\u043D\u0430|\u0448\u0435 |\u0430\u043B\u0430|\u043D \u0442|\u043B\u044B\u043A|\u043B\u0435 |\u0448\u0435\u043D|\u0435\u0448 |\u043A\u0430\u0440|\u043B\u044B |\u043B\u0430\u043D|\u043B\u04D9\u043D|\u0440\u044B\u043D|\u04D9 \u043A|\u0435\u043B\u04D9|\u0435\u0440\u0433|\u043D\u0434\u0430|\u0440\u0435\u043A|\u0442\u0435\u043B|\u0435\u0437 |\u0438\u0442\u0435|\u0430 \u043A|\u0431\u0435\u043B| \u0442\u0430|\u043B\u044B\u0440|\u04D9 \u0431|\u044B\u043D | \u0433\u0430|\u0435\u043B |\u0441\u04D9 | \u044F\u043A|\u0430\u043B\u044B|\u04D9\u0440\u0433|\u0430 \u0431|\u044F\u0438\u0441| \u044F\u0438|\u0442\u04D9 |\u0434\u0430\u043D|\u0430 \u0430|\u04AF\u0437 |\u04D9 \u0445|\u0448 \u0442|\u0435 \u0431|\u044B\u043D\u0434|\u0441\u0435\u0437|\u043A\u043B\u04D9|\u0438\u0441\u04D9|\u0440 \u0431|\u0443\u043B\u044B| \u044D\u0448|\u0447\u0435\u043D|\u0430 \u04BB|\u0435\u043C | \u0441\u0430|\u043D \u0438|\u0448\u043A\u0430|\u0442\u0435\u043D|\u04AF\u0437\u0435|\u044B \u04BB|\u04D9\u0442 |\u044F\u0442\u044C|\u0433\u0435\u0437|\u0438\u0433\u0435|\u0430\u043D\u044B|\u04D9 \u04BB|\u043E\u0440\u043C| \u0442\u04AF| \u0445\u0430| \u0442\u04D9| \u043D\u0438|\u0440 \u04BB| \u0442\u0443|\u043C\u04D9\u0442|\u043A\u043B\u0435|\u04AF\u043B\u04D9|\u043B\u0443 |\u0442\u044C |\u043C \u0430|\u043B\u0433\u0430|\u0448\u0442\u04D9| \u043A\u0438|\u043C \u0438| \u043C\u04D9|\u043D\u0435 |\u043B\u0435\u043A|\u043C\u044B\u0448|\u0440\u043C\u044B|\u0433\u0435\u043B|\u0442\u04AF\u0433|\u043B\u0435\u0440|\u0434\u0438 |\u0437\u0435\u043D|\u0443\u0433\u0430|\u0441\u0435\u043D|\u0433\u04D9\u043D|\u0430\u043A\u044B|\u043A\u043B\u044B|\u043B\u04D9\u0442|\u0430\u043B\u0443|\u043D\u044B |\u0435\u0448\u0442|\u0432\u0435\u0448|\u04D9\u0432\u0435|\u0440\u04D9\u0432| \u0440\u04D9|\u0442\u04D9\u0440|\u0440\u043B\u04D9|\u04AF\u0433\u0435|\u0430 \u044F|\u043B\u044C |\u0440\u0435\u043D|\u0431\u0430\u0448|\u04D9 \u0434|\u04D9 \u0438|\u0438\u043B\u043B|\u0435\u0440 |\u0440 \u0430|\u0446\u0438\u0430|\u043E\u0446\u0438|\u0441\u043E\u0446|\u0430\u0439\u043B|\u0440\u0434\u04D9| \u0430\u0448|\u0440\u0430\u043A|\u0440\u0434\u0430|\u0430\u0440\u0434|\u0440\u043D\u0435|\u04D9\u0440\u043D|\u044F\u043A\u043B|\u043B\u04D9 | \u0497\u04D9|\u043D \u043C|\u044B\u04A3 |\u043D\u044B\u04A3|\u043A\u043A\u0430|\u04D9\u0440\u0435|\u043E\u0440\u0433|\u0442\u0430\u043D|\u043C\u0430\u0441|\u0441\u044B\u043D|\u043D\u0434\u0438|\u0438\u043D\u0434|\u043D\u0438\u043D|\u0440\u0435\u043B| \u0431\u0438|\u044B\u043A |\u043B\u0435\u043C|\u0430\u043B\u044C|\u043D\u0438 |\u0438\u043D |\u043A\u0435\u0440|\u043C \u0442|\u04D9\u04AF\u043B|\u0448\u043B\u0430|\u043D \u044F|\u0442\u044B\u043D|\u043D\u0434\u04D9| \u043E\u0447|\u0431\u0443 |\u043A\u043E\u043D|\u0430 \u0434|\u0430\u0440\u0442|\u043A\u0435\u043C|\u0440\u043A\u0435|\u044B\u043B\u044B|\u043A\u0442\u0430|\u043A\u04D9 | \u0438\u043B|\u0440 \u0438|\u0435\u0440\u04D9| \u0497\u0438|\u04A3 \u0442|\u0446\u0438\u044F|\u0430 \u0438|\u0430\u0448\u043A| \u0441\u04D9| \u0434\u0438|\u0430\u0441\u044B|\u044B\u0439 |\u043C\u0438\u043B| \u043C\u0438| \u043C\u04E9|\u0442\u0430 |\u043B \u04BB|\u043D\u043D\u0430|\u0433\u044B\u043D|\u0438\u0430\u043B| \u0441\u043E|\u0437\u043C\u04D9|\u0435\u0437\u043C|\u0445\u0435\u0437| \u0445\u0435|\u044B\u044F\u0442|\u0433\u044B\u044F|\u043C\u0433\u044B|\u0448\u044B\u0440|\u04D9 \u044F|\u0435\u0440\u043B|\u043D\u043B\u044B|\u0435\u0440\u0435| \u043A\u044B|\u0435\u043A |\u0443\u0440\u044B|\u0442\u044B\u0440|\u043D \u0445|\u0435\u043B\u04AF|\u0430\u043A\u043E|\u0437\u0430\u043A| \u0437\u0430|\u0438\u0442\u04D9| \u0434\u0430|\u0447\u0430\u0440|\u043D\u044B\u0440| \u043A\u043E| \u0430\u043D|\u0438\u043B\u0435|\u04D9\u0441\u0435|\u044B\u0448 |\u0430\u0446\u0438| \u0434\u0435|\u0430\u0435\u0440| \u0430\u0435|\u0430\u043D\u0443|\u0438\u043D\u0430|\u04D9 \u0441| \u0442\u04E9|\u04D9\u0442\u0435|\u0430\u043D\u0430|\u043D \u04BB|\u0431\u0438\u0440|\u043D\u0430\u043D|\u0440\u044B |\u0439\u043B\u0430|\u04D9 \u0430|\u04D9\u043B\u04D9",
      tuk: " \u0431\u0438| \u0432\u0435|\u0432\u0435 |\u0434\u0430 |\u043B\u0430\u0440|\u0438\u0440 |\u0431\u0438\u0440| \u0445\u0435|\u0430\u0434\u0430|\u0440 \u0431| \u0445\u0430|\u0435\u0440 | \u0430\u0434|\u0433\u0430 |\u0438\u043B\u0438|\u0434\u044B\u0440|\u0434\u0430\u043C|\u0435\u043D |\u044B\u0440 |\u0430\u0440\u0430|\u0430\u0440\u044B|\u0445\u0435\u0440|\u043B\u0430\u043D|\u0440 \u0430|\u044B\u0434\u044B|\u0440 \u0445|\u0430\u043C |\u043A\u043B\u0430|\u0430\u0433\u0430|\u0430\u043B\u0430|\u043D\u0434\u0430|\u0431\u0438\u043B|\u0445\u0430\u043A|\u043A\u043B\u044B|\u0430\u043A\u043B|\u043B\u044B\u0434|\u043B\u044B | \u0431\u043E| \u04E9\u0437|\u044B\u04A3 |\u0430\u043D |\u2010\u0434\u0430|\u043B\u0435\u043D|\u044B\u043D\u044B|\u043C\u0430\u0433|\u043D\u0435 |\u043B\u0435\u0440|\u0438\u043D |\u044F\u2010\u0434| \u044F\u2010|\u0438\u043D\u0435|\u043D\u0430 | \u044D\u0434|\u0430 \u0445|\u044B\u043D\u0430|\u044B\u043D\u0434|\u0434\u0430\u043D|\u0443\u043A\u0443|\u0445\u0443\u043A| \u0445\u0443|\u043D\u044B |\u043B\u043C\u0430|\u0435 \u0445|\u0438\u043B\u0435|\u0435\u0440\u0438| \u0434\u0435|\u0433\u0435 |\u0438\u04A3 |\u043B\u0438 |\u0430\u0442\u043B|\u0430\u043B\u044B|\u0430\u0440 |\u0434\u0435\u043D|\u0435\u0440\u0435| \u0431\u0430|\u0434\u0438\u043B|\u043B\u0438\u0433| \u0433\u0430|\u0430\u0441\u044B|\u043B\u0438\u043A|\u043B\u044B\u0433|\u0430 \u0433|\u043A\u0438\u043D|\u0431\u043E\u043B|\u043A\u0443\u043A|\u04E9\u0437 |\u0435 \u0430|\u0430\u043C\u0430|\u0434\u0435 |\u044D\u0440\u043A|\u0440\u044B\u043D| \u044D\u0440| \u0445\u0438|\u0438\u043D\u0438|\u0433\u044B\u043D|\u0438\u0433\u0438|\u0430\u0439\u044B|\u0430 \u0434| \u043C\u0430|\u043C\u0430\u043A|\u043F \u0431|\u0430\u043D\u044B|\u044D\u0434\u0438|\u043D\u0438 |\u044B\u0433\u044B|\u0431\u0430\u0448|\u043B\u044B\u043A|\u0439\u0434\u0430|\u0440\u043A\u0438|\u04D9\u0433\u0435|\u0435\u0442\u0438|\u0438\u0447 |\u0445\u0438\u0447| \u0442\u0430|\u0430\u043A |\u0448\u0433\u0430|\u0430\u0448\u0433|\u0441\u044B\u043D|\u043C\u0430\u043B| \u0434\u043E|\u0433\u0434\u0430|\u044B \u0431|\u0440\u044B |\u0433\u0438 |\u043C\u04D9\u0433| \u0497\u0435|\u044B\u0435\u0442|\u0441\u0430\u0441|\u044D\u0441\u0430| \u044D\u0441|\u043B\u043C\u0435|\u0438\u043B\u043C|\u043C\u0435\u0437|\u0438\u043F |\u044B\u043A\u043B|\u0442\u043B\u044B|\u043D \u044D|\u0434\u0430\u043A|\u0434\u0430\u0439|\u044F\u0433\u0434| \u044F\u0433|\u0443\u043A\u043B|\u0445\u0435\u043C|\u0433\u0430\u043B|\u044B \u0432|\u0447\u0438\u043D|\u0438\u043C |\u043C\u0435\u043A|\u0440\u0438\u043B|\u044F\u043D |\u0440\u0438\u043D| \u0441\u0435|\u0430\u043B |\u04D9\u043D |\u0439\u04D9\u043D|\u043D\u044B\u04A3|\u0430 \u0431|\u0434\u0438\u0440|\u043E\u043B\u0430| \u043A\u0430|\u043D\u0434\u0435|\u044B \u0434|\u0441\u044B |\u043B\u0438\u043D|\u0435 \u0434|\u0433\u0438\u043D|\u0437\u0430\u0442|\u0430 \u0432|\u0435\u043A\u043B|\u043A\u044B |\u0430\u043A\u044B|\u043D \u043C|\u043A\u0430\u043D|\u044B\u043B\u044B| \u0441\u0430| \u0434\u04D9|\u0445\u0430\u043B|\u0434\u043E\u043B|\u0447\u0438\u043B| \u0433\u04E9|\u0442\u043C\u0435| \u0433\u0435|\u043D \u0445|\u0430 \u0430|\u0430\u0439\u0434|\u0434\u0435\u04A3| \u0430\u043B|\u043B\u0435\u0442| \u0434\u04E9| \u0438\u0448|\u043D \u0433|\u0435 \u0431|\u0443\u04A3 | \u0433\u0443|\u0434\u04D9\u043B| \u0433\u043E|\u0438\u0440\u0438|\u0438\u043A | \u043E\u043D|\u04A3 \u0434|\u0441\u0435\u0440|\u043B\u0438\u043F|\u0435\u043B\u0438| \u0441\u043E|\u0438\u043B\u043B| \u0434\u0438|\u0430\u0437\u0430| \u0430\u0437|\u0433\u0430\u0440|\u0438 \u0432|\u043B\u0438\u043C|\u043D\u0438\u043A|\u0435 \u0432|\u0435\u043B\u0435|\u043D\u043B\u0438|\u04AF\u0447\u0438| \u04AF\u0447|\u043D\u043C\u0435|\u0437 \u0445|\u0440\u0430\u043F|\u0442\u0430\u0440|\u043D\u0443\u04A3|\u043E\u043D\u0443|\u043C\u0435\u043B|\u0435 \u0433|\u043A\u0434\u0430|\u0441\u0438\u0437|\u043A\u043B\u0435|\u044B\u0437 |\u0441\u044B\u0437|\u043D\u0438\u04A3|\u0434\u0430\u043B|\u0430 \u044F|\u0446\u0438\u0430|\u043E\u0446\u0438|\u0441\u043E\u0446|\u0430 \u0441|\u043C\u0438\u043B| \u043C\u0438|\u043A\u043B\u0438|\u043E\u043B\u043C|\u0438 \u0431| \u0431\u0435|\u043D \u0431|\u0440\u0430 | \u0434\u04AF|\u0435\u04A3 |\u0435\u0441\u0438|\u044D\u0442\u043C| \u044D\u0442|\u044B \u04E9|\u0438\u043A\u0430| \u043D\u0438| \u0430\u0440|\u0435 \u043C|\u0434\u04E9\u0432|\u0435\u0442 |\u043A \u044D|\u0442\u0430\u043B|\u043D \u0430|\u0433\u044B |\u0435\u0437 |\u0438\u043D\u043C|\u044B\u043F |\u043E\u043B\u044B|\u043E\u0440\u0430|\u0433\u043E\u0440|\u0447 \u0431|\u043D\u0443\u043D|\u0430\u043D\u0443|\u043C \u0445|\u0430\u043B\u043C|\u043B\u0439\u04D9| \u043A\u0438|\u0435\u043A |\u043D \u044F|\u0430\u043D\u0434|\u04AF\u043D\u0438|\u0440\u0435\u0442|\u0442\u043B\u0430|\u0433\u0430\u0442|\u0430\u0439\u043B|\u0446\u0438\u044F|\u043D \u0434|\u04A3 \u0445| \u043C\u0435|\u0433\u044B\u0435|\u043C\u0433\u044B|\u0435\u043C\u0433|\u0497\u0435\u043C|\u0435\u0442\u0435|\u0430\u0445\u0430|\u043C\u0430\u0445|\u0442\u043B\u0435|\u0442\u0438\u04A3|\u0430 \u044D|\u04A3 \u044D|\u043B\u0430\u043C|\u043F\u043B\u0430|\u043D \u0432",
      tgk: "\u0430\u0440 | \u04B3\u0430| \u0431\u0430|\u0430\u0434 | \u0434\u0430| \u0432\u0430|\u043E\u043D | \u0442\u0430|\u0432\u0430 | \u0438\u043D|\u0431\u0430 | \u0434\u043E|\u0434\u0430\u0440|\u0442\u0438 |\u0430\u0440\u043E|\u0434\u043E\u0440| \u043A\u0438|\u043E\u0438 | \u044F\u043A|\u0434 \u04B3| \u0431\u043E|\u0431\u0430\u0440|\u04B3\u0430\u0440|\u044F\u043A |\u043E\u0440\u0430|\u043A\u0438 | \u043D\u0430|\u043D\u0441\u043E|\u0438\u043D\u0441| \u043C\u0430|\u0441\u043E\u043D|\u0438 \u043C|\u0440 \u044F|\u0438 \u043E|\u04B3\u0430\u049B|\u0440\u0430\u0434|\u0430\u0438 |\u043A \u0438|\u0443\u049B\u0443|\u0430\u0440\u0434|\u0438 \u04B3|\u049B \u0434|\u0438\u043D |\u043D\u0438 | \u043C\u0443| \u0430\u0437|\u0438\u0438 | \u04B3\u0443| \u0448\u0430|\u0430\u0437 |\u04B3\u043E\u0438|\u0430\u049B |\u044F\u0434 |\u043E\u043D\u0430| \u043A\u0430|\u0438 \u0434| \u0451 |\u0438 \u0431|\u043E\u044F\u0434|\u0434\u0430\u043D|\u0430\u043D\u0434|\u049B\u0443\u049B|\u04B3\u0443\u049B|\u0437\u043E\u0434|\u043E\u0437\u043E| \u043E\u0437|\u0438\u044F\u0442|\u0434 \u0431|\u0430 \u0431|\u043D\u0434 |\u0434\u0430 |\u0434\u0438 |\u043D \u0431|\u0430\u043C\u043E| \u0445\u0443|\u0443\u0434\u0430|\u043E\u0434\u0438|\u0433\u0430\u0440|\u0434\u043E\u043D|\u0438 \u0438|\u0430\u0442 |\u043C\u043E\u044F|\u043D\u0430\u043C|\u0438 \u0441|\u0441\u0442 |\u04B3\u0430\u043C|\u043D \u04B3|\u0440\u0434\u0430|\u0445\u0443\u0434|\u0430\u043D |\u0431\u043E\u044F|\u043E\u0434\u0430|\u0430\u0432\u0430|\u0438 \u0442|\u043E\u0448\u0430|\u0431\u043E\u0448|\u049B\u0438 |\u0438 \u0445|\u0430 \u0448|\u0430\u0441\u0442|\u04E3 \u0432|\u043C\u0438\u043B| \u0434\u0438| \u043E\u043D| \u043C\u0435|\u0448\u0430\u0432|\u043E\u043D\u0438|\u0435 \u043A|\u0438\u043B\u0430|\u0448\u0430\u0434|\u0438\u043C\u043E|\u0438 \u043D|\u043E\u0431\u0430|\u043E\u043C\u0438|\u043A\u043E\u0440|\u0434 \u043A|\u043A\u0430\u0440|\u0440\u043E\u0438|\u0440\u0438 |\u0432\u0430\u0434|\u0443\u0434 |\u0440\u043E |\u04E3 \u0451|\u043E\u0442\u0438| \u0431\u0435|\u0430\u043D\u0438|\u044F\u0442\u0438|\u0442\u0430\u04B3|\u043C\u0438\u043D|\u043D \u0434|\u044F\u0442 |\u0442\u0430 |\u043D\u0430 |\u0430\u0442\u0438|\u043E\u0441\u0438|\u0431\u043E |\u0438 \u0430|\u0440\u043E\u0431|\u0430 \u04B3|\u0442\u0430\u044A|\u0438 \u04B7|\u0430 \u043C|\u0434 \u0430|\u0440 \u043A|\u0438 \u04EF|\u0430 \u0432|\u043B\u0430\u0442|\u0438\u0441\u0442| \u0444\u0430|\u0438 \u043A|\u0448\u0443\u0434|\u0440 \u04B3| \u0430\u0441|\u0438\u0434\u0430|\u0438\u0433\u0430| \u0441\u043E|\u0430 \u0434|\u0430\u0440\u0430|\u0438\u04B3\u043E|\u0434 \u0432|\u043E\u0434\u043E|\u043D \u043C|\u0442 \u0431| \u04EF |\u0442 \u04B3|\u0430\u043C\u0430|\u0442\u0430\u0440|\u043E\u0440 |\u0444\u0438 | \u0441\u0430|\u0432\u0430\u0440| \u0448\u0443|\u043B\u04E3 | \u043C\u0438|\u043B\u0438 |\u0440\u043E\u043D|\u0434\u0438\u0433|\u04B3\u043E |\u0438 \u0448|\u0434\u0430\u0432|\u0431\u043E\u0442| \u04B3\u0438|\u0438\u0440\u043E|\u0443\u043D\u0430| \u043D\u0438|\u043A\u0430\u0441|\u0435\u04B7 |\u0430 \u0442|\u0430\u0431\u043E| \u0430\u049B|\u043D\u04B3\u043E|\u0440\u0430\u0444|\u043C\u043E\u043D|\u043D \u0432|\u0430\u0432\u0440|\u0438\u043D\u043E| \u043A\u043E| \u0441\u0443| \u04B7\u0430|\u043E\u04B3 | \u04B3\u0435|\u0434 \u0442|\u043C\u0430\u04B3|\u0441\u0442\u0438|\u0441\u0430\u0440|\u0430 \u043E|\u0434 \u0434|\u0434\u0438\u04B3|\u0440 \u0430|\u0443\u043D\u0438|\u0440 \u0431|\u0443\u049B |\u0430 \u0430|\u043C\u0438 | \u0432\u043E|\u043D \u0438|\u0440 \u0432|\u0442\u0430\u0432|\u043E\u0440\u0438|\u043D \u043D|\u043C\u0443\u043C|\u0430\u0440\u0438|\u044F\u0438 |\u043E\u044F\u0438| \u049B\u043E| \u044D\u044A|\u04B3\u0435\u04B7|\u0440\u0438\u0438|\u0434\u04E3 |\u0440\u0434\u043E|\u043E\u043B\u0438| \u0438\u0441|\u0443\u0434\u0438|\u0440 \u0434|\u0430\u0441\u043E|\u0444\u0430\u0440|\u043A\u0438\u0448|\u04E3 \u04B3|\u043D\u0430\u0438|\u0434\u0430\u0430|\u043B\u043E\u043C| \u0438\u04B7|\u0440\u0430\u043D|\u0430\u0445\u0441|\u0448\u0442\u0430|\u0440 \u043C|\u04E3 \u0431|\u0438\u0442\u0430|\u0441\u0438\u0442|\u0432\u043E\u0441|\u0443 \u043E|\u043E \u0434|\u0430\u04B3\u0440|\u043D\u0442\u0438|\u0438\u043D\u0442|\u0438\u0444\u043E|\u0442\u0438\u0444|\u0438\u0431\u043E|\u0442\u04B3\u043E|\u049B\u0443 |\u0430 \u043A|\u0438\u0440 |\u0440\u0440\u0430|\u0440\u0430\u0442|\u04B3\u0438\u043C|\u043E\u043D\u0443|\u049B\u043E\u043D|\u0437\u0434\u0438|\u0443\u043D |\u043E\u0444\u0438|\u0438 \u049B|\u043D\u0434\u0430|\u043B\u0430 | \u0433\u0443|\u043D\u0430\u0431|\u0433\u043E\u043D|\u0430 \u043D|\u049B\u0430\u0440|\u043E\u044F\u0442|\u0448\u0432\u0430|\u0438\u0448\u0432|\u043B\u0430\u043B|\u0438\u044F |\u043C\u0438\u044F|\u0430\u043C\u0438|\u0442\u0438\u043C|\u04B7\u0442\u0438|\u0438\u04B7\u0442|\u0441\u04E3 | \u0437\u0430|\u043E\u0448\u0442|\u044F\u043D\u0434|\u043E\u044F\u043D|\u0430\u0442\u04B3|\u0430 \u0438|\u0430\u044A\u043B|\u043D\u0438\u043A|\u049B\u049B\u0438|\u0430\u049B\u049B|\u0438\u0445\u043E",
      kir: " \u0436\u0430|\u043D\u0430 |\u0430\u043D\u0430| \u0431\u0438|\u0436\u0430\u043D|\u0431\u0438\u0440|\u0443\u043A\u0443|\u0433\u0430 | \u0443\u043A|\u0430\u0440 |\u0443\u0443 | \u043A\u0430|\u043A\u0443\u043A|\u0443\u043A\u0442|\u043B\u0443\u0443|\u0443\u0443\u0433|\u0442\u0430\u0440|\u0443\u0433\u0430| \u0430\u0434|\u0430\u043D |\u0435\u043D |\u044B\u043A | \u0430\u0440|\u0430\u0434\u0430|\u0438\u0440 |\u0434\u0430\u043C|\u043E\u043B\u0443|\u0433\u0430\u043D| \u0431\u043E|\u0430\u043C |\u0440 \u0431| \u0436\u0435| \u043C\u0435|\u0442\u0443\u0443|\u044B\u043D |\u0430\u0440\u0430|\u0431\u043E\u043B|\u043C\u0435\u043D|\u043A\u0442\u0443| \u0431\u0430|\u0430\u043D\u0434|\u043D\u0435\u043D|\u0435\u043D\u0435|\u0430\u0440\u044B|\u044B\u043D\u0430|\u0440 \u0430|\u043D\u0434\u0430|\u043D \u043A|\u0438\u043D |\u04AF\u043D |\u043D \u0431| \u04E9\u0437|\u044D\u0440\u043A| \u043A\u043E|\u0430 \u0436| \u0430\u043B| \u044D\u0440|\u0434\u0430 |\u043A\u0442\u0430|\u0436\u0435 | \u0442\u0430|\u0430\u043D\u044B|\u0430 \u0442|\u0440\u043A\u0438|\u0430 \u0443|\u0434\u044B\u043A|\u0430\u0440\u0434|\u0430 \u043A|\u043A\u0438\u043D|\u0438\u043D\u0434|\u0438\u0448 |\u0442\u0438\u0439| \u0442\u0438|\u0438\u0439\u0438|\u043D \u0436|\u04AF\u04AF |\u0433\u04E9 |\u043D \u0430|\u0430\u043B\u0430|\u043D \u044D|\u0430\u043B\u044B|\u0443\u043A |\u0438\u043B\u0438|\u043D \u0442|\u0439\u0438\u0448|\u043A\u044B\u043B|\u043B\u0430\u0440|\u0440\u0434\u044B|\u0430\u043B\u0443|\u043D\u0434\u0438|\u0442\u0435\u0440| \u043C\u0430|\u04AF\u0433\u04E9|\u0443 \u0430|\u043A\u0430\u0440|\u043D\u044B\u043D| \u043A\u044B|\u0430 \u0430|\u0431\u0430\u0448|\u0431\u0430\u0440|\u043B\u0433\u0430|\u0438\u043C |\u0443\u043D | \u044D\u043C| \u044D\u044D|\u043B\u044B\u043A| \u0442\u0443|\u0430 \u0431|\u0430 \u044D| \u0430\u043D|\u043D\u0430\u043D|\u04E9\u0437 |\u0442\u0443\u0440|\u0440\u04AF\u04AF|\u0434\u0430\u0439|\u0430\u043B\u0434|\u0443\u043B\u0443| \u0441\u0430|\u0440\u044B\u043D|\u0434\u0430\u0440|\u0442\u0442\u0430|\u04AF\u04AF\u0433|\u0435\u0442\u0442|\u0440\u0433\u0430| \u043A\u0438|\u043A\u0430\u043D|\u0438\u0433\u0438|\u043D \u0443|\u043A\u04AF\u043D|\u043A\u0430 |\u043D\u0434\u044B|\u0443 \u0431| \u0431\u0435|\u043C \u0430|\u04AF\u0447\u04AF|\u043C\u0435\u0441|\u044D\u043C\u0435|\u0440\u044B |\u0434\u0438\u043A|\u0440 \u043C|\u0443\u0448\u0443| \u043C\u04AF| \u0441\u043E|\u043A \u0436|\u0442\u0443\u043A|\u04AF\u043D\u04E9|\u043D\u0435 |\u0438\u043D\u0435|\u0430\u043B\u0433|\u043A\u0430\u043C|\u0442\u04AF\u04AF|\u04AF\u043D\u04AF|\u044D\u0447 |\u0435\u043A\u0435|\u043A\u0435 |\u0435\u0441 | \u044D\u0447|\u04E9\u0437\u04AF|\u0433\u0438\u043D|\u0438\u043A\u0442|\u0435\u0433\u0438|\u043B\u0434\u044B|\u04E9 \u0436|\u0435\u0440\u0438|\u043A \u043C|\u0443\u043F |\u043B\u0438\u043C|\u0431\u0438\u043B|\u0430\u0442\u0442|\u043A\u0435\u0442|\u0443 \u043C|\u0447\u04AF\u043D|\u0442\u0430\u043B|\u0443\u0433\u0443| \u043A\u0435|\u0440\u0443\u0443|\u043A \u0442|\u043B\u0443\u043A|\u0447 \u043A|\u0435 \u043A|\u044D\u044D |\u043A\u0442\u0435|\u0443 \u0436| \u0434\u0435|\u0443\u043B | \u043D\u0435|\u0448\u043A\u0430|\u0434\u0438\u043D| \u0434\u0438| \u0442\u04AF|\u043C\u0434\u0430|\u0430\u043C\u0434|\u0433\u043E\u043D| \u0438\u0448|\u044B \u043C|\u043A\u0430\u043B|\u043A \u043A| \u0442\u043E|\u043A\u043E\u0440|\u0440\u0434\u0435|\u044B\u0437 |\u0441\u044B\u0437|\u0440\u0433\u043E|\u043E\u0440\u0433|\u0430\u0439 |\u0443\u043D\u0443| \u044D\u043B|\u0435 \u0430|\u043D\u04AF\u043D|\u0430\u0439\u0434|\u0437\u04AF\u043D|\u044B\u0433\u044B|\u0433\u0435 |\u0446\u0438\u044F|\u0440\u0430\u0431|\u044B\u043A\u0442|\u0433\u0438\u0437|\u043D\u0435\u0433|\u0430\u0448\u043A|\u044B\u043B\u0443|\u0435 \u0431|\u0440\u0438\u043D| \u0442\u0435|\u0438\u043A |\u043E\u043D |\u043C\u043A\u04AF|\u04AF \u0436|\u04AF \u04AF|\u043E\u043E |\u043D \u043C|\u043D\u0443\u0443|\u0442\u044B\u043A|\u0430\u0448\u0442|\u0443\u043D\u0430|\u0435\u0439 |\u0434\u0435\u0439|\u0438\u0440\u0434|\u0430\u0431\u044B| \u043C\u044B|\u043C \u04E9|\u0435\u0440\u0434|\u043B\u043E\u043E|\u043C\u0441\u044B|\u043D \u043D|\u0435\u043A\u0442|\u0434\u044B\u0440|\u0434\u0438\u0433|\u0430\u043A\u0442|\u043C\u0430\u043A|\u0430\u0433\u0430|\u0435 \u044D|\u043B\u0430\u043D|\u0430\u0446\u0438|\u0442\u0430\u043D|\u0430\u0439\u044B|\u0446\u0438\u0430|\u043E\u0446\u0438|\u0441\u043E\u0446|\u0438\u043B\u0435|\u0440\u0430\u043B|\u044B\u043D\u0434|\u0434\u0435 |\u043A\u043E\u043E|\u043D\u0438\u043A|\u0430\u0442\u044B| \u04E9\u043B|\u043B\u0433\u043E|\u043E\u043B\u0433|\u0440\u0434\u0438|\u0430\u043C\u0441|\u04AF\u043C\u043A|\u043C\u04AF\u043C|\u04E9\u0441\u04AF|\u043C\u0434\u0443|\u043D \u0438|\u0448 \u0436| \u04AF\u0447|\u0448\u0442\u044B|\u0433\u0443\u043D|\u0437\u0433\u0438|\u0431\u0435\u0440|\u04E9\u043D | \u0431\u0443|\u0431\u044B\u043D|\u0441\u0430\u043B|\u043A\u0438\u043C|\u0443 \u044D|\u043D \u0441|\u04E9\u043D\u04AF|\u043A\u0442\u04E9|\u0430 \u04E9|\u0434\u044B\u0433|\u0434\u044B |\u0437 \u043A| \u043A\u04E9|\u0434\u0430\u043D|\u044B\u043B\u044B|\u0440\u043C\u0430| \u0430\u0439|\u0438\u0430\u043B",
      mkd: " \u043D\u0430|\u043D\u0430 | \u043F\u0440| \u0438 |\u0432\u043E | \u0441\u0435|\u0440\u0430\u0432|\u043F\u0440\u0430|\u0442\u0430 |\u0430 \u0441| \u043D\u0435|\u0442\u043E |\u0434\u0430 | \u0434\u0430|\u0430 \u043F|\u0443\u0432\u0430|\u0438\u0442\u0435|\u0442\u0435 |\u043E \u043D|\u0432\u0430 |\u0430 \u043D|\u043E\u0458 |\u043A\u043E\u0458|\u0438 \u0441|\u043D\u043E |\u0430 \u0438|\u0430\u0442\u0430|\u0430\u0432\u043E| \u0438\u043C|\u0435\u043A\u043E|\u043C\u0430 | \u0437\u0430| \u0441\u043E|\u0441\u0442\u0432|\u043D\u0438 |\u0438\u043C\u0430|\u043E\u0442 |\u045A\u0435 | \u0432\u043E| \u043F\u043E|\u043B\u0438 |\u0458\u0430 |\u0430 \u0434|\u043E\u0441\u0442|\u0441\u0435\u043A|\u0435 \u043D|\u043E\u0432\u0430|\u0441\u0435 |\u0438\u043B\u0438| \u0438\u043B|\u043E \u0441|\u0435 \u043F|\u0430 \u043E|\u0430\u045A\u0435|\u0438 \u043F| \u0441\u043B|\u0430\u0442 |\u0435 \u0438|\u0432\u0430\u045A|\u0438\u0458\u0430|\u043E \u0434|\u043E\u0442\u043E|\u0435\u043D |\u043E \u0438|\u0441\u043B\u043E|\u0440\u0435\u0434|\u0438 \u0434|\u043E\u0431\u043E|\u043F\u0440\u0438| \u043E\u0434|\u0431\u043E\u0434|\u043B\u043E\u0431|\u0458 \u0438|\u0438 \u043D|\u0432\u043E\u0442|\u0441\u0442\u0430|\u0441\u0442 |\u0438 \u0438|\u0435\u0433\u043E|\u043D\u0435\u0433| \u0431\u0438|\u0430 \u0432|\u043D\u043E\u0441| \u0440\u0430| \u045C\u0435|\u0433\u043E\u0432|\u043F\u0440\u0435| \u043D\u0438| \u043A\u043E|\u0442 \u0438| \u043E\u0431|\u0435 \u0441|\u0430\u0432\u0430|\u0430\u043A\u0432|\u045C\u0435 |\u0431\u0438\u0434| \u0434\u0435| \u0434\u0440|\u0441\u043E |\u0442\u0432\u043E|\u0432\u0430\u0442|\u0430\u043A\u043E|\u0430\u0446\u0438|\u0448\u0442\u043E|\u0440\u0430\u0437|\u0435\u0434\u043D|\u0430\u0430\u0442|\u043F\u0440\u043E|\u0431\u0440\u0430|\u0438\u0434\u0435|\u0430\u043D\u0438|\u0430 \u0437|\u0430 \u0431|\u043A\u0430\u043A|\u0446\u0438\u0458|\u0435\u0441\u0442|\u0434\u0435 | \u0435 |\u0430 \u0435| \u0448\u0442| \u043A\u0430|\u0435 \u0431|\u043E\u0434\u043D|\u043E\u0434 |\u0438 \u043E|\u043D\u0438\u0442|\u0442 \u0441|\u0458 \u043D|\u0440\u0430\u043D|\u0435 \u0434|\u0438 \u0437|\u0435\u043D\u043E|\u0434\u0438 |\u043A\u043E\u043D|\u0435\u043D\u0438| \u0435\u0434| \u0441\u0438|\u0435\u043C\u0435|\u0441\u043D\u043E|\u043E\u0441\u043D| \u043E\u0441|\u0442\u0438\u0442|\u043E\u0432\u0438|\u0458\u0430\u0442|\u043E \u043F|\u0432\u0435\u043D|\u043B\u043D\u043E|\u0430\u043B\u043D| \u0458\u0430|\u0435\u0434 |\u0434\u0440\u0443|\u0432\u0430\u0430|\u0441\u0442\u043E|\u0434\u043D\u0430|\u0437\u0430 |\u043D\u043E\u0442|\u0434\u043D\u043E|\u0435 \u043E| \u0434\u043E|\u0432\u0438 |\u043E\u0432\u0435|\u0435\u0434\u0438|\u0434\u0440\u0436|\u043E \u0432|\u043D\u0438\u0435|\u043D\u043E\u0432|\u0447\u043D\u043E|\u043D\u0438\u043A|\u0436\u0438\u0432|\u0435\u0442\u043E|\u0430 \u043A|\u0438\u043E\u0442| \u0441\u0442|\u043D\u0430\u0446|\u0435\u043B\u0438|\u0432\u043D\u0438|\u0434 \u043D|\u0431\u0435\u0437|\u0430\u0440\u0430|\u043E \u043E|\u0438 \u0432|\u0442 \u043D|\u0440\u0443\u0433|\u0434\u0435\u043D|\u0434\u043D\u0438|\u0441\u0438\u0442|\u043E\u0431\u0440|\u0430 \u0440|\u043B\u0443\u0447|\u0430 \u0433| \u0432\u0440|\u043D\u0435 |\u043F\u043E\u0440|\u0448\u0442\u0438|\u0438\u0447\u043D|\u0447\u0443\u0432|\u043A\u0430 |\u0430\u0432\u043D|\u0442\u0432\u0435|\u043A\u043E | \u0431\u0435| \u043E\u043F|\u0431\u043E\u0442|\u0430\u0431\u043E|\u0440\u0430\u0431|\u0430 \u043C|\u0446\u0435\u043B| \u0446\u0435|\u0442\u0435\u043D|\u0435\u043B\u043E|\u043E\u043B\u043D|\u0434\u0435\u043B|\u043D\u0443\u0432|\u0435 \u0432|\u0438\u0442\u0430|\u0430\u0448\u0442|\u0437\u0430\u0448|\u043A\u0440\u0438|\u0440\u043E\u0434|\u043D\u0438\u043E|\u0442 \u043F|\u0437\u0435\u043C|\u0435\u043C\u0430|\u043D\u0435\u043C|\u043E\u0458\u0430|\u0435\u0437 |\u0438\u043C | \u043E\u0432|\u043E\u0434\u0438|\u043F\u0448\u0442|\u043E\u043F\u0448|\u043E\u043D |\u0438\u0435 |\u043D\u0441\u0442|\u043D\u0430\u043A|\u0430\u0453\u0430|\u0448\u0442\u0435|\u0447\u043E\u0432| \u0447\u043E|\u0432\u0430\u043D|\u0437\u043E\u0432|\u0430\u0437\u043E|\u043A\u043E\u0442|\u0441\u043B\u0443|\u0436\u0430\u0432|\u0440\u0436\u0430| \u0438\u0437|\u043E \u043A|\u0440\u0435\u043C|\u0438\u0441\u0442|\u0435\u045A\u0435|\u0432\u043E\u043B|\u043E\u0440\u0435|\u0433\u0438 |\u043D \u0438| \u0442\u043E|\u0442\u0438 |\u0438\u043A\u043E|\u043E\u0434\u0430| \u0436\u0438|\u043B\u0430\u0441|\u0430\u0440\u043E| \u043C\u0435| \u0437\u0435|\u043B\u043E |\u0431\u0435\u0434|\u043B\u0438\u0442| \u0440\u0435|\u0438\u043F\u0430|\u0440\u0438\u043F|\u0435\u0434\u0435|\u043E \u045C|\u043E\u0432\u043E| \u043C\u043E|\u043D\u0430\u043F|\u0442 \u0434|\u0432\u0440\u0435|\u0458\u0441\u0442|\u0435\u0458\u0441|\u043E\u0440\u0430|\u0438\u0432\u0438|\u0440\u0438\u0432|\u0440\u0438 |\u0437\u0432\u043E|\u0432\u0435\u043A|\u043B\u043D\u0438|\u043A\u0432\u043E|\u0432\u043D\u043E| \u0441\u043F|\u043E \u0435|\u043A\u0432\u0430|\u043D \u043D|\u0436\u0435\u043D|\u0434\u0430\u0442|\u043D\u0435\u0442|\u0438\u043D\u0435|\u0438\u0432\u043E|\u043F\u043E\u0434|\u0430\u043B\u0438|\u0438\u043A\u0430",
      khk: " \u044D\u0440|\u044D\u0440\u0445| \u0445\u04AF|\u043D \u0431|\u044D\u0439 |\u0442\u044D\u0439|\u0445 \u044D| \u0431\u043E|\u0430\u0445 | \u0431\u04AF|\u043D\u0438\u0439|\u0430\u043D |\u0438\u0439\u0433|\u0439\u043D |\u0445\u04AF\u043D|\u0431\u043E\u043B| \u0431\u0430|\u044D\u043D |\u043E\u043B\u043E|\u0438\u0439\u043D|\u0443\u0443\u043B|\u0439 \u0445| \u0445\u0430|\u0431\u04AF\u0440|\u044D\u0445 |\u0431\u0430\u0439| \u0431\u0443|\u0433\u0430\u0430|\u0440\u0445\u0442|\u0445\u0442\u044D|\u0433\u04AF\u0439|\u0440\u0445 |\u04AF\u0440 |\u04AF\u043D |\u0430\u0430\u0440|\u0439\u0433 |\u0430\u0440 |\u043B\u0430\u0445|\u043E\u043D | \u0445\u044D|\u0438\u0439 |\u0430\u0430 | \u0437\u0430|\u043D \u0445|\u0439 \u0431| \u043E\u0440|\u04E9\u043B\u04E9|\u043B\u044D\u0445|\u04AF\u0439 |\u043B\u04E9\u04E9|\u0443\u043B\u0430| \u0445\u0443|\u044B\u043D |\u04AF\u043D\u0434|\u044D\u043B |\u044D\u0440 | \u0443\u043B| \u0447 | \u0451\u0441|\u043D \u044D| \u043D\u0438|\u043B\u043E\u043D|\u0445\u0438\u0439| \u0442\u0443|\u0440 \u0445|\u04E9\u04E9\u0440| \u0433\u044D|\u0441\u0430\u043D|\u0447\u04E9\u043B| \u0447\u04E9|\u0443\u043B\u0441| \u04AF\u043D|\u0433\u044D\u044D|\u043E\u0440\u043E|\u043D\u044B |\u043D \u0442|\u044E\u0443 |\u0443\u044E\u0443|\u0431\u0443\u044E| \u0448\u0430|\u0445\u0430\u043D|\u044D\u0434 |\u043E\u0445 |\u044D\u044D |\u043D\u044C | \u043D\u044C| \u0442\u044D|\u0441\u044D\u043D|\u043D \u0430|\u0440 \u044D|\u0430\u0439 |\u043B \u0445|\u0445\u0430\u043C|\u043B\u0430\u0433| \u0442\u043E|\u0445 \u0451| \u044D\u0434|\u043D\u0434\u044D|\u043B\u0433\u0430| \u0442\u04E9|\u0440\u043E\u043B|\u0436 \u0431| \u0430\u043B|\u04AF\u043B\u044D|\u0445 \u0431|\u043B\u0438\u0439| \u0445\u04E9|\u043E\u043B |\u043B \u0431|\u043B\u0441 |\u044D\u0433 |\u044D\u044D\u0440|\u0439\u0433\u044D|\u0430\u0432\u0430|\u0442\u0430\u0439|\u0433\u044D\u043C|\u0433\u0443\u0443|\u0434 \u0445|\u0431\u0443\u0441| \u04E9\u04E9|\u04E9\u0442\u044D|\u04E9\u04E9\u0442|\u0442\u04E9\u0440|\u044B\u0433 |\u043B\u0433\u043E|\u043B\u0443\u0443|\u0445\u0443\u0443|\u04AF\u04AF\u043B|\u043D\u0434 |\u0445\u044D\u043D|\u0441\u043E\u043D|\u0434\u044D\u0441| \u044F\u043B|\u043B\u0434 |\u0430\u043B\u0434|\u0445\u0430\u0440|\u0433\u0438\u0439| \u043D\u044D|\u043B\u043E\u0432|\u0433 \u0431|\u0440\u044D\u0433|\u044D\u0440\u044D|\u04AF\u0439\u043B|\u0430\u0430\u043B|\u043D \u0437|\u0433 \u0445|\u0445 \u0442|\u044D\u043D\u0438| \u0430\u043C|\u0440\u043B\u0430|\u0433\u044D\u0440|\u04AF\u043D\u0438|\u043E\u0439 |\u0442\u043E\u0439|\u0430\u043B | \u0433\u0430|\u0430\u0434 |\u0440\u0438\u0439|\u0430\u0430\u043D|\u0439 \u0430| \u0430\u0436|\u0432\u0441\u0440| \u0437\u043E|\u0443\u0440\u0430|\u043B\u043B\u0430| \u0430\u0432| \u0445\u0438|\u044D\u0434\u044D|\u0434\u0441\u044D| \u04AF\u0439|\u043C\u0433\u0430|\u0430\u043C\u0433|\u0439\u0445 |\u0430\u0439\u0445|\u0447 \u0431| \u043E\u043B|\u0440\u0433\u0430|\u04E9\u0440\u04E9|\u044D\u0441 |\u0430\u0433\u0430| \u0441\u0430|\u043D \u0434|\u043E\u043E |\u0430\u043D\u0430|\u0438\u043D |\u0430\u0433 |\u043D \u043D|\u043E\u0432\u0441| \u0441\u043E|\u043E\u043B\u0446|\u044D\u0433\u0442|\u0434\u044D\u043B|\u0430\u043B\u0438|\u0433\u04E9\u04E9|\u0442\u044D\u0433|\u0445\u044D\u044D|\u0445\u044D\u0440|\u0432\u0430\u0445|\u0430\u0440\u043B|\u04AF\u04AF |\u0445\u04AF\u04AF|\u043B\u0430\u0430| \u0434\u044D|\u0441 \u043E| \u0442\u04AF|\u043C\u0438\u0439|\u0439\u0433\u043C| \u0448\u04AF|\u043D \u0448|\u0430\u0440\u0433|\u0440 \u0447|\u04E9\u0440 |\u0430\u0441\u0430|\u0434\u0438\u043B|\u0430\u0434\u0438| \u0430\u0434| \u043C\u044D|\u0441\u0440\u043E| \u0431\u0438|\u0430 \u0445|\u0438\u043B\u0433|\u0440\u0430\u0430|\u0439 \u0442|\u0445\u04AF\u0440| \u0442\u0430|\u04E9\u0445 |\u0430\u0440\u0434|\u0434\u044D\u044D|\u043B\u043E\u0445|\u043B\u0430\u043D|\u0432\u0430\u0430|\u0438\u0432\u0430|\u043B\u0438\u0432|\u0430\u043B\u0443|\u0442\u0433\u044D|\u043E\u0440\u0438|\u043B\u044B\u043D| \u0434\u0430| \u044F\u0432|\u043B \u043D|\u04AF\u0440\u044D|\u0430\u0439\u0433|\u0434 \u0431|\u043E\u0433\u0442|\u0442\u043E\u0433|\u0430\u0439\u043B|\u04E9\u0440\u0438|\u0430\u0448\u0438|\u044F\u043B\u0433|\u043C\u0430\u0440|\u043B\u0430\u043B|\u0433\u043B\u0430| \u044D\u043D|\u043D \u04AF|\u0440\u043E\u043D| \u0445\u043E|\u043D \u0433|\u043D \u0443|\u0430\u0439\u0434|\u0445 \u0447|\u0434\u043B\u044D|\u0440 \u0442|\u0430\u0442\u0430|\u0431\u0438\u0435|\u0430\u043D\u0433|\u0439 \u044D|\u043D\u044D\u0433| \u0441\u0443|\u043B\u0446\u043E|\u0431\u04AF\u043B|\u043B\u0436 |\u0434 \u043D|\u043B\u04E9\u0445|\u0434\u0430\u0445|\u0440\u0445\u0438|\u043B\u044D\u043B|\u0433 \u04AF| \u0434\u0443|\u0433\u043E\u0445|\u0442\u043E\u043E|\u044D\u0440\u0433|\u043E\u043B\u0433|\u0430\u0441 |\u044D\u0436 |\u0439\u043B\u0434|\u0445 \u0430|\u0433\u0448 |\u044D\u0433\u0448|\u0443\u043B\u0438| \u0448\u0438|\u0445 \u0448|\u0433 \u043D|\u0438\u0433\u043B|\u0441\u0433\u04AF|\u0451\u0441\u0433|\u0434\u0430\u0440|\u0445 \u0445|\u0430\u043C\u044C|\u0440 \u0430|\u043E \u0445",
      kbd: "\u0433\u044A\u044D|\u044B\u0433\u044A| \u043A\u044A| \u0445\u0443|\u044B\u0445\u0443|\u043D\u044B\u0433| \u0437\u044B|\u043D\u0443 |\u0445\u0443\u0438|\u044D\u043C |\u044A\u044D |\u0445\u0443\u044D| \u0438 |\u0443\u0438\u0442|\u0442\u044B\u043D|\u0433\u044A\u0443|\u044D \u0437|\u043A\u044A\u044B|\u044D\u0445\u044D|\u04CF\u044B\u0445|\u044D \u0438|\u044D\u0440 | \u0437\u044D|\u044A\u044D\u0440|\u044B\u043C |\u0445\u044C\u044D|\u044A\u0443\u044D|\u0446\u04CF\u044B| \u0446\u04CF|\u044D\u0445\u0443|\u044B\u043D\u044B|\u0438\u0442\u044B|\u0437\u044B |\u043D\u044D |\u0445\u044D\u043C|\u0430\u0433\u044A|\u0443\u044D |\u043A\u044A\u044D|\u044D\u043D\u0443| \u0434\u044D|\u044D\u0443 |\u044D\u0433\u044A|\u043C \u0438|\u044D\u043D\u044D|\u0445\u044A\u0443|\u044D\u0449 |\u0440\u0430\u043B|\u0442\u0445\u044D|\u044D\u0442\u0445|\u044D\u0440\u0430|\u0445\u044D\u043D|\u0434\u044D\u0442|\u043C \u0445|\u0438\u0433\u044A|\u044D \u0445|\u04CF\u044D |\u0449\u0445\u044C|\u044B \u0446|\u044B\u043D\u0443|\u044D\u043D\u044B|\u0443 \u0445| \u0445\u044D|\u0443 \u0437| \u0433\u044A|\u0437\u044D\u0445|\u043A\u04CF\u044D|\u044A\u044D\u0445|\u0443\u043C |\u0445\u0443\u043C|\u0456\u044D |\u044D\u0434\u044D|\u0440\u044D | \u0438\u043A|\u044A\u0443\u043D| \u0449\u044B|\u0449\u04CF\u044D|\u0443\u044D\u0434|\u0438 \u0445|\u0443\u044D\u043D|\u044D \u043A|\u0445\u044D\u0442|\u0443\u044D\u0444|\u0438\u0456\u044D| \u0438\u0456|\u0445\u044D\u0440|\u044D \u0449| \u0435 |\u043C\u0438 |\u043B\u044A\u044B|\u044D\u043A\u04CF|\u0456\u044D\u0449|\u044D\u0442\u0438|\u0442\u0438 |\u0445\u0443\u0430|\u043C \u043A|\u044D\u0440\u044B|\u0443 \u0434|\u0449\u0456\u044D|\u043A\u044A\u0443|\u0440 \u0437|\u0437\u044D\u0440|\u043C\u0440\u044D|\u044D\u043A\u0456|\u043A\u0456\u044D|\u044A\u044B\u043C|\u0443\u043D\u0443| \u0445\u044A|\u04CF\u0438 |\u0430\u0443\u044D| \u043D\u044D|\u044A\u044D\u043C|\u043B\u044A\u044D|\u044D\u043C\u0440|\u044D \u0433|\u0443\u044D\u0445|\u0435\u0437\u044B|\u043D\u0448\u044D|\u044A\u044D\u043F|\u0437\u044B\u0445|\u0430\u043B\u044A|\u0443 \u043A|\u0430\u0449\u044D|\u0444\u0430\u0449|\u043A\u04CF\u0438|\u0438\u043A\u04CF|\u044A\u044B\u0445|\u0443\u043A\u044A|\u0430\u043B\u044B|\u0430\u043B |\u0443 \u0438|\u0431\u0437\u044D|\u044A\u044D\u0449| \u043C\u044B|\u044D\u0444\u0430| \u043F\u0441|\u0456\u0443\u044D|\u0430\u0431\u0437| \u0445\u0430|\u04CF\u0443\u044D| \u0433\u0443| \u043B\u044A|\u0437\u044B\u043C| \u0449\u04CF| \u0449\u0445|\u043F\u0441\u043E|\u0443\u043C\u044D|\u044A\u0443\u043C|\u0445\u0430\u0431|\u043D\u0443\u043A|\u0438\u04CF\u044D| \u0438\u04CF|\u0449\u044B\u0442|\u04CF\u044D\u0449| \u044F |\u0440\u0438 |\u0445\u0443 | \u0435\u0437|\u0440\u0438\u0433|\u0438 \u043A|\u043C \u0449|\u0443 \u0449|\u0438 \u0446|\u043B\u044B\u043C|\u0448\u044D\u0443|\u044A\u044B\u0449|\u044B\u0445\u044D|\u044D\u043F\u044D|\u044D\u0449\u04CF|\u0449\u044D\u0445|\u044B\u0445\u044C|\u044D\u043D |\u0445\u044A\u044D| \u0443\u043D|\u044A\u044D\u043A|\u044A\u044D\u0436|\u044A\u044B\u0442|\u043C \u0435|\u0443\u0443 |\u044D\u043F\u0441|\u0449\u04CF\u044B|\u0443 \u043F|\u0441\u044D\u043D|\u043C\u0430\u043B|\u0430\u043C\u0430| \u0430\u043C|\u043F\u0445\u044A| \u0449\u0456|\u0449\u0456\u0430|\u043C\u044D\u043D|\u044D\u0445\u044A|\u044C\u044D |\u044D\u0436\u044B|\u044B\u043B\u044A|\u044D \u0435|\u044D\u0449\u0445|\u0456\u044B\u0445|\u0446\u0456\u044B| \u0446\u0456|\u043C \u0437|\u0442\u0443 |\u044C\u044D\u0445|\u044D\u0441\u044D|\u044C\u044D\u043D|\u0430\u043F\u0449|\u044D\u0440\u0438|\u0436\u044C\u044D|\u044A\u044D\u0437|\u044A\u044D\u0443|\u0434\u044D |\u043F\u0449\u04CF|\u043F\u0441\u044D|\u0438 \u043D|\u044B\u043D\u0448|\u0436\u044B\u043D|\u0443\u044D\u0449|\u043D\u044D\u0433|\u044C\u044D\u043F|\u043D \u0445|\u044A\u0443\u0430|\u044B\u043A\u04CF|\u0445\u0443\u0440|\u043B\u044A\u0445|\u0434\u044D\u0443|\u044D \u044F|\u044A\u044D\u0441|\u043F\u0441\u044B|\u044D \u043F|\u044D\u0442\u044B|\u044D \u0434| \u0438\u0440|\u0440 \u0438|\u044D\u0449\u0456|\u043D\u044D\u0445|\u0437\u044D\u0433|\u044B\u0437\u044D|\u0438 \u043B|\u0438 \u0438|\u043D\u0435\u0439|\u0443\u043D\u0435|\u044B\u0442 | \u0437\u0438|\u0443\u043D\u0430|\u044D\u043D\u0448|\u0445\u044D\u0433|\u0433\u0443\u043F|\u044B\u0449\u044B|\u0445\u0443\u0435|\u044B\u0440 |\u0438\u0442\u0443|\u0438 \u0449|\u0441\u043E\u043C|\u0441\u044D\u0445|\u044D\u0437\u044D|\u044B\u043A\u044A|\u044D\u0433\u0443| \u0442\u0435|\u0430\u043F\u0445|\u043A\u044A\u0435| \u0437\u0430|\u043B\u0445\u044D|\u0430\u043B\u0445|\u0438 \u0434|\u044D \u043B|\u0438 \u0443|\u0443\u044D\u0442|\u0430\u043C |\u043C\u044B |\u044B\u043D |\u0438 \u0437|\u044D\u0436\u044C|\u0436\u044C\u044B|\u0449 \u0435|\u0443\u044D\u043C|\u043C \u0434|\u0437\u044D |\u044A\u044D\u0433|\u0435\u0433\u044A| \u0456\u0443|\u0449 \u0437|\u043B \u0445|\u0431\u0433\u044A|\u044B\u0442\u044D| \u043F\u0449|\u043D\u0430\u0433|\u0440 \u0449|\u0441\u044D\u0443|\u043C \u044F|\u043A\u044D |\u0442 \u0445|\u0438\u043C\u044B|\u043E\u043C\u0438|\u044D \u0430|\u044D\u043C\u044B|\u0442\u044D\u043D|\u043C\u044B\u043B|\u0445\u044D\u043A|\u0443 \u0435|\u0445\u0443\u0431|\u0443\u0438\u0433|\u0443\u0435\u0439"
    },
    Arabic: {
      arb: " \u0627\u0644|\u064A\u0629 |\u0641\u064A | \u0641\u064A|\u0627\u0644\u062D| \u0623\u0648|\u0623\u0648 | \u0648\u0627|\u0648\u0627\u0644|\u062D\u0642 |\u0629 \u0627|\u0644\u062D\u0642|\u0627\u0644\u062A|\u0643\u0644 |\u0627\u0644\u0645|\u0644\u0643\u0644| \u0644\u0643|\u0644\u0649 |\u0642 \u0641|\u062A\u0647 |\u0648 \u0627|\u0629 \u0648|\u0634\u062E\u0635|\u0629 \u0644|\u0627\u062A |\u0627\u0644\u0623|\u064A \u0623|\u0648\u0646 | \u0634\u062E|\u0645 \u0627|\u0623\u064A | \u0623\u064A|\u0627\u0646 |\u0623\u0646 |\u0645\u0629 |\u064A \u0627|\u0627\u0644\u0627|\u0644\u0627 |\u0647\u0627 |\u0627\u0621 | \u0623\u0646| \u0639\u0644|\u062E\u0635 |\u0646 \u0627| \u0644\u0644|\u062F \u0627|\u0645\u0646 |\u0641\u0631\u062F|\u0645\u0627 |\u0627\u0644\u0639|\u062A \u0627|\u062D\u0631\u064A|\u0639\u0644\u0649|\u0644 \u0641|\u0631\u062F |\u0644 \u0634| \u0644\u0627|\u0631\u064A\u0629| \u0625\u0644|\u0629 \u0623|\u0627 \u0627|\u0646 \u064A| \u0648\u0644|\u0627 \u0644|\u0627 \u064A| \u0641\u0631| \u0645\u0646|\u0629 \u0645|\u0627\u0644\u0642|\u062C\u062A\u0645|\u0646 \u0623|\u0642 \u0627|\u0627\u0644\u0625| \u062D\u0631|\u0644\u0647 |\u0647 \u0644|\u0627\u064A\u0629|\u0644\u0643 |\u0647 \u0627| \u062F\u0648|\u062F\u0629 |\u0627\u064B |\u064A\u0646 |\u0647 \u0648|\u0644\u0629 |\u064A \u062D| \u0639\u0646|\u0645\u0627\u0639|\u064A \u062A|\u0630\u0627 | \u062D\u0642|\u0642\u0648\u0642|\u062D\u0642\u0648|\u060C \u0648|\u0646 \u062A|\u0645\u0639 |\u0635 \u0627|\u0627\u0645 |\u062F \u0623| \u0643\u0627|\u0647\u0630\u0627|\u0627\u0644\u0648| \u0625\u0646|\u0645\u0644 |\u0627\u0645\u0629|\u0639 \u0627|\u0625\u0644\u0649|\u0629 \u0639|\u0645\u0627\u064A|\u062D\u0645\u0627|\u0646 \u0648|\u0644\u062A\u0639| \u0648\u064A|\u064A\u0631 |\u0646\u0648\u0646|\u064A \u0648|\u0627\u0633\u064A|\u0627\u0644\u062C| \u0647\u0630|\u0646\u0633\u0627|\u0648\u0642 |\u062A\u0631\u0627|\u0639\u064A\u0629|\u0647 \u0623| \u0644\u0647|\u0633\u064A\u0629| \u064A\u062C| \u0628\u0627|\u062F\u0648\u0644|\u0627\u0646\u0648|\u0642\u0627\u0646|\u0644\u0642\u0627|\u0629 \u0628|\u0629 \u062A|\u062A\u0645\u0627|\u0627\u0644\u062F|\u064A\u0627\u062A|\u0639 \u0628|\u0633\u0627\u0646|\u0625\u0646\u0633|\u0647\u0645 |\u0639\u0644\u064A| \u0645\u062A|\u0644\u0645\u062C|\u0630\u0644\u0643|\u0639\u0645\u0644|\u0644\u0623\u0633|\u0648\u0632 |\u062C\u0648\u0632|\u064A\u062C\u0648|\u0628\u0627\u0644|\u063A\u064A\u0631|\u0643 \u0627|\u0643\u0627\u0646|\u0633\u0627\u0633|\u0623\u0633\u0627|\u062F\u0645 |\u0644\u0627\u062F|\u0627\u0639\u064A|\u0627\u0644\u0631|\u062A\u0645\u064A|\u062F\u0648\u0646|\u062A\u0645\u062A|\u0644\u062A\u0645| \u064A\u0639|\u0644\u064A\u0647|\u0633\u0627\u0648|\u0627\u062C\u062A|\u064A \u0645|\u0644\u0639\u0627|\u0644\u062C\u0645|\u062A\u0639\u0644|\u0631 \u0648|\u062A\u0645\u0639|\u0645\u062C\u062A| \u0645\u0639|\u064A\u0647 |\u0649 \u0623|\u0641\u064A\u0647|\u0649 \u0627| \u0643\u0644|\u0644\u0627\u062A|\u0645\u0644\u0627|\u0648\u062F |\u0627\u0646\u062A|\u0627\u0644\u0641|\u064A\u0647\u0627|\u064A \u0625|\u062A\u064A |\u0627\u0644\u0628|\u0644\u064A |\u0642\u062F\u0645|\u0627\u0644 |\u0627\u062F |\u0644 \u0627|\u064A\u0632 |\u064A\u064A\u0632|\u0645\u064A\u064A| \u062A\u0645|\u0644\u062D\u0631|\u062A\u0639 |\u0645\u062A\u0639|\u0627 \u0628|\u0639\u0627\u0645|\u0627 \u0648|\u0642 \u0648|\u0631\u0627\u0645|\u0644 \u0644|\u0644\u0627\u062C|\u0631\u0627 |\u0627\u0644\u0634| \u0648\u0625|\u064A\u0645 |\u0644\u064A\u0645|\u0634\u062A\u0631|\u0627 \u062D|\u0648\u0627\u062C|\u0644\u0632\u0648|\u0648\u0644 |\u0627 \u0641|\u0648\u0644\u0629|\u0644\u062D\u0645|\u0623\u0633\u0631| \u0630\u0644|\u0647 \u0641|\u0627\u062A\u0647|\u0645\u0633\u0627|\u0644\u0645\u0633| \u062A\u0639|\u0639\u0646 |\u0647 \u0639|\u0648\u0644\u0647|\u064A\u062A\u0647|\u0646 \u0644|\u0631\u0629 | \u0648\u0633|\u0627\u0629 |\u064A\u062F | \u062A\u062D| \u0645\u0633|\u064A \u064A|\u0644\u062A\u064A|\u0639\u0629 |\u0648\u0644\u064A|\u0644\u062F\u0648| \u0623\u0633| \u0648\u0641|\u0644 \u0648|\u0623\u064A\u0629|\u0646\u064A |\u0627\u0644\u0633|\u0644\u0627\u0646|\u0644\u0625\u0639|\u0629 \u0641|\u0631\u064A\u0627|\u0644 \u0625|\u0645 \u0628|\u0627\u0645\u0644|\u0643\u0631\u0627|\u062A\u0633\u0627|\u0645\u064A\u0639|\u062C\u0645\u064A| \u062C\u0645|\u0623\u0648\u0644|\u0628\u064A\u0629|\u0639\u064A\u0634|\u062A\u062D\u0642|\u0627\u062F\u0629|\u0633 \u0627| \u0645\u0645|\u0645\u0639\u064A|\u062C\u0645\u0627|\u0639\u0627\u062A|\u0627\u0639\u0627|\u0627\u0631\u0633|\u0645\u0627\u0631|\u0645\u0645\u0627|\u0645 \u0648|\u0631\u0627\u0643|\u0627\u0634\u062A|\u0627\u0644\u0637|\u0627\u062C |\u0632\u0648\u0627|\u0627\u0644\u0632| \u0648\u0645|\u062D\u062F\u0629|\u062A\u062D\u062F|\u0644\u0645\u062A|\u0645\u0645 |\u0644\u0623\u0645|\u062F\u0647 |\u0628\u0644\u0627| \u0628\u0644|\u0627\u0631 |\u064A\u0627\u0631|\u062A\u064A\u0627|\u062E\u062A\u064A|\u0627\u062E\u062A|\u0646 \u0645| \u0645\u0631",
      urd: "\u0648\u0631 | \u0627\u0648|\u0627\u0648\u0631|\u06A9\u06D2 | \u06A9\u06D2| \u06A9\u06CC| \u06A9\u0627|\u06CC\u06BA | \u062D\u0642|\u06A9\u06CC |\u06A9\u0627 | \u06A9\u0648|\u0626\u06D2 |\u06D2 \u06A9|\u06CC\u0627 |\u0633\u06D2 |\u06A9\u0648 |\u0634\u062E\u0635| \u0634\u062E|\u0646\u06D2 | \u0627\u0633| \u06C1\u06D2|\u0645\u06CC\u06BA|\u062D\u0642 | \u06C1\u0648| \u0645\u06CC|\u062E\u0635 |\u06D2 \u0627| \u062C\u0627|\u0627\u0633 | \u0633\u06D2| \u06CC\u0627|\u06C1\u0631 |\u06CC \u0627| \u06A9\u0631| \u06C1\u0631|\u06D2\u06D4 |\u0633\u06CC |\u06C1\u06CC\u06BA|\u0627 \u062D|\u0635 \u06A9|\u0648\u06BA |\u06D2 \u0645| \u0627\u0646|\u0631 \u0634|\u06D4 \u06C1|\u0627\u0626\u06D2|\u0632\u0627\u062F|\u0622\u0632\u0627| \u0622\u0632|\u0627\u0645 |\u0631 \u0627|\u0642 \u06C1|\u0627\u062F\u06CC|\u062C\u0627\u0626|\u06BA \u06A9|\u06C1\u06D2\u06D4|\u0645 \u06A9| \u06A9\u0633|\u0627 \u062C|\u06CC \u06A9|\u0633 \u06A9|\u06A9\u0633\u06CC| \u067E\u0631|\u06D2 \u06AF|\u06C1\u06D2 |\u0627\u0631 |\u062A \u06A9|\u062F\u06CC |\u067E\u0631 |\u0648 \u0627| \u062D\u0627| \u062C\u0648| \u06C1\u06CC|\u0627\u0646 |\u06CC \u062C|\u0631\u06CC | \u0646\u06C1| \u0645\u0639|\u062C\u0648 |\u0644 \u06A9|\u06CC \u062A|\u0646 \u06A9|\u06A9\u0631\u0646|\u0626\u06CC |\u0644 \u06C1|\u062A\u06CC |\u06C1\u0648 |\u06C1 \u0627| \u0627\u06CC|\u0635\u0644 |\u0627\u0635\u0644|\u062D\u0627\u0635|\u0631\u0646\u06D2|\u06CC \u0634|\u0646\u06C1 |\u06D4 \u0627|\u06BA\u06D4 |\u06CC\u06BA\u06D4|\u0631 \u06A9|\u0631 \u0645| \u0645\u0644|\u0648\u06C1 |\u0645\u0639\u0627|\u0631\u06D2 |\u06BA \u0627|\u0646\u06C1\u06CC|\u06D2 \u06C1|\u06D2 \u0628|\u0627\u06CC\u0633|\u06D2 \u0644| \u062A\u0639| \u06AF\u0627|\u06CC\u062A |\u06CC \u062D|\u0627 \u0627|\u06CC \u0645|\u0627\u067E\u0646| \u0627\u067E|\u06A9\u06CC\u0627|\u0645\u06CC |\u06CC \u0633| \u062C\u0633|\u06C1 \u06A9|\u0646\u06CC |\u0627\u0634\u0631|\u0639\u0627\u0634| \u062F\u0648|\u0644\u0626\u06D2| \u0644\u0626|\u0627\u0646\u06C1|\u0648\u0642 |\u0642\u0648\u0642|\u062D\u0642\u0648|\u0645\u0644 | \u0642\u0627|\u06A9\u06C1 | \u06AF\u06CC|\u0631 \u0628|\u06C1 \u0645| \u0648\u06C1| \u0628\u0646|\u06CC \u0628|\u0645\u0644\u06A9|\u062C\u0633 |\u0627\u06D4 |\u0631\u06CC\u0642|\u0631 \u0646|\u06D2 \u062C|\u0627\u062F |\u0627\u062A |\u06AF\u06CC |\u062F \u06A9|\u06D2 \u062D|\u062F\u0627\u0631|\u0631 \u06C1|\u06AF\u0627\u06D4|\u0642\u0648\u0645| \u0642\u0648|\u06D2\u060C |\u0627 \u0633|\u062F\u0648\u0633|\u0631 \u067E| \u0648 | \u0634\u0627|\u06CC \u0622|\u06BA \u0645|\u0642 \u062D| \u067E\u0648| \u0628\u0627|\u062E\u0644\u0627|\u0627\u0646\u06D2|\u06CC\u0645 |\u0644\u06CC\u0645|\u0648 \u062A|\u0648\u0646 | \u06A9\u06C1|\u06CC\u060C |\u06D4 \u06A9|\u0627 \u067E|\u0646 \u0627|\u0644\u06A9 |\u0639\u0644\u0627|\u0627 \u0645|\u0642 \u06A9|\u0627\u0626\u06CC|\u0648\u0633\u0631|\u06CC \u06C1|\u0648\u0626\u06CC|\u06CC\u0631 |\u0627 \u06C1|\u0639\u0644\u06CC|\u0648 \u06AF|\u0648\u0631\u06CC|\u062F\u06AF\u06CC|\u0646\u062F\u06AF|\u0648 \u06A9|\u06CC\u0633\u06D2| \u0645\u0646|\u0627\u0626\u062F|\u0631\u0627\u0626| \u0645\u0631|\u067E\u0648\u0631| \u0637\u0631|\u0648\u0645\u06CC|\u06D2 \u062E|\u0633\u0628 |\u0646\u0648\u0646|\u0627\u0646\u0648|\u0642\u0627\u0646| \u0633\u06A9|\u0648\u0627\u0645|\u06CC\u0646 | \u0631\u06A9|\u062A\u0639\u0644|\u0644\u0627\u0642|\u063A\u06CC\u0631|\u062F\u0627\u0646|\u060C \u0627| \u0628\u06CC| \u0645\u0633|\u06CC\u0648\u06BA|\u0646\u0627 | \u0628\u06BE| \u0628\u0631|\u0631\u062A\u06CC|\u0627\u062F\u0627|\u0627\u0645\u0644|\u06CC\u06C1 | \u06CC\u06C1|\u06C1 \u0648| \u0639\u0627|\u06CC \u067E| \u0628\u0686|\u0627\u0641 |\u0644\u0627\u0641| \u062E\u0644|\u06CC\u06D4 |\u06AF\u06CC\u06D4| \u062F\u06CC|\u06BE\u06CC |\u0628\u06BE\u06CC|\u062F\u06C1 |\u062C\u0627 |\u067E\u0646\u06CC|\u0642\u0648\u0627|\u0627\u0642\u0648|\u0631\u06A9\u06BE|\u06D2 \u06CC| \u0639\u0644|\u06A9\u0648\u0626|\u060C \u0645| \u0686\u0627|\u06D2 \u0633|\u0631 \u0639| \u067E\u06CC|\u0628\u0631\u0627|\u0631 \u0633|\u0631 \u062D|\u0633\u0627\u0646|\u0645 \u0627|\u06A9\u0627\u0645|\u0634\u0631\u062A| \u0631\u0627|\u0634\u0627\u0645|\u0645\u0646 |\u0632\u0646\u062F| \u0632\u0646|\u0628 \u06A9|\u062A \u0645|\u0627\u06C1 |\u0627\u0631\u06CC|\u0633 \u0645|\u0631 \u062C| \u0645\u062D|\u0648\u0631\u0627|\u06D2 \u067E|\u0637\u0631\u06CC|\u06C1\u0648\u06BA|\u0627\u0644 |\u06BA \u0633|\u06CC \u0646|\u06A9\u0631\u06D2| \u0645\u0642|\u062A \u0633|\u062A\u062D\u0641| \u062A\u062D|\u0648\u06D4 |\u06C1\u0648\u06D4|\u0628\u0646\u062F| \u0627\u0642|\u062F \u06C1| \u0627\u0645|\u0627\u0645\u06CC|\u0627\u0644\u0627|\u0644\u062A |\u0634\u0631\u06D2|\u06D2 \u0639|\u0627 \u06A9|\u0641\u0631\u06CC",
      pes: " \u0648 | \u062D\u0642| \u0628\u0627|\u0646\u062F |\u0631\u062F |\u062F\u0627\u0631| \u062F\u0627|\u06A9\u0647 |\u0647\u0631 | \u062F\u0631| \u06A9\u0647|\u062F\u0631 | \u0647\u0631|\u0631 \u06A9|\u062D\u0642 |\u062F \u0647|\u0627\u0632 |\u06CC\u062A | \u0627\u0632|\u06CC\u0627 |\u06A9\u0633 |\u0648\u062F |\u0627\u0631\u062F| \u06CC\u0627| \u06A9\u0633|\u0627\u06CC |\u062F \u0648| \u0628\u0631| \u062E\u0648|\u0642 \u062F|\u0628\u0627\u0634|\u0634\u062F |\u062F \u06A9|\u0627\u0631 |\u062F \u0628| \u0631\u0627|\u0647 \u0628|\u0627\u0646 |\u0622\u0632\u0627| \u0622\u0632|\u0631\u0627 |\u0627\u0634\u062F|\u06CC \u0648|\u0647 \u0627|\u06CC\u0646 |\u06CC\u062F |\u0632\u0627\u062F|\u0633 \u062D|\u062E\u0648\u062F|\u06CC \u0628| \u0627\u0633|\u062F\u0647 |\u062F\u06CC |\u0648\u0631 |\u0627\u06CC\u062F|\u0647 \u062F|\u0631\u06CC |\u0648 \u0627|\u062A\u0645\u0627|\u0627\u062A | \u0646\u0645|\u06CC \u06A9|\u0627\u062F\u06CC|\u0646\u0647 |\u0631\u0627\u06CC|\u062F \u0627| \u0622\u0646|\u0627\u0633\u062A|\u0631 \u0627|\u0631 \u0645| \u0627\u062C|\u0645\u0627\u06CC|\u0648\u0646 |\u0642\u0648\u0642|\u062D\u0642\u0648|\u0648 \u0645| \u0627\u0646|\u0627\u0646\u0647| \u0647\u0645|\u0648\u0642 |\u0627\u06CC\u062A| \u0634\u0648|\u06CC \u0627| \u0645\u0648| \u0628\u06CC|\u0628\u0627 | \u062A\u0627|\u0648\u0631\u062F|\u0627\u0646\u0648|\u0633\u062A |\u0648\u0627\u0646|\u0628\u0631\u0627|\u0627\u0645 |\u0634\u0648\u062F|\u0622\u0646 |\u062C\u062A\u0645|\u06CC \u06CC| \u06A9\u0646|\u0631 \u0628|\u06A9\u0646\u062F| \u0645\u0631|\u062A \u0645|\u0647\u0627\u06CC|\u062A \u0627| \u0645\u0633|\u06CC\u060C |\u0645\u0627\u0639|\u0627\u062C\u062A|\u062A\u0648\u0627|\u06CC\u06AF\u0631|\u0648 \u0628|\u062F\u0627\u0646|\u062A \u0648|\u0627 \u0645| \u0628\u062F|\u0639\u06CC |\u06A9\u0627\u0631| \u0645\u0646|\u0645\u0648\u0631| \u0645\u0642|\u06CC \u062F| \u0632\u0646|\u06CC \u0645|\u0646 \u0628|\u0631 \u062E|\u0627\u0647 |\u0627 \u0628|\u0627\u0631\u06CC|\u062F \u0622|\u0645\u0644 | \u0628\u0647|\u0627\u0639\u06CC|\u062F\u060C |\u062F\u06CC\u06AF|\u062A \u0628|\u0628\u0627\u06CC|\u0627\u06CC\u0646| \u0645\u06CC|\u0646 \u0648|\u0642 \u0645| \u0639\u0645| \u06A9\u0627|\u0646 \u0627|\u0648 \u0622| \u062D\u0645|\u0646\u0648\u0646|\u0647 \u0648|\u0648 \u062F|\u062F \u0634| \u0627\u06CC|\u0634\u0648\u0631|\u06A9\u0634\u0648| \u06A9\u0634|\u0644\u06CC |\u0646\u06CC |\u0647 \u0645|\u0628\u0639\u06CC|\u0631 \u0634|\u06CC\u0647 | \u0645\u0644|\u0645\u06CC\u062A|\u06CC \u0631|\u0631\u0646\u062F| \u0634\u0631|\u0645\u06CC |\u0648\u06CC |\u0633\u0627\u0648|\u0642\u0627\u0646| \u0642\u0627|\u0645\u0642\u0627|\u0627\u0648 | \u0627\u0648|\u062F \u0645|\u06AF\u06CC |\u0646\u0645\u06CC| \u0627\u062D| \u0645\u062D|\u0645\u06CC\u0646|\u0626\u06CC |\u0627\u062F\u0627| \u0622\u0645|\u062E\u0648\u0627|\u06AF\u0631\u062F| \u06AF\u0631|\u0645\u0646\u062F| \u0634\u062F|\u0627\u0626\u06CC| \u062F\u06CC|\u0632 \u062D|\u0647\u06CC\u0686| \u0647\u06CC|\u0627\u062F\u0647| \u0645\u062A|\u0646\u0645\u0627|\u062A \u06A9|\u0631\u0627\u0646| \u0628\u0645|\u0646 \u062D|\u0631 \u062A|\u062D\u0645\u0627|\u0627\u0631\u0646|\u0645\u0633\u0627|\u062F\u06AF\u06CC|\u0648\u0645\u06CC|\u0646 \u062A|\u0645\u0644\u0644|\u0628\u0631 |\u0647\u062F |\u0648\u0627\u0647|\u0628\u0647\u0631| \u0627\u0639|\u200C\u0647\u0627|\u0642 \u0648|\u060C \u0627|\u0639\u06CC\u062A|\u06CC\u062A\u0648|\u0627 \u0631|\u0646 \u0645| \u0639\u0642|\u0647\u0645\u0647|\u0627 \u0647|\u0632\u0634 |\u0648\u0632\u0634|\u0645\u0648\u0632|\u0622\u0645\u0648|\u0627\u0646\u062A|\u062A\u06CC |\u062C\u0627\u0645|\u0645\u0648\u0645|\u0639\u0645\u0648|\u062A\u062E\u0627| \u0641\u0631|\u0637\u0648\u0631|\u062F \u062F|\u0647 \u062D|\u0631\u062F\u0627|\u0627\u0648\u06CC|\u0646\u0648\u0627|\u0627\u0646\u06CC|\u0631\u0627\u0631| \u0645\u062C|\u06CC \u0646|\u062D\u062F\u06CC|\u0627\u062D\u062F|\u0646\u062F\u06AF|\u0632\u0646\u062F|\u0634\u062E\u0635| \u0634\u062E|\u200C\u0645\u0646|\u0647\u200C\u0645|\u0631\u0647\u200C|\u0647\u0631\u0647|\u0634\u062F\u0647|\u0639 \u0627|\u0648 \u0647|\u0627\u0633\u06CC|\u0647\u0654 |\u06CC\u062F\u0647|\u0639\u0642\u06CC|\u0627 \u0627|\u0645\u0647 | \u0628\u0634|\u0627\u062F |\u062F\u06CC\u0647|\u0627 \u062F|\u062F\u0648\u0627|\u06CC \u062D|\u0627\u0628\u0639|\u06CC \u062A|\u062E\u0627\u0628|\u0646\u062A\u062E|\u0631\u0648\u0631|\u0648 \u0631|\u0634\u0631\u0627| \u062E\u0627|\u0654\u0645\u06CC|\u0627\u0654\u0645|\u062A\u0627\u0654|\u0627\u064B |\u0627\u0645\u0644|\u0644\u0647 |\u062F \u0631|\u0627\u0633\u0627|\u062E\u0648\u0631|\u0628\u0644 |\u0627\u0628\u0644|\u0642\u0627\u0628|\u06CC\u06A9 |\u0633\u0627\u0646|\u0642\u0631\u0627|\u0627 \u0646|\u062E\u0635\u06CC| \u0627\u0645| \u0628\u0648|\u06CC\u0631 |\u0627\u0644\u0645|\u0628\u06CC\u0646|\u0627\u0647\u062F|\u062A\u0628\u0639| \u062A\u0628",
      zlm: " \u062F\u0627|\u0627\u0646 |\u062F\u0627\u0646| \u0628\u0631| \u0627\u0648|\u0646 \u0633|\u0631\u06A0 |\u062F\u0627\u0644| \u06A4\u0631|\u0644\u0647 |\u0643\u0646 | \u0643\u06A4|\u0646 \u0627|\u0646 \u0643|\u0646 \u062F|\u064A\u06A0 | \u064A\u06A0|\u06A4\u062F |\u062D\u0642 |\u0648\u0631\u06A0|\u062A\u064A\u0627|\u064A\u0627\u06A4|\u0627\u0631\u0627|\u0643\u06A4\u062F|\u0627\u0648\u0631|\u0631\u062D\u0642|\u0628\u0631\u062D|\u0627\u0644\u0647|\u0623\u0646 |\u0648\u0644\u064A| \u0627\u062A|\u0627\u062A\u0627|\u06A0\u0646 |\u062A\u0627\u0648|\u0627\u06A4 |\u0633\u062A\u064A|\u0644\u064A\u0647|\u0627\u0648 | \u0633\u062A|\u06A4 \u0627|\u064A\u0647 |\u0631\u0627 |\u0647 \u0628|\u0647 \u062F|\u0639\u062F\u0627| \u0639\u062F|\u0646 \u06A4|\u0646 \u0628|\u064A\u0646 | \u062A\u0631|\u0642 \u0643|\u0646 \u064A|\u064A\u0628\u0633|\u0628\u064A\u0628| \u062A\u064A| \u0633\u0648| \u0643\u0628| \u0633\u0627|\u0646 \u0645|\u0646 \u062A|\u0644\u0645 |\u0627\u0644\u0645|\u062F \u0633|\u06A0 \u0639| \u0645\u0646|\u0686\u0627\u0631|\u062F \u06A4|\u0631\u0646 |\u0633\u0627\u0645| \u0645\u0627|\u06BD \u0633|\u0646\u060C | \u0628\u0648| \u0627\u064A|\u0646\u062F\u0642| \u062D\u0642|\u06AC\u0627\u0631|\u0646\u06AC\u0627|\u0628\u0648\u0644|\u0633\u0628\u0627| \u0633\u0628|\u0627\u062A\u0648|\u0627 \u0633|\u0642\u0644\u0647| \u06A4\u0645| \u0645\u0645|\u0648\u0627\u0646|\u0633\u0686\u0627| \u0633\u0686| \u0643\u0633|\u0627 \u0628|\u0633\u0646 | \u0633\u0645|\u06A4\u0631\u0644|\u0627\u0648\u0646|\u0646\u06BD |\u062A\u0646 | \u0628\u0627|\u0647\u0646 |\u0633\u064A\u0627|\u0627 \u06A4|\u0627\u0631\u06A0|\u0628\u0627\u0631|\u06A4\u0627 |\u0628\u0633\u0646|\u0643\u0628\u064A|\u0627\u0645 |\u064A\u0646\u062F|\u064A \u062F|\u0627\u06AC\u064A|\u06A0 \u0628|\u0628\u0627\u06AC|\u064A \u0627|\u0645\u0627\u0646| \u0644\u0627| \u062F |\u062F\u0642\u0644|\u0647\u0646\u062F| \u0647\u0646|\u062A \u062F|\u0627\u062F\u064A|\u0648\u064A\u0646|\u064A\u0643\u0646| \u0646\u06AC|\u060C \u0643|\u0646\u0662 | \u06A4\u0648|\u0628\u06A0\u0633|\u0642\u0662 |\u0627\u062A |\u0627\u0648\u0644|\u0627\u0643\u0646|\u0627\u06BD | \u0633\u0633|\u0648\u0646 |\u0627\u062F | \u0643\u0648|\u0627\u064A\u0646|\u062F\u06A0\u0646| \u062F\u06A0|\u0627\u0626\u0646|\u062A\u0648 |\u062A\u064A |\u0646 \u0647|\u06AC\u064A |\u0633\u064A |\u0642 \u0645|\u0648\u06A0\u0646|\u062F\u0648\u06A0|\u0646\u062F\u0648|\u0644\u064A\u0646|\u0631\u0644\u064A|\u0646\u062A\u0648|\u06A4\u0648\u0646|\u0648\u0627\u062A|\u064A\u0627\u062F|\u062A\u064A\u0643|\u06A0\u0633\u0627|\u06A4\u0645\u0628|\u062A\u0631\u0645|\u0662 \u062F|\u062D\u0642\u0662|\u0648\u0627 |\u0644\u0648\u0627|\u0645\u0627\u0633|\u0648\u0642 |\u0647 \u0645|\u0644 \u062F| \u0645\u0644|\u0648\u0646\u062F| \u06A4\u06A0|\u0627\u060C |\u060C \u062A|\u0644\u0627\u0626|\u0627\u064A |\u0645\u06A4\u0648|\u064A\u0643 |\u064A \u0643|\u0631\u0627\u062A|\u0645\u0631\u0627| \u0628\u064A|\u0633\u0645\u0648|\u0648 \u0643|\u060C \u062F|\u0633\u0648\u0627|\u06A0 \u0645|\u06A0 \u0633|\u06A0\u0662 |\u06A4\u0631\u064A|\u064A\u0631\u064A|\u062F\u064A\u0631|\u0627 \u0627|\u0627\u0633\u0627|\u06A4\u0662 |\u062A\u0627 |\u0633\u0648\u0633|\u060C \u0633|\u062C\u0648\u0627|\u06A0 \u062A|\u0631\u0623\u0646| \u0627\u0646|\u0633\u0623\u0646|\u0631\u064A\u0643|\u064A\u0623\u0646|\u0631\u064A | \u062F\u0631|\u0627\u0645\u0631|\u0643\u0631\u062C| \u06A4\u0644|\u0627 \u062F|\u062C\u0631\u0646|\u0627\u062C\u0631|\u0627\u0631\u0643|\u0644\u0627\u062C|\u062F \u0643|\u0648\u0627\u0631|\u0628\u0631\u0633|\u0648\u0646\u062A|\u0645\u0646\u0648|\u0633\u0627\u0644|\u064A\u0646\u06A0|\u062F\u06A0\u0662|\u0646\u062F\u06A0| \u0645\u06A0|\u0627\u06A4\u0627|\u0633\u0633\u064A|\u0633\u0627\u0633|\u0646\u0646 |\u06A4\u0648\u0644|\u0627\u06AC\u0627| \u0628\u06A0| \u0633\u06A4|\u0645\u0628\u064A| \u0627\u06A4|\u06A0 \u0627|\u0627\u0631\u0623|\u06A4\u0631\u0627|\u064A \u0633|\u0628\u0633 | \u062F\u0644|\u0627 \u0645|\u0645\u0648\u0627|\u06A4\u0644\u0627|\u0645\u0644\u0627|\u06A4\u0631\u0643|\u0643\u0648\u0631|\u0648\u0628\u0648| \u0643\u0623|\u0648\u0643\u0646|\u0623\u0646\u06BD|\u0643\u0633\u0627|\u06A0\u06AC\u0648|\u0627\u062F\u06A4|\u0647\u0627\u062F|\u0631\u0647\u0627|\u062A\u0631\u0647|\u0643\u0648\u0645|\u062A\u0648\u0642|\u0645 \u0633|\u06A0 \u062F|\u062F\u064A | \u062F\u064A|\u0662 \u0633|\u0646\u062F\u064A|\u0627\u0633 |\u0627\u062F\u0627|\u0628\u0648\u0627| \u062F\u0628|\u06A0 \u06A4|\u06BD\u060C |\u0627\u06A4\u0662|\u0631\u062A\u0627|\u0627\u0644 |\u064A\u0627\u0644|\u0648\u0633\u064A| \u0643\u062A|\u0623\u0646\u060C|\u0646\u06A4\u0627|\u062A\u0646\u06A4| \u062A\u0646|\u0645 \u06A4|\u0631\u0633\u0627|\u0645\u0645\u06A4| \u0645\u0631|\u0646 \u062D| \u0643\u0645|\u0646\u0633\u064A|\u062C\u0623\u0646|\u0624\u064A |\u0644\u0624\u064A|\u0627\u0644\u0624|\u0644\u0627\u0644|\u0643\u06A4\u0631|\u0643\u062A |\u0631\u0643\u062A|\u0634\u0627\u0631|\u0645\u0634\u0627| \u0645\u0634|\u062C\u0627\u062F|\u0631\u06AC\u0627",
      skr: "\u062A\u06D2 |\u0627\u06BA |\u062F\u06CC |\u062F\u06D2 | \u06D4 |\u0648\u06BA | \u062A\u06D2| \u062F\u0627| \u06A9\u0648|\u06A9\u0648\u06BA| \u062D\u0642|\u062F\u0627 | \u062F\u06CC|\u06CC\u0627\u06BA| \u062F\u06D2|\u06CC\u06BA |\u06D2 \u0627|\u0634\u062E\u0635| \u0634\u062E|\u06C1\u0631 |\u06D2 \u06D4|\u0627\u0635\u0644| \u062D\u0627|\u062D\u0642 |\u062E\u0635 | \u06C1\u0631|\u0635\u0644 |\u062D\u0627\u0635|\u06C1\u06D2 | \u06C1\u06D2|\u0627\u0644 |\u0642 \u062D|\u0644 \u06C1| \u0646\u0627| \u06A9\u06CC| \u0648\u0686|\u06D4 \u06C1|\u06CC\u0627 |\u0633\u06CC |\u06D2 \u0645| \u0627\u0648|\u0648\u0686 |\u0627\u062A\u06D2|\u06A9\u06CC\u062A|\u0627 \u062D|\u0627\u062F\u06CC|\u0646\u0627\u0644|\u0635 \u06A9| \u0627\u062A|\u0631 \u0634|\u06C1\u06CC\u06BA| \u06CC\u0627|\u06BA \u062F| \u0627\u06CC|\u06CC\u0633\u06CC| \u0645\u0644|\u0648\u0646\u062F|\u06A9\u06C1\u06CC| \u06A9\u06C1|\u06CC \u062A|\u0632\u0627\u062F|\u0627\u0632\u0627| \u0627\u0632|\u0646\u062F\u06D2|\u06BA \u06A9|\u0627\u0631 | \u0648\u06CC|\u06D2 \u06A9|\u0626\u06D2 | \u0627\u0646|\u06BB \u062F|\u0646\u06C1 | \u06A9\u0631|\u0627\u0648\u0646|\u06D2 \u0648|\u062F\u06CC\u0627|\u06CC \u062F|\u06BA \u0627|\u06D2 \u0628|\u0648\u06CC\u0633|\u0648\u06BB |\u06CC \u0646| \u06C1\u0648|\u062A\u06CC |\u06CC \u06D4| \u0646\u06C1|\u06CC \u0627|\u06CC\u0646\u062F|\u0648 \u0684|\u0622\u067E\u06BB| \u0622\u067E|\u0627 \u0648|\u06D2 \u062C| \u06A9\u0646|\u06D2 \u0646|\u0646\u062F\u06CC|\u062A \u062F|\u06D2 \u062D|\u06CC \u06A9|\u0626\u06CC |\u0645\u0644\u06A9|\u06CC\u062A\u06D2|\u0646 \u06D4|\u062A\u06BE\u06CC| \u062A\u06BE|\u0648\u0646 |\u06BA \u0645| \u0628\u0686|\u06D4 \u0627|\u0646\u0648\u06BA|\u06A9\u0646\u0648|\u06BB\u06D2 |\u0627\u0631\u06CC|\u0627 \u0627|\u06D2 \u06C1|\u0644 \u062A| \u0684\u0626|\u0648\u0642 |\u0642\u0648\u0642|\u062D\u0642\u0648|\u0644 \u06A9|\u062E\u0644\u0627| \u062C\u06CC|\u0644\u06A9 |\u062F\u0627\u0631|\u06CC\u062A |\u06A9\u0631\u06BB|\u0627\u0646\u06C1|\u06A9\u0648 |\u06C1\u06A9\u0648| \u06C1\u06A9|\u0646 \u0627|\u0645\u0644 | \u0648\u0633|\u06BA \u0648|\u067E\u06BB\u06D2| \u062A\u0639|\u06CC \u0645|\u0627\u0641 |\u06D2 \u062E|\u0646\u0648\u0646|\u0642\u0646\u0648| \u0642\u0646| \u0644\u0648|\u06D4 \u06A9|\u0631\u06CC |\u0644\u06D2 |\u062A\u0627 |\u06CC\u062A\u0627| \u0642\u0648| \u0686\u0627|\u06C1\u0627\u06BA|\u0684\u0626\u06D2|\u0642 \u062A|\u0627\u06CC\u06C1|\u0631\u06BB |\u06D2 \u062F|\u0631 \u06A9| \u0648 |\u0644\u0627\u0641| \u062E\u0644| \u062C\u0648|\u06CC \u0648|\u0627\u0648 |\u06C1\u0648 |\u0626\u0648 |\u0686\u0626\u0648|\u0628\u0686\u0626|\u06CC\u0631 |\u06C1\u0648\u0648|\u0627 \u0645|\u06CC \u062C|\u0627\u0644\u0627|\u06CC\u0646 | \u062C\u0627|\u0645\u06CC |\u0646\u06C1\u0627|\u0627\u0646 |\u0627\u062A |\u0633\u06B1\u062F| \u0633\u06B1|\u06CC\u0628 |\u0633\u06CC\u0628|\u0648\u0633\u06CC| \u0634\u0627|\u0628 \u062F|\u06CC\u0648\u06BB|\u0627\u0645 |\u0627\u0648\u06BB|\u06D2 \u062A|\u06BB \u06A9| \u0645\u0637|\u06BA \u062A| \u0648\u0646| \u06A9\u0645|\u0646 \u062F|\u0631\u06A9\u06BE| \u0631\u06A9|\u06BB\u06CC |\u06BA \u0622|\u0631\u06CC\u0627|\u06CC \u06C1|\u0627\u062F |\u06CC\u0627\u062F|\u0639\u0644\u0627|\u0631 \u06C1|\u06BA \u0633|\u06CC \u062D|\u062C\u06BE\u06CC|\u0627\u0626\u062F|\u06C1\u06CC |\u0644\u0648\u06A9| \u068B\u0648| \u0633\u0645| \u0633\u0627| \u0645\u0646| \u0645\u0639|\u0628\u0642 |\u0627\u0628\u0642|\u0637\u0627\u0628|\u0645\u0637\u0627|\u06BE\u06CC\u0648|\u06BA \u0641|\u06C1\u0646 | \u06C1\u0646|\u062C\u0648 |\u0648 \u06A9|\u06BA \u0634|\u0631 \u062A|\u06A9\u0627\u0631|\u0645 \u062F|\u06BE\u06CC\u0627| \u067B\u0627|\u063A\u06CC\u0631|\u0648 \u0644|\u0648\u0626\u06CC|\u062C\u06CC\u0627|\u0648\u0627\u0645|\u0642\u0648\u0627|\u06CC \u0633| \u062C\u06BE|\u0644 \u0627|\u0642\u0648\u0645| \u0633\u06CC|\u0630\u06C1\u0628|\u0645\u0630\u06C1| \u0645\u0630|\u0627\u06D2 | \u0627\u06D2|\u062F\u0646 |\u0627 \u062A|\u0633\u0627\u0646|\u0646\u0633\u0627|\u0627\u0646\u0633|\u0631\u06D2 |\u0644\u06CC\u0645|\u0639\u0644\u06CC|\u062A\u0639\u0644|\u0627\u0645\u0644|\u06C1 \u062F|\u06D2 \u0631|\u062F \u0627|\u06A9\u0645 |\u06CC\u06C1\u0648|\u0641\u0627\u0626|\u0686 \u0627| \u06A9\u06BE|\u0645 \u062A|\u0631\u0627 |\u0648\u0631\u0627|\u067E\u0648\u0631|\u06BA \u0628|\u0642 \u062F|\u06D2 \u0642|\u0648\u06A9\u0648|\u06A9\u06BE\u06CC|\u0627 \u06A9|\u0648 \u062F|\u06D2 \u0630|\u067E\u06BB\u06CC|\u0628\u0646\u062F| \u0641\u0631|\u06A9\u0648\u0626|\u0627\u0645\u06CC|\u06CC \u06CC|\u0627\u0626\u06CC|\u0644\u0627\u0642|\u0627\u06CC\u06BA|\u06C1 \u0627| \u0646\u0638|\u0633\u0645\u0627|\u0648\u0645\u06CC|\u06CC\u060C |\u06D2 \u0633|\u062A \u0648|\u06BE\u06CC\u0646|\u06D2 \u0639|\u06CC\u0645 |\u0633\u06C1\u0648| \u0633\u06C1",
      pbu: " \u062F | \u0627\u0648|\u0627\u0648 |\u067E\u0647 | \u067E\u0647|\u064A\u06D4 | \u062D\u0642|\u0686\u06D0 | \u0686\u06D0|\u0631\u0647 |\u064A \u0627|\u06D0 \u062F| \u0647\u0631|\u0646\u0647 |\u0647\u0631 |\u062D\u0642 | \u0685\u0648|\u0648\u06A9 |\u0685\u0648\u06A9|\u0648 \u0627|\u0647 \u062F|\u0647 \u0627|\u06D4 \u0647|\u0647 \u0648| \u0634\u064A| \u0644\u0631|\u064A \u0686|\u0648 \u062F|\u0631\u064A |\u0644\u0631\u064A|\u0642 \u0644| \u06A9\u069A|\u0648\u064A |\u069A\u06D0 |\u06A9\u069A\u06D0|\u0647 \u06A9|\u063A\u0647 |\u0644\u0648 |\u0631 \u0685|\u0633\u0631\u0647| \u0633\u0631|\u0647 \u067E| \u067C\u0648|\u0648 \u067E|\u0644\u0647 |\u064A\u062A |\u067C\u0648\u0644|\u064A\u0627 |\u06A9\u0693\u064A| \u06A9\u0648|\u062E\u0647 |\u064A\u060C |\u062F\u064A | \u0644\u0647| \u0627\u0632|\u062F \u0645| \u0647\u064A| \u0648\u0627| \u064A\u0627| \u0685\u062E|\u0627\u0632\u0627|\u062F \u0627|\u0648\u0644\u0648|\u0647 \u062A|\u0685\u062E\u0647| \u06A9\u0693|\u0648\u0644 |\u0647\u063A\u0647|\u0647 \u0634|\u064A \u062F| \u0647\u063A|\u06A9\u0648\u0644|\u0632\u0627\u062F|\u0646\u0648 | \u0648\u064A|\u0648 \u064A|\u0647 \u0628|\u0634\u064A\u06D4|\u062F\u06D0 |\u064A\u0648 | \u062F\u064A|\u062A\u0647 |\u062E\u067E\u0644| \u067E\u0631|\u0627\u062F |\u062F \u062F|\u06A9 \u062D| \u062A\u0648|\u0647 \u0645|\u06AB\u0647 |\u0647 \u0647|\u0642\u0648\u0642|\u062D\u0642\u0648|\u0648 \u0645|\u0647 \u062D|\u062F \u0647| \u062A\u0631| \u0645\u0633|\u0634\u064A | \u0646\u0647|\u0693\u064A\u06D4|\u0646\u064A |\u062F \u067E|\u0648\u0627\u062F|\u06D0 \u067E|\u0627\u062F\u064A|\u0648\u0644\u0646| \u064A\u0648|\u062F \u062A|\u0648\u0646\u0648|\u0648\u06AB\u0647|\u064A \u0648|\u0644\u064A | \u062F\u0627|\u064A\u062F | \u0628\u0627|\u062A\u0648\u0646| \u062E\u067E|\u064A \u067E|\u062A\u0648\u06AB|\u0627\u0631 |\u0627\u0646\u062F|\u064A\u0648\u0627|\u06D0 \u0648|\u062F\u0627\u0646| \u0628\u0631|\u0693\u064A | \u0639\u0645|\u0627\u0646\u0647| \u062F\u0647|\u064A\u0685 |\u0647\u064A\u0685|\u0627\u0645\u064A|\u0644\u0646\u064A|\u0628\u0639\u064A|\u0689\u0648\u0644| \u0689\u0648|\u0647 \u0644|\u0627\u064A\u062F|\u0628\u0627\u064A|\u0627\u062A\u0648|\u0647 \u06AB| \u062A\u0627|\u067E\u0644 | \u0645\u0644|\u0627\u064A\u062A|\u0648\u0645 |\u0648\u0646 | \u0644\u0627|\u0647\u064A\u0648| \u0634\u0648| \u062F\u063A|\u0645 \u062F|\u062F\u0647 |\u06D0 \u0627|\u0627\u0646 | \u062A\u0647|\u06A9\u0627\u0631|\u062A\u0648 |\u0645\u064A |\u0627\u0631\u0647|\u0627\u0648\u064A|\u0633\u0627\u0648|\u0645\u0633\u0627|\u0646\u0648\u0646|\u062F\u0647\u063A|\u0648 \u062A|\u064A \u0634|\u0627\u0646\u0648| \u0645\u062D|\u064A\u0646 |\u0627\u062E\u0644| \u06AB\u067C|\u0634\u0648\u064A|\u062F\u063A\u0647|\u0648 \u062D|\u0648\u064A\u060C|\u0646\u064A\u0632|\u0633\u064A |\u0627\u0633\u064A|\u0648\u0646\u062F|\u0642\u0648 |\u0648\u0642\u0648|\u0648 \u06A9|\u0648\u0646\u0647|\u0648\u0645\u064A| \u0648\u06A9|\u064A \u062A| \u0627\u0646|\u0642\u0627\u0646|\u0646\u062F\u06D0|\u0648 \u0631|\u06A9 \u062F|\u0647 \u064A|\u0645\u064A\u0646|\u067E\u0631 |\u067C\u0647 |\u0644\u0627\u0645|\u063A\u0648 |\u0647\u063A\u0648|\u062F \u067C|\u0648 \u0647|\u0644 \u062A|\u0644\u06D2 |\u0648\u0644\u06D2|\u0648\u0648\u0646|\u06A9\u064A |\u0631\u0648 |\u0646 \u06A9|\u0645\u0648\u0645|\u0648\u06A9\u0693|\u067E\u0627\u0631|\u0646 \u0634|\u0645\u0646 | \u0646\u0648| \u0648\u0693| \u0642\u0627|\u06D0 \u0686| \u0648\u0633|\u0685 \u0685|\u0634\u062E\u0635| \u0634\u062E|\u0698\u0648\u0646| \u0698\u0648|\u062A\u0631 |\u06AB\u067C\u0647|\u0648 \u0685|\u0647\u0645 |\u0639\u0642\u064A|\u0631\u062A\u0647| \u0648\u0631|\u0628\u0644 | \u0628\u0644|\u0648 \u0628|\u0647 \u0633|\u069A\u0648\u0648| \u069A\u0648| \u06A9\u0627|\u06D0 \u06A9|\u0648 \u0633|\u0627\u062F\u0647|\u0648\u0646\u06A9| \u063A\u0648|\u062F\u0648 |\u0648 \u0646|\u062A \u06A9|\u0645\u0644 |\u0639\u0645\u0648|\u0644 \u0647| \u067E\u064A|\u0648\u0633\u064A|\u0693\u0627\u0646|\u0648\u0693\u0627|\u064A\u0632 |\u062E\u0635\u064A|\u064A \u0645|\u0627 \u0628|\u0627\u062F\u0627|\u0647 \u0646|\u062E\u0644\u064A|\u0648\u0627\u062E|\u062F\u064A\u0648|\u060C \u062F|\u062F \u0642| \u0647\u0645|\u0627 \u062F| \u0628\u064A|\u062A\u0628\u0639| \u062A\u0628|\u0647 \u0686| \u0639\u0642|\u067E\u0644\u0648|\u0648 \u0644| \u0631\u0627|\u062F \u0628|\u0631\u0627\u064A| \u062F\u062E|\u0646\u06D0 |\u0646\u06A9\u064A|\u062A \u062F|\u0627\u0628\u0639| \u0645\u0642|\u062F \u062E|\u0648\u0631\u0647|\u0634\u0631\u0627| \u0634\u0631|\u0631 \u0645|\u0631\u0633\u0631|\u062A\u0627\u0645|\u0647 \u067C| \u0645\u0646|\u0637\u0647 |\u0633\u0637\u0647|\u0627\u0633\u0637|\u0648\u0627\u0633|\u0644\u06D0 | \u0627\u0633|\u06D4 \u062F|\u0628\u0631\u062E|\u06D0 \u0646",
      uig: " \u0626\u0627| \u06BE\u06D5|\u06D5 \u0626|\u0649\u0646\u0649| \u0628\u0648|\u0649\u0644\u0649| \u0626\u0649|\u0628\u0648\u0644| \u06CB\u06D5|\u06CB\u06D5 |\u0649\u0646 |\u0646\u0649\u06AD|\u0642\u06C7\u0642|\u0648\u0642\u06C7|\u06BE\u0648\u0642| \u06BE\u0648|\u0634\u0642\u0627|\u0642\u0649\u0644|\u0649\u06AD |\u0646\u0649 |\u0642\u0627 |\u0644\u0649\u0634|\u0646 \u0628|\u06D5\u0646 |\u0626\u0627\u062F|\u06BE\u06D5\u0645|\u0644\u0649\u0643|\u062F\u06D5\u0645| \u0642\u0649|\u0627\u062F\u06D5| \u0626\u06D5|\u0643\u0649 |\u0646\u062F\u0627|\u062F\u0649\u0646|\u0642\u0627\u0646|\u0649 \u0626|\u06AF\u06D5 |\u06D5\u0645 |\u0649\u0634 |\u0649\u064A |\u06C7\u0642 | \u0628\u0649|\u063A\u0627\u0646|\u0649\u063A\u0627|\u0627\u0646\u062F|\u062A\u0649\u0646|\u0649\u06AF\u06D5|\u0648\u0644\u06C7|\u06D5\u062A |\u06BE\u06D5\u0631|\u0649\u0634\u0649|\u0643\u0649\u0646|\u0649\u062F\u0649|\u0627\u0642 |\u0649\u062A\u0649|\u0644\u06C7\u0642|\u06D5\u0631\u0642|\u0649\u0643\u0649|\u0645\u06D5 |\u0644\u06D5\u062A| \u064A\u0627|\u0644\u06C7\u0634|\u0644\u0649\u0642|\u0645\u0645\u06D5|\u06D5\u0645\u0645| \u0626\u06C6|\u062F\u0627\u0642|\u0631\u0642\u0627| \u062A\u06D5| \u0642\u0627| \u0628\u0627|\u0649\u0634\u0642|\u0627\u0643\u0649|\u063A\u0627 |\u06C7\u0642\u0644|\u0627 \u06BE|\u064A\u0627\u0643|\u0645\u06D5\u0646|\u0631\u0649\u0645| \u0628\u06D5|\u0627 \u0626|\u062F\u06D5 |\u0626\u06D5\u0631|\u0642\u0644\u06C7|\u062F\u06C7 |\u062F\u06C6\u0644| \u062F\u06C6|\u0649\u0644\u06D5|\u0627\u0646 |\u0642 \u06BE|\u0631\u0643\u0649|\u06D5\u0631\u0643|\u06C7\u0642\u0649| \u0645\u06D5|\u0649 \u0628|\u0649\u0645\u06D5|\u06D5\u06BE\u0631|\u0646\u0644\u0649|\u0649\u0642 |\u0646 \u0626|\u0627\u0631\u0627|\u0626\u06C6\u0632|\u0649 \u06CB|\u06C6\u0644\u06D5|\u06BE\u0631\u0649|\u0627\u0631 |\u0644\u0627\u0631| \u0626\u06D0|\u0628\u06D5\u06BE|\u0644\u06D5\u0646|\u0644\u063A\u0627|\u0634 \u06BE|\u0649\u0644\u0627|\u06C7\u0634\u0642|\u0634\u0649 |\u0646\u0649\u0634|\u0642 \u0626|\u0626\u0627\u0631|\u0644\u0649\u0646|\u0628\u0649\u0644| \u0626\u06C7|\u0627 \u0628|\u0627\u064A\u062F|\u0645\u0627\u064A|\u0643\u06D5 |\u0648\u0644\u0645|\u064A\u062F\u06C7|\u0626\u0649\u064A| \u0643\u06D0|\u0627\u0633\u0649| \u0645\u06C7|\u06D5 \u0642|\u06D5\u0631 |\u060C \u0626|\u0649\u0646\u0644|\u064A\u06D5\u062A|\u0649\u0643 |\u0644\u0645\u0627| \u0626\u0648|\u0645 \u0626|\u06D0\u0644\u0649|\u0645\u0627\u0626|\u06D5 \u0628|\u0626\u0649\u06AF|\u062A\u0646\u0649|\u0627\u060C |\u0634 \u0626|\u06C7 \u06BE|\u0634\u0643\u06D5|\u0627\u0644\u0649|\u06AD \u0626|\u0627\u0631\u0649|\u06D5\u0643 | \u0642\u0648|\u0633\u0649\u064A|\u0631\u0644\u0649|\u0649 \u0643|\u0628\u0649\u0631|\u06D5\u0645\u062F|\u06D5 \u06BE|\u0644\u06D5\u0631|\u06C6\u0632\u0649|\u0626\u0627\u0644|\u0649\u064A\u06D5|\u0645\u0646\u0649|\u06D5\u062A\u062A|\u0627\u0626\u0649|\u0634\u0644\u0649|\u0645\u062F\u06D5| \u062A\u06C7|\u0628\u0627\u0631|\u06D5\u0634\u0643|\u06D5\u062A\u0644|\u0644\u0649\u062F|\u0643\u0649\u0644|\u0626\u0649\u0634|\u0642\u0649\u063A|\u0686\u06D5 |\u06C7\u0634\u0649|\u0649\u0645\u0627|\u0627\u0634\u0642| \u062C\u0649|\u0631\u06D5\u0643|\u06D0\u0631\u06D5|\u0643\u06D0\u0631|\u0631 \u0626|\u0631 \u0628|\u0631\u0627\u06CB|\u0646\u060C |\u0627\u06CB\u0627| \u0645\u0627|\u0627\u064A\u0649|\u0627\u062F\u0649|\u062A\u06C7\u0631|\u0646\u06C7\u0646|\u0627\u0646\u06C7|\u06D0\u062A\u0649|\u062A\u0649\u0634|\u0649\u0634\u0644|\u062F\u0627 |\u0649\u062F\u0627|\u06C7\u0631\u06C7|\u0642\u0649 | \u062C\u06D5|\u0628\u0627\u0634|\u062C\u0649\u0646|\u0649\u060C | \u0633\u0627| \u062E\u0649|\u06D0\u0631\u0649|\u0646\u0627\u064A|\u0649\u0646\u0627|\u0649 \u06BE|\u0632\u0649\u0646|\u06D5 \u062A|\u0649 \u0642|\u06D5\u0645\u0646| \u0628\u06C7|\u0631\u0646\u0649|\u0646 \u0642|\u062A\u062A\u0649|\u062A\u0649 |\u0649\u0642\u0649|\u0649 \u064A|\u0643 \u06BE|\u0649\u0631\u0649|\u0627\u0626\u0627|\u064A \u0626|\u062A\u06D5\u0634|\u0634\u0649\u0634|\u0644\u06D5\u0634|\u062F\u0649\u0644|\u062A\u0649\u062F|\u062F\u0627\u060C|\u0633\u0627\u0633|\u0627\u0633\u0627|\u06D5 \u0645|\u0633\u0649\u062A|\u067E \u0642|\u0626\u06D0\u0644|\u0646\u0649\u064A|\u0646 \u06CB|\u0633\u0649\u0632|\u0649\u0633\u0649|\u0649\u0644 |\u0627\u0634 |\u064A\u060C |\u0645\u0649\u0646|\u06C7\u0646\u0649|\u0649\u067E |\u062A\u0649\u0645|\u06D5\u0644\u0649|\u0631\u0649\u0634|\u0649\u064A\u0627|\u06C7\u0634 |\u0645\u06C7\u0634| \u062E\u0627|\u0649\u0631 |\u0645\u06D5\u062A| \u062A\u0627| \u067E\u0627|\u062A\u0644\u06D5|\u0627\u0644\u063A|\u0644\u0649\u0645|\u067E\u0627\u0644|\u0627\u067E\u0627|\u0643\u0627\u067E| \u0643\u0627|\u0627\u0646\u0644|\u06AD \u06BE|\u06C7\u0646\u062F| \u062A\u0648|\u0642\u062A\u0649|\u0627\u0644\u06D5|\u0646 \u06BE|\u06D5 \u062F|\u062C\u062A\u0649|\u0649\u062C\u062A|\u0626\u0649\u062C|\u0631\u0642\u0649|\u0649\u064A\u0649|\u0627\u0631\u0644|\u0627\u0645\u0649| \u06BE\u06C6| \u0628\u06D0|\u06D5\u062A\u0646|\u0627\u062A\u0646|\u0649\u0643\u0627|\u064A \u0645|\u0627\u062A\u0649|\u0634\u0643\u0649|\u0633\u0649 | \u0626\u06C8|\u06D5\u060C |\u062A \u0626|\u06AF\u06D5\u0646| \u062F\u06D5|\u0642 \u0642|\u0648\u0644\u063A|\u0642 \u0628",
      prs: " \u0648 | \u062D\u0642|\u0631\u062F | \u0628\u0627|\u0646\u062F |\u062F\u0627\u0631| \u062F\u0627| \u062F\u0631|\u0647\u0631 |\u06A9\u0647 | \u0647\u0631|\u062F\u0631 | \u06A9\u0647|\u062F \u0647| \u0628\u0647|\u062D\u0642 |\u0631 \u06A9| \u0627\u0632|\u0627\u0632 |\u06CC\u062A |\u0628\u0647 |\u06A9\u0633 |\u0648\u062F | \u06A9\u0633|\u06CC\u0627 |\u0627\u0631\u062F| \u06CC\u0627| \u0628\u0631|\u062F \u0648|\u0642 \u062F|\u062F \u06A9| \u0631\u0627|\u0627\u0631 |\u0627\u06CC | \u062E\u0648| \u0627\u0633|\u0647 \u0628|\u0628\u0627\u0634|\u06CC\u062F |\u0622\u0632\u0627| \u0622\u0632|\u0631\u0627 |\u06CC\u0646 |\u0627\u0646 |\u0647 \u062F|\u0632\u0627\u062F|\u0627\u0634\u062F|\u06CC \u0648|\u0647 \u0627|\u0627\u06CC\u062F|\u0633 \u062D|\u062F\u0647 |\u062F \u0628|\u06CC \u0628|\u0627\u0633\u062A|\u062E\u0648\u062F| \u0622\u0646|\u0634\u062F |\u0648\u0631 | \u0647\u0645|\u062A\u0645\u0627|\u06CC \u0627|\u0627\u062A |\u0631 \u0627|\u0627\u062F\u06CC|\u0646\u0647 |\u0631\u06CC |\u0631\u0627\u06CC|\u0648 \u0627|\u0648 \u0645| \u0646\u0645|\u06CC \u06A9| \u0645\u0648| \u0627\u062C|\u062F\u060C |\u0645\u0627\u06CC|\u0648\u0646 |\u0628\u0631\u0627|\u0642\u0648\u0642|\u062D\u0642\u0648| \u0634\u0648| \u0627\u0646|\u0627\u0646\u0647| \u0645\u0633|\u0647 \u0645|\u0631 \u0628|\u0648\u0642 |\u0627\u06CC\u062A|\u0622\u0646 |\u0647\u0627\u06CC|\u0631 \u0645|\u0647\u06CC\u0686| \u0647\u06CC| \u062A\u0627|\u0647 \u0648|\u0648\u0631\u062F|\u0634\u0648\u062F|\u0627\u0646\u0648|\u0633\u062A | \u0628\u06CC|\u0627\u0645 |\u0648\u0627\u0646|\u06CC\u06AF\u0631|\u0628\u0627 | \u0645\u0631|\u0646 \u0627|\u06CC \u062F|\u062F\u06CC |\u06CC \u0645|\u062F \u0622|\u0631 \u0634|\u0645\u0627\u0639|\u062C\u062A\u0645|\u0627\u062C\u062A|\u06CC \u06CC|\u0633\u06CC | \u06A9\u0646|\u062F\u06CC\u06AF|\u0628\u0627\u06CC|\u062A \u0648|\u0639\u06CC |\u06A9\u0646\u062F|\u062A \u0645|\u062A \u0627| \u0645\u0646|\u0645\u0648\u0631| \u0639\u0645|\u0648 \u062F|\u0631 \u062E|\u0627\u0647 |\u0644\u06CC |\u0627 \u0628|\u0628\u0631 |\u0646\u06CC | \u0634\u062F|\u06CC\u060C |\u0627\u0639\u06CC| \u062F\u06CC|\u062A\u0648\u0627|\u062A \u0628|\u062F\u0627\u0646|\u06A9\u0627\u0631|\u062F \u0627|\u0646 \u0648| \u0634\u0631|\u0645\u06CC | \u06A9\u0627|\u0648 \u0622| \u062D\u0645|\u0633\u0627\u0648|\u0645\u0633\u0627|\u0646\u0648\u0646| \u0627\u0648| \u0632\u0646|\u062F \u0634| \u0645\u062D|\u0646 \u0628|\u0647 \u0634|\u0634\u0648\u0631|\u06A9\u0634\u0648| \u06A9\u0634|\u0627\u0631\u06CC|\u0645\u0644 |\u0628\u0639\u06CC|\u0645\u0646\u062F|\u06CC\u06CC | \u0645\u0644|\u06CC \u0631|\u0648 \u0628|\u062F \u0645|\u0648\u06CC |\u0642\u0627\u0646| \u0642\u0627| \u0645\u0642|\u0627\u0648 |\u0627\u0646\u06CC|\u06AF\u06CC |\u0627\u06CC\u0646| \u0627\u06CC|\u0645\u06CC\u0646|\u0627\u062F\u0627| \u0622\u0645|\u062E\u0648\u0627|\u06AF\u0631\u062F| \u06AF\u0631|\u0647 \u062D|\u060C \u0627|\u0632 \u062D|\u0645\u06CC\u062A|\u0631\u0646\u062F|\u0627 \u0647|\u06CC\u0644 |\u0627\u062F\u0647|\u0646\u0645\u0627|\u0642 \u0645|\u062A \u06A9|\u0631\u0627\u0646|\u0646 \u062D|\u062F \u062F|\u062D\u0645\u0627|\u0627\u0631\u0646|\u0627\u0648\u06CC|\u0627\u0646\u062A|\u0634\u062F\u060C|\u0686\u06A9\u0633|\u06CC\u0686\u06A9|\u062F\u06AF\u06CC|\u0648\u0645\u06CC|\u0645\u0644\u0644|\u0647\u062F |\u0648\u0627\u0647|\u200C\u0645\u0646|\u0647\u200C\u0645|\u0631\u0647\u200C|\u0647\u0631\u0647|\u0628\u0647\u0631|\u060C \u0628|\u06CC\u0647 | \u0627\u0639|\u062F\u06CC\u0647|\u0642 \u0648|\u0639\u06CC\u062A|\u0647\u0654 |\u0627 \u0631| \u0639\u0642|\u0647\u0645\u0647|\u0627\u0628\u0631|\u0631\u0627\u0628| \u0645\u06CC|\u0627 \u0645|\u0632\u0634 |\u0648\u0632\u0634|\u0645\u0648\u0632|\u0622\u0645\u0648|\u0627 \u062F|\u062F\u0648\u0627|\u062A\u06CC |\u062C\u0627\u0645|\u0645\u0648\u0645|\u0639\u0645\u0648| \u0645\u062A| \u0648\u0633| \u0641\u0631|\u0642 \u0627|\u0631 \u062A|\u0645\u0642\u0627|\u06CC\u06A9 |\u0646\u0648\u0627|\u0631\u0627\u0631|\u0646\u0645\u06CC|\u0632\u0646\u062F|\u0634\u062E\u0635| \u0634\u062E|\u0627\u06CC\u06CC|\u062A\u060C |\u0648 \u0647|\u0627\u0633\u06CC|\u06CC\u062F\u0647|\u0639\u0642\u06CC|\u0627\u064B | \u0628\u062F|\u06CC\u062A\u0648|\u0645\u0647 | \u062A\u0645|\u0631\u0634 |\u0637\u0648\u0631|\u0627\u0632\u062F|\u06CC \u062D|\u0627\u0628\u0639|\u06CC \u062A|\u062E\u0627\u0628|\u062A\u062E\u0627|\u0646\u062A\u062E|\u0631\u0648\u0631|\u0648 \u0631|\u0634\u0631\u0627| \u062E\u0627|\u0627\u0628 |\u0654\u0645\u06CC|\u0627\u0654\u0645|\u062A\u0627\u0654|\u200C\u0647\u0627|\u06CC\u0631\u062F|\u0648 \u06CC|\u0627\u0645\u0644|\u0644\u0647 |\u0627\u0633\u0627|\u0631\u062F\u0627|\u062E\u0648\u0631|\u0627 \u0627|\u0633\u0627\u0646|\u0642\u0631\u0627| \u0645\u062C|\u06CC \u0646|\u0627 \u0646|\u06A9\u0633\u06CC|\u062E\u0635\u06CC| \u0627\u0645|\u0646\u062F\u06AF|\u062F\u0648\u062F"
    },
    Devanagari: {
      hin: "\u0915\u0947 |\u092A\u094D\u0930| \u092A\u094D| \u0915\u093E| \u0915\u0947| \u0964 |\u0914\u0930 | \u0914\u0930|\u0915\u093E | \u0915\u094B|\u0915\u093E\u0930|\u093E\u0930 |\u0924\u093F |\u092F\u093E |\u0915\u094B |\u0928\u0947 |\u094B\u0902 |\u093F\u0915\u093E|\u094D\u0930\u0924| \u0939\u0948| \u0915\u093F|\u0902 \u0915|\u0939\u0948 |\u0927\u093F\u0915|\u0935\u094D\u092F|\u0905\u0927\u093F| \u0905\u0927|\u094D\u0924\u093F| \u0938\u092E|\u094D\u092F\u0915|\u093F \u0915|\u0915\u094D\u0924|\u093E \u0905|\u0915\u0940 |\u093E \u0915| \u0935\u094D|\u0947\u0902 | \u0939\u094B|\u092F\u0915\u094D|\u0938\u0940 |\u0938\u0947 |\u0947 \u0915| \u092F\u093E| \u0915\u0940|\u092E\u0947\u0902|\u0928\u094D\u0924| \u092E\u0947|\u0924\u094D\u092F|\u0948 \u0964|\u0924\u093E |\u0930\u0924\u094D|\u0915\u094D\u0937|\u0947\u0915 |\u092F\u0947\u0915|\u094D\u092F\u0947|\u093F\u0915 |\u0930 \u0939|\u092D\u0940 |\u0915\u093F\u0938| \u091C\u093E| \u0938\u094D|\u0915 \u0935|\u093E \u091C|\u093F\u0938\u0940|\u092E\u093E\u0928| \u0935\u093F|\u0930 \u0938|\u0924\u094D\u0930|\u0940 \u0938|\u0964 \u092A| \u0915\u0930|\u094D\u0930\u093E|\u0917\u093E |\u093F\u0924 | \u0905\u092A| \u092A\u0930|\u0938\u094D\u0935|\u0940 \u0915| \u0938\u0947|\u093E \u0938|\u094D\u092F | \u0905\u0928|\u094D\u0924\u094D|\u093F\u092F\u093E|\u093E \u0939| \u0938\u093E|\u0928\u093E |\u094D\u0924 |\u092A\u094D\u0924|\u0938\u092E\u093E|\u093E\u0928 |\u0930 \u0915|\u093E\u092A\u094D|\u0924\u0928\u094D| \u092D\u0940| \u0909\u0938|\u0930\u093E\u092A|\u0935\u0924\u0928|\u094D\u0935\u0924|\u0930\u094B\u0902|\u0935\u093E\u0930|\u0947 \u0938|\u0925\u093E |\u0939\u094B |\u0947 \u0905|\u093E \u0964|\u0928 \u0915| \u0928 |\u0926\u0947\u0936| \u0930\u093E|\u0937\u093E |\u0905\u0928\u094D|\u0924 \u0939|\u094D\u0937\u093E|\u094D\u0935\u093E|\u091C\u093E\u090F|\u0940 \u092A|\u0915\u0930\u0928|\u093E \u092A|\u0905\u092A\u0928|\u0937\u094D\u091F| \u0938\u0902|\u0947 \u0935|\u0939\u094B\u0917|\u093F\u0935\u093E|\u091F\u094D\u0930|\u094D\u091F\u094D|\u093E\u0937\u094D|\u0930\u093E\u0937|\u0938\u0915\u0947| \u092E\u093E|\u0913\u0902 |\u093E\u0913\u0902|\u0930\u0940 |\u0915 \u0938|\u0947 \u092A| \u0928\u093F|\u0940\u092F |\u0930\u0915\u094D|\u094B \u0938|\u093E\u090F\u0917|\u0930\u0928\u0947| \u0907\u0938|\u0935 \u0915|\u092A\u0930 |\u0930\u0924\u093E|\u0930 \u0905| \u0938\u092D|\u0924\u0925\u093E| \u0924\u0925| \u0910\u0938|\u0930\u093E |\u092A\u0928\u0947|\u094D\u0930\u0940|\u093F\u0915\u094D|\u0915\u093F\u092F|\u093E \u0935|\u092E\u093E\u091C|\u0902 \u0914|\u0930 \u0909|\u0926\u094D\u0927|\u0938\u092D\u0940|\u0936\u094D\u092F| \u091C\u093F|\u093E\u0928\u0947|\u093E\u0930\u094D|\u093E\u0930\u093E|\u0926\u094D\u0935| \u0926\u094D|\u090F\u0917\u093E|\u0938\u092E\u094D|\u0947\u0936 |\u093F\u090F |\u093E\u0935 |\u0930 \u092A| \u0926\u0947|\u094D\u0924\u0930|\u093E \u0914|\u093E\u0930\u094B|\u092F\u094B\u0902|\u092A\u0930\u093E|\u092A\u0942\u0930|\u091A\u093F\u0924|\u094D\u0927 |\u0930\u0942\u092A| \u0930\u0942| \u0938\u0941| \u0932\u093F|\u0924 \u0915|\u094B \u092A|\u0902 \u0938|\u0947 \u0932|\u0936\u093F\u0915| \u0936\u093F|\u0935\u093E\u0939|\u0947 \u0914|\u091C\u094B |\u0930\u093E\u0927|\u091C\u093F\u0938|\u0942\u0930\u094D|\u0940 \u092D|\u0942\u092A |\u094B\u0917\u093E|\u0938\u094D\u0925|\u0930\u0940\u092F|\u0924\u093F\u0915|\u094D\u0930 |\u0964 \u0907|\u0907\u0938 | \u0909\u0928|\u0932\u0947 |\u0947 \u092E|\u0932\u093F\u090F|\u092E \u0915|\u0915\u0924\u093E|\u0947 \u092F| \u091C\u094B|\u0928 \u092E|\u0905\u092A\u0930| \u092A\u0942|\u094B \u0915|\u093E \u0909|\u093E\u0939 |\u0928\u0942\u0928|\u093E\u0928\u0942|\u0917\u0940 |\u0926\u0940 |\u093E\u0930\u0940|\u0902 \u092E|\u0964 \u0915|\u0924\u0930\u094D|\u0940 \u0930|\u0936 \u0915|\u092A\u0930\u093F|\u0938\u094D\u0924|\u094B\u0908 |\u0915\u094B\u0908|\u0930\u094D\u092F|\u0940 \u0905|\u0939\u093F\u0924|\u092D\u093E\u0935| \u092D\u093E|\u0924\u093E\u0913|\u093E\u0938 |\u0938\u093E\u092E|\u0935\u093F\u0915|\u0935\u093F\u0935|\u092E\u094D\u092E| \u0938\u0915|\u0915\u0930 |\u093E\u0928\u093E|\u0927 \u0915|\u0928\u093F\u0915|\u092F \u0915|\u0909\u0938\u0915|\u0915\u0943\u0924| \u0958\u093E|\u0928 \u0938|\u091C\u0940\u0935|\u094D\u092F\u093E|\u0930\u0915\u093E|\u094D\u0930\u0915|\u093E\u091C |\u0928\u094D\u092F|\u094D\u092E |\u0930\u094D\u0923|\u0958 \u0939|\u0939\u0958 | \u0939\u0958|\u0940 \u092E|\u091C\u093F\u0915|\u093E\u091C\u093F|\u093E\u092E\u093E|\u0915 \u0914|\u092E\u093F\u0932|\u0947\u0928\u0947|\u0932\u0947\u0928| \u0932\u0947|\u092F\u0947 |\u094B \u0905|\u0947 \u091C|\u0930\u093F\u0935|\u092E\u092F |\u0938\u092E\u092F|\u0935\u0936\u094D|\u0906\u0935\u0936| \u0906\u0935|\u0910\u0938\u0940|\u093E\u0927 |\u0930 \u0926|\u0930\u094D\u0935|\u0938\u093E\u0930|\u092A \u0938|\u092C\u0928\u094D| \u0938\u0939|\u093F\u0927\u093E|\u0935\u093F\u0927|\u0940 \u0928|\u0942\u0928 |\u0958\u093E\u0928",
      mar: "\u094D\u092F\u093E|\u092F\u093E |\u0924\u094D\u092F|\u092F\u093E\u091A|\u091A\u093E |\u0923\u094D\u092F|\u093E\u091A\u093E| \u0935 |\u0915\u093E\u0930|\u092A\u094D\u0930| \u092A\u094D|\u093F\u0915\u093E|\u0927\u093F\u0915|\u093E\u0930 | \u0905\u0927|\u0905\u0927\u093F|\u091A\u094D\u092F|\u0906\u0939\u0947| \u0906\u0939|\u093E \u0905|\u0939\u0947 |\u093E \u0915|\u093E\u0938 |\u0935\u093E |\u094D\u092F\u0947|\u094D\u0930\u0924| \u0938\u094D|\u0924\u093E |\u093E \u0938| \u0905\u0938| \u0915\u0930|\u0938\u094D\u0935| \u0915\u093E|\u0932\u094D\u092F|\u0930\u0924\u094D|\u093E\u0939\u093F|\u0915\u094B\u0923| \u0915\u094B|\u093F\u0915 |\u092F\u0947\u0915|\u094D\u0935\u093E|\u093E \u0935| \u0924\u094D|\u0930 \u0906|\u094D\u092F |\u0924\u094D\u0930|\u0947\u0915\u093E|\u0915\u094D\u0937|\u093E \u0928| \u0938\u0902|\u093E\u092E\u093E|\u093E\u091A\u094D|\u0902\u0935\u093E|\u093F\u0902\u0935|\u0915\u093F\u0902| \u0915\u093F|\u093E\u0924 |\u0937\u094D\u091F|\u0915\u093E\u0938| \u092F\u093E|\u092F\u093E\u0902|\u093E\u0902\u091A|\u0930\u094D\u092F|\u092E\u093F\u0933| \u092E\u093F| \u0938\u093E|\u0935\u094D\u092F|\u094B\u0923\u0924|\u0928\u0947 |\u0947 \u092A|\u0915\u093E\u092E| \u0938\u092E|\u0902\u0924\u094D|\u092F\u0947 | \u0930\u093E|\u0938\u092E\u093E|\u0924\u0902\u0924|\u0915\u0930\u0923|\u093E \u0906|\u0947 \u0915|\u0939\u093F |\u0947 \u0938|\u0928\u093E |\u093F\u0933\u0923|\u0942\u0928 |\u093E \u092A|\u091F\u094D\u0930|\u094D\u091F\u094D|\u093E\u0937\u094D|\u0930\u093E\u0937|\u0940\u092F |\u0935 \u0938|\u0915\u094D\u0924|\u092E\u093E\u0928|\u0930\u094D\u0935| \u0906\u092A|\u0933\u0923\u094D|\u094D\u0930\u094D|\u093E\u0924\u0902|\u0935\u093E\u0924|\u091A\u0947 | \u0935\u093F|\u094D\u0937\u0923|\u0930\u0923\u094D| \u0926\u0947| \u0935\u094D|\u0906\u092A\u0932|\u0939\u0940 |\u093E\u0930\u094D|\u0928\u092F\u0947| \u0928\u092F|\u092E\u093E |\u092F\u093E\u0938| \u091C\u093E|\u0932\u0947\u0932| \u0928\u093F|\u0947 \u0905| \u092A\u093E|\u093E \u092E|\u0932\u0947 |\u093E\u0939\u0940|\u092C\u0902\u0927|\u0947 \u0935|\u094D\u092F\u0915| \u092E\u093E|\u0936\u093F\u0915| \u0936\u093F|\u0926\u0947\u0936|\u093E \u0926|\u092E\u093E\u091C|\u094D\u0930\u0940|\u0932\u0940 |\u093E\u0928 |\u093E\u0902\u0928|\u092A\u0932\u094D| \u0939\u094B|\u093E \u0939|\u0937\u0923 |\u091C\u0947 |\u093F\u091C\u0947|\u0939\u093F\u091C|\u092A\u093E\u0939|\u093E\u0930\u093E|\u092F\u093E\u0924|\u0938\u0930\u094D| \u0938\u0930|\u0930\u093E\u0902|\u0905\u0938\u0932|\u0902\u092C\u0902|\u0938\u0902\u092C|\u093F\u0915\u094D|\u0940 \u092A|\u0902\u091A\u094D|\u0930\u0915\u094D|\u0923\u0924\u094D| \u0906\u0923|\u0932\u093E |\u0938\u094D\u0925|\u0930\u0940\u092F|\u0940\u0924 |\u0902\u0928\u093E|\u0924 \u0935|\u094D\u0935 |\u0915 \u0935|\u0923\u0947 |\u093E\u091A\u0947|\u0928 \u0915|\u0924 \u0915|\u0930\u0924\u093E|\u094D\u0930\u093E|\u092F\u093E\u0939|\u094D\u0924 |\u091A\u0940 |\u092F \u0915|\u0926\u094D\u0927|\u094D\u0935\u0924|\u092F\u0915\u094D|\u0923\u093F |\u0906\u0923\u093F|\u0938 \u0938|\u0902\u0927\u093E|\u0915 \u0938|\u091A\u094D\u091B|\u092F \u0905|\u0924 \u0938|\u0940\u0928\u0947|\u094B\u0923\u093E|\u0915\u0930\u0924|\u0924\u094D\u0935|\u0940\u0932 |\u0940 \u0905|\u0938\u093E\u0930|\u0930 \u0935|\u092D\u093E\u0935|\u0935 \u0924|\u0925\u0935\u093E|\u0905\u0925\u0935| \u0905\u0925|\u0947 \u0924|\u0947 \u091C|\u092F\u093E\u092F|\u0902\u091A\u093E|\u0947\u0932\u094D|\u093E\u0928\u0947|\u0947\u0923\u094D|\u0915 \u0906|\u0915\u094D\u0915|\u0939\u0915\u094D| \u0939\u0915|\u0923 \u092E|\u0902\u0930\u0915|\u0938\u0902\u0930|\u0928\u094D\u092F|\u093E\u092F\u0926|\u093E \u0924|\u0924 \u0906| \u0909\u092A|\u0935\u0938\u094D|\u093F\u0935\u093E|\u0947\u0936\u093E|\u0938\u093E\u092E|\u0947 \u092F|\u0947 \u0906|\u0940 \u0935|\u0935 \u092E|\u0924\u0940\u0928|\u0935 \u0906|\u0927\u094D\u092F| \u0905\u0936|\u0927\u093E\u0924|\u0915\u0943\u0924|\u094D\u0915 |\u0926\u094D\u092F|\u093F\u0924 |\u0938\u0932\u0947|\u0947\u0936 |\u0924\u094B |\u0947\u0932 |\u0924\u0940 |\u094D\u0924\u0940|\u0905\u0938\u0947|\u0907\u0924\u0930| \u0907\u0924|\u0938\u094D\u0924|\u0930\u094D\u0923|\u093E \u092C|\u0947\u0932\u0947| \u0915\u0947|\u0939\u0940\u0930|\u091C\u093E\u0939|\u093E \u091C|\u0947\u0924 |\u0942\u0930\u094D|\u092A\u0942\u0930|\u0947\u091A | \u0935\u093E|\u093E\u091C\u093E|\u0940 \u0938|\u0936\u093E |\u092F \u0935| \u0928\u094D|\u092F\u093E\u0935|\u0926\u094D\u0926|\u094D\u0927 |\u0930\u0942\u0928|\u092F\u0926\u094D|\u0915\u093E\u092F|\u093E \u0936|\u0917\u0923\u094D|\u0915 \u0915|\u0930\u093E\u0927| \u0936\u093E|\u092F\u0924\u094D|\u0932 \u0905|\u094D\u092F\u0935|\u0940 \u0915|\u093E\u0935 |\u093E \u092F|\u0924\u094D\u0924|\u091C\u093F\u0915|\u093E\u091C\u093F|\u0930\u0923\u093E| \u0927\u0930|\u093E \u0927|\u092D\u0947\u0926| \u092C\u093E|\u0930\u0915\u093E|\u094D\u0930\u0915|\u0915\u0947\u0932|\u093F \u0935|\u093F\u0937\u094D|\u0924\u0940\u0932|\u092F\u094B\u0917|\u0938\u093E\u0927|\u093E\u0902\u0924|\u0935\u093F\u0935|\u0936\u094D\u0930| \u0927\u0947| \u092E\u0941|\u0935\u0924\u0903",
      mai: "\u093E\u0915 |\u092A\u094D\u0930|\u0915\u093E\u0930| \u092A\u094D|\u093E\u0930 |\u093F\u0915\u093E|\u094D\u092F\u0915|\u0927\u093F\u0915|\u0915 \u0905|\u094D\u0930\u0924|\u094D\u0924\u093F|\u0935\u094D\u092F| \u0905\u0927|\u0947\u0901 |\u0905\u0927\u093F|\u093F\u0915 | \u0935\u094D|\u0906\u02BC | \u0906\u02BC|\u0915\u094D\u0924|\u092F\u0915\u094D|\u0924\u093F\u0915|\u0915\u0947\u0901|\u0915 \u0935|\u092C\u093E\u0915|\u0915 \u0938|\u091B\u0948\u0915| \u091B\u0948|\u0924\u094D\u092F|\u092E\u0947 |\u0947\u0915 | \u0938\u092E|\u0915\u094D\u0937|\u0939\u093F |\u0930\u0924\u094D|\u0930 \u091B|\u092F\u0947\u0915|\u094D\u092F\u0947|\u0928\u094D\u0924|\u0935\u093E |\u093F\u0915\u0947|\u0915\u0964 |\u0948\u0915\u0964|\u0964 \u092A| \u0905\u092A| \u0938\u094D| \u0935\u093F| \u091C\u093E|\u093F\u0924 |\u0938\u0901 | \u0939\u094B|\u0915\u094B\u0928| \u0915\u094B|\u0924\u094D\u0930|\u0938\u094D\u0935| \u0935\u093E|\u0915 \u0906|\u0937\u094D\u091F| \u0915\u0930|\u0905\u092A\u0928|\u092E\u093E\u0928| \u0915\u093E| \u0905\u0928|\u0924\u093F |\u094D\u0924\u094D|\u0928\u094B |\u0928\u0939\u093F| \u092A\u0930|\u091F\u094D\u0930|\u094D\u092F | \u090F\u0939|\u093F \u0915|\u094D\u091F\u094D|\u093E\u0937\u094D|\u0930\u093E\u0937| \u0930\u093E|\u0938\u092E\u093E|\u094B\u0928\u094B|\u0932 \u091C| \u0928\u0939|\u0924\u093E\u0915|\u093E\u0930\u094D|\u092A\u0928 |\u0924\u0928\u094D|\u0935\u0924\u0928|\u094D\u0935\u0924|\u094D\u0937\u093E| \u0915\u090F| \u0938\u093E|\u094D\u0930\u0940| \u0928\u093F|\u093E \u0906|\u093F\u0935\u093E| \u0938\u0902| \u0926\u0947|\u091C\u093E\u090F|\u0940\u092F |\u0915\u0930\u092C|\u0925\u093E |\u090F\u092C\u093E|\u093E \u092A|\u0928\u093E |\u094D\u0935\u093E|\u0926\u0947\u0936|\u0924\u0964 |\u0930\u0915 |\u0915 \u0939|\u0901 \u0905| \u0938\u092D| \u0906 |\u0924 \u0915|\u091A\u093F\u0924|\u094D\u0924 |\u0935\u093E\u0930|\u0924\u093E |\u093E\u0930\u0915|\u092E\u093E\u091C|\u093E \u0938|\u0930\u0940\u092F|\u0928\u094D\u092F|\u0930\u0924\u093E|\u093E\u0928 |\u094D\u0930\u093E|\u094D\u092F\u093E|\u0930\u0915\u094D|\u093E\u0930\u0923|\u092A\u0930\u093F|\u090F\u0932 |\u0915\u090F\u0932|\u0905\u0928\u094D|\u0930\u092C\u093E|\u0915 \u092A|\u0913\u0930 |\u0906\u0913\u0930| \u0906\u0913|\u0905\u091B\u093F| \u0905\u091B|\u093F\u0930\u094D|\u093E\u0928\u094D|\u0928\u0915 |\u0939\u094B\u090F|\u0915\u0930 |\u0927\u093E\u0930|\u0938\u094D\u0925|\u093E \u0905|\u093F\u092E\u0947|\u0930 \u0906|\u090F\u0939\u093F| \u090F\u0915|\u0947 \u0938|\u0924\u0925\u093E| \u0924\u0925| \u092E\u093E|\u093F\u0915\u094D|\u0936\u093F\u0915| \u0936\u093F|\u092A\u094D\u0924|\u0930\u094D\u0935|\u0928\u093F\u0930|\u091A\u094D\u091B|\u0930\u094D\u092F|\u0901 \u0938|\u0915 \u0915|\u0939\u094B |\u093E\u0939\u093F|\u090F\u0924\u0964|\u0930 \u092A|\u093E\u092E\u093E|\u0938\u093E\u092E|\u0937\u093E |\u02BC \u0938|\u0901 \u090F|\u0948\u0915 |\u0926\u094D\u0927|\u0930 \u0905|\u0915 \u091C|\u0938\u094D\u0924|\u093E\u092A\u094D|\u0901 \u0915| \u0938\u0915|\u092F\u0915 |\u0915\u093E\u0928|\u0939\u0928 |\u090F\u0939\u0928|\u0947\u0932 |\u094B\u090F\u0924|\u0924 \u0906|\u093E \u0935|\u0964 \u0915|\u094D\u0924\u0930|\u093E\u090F\u0924|\u094D\u0930\u0915|\u0939\u0941 |\u0915 \u0909|\u092A\u0942\u0930|\u0935\u093F\u0935|\u02BC \u0905|\u091B\u093F | \u0932\u0947|\u0928 \u092A|\u093E\u0938 |\u0930\u093E\u092A|\u0927\u0915 |\u092A\u090F\u092C| \u092A\u090F|\u0930\u093E |\u092F\u0924\u093E|\u0930\u0942\u092A|\u0928 \u0935| \u0915\u0947|\u0937\u093E\u0915|\u092F \u092A|\u0924 \u0939|\u091C\u093E\u0939| \u0913 |\u092D\u093E\u0935|\u092A\u0930 |\u0925\u0935\u093E|\u0905\u0925\u0935| \u0905\u0925|\u0938\u092E\u094D|\u091C\u093F\u0915|\u093E\u091C\u093F|\u0942\u0930\u094D|\u0930\u0924\u093F| \u0926\u094B|\u0938\u092D\u0915|\u0964 \u0938| \u091C\u0928|\u0938\u092D |\u092C\u093E\u0927|\u0905\u0928\u0941|\u093F\u0938\u0901| \u0938\u0939|\u0901 \u0935|\u090F \u0938|\u0930\u093F\u0935|\u0924\u0941 |\u0947\u0924\u0941|\u0939\u0947\u0924| \u0939\u0947|\u093E\u0927 |\u0947\u092C\u093E|\u0928 \u0938|\u093F\u0937\u094D|\u0930\u093E\u0927| \u0905\u0935|\u093F\u0924\u094D|\u0935\u093E\u0938|\u091A\u093E\u0930| \u0909\u091A|\u093E\u0930\u093E|\u0928 \u0915|\u0935\u0915 |\u093E \u0915|\u0928\u0942\u0928|\u093E\u0928\u0942|\u090F\u0924 |\u0930\u0940 |\u0947\u0913 |\u0915\u0947\u0913|\u0930\u0923 |\u094D\u0930\u0938|\u093F \u0926|\u0913 \u0935| \u092D\u0947|\u0928\u0939\u0941|\u094B\u0928\u0939|\u094D\u0925\u093F|\u092A\u0924\u094D|\u092E\u094D\u092A|\u0930\u093E\u091C| \u092D\u093E|\u0939\u093F\u092E| \u0939\u0915|\u093E\u092E\u0947|\u094D\u0923 |\u0930\u094D\u0923|\u0939\u093E\u0930|\u093F \u0938|\u0915 \u0926|\u0928 \u0905|\u0924 \u0905|\u0932\u0947\u092C| \u0905\u092D|\u093F\u0936\u094D|\u091C\u0915 |\u093E\u091C\u0915|\u0928 \u0906|\u0935\u093E\u0939|\u0915\u093E\u091C|\u0936\u094D\u092F|\u0935\u0938\u094D|\u0913\u0939\u093F| \u0913\u0939|\u092F\u094B\u0917|\u0964 \u090F|\u0915\u090F |\u0947 \u0913|\u0905\u092A\u0930",
      bho: " \u0915\u0947|\u0915\u0947 |\u0947 \u0915|\u093E\u0930 |\u0915\u093E\u0930|\u093F\u0915\u093E|\u0927\u093F\u0915|\u0905\u0927\u093F| \u0905\u0927|\u0913\u0930 |\u0906\u0913\u0930| \u0906\u0913|\u0947 \u0905|\u0947 \u0938|\u093E \u0915| \u0938\u0902|\u093F\u0915 |\u0930 \u0939|\u093E \u0938| \u0939\u094B|\u0930 \u0938|\u0947\u0902 |\u092E\u0947\u0902| \u092E\u0947| \u0915\u0930| \u0938\u0947|\u0928\u094B |\u0915\u094D\u0937|\u0938\u0947 | \u0915\u093E|\u0964 \u0938|\u0916\u0947 |\u093E\u0964 |\u0930\u093E | \u0938\u092E| \u0938\u092C|\u094D\u0930\u093E| \u0938\u0915|\u0930 \u0915|\u0928 \u0915|\u0935\u0947 |\u094C\u0928\u094B|\u0915\u094C\u0928| \u0915\u094C|\u091A\u093E\u0939| \u091A\u093E| \u092C\u093E|\u092A\u094D\u0930| \u092A\u094D|\u0925\u093E |\u093F \u0915|\u0924\u093F | \u091C\u093E| \u0938\u093E|\u0947 \u0906|\u092A\u0928 |\u0915\u0930\u0947|\u0924\u093E |\u0939\u094B\u0916|\u0924 \u0915|\u0947\u0964 |\u0947 \u092C|\u0924\u0925\u093E| \u0924\u0925| \u0906\u092A|\u0915\u0947\u0932|\u0938\u0915\u0947| \u0938\u094D|\u0930\u0947 |\u0938\u092C\u0939|\u0915\u0930 |\u0906\u092A\u0928|\u0947 \u0913|\u091C\u093E | \u092A\u0930|\u0937\u094D\u091F| \u0930\u093E|\u0928\u093E |\u0939\u0935\u0947| \u0939\u0935|\u0932\u093E |\u0947\u0932\u093E|\u092C\u0939\u093F| \u0913\u0915|\u094B\u0916\u0947|\u0930 \u092C|\u0939\u0964 | \u0939\u0964|\u0928 \u0938|\u093E\u0937\u094D|\u0930\u093E\u0937|\u094D\u0924 | \u0914\u0930|\u0947 \u091A|\u0964 \u0915|\u0938\u0902\u0917|\u0930 \u0906|\u091F\u094D\u0930|\u094D\u091F\u094D|\u0937\u093E |\u092E\u093E\u0928|\u093E \u0906|\u0902 \u0915|\u093E \u092A|\u094D\u0937\u093E|\u0930\u0915\u094D|\u0939\u0947 |\u093E\u0939\u0947|\u093E\u0924\u093F|\u093E\u0935\u0947| \u091C\u0947|\u0939\u0940 |\u0913\u0915\u0930|\u092E\u093F\u0932|\u093F\u0924 |\u094B \u0938|\u0932 \u091C|\u0907\u0916\u0947|\u0928\u0907\u0916| \u0928\u0907|\u0924\u094D\u0930|\u092E\u093E\u091C| \u092C\u093F|\u0935\u0947\u0964|\u0947 \u091C|\u0915 \u0938|\u093F\u0902 |\u0939\u093F\u0902|\u0915\u0930\u093E|\u0914\u0930 |\u0947 \u092E|\u0938\u092E\u093E|\u0939\u0941 | \u0913 |\u092A\u0930 |\u0947 \u0928|\u0938\u094D\u0925|\u0930\u0940\u092F|\u094D\u0930\u0940|\u0932\u093E\u0964|\u093E\u091C |\u093E\u0928 |\u0915\u093E\u0928|\u0947 \u0924|\u093F\u0930 |\u0924\u093F\u0930|\u0916\u093E\u0924| \u0916\u093E|\u0947 \u0909|\u0928\u0942\u0928|\u093E\u0928\u0942|\u093E\u092E | \u0938\u0941| \u0926\u0947|\u0940 \u0915| \u092E\u093E|\u0930 \u092E|\u092A\u094D\u0924|\u093F\u092F\u093E|\u093E\u0939\u0940|\u092C\u093E\u0964|\u092F\u094B\u0917|\u0940 \u0938|\u0932 \u0939|\u0942\u0928 |\u0935\u094D\u092F|\u0941 \u0915|\u090F \u0915|\u0947 \u0935|\u0902\u0924\u094D|\u0938\u094D\u0935|\u0915\u0947\u0939|\u0940\u092F |\u0916\u0932 |\u0938\u093E\u092E|\u092F\u0924\u093E|\u0924\u093F\u0915|\u0947 \u0939|\u093E\u092A\u094D|\u0930\u093E\u092A|\u0930 \u092A|\u0930 \u0905| \u0932\u094B| \u0938\u0939|\u091C\u0947 |\u094B\u0917 |\u092E \u0915|\u0932\u0947 | \u0928\u093F|\u0947\u0915\u0930|\u093E \u0939|\u092A\u0942\u0930|\u0930 \u0928|\u0947\u0939\u0941|\u094D\u092F |\u092F\u093E | \u092F\u093E|\u0926\u0947\u0936|\u0926\u0940 |\u093E \u092E|\u093E\u0935 | \u0926\u094B|\u0947 \u0926| \u092A\u093E|\u0939\u093F |\u093F\u0915\u094D|\u0936\u093F\u0915| \u0936\u093F|\u092C\u093E |\u093F\u0932 | \u0909\u092A|\u094D\u0930\u0924| \u0935\u093F| \u0939\u0940| \u0932\u0947|\u0930\u094B |\u0947 \u0916|\u0920\u0928 |\u0917\u0920\u0928|\u0902\u0917\u0920| \u092E\u093F|\u0937\u0923 |\u094D\u0937\u0923|\u0902\u0930\u0915|\u0938\u0902\u0930| \u0906\u0926| \u090F\u0915|\u0928\u0947 | \u0905\u092A|\u0924\u0902\u0924|\u0935\u0924\u0902|\u094D\u0935\u0924|\u094D\u0924\u0930|\u094D\u092F\u093E|\u0947\u0936 |\u093E\u0926\u0940|\u094D\u0924\u093F|\u091C\u093F\u0915|\u093E\u091C\u093F|\u0915 \u0906|\u094D\u092E |\u091A\u093E\u0930| \u0909\u091A| \u0936\u093E|\u0930\u0940 |\u093E\u0939 |\u092F\u093E\u0939|\u092C\u093F\u092F|\u091A\u093F\u0924|\u0915\u094D\u0924|\u092A\u092F\u094B|\u0909\u092A\u092F|\u0930\u0924\u093E|\u0930 \u0935|\u0928 \u092E|\u0932\u094B\u0917|\u0939 \u0915|\u0928 \u092A|\u0915\u093E\u092E| \u092A\u0942| \u0907 |\u0906\u0926\u093F|\u0908\u0932 | \u0915\u0908| \u0935\u094D|\u092E\u0940 |\u0941\u0930\u0915|\u0938\u0941\u0930| \u091C\u0940|\u0927\u093E\u0930|\u092F \u0938|\u0924\u0930\u094D|\u092D\u0947 |\u0938\u092D\u0947| \u0938\u092D|\u092D\u093E\u0935|\u094D\u0925\u093F|\u093E\u092E\u093E|\u0938\u0930 |\u0930\u094D\u092E| \u0915\u094B| \u092C\u0947|\u094B\u0938\u0930|\u0926\u094B\u0938|\u0923 \u0915|\u093E\u0938 |\u0947 \u092A|\u091C\u093E\u0926|\u0906\u091C\u093E| \u0906\u091C|\u0909\u091A\u093F|\u0917 \u0915|\u093E\u0930\u0940| \u091C\u0930|\u0917\u0947 |\u091C \u0915|\u0940 \u092C|\u0938\u0928 |\u0939\u094B |\u093E \u0924",
      npi: "\u0915\u094B |\u0928\u0947 | \u0930 |\u093E\u0930 |\u0915\u094D\u0924|\u0915\u093E\u0930|\u092A\u094D\u0930| \u092A\u094D|\u094D\u092F\u0915|\u0935\u094D\u092F| \u0917\u0930|\u093F\u0915\u093E| \u0935\u094D|\u094D\u0930\u0924|\u0927\u093F\u0915|\u094D\u0924\u093F|\u092F\u0915\u094D|\u0905\u0927\u093F| \u0905\u0927|\u093E\u0908 |\u092E\u093E |\u0932\u093E\u0908|\u0924\u094D\u092F|\u093F\u0915 | \u0964 | \u0938\u092E|\u0935\u093E | \u0935\u093E|\u0915 \u0935|\u094D\u0928\u0947|\u0930\u094D\u0928|\u0917\u0930\u094D|\u0928\u094D\u0924|\u091B \u0964|\u0924\u093F\u0932|\u0930\u0924\u094D|\u0924\u094D\u0930|\u0947\u0915 |\u092F\u0947\u0915|\u094D\u092F\u0947|\u093F\u0932\u093E|\u0930 \u0938|\u094B \u0938| \u0938\u094D|\u092E\u093E\u0928|\u0915\u094D\u0937| \u0935\u093F|\u0939\u0941\u0928|\u093E \u0938| \u0939\u0941| \u091B |\u0930 \u091B|\u094D\u0924\u094D|\u0938\u092E\u093E|\u0938\u094D\u0935|\u0964 \u092A| \u0938\u0902|\u0928\u0947\u091B|\u0941\u0928\u0947|\u0939\u0930\u0941|\u0924\u0928\u094D|\u0935\u0924\u0928|\u0947 \u0905|\u093F\u0928\u0947|\u094B \u0905|\u094D\u0935\u0924| \u0915\u093E|\u0947 \u091B|\u0917\u0930\u093F| \u0930\u093E|\u094D\u0930 |\u0924\u093F |\u093E\u0915\u094B| \u0915\u0941|\u0937\u094D\u091F|\u0928\u093E |\u0938\u094D\u0924|\u0915 \u0938|\u0941\u0928\u0948|\u0915\u0941\u0928|\u091F\u094D\u0930|\u0932\u0947 | \u0928\u093F|\u093E\u0928 |\u091B\u0948\u0928| \u091B\u0948|\u094D\u091F\u094D|\u093E\u0937\u094D|\u0930\u093E\u0937|\u0924\u093F\u0915|\u091B\u0964 |\u093E\u0930\u094D|\u0924\u093E |\u093F\u0924 |\u0928\u0948 |\u093E \u0905| \u0938\u093E|\u093E \u0935|\u0930\u0941 | \u092E\u093E| \u0905\u0928|\u093E \u0930|\u0930\u0924\u093E|\u0930 \u0930|\u0939\u0930\u0942|\u0947\u091B |\u093E \u092A|\u0930\u0915\u094D|\u094D\u0924 | \u092A\u0930|\u0925\u093E | \u0932\u093E|\u092A\u0930\u093F|\u0926\u0947\u0936|\u0938\u0915\u094B| \u092F\u0938|\u092E\u093E\u091C|\u093E\u092E\u093E|\u094D\u0930\u093E|\u093F\u0935\u093E|\u093E\u0939\u0930|\u094B \u092A|\u094D\u092F |\u0935\u093E\u0930|\u0928 \u0938|\u0964 \u0915|\u0928\u093F |\u094D\u0937\u093E| \u0924\u094D|\u0926\u094D\u0927|\u0930 \u0939|\u0924\u0925\u093E| \u0924\u0925|\u092F\u0938\u094D|\u094D\u092F\u0938|\u0930\u0940 |\u0930 \u0935|\u092A\u0928\u093F|\u0930\u093F\u0928|\u0902\u0930\u0915|\u0938\u0902\u0930|\u092D\u093E\u0935|\u0948 \u0935|\u0938\u092C\u0948| \u0938\u092C| \u0936\u093F| \u0938\u0939|\u0924\u093E\u0915|\u0947 \u0930|\u0924 \u0930|\u0932\u093E\u0917| \u0938\u0941|\u094D\u0937\u0923|\u0926\u094D\u0926| \u0905\u092A|\u0948\u0928 |\u094B \u0935|\u093F\u0915\u094D|\u093E\u0935 |\u0927\u093E\u0930|\u094D\u092F\u093E|\u094D\u0930\u093F|\u093E \u092D|\u090F\u0915\u094B|\u0930 \u092E|\u0928 \u0905|\u094B \u0932| \u0909\u0938|\u0936\u093F\u0915|\u093E\u0924\u094D|\u0938\u094D\u0925|\u0935\u093E\u0939|\u0942\u0930\u094D|\u0936\u094D\u092F|\u093F\u0924\u094D|\u0930\u0915\u094B|\u093E\u0930\u0915|\u0941\u0926\u094D|\u0924\u094B |\u094D\u0924\u094B|\u093E\u0909\u0928|\u0915\u093E\u0928|\u093F\u090F\u0915|\u093E \u0928| \u092A\u0928|\u0928\u0964 |\u0948\u0928\u0964|\u0915\u093E |\u0947\u091B\u0964| \u092D\u0947|\u0930\u094D\u092F|\u0938\u092E\u094D|\u0924\u094D\u092A|\u0938\u093E\u092E|\u0930\u093F\u092F|\u091A\u093E\u0930|\u0928\u093F\u091C|\u0941\u0928 |\u0917\u093F |\u093E\u0917\u093F|\u0909\u0938\u0915| \u092E\u0924| \u0905\u092D|\u092A\u0942\u0930|\u0930 \u0924| \u0938\u0915|\u0938\u093E\u0930|\u0930\u093E\u0927|\u092A\u0930\u093E|\u0905\u092A\u0930|\u0941\u0915\u094D|\u091C\u0915\u094B| \u0909\u092A|\u0930\u093E |\u093E\u0930\u093E|\u094D\u0935\u093E|\u0935\u093F\u0927|\u094D\u0928 |\u093E \u0924|\u0928 \u0917|\u0923\u0915\u094B| \u092A\u093E| \u0926\u093F|\u0915 \u0930|\u0930 \u092A|\u0905\u0928\u094D|\u092D\u0947\u0926|\u093E\u0930\u092E|\u094B \u0906| \u0905\u0930|\u091C\u093F\u0915|\u093E\u091C\u093F|\u093F\u092F |\u0937\u093E |\u093E\u091F |\u092C\u093E\u091F| \u092C\u093E|\u093F \u0930| \u091B\u0964|\u0924\u094D\u0935|\u0924 \u0938|\u0930\u0942 |\u091B \u0930|\u0930\u0915\u093E|\u0935\u093F\u0915|\u0930 \u0909|\u094B\u0917 |\u094D\u0926\u0947|\u0930\u093F\u0935|\u0938\u0915\u093F|\u0948 \u092A|\u0930\u0924\u093F|\u0905\u0928\u0941| \u0906\u0935|\u092F\u0941\u0915|\u093E \u0917|\u0928\u092E\u093E|\u092F\u094B\u0917|\u0917 \u0917|\u0915 \u0905|\u0926\u094D\u0935|\u094D\u0927 |\u0930\u0941\u0926| \u092C\u093F|\u0964 \u0938|\u0909\u0928\u0947|\u093E\u0928\u094D|\u093E \u092E|\u093F\u0915\u094B|\u0930\u094D\u0926|\u093E\u0930\u0940|\u094D\u0924\u0930|\u094B \u0939|\u0939\u093F\u0924| \u0926\u0947|\u0930\u093F\u0915|\u093E \u0915| \u0906\u0927|\u0930\u093E\u091C|\u0930\u094D\u092E|\u094D\u0923 |\u0930\u094D\u0923|\u093F \u0935|\u094D\u092F\u0935|\u0935\u093F\u091A|\u092C\u0948 |\u0938\u0939\u093F|\u0930\u094B\u091C|\u0930\u094D\u0938|\u0908 \u0909|\u094D\u092A |\u0930\u093E\u0924|\u0928\u093F\u0915|\u092E\u093F\u0915|\u091A\u094D\u091B|\u094D\u0925\u093E|\u0935\u093F\u0935|\u0915\u0924\u093E|\u0905\u092D\u093F|\u094D\u0927\u093E",
      mag: " \u0915\u0947|\u0915\u0947 |\u093E\u0930 | \u0939\u0908|\u0915\u093E\u0930|\u0908\u0964 |\u0939\u0908\u0964|\u093F\u0915\u093E|\u0947 \u0905|\u0927\u093F\u0915|\u0905\u0927\u093F| \u0905\u0927|\u0930 \u0939|\u0947 \u0915|\u0914\u0930 | \u0914\u0930|\u093E \u0915|\u0947 \u0938|\u0938\u092C | \u0938\u092C| \u0915\u0930|\u0947\u0902 |\u0925\u093E |\u092E\u0947\u0902| \u092E\u0947|\u0924\u0925\u093E| \u0924\u0925|\u093F\u0915 | \u0939\u094B| \u0938\u092E|\u0915\u094D\u0937|\u0928\u093E |\u092C \u0915|\u0930 \u0938| \u0938\u0902|\u093E \u0938|\u0915\u0930 | \u092D\u0940|\u0964 \u0938| \u0938\u093E| \u0938\u0947| \u0915\u093E| \u0905\u092A|\u094D\u0930\u093E|\u092A\u094D\u0930| \u092A\u094D|\u0938\u0947 |\u092D\u0940 | \u0915\u094B|\u0924 \u0915| \u092A\u0930|\u0930\u093E |\u0915 \u0939|\u092A\u0928 |\u0905\u092A\u0928| \u0938\u0915|\u092F\u093E |\u0924\u093F |\u0930 \u0915|\u0940 \u0915| \u092F\u093E|\u0915\u0930\u0947| \u091C\u093E|\u0930\u0947 | \u0913\u0915|\u094D\u0924 |\u0938\u0915 |\u0928\u094B |\u093E\u0928 |\u092E\u093E\u0928|\u0913\u0915\u0930|\u093E \u092A|\u0928 \u0915|\u0947\u0932 | \u0928\u093E|\u0964 \u0915|\u0930\u0915\u094D| \u0938\u094D|\u0939\u0940 |\u0939\u094B\u090F| \u090F\u0915|\u092A\u0930 |\u0926\u0940 |\u091F\u094D\u0930|\u0924\u093E |\u0935\u094D\u092F|\u0939\u0908 | \u0936\u093E|\u0947 \u0909| \u0926\u0947|\u0924\u094D\u0930|\u093E\u0926\u0940| \u0930\u093E| \u0939\u0940|\u0915\u093E\u0928|\u093F\u0924 |\u092E \u0915|\u0932 \u091C|\u093E\u092E |\u0940 \u0938|\u0947 \u092D|\u0928 \u0938|\u092E\u093E\u091C|\u0937\u094D\u091F|\u0937\u093E | \u0932\u0947|\u0915 \u0938|\u092C\u0947 |\u0935\u0947 |\u093E\u0935\u0947|\u092E\u093F\u0932|\u0930 \u092E|\u094D\u092F |\u093E \u0939|\u0932\u093E |\u092A\u094D\u0924|\u0928\u0942\u0928|\u093E\u0928\u0942|\u091C\u093E |\u0947\u0915\u0930|\u094D\u0937\u093E|\u094D\u0930\u0924|\u0902\u0924\u094D|\u0930 \u0914|\u094B\u0908 |\u0915\u094B\u0908|\u094D\u091F\u094D|\u093E\u0937\u094D|\u0930\u093E\u0937| \u092E\u093E|\u0930\u094B | \u091C\u0947|\u0915\u0930\u093E|\u094B\u090F |\u093E\u092A\u094D|\u0930\u093E\u092A|\u0938\u092E\u093E|\u0942\u0928 |\u094B \u0938|\u0938\u094D\u0935|\u094D\u0924\u093F|\u0938\u093E\u092E|\u094B\u0928\u094B|\u0915\u094B\u0928| \u0935\u094D|\u0930 \u0905|\u094D\u092E | \u0935\u093F| \u0938\u0939|\u0947 \u092E|\u0915\u094D\u0924|\u092F\u094B\u0917|\u0930 \u0935|\u0915\u093E\u092E|\u0932 \u0939| \u0928\u093F|\u0926\u0947\u0936|\u092A\u0942\u0930|\u0935\u093E\u0930| \u0907 |\u0902\u0930\u0915|\u0938\u0902\u0930|\u090F \u0915|\u0930 \u092A| \u0938\u0941|\u0924\u0902\u0924|\u0935\u0924\u0902|\u094D\u0935\u0924|\u093E \u092E|\u0935 \u0915|\u0947 \u0935|\u093E\u0925 |\u0938\u093E\u0925| \u0926\u094B|\u0939\u094B\u092C| \u092A\u093E|\u094B \u0915|\u0947 \u092C|\u094B\u0917 | \u0909\u092A|\u0938\u094D\u0924|\u092A\u0930\u093F|\u0928 \u092A|\u0947 \u0924|\u094D\u0924\u0930|\u0932\u0947\u0932|\u0947 \u0913|\u091A\u093E\u0939| \u091A\u093E|\u092F \u0915|\u0935\u093E |\u0947\u0936 |\u092F \u0938|\u0928 \u0939|\u0937\u0923 |\u093E \u092C|\u0964 \u0924|\u090F\u0915 |\u090F\u0932 |\u0940\u092F |\u0915\u0947\u0915|\u0947 \u0939|\u0930 \u0906|\u093F \u0915|\u0938\u094D\u0925|\u091C\u093F\u0915|\u093E\u091C\u093F|\u093E\u092E\u093E|\u0930\u0940\u092F|\u094D\u0930\u0940|\u0924\u093F\u0915|\u093E\u0924\u093F| \u092C\u093F|\u091A\u093E\u0930|\u0947 \u0906|\u093E\u0938 | \u0909\u091A|\u093E \u0924|\u092F\u0915\u094D|\u094D\u092F\u0915|\u093F\u0932 |\u092E\u092F |\u0938\u092E\u092F|\u0936\u093E\u0926|\u092A\u092F\u094B|\u0909\u092A\u092F|\u0947 \u0916|\u0930\u093F\u0935| \u092A\u0942|\u0947 \u0932|\u0947 \u091A|\u094C\u0928\u094B|\u0915\u094C\u0928| \u0915\u094C|\u0902 \u0915|\u0938\u0902\u0917|\u0928 \u0926|\u0902 \u0938|\u0923 \u092A|\u094D\u0937\u0923|\u0930 \u0928|\u0947 \u0928|\u094B \u092D|\u0915\u0930\u094B|\u093E \u0914|\u0930\u0924\u093E|\u093E\u0935 |\u092D\u093E\u0935|\u0915 \u0914|\u0930\u094D\u092E|\u094B\u0938\u0930|\u0926\u094B\u0938|\u0923 \u0915|\u0947 \u092A|\u0928 \u0914|\u092C \u0939|\u093F\u0915\u094D|\u0936\u093F\u0915| \u0936\u093F|\u093E\u092C\u0947|\u0928\u093F\u092F|\u091A\u093F\u0924|\u0909\u091A\u093F|\u093F\u0924\u094D|\u0917 \u0915|\u0947\u0964 |\u0924 \u0938|\u0940 \u0936|\u0902 \u0936|\u090F\u0915\u0930|\u0964 \u090F|\u0924\u0928 | \u0913 |\u0930\u0940 |\u094D\u0930 |\u091C\u0947 |\u0915 \u0915| \u0938\u0940|\u0938\u0928 |\u093F\u0935\u093E| \u0905\u0928|\u0942\u0930\u093E| \u092C\u091A|\u090F\u0964 | \u092C\u0947|\u0924 \u0939| \u0924\u0915| \u092E\u093F|\u0927\u093E\u0930|\u0925\u0935\u093E|\u0905\u0925\u0935| \u0905\u0925|\u093F\u0932\u093E|\u094D\u0935\u093E|\u093F \u092E| \u0906\u0926|\u0928\u0947 |\u0915\u090F\u0932| \u0915\u090F|\u094D\u092F\u093E"
    },
    Myanmar: {
      mya: "\u1004\u1037\u103A|\u1004\u103A\u1038|\u102D\u102F\u1004|\u102F\u1004\u103A|\u101E\u100A\u103A|\u1037\u103A |\u103D\u1004\u1037|\u1001\u103D\u1004|\u1000\u102D\u102F|\u100A\u103A\u1038|\u1031\u102C\u1004|\u101E\u1031\u102C|\u102C\u1004\u103A|\u103C\u1005\u103A|\u1010\u102D\u102F|\u1014\u102D\u102F|\u103A\u1038\u1000|\u102D\u102F |\u1004\u103A | \u1021\u1001|\u103C\u1004\u103A|\u1016\u103C\u1005|\u101C\u100A\u103A| \u101C\u1030|\u103A \u1021|\u101B\u103E\u102D|\u103B\u102C\u1038|\u1019\u103B\u102C|\u103A\u1001\u103D|\u103A\u104B |\u100A\u103A\u104B|\u1000\u1031\u102C|\u1038\u1000\u1031|\u1014\u103E\u1004|\u103E\u1004\u1037|\u102D\u102F\u1037|\u101B\u1031\u1038|\u103A\u1038 |\u1004\u103A\u1001|\u1038\u104A |\u103A \u101C|\u1031\u102C |\u1001\u103C\u1004|\u103D\u1004\u103A|\u1019\u103E\u102F|\u103A\u1005\u1031|\u1010\u103D\u1004|\u103A\u1038\u104A|\u103E\u102D\u101E|\u1031\u102C\u1000|\u102D\u101E\u100A|\u1038\u1000\u102D|\u100A\u103A\u1037|\u1031\u102C\u103A|\u102C\u1000\u103A|\u1010\u103A\u101C|\u1005\u103A\u1005|\u101C\u1015\u103A|\u103D\u1010\u103A|\u101C\u103D\u1010| \u1019\u102D|\u101C\u1030\u1010|\u103A\u101C\u1015|\u1030\u1010\u102D|\u103A\u101C\u100A|\u103A\u1038\u1019| \u1016\u103C|\u1005\u103D\u102C| \u101C\u103D|\u1004\u103A\u101B|\u103D\u102C |\u102F\u1015\u103A|\u103A\u104A |\u103A\u1037 |\u1011\u102D\u102F|\u103A\u101E\u1031|\u1038\u1010\u103D|\u104B \u101C|\u103C\u102C\u1038|\u1021\u101B\u1031|\u1037\u103A\u1021|\u1021\u1001\u103D|\u102D\u1019\u102D|\u103D\u1000\u103A|\u102C\u103A\u101C|\u1031\u104A |\u102C\u1038 |\u1019\u100A\u103A| \u101E\u1031|\u1000\u103A |\u102D\u102F\u1038|\u103A\u101B\u103E|\u100A\u103A |\u1019\u102D\u1019|\u103A\u1005\u103D|\u1005\u1031\u104A|\u1037\u103A\u101B| \u1011\u102D|\u103A\u1021\u101B|\u103C\u1004\u1037|\u1014\u103A |\u1038\u1014\u103E|\u103A\u1038\u1010|\u1019\u103A\u1038|\u1016\u103C\u1004|\u103A \u1019|\u1021\u102C\u1038|\u103A\u101E\u100A| \u1015\u103C|\u1014\u103A\u1038|\u1021\u1001\u103C|\u103A\u1004\u1036|\u1004\u103A\u1004|\u1015\u102D\u102F|\u102C \u1021|\u103A\u1019\u103E|\u1015\u103A\u1005|\u101B\u1014\u103A| \u1014\u102D|\u1006\u102D\u102F|\u1038\u1019\u103B|\u102C\u1038\u1000| \u101B\u103E|\u1005\u1031\u101B|\u103D\u101A\u103A|\u1038\u101E\u100A|\u101C\u102F\u1015|\u103A \u1015|\u1010\u1005\u103A|\u104A \u1021|\u1038 \u1021|\u103A \u1016|\u102F\u1036\u1038|\u1001\u103C\u102C|\u101D\u1004\u103A|\u101B\u1019\u100A|\u103A \u101B|\u103C\u100A\u103A|\u102F\u1010\u103A|\u101E\u102D\u102F|\u1038\u1001\u103C|\u1038\u1016\u103C|\u1038\u1019\u103E|\u1021\u1015\u103C|\u103A\u1001\u103C|\u1005\u102C\u1038| \u101C\u100A|\u103A\u1038\u101E|\u103A\u1014\u102D|\u1021\u1010\u103D|\u1015\u103C\u102F|\u1015\u103C\u100A|\u103A\u1038\u1015|\u1001\u1036\u1005| \u1001\u1036|\u1038 \u1019|\u1031\u1038\u1019|\u1015\u103C\u1004|\u1004\u103A\u101E|\u101F\u102F\u1010|\u1019\u101F\u102F|\u1015\u103A\u1001|\u1037 \u1021|\u102C\u1038\u101E|\u1000\u103C\u1031|\u1010\u103A |\u1000\u103A\u1019|\u1010\u103D\u1000|\u102C\u1038\u1014|\u1015\u1012\u1031|\u1025\u1015\u1012|\u102F \u1021|\u101E\u102C\u1038|\u103A \u101E|\u103A\u1038\u1001|\u104A \u1019|\u1015\u100A\u102C|\u102D\u102F\u1000|\u1019\u103E |\u1019\u103B\u103E|\u100A\u103A\u101E|\u103C\u1031\u102C|\u101B\u104B |\u1005\u100A\u103A|\u103A\u1016\u103C|\u1010\u100A\u103A|\u103B\u1000\u103A|\u1000\u103D\u101A| \u1021\u102C|\u1031\u1038 | \u101E\u102D|\u102C\u1038\u1016| \u1021\u101C|\u103A\u1019\u103B|\u101E\u1004\u103A|\u103D\u1032\u1037|\u1016\u103D\u1032|\u101B\u102C\u1038|\u1010\u101B\u102C|\u103A\u1000\u102D| \u1025\u1015|\u1031\u1038\u1001|\u1015\u103C\u1005|\u1010\u103A\u1001|\u103A\u101B\u1014|\u1000\u103A\u101E|\u103A\u1001\u103B|\u102F\u1037\u1010|\u104A \u101C|\u102C\u1038\u101C|\u103A\u101B\u103D|\u1019\u102D\u104F|\u102F \u101E|\u102F\u1000\u103A|\u101E\u1000\u103A| \u1021\u1000|\u102C\u1038\u101B|\u1001\u103C\u1031|\u103A \u1014|\u103A\u1019\u103C|\u1005\u103A\u1019|\u103A\u1038\u1014|\u104A \u1014| \u1000\u102D|\u104A \u101E|\u103B\u102D\u102F|\u101C\u1030\u1019|\u1038\u1001\u103B|\u103A\u1014\u103E|\u1030\u1019\u103B|\u1030\u100A\u102E|\u1010\u1030\u100A| \u1010\u1030|\u101C\u102D\u102F|\u102C\u1038\u1005| \u1021\u1010|\u1038\u101E\u1031|\u1006\u1031\u102C|\u1004\u103A\u104A|\u1012\u1031\u1021|\u1015\u1031\u1038|\u103E\u102F |\u102C \u101C|\u103A\u101E\u1030|\u103E\u1031\u102C|\u102D\u1019\u103A|\u102C\u1038\u1001|\u1036\u1005\u102C|\u103A \u1001|\u103B\u1004\u103A|\u103D\u1031\u1038|\u1021\u101C\u102F|\u102B\u101D\u1004|\u1015\u102B\u101D| \u1014\u103E|\u102C\u1038\u1010|\u1015\u103A |\u1038 \u1014|\u1038\u1005\u103D|\u102F \u101C|\u1031\u1021\u101B| \u1021\u1015|\u102C\u1038\u1019|\u103A\u101B\u1031|\u102C \u101E|\u1031\u1038\u1000|\u104B \u1019| \u101C\u102F|\u103A \u1011|\u103A\u101B\u102C|\u1031\u101B\u104B| \u1021\u1006|\u1038\u1019\u101F|\u1037\u1010\u100A|\u104A \u1000|\u1011\u102C\u1038|\u103A \u1000|\u102D\u102F\u101E|\u1015\u103A\u101E|\u103A \u1010| \u1015\u102B|\u1021\u1016\u103D|\u101B\u103D\u1000|\u1021\u1001\u102B|\u1031\u1038\u101B|\u103A \u1005|\u1001\u1036\u101B|\u104F \u1021|\u1000\u103A\u1001|\u103A\u1038\u1021|\u1038\u1021\u1016|\u1021\u1016\u103C|\u103D\u1014\u103A|\u103B\u103E |\u102F\u1019\u103B|\u103E\u1004\u103A|\u102F\u101A\u103A|\u102D\u102F\u101A|\u102C\u1004\u1037| \u1010\u102D",
      shn: "\u1004\u103A\u1088|\u107C\u103A\u1038|\u101C\u1086\u1088|\u1004\u103A\u1038|\u103A\u1038 |\u1030\u107C\u103A|\u102F\u107C\u103A|\u107C\u103A\u1089|\u1030\u1004\u103A|\u101D\u103A\u1038|\u103D\u1004\u103A|\u107C\u107C\u103A|\u102D\u1030\u1004|\u103A\u1087\u101C|\u1019\u103A\u1087|\u1030\u101D\u103A|\u103A\u1088\u101C|\u107C\u103A\u1087|\u1087\u101C\u1086|\u103A\u1038\u1075|\u1010\u1083\u1087|\u1019\u102D\u1030|\u1022\u1019\u103A|\u1075\u1030\u107C|\u1019\u102E\u1038|\u1010\u103A\u1088|\u1010\u103A\u1038|\u101E\u102F\u107C|\u101D\u103A\u1088|\u101C\u103D\u1004|\u101C\u1084\u1088|\u1004\u103A\u1087|\u102F\u1004\u103A|\u107C\u1086\u1089|\u1062\u1004\u103A|\u1022\u107C\u103A|\u1075\u1031\u1083|\u103A\u1088 | \u101C\u103D|\u1086\u1089 |\u1088 \u1010|\u102D\u1030\u101D|\u1019\u103A\u1038|\u1086\u1088 | \u1010\u1083|\u1084\u1088 |\u107C\u103A |\u103D\u1010\u103A|\u103A\u1038\u107C| \u1075\u1030|\u102D\u102F\u1004|\u1038\u101E\u102F|\u101A\u1030\u1087|\u103A\u1038\u101C|\u1062\u107C\u103A|\u1035\u107C\u103A|\u102E\u1038\u101E|\u1075\u103A\u1038|\u1085\u101D\u103A|\u101C\u1085\u101D|\u101C\u103D\u1010|\u102F\u1075\u103A| \u1019\u102E|\u1031\u1083\u1089| \u1022\u107C|\u1075\u103A\u1087| \u101C\u1084|\u1035\u1004\u103A|\u1088 \u101C|\u1075\u107C\u103A|\u103A\u1088\u1075|\u1015\u102D\u1030|\u1075\u1030\u108A|\u103A\u1038\u1015|\u103D\u107C\u103A|\u103A\u1038\u1010|\u103A\u1088\u1010|\u1083\u1089\u107C|\u103A\u1089 |\u103A\u1088\u1019|\u104B \u1075|\u103A\u1038\u101E|\u1087\u104B | \u1010\u1031|\u1078\u1082\u103A|\u103A\u1038\u1019|\u1030\u1087\u104B|\u1075\u103A\u1088|\u101E\u1031 |\u103A\u1087 |\u1089\u107C\u1086|\u108A\u1075\u1031|\u1030\u108A\u1075|\u1038\u1075\u1030|\u1089 \u1019|\u1088\u101C\u1085|\u103A\u1088\u1015|\u103A\u1087\u107C|\u1015\u1035\u107C|\u1010\u102E\u1088|\u1088\u1019\u102D|\u1075\u1062\u107C|\u1031\u1022\u1019|\u101D\u103A\u1087|\u102D\u102F\u107C|\u1076\u101D\u103A|\u1035\u1010\u103A|\u1081\u1035\u1010|\u101C\u1082\u103A|\u102F\u1019\u103A|\u1038\u107C\u107C|\u1078\u102D\u102F|\u102D\u1004\u103A|\u1082\u103A\u1088|\u107C\u103A\u1088|\u1015\u103A\u1089|\u1019\u103A\u1088|\u102D\u1030\u107C|\u1062\u1086\u1038|\u103A\u104A |\u103A\u1038\u1076|\u1088\u101C\u103D|\u1004\u103A |\u103A \u101C|\u103A\u1087\u1019|\u103A\u1038\u1078|\u103A\u1038\u101A|\u1083\u1088 |\u1010\u1004\u103A|\u1010\u1031\u1083|\u102F\u101D\u103A|\u102D\u102F\u101D|\u107C\u103A\u101C|\u103A\u1087\u1075|\u1015\u107C\u103A|\u1038 \u101C|\u103A\u1089\u101C|\u107E\u102D\u1004|\u103A\u1087\u1015|\u1010\u103A\u1087|\u1038\u1015\u102D|\u1081\u1082\u103A|\u1019\u107C\u103A|\u1083\u1087 |\u1031\u1083\u1088|\u107C\u1083\u1088|\u103A\u107C\u107C|\u103A\u1038\u1081|\u1088\u1010\u1083|\u1011\u102F\u1075|\u103A\u1088\u107C| \u1022\u1019|\u103A\u1089\u1010|\u103A\u1088\u1081|\u1010\u1062\u1004|\u1010\u1031\u1022|\u1031\u1083\u1087|\u1030\u107A\u103A|\u107C\u103A\u1075|\u1075\u101D\u103A|\u1089 \u1010|\u1087\u107C\u107C|\u1038\u1019\u102D|\u1062\u1019\u103A|\u1062\u1086\u1087|\u1038 \u1022|\u1015\u1062\u1086|\u103A\u1088\u1078|\u1088 \u1022|\u1083\u1087\u1076|\u1086\u1088\u1010|\u103D\u1019\u103A|\u1031\u101C\u1086|\u1010\u1031\u101C|\u1030\u1019\u103A|\u103A\u1088\u1022|\u1062\u101D\u103A|\u107C\u103A\u1015|\u101E\u1062\u1004|\u107C\u103A\u107C|\u103A\u1088\u101A|\u101C\u102D\u1030|\u101D\u103A |\u103A\u101E\u1031|\u107D\u1035\u1004|\u107C\u103A\u1022|\u1078\u103D\u1019|\u1015\u103A\u1038|\u1088\u101C\u1086|\u1022\u101D\u103A|\u101E\u1004\u103A|\u1089\u101A\u1030|\u103A\u1089\u101A|\u103A\u1089\u1075|\u103A\u1038\u1022| \u1019\u102D|\u103A \u1022|\u1011\u102D\u102F|\u1076\u103D\u1004|\u107C\u103A\u1010|\u107E\u1062\u1086|\u1081\u1015\u103A|\u1082\u103A\u1038|\u107C\u1082\u103A|\u103A\u1089\u1081|\u107A\u103A\u1088|\u1038\u101C\u1085|\u1038\u101E\u1031|\u103A\u1087\u1076|\u107C\u1004\u103A|\u1082\u103A\u1089|\u103A\u1087\u107D|\u1015\u102D\u102F|\u103D\u1075\u103A|\u107C\u103A\u1019|\u103A\u107C\u1086|\u1015\u1035\u1004|\u101C\u1030\u107A| \u1015\u102D|\u1030\u1015\u103A|\u101C\u102F\u1075|\u1087 \u101C|\u1088\u101E\u1004|\u1010\u1030\u101D|\u1088 \u1015|\u1085\u1004\u103A|\u103A \u1010|\u1081\u1030\u1019|\u103A\u1087\u1081|\u1083\u1087\u101C|\u1087\u1076\u101D| \u107E\u1062|\u103A\u1087\u1078|\u103A\u1087\u1010|\u1038\u101C\u103D|\u1086\u1088\u1019|\u107C\u103A\u107D|\u1083\u1087\u1075|\u1010\u102D\u102F|\u1038\u101E\u1062|\u101D\u103A\u107C|\u1087\u1015\u1035|\u1030\u1075\u103A|\u1075\u103A\u1089|\u1084\u1088\u101E|\u101A\u1035\u107C|\u1088\u1011\u102F|\u1086\u1088\u1011|\u1038\u1075\u1062|\u1015\u1075\u103A|\u1086\u1088\u1015|\u1085\u1010\u103A|\u1089 \u101C|\u107D\u1030\u1088|\u101D\u1083\u1088|\u103A\u1075\u1030|\u1004\u103A\u1078|\u1089\u104B |\u1038\u107C\u1086|\u1088 \u1019|\u1088\u1019\u102E|\u1081\u107C\u103A|\u1038\u1010\u1031|\u107C\u103A\u101E|\u101D\u1086\u1089| \u101E\u102F|\u1030\u1010\u103A|\u1075\u102D\u1030|\u103A\u1022\u107C|\u1019\u103A\u1089|\u1078\u102F\u1019| \u1010\u102E|\u1083\u1087\u1081|\u1089\u107C\u107C|\u107A\u103A\u1038|\u103A\u1089\u101E|\u1038\u1075\u1031|\u103A\u1078\u102D|\u101D\u103A\u1089|\u104A \u101C|\u107C\u103A\u108A|\u1038\u104A |\u102D\u1075\u103A| \u107C\u1082|\u1089\u1081\u107C|\u102D\u1010\u103A|\u1087\u1075\u107C|\u103A\u104B |\u1083\u1087\u1078|\u1004\u103A\u101E|\u104B \u1015|\u101E\u103D\u107C|\u1075\u1010\u103A|\u1078\u101D\u103A|\u103A\u1078\u1082|\u1004\u103A\u1015|\u1082\u103A\u104A|\u1085\u107C\u103A|\u101E\u1031\u1022|\u103A\u1022\u1019"
    },
    Ethiopic: {
      amh: "\u1361\u1218\u1265|\u1230\u12CD\u1361|\u1275\u1361\u12A0|\u1265\u1275\u1361|\u1361\u1230\u12CD|\u1218\u1265\u1275|\u1361\u12A0\u1208|\u12ED\u121D\u1361|\u12C8\u12ED\u121D|\u1361\u12C8\u12ED|\u1290\u1275\u1361|\u1208\u12CD\u1362|\u12A0\u1208\u12CD|\u1295\u12F1\u1361|\u12F3\u1295\u12F1|\u1295\u12F3\u1295|\u12EB\u1295\u12F3|\u12A5\u12EB\u1295|\u12F1\u1361\u1230|\u1361\u12A5\u1295|\u1275\u1361\u1218|\u12CD\u1362 | \u12A5\u12EB|\u1361\u12E8\u1218|\u1362 \u12A5|\u12A5\u1295\u12F2|\u1361\u1290\u133B|\u1361\u12E8\u1270|\u121D\u1361\u1260|\u12CD\u1361\u12E8|\u121D\u1361\u12E8|\u1361\u12E8\u121A|\u1295\u1361\u12E8|\u1293\u1361\u1260|\u1293\u1361\u12E8|\u1361\u12A0\u12ED|\u1361\u12E8\u121B|\u1290\u133B\u1290|\u12CD\u1361\u1260|\u1206\u1290\u1361|\u1276\u127D\u1361|\u1275\u1361\u12E8|\u12CD\u1362\u1361|\u1361\u1260\u121A|\u1275\u1293\u1361|\u1280\u1265\u1228|\u1361\u1218\u1295|\u1275\u1295\u1361|\u12CD\u121D\u1361|\u1265\u127B\u1361|\u1361\u1208\u1218|\u121D\u1361\u1230|\u121D\u1362 |\u129B\u12CD\u121D|\u1295\u129B\u12CD|\u121B\u1295\u129B|\u1295\u121D\u1361|\u1361\u12A0\u1308|\u1218\u1265\u1276|\u1361\u12EB\u1208|\u12A5\u12A9\u120D|\u1228\u1275\u1361|\u1218\u1295\u130D|\u1361\u1208\u121B|\u1275\u1361\u1260|\u1206\u1295\u1361|\u1260\u1275\u1361|\u1361\u1260\u1270|\u1208\u1275\u1361|\u1361\u12A5\u12A9|\u130B\u1265\u127B|\u12CE\u127D\u1361|\u12C8\u1295\u1300|\u1205\u1295\u1290|\u12F0\u1205\u1295|\u12A9\u120D\u1361|\u121B\u1295\u121D| \u121B\u1295|\u1362 \u121B|\u1320\u1260\u1245|\u133B\u1290\u1275|\u1265\u1276\u127D|\u1361\u120D\u12E9|\u122B\u12CA\u1361|\u1230\u1265\u1361|\u121D\u1361\u12A5|\u130D\u1298\u1275|\u121B\u130D\u1298|\u127D\u1361\u1260|\u1225\u122B\u1361|\u1290\u133B\u1361|\u122D\u12F5\u1361|\u134D\u122D\u12F5|\u1361\u1260\u1206|\u1361\u12F5\u122D|\u120D\u1361\u1218|\u1361\u12F0\u1205|\u1270\u130D\u1263|\u1361\u12E8\u1206|\u1275\u1361\u12C8|\u1260\u1275\u121D|\u1348\u1338\u121D|\u122D\u1361\u12C8|\u12ED\u1290\u1275|\u1275\u121D\u1361|\u1361\u1260\u1218|\u1361\u1201\u1209|\u1278\u12CD\u1361|\u1298\u1275\u1361|\u121B\u1280\u1260|\u12E8\u121B\u130D|\u1260\u122D\u1361|\u121D\u1361\u1218|\u1260\u1280\u1265|\u1361\u1260\u1280|\u127D\u1293\u1361|\u1361\u1291\u122E|\u1361\u1225\u122B|\u1361\u130A\u12DC|\u1361\u12C8\u1295|\u1218\u1220\u1228|\u1361\u1218\u1220|\u1271\u1295\u1361|\u1215\u130D\u1361|\u1263\u122D\u1361|\u130D\u1263\u122D|\u1290\u1275\u1293|\u1290\u1276\u127D|\u133B\u1290\u1276|\u1295\u1293\u1361|\u12E9\u1290\u1275|\u120D\u12E9\u1290|\u12F0\u1228\u1303|\u1361\u12F0\u1228|\u1265\u1361\u12E8|\u12D3\u12ED\u1290|\u1361\u12D3\u12ED|\u12ED\u121B\u1296|\u1203\u12ED\u121B|\u120D\u1362 |\u1290\u12CD\u1362|\u1361\u1290\u12CD|\u1201\u1209\u1361|\u122D\u1275\u1361|\u1205\u122D\u1275|\u121D\u1205\u122D|\u1275\u121D\u1205|\u1295\u1290\u1275|\u1293\u1361\u1208|\u1260\u1275\u1362|\u1208\u1260\u1275|\u12A0\u1208\u1260|\u1218\u1206\u1295|\u1295\u1361\u12A0|\u1295\u1361\u12C8|\u1361\u1218\u1230|\u1265\u1228\u1361|\u1361\u1265\u127B|\u1361\u12A0\u120B|\u122D\u1305\u1275|\u12F5\u122D\u1305|\u1295\u130D\u1225|\u1270\u1263\u1260|\u120E\u127D\u1361|\u120C\u120E\u127D|\u12E8\u121A\u12EB|\u1264\u1270\u1230|\u12A5\u1295\u12F0|\u1275\u1361\u12F5|\u1361\u1218\u1206|\u127D\u1361\u12E8|\u1275\u12AD\u12AD|\u1361\u121B\u1295|\u1260\u1206\u1290|\u1206\u1291\u1361|\u1295\u1361\u1218|\u1362\u1361 |\u1275\u1361\u1208|\u1228\u130D\u1361|\u1361\u12ED\u1205|\u12F2\u1320\u1260|\u1295\u12F2\u1320|\u1275\u1361\u12A5|\u1290\u1271\u1361|\u1361\u1260\u1215|\u12E8\u1206\u1290|\u1338\u121D\u1361|\u1260\u1245\u1361|\u12E8\u1218\u1296|\u1275\u121D\u1362|\u1308\u122D\u1361|\u1361\u12A8\u121A|\u12CD\u1361\u12A8|\u1229\u1275\u1361|\u12E8\u1280\u1265|\u1361\u12E8\u1280|\u1214\u122B\u12CA|\u1265\u1214\u122B|\u1361\u12A0\u1235|\u122D\u1361\u12E8|\u12ED\u1308\u1263|\u12CD\u1295\u1361|\u1325\u1361\u12E8|\u1295\u1235\u1361|\u1361\u1275\u121D|\u1291\u122E\u1361|\u1295\u1361\u1208|\u127D\u1361\u12A5|\u1201\u1294\u1273|\u1361\u1201\u1294|\u1235\u1275\u1361|\u1361\u1260\u12A0|\u1361\u121B\u1280|\u1265\u1228\u1230|\u1218\u1230\u1228|\u1228\u1361\u1230|\u12E8\u121A\u1348|\u120B\u1278\u12CD|\u12A0\u120B\u1278|\u1218\u1348\u1338|\u1361\u130B\u1265|\u122D\u1361\u1260|\u12DC\u130D\u1290|\u127D\u1295\u1361|\u1305\u1275\u1361|\u12E8\u1270\u1263|\u1290\u1275\u1295|\u12DA\u1205\u1361|\u1265\u1290\u1275|\u1308\u1265\u1290|\u1361\u1308\u1265|\u1235\u1325\u1361|\u12CD\u1235\u1325|\u1361\u12CD\u1235|\u1230\u1261\u1361|\u1218\u12CD\u1361|\u1348\u1338\u1218|\u130A\u12DC\u1361|\u1275\u1361\u130A|\u1206\u1296\u1361|\u1361\u1206\u1296|\u1348\u120B\u130A|\u12CD\u1361\u1208|\u1219\u1209\u1361|\u12AD\u1208\u129B|\u12AD\u12AD\u1208|\u1300\u120D\u1361|\u1295\u1300\u120D|\u1201\u121D\u1361|\u12F2\u1201\u121D|\u1295\u12F2\u1201|\u1361\u1260\u130D|\u12CD\u1361\u12EB|\u1273\u12CA\u1361|\u1228\u1273\u12CA|\u1295\u130D\u1235|\u1361 \u12A5|\u12F0\u1228\u130D|\u1362\u1361\u12ED|\u1290\u1361\u1218|\u1290\u1271\u1295|\u1295\u1290\u1271|\u1209\u1361\u1260|\u1260\u1215\u130D|\u1361\u1270\u130D|\u12D3\u12CA\u1361|\u1265\u12D3\u12CA|\u1230\u1265\u12D3|\u121D\u1361\u12A8|\u1245\u1361\u1218|\u1218\u1320\u1260|\u1361\u1218\u1320|\u1260\u1290\u133B|\u1361\u1260\u1290|\u1218\u1296\u122D|\u121D\u1260\u1275|\u12A0\u12ED\u1348|\u121D\u1361\u12D3|\u1361\u1260\u121B|\u1262\u1206\u1295|\u1361\u1262\u1206|\u122D\u1361\u12A0|\u1308\u1229\u1361|\u12A0\u1308\u1229|\u1293\u120D\u1361|\u123D\u1293\u120D|\u1293\u123D\u1293|\u122D\u1293\u123D|\u1270\u122D\u1293|\u1295\u1270\u122D|\u12A2\u1295\u1270|\u1361\u12E8\u12A0|\u12A0\u1308\u122D|\u1295\u12F5\u1361|\u12A0\u1295\u12F5|\u1205\u121D\u1361|\u1293\u1361\u1290|\u1361\u12CD\u1233|\u1228\u1303\u1361|\u1296\u1275\u1361",
      tir: "\u1361\u1361 | \u1218\u1230|\u1230\u1265 | \u1230\u1265| \u12A6\u1208|\u12A6\u1208\u12CE|\u1293\u12ED | \u1293\u12ED|\u12CE\u1361\u1361|\u1208\u12CE\u1361|\u1218\u1230\u120D|\u1230\u120D |\u1215\u12F5\u1215|\u1215\u12F5 |\u12F5\u1215\u12F5| \u1215\u12F5|\u12ED \u121D|\u120D \u12A6| \u12A6\u1265|\u12F5 \u1230|\u1275\u1295 |\u12CD\u1295 |\u1361 \u1215|\u12AB\u1265 |\u12A6\u1265 |\u12C8\u12ED | \u12C8\u12ED|\u1295 \u1218|\u1265 \u12DD| \u12AB\u1265| \u1218\u1295| \u1290\u1343|\u1290\u1275 |\u1265 \u1218|\u12DD\u12BE\u1290|\u1265 \u1265| \u12A5\u1295|\u12BE\u1290 | \u12DD\u12BE|\u1295 \u1290| \u121D\u122D|\u1295\u1361\u1361|\u12B9\u1295 | \u12A5\u12DA|\u122D\u12AB\u1265|\u121D\u122D\u12AB| \u12A6\u12ED|\u12ED\u12B9\u1295| \u12ED\u12B9|\u1273\u1275\u1295|\u1290\u1343\u1290|\u12A5\u12DA |\u1295 \u12A6|\u1215\u130A |\u1290 \u12ED|\u1273\u1275 |\u1275 \u12A6|\u12ED \u1265|\u1295 \u121D| \u12A8\u121D|\u1265 \u12A6| \u1265\u1215| \u1363 |\u1295\u130D\u1235|\u1218\u1295\u130D| \u1203\u1308|\u1363 \u1265|\u12CA \u1218|\u121B\u12D5\u122A|\u1235\u122B\u1215|\u1295 \u1295| \u1295\u121D|\u12D5\u122A | \u1295\u12AD|\u12A6\u12CA |\u1295 \u1265|\u2019\u12CD\u1295|\u1218\u1230\u120B|\u122B\u12CA |\u121B\u1215\u1260|\u12A6\u1275 | \u12DD\u1270| \u121B\u12D5|\u120E\u121D |\u122D\u1295 | \u1235\u122B|\u1270\u1230\u1265|\u12D3\u1275 |\u1290\u1271 |\u1265\u12A6\u12CA|\u1230\u1265\u12A6|\u1275 \u12C8|\u1290\u1273\u1275|\u120B\u1275\u1295|\u1215\u1260\u122B|\u120D\u12A6\u1275|\u12AB\u120D\u12A6| \u1265\u12D8|\u1295 \u12DD|\u121D\u1361\u1361|\u122D\u1272 |\u1205\u122D\u1272|\u121D\u1205\u122D|\u1275\u121D\u1205| \u1275\u121D|\u122B\u1215 | \u121B\u1215|\u12B8\u12CD\u1295| \u1308\u1260|\u1265\u1215\u130A|\u1271 \u1295| \u1265\u12DD|\u1343\u1290\u1273|\u1230\u120B\u1275|\u12DA \u12F5| \u12A6\u12F5|\u12CE\u121D\u1361|\u1208\u12CE\u121D|\u1273\u12CA |\u12A5\u1295\u1275|\u122A\u1270\u1230|\u1265\u122A\u1270|\u1215\u1265\u122A| \u1215\u1265|\u1265\u1295 |\u122B\u1275 |\u1295 \u1230|\u12CB\u1295 |\u12A1\u2019\u12CD|\u121D\u12A1\u2019|\u12A8\u121D\u12A1|\u1363 \u12A6|\u122D\u12D3\u1275|\u1235\u122D\u12D3| \u1235\u122D|\u12D5\u120A |\u1295 \u1293|\u1290\u1275\u1295|\u1275 \u1293|\u12ED \u12A6|\u1290\u1343 |\u1308\u1229 |\u1203\u1308\u1229|\u121D \u1218|\u1295\u130B\u1308|\u12F5\u1295\u130B| \u12F5\u1295|\u12A5\u1295\u1270|\u1260\u122B\u12CA| \u1265\u121B|\u12ED\u121B\u1296|\u1203\u12ED\u121B|\u12A9\u120E\u121D| \u12A9\u120E|\u120D\u1295 |\u12AD\u12B8\u12CD| \u12AD\u12B8|\u1275 \u1235|\u1295 \u1213| \u1203\u12ED|\u1275 \u1218|\u1361 \u12A5| \u12AB\u120D|\u12A5\u1295 |\u1264\u1270\u1230| \u1264\u1270|\u12A5\u12CB\u1295| \u12A5\u12CB|\u1260\u1295 |\u1295 \u12D8|\u1270\u12F0\u1295|\u1218\u1230\u122A|\u130D\u1235\u1272|\u1295 \u12AB|\u1213\u1208\u12CB| \u1213\u1208|\u1265\u12D8\u12ED| \u121D\u12C3| \u1215\u130A|\u1295\u1363 |\u12CA \u12C8|\u1343\u1290\u1275| \u12D8\u12ED|\u1213\u12F0 |\u1295 \u1270|\u1275\u1363 |\u1293\u1295 | \u121D\u1235|\u1343\u1295 |\u1290\u1343\u1295| \u12AD\u1265|\u1361 \u1275|\u1265\u121B\u12D5|\u1275 \u1265|\u1273\u12CD\u1295|\u1265\u1290\u1343| \u1265\u1290|\u1265 \u1293|\u12DC\u130D\u1290| \u12DC\u130D|\u1235\u1273\u1275|\u130D\u1235\u1273|\u1265 \u1215|\u12CA \u12A6|\u1265 \u1295|\u1263\u122D\u1295|\u1361 \u12DD| \u1265\u1213|\u1290\u1272 | \u1290\u1272|\u122A\u130B\u1308|\u1308\u1260\u1295|\u134D\u1275\u1213|\u120B\u12CD\u1295|\u1363 \u12A8|\u1343\u12A2 |\u12C8\u1343\u12A2| \u12C8\u1343|\u1308 \u1235|\u1308\u1308 |\u1295\u1308\u1308|\u12F0\u1295\u1308|\u12DD\u1270\u12F0|\u130A \u12AB|\u1203\u1308\u122B|\u1230\u122A\u1273|\u1209 \u1218|\u1235\u1272 |\u12DA \u1265|\u1208\u12CB |\u12D8\u12ED |\u120D\u12D5\u120A| \u120D\u12D5|\u12F5 \u12A6|\u12AD\u1265\u1229|\u12CA \u12AD|\u120D \u12A5|\u1275 \u12AD| \u12F5\u1215| \u121D\u1295|\u1205\u12ED\u12C8|\u12ED\u134D\u1340|\u12D3\u1208\u121D|\u1363 \u1215|\u1265 \u12A5| \u121D\u121D|\u122D\u1363 | \u1213\u12F0|\u1361 \u1265|\u1308 \u12A5|\u130B\u1308 |\u120D\u12CE |\u12F5\u120D\u12CE|\u12A6\u12F5\u120D| \u1265\u1203| \u1265\u121D|\u121D \u1265|\u1275 \u12A5|\u1263\u1275 |\u1263\u1208 |\u12D5\u1263\u1208|\u121D\u12D5\u1263| \u121D\u12D5| \u1265\u122D|\u12F5\u1215\u1290|\u1265 \u1230|\u122A \u12AD|\u1295 \u1235|\u1271\u1295 |\u1272 \u1265|\u12CA \u12CD| \u121D\u1325| \u1218\u122A|\u1363 \u121D| \u121D\u130D|\u1271 \u12C8| \u1295\u1265|\u122D \u1295|\u1263\u122D |\u121D\u1235 |\u1309\u1305\u1208| \u1309\u1305|\u1215\u1295 | \u134D\u1275|\u1295 \u134D|\u1213\u12F3\u122D| \u1213\u12F3|\u1295\u1295 |\u1271 \u12AD|\u1308\u120D\u130D|\u1270\u130D\u1263| \u1270\u130D|\u1261\u122B\u1275|\u1215\u1261\u122B| \u1215\u1261|\u12F5\u1265 |\u12CD\u12F5\u1265| \u12CD\u12F5|\u12DA \u1218|\u1215\u1273\u1275"
    },
    Hebrew: {
      heb: "\u05D5\u05EA |\u05D9\u05DD |\u05DB\u05DC | \u05DB\u05DC|\u05D3\u05DD |\u05D0\u05D3\u05DD| \u05D6\u05DB|\u05DC \u05D0|\u05D9\u05D5\u05EA| \u05D0\u05D3|\u05EA \u05D4|\u05D9 \u05DC|\u05DB\u05D0\u05D9|\u05D0\u05D9 |\u05D6\u05DB\u05D0| \u05E9\u05DC|\u05DC\u05D0 | \u05D5\u05DC|\u05DC \u05D4|\u05D9\u05EA |\u05E9\u05DC |\u05E8\u05D5\u05EA|\u05D0\u05D5 | \u05D0\u05D5|\u05EA \u05D5|\u05DD \u05D6| \u05DC\u05D0|\u05D5\u05D9\u05D5|\u05D9\u05DF |\u05D9\u05E8\u05D5|\u05D6\u05DB\u05D5|\u05E8\u05D4 | \u05DC\u05D4|\u05EA \u05DC|\u05EA \u05E9|\u05DD \u05DC| \u05D4\u05DE|\u05D5\u05DF |\u05D5 \u05D1| \u05D5\u05D4|\u05D4 \u05E9| \u05D4\u05D7|\u05D5 \u05DC|\u05D5\u05EA\u05D9|\u05D7\u05D9\u05E8|\u05EA\u05D5 |\u05D9\u05D9\u05DD|\u05EA \u05D1|\u05E0\u05D4 |\u05D0\u05EA |\u05D4 \u05D4|\u05EA \u05D0| \u05D5\u05D1| \u05D1\u05DE|\u05D5\u05DA |\u05EA \u05DB|\u05E2\u05DC |\u05D0 \u05D9|\u05DC\u05D4 |\u05D4 \u05D0|\u05D9\u05D4 | \u05D0\u05EA|\u05D3\u05D4 | \u05E2\u05DC|\u05DD \u05D5|\u05DD \u05D1|\u05E0\u05D9 |\u05D5 \u05DB| \u05E9\u05D5| \u05E9\u05D4|\u05DB\u05D5\u05EA|\u05D4 \u05DB|\u05DB\u05D5\u05D9| \u05DC\u05D1|\u05D1\u05D5\u05D3|\u05D1\u05D5\u05EA|\u05DD \u05D4|\u05D1\u05D7\u05D9| \u05D1\u05D9|\u05E0\u05D5\u05EA|\u05D4 \u05DC| \u05D4\u05D0|\u05D0\u05D5\u05DE|\u05D4 \u05D1|\u05D4 \u05D5|\u05D4\u05D7\u05D9|\u05DC\u05D9\u05EA|\u05D9\u05E8\u05D4|\u05EA \u05DE|\u05D9\u05E0\u05D5| \u05DC\u05E2|\u05DF \u05E9|\u05D4 \u05DE|\u05DC\u05D0\u05D5|\u05DE\u05D9 |\u05E4\u05DC\u05D9|\u05D5\u05D4 |\u05E9\u05D5\u05D5|\u05DF \u05D5|\u05D7\u05D9\u05E0|\u05D5 \u05D0|\u05D5 \u05D5| \u05D4\u05DB|\u05D7\u05D5\u05E7|\u05D4\u05D7\u05D5|\u05D9 \u05D4|\u05DD \u05D0|\u05D3\u05D5\u05EA|\u05DC\u05D5 |\u05D1\u05D9\u05DF|\u05E2\u05D4 | \u05D0\u05D7|\u05DC\u05D9\u05D4| \u05DC\u05E4|\u05DF \u05DC| \u05D7\u05D5| \u05D1\u05E0|\u05E0\u05D5\u05DA|\u05D5\u05E4\u05E9|\u05D7\u05D5\u05E4|\u05D5\u05E8 |\u05D5\u05D3 |\u05D4\u05D2\u05E0|\u05D5\u05E7 | \u05D1\u05DB|\u05D9\u05DC\u05D9| \u05D9\u05D4| \u05D4\u05D6|\u05D9 \u05D5| \u05D4\u05D9|\u05D5\u05D0 |\u05D0\u05DC\u05D9|\u05D5 \u05D4|\u05E4\u05D9 |\u05D5\u05DC\u05D4|\u05D5\u05DE\u05D9|\u05DC \u05DE| \u05D4\u05E4|\u05D5\u05E6\u05D9|\u05DA \u05D4|\u05DF \u05D1|\u05D5\u05D0\u05D9|\u05E8\u05DA |\u05D7\u05D5\u05EA|\u05D0\u05D9\u05DF|\u05E8\u05E6\u05D5|\u05E8\u05D1\u05D5|\u05DD \u05E9|\u05DC\u05D9\u05DC|\u05D9\u05D5 |\u05E9\u05D5\u05D0| \u05DC\u05DE|\u05E8 \u05D0|\u05DF \u05D4| \u05D4\u05D3| \u05D1\u05D7|\u05D5\u05D5\u05D4|\u05DC\u05D4\u05D2|\u05E4\u05E0\u05D9|\u05D4\u05D9\u05D4| \u05DC\u05D7| \u05DC\u05D5|\u05D9\u05D1\u05D5|\u05DC\u05EA |\u05E0\u05EA\u05D5| \u05D4\u05D5|\u05DE\u05D3\u05D9|\u05DC\u05DC |\u05D0\u05D7\u05E8|\u05D4 \u05E4|\u05D9\u05D0 |\u05D4\u05D9\u05D0|\u05DC\u05DC\u05D0|\u05D6\u05D5 |\u05D4\u05DB\u05E8| \u05D1\u05D4|\u05E8\u05D5\u05D9| \u05D0\u05D9|\u05E0\u05D5 |\u05EA\u05D9\u05D4|\u05D3\u05D5 |\u05D1\u05E0\u05D9|\u05DC \u05D1|\u05E2\u05D1\u05D5|\u05D9\u05D0\u05DC|\u05E6\u05D9\u05D0|\u05E1\u05D5\u05E6| \u05E1\u05D5|\u05D5\u05D3\u05D4| \u05D7\u05D9|\u05E9\u05D9\u05EA|\u05E4\u05E9\u05D9|\u05D3\u05E8\u05DA| \u05D3\u05E8|\u05D4\u05DF | \u05D4\u05E2|\u05D7\u05D4 | \u05D1\u05E9|\u05D5\u05D9 |\u05EA\u05D5\u05DA|\u05DE\u05E2\u05E9|\u05D2\u05E0\u05D4|\u05D4\u05DB\u05DC|\u05E9\u05D9\u05D5|\u05DE\u05E9\u05E4| \u05E2\u05D1|\u05D9\u05D4\u05D9|\u05DC\u05D7\u05D9|\u05D2\u05D1\u05DC|\u05E9\u05E8\u05D9| \u05E9\u05E8|\u05DE\u05E0\u05D5|\u05D9 \u05E9|\u05D3\u05D9\u05E0| \u05D9\u05D5| \u05DE\u05E2|\u05D7\u05D1\u05E8|\u05E9\u05D4\u05D9| \u05D6\u05D5|\u05D6\u05D4 |\u05D0\u05D9\u05E9|\u05DC\u05E4\u05D9|\u05D4\u05DD |\u05DD \u05E0|\u05D9 \u05D0|\u05DB\u05DC\u05DC|\u05E2\u05D5\u05EA|\u05E0\u05E9\u05D5|\u05D5\u05EA\u05D5|\u05D9\u05D4\u05DF|\u05D2\u05D5\u05D3|\u05D9\u05E4\u05D5|\u05D0 \u05D1|\u05D0\u05E8\u05E6| \u05D0\u05E8|\u05DB\u05D1\u05D5| \u05D1\u05D6|\u05E9\u05D4 |\u05E9\u05D5\u05EA|\u05E7 \u05D1| \u05E4\u05DC|\u05EA\u05D9\u05D5|\u05E8\u05D9\u05E8|\u05D5\u05D4\u05D7|\u05E1\u05D5\u05D3|\u05D9\u05E1\u05D5|\u05EA \u05D6|\u05E8\u05D9\u05DD|\u05E2\u05DD |\u05DC \u05D6|\u05D0\u05D9\u05DD|\u05D5\u05DD |\u05D5\u05DC\u05D0| \u05DC\u05DB|\u05D9\u05E9\u05D9|\u05DF \u05D0|\u05D4\u05D6\u05DB|\u05DD \u05D9|\u05D4\u05D2\u05D1| \u05D4\u05D2|\u05D5\u05E0\u05D5|\u05D5\u05D1\u05D9|\u05D4\u05D5\u05D0|\u05EA\u05D4 |\u05D4\u05DE\u05D3|\u05D3 \u05D0|\u05D9\u05D3\u05D4| \u05DC\u05D9|\u05EA\u05D9 |\u05D0 \u05DC|\u05E4\u05D5\u05DC| \u05DC\u05E9|\u05D4\u05E4\u05DC|\u05D0 \u05D4| \u05DC\u05DC|\u05D4 \u05D6| \u05E9\u05E0|\u05D7\u05E8\u05D5| \u05D1\u05EA|\u05DD \u05DB| \u05D1\u05E2| \u05D5\u05E9|\u05E9\u05E8 |\u05D5\u05D1\u05D7|\u05D4\u05E9\u05EA|\u05D9\u05D3\u05D9| \u05D4\u05E8|\u05D1\u05D5\u05E8|\u05E6\u05D9\u05D1| \u05D0\u05DE|\u05D1\u05E8\u05D4|\u05E2\u05D9\u05EA|\u05D4 \u05D7|\u05D4\u05E0\u05E9| \u05D4\u05E0|\u05E8\u05D7\u05D5|\u05D6\u05E8\u05D7|\u05D0\u05D6\u05E8|\u05D5\u05D7\u05D3|\u05DE\u05D5\u05EA",
      ydd: " \u05E4\u05BF|\u05E2\u05E8 |\u05D5\u05DF |\u05D8 \u05D0|\u05D3\u05E2\u05E8| \u05D0\u05B7|\u05DF \u05D0| \u05D0\u05D5|\u05D0\u05B7\u05E8|\u05D0\u05D5\u05DF| \u05D0\u05F1|\u05E2\u05DF |\u05DF \u05E4| \u05D0\u05D9|\u05E4\u05BF\u05D5|\u05E8\u05E2\u05DB| \u05E8\u05E2|\u05E2\u05DB\u05D8|\u05BF\u05D5\u05DF|\u05F1\u05E3 |\u05D0\u05F1\u05E3|\u05E4\u05BF\u05D0| \u05D3\u05E2|\u05DB\u05D8 |\u05D0\u05B7 | \u05D6\u05F2|\u05D6\u05F2\u05B7| \u05D2\u05E2|\u05D0\u05B8\u05E1|\u05D5\u05E0\u05D2|\u05BF\u05D0\u05B7| \u05D4\u05D0|\u05D4\u05D0\u05B8|\u05DF \u05D3| \u05D0\u05B8|\u05B7\u05DF | \u05D3\u05D9|\u05D0\u05B7\u05DC|\u05F0\u05D0\u05B8| \u05F0\u05D0|\u05E0\u05D2 |\u05D0\u05B7\u05E0|\u05E0\u05D9\u05D8|\u05D0\u05B8\u05D8|\u05D3\u05D9 |\u05F2\u05B7\u05DF|\u05B8\u05D8 |\u05D0\u05B8\u05DC|\u05D9\u05D8 |\u05E2\u05D3\u05E2|\u05D9\u05E2\u05D3| \u05D9\u05E2|\u05DF \u05D6|\u05D0\u05B8\u05E8|\u05E8\u05F2\u05B7|\u05B8\u05E1 |\u05DE\u05E2\u05DF|\u05D1\u05D0\u05B7| \u05DE\u05E2| \u05D1\u05D0|\u05E0\u05D0\u05B7|\u05D8\u05DF |\u05D6\u05D0\u05B8|\u05B7 \u05E8|\u05D0\u05B8\u05D3|\u05E8 \u05D0|\u05D9\u05DF |\u05D0\u05D9\u05DF|\u05E4\u05BF\u05E8|\u05DF \u05D2|\u05E8 \u05D4|\u05DF \u05F0|\u05BF\u05E8\u05F2|\u05B8\u05D3\u05E2|\u05D9\u05D6 | \u05D6\u05D0| \u05E6\u05D5|\u05E2 \u05D0|\u05D0\u05B7\u05E6|\u05D0\u05D9\u05D6|\u05B7\u05E6\u05D9|\u05B7\u05E0\u05D3|\u05F2\u05B7\u05E0|\u05DC\u05E2\u05DB| \u05E4\u05BC|\u05B7\u05E4\u05BF|\u05D0\u05B7\u05E4| \u05E0\u05D9| \u05F0\u05E2|\u05F2\u05D8 |\u05E2\u05D6\u05E2|\u05D2\u05E2\u05D6|\u05D8\u05E2\u05E8|\u05E8\u05D0\u05B7|\u05B8\u05DC |\u05D0\u05B8\u05E0|\u05DC\u05D0\u05B7|\u05E4\u05BF\u05D8|\u05DE\u05D9\u05D8|\u05E8\u05DF |\u05D3\u05D9\u05E7|\u05DC\u05DF |\u05DF \u05E0|\u05D8 \u05D3|\u05D1\u05DF |\u05B7\u05DC\u05E2|\u05E7\u05D8 |\u05D8\u05D9\u05E7|\u05E9\u05D0\u05B7| \u05DE\u05D9|\u05E2\u05E0\u05D8|\u05E8 \u05DE|\u05D8\u05DC\u05E2|\u05D0\u05B7\u05E7|\u05E0\u05E2\u05DF|\u05E3 \u05D0|\u05DB\u05E2\u05E8|\u05D8\u05D0\u05B8|\u05E2\u05E8\u05E2|\u05D9\u05E2 |\u05B7\u05E0\u05E2|\u05E8\u05D5\u05E0|\u05E2\u05DB\u05E2|\u05D9\u05E7 | \u05D3\u05D0|\u05D9\u05E7\u05E2|\u05B7\u05E8\u05D1|\u05D9\u05D8\u05BE|\u05E1\u05E2\u05E8|\u05D4\u05F2\u05D8|\u05B7\u05D4\u05F2|\u05F2\u05B7\u05D4|\u05DC\u05E2 |\u05DF \u05D1| \u05D6\u05D9|\u05DF \u05DE|\u05E4\u05BC\u05E8|\u05D2\u05DF |\u05E2\u05DD |\u05E8 \u05D2| \u05E7\u05F2|\u05B8\u05E8 | \u05D8\u05D0|\u05D9\u05D0\u05B8|\u05E6\u05D9\u05D0|\u05D9\u05E9\u05E2|\u05E2 \u05E4|\u05BE\u05D0\u05D9|\u05D8\u05BE\u05D0|\u05BE\u05E0\u05D9|\u05D8\u05D0\u05B7|\u05DE\u05E2\u05E0|\u05E0\u05D2\u05E2|\u05D0\u05F1\u05E1|\u05E4\u05BF\u05E2|\u05D3\u05D0\u05B8|\u05DF \u05E7|\u05E8 \u05E4|\u05E2\u05D8 |\u05B8\u05E0\u05D0|\u05E8\u05BE\u05E0|\u05E2\u05E8\u05BE|\u05B8\u05E1\u05E2|\u05E6\u05D9\u05E2|\u05D8 \u05E4|\u05E6\u05D5 |\u05D2 \u05D0|\u05D8 \u05E6|\u05D9\u05E7\u05D8|\u05D9\u05DA |\u05D6\u05D9\u05DA|\u05E0\u05D3 |\u05E7\u05DF |\u05DC\u05F2\u05B7| \u05D2\u05DC|\u05F0\u05E2\u05E8|\u05D6\u05E2\u05DC|\u05E7\u05F2\u05D8|\u05D0\u05B8\u05D1|\u05E7\u05E2 |\u05DB\u05E2 |\u05D9\u05E7\u05DF| \u05E6\u05D9|\u05F2\u05E0\u05E2|\u05E2\u05E0\u05E2|\u05E2\u05E8\u05DF| \u05E0\u05D0|\u05E0\u05D3\u05E2|\u05E0\u05D8\u05E2|\u05E8 \u05D3|\u05BF\u05D8 |\u05DF \u05D9|\u05E3 \u05E4|\u05D2\u05E2\u05DF|\u05D3\u05D5\u05E8|\u05E1 \u05D0|\u05DF \u05DC|\u05DF \u05D4|\u05D8 \u05F0| \u05E9\u05D5|\u05E2\u05E1 |\u05E1 \u05D6|\u05E4\u05BC\u05E2| \u05DC\u05D0|\u05E7\u05E2\u05E8|\u05D0\u05B7\u05D8|\u05D9\u05D8\u05E2|\u05E8\u05E2 |\u05E9\u05E2 |\u05D5\u05E0\u05D8|\u05B7\u05E8\u05D0|\u05DC \u05D6|\u05D2\u05DC\u05F2|\u05DC\u05E9\u05D0|\u05E2\u05DC\u05E9|\u05D1\u05E2\u05D8| \u05D3\u05D5|\u05E2\u05E4\u05BF|\u05DB\u05DF |\u05E9\u05DF |\u05D9\u05DD |\u05E9\u05D8\u05E2|\u05DF \u05E9|\u05E0\u05E2\u05DD|\u05E7\u05F2\u05E0|\u05D0\u05B8\u05E4|\u05E0\u05D8 |\u05D8\u05E2\u05D8|\u05DC\u05D9\u05D8| \u05E9\u05D8|\u05F2\u05D8\u05DF|\u05E8 \u05F0|\u05E0\u05D8\u05E9|\u05E8\u05D1\u05E2|\u05D9\u05D5\u05E0|\u05E8\u05DA |\u05D5\u05E8\u05DA|\u05E2\u05E8\u05E6|\u05D9 \u05E4|\u05E8\u05E2\u05E1| \u05D2\u05E8|\u05F2\u05B7\u05DB|\u05E8\u05D0\u05B8|\u05D2 \u05E4|\u05E6\u05D9 |\u05DD \u05D8|\u05E8\u05E2\u05E0|\u05E7 \u05D0|\u05B8\u05E4\u05BC|\u05DC\u05E2\u05E8|\u05D0\u05D9\u05E0|\u05E8\u05E2\u05DC|\u05BF\u05D0\u05B8|\u05E2 \u05E8|\u05D9 \u05D0|\u05B7\u05E8\u05E2|\u05E8 \u05D6| \u05DB\u05BC|\u05DA \u05D0|\u05E6\u05D9\u05D5|\u05E8\u05E6\u05D9|\u05D2 \u05D6|\u05E8 \u05D1| \u05DE\u05D0|\u05E2\u05DE\u05E2|\u05E6\u05DF |\u05E0\u05E2\u05DE|\u05E9\u05E4\u05BC|\u05D0\u05B7\u05DF|\u05E0\u05D8\u05DC|\u05B8\u05D1\u05DF|\u05B7\u05E7\u05D8|\u05DF \u05E6|\u05D2\u05E2\u05E8|\u05E2\u05E8\u05D9| \u05E7\u05E2|\u05DF \u05E2|\u05E2\u05E5 |\u05D6\u05E2\u05E5|\u05DC\u05F1\u05D8| \u05DC\u05F1| \u05F0\u05D9|\u05DD \u05D0|\u05D0\u05D9\u05DD|\u05D5\u05DD |\u05D8\u05E8\u05D0|\u05E4\u05BF\u05DF|\u05B7\u05E8\u05D6|\u05D0\u05D5\u05DE|\u05DE\u05D0\u05B8| \u05E7\u05D5|\u05B7\u05DC\u05D9|\u05E4\u05BC\u05D0|\u05DC\u05D9\u05D2|\u05D6 \u05D0|\u05E7\u05DC\u05D0|\u05E3 \u05D3|\u05E2\u05E8\u05E9|\u05E4\u05BF\u05D9|\u05D0\u05B7\u05E9"
    }
  };

  // node_modules/franc/index.js
  var MAX_LENGTH = 2048;
  var MIN_LENGTH = 10;
  var MAX_DIFFERENCE = 300;
  var own2 = {}.hasOwnProperty;
  var script;
  var numericData = {};
  for (script in data) {
    if (own2.call(data, script)) {
      const languages = data[script];
      let name;
      numericData[script] = {};
      for (name in languages) {
        if (own2.call(languages, name)) {
          const model = languages[name].split("|");
          const trigrams2 = {};
          let weight = model.length;
          while (weight--) {
            trigrams2[model[weight]] = weight;
          }
          numericData[script][name] = trigrams2;
        }
      }
    }
  }
  function franc(value, options) {
    return francAll(value, options)[0][0];
  }
  function francAll(value, options = {}) {
    const only = [...options.whitelist || [], ...options.only || []];
    const ignore = [...options.blacklist || [], ...options.ignore || []];
    const minLength = options.minLength !== null && options.minLength !== void 0 ? options.minLength : MIN_LENGTH;
    if (!value || value.length < minLength) {
      return und();
    }
    value = value.slice(0, MAX_LENGTH);
    const script2 = getTopScript(value, expressions);
    if (!script2[0] || !(script2[0] in numericData)) {
      if (!script2[0] || script2[1] === 0 || !allow(script2[0], only, ignore)) {
        return und();
      }
      return singleLanguageTuples(script2[0]);
    }
    return normalize(
      value,
      getDistances(asTuples(value), numericData[script2[0]], only, ignore)
    );
  }
  function normalize(value, distances) {
    const min = distances[0][1];
    const max2 = value.length * MAX_DIFFERENCE - min;
    let index = -1;
    while (++index < distances.length) {
      distances[index][1] = 1 - (distances[index][1] - min) / max2 || 0;
    }
    return distances;
  }
  function getTopScript(value, scripts) {
    let topCount = -1;
    let topScript;
    let script2;
    for (script2 in scripts) {
      if (own2.call(scripts, script2)) {
        const count = getOccurrence(value, scripts[script2]);
        if (count > topCount) {
          topCount = count;
          topScript = script2;
        }
      }
    }
    return [topScript, topCount];
  }
  function getOccurrence(value, expression) {
    const count = value.match(expression);
    return (count ? count.length : 0) / value.length || 0;
  }
  function getDistances(trigrams2, languages, only, ignore) {
    languages = filterLanguages(languages, only, ignore);
    const distances = [];
    let language;
    if (languages) {
      for (language in languages) {
        if (own2.call(languages, language)) {
          distances.push([language, getDistance(trigrams2, languages[language])]);
        }
      }
    }
    return distances.length === 0 ? und() : distances.sort(sort2);
  }
  function getDistance(trigrams2, model) {
    let distance = 0;
    let index = -1;
    while (++index < trigrams2.length) {
      const trigram2 = trigrams2[index];
      let difference = MAX_DIFFERENCE;
      if (trigram2[0] in model) {
        difference = trigram2[1] - model[trigram2[0]] - 1;
        if (difference < 0) {
          difference = -difference;
        }
      }
      distance += difference;
    }
    return distance;
  }
  function filterLanguages(languages, only, ignore) {
    if (only.length === 0 && ignore.length === 0) {
      return languages;
    }
    const filteredLanguages = {};
    let language;
    for (language in languages) {
      if (allow(language, only, ignore)) {
        filteredLanguages[language] = languages[language];
      }
    }
    return filteredLanguages;
  }
  function allow(language, only, ignore) {
    if (only.length === 0 && ignore.length === 0) {
      return true;
    }
    return (only.length === 0 || only.includes(language)) && !ignore.includes(language);
  }
  function und() {
    return singleLanguageTuples("und");
  }
  function singleLanguageTuples(language) {
    return [[language, 1]];
  }
  function sort2(a, b) {
    return a[1] - b[1];
  }

  // node_modules/iso639-js/alpha3to2mapping.json
  var alpha3to2mapping_default = {
    aar: "aa",
    abk: "ab",
    afr: "af",
    aka: "ak",
    amh: "am",
    ara: "ar",
    arg: "an",
    asm: "as",
    ava: "av",
    ave: "ae",
    aym: "ay",
    aze: "az",
    bak: "ba",
    bam: "bm",
    bel: "be",
    ben: "bn",
    bis: "bi",
    bod: "bo",
    bos: "bs",
    bre: "br",
    bul: "bg",
    cat: "ca",
    ces: "cs",
    cha: "ch",
    che: "ce",
    chu: "cu",
    chv: "cv",
    cor: "kw",
    cos: "co",
    cre: "cr",
    cym: "cy",
    dan: "da",
    deu: "de",
    div: "dv",
    dzo: "dz",
    ell: "el",
    eng: "en",
    epo: "eo",
    est: "et",
    eus: "eu",
    ewe: "ee",
    fao: "fo",
    fas: "fa",
    fij: "fj",
    fin: "fi",
    fra: "fr",
    fry: "fy",
    ful: "ff",
    gla: "gd",
    gle: "ga",
    glg: "gl",
    glv: "gv",
    grn: "gn",
    guj: "gu",
    hat: "ht",
    hau: "ha",
    hbs: "sh",
    heb: "he",
    her: "hz",
    hin: "hi",
    hmo: "ho",
    hrv: "hr",
    hun: "hu",
    hye: "hy",
    ibo: "ig",
    ido: "io",
    iii: "ii",
    iku: "iu",
    ile: "ie",
    ina: "ia",
    ind: "id",
    ipk: "ik",
    isl: "is",
    ita: "it",
    jav: "jv",
    jpn: "ja",
    kal: "kl",
    kan: "kn",
    kas: "ks",
    kat: "ka",
    kau: "kr",
    kaz: "kk",
    khm: "km",
    kik: "ki",
    kin: "rw",
    kir: "ky",
    kom: "kv",
    kon: "kg",
    kor: "ko",
    kua: "kj",
    kur: "ku",
    lao: "lo",
    lat: "la",
    lav: "lv",
    lim: "li",
    lin: "ln",
    lit: "lt",
    ltz: "lb",
    lub: "lu",
    lug: "lg",
    mah: "mh",
    mal: "ml",
    mar: "mr",
    mkd: "mk",
    mlg: "mg",
    mlt: "mt",
    mon: "mn",
    mri: "mi",
    msa: "ms",
    mya: "my",
    nau: "na",
    nav: "nv",
    nbl: "nr",
    nde: "nd",
    ndo: "ng",
    nep: "ne",
    nld: "nl",
    nno: "nn",
    nob: "nb",
    nor: "no",
    nya: "ny",
    oci: "oc",
    oji: "oj",
    ori: "or",
    orm: "om",
    oss: "os",
    pan: "pa",
    pli: "pi",
    pol: "pl",
    por: "pt",
    pus: "ps",
    que: "qu",
    roh: "rm",
    ron: "ro",
    run: "rn",
    rus: "ru",
    sag: "sg",
    san: "sa",
    sin: "si",
    slk: "sk",
    slv: "sl",
    sme: "se",
    smo: "sm",
    sna: "sn",
    snd: "sd",
    som: "so",
    sot: "st",
    spa: "es",
    sqi: "sq",
    srd: "sc",
    srp: "sr",
    ssw: "ss",
    sun: "su",
    swa: "sw",
    swe: "sv",
    tah: "ty",
    tam: "ta",
    tat: "tt",
    tel: "te",
    tgk: "tg",
    tgl: "tl",
    tha: "th",
    tir: "ti",
    ton: "to",
    tsn: "tn",
    tso: "ts",
    tuk: "tk",
    tur: "tr",
    twi: "tw",
    uig: "ug",
    ukr: "uk",
    urd: "ur",
    uzb: "uz",
    ven: "ve",
    vie: "vi",
    vol: "vo",
    wln: "wa",
    wol: "wo",
    xho: "xh",
    yid: "yi",
    yor: "yo",
    zha: "za",
    zho: "zh",
    zul: "zu"
  };

  // node_modules/iso639-js/reference/iso639-3-macrolanguages.json
  var iso639_3_macrolanguages_default = {
    aka: [
      {
        fat: {
          status: "active"
        }
      },
      {
        twi: {
          status: "active"
        }
      }
    ],
    ara: [
      {
        aao: {
          status: "active"
        }
      },
      {
        abh: {
          status: "active"
        }
      },
      {
        abv: {
          status: "active"
        }
      },
      {
        acm: {
          status: "active"
        }
      },
      {
        acq: {
          status: "active"
        }
      },
      {
        acw: {
          status: "active"
        }
      },
      {
        acx: {
          status: "active"
        }
      },
      {
        acy: {
          status: "active"
        }
      },
      {
        adf: {
          status: "active"
        }
      },
      {
        aeb: {
          status: "active"
        }
      },
      {
        aec: {
          status: "active"
        }
      },
      {
        afb: {
          status: "active"
        }
      },
      {
        ajp: {
          status: "active"
        }
      },
      {
        apc: {
          status: "active"
        }
      },
      {
        apd: {
          status: "active"
        }
      },
      {
        arb: {
          status: "active"
        }
      },
      {
        arq: {
          status: "active"
        }
      },
      {
        ars: {
          status: "active"
        }
      },
      {
        ary: {
          status: "active"
        }
      },
      {
        arz: {
          status: "active"
        }
      },
      {
        auz: {
          status: "active"
        }
      },
      {
        avl: {
          status: "active"
        }
      },
      {
        ayh: {
          status: "active"
        }
      },
      {
        ayl: {
          status: "active"
        }
      },
      {
        ayn: {
          status: "active"
        }
      },
      {
        ayp: {
          status: "active"
        }
      },
      {
        bbz: {
          status: "active"
        }
      },
      {
        pga: {
          status: "active"
        }
      },
      {
        shu: {
          status: "active"
        }
      },
      {
        ssh: {
          status: "active"
        }
      },
      {
        ayc: {
          status: "active"
        }
      }
    ],
    aym: [
      {
        ayr: {
          status: "active"
        }
      }
    ],
    aze: [
      {
        azb: {
          status: "active"
        }
      },
      {
        azj: {
          status: "active"
        }
      }
    ],
    bal: [
      {
        bcc: {
          status: "active"
        }
      },
      {
        bgn: {
          status: "active"
        }
      },
      {
        bgp: {
          status: "active"
        }
      }
    ],
    bik: [
      {
        bcl: {
          status: "active"
        }
      },
      {
        bhk: {
          status: "retired"
        }
      },
      {
        bln: {
          status: "active"
        }
      },
      {
        bto: {
          status: "active"
        }
      },
      {
        cts: {
          status: "active"
        }
      },
      {
        fbl: {
          status: "active"
        }
      },
      {
        lbl: {
          status: "active"
        }
      },
      {
        rbl: {
          status: "active"
        }
      },
      {
        ubl: {
          status: "active"
        }
      }
    ],
    bnc: [
      {
        ebk: {
          status: "active"
        }
      },
      {
        lbk: {
          status: "active"
        }
      },
      {
        obk: {
          status: "active"
        }
      },
      {
        rbk: {
          status: "active"
        }
      },
      {
        vbk: {
          status: "active"
        }
      }
    ],
    bua: [
      {
        bxm: {
          status: "active"
        }
      },
      {
        bxr: {
          status: "active"
        }
      },
      {
        bxu: {
          status: "active"
        }
      }
    ],
    chm: [
      {
        mhr: {
          status: "active"
        }
      },
      {
        mrj: {
          status: "active"
        }
      }
    ],
    cre: [
      {
        crj: {
          status: "active"
        }
      },
      {
        crk: {
          status: "active"
        }
      },
      {
        crl: {
          status: "active"
        }
      },
      {
        crm: {
          status: "active"
        }
      },
      {
        csw: {
          status: "active"
        }
      },
      {
        cwd: {
          status: "active"
        }
      }
    ],
    del: [
      {
        umu: {
          status: "active"
        }
      },
      {
        unm: {
          status: "active"
        }
      }
    ],
    den: [
      {
        scs: {
          status: "active"
        }
      },
      {
        xsl: {
          status: "active"
        }
      }
    ],
    din: [
      {
        dib: {
          status: "active"
        }
      },
      {
        dik: {
          status: "active"
        }
      },
      {
        dip: {
          status: "active"
        }
      },
      {
        diw: {
          status: "active"
        }
      },
      {
        dks: {
          status: "active"
        }
      }
    ],
    doi: [
      {
        dgo: {
          status: "active"
        }
      },
      {
        xnr: {
          status: "active"
        }
      }
    ],
    est: [
      {
        ekk: {
          status: "active"
        }
      },
      {
        vro: {
          status: "active"
        }
      }
    ],
    fas: [
      {
        pes: {
          status: "active"
        }
      },
      {
        prs: {
          status: "active"
        }
      }
    ],
    ful: [
      {
        ffm: {
          status: "active"
        }
      },
      {
        fub: {
          status: "active"
        }
      },
      {
        fuc: {
          status: "active"
        }
      },
      {
        fue: {
          status: "active"
        }
      },
      {
        fuf: {
          status: "active"
        }
      },
      {
        fuh: {
          status: "active"
        }
      },
      {
        fui: {
          status: "active"
        }
      },
      {
        fuq: {
          status: "active"
        }
      },
      {
        fuv: {
          status: "active"
        }
      }
    ],
    gba: [
      {
        bdt: {
          status: "active"
        }
      },
      {
        gbp: {
          status: "active"
        }
      },
      {
        gbq: {
          status: "active"
        }
      },
      {
        gmm: {
          status: "active"
        }
      },
      {
        gso: {
          status: "active"
        }
      },
      {
        gya: {
          status: "active"
        }
      },
      {
        mdo: {
          status: "retired"
        }
      }
    ],
    gon: [
      {
        ggo: {
          status: "active"
        }
      },
      {
        gno: {
          status: "active"
        }
      }
    ],
    grb: [
      {
        gbo: {
          status: "active"
        }
      },
      {
        gec: {
          status: "active"
        }
      },
      {
        grj: {
          status: "active"
        }
      },
      {
        grv: {
          status: "active"
        }
      },
      {
        gry: {
          status: "active"
        }
      }
    ],
    grn: [
      {
        gnw: {
          status: "active"
        }
      },
      {
        gug: {
          status: "active"
        }
      },
      {
        gui: {
          status: "active"
        }
      },
      {
        gun: {
          status: "active"
        }
      },
      {
        nhd: {
          status: "active"
        }
      }
    ],
    hai: [
      {
        hax: {
          status: "active"
        }
      },
      {
        hdn: {
          status: "active"
        }
      }
    ],
    hbs: [
      {
        bos: {
          status: "active"
        }
      },
      {
        hrv: {
          status: "active"
        }
      },
      {
        srp: {
          status: "active"
        }
      }
    ],
    hmn: [
      {
        blu: {
          status: "retired"
        }
      },
      {
        cqd: {
          status: "active"
        }
      },
      {
        hea: {
          status: "active"
        }
      },
      {
        hma: {
          status: "active"
        }
      },
      {
        hmc: {
          status: "active"
        }
      },
      {
        hmd: {
          status: "active"
        }
      },
      {
        hme: {
          status: "active"
        }
      },
      {
        hmg: {
          status: "active"
        }
      },
      {
        hmh: {
          status: "active"
        }
      },
      {
        hmi: {
          status: "active"
        }
      },
      {
        hmj: {
          status: "active"
        }
      },
      {
        hml: {
          status: "active"
        }
      },
      {
        hmm: {
          status: "active"
        }
      },
      {
        hmp: {
          status: "active"
        }
      },
      {
        hmq: {
          status: "active"
        }
      },
      {
        hms: {
          status: "active"
        }
      },
      {
        hmw: {
          status: "active"
        }
      },
      {
        hmy: {
          status: "active"
        }
      },
      {
        hmz: {
          status: "active"
        }
      },
      {
        hnj: {
          status: "active"
        }
      },
      {
        hrm: {
          status: "active"
        }
      },
      {
        huj: {
          status: "active"
        }
      },
      {
        mmr: {
          status: "active"
        }
      },
      {
        muq: {
          status: "active"
        }
      },
      {
        mww: {
          status: "active"
        }
      },
      {
        sfm: {
          status: "active"
        }
      }
    ],
    iku: [
      {
        ike: {
          status: "active"
        }
      },
      {
        ikt: {
          status: "active"
        }
      }
    ],
    ipk: [
      {
        esi: {
          status: "active"
        }
      },
      {
        esk: {
          status: "active"
        }
      }
    ],
    jrb: [
      {
        ajt: {
          status: "active"
        }
      },
      {
        aju: {
          status: "active"
        }
      },
      {
        jye: {
          status: "active"
        }
      },
      {
        yhd: {
          status: "active"
        }
      },
      {
        yud: {
          status: "active"
        }
      }
    ],
    kau: [
      {
        kby: {
          status: "active"
        }
      },
      {
        knc: {
          status: "active"
        }
      },
      {
        krt: {
          status: "active"
        }
      }
    ],
    kln: [
      {
        enb: {
          status: "active"
        }
      },
      {
        eyo: {
          status: "active"
        }
      },
      {
        niq: {
          status: "active"
        }
      },
      {
        oki: {
          status: "active"
        }
      },
      {
        pko: {
          status: "active"
        }
      },
      {
        sgc: {
          status: "active"
        }
      },
      {
        spy: {
          status: "active"
        }
      },
      {
        tec: {
          status: "active"
        }
      },
      {
        tuy: {
          status: "active"
        }
      }
    ],
    kok: [
      {
        gom: {
          status: "active"
        }
      },
      {
        knn: {
          status: "active"
        }
      }
    ],
    kom: [
      {
        koi: {
          status: "active"
        }
      },
      {
        kpv: {
          status: "active"
        }
      }
    ],
    kon: [
      {
        kng: {
          status: "active"
        }
      },
      {
        kwy: {
          status: "active"
        }
      },
      {
        ldi: {
          status: "active"
        }
      }
    ],
    kpe: [
      {
        gkp: {
          status: "active"
        }
      },
      {
        xpe: {
          status: "active"
        }
      }
    ],
    kur: [
      {
        ckb: {
          status: "active"
        }
      },
      {
        kmr: {
          status: "active"
        }
      },
      {
        sdh: {
          status: "active"
        }
      }
    ],
    lah: [
      {
        hnd: {
          status: "active"
        }
      },
      {
        hno: {
          status: "active"
        }
      },
      {
        jat: {
          status: "active"
        }
      },
      {
        phr: {
          status: "active"
        }
      },
      {
        pmu: {
          status: "retired"
        }
      },
      {
        pnb: {
          status: "active"
        }
      },
      {
        skr: {
          status: "active"
        }
      },
      {
        xhe: {
          status: "active"
        }
      }
    ],
    lav: [
      {
        ltg: {
          status: "active"
        }
      },
      {
        lvs: {
          status: "active"
        }
      }
    ],
    luy: [
      {
        bxk: {
          status: "active"
        }
      },
      {
        ida: {
          status: "active"
        }
      },
      {
        lkb: {
          status: "active"
        }
      },
      {
        lko: {
          status: "active"
        }
      },
      {
        lks: {
          status: "active"
        }
      },
      {
        lri: {
          status: "active"
        }
      },
      {
        lrm: {
          status: "active"
        }
      },
      {
        lsm: {
          status: "active"
        }
      },
      {
        lto: {
          status: "active"
        }
      },
      {
        lts: {
          status: "active"
        }
      },
      {
        lwg: {
          status: "active"
        }
      },
      {
        nle: {
          status: "active"
        }
      },
      {
        nyd: {
          status: "active"
        }
      },
      {
        rag: {
          status: "active"
        }
      }
    ],
    man: [
      {
        emk: {
          status: "active"
        }
      },
      {
        mku: {
          status: "active"
        }
      },
      {
        mlq: {
          status: "active"
        }
      },
      {
        mnk: {
          status: "active"
        }
      },
      {
        msc: {
          status: "active"
        }
      },
      {
        mwk: {
          status: "active"
        }
      },
      {
        myq: {
          status: "retired"
        }
      }
    ],
    mlg: [
      {
        bhr: {
          status: "active"
        }
      },
      {
        bjq: {
          status: "retired"
        }
      },
      {
        bmm: {
          status: "active"
        }
      },
      {
        bzc: {
          status: "active"
        }
      },
      {
        msh: {
          status: "active"
        }
      },
      {
        plt: {
          status: "active"
        }
      },
      {
        skg: {
          status: "active"
        }
      },
      {
        tdx: {
          status: "active"
        }
      },
      {
        tkg: {
          status: "active"
        }
      },
      {
        txy: {
          status: "active"
        }
      },
      {
        xmv: {
          status: "active"
        }
      },
      {
        xmw: {
          status: "active"
        }
      }
    ],
    mon: [
      {
        khk: {
          status: "active"
        }
      },
      {
        mvf: {
          status: "active"
        }
      }
    ],
    msa: [
      {
        bjn: {
          status: "active"
        }
      },
      {
        btj: {
          status: "active"
        }
      },
      {
        bve: {
          status: "active"
        }
      },
      {
        bvu: {
          status: "active"
        }
      },
      {
        coa: {
          status: "active"
        }
      },
      {
        dup: {
          status: "active"
        }
      },
      {
        hji: {
          status: "active"
        }
      },
      {
        ind: {
          status: "active"
        }
      },
      {
        jak: {
          status: "active"
        }
      },
      {
        jax: {
          status: "active"
        }
      },
      {
        kvb: {
          status: "active"
        }
      },
      {
        kvr: {
          status: "active"
        }
      },
      {
        kxd: {
          status: "active"
        }
      },
      {
        lce: {
          status: "active"
        }
      },
      {
        lcf: {
          status: "active"
        }
      },
      {
        liw: {
          status: "active"
        }
      },
      {
        max: {
          status: "active"
        }
      },
      {
        meo: {
          status: "active"
        }
      },
      {
        mfa: {
          status: "active"
        }
      },
      {
        mfb: {
          status: "active"
        }
      },
      {
        min: {
          status: "active"
        }
      },
      {
        mly: {
          status: "retired"
        }
      },
      {
        mqg: {
          status: "active"
        }
      },
      {
        msi: {
          status: "active"
        }
      },
      {
        mui: {
          status: "active"
        }
      },
      {
        orn: {
          status: "active"
        }
      },
      {
        ors: {
          status: "active"
        }
      },
      {
        pel: {
          status: "active"
        }
      },
      {
        pse: {
          status: "active"
        }
      },
      {
        tmw: {
          status: "active"
        }
      },
      {
        urk: {
          status: "active"
        }
      },
      {
        vkk: {
          status: "active"
        }
      },
      {
        vkt: {
          status: "active"
        }
      },
      {
        xmm: {
          status: "active"
        }
      },
      {
        zlm: {
          status: "active"
        }
      },
      {
        zmi: {
          status: "active"
        }
      },
      {
        zsm: {
          status: "active"
        }
      }
    ],
    mwr: [
      {
        dhd: {
          status: "active"
        }
      },
      {
        mtr: {
          status: "active"
        }
      },
      {
        mve: {
          status: "active"
        }
      },
      {
        rwr: {
          status: "active"
        }
      },
      {
        swv: {
          status: "active"
        }
      },
      {
        wry: {
          status: "active"
        }
      }
    ],
    nep: [
      {
        dty: {
          status: "active"
        }
      },
      {
        npi: {
          status: "active"
        }
      }
    ],
    nor: [
      {
        nno: {
          status: "active"
        }
      },
      {
        nob: {
          status: "active"
        }
      }
    ],
    oji: [
      {
        ciw: {
          status: "active"
        }
      }
    ],
    oji: [
      {
        ojb: {
          status: "active"
        }
      },
      {
        ojc: {
          status: "active"
        }
      },
      {
        ojg: {
          status: "active"
        }
      },
      {
        ojs: {
          status: "active"
        }
      },
      {
        ojw: {
          status: "active"
        }
      },
      {
        otw: {
          status: "active"
        }
      }
    ],
    ori: [
      {
        ory: {
          status: "active"
        }
      },
      {
        spv: {
          status: "active"
        }
      }
    ],
    orm: [
      {
        gax: {
          status: "active"
        }
      },
      {
        gaz: {
          status: "active"
        }
      },
      {
        hae: {
          status: "active"
        }
      },
      {
        orc: {
          status: "active"
        }
      }
    ],
    pus: [
      {
        pbt: {
          status: "active"
        }
      },
      {
        pbu: {
          status: "active"
        }
      },
      {
        pst: {
          status: "active"
        }
      }
    ],
    que: [
      {
        cqu: {
          status: "active"
        }
      },
      {
        qub: {
          status: "active"
        }
      },
      {
        qud: {
          status: "active"
        }
      },
      {
        quf: {
          status: "active"
        }
      },
      {
        qug: {
          status: "active"
        }
      },
      {
        quh: {
          status: "active"
        }
      },
      {
        quk: {
          status: "active"
        }
      },
      {
        qul: {
          status: "active"
        }
      },
      {
        qup: {
          status: "active"
        }
      },
      {
        qur: {
          status: "active"
        }
      },
      {
        qus: {
          status: "active"
        }
      },
      {
        quw: {
          status: "active"
        }
      },
      {
        qux: {
          status: "active"
        }
      },
      {
        quy: {
          status: "active"
        }
      },
      {
        quz: {
          status: "active"
        }
      },
      {
        qva: {
          status: "active"
        }
      },
      {
        qvc: {
          status: "active"
        }
      },
      {
        qve: {
          status: "active"
        }
      },
      {
        qvh: {
          status: "active"
        }
      },
      {
        qvi: {
          status: "active"
        }
      },
      {
        qvj: {
          status: "active"
        }
      },
      {
        qvl: {
          status: "active"
        }
      },
      {
        qvm: {
          status: "active"
        }
      },
      {
        qvn: {
          status: "active"
        }
      },
      {
        qvo: {
          status: "active"
        }
      },
      {
        qvp: {
          status: "active"
        }
      },
      {
        qvs: {
          status: "active"
        }
      },
      {
        qvw: {
          status: "active"
        }
      },
      {
        qvz: {
          status: "active"
        }
      },
      {
        qwa: {
          status: "active"
        }
      },
      {
        qwc: {
          status: "active"
        }
      },
      {
        qwh: {
          status: "active"
        }
      },
      {
        qws: {
          status: "active"
        }
      },
      {
        qxa: {
          status: "active"
        }
      },
      {
        qxc: {
          status: "active"
        }
      },
      {
        qxh: {
          status: "active"
        }
      },
      {
        qxl: {
          status: "active"
        }
      },
      {
        qxn: {
          status: "active"
        }
      },
      {
        qxo: {
          status: "active"
        }
      },
      {
        qxp: {
          status: "active"
        }
      },
      {
        qxr: {
          status: "active"
        }
      },
      {
        qxt: {
          status: "active"
        }
      },
      {
        qxu: {
          status: "active"
        }
      },
      {
        qxw: {
          status: "active"
        }
      }
    ],
    raj: [
      {
        bgq: {
          status: "active"
        }
      },
      {
        gda: {
          status: "active"
        }
      },
      {
        gju: {
          status: "active"
        }
      },
      {
        hoj: {
          status: "active"
        }
      },
      {
        mup: {
          status: "active"
        }
      },
      {
        wbr: {
          status: "active"
        }
      }
    ],
    rom: [
      {
        rmc: {
          status: "active"
        }
      },
      {
        rmf: {
          status: "active"
        }
      },
      {
        rml: {
          status: "active"
        }
      },
      {
        rmn: {
          status: "active"
        }
      },
      {
        rmo: {
          status: "active"
        }
      },
      {
        rmw: {
          status: "active"
        }
      },
      {
        rmy: {
          status: "active"
        }
      }
    ],
    sqi: [
      {
        aae: {
          status: "active"
        }
      },
      {
        aat: {
          status: "active"
        }
      },
      {
        aln: {
          status: "active"
        }
      },
      {
        als: {
          status: "active"
        }
      }
    ],
    srd: [
      {
        sdc: {
          status: "active"
        }
      },
      {
        sdn: {
          status: "active"
        }
      },
      {
        src: {
          status: "active"
        }
      },
      {
        sro: {
          status: "active"
        }
      }
    ],
    swa: [
      {
        swc: {
          status: "active"
        }
      },
      {
        swh: {
          status: "active"
        }
      }
    ],
    syr: [
      {
        aii: {
          status: "active"
        }
      },
      {
        cld: {
          status: "active"
        }
      }
    ],
    tmh: [
      {
        taq: {
          status: "active"
        }
      },
      {
        thv: {
          status: "active"
        }
      },
      {
        thz: {
          status: "active"
        }
      },
      {
        ttq: {
          status: "active"
        }
      }
    ],
    uzb: [
      {
        uzn: {
          status: "active"
        }
      },
      {
        uzs: {
          status: "active"
        }
      }
    ],
    yid: [
      {
        ydd: {
          status: "active"
        }
      },
      {
        yih: {
          status: "active"
        }
      }
    ],
    zap: [
      {
        zaa: {
          status: "active"
        }
      }
    ],
    zap: [
      {
        zab: {
          status: "active"
        }
      },
      {
        zac: {
          status: "active"
        }
      },
      {
        zad: {
          status: "active"
        }
      },
      {
        zae: {
          status: "active"
        }
      },
      {
        zaf: {
          status: "active"
        }
      },
      {
        zai: {
          status: "active"
        }
      },
      {
        zam: {
          status: "active"
        }
      },
      {
        zao: {
          status: "active"
        }
      },
      {
        zaq: {
          status: "active"
        }
      },
      {
        zar: {
          status: "active"
        }
      },
      {
        zas: {
          status: "active"
        }
      },
      {
        zat: {
          status: "active"
        }
      },
      {
        zav: {
          status: "active"
        }
      },
      {
        zaw: {
          status: "active"
        }
      },
      {
        zax: {
          status: "active"
        }
      },
      {
        zca: {
          status: "active"
        }
      },
      {
        zoo: {
          status: "active"
        }
      },
      {
        zpa: {
          status: "active"
        }
      },
      {
        zpb: {
          status: "active"
        }
      },
      {
        zpc: {
          status: "active"
        }
      },
      {
        zpd: {
          status: "active"
        }
      },
      {
        zpe: {
          status: "active"
        }
      },
      {
        zpf: {
          status: "active"
        }
      },
      {
        zpg: {
          status: "active"
        }
      },
      {
        zph: {
          status: "active"
        }
      },
      {
        zpi: {
          status: "active"
        }
      },
      {
        zpj: {
          status: "active"
        }
      },
      {
        zpk: {
          status: "active"
        }
      },
      {
        zpl: {
          status: "active"
        }
      },
      {
        zpm: {
          status: "active"
        }
      },
      {
        zpn: {
          status: "active"
        }
      },
      {
        zpo: {
          status: "active"
        }
      },
      {
        zpp: {
          status: "active"
        }
      },
      {
        zpq: {
          status: "active"
        }
      },
      {
        zpr: {
          status: "active"
        }
      },
      {
        zps: {
          status: "active"
        }
      },
      {
        zpt: {
          status: "active"
        }
      },
      {
        zpu: {
          status: "active"
        }
      },
      {
        zpv: {
          status: "active"
        }
      },
      {
        zpw: {
          status: "active"
        }
      },
      {
        zpx: {
          status: "active"
        }
      },
      {
        zpy: {
          status: "active"
        }
      },
      {
        zpz: {
          status: "active"
        }
      },
      {
        zsr: {
          status: "active"
        }
      },
      {
        ztc: {
          status: "retired"
        }
      },
      {
        zte: {
          status: "active"
        }
      },
      {
        ztg: {
          status: "active"
        }
      },
      {
        ztl: {
          status: "active"
        }
      },
      {
        ztm: {
          status: "active"
        }
      },
      {
        ztn: {
          status: "active"
        }
      },
      {
        ztp: {
          status: "active"
        }
      },
      {
        ztq: {
          status: "active"
        }
      },
      {
        zts: {
          status: "active"
        }
      },
      {
        ztt: {
          status: "active"
        }
      },
      {
        ztu: {
          status: "active"
        }
      },
      {
        ztx: {
          status: "active"
        }
      },
      {
        zty: {
          status: "active"
        }
      }
    ],
    zha: [
      {
        ccx: {
          status: "retired"
        }
      },
      {
        ccy: {
          status: "retired"
        }
      },
      {
        zch: {
          status: "active"
        }
      },
      {
        zeh: {
          status: "active"
        }
      },
      {
        zgb: {
          status: "active"
        }
      },
      {
        zgm: {
          status: "active"
        }
      },
      {
        zgn: {
          status: "active"
        }
      },
      {
        zhd: {
          status: "active"
        }
      },
      {
        zhn: {
          status: "active"
        }
      },
      {
        zlj: {
          status: "active"
        }
      },
      {
        zln: {
          status: "active"
        }
      },
      {
        zlq: {
          status: "active"
        }
      },
      {
        zqe: {
          status: "active"
        }
      },
      {
        zyb: {
          status: "active"
        }
      },
      {
        zyg: {
          status: "active"
        }
      },
      {
        zyj: {
          status: "active"
        }
      },
      {
        zyn: {
          status: "active"
        }
      },
      {
        zzj: {
          status: "active"
        }
      }
    ],
    zho: [
      {
        cdo: {
          status: "active"
        }
      },
      {
        cjy: {
          status: "active"
        }
      },
      {
        cmn: {
          status: "active"
        }
      },
      {
        cpx: {
          status: "active"
        }
      },
      {
        czh: {
          status: "active"
        }
      },
      {
        czo: {
          status: "active"
        }
      },
      {
        gan: {
          status: "active"
        }
      },
      {
        hak: {
          status: "active"
        }
      },
      {
        hsn: {
          status: "active"
        }
      },
      {
        lzh: {
          status: "active"
        }
      },
      {
        mnp: {
          status: "active"
        }
      },
      {
        nan: {
          status: "active"
        }
      },
      {
        wuu: {
          status: "active"
        }
      },
      {
        yue: {
          status: "active"
        }
      }
    ],
    zza: [
      {
        diq: {
          status: "active"
        }
      },
      {
        kiu: {
          status: "active"
        }
      }
    ]
  };

  // src/utils/config.ts
  function inferLanguage(str) {
    const langCode = mapISO6393to6391(franc(str, { minLength: 3 }));
    if (!langCode) {
      return {
        code: "",
        name: "Unknown"
      };
    }
    return matchLanguage(langCode);
  }
  function matchLanguage(str) {
    return LANG_CODE[LANG_CODE_INDEX_MAP[str.split("-")[0].split("_")[0].toLowerCase()]] || {
      code: "",
      name: "Unknown"
    };
  }
  var LANG_CODE = [
    { code: "af", name: "Afrikaans" },
    { code: "af-ZA", name: "Afrikaans (South Africa)" },
    { code: "sq", name: "Albanian" },
    { code: "sq-AL", name: "Albanian (Albania)" },
    { code: "am", name: "Amharic" },
    { code: "ar", name: "Arabic" },
    { code: "ar-DZ", name: "Arabic (Algeria)" },
    { code: "ar-BH", name: "Arabic (Bahrain)" },
    { code: "ar-EG", name: "Arabic (Egypt)" },
    { code: "ar-IQ", name: "Arabic (Iraq)" },
    { code: "ar-JO", name: "Arabic (Jordan)" },
    { code: "ar-KW", name: "Arabic (Kuwait)" },
    { code: "ar-LB", name: "Arabic (Lebanon)" },
    { code: "ar-LY", name: "Arabic (Libya)" },
    { code: "ar-MA", name: "Arabic (Morocco)" },
    { code: "ar-OM", name: "Arabic (Oman)" },
    { code: "ar-QA", name: "Arabic (Qatar)" },
    { code: "ar-SA", name: "Arabic (Saudi Arabia)" },
    { code: "ar-SY", name: "Arabic (Syria)" },
    { code: "ar-TN", name: "Arabic (Tunisia)" },
    { code: "ar-AE", name: "Arabic (U.A.E.)" },
    { code: "ar-YE", name: "Arabic (Yemen)" },
    { code: "hy", name: "Armenian" },
    { code: "hy-AM", name: "Armenian (Armenia)" },
    { code: "as", name: "Assamese" },
    { code: "ay", name: "Aymara" },
    { code: "az-AZ", name: "Azeri (Cyrillic) (Azerbaijan)" },
    { code: "az", name: "Azeri (Latin)" },
    { code: "az-AZ", name: "Azeri (Latin) (Azerbaijan)" },
    { code: "bm", name: "Bambara" },
    { code: "eu", name: "Basque" },
    { code: "eu-ES", name: "Basque (Spain)" },
    { code: "be", name: "Belarusian" },
    { code: "be-BY", name: "Belarusian (Belarus)" },
    { code: "bn", name: "Bengali" },
    { code: "bho", name: "Bhojpuri" },
    { code: "bs", name: "Bosnian" },
    { code: "bs-BA", name: "Bosnian (Bosnia and Herzegovina)" },
    { code: "bg", name: "Bulgarian" },
    { code: "bg-BG", name: "Bulgarian (Bulgaria)" },
    { code: "ca", name: "Catalan" },
    { code: "ca-ES", name: "Catalan (Spain)" },
    { code: "ceb", name: "Cebuano" },
    { code: "ny", name: "Chichewa" },
    { code: "zh", name: "Chinese" },
    { code: "zh-HK", name: "Chinese (Hong Kong)" },
    { code: "zh-MO", name: "Chinese (Macau)" },
    { code: "zh-CN", name: "Chinese (S)" },
    { code: "zh-SG", name: "Chinese (Singapore)" },
    { code: "zh-TW", name: "Chinese (T)" },
    { code: "co", name: "Corsican" },
    { code: "hr", name: "Croatian" },
    { code: "hr-BA", name: "Croatian (Bosnia and Herzegovina)" },
    { code: "hr-HR", name: "Croatian (Croatia)" },
    { code: "cs", name: "Czech" },
    { code: "cs-CZ", name: "Czech (Czech Republic)" },
    { code: "da", name: "Danish" },
    { code: "da-DK", name: "Danish (Denmark)" },
    { code: "dv", name: "Divehi" },
    { code: "dv-MV", name: "Divehi (Maldives)" },
    { code: "doi", name: "Dogri" },
    { code: "nl", name: "Dutch" },
    { code: "nl-BE", name: "Dutch (Belgium)" },
    { code: "nl-NL", name: "Dutch (Netherlands)" },
    { code: "en", name: "English" },
    { code: "en-AU", name: "English (Australia)" },
    { code: "en-BZ", name: "English (Belize)" },
    { code: "en-CA", name: "English (Canada)" },
    { code: "en-CB", name: "English (Caribbean)" },
    { code: "en-IE", name: "English (Ireland)" },
    { code: "en-JM", name: "English (Jamaica)" },
    { code: "en-NZ", name: "English (New Zealand)" },
    { code: "en-PH", name: "English (Republic of the Philippines)" },
    { code: "en-ZA", name: "English (South Africa)" },
    { code: "en-TT", name: "English (Trinidad and Tobago)" },
    { code: "en-GB", name: "English (United Kingdom)" },
    { code: "en-US", name: "English (United States)" },
    { code: "en-ZW", name: "English (Zimbabwe)" },
    { code: "eo", name: "Esperanto" },
    { code: "et", name: "Estonian" },
    { code: "et-EE", name: "Estonian (Estonia)" },
    { code: "ee", name: "Ewe" },
    { code: "fo", name: "Faroese" },
    { code: "fo-FO", name: "Faroese (Faroe Islands)" },
    { code: "fa", name: "Farsi" },
    { code: "fa-IR", name: "Farsi (Iran)" },
    { code: "fi", name: "Finnish" },
    { code: "fi-FI", name: "Finnish (Finland)" },
    { code: "fr", name: "French" },
    { code: "fr-BE", name: "French (Belgium)" },
    { code: "fr-CA", name: "French (Canada)" },
    { code: "fr-FR", name: "French (France)" },
    { code: "fr-LU", name: "French (Luxembourg)" },
    { code: "fr-MC", name: "French (Principality of Monaco)" },
    { code: "fr-CH", name: "French (Switzerland)" },
    { code: "fy", name: "Frisian" },
    { code: "mk", name: "FYRO Macedonian" },
    {
      code: "mk-MK",
      name: "FYRO Macedonian (Former Yugoslav Republic of Macedonia)"
    },
    { code: "gl", name: "Galician" },
    { code: "gl-ES", name: "Galician (Spain)" },
    { code: "ka", name: "Georgian" },
    { code: "ka-GE", name: "Georgian (Georgia)" },
    { code: "de", name: "German" },
    { code: "de-AT", name: "German (Austria)" },
    { code: "de-DE", name: "German (Germany)" },
    { code: "de-LI", name: "German (Liechtenstein)" },
    { code: "de-LU", name: "German (Luxembourg)" },
    { code: "de-CH", name: "German (Switzerland)" },
    { code: "el", name: "Greek" },
    { code: "el-GR", name: "Greek (Greece)" },
    { code: "gn", name: "Guarani" },
    { code: "gu", name: "Gujarati" },
    { code: "gu-IN", name: "Gujarati (India)" },
    { code: "ht", name: "Haitian Creole" },
    { code: "ha", name: "Hausa" },
    { code: "haw", name: "Hawaiian" },
    { code: "he", name: "Hebrew" },
    { code: "iw", name: "Hebrew" },
    { code: "he-IL", name: "Hebrew (Israel)" },
    { code: "hi", name: "Hindi" },
    { code: "hi-IN", name: "Hindi (India)" },
    { code: "hmn", name: "Hmong" },
    { code: "hu", name: "Hungarian" },
    { code: "hu-HU", name: "Hungarian (Hungary)" },
    { code: "is", name: "Icelandic" },
    { code: "is-IS", name: "Icelandic (Iceland)" },
    { code: "ig", name: "Igbo" },
    { code: "ilo", name: "Ilocano" },
    { code: "id", name: "Indonesian" },
    { code: "id-ID", name: "Indonesian (Indonesia)" },
    { code: "ga", name: "Irish" },
    { code: "it", name: "Italian" },
    { code: "it-IT", name: "Italian (Italy)" },
    { code: "it-CH", name: "Italian (Switzerland)" },
    { code: "ja", name: "Japanese" },
    { code: "ja-JP", name: "Japanese (Japan)" },
    { code: "jw", name: "Javanese" },
    { code: "kn", name: "Kannada" },
    { code: "kn-IN", name: "Kannada (India)" },
    { code: "kk", name: "Kazakh" },
    { code: "kk-KZ", name: "Kazakh (Kazakhstan)" },
    { code: "km", name: "Khmer" },
    { code: "rw", name: "Kinyarwanda" },
    { code: "kok", name: "Konkani" },
    { code: "gom", name: "Konkani" },
    { code: "kok-IN", name: "Konkani (India)" },
    { code: "ko", name: "Korean" },
    { code: "ko-KR", name: "Korean (Korea)" },
    { code: "kri", name: "Krio" },
    { code: "ku", name: "Kurdish (Kurmanji)" },
    { code: "ckb", name: "Kurdish (Sorani)" },
    { code: "ky", name: "Kyrgyz" },
    { code: "ky-KG", name: "Kyrgyz (Kyrgyzstan)" },
    { code: "lo", name: "Lao" },
    { code: "la", name: "Latin" },
    { code: "lv", name: "Latvian" },
    { code: "lv-LV", name: "Latvian (Latvia)" },
    { code: "ln", name: "Lingala" },
    { code: "lt", name: "Lithuanian" },
    { code: "lt-LT", name: "Lithuanian (Lithuania)" },
    { code: "lg", name: "Luganda" },
    { code: "lb", name: "Luxembourgish" },
    { code: "mai", name: "Maithili" },
    { code: "mg", name: "Malagasy" },
    { code: "ms", name: "Malay" },
    { code: "ms-BN", name: "Malay (Brunei Darussalam)" },
    { code: "ms-MY", name: "Malay (Malaysia)" },
    { code: "ml", name: "Malayalam" },
    { code: "mt", name: "Maltese" },
    { code: "mt-MT", name: "Maltese (Malta)" },
    { code: "mi", name: "Maori" },
    { code: "mi-NZ", name: "Maori (New Zealand)" },
    { code: "mr", name: "Marathi" },
    { code: "mr-IN", name: "Marathi (India)" },
    { code: "mni-Mtei", name: "Meiteilon (Manipuri)" },
    { code: "lus", name: "Mizo" },
    { code: "mn", name: "Mongolian" },
    { code: "mn-MN", name: "Mongolian (Mongolia)" },
    { code: "my", name: "Myanmar (Burmese)" },
    { code: "ne", name: "Nepali" },
    { code: "ns", name: "Northern Sotho" },
    { code: "ns-ZA", name: "Northern Sotho (South Africa)" },
    { code: "no", name: "Norwegian" },
    { code: "nb", name: "Norwegian (Bokm?l)" },
    { code: "nb-NO", name: "Norwegian (Bokm?l) (Norway)" },
    { code: "nn-NO", name: "Norwegian (Nynorsk) (Norway)" },
    { code: "or", name: "Odia (Oriya)" },
    { code: "om", name: "Oromo" },
    { code: "pli", name: "Pali" },
    { code: "ps", name: "Pashto" },
    { code: "ps-AR", name: "Pashto (Afghanistan)" },
    { code: "pl", name: "Polish" },
    { code: "pl-PL", name: "Polish (Poland)" },
    { code: "pt", name: "Portuguese" },
    { code: "pt-BR", name: "Portuguese (Brazil)" },
    { code: "pt-PT", name: "Portuguese (Portugal)" },
    { code: "pa", name: "Punjabi" },
    { code: "pa-IN", name: "Punjabi (India)" },
    { code: "qu", name: "Quechua" },
    { code: "qu-BO", name: "Quechua (Bolivia)" },
    { code: "qu-EC", name: "Quechua (Ecuador)" },
    { code: "qu-PE", name: "Quechua (Peru)" },
    { code: "ro", name: "Romanian" },
    { code: "ro-RO", name: "Romanian (Romania)" },
    { code: "ru", name: "Russian" },
    { code: "ru-RU", name: "Russian (Russia)" },
    { code: "se-FI", name: "Sami (Inari) (Finland)" },
    { code: "se-NO", name: "Sami (Lule) (Norway)" },
    { code: "se-SE", name: "Sami (Lule) (Sweden)" },
    { code: "se", name: "Sami (Northern)" },
    { code: "se-FI", name: "Sami (Northern) (Finland)" },
    { code: "se-NO", name: "Sami (Northern) (Norway)" },
    { code: "se-SE", name: "Sami (Northern) (Sweden)" },
    { code: "se-FI", name: "Sami (Skolt) (Finland)" },
    { code: "se-NO", name: "Sami (Southern) (Norway)" },
    { code: "se-SE", name: "Sami (Southern) (Sweden)" },
    { code: "sm", name: "Samoan" },
    { code: "sa", name: "Sanskrit" },
    { code: "sa-IN", name: "Sanskrit (India)" },
    { code: "gd", name: "Scots Gaelic" },
    { code: "nso", name: "Sepedi" },
    { code: "sr", name: "Serbian" },
    { code: "sr-BA", name: "Serbian (Cyrillic) (Bosnia and Herzegovina)" },
    { code: "sr-SP", name: "Serbian (Cyrillic) (Serbia and Montenegro)" },
    { code: "sr-BA", name: "Serbian (Latin) (Bosnia and Herzegovina)" },
    { code: "sr-SP", name: "Serbian (Latin) (Serbia and Montenegro)" },
    { code: "st", name: "Sesotho" },
    { code: "sn", name: "Shona" },
    { code: "sd", name: "Sindhi" },
    { code: "si", name: "Sinhala" },
    { code: "sk", name: "Slovak" },
    { code: "sk-SK", name: "Slovak (Slovakia)" },
    { code: "sl", name: "Slovenian" },
    { code: "sl-SI", name: "Slovenian (Slovenia)" },
    { code: "so", name: "Somali" },
    { code: "es", name: "Spanish" },
    { code: "es-AR", name: "Spanish (Argentina)" },
    { code: "es-BO", name: "Spanish (Bolivia)" },
    { code: "es-ES", name: "Spanish (Castilian)" },
    { code: "es-CL", name: "Spanish (Chile)" },
    { code: "es-CO", name: "Spanish (Colombia)" },
    { code: "es-CR", name: "Spanish (Costa Rica)" },
    { code: "es-DO", name: "Spanish (Dominican Republic)" },
    { code: "es-EC", name: "Spanish (Ecuador)" },
    { code: "es-SV", name: "Spanish (El Salvador)" },
    { code: "es-GT", name: "Spanish (Guatemala)" },
    { code: "es-HN", name: "Spanish (Honduras)" },
    { code: "es-MX", name: "Spanish (Mexico)" },
    { code: "es-NI", name: "Spanish (Nicaragua)" },
    { code: "es-PA", name: "Spanish (Panama)" },
    { code: "es-PY", name: "Spanish (Paraguay)" },
    { code: "es-PE", name: "Spanish (Peru)" },
    { code: "es-PR", name: "Spanish (Puerto Rico)" },
    { code: "es-ES", name: "Spanish (Spain)" },
    { code: "es-UY", name: "Spanish (Uruguay)" },
    { code: "es-VE", name: "Spanish (Venezuela)" },
    { code: "su", name: "Sundanese" },
    { code: "sw", name: "Swahili" },
    { code: "sw-KE", name: "Swahili (Kenya)" },
    { code: "sv", name: "Swedish" },
    { code: "sv-FI", name: "Swedish (Finland)" },
    { code: "sv-SE", name: "Swedish (Sweden)" },
    { code: "syr", name: "Syriac" },
    { code: "syr-SY", name: "Syriac (Syria)" },
    { code: "tl", name: "Tagalog" },
    { code: "tl-PH", name: "Tagalog (Philippines)" },
    { code: "tg", name: "Tajik" },
    { code: "ta", name: "Tamil" },
    { code: "ta-IN", name: "Tamil (India)" },
    { code: "tt", name: "Tatar" },
    { code: "tt-RU", name: "Tatar (Russia)" },
    { code: "te", name: "Telugu" },
    { code: "te-IN", name: "Telugu (India)" },
    { code: "th", name: "Thai" },
    { code: "th-TH", name: "Thai (Thailand)" },
    { code: "bo", name: "Tibetan" },
    { code: "ti", name: "Tigrinya" },
    { code: "ts", name: "Tsonga" },
    { code: "tn", name: "Tswana" },
    { code: "tn-ZA", name: "Tswana (South Africa)" },
    { code: "tr", name: "Turkish" },
    { code: "tr-TR", name: "Turkish (Turkey)" },
    { code: "tk", name: "Turkmen" },
    { code: "ak", name: "Twi" },
    { code: "uk", name: "Ukrainian" },
    { code: "uk-UA", name: "Ukrainian (Ukraine)" },
    { code: "ur", name: "Urdu" },
    { code: "ur-PK", name: "Urdu (Islamic Republic of Pakistan)" },
    { code: "ug", name: "Uyghur" },
    { code: "uz-UZ", name: "Uzbek (Cyrillic) (Uzbekistan)" },
    { code: "uz", name: "Uzbek (Latin)" },
    { code: "uz-UZ", name: "Uzbek (Latin) (Uzbekistan)" },
    { code: "vi", name: "Vietnamese" },
    { code: "vi-VN", name: "Vietnamese (Viet Nam)" },
    { code: "cy", name: "Welsh" },
    { code: "cy-GB", name: "Welsh (United Kingdom)" },
    { code: "xh", name: "Xhosa" },
    { code: "xh-ZA", name: "Xhosa (South Africa)" },
    { code: "yi", name: "Yiddish" },
    { code: "yo", name: "Yoruba" },
    { code: "zu", name: "Zulu" },
    { code: "zu-ZA", name: "Zulu (South Africa)" }
  ];
  var MACRO_LANG_MAP = Object.entries(iso639_3_macrolanguages_default).reduce(
    (prev, [curr, items]) => {
      items.forEach((macroLang) => {
        Object.keys(macroLang).forEach((macroLangCode) => {
          prev[macroLangCode] = curr;
        });
      });
      return prev;
    },
    {}
  );
  var LANG_CODE_INDEX_MAP = LANG_CODE.reduce(
    (acc, cur, index) => {
      const code = cur.code.split("-")[0];
      if (acc[code]) {
        return acc;
      }
      acc[cur.code] = index;
      return acc;
    },
    {}
  );
  function mapISO6393to6391(code) {
    return alpha3to2mapping_default[code] || alpha3to2mapping_default[MACRO_LANG_MAP[code]] || void 0;
  }
  var SVGIcon = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
viewBox="0 0 16 16" style="enable-background:new 0 0 16 16;" width="16" height="16" xml:space="preserve">
<style type="text/css">
.st0{fill:#64B5F6;}
.st1{fill:#1E88E5;}
</style>
<g>
<path class="st0" d="M4.4,11.1h1.4c0.1,0,0.2-0.1,0.1-0.2L5.2,8.7c0-0.1-0.2-0.1-0.3,0l-0.7,2.2C4.2,11,4.3,11.1,4.4,11.1L4.4,11.1
 z M4.4,11.1"/>
<path class="st0" d="M8.8,5H1.4C0.6,5,0,5.7,0,6.4v8.2C0,15.4,0.6,16,1.4,16h7.4c0.8,0,1.4-0.6,1.4-1.4V6.4C10.2,5.7,9.5,5,8.8,5
 L8.8,5z M7.9,14.2c-0.1,0.1-0.2,0.2-0.3,0.2c0,0-0.1,0-0.1,0c-0.1,0-0.1,0-0.2,0C7,14.3,7,14.2,7,14.1l-0.6-1.9
 C6.3,12,6.2,12,6.1,12H4c-0.1,0-0.1,0-0.2,0.1l-0.6,2c-0.1,0.1-0.1,0.2-0.3,0.3c-0.1,0.1-0.3,0.1-0.4,0.1c-0.2,0-0.3-0.1-0.3-0.2
 c0-0.1-0.1-0.2,0-0.4l2.1-6.4c0.1-0.3,0.4-0.5,0.7-0.5h0c0.3,0,0.6,0.2,0.7,0.5l0,0l2.1,6.5C8,14,8,14.1,7.9,14.2L7.9,14.2z
  M7.9,14.2"/>
<path class="st1" d="M14.3,0H7.5C6.6,0,5.8,0.8,5.8,1.7v2.1C5.8,4,6,4.1,6.1,4.1H8c0.3,0,0.5,0,0.7,0.1C8.6,3.9,8.6,3.7,8.5,3.4
 H7.6C7.4,3.4,7.3,3.3,7.3,3c0-0.3,0.1-0.5,0.3-0.5h2.8c-0.1-0.3-0.2-0.5-0.2-0.7c0-0.2,0.1-0.4,0.3-0.5c0.3-0.1,0.4,0,0.6,0.2
 c0,0.1,0.1,0.3,0.2,0.6c0.1,0.2,0.1,0.4,0.1,0.4h2.4c0.3,0,0.4,0.2,0.4,0.5c0,0.3-0.1,0.5-0.4,0.5h-0.6c-0.1,0-0.1,0-0.1,0
 C12.8,4.9,12.3,6,11.6,7c0.6,0.5,1.3,0.9,2.3,1.3c0.3,0.1,0.3,0.3,0.3,0.6c-0.1,0.2-0.3,0.3-0.6,0.2c-0.9-0.3-1.8-0.8-2.5-1.3v2.9
 c0,0.2,0.1,0.3,0.3,0.3h3c0.9,0,1.7-0.8,1.7-1.7V1.7C16,0.8,15.2,0,14.3,0L14.3,0z M14.3,0"/>
<path class="st1" d="M12,3.4H9.6c-0.1,0-0.2,0.1-0.1,0.2C9.6,4,9.7,4.4,9.9,4.8c0,0,0,0,0,0.1c0.4,0.3,0.7,0.8,0.9,1.2
 c0.2,0,0.1,0,0.3,0c0.5-0.8,0.9-1.6,1.1-2.5C12.1,3.5,12.1,3.4,12,3.4L12,3.4z M12,3.4"/>
</g>
</svg>`;

  // src/modules/preferenceWindow.ts
  init_locale();
  init_prefs();

  // src/utils/secret.ts
  init_prefs();
  function getServiceSecret(serviceId) {
    try {
      return getPrefJSON("secretObj")[serviceId] || "";
    } catch (e) {
      setPref("secretObj", "{}");
      return "";
    }
  }
  function setServiceSecret(serviceId, secret) {
    let secrets;
    try {
      secrets = getPrefJSON("secretObj");
    } catch (e) {
      secrets = {};
    }
    secrets[serviceId] = secret.trim();
    setPref("secretObj", JSON.stringify(secrets));
  }
  function validateServiceSecret(serviceId, validateCallback) {
    const secret = getServiceSecret(serviceId);
    const service = addon.data.translate.services.getServiceById(serviceId);
    const validator = service?.secretValidator;
    if (!validator) {
      return { secret, status: true, info: "" };
    }
    const validateResult = validator(secret);
    if (validateCallback) {
      validateCallback(validateResult);
    }
    return validateResult;
  }

  // src/utils/crypto.ts
  function base64(buffer) {
    const str = String.fromCharCode(...new Uint8Array(buffer));
    return ztoolkit.getGlobal("btoa")(str);
  }
  function randomString(length) {
    const baseLen = Math.ceil(length / 4) * 3;
    const random = crypto.getRandomValues(new Uint8Array(baseLen));
    return base64(random).substring(0, length);
  }
  function hex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function hmacSha1Digest(stringToSign, secretKey) {
    const enc = new TextEncoder();
    let keyData;
    if (typeof secretKey === "string") {
      keyData = enc.encode(secretKey).buffer;
    } else {
      keyData = secretKey;
    }
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: "SHA-1"
      },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", key, enc.encode(stringToSign));
  }
  async function hmacSha256Digest(stringToSign, secretKey) {
    const enc = new TextEncoder();
    let keyData;
    if (typeof secretKey === "string") {
      keyData = enc.encode(secretKey).buffer;
    } else {
      keyData = secretKey;
    }
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", key, enc.encode(stringToSign));
  }
  async function sha256Digest(message) {
    const enc = new TextEncoder();
    return crypto.subtle.digest("SHA-256", enc.encode(message));
  }
  function pkcs7Pad(block) {
    const padding = 16 - block.length;
    const pad = new Uint8Array(padding);
    pad.fill(padding);
    return new Uint8Array([...block, ...pad]);
  }
  async function aesEcbEncrypt(message, secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "AES-CBC"
      },
      false,
      ["encrypt"]
    );
    const encodeStr = new TextEncoder().encode(message);
    const blocks = [];
    for (let i = 0; i < encodeStr.length; i += 16) {
      const block = encodeStr.subarray(i, i + 16);
      blocks.push(block);
    }
    if (!blocks.length || blocks[blocks.length - 1].length === 16) {
      blocks.push(pkcs7Pad([]));
    } else {
      blocks[blocks.length - 1] = pkcs7Pad(blocks[blocks.length - 1]);
    }
    const zeros = new Uint8Array(16);
    const encryptedBlocks = await Promise.all(
      blocks.map(
        (block) => crypto.subtle.encrypt(
          {
            name: "AES-CBC",
            iv: block
          },
          key,
          zeros
        )
      )
    );
    const encrypted = new Uint8Array(encryptedBlocks.length * 16);
    let offset = 0;
    for (const block of encryptedBlocks) {
      encrypted.set(new Uint8Array(block).subarray(0, 16), offset);
      offset += 16;
    }
    return encrypted;
  }

  // src/utils/llmPrompt.ts
  init_prefs();
  function transformPromptWithContext(prefKey, langFrom, langTo, sourceText, data2) {
    let prompt = getPref(prefKey);
    if (getPref("attachPaperContext") && data2.itemId) {
      const item = Zotero.Items.get(data2.itemId);
      const topItem = item ? Zotero.Items.getTopLevel([item])[0] : null;
      if (topItem) {
        let contextInfo = "";
        const title = topItem.getField("title");
        const abstract = topItem.getField("abstractNote");
        if (title) {
          contextInfo += `Paper Title: ${title}`;
        }
        if (abstract) {
          contextInfo += title ? `

Paper Abstract: ${abstract}` : `Paper Abstract: ${abstract}`;
        }
        if (contextInfo) {
          prompt = prompt.replace(
            "${sourceText}",
            `Context from the academic paper:
${contextInfo}

Text to translate: ${sourceText}`
          );
        }
      }
    }
    return prompt.replaceAll("${langFrom}", langFrom).replaceAll("${langTo}", langTo).replaceAll("${sourceText}", sourceText);
  }

  // src/utils/index.ts
  init_locale();
  init_prefs();

  // src/utils/str.ts
  init_locale();
  function slice(str, len) {
    return str.length > len ? `${str.slice(0, len - 3)}...` : str;
  }
  function stripEmptyLines(text, enabled) {
    if (!text || !enabled) return text;
    const processedText = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    const errorPrefix = getString("service-errorPrefix");
    if (processedText.includes(errorPrefix)) {
      return processedText;
    } else {
      const normalizedText = processedText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const result = normalizedText.replace(/^\n+/, "").replace(/\n+/g, " ");
      return result;
    }
  }

  // src/utils/task.ts
  init_locale();
  init_prefs();
  init_package();
  var TranslateError = class extends Error {
  };
  function maskAccessToken(token) {
    if (!token) return token;
    const length = token.length;
    if (length <= 2) return "*".repeat(length);
    const visible = length <= 6 ? 1 : 3;
    const maskedLength = length - visible * 2;
    if (maskedLength <= 0) {
      return "*".repeat(length);
    }
    return `${token.slice(0, visible)}${"*".repeat(maskedLength)}${token.slice(
      length - visible
    )}`;
  }
  function sanitizeTaskForLog(task) {
    return {
      ...task,
      ...task.secret ? { secret: maskAccessToken(task.secret) } : {},
      extraTasks: (task.extraTasks ?? []).map(
        (extraTask) => sanitizeTaskForLog(extraTask)
      )
    };
  }
  var TranslateTaskRunner = class {
    processor;
    constructor(processor) {
      this.processor = processor;
    }
    async run(data2) {
      const addon2 = Zotero[config.addonInstance];
      const ztoolkit2 = addon2.data.ztoolkit;
      if (!data2.langfrom || !data2.langto) {
        ztoolkit2.log("try auto detect language");
        const { fromLanguage, toLanguage, isInferred } = autoDetectLanguage(
          Zotero.Items.get(data2.itemId || -1)
        );
        data2.langfrom = data2.langfrom || fromLanguage;
        data2.langto = data2.langto || toLanguage;
        if (isInferred) {
          data2.langfromInferred = true;
        }
      }
      if (data2.processed) {
        updateTranslateTaskLang(data2);
      }
      data2.callerID = data2.callerID || config.addonID;
      data2.secret = getServiceSecret(data2.service);
      data2.status = "processing";
      try {
        ztoolkit2.log(sanitizeTaskForLog(data2));
        await this.processor(data2);
        data2.status = "success";
      } catch (e) {
        if (e instanceof TranslateError) {
          data2.result = e.message;
        } else {
          data2.result = this.makeErrorInfo(data2.service, String(e));
        }
        data2.status = "fail";
      }
      data2.processed = true;
    }
    makeErrorInfo(serviceId, detail) {
      return `${getString("service-errorPrefix")} ${getString(
        `service-${serviceId}`
      )}

${detail}`;
    }
  };
  function addTranslateTask(raw, itemId, type, service) {
    if (!raw) {
      return;
    }
    const addon2 = Zotero[config.addonInstance];
    type = type || "text";
    raw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/gu, " ").normalize("NFKC");
    const isConcatMode = type === "text" && (addon2.data.translate.concatCheckbox || getPref("enableConcatKey") && addon2.data.translate.concatKey);
    const lastTask = getLastTranslateTask({ type: "text" });
    if (isConcatMode && lastTask) {
      lastTask.raw += " " + raw;
      lastTask.extraTasks.forEach((extraTask) => extraTask.raw += " " + raw);
      lastTask.status = "waiting";
      putTranslateTaskAtHead(lastTask.id);
      return;
    }
    const newTask = {
      id: `${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`,
      type,
      raw,
      result: "",
      audio: [],
      service: "",
      candidateServices: [],
      itemId,
      status: "waiting",
      extraTasks: []
    };
    if (!service) {
      setDefaultService(newTask);
    } else {
      newTask.service = service;
    }
    addon2.data.translate.queue.push(newTask);
    if (type === "text" && addon2.data.panel.windowPanel && !addon2.data.panel.windowPanel.closed) {
      getPref("extraEngines").split(",").filter((s) => s).forEach(
        (extraService) => newTask.extraTasks.push({
          id: `${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`,
          type: "text",
          raw,
          result: "",
          audio: [],
          service: extraService,
          candidateServices: [],
          extraTasks: [],
          itemId,
          status: "waiting"
        })
      );
    }
    cleanTasks();
    return newTask;
  }
  function addTranslateAnnotationTask(itemIDOrLibraryID, itemKey) {
    let item;
    if (itemKey) {
      item = Zotero.Items.getByLibraryAndKey(
        itemIDOrLibraryID,
        itemKey
      );
    } else {
      item = Zotero.Items.get(itemIDOrLibraryID);
    }
    if (!item) {
      return;
    }
    return addTranslateTask(item.annotationText, item.id, "annotation");
  }
  function addTranslateTitleTask(itemId, skipIfExists = false) {
    const addon2 = Zotero[config.addonInstance];
    const ztoolkit2 = addon2.data.ztoolkit;
    const item = Zotero.Items.get(itemId);
    if (item?.isRegularItem() && !(skipIfExists && ztoolkit2.ExtraField.getExtraField(item, "titleTranslation"))) {
      return addTranslateTask(item.getField("title"), item.id, "title");
    }
  }
  function addTranslateAbstractTask(itemId, skipIfExists = false) {
    const addon2 = Zotero[config.addonInstance];
    const ztoolkit2 = addon2.data.ztoolkit;
    const item = Zotero.Items.get(itemId);
    if (item?.isRegularItem() && !(skipIfExists && ztoolkit2.ExtraField.getExtraField(item, "abstractTranslation"))) {
      return addTranslateTask(
        item.getField("abstractNote"),
        item.id,
        "abstract"
      );
    }
  }
  var segmenter = new Intl.Segmenter(void 0, { granularity: "word" });
  function setDefaultService(task) {
    if (getPref("enableDict")) {
      let wordCount = 0;
      for (const s of segmenter.segment(task.raw.trim())) {
        if (s.isWordLike) {
          if (wordCount >= 1) {
            wordCount = 2;
            break;
          }
          wordCount = 1;
        }
      }
      if (wordCount === 1) {
        task.service = getPref("dictSource");
        task.candidateServices.push(getPref("translateSource"));
      } else {
        task.service = getPref("translateSource");
      }
    } else {
      task.service = getPref("translateSource");
    }
    task.service = task.service || addon.data.translate.services.getAllServices()[0].id;
  }
  function cleanTasks() {
    const addon2 = Zotero[config.addonInstance];
    if (addon2.data.translate.queue.length > addon2.data.translate.maximumQueueLength) {
      addon2.data.translate.queue.splice(
        0,
        Math.floor(addon2.data.translate.maximumQueueLength / 3)
      );
    }
  }
  function getLastTranslateTask(conditions) {
    const queue = Zotero[config.addonInstance].data.translate.queue;
    let i = queue.length - 1;
    while (i >= 0) {
      const currentTask = queue[i];
      const notMatchConditions = conditions && Object.keys(conditions).map((key) => currentTask[key] === conditions[key]).includes(false);
      if (!notMatchConditions) {
        return queue[i];
      }
      i--;
    }
    return void 0;
  }
  function updateTranslateTaskLang(task) {
    if (!task.langfromInferred) {
      task.langfrom = getPref("sourceLanguage");
    }
    task.langto = getPref("targetLanguage");
  }
  function putTranslateTaskAtHead(taskId) {
    const queue = Zotero[config.addonInstance].data.translate.queue;
    const idx = queue.findIndex((task) => task.id === taskId);
    if (idx >= 0) {
      const targetTask = queue.splice(idx, 1)[0];
      queue.push(targetTask);
      return true;
    }
    return false;
  }
  function autoDetectLanguage(item) {
    if (!item) {
      return {
        fromLanguage: getPref("sourceLanguage"),
        toLanguage: getPref("targetLanguage")
      };
    }
    const addon2 = Zotero[config.addonInstance];
    const ztoolkit2 = addon2.data.ztoolkit;
    const topItem = Zotero.Items.getTopLevel([item])[0];
    const fromLanguage = getPref("sourceLanguage");
    const toLanguage = getPref("targetLanguage");
    let detectedFromLanguage = fromLanguage;
    const sourceLanguageCache = addon2.data.translate.cachedSourceLanguage[item.id];
    if (sourceLanguageCache && sourceLanguageCache !== toLanguage) {
      return {
        fromLanguage: sourceLanguageCache,
        toLanguage
      };
    }
    let isInferred = false;
    if (getPref("enableAutoDetectLanguage")) {
      if (topItem) {
        let itemLanguage = (
          // Respect language field
          matchLanguage(topItem.getField("language") || "").code
        );
        ztoolkit2.log("try itemLanguage", itemLanguage);
        if (!itemLanguage) {
          const inferredLanguage = inferLanguage(
            topItem.getField("abstractNote") || topItem.getField("title") || ""
          ).code;
          ztoolkit2.log("try inferredLanguage", inferredLanguage);
          if (inferredLanguage) {
            itemLanguage = inferredLanguage;
            if (topItem.isRegularItem()) {
              topItem.setField("language", fromLanguage);
            }
          }
        }
        const itemLanguageMajor = itemLanguage.split("-")[0];
        if (itemLanguage && ![fromLanguage, toLanguage].find(
          (lang) => lang.split("-")[0] === itemLanguageMajor
        )) {
          ztoolkit2.log("use autoDetect", itemLanguage);
          detectedFromLanguage = itemLanguage;
          isInferred = true;
        }
      }
    }
    return {
      fromLanguage: detectedFromLanguage,
      toLanguage,
      isInferred
    };
  }

  // src/utils/window.ts
  function isWindowAlive(win) {
    return win && !Components.utils.isDeadWrapper(win) && !win.closed;
  }

  // src/utils/ztoolkit.ts
  init_package();
  function createZToolkit() {
    const _ztoolkit = new MyToolkit();
    initZToolkit(_ztoolkit);
    return _ztoolkit;
  }
  function initZToolkit(_ztoolkit) {
    const env = "production";
    _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
    _ztoolkit.basicOptions.log.disableConsole = env === "production";
    _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = false;
    _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = false;
    _ztoolkit.basicOptions.debug.disableDebugBridgePassword = false;
    _ztoolkit.basicOptions.api.pluginID = config.addonID;
    _ztoolkit.ProgressWindow.setIconURI(
      "default",
      `chrome://${config.addonRef}/content/icons/favicon.png`
    );
  }
  var MyToolkit = class extends BasicTool {
    UI;
    ExtraField;
    FieldHook;
    Keyboard;
    Prompt;
    Dialog;
    SettingsDialog;
    ProgressWindow;
    Clipboard;
    constructor() {
      super();
      this.UI = new UITool(this);
      this.ExtraField = new ExtraFieldTool(this);
      this.FieldHook = new FieldHookManager(this);
      this.Keyboard = new KeyboardManager(this);
      this.Prompt = new PromptManager(this);
      this.Dialog = makeHelperTool(DialogHelper, this);
      this.SettingsDialog = makeHelperTool(SettingsDialogHelper, this);
      this.ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
      this.Clipboard = makeHelperTool(ClipboardHelper, this);
    }
    unregisterAll() {
      unregister(this);
    }
  };

  // src/utils/settingsDialog.ts
  init_prefs();
  init_locale();
  var ServiceSettingsDialog = class extends SettingsDialogHelper {
    constructor() {
      super();
      this.setSettingHandlers(getPref, setPref);
    }
    addTextSetting(field) {
      return this.addSetting(getString(field.nameKey), field.prefKey, {
        tag: "input",
        attributes: {
          type: field.inputType || "text",
          placeholder: field.placeholder || ""
        },
        styles: {
          minWidth: "400px"
        }
      });
    }
    addPasswordSetting(field) {
      return this.addSetting(getString(field.nameKey), field.prefKey, {
        tag: "input",
        attributes: {
          type: "password"
        },
        styles: {
          minWidth: "400px"
        }
      });
    }
    addNumberSetting(field) {
      return this.addSetting(getString(field.nameKey), field.prefKey, {
        tag: "input",
        attributes: {
          type: "number",
          min: field.min || 0,
          max: field.max || 100,
          step: field.step || 1
        },
        styles: {
          minWidth: "400px"
        }
      });
    }
    addCheckboxSetting(field) {
      return this.addSetting(
        getString(field.nameKey),
        field.prefKey,
        {
          tag: "input",
          attributes: {
            type: "checkbox"
          },
          styles: {
            justifySelf: "start"
          }
        },
        {
          valueType: "boolean"
        }
      );
    }
    addSelectSetting(field) {
      return this.addSetting(getString(field.nameKey), field.prefKey, {
        tag: "select",
        children: field.options.map(({ label, value }) => ({
          tag: "option",
          properties: {
            innerHTML: label,
            value
          }
        })),
        styles: {
          minWidth: "400px",
          // auto resize to window width
          width: "-moz-available"
        }
      });
    }
    addTextAreaSetting(field) {
      return this.addSetting(getString(field.nameKey), field.prefKey, {
        tag: "textarea",
        attributes: {
          placeholder: field.placeholder,
          rows: 5
        },
        styles: {
          minWidth: "400px"
        }
      });
    }
    addCustomParamsSetting(field) {
      return this.addButton(getString(field.nameKey), field.prefKey, {
        noClose: true,
        callback(ev) {
          openCustomRequestDialog(field.prefKey);
        }
      });
    }
    validater;
    onSaveCallback;
    onSave(validate) {
      this.validater = validate;
      return this;
    }
  };
  async function createServiceSettingsDialog(service) {
    const dialog = new ServiceSettingsDialog();
    if (service.config) {
      service.config(dialog);
    }
    const { id, helpUrl } = service;
    if (helpUrl) {
      dialog.addButton(getString(`service-dialog-help`), "help", {
        noClose: true,
        callback: async () => {
          await Zotero.launchURL(helpUrl);
        }
      });
    }
    const serviceName = service.name || getString(`service-${id}`);
    dialog.addButton(getString(`service-dialog-close`), "close").addAutoSaveButton(getString(`service-dialog-save`), "save", {
      // https://github.com/windingwind/zotero-plugin-toolkit/issues/87
      validate: dialog.validater
    }).open(
      getString(`service-dialog-title`, {
        args: { service: serviceName }
      })
    );
  }
  var CUSTOM_PARAMS_INPUT_STYLES = {
    width: "100%",
    height: "32px",
    padding: "6px 8px",
    boxSizing: "border-box",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    fontSize: "1rem"
  };
  function createParamInputCell(doc, type, index, value = "") {
    const cell = doc.createElement("td");
    cell.style.padding = "8px";
    const input = doc.createElement("input");
    input.type = "text";
    input.id = `${type}-${index}`;
    input.placeholder = type === "key" ? getString("service-dialog-custom-request-parameter-name-placeholder") : getString("service-dialog-custom-request-parameter-value-placeholder");
    input.value = value;
    Object.assign(input.style, CUSTOM_PARAMS_INPUT_STYLES);
    cell.appendChild(input);
    return cell;
  }
  function parseCustomParamsFromDialog(doc) {
    const params = {};
    const errors = [];
    const seenKeys = /* @__PURE__ */ new Set();
    let index = 0;
    while (true) {
      const keyElement = doc.getElementById(`key-${index}`);
      const valueElement = doc.getElementById(
        `value-${index}`
      );
      if (!keyElement || !valueElement) break;
      const key = keyElement.value.trim();
      const valueRaw = valueElement.value.trim();
      if (!key) {
        index++;
        continue;
      }
      if (seenKeys.has(key)) {
        errors.push({ kind: "duplicate", key });
        index++;
        continue;
      }
      seenKeys.add(key);
      if (!valueRaw) {
        errors.push({ kind: "empty", key });
        index++;
        continue;
      }
      try {
        params[key] = JSON.parse(valueRaw);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ kind: "invalid", key, detail: msg });
      }
      index++;
    }
    return { params, errors };
  }
  function formatCustomParamsValidationMessage(errors) {
    const objectExample = '{"enable_thinking": false}';
    const lines = [
      getString("service-dialog-custom-request-validation-summary"),
      "",
      getString("service-dialog-custom-request-validation-errors-head")
    ];
    for (const error of errors) {
      switch (error.kind) {
        case "duplicate":
          lines.push(
            getString(
              "service-dialog-custom-request-validation-error-duplicate",
              {
                args: { key: error.key }
              }
            )
          );
          break;
        case "empty":
          lines.push(
            getString("service-dialog-custom-request-validation-error-empty", {
              args: { key: error.key }
            })
          );
          break;
        case "invalid":
        default:
          lines.push(
            getString("service-dialog-custom-request-validation-error-invalid", {
              args: { key: error.key, detail: error.detail || "" }
            })
          );
          break;
      }
    }
    lines.push(
      "",
      getString("service-dialog-custom-request-validation-examples-head"),
      getString("service-dialog-custom-request-validation-example-boolean"),
      getString("service-dialog-custom-request-validation-example-number"),
      getString("service-dialog-custom-request-validation-example-string"),
      getString("service-dialog-custom-request-validation-example-object", {
        args: { example: objectExample }
      })
    );
    return lines.join("\n");
  }
  async function openCustomRequestDialog(prefKey) {
    const dialog = new ztoolkit.Dialog(2, 1);
    const parameterNameHeader = getString(
      "service-dialog-custom-request-parameter-name"
    );
    const parameterValueHeader = getString(
      "service-dialog-custom-request-parameter-value"
    );
    const parameterNamePlaceholder = getString(
      "service-dialog-custom-request-parameter-name-placeholder"
    );
    const parameterValuePlaceholder = getString(
      "service-dialog-custom-request-parameter-value-placeholder"
    );
    const storedCustomParams = getPref(prefKey) || "{}";
    let customParams = {};
    try {
      customParams = JSON.parse(storedCustomParams);
    } catch (e) {
      customParams = {};
    }
    const keyValuePairs = Object.entries(
      customParams
    ).map(([key, value]) => ({
      key,
      value: JSON.stringify(value)
    }));
    keyValuePairs.push({ key: "", value: "" });
    const dialogData = {
      customParams: keyValuePairs
    };
    let paramIndex = keyValuePairs.length;
    const createTableRow = (pair, index) => ({
      tag: "tr",
      namespace: "html",
      children: [
        {
          tag: "td",
          namespace: "html",
          styles: { padding: "8px" },
          children: [
            {
              tag: "input",
              namespace: "html",
              id: `key-${index}`,
              attributes: {
                type: "text",
                placeholder: parameterNamePlaceholder,
                value: pair.key || ""
              },
              styles: CUSTOM_PARAMS_INPUT_STYLES
            }
          ]
        },
        {
          tag: "td",
          namespace: "html",
          styles: { padding: "8px" },
          children: [
            {
              tag: "input",
              namespace: "html",
              id: `value-${index}`,
              attributes: {
                type: "text",
                placeholder: parameterValuePlaceholder,
                value: pair.value || ""
              },
              styles: CUSTOM_PARAMS_INPUT_STYLES
            }
          ]
        }
      ]
    });
    const createTableRows = () => {
      return keyValuePairs.map((pair, index) => createTableRow(pair, index));
    };
    dialog.setDialogData(dialogData).addCell(
      0,
      0,
      {
        tag: "div",
        namespace: "html",
        styles: {
          width: "600px",
          height: "400px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          minWidth: "500px",
          minHeight: "300px",
          overflowY: "auto",
          padding: "15px",
          resize: "both"
        },
        children: [
          {
            tag: "p",
            namespace: "html",
            styles: {
              marginBottom: "15px"
            },
            properties: {
              innerHTML: getString(`service-dialog-custom-request-description`)
            }
          },
          {
            tag: "table",
            namespace: "html",
            id: "custom-params-table",
            styles: {
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "10px"
            },
            children: [
              {
                tag: "thead",
                namespace: "html",
                children: [
                  {
                    tag: "tr",
                    namespace: "html",
                    children: [
                      {
                        tag: "th",
                        namespace: "html",
                        styles: {
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid var(--color-border)",
                          backgroundColor: "var(--color-menu)",
                          fontWeight: "bold"
                        },
                        properties: {
                          innerHTML: parameterNameHeader
                        }
                      },
                      {
                        tag: "th",
                        namespace: "html",
                        styles: {
                          textAlign: "left",
                          padding: "10px 8px",
                          borderBottom: "2px solid var(--color-border)",
                          backgroundColor: "var(--color-menu)",
                          fontWeight: "bold"
                        },
                        properties: {
                          innerHTML: parameterValueHeader
                        }
                      }
                    ]
                  }
                ]
              },
              {
                tag: "tbody",
                namespace: "html",
                id: "custom-params-tbody",
                children: createTableRows()
              }
            ]
          },
          {
            tag: "div",
            namespace: "html",
            styles: {
              marginTop: "15px",
              display: "flex",
              justifyContent: "flex-start"
            },
            children: [
              {
                tag: "a",
                namespace: "html",
                id: "custom-add-param-btn",
                attributes: {
                  href: "#"
                },
                styles: {
                  color: "var(--fill-primary, #2ea8e5)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "13px"
                },
                properties: {
                  innerHTML: getString(
                    `service-dialog-custom-request-add-param`
                  )
                },
                listeners: [
                  {
                    type: "click",
                    listener: (e) => {
                      e.preventDefault();
                      const doc = e.target.ownerDocument;
                      const tbody = doc.getElementById("custom-params-tbody");
                      if (tbody) {
                        const row = doc.createElement("tr");
                        row.appendChild(
                          createParamInputCell(doc, "key", paramIndex)
                        );
                        row.appendChild(
                          createParamInputCell(doc, "value", paramIndex)
                        );
                        tbody.appendChild(row);
                        paramIndex++;
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      false
    ).addButton(getString(`service-dialog-close`), "close").addButton(getString(`service-dialog-save`), "save").open(getString(`service-dialog-custom-request-title`));
    await dialogData.unloadLock?.promise;
    switch (dialogData._lastButtonId) {
      case "save": {
        const { params, errors } = parseCustomParamsFromDialog(
          dialog.window.document
        );
        if (errors.length) {
          Zotero.alert(
            dialog.window,
            getString("service-dialog-custom-request-validation-title"),
            formatCustomParamsValidationMessage(errors)
          );
          break;
        }
        setPref(prefKey, JSON.stringify(params));
        break;
      }
      default:
        break;
    }
  }

  // src/modules/services/aliyun.ts
  init_prefs();
  var translate2 = async (data2) => {
    const params = data2.secret.split("#");
    const accessKeyId = params[0];
    const accessKeySecret = params[1];
    const endpoint = params[2] || "https://mt.aliyuncs.com/";
    const action = getPref("aliyun.action") || "TranslateGeneral";
    const scene = getPref("aliyun.scene") || "general";
    const encodedBody = `AccessKeyId=${accessKeyId}&Action=${action}&Format=JSON&FormatType=text&Scene=${scene}&SignatureMethod=HMAC-SHA1&SignatureNonce=${encodeURIComponent(
      randomString(12)
    )}&SignatureVersion=1.0&SourceLanguage=auto&SourceText=${encodeRFC3986URIComponent(
      data2.raw
    )}&TargetLanguage=${languageCode(data2.langto)}&Timestamp=${encodeURIComponent(
      (/* @__PURE__ */ new Date()).toISOString()
    )}&Version=2018-10-12`;
    const stringToSign = `POST&%2F&${encodeURIComponent(encodedBody)}`;
    const signature = base64(
      await hmacSha1Digest(stringToSign, `${accessKeySecret}&`)
    );
    const xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `${encodedBody}&Signature=${encodeURIComponent(signature)}`,
      responseType: "json"
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.Code !== "200") {
      throw `Service error: ${xhr.response.Code}:${xhr.response.Message}`;
    }
    data2.result = xhr.response.Data.Translated;
  };
  function languageCode(str) {
    str = str.toLowerCase();
    if (str === "zh-tw" || str === "zh-hk" || str === "zh-mo") {
      return "zh-tw";
    }
    return str.split("-")[0];
  }
  function encodeRFC3986URIComponent(str) {
    return encodeURIComponent(str).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
  }
  var Aliyun = {
    id: "aliyun",
    type: "sentence",
    helpUrl: "https://help.aliyun.com/zh/machine-translation/developer-reference/api-overview-1",
    defaultSecret: "accessKeyId#accessKeySecret",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = parts.length === 2;
      const partsInfo = `AccessKeyId: ${parts[0]}
AccessKeySecret: ${parts[1]}`;
      return {
        secret,
        status: flag && secret !== Aliyun.defaultSecret,
        info: secret === Aliyun.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret must have 2 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate2,
    config(settings) {
      settings.addTextSetting({
        prefKey: "aliyun.action",
        nameKey: "service-aliyun-dialog-action"
      }).addTextSetting({
        prefKey: "aliyun.scene",
        nameKey: "service-aliyun-dialog-scene"
      });
    }
  };

  // src/modules/services/tencent.ts
  init_prefs();
  var translate3 = async (data2) => {
    let secretId = getPref("tencent.secretId") || "";
    let secretKey = getPref("tencent.secretKey") || "";
    let region = getPref("tencent.region");
    let projectId = getPref("tencent.projectId");
    const termRepoIDList = getPref("tencent.termRepoIDList");
    const sentRepoIDList = getPref("tencent.sentRepoIDList");
    if (data2.secret !== Tencent.defaultSecret) {
      const params = data2.secret.split("#");
      const parsedSecretId = params[0];
      secretId = MigrateSecret(parsedSecretId, secretId, "secretId");
      const parsedSecretKey = params[1];
      secretKey = MigrateSecret(parsedSecretKey, secretKey, "secretKey");
      if (params.length >= 3 && params[2]) {
        const parsedRegion = params[2];
        region = MigrateSecret(parsedRegion, region, "region");
      }
      if (params.length >= 4 && params[3]) {
        const parsedProjectId = params[3];
        projectId = MigrateSecret(parsedProjectId, projectId, "projectId");
      }
    }
    function MigrateSecret(parsedStr, str, prefKey) {
      if (parsedStr && parsedStr !== str) {
        setPref(`tencent.${prefKey}`, parsedStr);
        return parsedStr;
      }
      return str;
    }
    const parseCommaList = (input) => input.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
    const termRepoList = parseCommaList(termRepoIDList);
    const sentRepoList = parseCommaList(sentRepoIDList);
    function encodeRFC5987ValueChars(str) {
      return encodeURIComponent(str).replace(
        /['()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
      ).replace(/%20/g, "+");
    }
    const paramsObj = {
      Action: "TextTranslate",
      Language: "zh-CN",
      Nonce: "9744",
      ProjectId: projectId,
      Region: region,
      SecretId: secretId,
      Source: data2.langfrom.split("-")[0],
      SourceText: "#$#",
      Target: data2.langto.split("-")[0],
      Timestamp: (/* @__PURE__ */ new Date()).getTime().toString().substring(0, 10),
      Version: "2018-03-21"
    };
    termRepoList.forEach(
      (repoId, index) => paramsObj[`TermRepoIDList.${index}`] = repoId
    );
    sentRepoList.forEach(
      (repoId, index) => paramsObj[`SentRepoIDList.${index}`] = repoId
    );
    const rawStr = Object.keys(paramsObj).sort().map((key) => `${key}=${paramsObj[key]}`).join("&");
    const sha1Str = encodeRFC5987ValueChars(
      base64(
        await hmacSha1Digest(
          `POSTtmt.tencentcloudapi.com/?${rawStr.replace("#$#", data2.raw)}`,
          secretKey
        )
      )
    );
    const xhr = await Zotero.HTTP.request(
      "POST",
      "https://tmt.tencentcloudapi.com",
      {
        headers: {
          "content-type": "application/json"
        },
        // Encode \s to +
        body: `${rawStr.replace(
          "#$#",
          encodeRFC5987ValueChars(data2.raw)
        )}&Signature=${sha1Str}`,
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.Response.Error) {
      throw `Service error: ${xhr.response.Response.Error.Code}:${xhr.response.Response.Error.Message}`;
    }
    data2.result = xhr.response.Response.TargetText;
  };
  var Tencent = {
    id: "tencent",
    type: "sentence",
    helpUrl: "https://cloud.tencent.com/document/product/551/15619",
    defaultSecret: "secretId#SecretKey#Region(default ap-shanghai)#ProjectId(default 0)",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = [2, 3, 4].includes(parts.length);
      const partsInfo = `SecretId: ${parts[0]}
SecretKey: ${parts[1]}
Region: ${parts[2] ? parts[2] : "ap-shanghai"}
ProjectId: ${parts[3] ? parts[3] : "0"}`;
      return {
        secret,
        status: flag && secret !== Tencent.defaultSecret,
        info: secret === Tencent.defaultSecret ? "The secret is not set. Click the button to configure." : flag ? partsInfo : `The secret must have 2, 3 or 4 parts joined by '#', but got ${parts?.length}.
${partsInfo}
Use format: SecretId#SecretKey#Region(optional)#ProjectId(optional) or click Config button for advanced configuration.`
      };
    },
    translate: translate3,
    config(settings) {
      settings.addTextSetting({
        // @ts-expect-error this pref is not inited in prefs.js
        prefKey: "tencent.secretId",
        nameKey: `service-tencent-dialog-secretid`
      }).addPasswordSetting({
        // @ts-expect-error this pref is not inited in prefs.js
        prefKey: "tencent.secretKey",
        nameKey: `service-tencent-dialog-secretkey`
      }).addSelectSetting({
        prefKey: "tencent.region",
        nameKey: `service-tencent-dialog-region`,
        options: [
          { value: "ap-bangkok", label: "ap-bangkok" },
          { value: "ap-beijing", label: "ap-beijing" },
          { value: "ap-chengdu", label: "ap-chengdu" },
          { value: "ap-chongqing", label: "ap-chongqing" },
          { value: "ap-guangzhou", label: "ap-guangzhou" },
          { value: "ap-hongkong", label: "ap-hongkong" },
          { value: "ap-seoul", label: "ap-seoul" },
          { value: "ap-shanghai", label: "ap-shanghai" },
          { value: "ap-shanghai-fsi", label: "ap-shanghai-fsi" },
          { value: "ap-shenzhen-fsi", label: "ap-shenzhen-fsi" },
          { value: "ap-singapore", label: "ap-singapore" },
          { value: "ap-tokyo", label: "ap-tokyo" },
          { value: "eu-frankfurt", label: "eu-frankfurt" },
          { value: "na-ashburn", label: "na-ashburn" },
          { value: "na-siliconvalley", label: "na-siliconvalley" }
        ]
      }).addTextSetting({
        prefKey: "tencent.projectId",
        placeholder: "0",
        nameKey: `service-tencent-dialog-projectid`
      }).addTextSetting({
        // @ts-expect-error this pref is not inited in prefs.js
        prefKey: "tencent.termRepoIDList",
        placeholder: "144aed**fc7321d4, 256bef**ac8432e5",
        nameKey: `service-tencent-dialog-termrepoid`
      }).addTextSetting({
        // @ts-expect-error this pref is not inited in prefs.js
        prefKey: "tencent.sentRepoIDList",
        placeholder: "345cde**bd9543f6, 456def**ce0654g7",
        nameKey: `service-tencent-dialog-sentrepoid`
      }).onSave((dialogData) => {
        if (
          // @ts-expect-error those pref key not inited in pref.js
          !dialogData["tencent.secretId"] || // @ts-expect-error those pref key not inited in pref.js
          !dialogData["tencent.secretKey"]
        ) {
          return "Secret ID and Secret Key are required!";
        }
        const secretId = dialogData["tencent.secretId"];
        const secretKey = dialogData["tencent.secretKey"];
        const region = dialogData["tencent.region"];
        const projectId = dialogData["tencent.projectId"];
        const combinedSecret = (() => {
          const parts = [];
          const items = [secretId, secretKey, region, projectId];
          for (const item of items) {
            if (item == null || item === "") {
              break;
            }
            parts.push(String(item));
          }
          return parts.join("#");
        })();
        setServiceSecret("tencent", combinedSecret);
        return true;
      });
    }
  };

  // src/modules/services/gpt.ts
  function getCustomParams(prefix) {
    const storedCustomParams = getPref(`${prefix}.customParams`) || "{}";
    try {
      const customParams = JSON.parse(storedCustomParams);
      const standardParams = [
        "model",
        "messages",
        "input",
        "temperature",
        "stream"
      ];
      return Object.fromEntries(
        Object.entries(customParams).filter(
          ([key]) => !standardParams.includes(key)
        )
      );
    } catch (e) {
      return {};
    }
  }
  function isResponsesApiEndpoint(url) {
    return url.endsWith("/responses") || url.includes("/responses?");
  }
  function parseResponsesApiStreamResponse(obj) {
    const eventType = obj.type || "";
    if (eventType === "response.output_text.delta") {
      return {
        content: obj.delta || "",
        finished: false
      };
    }
    if (eventType === "response.completed" || eventType === "response.done" || eventType === "response.failed" || eventType === "response.incomplete") {
      return {
        content: "",
        finished: true
      };
    }
    return { content: "", finished: false };
  }
  function parseResponsesApiNonStreamResponse(obj) {
    if (obj.output && Array.isArray(obj.output)) {
      for (const item of obj.output) {
        if (item.type === "message" && item.content) {
          for (const content of item.content) {
            if (content.type === "output_text") {
              return content.text || "";
            }
          }
        }
      }
    }
    return "";
  }
  function parseStreamResponse(obj) {
    if (obj.choices && obj.choices[0]) {
      const choice = obj.choices[0];
      return {
        content: choice.delta?.content || "",
        finished: choice.finish_reason !== void 0 && choice.finish_reason !== null
      };
    } else if (obj.message) {
      return {
        content: obj.message.content || "",
        finished: obj.done === true
      };
    }
    return { content: "", finished: false };
  }
  function parseNonStreamResponse(obj) {
    if (obj.choices && obj.choices[0]) {
      return obj.choices[0].message.content || "";
    } else if (obj.message && obj.message.content) {
      return obj.message.content;
    }
    return "";
  }
  var gptTranslate = async function(apiURL, model, temperature, prefix, data2, stream) {
    function transformContent2(langFrom, langTo, sourceText) {
      return transformPromptWithContext(
        `${prefix}.prompt`,
        langFrom,
        langTo,
        sourceText,
        data2
      );
    }
    const streamMode = stream ?? true;
    const useResponsesApi = isResponsesApiEndpoint(apiURL);
    const refreshHandler = addon.api.getTemporaryRefreshHandler({ task: data2 });
    if (streamMode === false) {
      data2.result = getString("status-translating");
      refreshHandler();
    }
    const streamCallback = (xmlhttp) => {
      let preLength = 0;
      let result = "";
      let buffer = "";
      xmlhttp.onprogress = (e) => {
        const newResponse = e.target.response.slice(preLength);
        let dataArray;
        const hasSseData = /(^|\n)data:/.test(newResponse);
        if (hasSseData) {
          const fullResponse = buffer + newResponse;
          if (useResponsesApi) {
            dataArray = fullResponse.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
          } else {
            dataArray = fullResponse.split("data:");
          }
          buffer = "";
        } else {
          const fullResponse = buffer + newResponse;
          dataArray = fullResponse.split("\n").filter((line) => line.trim());
          buffer = "";
        }
        for (let i = 0; i < dataArray.length; i++) {
          const data3 = dataArray[i];
          if (!data3.trim()) continue;
          try {
            const obj = JSON.parse(data3);
            const { content, finished } = useResponsesApi ? parseResponsesApiStreamResponse(obj) : parseStreamResponse(obj);
            result += content;
            if (finished) {
              break;
            }
          } catch {
            if (i === dataArray.length - 1) {
              buffer = hasSseData ? "data:" + data3 : data3;
            }
            continue;
          }
        }
        if (e.target.timeout) {
          e.target.timeout = 0;
        }
        data2.result = result.replace(/^\n\n/, "");
        preLength = e.target.response.length;
        refreshHandler();
      };
    };
    const nonStreamCallback = (xmlhttp) => {
      xmlhttp.onload = () => {
        try {
          const responseObj = JSON.parse(xmlhttp.responseText);
          const resultContent = useResponsesApi ? parseResponsesApiNonStreamResponse(responseObj) : parseNonStreamResponse(responseObj);
          data2.result = resultContent.replace(/^\n\n/, "");
        } catch (error) {
          return;
        }
        refreshHandler();
      };
    };
    const requestBody = useResponsesApi ? {
      model,
      input: transformContent2(data2.langfrom, data2.langto, data2.raw),
      temperature,
      stream: streamMode,
      ...getCustomParams(prefix)
    } : {
      model,
      messages: [
        {
          role: "user",
          content: transformContent2(data2.langfrom, data2.langto, data2.raw)
        }
      ],
      temperature,
      stream: streamMode,
      ...getCustomParams(prefix)
    };
    const xhr = await Zotero.HTTP.request("POST", apiURL, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data2.secret}`,
        "api-key": data2.secret
      },
      body: JSON.stringify(requestBody),
      responseType: "text",
      requestObserver: (xmlhttp) => {
        if (streamMode) {
          streamCallback(xmlhttp);
        } else {
          nonStreamCallback(xmlhttp);
        }
      }
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
  };
  function createGPTService(id) {
    const checkSecret = id === "azuregpt" || id === "chatgpt";
    const prefPrefix = id.replace("gpt", "GPT");
    return {
      id,
      type: "sentence",
      helpUrl: id === "azuregpt" ? "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference#chat-completions" : "https://gist.github.com/GrayXu/f1b72353b4b0493d51d47f0f7498b67b",
      ...checkSecret && {
        defaultSecret: "",
        secretValidator(secret) {
          if (id === "chatgpt") {
            const status2 = /^sk-[A-Za-z0-9_-]{32,}$/.test(secret);
            const empty = secret.length === 0;
            return {
              secret,
              status: status2,
              info: empty ? "The secret is not set." : status2 ? "Click the button to check connectivity." : "The secret key format is invalid."
            };
          }
          if (id === "azuregpt") {
            const flag = Boolean(secret);
            return {
              secret,
              status: flag,
              info: flag ? "" : "The secret is not set."
            };
          }
          const status = secret.length > 0;
          return {
            secret,
            status,
            info: status ? "Click the button to check connectivity." : "The secret key format is invalid."
          };
        }
      },
      async translate(data2) {
        switch (id) {
          case "azuregpt": {
            const endPoint = getPref("azureGPT.endPoint");
            const apiVersion = getPref("azureGPT.apiVersion");
            const model = getPref("azureGPT.model");
            const temperature = parseFloat(
              getPref("azureGPT.temperature")
            );
            const stream = getPref("azureGPT.stream");
            const apiURL = new URL(endPoint);
            apiURL.pathname = `/openai/deployments/${model}/chat/completions`;
            apiURL.search = `api-version=${apiVersion}`;
            return await gptTranslate(
              apiURL.href,
              model,
              temperature,
              "azureGPT",
              data2,
              stream
            );
          }
          case "chatgpt":
          case "customgpt1":
          case "customgpt2":
          case "customgpt3": {
            const apiURL = getPref(`${prefPrefix}.endPoint`);
            const model = getPref(`${prefPrefix}.model`);
            const temperature = parseFloat(
              getPref(`${prefPrefix}.temperature`)
            );
            const stream = getPref(`${prefPrefix}.stream`);
            return await gptTranslate(
              apiURL,
              model,
              temperature,
              prefPrefix,
              data2,
              stream
            );
          }
          default:
            break;
        }
      },
      config(settings) {
        const servicePrefix = id === "azuregpt" ? "azuregpt" : "chatgpt";
        settings.addTextSetting({
          prefKey: `${prefPrefix}.endPoint`,
          nameKey: `service-${servicePrefix}-dialog-endPoint`
        }).addTextSetting({
          prefKey: `${prefPrefix}.model`,
          nameKey: `service-${servicePrefix}-dialog-model`
        }).addNumberSetting({
          prefKey: `${prefPrefix}.temperature`,
          nameKey: `service-${servicePrefix}-dialog-temperature`,
          min: 0,
          max: 2,
          step: 0.1
        });
        if (id === "azuregpt" && prefPrefix === "azureGPT" && servicePrefix === "azuregpt") {
          settings.addTextSetting({
            prefKey: `${prefPrefix}.apiVersion`,
            nameKey: `service-${servicePrefix}-dialog-apiVersion`,
            hidden: id !== "azuregpt"
          });
        }
        settings.addTextAreaSetting({
          prefKey: `${prefPrefix}.prompt`,
          nameKey: `service-${servicePrefix}-dialog-prompt`,
          placeholder: getString(`service-${servicePrefix}-dialog-prompt`)
        }).addCheckboxSetting({
          prefKey: `${prefPrefix}.stream`,
          nameKey: `service-${servicePrefix}-dialog-stream`
        }).addCustomParamsSetting({
          prefKey: `${prefPrefix}.customParams`,
          nameKey: `service-${servicePrefix}-dialog-custom-request`,
          desc: getString(
            `service-${servicePrefix}-dialog-custom-request-description`
          )
        });
      }
    };
  }
  var ChatGPT = createGPTService("chatgpt");
  var customGPT1 = createGPTService("customgpt1");
  var customGPT2 = createGPTService("customgpt2");
  var customGPT3 = createGPTService("customgpt3");
  var azureGPT = createGPTService("azuregpt");

  // src/modules/services/baidu.ts
  var translate4 = async (data2) => {
    const params = data2.secret.split("#");
    const appid = params[0];
    const key = params[1];
    let action = "0";
    if (params.length >= 3) {
      action = params[2];
    }
    const salt = (/* @__PURE__ */ new Date()).getTime();
    const sign = Zotero.Utilities.Internal.md5(
      appid + data2.raw + salt + key,
      false
    );
    const xhr = await Zotero.HTTP.request(
      "GET",
      `http://api.fanyi.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(
        data2.raw
      )}&appid=${appid}&from=${data2.langfrom.split("-")[0]}&to=${data2.langto.split("-")[0]}&salt=${salt}&sign=${sign}&action=${action}&needIntervene=1`,
      {
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.error_code) {
      throw `Service error: ${xhr.response.error_code}:${xhr.response.error_msg}`;
    }
    let tgt = "";
    for (let i = 0; i < xhr.response.trans_result.length; i++) {
      tgt += xhr.response.trans_result[i].dst;
    }
    data2.result = tgt;
  };
  var Baidu = {
    id: "baidu",
    type: "sentence",
    defaultSecret: "appid#key",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = [2, 3].includes(parts.length);
      const partsInfo = `AppID: ${parts[0]}
Key: ${parts[1]}
Action: ${parts[2] ? parts[2] : "0"}`;
      return {
        secret,
        status: flag && secret !== Baidu.defaultSecret,
        info: secret === Baidu.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of Baidu Text Translation is AppID#Key#Action(optional). The secret must have 2 or 3 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate4
  };

  // src/modules/services/baidufield.ts
  var translate5 = async (data2) => {
    const params = data2.secret.split("#");
    const appid = params[0];
    const key = params[1];
    const domain = params[2];
    const salt = (/* @__PURE__ */ new Date()).getTime();
    const sign = Zotero.Utilities.Internal.md5(
      appid + data2.raw + salt + domain + key,
      false
    );
    const xhr = await Zotero.HTTP.request(
      "GET",
      `http://api.fanyi.baidu.com/api/trans/vip/fieldtranslate?q=${encodeURIComponent(
        data2.raw
      )}&appid=${appid}&from=${data2.langfrom.split("-")[0]}&to=${data2.langto.split("-")[0]}&domain=${domain}&salt=${salt}&sign=${sign}`,
      {
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.error_code) {
      throw `Service error: ${xhr.response.error_code}:${xhr.response.error_msg}`;
    }
    let tgt = "";
    for (let i = 0; i < xhr.response.trans_result.length; i++) {
      tgt += xhr.response.trans_result[i].dst;
    }
    data2.result = tgt;
  };
  var BaiduField = {
    id: "baidufield",
    type: "sentence",
    defaultSecret: "appid#key#field",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = parts.length === 3;
      const partsInfo = `AppID: ${parts[0]}
Key: ${parts[1]}
DomainCode: ${parts[2]}`;
      return {
        secret,
        status: flag && secret !== BaiduField.defaultSecret,
        info: secret === BaiduField.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of Baidu Domain Text Translation is AppID#Key#DomainCode. The secret must have 3 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate5
  };

  // src/modules/services/bing.ts
  init_prefs();
  var translate6 = async (data2) => {
    const xhr = await Zotero.HTTP.request(
      "POST",
      `https://api-edge.cognitive.microsofttranslator.com/translate?from=${data2.langfrom}&to=${data2.langto}&api-version=3.0&includeSentenceLength=true`,
      {
        headers: {
          accept: "*/*",
          "accept-language": "zh-TW,zh;q=0.9,ja;q=0.8,zh-CN;q=0.7,en-US;q=0.6,en;q=0.5",
          authorization: `Bearer ${await getToken()}`,
          "cache-control": "no-cache",
          "content-type": "application/json",
          pragma: "no-cache",
          "sec-ch-ua": '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "cross-site",
          Referer: "https://appsumo.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42"
        },
        body: JSON.stringify([{ text: data2.raw }]),
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    try {
      data2.result = xhr.response[0].translations[0].text;
    } catch {
      throw `Service error: ${xhr.response}`;
    }
  };
  var bingTokenKey = "bingToken";
  var tokenExpTime = 5 * 60 * 1e3;
  async function getToken(forceRefresh = false) {
    let token = "";
    let doRefresh = true;
    try {
      const tokenObj = getPrefJSON(bingTokenKey);
      if (!forceRefresh && tokenObj && tokenObj.token && (/* @__PURE__ */ new Date()).getTime() < tokenObj.exp) {
        token = tokenObj.token;
        doRefresh = false;
      }
    } catch (e) {
      ztoolkit.log(e);
    }
    if (doRefresh) {
      const xhr = await Zotero.HTTP.request(
        "GET",
        "https://edge.microsoft.com/translate/auth",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42"
          },
          responseType: "text"
        }
      );
      if (xhr && xhr.response) {
        token = xhr.response;
        setPref(
          bingTokenKey,
          JSON.stringify({
            exp: (/* @__PURE__ */ new Date()).getTime() + tokenExpTime,
            token
          })
        );
      }
    }
    return token;
  }
  var Bing = {
    id: "bing",
    type: "sentence",
    translate: translate6
  };

  // src/modules/services/bingdict.ts
  var translate7 = async function(data2) {
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://cn.bing.com/dict/search?q=${encodeURIComponent(data2.raw)}/`,
      { responseType: "text" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    let res = xhr.response;
    const doc = new DOMParser().parseFromString(res, "text/html");
    const mp3s = Array.from(
      doc.querySelectorAll(".hd_area .bigaud")
    );
    const phoneticText = doc.querySelectorAll(".hd_area .b_primtxt");
    data2.audio = mp3s.map((a, i) => ({
      text: phoneticText[i].innerHTML.replace("&nbsp;", " "),
      url: "https://cn.bing.com" + (a.getAttribute("data-mp3link") ?? "")
    }));
    try {
      res = res.match(/<meta name="description" content="(.+) " ?\/>/gm)[0];
    } catch (e) {
      throw "Parse error";
    }
    let tgt = "";
    for (const line of res.split("\uFF0C").slice(3)) {
      if (line.indexOf("\u7F51\u7EDC\u91CA\u4E49") > -1) {
        tgt += line.slice(0, line.lastIndexOf("\uFF1B"));
      } else {
        tgt += line + "\n";
      }
    }
    tgt = tgt.replace(/" \/>/g, "");
    data2.result = tgt;
  };
  var BingDict = {
    id: "bingdict",
    type: "word",
    translate: translate7
  };

  // src/modules/services/caiyun.ts
  var translate8 = async function(data2) {
    const param = `${transLang(data2.langfrom)}2${transLang(data2.langto)}`;
    const xhr = await Zotero.HTTP.request(
      "POST",
      "http://api.interpreter.caiyunai.com/v1/translator",
      {
        headers: {
          "content-type": "application/json",
          "x-authorization": `token ${data2.secret}`
        },
        body: JSON.stringify({
          source: [data2.raw],
          trans_type: param,
          request_id: (/* @__PURE__ */ new Date()).valueOf() / 1e4,
          detect: true
        }),
        responseType: "json"
      }
    );
    function transLang(inlang = "") {
      const traditionalChinese = ["zh-HK", "zh-MO", "zh-TW"];
      if (traditionalChinese.includes(inlang)) {
        return "zh-Hant";
      } else {
        return inlang.split("-")[0];
      }
    }
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    data2.result = xhr.response.target[0];
  };
  var Caiyun = {
    id: "caiyun",
    type: "sentence",
    defaultSecret: "3975l6lr5pcbvidl6jl2",
    secretValidator(secret) {
      const flag = secret.length > 0;
      return {
        secret,
        status: flag && secret !== Caiyun.defaultSecret,
        info: secret === Caiyun.defaultSecret ? "The default secret is for testing only. You should set your own custom token for production." : flag ? "" : "The secret is not set."
      };
    },
    translate: translate8
  };

  // src/modules/services/cambridgedict.ts
  var cambridgeLangCode = [
    { name: "arabic", code: "ar", parser: parser1 },
    { name: "bengali", code: "bn", parser: parser1 },
    { name: "catalan", code: "ca", parser: parser1 },
    { name: "chinese-simplified", code: "zh", parser: parser1 },
    { name: "chinese-traditional", code: "zht", parser: parser1 },
    { name: "english", code: "en", parser: parser1 },
    { name: "gujarati", code: "gu", parser: parser1 },
    { name: "hindi", code: "hi", parser: parser1 },
    { name: "italian", code: "it", parser: parser1 },
    { name: "japanese", code: "ja", parser: parser1 },
    { name: "korean", code: "ko", parser: parser1 },
    { name: "marathi", code: "mr", parser: parser1 },
    { name: "polish", code: "pl", parser: parser1 },
    { name: "portuguese", code: "pt", parser: parser1 },
    { name: "russian", code: "ru", parser: parser1 },
    { name: "spanish", code: "es", parser: parser1 },
    { name: "tamil", code: "ta", parser: parser1 },
    { name: "telugu", code: "te", parser: parser1 },
    { name: "turkish", code: "tr", parser: parser1 },
    { name: "urdu", code: "ur", parser: parser1 },
    { name: "french", code: "fr", parser: parser2 },
    { name: "german", code: "de", parser: parser2 },
    { name: "dutch", code: "nl", parser: parser2 },
    { name: "indonesian", code: "id", parser: parser2 },
    { name: "norwegian", code: "no", parser: parser2 },
    { name: "swedish", code: "sv", parser: parser2 },
    { name: "czech", code: "cs", parser: parser2 },
    { name: "danish", code: "da", parser: parser2 },
    { name: "malaysian", code: "ms", parser: parser2 },
    { name: "thai", code: "th", parser: parser2 },
    { name: "ukrainian", code: "uk", parser: parser2 },
    { name: "vietnamese", code: "vi", parser: parser2 }
  ];
  var dictCode = cambridgeLangCode.reduce(
    (acc, cur) => {
      acc[`en-${cur.code}`] = `english-${cur.name}`;
      return acc;
    },
    {}
  );
  var parsers = cambridgeLangCode.reduce(
    (acc, cur) => {
      acc[`en-${cur.code}`] = cur.parser;
      return acc;
    },
    {}
  );
  var translate9 = async function(data2) {
    const { dict, parser } = getDictionaryCode(data2.langfrom, data2.langto);
    if (dict === "unsupported" || !parser)
      throw `Language Error: unsupported dictionary ${dict}`;
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://dictionary.cambridge.org/dictionary/${dict}/${encodeURIComponent(data2.raw)}`,
      {
        responseType: "text"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response;
    const doc = new DOMParser().parseFromString(res, "text/html");
    const { result, audioList } = parser(doc);
    if (!result) {
      throw "Parse Error";
    }
    data2.result = result;
    data2.audio = audioList;
  };
  function getDictionaryCode(fromCode, toCode) {
    fromCode = fromCode.split("-")[0].toLowerCase();
    toCode = toCode.toLowerCase();
    if (toCode.includes("zh")) {
      toCode = ["zh", "zh-cn", "zh-sg"].includes(toCode) ? "zh" : "zht";
    }
    toCode = toCode.split("-")[0];
    const code = `${fromCode}-${toCode}`;
    let dict = "";
    let parser = null;
    if (fromCode === "en") {
      dict = dictCode[code] ?? "unsupported";
      parser = parsers[code] ?? null;
    } else {
      dict = "unsupported";
    }
    return { dict, parser };
  }
  function parser1(doc) {
    const audioList = [];
    const urls = [];
    const contents = [];
    doc.querySelectorAll(".entry-body__el").forEach((block) => {
      contents.push(block.querySelector(".posgram")?.textContent ?? "");
      let prons = "";
      block.querySelectorAll('.pos-header span[class*="dpron-"]').forEach((value) => {
        const pron = value.querySelector(".dpron")?.textContent ?? "";
        const pronText = `${value.querySelector(".region")?.textContent ?? ""} ${pron}  `;
        const url = value.querySelector("source")?.getAttribute("src");
        if (pron) prons += pronText;
        if (url && !urls.includes(url)) {
          const audio = {
            text: pronText,
            url: "https://dictionary.cambridge.org" + url
          };
          audioList.push(audio);
          urls.push(url);
        }
      });
      contents.push(prons);
      contents.push(parseBody(block));
    });
    const result = contents.filter((content) => content !== "").join("\n");
    return { result, audioList };
  }
  function parser2(doc) {
    const audioList = [];
    const contents = [];
    doc.querySelectorAll(".link").forEach((block) => {
      contents.push(block.querySelector(".dpos")?.textContent ?? "");
      contents.push(block.querySelector(".dpos-h .pron")?.textContent ?? "");
      contents.push(parseBody(block));
    });
    const result = contents.filter((content) => content !== "").join("\n");
    return { result, audioList };
  }
  function parseBody(block) {
    const body = [];
    block.querySelectorAll(".dsense").forEach((value, i) => {
      const guideword = value.querySelector(".guideword")?.textContent?.replace(/\s+/g, " ") ?? "";
      const defEn = value.querySelector(".def")?.textContent ?? "";
      const def = value.querySelector(".trans[lang]")?.textContent?.trim() ?? "";
      body.push(`	${i + 1}.${guideword} ${defEn}
		${def}`);
    });
    return body.join("\n");
  }
  var CambridgeDict = {
    id: "cambridgedict",
    type: "word",
    translate: translate9
  };

  // src/modules/services/claude.ts
  function transformContent(langFrom, langTo, sourceText, data2) {
    return transformPromptWithContext(
      "claude.prompt",
      langFrom,
      langTo,
      sourceText,
      data2
    );
  }
  var translate10 = async function(data2) {
    const apiURL = getPref("claude.endPoint");
    const model = getPref("claude.model");
    const temperature = parseFloat(getPref("claude.temperature"));
    const stream = getPref("claude.stream");
    const maxTokens = parseInt(getPref("claude.maxTokens")) || 4e3;
    const refreshHandler = addon.api.getTemporaryRefreshHandler({ task: data2 });
    const requestBody = {
      model,
      messages: [
        {
          role: "user",
          content: transformContent(data2.langfrom, data2.langto, data2.raw, data2)
        }
      ],
      temperature,
      stream,
      max_tokens: maxTokens
    };
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": data2.secret
    };
    const xhr = await Zotero.HTTP.request("POST", apiURL, {
      headers,
      body: JSON.stringify(requestBody),
      responseType: "text",
      requestObserver: (xmlhttp) => {
        if (stream) {
          let preLength = 0;
          let result = "";
          let buffer = "";
          xmlhttp.onprogress = (e) => {
            try {
              const newResponse = e.target.response.slice(preLength);
              preLength = e.target.response.length;
              buffer += newResponse;
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                if (!line.trim()) continue;
                const dataLine = line.startsWith("data: ") ? line.slice(6) : line;
                if (dataLine.trim() === "[DONE]") continue;
                try {
                  const obj = JSON.parse(dataLine);
                  if (obj.type === "content_block_delta") {
                    result += obj.delta?.text || "";
                  } else if (obj.type === "content_block_start" || obj.type === "content_block_stop") {
                    continue;
                  }
                } catch (parseError) {
                  continue;
                }
              }
              if (e.target.timeout) {
                e.target.timeout = 0;
              }
              data2.result = result.replace(/^\n\n/, "");
              refreshHandler();
            } catch (error) {
              console.error("Error processing Claude stream:", error);
            }
          };
          xmlhttp.onload = () => {
            data2.status = "success";
            refreshHandler();
          };
        } else {
          xmlhttp.onload = () => {
            try {
              const responseObj = JSON.parse(xmlhttp.responseText);
              const resultContent = responseObj.content[0].text;
              data2.result = resultContent.replace(/^\n\n/, "");
            } catch (error) {
              data2.result = getString("status-translating");
              data2.status = "fail";
              throw `Failed to parse response: ${error}`;
            }
            refreshHandler();
          };
        }
      }
    });
    if (xhr?.status !== 200) {
      data2.result = `Request error: ${xhr?.status}`;
      data2.status = "fail";
      throw `Request error: ${xhr?.status}`;
    }
    data2.status = "success";
    return;
  };
  var Claude = {
    id: "claude",
    type: "sentence",
    helpUrl: "https://docs.anthropic.com/claude/docs/getting-started-with-the-claude-api",
    defaultSecret: "",
    secretValidator(secret) {
      const status = /^sk-ant-[A-Za-z0-9]{24,}$/.test(secret);
      const empty = secret.length === 0;
      return {
        secret,
        status: status || Boolean(secret),
        info: empty ? "The secret is not set." : status ? "Click the button to check connectivity." : "The Claude API key format might be invalid. Typically starts with 'sk-ant-'."
      };
    },
    translate: translate10,
    config(settings) {
      settings.addTextSetting({
        prefKey: "claude.endPoint",
        nameKey: "service-claude-dialog-endPoint"
      }).addTextSetting({
        prefKey: "claude.model",
        nameKey: "service-claude-dialog-model"
      }).addNumberSetting({
        prefKey: "claude.temperature",
        nameKey: "service-claude-dialog-temperature",
        min: 0,
        max: 1,
        step: 0.1
      }).addNumberSetting({
        prefKey: "claude.maxTokens",
        nameKey: "service-claude-dialog-maxTokens",
        inputType: "number",
        min: 100,
        max: 1e4,
        step: 100
      }).addTextAreaSetting({
        prefKey: "claude.prompt",
        nameKey: "service-claude-dialog-prompt"
      }).addCheckboxSetting({
        prefKey: "claude.stream",
        nameKey: "service-claude-dialog-stream"
      });
    }
  };

  // src/modules/services/cnki.ts
  init_prefs();
  async function requestWithRetry(fn, retries, baseDelayMs) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        if (attempt === retries) {
          ztoolkit.log(`CNKI request failed after ${retries + 1} attempts`, e);
          throw e;
        }
        await new Promise(
          (resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1))
        );
      }
    }
    throw lastError;
  }
  var translate11 = async function(data2) {
    let progressWindow;
    const useSplit = getPref("cnkiUseSplit");
    const splitSecond = getPref("cnkiSplitSecond");
    if (!data2.silent) {
      progressWindow = new ztoolkit.ProgressWindow("PDF Translate");
    }
    const processTranslation = async (text) => {
      const token = await getToken2();
      const xhr = await requestWithRetry(
        async () => Zotero.HTTP.request(
          "POST",
          "https://dict.cnki.net/fyzs-front-api/translate/literaltranslation",
          {
            headers: {
              "Content-Type": "application/json;charset=UTF-8",
              Token: token
            },
            body: JSON.stringify({
              words: await getWord(text),
              translateType: null
            }),
            responseType: "json"
          }
        ),
        2,
        500
      );
      if (xhr.response.data?.isInputVerificationCode) {
        throw "Your access is temporarily banned by the CNKI service. Please goto https://dict.cnki.net/, translate manually and pass human verification.";
      }
      let tgt = xhr.response.data?.mResult;
      tgt = tgt.replace(new RegExp(getPref("cnkiRegex"), "g"), "");
      return tgt;
    };
    if (useSplit) {
      const sentences = data2.raw.split(/[.?!]/).map((s) => s.trim()).filter((s) => s.length > 0);
      const chunks = [];
      let currentChunk = "";
      sentences.forEach((sentence) => {
        const sentenceWithPeriod = sentence + ". ";
        if (currentChunk.length + sentenceWithPeriod.length > 800) {
          chunks.push(currentChunk);
          currentChunk = sentenceWithPeriod;
        } else {
          currentChunk += sentenceWithPeriod;
        }
      });
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      let translatedText = "";
      for (const chunk of chunks) {
        translatedText += await processTranslation(chunk) + " ";
        data2.result = translatedText.trim();
        addon.api.getTemporaryRefreshHandler({ task: data2 })();
        await new Promise((resolve) => setTimeout(resolve, splitSecond * 1e3));
      }
    } else {
      if (data2.raw.length > 800) {
        progressWindow?.createLine({
          text: `Maximum text length is 800, ${data2.raw.length} selected. Will only translate first 800 characters. If you want the plugin to automatically split the translation based on punctuation, you can enable the split switch in the preferences.`
        }).show();
        data2.raw = data2.raw.slice(0, 800);
      }
      data2.result = await processTranslation(data2.raw);
    }
  };
  async function getToken2(forceRefresh = false) {
    let token = "";
    let doRefresh = true;
    try {
      const tokenObj = getPrefJSON("cnkiToken");
      if (!forceRefresh && tokenObj?.token && (/* @__PURE__ */ new Date()).getTime() - tokenObj.t < 300 * 1e3) {
        token = tokenObj.token;
        doRefresh = false;
      }
    } catch (e) {
      ztoolkit.log(e);
    }
    if (doRefresh) {
      const xhr = await requestWithRetry(
        () => Zotero.HTTP.request(
          "GET",
          "https://dict.cnki.net/fyzs-front-api/getToken",
          {
            responseType: "json"
          }
        ),
        2,
        300
      );
      if (xhr && xhr.response && xhr.response.code === 200) {
        token = xhr.response.token;
        setPref(
          "cnkiToken",
          JSON.stringify({
            t: (/* @__PURE__ */ new Date()).getTime(),
            token: xhr.response.data
          })
        );
      }
    }
    return token;
  }
  async function getWord(text) {
    const encrypted = await aesEcbEncrypt(text, "4e87183cfd3a45fe");
    const base64str = base64(encrypted.buffer);
    return base64str.replace(/\//g, "_").replace(/\+/g, "-");
  }
  var Cnki = {
    id: "cnki",
    type: "sentence",
    translate: translate11,
    config(settings) {
      settings.addTextSetting({
        prefKey: "cnkiRegex",
        nameKey: "service-cnki-dialog-regex"
      }).addCheckboxSetting({
        prefKey: "cnkiUseSplit",
        nameKey: "service-cnki-dialog-split"
      });
    }
  };

  // src/modules/services/collinsdict.ts
  var translate12 = async function(data2) {
    const xhr = await Zotero.HTTP.request(
      "GET",
      "https://www.collinsdictionary.com/zh/dictionary/english-chinese/" + encodeURIComponent(data2.raw),
      { responseType: "text" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.responseURL.includes("?q=")) {
      throw "No result found error";
    }
    const doc = new DOMParser().parseFromString(xhr.response, "text/html");
    Array.prototype.forEach.call(
      doc.querySelectorAll("script"),
      (e) => e.remove()
    );
    const phoneticElements = Array.from(
      doc.querySelectorAll(".type-")
    );
    data2.audio = phoneticElements.map((e) => ({
      text: e.innerText.trim(),
      url: e.querySelector("a")?.getAttribute("data-src-mp3") || ""
    }));
    const explanationText = Array.prototype.map.call(
      doc.querySelectorAll(".hom"),
      (e) => e.innerText.replace(/&nbsp;/g, " ").replace(/[0-9]\./g, "\n$&")
    ).join("");
    data2.result = explanationText;
  };
  var CollinsDict = {
    id: "collinsdict",
    type: "word",
    translate: translate12
  };

  // src/modules/services/deepl.ts
  init_package();
  function createDeepl(id) {
    return {
      id,
      type: "sentence",
      defaultSecret: "",
      secretValidator(secret) {
        const flag = secret?.length >= 36;
        return {
          secret,
          status: flag,
          info: flag ? "" : `The secret is your DeepL KEY. The secret length must >= 36, but got ${secret?.length}.`
        };
      },
      async translate(data2) {
        let url;
        if (id === "deeplfree") {
          url = "https://api-free.deepl.com/v2/translate";
        } else {
          url = data2.secret.endsWith("dp") ? "https://api.deepl-pro.com/v2/translate" : "https://api.deepl.com/v2/translate";
        }
        const [key, glossary_id] = data2.secret.split("#");
        const xhr = await Zotero.HTTP.request("POST", url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `DeepL-Auth-Key ${key}`,
            // @ts-ignore not typed
            "User-Agent": `Translate for Zotero/${Zotero.version}-${Zotero.platform}-${version2}`
          },
          responseType: "json",
          body: JSON.stringify({
            text: [data2.raw],
            source_lang: mapLang(data2.langfrom),
            target_lang: mapLang(data2.langto),
            glossary_id
          })
        });
        if (xhr?.status !== 200) {
          throw `Request error: ${xhr?.status}`;
        }
        data2.result = xhr.response.translations[0].text;
      }
    };
  }
  function mapLang(lang) {
    if (lang in LANG_MAP) {
      return LANG_MAP[lang];
    }
    return lang.split("-")[0].toUpperCase();
  }
  var LANG_MAP = {
    "pt-BR": "PT-BR",
    "pt-PT": "PT-PT",
    "zh-CN": "ZH-HANS",
    "zh-HK": "ZH-HANT",
    "zh-MO": "ZH-HANT",
    "zh-SG": "ZH-HANS",
    "zh-TW": "ZH-HANT"
  };
  var DeeplFree = createDeepl("deeplfree");
  var DeeplPro = createDeepl("deeplpro");

  // src/modules/services/freedictionaryapi.ts
  var translate13 = async function(data2) {
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://api.dictionaryapi.dev/api/v2/entries/en/${data2.raw}`,
      {
        headers: {
          Accept: "application/json"
        },
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response[0];
    let tgt = "";
    if (res.phonetics) {
      tgt += res.phonetics.map((p) => p.text).join(",");
      tgt += "\n";
    }
    if (res.meanings) {
      tgt += res.meanings.map(
        (m) => `[${m.partOfSpeech}] ${m.definitions.map(
          (d) => `${d.definition}
${d.example ? `	[example] ${d.example}` : ""}`
        ).join("")}`
      ).join("----\n");
    }
    data2.result = tgt;
  };
  var FreeDictionaryAPI = {
    id: "freedictionaryapi",
    type: "word",
    translate: translate13
  };

  // src/modules/services/gemini.ts
  var translate14 = async function(data2) {
    const apiURL = getPref("gemini.endPoint");
    function transformContent2(langFrom, langTo, sourceText) {
      return transformPromptWithContext(
        "gemini.prompt",
        langFrom,
        langTo,
        sourceText,
        data2
      );
    }
    function getGenContentAPI(data3) {
      const stream = getPref("gemini.stream");
      if (stream) {
        return apiURL + `:streamGenerateContent?alt=sse&key=${data3.secret}`;
      } else {
        return apiURL + `:generateContent?key=${data3.secret}`;
      }
    }
    const refreshHandler = addon.api.getTemporaryRefreshHandler({ task: data2 });
    const xhr = await Zotero.HTTP.request("POST", getGenContentAPI(data2), {
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: transformContent2(data2.langfrom, data2.langto, data2.raw)
              }
            ]
          }
        ]
      }),
      responseType: "text",
      requestObserver: (xmlhttp) => {
        let preLength = 0;
        let result = "";
        xmlhttp.onprogress = (e) => {
          const newResponse = e.target.response.slice(preLength);
          const dataArray = newResponse.split("data: ");
          for (const data3 of dataArray) {
            if (data3) {
              result += JSON.parse(data3).candidates[0].content.parts[0].text || "";
            }
          }
          if (e.target.timeout) {
            e.target.timeout = 0;
          }
          data2.result = result;
          preLength = e.target.response.length;
          refreshHandler();
        };
      }
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
  };
  var Gemini = {
    id: "gemini",
    type: "sentence",
    helpUrl: "https://ai.google.dev/gemini-api/docs",
    defaultSecret: "",
    secretValidator(secret) {
      const flag = Boolean(secret);
      return {
        secret,
        status: flag,
        info: flag ? "" : "The secret is not set."
      };
    },
    translate: translate14,
    config(settings) {
      settings.addTextSetting({
        prefKey: "gemini.endPoint",
        nameKey: "service-gemini-dialog-endPoint"
      }).addTextAreaSetting({
        prefKey: "gemini.prompt",
        nameKey: "service-gemini-dialog-prompt"
      }).addCheckboxSetting({
        prefKey: "gemini.stream",
        nameKey: "service-gemini-dialog-stream"
      });
    }
  };

  // src/modules/services/google.ts
  async function _google(url, data2) {
    function TL(a) {
      const k = "";
      const b = 406644;
      const b1 = 3293161072;
      const jd = ".";
      const $b = "+-a^+6";
      const Zb = "+-3^+b+-f";
      let e, f, g;
      for (e = [], f = 0, g = 0; g < a.length; g++) {
        let m = a.charCodeAt(g);
        128 > m ? e[f++] = m : (2048 > m ? e[f++] = m >> 6 | 192 : (55296 == (m & 64512) && g + 1 < a.length && 56320 == (a.charCodeAt(g + 1) & 64512) ? (m = 65536 + ((m & 1023) << 10) + (a.charCodeAt(++g) & 1023), e[f++] = m >> 18 | 240, e[f++] = m >> 12 & 63 | 128) : e[f++] = m >> 12 | 224, e[f++] = m >> 6 & 63 | 128), e[f++] = m & 63 | 128);
      }
      a = b;
      for (f = 0; f < e.length; f++) a += e[f], a = RL(a, $b);
      a = RL(a, Zb);
      a ^= b1 || 0;
      0 > a && (a = (a & 2147483647) + 2147483648);
      a %= 1e6;
      return a.toString() + jd + (a ^ b);
    }
    function RL(a, b) {
      const t = "a";
      const Yb = "+";
      let d;
      for (let c = 0; c < b.length - 2; c += 3) {
        d = b.charAt(c + 2);
        d = d >= t ? d.charCodeAt(0) - 87 : Number(d);
        d = b.charAt(c + 1) == Yb ? a >>> d : a << d;
        a = b.charAt(c) == Yb ? a + d & 4294967295 : a ^ d;
      }
      return a;
    }
    const langfrom = LANG_MAP2[data2.langfrom] || data2.langfrom;
    const langto = LANG_MAP2[data2.langto] || data2.langto;
    const param = `sl=${langfrom}&tl=${langto}`;
    const xhr = await Zotero.HTTP.request(
      "GET",
      `${data2.secret ? data2.secret : url}/translate_a/single?client=gtx&${param}&hl=en&dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t&source=bh&ssel=0&tsel=0&kc=1&tk=${TL(
        data2.raw
      )}&q=${encodeURIComponent(data2.raw)}`,
      { responseType: "json" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    let tgt = "";
    for (let i = 0; i < xhr.response[0].length; i++) {
      if (!xhr.response[0][i]) {
        continue;
      }
      if (xhr.response[0][i] && xhr.response[0][i][0]) {
        tgt += xhr.response[0][i][0];
      }
    }
    data2.result = tgt;
  }
  var LANG_MAP2 = {
    // https://github.com/windingwind/zotero-pdf-translate/issues/997
    "pt-BR": "pt"
  };
  function createGoogle(id) {
    return {
      id,
      type: "sentence",
      async translate(data2) {
        if (id === "google") {
          return await _google("https://translate.google.com", data2);
        }
        if (id === "googleapi") {
          return await _google("https://translate.googleapis.com", data2);
        }
      }
    };
  }
  var Google = createGoogle("google");
  var GoogleAPI = createGoogle("googleapi");

  // src/modules/services/haici.ts
  init_prefs();
  var translate15 = async function(data2) {
    const xhr = await Zotero.HTTP.request(
      "GET",
      `http://api.microsofttranslator.com/V2/Ajax.svc/TranslateArray?appId=${await getAppId()}&from=${data2.langfrom}&to=${data2.langto}&texts=["${encodeURIComponent(
        data2.raw.replace(/"/g, '\\"')
      )}"]`,
      { responseType: "json" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    try {
      let tgt = "";
      xhr.response.forEach((line) => {
        tgt += line.TranslatedText;
      });
      data2.result = tgt;
    } catch {
      throw `Service error: ${xhr.response}`;
    }
  };
  async function getAppId(forceRefresh = false) {
    let appId = "";
    let doRefresh = true;
    try {
      const appIdObj = getPrefJSON("haiciAppId");
      if (!forceRefresh && appIdObj && appIdObj.appId && (/* @__PURE__ */ new Date()).getTime() - appIdObj.t < 60 * 60 * 1e3) {
        appId = appIdObj.appId;
        doRefresh = false;
      }
    } catch (e) {
      ztoolkit.log(e);
    }
    if (doRefresh) {
      const xhr = await Zotero.HTTP.request(
        "GET",
        "http://capi.dict.cn/fanyi.php",
        {
          headers: {
            Referer: "http://fanyi.dict.cn/"
          },
          responseType: "text"
        }
      );
      if (xhr && xhr.response) {
        appId = xhr.response.match(/"(.+)"/)[1];
        setPref(
          "haiciAppId",
          JSON.stringify({
            t: (/* @__PURE__ */ new Date()).getTime(),
            appId
          })
        );
      }
    }
    return appId;
  }
  var Haici = {
    id: "haici",
    type: "sentence",
    translate: translate15
  };

  // src/modules/services/haicidict.ts
  var translate16 = async function(data2) {
    const xhr = await Zotero.HTTP.request("GET", `https://dict.cn/${data2.raw}`, {
      responseType: "text"
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response;
    try {
      const doc = new DOMParser().parseFromString(res, "text/html");
      const audioList = [];
      for (const span of Array.from(
        doc.querySelectorAll("div.phonetic > span")
      )) {
        const text = span.innerText.replace(/\s+/g, " ").trim();
        for (const item of Array.from(
          span.querySelectorAll("i")
        )) {
          audioList.push({
            text: `${text} ${item.title}`,
            url: `https://audio.dict.cn/${item.getAttribute("naudio")}`
          });
        }
      }
      data2.audio = audioList;
      const items = Array.from(
        doc.querySelectorAll("ul.dict-basic-ul > li")
      ).filter((item) => !item.querySelector("script")).map((item) => item.innerText.replace(/\s+/g, " ").trim()).filter((item) => Boolean(item));
      data2.result = `${items.join("\n")}
`;
    } catch (e) {
      throw "Parse error";
    }
  };
  var HaiciDict = {
    id: "haicidict",
    type: "word",
    translate: translate16
  };

  // src/modules/services/gramotadict.ts
  var translate17 = async function(data2) {
    const word = data2.raw.trim();
    Zotero.debug("[GramotaDict] looking up: " + word);
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://gramota.ru/poisk?query=${encodeURIComponent(word)}&mode=all`,
      { responseType: "text" }
    );
    Zotero.debug("[GramotaDict] response status: " + xhr?.status);
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const doc = new DOMParser().parseFromString(xhr.response, "text/html");
    const metaWidget = doc.querySelector(".meta-dictionary-widget");
    Zotero.debug("[GramotaDict] meta-widget found: " + !!metaWidget);
    if (!metaWidget) {
      throw "\u0421\u043B\u043E\u0432\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0441\u043B\u043E\u0432\u0430\u0440\u044F\u0445";
    }
    const title = metaWidget.querySelector(".title")?.textContent?.trim() || word;
    const crHlEl = metaWidget.querySelector(".hl-line .cr-hl");
    const crHlText = crHlEl?.textContent?.trim() || "";
    const definitions = [];
    const items = metaWidget.querySelectorAll(
      ".numbered .order-list .item"
    );
    items.forEach((item) => {
      const number = item.querySelector(".number")?.textContent?.trim() || "";
      const content = item.querySelector(".content");
      if (content) {
        const clone = content.cloneNode(true);
        clone.querySelectorAll(".grey-badge").forEach((badge) => {
          const text2 = badge.textContent?.trim() || "";
          badge.replaceWith(`(${text2})`);
        });
        const text = clone.textContent?.trim()?.replace(/\s+/g, " ") || "";
        if (text) {
          definitions.push(number ? `${number} ${text}` : text);
        }
      }
    });
    let result = title;
    if (crHlText) result += `
${crHlText}`;
    if (definitions.length > 0) result += `

${definitions.join("\n")}`;
    Zotero.debug("[GramotaDict] result: " + result);
    data2.result = result;
  };
  var GramotaDict = {
    id: "gramotadict",
    type: "word",
    translate: translate17
  };

  // src/modules/services/huoshan.ts
  var translate18 = async function(data2) {
    const params = data2.secret.split("#");
    const id = params[0];
    const key = params[1];
    function getDateTimeNow() {
      const now = /* @__PURE__ */ new Date();
      return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    }
    async function getSigningKey(sk2, metaData) {
      const kDate = await hmacSha256Digest(metaData.date, sk2);
      const kRegion = await hmacSha256Digest(metaData.region, kDate);
      const kService = await hmacSha256Digest(metaData.service, kRegion);
      return await hmacSha256Digest("request", kService);
    }
    function getStringHeaders(header2) {
      let str = "";
      const keys = Object.keys(header2).sort();
      keys.forEach((key2) => {
        str += `${key2.toLocaleLowerCase()}:${header2[key2]}
`;
      });
      return str;
    }
    function getSignedHeaders(header2) {
      const keys = Object.keys(header2).sort();
      const headerList = keys.map((v) => v.toLocaleLowerCase());
      return headerList.join(";");
    }
    const ak = id;
    const sk = key;
    const currTime = getDateTimeNow();
    const requestObj = {
      method: "POST",
      url: "/",
      param: "Action=TranslateText&Version=2020-06-01",
      service: "translate",
      region: "cn-north-1",
      version: "2020-06-01",
      date: currTime,
      algorithm: "HMAC-SHA256"
    };
    const requestBody = {
      TargetLanguage: "zh",
      TextList: [data2.raw]
    };
    const XContentSha256 = hex(await sha256Digest(JSON.stringify(requestBody)));
    const header = {
      "Content-Type": "application/json",
      "X-Date": currTime,
      "X-Content-Sha256": XContentSha256
    };
    const canonicalRequest = [
      requestObj.method,
      requestObj.url,
      requestObj.param,
      getStringHeaders(header),
      getSignedHeaders(header),
      header["X-Content-Sha256"]
    ].join("\n");
    const hashCanonicalRequest = hex(await sha256Digest(canonicalRequest));
    const signingStr = [
      requestObj.algorithm,
      currTime,
      `${currTime}/${requestObj.region}/${requestObj.service}/request`,
      hashCanonicalRequest
    ].join("\n");
    const signingKey = await getSigningKey(sk, requestObj);
    const sign = hex(await hmacSha256Digest(signingStr, signingKey));
    const authorization = [
      `${requestObj.algorithm} Credential=${ak}/${currTime}/${requestObj.region}/${requestObj.service}/request`,
      "SignedHeaders=" + getSignedHeaders(header),
      `Signature=${sign}`
    ].join(", ");
    header["Authorization"] = authorization;
    const xhr = await Zotero.HTTP.request(
      "POST",
      "http://translate.volcengineapi.com/?Action=TranslateText&Version=2020-06-01",
      {
        headers: header,
        body: JSON.stringify(requestBody)
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const { TranslationList } = JSON.parse(xhr.response);
    data2.result = TranslationList[0].Translation;
  };
  var Huoshan = {
    id: "huoshan",
    type: "sentence",
    defaultSecret: "accessKeyId#accessKeySecret",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = parts.length === 2;
      const partsInfo = `AccessKeyId: ${parts[0]}
AccessKeySecret: ${parts[1]}`;
      return {
        secret,
        status: flag && secret !== Huoshan.defaultSecret,
        info: secret === Huoshan.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of Huoshan Text Translation is AccessKeyId#AccessKeySecret. The secret must have 2 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate18
  };

  // src/modules/services/huoshanweb.ts
  var HuoshanWeb = {
    id: "huoshanweb",
    name: "Huoshan Web",
    type: "sentence",
    translate: async function(data2) {
      const { raw: text } = data2;
      const from = (data2.langfrom || "").split("-")[0];
      const to = (data2.langto || "").split("-")[0];
      const URL2 = "https://translate.volcengine.com/crx/translate/v1";
      const body = {
        source_language: from,
        target_language: to,
        text
      };
      const headers = {
        "content-type": "application/json"
      };
      const xhr = await Zotero.HTTP.request("POST", URL2, {
        headers,
        body: JSON.stringify(body),
        responseType: "json"
      });
      if (xhr.status !== 200) {
        throw `Request error: ${xhr.status}`;
      }
      const result = xhr.response;
      const { translation } = result;
      if (translation) {
        data2.result = translation;
      } else {
        throw JSON.stringify(result);
      }
    }
  };

  // src/modules/services/libretranslate.ts
  init_prefs();
  var translate19 = async function(data2) {
    const endpoint = getPref("libretranslate.endpoint") || "http://localhost:5000";
    const apiKey = data2.secret;
    const requestBody = {
      q: data2.raw,
      source: data2.langfrom.split("-")[0],
      target: data2.langto.split("-")[0],
      format: "text"
    };
    if (apiKey) {
      requestBody.api_key = apiKey;
    }
    const xhr = await Zotero.HTTP.request("POST", `${endpoint}/translate`, {
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      responseType: "json"
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.error) {
      throw `Service error: ${xhr.response.error}`;
    }
    data2.result = xhr.response.translatedText;
  };
  var LibreTranslate = {
    id: "libretranslate",
    type: "sentence",
    helpUrl: "https://github.com/LibreTranslate/LibreTranslate",
    translate: translate19,
    config(settings) {
      settings.addTextSetting({
        prefKey: "libretranslate.endpoint",
        nameKey: "service-libretranslate-dialog-endPoint",
        placeholder: "http://localhost:5000"
      });
    },
    requireExternalConfig: true
  };

  // src/modules/services/microsoft.ts
  var translate20 = async function(data2) {
    const reqBody = JSON.stringify([{ Text: data2.raw }]);
    const params = data2.secret.split("#");
    const secretKey = params[0];
    const headers = {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": secretKey
    };
    if (params[1]) {
      const region = params[1].replace(" ", "").toLowerCase();
      if (params[1] != "global") headers["Ocp-Apim-Subscription-Region"] = region;
    }
    const xhr = await Zotero.HTTP.request(
      "POST",
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${data2.langto}`,
      {
        headers,
        responseType: "json",
        body: reqBody
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const result = xhr.response[0].translations[0].text;
    if (!result) {
      throw `Parse error: ${JSON.stringify(xhr.response)}`;
    }
    data2.result = result;
  };
  var Microsoft = {
    id: "microsoft",
    type: "sentence",
    defaultSecret: "",
    secretValidator(secret) {
      const params = secret.split("#");
      const serviceKey = params[0];
      const flag = serviceKey?.length === 32 || serviceKey?.length === 84;
      return {
        secret,
        status: flag,
        info: flag ? "" : `The secret is your Azure translate serviceKEY#region(required if the region is not global). The serviceKEY length must be 32 or 84, but got ${serviceKey?.length}.`
      };
    },
    translate: translate20
  };

  // src/modules/services/mtranserver.ts
  init_prefs();
  var translate21 = async function(data2) {
    const url = getPref("mtranserver.endpoint") || "http://localhost:8989/translate";
    const xhr = await Zotero.HTTP.request("POST", `${url}`, {
      headers: {
        authorization: `${data2.secret}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        text: data2.raw,
        from: mapLang2(data2.langfrom),
        to: mapLang2(data2.langto)
      }),
      responseType: "json"
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    try {
      data2.result = xhr.response.result;
    } catch {
      throw `Service error: ${xhr.response}`;
    }
  };
  function mapLang2(lang) {
    const versionlabel = getPref("mtranserver.versionlabel");
    if (versionlabel && lang in LANG_MAP3) {
      return LANG_MAP3[lang];
    }
    return lang.split("-")[0];
  }
  var LANG_MAP3 = {
    zh: "zh-Hans",
    "zh-CN": "zh-Hans",
    "zh-HK": "zh-Hant",
    "zh-MO": "zh-Hant",
    "zh-SG": "zh-Hans",
    "zh-TW": "zh-Hant"
  };
  var Mtranserver = {
    id: "mtranserver",
    type: "sentence",
    helpUrl: "https://github.com/xxnuo/MTranServer?tab=readme-ov-file#api-%E4%BD%BF%E7%94%A8",
    translate: translate21,
    config(settings) {
      settings.addTextSetting({
        prefKey: "mtranserver.endpoint",
        nameKey: "service-mtranserver-dialog-endPoint"
      }).addCheckboxSetting({
        prefKey: "mtranserver.versionlabel",
        nameKey: "service-mtranserver-dialog-versionlabel"
      });
    },
    requireExternalConfig: true
  };

  // node_modules/jsencrypt/lib/lib/jsbn/util.js
  var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
  function int2char(n) {
    return BI_RM.charAt(n);
  }
  function op_and(x, y) {
    return x & y;
  }
  function op_or(x, y) {
    return x | y;
  }
  function op_xor(x, y) {
    return x ^ y;
  }
  function op_andnot(x, y) {
    return x & ~y;
  }
  function lbit(x) {
    if (x == 0) {
      return -1;
    }
    var r = 0;
    if ((x & 65535) == 0) {
      x >>= 16;
      r += 16;
    }
    if ((x & 255) == 0) {
      x >>= 8;
      r += 8;
    }
    if ((x & 15) == 0) {
      x >>= 4;
      r += 4;
    }
    if ((x & 3) == 0) {
      x >>= 2;
      r += 2;
    }
    if ((x & 1) == 0) {
      ++r;
    }
    return r;
  }
  function cbit(x) {
    var r = 0;
    while (x != 0) {
      x &= x - 1;
      ++r;
    }
    return r;
  }

  // node_modules/jsencrypt/lib/lib/jsbn/base64.js
  var b64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var b64pad = "=";
  function hex2b64(h) {
    var i;
    var c;
    var ret = "";
    for (i = 0; i + 3 <= h.length; i += 3) {
      c = parseInt(h.substring(i, i + 3), 16);
      ret += b64map.charAt(c >> 6) + b64map.charAt(c & 63);
    }
    if (i + 1 == h.length) {
      c = parseInt(h.substring(i, i + 1), 16);
      ret += b64map.charAt(c << 2);
    } else if (i + 2 == h.length) {
      c = parseInt(h.substring(i, i + 2), 16);
      ret += b64map.charAt(c >> 2) + b64map.charAt((c & 3) << 4);
    }
    while ((ret.length & 3) > 0) {
      ret += b64pad;
    }
    return ret;
  }
  function b64tohex(s) {
    var ret = "";
    var i;
    var k = 0;
    var slop = 0;
    for (i = 0; i < s.length; ++i) {
      if (s.charAt(i) == b64pad) {
        break;
      }
      var v = b64map.indexOf(s.charAt(i));
      if (v < 0) {
        continue;
      }
      if (k == 0) {
        ret += int2char(v >> 2);
        slop = v & 3;
        k = 1;
      } else if (k == 1) {
        ret += int2char(slop << 2 | v >> 4);
        slop = v & 15;
        k = 2;
      } else if (k == 2) {
        ret += int2char(slop);
        ret += int2char(v >> 2);
        slop = v & 3;
        k = 3;
      } else {
        ret += int2char(slop << 2 | v >> 4);
        ret += int2char(v & 15);
        k = 0;
      }
    }
    if (k == 1) {
      ret += int2char(slop << 2);
    }
    return ret;
  }

  // node_modules/jsencrypt/lib/lib/asn1js/hex.js
  var decoder;
  var Hex = {
    decode: function(a) {
      var i;
      if (decoder === void 0) {
        var hex2 = "0123456789ABCDEF";
        var ignore = " \f\n\r	\xA0\u2028\u2029";
        decoder = {};
        for (i = 0; i < 16; ++i) {
          decoder[hex2.charAt(i)] = i;
        }
        hex2 = hex2.toLowerCase();
        for (i = 10; i < 16; ++i) {
          decoder[hex2.charAt(i)] = i;
        }
        for (i = 0; i < ignore.length; ++i) {
          decoder[ignore.charAt(i)] = -1;
        }
      }
      var out = [];
      var bits = 0;
      var char_count = 0;
      for (i = 0; i < a.length; ++i) {
        var c = a.charAt(i);
        if (c == "=") {
          break;
        }
        c = decoder[c];
        if (c == -1) {
          continue;
        }
        if (c === void 0) {
          throw new Error("Illegal character at offset " + i);
        }
        bits |= c;
        if (++char_count >= 2) {
          out[out.length] = bits;
          bits = 0;
          char_count = 0;
        } else {
          bits <<= 4;
        }
      }
      if (char_count) {
        throw new Error("Hex encoding incomplete: 4 bits missing");
      }
      return out;
    }
  };

  // node_modules/jsencrypt/lib/lib/asn1js/base64.js
  var decoder2;
  var Base64 = {
    decode: function(a) {
      var i;
      if (decoder2 === void 0) {
        var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var ignore = "= \f\n\r	\xA0\u2028\u2029";
        decoder2 = /* @__PURE__ */ Object.create(null);
        for (i = 0; i < 64; ++i) {
          decoder2[b64.charAt(i)] = i;
        }
        decoder2["-"] = 62;
        decoder2["_"] = 63;
        for (i = 0; i < ignore.length; ++i) {
          decoder2[ignore.charAt(i)] = -1;
        }
      }
      var out = [];
      var bits = 0;
      var char_count = 0;
      for (i = 0; i < a.length; ++i) {
        var c = a.charAt(i);
        if (c == "=") {
          break;
        }
        c = decoder2[c];
        if (c == -1) {
          continue;
        }
        if (c === void 0) {
          throw new Error("Illegal character at offset " + i);
        }
        bits |= c;
        if (++char_count >= 4) {
          out[out.length] = bits >> 16;
          out[out.length] = bits >> 8 & 255;
          out[out.length] = bits & 255;
          bits = 0;
          char_count = 0;
        } else {
          bits <<= 6;
        }
      }
      switch (char_count) {
        case 1:
          throw new Error("Base64 encoding incomplete: at least 2 bits missing");
        case 2:
          out[out.length] = bits >> 10;
          break;
        case 3:
          out[out.length] = bits >> 16;
          out[out.length] = bits >> 8 & 255;
          break;
      }
      return out;
    },
    re: /-----BEGIN [^-]+-----([A-Za-z0-9+\/=\s]+)-----END [^-]+-----|begin-base64[^\n]+\n([A-Za-z0-9+\/=\s]+)====/,
    unarmor: function(a) {
      var m = Base64.re.exec(a);
      if (m) {
        if (m[1]) {
          a = m[1];
        } else if (m[2]) {
          a = m[2];
        } else {
          throw new Error("RegExp out of sync");
        }
      }
      return Base64.decode(a);
    }
  };

  // node_modules/jsencrypt/lib/lib/asn1js/int10.js
  var max = 1e13;
  var Int10 = (
    /** @class */
    (function() {
      function Int102(value) {
        this.buf = [+value || 0];
      }
      Int102.prototype.mulAdd = function(m, c) {
        var b = this.buf;
        var l = b.length;
        var i;
        var t;
        for (i = 0; i < l; ++i) {
          t = b[i] * m + c;
          if (t < max) {
            c = 0;
          } else {
            c = 0 | t / max;
            t -= c * max;
          }
          b[i] = t;
        }
        if (c > 0) {
          b[i] = c;
        }
      };
      Int102.prototype.sub = function(c) {
        var b = this.buf;
        var l = b.length;
        var i;
        var t;
        for (i = 0; i < l; ++i) {
          t = b[i] - c;
          if (t < 0) {
            t += max;
            c = 1;
          } else {
            c = 0;
          }
          b[i] = t;
        }
        while (b[b.length - 1] === 0) {
          b.pop();
        }
      };
      Int102.prototype.toString = function(base) {
        if ((base || 10) != 10) {
          throw new Error("only base 10 is supported");
        }
        var b = this.buf;
        var s = b[b.length - 1].toString();
        for (var i = b.length - 2; i >= 0; --i) {
          s += (max + b[i]).toString().substring(1);
        }
        return s;
      };
      Int102.prototype.valueOf = function() {
        var b = this.buf;
        var v = 0;
        for (var i = b.length - 1; i >= 0; --i) {
          v = v * max + b[i];
        }
        return v;
      };
      Int102.prototype.simplify = function() {
        var b = this.buf;
        return b.length == 1 ? b[0] : this;
      };
      return Int102;
    })()
  );

  // node_modules/jsencrypt/lib/lib/asn1js/asn1.js
  var ellipsis = "\u2026";
  var reTimeS = /^(\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/;
  var reTimeL = /^(\d\d\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/;
  function stringCut(str, len) {
    if (str.length > len) {
      str = str.substring(0, len) + ellipsis;
    }
    return str;
  }
  var Stream = (
    /** @class */
    (function() {
      function Stream2(enc, pos) {
        this.hexDigits = "0123456789ABCDEF";
        if (enc instanceof Stream2) {
          this.enc = enc.enc;
          this.pos = enc.pos;
        } else {
          this.enc = enc;
          this.pos = pos;
        }
      }
      Stream2.prototype.get = function(pos) {
        if (pos === void 0) {
          pos = this.pos++;
        }
        if (pos >= this.enc.length) {
          throw new Error("Requesting byte offset ".concat(pos, " on a stream of length ").concat(this.enc.length));
        }
        return "string" === typeof this.enc ? this.enc.charCodeAt(pos) : this.enc[pos];
      };
      Stream2.prototype.hexByte = function(b) {
        return this.hexDigits.charAt(b >> 4 & 15) + this.hexDigits.charAt(b & 15);
      };
      Stream2.prototype.hexDump = function(start, end, raw) {
        var s = "";
        for (var i = start; i < end; ++i) {
          s += this.hexByte(this.get(i));
          if (raw !== true) {
            switch (i & 15) {
              case 7:
                s += "  ";
                break;
              case 15:
                s += "\n";
                break;
              default:
                s += " ";
            }
          }
        }
        return s;
      };
      Stream2.prototype.isASCII = function(start, end) {
        for (var i = start; i < end; ++i) {
          var c = this.get(i);
          if (c < 32 || c > 176) {
            return false;
          }
        }
        return true;
      };
      Stream2.prototype.parseStringISO = function(start, end) {
        var s = "";
        for (var i = start; i < end; ++i) {
          s += String.fromCharCode(this.get(i));
        }
        return s;
      };
      Stream2.prototype.parseStringUTF = function(start, end) {
        var s = "";
        for (var i = start; i < end; ) {
          var c = this.get(i++);
          if (c < 128) {
            s += String.fromCharCode(c);
          } else if (c > 191 && c < 224) {
            s += String.fromCharCode((c & 31) << 6 | this.get(i++) & 63);
          } else {
            s += String.fromCharCode((c & 15) << 12 | (this.get(i++) & 63) << 6 | this.get(i++) & 63);
          }
        }
        return s;
      };
      Stream2.prototype.parseStringBMP = function(start, end) {
        var str = "";
        var hi;
        var lo;
        for (var i = start; i < end; ) {
          hi = this.get(i++);
          lo = this.get(i++);
          str += String.fromCharCode(hi << 8 | lo);
        }
        return str;
      };
      Stream2.prototype.parseTime = function(start, end, shortYear) {
        var s = this.parseStringISO(start, end);
        var m = (shortYear ? reTimeS : reTimeL).exec(s);
        if (!m) {
          return "Unrecognized time: " + s;
        }
        if (shortYear) {
          m[1] = +m[1];
          m[1] += +m[1] < 70 ? 2e3 : 1900;
        }
        s = m[1] + "-" + m[2] + "-" + m[3] + " " + m[4];
        if (m[5]) {
          s += ":" + m[5];
          if (m[6]) {
            s += ":" + m[6];
            if (m[7]) {
              s += "." + m[7];
            }
          }
        }
        if (m[8]) {
          s += " UTC";
          if (m[8] != "Z") {
            s += m[8];
            if (m[9]) {
              s += ":" + m[9];
            }
          }
        }
        return s;
      };
      Stream2.prototype.parseInteger = function(start, end) {
        var v = this.get(start);
        var neg = v > 127;
        var pad = neg ? 255 : 0;
        var len;
        var s = "";
        while (v == pad && ++start < end) {
          v = this.get(start);
        }
        len = end - start;
        if (len === 0) {
          return neg ? -1 : 0;
        }
        if (len > 4) {
          s = v;
          len <<= 3;
          while (((+s ^ pad) & 128) == 0) {
            s = +s << 1;
            --len;
          }
          s = "(" + len + " bit)\n";
        }
        if (neg) {
          v = v - 256;
        }
        var n = new Int10(v);
        for (var i = start + 1; i < end; ++i) {
          n.mulAdd(256, this.get(i));
        }
        return s + n.toString();
      };
      Stream2.prototype.parseBitString = function(start, end, maxLength) {
        var unusedBit = this.get(start);
        var lenBit = (end - start - 1 << 3) - unusedBit;
        var intro = "(" + lenBit + " bit)\n";
        var s = "";
        for (var i = start + 1; i < end; ++i) {
          var b = this.get(i);
          var skip = i == end - 1 ? unusedBit : 0;
          for (var j = 7; j >= skip; --j) {
            s += b >> j & 1 ? "1" : "0";
          }
          if (s.length > maxLength) {
            return intro + stringCut(s, maxLength);
          }
        }
        return intro + s;
      };
      Stream2.prototype.parseOctetString = function(start, end, maxLength) {
        if (this.isASCII(start, end)) {
          return stringCut(this.parseStringISO(start, end), maxLength);
        }
        var len = end - start;
        var s = "(" + len + " byte)\n";
        maxLength /= 2;
        if (len > maxLength) {
          end = start + maxLength;
        }
        for (var i = start; i < end; ++i) {
          s += this.hexByte(this.get(i));
        }
        if (len > maxLength) {
          s += ellipsis;
        }
        return s;
      };
      Stream2.prototype.parseOID = function(start, end, maxLength) {
        var s = "";
        var n = new Int10();
        var bits = 0;
        for (var i = start; i < end; ++i) {
          var v = this.get(i);
          n.mulAdd(128, v & 127);
          bits += 7;
          if (!(v & 128)) {
            if (s === "") {
              n = n.simplify();
              if (n instanceof Int10) {
                n.sub(80);
                s = "2." + n.toString();
              } else {
                var m = n < 80 ? n < 40 ? 0 : 1 : 2;
                s = m + "." + (n - m * 40);
              }
            } else {
              s += "." + n.toString();
            }
            if (s.length > maxLength) {
              return stringCut(s, maxLength);
            }
            n = new Int10();
            bits = 0;
          }
        }
        if (bits > 0) {
          s += ".incomplete";
        }
        return s;
      };
      return Stream2;
    })()
  );
  var ASN1 = (
    /** @class */
    (function() {
      function ASN12(stream, header, length, tag, sub) {
        if (!(tag instanceof ASN1Tag)) {
          throw new Error("Invalid tag value.");
        }
        this.stream = stream;
        this.header = header;
        this.length = length;
        this.tag = tag;
        this.sub = sub;
      }
      ASN12.prototype.typeName = function() {
        switch (this.tag.tagClass) {
          case 0:
            switch (this.tag.tagNumber) {
              case 0:
                return "EOC";
              case 1:
                return "BOOLEAN";
              case 2:
                return "INTEGER";
              case 3:
                return "BIT_STRING";
              case 4:
                return "OCTET_STRING";
              case 5:
                return "NULL";
              case 6:
                return "OBJECT_IDENTIFIER";
              case 7:
                return "ObjectDescriptor";
              case 8:
                return "EXTERNAL";
              case 9:
                return "REAL";
              case 10:
                return "ENUMERATED";
              case 11:
                return "EMBEDDED_PDV";
              case 12:
                return "UTF8String";
              case 16:
                return "SEQUENCE";
              case 17:
                return "SET";
              case 18:
                return "NumericString";
              case 19:
                return "PrintableString";
              // ASCII subset
              case 20:
                return "TeletexString";
              // aka T61String
              case 21:
                return "VideotexString";
              case 22:
                return "IA5String";
              // ASCII
              case 23:
                return "UTCTime";
              case 24:
                return "GeneralizedTime";
              case 25:
                return "GraphicString";
              case 26:
                return "VisibleString";
              // ASCII subset
              case 27:
                return "GeneralString";
              case 28:
                return "UniversalString";
              case 30:
                return "BMPString";
            }
            return "Universal_" + this.tag.tagNumber.toString();
          case 1:
            return "Application_" + this.tag.tagNumber.toString();
          case 2:
            return "[" + this.tag.tagNumber.toString() + "]";
          // Context
          case 3:
            return "Private_" + this.tag.tagNumber.toString();
        }
      };
      ASN12.prototype.content = function(maxLength) {
        if (this.tag === void 0) {
          return null;
        }
        if (maxLength === void 0) {
          maxLength = Infinity;
        }
        var content = this.posContent();
        var len = Math.abs(this.length);
        if (!this.tag.isUniversal()) {
          if (this.sub !== null) {
            return "(" + this.sub.length + " elem)";
          }
          return this.stream.parseOctetString(content, content + len, maxLength);
        }
        switch (this.tag.tagNumber) {
          case 1:
            return this.stream.get(content) === 0 ? "false" : "true";
          case 2:
            return this.stream.parseInteger(content, content + len);
          case 3:
            return this.sub ? "(" + this.sub.length + " elem)" : this.stream.parseBitString(content, content + len, maxLength);
          case 4:
            return this.sub ? "(" + this.sub.length + " elem)" : this.stream.parseOctetString(content, content + len, maxLength);
          // case 0x05: // NULL
          case 6:
            return this.stream.parseOID(content, content + len, maxLength);
          // case 0x07: // ObjectDescriptor
          // case 0x08: // EXTERNAL
          // case 0x09: // REAL
          // case 0x0A: // ENUMERATED
          // case 0x0B: // EMBEDDED_PDV
          case 16:
          // SEQUENCE
          case 17:
            if (this.sub !== null) {
              return "(" + this.sub.length + " elem)";
            } else {
              return "(no elem)";
            }
          case 12:
            return stringCut(this.stream.parseStringUTF(content, content + len), maxLength);
          case 18:
          // NumericString
          case 19:
          // PrintableString
          case 20:
          // TeletexString
          case 21:
          // VideotexString
          case 22:
          // IA5String
          // case 0x19: // GraphicString
          case 26:
            return stringCut(this.stream.parseStringISO(content, content + len), maxLength);
          case 30:
            return stringCut(this.stream.parseStringBMP(content, content + len), maxLength);
          case 23:
          // UTCTime
          case 24:
            return this.stream.parseTime(content, content + len, this.tag.tagNumber == 23);
        }
        return null;
      };
      ASN12.prototype.toString = function() {
        return this.typeName() + "@" + this.stream.pos + "[header:" + this.header + ",length:" + this.length + ",sub:" + (this.sub === null ? "null" : this.sub.length) + "]";
      };
      ASN12.prototype.toPrettyString = function(indent) {
        if (indent === void 0) {
          indent = "";
        }
        var s = indent + this.typeName() + " @" + this.stream.pos;
        if (this.length >= 0) {
          s += "+";
        }
        s += this.length;
        if (this.tag.tagConstructed) {
          s += " (constructed)";
        } else if (this.tag.isUniversal() && (this.tag.tagNumber == 3 || this.tag.tagNumber == 4) && this.sub !== null) {
          s += " (encapsulates)";
        }
        s += "\n";
        if (this.sub !== null) {
          indent += "  ";
          for (var i = 0, max2 = this.sub.length; i < max2; ++i) {
            s += this.sub[i].toPrettyString(indent);
          }
        }
        return s;
      };
      ASN12.prototype.posStart = function() {
        return this.stream.pos;
      };
      ASN12.prototype.posContent = function() {
        return this.stream.pos + this.header;
      };
      ASN12.prototype.posEnd = function() {
        return this.stream.pos + this.header + Math.abs(this.length);
      };
      ASN12.prototype.toHexString = function() {
        return this.stream.hexDump(this.posStart(), this.posEnd(), true);
      };
      ASN12.decodeLength = function(stream) {
        var buf = stream.get();
        var len = buf & 127;
        if (len == buf) {
          return len;
        }
        if (len > 6) {
          throw new Error("Length over 48 bits not supported at position " + (stream.pos - 1));
        }
        if (len === 0) {
          return null;
        }
        buf = 0;
        for (var i = 0; i < len; ++i) {
          buf = buf * 256 + stream.get();
        }
        return buf;
      };
      ASN12.prototype.getHexStringValue = function() {
        var hexString = this.toHexString();
        var offset = this.header * 2;
        var length = this.length * 2;
        return hexString.substring(offset, offset + length);
      };
      ASN12.decode = function(str) {
        var stream;
        if (!(str instanceof Stream)) {
          stream = new Stream(str, 0);
        } else {
          stream = str;
        }
        var streamStart = new Stream(stream);
        var tag = new ASN1Tag(stream);
        var len = ASN12.decodeLength(stream);
        var start = stream.pos;
        var header = start - streamStart.pos;
        var sub = null;
        var getSub = function() {
          var ret = [];
          if (len !== null) {
            var end = start + len;
            while (stream.pos < end) {
              ret[ret.length] = ASN12.decode(stream);
            }
            if (stream.pos != end) {
              throw new Error("Content size is not correct for container starting at offset " + start);
            }
          } else {
            try {
              for (; ; ) {
                var s = ASN12.decode(stream);
                if (s.tag.isEOC()) {
                  break;
                }
                ret[ret.length] = s;
              }
              len = start - stream.pos;
            } catch (e) {
              throw new Error("Exception while decoding undefined length content: " + e);
            }
          }
          return ret;
        };
        if (tag.tagConstructed) {
          sub = getSub();
        } else if (tag.isUniversal() && (tag.tagNumber == 3 || tag.tagNumber == 4)) {
          try {
            if (tag.tagNumber == 3) {
              if (stream.get() != 0) {
                throw new Error("BIT STRINGs with unused bits cannot encapsulate.");
              }
            }
            sub = getSub();
            for (var i = 0; i < sub.length; ++i) {
              if (sub[i].tag.isEOC()) {
                throw new Error("EOC is not supposed to be actual content.");
              }
            }
          } catch (e) {
            sub = null;
          }
        }
        if (sub === null) {
          if (len === null) {
            throw new Error("We can't skip over an invalid tag with undefined length at offset " + start);
          }
          stream.pos = start + Math.abs(len);
        }
        return new ASN12(streamStart, header, len, tag, sub);
      };
      return ASN12;
    })()
  );
  var ASN1Tag = (
    /** @class */
    (function() {
      function ASN1Tag2(stream) {
        var buf = stream.get();
        this.tagClass = buf >> 6;
        this.tagConstructed = (buf & 32) !== 0;
        this.tagNumber = buf & 31;
        if (this.tagNumber == 31) {
          var n = new Int10();
          do {
            buf = stream.get();
            n.mulAdd(128, buf & 127);
          } while (buf & 128);
          this.tagNumber = n.simplify();
        }
      }
      ASN1Tag2.prototype.isUniversal = function() {
        return this.tagClass === 0;
      };
      ASN1Tag2.prototype.isEOC = function() {
        return this.tagClass === 0 && this.tagNumber === 0;
      };
      return ASN1Tag2;
    })()
  );

  // node_modules/jsencrypt/lib/lib/jsbn/jsbn.js
  var dbits;
  var canary = 244837814094590;
  var j_lm = (canary & 16777215) == 15715070;
  var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
  var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];
  var BigInteger = (
    /** @class */
    (function() {
      function BigInteger2(a, b, c) {
        if (a != null) {
          if ("number" == typeof a) {
            this.fromNumber(a, b, c);
          } else if (b == null && "string" != typeof a) {
            this.fromString(a, 256);
          } else {
            this.fromString(a, b);
          }
        }
      }
      BigInteger2.prototype.toString = function(b) {
        if (this.s < 0) {
          return "-" + this.negate().toString(b);
        }
        var k;
        if (b == 16) {
          k = 4;
        } else if (b == 8) {
          k = 3;
        } else if (b == 2) {
          k = 1;
        } else if (b == 32) {
          k = 5;
        } else if (b == 4) {
          k = 2;
        } else {
          return this.toRadix(b);
        }
        var km = (1 << k) - 1;
        var d;
        var m = false;
        var r = "";
        var i = this.t;
        var p = this.DB - i * this.DB % k;
        if (i-- > 0) {
          if (p < this.DB && (d = this[i] >> p) > 0) {
            m = true;
            r = int2char(d);
          }
          while (i >= 0) {
            if (p < k) {
              d = (this[i] & (1 << p) - 1) << k - p;
              d |= this[--i] >> (p += this.DB - k);
            } else {
              d = this[i] >> (p -= k) & km;
              if (p <= 0) {
                p += this.DB;
                --i;
              }
            }
            if (d > 0) {
              m = true;
            }
            if (m) {
              r += int2char(d);
            }
          }
        }
        return m ? r : "0";
      };
      BigInteger2.prototype.negate = function() {
        var r = nbi();
        BigInteger2.ZERO.subTo(this, r);
        return r;
      };
      BigInteger2.prototype.abs = function() {
        return this.s < 0 ? this.negate() : this;
      };
      BigInteger2.prototype.compareTo = function(a) {
        var r = this.s - a.s;
        if (r != 0) {
          return r;
        }
        var i = this.t;
        r = i - a.t;
        if (r != 0) {
          return this.s < 0 ? -r : r;
        }
        while (--i >= 0) {
          if ((r = this[i] - a[i]) != 0) {
            return r;
          }
        }
        return 0;
      };
      BigInteger2.prototype.bitLength = function() {
        if (this.t <= 0) {
          return 0;
        }
        return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ this.s & this.DM);
      };
      BigInteger2.prototype.mod = function(a) {
        var r = nbi();
        this.abs().divRemTo(a, null, r);
        if (this.s < 0 && r.compareTo(BigInteger2.ZERO) > 0) {
          a.subTo(r, r);
        }
        return r;
      };
      BigInteger2.prototype.modPowInt = function(e, m) {
        var z;
        if (e < 256 || m.isEven()) {
          z = new Classic(m);
        } else {
          z = new Montgomery(m);
        }
        return this.exp(e, z);
      };
      BigInteger2.prototype.clone = function() {
        var r = nbi();
        this.copyTo(r);
        return r;
      };
      BigInteger2.prototype.intValue = function() {
        if (this.s < 0) {
          if (this.t == 1) {
            return this[0] - this.DV;
          } else if (this.t == 0) {
            return -1;
          }
        } else if (this.t == 1) {
          return this[0];
        } else if (this.t == 0) {
          return 0;
        }
        return (this[1] & (1 << 32 - this.DB) - 1) << this.DB | this[0];
      };
      BigInteger2.prototype.byteValue = function() {
        return this.t == 0 ? this.s : this[0] << 24 >> 24;
      };
      BigInteger2.prototype.shortValue = function() {
        return this.t == 0 ? this.s : this[0] << 16 >> 16;
      };
      BigInteger2.prototype.signum = function() {
        if (this.s < 0) {
          return -1;
        } else if (this.t <= 0 || this.t == 1 && this[0] <= 0) {
          return 0;
        } else {
          return 1;
        }
      };
      BigInteger2.prototype.toByteArray = function() {
        var i = this.t;
        var r = [];
        r[0] = this.s;
        var p = this.DB - i * this.DB % 8;
        var d;
        var k = 0;
        if (i-- > 0) {
          if (p < this.DB && (d = this[i] >> p) != (this.s & this.DM) >> p) {
            r[k++] = d | this.s << this.DB - p;
          }
          while (i >= 0) {
            if (p < 8) {
              d = (this[i] & (1 << p) - 1) << 8 - p;
              d |= this[--i] >> (p += this.DB - 8);
            } else {
              d = this[i] >> (p -= 8) & 255;
              if (p <= 0) {
                p += this.DB;
                --i;
              }
            }
            if ((d & 128) != 0) {
              d |= -256;
            }
            if (k == 0 && (this.s & 128) != (d & 128)) {
              ++k;
            }
            if (k > 0 || d != this.s) {
              r[k++] = d;
            }
          }
        }
        return r;
      };
      BigInteger2.prototype.equals = function(a) {
        return this.compareTo(a) == 0;
      };
      BigInteger2.prototype.min = function(a) {
        return this.compareTo(a) < 0 ? this : a;
      };
      BigInteger2.prototype.max = function(a) {
        return this.compareTo(a) > 0 ? this : a;
      };
      BigInteger2.prototype.and = function(a) {
        var r = nbi();
        this.bitwiseTo(a, op_and, r);
        return r;
      };
      BigInteger2.prototype.or = function(a) {
        var r = nbi();
        this.bitwiseTo(a, op_or, r);
        return r;
      };
      BigInteger2.prototype.xor = function(a) {
        var r = nbi();
        this.bitwiseTo(a, op_xor, r);
        return r;
      };
      BigInteger2.prototype.andNot = function(a) {
        var r = nbi();
        this.bitwiseTo(a, op_andnot, r);
        return r;
      };
      BigInteger2.prototype.not = function() {
        var r = nbi();
        for (var i = 0; i < this.t; ++i) {
          r[i] = this.DM & ~this[i];
        }
        r.t = this.t;
        r.s = ~this.s;
        return r;
      };
      BigInteger2.prototype.shiftLeft = function(n) {
        var r = nbi();
        if (n < 0) {
          this.rShiftTo(-n, r);
        } else {
          this.lShiftTo(n, r);
        }
        return r;
      };
      BigInteger2.prototype.shiftRight = function(n) {
        var r = nbi();
        if (n < 0) {
          this.lShiftTo(-n, r);
        } else {
          this.rShiftTo(n, r);
        }
        return r;
      };
      BigInteger2.prototype.getLowestSetBit = function() {
        for (var i = 0; i < this.t; ++i) {
          if (this[i] != 0) {
            return i * this.DB + lbit(this[i]);
          }
        }
        if (this.s < 0) {
          return this.t * this.DB;
        }
        return -1;
      };
      BigInteger2.prototype.bitCount = function() {
        var r = 0;
        var x = this.s & this.DM;
        for (var i = 0; i < this.t; ++i) {
          r += cbit(this[i] ^ x);
        }
        return r;
      };
      BigInteger2.prototype.testBit = function(n) {
        var j = Math.floor(n / this.DB);
        if (j >= this.t) {
          return this.s != 0;
        }
        return (this[j] & 1 << n % this.DB) != 0;
      };
      BigInteger2.prototype.setBit = function(n) {
        return this.changeBit(n, op_or);
      };
      BigInteger2.prototype.clearBit = function(n) {
        return this.changeBit(n, op_andnot);
      };
      BigInteger2.prototype.flipBit = function(n) {
        return this.changeBit(n, op_xor);
      };
      BigInteger2.prototype.add = function(a) {
        var r = nbi();
        this.addTo(a, r);
        return r;
      };
      BigInteger2.prototype.subtract = function(a) {
        var r = nbi();
        this.subTo(a, r);
        return r;
      };
      BigInteger2.prototype.multiply = function(a) {
        var r = nbi();
        this.multiplyTo(a, r);
        return r;
      };
      BigInteger2.prototype.divide = function(a) {
        var r = nbi();
        this.divRemTo(a, r, null);
        return r;
      };
      BigInteger2.prototype.remainder = function(a) {
        var r = nbi();
        this.divRemTo(a, null, r);
        return r;
      };
      BigInteger2.prototype.divideAndRemainder = function(a) {
        var q = nbi();
        var r = nbi();
        this.divRemTo(a, q, r);
        return [q, r];
      };
      BigInteger2.prototype.modPow = function(e, m) {
        var i = e.bitLength();
        var k;
        var r = nbv(1);
        var z;
        if (i <= 0) {
          return r;
        } else if (i < 18) {
          k = 1;
        } else if (i < 48) {
          k = 3;
        } else if (i < 144) {
          k = 4;
        } else if (i < 768) {
          k = 5;
        } else {
          k = 6;
        }
        if (i < 8) {
          z = new Classic(m);
        } else if (m.isEven()) {
          z = new Barrett(m);
        } else {
          z = new Montgomery(m);
        }
        var g = [];
        var n = 3;
        var k1 = k - 1;
        var km = (1 << k) - 1;
        g[1] = z.convert(this);
        if (k > 1) {
          var g2 = nbi();
          z.sqrTo(g[1], g2);
          while (n <= km) {
            g[n] = nbi();
            z.mulTo(g2, g[n - 2], g[n]);
            n += 2;
          }
        }
        var j = e.t - 1;
        var w;
        var is1 = true;
        var r2 = nbi();
        var t;
        i = nbits(e[j]) - 1;
        while (j >= 0) {
          if (i >= k1) {
            w = e[j] >> i - k1 & km;
          } else {
            w = (e[j] & (1 << i + 1) - 1) << k1 - i;
            if (j > 0) {
              w |= e[j - 1] >> this.DB + i - k1;
            }
          }
          n = k;
          while ((w & 1) == 0) {
            w >>= 1;
            --n;
          }
          if ((i -= n) < 0) {
            i += this.DB;
            --j;
          }
          if (is1) {
            g[w].copyTo(r);
            is1 = false;
          } else {
            while (n > 1) {
              z.sqrTo(r, r2);
              z.sqrTo(r2, r);
              n -= 2;
            }
            if (n > 0) {
              z.sqrTo(r, r2);
            } else {
              t = r;
              r = r2;
              r2 = t;
            }
            z.mulTo(r2, g[w], r);
          }
          while (j >= 0 && (e[j] & 1 << i) == 0) {
            z.sqrTo(r, r2);
            t = r;
            r = r2;
            r2 = t;
            if (--i < 0) {
              i = this.DB - 1;
              --j;
            }
          }
        }
        return z.revert(r);
      };
      BigInteger2.prototype.modInverse = function(m) {
        var ac = m.isEven();
        if (this.isEven() && ac || m.signum() == 0) {
          return BigInteger2.ZERO;
        }
        var u = m.clone();
        var v = this.clone();
        var a = nbv(1);
        var b = nbv(0);
        var c = nbv(0);
        var d = nbv(1);
        while (u.signum() != 0) {
          while (u.isEven()) {
            u.rShiftTo(1, u);
            if (ac) {
              if (!a.isEven() || !b.isEven()) {
                a.addTo(this, a);
                b.subTo(m, b);
              }
              a.rShiftTo(1, a);
            } else if (!b.isEven()) {
              b.subTo(m, b);
            }
            b.rShiftTo(1, b);
          }
          while (v.isEven()) {
            v.rShiftTo(1, v);
            if (ac) {
              if (!c.isEven() || !d.isEven()) {
                c.addTo(this, c);
                d.subTo(m, d);
              }
              c.rShiftTo(1, c);
            } else if (!d.isEven()) {
              d.subTo(m, d);
            }
            d.rShiftTo(1, d);
          }
          if (u.compareTo(v) >= 0) {
            u.subTo(v, u);
            if (ac) {
              a.subTo(c, a);
            }
            b.subTo(d, b);
          } else {
            v.subTo(u, v);
            if (ac) {
              c.subTo(a, c);
            }
            d.subTo(b, d);
          }
        }
        if (v.compareTo(BigInteger2.ONE) != 0) {
          return BigInteger2.ZERO;
        }
        if (d.compareTo(m) >= 0) {
          return d.subtract(m);
        }
        if (d.signum() < 0) {
          d.addTo(m, d);
        } else {
          return d;
        }
        if (d.signum() < 0) {
          return d.add(m);
        } else {
          return d;
        }
      };
      BigInteger2.prototype.pow = function(e) {
        return this.exp(e, new NullExp());
      };
      BigInteger2.prototype.gcd = function(a) {
        var x = this.s < 0 ? this.negate() : this.clone();
        var y = a.s < 0 ? a.negate() : a.clone();
        if (x.compareTo(y) < 0) {
          var t = x;
          x = y;
          y = t;
        }
        var i = x.getLowestSetBit();
        var g = y.getLowestSetBit();
        if (g < 0) {
          return x;
        }
        if (i < g) {
          g = i;
        }
        if (g > 0) {
          x.rShiftTo(g, x);
          y.rShiftTo(g, y);
        }
        while (x.signum() > 0) {
          if ((i = x.getLowestSetBit()) > 0) {
            x.rShiftTo(i, x);
          }
          if ((i = y.getLowestSetBit()) > 0) {
            y.rShiftTo(i, y);
          }
          if (x.compareTo(y) >= 0) {
            x.subTo(y, x);
            x.rShiftTo(1, x);
          } else {
            y.subTo(x, y);
            y.rShiftTo(1, y);
          }
        }
        if (g > 0) {
          y.lShiftTo(g, y);
        }
        return y;
      };
      BigInteger2.prototype.isProbablePrime = function(t) {
        var i;
        var x = this.abs();
        if (x.t == 1 && x[0] <= lowprimes[lowprimes.length - 1]) {
          for (i = 0; i < lowprimes.length; ++i) {
            if (x[0] == lowprimes[i]) {
              return true;
            }
          }
          return false;
        }
        if (x.isEven()) {
          return false;
        }
        i = 1;
        while (i < lowprimes.length) {
          var m = lowprimes[i];
          var j = i + 1;
          while (j < lowprimes.length && m < lplim) {
            m *= lowprimes[j++];
          }
          m = x.modInt(m);
          while (i < j) {
            if (m % lowprimes[i++] == 0) {
              return false;
            }
          }
        }
        return x.millerRabin(t);
      };
      BigInteger2.prototype.copyTo = function(r) {
        for (var i = this.t - 1; i >= 0; --i) {
          r[i] = this[i];
        }
        r.t = this.t;
        r.s = this.s;
      };
      BigInteger2.prototype.fromInt = function(x) {
        this.t = 1;
        this.s = x < 0 ? -1 : 0;
        if (x > 0) {
          this[0] = x;
        } else if (x < -1) {
          this[0] = x + this.DV;
        } else {
          this.t = 0;
        }
      };
      BigInteger2.prototype.fromString = function(s, b) {
        var k;
        if (b == 16) {
          k = 4;
        } else if (b == 8) {
          k = 3;
        } else if (b == 256) {
          k = 8;
        } else if (b == 2) {
          k = 1;
        } else if (b == 32) {
          k = 5;
        } else if (b == 4) {
          k = 2;
        } else {
          this.fromRadix(s, b);
          return;
        }
        this.t = 0;
        this.s = 0;
        var i = s.length;
        var mi = false;
        var sh = 0;
        while (--i >= 0) {
          var x = k == 8 ? +s[i] & 255 : intAt(s, i);
          if (x < 0) {
            if (s.charAt(i) == "-") {
              mi = true;
            }
            continue;
          }
          mi = false;
          if (sh == 0) {
            this[this.t++] = x;
          } else if (sh + k > this.DB) {
            this[this.t - 1] |= (x & (1 << this.DB - sh) - 1) << sh;
            this[this.t++] = x >> this.DB - sh;
          } else {
            this[this.t - 1] |= x << sh;
          }
          sh += k;
          if (sh >= this.DB) {
            sh -= this.DB;
          }
        }
        if (k == 8 && (+s[0] & 128) != 0) {
          this.s = -1;
          if (sh > 0) {
            this[this.t - 1] |= (1 << this.DB - sh) - 1 << sh;
          }
        }
        this.clamp();
        if (mi) {
          BigInteger2.ZERO.subTo(this, this);
        }
      };
      BigInteger2.prototype.clamp = function() {
        var c = this.s & this.DM;
        while (this.t > 0 && this[this.t - 1] == c) {
          --this.t;
        }
      };
      BigInteger2.prototype.dlShiftTo = function(n, r) {
        var i;
        for (i = this.t - 1; i >= 0; --i) {
          r[i + n] = this[i];
        }
        for (i = n - 1; i >= 0; --i) {
          r[i] = 0;
        }
        r.t = this.t + n;
        r.s = this.s;
      };
      BigInteger2.prototype.drShiftTo = function(n, r) {
        for (var i = n; i < this.t; ++i) {
          r[i - n] = this[i];
        }
        r.t = Math.max(this.t - n, 0);
        r.s = this.s;
      };
      BigInteger2.prototype.lShiftTo = function(n, r) {
        var bs = n % this.DB;
        var cbs = this.DB - bs;
        var bm = (1 << cbs) - 1;
        var ds = Math.floor(n / this.DB);
        var c = this.s << bs & this.DM;
        for (var i = this.t - 1; i >= 0; --i) {
          r[i + ds + 1] = this[i] >> cbs | c;
          c = (this[i] & bm) << bs;
        }
        for (var i = ds - 1; i >= 0; --i) {
          r[i] = 0;
        }
        r[ds] = c;
        r.t = this.t + ds + 1;
        r.s = this.s;
        r.clamp();
      };
      BigInteger2.prototype.rShiftTo = function(n, r) {
        r.s = this.s;
        var ds = Math.floor(n / this.DB);
        if (ds >= this.t) {
          r.t = 0;
          return;
        }
        var bs = n % this.DB;
        var cbs = this.DB - bs;
        var bm = (1 << bs) - 1;
        r[0] = this[ds] >> bs;
        for (var i = ds + 1; i < this.t; ++i) {
          r[i - ds - 1] |= (this[i] & bm) << cbs;
          r[i - ds] = this[i] >> bs;
        }
        if (bs > 0) {
          r[this.t - ds - 1] |= (this.s & bm) << cbs;
        }
        r.t = this.t - ds;
        r.clamp();
      };
      BigInteger2.prototype.subTo = function(a, r) {
        var i = 0;
        var c = 0;
        var m = Math.min(a.t, this.t);
        while (i < m) {
          c += this[i] - a[i];
          r[i++] = c & this.DM;
          c >>= this.DB;
        }
        if (a.t < this.t) {
          c -= a.s;
          while (i < this.t) {
            c += this[i];
            r[i++] = c & this.DM;
            c >>= this.DB;
          }
          c += this.s;
        } else {
          c += this.s;
          while (i < a.t) {
            c -= a[i];
            r[i++] = c & this.DM;
            c >>= this.DB;
          }
          c -= a.s;
        }
        r.s = c < 0 ? -1 : 0;
        if (c < -1) {
          r[i++] = this.DV + c;
        } else if (c > 0) {
          r[i++] = c;
        }
        r.t = i;
        r.clamp();
      };
      BigInteger2.prototype.multiplyTo = function(a, r) {
        var x = this.abs();
        var y = a.abs();
        var i = x.t;
        r.t = i + y.t;
        while (--i >= 0) {
          r[i] = 0;
        }
        for (i = 0; i < y.t; ++i) {
          r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
        }
        r.s = 0;
        r.clamp();
        if (this.s != a.s) {
          BigInteger2.ZERO.subTo(r, r);
        }
      };
      BigInteger2.prototype.squareTo = function(r) {
        var x = this.abs();
        var i = r.t = 2 * x.t;
        while (--i >= 0) {
          r[i] = 0;
        }
        for (i = 0; i < x.t - 1; ++i) {
          var c = x.am(i, x[i], r, 2 * i, 0, 1);
          if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
            r[i + x.t] -= x.DV;
            r[i + x.t + 1] = 1;
          }
        }
        if (r.t > 0) {
          r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
        }
        r.s = 0;
        r.clamp();
      };
      BigInteger2.prototype.divRemTo = function(m, q, r) {
        var pm = m.abs();
        if (pm.t <= 0) {
          return;
        }
        var pt = this.abs();
        if (pt.t < pm.t) {
          if (q != null) {
            q.fromInt(0);
          }
          if (r != null) {
            this.copyTo(r);
          }
          return;
        }
        if (r == null) {
          r = nbi();
        }
        var y = nbi();
        var ts = this.s;
        var ms = m.s;
        var nsh = this.DB - nbits(pm[pm.t - 1]);
        if (nsh > 0) {
          pm.lShiftTo(nsh, y);
          pt.lShiftTo(nsh, r);
        } else {
          pm.copyTo(y);
          pt.copyTo(r);
        }
        var ys = y.t;
        var y0 = y[ys - 1];
        if (y0 == 0) {
          return;
        }
        var yt = y0 * (1 << this.F1) + (ys > 1 ? y[ys - 2] >> this.F2 : 0);
        var d1 = this.FV / yt;
        var d2 = (1 << this.F1) / yt;
        var e = 1 << this.F2;
        var i = r.t;
        var j = i - ys;
        var t = q == null ? nbi() : q;
        y.dlShiftTo(j, t);
        if (r.compareTo(t) >= 0) {
          r[r.t++] = 1;
          r.subTo(t, r);
        }
        BigInteger2.ONE.dlShiftTo(ys, t);
        t.subTo(y, y);
        while (y.t < ys) {
          y[y.t++] = 0;
        }
        while (--j >= 0) {
          var qd = r[--i] == y0 ? this.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
          if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
            y.dlShiftTo(j, t);
            r.subTo(t, r);
            while (r[i] < --qd) {
              r.subTo(t, r);
            }
          }
        }
        if (q != null) {
          r.drShiftTo(ys, q);
          if (ts != ms) {
            BigInteger2.ZERO.subTo(q, q);
          }
        }
        r.t = ys;
        r.clamp();
        if (nsh > 0) {
          r.rShiftTo(nsh, r);
        }
        if (ts < 0) {
          BigInteger2.ZERO.subTo(r, r);
        }
      };
      BigInteger2.prototype.invDigit = function() {
        if (this.t < 1) {
          return 0;
        }
        var x = this[0];
        if ((x & 1) == 0) {
          return 0;
        }
        var y = x & 3;
        y = y * (2 - (x & 15) * y) & 15;
        y = y * (2 - (x & 255) * y) & 255;
        y = y * (2 - ((x & 65535) * y & 65535)) & 65535;
        y = y * (2 - x * y % this.DV) % this.DV;
        return y > 0 ? this.DV - y : -y;
      };
      BigInteger2.prototype.isEven = function() {
        return (this.t > 0 ? this[0] & 1 : this.s) == 0;
      };
      BigInteger2.prototype.exp = function(e, z) {
        if (e > 4294967295 || e < 1) {
          return BigInteger2.ONE;
        }
        var r = nbi();
        var r2 = nbi();
        var g = z.convert(this);
        var i = nbits(e) - 1;
        g.copyTo(r);
        while (--i >= 0) {
          z.sqrTo(r, r2);
          if ((e & 1 << i) > 0) {
            z.mulTo(r2, g, r);
          } else {
            var t = r;
            r = r2;
            r2 = t;
          }
        }
        return z.revert(r);
      };
      BigInteger2.prototype.chunkSize = function(r) {
        return Math.floor(Math.LN2 * this.DB / Math.log(r));
      };
      BigInteger2.prototype.toRadix = function(b) {
        if (b == null) {
          b = 10;
        }
        if (this.signum() == 0 || b < 2 || b > 36) {
          return "0";
        }
        var cs = this.chunkSize(b);
        var a = Math.pow(b, cs);
        var d = nbv(a);
        var y = nbi();
        var z = nbi();
        var r = "";
        this.divRemTo(d, y, z);
        while (y.signum() > 0) {
          r = (a + z.intValue()).toString(b).substring(1) + r;
          y.divRemTo(d, y, z);
        }
        return z.intValue().toString(b) + r;
      };
      BigInteger2.prototype.fromRadix = function(s, b) {
        this.fromInt(0);
        if (b == null) {
          b = 10;
        }
        var cs = this.chunkSize(b);
        var d = Math.pow(b, cs);
        var mi = false;
        var j = 0;
        var w = 0;
        for (var i = 0; i < s.length; ++i) {
          var x = intAt(s, i);
          if (x < 0) {
            if (s.charAt(i) == "-" && this.signum() == 0) {
              mi = true;
            }
            continue;
          }
          w = b * w + x;
          if (++j >= cs) {
            this.dMultiply(d);
            this.dAddOffset(w, 0);
            j = 0;
            w = 0;
          }
        }
        if (j > 0) {
          this.dMultiply(Math.pow(b, j));
          this.dAddOffset(w, 0);
        }
        if (mi) {
          BigInteger2.ZERO.subTo(this, this);
        }
      };
      BigInteger2.prototype.fromNumber = function(a, b, c) {
        if ("number" == typeof b) {
          if (a < 2) {
            this.fromInt(1);
          } else {
            this.fromNumber(a, c);
            if (!this.testBit(a - 1)) {
              this.bitwiseTo(BigInteger2.ONE.shiftLeft(a - 1), op_or, this);
            }
            if (this.isEven()) {
              this.dAddOffset(1, 0);
            }
            while (!this.isProbablePrime(b)) {
              this.dAddOffset(2, 0);
              if (this.bitLength() > a) {
                this.subTo(BigInteger2.ONE.shiftLeft(a - 1), this);
              }
            }
          }
        } else {
          var x = [];
          var t = a & 7;
          x.length = (a >> 3) + 1;
          b.nextBytes(x);
          if (t > 0) {
            x[0] &= (1 << t) - 1;
          } else {
            x[0] = 0;
          }
          this.fromString(x, 256);
        }
      };
      BigInteger2.prototype.bitwiseTo = function(a, op, r) {
        var i;
        var f;
        var m = Math.min(a.t, this.t);
        for (i = 0; i < m; ++i) {
          r[i] = op(this[i], a[i]);
        }
        if (a.t < this.t) {
          f = a.s & this.DM;
          for (i = m; i < this.t; ++i) {
            r[i] = op(this[i], f);
          }
          r.t = this.t;
        } else {
          f = this.s & this.DM;
          for (i = m; i < a.t; ++i) {
            r[i] = op(f, a[i]);
          }
          r.t = a.t;
        }
        r.s = op(this.s, a.s);
        r.clamp();
      };
      BigInteger2.prototype.changeBit = function(n, op) {
        var r = BigInteger2.ONE.shiftLeft(n);
        this.bitwiseTo(r, op, r);
        return r;
      };
      BigInteger2.prototype.addTo = function(a, r) {
        var i = 0;
        var c = 0;
        var m = Math.min(a.t, this.t);
        while (i < m) {
          c += this[i] + a[i];
          r[i++] = c & this.DM;
          c >>= this.DB;
        }
        if (a.t < this.t) {
          c += a.s;
          while (i < this.t) {
            c += this[i];
            r[i++] = c & this.DM;
            c >>= this.DB;
          }
          c += this.s;
        } else {
          c += this.s;
          while (i < a.t) {
            c += a[i];
            r[i++] = c & this.DM;
            c >>= this.DB;
          }
          c += a.s;
        }
        r.s = c < 0 ? -1 : 0;
        if (c > 0) {
          r[i++] = c;
        } else if (c < -1) {
          r[i++] = this.DV + c;
        }
        r.t = i;
        r.clamp();
      };
      BigInteger2.prototype.dMultiply = function(n) {
        this[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
        ++this.t;
        this.clamp();
      };
      BigInteger2.prototype.dAddOffset = function(n, w) {
        if (n == 0) {
          return;
        }
        while (this.t <= w) {
          this[this.t++] = 0;
        }
        this[w] += n;
        while (this[w] >= this.DV) {
          this[w] -= this.DV;
          if (++w >= this.t) {
            this[this.t++] = 0;
          }
          ++this[w];
        }
      };
      BigInteger2.prototype.multiplyLowerTo = function(a, n, r) {
        var i = Math.min(this.t + a.t, n);
        r.s = 0;
        r.t = i;
        while (i > 0) {
          r[--i] = 0;
        }
        for (var j = r.t - this.t; i < j; ++i) {
          r[i + this.t] = this.am(0, a[i], r, i, 0, this.t);
        }
        for (var j = Math.min(a.t, n); i < j; ++i) {
          this.am(0, a[i], r, i, 0, n - i);
        }
        r.clamp();
      };
      BigInteger2.prototype.multiplyUpperTo = function(a, n, r) {
        --n;
        var i = r.t = this.t + a.t - n;
        r.s = 0;
        while (--i >= 0) {
          r[i] = 0;
        }
        for (i = Math.max(n - this.t, 0); i < a.t; ++i) {
          r[this.t + i - n] = this.am(n - i, a[i], r, 0, 0, this.t + i - n);
        }
        r.clamp();
        r.drShiftTo(1, r);
      };
      BigInteger2.prototype.modInt = function(n) {
        if (n <= 0) {
          return 0;
        }
        var d = this.DV % n;
        var r = this.s < 0 ? n - 1 : 0;
        if (this.t > 0) {
          if (d == 0) {
            r = this[0] % n;
          } else {
            for (var i = this.t - 1; i >= 0; --i) {
              r = (d * r + this[i]) % n;
            }
          }
        }
        return r;
      };
      BigInteger2.prototype.millerRabin = function(t) {
        var n1 = this.subtract(BigInteger2.ONE);
        var k = n1.getLowestSetBit();
        if (k <= 0) {
          return false;
        }
        var r = n1.shiftRight(k);
        t = t + 1 >> 1;
        if (t > lowprimes.length) {
          t = lowprimes.length;
        }
        var a = nbi();
        for (var i = 0; i < t; ++i) {
          a.fromInt(lowprimes[Math.floor(Math.random() * lowprimes.length)]);
          var y = a.modPow(r, this);
          if (y.compareTo(BigInteger2.ONE) != 0 && y.compareTo(n1) != 0) {
            var j = 1;
            while (j++ < k && y.compareTo(n1) != 0) {
              y = y.modPowInt(2, this);
              if (y.compareTo(BigInteger2.ONE) == 0) {
                return false;
              }
            }
            if (y.compareTo(n1) != 0) {
              return false;
            }
          }
        }
        return true;
      };
      BigInteger2.prototype.square = function() {
        var r = nbi();
        this.squareTo(r);
        return r;
      };
      BigInteger2.prototype.gcda = function(a, callback) {
        var x = this.s < 0 ? this.negate() : this.clone();
        var y = a.s < 0 ? a.negate() : a.clone();
        if (x.compareTo(y) < 0) {
          var t = x;
          x = y;
          y = t;
        }
        var i = x.getLowestSetBit();
        var g = y.getLowestSetBit();
        if (g < 0) {
          callback(x);
          return;
        }
        if (i < g) {
          g = i;
        }
        if (g > 0) {
          x.rShiftTo(g, x);
          y.rShiftTo(g, y);
        }
        var gcda1 = function() {
          if ((i = x.getLowestSetBit()) > 0) {
            x.rShiftTo(i, x);
          }
          if ((i = y.getLowestSetBit()) > 0) {
            y.rShiftTo(i, y);
          }
          if (x.compareTo(y) >= 0) {
            x.subTo(y, x);
            x.rShiftTo(1, x);
          } else {
            y.subTo(x, y);
            y.rShiftTo(1, y);
          }
          if (!(x.signum() > 0)) {
            if (g > 0) {
              y.lShiftTo(g, y);
            }
            setTimeout(function() {
              callback(y);
            }, 0);
          } else {
            setTimeout(gcda1, 0);
          }
        };
        setTimeout(gcda1, 10);
      };
      BigInteger2.prototype.fromNumberAsync = function(a, b, c, callback) {
        if ("number" == typeof b) {
          if (a < 2) {
            this.fromInt(1);
          } else {
            this.fromNumber(a, c);
            if (!this.testBit(a - 1)) {
              this.bitwiseTo(BigInteger2.ONE.shiftLeft(a - 1), op_or, this);
            }
            if (this.isEven()) {
              this.dAddOffset(1, 0);
            }
            var bnp_1 = this;
            var bnpfn1_1 = function() {
              bnp_1.dAddOffset(2, 0);
              if (bnp_1.bitLength() > a) {
                bnp_1.subTo(BigInteger2.ONE.shiftLeft(a - 1), bnp_1);
              }
              if (bnp_1.isProbablePrime(b)) {
                setTimeout(function() {
                  callback();
                }, 0);
              } else {
                setTimeout(bnpfn1_1, 0);
              }
            };
            setTimeout(bnpfn1_1, 0);
          }
        } else {
          var x = [];
          var t = a & 7;
          x.length = (a >> 3) + 1;
          b.nextBytes(x);
          if (t > 0) {
            x[0] &= (1 << t) - 1;
          } else {
            x[0] = 0;
          }
          this.fromString(x, 256);
        }
      };
      return BigInteger2;
    })()
  );
  var NullExp = (
    /** @class */
    (function() {
      function NullExp2() {
      }
      NullExp2.prototype.convert = function(x) {
        return x;
      };
      NullExp2.prototype.revert = function(x) {
        return x;
      };
      NullExp2.prototype.mulTo = function(x, y, r) {
        x.multiplyTo(y, r);
      };
      NullExp2.prototype.sqrTo = function(x, r) {
        x.squareTo(r);
      };
      return NullExp2;
    })()
  );
  var Classic = (
    /** @class */
    (function() {
      function Classic2(m) {
        this.m = m;
      }
      Classic2.prototype.convert = function(x) {
        if (x.s < 0 || x.compareTo(this.m) >= 0) {
          return x.mod(this.m);
        } else {
          return x;
        }
      };
      Classic2.prototype.revert = function(x) {
        return x;
      };
      Classic2.prototype.reduce = function(x) {
        x.divRemTo(this.m, null, x);
      };
      Classic2.prototype.mulTo = function(x, y, r) {
        x.multiplyTo(y, r);
        this.reduce(r);
      };
      Classic2.prototype.sqrTo = function(x, r) {
        x.squareTo(r);
        this.reduce(r);
      };
      return Classic2;
    })()
  );
  var Montgomery = (
    /** @class */
    (function() {
      function Montgomery2(m) {
        this.m = m;
        this.mp = m.invDigit();
        this.mpl = this.mp & 32767;
        this.mph = this.mp >> 15;
        this.um = (1 << m.DB - 15) - 1;
        this.mt2 = 2 * m.t;
      }
      Montgomery2.prototype.convert = function(x) {
        var r = nbi();
        x.abs().dlShiftTo(this.m.t, r);
        r.divRemTo(this.m, null, r);
        if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) {
          this.m.subTo(r, r);
        }
        return r;
      };
      Montgomery2.prototype.revert = function(x) {
        var r = nbi();
        x.copyTo(r);
        this.reduce(r);
        return r;
      };
      Montgomery2.prototype.reduce = function(x) {
        while (x.t <= this.mt2) {
          x[x.t++] = 0;
        }
        for (var i = 0; i < this.m.t; ++i) {
          var j = x[i] & 32767;
          var u0 = j * this.mpl + ((j * this.mph + (x[i] >> 15) * this.mpl & this.um) << 15) & x.DM;
          j = i + this.m.t;
          x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
          while (x[j] >= x.DV) {
            x[j] -= x.DV;
            x[++j]++;
          }
        }
        x.clamp();
        x.drShiftTo(this.m.t, x);
        if (x.compareTo(this.m) >= 0) {
          x.subTo(this.m, x);
        }
      };
      Montgomery2.prototype.mulTo = function(x, y, r) {
        x.multiplyTo(y, r);
        this.reduce(r);
      };
      Montgomery2.prototype.sqrTo = function(x, r) {
        x.squareTo(r);
        this.reduce(r);
      };
      return Montgomery2;
    })()
  );
  var Barrett = (
    /** @class */
    (function() {
      function Barrett2(m) {
        this.m = m;
        this.r2 = nbi();
        this.q3 = nbi();
        BigInteger.ONE.dlShiftTo(2 * m.t, this.r2);
        this.mu = this.r2.divide(m);
      }
      Barrett2.prototype.convert = function(x) {
        if (x.s < 0 || x.t > 2 * this.m.t) {
          return x.mod(this.m);
        } else if (x.compareTo(this.m) < 0) {
          return x;
        } else {
          var r = nbi();
          x.copyTo(r);
          this.reduce(r);
          return r;
        }
      };
      Barrett2.prototype.revert = function(x) {
        return x;
      };
      Barrett2.prototype.reduce = function(x) {
        x.drShiftTo(this.m.t - 1, this.r2);
        if (x.t > this.m.t + 1) {
          x.t = this.m.t + 1;
          x.clamp();
        }
        this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
        this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
        while (x.compareTo(this.r2) < 0) {
          x.dAddOffset(1, this.m.t + 1);
        }
        x.subTo(this.r2, x);
        while (x.compareTo(this.m) >= 0) {
          x.subTo(this.m, x);
        }
      };
      Barrett2.prototype.mulTo = function(x, y, r) {
        x.multiplyTo(y, r);
        this.reduce(r);
      };
      Barrett2.prototype.sqrTo = function(x, r) {
        x.squareTo(r);
        this.reduce(r);
      };
      return Barrett2;
    })()
  );
  function nbi() {
    return new BigInteger(null);
  }
  function parseBigInt(str, r) {
    return new BigInteger(str, r);
  }
  var inBrowser = typeof navigator !== "undefined";
  if (inBrowser && j_lm && navigator.appName == "Microsoft Internet Explorer") {
    BigInteger.prototype.am = function am2(i, x, w, j, c, n) {
      var xl = x & 32767;
      var xh = x >> 15;
      while (--n >= 0) {
        var l = this[i] & 32767;
        var h = this[i++] >> 15;
        var m = xh * l + h * xl;
        l = xl * l + ((m & 32767) << 15) + w[j] + (c & 1073741823);
        c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
        w[j++] = l & 1073741823;
      }
      return c;
    };
    dbits = 30;
  } else if (inBrowser && j_lm && navigator.appName != "Netscape") {
    BigInteger.prototype.am = function am1(i, x, w, j, c, n) {
      while (--n >= 0) {
        var v = x * this[i++] + w[j] + c;
        c = Math.floor(v / 67108864);
        w[j++] = v & 67108863;
      }
      return c;
    };
    dbits = 26;
  } else {
    BigInteger.prototype.am = function am3(i, x, w, j, c, n) {
      var xl = x & 16383;
      var xh = x >> 14;
      while (--n >= 0) {
        var l = this[i] & 16383;
        var h = this[i++] >> 14;
        var m = xh * l + h * xl;
        l = xl * l + ((m & 16383) << 14) + w[j] + c;
        c = (l >> 28) + (m >> 14) + xh * h;
        w[j++] = l & 268435455;
      }
      return c;
    };
    dbits = 28;
  }
  BigInteger.prototype.DB = dbits;
  BigInteger.prototype.DM = (1 << dbits) - 1;
  BigInteger.prototype.DV = 1 << dbits;
  var BI_FP = 52;
  BigInteger.prototype.FV = Math.pow(2, BI_FP);
  BigInteger.prototype.F1 = BI_FP - dbits;
  BigInteger.prototype.F2 = 2 * dbits - BI_FP;
  var BI_RC = [];
  var rr;
  var vv;
  rr = "0".charCodeAt(0);
  for (vv = 0; vv <= 9; ++vv) {
    BI_RC[rr++] = vv;
  }
  rr = "a".charCodeAt(0);
  for (vv = 10; vv < 36; ++vv) {
    BI_RC[rr++] = vv;
  }
  rr = "A".charCodeAt(0);
  for (vv = 10; vv < 36; ++vv) {
    BI_RC[rr++] = vv;
  }
  function intAt(s, i) {
    var c = BI_RC[s.charCodeAt(i)];
    return c == null ? -1 : c;
  }
  function nbv(i) {
    var r = nbi();
    r.fromInt(i);
    return r;
  }
  function nbits(x) {
    var r = 1;
    var t;
    if ((t = x >>> 16) != 0) {
      x = t;
      r += 16;
    }
    if ((t = x >> 8) != 0) {
      x = t;
      r += 8;
    }
    if ((t = x >> 4) != 0) {
      x = t;
      r += 4;
    }
    if ((t = x >> 2) != 0) {
      x = t;
      r += 2;
    }
    if ((t = x >> 1) != 0) {
      x = t;
      r += 1;
    }
    return r;
  }
  BigInteger.ZERO = nbv(0);
  BigInteger.ONE = nbv(1);

  // node_modules/jsencrypt/lib/lib/jsbn/prng4.js
  var Arcfour = (
    /** @class */
    (function() {
      function Arcfour2() {
        this.i = 0;
        this.j = 0;
        this.S = [];
      }
      Arcfour2.prototype.init = function(key) {
        var i;
        var j;
        var t;
        for (i = 0; i < 256; ++i) {
          this.S[i] = i;
        }
        j = 0;
        for (i = 0; i < 256; ++i) {
          j = j + this.S[i] + key[i % key.length] & 255;
          t = this.S[i];
          this.S[i] = this.S[j];
          this.S[j] = t;
        }
        this.i = 0;
        this.j = 0;
      };
      Arcfour2.prototype.next = function() {
        var t;
        this.i = this.i + 1 & 255;
        this.j = this.j + this.S[this.i] & 255;
        t = this.S[this.i];
        this.S[this.i] = this.S[this.j];
        this.S[this.j] = t;
        return this.S[t + this.S[this.i] & 255];
      };
      return Arcfour2;
    })()
  );
  function prng_newstate() {
    return new Arcfour();
  }
  var rng_psize = 256;

  // node_modules/jsencrypt/lib/lib/jsbn/rng.js
  var rng_state;
  var rng_pool = null;
  var rng_pptr;
  if (rng_pool == null) {
    rng_pool = [];
    rng_pptr = 0;
    t = void 0;
    if (typeof window !== "undefined" && self.crypto && self.crypto.getRandomValues) {
      z = new Uint32Array(256);
      self.crypto.getRandomValues(z);
      for (t = 0; t < z.length; ++t) {
        rng_pool[rng_pptr++] = z[t] & 255;
      }
    }
    count = 0;
    onMouseMoveListener_1 = function(ev) {
      count = count || 0;
      if (count >= 256 || rng_pptr >= rng_psize) {
        if (self.removeEventListener) {
          self.removeEventListener("mousemove", onMouseMoveListener_1, false);
        } else if (self.detachEvent) {
          self.detachEvent("onmousemove", onMouseMoveListener_1);
        }
        return;
      }
      try {
        var mouseCoordinates = ev.x + ev.y;
        rng_pool[rng_pptr++] = mouseCoordinates & 255;
        count += 1;
      } catch (e) {
      }
    };
    if (typeof window !== "undefined") {
      if (self.addEventListener) {
        self.addEventListener("mousemove", onMouseMoveListener_1, false);
      } else if (self.attachEvent) {
        self.attachEvent("onmousemove", onMouseMoveListener_1);
      }
    }
  }
  var t;
  var z;
  var count;
  var onMouseMoveListener_1;
  function rng_get_byte() {
    if (rng_state == null) {
      rng_state = prng_newstate();
      while (rng_pptr < rng_psize) {
        var random = Math.floor(65536 * Math.random());
        rng_pool[rng_pptr++] = random & 255;
      }
      rng_state.init(rng_pool);
      for (rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr) {
        rng_pool[rng_pptr] = 0;
      }
      rng_pptr = 0;
    }
    return rng_state.next();
  }
  var SecureRandom = (
    /** @class */
    (function() {
      function SecureRandom2() {
      }
      SecureRandom2.prototype.nextBytes = function(ba) {
        for (var i = 0; i < ba.length; ++i) {
          ba[i] = rng_get_byte();
        }
      };
      return SecureRandom2;
    })()
  );

  // node_modules/jsencrypt/lib/lib/jsbn/sha256.js
  function rstr_sha256(s) {
    return binb2rstr(binb_sha256(rstr2binb(s), s.length * 8));
  }
  function rstr2hex(input) {
    var hex_tab = "0123456789abcdef";
    var output = "";
    for (var i = 0; i < input.length; i++) {
      var x = input.charCodeAt(i);
      output += hex_tab.charAt(x >>> 4 & 15) + hex_tab.charAt(x & 15);
    }
    return output;
  }
  function rstr2binb(input) {
    var output = Array(input.length >> 2);
    for (var i = 0; i < output.length; i++)
      output[i] = 0;
    for (var i = 0; i < input.length * 8; i += 8)
      output[i >> 5] |= (input.charCodeAt(i / 8) & 255) << 24 - i % 32;
    return output;
  }
  function binb2rstr(input) {
    var output = "";
    for (var i = 0; i < input.length * 32; i += 8)
      output += String.fromCharCode(input[i >> 5] >>> 24 - i % 32 & 255);
    return output;
  }
  function sha256_S(X, n) {
    return X >>> n | X << 32 - n;
  }
  function sha256_R(X, n) {
    return X >>> n;
  }
  function sha256_Ch(x, y, z) {
    return x & y ^ ~x & z;
  }
  function sha256_Maj(x, y, z) {
    return x & y ^ x & z ^ y & z;
  }
  function sha256_Sigma0256(x) {
    return sha256_S(x, 2) ^ sha256_S(x, 13) ^ sha256_S(x, 22);
  }
  function sha256_Sigma1256(x) {
    return sha256_S(x, 6) ^ sha256_S(x, 11) ^ sha256_S(x, 25);
  }
  function sha256_Gamma0256(x) {
    return sha256_S(x, 7) ^ sha256_S(x, 18) ^ sha256_R(x, 3);
  }
  function sha256_Gamma1256(x) {
    return sha256_S(x, 17) ^ sha256_S(x, 19) ^ sha256_R(x, 10);
  }
  var sha256_K = new Array(1116352408, 1899447441, -1245643825, -373957723, 961987163, 1508970993, -1841331548, -1424204075, -670586216, 310598401, 607225278, 1426881987, 1925078388, -2132889090, -1680079193, -1046744716, -459576895, -272742522, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, -1740746414, -1473132947, -1341970488, -1084653625, -958395405, -710438585, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, -2117940946, -1838011259, -1564481375, -1474664885, -1035236496, -949202525, -778901479, -694614492, -200395387, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, -2067236844, -1933114872, -1866530822, -1538233109, -1090935817, -965641998);
  function binb_sha256(m, l) {
    var HASH = new Array(1779033703, -1150833019, 1013904242, -1521486534, 1359893119, -1694144372, 528734635, 1541459225);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h;
    var i, j, T1, T2;
    m[l >> 5] |= 128 << 24 - l % 32;
    m[(l + 64 >> 9 << 4) + 15] = l;
    for (i = 0; i < m.length; i += 16) {
      a = HASH[0];
      b = HASH[1];
      c = HASH[2];
      d = HASH[3];
      e = HASH[4];
      f = HASH[5];
      g = HASH[6];
      h = HASH[7];
      for (j = 0; j < 64; j++) {
        if (j < 16)
          W[j] = m[j + i];
        else
          W[j] = safe_add(safe_add(safe_add(sha256_Gamma1256(W[j - 2]), W[j - 7]), sha256_Gamma0256(W[j - 15])), W[j - 16]);
        T1 = safe_add(safe_add(safe_add(safe_add(h, sha256_Sigma1256(e)), sha256_Ch(e, f, g)), sha256_K[j]), W[j]);
        T2 = safe_add(sha256_Sigma0256(a), sha256_Maj(a, b, c));
        h = g;
        g = f;
        f = e;
        e = safe_add(d, T1);
        d = c;
        c = b;
        b = a;
        a = safe_add(T1, T2);
      }
      HASH[0] = safe_add(a, HASH[0]);
      HASH[1] = safe_add(b, HASH[1]);
      HASH[2] = safe_add(c, HASH[2]);
      HASH[3] = safe_add(d, HASH[3]);
      HASH[4] = safe_add(e, HASH[4]);
      HASH[5] = safe_add(f, HASH[5]);
      HASH[6] = safe_add(g, HASH[6]);
      HASH[7] = safe_add(h, HASH[7]);
    }
    return HASH;
  }
  function safe_add(x, y) {
    var lsw = (x & 65535) + (y & 65535);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return msw << 16 | lsw & 65535;
  }

  // node_modules/jsencrypt/lib/lib/jsbn/rsa.js
  function pkcs1pad1(s, n) {
    if (n < s.length + 22) {
      console.error("Message too long for RSA");
      return null;
    }
    var len = n - s.length - 6;
    var filler = "";
    for (var f = 0; f < len; f += 2) {
      filler += "ff";
    }
    var m = "0001" + filler + "00" + s;
    return parseBigInt(m, 16);
  }
  function pkcs1pad2(s, n) {
    if (n < s.length + 11) {
      console.error("Message too long for RSA");
      return null;
    }
    var ba = [];
    var i = s.length - 1;
    while (i >= 0 && n > 0) {
      var c = s.charCodeAt(i--);
      if (c < 128) {
        ba[--n] = c;
      } else if (c > 127 && c < 2048) {
        ba[--n] = c & 63 | 128;
        ba[--n] = c >> 6 | 192;
      } else {
        ba[--n] = c & 63 | 128;
        ba[--n] = c >> 6 & 63 | 128;
        ba[--n] = c >> 12 | 224;
      }
    }
    ba[--n] = 0;
    var rng = new SecureRandom();
    var x = [];
    while (n > 2) {
      x[0] = 0;
      while (x[0] == 0) {
        rng.nextBytes(x);
      }
      ba[--n] = x[0];
    }
    ba[--n] = 2;
    ba[--n] = 0;
    return new BigInteger(ba);
  }
  function oaep_mgf1_arr(seed, len, hashFunc) {
    var mask = "", i = 0;
    while (mask.length < len) {
      mask += hashFunc(String.fromCharCode.apply(String, seed.concat([
        (i & 4278190080) >> 24,
        (i & 16711680) >> 16,
        (i & 65280) >> 8,
        i & 255
      ])));
      i += 1;
    }
    return mask;
  }
  var SHA256_SIZE = 32;
  function oaep_pad(s, n) {
    var hashLen = SHA256_SIZE;
    var hashFunc = rstr_sha256;
    if (s.length + 2 * hashLen + 2 > n) {
      throw "Message too long for RSA";
    }
    var PS = "", i;
    for (i = 0; i < n - s.length - 2 * hashLen - 2; i += 1) {
      PS += "\0";
    }
    var DB = hashFunc("") + PS + "" + s, seed = new Array(hashLen);
    new SecureRandom().nextBytes(seed);
    var dbMask = oaep_mgf1_arr(seed, DB.length, hashFunc), maskedDB = [];
    for (i = 0; i < DB.length; i += 1) {
      maskedDB[i] = DB.charCodeAt(i) ^ dbMask.charCodeAt(i);
    }
    var seedMask = oaep_mgf1_arr(maskedDB, seed.length, hashFunc), maskedSeed = [0];
    for (i = 0; i < seed.length; i += 1) {
      maskedSeed[i + 1] = seed[i] ^ seedMask.charCodeAt(i);
    }
    return new BigInteger(maskedSeed.concat(maskedDB));
  }
  var RSAKey = (
    /** @class */
    (function() {
      function RSAKey2() {
        this.n = null;
        this.e = 0;
        this.d = null;
        this.p = null;
        this.q = null;
        this.dmp1 = null;
        this.dmq1 = null;
        this.coeff = null;
      }
      RSAKey2.prototype.doPublic = function(x) {
        return x.modPowInt(this.e, this.n);
      };
      RSAKey2.prototype.doPrivate = function(x) {
        if (this.p == null || this.q == null) {
          return x.modPow(this.d, this.n);
        }
        var xp = x.mod(this.p).modPow(this.dmp1, this.p);
        var xq = x.mod(this.q).modPow(this.dmq1, this.q);
        while (xp.compareTo(xq) < 0) {
          xp = xp.add(this.p);
        }
        return xp.subtract(xq).multiply(this.coeff).mod(this.p).multiply(this.q).add(xq);
      };
      RSAKey2.prototype.setPublic = function(N, E) {
        if (N != null && E != null && N.length > 0 && E.length > 0) {
          this.n = parseBigInt(N, 16);
          this.e = parseInt(E, 16);
        } else {
          console.error("Invalid RSA public key");
        }
      };
      RSAKey2.prototype.encrypt = function(text, paddingFunction) {
        if (typeof paddingFunction === "undefined") {
          paddingFunction = pkcs1pad2;
        }
        var maxLength = this.n.bitLength() + 7 >> 3;
        var m = paddingFunction(text, maxLength);
        if (m == null) {
          return null;
        }
        var c = this.doPublic(m);
        if (c == null) {
          return null;
        }
        var h = c.toString(16);
        var length = h.length;
        for (var i = 0; i < maxLength * 2 - length; i++) {
          h = "0" + h;
        }
        return h;
      };
      RSAKey2.prototype.setPrivate = function(N, E, D) {
        if (N != null && E != null && N.length > 0 && E.length > 0) {
          this.n = parseBigInt(N, 16);
          this.e = parseInt(E, 16);
          this.d = parseBigInt(D, 16);
        } else {
          console.error("Invalid RSA private key");
        }
      };
      RSAKey2.prototype.setPrivateEx = function(N, E, D, P, Q, DP, DQ, C) {
        if (N != null && E != null && N.length > 0 && E.length > 0) {
          this.n = parseBigInt(N, 16);
          this.e = parseInt(E, 16);
          this.d = parseBigInt(D, 16);
          this.p = parseBigInt(P, 16);
          this.q = parseBigInt(Q, 16);
          this.dmp1 = parseBigInt(DP, 16);
          this.dmq1 = parseBigInt(DQ, 16);
          this.coeff = parseBigInt(C, 16);
        } else {
          console.error("Invalid RSA private key");
        }
      };
      RSAKey2.prototype.generate = function(B, E) {
        var rng = new SecureRandom();
        var qs = B >> 1;
        this.e = parseInt(E, 16);
        var ee = new BigInteger(E, 16);
        for (; ; ) {
          for (; ; ) {
            this.p = new BigInteger(B - qs, 1, rng);
            if (this.p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.p.isProbablePrime(10)) {
              break;
            }
          }
          for (; ; ) {
            this.q = new BigInteger(qs, 1, rng);
            if (this.q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && this.q.isProbablePrime(10)) {
              break;
            }
          }
          if (this.p.compareTo(this.q) <= 0) {
            var t = this.p;
            this.p = this.q;
            this.q = t;
          }
          var p1 = this.p.subtract(BigInteger.ONE);
          var q1 = this.q.subtract(BigInteger.ONE);
          var phi = p1.multiply(q1);
          if (phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
            this.n = this.p.multiply(this.q);
            this.d = ee.modInverse(phi);
            this.dmp1 = this.d.mod(p1);
            this.dmq1 = this.d.mod(q1);
            this.coeff = this.q.modInverse(this.p);
            break;
          }
        }
      };
      RSAKey2.prototype.decrypt = function(ctext) {
        var c = parseBigInt(ctext, 16);
        var m = this.doPrivate(c);
        if (m == null) {
          return null;
        }
        return pkcs1unpad2(m, this.n.bitLength() + 7 >> 3);
      };
      RSAKey2.prototype.generateAsync = function(B, E, callback) {
        var rng = new SecureRandom();
        var qs = B >> 1;
        this.e = parseInt(E, 16);
        var ee = new BigInteger(E, 16);
        var rsa = this;
        var loop1 = function() {
          var loop4 = function() {
            if (rsa.p.compareTo(rsa.q) <= 0) {
              var t = rsa.p;
              rsa.p = rsa.q;
              rsa.q = t;
            }
            var p1 = rsa.p.subtract(BigInteger.ONE);
            var q1 = rsa.q.subtract(BigInteger.ONE);
            var phi = p1.multiply(q1);
            if (phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
              rsa.n = rsa.p.multiply(rsa.q);
              rsa.d = ee.modInverse(phi);
              rsa.dmp1 = rsa.d.mod(p1);
              rsa.dmq1 = rsa.d.mod(q1);
              rsa.coeff = rsa.q.modInverse(rsa.p);
              setTimeout(function() {
                callback();
              }, 0);
            } else {
              setTimeout(loop1, 0);
            }
          };
          var loop3 = function() {
            rsa.q = nbi();
            rsa.q.fromNumberAsync(qs, 1, rng, function() {
              rsa.q.subtract(BigInteger.ONE).gcda(ee, function(r) {
                if (r.compareTo(BigInteger.ONE) == 0 && rsa.q.isProbablePrime(10)) {
                  setTimeout(loop4, 0);
                } else {
                  setTimeout(loop3, 0);
                }
              });
            });
          };
          var loop2 = function() {
            rsa.p = nbi();
            rsa.p.fromNumberAsync(B - qs, 1, rng, function() {
              rsa.p.subtract(BigInteger.ONE).gcda(ee, function(r) {
                if (r.compareTo(BigInteger.ONE) == 0 && rsa.p.isProbablePrime(10)) {
                  setTimeout(loop3, 0);
                } else {
                  setTimeout(loop2, 0);
                }
              });
            });
          };
          setTimeout(loop2, 0);
        };
        setTimeout(loop1, 0);
      };
      RSAKey2.prototype.sign = function(text, digestMethod, digestName) {
        var header = getDigestHeader(digestName);
        var digest = header + digestMethod(text).toString();
        var maxLength = this.n.bitLength() / 4;
        var m = pkcs1pad1(digest, maxLength);
        if (m == null) {
          return null;
        }
        var c = this.doPrivate(m);
        if (c == null) {
          return null;
        }
        var h = c.toString(16);
        var length = h.length;
        for (var i = 0; i < maxLength - length; i++) {
          h = "0" + h;
        }
        return h;
      };
      RSAKey2.prototype.verify = function(text, signature, digestMethod) {
        var c = parseBigInt(signature, 16);
        var m = this.doPublic(c);
        if (m == null) {
          return null;
        }
        var unpadded = m.toString(16).replace(/^1f+00/, "");
        var digest = removeDigestHeader(unpadded);
        return digest == digestMethod(text).toString();
      };
      return RSAKey2;
    })()
  );
  function pkcs1unpad2(d, n) {
    var b = d.toByteArray();
    var i = 0;
    while (i < b.length && b[i] == 0) {
      ++i;
    }
    if (b.length - i != n - 1 || b[i] != 2) {
      return null;
    }
    ++i;
    while (b[i] != 0) {
      if (++i >= b.length) {
        return null;
      }
    }
    var ret = "";
    while (++i < b.length) {
      var c = b[i] & 255;
      if (c < 128) {
        ret += String.fromCharCode(c);
      } else if (c > 191 && c < 224) {
        ret += String.fromCharCode((c & 31) << 6 | b[i + 1] & 63);
        ++i;
      } else {
        ret += String.fromCharCode((c & 15) << 12 | (b[i + 1] & 63) << 6 | b[i + 2] & 63);
        i += 2;
      }
    }
    return ret;
  }
  var DIGEST_HEADERS = {
    md2: "3020300c06082a864886f70d020205000410",
    md5: "3020300c06082a864886f70d020505000410",
    sha1: "3021300906052b0e03021a05000414",
    sha224: "302d300d06096086480165030402040500041c",
    sha256: "3031300d060960864801650304020105000420",
    sha384: "3041300d060960864801650304020205000430",
    sha512: "3051300d060960864801650304020305000440",
    ripemd160: "3021300906052b2403020105000414"
  };
  function getDigestHeader(name) {
    return DIGEST_HEADERS[name] || "";
  }
  function removeDigestHeader(str) {
    for (var name_1 in DIGEST_HEADERS) {
      if (DIGEST_HEADERS.hasOwnProperty(name_1)) {
        var header = DIGEST_HEADERS[name_1];
        var len = header.length;
        if (str.substring(0, len) == header) {
          return str.substring(len);
        }
      }
    }
    return str;
  }

  // node_modules/jsencrypt/lib/lib/jsrsasign/asn1-1.0.js
  function extendClass(subc, superc, overrides) {
    if (!superc || !subc) {
      throw new Error("extend failed, please check that all dependencies are included.");
    }
    var F = function() {
    };
    F.prototype = superc.prototype;
    subc.prototype = new F();
    subc.prototype.constructor = subc;
    subc.superclass = superc.prototype;
    if (superc.prototype.constructor == Object.prototype.constructor) {
      superc.prototype.constructor = superc;
    }
    if (overrides) {
      var i;
      for (i in overrides) {
        subc.prototype[i] = overrides[i];
      }
      var _IEEnumFix = function() {
      }, ADD = ["toString", "valueOf"];
      try {
        if (/MSIE/.test(navigator.userAgent)) {
          _IEEnumFix = function(r, s) {
            for (i = 0; i < ADD.length; i = i + 1) {
              var fname = ADD[i], f = s[fname];
              if (typeof f === "function" && f != Object.prototype[fname]) {
                r[fname] = f;
              }
            }
          };
        }
      } catch (ex) {
      }
      ;
      _IEEnumFix(subc.prototype, overrides);
    }
  }
  var KJUR = {};
  if (typeof KJUR.asn1 == "undefined" || !KJUR.asn1)
    KJUR.asn1 = {};
  KJUR.asn1.ASN1Util = new function() {
    this.integerToByteHex = function(i) {
      var h = i.toString(16);
      if (h.length % 2 == 1)
        h = "0" + h;
      return h;
    };
    this.bigIntToMinTwosComplementsHex = function(bigIntegerValue) {
      var h = bigIntegerValue.toString(16);
      if (h.substring(0, 1) != "-") {
        if (h.length % 2 == 1) {
          h = "0" + h;
        } else {
          if (!h.match(/^[0-7]/)) {
            h = "00" + h;
          }
        }
      } else {
        var hPos = h.substring(1);
        var xorLen = hPos.length;
        if (xorLen % 2 == 1) {
          xorLen += 1;
        } else {
          if (!h.match(/^[0-7]/)) {
            xorLen += 2;
          }
        }
        var hMask = "";
        for (var i = 0; i < xorLen; i++) {
          hMask += "f";
        }
        var biMask = new BigInteger(hMask, 16);
        var biNeg = biMask.xor(bigIntegerValue).add(BigInteger.ONE);
        h = biNeg.toString(16).replace(/^-/, "");
      }
      return h;
    };
    this.getPEMStringFromHex = function(dataHex, pemHeader) {
      return hextopem(dataHex, pemHeader);
    };
    this.newObject = function(param) {
      var _KJUR = KJUR, _KJUR_asn1 = _KJUR.asn1, _DERBoolean = _KJUR_asn1.DERBoolean, _DERInteger = _KJUR_asn1.DERInteger, _DERBitString = _KJUR_asn1.DERBitString, _DEROctetString = _KJUR_asn1.DEROctetString, _DERNull = _KJUR_asn1.DERNull, _DERObjectIdentifier = _KJUR_asn1.DERObjectIdentifier, _DEREnumerated = _KJUR_asn1.DEREnumerated, _DERUTF8String = _KJUR_asn1.DERUTF8String, _DERNumericString = _KJUR_asn1.DERNumericString, _DERPrintableString = _KJUR_asn1.DERPrintableString, _DERTeletexString = _KJUR_asn1.DERTeletexString, _DERIA5String = _KJUR_asn1.DERIA5String, _DERUTCTime = _KJUR_asn1.DERUTCTime, _DERGeneralizedTime = _KJUR_asn1.DERGeneralizedTime, _DERSequence = _KJUR_asn1.DERSequence, _DERSet = _KJUR_asn1.DERSet, _DERTaggedObject = _KJUR_asn1.DERTaggedObject, _newObject = _KJUR_asn1.ASN1Util.newObject;
      var keys = Object.keys(param);
      if (keys.length != 1)
        throw "key of param shall be only one.";
      var key = keys[0];
      if (":bool:int:bitstr:octstr:null:oid:enum:utf8str:numstr:prnstr:telstr:ia5str:utctime:gentime:seq:set:tag:".indexOf(":" + key + ":") == -1)
        throw "undefined key: " + key;
      if (key == "bool")
        return new _DERBoolean(param[key]);
      if (key == "int")
        return new _DERInteger(param[key]);
      if (key == "bitstr")
        return new _DERBitString(param[key]);
      if (key == "octstr")
        return new _DEROctetString(param[key]);
      if (key == "null")
        return new _DERNull(param[key]);
      if (key == "oid")
        return new _DERObjectIdentifier(param[key]);
      if (key == "enum")
        return new _DEREnumerated(param[key]);
      if (key == "utf8str")
        return new _DERUTF8String(param[key]);
      if (key == "numstr")
        return new _DERNumericString(param[key]);
      if (key == "prnstr")
        return new _DERPrintableString(param[key]);
      if (key == "telstr")
        return new _DERTeletexString(param[key]);
      if (key == "ia5str")
        return new _DERIA5String(param[key]);
      if (key == "utctime")
        return new _DERUTCTime(param[key]);
      if (key == "gentime")
        return new _DERGeneralizedTime(param[key]);
      if (key == "seq") {
        var paramList = param[key];
        var a = [];
        for (var i = 0; i < paramList.length; i++) {
          var asn1Obj = _newObject(paramList[i]);
          a.push(asn1Obj);
        }
        return new _DERSequence({ "array": a });
      }
      if (key == "set") {
        var paramList = param[key];
        var a = [];
        for (var i = 0; i < paramList.length; i++) {
          var asn1Obj = _newObject(paramList[i]);
          a.push(asn1Obj);
        }
        return new _DERSet({ "array": a });
      }
      if (key == "tag") {
        var tagParam = param[key];
        if (Object.prototype.toString.call(tagParam) === "[object Array]" && tagParam.length == 3) {
          var obj = _newObject(tagParam[2]);
          return new _DERTaggedObject({
            tag: tagParam[0],
            explicit: tagParam[1],
            obj
          });
        } else {
          var newParam = {};
          if (tagParam.explicit !== void 0)
            newParam.explicit = tagParam.explicit;
          if (tagParam.tag !== void 0)
            newParam.tag = tagParam.tag;
          if (tagParam.obj === void 0)
            throw "obj shall be specified for 'tag'.";
          newParam.obj = _newObject(tagParam.obj);
          return new _DERTaggedObject(newParam);
        }
      }
    };
    this.jsonToASN1HEX = function(param) {
      var asn1Obj = this.newObject(param);
      return asn1Obj.getEncodedHex();
    };
  }();
  KJUR.asn1.ASN1Util.oidHexToInt = function(hex2) {
    var s = "";
    var i01 = parseInt(hex2.substring(0, 2), 16);
    var i0 = Math.floor(i01 / 40);
    var i1 = i01 % 40;
    var s = i0 + "." + i1;
    var binbuf = "";
    for (var i = 2; i < hex2.length; i += 2) {
      var value = parseInt(hex2.substring(i, i + 2), 16);
      var bin = ("00000000" + value.toString(2)).slice(-8);
      binbuf = binbuf + bin.substring(1, 8);
      if (bin.substring(0, 1) == "0") {
        var bi = new BigInteger(binbuf, 2);
        s = s + "." + bi.toString(10);
        binbuf = "";
      }
    }
    ;
    return s;
  };
  KJUR.asn1.ASN1Util.oidIntToHex = function(oidString) {
    var itox = function(i2) {
      var h2 = i2.toString(16);
      if (h2.length == 1)
        h2 = "0" + h2;
      return h2;
    };
    var roidtox = function(roid) {
      var h2 = "";
      var bi = new BigInteger(roid, 10);
      var b = bi.toString(2);
      var padLen = 7 - b.length % 7;
      if (padLen == 7)
        padLen = 0;
      var bPad = "";
      for (var i2 = 0; i2 < padLen; i2++)
        bPad += "0";
      b = bPad + b;
      for (var i2 = 0; i2 < b.length - 1; i2 += 7) {
        var b8 = b.substring(i2, i2 + 7);
        if (i2 != b.length - 7)
          b8 = "1" + b8;
        h2 += itox(parseInt(b8, 2));
      }
      return h2;
    };
    if (!oidString.match(/^[0-9.]+$/)) {
      throw "malformed oid string: " + oidString;
    }
    var h = "";
    var a = oidString.split(".");
    var i0 = parseInt(a[0]) * 40 + parseInt(a[1]);
    h += itox(i0);
    a.splice(0, 2);
    for (var i = 0; i < a.length; i++) {
      h += roidtox(a[i]);
    }
    return h;
  };
  KJUR.asn1.ASN1Object = function() {
    var isModified = true;
    var hTLV = null;
    var hT = "00";
    var hL = "00";
    var hV = "";
    this.getLengthHexFromValue = function() {
      if (typeof this.hV == "undefined" || this.hV == null) {
        throw "this.hV is null or undefined.";
      }
      if (this.hV.length % 2 == 1) {
        throw "value hex must be even length: n=" + hV.length + ",v=" + this.hV;
      }
      var n = this.hV.length / 2;
      var hN = n.toString(16);
      if (hN.length % 2 == 1) {
        hN = "0" + hN;
      }
      if (n < 128) {
        return hN;
      } else {
        var hNlen = hN.length / 2;
        if (hNlen > 15) {
          throw "ASN.1 length too long to represent by 8x: n = " + n.toString(16);
        }
        var head = 128 + hNlen;
        return head.toString(16) + hN;
      }
    };
    this.getEncodedHex = function() {
      if (this.hTLV == null || this.isModified) {
        this.hV = this.getFreshValueHex();
        this.hL = this.getLengthHexFromValue();
        this.hTLV = this.hT + this.hL + this.hV;
        this.isModified = false;
      }
      return this.hTLV;
    };
    this.getValueHex = function() {
      this.getEncodedHex();
      return this.hV;
    };
    this.getFreshValueHex = function() {
      return "";
    };
  };
  KJUR.asn1.DERAbstractString = function(params) {
    KJUR.asn1.DERAbstractString.superclass.constructor.call(this);
    var s = null;
    var hV = null;
    this.getString = function() {
      return this.s;
    };
    this.setString = function(newS) {
      this.hTLV = null;
      this.isModified = true;
      this.s = newS;
      this.hV = stohex(this.s);
    };
    this.setStringHex = function(newHexString) {
      this.hTLV = null;
      this.isModified = true;
      this.s = null;
      this.hV = newHexString;
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
    if (typeof params != "undefined") {
      if (typeof params == "string") {
        this.setString(params);
      } else if (typeof params["str"] != "undefined") {
        this.setString(params["str"]);
      } else if (typeof params["hex"] != "undefined") {
        this.setStringHex(params["hex"]);
      }
    }
  };
  extendClass(KJUR.asn1.DERAbstractString, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERAbstractTime = function(params) {
    KJUR.asn1.DERAbstractTime.superclass.constructor.call(this);
    var s = null;
    var date = null;
    this.localDateToUTC = function(d) {
      utc = d.getTime() + d.getTimezoneOffset() * 6e4;
      var utcDate = new Date(utc);
      return utcDate;
    };
    this.formatDate = function(dateObject, type, withMillis) {
      var pad = this.zeroPadding;
      var d = this.localDateToUTC(dateObject);
      var year = String(d.getFullYear());
      if (type == "utc")
        year = year.substring(2, 4);
      var month = pad(String(d.getMonth() + 1), 2);
      var day = pad(String(d.getDate()), 2);
      var hour = pad(String(d.getHours()), 2);
      var min = pad(String(d.getMinutes()), 2);
      var sec = pad(String(d.getSeconds()), 2);
      var s2 = year + month + day + hour + min + sec;
      if (withMillis === true) {
        var millis = d.getMilliseconds();
        if (millis != 0) {
          var sMillis = pad(String(millis), 3);
          sMillis = sMillis.replace(/[0]+$/, "");
          s2 = s2 + "." + sMillis;
        }
      }
      return s2 + "Z";
    };
    this.zeroPadding = function(s2, len) {
      if (s2.length >= len)
        return s2;
      return new Array(len - s2.length + 1).join("0") + s2;
    };
    this.getString = function() {
      return this.s;
    };
    this.setString = function(newS) {
      this.hTLV = null;
      this.isModified = true;
      this.s = newS;
      this.hV = stohex(newS);
    };
    this.setByDateValue = function(year, month, day, hour, min, sec) {
      var dateObject = new Date(Date.UTC(year, month - 1, day, hour, min, sec, 0));
      this.setByDate(dateObject);
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
  };
  extendClass(KJUR.asn1.DERAbstractTime, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERAbstractStructured = function(params) {
    KJUR.asn1.DERAbstractString.superclass.constructor.call(this);
    var asn1Array = null;
    this.setByASN1ObjectArray = function(asn1ObjectArray) {
      this.hTLV = null;
      this.isModified = true;
      this.asn1Array = asn1ObjectArray;
    };
    this.appendASN1Object = function(asn1Object) {
      this.hTLV = null;
      this.isModified = true;
      this.asn1Array.push(asn1Object);
    };
    this.asn1Array = new Array();
    if (typeof params != "undefined") {
      if (typeof params["array"] != "undefined") {
        this.asn1Array = params["array"];
      }
    }
  };
  extendClass(KJUR.asn1.DERAbstractStructured, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERBoolean = function() {
    KJUR.asn1.DERBoolean.superclass.constructor.call(this);
    this.hT = "01";
    this.hTLV = "0101ff";
  };
  extendClass(KJUR.asn1.DERBoolean, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERInteger = function(params) {
    KJUR.asn1.DERInteger.superclass.constructor.call(this);
    this.hT = "02";
    this.setByBigInteger = function(bigIntegerValue) {
      this.hTLV = null;
      this.isModified = true;
      this.hV = KJUR.asn1.ASN1Util.bigIntToMinTwosComplementsHex(bigIntegerValue);
    };
    this.setByInteger = function(intValue) {
      var bi = new BigInteger(String(intValue), 10);
      this.setByBigInteger(bi);
    };
    this.setValueHex = function(newHexString) {
      this.hV = newHexString;
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
    if (typeof params != "undefined") {
      if (typeof params["bigint"] != "undefined") {
        this.setByBigInteger(params["bigint"]);
      } else if (typeof params["int"] != "undefined") {
        this.setByInteger(params["int"]);
      } else if (typeof params == "number") {
        this.setByInteger(params);
      } else if (typeof params["hex"] != "undefined") {
        this.setValueHex(params["hex"]);
      }
    }
  };
  extendClass(KJUR.asn1.DERInteger, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERBitString = function(params) {
    if (params !== void 0 && typeof params.obj !== "undefined") {
      var o = KJUR.asn1.ASN1Util.newObject(params.obj);
      params.hex = "00" + o.getEncodedHex();
    }
    KJUR.asn1.DERBitString.superclass.constructor.call(this);
    this.hT = "03";
    this.setHexValueIncludingUnusedBits = function(newHexStringIncludingUnusedBits) {
      this.hTLV = null;
      this.isModified = true;
      this.hV = newHexStringIncludingUnusedBits;
    };
    this.setUnusedBitsAndHexValue = function(unusedBits, hValue) {
      if (unusedBits < 0 || 7 < unusedBits) {
        throw "unused bits shall be from 0 to 7: u = " + unusedBits;
      }
      var hUnusedBits = "0" + unusedBits;
      this.hTLV = null;
      this.isModified = true;
      this.hV = hUnusedBits + hValue;
    };
    this.setByBinaryString = function(binaryString) {
      binaryString = binaryString.replace(/0+$/, "");
      var unusedBits = 8 - binaryString.length % 8;
      if (unusedBits == 8)
        unusedBits = 0;
      for (var i = 0; i <= unusedBits; i++) {
        binaryString += "0";
      }
      var h = "";
      for (var i = 0; i < binaryString.length - 1; i += 8) {
        var b = binaryString.substring(i, i + 8);
        var x = parseInt(b, 2).toString(16);
        if (x.length == 1)
          x = "0" + x;
        h += x;
      }
      this.hTLV = null;
      this.isModified = true;
      this.hV = "0" + unusedBits + h;
    };
    this.setByBooleanArray = function(booleanArray) {
      var s = "";
      for (var i = 0; i < booleanArray.length; i++) {
        if (booleanArray[i] == true) {
          s += "1";
        } else {
          s += "0";
        }
      }
      this.setByBinaryString(s);
    };
    this.newFalseArray = function(nLength) {
      var a = new Array(nLength);
      for (var i = 0; i < nLength; i++) {
        a[i] = false;
      }
      return a;
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
    if (typeof params != "undefined") {
      if (typeof params == "string" && params.toLowerCase().match(/^[0-9a-f]+$/)) {
        this.setHexValueIncludingUnusedBits(params);
      } else if (typeof params["hex"] != "undefined") {
        this.setHexValueIncludingUnusedBits(params["hex"]);
      } else if (typeof params["bin"] != "undefined") {
        this.setByBinaryString(params["bin"]);
      } else if (typeof params["array"] != "undefined") {
        this.setByBooleanArray(params["array"]);
      }
    }
  };
  extendClass(KJUR.asn1.DERBitString, KJUR.asn1.ASN1Object);
  KJUR.asn1.DEROctetString = function(params) {
    if (params !== void 0 && typeof params.obj !== "undefined") {
      var o = KJUR.asn1.ASN1Util.newObject(params.obj);
      params.hex = o.getEncodedHex();
    }
    KJUR.asn1.DEROctetString.superclass.constructor.call(this, params);
    this.hT = "04";
  };
  extendClass(KJUR.asn1.DEROctetString, KJUR.asn1.DERAbstractString);
  KJUR.asn1.DERNull = function() {
    KJUR.asn1.DERNull.superclass.constructor.call(this);
    this.hT = "05";
    this.hTLV = "0500";
  };
  extendClass(KJUR.asn1.DERNull, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERObjectIdentifier = function(params) {
    var itox = function(i) {
      var h = i.toString(16);
      if (h.length == 1)
        h = "0" + h;
      return h;
    };
    var roidtox = function(roid) {
      var h = "";
      var bi = new BigInteger(roid, 10);
      var b = bi.toString(2);
      var padLen = 7 - b.length % 7;
      if (padLen == 7)
        padLen = 0;
      var bPad = "";
      for (var i = 0; i < padLen; i++)
        bPad += "0";
      b = bPad + b;
      for (var i = 0; i < b.length - 1; i += 7) {
        var b8 = b.substring(i, i + 7);
        if (i != b.length - 7)
          b8 = "1" + b8;
        h += itox(parseInt(b8, 2));
      }
      return h;
    };
    KJUR.asn1.DERObjectIdentifier.superclass.constructor.call(this);
    this.hT = "06";
    this.setValueHex = function(newHexString) {
      this.hTLV = null;
      this.isModified = true;
      this.s = null;
      this.hV = newHexString;
    };
    this.setValueOidString = function(oidString) {
      if (!oidString.match(/^[0-9.]+$/)) {
        throw "malformed oid string: " + oidString;
      }
      var h = "";
      var a = oidString.split(".");
      var i0 = parseInt(a[0]) * 40 + parseInt(a[1]);
      h += itox(i0);
      a.splice(0, 2);
      for (var i = 0; i < a.length; i++) {
        h += roidtox(a[i]);
      }
      this.hTLV = null;
      this.isModified = true;
      this.s = null;
      this.hV = h;
    };
    this.setValueName = function(oidName) {
      var oid = KJUR.asn1.x509.OID.name2oid(oidName);
      if (oid !== "") {
        this.setValueOidString(oid);
      } else {
        throw "DERObjectIdentifier oidName undefined: " + oidName;
      }
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
    if (params !== void 0) {
      if (typeof params === "string") {
        if (params.match(/^[0-2].[0-9.]+$/)) {
          this.setValueOidString(params);
        } else {
          this.setValueName(params);
        }
      } else if (params.oid !== void 0) {
        this.setValueOidString(params.oid);
      } else if (params.hex !== void 0) {
        this.setValueHex(params.hex);
      } else if (params.name !== void 0) {
        this.setValueName(params.name);
      }
    }
  };
  extendClass(KJUR.asn1.DERObjectIdentifier, KJUR.asn1.ASN1Object);
  KJUR.asn1.DEREnumerated = function(params) {
    KJUR.asn1.DEREnumerated.superclass.constructor.call(this);
    this.hT = "0a";
    this.setByBigInteger = function(bigIntegerValue) {
      this.hTLV = null;
      this.isModified = true;
      this.hV = KJUR.asn1.ASN1Util.bigIntToMinTwosComplementsHex(bigIntegerValue);
    };
    this.setByInteger = function(intValue) {
      var bi = new BigInteger(String(intValue), 10);
      this.setByBigInteger(bi);
    };
    this.setValueHex = function(newHexString) {
      this.hV = newHexString;
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
    if (typeof params != "undefined") {
      if (typeof params["int"] != "undefined") {
        this.setByInteger(params["int"]);
      } else if (typeof params == "number") {
        this.setByInteger(params);
      } else if (typeof params["hex"] != "undefined") {
        this.setValueHex(params["hex"]);
      }
    }
  };
  extendClass(KJUR.asn1.DEREnumerated, KJUR.asn1.ASN1Object);
  KJUR.asn1.DERUTF8String = function(params) {
    KJUR.asn1.DERUTF8String.superclass.constructor.call(this, params);
    this.hT = "0c";
  };
  extendClass(KJUR.asn1.DERUTF8String, KJUR.asn1.DERAbstractString);
  KJUR.asn1.DERNumericString = function(params) {
    KJUR.asn1.DERNumericString.superclass.constructor.call(this, params);
    this.hT = "12";
  };
  extendClass(KJUR.asn1.DERNumericString, KJUR.asn1.DERAbstractString);
  KJUR.asn1.DERPrintableString = function(params) {
    KJUR.asn1.DERPrintableString.superclass.constructor.call(this, params);
    this.hT = "13";
  };
  extendClass(KJUR.asn1.DERPrintableString, KJUR.asn1.DERAbstractString);
  KJUR.asn1.DERTeletexString = function(params) {
    KJUR.asn1.DERTeletexString.superclass.constructor.call(this, params);
    this.hT = "14";
  };
  extendClass(KJUR.asn1.DERTeletexString, KJUR.asn1.DERAbstractString);
  KJUR.asn1.DERIA5String = function(params) {
    KJUR.asn1.DERIA5String.superclass.constructor.call(this, params);
    this.hT = "16";
  };
  extendClass(KJUR.asn1.DERIA5String, KJUR.asn1.DERAbstractString);
  KJUR.asn1.DERUTCTime = function(params) {
    KJUR.asn1.DERUTCTime.superclass.constructor.call(this, params);
    this.hT = "17";
    this.setByDate = function(dateObject) {
      this.hTLV = null;
      this.isModified = true;
      this.date = dateObject;
      this.s = this.formatDate(this.date, "utc");
      this.hV = stohex(this.s);
    };
    this.getFreshValueHex = function() {
      if (typeof this.date == "undefined" && typeof this.s == "undefined") {
        this.date = /* @__PURE__ */ new Date();
        this.s = this.formatDate(this.date, "utc");
        this.hV = stohex(this.s);
      }
      return this.hV;
    };
    if (params !== void 0) {
      if (params.str !== void 0) {
        this.setString(params.str);
      } else if (typeof params == "string" && params.match(/^[0-9]{12}Z$/)) {
        this.setString(params);
      } else if (params.hex !== void 0) {
        this.setStringHex(params.hex);
      } else if (params.date !== void 0) {
        this.setByDate(params.date);
      }
    }
  };
  extendClass(KJUR.asn1.DERUTCTime, KJUR.asn1.DERAbstractTime);
  KJUR.asn1.DERGeneralizedTime = function(params) {
    KJUR.asn1.DERGeneralizedTime.superclass.constructor.call(this, params);
    this.hT = "18";
    this.withMillis = false;
    this.setByDate = function(dateObject) {
      this.hTLV = null;
      this.isModified = true;
      this.date = dateObject;
      this.s = this.formatDate(this.date, "gen", this.withMillis);
      this.hV = stohex(this.s);
    };
    this.getFreshValueHex = function() {
      if (this.date === void 0 && this.s === void 0) {
        this.date = /* @__PURE__ */ new Date();
        this.s = this.formatDate(this.date, "gen", this.withMillis);
        this.hV = stohex(this.s);
      }
      return this.hV;
    };
    if (params !== void 0) {
      if (params.str !== void 0) {
        this.setString(params.str);
      } else if (typeof params == "string" && params.match(/^[0-9]{14}Z$/)) {
        this.setString(params);
      } else if (params.hex !== void 0) {
        this.setStringHex(params.hex);
      } else if (params.date !== void 0) {
        this.setByDate(params.date);
      }
      if (params.millis === true) {
        this.withMillis = true;
      }
    }
  };
  extendClass(KJUR.asn1.DERGeneralizedTime, KJUR.asn1.DERAbstractTime);
  KJUR.asn1.DERSequence = function(params) {
    KJUR.asn1.DERSequence.superclass.constructor.call(this, params);
    this.hT = "30";
    this.getFreshValueHex = function() {
      var h = "";
      for (var i = 0; i < this.asn1Array.length; i++) {
        var asn1Obj = this.asn1Array[i];
        h += asn1Obj.getEncodedHex();
      }
      this.hV = h;
      return this.hV;
    };
  };
  extendClass(KJUR.asn1.DERSequence, KJUR.asn1.DERAbstractStructured);
  KJUR.asn1.DERSet = function(params) {
    KJUR.asn1.DERSet.superclass.constructor.call(this, params);
    this.hT = "31";
    this.sortFlag = true;
    this.getFreshValueHex = function() {
      var a = new Array();
      for (var i = 0; i < this.asn1Array.length; i++) {
        var asn1Obj = this.asn1Array[i];
        a.push(asn1Obj.getEncodedHex());
      }
      if (this.sortFlag == true)
        a.sort();
      this.hV = a.join("");
      return this.hV;
    };
    if (typeof params != "undefined") {
      if (typeof params.sortflag != "undefined" && params.sortflag == false)
        this.sortFlag = false;
    }
  };
  extendClass(KJUR.asn1.DERSet, KJUR.asn1.DERAbstractStructured);
  KJUR.asn1.DERTaggedObject = function(params) {
    KJUR.asn1.DERTaggedObject.superclass.constructor.call(this);
    this.hT = "a0";
    this.hV = "";
    this.isExplicit = true;
    this.asn1Object = null;
    this.setASN1Object = function(isExplicitFlag, tagNoHex, asn1Object) {
      this.hT = tagNoHex;
      this.isExplicit = isExplicitFlag;
      this.asn1Object = asn1Object;
      if (this.isExplicit) {
        this.hV = this.asn1Object.getEncodedHex();
        this.hTLV = null;
        this.isModified = true;
      } else {
        this.hV = null;
        this.hTLV = asn1Object.getEncodedHex();
        this.hTLV = this.hTLV.replace(/^../, tagNoHex);
        this.isModified = false;
      }
    };
    this.getFreshValueHex = function() {
      return this.hV;
    };
    if (typeof params != "undefined") {
      if (typeof params["tag"] != "undefined") {
        this.hT = params["tag"];
      }
      if (typeof params["explicit"] != "undefined") {
        this.isExplicit = params["explicit"];
      }
      if (typeof params["obj"] != "undefined") {
        this.asn1Object = params["obj"];
        this.setASN1Object(this.isExplicit, this.hT, this.asn1Object);
      }
    }
  };
  extendClass(KJUR.asn1.DERTaggedObject, KJUR.asn1.ASN1Object);

  // node_modules/jsencrypt/lib/JSEncryptRSAKey.js
  var __extends = /* @__PURE__ */ (function() {
    var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    return function(d, b) {
      if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
  })();
  var JSEncryptRSAKey = (
    /** @class */
    (function(_super) {
      __extends(JSEncryptRSAKey2, _super);
      function JSEncryptRSAKey2(key) {
        var _this = _super.call(this) || this;
        if (key) {
          if (typeof key === "string") {
            _this.parseKey(key);
          } else if (JSEncryptRSAKey2.hasPrivateKeyProperty(key) || JSEncryptRSAKey2.hasPublicKeyProperty(key)) {
            _this.parsePropertiesFrom(key);
          }
        }
        return _this;
      }
      JSEncryptRSAKey2.prototype.parseKey = function(pem) {
        try {
          var modulus = 0;
          var public_exponent = 0;
          var reHex = /^\s*(?:[0-9A-Fa-f][0-9A-Fa-f]\s*)+$/;
          var der = reHex.test(pem) ? Hex.decode(pem) : Base64.unarmor(pem);
          var asn1 = ASN1.decode(der);
          if (asn1.sub.length === 3) {
            asn1 = asn1.sub[2].sub[0];
          }
          if (asn1.sub.length === 9) {
            modulus = asn1.sub[1].getHexStringValue();
            this.n = parseBigInt(modulus, 16);
            public_exponent = asn1.sub[2].getHexStringValue();
            this.e = parseInt(public_exponent, 16);
            var private_exponent = asn1.sub[3].getHexStringValue();
            this.d = parseBigInt(private_exponent, 16);
            var prime1 = asn1.sub[4].getHexStringValue();
            this.p = parseBigInt(prime1, 16);
            var prime2 = asn1.sub[5].getHexStringValue();
            this.q = parseBigInt(prime2, 16);
            var exponent1 = asn1.sub[6].getHexStringValue();
            this.dmp1 = parseBigInt(exponent1, 16);
            var exponent2 = asn1.sub[7].getHexStringValue();
            this.dmq1 = parseBigInt(exponent2, 16);
            var coefficient = asn1.sub[8].getHexStringValue();
            this.coeff = parseBigInt(coefficient, 16);
          } else if (asn1.sub.length === 2) {
            if (asn1.sub[0].sub) {
              var bit_string = asn1.sub[1];
              var sequence = bit_string.sub[0];
              modulus = sequence.sub[0].getHexStringValue();
              this.n = parseBigInt(modulus, 16);
              public_exponent = sequence.sub[1].getHexStringValue();
              this.e = parseInt(public_exponent, 16);
            } else {
              modulus = asn1.sub[0].getHexStringValue();
              this.n = parseBigInt(modulus, 16);
              public_exponent = asn1.sub[1].getHexStringValue();
              this.e = parseInt(public_exponent, 16);
            }
          } else {
            return false;
          }
          return true;
        } catch (ex) {
          return false;
        }
      };
      JSEncryptRSAKey2.prototype.getPrivateBaseKey = function() {
        var options = {
          array: [
            new KJUR.asn1.DERInteger({ int: 0 }),
            new KJUR.asn1.DERInteger({ bigint: this.n }),
            new KJUR.asn1.DERInteger({ int: this.e }),
            new KJUR.asn1.DERInteger({ bigint: this.d }),
            new KJUR.asn1.DERInteger({ bigint: this.p }),
            new KJUR.asn1.DERInteger({ bigint: this.q }),
            new KJUR.asn1.DERInteger({ bigint: this.dmp1 }),
            new KJUR.asn1.DERInteger({ bigint: this.dmq1 }),
            new KJUR.asn1.DERInteger({ bigint: this.coeff })
          ]
        };
        var seq = new KJUR.asn1.DERSequence(options);
        return seq.getEncodedHex();
      };
      JSEncryptRSAKey2.prototype.getPrivateBaseKeyB64 = function() {
        return hex2b64(this.getPrivateBaseKey());
      };
      JSEncryptRSAKey2.prototype.getPublicBaseKey = function() {
        var first_sequence = new KJUR.asn1.DERSequence({
          array: [
            new KJUR.asn1.DERObjectIdentifier({ oid: "1.2.840.113549.1.1.1" }),
            // RSA Encryption pkcs #1 oid
            new KJUR.asn1.DERNull()
          ]
        });
        var second_sequence = new KJUR.asn1.DERSequence({
          array: [
            new KJUR.asn1.DERInteger({ bigint: this.n }),
            new KJUR.asn1.DERInteger({ int: this.e })
          ]
        });
        var bit_string = new KJUR.asn1.DERBitString({
          hex: "00" + second_sequence.getEncodedHex()
        });
        var seq = new KJUR.asn1.DERSequence({
          array: [first_sequence, bit_string]
        });
        return seq.getEncodedHex();
      };
      JSEncryptRSAKey2.prototype.getPublicBaseKeyB64 = function() {
        return hex2b64(this.getPublicBaseKey());
      };
      JSEncryptRSAKey2.wordwrap = function(str, width) {
        width = width || 64;
        if (!str) {
          return str;
        }
        var regex = "(.{1," + width + "})( +|$\n?)|(.{1," + width + "})";
        return str.match(RegExp(regex, "g")).join("\n");
      };
      JSEncryptRSAKey2.prototype.getPrivateKey = function() {
        var key = "-----BEGIN RSA PRIVATE KEY-----\n";
        key += JSEncryptRSAKey2.wordwrap(this.getPrivateBaseKeyB64()) + "\n";
        key += "-----END RSA PRIVATE KEY-----";
        return key;
      };
      JSEncryptRSAKey2.prototype.getPublicKey = function() {
        var key = "-----BEGIN PUBLIC KEY-----\n";
        key += JSEncryptRSAKey2.wordwrap(this.getPublicBaseKeyB64()) + "\n";
        key += "-----END PUBLIC KEY-----";
        return key;
      };
      JSEncryptRSAKey2.hasPublicKeyProperty = function(obj) {
        obj = obj || {};
        return obj.hasOwnProperty("n") && obj.hasOwnProperty("e");
      };
      JSEncryptRSAKey2.hasPrivateKeyProperty = function(obj) {
        obj = obj || {};
        return obj.hasOwnProperty("n") && obj.hasOwnProperty("e") && obj.hasOwnProperty("d") && obj.hasOwnProperty("p") && obj.hasOwnProperty("q") && obj.hasOwnProperty("dmp1") && obj.hasOwnProperty("dmq1") && obj.hasOwnProperty("coeff");
      };
      JSEncryptRSAKey2.prototype.parsePropertiesFrom = function(obj) {
        this.n = obj.n;
        this.e = obj.e;
        if (obj.hasOwnProperty("d")) {
          this.d = obj.d;
          this.p = obj.p;
          this.q = obj.q;
          this.dmp1 = obj.dmp1;
          this.dmq1 = obj.dmq1;
          this.coeff = obj.coeff;
        }
      };
      return JSEncryptRSAKey2;
    })(RSAKey)
  );

  // node_modules/jsencrypt/lib/JSEncrypt.js
  var _a;
  var version3 = typeof process !== "undefined" ? (_a = process.env) === null || _a === void 0 ? void 0 : _a.npm_package_version : void 0;
  var JSEncrypt = (
    /** @class */
    (function() {
      function JSEncrypt2(options) {
        if (options === void 0) {
          options = {};
        }
        this.default_key_size = options.default_key_size ? parseInt(options.default_key_size, 10) : 1024;
        this.default_public_exponent = options.default_public_exponent || "010001";
        this.log = options.log || false;
        this.key = options.key || null;
      }
      JSEncrypt2.prototype.setKey = function(key) {
        if (key) {
          if (this.log && this.key) {
            console.warn("A key was already set, overriding existing.");
          }
          this.key = new JSEncryptRSAKey(key);
        } else if (!this.key && this.log) {
          console.error("A key was not set.");
        }
      };
      JSEncrypt2.prototype.setPrivateKey = function(privkey) {
        this.setKey(privkey);
      };
      JSEncrypt2.prototype.setPublicKey = function(pubkey) {
        this.setKey(pubkey);
      };
      JSEncrypt2.prototype.decrypt = function(str) {
        try {
          return this.getKey().decrypt(b64tohex(str));
        } catch (ex) {
          return false;
        }
      };
      JSEncrypt2.prototype.encrypt = function(str) {
        try {
          return hex2b64(this.getKey().encrypt(str));
        } catch (ex) {
          return false;
        }
      };
      JSEncrypt2.prototype.encryptOAEP = function(str) {
        try {
          return hex2b64(this.getKey().encrypt(str, oaep_pad));
        } catch (ex) {
          return false;
        }
      };
      JSEncrypt2.prototype.sign = function(str, digestMethod, digestName) {
        if (digestMethod === void 0) {
          digestMethod = function(raw) {
            return raw;
          };
        }
        if (digestName === void 0) {
          digestName = "";
        }
        try {
          return hex2b64(this.getKey().sign(str, digestMethod, digestName));
        } catch (ex) {
          return false;
        }
      };
      JSEncrypt2.prototype.signSha256 = function(str) {
        return this.sign(str, function(text) {
          return rstr2hex(rstr_sha256(text));
        }, "sha256");
      };
      JSEncrypt2.prototype.verify = function(str, signature, digestMethod) {
        if (digestMethod === void 0) {
          digestMethod = function(raw) {
            return raw;
          };
        }
        try {
          return this.getKey().verify(str, b64tohex(signature), digestMethod);
        } catch (ex) {
          return false;
        }
      };
      JSEncrypt2.prototype.verifySha256 = function(str, signature) {
        return this.verify(str, signature, function(text) {
          return rstr2hex(rstr_sha256(text));
        });
      };
      JSEncrypt2.prototype.getKey = function(cb) {
        if (!this.key) {
          this.key = new JSEncryptRSAKey();
          if (cb && {}.toString.call(cb) === "[object Function]") {
            this.key.generateAsync(this.default_key_size, this.default_public_exponent, cb);
            return;
          }
          this.key.generate(this.default_key_size, this.default_public_exponent);
        }
        return this.key;
      };
      JSEncrypt2.prototype.getPrivateKey = function() {
        return this.getKey().getPrivateKey();
      };
      JSEncrypt2.prototype.getPrivateKeyB64 = function() {
        return this.getKey().getPrivateBaseKeyB64();
      };
      JSEncrypt2.prototype.getPublicKey = function() {
        return this.getKey().getPublicKey();
      };
      JSEncrypt2.prototype.getPublicKeyB64 = function() {
        return this.getKey().getPublicBaseKeyB64();
      };
      JSEncrypt2.version = version3;
      return JSEncrypt2;
    })()
  );

  // node_modules/jsencrypt/lib/index.js
  var lib_default = JSEncrypt;

  // src/modules/services/niutrans.ts
  init_prefs();
  var translate22 = async function(data2) {
    const apikey = data2.secret;
    const dictNo = getPref("niutransDictNo");
    const memoryNo = getPref("niutransMemoryNo");
    const endpoint = getPref("niutransEndpoint") || "https://niutrans.com/niuInterface";
    let requestUrl;
    let requestBody;
    if (endpoint.includes("trans.neu.edu.cn")) {
      requestUrl = `https://trans.neu.edu.cn/niutrans/textTranslation?apikey=${data2.secret}`;
      requestBody = {
        from: data2.langfrom.split("-")[0],
        to: data2.langto.split("-")[0],
        src_text: data2.raw
      };
    } else {
      requestUrl = `${endpoint}/textTranslation?pluginType=zotero&apikey=${apikey}`;
      requestBody = {
        from: data2.langfrom.split("-")[0],
        to: data2.langto.split("-")[0],
        termDictionaryLibraryId: dictNo,
        translationMemoryLibraryId: memoryNo,
        // TEMP: implement realmCode in settings
        realmCode: 99,
        source: "zotero",
        src_text: data2.raw,
        caller_id: data2.callerID
      };
    }
    const xhr = await Zotero.HTTP.request("POST", requestUrl, {
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/plain, */*"
      },
      body: JSON.stringify(requestBody),
      responseType: "json"
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    if (xhr.response.code !== 200) {
      if (xhr.response.code === 13001) {
        throw new TranslateError(
          getString("service-niutranspro-error-insufficient-balance", {
            args: {
              code: xhr.response.code,
              message: xhr.response.msg
            }
          })
        );
      }
      throw `Service error: ${xhr.response.code}:${xhr.response.msg}`;
    }
    if (endpoint.includes("neu.edu.cn")) {
      for (let i = 0; i < xhr.response.data[0].sentences.length; i++) {
        data2.result += xhr.response.data[0].sentences[i].data;
      }
    } else {
      data2.result = xhr.response.data.tgt_text;
    }
  };
  var Niutrans = {
    id: "niutranspro",
    type: "sentence",
    helpUrl: "https://niutrans.com/cloud/resource/index",
    defaultSecret: "",
    secretValidator(secret) {
      const flag = secret?.length === 32;
      return {
        secret,
        status: flag,
        info: flag ? "" : `The secret is your NiuTrans API-KEY. The secret length must be 32, but got ${secret?.length}.`
      };
    },
    translate: translate22,
    config(settings) {
      async function niutransLogin(username, password) {
        let loginFlag = false;
        let loginErrorMessage = "Not login";
        const keyResponse = await getPublicKey();
        if (keyResponse?.status !== 200 || keyResponse.response.flag !== 1) {
          return { loginFlag, loginErrorMessage };
        }
        let jsessionid = "";
        const setCookie = keyResponse.getResponseHeader?.("Set-Cookie") || "";
        if (setCookie && setCookie.includes("JSESSIONID=")) {
          const match = setCookie.match(/JSESSIONID=([^;]+)/);
          if (match && match[1]) {
            jsessionid = match[1];
          }
        }
        const encrypt = new lib_default();
        encrypt.setPublicKey(keyResponse.response.key);
        let encryptionPassword = encrypt.encrypt(password);
        encryptionPassword = encodeURIComponent(encryptionPassword);
        const userLoginResponse = await loginApi(
          username,
          encryptionPassword,
          jsessionid
        );
        if (userLoginResponse?.status === 200) {
          if (userLoginResponse.response.flag === 1) {
            const apikey = userLoginResponse.response.apikey;
            setPref("niutransUsername", username);
            setPref("niutransPassword", password);
            setServiceSecret("niutranspro", apikey);
            await setDictLibList(apikey, jsessionid);
            await setMemoryLibList(apikey, jsessionid);
            loginFlag = true;
          } else {
            loginFlag = false;
            loginErrorMessage = userLoginResponse.response.msg;
          }
        }
        return { loginFlag, loginErrorMessage };
      }
      async function loginApi(username, password, jsessionid) {
        return await Zotero.HTTP.request(
          "POST",
          "https://apis.niutrans.com/NiuTransAPIServer/checkInformation",
          {
            body: `account=${username}&encryptionPassword=${password}`,
            responseType: "json",
            headers: {
              Cookie: `JSESSIONID=${jsessionid}`
            }
          }
        );
      }
      async function setDictLibList(apikey, jsessionid) {
        const xhr = await Zotero.HTTP.request(
          "POST",
          "https://apis.niutrans.com/NiuTransAPIServer/getDictLibList",
          {
            body: `apikey=${apikey}`,
            responseType: "json",
            headers: {
              Cookie: `JSESSIONID=${jsessionid}`
            }
          }
        );
        if (xhr?.status === 200 && xhr.response.flag !== 0) {
          const dictList = xhr.response.dlist;
          const dictNo = dictList.find((dict) => dict.isUse === 1)?.dictNo || "";
          if (dictNo && !getPref("niutransDictNo")) {
            setPref("niutransDictNo", dictNo);
          }
          setPref(
            "niutransDictLibList",
            JSON.stringify(
              dictList.map((dict) => ({
                dictName: dict.dictName,
                dictNo: dict.dictNo
              }))
            )
          );
        }
      }
      async function setMemoryLibList(apikey, jsessionid) {
        const xhr = await Zotero.HTTP.request(
          "POST",
          "https://apis.niutrans.com/NiuTransAPIServer/getMemoryLibList",
          {
            body: `apikey=${apikey}`,
            responseType: "json",
            headers: {
              Cookie: `JSESSIONID=${jsessionid}`
            }
          }
        );
        if (xhr?.status === 200 && xhr.response.flag !== 0) {
          const memoryList = xhr.response.mlist;
          const memoryNo = memoryList.find((memory) => memory.isUse === 1)?.memoryNo || "";
          if (memoryNo && !getPref("niutransMemoryNo")) {
            setPref("niutransMemoryNo", memoryNo);
          }
          setPref(
            "niutransMemoryLibList",
            JSON.stringify(
              memoryList.map((memory) => ({
                memoryName: memory.memoryName,
                memoryNo: memory.memoryNo
              }))
            )
          );
        }
      }
      async function getPublicKey() {
        return await Zotero.HTTP.request(
          "GET",
          "https://apis.niutrans.com/NiuTransAPIServer/getpublickey",
          {
            responseType: "json"
          }
        );
      }
      const dictLibList = getPref("niutransDictLibList");
      const memoryLibList = getPref("niutransMemoryLibList");
      const dictLibListObj = JSON.parse(dictLibList);
      const memoryLibListObj = JSON.parse(memoryLibList);
      settings.addTextSetting({
        prefKey: "niutransEndpoint",
        nameKey: "service-niutranspro-dialog-endpoint"
      }).addSetting("", "", { tag: "div" }).addTextSetting({
        prefKey: "niutransUsername",
        nameKey: "service-niutranspro-dialog-username"
      }).addPasswordSetting({
        prefKey: "niutransPassword",
        nameKey: "service-niutranspro-dialog-password",
        inputType: "password"
      }).addStaticRow("", {
        tag: "div",
        namespace: "html",
        styles: {
          display: "flex",
          justifyContent: "space-between"
        },
        children: [
          // Register
          {
            tag: "button",
            namespace: "html",
            attributes: {
              type: "button"
            },
            properties: {
              innerHTML: getString("service-niutranspro-dialog-signup")
            },
            listeners: [
              {
                type: "click",
                listener: (e) => {
                  Zotero.launchURL("https://niutrans.com/register");
                }
              }
            ]
          },
          // Forget password
          {
            tag: "button",
            namespace: "html",
            attributes: {
              type: "button"
            },
            properties: {
              innerHTML: getString("service-niutranspro-dialog-forget")
            },
            listeners: [
              {
                type: "click",
                listener: (e) => {
                  Zotero.launchURL("https://niutrans.com/password_find");
                }
              }
            ]
          },
          // Sing out
          {
            tag: "button",
            namespace: "html",
            attributes: {
              type: "button"
            },
            properties: {
              innerHTML: getString("service-niutranspro-dialog-signout")
            },
            listeners: [
              {
                type: "click",
                listener: async (e) => {
                  setPref("niutransUsername", "");
                  setPref("niutransPassword", "");
                  setPref("niutransDictLibList", "[]");
                  setPref("niutransMemoryLibList", "[]");
                  setPref("niutransDictNo", "");
                  setPref("niutransMemoryNo", "");
                  setServiceSecret("niutranspro", "");
                  const _dialog = settings;
                  _dialog.window.close();
                  await createServiceSettingsDialog(Niutrans);
                }
              }
            ]
          },
          // Sing in
          {
            tag: "button",
            namespace: "html",
            attributes: {
              type: "button"
            },
            properties: {
              innerHTML: getString("service-niutranspro-dialog-signin")
            },
            listeners: [
              {
                type: "click",
                listener: async (e) => {
                  const _dialog = settings;
                  const data2 = _dialog.getAllSettingsData();
                  const { loginFlag, loginErrorMessage } = await niutransLogin(
                    data2["niutransUsername"],
                    data2["niutransPassword"]
                  );
                  if (!loginFlag) {
                    Zotero.alert(_dialog.window, "Error", loginErrorMessage);
                    return loginErrorMessage;
                  }
                  _dialog.saveAllSettings();
                  _dialog.window.close();
                  await createServiceSettingsDialog(Niutrans);
                }
              }
            ]
          }
        ]
      }).addSelectSetting({
        prefKey: "niutransMemoryNo",
        nameKey: "service-niutranspro-dialog-memoryLib",
        options: memoryLibListObj.map(
          (memory) => ({
            value: memory.memoryNo,
            label: memory.memoryName
          })
        )
      }).addSelectSetting({
        prefKey: "niutransDictNo",
        nameKey: "service-niutranspro-dialog-dictLib",
        options: dictLibListObj.map(
          (dict) => ({
            value: dict.dictNo,
            label: dict.dictName
          })
        )
      }).addStaticRow("", {
        tag: "label",
        children: [
          {
            tag: "label",
            properties: {
              innerHTML: `${getString("service-niutranspro-dialog-tip0")} `
            }
          },
          {
            tag: "a",
            properties: {
              href: "https://niutrans.com/cloud/resource/index",
              target: "_blank",
              innerHTML: getString("service-niutranspro-dialog-tip1")
            }
          },
          {
            tag: "label",
            properties: {
              innerHTML: ` ${getString("service-niutranspro-dialog-tip2")}`
            }
          }
        ]
      });
    }
  };

  // src/modules/services/nllb.ts
  init_prefs();
  init_locale();
  var translate23 = async (data2) => {
    const serveurl = getPref("nllb.serveendpoint") || "http://localhost:6060";
    const apiurl = getPref("nllb.apiendpoint") || "http://localhost:7860";
    const model = getPref("nllb.model");
    const refreshHandler = addon.api.getTemporaryRefreshHandler({ task: data2 });
    if (model === "nllb-serve") {
      data2.result = getString("status-translating");
      refreshHandler();
      const nonStreamCallback = (xmlhttp) => {
        xmlhttp.onload = () => {
          try {
            const responseObj = JSON.parse(xmlhttp.response);
            data2.result = responseObj.translation[0];
          } catch (error) {
            return;
          }
          refreshHandler();
        };
      };
      const xhr = await Zotero.HTTP.request("POST", `${serveurl}/translate`, {
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          source: data2.raw,
          src_lang: mapLang3(data2.langfrom),
          tgt_lang: mapLang3(data2.langto)
        }),
        responseType: "text",
        requestObserver: (xmlhttp) => {
          nonStreamCallback(xmlhttp);
        }
      });
      if (xhr?.status !== 200) {
        throw `Request error: ${xhr?.status}`;
      }
    } else if (model === "nllb-api") {
      const apistream = getPref("nllb.apistream");
      if (!apistream) {
        data2.result = getString("status-translating");
        refreshHandler();
      }
      const streamCallback = (xmlhttp) => {
        let preLength = 0;
        let result = "";
        xmlhttp.onprogress = (e) => {
          const newResponse = e.target.response.slice(preLength);
          const lines = newResponse.split("\n");
          for (const line of lines) {
            if (line) {
              result += line.replace("data:", "").trim() || "";
            }
          }
          if (e.target.timeout) {
            e.target.timeout = 0;
          }
          data2.result = result;
          preLength = e.target.response.length;
          refreshHandler();
        };
      };
      const nonStreamCallback = (xmlhttp) => {
        xmlhttp.onload = () => {
          try {
            data2.result = xmlhttp.response.result;
          } catch (error) {
            return;
          }
          refreshHandler();
        };
      };
      const stream = apistream ? "/stream" : "";
      const responseType = apistream ? "text" : "json";
      const xhr = await Zotero.HTTP.request(
        "GET",
        `${apiurl}/api/v4/translator${stream}?text=${data2.raw}&source=${mapLang3(data2.langfrom)}&target=${mapLang3(data2.langto)}`,
        {
          headers: {
            accept: "application/json"
          },
          responseType: `${responseType}`,
          requestObserver: (xmlhttp) => {
            if (apistream) {
              streamCallback(xmlhttp);
            } else {
              nonStreamCallback(xmlhttp);
            }
          }
        }
      );
      if (xhr?.status !== 200) {
        throw `Request error: ${xhr?.status}`;
      }
    }
  };
  function mapLang3(lang) {
    const traditionalChinese = ["zh-HK", "zh-MO", "zh-TW"];
    if (traditionalChinese.includes(lang)) {
      return "zho_Hant";
    } else if (lang.split("-")[0] in LANG_MAP4) {
      return LANG_MAP4[lang.split("-")[0]];
    }
    return lang;
  }
  var LANG_MAP4 = {
    en: "eng_Latn",
    zh: "zho_Hans",
    ja: "jpn_Jpan",
    ko: "kor_Hang",
    fr: "fra_Latn",
    es: "spa_Latn",
    de: "deu_Latn",
    it: "ita_Latn",
    nl: "nld_Latn",
    pt: "por_Latn",
    ru: "rus_Cyrl",
    ar: "arb_Arab",
    tr: "tur_Latn",
    vi: "vie_Latn",
    th: "tha_Thai",
    id: "ind_Latn",
    ms: "zsm_Latn",
    hi: "hin_Deva",
    bn: "ben_Beng",
    ur: "urd_Arab",
    he: "heb_Hebr",
    pl: "pol_Latn",
    ro: "ron_Latn",
    cs: "ces_Latn",
    hu: "hun_Latn",
    sv: "swe_Latn",
    da: "dan_Latn",
    fi: "fin_Latn",
    el: "ell_Grek",
    uk: "ukr_Cyrl",
    km: "khm_Khmr"
  };
  var Nllb = {
    id: "nllb",
    type: "sentence",
    translate: translate23,
    config(settings) {
      settings.addSelectSetting({
        prefKey: "nllb.model",
        nameKey: "service-nllb-dialog-model",
        options: [
          {
            value: "nllb-api",
            label: "nllb-api API"
          },
          {
            value: "nllb-serve",
            label: "nllb-serve REST API"
          }
        ]
      }).addTextSetting({
        nameKey: "service-nllb-dialog-apiendpoint",
        prefKey: "nllb.apiendpoint"
      }).addCheckboxSetting({
        nameKey: "service-nllb-dialog-apistream",
        prefKey: "nllb.apistream"
      }).addTextSetting({
        nameKey: "service-nllb-dialog-serveendpoint",
        prefKey: "nllb.serveendpoint"
      }).addButton(getString("service-nllb-dialog-apilabel"), "", {
        noClose: true,
        callback: () => {
          Zotero.launchURL(
            "https://github.com/winstxnhdw/nllb-api?tab=readme-ov-file#self-hosting"
          );
        }
      }).addButton(getString("service-nllb-dialog-servelabel"), "", {
        noClose: true,
        callback: () => {
          Zotero.launchURL(
            "https://github.com/thammegowda/nllb-serve?tab=readme-ov-file#nllb-serve"
          );
        }
      });
    },
    requireExternalConfig: true
  };

  // src/modules/services/openl.ts
  var translate24 = async (data2) => {
    const [services2, apikey] = data2.secret.split("#");
    const serviceList = services2.split(",");
    const xhr = await Zotero.HTTP.request(
      "POST",
      "https://api.openl.club/group/translate",
      {
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          apikey,
          services: serviceList,
          text: data2.raw,
          source_lang: data2.langfrom.split("-")[0],
          target_lang: data2.langto.split("-")[0]
        }),
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response;
    if (!res.status) {
      throw `Service error: ${JSON.stringify(res)}`;
    }
    delete res.status;
    let tgt = "";
    const openLServices = Object.keys(res);
    if (openLServices.length === 1) {
      const resObj = res[openLServices[0]];
      if (resObj.status) {
        tgt = resObj.result;
      } else {
        throw "Service error: all OpenL services failed.";
      }
    } else {
      for (const openLService of openLServices) {
        if (res[openLService].status) {
          tgt += `[${openLService}] ${res[openLService].result}
`;
        }
      }
    }
    data2.result = tgt;
  };
  var Openl = {
    id: "openl",
    type: "sentence",
    defaultSecret: "service1,service2,...#apikey",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = parts.length === 2;
      const partsInfo = `Services: ${parts[0]}
APIKey: ${parts[1]}`;
      return {
        secret,
        status: flag && secret !== Openl.defaultSecret,
        info: secret === Openl.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of OpenL is service1,service2,...#APIKey. The secret must have 2 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate24
  };

  // src/modules/services/pot.ts
  init_prefs();
  var translate25 = async (data2) => {
    const port = getPref("pot.port");
    const xhr = await Zotero.HTTP.request(
      "POST",
      `http://127.0.0.1:${port}/translate`,
      {
        headers: {
          "content-type": "text/plain;charset=UTF-8"
        },
        body: data2.raw,
        responseType: "text"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    data2.result = "";
  };
  var Pot = {
    id: "pot",
    type: "sentence",
    helpUrl: "https://github.com/pot-app/pot-desktop",
    translate: translate25,
    config(settings) {
      settings.addNumberSetting({
        prefKey: "pot.port",
        nameKey: "service-pot-dialog-port",
        min: 1,
        max: 65535,
        step: 1
      });
    },
    requireExternalConfig: true
  };

  // src/modules/services/qwenmt.ts
  init_prefs();
  init_locale();
  var translate26 = async function(data2) {
    const apiURL = getPref("qwenmt.endPoint") || "https://dashscope.aliyuncs.com/compatible-mode";
    const model = getPref("qwenmt.model") || "qwen-mt-plus";
    const domains_prompt = getPref("qwenmt.domains") || "";
    const refreshHandler = addon.api.getTemporaryRefreshHandler({ task: data2 });
    data2.result = getString("status-translating");
    refreshHandler();
    const nonStreamCallback = (xmlhttp) => {
      xmlhttp.onload = () => {
        try {
          const responseObj = xmlhttp.response;
          const resultContent = responseObj.choices[0].message.content;
          data2.result = resultContent.replace(/^\n\n/, "");
        } catch (error) {
          return;
        }
        refreshHandler();
      };
    };
    const xhr = await Zotero.HTTP.request(
      "POST",
      `${apiURL}/v1/chat/completions`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data2.secret}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: data2.raw
            }
          ],
          translation_options: {
            source_lang: "auto",
            target_lang: mapLang4(data2.langto),
            domains: domains_prompt
          }
        }),
        responseType: "json",
        requestObserver: (xmlhttp) => {
          nonStreamCallback(xmlhttp);
        }
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
  };
  function mapLang4(lang) {
    if (lang in LANG_MAP5) {
      return LANG_MAP5[lang];
    }
    return lang.split("-")[0];
  }
  var LANG_MAP5 = {
    en: "English",
    zh: "Chinese",
    "zh-CN": "Chinese",
    "zh-HK": "Traditional Chinese",
    "zh-MO": "Traditional Chinese",
    "zh-SG": "Chinese",
    "zh-TW": "Traditional Chinese",
    ja: "Japanese",
    ko: "Korean",
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    nl: "Dutch",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
    tr: "Turkish",
    vi: "Vietnamese",
    th: "Thai",
    id: "Indonesian",
    ms: "Malay",
    hi: "Hindi",
    bn: "Bengali",
    ur: "Urdu",
    fa: "Persian",
    he: "Hebrew",
    pl: "Polish",
    ro: "Romanian",
    cs: "Czech",
    hu: "Hungarian",
    sv: "Swedish",
    da: "Danish",
    fi: "Finnish",
    el: "Greek",
    no: "Norwegian",
    uk: "Ukrainian",
    km: "Khmer"
  };
  var QwenMT = {
    id: "qwenmt",
    type: "sentence",
    helpUrl: "https://help.aliyun.com/zh/model-studio/user-guide/machine-translation/",
    defaultSecret: "",
    secretValidator(secret) {
      const flag = Boolean(secret);
      return {
        secret,
        status: flag,
        info: flag ? "" : "The secret is not set."
      };
    },
    translate: translate26,
    config(settings) {
      settings.addTextSetting({
        prefKey: "qwenmt.endPoint",
        nameKey: "service-qwenmt-dialog-endPoint"
      }).addTextSetting({
        prefKey: "qwenmt.model",
        nameKey: "service-qwenmt-dialog-model"
      }).addTextSetting({
        prefKey: "qwenmt.domains",
        nameKey: "service-qwenmt-dialog-domains"
      });
    }
  };

  // src/modules/services/webliodict.ts
  var translate27 = async function(data2) {
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://ejje.weblio.jp/content/${encodeURIComponent(data2.raw)}/`,
      { responseType: "text" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response;
    const doc = new DOMParser().parseFromString(res, "text/html");
    const translations = [];
    const process2 = (ele) => {
      if (!ele) {
        return [];
      }
      return Array.from(ele.children).map(
        (e) => e.innerText.trim()
      );
    };
    translations.push(process2(doc.querySelector(".descriptionWrp")?.children[0]));
    doc.querySelector(".descriptionWrp")?.remove();
    Array.prototype.forEach.call(
      doc.querySelector(".summaryM")?.children,
      (e) => translations.push(process2(e))
    );
    for (const e of doc.querySelectorAll(".intrst")) {
      const tableRow = e?.querySelector(
        "tr"
      );
      if (tableRow) {
        translations.push(process2(tableRow));
      }
    }
    data2.result = translations.filter((t) => t).map((t) => t.join(":")).join("\n");
  };
  var WeblioDict = {
    id: "webliodict",
    type: "word",
    translate: translate27
  };

  // src/modules/services/xftrans.ts
  init_prefs();
  var translate28 = async function(data2) {
    const [appid, apiSecret, apiKey] = data2.secret.split("#");
    const useNiutrans = getPref("xftrans.engine") === "niutrans";
    const config2 = useNiutrans ? {
      appid,
      apiSecret,
      apiKey,
      host: "ntrans.xfyun.cn",
      hostUrl: "https://ntrans.xfyun.cn/v2/ots",
      uri: "/v2/ots"
    } : {
      appid,
      apiSecret,
      apiKey,
      host: "itrans.xfyun.cn",
      hostUrl: "https://itrans.xfyun.cn/v2/its",
      uri: "/v2/its"
    };
    function transLang(inlang = "") {
      if (useNiutrans) {
        const simplifiedChinese = ["zh-CN", "zh-SG", "zh"];
        const traditionalChinese = ["zh-HK", "zh-MO", "zh-TW"];
        if (simplifiedChinese.includes(inlang)) {
          return "cn";
        }
        if (traditionalChinese.includes(inlang)) {
          return "cht";
        } else {
          return inlang.split("-")[0];
        }
      } else {
        const langs = [{ regex: /zh(?:[-_]\w+)?/, lang: "cn" }];
        let outlang = inlang.split("-")[0];
        langs.forEach((obj) => {
          if (obj.regex.test(inlang)) {
            outlang = obj.lang;
          }
        });
        return outlang;
      }
    }
    const transVar = {
      text: data2.raw,
      from: transLang(data2.langfrom),
      to: transLang(data2.langto)
    };
    const date = (/* @__PURE__ */ new Date()).toUTCString();
    const postBody = getPostBody(transVar.text, transVar.from, transVar.to);
    const digest = await getDigest(postBody);
    const options = {
      url: config2.hostUrl,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json,version=1.0",
        Host: config2.host,
        Date: date,
        Digest: digest,
        Authorization: await getAuthStr(date, digest)
      },
      json: true,
      body: postBody
    };
    function getPostBody(text, from, to) {
      const digestObj = {
        common: {
          app_id: config2.appid
        },
        business: {
          from,
          to
        },
        data: {
          text: base64(new TextEncoder().encode(text).buffer)
        }
      };
      return digestObj;
    }
    async function getDigest(body) {
      return `SHA-256=${base64(await sha256Digest(JSON.stringify(body)))}`;
    }
    async function getAuthStr(date2, digest2) {
      const signatureOrigin = `host: ${config2.host}
date: ${date2}
POST ${config2.uri} HTTP/1.1
digest: ${digest2}`;
      const signatureSha = await hmacSha256Digest(
        signatureOrigin,
        config2.apiSecret
      );
      const signature = base64(signatureSha);
      const authorizationOrigin = `api_key="${config2.apiKey}", algorithm="hmac-sha256", headers="host date request-line digest", signature="${signature}"`;
      return authorizationOrigin;
    }
    const xhr = await Zotero.HTTP.request("POST", options.url, {
      headers: options.headers,
      responseType: "json",
      body: JSON.stringify(options.body)
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    data2.result = xhr.response.data.result.trans_result.dst;
  };
  var XFfrans = {
    id: "xftrans",
    type: "sentence",
    helpUrl: "https://console.xfyun.cn/services/its",
    defaultSecret: "AppID#ApiSecret#ApiKey",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = parts.length === 3;
      const partsInfo = `AppID: ${parts[0]}
ApiSecret: ${parts[1]}
ApiKey: ${parts[2]}`;
      return {
        secret,
        status: flag && secret !== XFfrans.defaultSecret,
        info: secret === XFfrans.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of Xftrans Domain Text Translation is AppID#ApiSecret#ApiKey. The secret must have 3 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate28,
    config(settings) {
      settings.addSelectSetting({
        prefKey: "xftrans.engine",
        nameKey: "service-xftrans-dialog-engine",
        options: [
          {
            value: "xftrans",
            label: "xftrans"
          },
          {
            value: "niutrans",
            label: "niutrans"
          }
        ]
      });
    }
  };

  // src/modules/services/tencenttransmart.ts
  var TencentTransmart = {
    id: "tencenttransmart",
    name: "Tencent Transmart",
    type: "sentence",
    translate: async function(data2) {
      const { raw: text } = data2;
      const from = (data2.langfrom || "").split("-")[0];
      const to = (data2.langto || "").split("-")[0];
      const URL2 = "https://transmart.qq.com/api/imt";
      const body = {
        header: {
          fn: "auto_translation",
          client_key: "browser-chrome-110.0.0-Mac OS-df4bd4c5-a65d-44b2-a40f-42f34f3535f2-1677486696487"
        },
        type: "plain",
        model_category: "normal",
        source: {
          lang: from,
          text_list: [text]
        },
        target: {
          lang: to
        }
      };
      const headers = {
        "Content-Type": "application/json",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        referer: "https://transmart.qq.com/zh-CN/index"
      };
      const xhr = await Zotero.HTTP.request("POST", URL2, {
        headers,
        body: JSON.stringify(body),
        responseType: "json"
      });
      if (xhr.status !== 200) {
        throw `Request error: ${xhr.status}`;
      }
      const result = xhr.response;
      const { auto_translation } = result;
      if (auto_translation) {
        data2.result = auto_translation.join("\n").trim();
      } else {
        throw JSON.stringify(result);
      }
    }
  };

  // src/modules/services/youdao.ts
  var translate29 = async function(data2) {
    const param = `${data2.langfrom.toUpperCase().replace("-", "_")}2${data2.langto.toUpperCase().replace("-", "_")}`;
    const xhr = await Zotero.HTTP.request(
      "GET",
      `http://fanyi.youdao.com/translate?&doctype=json&type=${param}&i=${encodeURIComponent(
        data2.raw
      )}`,
      { responseType: "json" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response.translateResult;
    let tgt = "";
    for (const i in res) {
      for (const j in res[i]) {
        tgt += res[i][j].tgt;
      }
    }
    data2.result = tgt;
  };
  var Youdao = {
    id: "youdao",
    type: "sentence",
    translate: translate29
  };

  // src/modules/services/youdaodict.ts
  var translate30 = async function(data2) {
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://www.youdao.com/w/${encodeURIComponent(data2.raw)}/`,
      { responseType: "text" }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    let res = xhr.response;
    try {
      res = res.replace(/(\r\n|\n|\r)/gm, "");
      res = res.match(
        /<div id="phrsListTab.*webTrans" class="trans-wrapper trans-tab">/gm
      );
      let tgt = "";
      if (res.length > 0) {
        tgt = res[0].replace(/<[^>]*>?/gm, "\n");
        tgt = tgt.replace(/\n\s*\n/g, "\n");
        tgt = tgt.replace(/\s\s+/g, " ");
        tgt = tgt.trim();
      }
      if (tgt.length != 0) {
        const audioList = [];
        const en = tgt.match(/英 \[.+?\]/gm);
        if (en != null && en.length != 0) {
          audioList.push({
            text: en[0],
            url: `https://dict.youdao.com/dictvoice?audio=${data2.raw}&type=1`
          });
        }
        const us = tgt.match(/美 \[.+?\]/gm);
        if (us != null && us.length != 0) {
          audioList.push({
            text: us[0],
            url: `https://dict.youdao.com/dictvoice?audio=${data2.raw}&type=2`
          });
        }
        data2.audio = audioList;
      }
      data2.result = tgt;
    } catch (e) {
      throw "Parse Error";
    }
  };
  var YoudaoDict = {
    id: "youdaodict",
    type: "word",
    translate: translate30
  };

  // src/modules/services/youdaozhiyun.ts
  init_prefs();
  var translate31 = async function(data2) {
    function encodeRFC5987ValueChars(str) {
      return encodeURIComponent(str).replace(
        /['()]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
      ).replace(/\*/g, "%2A").replace(/%20/g, "+");
    }
    function truncate(q) {
      const len = q.length;
      if (len <= 20) return q;
      return q.substring(0, 10) + len + q.substring(len - 10, len);
    }
    const [appid, key, vocabId] = data2.secret.split("#");
    const salt = (/* @__PURE__ */ new Date()).getTime();
    const curtime = Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3);
    const query = data2.raw;
    const from = data2.langfrom;
    const to = data2.langto;
    const str1 = appid + truncate(query) + salt + curtime + key;
    const sign = hex(await sha256Digest(str1));
    const domain = getPref("youdaozhiyun.domain");
    const xhr = await Zotero.HTTP.request(
      "GET",
      `https://openapi.youdao.com/api?q=${encodeRFC5987ValueChars(
        query
      )}&appKey=${appid}&salt=${salt}&from=${from}&to=${to}&sign=${sign}&signType=v3&curtime=${curtime}&vocabId=${vocabId}&domain=${domain}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        responseType: "json"
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response;
    if (parseInt(res.errorCode) !== 0) {
      throw `Service error: ${res.errorCode}`;
    }
    data2.result = res.translation.join("");
  };
  var YoudaoZhiyun = {
    id: "youdaozhiyun",
    type: "sentence",
    helpUrl: "https://ai.youdao.com/console/#/service-singleton/text-translation",
    defaultSecret: "appid#appsecret#vocabid(optional)",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = [2, 3].includes(parts.length);
      const partsInfo = `AppID: ${parts[0]}
AppKey: ${parts[1]}
VocabID: ${parts[2] ? parts[2] : ""}`;
      return {
        secret,
        status: flag && secret !== YoudaoZhiyun.defaultSecret,
        info: secret === YoudaoZhiyun.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of YoudaoZhiyun is AppID#AppKey#VocabID(optional). The secret must have 2 or 3 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate31,
    config(settings) {
      settings.addSelectSetting({
        prefKey: "youdaozhiyun.domain",
        nameKey: "service-youdaozhiyun-dialog-domain",
        options: [
          {
            value: "general",
            label: "general"
          },
          {
            value: "computers",
            label: "computers"
          },
          {
            value: "medicine",
            label: "medicine"
          },
          {
            value: "finance",
            label: "finance"
          },
          {
            value: "game",
            label: "game"
          }
        ]
      });
    }
  };

  // src/modules/services/youdaozhiyunllm.ts
  init_prefs();
  init_locale();
  var translate32 = async function(data2) {
    function truncate(q) {
      const len = q.length;
      if (len <= 20) return q;
      return q.substring(0, 10) + len + q.substring(len - 10, len);
    }
    function transLang(inlang = "") {
      const langs = [{ regex: /zh(?:[-_]\w+)?/, lang: "zh-CHS" }];
      let outlang = inlang.split("-")[0];
      langs.forEach((obj) => {
        if (obj.regex.test(inlang)) {
          outlang = obj.lang;
        }
      });
      return outlang;
    }
    const [appid, key] = data2.secret.split("#");
    const salt = (/* @__PURE__ */ new Date()).getTime();
    const curtime = Math.round((/* @__PURE__ */ new Date()).getTime() / 1e3);
    const query = data2.raw;
    const from = transLang(data2.langfrom);
    const to = transLang(data2.langto);
    const str1 = appid + truncate(query) + salt + curtime + key;
    const sign = hex(await sha256Digest(str1));
    const model = getPref("youdaozhiyunllm.model");
    const prompt = getPref("youdaozhiyunllm.prompt");
    const stream = getPref("youdaozhiyunllm.stream");
    const streamType = stream ? "increment" : "full";
    const refreshHandler = addon.api.getTemporaryRefreshHandler({ task: data2 });
    if (!stream) {
      data2.result = getString("status-translating");
      refreshHandler();
    }
    const streamCallback = (xmlhttp) => {
      let preLength = 0;
      let result = "";
      let buffer = "";
      let currentEventType = "";
      xmlhttp.onprogress = (e) => {
        const newResponse = e.target.response.slice(preLength);
        preLength = e.target.response.length;
        buffer += newResponse;
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          if (!event) continue;
          let eventData = "";
          let isMessageEvent = false;
          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEventType = line.replace("event:", "").trim();
              isMessageEvent = currentEventType === "message";
            } else if (line.startsWith("data:")) {
              eventData = line.replace("data:", "").trim();
            }
          }
          if (isMessageEvent && eventData) {
            try {
              const dataObj = JSON.parse(eventData);
              if (dataObj.transIncre) {
                result += dataObj.transIncre;
              }
            } catch (error) {
              return;
            }
          }
        }
        if (e.target.timeout) {
          e.target.timeout = 0;
        }
        data2.result = result;
        refreshHandler();
      };
    };
    const nonStreamCallback = (xmlhttp) => {
      let result = "";
      let currentEventType = "";
      xmlhttp.onload = () => {
        try {
          const responseObj = xmlhttp.responseText;
          const lines = responseObj.split("\n");
          let eventData = "";
          let isMessageEvent = false;
          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEventType = line.replace("event:", "").trim();
              isMessageEvent = currentEventType === "message";
            } else if (line.startsWith("data:")) {
              eventData = line.replace("data:", "").trim();
            }
            if (isMessageEvent && eventData) {
              try {
                const dataObj = JSON.parse(eventData);
                if (dataObj.transFull) {
                  result = dataObj.transFull;
                }
              } catch (error) {
                return;
              }
            }
          }
        } catch (error) {
          return;
        }
        data2.result = result;
        refreshHandler();
      };
    };
    const xhr = await Zotero.HTTP.request(
      "POST",
      `https://openapi.youdao.com/llm_trans?i=${encodeURIComponent(query)}&appKey=${appid}&salt=${salt}&from=${from}&to=${to}&sign=${sign}&signType=v3&curtime=${curtime}&handleOption=${model}&prompt=${encodeURIComponent(prompt)}&streamType=${streamType}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        responseType: "text",
        requestObserver: (xmlhttp) => {
          if (stream) {
            streamCallback(xmlhttp);
          } else {
            nonStreamCallback(xmlhttp);
          }
        }
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    const res = xhr.response;
    if (res.includes("errorCode")) {
      throw `Service error: ${res}`;
    }
    if (res.includes("event:error")) {
      throw `Service error: ${grepErrorParagraphs(res)}`;
    }
    function grepErrorParagraphs(input) {
      const paragraphs = input.split(/\n\n+/);
      return paragraphs.filter((paragraph) => paragraph.includes("event:error"));
    }
  };
  var YoudaoZhiyunLLM = {
    id: "youdaozhiyunllm",
    type: "sentence",
    helpUrl: "https://ai.youdao.com/console/#/service-singleton/llm_translate",
    defaultSecret: "appid#appsecret",
    secretValidator(secret) {
      const parts = secret?.split("#");
      const flag = parts.length == 2;
      const partsInfo = `AppID: ${parts[0]}
AppKey: ${parts[1]}`;
      return {
        secret,
        status: flag && secret !== YoudaoZhiyunLLM.defaultSecret,
        info: secret === YoudaoZhiyunLLM.defaultSecret ? "The secret is not set." : flag ? partsInfo : `The secret format of YoudaoLLM is AppID#AppKey. The secret must have 2 parts joined by '#', but got ${parts?.length}.
${partsInfo}`
      };
    },
    translate: translate32,
    config(settings) {
      settings.addSelectSetting({
        nameKey: "service-youdaozhiyunllm-dialog-model",
        prefKey: "youdaozhiyunllm.model",
        options: [
          {
            value: "0",
            label: getString("service-youdaozhiyunllm-dialog-pro")
          },
          {
            value: "3",
            label: getString("service-youdaozhiyunllm-dialog-lite")
          }
        ]
      }).addTextAreaSetting({
        nameKey: "service-youdaozhiyunllm-dialog-prompt",
        // @ts-expect-error this pref is not inited in prefs.js
        prefKey: "youdaozhiyunllm.prompt",
        placeholder: "Maximum 1200 characters or 400 words",
        maxlength: "1200"
      }).addCheckboxSetting({
        prefKey: "youdaozhiyunllm.stream",
        nameKey: "service-youdaozhiyunllm-dialog-stream"
      });
    }
  };

  // src/modules/services/deeplcustom.ts
  init_prefs();
  var translate33 = async function(data2) {
    const url = getPref("deeplcustom.endpoint");
    const reqBody = JSON.stringify({
      text: data2.raw,
      source_lang: data2.langfrom.split("-")[0].toUpperCase(),
      target_lang: data2.langto.split("-")[0].toUpperCase()
    });
    const xhr = await Zotero.HTTP.request("POST", url, {
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      responseType: "json",
      body: reqBody
    });
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    data2.result = xhr.response.data;
  };
  var DeepLCustom = {
    id: "deeplcustom",
    type: "sentence",
    helpUrl: "https://github.com/ramonmi/DeepLX-for-Zotero/blob/main/README_zh.md",
    translate: translate33,
    config(settings) {
      settings.addTextSetting({
        prefKey: "deeplcustom.endpoint",
        nameKey: "service-deeplcustom-dialog-endPoint"
      });
    },
    requireExternalConfig: true
  };

  // src/modules/services/deeplx.ts
  init_prefs();
  var translate34 = async function(data2) {
    const id = 1e3 * (Math.floor(Math.random() * 99999) + 83e5) + 1;
    const url = getPref("deeplx.endpoint") || "https://www2.deepl.com/jsonrpc";
    const t = data2.raw;
    const ICounts = (t.match(/i/g) || []).length + 1;
    const ts = Date.now();
    let reqBody = JSON.stringify({
      jsonrpc: "2.0",
      method: "LMT_handle_texts",
      id,
      params: {
        texts: [
          {
            text: t,
            requestAlternatives: 3
          }
        ],
        splitting: "newlines",
        lang: {
          source_lang_user_selected: mapLang5(data2.langfrom),
          target_lang: mapLang5(data2.langto)
        },
        timestamp: ts - ts % ICounts + ICounts,
        commonJobParams: {
          wasSpoken: false,
          transcribe_as: ""
        }
      }
    });
    if ((id + 5) % 29 == 0 || (id + 3) % 13 == 0) {
      reqBody = reqBody.replace('"method":"', '"method" : "');
    } else {
      reqBody = reqBody.replace('"method":"', '"method": "');
    }
    const xhr = await Zotero.HTTP.request(
      "POST",
      `${url}?client=chrome-extension,1.28.0&method=LMT_handle_jobs`,
      {
        headers: {
          Accept: "*/*",
          Authorization: "None",
          "Cache-Control": "no-cache",
          "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh-TW;q=0.7,zh-HK;q=0.6,zh;q=0.5",
          "Content-Type": "application/json",
          DNT: "1",
          Origin: "chrome-extension://cofdbpoegempjloogbagkncekinflcnj",
          Pragma: "no-cache",
          Priority: "u=1, i",
          Referer: "https://www.deepl.com/",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "none",
          "Sec-GPC": "1",
          "User-Agent": "DeepLBrowserExtension/1.28.0 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        },
        responseType: "json",
        body: reqBody
      }
    );
    if (xhr?.status !== 200) {
      throw `Request error: ${xhr?.status}`;
    }
    data2.result = xhr.response.result.texts[0].text;
  };
  function mapLang5(lang) {
    if (lang in LANG_MAP6) {
      return LANG_MAP6[lang];
    }
    return lang.split("-")[0].toUpperCase();
  }
  var LANG_MAP6 = {
    "pt-BR": "PT-BR",
    "pt-PT": "PT-PT",
    "zh-CN": "ZH-HANS",
    "zh-HK": "ZH-HANT",
    "zh-MO": "ZH-HANT",
    "zh-SG": "ZH-HANS",
    "zh-TW": "ZH-HANT"
  };
  var DeepLX = {
    id: "deeplx",
    type: "sentence",
    translate: translate34,
    config(setting) {
      setting.addTextSetting({
        prefKey: "deeplx.endpoint",
        nameKey: "service-deeplx-dialog-endPoint"
      });
    }
  };

  // src/modules/services/index.ts
  var register = [
    Aliyun,
    Baidu,
    BaiduField,
    Bing,
    BingDict,
    Caiyun,
    CambridgeDict,
    Claude,
    Cnki,
    CollinsDict,
    DeeplFree,
    DeeplPro,
    DeepLCustom,
    DeepLX,
    FreeDictionaryAPI,
    Gemini,
    GramotaDict,
    Google,
    GoogleAPI,
    ChatGPT,
    customGPT1,
    customGPT2,
    customGPT3,
    azureGPT,
    Haici,
    HaiciDict,
    Huoshan,
    HuoshanWeb,
    LibreTranslate,
    Microsoft,
    Mtranserver,
    Niutrans,
    Nllb,
    Openl,
    Pot,
    QwenMT,
    Tencent,
    TencentTransmart,
    WeblioDict,
    XFfrans,
    Youdao,
    YoudaoDict,
    YoudaoZhiyun,
    YoudaoZhiyunLLM
  ];
  var TranslationServices = class {
    #services = Object.freeze(
      this.sortServices(register)
    );
    /**
     * Sort the TranslateService list by the following rules:
     * 1. Free and no-config services (no secret, no config) come first.
     * 2. All other services are sorted by `id` in ascending order (case-insensitive).
     * 3. Services whose `id` starts with "custom" are placed last
     *    (sorted by `id` in ascending order within this group).
     */
    sortServices(services2) {
      return services2.sort((a, b) => {
        const rank = (s) => {
          const needsSecret = !!s.defaultSecret || !!s.secretValidator;
          const hasConfig = !!s.config;
          const needExternalConfig = s.requireExternalConfig;
          if (s.type === "sentence") {
            if (s.id.startsWith("custom")) return 3;
            if (!needsSecret && !needExternalConfig) return 0;
            if (!needsSecret && needExternalConfig) return 1;
            if (needsSecret && !hasConfig) return 2;
            return 2;
          } else {
            return 0;
          }
        };
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return a.id.localeCompare(b.id);
      });
    }
    getServiceById(id) {
      return this.#services.find((service) => service.id === id);
    }
    getAllServices() {
      return [...this.#services];
    }
    getAllServicesWithType(type) {
      return this.getAllServices().filter((service) => service.type === type);
    }
    getServiceNameByID(id) {
      const baseName = getPref(`renameServices.${id}`) || getString(`service-${id}`);
      const service = this.getServiceById(id);
      if (!!service?.defaultSecret || !!service?.secretValidator || id.startsWith("custom")) {
        return baseName + "\u{1F5DD}\uFE0F";
      }
      if (service?.requireExternalConfig) {
        return baseName + "\u{1F4CD}";
      }
      return baseName;
    }
    getAllServiceNames() {
      return this.getAllServices().map(
        (service) => this.getServiceNameByID(service.id)
      );
    }
    getAllServiceNamesWithType(type) {
      return this.getAllServicesWithType(type).map(
        (service) => this.getServiceNameByID(service.id)
      );
    }
    /**
     * Get the set of unconfigured service IDs.
     * A service is unconfigured if it requires a secret but none is set or validation fails.
     * @returns Set of service IDs that are not configured
     */
    getUnconfiguredServiceIds() {
      const unconfigured = /* @__PURE__ */ new Set();
      let secrets = {};
      try {
        secrets = JSON.parse(getPref("secretObj") || "{}");
      } catch {
        secrets = {};
      }
      for (const service of this.#services) {
        const needsSecret = !!service.defaultSecret || !!service.secretValidator || service.id.startsWith("custom");
        if (!needsSecret) continue;
        const secret = secrets[service.id] || "";
        if (!secret) {
          unconfigured.add(service.id);
          continue;
        }
        if (service.secretValidator) {
          try {
            if (!service.secretValidator(secret).status) {
              unconfigured.add(service.id);
            }
          } catch {
          }
        }
      }
      return unconfigured;
    }
    async runTranslationTask(task, options = {}) {
      ztoolkit.log("runTranslationTask", options);
      const { noCache, noCheckZoteroItemLanguage, noDisplay } = options;
      task = task || getLastTranslateTask();
      if (!task || !task.raw) {
        ztoolkit.log("skipped empty");
        return false;
      }
      task.status = "processing";
      let disabledByItemLanguage = false;
      if (!noCheckZoteroItemLanguage && task.itemId) {
        const item2 = Zotero.Items.getTopLevel([Zotero.Items.get(task.itemId)])[0];
        if (item2 && task.type !== "custom") {
          const itemLanguage = getPref("autoDetectLanguage") ? task.langfrom : (item2.getField("language") || "").split("-")[0];
          const disabledLanguages = getPref("disabledLanguages").split(",");
          disabledByItemLanguage = disabledLanguages.length > 0 && !!itemLanguage && disabledLanguages.includes(itemLanguage);
        }
      }
      if (disabledByItemLanguage) {
        ztoolkit.log("disabledByItemLanguage");
        return false;
      }
      const splitChar = getPref("splitChar").trim();
      const regex = splitChar === "" ? "" : new RegExp(`${splitChar}[^${splitChar}]*${splitChar}`, "g");
      task.raw = task.raw.replace(regex, "");
      task.result = "";
      if (!noDisplay) {
        addon.api.getTemporaryRefreshHandler()();
      }
      let cacheHit = false;
      if (!noCache) {
        const cachedTask = addon.data.translate.queue.findLast((_t) => {
          return _t.status === "success" && _t.raw === task.raw && _t.service === task.service && (!task.langfrom || _t.langfrom === task.langfrom) && (!task.langto || _t.langto === task.langto);
        });
        if (cachedTask) {
          cacheHit = true;
          ztoolkit.log("cache hit", sanitizeTaskForLog(cachedTask));
          task.result = cachedTask.result;
          task.status = "success";
          if (!noDisplay) {
            addon.api.getTemporaryRefreshHandler()();
          }
        }
      }
      if (!cacheHit) {
        const service = this.getServiceById(task.service);
        if (!service) {
          task.result = `${task.service} is not implemented.`;
          task.status = "fail";
          return false;
        }
        const runner = new TranslateTaskRunner(service.translate);
        await runner.run(task);
        const stripEnabled = getPref("stripEmptyLines");
        if (stripEnabled && task.result) {
          task.result = stripEmptyLines(task.result, true);
        }
        const resultRegex = getPref("resultRegex");
        if (resultRegex) {
          try {
            const regex2 = new RegExp(resultRegex, "g");
            task.result = task.result.replace(regex2, "");
          } catch (e) {
            ztoolkit.log("Invalid result regex", e);
            task.result = `Invalid result regex: ${resultRegex}. Please check settings > Translate > Advanced > Result Regex.`;
          }
        }
        if (task.extraTasks?.length) {
          Promise.all(
            task.extraTasks.map((extraTask) => {
              return this.runTranslationTask(extraTask, {
                noCheckZoteroItemLanguage,
                noDisplay: true
              });
            })
          ).then(() => {
            addon.hooks.onReaderTabPanelRefresh();
          });
        }
        if (task.status === "fail" && task.candidateServices.length > 0) {
          task.service = task.candidateServices.shift();
          task.status = "waiting";
          return await this.runTranslationTask(task, options);
        } else {
          if (!noDisplay) {
            addon.api.getTemporaryRefreshHandler()();
          }
        }
      }
      const success = task.status === "success";
      const item = Zotero.Items.get(task.itemId);
      if (success) {
        switch (task.type) {
          case "annotation":
            {
              if (item) {
                const savePosition = getPref("annotationTranslationPosition");
                const savePositionInBody = getPref(
                  "annotationTranslationPositionInBody"
                );
                const currentText = ((savePosition === "comment" ? item.annotationComment : item.annotationText) || "").replace(regex, "");
                const translationText = `${splitChar}${task.result}${splitChar}
`;
                let text = `${currentText[currentText.length - 1] === "\n" ? "" : "\n"}${translationText}`;
                if (splitChar !== "") {
                  text = savePosition === "body" && savePositionInBody === "before" ? `${translationText}${currentText}` : `${currentText}${text}`;
                }
                item[savePosition === "comment" ? "annotationComment" : "annotationText"] = text;
                const enableAutoTag = getPref(
                  "enableAutoTagAnnotation"
                );
                if (enableAutoTag) {
                  const tagContent = getPref("annotationTagContent");
                  if (tagContent && tagContent.trim()) {
                    const tag = tagContent.trim();
                    const existingTags = item.getTags();
                    const tagExists = existingTags.some(
                      (existingTag) => existingTag.tag === tag
                    );
                    if (!tagExists) {
                      item.addTag(tag);
                    }
                  }
                }
                item.saveTx();
              }
            }
            break;
          case "title":
            {
              if (item) {
                ztoolkit.ExtraField.setExtraField(
                  item,
                  "titleTranslation",
                  task.result
                );
                item.saveTx();
              }
            }
            break;
          case "abstract":
            {
              if (item) {
                ztoolkit.ExtraField.setExtraField(
                  item,
                  "abstractTranslation",
                  // A dirty workaround to make it collapsible on Zotero 6
                  task.result
                );
                item.saveTx();
              }
            }
            break;
          default:
            break;
        }
      }
      return success;
    }
  };
  var services = new TranslationServices();

  // src/modules/preferenceWindow.ts
  function registerPrefsWindow() {
    Zotero.PreferencePanes.register({
      pluginID: config.addonID,
      src: rootURI + "chrome/content/preferences.xhtml",
      label: getString("pref-title"),
      image: `chrome://${config.addonRef}/content/icons/favicon.png`,
      helpURL: homepage
    });
  }
  function registerPrefsScripts(_window) {
    addon.data.prefs.window = _window;
    buildPrefsPane();
    updatePrefsPaneDefault();
  }
  function buildPrefsPane() {
    const doc = addon.data.prefs.window?.document;
    if (!doc) {
      return;
    }
    ztoolkit.UI.replaceElement(
      {
        tag: "menulist",
        id: makeId("sentenceServices"),
        attributes: {
          value: getPref("translateSource"),
          native: "true"
        },
        listeners: [
          {
            type: "command",
            listener: (e) => {
              onPrefsEvents("setSentenceService");
            }
          }
        ],
        children: [
          {
            tag: "menupopup",
            children: services.getAllServicesWithType("sentence").map((s) => ({
              tag: "menuitem",
              attributes: {
                label: services.getServiceNameByID(s.id),
                value: s.id
              }
            }))
          }
        ]
      },
      doc.querySelector(`#${makeId("sentenceServices-placeholder")}`)
    );
    ztoolkit.UI.replaceElement(
      {
        tag: "menulist",
        id: makeId("wordServices"),
        attributes: {
          value: getPref("dictSource"),
          native: "true"
        },
        classList: ["use-word-service"],
        listeners: [
          {
            type: "command",
            listener: (e) => {
              onPrefsEvents("setWordService");
            }
          }
        ],
        children: [
          {
            tag: "menupopup",
            children: services.getAllServicesWithType("word").map((s) => ({
              tag: "menuitem",
              attributes: {
                label: services.getServiceNameByID(s.id),
                value: s.id
              }
            }))
          }
        ]
      },
      doc.querySelector(`#${makeId("wordServices-placeholder")}`)
    );
    ztoolkit.UI.replaceElement(
      {
        tag: "menulist",
        id: makeId("langfrom"),
        attributes: {
          value: getPref("sourceLanguage"),
          native: "true"
        },
        listeners: [
          {
            type: "command",
            listener: (e) => {
              onPrefsEvents("setSourceLanguage");
            }
          }
        ],
        styles: {
          maxWidth: "250px"
        },
        children: [
          {
            tag: "menupopup",
            children: LANG_CODE.map((lang) => ({
              tag: "menuitem",
              attributes: {
                label: lang.name,
                value: lang.code
              }
            }))
          }
        ]
      },
      doc.querySelector(`#${makeId("langfrom-placeholder")}`)
    );
    ztoolkit.UI.replaceElement(
      {
        tag: "menulist",
        id: makeId("langto"),
        attributes: {
          value: getPref("targetLanguage"),
          native: "true"
        },
        listeners: [
          {
            type: "command",
            listener: (e) => {
              onPrefsEvents("setTargetLanguage");
            }
          }
        ],
        styles: {
          maxWidth: "250px"
        },
        children: [
          {
            tag: "menupopup",
            children: LANG_CODE.map((lang) => ({
              tag: "menuitem",
              attributes: {
                label: lang.name,
                value: lang.code
              }
            }))
          }
        ]
      },
      doc.querySelector(`#${makeId("langto-placeholder")}`)
    );
    doc.querySelector(`#${makeId("manageKeys")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("manageKeys");
    });
    doc.querySelector(`#${makeId("renameServices")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("renameServices");
    });
    doc.querySelector(`#${makeId("enableAuto")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setAutoTranslateSelection");
    });
    doc.querySelector(`#${makeId("enableComment")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setAutoTranslateAnnotation");
    });
    doc.querySelector(`#${makeId("annotationTranslationPosition")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setAnnotationTranslationPosition");
    });
    doc.querySelector(`#${makeId("enablePopup")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setEnablePopup");
    });
    doc.querySelector(`#${makeId("enableAddToNote")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setEnableAddToNote");
    });
    doc.querySelector(`#${makeId("showPlayBtn")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setShowPlayBtn");
    });
    doc.querySelector(`#${makeId("useWordService")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setUseWordService");
    });
    doc.querySelector(`#${makeId("hideUnconfiguredServices")}`)?.addEventListener("command", () => {
      addon.hooks.onReaderTabPanelRefresh();
    });
    doc.querySelector(`#${makeId("sentenceServicesSecret")}`)?.addEventListener("blur", (e) => {
      onPrefsEvents("updateSentenceSecret");
    });
    doc.querySelector(`#${makeId("wordServicesSecret")}`)?.addEventListener("blur", (e) => {
      onPrefsEvents("updateWordSecret");
    });
    doc.querySelector(`#${makeId("fontSize")}`)?.addEventListener("input", (e) => {
      onPrefsEvents("updateFontSize");
    });
    doc.querySelector(`#${makeId("lineHeight")}`)?.addEventListener("input", (e) => {
      onPrefsEvents("updatelineHeight");
    });
    doc.querySelector(`#${makeId("reset-titleTranslation")}`)?.addEventListener("command", (e) => {
      ztoolkit.getGlobal("ZoteroPane").getSelectedItems().forEach((item) => {
        ztoolkit.ExtraField.setExtraField(item, "titleTranslation", "");
      });
    });
    doc.querySelector(`#${makeId("reset-abstractTranslation")}`)?.addEventListener("command", (e) => {
      ztoolkit.getGlobal("ZoteroPane").getSelectedItems().forEach((item) => {
        ztoolkit.ExtraField.setExtraField(item, "abstractTranslation", "");
      });
    });
    doc.querySelector(`#${makeId("enableAutoTagAnnotation")}`)?.addEventListener("command", (e) => {
      onPrefsEvents("setEnableAutoTagAnnotation");
    });
  }
  function updatePrefsPaneDefault() {
    onPrefsEvents("setAutoTranslateAnnotation", false);
    onPrefsEvents("setAnnotationTranslationPosition", false);
    onPrefsEvents("setEnablePopup", false);
    onPrefsEvents("setShowPlayBtn", false);
    onPrefsEvents("setUseWordService", false);
    onPrefsEvents("setSentenceSecret", false);
    onPrefsEvents("setWordSecret", false);
    onPrefsEvents("setEnableAutoTagAnnotation", false);
  }
  function onPrefsEvents(type, fromElement = true) {
    const doc = addon.data.prefs.window?.document;
    if (!doc) {
      return;
    }
    const setDisabled = (className, disabled) => {
      doc.querySelectorAll(`.${className}`).forEach(
        (elem) => elem.disabled = disabled
      );
    };
    switch (type) {
      case "setAutoTranslateSelection":
        addon.hooks.onReaderTabPanelRefresh();
        break;
      case "setAutoTranslateAnnotation":
        {
          addon.hooks.onReaderTabPanelRefresh();
        }
        break;
      case "setAnnotationTranslationPosition":
        {
          const elemValue = fromElement ? doc.querySelector(
            `#${makeId("annotationTranslationPosition")}`
          ).getAttribute("value") : getPref("annotationTranslationPosition");
          const hidden = elemValue !== "body";
          setDisabled("annotation-translation-position-in-body", hidden);
        }
        break;
      case "setEnablePopup":
        {
          const elemValue = fromElement ? doc.querySelector(`#${makeId("enablePopup")}`).checked : getPref("enablePopup");
          const hidden = !elemValue;
          setDisabled("enable-popup", hidden);
          if (!hidden) {
            onPrefsEvents("setEnableAddToNote", fromElement);
          }
        }
        break;
      case "setEnableAddToNote":
        {
          const elemValue = fromElement ? doc.querySelector(`#${makeId("enableAddToNote")}`).checked : getPref("enableNote");
          const hidden = !elemValue;
          setDisabled("enable-popup-addtonote", hidden);
        }
        break;
      case "setShowPlayBtn":
        {
          const elemValue = fromElement ? doc.querySelector(`#${makeId("showPlayBtn")}`).checked : getPref("showPlayBtn");
          const hidden = !elemValue;
          setDisabled("show-play-btn", hidden);
        }
        break;
      case "setUseWordService":
        {
          const elemValue = fromElement ? doc.querySelector(`#${makeId("useWordService")}`).checked : getPref("enableDict");
          const hidden = !elemValue;
          setDisabled("use-word-service", hidden);
          if (!hidden) {
            onPrefsEvents("setShowPlayBtn", fromElement);
          }
        }
        break;
      case "setEnableAutoTagAnnotation":
        {
          const elemValue = fromElement ? doc.querySelector(
            `#${makeId("enableAutoTagAnnotation")}`
          ).checked : getPref("enableAutoTagAnnotation");
          const hidden = !elemValue;
          setDisabled("enable-auto-tag-annotation", hidden);
        }
        break;
      case "setSentenceService":
        {
          setPref(
            "translateSource",
            doc.querySelector(`#${makeId("sentenceServices")}`).getAttribute("value")
          );
          onPrefsEvents("setSentenceSecret", fromElement);
          addon.hooks.onReaderTabPanelRefresh();
        }
        break;
      case "updateSentenceSecret":
        {
          const serviceId = getPref("translateSource");
          const inputElem = doc.querySelector(
            `#${makeId("sentenceServicesSecret")}`
          );
          const trimmedValue = inputElem.value.trim();
          if (trimmedValue !== inputElem.value) {
            inputElem.value = trimmedValue;
          }
          if (trimmedValue !== getServiceSecret(serviceId)) {
            setServiceSecret(serviceId, trimmedValue);
          }
        }
        break;
      case "setSentenceSecret":
        {
          const serviceId = getPref("translateSource");
          const secretCheckResult = validateServiceSecret(
            serviceId,
            (validateResult) => {
              if (fromElement && !validateResult.status) {
                addon.data.prefs.window?.alert(
                  `You see this because the translation service ${serviceId} requires SECRET, which is NOT correctly set.

Details:
${validateResult.info}`
                );
              }
            }
          );
          doc.querySelector(
            `#${makeId("sentenceServicesSecret")}`
          ).value = secretCheckResult.secret;
          const statusButton = doc.querySelector(
            `#${makeId("sentenceServicesStatus")}`
          );
          const service = addon.data.translate.services.getServiceById(serviceId);
          if (service.config) {
            statusButton.hidden = false;
            statusButton.label = getString("service-dialog-config");
            statusButton.onclick = (ev) => {
              createServiceSettingsDialog(service);
            };
          } else {
            statusButton.hidden = true;
          }
        }
        break;
      case "setWordService":
        {
          setPref(
            "dictSource",
            doc.querySelector(`#${makeId("wordServices")}`).getAttribute("value")
          );
          onPrefsEvents("setWordSecret", fromElement);
        }
        break;
      case "updateWordSecret":
        {
          const serviceId = getPref("dictSource");
          const inputElem = doc.querySelector(
            `#${makeId("wordServicesSecret")}`
          );
          const trimmedValue = inputElem.value.trim();
          if (trimmedValue !== inputElem.value) {
            inputElem.value = trimmedValue;
          }
          if (trimmedValue !== getServiceSecret(serviceId)) {
            setServiceSecret(serviceId, trimmedValue);
          }
        }
        break;
      case "setWordSecret":
        {
          const serviceId = getPref("dictSource");
          const secretCheckResult = validateServiceSecret(
            serviceId,
            (validateResult) => {
              if (fromElement && !validateResult.status) {
                addon.data.prefs.window?.alert(
                  `You see this because the translation service ${serviceId} requires SECRET, which is NOT correctly set.

Details:
${validateResult.info}`
                );
              }
            }
          );
          doc.querySelector(
            `#${makeId("wordServicesSecret")}`
          ).value = secretCheckResult.secret;
        }
        break;
      case "setSourceLanguage":
        {
          setPref(
            "sourceLanguage",
            doc.querySelector(`#${makeId("langfrom")}`).getAttribute("value")
          );
          addon.hooks.onReaderTabPanelRefresh();
        }
        break;
      case "setTargetLanguage":
        {
          setPref(
            "targetLanguage",
            doc.querySelector(`#${makeId("langto")}`).getAttribute("value")
          );
          addon.hooks.onReaderTabPanelRefresh();
        }
        break;
      case "updateFontSize":
        addon.api.getTemporaryRefreshHandler()();
        break;
      case "updatelineHeight":
        addon.api.getTemporaryRefreshHandler()();
        break;
      case "manageKeys":
        {
          Promise.resolve().then(() => (init_manageKeys(), manageKeys_exports)).then(
            ({ manageKeysDialog: manageKeysDialog2 }) => {
              manageKeysDialog2();
            }
          );
        }
        break;
      case "renameServices":
        {
          Promise.resolve().then(() => (init_renameServices(), renameServices_exports)).then(
            ({ renameServicesDialog: renameServicesDialog2 }) => {
              renameServicesDialog2();
            }
          );
        }
        break;
      default:
        return;
    }
  }
  function makeId(type) {
    return `${config.addonRef}-${type}`;
  }

  // src/modules/tabpanel.ts
  init_locale();
  init_package();
  init_prefs();
  var paneKey = "";
  function registerReaderTabPanel() {
    const key = Zotero.ItemPaneManager.registerSection({
      paneID: "translate",
      pluginID: config.addonID,
      header: {
        l10nID: getLocaleID("itemPaneSection-header"),
        icon: `chrome://${config.addonRef}/content/icons/section-16.svg`
      },
      sidenav: {
        l10nID: getLocaleID("itemPaneSection-sidenav"),
        icon: `chrome://${config.addonRef}/content/icons/section-20.svg`,
        // @ts-ignore
        orderable: false
      },
      bodyXHTML: "<translator-plugin-panel />",
      onInit,
      onDestroy,
      onRender: ({ body, item }) => {
        const panel = body.querySelector(
          "translator-plugin-panel"
        );
        panel.item = item;
        panel.render();
        onUpdateHeight({ body });
      },
      onItemChange,
      sectionButtons: [
        {
          type: "openStandalone",
          icon: "chrome://zotero/skin/16/universal/open-link.svg",
          l10nID: getLocaleID("itemPaneSection-openStandalone"),
          onClick: ({ event }) => {
            openWindowPanel();
          }
        },
        {
          type: "fullHeight",
          icon: `chrome://${config.addonRef}/content/icons/full-16.svg`,
          l10nID: getLocaleID("itemPaneSection-fullHeight"),
          onClick: ({ body }) => {
            const details = body.closest("item-details");
            onUpdateHeight({ body });
            details.scrollToPane(paneKey);
          }
        }
      ]
    });
    if (key) paneKey = key;
  }
  async function openWindowPanel() {
    if (addon.data.panel.windowPanel && !addon.data.panel.windowPanel.closed) {
      addon.data.panel.windowPanel.close();
    }
    const dialogData = {
      loadLock: Zotero.Promise.defer()
    };
    const win = ztoolkit.getGlobal("openDialog")(
      `chrome://${config.addonRef}/content/standalone.xhtml`,
      `${config.addonRef}-standalone`,
      `chrome,extrachrome,menubar,resizable=yes,scrollbars,status,dialog=no,${getPref("keepWindowTop") ? ",alwaysRaised=yes" : ""}`,
      dialogData
    );
    await dialogData.loadLock.promise;
    buildExtraPanel(win.document);
    updateExtraPanel(win.document);
    addon.data.panel.windowPanel = win;
  }
  function updateReaderTabPanels() {
    Object.values(addon.data.panel.activePanels).forEach(
      (refresh) => refresh()
    );
    const win = addon.data.panel.windowPanel;
    if (win && isWindowAlive(win)) {
      updateExtraPanel(win.document);
    }
  }
  function onInit({ body, refresh }) {
    const paneUID = Zotero.Utilities.randomString(8);
    body.dataset.paneUid = paneUID;
    addon.data.panel.activePanels[paneUID] = refresh;
  }
  function buildExtraPanel(doc) {
    doc.querySelector("#add-source")?.addEventListener("click", () => {
      const extraServices = getPref("extraEngines");
      const allServices = services.getAllServices();
      setPref(
        "extraEngines",
        extraServices ? `${extraServices},${allServices[0].id}` : allServices[0].id
      );
      openWindowPanel();
    });
    const pinButton = doc.querySelector("#pin-window");
    pinButton?.addEventListener("click", () => {
      setPref("keepWindowTop", !getPref("keepWindowTop"));
      openWindowPanel();
    });
    pinButton.dataset.l10nArgs = JSON.stringify({
      mode: getPref("keepWindowTop") ? "pinned" : "unpinned"
    });
    const extraEngines = getPref("extraEngines").split(",").filter((thisServiceId) => services.getServiceById(thisServiceId));
    if (!extraEngines.length) {
      return;
    }
    ztoolkit.UI.appendElement(
      {
        tag: "vbox",
        styles: {
          flexShrink: "1",
          flexGrow: "1"
        },
        children: extraEngines.map((serviceId, idx) => {
          return {
            tag: "vbox",
            styles: {
              flexShrink: "1",
              flexGrow: "1"
            },
            children: [
              {
                tag: "hbox",
                id: `${serviceId}-${idx}`,
                attributes: {
                  align: "center"
                },
                classList: [serviceId],
                children: [
                  {
                    tag: "menulist",
                    attributes: {
                      value: serviceId,
                      native: "true"
                    },
                    listeners: [
                      {
                        type: "command",
                        listener: (ev) => {
                          const menulist = ev.currentTarget;
                          const newService = menulist.value;
                          const [serviceId2, idx2] = menulist.parentElement?.id.split("-") || [];
                          const extraServices = getPref("extraEngines").split(",");
                          if (extraServices[Number(idx2)] === serviceId2) {
                            extraServices[Number(idx2)] = newService;
                            menulist.parentElement.id = `${newService}-${idx2}`;
                            menulist.parentElement.className = newService;
                            setPref("extraEngines", extraServices.join(","));
                          } else {
                            openWindowPanel();
                          }
                        }
                      }
                    ],
                    children: [
                      {
                        tag: "menupopup",
                        children: services.getAllServicesWithType("sentence").map((s) => ({
                          tag: "menuitem",
                          attributes: {
                            label: services.getServiceNameByID(s.id),
                            value: s.id
                          }
                        }))
                      }
                    ]
                  },
                  {
                    tag: "button",
                    namespace: "xul",
                    attributes: {
                      "data-l10n-id": getLocaleID("remove-source")
                    },
                    listeners: [
                      {
                        type: "click",
                        listener: (ev) => {
                          const [serviceId2, idx2] = ev.target.parentElement?.id.split(
                            "-"
                          ) || [];
                          const extraServices = getPref("extraEngines").split(",");
                          if (extraServices[Number(idx2)] === serviceId2) {
                            extraServices.splice(Number(idx2), 1);
                            setPref("extraEngines", extraServices.join(","));
                          }
                          openWindowPanel();
                        }
                      }
                    ]
                  }
                ]
              },
              {
                tag: "editable-text",
                namespace: "xul",
                attributes: {
                  multiline: "true"
                },
                styles: {
                  fontSize: `${getPref("fontSize")}px`,
                  lineHeight: getPref("lineHeight")
                }
              }
            ]
          };
        })
      },
      doc.querySelector("#extra-container")
    );
  }
  function onItemChange({
    tabType,
    item,
    body,
    setEnabled
  }) {
    if (tabType !== "reader") {
      setEnabled(false);
    }
    body.dataset.itemID = String(item?.id);
    return true;
  }
  function updateExtraPanel(container) {
    const lastTask = getLastTranslateTask();
    const panel = container.querySelector(
      "translator-plugin-panel"
    );
    if (panel) {
      panel.item = Zotero.Items.get(lastTask?.itemId || -1);
      panel.render();
    }
    const extraTasks = lastTask?.extraTasks;
    if (extraTasks?.length === 0) {
      return;
    }
    extraTasks?.forEach((task) => {
      Array.from(
        container.querySelectorAll(`.${task.service}+editable-text`)
      ).forEach((elem) => elem.value = task.result);
    });
  }
  function onDestroy(options) {
    const { body } = options;
    const paneUID = body.dataset.paneUid;
    delete addon.data.panel.activePanels[paneUID];
  }
  function onUpdateHeight({ body }) {
    const details = body.closest("item-details");
    const head = body.closest("item-pane-custom-section")?.querySelector(".head");
    const heightKey = "--details-height";
    body?.style.setProperty(
      heightKey,
      `${details.querySelector(".zotero-view-item").clientHeight - head.clientHeight - 8}px`
    );
  }

  // src/modules/popup.ts
  init_package();
  init_locale();
  init_prefs();
  function updateReaderPopup() {
    const popup = addon.data.popup.currentPopup;
    if (!popup) {
      return;
    }
    const enablePopup = getPref("enablePopup");
    const hidePopupTextarea = getPref("enableHidePopupTextarea");
    Array.from(popup.querySelectorAll(`.${config.addonRef}-readerpopup`)).forEach(
      (elem) => elem.hidden = !enablePopup
    );
    const idPrefix = popup?.getAttribute(`${config.addonRef}-prefix`);
    const makeId2 = (type) => `${idPrefix}-${type}`;
    const audiobox = popup?.querySelector(
      `#${makeId2("audiobox")}`
    );
    const translateButton = popup?.querySelector(
      `#${makeId2("translate")}`
    );
    const textarea = popup?.querySelector(
      `#${makeId2("text")}`
    );
    const addToNoteButton = popup?.querySelector(
      `#${makeId2("addtonote")}`
    );
    const updateHidden = (elem, hidden) => {
      if (hidden) {
        elem.style.display = "none";
      } else {
        elem.style.removeProperty("display");
      }
    };
    if (!enablePopup) {
      updateHidden(audiobox, true);
      updateHidden(translateButton, true);
      updateHidden(textarea, true);
      updateHidden(addToNoteButton, true);
      return;
    }
    const task = getLastTranslateTask({ type: "text" });
    if (!task) {
      return;
    }
    popup.setAttribute("translate-task-id", task.id);
    if (task.audio.length > 0 && getPref("showPlayBtn")) {
      audiobox.innerHTML = "";
      updateHidden(audiobox, false);
      ztoolkit.UI.appendElement(
        {
          tag: "fragment",
          children: task.audio.map((audioData) => ({
            tag: "button",
            namespace: "html",
            classList: ["toolbar-button", "wide-button"],
            attributes: {
              tabindex: "-1",
              title: audioData.text
            },
            properties: {
              innerHTML: `\u{1F50A} ${audioData.text}`,
              onclick: () => {
                new (ztoolkit.getGlobal("Audio"))(audioData.url).play();
              }
            },
            styles: { whiteSpace: "nowrap", flexGrow: "1" }
          }))
        },
        audiobox
      );
    }
    if (task.audio.length > 0 && getPref("showPlayBtn") && getPref("autoPlay")) {
      const firstAudio = task.audio[0];
      const audio = new (ztoolkit.getGlobal("Audio"))(firstAudio.url);
      audio.play();
    }
    const hideTranslateButton = task.status !== "waiting";
    updateHidden(translateButton, hideTranslateButton);
    switch (task.langto?.split("-")[0]) {
      case "ar":
      case "fa":
      case "he":
        textarea.style.direction = "rtl";
        break;
      default:
        textarea.style.direction = "ltr";
    }
    textarea.hidden = hidePopupTextarea || !hideTranslateButton;
    textarea.value = task.result || task.raw;
    textarea.style.fontSize = `${getPref("fontSize")}px`;
    textarea.style.lineHeight = `${Number(getPref("lineHeight")) * Number(getPref("fontSize"))}px`;
    const enableAddToNote = getPref("enableNote");
    if (!Zotero.getMainWindow().ZoteroContextPane.activeEditor || !enableAddToNote) {
      updateHidden(addToNoteButton, true);
    }
    updatePopupSize(popup, textarea);
  }
  function buildReaderPopup(event) {
    const { reader, doc, append } = event;
    const annotation = event.params.annotation;
    const popup = doc.querySelector(".selection-popup");
    addon.data.popup.currentPopup = popup;
    popup.style.maxWidth = "none";
    popup.setAttribute(
      `${config.addonRef}-prefix`,
      `${config.addonRef}-${reader._instanceID}`
    );
    const ZoteroContextPane = Zotero.getMainWindow().ZoteroContextPane;
    const colors = popup.querySelector(".colors");
    colors.style.width = "100%";
    colors.style.justifyContent = "space-evenly";
    const keepSize = getPref("keepPopupSize");
    const makeId2 = (type) => `${config.addonRef}-${reader._instanceID}-${type}`;
    const onTextAreaCopy = getOnTextAreaCopy(popup, makeId2("text"));
    const hidePopupTextarea = getPref("enableHidePopupTextarea");
    append(
      ztoolkit.UI.createElement(doc, "fragment", {
        children: [
          {
            tag: "div",
            id: makeId2("audiobox"),
            classList: [`${config.addonRef}-readerpopup`],
            styles: {
              display: "flex",
              width: "calc(100% - 4px)",
              marginLeft: "2px",
              justifyContent: "space-evenly"
            },
            ignoreIfExists: true
          },
          {
            tag: "button",
            namespace: "html",
            id: makeId2("translate"),
            classList: [
              "toolbar-button",
              "wide-button",
              `${config.addonRef}-readerpopup`
            ],
            properties: {
              innerHTML: `${SVGIcon}${getString("readerpopup-translate-label")}`,
              hidden: getPref("enableAuto")
            },
            listeners: [
              {
                type: "click",
                listener: (ev) => {
                  addon.hooks.onTranslate({
                    noCheckZoteroItemLanguage: true,
                    noCache: true
                  });
                  const button = ev.target;
                  button.hidden = true;
                  button.ownerDocument.querySelector(
                    `#${makeId2("text")}`
                  ).hidden = hidePopupTextarea;
                }
              }
            ],
            ignoreIfExists: true
          },
          {
            tag: "textarea",
            id: makeId2("text"),
            attributes: {
              rows: "3",
              columns: "10"
            },
            classList: [
              `${config.addonRef}-popup-textarea`,
              `${config.addonRef}-readerpopup`
            ],
            styles: {
              fontSize: `${getPref("fontSize")}px`,
              fontFamily: "inherit",
              lineHeight: `${Number(getPref("lineHeight")) * Number(getPref("fontSize"))}px`,
              width: keepSize ? `${getPref("popupWidth")}px` : "-moz-available",
              // Minimum width to prevent the textarea from being smaller than the popup
              minWidth: "184px",
              height: `${Math.max(
                keepSize ? Number(getPref("popupHeight")) : 30
              )}px`,
              marginInline: "2px",
              border: "none",
              background: "var(--color-sidepane)",
              borderRadius: "6px",
              padding: "5px"
            },
            properties: {
              onpointerup: (e) => e.stopPropagation(),
              ondragstart: (e) => e.stopPropagation(),
              spellcheck: false,
              value: addon.data.translate.selectedText
            },
            ignoreIfExists: true,
            listeners: [
              {
                type: "mousedown",
                listener: (_ev) => {
                  _ev.target?.addEventListener(
                    "mousemove",
                    onTextAreaResize
                  );
                }
              },
              {
                type: "mouseup",
                listener: (_ev) => {
                  _ev.target?.removeEventListener(
                    "mousemove",
                    onTextAreaResize
                  );
                }
              },
              {
                type: "keydown",
                listener: onTextAreaCopy
              },
              {
                type: "dblclick",
                listener: (_ev) => {
                  const textarea = popup.querySelector(
                    `#${makeId2("text")}`
                  );
                  textarea.selectionStart = 0;
                  textarea.selectionEnd = textarea.value.length;
                  const text = textarea.value.slice(
                    textarea.selectionStart,
                    textarea.selectionEnd
                  );
                  new ztoolkit.Clipboard().addText(text, "text/plain").copy();
                  new ztoolkit.ProgressWindow("Copied to Clipboard").createLine({
                    text: slice(text, 50),
                    progress: 100,
                    type: "default"
                  }).show();
                }
              }
            ]
          },
          {
            tag: "button",
            namespace: "html",
            id: makeId2("addtonote"),
            classList: [
              "toolbar-button",
              "wide-button",
              `${config.addonRef}-readerpopup`
            ],
            styles: {
              marginTop: "8px"
            },
            properties: {
              innerHTML: `${SVGIcon}${getString("readerpopup-addToNote-label")}`
            },
            ignoreIfExists: true,
            listeners: [
              {
                type: "click",
                listener: async (ev) => {
                  const noteEditor = ZoteroContextPane && ZoteroContextPane.activeEditor;
                  if (!noteEditor) {
                    return;
                  }
                  const editorInstance = noteEditor.getCurrentInstance();
                  if (!editorInstance) {
                    return;
                  }
                  const task = addTranslateTask(
                    addon.data.translate.selectedText,
                    reader.itemID,
                    "addtonote"
                  );
                  if (!task) {
                    return;
                  }
                  await addon.hooks.onTranslate(task, {
                    noCheckZoteroItemLanguage: true,
                    noDisplay: true
                  });
                  if (task.status !== "success") {
                    return;
                  }
                  const replaceMode = getPref("enableNoteReplaceMode");
                  if (replaceMode) {
                    annotation.text = task.result;
                  } else {
                    annotation.comment = task.result;
                  }
                  reader._addToNote([annotation]);
                }
              }
            ]
          }
        ]
      })
    );
  }
  function onTextAreaResize(ev) {
    if (getPref("keepPopupSize")) {
      const textarea = ev.target;
      setPref("popupWidth", textarea.offsetWidth);
      setPref("popupHeight", textarea.offsetHeight);
    }
  }
  function getOnTextAreaCopy(selectionMenu, targetId) {
    return (ev) => {
      const textarea = selectionMenu.querySelector(
        `#${targetId}`
      );
      const isMod = ev.ctrlKey || ev.metaKey;
      if (ev.key === "c" && isMod) {
        ztoolkit.getGlobal("setTimeout")(() => {
          new ztoolkit.Clipboard().addText(
            textarea.value.slice(
              textarea.selectionStart,
              textarea.selectionEnd
            ),
            "text/plain"
          ).copy();
        }, 10);
        ev.stopPropagation();
      } else if (ev.key === "a" && isMod) {
        textarea.selectionStart = 0;
        textarea.selectionEnd = textarea.value.length;
        ev.stopPropagation();
      } else if (ev.key === "x" && isMod) {
        new ztoolkit.Clipboard().addText(
          textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
          "text/plain"
        ).copy();
        textarea.value = `${textarea.value.slice(
          0,
          textarea.selectionStart
        )}${textarea.value.slice(textarea.selectionEnd)}`;
        ev.stopPropagation();
      }
    };
  }
  function updatePopupSize(selectionMenu, textarea, resetSize = true) {
    const keepSize = getPref("keepPopupSize");
    if (keepSize) {
      return;
    }
    if (resetSize) {
      textarea.style.width = "-moz-available";
      textarea.style.height = "30px";
    }
    const viewer = selectionMenu.ownerDocument.body;
    const textHeight = textarea.scrollHeight;
    const textWidth = textarea.scrollWidth;
    const newWidth = textWidth + 20;
    if (textHeight / textWidth > 0.75 && selectionMenu.offsetLeft + newWidth < viewer.offsetWidth) {
      textarea.style.width = `${newWidth}px`;
      updatePopupSize(selectionMenu, textarea, false);
      return;
    }
    textarea.style.height = `${textHeight + 3}px`;
  }

  // src/modules/notify.ts
  function registerNotify(types) {
    const callback = {
      notify: async (...data2) => {
        if (!addon?.data.alive) {
          unregisterNotify(notifyID);
          return;
        }
        addon.hooks.onNotify(...data2);
      }
    };
    const notifyID = Zotero.Notifier.registerObserver(callback, types);
  }
  function unregisterNotify(notifyID) {
    Zotero.Notifier.unregisterObserver(notifyID);
  }

  // src/modules/reader.ts
  init_package();
  init_locale();
  function registerReaderInitializer() {
    Zotero.Reader.registerEventListener(
      "renderTextSelectionPopup",
      (event) => {
        const { reader, doc, params, append } = event;
        addon.data.translate.selectedText = params.annotation.text.trim();
        addon.hooks.onReaderPopupShow(event);
      },
      config.addonID
    );
    Zotero.Reader.registerEventListener(
      "renderSidebarAnnotationHeader",
      (event) => {
        const { reader, doc, params, append } = event;
        const annotationData = params.annotation;
        if (reader._item.numAnnotations() < 1e3) {
          append(createTranslateAnnotationButton(doc, reader, annotationData));
          return;
        }
        const placeholder = doc.createElement("img");
        placeholder.src = "chrome://zotero/error.png";
        placeholder.dataset.annotationId = annotationData.id;
        placeholder.dataset.libraryId = reader._item.libraryID.toString();
        placeholder.addEventListener("error", (event2) => {
          const placeholder2 = event2.currentTarget;
          placeholder2.ownerGlobal?.requestIdleCallback(() => {
            const annotationID = placeholder2.dataset.annotationId;
            const libraryID = parseInt(placeholder2.dataset.libraryId || "");
            const button = doc.createElement("div");
            button.classList.add("icon");
            button.innerHTML = SVGIcon;
            button.title = getString("sideBarIcon-title");
            button.addEventListener("click", (e) => {
              const task = addTranslateAnnotationTask(libraryID, annotationID);
              addon.hooks.onTranslate(task, {
                noCheckZoteroItemLanguage: true,
                noDisplay: true
              });
              e.preventDefault();
            });
            button.addEventListener("mouseover", (e) => {
              e.target.style.backgroundColor = "var(--color-sidepane)";
            });
            button.addEventListener("mouseout", (e) => {
              e.target.style.removeProperty("background-color");
            });
            placeholder2.replaceWith(button);
          });
        });
        append(placeholder);
      },
      config.addonID
    );
  }
  function createTranslateAnnotationButton(doc, reader, annotationData) {
    return ztoolkit.UI.createElement(doc, "div", {
      classList: ["icon"],
      properties: {
        innerHTML: SVGIcon,
        title: getString("sideBarIcon-title")
      },
      listeners: [
        {
          type: "click",
          listener: (e) => {
            const task = addTranslateAnnotationTask(
              reader._item.libraryID,
              annotationData.id
            );
            addon.hooks.onTranslate(task, {
              noCheckZoteroItemLanguage: true,
              noDisplay: true
            });
            e.preventDefault();
          }
        },
        {
          type: "mouseover",
          listener: (e) => {
            e.target.style.backgroundColor = "var(--color-sidepane)";
          }
        },
        {
          type: "mouseout",
          listener: (e) => {
            e.target.style.removeProperty("background-color");
          }
        }
      ],
      enableElementRecord: false,
      ignoreIfExists: true
    });
  }

  // src/hooks.ts
  init_prefs();

  // src/modules/defaultPrefs.ts
  init_prefs();
  function setDefaultPrefSettings() {
    const isZhCN = Zotero.locale === "zh-CN";
    const servicesIds = services.getAllServices().map((service) => service.id);
    if (!servicesIds.includes(getPref("translateSource") || "")) {
      setPref("translateSource", isZhCN ? "cnki" : "googleapi");
    }
    if (!servicesIds.includes(getPref("dictSource") || "")) {
      setPref("dictSource", isZhCN ? "bingdict" : "freedictionaryapi");
    }
    if (!getPref("targetLanguage")) {
      setPref("targetLanguage", Zotero.locale);
    }
    const secrets = getPrefJSON("secretObj");
    for (const serviceId of servicesIds) {
      if (typeof secrets[serviceId] === "undefined") {
        secrets[serviceId] = services.getServiceById(serviceId).defaultSecret || "";
      }
    }
    setPref("secretObj", JSON.stringify(secrets));
    const deeplxApiSecret = getServiceSecret("deeplcustom");
    if (deeplxApiSecret && !getPref("deeplcustom.endpoint")) {
      setPref("deeplcustom.endpoint", deeplxApiSecret);
    }
    if (isZhCN && !getPref("disabledLanguages")) {
      setPref("disabledLanguages", "zh,zh-CN,\u4E2D\u6587;");
    }
    const extraServices = getPref("extraEngines");
    if (extraServices.startsWith(",")) {
      setPref("extraEngines", extraServices.slice(1));
    }
    const niutransApiKey = getPref("niutransApikey");
    if (niutransApiKey) {
      setServiceSecret("niutranspro", niutransApiKey);
      clearPref("niutransApikey");
    }
    if (getPref("translateSource") === "niutransLog") {
      setPref("translateSource", "niutranspro");
    }
    try {
      const oldDict = JSON.parse(
        getPref("niutransDictLibList") || "{}"
      );
      if (oldDict?.dlist) {
        setPref("niutransDictLibList", JSON.stringify(oldDict.dlist));
      } else {
        setPref("niutransDictLibList", "[]");
      }
      const oldMemory = JSON.parse(
        getPref("niutransMemoryLibList") || "{}"
      );
      if (oldMemory?.mlist) {
        setPref("niutransMemoryLibList", JSON.stringify(oldMemory?.mlist));
      } else {
        setPref("niutransMemoryLibList", "[]");
      }
    } catch (e) {
      setPref("niutransDictLibList", "[]");
      setPref("niutransMemoryLibList", "[]");
    }
    const useNiutrans = getPref("xftrans.useNiutrans");
    if (useNiutrans) {
      setPref("xftrans.engine", "niutrans");
    }
    clearPref("xftrans.useNiutrans");
    const gptKeys = ["customGPT1", "customGPT2", "customGPT3"];
    gptKeys.forEach((key) => {
      const prefKey = `${key}.temperature`;
      const value = getPref(prefKey);
      if (value !== void 0 && typeof value === "number") {
        clearPref(prefKey);
        setPref(prefKey, String(value));
      }
    });
    if (!getPref("annotationTagContent")) {
      setPref("annotationTagContent", isZhCN ? "\u7FFB\u8BD1" : "Translation");
    }
  }

  // src/modules/menu.ts
  init_package();
  init_prefs();
  function registerMenu() {
    const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.png`;
    Zotero.MenuManager.registerMenu({
      menuID: `${config.addonRef}-translate-title`,
      pluginID: config.addonID,
      target: "main/library/item",
      menus: [
        {
          menuType: "menuitem",
          l10nID: `${config.addonRef}-itemmenu-translateTitle`,
          icon: menuIcon,
          onCommand: (event, context) => {
            if (!context.items?.length) {
              return;
            }
            addon.hooks.onTranslateInBatch(
              context.items.map((item) => addTranslateTitleTask(item.id, true)).filter((task) => task),
              { noDisplay: true, noCache: true }
            );
          },
          onShowing: (event, context) => {
            context.setVisible(
              !!(getPref("showItemMenuTitleTranslation") && context.items?.every((item) => item.isRegularItem()))
            );
          }
        },
        {
          menuType: "menuitem",
          l10nID: `${config.addonRef}-itemmenu-translateAbstract`,
          icon: menuIcon,
          onCommand: (event, context) => {
            if (!context.items?.length) {
              return;
            }
            addon.hooks.onTranslateInBatch(
              context.items.map((item) => addTranslateAbstractTask(item.id, true)).filter((task) => task),
              { noDisplay: true, noCache: true }
            );
          },
          onShowing: (event, context) => {
            context.setVisible(
              !!(getPref("showItemMenuAbstractTranslation") && context.items?.every((item) => item.isRegularItem()))
            );
          }
        }
      ]
    });
  }

  // src/modules/itemTree.ts
  init_package();
  init_locale();
  function registerExtraColumns() {
    const registerColumn = Zotero.ItemTreeManager.registerColumn || Zotero.ItemTreeManager.registerColumns;
    registerColumn.apply(Zotero.ItemTreeManager, [
      {
        dataKey: "titleTranslation",
        label: getString("field-titleTranslation"),
        dataProvider: (item, dataKey) => ztoolkit.ExtraField.getExtraField(item, "titleTranslation") || "",
        pluginID: config.addonID,
        zoteroPersist: ["width", "hidden", "sortDirection"]
      }
    ]);
  }

  // src/modules/shortcuts.ts
  var concatKey = Zotero.isMac ? "Meta" : "Control";
  function registerShortcuts() {
    ztoolkit.Keyboard.register((ev, data2) => {
      if (data2.type === "keydown") {
        if (ev.key === concatKey) {
          addon.data.translate.concatKey = true;
        }
      }
      if (data2.type === "keyup") {
        addon.data.translate.concatKey = false;
        if (data2.keyboard?.equals("accel,T")) {
          const isReaderWindow = ev.target?.ownerGlobal?.location?.href === "chrome://zotero/content/reader.xhtml";
          if (!isReaderWindow) {
            addon.hooks.onShortcuts(
              Zotero.getMainWindow().Zotero_Tabs.selectedType
            );
          } else {
            addon.hooks.onShortcuts("reader");
          }
        }
      }
    });
  }

  // src/modules/infoBox.ts
  init_prefs();
  function registerItemPaneInfoRows() {
    if (!Zotero.ItemPaneManager.registerInfoRow) {
      return;
    }
    if (getPref("showItemBoxTitleTranslation") !== false) {
      Zotero.ItemPaneManager.registerInfoRow({
        rowID: "titleTranslation",
        pluginID: addon.data.config.addonID,
        label: {
          l10nID: `${addon.data.config.addonRef}-field-titleTranslation`
        },
        onGetData: (options) => {
          return ztoolkit.ExtraField.getExtraField(options.item, "titleTranslation") || "";
        },
        onSetData: (options) => {
          ztoolkit.ExtraField.setExtraField(
            options.item,
            "titleTranslation",
            options.value
          );
        },
        position: "start",
        editable: true
      });
    }
    if (getPref("showItemBoxAbstractTranslation") !== false) {
      Zotero.ItemPaneManager.registerInfoRow({
        rowID: "abstractTranslation",
        pluginID: addon.data.config.addonID,
        label: {
          l10nID: `${addon.data.config.addonRef}-field-abstractTranslation`
        },
        onGetData: (options) => {
          return ztoolkit.ExtraField.getExtraField(
            options.item,
            "abstractTranslation"
          ) || "";
        },
        onSetData: (options) => {
          ztoolkit.ExtraField.setExtraField(
            options.item,
            "abstractTranslation",
            options.value
          );
        },
        position: "afterCreators",
        editable: true,
        multiline: true
      });
    }
  }

  // src/modules/prompt.ts
  init_package();
  function registerPrompt() {
    ztoolkit.Prompt.register([
      {
        name: "Translate Sentences",
        label: config.addonInstance,
        when: () => {
          const selection = addon.data.translate.selectedText;
          const sl = Zotero.Prefs.get(
            "ZoteroPDFTranslate.sourceLanguage"
          );
          const tl = Zotero.Prefs.get(
            "ZoteroPDFTranslate.targetLanguage"
          );
          return selection.length > 0 && Zotero?.PDFTranslate && sl.startsWith("en") && tl.startsWith("zh");
        },
        callback: async (prompt) => {
          const selection = addon.data.translate.selectedText;
          const queue = Zotero.PDFTranslate.data.translate.queue;
          let task = queue.find(
            (task2) => task2.raw == selection && task2.result.length > 0
          );
          task = void 0;
          if (!task) {
            prompt.showTip("Loading...");
            task = await Zotero.PDFTranslate.api.translate(selection);
            Zotero.PDFTranslate.data.translate.queue.push(task);
            prompt.exit();
          }
          prompt.inputNode.placeholder = task.service;
          const rawText = task.raw, resultText = task.result;
          const addSentences = (node, text, dividers) => {
            let i = 0;
            const sentences = [];
            let sentence = "";
            const abbrs = [
              "a.m.",
              "p.m.",
              "vol.",
              "inc.",
              "jr.",
              "dr.",
              "tex.",
              "co.",
              "prof.",
              "rev.",
              "revd.",
              "hon.",
              "v.s.",
              "i.e.",
              "ie.",
              "eg.",
              "e.g.",
              "al.",
              "st.",
              "ph.d.",
              "capt.",
              "mr.",
              "mrs.",
              "ms.",
              "fig."
            ];
            const getWord2 = (i2) => {
              const before = text.slice(0, i2).match(/[.a-zA-Z]+$/);
              const after = text.slice(i2 + 1).match(/^[.a-zA-Z]+/);
              const word = [before, ["."], after].filter((i3) => i3).map((i3) => i3[0]).join("");
              return word;
            };
            const isAbbr = (i2) => {
              const word = getWord2(i2).toLowerCase().replace(/\s+/g, " ");
              return abbrs.find((abbr) => {
                abbr = abbr.toLowerCase();
                return word == abbr;
              });
            };
            const isPotentialAbbr = (i2) => {
              const word = getWord2(i2);
              const parts = word.split(".").filter((i3) => i3);
              return parts.length > 2 && parts.every((part) => part.length <= 2);
            };
            while (i < text.length) {
              const char = text[i];
              sentence += char;
              if (dividers.indexOf(char) != -1) {
                if (char == ".") {
                  if (i + 1 < text.length && text[i + 1] != " " || isAbbr(i) || isPotentialAbbr(i)) {
                    i += 1;
                    continue;
                  }
                }
                const blank = " ";
                i += 1;
                while (text[i] == blank) {
                  sentence += blank;
                  i += 1;
                }
                sentences.push(sentence);
                sentence = "";
                continue;
              }
              i += 1;
            }
            for (let i2 = 0; i2 < sentences.length; i2++) {
              const span = ztoolkit.UI.appendElement(
                {
                  tag: "span",
                  id: `sentence-${i2}`,
                  properties: {
                    innerText: sentences[i2]
                  },
                  styles: {
                    borderRadius: "3px"
                  },
                  listeners: [
                    {
                      type: "mousemove",
                      listener: () => {
                        const highlightColor = "var(--tag-yellow)";
                        const twinNode = [
                          ...Array.from(
                            container.querySelectorAll(".text-container")
                          )
                        ].find((e) => e != node);
                        node.querySelectorAll("span").forEach((e) => e.style.backgroundColor = "");
                        span.style.backgroundColor = highlightColor;
                        twinNode?.querySelectorAll("span").forEach((e) => e.style.backgroundColor = "");
                        const twinSpan = twinNode.querySelector(
                          `span[id=sentence-${i2}]`
                        );
                        twinSpan.style.backgroundColor = highlightColor;
                        const twinNodeContainer = twinNode.parentNode;
                        const nodeContainer = node.parentNode;
                        if (direction == "column" && twinNode.classList.contains("result")) {
                          twinNodeContainer.scrollTo(
                            0,
                            twinSpan.offsetTop - twinNodeContainer.offsetHeight * 0.5 - nodeContainer.offsetHeight
                          );
                        } else {
                          twinNodeContainer.scrollTo(
                            0,
                            twinSpan.offsetTop - twinNodeContainer.offsetHeight * 0.5
                          );
                        }
                      }
                    }
                  ]
                },
                node
              );
            }
          };
          const container = prompt.createCommandsContainer();
          const directions = ["row", "column"];
          const direction = directions[1];
          container.setAttribute(
            "style",
            `
        display: flex;
        flex-direction: ${direction};
        padding: .5em 1em;
        margin-left: 0px;
        width: 100%;
        height: 25em;
      `
          );
          const subContainers = [];
          const doc = Zotero.getMainWindow().document;
          [
            ["raw", rawText, [".", "?", "!"]],
            ["result", resultText, ["?", "!", "\uFF01", "\u3002", "\uFF1F"]]
          ].forEach((args) => {
            const [className, text, dividers] = args;
            const subContainer = ztoolkit.UI.createElement(doc, "div", {
              styles: {
                padding: ".5em",
                border: "1px solid var(--color-border)",
                overflowY: "auto",
                minWidth: "10em",
                minHeight: "5em",
                height: "100%",
                width: "100%",
                textAlign: "justify"
              },
              children: [
                {
                  tag: "div",
                  classList: [className, "text-container"],
                  styles: {
                    fontSize: "1em",
                    lineHeight: "1.5em",
                    marginBottom: ".5em"
                  }
                }
              ]
            });
            addSentences(
              subContainer.querySelector(".text-container"),
              text,
              dividers
            );
            subContainers.push(subContainer);
          });
          const size = 5;
          const resizer = ztoolkit.UI.createElement(doc, "div", {
            styles: {
              height: direction == "row" ? "100%" : `${size}px`,
              width: direction == "column" ? "100%" : `${size}px`,
              backgroundColor: "var(--color-border)",
              cursor: direction == "column" ? "ns-resize" : "ew-resize"
            }
          });
          let y = 0, x = 0;
          let h = 0, w = 0;
          const rect = container.getBoundingClientRect();
          const H = rect.height;
          const W = rect.width;
          const mouseDownHandler = function(e) {
            subContainers.forEach((div) => {
              div.querySelectorAll("span").forEach((e2) => e2.style.display = "none");
            });
            y = e.clientY;
            x = e.clientX;
            const rect2 = subContainers[1].getBoundingClientRect();
            h = rect2.height;
            w = rect2.width;
            doc.addEventListener("mousemove", mouseMoveHandler);
            doc.addEventListener("mouseup", mouseUpHandler);
          };
          const mouseMoveHandler = function(e) {
            const dy = e.clientY - y;
            const dx = e.clientX - x;
            if (direction == "column") {
              subContainers[1].style.height = `${h - dy}px`;
              subContainers[0].style.height = `${H - (h - dy) - size}px`;
            }
            if (direction == "row") {
              subContainers[1].style.width = `${w - dx}px`;
              subContainers[0].style.width = `${W - (w - dx) - size}px`;
            }
          };
          const mouseUpHandler = function() {
            subContainers.forEach((div) => {
              div.querySelectorAll("span").forEach((e) => e.style.display = "");
            });
            doc.removeEventListener("mousemove", mouseMoveHandler);
            doc.removeEventListener("mouseup", mouseUpHandler);
          };
          resizer.addEventListener("mousedown", mouseDownHandler);
          container.append(subContainers[0], resizer, subContainers[1]);
        }
      }
    ]);
  }

  // src/modules/fields.ts
  function registerCustomFields() {
    ztoolkit.FieldHook.register(
      "getField",
      "titleTranslation",
      (field, unformatted, includeBaseMapped, item, original) => {
        return ztoolkit.ExtraField.getExtraField(item, field) || "";
      }
    );
    ztoolkit.FieldHook.register(
      "getField",
      "abstractTranslation",
      (field, unformatted, includeBaseMapped, item, original) => {
        return ztoolkit.ExtraField.getExtraField(item, field) || "";
      }
    );
  }

  // src/hooks.ts
  async function onStartup() {
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ]);
    if (false) {
      const loadDevToolWhen = `Plugin ${config.addonID} startup`;
      ztoolkit.log(loadDevToolWhen);
    }
    initLocale();
    setDefaultPrefSettings();
    registerCustomFields();
    registerReaderInitializer();
    registerShortcuts();
    registerNotify(["item"]);
    registerPrefsWindow();
    registerExtraColumns();
    registerItemPaneInfoRows();
    registerReaderTabPanel();
    await Promise.all(
      Zotero.getMainWindows().map((win) => onMainWindowLoad(win))
    );
  }
  async function onMainWindowLoad(win) {
    await new Promise((resolve) => {
      if (win.document.readyState !== "complete") {
        win.document.addEventListener("readystatechange", () => {
          if (win.document.readyState === "complete") {
            resolve(void 0);
          }
        });
      }
      resolve(void 0);
    });
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ]);
    Services.scriptloader.loadSubScript(
      `chrome://${config.addonRef}/content/scripts/customElements.js`,
      win
    );
    win.MozXULElement.insertFTLIfNeeded(
      `${config.addonRef}-mainWindow.ftl`
    );
    registerMenu();
    registerPrompt();
    win.document.addEventListener("focusout", (ev) => {
      if (ev.target !== win.document) {
        return;
      }
      addon.data.translate.concatKey = false;
    });
  }
  async function onMainWindowUnload(win) {
    win.document.querySelector(`[href="${config.addonRef}-mainWindow.ftl"]`)?.remove();
  }
  function onShutdown() {
    ztoolkit.unregisterAll();
    Zotero.getMainWindows().forEach((win) => {
      onMainWindowUnload(win);
    });
    addon.data.alive = false;
    delete Zotero[config.addonInstance];
  }
  function onNotify(event, type, ids, extraData) {
    if (event === "add" && type === "item") {
      if (!getPref("enableAnnotationFromSyncTranslation") && extraData?.skipAutoSync)
        return;
      const annotationItems = Zotero.Items.get(ids).filter(
        (item) => item.isAnnotation()
      );
      if (annotationItems.length === 0) {
        return;
      }
      if (getPref("enableComment")) {
        addon.hooks.onTranslateInBatch(
          annotationItems.map((item) => addTranslateAnnotationTask(item.id)).filter((task) => task),
          { noDisplay: true }
        );
      }
    } else if (type === "tab" && ["select", "add", "close"].includes(event)) {
      addon.data.translate.concatKey = false;
    } else {
      return;
    }
  }
  function onPrefsLoad(event) {
    registerPrefsScripts(event.target.ownerGlobal);
  }
  function onShortcuts(type) {
    switch (type) {
      case "library":
        {
          addon.hooks.onTranslateInBatch(
            Zotero.getActiveZoteroPane().getSelectedItems(true).map((id) => addTranslateTitleTask(id, true)).filter((task) => task),
            { noDisplay: true, noCache: true }
          );
        }
        break;
      case "reader":
        {
          addon.hooks.onTranslate(void 0, {
            noCheckZoteroItemLanguage: true,
            noCache: true
          });
        }
        break;
      default:
        break;
    }
  }
  async function onTranslate(...data2) {
    let task = void 0;
    let options = {};
    if (data2.length === 1) {
      if (data2[0].raw) {
        task = data2[0];
      } else {
        options = data2[0];
      }
    } else if (data2.length === 2) {
      task = data2[0];
      options = data2[1];
    }
    await addon.data.translate.services.runTranslationTask(task, options);
  }
  async function onTranslateInBatch(tasks, options = {}) {
    for (const task of tasks) {
      await addon.hooks.onTranslate(task, options);
      await Zotero.Promise.delay(addon.data.translate.batchTaskDelay);
    }
  }
  function onReaderPopupShow(event) {
    const selection = addon.data.translate.selectedText;
    const task = getLastTranslateTask();
    if (task?.raw === selection) {
      buildReaderPopup(event);
      addon.hooks.onReaderPopupRefresh();
      return;
    }
    addTranslateTask(selection, event.reader.itemID);
    buildReaderPopup(event);
    addon.hooks.onReaderPopupRefresh();
    if (getPref("enableAuto")) {
      addon.hooks.onTranslate();
    }
  }
  function onReaderPopupRefresh() {
    updateReaderPopup();
  }
  function onReaderTabPanelRefresh() {
    updateReaderTabPanels();
  }
  var hooks_default = {
    onStartup,
    onMainWindowLoad,
    onMainWindowUnload,
    onShutdown,
    onNotify,
    onPrefsLoad,
    onShortcuts,
    onTranslate,
    onTranslateInBatch,
    onReaderPopupShow,
    onReaderPopupRefresh,
    onReaderTabPanelRefresh
  };

  // src/addon.ts
  init_package();
  var Addon = class {
    data;
    // Lifecycle hooks
    hooks;
    // APIs
    api;
    constructor() {
      this.data = {
        config,
        alive: true,
        env: "production",
        ztoolkit: createZToolkit(),
        locale: {},
        prefs: { window: null },
        panel: { tabOptionId: "", activePanels: {}, windowPanel: null },
        popup: { currentPopup: null },
        translate: {
          selectedText: "",
          concatKey: false,
          concatCheckbox: false,
          queue: [],
          maximumQueueLength: 100,
          batchTaskDelay: 1e3,
          services,
          cachedSourceLanguage: {},
          refreshTick: ""
        }
      };
      this.hooks = hooks_default;
      this.api = api_default;
    }
  };
  var addon_default = Addon;

  // src/index.ts
  init_package();
  var basicTool2 = new BasicTool();
  if (!basicTool2.getGlobal("Zotero")[config.addonInstance]) {
    _globalThis.Zotero = basicTool2.getGlobal("Zotero");
    defineGlobal("crypto");
    defineGlobal("TextEncoder");
    _globalThis.addon = new addon_default();
    defineGlobal("ztoolkit", () => {
      return _globalThis.addon.data.ztoolkit;
    });
    Zotero[config.addonInstance] = addon;
    addon.hooks.onStartup();
  }
  function defineGlobal(name, getter) {
    Object.defineProperty(_globalThis, name, {
      get() {
        return getter ? getter() : basicTool2.getGlobal(name);
      }
    });
  }
})();
/*! Bundled license information:

jsencrypt/lib/lib/jsrsasign/asn1-1.0.js:
  (**
   * @fileOverview
   * @name asn1-1.0.js
   * @author Kenji Urushima kenji.urushima@gmail.com
   * @version asn1 1.0.13 (2017-Jun-02)
   * @since jsrsasign 2.1
   * @license <a href="https://kjur.github.io/jsrsasign/license/">MIT License</a>
   *)
*/
