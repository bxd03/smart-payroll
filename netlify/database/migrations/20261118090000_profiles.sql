ALTER TABLE sp_accounts ADD COLUMN display_name text NOT NULL DEFAULT '';
ALTER TABLE sp_accounts ADD COLUMN avatar text NOT NULL DEFAULT '';
ALTER TABLE sp_accounts ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ms'));
