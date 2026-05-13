import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const oauthProviders = [
  {
    id: "google",
    label: "Continue with Google",
    className: "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    className: "bg-gray-800 text-white hover:bg-gray-700 border border-gray-700",
  },
  {
    id: "kakao",
    label: "Continue with Kakao",
    className: "bg-yellow-400 text-gray-900 hover:bg-yellow-300 border border-yellow-400",
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") ? "OAuth sign-in failed. Please try again." : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Forgenta</h1>
          <p className="text-sm text-gray-400">Sign in to your account</p>
        </div>

        <div className="space-y-2">
          {oauthProviders.map((p) => (
            <a
              key={p.id}
              href={`/api/auth/oauth/${p.id}`}
              className={`flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${p.className}`}
            >
              {p.label}
            </a>
          ))}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-950 px-3 text-xs text-gray-500">or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          No account?{" "}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
