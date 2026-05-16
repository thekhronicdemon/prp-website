import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const SITE_URL = "https://thekhronicdemon.github.io/prp-website";

function App() {
  const [serverIp, setServerIp] = useState("YOUR_SERVER_IP:30120");
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const [adminStats, setAdminStats] = useState({
    active_users: 0,
    tickets: 0,
    revenue: 0,
    server_status: "Offline",
  });

  async function handleSignup() {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SITE_URL,
        data: {
          username,
        },
      },
    });

    setMessage(error ? error.message : "Signup successful. Check your email to verify your account.");
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
    setMessage("Logged in successfully.");
  }

  async function handleForgotPassword() {
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: SITE_URL,
    });

    setMessage(error ? error.message : "Password reset email sent.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setMessage("Logged out.");
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();

    if (authMode === "login") return handleLogin();
    if (authMode === "signup") return handleSignup();
    return handleForgotPassword();
  }

  async function loadAdminStats() {
    const { data, error } = await supabase
      .from("admin_stats")
      .select("active_users, tickets, revenue, server_status")
      .eq("id", 1)
      .single();

    if (!error && data) {
      setAdminStats(data);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    loadAdminStats();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const openFiveM = () => {
    window.location.href = `fivem://connect/${serverIp}`;
  };

  const purchase = (plan) => {
    alert(`${plan} selected. Connect this button to Tebex or Stripe Checkout.`);
  };

  return (
    <div className="site">
      <div className="bgGlow one"></div>
      <div className="bgGlow two"></div>

      <header className="nav">
        <a className="brand" href="#home">
          <img src="/assets/logo.png" alt="Progression RP Logo" />
          <div>
            <strong>PROGRESSION RP</strong>
            <span>FiveM Roleplay</span>
          </div>
        </a>

        <nav>
          <a href="#home">Home</a>
          <a href="#shop">Shop</a>
          <a href="#join">Join</a>
          <a href="#account">Account</a>
          <a href="#admin">Admin</a>
        </nav>
      </header>

      <main>
        <section id="home" className="hero">
          <div className="heroText">
            <p className="pill">BETA OPENING SOON</p>
            <h1>
              Build your story in <span>Progression RP</span>.
            </h1>
            <p className="lead">
              A serious but enjoyable FiveM roleplay city built around progression,
              community feedback, quality systems, and long-term growth.
            </p>

            <div className="actions">
              <button className="btn primary" onClick={openFiveM}>Join FiveM Server</button>
              <a className="btn" href="https://discord.gg/" target="_blank" rel="noreferrer">Join Discord</a>
            </div>
          </div>

          <div className="logoCard">
            <img src="/assets/logo.png" alt="PRP Logo" />
            <div className="features">
              <b>Custom Jobs</b>
              <b>Active Staff</b>
              <b>Balanced Economy</b>
              <b>Community Driven</b>
            </div>
          </div>
        </section>

        <section id="shop" className="section">
          <p className="eyebrow">SUPPORT THE CITY</p>
          <h2>Server Priority Shop</h2>
          <p className="sectionText">
            Support the server and get monthly queue priority. Payments should be handled through Tebex or Stripe.
          </p>

          <div className="cards">
            <div className="card">
              <h3>Priority Bronze</h3>
              <p className="price">$10 <small>/ monthly</small></p>
              <ul>
                <li>Basic queue priority</li>
                <li>Discord supporter role</li>
                <li>Monthly supporter badge</li>
              </ul>
              <button onClick={() => purchase("Priority Bronze")}>Purchase</button>
            </div>

            <div className="card popular">
              <em>Popular</em>
              <h3>Priority Gold</h3>
              <p className="price">$20 <small>/ monthly</small></p>
              <ul>
                <li>Higher queue priority</li>
                <li>Exclusive Discord role</li>
                <li>Supporter chat access</li>
              </ul>
              <button onClick={() => purchase("Priority Gold")}>Purchase</button>
            </div>

            <div className="card">
              <h3>Priority Elite</h3>
              <p className="price">$50 <small>/ monthly</small></p>
              <ul>
                <li>Top queue priority</li>
                <li>Elite Discord role</li>
                <li>Priority support ticket handling</li>
              </ul>
              <button onClick={() => purchase("Priority Elite")}>Purchase</button>
            </div>
          </div>
        </section>

        <section id="join" className="panel split">
          <div>
            <p className="eyebrow">CONNECT</p>
            <h2>Direct FiveM Join Link</h2>
            <p>Enter your real FiveM endpoint below, then players can open FiveM directly from the website.</p>
          </div>

          <div className="joinBox">
            <input value={serverIp} onChange={(e) => setServerIp(e.target.value)} />
            <button className="btn primary" onClick={openFiveM}>Open FiveM</button>
          </div>
        </section>

        <section id="account" className="auth">
          <div className="authCard">
            <p className="eyebrow">ACCOUNT</p>
            <h2>{user ? "Your Account" : "Account Access"}</h2>

            {!user ? (
              <>
                <div className="tabs">
                  <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Login</button>
                  <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Signup</button>
                  <button className={authMode === "forgot" ? "active" : ""} onClick={() => setAuthMode("forgot")}>Forgot</button>
                </div>

                <form onSubmit={handleAuthSubmit}>
                  {authMode === "signup" && (
                    <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  )}

                  <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />

                  {authMode !== "forgot" && (
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  )}

                  <button className="primaryBtn" type="submit">
                    {authMode === "login" ? "Login" : authMode === "signup" ? "Create Account" : "Send Reset Email"}
                  </button>
                </form>
              </>
            ) : (
              <div className="loggedIn">
                <p>Logged in as:</p>
                <strong>{user.email}</strong>
                <button className="primaryBtn" onClick={handleLogout}>Logout</button>
              </div>
            )}

            {message && <p className="message">{message}</p>}
          </div>
        </section>

        <section id="admin" className="section">
          <p className="eyebrow">ADMIN ACCESS</p>
          <h2>Website Control Panel</h2>

          <div className="adminGrid">
            <div>
              <span>Active Users</span>
              <b>{adminStats.active_users}</b>
            </div>
            <div>
              <span>Pending Tickets</span>
              <b>{adminStats.tickets}</b>
            </div>
            <div>
              <span>Monthly Revenue</span>
              <b>${adminStats.revenue}</b>
            </div>
            <div>
              <span>Server Status</span>
              <b>{adminStats.server_status}</b>
            </div>
          </div>
        </section>
      </main>

      <footer>
        © Progression RP. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
