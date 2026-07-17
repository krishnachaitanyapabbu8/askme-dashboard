-- Tracks when the log-processing pipeline last ran, independent of whether
-- that run added any new rows. Powers the "Last updated" label in the
-- dashboard header, which previously showed the latest date found in the
-- data itself — so a day that was 100% debug traffic (fully filtered out)
-- made the dashboard look stale even though the pipeline ran and checked.
--
-- Run this once in Supabase SQL Editor: https://mgirnkgxshlzxsbmoruf.supabase.co

CREATE TABLE IF NOT EXISTS analytics_pipeline_status (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO analytics_pipeline_status (id, last_run_at)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE analytics_pipeline_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pipeline status"
    ON analytics_pipeline_status FOR SELECT
    USING (true);

CREATE POLICY "Anyone can update pipeline status"
    ON analytics_pipeline_status FOR UPDATE
    USING (true);
