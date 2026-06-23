package proxy

import (
	"encoding/json"
	"testing"
)

func TestRewriteModelInBody_replacesTopLevelModel(t *testing.T) {
	in := []byte(`{"model":"qwen3-72b-instruct-nvfp4","messages":[{"role":"user","content":"hi"}],"stream":true}`)
	out, ok := rewriteModelInBody(in, "qwen3:8b")
	if !ok {
		t.Fatal("expected ok=true")
	}
	var obj map[string]any
	if err := json.Unmarshal(out, &obj); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if obj["model"] != "qwen3:8b" {
		t.Fatalf("model=%v want qwen3:8b", obj["model"])
	}
	// Sibling 필드는 보존되어야 한다.
	if obj["stream"] != true {
		t.Fatalf("stream lost: %+v", obj)
	}
	msgs, _ := obj["messages"].([]any)
	if len(msgs) != 1 {
		t.Fatalf("messages lost: %+v", obj["messages"])
	}
}

func TestRewriteModelInBody_missingModelField(t *testing.T) {
	in := []byte(`{"messages":[]}`)
	out, ok := rewriteModelInBody(in, "qwen3:8b")
	if ok {
		t.Fatal("expected ok=false when model field absent")
	}
	if string(out) != string(in) {
		t.Fatalf("body mutated despite missing model: %s", out)
	}
}

func TestRewriteModelInBody_invalidJSONReturnsOriginal(t *testing.T) {
	in := []byte(`{not json`)
	out, ok := rewriteModelInBody(in, "qwen3:8b")
	if ok {
		t.Fatal("expected ok=false on invalid json")
	}
	if string(out) != string(in) {
		t.Fatalf("body mutated despite parse failure: %s", out)
	}
}
