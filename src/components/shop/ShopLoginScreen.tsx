import React, { useState } from 'react';
import { Store, Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { activateCounterDevice, signInToCounter } from '../../lib/supabase';
import type { Shop } from '../../types';

interface ShopLoginScreenProps {
  shop: Shop;
  onLoginSuccess: (authenticatedShop: Shop) => void;
  onBackToCustomer: () => void;
}

export const ShopLoginScreen: React.FC<ShopLoginScreenProps> = ({
  shop,
  onLoginSuccess,
  onBackToCustomer,
}) => {
  const [email, setEmail] = useState('');
  const [secretPin, setSecretPin] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [setupCode] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('setup'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSigningIn(true);
    try {
      if (setupCode) {
        await activateCounterDevice(shop.id, setupCode);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        await signInToCounter(shop.id, email.trim(), secretPin);
      }
      onLoginSuccess(shop);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not access the counter.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-[#242424] border border-[#3d3d3d] shadow-none rounded-none space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#181818] text-[#ffffff] mx-auto flex items-center justify-center shadow-none">
            <Store className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-black text-[#ffffff] tracking-tight">
            {shop.name}
          </h2>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#303030] text-[#ff8278] text-[11px] font-bold tracking-wider uppercase">
            <Lock className="w-3 h-3" />
            <span>Counter Operator Portal</span>
          </div>

          <p className="text-xs text-[#b0b0b0] pt-1">
            Sign in to unlock your real-time incoming print queue, auto-chime, and counter hardware actions.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {setupCode ? (
            <p className="text-xs text-[#b0b0b0]">Activate this browser to open the queue and download files for {shop.name}.</p>
          ) : <>
          <div>
            <label className="block text-xs font-semibold text-[#dedede] mb-1.5">
              Counter email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="counter@example.com"
              required
              autoComplete="username"
              className="w-full text-xs px-3.5 py-2.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#dedede]">
                Password
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

            <input
              type={showPassword ? 'text' : 'password'}
              value={secretPin}
              onChange={(e) => setSecretPin(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              autoFocus
              className="w-full text-xs px-3.5 py-2.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all font-mono tracking-widest text-center text-sm"
            />
          </div>
          </>}

          {error && (
            <div className="p-2.5 bg-[#402321] border border-[#ff8278]/30 rounded-none text-xs text-[#ff8278]">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isSigningIn}
            className="w-full py-2.5 text-xs font-semibold bg-[#181818] hover:bg-[#303030]"
          >
            {isSigningIn ? 'Please wait…' : setupCode ? 'Activate this counter' : 'Unlock Counter Dashboard'}
          </Button>

          <button
            type="button"
            onClick={onBackToCustomer}
            className="w-full text-center text-xs text-[#b0b0b0] hover:text-[#ffffff] pt-1 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to customer print ordering</span>
          </button>
        </form>

        <div className="pt-2 border-t border-[#3d3d3d] text-center text-[10px] text-[#969696]">
          Powered by Campus QuickPrint SaaS Network • Managed by Abhinav (+91 7989869191)
        </div>
      </Card>
    </div>
  );
};
