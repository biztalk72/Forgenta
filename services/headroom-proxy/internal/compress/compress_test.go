package compress

import "testing"

func TestTextAggressiveDropsBlankLines(t *testing.T) {
	r := Compress("text", "aggressive", "a\n\n\n\nb")
	if r.Compressed != "a\nb" {
		t.Fatalf("got %q", r.Compressed)
	}
	if r.CompressionRatio < 0 {
		t.Fatalf("ratio %v", r.CompressionRatio)
	}
}

func TestJSONSafeCompacts(t *testing.T) {
	r := Compress("json", "safe", "{\n  \"a\": 1,\n  \"b\": 2\n}")
	if r.Kind != "json" || r.CompressedTokens >= r.OriginalTokens {
		t.Fatalf("expected smaller json, got %+v", r)
	}
}

func TestInvalidJSONFallsBackToText(t *testing.T) {
	r := Compress("json", "safe", "not json {")
	if r.Kind != "text" {
		t.Fatalf("expected text fallback, got kind %q", r.Kind)
	}
}

func TestCodeAggressiveStripsComments(t *testing.T) {
	r := Compress("code", "aggressive", "x := 1 // set x\n// full line\ny := 2")
	if contains(r.Compressed, "//") {
		t.Fatalf("comments not stripped: %q", r.Compressed)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
