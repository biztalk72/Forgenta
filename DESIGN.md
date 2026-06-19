# DESIGN.md

## Purpose

This document defines the final UI/design operating standard for Claude Code projects that need a modern, slick, interactive, fast, responsive interface with theme switching and optional WebGL enhancement. DESIGN.md is the product's visual constitution: it tells the coding agent what good looks like, what must never be done, and which design references or reusable systems are allowed.[cite:1][cite:3][web:16][web:20][web:21]

이 문서는 modern, slick, interactive, fast, responsive UI와 theme switching, 그리고 선택적 WebGL 확장을 포함하는 Claude Code 프로젝트를 위한 최종 디자인 운영 기준이다. DESIGN.md는 제품의 시각적 헌법이며, 코딩 에이전트에게 무엇이 좋은 결과물인지, 무엇을 절대 하면 안 되는지, 어떤 디자인 레퍼런스와 재사용 가능한 시스템을 허용할지를 정의한다.[cite:1][cite:3][web:16][web:20][web:21]

---

## Operating Model

Use the following document hierarchy:

- `PRD.md` = what to build.[cite:1]
- `CLAUDE.md` = how the agent must work, inspect, verify, and avoid scope drift.[cite:1][web:21]
- `DESIGN.md` = how the UI should look, behave, scale, animate, and degrade safely.[cite:3][web:16]

다음 문서 계층을 사용한다.

- `PRD.md` = 무엇을 만들지 정의한다.[cite:1]
- `CLAUDE.md` = 에이전트가 어떻게 작업하고, 점검하고, 검증하며, 범위 이탈을 방지할지 정의한다.[cite:1][web:21]
- `DESIGN.md` = UI가 어떻게 보여야 하고, 반응해야 하고, 확장되어야 하고, 안전하게 폴백되어야 하는지 정의한다.[cite:3][web:16]

---

## Recommended Design Skill and Repo Policy

### Preferred skill usage

Claude Code should use a dedicated design skill or repo-backed design system instead of inventing a new visual language in every session. This approach improves consistency, makes iteration easier, and matches the user's existing preference for design.md-driven iterative UI refinement.[cite:3][cite:6][cite:7]

Claude Code는 매 세션마다 새로운 시각 언어를 즉흥적으로 만들지 말고, 전용 design skill 또는 repo 기반 design system을 우선 사용해야 한다. 이 방식은 일관성을 높이고 반복 개선을 쉽게 하며, 사용자의 기존 design.md 중심 반복 개선 선호와도 맞는다.[cite:3][cite:6][cite:7]

### Order of preference

1. **Project-local design skill** in `.claude/skills/designing-ui/` or equivalent, for organization-specific tokens, component conventions, and review checklists.[cite:7]
2. **Repo-local design system** such as `design-system/`, `apps/web/styles/`, or `packages/ui/` when the project already has reusable UI primitives and theme tokens.[cite:1]
3. **Official component systems** like shadcn/ui patterns before custom ad-hoc markup, because the user's preferred Claude Code workflow explicitly favors official shadcn/ui usage and strict TypeScript compatibility.[cite:1]
4. **External inspiration repos** only as references, never as blind copy sources.[web:20]

우선순위는 다음과 같다.

1. `.claude/skills/designing-ui/` 또는 이에 준하는 **프로젝트 로컬 design skill**, 조직 전용 토큰, 컴포넌트 규칙, 리뷰 체크리스트를 담기 좋다.[cite:7]
2. `design-system/`, `apps/web/styles/`, `packages/ui/` 같은 **repo 로컬 design system**, 이미 재사용 가능한 UI primitive와 theme token이 있을 때 우선 재사용한다.[cite:1]
3. **공식 컴포넌트 시스템**인 shadcn/ui 패턴을 ad-hoc custom markup보다 우선한다. 이는 사용자가 선호하는 Claude Code 워크플로우가 공식 shadcn/ui 사용과 strict TypeScript 호환을 명시적으로 선호하기 때문이다.[cite:1]
4. **외부 inspiration repo**는 참고만 하고, 그대로 복사하지 않는다.[web:20]

### Recommended reference sources

The DESIGN.md ecosystem and curated repositories are increasingly being used as structured prompts for AI-assisted UI generation, including collections of reusable design-system prompts and inspirations meant to be dropped into coding workflows.[web:16][web:20] Claude Code guidance also emphasizes that project-specific `CLAUDE.md` files improve consistency by giving persistent working conventions to the agent.[web:21]

