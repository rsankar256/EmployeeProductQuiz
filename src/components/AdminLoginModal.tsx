import { useState, useEffect, useRef } from 'react';
import { Lock, X, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Props {
  correctPassword: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AdminLoginModal({ correctPassword, onSuccess, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
      setShaking(true);
      setPassword('');
      setTimeout(() => setShaking(false), 500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative transition-transform ${shaking ? 'animate-shake' : ''}`}
        style={shaking ? { animation: 'shake 0.4s ease-in-out' } : {}}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-blue-700" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Admin Access</h2>
          <p className="text-slate-500 text-sm mt-1 text-center">Enter the admin password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter admin password"
                className={`w-full px-4 py-3 pr-11 rounded-xl border-2 text-slate-800 focus:outline-none transition-all ${
                  error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500 bg-slate-50 focus:bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Enter Admin Panel
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
