CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (username IN ('estimator', 'sales_head')),
  password_hash TEXT NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  role TEXT NOT NULL CHECK (role IN ('estimator', 'sales_head')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (username = role)
);

-- Explicit migration: connect-pg-simple must never auto-create its table.
CREATE TABLE sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX sessions_expire_idx ON sessions(expire);
