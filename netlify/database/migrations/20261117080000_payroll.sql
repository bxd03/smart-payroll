CREATE TABLE payroll_state(id text PRIMARY KEY,data text NOT NULL,revision integer NOT NULL DEFAULT 0);
CREATE TABLE source_files(id text PRIMARY KEY,name text NOT NULL,type text NOT NULL,size integer NOT NULL,created_at text NOT NULL,rows integer NOT NULL DEFAULT 0,owner text);
CREATE INDEX source_files_owner ON source_files(owner);
CREATE TABLE audit_events(id text PRIMARY KEY,action text NOT NULL,actor text NOT NULL,detail text NOT NULL,created_at text NOT NULL,owner text);
CREATE INDEX audit_events_owner ON audit_events(owner);
CREATE TABLE sp_file_blobs(id text PRIMARY KEY,body bytea NOT NULL);
CREATE TABLE sp_accounts(id text PRIMARY KEY,email text UNIQUE NOT NULL,password_hash text NOT NULL,is_admin boolean NOT NULL DEFAULT false);
CREATE TABLE sp_sessions(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES sp_accounts(id),expires_at timestamptz NOT NULL);
CREATE TABLE sp_login_attempts(key text PRIMARY KEY,attempts integer NOT NULL,reset_at timestamptz NOT NULL);
