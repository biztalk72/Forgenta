// 컨텍스트 압축 (CLAUDE.md/PRD §2.3 [4]) - Kompress-base(text)/SmartCrusher(json)/CodeCompressor(code)
package compress

import (
	"encoding/json"
	"regexp"
	"strings"
)

type Result struct {
	Kind             string  `json:"kind"`
	Mode             string  `json:"mode"`
	Compressed       string  `json:"compressed"`
	OriginalTokens   int     `json:"original_tokens"`
	CompressedTokens int     `json:"compressed_tokens"`
	CompressionRatio float64 `json:"compression_ratio"` // 절감 비율 (1 - compressed/original)
}

var (
	blankRuns   = regexp.MustCompile(`\n{3,}`)
	allBlank    = regexp.MustCompile(`\n\s*\n`)
	multiSpace  = regexp.MustCompile(`[ \t]{2,}`)
	lineComment = regexp.MustCompile(`(?m)\s*//.*$`)
	hashComment = regexp.MustCompile(`(?m)^\s*#.*$`)
	blockComm   = regexp.MustCompile(`(?s)/\*.*?\*/`)
)

// Compress는 kind/mode에 따라 입력을 압축한다. json 파싱 실패 시 text 압축으로 폴백한다.
func Compress(kind, mode, in string) Result {
	if mode != "aggressive" {
		mode = "safe"
	}
	var out string
	switch kind {
	case "json":
		var ok bool
		if out, ok = crushJSON(in, mode); !ok {
			out, kind = kompressText(in, mode), "text" // 폴백
		}
	case "code":
		out = compressCode(in, mode)
	default:
		out, kind = kompressText(in, mode), "text"
	}
	ot, ct := estimateTokens(in), estimateTokens(out)
	ratio := 0.0
	if ot > 0 {
		ratio = 1 - float64(ct)/float64(ot)
	}
	return Result{kind, mode, out, ot, ct, ratio}
}

func estimateTokens(s string) int { return len([]rune(s))/4 + 1 }

func kompressText(in, mode string) string {
	lines := strings.Split(in, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimRight(l, " \t")
	}
	out := strings.Join(lines, "\n")
	if mode == "aggressive" {
		out = allBlank.ReplaceAllString(out, "\n")
		out = multiSpace.ReplaceAllString(out, " ")
	} else {
		out = blankRuns.ReplaceAllString(out, "\n\n")
	}
	return strings.TrimSpace(out)
}

func crushJSON(in, mode string) (string, bool) {
	var v any
	if err := json.Unmarshal([]byte(in), &v); err != nil {
		return "", false
	}
	if mode == "aggressive" {
		v = dropEmpty(v)
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", false
	}
	return string(b), true
}

// dropEmpty는 null/빈 값 키를 제거한다 (aggressive).
func dropEmpty(v any) any {
	switch t := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			val = dropEmpty(val)
			if val == nil || val == "" {
				continue
			}
			out[k] = val
		}
		return out
	case []any:
		out := make([]any, 0, len(t))
		for _, val := range t {
			out = append(out, dropEmpty(val))
		}
		return out
	default:
		return v
	}
}

func compressCode(in, mode string) string {
	out := in
	if mode == "aggressive" {
		out = blockComm.ReplaceAllString(out, "")
		out = lineComment.ReplaceAllString(out, "")
		out = hashComment.ReplaceAllString(out, "")
	}
	return kompressText(out, mode)
}
