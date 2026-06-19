// Headroom-Proxy 진입점 - 컨텍스트 압축 프록시 (PRD v2 §2.3 [4]), 60~95% 토큰 절감 목표
package main

import (
	"encoding/json"
	"net/http"

	"github.com/forgenta/headroom-proxy/internal/compress"
	"github.com/forgenta/headroom-proxy/internal/config"
	"github.com/forgenta/shared/health"
	"github.com/forgenta/shared/httperr"
	"github.com/forgenta/shared/logging"
)

const version = "0.1.0"

type compressRequest struct {
	Kind    string `json:"kind"`    // text | json | code
	Mode    string `json:"mode"`    // safe | aggressive (미지정 시 서버 기본)
	Content string `json:"content"`
}

func main() {
	cfg := config.Load()
	log := logging.New("headroom-proxy", version)

	mux := http.NewServeMux()
	health.Handler{Service: "headroom-proxy", Version: version}.Register(mux)

	mux.HandleFunc("POST /v1/compress", func(w http.ResponseWriter, r *http.Request) {
		var req compressRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httperr.Write(w, http.StatusBadRequest, "invalid request")
			return
		}
		mode := req.Mode
		if mode == "" {
			mode = cfg.Mode
		}
		res := compress.Compress(req.Kind, mode, req.Content)
		log.Info("compress_complete", "kind", res.Kind, "mode", res.Mode,
			"original_tokens", res.OriginalTokens, "compressed_tokens", res.CompressedTokens,
			"compression_ratio", res.CompressionRatio)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(res)
	})

	log.Info("listening", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Error("server_failed", "err", err)
	}
}