DESIGN.md 생태계와 큐레이션된 repo는 AI 기반 UI 생성에서 구조화된 프롬프트 자산으로 점점 더 활용되고 있으며, 재사용 가능한 design-system prompt와 inspiration 컬렉션을 코딩 워크플로우에 바로 투입하는 사례가 늘고 있다.[web:16][web:20] 또한 Claude Code 관련 가이드는 프로젝트 전용 `CLAUDE.md`가 지속적인 작업 규칙을 제공해 일관성을 높인다고 설명한다.[web:21]

Approved references:

- `VoltAgent/awesome-claude-design` for DESIGN.md inspiration patterns and reusable direction sets.[web:20]
- Official shadcn/ui patterns and component structure when building React/Next/Tailwind interfaces.[cite:1]
- Project-local design skill and repo tokens before external templates.[cite:1][cite:7]

허용 레퍼런스는 다음과 같다.

- DESIGN.md inspiration과 재사용 가능한 방향성 셋을 얻기 위한 `VoltAgent/awesome-claude-design`.[web:20]
- React/Next/Tailwind 인터페이스 구축 시 공식 shadcn/ui 패턴과 컴포넌트 구조.[cite:1]
- 외부 템플릿보다 우선하는 프로젝트 로컬 design skill과 repo token.[cite:1][cite:7]

---

## Core Design Intent

Build a production-grade interface that feels premium, calm, and modern rather than flashy, noisy, or template-like. The product should communicate trust and speed first, with delight added selectively through motion, polish, and depth.[cite:6][cite:7]

과장되거나 시끄럽거나 템플릿 같은 느낌이 아니라, premium하고 차분하며 modern한 프로덕션급 인터페이스를 만든다. 제품은 먼저 신뢰감과 속도를 전달해야 하며, 즐거움은 motion, polish, depth를 통해 선택적으로 더한다.[cite:6][cite:7]

### Product adjectives

- Modern
- Slick
- Interactive
- Fast
- Responsive
- Premium
- Controlled
- Readable

### Anti-adjectives

- Generic
- Over-decorated
- Gimmicky
- Heavy
- Laggy
- Confusing
- Template-like
- Visually loud

---

## Design Principles

1. **Clarity before spectacle.** The user should understand the screen before noticing the effects.
2. **Hierarchy before decoration.** Layout, spacing, and contrast carry the UI.
3. **Motion explains state.** Animation must clarify change, not distract from work.
4. **Theme is systemic.** Theme switching is not only color swapping; it also includes semantic tokens, depth, surface contrast, and any WebGL scene styling.[web:15]
5. **Enhancement must degrade gracefully.** The UI must remain usable without WebGL, heavy effects, or high GPU performance.[web:19]

1. **화려함보다 명확성.** 사용자는 효과보다 먼저 화면 구조를 이해해야 한다.
2. **장식보다 위계.** 레이아웃, 간격, 대비가 UI를 이끈다.
3. **모션은 상태를 설명한다.** 애니메이션은 변화를 명확히 해야지, 작업을 방해하면 안 된다.
4. **테마는 시스템이다.** theme switching은 단순 색상 교체가 아니라 semantic token, depth, surface contrast, 그리고 WebGL scene styling까지 포함한다.[web:15]
5. **향상 요소는 안전하게 폴백되어야 한다.** WebGL이나 무거운 효과, 높은 GPU 성능이 없어도 UI는 계속 사용 가능해야 한다.[web:19]

---

## Mandatory Technology Bias

### Preferred stack

- Next.js or React for app UI when the codebase already uses React-oriented patterns.[cite:1]
- Tailwind CSS for token-driven utility styling when it matches the project setup.[cite:5]
- shadcn/ui for production-grade primitives before inventing new primitives.[cite:1]
- Three.js or React Three Fiber only for optional immersive layers, not for primary business UI.[web:15][web:19]

선호 스택은 다음과 같다.

- 코드베이스가 React 지향 패턴을 이미 사용한다면 app UI는 Next.js 또는 React를 우선한다.[cite:1]
- 프로젝트 구성과 맞으면 token 기반 utility styling을 위해 Tailwind CSS를 사용한다.[cite:5]
- 새 primitive를 임의로 만들기 전에 shadcn/ui를 우선한다.[cite:1]
- Three.js 또는 React Three Fiber는 선택적 immersive layer에만 사용하고, 핵심 업무 UI에는 사용하지 않는다.[web:15][web:19]

