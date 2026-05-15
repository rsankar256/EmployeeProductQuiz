import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Option {
  label: string;
  text: string;
}

export interface Product {
  id: string;
  product_code: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Question {
  id: string;
  product_id: string;
  order_index: number;
  question_text: string;
  options: Option[];
  correct_option: string;
  incorrect_count: number;
  attempt_count: number;
  created_at: string;
}

export interface Answer {
  question_id: string;
  question_index: number;
  selected_option: string | null;
  is_correct: boolean;
  time_taken_ms: number;
}

export interface QuizSession {
  id: string;
  employee_code: string;
  employee_name: string;
  employee_email: string;
  product_id: string;
  score: number;
  correct_count: number;
  answers: Answer[];
  completed_at: string;
  created_at: string;
}

export interface EmployeeCode {
  id: string;
  code: string;
  created_at: string;
}

export const EMPLOYEE_CODE_REGEX = /^[A-Z0-9]{3,10}$/;

export function selectQuizQuestions(questions: Question[], count = 5): Question[] {
  if (questions.length <= count) return [...questions].sort(() => Math.random() - 0.5);

  // Weighted random selection: higher incorrect_count = higher weight
  const totalAttempts = questions.reduce((s, q) => s + q.attempt_count, 0);
  const weighted: Question[] = [];

  questions.forEach(q => {
    const errorRate = q.attempt_count > 0 ? q.incorrect_count / q.attempt_count : 0.5;
    // Base weight 1, +2 bonus at 100% error rate
    const weight = Math.round(1 + errorRate * 2);
    for (let i = 0; i < weight; i++) weighted.push(q);
  });

  const selected: Question[] = [];
  const usedIds = new Set<string>();

  while (selected.length < count && weighted.length > 0) {
    const idx = Math.floor(Math.random() * weighted.length);
    const q = weighted[idx];
    if (!usedIds.has(q.id)) {
      selected.push(q);
      usedIds.add(q.id);
    }
    // Remove all copies of this question from weighted pool
    weighted.splice(0, weighted.length, ...weighted.filter(w => w.id !== q.id));
  }

  return selected;
}
