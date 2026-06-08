-- korea-finance-mcp — v1.2 operational metrics 테이블
-- 도구 호출 통계 (익명, 사용자 식별 정보 X)
-- 주인님 Supabase SQL Editor에서 실행 (v1.2 활성화 전, 1회만)
--
-- 명명 규약: [[standards/supabase-table-naming-v1]] — kfin_ 접두사

CREATE TABLE IF NOT EXISTS kfin_tool_calls (
  id BIGSERIAL PRIMARY KEY,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input_keywords TEXT[] DEFAULT '{}',
  result_code TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 자주 쓰는 쿼리 인덱스
CREATE INDEX IF NOT EXISTS idx_kfin_tool_calls_tool_name
  ON kfin_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_kfin_tool_calls_created_at
  ON kfin_tool_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kfin_tool_calls_keywords
  ON kfin_tool_calls USING GIN(input_keywords);

-- RLS — 운영자(service_role)만 INSERT/SELECT. 익명 접근 차단.
ALTER TABLE kfin_tool_calls ENABLE ROW LEVEL SECURITY;

-- service_role은 RLS 우회 (Supabase 기본). 별도 정책 불요.

-- ============================================================
-- 운영 쿼리 예시 (Supabase SQL Editor)
-- ============================================================

-- 1) 최근 7일 도구별 호출량
-- SELECT tool_name, COUNT(*) AS calls
-- FROM kfin_tool_calls
-- WHERE created_at >= NOW() - INTERVAL '7 days'
-- GROUP BY tool_name
-- ORDER BY calls DESC;

-- 2) 가장 인기 있는 검색 키워드 TOP 20 (최근 30일)
-- SELECT UNNEST(input_keywords) AS keyword, COUNT(*) AS hits
-- FROM kfin_tool_calls
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- GROUP BY keyword
-- ORDER BY hits DESC
-- LIMIT 20;

-- 3) 시간대별 호출 패턴
-- SELECT DATE_TRUNC('hour', created_at) AS hour, COUNT(*) AS calls
-- FROM kfin_tool_calls
-- WHERE created_at >= NOW() - INTERVAL '24 hours'
-- GROUP BY hour
-- ORDER BY hour;

-- 4) 에러율
-- SELECT
--   tool_name,
--   COUNT(*) FILTER (WHERE result_code = 'OK') AS ok,
--   COUNT(*) FILTER (WHERE result_code LIKE 'ERROR_%') AS err,
--   ROUND(100.0 * COUNT(*) FILTER (WHERE result_code LIKE 'ERROR_%') / COUNT(*), 2) AS err_rate
-- FROM kfin_tool_calls
-- WHERE created_at >= NOW() - INTERVAL '7 days'
-- GROUP BY tool_name
-- ORDER BY err_rate DESC;