### Architecture rule

Separate the UI into at least two conceptual layers:

- **Business UI layer**: navigation, forms, tables, filters, content, actions.
- **Visual enhancement layer**: glow, parallax, particles, canvas, WebGL backgrounds, scene transitions.

업무 UI와 시각 효과를 최소 두 레이어로 분리한다.

- **Business UI layer**: navigation, forms, tables, filters, content, actions.
- **Visual enhancement layer**: glow, parallax, particles, canvas, WebGL backgrounds, scene transitions.

The enhancement layer must never become the only way to understand structure, state, or core functionality.[web:19]

시각 효과 레이어가 구조, 상태, 핵심 기능을 이해하는 유일한 수단이 되어서는 안 된다.[web:19]

---

## Theme System

### Theme requirements

- Must support light and dark themes.
- Must respect system preference on first render when practical.[web:15]
- Must provide a visible manual toggle.
- Must use semantic tokens, not scattered hardcoded hex values.
- Must keep contrast readable in both themes.
- Must synchronize theme changes across DOM UI and WebGL scene if a scene exists.[web:15]

다음 요구를 만족해야 한다.

- light/dark theme를 지원해야 한다.
- 가능하면 첫 렌더에서 시스템 선호를 존중해야 한다.[web:15]
- 사용자가 볼 수 있는 수동 토글이 있어야 한다.
- 흩어진 하드코딩 hex가 아니라 semantic token을 사용해야 한다.
- 두 테마 모두에서 가독 가능한 대비를 유지해야 한다.
- WebGL scene이 있다면 DOM UI와 scene 모두에서 테마 변경이 동기화되어야 한다.[web:15]

### Required semantic tokens

At minimum define:

- `--bg`
- `--surface`
- `--surface-2`
- `--surface-3`
- `--text`
- `--text-muted`
- `--text-faint`
- `--border`
- `--primary`
- `--accent`
- `--success`
- `--warning`
- `--danger`
- `--focus`
- `--shadow-color`

최소한 다음 token을 정의한다.

- `--bg`
- `--surface`
- `--surface-2`
- `--surface-3`
- `--text`
- `--text-muted`
- `--text-faint`
- `--border`
- `--primary`
- `--accent`
- `--success`
- `--warning`
- `--danger`
- `--focus`
- `--shadow-color`

### Theme behavior

When the theme changes, update:

- page background and text tokens
- borders and dividers
- card surfaces and overlays
- charts and subtle glow accents
- canvas/WebGL background, fog, lights, emissive intensity, particle color if present[web:15]

테마 전환 시 다음 요소를 함께 업데이트한다.

- 페이지 배경과 텍스트 token
- border와 divider
- card surface와 overlay
- chart와 미세한 glow accent
- canvas/WebGL background, fog, lights, emissive intensity, particle color[web:15]

---

## WebGL Policy

### When WebGL is appropriate

WebGL is allowed only as an enhancement for:

- hero backgrounds
- ambient particles
- subtle depth and parallax
- transition atmospherics
- premium scene framing for key landing areas

WebGL은 다음 목적의 enhancement로만 허용한다.

- hero background
- ambient particle
- subtle depth와 parallax
- 전환 시 분위기 연출
- 핵심 랜딩 영역의 premium scene framing

### When WebGL is not appropriate

WebGL must not be used for:

- main navigation
- forms and inputs
- tables and dense data grids
- critical text readability
- mandatory workflows and confirmations

WebGL은 다음 용도로 사용하면 안 된다.

- main navigation
- form과 input
- table과 dense data grid
- 핵심 텍스트 가독성
- 필수 워크플로우와 확인 절차

### WebGL implementation rules

- Sync renderer size to the container, not only the window.[web:19]
- Update camera aspect and projection matrix on resize.[web:19]
- Cap device pixel ratio to control performance cost.[web:19]
- Reduce quality or pause effects on weak devices.
- Respect reduced-motion preferences by simplifying or stopping scene motion.
- Fallback to static gradient, CSS background, or image if WebGL is unavailable.[web:19]
- Never allow WebGL to block scrolling or interaction on mobile.[web:19]

