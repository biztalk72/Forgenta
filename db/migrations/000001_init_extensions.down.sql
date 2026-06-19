-- 확장 제거 (테이블 제거 이후 실행되는 역방향 마이그레이션에서 안전)
DROP EXTENSION IF EXISTS vector;
DROP EXTENSION IF EXISTS timescaledb CASCADE;
DROP EXTENSION IF EXISTS pgcrypto;
