// Prometheus 메트릭 — 백엔드별 RPS/지연/폴백.
package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_gateway_requests_total",
			Help: "Total requests routed by inference-gateway.",
		},
		[]string{"backend", "model", "status"},
	)
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "inference_gateway_request_duration_seconds",
			Help:    "End-to-end request duration by backend.",
			Buckets: prometheus.ExponentialBuckets(0.05, 2, 12),
		},
		[]string{"backend", "model"},
	)
	fallbackTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_gateway_fallback_total",
			Help: "Fallback occurrences by primary→secondary backend.",
		},
		[]string{"primary", "fallback"},
	)
	routeDecisions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "inference_gateway_route_decisions_total",
			Help: "Routing decisions by model→backend.",
		},
		[]string{"model", "backend"},
	)
)

func init() {
	prometheus.MustRegister(requestsTotal, requestDuration, fallbackTotal, routeDecisions)
}

func IncRequest(backend, model, status string) {
	requestsTotal.WithLabelValues(backend, model, status).Inc()
}

func ObserveDuration(backend, model string, seconds float64) {
	requestDuration.WithLabelValues(backend, model).Observe(seconds)
}

func IncFallback(primary, fallback string) {
	fallbackTotal.WithLabelValues(primary, fallback).Inc()
}

func IncRouteDecision(model, backend string) {
	routeDecisions.WithLabelValues(model, backend).Inc()
}

func Handler() http.Handler { return promhttp.Handler() }
