import React from 'react';
import {
  Printer,
  Store,
  Settings,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Phone,
} from 'lucide-react';
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
  isStoreAuthenticated,
  onStoreLogout,
  pendingCount = 0,
}) => {
  // 1. CUSTOMER VIEW: 100% Uncluttered, Pure White-Label Experience for Student
  if (currentView === 'customer') {
    return (
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#e5e3df]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Bookstore Branding (NO dropdown switcher for students) */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#0a1530] text-white flex items-center justify-center shadow-xs">
                <Printer className="w-5 h-5 text-[#f9e79f]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-sm sm:text-base text-[#1a1a1a] tracking-tight">
                    {shop.name}
                  </h1>

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

                <p className="text-xs text-[#787671] truncate max-w-[280px] sm:max-w-md">
                  {shop.location}
                </p>
              </div>
            </div>

            {/* Right side: Direct counter phone / WhatsApp for students */}
            <div className="flex items-center gap-2">
              {shop.ownerPhone && (
                <a
                  href={`tel:${shop.ownerPhone}`}
                  className="text-xs font-semibold text-[#5645d4] bg-[#f0edfa] hover:bg-[#e6e0f5] px-3 py-1.5 rounded-[8px] transition-colors flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Counter Helpline:</span>
                  <span className="font-mono">{shop.ownerPhone}</span>
                </a>
              )}
            </div>

          </div>
        </div>
      </header>
    );
  }

  // 2. SHOPKEEPER WORKSTATION VIEW: Counter Dashboard Controls
  if (currentView === 'shop' || currentView === 'settings') {
    return (
      <header className="sticky top-0 z-30 bg-[#0a1530] text-white border-b border-[#1a2a52]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Store Counter Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[8px] bg-[#1a2a52] text-[#f9e79f] flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base text-white">
                    {shop.name}
                  </span>
                  <span className="bg-[#1aae39] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Counter Workstation
                  </span>
                </div>
                <div className="text-[11px] text-[#a4a097] font-mono">
                  Private Link: /s/{shop.slug}/counter
                </div>
              </div>
            </div>

            {/* Counter Navigation & Actions */}
            <div className="flex items-center gap-2">
              {isStoreAuthenticated ? (
                <>
                  <nav className="flex bg-[#1a2a52] p-1 rounded-[8px]">
                    <button
                      type="button"
                      onClick={() => onViewChange('shop')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all cursor-pointer ${
                        currentView === 'shop'
                          ? 'bg-white text-[#0a1530] font-bold'
                          : 'text-[#c8c4be] hover:text-white'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Print Queue</span>
                      {pendingCount > 0 && (
                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#dd5b00] text-white rounded-full">
                          {pendingCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onViewChange('settings')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all cursor-pointer ${
                        currentView === 'settings'
                          ? 'bg-white text-[#0a1530] font-bold'
                          : 'text-[#c8c4be] hover:text-white'
                      }`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Rates & Settings</span>
                    </button>
                  </nav>

                  {/* Test Customer View in New Tab */}
                  <a
                    href={`/s/${shop.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden md:flex items-center gap-1 text-xs text-[#f9e79f] hover:underline px-2 py-1"
                  >
                    <span>Customer QR</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {/* Lock / Logout Counter */}
                  <button
                    type="button"
                    onClick={onStoreLogout}
                    className="p-2 text-[#c8c4be] hover:text-[#e03131] hover:bg-white/10 rounded-[8px] transition-colors cursor-pointer"
                    title="Lock Counter Spool"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="text-xs text-[#f9e79f] font-mono">
                  Authentication Required
                </div>
              )}
            </div>

          </div>
        </div>
      </header>
    );
  }

  // 3. MASTER PLATFORM ADMIN VIEW (For Abhinav)
  return (
    <header className="sticky top-0 z-30 bg-[#0a1530] text-white border-b border-[#1a2a52]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#5645d4] text-[#f9e79f] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Campus QuickPrint</span>
              <span className="text-xs text-[#a4a097] block">Master Platform Owner (Abhinav)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewChange('customer')}
              className="text-xs text-[#f9e79f] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>← Back to Store Kiosk</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
