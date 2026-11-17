import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Header } from './components/layout/Header';
import { CustomerOrderFlow } from './components/customer/CustomerOrderFlow';
import { CustomerOrderStatus } from './components/customer/CustomerOrderStatus';
import { ShopDashboard } from './components/shop/ShopDashboard';
import { ShopSettings } from './components/shop/ShopSettings';
import { ShopLoginScreen } from './components/shop/ShopLoginScreen';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import {
  getShop,
  cacheShop,
  hydratePublishedShop,
  getOrders,
  resetDemoData,
  subscribeToStore,
} from './lib/store';
import type { Shop } from './types';
import { canAccessCounter, getPublishedShop, signOutFromCounter } from './lib/supabase';

function parseInitialRoute(): {
  shopSlug: string;
  view: 'customer' | 'shop' | 'settings' | 'admin';
  orderId: string | null;
} {
  if (typeof window === 'undefined') {
    return { shopSlug: 'campus-prints', view: 'customer', orderId: null };
  }

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  let shopSlug = params.get('shop') || '';
  const viewParam = params.get('view');

  // 1. Master Admin route for Abhinav: /admin, /visar-admin, /superadmin
  if (path === '/admin' || path === '/visar-admin' || path === '/superadmin' || viewParam === 'admin') {
    return { shopSlug: shopSlug || 'campus-prints', view: 'admin', orderId: null };
  }

  // 2. Dedicated Counter routes for Shopkeeper: /s/:slug/counter, /s/:slug/side, /s/:slug/portal, /s/:slug/login
  const counterMatch = path.match(/^\/(?:s|shop)\/([a-zA-Z0-9_-]+)\/(?:counter|side|portal|login|queue)/i) ||
                       path.match(/^\/(?:counter|side|portal)\/([a-zA-Z0-9_-]+)/i);
  if (counterMatch && counterMatch[1]) {
    return {
      shopSlug: counterMatch[1],
      view: 'shop',
      orderId: null,
    };
  }

  // 3. Customer Store route: /s/:slug or /shop/:slug
  const slugMatch = path.match(/^\/(?:s|shop)\/([a-zA-Z0-9_-]+)/i);
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
  };
}

