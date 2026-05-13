import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const { handleOAuthCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    const error = params.get("error");
    if (token) {
      handleOAuthCallback(token).then(() => {
        navigate("/dashboard", { replace: true });
      });
    } else {
      navigate(`/login?error=${error || "oauth_failed"}`, { replace: true });
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400 text-sm">
      Completing sign in…
    </div>
  );
}
