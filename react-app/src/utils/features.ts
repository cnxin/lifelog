export type PremiumFeatureId =
  | "quickInbox"
  | "relationshipActionCenter"
  | "memoryFlashback"
  | "structuredWriting"
  | "readableExport"
  | "privacyMode";

export interface PurchaseVerificationResult {
  status: "unverified" | "active" | "expired" | "invalid";
  source: "local-dev" | "google-play" | "none";
  checkedAt: string;
  entitlementIds: PremiumFeatureId[];
}

export const premiumFeatureLabels: Record<PremiumFeatureId, string> = {
  quickInbox: "快速记录收件箱",
  relationshipActionCenter: "人物行动中心",
  memoryFlashback: "回忆闪回",
  structuredWriting: "结构化正文",
  readableExport: "可读导出",
  privacyMode: "隐私显示模式"
};

const unlockedByDefault = new Set<PremiumFeatureId>([
  "quickInbox",
  "relationshipActionCenter",
  "memoryFlashback",
  "structuredWriting",
  "readableExport",
  "privacyMode"
]);

export function isFeatureUnlocked(featureId: PremiumFeatureId) {
  return unlockedByDefault.has(featureId);
}

export function getPurchaseVerificationSnapshot(): PurchaseVerificationResult {
  return {
    status: "unverified",
    source: "none",
    checkedAt: new Date().toISOString(),
    entitlementIds: Array.from(unlockedByDefault)
  };
}

export function buildPurchaseVerificationPayload(purchaseToken: string, productId: string) {
  return {
    productId,
    purchaseToken,
    platform: "google-play",
    clientCheckedAt: new Date().toISOString()
  };
}