export function App() {
  const [initialRoute] = useState(parseInitialRoute);
  const [requestedShop, setRequestedShop] = useState(initialRoute.shopSlug);
  const [shopLookup, setShopLookup] = useState<{ shopId: string; error: string | null } | null>(null);
  const [shop, setShop] = useState<Shop>(() => getShop(initialRoute.shopSlug));
  const [currentView, setCurrentView] = useState<'customer' | 'shop' | 'settings' | 'admin'>(initialRoute.view);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(initialRoute.orderId);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  const [isStoreAuthenticated, setIsStoreAuthenticated] = useState(false);
  const [checkedCounter, setCheckedCounter] = useState<string | null>(null);
  const [counterError, setCounterError] = useState<string | null>(null);
  const counterReady = checkedCounter === shop.id;

  useEffect(() => {
    let active = true;
    void getPublishedShop(requestedShop).then(row => {
      if (!active) return;
      if (!row) {
        setShopLookup({ shopId: requestedShop, error: 'This store is unavailable.' });
        return;
      }
      const published = hydratePublishedShop(row);
      cacheShop(published);
      setShop(published);
      setShopLookup({ shopId: requestedShop, error: null });
    }).catch(() => {
      if (active) setShopLookup({ shopId: requestedShop, error: 'Could not load this store. Refresh to try again.' });
    });
    return () => { active = false; };
  }, [requestedShop]);

  // Update URL history to reflect clean role-based paths
  const updateBrowserUrl = useCallback((targetShop: Shop, view: 'customer' | 'shop' | 'settings' | 'admin') => {
    try {
      if (typeof window === 'undefined') return;
      if (view === 'admin') {
        window.history.pushState({}, '', '/admin');
      } else if (view === 'shop') {
        window.history.pushState({}, '', `/s/${targetShop.slug}/counter`);
      } else if (view === 'settings') {
        window.history.pushState({}, '', `/s/${targetShop.slug}/counter?view=settings`);
      } else {
        window.history.pushState({}, '', `/s/${targetShop.slug}`);
      }
    } catch {}
  }, []);

  // Check store session whenever shop changes
  useEffect(() => {
    if (currentView !== 'shop' && currentView !== 'settings') return;
    if (shopLookup?.shopId !== requestedShop || shopLookup.error) return;
    let active = true;
    async function checkCounter() {
      const authorized = await canAccessCounter(shop.id);
      if (!active) return;
      setCounterError(null);
      setIsStoreAuthenticated(authorized);
      setCheckedCounter(shop.id);
    }
    void checkCounter().catch(() => {
      if (!active) return;
      setCheckedCounter(null);
      setIsStoreAuthenticated(false);
      setCounterError('Could not check counter access. Reload the page to try again.');
    });
    return () => { active = false; };
  }, [shop.id, currentView, requestedShop, shopLookup]);

  // Secret shortcut for shopkeeper: Alt + L toggles counter view on counter PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setCurrentView(prev => {
          const next = prev === 'customer' ? 'shop' : 'customer';
          updateBrowserUrl(shop, next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shop, updateBrowserUrl]);

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
    setIsStoreAuthenticated(false);
    setCheckedCounter(null);
    setRequestedShop(newShop.id);
    setShop(newShop);
    setActiveTrackingOrderId(null);
    setCurrentView('customer');
    updateBrowserUrl(newShop, 'customer');
  };

  const handleViewChange = (view: 'customer' | 'shop' | 'settings' | 'admin') => {
    setCurrentView(view);
    if (view !== 'customer') {
      setActiveTrackingOrderId(null);
    }
    updateBrowserUrl(shop, view);
  };

  const handleStoreLogout = () => {
    void signOutFromCounter().catch(console.warn);
    setIsStoreAuthenticated(false);
    setCurrentView('customer');
    updateBrowserUrl(shop, 'customer');
  };

  if (currentView !== 'admin' && (shopLookup?.shopId !== requestedShop || shopLookup.error)) {
    return <main className="p-8 text-center" role="status">
      {shopLookup?.shopId === requestedShop ? shopLookup.error : 'Loading print shop…'}
    </main>;
  }

  const handleResetDemo = () => {
    if (window.confirm('Reset sample queue orders and default city bookstore network?')) {
      resetDemoData();
      setShop(getShop(shop.id));
      setActiveTrackingOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f4] flex flex-col text-[#37352f] antialiased selection:bg-[#e6e0f5] selection:text-[#5645d4]">
      
      {/* Top Header (Automatically adapts: Pure white-label for Customer, Workstation for Shopkeeper) */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        shop={shop}
        onSelectShop={handleSelectShop}
        onResetDemo={handleResetDemo}
        isStoreAuthenticated={isStoreAuthenticated}
        onOpenStoreLogin={() => handleViewChange('shop')}
        onStoreLogout={handleStoreLogout}
        pendingCount={pendingOrdersCount}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* 1. CUSTOMER VIEW: Dedicated, Fast, Distraction-Free Kiosk for Students */}
        {currentView === 'customer' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        )}

        {/* 2. SHOPKEEPER VIEW: Dedicated Counter Portal */}
        {(currentView === 'shop' || currentView === 'settings') && !counterReady && (
          <p role="status" className="p-6 text-center">{counterError ?? 'Checking counter access…'}</p>
        )}
        {currentView === 'shop' && counterReady && (
          isStoreAuthenticated ? (
            <ShopDashboard shop={shop} />
          ) : (
            <ShopLoginScreen
              key={shop.id}
              shop={shop}
              onLoginSuccess={(authedShop) => {
                setShop(authedShop);
                setIsStoreAuthenticated(true);
                setCurrentView('shop');
              }}
              onBackToCustomer={() => {
                setCurrentView('customer');
                updateBrowserUrl(shop, 'customer');
              }}
            />
          )
        )}

        {/* 3. SHOP SETTINGS VIEW: (Protected) */}
        {currentView === 'settings' && counterReady && (
          isStoreAuthenticated ? (
            <ShopSettings shop={shop} onShopUpdated={(updated) => setShop(updated)} />
          ) : (
            <ShopLoginScreen
              key={shop.id}
              shop={shop}
              onLoginSuccess={(authedShop) => {
                setShop(authedShop);
                setIsStoreAuthenticated(true);
                setCurrentView('settings');
              }}
              onBackToCustomer={() => {
                setCurrentView('customer');
                updateBrowserUrl(shop, 'customer');
              }}
            />
          )
        )}

        {/* 4. SUPER ADMIN DASHBOARD (For Abhinav) */}
        {currentView === 'admin' && (
          <SuperAdminDashboard
            onBackToStore={() => {
              setCurrentView('customer');
              updateBrowserUrl(shop, 'customer');
            }}
            onSelectShopToView={(selected) => {
              setShop(selected);
              setRequestedShop(selected.id);
              setCheckedCounter(null);
              setIsStoreAuthenticated(false);
              setCurrentView('shop');
              updateBrowserUrl(selected, 'shop');
            }}
          />
        )}

      </main>

      {/* Footer: Pure White-Label for Customers, Admin Access only in Backoffice */}
      <footer className="border-t border-[#e5e3df] bg-white py-6 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#787671]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1a1a1a]">{shop.name}</span>
            <span>•</span>
            <span>Self-Service Instant Print Kiosk</span>
            <span>•</span>
            <span>Print orders</span>
          </div>

          {currentView !== 'customer' && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleViewChange('admin')}
                className="text-[#5645d4] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Platform Owner Portal (Abhinav)</span>
              </button>
            </div>
          )}
        </div>
      </footer>

    </div>
  );
}

export default App;
