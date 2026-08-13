const fs = require("fs");
let s = fs.readFileSync("content/scripts/addon.js", "utf8");
// Find header-related code
let re = /A↑|A↓|fontSize|font-size|清空|%u6E05%u7A7A/g;
let matches = [];
let m;
while ((m = re.exec(s)) !== null) { matches.push(m.index + " L" + s.substring(0, m.index).split("\n").length + " " + m[0]); }
console.log(matches.slice(0, 30).join("\n"));