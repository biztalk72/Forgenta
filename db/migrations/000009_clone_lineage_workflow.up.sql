-- clone_lineage.entity_type에 'workflow' 허용 (v3 워크플로우 clone 계보 — PRD v3 §7)
ALTER TABLE clone_lineage DROP CONSTRAINT IF EXISTS clone_lineage_entity_type_check;
ALTER TABLE clone_lineage ADD CONSTRAINT clone_lineage_entity_type_check
    CHECK (entity_type IN ('agent', 'app', 'prompt_template', 'workflow'));
