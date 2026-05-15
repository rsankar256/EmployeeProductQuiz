import { useState } from 'react';
import { BookOpen, Trophy, Clock, ChevronRight, AlertCircle, Loader2, BarChart2, Settings } from 'lucide-react';
import { supabase, EMPLOYEE_CODE_REGEX } from '../lib/supabase';
import type { Product } from '../lib/supabase';

interface Props {
  products: Product[];
  onStart: (employeeCode: string, productId: string) => void;
  onLeaderboard: () => void;
  onAdmin: () => void;
}

export default function LandingScreen({ products, onStart, onLeaderboard, onAdmin }: Props) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [errors, setErrors] = useState<{ code?: string; product?: string }>({});
  const [validating, setValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { code?: string; product?: string } = {};

    const trimmed = employeeCode.trim().toUpperCase();
    if (!trimmed) {
      errs.code = 'Please enter your employee code';
    } else if (!EMPLOYEE_CODE_REGEX.test(trimmed)) {
      errs.code = 'Invalid format — letters and numbers only, 3–10 characters';
    }
    if (!selectedProduct) errs.product = 'Please select a product';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setValidating(true);

    // Check if employee codes list has been set up
    const { count } = await supabase
      .from('employee_codes')
      .select('*', { count: 'exact', head: true });

    if (count !== null && count > 0) {
      // Validate against the list
      const { data } = await supabase
        .from('employee_codes')
        .select('id')
        .eq('code', trimmed)
        .maybeSingle();

      if (!data) {
        setErrors({ code: 'Employee code not found. Please contact your administrator.' });
        setValidating(false);
        return;
      }
    }
    // If no codes have been uploaded yet, allow any valid-format code through

    setValidating(false);
    onStart(trimmed, selectedProduct);
  };

  return (
    <div className="min-h-screen bg-hw-blue flex flex-col" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 60%, #00123d 100%)' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/HW_Logo.jpg" alt="HW" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">HardWorker</p>
            <p className="text-yellow-300 text-xs">Product Knowledge Quiz</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onLeaderboard}
            className="flex items-center gap-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Leaderboard
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onAdmin}
            className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
            title="Admin panel"
          >
            <Settings className="w-4 h-4" />
          </button>
          <img src="/Ramco_Cements_Logo1.png" alt="Ramco Cements" className="h-10 object-contain brightness-0 invert opacity-80" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">

          {/* Left: Info */}
          <div className="text-white space-y-7">
            <div>
              <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/30 rounded-full px-4 py-1.5 mb-5">
                <BookOpen className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-yellow-300 font-semibold text-xs uppercase tracking-widest">Ramco Cements</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                Product<br />
                <span className="text-yellow-400">Quiz Challenge</span>
              </h1>
              <p className="text-blue-200 text-base leading-relaxed">
                Test your knowledge of HardWorker products. Select a product, answer 5 questions, and compete on the leaderboard.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: BookOpen, label: 'Select a Product', desc: 'Choose from our product range' },
                { icon: Clock, label: '30 Seconds per Question', desc: 'Thoughtful-pace format' },
                { icon: Trophy, label: 'Live Leaderboard', desc: 'Refreshes every 30 seconds' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="w-9 h-9 bg-yellow-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{label}</p>
                    <p className="text-blue-300 text-xs">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Ready to begin?</h2>
            <p className="text-slate-500 text-sm mb-7">Enter your employee code and select a product</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Employee Code */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Employee Code</label>
                <input
                  type="text"
                  value={employeeCode}
                  onChange={e => setEmployeeCode(e.target.value.toUpperCase())}
                  placeholder="e.g. M12345"
                  maxLength={10}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-slate-800 font-mono font-bold text-lg placeholder-slate-300 focus:outline-none transition-all ${
                    errors.code
                      ? 'border-red-400 bg-red-50'
                      : 'border-slate-200 focus:border-blue-500 bg-slate-50 focus:bg-white'
                  }`}
                />
                {errors.code && (
                  <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
                    <AlertCircle className="w-3 h-3" />{errors.code}
                  </p>
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Select Product</label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProduct(p.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        selectedProduct === p.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-bold text-sm ${selectedProduct === p.id ? 'text-blue-700' : 'text-slate-700'}`}>
                            {p.name}
                          </p>
                          <p className="text-slate-400 text-xs mt-0.5">{p.description}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          selectedProduct === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {p.product_code}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.product && (
                  <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
                    <AlertCircle className="w-3 h-3" />{errors.product}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={validating}
                className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-60 text-blue-900 font-bold py-4 rounded-xl transition-all duration-150 shadow-lg shadow-yellow-300/30 mt-2"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Start Quiz
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
