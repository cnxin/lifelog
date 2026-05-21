import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Link2, MapPinPlus } from "lucide-react";
import type { Place, PlaceExternalLink, PlaceLinkPlatform } from "../../types";
import { useLifeLog } from "../../context/LifeLogContext";
import type { PlaceDraft } from "../../utils/placeShareParser";
import { emptyPlaceDraft, parsePlaceShare } from "../../utils/placeShareParser";
import {
  createPlatformLink,
  inferPlatformFromLink,
  parsePlatformLinksText,
  PLACE_LINK_PLATFORM_DEFS,
  platformLinksToText,
  type PresetPlaceLinkPlatform
} from "../../utils/placeLinks";
import { getPlacePlatformLink } from "../../utils/placeMeta";
import NumberStepper from "../NumberStepper";
import SelectPicker from "../SelectPicker";

const PLACE_CATEGORY_OPTIONS = ["餐厅", "咖啡厅", "电影院", "景点", "商场", "酒店", "公园", "书店", "医院", "学校", "公司", "其他"].map((item) => ({ value: item, label: item }));
const BOOLEAN_OPTIONS = [
  { value: "true", label: "是" },
  { value: "false", label: "否" }
];
const PLATFORM_PRESETS = PLACE_LINK_PLATFORM_DEFS;

export function PlaceFields({
  place,
  initialPlaceDraft,
  isEditing
}: {
  place?: Place;
  initialPlaceDraft?: Partial<Place>;
  isEditing: boolean;
}) {
  if (!isEditing) return <QuickPlaceFields initialPlaceDraft={initialPlaceDraft} />;

  return (
    <>
      <div className="form-row">
        <label>
          国家
          <input name="country" defaultValue={place?.country || "中国"} />
        </label>
        <label>
          省 / 州
          <input name="province" defaultValue={place?.province || ""} placeholder="例如：浙江省" />
        </label>
      </div>
      <div className="form-row">
        <label>
          城市
          <input name="city" defaultValue={place?.city} placeholder="杭州、绍兴..." />
        </label>
        <label>
          区 / 商圈
          <input name="area" defaultValue={place?.area} placeholder="例如：上城区、柯桥区、湖滨商圈" />
        </label>
      </div>
      <div className="form-row">
        <label>
          商场 / 园区 / 景区
          <input name="mall" defaultValue={place?.mall || ""} placeholder="如果这是商场本体，可留空；店铺可填所在商场" />
        </label>
        <label>
          店铺 / 场所
          <input name="storeName" defaultValue={place?.storeName} placeholder="分店、楼层、影厅、景点入口等" />
        </label>
      </div>
      <p className="form-hint">层级按国家 / 省 / 市 / 商场 / 店铺记录；地点名称填主名称，商场和店铺分开更清晰。</p>
      <div className="form-row">
        <label>
          地点名称
          <input name="name" defaultValue={place?.name} required />
        </label>
        <label>
          分类
          <SelectPicker
            name="category"
            label="地点分类"
            defaultValue={place?.category || "餐厅"}
            options={PLACE_CATEGORY_OPTIONS}
          />
        </label>
      </div>
      <label>
        详细地址
        <input name="address" defaultValue={place?.address || ""} placeholder="例如：杭州市上城区湖滨银泰 B1" />
      </label>
      <div className="form-row">
        <label>
          评分
          <NumberStepper
            name="rating"
            min={0}
            max={5}
            step={0.1}
            defaultValue={place?.rating ?? 4.5}
            label="地点评分"
          />
        </label>
        <label>
          收藏
          <SelectPicker
            name="favorite"
            label="地点收藏"
            defaultValue={place?.favorite ? "true" : "false"}
            options={BOOLEAN_OPTIONS}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          高德分享链接
          <input name="mapUrl" defaultValue={place?.mapUrl || ""} placeholder="粘贴高德分享链接，详情页可直接打开高德" />
        </label>
        <label>
          参考链接 / 攻略链接
          <input name="sourceUrl" defaultValue={place?.sourceUrl || ""} placeholder="官网、攻略、笔记或圆周旅迹链接" />
        </label>
      </div>
      <div className="form-row">
        <label>
          纬度
          <input name="latitude" defaultValue={place?.latitude || ""} inputMode="decimal" placeholder="例如：30.2741" />
        </label>
        <label>
          经度
          <input name="longitude" defaultValue={place?.longitude || ""} inputMode="decimal" placeholder="例如：120.1551" />
        </label>
      </div>
      <p className="form-hint">有高德分享链接时优先用链接；也可以直接填写经纬度作为定位。</p>
      <PlatformLinksEditor initialText={extractPlatformLinksText(place)} />
      <label>
        照片链接
        <textarea
          name="photos"
          defaultValue={(place?.photos || []).join("\n")}
          placeholder="每行一个图片链接，可以先粘贴高德或其他来源的图片 URL"
        />
      </label>
      <p className="form-hint">详情页会展示前 3 张照片；链接失效时会自动隐藏。</p>
      <label>
        描述
        <textarea name="desc" defaultValue={place?.desc} placeholder="适合约会或聚餐，环境安静..." />
      </label>
      <label>
        标签
        <input name="tags" defaultValue={place?.tags.join("，")} placeholder="安静、推荐；可用顿号、逗号或分号分隔" />
      </label>
    </>
  );
}

