import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function getRedirectPath(user) {
  if (!user?.account_type) {
    return "/choose-role";
  }
  return user.account_type === "Business" ? "/business/dashboard" : "/customer/home";
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (isSignup && !form.name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setLoading(true);
      const response = isSignup ? await signup(form) : await login(form);
      navigate(getRedirectPath(response.data.user));
    } catch (apiError) {
      if (isSignup && apiError.requiresLogin) {
        navigate("/login", {
          replace: true,
          state: { message: "Account created successfully. Please log in to continue." },
        });
        return;
      }
      setError(apiError.errors?.[0] || apiError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-center auth-screen">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">{isSignup ? "Create your account" : "Welcome back"}</p>
        <h1>{isSignup ? "Signup" : "Login"}</h1>

        {isSignup ? (
          <label className="field">
            <span>Name</span>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
        </label>

        {isSignup ? (
          <label className="field">
            <span>Phone</span>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="7000000000" />
          </label>
        ) : null}

        <label className="field">
          <span>Password</span>
          <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="At least 6 characters" />
        </label>

        {error ? <div className="alert error">{error}</div> : null}
        {location.state?.message ? <div className="alert success">{location.state.message}</div> : null}

        <button className="button" type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignup ? "Create account" : "Login"}
        </button>

        <p className="muted">
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Login" : "Signup"}</Link>
        </p>
      </form>
    </div>
  );
}
