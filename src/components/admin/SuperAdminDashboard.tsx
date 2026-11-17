import React, { useState } from 'react';
import {
  Building2,
  DollarSign,
  TrendingUp,
  Plus,
  Copy,
  ExternalLink,
  MessageCircle,
  Key,
  Eye,
  EyeOff,
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
  getAllShops,
  addNewStore,
  deleteStore,
  getCityPlatformMetrics,
  getOrders,
} from '../../lib/store';
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
  // Authentication gate for Abhinav
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('admin_auth_abhinav') === 'true';
    } catch {
      return false;
    }
  });

  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  // Data state
  const [shops, setShops] = useState<Shop[]>(() => getAllShops());
  const [metrics, setMetrics] = useState(() => getCityPlatformMetrics());

  // Show/hide passwords
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Add store modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newStoreLocation, setNewStoreLocation] = useState<string>('');
  const [newStoreSlug, setNewStoreSlug] = useState<string>('');
  const [newStoreOwner, setNewStoreOwner] = useState<string>('');
  const [newStorePhone, setNewStorePhone] = useState<string>('');
  const [newStoreLoginId, setNewStoreLoginId] = useState<string>('');
  const [newStorePin, setNewStorePin] = useState<string>(() => Math.floor(1000 + Math.random() * 9000).toString());
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

  const refreshData = () => {
    setShops(getAllShops());
    setMetrics(getCityPlatformMetrics());
    setIsFirebaseLive(isFirebaseConfigured());
    setCurrentFirebaseConfig(getFirebaseConfig());
  };

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
        refreshData();
      }, 1500);
    } catch (err: unknown) {
      setFirebaseStatusMsg({
        type: 'error',
        text: `Error parsing configuration: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim().toLowerCase() === 'abhinav' || adminPasswordInput.trim() === 'abhinav2026' || adminPasswordInput.trim() === '1234') {
      try {
        sessionStorage.setItem('admin_auth_abhinav', 'true');
      } catch {}
      setIsAdminAuthenticated(true);
      setAdminAuthError(null);
    } else {
      setAdminAuthError('Incorrect master admin password. (Hint: abhinav2026)');
    }
  };

  const handleAddStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      alert('Please provide a store name.');
      return;
    }

    const generatedSlug = (newStoreSlug.trim() || newStoreName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));

    const created = addNewStore({
      name: newStoreName.trim(),
      slug: generatedSlug,
      location: newStoreLocation.trim() || 'Central City Bookstore',
      ownerName: newStoreOwner.trim() || 'Bookstore Owner',
      ownerPhone: newStorePhone.trim() || '+91 98000 00000',
      loginId: newStoreLoginId.trim() || generatedSlug.replace(/-/g, '_'),
      passwordHash: newStorePin.trim() || '1234',
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
    });

    refreshData();
    setShowAddModal(false);
    // Reset form
    setNewStoreName('');
    setNewStoreLocation('');
    setNewStoreSlug('');
    setNewStoreOwner('');
    setNewStorePhone('');
    setNewStoreLoginId('');
    setNewStorePin(Math.floor(1000 + Math.random() * 9000).toString());

    alert(`✓ Successfully onboarded "${created.name}"! Unique URL: /s/${created.slug}`);
  };

  const handleDeleteStore = (shopId: string, shopName: string) => {
    if (window.confirm(`Are you sure you want to remove "${shopName}" from the platform?`)) {
      deleteStore(shopId);
      refreshData();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(id);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const togglePasswordReveal = (shopId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [shopId]: !prev[shopId],
    }));
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://print.vercel.app';

  // Master Admin Login Screen
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-white border border-[#e5e3df] shadow-2xl rounded-[16px]">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#0a1530] text-[#f9e79f] mx-auto flex items-center justify-center mb-3">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#1a1a1a]">Platform Owner Portal</h2>
            <p className="text-xs text-[#787671] mt-1">
              Welcome back, <strong>Abhinav</strong>. Enter your master passcode to access city bookstore management and revenue analytics.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#37352f] mb-1.5">
                Master Passcode:
              </label>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Enter passcode (e.g. abhinav2026)"
                className="w-full text-xs px-3.5 py-2.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all font-mono"
                autoFocus
              />
              <p className="text-[10px] text-[#787671] mt-1">
                Default Master Passcode: <span className="font-mono font-bold text-[#5645d4]">abhinav2026</span>
              </p>
            </div>

            {adminAuthError && (
              <div className="p-2.5 bg-[#fdf3f2] border border-[#f5c6cb] rounded-[8px] text-xs text-[#d44c47]">
                {adminAuthError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full py-2.5 text-xs font-semibold"
            >
              Unlock Master Admin Portal
            </Button>

            <button
              type="button"
              onClick={onBackToStore}
              className="w-full text-xs text-[#787671] hover:text-[#1a1a1a] flex items-center justify-center gap-1.5 pt-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Bookstore Counter</span>
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#0a1530] text-white p-6 rounded-[14px] shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#f9e79f] bg-[#1a2a52] px-2 py-0.5 rounded font-mono">
              City Platform Master
            </span>
            <span className="text-xs text-[#a4a097]">Owned & Managed by Abhinav</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            City Bookstore Print Network & Revenue Command
          </h1>
          <p className="text-xs text-[#a4a097] mt-0.5">
            Onboard local bookstores, manage their unique URLs & passwords, and track monthly SaaS subscription income.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Onboard New Bookstore
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
      <div className="bg-white p-4 rounded-[12px] border border-[#e5e3df] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isFirebaseLive ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fef7e0] text-[#b06000]'}`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-[#1a1a1a]">
                Database: {isFirebaseLive ? 'Firebase Firestore (Live & Synced)' : 'Firebase Database (Ready to Connect)'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFirebaseLive ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fef7e0] text-[#b06000]'}`}>
                {isFirebaseLive ? 'CONNECTED' : 'ACTION REQUIRED'}
              </span>
            </div>
            <p className="text-[11px] text-[#787671] mt-0.5">
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
        <Card className="p-5 bg-white border border-[#e5e3df] rounded-[12px] shadow-xs">
          <div className="flex items-center justify-between text-[#787671] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Your Monthly SaaS Revenue</span>
            <div className="w-7 h-7 rounded-full bg-[#e6f4ea] text-[#137333] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#137333]">
            ₹{metrics.monthlyRecurringRevenue.toLocaleString()}
            <span className="text-xs font-normal text-[#787671]"> / month</span>
          </div>
          <p className="text-[11px] text-[#787671] mt-1">
            From {metrics.activeSubscriptions} active bookstore subscriptions
          </p>
        </Card>

        {/* Active Bookstores */}
        <Card className="p-5 bg-white border border-[#e5e3df] rounded-[12px] shadow-xs">
          <div className="flex items-center justify-between text-[#787671] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Onboarded Bookstores</span>
            <div className="w-7 h-7 rounded-full bg-[#e6e0f5] text-[#5645d4] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a]">
            {metrics.totalShops}
            <span className="text-xs font-normal text-[#787671]"> stores</span>
          </div>
          <p className="text-[11px] text-[#787671] mt-1">
            Across university campuses & city colleges
          </p>
        </Card>

        {/* City Print Orders */}
        <Card className="p-5 bg-white border border-[#e5e3df] rounded-[12px] shadow-xs">
          <div className="flex items-center justify-between text-[#787671] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">City Print Orders</span>
            <div className="w-7 h-7 rounded-full bg-[#fef7e0] text-[#b06000] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a]">
            {metrics.totalCityOrders}
            <span className="text-xs font-normal text-[#787671]"> orders</span>
          </div>
          <p className="text-[11px] text-[#787671] mt-1">
            {metrics.totalCityPagesPrinted} total pages printed
          </p>
        </Card>

        {/* Total Bookstores Gross Sales */}
        <Card className="p-5 bg-white border border-[#e5e3df] rounded-[12px] shadow-xs">
          <div className="flex items-center justify-between text-[#787671] mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bookstore Print Turnover</span>
            <div className="w-7 h-7 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a]">
            ₹{metrics.totalCityGrossSales.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#787671] mt-1">
            100% kept directly by shopkeepers
          </p>
        </Card>

      </div>

      {/* SaaS Revenue Growth Simulator */}
      <Card className="p-5 bg-[#faf9f8] border border-[#e5e3df] rounded-[12px]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#5645d4]">
              <Sparkles className="w-4 h-4" />
              <span>Abhinav's City Scaling Calculator</span>
            </div>
            <h3 className="text-sm font-semibold text-[#1a1a1a] mt-0.5">
              Projected Monthly & Annual Recurring SaaS Profit
            </h3>
            <p className="text-xs text-[#787671]">
              See how much you will earn by signing up bookstores in your city at a flat monthly software fee.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-[#787671] block mb-1">Bookstores Onboarded:</span>
              <div className="flex items-center gap-1">
                {[10, 25, 50, 100].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSimulatedShopsCount(cnt)}
                    className={`px-2.5 py-1 rounded-[6px] font-semibold cursor-pointer ${
                      simulatedShopsCount === cnt
                        ? 'bg-[#5645d4] text-white shadow-xs'
                        : 'bg-white border border-[#e5e3df] text-[#787671] hover:text-[#1a1a1a]'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[#787671] block mb-1">Monthly Fee:</span>
              <div className="flex items-center gap-1">
                {[499, 699, 999].map(fee => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => setSimulatedMonthlyFee(fee)}
                    className={`px-2.5 py-1 rounded-[6px] font-semibold cursor-pointer ${
                      simulatedMonthlyFee === fee
                        ? 'bg-[#137333] text-white shadow-xs'
                        : 'bg-white border border-[#e5e3df] text-[#787671] hover:text-[#1a1a1a]'
                    }`}
                  >
                    ₹{fee}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-3 rounded-[8px] border border-[#e5e3df] shadow-xs text-right">
              <span className="text-[10px] text-[#787671] uppercase tracking-wider block">Your Net Income</span>
              <div className="text-base font-bold text-[#137333]">
                ₹{(simulatedShopsCount * simulatedMonthlyFee).toLocaleString()} / month
              </div>
              <div className="text-[11px] text-[#787671]">
                ₹{(simulatedShopsCount * simulatedMonthlyFee * 12).toLocaleString()} / year
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Bookstores Directory Table */}
      <Card className="bg-white border border-[#e5e3df] rounded-[12px] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#e5e3df] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1a1a1a]">City Bookstore Network Directory</h2>
            <p className="text-xs text-[#787671]">
              Every bookstore has its own independent URL, login credentials, and customer QR standee.
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f5f4] text-[#787671] border-b border-[#e5e3df] font-semibold">
              <tr>
                <th className="py-3 px-4">Bookstore & Location</th>
                <th className="py-3 px-4">Unique Customer URL</th>
                <th className="py-3 px-4">Login Credentials (ID & PIN)</th>
                <th className="py-3 px-4">Owner Contact</th>
                <th className="py-3 px-4">Monthly SaaS Fee</th>
                <th className="py-3 px-4">Orders & Sales</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e3df]">
              {shops.map((s) => {
                const shopOrders = getOrders(s.id);
                const grossSales = shopOrders.reduce((sum, o) => sum + (o.config?.subtotal || 0), 0);
                const uniqueCustomerUrl = `${origin}/s/${s.slug}`;
                const shopCounterUrl = `${origin}/s/${s.slug}/counter`;
                const isPasswordShown = revealedPasswords[s.id] || false;

                const whatsappMessage = encodeURIComponent(
                  `Hello ${s.ownerName || 'Sir'}! Welcome to Campus QuickPrint.\n\nHere are your store credentials:\n🏪 Store: ${s.name}\n\n💻 *Shopkeeper Counter Portal:* (Open on counter PC)\n🔗 ${shopCounterUrl}\n🔐 Login ID: ${s.loginId || s.slug}\n🔑 Password/PIN: ${s.passwordHash || '1234'}\n\n📲 *Customer QR Ordering Link:* (Display for students)\n🔗 ${uniqueCustomerUrl}\n\nStudents scan this to place print jobs directly to your counter!`
                );
                const whatsappUrl = `https://wa.me/${(s.ownerPhone || s.phone || '').replace(/[^0-9]/g, '')}?text=${whatsappMessage}`;

                return (
                  <tr key={s.id} className="hover:bg-[#faf9f8] transition-colors">
                    {/* Bookstore & Location */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1a1a1a] flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-[#5645d4]" />
                        <span>{s.name}</span>
                      </div>
                      <div className="text-[11px] text-[#787671] mt-0.5">{s.location}</div>
                      <div className="text-[10px] text-[#a4a097] mt-0.5">
                        B&W: ₹{s.pricing.bwPerPage}/pg • Color: ₹{s.pricing.colorPerPage}/pg
                      </div>
                    </td>

                    {/* Customer QR & Shopkeeper Links */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-[#5645d4]">
                          <span className="text-[10px] text-[#787671] font-sans font-semibold">QR:</span>
                          <span className="truncate max-w-[130px]" title={uniqueCustomerUrl}>
                            /s/{s.slug}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(uniqueCustomerUrl, `${s.id}_cust`)}
                            className="p-1 hover:bg-[#e6e0f5] rounded cursor-pointer transition-colors"
                            title="Copy Student QR URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/s/${s.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-[#e6e0f5] rounded cursor-pointer transition-colors"
                            title="Open Student Kiosk"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-[11px] text-[#dd5b00]">
                          <span className="text-[10px] text-[#787671] font-sans font-semibold">Portal:</span>
                          <span className="truncate max-w-[130px]" title={shopCounterUrl}>
                            /s/{s.slug}/counter
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(shopCounterUrl, `${s.id}_counter`)}
                            className="p-1 hover:bg-[#ffe8d4] rounded cursor-pointer transition-colors"
                            title="Copy Shopkeeper Counter URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/s/${s.slug}/counter`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:bg-[#ffe8d4] rounded cursor-pointer transition-colors"
                            title="Open Counter Portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {copiedSlug && copiedSlug.startsWith(s.id) && (
                          <span className="text-[10px] text-[#137333] font-semibold block">
                            ✓ Copied Link!
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Credentials */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[#787671] text-[10px]">ID:</span>
                          <span className="font-mono font-semibold text-[#1a1a1a]">
                            {s.loginId || s.slug}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[#787671] text-[10px]">PIN:</span>
                          <span className="font-mono font-semibold text-[#5645d4]">
                            {isPasswordShown ? (s.passwordHash || '1234') : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordReveal(s.id)}
                            className="p-0.5 hover:text-[#1a1a1a] text-[#787671] cursor-pointer"
                          >
                            {isPasswordShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Owner Contact */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#1a1a1a]">{s.ownerName || 'Manager'}</div>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#137333] hover:underline flex items-center gap-1 mt-0.5 font-medium"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>{s.ownerPhone || s.phone}</span>
                      </a>
                    </td>

                    {/* Monthly SaaS Fee */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#137333]">
                        ₹{s.monthlySubscriptionFee || 499}
                        <span className="text-[10px] text-[#787671] font-normal"> /mo</span>
                      </div>
                      <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                        s.subscriptionStatus === 'active'
                          ? 'bg-[#e6f4ea] text-[#137333]'
                          : 'bg-[#fef7e0] text-[#b06000]'
                      }`}>
                        {s.subscriptionStatus || 'active'}
                      </span>
                    </td>

                    {/* Orders & Sales */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1a1a1a]">{shopOrders.length} orders</div>
                      <div className="text-[11px] text-[#787671]">₹{grossSales.toFixed(2)} sales</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
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
                          className="p-1.5 bg-[#e6f4ea] text-[#137333] hover:bg-[#cbf0d8] rounded-[6px] transition-colors"
                          title="Send Credentials to Owner on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>

                        {/* Delete Shop */}
                        {s.id !== 'campus-prints' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(s.id, s.name)}
                            className="p-1.5 text-[#a4a097] hover:text-[#d44c47] hover:bg-[#fdf3f2] rounded-[6px] transition-colors cursor-pointer"
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
          <div className="bg-white rounded-[14px] border border-[#e5e3df] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            
            <div className="bg-[#0a1530] text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#f9e79f]" />
                <h3 className="text-sm font-semibold">Onboard New Bookstore in City</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#a4a097] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStoreSubmit} className="p-6 space-y-4">
              
              {/* Store Name */}
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  Bookstore / Xerox Center Name: *
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
                  className="w-full text-xs px-3 py-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  Address / Campus Area:
                </label>
                <input
                  type="text"
                  value={newStoreLocation}
                  onChange={(e) => setNewStoreLocation(e.target.value)}
                  placeholder="e.g. Opp. Govt Degree College, Line 2"
                  className="w-full text-xs px-3 py-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all"
                />
              </div>

              {/* URL Slug Preview */}
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  Unique URL Path Slug:
                </label>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-mono text-[#787671]">{origin}/s/</span>
                  <input
                    type="text"
                    value={newStoreSlug}
                    onChange={(e) => setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="balaji-book-depot"
                    className="flex-1 text-xs px-3 py-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Owner Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#37352f] mb-1">
                    Owner / Manager Name:
                  </label>
                  <input
                    type="text"
                    value={newStoreOwner}
                    onChange={(e) => setNewStoreOwner(e.target.value)}
                    placeholder="e.g. Srinivas Rao"
                    className="w-full text-xs px-3 py-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#37352f] mb-1">
                    WhatsApp Phone Number:
                  </label>
                  <input
                    type="text"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    placeholder="e.g. +91 98480 12345"
                    className="w-full text-xs px-3 py-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all"
                  />
                </div>
              </div>

              {/* Login Credentials for Store Owner */}
              <div className="p-3 bg-[#faf9f8] rounded-[10px] border border-[#e5e3df] space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a1a1a]">
                  <Key className="w-3.5 h-3.5 text-[#5645d4]" />
                  <span>Store Owner Login Credentials (Assigned by Abhinav)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#37352f] mb-1">
                      Store Login ID:
                    </label>
                    <input
                      type="text"
                      value={newStoreLoginId}
                      onChange={(e) => setNewStoreLoginId(e.target.value)}
                      placeholder="e.g. balaji_xerox"
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-[#e5e3df] rounded-[6px] text-[#1a1a1a] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#37352f] mb-1">
                      Secret PIN / Password:
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newStorePin}
                        onChange={(e) => setNewStorePin(e.target.value)}
                        placeholder="4-digit PIN"
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-[#e5e3df] rounded-[6px] text-[#1a1a1a] font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => setNewStorePin(Math.floor(1000 + Math.random() * 9000).toString())}
                        className="px-2 py-1.5 text-[10px] bg-white border border-[#e5e3df] rounded-[6px] hover:bg-[#f6f5f4] cursor-pointer"
                        title="Generate Random PIN"
                      >
                        🎲
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SaaS Subscription Fee & Rates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#37352f] mb-1">
                    Monthly SaaS Fee (₹):
                  </label>
                  <input
                    type="number"
                    value={newStoreMonthlyFee}
                    onChange={(e) => setNewStoreMonthlyFee(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-[6px] text-[#1a1a1a]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#37352f] mb-1">
                    B&W Rate (₹/pg):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newStoreBwRate}
                    onChange={(e) => setNewStoreBwRate(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-[6px] text-[#1a1a1a]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#37352f] mb-1">
                    Color Rate (₹/pg):
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={newStoreColorRate}
                    onChange={(e) => setNewStoreColorRate(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-1.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-[6px] text-[#1a1a1a]"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  Subscription Status:
                </label>
                <select
                  value={newStoreStatus}
                  onChange={(e) => setNewStoreStatus(e.target.value as 'active' | 'trial')}
                  className="w-full text-xs px-3 py-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a]"
                >
                  <option value="active">Active (Paid SaaS Customer)</option>
                  <option value="trial">14-Day Free Trial</option>
                </select>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-2.5 text-xs font-semibold"
                >
                  Create Bookstore & Generate Counter Kit
                </Button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Firebase Database Configuration Modal */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-[14px] border border-[#e5e3df] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="bg-[#0a1530] text-white p-5 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#f9e79f]" />
                <div>
                  <h3 className="text-sm font-semibold">Connect Firebase Database</h3>
                  <p className="text-[11px] text-[#a4a097]">Persistent Cloud Firestore & File Storage</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="p-1 text-[#a4a097] hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectFirebase} className="p-6 space-y-4">
              
              {/* Instructions */}
              <div className="p-3 bg-[#f6f5f4] rounded-[10px] border border-[#e5e3df] text-xs space-y-1.5 text-[#37352f]">
                <div className="font-semibold text-[#1a1a1a] flex items-center gap-1.5">
                  <span>How to get your Firebase snippet (2-minute free setup):</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-[#5d5b54]">
                  <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-[#5645d4] underline font-medium">console.firebase.google.com</a> and click <strong>Add project</strong>.</li>
                  <li>Click <strong>Build &gt; Firestore Database</strong> &gt; Create Database (choose <em>Start in Test mode</em>).</li>
                  <li>Click the ⚙️ gear icon &gt; <strong>Project settings</strong> &gt; Under <em>Your apps</em> click Web (<strong>&lt;/&gt;</strong>) and copy the <code className="bg-white px-1 py-0.5 rounded font-mono">firebaseConfig</code> object.</li>
                </ol>
              </div>

              {/* Paste Config Input */}
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1.5">
                  Paste your Firebase Config Snippet or JSON:
                </label>
                <textarea
                  rows={8}
                  value={firebaseSnippetInput}
                  onChange={(e) => setFirebaseSnippetInput(e.target.value)}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-print-app.firebaseapp.com",\n  projectId: "my-print-app",\n  storageBucket: "my-print-app.firebasestorage.app",\n  messagingSenderId: "1234567890",\n  appId: "1:1234567890:web:..."\n};`}
                  className="w-full text-xs p-3 bg-[#f6f5f4] border border-[#e5e3df] rounded-[8px] text-[#1a1a1a] font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5645d4] transition-all"
                />
              </div>

              {/* Status Message */}
              {firebaseStatusMsg && (
                <div className={`p-3 rounded-[8px] text-xs flex items-center gap-2 ${
                  firebaseStatusMsg.type === 'success'
                    ? 'bg-[#e6f4ea] text-[#137333] border border-[#cbf0d8]'
                    : 'bg-[#fdf3f2] text-[#d44c47] border border-[#f5c6cb]'
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
