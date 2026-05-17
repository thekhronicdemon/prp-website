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
const SERVER_IP = "localhost:30120";

function App() {
  const [authMode, setAuthMode] = useState("login");

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [username, setUsername] = useState("");
  const [editMode, setEditMode] = useState(null);

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

  async function loadProfile(authUserOrId) {
    const userId =
      typeof authUserOrId === "string"
        ? authUserOrId
        : authUserOrId?.id;

    const userEmail =
      typeof authUserOrId === "string"
        ? user?.email
        : authUserOrId?.email;

    if (!userId && !userEmail) return null;

    let query = supabase.from("profiles").select("*");

    const { data, error } = userId
      ? await query.eq("id", userId).maybeSingle()
      : await query.eq("email", userEmail).maybeSingle();

    if (error) {
      console.log("PROFILE ERROR:", error);
      setMessage(error.message);
      return null;
    }

    if (!data) {
      setProfile(null);
      return null;
    }

    setProfile(data);
    setIsAdmin(data.role === "admin");

    return data;
  }

  async function createProfileIfMissing(authUser, fallbackUsername = "") {
    const cleanUsername =
      fallbackUsername?.trim() ||
      authUser.user_metadata?.username ||
      authUser.email?.split("@")[0] ||
      "User";

    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (checkError) {
      console.log("Profile check error:", checkError);
      setMessage(checkError.message);
      return;
    }

    if (!existingProfile) {
      const { error } = await supabase.from("profiles").insert({
        id: authUser.id,
        email: authUser.email,
        username: cleanUsername,
        role: "user",
        subscription: "none",
      });

      if (error) {
        console.log("Profile create error:", error);
        setMessage(error.message);
        return;
      }
    }

    await loadProfile(authUser.id);
  }

  async function handleSignup() {
    setMessage("");

    if (username.trim().length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SITE_URL,
        data: {
          username: username.trim(),
        },
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
    setMessage("");

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

    setEmail("");
    setPassword("");

    setMessage("Logged in");
  }

  async function handleForgotPassword() {
    setMessage("");

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
    setConfirmEmail("");
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setEditMode(null);

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
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setEditMode(null);

    setMessage("Password changed.");
  }

  async function changeEmail() {
    setMessage("");

    if (!email || !confirmEmail) {
      setMessage("Enter and confirm your new email.");
      return;
    }

    if (email !== confirmEmail) {
      setMessage("Emails do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      email,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setEmail("");
    setConfirmEmail("");
    setEditMode(null);

    setMessage("Email change requested. Check your inbox.");
  }

  async function changeUsername() {
    setMessage("");

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setMessage("Enter a username.");
      return;
    }

    if (cleanUsername.length < 3) {
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

    const { data, error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        username_last_changed_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("Username update error:", error);
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("No profile row updated. Check your profile ID.");
      return;
    }

    setProfile(data);
    setUsername("");
    setEditMode(null);

    setMessage("Username updated successfully.");
  }

  async function loadAdminStats() {
    const { data } = await supabase
      .from("admin_stats")
      .select("active_users,tickets,revenue,server_status")
      .eq("id", 1)
      .maybeSingle();

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
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      setUser(user);

      if (user) {
        await createProfileIfMissing(user);
        await loadProfile(user);
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
          await loadProfile(currentUser);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      }
    );

    const focusRefresh = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (user) {
        await loadProfile(user);
        await loadAdminStats();
        await loadEvents();
      }
    };

    window.addEventListener("focus", focusRefresh);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", focusRefresh);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    loadProfile(user);

    const channel = supabase
      .channel(`profile-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("LIVE PROFILE UPDATE:", payload);

          if (payload.new) {
            setProfile(payload.new);
            setIsAdmin(payload.new.role === "admin");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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

    if (!profile?.subscription_expires_at) {
      return labelMap[sub] || "No Subscription";
    }

    const end = new Date(profile.subscription_expires_at);

    const days = Math.max(
      0,
      Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    return `${labelMap[sub]} - ${days} days left`;
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
            <Link to="/about">About</Link>
            <Link to="/shop">Shop</Link>
            <Link to="/account">{user ? "Account" : "Login / Sign Up"}</Link>
            {isAdmin && <Link to="/admin">Admin</Link>}
          </nav>
        </header>

        <main>
          <Routes>
            <Route
              path="/"
              element={<HomePage events={events} openFiveM={openFiveM} />}
            />

            <Route path="/about" element={<AboutPage />} />

            <Route path="/shop" element={<ShopPage />} />

            <Route
              path="/account"
              element={
                <AccountPage
                  user={user}
                  profile={profile}
                  authMode={authMode}
                  setAuthMode={setAuthMode}
                  email={email}
                  setEmail={setEmail}
                  confirmEmail={confirmEmail}
                  setConfirmEmail={setConfirmEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  username={username}
                  setUsername={setUsername}
                  editMode={editMode}
                  setEditMode={setEditMode}
                  message={message}
                  setMessage={setMessage}
                  handleAuthSubmit={handleAuthSubmit}
                  handleLogout={handleLogout}
                  changeUsername={changeUsername}
                  changeEmail={changeEmail}
                  changePassword={changePassword}
                  getSubLabel={getSubLabel}
                />
              }
            />

            <Route
              path="/admin"
              element={
                <AdminPage isAdmin={isAdmin} adminStats={adminStats} />
              }
            />
          </Routes>
        </main>

        <footer>© Progression RP</footer>
      </div>
    </HashRouter>
  );
}

function HomePage({ events, openFiveM }) {
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
              <p>
                Check back soon for community nights, openings, and special
                events.
              </p>
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
        story, grow their character, and be part of something that develops over
        time.
      </p>

      <div className="aboutGrid">
        <div>
          <h3>Progression Focused</h3>
          <p>
            Earn your place, build your character, and grow through real
            roleplay.
          </p>
        </div>

        <div>
          <h3>Community Driven</h3>
          <p>
            Feedback, criticism, and ideas help shape the city during beta and
            beyond.
          </p>
        </div>

        <div>
          <h3>Balanced Roleplay</h3>
          <p>
            Jobs, economy, gangs, businesses, and services are built to feel
            rewarding.
          </p>
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

function AccountPage({
  user,
  profile,
  authMode,
  setAuthMode,
  email,
  setEmail,
  confirmEmail,
  setConfirmEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  username,
  setUsername,
  editMode,
  setEditMode,
  message,
  setMessage,
  handleAuthSubmit,
  handleLogout,
  changeUsername,
  changeEmail,
  changePassword,
  getSubLabel,
}) {
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
                  type="text"
                  autoComplete="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              )}

              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {authMode !== "forgot" && (
                <input
                  type="password"
                  autoComplete={
                    authMode === "signup" ? "new-password" : "current-password"
                  }
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
                <strong>{profile?.username || "Loading..."}</strong>
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
              <button
                type="button"
                className="primaryBtn"
                onClick={() => {
                  setEditMode(editMode === "username" ? null : "username");
                  setUsername("");
                  setMessage("");
                }}
              >
                Change Username
              </button>

              {editMode === "username" && (
                <>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="New username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />

                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={changeUsername}
                  >
                    Confirm Username
                  </button>
                </>
              )}

              <button
                type="button"
                className="primaryBtn"
                onClick={() => {
                  setEditMode(editMode === "email" ? null : "email");
                  setEmail("");
                  setConfirmEmail("");
                  setMessage("");
                }}
              >
                Change Email
              </button>

              {editMode === "email" && (
                <>
                  <input
                    type="email"
                    autoComplete="off"
                    placeholder="New email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <input
                    type="email"
                    autoComplete="off"
                    placeholder="Confirm new email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                  />

                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={changeEmail}
                  >
                    Confirm Email
                  </button>
                </>
              )}

              <button
                type="button"
                className="primaryBtn"
                onClick={() => {
                  setEditMode(editMode === "password" ? null : "password");
                  setPassword("");
                  setConfirmPassword("");
                  setMessage("");
                }}
              >
                Change Password
              </button>

              {editMode === "password" && (
                <>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />

                  <button
                    type="button"
                    className="primaryBtn"
                    onClick={changePassword}
                  >
                    Confirm Password
                  </button>
                </>
              )}

              <button
                type="button"
                className="primaryBtn"
                onClick={handleLogout}
              >
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

function AdminPage({ isAdmin, adminStats }) {
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

export default App;