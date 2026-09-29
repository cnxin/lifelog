export function normalizeNotionId(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const decoded = decodeURIComponent(raw);
  const matches = decoded.replace(/-/g, "").match(/[0-9a-f]{32}/gi);
  if (matches?.length) return matches[matches.length - 1].toLowerCase();
  return decoded
    .replace(/^https:\/\/www\.notion\.so\//i, "")
    .split("?")[0]
    .replace(/-/g, "")
    .trim();
}
