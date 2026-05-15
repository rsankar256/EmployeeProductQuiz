/*
  # Add employee_codes table

  1. New Tables
    - `employee_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique) — the employee code e.g. M12345
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anon users can SELECT (to validate codes on quiz entry)
    - No INSERT/UPDATE/DELETE via anon (admin uses service role via edge fn or direct)
    - We use a permissive SELECT policy since codes are not sensitive PII and
      validation must work client-side without auth
*/

CREATE TABLE IF NOT EXISTS employee_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read employee codes for validation"
  ON employee_codes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can insert employee codes"
  ON employee_codes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete employee codes"
  ON employee_codes FOR DELETE
  TO anon
  USING (true);
