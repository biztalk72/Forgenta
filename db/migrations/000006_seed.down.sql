-- 역방향: 시드 데이터 제거
DELETE FROM workspace_member
 WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@forgenta.local');
DELETE FROM users WHERE email = 'admin@forgenta.local';
DELETE FROM workspace WHERE slug = 'default';
DELETE FROM role WHERE name IN ('owner','admin','member','viewer');
