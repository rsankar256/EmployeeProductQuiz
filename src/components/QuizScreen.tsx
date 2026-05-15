import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import type { Question, Answer, Option } from '../lib/supabase';

const TIMER_SECONDS = 30;

interface Props {
  questions: Question[];
  employeeCode: string;
  productName: string;
  onComplete: (answers: Answer[]) => void;
}

export default function QuizScreen({ questions, employeeCode, productName, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [revealed, setRevealed] = useState(false);
  const questionStartTime = useRef(Date.now());

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = (currentIndex / totalQuestions) * 100;

  const advance = useCallback((chosenOption: string | null) => {
    const timeTaken = Date.now() - questionStartTime.current;
    const isCorrect = chosenOption !== null && chosenOption === currentQuestion.correct_option;

    const answer: Answer = {
      question_id: currentQuestion.id,
      question_index: currentIndex,
      selected_option: chosenOption,
      is_correct: isCorrect,
      time_taken_ms: timeTaken,
    };

    const updated = [...answers, answer];
    setAnswers(updated);

    if (currentIndex + 1 >= totalQuestions) {
      onComplete(updated);
    } else {
      setCurrentIndex(i => i + 1);
      setSelectedOption(null);
      setRevealed(false);
      setTimeLeft(TIMER_SECONDS);
      questionStartTime.current = Date.now();
    }
  }, [answers, currentIndex, currentQuestion, totalQuestions, onComplete]);

  useEffect(() => {
    if (revealed) return;
    if (timeLeft <= 0) { advance(null); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, revealed, advance]);

  const handleSelect = (label: string) => {
    if (revealed) return;
    setSelectedOption(label);
    setRevealed(true);
    setTimeout(() => advance(label), 1200);
  };

  const timerPct = (timeLeft / TIMER_SECONDS) * 100;
  const timerColorBar = timeLeft > 8 ? '#facc15' : timeLeft > 4 ? '#fb923c' : '#f87171';
  const timerColorText = timeLeft > 8 ? 'text-yellow-400' : timeLeft > 4 ? 'text-orange-400' : 'text-red-400';

  const getOptionStyle = (opt: Option) => {
    if (!revealed) {
      return selectedOption === opt.label
        ? 'border-yellow-400 bg-yellow-50 text-slate-800'
        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 cursor-pointer text-slate-700';
    }
    if (opt.label === currentQuestion.correct_option) return 'border-green-500 bg-green-500 text-white';
    if (opt.label === selectedOption) return 'border-red-400 bg-red-400 text-white';
    return 'border-slate-100 bg-slate-50 text-slate-400';
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 60%, #00123d 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/HW_Logo.jpg" alt="HW" className="h-9 w-9 rounded-lg object-cover" />
          <div>
            <p className="text-blue-200 text-xs">{employeeCode}</p>
            <p className="text-white font-semibold text-sm">{productName}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 font-bold text-xl tabular-nums ${timerColorText}`}>
          <Clock className="w-4 h-4" />
          {timeLeft}s
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">

          {/* Progress */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-300 text-xs font-medium">Question {currentIndex + 1} / {totalQuestions}</span>
            <span className="text-blue-300 text-xs">{Math.round(progress)}% complete</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
            <div className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Timer bar */}
          <div className="w-full bg-white/10 rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${timerPct}%`, background: timerColorBar }}
            />
          </div>

          {/* Question card */}
          <div className="bg-white rounded-2xl p-7 shadow-2xl shadow-black/30 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Q{currentIndex + 1}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 leading-relaxed mb-7">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleSelect(opt.label)}
                  disabled={revealed}
                  className={`flex items-center gap-4 w-full text-left px-5 py-4 rounded-xl border-2 font-medium transition-all duration-200 ${getOptionStyle(opt)}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    revealed && opt.label === currentQuestion.correct_option ? 'bg-white/20 text-white' :
                    revealed && opt.label === selectedOption ? 'bg-white/20 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {opt.label}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {revealed && selectedOption && (
            <div className={`rounded-xl p-4 text-center font-semibold text-sm ${
              selectedOption === currentQuestion.correct_option
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {selectedOption === currentQuestion.correct_option
                ? 'Correct! Well done.'
                : `Incorrect. Correct answer: ${currentQuestion.correct_option}`}
            </div>
          )}
          {revealed && !selectedOption && (
            <div className="rounded-xl p-4 text-center font-semibold text-sm bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              Time's up! Moving on...
            </div>
          )}

          {!revealed && currentIndex + 1 < totalQuestions && (
            <div className="flex items-center justify-center gap-1 mt-3 text-blue-400 text-xs">
              <ChevronRight className="w-3 h-3" />
              Auto-advances in {timeLeft}s if no answer selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
