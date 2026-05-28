export type PremiumFeatureId =
  | "cloudSync"
  | "cloudBackup"
  | "multiDeviceSync"
  | "cloudShareRestore";

export interface PurchaseVerificationResult {
  status: "unverified" | "active" | "expired" | "invalid";
  source: "local-dev" | "google-play" | "none";
  checkedAt: string;
  entitlementIds: PremiumFeatureId[];
}

export const premiumFeatureLabels: Record<PremiumFeatureId, string> = {
  cloudSync: "云端同步",
  cloudBackup: "云端备份",
  multiDeviceSync: "多设备同步",
  cloudShareRestore: "云端分享恢复"
};

const unlockedCloudEntitlements = new Set<PremiumFeatureId>();

export function isFeatureUnlocked(featureId: PremiumFeatureId) {
  return unlockedCloudEntitlements.has(featureId);
}

export function getPurchaseVerificationSnapshot(): PurchaseVerificationResult {
  return {
    status: "unverified",
    source: "none",
    checkedAt: new Date().toISOString(),
    entitlementIds: Array.from(unlockedCloudEntitlements)
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
