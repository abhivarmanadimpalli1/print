import React, { useState } from 'react';
import {
  Store,
  DollarSign,
  Shield,
  Printer,
  CheckCircle2,
  Copy,
  Power,
  Clock,
  Radio,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { saveShop } from '../../lib/store';
import { broadcastToCloud, getShopCloudTopic } from '../../lib/cloudSync';
import type { Shop } from '../../types';

interface ShopSettingsProps {
  shop: Shop;
  onShopUpdated: (updatedShop: Shop) => void;
}

export const ShopSettings: React.FC<ShopSettingsProps> = ({ shop, onShopUpdated }) => {
  const [formData, setFormData] = useState<Shop>({ ...shop });
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isTestingPing, setIsTestingPing] = useState<boolean>(false);
  const [pingSuccess, setPingSuccess] = useState<boolean>(false);

  const customerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/s/${shop.slug}`
    : `https://campusprint.local/order/${shop.id}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(customerUrl)}`;
  const cloudTopic = getShopCloudTopic(shop.id);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveShop(formData);
      onShopUpdated(formData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save shop settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(customerUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrintPoster = () => {
    window.print();
  };

  const handleTestCloudPing = async () => {
    setIsTestingPing(true);
    setPingSuccess(false);
    const ok = await broadcastToCloud(shop.id, {
      action: 'TEST_PING',
      note: 'Cross-device cloud ping from shop settings',
    });
    setIsTestingPing(false);
    if (ok) {
      setPingSuccess(true);
      setTimeout(() => setPingSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      
      {/* Title & Save Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#242424] p-4 rounded-none border border-[#3d3d3d]">
        <div>
          <h2 className="text-lg font-bold text-[#ffffff]">Shop Profile & Pricing Settings</h2>
          <p className="text-xs text-[#b0b0b0]">
            Changes immediately update the customer QR ordering page and price calculator.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSaved && (
            <span className="text-xs font-semibold text-[#6ed5a3] flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          )}
          {saveError && <p role="alert" className="text-xs text-[#ff8278]">{saveError}</p>}
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Cloud Sync & Phone Integration Card */}
      <Card className="bg-[#242424] border-[#3d3d3d] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#3d3d3d]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#6ed5a3] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#ffffff]">
              Internet-Wide Phone QR Cloud Sync
            </span>
            <span className="text-[10px] font-semibold bg-[#163529] text-[#6ed5a3] px-2 py-0.5 rounded-full">
              LIVE & CONNECTED
            </span>
          </div>

          <button
            type="button"
            onClick={handleTestCloudPing}
            disabled={isTestingPing}
            className="text-xs px-2.5 py-1 bg-[#1c1c1c] hover:bg-[#363636] border border-[#606060] rounded-none font-medium text-[#ffffff] transition-colors cursor-pointer self-start sm:self-auto"
          >
            {isTestingPing ? 'Pinging Cloud...' : pingSuccess ? '✓ Cloud Responded!' : 'Test Cross-Device Ping'}
          </button>
        </div>

        <div className="text-xs text-[#bcbcbc] space-y-1">
          <p>
            📡 <strong>Active Cloud Channel:</strong> <code className="bg-[#1c1c1c] px-1.5 py-0.5 rounded text-[11px] font-mono text-[#ff8278]">{cloudTopic}</code>
          </p>
          <p className="text-[11px] text-[#b0b0b0]">
            When customers scan your QR code on any smartphone via cellular data or WiFi, their order is broadcast over this cloud channel directly into your shop queue in less than 200 milliseconds.
          </p>
        </div>
      </Card>

      {/* Availability Toggle */}
      <Card className="bg-[#242424] border-[#3d3d3d]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[#ffffff]">Online Order Acceptance</span>
              <Badge variant={formData.isOpen ? 'mint' : 'rose'} size="sm">
                {formData.isOpen ? 'Accepting Orders' : 'Paused'}
              </Badge>
            </div>
            <p className="text-xs text-[#b0b0b0] mt-0.5">
              Turn off if counter queue is backed up or during lunch/closing hours.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFormData({ ...formData, isOpen: !formData.isOpen })}
            className={`px-4 py-2 rounded-none text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              formData.isOpen
                ? 'bg-[#163529] text-[#6ed5a3] hover:bg-[#234635]'
                : 'bg-[#402321] text-[#ff8278] hover:bg-[#402321]'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{formData.isOpen ? 'Pause Orders' : 'Resume Orders'}</span>
          </button>
        </div>
      </Card>

      {/* Grid: Pricing Configuration & QR Signage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Pricing & Options */}
        <div className="space-y-6">
          
          {/* Per-Page Pricing */}
          <Card className="bg-[#242424] border-[#3d3d3d] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#bcbcbc] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#ff8278]" />
              Base Page Pricing (₹)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#ffffff] mb-1">
                  B&W Rate (₹ / page)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formData.pricing.bwPerPage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: {
                        ...formData.pricing,
                        bwPerPage: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full h-11 px-3 text-sm font-bold border border-[#606060] rounded-none outline-none focus:border-[#da291c]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#ffffff] mb-1">
                  Color Rate (₹ / page)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.pricing.colorPerPage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricing: {
                        ...formData.pricing,
                        colorPerPage: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full h-11 px-3 text-sm font-bold border border-[#606060] rounded-none outline-none focus:border-[#da291c]"
                />
              </div>
            </div>

            {/* Duplex discount ratio */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="text-xs font-semibold text-[#ffffff]">
                  Duplex (Two-Sided) Pricing Ratio
                </label>
                <span className="text-xs font-bold text-[#ff8278]">
                  {formData.pricing.duplexRateRatio === 1 ? 'Standard (1.0x)' : `${((1 - formData.pricing.duplexRateRatio) * 100).toFixed(0)}% Discount on 2nd side`}
                </span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.0"
                step="0.05"
                value={formData.pricing.duplexRateRatio}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricing: {
                      ...formData.pricing,
                      duplexRateRatio: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full accent-[#da291c]"
              />
              <p className="text-[11px] text-[#b0b0b0] mt-1">
                Encourages paper saving while matching counter sheet economics.
              </p>
            </div>
          </Card>

          {/* Shop Profile Details */}
          <Card className="bg-[#242424] border-[#3d3d3d] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#bcbcbc] flex items-center gap-1.5">
              <Store className="w-4 h-4 text-[#ff8278]" />
              Store Identity
            </h3>

            <Input
              label="Shop Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <Input
              label="Tagline / Subtext"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            />

            <Input
              label="Counter Location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />

            <Input
              label="Support Phone / WhatsApp"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </Card>

          {/* 10-Minute Database Auto-Purge Policy */}
          <Card className="bg-[#242424] border-[#3d3d3d] space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#6ed5a3]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffffff]">
                Database Auto-Clean & Privacy Policy
              </h3>
            </div>
            <p className="text-xs text-[#bcbcbc] leading-relaxed">
              To keep the database clean and protect sensitive customer documents, PDF payloads are automatically and permanently deleted from storage after downloading or printing:
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { mins: 10, label: '10 Mins (Default)' },
                { mins: 30, label: '30 Mins' },
                { mins: 60, label: '1 Hour' },
                { mins: 1440, label: '24 Hours' },
              ].map(({ mins, label }) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setFormData({ ...formData, retentionMinutes: mins })}
                  className={`px-3 py-2 text-xs font-semibold rounded-none border transition-all cursor-pointer text-center ${
                    formData.retentionMinutes === mins
                      ? 'border-[#da291c] bg-[#303030] text-[#ff8278] ring-1 ring-[#da291c]'
                      : 'border-[#3d3d3d] hover:bg-[#303030] text-[#bcbcbc]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-2.5 bg-[#1c1c1c] rounded-none text-[11px] text-[#b0b0b0] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#ff8278] shrink-0" />
              <span>Current timer: <strong>{formData.retentionMinutes} minutes</strong> post-download/print before file binary is wiped.</span>
            </div>
          </Card>

        </div>

        {/* Right Column: Printable QR Counter Poster */}
        <div className="space-y-4">
          <Card className="bg-[#242424] border-[#3d3d3d] p-6 text-center space-y-4 shadow-none print:shadow-none print:border-none">
            <div className="flex items-center justify-between pb-3 border-b border-[#3d3d3d] print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-[#b0b0b0]">
                Counter Standee / Poster Preview
              </span>
              <Button variant="secondary" size="sm" onClick={handlePrintPoster} icon={<Printer className="w-3.5 h-3.5" />}>
                Print Sign
              </Button>
            </div>

            {/* Printable Sign Layout */}
            <div className="p-6 rounded-none border-2 border-[#181818] bg-[#303030] space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 bg-[#181818] text-white rounded-none flex items-center justify-center mx-auto shadow-none">
                <Printer className="w-7 h-7 text-[#ffffff]" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#b0b0b0]">
                  SELF-SERVICE PRINT DESK
                </span>
                <h3 className="text-xl font-extrabold text-[#ffffff] mt-0.5">
                  {formData.name}
                </h3>
                <p className="text-xs text-[#bcbcbc] mt-1">
                  Scan to upload and print notes, thesis & documents instantly
                </p>
              </div>

              {/* QR Code Container */}
              <div className="bg-[#242424] p-4 rounded-none border border-[#606060] inline-block shadow-none">
                <img
                  src={qrImageUrl}
                  alt="Shop QR Code"
                  className="w-48 h-auto aspect-square mx-auto"
                />
                <span className="text-[10px] font-mono text-[#b0b0b0] block mt-2 uppercase">
                  SCAN WITH PHONE CAMERA
                </span>
              </div>

              <div className="pt-2 text-xs font-semibold text-[#ffffff] space-y-0.5">
                <p>⚡ No computer login required</p>
                <p>📄 B&W: ₹{formData.pricing.bwPerPage.toFixed(1)} • Color: ₹{formData.pricing.colorPerPage.toFixed(1)}</p>
              </div>

              <p className="text-[10px] text-[#969696] border-t border-[#606060]/50 pt-2 font-mono">
                {formData.location}
              </p>
            </div>

            {/* Direct Link Sharing */}
            <div className="pt-2 flex items-center gap-2 print:hidden">
              <input
                type="text"
                readOnly
                value={customerUrl}
                className="min-w-0 flex-1 text-xs px-2.5 h-9 bg-[#1c1c1c] border border-[#606060] rounded-none text-[#b0b0b0]"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyLink}
                icon={copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-[#6ed5a3]" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedLink ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
};
