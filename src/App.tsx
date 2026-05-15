import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type { Product, Question, Answer } from './lib/supabase';
import { selectQuizQuestions } from './lib/supabase';
import LandingScreen from './components/LandingScreen';
import QuizScreen from './components/QuizScreen';
import ResultsScreen from './components/ResultsScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import AdminScreen from './components/AdminScreen';
import AdminLoginModal from './components/AdminLoginModal';
import { Settings } from 'lucide-react';

const ADMIN_PASSWORD = 'HW@Admin2025';

const QUIZ_QUESTION_COUNT = 5;

type Screen = 'landing' | 'quiz' | 'results' | 'leaderboard' | 'admin';

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

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data } = await supabase.from('products').select('*').order('product_code');
    if (data) setProducts(data as Product[]);
    setLoadingProducts(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleStart = async (code: string, productId: string) => {
    const product = products.find(p => p.id === productId) ?? null;
    setEmployeeCode(code);
    setSelectedProduct(product);
    setAnswers([]);
    setFinalScore(0);
    setSessionId(null);

    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('product_id', productId);

    const allQuestions = (data ?? []) as Question[];
    const selected = selectQuizQuestions(allQuestions, QUIZ_QUESTION_COUNT);
    setQuizQuestions(selected);
    setScreen('quiz');
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

    // Update incorrect_count and attempt_count on each question
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

  return (
    <div className="relative">

      {showAdminLogin && (
        <AdminLoginModal
          correctPassword={ADMIN_PASSWORD}
          onSuccess={() => { setShowAdminLogin(false); setScreen('admin'); }}
          onCancel={() => setShowAdminLogin(false)}
        />
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
