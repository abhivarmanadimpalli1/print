import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  DollarSign,
  TrendingUp,
  Plus,
  Copy,
  ExternalLink,
  MessageCircle,
  Key,
  Trash2,
  Sparkles,
  ArrowLeft,
  X,
  FileText,
  Store,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  hydratePublishedShop,
  addNewStore,
  deleteStore,
  getCityPlatformMetrics,
  getOrders,
} from '../../lib/store';
import { assignShopCounter, createCounterSetupLink, isPlatformAdmin, listManagedShops, signInToPlatform, signOutFromCounter } from '../../lib/supabase';
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  isFirebaseConfigured,
  type FirebaseConfig,
} from '../../lib/firebase';
import type { Shop } from '../../types';

interface SuperAdminDashboardProps {
  onBackToStore: () => void;
  onSelectShopToView: (shop: Shop) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onBackToStore,
  onSelectShopToView,
}) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [isSavingStore, setIsSavingStore] = useState(false);

  // Data state
  const [shops, setShops] = useState<Shop[]>([]);
  const [metrics, setMetrics] = useState(() => getCityPlatformMetrics());

  // Add store modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newStoreLocation, setNewStoreLocation] = useState<string>('');
  const [newStoreSlug, setNewStoreSlug] = useState<string>('');
  const [newStoreOwner, setNewStoreOwner] = useState<string>('');
  const [newStorePhone, setNewStorePhone] = useState<string>('');
  const [newStoreCounterEmail, setNewStoreCounterEmail] = useState('');
  const [newStoreMonthlyFee, setNewStoreMonthlyFee] = useState<number>(499);
  const [newStoreBwRate, setNewStoreBwRate] = useState<number>(2.0);
  const [newStoreColorRate, setNewStoreColorRate] = useState<number>(10.0);
  const [newStoreStatus, setNewStoreStatus] = useState<'active' | 'trial'>('active');

  // Firebase Database State
  const [isFirebaseLive, setIsFirebaseLive] = useState<boolean>(() => isFirebaseConfigured());
  const [currentFirebaseConfig, setCurrentFirebaseConfig] = useState<FirebaseConfig | null>(() => getFirebaseConfig());
  const [showFirebaseModal, setShowFirebaseModal] = useState<boolean>(false);
  const [firebaseSnippetInput, setFirebaseSnippetInput] = useState<string>('');
  const [firebaseStatusMsg, setFirebaseStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Copied feedback
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Growth Simulator
  const [simulatedShopsCount, setSimulatedShopsCount] = useState<number>(30);
  const [simulatedMonthlyFee, setSimulatedMonthlyFee] = useState<number>(499);

  const refreshData = useCallback(async () => {
    const registered = (await listManagedShops()).map(hydratePublishedShop);
    setShops(registered);
    setMetrics(getCityPlatformMetrics(registered));
    setIsFirebaseLive(isFirebaseConfigured());
    setCurrentFirebaseConfig(getFirebaseConfig());
  }, []);

  useEffect(() => {
    let active = true;
    void isPlatformAdmin().then(async authorized => {
      if (!active || !authorized) return;
      setIsAdminAuthenticated(true);
      await refreshData();
    }).catch(error => {
      if (active) setAdminAuthError(error.message);
    }).finally(() => {
      if (active) setIsCheckingAdmin(false);
    });
    return () => { active = false; };
  }, [refreshData]);

  const handleConnectFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    setFirebaseStatusMsg(null);

    const input = firebaseSnippetInput.trim();
    if (!input) {
      setFirebaseStatusMsg({ type: 'error', text: 'Please paste your Firebase configuration code or JSON.' });
      return;
    }

    try {
      let parsed: Partial<FirebaseConfig> = {};

      if (input.startsWith('{') && input.endsWith('}')) {
        parsed = JSON.parse(input);
      } else {
        // Extract values using regex matching
        const extract = (key: string) => {
          const match = input.match(new RegExp(`${key}["']?\\s*:\\s*["']([^"']+)["']`));
          return match ? match[1] : '';
        };

        parsed = {
          apiKey: extract('apiKey'),
          authDomain: extract('authDomain'),
          projectId: extract('projectId'),
          storageBucket: extract('storageBucket'),
          messagingSenderId: extract('messagingSenderId'),
          appId: extract('appId'),
        };
      }

      if (!parsed.projectId || !parsed.apiKey) {
        setFirebaseStatusMsg({
          type: 'error',
          text: 'Could not find "projectId" and "apiKey" in the snippet. Make sure you copy the entire firebaseConfig object.',
        });
        return;
      }

      const fullConfig: FirebaseConfig = {
        apiKey: parsed.apiKey || '',
        authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
        projectId: parsed.projectId || '',
        storageBucket: parsed.storageBucket || `${parsed.projectId}.firebasestorage.app`,
        messagingSenderId: parsed.messagingSenderId || '',
        appId: parsed.appId || '',
      };

      saveFirebaseConfig(fullConfig);
      setIsFirebaseLive(true);
      setCurrentFirebaseConfig(fullConfig);
      setFirebaseStatusMsg({
        type: 'success',
        text: `✓ Successfully connected to Firebase Project: "${fullConfig.projectId}"! Real-time Firestore sync is now active.`,
      });

      setTimeout(() => {
        setShowFirebaseModal(false);
        void refreshData().catch(error => setStoreError(error.message));
      }, 1500);
    } catch (err: unknown) {
      setFirebaseStatusMsg({
        type: 'error',
        text: `Error parsing configuration: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setIsCheckingAdmin(true);
    try {
      await signInToPlatform(adminEmail.trim(), adminPasswordInput);
      await refreshData();
      setAdminPasswordInput('');
      setIsAdminAuthenticated(true);
    } catch (error) {
      setAdminAuthError(error instanceof Error ? error.message : 'Could not sign in to the platform.');
    } finally {
      setIsCheckingAdmin(false);
    }
  };

  const handleAddStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      alert('Please provide a store name.');
      return;
    }

    const generatedSlug = (newStoreSlug.trim() || newStoreName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

    setStoreError(null);
    setIsSavingStore(true);
    let created: Shop;
    try {
      created = await addNewStore({
        name: newStoreName.trim(),
        slug: generatedSlug,
        location: newStoreLocation.trim() || 'Local Print Shop',
        ownerName: newStoreOwner.trim() || 'Shop Owner',
        ownerPhone: newStorePhone.trim() || '+91 98000 00000',
        monthlySubscriptionFee: Number(newStoreMonthlyFee) || 499,
        subscriptionStatus: newStoreStatus,
        pricing: {
          bwPerPage: Number(newStoreBwRate) || 2.0,
          colorPerPage: Number(newStoreColorRate) || 10.0,
          duplexRateRatio: 0.9,
          paperSizes: [
            { id: 'A4', name: 'A4 (Standard 75 GSM)', multiplier: 1.0 },
            { id: 'Legal', name: 'Legal (Long)', multiplier: 1.25 },
            { id: 'A3', name: 'A3 (Large Ledger)', multiplier: 2.0 },
          ],
        },
      }, newStoreCounterEmail.trim());
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : 'Could not create this store.');
      return;
    } finally {
      setIsSavingStore(false);
    }
    setShops(previous => [...previous, { ...created, counterEmail: newStoreCounterEmail.trim() || undefined }]);
    void refreshData().catch(error => setStoreError(error.message));
    setShowAddModal(false);
    // Reset form
    setNewStoreName('');
    setNewStoreLocation('');
    setNewStoreSlug('');
    setNewStoreOwner('');
    setNewStorePhone('');
    setNewStoreCounterEmail('');

    alert(`✓ Successfully onboarded "${created.name}"! Unique URL: /s/${created.slug}`);
  };

  const handleDeleteStore = async (shopId: string, shopName: string) => {
    if (window.confirm(`Are you sure you want to remove "${shopName}" from the platform?`)) {
      try {
        await deleteStore(shopId);
        setShops(previous => previous.filter(shop => shop.id !== shopId));
        await refreshData();
      } catch (error) {
        setStoreError(error instanceof Error ? error.message : 'Could not remove this store.');
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(id);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const updateCounterEmail = async (shop: Shop) => {
    const email = window.prompt(`Counter account email for ${shop.name}. Leave blank for platform access only.`, shop.counterEmail ?? '');
    if (email === null) return;
    const value = email.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStoreError('Enter a valid counter email.');
      return;
    }
    try {
      setStoreError(null);
      await assignShopCounter(shop.id, value);
      await refreshData();
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : 'Could not update counter access.');
    }
  };

  const prepareCounterDevice = async (shop: Shop) => {
    setStoreError(null);
    try {
      const link = await createCounterSetupLink(shop.id);
      window.prompt(`Copy this one-use link for ${shop.name}. It expires in 24 hours and replaces the previous device when activated.`, link);
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : 'Could not create the counter setup link.');
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://print.vercel.app';

  // Master Admin Login Screen
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-[#242424] border border-[#3d3d3d] shadow-none rounded-none">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#181818] text-[#ffffff] mx-auto flex items-center justify-center mb-3">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#ffffff]">Platform Owner Portal</h2>
            <p className="text-xs text-[#b0b0b0] mt-1">
              Sign in with your platform owner account to manage print shops.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#dedede] mb-1.5">
                Owner email
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#dedede] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className="w-full text-xs px-3.5 py-2.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all font-mono"
                autoFocus
              />
            </div>

            {adminAuthError && (
              <div className="p-2.5 bg-[#402321] border border-[#ff8278]/30 rounded-none text-xs text-[#ff8278]">
                {adminAuthError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isCheckingAdmin}
              className="w-full py-2.5 text-xs font-semibold"
            >
              {isCheckingAdmin ? 'Checking access…' : 'Sign in to platform'}
            </Button>

            <button
              type="button"
              onClick={onBackToStore}
              className="w-full text-xs text-[#b0b0b0] hover:text-[#ffffff] flex items-center justify-center gap-1.5 pt-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Print Counter</span>
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#181818] text-white p-6 rounded-none shadow-none flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffffff] bg-[#303030] px-2 py-0.5 rounded font-mono">
              City Platform Master
            </span>
            <span className="text-xs text-[#969696]">Owned & Managed by Abhinav</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Print Shop Management
          </h1>
          <p className="text-xs text-[#969696] mt-0.5">
            Set up print shops, share customer upload links, and assign counter access.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => {
            void signOutFromCounter().then(() => { setIsAdminAuthenticated(false); setShops([]); }).catch(error => setStoreError(error.message));
          }}>Sign out</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add New Store
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToStore}
            className="text-white hover:bg-white/10"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Exit to Counter
          </Button>
        </div>
      </div>

      {/* Firebase Cloud Database Status Banner */}
      <div className="bg-[#242424] p-4 rounded-none border border-[#3d3d3d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-none">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isFirebaseLive ? 'bg-[#163529] text-[#6ed5a3]' : 'bg-[#3c2b22] text-[#f3ba83]'}`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-[#ffffff]">
                Database: {isFirebaseLive ? 'Firebase Firestore (Live & Synced)' : 'Firebase Database (Ready to Connect)'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFirebaseLive ? 'bg-[#163529] text-[#6ed5a3]' : 'bg-[#3c2b22] text-[#f3ba83]'}`}>
                {isFirebaseLive ? 'CONNECTED' : 'ACTION REQUIRED'}
              </span>
            </div>
            <p className="text-[11px] text-[#b0b0b0] mt-0.5">
              {isFirebaseLive
                ? `Project ID: "${currentFirebaseConfig?.projectId}" • Orders and bookstore queues sync in real-time.`
                : 'Connect your Firebase project to eliminate "Order Not Found" and sync all stores across the city.'}
            </p>
          </div>
        </div>

        <Button
          variant={isFirebaseLive ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setShowFirebaseModal(true)}
          icon={<Database className="w-3.5 h-3.5" />}
        >
          {isFirebaseLive ? 'Firebase Settings' : 'Connect Firebase'}
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Abhinav's Monthly SaaS Revenue */}
        <Card className="p-5 bg-[#242424] border border-[#3d3d3d] rounded-none shadow-none">
          <div className="flex items-center justify-between text-[#b0b0b0] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Your Monthly SaaS Revenue</span>
            <div className="w-7 h-7 rounded-full bg-[#163529] text-[#6ed5a3] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#6ed5a3]">
            ₹{metrics.monthlyRecurringRevenue.toLocaleString()}
            <span className="text-xs font-normal text-[#b0b0b0]"> / month</span>
          </div>
          <p className="text-[11px] text-[#b0b0b0] mt-1">
            From {metrics.activeSubscriptions} active shop subscriptions
          </p>
        </Card>

        {/* Active Bookstores */}
        <Card className="p-5 bg-[#242424] border border-[#3d3d3d] rounded-none shadow-none">
          <div className="flex items-center justify-between text-[#b0b0b0] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Onboarded Shops</span>
            <div className="w-7 h-7 rounded-full bg-[#303030] text-[#ff8278] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#ffffff]">
            {metrics.totalShops}
            <span className="text-xs font-normal text-[#b0b0b0]"> stores</span>
          </div>
          <p className="text-[11px] text-[#b0b0b0] mt-1">
            Independent shops. One connected platform.
          </p>
        </Card>

        {/* City Print Orders */}
        <Card className="p-5 bg-[#242424] border border-[#3d3d3d] rounded-none shadow-none">
          <div className="flex items-center justify-between text-[#b0b0b0] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">City Print Orders</span>
            <div className="w-7 h-7 rounded-full bg-[#3c2b22] text-[#f3ba83] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#ffffff]">
            {metrics.totalCityOrders}
            <span className="text-xs font-normal text-[#b0b0b0]"> orders</span>
          </div>
          <p className="text-[11px] text-[#b0b0b0] mt-1">
            {metrics.totalCityPagesPrinted} total pages printed
          </p>
        </Card>

        {/* Total Bookstores Gross Sales */}
        <Card className="p-5 bg-[#242424] border border-[#3d3d3d] rounded-none shadow-none">
          <div className="flex items-center justify-between text-[#b0b0b0] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Shop Print Turnover</span>
            <div className="w-7 h-7 rounded-full bg-[#243239] text-[#8ccce9] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#ffffff]">
            ₹{metrics.totalCityGrossSales.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#b0b0b0] mt-1">
            100% kept directly by shopkeepers
          </p>
        </Card>

      </div>

      {/* SaaS Revenue Growth Simulator */}
      <Card className="p-5 bg-[#303030] border border-[#3d3d3d] rounded-none">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#ff8278]">
              <Sparkles className="w-4 h-4" />
              <span>Abhinav's City Scaling Calculator</span>
            </div>
            <h3 className="text-sm font-semibold text-[#ffffff] mt-0.5">
              Projected Monthly & Annual Recurring SaaS Profit
            </h3>
            <p className="text-xs text-[#b0b0b0]">
              See how much you will earn by signing up shops in your city at a flat monthly software fee.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-[#b0b0b0] block mb-1">Shops Onboarded:</span>
              <div className="flex items-center gap-1">
                {[10, 25, 50, 100].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSimulatedShopsCount(cnt)}
                    className={`px-2.5 py-1 rounded-none font-semibold cursor-pointer ${
                      simulatedShopsCount === cnt
                        ? 'bg-[#da291c] text-white shadow-none'
                        : 'bg-[#242424] border border-[#3d3d3d] text-[#b0b0b0] hover:text-[#ffffff]'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[#b0b0b0] block mb-1">Monthly Fee:</span>
              <div className="flex items-center gap-1">
                {[499, 699, 999].map(fee => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => setSimulatedMonthlyFee(fee)}
                    className={`px-2.5 py-1 rounded-none font-semibold cursor-pointer ${
                      simulatedMonthlyFee === fee
                        ? 'bg-[#137333] text-white shadow-none'
                        : 'bg-[#242424] border border-[#3d3d3d] text-[#b0b0b0] hover:text-[#ffffff]'
                    }`}
                  >
                    ₹{fee}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#242424] p-3 rounded-none border border-[#3d3d3d] shadow-none text-right">
              <span className="text-[10px] text-[#b0b0b0] uppercase tracking-wider block">Your Net Income</span>
              <div className="text-base font-bold text-[#6ed5a3]">
                ₹{(simulatedShopsCount * simulatedMonthlyFee).toLocaleString()} / month
              </div>
              <div className="text-[11px] text-[#b0b0b0]">
                ₹{(simulatedShopsCount * simulatedMonthlyFee * 12).toLocaleString()} / year
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Bookstores Directory Table */}
      <Card className="bg-[#242424] border border-[#3d3d3d] rounded-none shadow-none overflow-hidden">
        <div className="p-4 border-b border-[#3d3d3d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#ffffff]">Print Shops</h2>
            <p className="text-xs text-[#b0b0b0]">
              Each shop has its own customer upload link and counter.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add New Store
          </Button>
        </div>
        {storeError && !showAddModal && <p role="alert" className="px-4 py-2 text-xs text-[#ff8278]">{storeError}</p>}

        <div className="overflow-x-auto">
          <table className="shop-directory w-full text-left text-xs">
            <thead className="bg-[#1c1c1c] text-[#b0b0b0] border-b border-[#3d3d3d] font-semibold">
              <tr>
                <th className="py-3 px-4">Shop & Location</th>
                <th className="py-3 px-4">Unique Customer URL</th>
                <th className="py-3 px-4">Counter access</th>
                <th className="py-3 px-4">Owner Contact</th>
                <th className="py-3 px-4">Monthly SaaS Fee</th>
                <th className="py-3 px-4">Orders & Sales</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {shops.map((s) => {
                const shopOrders = getOrders(s.id);
                const grossSales = shopOrders.reduce((sum, o) => sum + (o.config?.subtotal || 0), 0);
                const uniqueCustomerUrl = `${origin}/s/${s.slug}`;
                const shopCounterUrl = `${origin}/s/${s.slug}/counter`;

                const whatsappMessage = encodeURIComponent(
                  `Hello ${s.ownerName || 'there'}! Here are the links for ${s.name}.\n\nCounter: ${shopCounterUrl}\nSign in with your assigned email or use your one-time counter setup link.\n\nCustomer uploads: ${uniqueCustomerUrl}`
                );
                const whatsappUrl = `https://wa.me/${(s.ownerPhone || s.phone || '').replace(/[^0-9]/g, '')}?text=${whatsappMessage}`;

                return (
                  <tr key={s.id} className="hover:bg-[#303030] transition-colors">
                    {/* Shop & Location */}
                    <td data-label="Shop & location" className="py-3 px-4">
                      <div className="font-semibold text-[#ffffff] flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#ff8278]" />
                        <span>{s.name}</span>
                      </div>
                      <div className="text-[11px] text-[#b0b0b0] mt-0.5">{s.location}</div>
                      <div className="text-[10px] text-[#969696] mt-0.5">
                        B&W: ₹{s.pricing.bwPerPage}/pg • Color: ₹{s.pricing.colorPerPage}/pg
                      </div>
                    </td>

                    {/* Customer QR & Shopkeeper Links */}
                    <td data-label="Customer links" className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-[#ff8278]">
                          <span className="text-[10px] text-[#b0b0b0] font-sans font-semibold">QR:</span>
                          <span className="truncate max-w-[130px]" title={uniqueCustomerUrl}>
                            /s/{s.slug}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(uniqueCustomerUrl, `${s.id}_cust`)}
                            className="p-1 hover:bg-[#303030] rounded cursor-pointer transition-colors"
                            title="Copy customer upload link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/s/${s.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-[#303030] rounded cursor-pointer transition-colors"
                            title="Open customer uploads"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-[11px] text-[#f3ba83]">
                          <span className="text-[10px] text-[#b0b0b0] font-sans font-semibold">Portal:</span>
                          <span className="truncate max-w-[130px]" title={shopCounterUrl}>
                            /s/{s.slug}/counter
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(shopCounterUrl, `${s.id}_counter`)}
                            className="p-1 hover:bg-[#3c2b22] rounded cursor-pointer transition-colors"
                            title="Copy Shopkeeper Counter URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/s/${s.slug}/counter`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-[#3c2b22] rounded cursor-pointer transition-colors"
                            title="Open Counter Portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {copiedSlug && copiedSlug.startsWith(s.id) && (
                          <span className="text-[10px] text-[#6ed5a3] font-semibold block">
                            ✓ Copied Link!
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="Counter access" className="py-3 px-4">
                      <div className="space-y-1">
                        <div>{s.counterEmail || 'Platform owner'}</div>
                        <button type="button" className="text-[#ff8278] underline" onClick={() => void updateCounterEmail(s)}>
                          Edit counter email
                        </button>
                        <button type="button" className="block text-[#ff8278] underline" onClick={() => void prepareCounterDevice(s)}>
                          Get counter setup link
                        </button>
                      </div>
                    </td>

                    {/* Owner Contact */}
                    <td data-label="Owner contact" className="py-3 px-4">
                      <div className="font-medium text-[#ffffff]">{s.ownerName || 'Manager'}</div>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#6ed5a3] hover:underline flex items-center gap-1 mt-0.5 font-medium"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>{s.ownerPhone || s.phone}</span>
                      </a>
                    </td>

                    {/* Monthly SaaS Fee */}
                    <td data-label="Monthly fee" className="py-3 px-4">
                      <div className="font-bold text-[#6ed5a3]">
                        ₹{s.monthlySubscriptionFee || 499}
                        <span className="text-[10px] text-[#b0b0b0] font-normal"> /mo</span>
                      </div>
                      <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                        s.subscriptionStatus === 'active'
                          ? 'bg-[#163529] text-[#6ed5a3]'
                          : 'bg-[#3c2b22] text-[#f3ba83]'
                      }`}>
                        {s.subscriptionStatus || 'active'}
                      </span>
                    </td>

                    {/* Orders & Sales */}
                    <td data-label="Orders & sales" className="py-3 px-4">
                      <div className="font-semibold text-[#ffffff]">{shopOrders.length} orders</div>
                      <div className="text-[11px] text-[#b0b0b0]">₹{grossSales.toFixed(2)} sales</div>
                    </td>

                    {/* Actions */}
                    <td data-label="Actions" className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Open as Shopkeeper */}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectShopToView(s)}
                          className="text-[11px] py-1"
                        >
                          Open Queue
                        </Button>

                        {/* WhatsApp Credentials */}
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-[#163529] text-[#6ed5a3] hover:bg-[#234635] rounded-none transition-colors"
                          title="Share store links on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>

                        {/* Delete Shop */}
                        {s.id !== 'campus-prints' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(s.id, s.name)}
                            className="p-1.5 text-[#969696] hover:text-[#ff8278] hover:bg-[#402321] rounded-none transition-colors cursor-pointer"
                            title="Remove Store"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Onboard New Bookstore Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#242424] rounded-none border border-[#3d3d3d] shadow-none max-w-lg w-full max-h-[90vh] overflow-y-auto">
            
            <div className="bg-[#181818] text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#ffffff]" />
                <h3 className="text-sm font-semibold">Add a print shop</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#969696] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStoreSubmit} className="p-6 space-y-4">
              
              {/* Store Name */}
              <div>
                <label className="block text-xs font-semibold text-[#dedede] mb-1">
                  Print shop name
                </label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => {
                    setNewStoreName(e.target.value);
                    if (!newStoreSlug) {
                      setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }
                  }}
                  placeholder="e.g. Sri Balaji Book Depot & Xerox"
                  className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-[#dedede] mb-1">
                  Shop address:
                </label>
                <input
                  type="text"
                  value={newStoreLocation}
                  onChange={(e) => setNewStoreLocation(e.target.value)}
                  placeholder="e.g. Opp. Govt Degree College, Line 2"
                  className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all"
                />
              </div>

              {/* URL Slug Preview */}
              <div>
                <label className="block text-xs font-semibold text-[#dedede] mb-1">
                  Unique URL Path Slug:
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                  <span className="font-mono text-[#b0b0b0]">{origin}/s/</span>
                  <input
                    type="text"
                    value={newStoreSlug}
                    onChange={(e) => setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="balaji-book-depot"
                    className="min-w-0 flex-1 text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Owner Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#dedede] mb-1">
                    Owner / Manager Name:
                  </label>
                  <input
                    type="text"
                    value={newStoreOwner}
                    onChange={(e) => setNewStoreOwner(e.target.value)}
                    placeholder="e.g. Srinivas Rao"
                    className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#dedede] mb-1">
                    WhatsApp Phone Number:
                  </label>
                  <input
                    type="text"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    placeholder="e.g. +91 98480 12345"
                    className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-counter-email" className="block text-xs font-semibold text-[#dedede] mb-1">
                  Shop owner’s counter email
                </label>
                <input
                  id="new-counter-email"
                  type="email"
                  value={newStoreCounterEmail}
                  onChange={(e) => setNewStoreCounterEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none"
                />
                <p className="mt-1 text-xs text-[#b0b0b0]">Use an existing counter account, or leave this blank and give the shop a one-time device setup link after creation.</p>
              </div>

              {/* SaaS Subscription Fee & Rates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#dedede] mb-1">
                    Monthly SaaS Fee (₹):
                  </label>
                  <input
                    type="number"
                    value={newStoreMonthlyFee}
                    onChange={(e) => setNewStoreMonthlyFee(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#dedede] mb-1">
                    B&W Rate (₹/pg):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newStoreBwRate}
                    onChange={(e) => setNewStoreBwRate(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#dedede] mb-1">
                    Color Rate (₹/pg):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={newStoreColorRate}
                    onChange={(e) => setNewStoreColorRate(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff]"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-[#dedede] mb-1">
                  Subscription Status:
                </label>
                <select
                  value={newStoreStatus}
                  onChange={(e) => setNewStoreStatus(e.target.value as 'active' | 'trial')}
                  className="w-full text-xs px-3 py-2 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff]"
                >
                  <option value="active">Active (Paid SaaS Customer)</option>
                  <option value="trial">14-Day Free Trial</option>
                </select>
              </div>

              {/* Submit */}
              <div className="pt-2">
                {storeError && <p role="alert" className="mb-2 text-xs text-[#ff8278]">{storeError}</p>}
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSavingStore}
                  className="w-full py-2.5 text-xs font-semibold"
                >
                  {isSavingStore ? 'Publishing store…' : 'Create print shop'}
                </Button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Firebase Database Configuration Modal */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#242424] rounded-none border border-[#3d3d3d] shadow-none max-w-xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="bg-[#181818] text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#ffffff]" />
                <div>
                  <h3 className="text-sm font-semibold">Connect Firebase Database</h3>
                  <p className="text-[11px] text-[#969696]">Persistent Cloud Firestore & File Storage</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="p-1 text-[#969696] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectFirebase} className="p-6 space-y-4">
              
              {/* Instructions */}
              <div className="p-3 bg-[#1c1c1c] rounded-none border border-[#3d3d3d] text-xs space-y-1.5 text-[#dedede]">
                <div className="font-semibold text-[#ffffff] flex items-center gap-1.5">
                  <span>How to get your Firebase snippet (2-minute free setup):</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#bcbcbc]">
                  <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-[#ff8278] underline font-medium">console.firebase.google.com</a> and click <strong>Add project</strong>.</li>
                  <li>Click <strong>Build &gt; Firestore Database</strong> &gt; Create Database (choose <em>Start in Test mode</em>).</li>
                  <li>Click the ⚙️ gear icon &gt; <strong>Project settings</strong> &gt; Under <em>Your apps</em> click Web (<strong>&lt;/&gt;</strong>) and copy the <code className="bg-[#242424] px-1 py-0.5 rounded font-mono">firebaseConfig</code> object.</li>
                </ol>
              </div>

              {/* Paste Config Input */}
              <div>
                <label className="block text-xs font-semibold text-[#dedede] mb-1.5">
                  Paste your Firebase Config Snippet or JSON:
                </label>
                <textarea
                  rows={8}
                  value={firebaseSnippetInput}
                  onChange={(e) => setFirebaseSnippetInput(e.target.value)}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-print-app.firebaseapp.com",\n  projectId: "my-print-app",\n  storageBucket: "my-print-app.firebasestorage.app",\n  messagingSenderId: "1234567890",\n  appId: "1:1234567890:web:..."\n};`}
                  className="w-full text-xs p-3 bg-[#1c1c1c] border border-[#3d3d3d] rounded-none text-[#ffffff] font-mono focus:bg-[#242424] focus:outline-none focus:ring-1 focus:ring-[#da291c] transition-all"
                />
              </div>

              {/* Status Message */}
              {firebaseStatusMsg && (
                <div className={`p-3 rounded-none text-xs flex items-center gap-2 ${
                  firebaseStatusMsg.type === 'success'
                    ? 'bg-[#163529] text-[#6ed5a3] border border-[#cbf0d8]'
                    : 'bg-[#402321] text-[#ff8278] border border-[#ff8278]/30'
                }`}>
                  {firebaseStatusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{firebaseStatusMsg.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowFirebaseModal(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  className="py-2 px-4"
                  icon={<Database className="w-4 h-4" />}
                >
                  Save & Connect Firebase
                </Button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
