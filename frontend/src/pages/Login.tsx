import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: 'admin' | 'staff') => {
    setError(null);
    if (role === 'admin') {
      setEmail('admin@stockiq.example.com');
      setPassword('admin12345');
    } else {
      setEmail('staff@stockiq.example.com');
      setPassword('staff12345');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed p-4 md:p-8">
      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-xs">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="font-page-title-mobile text-[20px] font-bold text-on-surface tracking-tight">
            StockIQ
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          Precision Commerce Core
        </span>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-6 w-full">
        <div className="w-full max-w-5xl rounded-2xl overflow-hidden shadow-xl bg-surface-container-lowest border border-outline-variant/30 grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* Left Brand Panel */}
          <div className="lg:col-span-6 relative p-8 md:p-12 bg-surface-container-high flex flex-col justify-between overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest/80 backdrop-blur-sm shadow-xs">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary-container to-secondary flex items-center justify-center text-white text-[12px]">
                  ✓
                </div>
                <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Intelligent Inventory Platform
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="font-page-title text-[32px] font-bold leading-tight tracking-tight text-on-surface">
                  Never run out <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                    by surprise.
                  </span>
                </h1>
                <p className="font-lead text-[15px] text-on-surface-variant max-w-sm">
                  Precision stock telemetry, append-only ledger integrity, and transparent reorder intelligence.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-lowest/80 backdrop-blur-sm border border-outline-variant/20">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-body-medium text-[13px] font-semibold text-on-surface">
                      Sub-second Ledger Tracking
                    </h4>
                    <p className="font-caption text-[11px] text-on-surface-variant">
                      Every stock change is append-only with mathematical invariant verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-lowest/80 backdrop-blur-sm border border-outline-variant/20">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-body-medium text-[13px] font-semibold text-on-surface">
                      Explainable Reorder Formulas
                    </h4>
                    <p className="font-caption text-[11px] text-on-surface-variant">
                      Transparent safety-stock formulas and supplier lead-time modeling.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-6 text-[12px] text-on-surface-variant flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Production FastAPI & SQL Engine</span>
            </div>
          </div>

          {/* Right Login Form Panel */}
          <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <h2 className="font-section-title text-[22px] font-bold text-on-surface">
                  Sign in to StockIQ
                </h2>
                <p className="font-caption text-[13px] text-on-surface-variant mt-1">
                  Enter your store credentials to access your live inventory cockpit.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[13px] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-on-surface mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="admin@stockiq.example.com"
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[12px] font-medium text-on-surface">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-10 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-lg bg-primary text-white font-body-medium text-[13px] font-semibold hover:bg-primary/95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Enter Cockpit</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Demo Credentials Card */}
            <div className="mt-8 pt-4 border-t border-outline-variant/30">
              <span className="font-overline text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold block mb-2">
                Demo Accounts Quick-Fill:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('admin')}
                  className="p-2.5 text-left rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface text-[12px] transition-colors"
                >
                  <span className="font-semibold block text-[11px] text-primary">Store Owner (Admin)</span>
                  <span className="text-on-surface-variant text-[10px] truncate block">admin@stockiq.example.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('staff')}
                  className="p-2.5 text-left rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface text-[12px] transition-colors"
                >
                  <span className="font-semibold block text-[11px] text-secondary">Floor Staff (Staff)</span>
                  <span className="text-on-surface-variant text-[10px] truncate block">staff@stockiq.example.com</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto py-2 text-center text-caption text-on-surface-variant text-[12px]">
        StockIQ Precision Commerce · Connected to localhost:8000
      </footer>
    </div>
  );
};
