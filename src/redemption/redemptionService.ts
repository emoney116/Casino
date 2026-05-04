import { createId } from "../lib/ids";
import { readData, updateData } from "../lib/storage";
import type { Currency, RedemptionRequest, RedemptionRequestStatus } from "../types";
import { defaultKycStatus, redemptionConfig } from "../config/complianceConfig";
import { getCurrencyMeta, isRedemptionEnabled, redeemableCurrency } from "../config/currencyConfig";
import { getBalance, recordWalletEvent } from "../wallet/walletService";

export function getRedeemableBalance(userId: string) {
  return getBalance(userId, redeemableCurrency);
}

export function getKycStatus(userId: string) {
  return readData().kycStatuses[userId] ?? defaultKycStatus;
}

export function getEligibilityFlags(userId: string) {
  return readData().eligibilityFlags[userId] ?? {};
}

export function getRedemptionRequests(userId?: string) {
  const requests = readData().redemptionRequests;
  return (userId ? requests.filter((request) => request.userId === userId) : requests)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function canRequestRedemption(currency: Currency) {
  const meta = getCurrencyMeta(currency);
  return meta.canBeRedeemed && isRedemptionEnabled(currency) && redemptionConfig.enabled;
}

export function createRedemptionRequest(userId: string, amount: number): RedemptionRequest {
  if (!canRequestRedemption(redeemableCurrency)) {
    throw new Error("Redemptions are not currently enabled in this prototype.");
  }
  if (amount < redemptionConfig.minimumRedemptionAmount) {
    throw new Error(`Minimum redemption placeholder is ${redemptionConfig.minimumRedemptionAmount}.`);
  }
  if (getRedeemableBalance(userId) < amount) {
    throw new Error("Insufficient redeemable balance.");
  }

  const now = new Date().toISOString();
  const request: RedemptionRequest = {
    id: createId("redemption"),
    userId,
    currency: redeemableCurrency,
    amount,
    status: "CREATED",
    createdAt: now,
    updatedAt: now,
    note: "Prototype placeholder only.",
  };

  updateData((data) => {
    data.redemptionRequests.push(request);
  });
  recordWalletEvent({
    userId,
    currency: redeemableCurrency,
    amount: 0,
    type: "REDEMPTION_REQUEST_CREATED",
    metadata: { requestId: request.id, prototypeOnly: true },
  });
  return request;
}

export function recordRedemptionStatusEvent({
  userId,
  requestId,
  status,
}: {
  userId: string;
  requestId: string;
  status: Exclude<RedemptionRequestStatus, "CREATED">;
}) {
  const type = status === "APPROVED"
    ? "REDEMPTION_REQUEST_APPROVED"
    : status === "REJECTED"
      ? "REDEMPTION_REQUEST_REJECTED"
      : "REDEMPTION_REQUEST_CANCELLED";
  return recordWalletEvent({
    userId,
    currency: redeemableCurrency,
    amount: 0,
    type,
    metadata: { requestId, prototypeOnly: true },
  });
}
