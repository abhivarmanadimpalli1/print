import React, { useState } from 'react';
import { CreditCard, QrCode, ShieldCheck, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface PaymentModalProps {
  amount: number;
  customerName: string;
  onSuccess: (paymentId: string) => void;
  onCancel: () => void;
  onSwitchToCounter: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  amount,
  customerName,
  onSuccess,
  onCancel,
  onSwitchToCounter,
}) => {
  const [method, setMethod] = useState<'upi' | 'card'>('upi');
  const [upiId, setUpiId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulatePayment = (willSucceed: boolean) => {
    setIsProcessing(true);
    setError(null);

    setTimeout(() => {
      setIsProcessing(false);
      if (willSucceed) {
        onSuccess(`PAY-SIM-${Math.floor(100000 + Math.random() * 900000)}`);
      } else {
        setError('Simulation: Card/UPI bank authorization declined. Please retry or choose counter payment.');
      }
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#242424] rounded-none border border-[#3d3d3d] shadow-none max-w-md w-full overflow-hidden">
        
        {/* Banner with clear PROTOTYPE indication */}
        <div className="bg-[#181818] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#ffffff]" />
            <div>
              <h3 className="text-sm font-semibold">Online Payment Gateway</h3>
              <span className="text-[10px] font-mono tracking-wider text-[#969696] uppercase">
                [PROTOTYPE SANDBOX]
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#969696] hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount Due Card */}
          <div className="p-4 rounded-none bg-[#1c1c1c] border border-[#3d3d3d] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#b0b0b0]">Payable Amount</p>
              <p className="text-2xl font-bold text-[#ffffff]">₹{amount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#b0b0b0]">Customer</p>
              <p className="text-sm font-medium text-[#ffffff] truncate max-w-[140px]">{customerName || 'Walk-in'}</p>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod('upi')}
              className={`p-3 text-left border rounded-none transition-all cursor-pointer ${
                method === 'upi'
                  ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                  : 'border-[#3d3d3d] hover:bg-[#303030]'
              }`}
            >
              <QrCode className="w-5 h-5 text-[#ff8278] mb-1.5" />
              <p className="text-xs font-semibold text-[#ffffff]">UPI / QR Code</p>
              <p className="text-[11px] text-[#b0b0b0]">GPay, PhonePe, Paytm</p>
            </button>

            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`p-3 text-left border rounded-none transition-all cursor-pointer ${
                method === 'card'
                  ? 'border-[#da291c] bg-[#303030]/30 ring-1 ring-[#da291c]'
                  : 'border-[#3d3d3d] hover:bg-[#303030]'
              }`}
            >
              <CreditCard className="w-5 h-5 text-[#ff8278] mb-1.5" />
              <p className="text-xs font-semibold text-[#ffffff]">Debit / Credit Card</p>
              <p className="text-[11px] text-[#b0b0b0]">Visa, Mastercard, RuPay</p>
            </button>
          </div>

          {method === 'upi' ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center p-4 border border-[#3d3d3d] rounded-none bg-[#242424] text-center">
                <div className="w-32 h-32 bg-[#1c1c1c] border border-[#606060] rounded-none flex flex-col items-center justify-center p-2 mb-2">
                  <QrCode className="w-20 h-20 text-[#ffffff]" />
                  <span className="text-[9px] font-mono text-[#b0b0b0]">SCAN WITH ANY UPI APP</span>
                </div>
                <p className="text-xs text-[#bcbcbc]">Or enter UPI ID</p>
                <input
                  type="text"
                  placeholder="e.g. mobile@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="mt-1 w-full max-w-xs text-center text-xs h-9 border border-[#606060] rounded-none px-2"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <input
                type="text"
                placeholder="Card Number: 4532 •••• •••• 8892"
                disabled
                className="w-full text-xs h-9 border border-[#606060] rounded-none px-3 bg-[#303030]"
                value="4532 •••• •••• 8892 (Demo Card)"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="MM/YY"
                  disabled
                  className="w-full text-xs h-9 border border-[#606060] rounded-none px-3 bg-[#303030]"
                  value="12/28"
                />
                <input
                  type="text"
                  placeholder="CVV"
                  disabled
                  className="w-full text-xs h-9 border border-[#606060] rounded-none px-3 bg-[#303030]"
                  value="•••"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-[#402321] border border-[#e03131]/30 rounded-none flex items-start gap-2 text-xs text-[#ff8278]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Simulation Buttons */}
          <div className="space-y-2 pt-2 border-t border-[#3d3d3d]">
            <Button
              variant="primary"
              className="w-full"
              disabled={isProcessing}
              onClick={() => handleSimulatePayment(true)}
              icon={isProcessing ? undefined : <CheckCircle2 className="w-4 h-4" />}
            >
              {isProcessing ? 'Authorizing Mock Transaction...' : `Simulate Successful Payment (₹${amount.toFixed(2)})`}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 text-xs"
                disabled={isProcessing}
                onClick={() => handleSimulatePayment(false)}
              >
                Test Failed Payment
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-[#bcbcbc]"
                disabled={isProcessing}
                onClick={onSwitchToCounter}
              >
                Pay Cash/Counter instead
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-center text-[#969696]">
            🔒 Real deployment uses webhook-verified settlement through Stripe/Razorpay.
          </p>

        </div>
      </div>
    </div>
  );
};
