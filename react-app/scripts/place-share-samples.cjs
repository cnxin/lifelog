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
      platformLinks: "大众点评 | https://www.dianping.com/shop/abc"
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
      platformLinks: "大众点评 | https://dpurl.cn/abc123"
    }
  },
  {
    label: "xiaohongshu note share",
    input:
      "小红书推荐店铺：青山咖啡(万象城店)\n地址：杭州市上城区富春路701号杭州万象城B1\n人均：45元\nhttps://www.xiaohongshu.com/explore/65abc123",
    expected: {
      name: "青山咖啡",
      storeName: "万象城店",
      category: "咖啡厅",
      city: "杭州",
      mall: "杭州万象城",
      desc: "人均 ¥45/人",
      sourceType: "xiaohongshu",
      platformLinks: "小红书 | https://www.xiaohongshu.com/explore/65abc123"
    }
  },
  {
    label: "douyin short link",
    input:
      "抖音团购 分享一家店：牛小灶牛肉火锅(湖滨店) 地址：杭州市上城区延安路湖滨银泰in77 评分4.4 https://v.douyin.com/iABC123/",
    expected: {
      name: "牛小灶牛肉火锅",
      storeName: "湖滨店",
      category: "餐厅",
      city: "杭州",
      mall: "湖滨银泰",
      rating: 4.4,
      sourceType: "douyin",
      platformLinks: "抖音 | https://v.douyin.com/iABC123/"
    }
  },
  {
    label: "baidu map share",
    input:
      "百度地图\n地点名称：西湖银泰城\n地址：浙江省杭州市上城区延安路98号\nhttps://map.baidu.com/?newmap=1&s=inf%26uid%3Dabc",
    expected: {
      name: "西湖银泰城",
      city: "杭州",
      mall: "西湖银泰城",
      address: "浙江省杭州市上城区延安路98号",
      sourceType: "baidu",
      platformLinks: "百度地图 | https://map.baidu.com/?newmap=1&s=inf%26uid%3Dabc"
    }
  },
  {
    label: "tencent map scheme",
    input:
      "腾讯地图分享\n门店名称：盒马鲜生(滨江宝龙店)\n位置：杭州市滨江区滨盛路宝龙城B1\nqqmap://map/marker?marker=coord:30.188,120.200;title:%E7%9B%92%E9%A9%AC%E9%B2%9C%E7%94%9F",
    expected: {
      name: "盒马鲜生",
      storeName: "滨江宝龙店",
      city: "杭州",
      mall: "宝龙城",
      sourceType: "tencent",
      platformLinks: "腾讯地图 | qqmap://map/marker?marker=coord:30.188,120.200"
    }
  },
  {
    label: "wechat location share",
    input:
      "微信位置\n名称：晓风书屋(湖滨店)\n地址：杭州市上城区湖滨银泰C区2层\nhttps://mp.weixin.qq.com/s/abc123",
    expected: {
      name: "晓风书屋",
      storeName: "湖滨店",
      category: "书店",
      city: "杭州",
      mall: "湖滨银泰",
      sourceType: "wechat",
      platformLinks: "微信 | https://mp.weixin.qq.com/s/abc123"
    }
  },
  {
    label: "amap route share with go here copy",
    input:
      "高德地图\n去这里：茑屋书店(天目里店)\n浙江省杭州市西湖区天目山路398号天目里2号楼\n经纬度：120.1198,30.2765\n打开高德地图查看详情 https://uri.amap.com/marker?position=120.1198,30.2765&name=%E8%8C%91%E5%B1%8B%E4%B9%A6%E5%BA%97",
    expected: {
      name: "茑屋书店",
      storeName: "天目里店",
      category: "书店",
      city: "杭州",
      mall: "天目里",
      latitude: "30.2765",
      longitude: "120.1198",
      sourceType: "amap"
    }
  },
  {
    label: "meituan shop card with category field",
    input:
      "美团\n店铺：桂满陇(西湖银泰城店)\n品类：杭帮菜\n人均消费：88元\n所在位置：杭州市上城区延安路98号西湖银泰城3F\nhttps://www.meituan.com/deal/poi/12345",
    expected: {
      name: "桂满陇",
      storeName: "西湖银泰城店",
      category: "餐厅",
      city: "杭州",
      mall: "西湖银泰城",
      address: "杭州市上城区延安路98号西湖银泰城3F",
      desc: "人均 ¥88/人",
      sourceType: "meituan",
      platformLinks: "美团 | https://www.meituan.com/deal/poi/12345"
    }
  },
  {
    label: "dianping taste environment service card",
    input:
      "大众点评\n门店标题：M Stand(嘉里中心店)\n咖啡厅\n口味 4.7 环境 4.8 服务 4.6\n客单价：52\n门店地址：杭州市拱墅区延安路385号杭州嘉里中心1楼\nhttps://www.dianping.com/shop/l6X2",
    expected: {
      name: "M Stand",
      storeName: "嘉里中心店",
      category: "咖啡厅",
      city: "杭州",
      mall: "杭州嘉里中心",
      rating: 4.7,
      desc: "人均 ¥52/人",
      sourceType: "dianping"
    }
  },
  {
    label: "douyin group buying card",
    input:
      "抖音团购\n正在看店：鸟剑居酒屋-湖滨店\n类型：日料\n地址：浙江省杭州市上城区延安路湖滨银泰in77E区\n人均 156元\nhttps://www.douyin.com/poi/123456789",
    expected: {
      name: "鸟剑居酒屋",
      storeName: "湖滨店",
      category: "餐厅",
      city: "杭州",
      mall: "湖滨银泰",
      desc: "人均 ¥156/人",
      sourceType: "douyin",
      platformLinks: "抖音 | https://www.douyin.com/poi/123456789"
    }
  },
  {
    label: "xiaohongshu seeded shop text",
    input:
      "小红书种草一家店：Cycle&Cycle(万象城店)\n分类：咖啡\n位置：杭州市上城区富春路701号杭州万象城L2\n人均价格：39\nxhsdiscover://item/65abc",
    expected: {
      name: "Cycle&Cycle",
      storeName: "万象城店",
      category: "咖啡厅",
      city: "杭州",
      mall: "杭州万象城",
      desc: "人均 ¥39/人",
      sourceType: "xiaohongshu",
      platformLinks: "小红书 | xhsdiscover://item/65abc"
    }
  }
];

