ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium'
  CHECK (difficulty IN ('easy', 'medium', 'hard'));