구현 규칙은 다음과 같다.

- renderer size는 window만이 아니라 container 기준으로 동기화한다.[web:19]
- resize 시 camera aspect와 projection matrix를 함께 갱신한다.[web:19]
- device pixel ratio를 제한해 성능 비용을 통제한다.[web:19]
- 저성능 기기에서는 품질을 낮추거나 효과를 멈춘다.
- reduced-motion 선호가 있으면 scene motion을 단순화하거나 중지한다.
- WebGL이 불가능하면 static gradient, CSS background, image로 폴백한다.[web:19]
- 모바일에서 스크롤과 상호작용을 방해하면 안 된다.[web:19]

---

## Layout Rules

### Spatial model

- Use a clear information hierarchy.
- Prefer left alignment for product UI.
- Use centered hero composition only when it serves a deliberate landing-page moment.
- Keep dashboards dense but breathable.
- Separate scan zones: navigation, control bar, primary content, secondary insight.

레이아웃 원칙은 다음과 같다.

- 명확한 정보 위계를 사용한다.
- product UI는 left alignment를 기본으로 한다.
- centered hero는 의도된 landing-page 순간에서만 사용한다.
- dashboard는 정보 밀도를 유지하되 숨 쉴 공간을 남긴다.
- navigation, control bar, primary content, secondary insight의 scan zone을 분리한다.

### Responsive model

Design mobile-first from 375px and verify at:

- 375px
- 768px
- 1024px
- 1440px

375px 기준 모바일 퍼스트로 설계하고 다음 폭에서 검증한다.

- 375px
- 768px
- 1024px
- 1440px

Rules:

- Stack complex panels vertically on mobile.
- Collapse secondary controls into drawers, sheets, menus, or tabs.
- Keep touch targets at least 44x44.
- Keep critical actions in thumb-friendly reach.
- Avoid hover-only meaning on touch devices.

세부 규칙은 다음과 같다.

- 모바일에서는 복잡한 패널을 세로로 쌓는다.
- 보조 컨트롤은 drawer, sheet, menu, tab으로 접는다.
- touch target은 최소 44x44를 유지한다.
- 핵심 액션은 엄지 친화 구역에 둔다.
- 터치 기기에서 hover만으로 의미를 전달하지 않는다.

---

## Typography Rules

- The interface should look premium through restraint, not oversized typography.
- Prefer one body family and one display family at most.
- Body text must stay readable and stable.
- Dense app screens should avoid theatrical hero typography.
- Numbers in dashboards should use tabular numerals where appropriate.

타이포그래피 원칙은 다음과 같다.

- 큰 글씨 남발이 아니라 절제된 사용으로 premium한 느낌을 만든다.
- body font와 display font는 최대 1쌍만 사용한다.
- body text는 항상 읽기 쉽고 안정적이어야 한다.
- 정보 밀도가 높은 앱 화면에는 과장된 hero typography를 쓰지 않는다.
- dashboard 숫자는 필요 시 tabular numeral을 사용한다.

---

## Motion Rules

- Motion must feel intentional, quick, and elegant.
- Default transitions should usually stay in the 150ms to 220ms range.
- Larger overlays or panel transitions may use 240ms to 320ms.
- Prefer opacity, transform, and subtle blur/filter transitions over layout-thrashing animation.
- Every motion decision must preserve perceived performance.

모션 원칙은 다음과 같다.

- 모션은 의도적이고 빠르며 우아해야 한다.
- 기본 전환은 대체로 150ms에서 220ms 범위를 유지한다.
- 큰 overlay나 panel 전환은 240ms에서 320ms까지 허용한다.
- layout를 흔드는 애니메이션보다 opacity, transform, subtle blur/filter를 우선한다.
- 모든 모션은 체감 성능을 해치지 않아야 한다.

---

## Performance Budget

The UI must feel fast before it looks impressive. Responsive WebGL guidance consistently highlights the need to resize correctly, control rendering cost, and avoid unnecessary overhead in the animation loop.[web:19]

UI는 인상적이기 전에 먼저 빨라야 한다. 반응형 WebGL 가이드는 resize 처리, rendering cost 제어, animation loop의 불필요한 오버헤드 제거가 중요하다고 반복해서 보여준다.[web:19]

Rules:

