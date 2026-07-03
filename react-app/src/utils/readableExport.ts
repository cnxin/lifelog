import type { LifeLogState } from "../types";
import { getWesternZodiacSign } from "./date";
import { buildMemoryDisplayContext, getMemoryKindLabel, isMemoryPlan } from "./memoryDisplay";
import { buildPlaceDisplayName } from "./placeMeta";

export function buildReadableMarkdown(state: LifeLogState) {
  const getPersonName = (id: string) => state.people.find((person) => person.id === id)?.name || "未关联人物";
  const getPlaceName = (id: string) => {
    const place = state.places.find((item) => item.id === id);
    return place ? buildPlaceDisplayName(place) : "未关联地点";
  };
  const memoryCount = state.memories.filter((memory) => !isMemoryPlan(memory)).length;
  const planCount = state.memories.filter(isMemoryPlan).length;
  const lines = [
    "# LifeLog 可读导出",
    "",
    `导出时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    `- 人物：${state.people.length}`,
    `- 地点：${state.places.length}`,
    `- 回忆：${memoryCount}`,
    `- 计划：${planCount}`,
    "",
    "## 人物",
    "",
    ...state.people.flatMap((person) => [
      `### ${person.name}${person.nickname ? `（${person.nickname}）` : ""}`,
      "",
      `- 关系：${person.relationship || "未设置"}`,
      `- 生日：${person.birthday || "未设置"}`,
      `- 星座：${getWesternZodiacSign(person.birthday) || "未设置"}`,
      person.preferences.length ? `- 喜好：${person.preferences.map((group) => `${group.category}：${group.items.join("、")}`).join("；")}` : "- 喜好：未设置",
      person.dislikes.length ? `- 禁忌：${person.dislikes.map((group) => `${group.category}：${group.items.join("、")}`).join("；")}` : "- 禁忌：未设置",
      person.notes ? `- 备注：${person.notes}` : "",
      ""
    ]),
    "## 地点",
    "",
    ...state.places.flatMap((place) => [
      `### ${buildPlaceDisplayName(place)}`,
      "",
      `- 分类：${place.category || "未设置"}`,
      `- 位置：${[place.country, place.province, place.city, place.area, place.mall].filter(Boolean).join(" / ") || "未设置"}`,
      place.address ? `- 地址：${place.address}` : "",
      place.desc ? `- 描述：${place.desc}` : "",
      place.tags.length ? `- 标签：${place.tags.join("、")}` : "",
      ""
    ]),
    "## 记录",
    "",
    ...[...state.memories]
      .sort((left, right) => right.date.localeCompare(left.date))
      .flatMap((memory) => {
        const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
        return [
          `### ${memory.date} · ${getMemoryKindLabel(memory)} · ${memory.title || "未命名记录"}`,
          "",
          ctx.personNames.length ? `- 人物：${ctx.personNames.join("、")}` : "",
          ctx.placeNames.length ? `- 地点：${ctx.placeNames.join("、")}` : "",
          memory.mood ? `- 心情：${memory.mood}` : "",
          memory.tags.length ? `- 标签：${memory.tags.join("、")}` : "",
          !isMemoryPlan(memory) && memory.plannedContent?.trim() ? `- 原计划：${memory.plannedContent.trim()}` : "",
          "",
          memory.content || "",
          ""
        ];
      })
  ];

  return lines.filter((line, index, array) => line || array[index - 1] !== "").join("\n");
}

export function buildReadableHtml(state: LifeLogState) {
  const markdown = buildReadableMarkdown(state);
  const body = markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("- ")) return `<p class="item">${escapeHtml(line.slice(2))}</p>`;
      return line ? `<p>${escapeHtml(line)}</p>` : "";
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LifeLog 可读导出</title>
  <style>
    body { max-width: 760px; margin: 0 auto; padding: 28px 18px 56px; color: #242633; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.65; background: #fbfaf7; }
    h1, h2, h3 { line-height: 1.25; }
    h1 { font-size: 28px; }
    h2 { margin-top: 34px; padding-top: 18px; border-top: 1px solid #e7e0d4; font-size: 22px; }
    h3 { margin-top: 22px; font-size: 17px; }
    p { margin: 6px 0; }
    .item { color: #5d6472; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
