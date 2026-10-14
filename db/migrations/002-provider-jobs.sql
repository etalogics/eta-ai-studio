CREATE TABLE IF NOT EXISTS provider_jobs (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), state TEXT NOT NULL,
 request_id TEXT, status_url TEXT, error TEXT,
 next_poll INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 lease_owner TEXT, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS provider_jobs_poll ON provider_jobs(state,next_poll,lease_until);
PRAGMA user_version=2;
