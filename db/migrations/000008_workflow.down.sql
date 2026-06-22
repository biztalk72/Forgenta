-- 역방향: 워크플로우 테이블 제거 (자식 → 부모 순)
DROP TABLE IF EXISTS workflow_step_run;
DROP TABLE IF EXISTS workflow_run;
DROP TABLE IF EXISTS workflow;
