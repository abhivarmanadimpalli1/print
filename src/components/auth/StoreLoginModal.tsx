import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Store, X, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { verifyStoreCredentials, getAllShops } from '../../lib/store';
import type { Shop } from '../../types';

interface StoreLoginModalProps {
  currentShop: Shop;
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (shop: Shop) => void;
  onSwitchToAdmin: () => void;
}

export const StoreLoginModal: React.FC<StoreLoginModalProps> = ({
  currentShop,
  isOpen,
  onClose,
  onLoginSuccess,
  onSwitchToAdmin,
}) => {
  const shops = getAllShops();
  const [selectedShopId, setSelectedShopId] = useState<string>(currentShop.id);
  const activeShop = shops.find(s => s.id === selectedShopId) || currentShop;

  const [loginId, setLoginId] = useState<string>(activeShop.loginId || activeShop.slug || '');
  const [secretPin, setSecretPin] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleShopChange = (newId: string) => {
    setSelectedShopId(newId);
    const target = shops.find(s => s.id === newId);
    if (target) {
      setLoginId(target.loginId || target.slug || '');
      setSecretPin('');
      setError(null);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginId.trim() || !secretPin.trim()) {
      setError('Please enter both your Store Login ID and PIN / Password.');
      return;
    }

    const isValid = verifyStoreCredentials(activeShop.id, loginId.trim(), secretPin.trim());

    if (isValid) {
      // Save authenticated session for this store in sessionStorage
      try {
        sessionStorage.setItem(`store_auth_${activeShop.id}`, 'true');
        sessionStorage.setItem('active_store_id', activeShop.id);
      } catch {}

      onLoginSuccess(activeShop);
      onClose();
    } else {
      setError(`Invalid credentials. Check your Store ID or Secret PIN, or contact platform owner Abhinav.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#242424] rounded-none border border-[#3d3d3d] shadow-none max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#181818] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#303030] flex items-center justify-center text-[#ffffff]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Bookstore Counter Access</h3>
              <p className="text-[11px] text-[#969696]">Private Shopkeeper & Operator Login</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#969696] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          
          {/* Store Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#dedede] mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#ff8278]" />
              <span>Select Bookstore:</span>
            </label>
            <select
              value={selectedShopId}
              onChange={(e) => handleShopChange(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all cursor-pointer"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.location})
                </option>
              ))}
            </select>
          </div>

          {/* Store Login ID */}
          <div>
            <label className="block text-xs font-semibold text-[#dedede] mb-1.5">
              Store Login ID:
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. krishna_xerox or campus"
              className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all font-mono"
            />
          </div>

          {/* PIN / Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#dedede]">
                Secret PIN / Password:
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[#ff8278] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={secretPin}
                onChange={(e) => setSecretPin(e.target.value)}
                placeholder="Enter 4-digit PIN or password"
                className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all font-mono tracking-wider"
              />
            </div>
            <p className="text-[10px] text-[#b0b0b0] mt-1">
              Default demo PIN for {activeShop.name}: <span className="font-mono font-bold text-[#ffffff]">{activeShop.passwordHash || '1234'}</span>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-[#402321] border border-[#ff8278]/30 rounded-none text-xs text-[#ff8278]">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Unlock Store Queue & Orders
            </Button>
          </div>

          {/* Notice & Admin portal link */}
          <div className="pt-3 border-t border-[#3d3d3d] flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-[#b0b0b0]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#6ed5a3]" />
              <span>Session stays active on this shop PC until you click Log Out.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToAdmin();
              }}
              className="text-[11px] font-semibold text-[#ff8278] hover:underline flex items-center justify-center gap-1.5 pt-1 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Are you Platform Owner (Abhinav)? Open Master City Admin</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
