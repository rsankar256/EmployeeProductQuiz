import { useEffect, useState, useCallback } from 'react';
import { Trophy, Medal, RefreshCw, ArrowLeft, Clock, Filter, Settings, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { QuizSession, Product } from '../lib/supabase';

const REFRESH_INTERVAL_SEC = 30;

interface Props {
  highlightCode?: string;
  products: Product[];
  onBack?: () => void;
  onAdmin?: () => void;
}

interface EmployeeInfo {
  name: string;
  state: string;
}

export default function LeaderboardScreen({ highlightCode, products, onBack, onAdmin }: Props) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [employeeMap, setEmployeeMap] = useState<Record<string, EmployeeInfo>>({});
  const [states, setStates] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('employee_codes').select('code, name, state').then(({ data }) => {
      if (!data) return;
      const map: Record<string, EmployeeInfo> = {};
      const stateSet = new Set<string>();
      data.forEach((e: { code: string; name: string; state: string }) => {
        map[e.code] = { name: e.name ?? '', state: e.state ?? '' };
        if (e.state) stateSet.add(e.state);
      });
      setEmployeeMap(map);
      setStates(Array.from(stateSet).sort());
    });
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);

    let employeeCodeFilter: string[] | null = null;
    if (filterState !== 'all') {
      const { data: empData } = await supabase
        .from('employee_codes')
        .select('code')
        .eq('state', filterState);
      employeeCodeFilter = empData?.map((e: { code: string }) => e.code) ?? [];
    }

    if (employeeCodeFilter !== null && employeeCodeFilter.length === 0) {
      setSessions([]);
      setLastUpdated(new Date());
      setLoading(false);
      setCountdown(REFRESH_INTERVAL_SEC);
      return;
    }

    let query = supabase
      .from('quiz_sessions')
      .select('id, employee_code, product_id, score, correct_count, completed_at')
      .order('correct_count', { ascending: false })
      .order('completed_at', { ascending: true })
      .limit(100);

    if (filterProduct !== 'all') query = query.eq('product_id', filterProduct);
    if (employeeCodeFilter !== null) query = query.in('employee_code', employeeCodeFilter);

    const { data } = await query;
    if (data) {
      setSessions(data as QuizSession[]);
      setLastUpdated(new Date());
    }
    setLoading(false);
    setCountdown(REFRESH_INTERVAL_SEC);
  }, [filterProduct, filterState]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchLeaderboard(); return REFRESH_INTERVAL_SEC; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const getProductName = (productId: string) =>
    products.find(p => p.id === productId)?.product_code ?? '—';

  const getEmployeeName = (code: string) =>
    employeeMap[code]?.name || '—';

  const medalColor = (rank: number) =>
    rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-600' : 'text-slate-400';

  const topThree = sessions.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 60%, #00123d 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-blue-300 hover:text-white transition-colors mr-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <img src="/HW_Logo.jpg" alt="HW" className="h-9 w-9 rounded-lg object-cover" />
          <div>
            <p className="text-white font-bold text-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Leaderboard
            </p>
            {lastUpdated && (
              <p className="text-blue-300 text-xs">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all border border-white/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="tabular-nums">{countdown}s</span>
          </button>
          {onAdmin && (
            <button
              onClick={onAdmin}
              className="p-2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
              title="Admin panel"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <img src="/Ramco_Cements_Logo1.png" alt="Ramco Cements" className="h-9 object-contain brightness-0 invert opacity-80" />
        </div>
      </div>

      {/* Refresh progress */}
      <div className="w-full bg-white/10 h-0.5">
        <div
          className="bg-yellow-400 h-0.5 transition-all duration-1000 ease-linear"
          style={{ width: `${(countdown / REFRESH_INTERVAL_SEC) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">

          {/* Filters */}
          <div className="space-y-2.5 mb-5">
            {/* Product filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-blue-300 flex-shrink-0" />
              <button
                onClick={() => setFilterProduct('all')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  filterProduct === 'all' ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                }`}
              >
                All Products
              </button>
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFilterProduct(p.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    filterProduct === p.id ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                  }`}
                >
                  {p.product_code}
                </button>
              ))}
            </div>

            {/* State filter */}
            {states.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="w-4 h-4 text-blue-300 flex-shrink-0" />
                <button
                  onClick={() => setFilterState('all')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    filterState === 'all' ? 'bg-blue-400 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                  }`}
                >
                  All States
                </button>
                {states.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterState(s)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      filterState === s ? 'bg-blue-400 text-white' : 'bg-white/10 text-blue-200 hover:bg-white/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && sessions.length === 0 ? (
            <div className="text-center text-blue-300 py-20">Loading rankings...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-blue-300 py-20">No submissions yet. Be the first!</div>
          ) : (
            <>
              {/* Podium */}
              {topThree.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[topThree[1], topThree[0], topThree[2]].map((session, idx) => {
                    if (!session) return <div key={idx} />;
                    const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                    const heights = ['h-20', 'h-28', 'h-16'];
                    const empName = getEmployeeName(session.employee_code);
                    return (
                      <div key={session.id} className={`flex flex-col items-center ${idx === 1 ? 'order-2' : idx === 0 ? 'order-1' : 'order-3'}`}>
                        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center mb-1.5 ${
                          rank === 1 ? 'border-yellow-400 bg-yellow-400/20' : rank === 2 ? 'border-slate-400 bg-slate-400/20' : 'border-amber-600 bg-amber-600/20'
                        }`}>
                          <span className="text-white font-bold text-sm">
                            {(session.employee_code ?? '?').charAt(0)}
                          </span>
                        </div>
                        <p className="text-white text-xs font-bold text-center truncate max-w-full px-1">
                          {empName !== '—' ? empName : session.employee_code}
                        </p>
                        <p className="text-blue-300 text-xs text-center truncate max-w-full px-1">{session.employee_code}</p>
                        <p className="text-yellow-400 text-xs font-bold">{session.correct_count}/5</p>
                        <div className={`w-full ${heights[idx]} rounded-t-lg mt-1.5 flex items-center justify-center ${
                          rank === 1 ? 'bg-yellow-400/20' : rank === 2 ? 'bg-white/10' : 'bg-amber-600/20'
                        }`}>
                          <Medal className={`w-5 h-5 ${medalColor(rank)}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Table */}
              <div className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
                <div className="grid grid-cols-12 px-5 py-3 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-1">#</span>
                  <span className="col-span-2">Code</span>
                  <span className="col-span-3">Name</span>
                  <span className="col-span-2">Product</span>
                  <span className="col-span-2 text-center">Score</span>
                  <span className="col-span-2 text-right">Date</span>
                </div>

                {sessions.map((session, i) => {
                  const rank = i + 1;
                  const isMe = session.employee_code === highlightCode;
                  const empName = getEmployeeName(session.employee_code);
                  return (
                    <div
                      key={session.id}
                      className={`grid grid-cols-12 items-center px-5 py-3.5 border-b last:border-0 ${
                        isMe ? 'bg-yellow-50 border-yellow-100' : rank === 1 ? 'bg-amber-50' : 'bg-white border-slate-50'
                      }`}
                    >
                      <span className="col-span-1 font-bold text-sm flex items-center">
                        {rank <= 3
                          ? <Medal className={`w-4 h-4 ${medalColor(rank)}`} />
                          : <span className="text-slate-400 text-xs font-bold">{rank}</span>
                        }
                      </span>
                      <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#003087' }}>
                          <span className="text-white font-bold text-xs">{(session.employee_code ?? '?').charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">{session.employee_code}</p>
                          {isMe && <span className="text-xs bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded font-semibold">You</span>}
                        </div>
                      </div>
                      <div className="col-span-3 min-w-0 pr-1">
                        <p className="text-xs font-medium text-slate-700 truncate">{empName}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {getProductName(session.product_id)}
                        </span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`inline-block font-bold text-xs px-2 py-1 rounded-full ${
                          session.correct_count >= 4 ? 'bg-green-100 text-green-700'
                            : session.correct_count >= 3 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {session.correct_count}/5
                        </span>
                      </div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-1 text-slate-400 text-xs">
                        <Clock className="w-3 h-3" />
                        {new Date(session.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-blue-400 text-xs mt-4">
                Auto-refreshes every {REFRESH_INTERVAL_SEC} seconds
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