const textCases = [
  {
    label: "empty preference groups stay empty",
    actual: "parseGroups",
    input: "",
    expected: []
  },
  {
    label: "preference item delimiters",
    actual: "splitPreferenceItems",
    input: "火锅、寿司；咖啡;甜品\n电影",
    expected: ["火锅", "寿司", "咖啡", "甜品", "电影"]
  },
  {
    label: "tag delimiters",
    actual: "splitList",
    input: "日常、约会，回头客;想再去\n收藏",
    expected: ["日常", "约会", "回头客", "想再去", "收藏"]
  },
  {
    label: "preference group parsing",
    actual: "parseGroups",
    input: "食物：火锅、寿司\n饮品: 美式；拿铁",
    expected: [
      { category: "食物", items: ["火锅", "寿司"] },
      { category: "饮品", items: ["美式", "拿铁"] }
    ]
  },
  {
    label: "empty preference group serialization",
    actual: "groupsToText",
    input: [],
    expected: ""
  },
  {
    label: "platform links multiline parsing",
    actual: "platformLinksRoundTrip",
    input: "美团 | meituan://shop/1\n小红书 | https://xhslink.com/a1\n百度地图 | baidumap://map/place/detail?uid=1\nhttps://example.test/custom",
    expected: "美团 | meituan://shop/1\n小红书 | https://xhslink.com/a1\n百度地图 | baidumap://map/place/detail?uid=1\n链接 | https://example.test/custom"
  }
];

module.exports = {
  placeCases,
  textCases
};
