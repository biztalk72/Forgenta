module github.com/forgenta/api-gateway

go 1.26

require (
	github.com/forgenta/shared v0.0.0
	golang.org/x/time v0.15.0
)

require github.com/golang-jwt/jwt/v5 v5.3.1 // indirect

replace github.com/forgenta/shared => ../shared
