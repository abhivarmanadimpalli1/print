import React, { useState } from 'react';
import { Printer, AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Order } from '../../types';
import { getAttachmentBlob, getOrderAttachments } from '../../lib/orderAttachments';

interface PrintHandoffModalProps {
  order: Order;
  onConfirmPrint: () => Promise<void>;
  onClose: () => void;
}

export const PrintHandoffModal: React.FC<PrintHandoffModalProps> = ({
  order,
  onConfirmPrint,
  onClose,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [hasOpenedFile, setHasOpenedFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileIndex, setFileIndex] = useState(0);
  const files = getOrderAttachments(order).filter(file => (file.storagePath || file.legacyUrl) && file.printPageCount !== 0);
  const attachment = files[fileIndex];

  const triggerBrowserPrint = async () => {
    if (!attachment) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups for this site to open the print file.');
      return;
    }
    setIsOpening(true);
    setError(null);
    try {
      const blob = await getAttachmentBlob(attachment);
      if (!/^(application\/pdf|image\/(jpeg|png|webp|bmp))$/.test(blob.type)) {
        throw new Error('The file cannot be previewed safely in the browser.');
      }
      const url = URL.createObjectURL(blob);
      printWindow.location.href = url;
      printWindow.focus();
      const cleanup = setInterval(() => {
        if (printWindow.closed) { URL.revokeObjectURL(url); clearInterval(cleanup); }
      }, 1000);
      setHasOpenedFile(true);
    } catch {
      printWindow.close();
      setError('Could not open the original file. Try downloading it from the order.');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#242424] rounded-none border border-[#3d3d3d] shadow-none max-w-lg w-full max-h-[90dvh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-[#181818] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#ffffff]" />
            <h3 className="text-sm font-semibold">Print Order #{order.orderNumber}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Print Specification Summary */}
          <div className="p-3.5 bg-[#1c1c1c] rounded-none border border-[#3d3d3d] space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="order-print-file" className="text-[#b0b0b0]">File</label>
              <select
                id="order-print-file"
                className="max-w-[240px] rounded border border-[#3d3d3d] bg-[#242424] px-2 py-1 font-semibold"
                value={fileIndex}
                disabled={isOpening || files.length < 2}
                onChange={event => setFileIndex(Number(event.target.value))}
              >
                {files.map((file, index) => (
                  <option key={file.storagePath ?? index} value={index}>{file.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">Target Setup:</span>
              <span className="font-semibold text-[#ff8278]">
                {order.config.colorMode.toUpperCase()} • {order.config.sides === 'duplex' ? 'Duplex (Two-sided)' : 'Single-sided'} • {order.config.paperSize}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2"><span className="text-[#b0b0b0]">Pages in this file:</span><strong className="text-white">{attachment?.printPageRange || order.config.customPageRange}</strong></div>
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">Sheets Required:</span>
              <span className="font-semibold text-[#ffffff]">{order.config.sheetsNeeded} sheets ({order.config.copies} copies)</span>
            </div>
          </div>

          <div className="p-3 border border-[#3d3d3d] space-y-2 text-xs text-[#bcbcbc]"><div className="flex items-center gap-2 text-white"><AlertCircle size={16} />Print the original files</div><p>Open each file, then use your browser’s Print command. Select the requested paper size, color, sides, copies and page range in the printer dialog.</p><p>After starting the print job, mark the order as printing below. Opening a file does not confirm that the printer printed it.</p></div>

          {/* Actions */}
          {error && <p role="alert" className="text-xs text-[#ff8278]">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3d3d3d]">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void triggerBrowserPrint()}
              disabled={isOpening || !attachment}
              icon={<Printer className="w-4 h-4" />}
            >
              Open selected file
            </Button>
          </div>
          <Button variant="secondary" className="w-full" disabled={!hasOpenedFile || isSaving} onClick={() => { setIsSaving(true); setError(null); void onConfirmPrint().catch(error => setError(error instanceof Error ? error.message : 'Could not save printing status.')).finally(() => setIsSaving(false)); }}>{isSaving ? 'Saving…' : 'I started printing — update order'}</Button>

        </div>
      </div>
    </div>
  );
};
