const fs = require("fs");
let s = fs.readFileSync("content/scripts/addon.js","utf8");
console.log("_tempEditState:", s.includes("_tempEditState"));
console.log("_tempEditBound:", s.includes("_tempEditBound"));
console.log("_createAddWordButton:", s.includes("_createAddWordButton"));
console.log("_showTempEditArea:", s.includes("_showTempEditArea"));
console.log("_updateTempEditArea:", s.includes("_updateTempEditArea"));
console.log("_restoreButtonFromTempEdit:", s.includes("_restoreButtonFromTempEdit"));
console.log("_bindTempEditAutoClose:", s.includes("_bindTempEditAutoClose"));
console.log("_unbindTempEditAutoClose:", s.includes("_unbindTempEditAutoClose"));
// old btn replaced
console.log("_createAddWordButton call:", s.includes('this._createAddWordButton(doc, reader, text, SVGIcon'));
// wordtranslator-temp-edit
console.log("wordtranslator-temp-edit:", s.includes("wordtranslator-temp-edit"));