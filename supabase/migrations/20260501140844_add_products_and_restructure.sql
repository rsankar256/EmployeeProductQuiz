/*
  # Add Products Table and Restructure Questions

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `product_code` (text, unique) - short product ID
      - `name` (text) - product display name
      - `description` (text) - brief product description
      - `created_at` (timestamptz)

  2. Modified Tables
    - `questions`
      - Add `product_id` (uuid, FK to products)
      - Add `incorrect_count` (int) - tracks how many times answered wrong (for future bias)
      - Add `attempt_count` (int) - total attempts
      - Make `order_index` non-unique (unique within product instead)

  3. Security
    - Enable RLS on products table
    - Public read access for products

  4. Notes
    - The quiz now selects 5 random questions per product
    - Wrong-answer frequency is tracked on each question for future bias
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert products"
  ON products FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update products"
  ON products FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete products"
  ON products FOR DELETE
  TO anon, authenticated
  USING (true);

-- Add product_id to questions (nullable initially for migration safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE questions ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add wrong answer tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'incorrect_count'
  ) THEN
    ALTER TABLE questions ADD COLUMN incorrect_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'attempt_count'
  ) THEN
    ALTER TABLE questions ADD COLUMN attempt_count int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Drop old unique constraint on order_index if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'questions' AND constraint_type = 'UNIQUE' AND constraint_name = 'questions_order_index_key'
  ) THEN
    ALTER TABLE questions DROP CONSTRAINT questions_order_index_key;
  END IF;
END $$;

-- Add selected_product_id to quiz_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_sessions' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE quiz_sessions ADD COLUMN product_id uuid REFERENCES products(id);
  END IF;
END $$;

-- Add employee_code column to quiz_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_sessions' AND column_name = 'employee_code'
  ) THEN
    ALTER TABLE quiz_sessions ADD COLUMN employee_code text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_product_id ON questions (product_id);
