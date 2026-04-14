# CLAUDE.md

## Project Overview
이 프로젝트는 [한 줄 설명] 입니다.
주요 사용자는 [대상 사용자] 입니다.
가장 중요한 비즈니스 목표는 [예: 정확도, 속도, 운영비 절감, UX 개선] 입니다.

## Tech Stack
- Language: TypeScript / Python / Go / Rust 중 실제 사용 스택으로 수정
- Frontend: Next.js / React / Vue / None
- Backend: FastAPI / NestJS / Spring Boot / None
- DB: PostgreSQL / MySQL / SQLite / MongoDB
- Infra: Docker / Kubernetes / AWS / GCP / On-prem
- Test: pytest / vitest / jest / go test

## Project Structure
- `src/`: 핵심 애플리케이션 코드
- `tests/`: 단위/통합 테스트
- `docs/`: 설계 문서, ADR, 운영 문서
- `scripts/`: 운영/마이그레이션/유틸 스크립트
- `infra/`: 배포 및 인프라 코드

## Commands
- Install: `npm install` 또는 `uv sync`
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Format: `npm run format`

## Architecture Rules
- 비즈니스 로직은 UI 레이어에 두지 말 것.
- 데이터 접근은 repository/service 계층을 통해서만 수행할 것.
- 외부 API 연동은 adapter 계층으로 분리할 것.
- 설정값과 시크릿은 코드에 하드코딩하지 말 것.
- 에러 처리는 공통 포맷으로 표준화할 것.

## Coding Conventions
- 함수는 짧고 단일 책임을 유지할 것.
- 파일명은 일관된 규칙을 사용할 것. 예: `kebab-case` 또는 `snake_case`
- 주석은 “무엇”보다 “왜”가 필요할 때만 작성할 것.
- 새 의존성 추가는 반드시 승인 후 진행할 것.
- 타입 안정성을 우선하고 `any` 또는 무분별한 dynamic 사용을 피할 것.

## Testing Rules
- 새로운 기능에는 최소 1개 이상의 테스트를 추가할 것.
- 버그 수정 시 재현 테스트를 먼저 만들 것.
- flaky test를 숨기지 말고 원인을 추적할 것.
- 테스트가 깨지면 원인 설명 없이 무시하지 말 것.

## Review Check