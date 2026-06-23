// 백엔드 리버스 프록시 — SSE pass-through (FlushInterval=-1), fallback 체인 시도.
package proxy

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// CloneRequest 는 fallback 시도를 위해 원본 요청을 재구성한다 (Body 도 재읽기 가능하게 buffer).
type Cloneable struct {
	Method string
	Path   string
	Header http.Header
	Body   []byte
}

func Capture(r *http.Request) (*Cloneable, error) {
	var body []byte
	if r.Body != nil {
		b, err := io.ReadAll(r.Body)
		if err != nil {
			return nil, err
		}
		body = b
		r.Body = io.NopCloser(bytes.NewReader(b))
	}
	return &Cloneable{
		Method: r.Method,
		Path:   r.URL.RequestURI(),
		Header: r.Header.Clone(),
		Body:   body,
	}, nil
}

// SingleHostReverseProxy 를 SSE 즉시 플러시 + 백엔드 호스트 재작성으로 구성한다.
func newReverseProxy(target *url.URL) *httputil.ReverseProxy {
	rp := httputil.NewSingleHostReverseProxy(target)
	rp.FlushInterval = -1 // SSE 즉시 플러시
	// httputil 의 기본 Director 가 Host/Scheme 을 target 으로 갈아끼움 — 명시적 override 없음.
	return rp
}

// Serve forwards request to target. Returns error if response status >= 500 (caller may try fallback).
// 5xx 응답을 fallback 트리거로 사용하기 위해 captured copy 를 통해 재시도 가능한 형태로 호출한다.
// rewriteModel 이 비어있지 않으면 body JSON 의 "model" 필드를 그 값으로 치환한다 (fallback 시 백엔드별 model 이름이 다를 때).
func Serve(w http.ResponseWriter, original *http.Request, capt *Cloneable, target *url.URL, log *slog.Logger, rewriteModel string) error {
	body := capt.Body
	if rewriteModel != "" && len(body) > 0 {
		if rewritten, ok := rewriteModelInBody(body, rewriteModel); ok {
			body = rewritten
		} else {
			log.Warn("rewrite_model_failed", "model", rewriteModel, "backend", target.String())
		}
	}

	// 새 요청을 만들어서 재시도 안전.
	r2 := original.Clone(original.Context())
	r2.URL.Scheme = target.Scheme
	r2.URL.Host = target.Host
	r2.Host = target.Host
	if capt != nil {
		r2.Body = io.NopCloser(bytes.NewReader(body))
		r2.ContentLength = int64(len(body))
	}

	rp := newReverseProxy(target)
	// ModifyResponse 로 5xx 감지 (caller 가 fallback 결정).
	var upstreamErr error
	rp.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode >= 500 {
			upstreamErr = &UpstreamError{Status: resp.StatusCode, Backend: target.String()}
		}
		return nil
	}
	rp.ErrorHandler = func(rw http.ResponseWriter, _ *http.Request, err error) {
		upstreamErr = &UpstreamError{Status: http.StatusBadGateway, Backend: target.String(), Inner: err}
		log.Warn("proxy_error", "backend", target.String(), "err", err)
	}

	rp.ServeHTTP(w, r2)
	return upstreamErr
}

type UpstreamError struct {
	Status  int
	Backend string
	Inner   error
}

func (e *UpstreamError) Error() string {
	if e.Inner != nil {
		return "upstream " + e.Backend + ": " + e.Inner.Error()
	}
	return "upstream " + e.Backend + " returned " + http.StatusText(e.Status)
}

// IsUpstreamFailure 는 caller 가 fallback 시도 여부를 판단할 때 사용.
func IsUpstreamFailure(err error) bool {
	var ue *UpstreamError
	return errors.As(err, &ue)
}

// rewriteModelInBody 는 JSON body 의 최상위 "model" 키만 새 값으로 갈아끼운다.
// 나머지 필드 (messages, stream, …) 는 그대로 두며, 키 순서는 보장하지 않는다.
// 파싱 실패 시 (ok=false, body unchanged) — caller 가 원본 그대로 보내도록 한다.
func rewriteModelInBody(body []byte, newModel string) ([]byte, bool) {
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil {
		return body, false
	}
	if _, hasModel := obj["model"]; !hasModel {
		return body, false
	}
	obj["model"] = newModel
	out, err := json.Marshal(obj)
	if err != nil {
		return body, false
	}
	return out, true
}
