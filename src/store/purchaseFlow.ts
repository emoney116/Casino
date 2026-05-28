import { useState } from "react";
import type { User } from "../types";
import { fakePurchasePack } from "./fakePurchaseService";

export type PaymentStatus = "idle" | "loading" | "success" | "error" | "disabled";

export const cashierProvider = {
  id: "provider-placeholder",
  label: "Provider placeholder",
  realPaymentsEnabled: false,
} as const;

export function usePurchasePackage({
  user,
  onPurchased,
}: {
  user: User | null;
  onPurchased?: () => void;
}) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(user ? "idle" : "disabled");
  const [paymentError, setPaymentError] = useState("");

  function purchasePackage(packageId: string) {
    if (!user) {
      setPaymentStatus("disabled");
      setPaymentError("Sign in is required before purchasing coins.");
      return null;
    }

    setPaymentStatus("loading");
    setPaymentError("");

    try {
      const transaction = fakePurchasePack(user, packageId);
      setPaymentStatus("success");
      onPurchased?.();
      return transaction;
    } catch (error) {
      setPaymentStatus("error");
      setPaymentError(error instanceof Error ? error.message : "Purchase could not be completed.");
      return null;
    }
  }

  function resetPaymentStatus() {
    setPaymentStatus(user ? "idle" : "disabled");
    setPaymentError("");
  }

  return {
    paymentError,
    paymentStatus,
    provider: cashierProvider,
    purchasePackage,
    resetPaymentStatus,
  };
}
