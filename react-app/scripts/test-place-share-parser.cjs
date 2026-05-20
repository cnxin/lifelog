const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTs(relativeFile) {
  const filePath = path.resolve(projectRoot, relativeFile);
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  const source = fs.readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filePath, module);

  const localRequire = (id) => {
    if (!id.startsWith(".")) return require(id);
    return loadTs(path.relative(projectRoot, path.resolve(path.dirname(filePath), `${id}.ts`)));
  };

  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const { parsePlaceShare } = loadTs("src/utils/placeShareParser.ts");
const { parsePlatformLinksText, platformLinksToText } = loadTs("src/utils/placeLinks.ts");
const { groupsToText, parseGroups, splitList, splitPreferenceItems } = loadTs("src/utils/text.ts");

const placeCases = [
  {
    label: "amap full text",
    input:
      "我在高德地图上发现了九月里·自由花园餐厅（玉兰国际店） 地址：浙江省绍兴市柯桥区湖中路玉兰国际大厦 评分：4.7 https://uri.amap.com/marker?position=120.492,30.082&name=%E4%B9%9D%E6%9C%88%E9%87%8C",
    expected: {
      name: "九月里·自由花园餐厅",
      storeName: "玉兰国际店",
      city: "绍兴",
      mall: "玉兰国际大厦",
      address: "浙江省绍兴市柯桥区湖中路玉兰国际大厦",
      rating: 4.7,
      sourceType: "amap"
    }
  },
  {
    label: "meituan deep link",
    input:
      "美团 店名：蓝蛙(湖滨银泰in77店) 人均￥168 西餐 地址：杭州市上城区延安路湖滨银泰in77C区 meituan://www.meituan.com/shop?id=123&shopName=%E8%93%9D%E8%9B%99",
    expected: {
      name: "蓝蛙",
      storeName: "湖滨银泰in77店",
      city: "杭州",
      mall: "湖滨银泰",
      address: "杭州市上城区延安路湖滨银泰in77C区",
      desc: "人均 ¥168/人",
      sourceType: "meituan",
      platformLinks: "美团 | meituan://www.meituan.com/shop?id=123&shopName=%E8%93%9D%E8%9B%99"
    }
  },
  {
    label: "dianping shop link",
    input:
      "大众点评商家：Seesaw Coffee(嘉里中心店) 评分4.5 人均 42元 商户地址：浙江省杭州市拱墅区延安路385号杭州嘉里中心 https://www.dianping.com/shop/abc",
    expected: {
      name: "Seesaw Coffee",
      storeName: "嘉里中心店",
      category: "咖啡厅",
      city: "杭州",
      mall: "杭州嘉里中心",
      rating: 4.5,
      desc: "人均 ¥42/人",
      sourceType: "dianping",
      platformLinks: "点评 | https://www.dianping.com/shop/abc"
    }
  },
  {
    label: "generic inline fields",
    input: "店名：火焰山烤肉(万象城店) 地址：杭州市上城区富春路701号杭州万象城B1 人均：¥98 烤肉",
    expected: {
      name: "火焰山烤肉",
      storeName: "万象城店",
      category: "餐厅",
      city: "杭州",
      mall: "杭州万象城",
      address: "杭州市上城区富春路701号杭州万象城B1",
      desc: "人均 ¥98/人",
      sourceType: "generic"
    }
  },
  {
    label: "android amap scheme",
    input:
      "高德地图\n菲滋意式餐厅(湖滨银泰in77C区店)\n地址：浙江省杭州市上城区延安路258号湖滨银泰in77C区3层\nandroidamap://viewMap?sourceApplication=amap&poiname=%E8%8F%B2%E6%BB%8B%E6%84%8F%E5%BC%8F%E9%A4%90%E5%8E%85&lat=30.2568&lon=120.1647",
    expected: {
      name: "菲滋意式餐厅",
      storeName: "湖滨银泰in77C区店",
      city: "杭州",
      mall: "湖滨银泰",
      latitude: "30.2568",
      longitude: "120.1647",
      sourceType: "amap"
    }
  },
  {
    label: "meituan waimai scheme",
    input:
      "美团外卖分享 店名：喜茶(湖滨银泰店) 人均 28元 茶饮 门店地址：杭州市上城区延安路湖滨银泰in77B区 meituanwaimai://waimai.meituan.com/restaurant?id=456&wmPoiName=%E5%96%9C%E8%8C%B6",
    expected: {
      name: "喜茶",
      storeName: "湖滨银泰店",
      category: "咖啡厅",
      city: "杭州",
      mall: "湖滨银泰",
      desc: "人均 ¥28/人",
      sourceType: "meituan",
      platformLinks: "美团 | meituanwaimai://waimai.meituan.com/restaurant?id=456&wmPoiName=%E5%96%9C%E8%8C%B6"
    }
  },
  {
    label: "dianping newline fields",
    input:
      "大众点评\n商户名称：% Arabica(嘉里中心店)\n星级：4.6\n人均价格：42元\n商户地址：浙江省杭州市拱墅区延安路385号杭州嘉里中心1层\nhttps://dpurl.cn/abc123",
    expected: {
      name: "% Arabica",
      storeName: "嘉里中心店",
      category: "咖啡厅",
      city: "杭州",
      mall: "杭州嘉里中心",
      rating: 4.6,
      desc: "人均 ¥42/人",
      sourceType: "dianping",
      platformLinks: "点评 | https://dpurl.cn/abc123"
    }
  }
];

const textCases = [
  {
    label: "empty preference groups stay empty",
    actual: parseGroups(""),
    expected: []
  },
  {
    label: "preference item delimiters",
    actual: splitPreferenceItems("火锅、寿司；咖啡;甜品\n电影"),
    expected: ["火锅", "寿司", "咖啡", "甜品", "电影"]
  },
  {
    label: "tag delimiters",
    actual: splitList("日常、约会，回头客;想再去\n收藏"),
    expected: ["日常", "约会", "回头客", "想再去", "收藏"]
  },
  {
    label: "preference group parsing",
    actual: parseGroups("食物：火锅、寿司\n饮品: 美式；拿铁"),
    expected: [
      { category: "食物", items: ["火锅", "寿司"] },
      { category: "饮品", items: ["美式", "拿铁"] }
    ]
  },
  {
    label: "empty preference group serialization",
    actual: groupsToText([]),
    expected: ""
  },
  {
    label: "platform links multiline parsing",
    actual: platformLinksToText(parsePlatformLinksText("美团 | meituan://shop/1\n抖音 | https://www.douyin.com/search/foo\nhttps://example.test/custom")),
    expected: "美团 | meituan://shop/1\n抖音 | https://www.douyin.com/search/foo\n链接 | https://example.test/custom"
  }
];

let failures = 0;

function assertEqual(label, actualValue, expectedValue) {
  if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) return;
  failures += 1;
  console.error(`[${label}] mismatch`);
  console.error(`  expected: ${JSON.stringify(expectedValue)}`);
  console.error(`  actual:   ${JSON.stringify(actualValue)}`);
}

for (const item of placeCases) {
  const parsed = parsePlaceShare(item.input);
  for (const [key, expectedValue] of Object.entries(item.expected)) {
    assertEqual(`${item.label} ${key}`, parsed[key], expectedValue);
  }
}

for (const item of textCases) {
  assertEqual(item.label, item.actual, item.expected);
}

if (failures) {
  console.error(`Parser regression failed: ${failures} mismatch(es).`);
  process.exit(1);
}

console.log(`Parser regression passed: ${placeCases.length} place cases and ${textCases.length} text cases.`);
