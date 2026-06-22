-- 역방향: workflow 계보 제거 후 원래 3종 제약 복원
DELETE FROM clone_lineage WHERE entity_type = 'workflow';
ALTER TABLE clone_lineage DROP CONSTRAINT IF EXISTS clone_lineage_entity_type_check;
ALTER TABLE clone_lineage ADD CONSTRAINT clone_lineage_entity_type_check
    CHECK (entity_type IN ('agent', 'app', 'prompt_template'));
