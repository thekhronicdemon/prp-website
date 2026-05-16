import { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";

import { supabase } from "./supabaseClient";

const SITE_URL = "https://thekhronicdemon.github.io/prp-website";

function App() {
  const SERVER_IP = "localhost:30120";

  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");

  const [adminStats, setAdminStats] = useState({
    active_users: 0,
    tickets: 0,
    revenue: 0,
    server_status: "Offline",
  });

  async function checkAdmin(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    setIsAdmin(data?.role === "admin");
  }

  async function handleSignup() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SITE_URL,
        data: { username },
      },
    });

    setMessage(error ? error.message : "Check email verification");
  }

  async function handleLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setUser(data.user);
    await checkAdmin(data.user.id);
    setMessage("Logged in");
  }

  async function handleForgotPassword() {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: SITE_URL,
    });

    setMessage(error ? error.message : "Reset email sent");
  }

  async function handleLogout() {
    setUser(null);
    setIsAdmin(false);
    setEmail("");
    setPassword("");
    setUsername("");
    setMessage("Logged out.");

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.log("Logout error:", error);
    }

    window.location.href = `${import.meta.env.BASE_URL}#/account`;
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();

    if (authMode === "login") return handleLogin();
    if (authMode === "signup") return handleSignup();

    return handleForgotPassword();
  }

  async function loadAdminStats() {
    const { data } = await supabase
      .from("admin_stats")
      .select("active_users,tickets,revenue,server_status")
      .eq("id", 1)
      .single();

    if (data) setAdminStats(data);
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user ?? null);

      if (user) {
        await checkAdmin(user.id);
      }

      loadAdminStats();
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await checkAdmin(currentUser.id);
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const openFiveM = () => {
    window.location.href = `fivem://connect/${SERVER_IP}`;
  };

  function HomePage() {
    return (
      <section className="hero">
        <div>
          <p className="pill">BETA OPENING SOON</p>

          <h1>
            Build your story in
            <span> Progression RP</span>
          </h1>

          <p className="lead">
            A serious but enjoyable FiveM roleplay city built around progression.
          </p>

          <div className="actions">
            <button className="btn primary" onClick={openFiveM}>
              Join FiveM
            </button>

            <a className="btn" href="https://discord.gg/Vt4R9pWg2Z">
              Discord
            </a>
          </div>
        </div>

        <div className="logoCard">
          <div className="features">
            <b>Custom Jobs</b>
            <b>Active Staff</b>
            <b>Balanced Economy</b>
            <b>Community Driven</b>
          </div>
        </div>
      </section>
    );
  }

  function ShopPage() {
    return (
      <section className="section">
        <p className="eyebrow">SUPPORT THE CITY</p>

        <h2>Server Priority Shop</h2>

        <p className="sectionText">
          Support the server and receive queue priority.
        </p>

        <div className="cards">
          <div className="card">
            <h3>Priority Bronze</h3>

            <p className="price">
              $10 <small>/ monthly</small>
            </p>

            <ul>
              <li>Basic queue priority</li>
              <li>Discord role</li>
              <li>Supporter badge</li>
            </ul>

            <a href="YOUR_TEBEX_BRONZE" target="_blank" rel="noreferrer">
              <button type="button">Purchase</button>
            </a>
          </div>

          <div className="card popular">
            <em>Popular</em>

            <h3>Priority Gold</h3>

            <p className="price">
              $20 <small>/ monthly</small>
            </p>

            <ul>
              <li>Higher queue priority</li>
              <li>Exclusive role</li>
              <li>Supporter chat</li>
            </ul>

            <a href="YOUR_TEBEX_GOLD" target="_blank" rel="noreferrer">
              <button type="button">Purchase</button>
            </a>
          </div>

          <div className="card">
            <h3>Priority Platinum</h3>

            <p className="price">
              $50 <small>/ monthly</small>
            </p>

            <ul>
              <li>Highest priority</li>
              <li>Elite role</li>
              <li>Priority support</li>
            </ul>

            <a href="YOUR_TEBEX_PLATINUM" target="_blank" rel="noreferrer">
              <button type="button">Purchase</button>
            </a>
          </div>
        </div>
      </section>
    );
  }

  function AccountPage() {
    return (
      <section className="auth">
        <div className="authCard">
          <h2>{user ? "Your Account" : "Account Access"}</h2>

          {!user ? (
            <>
              <div className="tabs">
                <button
                  type="button"
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>

                <button
                  type="button"
                  className={authMode === "signup" ? "active" : ""}
                  onClick={() => setAuthMode("signup")}
                >
                  Signup
                </button>

                <button
                  type="button"
                  className={authMode === "forgot" ? "active" : ""}
                  onClick={() => setAuthMode("forgot")}
                >
                  Forgot
                </button>
              </div>

              <form onSubmit={handleAuthSubmit}>
                {authMode === "signup" && (
                  <input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                {authMode !== "forgot" && (
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}

                <button className="primaryBtn" type="submit">
                  {authMode === "login"
                    ? "Login"
                    : authMode === "signup"
                    ? "Create Account"
                    : "Reset Password"}
                </button>
              </form>
            </>
          ) : (
            <div className="loggedIn">
              <strong>{user.email}</strong>

              <button
                type="button"
                className="primaryBtn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}

          <p className="message">{message}</p>
        </div>
      </section>
    );
  }

  function AdminPage() {
    if (!isAdmin) {
      return <Navigate to="/account" replace />;
    }

    return (
      <section className="section">
        <p className="eyebrow">ADMIN ACCESS</p>

        <h2>Website Control Panel</h2>

        <div className="adminGrid">
          <div>
            <span>Users</span>
            <b>{adminStats.active_users}</b>
          </div>

          <div>
            <span>Tickets</span>
            <b>{adminStats.tickets}</b>
          </div>

          <div>
            <span>Revenue</span>
            <b>${adminStats.revenue}</b>
          </div>

          <div>
            <span>Status</span>
            <b>{adminStats.server_status}</b>
          </div>
        </div>
      </section>
    );
  }

  return (
    <HashRouter>
      <div className="site">
        <div className="bgGlow one"></div>
        <div className="bgGlow two"></div>

        <header className="nav">
          <Link className="brand" to="/">
            <img
              src={`${import.meta.env.BASE_URL}assets/logo.png`}
              alt="logo"
            />

            <div>
              <strong>Progression</strong>
              <span>Roleplay</span>
            </div>
          </Link>

          <nav>
            <Link to="/">Home</Link>
            <Link to="/shop">Shop</Link>
            <Link to="/account">Account</Link>

            {isAdmin && <Link to="/admin">Admin</Link>}
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>

        <footer>© Progression RP</footer>
      </div>
    </HashRouter>
  );
}

export default App;