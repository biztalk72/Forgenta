-- 시드 관리자 계정에 개발용 비밀번호(bcrypt) 설정. 비밀번호: forgenta (dev 전용)
UPDATE users SET password_hash = '$2y$10$LXX1Y.S1V4yDwJzGOHHiIukcpXtODPmLx9CAwu88Tk2mvl1xKhL2C'
 WHERE email = 'admin@forgenta.local';
