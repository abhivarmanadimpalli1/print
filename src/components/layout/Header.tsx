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
  const isCounter = currentView === 'shop' || currentView === 'settings';
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="store-brand">
          <div className="brand-mark" aria-hidden="true">{currentView === 'admin' ? <ShieldCheck size={22} /> : <Printer size={22} />}</div>
          <div className="brand-copy">
            <div className="brand-title-row">
              <span className="brand-title">{currentView === 'admin' ? 'QuickPrint' : shop.name}</span>
              {currentView === 'customer' && <span className={`store-status ${shop.isOpen ? 'is-open' : ''}`}>{shop.isOpen ? 'OPEN' : 'PAUSED'}</span>}
            </div>
            <p className="brand-subtitle">{currentView === 'customer' ? shop.location : currentView === 'admin' ? 'PLATFORM MANAGEMENT' : 'COUNTER WORKSTATION'}</p>
          </div>
        </div>
        {currentView === 'customer' && shop.phone && (
          <a className="header-phone" href={`tel:${shop.phone}`} aria-label={`Call ${shop.name}: ${shop.phone}`}>
            <Phone size={16} /><span>{shop.phone}</span>
          </a>
        )}
        {isCounter && isStoreAuthenticated && (
          <div className="counter-controls">
            <nav aria-label="Counter navigation" className="counter-nav">
              <button type="button" aria-current={currentView === 'shop' ? 'page' : undefined} onClick={() => onViewChange('shop')}><Store size={16} />Queue {pendingCount > 0 && <span className="queue-count">{pendingCount}</span>}</button>
              <button type="button" aria-current={currentView === 'settings' ? 'page' : undefined} onClick={() => onViewChange('settings')}><Settings size={16} />Settings</button>
              <a href={`/s/${shop.slug}`} target="_blank" rel="noreferrer" aria-label="Open customer page in new tab"><ExternalLink size={16} /><span>Store</span></a>
            </nav>
            <button className="header-logout" type="button" onClick={onStoreLogout} aria-label="Sign out of counter"><LogOut size={18} /></button>
          </div>
        )}
        {currentView === 'admin' && <button type="button" className="header-back" onClick={() => onViewChange('customer')}>Back to store</button>}
      </div>
    </header>
  );
};
