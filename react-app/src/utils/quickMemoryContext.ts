export function buildDefaultQuickMemoryTitle({
  personNames,
  placeName
}: {
  personNames: string[];
  placeName: string;
}) {
  const peopleLabel = formatPeopleLabel(personNames);
  if (peopleLabel && placeName) return `和${peopleLabel}在${placeName}`;
  if (peopleLabel) return `和${peopleLabel}见了一面`;
  if (placeName) return `去了${placeName}`;
  return "";
}

export function buildQuickMemoryTemplates(personNames: string[], placeName: string) {
  const peopleLabel = formatPeopleLabel(personNames);
  const sceneTemplates = buildSceneQuickMemoryTemplates(peopleLabel, placeName);
  if (peopleLabel && placeName) {
    return uniqueTemplates([
      `和${peopleLabel}在${placeName}`,
      `和${peopleLabel}去了${placeName}`,
      `在${placeName}和${peopleLabel}聊了聊`,
      `和${peopleLabel}的一次见面`,
      ...sceneTemplates
    ]);
  }
  if (peopleLabel) {
    return uniqueTemplates([
      `和${peopleLabel}见了一面`,
      `和${peopleLabel}聊了聊`,
      `和${peopleLabel}吃了顿饭`,
      `关于${peopleLabel}的一次记录`,
      ...sceneTemplates
    ]);
  }
  if (placeName) {
    return uniqueTemplates([
      `去了${placeName}`,
      `在${placeName}待了一会儿`,
      `打卡${placeName}`,
      `${placeName}的一次到访`,
      ...sceneTemplates
    ]);
  }
  return buildGeneralQuickMemoryTemplates();
}

export function buildQuickMemoryTemplateGroups(personNames: string[], placeName: string) {
  const contextTemplates = buildQuickMemoryTemplates(personNames, placeName);
  const generalTemplates = buildGeneralQuickMemoryTemplates();
  return [
    {
      title: personNames.length || placeName ? "当前场景" : "常用场景",
      templates: contextTemplates.slice(0, 8)
    },
    {
      title: "快速模板",
      templates: generalTemplates.filter((template) => !contextTemplates.includes(template)).slice(0, 6)
    }
  ].filter((group) => group.templates.length);
}

function buildGeneralQuickMemoryTemplates() {
  return [
    "今天吃了一顿不错的饭",
    "记录一次见面",
    "去了一家想再来的店",
    "看了一场电影",
    "买到一个值得记住的东西",
    "一次临时的小旅行"
  ];
}

function buildSceneQuickMemoryTemplates(peopleLabel: string, placeName: string) {
  const prefix = [peopleLabel ? `和${peopleLabel}` : "", placeName ? `在${placeName}` : ""].join("");
  if (!prefix) return [];
  return [
    `${prefix}吃了顿饭`,
    `${prefix}看了场电影`,
    `${prefix}逛了逛`,
    `${prefix}买了点东西`
  ];
}

export function buildMemoryContentTemplates(personNames: string[], placeNameOrNames: string | string[]) {
  const peopleLabel = formatPeopleLabel(personNames);
  const placeNames = normalizePlaceNames(placeNameOrNames);
  return uniqueTemplates([
    ...placeNames.map((placeName) => (peopleLabel ? `和${peopleLabel}在${placeName}：` : "")),
    peopleLabel ? `和${peopleLabel}聊到：` : "",
    ...placeNames.map((placeName) => `${placeName}这次体验：`),
    "今天发生了：\n下次可以：",
    "值得记住的是：\n当时的感受："
  ]);
}

export function formatPeopleLabel(personNames: string[]) {
  const names = personNames.map((name) => name.trim()).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join("和");
  return `${names[0]}等${names.length}人`;
}

function uniqueTemplates(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePlaceNames(value: string | string[]) {
  const rawNames = Array.isArray(value) ? value : value.split(/[、,，]/);
  return rawNames.map((name) => name.trim()).filter(Boolean);
}
