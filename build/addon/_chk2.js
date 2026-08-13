const fs = require("fs");
let s = fs.readFileSync("content/scripts/addon.js", "utf8");
// check _data default and _refreshPrefsFromStorage keys
let idx = s.indexOf("_refreshPrefsFromStorage");
console.log(s.substring(idx, idx+1600));