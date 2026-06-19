// 구조화 JSON 로거 (CLAUDE.md §7) - slog 기반, time→ts 키 변환 + service/version 기본 필드
package logging

import (
	"log/slog"
	"os"
)

// New는 stdout JSON 핸들러 기반 로거를 반환한다.
func New(service, version string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				a.Key = "ts"
			}
			return a
		},
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, opts)).
		With("service", service, "version", version)
}
