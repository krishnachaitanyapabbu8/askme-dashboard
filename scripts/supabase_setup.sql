-- AskMe Analytics Tables
-- Run this in Supabase SQL Editor: https://mgirnkgxshlzxsbmoruf.supabase.co

-- 1. Cleaned messages (user + bot)
CREATE TABLE IF NOT EXISTS analytics_cleaned (
    id              BIGSERIAL PRIMARY KEY,
    session_id      TEXT NOT NULL,
    date            TEXT,
    month           TEXT,
    sender_type     TEXT,
    user_name       TEXT,
    user_display    TEXT,
    bot_type        TEXT,
    message         TEXT,
    question_category TEXT,
    feedback        TEXT,
    is_user_question  INTEGER DEFAULT 0,
    is_system_error   INTEGER DEFAULT 0,
    is_issue          INTEGER DEFAULT 0,
    source_file     TEXT,
    UNIQUE (session_id, sender_type, message)
);

-- 2. Issue flags per session
CREATE TABLE IF NOT EXISTS analytics_flat_table (
    id              BIGSERIAL PRIMARY KEY,
    session_id      TEXT NOT NULL,
    month           TEXT,
    module          TEXT,
    bot_type        TEXT,
    is_issue            INTEGER DEFAULT 0,
    is_system_error     INTEGER DEFAULT 0,
    is_kb_gap           INTEGER DEFAULT 0,
    is_placeholder_data INTEGER DEFAULT 0,
    is_copilot_loop     INTEGER DEFAULT 0,
    is_context_drop     INTEGER DEFAULT 0,
    source_file     TEXT,
    UNIQUE (session_id, bot_type)
);

-- 3. Token usage per session
CREATE TABLE IF NOT EXISTS analytics_token_usage (
    id              BIGSERIAL PRIMARY KEY,
    session_id      TEXT NOT NULL UNIQUE,
    month           TEXT,
    module_clean    TEXT,
    bot_type        TEXT,
    prompt_tokens     INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens      INTEGER DEFAULT 0,
    source_file     TEXT
);

-- 4. LLM step breakdown
CREATE TABLE IF NOT EXISTS analytics_llm_steps (
    id              BIGSERIAL PRIMARY KEY,
    session_id      TEXT NOT NULL,
    month           TEXT,
    module          TEXT,
    bot_type        TEXT,
    llm_step        TEXT,
    prompt_tokens     INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens      INTEGER DEFAULT 0,
    source_file     TEXT,
    UNIQUE (session_id, llm_step)
);

-- 5. Response times
CREATE TABLE IF NOT EXISTS analytics_response_times (
    id              BIGSERIAL PRIMARY KEY,
    session_id      TEXT NOT NULL UNIQUE,
    month           TEXT,
    bot_type        TEXT,
    response_time_seconds NUMERIC(8,1),
    source_file     TEXT
);

-- RLS: allow anon key to read and write (for parse-logs script + dashboard)
ALTER TABLE analytics_cleaned        ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_flat_table     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_token_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_llm_steps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_response_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON analytics_cleaned        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON analytics_flat_table     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON analytics_token_usage    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON analytics_llm_steps      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON analytics_response_times FOR ALL TO anon USING (true) WITH CHECK (true);
