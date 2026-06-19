-- 확장 활성화: pgvector(임베딩), TimescaleDB(시계열), pgcrypto(gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
