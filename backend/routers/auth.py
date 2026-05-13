"""Auth router: email/password login + OAuth 2 (Google, GitHub, Kakao)."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from backend.config import settings
from backend.dependencies import require_auth
from backend.services import auth as auth_svc

router = APIRouter(prefix="/api/auth", tags=["auth"])

_OAUTH = {
    "google": {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
    "github": {
        "client_id": settings.github_client_id,
        "client_secret": settings.github_client_secret,
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
    },
    "kakao": {
        "client_id": settings.kakao_client_id,
        "client_secret": settings.kakao_client_secret,
        "auth_url": "https://kauth.kakao.com/oauth/authorize",
        "token_url": "https://kauth.kakao.com/oauth/token",
        "userinfo_url": "https://kapi.kakao.com/v2/user/me",
        "scope": "profile_nickname account_email",
    },
}


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _callback_url(request: Request, provider: str) -> str:
    base = settings.api_base_url or str(request.base_url).rstrip("/")
    return f"{base}/api/auth/oauth/{provider}/callback"


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    if auth_svc.get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = auth_svc.create_user(req.email, req.name, "email", req.password)
    token = auth_svc.create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "provider": user.provider},
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = auth_svc.get_user_by_email(req.email)
    if not user or not user.hashed_password or not auth_svc.verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = auth_svc.create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "provider": user.provider},
    )


@router.get("/me")
async def me(user=Depends(require_auth)):
    return {"id": user.id, "email": user.email, "name": user.name, "provider": user.provider}


@router.get("/oauth/{provider}")
async def oauth_redirect(provider: str, request: Request):
    cfg = _OAUTH.get(provider)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")
    if not cfg["client_id"]:
        raise HTTPException(status_code=503, detail=f"{provider} OAuth not configured — set {provider.upper()}_CLIENT_ID env var")
    callback = _callback_url(request, provider)
    url = (
        f"{cfg['auth_url']}"
        f"?client_id={cfg['client_id']}"
        f"&redirect_uri={callback}"
        f"&response_type=code"
        f"&scope={cfg['scope']}"
    )
    return RedirectResponse(url=url)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, code: str, request: Request):
    cfg = _OAUTH.get(provider)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")

    callback = _callback_url(request, provider)
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            cfg["token_url"],
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "redirect_uri": callback,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        token_json = token_resp.json()
        provider_token = token_json.get("access_token")
        if not provider_token:
            return RedirectResponse(f"{settings.frontend_url}/login?error=oauth_failed")

        info_resp = await client.get(
            cfg["userinfo_url"],
            headers={"Authorization": f"Bearer {provider_token}", "Accept": "application/json"},
        )
        info = info_resp.json()

    if provider == "google":
        email = info.get("email", "")
        name = info.get("name", email)
    elif provider == "github":
        email = info.get("email") or f"{info.get('login', 'user')}@github.local"
        name = info.get("name") or info.get("login", "GitHub User")
    elif provider == "kakao":
        kakao_account = info.get("kakao_account", {})
        email = kakao_account.get("email", f"kakao_{info.get('id', 'user')}@kakao.local")
        name = info.get("properties", {}).get("nickname", "Kakao User")
    else:
        return RedirectResponse(f"{settings.frontend_url}/login?error=unknown_provider")

    if not email:
        return RedirectResponse(f"{settings.frontend_url}/login?error=no_email")

    user = auth_svc.get_user_by_email(email) or auth_svc.create_user(email, name, provider)
    jwt_token = auth_svc.create_access_token(user.id)
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={jwt_token}")
