const fs = require("fs");
let s = fs.readFileSync("content/scripts/addon.js", "utf8");

// Search for sort-related keywords
const sortIdx = s.indexOf("sort");
while (true) {
  if (sortIdx === -1) break;
  let pos = s.indexOf("sort", sortIdx + 1);
  if (pos === -1) break;
  console.log("sort @", pos, JSON.stringify(s.substring(Math.max(0, pos - 80), pos + 100)));
  sortIdx = pos;
}

console.log("=== _itemWords structure ===");
const iw = s.indexOf("_itemWords = new Map");
console.log(s.substring(iw - 100, iw + 200));

console.log("=== _panesByTabID / _panelUIDs ===");
const pt = s.indexOf("_panelUIDs");
console.log(s.substring(pt - 100, pt + 300));