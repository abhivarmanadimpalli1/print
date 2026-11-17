import React, { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface ClarifyOrderModalProps {
  orderNumber: number;
  currentAmount: number;
  onConfirm: (note: string, revisedAmount?: number) => void;
  onClose: () => void;
}

export const ClarifyOrderModal: React.FC<ClarifyOrderModalProps> = ({
  orderNumber,
  currentAmount,
  onConfirm,
  onClose,
}) => {
  const [note, setNote] = useState<string>('Cover page is color, pages 2 onwards can be printed in B&W for a lower price. Please confirm at the counter.');
  const [shouldReviseAmount, setShouldReviseAmount] = useState<boolean>(false);
  const [revisedAmount, setRevisedAmount] = useState<number>(currentAmount);

  const handleConfirm = () => {
    if (!note.trim()) return;
    onConfirm(note.trim(), shouldReviseAmount ? revisedAmount : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-[12px] border border-[#e5e3df] shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#dd5b00] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            <h3 className="text-sm font-semibold">Request Clarification #{orderNumber}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-black/20 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5">
              Message to Customer
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs p-3 border border-[#c8c4be] rounded-[8px] outline-none focus:border-[#dd5b00]"
              placeholder="Explain formatting questions, color coverage, or binding options..."
            />
          </div>

          <div className="p-3 bg-[#f6f5f4] rounded-[8px] border border-[#e5e3df] space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#1a1a1a]">
              <input
                type="checkbox"
                checked={shouldReviseAmount}
                onChange={(e) => setShouldReviseAmount(e.target.checked)}
                className="accent-[#5645d4]"
              />
              <span>Revise Estimated Quote Amount</span>
            </label>

            {shouldReviseAmount && (
              <div className="pt-2 border-t border-[#e5e3df] flex items-center gap-3">
                <span className="text-xs text-[#787671]">New Total (₹):</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={revisedAmount}
                  onChange={(e) => setRevisedAmount(parseFloat(e.target.value) || 0)}
                  className="w-28 h-9 px-2 text-sm font-bold border border-[#c8c4be] rounded-[6px] outline-none focus:border-[#5645d4]"
                />
                <span className="text-[11px] text-[#787671] line-through">₹{currentAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e3df]">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirm}>
              Send Update to Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