- Lazy-load heavy scenes.
- Defer non-critical scripts.
- Use small textures.
- Prefer procedural or CSS-based depth where possible.
- Keep the page usable before the enhancement layer is fully ready.
- Pause or reduce animation when not visible.

규칙은 다음과 같다.

- 무거운 scene은 lazy-load한다.
- 비핵심 script는 defer한다.
- texture는 작게 유지한다.
- 가능하면 procedural 또는 CSS 기반 depth를 우선한다.
- enhancement layer가 준비되기 전에도 페이지는 사용 가능해야 한다.
- 보이지 않을 때는 animation을 줄이거나 멈춘다.

---

## Design Prohibitions

The following are hard bans unless the product explicitly requires a different art direction.

다음 항목은 제품이 명시적으로 다른 art direction을 요구하지 않는 한 금지한다.

### Visual bans

- Do not use random neon gradients as the default product identity.
- Do not use generic blue-purple “AI startup” backgrounds by default.
- Do not cover dense content areas with animated backgrounds.
- Do not rely on glassmorphism that hurts readability.
- Do not use glow as a substitute for hierarchy.
- Do not use 3-column identical feature cards as the default landing layout.
- Do not center every heading, paragraph, and card.
- Do not use oversized radius on every component.
- Do not introduce decorative blobs, floating shapes, or fake complexity to hide weak layout.

시각 금지 규칙은 다음과 같다.

- 랜덤한 neon gradient를 기본 제품 정체성으로 사용하지 않는다.
- generic한 blue-purple “AI startup” 배경을 기본값으로 쓰지 않는다.
- 정보가 많은 콘텐츠 영역 위에 animated background를 깔지 않는다.
- 가독성을 해치는 glassmorphism에 의존하지 않는다.
- 위계 대신 glow로 해결하려 하지 않는다.
- landing 기본 레이아웃으로 동일한 3열 feature card 반복을 사용하지 않는다.
- 모든 heading, paragraph, card를 center 정렬하지 않는다.
- 모든 컴포넌트에 과도한 radius를 적용하지 않는다.
- 약한 레이아웃을 감추기 위해 decorative blob, floating shape, fake complexity를 넣지 않는다.

### UX bans

- Do not hide important actions behind hover-only affordances.
- Do not make theme switching cosmetic-only; it must update the whole design system state.[web:15]
- Do not make WebGL the only source of delight or identity.
- Do not sacrifice contrast for visual style.
- Do not use motion that delays routine user tasks.
- Do not require animation to understand state changes.
- Do not make keyboard navigation worse for the sake of visual effects.

UX 금지 규칙은 다음과 같다.

- 중요한 액션을 hover-only affordance 뒤에 숨기지 않는다.
- theme switching을 cosmetic-only 기능으로 만들지 않는다. 전체 design system state가 함께 바뀌어야 한다.[web:15]
- WebGL을 제품 정체성과 즐거움의 유일한 원천으로 만들지 않는다.
- 시각 스타일 때문에 contrast를 희생하지 않는다.
- 반복 작업을 지연시키는 motion을 사용하지 않는다.
- 상태 변화를 이해하기 위해 반드시 animation을 보게 만들지 않는다.
- 시각 효과 때문에 keyboard navigation을 악화시키지 않는다.

### Engineering bans

- Do not hardcode scattered color values when semantic tokens exist.
- Do not create one-off components that ignore the existing repo design system.[cite:1]
- Do not add a custom component if a project-approved shadcn/ui pattern already solves it.[cite:1]
- Do not bind resize logic only to window size for canvas-based scenes.[web:19]
- Do not run high-frequency rendering without visibility and performance guards.[web:19]
- Do not couple business logic to visual-effect state.

엔지니어링 금지 규칙은 다음과 같다.

- semantic token이 있는데도 색상값을 여기저기 하드코딩하지 않는다.
- 기존 repo design system을 무시한 one-off component를 만들지 않는다.[cite:1]
- 프로젝트 승인된 shadcn/ui 패턴이 이미 있으면 불필요한 custom component를 추가하지 않는다.[cite:1]
- canvas scene의 resize 로직을 window size에만 묶지 않는다.[web:19]
- visibility/performance guard 없이 고빈도 rendering을 계속 돌리지 않는다.[web:19]
- business logic을 visual-effect state에 결합하지 않는다.

---

