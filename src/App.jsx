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
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");

  const [adminStats, setAdminStats] = useState({
    active_users: 0,
    tickets: 0,
    revenue: 0,
    server_status: "Offline",
  });

  async function loadProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(data);
    setIsAdmin(data?.role === "admin");
  }

  async function createProfileIfMissing(authUser, fallbackUsername = "") {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!data) {
      await supabase.from("profiles").insert({
        id: authUser.id,
        email: authUser.email,
        username: fallbackUsername || authUser.email?.split("@")[0],
        role: "user",
        subscription: "none",
      });
    }

    await loadProfile(authUser.id);
  }

  async function handleSignup() {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SITE_URL,
        data: { username },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.user) {
      await createProfileIfMissing(data.user, username);
    }

    setMessage("Check email verification");
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
    await createProfileIfMissing(data.user);
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
    setProfile(null);
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

  async function changePassword() {
    if (!password || password.length < 6) {
      setMessage("Enter a new password with at least 6 characters.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setMessage(error ? error.message : "Password changed.");
    setPassword("");
  }

  async function changeEmail() {
    if (!email) {
      setMessage("Enter a new email first.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      email,
    });

    setMessage(error ? error.message : "Email change requested. Check your inbox.");
  }

  async function changeUsername() {
    if (!username || username.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    const lastChanged = profile?.username_last_changed_at
      ? new Date(profile.username_last_changed_at)
      : null;

    if (lastChanged) {
      const daysPassed = Math.floor(
        (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysPassed < 30) {
        setMessage(`Username can be changed again in ${30 - daysPassed} days.`);
        return;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        username_last_changed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadProfile(user.id);
    setMessage("Username changed.");
  }

  async function loadAdminStats() {
    const { data } = await supabase
      .from("admin_stats")
      .select("active_users,tickets,revenue,server_status")
      .eq("id", 1)
      .single();

    if (data) setAdminStats(data);
  }

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("event_date", { ascending: true })
      .limit(3);

    if (data) setEvents(data);
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user ?? null);

      if (user) {
        await createProfileIfMissing(user);
      }

      loadAdminStats();
      loadEvents();
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await createProfileIfMissing(currentUser);
        } else {
          setProfile(null);
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

  function getSubLabel() {
    const sub = profile?.subscription || "none";

    if (sub === "none") return "No Subscription";

    const labelMap = {
      bronze: "Bronze Priority",
      gold: "Gold Priority",
      platinum: "Platinum Priority",
    };

    if (!profile?.subscription_expires_at) return labelMap[sub] || "No Subscription";

    const end = new Date(profile.subscription_expires_at);
    const days = Math.max(
      0,
      Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    return `${labelMap[sub]} - ${days} days left`;
  }

  function HomePage() {
    return (
      <>
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

        <section className="section">
          <p className="eyebrow">UPCOMING EVENTS</p>
          <h2>City Events</h2>

          <div className="eventList">
            {events.length === 0 ? (
              <div className="eventBubble">
                <strong>No events posted yet.</strong>
                <p>Check back soon for community nights, openings, and special events.</p>
              </div>
            ) : (
              events.map((event) => (
                <div className="eventBubble" key={event.id}>
                  <strong>{event.title}</strong>
                  <p>{event.description}</p>
                  <span>{new Date(event.event_date).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </>
    );
  }

  function AboutPage() {
    return (
      <section className="section">
        <p className="eyebrow">ABOUT THE CITY</p>

        <h2>Progression Roleplay</h2>

        <p className="sectionText">
          Progression Roleplay is a FiveM roleplay community focused on long-term
          character progression, balanced systems, serious roleplay, and community
          feedback. Our goal is to build a city where every player can create a
          story, grow their character, and be part of something that develops over time.
        </p>

        <div className="aboutGrid">
          <div>
            <h3>Progression Focused</h3>
            <p>Earn your place, build your character, and grow through real roleplay.</p>
          </div>

          <div>
            <h3>Community Driven</h3>
            <p>Feedback, criticism, and ideas help shape the city during beta and beyond.</p>
          </div>

          <div>
            <h3>Balanced Roleplay</h3>
            <p>Jobs, economy, gangs, businesses, and services are built to feel rewarding.</p>
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
        <div className="authCard accountWide">
          <h2>{user ? "Account" : "Login / Sign Up"}</h2>

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
            <div className="accountPanel">
              <div className="accountInfo">
                <div>
                  <span>Username</span>
                  <strong>{profile?.username || "Not set"}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>

                <div>
                  <span>Active Subscription</span>
                  <strong className={`subBadge ${profile?.subscription || "none"}`}>
                    {getSubLabel()}
                  </strong>
                </div>
              </div>

              <div className="accountActions">
                <input
                  placeholder="New username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />

                <button type="button" className="primaryBtn" onClick={changeUsername}>
                  Change Username
                </button>

                <input
                  placeholder="New email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <button type="button" className="primaryBtn" onClick={changeEmail}>
                  Change Email
                </button>

                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button type="button" className="primaryBtn" onClick={changePassword}>
                  Change Password
                </button>

                <button type="button" className="primaryBtn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          )}

          <p className="message">{message}</p>
        </div>
      </section>
    );
  }

  function AdminPage() {
    if (!isAdmin) return <Navigate to="/account" replace />;

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
            <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="logo" />

            <div>
              <strong>Progression</strong>
              <span>Roleplay</span>
            </div>
          </Link>

          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/shop">Shop</Link>
            <Link to="/account">{user ? "Account" : "Login / Sign Up"}</Link>
            {isAdmin && <Link to="/admin">Admin</Link>}
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
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