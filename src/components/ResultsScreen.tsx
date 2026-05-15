import { Trophy, CheckCircle, XCircle, MinusCircle, BarChart2 } from 'lucide-react';
import type { Answer, Question } from '../lib/supabase';

interface Props {
  employeeCode: string;
  productName: string;
  score: number;
  answers: Answer[];
  questions: Question[];
  onViewLeaderboard: () => void;
  onRetake: () => void;
}

export default function ResultsScreen({ employeeCode, productName, score, answers, questions, onViewLeaderboard, onRetake }: Props) {
  const total = questions.length;
  const correct = answers.filter(a => a.is_correct).length;
  const unattempted = answers.filter(a => a.selected_option === null).length;
  const wrong = total - correct - unattempted;
  const percentage = Math.round((correct / total) * 100);

  const grade = percentage === 100 ? { label: 'Perfect Score!', color: 'text-yellow-400' }
    : percentage >= 80 ? { label: 'Outstanding', color: 'text-green-400' }
    : percentage >= 60 ? { label: 'Good Work', color: 'text-blue-300' }
    : percentage >= 40 ? { label: 'Keep Practicing', color: 'text-orange-400' }
    : { label: 'Needs Improvement', color: 'text-red-400' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #003087 0%, #001d5e 60%, #00123d 100%)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        <img src="/HW_Logo.jpg" alt="HW" className="h-9 w-9 rounded-lg object-cover" />
        <div>
          <p className="text-blue-200 text-xs">{employeeCode}</p>
          <p className="text-white font-semibold text-sm">{productName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        <div className="w-full max-w-2xl py-4 space-y-5">

          {/* Score card */}
          <div className="bg-white rounded-2xl p-7 shadow-2xl shadow-black/30 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#003087' }}>
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Quiz Complete!</h1>
            <p className="text-slate-500 text-sm mb-6">Employee: <span className="font-bold text-slate-700">{employeeCode}</span></p>

            {/* Circle */}
            <div className="relative w-32 h-32 mx-auto mb-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke="#facc15" strokeWidth="10"
                  strokeDasharray={`${(percentage / 100) * 314.2} 314.2`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-800">{correct}/{total}</span>
                <span className="text-slate-500 text-xs">score</span>
              </div>
            </div>

            <p className={`text-xl font-bold mb-1 ${grade.color}`}>{grade.label}</p>
            <p className="text-slate-500 text-sm">{percentage}% correct on <span className="font-semibold">{productName}</span></p>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-600">{correct}</p>
                <p className="text-xs text-green-700 font-medium mt-0.5">Correct</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-red-500">{wrong}</p>
                <p className="text-xs text-red-600 font-medium mt-0.5">Wrong</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-slate-400">{unattempted}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Skipped</p>
              </div>
            </div>
          </div>

          {/* Answer review */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-slate-600" />
              <h2 className="font-bold text-slate-800">Answer Review</h2>
            </div>
            <div className="space-y-3">
              {answers.map((answer, i) => {
                const q = questions[i];
                const correct_opt = q?.options.find(o => o.label === q.correct_option);
                const selected_opt = q?.options.find(o => o.label === answer.selected_option);

                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                    <div className="flex-shrink-0 mt-0.5">
                      {answer.selected_option === null
                        ? <MinusCircle className="w-5 h-5 text-slate-400" />
                        : answer.is_correct
                          ? <CheckCircle className="w-5 h-5 text-green-500" />
                          : <XCircle className="w-5 h-5 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 text-sm font-medium leading-snug">{q?.question_text}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                        {answer.selected_option && !answer.is_correct && (
                          <span className="text-red-500">Your answer: {selected_opt?.text}</span>
                        )}
                        {!answer.is_correct && (
                          <span className="text-green-600 font-semibold">Correct: {correct_opt?.text}</span>
                        )}
                        {answer.is_correct && (
                          <span className="text-green-600 font-semibold">{selected_opt?.text}</span>
                        )}
                        {answer.selected_option === null && (
                          <span className="text-slate-400">Not attempted — Correct: {correct_opt?.text}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                      {answer.selected_option ? `${(answer.time_taken_ms / 1000).toFixed(1)}s` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onRetake}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-4 rounded-xl transition-all border border-white/20"
            >
              Take Another Quiz
            </button>
            <button
              onClick={onViewLeaderboard}
              className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold py-4 rounded-xl transition-all shadow-lg"
            >
              <Trophy className="w-5 h-5" />
              Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
