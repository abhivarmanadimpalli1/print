import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Monitor, Lock, ShieldCheck } from 'lucide-react';
import { Header } from './components/layout/Header';
import { CustomerOrderFlow } from './components/customer/CustomerOrderFlow';
import { CustomerOrderStatus } from './components/customer/CustomerOrderStatus';
import { ShopDashboard } from './components/shop/ShopDashboard';
import { ShopSettings } from './components/shop/ShopSettings';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { StoreLoginModal } from './components/auth/StoreLoginModal';
import {
  getShop,
  getOrders,
  resetDemoData,
  subscribeToStore,
} from './lib/store';
import type { Shop } from './types';

function parseInitialRoute(): {
  shopSlug: string;
  view: 'customer' | 'shop' | 'settings' | 'admin';
  orderId: string | null;
  openLogin: boolean;
} {
  if (typeof window === 'undefined') {
    return { shopSlug: 'campus-prints', view: 'customer', orderId: null, openLogin: false };
  }

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  let shopSlug = params.get('shop') || '';
  const viewParam = params.get('view');
  const openLogin = params.get('login') === 'true';

  if (path === '/admin' || viewParam === 'admin') {
    return { shopSlug: shopSlug || 'campus-prints', view: 'admin', orderId: null, openLogin: false };
  }

  const slugMatch = path.match(/^\/(?:s|shop)\/([a-zA-Z0-9_-]+)/);
  if (slugMatch && slugMatch[1]) {
    shopSlug = slugMatch[1];
  }

  let view: 'customer' | 'shop' | 'settings' | 'admin' = 'customer';
  if (viewParam === 'shop') view = 'shop';
  else if (viewParam === 'settings') view = 'settings';
  else if (viewParam === 'admin') view = 'admin';

  return {
    shopSlug: shopSlug || 'campus-prints',
    view,
    orderId: params.get('orderId') || params.get('order') || params.get('track'),
    openLogin,
  };
}

