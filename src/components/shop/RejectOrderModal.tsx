import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface RejectOrderModalProps {
  orderNumber: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export const RejectOrderModal: React.FC<RejectOrderModalProps> = ({
  orderNumber,
  onConfirm,
  onClose,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('Corrupt or password-protected PDF');
  const [customNote, setCustomNote] = useState<string>('');

  const commonReasons = [
    'Corrupt or password-protected PDF',
    'Requested paper size currently out of stock',
    'Color toner currently undergoing maintenance',
    'File requires special binding not offered',
    'Customer requested cancellation at counter',
  ];

  const handleConfirm = () => {
    const finalReason = selectedReason === 'Other' ? (customNote.trim() || 'Declined by shop counter') : selectedReason;
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-[12px] border border-[#e5e3df] shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#e03131] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-sm font-semibold">Reject Order #{orderNumber}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-black/20 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[#5d5b54]">
            Select a reason so the customer understands why the job cannot be printed:
          </p>

          <div className="space-y-2">
            {commonReasons.map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2.5 p-2.5 rounded-[8px] border border-[#e5e3df] hover:bg-[#fafaf9] cursor-pointer text-xs"
              >
                <input
                  type="radio"
                  name="reject-reason"
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="accent-[#e03131]"
                />
                <span className="text-[#1a1a1a]">{reason}</span>
              </label>
            ))}

            <label className="flex items-center gap-2.5 p-2.5 rounded-[8px] border border-[#e5e3df] hover:bg-[#fafaf9] cursor-pointer text-xs">
              <input
                type="radio"
                name="reject-reason"
                checked={selectedReason === 'Other'}
                onChange={() => setSelectedReason('Other')}
                className="accent-[#e03131]"
              />
              <span className="text-[#1a1a1a]">Other / Custom reason</span>
            </label>
          </div>

          {selectedReason === 'Other' && (
            <textarea
              placeholder="Enter explanation for the customer..."
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full text-xs p-2.5 border border-[#c8c4be] rounded-[8px] outline-none focus:border-[#e03131]"
            />
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e3df]">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirm}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
