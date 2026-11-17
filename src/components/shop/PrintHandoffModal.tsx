import React, { useState } from 'react';
import { Printer, AlertCircle, Cpu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Order } from '../../types';
import { getAttachmentBlob, getOrderAttachments } from '../../lib/orderAttachments';

interface PrintHandoffModalProps {
  order: Order;
  onConfirmPrint: () => void;
  onClose: () => void;
}

export const PrintHandoffModal: React.FC<PrintHandoffModalProps> = ({
  order,
  onConfirmPrint,
  onClose,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [fileIndex, setFileIndex] = useState(0);
  const files = getOrderAttachments(order).filter(file => file.storagePath || file.legacyUrl);
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
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          // The browser may require opening the print dialog manually.
        } finally {
          URL.revokeObjectURL(url);
        }
      }, 1000);
      onConfirmPrint();
    } catch {
      printWindow.close();
      setError('Could not open the original file. Try downloading it from the order.');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-[12px] border border-[#e5e3df] shadow-2xl max-w-lg w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0a1530] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#f9e79f]" />
            <h3 className="text-sm font-semibold">Print Order #{order.orderNumber}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Print Specification Summary */}
          <div className="p-3.5 bg-[#f6f5f4] rounded-[8px] border border-[#e5e3df] space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="order-print-file" className="text-[#787671]">File</label>
              <select
                id="order-print-file"
                className="max-w-[240px] rounded border border-[#e5e3df] bg-white px-2 py-1 font-semibold"
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
              <span className="text-[#787671]">Target Setup:</span>
              <span className="font-semibold text-[#5645d4]">
                {order.config.colorMode.toUpperCase()} • {order.config.sides === 'duplex' ? 'Duplex (Two-sided)' : 'Single-sided'} • {order.config.paperSize}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#787671]">Sheets Required:</span>
              <span className="font-semibold text-[#1a1a1a]">{order.config.sheetsNeeded} sheets ({order.config.copies} copies)</span>
            </div>
          </div>

          {/* Browser Sandbox Architectural Notice */}
          <div className="p-3.5 bg-[#dcecfa] border border-[#0075de]/30 rounded-[8px] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#005bab]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Browser Printing Boundary & Integration</span>
            </div>
            <p className="text-[11px] text-[#1a2a52] leading-relaxed">
              Standard web browsers operate inside a security sandbox and <strong>cannot silently bypass the OS print dialog</strong> or force specific tray/duplex hardware commands without user confirmation.
            </p>
            <p className="text-[11px] text-[#1a2a52] leading-relaxed">
              Clicking <strong>"Launch Browser Print Dialog"</strong> below will open the document and show your computer's native system print window with the requested settings.
            </p>
          </div>

          {/* Integration boundary for native desktop helper */}
          <div className="p-3 bg-[#f8f5e8] border border-[#e5e3df] rounded-[8px] flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-[#dd5b00] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#523410]">
              <strong className="block font-semibold">Future Hardware Integration:</strong>
              For zero-click automated direct printing, run the companion desktop print daemon (<code className="font-mono bg-white/70 px-1 rounded">localhost:7890/spool</code>) to interface directly with CUPS or Windows Spooler.
            </div>
          </div>

          {/* Actions */}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e3df]">
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
              Launch Browser Print Dialog & Set "Printing"
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};
