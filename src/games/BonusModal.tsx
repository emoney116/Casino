import { useState } from "react";
import { Modal } from "../components/Modal";
import { formatCoins } from "../lib/format";

export function BonusModal({
  title,
  message,
  awards,
  picks = 1,
  onResolve,
  onClose,
}: {
  title: string;
  message: string;
  awards?: number[];
  picks?: number;
  onResolve?: (award: number) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const resolved = picked.length >= picks || !awards;

  function choose(index: number, award: number) {
    if (resolved || picked.includes(index)) return;
    setPicked((current) => [...current, index]);
    onResolve?.(award);
  }

  return (
    <Modal title={title} onClose={resolved ? onClose : () => undefined}>
      <div className="modal-stack">
        <p>{message}</p>
        {awards && (
          <>
            <div className="pick-grid">
              {awards.map((award, index) => {
                const isPicked = picked.includes(index);
                return (
                  <button
                    className={`pick-card ${isPicked ? "revealed" : ""}`}
                    key={`${award}-${index}`}
                    disabled={resolved && !isPicked}
                    onClick={() => choose(index, award)}
                  >
                    {isPicked ? formatCoins(award) : "?"}
                  </button>
                );
              })}
            </div>
            <p className="muted">
              Pick {picks} card{picks > 1 ? "s" : ""}. Prize credits to the virtual wallet ledger.
            </p>
          </>
        )}
        <button className="primary-button" disabled={!resolved} onClick={onClose}>
          Continue
        </button>
      </div>
    </Modal>
  );
}
