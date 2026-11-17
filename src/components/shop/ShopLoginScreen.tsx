import React, { useState } from 'react';
import { Store, Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { verifyStoreCredentials } from '../../lib/store';
import { signInToCounter } from '../../lib/supabase';
import type { Shop } from '../../types';

interface ShopLoginScreenProps {
  shop: Shop;
  privateFiles: boolean;
  onLoginSuccess: (authenticatedShop: Shop) => void;
  onBackToCustomer: () => void;
}

export const ShopLoginScreen: React.FC<ShopLoginScreenProps> = ({
  shop,
  privateFiles,
  onLoginSuccess,
  onBackToCustomer,
}) => {
  const [loginId, setLoginId] = useState<string>(privateFiles ? '' : shop.loginId || shop.slug || '');
  const [secretPin, setSecretPin] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginId.trim() || !secretPin.trim()) {
      setError(privateFiles ? 'Enter your counter email and password.' : 'Enter your store login and PIN.');
      return;
    }

    if (privateFiles) {
      setIsSigningIn(true);
      try {
        await signInToCounter(shop.id, loginId.trim(), secretPin);
        onLoginSuccess(shop);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not sign in to the counter.');
      } finally {
        setIsSigningIn(false);
      }
      return;
    }

    const isValid = verifyStoreCredentials(shop.id, loginId.trim(), secretPin.trim());

    if (isValid) {
      try {
        sessionStorage.setItem(`store_auth_${shop.id}`, 'true');
      } catch {}
      onLoginSuccess(shop);
    } else {
      setError(`Invalid credentials for ${shop.name}. Check your PIN or contact platform owner Abhinav.`);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-white border border-[#e5e3df] shadow-2xl rounded-[16px] space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#0a1530] text-[#f9e79f] mx-auto flex items-center justify-center shadow-sm">
            <Store className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-black text-[#0a1530] tracking-tight">
            {shop.name}
          </h2>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f0edfa] text-[#5645d4] text-[11px] font-bold tracking-wider uppercase">
            <Lock className="w-3 h-3" />
            <span>Counter Operator Portal</span>
          </div>

          <p className="text-xs text-[#787671] pt-1">
            Sign in to unlock your real-time incoming print queue, auto-chime, and counter hardware actions.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#37352f] mb-1.5">
              {privateFiles ? 'Counter email' : 'Store Login ID'}
            </label>
            <input
              type={privateFiles ? 'email' : 'text'}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder={privateFiles ? 'counter@example.com' : shop.loginId || shop.slug}
              autoComplete="username"
              className="w-full text-xs px-3.5 py-2.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#37352f]">
                {privateFiles ? 'Password' : 'Store PIN or password'}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[#5645d4] hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <input
              type={showPassword ? 'text' : 'password'}
              value={secretPin}
              onChange={(e) => setSecretPin(e.target.value)}
              placeholder={privateFiles ? 'Enter password' : 'Enter PIN'}
              autoComplete="current-password"
              autoFocus
              className="w-full text-xs px-3.5 py-2.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all font-mono tracking-widest text-center text-sm"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-[#fdf3f2] border border-[#f5c6cb] rounded-[8px] text-xs text-[#d44c47]">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isSigningIn}
            className="w-full py-2.5 text-xs font-semibold bg-[#0a1530] hover:bg-[#1a2a52]"
          >
            {isSigningIn ? 'Signing in…' : 'Unlock Counter Dashboard'}
          </Button>

          <button
            type="button"
            onClick={onBackToCustomer}
            className="w-full text-center text-xs text-[#787671] hover:text-[#1a1a1a] pt-1 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Student Print Ordering Kiosk</span>
          </button>
        </form>

        <div className="pt-2 border-t border-[#e5e3df] text-center text-[10px] text-[#a4a097]">
          Powered by Campus QuickPrint SaaS Network • Managed by Abhinav (+91 7989869191)
        </div>
      </Card>
    </div>
  );
};
