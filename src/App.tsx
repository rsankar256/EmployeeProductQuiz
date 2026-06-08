import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type { Product, Question, Answer } from './lib/supabase';
import { selectQuizQuestions, sortByDifficulty } from './lib/supabase';
import LandingScreen from './components/LandingScreen';
import QuizScreen from './components/QuizScreen';
import ResultsScreen from './components/ResultsScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import AdminScreen from './components/AdminScreen';
import AdminLoginModal from './components/AdminLoginModal';
import { Clock, BookOpen, ChevronRight, X } from 'lucide-react';

const ADMIN_PASSWORD = 'HW@Admin2025';
const QUIZ_QUESTION_COUNT = 5;
const SECONDS_PER_QUESTION = 30;

type Screen = 'landing' | 'quiz' | 'results' | 'leaderboard' | 'admin';

interface PendingQuiz {
  questions: Question[];
  code: string;
  product: Product;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [employeeCode, setEmployeeCode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Confirmation modal state
  const [pendingQuiz, setPendingQuiz] = useState<PendingQuiz | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await supabase.from('products').select('*').order('product_code');
    if (data) setProducts(data as Product[]);
    setLoadingProducts(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleStart = async (code: string, productId: string) => {
    const product = products.find(p => p.id === productId) ?? null;
    if (!product) return;

    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('product_id', productId);

    const allQuestions = (data ?? []) as Question[];

    // Tiling Solutions: show all questions sorted easy → medium → hard
    const isTiling = product.product_code === 'HW-TILE';
    const selected = isTiling
      ? sortByDifficulty(allQuestions)
      : selectQuizQuestions(allQuestions, QUIZ_QUESTION_COUNT);

    setPendingQuiz({ questions: selected, code, product });
  };

  const handleConfirmStart = () => {
    if (!pendingQuiz) return;
    setEmployeeCode(pendingQuiz.code);
    setSelectedProduct(pendingQuiz.product);
    setQuizQuestions(pendingQuiz.questions);
    setAnswers([]);
    setFinalScore(0);
    setSessionId(null);
    setPendingQuiz(null);
    setScreen('quiz');
  };

  const handleCancelStart = () => {
    setPendingQuiz(null);
  };

  const handleQuizComplete = async (completedAnswers: Answer[]) => {
    setAnswers(completedAnswers);
    const correct = completedAnswers.filter(a => a.is_correct).length;
    setFinalScore(correct);

    const { data } = await supabase
      .from('quiz_sessions')
      .insert({
        employee_code: employeeCode,
        employee_name: employeeCode,
        employee_email: `${employeeCode.toLowerCase()}@company.com`,
        product_id: selectedProduct?.id,
        score: correct,
        correct_count: correct,
        answers: completedAnswers,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (data) setSessionId((data as { id: string }).id);

    for (const answer of completedAnswers) {
      if (answer.selected_option !== null) {
        await supabase.rpc('increment_question_stats', {
          q_id: answer.question_id,
          was_incorrect: !answer.is_correct,
        }).then(() => null).catch(() => null);
      }
    }

    setScreen('results');
  };

  if (loadingProducts) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 100%)' }}>
        <div className="text-center">
          <img src="/HW_Logo.jpg" alt="HW" className="h-16 w-16 rounded-2xl object-cover mx-auto mb-5 shadow-xl" />
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-blue-200 text-sm">Loading quiz...</p>
        </div>
      </div>
    );
  }

  const totalSecs = (pendingQuiz?.questions.length ?? 0) * SECONDS_PER_QUESTION;
  const estMinutes = Math.ceil(totalSecs / 60);
  const isTiling = pendingQuiz?.product.product_code === 'HW-TILE';

  return (
    <div className="relative">

      {showAdminLogin && (
        <AdminLoginModal
          correctPassword={ADMIN_PASSWORD}
          onSuccess={() => { setShowAdminLogin(false); setScreen('admin'); }}
          onCancel={() => setShowAdminLogin(false)}
        />
      )}

      {/* Quiz confirmation modal */}
      {pendingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in">
            {/* Header */}
            <div className="relative px-6 pt-6 pb-5 text-center" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 100%)' }}>
              <button
                onClick={handleCancelStart}
                className="absolute top-4 right-4 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <BookOpen className="w-7 h-7 text-blue-900" />
              </div>
              <h2 className="text-white font-bold text-xl">Ready to Start?</h2>
              <p className="text-blue-200 text-sm mt-1">{pendingQuiz.product.name}</p>
            </div>

            {/* Stats */}
            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{pendingQuiz.questions.length}</p>
                  <p className="text-blue-500 text-xs mt-0.5 font-medium">Questions</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{SECONDS_PER_QUESTION}s</p>
                  <p className="text-yellow-600 text-xs mt-0.5 font-medium">Per Question</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">~{estMinutes}</p>
                  <p className="text-green-600 text-xs mt-0.5 font-medium">Minutes</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl px-4 py-3">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-600 text-xs leading-relaxed">
                  {pendingQuiz.questions.length} question{pendingQuiz.questions.length !== 1 ? 's' : ''} at {SECONDS_PER_QUESTION} seconds each — approximately <span className="font-semibold text-slate-800">{estMinutes} minute{estMinutes !== 1 ? 's' : ''}</span> to complete. Questions advance automatically if not answered in time.
                </p>
              </div>

              {isTiling && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Easy</span>
                    <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Medium</span>
                    <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Hard</span>
                  </div>
                  <p className="text-purple-700 text-xs font-medium">Questions ordered by difficulty</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleCancelStart}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStart}
                className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-yellow-200"
              >
                Start Quiz
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'landing' && (
        <LandingScreen
          products={products}
          onStart={handleStart}
          onLeaderboard={() => setScreen('leaderboard')}
          onAdmin={() => setShowAdminLogin(true)}
        />
      )}

      {screen === 'quiz' && quizQuestions.length > 0 && (
        <QuizScreen
          questions={quizQuestions}
          employeeCode={employeeCode}
          productName={selectedProduct?.name ?? ''}
          onComplete={handleQuizComplete}
        />
      )}

      {screen === 'results' && (
        <ResultsScreen
          employeeCode={employeeCode}
          productName={selectedProduct?.name ?? ''}
          score={finalScore}
          answers={answers}
          questions={quizQuestions}
          onViewLeaderboard={() => setScreen('leaderboard')}
          onRetake={() => setScreen('landing')}
        />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardScreen
          highlightCode={employeeCode || undefined}
          products={products}
          onBack={() => sessionId ? setScreen('results') : setScreen('landing')}
          onAdmin={() => setShowAdminLogin(true)}
        />
      )}

      {screen === 'admin' && (
        <AdminScreen onBack={() => { loadProducts(); setScreen('landing'); }} />
      )}
    </div>
  );
}
