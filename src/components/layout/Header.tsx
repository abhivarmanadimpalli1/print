import React from 'react';
import { Printer, Store, Settings, RefreshCw, Smartphone } from 'lucide-react';
import type { Shop } from '../../types';

interface HeaderProps {
  currentView: 'customer' | 'shop' | 'settings';
  onViewChange: (view: 'customer' | 'shop' | 'settings') => void;
  shop: Shop;
  onResetDemo: () => void;
  pendingCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  shop,
  onResetDemo,
  pendingCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#e5e3df]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Store Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#0a1530] text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5 text-[#f9e79f]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm sm:text-base text-[#1a1a1a]">
                  {shop.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    shop.isOpen
                      ? 'bg-[#d9f3e1] text-[#1aae39]'
                      : 'bg-[#fde0ec] text-[#e03131]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {shop.isOpen ? 'LIVE / OPEN' : 'ORDERS PAUSED'}
                </span>
              </div>
              <p className="text-xs text-[#787671] hidden sm:block">
                QR Print-Ordering Operational Platform
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <nav className="flex bg-[#f6f5f4] p-1 rounded-[8px] border border-[#e5e3df]">
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
                <span>Customer QR</span>
              </button>

              <button
                type="button"
                onClick={() => onViewChange('shop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-all relative cursor-pointer ${
                  currentView === 'shop'
                    ? 'bg-white text-[#1a1a1a] shadow-xs'
                    : 'text-[#787671] hover:text-[#1a1a1a]'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Shop Queue</span>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-[#5645d4] text-white rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>

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
            </nav>

            {/* Quick Demo Reset */}
            <button
              type="button"
              onClick={onResetDemo}
              title="Reset sample data and preloaded orders"
              className="p-2 text-[#787671] hover:text-[#1a1a1a] hover:bg-[#f6f5f4] rounded-[8px] transition-colors border border-transparent hover:border-[#e5e3df] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
