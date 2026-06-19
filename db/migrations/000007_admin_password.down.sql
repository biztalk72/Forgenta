-- 역방향: 관리자 비밀번호 해시 제거
UPDATE users SET password_hash = NULL WHERE email = 'admin@forgenta.local';
