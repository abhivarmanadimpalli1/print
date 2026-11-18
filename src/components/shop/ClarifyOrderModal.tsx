import React, { useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface ClarifyOrderModalProps {
  orderNumber: number;
  currentAmount: number;
  onConfirm: (note: string, revisedAmount?: number) => Promise<void>;
  onClose: () => void;
}

export const ClarifyOrderModal: React.FC<ClarifyOrderModalProps> = ({
  orderNumber,
  currentAmount,
  onConfirm,
  onClose,
}) => {
  const [note, setNote] = useState<string>('');
  const [shouldReviseAmount, setShouldReviseAmount] = useState<boolean>(false);
  const [revisedAmount, setRevisedAmount] = useState<number>(currentAmount);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleConfirm = async () => {
    if (!note.trim() || isSaving) return;
    setIsSaving(true); setError(null);
    try { await onConfirm(note.trim(), shouldReviseAmount ? revisedAmount : undefined); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save this update.'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#242424] rounded-none border border-[#3d3d3d] shadow-none max-w-md w-full max-h-[90dvh] overflow-y-auto">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5">
              Message to Customer
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs p-3 border border-[#606060] rounded-none outline-none focus:border-[#dd5b00]"
              placeholder="Explain formatting questions, color coverage, or binding options..."
            />
          </div>

          <div className="p-3 bg-[#1c1c1c] rounded-none border border-[#3d3d3d] space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#ffffff]">
              <input
                type="checkbox"
                checked={shouldReviseAmount}
                onChange={(e) => setShouldReviseAmount(e.target.checked)}
                className="accent-[#da291c]"
              />
              <span>Revise Estimated Quote Amount</span>
            </label>

            {shouldReviseAmount && (
              <div className="pt-2 border-t border-[#3d3d3d] flex items-center gap-3">
                <span className="text-xs text-[#b0b0b0]">New Total (₹):</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={revisedAmount}
                  onChange={(e) => setRevisedAmount(parseFloat(e.target.value) || 0)}
                  className="w-28 h-9 px-2 text-sm font-bold border border-[#606060] rounded-none outline-none focus:border-[#da291c]"
                />
                <span className="text-[11px] text-[#b0b0b0] line-through">₹{currentAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {error && <p role="alert" className="text-xs text-[#ff8278]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#3d3d3d]">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleConfirm()} disabled={isSaving || !note.trim()}>
              {isSaving ? 'Saving…' : 'Send Update to Order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
