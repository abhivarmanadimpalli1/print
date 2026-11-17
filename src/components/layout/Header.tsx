import React, { useState } from 'react';
import {
  Printer,
  Store,
  Settings,
  RefreshCw,
  Smartphone,
  Lock,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { getAllShops } from '../../lib/store';
import type { Shop } from '../../types';

interface HeaderProps {
  currentView: 'customer' | 'shop' | 'settings' | 'admin';
  onViewChange: (view: 'customer' | 'shop' | 'settings' | 'admin') => void;
  shop: Shop;
  onSelectShop: (shop: Shop) => void;
  onResetDemo: () => void;
  isStoreAuthenticated: boolean;
  onOpenStoreLogin: () => void;
  onStoreLogout: () => void;
  pendingCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  shop,
  onSelectShop,
  onResetDemo,
  isStoreAuthenticated,
  onOpenStoreLogin,
  onStoreLogout,
  pendingCount = 0,
}) => {
  const [showStoreDropdown, setShowStoreDropdown] = useState<boolean>(false);
  const allShops = getAllShops();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#e5e3df]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Store Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#0a1530] text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5 text-[#f9e79f]" />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                  className="font-semibold text-sm sm:text-base text-[#1a1a1a] flex items-center gap-1.5 hover:text-[#5645d4] transition-colors cursor-pointer text-left"
                >
                  <span className="truncate max-w-[200px] sm:max-w-xs">{shop.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#787671]" />
                </button>

                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    shop.isOpen
                      ? 'bg-[#d9f3e1] text-[#1aae39]'
                      : 'bg-[#fde0ec] text-[#e03131]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {shop.isOpen ? 'OPEN' : 'PAUSED'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#787671]">
                <span className="font-mono text-[10px] text-[#5645d4]">/s/{shop.slug}</span>
                <span>•</span>
                <span className="truncate max-w-[200px] hidden md:inline">{shop.location}</span>
              </div>

              {/* Multi-Store Switcher Dropdown */}
              {showStoreDropdown && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-[10px] border border-[#e5e3df] shadow-xl py-2 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#787671] border-b border-[#e5e3df]">
                    City Bookstore Outlets
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {allShops.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectShop(s);
                          setShowStoreDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f6f5f4] transition-colors flex items-center justify-between ${
                          s.id === shop.id ? 'bg-[#f0edfa] font-bold text-[#5645d4]' : 'text-[#1a1a1a]'
                        }`}
                      >
                        <div>
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-[10px] text-[#787671] font-mono">/s/{s.slug}</div>
                        </div>
                        {s.id === shop.id && (
                          <span className="text-[10px] bg-[#5645d4] text-white px-1.5 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-[#e5e3df] mt-1 pt-1 px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStoreDropdown(false);
                        onViewChange('admin');
                      }}
                      className="w-full text-left px-2 py-1.5 text-[11px] font-semibold text-[#5645d4] hover:bg-[#f0edfa] rounded-[6px] transition-colors flex items-center justify-between"
                    >
                      <span>Platform Owner Portal (Abhinav)</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            <nav className="flex bg-[#f6f5f4] p-1 rounded-[8px] border border-[#e5e3df]">
              
              {/* Customer QR View */}
              <button
                type="button"
                onClick={() => onViewChange('customer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all cursor-pointer ${
                  currentView === 'customer'
                    ? 'bg-white text-[#1a1a1a] shadow-xs'
                    : 'text-[#787671] hover:text-[#1a1a1a]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Customer QR</span>
                <span className="sm:hidden">Customer</span>
              </button>

              {/* Shop Queue (Unlocked or Login Prompt) */}
              <button
                type="button"
                onClick={() => {
                  if (isStoreAuthenticated) {
                    onViewChange('shop');
                  } else {
                    onOpenStoreLogin();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all relative cursor-pointer ${
                  currentView === 'shop'
                    ? 'bg-white text-[#1a1a1a] shadow-xs'
                    : 'text-[#787671] hover:text-[#1a1a1a]'
                }`}
              >
                {isStoreAuthenticated ? (
                  <Store className="w-3.5 h-3.5 text-[#5645d4]" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-[#787671]" />
                )}
                <span className="hidden sm:inline">
                  {isStoreAuthenticated ? 'Shop Queue' : 'Store Login'}
                </span>
                <span className="sm:hidden">
                  {isStoreAuthenticated ? 'Queue' : 'Login'}
                </span>
                {pendingCount > 0 && isStoreAuthenticated && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-[#5645d4] text-white rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>

              {/* Store Settings (Visible when authenticated) */}
              {isStoreAuthenticated && (
                <button
                  type="button"
                  onClick={() => onViewChange('settings')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all cursor-pointer ${
                    currentView === 'settings'
                      ? 'bg-white text-[#1a1a1a] shadow-xs'
                      : 'text-[#787671] hover:text-[#1a1a1a]'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}

            </nav>

            {/* Logout Store Button */}
            {isStoreAuthenticated && (
              <button
                type="button"
                onClick={onStoreLogout}
                title="Lock counter / Logout from store"
                className="p-2 text-[#787671] hover:text-[#d44c47] hover:bg-[#fdf3f2] rounded-[8px] transition-colors border border-transparent hover:border-[#f5c6cb] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {/* Owner Admin Badge */}
            <button
              type="button"
              onClick={() => onViewChange('admin')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-[8px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                currentView === 'admin'
                  ? 'bg-[#0a1530] text-[#f9e79f] border-[#0a1530] shadow-xs'
                  : 'bg-white text-[#37352f] border-[#e5e3df] hover:border-[#0a1530]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#f9e79f]" />
              <span className="hidden md:inline font-mono text-[11px]">Abhinav (Owner)</span>
              <span className="md:hidden">Owner</span>
            </button>

            {/* Quick Demo Reset */}
            <button
              type="button"
              onClick={onResetDemo}
              title="Reset sample data and preloaded orders"
              className="p-2 text-[#787671] hover:text-[#1a1a1a] hover:bg-[#f6f5f4] rounded-[8px] transition-colors border border-transparent hover:border-[#e5e3df] cursor-pointer hidden sm:block"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
