// JSON 오류 응답 헬퍼 (CLAUDE.md §8) - 사용자에게는 안전한 메시지만 노출
package httperr

import (
	"encoding/json"
	"net/http"
)

// Write는 {"error": msg} 형태의 JSON 오류를 응답한다.
func Write(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