function placeToDraft(place?: Partial<Place>): Partial<PlaceDraft> {
  if (!place) return {};
  return {
    name: place.name || "",
    country: place.country || "中国",
    province: place.province || "",
    city: place.city || "",
    area: place.area || "",
    mall: place.mall || "",
    storeName: place.storeName || "",
    category: place.category || "其他",
    rating: place.rating || 4,
    address: place.address || "",
    latitude: place.latitude ? String(place.latitude) : "",
    longitude: place.longitude ? String(place.longitude) : "",
    mapUrl: place.mapUrl || "",
    sourceUrl: place.sourceUrl || "",
    platformLinks: platformLinksToText(place.platformLinks || []),
    photos: (place.photos || []).join("\n"),
    desc: place.desc || "",
    tags: (place.tags || []).join("，")
  };
}

function QuickPlaceFields({ initialPlaceDraft }: { initialPlaceDraft?: Partial<Place> }) {
  const { settings } = useLifeLog();
  const [shareText, setShareText] = useState("");
  const [draft, setDraft] = useState<PlaceDraft>(() => ({
    ...emptyPlaceDraft(),
    ...placeToDraft(initialPlaceDraft),
    city: initialPlaceDraft?.city || settings.defaultCity
  }));
  const [message, setMessage] = useState("");
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [showLinkDetails, setShowLinkDetails] = useState(false);

  function applyShareText() {
    const parsed = parsePlaceShare(shareText);
    const patch = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== "" && v !== 0)
    ) as Partial<PlaceDraft>;
    setDraft((current) => ({ ...current, ...patch }));
    setMessage(
      parsed.confidence
        ? `已识别 ${parsed.confidence}%：${parsed.sourceType === "generic" ? "普通文本" : parsed.sourceType}`
        : "没有识别到明确地点，可以先手动填写。"
    );
  }

  function updateDraft(patch: Partial<PlaceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <>
      <div className="share-import">
        <label>
          粘贴地图 / 点评分享
          <textarea
            value={shareText}
            onChange={(event) => setShareText(event.target.value)}
            placeholder="粘贴高德、美团、大众点评分享文本或链接"
          />
        </label>
        <button type="button" className="mini-action add" onClick={applyShareText}>
          识别分享
        </button>
        {message && <p className="form-hint">{message}</p>}
        {draft.name && (
          <div className="import-preview">
            <span>{draft.sourceType === "generic" ? "文本" : draft.sourceType}</span>
            <strong>{draft.name}</strong>
            <small>{[draft.province, draft.city, draft.mall || draft.address].filter(Boolean).join(" · ") || "可继续补充城市和地址"}</small>
          </div>
        )}
      </div>

      <div className="form-row">
        <label>
          地点名称
          <input
            name="name"
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="例如：九月里·自由花园餐厅"
            required
          />
        </label>
        <label>
          类型
          <SelectPicker
            name="category"
            label="地点类型"
            value={draft.category}
            onChange={(value) => updateDraft({
              category: value,
              mall: value === "商场" && draft.name && !draft.mall ? draft.name : draft.mall
            })}
            options={PLACE_CATEGORY_OPTIONS}
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          城市
          <input
            name="city"
            value={draft.city}
            onChange={(event) => updateDraft({ city: event.target.value })}
            placeholder="例如：绍兴"
          />
        </label>
        <label>
          商场 / 园区
          <input
            name="mall"
            value={draft.mall}
            onChange={(event) => updateDraft({ mall: event.target.value })}
            placeholder="商场本体可填自己的名称；店铺可填所在商场"
          />
        </label>
      </div>
      <label>
        一句话备注
        <textarea
          name="desc"
          value={draft.desc}
          onChange={(event) => updateDraft({ desc: event.target.value })}
          placeholder="例如：朋友推荐，想下次去试试。"
        />
      </label>
      <p className="form-hint">先写名称、类型、城市和商场就够了，区、店铺、地址和外部链接可以后面再补。</p>

      <button
        type="button"
        className={`inline-disclosure ${showLocationDetails ? "open" : ""}`}
        onClick={() => setShowLocationDetails((current) => !current)}
      >
        <span className="inline-disclosure-copy">
          <span className="inline-disclosure-title">
            <MapPinPlus size={16} />
            补充位置层级
          </span>
          <span className="inline-disclosure-meta">
            {buildPlaceDisclosureSummary(
              [draft.province, draft.area, draft.storeName, draft.address],
              "省、市区、店铺、详细地址"
            )}
          </span>
        </span>
        {showLocationDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <div className={`inline-disclosure-panel ${showLocationDetails ? "open" : ""}`}>
        <div className="form-row">
          <label>
            省 / 州
            <input
              name="province"
              value={draft.province}
              onChange={(event) => updateDraft({ province: event.target.value })}
              placeholder="例如：浙江省"
            />
          </label>
          <label>
            区 / 商圈
            <input
              name="area"
              value={draft.area}
              onChange={(event) => updateDraft({ area: event.target.value })}
              placeholder="例如：柯桥区、湖滨商圈"
            />
          </label>
        </div>
        <label>
          店铺 / 场所
          <input
            name="storeName"
            value={draft.storeName}
            onChange={(event) => updateDraft({ storeName: event.target.value })}
            placeholder="例如：玉兰国际店、B1 店、IMAX 厅"
          />
        </label>
        <label>
          详细地址
          <input
            name="address"
            value={draft.address}
            onChange={(event) => updateDraft({ address: event.target.value })}
            placeholder="例如：瓜渚湖地铁站 B 口步行 430 米"
          />
        </label>
        <div className="form-row">
          <label>
            纬度
            <input
              name="latitude"
              inputMode="decimal"
              value={draft.latitude}
              onChange={(event) => updateDraft({ latitude: event.target.value })}
              placeholder="例如：30.2741"
            />
          </label>
          <label>
            经度
            <input
              name="longitude"
              inputMode="decimal"
              value={draft.longitude}
              onChange={(event) => updateDraft({ longitude: event.target.value })}
              placeholder="例如：120.1551"
            />
          </label>
        </div>
        <p className="form-hint">如果没有高德链接，可以先填经纬度作为定位。</p>
      </div>

      <button
        type="button"
        className={`inline-disclosure ${showLinkDetails ? "open" : ""}`}
        onClick={() => setShowLinkDetails((current) => !current)}
      >
        <span className="inline-disclosure-copy">
          <span className="inline-disclosure-title">
            <Link2 size={16} />
            补充链接和标签
          </span>
          <span className="inline-disclosure-meta">
            {buildPlaceDisclosureSummary(
              [
                draft.mapUrl && "高德",
                extractPlatformLinksTextFromDraft(draft) && "平台链接",
                draft.sourceUrl && "参考链接",
                draft.photos && "照片",
                draft.tags && "标签"
              ],
              "高德、美团、参考链接、照片、标签"
            )}
          </span>
        </span>
        {showLinkDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <div className={`inline-disclosure-panel ${showLinkDetails ? "open" : ""}`}>
        <label>
          高德分享链接
          <input
            name="mapUrl"
            value={draft.mapUrl}
            onChange={(event) => updateDraft({ mapUrl: event.target.value })}
            placeholder="粘贴高德分享链接，详情页可直接打开高德"
          />
        </label>
        <label>
          参考链接
          <input
            name="sourceUrl"
            value={draft.sourceUrl}
            onChange={(event) => updateDraft({ sourceUrl: event.target.value })}
            placeholder="官网、攻略、笔记或其他参考链接"
          />
        </label>
        <label>
          照片链接
          <textarea
            name="photos"
            value={draft.photos}
            onChange={(event) => updateDraft({ photos: event.target.value })}
            placeholder="每行一个图片链接"
          />
        </label>
        <PlatformLinksEditor
          initialText={draft.platformLinks}
          includeHiddenInput={false}
          onChange={(platformLinks) => updateDraft({ platformLinks })}
        />
        <label>
          标签
          <input
            name="tags"
            value={draft.tags}
            onChange={(event) => updateDraft({ tags: event.target.value })}
            placeholder="约会、回头客；可用顿号、逗号或分号分隔"
          />
        </label>
      </div>

      <input type="hidden" name="country" value={draft.country || "中国"} />
      <input type="hidden" name="rating" value={draft.rating || 4} />
      <input type="hidden" name="favorite" value="false" />
      <input type="hidden" name="platformLinks" value={extractPlatformLinksTextFromDraft(draft)} />
      <p className="form-hint">如果是第一次录入，先保存核心信息即可；地点详情页里随时可以继续完善。</p>
    </>
  );
}

function extractPlatformLinksText(place?: Place) {
  if (!place) return "";
  const savedLinksText = platformLinksToText(place.platformLinks);
  if (savedLinksText) return savedLinksText;

  return [getPlacePlatformLink(place, "meituan"), getPlacePlatformLink(place, "dianping")]
    .filter((link): link is PlaceExternalLink => Boolean(link))
    .map((link) => `${link.label} | ${link.url}`)
    .join("\n");
}

interface PlatformLinkEditorRow {
  id: string;
  platform: PlaceLinkPlatform;
  label: string;
  url: string;
  enabled: boolean;
}

function PlatformLinksEditor({
  initialText,
  includeHiddenInput = true,
  onChange
}: {
  initialText: string;
  includeHiddenInput?: boolean;
  onChange?: (value: string) => void;
}) {
  const lastEmittedText = useRef("");
  const [rows, setRows] = useState<PlatformLinkEditorRow[]>(() => buildPlatformLinkRows(initialText));
  const visibleRows = rows.filter((row) => row.enabled || row.url.trim() || row.platform === "custom");
  const payload = buildPlatformLinksPayload(rows);

  useEffect(() => {
    if (initialText === lastEmittedText.current) return;
    setRows(buildPlatformLinkRows(initialText));
  }, [initialText]);

  function commitRows(nextRows: PlatformLinkEditorRow[]) {
    const nextPayload = buildPlatformLinksPayload(nextRows);
    lastEmittedText.current = nextPayload;
    setRows(nextRows);
    onChange?.(nextPayload);
  }

  function togglePreset(platform: PresetPlaceLinkPlatform) {
    commitRows(
      rows.map((row) => {
        if (row.platform !== platform) return row;
        const active = row.enabled || Boolean(row.url.trim());
        return {
          ...row,
          url: active ? "" : row.url,
          enabled: !active
        };
      })
    );
  }

  function updateRow(id: string, patch: Partial<PlatformLinkEditorRow>) {
    const patchedRows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
    const changedRow = patchedRows.find((row) => row.id === id);
    if (!changedRow || patch.url === undefined) {
      commitRows(patchedRows);
      return;
    }

    commitRows(autoAssignPlatformLink(patchedRows, changedRow));
  }

  function collapseRow(id: string) {
    commitRows(
      rows
        .map((row) => (row.id === id ? { ...row, url: "", enabled: row.platform === "custom" ? true : false } : row))
        .filter((row) => row.platform !== "custom" || row.id !== id)
    );
  }

  function addCustomLink() {
    commitRows([
      ...rows,
      {
        id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        platform: "custom",
        label: "",
        url: "",
        enabled: true
      }
    ]);
  }

  return (
    <div className="platform-link-editor">
      {includeHiddenInput && <input type="hidden" name="platformLinks" value={payload} />}
      <div className="field-title">平台店铺链接</div>
      <div className="platform-link-selector" aria-label="选择平台链接类型">
        {PLATFORM_PRESETS.map((preset) => {
          const row = rows.find((item) => item.platform === preset.platform);
          const active = Boolean(row?.enabled || row?.url.trim());
          return (
            <button
              type="button"
              className={`platform-link-chip ${active ? "active" : ""}`}
              aria-pressed={active}
              key={preset.platform}
              onClick={() => togglePreset(preset.platform)}
            >
              {preset.label}
            </button>
          );
        })}
        <button type="button" className="platform-link-chip custom" onClick={addCustomLink}>
          自定义
        </button>
      </div>

      {visibleRows.length > 0 && (
        <div className="platform-link-list">
          {visibleRows.map((row) => {
            const preset = PLATFORM_PRESETS.find((item) => item.platform === row.platform);
            return (
              <div className="platform-link-row" key={row.id}>
                <div className="platform-link-row-head">
                  <strong>{preset?.label || row.label || "自定义链接"}</strong>
                  {row.platform === "custom" ? (
                    <button type="button" className="mini-action danger" onClick={() => collapseRow(row.id)}>
                      移除
                    </button>
                  ) : (
                    <span>再次点击上方平台可取消</span>
                  )}
                </div>
                {row.platform === "custom" && (
                  <input
                    aria-label="自定义平台名称"
                    value={row.label}
                    onChange={(event) => updateRow(row.id, { label: event.target.value })}
                    placeholder="平台名称，例如：小红书、官网、公众号"
                  />
                )}
                <input
                  aria-label={`${preset?.label || row.label || "自定义"}链接`}
                  value={row.url}
                  onChange={(event) => updateRow(row.id, { url: event.target.value })}
                  placeholder={preset?.placeholder || "粘贴对应平台链接"}
                />
              </div>
            );
          })}
        </div>
      )}
      <p className="form-hint">点击平台选择，再次点击取消；选中后填写对应店铺链接，未填写链接的平台不会保存。</p>
    </div>
  );
}

function buildPlatformLinkRows(value: string): PlatformLinkEditorRow[] {
  const parsedLinks = parsePlatformLinksText(value);
  const usedLinkIndexes = new Set<number>();
  const presetRows = PLATFORM_PRESETS.map((preset) => {
    const linkIndex = parsedLinks.findIndex((link, index) => link.platform === preset.platform && !usedLinkIndexes.has(index));
    const link = linkIndex >= 0 ? parsedLinks[linkIndex] : undefined;
    if (linkIndex >= 0) usedLinkIndexes.add(linkIndex);

    return {
      id: preset.platform,
      platform: preset.platform,
      label: preset.label,
      url: link?.url || "",
      enabled: Boolean(link?.url)
    };
  });
  const customRows = parsedLinks
    .filter((link, index) => link.platform === "custom" || !usedLinkIndexes.has(index))
    .map((link, index) => ({
      id: `custom-${index}-${link.url}`,
      platform: "custom" as const,
      label: link.label,
      url: link.url,
      enabled: true
    }));

  return [...presetRows, ...customRows];
}

function buildPlatformLinksPayload(rows: PlatformLinkEditorRow[]) {
  return rows
    .map((row) => {
      const url = row.url.trim();
      if (!url) return "";
      const label = row.platform === "custom" ? row.label.trim() || "链接" : PLATFORM_PRESETS.find((item) => item.platform === row.platform)?.label || row.label;
      return `${label} | ${url}`;
    })
    .filter(Boolean)
    .join("\n");
}

function extractPlatformLinksTextFromDraft(draft: PlaceDraft) {
  if (draft.platformLinks.trim()) return draft.platformLinks;
  const link = createPlatformLink(
    draft.sourceUrl,
    draft.sourceType === "meituan" ? "美团" : draft.sourceType === "dianping" ? "点评" : ""
  );
  if (!link || link.platform === "custom") return "";
  return `${link.label} | ${link.url}`;
}

function autoAssignPlatformLink(rows: PlatformLinkEditorRow[], changedRow: PlatformLinkEditorRow) {
  const url = changedRow.url.trim();
  if (!url) return rows;

  const inferredPlatform = inferPlatformFromLink(url, changedRow.label);
  if (inferredPlatform === "custom" || inferredPlatform === changedRow.platform) {
    return rows.map((row) => (row.id === changedRow.id ? { ...row, enabled: true } : row));
  }

  const target = rows.find((row) => row.platform === inferredPlatform);
  if (!target || target.platform === "custom") return rows;

  const targetHasDifferentUrl = target.url.trim() && target.url.trim() !== url;
  if (targetHasDifferentUrl) {
    return rows.map((row) => (row.id === changedRow.id ? { ...row, enabled: true } : row));
  }

  return rows
    .map((row) => {
      if (row.id === target.id) {
        return {
          ...row,
          url,
          enabled: true
        };
      }
      if (row.id === changedRow.id) {
        return {
          ...row,
          url: "",
          enabled: row.platform === "custom"
        };
      }
      return row;
    })
    .filter((row) => row.platform !== "custom" || row.id !== changedRow.id || row.label.trim() || row.url.trim());
}

function buildPlaceDisclosureSummary(items: Array<string | false | undefined>, fallback: string) {
  const normalized = items.map((item) => String(item || "").trim()).filter(Boolean);
  if (!normalized.length) return fallback;
  if (normalized.length <= 2) return normalized.join(" · ");
  return `${normalized.slice(0, 2).join(" · ")} 等 ${normalized.length} 项`;
}
