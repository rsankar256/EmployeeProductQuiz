import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Question, Option, Product, EmployeeCode } from '../lib/supabase';
import {
  Plus, Trash2, CreditCard as Edit2, X, Check, ChevronDown, ChevronUp,
  ArrowLeft, Package, Users, Upload, FileText, AlertCircle, Loader2, Download, BarChart2,
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
  isNew?: boolean;
  isEditing?: boolean;
}

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

  // --- Employee codes state ---
  const [employeeCodes, setEmployeeCodes] = useState<EmployeeCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [uploadingCodes, setUploadingCodes] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ added: number; skipped: number } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Sessions state ---
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [clearSessionsConfirm, setClearSessionsConfirm] = useState(false);
  const [loadingSessionCount, setLoadingSessionCount] = useState(false);

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
    const { data } = await supabase.from('employee_codes').select('*').order('code');
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

  useEffect(() => {
    if (activeTab === 'employees') loadCodes();
    if (activeTab === 'sessions') loadSessionCount();
  }, [activeTab]);

  // ---- Question handlers ----
  const saveQuestion = async (q: EditableQuestion, index: number) => {
    setSaving(index);
    if (q.id) {
      await supabase.from('questions').update({
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
      }).eq('id', q.id);
    } else {
      const { data } = await supabase.from('questions').insert({
        product_id: selectedProductId,
        order_index: q.order_index,
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
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

  // ---- Employee code handlers ----
  const parsePdfText = (text: string): string[] => {
    // Split by newlines and whitespace, filter to valid-looking codes
    return text
      .split(/[\r\n\s,;]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length >= 3 && s.length <= 10 && /^[A-Z0-9]+$/.test(s));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploadResult(null);
    setUploadingCodes(true);

    try {
      let text = '';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Read PDF as ArrayBuffer and extract text via a simple approach
        // We'll use the FileReader to get text content
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const buffer = ev.target?.result as ArrayBuffer;
              // Extract readable ASCII text from PDF bytes
              const bytes = new Uint8Array(buffer);
              let raw = '';
              for (let i = 0; i < bytes.length; i++) {
                const c = bytes[i];
                if (c >= 32 && c < 127) raw += String.fromCharCode(c);
                else raw += ' ';
              }
              resolve(raw);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
        text = await file.text();
      } else {
        text = await file.text();
      }

      const codes = parsePdfText(text);

      if (codes.length === 0) {
        setUploadError('No valid employee codes found in the file. Make sure codes are one per line.');
        setUploadingCodes(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Upsert all codes (skip duplicates)
      const rows = codes.map(code => ({ code }));
      let added = 0;
      let skipped = 0;

      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data, error } = await supabase
          .from('employee_codes')
          .upsert(batch, { onConflict: 'code', ignoreDuplicates: true })
          .select('code');
        if (!error && data) {
          added += data.length;
          skipped += batch.length - data.length;
        }
      }

      setUploadResult({ added, skipped });
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

  const downloadSamplePdf = () => {
    const content = [
      'Employee Codes — Sample Format',
      '',
      'Instructions:',
      'List one employee code per line.',
      'Codes can be alphanumeric (3–10 characters).',
      '',
      'M10001',
      'M10002',
      'M10003',
      'M10004',
      'M10005',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_codes_sample.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="flex gap-1 px-4 pt-4 max-w-3xl mx-auto w-full">
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
          Employee Codes
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
        <div className="max-w-3xl mx-auto space-y-5">

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

          {/* ===== EMPLOYEE CODES TAB ===== */}
          {activeTab === 'employees' && (
            <div className="space-y-4">

              {/* Upload card */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-600" />
                    Upload Employee Codes
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Upload a PDF or text file with one employee code per line. New codes are added; existing ones are kept.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Sample format info */}
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-blue-800 font-semibold text-sm">Sample Format</p>
                      <p className="text-blue-600 text-xs mt-1 leading-relaxed">
                        Each employee code on its own line. Codes must be 3–10 alphanumeric characters.
                      </p>
                      <div className="mt-2 bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-600 space-y-0.5">
                        <p>M10001</p>
                        <p>M10002</p>
                        <p>M10003</p>
                        <p className="text-slate-400">...</p>
                      </div>
                      <button
                        onClick={downloadSamplePdf}
                        className="mt-2 flex items-center gap-1.5 text-blue-700 hover:text-blue-900 text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download sample file
                      </button>
                    </div>
                  </div>

                  {/* Upload button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.csv"
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
                          Processing file...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Choose PDF or Text File
                        </>
                      )}
                    </button>
                  </div>

                  {uploadResult && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-green-800 text-sm font-medium">
                        {uploadResult.added} code{uploadResult.added !== 1 ? 's' : ''} added
                        {uploadResult.skipped > 0 && `, ${uploadResult.skipped} already existed`}
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

              {/* Codes list */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    Allowed Codes
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

                {loadingCodes ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
                  </div>
                ) : employeeCodes.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p>No employee codes uploaded yet.</p>
                    <p className="text-xs mt-1">Upload a file above to restrict quiz access.</p>
                    <p className="text-xs mt-2 text-slate-300">While empty, any valid code format is accepted.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {employeeCodes.map(ec => (
                      <div key={ec.id} className="flex items-center justify-between px-5 py-3">
                        <span className="font-mono font-bold text-slate-700 text-sm">{ec.code}</span>
                        {deleteConfirm === ec.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-500 font-medium">Delete?</span>
                            <button onClick={() => deleteCode(ec.id)} className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">Yes</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300">No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(ec.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear all confirmation */}
              {clearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Clear all codes?</h3>
                    <p className="text-slate-500 text-sm mb-5">
                      This will remove all {employeeCodes.length} employee codes. Any valid-format code will then be accepted for quiz entry.
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
              {/* Clear sessions card */}
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

              {/* Clear sessions confirmation */}
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
