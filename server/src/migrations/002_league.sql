-- League settlement marker: the ISO week whose results have already been applied.
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS league_week date;
