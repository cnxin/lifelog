import type { LifeLogState } from "../types";

export const seedData: LifeLogState = {
  people: [
    {
      id: "p1",
      name: "小明",
      nickname: "明明",
      relationship: "朋友",
      birthday: "1999-04-15",
      birthdayIsLunar: false,
      favorite: true,
      preferences: [
        { category: "颜色", items: ["蓝色", "黑色"] },
        { category: "食物", items: ["火锅", "寿司"] },
        { category: "饮品", items: ["美式咖啡"] }
      ],
      dislikes: [
        { category: "过敏", items: ["花生"] },
        { category: "食物", items: ["香菜"] }
      ],
      anniversaries: [{ title: "生日", date: "1999-04-15" }],
      notes: "喜欢安静靠窗的位置。"
    },
    {
      id: "p2",
      name: "小红",
      nickname: "",
      relationship: "同事",
      birthday: "2000-09-01",
      birthdayIsLunar: false,
      favorite: true,
      preferences: [
        { category: "电影", items: ["悬疑", "动画"] },
        { category: "饮品", items: ["抹茶拿铁"] },
        { category: "动物", items: ["猫"] }
      ],
      dislikes: [{ category: "口味", items: ["太辣"] }],
      anniversaries: [{ title: "相识日", date: "2024-09-01" }],
      notes: "适合约电影和咖啡。"
    },
    {
      id: "p3",
      name: "妈妈",
      nickname: "",
      relationship: "家人",
      birthday: "1976-11-18",
      birthdayIsLunar: false,
      favorite: true,
      preferences: [
        { category: "礼物", items: ["暖色围巾", "实用小家电"] },
        { category: "食物", items: ["清淡菜"] },
        { category: "活动", items: ["散步"] }
      ],
      dislikes: [{ category: "口味", items: ["太甜"] }],
      anniversaries: [{ title: "生日", date: "1976-11-18" }],
      notes: "送礼优先考虑实用。"
    }
  ],
  places: [
    {
      id: "l1",
      name: "海底捞",
      country: "中国",
      city: "杭州",
      area: "万达广场",
      storeName: "万达店",
      category: "餐厅",
      rating: 4.8,
      address: "杭州市拱墅区万达广场 5F",
      latitude: 30.3198,
      longitude: 120.1482,
      mapUrl: "https://ditu.amap.com/search?query=%E6%9D%AD%E5%B7%9E%E4%B8%87%E8%BE%BE%E5%B9%BF%E5%9C%BA",
      sourceUrl: "https://www.pitravel.cn/",
      platformLinks: [],
      photos: [],
      desc: "服务稳定，适合多人聚餐。",
      tags: ["火锅", "聚餐"],
      favorite: true
    },
    {
      id: "l2",
      name: "Blue Bottle",
      country: "中国",
      city: "杭州",
      area: "湖滨银泰",
      storeName: "湖滨店",
      category: "咖啡厅",
      rating: 4.6,
      address: "杭州市上城区湖滨银泰商圈",
      latitude: 30.257,
      longitude: 120.163,
      mapUrl: "https://ditu.amap.com/search?query=%E6%9D%AD%E5%B7%9E%E6%B9%96%E6%BB%A8%E9%93%B6%E6%B3%B0",
      sourceUrl: "https://www.pitravel.cn/",
      platformLinks: [],
      photos: [],
      desc: "环境安静，适合聊天。",
      tags: ["咖啡", "安静"],
      favorite: false
    },
    {
      id: "l3",
      name: "万达影城",
      country: "中国",
      city: "杭州",
      area: "万达广场",
      storeName: "IMAX 厅",
      category: "电影院",
      rating: 4.3,
      address: "杭州市拱墅区万达广场 6F",
      latitude: 30.3198,
      longitude: 120.1482,
      mapUrl: "https://ditu.amap.com/search?query=%E4%B8%87%E8%BE%BE%E5%BD%B1%E5%9F%8E%20IMAX%20%E6%9D%AD%E5%B7%9E",
      sourceUrl: "https://www.pitravel.cn/",
      platformLinks: [],
      photos: [],
      desc: "音效不错，周末排队久。",
      tags: ["电影", "商场"],
      favorite: false
    }
  ],
  memories: [
    {
      id: "m1",
      title: "和小明吃火锅",
      date: "2026-04-24",
      personIds: ["p1"],
      placeId: "l1",
      mood: "轻松",
      content: "小明很喜欢番茄锅和虾滑，下次可以提前排号。",
      tags: ["聚餐", "火锅"]
    },
    {
      id: "m2",
      title: "周末看电影",
      date: "2026-04-26",
      personIds: ["p2"],
      placeId: "l3",
      mood: "愉快",
      content: "看完电影后聊了很久，附近咖啡店可以作为下次备选。",
      tags: ["电影"]
    }
  ]
};
