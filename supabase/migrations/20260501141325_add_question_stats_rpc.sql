/*
  # Add RPC function to increment question statistics

  Creates a helper function to track attempt and incorrect counts per question.
  This powers the future bias feature where frequently wrong questions get selected more often.
*/

CREATE OR REPLACE FUNCTION increment_question_stats(q_id uuid, was_incorrect boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE questions
  SET
    attempt_count = attempt_count + 1,
    incorrect_count = incorrect_count + CASE WHEN was_incorrect THEN 1 ELSE 0 END
  WHERE id = q_id;
END;
$$;
