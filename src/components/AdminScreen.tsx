import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Question, Answer, Option, Product, EmployeeCode } from '../lib/supabase';
import {
  Plus, Trash2, CreditCard as Edit2, X, Check, ChevronDown, ChevronUp,
  ArrowLeft, Package, Users, Upload, FileText, AlertCircle, Loader2, Download, BarChart2,
  Search, Filter,
} from 'lucide-react';

interface Props {
  onBack: () => void;
}

type Tab = 'questions' | 'employees' | 'sessions';

interface EditableQuestion {
  id?: string;
  product_id: string;
  order_index: number;
  question_text: string;
  options: Option[];
  correct_option: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isNew?: boolean;
  isEditing?: boolean;
}

interface StaffRow {
  code: string;
  name: string;
  reporting_manager: string;
  state: string;
  category: string;
  role: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Mace': 'bg-blue-100 text-blue-700',
  'Pre-cast': 'bg-purple-100 text-purple-700',
  'NT/Concrete Tech': 'bg-orange-100 text-orange-700',
  'Trainee': 'bg-green-100 text-green-700',
};

export default function AdminScreen({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('questions');

  // --- Questions state ---
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);

  // --- Staff state ---
  const [employeeCodes, setEmployeeCodes] = useState<EmployeeCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [uploadingCodes, setUploadingCodes] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ added: number; updated: number } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Sessions state ---
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [clearSessionsConfirm, setClearSessionsConfirm] = useState(false);
  const [loadingSessionCount, setLoadingSessionCount] = useState(false);

  // --- Export state ---
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportState, setExportState] = useState('ALL');
  const [exportProduct, setExportProduct] = useState('ALL');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [availableStates, setAvailableStates] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('products').select('*').order('product_code').then(({ data }) => {
      if (data) {
        setProducts(data as Product[]);
        if (data.length > 0) setSelectedProductId(data[0].id);
      }
      setLoadingProducts(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    setLoadingQuestions(true);
    setExpanded(null);
    supabase.from('questions').select('*').eq('product_id', selectedProductId).order('order_index').then(({ data }) => {
      if (data) setQuestions(data as EditableQuestion[]);
      setLoadingQuestions(false);
    });
  }, [selectedProductId]);

  const loadCodes = async () => {
    setLoadingCodes(true);
    const { data } = await supabase.from('employee_codes').select('*').order('name');
    if (data) setEmployeeCodes(data as EmployeeCode[]);
    setLoadingCodes(false);
  };

  const loadSessionCount = async () => {
    setLoadingSessionCount(true);
    const { count } = await supabase
      .from('quiz_sessions')
      .select('*', { count: 'exact', head: true });
    setSessionCount(count ?? 0);
    setLoadingSessionCount(false);
  };

  const clearAllSessions = async () => {
    await supabase.from('quiz_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setSessionCount(0);
    setClearSessionsConfirm(false);
  };

  const loadAvailableStates = async () => {
    const { data } = await supabase
      .from('employee_codes')
      .select('state')
      .neq('state', '');
    if (data) {
      const unique = [...new Set(data.map(r => r.state as string))].filter(Boolean).sort();
      setAvailableStates(unique);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      let query = supabase
        .from('quiz_sessions')
        .select('*')
        .order('completed_at', { ascending: false });

      if (exportFrom) query = query.gte('completed_at', exportFrom + 'T00:00:00');
      if (exportTo)   query = query.lte('completed_at', exportTo + 'T23:59:59');
      if (exportProduct !== 'ALL') query = query.eq('product_id', exportProduct);

      const { data: sessions, error } = await query;
      if (error || !sessions) { setExportError('Failed to fetch sessions.'); setExporting(false); return; }

      let filtered = sessions;

      // State filter: look up employee codes in that state
      if (exportState !== 'ALL') {
        const { data: stateCodes } = await supabase
          .from('employee_codes')
          .select('code')
          .eq('state', exportState);
        const codeSet = new Set((stateCodes ?? []).map(c => c.code as string));
        filtered = sessions.filter(s => s.employee_code && codeSet.has(s.employee_code));
      }

      if (filtered.length === 0) {
        setExportError('No records match the selected filters.');
        setExporting(false);
        return;
      }

      // Fetch employee details
      const uniqueCodes = [...new Set(filtered.map(s => s.employee_code).filter(Boolean))];
      const { data: empData } = await supabase
        .from('employee_codes')
        .select('code, name, state, category, role, reporting_manager')
        .in('code', uniqueCodes);
      const empMap = new Map((empData ?? []).map(e => [e.code as string, e]));

      // Fetch questions for all product IDs
      const uniqueProductIds = [...new Set(filtered.map(s => s.product_id).filter(Boolean))];
      const { data: questData } = await supabase
        .from('questions')
        .select('id, question_text, correct_option, options')
        .in('product_id', uniqueProductIds);
      const questMap = new Map((questData ?? []).map(q => [q.id as string, q]));

      // Build CSV
      const headers = [
        'Date', 'Time', 'Employee Code', 'Employee Name', 'State', 'Category', 'Role', 'Reporting Manager',
        'Product', 'Score', 'Total Questions', '% Score',
        'Q1 Question', 'Q1 Selected', 'Q1 Correct Answer', 'Q1 Result',
        'Q2 Question', 'Q2 Selected', 'Q2 Correct Answer', 'Q2 Result',
        'Q3 Question', 'Q3 Selected', 'Q3 Correct Answer', 'Q3 Result',
        'Q4 Question', 'Q4 Selected', 'Q4 Correct Answer', 'Q4 Result',
        'Q5 Question', 'Q5 Selected', 'Q5 Correct Answer', 'Q5 Result',
      ];

      const rows = filtered.map(s => {
        const emp = empMap.get(s.employee_code) as Record<string, string> | undefined;
        const product = products.find(p => p.id === s.product_id);
        const dt = new Date(s.completed_at);
        const answers = (s.answers ?? []) as Answer[];
        const total = answers.length || 5;
        const correct = s.correct_count ?? s.score ?? 0;

        const row: (string | number)[] = [
          dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          s.employee_code ?? '',
          emp?.name ?? s.employee_name ?? '',
          emp?.state ?? '',
          emp?.category ?? '',
          emp?.role ?? '',
          emp?.reporting_manager ?? '',
          product?.name ?? '',
          correct,
          total,
          Math.round((correct / total) * 100) + '%',
        ];

        for (let i = 0; i < 5; i++) {
          const ans = answers[i] as Answer | undefined;
          if (ans) {
            const q = questMap.get(ans.question_id) as { question_text: string; correct_option: string; options: { label: string; text: string }[] } | undefined;
            const correctLabel = q?.correct_option ?? '';
            const correctText = q?.options?.find(o => o.label === correctLabel)?.text ?? correctLabel;
            const selectedText = ans.selected_option
              ? (q?.options?.find(o => o.label === ans.selected_option)?.text ?? ans.selected_option)
              : 'No Answer';
            row.push(
              q?.question_text ?? '',
              selectedText,
              correctText,
              !ans.selected_option ? 'Timed Out' : ans.is_correct ? 'Correct' : 'Incorrect',
            );
          } else {
            row.push('', '', '', '');
          }
        }
        return row;
      });

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz_responses_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('An unexpected error occurred during export.');
    }
    setExporting(false);
  };

  useEffect(() => {
    if (activeTab === 'employees') loadCodes();
    if (activeTab === 'sessions') { loadSessionCount(); loadAvailableStates(); }
  }, [activeTab]);

  // ---- Question handlers ----
  const saveQuestion = async (q: EditableQuestion, index: number) => {
    setSaving(index);
    if (q.id) {
      await supabase.from('questions').update({
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
        difficulty: q.difficulty,
      }).eq('id', q.id);
    } else {
      const { data } = await supabase.from('questions').insert({
        product_id: selectedProductId,
        order_index: q.order_index,
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
        difficulty: q.difficulty,
      }).select().maybeSingle();
      if (data) {
        setQuestions(prev => prev.map((item, i) => i === index ? { ...item, id: (data as Question).id, isNew: false } : item));
      }
    }
    setSaving(null);
    setQuestions(prev => prev.map((item, i) => i === index ? { ...item, isEditing: false, isNew: false } : item));
  };

  const deleteQuestion = async (q: EditableQuestion, index: number) => {
    if (!q.id) { setQuestions(prev => prev.filter((_, i) => i !== index)); return; }
    if (!confirm('Delete this question?')) return;
    await supabase.from('questions').delete().eq('id', q.id);
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: keyof EditableQuestion, value: unknown) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIndex: number, optIndex: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q;
      return { ...q, options: q.options.map((o, oi) => oi === optIndex ? { ...o, text } : o) };
    }));
  };

  const addProduct = async () => {
    if (!newProductCode.trim() || !newProductName.trim()) return;
    const { data } = await supabase.from('products').insert({
      product_code: newProductCode.trim().toUpperCase(),
      name: newProductName.trim(),
      description: newProductDesc.trim(),
    }).select().maybeSingle();
    if (data) {
      setProducts(prev => [...prev, data as Product]);
      setSelectedProductId((data as Product).id);
    }
    setNewProductCode(''); setNewProductName(''); setNewProductDesc(''); setShowAddProduct(false);
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`Delete "${product.name}" and ALL its questions?`)) return;
    await supabase.from('products').delete().eq('id', product.id);
    const remaining = products.filter(p => p.id !== product.id);
    setProducts(remaining);
    setSelectedProductId(remaining.length > 0 ? remaining[0].id : '');
  };

  // ---- Staff handlers ----
  const parseStaffCsv = (text: string): StaffRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const results: StaffRow[] = [];
    for (const line of lines) {
      if (/^employee\s*code/i.test(line.trim())) continue;
      const parts = line.split(',');
      if (parts.length < 6) continue;
      const code = parts[0].trim().toUpperCase();
      if (!code || code.length < 3) continue;
      results.push({
        code,
        name: parts[1].trim(),
        reporting_manager: parts[2].trim(),
        state: parts[3].trim(),
        category: parts[4].trim(),
        role: parts[5].trim(),
      });
    }
    return results;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadResult(null);
    setUploadingCodes(true);

    try {
      const text = await file.text();
      const rows = parseStaffCsv(text);

      if (rows.length === 0) {
        setUploadError('No valid staff rows found. Check the CSV format matches the sample.');
        setUploadingCodes(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (replaceMode) {
        await supabase.from('employee_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      let added = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data } = await supabase
          .from('employee_codes')
          .upsert(batch, { onConflict: 'code', ignoreDuplicates: false })
          .select('code');
        if (data) added += data.length;
      }

      setUploadResult({ added: replaceMode ? rows.length : added, updated: replaceMode ? 0 : 0 });
      loadCodes();
    } catch {
      setUploadError('Failed to read the file. Please try again.');
    }

    setUploadingCodes(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteCode = async (id: string) => {
    await supabase.from('employee_codes').delete().eq('id', id);
    setEmployeeCodes(prev => prev.filter(c => c.id !== id));
    setDeleteConfirm(null);
  };

  const clearAllCodes = async () => {
    await supabase.from('employee_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setEmployeeCodes([]);
    setClearConfirm(false);
  };

  const downloadSampleCsv = () => {
    const rows = [
      'Employee Code,Employee Name,Reporting Manager,State,Pre-cast/Mace/Non-Trade,Manager or Engineer',
      'M10001,JOHN DOE,MANAGER NAME,KERALA,Mace,Engineer',
      'M10002,JANE SMITH,MANAGER NAME,TAMIL NADU,Mace,Manager',
      'M10003,ALEX KUMAR,MANAGER NAME,KARNATAKA,Pre-cast,Engineer',
      'M10004,PRIYA NAIR,MANAGER NAME,ANDHRA PRADESH,NT/Concrete Tech,Engineer',
      'M10005,RAVI SHANKAR,MANAGER NAME,TELANGANA,Trainee,Engineer',
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStaff = employeeCodes.filter(ec => {
    if (!staffFilter.trim()) return true;
    const q = staffFilter.toLowerCase();
    return (
      ec.code.toLowerCase().includes(q) ||
      ec.name.toLowerCase().includes(q) ||
      ec.state.toLowerCase().includes(q) ||
      ec.reporting_manager.toLowerCase().includes(q) ||
      ec.category.toLowerCase().includes(q)
    );
  });

  if (loadingProducts) return (
    <div className="min-h-screen flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 60%, #00123d 100%)' }}>
      Loading...
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 60%, #00123d 100%)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <button onClick={onBack} className="text-blue-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src="/HW_Logo.jpg" alt="HW" className="h-9 w-9 rounded-lg object-cover" />
        <p className="text-white font-bold text-sm">Admin Panel</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4 max-w-5xl mx-auto w-full">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'questions'
              ? 'bg-white text-blue-800 shadow-lg'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Package className="w-4 h-4" />
          Questions
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'employees'
              ? 'bg-white text-blue-800 shadow-lg'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff
          {employeeCodes.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'employees' ? 'bg-blue-100 text-blue-700' : 'bg-white/20 text-white'
            }`}>{employeeCodes.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'sessions'
              ? 'bg-white text-blue-800 shadow-lg'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Leaderboard
          {sessionCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'sessions' ? 'bg-blue-100 text-blue-700' : 'bg-white/20 text-white'
            }`}>{sessionCount}</span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* ===== QUESTIONS TAB ===== */}
          {activeTab === 'questions' && (
            <>
              {/* Products section */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-600" />
                    <h2 className="font-bold text-slate-800">Products</h2>
                  </div>
                  <button
                    onClick={() => setShowAddProduct(!showAddProduct)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Product
                  </button>
                </div>

                {showAddProduct && (
                  <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={newProductCode} onChange={e => setNewProductCode(e.target.value)}
                        placeholder="Code (e.g. HW101)"
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newProductName} onChange={e => setNewProductName(e.target.value)}
                        placeholder="Product Name"
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <input value={newProductDesc} onChange={e => setNewProductDesc(e.target.value)}
                      placeholder="Short description"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <div className="flex gap-2">
                      <button onClick={addProduct} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700">
                        <Check className="w-3.5 h-3.5" /> Save Product
                      </button>
                      <button onClick={() => setShowAddProduct(false)} className="bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-300">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {products.map(p => (
                    <div key={p.id} onClick={() => setSelectedProductId(p.id)}
                      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${
                        selectedProductId === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        selectedProductId === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>{p.product_code}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-700 text-sm">{p.name}</p>
                        <p className="text-slate-400 text-xs truncate">{p.description}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteProduct(p); }}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-400 rounded-lg transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Questions section */}
              {selectedProductId && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-white font-bold">
                      Questions — {products.find(p => p.id === selectedProductId)?.name}
                      <span className="text-blue-300 font-normal ml-2 text-sm">({questions.length} total)</span>
                    </h2>
                    <button
                      onClick={() => {
                        setQuestions(prev => [...prev, {
                          product_id: selectedProductId,
                          order_index: prev.length + 1,
                          question_text: '',
                          options: [
                            { label: 'A', text: '' }, { label: 'B', text: '' },
                            { label: 'C', text: '' }, { label: 'D', text: '' },
                          ],
                          correct_option: 'A',
                          difficulty: 'medium',
                          isNew: true, isEditing: true,
                        }]);
                        setExpanded(questions.length);
                      }}
                      className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-blue-900 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  </div>

                  {loadingQuestions ? (
                    <div className="text-center text-blue-300 py-10">Loading questions...</div>
                  ) : (
                    <div className="space-y-2">
                      {questions.map((q, i) => (
                        <div key={q.id ?? i} className="bg-white rounded-xl overflow-hidden shadow-lg shadow-black/20">
                          <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === i ? null : i)}>
                            <span className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                              {q.order_index}
                            </span>
                            <p className="text-slate-700 text-sm font-medium flex-1 truncate">
                              {q.question_text || <span className="text-slate-400 italic">New question</span>}
                            </p>
                            {!q.isNew && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${
                                q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{q.difficulty ?? 'medium'}</span>
                            )}
                            <div className="flex items-center gap-1">
                              {q.isEditing || q.isNew ? (
                                <>
                                  <button onClick={e => { e.stopPropagation(); saveQuestion(q, i); }} disabled={saving === i}
                                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); if (q.isNew) deleteQuestion(q, i); else updateField(i, 'isEditing', false); }}
                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors">
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={e => { e.stopPropagation(); updateField(i, 'isEditing', true); setExpanded(i); }}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); deleteQuestion(q, i); }}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {expanded === i ? <ChevronUp className="w-4 h-4 text-slate-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />}
                            </div>
                          </div>

                          {expanded === i && (
                            <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Question</label>
                                <textarea value={q.question_text} onChange={e => updateField(i, 'question_text', e.target.value)}
                                  disabled={!q.isEditing && !q.isNew} rows={2}
                                  className="w-full px-3 py-2.5 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none disabled:bg-slate-50 disabled:text-slate-500" />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Options</label>
                                <div className="space-y-2">
                                  {q.options.map((opt, oi) => (
                                    <div key={opt.label} className="flex items-center gap-2">
                                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                                        q.correct_option === opt.label ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                      }`}>{opt.label}</span>
                                      <input value={opt.text} onChange={e => updateOption(i, oi, e.target.value)}
                                        disabled={!q.isEditing && !q.isNew}
                                        className="flex-1 px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50 disabled:text-slate-500" />
                                      {(q.isEditing || q.isNew) && (
                                        <button onClick={() => updateField(i, 'correct_option', opt.label)}
                                          className={`px-2.5 py-2 text-xs font-bold rounded-lg transition-colors ${
                                            q.correct_option === opt.label ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-blue-50'
                                          }`}>
                                          {q.correct_option === opt.label ? 'Correct' : 'Set'}
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {/* Difficulty */}
                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Difficulty</label>
                                {(q.isEditing || q.isNew) ? (
                                  <div className="flex gap-2">
                                    {(['easy', 'medium', 'hard'] as const).map(d => (
                                      <button
                                        key={d}
                                        onClick={() => updateField(i, 'difficulty', d)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-colors ${
                                          q.difficulty === d
                                            ? d === 'easy' ? 'bg-green-500 text-white' : d === 'medium' ? 'bg-yellow-400 text-slate-800' : 'bg-red-500 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${
                                    q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                    q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>{q.difficulty}</span>
                                )}
                              </div>
                              {!(q.isEditing || q.isNew) && (
                                <p className="text-xs text-slate-400">
                                  Correct answer: <span className="font-bold text-blue-600">{q.correct_option}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {questions.length === 0 && (
                        <div className="text-center text-blue-300 py-8 bg-white/5 rounded-xl border border-white/10">
                          No questions yet. Click "Add Question" to get started.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===== STAFF TAB ===== */}
          {activeTab === 'employees' && (
            <div className="space-y-4">

              {/* Upload card */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-600" />
                    Upload Staff CSV
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Upload a CSV file in the required format to add or replace staff records.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Sample format */}
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-blue-800 font-semibold text-sm">Required CSV Format</p>
                      <div className="mt-2 bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-600 overflow-x-auto">
                        <p className="text-blue-600 font-semibold">Employee Code,Employee Name,Reporting Manager,State,Pre-cast/Mace/Non-Trade,Manager or Engineer</p>
                        <p>M10001,JOHN DOE,MANAGER NAME,KERALA,Mace,Engineer</p>
                        <p>M10002,JANE SMITH,MANAGER NAME,TAMIL NADU,Mace,Manager</p>
                        <p className="text-slate-400">...</p>
                      </div>
                      <button
                        onClick={downloadSampleCsv}
                        className="mt-2 flex items-center gap-1.5 text-blue-700 hover:text-blue-900 text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download sample CSV template
                      </button>
                    </div>
                  </div>

                  {/* Replace mode toggle */}
                  <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={replaceMode}
                      onChange={e => setReplaceMode(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <div>
                      <p className="text-amber-900 font-semibold text-sm">Replace all existing staff</p>
                      <p className="text-amber-700 text-xs mt-0.5">When checked, all current staff records are deleted before importing. When unchecked, records are added or updated by employee code.</p>
                    </div>
                  </label>

                  {/* Upload button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingCodes}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-4 rounded-xl transition-all disabled:opacity-60"
                    >
                      {uploadingCodes ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Choose CSV File
                        </>
                      )}
                    </button>
                  </div>

                  {uploadResult && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-green-800 text-sm font-medium">
                        {uploadResult.added} staff record{uploadResult.added !== 1 ? 's' : ''} imported successfully.
                      </p>
                    </div>
                  )}

                  {uploadError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm">{uploadError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff directory */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    Staff Directory
                    <span className="text-slate-400 font-normal text-sm">({employeeCodes.length})</span>
                  </h2>
                  {employeeCodes.length > 0 && (
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="flex items-center gap-1.5 text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All
                    </button>
                  )}
                </div>

                {/* Search */}
                {employeeCodes.length > 0 && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={staffFilter}
                        onChange={e => setStaffFilter(e.target.value)}
                        placeholder="Search by code, name, state, manager..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    {staffFilter && (
                      <p className="text-xs text-slate-400 mt-1.5">{filteredStaff.length} of {employeeCodes.length} results</p>
                    )}
                  </div>
                )}

                {loadingCodes ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
                  </div>
                ) : employeeCodes.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p>No staff records yet.</p>
                    <p className="text-xs mt-1">Upload a CSV above to add staff and restrict quiz access.</p>
                    <p className="text-xs mt-2 text-slate-300">While empty, any valid-format code is accepted.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Code</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Manager</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">State</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Category</th>
                          <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Role</th>
                          <th className="px-4 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 max-h-[500px]">
                        {filteredStaff.slice(0, 300).map(ec => (
                          <tr key={ec.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className="font-mono font-bold text-slate-700 text-xs bg-slate-100 px-2 py-0.5 rounded">{ec.code}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-700 text-xs">{ec.name || <span className="text-slate-400 italic">—</span>}</p>
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell">
                              <p className="text-slate-500 text-xs truncate max-w-[140px]">{ec.reporting_manager || '—'}</p>
                            </td>
                            <td className="px-4 py-2.5 hidden sm:table-cell">
                              <p className="text-slate-500 text-xs">{ec.state || '—'}</p>
                            </td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              {ec.category ? (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[ec.category] ?? 'bg-slate-100 text-slate-600'}`}>
                                  {ec.category}
                                </span>
                              ) : <span className="text-slate-400 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              <span className={`text-xs font-medium ${ec.role === 'Manager' ? 'text-blue-600' : 'text-slate-500'}`}>
                                {ec.role || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {deleteConfirm === ec.id ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => deleteCode(ec.id)} className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded hover:bg-red-600">Yes</button>
                                  <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded hover:bg-slate-300">No</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(ec.id)}
                                  className="p-1 bg-red-50 hover:bg-red-100 text-red-400 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredStaff.length > 300 && (
                      <p className="text-center text-slate-400 text-xs py-3">Showing first 300 of {filteredStaff.length} results. Use search to narrow down.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Clear all confirmation */}
              {clearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Clear all staff?</h3>
                    <p className="text-slate-500 text-sm mb-5">
                      This will remove all {employeeCodes.length} staff records. Any valid-format code will then be accepted for quiz entry.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={clearAllCodes} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                        Clear All
                      </button>
                      <button onClick={() => setClearConfirm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== LEADERBOARD/SESSIONS TAB ===== */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">

              {/* Export card */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-600" />
                    Export Quiz Responses
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Apply filters and download all matching responses as a CSV file (opens in Excel).
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Date range */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date Range</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">From</label>
                        <input
                          type="date"
                          value={exportFrom}
                          onChange={e => setExportFrom(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">To</label>
                        <input
                          type="date"
                          value={exportTo}
                          onChange={e => setExportTo(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* State & Product filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">State</label>
                      <select
                        value={exportState}
                        onChange={e => setExportState(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-700 bg-white"
                      >
                        <option value="ALL">All States</option>
                        {availableStates.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Product</label>
                      <select
                        value={exportProduct}
                        onChange={e => setExportProduct(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-slate-700 bg-white"
                      >
                        <option value="ALL">All Products</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Applied filters summary */}
                  {(exportFrom || exportTo || exportState !== 'ALL' || exportProduct !== 'ALL') && (
                    <div className="flex flex-wrap gap-2">
                      {exportFrom && <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-200">From: {exportFrom}</span>}
                      {exportTo && <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-200">To: {exportTo}</span>}
                      {exportState !== 'ALL' && <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-200">State: {exportState}</span>}
                      {exportProduct !== 'ALL' && <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-200">Product: {products.find(p => p.id === exportProduct)?.name}</span>}
                      <button
                        onClick={() => { setExportFrom(''); setExportTo(''); setExportState('ALL'); setExportProduct('ALL'); setExportError(''); }}
                        className="text-slate-400 hover:text-slate-600 text-xs underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}

                  {exportError && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-amber-800 text-sm">{exportError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Preparing download...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        Download CSV
                      </>
                    )}
                  </button>

                  <p className="text-xs text-slate-400 text-center">
                    Includes employee details, product, score, and per-question breakdown (Q1–Q5).
                  </p>
                </div>
              </div>

              {/* Session count + clear */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-slate-600" />
                    Leaderboard Data
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Manage quiz session data and leaderboard entries.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {loadingSessionCount ? (
                    <div className="flex items-center justify-center py-6 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div>
                          <p className="font-semibold text-slate-800">Total Quiz Sessions</p>
                          <p className="text-slate-500 text-sm mt-1">
                            {sessionCount} session{sessionCount !== 1 ? 's' : ''} in the leaderboard
                          </p>
                        </div>
                        <span className="text-3xl font-bold text-slate-400">{sessionCount}</span>
                      </div>

                      {sessionCount > 0 && (
                        <button
                          onClick={() => setClearSessionsConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 font-bold py-3 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear All Sessions
                        </button>
                      )}

                      {sessionCount === 0 && (
                        <div className="text-center py-6 text-slate-400">
                          <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No sessions yet.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {clearSessionsConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Clear all sessions?</h3>
                    <p className="text-slate-500 text-sm mb-5">
                      This will permanently delete all {sessionCount} quiz session{sessionCount !== 1 ? 's' : ''} and leaderboard entries. This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={clearAllSessions} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                        Clear All
                      </button>
                      <button onClick={() => setClearSessionsConfirm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