export function App() {
  const initialRoute = parseInitialRoute();
  const [shop, setShop] = useState<Shop>(() => getShop(initialRoute.shopSlug));
  const [currentView, setCurrentView] = useState<'customer' | 'shop' | 'settings' | 'admin'>(initialRoute.view);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(initialRoute.orderId);
  const [isMobileFree, setIsMobileFree] = useState<boolean>(true);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  // Hidden Store Login Modal state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(initialRoute.openLogin);
  const [isStoreAuthenticated, setIsStoreAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`store_auth_${initialRoute.shopSlug}`) === 'true';
    } catch {
      return false;
    }
  });

  // Update URL history to reflect current shop & view
  const updateBrowserUrl = useCallback((targetShop: Shop, view: 'customer' | 'shop' | 'settings' | 'admin') => {
    try {
      if (typeof window === 'undefined') return;
      if (view === 'admin') {
        window.history.pushState({}, '', '/admin');
      } else {
        const viewSuffix = view === 'customer' ? '' : `?view=${view}`;
        window.history.pushState({}, '', `/s/${targetShop.slug}${viewSuffix}`);
      }
    } catch {}
  }, []);

  // Check store session whenever shop changes
  useEffect(() => {
    try {
      const isAuthed = sessionStorage.getItem(`store_auth_${shop.id}`) === 'true';
      setIsStoreAuthenticated(isAuthed);
    } catch {}
  }, [shop.id]);

  // Sync with localStorage & real-time updates
  useEffect(() => {
    const updateCounts = () => {
      const orders = getOrders(shop.id);
      const pending = orders.filter(o => ['new', 'review'].includes(o.status)).length;
      setPendingOrdersCount(pending);
      setShop(getShop(shop.id));
    };

    updateCounts();
    const unsub = subscribeToStore(updateCounts);
    return unsub;
  }, [shop.id]);

  const handleSelectShop = (newShop: Shop) => {
    setShop(newShop);
    setActiveTrackingOrderId(null);
    setCurrentView('customer');
    updateBrowserUrl(newShop, 'customer');
  };

  const handleViewChange = (view: 'customer' | 'shop' | 'settings' | 'admin') => {
    if ((view === 'shop' || view === 'settings') && !isStoreAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setCurrentView(view);
    if (view !== 'customer') {
      setActiveTrackingOrderId(null);
    }
    updateBrowserUrl(shop, view);
  };

  const handleLoginSuccess = (authenticatedShop: Shop) => {
    setShop(authenticatedShop);
    setIsStoreAuthenticated(true);
    setCurrentView('shop');
    updateBrowserUrl(authenticatedShop, 'shop');
  };

  const handleStoreLogout = () => {
    try {
      sessionStorage.removeItem(`store_auth_${shop.id}`);
    } catch {}
    setIsStoreAuthenticated(false);
    setCurrentView('customer');
    updateBrowserUrl(shop, 'customer');
  };

  const handleResetDemo = () => {
    if (window.confirm('Reset sample queue orders and default city bookstore network?')) {
      resetDemoData();
      setShop(getShop(shop.id));
      setActiveTrackingOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f4] flex flex-col text-[#37352f] antialiased selection:bg-[#e6e0f5] selection:text-[#5645d4]">
      
      {/* Top Header */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        shop={shop}
        onSelectShop={handleSelectShop}
        onResetDemo={handleResetDemo}
        isStoreAuthenticated={isStoreAuthenticated}
        onOpenStoreLogin={() => setShowLoginModal(true)}
        onStoreLogout={handleStoreLogout}
        pendingCount={pendingOrdersCount}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* Customer Self-Service Ordering View */}
        {currentView === 'customer' && (
          <div>
            {/* View Mode Toggle Bar (Desktop vs Mobile) */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-1 flex items-center justify-between text-xs text-[#787671]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1aae39]" />
                <span className="font-semibold text-[#1a1a1a]">
                  {shop.name}
                </span>
                <span className="text-[10px] font-bold text-[#5645d4] bg-[#e6e0f5] px-2 py-0.5 rounded-full font-mono">
                  /s/{shop.slug}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-white border border-[#e5e3df] p-1 rounded-[8px]">
                <button
                  type="button"
                  onClick={() => setIsMobileFree(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                    isMobileFree
                      ? 'bg-[#0a1530] text-white font-semibold shadow-xs'
                      : 'text-[#787671] hover:text-[#1a1a1a]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop Mode (Full Width)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMobileFree(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                    !isMobileFree
                      ? 'bg-[#0a1530] text-white font-semibold shadow-xs'
                      : 'text-[#787671] hover:text-[#1a1a1a]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile Phone Frame</span>
                </button>
              </div>
            </div>

            {/* Content Container */}
            <div className={isMobileFree ? '' : 'max-w-md mx-auto my-4 p-3 bg-[#0a1530] rounded-[28px] shadow-2xl border-4 border-[#1a2a52]'}>
              <div className={isMobileFree ? '' : 'bg-[#f6f5f4] rounded-[20px] overflow-hidden max-h-[85vh] overflow-y-auto'}>
                {activeTrackingOrderId ? (
                  <CustomerOrderStatus
                    orderId={activeTrackingOrderId}
                    shop={shop}
                    onBackToOrder={() => {
                      setActiveTrackingOrderId(null);
                      updateBrowserUrl(shop, 'customer');
                    }}
                    onSelectOrder={(selectedId) => {
                      setActiveTrackingOrderId(selectedId);
                      if (typeof window !== 'undefined') {
                        window.history.pushState({}, '', `/s/${shop.slug}?orderId=${selectedId}`);
                      }
                    }}
                  />
                ) : (
                  <CustomerOrderFlow
                    shop={shop}
                    isMobileFree={isMobileFree}
                    onOrderSubmitted={(order) => {
                      setActiveTrackingOrderId(order.id);
                      if (typeof window !== 'undefined') {
                        window.history.pushState({}, '', `/s/${shop.slug}?orderId=${order.id}`);
                      }
                    }}
                    onViewStatus={(orderId) => {
                      setActiveTrackingOrderId(orderId);
                      if (typeof window !== 'undefined') {
                        window.history.pushState({}, '', `/s/${shop.slug}?orderId=${orderId}`);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shopkeeper Print Queue (Protected) */}
        {currentView === 'shop' && (
          <ShopDashboard shop={shop} />
        )}

        {/* Shop Settings & QR Standee (Protected) */}
        {currentView === 'settings' && (
          <ShopSettings shop={shop} onShopUpdated={(updated) => setShop(updated)} />
        )}

        {/* Super Admin Dashboard for Abhinav */}
        {currentView === 'admin' && (
          <SuperAdminDashboard
            onBackToStore={() => {
              setCurrentView('customer');
              updateBrowserUrl(shop, 'customer');
            }}
            onSelectShopToView={(selected) => {
              setShop(selected);
              setIsStoreAuthenticated(true);
              try {
                sessionStorage.setItem(`store_auth_${selected.id}`, 'true');
              } catch {}
              setCurrentView('shop');
              updateBrowserUrl(selected, 'shop');
            }}
          />
        )}

      </main>

      {/* Hidden Store Owner Login Modal */}
      <StoreLoginModal
        currentShop={shop}
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        onSwitchToAdmin={() => {
          setShowLoginModal(false);
          handleViewChange('admin');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-[#e5e3df] bg-white py-4 mt-8 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#787671]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1a1a1a]">Campus QuickPrint</span>
            <span>•</span>
            <span>City Bookstore Network: <strong>{shop.name}</strong></span>
          </div>

          <div className="flex items-center gap-4">
            {/* Hidden bookstore login trigger */}
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="text-[#787671] hover:text-[#5645d4] flex items-center gap-1 cursor-pointer font-medium"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Bookstore Owner Access</span>
            </button>

            <span>•</span>

            {/* Abhinav's Master Admin Portal trigger */}
            <button
              type="button"
              onClick={() => handleViewChange('admin')}
              className="text-[#5645d4] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Platform Owner (Abhinav)</span>
            </button>

            <span>•</span>

            <button
              type="button"
              onClick={handleResetDemo}
              className="hover:text-[#5645d4] cursor-pointer"
            >
              Reset Network
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
