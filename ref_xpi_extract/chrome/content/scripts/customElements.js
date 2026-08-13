"use strict";
(() => {
  // package.json
  var config = {
    addonName: "Translate for Zotero",
    addonID: "zoteropdftranslate@euclpts.com",
    addonRef: "zoteropdftranslate",
    prefsPrefix: "extensions.zotero.ZoteroPDFTranslate",
    addonInstance: "PDFTranslate"
  };

  // src/elements/base.ts
  var PluginCEBase = class extends XULElementBase {
    _addon;
    useShadowRoot = false;
    connectedCallback() {
      this._addon = Zotero[config.addonInstance];
      Zotero.UIProperties.registerRoot(this);
      if (!this.useShadowRoot) {
        super.connectedCallback();
        return;
      }
      this.attachShadow({ mode: "open" });
      let content = this.content;
      if (content) {
        content = document.importNode(content, true);
        this.shadowRoot?.append(content);
      }
      MozXULElement.insertFTLIfNeeded("branding/brand.ftl");
      MozXULElement.insertFTLIfNeeded("zotero.ftl");
      if (document.l10n && this.shadowRoot) {
        document.l10n.connectRoot(this.shadowRoot);
      }
      window.addEventListener("unload", this._handleWindowUnload);
      this.initialized = true;
      this.init();
    }
    _wrapID(key) {
      if (key.startsWith(config.addonRef)) {
        return key;
      }
      return `${config.addonRef}-${key}`;
    }
    _unwrapID(id) {
      if (id.startsWith(config.addonRef)) {
        return id.slice(config.addonRef.length + 1);
      }
      return id;
    }
    _queryID(key) {
      const selector = `#${this._wrapID(key)}`;
      return this.querySelector(selector) || this.shadowRoot?.querySelector(selector);
    }
    _parseContentID(dom) {
      dom.querySelectorAll("*[id]").forEach((elem) => {
        elem.id = this._wrapID(elem.id);
      });
      dom.querySelectorAll("*[data-l10n-id]").forEach((elem) => {
        elem.setAttribute(
          "data-l10n-id",
          this._wrapID(elem.getAttribute("data-l10n-id"))
        );
      });
      return dom;
    }
  };

  // src/utils/prefs.ts
  function getPref(key) {
    return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  }
  function setPref(key, value) {
    return Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
  }

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
    const max = value.length * MAX_DIFFERENCE - min;
    let index = -1;
    while (++index < distances.length) {
      distances[index][1] = 1 - (distances[index][1] - min) / max || 0;
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

  // src/utils/task.ts
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

  // src/elements/panel.ts
  var services = Zotero[config.addonInstance].data.translate.services;
  var TranslatorPanel = class extends PluginCEBase {
    _item = null;
    _taskID = "";
    get item() {
      return this._item;
    }
    set item(val) {
      this._item = val;
    }
    get content() {
      return this._parseContentID(
        MozXULElement.parseXULToFragment(`
<linkset>
  <html:link rel="localization" href="${config.addonRef}-panel.ftl" />
  <html:link
    rel="stylesheet"
    href="chrome://${config.addonRef}/content/styles/panel.css"
  ></html:link>
</linkset>
<hbox id="engine" align="center">
  <menulist id="services" native="true">
    <menupopup>
      ${services.getAllServicesWithType("sentence").map((service) => {
          const customName = services.getServiceNameByID(service.id);
          return `<menuitem label="${customName}" value="${service.id}" />`;
        }).join("\n")}
    </menupopup>
  </menulist>
  <button id="translate" data-l10n-id="translate" />
</hbox>
<hbox id="language" align="center">
  <menulist id="langfrom" class="lang-menulist" native="true">
    <menupopup>
      ${LANG_CODE.map((lang) => `<menuitem label="${lang.name}" value="${lang.code}" />`).join("\n")}
    </menupopup>
  </menulist>
  <toolbarbutton id="swap-language" class="icon-button" data-l10n-id="swapLanguage" />
  <menulist id="langto" class="lang-menulist" native="true">
    <menupopup>
      ${LANG_CODE.map((lang) => `<menuitem label="${lang.name}" value="${lang.code}" />`).join("\n")}
    </menupopup>
  </menulist>
</hbox>
<html:div class="separator"></html:div>
<html:div id="text-container" class="editor-container">
  ${getPref("enableMathRendering") ? `<math-textbox id="raw-text"></math-textbox>` : `<editable-text id="raw-text" multiline="true" />`}
  <html:div id="resizer" class="draggable-container">
    <html:div class="separator"></html:div>
  </html:div>
  ${getPref("enableMathRendering") ? `<math-textbox id="result-text"></math-textbox>` : `<editable-text id="result-text" multiline="true" />`}
</html:div>
<html:div class="separator"></html:div>
<html:div class="options-container">
  <html:div id="auto-container" class="options-grid">
    <html:label class="options-label" data-l10n-id="auto" />
    <html:div class="options-content">
      <checkbox id="auto-trans-selection" native="true" data-l10n-id="autoTranslateSelection" />
      <checkbox id="auto-trans-annotation" native="true" data-l10n-id="autoTranslateAnnotation" />
    </html:div>
  </html:div>
  <html:div id="concat-container" class="options-grid">
    <html:label class="options-label" data-l10n-id="selection" />
    <html:div class="options-content">
      <checkbox id="concat" native="true" data-l10n-id="enableConcat" />
      <button id="clear-concat" data-l10n-id="clearConcat" />
    </html:div>
  </html:div>
  <html:div id="copy-container" class="options-grid" >
    <html:label class="options-label" data-l10n-id="copy" />
    <html:div class="options-content">
      <button id="copy-raw" data-l10n-id="copyRaw" />
      <button id="copy-result" data-l10n-id="copyResult" />
      <button id="copy-both" data-l10n-id="copyBoth" />
    </html:div>
  </html:div>
</html:div>
`)
      );
    }
    init() {
      this._queryID("services")?.addEventListener("command", (e) => {
        const newService = e.target.value;
        setPref("translateSource", newService);
        this._addon.hooks.onReaderTabPanelRefresh();
        const data2 = getLastTranslateTask();
        if (!data2) {
          return;
        }
        data2.service = newService;
        this._addon.hooks.onTranslate(void 0, {
          noCheckZoteroItemLanguage: true
        });
      });
      this._queryID("translate")?.addEventListener("command", () => {
        if (!getLastTranslateTask()) {
          addTranslateTask(
            this._queryID(
              getPref("rawResultOrder") ? "result-text" : "raw-text"
            )?.value
          );
        }
        this._addon.hooks.onTranslate(void 0, {
          noCheckZoteroItemLanguage: true,
          noCache: true
        });
      });
      this._queryID("langfrom")?.addEventListener("command", (e) => {
        const newValue = e.target.value;
        setPref("sourceLanguage", newValue);
        const itemID = this.item?.id;
        if (itemID) {
          this._addon.data.translate.cachedSourceLanguage[Number(itemID)] = newValue;
        }
        this._addon.hooks.onReaderTabPanelRefresh();
      });
      this._queryID("swap-language")?.addEventListener("command", () => {
        const langfrom = getPref("sourceLanguage");
        const langto = getPref("targetLanguage");
        setPref("targetLanguage", langfrom);
        setPref("sourceLanguage", langto);
        this._addon.hooks.onReaderTabPanelRefresh();
      });
      this._queryID("langto")?.addEventListener("command", (e) => {
        setPref("targetLanguage", e.target.value);
        this._addon.hooks.onReaderTabPanelRefresh();
      });
      this._queryID("raw-text")?.addEventListener("input", (e) => {
        let task = getLastTranslateTask({
          id: this._taskID
        });
        if (!task) {
          task = addTranslateTask(
            e.target.value,
            this.item?.id,
            "text"
          );
          if (task) this._taskID = task.id;
        }
        if (!task) {
          return;
        }
        const reverseRawResult = getPref("rawResultOrder");
        if (!reverseRawResult) {
          task.raw = e.target.value;
        } else {
          task.result = e.target.value;
        }
        putTranslateTaskAtHead(task.id);
      });
      this._queryID("result-text")?.addEventListener("input", (e) => {
        let task = getLastTranslateTask({
          id: this._taskID
        });
        if (!task) {
          task = addTranslateTask(
            e.target.value,
            this.item?.id,
            "text"
          );
          if (task) this._taskID = task.id;
        }
        if (!task) {
          return;
        }
        const reverseRawResult = getPref("rawResultOrder");
        if (!reverseRawResult) {
          task.result = e.target.value;
        } else {
          task.raw = e.target.value;
        }
        putTranslateTaskAtHead(task.id);
      });
      this._queryID("auto-trans-selection")?.addEventListener("command", (e) => {
        setPref("enableAuto", e.target.checked);
        this._addon.hooks.onReaderTabPanelRefresh();
      });
      this._queryID("auto-trans-annotation")?.addEventListener("command", (e) => {
        setPref("enableComment", e.target.checked);
        this._addon.hooks.onReaderTabPanelRefresh();
      });
      this._queryID("concat")?.addEventListener("command", (e) => {
        this._addon.data.translate.concatCheckbox = e.target.checked;
        this._addon.hooks.onReaderTabPanelRefresh();
      });
      this._queryID("clear-concat")?.addEventListener("command", () => {
        const task = getLastTranslateTask();
        if (task) {
          task.raw = "";
          task.result = "";
          task.extraTasks.forEach((t) => {
            t.result = "";
          });
          this._addon.hooks.onReaderTabPanelRefresh();
        }
      });
      this._queryID("copy-raw")?.addEventListener("command", () => {
        const task = getLastTranslateTask({
          id: this._taskID
        });
        if (!task) {
          return;
        }
        new this._addon.data.ztoolkit.Clipboard().addText(task.raw, "text/plain").copy();
      });
      this._queryID("copy-result")?.addEventListener("command", () => {
        const task = getLastTranslateTask({
          id: this._taskID
        });
        if (!task) {
          return;
        }
        new this._addon.data.ztoolkit.Clipboard().addText(task.result, "text/plain").copy();
      });
      this._queryID("copy-both")?.addEventListener("command", () => {
        const task = getLastTranslateTask({
          id: this._taskID
        });
        if (!task) {
          return;
        }
        new this._addon.data.ztoolkit.Clipboard().addText(`${task.raw}
----
${task.result}`, "text/plain").copy();
      });
      const resizer = this._queryID("resizer");
      const container = this._queryID("text-container");
      const rawArea = this._queryID("raw-text");
      const resultArea = this._queryID("result-text");
      rawArea.style.flex = `${getPref("customRawRatio")} 1 0%`;
      resultArea.style.flex = `${getPref("customResultRatio")} 1 0%`;
      let isDragging = false;
      let containerRect;
      resizer?.addEventListener("mousedown", (e) => {
        if (e.button !== 0) {
          return;
        }
        isDragging = true;
        e.preventDefault();
        containerRect = container.getBoundingClientRect();
        window.document.addEventListener("mousemove", doDrag);
        window.document.addEventListener("mouseup", (e2) => {
          isDragging = false;
          window.document.removeEventListener("mousemove", doDrag);
        });
      });
      function doDrag(e) {
        if (!isDragging) {
          return;
        }
        const newRawHeight = e.clientY - containerRect.top;
        const maxRawHeight = containerRect.height - 100 - 13;
        if (newRawHeight >= 100 && newRawHeight <= maxRawHeight) {
          const newResultHeight = containerRect.height - newRawHeight - 13;
          const newRawRatio = (newRawHeight / Math.min(newRawHeight, newResultHeight)).toFixed(3);
          const newResultRatio = (newResultHeight / Math.min(newRawHeight, newResultHeight)).toFixed(3);
          rawArea.style.flex = `${newRawRatio} 1 0%`;
          resultArea.style.flex = `${newResultRatio} 1 0%`;
          setPref("customRawRatio", newRawRatio);
          setPref("customResultRatio", newResultRatio);
        }
      }
      resizer?.addEventListener("dblclick", (e) => {
        if (e.button !== 0) {
          return;
        }
        e.preventDefault();
        rawArea.style.flex = "1 1 0%";
        resultArea.style.flex = "1 1 0%";
        setPref("customRawRatio", "1");
        setPref("customResultRatio", "1");
      });
    }
    destroy() {
    }
    /**
     * Filter unconfigured services from the dropdown menu.
     * Hides services that require API keys but haven't been configured.
     */
    _filterUnconfiguredServices() {
      const menuPopup = this._queryID("services")?.querySelector("menupopup");
      if (!menuPopup) return;
      const menuItems = menuPopup.querySelectorAll("menuitem");
      const hideUnconfigured = getPref("hideUnconfiguredServices");
      const unconfiguredIds = hideUnconfigured ? services.getUnconfiguredServiceIds() : null;
      menuItems.forEach((item) => {
        const serviceId = item.getAttribute("value");
        item.hidden = !!unconfiguredIds?.has(serviceId || "");
      });
    }
    render() {
      const updateHidden = (type, pref) => {
        const elem = this._queryID(type);
        const hidden = !getPref(pref);
        elem.hidden = hidden;
        if (elem.nextElementSibling?.classList.contains("separator") || elem.nextElementSibling?.classList.contains("draggable-container")) {
          elem.nextElementSibling.hidden = hidden;
        }
      };
      const setCheckBox = (type, checked) => {
        const elem = this._queryID(type);
        elem.checked = checked;
      };
      const setValue = (type, value) => {
        const elem = this._queryID(type);
        elem.value = value;
      };
      const setPalceHolder = (type, placeholder) => {
        const elem = this._queryID(type);
        elem.placeholder = placeholder;
      };
      const setTextBoxStyle = (type) => {
        const elem = this._queryID(type);
        elem.style.fontSize = `${getPref("fontSize")}px`;
        elem.style.lineHeight = getPref("lineHeight");
      };
      updateHidden("engine", "showSidebarEngine");
      updateHidden("language", "showSidebarLanguage");
      updateHidden("raw-text", "showSidebarRaw");
      updateHidden("auto-container", "showSidebarSettings");
      updateHidden("concat-container", "showSidebarConcat");
      updateHidden("copy-container", "showSidebarCopy");
      this._filterUnconfiguredServices();
      setValue("services", getPref("translateSource"));
      const { fromLanguage, toLanguage } = autoDetectLanguage(this.item);
      setValue("langfrom", fromLanguage);
      setValue("langto", toLanguage);
      setCheckBox("auto-trans-selection", getPref("enableAuto"));
      setCheckBox("auto-trans-annotation", getPref("enableComment"));
      setCheckBox("concat", this._addon.data.translate.concatCheckbox);
      setTextBoxStyle("raw-text");
      setTextBoxStyle("result-text");
      const reverseRawResult = getPref("rawResultOrder");
      setPalceHolder(
        "raw-text",
        reverseRawResult ? "" : "Select or type to translate"
      );
      setPalceHolder(
        "result-text",
        reverseRawResult ? "Select or type to translate" : ""
      );
      const lastTask = getLastTranslateTask();
      if (!lastTask) {
        return;
      }
      this._taskID = lastTask.id;
      if (lastTask.type === "text" || lastTask.raw === "" && lastTask.result === "") {
        setValue("raw-text", reverseRawResult ? lastTask.result : lastTask.raw);
        setValue(
          "result-text",
          reverseRawResult ? lastTask.raw : lastTask.result
        );
      }
    }
  };

  // node_modules/katex/dist/katex.mjs
  var SourceLocation = class _SourceLocation {
    // The + prefix indicates that these fields aren't writeable
    // Lexer holding the input string.
    // Start offset, zero-based inclusive.
    // End offset, zero-based exclusive.
    constructor(lexer, start, end) {
      this.lexer = void 0;
      this.start = void 0;
      this.end = void 0;
      this.lexer = lexer;
      this.start = start;
      this.end = end;
    }
    /**
     * Merges two `SourceLocation`s from location providers, given they are
     * provided in order of appearance.
     * - Returns the first one's location if only the first is provided.
     * - Returns a merged range of the first and the last if both are provided
     *   and their lexers match.
     * - Otherwise, returns null.
     */
    static range(first, second) {
      if (!second) {
        return first && first.loc;
      } else if (!first || !first.loc || !second.loc || first.loc.lexer !== second.loc.lexer) {
        return null;
      } else {
        return new _SourceLocation(first.loc.lexer, first.loc.start, second.loc.end);
      }
    }
  };
  var Token = class _Token {
    // don't expand the token
    // used in \noexpand
    constructor(text2, loc) {
      this.text = void 0;
      this.loc = void 0;
      this.noexpand = void 0;
      this.treatAsRelax = void 0;
      this.text = text2;
      this.loc = loc;
    }
    /**
     * Given a pair of tokens (this and endToken), compute a `Token` encompassing
     * the whole input range enclosed by these two.
     */
    range(endToken, text2) {
      return new _Token(text2, SourceLocation.range(this, endToken));
    }
  };
  var ParseError = class _ParseError {
    // Error start position based on passed-in Token or ParseNode.
    // Length of affected text based on passed-in Token or ParseNode.
    // The underlying error message without any context added.
    constructor(message, token) {
      this.name = void 0;
      this.position = void 0;
      this.length = void 0;
      this.rawMessage = void 0;
      var error = "KaTeX parse error: " + message;
      var start;
      var end;
      var loc = token && token.loc;
      if (loc && loc.start <= loc.end) {
        var input = loc.lexer.input;
        start = loc.start;
        end = loc.end;
        if (start === input.length) {
          error += " at end of input: ";
        } else {
          error += " at position " + (start + 1) + ": ";
        }
        var underlined = input.slice(start, end).replace(/[^]/g, "$&\u0332");
        var left;
        if (start > 15) {
          left = "\u2026" + input.slice(start - 15, start);
        } else {
          left = input.slice(0, start);
        }
        var right;
        if (end + 15 < input.length) {
          right = input.slice(end, end + 15) + "\u2026";
        } else {
          right = input.slice(end);
        }
        error += left + underlined + right;
      }
      var self = new Error(error);
      self.name = "ParseError";
      self.__proto__ = _ParseError.prototype;
      self.position = start;
      if (start != null && end != null) {
        self.length = end - start;
      }
      self.rawMessage = message;
      return self;
    }
  };
  ParseError.prototype.__proto__ = Error.prototype;
  var deflt = function deflt2(setting, defaultIfUndefined) {
    return setting === void 0 ? defaultIfUndefined : setting;
  };
  var uppercase = /([A-Z])/g;
  var hyphenate = function hyphenate2(str) {
    return str.replace(uppercase, "-$1").toLowerCase();
  };
  var ESCAPE_LOOKUP = {
    "&": "&amp;",
    ">": "&gt;",
    "<": "&lt;",
    '"': "&quot;",
    "'": "&#x27;"
  };
  var ESCAPE_REGEX = /[&><"']/g;
  function escape(text2) {
    return String(text2).replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
  }
  var getBaseElem = function getBaseElem2(group) {
    if (group.type === "ordgroup") {
      if (group.body.length === 1) {
        return getBaseElem2(group.body[0]);
      } else {
        return group;
      }
    } else if (group.type === "color") {
      if (group.body.length === 1) {
        return getBaseElem2(group.body[0]);
      } else {
        return group;
      }
    } else if (group.type === "font") {
      return getBaseElem2(group.body);
    } else {
      return group;
    }
  };
  var isCharacterBox = function isCharacterBox2(group) {
    var baseElem = getBaseElem(group);
    return baseElem.type === "mathord" || baseElem.type === "textord" || baseElem.type === "atom";
  };
  var assert = function assert2(value) {
    if (!value) {
      throw new Error("Expected non-null, but got " + String(value));
    }
    return value;
  };
  var protocolFromUrl = function protocolFromUrl2(url) {
    var protocol = /^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(url);
    if (!protocol) {
      return "_relative";
    }
    if (protocol[2] !== ":") {
      return null;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(protocol[1])) {
      return null;
    }
    return protocol[1].toLowerCase();
  };
  var utils = {
    deflt,
    escape,
    hyphenate,
    getBaseElem,
    isCharacterBox,
    protocolFromUrl
  };
  var SETTINGS_SCHEMA = {
    displayMode: {
      type: "boolean",
      description: "Render math in display mode, which puts the math in display style (so \\int and \\sum are large, for example), and centers the math on the page on its own line.",
      cli: "-d, --display-mode"
    },
    output: {
      type: {
        enum: ["htmlAndMathml", "html", "mathml"]
      },
      description: "Determines the markup language of the output.",
      cli: "-F, --format <type>"
    },
    leqno: {
      type: "boolean",
      description: "Render display math in leqno style (left-justified tags)."
    },
    fleqn: {
      type: "boolean",
      description: "Render display math flush left."
    },
    throwOnError: {
      type: "boolean",
      default: true,
      cli: "-t, --no-throw-on-error",
      cliDescription: "Render errors (in the color given by --error-color) instead of throwing a ParseError exception when encountering an error."
    },
    errorColor: {
      type: "string",
      default: "#cc0000",
      cli: "-c, --error-color <color>",
      cliDescription: "A color string given in the format 'rgb' or 'rrggbb' (no #). This option determines the color of errors rendered by the -t option.",
      cliProcessor: (color) => "#" + color
    },
    macros: {
      type: "object",
      cli: "-m, --macro <def>",
      cliDescription: "Define custom macro of the form '\\foo:expansion' (use multiple -m arguments for multiple macros).",
      cliDefault: [],
      cliProcessor: (def, defs) => {
        defs.push(def);
        return defs;
      }
    },
    minRuleThickness: {
      type: "number",
      description: "Specifies a minimum thickness, in ems, for fraction lines, `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, `\\hdashline`, `\\underline`, `\\overline`, and the borders of `\\fbox`, `\\boxed`, and `\\fcolorbox`.",
      processor: (t) => Math.max(0, t),
      cli: "--min-rule-thickness <size>",
      cliProcessor: parseFloat
    },
    colorIsTextColor: {
      type: "boolean",
      description: "Makes \\color behave like LaTeX's 2-argument \\textcolor, instead of LaTeX's one-argument \\color mode change.",
      cli: "-b, --color-is-text-color"
    },
    strict: {
      type: [{
        enum: ["warn", "ignore", "error"]
      }, "boolean", "function"],
      description: "Turn on strict / LaTeX faithfulness mode, which throws an error if the input uses features that are not supported by LaTeX.",
      cli: "-S, --strict",
      cliDefault: false
    },
    trust: {
      type: ["boolean", "function"],
      description: "Trust the input, enabling all HTML features such as \\url.",
      cli: "-T, --trust"
    },
    maxSize: {
      type: "number",
      default: Infinity,
      description: "If non-zero, all user-specified sizes, e.g. in \\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, elements and spaces can be arbitrarily large",
      processor: (s) => Math.max(0, s),
      cli: "-s, --max-size <n>",
      cliProcessor: parseInt
    },
    maxExpand: {
      type: "number",
      default: 1e3,
      description: "Limit the number of macro expansions to the specified number, to prevent e.g. infinite macro loops. If set to Infinity, the macro expander will try to fully expand as in LaTeX.",
      processor: (n) => Math.max(0, n),
      cli: "-e, --max-expand <n>",
      cliProcessor: (n) => n === "Infinity" ? Infinity : parseInt(n)
    },
    globalGroup: {
      type: "boolean",
      cli: false
    }
  };
  function getDefaultValue(schema) {
    if (schema.default) {
      return schema.default;
    }
    var type = schema.type;
    var defaultType = Array.isArray(type) ? type[0] : type;
    if (typeof defaultType !== "string") {
      return defaultType.enum[0];
    }
    switch (defaultType) {
      case "boolean":
        return false;
      case "string":
        return "";
      case "number":
        return 0;
      case "object":
        return {};
    }
  }
  var Settings = class {
    constructor(options) {
      this.displayMode = void 0;
      this.output = void 0;
      this.leqno = void 0;
      this.fleqn = void 0;
      this.throwOnError = void 0;
      this.errorColor = void 0;
      this.macros = void 0;
      this.minRuleThickness = void 0;
      this.colorIsTextColor = void 0;
      this.strict = void 0;
      this.trust = void 0;
      this.maxSize = void 0;
      this.maxExpand = void 0;
      this.globalGroup = void 0;
      options = options || {};
      for (var prop in SETTINGS_SCHEMA) {
        if (SETTINGS_SCHEMA.hasOwnProperty(prop)) {
          var schema = SETTINGS_SCHEMA[prop];
          this[prop] = options[prop] !== void 0 ? schema.processor ? schema.processor(options[prop]) : options[prop] : getDefaultValue(schema);
        }
      }
    }
    /**
     * Report nonstrict (non-LaTeX-compatible) input.
     * Can safely not be called if `this.strict` is false in JavaScript.
     */
    reportNonstrict(errorCode, errorMsg, token) {
      var strict = this.strict;
      if (typeof strict === "function") {
        strict = strict(errorCode, errorMsg, token);
      }
      if (!strict || strict === "ignore") {
        return;
      } else if (strict === true || strict === "error") {
        throw new ParseError("LaTeX-incompatible input and strict mode is set to 'error': " + (errorMsg + " [" + errorCode + "]"), token);
      } else if (strict === "warn") {
        typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode + "]"));
      } else {
        typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode + "]"));
      }
    }
    /**
     * Check whether to apply strict (LaTeX-adhering) behavior for unusual
     * input (like `\\`).  Unlike `nonstrict`, will not throw an error;
     * instead, "error" translates to a return value of `true`, while "ignore"
     * translates to a return value of `false`.  May still print a warning:
     * "warn" prints a warning and returns `false`.
     * This is for the second category of `errorCode`s listed in the README.
     */
    useStrictBehavior(errorCode, errorMsg, token) {
      var strict = this.strict;
      if (typeof strict === "function") {
        try {
          strict = strict(errorCode, errorMsg, token);
        } catch (error) {
          strict = "error";
        }
      }
      if (!strict || strict === "ignore") {
        return false;
      } else if (strict === true || strict === "error") {
        return true;
      } else if (strict === "warn") {
        typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to 'warn': " + (errorMsg + " [" + errorCode + "]"));
        return false;
      } else {
        typeof console !== "undefined" && console.warn("LaTeX-incompatible input and strict mode is set to " + ("unrecognized '" + strict + "': " + errorMsg + " [" + errorCode + "]"));
        return false;
      }
    }
    /**
     * Check whether to test potentially dangerous input, and return
     * `true` (trusted) or `false` (untrusted).  The sole argument `context`
     * should be an object with `command` field specifying the relevant LaTeX
     * command (as a string starting with `\`), and any other arguments, etc.
     * If `context` has a `url` field, a `protocol` field will automatically
     * get added by this function (changing the specified object).
     */
    isTrusted(context) {
      if (context.url && !context.protocol) {
        var protocol = utils.protocolFromUrl(context.url);
        if (protocol == null) {
          return false;
        }
        context.protocol = protocol;
      }
      var trust = typeof this.trust === "function" ? this.trust(context) : this.trust;
      return Boolean(trust);
    }
  };
  var Style = class {
    constructor(id, size, cramped) {
      this.id = void 0;
      this.size = void 0;
      this.cramped = void 0;
      this.id = id;
      this.size = size;
      this.cramped = cramped;
    }
    /**
     * Get the style of a superscript given a base in the current style.
     */
    sup() {
      return styles[sup[this.id]];
    }
    /**
     * Get the style of a subscript given a base in the current style.
     */
    sub() {
      return styles[sub[this.id]];
    }
    /**
     * Get the style of a fraction numerator given the fraction in the current
     * style.
     */
    fracNum() {
      return styles[fracNum[this.id]];
    }
    /**
     * Get the style of a fraction denominator given the fraction in the current
     * style.
     */
    fracDen() {
      return styles[fracDen[this.id]];
    }
    /**
     * Get the cramped version of a style (in particular, cramping a cramped style
     * doesn't change the style).
     */
    cramp() {
      return styles[cramp[this.id]];
    }
    /**
     * Get a text or display version of this style.
     */
    text() {
      return styles[text$1[this.id]];
    }
    /**
     * Return true if this style is tightly spaced (scriptstyle/scriptscriptstyle)
     */
    isTight() {
      return this.size >= 2;
    }
  };
  var D = 0;
  var Dc = 1;
  var T = 2;
  var Tc = 3;
  var S = 4;
  var Sc = 5;
  var SS = 6;
  var SSc = 7;
  var styles = [new Style(D, 0, false), new Style(Dc, 0, true), new Style(T, 1, false), new Style(Tc, 1, true), new Style(S, 2, false), new Style(Sc, 2, true), new Style(SS, 3, false), new Style(SSc, 3, true)];
  var sup = [S, Sc, S, Sc, SS, SSc, SS, SSc];
  var sub = [Sc, Sc, Sc, Sc, SSc, SSc, SSc, SSc];
  var fracNum = [T, Tc, S, Sc, SS, SSc, SS, SSc];
  var fracDen = [Tc, Tc, Sc, Sc, SSc, SSc, SSc, SSc];
  var cramp = [Dc, Dc, Tc, Tc, Sc, Sc, SSc, SSc];
  var text$1 = [D, Dc, T, Tc, T, Tc, T, Tc];
  var Style$1 = {
    DISPLAY: styles[D],
    TEXT: styles[T],
    SCRIPT: styles[S],
    SCRIPTSCRIPT: styles[SS]
  };
  var scriptData = [{
    // Latin characters beyond the Latin-1 characters we have metrics for.
    // Needed for Czech, Hungarian and Turkish text, for example.
    name: "latin",
    blocks: [
      [256, 591],
      // Latin Extended-A and Latin Extended-B
      [768, 879]
      // Combining Diacritical marks
    ]
  }, {
    // The Cyrillic script used by Russian and related languages.
    // A Cyrillic subset used to be supported as explicitly defined
    // symbols in symbols.js
    name: "cyrillic",
    blocks: [[1024, 1279]]
  }, {
    // Armenian
    name: "armenian",
    blocks: [[1328, 1423]]
  }, {
    // The Brahmic scripts of South and Southeast Asia
    // Devanagari (0900–097F)
    // Bengali (0980–09FF)
    // Gurmukhi (0A00–0A7F)
    // Gujarati (0A80–0AFF)
    // Oriya (0B00–0B7F)
    // Tamil (0B80–0BFF)
    // Telugu (0C00–0C7F)
    // Kannada (0C80–0CFF)
    // Malayalam (0D00–0D7F)
    // Sinhala (0D80–0DFF)
    // Thai (0E00–0E7F)
    // Lao (0E80–0EFF)
    // Tibetan (0F00–0FFF)
    // Myanmar (1000–109F)
    name: "brahmic",
    blocks: [[2304, 4255]]
  }, {
    name: "georgian",
    blocks: [[4256, 4351]]
  }, {
    // Chinese and Japanese.
    // The "k" in cjk is for Korean, but we've separated Korean out
    name: "cjk",
    blocks: [
      [12288, 12543],
      // CJK symbols and punctuation, Hiragana, Katakana
      [19968, 40879],
      // CJK ideograms
      [65280, 65376]
      // Fullwidth punctuation
      // TODO: add halfwidth Katakana and Romanji glyphs
    ]
  }, {
    // Korean
    name: "hangul",
    blocks: [[44032, 55215]]
  }];
  function scriptFromCodepoint(codepoint) {
    for (var i = 0; i < scriptData.length; i++) {
      var script2 = scriptData[i];
      for (var _i = 0; _i < script2.blocks.length; _i++) {
        var block = script2.blocks[_i];
        if (codepoint >= block[0] && codepoint <= block[1]) {
          return script2.name;
        }
      }
    }
    return null;
  }
  var allBlocks = [];
  scriptData.forEach((s) => s.blocks.forEach((b) => allBlocks.push(...b)));
  function supportedCodepoint(codepoint) {
    for (var i = 0; i < allBlocks.length; i += 2) {
      if (codepoint >= allBlocks[i] && codepoint <= allBlocks[i + 1]) {
        return true;
      }
    }
    return false;
  }
  var hLinePad = 80;
  var sqrtMain = function sqrtMain2(extraVinculum, hLinePad2) {
    return "M95," + (622 + extraVinculum + hLinePad2) + "\nc-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14\nc0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54\nc44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10\ns173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429\nc69,-144,104.5,-217.7,106.5,-221\nl" + extraVinculum / 2.075 + " -" + extraVinculum + "\nc5.3,-9.3,12,-14,20,-14\nH400000v" + (40 + extraVinculum) + "H845.2724\ns-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7\nc-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z\nM" + (834 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
  };
  var sqrtSize1 = function sqrtSize12(extraVinculum, hLinePad2) {
    return "M263," + (601 + extraVinculum + hLinePad2) + "c0.7,0,18,39.7,52,119\nc34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120\nc340,-704.7,510.7,-1060.3,512,-1067\nl" + extraVinculum / 2.084 + " -" + extraVinculum + "\nc4.7,-7.3,11,-11,19,-11\nH40000v" + (40 + extraVinculum) + "H1012.3\ns-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232\nc-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1\ns-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26\nc-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z\nM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
  };
  var sqrtSize2 = function sqrtSize22(extraVinculum, hLinePad2) {
    return "M983 " + (10 + extraVinculum + hLinePad2) + "\nl" + extraVinculum / 3.13 + " -" + extraVinculum + "\nc4,-6.7,10,-10,18,-10 H400000v" + (40 + extraVinculum) + "\nH1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7\ns-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744\nc-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30\nc26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722\nc56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5\nc53.7,-170.3,84.5,-266.8,92.5,-289.5z\nM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "h-400000z";
  };
  var sqrtSize3 = function sqrtSize32(extraVinculum, hLinePad2) {
    return "M424," + (2398 + extraVinculum + hLinePad2) + "\nc-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514\nc0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20\ns-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121\ns209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081\nl" + extraVinculum / 4.223 + " -" + extraVinculum + "c4,-6.7,10,-10,18,-10 H400000\nv" + (40 + extraVinculum) + "H1014.6\ns-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185\nc-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2z M" + (1001 + extraVinculum) + " " + hLinePad2 + "\nh400000v" + (40 + extraVinculum) + "h-400000z";
  };
  var sqrtSize4 = function sqrtSize42(extraVinculum, hLinePad2) {
    return "M473," + (2713 + extraVinculum + hLinePad2) + "\nc339.3,-1799.3,509.3,-2700,510,-2702 l" + extraVinculum / 5.298 + " -" + extraVinculum + "\nc3.3,-7.3,9.3,-11,18,-11 H400000v" + (40 + extraVinculum) + "H1017.7\ns-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9\nc-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200\nc0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26\ns76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,\n606zM" + (1001 + extraVinculum) + " " + hLinePad2 + "h400000v" + (40 + extraVinculum) + "H1017.7z";
  };
  var phasePath = function phasePath2(y) {
    var x = y / 2;
    return "M400000 " + y + " H0 L" + x + " 0 l65 45 L145 " + (y - 80) + " H400000z";
  };
  var sqrtTall = function sqrtTall2(extraVinculum, hLinePad2, viewBoxHeight) {
    var vertSegment = viewBoxHeight - 54 - hLinePad2 - extraVinculum;
    return "M702 " + (extraVinculum + hLinePad2) + "H400000" + (40 + extraVinculum) + "\nH742v" + vertSegment + "l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1\nh-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170\nc-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667\n219 661 l218 661zM702 " + hLinePad2 + "H400000v" + (40 + extraVinculum) + "H742z";
  };
  var sqrtPath = function sqrtPath2(size, extraVinculum, viewBoxHeight) {
    extraVinculum = 1e3 * extraVinculum;
    var path2 = "";
    switch (size) {
      case "sqrtMain":
        path2 = sqrtMain(extraVinculum, hLinePad);
        break;
      case "sqrtSize1":
        path2 = sqrtSize1(extraVinculum, hLinePad);
        break;
      case "sqrtSize2":
        path2 = sqrtSize2(extraVinculum, hLinePad);
        break;
      case "sqrtSize3":
        path2 = sqrtSize3(extraVinculum, hLinePad);
        break;
      case "sqrtSize4":
        path2 = sqrtSize4(extraVinculum, hLinePad);
        break;
      case "sqrtTall":
        path2 = sqrtTall(extraVinculum, hLinePad, viewBoxHeight);
    }
    return path2;
  };
  var innerPath = function innerPath2(name, height) {
    switch (name) {
      case "\u239C":
        return "M291 0 H417 V" + height + " H291z M291 0 H417 V" + height + " H291z";
      case "\u2223":
        return "M145 0 H188 V" + height + " H145z M145 0 H188 V" + height + " H145z";
      case "\u2225":
        return "M145 0 H188 V" + height + " H145z M145 0 H188 V" + height + " H145z" + ("M367 0 H410 V" + height + " H367z M367 0 H410 V" + height + " H367z");
      case "\u239F":
        return "M457 0 H583 V" + height + " H457z M457 0 H583 V" + height + " H457z";
      case "\u23A2":
        return "M319 0 H403 V" + height + " H319z M319 0 H403 V" + height + " H319z";
      case "\u23A5":
        return "M263 0 H347 V" + height + " H263z M263 0 H347 V" + height + " H263z";
      case "\u23AA":
        return "M384 0 H504 V" + height + " H384z M384 0 H504 V" + height + " H384z";
      case "\u23D0":
        return "M312 0 H355 V" + height + " H312z M312 0 H355 V" + height + " H312z";
      case "\u2016":
        return "M257 0 H300 V" + height + " H257z M257 0 H300 V" + height + " H257z" + ("M478 0 H521 V" + height + " H478z M478 0 H521 V" + height + " H478z");
      default:
        return "";
    }
  };
  var path = {
    // The doubleleftarrow geometry is from glyph U+21D0 in the font KaTeX Main
    doubleleftarrow: "M262 157\nl10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3\n 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28\n 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5\nc2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5\n 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87\n-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7\n-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z\nm8 0v40h399730v-40zm0 194v40h399730v-40z",
    // doublerightarrow is from glyph U+21D2 in font KaTeX Main
    doublerightarrow: "M399738 392l\n-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5\n 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88\n-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68\n-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18\n-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782\nc-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3\n-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z",
    // leftarrow is from glyph U+2190 in font KaTeX Main
    leftarrow: "M400000 241H110l3-3c68.7-52.7 113.7-120\n 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8\n-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247\nc-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208\n 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3\n 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202\n l-3-3h399890zM100 241v40h399900v-40z",
    // overbrace is from glyphs U+23A9/23A8/23A7 in font KaTeX_Size4-Regular
    leftbrace: "M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117\n-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7\n 5-6 9-10 13-.7 1-7.3 1-20 1H6z",
    leftbraceunder: "M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13\n 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688\n 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7\n-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z",
    // overgroup is from the MnSymbol package (public domain)
    leftgroup: "M400000 80\nH435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0\n 435 0h399565z",
    leftgroupunder: "M400000 262\nH435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219\n 435 219h399565z",
    // Harpoons are from glyph U+21BD in font KaTeX Main
    leftharpoon: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3\n-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5\n-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7\n-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z",
    leftharpoonplus: "M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5\n 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3\n-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7\n-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z\nm0 0v40h400000v-40z",
    leftharpoondown: "M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333\n 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5\n 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667\n-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z",
    leftharpoondownplus: "M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12\n 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7\n-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0\nv40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z",
    // hook is from glyph U+21A9 in font KaTeX Main
    lefthook: "M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5\n-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3\n-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21\n 71.5 23h399859zM103 281v-40h399897v40z",
    leftlinesegment: "M40 281 V428 H0 V94 H40 V241 H400000 v40z\nM40 281 V428 H0 V94 H40 V241 H400000 v40z",
    leftmapsto: "M40 281 V448H0V74H40V241H400000v40z\nM40 281 V448H0V74H40V241H400000v40z",
    // tofrom is from glyph U+21C4 in font KaTeX AMS Regular
    leftToFrom: "M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23\n-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8\nc28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3\n 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z",
    longequal: "M0 50 h400000 v40H0z m0 194h40000v40H0z\nM0 50 h400000 v40H0z m0 194h40000v40H0z",
    midbrace: "M200428 334\nc-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14\n-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7\n 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11\n 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z",
    midbraceunder: "M199572 214\nc100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14\n 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3\n 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0\n-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z",
    oiintSize1: "M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6\n-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z\nm368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8\n60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z",
    oiintSize2: "M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8\n-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z\nm502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2\nc0 110 84 276 504 276s502.4-166 502.4-276z",
    oiiintSize1: "M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6\n-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z\nm525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0\n85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z",
    oiiintSize2: "M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8\n-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z\nm770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1\nc0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z",
    rightarrow: "M0 241v40h399891c-47.3 35.3-84 78-110 128\n-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20\n 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7\n 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85\n-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n 151.7 139 205zm0 0v40h399900v-40z",
    rightbrace: "M400000 542l\n-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5\ns-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1\nc124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z",
    rightbraceunder: "M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3\n 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237\n-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z",
    rightgroup: "M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0\n 3-1 3-3v-38c-76-158-257-219-435-219H0z",
    rightgroupunder: "M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18\n 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z",
    rightharpoon: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3\n-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2\n-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58\n 69.2 92 94.5zm0 0v40h399900v-40z",
    rightharpoonplus: "M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11\n-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7\n 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z\nm0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z",
    rightharpoondown: "M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8\n 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5\n-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95\n-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z",
    rightharpoondownplus: "M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8\n 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3\n 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3\n-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z\nm0-194v40h400000v-40zm0 0v40h400000v-40z",
    righthook: "M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3\n 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0\n-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21\n 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z",
    rightlinesegment: "M399960 241 V94 h40 V428 h-40 V281 H0 v-40z\nM399960 241 V94 h40 V428 h-40 V281 H0 v-40z",
    rightToFrom: "M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23\n 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32\n-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142\n-167z M100 147v40h399900v-40zM0 341v40h399900v-40z",
    // twoheadleftarrow is from glyph U+219E in font KaTeX AMS Regular
    twoheadleftarrow: "M0 167c68 40\n 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69\n-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3\n-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19\n-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101\n 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z",
    twoheadrightarrow: "M400000 167\nc-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3\n 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42\n 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333\n-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70\n 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z",
    // tilde1 is a modified version of a glyph from the MnSymbol package
    tilde1: "M200 55.538c-77 0-168 73.953-177 73.953-3 0-7\n-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0\n 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0\n 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128\n-68.267.847-113-73.952-191-73.952z",
    // ditto tilde2, tilde3, & tilde4
    tilde2: "M344 55.266c-142 0-300.638 81.316-311.5 86.418\n-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9\n 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114\nc1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751\n 181.476 676 181.476c-149 0-189-126.21-332-126.21z",
    tilde3: "M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457\n-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0\n 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697\n 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696\n -338 0-409-156.573-744-156.573z",
    tilde4: "M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345\n-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409\n 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9\n 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409\n -175.236-744-175.236z",
    // vec is from glyph U+20D7 in font KaTeX Main
    vec: "M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5\n3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11\n10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63\n-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1\n-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59\nH213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359\nc-16-25.333-24-45-24-59z",
    // widehat1 is a modified version of a glyph from the MnSymbol package
    widehat1: "M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22\nc-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z",
    // ditto widehat2, widehat3, & widehat4
    widehat2: "M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
    widehat3: "M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
    widehat4: "M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10\n-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z",
    // widecheck paths are all inverted versions of widehat
    widecheck1: "M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,\n-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z",
    widecheck2: "M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
    widecheck3: "M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
    widecheck4: "M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,\n-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z",
    // The next ten paths support reaction arrows from the mhchem package.
    // Arrows for \ce{<-->} are offset from xAxis by 0.22ex, per mhchem in LaTeX
    // baraboveleftarrow is mostly from glyph U+2190 in font KaTeX Main
    baraboveleftarrow: "M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202\nc4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5\nc-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130\ns-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47\n121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6\ns2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11\nc0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z\nM100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z",
    // rightarrowabovebar is mostly from glyph U+2192, KaTeX Main
    rightarrowabovebar: "M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32\n-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0\n13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39\n-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5\n-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5\n-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67\n151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z",
    // The short left harpoon has 0.5em (i.e. 500 units) kern on the left end.
    // Ref from mhchem.sty: \rlap{\raisebox{-.22ex}{$\kern0.5em
    baraboveshortleftharpoon: "M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17\nc2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21\nc-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40\nc-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z\nM0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z",
    rightharpoonaboveshortbar: "M0,241 l0,40c399126,0,399993,0,399993,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z",
    shortbaraboveleftharpoon: "M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11\nc1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,\n1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,\n-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z\nM93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z",
    shortrightharpoonabovebar: "M53,241l0,40c398570,0,399437,0,399437,0\nc4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,\n-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6\nc-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z\nM500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z"
  };
  var tallDelim = function tallDelim2(label, midHeight) {
    switch (label) {
      case "lbrack":
        return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v1759 h347 v-84\nH403z M403 1759 V0 H319 V1759 v" + midHeight + " v1759 h84z";
      case "rbrack":
        return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v1759 H0 v84 H347z\nM347 1759 V0 H263 V1759 v" + midHeight + " v1759 h84z";
      case "vert":
        return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z";
      case "doublevert":
        return "M145 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M188 15 H145 v585 v" + midHeight + " v585 h43z\nM367 15 v585 v" + midHeight + " v585 c2.667,10,9.667,15,21,15\nc10,0,16.667,-5,20,-15 v-585 v" + -midHeight + " v-585 c-2.667,-10,-9.667,-15,-21,-15\nc-10,0,-16.667,5,-20,15z M410 15 H367 v585 v" + midHeight + " v585 h43z";
      case "lfloor":
        return "M319 602 V0 H403 V602 v" + midHeight + " v1715 h263 v84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";
      case "rfloor":
        return "M319 602 V0 H403 V602 v" + midHeight + " v1799 H0 v-84 H319z\nMM319 602 V0 H403 V602 v" + midHeight + " v1715 H319z";
      case "lceil":
        return "M403 1759 V84 H666 V0 H319 V1759 v" + midHeight + " v602 h84z\nM403 1759 V0 H319 V1759 v" + midHeight + " v602 h84z";
      case "rceil":
        return "M347 1759 V0 H0 V84 H263 V1759 v" + midHeight + " v602 h84z\nM347 1759 V0 h-84 V1759 v" + midHeight + " v602 h84z";
      case "lparen":
        return "M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1\nc-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,\n-36,557 l0," + (midHeight + 84) + "c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,\n949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9\nc0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,\n-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189\nl0,-" + (midHeight + 92) + "c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,\n-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z";
      case "rparen":
        return "M76,0c-16.7,0,-25,3,-25,9c0,2,2,6.3,6,13c21.3,28.7,42.3,60.3,\n63,95c96.7,156.7,172.8,332.5,228.5,527.5c55.7,195,92.8,416.5,111.5,664.5\nc11.3,139.3,17,290.7,17,454c0,28,1.7,43,3.3,45l0," + (midHeight + 9) + "\nc-3,4,-3.3,16.7,-3.3,38c0,162,-5.7,313.7,-17,455c-18.7,248,-55.8,469.3,-111.5,664\nc-55.7,194.7,-131.8,370.3,-228.5,527c-20.7,34.7,-41.7,66.3,-63,95c-2,3.3,-4,7,-6,11\nc0,7.3,5.7,11,17,11c0,0,11,0,11,0c9.3,0,14.3,-0.3,15,-1c5.3,-5.3,10.3,-11,15,-17\nc242.7,-294.7,395.3,-681.7,458,-1161c21.3,-164.7,33.3,-350.7,36,-558\nl0,-" + (midHeight + 144) + "c-2,-159.3,-10,-310.7,-24,-454c-53.3,-528,-210,-949.7,\n-470,-1265c-4.7,-6,-9.7,-11.7,-15,-17c-0.7,-0.7,-6.7,-1,-18,-1z";
      default:
        throw new Error("Unknown stretchy delimiter.");
    }
  };
  var DocumentFragment = class {
    // Never used; needed for satisfying interface.
    constructor(children) {
      this.children = void 0;
      this.classes = void 0;
      this.height = void 0;
      this.depth = void 0;
      this.maxFontSize = void 0;
      this.style = void 0;
      this.children = children;
      this.classes = [];
      this.height = 0;
      this.depth = 0;
      this.maxFontSize = 0;
      this.style = {};
    }
    hasClass(className) {
      return this.classes.includes(className);
    }
    /** Convert the fragment into a node. */
    toNode() {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < this.children.length; i++) {
        frag.appendChild(this.children[i].toNode());
      }
      return frag;
    }
    /** Convert the fragment into HTML markup. */
    toMarkup() {
      var markup = "";
      for (var i = 0; i < this.children.length; i++) {
        markup += this.children[i].toMarkup();
      }
      return markup;
    }
    /**
     * Converts the math node into a string, similar to innerText. Applies to
     * MathDomNode's only.
     */
    toText() {
      var toText = (child) => child.toText();
      return this.children.map(toText).join("");
    }
  };
  var fontMetricsData = {
    "AMS-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "65": [0, 0.68889, 0, 0, 0.72222],
      "66": [0, 0.68889, 0, 0, 0.66667],
      "67": [0, 0.68889, 0, 0, 0.72222],
      "68": [0, 0.68889, 0, 0, 0.72222],
      "69": [0, 0.68889, 0, 0, 0.66667],
      "70": [0, 0.68889, 0, 0, 0.61111],
      "71": [0, 0.68889, 0, 0, 0.77778],
      "72": [0, 0.68889, 0, 0, 0.77778],
      "73": [0, 0.68889, 0, 0, 0.38889],
      "74": [0.16667, 0.68889, 0, 0, 0.5],
      "75": [0, 0.68889, 0, 0, 0.77778],
      "76": [0, 0.68889, 0, 0, 0.66667],
      "77": [0, 0.68889, 0, 0, 0.94445],
      "78": [0, 0.68889, 0, 0, 0.72222],
      "79": [0.16667, 0.68889, 0, 0, 0.77778],
      "80": [0, 0.68889, 0, 0, 0.61111],
      "81": [0.16667, 0.68889, 0, 0, 0.77778],
      "82": [0, 0.68889, 0, 0, 0.72222],
      "83": [0, 0.68889, 0, 0, 0.55556],
      "84": [0, 0.68889, 0, 0, 0.66667],
      "85": [0, 0.68889, 0, 0, 0.72222],
      "86": [0, 0.68889, 0, 0, 0.72222],
      "87": [0, 0.68889, 0, 0, 1],
      "88": [0, 0.68889, 0, 0, 0.72222],
      "89": [0, 0.68889, 0, 0, 0.72222],
      "90": [0, 0.68889, 0, 0, 0.66667],
      "107": [0, 0.68889, 0, 0, 0.55556],
      "160": [0, 0, 0, 0, 0.25],
      "165": [0, 0.675, 0.025, 0, 0.75],
      "174": [0.15559, 0.69224, 0, 0, 0.94666],
      "240": [0, 0.68889, 0, 0, 0.55556],
      "295": [0, 0.68889, 0, 0, 0.54028],
      "710": [0, 0.825, 0, 0, 2.33334],
      "732": [0, 0.9, 0, 0, 2.33334],
      "770": [0, 0.825, 0, 0, 2.33334],
      "771": [0, 0.9, 0, 0, 2.33334],
      "989": [0.08167, 0.58167, 0, 0, 0.77778],
      "1008": [0, 0.43056, 0.04028, 0, 0.66667],
      "8245": [0, 0.54986, 0, 0, 0.275],
      "8463": [0, 0.68889, 0, 0, 0.54028],
      "8487": [0, 0.68889, 0, 0, 0.72222],
      "8498": [0, 0.68889, 0, 0, 0.55556],
      "8502": [0, 0.68889, 0, 0, 0.66667],
      "8503": [0, 0.68889, 0, 0, 0.44445],
      "8504": [0, 0.68889, 0, 0, 0.66667],
      "8513": [0, 0.68889, 0, 0, 0.63889],
      "8592": [-0.03598, 0.46402, 0, 0, 0.5],
      "8594": [-0.03598, 0.46402, 0, 0, 0.5],
      "8602": [-0.13313, 0.36687, 0, 0, 1],
      "8603": [-0.13313, 0.36687, 0, 0, 1],
      "8606": [0.01354, 0.52239, 0, 0, 1],
      "8608": [0.01354, 0.52239, 0, 0, 1],
      "8610": [0.01354, 0.52239, 0, 0, 1.11111],
      "8611": [0.01354, 0.52239, 0, 0, 1.11111],
      "8619": [0, 0.54986, 0, 0, 1],
      "8620": [0, 0.54986, 0, 0, 1],
      "8621": [-0.13313, 0.37788, 0, 0, 1.38889],
      "8622": [-0.13313, 0.36687, 0, 0, 1],
      "8624": [0, 0.69224, 0, 0, 0.5],
      "8625": [0, 0.69224, 0, 0, 0.5],
      "8630": [0, 0.43056, 0, 0, 1],
      "8631": [0, 0.43056, 0, 0, 1],
      "8634": [0.08198, 0.58198, 0, 0, 0.77778],
      "8635": [0.08198, 0.58198, 0, 0, 0.77778],
      "8638": [0.19444, 0.69224, 0, 0, 0.41667],
      "8639": [0.19444, 0.69224, 0, 0, 0.41667],
      "8642": [0.19444, 0.69224, 0, 0, 0.41667],
      "8643": [0.19444, 0.69224, 0, 0, 0.41667],
      "8644": [0.1808, 0.675, 0, 0, 1],
      "8646": [0.1808, 0.675, 0, 0, 1],
      "8647": [0.1808, 0.675, 0, 0, 1],
      "8648": [0.19444, 0.69224, 0, 0, 0.83334],
      "8649": [0.1808, 0.675, 0, 0, 1],
      "8650": [0.19444, 0.69224, 0, 0, 0.83334],
      "8651": [0.01354, 0.52239, 0, 0, 1],
      "8652": [0.01354, 0.52239, 0, 0, 1],
      "8653": [-0.13313, 0.36687, 0, 0, 1],
      "8654": [-0.13313, 0.36687, 0, 0, 1],
      "8655": [-0.13313, 0.36687, 0, 0, 1],
      "8666": [0.13667, 0.63667, 0, 0, 1],
      "8667": [0.13667, 0.63667, 0, 0, 1],
      "8669": [-0.13313, 0.37788, 0, 0, 1],
      "8672": [-0.064, 0.437, 0, 0, 1.334],
      "8674": [-0.064, 0.437, 0, 0, 1.334],
      "8705": [0, 0.825, 0, 0, 0.5],
      "8708": [0, 0.68889, 0, 0, 0.55556],
      "8709": [0.08167, 0.58167, 0, 0, 0.77778],
      "8717": [0, 0.43056, 0, 0, 0.42917],
      "8722": [-0.03598, 0.46402, 0, 0, 0.5],
      "8724": [0.08198, 0.69224, 0, 0, 0.77778],
      "8726": [0.08167, 0.58167, 0, 0, 0.77778],
      "8733": [0, 0.69224, 0, 0, 0.77778],
      "8736": [0, 0.69224, 0, 0, 0.72222],
      "8737": [0, 0.69224, 0, 0, 0.72222],
      "8738": [0.03517, 0.52239, 0, 0, 0.72222],
      "8739": [0.08167, 0.58167, 0, 0, 0.22222],
      "8740": [0.25142, 0.74111, 0, 0, 0.27778],
      "8741": [0.08167, 0.58167, 0, 0, 0.38889],
      "8742": [0.25142, 0.74111, 0, 0, 0.5],
      "8756": [0, 0.69224, 0, 0, 0.66667],
      "8757": [0, 0.69224, 0, 0, 0.66667],
      "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
      "8765": [-0.13313, 0.37788, 0, 0, 0.77778],
      "8769": [-0.13313, 0.36687, 0, 0, 0.77778],
      "8770": [-0.03625, 0.46375, 0, 0, 0.77778],
      "8774": [0.30274, 0.79383, 0, 0, 0.77778],
      "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
      "8778": [0.08167, 0.58167, 0, 0, 0.77778],
      "8782": [0.06062, 0.54986, 0, 0, 0.77778],
      "8783": [0.06062, 0.54986, 0, 0, 0.77778],
      "8785": [0.08198, 0.58198, 0, 0, 0.77778],
      "8786": [0.08198, 0.58198, 0, 0, 0.77778],
      "8787": [0.08198, 0.58198, 0, 0, 0.77778],
      "8790": [0, 0.69224, 0, 0, 0.77778],
      "8791": [0.22958, 0.72958, 0, 0, 0.77778],
      "8796": [0.08198, 0.91667, 0, 0, 0.77778],
      "8806": [0.25583, 0.75583, 0, 0, 0.77778],
      "8807": [0.25583, 0.75583, 0, 0, 0.77778],
      "8808": [0.25142, 0.75726, 0, 0, 0.77778],
      "8809": [0.25142, 0.75726, 0, 0, 0.77778],
      "8812": [0.25583, 0.75583, 0, 0, 0.5],
      "8814": [0.20576, 0.70576, 0, 0, 0.77778],
      "8815": [0.20576, 0.70576, 0, 0, 0.77778],
      "8816": [0.30274, 0.79383, 0, 0, 0.77778],
      "8817": [0.30274, 0.79383, 0, 0, 0.77778],
      "8818": [0.22958, 0.72958, 0, 0, 0.77778],
      "8819": [0.22958, 0.72958, 0, 0, 0.77778],
      "8822": [0.1808, 0.675, 0, 0, 0.77778],
      "8823": [0.1808, 0.675, 0, 0, 0.77778],
      "8828": [0.13667, 0.63667, 0, 0, 0.77778],
      "8829": [0.13667, 0.63667, 0, 0, 0.77778],
      "8830": [0.22958, 0.72958, 0, 0, 0.77778],
      "8831": [0.22958, 0.72958, 0, 0, 0.77778],
      "8832": [0.20576, 0.70576, 0, 0, 0.77778],
      "8833": [0.20576, 0.70576, 0, 0, 0.77778],
      "8840": [0.30274, 0.79383, 0, 0, 0.77778],
      "8841": [0.30274, 0.79383, 0, 0, 0.77778],
      "8842": [0.13597, 0.63597, 0, 0, 0.77778],
      "8843": [0.13597, 0.63597, 0, 0, 0.77778],
      "8847": [0.03517, 0.54986, 0, 0, 0.77778],
      "8848": [0.03517, 0.54986, 0, 0, 0.77778],
      "8858": [0.08198, 0.58198, 0, 0, 0.77778],
      "8859": [0.08198, 0.58198, 0, 0, 0.77778],
      "8861": [0.08198, 0.58198, 0, 0, 0.77778],
      "8862": [0, 0.675, 0, 0, 0.77778],
      "8863": [0, 0.675, 0, 0, 0.77778],
      "8864": [0, 0.675, 0, 0, 0.77778],
      "8865": [0, 0.675, 0, 0, 0.77778],
      "8872": [0, 0.69224, 0, 0, 0.61111],
      "8873": [0, 0.69224, 0, 0, 0.72222],
      "8874": [0, 0.69224, 0, 0, 0.88889],
      "8876": [0, 0.68889, 0, 0, 0.61111],
      "8877": [0, 0.68889, 0, 0, 0.61111],
      "8878": [0, 0.68889, 0, 0, 0.72222],
      "8879": [0, 0.68889, 0, 0, 0.72222],
      "8882": [0.03517, 0.54986, 0, 0, 0.77778],
      "8883": [0.03517, 0.54986, 0, 0, 0.77778],
      "8884": [0.13667, 0.63667, 0, 0, 0.77778],
      "8885": [0.13667, 0.63667, 0, 0, 0.77778],
      "8888": [0, 0.54986, 0, 0, 1.11111],
      "8890": [0.19444, 0.43056, 0, 0, 0.55556],
      "8891": [0.19444, 0.69224, 0, 0, 0.61111],
      "8892": [0.19444, 0.69224, 0, 0, 0.61111],
      "8901": [0, 0.54986, 0, 0, 0.27778],
      "8903": [0.08167, 0.58167, 0, 0, 0.77778],
      "8905": [0.08167, 0.58167, 0, 0, 0.77778],
      "8906": [0.08167, 0.58167, 0, 0, 0.77778],
      "8907": [0, 0.69224, 0, 0, 0.77778],
      "8908": [0, 0.69224, 0, 0, 0.77778],
      "8909": [-0.03598, 0.46402, 0, 0, 0.77778],
      "8910": [0, 0.54986, 0, 0, 0.76042],
      "8911": [0, 0.54986, 0, 0, 0.76042],
      "8912": [0.03517, 0.54986, 0, 0, 0.77778],
      "8913": [0.03517, 0.54986, 0, 0, 0.77778],
      "8914": [0, 0.54986, 0, 0, 0.66667],
      "8915": [0, 0.54986, 0, 0, 0.66667],
      "8916": [0, 0.69224, 0, 0, 0.66667],
      "8918": [0.0391, 0.5391, 0, 0, 0.77778],
      "8919": [0.0391, 0.5391, 0, 0, 0.77778],
      "8920": [0.03517, 0.54986, 0, 0, 1.33334],
      "8921": [0.03517, 0.54986, 0, 0, 1.33334],
      "8922": [0.38569, 0.88569, 0, 0, 0.77778],
      "8923": [0.38569, 0.88569, 0, 0, 0.77778],
      "8926": [0.13667, 0.63667, 0, 0, 0.77778],
      "8927": [0.13667, 0.63667, 0, 0, 0.77778],
      "8928": [0.30274, 0.79383, 0, 0, 0.77778],
      "8929": [0.30274, 0.79383, 0, 0, 0.77778],
      "8934": [0.23222, 0.74111, 0, 0, 0.77778],
      "8935": [0.23222, 0.74111, 0, 0, 0.77778],
      "8936": [0.23222, 0.74111, 0, 0, 0.77778],
      "8937": [0.23222, 0.74111, 0, 0, 0.77778],
      "8938": [0.20576, 0.70576, 0, 0, 0.77778],
      "8939": [0.20576, 0.70576, 0, 0, 0.77778],
      "8940": [0.30274, 0.79383, 0, 0, 0.77778],
      "8941": [0.30274, 0.79383, 0, 0, 0.77778],
      "8994": [0.19444, 0.69224, 0, 0, 0.77778],
      "8995": [0.19444, 0.69224, 0, 0, 0.77778],
      "9416": [0.15559, 0.69224, 0, 0, 0.90222],
      "9484": [0, 0.69224, 0, 0, 0.5],
      "9488": [0, 0.69224, 0, 0, 0.5],
      "9492": [0, 0.37788, 0, 0, 0.5],
      "9496": [0, 0.37788, 0, 0, 0.5],
      "9585": [0.19444, 0.68889, 0, 0, 0.88889],
      "9586": [0.19444, 0.74111, 0, 0, 0.88889],
      "9632": [0, 0.675, 0, 0, 0.77778],
      "9633": [0, 0.675, 0, 0, 0.77778],
      "9650": [0, 0.54986, 0, 0, 0.72222],
      "9651": [0, 0.54986, 0, 0, 0.72222],
      "9654": [0.03517, 0.54986, 0, 0, 0.77778],
      "9660": [0, 0.54986, 0, 0, 0.72222],
      "9661": [0, 0.54986, 0, 0, 0.72222],
      "9664": [0.03517, 0.54986, 0, 0, 0.77778],
      "9674": [0.11111, 0.69224, 0, 0, 0.66667],
      "9733": [0.19444, 0.69224, 0, 0, 0.94445],
      "10003": [0, 0.69224, 0, 0, 0.83334],
      "10016": [0, 0.69224, 0, 0, 0.83334],
      "10731": [0.11111, 0.69224, 0, 0, 0.66667],
      "10846": [0.19444, 0.75583, 0, 0, 0.61111],
      "10877": [0.13667, 0.63667, 0, 0, 0.77778],
      "10878": [0.13667, 0.63667, 0, 0, 0.77778],
      "10885": [0.25583, 0.75583, 0, 0, 0.77778],
      "10886": [0.25583, 0.75583, 0, 0, 0.77778],
      "10887": [0.13597, 0.63597, 0, 0, 0.77778],
      "10888": [0.13597, 0.63597, 0, 0, 0.77778],
      "10889": [0.26167, 0.75726, 0, 0, 0.77778],
      "10890": [0.26167, 0.75726, 0, 0, 0.77778],
      "10891": [0.48256, 0.98256, 0, 0, 0.77778],
      "10892": [0.48256, 0.98256, 0, 0, 0.77778],
      "10901": [0.13667, 0.63667, 0, 0, 0.77778],
      "10902": [0.13667, 0.63667, 0, 0, 0.77778],
      "10933": [0.25142, 0.75726, 0, 0, 0.77778],
      "10934": [0.25142, 0.75726, 0, 0, 0.77778],
      "10935": [0.26167, 0.75726, 0, 0, 0.77778],
      "10936": [0.26167, 0.75726, 0, 0, 0.77778],
      "10937": [0.26167, 0.75726, 0, 0, 0.77778],
      "10938": [0.26167, 0.75726, 0, 0, 0.77778],
      "10949": [0.25583, 0.75583, 0, 0, 0.77778],
      "10950": [0.25583, 0.75583, 0, 0, 0.77778],
      "10955": [0.28481, 0.79383, 0, 0, 0.77778],
      "10956": [0.28481, 0.79383, 0, 0, 0.77778],
      "57350": [0.08167, 0.58167, 0, 0, 0.22222],
      "57351": [0.08167, 0.58167, 0, 0, 0.38889],
      "57352": [0.08167, 0.58167, 0, 0, 0.77778],
      "57353": [0, 0.43056, 0.04028, 0, 0.66667],
      "57356": [0.25142, 0.75726, 0, 0, 0.77778],
      "57357": [0.25142, 0.75726, 0, 0, 0.77778],
      "57358": [0.41951, 0.91951, 0, 0, 0.77778],
      "57359": [0.30274, 0.79383, 0, 0, 0.77778],
      "57360": [0.30274, 0.79383, 0, 0, 0.77778],
      "57361": [0.41951, 0.91951, 0, 0, 0.77778],
      "57366": [0.25142, 0.75726, 0, 0, 0.77778],
      "57367": [0.25142, 0.75726, 0, 0, 0.77778],
      "57368": [0.25142, 0.75726, 0, 0, 0.77778],
      "57369": [0.25142, 0.75726, 0, 0, 0.77778],
      "57370": [0.13597, 0.63597, 0, 0, 0.77778],
      "57371": [0.13597, 0.63597, 0, 0, 0.77778]
    },
    "Caligraphic-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "65": [0, 0.68333, 0, 0.19445, 0.79847],
      "66": [0, 0.68333, 0.03041, 0.13889, 0.65681],
      "67": [0, 0.68333, 0.05834, 0.13889, 0.52653],
      "68": [0, 0.68333, 0.02778, 0.08334, 0.77139],
      "69": [0, 0.68333, 0.08944, 0.11111, 0.52778],
      "70": [0, 0.68333, 0.09931, 0.11111, 0.71875],
      "71": [0.09722, 0.68333, 0.0593, 0.11111, 0.59487],
      "72": [0, 0.68333, 965e-5, 0.11111, 0.84452],
      "73": [0, 0.68333, 0.07382, 0, 0.54452],
      "74": [0.09722, 0.68333, 0.18472, 0.16667, 0.67778],
      "75": [0, 0.68333, 0.01445, 0.05556, 0.76195],
      "76": [0, 0.68333, 0, 0.13889, 0.68972],
      "77": [0, 0.68333, 0, 0.13889, 1.2009],
      "78": [0, 0.68333, 0.14736, 0.08334, 0.82049],
      "79": [0, 0.68333, 0.02778, 0.11111, 0.79611],
      "80": [0, 0.68333, 0.08222, 0.08334, 0.69556],
      "81": [0.09722, 0.68333, 0, 0.11111, 0.81667],
      "82": [0, 0.68333, 0, 0.08334, 0.8475],
      "83": [0, 0.68333, 0.075, 0.13889, 0.60556],
      "84": [0, 0.68333, 0.25417, 0, 0.54464],
      "85": [0, 0.68333, 0.09931, 0.08334, 0.62583],
      "86": [0, 0.68333, 0.08222, 0, 0.61278],
      "87": [0, 0.68333, 0.08222, 0.08334, 0.98778],
      "88": [0, 0.68333, 0.14643, 0.13889, 0.7133],
      "89": [0.09722, 0.68333, 0.08222, 0.08334, 0.66834],
      "90": [0, 0.68333, 0.07944, 0.13889, 0.72473],
      "160": [0, 0, 0, 0, 0.25]
    },
    "Fraktur-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69141, 0, 0, 0.29574],
      "34": [0, 0.69141, 0, 0, 0.21471],
      "38": [0, 0.69141, 0, 0, 0.73786],
      "39": [0, 0.69141, 0, 0, 0.21201],
      "40": [0.24982, 0.74947, 0, 0, 0.38865],
      "41": [0.24982, 0.74947, 0, 0, 0.38865],
      "42": [0, 0.62119, 0, 0, 0.27764],
      "43": [0.08319, 0.58283, 0, 0, 0.75623],
      "44": [0, 0.10803, 0, 0, 0.27764],
      "45": [0.08319, 0.58283, 0, 0, 0.75623],
      "46": [0, 0.10803, 0, 0, 0.27764],
      "47": [0.24982, 0.74947, 0, 0, 0.50181],
      "48": [0, 0.47534, 0, 0, 0.50181],
      "49": [0, 0.47534, 0, 0, 0.50181],
      "50": [0, 0.47534, 0, 0, 0.50181],
      "51": [0.18906, 0.47534, 0, 0, 0.50181],
      "52": [0.18906, 0.47534, 0, 0, 0.50181],
      "53": [0.18906, 0.47534, 0, 0, 0.50181],
      "54": [0, 0.69141, 0, 0, 0.50181],
      "55": [0.18906, 0.47534, 0, 0, 0.50181],
      "56": [0, 0.69141, 0, 0, 0.50181],
      "57": [0.18906, 0.47534, 0, 0, 0.50181],
      "58": [0, 0.47534, 0, 0, 0.21606],
      "59": [0.12604, 0.47534, 0, 0, 0.21606],
      "61": [-0.13099, 0.36866, 0, 0, 0.75623],
      "63": [0, 0.69141, 0, 0, 0.36245],
      "65": [0, 0.69141, 0, 0, 0.7176],
      "66": [0, 0.69141, 0, 0, 0.88397],
      "67": [0, 0.69141, 0, 0, 0.61254],
      "68": [0, 0.69141, 0, 0, 0.83158],
      "69": [0, 0.69141, 0, 0, 0.66278],
      "70": [0.12604, 0.69141, 0, 0, 0.61119],
      "71": [0, 0.69141, 0, 0, 0.78539],
      "72": [0.06302, 0.69141, 0, 0, 0.7203],
      "73": [0, 0.69141, 0, 0, 0.55448],
      "74": [0.12604, 0.69141, 0, 0, 0.55231],
      "75": [0, 0.69141, 0, 0, 0.66845],
      "76": [0, 0.69141, 0, 0, 0.66602],
      "77": [0, 0.69141, 0, 0, 1.04953],
      "78": [0, 0.69141, 0, 0, 0.83212],
      "79": [0, 0.69141, 0, 0, 0.82699],
      "80": [0.18906, 0.69141, 0, 0, 0.82753],
      "81": [0.03781, 0.69141, 0, 0, 0.82699],
      "82": [0, 0.69141, 0, 0, 0.82807],
      "83": [0, 0.69141, 0, 0, 0.82861],
      "84": [0, 0.69141, 0, 0, 0.66899],
      "85": [0, 0.69141, 0, 0, 0.64576],
      "86": [0, 0.69141, 0, 0, 0.83131],
      "87": [0, 0.69141, 0, 0, 1.04602],
      "88": [0, 0.69141, 0, 0, 0.71922],
      "89": [0.18906, 0.69141, 0, 0, 0.83293],
      "90": [0.12604, 0.69141, 0, 0, 0.60201],
      "91": [0.24982, 0.74947, 0, 0, 0.27764],
      "93": [0.24982, 0.74947, 0, 0, 0.27764],
      "94": [0, 0.69141, 0, 0, 0.49965],
      "97": [0, 0.47534, 0, 0, 0.50046],
      "98": [0, 0.69141, 0, 0, 0.51315],
      "99": [0, 0.47534, 0, 0, 0.38946],
      "100": [0, 0.62119, 0, 0, 0.49857],
      "101": [0, 0.47534, 0, 0, 0.40053],
      "102": [0.18906, 0.69141, 0, 0, 0.32626],
      "103": [0.18906, 0.47534, 0, 0, 0.5037],
      "104": [0.18906, 0.69141, 0, 0, 0.52126],
      "105": [0, 0.69141, 0, 0, 0.27899],
      "106": [0, 0.69141, 0, 0, 0.28088],
      "107": [0, 0.69141, 0, 0, 0.38946],
      "108": [0, 0.69141, 0, 0, 0.27953],
      "109": [0, 0.47534, 0, 0, 0.76676],
      "110": [0, 0.47534, 0, 0, 0.52666],
      "111": [0, 0.47534, 0, 0, 0.48885],
      "112": [0.18906, 0.52396, 0, 0, 0.50046],
      "113": [0.18906, 0.47534, 0, 0, 0.48912],
      "114": [0, 0.47534, 0, 0, 0.38919],
      "115": [0, 0.47534, 0, 0, 0.44266],
      "116": [0, 0.62119, 0, 0, 0.33301],
      "117": [0, 0.47534, 0, 0, 0.5172],
      "118": [0, 0.52396, 0, 0, 0.5118],
      "119": [0, 0.52396, 0, 0, 0.77351],
      "120": [0.18906, 0.47534, 0, 0, 0.38865],
      "121": [0.18906, 0.47534, 0, 0, 0.49884],
      "122": [0.18906, 0.47534, 0, 0, 0.39054],
      "160": [0, 0, 0, 0, 0.25],
      "8216": [0, 0.69141, 0, 0, 0.21471],
      "8217": [0, 0.69141, 0, 0, 0.21471],
      "58112": [0, 0.62119, 0, 0, 0.49749],
      "58113": [0, 0.62119, 0, 0, 0.4983],
      "58114": [0.18906, 0.69141, 0, 0, 0.33328],
      "58115": [0.18906, 0.69141, 0, 0, 0.32923],
      "58116": [0.18906, 0.47534, 0, 0, 0.50343],
      "58117": [0, 0.69141, 0, 0, 0.33301],
      "58118": [0, 0.62119, 0, 0, 0.33409],
      "58119": [0, 0.47534, 0, 0, 0.50073]
    },
    "Main-Bold": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0, 0, 0.35],
      "34": [0, 0.69444, 0, 0, 0.60278],
      "35": [0.19444, 0.69444, 0, 0, 0.95833],
      "36": [0.05556, 0.75, 0, 0, 0.575],
      "37": [0.05556, 0.75, 0, 0, 0.95833],
      "38": [0, 0.69444, 0, 0, 0.89444],
      "39": [0, 0.69444, 0, 0, 0.31944],
      "40": [0.25, 0.75, 0, 0, 0.44722],
      "41": [0.25, 0.75, 0, 0, 0.44722],
      "42": [0, 0.75, 0, 0, 0.575],
      "43": [0.13333, 0.63333, 0, 0, 0.89444],
      "44": [0.19444, 0.15556, 0, 0, 0.31944],
      "45": [0, 0.44444, 0, 0, 0.38333],
      "46": [0, 0.15556, 0, 0, 0.31944],
      "47": [0.25, 0.75, 0, 0, 0.575],
      "48": [0, 0.64444, 0, 0, 0.575],
      "49": [0, 0.64444, 0, 0, 0.575],
      "50": [0, 0.64444, 0, 0, 0.575],
      "51": [0, 0.64444, 0, 0, 0.575],
      "52": [0, 0.64444, 0, 0, 0.575],
      "53": [0, 0.64444, 0, 0, 0.575],
      "54": [0, 0.64444, 0, 0, 0.575],
      "55": [0, 0.64444, 0, 0, 0.575],
      "56": [0, 0.64444, 0, 0, 0.575],
      "57": [0, 0.64444, 0, 0, 0.575],
      "58": [0, 0.44444, 0, 0, 0.31944],
      "59": [0.19444, 0.44444, 0, 0, 0.31944],
      "60": [0.08556, 0.58556, 0, 0, 0.89444],
      "61": [-0.10889, 0.39111, 0, 0, 0.89444],
      "62": [0.08556, 0.58556, 0, 0, 0.89444],
      "63": [0, 0.69444, 0, 0, 0.54305],
      "64": [0, 0.69444, 0, 0, 0.89444],
      "65": [0, 0.68611, 0, 0, 0.86944],
      "66": [0, 0.68611, 0, 0, 0.81805],
      "67": [0, 0.68611, 0, 0, 0.83055],
      "68": [0, 0.68611, 0, 0, 0.88194],
      "69": [0, 0.68611, 0, 0, 0.75555],
      "70": [0, 0.68611, 0, 0, 0.72361],
      "71": [0, 0.68611, 0, 0, 0.90416],
      "72": [0, 0.68611, 0, 0, 0.9],
      "73": [0, 0.68611, 0, 0, 0.43611],
      "74": [0, 0.68611, 0, 0, 0.59444],
      "75": [0, 0.68611, 0, 0, 0.90138],
      "76": [0, 0.68611, 0, 0, 0.69166],
      "77": [0, 0.68611, 0, 0, 1.09166],
      "78": [0, 0.68611, 0, 0, 0.9],
      "79": [0, 0.68611, 0, 0, 0.86388],
      "80": [0, 0.68611, 0, 0, 0.78611],
      "81": [0.19444, 0.68611, 0, 0, 0.86388],
      "82": [0, 0.68611, 0, 0, 0.8625],
      "83": [0, 0.68611, 0, 0, 0.63889],
      "84": [0, 0.68611, 0, 0, 0.8],
      "85": [0, 0.68611, 0, 0, 0.88472],
      "86": [0, 0.68611, 0.01597, 0, 0.86944],
      "87": [0, 0.68611, 0.01597, 0, 1.18888],
      "88": [0, 0.68611, 0, 0, 0.86944],
      "89": [0, 0.68611, 0.02875, 0, 0.86944],
      "90": [0, 0.68611, 0, 0, 0.70277],
      "91": [0.25, 0.75, 0, 0, 0.31944],
      "92": [0.25, 0.75, 0, 0, 0.575],
      "93": [0.25, 0.75, 0, 0, 0.31944],
      "94": [0, 0.69444, 0, 0, 0.575],
      "95": [0.31, 0.13444, 0.03194, 0, 0.575],
      "97": [0, 0.44444, 0, 0, 0.55902],
      "98": [0, 0.69444, 0, 0, 0.63889],
      "99": [0, 0.44444, 0, 0, 0.51111],
      "100": [0, 0.69444, 0, 0, 0.63889],
      "101": [0, 0.44444, 0, 0, 0.52708],
      "102": [0, 0.69444, 0.10903, 0, 0.35139],
      "103": [0.19444, 0.44444, 0.01597, 0, 0.575],
      "104": [0, 0.69444, 0, 0, 0.63889],
      "105": [0, 0.69444, 0, 0, 0.31944],
      "106": [0.19444, 0.69444, 0, 0, 0.35139],
      "107": [0, 0.69444, 0, 0, 0.60694],
      "108": [0, 0.69444, 0, 0, 0.31944],
      "109": [0, 0.44444, 0, 0, 0.95833],
      "110": [0, 0.44444, 0, 0, 0.63889],
      "111": [0, 0.44444, 0, 0, 0.575],
      "112": [0.19444, 0.44444, 0, 0, 0.63889],
      "113": [0.19444, 0.44444, 0, 0, 0.60694],
      "114": [0, 0.44444, 0, 0, 0.47361],
      "115": [0, 0.44444, 0, 0, 0.45361],
      "116": [0, 0.63492, 0, 0, 0.44722],
      "117": [0, 0.44444, 0, 0, 0.63889],
      "118": [0, 0.44444, 0.01597, 0, 0.60694],
      "119": [0, 0.44444, 0.01597, 0, 0.83055],
      "120": [0, 0.44444, 0, 0, 0.60694],
      "121": [0.19444, 0.44444, 0.01597, 0, 0.60694],
      "122": [0, 0.44444, 0, 0, 0.51111],
      "123": [0.25, 0.75, 0, 0, 0.575],
      "124": [0.25, 0.75, 0, 0, 0.31944],
      "125": [0.25, 0.75, 0, 0, 0.575],
      "126": [0.35, 0.34444, 0, 0, 0.575],
      "160": [0, 0, 0, 0, 0.25],
      "163": [0, 0.69444, 0, 0, 0.86853],
      "168": [0, 0.69444, 0, 0, 0.575],
      "172": [0, 0.44444, 0, 0, 0.76666],
      "176": [0, 0.69444, 0, 0, 0.86944],
      "177": [0.13333, 0.63333, 0, 0, 0.89444],
      "184": [0.17014, 0, 0, 0, 0.51111],
      "198": [0, 0.68611, 0, 0, 1.04166],
      "215": [0.13333, 0.63333, 0, 0, 0.89444],
      "216": [0.04861, 0.73472, 0, 0, 0.89444],
      "223": [0, 0.69444, 0, 0, 0.59722],
      "230": [0, 0.44444, 0, 0, 0.83055],
      "247": [0.13333, 0.63333, 0, 0, 0.89444],
      "248": [0.09722, 0.54167, 0, 0, 0.575],
      "305": [0, 0.44444, 0, 0, 0.31944],
      "338": [0, 0.68611, 0, 0, 1.16944],
      "339": [0, 0.44444, 0, 0, 0.89444],
      "567": [0.19444, 0.44444, 0, 0, 0.35139],
      "710": [0, 0.69444, 0, 0, 0.575],
      "711": [0, 0.63194, 0, 0, 0.575],
      "713": [0, 0.59611, 0, 0, 0.575],
      "714": [0, 0.69444, 0, 0, 0.575],
      "715": [0, 0.69444, 0, 0, 0.575],
      "728": [0, 0.69444, 0, 0, 0.575],
      "729": [0, 0.69444, 0, 0, 0.31944],
      "730": [0, 0.69444, 0, 0, 0.86944],
      "732": [0, 0.69444, 0, 0, 0.575],
      "733": [0, 0.69444, 0, 0, 0.575],
      "915": [0, 0.68611, 0, 0, 0.69166],
      "916": [0, 0.68611, 0, 0, 0.95833],
      "920": [0, 0.68611, 0, 0, 0.89444],
      "923": [0, 0.68611, 0, 0, 0.80555],
      "926": [0, 0.68611, 0, 0, 0.76666],
      "928": [0, 0.68611, 0, 0, 0.9],
      "931": [0, 0.68611, 0, 0, 0.83055],
      "933": [0, 0.68611, 0, 0, 0.89444],
      "934": [0, 0.68611, 0, 0, 0.83055],
      "936": [0, 0.68611, 0, 0, 0.89444],
      "937": [0, 0.68611, 0, 0, 0.83055],
      "8211": [0, 0.44444, 0.03194, 0, 0.575],
      "8212": [0, 0.44444, 0.03194, 0, 1.14999],
      "8216": [0, 0.69444, 0, 0, 0.31944],
      "8217": [0, 0.69444, 0, 0, 0.31944],
      "8220": [0, 0.69444, 0, 0, 0.60278],
      "8221": [0, 0.69444, 0, 0, 0.60278],
      "8224": [0.19444, 0.69444, 0, 0, 0.51111],
      "8225": [0.19444, 0.69444, 0, 0, 0.51111],
      "8242": [0, 0.55556, 0, 0, 0.34444],
      "8407": [0, 0.72444, 0.15486, 0, 0.575],
      "8463": [0, 0.69444, 0, 0, 0.66759],
      "8465": [0, 0.69444, 0, 0, 0.83055],
      "8467": [0, 0.69444, 0, 0, 0.47361],
      "8472": [0.19444, 0.44444, 0, 0, 0.74027],
      "8476": [0, 0.69444, 0, 0, 0.83055],
      "8501": [0, 0.69444, 0, 0, 0.70277],
      "8592": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8593": [0.19444, 0.69444, 0, 0, 0.575],
      "8594": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8595": [0.19444, 0.69444, 0, 0, 0.575],
      "8596": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8597": [0.25, 0.75, 0, 0, 0.575],
      "8598": [0.19444, 0.69444, 0, 0, 1.14999],
      "8599": [0.19444, 0.69444, 0, 0, 1.14999],
      "8600": [0.19444, 0.69444, 0, 0, 1.14999],
      "8601": [0.19444, 0.69444, 0, 0, 1.14999],
      "8636": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8637": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8640": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8641": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8656": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8657": [0.19444, 0.69444, 0, 0, 0.70277],
      "8658": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8659": [0.19444, 0.69444, 0, 0, 0.70277],
      "8660": [-0.10889, 0.39111, 0, 0, 1.14999],
      "8661": [0.25, 0.75, 0, 0, 0.70277],
      "8704": [0, 0.69444, 0, 0, 0.63889],
      "8706": [0, 0.69444, 0.06389, 0, 0.62847],
      "8707": [0, 0.69444, 0, 0, 0.63889],
      "8709": [0.05556, 0.75, 0, 0, 0.575],
      "8711": [0, 0.68611, 0, 0, 0.95833],
      "8712": [0.08556, 0.58556, 0, 0, 0.76666],
      "8715": [0.08556, 0.58556, 0, 0, 0.76666],
      "8722": [0.13333, 0.63333, 0, 0, 0.89444],
      "8723": [0.13333, 0.63333, 0, 0, 0.89444],
      "8725": [0.25, 0.75, 0, 0, 0.575],
      "8726": [0.25, 0.75, 0, 0, 0.575],
      "8727": [-0.02778, 0.47222, 0, 0, 0.575],
      "8728": [-0.02639, 0.47361, 0, 0, 0.575],
      "8729": [-0.02639, 0.47361, 0, 0, 0.575],
      "8730": [0.18, 0.82, 0, 0, 0.95833],
      "8733": [0, 0.44444, 0, 0, 0.89444],
      "8734": [0, 0.44444, 0, 0, 1.14999],
      "8736": [0, 0.69224, 0, 0, 0.72222],
      "8739": [0.25, 0.75, 0, 0, 0.31944],
      "8741": [0.25, 0.75, 0, 0, 0.575],
      "8743": [0, 0.55556, 0, 0, 0.76666],
      "8744": [0, 0.55556, 0, 0, 0.76666],
      "8745": [0, 0.55556, 0, 0, 0.76666],
      "8746": [0, 0.55556, 0, 0, 0.76666],
      "8747": [0.19444, 0.69444, 0.12778, 0, 0.56875],
      "8764": [-0.10889, 0.39111, 0, 0, 0.89444],
      "8768": [0.19444, 0.69444, 0, 0, 0.31944],
      "8771": [222e-5, 0.50222, 0, 0, 0.89444],
      "8773": [0.027, 0.638, 0, 0, 0.894],
      "8776": [0.02444, 0.52444, 0, 0, 0.89444],
      "8781": [222e-5, 0.50222, 0, 0, 0.89444],
      "8801": [222e-5, 0.50222, 0, 0, 0.89444],
      "8804": [0.19667, 0.69667, 0, 0, 0.89444],
      "8805": [0.19667, 0.69667, 0, 0, 0.89444],
      "8810": [0.08556, 0.58556, 0, 0, 1.14999],
      "8811": [0.08556, 0.58556, 0, 0, 1.14999],
      "8826": [0.08556, 0.58556, 0, 0, 0.89444],
      "8827": [0.08556, 0.58556, 0, 0, 0.89444],
      "8834": [0.08556, 0.58556, 0, 0, 0.89444],
      "8835": [0.08556, 0.58556, 0, 0, 0.89444],
      "8838": [0.19667, 0.69667, 0, 0, 0.89444],
      "8839": [0.19667, 0.69667, 0, 0, 0.89444],
      "8846": [0, 0.55556, 0, 0, 0.76666],
      "8849": [0.19667, 0.69667, 0, 0, 0.89444],
      "8850": [0.19667, 0.69667, 0, 0, 0.89444],
      "8851": [0, 0.55556, 0, 0, 0.76666],
      "8852": [0, 0.55556, 0, 0, 0.76666],
      "8853": [0.13333, 0.63333, 0, 0, 0.89444],
      "8854": [0.13333, 0.63333, 0, 0, 0.89444],
      "8855": [0.13333, 0.63333, 0, 0, 0.89444],
      "8856": [0.13333, 0.63333, 0, 0, 0.89444],
      "8857": [0.13333, 0.63333, 0, 0, 0.89444],
      "8866": [0, 0.69444, 0, 0, 0.70277],
      "8867": [0, 0.69444, 0, 0, 0.70277],
      "8868": [0, 0.69444, 0, 0, 0.89444],
      "8869": [0, 0.69444, 0, 0, 0.89444],
      "8900": [-0.02639, 0.47361, 0, 0, 0.575],
      "8901": [-0.02639, 0.47361, 0, 0, 0.31944],
      "8902": [-0.02778, 0.47222, 0, 0, 0.575],
      "8968": [0.25, 0.75, 0, 0, 0.51111],
      "8969": [0.25, 0.75, 0, 0, 0.51111],
      "8970": [0.25, 0.75, 0, 0, 0.51111],
      "8971": [0.25, 0.75, 0, 0, 0.51111],
      "8994": [-0.13889, 0.36111, 0, 0, 1.14999],
      "8995": [-0.13889, 0.36111, 0, 0, 1.14999],
      "9651": [0.19444, 0.69444, 0, 0, 1.02222],
      "9657": [-0.02778, 0.47222, 0, 0, 0.575],
      "9661": [0.19444, 0.69444, 0, 0, 1.02222],
      "9667": [-0.02778, 0.47222, 0, 0, 0.575],
      "9711": [0.19444, 0.69444, 0, 0, 1.14999],
      "9824": [0.12963, 0.69444, 0, 0, 0.89444],
      "9825": [0.12963, 0.69444, 0, 0, 0.89444],
      "9826": [0.12963, 0.69444, 0, 0, 0.89444],
      "9827": [0.12963, 0.69444, 0, 0, 0.89444],
      "9837": [0, 0.75, 0, 0, 0.44722],
      "9838": [0.19444, 0.69444, 0, 0, 0.44722],
      "9839": [0.19444, 0.69444, 0, 0, 0.44722],
      "10216": [0.25, 0.75, 0, 0, 0.44722],
      "10217": [0.25, 0.75, 0, 0, 0.44722],
      "10815": [0, 0.68611, 0, 0, 0.9],
      "10927": [0.19667, 0.69667, 0, 0, 0.89444],
      "10928": [0.19667, 0.69667, 0, 0, 0.89444],
      "57376": [0.19444, 0.69444, 0, 0, 0]
    },
    "Main-BoldItalic": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0.11417, 0, 0.38611],
      "34": [0, 0.69444, 0.07939, 0, 0.62055],
      "35": [0.19444, 0.69444, 0.06833, 0, 0.94444],
      "37": [0.05556, 0.75, 0.12861, 0, 0.94444],
      "38": [0, 0.69444, 0.08528, 0, 0.88555],
      "39": [0, 0.69444, 0.12945, 0, 0.35555],
      "40": [0.25, 0.75, 0.15806, 0, 0.47333],
      "41": [0.25, 0.75, 0.03306, 0, 0.47333],
      "42": [0, 0.75, 0.14333, 0, 0.59111],
      "43": [0.10333, 0.60333, 0.03306, 0, 0.88555],
      "44": [0.19444, 0.14722, 0, 0, 0.35555],
      "45": [0, 0.44444, 0.02611, 0, 0.41444],
      "46": [0, 0.14722, 0, 0, 0.35555],
      "47": [0.25, 0.75, 0.15806, 0, 0.59111],
      "48": [0, 0.64444, 0.13167, 0, 0.59111],
      "49": [0, 0.64444, 0.13167, 0, 0.59111],
      "50": [0, 0.64444, 0.13167, 0, 0.59111],
      "51": [0, 0.64444, 0.13167, 0, 0.59111],
      "52": [0.19444, 0.64444, 0.13167, 0, 0.59111],
      "53": [0, 0.64444, 0.13167, 0, 0.59111],
      "54": [0, 0.64444, 0.13167, 0, 0.59111],
      "55": [0.19444, 0.64444, 0.13167, 0, 0.59111],
      "56": [0, 0.64444, 0.13167, 0, 0.59111],
      "57": [0, 0.64444, 0.13167, 0, 0.59111],
      "58": [0, 0.44444, 0.06695, 0, 0.35555],
      "59": [0.19444, 0.44444, 0.06695, 0, 0.35555],
      "61": [-0.10889, 0.39111, 0.06833, 0, 0.88555],
      "63": [0, 0.69444, 0.11472, 0, 0.59111],
      "64": [0, 0.69444, 0.09208, 0, 0.88555],
      "65": [0, 0.68611, 0, 0, 0.86555],
      "66": [0, 0.68611, 0.0992, 0, 0.81666],
      "67": [0, 0.68611, 0.14208, 0, 0.82666],
      "68": [0, 0.68611, 0.09062, 0, 0.87555],
      "69": [0, 0.68611, 0.11431, 0, 0.75666],
      "70": [0, 0.68611, 0.12903, 0, 0.72722],
      "71": [0, 0.68611, 0.07347, 0, 0.89527],
      "72": [0, 0.68611, 0.17208, 0, 0.8961],
      "73": [0, 0.68611, 0.15681, 0, 0.47166],
      "74": [0, 0.68611, 0.145, 0, 0.61055],
      "75": [0, 0.68611, 0.14208, 0, 0.89499],
      "76": [0, 0.68611, 0, 0, 0.69777],
      "77": [0, 0.68611, 0.17208, 0, 1.07277],
      "78": [0, 0.68611, 0.17208, 0, 0.8961],
      "79": [0, 0.68611, 0.09062, 0, 0.85499],
      "80": [0, 0.68611, 0.0992, 0, 0.78721],
      "81": [0.19444, 0.68611, 0.09062, 0, 0.85499],
      "82": [0, 0.68611, 0.02559, 0, 0.85944],
      "83": [0, 0.68611, 0.11264, 0, 0.64999],
      "84": [0, 0.68611, 0.12903, 0, 0.7961],
      "85": [0, 0.68611, 0.17208, 0, 0.88083],
      "86": [0, 0.68611, 0.18625, 0, 0.86555],
      "87": [0, 0.68611, 0.18625, 0, 1.15999],
      "88": [0, 0.68611, 0.15681, 0, 0.86555],
      "89": [0, 0.68611, 0.19803, 0, 0.86555],
      "90": [0, 0.68611, 0.14208, 0, 0.70888],
      "91": [0.25, 0.75, 0.1875, 0, 0.35611],
      "93": [0.25, 0.75, 0.09972, 0, 0.35611],
      "94": [0, 0.69444, 0.06709, 0, 0.59111],
      "95": [0.31, 0.13444, 0.09811, 0, 0.59111],
      "97": [0, 0.44444, 0.09426, 0, 0.59111],
      "98": [0, 0.69444, 0.07861, 0, 0.53222],
      "99": [0, 0.44444, 0.05222, 0, 0.53222],
      "100": [0, 0.69444, 0.10861, 0, 0.59111],
      "101": [0, 0.44444, 0.085, 0, 0.53222],
      "102": [0.19444, 0.69444, 0.21778, 0, 0.4],
      "103": [0.19444, 0.44444, 0.105, 0, 0.53222],
      "104": [0, 0.69444, 0.09426, 0, 0.59111],
      "105": [0, 0.69326, 0.11387, 0, 0.35555],
      "106": [0.19444, 0.69326, 0.1672, 0, 0.35555],
      "107": [0, 0.69444, 0.11111, 0, 0.53222],
      "108": [0, 0.69444, 0.10861, 0, 0.29666],
      "109": [0, 0.44444, 0.09426, 0, 0.94444],
      "110": [0, 0.44444, 0.09426, 0, 0.64999],
      "111": [0, 0.44444, 0.07861, 0, 0.59111],
      "112": [0.19444, 0.44444, 0.07861, 0, 0.59111],
      "113": [0.19444, 0.44444, 0.105, 0, 0.53222],
      "114": [0, 0.44444, 0.11111, 0, 0.50167],
      "115": [0, 0.44444, 0.08167, 0, 0.48694],
      "116": [0, 0.63492, 0.09639, 0, 0.385],
      "117": [0, 0.44444, 0.09426, 0, 0.62055],
      "118": [0, 0.44444, 0.11111, 0, 0.53222],
      "119": [0, 0.44444, 0.11111, 0, 0.76777],
      "120": [0, 0.44444, 0.12583, 0, 0.56055],
      "121": [0.19444, 0.44444, 0.105, 0, 0.56166],
      "122": [0, 0.44444, 0.13889, 0, 0.49055],
      "126": [0.35, 0.34444, 0.11472, 0, 0.59111],
      "160": [0, 0, 0, 0, 0.25],
      "168": [0, 0.69444, 0.11473, 0, 0.59111],
      "176": [0, 0.69444, 0, 0, 0.94888],
      "184": [0.17014, 0, 0, 0, 0.53222],
      "198": [0, 0.68611, 0.11431, 0, 1.02277],
      "216": [0.04861, 0.73472, 0.09062, 0, 0.88555],
      "223": [0.19444, 0.69444, 0.09736, 0, 0.665],
      "230": [0, 0.44444, 0.085, 0, 0.82666],
      "248": [0.09722, 0.54167, 0.09458, 0, 0.59111],
      "305": [0, 0.44444, 0.09426, 0, 0.35555],
      "338": [0, 0.68611, 0.11431, 0, 1.14054],
      "339": [0, 0.44444, 0.085, 0, 0.82666],
      "567": [0.19444, 0.44444, 0.04611, 0, 0.385],
      "710": [0, 0.69444, 0.06709, 0, 0.59111],
      "711": [0, 0.63194, 0.08271, 0, 0.59111],
      "713": [0, 0.59444, 0.10444, 0, 0.59111],
      "714": [0, 0.69444, 0.08528, 0, 0.59111],
      "715": [0, 0.69444, 0, 0, 0.59111],
      "728": [0, 0.69444, 0.10333, 0, 0.59111],
      "729": [0, 0.69444, 0.12945, 0, 0.35555],
      "730": [0, 0.69444, 0, 0, 0.94888],
      "732": [0, 0.69444, 0.11472, 0, 0.59111],
      "733": [0, 0.69444, 0.11472, 0, 0.59111],
      "915": [0, 0.68611, 0.12903, 0, 0.69777],
      "916": [0, 0.68611, 0, 0, 0.94444],
      "920": [0, 0.68611, 0.09062, 0, 0.88555],
      "923": [0, 0.68611, 0, 0, 0.80666],
      "926": [0, 0.68611, 0.15092, 0, 0.76777],
      "928": [0, 0.68611, 0.17208, 0, 0.8961],
      "931": [0, 0.68611, 0.11431, 0, 0.82666],
      "933": [0, 0.68611, 0.10778, 0, 0.88555],
      "934": [0, 0.68611, 0.05632, 0, 0.82666],
      "936": [0, 0.68611, 0.10778, 0, 0.88555],
      "937": [0, 0.68611, 0.0992, 0, 0.82666],
      "8211": [0, 0.44444, 0.09811, 0, 0.59111],
      "8212": [0, 0.44444, 0.09811, 0, 1.18221],
      "8216": [0, 0.69444, 0.12945, 0, 0.35555],
      "8217": [0, 0.69444, 0.12945, 0, 0.35555],
      "8220": [0, 0.69444, 0.16772, 0, 0.62055],
      "8221": [0, 0.69444, 0.07939, 0, 0.62055]
    },
    "Main-Italic": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0.12417, 0, 0.30667],
      "34": [0, 0.69444, 0.06961, 0, 0.51444],
      "35": [0.19444, 0.69444, 0.06616, 0, 0.81777],
      "37": [0.05556, 0.75, 0.13639, 0, 0.81777],
      "38": [0, 0.69444, 0.09694, 0, 0.76666],
      "39": [0, 0.69444, 0.12417, 0, 0.30667],
      "40": [0.25, 0.75, 0.16194, 0, 0.40889],
      "41": [0.25, 0.75, 0.03694, 0, 0.40889],
      "42": [0, 0.75, 0.14917, 0, 0.51111],
      "43": [0.05667, 0.56167, 0.03694, 0, 0.76666],
      "44": [0.19444, 0.10556, 0, 0, 0.30667],
      "45": [0, 0.43056, 0.02826, 0, 0.35778],
      "46": [0, 0.10556, 0, 0, 0.30667],
      "47": [0.25, 0.75, 0.16194, 0, 0.51111],
      "48": [0, 0.64444, 0.13556, 0, 0.51111],
      "49": [0, 0.64444, 0.13556, 0, 0.51111],
      "50": [0, 0.64444, 0.13556, 0, 0.51111],
      "51": [0, 0.64444, 0.13556, 0, 0.51111],
      "52": [0.19444, 0.64444, 0.13556, 0, 0.51111],
      "53": [0, 0.64444, 0.13556, 0, 0.51111],
      "54": [0, 0.64444, 0.13556, 0, 0.51111],
      "55": [0.19444, 0.64444, 0.13556, 0, 0.51111],
      "56": [0, 0.64444, 0.13556, 0, 0.51111],
      "57": [0, 0.64444, 0.13556, 0, 0.51111],
      "58": [0, 0.43056, 0.0582, 0, 0.30667],
      "59": [0.19444, 0.43056, 0.0582, 0, 0.30667],
      "61": [-0.13313, 0.36687, 0.06616, 0, 0.76666],
      "63": [0, 0.69444, 0.1225, 0, 0.51111],
      "64": [0, 0.69444, 0.09597, 0, 0.76666],
      "65": [0, 0.68333, 0, 0, 0.74333],
      "66": [0, 0.68333, 0.10257, 0, 0.70389],
      "67": [0, 0.68333, 0.14528, 0, 0.71555],
      "68": [0, 0.68333, 0.09403, 0, 0.755],
      "69": [0, 0.68333, 0.12028, 0, 0.67833],
      "70": [0, 0.68333, 0.13305, 0, 0.65277],
      "71": [0, 0.68333, 0.08722, 0, 0.77361],
      "72": [0, 0.68333, 0.16389, 0, 0.74333],
      "73": [0, 0.68333, 0.15806, 0, 0.38555],
      "74": [0, 0.68333, 0.14028, 0, 0.525],
      "75": [0, 0.68333, 0.14528, 0, 0.76888],
      "76": [0, 0.68333, 0, 0, 0.62722],
      "77": [0, 0.68333, 0.16389, 0, 0.89666],
      "78": [0, 0.68333, 0.16389, 0, 0.74333],
      "79": [0, 0.68333, 0.09403, 0, 0.76666],
      "80": [0, 0.68333, 0.10257, 0, 0.67833],
      "81": [0.19444, 0.68333, 0.09403, 0, 0.76666],
      "82": [0, 0.68333, 0.03868, 0, 0.72944],
      "83": [0, 0.68333, 0.11972, 0, 0.56222],
      "84": [0, 0.68333, 0.13305, 0, 0.71555],
      "85": [0, 0.68333, 0.16389, 0, 0.74333],
      "86": [0, 0.68333, 0.18361, 0, 0.74333],
      "87": [0, 0.68333, 0.18361, 0, 0.99888],
      "88": [0, 0.68333, 0.15806, 0, 0.74333],
      "89": [0, 0.68333, 0.19383, 0, 0.74333],
      "90": [0, 0.68333, 0.14528, 0, 0.61333],
      "91": [0.25, 0.75, 0.1875, 0, 0.30667],
      "93": [0.25, 0.75, 0.10528, 0, 0.30667],
      "94": [0, 0.69444, 0.06646, 0, 0.51111],
      "95": [0.31, 0.12056, 0.09208, 0, 0.51111],
      "97": [0, 0.43056, 0.07671, 0, 0.51111],
      "98": [0, 0.69444, 0.06312, 0, 0.46],
      "99": [0, 0.43056, 0.05653, 0, 0.46],
      "100": [0, 0.69444, 0.10333, 0, 0.51111],
      "101": [0, 0.43056, 0.07514, 0, 0.46],
      "102": [0.19444, 0.69444, 0.21194, 0, 0.30667],
      "103": [0.19444, 0.43056, 0.08847, 0, 0.46],
      "104": [0, 0.69444, 0.07671, 0, 0.51111],
      "105": [0, 0.65536, 0.1019, 0, 0.30667],
      "106": [0.19444, 0.65536, 0.14467, 0, 0.30667],
      "107": [0, 0.69444, 0.10764, 0, 0.46],
      "108": [0, 0.69444, 0.10333, 0, 0.25555],
      "109": [0, 0.43056, 0.07671, 0, 0.81777],
      "110": [0, 0.43056, 0.07671, 0, 0.56222],
      "111": [0, 0.43056, 0.06312, 0, 0.51111],
      "112": [0.19444, 0.43056, 0.06312, 0, 0.51111],
      "113": [0.19444, 0.43056, 0.08847, 0, 0.46],
      "114": [0, 0.43056, 0.10764, 0, 0.42166],
      "115": [0, 0.43056, 0.08208, 0, 0.40889],
      "116": [0, 0.61508, 0.09486, 0, 0.33222],
      "117": [0, 0.43056, 0.07671, 0, 0.53666],
      "118": [0, 0.43056, 0.10764, 0, 0.46],
      "119": [0, 0.43056, 0.10764, 0, 0.66444],
      "120": [0, 0.43056, 0.12042, 0, 0.46389],
      "121": [0.19444, 0.43056, 0.08847, 0, 0.48555],
      "122": [0, 0.43056, 0.12292, 0, 0.40889],
      "126": [0.35, 0.31786, 0.11585, 0, 0.51111],
      "160": [0, 0, 0, 0, 0.25],
      "168": [0, 0.66786, 0.10474, 0, 0.51111],
      "176": [0, 0.69444, 0, 0, 0.83129],
      "184": [0.17014, 0, 0, 0, 0.46],
      "198": [0, 0.68333, 0.12028, 0, 0.88277],
      "216": [0.04861, 0.73194, 0.09403, 0, 0.76666],
      "223": [0.19444, 0.69444, 0.10514, 0, 0.53666],
      "230": [0, 0.43056, 0.07514, 0, 0.71555],
      "248": [0.09722, 0.52778, 0.09194, 0, 0.51111],
      "338": [0, 0.68333, 0.12028, 0, 0.98499],
      "339": [0, 0.43056, 0.07514, 0, 0.71555],
      "710": [0, 0.69444, 0.06646, 0, 0.51111],
      "711": [0, 0.62847, 0.08295, 0, 0.51111],
      "713": [0, 0.56167, 0.10333, 0, 0.51111],
      "714": [0, 0.69444, 0.09694, 0, 0.51111],
      "715": [0, 0.69444, 0, 0, 0.51111],
      "728": [0, 0.69444, 0.10806, 0, 0.51111],
      "729": [0, 0.66786, 0.11752, 0, 0.30667],
      "730": [0, 0.69444, 0, 0, 0.83129],
      "732": [0, 0.66786, 0.11585, 0, 0.51111],
      "733": [0, 0.69444, 0.1225, 0, 0.51111],
      "915": [0, 0.68333, 0.13305, 0, 0.62722],
      "916": [0, 0.68333, 0, 0, 0.81777],
      "920": [0, 0.68333, 0.09403, 0, 0.76666],
      "923": [0, 0.68333, 0, 0, 0.69222],
      "926": [0, 0.68333, 0.15294, 0, 0.66444],
      "928": [0, 0.68333, 0.16389, 0, 0.74333],
      "931": [0, 0.68333, 0.12028, 0, 0.71555],
      "933": [0, 0.68333, 0.11111, 0, 0.76666],
      "934": [0, 0.68333, 0.05986, 0, 0.71555],
      "936": [0, 0.68333, 0.11111, 0, 0.76666],
      "937": [0, 0.68333, 0.10257, 0, 0.71555],
      "8211": [0, 0.43056, 0.09208, 0, 0.51111],
      "8212": [0, 0.43056, 0.09208, 0, 1.02222],
      "8216": [0, 0.69444, 0.12417, 0, 0.30667],
      "8217": [0, 0.69444, 0.12417, 0, 0.30667],
      "8220": [0, 0.69444, 0.1685, 0, 0.51444],
      "8221": [0, 0.69444, 0.06961, 0, 0.51444],
      "8463": [0, 0.68889, 0, 0, 0.54028]
    },
    "Main-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0, 0, 0.27778],
      "34": [0, 0.69444, 0, 0, 0.5],
      "35": [0.19444, 0.69444, 0, 0, 0.83334],
      "36": [0.05556, 0.75, 0, 0, 0.5],
      "37": [0.05556, 0.75, 0, 0, 0.83334],
      "38": [0, 0.69444, 0, 0, 0.77778],
      "39": [0, 0.69444, 0, 0, 0.27778],
      "40": [0.25, 0.75, 0, 0, 0.38889],
      "41": [0.25, 0.75, 0, 0, 0.38889],
      "42": [0, 0.75, 0, 0, 0.5],
      "43": [0.08333, 0.58333, 0, 0, 0.77778],
      "44": [0.19444, 0.10556, 0, 0, 0.27778],
      "45": [0, 0.43056, 0, 0, 0.33333],
      "46": [0, 0.10556, 0, 0, 0.27778],
      "47": [0.25, 0.75, 0, 0, 0.5],
      "48": [0, 0.64444, 0, 0, 0.5],
      "49": [0, 0.64444, 0, 0, 0.5],
      "50": [0, 0.64444, 0, 0, 0.5],
      "51": [0, 0.64444, 0, 0, 0.5],
      "52": [0, 0.64444, 0, 0, 0.5],
      "53": [0, 0.64444, 0, 0, 0.5],
      "54": [0, 0.64444, 0, 0, 0.5],
      "55": [0, 0.64444, 0, 0, 0.5],
      "56": [0, 0.64444, 0, 0, 0.5],
      "57": [0, 0.64444, 0, 0, 0.5],
      "58": [0, 0.43056, 0, 0, 0.27778],
      "59": [0.19444, 0.43056, 0, 0, 0.27778],
      "60": [0.0391, 0.5391, 0, 0, 0.77778],
      "61": [-0.13313, 0.36687, 0, 0, 0.77778],
      "62": [0.0391, 0.5391, 0, 0, 0.77778],
      "63": [0, 0.69444, 0, 0, 0.47222],
      "64": [0, 0.69444, 0, 0, 0.77778],
      "65": [0, 0.68333, 0, 0, 0.75],
      "66": [0, 0.68333, 0, 0, 0.70834],
      "67": [0, 0.68333, 0, 0, 0.72222],
      "68": [0, 0.68333, 0, 0, 0.76389],
      "69": [0, 0.68333, 0, 0, 0.68056],
      "70": [0, 0.68333, 0, 0, 0.65278],
      "71": [0, 0.68333, 0, 0, 0.78472],
      "72": [0, 0.68333, 0, 0, 0.75],
      "73": [0, 0.68333, 0, 0, 0.36111],
      "74": [0, 0.68333, 0, 0, 0.51389],
      "75": [0, 0.68333, 0, 0, 0.77778],
      "76": [0, 0.68333, 0, 0, 0.625],
      "77": [0, 0.68333, 0, 0, 0.91667],
      "78": [0, 0.68333, 0, 0, 0.75],
      "79": [0, 0.68333, 0, 0, 0.77778],
      "80": [0, 0.68333, 0, 0, 0.68056],
      "81": [0.19444, 0.68333, 0, 0, 0.77778],
      "82": [0, 0.68333, 0, 0, 0.73611],
      "83": [0, 0.68333, 0, 0, 0.55556],
      "84": [0, 0.68333, 0, 0, 0.72222],
      "85": [0, 0.68333, 0, 0, 0.75],
      "86": [0, 0.68333, 0.01389, 0, 0.75],
      "87": [0, 0.68333, 0.01389, 0, 1.02778],
      "88": [0, 0.68333, 0, 0, 0.75],
      "89": [0, 0.68333, 0.025, 0, 0.75],
      "90": [0, 0.68333, 0, 0, 0.61111],
      "91": [0.25, 0.75, 0, 0, 0.27778],
      "92": [0.25, 0.75, 0, 0, 0.5],
      "93": [0.25, 0.75, 0, 0, 0.27778],
      "94": [0, 0.69444, 0, 0, 0.5],
      "95": [0.31, 0.12056, 0.02778, 0, 0.5],
      "97": [0, 0.43056, 0, 0, 0.5],
      "98": [0, 0.69444, 0, 0, 0.55556],
      "99": [0, 0.43056, 0, 0, 0.44445],
      "100": [0, 0.69444, 0, 0, 0.55556],
      "101": [0, 0.43056, 0, 0, 0.44445],
      "102": [0, 0.69444, 0.07778, 0, 0.30556],
      "103": [0.19444, 0.43056, 0.01389, 0, 0.5],
      "104": [0, 0.69444, 0, 0, 0.55556],
      "105": [0, 0.66786, 0, 0, 0.27778],
      "106": [0.19444, 0.66786, 0, 0, 0.30556],
      "107": [0, 0.69444, 0, 0, 0.52778],
      "108": [0, 0.69444, 0, 0, 0.27778],
      "109": [0, 0.43056, 0, 0, 0.83334],
      "110": [0, 0.43056, 0, 0, 0.55556],
      "111": [0, 0.43056, 0, 0, 0.5],
      "112": [0.19444, 0.43056, 0, 0, 0.55556],
      "113": [0.19444, 0.43056, 0, 0, 0.52778],
      "114": [0, 0.43056, 0, 0, 0.39167],
      "115": [0, 0.43056, 0, 0, 0.39445],
      "116": [0, 0.61508, 0, 0, 0.38889],
      "117": [0, 0.43056, 0, 0, 0.55556],
      "118": [0, 0.43056, 0.01389, 0, 0.52778],
      "119": [0, 0.43056, 0.01389, 0, 0.72222],
      "120": [0, 0.43056, 0, 0, 0.52778],
      "121": [0.19444, 0.43056, 0.01389, 0, 0.52778],
      "122": [0, 0.43056, 0, 0, 0.44445],
      "123": [0.25, 0.75, 0, 0, 0.5],
      "124": [0.25, 0.75, 0, 0, 0.27778],
      "125": [0.25, 0.75, 0, 0, 0.5],
      "126": [0.35, 0.31786, 0, 0, 0.5],
      "160": [0, 0, 0, 0, 0.25],
      "163": [0, 0.69444, 0, 0, 0.76909],
      "167": [0.19444, 0.69444, 0, 0, 0.44445],
      "168": [0, 0.66786, 0, 0, 0.5],
      "172": [0, 0.43056, 0, 0, 0.66667],
      "176": [0, 0.69444, 0, 0, 0.75],
      "177": [0.08333, 0.58333, 0, 0, 0.77778],
      "182": [0.19444, 0.69444, 0, 0, 0.61111],
      "184": [0.17014, 0, 0, 0, 0.44445],
      "198": [0, 0.68333, 0, 0, 0.90278],
      "215": [0.08333, 0.58333, 0, 0, 0.77778],
      "216": [0.04861, 0.73194, 0, 0, 0.77778],
      "223": [0, 0.69444, 0, 0, 0.5],
      "230": [0, 0.43056, 0, 0, 0.72222],
      "247": [0.08333, 0.58333, 0, 0, 0.77778],
      "248": [0.09722, 0.52778, 0, 0, 0.5],
      "305": [0, 0.43056, 0, 0, 0.27778],
      "338": [0, 0.68333, 0, 0, 1.01389],
      "339": [0, 0.43056, 0, 0, 0.77778],
      "567": [0.19444, 0.43056, 0, 0, 0.30556],
      "710": [0, 0.69444, 0, 0, 0.5],
      "711": [0, 0.62847, 0, 0, 0.5],
      "713": [0, 0.56778, 0, 0, 0.5],
      "714": [0, 0.69444, 0, 0, 0.5],
      "715": [0, 0.69444, 0, 0, 0.5],
      "728": [0, 0.69444, 0, 0, 0.5],
      "729": [0, 0.66786, 0, 0, 0.27778],
      "730": [0, 0.69444, 0, 0, 0.75],
      "732": [0, 0.66786, 0, 0, 0.5],
      "733": [0, 0.69444, 0, 0, 0.5],
      "915": [0, 0.68333, 0, 0, 0.625],
      "916": [0, 0.68333, 0, 0, 0.83334],
      "920": [0, 0.68333, 0, 0, 0.77778],
      "923": [0, 0.68333, 0, 0, 0.69445],
      "926": [0, 0.68333, 0, 0, 0.66667],
      "928": [0, 0.68333, 0, 0, 0.75],
      "931": [0, 0.68333, 0, 0, 0.72222],
      "933": [0, 0.68333, 0, 0, 0.77778],
      "934": [0, 0.68333, 0, 0, 0.72222],
      "936": [0, 0.68333, 0, 0, 0.77778],
      "937": [0, 0.68333, 0, 0, 0.72222],
      "8211": [0, 0.43056, 0.02778, 0, 0.5],
      "8212": [0, 0.43056, 0.02778, 0, 1],
      "8216": [0, 0.69444, 0, 0, 0.27778],
      "8217": [0, 0.69444, 0, 0, 0.27778],
      "8220": [0, 0.69444, 0, 0, 0.5],
      "8221": [0, 0.69444, 0, 0, 0.5],
      "8224": [0.19444, 0.69444, 0, 0, 0.44445],
      "8225": [0.19444, 0.69444, 0, 0, 0.44445],
      "8230": [0, 0.123, 0, 0, 1.172],
      "8242": [0, 0.55556, 0, 0, 0.275],
      "8407": [0, 0.71444, 0.15382, 0, 0.5],
      "8463": [0, 0.68889, 0, 0, 0.54028],
      "8465": [0, 0.69444, 0, 0, 0.72222],
      "8467": [0, 0.69444, 0, 0.11111, 0.41667],
      "8472": [0.19444, 0.43056, 0, 0.11111, 0.63646],
      "8476": [0, 0.69444, 0, 0, 0.72222],
      "8501": [0, 0.69444, 0, 0, 0.61111],
      "8592": [-0.13313, 0.36687, 0, 0, 1],
      "8593": [0.19444, 0.69444, 0, 0, 0.5],
      "8594": [-0.13313, 0.36687, 0, 0, 1],
      "8595": [0.19444, 0.69444, 0, 0, 0.5],
      "8596": [-0.13313, 0.36687, 0, 0, 1],
      "8597": [0.25, 0.75, 0, 0, 0.5],
      "8598": [0.19444, 0.69444, 0, 0, 1],
      "8599": [0.19444, 0.69444, 0, 0, 1],
      "8600": [0.19444, 0.69444, 0, 0, 1],
      "8601": [0.19444, 0.69444, 0, 0, 1],
      "8614": [0.011, 0.511, 0, 0, 1],
      "8617": [0.011, 0.511, 0, 0, 1.126],
      "8618": [0.011, 0.511, 0, 0, 1.126],
      "8636": [-0.13313, 0.36687, 0, 0, 1],
      "8637": [-0.13313, 0.36687, 0, 0, 1],
      "8640": [-0.13313, 0.36687, 0, 0, 1],
      "8641": [-0.13313, 0.36687, 0, 0, 1],
      "8652": [0.011, 0.671, 0, 0, 1],
      "8656": [-0.13313, 0.36687, 0, 0, 1],
      "8657": [0.19444, 0.69444, 0, 0, 0.61111],
      "8658": [-0.13313, 0.36687, 0, 0, 1],
      "8659": [0.19444, 0.69444, 0, 0, 0.61111],
      "8660": [-0.13313, 0.36687, 0, 0, 1],
      "8661": [0.25, 0.75, 0, 0, 0.61111],
      "8704": [0, 0.69444, 0, 0, 0.55556],
      "8706": [0, 0.69444, 0.05556, 0.08334, 0.5309],
      "8707": [0, 0.69444, 0, 0, 0.55556],
      "8709": [0.05556, 0.75, 0, 0, 0.5],
      "8711": [0, 0.68333, 0, 0, 0.83334],
      "8712": [0.0391, 0.5391, 0, 0, 0.66667],
      "8715": [0.0391, 0.5391, 0, 0, 0.66667],
      "8722": [0.08333, 0.58333, 0, 0, 0.77778],
      "8723": [0.08333, 0.58333, 0, 0, 0.77778],
      "8725": [0.25, 0.75, 0, 0, 0.5],
      "8726": [0.25, 0.75, 0, 0, 0.5],
      "8727": [-0.03472, 0.46528, 0, 0, 0.5],
      "8728": [-0.05555, 0.44445, 0, 0, 0.5],
      "8729": [-0.05555, 0.44445, 0, 0, 0.5],
      "8730": [0.2, 0.8, 0, 0, 0.83334],
      "8733": [0, 0.43056, 0, 0, 0.77778],
      "8734": [0, 0.43056, 0, 0, 1],
      "8736": [0, 0.69224, 0, 0, 0.72222],
      "8739": [0.25, 0.75, 0, 0, 0.27778],
      "8741": [0.25, 0.75, 0, 0, 0.5],
      "8743": [0, 0.55556, 0, 0, 0.66667],
      "8744": [0, 0.55556, 0, 0, 0.66667],
      "8745": [0, 0.55556, 0, 0, 0.66667],
      "8746": [0, 0.55556, 0, 0, 0.66667],
      "8747": [0.19444, 0.69444, 0.11111, 0, 0.41667],
      "8764": [-0.13313, 0.36687, 0, 0, 0.77778],
      "8768": [0.19444, 0.69444, 0, 0, 0.27778],
      "8771": [-0.03625, 0.46375, 0, 0, 0.77778],
      "8773": [-0.022, 0.589, 0, 0, 0.778],
      "8776": [-0.01688, 0.48312, 0, 0, 0.77778],
      "8781": [-0.03625, 0.46375, 0, 0, 0.77778],
      "8784": [-0.133, 0.673, 0, 0, 0.778],
      "8801": [-0.03625, 0.46375, 0, 0, 0.77778],
      "8804": [0.13597, 0.63597, 0, 0, 0.77778],
      "8805": [0.13597, 0.63597, 0, 0, 0.77778],
      "8810": [0.0391, 0.5391, 0, 0, 1],
      "8811": [0.0391, 0.5391, 0, 0, 1],
      "8826": [0.0391, 0.5391, 0, 0, 0.77778],
      "8827": [0.0391, 0.5391, 0, 0, 0.77778],
      "8834": [0.0391, 0.5391, 0, 0, 0.77778],
      "8835": [0.0391, 0.5391, 0, 0, 0.77778],
      "8838": [0.13597, 0.63597, 0, 0, 0.77778],
      "8839": [0.13597, 0.63597, 0, 0, 0.77778],
      "8846": [0, 0.55556, 0, 0, 0.66667],
      "8849": [0.13597, 0.63597, 0, 0, 0.77778],
      "8850": [0.13597, 0.63597, 0, 0, 0.77778],
      "8851": [0, 0.55556, 0, 0, 0.66667],
      "8852": [0, 0.55556, 0, 0, 0.66667],
      "8853": [0.08333, 0.58333, 0, 0, 0.77778],
      "8854": [0.08333, 0.58333, 0, 0, 0.77778],
      "8855": [0.08333, 0.58333, 0, 0, 0.77778],
      "8856": [0.08333, 0.58333, 0, 0, 0.77778],
      "8857": [0.08333, 0.58333, 0, 0, 0.77778],
      "8866": [0, 0.69444, 0, 0, 0.61111],
      "8867": [0, 0.69444, 0, 0, 0.61111],
      "8868": [0, 0.69444, 0, 0, 0.77778],
      "8869": [0, 0.69444, 0, 0, 0.77778],
      "8872": [0.249, 0.75, 0, 0, 0.867],
      "8900": [-0.05555, 0.44445, 0, 0, 0.5],
      "8901": [-0.05555, 0.44445, 0, 0, 0.27778],
      "8902": [-0.03472, 0.46528, 0, 0, 0.5],
      "8904": [5e-3, 0.505, 0, 0, 0.9],
      "8942": [0.03, 0.903, 0, 0, 0.278],
      "8943": [-0.19, 0.313, 0, 0, 1.172],
      "8945": [-0.1, 0.823, 0, 0, 1.282],
      "8968": [0.25, 0.75, 0, 0, 0.44445],
      "8969": [0.25, 0.75, 0, 0, 0.44445],
      "8970": [0.25, 0.75, 0, 0, 0.44445],
      "8971": [0.25, 0.75, 0, 0, 0.44445],
      "8994": [-0.14236, 0.35764, 0, 0, 1],
      "8995": [-0.14236, 0.35764, 0, 0, 1],
      "9136": [0.244, 0.744, 0, 0, 0.412],
      "9137": [0.244, 0.745, 0, 0, 0.412],
      "9651": [0.19444, 0.69444, 0, 0, 0.88889],
      "9657": [-0.03472, 0.46528, 0, 0, 0.5],
      "9661": [0.19444, 0.69444, 0, 0, 0.88889],
      "9667": [-0.03472, 0.46528, 0, 0, 0.5],
      "9711": [0.19444, 0.69444, 0, 0, 1],
      "9824": [0.12963, 0.69444, 0, 0, 0.77778],
      "9825": [0.12963, 0.69444, 0, 0, 0.77778],
      "9826": [0.12963, 0.69444, 0, 0, 0.77778],
      "9827": [0.12963, 0.69444, 0, 0, 0.77778],
      "9837": [0, 0.75, 0, 0, 0.38889],
      "9838": [0.19444, 0.69444, 0, 0, 0.38889],
      "9839": [0.19444, 0.69444, 0, 0, 0.38889],
      "10216": [0.25, 0.75, 0, 0, 0.38889],
      "10217": [0.25, 0.75, 0, 0, 0.38889],
      "10222": [0.244, 0.744, 0, 0, 0.412],
      "10223": [0.244, 0.745, 0, 0, 0.412],
      "10229": [0.011, 0.511, 0, 0, 1.609],
      "10230": [0.011, 0.511, 0, 0, 1.638],
      "10231": [0.011, 0.511, 0, 0, 1.859],
      "10232": [0.024, 0.525, 0, 0, 1.609],
      "10233": [0.024, 0.525, 0, 0, 1.638],
      "10234": [0.024, 0.525, 0, 0, 1.858],
      "10236": [0.011, 0.511, 0, 0, 1.638],
      "10815": [0, 0.68333, 0, 0, 0.75],
      "10927": [0.13597, 0.63597, 0, 0, 0.77778],
      "10928": [0.13597, 0.63597, 0, 0, 0.77778],
      "57376": [0.19444, 0.69444, 0, 0, 0]
    },
    "Math-BoldItalic": {
      "32": [0, 0, 0, 0, 0.25],
      "48": [0, 0.44444, 0, 0, 0.575],
      "49": [0, 0.44444, 0, 0, 0.575],
      "50": [0, 0.44444, 0, 0, 0.575],
      "51": [0.19444, 0.44444, 0, 0, 0.575],
      "52": [0.19444, 0.44444, 0, 0, 0.575],
      "53": [0.19444, 0.44444, 0, 0, 0.575],
      "54": [0, 0.64444, 0, 0, 0.575],
      "55": [0.19444, 0.44444, 0, 0, 0.575],
      "56": [0, 0.64444, 0, 0, 0.575],
      "57": [0.19444, 0.44444, 0, 0, 0.575],
      "65": [0, 0.68611, 0, 0, 0.86944],
      "66": [0, 0.68611, 0.04835, 0, 0.8664],
      "67": [0, 0.68611, 0.06979, 0, 0.81694],
      "68": [0, 0.68611, 0.03194, 0, 0.93812],
      "69": [0, 0.68611, 0.05451, 0, 0.81007],
      "70": [0, 0.68611, 0.15972, 0, 0.68889],
      "71": [0, 0.68611, 0, 0, 0.88673],
      "72": [0, 0.68611, 0.08229, 0, 0.98229],
      "73": [0, 0.68611, 0.07778, 0, 0.51111],
      "74": [0, 0.68611, 0.10069, 0, 0.63125],
      "75": [0, 0.68611, 0.06979, 0, 0.97118],
      "76": [0, 0.68611, 0, 0, 0.75555],
      "77": [0, 0.68611, 0.11424, 0, 1.14201],
      "78": [0, 0.68611, 0.11424, 0, 0.95034],
      "79": [0, 0.68611, 0.03194, 0, 0.83666],
      "80": [0, 0.68611, 0.15972, 0, 0.72309],
      "81": [0.19444, 0.68611, 0, 0, 0.86861],
      "82": [0, 0.68611, 421e-5, 0, 0.87235],
      "83": [0, 0.68611, 0.05382, 0, 0.69271],
      "84": [0, 0.68611, 0.15972, 0, 0.63663],
      "85": [0, 0.68611, 0.11424, 0, 0.80027],
      "86": [0, 0.68611, 0.25555, 0, 0.67778],
      "87": [0, 0.68611, 0.15972, 0, 1.09305],
      "88": [0, 0.68611, 0.07778, 0, 0.94722],
      "89": [0, 0.68611, 0.25555, 0, 0.67458],
      "90": [0, 0.68611, 0.06979, 0, 0.77257],
      "97": [0, 0.44444, 0, 0, 0.63287],
      "98": [0, 0.69444, 0, 0, 0.52083],
      "99": [0, 0.44444, 0, 0, 0.51342],
      "100": [0, 0.69444, 0, 0, 0.60972],
      "101": [0, 0.44444, 0, 0, 0.55361],
      "102": [0.19444, 0.69444, 0.11042, 0, 0.56806],
      "103": [0.19444, 0.44444, 0.03704, 0, 0.5449],
      "104": [0, 0.69444, 0, 0, 0.66759],
      "105": [0, 0.69326, 0, 0, 0.4048],
      "106": [0.19444, 0.69326, 0.0622, 0, 0.47083],
      "107": [0, 0.69444, 0.01852, 0, 0.6037],
      "108": [0, 0.69444, 88e-4, 0, 0.34815],
      "109": [0, 0.44444, 0, 0, 1.0324],
      "110": [0, 0.44444, 0, 0, 0.71296],
      "111": [0, 0.44444, 0, 0, 0.58472],
      "112": [0.19444, 0.44444, 0, 0, 0.60092],
      "113": [0.19444, 0.44444, 0.03704, 0, 0.54213],
      "114": [0, 0.44444, 0.03194, 0, 0.5287],
      "115": [0, 0.44444, 0, 0, 0.53125],
      "116": [0, 0.63492, 0, 0, 0.41528],
      "117": [0, 0.44444, 0, 0, 0.68102],
      "118": [0, 0.44444, 0.03704, 0, 0.56666],
      "119": [0, 0.44444, 0.02778, 0, 0.83148],
      "120": [0, 0.44444, 0, 0, 0.65903],
      "121": [0.19444, 0.44444, 0.03704, 0, 0.59028],
      "122": [0, 0.44444, 0.04213, 0, 0.55509],
      "160": [0, 0, 0, 0, 0.25],
      "915": [0, 0.68611, 0.15972, 0, 0.65694],
      "916": [0, 0.68611, 0, 0, 0.95833],
      "920": [0, 0.68611, 0.03194, 0, 0.86722],
      "923": [0, 0.68611, 0, 0, 0.80555],
      "926": [0, 0.68611, 0.07458, 0, 0.84125],
      "928": [0, 0.68611, 0.08229, 0, 0.98229],
      "931": [0, 0.68611, 0.05451, 0, 0.88507],
      "933": [0, 0.68611, 0.15972, 0, 0.67083],
      "934": [0, 0.68611, 0, 0, 0.76666],
      "936": [0, 0.68611, 0.11653, 0, 0.71402],
      "937": [0, 0.68611, 0.04835, 0, 0.8789],
      "945": [0, 0.44444, 0, 0, 0.76064],
      "946": [0.19444, 0.69444, 0.03403, 0, 0.65972],
      "947": [0.19444, 0.44444, 0.06389, 0, 0.59003],
      "948": [0, 0.69444, 0.03819, 0, 0.52222],
      "949": [0, 0.44444, 0, 0, 0.52882],
      "950": [0.19444, 0.69444, 0.06215, 0, 0.50833],
      "951": [0.19444, 0.44444, 0.03704, 0, 0.6],
      "952": [0, 0.69444, 0.03194, 0, 0.5618],
      "953": [0, 0.44444, 0, 0, 0.41204],
      "954": [0, 0.44444, 0, 0, 0.66759],
      "955": [0, 0.69444, 0, 0, 0.67083],
      "956": [0.19444, 0.44444, 0, 0, 0.70787],
      "957": [0, 0.44444, 0.06898, 0, 0.57685],
      "958": [0.19444, 0.69444, 0.03021, 0, 0.50833],
      "959": [0, 0.44444, 0, 0, 0.58472],
      "960": [0, 0.44444, 0.03704, 0, 0.68241],
      "961": [0.19444, 0.44444, 0, 0, 0.6118],
      "962": [0.09722, 0.44444, 0.07917, 0, 0.42361],
      "963": [0, 0.44444, 0.03704, 0, 0.68588],
      "964": [0, 0.44444, 0.13472, 0, 0.52083],
      "965": [0, 0.44444, 0.03704, 0, 0.63055],
      "966": [0.19444, 0.44444, 0, 0, 0.74722],
      "967": [0.19444, 0.44444, 0, 0, 0.71805],
      "968": [0.19444, 0.69444, 0.03704, 0, 0.75833],
      "969": [0, 0.44444, 0.03704, 0, 0.71782],
      "977": [0, 0.69444, 0, 0, 0.69155],
      "981": [0.19444, 0.69444, 0, 0, 0.7125],
      "982": [0, 0.44444, 0.03194, 0, 0.975],
      "1009": [0.19444, 0.44444, 0, 0, 0.6118],
      "1013": [0, 0.44444, 0, 0, 0.48333],
      "57649": [0, 0.44444, 0, 0, 0.39352],
      "57911": [0.19444, 0.44444, 0, 0, 0.43889]
    },
    "Math-Italic": {
      "32": [0, 0, 0, 0, 0.25],
      "48": [0, 0.43056, 0, 0, 0.5],
      "49": [0, 0.43056, 0, 0, 0.5],
      "50": [0, 0.43056, 0, 0, 0.5],
      "51": [0.19444, 0.43056, 0, 0, 0.5],
      "52": [0.19444, 0.43056, 0, 0, 0.5],
      "53": [0.19444, 0.43056, 0, 0, 0.5],
      "54": [0, 0.64444, 0, 0, 0.5],
      "55": [0.19444, 0.43056, 0, 0, 0.5],
      "56": [0, 0.64444, 0, 0, 0.5],
      "57": [0.19444, 0.43056, 0, 0, 0.5],
      "65": [0, 0.68333, 0, 0.13889, 0.75],
      "66": [0, 0.68333, 0.05017, 0.08334, 0.75851],
      "67": [0, 0.68333, 0.07153, 0.08334, 0.71472],
      "68": [0, 0.68333, 0.02778, 0.05556, 0.82792],
      "69": [0, 0.68333, 0.05764, 0.08334, 0.7382],
      "70": [0, 0.68333, 0.13889, 0.08334, 0.64306],
      "71": [0, 0.68333, 0, 0.08334, 0.78625],
      "72": [0, 0.68333, 0.08125, 0.05556, 0.83125],
      "73": [0, 0.68333, 0.07847, 0.11111, 0.43958],
      "74": [0, 0.68333, 0.09618, 0.16667, 0.55451],
      "75": [0, 0.68333, 0.07153, 0.05556, 0.84931],
      "76": [0, 0.68333, 0, 0.02778, 0.68056],
      "77": [0, 0.68333, 0.10903, 0.08334, 0.97014],
      "78": [0, 0.68333, 0.10903, 0.08334, 0.80347],
      "79": [0, 0.68333, 0.02778, 0.08334, 0.76278],
      "80": [0, 0.68333, 0.13889, 0.08334, 0.64201],
      "81": [0.19444, 0.68333, 0, 0.08334, 0.79056],
      "82": [0, 0.68333, 773e-5, 0.08334, 0.75929],
      "83": [0, 0.68333, 0.05764, 0.08334, 0.6132],
      "84": [0, 0.68333, 0.13889, 0.08334, 0.58438],
      "85": [0, 0.68333, 0.10903, 0.02778, 0.68278],
      "86": [0, 0.68333, 0.22222, 0, 0.58333],
      "87": [0, 0.68333, 0.13889, 0, 0.94445],
      "88": [0, 0.68333, 0.07847, 0.08334, 0.82847],
      "89": [0, 0.68333, 0.22222, 0, 0.58056],
      "90": [0, 0.68333, 0.07153, 0.08334, 0.68264],
      "97": [0, 0.43056, 0, 0, 0.52859],
      "98": [0, 0.69444, 0, 0, 0.42917],
      "99": [0, 0.43056, 0, 0.05556, 0.43276],
      "100": [0, 0.69444, 0, 0.16667, 0.52049],
      "101": [0, 0.43056, 0, 0.05556, 0.46563],
      "102": [0.19444, 0.69444, 0.10764, 0.16667, 0.48959],
      "103": [0.19444, 0.43056, 0.03588, 0.02778, 0.47697],
      "104": [0, 0.69444, 0, 0, 0.57616],
      "105": [0, 0.65952, 0, 0, 0.34451],
      "106": [0.19444, 0.65952, 0.05724, 0, 0.41181],
      "107": [0, 0.69444, 0.03148, 0, 0.5206],
      "108": [0, 0.69444, 0.01968, 0.08334, 0.29838],
      "109": [0, 0.43056, 0, 0, 0.87801],
      "110": [0, 0.43056, 0, 0, 0.60023],
      "111": [0, 0.43056, 0, 0.05556, 0.48472],
      "112": [0.19444, 0.43056, 0, 0.08334, 0.50313],
      "113": [0.19444, 0.43056, 0.03588, 0.08334, 0.44641],
      "114": [0, 0.43056, 0.02778, 0.05556, 0.45116],
      "115": [0, 0.43056, 0, 0.05556, 0.46875],
      "116": [0, 0.61508, 0, 0.08334, 0.36111],
      "117": [0, 0.43056, 0, 0.02778, 0.57246],
      "118": [0, 0.43056, 0.03588, 0.02778, 0.48472],
      "119": [0, 0.43056, 0.02691, 0.08334, 0.71592],
      "120": [0, 0.43056, 0, 0.02778, 0.57153],
      "121": [0.19444, 0.43056, 0.03588, 0.05556, 0.49028],
      "122": [0, 0.43056, 0.04398, 0.05556, 0.46505],
      "160": [0, 0, 0, 0, 0.25],
      "915": [0, 0.68333, 0.13889, 0.08334, 0.61528],
      "916": [0, 0.68333, 0, 0.16667, 0.83334],
      "920": [0, 0.68333, 0.02778, 0.08334, 0.76278],
      "923": [0, 0.68333, 0, 0.16667, 0.69445],
      "926": [0, 0.68333, 0.07569, 0.08334, 0.74236],
      "928": [0, 0.68333, 0.08125, 0.05556, 0.83125],
      "931": [0, 0.68333, 0.05764, 0.08334, 0.77986],
      "933": [0, 0.68333, 0.13889, 0.05556, 0.58333],
      "934": [0, 0.68333, 0, 0.08334, 0.66667],
      "936": [0, 0.68333, 0.11, 0.05556, 0.61222],
      "937": [0, 0.68333, 0.05017, 0.08334, 0.7724],
      "945": [0, 0.43056, 37e-4, 0.02778, 0.6397],
      "946": [0.19444, 0.69444, 0.05278, 0.08334, 0.56563],
      "947": [0.19444, 0.43056, 0.05556, 0, 0.51773],
      "948": [0, 0.69444, 0.03785, 0.05556, 0.44444],
      "949": [0, 0.43056, 0, 0.08334, 0.46632],
      "950": [0.19444, 0.69444, 0.07378, 0.08334, 0.4375],
      "951": [0.19444, 0.43056, 0.03588, 0.05556, 0.49653],
      "952": [0, 0.69444, 0.02778, 0.08334, 0.46944],
      "953": [0, 0.43056, 0, 0.05556, 0.35394],
      "954": [0, 0.43056, 0, 0, 0.57616],
      "955": [0, 0.69444, 0, 0, 0.58334],
      "956": [0.19444, 0.43056, 0, 0.02778, 0.60255],
      "957": [0, 0.43056, 0.06366, 0.02778, 0.49398],
      "958": [0.19444, 0.69444, 0.04601, 0.11111, 0.4375],
      "959": [0, 0.43056, 0, 0.05556, 0.48472],
      "960": [0, 0.43056, 0.03588, 0, 0.57003],
      "961": [0.19444, 0.43056, 0, 0.08334, 0.51702],
      "962": [0.09722, 0.43056, 0.07986, 0.08334, 0.36285],
      "963": [0, 0.43056, 0.03588, 0, 0.57141],
      "964": [0, 0.43056, 0.1132, 0.02778, 0.43715],
      "965": [0, 0.43056, 0.03588, 0.02778, 0.54028],
      "966": [0.19444, 0.43056, 0, 0.08334, 0.65417],
      "967": [0.19444, 0.43056, 0, 0.05556, 0.62569],
      "968": [0.19444, 0.69444, 0.03588, 0.11111, 0.65139],
      "969": [0, 0.43056, 0.03588, 0, 0.62245],
      "977": [0, 0.69444, 0, 0.08334, 0.59144],
      "981": [0.19444, 0.69444, 0, 0.08334, 0.59583],
      "982": [0, 0.43056, 0.02778, 0, 0.82813],
      "1009": [0.19444, 0.43056, 0, 0.08334, 0.51702],
      "1013": [0, 0.43056, 0, 0.05556, 0.4059],
      "57649": [0, 0.43056, 0, 0.02778, 0.32246],
      "57911": [0.19444, 0.43056, 0, 0.08334, 0.38403]
    },
    "SansSerif-Bold": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0, 0, 0.36667],
      "34": [0, 0.69444, 0, 0, 0.55834],
      "35": [0.19444, 0.69444, 0, 0, 0.91667],
      "36": [0.05556, 0.75, 0, 0, 0.55],
      "37": [0.05556, 0.75, 0, 0, 1.02912],
      "38": [0, 0.69444, 0, 0, 0.83056],
      "39": [0, 0.69444, 0, 0, 0.30556],
      "40": [0.25, 0.75, 0, 0, 0.42778],
      "41": [0.25, 0.75, 0, 0, 0.42778],
      "42": [0, 0.75, 0, 0, 0.55],
      "43": [0.11667, 0.61667, 0, 0, 0.85556],
      "44": [0.10556, 0.13056, 0, 0, 0.30556],
      "45": [0, 0.45833, 0, 0, 0.36667],
      "46": [0, 0.13056, 0, 0, 0.30556],
      "47": [0.25, 0.75, 0, 0, 0.55],
      "48": [0, 0.69444, 0, 0, 0.55],
      "49": [0, 0.69444, 0, 0, 0.55],
      "50": [0, 0.69444, 0, 0, 0.55],
      "51": [0, 0.69444, 0, 0, 0.55],
      "52": [0, 0.69444, 0, 0, 0.55],
      "53": [0, 0.69444, 0, 0, 0.55],
      "54": [0, 0.69444, 0, 0, 0.55],
      "55": [0, 0.69444, 0, 0, 0.55],
      "56": [0, 0.69444, 0, 0, 0.55],
      "57": [0, 0.69444, 0, 0, 0.55],
      "58": [0, 0.45833, 0, 0, 0.30556],
      "59": [0.10556, 0.45833, 0, 0, 0.30556],
      "61": [-0.09375, 0.40625, 0, 0, 0.85556],
      "63": [0, 0.69444, 0, 0, 0.51945],
      "64": [0, 0.69444, 0, 0, 0.73334],
      "65": [0, 0.69444, 0, 0, 0.73334],
      "66": [0, 0.69444, 0, 0, 0.73334],
      "67": [0, 0.69444, 0, 0, 0.70278],
      "68": [0, 0.69444, 0, 0, 0.79445],
      "69": [0, 0.69444, 0, 0, 0.64167],
      "70": [0, 0.69444, 0, 0, 0.61111],
      "71": [0, 0.69444, 0, 0, 0.73334],
      "72": [0, 0.69444, 0, 0, 0.79445],
      "73": [0, 0.69444, 0, 0, 0.33056],
      "74": [0, 0.69444, 0, 0, 0.51945],
      "75": [0, 0.69444, 0, 0, 0.76389],
      "76": [0, 0.69444, 0, 0, 0.58056],
      "77": [0, 0.69444, 0, 0, 0.97778],
      "78": [0, 0.69444, 0, 0, 0.79445],
      "79": [0, 0.69444, 0, 0, 0.79445],
      "80": [0, 0.69444, 0, 0, 0.70278],
      "81": [0.10556, 0.69444, 0, 0, 0.79445],
      "82": [0, 0.69444, 0, 0, 0.70278],
      "83": [0, 0.69444, 0, 0, 0.61111],
      "84": [0, 0.69444, 0, 0, 0.73334],
      "85": [0, 0.69444, 0, 0, 0.76389],
      "86": [0, 0.69444, 0.01528, 0, 0.73334],
      "87": [0, 0.69444, 0.01528, 0, 1.03889],
      "88": [0, 0.69444, 0, 0, 0.73334],
      "89": [0, 0.69444, 0.0275, 0, 0.73334],
      "90": [0, 0.69444, 0, 0, 0.67223],
      "91": [0.25, 0.75, 0, 0, 0.34306],
      "93": [0.25, 0.75, 0, 0, 0.34306],
      "94": [0, 0.69444, 0, 0, 0.55],
      "95": [0.35, 0.10833, 0.03056, 0, 0.55],
      "97": [0, 0.45833, 0, 0, 0.525],
      "98": [0, 0.69444, 0, 0, 0.56111],
      "99": [0, 0.45833, 0, 0, 0.48889],
      "100": [0, 0.69444, 0, 0, 0.56111],
      "101": [0, 0.45833, 0, 0, 0.51111],
      "102": [0, 0.69444, 0.07639, 0, 0.33611],
      "103": [0.19444, 0.45833, 0.01528, 0, 0.55],
      "104": [0, 0.69444, 0, 0, 0.56111],
      "105": [0, 0.69444, 0, 0, 0.25556],
      "106": [0.19444, 0.69444, 0, 0, 0.28611],
      "107": [0, 0.69444, 0, 0, 0.53056],
      "108": [0, 0.69444, 0, 0, 0.25556],
      "109": [0, 0.45833, 0, 0, 0.86667],
      "110": [0, 0.45833, 0, 0, 0.56111],
      "111": [0, 0.45833, 0, 0, 0.55],
      "112": [0.19444, 0.45833, 0, 0, 0.56111],
      "113": [0.19444, 0.45833, 0, 0, 0.56111],
      "114": [0, 0.45833, 0.01528, 0, 0.37222],
      "115": [0, 0.45833, 0, 0, 0.42167],
      "116": [0, 0.58929, 0, 0, 0.40417],
      "117": [0, 0.45833, 0, 0, 0.56111],
      "118": [0, 0.45833, 0.01528, 0, 0.5],
      "119": [0, 0.45833, 0.01528, 0, 0.74445],
      "120": [0, 0.45833, 0, 0, 0.5],
      "121": [0.19444, 0.45833, 0.01528, 0, 0.5],
      "122": [0, 0.45833, 0, 0, 0.47639],
      "126": [0.35, 0.34444, 0, 0, 0.55],
      "160": [0, 0, 0, 0, 0.25],
      "168": [0, 0.69444, 0, 0, 0.55],
      "176": [0, 0.69444, 0, 0, 0.73334],
      "180": [0, 0.69444, 0, 0, 0.55],
      "184": [0.17014, 0, 0, 0, 0.48889],
      "305": [0, 0.45833, 0, 0, 0.25556],
      "567": [0.19444, 0.45833, 0, 0, 0.28611],
      "710": [0, 0.69444, 0, 0, 0.55],
      "711": [0, 0.63542, 0, 0, 0.55],
      "713": [0, 0.63778, 0, 0, 0.55],
      "728": [0, 0.69444, 0, 0, 0.55],
      "729": [0, 0.69444, 0, 0, 0.30556],
      "730": [0, 0.69444, 0, 0, 0.73334],
      "732": [0, 0.69444, 0, 0, 0.55],
      "733": [0, 0.69444, 0, 0, 0.55],
      "915": [0, 0.69444, 0, 0, 0.58056],
      "916": [0, 0.69444, 0, 0, 0.91667],
      "920": [0, 0.69444, 0, 0, 0.85556],
      "923": [0, 0.69444, 0, 0, 0.67223],
      "926": [0, 0.69444, 0, 0, 0.73334],
      "928": [0, 0.69444, 0, 0, 0.79445],
      "931": [0, 0.69444, 0, 0, 0.79445],
      "933": [0, 0.69444, 0, 0, 0.85556],
      "934": [0, 0.69444, 0, 0, 0.79445],
      "936": [0, 0.69444, 0, 0, 0.85556],
      "937": [0, 0.69444, 0, 0, 0.79445],
      "8211": [0, 0.45833, 0.03056, 0, 0.55],
      "8212": [0, 0.45833, 0.03056, 0, 1.10001],
      "8216": [0, 0.69444, 0, 0, 0.30556],
      "8217": [0, 0.69444, 0, 0, 0.30556],
      "8220": [0, 0.69444, 0, 0, 0.55834],
      "8221": [0, 0.69444, 0, 0, 0.55834]
    },
    "SansSerif-Italic": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0.05733, 0, 0.31945],
      "34": [0, 0.69444, 316e-5, 0, 0.5],
      "35": [0.19444, 0.69444, 0.05087, 0, 0.83334],
      "36": [0.05556, 0.75, 0.11156, 0, 0.5],
      "37": [0.05556, 0.75, 0.03126, 0, 0.83334],
      "38": [0, 0.69444, 0.03058, 0, 0.75834],
      "39": [0, 0.69444, 0.07816, 0, 0.27778],
      "40": [0.25, 0.75, 0.13164, 0, 0.38889],
      "41": [0.25, 0.75, 0.02536, 0, 0.38889],
      "42": [0, 0.75, 0.11775, 0, 0.5],
      "43": [0.08333, 0.58333, 0.02536, 0, 0.77778],
      "44": [0.125, 0.08333, 0, 0, 0.27778],
      "45": [0, 0.44444, 0.01946, 0, 0.33333],
      "46": [0, 0.08333, 0, 0, 0.27778],
      "47": [0.25, 0.75, 0.13164, 0, 0.5],
      "48": [0, 0.65556, 0.11156, 0, 0.5],
      "49": [0, 0.65556, 0.11156, 0, 0.5],
      "50": [0, 0.65556, 0.11156, 0, 0.5],
      "51": [0, 0.65556, 0.11156, 0, 0.5],
      "52": [0, 0.65556, 0.11156, 0, 0.5],
      "53": [0, 0.65556, 0.11156, 0, 0.5],
      "54": [0, 0.65556, 0.11156, 0, 0.5],
      "55": [0, 0.65556, 0.11156, 0, 0.5],
      "56": [0, 0.65556, 0.11156, 0, 0.5],
      "57": [0, 0.65556, 0.11156, 0, 0.5],
      "58": [0, 0.44444, 0.02502, 0, 0.27778],
      "59": [0.125, 0.44444, 0.02502, 0, 0.27778],
      "61": [-0.13, 0.37, 0.05087, 0, 0.77778],
      "63": [0, 0.69444, 0.11809, 0, 0.47222],
      "64": [0, 0.69444, 0.07555, 0, 0.66667],
      "65": [0, 0.69444, 0, 0, 0.66667],
      "66": [0, 0.69444, 0.08293, 0, 0.66667],
      "67": [0, 0.69444, 0.11983, 0, 0.63889],
      "68": [0, 0.69444, 0.07555, 0, 0.72223],
      "69": [0, 0.69444, 0.11983, 0, 0.59722],
      "70": [0, 0.69444, 0.13372, 0, 0.56945],
      "71": [0, 0.69444, 0.11983, 0, 0.66667],
      "72": [0, 0.69444, 0.08094, 0, 0.70834],
      "73": [0, 0.69444, 0.13372, 0, 0.27778],
      "74": [0, 0.69444, 0.08094, 0, 0.47222],
      "75": [0, 0.69444, 0.11983, 0, 0.69445],
      "76": [0, 0.69444, 0, 0, 0.54167],
      "77": [0, 0.69444, 0.08094, 0, 0.875],
      "78": [0, 0.69444, 0.08094, 0, 0.70834],
      "79": [0, 0.69444, 0.07555, 0, 0.73611],
      "80": [0, 0.69444, 0.08293, 0, 0.63889],
      "81": [0.125, 0.69444, 0.07555, 0, 0.73611],
      "82": [0, 0.69444, 0.08293, 0, 0.64584],
      "83": [0, 0.69444, 0.09205, 0, 0.55556],
      "84": [0, 0.69444, 0.13372, 0, 0.68056],
      "85": [0, 0.69444, 0.08094, 0, 0.6875],
      "86": [0, 0.69444, 0.1615, 0, 0.66667],
      "87": [0, 0.69444, 0.1615, 0, 0.94445],
      "88": [0, 0.69444, 0.13372, 0, 0.66667],
      "89": [0, 0.69444, 0.17261, 0, 0.66667],
      "90": [0, 0.69444, 0.11983, 0, 0.61111],
      "91": [0.25, 0.75, 0.15942, 0, 0.28889],
      "93": [0.25, 0.75, 0.08719, 0, 0.28889],
      "94": [0, 0.69444, 0.0799, 0, 0.5],
      "95": [0.35, 0.09444, 0.08616, 0, 0.5],
      "97": [0, 0.44444, 981e-5, 0, 0.48056],
      "98": [0, 0.69444, 0.03057, 0, 0.51667],
      "99": [0, 0.44444, 0.08336, 0, 0.44445],
      "100": [0, 0.69444, 0.09483, 0, 0.51667],
      "101": [0, 0.44444, 0.06778, 0, 0.44445],
      "102": [0, 0.69444, 0.21705, 0, 0.30556],
      "103": [0.19444, 0.44444, 0.10836, 0, 0.5],
      "104": [0, 0.69444, 0.01778, 0, 0.51667],
      "105": [0, 0.67937, 0.09718, 0, 0.23889],
      "106": [0.19444, 0.67937, 0.09162, 0, 0.26667],
      "107": [0, 0.69444, 0.08336, 0, 0.48889],
      "108": [0, 0.69444, 0.09483, 0, 0.23889],
      "109": [0, 0.44444, 0.01778, 0, 0.79445],
      "110": [0, 0.44444, 0.01778, 0, 0.51667],
      "111": [0, 0.44444, 0.06613, 0, 0.5],
      "112": [0.19444, 0.44444, 0.0389, 0, 0.51667],
      "113": [0.19444, 0.44444, 0.04169, 0, 0.51667],
      "114": [0, 0.44444, 0.10836, 0, 0.34167],
      "115": [0, 0.44444, 0.0778, 0, 0.38333],
      "116": [0, 0.57143, 0.07225, 0, 0.36111],
      "117": [0, 0.44444, 0.04169, 0, 0.51667],
      "118": [0, 0.44444, 0.10836, 0, 0.46111],
      "119": [0, 0.44444, 0.10836, 0, 0.68334],
      "120": [0, 0.44444, 0.09169, 0, 0.46111],
      "121": [0.19444, 0.44444, 0.10836, 0, 0.46111],
      "122": [0, 0.44444, 0.08752, 0, 0.43472],
      "126": [0.35, 0.32659, 0.08826, 0, 0.5],
      "160": [0, 0, 0, 0, 0.25],
      "168": [0, 0.67937, 0.06385, 0, 0.5],
      "176": [0, 0.69444, 0, 0, 0.73752],
      "184": [0.17014, 0, 0, 0, 0.44445],
      "305": [0, 0.44444, 0.04169, 0, 0.23889],
      "567": [0.19444, 0.44444, 0.04169, 0, 0.26667],
      "710": [0, 0.69444, 0.0799, 0, 0.5],
      "711": [0, 0.63194, 0.08432, 0, 0.5],
      "713": [0, 0.60889, 0.08776, 0, 0.5],
      "714": [0, 0.69444, 0.09205, 0, 0.5],
      "715": [0, 0.69444, 0, 0, 0.5],
      "728": [0, 0.69444, 0.09483, 0, 0.5],
      "729": [0, 0.67937, 0.07774, 0, 0.27778],
      "730": [0, 0.69444, 0, 0, 0.73752],
      "732": [0, 0.67659, 0.08826, 0, 0.5],
      "733": [0, 0.69444, 0.09205, 0, 0.5],
      "915": [0, 0.69444, 0.13372, 0, 0.54167],
      "916": [0, 0.69444, 0, 0, 0.83334],
      "920": [0, 0.69444, 0.07555, 0, 0.77778],
      "923": [0, 0.69444, 0, 0, 0.61111],
      "926": [0, 0.69444, 0.12816, 0, 0.66667],
      "928": [0, 0.69444, 0.08094, 0, 0.70834],
      "931": [0, 0.69444, 0.11983, 0, 0.72222],
      "933": [0, 0.69444, 0.09031, 0, 0.77778],
      "934": [0, 0.69444, 0.04603, 0, 0.72222],
      "936": [0, 0.69444, 0.09031, 0, 0.77778],
      "937": [0, 0.69444, 0.08293, 0, 0.72222],
      "8211": [0, 0.44444, 0.08616, 0, 0.5],
      "8212": [0, 0.44444, 0.08616, 0, 1],
      "8216": [0, 0.69444, 0.07816, 0, 0.27778],
      "8217": [0, 0.69444, 0.07816, 0, 0.27778],
      "8220": [0, 0.69444, 0.14205, 0, 0.5],
      "8221": [0, 0.69444, 316e-5, 0, 0.5]
    },
    "SansSerif-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "33": [0, 0.69444, 0, 0, 0.31945],
      "34": [0, 0.69444, 0, 0, 0.5],
      "35": [0.19444, 0.69444, 0, 0, 0.83334],
      "36": [0.05556, 0.75, 0, 0, 0.5],
      "37": [0.05556, 0.75, 0, 0, 0.83334],
      "38": [0, 0.69444, 0, 0, 0.75834],
      "39": [0, 0.69444, 0, 0, 0.27778],
      "40": [0.25, 0.75, 0, 0, 0.38889],
      "41": [0.25, 0.75, 0, 0, 0.38889],
      "42": [0, 0.75, 0, 0, 0.5],
      "43": [0.08333, 0.58333, 0, 0, 0.77778],
      "44": [0.125, 0.08333, 0, 0, 0.27778],
      "45": [0, 0.44444, 0, 0, 0.33333],
      "46": [0, 0.08333, 0, 0, 0.27778],
      "47": [0.25, 0.75, 0, 0, 0.5],
      "48": [0, 0.65556, 0, 0, 0.5],
      "49": [0, 0.65556, 0, 0, 0.5],
      "50": [0, 0.65556, 0, 0, 0.5],
      "51": [0, 0.65556, 0, 0, 0.5],
      "52": [0, 0.65556, 0, 0, 0.5],
      "53": [0, 0.65556, 0, 0, 0.5],
      "54": [0, 0.65556, 0, 0, 0.5],
      "55": [0, 0.65556, 0, 0, 0.5],
      "56": [0, 0.65556, 0, 0, 0.5],
      "57": [0, 0.65556, 0, 0, 0.5],
      "58": [0, 0.44444, 0, 0, 0.27778],
      "59": [0.125, 0.44444, 0, 0, 0.27778],
      "61": [-0.13, 0.37, 0, 0, 0.77778],
      "63": [0, 0.69444, 0, 0, 0.47222],
      "64": [0, 0.69444, 0, 0, 0.66667],
      "65": [0, 0.69444, 0, 0, 0.66667],
      "66": [0, 0.69444, 0, 0, 0.66667],
      "67": [0, 0.69444, 0, 0, 0.63889],
      "68": [0, 0.69444, 0, 0, 0.72223],
      "69": [0, 0.69444, 0, 0, 0.59722],
      "70": [0, 0.69444, 0, 0, 0.56945],
      "71": [0, 0.69444, 0, 0, 0.66667],
      "72": [0, 0.69444, 0, 0, 0.70834],
      "73": [0, 0.69444, 0, 0, 0.27778],
      "74": [0, 0.69444, 0, 0, 0.47222],
      "75": [0, 0.69444, 0, 0, 0.69445],
      "76": [0, 0.69444, 0, 0, 0.54167],
      "77": [0, 0.69444, 0, 0, 0.875],
      "78": [0, 0.69444, 0, 0, 0.70834],
      "79": [0, 0.69444, 0, 0, 0.73611],
      "80": [0, 0.69444, 0, 0, 0.63889],
      "81": [0.125, 0.69444, 0, 0, 0.73611],
      "82": [0, 0.69444, 0, 0, 0.64584],
      "83": [0, 0.69444, 0, 0, 0.55556],
      "84": [0, 0.69444, 0, 0, 0.68056],
      "85": [0, 0.69444, 0, 0, 0.6875],
      "86": [0, 0.69444, 0.01389, 0, 0.66667],
      "87": [0, 0.69444, 0.01389, 0, 0.94445],
      "88": [0, 0.69444, 0, 0, 0.66667],
      "89": [0, 0.69444, 0.025, 0, 0.66667],
      "90": [0, 0.69444, 0, 0, 0.61111],
      "91": [0.25, 0.75, 0, 0, 0.28889],
      "93": [0.25, 0.75, 0, 0, 0.28889],
      "94": [0, 0.69444, 0, 0, 0.5],
      "95": [0.35, 0.09444, 0.02778, 0, 0.5],
      "97": [0, 0.44444, 0, 0, 0.48056],
      "98": [0, 0.69444, 0, 0, 0.51667],
      "99": [0, 0.44444, 0, 0, 0.44445],
      "100": [0, 0.69444, 0, 0, 0.51667],
      "101": [0, 0.44444, 0, 0, 0.44445],
      "102": [0, 0.69444, 0.06944, 0, 0.30556],
      "103": [0.19444, 0.44444, 0.01389, 0, 0.5],
      "104": [0, 0.69444, 0, 0, 0.51667],
      "105": [0, 0.67937, 0, 0, 0.23889],
      "106": [0.19444, 0.67937, 0, 0, 0.26667],
      "107": [0, 0.69444, 0, 0, 0.48889],
      "108": [0, 0.69444, 0, 0, 0.23889],
      "109": [0, 0.44444, 0, 0, 0.79445],
      "110": [0, 0.44444, 0, 0, 0.51667],
      "111": [0, 0.44444, 0, 0, 0.5],
      "112": [0.19444, 0.44444, 0, 0, 0.51667],
      "113": [0.19444, 0.44444, 0, 0, 0.51667],
      "114": [0, 0.44444, 0.01389, 0, 0.34167],
      "115": [0, 0.44444, 0, 0, 0.38333],
      "116": [0, 0.57143, 0, 0, 0.36111],
      "117": [0, 0.44444, 0, 0, 0.51667],
      "118": [0, 0.44444, 0.01389, 0, 0.46111],
      "119": [0, 0.44444, 0.01389, 0, 0.68334],
      "120": [0, 0.44444, 0, 0, 0.46111],
      "121": [0.19444, 0.44444, 0.01389, 0, 0.46111],
      "122": [0, 0.44444, 0, 0, 0.43472],
      "126": [0.35, 0.32659, 0, 0, 0.5],
      "160": [0, 0, 0, 0, 0.25],
      "168": [0, 0.67937, 0, 0, 0.5],
      "176": [0, 0.69444, 0, 0, 0.66667],
      "184": [0.17014, 0, 0, 0, 0.44445],
      "305": [0, 0.44444, 0, 0, 0.23889],
      "567": [0.19444, 0.44444, 0, 0, 0.26667],
      "710": [0, 0.69444, 0, 0, 0.5],
      "711": [0, 0.63194, 0, 0, 0.5],
      "713": [0, 0.60889, 0, 0, 0.5],
      "714": [0, 0.69444, 0, 0, 0.5],
      "715": [0, 0.69444, 0, 0, 0.5],
      "728": [0, 0.69444, 0, 0, 0.5],
      "729": [0, 0.67937, 0, 0, 0.27778],
      "730": [0, 0.69444, 0, 0, 0.66667],
      "732": [0, 0.67659, 0, 0, 0.5],
      "733": [0, 0.69444, 0, 0, 0.5],
      "915": [0, 0.69444, 0, 0, 0.54167],
      "916": [0, 0.69444, 0, 0, 0.83334],
      "920": [0, 0.69444, 0, 0, 0.77778],
      "923": [0, 0.69444, 0, 0, 0.61111],
      "926": [0, 0.69444, 0, 0, 0.66667],
      "928": [0, 0.69444, 0, 0, 0.70834],
      "931": [0, 0.69444, 0, 0, 0.72222],
      "933": [0, 0.69444, 0, 0, 0.77778],
      "934": [0, 0.69444, 0, 0, 0.72222],
      "936": [0, 0.69444, 0, 0, 0.77778],
      "937": [0, 0.69444, 0, 0, 0.72222],
      "8211": [0, 0.44444, 0.02778, 0, 0.5],
      "8212": [0, 0.44444, 0.02778, 0, 1],
      "8216": [0, 0.69444, 0, 0, 0.27778],
      "8217": [0, 0.69444, 0, 0, 0.27778],
      "8220": [0, 0.69444, 0, 0, 0.5],
      "8221": [0, 0.69444, 0, 0, 0.5]
    },
    "Script-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "65": [0, 0.7, 0.22925, 0, 0.80253],
      "66": [0, 0.7, 0.04087, 0, 0.90757],
      "67": [0, 0.7, 0.1689, 0, 0.66619],
      "68": [0, 0.7, 0.09371, 0, 0.77443],
      "69": [0, 0.7, 0.18583, 0, 0.56162],
      "70": [0, 0.7, 0.13634, 0, 0.89544],
      "71": [0, 0.7, 0.17322, 0, 0.60961],
      "72": [0, 0.7, 0.29694, 0, 0.96919],
      "73": [0, 0.7, 0.19189, 0, 0.80907],
      "74": [0.27778, 0.7, 0.19189, 0, 1.05159],
      "75": [0, 0.7, 0.31259, 0, 0.91364],
      "76": [0, 0.7, 0.19189, 0, 0.87373],
      "77": [0, 0.7, 0.15981, 0, 1.08031],
      "78": [0, 0.7, 0.3525, 0, 0.9015],
      "79": [0, 0.7, 0.08078, 0, 0.73787],
      "80": [0, 0.7, 0.08078, 0, 1.01262],
      "81": [0, 0.7, 0.03305, 0, 0.88282],
      "82": [0, 0.7, 0.06259, 0, 0.85],
      "83": [0, 0.7, 0.19189, 0, 0.86767],
      "84": [0, 0.7, 0.29087, 0, 0.74697],
      "85": [0, 0.7, 0.25815, 0, 0.79996],
      "86": [0, 0.7, 0.27523, 0, 0.62204],
      "87": [0, 0.7, 0.27523, 0, 0.80532],
      "88": [0, 0.7, 0.26006, 0, 0.94445],
      "89": [0, 0.7, 0.2939, 0, 0.70961],
      "90": [0, 0.7, 0.24037, 0, 0.8212],
      "160": [0, 0, 0, 0, 0.25]
    },
    "Size1-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "40": [0.35001, 0.85, 0, 0, 0.45834],
      "41": [0.35001, 0.85, 0, 0, 0.45834],
      "47": [0.35001, 0.85, 0, 0, 0.57778],
      "91": [0.35001, 0.85, 0, 0, 0.41667],
      "92": [0.35001, 0.85, 0, 0, 0.57778],
      "93": [0.35001, 0.85, 0, 0, 0.41667],
      "123": [0.35001, 0.85, 0, 0, 0.58334],
      "125": [0.35001, 0.85, 0, 0, 0.58334],
      "160": [0, 0, 0, 0, 0.25],
      "710": [0, 0.72222, 0, 0, 0.55556],
      "732": [0, 0.72222, 0, 0, 0.55556],
      "770": [0, 0.72222, 0, 0, 0.55556],
      "771": [0, 0.72222, 0, 0, 0.55556],
      "8214": [-99e-5, 0.601, 0, 0, 0.77778],
      "8593": [1e-5, 0.6, 0, 0, 0.66667],
      "8595": [1e-5, 0.6, 0, 0, 0.66667],
      "8657": [1e-5, 0.6, 0, 0, 0.77778],
      "8659": [1e-5, 0.6, 0, 0, 0.77778],
      "8719": [0.25001, 0.75, 0, 0, 0.94445],
      "8720": [0.25001, 0.75, 0, 0, 0.94445],
      "8721": [0.25001, 0.75, 0, 0, 1.05556],
      "8730": [0.35001, 0.85, 0, 0, 1],
      "8739": [-599e-5, 0.606, 0, 0, 0.33333],
      "8741": [-599e-5, 0.606, 0, 0, 0.55556],
      "8747": [0.30612, 0.805, 0.19445, 0, 0.47222],
      "8748": [0.306, 0.805, 0.19445, 0, 0.47222],
      "8749": [0.306, 0.805, 0.19445, 0, 0.47222],
      "8750": [0.30612, 0.805, 0.19445, 0, 0.47222],
      "8896": [0.25001, 0.75, 0, 0, 0.83334],
      "8897": [0.25001, 0.75, 0, 0, 0.83334],
      "8898": [0.25001, 0.75, 0, 0, 0.83334],
      "8899": [0.25001, 0.75, 0, 0, 0.83334],
      "8968": [0.35001, 0.85, 0, 0, 0.47222],
      "8969": [0.35001, 0.85, 0, 0, 0.47222],
      "8970": [0.35001, 0.85, 0, 0, 0.47222],
      "8971": [0.35001, 0.85, 0, 0, 0.47222],
      "9168": [-99e-5, 0.601, 0, 0, 0.66667],
      "10216": [0.35001, 0.85, 0, 0, 0.47222],
      "10217": [0.35001, 0.85, 0, 0, 0.47222],
      "10752": [0.25001, 0.75, 0, 0, 1.11111],
      "10753": [0.25001, 0.75, 0, 0, 1.11111],
      "10754": [0.25001, 0.75, 0, 0, 1.11111],
      "10756": [0.25001, 0.75, 0, 0, 0.83334],
      "10758": [0.25001, 0.75, 0, 0, 0.83334]
    },
    "Size2-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "40": [0.65002, 1.15, 0, 0, 0.59722],
      "41": [0.65002, 1.15, 0, 0, 0.59722],
      "47": [0.65002, 1.15, 0, 0, 0.81111],
      "91": [0.65002, 1.15, 0, 0, 0.47222],
      "92": [0.65002, 1.15, 0, 0, 0.81111],
      "93": [0.65002, 1.15, 0, 0, 0.47222],
      "123": [0.65002, 1.15, 0, 0, 0.66667],
      "125": [0.65002, 1.15, 0, 0, 0.66667],
      "160": [0, 0, 0, 0, 0.25],
      "710": [0, 0.75, 0, 0, 1],
      "732": [0, 0.75, 0, 0, 1],
      "770": [0, 0.75, 0, 0, 1],
      "771": [0, 0.75, 0, 0, 1],
      "8719": [0.55001, 1.05, 0, 0, 1.27778],
      "8720": [0.55001, 1.05, 0, 0, 1.27778],
      "8721": [0.55001, 1.05, 0, 0, 1.44445],
      "8730": [0.65002, 1.15, 0, 0, 1],
      "8747": [0.86225, 1.36, 0.44445, 0, 0.55556],
      "8748": [0.862, 1.36, 0.44445, 0, 0.55556],
      "8749": [0.862, 1.36, 0.44445, 0, 0.55556],
      "8750": [0.86225, 1.36, 0.44445, 0, 0.55556],
      "8896": [0.55001, 1.05, 0, 0, 1.11111],
      "8897": [0.55001, 1.05, 0, 0, 1.11111],
      "8898": [0.55001, 1.05, 0, 0, 1.11111],
      "8899": [0.55001, 1.05, 0, 0, 1.11111],
      "8968": [0.65002, 1.15, 0, 0, 0.52778],
      "8969": [0.65002, 1.15, 0, 0, 0.52778],
      "8970": [0.65002, 1.15, 0, 0, 0.52778],
      "8971": [0.65002, 1.15, 0, 0, 0.52778],
      "10216": [0.65002, 1.15, 0, 0, 0.61111],
      "10217": [0.65002, 1.15, 0, 0, 0.61111],
      "10752": [0.55001, 1.05, 0, 0, 1.51112],
      "10753": [0.55001, 1.05, 0, 0, 1.51112],
      "10754": [0.55001, 1.05, 0, 0, 1.51112],
      "10756": [0.55001, 1.05, 0, 0, 1.11111],
      "10758": [0.55001, 1.05, 0, 0, 1.11111]
    },
    "Size3-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "40": [0.95003, 1.45, 0, 0, 0.73611],
      "41": [0.95003, 1.45, 0, 0, 0.73611],
      "47": [0.95003, 1.45, 0, 0, 1.04445],
      "91": [0.95003, 1.45, 0, 0, 0.52778],
      "92": [0.95003, 1.45, 0, 0, 1.04445],
      "93": [0.95003, 1.45, 0, 0, 0.52778],
      "123": [0.95003, 1.45, 0, 0, 0.75],
      "125": [0.95003, 1.45, 0, 0, 0.75],
      "160": [0, 0, 0, 0, 0.25],
      "710": [0, 0.75, 0, 0, 1.44445],
      "732": [0, 0.75, 0, 0, 1.44445],
      "770": [0, 0.75, 0, 0, 1.44445],
      "771": [0, 0.75, 0, 0, 1.44445],
      "8730": [0.95003, 1.45, 0, 0, 1],
      "8968": [0.95003, 1.45, 0, 0, 0.58334],
      "8969": [0.95003, 1.45, 0, 0, 0.58334],
      "8970": [0.95003, 1.45, 0, 0, 0.58334],
      "8971": [0.95003, 1.45, 0, 0, 0.58334],
      "10216": [0.95003, 1.45, 0, 0, 0.75],
      "10217": [0.95003, 1.45, 0, 0, 0.75]
    },
    "Size4-Regular": {
      "32": [0, 0, 0, 0, 0.25],
      "40": [1.25003, 1.75, 0, 0, 0.79167],
      "41": [1.25003, 1.75, 0, 0, 0.79167],
      "47": [1.25003, 1.75, 0, 0, 1.27778],
      "91": [1.25003, 1.75, 0, 0, 0.58334],
      "92": [1.25003, 1.75, 0, 0, 1.27778],
      "93": [1.25003, 1.75, 0, 0, 0.58334],
      "123": [1.25003, 1.75, 0, 0, 0.80556],
      "125": [1.25003, 1.75, 0, 0, 0.80556],
      "160": [0, 0, 0, 0, 0.25],
      "710": [0, 0.825, 0, 0, 1.8889],
      "732": [0, 0.825, 0, 0, 1.8889],
      "770": [0, 0.825, 0, 0, 1.8889],
      "771": [0, 0.825, 0, 0, 1.8889],
      "8730": [1.25003, 1.75, 0, 0, 1],
      "8968": [1.25003, 1.75, 0, 0, 0.63889],
      "8969": [1.25003, 1.75, 0, 0, 0.63889],
      "8970": [1.25003, 1.75, 0, 0, 0.63889],
      "8971": [1.25003, 1.75, 0, 0, 0.63889],
      "9115": [0.64502, 1.155, 0, 0, 0.875],
      "9116": [1e-5, 0.6, 0, 0, 0.875],
      "9117": [0.64502, 1.155, 0, 0, 0.875],
      "9118": [0.64502, 1.155, 0, 0, 0.875],
      "9119": [1e-5, 0.6, 0, 0, 0.875],
      "9120": [0.64502, 1.155, 0, 0, 0.875],
      "9121": [0.64502, 1.155, 0, 0, 0.66667],
      "9122": [-99e-5, 0.601, 0, 0, 0.66667],
      "9123": [0.64502, 1.155, 0, 0, 0.66667],
      "9124": [0.64502, 1.155, 0, 0, 0.66667],
      "9125": [-99e-5, 0.601, 0, 0, 0.66667],
      "9126": [0.64502, 1.155, 0, 0, 0.66667],
      "9127": [1e-5, 0.9, 0, 0, 0.88889],
      "9128": [0.65002, 1.15, 0, 0, 0.88889],
      "9129": [0.90001, 0, 0, 0, 0.88889],
      "9130": [0, 0.3, 0, 0, 0.88889],
      "9131": [1e-5, 0.9, 0, 0, 0.88889],
      "9132": [0.65002, 1.15, 0, 0, 0.88889],
      "9133": [0.90001, 0, 0, 0, 0.88889],
      "9143": [0.88502, 0.915, 0, 0, 1.05556],
      "10216": [1.25003, 1.75, 0, 0, 0.80556],
      "10217": [1.25003, 1.75, 0, 0, 0.80556],
      "57344": [-499e-5, 0.605, 0, 0, 1.05556],
      "57345": [-499e-5, 0.605, 0, 0, 1.05556],
      "57680": [0, 0.12, 0, 0, 0.45],
      "57681": [0, 0.12, 0, 0, 0.45],
      "57682": [0, 0.12, 0, 0, 0.45],
      "57683": [0, 0.12, 0, 0, 0.45]
    },
    "Typewriter-Regular": {
      "32": [0, 0, 0, 0, 0.525],
      "33": [0, 0.61111, 0, 0, 0.525],
      "34": [0, 0.61111, 0, 0, 0.525],
      "35": [0, 0.61111, 0, 0, 0.525],
      "36": [0.08333, 0.69444, 0, 0, 0.525],
      "37": [0.08333, 0.69444, 0, 0, 0.525],
      "38": [0, 0.61111, 0, 0, 0.525],
      "39": [0, 0.61111, 0, 0, 0.525],
      "40": [0.08333, 0.69444, 0, 0, 0.525],
      "41": [0.08333, 0.69444, 0, 0, 0.525],
      "42": [0, 0.52083, 0, 0, 0.525],
      "43": [-0.08056, 0.53055, 0, 0, 0.525],
      "44": [0.13889, 0.125, 0, 0, 0.525],
      "45": [-0.08056, 0.53055, 0, 0, 0.525],
      "46": [0, 0.125, 0, 0, 0.525],
      "47": [0.08333, 0.69444, 0, 0, 0.525],
      "48": [0, 0.61111, 0, 0, 0.525],
      "49": [0, 0.61111, 0, 0, 0.525],
      "50": [0, 0.61111, 0, 0, 0.525],
      "51": [0, 0.61111, 0, 0, 0.525],
      "52": [0, 0.61111, 0, 0, 0.525],
      "53": [0, 0.61111, 0, 0, 0.525],
      "54": [0, 0.61111, 0, 0, 0.525],
      "55": [0, 0.61111, 0, 0, 0.525],
      "56": [0, 0.61111, 0, 0, 0.525],
      "57": [0, 0.61111, 0, 0, 0.525],
      "58": [0, 0.43056, 0, 0, 0.525],
      "59": [0.13889, 0.43056, 0, 0, 0.525],
      "60": [-0.05556, 0.55556, 0, 0, 0.525],
      "61": [-0.19549, 0.41562, 0, 0, 0.525],
      "62": [-0.05556, 0.55556, 0, 0, 0.525],
      "63": [0, 0.61111, 0, 0, 0.525],
      "64": [0, 0.61111, 0, 0, 0.525],
      "65": [0, 0.61111, 0, 0, 0.525],
      "66": [0, 0.61111, 0, 0, 0.525],
      "67": [0, 0.61111, 0, 0, 0.525],
      "68": [0, 0.61111, 0, 0, 0.525],
      "69": [0, 0.61111, 0, 0, 0.525],
      "70": [0, 0.61111, 0, 0, 0.525],
      "71": [0, 0.61111, 0, 0, 0.525],
      "72": [0, 0.61111, 0, 0, 0.525],
      "73": [0, 0.61111, 0, 0, 0.525],
      "74": [0, 0.61111, 0, 0, 0.525],
      "75": [0, 0.61111, 0, 0, 0.525],
      "76": [0, 0.61111, 0, 0, 0.525],
      "77": [0, 0.61111, 0, 0, 0.525],
      "78": [0, 0.61111, 0, 0, 0.525],
      "79": [0, 0.61111, 0, 0, 0.525],
      "80": [0, 0.61111, 0, 0, 0.525],
      "81": [0.13889, 0.61111, 0, 0, 0.525],
      "82": [0, 0.61111, 0, 0, 0.525],
      "83": [0, 0.61111, 0, 0, 0.525],
      "84": [0, 0.61111, 0, 0, 0.525],
      "85": [0, 0.61111, 0, 0, 0.525],
      "86": [0, 0.61111, 0, 0, 0.525],
      "87": [0, 0.61111, 0, 0, 0.525],
      "88": [0, 0.61111, 0, 0, 0.525],
      "89": [0, 0.61111, 0, 0, 0.525],
      "90": [0, 0.61111, 0, 0, 0.525],
      "91": [0.08333, 0.69444, 0, 0, 0.525],
      "92": [0.08333, 0.69444, 0, 0, 0.525],
      "93": [0.08333, 0.69444, 0, 0, 0.525],
      "94": [0, 0.61111, 0, 0, 0.525],
      "95": [0.09514, 0, 0, 0, 0.525],
      "96": [0, 0.61111, 0, 0, 0.525],
      "97": [0, 0.43056, 0, 0, 0.525],
      "98": [0, 0.61111, 0, 0, 0.525],
      "99": [0, 0.43056, 0, 0, 0.525],
      "100": [0, 0.61111, 0, 0, 0.525],
      "101": [0, 0.43056, 0, 0, 0.525],
      "102": [0, 0.61111, 0, 0, 0.525],
      "103": [0.22222, 0.43056, 0, 0, 0.525],
      "104": [0, 0.61111, 0, 0, 0.525],
      "105": [0, 0.61111, 0, 0, 0.525],
      "106": [0.22222, 0.61111, 0, 0, 0.525],
      "107": [0, 0.61111, 0, 0, 0.525],
      "108": [0, 0.61111, 0, 0, 0.525],
      "109": [0, 0.43056, 0, 0, 0.525],
      "110": [0, 0.43056, 0, 0, 0.525],
      "111": [0, 0.43056, 0, 0, 0.525],
      "112": [0.22222, 0.43056, 0, 0, 0.525],
      "113": [0.22222, 0.43056, 0, 0, 0.525],
      "114": [0, 0.43056, 0, 0, 0.525],
      "115": [0, 0.43056, 0, 0, 0.525],
      "116": [0, 0.55358, 0, 0, 0.525],
      "117": [0, 0.43056, 0, 0, 0.525],
      "118": [0, 0.43056, 0, 0, 0.525],
      "119": [0, 0.43056, 0, 0, 0.525],
      "120": [0, 0.43056, 0, 0, 0.525],
      "121": [0.22222, 0.43056, 0, 0, 0.525],
      "122": [0, 0.43056, 0, 0, 0.525],
      "123": [0.08333, 0.69444, 0, 0, 0.525],
      "124": [0.08333, 0.69444, 0, 0, 0.525],
      "125": [0.08333, 0.69444, 0, 0, 0.525],
      "126": [0, 0.61111, 0, 0, 0.525],
      "127": [0, 0.61111, 0, 0, 0.525],
      "160": [0, 0, 0, 0, 0.525],
      "176": [0, 0.61111, 0, 0, 0.525],
      "184": [0.19445, 0, 0, 0, 0.525],
      "305": [0, 0.43056, 0, 0, 0.525],
      "567": [0.22222, 0.43056, 0, 0, 0.525],
      "711": [0, 0.56597, 0, 0, 0.525],
      "713": [0, 0.56555, 0, 0, 0.525],
      "714": [0, 0.61111, 0, 0, 0.525],
      "715": [0, 0.61111, 0, 0, 0.525],
      "728": [0, 0.61111, 0, 0, 0.525],
      "730": [0, 0.61111, 0, 0, 0.525],
      "770": [0, 0.61111, 0, 0, 0.525],
      "771": [0, 0.61111, 0, 0, 0.525],
      "776": [0, 0.61111, 0, 0, 0.525],
      "915": [0, 0.61111, 0, 0, 0.525],
      "916": [0, 0.61111, 0, 0, 0.525],
      "920": [0, 0.61111, 0, 0, 0.525],
      "923": [0, 0.61111, 0, 0, 0.525],
      "926": [0, 0.61111, 0, 0, 0.525],
      "928": [0, 0.61111, 0, 0, 0.525],
      "931": [0, 0.61111, 0, 0, 0.525],
      "933": [0, 0.61111, 0, 0, 0.525],
      "934": [0, 0.61111, 0, 0, 0.525],
      "936": [0, 0.61111, 0, 0, 0.525],
      "937": [0, 0.61111, 0, 0, 0.525],
      "8216": [0, 0.61111, 0, 0, 0.525],
      "8217": [0, 0.61111, 0, 0, 0.525],
      "8242": [0, 0.61111, 0, 0, 0.525],
      "9251": [0.11111, 0.21944, 0, 0, 0.525]
    }
  };
  var sigmasAndXis = {
    slant: [0.25, 0.25, 0.25],
    // sigma1
    space: [0, 0, 0],
    // sigma2
    stretch: [0, 0, 0],
    // sigma3
    shrink: [0, 0, 0],
    // sigma4
    xHeight: [0.431, 0.431, 0.431],
    // sigma5
    quad: [1, 1.171, 1.472],
    // sigma6
    extraSpace: [0, 0, 0],
    // sigma7
    num1: [0.677, 0.732, 0.925],
    // sigma8
    num2: [0.394, 0.384, 0.387],
    // sigma9
    num3: [0.444, 0.471, 0.504],
    // sigma10
    denom1: [0.686, 0.752, 1.025],
    // sigma11
    denom2: [0.345, 0.344, 0.532],
    // sigma12
    sup1: [0.413, 0.503, 0.504],
    // sigma13
    sup2: [0.363, 0.431, 0.404],
    // sigma14
    sup3: [0.289, 0.286, 0.294],
    // sigma15
    sub1: [0.15, 0.143, 0.2],
    // sigma16
    sub2: [0.247, 0.286, 0.4],
    // sigma17
    supDrop: [0.386, 0.353, 0.494],
    // sigma18
    subDrop: [0.05, 0.071, 0.1],
    // sigma19
    delim1: [2.39, 1.7, 1.98],
    // sigma20
    delim2: [1.01, 1.157, 1.42],
    // sigma21
    axisHeight: [0.25, 0.25, 0.25],
    // sigma22
    // These font metrics are extracted from TeX by using tftopl on cmex10.tfm;
    // they correspond to the font parameters of the extension fonts (family 3).
    // See the TeXbook, page 441. In AMSTeX, the extension fonts scale; to
    // match cmex7, we'd use cmex7.tfm values for script and scriptscript
    // values.
    defaultRuleThickness: [0.04, 0.049, 0.049],
    // xi8; cmex7: 0.049
    bigOpSpacing1: [0.111, 0.111, 0.111],
    // xi9
    bigOpSpacing2: [0.166, 0.166, 0.166],
    // xi10
    bigOpSpacing3: [0.2, 0.2, 0.2],
    // xi11
    bigOpSpacing4: [0.6, 0.611, 0.611],
    // xi12; cmex7: 0.611
    bigOpSpacing5: [0.1, 0.143, 0.143],
    // xi13; cmex7: 0.143
    // The \sqrt rule width is taken from the height of the surd character.
    // Since we use the same font at all sizes, this thickness doesn't scale.
    sqrtRuleThickness: [0.04, 0.04, 0.04],
    // This value determines how large a pt is, for metrics which are defined
    // in terms of pts.
    // This value is also used in katex.scss; if you change it make sure the
    // values match.
    ptPerEm: [10, 10, 10],
    // The space between adjacent `|` columns in an array definition. From
    // `\showthe\doublerulesep` in LaTeX. Equals 2.0 / ptPerEm.
    doubleRuleSep: [0.2, 0.2, 0.2],
    // The width of separator lines in {array} environments. From
    // `\showthe\arrayrulewidth` in LaTeX. Equals 0.4 / ptPerEm.
    arrayRuleWidth: [0.04, 0.04, 0.04],
    // Two values from LaTeX source2e:
    fboxsep: [0.3, 0.3, 0.3],
    //        3 pt / ptPerEm
    fboxrule: [0.04, 0.04, 0.04]
    // 0.4 pt / ptPerEm
  };
  var extraCharacterMap = {
    // Latin-1
    "\xC5": "A",
    "\xD0": "D",
    "\xDE": "o",
    "\xE5": "a",
    "\xF0": "d",
    "\xFE": "o",
    // Cyrillic
    "\u0410": "A",
    "\u0411": "B",
    "\u0412": "B",
    "\u0413": "F",
    "\u0414": "A",
    "\u0415": "E",
    "\u0416": "K",
    "\u0417": "3",
    "\u0418": "N",
    "\u0419": "N",
    "\u041A": "K",
    "\u041B": "N",
    "\u041C": "M",
    "\u041D": "H",
    "\u041E": "O",
    "\u041F": "N",
    "\u0420": "P",
    "\u0421": "C",
    "\u0422": "T",
    "\u0423": "y",
    "\u0424": "O",
    "\u0425": "X",
    "\u0426": "U",
    "\u0427": "h",
    "\u0428": "W",
    "\u0429": "W",
    "\u042A": "B",
    "\u042B": "X",
    "\u042C": "B",
    "\u042D": "3",
    "\u042E": "X",
    "\u042F": "R",
    "\u0430": "a",
    "\u0431": "b",
    "\u0432": "a",
    "\u0433": "r",
    "\u0434": "y",
    "\u0435": "e",
    "\u0436": "m",
    "\u0437": "e",
    "\u0438": "n",
    "\u0439": "n",
    "\u043A": "n",
    "\u043B": "n",
    "\u043C": "m",
    "\u043D": "n",
    "\u043E": "o",
    "\u043F": "n",
    "\u0440": "p",
    "\u0441": "c",
    "\u0442": "o",
    "\u0443": "y",
    "\u0444": "b",
    "\u0445": "x",
    "\u0446": "n",
    "\u0447": "n",
    "\u0448": "w",
    "\u0449": "w",
    "\u044A": "a",
    "\u044B": "m",
    "\u044C": "a",
    "\u044D": "e",
    "\u044E": "m",
    "\u044F": "r"
  };
  function setFontMetrics(fontName, metrics) {
    fontMetricsData[fontName] = metrics;
  }
  function getCharacterMetrics(character, font, mode) {
    if (!fontMetricsData[font]) {
      throw new Error("Font metrics not found for font: " + font + ".");
    }
    var ch = character.charCodeAt(0);
    var metrics = fontMetricsData[font][ch];
    if (!metrics && character[0] in extraCharacterMap) {
      ch = extraCharacterMap[character[0]].charCodeAt(0);
      metrics = fontMetricsData[font][ch];
    }
    if (!metrics && mode === "text") {
      if (supportedCodepoint(ch)) {
        metrics = fontMetricsData[font][77];
      }
    }
    if (metrics) {
      return {
        depth: metrics[0],
        height: metrics[1],
        italic: metrics[2],
        skew: metrics[3],
        width: metrics[4]
      };
    }
  }
  var fontMetricsBySizeIndex = {};
  function getGlobalMetrics(size) {
    var sizeIndex;
    if (size >= 5) {
      sizeIndex = 0;
    } else if (size >= 3) {
      sizeIndex = 1;
    } else {
      sizeIndex = 2;
    }
    if (!fontMetricsBySizeIndex[sizeIndex]) {
      var metrics = fontMetricsBySizeIndex[sizeIndex] = {
        cssEmPerMu: sigmasAndXis.quad[sizeIndex] / 18
      };
      for (var key in sigmasAndXis) {
        if (sigmasAndXis.hasOwnProperty(key)) {
          metrics[key] = sigmasAndXis[key][sizeIndex];
        }
      }
    }
    return fontMetricsBySizeIndex[sizeIndex];
  }
  var sizeStyleMap = [
    // Each element contains [textsize, scriptsize, scriptscriptsize].
    // The size mappings are taken from TeX with \normalsize=10pt.
    [1, 1, 1],
    // size1: [5, 5, 5]              \tiny
    [2, 1, 1],
    // size2: [6, 5, 5]
    [3, 1, 1],
    // size3: [7, 5, 5]              \scriptsize
    [4, 2, 1],
    // size4: [8, 6, 5]              \footnotesize
    [5, 2, 1],
    // size5: [9, 6, 5]              \small
    [6, 3, 1],
    // size6: [10, 7, 5]             \normalsize
    [7, 4, 2],
    // size7: [12, 8, 6]             \large
    [8, 6, 3],
    // size8: [14.4, 10, 7]          \Large
    [9, 7, 6],
    // size9: [17.28, 12, 10]        \LARGE
    [10, 8, 7],
    // size10: [20.74, 14.4, 12]     \huge
    [11, 10, 9]
    // size11: [24.88, 20.74, 17.28] \HUGE
  ];
  var sizeMultipliers = [
    // fontMetrics.js:getGlobalMetrics also uses size indexes, so if
    // you change size indexes, change that function.
    0.5,
    0.6,
    0.7,
    0.8,
    0.9,
    1,
    1.2,
    1.44,
    1.728,
    2.074,
    2.488
  ];
  var sizeAtStyle = function sizeAtStyle2(size, style) {
    return style.size < 2 ? size : sizeStyleMap[size - 1][style.size - 1];
  };
  var Options = class _Options {
    // A font family applies to a group of fonts (i.e. SansSerif), while a font
    // represents a specific font (i.e. SansSerif Bold).
    // See: https://tex.stackexchange.com/questions/22350/difference-between-textrm-and-mathrm
    /**
     * The base size index.
     */
    constructor(data2) {
      this.style = void 0;
      this.color = void 0;
      this.size = void 0;
      this.textSize = void 0;
      this.phantom = void 0;
      this.font = void 0;
      this.fontFamily = void 0;
      this.fontWeight = void 0;
      this.fontShape = void 0;
      this.sizeMultiplier = void 0;
      this.maxSize = void 0;
      this.minRuleThickness = void 0;
      this._fontMetrics = void 0;
      this.style = data2.style;
      this.color = data2.color;
      this.size = data2.size || _Options.BASESIZE;
      this.textSize = data2.textSize || this.size;
      this.phantom = !!data2.phantom;
      this.font = data2.font || "";
      this.fontFamily = data2.fontFamily || "";
      this.fontWeight = data2.fontWeight || "";
      this.fontShape = data2.fontShape || "";
      this.sizeMultiplier = sizeMultipliers[this.size - 1];
      this.maxSize = data2.maxSize;
      this.minRuleThickness = data2.minRuleThickness;
      this._fontMetrics = void 0;
    }
    /**
     * Returns a new options object with the same properties as "this".  Properties
     * from "extension" will be copied to the new options object.
     */
    extend(extension) {
      var data2 = {
        style: this.style,
        size: this.size,
        textSize: this.textSize,
        color: this.color,
        phantom: this.phantom,
        font: this.font,
        fontFamily: this.fontFamily,
        fontWeight: this.fontWeight,
        fontShape: this.fontShape,
        maxSize: this.maxSize,
        minRuleThickness: this.minRuleThickness
      };
      for (var key in extension) {
        if (extension.hasOwnProperty(key)) {
          data2[key] = extension[key];
        }
      }
      return new _Options(data2);
    }
    /**
     * Return an options object with the given style. If `this.style === style`,
     * returns `this`.
     */
    havingStyle(style) {
      if (this.style === style) {
        return this;
      } else {
        return this.extend({
          style,
          size: sizeAtStyle(this.textSize, style)
        });
      }
    }
    /**
     * Return an options object with a cramped version of the current style. If
     * the current style is cramped, returns `this`.
     */
    havingCrampedStyle() {
      return this.havingStyle(this.style.cramp());
    }
    /**
     * Return an options object with the given size and in at least `\textstyle`.
     * Returns `this` if appropriate.
     */
    havingSize(size) {
      if (this.size === size && this.textSize === size) {
        return this;
      } else {
        return this.extend({
          style: this.style.text(),
          size,
          textSize: size,
          sizeMultiplier: sizeMultipliers[size - 1]
        });
      }
    }
    /**
     * Like `this.havingSize(BASESIZE).havingStyle(style)`. If `style` is omitted,
     * changes to at least `\textstyle`.
     */
    havingBaseStyle(style) {
      style = style || this.style.text();
      var wantSize = sizeAtStyle(_Options.BASESIZE, style);
      if (this.size === wantSize && this.textSize === _Options.BASESIZE && this.style === style) {
        return this;
      } else {
        return this.extend({
          style,
          size: wantSize
        });
      }
    }
    /**
     * Remove the effect of sizing changes such as \Huge.
     * Keep the effect of the current style, such as \scriptstyle.
     */
    havingBaseSizing() {
      var size;
      switch (this.style.id) {
        case 4:
        case 5:
          size = 3;
          break;
        case 6:
        case 7:
          size = 1;
          break;
        default:
          size = 6;
      }
      return this.extend({
        style: this.style.text(),
        size
      });
    }
    /**
     * Create a new options object with the given color.
     */
    withColor(color) {
      return this.extend({
        color
      });
    }
    /**
     * Create a new options object with "phantom" set to true.
     */
    withPhantom() {
      return this.extend({
        phantom: true
      });
    }
    /**
     * Creates a new options object with the given math font or old text font.
     * @type {[type]}
     */
    withFont(font) {
      return this.extend({
        font
      });
    }
    /**
     * Create a new options objects with the given fontFamily.
     */
    withTextFontFamily(fontFamily) {
      return this.extend({
        fontFamily,
        font: ""
      });
    }
    /**
     * Creates a new options object with the given font weight
     */
    withTextFontWeight(fontWeight) {
      return this.extend({
        fontWeight,
        font: ""
      });
    }
    /**
     * Creates a new options object with the given font weight
     */
    withTextFontShape(fontShape) {
      return this.extend({
        fontShape,
        font: ""
      });
    }
    /**
     * Return the CSS sizing classes required to switch from enclosing options
     * `oldOptions` to `this`. Returns an array of classes.
     */
    sizingClasses(oldOptions) {
      if (oldOptions.size !== this.size) {
        return ["sizing", "reset-size" + oldOptions.size, "size" + this.size];
      } else {
        return [];
      }
    }
    /**
     * Return the CSS sizing classes required to switch to the base size. Like
     * `this.havingSize(BASESIZE).sizingClasses(this)`.
     */
    baseSizingClasses() {
      if (this.size !== _Options.BASESIZE) {
        return ["sizing", "reset-size" + this.size, "size" + _Options.BASESIZE];
      } else {
        return [];
      }
    }
    /**
     * Return the font metrics for this size.
     */
    fontMetrics() {
      if (!this._fontMetrics) {
        this._fontMetrics = getGlobalMetrics(this.size);
      }
      return this._fontMetrics;
    }
    /**
     * Gets the CSS color of the current options object
     */
    getColor() {
      if (this.phantom) {
        return "transparent";
      } else {
        return this.color;
      }
    }
  };
  Options.BASESIZE = 6;
  var ptPerUnit = {
    // https://en.wikibooks.org/wiki/LaTeX/Lengths and
    // https://tex.stackexchange.com/a/8263
    "pt": 1,
    // TeX point
    "mm": 7227 / 2540,
    // millimeter
    "cm": 7227 / 254,
    // centimeter
    "in": 72.27,
    // inch
    "bp": 803 / 800,
    // big (PostScript) points
    "pc": 12,
    // pica
    "dd": 1238 / 1157,
    // didot
    "cc": 14856 / 1157,
    // cicero (12 didot)
    "nd": 685 / 642,
    // new didot
    "nc": 1370 / 107,
    // new cicero (12 new didot)
    "sp": 1 / 65536,
    // scaled point (TeX's internal smallest unit)
    // https://tex.stackexchange.com/a/41371
    "px": 803 / 800
    // \pdfpxdimen defaults to 1 bp in pdfTeX and LuaTeX
  };
  var relativeUnit = {
    "ex": true,
    "em": true,
    "mu": true
  };
  var validUnit = function validUnit2(unit) {
    if (typeof unit !== "string") {
      unit = unit.unit;
    }
    return unit in ptPerUnit || unit in relativeUnit || unit === "ex";
  };
  var calculateSize = function calculateSize2(sizeValue, options) {
    var scale;
    if (sizeValue.unit in ptPerUnit) {
      scale = ptPerUnit[sizeValue.unit] / options.fontMetrics().ptPerEm / options.sizeMultiplier;
    } else if (sizeValue.unit === "mu") {
      scale = options.fontMetrics().cssEmPerMu;
    } else {
      var unitOptions;
      if (options.style.isTight()) {
        unitOptions = options.havingStyle(options.style.text());
      } else {
        unitOptions = options;
      }
      if (sizeValue.unit === "ex") {
        scale = unitOptions.fontMetrics().xHeight;
      } else if (sizeValue.unit === "em") {
        scale = unitOptions.fontMetrics().quad;
      } else {
        throw new ParseError("Invalid unit: '" + sizeValue.unit + "'");
      }
      if (unitOptions !== options) {
        scale *= unitOptions.sizeMultiplier / options.sizeMultiplier;
      }
    }
    return Math.min(sizeValue.number * scale, options.maxSize);
  };
  var makeEm = function makeEm2(n) {
    return +n.toFixed(4) + "em";
  };
  var createClass = function createClass2(classes) {
    return classes.filter((cls) => cls).join(" ");
  };
  var initNode = function initNode2(classes, options, style) {
    this.classes = classes || [];
    this.attributes = {};
    this.height = 0;
    this.depth = 0;
    this.maxFontSize = 0;
    this.style = style || {};
    if (options) {
      if (options.style.isTight()) {
        this.classes.push("mtight");
      }
      var color = options.getColor();
      if (color) {
        this.style.color = color;
      }
    }
  };
  var toNode = function toNode2(tagName) {
    var node = document.createElement(tagName);
    node.className = createClass(this.classes);
    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        node.style[style] = this.style[style];
      }
    }
    for (var attr in this.attributes) {
      if (this.attributes.hasOwnProperty(attr)) {
        node.setAttribute(attr, this.attributes[attr]);
      }
    }
    for (var i = 0; i < this.children.length; i++) {
      node.appendChild(this.children[i].toNode());
    }
    return node;
  };
  var invalidAttributeNameRegex = /[\s"'>/=\x00-\x1f]/;
  var toMarkup = function toMarkup2(tagName) {
    var markup = "<" + tagName;
    if (this.classes.length) {
      markup += ' class="' + utils.escape(createClass(this.classes)) + '"';
    }
    var styles2 = "";
    for (var style in this.style) {
      if (this.style.hasOwnProperty(style)) {
        styles2 += utils.hyphenate(style) + ":" + this.style[style] + ";";
      }
    }
    if (styles2) {
      markup += ' style="' + utils.escape(styles2) + '"';
    }
    for (var attr in this.attributes) {
      if (this.attributes.hasOwnProperty(attr)) {
        if (invalidAttributeNameRegex.test(attr)) {
          throw new ParseError("Invalid attribute name '" + attr + "'");
        }
        markup += " " + attr + '="' + utils.escape(this.attributes[attr]) + '"';
      }
    }
    markup += ">";
    for (var i = 0; i < this.children.length; i++) {
      markup += this.children[i].toMarkup();
    }
    markup += "</" + tagName + ">";
    return markup;
  };
  var Span = class {
    constructor(classes, children, options, style) {
      this.children = void 0;
      this.attributes = void 0;
      this.classes = void 0;
      this.height = void 0;
      this.depth = void 0;
      this.width = void 0;
      this.maxFontSize = void 0;
      this.style = void 0;
      initNode.call(this, classes, options, style);
      this.children = children || [];
    }
    /**
     * Sets an arbitrary attribute on the span. Warning: use this wisely. Not
     * all browsers support attributes the same, and having too many custom
     * attributes is probably bad.
     */
    setAttribute(attribute, value) {
      this.attributes[attribute] = value;
    }
    hasClass(className) {
      return this.classes.includes(className);
    }
    toNode() {
      return toNode.call(this, "span");
    }
    toMarkup() {
      return toMarkup.call(this, "span");
    }
  };
  var Anchor = class {
    constructor(href, classes, children, options) {
      this.children = void 0;
      this.attributes = void 0;
      this.classes = void 0;
      this.height = void 0;
      this.depth = void 0;
      this.maxFontSize = void 0;
      this.style = void 0;
      initNode.call(this, classes, options);
      this.children = children || [];
      this.setAttribute("href", href);
    }
    setAttribute(attribute, value) {
      this.attributes[attribute] = value;
    }
    hasClass(className) {
      return this.classes.includes(className);
    }
    toNode() {
      return toNode.call(this, "a");
    }
    toMarkup() {
      return toMarkup.call(this, "a");
    }
  };
  var Img = class {
    constructor(src, alt, style) {
      this.src = void 0;
      this.alt = void 0;
      this.classes = void 0;
      this.height = void 0;
      this.depth = void 0;
      this.maxFontSize = void 0;
      this.style = void 0;
      this.alt = alt;
      this.src = src;
      this.classes = ["mord"];
      this.style = style;
    }
    hasClass(className) {
      return this.classes.includes(className);
    }
    toNode() {
      var node = document.createElement("img");
      node.src = this.src;
      node.alt = this.alt;
      node.className = "mord";
      for (var style in this.style) {
        if (this.style.hasOwnProperty(style)) {
          node.style[style] = this.style[style];
        }
      }
      return node;
    }
    toMarkup() {
      var markup = '<img src="' + utils.escape(this.src) + '"' + (' alt="' + utils.escape(this.alt) + '"');
      var styles2 = "";
      for (var style in this.style) {
        if (this.style.hasOwnProperty(style)) {
          styles2 += utils.hyphenate(style) + ":" + this.style[style] + ";";
        }
      }
      if (styles2) {
        markup += ' style="' + utils.escape(styles2) + '"';
      }
      markup += "'/>";
      return markup;
    }
  };
  var iCombinations = {
    "\xEE": "\u0131\u0302",
    "\xEF": "\u0131\u0308",
    "\xED": "\u0131\u0301",
    // 'ī': '\u0131\u0304', // enable when we add Extended Latin
    "\xEC": "\u0131\u0300"
  };
  var SymbolNode = class {
    constructor(text2, height, depth, italic, skew, width, classes, style) {
      this.text = void 0;
      this.height = void 0;
      this.depth = void 0;
      this.italic = void 0;
      this.skew = void 0;
      this.width = void 0;
      this.maxFontSize = void 0;
      this.classes = void 0;
      this.style = void 0;
      this.text = text2;
      this.height = height || 0;
      this.depth = depth || 0;
      this.italic = italic || 0;
      this.skew = skew || 0;
      this.width = width || 0;
      this.classes = classes || [];
      this.style = style || {};
      this.maxFontSize = 0;
      var script2 = scriptFromCodepoint(this.text.charCodeAt(0));
      if (script2) {
        this.classes.push(script2 + "_fallback");
      }
      if (/[îïíì]/.test(this.text)) {
        this.text = iCombinations[this.text];
      }
    }
    hasClass(className) {
      return this.classes.includes(className);
    }
    /**
     * Creates a text node or span from a symbol node. Note that a span is only
     * created if it is needed.
     */
    toNode() {
      var node = document.createTextNode(this.text);
      var span = null;
      if (this.italic > 0) {
        span = document.createElement("span");
        span.style.marginRight = makeEm(this.italic);
      }
      if (this.classes.length > 0) {
        span = span || document.createElement("span");
        span.className = createClass(this.classes);
      }
      for (var style in this.style) {
        if (this.style.hasOwnProperty(style)) {
          span = span || document.createElement("span");
          span.style[style] = this.style[style];
        }
      }
      if (span) {
        span.appendChild(node);
        return span;
      } else {
        return node;
      }
    }
    /**
     * Creates markup for a symbol node.
     */
    toMarkup() {
      var needsSpan = false;
      var markup = "<span";
      if (this.classes.length) {
        needsSpan = true;
        markup += ' class="';
        markup += utils.escape(createClass(this.classes));
        markup += '"';
      }
      var styles2 = "";
      if (this.italic > 0) {
        styles2 += "margin-right:" + this.italic + "em;";
      }
      for (var style in this.style) {
        if (this.style.hasOwnProperty(style)) {
          styles2 += utils.hyphenate(style) + ":" + this.style[style] + ";";
        }
      }
      if (styles2) {
        needsSpan = true;
        markup += ' style="' + utils.escape(styles2) + '"';
      }
      var escaped = utils.escape(this.text);
      if (needsSpan) {
        markup += ">";
        markup += escaped;
        markup += "</span>";
        return markup;
      } else {
        return escaped;
      }
    }
  };
  var SvgNode = class {
    constructor(children, attributes) {
      this.children = void 0;
      this.attributes = void 0;
      this.children = children || [];
      this.attributes = attributes || {};
    }
    toNode() {
      var svgNS = "http://www.w3.org/2000/svg";
      var node = document.createElementNS(svgNS, "svg");
      for (var attr in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
          node.setAttribute(attr, this.attributes[attr]);
        }
      }
      for (var i = 0; i < this.children.length; i++) {
        node.appendChild(this.children[i].toNode());
      }
      return node;
    }
    toMarkup() {
      var markup = '<svg xmlns="http://www.w3.org/2000/svg"';
      for (var attr in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
          markup += " " + attr + '="' + utils.escape(this.attributes[attr]) + '"';
        }
      }
      markup += ">";
      for (var i = 0; i < this.children.length; i++) {
        markup += this.children[i].toMarkup();
      }
      markup += "</svg>";
      return markup;
    }
  };
  var PathNode = class {
    constructor(pathName, alternate) {
      this.pathName = void 0;
      this.alternate = void 0;
      this.pathName = pathName;
      this.alternate = alternate;
    }
    toNode() {
      var svgNS = "http://www.w3.org/2000/svg";
      var node = document.createElementNS(svgNS, "path");
      if (this.alternate) {
        node.setAttribute("d", this.alternate);
      } else {
        node.setAttribute("d", path[this.pathName]);
      }
      return node;
    }
    toMarkup() {
      if (this.alternate) {
        return '<path d="' + utils.escape(this.alternate) + '"/>';
      } else {
        return '<path d="' + utils.escape(path[this.pathName]) + '"/>';
      }
    }
  };
  var LineNode = class {
    constructor(attributes) {
      this.attributes = void 0;
      this.attributes = attributes || {};
    }
    toNode() {
      var svgNS = "http://www.w3.org/2000/svg";
      var node = document.createElementNS(svgNS, "line");
      for (var attr in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
          node.setAttribute(attr, this.attributes[attr]);
        }
      }
      return node;
    }
    toMarkup() {
      var markup = "<line";
      for (var attr in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
          markup += " " + attr + '="' + utils.escape(this.attributes[attr]) + '"';
        }
      }
      markup += "/>";
      return markup;
    }
  };
  function assertSymbolDomNode(group) {
    if (group instanceof SymbolNode) {
      return group;
    } else {
      throw new Error("Expected symbolNode but got " + String(group) + ".");
    }
  }
  function assertSpan(group) {
    if (group instanceof Span) {
      return group;
    } else {
      throw new Error("Expected span<HtmlDomNode> but got " + String(group) + ".");
    }
  }
  var ATOMS = {
    "bin": 1,
    "close": 1,
    "inner": 1,
    "open": 1,
    "punct": 1,
    "rel": 1
  };
  var NON_ATOMS = {
    "accent-token": 1,
    "mathord": 1,
    "op-token": 1,
    "spacing": 1,
    "textord": 1
  };
  var symbols = {
    "math": {},
    "text": {}
  };
  function defineSymbol(mode, font, group, replace, name, acceptUnicodeChar) {
    symbols[mode][name] = {
      font,
      group,
      replace
    };
    if (acceptUnicodeChar && replace) {
      symbols[mode][replace] = symbols[mode][name];
    }
  }
  var math = "math";
  var text = "text";
  var main = "main";
  var ams = "ams";
  var accent = "accent-token";
  var bin = "bin";
  var close = "close";
  var inner = "inner";
  var mathord = "mathord";
  var op = "op-token";
  var open = "open";
  var punct = "punct";
  var rel = "rel";
  var spacing = "spacing";
  var textord = "textord";
  defineSymbol(math, main, rel, "\u2261", "\\equiv", true);
  defineSymbol(math, main, rel, "\u227A", "\\prec", true);
  defineSymbol(math, main, rel, "\u227B", "\\succ", true);
  defineSymbol(math, main, rel, "\u223C", "\\sim", true);
  defineSymbol(math, main, rel, "\u22A5", "\\perp");
  defineSymbol(math, main, rel, "\u2AAF", "\\preceq", true);
  defineSymbol(math, main, rel, "\u2AB0", "\\succeq", true);
  defineSymbol(math, main, rel, "\u2243", "\\simeq", true);
  defineSymbol(math, main, rel, "\u2223", "\\mid", true);
  defineSymbol(math, main, rel, "\u226A", "\\ll", true);
  defineSymbol(math, main, rel, "\u226B", "\\gg", true);
  defineSymbol(math, main, rel, "\u224D", "\\asymp", true);
  defineSymbol(math, main, rel, "\u2225", "\\parallel");
  defineSymbol(math, main, rel, "\u22C8", "\\bowtie", true);
  defineSymbol(math, main, rel, "\u2323", "\\smile", true);
  defineSymbol(math, main, rel, "\u2291", "\\sqsubseteq", true);
  defineSymbol(math, main, rel, "\u2292", "\\sqsupseteq", true);
  defineSymbol(math, main, rel, "\u2250", "\\doteq", true);
  defineSymbol(math, main, rel, "\u2322", "\\frown", true);
  defineSymbol(math, main, rel, "\u220B", "\\ni", true);
  defineSymbol(math, main, rel, "\u221D", "\\propto", true);
  defineSymbol(math, main, rel, "\u22A2", "\\vdash", true);
  defineSymbol(math, main, rel, "\u22A3", "\\dashv", true);
  defineSymbol(math, main, rel, "\u220B", "\\owns");
  defineSymbol(math, main, punct, ".", "\\ldotp");
  defineSymbol(math, main, punct, "\u22C5", "\\cdotp");
  defineSymbol(math, main, textord, "#", "\\#");
  defineSymbol(text, main, textord, "#", "\\#");
  defineSymbol(math, main, textord, "&", "\\&");
  defineSymbol(text, main, textord, "&", "\\&");
  defineSymbol(math, main, textord, "\u2135", "\\aleph", true);
  defineSymbol(math, main, textord, "\u2200", "\\forall", true);
  defineSymbol(math, main, textord, "\u210F", "\\hbar", true);
  defineSymbol(math, main, textord, "\u2203", "\\exists", true);
  defineSymbol(math, main, textord, "\u2207", "\\nabla", true);
  defineSymbol(math, main, textord, "\u266D", "\\flat", true);
  defineSymbol(math, main, textord, "\u2113", "\\ell", true);
  defineSymbol(math, main, textord, "\u266E", "\\natural", true);
  defineSymbol(math, main, textord, "\u2663", "\\clubsuit", true);
  defineSymbol(math, main, textord, "\u2118", "\\wp", true);
  defineSymbol(math, main, textord, "\u266F", "\\sharp", true);
  defineSymbol(math, main, textord, "\u2662", "\\diamondsuit", true);
  defineSymbol(math, main, textord, "\u211C", "\\Re", true);
  defineSymbol(math, main, textord, "\u2661", "\\heartsuit", true);
  defineSymbol(math, main, textord, "\u2111", "\\Im", true);
  defineSymbol(math, main, textord, "\u2660", "\\spadesuit", true);
  defineSymbol(math, main, textord, "\xA7", "\\S", true);
  defineSymbol(text, main, textord, "\xA7", "\\S");
  defineSymbol(math, main, textord, "\xB6", "\\P", true);
  defineSymbol(text, main, textord, "\xB6", "\\P");
  defineSymbol(math, main, textord, "\u2020", "\\dag");
  defineSymbol(text, main, textord, "\u2020", "\\dag");
  defineSymbol(text, main, textord, "\u2020", "\\textdagger");
  defineSymbol(math, main, textord, "\u2021", "\\ddag");
  defineSymbol(text, main, textord, "\u2021", "\\ddag");
  defineSymbol(text, main, textord, "\u2021", "\\textdaggerdbl");
  defineSymbol(math, main, close, "\u23B1", "\\rmoustache", true);
  defineSymbol(math, main, open, "\u23B0", "\\lmoustache", true);
  defineSymbol(math, main, close, "\u27EF", "\\rgroup", true);
  defineSymbol(math, main, open, "\u27EE", "\\lgroup", true);
  defineSymbol(math, main, bin, "\u2213", "\\mp", true);
  defineSymbol(math, main, bin, "\u2296", "\\ominus", true);
  defineSymbol(math, main, bin, "\u228E", "\\uplus", true);
  defineSymbol(math, main, bin, "\u2293", "\\sqcap", true);
  defineSymbol(math, main, bin, "\u2217", "\\ast");
  defineSymbol(math, main, bin, "\u2294", "\\sqcup", true);
  defineSymbol(math, main, bin, "\u25EF", "\\bigcirc", true);
  defineSymbol(math, main, bin, "\u2219", "\\bullet", true);
  defineSymbol(math, main, bin, "\u2021", "\\ddagger");
  defineSymbol(math, main, bin, "\u2240", "\\wr", true);
  defineSymbol(math, main, bin, "\u2A3F", "\\amalg");
  defineSymbol(math, main, bin, "&", "\\And");
  defineSymbol(math, main, rel, "\u27F5", "\\longleftarrow", true);
  defineSymbol(math, main, rel, "\u21D0", "\\Leftarrow", true);
  defineSymbol(math, main, rel, "\u27F8", "\\Longleftarrow", true);
  defineSymbol(math, main, rel, "\u27F6", "\\longrightarrow", true);
  defineSymbol(math, main, rel, "\u21D2", "\\Rightarrow", true);
  defineSymbol(math, main, rel, "\u27F9", "\\Longrightarrow", true);
  defineSymbol(math, main, rel, "\u2194", "\\leftrightarrow", true);
  defineSymbol(math, main, rel, "\u27F7", "\\longleftrightarrow", true);
  defineSymbol(math, main, rel, "\u21D4", "\\Leftrightarrow", true);
  defineSymbol(math, main, rel, "\u27FA", "\\Longleftrightarrow", true);
  defineSymbol(math, main, rel, "\u21A6", "\\mapsto", true);
  defineSymbol(math, main, rel, "\u27FC", "\\longmapsto", true);
  defineSymbol(math, main, rel, "\u2197", "\\nearrow", true);
  defineSymbol(math, main, rel, "\u21A9", "\\hookleftarrow", true);
  defineSymbol(math, main, rel, "\u21AA", "\\hookrightarrow", true);
  defineSymbol(math, main, rel, "\u2198", "\\searrow", true);
  defineSymbol(math, main, rel, "\u21BC", "\\leftharpoonup", true);
  defineSymbol(math, main, rel, "\u21C0", "\\rightharpoonup", true);
  defineSymbol(math, main, rel, "\u2199", "\\swarrow", true);
  defineSymbol(math, main, rel, "\u21BD", "\\leftharpoondown", true);
  defineSymbol(math, main, rel, "\u21C1", "\\rightharpoondown", true);
  defineSymbol(math, main, rel, "\u2196", "\\nwarrow", true);
  defineSymbol(math, main, rel, "\u21CC", "\\rightleftharpoons", true);
  defineSymbol(math, ams, rel, "\u226E", "\\nless", true);
  defineSymbol(math, ams, rel, "\uE010", "\\@nleqslant");
  defineSymbol(math, ams, rel, "\uE011", "\\@nleqq");
  defineSymbol(math, ams, rel, "\u2A87", "\\lneq", true);
  defineSymbol(math, ams, rel, "\u2268", "\\lneqq", true);
  defineSymbol(math, ams, rel, "\uE00C", "\\@lvertneqq");
  defineSymbol(math, ams, rel, "\u22E6", "\\lnsim", true);
  defineSymbol(math, ams, rel, "\u2A89", "\\lnapprox", true);
  defineSymbol(math, ams, rel, "\u2280", "\\nprec", true);
  defineSymbol(math, ams, rel, "\u22E0", "\\npreceq", true);
  defineSymbol(math, ams, rel, "\u22E8", "\\precnsim", true);
  defineSymbol(math, ams, rel, "\u2AB9", "\\precnapprox", true);
  defineSymbol(math, ams, rel, "\u2241", "\\nsim", true);
  defineSymbol(math, ams, rel, "\uE006", "\\@nshortmid");
  defineSymbol(math, ams, rel, "\u2224", "\\nmid", true);
  defineSymbol(math, ams, rel, "\u22AC", "\\nvdash", true);
  defineSymbol(math, ams, rel, "\u22AD", "\\nvDash", true);
  defineSymbol(math, ams, rel, "\u22EA", "\\ntriangleleft");
  defineSymbol(math, ams, rel, "\u22EC", "\\ntrianglelefteq", true);
  defineSymbol(math, ams, rel, "\u228A", "\\subsetneq", true);
  defineSymbol(math, ams, rel, "\uE01A", "\\@varsubsetneq");
  defineSymbol(math, ams, rel, "\u2ACB", "\\subsetneqq", true);
  defineSymbol(math, ams, rel, "\uE017", "\\@varsubsetneqq");
  defineSymbol(math, ams, rel, "\u226F", "\\ngtr", true);
  defineSymbol(math, ams, rel, "\uE00F", "\\@ngeqslant");
  defineSymbol(math, ams, rel, "\uE00E", "\\@ngeqq");
  defineSymbol(math, ams, rel, "\u2A88", "\\gneq", true);
  defineSymbol(math, ams, rel, "\u2269", "\\gneqq", true);
  defineSymbol(math, ams, rel, "\uE00D", "\\@gvertneqq");
  defineSymbol(math, ams, rel, "\u22E7", "\\gnsim", true);
  defineSymbol(math, ams, rel, "\u2A8A", "\\gnapprox", true);
  defineSymbol(math, ams, rel, "\u2281", "\\nsucc", true);
  defineSymbol(math, ams, rel, "\u22E1", "\\nsucceq", true);
  defineSymbol(math, ams, rel, "\u22E9", "\\succnsim", true);
  defineSymbol(math, ams, rel, "\u2ABA", "\\succnapprox", true);
  defineSymbol(math, ams, rel, "\u2246", "\\ncong", true);
  defineSymbol(math, ams, rel, "\uE007", "\\@nshortparallel");
  defineSymbol(math, ams, rel, "\u2226", "\\nparallel", true);
  defineSymbol(math, ams, rel, "\u22AF", "\\nVDash", true);
  defineSymbol(math, ams, rel, "\u22EB", "\\ntriangleright");
  defineSymbol(math, ams, rel, "\u22ED", "\\ntrianglerighteq", true);
  defineSymbol(math, ams, rel, "\uE018", "\\@nsupseteqq");
  defineSymbol(math, ams, rel, "\u228B", "\\supsetneq", true);
  defineSymbol(math, ams, rel, "\uE01B", "\\@varsupsetneq");
  defineSymbol(math, ams, rel, "\u2ACC", "\\supsetneqq", true);
  defineSymbol(math, ams, rel, "\uE019", "\\@varsupsetneqq");
  defineSymbol(math, ams, rel, "\u22AE", "\\nVdash", true);
  defineSymbol(math, ams, rel, "\u2AB5", "\\precneqq", true);
  defineSymbol(math, ams, rel, "\u2AB6", "\\succneqq", true);
  defineSymbol(math, ams, rel, "\uE016", "\\@nsubseteqq");
  defineSymbol(math, ams, bin, "\u22B4", "\\unlhd");
  defineSymbol(math, ams, bin, "\u22B5", "\\unrhd");
  defineSymbol(math, ams, rel, "\u219A", "\\nleftarrow", true);
  defineSymbol(math, ams, rel, "\u219B", "\\nrightarrow", true);
  defineSymbol(math, ams, rel, "\u21CD", "\\nLeftarrow", true);
  defineSymbol(math, ams, rel, "\u21CF", "\\nRightarrow", true);
  defineSymbol(math, ams, rel, "\u21AE", "\\nleftrightarrow", true);
  defineSymbol(math, ams, rel, "\u21CE", "\\nLeftrightarrow", true);
  defineSymbol(math, ams, rel, "\u25B3", "\\vartriangle");
  defineSymbol(math, ams, textord, "\u210F", "\\hslash");
  defineSymbol(math, ams, textord, "\u25BD", "\\triangledown");
  defineSymbol(math, ams, textord, "\u25CA", "\\lozenge");
  defineSymbol(math, ams, textord, "\u24C8", "\\circledS");
  defineSymbol(math, ams, textord, "\xAE", "\\circledR");
  defineSymbol(text, ams, textord, "\xAE", "\\circledR");
  defineSymbol(math, ams, textord, "\u2221", "\\measuredangle", true);
  defineSymbol(math, ams, textord, "\u2204", "\\nexists");
  defineSymbol(math, ams, textord, "\u2127", "\\mho");
  defineSymbol(math, ams, textord, "\u2132", "\\Finv", true);
  defineSymbol(math, ams, textord, "\u2141", "\\Game", true);
  defineSymbol(math, ams, textord, "\u2035", "\\backprime");
  defineSymbol(math, ams, textord, "\u25B2", "\\blacktriangle");
  defineSymbol(math, ams, textord, "\u25BC", "\\blacktriangledown");
  defineSymbol(math, ams, textord, "\u25A0", "\\blacksquare");
  defineSymbol(math, ams, textord, "\u29EB", "\\blacklozenge");
  defineSymbol(math, ams, textord, "\u2605", "\\bigstar");
  defineSymbol(math, ams, textord, "\u2222", "\\sphericalangle", true);
  defineSymbol(math, ams, textord, "\u2201", "\\complement", true);
  defineSymbol(math, ams, textord, "\xF0", "\\eth", true);
  defineSymbol(text, main, textord, "\xF0", "\xF0");
  defineSymbol(math, ams, textord, "\u2571", "\\diagup");
  defineSymbol(math, ams, textord, "\u2572", "\\diagdown");
  defineSymbol(math, ams, textord, "\u25A1", "\\square");
  defineSymbol(math, ams, textord, "\u25A1", "\\Box");
  defineSymbol(math, ams, textord, "\u25CA", "\\Diamond");
  defineSymbol(math, ams, textord, "\xA5", "\\yen", true);
  defineSymbol(text, ams, textord, "\xA5", "\\yen", true);
  defineSymbol(math, ams, textord, "\u2713", "\\checkmark", true);
  defineSymbol(text, ams, textord, "\u2713", "\\checkmark");
  defineSymbol(math, ams, textord, "\u2136", "\\beth", true);
  defineSymbol(math, ams, textord, "\u2138", "\\daleth", true);
  defineSymbol(math, ams, textord, "\u2137", "\\gimel", true);
  defineSymbol(math, ams, textord, "\u03DD", "\\digamma", true);
  defineSymbol(math, ams, textord, "\u03F0", "\\varkappa");
  defineSymbol(math, ams, open, "\u250C", "\\@ulcorner", true);
  defineSymbol(math, ams, close, "\u2510", "\\@urcorner", true);
  defineSymbol(math, ams, open, "\u2514", "\\@llcorner", true);
  defineSymbol(math, ams, close, "\u2518", "\\@lrcorner", true);
  defineSymbol(math, ams, rel, "\u2266", "\\leqq", true);
  defineSymbol(math, ams, rel, "\u2A7D", "\\leqslant", true);
  defineSymbol(math, ams, rel, "\u2A95", "\\eqslantless", true);
  defineSymbol(math, ams, rel, "\u2272", "\\lesssim", true);
  defineSymbol(math, ams, rel, "\u2A85", "\\lessapprox", true);
  defineSymbol(math, ams, rel, "\u224A", "\\approxeq", true);
  defineSymbol(math, ams, bin, "\u22D6", "\\lessdot");
  defineSymbol(math, ams, rel, "\u22D8", "\\lll", true);
  defineSymbol(math, ams, rel, "\u2276", "\\lessgtr", true);
  defineSymbol(math, ams, rel, "\u22DA", "\\lesseqgtr", true);
  defineSymbol(math, ams, rel, "\u2A8B", "\\lesseqqgtr", true);
  defineSymbol(math, ams, rel, "\u2251", "\\doteqdot");
  defineSymbol(math, ams, rel, "\u2253", "\\risingdotseq", true);
  defineSymbol(math, ams, rel, "\u2252", "\\fallingdotseq", true);
  defineSymbol(math, ams, rel, "\u223D", "\\backsim", true);
  defineSymbol(math, ams, rel, "\u22CD", "\\backsimeq", true);
  defineSymbol(math, ams, rel, "\u2AC5", "\\subseteqq", true);
  defineSymbol(math, ams, rel, "\u22D0", "\\Subset", true);
  defineSymbol(math, ams, rel, "\u228F", "\\sqsubset", true);
  defineSymbol(math, ams, rel, "\u227C", "\\preccurlyeq", true);
  defineSymbol(math, ams, rel, "\u22DE", "\\curlyeqprec", true);
  defineSymbol(math, ams, rel, "\u227E", "\\precsim", true);
  defineSymbol(math, ams, rel, "\u2AB7", "\\precapprox", true);
  defineSymbol(math, ams, rel, "\u22B2", "\\vartriangleleft");
  defineSymbol(math, ams, rel, "\u22B4", "\\trianglelefteq");
  defineSymbol(math, ams, rel, "\u22A8", "\\vDash", true);
  defineSymbol(math, ams, rel, "\u22AA", "\\Vvdash", true);
  defineSymbol(math, ams, rel, "\u2323", "\\smallsmile");
  defineSymbol(math, ams, rel, "\u2322", "\\smallfrown");
  defineSymbol(math, ams, rel, "\u224F", "\\bumpeq", true);
  defineSymbol(math, ams, rel, "\u224E", "\\Bumpeq", true);
  defineSymbol(math, ams, rel, "\u2267", "\\geqq", true);
  defineSymbol(math, ams, rel, "\u2A7E", "\\geqslant", true);
  defineSymbol(math, ams, rel, "\u2A96", "\\eqslantgtr", true);
  defineSymbol(math, ams, rel, "\u2273", "\\gtrsim", true);
  defineSymbol(math, ams, rel, "\u2A86", "\\gtrapprox", true);
  defineSymbol(math, ams, bin, "\u22D7", "\\gtrdot");
  defineSymbol(math, ams, rel, "\u22D9", "\\ggg", true);
  defineSymbol(math, ams, rel, "\u2277", "\\gtrless", true);
  defineSymbol(math, ams, rel, "\u22DB", "\\gtreqless", true);
  defineSymbol(math, ams, rel, "\u2A8C", "\\gtreqqless", true);
  defineSymbol(math, ams, rel, "\u2256", "\\eqcirc", true);
  defineSymbol(math, ams, rel, "\u2257", "\\circeq", true);
  defineSymbol(math, ams, rel, "\u225C", "\\triangleq", true);
  defineSymbol(math, ams, rel, "\u223C", "\\thicksim");
  defineSymbol(math, ams, rel, "\u2248", "\\thickapprox");
  defineSymbol(math, ams, rel, "\u2AC6", "\\supseteqq", true);
  defineSymbol(math, ams, rel, "\u22D1", "\\Supset", true);
  defineSymbol(math, ams, rel, "\u2290", "\\sqsupset", true);
  defineSymbol(math, ams, rel, "\u227D", "\\succcurlyeq", true);
  defineSymbol(math, ams, rel, "\u22DF", "\\curlyeqsucc", true);
  defineSymbol(math, ams, rel, "\u227F", "\\succsim", true);
  defineSymbol(math, ams, rel, "\u2AB8", "\\succapprox", true);
  defineSymbol(math, ams, rel, "\u22B3", "\\vartriangleright");
  defineSymbol(math, ams, rel, "\u22B5", "\\trianglerighteq");
  defineSymbol(math, ams, rel, "\u22A9", "\\Vdash", true);
  defineSymbol(math, ams, rel, "\u2223", "\\shortmid");
  defineSymbol(math, ams, rel, "\u2225", "\\shortparallel");
  defineSymbol(math, ams, rel, "\u226C", "\\between", true);
  defineSymbol(math, ams, rel, "\u22D4", "\\pitchfork", true);
  defineSymbol(math, ams, rel, "\u221D", "\\varpropto");
  defineSymbol(math, ams, rel, "\u25C0", "\\blacktriangleleft");
  defineSymbol(math, ams, rel, "\u2234", "\\therefore", true);
  defineSymbol(math, ams, rel, "\u220D", "\\backepsilon");
  defineSymbol(math, ams, rel, "\u25B6", "\\blacktriangleright");
  defineSymbol(math, ams, rel, "\u2235", "\\because", true);
  defineSymbol(math, ams, rel, "\u22D8", "\\llless");
  defineSymbol(math, ams, rel, "\u22D9", "\\gggtr");
  defineSymbol(math, ams, bin, "\u22B2", "\\lhd");
  defineSymbol(math, ams, bin, "\u22B3", "\\rhd");
  defineSymbol(math, ams, rel, "\u2242", "\\eqsim", true);
  defineSymbol(math, main, rel, "\u22C8", "\\Join");
  defineSymbol(math, ams, rel, "\u2251", "\\Doteq", true);
  defineSymbol(math, ams, bin, "\u2214", "\\dotplus", true);
  defineSymbol(math, ams, bin, "\u2216", "\\smallsetminus");
  defineSymbol(math, ams, bin, "\u22D2", "\\Cap", true);
  defineSymbol(math, ams, bin, "\u22D3", "\\Cup", true);
  defineSymbol(math, ams, bin, "\u2A5E", "\\doublebarwedge", true);
  defineSymbol(math, ams, bin, "\u229F", "\\boxminus", true);
  defineSymbol(math, ams, bin, "\u229E", "\\boxplus", true);
  defineSymbol(math, ams, bin, "\u22C7", "\\divideontimes", true);
  defineSymbol(math, ams, bin, "\u22C9", "\\ltimes", true);
  defineSymbol(math, ams, bin, "\u22CA", "\\rtimes", true);
  defineSymbol(math, ams, bin, "\u22CB", "\\leftthreetimes", true);
  defineSymbol(math, ams, bin, "\u22CC", "\\rightthreetimes", true);
  defineSymbol(math, ams, bin, "\u22CF", "\\curlywedge", true);
  defineSymbol(math, ams, bin, "\u22CE", "\\curlyvee", true);
  defineSymbol(math, ams, bin, "\u229D", "\\circleddash", true);
  defineSymbol(math, ams, bin, "\u229B", "\\circledast", true);
  defineSymbol(math, ams, bin, "\u22C5", "\\centerdot");
  defineSymbol(math, ams, bin, "\u22BA", "\\intercal", true);
  defineSymbol(math, ams, bin, "\u22D2", "\\doublecap");
  defineSymbol(math, ams, bin, "\u22D3", "\\doublecup");
  defineSymbol(math, ams, bin, "\u22A0", "\\boxtimes", true);
  defineSymbol(math, ams, rel, "\u21E2", "\\dashrightarrow", true);
  defineSymbol(math, ams, rel, "\u21E0", "\\dashleftarrow", true);
  defineSymbol(math, ams, rel, "\u21C7", "\\leftleftarrows", true);
  defineSymbol(math, ams, rel, "\u21C6", "\\leftrightarrows", true);
  defineSymbol(math, ams, rel, "\u21DA", "\\Lleftarrow", true);
  defineSymbol(math, ams, rel, "\u219E", "\\twoheadleftarrow", true);
  defineSymbol(math, ams, rel, "\u21A2", "\\leftarrowtail", true);
  defineSymbol(math, ams, rel, "\u21AB", "\\looparrowleft", true);
  defineSymbol(math, ams, rel, "\u21CB", "\\leftrightharpoons", true);
  defineSymbol(math, ams, rel, "\u21B6", "\\curvearrowleft", true);
  defineSymbol(math, ams, rel, "\u21BA", "\\circlearrowleft", true);
  defineSymbol(math, ams, rel, "\u21B0", "\\Lsh", true);
  defineSymbol(math, ams, rel, "\u21C8", "\\upuparrows", true);
  defineSymbol(math, ams, rel, "\u21BF", "\\upharpoonleft", true);
  defineSymbol(math, ams, rel, "\u21C3", "\\downharpoonleft", true);
  defineSymbol(math, main, rel, "\u22B6", "\\origof", true);
  defineSymbol(math, main, rel, "\u22B7", "\\imageof", true);
  defineSymbol(math, ams, rel, "\u22B8", "\\multimap", true);
  defineSymbol(math, ams, rel, "\u21AD", "\\leftrightsquigarrow", true);
  defineSymbol(math, ams, rel, "\u21C9", "\\rightrightarrows", true);
  defineSymbol(math, ams, rel, "\u21C4", "\\rightleftarrows", true);
  defineSymbol(math, ams, rel, "\u21A0", "\\twoheadrightarrow", true);
  defineSymbol(math, ams, rel, "\u21A3", "\\rightarrowtail", true);
  defineSymbol(math, ams, rel, "\u21AC", "\\looparrowright", true);
  defineSymbol(math, ams, rel, "\u21B7", "\\curvearrowright", true);
  defineSymbol(math, ams, rel, "\u21BB", "\\circlearrowright", true);
  defineSymbol(math, ams, rel, "\u21B1", "\\Rsh", true);
  defineSymbol(math, ams, rel, "\u21CA", "\\downdownarrows", true);
  defineSymbol(math, ams, rel, "\u21BE", "\\upharpoonright", true);
  defineSymbol(math, ams, rel, "\u21C2", "\\downharpoonright", true);
  defineSymbol(math, ams, rel, "\u21DD", "\\rightsquigarrow", true);
  defineSymbol(math, ams, rel, "\u21DD", "\\leadsto");
  defineSymbol(math, ams, rel, "\u21DB", "\\Rrightarrow", true);
  defineSymbol(math, ams, rel, "\u21BE", "\\restriction");
  defineSymbol(math, main, textord, "\u2018", "`");
  defineSymbol(math, main, textord, "$", "\\$");
  defineSymbol(text, main, textord, "$", "\\$");
  defineSymbol(text, main, textord, "$", "\\textdollar");
  defineSymbol(math, main, textord, "%", "\\%");
  defineSymbol(text, main, textord, "%", "\\%");
  defineSymbol(math, main, textord, "_", "\\_");
  defineSymbol(text, main, textord, "_", "\\_");
  defineSymbol(text, main, textord, "_", "\\textunderscore");
  defineSymbol(math, main, textord, "\u2220", "\\angle", true);
  defineSymbol(math, main, textord, "\u221E", "\\infty", true);
  defineSymbol(math, main, textord, "\u2032", "\\prime");
  defineSymbol(math, main, textord, "\u25B3", "\\triangle");
  defineSymbol(math, main, textord, "\u0393", "\\Gamma", true);
  defineSymbol(math, main, textord, "\u0394", "\\Delta", true);
  defineSymbol(math, main, textord, "\u0398", "\\Theta", true);
  defineSymbol(math, main, textord, "\u039B", "\\Lambda", true);
  defineSymbol(math, main, textord, "\u039E", "\\Xi", true);
  defineSymbol(math, main, textord, "\u03A0", "\\Pi", true);
  defineSymbol(math, main, textord, "\u03A3", "\\Sigma", true);
  defineSymbol(math, main, textord, "\u03A5", "\\Upsilon", true);
  defineSymbol(math, main, textord, "\u03A6", "\\Phi", true);
  defineSymbol(math, main, textord, "\u03A8", "\\Psi", true);
  defineSymbol(math, main, textord, "\u03A9", "\\Omega", true);
  defineSymbol(math, main, textord, "A", "\u0391");
  defineSymbol(math, main, textord, "B", "\u0392");
  defineSymbol(math, main, textord, "E", "\u0395");
  defineSymbol(math, main, textord, "Z", "\u0396");
  defineSymbol(math, main, textord, "H", "\u0397");
  defineSymbol(math, main, textord, "I", "\u0399");
  defineSymbol(math, main, textord, "K", "\u039A");
  defineSymbol(math, main, textord, "M", "\u039C");
  defineSymbol(math, main, textord, "N", "\u039D");
  defineSymbol(math, main, textord, "O", "\u039F");
  defineSymbol(math, main, textord, "P", "\u03A1");
  defineSymbol(math, main, textord, "T", "\u03A4");
  defineSymbol(math, main, textord, "X", "\u03A7");
  defineSymbol(math, main, textord, "\xAC", "\\neg", true);
  defineSymbol(math, main, textord, "\xAC", "\\lnot");
  defineSymbol(math, main, textord, "\u22A4", "\\top");
  defineSymbol(math, main, textord, "\u22A5", "\\bot");
  defineSymbol(math, main, textord, "\u2205", "\\emptyset");
  defineSymbol(math, ams, textord, "\u2205", "\\varnothing");
  defineSymbol(math, main, mathord, "\u03B1", "\\alpha", true);
  defineSymbol(math, main, mathord, "\u03B2", "\\beta", true);
  defineSymbol(math, main, mathord, "\u03B3", "\\gamma", true);
  defineSymbol(math, main, mathord, "\u03B4", "\\delta", true);
  defineSymbol(math, main, mathord, "\u03F5", "\\epsilon", true);
  defineSymbol(math, main, mathord, "\u03B6", "\\zeta", true);
  defineSymbol(math, main, mathord, "\u03B7", "\\eta", true);
  defineSymbol(math, main, mathord, "\u03B8", "\\theta", true);
  defineSymbol(math, main, mathord, "\u03B9", "\\iota", true);
  defineSymbol(math, main, mathord, "\u03BA", "\\kappa", true);
  defineSymbol(math, main, mathord, "\u03BB", "\\lambda", true);
  defineSymbol(math, main, mathord, "\u03BC", "\\mu", true);
  defineSymbol(math, main, mathord, "\u03BD", "\\nu", true);
  defineSymbol(math, main, mathord, "\u03BE", "\\xi", true);
  defineSymbol(math, main, mathord, "\u03BF", "\\omicron", true);
  defineSymbol(math, main, mathord, "\u03C0", "\\pi", true);
  defineSymbol(math, main, mathord, "\u03C1", "\\rho", true);
  defineSymbol(math, main, mathord, "\u03C3", "\\sigma", true);
  defineSymbol(math, main, mathord, "\u03C4", "\\tau", true);
  defineSymbol(math, main, mathord, "\u03C5", "\\upsilon", true);
  defineSymbol(math, main, mathord, "\u03D5", "\\phi", true);
  defineSymbol(math, main, mathord, "\u03C7", "\\chi", true);
  defineSymbol(math, main, mathord, "\u03C8", "\\psi", true);
  defineSymbol(math, main, mathord, "\u03C9", "\\omega", true);
  defineSymbol(math, main, mathord, "\u03B5", "\\varepsilon", true);
  defineSymbol(math, main, mathord, "\u03D1", "\\vartheta", true);
  defineSymbol(math, main, mathord, "\u03D6", "\\varpi", true);
  defineSymbol(math, main, mathord, "\u03F1", "\\varrho", true);
  defineSymbol(math, main, mathord, "\u03C2", "\\varsigma", true);
  defineSymbol(math, main, mathord, "\u03C6", "\\varphi", true);
  defineSymbol(math, main, bin, "\u2217", "*", true);
  defineSymbol(math, main, bin, "+", "+");
  defineSymbol(math, main, bin, "\u2212", "-", true);
  defineSymbol(math, main, bin, "\u22C5", "\\cdot", true);
  defineSymbol(math, main, bin, "\u2218", "\\circ", true);
  defineSymbol(math, main, bin, "\xF7", "\\div", true);
  defineSymbol(math, main, bin, "\xB1", "\\pm", true);
  defineSymbol(math, main, bin, "\xD7", "\\times", true);
  defineSymbol(math, main, bin, "\u2229", "\\cap", true);
  defineSymbol(math, main, bin, "\u222A", "\\cup", true);
  defineSymbol(math, main, bin, "\u2216", "\\setminus", true);
  defineSymbol(math, main, bin, "\u2227", "\\land");
  defineSymbol(math, main, bin, "\u2228", "\\lor");
  defineSymbol(math, main, bin, "\u2227", "\\wedge", true);
  defineSymbol(math, main, bin, "\u2228", "\\vee", true);
  defineSymbol(math, main, textord, "\u221A", "\\surd");
  defineSymbol(math, main, open, "\u27E8", "\\langle", true);
  defineSymbol(math, main, open, "\u2223", "\\lvert");
  defineSymbol(math, main, open, "\u2225", "\\lVert");
  defineSymbol(math, main, close, "?", "?");
  defineSymbol(math, main, close, "!", "!");
  defineSymbol(math, main, close, "\u27E9", "\\rangle", true);
  defineSymbol(math, main, close, "\u2223", "\\rvert");
  defineSymbol(math, main, close, "\u2225", "\\rVert");
  defineSymbol(math, main, rel, "=", "=");
  defineSymbol(math, main, rel, ":", ":");
  defineSymbol(math, main, rel, "\u2248", "\\approx", true);
  defineSymbol(math, main, rel, "\u2245", "\\cong", true);
  defineSymbol(math, main, rel, "\u2265", "\\ge");
  defineSymbol(math, main, rel, "\u2265", "\\geq", true);
  defineSymbol(math, main, rel, "\u2190", "\\gets");
  defineSymbol(math, main, rel, ">", "\\gt", true);
  defineSymbol(math, main, rel, "\u2208", "\\in", true);
  defineSymbol(math, main, rel, "\uE020", "\\@not");
  defineSymbol(math, main, rel, "\u2282", "\\subset", true);
  defineSymbol(math, main, rel, "\u2283", "\\supset", true);
  defineSymbol(math, main, rel, "\u2286", "\\subseteq", true);
  defineSymbol(math, main, rel, "\u2287", "\\supseteq", true);
  defineSymbol(math, ams, rel, "\u2288", "\\nsubseteq", true);
  defineSymbol(math, ams, rel, "\u2289", "\\nsupseteq", true);
  defineSymbol(math, main, rel, "\u22A8", "\\models");
  defineSymbol(math, main, rel, "\u2190", "\\leftarrow", true);
  defineSymbol(math, main, rel, "\u2264", "\\le");
  defineSymbol(math, main, rel, "\u2264", "\\leq", true);
  defineSymbol(math, main, rel, "<", "\\lt", true);
  defineSymbol(math, main, rel, "\u2192", "\\rightarrow", true);
  defineSymbol(math, main, rel, "\u2192", "\\to");
  defineSymbol(math, ams, rel, "\u2271", "\\ngeq", true);
  defineSymbol(math, ams, rel, "\u2270", "\\nleq", true);
  defineSymbol(math, main, spacing, "\xA0", "\\ ");
  defineSymbol(math, main, spacing, "\xA0", "\\space");
  defineSymbol(math, main, spacing, "\xA0", "\\nobreakspace");
  defineSymbol(text, main, spacing, "\xA0", "\\ ");
  defineSymbol(text, main, spacing, "\xA0", " ");
  defineSymbol(text, main, spacing, "\xA0", "\\space");
  defineSymbol(text, main, spacing, "\xA0", "\\nobreakspace");
  defineSymbol(math, main, spacing, null, "\\nobreak");
  defineSymbol(math, main, spacing, null, "\\allowbreak");
  defineSymbol(math, main, punct, ",", ",");
  defineSymbol(math, main, punct, ";", ";");
  defineSymbol(math, ams, bin, "\u22BC", "\\barwedge", true);
  defineSymbol(math, ams, bin, "\u22BB", "\\veebar", true);
  defineSymbol(math, main, bin, "\u2299", "\\odot", true);
  defineSymbol(math, main, bin, "\u2295", "\\oplus", true);
  defineSymbol(math, main, bin, "\u2297", "\\otimes", true);
  defineSymbol(math, main, textord, "\u2202", "\\partial", true);
  defineSymbol(math, main, bin, "\u2298", "\\oslash", true);
  defineSymbol(math, ams, bin, "\u229A", "\\circledcirc", true);
  defineSymbol(math, ams, bin, "\u22A1", "\\boxdot", true);
  defineSymbol(math, main, bin, "\u25B3", "\\bigtriangleup");
  defineSymbol(math, main, bin, "\u25BD", "\\bigtriangledown");
  defineSymbol(math, main, bin, "\u2020", "\\dagger");
  defineSymbol(math, main, bin, "\u22C4", "\\diamond");
  defineSymbol(math, main, bin, "\u22C6", "\\star");
  defineSymbol(math, main, bin, "\u25C3", "\\triangleleft");
  defineSymbol(math, main, bin, "\u25B9", "\\triangleright");
  defineSymbol(math, main, open, "{", "\\{");
  defineSymbol(text, main, textord, "{", "\\{");
  defineSymbol(text, main, textord, "{", "\\textbraceleft");
  defineSymbol(math, main, close, "}", "\\}");
  defineSymbol(text, main, textord, "}", "\\}");
  defineSymbol(text, main, textord, "}", "\\textbraceright");
  defineSymbol(math, main, open, "{", "\\lbrace");
  defineSymbol(math, main, close, "}", "\\rbrace");
  defineSymbol(math, main, open, "[", "\\lbrack", true);
  defineSymbol(text, main, textord, "[", "\\lbrack", true);
  defineSymbol(math, main, close, "]", "\\rbrack", true);
  defineSymbol(text, main, textord, "]", "\\rbrack", true);
  defineSymbol(math, main, open, "(", "\\lparen", true);
  defineSymbol(math, main, close, ")", "\\rparen", true);
  defineSymbol(text, main, textord, "<", "\\textless", true);
  defineSymbol(text, main, textord, ">", "\\textgreater", true);
  defineSymbol(math, main, open, "\u230A", "\\lfloor", true);
  defineSymbol(math, main, close, "\u230B", "\\rfloor", true);
  defineSymbol(math, main, open, "\u2308", "\\lceil", true);
  defineSymbol(math, main, close, "\u2309", "\\rceil", true);
  defineSymbol(math, main, textord, "\\", "\\backslash");
  defineSymbol(math, main, textord, "\u2223", "|");
  defineSymbol(math, main, textord, "\u2223", "\\vert");
  defineSymbol(text, main, textord, "|", "\\textbar", true);
  defineSymbol(math, main, textord, "\u2225", "\\|");
  defineSymbol(math, main, textord, "\u2225", "\\Vert");
  defineSymbol(text, main, textord, "\u2225", "\\textbardbl");
  defineSymbol(text, main, textord, "~", "\\textasciitilde");
  defineSymbol(text, main, textord, "\\", "\\textbackslash");
  defineSymbol(text, main, textord, "^", "\\textasciicircum");
  defineSymbol(math, main, rel, "\u2191", "\\uparrow", true);
  defineSymbol(math, main, rel, "\u21D1", "\\Uparrow", true);
  defineSymbol(math, main, rel, "\u2193", "\\downarrow", true);
  defineSymbol(math, main, rel, "\u21D3", "\\Downarrow", true);
  defineSymbol(math, main, rel, "\u2195", "\\updownarrow", true);
  defineSymbol(math, main, rel, "\u21D5", "\\Updownarrow", true);
  defineSymbol(math, main, op, "\u2210", "\\coprod");
  defineSymbol(math, main, op, "\u22C1", "\\bigvee");
  defineSymbol(math, main, op, "\u22C0", "\\bigwedge");
  defineSymbol(math, main, op, "\u2A04", "\\biguplus");
  defineSymbol(math, main, op, "\u22C2", "\\bigcap");
  defineSymbol(math, main, op, "\u22C3", "\\bigcup");
  defineSymbol(math, main, op, "\u222B", "\\int");
  defineSymbol(math, main, op, "\u222B", "\\intop");
  defineSymbol(math, main, op, "\u222C", "\\iint");
  defineSymbol(math, main, op, "\u222D", "\\iiint");
  defineSymbol(math, main, op, "\u220F", "\\prod");
  defineSymbol(math, main, op, "\u2211", "\\sum");
  defineSymbol(math, main, op, "\u2A02", "\\bigotimes");
  defineSymbol(math, main, op, "\u2A01", "\\bigoplus");
  defineSymbol(math, main, op, "\u2A00", "\\bigodot");
  defineSymbol(math, main, op, "\u222E", "\\oint");
  defineSymbol(math, main, op, "\u222F", "\\oiint");
  defineSymbol(math, main, op, "\u2230", "\\oiiint");
  defineSymbol(math, main, op, "\u2A06", "\\bigsqcup");
  defineSymbol(math, main, op, "\u222B", "\\smallint");
  defineSymbol(text, main, inner, "\u2026", "\\textellipsis");
  defineSymbol(math, main, inner, "\u2026", "\\mathellipsis");
  defineSymbol(text, main, inner, "\u2026", "\\ldots", true);
  defineSymbol(math, main, inner, "\u2026", "\\ldots", true);
  defineSymbol(math, main, inner, "\u22EF", "\\@cdots", true);
  defineSymbol(math, main, inner, "\u22F1", "\\ddots", true);
  defineSymbol(math, main, textord, "\u22EE", "\\varvdots");
  defineSymbol(text, main, textord, "\u22EE", "\\varvdots");
  defineSymbol(math, main, accent, "\u02CA", "\\acute");
  defineSymbol(math, main, accent, "\u02CB", "\\grave");
  defineSymbol(math, main, accent, "\xA8", "\\ddot");
  defineSymbol(math, main, accent, "~", "\\tilde");
  defineSymbol(math, main, accent, "\u02C9", "\\bar");
  defineSymbol(math, main, accent, "\u02D8", "\\breve");
  defineSymbol(math, main, accent, "\u02C7", "\\check");
  defineSymbol(math, main, accent, "^", "\\hat");
  defineSymbol(math, main, accent, "\u20D7", "\\vec");
  defineSymbol(math, main, accent, "\u02D9", "\\dot");
  defineSymbol(math, main, accent, "\u02DA", "\\mathring");
  defineSymbol(math, main, mathord, "\uE131", "\\@imath");
  defineSymbol(math, main, mathord, "\uE237", "\\@jmath");
  defineSymbol(math, main, textord, "\u0131", "\u0131");
  defineSymbol(math, main, textord, "\u0237", "\u0237");
  defineSymbol(text, main, textord, "\u0131", "\\i", true);
  defineSymbol(text, main, textord, "\u0237", "\\j", true);
  defineSymbol(text, main, textord, "\xDF", "\\ss", true);
  defineSymbol(text, main, textord, "\xE6", "\\ae", true);
  defineSymbol(text, main, textord, "\u0153", "\\oe", true);
  defineSymbol(text, main, textord, "\xF8", "\\o", true);
  defineSymbol(text, main, textord, "\xC6", "\\AE", true);
  defineSymbol(text, main, textord, "\u0152", "\\OE", true);
  defineSymbol(text, main, textord, "\xD8", "\\O", true);
  defineSymbol(text, main, accent, "\u02CA", "\\'");
  defineSymbol(text, main, accent, "\u02CB", "\\`");
  defineSymbol(text, main, accent, "\u02C6", "\\^");
  defineSymbol(text, main, accent, "\u02DC", "\\~");
  defineSymbol(text, main, accent, "\u02C9", "\\=");
  defineSymbol(text, main, accent, "\u02D8", "\\u");
  defineSymbol(text, main, accent, "\u02D9", "\\.");
  defineSymbol(text, main, accent, "\xB8", "\\c");
  defineSymbol(text, main, accent, "\u02DA", "\\r");
  defineSymbol(text, main, accent, "\u02C7", "\\v");
  defineSymbol(text, main, accent, "\xA8", '\\"');
  defineSymbol(text, main, accent, "\u02DD", "\\H");
  defineSymbol(text, main, accent, "\u25EF", "\\textcircled");
  var ligatures = {
    "--": true,
    "---": true,
    "``": true,
    "''": true
  };
  defineSymbol(text, main, textord, "\u2013", "--", true);
  defineSymbol(text, main, textord, "\u2013", "\\textendash");
  defineSymbol(text, main, textord, "\u2014", "---", true);
  defineSymbol(text, main, textord, "\u2014", "\\textemdash");
  defineSymbol(text, main, textord, "\u2018", "`", true);
  defineSymbol(text, main, textord, "\u2018", "\\textquoteleft");
  defineSymbol(text, main, textord, "\u2019", "'", true);
  defineSymbol(text, main, textord, "\u2019", "\\textquoteright");
  defineSymbol(text, main, textord, "\u201C", "``", true);
  defineSymbol(text, main, textord, "\u201C", "\\textquotedblleft");
  defineSymbol(text, main, textord, "\u201D", "''", true);
  defineSymbol(text, main, textord, "\u201D", "\\textquotedblright");
  defineSymbol(math, main, textord, "\xB0", "\\degree", true);
  defineSymbol(text, main, textord, "\xB0", "\\degree");
  defineSymbol(text, main, textord, "\xB0", "\\textdegree", true);
  defineSymbol(math, main, textord, "\xA3", "\\pounds");
  defineSymbol(math, main, textord, "\xA3", "\\mathsterling", true);
  defineSymbol(text, main, textord, "\xA3", "\\pounds");
  defineSymbol(text, main, textord, "\xA3", "\\textsterling", true);
  defineSymbol(math, ams, textord, "\u2720", "\\maltese");
  defineSymbol(text, ams, textord, "\u2720", "\\maltese");
  var mathTextSymbols = '0123456789/@."';
  for (i = 0; i < mathTextSymbols.length; i++) {
    ch = mathTextSymbols.charAt(i);
    defineSymbol(math, main, textord, ch, ch);
  }
  var ch;
  var i;
  var textSymbols = '0123456789!@*()-=+";:?/.,';
  for (_i = 0; _i < textSymbols.length; _i++) {
    _ch = textSymbols.charAt(_i);
    defineSymbol(text, main, textord, _ch, _ch);
  }
  var _ch;
  var _i;
  var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for (_i2 = 0; _i2 < letters.length; _i2++) {
    _ch2 = letters.charAt(_i2);
    defineSymbol(math, main, mathord, _ch2, _ch2);
    defineSymbol(text, main, textord, _ch2, _ch2);
  }
  var _ch2;
  var _i2;
  defineSymbol(math, ams, textord, "C", "\u2102");
  defineSymbol(text, ams, textord, "C", "\u2102");
  defineSymbol(math, ams, textord, "H", "\u210D");
  defineSymbol(text, ams, textord, "H", "\u210D");
  defineSymbol(math, ams, textord, "N", "\u2115");
  defineSymbol(text, ams, textord, "N", "\u2115");
  defineSymbol(math, ams, textord, "P", "\u2119");
  defineSymbol(text, ams, textord, "P", "\u2119");
  defineSymbol(math, ams, textord, "Q", "\u211A");
  defineSymbol(text, ams, textord, "Q", "\u211A");
  defineSymbol(math, ams, textord, "R", "\u211D");
  defineSymbol(text, ams, textord, "R", "\u211D");
  defineSymbol(math, ams, textord, "Z", "\u2124");
  defineSymbol(text, ams, textord, "Z", "\u2124");
  defineSymbol(math, main, mathord, "h", "\u210E");
  defineSymbol(text, main, mathord, "h", "\u210E");
  var wideChar = "";
  for (_i3 = 0; _i3 < letters.length; _i3++) {
    _ch3 = letters.charAt(_i3);
    wideChar = String.fromCharCode(55349, 56320 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56372 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56424 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56580 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56684 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56736 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56788 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56840 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    wideChar = String.fromCharCode(55349, 56944 + _i3);
    defineSymbol(math, main, mathord, _ch3, wideChar);
    defineSymbol(text, main, textord, _ch3, wideChar);
    if (_i3 < 26) {
      wideChar = String.fromCharCode(55349, 56632 + _i3);
      defineSymbol(math, main, mathord, _ch3, wideChar);
      defineSymbol(text, main, textord, _ch3, wideChar);
      wideChar = String.fromCharCode(55349, 56476 + _i3);
      defineSymbol(math, main, mathord, _ch3, wideChar);
      defineSymbol(text, main, textord, _ch3, wideChar);
    }
  }
  var _ch3;
  var _i3;
  wideChar = String.fromCharCode(55349, 56668);
  defineSymbol(math, main, mathord, "k", wideChar);
  defineSymbol(text, main, textord, "k", wideChar);
  for (_i4 = 0; _i4 < 10; _i4++) {
    _ch4 = _i4.toString();
    wideChar = String.fromCharCode(55349, 57294 + _i4);
    defineSymbol(math, main, mathord, _ch4, wideChar);
    defineSymbol(text, main, textord, _ch4, wideChar);
    wideChar = String.fromCharCode(55349, 57314 + _i4);
    defineSymbol(math, main, mathord, _ch4, wideChar);
    defineSymbol(text, main, textord, _ch4, wideChar);
    wideChar = String.fromCharCode(55349, 57324 + _i4);
    defineSymbol(math, main, mathord, _ch4, wideChar);
    defineSymbol(text, main, textord, _ch4, wideChar);
    wideChar = String.fromCharCode(55349, 57334 + _i4);
    defineSymbol(math, main, mathord, _ch4, wideChar);
    defineSymbol(text, main, textord, _ch4, wideChar);
  }
  var _ch4;
  var _i4;
  var extraLatin = "\xD0\xDE\xFE";
  for (_i5 = 0; _i5 < extraLatin.length; _i5++) {
    _ch5 = extraLatin.charAt(_i5);
    defineSymbol(math, main, mathord, _ch5, _ch5);
    defineSymbol(text, main, textord, _ch5, _ch5);
  }
  var _ch5;
  var _i5;
  var wideLatinLetterData = [
    ["mathbf", "textbf", "Main-Bold"],
    // A-Z bold upright
    ["mathbf", "textbf", "Main-Bold"],
    // a-z bold upright
    ["mathnormal", "textit", "Math-Italic"],
    // A-Z italic
    ["mathnormal", "textit", "Math-Italic"],
    // a-z italic
    ["boldsymbol", "boldsymbol", "Main-BoldItalic"],
    // A-Z bold italic
    ["boldsymbol", "boldsymbol", "Main-BoldItalic"],
    // a-z bold italic
    // Map fancy A-Z letters to script, not calligraphic.
    // This aligns with unicode-math and math fonts (except Cambria Math).
    ["mathscr", "textscr", "Script-Regular"],
    // A-Z script
    ["", "", ""],
    // a-z script.  No font
    ["", "", ""],
    // A-Z bold script. No font
    ["", "", ""],
    // a-z bold script. No font
    ["mathfrak", "textfrak", "Fraktur-Regular"],
    // A-Z Fraktur
    ["mathfrak", "textfrak", "Fraktur-Regular"],
    // a-z Fraktur
    ["mathbb", "textbb", "AMS-Regular"],
    // A-Z double-struck
    ["mathbb", "textbb", "AMS-Regular"],
    // k double-struck
    // Note that we are using a bold font, but font metrics for regular Fraktur.
    ["mathboldfrak", "textboldfrak", "Fraktur-Regular"],
    // A-Z bold Fraktur
    ["mathboldfrak", "textboldfrak", "Fraktur-Regular"],
    // a-z bold Fraktur
    ["mathsf", "textsf", "SansSerif-Regular"],
    // A-Z sans-serif
    ["mathsf", "textsf", "SansSerif-Regular"],
    // a-z sans-serif
    ["mathboldsf", "textboldsf", "SansSerif-Bold"],
    // A-Z bold sans-serif
    ["mathboldsf", "textboldsf", "SansSerif-Bold"],
    // a-z bold sans-serif
    ["mathitsf", "textitsf", "SansSerif-Italic"],
    // A-Z italic sans-serif
    ["mathitsf", "textitsf", "SansSerif-Italic"],
    // a-z italic sans-serif
    ["", "", ""],
    // A-Z bold italic sans. No font
    ["", "", ""],
    // a-z bold italic sans. No font
    ["mathtt", "texttt", "Typewriter-Regular"],
    // A-Z monospace
    ["mathtt", "texttt", "Typewriter-Regular"]
    // a-z monospace
  ];
  var wideNumeralData = [
    ["mathbf", "textbf", "Main-Bold"],
    // 0-9 bold
    ["", "", ""],
    // 0-9 double-struck. No KaTeX font.
    ["mathsf", "textsf", "SansSerif-Regular"],
    // 0-9 sans-serif
    ["mathboldsf", "textboldsf", "SansSerif-Bold"],
    // 0-9 bold sans-serif
    ["mathtt", "texttt", "Typewriter-Regular"]
    // 0-9 monospace
  ];
  var wideCharacterFont = function wideCharacterFont2(wideChar2, mode) {
    var H = wideChar2.charCodeAt(0);
    var L = wideChar2.charCodeAt(1);
    var codePoint = (H - 55296) * 1024 + (L - 56320) + 65536;
    var j = mode === "math" ? 0 : 1;
    if (119808 <= codePoint && codePoint < 120484) {
      var i = Math.floor((codePoint - 119808) / 26);
      return [wideLatinLetterData[i][2], wideLatinLetterData[i][j]];
    } else if (120782 <= codePoint && codePoint <= 120831) {
      var _i = Math.floor((codePoint - 120782) / 10);
      return [wideNumeralData[_i][2], wideNumeralData[_i][j]];
    } else if (codePoint === 120485 || codePoint === 120486) {
      return [wideLatinLetterData[0][2], wideLatinLetterData[0][j]];
    } else if (120486 < codePoint && codePoint < 120782) {
      return ["", ""];
    } else {
      throw new ParseError("Unsupported character: " + wideChar2);
    }
  };
  var lookupSymbol = function lookupSymbol2(value, fontName, mode) {
    if (symbols[mode][value] && symbols[mode][value].replace) {
      value = symbols[mode][value].replace;
    }
    return {
      value,
      metrics: getCharacterMetrics(value, fontName, mode)
    };
  };
  var makeSymbol = function makeSymbol2(value, fontName, mode, options, classes) {
    var lookup = lookupSymbol(value, fontName, mode);
    var metrics = lookup.metrics;
    value = lookup.value;
    var symbolNode;
    if (metrics) {
      var italic = metrics.italic;
      if (mode === "text" || options && options.font === "mathit") {
        italic = 0;
      }
      symbolNode = new SymbolNode(value, metrics.height, metrics.depth, italic, metrics.skew, metrics.width, classes);
    } else {
      typeof console !== "undefined" && console.warn("No character metrics " + ("for '" + value + "' in style '" + fontName + "' and mode '" + mode + "'"));
      symbolNode = new SymbolNode(value, 0, 0, 0, 0, 0, classes);
    }
    if (options) {
      symbolNode.maxFontSize = options.sizeMultiplier;
      if (options.style.isTight()) {
        symbolNode.classes.push("mtight");
      }
      var color = options.getColor();
      if (color) {
        symbolNode.style.color = color;
      }
    }
    return symbolNode;
  };
  var mathsym = function mathsym2(value, mode, options, classes) {
    if (classes === void 0) {
      classes = [];
    }
    if (options.font === "boldsymbol" && lookupSymbol(value, "Main-Bold", mode).metrics) {
      return makeSymbol(value, "Main-Bold", mode, options, classes.concat(["mathbf"]));
    } else if (value === "\\" || symbols[mode][value].font === "main") {
      return makeSymbol(value, "Main-Regular", mode, options, classes);
    } else {
      return makeSymbol(value, "AMS-Regular", mode, options, classes.concat(["amsrm"]));
    }
  };
  var boldsymbol = function boldsymbol2(value, mode, options, classes, type) {
    if (type !== "textord" && lookupSymbol(value, "Math-BoldItalic", mode).metrics) {
      return {
        fontName: "Math-BoldItalic",
        fontClass: "boldsymbol"
      };
    } else {
      return {
        fontName: "Main-Bold",
        fontClass: "mathbf"
      };
    }
  };
  var makeOrd = function makeOrd2(group, options, type) {
    var mode = group.mode;
    var text2 = group.text;
    var classes = ["mord"];
    var isFont = mode === "math" || mode === "text" && options.font;
    var fontOrFamily = isFont ? options.font : options.fontFamily;
    var wideFontName = "";
    var wideFontClass = "";
    if (text2.charCodeAt(0) === 55349) {
      [wideFontName, wideFontClass] = wideCharacterFont(text2, mode);
    }
    if (wideFontName.length > 0) {
      return makeSymbol(text2, wideFontName, mode, options, classes.concat(wideFontClass));
    } else if (fontOrFamily) {
      var fontName;
      var fontClasses;
      if (fontOrFamily === "boldsymbol") {
        var fontData = boldsymbol(text2, mode, options, classes, type);
        fontName = fontData.fontName;
        fontClasses = [fontData.fontClass];
      } else if (isFont) {
        fontName = fontMap[fontOrFamily].fontName;
        fontClasses = [fontOrFamily];
      } else {
        fontName = retrieveTextFontName(fontOrFamily, options.fontWeight, options.fontShape);
        fontClasses = [fontOrFamily, options.fontWeight, options.fontShape];
      }
      if (lookupSymbol(text2, fontName, mode).metrics) {
        return makeSymbol(text2, fontName, mode, options, classes.concat(fontClasses));
      } else if (ligatures.hasOwnProperty(text2) && fontName.slice(0, 10) === "Typewriter") {
        var parts = [];
        for (var i = 0; i < text2.length; i++) {
          parts.push(makeSymbol(text2[i], fontName, mode, options, classes.concat(fontClasses)));
        }
        return makeFragment(parts);
      }
    }
    if (type === "mathord") {
      return makeSymbol(text2, "Math-Italic", mode, options, classes.concat(["mathnormal"]));
    } else if (type === "textord") {
      var font = symbols[mode][text2] && symbols[mode][text2].font;
      if (font === "ams") {
        var _fontName = retrieveTextFontName("amsrm", options.fontWeight, options.fontShape);
        return makeSymbol(text2, _fontName, mode, options, classes.concat("amsrm", options.fontWeight, options.fontShape));
      } else if (font === "main" || !font) {
        var _fontName2 = retrieveTextFontName("textrm", options.fontWeight, options.fontShape);
        return makeSymbol(text2, _fontName2, mode, options, classes.concat(options.fontWeight, options.fontShape));
      } else {
        var _fontName3 = retrieveTextFontName(font, options.fontWeight, options.fontShape);
        return makeSymbol(text2, _fontName3, mode, options, classes.concat(_fontName3, options.fontWeight, options.fontShape));
      }
    } else {
      throw new Error("unexpected type: " + type + " in makeOrd");
    }
  };
  var canCombine = (prev, next) => {
    if (createClass(prev.classes) !== createClass(next.classes) || prev.skew !== next.skew || prev.maxFontSize !== next.maxFontSize) {
      return false;
    }
    if (prev.classes.length === 1) {
      var cls = prev.classes[0];
      if (cls === "mbin" || cls === "mord") {
        return false;
      }
    }
    for (var style in prev.style) {
      if (prev.style.hasOwnProperty(style) && prev.style[style] !== next.style[style]) {
        return false;
      }
    }
    for (var _style in next.style) {
      if (next.style.hasOwnProperty(_style) && prev.style[_style] !== next.style[_style]) {
        return false;
      }
    }
    return true;
  };
  var tryCombineChars = (chars) => {
    for (var i = 0; i < chars.length - 1; i++) {
      var prev = chars[i];
      var next = chars[i + 1];
      if (prev instanceof SymbolNode && next instanceof SymbolNode && canCombine(prev, next)) {
        prev.text += next.text;
        prev.height = Math.max(prev.height, next.height);
        prev.depth = Math.max(prev.depth, next.depth);
        prev.italic = next.italic;
        chars.splice(i + 1, 1);
        i--;
      }
    }
    return chars;
  };
  var sizeElementFromChildren = function sizeElementFromChildren2(elem) {
    var height = 0;
    var depth = 0;
    var maxFontSize = 0;
    for (var i = 0; i < elem.children.length; i++) {
      var child = elem.children[i];
      if (child.height > height) {
        height = child.height;
      }
      if (child.depth > depth) {
        depth = child.depth;
      }
      if (child.maxFontSize > maxFontSize) {
        maxFontSize = child.maxFontSize;
      }
    }
    elem.height = height;
    elem.depth = depth;
    elem.maxFontSize = maxFontSize;
  };
  var makeSpan$2 = function makeSpan(classes, children, options, style) {
    var span = new Span(classes, children, options, style);
    sizeElementFromChildren(span);
    return span;
  };
  var makeSvgSpan = (classes, children, options, style) => new Span(classes, children, options, style);
  var makeLineSpan = function makeLineSpan2(className, options, thickness) {
    var line = makeSpan$2([className], [], options);
    line.height = Math.max(thickness || options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
    line.style.borderBottomWidth = makeEm(line.height);
    line.maxFontSize = 1;
    return line;
  };
  var makeAnchor = function makeAnchor2(href, classes, children, options) {
    var anchor = new Anchor(href, classes, children, options);
    sizeElementFromChildren(anchor);
    return anchor;
  };
  var makeFragment = function makeFragment2(children) {
    var fragment = new DocumentFragment(children);
    sizeElementFromChildren(fragment);
    return fragment;
  };
  var wrapFragment = function wrapFragment2(group, options) {
    if (group instanceof DocumentFragment) {
      return makeSpan$2([], [group], options);
    }
    return group;
  };
  var getVListChildrenAndDepth = function getVListChildrenAndDepth2(params) {
    if (params.positionType === "individualShift") {
      var oldChildren = params.children;
      var children = [oldChildren[0]];
      var _depth = -oldChildren[0].shift - oldChildren[0].elem.depth;
      var currPos = _depth;
      for (var i = 1; i < oldChildren.length; i++) {
        var diff = -oldChildren[i].shift - currPos - oldChildren[i].elem.depth;
        var size = diff - (oldChildren[i - 1].elem.height + oldChildren[i - 1].elem.depth);
        currPos = currPos + diff;
        children.push({
          type: "kern",
          size
        });
        children.push(oldChildren[i]);
      }
      return {
        children,
        depth: _depth
      };
    }
    var depth;
    if (params.positionType === "top") {
      var bottom = params.positionData;
      for (var _i = 0; _i < params.children.length; _i++) {
        var child = params.children[_i];
        bottom -= child.type === "kern" ? child.size : child.elem.height + child.elem.depth;
      }
      depth = bottom;
    } else if (params.positionType === "bottom") {
      depth = -params.positionData;
    } else {
      var firstChild = params.children[0];
      if (firstChild.type !== "elem") {
        throw new Error('First child must have type "elem".');
      }
      if (params.positionType === "shift") {
        depth = -firstChild.elem.depth - params.positionData;
      } else if (params.positionType === "firstBaseline") {
        depth = -firstChild.elem.depth;
      } else {
        throw new Error("Invalid positionType " + params.positionType + ".");
      }
    }
    return {
      children: params.children,
      depth
    };
  };
  var makeVList = function makeVList2(params, options) {
    var {
      children,
      depth
    } = getVListChildrenAndDepth(params);
    var pstrutSize = 0;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.type === "elem") {
        var elem = child.elem;
        pstrutSize = Math.max(pstrutSize, elem.maxFontSize, elem.height);
      }
    }
    pstrutSize += 2;
    var pstrut = makeSpan$2(["pstrut"], []);
    pstrut.style.height = makeEm(pstrutSize);
    var realChildren = [];
    var minPos = depth;
    var maxPos = depth;
    var currPos = depth;
    for (var _i2 = 0; _i2 < children.length; _i2++) {
      var _child = children[_i2];
      if (_child.type === "kern") {
        currPos += _child.size;
      } else {
        var _elem = _child.elem;
        var classes = _child.wrapperClasses || [];
        var style = _child.wrapperStyle || {};
        var childWrap = makeSpan$2(classes, [pstrut, _elem], void 0, style);
        childWrap.style.top = makeEm(-pstrutSize - currPos - _elem.depth);
        if (_child.marginLeft) {
          childWrap.style.marginLeft = _child.marginLeft;
        }
        if (_child.marginRight) {
          childWrap.style.marginRight = _child.marginRight;
        }
        realChildren.push(childWrap);
        currPos += _elem.height + _elem.depth;
      }
      minPos = Math.min(minPos, currPos);
      maxPos = Math.max(maxPos, currPos);
    }
    var vlist = makeSpan$2(["vlist"], realChildren);
    vlist.style.height = makeEm(maxPos);
    var rows;
    if (minPos < 0) {
      var emptySpan = makeSpan$2([], []);
      var depthStrut = makeSpan$2(["vlist"], [emptySpan]);
      depthStrut.style.height = makeEm(-minPos);
      var topStrut = makeSpan$2(["vlist-s"], [new SymbolNode("\u200B")]);
      rows = [makeSpan$2(["vlist-r"], [vlist, topStrut]), makeSpan$2(["vlist-r"], [depthStrut])];
    } else {
      rows = [makeSpan$2(["vlist-r"], [vlist])];
    }
    var vtable = makeSpan$2(["vlist-t"], rows);
    if (rows.length === 2) {
      vtable.classes.push("vlist-t2");
    }
    vtable.height = maxPos;
    vtable.depth = -minPos;
    return vtable;
  };
  var makeGlue = (measurement, options) => {
    var rule = makeSpan$2(["mspace"], [], options);
    var size = calculateSize(measurement, options);
    rule.style.marginRight = makeEm(size);
    return rule;
  };
  var retrieveTextFontName = function retrieveTextFontName2(fontFamily, fontWeight, fontShape) {
    var baseFontName = "";
    switch (fontFamily) {
      case "amsrm":
        baseFontName = "AMS";
        break;
      case "textrm":
        baseFontName = "Main";
        break;
      case "textsf":
        baseFontName = "SansSerif";
        break;
      case "texttt":
        baseFontName = "Typewriter";
        break;
      default:
        baseFontName = fontFamily;
    }
    var fontStylesName;
    if (fontWeight === "textbf" && fontShape === "textit") {
      fontStylesName = "BoldItalic";
    } else if (fontWeight === "textbf") {
      fontStylesName = "Bold";
    } else if (fontWeight === "textit") {
      fontStylesName = "Italic";
    } else {
      fontStylesName = "Regular";
    }
    return baseFontName + "-" + fontStylesName;
  };
  var fontMap = {
    // styles
    "mathbf": {
      variant: "bold",
      fontName: "Main-Bold"
    },
    "mathrm": {
      variant: "normal",
      fontName: "Main-Regular"
    },
    "textit": {
      variant: "italic",
      fontName: "Main-Italic"
    },
    "mathit": {
      variant: "italic",
      fontName: "Main-Italic"
    },
    "mathnormal": {
      variant: "italic",
      fontName: "Math-Italic"
    },
    "mathsfit": {
      variant: "sans-serif-italic",
      fontName: "SansSerif-Italic"
    },
    // "boldsymbol" is missing because they require the use of multiple fonts:
    // Math-BoldItalic and Main-Bold.  This is handled by a special case in
    // makeOrd which ends up calling boldsymbol.
    // families
    "mathbb": {
      variant: "double-struck",
      fontName: "AMS-Regular"
    },
    "mathcal": {
      variant: "script",
      fontName: "Caligraphic-Regular"
    },
    "mathfrak": {
      variant: "fraktur",
      fontName: "Fraktur-Regular"
    },
    "mathscr": {
      variant: "script",
      fontName: "Script-Regular"
    },
    "mathsf": {
      variant: "sans-serif",
      fontName: "SansSerif-Regular"
    },
    "mathtt": {
      variant: "monospace",
      fontName: "Typewriter-Regular"
    }
  };
  var svgData = {
    //   path, width, height
    vec: ["vec", 0.471, 0.714],
    // values from the font glyph
    oiintSize1: ["oiintSize1", 0.957, 0.499],
    // oval to overlay the integrand
    oiintSize2: ["oiintSize2", 1.472, 0.659],
    oiiintSize1: ["oiiintSize1", 1.304, 0.499],
    oiiintSize2: ["oiiintSize2", 1.98, 0.659]
  };
  var staticSvg = function staticSvg2(value, options) {
    var [pathName, width, height] = svgData[value];
    var path2 = new PathNode(pathName);
    var svgNode = new SvgNode([path2], {
      "width": makeEm(width),
      "height": makeEm(height),
      // Override CSS rule `.katex svg { width: 100% }`
      "style": "width:" + makeEm(width),
      "viewBox": "0 0 " + 1e3 * width + " " + 1e3 * height,
      "preserveAspectRatio": "xMinYMin"
    });
    var span = makeSvgSpan(["overlay"], [svgNode], options);
    span.height = height;
    span.style.height = makeEm(height);
    span.style.width = makeEm(width);
    return span;
  };
  var buildCommon = {
    fontMap,
    makeSymbol,
    mathsym,
    makeSpan: makeSpan$2,
    makeSvgSpan,
    makeLineSpan,
    makeAnchor,
    makeFragment,
    wrapFragment,
    makeVList,
    makeOrd,
    makeGlue,
    staticSvg,
    svgData,
    tryCombineChars
  };
  var thinspace = {
    number: 3,
    unit: "mu"
  };
  var mediumspace = {
    number: 4,
    unit: "mu"
  };
  var thickspace = {
    number: 5,
    unit: "mu"
  };
  var spacings = {
    mord: {
      mop: thinspace,
      mbin: mediumspace,
      mrel: thickspace,
      minner: thinspace
    },
    mop: {
      mord: thinspace,
      mop: thinspace,
      mrel: thickspace,
      minner: thinspace
    },
    mbin: {
      mord: mediumspace,
      mop: mediumspace,
      mopen: mediumspace,
      minner: mediumspace
    },
    mrel: {
      mord: thickspace,
      mop: thickspace,
      mopen: thickspace,
      minner: thickspace
    },
    mopen: {},
    mclose: {
      mop: thinspace,
      mbin: mediumspace,
      mrel: thickspace,
      minner: thinspace
    },
    mpunct: {
      mord: thinspace,
      mop: thinspace,
      mrel: thickspace,
      mopen: thinspace,
      mclose: thinspace,
      mpunct: thinspace,
      minner: thinspace
    },
    minner: {
      mord: thinspace,
      mop: thinspace,
      mbin: mediumspace,
      mrel: thickspace,
      mopen: thinspace,
      mpunct: thinspace,
      minner: thinspace
    }
  };
  var tightSpacings = {
    mord: {
      mop: thinspace
    },
    mop: {
      mord: thinspace,
      mop: thinspace
    },
    mbin: {},
    mrel: {},
    mopen: {},
    mclose: {
      mop: thinspace
    },
    mpunct: {},
    minner: {
      mop: thinspace
    }
  };
  var _functions = {};
  var _htmlGroupBuilders = {};
  var _mathmlGroupBuilders = {};
  function defineFunction(_ref) {
    var {
      type,
      names,
      props,
      handler,
      htmlBuilder: htmlBuilder3,
      mathmlBuilder: mathmlBuilder3
    } = _ref;
    var data2 = {
      type,
      numArgs: props.numArgs,
      argTypes: props.argTypes,
      allowedInArgument: !!props.allowedInArgument,
      allowedInText: !!props.allowedInText,
      allowedInMath: props.allowedInMath === void 0 ? true : props.allowedInMath,
      numOptionalArgs: props.numOptionalArgs || 0,
      infix: !!props.infix,
      primitive: !!props.primitive,
      handler
    };
    for (var i = 0; i < names.length; ++i) {
      _functions[names[i]] = data2;
    }
    if (type) {
      if (htmlBuilder3) {
        _htmlGroupBuilders[type] = htmlBuilder3;
      }
      if (mathmlBuilder3) {
        _mathmlGroupBuilders[type] = mathmlBuilder3;
      }
    }
  }
  function defineFunctionBuilders(_ref2) {
    var {
      type,
      htmlBuilder: htmlBuilder3,
      mathmlBuilder: mathmlBuilder3
    } = _ref2;
    defineFunction({
      type,
      names: [],
      props: {
        numArgs: 0
      },
      handler() {
        throw new Error("Should never be called.");
      },
      htmlBuilder: htmlBuilder3,
      mathmlBuilder: mathmlBuilder3
    });
  }
  var normalizeArgument = function normalizeArgument2(arg) {
    return arg.type === "ordgroup" && arg.body.length === 1 ? arg.body[0] : arg;
  };
  var ordargument = function ordargument2(arg) {
    return arg.type === "ordgroup" ? arg.body : [arg];
  };
  var makeSpan$1 = buildCommon.makeSpan;
  var binLeftCanceller = ["leftmost", "mbin", "mopen", "mrel", "mop", "mpunct"];
  var binRightCanceller = ["rightmost", "mrel", "mclose", "mpunct"];
  var styleMap$1 = {
    "display": Style$1.DISPLAY,
    "text": Style$1.TEXT,
    "script": Style$1.SCRIPT,
    "scriptscript": Style$1.SCRIPTSCRIPT
  };
  var DomEnum = {
    mord: "mord",
    mop: "mop",
    mbin: "mbin",
    mrel: "mrel",
    mopen: "mopen",
    mclose: "mclose",
    mpunct: "mpunct",
    minner: "minner"
  };
  var buildExpression$1 = function buildExpression(expression, options, isRealGroup, surrounding) {
    if (surrounding === void 0) {
      surrounding = [null, null];
    }
    var groups = [];
    for (var i = 0; i < expression.length; i++) {
      var output = buildGroup$1(expression[i], options);
      if (output instanceof DocumentFragment) {
        var children = output.children;
        groups.push(...children);
      } else {
        groups.push(output);
      }
    }
    buildCommon.tryCombineChars(groups);
    if (!isRealGroup) {
      return groups;
    }
    var glueOptions = options;
    if (expression.length === 1) {
      var node = expression[0];
      if (node.type === "sizing") {
        glueOptions = options.havingSize(node.size);
      } else if (node.type === "styling") {
        glueOptions = options.havingStyle(styleMap$1[node.style]);
      }
    }
    var dummyPrev = makeSpan$1([surrounding[0] || "leftmost"], [], options);
    var dummyNext = makeSpan$1([surrounding[1] || "rightmost"], [], options);
    var isRoot = isRealGroup === "root";
    traverseNonSpaceNodes(groups, (node2, prev) => {
      var prevType = prev.classes[0];
      var type = node2.classes[0];
      if (prevType === "mbin" && binRightCanceller.includes(type)) {
        prev.classes[0] = "mord";
      } else if (type === "mbin" && binLeftCanceller.includes(prevType)) {
        node2.classes[0] = "mord";
      }
    }, {
      node: dummyPrev
    }, dummyNext, isRoot);
    traverseNonSpaceNodes(groups, (node2, prev) => {
      var prevType = getTypeOfDomTree(prev);
      var type = getTypeOfDomTree(node2);
      var space = prevType && type ? node2.hasClass("mtight") ? tightSpacings[prevType][type] : spacings[prevType][type] : null;
      if (space) {
        return buildCommon.makeGlue(space, glueOptions);
      }
    }, {
      node: dummyPrev
    }, dummyNext, isRoot);
    return groups;
  };
  var traverseNonSpaceNodes = function traverseNonSpaceNodes2(nodes, callback, prev, next, isRoot) {
    if (next) {
      nodes.push(next);
    }
    var i = 0;
    for (; i < nodes.length; i++) {
      var node = nodes[i];
      var partialGroup = checkPartialGroup(node);
      if (partialGroup) {
        traverseNonSpaceNodes2(partialGroup.children, callback, prev, null, isRoot);
        continue;
      }
      var nonspace = !node.hasClass("mspace");
      if (nonspace) {
        var result = callback(node, prev.node);
        if (result) {
          if (prev.insertAfter) {
            prev.insertAfter(result);
          } else {
            nodes.unshift(result);
            i++;
          }
        }
      }
      if (nonspace) {
        prev.node = node;
      } else if (isRoot && node.hasClass("newline")) {
        prev.node = makeSpan$1(["leftmost"]);
      }
      prev.insertAfter = /* @__PURE__ */ ((index) => (n) => {
        nodes.splice(index + 1, 0, n);
        i++;
      })(i);
    }
    if (next) {
      nodes.pop();
    }
  };
  var checkPartialGroup = function checkPartialGroup2(node) {
    if (node instanceof DocumentFragment || node instanceof Anchor || node instanceof Span && node.hasClass("enclosing")) {
      return node;
    }
    return null;
  };
  var getOutermostNode = function getOutermostNode2(node, side) {
    var partialGroup = checkPartialGroup(node);
    if (partialGroup) {
      var children = partialGroup.children;
      if (children.length) {
        if (side === "right") {
          return getOutermostNode2(children[children.length - 1], "right");
        } else if (side === "left") {
          return getOutermostNode2(children[0], "left");
        }
      }
    }
    return node;
  };
  var getTypeOfDomTree = function getTypeOfDomTree2(node, side) {
    if (!node) {
      return null;
    }
    if (side) {
      node = getOutermostNode(node, side);
    }
    return DomEnum[node.classes[0]] || null;
  };
  var makeNullDelimiter = function makeNullDelimiter2(options, classes) {
    var moreClasses = ["nulldelimiter"].concat(options.baseSizingClasses());
    return makeSpan$1(classes.concat(moreClasses));
  };
  var buildGroup$1 = function buildGroup(group, options, baseOptions) {
    if (!group) {
      return makeSpan$1();
    }
    if (_htmlGroupBuilders[group.type]) {
      var groupNode = _htmlGroupBuilders[group.type](group, options);
      if (baseOptions && options.size !== baseOptions.size) {
        groupNode = makeSpan$1(options.sizingClasses(baseOptions), [groupNode], options);
        var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
        groupNode.height *= multiplier;
        groupNode.depth *= multiplier;
      }
      return groupNode;
    } else {
      throw new ParseError("Got group of unknown type: '" + group.type + "'");
    }
  };
  function buildHTMLUnbreakable(children, options) {
    var body = makeSpan$1(["base"], children, options);
    var strut = makeSpan$1(["strut"]);
    strut.style.height = makeEm(body.height + body.depth);
    if (body.depth) {
      strut.style.verticalAlign = makeEm(-body.depth);
    }
    body.children.unshift(strut);
    return body;
  }
  function buildHTML(tree, options) {
    var tag = null;
    if (tree.length === 1 && tree[0].type === "tag") {
      tag = tree[0].tag;
      tree = tree[0].body;
    }
    var expression = buildExpression$1(tree, options, "root");
    var eqnNum;
    if (expression.length === 2 && expression[1].hasClass("tag")) {
      eqnNum = expression.pop();
    }
    var children = [];
    var parts = [];
    for (var i = 0; i < expression.length; i++) {
      parts.push(expression[i]);
      if (expression[i].hasClass("mbin") || expression[i].hasClass("mrel") || expression[i].hasClass("allowbreak")) {
        var nobreak = false;
        while (i < expression.length - 1 && expression[i + 1].hasClass("mspace") && !expression[i + 1].hasClass("newline")) {
          i++;
          parts.push(expression[i]);
          if (expression[i].hasClass("nobreak")) {
            nobreak = true;
          }
        }
        if (!nobreak) {
          children.push(buildHTMLUnbreakable(parts, options));
          parts = [];
        }
      } else if (expression[i].hasClass("newline")) {
        parts.pop();
        if (parts.length > 0) {
          children.push(buildHTMLUnbreakable(parts, options));
          parts = [];
        }
        children.push(expression[i]);
      }
    }
    if (parts.length > 0) {
      children.push(buildHTMLUnbreakable(parts, options));
    }
    var tagChild;
    if (tag) {
      tagChild = buildHTMLUnbreakable(buildExpression$1(tag, options, true));
      tagChild.classes = ["tag"];
      children.push(tagChild);
    } else if (eqnNum) {
      children.push(eqnNum);
    }
    var htmlNode = makeSpan$1(["katex-html"], children);
    htmlNode.setAttribute("aria-hidden", "true");
    if (tagChild) {
      var strut = tagChild.children[0];
      strut.style.height = makeEm(htmlNode.height + htmlNode.depth);
      if (htmlNode.depth) {
        strut.style.verticalAlign = makeEm(-htmlNode.depth);
      }
    }
    return htmlNode;
  }
  function newDocumentFragment(children) {
    return new DocumentFragment(children);
  }
  var MathNode = class {
    constructor(type, children, classes) {
      this.type = void 0;
      this.attributes = void 0;
      this.children = void 0;
      this.classes = void 0;
      this.type = type;
      this.attributes = {};
      this.children = children || [];
      this.classes = classes || [];
    }
    /**
     * Sets an attribute on a MathML node. MathML depends on attributes to convey a
     * semantic content, so this is used heavily.
     */
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    /**
     * Gets an attribute on a MathML node.
     */
    getAttribute(name) {
      return this.attributes[name];
    }
    /**
     * Converts the math node into a MathML-namespaced DOM element.
     */
    toNode() {
      var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", this.type);
      for (var attr in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
          node.setAttribute(attr, this.attributes[attr]);
        }
      }
      if (this.classes.length > 0) {
        node.className = createClass(this.classes);
      }
      for (var i = 0; i < this.children.length; i++) {
        if (this.children[i] instanceof TextNode && this.children[i + 1] instanceof TextNode) {
          var text2 = this.children[i].toText() + this.children[++i].toText();
          while (this.children[i + 1] instanceof TextNode) {
            text2 += this.children[++i].toText();
          }
          node.appendChild(new TextNode(text2).toNode());
        } else {
          node.appendChild(this.children[i].toNode());
        }
      }
      return node;
    }
    /**
     * Converts the math node into an HTML markup string.
     */
    toMarkup() {
      var markup = "<" + this.type;
      for (var attr in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, attr)) {
          markup += " " + attr + '="';
          markup += utils.escape(this.attributes[attr]);
          markup += '"';
        }
      }
      if (this.classes.length > 0) {
        markup += ' class ="' + utils.escape(createClass(this.classes)) + '"';
      }
      markup += ">";
      for (var i = 0; i < this.children.length; i++) {
        markup += this.children[i].toMarkup();
      }
      markup += "</" + this.type + ">";
      return markup;
    }
    /**
     * Converts the math node into a string, similar to innerText, but escaped.
     */
    toText() {
      return this.children.map((child) => child.toText()).join("");
    }
  };
  var TextNode = class {
    constructor(text2) {
      this.text = void 0;
      this.text = text2;
    }
    /**
     * Converts the text node into a DOM text node.
     */
    toNode() {
      return document.createTextNode(this.text);
    }
    /**
     * Converts the text node into escaped HTML markup
     * (representing the text itself).
     */
    toMarkup() {
      return utils.escape(this.toText());
    }
    /**
     * Converts the text node into a string
     * (representing the text itself).
     */
    toText() {
      return this.text;
    }
  };
  var SpaceNode = class {
    /**
     * Create a Space node with width given in CSS ems.
     */
    constructor(width) {
      this.width = void 0;
      this.character = void 0;
      this.width = width;
      if (width >= 0.05555 && width <= 0.05556) {
        this.character = "\u200A";
      } else if (width >= 0.1666 && width <= 0.1667) {
        this.character = "\u2009";
      } else if (width >= 0.2222 && width <= 0.2223) {
        this.character = "\u2005";
      } else if (width >= 0.2777 && width <= 0.2778) {
        this.character = "\u2005\u200A";
      } else if (width >= -0.05556 && width <= -0.05555) {
        this.character = "\u200A\u2063";
      } else if (width >= -0.1667 && width <= -0.1666) {
        this.character = "\u2009\u2063";
      } else if (width >= -0.2223 && width <= -0.2222) {
        this.character = "\u205F\u2063";
      } else if (width >= -0.2778 && width <= -0.2777) {
        this.character = "\u2005\u2063";
      } else {
        this.character = null;
      }
    }
    /**
     * Converts the math node into a MathML-namespaced DOM element.
     */
    toNode() {
      if (this.character) {
        return document.createTextNode(this.character);
      } else {
        var node = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mspace");
        node.setAttribute("width", makeEm(this.width));
        return node;
      }
    }
    /**
     * Converts the math node into an HTML markup string.
     */
    toMarkup() {
      if (this.character) {
        return "<mtext>" + this.character + "</mtext>";
      } else {
        return '<mspace width="' + makeEm(this.width) + '"/>';
      }
    }
    /**
     * Converts the math node into a string, similar to innerText.
     */
    toText() {
      if (this.character) {
        return this.character;
      } else {
        return " ";
      }
    }
  };
  var mathMLTree = {
    MathNode,
    TextNode,
    SpaceNode,
    newDocumentFragment
  };
  var makeText = function makeText2(text2, mode, options) {
    if (symbols[mode][text2] && symbols[mode][text2].replace && text2.charCodeAt(0) !== 55349 && !(ligatures.hasOwnProperty(text2) && options && (options.fontFamily && options.fontFamily.slice(4, 6) === "tt" || options.font && options.font.slice(4, 6) === "tt"))) {
      text2 = symbols[mode][text2].replace;
    }
    return new mathMLTree.TextNode(text2);
  };
  var makeRow = function makeRow2(body) {
    if (body.length === 1) {
      return body[0];
    } else {
      return new mathMLTree.MathNode("mrow", body);
    }
  };
  var getVariant = function getVariant2(group, options) {
    if (options.fontFamily === "texttt") {
      return "monospace";
    } else if (options.fontFamily === "textsf") {
      if (options.fontShape === "textit" && options.fontWeight === "textbf") {
        return "sans-serif-bold-italic";
      } else if (options.fontShape === "textit") {
        return "sans-serif-italic";
      } else if (options.fontWeight === "textbf") {
        return "bold-sans-serif";
      } else {
        return "sans-serif";
      }
    } else if (options.fontShape === "textit" && options.fontWeight === "textbf") {
      return "bold-italic";
    } else if (options.fontShape === "textit") {
      return "italic";
    } else if (options.fontWeight === "textbf") {
      return "bold";
    }
    var font = options.font;
    if (!font || font === "mathnormal") {
      return null;
    }
    var mode = group.mode;
    if (font === "mathit") {
      return "italic";
    } else if (font === "boldsymbol") {
      return group.type === "textord" ? "bold" : "bold-italic";
    } else if (font === "mathbf") {
      return "bold";
    } else if (font === "mathbb") {
      return "double-struck";
    } else if (font === "mathsfit") {
      return "sans-serif-italic";
    } else if (font === "mathfrak") {
      return "fraktur";
    } else if (font === "mathscr" || font === "mathcal") {
      return "script";
    } else if (font === "mathsf") {
      return "sans-serif";
    } else if (font === "mathtt") {
      return "monospace";
    }
    var text2 = group.text;
    if (["\\imath", "\\jmath"].includes(text2)) {
      return null;
    }
    if (symbols[mode][text2] && symbols[mode][text2].replace) {
      text2 = symbols[mode][text2].replace;
    }
    var fontName = buildCommon.fontMap[font].fontName;
    if (getCharacterMetrics(text2, fontName, mode)) {
      return buildCommon.fontMap[font].variant;
    }
    return null;
  };
  function isNumberPunctuation(group) {
    if (!group) {
      return false;
    }
    if (group.type === "mi" && group.children.length === 1) {
      var child = group.children[0];
      return child instanceof TextNode && child.text === ".";
    } else if (group.type === "mo" && group.children.length === 1 && group.getAttribute("separator") === "true" && group.getAttribute("lspace") === "0em" && group.getAttribute("rspace") === "0em") {
      var _child = group.children[0];
      return _child instanceof TextNode && _child.text === ",";
    } else {
      return false;
    }
  }
  var buildExpression2 = function buildExpression3(expression, options, isOrdgroup) {
    if (expression.length === 1) {
      var group = buildGroup2(expression[0], options);
      if (isOrdgroup && group instanceof MathNode && group.type === "mo") {
        group.setAttribute("lspace", "0em");
        group.setAttribute("rspace", "0em");
      }
      return [group];
    }
    var groups = [];
    var lastGroup;
    for (var i = 0; i < expression.length; i++) {
      var _group = buildGroup2(expression[i], options);
      if (_group instanceof MathNode && lastGroup instanceof MathNode) {
        if (_group.type === "mtext" && lastGroup.type === "mtext" && _group.getAttribute("mathvariant") === lastGroup.getAttribute("mathvariant")) {
          lastGroup.children.push(..._group.children);
          continue;
        } else if (_group.type === "mn" && lastGroup.type === "mn") {
          lastGroup.children.push(..._group.children);
          continue;
        } else if (isNumberPunctuation(_group) && lastGroup.type === "mn") {
          lastGroup.children.push(..._group.children);
          continue;
        } else if (_group.type === "mn" && isNumberPunctuation(lastGroup)) {
          _group.children = [...lastGroup.children, ..._group.children];
          groups.pop();
        } else if ((_group.type === "msup" || _group.type === "msub") && _group.children.length >= 1 && (lastGroup.type === "mn" || isNumberPunctuation(lastGroup))) {
          var base = _group.children[0];
          if (base instanceof MathNode && base.type === "mn") {
            base.children = [...lastGroup.children, ...base.children];
            groups.pop();
          }
        } else if (lastGroup.type === "mi" && lastGroup.children.length === 1) {
          var lastChild = lastGroup.children[0];
          if (lastChild instanceof TextNode && lastChild.text === "\u0338" && (_group.type === "mo" || _group.type === "mi" || _group.type === "mn")) {
            var child = _group.children[0];
            if (child instanceof TextNode && child.text.length > 0) {
              child.text = child.text.slice(0, 1) + "\u0338" + child.text.slice(1);
              groups.pop();
            }
          }
        }
      }
      groups.push(_group);
      lastGroup = _group;
    }
    return groups;
  };
  var buildExpressionRow = function buildExpressionRow2(expression, options, isOrdgroup) {
    return makeRow(buildExpression2(expression, options, isOrdgroup));
  };
  var buildGroup2 = function buildGroup3(group, options) {
    if (!group) {
      return new mathMLTree.MathNode("mrow");
    }
    if (_mathmlGroupBuilders[group.type]) {
      var result = _mathmlGroupBuilders[group.type](group, options);
      return result;
    } else {
      throw new ParseError("Got group of unknown type: '" + group.type + "'");
    }
  };
  function buildMathML(tree, texExpression, options, isDisplayMode, forMathmlOnly) {
    var expression = buildExpression2(tree, options);
    var wrapper;
    if (expression.length === 1 && expression[0] instanceof MathNode && ["mrow", "mtable"].includes(expression[0].type)) {
      wrapper = expression[0];
    } else {
      wrapper = new mathMLTree.MathNode("mrow", expression);
    }
    var annotation = new mathMLTree.MathNode("annotation", [new mathMLTree.TextNode(texExpression)]);
    annotation.setAttribute("encoding", "application/x-tex");
    var semantics = new mathMLTree.MathNode("semantics", [wrapper, annotation]);
    var math2 = new mathMLTree.MathNode("math", [semantics]);
    math2.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");
    if (isDisplayMode) {
      math2.setAttribute("display", "block");
    }
    var wrapperClass = forMathmlOnly ? "katex" : "katex-mathml";
    return buildCommon.makeSpan([wrapperClass], [math2]);
  }
  var optionsFromSettings = function optionsFromSettings2(settings) {
    return new Options({
      style: settings.displayMode ? Style$1.DISPLAY : Style$1.TEXT,
      maxSize: settings.maxSize,
      minRuleThickness: settings.minRuleThickness
    });
  };
  var displayWrap = function displayWrap2(node, settings) {
    if (settings.displayMode) {
      var classes = ["katex-display"];
      if (settings.leqno) {
        classes.push("leqno");
      }
      if (settings.fleqn) {
        classes.push("fleqn");
      }
      node = buildCommon.makeSpan(classes, [node]);
    }
    return node;
  };
  var buildTree = function buildTree2(tree, expression, settings) {
    var options = optionsFromSettings(settings);
    var katexNode;
    if (settings.output === "mathml") {
      return buildMathML(tree, expression, options, settings.displayMode, true);
    } else if (settings.output === "html") {
      var htmlNode = buildHTML(tree, options);
      katexNode = buildCommon.makeSpan(["katex"], [htmlNode]);
    } else {
      var mathMLNode = buildMathML(tree, expression, options, settings.displayMode, false);
      var _htmlNode = buildHTML(tree, options);
      katexNode = buildCommon.makeSpan(["katex"], [mathMLNode, _htmlNode]);
    }
    return displayWrap(katexNode, settings);
  };
  var buildHTMLTree = function buildHTMLTree2(tree, expression, settings) {
    var options = optionsFromSettings(settings);
    var htmlNode = buildHTML(tree, options);
    var katexNode = buildCommon.makeSpan(["katex"], [htmlNode]);
    return displayWrap(katexNode, settings);
  };
  var stretchyCodePoint = {
    widehat: "^",
    widecheck: "\u02C7",
    widetilde: "~",
    utilde: "~",
    overleftarrow: "\u2190",
    underleftarrow: "\u2190",
    xleftarrow: "\u2190",
    overrightarrow: "\u2192",
    underrightarrow: "\u2192",
    xrightarrow: "\u2192",
    underbrace: "\u23DF",
    overbrace: "\u23DE",
    overgroup: "\u23E0",
    undergroup: "\u23E1",
    overleftrightarrow: "\u2194",
    underleftrightarrow: "\u2194",
    xleftrightarrow: "\u2194",
    Overrightarrow: "\u21D2",
    xRightarrow: "\u21D2",
    overleftharpoon: "\u21BC",
    xleftharpoonup: "\u21BC",
    overrightharpoon: "\u21C0",
    xrightharpoonup: "\u21C0",
    xLeftarrow: "\u21D0",
    xLeftrightarrow: "\u21D4",
    xhookleftarrow: "\u21A9",
    xhookrightarrow: "\u21AA",
    xmapsto: "\u21A6",
    xrightharpoondown: "\u21C1",
    xleftharpoondown: "\u21BD",
    xrightleftharpoons: "\u21CC",
    xleftrightharpoons: "\u21CB",
    xtwoheadleftarrow: "\u219E",
    xtwoheadrightarrow: "\u21A0",
    xlongequal: "=",
    xtofrom: "\u21C4",
    xrightleftarrows: "\u21C4",
    xrightequilibrium: "\u21CC",
    // Not a perfect match.
    xleftequilibrium: "\u21CB",
    // None better available.
    "\\cdrightarrow": "\u2192",
    "\\cdleftarrow": "\u2190",
    "\\cdlongequal": "="
  };
  var mathMLnode = function mathMLnode2(label) {
    var node = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(stretchyCodePoint[label.replace(/^\\/, "")])]);
    node.setAttribute("stretchy", "true");
    return node;
  };
  var katexImagesData = {
    //   path(s), minWidth, height, align
    overrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
    overleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
    underrightarrow: [["rightarrow"], 0.888, 522, "xMaxYMin"],
    underleftarrow: [["leftarrow"], 0.888, 522, "xMinYMin"],
    xrightarrow: [["rightarrow"], 1.469, 522, "xMaxYMin"],
    "\\cdrightarrow": [["rightarrow"], 3, 522, "xMaxYMin"],
    // CD minwwidth2.5pc
    xleftarrow: [["leftarrow"], 1.469, 522, "xMinYMin"],
    "\\cdleftarrow": [["leftarrow"], 3, 522, "xMinYMin"],
    Overrightarrow: [["doublerightarrow"], 0.888, 560, "xMaxYMin"],
    xRightarrow: [["doublerightarrow"], 1.526, 560, "xMaxYMin"],
    xLeftarrow: [["doubleleftarrow"], 1.526, 560, "xMinYMin"],
    overleftharpoon: [["leftharpoon"], 0.888, 522, "xMinYMin"],
    xleftharpoonup: [["leftharpoon"], 0.888, 522, "xMinYMin"],
    xleftharpoondown: [["leftharpoondown"], 0.888, 522, "xMinYMin"],
    overrightharpoon: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
    xrightharpoonup: [["rightharpoon"], 0.888, 522, "xMaxYMin"],
    xrightharpoondown: [["rightharpoondown"], 0.888, 522, "xMaxYMin"],
    xlongequal: [["longequal"], 0.888, 334, "xMinYMin"],
    "\\cdlongequal": [["longequal"], 3, 334, "xMinYMin"],
    xtwoheadleftarrow: [["twoheadleftarrow"], 0.888, 334, "xMinYMin"],
    xtwoheadrightarrow: [["twoheadrightarrow"], 0.888, 334, "xMaxYMin"],
    overleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
    overbrace: [["leftbrace", "midbrace", "rightbrace"], 1.6, 548],
    underbrace: [["leftbraceunder", "midbraceunder", "rightbraceunder"], 1.6, 548],
    underleftrightarrow: [["leftarrow", "rightarrow"], 0.888, 522],
    xleftrightarrow: [["leftarrow", "rightarrow"], 1.75, 522],
    xLeftrightarrow: [["doubleleftarrow", "doublerightarrow"], 1.75, 560],
    xrightleftharpoons: [["leftharpoondownplus", "rightharpoonplus"], 1.75, 716],
    xleftrightharpoons: [["leftharpoonplus", "rightharpoondownplus"], 1.75, 716],
    xhookleftarrow: [["leftarrow", "righthook"], 1.08, 522],
    xhookrightarrow: [["lefthook", "rightarrow"], 1.08, 522],
    overlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
    underlinesegment: [["leftlinesegment", "rightlinesegment"], 0.888, 522],
    overgroup: [["leftgroup", "rightgroup"], 0.888, 342],
    undergroup: [["leftgroupunder", "rightgroupunder"], 0.888, 342],
    xmapsto: [["leftmapsto", "rightarrow"], 1.5, 522],
    xtofrom: [["leftToFrom", "rightToFrom"], 1.75, 528],
    // The next three arrows are from the mhchem package.
    // In mhchem.sty, min-length is 2.0em. But these arrows might appear in the
    // document as \xrightarrow or \xrightleftharpoons. Those have
    // min-length = 1.75em, so we set min-length on these next three to match.
    xrightleftarrows: [["baraboveleftarrow", "rightarrowabovebar"], 1.75, 901],
    xrightequilibrium: [["baraboveshortleftharpoon", "rightharpoonaboveshortbar"], 1.75, 716],
    xleftequilibrium: [["shortbaraboveleftharpoon", "shortrightharpoonabovebar"], 1.75, 716]
  };
  var groupLength = function groupLength2(arg) {
    if (arg.type === "ordgroup") {
      return arg.body.length;
    } else {
      return 1;
    }
  };
  var svgSpan = function svgSpan2(group, options) {
    function buildSvgSpan_() {
      var viewBoxWidth = 4e5;
      var label = group.label.slice(1);
      if (["widehat", "widecheck", "widetilde", "utilde"].includes(label)) {
        var grp = group;
        var numChars = groupLength(grp.base);
        var viewBoxHeight;
        var pathName;
        var _height;
        if (numChars > 5) {
          if (label === "widehat" || label === "widecheck") {
            viewBoxHeight = 420;
            viewBoxWidth = 2364;
            _height = 0.42;
            pathName = label + "4";
          } else {
            viewBoxHeight = 312;
            viewBoxWidth = 2340;
            _height = 0.34;
            pathName = "tilde4";
          }
        } else {
          var imgIndex = [1, 1, 2, 2, 3, 3][numChars];
          if (label === "widehat" || label === "widecheck") {
            viewBoxWidth = [0, 1062, 2364, 2364, 2364][imgIndex];
            viewBoxHeight = [0, 239, 300, 360, 420][imgIndex];
            _height = [0, 0.24, 0.3, 0.3, 0.36, 0.42][imgIndex];
            pathName = label + imgIndex;
          } else {
            viewBoxWidth = [0, 600, 1033, 2339, 2340][imgIndex];
            viewBoxHeight = [0, 260, 286, 306, 312][imgIndex];
            _height = [0, 0.26, 0.286, 0.3, 0.306, 0.34][imgIndex];
            pathName = "tilde" + imgIndex;
          }
        }
        var path2 = new PathNode(pathName);
        var svgNode = new SvgNode([path2], {
          "width": "100%",
          "height": makeEm(_height),
          "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight,
          "preserveAspectRatio": "none"
        });
        return {
          span: buildCommon.makeSvgSpan([], [svgNode], options),
          minWidth: 0,
          height: _height
        };
      } else {
        var spans = [];
        var data2 = katexImagesData[label];
        var [paths, _minWidth, _viewBoxHeight] = data2;
        var _height2 = _viewBoxHeight / 1e3;
        var numSvgChildren = paths.length;
        var widthClasses;
        var aligns;
        if (numSvgChildren === 1) {
          var align1 = data2[3];
          widthClasses = ["hide-tail"];
          aligns = [align1];
        } else if (numSvgChildren === 2) {
          widthClasses = ["halfarrow-left", "halfarrow-right"];
          aligns = ["xMinYMin", "xMaxYMin"];
        } else if (numSvgChildren === 3) {
          widthClasses = ["brace-left", "brace-center", "brace-right"];
          aligns = ["xMinYMin", "xMidYMin", "xMaxYMin"];
        } else {
          throw new Error("Correct katexImagesData or update code here to support\n                    " + numSvgChildren + " children.");
        }
        for (var i = 0; i < numSvgChildren; i++) {
          var _path = new PathNode(paths[i]);
          var _svgNode = new SvgNode([_path], {
            "width": "400em",
            "height": makeEm(_height2),
            "viewBox": "0 0 " + viewBoxWidth + " " + _viewBoxHeight,
            "preserveAspectRatio": aligns[i] + " slice"
          });
          var _span = buildCommon.makeSvgSpan([widthClasses[i]], [_svgNode], options);
          if (numSvgChildren === 1) {
            return {
              span: _span,
              minWidth: _minWidth,
              height: _height2
            };
          } else {
            _span.style.height = makeEm(_height2);
            spans.push(_span);
          }
        }
        return {
          span: buildCommon.makeSpan(["stretchy"], spans, options),
          minWidth: _minWidth,
          height: _height2
        };
      }
    }
    var {
      span,
      minWidth,
      height
    } = buildSvgSpan_();
    span.height = height;
    span.style.height = makeEm(height);
    if (minWidth > 0) {
      span.style.minWidth = makeEm(minWidth);
    }
    return span;
  };
  var encloseSpan = function encloseSpan2(inner2, label, topPad, bottomPad, options) {
    var img;
    var totalHeight = inner2.height + inner2.depth + topPad + bottomPad;
    if (/fbox|color|angl/.test(label)) {
      img = buildCommon.makeSpan(["stretchy", label], [], options);
      if (label === "fbox") {
        var color = options.color && options.getColor();
        if (color) {
          img.style.borderColor = color;
        }
      }
    } else {
      var lines = [];
      if (/^[bx]cancel$/.test(label)) {
        lines.push(new LineNode({
          "x1": "0",
          "y1": "0",
          "x2": "100%",
          "y2": "100%",
          "stroke-width": "0.046em"
        }));
      }
      if (/^x?cancel$/.test(label)) {
        lines.push(new LineNode({
          "x1": "0",
          "y1": "100%",
          "x2": "100%",
          "y2": "0",
          "stroke-width": "0.046em"
        }));
      }
      var svgNode = new SvgNode(lines, {
        "width": "100%",
        "height": makeEm(totalHeight)
      });
      img = buildCommon.makeSvgSpan([], [svgNode], options);
    }
    img.height = totalHeight;
    img.style.height = makeEm(totalHeight);
    return img;
  };
  var stretchy = {
    encloseSpan,
    mathMLnode,
    svgSpan
  };
  function assertNodeType(node, type) {
    if (!node || node.type !== type) {
      throw new Error("Expected node of type " + type + ", but got " + (node ? "node of type " + node.type : String(node)));
    }
    return node;
  }
  function assertSymbolNodeType(node) {
    var typedNode = checkSymbolNodeType(node);
    if (!typedNode) {
      throw new Error("Expected node of symbol group type, but got " + (node ? "node of type " + node.type : String(node)));
    }
    return typedNode;
  }
  function checkSymbolNodeType(node) {
    if (node && (node.type === "atom" || NON_ATOMS.hasOwnProperty(node.type))) {
      return node;
    }
    return null;
  }
  var htmlBuilder$a = (grp, options) => {
    var base;
    var group;
    var supSubGroup;
    if (grp && grp.type === "supsub") {
      group = assertNodeType(grp.base, "accent");
      base = group.base;
      grp.base = base;
      supSubGroup = assertSpan(buildGroup$1(grp, options));
      grp.base = group;
    } else {
      group = assertNodeType(grp, "accent");
      base = group.base;
    }
    var body = buildGroup$1(base, options.havingCrampedStyle());
    var mustShift = group.isShifty && utils.isCharacterBox(base);
    var skew = 0;
    if (mustShift) {
      var baseChar = utils.getBaseElem(base);
      var baseGroup = buildGroup$1(baseChar, options.havingCrampedStyle());
      skew = assertSymbolDomNode(baseGroup).skew;
    }
    var accentBelow = group.label === "\\c";
    var clearance = accentBelow ? body.height + body.depth : Math.min(body.height, options.fontMetrics().xHeight);
    var accentBody;
    if (!group.isStretchy) {
      var accent2;
      var width;
      if (group.label === "\\vec") {
        accent2 = buildCommon.staticSvg("vec", options);
        width = buildCommon.svgData.vec[1];
      } else {
        accent2 = buildCommon.makeOrd({
          mode: group.mode,
          text: group.label
        }, options, "textord");
        accent2 = assertSymbolDomNode(accent2);
        accent2.italic = 0;
        width = accent2.width;
        if (accentBelow) {
          clearance += accent2.depth;
        }
      }
      accentBody = buildCommon.makeSpan(["accent-body"], [accent2]);
      var accentFull = group.label === "\\textcircled";
      if (accentFull) {
        accentBody.classes.push("accent-full");
        clearance = body.height;
      }
      var left = skew;
      if (!accentFull) {
        left -= width / 2;
      }
      accentBody.style.left = makeEm(left);
      if (group.label === "\\textcircled") {
        accentBody.style.top = ".2em";
      }
      accentBody = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: body
        }, {
          type: "kern",
          size: -clearance
        }, {
          type: "elem",
          elem: accentBody
        }]
      }, options);
    } else {
      accentBody = stretchy.svgSpan(group, options);
      accentBody = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: body
        }, {
          type: "elem",
          elem: accentBody,
          wrapperClasses: ["svg-align"],
          wrapperStyle: skew > 0 ? {
            width: "calc(100% - " + makeEm(2 * skew) + ")",
            marginLeft: makeEm(2 * skew)
          } : void 0
        }]
      }, options);
    }
    var accentWrap = buildCommon.makeSpan(["mord", "accent"], [accentBody], options);
    if (supSubGroup) {
      supSubGroup.children[0] = accentWrap;
      supSubGroup.height = Math.max(accentWrap.height, supSubGroup.height);
      supSubGroup.classes[0] = "mord";
      return supSubGroup;
    } else {
      return accentWrap;
    }
  };
  var mathmlBuilder$9 = (group, options) => {
    var accentNode = group.isStretchy ? stretchy.mathMLnode(group.label) : new mathMLTree.MathNode("mo", [makeText(group.label, group.mode)]);
    var node = new mathMLTree.MathNode("mover", [buildGroup2(group.base, options), accentNode]);
    node.setAttribute("accent", "true");
    return node;
  };
  var NON_STRETCHY_ACCENT_REGEX = new RegExp(["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring"].map((accent2) => "\\" + accent2).join("|"));
  defineFunction({
    type: "accent",
    names: ["\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve", "\\check", "\\hat", "\\vec", "\\dot", "\\mathring", "\\widecheck", "\\widehat", "\\widetilde", "\\overrightarrow", "\\overleftarrow", "\\Overrightarrow", "\\overleftrightarrow", "\\overgroup", "\\overlinesegment", "\\overleftharpoon", "\\overrightharpoon"],
    props: {
      numArgs: 1
    },
    handler: (context, args) => {
      var base = normalizeArgument(args[0]);
      var isStretchy = !NON_STRETCHY_ACCENT_REGEX.test(context.funcName);
      var isShifty = !isStretchy || context.funcName === "\\widehat" || context.funcName === "\\widetilde" || context.funcName === "\\widecheck";
      return {
        type: "accent",
        mode: context.parser.mode,
        label: context.funcName,
        isStretchy,
        isShifty,
        base
      };
    },
    htmlBuilder: htmlBuilder$a,
    mathmlBuilder: mathmlBuilder$9
  });
  defineFunction({
    type: "accent",
    names: ["\\'", "\\`", "\\^", "\\~", "\\=", "\\u", "\\.", '\\"', "\\c", "\\r", "\\H", "\\v", "\\textcircled"],
    props: {
      numArgs: 1,
      allowedInText: true,
      allowedInMath: true,
      // unless in strict mode
      argTypes: ["primitive"]
    },
    handler: (context, args) => {
      var base = args[0];
      var mode = context.parser.mode;
      if (mode === "math") {
        context.parser.settings.reportNonstrict("mathVsTextAccents", "LaTeX's accent " + context.funcName + " works only in text mode");
        mode = "text";
      }
      return {
        type: "accent",
        mode,
        label: context.funcName,
        isStretchy: false,
        isShifty: true,
        base
      };
    },
    htmlBuilder: htmlBuilder$a,
    mathmlBuilder: mathmlBuilder$9
  });
  defineFunction({
    type: "accentUnder",
    names: ["\\underleftarrow", "\\underrightarrow", "\\underleftrightarrow", "\\undergroup", "\\underlinesegment", "\\utilde"],
    props: {
      numArgs: 1
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName
      } = _ref;
      var base = args[0];
      return {
        type: "accentUnder",
        mode: parser.mode,
        label: funcName,
        base
      };
    },
    htmlBuilder: (group, options) => {
      var innerGroup = buildGroup$1(group.base, options);
      var accentBody = stretchy.svgSpan(group, options);
      var kern = group.label === "\\utilde" ? 0.12 : 0;
      var vlist = buildCommon.makeVList({
        positionType: "top",
        positionData: innerGroup.height,
        children: [{
          type: "elem",
          elem: accentBody,
          wrapperClasses: ["svg-align"]
        }, {
          type: "kern",
          size: kern
        }, {
          type: "elem",
          elem: innerGroup
        }]
      }, options);
      return buildCommon.makeSpan(["mord", "accentunder"], [vlist], options);
    },
    mathmlBuilder: (group, options) => {
      var accentNode = stretchy.mathMLnode(group.label);
      var node = new mathMLTree.MathNode("munder", [buildGroup2(group.base, options), accentNode]);
      node.setAttribute("accentunder", "true");
      return node;
    }
  });
  var paddedNode = (group) => {
    var node = new mathMLTree.MathNode("mpadded", group ? [group] : []);
    node.setAttribute("width", "+0.6em");
    node.setAttribute("lspace", "0.3em");
    return node;
  };
  defineFunction({
    type: "xArrow",
    names: [
      "\\xleftarrow",
      "\\xrightarrow",
      "\\xLeftarrow",
      "\\xRightarrow",
      "\\xleftrightarrow",
      "\\xLeftrightarrow",
      "\\xhookleftarrow",
      "\\xhookrightarrow",
      "\\xmapsto",
      "\\xrightharpoondown",
      "\\xrightharpoonup",
      "\\xleftharpoondown",
      "\\xleftharpoonup",
      "\\xrightleftharpoons",
      "\\xleftrightharpoons",
      "\\xlongequal",
      "\\xtwoheadrightarrow",
      "\\xtwoheadleftarrow",
      "\\xtofrom",
      // The next 3 functions are here to support the mhchem extension.
      // Direct use of these functions is discouraged and may break someday.
      "\\xrightleftarrows",
      "\\xrightequilibrium",
      "\\xleftequilibrium",
      // The next 3 functions are here only to support the {CD} environment.
      "\\\\cdrightarrow",
      "\\\\cdleftarrow",
      "\\\\cdlongequal"
    ],
    props: {
      numArgs: 1,
      numOptionalArgs: 1
    },
    handler(_ref, args, optArgs) {
      var {
        parser,
        funcName
      } = _ref;
      return {
        type: "xArrow",
        mode: parser.mode,
        label: funcName,
        body: args[0],
        below: optArgs[0]
      };
    },
    // Flow is unable to correctly infer the type of `group`, even though it's
    // unambiguously determined from the passed-in `type` above.
    htmlBuilder(group, options) {
      var style = options.style;
      var newOptions = options.havingStyle(style.sup());
      var upperGroup = buildCommon.wrapFragment(buildGroup$1(group.body, newOptions, options), options);
      var arrowPrefix = group.label.slice(0, 2) === "\\x" ? "x" : "cd";
      upperGroup.classes.push(arrowPrefix + "-arrow-pad");
      var lowerGroup;
      if (group.below) {
        newOptions = options.havingStyle(style.sub());
        lowerGroup = buildCommon.wrapFragment(buildGroup$1(group.below, newOptions, options), options);
        lowerGroup.classes.push(arrowPrefix + "-arrow-pad");
      }
      var arrowBody = stretchy.svgSpan(group, options);
      var arrowShift = -options.fontMetrics().axisHeight + 0.5 * arrowBody.height;
      var upperShift = -options.fontMetrics().axisHeight - 0.5 * arrowBody.height - 0.111;
      if (upperGroup.depth > 0.25 || group.label === "\\xleftequilibrium") {
        upperShift -= upperGroup.depth;
      }
      var vlist;
      if (lowerGroup) {
        var lowerShift = -options.fontMetrics().axisHeight + lowerGroup.height + 0.5 * arrowBody.height + 0.111;
        vlist = buildCommon.makeVList({
          positionType: "individualShift",
          children: [{
            type: "elem",
            elem: upperGroup,
            shift: upperShift
          }, {
            type: "elem",
            elem: arrowBody,
            shift: arrowShift
          }, {
            type: "elem",
            elem: lowerGroup,
            shift: lowerShift
          }]
        }, options);
      } else {
        vlist = buildCommon.makeVList({
          positionType: "individualShift",
          children: [{
            type: "elem",
            elem: upperGroup,
            shift: upperShift
          }, {
            type: "elem",
            elem: arrowBody,
            shift: arrowShift
          }]
        }, options);
      }
      vlist.children[0].children[0].children[1].classes.push("svg-align");
      return buildCommon.makeSpan(["mrel", "x-arrow"], [vlist], options);
    },
    mathmlBuilder(group, options) {
      var arrowNode = stretchy.mathMLnode(group.label);
      arrowNode.setAttribute("minsize", group.label.charAt(0) === "x" ? "1.75em" : "3.0em");
      var node;
      if (group.body) {
        var upperNode = paddedNode(buildGroup2(group.body, options));
        if (group.below) {
          var lowerNode = paddedNode(buildGroup2(group.below, options));
          node = new mathMLTree.MathNode("munderover", [arrowNode, lowerNode, upperNode]);
        } else {
          node = new mathMLTree.MathNode("mover", [arrowNode, upperNode]);
        }
      } else if (group.below) {
        var _lowerNode = paddedNode(buildGroup2(group.below, options));
        node = new mathMLTree.MathNode("munder", [arrowNode, _lowerNode]);
      } else {
        node = paddedNode();
        node = new mathMLTree.MathNode("mover", [arrowNode, node]);
      }
      return node;
    }
  });
  var makeSpan2 = buildCommon.makeSpan;
  function htmlBuilder$9(group, options) {
    var elements2 = buildExpression$1(group.body, options, true);
    return makeSpan2([group.mclass], elements2, options);
  }
  function mathmlBuilder$8(group, options) {
    var node;
    var inner2 = buildExpression2(group.body, options);
    if (group.mclass === "minner") {
      node = new mathMLTree.MathNode("mpadded", inner2);
    } else if (group.mclass === "mord") {
      if (group.isCharacterBox) {
        node = inner2[0];
        node.type = "mi";
      } else {
        node = new mathMLTree.MathNode("mi", inner2);
      }
    } else {
      if (group.isCharacterBox) {
        node = inner2[0];
        node.type = "mo";
      } else {
        node = new mathMLTree.MathNode("mo", inner2);
      }
      if (group.mclass === "mbin") {
        node.attributes.lspace = "0.22em";
        node.attributes.rspace = "0.22em";
      } else if (group.mclass === "mpunct") {
        node.attributes.lspace = "0em";
        node.attributes.rspace = "0.17em";
      } else if (group.mclass === "mopen" || group.mclass === "mclose") {
        node.attributes.lspace = "0em";
        node.attributes.rspace = "0em";
      } else if (group.mclass === "minner") {
        node.attributes.lspace = "0.0556em";
        node.attributes.width = "+0.1111em";
      }
    }
    return node;
  }
  defineFunction({
    type: "mclass",
    names: ["\\mathord", "\\mathbin", "\\mathrel", "\\mathopen", "\\mathclose", "\\mathpunct", "\\mathinner"],
    props: {
      numArgs: 1,
      primitive: true
    },
    handler(_ref, args) {
      var {
        parser,
        funcName
      } = _ref;
      var body = args[0];
      return {
        type: "mclass",
        mode: parser.mode,
        mclass: "m" + funcName.slice(5),
        // TODO(kevinb): don't prefix with 'm'
        body: ordargument(body),
        isCharacterBox: utils.isCharacterBox(body)
      };
    },
    htmlBuilder: htmlBuilder$9,
    mathmlBuilder: mathmlBuilder$8
  });
  var binrelClass = (arg) => {
    var atom = arg.type === "ordgroup" && arg.body.length ? arg.body[0] : arg;
    if (atom.type === "atom" && (atom.family === "bin" || atom.family === "rel")) {
      return "m" + atom.family;
    } else {
      return "mord";
    }
  };
  defineFunction({
    type: "mclass",
    names: ["\\@binrel"],
    props: {
      numArgs: 2
    },
    handler(_ref2, args) {
      var {
        parser
      } = _ref2;
      return {
        type: "mclass",
        mode: parser.mode,
        mclass: binrelClass(args[0]),
        body: ordargument(args[1]),
        isCharacterBox: utils.isCharacterBox(args[1])
      };
    }
  });
  defineFunction({
    type: "mclass",
    names: ["\\stackrel", "\\overset", "\\underset"],
    props: {
      numArgs: 2
    },
    handler(_ref3, args) {
      var {
        parser,
        funcName
      } = _ref3;
      var baseArg = args[1];
      var shiftedArg = args[0];
      var mclass;
      if (funcName !== "\\stackrel") {
        mclass = binrelClass(baseArg);
      } else {
        mclass = "mrel";
      }
      var baseOp = {
        type: "op",
        mode: baseArg.mode,
        limits: true,
        alwaysHandleSupSub: true,
        parentIsSupSub: false,
        symbol: false,
        suppressBaseShift: funcName !== "\\stackrel",
        body: ordargument(baseArg)
      };
      var supsub = {
        type: "supsub",
        mode: shiftedArg.mode,
        base: baseOp,
        sup: funcName === "\\underset" ? null : shiftedArg,
        sub: funcName === "\\underset" ? shiftedArg : null
      };
      return {
        type: "mclass",
        mode: parser.mode,
        mclass,
        body: [supsub],
        isCharacterBox: utils.isCharacterBox(supsub)
      };
    },
    htmlBuilder: htmlBuilder$9,
    mathmlBuilder: mathmlBuilder$8
  });
  defineFunction({
    type: "pmb",
    names: ["\\pmb"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      return {
        type: "pmb",
        mode: parser.mode,
        mclass: binrelClass(args[0]),
        body: ordargument(args[0])
      };
    },
    htmlBuilder(group, options) {
      var elements2 = buildExpression$1(group.body, options, true);
      var node = buildCommon.makeSpan([group.mclass], elements2, options);
      node.style.textShadow = "0.02em 0.01em 0.04px";
      return node;
    },
    mathmlBuilder(group, style) {
      var inner2 = buildExpression2(group.body, style);
      var node = new mathMLTree.MathNode("mstyle", inner2);
      node.setAttribute("style", "text-shadow: 0.02em 0.01em 0.04px");
      return node;
    }
  });
  var cdArrowFunctionName = {
    ">": "\\\\cdrightarrow",
    "<": "\\\\cdleftarrow",
    "=": "\\\\cdlongequal",
    "A": "\\uparrow",
    "V": "\\downarrow",
    "|": "\\Vert",
    ".": "no arrow"
  };
  var newCell = () => {
    return {
      type: "styling",
      body: [],
      mode: "math",
      style: "display"
    };
  };
  var isStartOfArrow = (node) => {
    return node.type === "textord" && node.text === "@";
  };
  var isLabelEnd = (node, endChar) => {
    return (node.type === "mathord" || node.type === "atom") && node.text === endChar;
  };
  function cdArrow(arrowChar, labels, parser) {
    var funcName = cdArrowFunctionName[arrowChar];
    switch (funcName) {
      case "\\\\cdrightarrow":
      case "\\\\cdleftarrow":
        return parser.callFunction(funcName, [labels[0]], [labels[1]]);
      case "\\uparrow":
      case "\\downarrow": {
        var leftLabel = parser.callFunction("\\\\cdleft", [labels[0]], []);
        var bareArrow = {
          type: "atom",
          text: funcName,
          mode: "math",
          family: "rel"
        };
        var sizedArrow = parser.callFunction("\\Big", [bareArrow], []);
        var rightLabel = parser.callFunction("\\\\cdright", [labels[1]], []);
        var arrowGroup = {
          type: "ordgroup",
          mode: "math",
          body: [leftLabel, sizedArrow, rightLabel]
        };
        return parser.callFunction("\\\\cdparent", [arrowGroup], []);
      }
      case "\\\\cdlongequal":
        return parser.callFunction("\\\\cdlongequal", [], []);
      case "\\Vert": {
        var arrow = {
          type: "textord",
          text: "\\Vert",
          mode: "math"
        };
        return parser.callFunction("\\Big", [arrow], []);
      }
      default:
        return {
          type: "textord",
          text: " ",
          mode: "math"
        };
    }
  }
  function parseCD(parser) {
    var parsedRows = [];
    parser.gullet.beginGroup();
    parser.gullet.macros.set("\\cr", "\\\\\\relax");
    parser.gullet.beginGroup();
    while (true) {
      parsedRows.push(parser.parseExpression(false, "\\\\"));
      parser.gullet.endGroup();
      parser.gullet.beginGroup();
      var next = parser.fetch().text;
      if (next === "&" || next === "\\\\") {
        parser.consume();
      } else if (next === "\\end") {
        if (parsedRows[parsedRows.length - 1].length === 0) {
          parsedRows.pop();
        }
        break;
      } else {
        throw new ParseError("Expected \\\\ or \\cr or \\end", parser.nextToken);
      }
    }
    var row = [];
    var body = [row];
    for (var i = 0; i < parsedRows.length; i++) {
      var rowNodes = parsedRows[i];
      var cell = newCell();
      for (var j = 0; j < rowNodes.length; j++) {
        if (!isStartOfArrow(rowNodes[j])) {
          cell.body.push(rowNodes[j]);
        } else {
          row.push(cell);
          j += 1;
          var arrowChar = assertSymbolNodeType(rowNodes[j]).text;
          var labels = new Array(2);
          labels[0] = {
            type: "ordgroup",
            mode: "math",
            body: []
          };
          labels[1] = {
            type: "ordgroup",
            mode: "math",
            body: []
          };
          if ("=|.".indexOf(arrowChar) > -1) ;
          else if ("<>AV".indexOf(arrowChar) > -1) {
            for (var labelNum = 0; labelNum < 2; labelNum++) {
              var inLabel = true;
              for (var k = j + 1; k < rowNodes.length; k++) {
                if (isLabelEnd(rowNodes[k], arrowChar)) {
                  inLabel = false;
                  j = k;
                  break;
                }
                if (isStartOfArrow(rowNodes[k])) {
                  throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[k]);
                }
                labels[labelNum].body.push(rowNodes[k]);
              }
              if (inLabel) {
                throw new ParseError("Missing a " + arrowChar + " character to complete a CD arrow.", rowNodes[j]);
              }
            }
          } else {
            throw new ParseError('Expected one of "<>AV=|." after @', rowNodes[j]);
          }
          var arrow = cdArrow(arrowChar, labels, parser);
          var wrappedArrow = {
            type: "styling",
            body: [arrow],
            mode: "math",
            style: "display"
            // CD is always displaystyle.
          };
          row.push(wrappedArrow);
          cell = newCell();
        }
      }
      if (i % 2 === 0) {
        row.push(cell);
      } else {
        row.shift();
      }
      row = [];
      body.push(row);
    }
    parser.gullet.endGroup();
    parser.gullet.endGroup();
    var cols = new Array(body[0].length).fill({
      type: "align",
      align: "c",
      pregap: 0.25,
      // CD package sets \enskip between columns.
      postgap: 0.25
      // So pre and post each get half an \enskip, i.e. 0.25em.
    });
    return {
      type: "array",
      mode: "math",
      body,
      arraystretch: 1,
      addJot: true,
      rowGaps: [null],
      cols,
      colSeparationType: "CD",
      hLinesBeforeRow: new Array(body.length + 1).fill([])
    };
  }
  defineFunction({
    type: "cdlabel",
    names: ["\\\\cdleft", "\\\\cdright"],
    props: {
      numArgs: 1
    },
    handler(_ref, args) {
      var {
        parser,
        funcName
      } = _ref;
      return {
        type: "cdlabel",
        mode: parser.mode,
        side: funcName.slice(4),
        label: args[0]
      };
    },
    htmlBuilder(group, options) {
      var newOptions = options.havingStyle(options.style.sup());
      var label = buildCommon.wrapFragment(buildGroup$1(group.label, newOptions, options), options);
      label.classes.push("cd-label-" + group.side);
      label.style.bottom = makeEm(0.8 - label.depth);
      label.height = 0;
      label.depth = 0;
      return label;
    },
    mathmlBuilder(group, options) {
      var label = new mathMLTree.MathNode("mrow", [buildGroup2(group.label, options)]);
      label = new mathMLTree.MathNode("mpadded", [label]);
      label.setAttribute("width", "0");
      if (group.side === "left") {
        label.setAttribute("lspace", "-1width");
      }
      label.setAttribute("voffset", "0.7em");
      label = new mathMLTree.MathNode("mstyle", [label]);
      label.setAttribute("displaystyle", "false");
      label.setAttribute("scriptlevel", "1");
      return label;
    }
  });
  defineFunction({
    type: "cdlabelparent",
    names: ["\\\\cdparent"],
    props: {
      numArgs: 1
    },
    handler(_ref2, args) {
      var {
        parser
      } = _ref2;
      return {
        type: "cdlabelparent",
        mode: parser.mode,
        fragment: args[0]
      };
    },
    htmlBuilder(group, options) {
      var parent = buildCommon.wrapFragment(buildGroup$1(group.fragment, options), options);
      parent.classes.push("cd-vert-arrow");
      return parent;
    },
    mathmlBuilder(group, options) {
      return new mathMLTree.MathNode("mrow", [buildGroup2(group.fragment, options)]);
    }
  });
  defineFunction({
    type: "textord",
    names: ["\\@char"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      var arg = assertNodeType(args[0], "ordgroup");
      var group = arg.body;
      var number = "";
      for (var i = 0; i < group.length; i++) {
        var node = assertNodeType(group[i], "textord");
        number += node.text;
      }
      var code = parseInt(number);
      var text2;
      if (isNaN(code)) {
        throw new ParseError("\\@char has non-numeric argument " + number);
      } else if (code < 0 || code >= 1114111) {
        throw new ParseError("\\@char with invalid code point " + number);
      } else if (code <= 65535) {
        text2 = String.fromCharCode(code);
      } else {
        code -= 65536;
        text2 = String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
      }
      return {
        type: "textord",
        mode: parser.mode,
        text: text2
      };
    }
  });
  var htmlBuilder$8 = (group, options) => {
    var elements2 = buildExpression$1(group.body, options.withColor(group.color), false);
    return buildCommon.makeFragment(elements2);
  };
  var mathmlBuilder$7 = (group, options) => {
    var inner2 = buildExpression2(group.body, options.withColor(group.color));
    var node = new mathMLTree.MathNode("mstyle", inner2);
    node.setAttribute("mathcolor", group.color);
    return node;
  };
  defineFunction({
    type: "color",
    names: ["\\textcolor"],
    props: {
      numArgs: 2,
      allowedInText: true,
      argTypes: ["color", "original"]
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      var color = assertNodeType(args[0], "color-token").color;
      var body = args[1];
      return {
        type: "color",
        mode: parser.mode,
        color,
        body: ordargument(body)
      };
    },
    htmlBuilder: htmlBuilder$8,
    mathmlBuilder: mathmlBuilder$7
  });
  defineFunction({
    type: "color",
    names: ["\\color"],
    props: {
      numArgs: 1,
      allowedInText: true,
      argTypes: ["color"]
    },
    handler(_ref2, args) {
      var {
        parser,
        breakOnTokenText
      } = _ref2;
      var color = assertNodeType(args[0], "color-token").color;
      parser.gullet.macros.set("\\current@color", color);
      var body = parser.parseExpression(true, breakOnTokenText);
      return {
        type: "color",
        mode: parser.mode,
        color,
        body
      };
    },
    htmlBuilder: htmlBuilder$8,
    mathmlBuilder: mathmlBuilder$7
  });
  defineFunction({
    type: "cr",
    names: ["\\\\"],
    props: {
      numArgs: 0,
      numOptionalArgs: 0,
      allowedInText: true
    },
    handler(_ref, args, optArgs) {
      var {
        parser
      } = _ref;
      var size = parser.gullet.future().text === "[" ? parser.parseSizeGroup(true) : null;
      var newLine = !parser.settings.displayMode || !parser.settings.useStrictBehavior("newLineInDisplayMode", "In LaTeX, \\\\ or \\newline does nothing in display mode");
      return {
        type: "cr",
        mode: parser.mode,
        newLine,
        size: size && assertNodeType(size, "size").value
      };
    },
    // The following builders are called only at the top level,
    // not within tabular/array environments.
    htmlBuilder(group, options) {
      var span = buildCommon.makeSpan(["mspace"], [], options);
      if (group.newLine) {
        span.classes.push("newline");
        if (group.size) {
          span.style.marginTop = makeEm(calculateSize(group.size, options));
        }
      }
      return span;
    },
    mathmlBuilder(group, options) {
      var node = new mathMLTree.MathNode("mspace");
      if (group.newLine) {
        node.setAttribute("linebreak", "newline");
        if (group.size) {
          node.setAttribute("height", makeEm(calculateSize(group.size, options)));
        }
      }
      return node;
    }
  });
  var globalMap = {
    "\\global": "\\global",
    "\\long": "\\\\globallong",
    "\\\\globallong": "\\\\globallong",
    "\\def": "\\gdef",
    "\\gdef": "\\gdef",
    "\\edef": "\\xdef",
    "\\xdef": "\\xdef",
    "\\let": "\\\\globallet",
    "\\futurelet": "\\\\globalfuture"
  };
  var checkControlSequence = (tok) => {
    var name = tok.text;
    if (/^(?:[\\{}$&#^_]|EOF)$/.test(name)) {
      throw new ParseError("Expected a control sequence", tok);
    }
    return name;
  };
  var getRHS = (parser) => {
    var tok = parser.gullet.popToken();
    if (tok.text === "=") {
      tok = parser.gullet.popToken();
      if (tok.text === " ") {
        tok = parser.gullet.popToken();
      }
    }
    return tok;
  };
  var letCommand = (parser, name, tok, global) => {
    var macro = parser.gullet.macros.get(tok.text);
    if (macro == null) {
      tok.noexpand = true;
      macro = {
        tokens: [tok],
        numArgs: 0,
        // reproduce the same behavior in expansion
        unexpandable: !parser.gullet.isExpandable(tok.text)
      };
    }
    parser.gullet.macros.set(name, macro, global);
  };
  defineFunction({
    type: "internal",
    names: [
      "\\global",
      "\\long",
      "\\\\globallong"
      // can’t be entered directly
    ],
    props: {
      numArgs: 0,
      allowedInText: true
    },
    handler(_ref) {
      var {
        parser,
        funcName
      } = _ref;
      parser.consumeSpaces();
      var token = parser.fetch();
      if (globalMap[token.text]) {
        if (funcName === "\\global" || funcName === "\\\\globallong") {
          token.text = globalMap[token.text];
        }
        return assertNodeType(parser.parseFunction(), "internal");
      }
      throw new ParseError("Invalid token after macro prefix", token);
    }
  });
  defineFunction({
    type: "internal",
    names: ["\\def", "\\gdef", "\\edef", "\\xdef"],
    props: {
      numArgs: 0,
      allowedInText: true,
      primitive: true
    },
    handler(_ref2) {
      var {
        parser,
        funcName
      } = _ref2;
      var tok = parser.gullet.popToken();
      var name = tok.text;
      if (/^(?:[\\{}$&#^_]|EOF)$/.test(name)) {
        throw new ParseError("Expected a control sequence", tok);
      }
      var numArgs = 0;
      var insert;
      var delimiters2 = [[]];
      while (parser.gullet.future().text !== "{") {
        tok = parser.gullet.popToken();
        if (tok.text === "#") {
          if (parser.gullet.future().text === "{") {
            insert = parser.gullet.future();
            delimiters2[numArgs].push("{");
            break;
          }
          tok = parser.gullet.popToken();
          if (!/^[1-9]$/.test(tok.text)) {
            throw new ParseError('Invalid argument number "' + tok.text + '"');
          }
          if (parseInt(tok.text) !== numArgs + 1) {
            throw new ParseError('Argument number "' + tok.text + '" out of order');
          }
          numArgs++;
          delimiters2.push([]);
        } else if (tok.text === "EOF") {
          throw new ParseError("Expected a macro definition");
        } else {
          delimiters2[numArgs].push(tok.text);
        }
      }
      var {
        tokens
      } = parser.gullet.consumeArg();
      if (insert) {
        tokens.unshift(insert);
      }
      if (funcName === "\\edef" || funcName === "\\xdef") {
        tokens = parser.gullet.expandTokens(tokens);
        tokens.reverse();
      }
      parser.gullet.macros.set(name, {
        tokens,
        numArgs,
        delimiters: delimiters2
      }, funcName === globalMap[funcName]);
      return {
        type: "internal",
        mode: parser.mode
      };
    }
  });
  defineFunction({
    type: "internal",
    names: [
      "\\let",
      "\\\\globallet"
      // can’t be entered directly
    ],
    props: {
      numArgs: 0,
      allowedInText: true,
      primitive: true
    },
    handler(_ref3) {
      var {
        parser,
        funcName
      } = _ref3;
      var name = checkControlSequence(parser.gullet.popToken());
      parser.gullet.consumeSpaces();
      var tok = getRHS(parser);
      letCommand(parser, name, tok, funcName === "\\\\globallet");
      return {
        type: "internal",
        mode: parser.mode
      };
    }
  });
  defineFunction({
    type: "internal",
    names: [
      "\\futurelet",
      "\\\\globalfuture"
      // can’t be entered directly
    ],
    props: {
      numArgs: 0,
      allowedInText: true,
      primitive: true
    },
    handler(_ref4) {
      var {
        parser,
        funcName
      } = _ref4;
      var name = checkControlSequence(parser.gullet.popToken());
      var middle = parser.gullet.popToken();
      var tok = parser.gullet.popToken();
      letCommand(parser, name, tok, funcName === "\\\\globalfuture");
      parser.gullet.pushToken(tok);
      parser.gullet.pushToken(middle);
      return {
        type: "internal",
        mode: parser.mode
      };
    }
  });
  var getMetrics = function getMetrics2(symbol, font, mode) {
    var replace = symbols.math[symbol] && symbols.math[symbol].replace;
    var metrics = getCharacterMetrics(replace || symbol, font, mode);
    if (!metrics) {
      throw new Error("Unsupported symbol " + symbol + " and font size " + font + ".");
    }
    return metrics;
  };
  var styleWrap = function styleWrap2(delim, toStyle, options, classes) {
    var newOptions = options.havingBaseStyle(toStyle);
    var span = buildCommon.makeSpan(classes.concat(newOptions.sizingClasses(options)), [delim], options);
    var delimSizeMultiplier = newOptions.sizeMultiplier / options.sizeMultiplier;
    span.height *= delimSizeMultiplier;
    span.depth *= delimSizeMultiplier;
    span.maxFontSize = newOptions.sizeMultiplier;
    return span;
  };
  var centerSpan = function centerSpan2(span, options, style) {
    var newOptions = options.havingBaseStyle(style);
    var shift = (1 - options.sizeMultiplier / newOptions.sizeMultiplier) * options.fontMetrics().axisHeight;
    span.classes.push("delimcenter");
    span.style.top = makeEm(shift);
    span.height -= shift;
    span.depth += shift;
  };
  var makeSmallDelim = function makeSmallDelim2(delim, style, center, options, mode, classes) {
    var text2 = buildCommon.makeSymbol(delim, "Main-Regular", mode, options);
    var span = styleWrap(text2, style, options, classes);
    if (center) {
      centerSpan(span, options, style);
    }
    return span;
  };
  var mathrmSize = function mathrmSize2(value, size, mode, options) {
    return buildCommon.makeSymbol(value, "Size" + size + "-Regular", mode, options);
  };
  var makeLargeDelim = function makeLargeDelim2(delim, size, center, options, mode, classes) {
    var inner2 = mathrmSize(delim, size, mode, options);
    var span = styleWrap(buildCommon.makeSpan(["delimsizing", "size" + size], [inner2], options), Style$1.TEXT, options, classes);
    if (center) {
      centerSpan(span, options, Style$1.TEXT);
    }
    return span;
  };
  var makeGlyphSpan = function makeGlyphSpan2(symbol, font, mode) {
    var sizeClass;
    if (font === "Size1-Regular") {
      sizeClass = "delim-size1";
    } else {
      sizeClass = "delim-size4";
    }
    var corner = buildCommon.makeSpan(["delimsizinginner", sizeClass], [buildCommon.makeSpan([], [buildCommon.makeSymbol(symbol, font, mode)])]);
    return {
      type: "elem",
      elem: corner
    };
  };
  var makeInner = function makeInner2(ch, height, options) {
    var width = fontMetricsData["Size4-Regular"][ch.charCodeAt(0)] ? fontMetricsData["Size4-Regular"][ch.charCodeAt(0)][4] : fontMetricsData["Size1-Regular"][ch.charCodeAt(0)][4];
    var path2 = new PathNode("inner", innerPath(ch, Math.round(1e3 * height)));
    var svgNode = new SvgNode([path2], {
      "width": makeEm(width),
      "height": makeEm(height),
      // Override CSS rule `.katex svg { width: 100% }`
      "style": "width:" + makeEm(width),
      "viewBox": "0 0 " + 1e3 * width + " " + Math.round(1e3 * height),
      "preserveAspectRatio": "xMinYMin"
    });
    var span = buildCommon.makeSvgSpan([], [svgNode], options);
    span.height = height;
    span.style.height = makeEm(height);
    span.style.width = makeEm(width);
    return {
      type: "elem",
      elem: span
    };
  };
  var lapInEms = 8e-3;
  var lap = {
    type: "kern",
    size: -1 * lapInEms
  };
  var verts = ["|", "\\lvert", "\\rvert", "\\vert"];
  var doubleVerts = ["\\|", "\\lVert", "\\rVert", "\\Vert"];
  var makeStackedDelim = function makeStackedDelim2(delim, heightTotal, center, options, mode, classes) {
    var top;
    var middle;
    var repeat;
    var bottom;
    var svgLabel = "";
    var viewBoxWidth = 0;
    top = repeat = bottom = delim;
    middle = null;
    var font = "Size1-Regular";
    if (delim === "\\uparrow") {
      repeat = bottom = "\u23D0";
    } else if (delim === "\\Uparrow") {
      repeat = bottom = "\u2016";
    } else if (delim === "\\downarrow") {
      top = repeat = "\u23D0";
    } else if (delim === "\\Downarrow") {
      top = repeat = "\u2016";
    } else if (delim === "\\updownarrow") {
      top = "\\uparrow";
      repeat = "\u23D0";
      bottom = "\\downarrow";
    } else if (delim === "\\Updownarrow") {
      top = "\\Uparrow";
      repeat = "\u2016";
      bottom = "\\Downarrow";
    } else if (verts.includes(delim)) {
      repeat = "\u2223";
      svgLabel = "vert";
      viewBoxWidth = 333;
    } else if (doubleVerts.includes(delim)) {
      repeat = "\u2225";
      svgLabel = "doublevert";
      viewBoxWidth = 556;
    } else if (delim === "[" || delim === "\\lbrack") {
      top = "\u23A1";
      repeat = "\u23A2";
      bottom = "\u23A3";
      font = "Size4-Regular";
      svgLabel = "lbrack";
      viewBoxWidth = 667;
    } else if (delim === "]" || delim === "\\rbrack") {
      top = "\u23A4";
      repeat = "\u23A5";
      bottom = "\u23A6";
      font = "Size4-Regular";
      svgLabel = "rbrack";
      viewBoxWidth = 667;
    } else if (delim === "\\lfloor" || delim === "\u230A") {
      repeat = top = "\u23A2";
      bottom = "\u23A3";
      font = "Size4-Regular";
      svgLabel = "lfloor";
      viewBoxWidth = 667;
    } else if (delim === "\\lceil" || delim === "\u2308") {
      top = "\u23A1";
      repeat = bottom = "\u23A2";
      font = "Size4-Regular";
      svgLabel = "lceil";
      viewBoxWidth = 667;
    } else if (delim === "\\rfloor" || delim === "\u230B") {
      repeat = top = "\u23A5";
      bottom = "\u23A6";
      font = "Size4-Regular";
      svgLabel = "rfloor";
      viewBoxWidth = 667;
    } else if (delim === "\\rceil" || delim === "\u2309") {
      top = "\u23A4";
      repeat = bottom = "\u23A5";
      font = "Size4-Regular";
      svgLabel = "rceil";
      viewBoxWidth = 667;
    } else if (delim === "(" || delim === "\\lparen") {
      top = "\u239B";
      repeat = "\u239C";
      bottom = "\u239D";
      font = "Size4-Regular";
      svgLabel = "lparen";
      viewBoxWidth = 875;
    } else if (delim === ")" || delim === "\\rparen") {
      top = "\u239E";
      repeat = "\u239F";
      bottom = "\u23A0";
      font = "Size4-Regular";
      svgLabel = "rparen";
      viewBoxWidth = 875;
    } else if (delim === "\\{" || delim === "\\lbrace") {
      top = "\u23A7";
      middle = "\u23A8";
      bottom = "\u23A9";
      repeat = "\u23AA";
      font = "Size4-Regular";
    } else if (delim === "\\}" || delim === "\\rbrace") {
      top = "\u23AB";
      middle = "\u23AC";
      bottom = "\u23AD";
      repeat = "\u23AA";
      font = "Size4-Regular";
    } else if (delim === "\\lgroup" || delim === "\u27EE") {
      top = "\u23A7";
      bottom = "\u23A9";
      repeat = "\u23AA";
      font = "Size4-Regular";
    } else if (delim === "\\rgroup" || delim === "\u27EF") {
      top = "\u23AB";
      bottom = "\u23AD";
      repeat = "\u23AA";
      font = "Size4-Regular";
    } else if (delim === "\\lmoustache" || delim === "\u23B0") {
      top = "\u23A7";
      bottom = "\u23AD";
      repeat = "\u23AA";
      font = "Size4-Regular";
    } else if (delim === "\\rmoustache" || delim === "\u23B1") {
      top = "\u23AB";
      bottom = "\u23A9";
      repeat = "\u23AA";
      font = "Size4-Regular";
    }
    var topMetrics = getMetrics(top, font, mode);
    var topHeightTotal = topMetrics.height + topMetrics.depth;
    var repeatMetrics = getMetrics(repeat, font, mode);
    var repeatHeightTotal = repeatMetrics.height + repeatMetrics.depth;
    var bottomMetrics = getMetrics(bottom, font, mode);
    var bottomHeightTotal = bottomMetrics.height + bottomMetrics.depth;
    var middleHeightTotal = 0;
    var middleFactor = 1;
    if (middle !== null) {
      var middleMetrics = getMetrics(middle, font, mode);
      middleHeightTotal = middleMetrics.height + middleMetrics.depth;
      middleFactor = 2;
    }
    var minHeight = topHeightTotal + bottomHeightTotal + middleHeightTotal;
    var repeatCount = Math.max(0, Math.ceil((heightTotal - minHeight) / (middleFactor * repeatHeightTotal)));
    var realHeightTotal = minHeight + repeatCount * middleFactor * repeatHeightTotal;
    var axisHeight = options.fontMetrics().axisHeight;
    if (center) {
      axisHeight *= options.sizeMultiplier;
    }
    var depth = realHeightTotal / 2 - axisHeight;
    var stack = [];
    if (svgLabel.length > 0) {
      var midHeight = realHeightTotal - topHeightTotal - bottomHeightTotal;
      var viewBoxHeight = Math.round(realHeightTotal * 1e3);
      var pathStr = tallDelim(svgLabel, Math.round(midHeight * 1e3));
      var path2 = new PathNode(svgLabel, pathStr);
      var width = (viewBoxWidth / 1e3).toFixed(3) + "em";
      var height = (viewBoxHeight / 1e3).toFixed(3) + "em";
      var svg = new SvgNode([path2], {
        "width": width,
        "height": height,
        "viewBox": "0 0 " + viewBoxWidth + " " + viewBoxHeight
      });
      var wrapper = buildCommon.makeSvgSpan([], [svg], options);
      wrapper.height = viewBoxHeight / 1e3;
      wrapper.style.width = width;
      wrapper.style.height = height;
      stack.push({
        type: "elem",
        elem: wrapper
      });
    } else {
      stack.push(makeGlyphSpan(bottom, font, mode));
      stack.push(lap);
      if (middle === null) {
        var innerHeight = realHeightTotal - topHeightTotal - bottomHeightTotal + 2 * lapInEms;
        stack.push(makeInner(repeat, innerHeight, options));
      } else {
        var _innerHeight = (realHeightTotal - topHeightTotal - bottomHeightTotal - middleHeightTotal) / 2 + 2 * lapInEms;
        stack.push(makeInner(repeat, _innerHeight, options));
        stack.push(lap);
        stack.push(makeGlyphSpan(middle, font, mode));
        stack.push(lap);
        stack.push(makeInner(repeat, _innerHeight, options));
      }
      stack.push(lap);
      stack.push(makeGlyphSpan(top, font, mode));
    }
    var newOptions = options.havingBaseStyle(Style$1.TEXT);
    var inner2 = buildCommon.makeVList({
      positionType: "bottom",
      positionData: depth,
      children: stack
    }, newOptions);
    return styleWrap(buildCommon.makeSpan(["delimsizing", "mult"], [inner2], newOptions), Style$1.TEXT, options, classes);
  };
  var vbPad = 80;
  var emPad = 0.08;
  var sqrtSvg = function sqrtSvg2(sqrtName, height, viewBoxHeight, extraVinculum, options) {
    var path2 = sqrtPath(sqrtName, extraVinculum, viewBoxHeight);
    var pathNode = new PathNode(sqrtName, path2);
    var svg = new SvgNode([pathNode], {
      // Note: 1000:1 ratio of viewBox to document em width.
      "width": "400em",
      "height": makeEm(height),
      "viewBox": "0 0 400000 " + viewBoxHeight,
      "preserveAspectRatio": "xMinYMin slice"
    });
    return buildCommon.makeSvgSpan(["hide-tail"], [svg], options);
  };
  var makeSqrtImage = function makeSqrtImage2(height, options) {
    var newOptions = options.havingBaseSizing();
    var delim = traverseSequence("\\surd", height * newOptions.sizeMultiplier, stackLargeDelimiterSequence, newOptions);
    var sizeMultiplier = newOptions.sizeMultiplier;
    var extraVinculum = Math.max(0, options.minRuleThickness - options.fontMetrics().sqrtRuleThickness);
    var span;
    var spanHeight = 0;
    var texHeight = 0;
    var viewBoxHeight = 0;
    var advanceWidth;
    if (delim.type === "small") {
      viewBoxHeight = 1e3 + 1e3 * extraVinculum + vbPad;
      if (height < 1) {
        sizeMultiplier = 1;
      } else if (height < 1.4) {
        sizeMultiplier = 0.7;
      }
      spanHeight = (1 + extraVinculum + emPad) / sizeMultiplier;
      texHeight = (1 + extraVinculum) / sizeMultiplier;
      span = sqrtSvg("sqrtMain", spanHeight, viewBoxHeight, extraVinculum, options);
      span.style.minWidth = "0.853em";
      advanceWidth = 0.833 / sizeMultiplier;
    } else if (delim.type === "large") {
      viewBoxHeight = (1e3 + vbPad) * sizeToMaxHeight[delim.size];
      texHeight = (sizeToMaxHeight[delim.size] + extraVinculum) / sizeMultiplier;
      spanHeight = (sizeToMaxHeight[delim.size] + extraVinculum + emPad) / sizeMultiplier;
      span = sqrtSvg("sqrtSize" + delim.size, spanHeight, viewBoxHeight, extraVinculum, options);
      span.style.minWidth = "1.02em";
      advanceWidth = 1 / sizeMultiplier;
    } else {
      spanHeight = height + extraVinculum + emPad;
      texHeight = height + extraVinculum;
      viewBoxHeight = Math.floor(1e3 * height + extraVinculum) + vbPad;
      span = sqrtSvg("sqrtTall", spanHeight, viewBoxHeight, extraVinculum, options);
      span.style.minWidth = "0.742em";
      advanceWidth = 1.056;
    }
    span.height = texHeight;
    span.style.height = makeEm(spanHeight);
    return {
      span,
      advanceWidth,
      // Calculate the actual line width.
      // This actually should depend on the chosen font -- e.g. \boldmath
      // should use the thicker surd symbols from e.g. KaTeX_Main-Bold, and
      // have thicker rules.
      ruleWidth: (options.fontMetrics().sqrtRuleThickness + extraVinculum) * sizeMultiplier
    };
  };
  var stackLargeDelimiters = ["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230A", "\u230B", "\\lceil", "\\rceil", "\u2308", "\u2309", "\\surd"];
  var stackAlwaysDelimiters = ["\\uparrow", "\\downarrow", "\\updownarrow", "\\Uparrow", "\\Downarrow", "\\Updownarrow", "|", "\\|", "\\vert", "\\Vert", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27EE", "\u27EF", "\\lmoustache", "\\rmoustache", "\u23B0", "\u23B1"];
  var stackNeverDelimiters = ["<", ">", "\\langle", "\\rangle", "/", "\\backslash", "\\lt", "\\gt"];
  var sizeToMaxHeight = [0, 1.2, 1.8, 2.4, 3];
  var makeSizedDelim = function makeSizedDelim2(delim, size, options, mode, classes) {
    if (delim === "<" || delim === "\\lt" || delim === "\u27E8") {
      delim = "\\langle";
    } else if (delim === ">" || delim === "\\gt" || delim === "\u27E9") {
      delim = "\\rangle";
    }
    if (stackLargeDelimiters.includes(delim) || stackNeverDelimiters.includes(delim)) {
      return makeLargeDelim(delim, size, false, options, mode, classes);
    } else if (stackAlwaysDelimiters.includes(delim)) {
      return makeStackedDelim(delim, sizeToMaxHeight[size], false, options, mode, classes);
    } else {
      throw new ParseError("Illegal delimiter: '" + delim + "'");
    }
  };
  var stackNeverDelimiterSequence = [{
    type: "small",
    style: Style$1.SCRIPTSCRIPT
  }, {
    type: "small",
    style: Style$1.SCRIPT
  }, {
    type: "small",
    style: Style$1.TEXT
  }, {
    type: "large",
    size: 1
  }, {
    type: "large",
    size: 2
  }, {
    type: "large",
    size: 3
  }, {
    type: "large",
    size: 4
  }];
  var stackAlwaysDelimiterSequence = [{
    type: "small",
    style: Style$1.SCRIPTSCRIPT
  }, {
    type: "small",
    style: Style$1.SCRIPT
  }, {
    type: "small",
    style: Style$1.TEXT
  }, {
    type: "stack"
  }];
  var stackLargeDelimiterSequence = [{
    type: "small",
    style: Style$1.SCRIPTSCRIPT
  }, {
    type: "small",
    style: Style$1.SCRIPT
  }, {
    type: "small",
    style: Style$1.TEXT
  }, {
    type: "large",
    size: 1
  }, {
    type: "large",
    size: 2
  }, {
    type: "large",
    size: 3
  }, {
    type: "large",
    size: 4
  }, {
    type: "stack"
  }];
  var delimTypeToFont = function delimTypeToFont2(type) {
    if (type.type === "small") {
      return "Main-Regular";
    } else if (type.type === "large") {
      return "Size" + type.size + "-Regular";
    } else if (type.type === "stack") {
      return "Size4-Regular";
    } else {
      throw new Error("Add support for delim type '" + type.type + "' here.");
    }
  };
  var traverseSequence = function traverseSequence2(delim, height, sequence, options) {
    var start = Math.min(2, 3 - options.style.size);
    for (var i = start; i < sequence.length; i++) {
      if (sequence[i].type === "stack") {
        break;
      }
      var metrics = getMetrics(delim, delimTypeToFont(sequence[i]), "math");
      var heightDepth = metrics.height + metrics.depth;
      if (sequence[i].type === "small") {
        var newOptions = options.havingBaseStyle(sequence[i].style);
        heightDepth *= newOptions.sizeMultiplier;
      }
      if (heightDepth > height) {
        return sequence[i];
      }
    }
    return sequence[sequence.length - 1];
  };
  var makeCustomSizedDelim = function makeCustomSizedDelim2(delim, height, center, options, mode, classes) {
    if (delim === "<" || delim === "\\lt" || delim === "\u27E8") {
      delim = "\\langle";
    } else if (delim === ">" || delim === "\\gt" || delim === "\u27E9") {
      delim = "\\rangle";
    }
    var sequence;
    if (stackNeverDelimiters.includes(delim)) {
      sequence = stackNeverDelimiterSequence;
    } else if (stackLargeDelimiters.includes(delim)) {
      sequence = stackLargeDelimiterSequence;
    } else {
      sequence = stackAlwaysDelimiterSequence;
    }
    var delimType = traverseSequence(delim, height, sequence, options);
    if (delimType.type === "small") {
      return makeSmallDelim(delim, delimType.style, center, options, mode, classes);
    } else if (delimType.type === "large") {
      return makeLargeDelim(delim, delimType.size, center, options, mode, classes);
    } else {
      return makeStackedDelim(delim, height, center, options, mode, classes);
    }
  };
  var makeLeftRightDelim = function makeLeftRightDelim2(delim, height, depth, options, mode, classes) {
    var axisHeight = options.fontMetrics().axisHeight * options.sizeMultiplier;
    var delimiterFactor = 901;
    var delimiterExtend = 5 / options.fontMetrics().ptPerEm;
    var maxDistFromAxis = Math.max(height - axisHeight, depth + axisHeight);
    var totalHeight = Math.max(
      // In real TeX, calculations are done using integral values which are
      // 65536 per pt, or 655360 per em. So, the division here truncates in
      // TeX but doesn't here, producing different results. If we wanted to
      // exactly match TeX's calculation, we could do
      //   Math.floor(655360 * maxDistFromAxis / 500) *
      //    delimiterFactor / 655360
      // (To see the difference, compare
      //    x^{x^{\left(\rule{0.1em}{0.68em}\right)}}
      // in TeX and KaTeX)
      maxDistFromAxis / 500 * delimiterFactor,
      2 * maxDistFromAxis - delimiterExtend
    );
    return makeCustomSizedDelim(delim, totalHeight, true, options, mode, classes);
  };
  var delimiter = {
    sqrtImage: makeSqrtImage,
    sizedDelim: makeSizedDelim,
    sizeToMaxHeight,
    customSizedDelim: makeCustomSizedDelim,
    leftRightDelim: makeLeftRightDelim
  };
  var delimiterSizes = {
    "\\bigl": {
      mclass: "mopen",
      size: 1
    },
    "\\Bigl": {
      mclass: "mopen",
      size: 2
    },
    "\\biggl": {
      mclass: "mopen",
      size: 3
    },
    "\\Biggl": {
      mclass: "mopen",
      size: 4
    },
    "\\bigr": {
      mclass: "mclose",
      size: 1
    },
    "\\Bigr": {
      mclass: "mclose",
      size: 2
    },
    "\\biggr": {
      mclass: "mclose",
      size: 3
    },
    "\\Biggr": {
      mclass: "mclose",
      size: 4
    },
    "\\bigm": {
      mclass: "mrel",
      size: 1
    },
    "\\Bigm": {
      mclass: "mrel",
      size: 2
    },
    "\\biggm": {
      mclass: "mrel",
      size: 3
    },
    "\\Biggm": {
      mclass: "mrel",
      size: 4
    },
    "\\big": {
      mclass: "mord",
      size: 1
    },
    "\\Big": {
      mclass: "mord",
      size: 2
    },
    "\\bigg": {
      mclass: "mord",
      size: 3
    },
    "\\Bigg": {
      mclass: "mord",
      size: 4
    }
  };
  var delimiters = ["(", "\\lparen", ")", "\\rparen", "[", "\\lbrack", "]", "\\rbrack", "\\{", "\\lbrace", "\\}", "\\rbrace", "\\lfloor", "\\rfloor", "\u230A", "\u230B", "\\lceil", "\\rceil", "\u2308", "\u2309", "<", ">", "\\langle", "\u27E8", "\\rangle", "\u27E9", "\\lt", "\\gt", "\\lvert", "\\rvert", "\\lVert", "\\rVert", "\\lgroup", "\\rgroup", "\u27EE", "\u27EF", "\\lmoustache", "\\rmoustache", "\u23B0", "\u23B1", "/", "\\backslash", "|", "\\vert", "\\|", "\\Vert", "\\uparrow", "\\Uparrow", "\\downarrow", "\\Downarrow", "\\updownarrow", "\\Updownarrow", "."];
  function checkDelimiter(delim, context) {
    var symDelim = checkSymbolNodeType(delim);
    if (symDelim && delimiters.includes(symDelim.text)) {
      return symDelim;
    } else if (symDelim) {
      throw new ParseError("Invalid delimiter '" + symDelim.text + "' after '" + context.funcName + "'", delim);
    } else {
      throw new ParseError("Invalid delimiter type '" + delim.type + "'", delim);
    }
  }
  defineFunction({
    type: "delimsizing",
    names: ["\\bigl", "\\Bigl", "\\biggl", "\\Biggl", "\\bigr", "\\Bigr", "\\biggr", "\\Biggr", "\\bigm", "\\Bigm", "\\biggm", "\\Biggm", "\\big", "\\Big", "\\bigg", "\\Bigg"],
    props: {
      numArgs: 1,
      argTypes: ["primitive"]
    },
    handler: (context, args) => {
      var delim = checkDelimiter(args[0], context);
      return {
        type: "delimsizing",
        mode: context.parser.mode,
        size: delimiterSizes[context.funcName].size,
        mclass: delimiterSizes[context.funcName].mclass,
        delim: delim.text
      };
    },
    htmlBuilder: (group, options) => {
      if (group.delim === ".") {
        return buildCommon.makeSpan([group.mclass]);
      }
      return delimiter.sizedDelim(group.delim, group.size, options, group.mode, [group.mclass]);
    },
    mathmlBuilder: (group) => {
      var children = [];
      if (group.delim !== ".") {
        children.push(makeText(group.delim, group.mode));
      }
      var node = new mathMLTree.MathNode("mo", children);
      if (group.mclass === "mopen" || group.mclass === "mclose") {
        node.setAttribute("fence", "true");
      } else {
        node.setAttribute("fence", "false");
      }
      node.setAttribute("stretchy", "true");
      var size = makeEm(delimiter.sizeToMaxHeight[group.size]);
      node.setAttribute("minsize", size);
      node.setAttribute("maxsize", size);
      return node;
    }
  });
  function assertParsed(group) {
    if (!group.body) {
      throw new Error("Bug: The leftright ParseNode wasn't fully parsed.");
    }
  }
  defineFunction({
    type: "leftright-right",
    names: ["\\right"],
    props: {
      numArgs: 1,
      primitive: true
    },
    handler: (context, args) => {
      var color = context.parser.gullet.macros.get("\\current@color");
      if (color && typeof color !== "string") {
        throw new ParseError("\\current@color set to non-string in \\right");
      }
      return {
        type: "leftright-right",
        mode: context.parser.mode,
        delim: checkDelimiter(args[0], context).text,
        color
        // undefined if not set via \color
      };
    }
  });
  defineFunction({
    type: "leftright",
    names: ["\\left"],
    props: {
      numArgs: 1,
      primitive: true
    },
    handler: (context, args) => {
      var delim = checkDelimiter(args[0], context);
      var parser = context.parser;
      ++parser.leftrightDepth;
      var body = parser.parseExpression(false);
      --parser.leftrightDepth;
      parser.expect("\\right", false);
      var right = assertNodeType(parser.parseFunction(), "leftright-right");
      return {
        type: "leftright",
        mode: parser.mode,
        body,
        left: delim.text,
        right: right.delim,
        rightColor: right.color
      };
    },
    htmlBuilder: (group, options) => {
      assertParsed(group);
      var inner2 = buildExpression$1(group.body, options, true, ["mopen", "mclose"]);
      var innerHeight = 0;
      var innerDepth = 0;
      var hadMiddle = false;
      for (var i = 0; i < inner2.length; i++) {
        if (inner2[i].isMiddle) {
          hadMiddle = true;
        } else {
          innerHeight = Math.max(inner2[i].height, innerHeight);
          innerDepth = Math.max(inner2[i].depth, innerDepth);
        }
      }
      innerHeight *= options.sizeMultiplier;
      innerDepth *= options.sizeMultiplier;
      var leftDelim;
      if (group.left === ".") {
        leftDelim = makeNullDelimiter(options, ["mopen"]);
      } else {
        leftDelim = delimiter.leftRightDelim(group.left, innerHeight, innerDepth, options, group.mode, ["mopen"]);
      }
      inner2.unshift(leftDelim);
      if (hadMiddle) {
        for (var _i = 1; _i < inner2.length; _i++) {
          var middleDelim = inner2[_i];
          var isMiddle = middleDelim.isMiddle;
          if (isMiddle) {
            inner2[_i] = delimiter.leftRightDelim(isMiddle.delim, innerHeight, innerDepth, isMiddle.options, group.mode, []);
          }
        }
      }
      var rightDelim;
      if (group.right === ".") {
        rightDelim = makeNullDelimiter(options, ["mclose"]);
      } else {
        var colorOptions = group.rightColor ? options.withColor(group.rightColor) : options;
        rightDelim = delimiter.leftRightDelim(group.right, innerHeight, innerDepth, colorOptions, group.mode, ["mclose"]);
      }
      inner2.push(rightDelim);
      return buildCommon.makeSpan(["minner"], inner2, options);
    },
    mathmlBuilder: (group, options) => {
      assertParsed(group);
      var inner2 = buildExpression2(group.body, options);
      if (group.left !== ".") {
        var leftNode = new mathMLTree.MathNode("mo", [makeText(group.left, group.mode)]);
        leftNode.setAttribute("fence", "true");
        inner2.unshift(leftNode);
      }
      if (group.right !== ".") {
        var rightNode = new mathMLTree.MathNode("mo", [makeText(group.right, group.mode)]);
        rightNode.setAttribute("fence", "true");
        if (group.rightColor) {
          rightNode.setAttribute("mathcolor", group.rightColor);
        }
        inner2.push(rightNode);
      }
      return makeRow(inner2);
    }
  });
  defineFunction({
    type: "middle",
    names: ["\\middle"],
    props: {
      numArgs: 1,
      primitive: true
    },
    handler: (context, args) => {
      var delim = checkDelimiter(args[0], context);
      if (!context.parser.leftrightDepth) {
        throw new ParseError("\\middle without preceding \\left", delim);
      }
      return {
        type: "middle",
        mode: context.parser.mode,
        delim: delim.text
      };
    },
    htmlBuilder: (group, options) => {
      var middleDelim;
      if (group.delim === ".") {
        middleDelim = makeNullDelimiter(options, []);
      } else {
        middleDelim = delimiter.sizedDelim(group.delim, 1, options, group.mode, []);
        var isMiddle = {
          delim: group.delim,
          options
        };
        middleDelim.isMiddle = isMiddle;
      }
      return middleDelim;
    },
    mathmlBuilder: (group, options) => {
      var textNode = group.delim === "\\vert" || group.delim === "|" ? makeText("|", "text") : makeText(group.delim, group.mode);
      var middleNode = new mathMLTree.MathNode("mo", [textNode]);
      middleNode.setAttribute("fence", "true");
      middleNode.setAttribute("lspace", "0.05em");
      middleNode.setAttribute("rspace", "0.05em");
      return middleNode;
    }
  });
  var htmlBuilder$7 = (group, options) => {
    var inner2 = buildCommon.wrapFragment(buildGroup$1(group.body, options), options);
    var label = group.label.slice(1);
    var scale = options.sizeMultiplier;
    var img;
    var imgShift = 0;
    var isSingleChar = utils.isCharacterBox(group.body);
    if (label === "sout") {
      img = buildCommon.makeSpan(["stretchy", "sout"]);
      img.height = options.fontMetrics().defaultRuleThickness / scale;
      imgShift = -0.5 * options.fontMetrics().xHeight;
    } else if (label === "phase") {
      var lineWeight = calculateSize({
        number: 0.6,
        unit: "pt"
      }, options);
      var clearance = calculateSize({
        number: 0.35,
        unit: "ex"
      }, options);
      var newOptions = options.havingBaseSizing();
      scale = scale / newOptions.sizeMultiplier;
      var angleHeight = inner2.height + inner2.depth + lineWeight + clearance;
      inner2.style.paddingLeft = makeEm(angleHeight / 2 + lineWeight);
      var viewBoxHeight = Math.floor(1e3 * angleHeight * scale);
      var path2 = phasePath(viewBoxHeight);
      var svgNode = new SvgNode([new PathNode("phase", path2)], {
        "width": "400em",
        "height": makeEm(viewBoxHeight / 1e3),
        "viewBox": "0 0 400000 " + viewBoxHeight,
        "preserveAspectRatio": "xMinYMin slice"
      });
      img = buildCommon.makeSvgSpan(["hide-tail"], [svgNode], options);
      img.style.height = makeEm(angleHeight);
      imgShift = inner2.depth + lineWeight + clearance;
    } else {
      if (/cancel/.test(label)) {
        if (!isSingleChar) {
          inner2.classes.push("cancel-pad");
        }
      } else if (label === "angl") {
        inner2.classes.push("anglpad");
      } else {
        inner2.classes.push("boxpad");
      }
      var topPad = 0;
      var bottomPad = 0;
      var ruleThickness = 0;
      if (/box/.test(label)) {
        ruleThickness = Math.max(
          options.fontMetrics().fboxrule,
          // default
          options.minRuleThickness
          // User override.
        );
        topPad = options.fontMetrics().fboxsep + (label === "colorbox" ? 0 : ruleThickness);
        bottomPad = topPad;
      } else if (label === "angl") {
        ruleThickness = Math.max(options.fontMetrics().defaultRuleThickness, options.minRuleThickness);
        topPad = 4 * ruleThickness;
        bottomPad = Math.max(0, 0.25 - inner2.depth);
      } else {
        topPad = isSingleChar ? 0.2 : 0;
        bottomPad = topPad;
      }
      img = stretchy.encloseSpan(inner2, label, topPad, bottomPad, options);
      if (/fbox|boxed|fcolorbox/.test(label)) {
        img.style.borderStyle = "solid";
        img.style.borderWidth = makeEm(ruleThickness);
      } else if (label === "angl" && ruleThickness !== 0.049) {
        img.style.borderTopWidth = makeEm(ruleThickness);
        img.style.borderRightWidth = makeEm(ruleThickness);
      }
      imgShift = inner2.depth + bottomPad;
      if (group.backgroundColor) {
        img.style.backgroundColor = group.backgroundColor;
        if (group.borderColor) {
          img.style.borderColor = group.borderColor;
        }
      }
    }
    var vlist;
    if (group.backgroundColor) {
      vlist = buildCommon.makeVList({
        positionType: "individualShift",
        children: [
          // Put the color background behind inner;
          {
            type: "elem",
            elem: img,
            shift: imgShift
          },
          {
            type: "elem",
            elem: inner2,
            shift: 0
          }
        ]
      }, options);
    } else {
      var classes = /cancel|phase/.test(label) ? ["svg-align"] : [];
      vlist = buildCommon.makeVList({
        positionType: "individualShift",
        children: [
          // Write the \cancel stroke on top of inner.
          {
            type: "elem",
            elem: inner2,
            shift: 0
          },
          {
            type: "elem",
            elem: img,
            shift: imgShift,
            wrapperClasses: classes
          }
        ]
      }, options);
    }
    if (/cancel/.test(label)) {
      vlist.height = inner2.height;
      vlist.depth = inner2.depth;
    }
    if (/cancel/.test(label) && !isSingleChar) {
      return buildCommon.makeSpan(["mord", "cancel-lap"], [vlist], options);
    } else {
      return buildCommon.makeSpan(["mord"], [vlist], options);
    }
  };
  var mathmlBuilder$6 = (group, options) => {
    var fboxsep = 0;
    var node = new mathMLTree.MathNode(group.label.indexOf("colorbox") > -1 ? "mpadded" : "menclose", [buildGroup2(group.body, options)]);
    switch (group.label) {
      case "\\cancel":
        node.setAttribute("notation", "updiagonalstrike");
        break;
      case "\\bcancel":
        node.setAttribute("notation", "downdiagonalstrike");
        break;
      case "\\phase":
        node.setAttribute("notation", "phasorangle");
        break;
      case "\\sout":
        node.setAttribute("notation", "horizontalstrike");
        break;
      case "\\fbox":
        node.setAttribute("notation", "box");
        break;
      case "\\angl":
        node.setAttribute("notation", "actuarial");
        break;
      case "\\fcolorbox":
      case "\\colorbox":
        fboxsep = options.fontMetrics().fboxsep * options.fontMetrics().ptPerEm;
        node.setAttribute("width", "+" + 2 * fboxsep + "pt");
        node.setAttribute("height", "+" + 2 * fboxsep + "pt");
        node.setAttribute("lspace", fboxsep + "pt");
        node.setAttribute("voffset", fboxsep + "pt");
        if (group.label === "\\fcolorbox") {
          var thk = Math.max(
            options.fontMetrics().fboxrule,
            // default
            options.minRuleThickness
            // user override
          );
          node.setAttribute("style", "border: " + thk + "em solid " + String(group.borderColor));
        }
        break;
      case "\\xcancel":
        node.setAttribute("notation", "updiagonalstrike downdiagonalstrike");
        break;
    }
    if (group.backgroundColor) {
      node.setAttribute("mathbackground", group.backgroundColor);
    }
    return node;
  };
  defineFunction({
    type: "enclose",
    names: ["\\colorbox"],
    props: {
      numArgs: 2,
      allowedInText: true,
      argTypes: ["color", "text"]
    },
    handler(_ref, args, optArgs) {
      var {
        parser,
        funcName
      } = _ref;
      var color = assertNodeType(args[0], "color-token").color;
      var body = args[1];
      return {
        type: "enclose",
        mode: parser.mode,
        label: funcName,
        backgroundColor: color,
        body
      };
    },
    htmlBuilder: htmlBuilder$7,
    mathmlBuilder: mathmlBuilder$6
  });
  defineFunction({
    type: "enclose",
    names: ["\\fcolorbox"],
    props: {
      numArgs: 3,
      allowedInText: true,
      argTypes: ["color", "color", "text"]
    },
    handler(_ref2, args, optArgs) {
      var {
        parser,
        funcName
      } = _ref2;
      var borderColor = assertNodeType(args[0], "color-token").color;
      var backgroundColor = assertNodeType(args[1], "color-token").color;
      var body = args[2];
      return {
        type: "enclose",
        mode: parser.mode,
        label: funcName,
        backgroundColor,
        borderColor,
        body
      };
    },
    htmlBuilder: htmlBuilder$7,
    mathmlBuilder: mathmlBuilder$6
  });
  defineFunction({
    type: "enclose",
    names: ["\\fbox"],
    props: {
      numArgs: 1,
      argTypes: ["hbox"],
      allowedInText: true
    },
    handler(_ref3, args) {
      var {
        parser
      } = _ref3;
      return {
        type: "enclose",
        mode: parser.mode,
        label: "\\fbox",
        body: args[0]
      };
    }
  });
  defineFunction({
    type: "enclose",
    names: ["\\cancel", "\\bcancel", "\\xcancel", "\\sout", "\\phase"],
    props: {
      numArgs: 1
    },
    handler(_ref4, args) {
      var {
        parser,
        funcName
      } = _ref4;
      var body = args[0];
      return {
        type: "enclose",
        mode: parser.mode,
        label: funcName,
        body
      };
    },
    htmlBuilder: htmlBuilder$7,
    mathmlBuilder: mathmlBuilder$6
  });
  defineFunction({
    type: "enclose",
    names: ["\\angl"],
    props: {
      numArgs: 1,
      argTypes: ["hbox"],
      allowedInText: false
    },
    handler(_ref5, args) {
      var {
        parser
      } = _ref5;
      return {
        type: "enclose",
        mode: parser.mode,
        label: "\\angl",
        body: args[0]
      };
    }
  });
  var _environments = {};
  function defineEnvironment(_ref) {
    var {
      type,
      names,
      props,
      handler,
      htmlBuilder: htmlBuilder3,
      mathmlBuilder: mathmlBuilder3
    } = _ref;
    var data2 = {
      type,
      numArgs: props.numArgs || 0,
      allowedInText: false,
      numOptionalArgs: 0,
      handler
    };
    for (var i = 0; i < names.length; ++i) {
      _environments[names[i]] = data2;
    }
    if (htmlBuilder3) {
      _htmlGroupBuilders[type] = htmlBuilder3;
    }
    if (mathmlBuilder3) {
      _mathmlGroupBuilders[type] = mathmlBuilder3;
    }
  }
  var _macros = {};
  function defineMacro(name, body) {
    _macros[name] = body;
  }
  function getHLines(parser) {
    var hlineInfo = [];
    parser.consumeSpaces();
    var nxt = parser.fetch().text;
    if (nxt === "\\relax") {
      parser.consume();
      parser.consumeSpaces();
      nxt = parser.fetch().text;
    }
    while (nxt === "\\hline" || nxt === "\\hdashline") {
      parser.consume();
      hlineInfo.push(nxt === "\\hdashline");
      parser.consumeSpaces();
      nxt = parser.fetch().text;
    }
    return hlineInfo;
  }
  var validateAmsEnvironmentContext = (context) => {
    var settings = context.parser.settings;
    if (!settings.displayMode) {
      throw new ParseError("{" + context.envName + "} can be used only in display mode.");
    }
  };
  function getAutoTag(name) {
    if (name.indexOf("ed") === -1) {
      return name.indexOf("*") === -1;
    }
  }
  function parseArray(parser, _ref, style) {
    var {
      hskipBeforeAndAfter,
      addJot,
      cols,
      arraystretch,
      colSeparationType,
      autoTag,
      singleRow,
      emptySingleRow,
      maxNumCols,
      leqno
    } = _ref;
    parser.gullet.beginGroup();
    if (!singleRow) {
      parser.gullet.macros.set("\\cr", "\\\\\\relax");
    }
    if (!arraystretch) {
      var stretch = parser.gullet.expandMacroAsText("\\arraystretch");
      if (stretch == null) {
        arraystretch = 1;
      } else {
        arraystretch = parseFloat(stretch);
        if (!arraystretch || arraystretch < 0) {
          throw new ParseError("Invalid \\arraystretch: " + stretch);
        }
      }
    }
    parser.gullet.beginGroup();
    var row = [];
    var body = [row];
    var rowGaps = [];
    var hLinesBeforeRow = [];
    var tags = autoTag != null ? [] : void 0;
    function beginRow() {
      if (autoTag) {
        parser.gullet.macros.set("\\@eqnsw", "1", true);
      }
    }
    function endRow() {
      if (tags) {
        if (parser.gullet.macros.get("\\df@tag")) {
          tags.push(parser.subparse([new Token("\\df@tag")]));
          parser.gullet.macros.set("\\df@tag", void 0, true);
        } else {
          tags.push(Boolean(autoTag) && parser.gullet.macros.get("\\@eqnsw") === "1");
        }
      }
    }
    beginRow();
    hLinesBeforeRow.push(getHLines(parser));
    while (true) {
      var cell = parser.parseExpression(false, singleRow ? "\\end" : "\\\\");
      parser.gullet.endGroup();
      parser.gullet.beginGroup();
      cell = {
        type: "ordgroup",
        mode: parser.mode,
        body: cell
      };
      if (style) {
        cell = {
          type: "styling",
          mode: parser.mode,
          style,
          body: [cell]
        };
      }
      row.push(cell);
      var next = parser.fetch().text;
      if (next === "&") {
        if (maxNumCols && row.length === maxNumCols) {
          if (singleRow || colSeparationType) {
            throw new ParseError("Too many tab characters: &", parser.nextToken);
          } else {
            parser.settings.reportNonstrict("textEnv", "Too few columns specified in the {array} column argument.");
          }
        }
        parser.consume();
      } else if (next === "\\end") {
        endRow();
        if (row.length === 1 && cell.type === "styling" && cell.body[0].body.length === 0 && (body.length > 1 || !emptySingleRow)) {
          body.pop();
        }
        if (hLinesBeforeRow.length < body.length + 1) {
          hLinesBeforeRow.push([]);
        }
        break;
      } else if (next === "\\\\") {
        parser.consume();
        var size = void 0;
        if (parser.gullet.future().text !== " ") {
          size = parser.parseSizeGroup(true);
        }
        rowGaps.push(size ? size.value : null);
        endRow();
        hLinesBeforeRow.push(getHLines(parser));
        row = [];
        body.push(row);
        beginRow();
      } else {
        throw new ParseError("Expected & or \\\\ or \\cr or \\end", parser.nextToken);
      }
    }
    parser.gullet.endGroup();
    parser.gullet.endGroup();
    return {
      type: "array",
      mode: parser.mode,
      addJot,
      arraystretch,
      body,
      cols,
      rowGaps,
      hskipBeforeAndAfter,
      hLinesBeforeRow,
      colSeparationType,
      tags,
      leqno
    };
  }
  function dCellStyle(envName) {
    if (envName.slice(0, 1) === "d") {
      return "display";
    } else {
      return "text";
    }
  }
  var htmlBuilder$6 = function htmlBuilder(group, options) {
    var r;
    var c;
    var nr = group.body.length;
    var hLinesBeforeRow = group.hLinesBeforeRow;
    var nc = 0;
    var body = new Array(nr);
    var hlines = [];
    var ruleThickness = Math.max(
      // From LaTeX \showthe\arrayrulewidth. Equals 0.04 em.
      options.fontMetrics().arrayRuleWidth,
      options.minRuleThickness
      // User override.
    );
    var pt = 1 / options.fontMetrics().ptPerEm;
    var arraycolsep = 5 * pt;
    if (group.colSeparationType && group.colSeparationType === "small") {
      var localMultiplier = options.havingStyle(Style$1.SCRIPT).sizeMultiplier;
      arraycolsep = 0.2778 * (localMultiplier / options.sizeMultiplier);
    }
    var baselineskip = group.colSeparationType === "CD" ? calculateSize({
      number: 3,
      unit: "ex"
    }, options) : 12 * pt;
    var jot = 3 * pt;
    var arrayskip = group.arraystretch * baselineskip;
    var arstrutHeight = 0.7 * arrayskip;
    var arstrutDepth = 0.3 * arrayskip;
    var totalHeight = 0;
    function setHLinePos(hlinesInGap) {
      for (var i = 0; i < hlinesInGap.length; ++i) {
        if (i > 0) {
          totalHeight += 0.25;
        }
        hlines.push({
          pos: totalHeight,
          isDashed: hlinesInGap[i]
        });
      }
    }
    setHLinePos(hLinesBeforeRow[0]);
    for (r = 0; r < group.body.length; ++r) {
      var inrow = group.body[r];
      var height = arstrutHeight;
      var depth = arstrutDepth;
      if (nc < inrow.length) {
        nc = inrow.length;
      }
      var outrow = new Array(inrow.length);
      for (c = 0; c < inrow.length; ++c) {
        var elt = buildGroup$1(inrow[c], options);
        if (depth < elt.depth) {
          depth = elt.depth;
        }
        if (height < elt.height) {
          height = elt.height;
        }
        outrow[c] = elt;
      }
      var rowGap = group.rowGaps[r];
      var gap = 0;
      if (rowGap) {
        gap = calculateSize(rowGap, options);
        if (gap > 0) {
          gap += arstrutDepth;
          if (depth < gap) {
            depth = gap;
          }
          gap = 0;
        }
      }
      if (group.addJot) {
        depth += jot;
      }
      outrow.height = height;
      outrow.depth = depth;
      totalHeight += height;
      outrow.pos = totalHeight;
      totalHeight += depth + gap;
      body[r] = outrow;
      setHLinePos(hLinesBeforeRow[r + 1]);
    }
    var offset = totalHeight / 2 + options.fontMetrics().axisHeight;
    var colDescriptions = group.cols || [];
    var cols = [];
    var colSep;
    var colDescrNum;
    var tagSpans = [];
    if (group.tags && group.tags.some((tag2) => tag2)) {
      for (r = 0; r < nr; ++r) {
        var rw = body[r];
        var shift = rw.pos - offset;
        var tag = group.tags[r];
        var tagSpan = void 0;
        if (tag === true) {
          tagSpan = buildCommon.makeSpan(["eqn-num"], [], options);
        } else if (tag === false) {
          tagSpan = buildCommon.makeSpan([], [], options);
        } else {
          tagSpan = buildCommon.makeSpan([], buildExpression$1(tag, options, true), options);
        }
        tagSpan.depth = rw.depth;
        tagSpan.height = rw.height;
        tagSpans.push({
          type: "elem",
          elem: tagSpan,
          shift
        });
      }
    }
    for (
      c = 0, colDescrNum = 0;
      // Continue while either there are more columns or more column
      // descriptions, so trailing separators don't get lost.
      c < nc || colDescrNum < colDescriptions.length;
      ++c, ++colDescrNum
    ) {
      var colDescr = colDescriptions[colDescrNum] || {};
      var firstSeparator = true;
      while (colDescr.type === "separator") {
        if (!firstSeparator) {
          colSep = buildCommon.makeSpan(["arraycolsep"], []);
          colSep.style.width = makeEm(options.fontMetrics().doubleRuleSep);
          cols.push(colSep);
        }
        if (colDescr.separator === "|" || colDescr.separator === ":") {
          var lineType = colDescr.separator === "|" ? "solid" : "dashed";
          var separator = buildCommon.makeSpan(["vertical-separator"], [], options);
          separator.style.height = makeEm(totalHeight);
          separator.style.borderRightWidth = makeEm(ruleThickness);
          separator.style.borderRightStyle = lineType;
          separator.style.margin = "0 " + makeEm(-ruleThickness / 2);
          var _shift = totalHeight - offset;
          if (_shift) {
            separator.style.verticalAlign = makeEm(-_shift);
          }
          cols.push(separator);
        } else {
          throw new ParseError("Invalid separator type: " + colDescr.separator);
        }
        colDescrNum++;
        colDescr = colDescriptions[colDescrNum] || {};
        firstSeparator = false;
      }
      if (c >= nc) {
        continue;
      }
      var sepwidth = void 0;
      if (c > 0 || group.hskipBeforeAndAfter) {
        sepwidth = utils.deflt(colDescr.pregap, arraycolsep);
        if (sepwidth !== 0) {
          colSep = buildCommon.makeSpan(["arraycolsep"], []);
          colSep.style.width = makeEm(sepwidth);
          cols.push(colSep);
        }
      }
      var col = [];
      for (r = 0; r < nr; ++r) {
        var row = body[r];
        var elem = row[c];
        if (!elem) {
          continue;
        }
        var _shift2 = row.pos - offset;
        elem.depth = row.depth;
        elem.height = row.height;
        col.push({
          type: "elem",
          elem,
          shift: _shift2
        });
      }
      col = buildCommon.makeVList({
        positionType: "individualShift",
        children: col
      }, options);
      col = buildCommon.makeSpan(["col-align-" + (colDescr.align || "c")], [col]);
      cols.push(col);
      if (c < nc - 1 || group.hskipBeforeAndAfter) {
        sepwidth = utils.deflt(colDescr.postgap, arraycolsep);
        if (sepwidth !== 0) {
          colSep = buildCommon.makeSpan(["arraycolsep"], []);
          colSep.style.width = makeEm(sepwidth);
          cols.push(colSep);
        }
      }
    }
    body = buildCommon.makeSpan(["mtable"], cols);
    if (hlines.length > 0) {
      var line = buildCommon.makeLineSpan("hline", options, ruleThickness);
      var dashes = buildCommon.makeLineSpan("hdashline", options, ruleThickness);
      var vListElems = [{
        type: "elem",
        elem: body,
        shift: 0
      }];
      while (hlines.length > 0) {
        var hline = hlines.pop();
        var lineShift = hline.pos - offset;
        if (hline.isDashed) {
          vListElems.push({
            type: "elem",
            elem: dashes,
            shift: lineShift
          });
        } else {
          vListElems.push({
            type: "elem",
            elem: line,
            shift: lineShift
          });
        }
      }
      body = buildCommon.makeVList({
        positionType: "individualShift",
        children: vListElems
      }, options);
    }
    if (tagSpans.length === 0) {
      return buildCommon.makeSpan(["mord"], [body], options);
    } else {
      var eqnNumCol = buildCommon.makeVList({
        positionType: "individualShift",
        children: tagSpans
      }, options);
      eqnNumCol = buildCommon.makeSpan(["tag"], [eqnNumCol], options);
      return buildCommon.makeFragment([body, eqnNumCol]);
    }
  };
  var alignMap = {
    c: "center ",
    l: "left ",
    r: "right "
  };
  var mathmlBuilder$5 = function mathmlBuilder(group, options) {
    var tbl = [];
    var glue = new mathMLTree.MathNode("mtd", [], ["mtr-glue"]);
    var tag = new mathMLTree.MathNode("mtd", [], ["mml-eqn-num"]);
    for (var i = 0; i < group.body.length; i++) {
      var rw = group.body[i];
      var row = [];
      for (var j = 0; j < rw.length; j++) {
        row.push(new mathMLTree.MathNode("mtd", [buildGroup2(rw[j], options)]));
      }
      if (group.tags && group.tags[i]) {
        row.unshift(glue);
        row.push(glue);
        if (group.leqno) {
          row.unshift(tag);
        } else {
          row.push(tag);
        }
      }
      tbl.push(new mathMLTree.MathNode("mtr", row));
    }
    var table = new mathMLTree.MathNode("mtable", tbl);
    var gap = group.arraystretch === 0.5 ? 0.1 : 0.16 + group.arraystretch - 1 + (group.addJot ? 0.09 : 0);
    table.setAttribute("rowspacing", makeEm(gap));
    var menclose = "";
    var align = "";
    if (group.cols && group.cols.length > 0) {
      var cols = group.cols;
      var columnLines = "";
      var prevTypeWasAlign = false;
      var iStart = 0;
      var iEnd = cols.length;
      if (cols[0].type === "separator") {
        menclose += "top ";
        iStart = 1;
      }
      if (cols[cols.length - 1].type === "separator") {
        menclose += "bottom ";
        iEnd -= 1;
      }
      for (var _i = iStart; _i < iEnd; _i++) {
        if (cols[_i].type === "align") {
          align += alignMap[cols[_i].align];
          if (prevTypeWasAlign) {
            columnLines += "none ";
          }
          prevTypeWasAlign = true;
        } else if (cols[_i].type === "separator") {
          if (prevTypeWasAlign) {
            columnLines += cols[_i].separator === "|" ? "solid " : "dashed ";
            prevTypeWasAlign = false;
          }
        }
      }
      table.setAttribute("columnalign", align.trim());
      if (/[sd]/.test(columnLines)) {
        table.setAttribute("columnlines", columnLines.trim());
      }
    }
    if (group.colSeparationType === "align") {
      var _cols = group.cols || [];
      var spacing2 = "";
      for (var _i2 = 1; _i2 < _cols.length; _i2++) {
        spacing2 += _i2 % 2 ? "0em " : "1em ";
      }
      table.setAttribute("columnspacing", spacing2.trim());
    } else if (group.colSeparationType === "alignat" || group.colSeparationType === "gather") {
      table.setAttribute("columnspacing", "0em");
    } else if (group.colSeparationType === "small") {
      table.setAttribute("columnspacing", "0.2778em");
    } else if (group.colSeparationType === "CD") {
      table.setAttribute("columnspacing", "0.5em");
    } else {
      table.setAttribute("columnspacing", "1em");
    }
    var rowLines = "";
    var hlines = group.hLinesBeforeRow;
    menclose += hlines[0].length > 0 ? "left " : "";
    menclose += hlines[hlines.length - 1].length > 0 ? "right " : "";
    for (var _i3 = 1; _i3 < hlines.length - 1; _i3++) {
      rowLines += hlines[_i3].length === 0 ? "none " : hlines[_i3][0] ? "dashed " : "solid ";
    }
    if (/[sd]/.test(rowLines)) {
      table.setAttribute("rowlines", rowLines.trim());
    }
    if (menclose !== "") {
      table = new mathMLTree.MathNode("menclose", [table]);
      table.setAttribute("notation", menclose.trim());
    }
    if (group.arraystretch && group.arraystretch < 1) {
      table = new mathMLTree.MathNode("mstyle", [table]);
      table.setAttribute("scriptlevel", "1");
    }
    return table;
  };
  var alignedHandler = function alignedHandler2(context, args) {
    if (context.envName.indexOf("ed") === -1) {
      validateAmsEnvironmentContext(context);
    }
    var cols = [];
    var separationType = context.envName.indexOf("at") > -1 ? "alignat" : "align";
    var isSplit = context.envName === "split";
    var res = parseArray(context.parser, {
      cols,
      addJot: true,
      autoTag: isSplit ? void 0 : getAutoTag(context.envName),
      emptySingleRow: true,
      colSeparationType: separationType,
      maxNumCols: isSplit ? 2 : void 0,
      leqno: context.parser.settings.leqno
    }, "display");
    var numMaths;
    var numCols = 0;
    var emptyGroup = {
      type: "ordgroup",
      mode: context.mode,
      body: []
    };
    if (args[0] && args[0].type === "ordgroup") {
      var arg0 = "";
      for (var i = 0; i < args[0].body.length; i++) {
        var textord2 = assertNodeType(args[0].body[i], "textord");
        arg0 += textord2.text;
      }
      numMaths = Number(arg0);
      numCols = numMaths * 2;
    }
    var isAligned = !numCols;
    res.body.forEach(function(row) {
      for (var _i4 = 1; _i4 < row.length; _i4 += 2) {
        var styling = assertNodeType(row[_i4], "styling");
        var ordgroup = assertNodeType(styling.body[0], "ordgroup");
        ordgroup.body.unshift(emptyGroup);
      }
      if (!isAligned) {
        var curMaths = row.length / 2;
        if (numMaths < curMaths) {
          throw new ParseError("Too many math in a row: " + ("expected " + numMaths + ", but got " + curMaths), row[0]);
        }
      } else if (numCols < row.length) {
        numCols = row.length;
      }
    });
    for (var _i5 = 0; _i5 < numCols; ++_i5) {
      var align = "r";
      var pregap = 0;
      if (_i5 % 2 === 1) {
        align = "l";
      } else if (_i5 > 0 && isAligned) {
        pregap = 1;
      }
      cols[_i5] = {
        type: "align",
        align,
        pregap,
        postgap: 0
      };
    }
    res.colSeparationType = isAligned ? "align" : "alignat";
    return res;
  };
  defineEnvironment({
    type: "array",
    names: ["array", "darray"],
    props: {
      numArgs: 1
    },
    handler(context, args) {
      var symNode = checkSymbolNodeType(args[0]);
      var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
      var cols = colalign.map(function(nde) {
        var node = assertSymbolNodeType(nde);
        var ca = node.text;
        if ("lcr".indexOf(ca) !== -1) {
          return {
            type: "align",
            align: ca
          };
        } else if (ca === "|") {
          return {
            type: "separator",
            separator: "|"
          };
        } else if (ca === ":") {
          return {
            type: "separator",
            separator: ":"
          };
        }
        throw new ParseError("Unknown column alignment: " + ca, nde);
      });
      var res = {
        cols,
        hskipBeforeAndAfter: true,
        // \@preamble in lttab.dtx
        maxNumCols: cols.length
      };
      return parseArray(context.parser, res, dCellStyle(context.envName));
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix*", "pmatrix*", "bmatrix*", "Bmatrix*", "vmatrix*", "Vmatrix*"],
    props: {
      numArgs: 0
    },
    handler(context) {
      var delimiters2 = {
        "matrix": null,
        "pmatrix": ["(", ")"],
        "bmatrix": ["[", "]"],
        "Bmatrix": ["\\{", "\\}"],
        "vmatrix": ["|", "|"],
        "Vmatrix": ["\\Vert", "\\Vert"]
      }[context.envName.replace("*", "")];
      var colAlign = "c";
      var payload = {
        hskipBeforeAndAfter: false,
        cols: [{
          type: "align",
          align: colAlign
        }]
      };
      if (context.envName.charAt(context.envName.length - 1) === "*") {
        var parser = context.parser;
        parser.consumeSpaces();
        if (parser.fetch().text === "[") {
          parser.consume();
          parser.consumeSpaces();
          colAlign = parser.fetch().text;
          if ("lcr".indexOf(colAlign) === -1) {
            throw new ParseError("Expected l or c or r", parser.nextToken);
          }
          parser.consume();
          parser.consumeSpaces();
          parser.expect("]");
          parser.consume();
          payload.cols = [{
            type: "align",
            align: colAlign
          }];
        }
      }
      var res = parseArray(context.parser, payload, dCellStyle(context.envName));
      var numCols = Math.max(0, ...res.body.map((row) => row.length));
      res.cols = new Array(numCols).fill({
        type: "align",
        align: colAlign
      });
      return delimiters2 ? {
        type: "leftright",
        mode: context.mode,
        body: [res],
        left: delimiters2[0],
        right: delimiters2[1],
        rightColor: void 0
        // \right uninfluenced by \color in array
      } : res;
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["smallmatrix"],
    props: {
      numArgs: 0
    },
    handler(context) {
      var payload = {
        arraystretch: 0.5
      };
      var res = parseArray(context.parser, payload, "script");
      res.colSeparationType = "small";
      return res;
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["subarray"],
    props: {
      numArgs: 1
    },
    handler(context, args) {
      var symNode = checkSymbolNodeType(args[0]);
      var colalign = symNode ? [args[0]] : assertNodeType(args[0], "ordgroup").body;
      var cols = colalign.map(function(nde) {
        var node = assertSymbolNodeType(nde);
        var ca = node.text;
        if ("lc".indexOf(ca) !== -1) {
          return {
            type: "align",
            align: ca
          };
        }
        throw new ParseError("Unknown column alignment: " + ca, nde);
      });
      if (cols.length > 1) {
        throw new ParseError("{subarray} can contain only one column");
      }
      var res = {
        cols,
        hskipBeforeAndAfter: false,
        arraystretch: 0.5
      };
      res = parseArray(context.parser, res, "script");
      if (res.body.length > 0 && res.body[0].length > 1) {
        throw new ParseError("{subarray} can contain only one column");
      }
      return res;
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["cases", "dcases", "rcases", "drcases"],
    props: {
      numArgs: 0
    },
    handler(context) {
      var payload = {
        arraystretch: 1.2,
        cols: [{
          type: "align",
          align: "l",
          pregap: 0,
          // TODO(kevinb) get the current style.
          // For now we use the metrics for TEXT style which is what we were
          // doing before.  Before attempting to get the current style we
          // should look at TeX's behavior especially for \over and matrices.
          postgap: 1
          /* 1em quad */
        }, {
          type: "align",
          align: "l",
          pregap: 0,
          postgap: 0
        }]
      };
      var res = parseArray(context.parser, payload, dCellStyle(context.envName));
      return {
        type: "leftright",
        mode: context.mode,
        body: [res],
        left: context.envName.indexOf("r") > -1 ? "." : "\\{",
        right: context.envName.indexOf("r") > -1 ? "\\}" : ".",
        rightColor: void 0
      };
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["align", "align*", "aligned", "split"],
    props: {
      numArgs: 0
    },
    handler: alignedHandler,
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["gathered", "gather", "gather*"],
    props: {
      numArgs: 0
    },
    handler(context) {
      if (["gather", "gather*"].includes(context.envName)) {
        validateAmsEnvironmentContext(context);
      }
      var res = {
        cols: [{
          type: "align",
          align: "c"
        }],
        addJot: true,
        colSeparationType: "gather",
        autoTag: getAutoTag(context.envName),
        emptySingleRow: true,
        leqno: context.parser.settings.leqno
      };
      return parseArray(context.parser, res, "display");
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["alignat", "alignat*", "alignedat"],
    props: {
      numArgs: 1
    },
    handler: alignedHandler,
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["equation", "equation*"],
    props: {
      numArgs: 0
    },
    handler(context) {
      validateAmsEnvironmentContext(context);
      var res = {
        autoTag: getAutoTag(context.envName),
        emptySingleRow: true,
        singleRow: true,
        maxNumCols: 1,
        leqno: context.parser.settings.leqno
      };
      return parseArray(context.parser, res, "display");
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineEnvironment({
    type: "array",
    names: ["CD"],
    props: {
      numArgs: 0
    },
    handler(context) {
      validateAmsEnvironmentContext(context);
      return parseCD(context.parser);
    },
    htmlBuilder: htmlBuilder$6,
    mathmlBuilder: mathmlBuilder$5
  });
  defineMacro("\\nonumber", "\\gdef\\@eqnsw{0}");
  defineMacro("\\notag", "\\nonumber");
  defineFunction({
    type: "text",
    // Doesn't matter what this is.
    names: ["\\hline", "\\hdashline"],
    props: {
      numArgs: 0,
      allowedInText: true,
      allowedInMath: true
    },
    handler(context, args) {
      throw new ParseError(context.funcName + " valid only within array environment");
    }
  });
  var environments = _environments;
  defineFunction({
    type: "environment",
    names: ["\\begin", "\\end"],
    props: {
      numArgs: 1,
      argTypes: ["text"]
    },
    handler(_ref, args) {
      var {
        parser,
        funcName
      } = _ref;
      var nameGroup = args[0];
      if (nameGroup.type !== "ordgroup") {
        throw new ParseError("Invalid environment name", nameGroup);
      }
      var envName = "";
      for (var i = 0; i < nameGroup.body.length; ++i) {
        envName += assertNodeType(nameGroup.body[i], "textord").text;
      }
      if (funcName === "\\begin") {
        if (!environments.hasOwnProperty(envName)) {
          throw new ParseError("No such environment: " + envName, nameGroup);
        }
        var env = environments[envName];
        var {
          args: _args,
          optArgs
        } = parser.parseArguments("\\begin{" + envName + "}", env);
        var context = {
          mode: parser.mode,
          envName,
          parser
        };
        var result = env.handler(context, _args, optArgs);
        parser.expect("\\end", false);
        var endNameToken = parser.nextToken;
        var end = assertNodeType(parser.parseFunction(), "environment");
        if (end.name !== envName) {
          throw new ParseError("Mismatch: \\begin{" + envName + "} matched by \\end{" + end.name + "}", endNameToken);
        }
        return result;
      }
      return {
        type: "environment",
        mode: parser.mode,
        name: envName,
        nameGroup
      };
    }
  });
  var htmlBuilder$5 = (group, options) => {
    var font = group.font;
    var newOptions = options.withFont(font);
    return buildGroup$1(group.body, newOptions);
  };
  var mathmlBuilder$4 = (group, options) => {
    var font = group.font;
    var newOptions = options.withFont(font);
    return buildGroup2(group.body, newOptions);
  };
  var fontAliases = {
    "\\Bbb": "\\mathbb",
    "\\bold": "\\mathbf",
    "\\frak": "\\mathfrak",
    "\\bm": "\\boldsymbol"
  };
  defineFunction({
    type: "font",
    names: [
      // styles, except \boldsymbol defined below
      "\\mathrm",
      "\\mathit",
      "\\mathbf",
      "\\mathnormal",
      "\\mathsfit",
      // families
      "\\mathbb",
      "\\mathcal",
      "\\mathfrak",
      "\\mathscr",
      "\\mathsf",
      "\\mathtt",
      // aliases, except \bm defined below
      "\\Bbb",
      "\\bold",
      "\\frak"
    ],
    props: {
      numArgs: 1,
      allowedInArgument: true
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName
      } = _ref;
      var body = normalizeArgument(args[0]);
      var func = funcName;
      if (func in fontAliases) {
        func = fontAliases[func];
      }
      return {
        type: "font",
        mode: parser.mode,
        font: func.slice(1),
        body
      };
    },
    htmlBuilder: htmlBuilder$5,
    mathmlBuilder: mathmlBuilder$4
  });
  defineFunction({
    type: "mclass",
    names: ["\\boldsymbol", "\\bm"],
    props: {
      numArgs: 1
    },
    handler: (_ref2, args) => {
      var {
        parser
      } = _ref2;
      var body = args[0];
      var isCharacterBox3 = utils.isCharacterBox(body);
      return {
        type: "mclass",
        mode: parser.mode,
        mclass: binrelClass(body),
        body: [{
          type: "font",
          mode: parser.mode,
          font: "boldsymbol",
          body
        }],
        isCharacterBox: isCharacterBox3
      };
    }
  });
  defineFunction({
    type: "font",
    names: ["\\rm", "\\sf", "\\tt", "\\bf", "\\it", "\\cal"],
    props: {
      numArgs: 0,
      allowedInText: true
    },
    handler: (_ref3, args) => {
      var {
        parser,
        funcName,
        breakOnTokenText
      } = _ref3;
      var {
        mode
      } = parser;
      var body = parser.parseExpression(true, breakOnTokenText);
      var style = "math" + funcName.slice(1);
      return {
        type: "font",
        mode,
        font: style,
        body: {
          type: "ordgroup",
          mode: parser.mode,
          body
        }
      };
    },
    htmlBuilder: htmlBuilder$5,
    mathmlBuilder: mathmlBuilder$4
  });
  var adjustStyle = (size, originalStyle) => {
    var style = originalStyle;
    if (size === "display") {
      style = style.id >= Style$1.SCRIPT.id ? style.text() : Style$1.DISPLAY;
    } else if (size === "text" && style.size === Style$1.DISPLAY.size) {
      style = Style$1.TEXT;
    } else if (size === "script") {
      style = Style$1.SCRIPT;
    } else if (size === "scriptscript") {
      style = Style$1.SCRIPTSCRIPT;
    }
    return style;
  };
  var htmlBuilder$4 = (group, options) => {
    var style = adjustStyle(group.size, options.style);
    var nstyle = style.fracNum();
    var dstyle = style.fracDen();
    var newOptions;
    newOptions = options.havingStyle(nstyle);
    var numerm = buildGroup$1(group.numer, newOptions, options);
    if (group.continued) {
      var hStrut = 8.5 / options.fontMetrics().ptPerEm;
      var dStrut = 3.5 / options.fontMetrics().ptPerEm;
      numerm.height = numerm.height < hStrut ? hStrut : numerm.height;
      numerm.depth = numerm.depth < dStrut ? dStrut : numerm.depth;
    }
    newOptions = options.havingStyle(dstyle);
    var denomm = buildGroup$1(group.denom, newOptions, options);
    var rule;
    var ruleWidth;
    var ruleSpacing;
    if (group.hasBarLine) {
      if (group.barSize) {
        ruleWidth = calculateSize(group.barSize, options);
        rule = buildCommon.makeLineSpan("frac-line", options, ruleWidth);
      } else {
        rule = buildCommon.makeLineSpan("frac-line", options);
      }
      ruleWidth = rule.height;
      ruleSpacing = rule.height;
    } else {
      rule = null;
      ruleWidth = 0;
      ruleSpacing = options.fontMetrics().defaultRuleThickness;
    }
    var numShift;
    var clearance;
    var denomShift;
    if (style.size === Style$1.DISPLAY.size || group.size === "display") {
      numShift = options.fontMetrics().num1;
      if (ruleWidth > 0) {
        clearance = 3 * ruleSpacing;
      } else {
        clearance = 7 * ruleSpacing;
      }
      denomShift = options.fontMetrics().denom1;
    } else {
      if (ruleWidth > 0) {
        numShift = options.fontMetrics().num2;
        clearance = ruleSpacing;
      } else {
        numShift = options.fontMetrics().num3;
        clearance = 3 * ruleSpacing;
      }
      denomShift = options.fontMetrics().denom2;
    }
    var frac;
    if (!rule) {
      var candidateClearance = numShift - numerm.depth - (denomm.height - denomShift);
      if (candidateClearance < clearance) {
        numShift += 0.5 * (clearance - candidateClearance);
        denomShift += 0.5 * (clearance - candidateClearance);
      }
      frac = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: denomm,
          shift: denomShift
        }, {
          type: "elem",
          elem: numerm,
          shift: -numShift
        }]
      }, options);
    } else {
      var axisHeight = options.fontMetrics().axisHeight;
      if (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth) < clearance) {
        numShift += clearance - (numShift - numerm.depth - (axisHeight + 0.5 * ruleWidth));
      }
      if (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift) < clearance) {
        denomShift += clearance - (axisHeight - 0.5 * ruleWidth - (denomm.height - denomShift));
      }
      var midShift = -(axisHeight - 0.5 * ruleWidth);
      frac = buildCommon.makeVList({
        positionType: "individualShift",
        children: [{
          type: "elem",
          elem: denomm,
          shift: denomShift
        }, {
          type: "elem",
          elem: rule,
          shift: midShift
        }, {
          type: "elem",
          elem: numerm,
          shift: -numShift
        }]
      }, options);
    }
    newOptions = options.havingStyle(style);
    frac.height *= newOptions.sizeMultiplier / options.sizeMultiplier;
    frac.depth *= newOptions.sizeMultiplier / options.sizeMultiplier;
    var delimSize;
    if (style.size === Style$1.DISPLAY.size) {
      delimSize = options.fontMetrics().delim1;
    } else if (style.size === Style$1.SCRIPTSCRIPT.size) {
      delimSize = options.havingStyle(Style$1.SCRIPT).fontMetrics().delim2;
    } else {
      delimSize = options.fontMetrics().delim2;
    }
    var leftDelim;
    var rightDelim;
    if (group.leftDelim == null) {
      leftDelim = makeNullDelimiter(options, ["mopen"]);
    } else {
      leftDelim = delimiter.customSizedDelim(group.leftDelim, delimSize, true, options.havingStyle(style), group.mode, ["mopen"]);
    }
    if (group.continued) {
      rightDelim = buildCommon.makeSpan([]);
    } else if (group.rightDelim == null) {
      rightDelim = makeNullDelimiter(options, ["mclose"]);
    } else {
      rightDelim = delimiter.customSizedDelim(group.rightDelim, delimSize, true, options.havingStyle(style), group.mode, ["mclose"]);
    }
    return buildCommon.makeSpan(["mord"].concat(newOptions.sizingClasses(options)), [leftDelim, buildCommon.makeSpan(["mfrac"], [frac]), rightDelim], options);
  };
  var mathmlBuilder$3 = (group, options) => {
    var node = new mathMLTree.MathNode("mfrac", [buildGroup2(group.numer, options), buildGroup2(group.denom, options)]);
    if (!group.hasBarLine) {
      node.setAttribute("linethickness", "0px");
    } else if (group.barSize) {
      var ruleWidth = calculateSize(group.barSize, options);
      node.setAttribute("linethickness", makeEm(ruleWidth));
    }
    var style = adjustStyle(group.size, options.style);
    if (style.size !== options.style.size) {
      node = new mathMLTree.MathNode("mstyle", [node]);
      var isDisplay = style.size === Style$1.DISPLAY.size ? "true" : "false";
      node.setAttribute("displaystyle", isDisplay);
      node.setAttribute("scriptlevel", "0");
    }
    if (group.leftDelim != null || group.rightDelim != null) {
      var withDelims = [];
      if (group.leftDelim != null) {
        var leftOp = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(group.leftDelim.replace("\\", ""))]);
        leftOp.setAttribute("fence", "true");
        withDelims.push(leftOp);
      }
      withDelims.push(node);
      if (group.rightDelim != null) {
        var rightOp = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode(group.rightDelim.replace("\\", ""))]);
        rightOp.setAttribute("fence", "true");
        withDelims.push(rightOp);
      }
      return makeRow(withDelims);
    }
    return node;
  };
  defineFunction({
    type: "genfrac",
    names: [
      "\\dfrac",
      "\\frac",
      "\\tfrac",
      "\\dbinom",
      "\\binom",
      "\\tbinom",
      "\\\\atopfrac",
      // can’t be entered directly
      "\\\\bracefrac",
      "\\\\brackfrac"
      // ditto
    ],
    props: {
      numArgs: 2,
      allowedInArgument: true
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName
      } = _ref;
      var numer = args[0];
      var denom = args[1];
      var hasBarLine;
      var leftDelim = null;
      var rightDelim = null;
      var size = "auto";
      switch (funcName) {
        case "\\dfrac":
        case "\\frac":
        case "\\tfrac":
          hasBarLine = true;
          break;
        case "\\\\atopfrac":
          hasBarLine = false;
          break;
        case "\\dbinom":
        case "\\binom":
        case "\\tbinom":
          hasBarLine = false;
          leftDelim = "(";
          rightDelim = ")";
          break;
        case "\\\\bracefrac":
          hasBarLine = false;
          leftDelim = "\\{";
          rightDelim = "\\}";
          break;
        case "\\\\brackfrac":
          hasBarLine = false;
          leftDelim = "[";
          rightDelim = "]";
          break;
        default:
          throw new Error("Unrecognized genfrac command");
      }
      switch (funcName) {
        case "\\dfrac":
        case "\\dbinom":
          size = "display";
          break;
        case "\\tfrac":
        case "\\tbinom":
          size = "text";
          break;
      }
      return {
        type: "genfrac",
        mode: parser.mode,
        continued: false,
        numer,
        denom,
        hasBarLine,
        leftDelim,
        rightDelim,
        size,
        barSize: null
      };
    },
    htmlBuilder: htmlBuilder$4,
    mathmlBuilder: mathmlBuilder$3
  });
  defineFunction({
    type: "genfrac",
    names: ["\\cfrac"],
    props: {
      numArgs: 2
    },
    handler: (_ref2, args) => {
      var {
        parser,
        funcName
      } = _ref2;
      var numer = args[0];
      var denom = args[1];
      return {
        type: "genfrac",
        mode: parser.mode,
        continued: true,
        numer,
        denom,
        hasBarLine: true,
        leftDelim: null,
        rightDelim: null,
        size: "display",
        barSize: null
      };
    }
  });
  defineFunction({
    type: "infix",
    names: ["\\over", "\\choose", "\\atop", "\\brace", "\\brack"],
    props: {
      numArgs: 0,
      infix: true
    },
    handler(_ref3) {
      var {
        parser,
        funcName,
        token
      } = _ref3;
      var replaceWith;
      switch (funcName) {
        case "\\over":
          replaceWith = "\\frac";
          break;
        case "\\choose":
          replaceWith = "\\binom";
          break;
        case "\\atop":
          replaceWith = "\\\\atopfrac";
          break;
        case "\\brace":
          replaceWith = "\\\\bracefrac";
          break;
        case "\\brack":
          replaceWith = "\\\\brackfrac";
          break;
        default:
          throw new Error("Unrecognized infix genfrac command");
      }
      return {
        type: "infix",
        mode: parser.mode,
        replaceWith,
        token
      };
    }
  });
  var stylArray = ["display", "text", "script", "scriptscript"];
  var delimFromValue = function delimFromValue2(delimString) {
    var delim = null;
    if (delimString.length > 0) {
      delim = delimString;
      delim = delim === "." ? null : delim;
    }
    return delim;
  };
  defineFunction({
    type: "genfrac",
    names: ["\\genfrac"],
    props: {
      numArgs: 6,
      allowedInArgument: true,
      argTypes: ["math", "math", "size", "text", "math", "math"]
    },
    handler(_ref4, args) {
      var {
        parser
      } = _ref4;
      var numer = args[4];
      var denom = args[5];
      var leftNode = normalizeArgument(args[0]);
      var leftDelim = leftNode.type === "atom" && leftNode.family === "open" ? delimFromValue(leftNode.text) : null;
      var rightNode = normalizeArgument(args[1]);
      var rightDelim = rightNode.type === "atom" && rightNode.family === "close" ? delimFromValue(rightNode.text) : null;
      var barNode = assertNodeType(args[2], "size");
      var hasBarLine;
      var barSize = null;
      if (barNode.isBlank) {
        hasBarLine = true;
      } else {
        barSize = barNode.value;
        hasBarLine = barSize.number > 0;
      }
      var size = "auto";
      var styl = args[3];
      if (styl.type === "ordgroup") {
        if (styl.body.length > 0) {
          var textOrd = assertNodeType(styl.body[0], "textord");
          size = stylArray[Number(textOrd.text)];
        }
      } else {
        styl = assertNodeType(styl, "textord");
        size = stylArray[Number(styl.text)];
      }
      return {
        type: "genfrac",
        mode: parser.mode,
        numer,
        denom,
        continued: false,
        hasBarLine,
        barSize,
        leftDelim,
        rightDelim,
        size
      };
    },
    htmlBuilder: htmlBuilder$4,
    mathmlBuilder: mathmlBuilder$3
  });
  defineFunction({
    type: "infix",
    names: ["\\above"],
    props: {
      numArgs: 1,
      argTypes: ["size"],
      infix: true
    },
    handler(_ref5, args) {
      var {
        parser,
        funcName,
        token
      } = _ref5;
      return {
        type: "infix",
        mode: parser.mode,
        replaceWith: "\\\\abovefrac",
        size: assertNodeType(args[0], "size").value,
        token
      };
    }
  });
  defineFunction({
    type: "genfrac",
    names: ["\\\\abovefrac"],
    props: {
      numArgs: 3,
      argTypes: ["math", "size", "math"]
    },
    handler: (_ref6, args) => {
      var {
        parser,
        funcName
      } = _ref6;
      var numer = args[0];
      var barSize = assert(assertNodeType(args[1], "infix").size);
      var denom = args[2];
      var hasBarLine = barSize.number > 0;
      return {
        type: "genfrac",
        mode: parser.mode,
        numer,
        denom,
        continued: false,
        hasBarLine,
        barSize,
        leftDelim: null,
        rightDelim: null,
        size: "auto"
      };
    },
    htmlBuilder: htmlBuilder$4,
    mathmlBuilder: mathmlBuilder$3
  });
  var htmlBuilder$3 = (grp, options) => {
    var style = options.style;
    var supSubGroup;
    var group;
    if (grp.type === "supsub") {
      supSubGroup = grp.sup ? buildGroup$1(grp.sup, options.havingStyle(style.sup()), options) : buildGroup$1(grp.sub, options.havingStyle(style.sub()), options);
      group = assertNodeType(grp.base, "horizBrace");
    } else {
      group = assertNodeType(grp, "horizBrace");
    }
    var body = buildGroup$1(group.base, options.havingBaseStyle(Style$1.DISPLAY));
    var braceBody = stretchy.svgSpan(group, options);
    var vlist;
    if (group.isOver) {
      vlist = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: body
        }, {
          type: "kern",
          size: 0.1
        }, {
          type: "elem",
          elem: braceBody
        }]
      }, options);
      vlist.children[0].children[0].children[1].classes.push("svg-align");
    } else {
      vlist = buildCommon.makeVList({
        positionType: "bottom",
        positionData: body.depth + 0.1 + braceBody.height,
        children: [{
          type: "elem",
          elem: braceBody
        }, {
          type: "kern",
          size: 0.1
        }, {
          type: "elem",
          elem: body
        }]
      }, options);
      vlist.children[0].children[0].children[0].classes.push("svg-align");
    }
    if (supSubGroup) {
      var vSpan = buildCommon.makeSpan(["mord", group.isOver ? "mover" : "munder"], [vlist], options);
      if (group.isOver) {
        vlist = buildCommon.makeVList({
          positionType: "firstBaseline",
          children: [{
            type: "elem",
            elem: vSpan
          }, {
            type: "kern",
            size: 0.2
          }, {
            type: "elem",
            elem: supSubGroup
          }]
        }, options);
      } else {
        vlist = buildCommon.makeVList({
          positionType: "bottom",
          positionData: vSpan.depth + 0.2 + supSubGroup.height + supSubGroup.depth,
          children: [{
            type: "elem",
            elem: supSubGroup
          }, {
            type: "kern",
            size: 0.2
          }, {
            type: "elem",
            elem: vSpan
          }]
        }, options);
      }
    }
    return buildCommon.makeSpan(["mord", group.isOver ? "mover" : "munder"], [vlist], options);
  };
  var mathmlBuilder$2 = (group, options) => {
    var accentNode = stretchy.mathMLnode(group.label);
    return new mathMLTree.MathNode(group.isOver ? "mover" : "munder", [buildGroup2(group.base, options), accentNode]);
  };
  defineFunction({
    type: "horizBrace",
    names: ["\\overbrace", "\\underbrace"],
    props: {
      numArgs: 1
    },
    handler(_ref, args) {
      var {
        parser,
        funcName
      } = _ref;
      return {
        type: "horizBrace",
        mode: parser.mode,
        label: funcName,
        isOver: /^\\over/.test(funcName),
        base: args[0]
      };
    },
    htmlBuilder: htmlBuilder$3,
    mathmlBuilder: mathmlBuilder$2
  });
  defineFunction({
    type: "href",
    names: ["\\href"],
    props: {
      numArgs: 2,
      argTypes: ["url", "original"],
      allowedInText: true
    },
    handler: (_ref, args) => {
      var {
        parser
      } = _ref;
      var body = args[1];
      var href = assertNodeType(args[0], "url").url;
      if (!parser.settings.isTrusted({
        command: "\\href",
        url: href
      })) {
        return parser.formatUnsupportedCmd("\\href");
      }
      return {
        type: "href",
        mode: parser.mode,
        href,
        body: ordargument(body)
      };
    },
    htmlBuilder: (group, options) => {
      var elements2 = buildExpression$1(group.body, options, false);
      return buildCommon.makeAnchor(group.href, [], elements2, options);
    },
    mathmlBuilder: (group, options) => {
      var math2 = buildExpressionRow(group.body, options);
      if (!(math2 instanceof MathNode)) {
        math2 = new MathNode("mrow", [math2]);
      }
      math2.setAttribute("href", group.href);
      return math2;
    }
  });
  defineFunction({
    type: "href",
    names: ["\\url"],
    props: {
      numArgs: 1,
      argTypes: ["url"],
      allowedInText: true
    },
    handler: (_ref2, args) => {
      var {
        parser
      } = _ref2;
      var href = assertNodeType(args[0], "url").url;
      if (!parser.settings.isTrusted({
        command: "\\url",
        url: href
      })) {
        return parser.formatUnsupportedCmd("\\url");
      }
      var chars = [];
      for (var i = 0; i < href.length; i++) {
        var c = href[i];
        if (c === "~") {
          c = "\\textasciitilde";
        }
        chars.push({
          type: "textord",
          mode: "text",
          text: c
        });
      }
      var body = {
        type: "text",
        mode: parser.mode,
        font: "\\texttt",
        body: chars
      };
      return {
        type: "href",
        mode: parser.mode,
        href,
        body: ordargument(body)
      };
    }
  });
  defineFunction({
    type: "hbox",
    names: ["\\hbox"],
    props: {
      numArgs: 1,
      argTypes: ["text"],
      allowedInText: true,
      primitive: true
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      return {
        type: "hbox",
        mode: parser.mode,
        body: ordargument(args[0])
      };
    },
    htmlBuilder(group, options) {
      var elements2 = buildExpression$1(group.body, options, false);
      return buildCommon.makeFragment(elements2);
    },
    mathmlBuilder(group, options) {
      return new mathMLTree.MathNode("mrow", buildExpression2(group.body, options));
    }
  });
  defineFunction({
    type: "html",
    names: ["\\htmlClass", "\\htmlId", "\\htmlStyle", "\\htmlData"],
    props: {
      numArgs: 2,
      argTypes: ["raw", "original"],
      allowedInText: true
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName,
        token
      } = _ref;
      var value = assertNodeType(args[0], "raw").string;
      var body = args[1];
      if (parser.settings.strict) {
        parser.settings.reportNonstrict("htmlExtension", "HTML extension is disabled on strict mode");
      }
      var trustContext;
      var attributes = {};
      switch (funcName) {
        case "\\htmlClass":
          attributes.class = value;
          trustContext = {
            command: "\\htmlClass",
            class: value
          };
          break;
        case "\\htmlId":
          attributes.id = value;
          trustContext = {
            command: "\\htmlId",
            id: value
          };
          break;
        case "\\htmlStyle":
          attributes.style = value;
          trustContext = {
            command: "\\htmlStyle",
            style: value
          };
          break;
        case "\\htmlData": {
          var data2 = value.split(",");
          for (var i = 0; i < data2.length; i++) {
            var keyVal = data2[i].split("=");
            if (keyVal.length !== 2) {
              throw new ParseError("Error parsing key-value for \\htmlData");
            }
            attributes["data-" + keyVal[0].trim()] = keyVal[1].trim();
          }
          trustContext = {
            command: "\\htmlData",
            attributes
          };
          break;
        }
        default:
          throw new Error("Unrecognized html command");
      }
      if (!parser.settings.isTrusted(trustContext)) {
        return parser.formatUnsupportedCmd(funcName);
      }
      return {
        type: "html",
        mode: parser.mode,
        attributes,
        body: ordargument(body)
      };
    },
    htmlBuilder: (group, options) => {
      var elements2 = buildExpression$1(group.body, options, false);
      var classes = ["enclosing"];
      if (group.attributes.class) {
        classes.push(...group.attributes.class.trim().split(/\s+/));
      }
      var span = buildCommon.makeSpan(classes, elements2, options);
      for (var attr in group.attributes) {
        if (attr !== "class" && group.attributes.hasOwnProperty(attr)) {
          span.setAttribute(attr, group.attributes[attr]);
        }
      }
      return span;
    },
    mathmlBuilder: (group, options) => {
      return buildExpressionRow(group.body, options);
    }
  });
  defineFunction({
    type: "htmlmathml",
    names: ["\\html@mathml"],
    props: {
      numArgs: 2,
      allowedInText: true
    },
    handler: (_ref, args) => {
      var {
        parser
      } = _ref;
      return {
        type: "htmlmathml",
        mode: parser.mode,
        html: ordargument(args[0]),
        mathml: ordargument(args[1])
      };
    },
    htmlBuilder: (group, options) => {
      var elements2 = buildExpression$1(group.html, options, false);
      return buildCommon.makeFragment(elements2);
    },
    mathmlBuilder: (group, options) => {
      return buildExpressionRow(group.mathml, options);
    }
  });
  var sizeData = function sizeData2(str) {
    if (/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(str)) {
      return {
        number: +str,
        unit: "bp"
      };
    } else {
      var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(str);
      if (!match) {
        throw new ParseError("Invalid size: '" + str + "' in \\includegraphics");
      }
      var data2 = {
        number: +(match[1] + match[2]),
        // sign + magnitude, cast to number
        unit: match[3]
      };
      if (!validUnit(data2)) {
        throw new ParseError("Invalid unit: '" + data2.unit + "' in \\includegraphics.");
      }
      return data2;
    }
  };
  defineFunction({
    type: "includegraphics",
    names: ["\\includegraphics"],
    props: {
      numArgs: 1,
      numOptionalArgs: 1,
      argTypes: ["raw", "url"],
      allowedInText: false
    },
    handler: (_ref, args, optArgs) => {
      var {
        parser
      } = _ref;
      var width = {
        number: 0,
        unit: "em"
      };
      var height = {
        number: 0.9,
        unit: "em"
      };
      var totalheight = {
        number: 0,
        unit: "em"
      };
      var alt = "";
      if (optArgs[0]) {
        var attributeStr = assertNodeType(optArgs[0], "raw").string;
        var attributes = attributeStr.split(",");
        for (var i = 0; i < attributes.length; i++) {
          var keyVal = attributes[i].split("=");
          if (keyVal.length === 2) {
            var str = keyVal[1].trim();
            switch (keyVal[0].trim()) {
              case "alt":
                alt = str;
                break;
              case "width":
                width = sizeData(str);
                break;
              case "height":
                height = sizeData(str);
                break;
              case "totalheight":
                totalheight = sizeData(str);
                break;
              default:
                throw new ParseError("Invalid key: '" + keyVal[0] + "' in \\includegraphics.");
            }
          }
        }
      }
      var src = assertNodeType(args[0], "url").url;
      if (alt === "") {
        alt = src;
        alt = alt.replace(/^.*[\\/]/, "");
        alt = alt.substring(0, alt.lastIndexOf("."));
      }
      if (!parser.settings.isTrusted({
        command: "\\includegraphics",
        url: src
      })) {
        return parser.formatUnsupportedCmd("\\includegraphics");
      }
      return {
        type: "includegraphics",
        mode: parser.mode,
        alt,
        width,
        height,
        totalheight,
        src
      };
    },
    htmlBuilder: (group, options) => {
      var height = calculateSize(group.height, options);
      var depth = 0;
      if (group.totalheight.number > 0) {
        depth = calculateSize(group.totalheight, options) - height;
      }
      var width = 0;
      if (group.width.number > 0) {
        width = calculateSize(group.width, options);
      }
      var style = {
        height: makeEm(height + depth)
      };
      if (width > 0) {
        style.width = makeEm(width);
      }
      if (depth > 0) {
        style.verticalAlign = makeEm(-depth);
      }
      var node = new Img(group.src, group.alt, style);
      node.height = height;
      node.depth = depth;
      return node;
    },
    mathmlBuilder: (group, options) => {
      var node = new mathMLTree.MathNode("mglyph", []);
      node.setAttribute("alt", group.alt);
      var height = calculateSize(group.height, options);
      var depth = 0;
      if (group.totalheight.number > 0) {
        depth = calculateSize(group.totalheight, options) - height;
        node.setAttribute("valign", makeEm(-depth));
      }
      node.setAttribute("height", makeEm(height + depth));
      if (group.width.number > 0) {
        var width = calculateSize(group.width, options);
        node.setAttribute("width", makeEm(width));
      }
      node.setAttribute("src", group.src);
      return node;
    }
  });
  defineFunction({
    type: "kern",
    names: ["\\kern", "\\mkern", "\\hskip", "\\mskip"],
    props: {
      numArgs: 1,
      argTypes: ["size"],
      primitive: true,
      allowedInText: true
    },
    handler(_ref, args) {
      var {
        parser,
        funcName
      } = _ref;
      var size = assertNodeType(args[0], "size");
      if (parser.settings.strict) {
        var mathFunction = funcName[1] === "m";
        var muUnit = size.value.unit === "mu";
        if (mathFunction) {
          if (!muUnit) {
            parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " supports only mu units, " + ("not " + size.value.unit + " units"));
          }
          if (parser.mode !== "math") {
            parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " works only in math mode");
          }
        } else {
          if (muUnit) {
            parser.settings.reportNonstrict("mathVsTextUnits", "LaTeX's " + funcName + " doesn't support mu units");
          }
        }
      }
      return {
        type: "kern",
        mode: parser.mode,
        dimension: size.value
      };
    },
    htmlBuilder(group, options) {
      return buildCommon.makeGlue(group.dimension, options);
    },
    mathmlBuilder(group, options) {
      var dimension = calculateSize(group.dimension, options);
      return new mathMLTree.SpaceNode(dimension);
    }
  });
  defineFunction({
    type: "lap",
    names: ["\\mathllap", "\\mathrlap", "\\mathclap"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName
      } = _ref;
      var body = args[0];
      return {
        type: "lap",
        mode: parser.mode,
        alignment: funcName.slice(5),
        body
      };
    },
    htmlBuilder: (group, options) => {
      var inner2;
      if (group.alignment === "clap") {
        inner2 = buildCommon.makeSpan([], [buildGroup$1(group.body, options)]);
        inner2 = buildCommon.makeSpan(["inner"], [inner2], options);
      } else {
        inner2 = buildCommon.makeSpan(["inner"], [buildGroup$1(group.body, options)]);
      }
      var fix = buildCommon.makeSpan(["fix"], []);
      var node = buildCommon.makeSpan([group.alignment], [inner2, fix], options);
      var strut = buildCommon.makeSpan(["strut"]);
      strut.style.height = makeEm(node.height + node.depth);
      if (node.depth) {
        strut.style.verticalAlign = makeEm(-node.depth);
      }
      node.children.unshift(strut);
      node = buildCommon.makeSpan(["thinbox"], [node], options);
      return buildCommon.makeSpan(["mord", "vbox"], [node], options);
    },
    mathmlBuilder: (group, options) => {
      var node = new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)]);
      if (group.alignment !== "rlap") {
        var offset = group.alignment === "llap" ? "-1" : "-0.5";
        node.setAttribute("lspace", offset + "width");
      }
      node.setAttribute("width", "0px");
      return node;
    }
  });
  defineFunction({
    type: "styling",
    names: ["\\(", "$"],
    props: {
      numArgs: 0,
      allowedInText: true,
      allowedInMath: false
    },
    handler(_ref, args) {
      var {
        funcName,
        parser
      } = _ref;
      var outerMode = parser.mode;
      parser.switchMode("math");
      var close2 = funcName === "\\(" ? "\\)" : "$";
      var body = parser.parseExpression(false, close2);
      parser.expect(close2);
      parser.switchMode(outerMode);
      return {
        type: "styling",
        mode: parser.mode,
        style: "text",
        body
      };
    }
  });
  defineFunction({
    type: "text",
    // Doesn't matter what this is.
    names: ["\\)", "\\]"],
    props: {
      numArgs: 0,
      allowedInText: true,
      allowedInMath: false
    },
    handler(context, args) {
      throw new ParseError("Mismatched " + context.funcName);
    }
  });
  var chooseMathStyle = (group, options) => {
    switch (options.style.size) {
      case Style$1.DISPLAY.size:
        return group.display;
      case Style$1.TEXT.size:
        return group.text;
      case Style$1.SCRIPT.size:
        return group.script;
      case Style$1.SCRIPTSCRIPT.size:
        return group.scriptscript;
      default:
        return group.text;
    }
  };
  defineFunction({
    type: "mathchoice",
    names: ["\\mathchoice"],
    props: {
      numArgs: 4,
      primitive: true
    },
    handler: (_ref, args) => {
      var {
        parser
      } = _ref;
      return {
        type: "mathchoice",
        mode: parser.mode,
        display: ordargument(args[0]),
        text: ordargument(args[1]),
        script: ordargument(args[2]),
        scriptscript: ordargument(args[3])
      };
    },
    htmlBuilder: (group, options) => {
      var body = chooseMathStyle(group, options);
      var elements2 = buildExpression$1(body, options, false);
      return buildCommon.makeFragment(elements2);
    },
    mathmlBuilder: (group, options) => {
      var body = chooseMathStyle(group, options);
      return buildExpressionRow(body, options);
    }
  });
  var assembleSupSub = (base, supGroup, subGroup, options, style, slant, baseShift) => {
    base = buildCommon.makeSpan([], [base]);
    var subIsSingleCharacter = subGroup && utils.isCharacterBox(subGroup);
    var sub2;
    var sup2;
    if (supGroup) {
      var elem = buildGroup$1(supGroup, options.havingStyle(style.sup()), options);
      sup2 = {
        elem,
        kern: Math.max(options.fontMetrics().bigOpSpacing1, options.fontMetrics().bigOpSpacing3 - elem.depth)
      };
    }
    if (subGroup) {
      var _elem = buildGroup$1(subGroup, options.havingStyle(style.sub()), options);
      sub2 = {
        elem: _elem,
        kern: Math.max(options.fontMetrics().bigOpSpacing2, options.fontMetrics().bigOpSpacing4 - _elem.height)
      };
    }
    var finalGroup;
    if (sup2 && sub2) {
      var bottom = options.fontMetrics().bigOpSpacing5 + sub2.elem.height + sub2.elem.depth + sub2.kern + base.depth + baseShift;
      finalGroup = buildCommon.makeVList({
        positionType: "bottom",
        positionData: bottom,
        children: [{
          type: "kern",
          size: options.fontMetrics().bigOpSpacing5
        }, {
          type: "elem",
          elem: sub2.elem,
          marginLeft: makeEm(-slant)
        }, {
          type: "kern",
          size: sub2.kern
        }, {
          type: "elem",
          elem: base
        }, {
          type: "kern",
          size: sup2.kern
        }, {
          type: "elem",
          elem: sup2.elem,
          marginLeft: makeEm(slant)
        }, {
          type: "kern",
          size: options.fontMetrics().bigOpSpacing5
        }]
      }, options);
    } else if (sub2) {
      var top = base.height - baseShift;
      finalGroup = buildCommon.makeVList({
        positionType: "top",
        positionData: top,
        children: [{
          type: "kern",
          size: options.fontMetrics().bigOpSpacing5
        }, {
          type: "elem",
          elem: sub2.elem,
          marginLeft: makeEm(-slant)
        }, {
          type: "kern",
          size: sub2.kern
        }, {
          type: "elem",
          elem: base
        }]
      }, options);
    } else if (sup2) {
      var _bottom = base.depth + baseShift;
      finalGroup = buildCommon.makeVList({
        positionType: "bottom",
        positionData: _bottom,
        children: [{
          type: "elem",
          elem: base
        }, {
          type: "kern",
          size: sup2.kern
        }, {
          type: "elem",
          elem: sup2.elem,
          marginLeft: makeEm(slant)
        }, {
          type: "kern",
          size: options.fontMetrics().bigOpSpacing5
        }]
      }, options);
    } else {
      return base;
    }
    var parts = [finalGroup];
    if (sub2 && slant !== 0 && !subIsSingleCharacter) {
      var spacer = buildCommon.makeSpan(["mspace"], [], options);
      spacer.style.marginRight = makeEm(slant);
      parts.unshift(spacer);
    }
    return buildCommon.makeSpan(["mop", "op-limits"], parts, options);
  };
  var noSuccessor = ["\\smallint"];
  var htmlBuilder$2 = (grp, options) => {
    var supGroup;
    var subGroup;
    var hasLimits = false;
    var group;
    if (grp.type === "supsub") {
      supGroup = grp.sup;
      subGroup = grp.sub;
      group = assertNodeType(grp.base, "op");
      hasLimits = true;
    } else {
      group = assertNodeType(grp, "op");
    }
    var style = options.style;
    var large = false;
    if (style.size === Style$1.DISPLAY.size && group.symbol && !noSuccessor.includes(group.name)) {
      large = true;
    }
    var base;
    if (group.symbol) {
      var fontName = large ? "Size2-Regular" : "Size1-Regular";
      var stash = "";
      if (group.name === "\\oiint" || group.name === "\\oiiint") {
        stash = group.name.slice(1);
        group.name = stash === "oiint" ? "\\iint" : "\\iiint";
      }
      base = buildCommon.makeSymbol(group.name, fontName, "math", options, ["mop", "op-symbol", large ? "large-op" : "small-op"]);
      if (stash.length > 0) {
        var italic = base.italic;
        var oval = buildCommon.staticSvg(stash + "Size" + (large ? "2" : "1"), options);
        base = buildCommon.makeVList({
          positionType: "individualShift",
          children: [{
            type: "elem",
            elem: base,
            shift: 0
          }, {
            type: "elem",
            elem: oval,
            shift: large ? 0.08 : 0
          }]
        }, options);
        group.name = "\\" + stash;
        base.classes.unshift("mop");
        base.italic = italic;
      }
    } else if (group.body) {
      var inner2 = buildExpression$1(group.body, options, true);
      if (inner2.length === 1 && inner2[0] instanceof SymbolNode) {
        base = inner2[0];
        base.classes[0] = "mop";
      } else {
        base = buildCommon.makeSpan(["mop"], inner2, options);
      }
    } else {
      var output = [];
      for (var i = 1; i < group.name.length; i++) {
        output.push(buildCommon.mathsym(group.name[i], group.mode, options));
      }
      base = buildCommon.makeSpan(["mop"], output, options);
    }
    var baseShift = 0;
    var slant = 0;
    if ((base instanceof SymbolNode || group.name === "\\oiint" || group.name === "\\oiiint") && !group.suppressBaseShift) {
      baseShift = (base.height - base.depth) / 2 - options.fontMetrics().axisHeight;
      slant = base.italic;
    }
    if (hasLimits) {
      return assembleSupSub(base, supGroup, subGroup, options, style, slant, baseShift);
    } else {
      if (baseShift) {
        base.style.position = "relative";
        base.style.top = makeEm(baseShift);
      }
      return base;
    }
  };
  var mathmlBuilder$1 = (group, options) => {
    var node;
    if (group.symbol) {
      node = new MathNode("mo", [makeText(group.name, group.mode)]);
      if (noSuccessor.includes(group.name)) {
        node.setAttribute("largeop", "false");
      }
    } else if (group.body) {
      node = new MathNode("mo", buildExpression2(group.body, options));
    } else {
      node = new MathNode("mi", [new TextNode(group.name.slice(1))]);
      var operator = new MathNode("mo", [makeText("\u2061", "text")]);
      if (group.parentIsSupSub) {
        node = new MathNode("mrow", [node, operator]);
      } else {
        node = newDocumentFragment([node, operator]);
      }
    }
    return node;
  };
  var singleCharBigOps = {
    "\u220F": "\\prod",
    "\u2210": "\\coprod",
    "\u2211": "\\sum",
    "\u22C0": "\\bigwedge",
    "\u22C1": "\\bigvee",
    "\u22C2": "\\bigcap",
    "\u22C3": "\\bigcup",
    "\u2A00": "\\bigodot",
    "\u2A01": "\\bigoplus",
    "\u2A02": "\\bigotimes",
    "\u2A04": "\\biguplus",
    "\u2A06": "\\bigsqcup"
  };
  defineFunction({
    type: "op",
    names: ["\\coprod", "\\bigvee", "\\bigwedge", "\\biguplus", "\\bigcap", "\\bigcup", "\\intop", "\\prod", "\\sum", "\\bigotimes", "\\bigoplus", "\\bigodot", "\\bigsqcup", "\\smallint", "\u220F", "\u2210", "\u2211", "\u22C0", "\u22C1", "\u22C2", "\u22C3", "\u2A00", "\u2A01", "\u2A02", "\u2A04", "\u2A06"],
    props: {
      numArgs: 0
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName
      } = _ref;
      var fName = funcName;
      if (fName.length === 1) {
        fName = singleCharBigOps[fName];
      }
      return {
        type: "op",
        mode: parser.mode,
        limits: true,
        parentIsSupSub: false,
        symbol: true,
        name: fName
      };
    },
    htmlBuilder: htmlBuilder$2,
    mathmlBuilder: mathmlBuilder$1
  });
  defineFunction({
    type: "op",
    names: ["\\mathop"],
    props: {
      numArgs: 1,
      primitive: true
    },
    handler: (_ref2, args) => {
      var {
        parser
      } = _ref2;
      var body = args[0];
      return {
        type: "op",
        mode: parser.mode,
        limits: false,
        parentIsSupSub: false,
        symbol: false,
        body: ordargument(body)
      };
    },
    htmlBuilder: htmlBuilder$2,
    mathmlBuilder: mathmlBuilder$1
  });
  var singleCharIntegrals = {
    "\u222B": "\\int",
    "\u222C": "\\iint",
    "\u222D": "\\iiint",
    "\u222E": "\\oint",
    "\u222F": "\\oiint",
    "\u2230": "\\oiiint"
  };
  defineFunction({
    type: "op",
    names: ["\\arcsin", "\\arccos", "\\arctan", "\\arctg", "\\arcctg", "\\arg", "\\ch", "\\cos", "\\cosec", "\\cosh", "\\cot", "\\cotg", "\\coth", "\\csc", "\\ctg", "\\cth", "\\deg", "\\dim", "\\exp", "\\hom", "\\ker", "\\lg", "\\ln", "\\log", "\\sec", "\\sin", "\\sinh", "\\sh", "\\tan", "\\tanh", "\\tg", "\\th"],
    props: {
      numArgs: 0
    },
    handler(_ref3) {
      var {
        parser,
        funcName
      } = _ref3;
      return {
        type: "op",
        mode: parser.mode,
        limits: false,
        parentIsSupSub: false,
        symbol: false,
        name: funcName
      };
    },
    htmlBuilder: htmlBuilder$2,
    mathmlBuilder: mathmlBuilder$1
  });
  defineFunction({
    type: "op",
    names: ["\\det", "\\gcd", "\\inf", "\\lim", "\\max", "\\min", "\\Pr", "\\sup"],
    props: {
      numArgs: 0
    },
    handler(_ref4) {
      var {
        parser,
        funcName
      } = _ref4;
      return {
        type: "op",
        mode: parser.mode,
        limits: true,
        parentIsSupSub: false,
        symbol: false,
        name: funcName
      };
    },
    htmlBuilder: htmlBuilder$2,
    mathmlBuilder: mathmlBuilder$1
  });
  defineFunction({
    type: "op",
    names: ["\\int", "\\iint", "\\iiint", "\\oint", "\\oiint", "\\oiiint", "\u222B", "\u222C", "\u222D", "\u222E", "\u222F", "\u2230"],
    props: {
      numArgs: 0
    },
    handler(_ref5) {
      var {
        parser,
        funcName
      } = _ref5;
      var fName = funcName;
      if (fName.length === 1) {
        fName = singleCharIntegrals[fName];
      }
      return {
        type: "op",
        mode: parser.mode,
        limits: false,
        parentIsSupSub: false,
        symbol: true,
        name: fName
      };
    },
    htmlBuilder: htmlBuilder$2,
    mathmlBuilder: mathmlBuilder$1
  });
  var htmlBuilder$1 = (grp, options) => {
    var supGroup;
    var subGroup;
    var hasLimits = false;
    var group;
    if (grp.type === "supsub") {
      supGroup = grp.sup;
      subGroup = grp.sub;
      group = assertNodeType(grp.base, "operatorname");
      hasLimits = true;
    } else {
      group = assertNodeType(grp, "operatorname");
    }
    var base;
    if (group.body.length > 0) {
      var body = group.body.map((child2) => {
        var childText = child2.text;
        if (typeof childText === "string") {
          return {
            type: "textord",
            mode: child2.mode,
            text: childText
          };
        } else {
          return child2;
        }
      });
      var expression = buildExpression$1(body, options.withFont("mathrm"), true);
      for (var i = 0; i < expression.length; i++) {
        var child = expression[i];
        if (child instanceof SymbolNode) {
          child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
        }
      }
      base = buildCommon.makeSpan(["mop"], expression, options);
    } else {
      base = buildCommon.makeSpan(["mop"], [], options);
    }
    if (hasLimits) {
      return assembleSupSub(base, supGroup, subGroup, options, options.style, 0, 0);
    } else {
      return base;
    }
  };
  var mathmlBuilder2 = (group, options) => {
    var expression = buildExpression2(group.body, options.withFont("mathrm"));
    var isAllString = true;
    for (var i = 0; i < expression.length; i++) {
      var node = expression[i];
      if (node instanceof mathMLTree.SpaceNode) ;
      else if (node instanceof mathMLTree.MathNode) {
        switch (node.type) {
          case "mi":
          case "mn":
          case "ms":
          case "mspace":
          case "mtext":
            break;
          // Do nothing yet.
          case "mo": {
            var child = node.children[0];
            if (node.children.length === 1 && child instanceof mathMLTree.TextNode) {
              child.text = child.text.replace(/\u2212/, "-").replace(/\u2217/, "*");
            } else {
              isAllString = false;
            }
            break;
          }
          default:
            isAllString = false;
        }
      } else {
        isAllString = false;
      }
    }
    if (isAllString) {
      var word = expression.map((node2) => node2.toText()).join("");
      expression = [new mathMLTree.TextNode(word)];
    }
    var identifier = new mathMLTree.MathNode("mi", expression);
    identifier.setAttribute("mathvariant", "normal");
    var operator = new mathMLTree.MathNode("mo", [makeText("\u2061", "text")]);
    if (group.parentIsSupSub) {
      return new mathMLTree.MathNode("mrow", [identifier, operator]);
    } else {
      return mathMLTree.newDocumentFragment([identifier, operator]);
    }
  };
  defineFunction({
    type: "operatorname",
    names: ["\\operatorname@", "\\operatornamewithlimits"],
    props: {
      numArgs: 1
    },
    handler: (_ref, args) => {
      var {
        parser,
        funcName
      } = _ref;
      var body = args[0];
      return {
        type: "operatorname",
        mode: parser.mode,
        body: ordargument(body),
        alwaysHandleSupSub: funcName === "\\operatornamewithlimits",
        limits: false,
        parentIsSupSub: false
      };
    },
    htmlBuilder: htmlBuilder$1,
    mathmlBuilder: mathmlBuilder2
  });
  defineMacro("\\operatorname", "\\@ifstar\\operatornamewithlimits\\operatorname@");
  defineFunctionBuilders({
    type: "ordgroup",
    htmlBuilder(group, options) {
      if (group.semisimple) {
        return buildCommon.makeFragment(buildExpression$1(group.body, options, false));
      }
      return buildCommon.makeSpan(["mord"], buildExpression$1(group.body, options, true), options);
    },
    mathmlBuilder(group, options) {
      return buildExpressionRow(group.body, options, true);
    }
  });
  defineFunction({
    type: "overline",
    names: ["\\overline"],
    props: {
      numArgs: 1
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      var body = args[0];
      return {
        type: "overline",
        mode: parser.mode,
        body
      };
    },
    htmlBuilder(group, options) {
      var innerGroup = buildGroup$1(group.body, options.havingCrampedStyle());
      var line = buildCommon.makeLineSpan("overline-line", options);
      var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
      var vlist = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: innerGroup
        }, {
          type: "kern",
          size: 3 * defaultRuleThickness
        }, {
          type: "elem",
          elem: line
        }, {
          type: "kern",
          size: defaultRuleThickness
        }]
      }, options);
      return buildCommon.makeSpan(["mord", "overline"], [vlist], options);
    },
    mathmlBuilder(group, options) {
      var operator = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode("\u203E")]);
      operator.setAttribute("stretchy", "true");
      var node = new mathMLTree.MathNode("mover", [buildGroup2(group.body, options), operator]);
      node.setAttribute("accent", "true");
      return node;
    }
  });
  defineFunction({
    type: "phantom",
    names: ["\\phantom"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler: (_ref, args) => {
      var {
        parser
      } = _ref;
      var body = args[0];
      return {
        type: "phantom",
        mode: parser.mode,
        body: ordargument(body)
      };
    },
    htmlBuilder: (group, options) => {
      var elements2 = buildExpression$1(group.body, options.withPhantom(), false);
      return buildCommon.makeFragment(elements2);
    },
    mathmlBuilder: (group, options) => {
      var inner2 = buildExpression2(group.body, options);
      return new mathMLTree.MathNode("mphantom", inner2);
    }
  });
  defineFunction({
    type: "hphantom",
    names: ["\\hphantom"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler: (_ref2, args) => {
      var {
        parser
      } = _ref2;
      var body = args[0];
      return {
        type: "hphantom",
        mode: parser.mode,
        body
      };
    },
    htmlBuilder: (group, options) => {
      var node = buildCommon.makeSpan([], [buildGroup$1(group.body, options.withPhantom())]);
      node.height = 0;
      node.depth = 0;
      if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
          node.children[i].height = 0;
          node.children[i].depth = 0;
        }
      }
      node = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: node
        }]
      }, options);
      return buildCommon.makeSpan(["mord"], [node], options);
    },
    mathmlBuilder: (group, options) => {
      var inner2 = buildExpression2(ordargument(group.body), options);
      var phantom = new mathMLTree.MathNode("mphantom", inner2);
      var node = new mathMLTree.MathNode("mpadded", [phantom]);
      node.setAttribute("height", "0px");
      node.setAttribute("depth", "0px");
      return node;
    }
  });
  defineFunction({
    type: "vphantom",
    names: ["\\vphantom"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler: (_ref3, args) => {
      var {
        parser
      } = _ref3;
      var body = args[0];
      return {
        type: "vphantom",
        mode: parser.mode,
        body
      };
    },
    htmlBuilder: (group, options) => {
      var inner2 = buildCommon.makeSpan(["inner"], [buildGroup$1(group.body, options.withPhantom())]);
      var fix = buildCommon.makeSpan(["fix"], []);
      return buildCommon.makeSpan(["mord", "rlap"], [inner2, fix], options);
    },
    mathmlBuilder: (group, options) => {
      var inner2 = buildExpression2(ordargument(group.body), options);
      var phantom = new mathMLTree.MathNode("mphantom", inner2);
      var node = new mathMLTree.MathNode("mpadded", [phantom]);
      node.setAttribute("width", "0px");
      return node;
    }
  });
  defineFunction({
    type: "raisebox",
    names: ["\\raisebox"],
    props: {
      numArgs: 2,
      argTypes: ["size", "hbox"],
      allowedInText: true
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      var amount = assertNodeType(args[0], "size").value;
      var body = args[1];
      return {
        type: "raisebox",
        mode: parser.mode,
        dy: amount,
        body
      };
    },
    htmlBuilder(group, options) {
      var body = buildGroup$1(group.body, options);
      var dy = calculateSize(group.dy, options);
      return buildCommon.makeVList({
        positionType: "shift",
        positionData: -dy,
        children: [{
          type: "elem",
          elem: body
        }]
      }, options);
    },
    mathmlBuilder(group, options) {
      var node = new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)]);
      var dy = group.dy.number + group.dy.unit;
      node.setAttribute("voffset", dy);
      return node;
    }
  });
  defineFunction({
    type: "internal",
    names: ["\\relax"],
    props: {
      numArgs: 0,
      allowedInText: true,
      allowedInArgument: true
    },
    handler(_ref) {
      var {
        parser
      } = _ref;
      return {
        type: "internal",
        mode: parser.mode
      };
    }
  });
  defineFunction({
    type: "rule",
    names: ["\\rule"],
    props: {
      numArgs: 2,
      numOptionalArgs: 1,
      allowedInText: true,
      allowedInMath: true,
      argTypes: ["size", "size", "size"]
    },
    handler(_ref, args, optArgs) {
      var {
        parser
      } = _ref;
      var shift = optArgs[0];
      var width = assertNodeType(args[0], "size");
      var height = assertNodeType(args[1], "size");
      return {
        type: "rule",
        mode: parser.mode,
        shift: shift && assertNodeType(shift, "size").value,
        width: width.value,
        height: height.value
      };
    },
    htmlBuilder(group, options) {
      var rule = buildCommon.makeSpan(["mord", "rule"], [], options);
      var width = calculateSize(group.width, options);
      var height = calculateSize(group.height, options);
      var shift = group.shift ? calculateSize(group.shift, options) : 0;
      rule.style.borderRightWidth = makeEm(width);
      rule.style.borderTopWidth = makeEm(height);
      rule.style.bottom = makeEm(shift);
      rule.width = width;
      rule.height = height + shift;
      rule.depth = -shift;
      rule.maxFontSize = height * 1.125 * options.sizeMultiplier;
      return rule;
    },
    mathmlBuilder(group, options) {
      var width = calculateSize(group.width, options);
      var height = calculateSize(group.height, options);
      var shift = group.shift ? calculateSize(group.shift, options) : 0;
      var color = options.color && options.getColor() || "black";
      var rule = new mathMLTree.MathNode("mspace");
      rule.setAttribute("mathbackground", color);
      rule.setAttribute("width", makeEm(width));
      rule.setAttribute("height", makeEm(height));
      var wrapper = new mathMLTree.MathNode("mpadded", [rule]);
      if (shift >= 0) {
        wrapper.setAttribute("height", makeEm(shift));
      } else {
        wrapper.setAttribute("height", makeEm(shift));
        wrapper.setAttribute("depth", makeEm(-shift));
      }
      wrapper.setAttribute("voffset", makeEm(shift));
      return wrapper;
    }
  });
  function sizingGroup(value, options, baseOptions) {
    var inner2 = buildExpression$1(value, options, false);
    var multiplier = options.sizeMultiplier / baseOptions.sizeMultiplier;
    for (var i = 0; i < inner2.length; i++) {
      var pos = inner2[i].classes.indexOf("sizing");
      if (pos < 0) {
        Array.prototype.push.apply(inner2[i].classes, options.sizingClasses(baseOptions));
      } else if (inner2[i].classes[pos + 1] === "reset-size" + options.size) {
        inner2[i].classes[pos + 1] = "reset-size" + baseOptions.size;
      }
      inner2[i].height *= multiplier;
      inner2[i].depth *= multiplier;
    }
    return buildCommon.makeFragment(inner2);
  }
  var sizeFuncs = ["\\tiny", "\\sixptsize", "\\scriptsize", "\\footnotesize", "\\small", "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge"];
  var htmlBuilder2 = (group, options) => {
    var newOptions = options.havingSize(group.size);
    return sizingGroup(group.body, newOptions, options);
  };
  defineFunction({
    type: "sizing",
    names: sizeFuncs,
    props: {
      numArgs: 0,
      allowedInText: true
    },
    handler: (_ref, args) => {
      var {
        breakOnTokenText,
        funcName,
        parser
      } = _ref;
      var body = parser.parseExpression(false, breakOnTokenText);
      return {
        type: "sizing",
        mode: parser.mode,
        // Figure out what size to use based on the list of functions above
        size: sizeFuncs.indexOf(funcName) + 1,
        body
      };
    },
    htmlBuilder: htmlBuilder2,
    mathmlBuilder: (group, options) => {
      var newOptions = options.havingSize(group.size);
      var inner2 = buildExpression2(group.body, newOptions);
      var node = new mathMLTree.MathNode("mstyle", inner2);
      node.setAttribute("mathsize", makeEm(newOptions.sizeMultiplier));
      return node;
    }
  });
  defineFunction({
    type: "smash",
    names: ["\\smash"],
    props: {
      numArgs: 1,
      numOptionalArgs: 1,
      allowedInText: true
    },
    handler: (_ref, args, optArgs) => {
      var {
        parser
      } = _ref;
      var smashHeight = false;
      var smashDepth = false;
      var tbArg = optArgs[0] && assertNodeType(optArgs[0], "ordgroup");
      if (tbArg) {
        var letter = "";
        for (var i = 0; i < tbArg.body.length; ++i) {
          var node = tbArg.body[i];
          letter = node.text;
          if (letter === "t") {
            smashHeight = true;
          } else if (letter === "b") {
            smashDepth = true;
          } else {
            smashHeight = false;
            smashDepth = false;
            break;
          }
        }
      } else {
        smashHeight = true;
        smashDepth = true;
      }
      var body = args[0];
      return {
        type: "smash",
        mode: parser.mode,
        body,
        smashHeight,
        smashDepth
      };
    },
    htmlBuilder: (group, options) => {
      var node = buildCommon.makeSpan([], [buildGroup$1(group.body, options)]);
      if (!group.smashHeight && !group.smashDepth) {
        return node;
      }
      if (group.smashHeight) {
        node.height = 0;
        if (node.children) {
          for (var i = 0; i < node.children.length; i++) {
            node.children[i].height = 0;
          }
        }
      }
      if (group.smashDepth) {
        node.depth = 0;
        if (node.children) {
          for (var _i = 0; _i < node.children.length; _i++) {
            node.children[_i].depth = 0;
          }
        }
      }
      var smashedNode = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: node
        }]
      }, options);
      return buildCommon.makeSpan(["mord"], [smashedNode], options);
    },
    mathmlBuilder: (group, options) => {
      var node = new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)]);
      if (group.smashHeight) {
        node.setAttribute("height", "0px");
      }
      if (group.smashDepth) {
        node.setAttribute("depth", "0px");
      }
      return node;
    }
  });
  defineFunction({
    type: "sqrt",
    names: ["\\sqrt"],
    props: {
      numArgs: 1,
      numOptionalArgs: 1
    },
    handler(_ref, args, optArgs) {
      var {
        parser
      } = _ref;
      var index = optArgs[0];
      var body = args[0];
      return {
        type: "sqrt",
        mode: parser.mode,
        body,
        index
      };
    },
    htmlBuilder(group, options) {
      var inner2 = buildGroup$1(group.body, options.havingCrampedStyle());
      if (inner2.height === 0) {
        inner2.height = options.fontMetrics().xHeight;
      }
      inner2 = buildCommon.wrapFragment(inner2, options);
      var metrics = options.fontMetrics();
      var theta = metrics.defaultRuleThickness;
      var phi = theta;
      if (options.style.id < Style$1.TEXT.id) {
        phi = options.fontMetrics().xHeight;
      }
      var lineClearance = theta + phi / 4;
      var minDelimiterHeight = inner2.height + inner2.depth + lineClearance + theta;
      var {
        span: img,
        ruleWidth,
        advanceWidth
      } = delimiter.sqrtImage(minDelimiterHeight, options);
      var delimDepth = img.height - ruleWidth;
      if (delimDepth > inner2.height + inner2.depth + lineClearance) {
        lineClearance = (lineClearance + delimDepth - inner2.height - inner2.depth) / 2;
      }
      var imgShift = img.height - inner2.height - lineClearance - ruleWidth;
      inner2.style.paddingLeft = makeEm(advanceWidth);
      var body = buildCommon.makeVList({
        positionType: "firstBaseline",
        children: [{
          type: "elem",
          elem: inner2,
          wrapperClasses: ["svg-align"]
        }, {
          type: "kern",
          size: -(inner2.height + imgShift)
        }, {
          type: "elem",
          elem: img
        }, {
          type: "kern",
          size: ruleWidth
        }]
      }, options);
      if (!group.index) {
        return buildCommon.makeSpan(["mord", "sqrt"], [body], options);
      } else {
        var newOptions = options.havingStyle(Style$1.SCRIPTSCRIPT);
        var rootm = buildGroup$1(group.index, newOptions, options);
        var toShift = 0.6 * (body.height - body.depth);
        var rootVList = buildCommon.makeVList({
          positionType: "shift",
          positionData: -toShift,
          children: [{
            type: "elem",
            elem: rootm
          }]
        }, options);
        var rootVListWrap = buildCommon.makeSpan(["root"], [rootVList]);
        return buildCommon.makeSpan(["mord", "sqrt"], [rootVListWrap, body], options);
      }
    },
    mathmlBuilder(group, options) {
      var {
        body,
        index
      } = group;
      return index ? new mathMLTree.MathNode("mroot", [buildGroup2(body, options), buildGroup2(index, options)]) : new mathMLTree.MathNode("msqrt", [buildGroup2(body, options)]);
    }
  });
  var styleMap = {
    "display": Style$1.DISPLAY,
    "text": Style$1.TEXT,
    "script": Style$1.SCRIPT,
    "scriptscript": Style$1.SCRIPTSCRIPT
  };
  defineFunction({
    type: "styling",
    names: ["\\displaystyle", "\\textstyle", "\\scriptstyle", "\\scriptscriptstyle"],
    props: {
      numArgs: 0,
      allowedInText: true,
      primitive: true
    },
    handler(_ref, args) {
      var {
        breakOnTokenText,
        funcName,
        parser
      } = _ref;
      var body = parser.parseExpression(true, breakOnTokenText);
      var style = funcName.slice(1, funcName.length - 5);
      return {
        type: "styling",
        mode: parser.mode,
        // Figure out what style to use by pulling out the style from
        // the function name
        style,
        body
      };
    },
    htmlBuilder(group, options) {
      var newStyle = styleMap[group.style];
      var newOptions = options.havingStyle(newStyle).withFont("");
      return sizingGroup(group.body, newOptions, options);
    },
    mathmlBuilder(group, options) {
      var newStyle = styleMap[group.style];
      var newOptions = options.havingStyle(newStyle);
      var inner2 = buildExpression2(group.body, newOptions);
      var node = new mathMLTree.MathNode("mstyle", inner2);
      var styleAttributes = {
        "display": ["0", "true"],
        "text": ["0", "false"],
        "script": ["1", "false"],
        "scriptscript": ["2", "false"]
      };
      var attr = styleAttributes[group.style];
      node.setAttribute("scriptlevel", attr[0]);
      node.setAttribute("displaystyle", attr[1]);
      return node;
    }
  });
  var htmlBuilderDelegate = function htmlBuilderDelegate2(group, options) {
    var base = group.base;
    if (!base) {
      return null;
    } else if (base.type === "op") {
      var delegate = base.limits && (options.style.size === Style$1.DISPLAY.size || base.alwaysHandleSupSub);
      return delegate ? htmlBuilder$2 : null;
    } else if (base.type === "operatorname") {
      var _delegate = base.alwaysHandleSupSub && (options.style.size === Style$1.DISPLAY.size || base.limits);
      return _delegate ? htmlBuilder$1 : null;
    } else if (base.type === "accent") {
      return utils.isCharacterBox(base.base) ? htmlBuilder$a : null;
    } else if (base.type === "horizBrace") {
      var isSup = !group.sub;
      return isSup === base.isOver ? htmlBuilder$3 : null;
    } else {
      return null;
    }
  };
  defineFunctionBuilders({
    type: "supsub",
    htmlBuilder(group, options) {
      var builderDelegate = htmlBuilderDelegate(group, options);
      if (builderDelegate) {
        return builderDelegate(group, options);
      }
      var {
        base: valueBase,
        sup: valueSup,
        sub: valueSub
      } = group;
      var base = buildGroup$1(valueBase, options);
      var supm;
      var subm;
      var metrics = options.fontMetrics();
      var supShift = 0;
      var subShift = 0;
      var isCharacterBox3 = valueBase && utils.isCharacterBox(valueBase);
      if (valueSup) {
        var newOptions = options.havingStyle(options.style.sup());
        supm = buildGroup$1(valueSup, newOptions, options);
        if (!isCharacterBox3) {
          supShift = base.height - newOptions.fontMetrics().supDrop * newOptions.sizeMultiplier / options.sizeMultiplier;
        }
      }
      if (valueSub) {
        var _newOptions = options.havingStyle(options.style.sub());
        subm = buildGroup$1(valueSub, _newOptions, options);
        if (!isCharacterBox3) {
          subShift = base.depth + _newOptions.fontMetrics().subDrop * _newOptions.sizeMultiplier / options.sizeMultiplier;
        }
      }
      var minSupShift;
      if (options.style === Style$1.DISPLAY) {
        minSupShift = metrics.sup1;
      } else if (options.style.cramped) {
        minSupShift = metrics.sup3;
      } else {
        minSupShift = metrics.sup2;
      }
      var multiplier = options.sizeMultiplier;
      var marginRight = makeEm(0.5 / metrics.ptPerEm / multiplier);
      var marginLeft = null;
      if (subm) {
        var isOiint = group.base && group.base.type === "op" && group.base.name && (group.base.name === "\\oiint" || group.base.name === "\\oiiint");
        if (base instanceof SymbolNode || isOiint) {
          marginLeft = makeEm(-base.italic);
        }
      }
      var supsub;
      if (supm && subm) {
        supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
        subShift = Math.max(subShift, metrics.sub2);
        var ruleWidth = metrics.defaultRuleThickness;
        var maxWidth = 4 * ruleWidth;
        if (supShift - supm.depth - (subm.height - subShift) < maxWidth) {
          subShift = maxWidth - (supShift - supm.depth) + subm.height;
          var psi = 0.8 * metrics.xHeight - (supShift - supm.depth);
          if (psi > 0) {
            supShift += psi;
            subShift -= psi;
          }
        }
        var vlistElem = [{
          type: "elem",
          elem: subm,
          shift: subShift,
          marginRight,
          marginLeft
        }, {
          type: "elem",
          elem: supm,
          shift: -supShift,
          marginRight
        }];
        supsub = buildCommon.makeVList({
          positionType: "individualShift",
          children: vlistElem
        }, options);
      } else if (subm) {
        subShift = Math.max(subShift, metrics.sub1, subm.height - 0.8 * metrics.xHeight);
        var _vlistElem = [{
          type: "elem",
          elem: subm,
          marginLeft,
          marginRight
        }];
        supsub = buildCommon.makeVList({
          positionType: "shift",
          positionData: subShift,
          children: _vlistElem
        }, options);
      } else if (supm) {
        supShift = Math.max(supShift, minSupShift, supm.depth + 0.25 * metrics.xHeight);
        supsub = buildCommon.makeVList({
          positionType: "shift",
          positionData: -supShift,
          children: [{
            type: "elem",
            elem: supm,
            marginRight
          }]
        }, options);
      } else {
        throw new Error("supsub must have either sup or sub.");
      }
      var mclass = getTypeOfDomTree(base, "right") || "mord";
      return buildCommon.makeSpan([mclass], [base, buildCommon.makeSpan(["msupsub"], [supsub])], options);
    },
    mathmlBuilder(group, options) {
      var isBrace = false;
      var isOver;
      var isSup;
      if (group.base && group.base.type === "horizBrace") {
        isSup = !!group.sup;
        if (isSup === group.base.isOver) {
          isBrace = true;
          isOver = group.base.isOver;
        }
      }
      if (group.base && (group.base.type === "op" || group.base.type === "operatorname")) {
        group.base.parentIsSupSub = true;
      }
      var children = [buildGroup2(group.base, options)];
      if (group.sub) {
        children.push(buildGroup2(group.sub, options));
      }
      if (group.sup) {
        children.push(buildGroup2(group.sup, options));
      }
      var nodeType;
      if (isBrace) {
        nodeType = isOver ? "mover" : "munder";
      } else if (!group.sub) {
        var base = group.base;
        if (base && base.type === "op" && base.limits && (options.style === Style$1.DISPLAY || base.alwaysHandleSupSub)) {
          nodeType = "mover";
        } else if (base && base.type === "operatorname" && base.alwaysHandleSupSub && (base.limits || options.style === Style$1.DISPLAY)) {
          nodeType = "mover";
        } else {
          nodeType = "msup";
        }
      } else if (!group.sup) {
        var _base = group.base;
        if (_base && _base.type === "op" && _base.limits && (options.style === Style$1.DISPLAY || _base.alwaysHandleSupSub)) {
          nodeType = "munder";
        } else if (_base && _base.type === "operatorname" && _base.alwaysHandleSupSub && (_base.limits || options.style === Style$1.DISPLAY)) {
          nodeType = "munder";
        } else {
          nodeType = "msub";
        }
      } else {
        var _base2 = group.base;
        if (_base2 && _base2.type === "op" && _base2.limits && options.style === Style$1.DISPLAY) {
          nodeType = "munderover";
        } else if (_base2 && _base2.type === "operatorname" && _base2.alwaysHandleSupSub && (options.style === Style$1.DISPLAY || _base2.limits)) {
          nodeType = "munderover";
        } else {
          nodeType = "msubsup";
        }
      }
      return new mathMLTree.MathNode(nodeType, children);
    }
  });
  defineFunctionBuilders({
    type: "atom",
    htmlBuilder(group, options) {
      return buildCommon.mathsym(group.text, group.mode, options, ["m" + group.family]);
    },
    mathmlBuilder(group, options) {
      var node = new mathMLTree.MathNode("mo", [makeText(group.text, group.mode)]);
      if (group.family === "bin") {
        var variant = getVariant(group, options);
        if (variant === "bold-italic") {
          node.setAttribute("mathvariant", variant);
        }
      } else if (group.family === "punct") {
        node.setAttribute("separator", "true");
      } else if (group.family === "open" || group.family === "close") {
        node.setAttribute("stretchy", "false");
      }
      return node;
    }
  });
  var defaultVariant = {
    "mi": "italic",
    "mn": "normal",
    "mtext": "normal"
  };
  defineFunctionBuilders({
    type: "mathord",
    htmlBuilder(group, options) {
      return buildCommon.makeOrd(group, options, "mathord");
    },
    mathmlBuilder(group, options) {
      var node = new mathMLTree.MathNode("mi", [makeText(group.text, group.mode, options)]);
      var variant = getVariant(group, options) || "italic";
      if (variant !== defaultVariant[node.type]) {
        node.setAttribute("mathvariant", variant);
      }
      return node;
    }
  });
  defineFunctionBuilders({
    type: "textord",
    htmlBuilder(group, options) {
      return buildCommon.makeOrd(group, options, "textord");
    },
    mathmlBuilder(group, options) {
      var text2 = makeText(group.text, group.mode, options);
      var variant = getVariant(group, options) || "normal";
      var node;
      if (group.mode === "text") {
        node = new mathMLTree.MathNode("mtext", [text2]);
      } else if (/[0-9]/.test(group.text)) {
        node = new mathMLTree.MathNode("mn", [text2]);
      } else if (group.text === "\\prime") {
        node = new mathMLTree.MathNode("mo", [text2]);
      } else {
        node = new mathMLTree.MathNode("mi", [text2]);
      }
      if (variant !== defaultVariant[node.type]) {
        node.setAttribute("mathvariant", variant);
      }
      return node;
    }
  });
  var cssSpace = {
    "\\nobreak": "nobreak",
    "\\allowbreak": "allowbreak"
  };
  var regularSpace = {
    " ": {},
    "\\ ": {},
    "~": {
      className: "nobreak"
    },
    "\\space": {},
    "\\nobreakspace": {
      className: "nobreak"
    }
  };
  defineFunctionBuilders({
    type: "spacing",
    htmlBuilder(group, options) {
      if (regularSpace.hasOwnProperty(group.text)) {
        var className = regularSpace[group.text].className || "";
        if (group.mode === "text") {
          var ord = buildCommon.makeOrd(group, options, "textord");
          ord.classes.push(className);
          return ord;
        } else {
          return buildCommon.makeSpan(["mspace", className], [buildCommon.mathsym(group.text, group.mode, options)], options);
        }
      } else if (cssSpace.hasOwnProperty(group.text)) {
        return buildCommon.makeSpan(["mspace", cssSpace[group.text]], [], options);
      } else {
        throw new ParseError('Unknown type of space "' + group.text + '"');
      }
    },
    mathmlBuilder(group, options) {
      var node;
      if (regularSpace.hasOwnProperty(group.text)) {
        node = new mathMLTree.MathNode("mtext", [new mathMLTree.TextNode("\xA0")]);
      } else if (cssSpace.hasOwnProperty(group.text)) {
        return new mathMLTree.MathNode("mspace");
      } else {
        throw new ParseError('Unknown type of space "' + group.text + '"');
      }
      return node;
    }
  });
  var pad = () => {
    var padNode = new mathMLTree.MathNode("mtd", []);
    padNode.setAttribute("width", "50%");
    return padNode;
  };
  defineFunctionBuilders({
    type: "tag",
    mathmlBuilder(group, options) {
      var table = new mathMLTree.MathNode("mtable", [new mathMLTree.MathNode("mtr", [pad(), new mathMLTree.MathNode("mtd", [buildExpressionRow(group.body, options)]), pad(), new mathMLTree.MathNode("mtd", [buildExpressionRow(group.tag, options)])])]);
      table.setAttribute("width", "100%");
      return table;
    }
  });
  var textFontFamilies = {
    "\\text": void 0,
    "\\textrm": "textrm",
    "\\textsf": "textsf",
    "\\texttt": "texttt",
    "\\textnormal": "textrm"
  };
  var textFontWeights = {
    "\\textbf": "textbf",
    "\\textmd": "textmd"
  };
  var textFontShapes = {
    "\\textit": "textit",
    "\\textup": "textup"
  };
  var optionsWithFont = (group, options) => {
    var font = group.font;
    if (!font) {
      return options;
    } else if (textFontFamilies[font]) {
      return options.withTextFontFamily(textFontFamilies[font]);
    } else if (textFontWeights[font]) {
      return options.withTextFontWeight(textFontWeights[font]);
    } else if (font === "\\emph") {
      return options.fontShape === "textit" ? options.withTextFontShape("textup") : options.withTextFontShape("textit");
    }
    return options.withTextFontShape(textFontShapes[font]);
  };
  defineFunction({
    type: "text",
    names: [
      // Font families
      "\\text",
      "\\textrm",
      "\\textsf",
      "\\texttt",
      "\\textnormal",
      // Font weights
      "\\textbf",
      "\\textmd",
      // Font Shapes
      "\\textit",
      "\\textup",
      "\\emph"
    ],
    props: {
      numArgs: 1,
      argTypes: ["text"],
      allowedInArgument: true,
      allowedInText: true
    },
    handler(_ref, args) {
      var {
        parser,
        funcName
      } = _ref;
      var body = args[0];
      return {
        type: "text",
        mode: parser.mode,
        body: ordargument(body),
        font: funcName
      };
    },
    htmlBuilder(group, options) {
      var newOptions = optionsWithFont(group, options);
      var inner2 = buildExpression$1(group.body, newOptions, true);
      return buildCommon.makeSpan(["mord", "text"], inner2, newOptions);
    },
    mathmlBuilder(group, options) {
      var newOptions = optionsWithFont(group, options);
      return buildExpressionRow(group.body, newOptions);
    }
  });
  defineFunction({
    type: "underline",
    names: ["\\underline"],
    props: {
      numArgs: 1,
      allowedInText: true
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      return {
        type: "underline",
        mode: parser.mode,
        body: args[0]
      };
    },
    htmlBuilder(group, options) {
      var innerGroup = buildGroup$1(group.body, options);
      var line = buildCommon.makeLineSpan("underline-line", options);
      var defaultRuleThickness = options.fontMetrics().defaultRuleThickness;
      var vlist = buildCommon.makeVList({
        positionType: "top",
        positionData: innerGroup.height,
        children: [{
          type: "kern",
          size: defaultRuleThickness
        }, {
          type: "elem",
          elem: line
        }, {
          type: "kern",
          size: 3 * defaultRuleThickness
        }, {
          type: "elem",
          elem: innerGroup
        }]
      }, options);
      return buildCommon.makeSpan(["mord", "underline"], [vlist], options);
    },
    mathmlBuilder(group, options) {
      var operator = new mathMLTree.MathNode("mo", [new mathMLTree.TextNode("\u203E")]);
      operator.setAttribute("stretchy", "true");
      var node = new mathMLTree.MathNode("munder", [buildGroup2(group.body, options), operator]);
      node.setAttribute("accentunder", "true");
      return node;
    }
  });
  defineFunction({
    type: "vcenter",
    names: ["\\vcenter"],
    props: {
      numArgs: 1,
      argTypes: ["original"],
      // In LaTeX, \vcenter can act only on a box.
      allowedInText: false
    },
    handler(_ref, args) {
      var {
        parser
      } = _ref;
      return {
        type: "vcenter",
        mode: parser.mode,
        body: args[0]
      };
    },
    htmlBuilder(group, options) {
      var body = buildGroup$1(group.body, options);
      var axisHeight = options.fontMetrics().axisHeight;
      var dy = 0.5 * (body.height - axisHeight - (body.depth + axisHeight));
      return buildCommon.makeVList({
        positionType: "shift",
        positionData: dy,
        children: [{
          type: "elem",
          elem: body
        }]
      }, options);
    },
    mathmlBuilder(group, options) {
      return new mathMLTree.MathNode("mpadded", [buildGroup2(group.body, options)], ["vcenter"]);
    }
  });
  defineFunction({
    type: "verb",
    names: ["\\verb"],
    props: {
      numArgs: 0,
      allowedInText: true
    },
    handler(context, args, optArgs) {
      throw new ParseError("\\verb ended by end of line instead of matching delimiter");
    },
    htmlBuilder(group, options) {
      var text2 = makeVerb(group);
      var body = [];
      var newOptions = options.havingStyle(options.style.text());
      for (var i = 0; i < text2.length; i++) {
        var c = text2[i];
        if (c === "~") {
          c = "\\textasciitilde";
        }
        body.push(buildCommon.makeSymbol(c, "Typewriter-Regular", group.mode, newOptions, ["mord", "texttt"]));
      }
      return buildCommon.makeSpan(["mord", "text"].concat(newOptions.sizingClasses(options)), buildCommon.tryCombineChars(body), newOptions);
    },
    mathmlBuilder(group, options) {
      var text2 = new mathMLTree.TextNode(makeVerb(group));
      var node = new mathMLTree.MathNode("mtext", [text2]);
      node.setAttribute("mathvariant", "monospace");
      return node;
    }
  });
  var makeVerb = (group) => group.body.replace(/ /g, group.star ? "\u2423" : "\xA0");
  var functions = _functions;
  var spaceRegexString = "[ \r\n	]";
  var controlWordRegexString = "\\\\[a-zA-Z@]+";
  var controlSymbolRegexString = "\\\\[^\uD800-\uDFFF]";
  var controlWordWhitespaceRegexString = "(" + controlWordRegexString + ")" + spaceRegexString + "*";
  var controlSpaceRegexString = "\\\\(\n|[ \r	]+\n?)[ \r	]*";
  var combiningDiacriticalMarkString = "[\u0300-\u036F]";
  var combiningDiacriticalMarksEndRegex = new RegExp(combiningDiacriticalMarkString + "+$");
  var tokenRegexString = "(" + spaceRegexString + "+)|" + // whitespace
  (controlSpaceRegexString + "|") + // \whitespace
  "([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]" + // single codepoint
  (combiningDiacriticalMarkString + "*") + // ...plus accents
  "|[\uD800-\uDBFF][\uDC00-\uDFFF]" + // surrogate pair
  (combiningDiacriticalMarkString + "*") + // ...plus accents
  "|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5" + // \verb unstarred
  ("|" + controlWordWhitespaceRegexString) + // \macroName + spaces
  ("|" + controlSymbolRegexString + ")");
  var Lexer = class {
    // Category codes. The lexer only supports comment characters (14) for now.
    // MacroExpander additionally distinguishes active (13).
    constructor(input, settings) {
      this.input = void 0;
      this.settings = void 0;
      this.tokenRegex = void 0;
      this.catcodes = void 0;
      this.input = input;
      this.settings = settings;
      this.tokenRegex = new RegExp(tokenRegexString, "g");
      this.catcodes = {
        "%": 14,
        // comment character
        "~": 13
        // active character
      };
    }
    setCatcode(char, code) {
      this.catcodes[char] = code;
    }
    /**
     * This function lexes a single token.
     */
    lex() {
      var input = this.input;
      var pos = this.tokenRegex.lastIndex;
      if (pos === input.length) {
        return new Token("EOF", new SourceLocation(this, pos, pos));
      }
      var match = this.tokenRegex.exec(input);
      if (match === null || match.index !== pos) {
        throw new ParseError("Unexpected character: '" + input[pos] + "'", new Token(input[pos], new SourceLocation(this, pos, pos + 1)));
      }
      var text2 = match[6] || match[3] || (match[2] ? "\\ " : " ");
      if (this.catcodes[text2] === 14) {
        var nlIndex = input.indexOf("\n", this.tokenRegex.lastIndex);
        if (nlIndex === -1) {
          this.tokenRegex.lastIndex = input.length;
          this.settings.reportNonstrict("commentAtEnd", "% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)");
        } else {
          this.tokenRegex.lastIndex = nlIndex + 1;
        }
        return this.lex();
      }
      return new Token(text2, new SourceLocation(this, pos, this.tokenRegex.lastIndex));
    }
  };
  var Namespace = class {
    /**
     * Both arguments are optional.  The first argument is an object of
     * built-in mappings which never change.  The second argument is an object
     * of initial (global-level) mappings, which will constantly change
     * according to any global/top-level `set`s done.
     */
    constructor(builtins, globalMacros) {
      if (builtins === void 0) {
        builtins = {};
      }
      if (globalMacros === void 0) {
        globalMacros = {};
      }
      this.current = void 0;
      this.builtins = void 0;
      this.undefStack = void 0;
      this.current = globalMacros;
      this.builtins = builtins;
      this.undefStack = [];
    }
    /**
     * Start a new nested group, affecting future local `set`s.
     */
    beginGroup() {
      this.undefStack.push({});
    }
    /**
     * End current nested group, restoring values before the group began.
     */
    endGroup() {
      if (this.undefStack.length === 0) {
        throw new ParseError("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");
      }
      var undefs = this.undefStack.pop();
      for (var undef in undefs) {
        if (undefs.hasOwnProperty(undef)) {
          if (undefs[undef] == null) {
            delete this.current[undef];
          } else {
            this.current[undef] = undefs[undef];
          }
        }
      }
    }
    /**
     * Ends all currently nested groups (if any), restoring values before the
     * groups began.  Useful in case of an error in the middle of parsing.
     */
    endGroups() {
      while (this.undefStack.length > 0) {
        this.endGroup();
      }
    }
    /**
     * Detect whether `name` has a definition.  Equivalent to
     * `get(name) != null`.
     */
    has(name) {
      return this.current.hasOwnProperty(name) || this.builtins.hasOwnProperty(name);
    }
    /**
     * Get the current value of a name, or `undefined` if there is no value.
     *
     * Note: Do not use `if (namespace.get(...))` to detect whether a macro
     * is defined, as the definition may be the empty string which evaluates
     * to `false` in JavaScript.  Use `if (namespace.get(...) != null)` or
     * `if (namespace.has(...))`.
     */
    get(name) {
      if (this.current.hasOwnProperty(name)) {
        return this.current[name];
      } else {
        return this.builtins[name];
      }
    }
    /**
     * Set the current value of a name, and optionally set it globally too.
     * Local set() sets the current value and (when appropriate) adds an undo
     * operation to the undo stack.  Global set() may change the undo
     * operation at every level, so takes time linear in their number.
     * A value of undefined means to delete existing definitions.
     */
    set(name, value, global) {
      if (global === void 0) {
        global = false;
      }
      if (global) {
        for (var i = 0; i < this.undefStack.length; i++) {
          delete this.undefStack[i][name];
        }
        if (this.undefStack.length > 0) {
          this.undefStack[this.undefStack.length - 1][name] = value;
        }
      } else {
        var top = this.undefStack[this.undefStack.length - 1];
        if (top && !top.hasOwnProperty(name)) {
          top[name] = this.current[name];
        }
      }
      if (value == null) {
        delete this.current[name];
      } else {
        this.current[name] = value;
      }
    }
  };
  var macros = _macros;
  defineMacro("\\noexpand", function(context) {
    var t = context.popToken();
    if (context.isExpandable(t.text)) {
      t.noexpand = true;
      t.treatAsRelax = true;
    }
    return {
      tokens: [t],
      numArgs: 0
    };
  });
  defineMacro("\\expandafter", function(context) {
    var t = context.popToken();
    context.expandOnce(true);
    return {
      tokens: [t],
      numArgs: 0
    };
  });
  defineMacro("\\@firstoftwo", function(context) {
    var args = context.consumeArgs(2);
    return {
      tokens: args[0],
      numArgs: 0
    };
  });
  defineMacro("\\@secondoftwo", function(context) {
    var args = context.consumeArgs(2);
    return {
      tokens: args[1],
      numArgs: 0
    };
  });
  defineMacro("\\@ifnextchar", function(context) {
    var args = context.consumeArgs(3);
    context.consumeSpaces();
    var nextToken = context.future();
    if (args[0].length === 1 && args[0][0].text === nextToken.text) {
      return {
        tokens: args[1],
        numArgs: 0
      };
    } else {
      return {
        tokens: args[2],
        numArgs: 0
      };
    }
  });
  defineMacro("\\@ifstar", "\\@ifnextchar *{\\@firstoftwo{#1}}");
  defineMacro("\\TextOrMath", function(context) {
    var args = context.consumeArgs(2);
    if (context.mode === "text") {
      return {
        tokens: args[0],
        numArgs: 0
      };
    } else {
      return {
        tokens: args[1],
        numArgs: 0
      };
    }
  });
  var digitToNumber = {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "a": 10,
    "A": 10,
    "b": 11,
    "B": 11,
    "c": 12,
    "C": 12,
    "d": 13,
    "D": 13,
    "e": 14,
    "E": 14,
    "f": 15,
    "F": 15
  };
  defineMacro("\\char", function(context) {
    var token = context.popToken();
    var base;
    var number = "";
    if (token.text === "'") {
      base = 8;
      token = context.popToken();
    } else if (token.text === '"') {
      base = 16;
      token = context.popToken();
    } else if (token.text === "`") {
      token = context.popToken();
      if (token.text[0] === "\\") {
        number = token.text.charCodeAt(1);
      } else if (token.text === "EOF") {
        throw new ParseError("\\char` missing argument");
      } else {
        number = token.text.charCodeAt(0);
      }
    } else {
      base = 10;
    }
    if (base) {
      number = digitToNumber[token.text];
      if (number == null || number >= base) {
        throw new ParseError("Invalid base-" + base + " digit " + token.text);
      }
      var digit;
      while ((digit = digitToNumber[context.future().text]) != null && digit < base) {
        number *= base;
        number += digit;
        context.popToken();
      }
    }
    return "\\@char{" + number + "}";
  });
  var newcommand = (context, existsOK, nonexistsOK, skipIfExists) => {
    var arg = context.consumeArg().tokens;
    if (arg.length !== 1) {
      throw new ParseError("\\newcommand's first argument must be a macro name");
    }
    var name = arg[0].text;
    var exists = context.isDefined(name);
    if (exists && !existsOK) {
      throw new ParseError("\\newcommand{" + name + "} attempting to redefine " + (name + "; use \\renewcommand"));
    }
    if (!exists && !nonexistsOK) {
      throw new ParseError("\\renewcommand{" + name + "} when command " + name + " does not yet exist; use \\newcommand");
    }
    var numArgs = 0;
    arg = context.consumeArg().tokens;
    if (arg.length === 1 && arg[0].text === "[") {
      var argText = "";
      var token = context.expandNextToken();
      while (token.text !== "]" && token.text !== "EOF") {
        argText += token.text;
        token = context.expandNextToken();
      }
      if (!argText.match(/^\s*[0-9]+\s*$/)) {
        throw new ParseError("Invalid number of arguments: " + argText);
      }
      numArgs = parseInt(argText);
      arg = context.consumeArg().tokens;
    }
    if (!(exists && skipIfExists)) {
      context.macros.set(name, {
        tokens: arg,
        numArgs
      });
    }
    return "";
  };
  defineMacro("\\newcommand", (context) => newcommand(context, false, true, false));
  defineMacro("\\renewcommand", (context) => newcommand(context, true, false, false));
  defineMacro("\\providecommand", (context) => newcommand(context, true, true, true));
  defineMacro("\\message", (context) => {
    var arg = context.consumeArgs(1)[0];
    console.log(arg.reverse().map((token) => token.text).join(""));
    return "";
  });
  defineMacro("\\errmessage", (context) => {
    var arg = context.consumeArgs(1)[0];
    console.error(arg.reverse().map((token) => token.text).join(""));
    return "";
  });
  defineMacro("\\show", (context) => {
    var tok = context.popToken();
    var name = tok.text;
    console.log(tok, context.macros.get(name), functions[name], symbols.math[name], symbols.text[name]);
    return "";
  });
  defineMacro("\\bgroup", "{");
  defineMacro("\\egroup", "}");
  defineMacro("~", "\\nobreakspace");
  defineMacro("\\lq", "`");
  defineMacro("\\rq", "'");
  defineMacro("\\aa", "\\r a");
  defineMacro("\\AA", "\\r A");
  defineMacro("\\textcopyright", "\\html@mathml{\\textcircled{c}}{\\char`\xA9}");
  defineMacro("\\copyright", "\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");
  defineMacro("\\textregistered", "\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`\xAE}");
  defineMacro("\u212C", "\\mathscr{B}");
  defineMacro("\u2130", "\\mathscr{E}");
  defineMacro("\u2131", "\\mathscr{F}");
  defineMacro("\u210B", "\\mathscr{H}");
  defineMacro("\u2110", "\\mathscr{I}");
  defineMacro("\u2112", "\\mathscr{L}");
  defineMacro("\u2133", "\\mathscr{M}");
  defineMacro("\u211B", "\\mathscr{R}");
  defineMacro("\u212D", "\\mathfrak{C}");
  defineMacro("\u210C", "\\mathfrak{H}");
  defineMacro("\u2128", "\\mathfrak{Z}");
  defineMacro("\\Bbbk", "\\Bbb{k}");
  defineMacro("\xB7", "\\cdotp");
  defineMacro("\\llap", "\\mathllap{\\textrm{#1}}");
  defineMacro("\\rlap", "\\mathrlap{\\textrm{#1}}");
  defineMacro("\\clap", "\\mathclap{\\textrm{#1}}");
  defineMacro("\\mathstrut", "\\vphantom{(}");
  defineMacro("\\underbar", "\\underline{\\text{#1}}");
  defineMacro("\\not", '\\html@mathml{\\mathrel{\\mathrlap\\@not}}{\\char"338}');
  defineMacro("\\neq", "\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`\u2260}}");
  defineMacro("\\ne", "\\neq");
  defineMacro("\u2260", "\\neq");
  defineMacro("\\notin", "\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}{\\mathrel{\\char`\u2209}}");
  defineMacro("\u2209", "\\notin");
  defineMacro("\u2258", "\\html@mathml{\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}}{\\mathrel{\\char`\u2258}}");
  defineMacro("\u2259", "\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`\u2258}}");
  defineMacro("\u225A", "\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`\u225A}}");
  defineMacro("\u225B", "\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}{\\mathrel{\\char`\u225B}}");
  defineMacro("\u225D", "\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}{\\mathrel{\\char`\u225D}}");
  defineMacro("\u225E", "\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}{\\mathrel{\\char`\u225E}}");
  defineMacro("\u225F", "\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`\u225F}}");
  defineMacro("\u27C2", "\\perp");
  defineMacro("\u203C", "\\mathclose{!\\mkern-0.8mu!}");
  defineMacro("\u220C", "\\notni");
  defineMacro("\u231C", "\\ulcorner");
  defineMacro("\u231D", "\\urcorner");
  defineMacro("\u231E", "\\llcorner");
  defineMacro("\u231F", "\\lrcorner");
  defineMacro("\xA9", "\\copyright");
  defineMacro("\xAE", "\\textregistered");
  defineMacro("\uFE0F", "\\textregistered");
  defineMacro("\\ulcorner", '\\html@mathml{\\@ulcorner}{\\mathop{\\char"231c}}');
  defineMacro("\\urcorner", '\\html@mathml{\\@urcorner}{\\mathop{\\char"231d}}');
  defineMacro("\\llcorner", '\\html@mathml{\\@llcorner}{\\mathop{\\char"231e}}');
  defineMacro("\\lrcorner", '\\html@mathml{\\@lrcorner}{\\mathop{\\char"231f}}');
  defineMacro("\\vdots", "{\\varvdots\\rule{0pt}{15pt}}");
  defineMacro("\u22EE", "\\vdots");
  defineMacro("\\varGamma", "\\mathit{\\Gamma}");
  defineMacro("\\varDelta", "\\mathit{\\Delta}");
  defineMacro("\\varTheta", "\\mathit{\\Theta}");
  defineMacro("\\varLambda", "\\mathit{\\Lambda}");
  defineMacro("\\varXi", "\\mathit{\\Xi}");
  defineMacro("\\varPi", "\\mathit{\\Pi}");
  defineMacro("\\varSigma", "\\mathit{\\Sigma}");
  defineMacro("\\varUpsilon", "\\mathit{\\Upsilon}");
  defineMacro("\\varPhi", "\\mathit{\\Phi}");
  defineMacro("\\varPsi", "\\mathit{\\Psi}");
  defineMacro("\\varOmega", "\\mathit{\\Omega}");
  defineMacro("\\substack", "\\begin{subarray}{c}#1\\end{subarray}");
  defineMacro("\\colon", "\\nobreak\\mskip2mu\\mathpunct{}\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax");
  defineMacro("\\boxed", "\\fbox{$\\displaystyle{#1}$}");
  defineMacro("\\iff", "\\DOTSB\\;\\Longleftrightarrow\\;");
  defineMacro("\\implies", "\\DOTSB\\;\\Longrightarrow\\;");
  defineMacro("\\impliedby", "\\DOTSB\\;\\Longleftarrow\\;");
  defineMacro("\\dddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ...}}{#1}}");
  defineMacro("\\ddddot", "{\\overset{\\raisebox{-0.1ex}{\\normalsize ....}}{#1}}");
  var dotsByToken = {
    ",": "\\dotsc",
    "\\not": "\\dotsb",
    // \keybin@ checks for the following:
    "+": "\\dotsb",
    "=": "\\dotsb",
    "<": "\\dotsb",
    ">": "\\dotsb",
    "-": "\\dotsb",
    "*": "\\dotsb",
    ":": "\\dotsb",
    // Symbols whose definition starts with \DOTSB:
    "\\DOTSB": "\\dotsb",
    "\\coprod": "\\dotsb",
    "\\bigvee": "\\dotsb",
    "\\bigwedge": "\\dotsb",
    "\\biguplus": "\\dotsb",
    "\\bigcap": "\\dotsb",
    "\\bigcup": "\\dotsb",
    "\\prod": "\\dotsb",
    "\\sum": "\\dotsb",
    "\\bigotimes": "\\dotsb",
    "\\bigoplus": "\\dotsb",
    "\\bigodot": "\\dotsb",
    "\\bigsqcup": "\\dotsb",
    "\\And": "\\dotsb",
    "\\longrightarrow": "\\dotsb",
    "\\Longrightarrow": "\\dotsb",
    "\\longleftarrow": "\\dotsb",
    "\\Longleftarrow": "\\dotsb",
    "\\longleftrightarrow": "\\dotsb",
    "\\Longleftrightarrow": "\\dotsb",
    "\\mapsto": "\\dotsb",
    "\\longmapsto": "\\dotsb",
    "\\hookrightarrow": "\\dotsb",
    "\\doteq": "\\dotsb",
    // Symbols whose definition starts with \mathbin:
    "\\mathbin": "\\dotsb",
    // Symbols whose definition starts with \mathrel:
    "\\mathrel": "\\dotsb",
    "\\relbar": "\\dotsb",
    "\\Relbar": "\\dotsb",
    "\\xrightarrow": "\\dotsb",
    "\\xleftarrow": "\\dotsb",
    // Symbols whose definition starts with \DOTSI:
    "\\DOTSI": "\\dotsi",
    "\\int": "\\dotsi",
    "\\oint": "\\dotsi",
    "\\iint": "\\dotsi",
    "\\iiint": "\\dotsi",
    "\\iiiint": "\\dotsi",
    "\\idotsint": "\\dotsi",
    // Symbols whose definition starts with \DOTSX:
    "\\DOTSX": "\\dotsx"
  };
  defineMacro("\\dots", function(context) {
    var thedots = "\\dotso";
    var next = context.expandAfterFuture().text;
    if (next in dotsByToken) {
      thedots = dotsByToken[next];
    } else if (next.slice(0, 4) === "\\not") {
      thedots = "\\dotsb";
    } else if (next in symbols.math) {
      if (["bin", "rel"].includes(symbols.math[next].group)) {
        thedots = "\\dotsb";
      }
    }
    return thedots;
  });
  var spaceAfterDots = {
    // \rightdelim@ checks for the following:
    ")": true,
    "]": true,
    "\\rbrack": true,
    "\\}": true,
    "\\rbrace": true,
    "\\rangle": true,
    "\\rceil": true,
    "\\rfloor": true,
    "\\rgroup": true,
    "\\rmoustache": true,
    "\\right": true,
    "\\bigr": true,
    "\\biggr": true,
    "\\Bigr": true,
    "\\Biggr": true,
    // \extra@ also tests for the following:
    "$": true,
    // \extrap@ checks for the following:
    ";": true,
    ".": true,
    ",": true
  };
  defineMacro("\\dotso", function(context) {
    var next = context.future().text;
    if (next in spaceAfterDots) {
      return "\\ldots\\,";
    } else {
      return "\\ldots";
    }
  });
  defineMacro("\\dotsc", function(context) {
    var next = context.future().text;
    if (next in spaceAfterDots && next !== ",") {
      return "\\ldots\\,";
    } else {
      return "\\ldots";
    }
  });
  defineMacro("\\cdots", function(context) {
    var next = context.future().text;
    if (next in spaceAfterDots) {
      return "\\@cdots\\,";
    } else {
      return "\\@cdots";
    }
  });
  defineMacro("\\dotsb", "\\cdots");
  defineMacro("\\dotsm", "\\cdots");
  defineMacro("\\dotsi", "\\!\\cdots");
  defineMacro("\\dotsx", "\\ldots\\,");
  defineMacro("\\DOTSI", "\\relax");
  defineMacro("\\DOTSB", "\\relax");
  defineMacro("\\DOTSX", "\\relax");
  defineMacro("\\tmspace", "\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax");
  defineMacro("\\,", "\\tmspace+{3mu}{.1667em}");
  defineMacro("\\thinspace", "\\,");
  defineMacro("\\>", "\\mskip{4mu}");
  defineMacro("\\:", "\\tmspace+{4mu}{.2222em}");
  defineMacro("\\medspace", "\\:");
  defineMacro("\\;", "\\tmspace+{5mu}{.2777em}");
  defineMacro("\\thickspace", "\\;");
  defineMacro("\\!", "\\tmspace-{3mu}{.1667em}");
  defineMacro("\\negthinspace", "\\!");
  defineMacro("\\negmedspace", "\\tmspace-{4mu}{.2222em}");
  defineMacro("\\negthickspace", "\\tmspace-{5mu}{.277em}");
  defineMacro("\\enspace", "\\kern.5em ");
  defineMacro("\\enskip", "\\hskip.5em\\relax");
  defineMacro("\\quad", "\\hskip1em\\relax");
  defineMacro("\\qquad", "\\hskip2em\\relax");
  defineMacro("\\tag", "\\@ifstar\\tag@literal\\tag@paren");
  defineMacro("\\tag@paren", "\\tag@literal{({#1})}");
  defineMacro("\\tag@literal", (context) => {
    if (context.macros.get("\\df@tag")) {
      throw new ParseError("Multiple \\tag");
    }
    return "\\gdef\\df@tag{\\text{#1}}";
  });
  defineMacro("\\bmod", "\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");
  defineMacro("\\pod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");
  defineMacro("\\pmod", "\\pod{{\\rm mod}\\mkern6mu#1}");
  defineMacro("\\mod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1");
  defineMacro("\\newline", "\\\\\\relax");
  defineMacro("\\TeX", "\\textrm{\\html@mathml{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}{TeX}}");
  var latexRaiseA = makeEm(fontMetricsData["Main-Regular"]["T".charCodeAt(0)][1] - 0.7 * fontMetricsData["Main-Regular"]["A".charCodeAt(0)][1]);
  defineMacro("\\LaTeX", "\\textrm{\\html@mathml{" + ("L\\kern-.36em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{LaTeX}}");
  defineMacro("\\KaTeX", "\\textrm{\\html@mathml{" + ("K\\kern-.17em\\raisebox{" + latexRaiseA + "}{\\scriptstyle A}") + "\\kern-.15em\\TeX}{KaTeX}}");
  defineMacro("\\hspace", "\\@ifstar\\@hspacer\\@hspace");
  defineMacro("\\@hspace", "\\hskip #1\\relax");
  defineMacro("\\@hspacer", "\\rule{0pt}{0pt}\\hskip #1\\relax");
  defineMacro("\\ordinarycolon", ":");
  defineMacro("\\vcentcolon", "\\mathrel{\\mathop\\ordinarycolon}");
  defineMacro("\\dblcolon", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}{\\mathop{\\char"2237}}');
  defineMacro("\\coloneqq", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2254}}');
  defineMacro("\\Coloneqq", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2237\\char"3d}}');
  defineMacro("\\coloneq", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"3a\\char"2212}}');
  defineMacro("\\Coloneq", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"2237\\char"2212}}');
  defineMacro("\\eqqcolon", '\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2255}}');
  defineMacro("\\Eqqcolon", '\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"3d\\char"2237}}');
  defineMacro("\\eqcolon", '\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2239}}');
  defineMacro("\\Eqcolon", '\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"2212\\char"2237}}');
  defineMacro("\\colonapprox", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"3a\\char"2248}}');
  defineMacro("\\Colonapprox", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"2237\\char"2248}}');
  defineMacro("\\colonsim", '\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"3a\\char"223c}}');
  defineMacro("\\Colonsim", '\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"2237\\char"223c}}');
  defineMacro("\u2237", "\\dblcolon");
  defineMacro("\u2239", "\\eqcolon");
  defineMacro("\u2254", "\\coloneqq");
  defineMacro("\u2255", "\\eqqcolon");
  defineMacro("\u2A74", "\\Coloneqq");
  defineMacro("\\ratio", "\\vcentcolon");
  defineMacro("\\coloncolon", "\\dblcolon");
  defineMacro("\\colonequals", "\\coloneqq");
  defineMacro("\\coloncolonequals", "\\Coloneqq");
  defineMacro("\\equalscolon", "\\eqqcolon");
  defineMacro("\\equalscoloncolon", "\\Eqqcolon");
  defineMacro("\\colonminus", "\\coloneq");
  defineMacro("\\coloncolonminus", "\\Coloneq");
  defineMacro("\\minuscolon", "\\eqcolon");
  defineMacro("\\minuscoloncolon", "\\Eqcolon");
  defineMacro("\\coloncolonapprox", "\\Colonapprox");
  defineMacro("\\coloncolonsim", "\\Colonsim");
  defineMacro("\\simcolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
  defineMacro("\\simcoloncolon", "\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");
  defineMacro("\\approxcolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");
  defineMacro("\\approxcoloncolon", "\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}");
  defineMacro("\\notni", "\\html@mathml{\\not\\ni}{\\mathrel{\\char`\u220C}}");
  defineMacro("\\limsup", "\\DOTSB\\operatorname*{lim\\,sup}");
  defineMacro("\\liminf", "\\DOTSB\\operatorname*{lim\\,inf}");
  defineMacro("\\injlim", "\\DOTSB\\operatorname*{inj\\,lim}");
  defineMacro("\\projlim", "\\DOTSB\\operatorname*{proj\\,lim}");
  defineMacro("\\varlimsup", "\\DOTSB\\operatorname*{\\overline{lim}}");
  defineMacro("\\varliminf", "\\DOTSB\\operatorname*{\\underline{lim}}");
  defineMacro("\\varinjlim", "\\DOTSB\\operatorname*{\\underrightarrow{lim}}");
  defineMacro("\\varprojlim", "\\DOTSB\\operatorname*{\\underleftarrow{lim}}");
  defineMacro("\\gvertneqq", "\\html@mathml{\\@gvertneqq}{\u2269}");
  defineMacro("\\lvertneqq", "\\html@mathml{\\@lvertneqq}{\u2268}");
  defineMacro("\\ngeqq", "\\html@mathml{\\@ngeqq}{\u2271}");
  defineMacro("\\ngeqslant", "\\html@mathml{\\@ngeqslant}{\u2271}");
  defineMacro("\\nleqq", "\\html@mathml{\\@nleqq}{\u2270}");
  defineMacro("\\nleqslant", "\\html@mathml{\\@nleqslant}{\u2270}");
  defineMacro("\\nshortmid", "\\html@mathml{\\@nshortmid}{\u2224}");
  defineMacro("\\nshortparallel", "\\html@mathml{\\@nshortparallel}{\u2226}");
  defineMacro("\\nsubseteqq", "\\html@mathml{\\@nsubseteqq}{\u2288}");
  defineMacro("\\nsupseteqq", "\\html@mathml{\\@nsupseteqq}{\u2289}");
  defineMacro("\\varsubsetneq", "\\html@mathml{\\@varsubsetneq}{\u228A}");
  defineMacro("\\varsubsetneqq", "\\html@mathml{\\@varsubsetneqq}{\u2ACB}");
  defineMacro("\\varsupsetneq", "\\html@mathml{\\@varsupsetneq}{\u228B}");
  defineMacro("\\varsupsetneqq", "\\html@mathml{\\@varsupsetneqq}{\u2ACC}");
  defineMacro("\\imath", "\\html@mathml{\\@imath}{\u0131}");
  defineMacro("\\jmath", "\\html@mathml{\\@jmath}{\u0237}");
  defineMacro("\\llbracket", "\\html@mathml{\\mathopen{[\\mkern-3.2mu[}}{\\mathopen{\\char`\u27E6}}");
  defineMacro("\\rrbracket", "\\html@mathml{\\mathclose{]\\mkern-3.2mu]}}{\\mathclose{\\char`\u27E7}}");
  defineMacro("\u27E6", "\\llbracket");
  defineMacro("\u27E7", "\\rrbracket");
  defineMacro("\\lBrace", "\\html@mathml{\\mathopen{\\{\\mkern-3.2mu[}}{\\mathopen{\\char`\u2983}}");
  defineMacro("\\rBrace", "\\html@mathml{\\mathclose{]\\mkern-3.2mu\\}}}{\\mathclose{\\char`\u2984}}");
  defineMacro("\u2983", "\\lBrace");
  defineMacro("\u2984", "\\rBrace");
  defineMacro("\\minuso", "\\mathbin{\\html@mathml{{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}{\\char`\u29B5}}");
  defineMacro("\u29B5", "\\minuso");
  defineMacro("\\darr", "\\downarrow");
  defineMacro("\\dArr", "\\Downarrow");
  defineMacro("\\Darr", "\\Downarrow");
  defineMacro("\\lang", "\\langle");
  defineMacro("\\rang", "\\rangle");
  defineMacro("\\uarr", "\\uparrow");
  defineMacro("\\uArr", "\\Uparrow");
  defineMacro("\\Uarr", "\\Uparrow");
  defineMacro("\\N", "\\mathbb{N}");
  defineMacro("\\R", "\\mathbb{R}");
  defineMacro("\\Z", "\\mathbb{Z}");
  defineMacro("\\alef", "\\aleph");
  defineMacro("\\alefsym", "\\aleph");
  defineMacro("\\Alpha", "\\mathrm{A}");
  defineMacro("\\Beta", "\\mathrm{B}");
  defineMacro("\\bull", "\\bullet");
  defineMacro("\\Chi", "\\mathrm{X}");
  defineMacro("\\clubs", "\\clubsuit");
  defineMacro("\\cnums", "\\mathbb{C}");
  defineMacro("\\Complex", "\\mathbb{C}");
  defineMacro("\\Dagger", "\\ddagger");
  defineMacro("\\diamonds", "\\diamondsuit");
  defineMacro("\\empty", "\\emptyset");
  defineMacro("\\Epsilon", "\\mathrm{E}");
  defineMacro("\\Eta", "\\mathrm{H}");
  defineMacro("\\exist", "\\exists");
  defineMacro("\\harr", "\\leftrightarrow");
  defineMacro("\\hArr", "\\Leftrightarrow");
  defineMacro("\\Harr", "\\Leftrightarrow");
  defineMacro("\\hearts", "\\heartsuit");
  defineMacro("\\image", "\\Im");
  defineMacro("\\infin", "\\infty");
  defineMacro("\\Iota", "\\mathrm{I}");
  defineMacro("\\isin", "\\in");
  defineMacro("\\Kappa", "\\mathrm{K}");
  defineMacro("\\larr", "\\leftarrow");
  defineMacro("\\lArr", "\\Leftarrow");
  defineMacro("\\Larr", "\\Leftarrow");
  defineMacro("\\lrarr", "\\leftrightarrow");
  defineMacro("\\lrArr", "\\Leftrightarrow");
  defineMacro("\\Lrarr", "\\Leftrightarrow");
  defineMacro("\\Mu", "\\mathrm{M}");
  defineMacro("\\natnums", "\\mathbb{N}");
  defineMacro("\\Nu", "\\mathrm{N}");
  defineMacro("\\Omicron", "\\mathrm{O}");
  defineMacro("\\plusmn", "\\pm");
  defineMacro("\\rarr", "\\rightarrow");
  defineMacro("\\rArr", "\\Rightarrow");
  defineMacro("\\Rarr", "\\Rightarrow");
  defineMacro("\\real", "\\Re");
  defineMacro("\\reals", "\\mathbb{R}");
  defineMacro("\\Reals", "\\mathbb{R}");
  defineMacro("\\Rho", "\\mathrm{P}");
  defineMacro("\\sdot", "\\cdot");
  defineMacro("\\sect", "\\S");
  defineMacro("\\spades", "\\spadesuit");
  defineMacro("\\sub", "\\subset");
  defineMacro("\\sube", "\\subseteq");
  defineMacro("\\supe", "\\supseteq");
  defineMacro("\\Tau", "\\mathrm{T}");
  defineMacro("\\thetasym", "\\vartheta");
  defineMacro("\\weierp", "\\wp");
  defineMacro("\\Zeta", "\\mathrm{Z}");
  defineMacro("\\argmin", "\\DOTSB\\operatorname*{arg\\,min}");
  defineMacro("\\argmax", "\\DOTSB\\operatorname*{arg\\,max}");
  defineMacro("\\plim", "\\DOTSB\\mathop{\\operatorname{plim}}\\limits");
  defineMacro("\\bra", "\\mathinner{\\langle{#1}|}");
  defineMacro("\\ket", "\\mathinner{|{#1}\\rangle}");
  defineMacro("\\braket", "\\mathinner{\\langle{#1}\\rangle}");
  defineMacro("\\Bra", "\\left\\langle#1\\right|");
  defineMacro("\\Ket", "\\left|#1\\right\\rangle");
  var braketHelper = (one) => (context) => {
    var left = context.consumeArg().tokens;
    var middle = context.consumeArg().tokens;
    var middleDouble = context.consumeArg().tokens;
    var right = context.consumeArg().tokens;
    var oldMiddle = context.macros.get("|");
    var oldMiddleDouble = context.macros.get("\\|");
    context.macros.beginGroup();
    var midMacro = (double) => (context2) => {
      if (one) {
        context2.macros.set("|", oldMiddle);
        if (middleDouble.length) {
          context2.macros.set("\\|", oldMiddleDouble);
        }
      }
      var doubled = double;
      if (!double && middleDouble.length) {
        var nextToken = context2.future();
        if (nextToken.text === "|") {
          context2.popToken();
          doubled = true;
        }
      }
      return {
        tokens: doubled ? middleDouble : middle,
        numArgs: 0
      };
    };
    context.macros.set("|", midMacro(false));
    if (middleDouble.length) {
      context.macros.set("\\|", midMacro(true));
    }
    var arg = context.consumeArg().tokens;
    var expanded = context.expandTokens([
      ...right,
      ...arg,
      ...left
      // reversed
    ]);
    context.macros.endGroup();
    return {
      tokens: expanded.reverse(),
      numArgs: 0
    };
  };
  defineMacro("\\bra@ket", braketHelper(false));
  defineMacro("\\bra@set", braketHelper(true));
  defineMacro("\\Braket", "\\bra@ket{\\left\\langle}{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}");
  defineMacro("\\Set", "\\bra@set{\\left\\{\\:}{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}");
  defineMacro("\\set", "\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}");
  defineMacro("\\angln", "{\\angl n}");
  defineMacro("\\blue", "\\textcolor{##6495ed}{#1}");
  defineMacro("\\orange", "\\textcolor{##ffa500}{#1}");
  defineMacro("\\pink", "\\textcolor{##ff00af}{#1}");
  defineMacro("\\red", "\\textcolor{##df0030}{#1}");
  defineMacro("\\green", "\\textcolor{##28ae7b}{#1}");
  defineMacro("\\gray", "\\textcolor{gray}{#1}");
  defineMacro("\\purple", "\\textcolor{##9d38bd}{#1}");
  defineMacro("\\blueA", "\\textcolor{##ccfaff}{#1}");
  defineMacro("\\blueB", "\\textcolor{##80f6ff}{#1}");
  defineMacro("\\blueC", "\\textcolor{##63d9ea}{#1}");
  defineMacro("\\blueD", "\\textcolor{##11accd}{#1}");
  defineMacro("\\blueE", "\\textcolor{##0c7f99}{#1}");
  defineMacro("\\tealA", "\\textcolor{##94fff5}{#1}");
  defineMacro("\\tealB", "\\textcolor{##26edd5}{#1}");
  defineMacro("\\tealC", "\\textcolor{##01d1c1}{#1}");
  defineMacro("\\tealD", "\\textcolor{##01a995}{#1}");
  defineMacro("\\tealE", "\\textcolor{##208170}{#1}");
  defineMacro("\\greenA", "\\textcolor{##b6ffb0}{#1}");
  defineMacro("\\greenB", "\\textcolor{##8af281}{#1}");
  defineMacro("\\greenC", "\\textcolor{##74cf70}{#1}");
  defineMacro("\\greenD", "\\textcolor{##1fab54}{#1}");
  defineMacro("\\greenE", "\\textcolor{##0d923f}{#1}");
  defineMacro("\\goldA", "\\textcolor{##ffd0a9}{#1}");
  defineMacro("\\goldB", "\\textcolor{##ffbb71}{#1}");
  defineMacro("\\goldC", "\\textcolor{##ff9c39}{#1}");
  defineMacro("\\goldD", "\\textcolor{##e07d10}{#1}");
  defineMacro("\\goldE", "\\textcolor{##a75a05}{#1}");
  defineMacro("\\redA", "\\textcolor{##fca9a9}{#1}");
  defineMacro("\\redB", "\\textcolor{##ff8482}{#1}");
  defineMacro("\\redC", "\\textcolor{##f9685d}{#1}");
  defineMacro("\\redD", "\\textcolor{##e84d39}{#1}");
  defineMacro("\\redE", "\\textcolor{##bc2612}{#1}");
  defineMacro("\\maroonA", "\\textcolor{##ffbde0}{#1}");
  defineMacro("\\maroonB", "\\textcolor{##ff92c6}{#1}");
  defineMacro("\\maroonC", "\\textcolor{##ed5fa6}{#1}");
  defineMacro("\\maroonD", "\\textcolor{##ca337c}{#1}");
  defineMacro("\\maroonE", "\\textcolor{##9e034e}{#1}");
  defineMacro("\\purpleA", "\\textcolor{##ddd7ff}{#1}");
  defineMacro("\\purpleB", "\\textcolor{##c6b9fc}{#1}");
  defineMacro("\\purpleC", "\\textcolor{##aa87ff}{#1}");
  defineMacro("\\purpleD", "\\textcolor{##7854ab}{#1}");
  defineMacro("\\purpleE", "\\textcolor{##543b78}{#1}");
  defineMacro("\\mintA", "\\textcolor{##f5f9e8}{#1}");
  defineMacro("\\mintB", "\\textcolor{##edf2df}{#1}");
  defineMacro("\\mintC", "\\textcolor{##e0e5cc}{#1}");
  defineMacro("\\grayA", "\\textcolor{##f6f7f7}{#1}");
  defineMacro("\\grayB", "\\textcolor{##f0f1f2}{#1}");
  defineMacro("\\grayC", "\\textcolor{##e3e5e6}{#1}");
  defineMacro("\\grayD", "\\textcolor{##d6d8da}{#1}");
  defineMacro("\\grayE", "\\textcolor{##babec2}{#1}");
  defineMacro("\\grayF", "\\textcolor{##888d93}{#1}");
  defineMacro("\\grayG", "\\textcolor{##626569}{#1}");
  defineMacro("\\grayH", "\\textcolor{##3b3e40}{#1}");
  defineMacro("\\grayI", "\\textcolor{##21242c}{#1}");
  defineMacro("\\kaBlue", "\\textcolor{##314453}{#1}");
  defineMacro("\\kaGreen", "\\textcolor{##71B307}{#1}");
  var implicitCommands = {
    "^": true,
    // Parser.js
    "_": true,
    // Parser.js
    "\\limits": true,
    // Parser.js
    "\\nolimits": true
    // Parser.js
  };
  var MacroExpander = class {
    constructor(input, settings, mode) {
      this.settings = void 0;
      this.expansionCount = void 0;
      this.lexer = void 0;
      this.macros = void 0;
      this.stack = void 0;
      this.mode = void 0;
      this.settings = settings;
      this.expansionCount = 0;
      this.feed(input);
      this.macros = new Namespace(macros, settings.macros);
      this.mode = mode;
      this.stack = [];
    }
    /**
     * Feed a new input string to the same MacroExpander
     * (with existing macros etc.).
     */
    feed(input) {
      this.lexer = new Lexer(input, this.settings);
    }
    /**
     * Switches between "text" and "math" modes.
     */
    switchMode(newMode) {
      this.mode = newMode;
    }
    /**
     * Start a new group nesting within all namespaces.
     */
    beginGroup() {
      this.macros.beginGroup();
    }
    /**
     * End current group nesting within all namespaces.
     */
    endGroup() {
      this.macros.endGroup();
    }
    /**
     * Ends all currently nested groups (if any), restoring values before the
     * groups began.  Useful in case of an error in the middle of parsing.
     */
    endGroups() {
      this.macros.endGroups();
    }
    /**
     * Returns the topmost token on the stack, without expanding it.
     * Similar in behavior to TeX's `\futurelet`.
     */
    future() {
      if (this.stack.length === 0) {
        this.pushToken(this.lexer.lex());
      }
      return this.stack[this.stack.length - 1];
    }
    /**
     * Remove and return the next unexpanded token.
     */
    popToken() {
      this.future();
      return this.stack.pop();
    }
    /**
     * Add a given token to the token stack.  In particular, this get be used
     * to put back a token returned from one of the other methods.
     */
    pushToken(token) {
      this.stack.push(token);
    }
    /**
     * Append an array of tokens to the token stack.
     */
    pushTokens(tokens) {
      this.stack.push(...tokens);
    }
    /**
     * Find an macro argument without expanding tokens and append the array of
     * tokens to the token stack. Uses Token as a container for the result.
     */
    scanArgument(isOptional) {
      var start;
      var end;
      var tokens;
      if (isOptional) {
        this.consumeSpaces();
        if (this.future().text !== "[") {
          return null;
        }
        start = this.popToken();
        ({
          tokens,
          end
        } = this.consumeArg(["]"]));
      } else {
        ({
          tokens,
          start,
          end
        } = this.consumeArg());
      }
      this.pushToken(new Token("EOF", end.loc));
      this.pushTokens(tokens);
      return new Token("", SourceLocation.range(start, end));
    }
    /**
     * Consume all following space tokens, without expansion.
     */
    consumeSpaces() {
      for (; ; ) {
        var token = this.future();
        if (token.text === " ") {
          this.stack.pop();
        } else {
          break;
        }
      }
    }
    /**
     * Consume an argument from the token stream, and return the resulting array
     * of tokens and start/end token.
     */
    consumeArg(delims) {
      var tokens = [];
      var isDelimited = delims && delims.length > 0;
      if (!isDelimited) {
        this.consumeSpaces();
      }
      var start = this.future();
      var tok;
      var depth = 0;
      var match = 0;
      do {
        tok = this.popToken();
        tokens.push(tok);
        if (tok.text === "{") {
          ++depth;
        } else if (tok.text === "}") {
          --depth;
          if (depth === -1) {
            throw new ParseError("Extra }", tok);
          }
        } else if (tok.text === "EOF") {
          throw new ParseError("Unexpected end of input in a macro argument, expected '" + (delims && isDelimited ? delims[match] : "}") + "'", tok);
        }
        if (delims && isDelimited) {
          if ((depth === 0 || depth === 1 && delims[match] === "{") && tok.text === delims[match]) {
            ++match;
            if (match === delims.length) {
              tokens.splice(-match, match);
              break;
            }
          } else {
            match = 0;
          }
        }
      } while (depth !== 0 || isDelimited);
      if (start.text === "{" && tokens[tokens.length - 1].text === "}") {
        tokens.pop();
        tokens.shift();
      }
      tokens.reverse();
      return {
        tokens,
        start,
        end: tok
      };
    }
    /**
     * Consume the specified number of (delimited) arguments from the token
     * stream and return the resulting array of arguments.
     */
    consumeArgs(numArgs, delimiters2) {
      if (delimiters2) {
        if (delimiters2.length !== numArgs + 1) {
          throw new ParseError("The length of delimiters doesn't match the number of args!");
        }
        var delims = delimiters2[0];
        for (var i = 0; i < delims.length; i++) {
          var tok = this.popToken();
          if (delims[i] !== tok.text) {
            throw new ParseError("Use of the macro doesn't match its definition", tok);
          }
        }
      }
      var args = [];
      for (var _i = 0; _i < numArgs; _i++) {
        args.push(this.consumeArg(delimiters2 && delimiters2[_i + 1]).tokens);
      }
      return args;
    }
    /**
     * Increment `expansionCount` by the specified amount.
     * Throw an error if it exceeds `maxExpand`.
     */
    countExpansion(amount) {
      this.expansionCount += amount;
      if (this.expansionCount > this.settings.maxExpand) {
        throw new ParseError("Too many expansions: infinite loop or need to increase maxExpand setting");
      }
    }
    /**
     * Expand the next token only once if possible.
     *
     * If the token is expanded, the resulting tokens will be pushed onto
     * the stack in reverse order, and the number of such tokens will be
     * returned.  This number might be zero or positive.
     *
     * If not, the return value is `false`, and the next token remains at the
     * top of the stack.
     *
     * In either case, the next token will be on the top of the stack,
     * or the stack will be empty (in case of empty expansion
     * and no other tokens).
     *
     * Used to implement `expandAfterFuture` and `expandNextToken`.
     *
     * If expandableOnly, only expandable tokens are expanded and
     * an undefined control sequence results in an error.
     */
    expandOnce(expandableOnly) {
      var topToken = this.popToken();
      var name = topToken.text;
      var expansion = !topToken.noexpand ? this._getExpansion(name) : null;
      if (expansion == null || expandableOnly && expansion.unexpandable) {
        if (expandableOnly && expansion == null && name[0] === "\\" && !this.isDefined(name)) {
          throw new ParseError("Undefined control sequence: " + name);
        }
        this.pushToken(topToken);
        return false;
      }
      this.countExpansion(1);
      var tokens = expansion.tokens;
      var args = this.consumeArgs(expansion.numArgs, expansion.delimiters);
      if (expansion.numArgs) {
        tokens = tokens.slice();
        for (var i = tokens.length - 1; i >= 0; --i) {
          var tok = tokens[i];
          if (tok.text === "#") {
            if (i === 0) {
              throw new ParseError("Incomplete placeholder at end of macro body", tok);
            }
            tok = tokens[--i];
            if (tok.text === "#") {
              tokens.splice(i + 1, 1);
            } else if (/^[1-9]$/.test(tok.text)) {
              tokens.splice(i, 2, ...args[+tok.text - 1]);
            } else {
              throw new ParseError("Not a valid argument number", tok);
            }
          }
        }
      }
      this.pushTokens(tokens);
      return tokens.length;
    }
    /**
     * Expand the next token only once (if possible), and return the resulting
     * top token on the stack (without removing anything from the stack).
     * Similar in behavior to TeX's `\expandafter\futurelet`.
     * Equivalent to expandOnce() followed by future().
     */
    expandAfterFuture() {
      this.expandOnce();
      return this.future();
    }
    /**
     * Recursively expand first token, then return first non-expandable token.
     */
    expandNextToken() {
      for (; ; ) {
        if (this.expandOnce() === false) {
          var token = this.stack.pop();
          if (token.treatAsRelax) {
            token.text = "\\relax";
          }
          return token;
        }
      }
      throw new Error();
    }
    /**
     * Fully expand the given macro name and return the resulting list of
     * tokens, or return `undefined` if no such macro is defined.
     */
    expandMacro(name) {
      return this.macros.has(name) ? this.expandTokens([new Token(name)]) : void 0;
    }
    /**
     * Fully expand the given token stream and return the resulting list of
     * tokens.  Note that the input tokens are in reverse order, but the
     * output tokens are in forward order.
     */
    expandTokens(tokens) {
      var output = [];
      var oldStackLength = this.stack.length;
      this.pushTokens(tokens);
      while (this.stack.length > oldStackLength) {
        if (this.expandOnce(true) === false) {
          var token = this.stack.pop();
          if (token.treatAsRelax) {
            token.noexpand = false;
            token.treatAsRelax = false;
          }
          output.push(token);
        }
      }
      this.countExpansion(output.length);
      return output;
    }
    /**
     * Fully expand the given macro name and return the result as a string,
     * or return `undefined` if no such macro is defined.
     */
    expandMacroAsText(name) {
      var tokens = this.expandMacro(name);
      if (tokens) {
        return tokens.map((token) => token.text).join("");
      } else {
        return tokens;
      }
    }
    /**
     * Returns the expanded macro as a reversed array of tokens and a macro
     * argument count.  Or returns `null` if no such macro.
     */
    _getExpansion(name) {
      var definition = this.macros.get(name);
      if (definition == null) {
        return definition;
      }
      if (name.length === 1) {
        var catcode = this.lexer.catcodes[name];
        if (catcode != null && catcode !== 13) {
          return;
        }
      }
      var expansion = typeof definition === "function" ? definition(this) : definition;
      if (typeof expansion === "string") {
        var numArgs = 0;
        if (expansion.indexOf("#") !== -1) {
          var stripped = expansion.replace(/##/g, "");
          while (stripped.indexOf("#" + (numArgs + 1)) !== -1) {
            ++numArgs;
          }
        }
        var bodyLexer = new Lexer(expansion, this.settings);
        var tokens = [];
        var tok = bodyLexer.lex();
        while (tok.text !== "EOF") {
          tokens.push(tok);
          tok = bodyLexer.lex();
        }
        tokens.reverse();
        var expanded = {
          tokens,
          numArgs
        };
        return expanded;
      }
      return expansion;
    }
    /**
     * Determine whether a command is currently "defined" (has some
     * functionality), meaning that it's a macro (in the current group),
     * a function, a symbol, or one of the special commands listed in
     * `implicitCommands`.
     */
    isDefined(name) {
      return this.macros.has(name) || functions.hasOwnProperty(name) || symbols.math.hasOwnProperty(name) || symbols.text.hasOwnProperty(name) || implicitCommands.hasOwnProperty(name);
    }
    /**
     * Determine whether a command is expandable.
     */
    isExpandable(name) {
      var macro = this.macros.get(name);
      return macro != null ? typeof macro === "string" || typeof macro === "function" || !macro.unexpandable : functions.hasOwnProperty(name) && !functions[name].primitive;
    }
  };
  var unicodeSubRegEx = /^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/;
  var uSubsAndSups = Object.freeze({
    "\u208A": "+",
    "\u208B": "-",
    "\u208C": "=",
    "\u208D": "(",
    "\u208E": ")",
    "\u2080": "0",
    "\u2081": "1",
    "\u2082": "2",
    "\u2083": "3",
    "\u2084": "4",
    "\u2085": "5",
    "\u2086": "6",
    "\u2087": "7",
    "\u2088": "8",
    "\u2089": "9",
    "\u2090": "a",
    "\u2091": "e",
    "\u2095": "h",
    "\u1D62": "i",
    "\u2C7C": "j",
    "\u2096": "k",
    "\u2097": "l",
    "\u2098": "m",
    "\u2099": "n",
    "\u2092": "o",
    "\u209A": "p",
    "\u1D63": "r",
    "\u209B": "s",
    "\u209C": "t",
    "\u1D64": "u",
    "\u1D65": "v",
    "\u2093": "x",
    "\u1D66": "\u03B2",
    "\u1D67": "\u03B3",
    "\u1D68": "\u03C1",
    "\u1D69": "\u03D5",
    "\u1D6A": "\u03C7",
    "\u207A": "+",
    "\u207B": "-",
    "\u207C": "=",
    "\u207D": "(",
    "\u207E": ")",
    "\u2070": "0",
    "\xB9": "1",
    "\xB2": "2",
    "\xB3": "3",
    "\u2074": "4",
    "\u2075": "5",
    "\u2076": "6",
    "\u2077": "7",
    "\u2078": "8",
    "\u2079": "9",
    "\u1D2C": "A",
    "\u1D2E": "B",
    "\u1D30": "D",
    "\u1D31": "E",
    "\u1D33": "G",
    "\u1D34": "H",
    "\u1D35": "I",
    "\u1D36": "J",
    "\u1D37": "K",
    "\u1D38": "L",
    "\u1D39": "M",
    "\u1D3A": "N",
    "\u1D3C": "O",
    "\u1D3E": "P",
    "\u1D3F": "R",
    "\u1D40": "T",
    "\u1D41": "U",
    "\u2C7D": "V",
    "\u1D42": "W",
    "\u1D43": "a",
    "\u1D47": "b",
    "\u1D9C": "c",
    "\u1D48": "d",
    "\u1D49": "e",
    "\u1DA0": "f",
    "\u1D4D": "g",
    "\u02B0": "h",
    "\u2071": "i",
    "\u02B2": "j",
    "\u1D4F": "k",
    "\u02E1": "l",
    "\u1D50": "m",
    "\u207F": "n",
    "\u1D52": "o",
    "\u1D56": "p",
    "\u02B3": "r",
    "\u02E2": "s",
    "\u1D57": "t",
    "\u1D58": "u",
    "\u1D5B": "v",
    "\u02B7": "w",
    "\u02E3": "x",
    "\u02B8": "y",
    "\u1DBB": "z",
    "\u1D5D": "\u03B2",
    "\u1D5E": "\u03B3",
    "\u1D5F": "\u03B4",
    "\u1D60": "\u03D5",
    "\u1D61": "\u03C7",
    "\u1DBF": "\u03B8"
  });
  var unicodeAccents = {
    "\u0301": {
      "text": "\\'",
      "math": "\\acute"
    },
    "\u0300": {
      "text": "\\`",
      "math": "\\grave"
    },
    "\u0308": {
      "text": '\\"',
      "math": "\\ddot"
    },
    "\u0303": {
      "text": "\\~",
      "math": "\\tilde"
    },
    "\u0304": {
      "text": "\\=",
      "math": "\\bar"
    },
    "\u0306": {
      "text": "\\u",
      "math": "\\breve"
    },
    "\u030C": {
      "text": "\\v",
      "math": "\\check"
    },
    "\u0302": {
      "text": "\\^",
      "math": "\\hat"
    },
    "\u0307": {
      "text": "\\.",
      "math": "\\dot"
    },
    "\u030A": {
      "text": "\\r",
      "math": "\\mathring"
    },
    "\u030B": {
      "text": "\\H"
    },
    "\u0327": {
      "text": "\\c"
    }
  };
  var unicodeSymbols = {
    "\xE1": "a\u0301",
    "\xE0": "a\u0300",
    "\xE4": "a\u0308",
    "\u01DF": "a\u0308\u0304",
    "\xE3": "a\u0303",
    "\u0101": "a\u0304",
    "\u0103": "a\u0306",
    "\u1EAF": "a\u0306\u0301",
    "\u1EB1": "a\u0306\u0300",
    "\u1EB5": "a\u0306\u0303",
    "\u01CE": "a\u030C",
    "\xE2": "a\u0302",
    "\u1EA5": "a\u0302\u0301",
    "\u1EA7": "a\u0302\u0300",
    "\u1EAB": "a\u0302\u0303",
    "\u0227": "a\u0307",
    "\u01E1": "a\u0307\u0304",
    "\xE5": "a\u030A",
    "\u01FB": "a\u030A\u0301",
    "\u1E03": "b\u0307",
    "\u0107": "c\u0301",
    "\u1E09": "c\u0327\u0301",
    "\u010D": "c\u030C",
    "\u0109": "c\u0302",
    "\u010B": "c\u0307",
    "\xE7": "c\u0327",
    "\u010F": "d\u030C",
    "\u1E0B": "d\u0307",
    "\u1E11": "d\u0327",
    "\xE9": "e\u0301",
    "\xE8": "e\u0300",
    "\xEB": "e\u0308",
    "\u1EBD": "e\u0303",
    "\u0113": "e\u0304",
    "\u1E17": "e\u0304\u0301",
    "\u1E15": "e\u0304\u0300",
    "\u0115": "e\u0306",
    "\u1E1D": "e\u0327\u0306",
    "\u011B": "e\u030C",
    "\xEA": "e\u0302",
    "\u1EBF": "e\u0302\u0301",
    "\u1EC1": "e\u0302\u0300",
    "\u1EC5": "e\u0302\u0303",
    "\u0117": "e\u0307",
    "\u0229": "e\u0327",
    "\u1E1F": "f\u0307",
    "\u01F5": "g\u0301",
    "\u1E21": "g\u0304",
    "\u011F": "g\u0306",
    "\u01E7": "g\u030C",
    "\u011D": "g\u0302",
    "\u0121": "g\u0307",
    "\u0123": "g\u0327",
    "\u1E27": "h\u0308",
    "\u021F": "h\u030C",
    "\u0125": "h\u0302",
    "\u1E23": "h\u0307",
    "\u1E29": "h\u0327",
    "\xED": "i\u0301",
    "\xEC": "i\u0300",
    "\xEF": "i\u0308",
    "\u1E2F": "i\u0308\u0301",
    "\u0129": "i\u0303",
    "\u012B": "i\u0304",
    "\u012D": "i\u0306",
    "\u01D0": "i\u030C",
    "\xEE": "i\u0302",
    "\u01F0": "j\u030C",
    "\u0135": "j\u0302",
    "\u1E31": "k\u0301",
    "\u01E9": "k\u030C",
    "\u0137": "k\u0327",
    "\u013A": "l\u0301",
    "\u013E": "l\u030C",
    "\u013C": "l\u0327",
    "\u1E3F": "m\u0301",
    "\u1E41": "m\u0307",
    "\u0144": "n\u0301",
    "\u01F9": "n\u0300",
    "\xF1": "n\u0303",
    "\u0148": "n\u030C",
    "\u1E45": "n\u0307",
    "\u0146": "n\u0327",
    "\xF3": "o\u0301",
    "\xF2": "o\u0300",
    "\xF6": "o\u0308",
    "\u022B": "o\u0308\u0304",
    "\xF5": "o\u0303",
    "\u1E4D": "o\u0303\u0301",
    "\u1E4F": "o\u0303\u0308",
    "\u022D": "o\u0303\u0304",
    "\u014D": "o\u0304",
    "\u1E53": "o\u0304\u0301",
    "\u1E51": "o\u0304\u0300",
    "\u014F": "o\u0306",
    "\u01D2": "o\u030C",
    "\xF4": "o\u0302",
    "\u1ED1": "o\u0302\u0301",
    "\u1ED3": "o\u0302\u0300",
    "\u1ED7": "o\u0302\u0303",
    "\u022F": "o\u0307",
    "\u0231": "o\u0307\u0304",
    "\u0151": "o\u030B",
    "\u1E55": "p\u0301",
    "\u1E57": "p\u0307",
    "\u0155": "r\u0301",
    "\u0159": "r\u030C",
    "\u1E59": "r\u0307",
    "\u0157": "r\u0327",
    "\u015B": "s\u0301",
    "\u1E65": "s\u0301\u0307",
    "\u0161": "s\u030C",
    "\u1E67": "s\u030C\u0307",
    "\u015D": "s\u0302",
    "\u1E61": "s\u0307",
    "\u015F": "s\u0327",
    "\u1E97": "t\u0308",
    "\u0165": "t\u030C",
    "\u1E6B": "t\u0307",
    "\u0163": "t\u0327",
    "\xFA": "u\u0301",
    "\xF9": "u\u0300",
    "\xFC": "u\u0308",
    "\u01D8": "u\u0308\u0301",
    "\u01DC": "u\u0308\u0300",
    "\u01D6": "u\u0308\u0304",
    "\u01DA": "u\u0308\u030C",
    "\u0169": "u\u0303",
    "\u1E79": "u\u0303\u0301",
    "\u016B": "u\u0304",
    "\u1E7B": "u\u0304\u0308",
    "\u016D": "u\u0306",
    "\u01D4": "u\u030C",
    "\xFB": "u\u0302",
    "\u016F": "u\u030A",
    "\u0171": "u\u030B",
    "\u1E7D": "v\u0303",
    "\u1E83": "w\u0301",
    "\u1E81": "w\u0300",
    "\u1E85": "w\u0308",
    "\u0175": "w\u0302",
    "\u1E87": "w\u0307",
    "\u1E98": "w\u030A",
    "\u1E8D": "x\u0308",
    "\u1E8B": "x\u0307",
    "\xFD": "y\u0301",
    "\u1EF3": "y\u0300",
    "\xFF": "y\u0308",
    "\u1EF9": "y\u0303",
    "\u0233": "y\u0304",
    "\u0177": "y\u0302",
    "\u1E8F": "y\u0307",
    "\u1E99": "y\u030A",
    "\u017A": "z\u0301",
    "\u017E": "z\u030C",
    "\u1E91": "z\u0302",
    "\u017C": "z\u0307",
    "\xC1": "A\u0301",
    "\xC0": "A\u0300",
    "\xC4": "A\u0308",
    "\u01DE": "A\u0308\u0304",
    "\xC3": "A\u0303",
    "\u0100": "A\u0304",
    "\u0102": "A\u0306",
    "\u1EAE": "A\u0306\u0301",
    "\u1EB0": "A\u0306\u0300",
    "\u1EB4": "A\u0306\u0303",
    "\u01CD": "A\u030C",
    "\xC2": "A\u0302",
    "\u1EA4": "A\u0302\u0301",
    "\u1EA6": "A\u0302\u0300",
    "\u1EAA": "A\u0302\u0303",
    "\u0226": "A\u0307",
    "\u01E0": "A\u0307\u0304",
    "\xC5": "A\u030A",
    "\u01FA": "A\u030A\u0301",
    "\u1E02": "B\u0307",
    "\u0106": "C\u0301",
    "\u1E08": "C\u0327\u0301",
    "\u010C": "C\u030C",
    "\u0108": "C\u0302",
    "\u010A": "C\u0307",
    "\xC7": "C\u0327",
    "\u010E": "D\u030C",
    "\u1E0A": "D\u0307",
    "\u1E10": "D\u0327",
    "\xC9": "E\u0301",
    "\xC8": "E\u0300",
    "\xCB": "E\u0308",
    "\u1EBC": "E\u0303",
    "\u0112": "E\u0304",
    "\u1E16": "E\u0304\u0301",
    "\u1E14": "E\u0304\u0300",
    "\u0114": "E\u0306",
    "\u1E1C": "E\u0327\u0306",
    "\u011A": "E\u030C",
    "\xCA": "E\u0302",
    "\u1EBE": "E\u0302\u0301",
    "\u1EC0": "E\u0302\u0300",
    "\u1EC4": "E\u0302\u0303",
    "\u0116": "E\u0307",
    "\u0228": "E\u0327",
    "\u1E1E": "F\u0307",
    "\u01F4": "G\u0301",
    "\u1E20": "G\u0304",
    "\u011E": "G\u0306",
    "\u01E6": "G\u030C",
    "\u011C": "G\u0302",
    "\u0120": "G\u0307",
    "\u0122": "G\u0327",
    "\u1E26": "H\u0308",
    "\u021E": "H\u030C",
    "\u0124": "H\u0302",
    "\u1E22": "H\u0307",
    "\u1E28": "H\u0327",
    "\xCD": "I\u0301",
    "\xCC": "I\u0300",
    "\xCF": "I\u0308",
    "\u1E2E": "I\u0308\u0301",
    "\u0128": "I\u0303",
    "\u012A": "I\u0304",
    "\u012C": "I\u0306",
    "\u01CF": "I\u030C",
    "\xCE": "I\u0302",
    "\u0130": "I\u0307",
    "\u0134": "J\u0302",
    "\u1E30": "K\u0301",
    "\u01E8": "K\u030C",
    "\u0136": "K\u0327",
    "\u0139": "L\u0301",
    "\u013D": "L\u030C",
    "\u013B": "L\u0327",
    "\u1E3E": "M\u0301",
    "\u1E40": "M\u0307",
    "\u0143": "N\u0301",
    "\u01F8": "N\u0300",
    "\xD1": "N\u0303",
    "\u0147": "N\u030C",
    "\u1E44": "N\u0307",
    "\u0145": "N\u0327",
    "\xD3": "O\u0301",
    "\xD2": "O\u0300",
    "\xD6": "O\u0308",
    "\u022A": "O\u0308\u0304",
    "\xD5": "O\u0303",
    "\u1E4C": "O\u0303\u0301",
    "\u1E4E": "O\u0303\u0308",
    "\u022C": "O\u0303\u0304",
    "\u014C": "O\u0304",
    "\u1E52": "O\u0304\u0301",
    "\u1E50": "O\u0304\u0300",
    "\u014E": "O\u0306",
    "\u01D1": "O\u030C",
    "\xD4": "O\u0302",
    "\u1ED0": "O\u0302\u0301",
    "\u1ED2": "O\u0302\u0300",
    "\u1ED6": "O\u0302\u0303",
    "\u022E": "O\u0307",
    "\u0230": "O\u0307\u0304",
    "\u0150": "O\u030B",
    "\u1E54": "P\u0301",
    "\u1E56": "P\u0307",
    "\u0154": "R\u0301",
    "\u0158": "R\u030C",
    "\u1E58": "R\u0307",
    "\u0156": "R\u0327",
    "\u015A": "S\u0301",
    "\u1E64": "S\u0301\u0307",
    "\u0160": "S\u030C",
    "\u1E66": "S\u030C\u0307",
    "\u015C": "S\u0302",
    "\u1E60": "S\u0307",
    "\u015E": "S\u0327",
    "\u0164": "T\u030C",
    "\u1E6A": "T\u0307",
    "\u0162": "T\u0327",
    "\xDA": "U\u0301",
    "\xD9": "U\u0300",
    "\xDC": "U\u0308",
    "\u01D7": "U\u0308\u0301",
    "\u01DB": "U\u0308\u0300",
    "\u01D5": "U\u0308\u0304",
    "\u01D9": "U\u0308\u030C",
    "\u0168": "U\u0303",
    "\u1E78": "U\u0303\u0301",
    "\u016A": "U\u0304",
    "\u1E7A": "U\u0304\u0308",
    "\u016C": "U\u0306",
    "\u01D3": "U\u030C",
    "\xDB": "U\u0302",
    "\u016E": "U\u030A",
    "\u0170": "U\u030B",
    "\u1E7C": "V\u0303",
    "\u1E82": "W\u0301",
    "\u1E80": "W\u0300",
    "\u1E84": "W\u0308",
    "\u0174": "W\u0302",
    "\u1E86": "W\u0307",
    "\u1E8C": "X\u0308",
    "\u1E8A": "X\u0307",
    "\xDD": "Y\u0301",
    "\u1EF2": "Y\u0300",
    "\u0178": "Y\u0308",
    "\u1EF8": "Y\u0303",
    "\u0232": "Y\u0304",
    "\u0176": "Y\u0302",
    "\u1E8E": "Y\u0307",
    "\u0179": "Z\u0301",
    "\u017D": "Z\u030C",
    "\u1E90": "Z\u0302",
    "\u017B": "Z\u0307",
    "\u03AC": "\u03B1\u0301",
    "\u1F70": "\u03B1\u0300",
    "\u1FB1": "\u03B1\u0304",
    "\u1FB0": "\u03B1\u0306",
    "\u03AD": "\u03B5\u0301",
    "\u1F72": "\u03B5\u0300",
    "\u03AE": "\u03B7\u0301",
    "\u1F74": "\u03B7\u0300",
    "\u03AF": "\u03B9\u0301",
    "\u1F76": "\u03B9\u0300",
    "\u03CA": "\u03B9\u0308",
    "\u0390": "\u03B9\u0308\u0301",
    "\u1FD2": "\u03B9\u0308\u0300",
    "\u1FD1": "\u03B9\u0304",
    "\u1FD0": "\u03B9\u0306",
    "\u03CC": "\u03BF\u0301",
    "\u1F78": "\u03BF\u0300",
    "\u03CD": "\u03C5\u0301",
    "\u1F7A": "\u03C5\u0300",
    "\u03CB": "\u03C5\u0308",
    "\u03B0": "\u03C5\u0308\u0301",
    "\u1FE2": "\u03C5\u0308\u0300",
    "\u1FE1": "\u03C5\u0304",
    "\u1FE0": "\u03C5\u0306",
    "\u03CE": "\u03C9\u0301",
    "\u1F7C": "\u03C9\u0300",
    "\u038E": "\u03A5\u0301",
    "\u1FEA": "\u03A5\u0300",
    "\u03AB": "\u03A5\u0308",
    "\u1FE9": "\u03A5\u0304",
    "\u1FE8": "\u03A5\u0306",
    "\u038F": "\u03A9\u0301",
    "\u1FFA": "\u03A9\u0300"
  };
  var Parser = class _Parser {
    constructor(input, settings) {
      this.mode = void 0;
      this.gullet = void 0;
      this.settings = void 0;
      this.leftrightDepth = void 0;
      this.nextToken = void 0;
      this.mode = "math";
      this.gullet = new MacroExpander(input, settings, this.mode);
      this.settings = settings;
      this.leftrightDepth = 0;
    }
    /**
     * Checks a result to make sure it has the right type, and throws an
     * appropriate error otherwise.
     */
    expect(text2, consume) {
      if (consume === void 0) {
        consume = true;
      }
      if (this.fetch().text !== text2) {
        throw new ParseError("Expected '" + text2 + "', got '" + this.fetch().text + "'", this.fetch());
      }
      if (consume) {
        this.consume();
      }
    }
    /**
     * Discards the current lookahead token, considering it consumed.
     */
    consume() {
      this.nextToken = null;
    }
    /**
     * Return the current lookahead token, or if there isn't one (at the
     * beginning, or if the previous lookahead token was consume()d),
     * fetch the next token as the new lookahead token and return it.
     */
    fetch() {
      if (this.nextToken == null) {
        this.nextToken = this.gullet.expandNextToken();
      }
      return this.nextToken;
    }
    /**
     * Switches between "text" and "math" modes.
     */
    switchMode(newMode) {
      this.mode = newMode;
      this.gullet.switchMode(newMode);
    }
    /**
     * Main parsing function, which parses an entire input.
     */
    parse() {
      if (!this.settings.globalGroup) {
        this.gullet.beginGroup();
      }
      if (this.settings.colorIsTextColor) {
        this.gullet.macros.set("\\color", "\\textcolor");
      }
      try {
        var parse = this.parseExpression(false);
        this.expect("EOF");
        if (!this.settings.globalGroup) {
          this.gullet.endGroup();
        }
        return parse;
      } finally {
        this.gullet.endGroups();
      }
    }
    /**
     * Fully parse a separate sequence of tokens as a separate job.
     * Tokens should be specified in reverse order, as in a MacroDefinition.
     */
    subparse(tokens) {
      var oldToken = this.nextToken;
      this.consume();
      this.gullet.pushToken(new Token("}"));
      this.gullet.pushTokens(tokens);
      var parse = this.parseExpression(false);
      this.expect("}");
      this.nextToken = oldToken;
      return parse;
    }
    /**
     * Parses an "expression", which is a list of atoms.
     *
     * `breakOnInfix`: Should the parsing stop when we hit infix nodes? This
     *                 happens when functions have higher precedence han infix
     *                 nodes in implicit parses.
     *
     * `breakOnTokenText`: The text of the token that the expression should end
     *                     with, or `null` if something else should end the
     *                     expression.
     */
    parseExpression(breakOnInfix, breakOnTokenText) {
      var body = [];
      while (true) {
        if (this.mode === "math") {
          this.consumeSpaces();
        }
        var lex = this.fetch();
        if (_Parser.endOfExpression.indexOf(lex.text) !== -1) {
          break;
        }
        if (breakOnTokenText && lex.text === breakOnTokenText) {
          break;
        }
        if (breakOnInfix && functions[lex.text] && functions[lex.text].infix) {
          break;
        }
        var atom = this.parseAtom(breakOnTokenText);
        if (!atom) {
          break;
        } else if (atom.type === "internal") {
          continue;
        }
        body.push(atom);
      }
      if (this.mode === "text") {
        this.formLigatures(body);
      }
      return this.handleInfixNodes(body);
    }
    /**
     * Rewrites infix operators such as \over with corresponding commands such
     * as \frac.
     *
     * There can only be one infix operator per group.  If there's more than one
     * then the expression is ambiguous.  This can be resolved by adding {}.
     */
    handleInfixNodes(body) {
      var overIndex = -1;
      var funcName;
      for (var i = 0; i < body.length; i++) {
        if (body[i].type === "infix") {
          if (overIndex !== -1) {
            throw new ParseError("only one infix operator per group", body[i].token);
          }
          overIndex = i;
          funcName = body[i].replaceWith;
        }
      }
      if (overIndex !== -1 && funcName) {
        var numerNode;
        var denomNode;
        var numerBody = body.slice(0, overIndex);
        var denomBody = body.slice(overIndex + 1);
        if (numerBody.length === 1 && numerBody[0].type === "ordgroup") {
          numerNode = numerBody[0];
        } else {
          numerNode = {
            type: "ordgroup",
            mode: this.mode,
            body: numerBody
          };
        }
        if (denomBody.length === 1 && denomBody[0].type === "ordgroup") {
          denomNode = denomBody[0];
        } else {
          denomNode = {
            type: "ordgroup",
            mode: this.mode,
            body: denomBody
          };
        }
        var node;
        if (funcName === "\\\\abovefrac") {
          node = this.callFunction(funcName, [numerNode, body[overIndex], denomNode], []);
        } else {
          node = this.callFunction(funcName, [numerNode, denomNode], []);
        }
        return [node];
      } else {
        return body;
      }
    }
    /**
     * Handle a subscript or superscript with nice errors.
     */
    handleSupSubscript(name) {
      var symbolToken = this.fetch();
      var symbol = symbolToken.text;
      this.consume();
      this.consumeSpaces();
      var group;
      do {
        var _group;
        group = this.parseGroup(name);
      } while (((_group = group) == null ? void 0 : _group.type) === "internal");
      if (!group) {
        throw new ParseError("Expected group after '" + symbol + "'", symbolToken);
      }
      return group;
    }
    /**
     * Converts the textual input of an unsupported command into a text node
     * contained within a color node whose color is determined by errorColor
     */
    formatUnsupportedCmd(text2) {
      var textordArray = [];
      for (var i = 0; i < text2.length; i++) {
        textordArray.push({
          type: "textord",
          mode: "text",
          text: text2[i]
        });
      }
      var textNode = {
        type: "text",
        mode: this.mode,
        body: textordArray
      };
      var colorNode = {
        type: "color",
        mode: this.mode,
        color: this.settings.errorColor,
        body: [textNode]
      };
      return colorNode;
    }
    /**
     * Parses a group with optional super/subscripts.
     */
    parseAtom(breakOnTokenText) {
      var base = this.parseGroup("atom", breakOnTokenText);
      if ((base == null ? void 0 : base.type) === "internal") {
        return base;
      }
      if (this.mode === "text") {
        return base;
      }
      var superscript;
      var subscript;
      while (true) {
        this.consumeSpaces();
        var lex = this.fetch();
        if (lex.text === "\\limits" || lex.text === "\\nolimits") {
          if (base && base.type === "op") {
            var limits = lex.text === "\\limits";
            base.limits = limits;
            base.alwaysHandleSupSub = true;
          } else if (base && base.type === "operatorname") {
            if (base.alwaysHandleSupSub) {
              base.limits = lex.text === "\\limits";
            }
          } else {
            throw new ParseError("Limit controls must follow a math operator", lex);
          }
          this.consume();
        } else if (lex.text === "^") {
          if (superscript) {
            throw new ParseError("Double superscript", lex);
          }
          superscript = this.handleSupSubscript("superscript");
        } else if (lex.text === "_") {
          if (subscript) {
            throw new ParseError("Double subscript", lex);
          }
          subscript = this.handleSupSubscript("subscript");
        } else if (lex.text === "'") {
          if (superscript) {
            throw new ParseError("Double superscript", lex);
          }
          var prime = {
            type: "textord",
            mode: this.mode,
            text: "\\prime"
          };
          var primes = [prime];
          this.consume();
          while (this.fetch().text === "'") {
            primes.push(prime);
            this.consume();
          }
          if (this.fetch().text === "^") {
            primes.push(this.handleSupSubscript("superscript"));
          }
          superscript = {
            type: "ordgroup",
            mode: this.mode,
            body: primes
          };
        } else if (uSubsAndSups[lex.text]) {
          var isSub = unicodeSubRegEx.test(lex.text);
          var subsupTokens = [];
          subsupTokens.push(new Token(uSubsAndSups[lex.text]));
          this.consume();
          while (true) {
            var token = this.fetch().text;
            if (!uSubsAndSups[token]) {
              break;
            }
            if (unicodeSubRegEx.test(token) !== isSub) {
              break;
            }
            subsupTokens.unshift(new Token(uSubsAndSups[token]));
            this.consume();
          }
          var body = this.subparse(subsupTokens);
          if (isSub) {
            subscript = {
              type: "ordgroup",
              mode: "math",
              body
            };
          } else {
            superscript = {
              type: "ordgroup",
              mode: "math",
              body
            };
          }
        } else {
          break;
        }
      }
      if (superscript || subscript) {
        return {
          type: "supsub",
          mode: this.mode,
          base,
          sup: superscript,
          sub: subscript
        };
      } else {
        return base;
      }
    }
    /**
     * Parses an entire function, including its base and all of its arguments.
     */
    parseFunction(breakOnTokenText, name) {
      var token = this.fetch();
      var func = token.text;
      var funcData = functions[func];
      if (!funcData) {
        return null;
      }
      this.consume();
      if (name && name !== "atom" && !funcData.allowedInArgument) {
        throw new ParseError("Got function '" + func + "' with no arguments" + (name ? " as " + name : ""), token);
      } else if (this.mode === "text" && !funcData.allowedInText) {
        throw new ParseError("Can't use function '" + func + "' in text mode", token);
      } else if (this.mode === "math" && funcData.allowedInMath === false) {
        throw new ParseError("Can't use function '" + func + "' in math mode", token);
      }
      var {
        args,
        optArgs
      } = this.parseArguments(func, funcData);
      return this.callFunction(func, args, optArgs, token, breakOnTokenText);
    }
    /**
     * Call a function handler with a suitable context and arguments.
     */
    callFunction(name, args, optArgs, token, breakOnTokenText) {
      var context = {
        funcName: name,
        parser: this,
        token,
        breakOnTokenText
      };
      var func = functions[name];
      if (func && func.handler) {
        return func.handler(context, args, optArgs);
      } else {
        throw new ParseError("No function handler for " + name);
      }
    }
    /**
     * Parses the arguments of a function or environment
     */
    parseArguments(func, funcData) {
      var totalArgs = funcData.numArgs + funcData.numOptionalArgs;
      if (totalArgs === 0) {
        return {
          args: [],
          optArgs: []
        };
      }
      var args = [];
      var optArgs = [];
      for (var i = 0; i < totalArgs; i++) {
        var argType = funcData.argTypes && funcData.argTypes[i];
        var isOptional = i < funcData.numOptionalArgs;
        if (funcData.primitive && argType == null || // \sqrt expands into primitive if optional argument doesn't exist
        funcData.type === "sqrt" && i === 1 && optArgs[0] == null) {
          argType = "primitive";
        }
        var arg = this.parseGroupOfType("argument to '" + func + "'", argType, isOptional);
        if (isOptional) {
          optArgs.push(arg);
        } else if (arg != null) {
          args.push(arg);
        } else {
          throw new ParseError("Null argument, please report this as a bug");
        }
      }
      return {
        args,
        optArgs
      };
    }
    /**
     * Parses a group when the mode is changing.
     */
    parseGroupOfType(name, type, optional) {
      switch (type) {
        case "color":
          return this.parseColorGroup(optional);
        case "size":
          return this.parseSizeGroup(optional);
        case "url":
          return this.parseUrlGroup(optional);
        case "math":
        case "text":
          return this.parseArgumentGroup(optional, type);
        case "hbox": {
          var group = this.parseArgumentGroup(optional, "text");
          return group != null ? {
            type: "styling",
            mode: group.mode,
            body: [group],
            style: "text"
            // simulate \textstyle
          } : null;
        }
        case "raw": {
          var token = this.parseStringGroup("raw", optional);
          return token != null ? {
            type: "raw",
            mode: "text",
            string: token.text
          } : null;
        }
        case "primitive": {
          if (optional) {
            throw new ParseError("A primitive argument cannot be optional");
          }
          var _group2 = this.parseGroup(name);
          if (_group2 == null) {
            throw new ParseError("Expected group as " + name, this.fetch());
          }
          return _group2;
        }
        case "original":
        case null:
        case void 0:
          return this.parseArgumentGroup(optional);
        default:
          throw new ParseError("Unknown group type as " + name, this.fetch());
      }
    }
    /**
     * Discard any space tokens, fetching the next non-space token.
     */
    consumeSpaces() {
      while (this.fetch().text === " ") {
        this.consume();
      }
    }
    /**
     * Parses a group, essentially returning the string formed by the
     * brace-enclosed tokens plus some position information.
     */
    parseStringGroup(modeName, optional) {
      var argToken = this.gullet.scanArgument(optional);
      if (argToken == null) {
        return null;
      }
      var str = "";
      var nextToken;
      while ((nextToken = this.fetch()).text !== "EOF") {
        str += nextToken.text;
        this.consume();
      }
      this.consume();
      argToken.text = str;
      return argToken;
    }
    /**
     * Parses a regex-delimited group: the largest sequence of tokens
     * whose concatenated strings match `regex`. Returns the string
     * formed by the tokens plus some position information.
     */
    parseRegexGroup(regex, modeName) {
      var firstToken = this.fetch();
      var lastToken = firstToken;
      var str = "";
      var nextToken;
      while ((nextToken = this.fetch()).text !== "EOF" && regex.test(str + nextToken.text)) {
        lastToken = nextToken;
        str += lastToken.text;
        this.consume();
      }
      if (str === "") {
        throw new ParseError("Invalid " + modeName + ": '" + firstToken.text + "'", firstToken);
      }
      return firstToken.range(lastToken, str);
    }
    /**
     * Parses a color description.
     */
    parseColorGroup(optional) {
      var res = this.parseStringGroup("color", optional);
      if (res == null) {
        return null;
      }
      var match = /^(#[a-f0-9]{3,4}|#[a-f0-9]{6}|#[a-f0-9]{8}|[a-f0-9]{6}|[a-z]+)$/i.exec(res.text);
      if (!match) {
        throw new ParseError("Invalid color: '" + res.text + "'", res);
      }
      var color = match[0];
      if (/^[0-9a-f]{6}$/i.test(color)) {
        color = "#" + color;
      }
      return {
        type: "color-token",
        mode: this.mode,
        color
      };
    }
    /**
     * Parses a size specification, consisting of magnitude and unit.
     */
    parseSizeGroup(optional) {
      var res;
      var isBlank = false;
      this.gullet.consumeSpaces();
      if (!optional && this.gullet.future().text !== "{") {
        res = this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/, "size");
      } else {
        res = this.parseStringGroup("size", optional);
      }
      if (!res) {
        return null;
      }
      if (!optional && res.text.length === 0) {
        res.text = "0pt";
        isBlank = true;
      }
      var match = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(res.text);
      if (!match) {
        throw new ParseError("Invalid size: '" + res.text + "'", res);
      }
      var data2 = {
        number: +(match[1] + match[2]),
        // sign + magnitude, cast to number
        unit: match[3]
      };
      if (!validUnit(data2)) {
        throw new ParseError("Invalid unit: '" + data2.unit + "'", res);
      }
      return {
        type: "size",
        mode: this.mode,
        value: data2,
        isBlank
      };
    }
    /**
     * Parses an URL, checking escaped letters and allowed protocols,
     * and setting the catcode of % as an active character (as in \hyperref).
     */
    parseUrlGroup(optional) {
      this.gullet.lexer.setCatcode("%", 13);
      this.gullet.lexer.setCatcode("~", 12);
      var res = this.parseStringGroup("url", optional);
      this.gullet.lexer.setCatcode("%", 14);
      this.gullet.lexer.setCatcode("~", 13);
      if (res == null) {
        return null;
      }
      var url = res.text.replace(/\\([#$%&~_^{}])/g, "$1");
      return {
        type: "url",
        mode: this.mode,
        url
      };
    }
    /**
     * Parses an argument with the mode specified.
     */
    parseArgumentGroup(optional, mode) {
      var argToken = this.gullet.scanArgument(optional);
      if (argToken == null) {
        return null;
      }
      var outerMode = this.mode;
      if (mode) {
        this.switchMode(mode);
      }
      this.gullet.beginGroup();
      var expression = this.parseExpression(false, "EOF");
      this.expect("EOF");
      this.gullet.endGroup();
      var result = {
        type: "ordgroup",
        mode: this.mode,
        loc: argToken.loc,
        body: expression
      };
      if (mode) {
        this.switchMode(outerMode);
      }
      return result;
    }
    /**
     * Parses an ordinary group, which is either a single nucleus (like "x")
     * or an expression in braces (like "{x+y}") or an implicit group, a group
     * that starts at the current position, and ends right before a higher explicit
     * group ends, or at EOF.
     */
    parseGroup(name, breakOnTokenText) {
      var firstToken = this.fetch();
      var text2 = firstToken.text;
      var result;
      if (text2 === "{" || text2 === "\\begingroup") {
        this.consume();
        var groupEnd = text2 === "{" ? "}" : "\\endgroup";
        this.gullet.beginGroup();
        var expression = this.parseExpression(false, groupEnd);
        var lastToken = this.fetch();
        this.expect(groupEnd);
        this.gullet.endGroup();
        result = {
          type: "ordgroup",
          mode: this.mode,
          loc: SourceLocation.range(firstToken, lastToken),
          body: expression,
          // A group formed by \begingroup...\endgroup is a semi-simple group
          // which doesn't affect spacing in math mode, i.e., is transparent.
          // https://tex.stackexchange.com/questions/1930/when-should-one-
          // use-begingroup-instead-of-bgroup
          semisimple: text2 === "\\begingroup" || void 0
        };
      } else {
        result = this.parseFunction(breakOnTokenText, name) || this.parseSymbol();
        if (result == null && text2[0] === "\\" && !implicitCommands.hasOwnProperty(text2)) {
          if (this.settings.throwOnError) {
            throw new ParseError("Undefined control sequence: " + text2, firstToken);
          }
          result = this.formatUnsupportedCmd(text2);
          this.consume();
        }
      }
      return result;
    }
    /**
     * Form ligature-like combinations of characters for text mode.
     * This includes inputs like "--", "---", "``" and "''".
     * The result will simply replace multiple textord nodes with a single
     * character in each value by a single textord node having multiple
     * characters in its value.  The representation is still ASCII source.
     * The group will be modified in place.
     */
    formLigatures(group) {
      var n = group.length - 1;
      for (var i = 0; i < n; ++i) {
        var a = group[i];
        var v = a.text;
        if (v === "-" && group[i + 1].text === "-") {
          if (i + 1 < n && group[i + 2].text === "-") {
            group.splice(i, 3, {
              type: "textord",
              mode: "text",
              loc: SourceLocation.range(a, group[i + 2]),
              text: "---"
            });
            n -= 2;
          } else {
            group.splice(i, 2, {
              type: "textord",
              mode: "text",
              loc: SourceLocation.range(a, group[i + 1]),
              text: "--"
            });
            n -= 1;
          }
        }
        if ((v === "'" || v === "`") && group[i + 1].text === v) {
          group.splice(i, 2, {
            type: "textord",
            mode: "text",
            loc: SourceLocation.range(a, group[i + 1]),
            text: v + v
          });
          n -= 1;
        }
      }
    }
    /**
     * Parse a single symbol out of the string. Here, we handle single character
     * symbols and special functions like \verb.
     */
    parseSymbol() {
      var nucleus = this.fetch();
      var text2 = nucleus.text;
      if (/^\\verb[^a-zA-Z]/.test(text2)) {
        this.consume();
        var arg = text2.slice(5);
        var star = arg.charAt(0) === "*";
        if (star) {
          arg = arg.slice(1);
        }
        if (arg.length < 2 || arg.charAt(0) !== arg.slice(-1)) {
          throw new ParseError("\\verb assertion failed --\n                    please report what input caused this bug");
        }
        arg = arg.slice(1, -1);
        return {
          type: "verb",
          mode: "text",
          body: arg,
          star
        };
      }
      if (unicodeSymbols.hasOwnProperty(text2[0]) && !symbols[this.mode][text2[0]]) {
        if (this.settings.strict && this.mode === "math") {
          this.settings.reportNonstrict("unicodeTextInMathMode", 'Accented Unicode text character "' + text2[0] + '" used in math mode', nucleus);
        }
        text2 = unicodeSymbols[text2[0]] + text2.slice(1);
      }
      var match = combiningDiacriticalMarksEndRegex.exec(text2);
      if (match) {
        text2 = text2.substring(0, match.index);
        if (text2 === "i") {
          text2 = "\u0131";
        } else if (text2 === "j") {
          text2 = "\u0237";
        }
      }
      var symbol;
      if (symbols[this.mode][text2]) {
        if (this.settings.strict && this.mode === "math" && extraLatin.indexOf(text2) >= 0) {
          this.settings.reportNonstrict("unicodeTextInMathMode", 'Latin-1/Unicode text character "' + text2[0] + '" used in math mode', nucleus);
        }
        var group = symbols[this.mode][text2].group;
        var loc = SourceLocation.range(nucleus);
        var s;
        if (ATOMS.hasOwnProperty(group)) {
          var family = group;
          s = {
            type: "atom",
            mode: this.mode,
            family,
            loc,
            text: text2
          };
        } else {
          s = {
            type: group,
            mode: this.mode,
            loc,
            text: text2
          };
        }
        symbol = s;
      } else if (text2.charCodeAt(0) >= 128) {
        if (this.settings.strict) {
          if (!supportedCodepoint(text2.charCodeAt(0))) {
            this.settings.reportNonstrict("unknownSymbol", 'Unrecognized Unicode character "' + text2[0] + '"' + (" (" + text2.charCodeAt(0) + ")"), nucleus);
          } else if (this.mode === "math") {
            this.settings.reportNonstrict("unicodeTextInMathMode", 'Unicode text character "' + text2[0] + '" used in math mode', nucleus);
          }
        }
        symbol = {
          type: "textord",
          mode: "text",
          loc: SourceLocation.range(nucleus),
          text: text2
        };
      } else {
        return null;
      }
      this.consume();
      if (match) {
        for (var i = 0; i < match[0].length; i++) {
          var accent2 = match[0][i];
          if (!unicodeAccents[accent2]) {
            throw new ParseError("Unknown accent ' " + accent2 + "'", nucleus);
          }
          var command = unicodeAccents[accent2][this.mode] || unicodeAccents[accent2].text;
          if (!command) {
            throw new ParseError("Accent " + accent2 + " unsupported in " + this.mode + " mode", nucleus);
          }
          symbol = {
            type: "accent",
            mode: this.mode,
            loc: SourceLocation.range(nucleus),
            label: command,
            isStretchy: false,
            isShifty: true,
            // $FlowFixMe
            base: symbol
          };
        }
      }
      return symbol;
    }
  };
  Parser.endOfExpression = ["}", "\\endgroup", "\\end", "\\right", "&"];
  var parseTree = function parseTree2(toParse, settings) {
    if (!(typeof toParse === "string" || toParse instanceof String)) {
      throw new TypeError("KaTeX can only parse string typed expression");
    }
    var parser = new Parser(toParse, settings);
    delete parser.gullet.macros.current["\\df@tag"];
    var tree = parser.parse();
    delete parser.gullet.macros.current["\\current@color"];
    delete parser.gullet.macros.current["\\color"];
    if (parser.gullet.macros.get("\\df@tag")) {
      if (!settings.displayMode) {
        throw new ParseError("\\tag works only in display equations");
      }
      tree = [{
        type: "tag",
        mode: "text",
        body: tree,
        tag: parser.subparse([new Token("\\df@tag")])
      }];
    }
    return tree;
  };
  var render = function render2(expression, baseNode, options) {
    baseNode.textContent = "";
    var node = renderToDomTree(expression, options).toNode();
    baseNode.appendChild(node);
  };
  if (typeof document !== "undefined") {
    if (document.compatMode !== "CSS1Compat") {
      typeof console !== "undefined" && console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your website has a suitable doctype.");
      render = function render3() {
        throw new ParseError("KaTeX doesn't work in quirks mode.");
      };
    }
  }
  var renderToString = function renderToString2(expression, options) {
    var markup = renderToDomTree(expression, options).toMarkup();
    return markup;
  };
  var generateParseTree = function generateParseTree2(expression, options) {
    var settings = new Settings(options);
    return parseTree(expression, settings);
  };
  var renderError = function renderError2(error, expression, options) {
    if (options.throwOnError || !(error instanceof ParseError)) {
      throw error;
    }
    var node = buildCommon.makeSpan(["katex-error"], [new SymbolNode(expression)]);
    node.setAttribute("title", error.toString());
    node.setAttribute("style", "color:" + options.errorColor);
    return node;
  };
  var renderToDomTree = function renderToDomTree2(expression, options) {
    var settings = new Settings(options);
    try {
      var tree = parseTree(expression, settings);
      return buildTree(tree, expression, settings);
    } catch (error) {
      return renderError(error, expression, settings);
    }
  };
  var renderToHTMLTree = function renderToHTMLTree2(expression, options) {
    var settings = new Settings(options);
    try {
      var tree = parseTree(expression, settings);
      return buildHTMLTree(tree, expression, settings);
    } catch (error) {
      return renderError(error, expression, settings);
    }
  };
  var version = "0.16.25";
  var __domTree = {
    Span,
    Anchor,
    SymbolNode,
    SvgNode,
    PathNode,
    LineNode
  };
  var katex = {
    /**
     * Current KaTeX version
     */
    version,
    /**
     * Renders the given LaTeX into an HTML+MathML combination, and adds
     * it as a child to the specified DOM node.
     */
    render,
    /**
     * Renders the given LaTeX into an HTML+MathML combination string,
     * for sending to the client.
     */
    renderToString,
    /**
     * KaTeX error, usually during parsing.
     */
    ParseError,
    /**
     * The schema of Settings
     */
    SETTINGS_SCHEMA,
    /**
     * Parses the given LaTeX into KaTeX's internal parse tree structure,
     * without rendering to HTML or MathML.
     *
     * NOTE: This method is not currently recommended for public use.
     * The internal tree representation is unstable and is very likely
     * to change. Use at your own risk.
     */
    __parse: generateParseTree,
    /**
     * Renders the given LaTeX into an HTML+MathML internal DOM tree
     * representation, without flattening that representation to a string.
     *
     * NOTE: This method is not currently recommended for public use.
     * The internal tree representation is unstable and is very likely
     * to change. Use at your own risk.
     */
    __renderToDomTree: renderToDomTree,
    /**
     * Renders the given LaTeX into an HTML internal DOM tree representation,
     * without MathML and without flattening that representation to a string.
     *
     * NOTE: This method is not currently recommended for public use.
     * The internal tree representation is unstable and is very likely
     * to change. Use at your own risk.
     */
    __renderToHTMLTree: renderToHTMLTree,
    /**
     * extends internal font metrics object with a new object
     * each key in the new object represents a font name
    */
    __setFontMetrics: setFontMetrics,
    /**
     * adds a new symbol to builtin symbols table
     */
    __defineSymbol: defineSymbol,
    /**
     * adds a new function to builtin function list,
     * which directly produce parse tree elements
     * and have their own html/mathml builders
     */
    __defineFunction: defineFunction,
    /**
     * adds a new macro to builtin macro list
     */
    __defineMacro: defineMacro,
    /**
     * Expose the dom tree node types, which can be useful for type checking nodes.
     *
     * NOTE: These methods are not currently recommended for public use.
     * The internal tree representation is unstable and is very likely
     * to change. Use at your own risk.
     */
    __domTree
  };

  // src/utils/mathRenderer.ts
  var MATH_REGEX = /(^|[^\\])\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|(^|[^\\])\$(?!\$)([^\n]*?)\$(?!\$)|\\\(([\s\S]*?)\\\)/g;
  var DEFAULT_KATEX_OPTIONS = {
    throwOnError: false,
    errorColor: "#cc0000",
    strict: false
  };
  function containsMath(text2) {
    if (!text2) return false;
    const TEST_REGEX = /(^|[^\\])\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|(^|[^\\])\$[^\n]*?\$|\\\([\s\S]*?\\\)/;
    return TEST_REGEX.test(text2);
  }
  function escapeHtml(doc, text2) {
    const div = doc.createElement("div");
    div.textContent = text2;
    return div.innerHTML.replace(/\n/g, "<br></br>");
  }
  function renderMathInText(doc, text2) {
    if (!text2) return "";
    if (!containsMath(text2)) return escapeHtml(doc, text2);
    let result = "";
    let lastIndex = 0;
    let match;
    while ((match = MATH_REGEX.exec(text2)) !== null) {
      const [
        full,
        dispPrefix,
        dispDollar,
        dispBracket,
        inlinePrefix,
        inlineDollar,
        inlineParen
      ] = match;
      const prefixLen = dispPrefix || inlinePrefix ? 1 : 0;
      const plainEnd = match.index + prefixLen;
      if (plainEnd > lastIndex) {
        result += escapeHtml(doc, text2.slice(lastIndex, plainEnd));
      }
      let displayMode = false;
      let latex = "";
      if (typeof dispDollar !== "undefined") {
        displayMode = true;
        latex = String(dispDollar).trim();
      } else if (typeof dispBracket !== "undefined") {
        displayMode = true;
        latex = String(dispBracket).trim();
      } else if (typeof inlineDollar !== "undefined") {
        displayMode = false;
        latex = String(inlineDollar).trim();
      } else if (typeof inlineParen !== "undefined") {
        displayMode = false;
        latex = String(inlineParen).trim();
      }
      try {
        const rendered = katex.renderToString(latex, {
          ...DEFAULT_KATEX_OPTIONS,
          displayMode
        });
        result += rendered;
      } catch (e) {
        result += escapeHtml(doc, full.slice(prefixLen));
      }
      lastIndex = match.index + full.length;
    }
    if (lastIndex < text2.length) {
      result += escapeHtml(doc, text2.slice(lastIndex));
    }
    return result;
  }

  // src/elements/mathTextbox.ts
  var MathTextboxElement = class extends XULElementBase {
    _textbox = null;
    _overlay = null;
    _value = "";
    get content() {
      return MozXULElement.parseXULToFragment(`
      <editable-text id="inner-textbox" multiline="true" />
      <linkset>
        <html:link
          rel="stylesheet"
          href="chrome://${config.addonRef}/content/styles/mathTextbox.css"
        ></html:link>
        <html:link
          rel="stylesheet"
          href="chrome://${config.addonRef}/content/styles/katex.min.css"
        ></html:link>
      </linkset>
    `);
    }
    connectedCallback() {
      super.connectedCallback();
      this.init();
    }
    init() {
      this._textbox = this.querySelector("#inner-textbox");
      if (!this._textbox) return;
      this._textbox.addEventListener("input", this._onInput);
      this._textbox.addEventListener("focus", this._onFocus);
      this._textbox.addEventListener("blur", this._onBlur);
    }
    set value(v) {
      this._value = v ?? "";
      if (this._textbox) this._textbox.value = this._value;
      this._updateOverlay();
    }
    get value() {
      return this._textbox?.value ?? this._value;
    }
    set placeholder(v) {
      if (this._textbox) this._textbox.placeholder = v;
    }
    focus() {
      this._textbox?.focus();
    }
    _onInput = (e) => {
      const val = e.target.value;
      this._value = val;
    };
    _onFocus = () => {
      this._hideOverlay();
    };
    _onBlur = () => {
      this._updateOverlay();
    };
    _updateOverlay() {
      const enabled = getPref("enableMathRendering") === true;
      if (!enabled || !this._value || !containsMath(this._value)) {
        this._hideOverlay();
        return;
      }
      this._showOverlay();
    }
    _showOverlay() {
      if (this._overlay) this._overlay.remove();
      const HTML_NS = "http://www.w3.org/1999/xhtml";
      const overlay = document.createElementNS(
        HTML_NS,
        "div"
      );
      overlay.className = "math-overlay";
      overlay.innerHTML = renderMathInText(document, this._value);
      overlay.addEventListener("click", () => {
        this._hideOverlay();
        this._textbox?.focus();
      });
      this._overlay = overlay;
      this.appendChild(overlay);
      this.toggleAttribute("overlay-visible", true);
    }
    _hideOverlay() {
      if (this._overlay) {
        this._overlay.remove();
        this._overlay = null;
      }
      this.toggleAttribute("overlay-visible", false);
    }
    destroy() {
      this._hideOverlay();
      if (this._textbox) {
        this._textbox.removeEventListener("input", this._onInput);
        this._textbox.removeEventListener("focus", this._onFocus);
        this._textbox.removeEventListener("blur", this._onBlur);
      }
    }
  };

  // src/extras/customElements.ts
  var elements = {
    "translator-plugin-panel": TranslatorPanel,
    "math-textbox": MathTextboxElement
  };
  for (const [key, constructor] of Object.entries(elements)) {
    if (!customElements.get(key)) {
      customElements.define(key, constructor);
    }
  }
})();
