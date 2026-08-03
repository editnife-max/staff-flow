-- Normalize the religion column so all Muslim variants map to 'Muslim'
-- and all Non-Muslim variants map to 'Non-muslim', matching the UI form values.
UPDATE candidates
SET religion = CASE
  WHEN lower(trim(religion)) IN ('muslim', 'islam', 'moslem', 'مسلمة', 'مسلم') THEN 'Muslim'
  WHEN lower(trim(religion)) IN ('non-muslim', 'non muslim', 'nonmuslim', 'christian', 'christianity', 'hindu', 'buddhist', 'مسيحية', 'هندوسية', 'بوذية') THEN 'Non-muslim'
  ELSE religion
END
WHERE religion IS NOT NULL
  AND religion NOT IN ('Muslim', 'Non-muslim');
