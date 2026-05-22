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
  if (peopleLabel && placeName) {
    return uniqueTemplates([
      `和${peopleLabel}在${placeName}`,
      `和${peopleLabel}去了${placeName}`,
      `在${placeName}和${peopleLabel}聊了聊`,
      `和${peopleLabel}的一次见面`
    ]);
  }
  if (peopleLabel) {
    return uniqueTemplates([
      `和${peopleLabel}见了一面`,
      `和${peopleLabel}聊了聊`,
      `和${peopleLabel}吃了顿饭`,
      `关于${peopleLabel}的一次记录`
    ]);
  }
  if (placeName) {
    return uniqueTemplates([
      `去了${placeName}`,
      `在${placeName}待了一会儿`,
      `打卡${placeName}`,
      `${placeName}的一次到访`
    ]);
  }
  return [];
}

export function buildMemoryContentTemplates(personNames: string[], placeName: string) {
  const peopleLabel = formatPeopleLabel(personNames);
  return uniqueTemplates([
    peopleLabel && placeName ? `和${peopleLabel}在${placeName}：` : "",
    peopleLabel ? `和${peopleLabel}聊到：` : "",
    placeName ? `${placeName}这次体验：` : "",
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
