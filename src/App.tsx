import { useState, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { Header } from './components/layout/Header';
import { CustomerOrderFlow } from './components/customer/CustomerOrderFlow';
import { CustomerOrderStatus } from './components/customer/CustomerOrderStatus';
import { ShopDashboard } from './components/shop/ShopDashboard';
import { ShopSettings } from './components/shop/ShopSettings';
import {
  getShop,
  getOrders,
  resetDemoData,
  subscribeToStore,
} from './lib/store';
import type { Shop } from './types';

export function App() {
  const [shop, setShop] = useState<Shop>(() => getShop());
  const [currentView, setCurrentView] = useState<'customer' | 'shop' | 'settings'>('customer');
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(null);
  // Default to true so it is 100% "Mobile-Free" widescreen by default!
  const [isMobileFree, setIsMobileFree] = useState<boolean>(true);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  // Sync with localStorage & URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const orderParam = params.get('orderId');

    if (viewParam === 'shop') setCurrentView('shop');
    else if (viewParam === 'settings') setCurrentView('settings');
    else if (viewParam === 'customer') setCurrentView('customer');

    if (orderParam) {
      setActiveTrackingOrderId(orderParam);
      setCurrentView('customer');
    }

    const updateCounts = () => {
      const orders = getOrders(shop.id);
      const pending = orders.filter(o => ['new', 'review'].includes(o.status)).length;
      setPendingOrdersCount(pending);
      setShop(getShop());
    };

    updateCounts();
    const unsub = subscribeToStore(updateCounts);
    return unsub;
  }, [shop.id]);

  const handleResetDemo = () => {
    if (window.confirm('Reset sample queue orders and default shop settings?')) {
      resetDemoData();
      setShop(getShop());
      setActiveTrackingOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f4] flex flex-col text-[#37352f] antialiased selection:bg-[#e6e0f5] selection:text-[#5645d4]">
      
      {/* Notion-style Top Bar */}
      <Header
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          if (view !== 'customer') {
            setActiveTrackingOrderId(null);
          }
        }}
        shop={shop}
        onResetDemo={handleResetDemo}
        pendingCount={pendingOrdersCount}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'customer' && (
          <div>
            {/* View Mode Toggle Bar (Desktop vs Mobile) */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-1 flex items-center justify-between text-xs text-[#787671]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1aae39]" />
                <span className="font-semibold text-[#1a1a1a]">
                  {isMobileFree ? 'Desktop (Mobile-Free Full Width)' : 'Simulated Mobile View'}
                </span>
                <span className="text-[10px] font-bold text-[#5645d4] bg-[#e6e0f5] px-2 py-0.5 rounded-full">
                  Free Student Service
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
                  <span>Desktop Mode (Mobile-Free)</span>
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
                    onBackToOrder={() => setActiveTrackingOrderId(null)}
                  />
                ) : (
                  <CustomerOrderFlow
                    shop={shop}
                    isMobileFree={isMobileFree}
                    onOrderSubmitted={(order) => {
                      setActiveTrackingOrderId(order.id);
                    }}
                    onViewStatus={(orderId) => {
                      setActiveTrackingOrderId(orderId);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {currentView === 'shop' && (
          <ShopDashboard shop={shop} />
        )}

        {currentView === 'settings' && (
          <ShopSettings shop={shop} onShopUpdated={(updated) => setShop(updated)} />
        )}
      </main>

      {/* Perspective Quick Switcher */}
      <aside aria-label="Demo perspective switcher" className="fixed bottom-4 right-4 z-40 bg-[#0a1530] text-white p-1.5 rounded-[10px] shadow-xl border border-[#1a2a52] flex items-center gap-1 text-xs">
        <span className="text-[10px] uppercase font-bold text-[#f9e79f] px-2 font-mono">
          Perspective
        </span>
        <button
          type="button"
          onClick={() => {
            setCurrentView('customer');
            setActiveTrackingOrderId(null);
          }}
          className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
            currentView === 'customer'
              ? 'bg-[#5645d4] text-white font-semibold'
              : 'text-[#a4a097] hover:text-white'
          }`}
        >
          Customer View
        </button>
        <button
          type="button"
          onClick={() => setCurrentView('shop')}
          className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
            currentView === 'shop'
              ? 'bg-[#5645d4] text-white font-semibold'
              : 'text-[#a4a097] hover:text-white'
          }`}
        >
          Shop Queue ({pendingOrdersCount})
        </button>
      </aside>

      {/* Footer */}
      <footer className="border-t border-[#e5e3df] bg-white py-4 mt-8 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#787671]">
          <div>
            <span className="font-semibold text-[#1a1a1a]">Anti-Gravity QR Print Platform</span> — 100% Free self-service workflow for local print stores & copy centers.
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-[#a4a097]">Design: Notion Editorial Tokens</span>
            <span>•</span>
            <button
              type="button"
              onClick={handleResetDemo}
              className="hover:text-[#5645d4] font-medium cursor-pointer"
            >
              Reset Demo Queue
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
export default App;