## Accessibility Floor

- Maintain readable contrast in both light and dark themes.
- Preserve visible focus states.
- Support keyboard interaction for all primary controls.
- Respect reduced-motion preferences.
- Ensure fallback content still communicates meaning without the enhancement layer.

접근성 최소 기준은 다음과 같다.

- light/dark 양쪽에서 읽기 가능한 대비를 유지한다.
- 보이는 focus state를 유지한다.
- 모든 주요 컨트롤에 keyboard interaction을 지원한다.
- reduced-motion 선호를 존중한다.
- enhancement layer가 없어도 fallback content만으로 의미가 전달되어야 한다.

---

## Claude Code Execution Rules

When generating or modifying UI, Claude Code must follow this sequence:

1. Inspect existing tokens, theme provider, layout shell, and component primitives first.[cite:1]
2. Reuse repo patterns before importing external visual ideas.[cite:1][cite:7]
3. Check whether a project-local design skill exists and follow it before generalizing.[cite:7]
4. Prefer official shadcn/ui-compatible patterns over custom markup when solving common UI problems.[cite:1]
5. If WebGL is requested, isolate it into a dedicated scene module or enhancement layer.[web:15][web:19]
6. Verify desktop and mobile behavior after every major change.[cite:1]
7. Verify both light and dark themes after every major change.[web:15]
8. Reduce complexity if performance or readability regresses.

UI 생성 또는 수정 시 Claude Code는 다음 순서를 따라야 한다.

1. 먼저 기존 token, theme provider, layout shell, component primitive를 조사한다.[cite:1]
2. 외부 시각 아이디어를 가져오기 전에 repo 패턴을 재사용한다.[cite:1][cite:7]
3. 프로젝트 로컬 design skill이 있으면 일반화하기 전에 그것을 먼저 따른다.[cite:7]
4. 흔한 UI 문제는 custom markup보다 공식 shadcn/ui 호환 패턴으로 해결한다.[cite:1]
5. WebGL이 요구되면 전용 scene module 또는 enhancement layer로 격리한다.[web:15][web:19]
6. 주요 변경 후 desktop과 mobile 동작을 검증한다.[cite:1]
7. 주요 변경 후 light/dark theme를 모두 검증한다.[web:15]
8. 성능이나 가독성이 나빠지면 복잡성을 줄인다.

---

## Suggested Repo Layout

```text
.claude/
  skills/
    designing-ui/
      SKILL.md
      REVIEW-CHECKLIST.md
      INTERACTION-RULES.md
      WEBGL-GUARDRAILS.md
packages/
  ui/
    src/
      components/
      tokens/
      themes/
apps/
  web/
    app/
    components/
    styles/
PRD.md
CLAUDE.md
DESIGN.md
```

This layout supports a persistent project memory for Claude Code while separating product scope, coding rules, and design rules into stable layers.[cite:1][cite:7][web:21]

이 구조는 Claude Code를 위한 지속적 프로젝트 메모리를 제공하면서 제품 범위, 코딩 규칙, 디자인 규칙을 안정적인 레이어로 분리한다.[cite:1][cite:7][web:21]

---

## Final Instruction Block

Use this exact instruction block inside `CLAUDE.md` when referencing this file:

```md
For all UI, UX, theming, motion, responsive behavior, and WebGL-related work, read and follow DESIGN.md first.
Do not invent a new visual system if project tokens, themes, primitives, or design skills already exist.
Prefer project-local design skills, repo-local design systems, and approved shadcn/ui patterns before external templates.
Treat WebGL as an enhancement layer only.
Preserve accessibility, responsiveness, readability, and performance in both light and dark themes.
Apply all prohibition rules in DESIGN.md unless the PRD explicitly overrides them.
```

다음 문구를 `CLAUDE.md`에 그대로 넣어 이 파일을 참조하게 한다.

```md
For all UI, UX, theming, motion, responsive behavior, and WebGL-related work, read and follow DESIGN.md first.
Do not invent a new visual system if project tokens, themes, primitives, or design skills already exist.
Prefer project-local design skills, repo-local design systems, and approved shadcn/ui patterns before external templates.
Treat WebGL as an enhancement layer only.
Preserve accessibility, responsiveness, readability, and performance in both light and dark themes.
Apply all prohibition rules in DESIGN.md unless the PRD explicitly overrides them.
```
