import { useEffect, useRef, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";

import { supabase } from "./supabaseClient";

const SITE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL}`
    : "https://thekhronicdemon.github.io/prp-website/";
const SERVER_IP = "localhost:30120";
const SUBSCRIPTIONS = {
  bronze: {
    label: "Bronze Priority",
    shortLabel: "Bronze",
    image: "bronze_package.png",
  },
  gold: {
    label: "Gold Priority",
    shortLabel: "Gold",
    image: "gold_package.png",
  },
  platinum: {
    label: "Platinum Priority",
    shortLabel: "Platinum",
    image: "platinum_package.png",
  },
};

const SHOP_TIERS = [
  {
    key: "bronze",
    title: "Priority Bronze",
    price: "$10",
    href: "YOUR_TEBEX_BRONZE",
    features: [
      "+10 Queue Priority",
      "Bronze member badge on Discord & Progression website",
    ],
  },
  {
    key: "gold",
    title: "Priority Gold",
    price: "$20",
    href: "YOUR_TEBEX_GOLD",
    popular: true,
    features: [
      "+20 Queue Priority",
      "Gold member badge on Discord & Progression website",
      "Supporter Access to Discord Channel",
    ],
  },
  {
    key: "platinum",
    title: "Priority Platinum",
    price: "$50",
    href: "YOUR_TEBEX_PLATINUM",
    features: [
      "+50 Queue Priority",
      "Platinum member badge on Discord & Progression website",
      "Priority on support",
    ],
  },
];

function assetUrl(fileName) {
  return `${import.meta.env.BASE_URL}assets/${fileName}`;
}

function getSubscriptionDetails(subscription, expiresAt) {
  const key = subscription || "none";
  const config = SUBSCRIPTIONS[key];

  if (!config) {
    return {
      key: "none",
      label: "No Subscription",
      shortLabel: "None",
      image: null,
    };
  }

  if (!expiresAt) {
    return {
      key,
      label: config.label,
      shortLabel: config.shortLabel,
      image: assetUrl(config.image),
    };
  }

  const end = new Date(expiresAt);
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return {
    key,
    label: `${config.label} - ${days} days left`,
    shortLabel: config.shortLabel,
    image: assetUrl(config.image),
  };
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

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
  const [profileLoading, setProfileLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const profileRequestId = useRef(0);

  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");

  const [adminStats, setAdminStats] = useState({
    active_users: 0,
    tickets: 0,
    revenue: 0,
    server_status: "Offline",
  });
  const [tickets, setTickets] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    body: "",
  });
  const [ticketReply, setTicketReply] = useState("");
  const [ticketNotice, setTicketNotice] = useState("");
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const activeTicketIdRef = useRef(null);

  function getUserLookup(authUserOrId) {
    const userId =
      typeof authUserOrId === "string"
        ? authUserOrId
        : authUserOrId?.id;

    const userEmail =
      typeof authUserOrId === "string"
        ? user?.email
        : authUserOrId?.email;

    return {
      userId: typeof userId === "string" ? userId : "",
      userEmail: typeof userEmail === "string" ? userEmail : "",
    };
  }

  async function fetchProfile(authUserOrId) {
    const { userId, userEmail } = getUserLookup(authUserOrId);

    if (!userId && !userEmail) return { data: null, error: null };

    if (userId) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (result.data || result.error || !userEmail) return result;
    }

    return supabase
      .from("profiles")
      .select("*")
      .eq("email", userEmail)
      .maybeSingle();
  }

  function applyProfile(nextProfile) {
    setProfile(nextProfile);
    setIsAdmin(nextProfile?.role === "admin");
  }

  async function loadProfile(authUserOrId) {
    const requestId = ++profileRequestId.current;

    setProfileLoading(true);

    try {
      const { data, error } = await fetchProfile(authUserOrId);

      if (requestId !== profileRequestId.current) return data ?? null;

      if (error) {
        console.log("PROFILE ERROR:", error);
        setMessage(error.message);
        return null;
      }

      applyProfile(data ?? null);

      return data ?? null;
    } finally {
      if (requestId === profileRequestId.current) {
        setProfileLoading(false);
      }
    }
  }

  async function createProfileIfMissing(authUser, fallbackUsername = "") {
    if (!authUser?.id) return null;

    const requestId = ++profileRequestId.current;

    setProfileLoading(true);

    const cleanUsername =
      fallbackUsername?.trim() ||
      authUser.user_metadata?.username?.trim() ||
      authUser.email?.split("@")[0] ||
      "User";

    try {
      const { data: existingProfile, error: checkError } =
        await fetchProfile(authUser);

      if (requestId !== profileRequestId.current) return existingProfile ?? null;

      if (checkError) {
        console.log("Profile check error:", checkError);
        setMessage(checkError.message);
        return null;
      }

      if (existingProfile) {
        applyProfile(existingProfile);
        return existingProfile;
      }

      const { data: createdProfile, error } = await supabase
        .from("profiles")
        .insert({
          id: authUser.id,
          email: authUser.email,
          username: cleanUsername,
          role: "user",
          subscription: "none",
        })
        .select("*")
        .maybeSingle();

      if (requestId !== profileRequestId.current) return createdProfile ?? null;

      if (error) {
        if (error.code === "23505") {
          return loadProfile(authUser);
        }

        console.log("Profile create error:", error);
        setMessage(error.message);
        return null;
      }

      applyProfile(createdProfile ?? null);

      return createdProfile ?? null;
    } finally {
      if (requestId === profileRequestId.current) {
        setProfileLoading(false);
      }
    }
  }

  async function syncAuthUser(authUser, fallbackUsername = "") {
    if (!authUser?.id) {
      profileRequestId.current += 1;
      setUser(null);
      applyProfile(null);
      setProfileLoading(false);
      setTickets([]);
      setActiveTicketId(null);
      setTicketMessages([]);
      return null;
    }

    setUser(authUser);
    return createProfileIfMissing(authUser, fallbackUsername);
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
      if (data.session) {
        await syncAuthUser(data.user, username);
      } else {
        await createProfileIfMissing(data.user, username);
      }
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

    await syncAuthUser(data.user);

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
    profileRequestId.current += 1;
    applyProfile(null);
    setProfileLoading(false);

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

  async function attachProfilesToTickets(ticketRows) {
    const userIds = [
      ...new Set(ticketRows.map((ticket) => ticket.user_id).filter(Boolean)),
    ];

    if (userIds.length === 0) return ticketRows;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,username,subscription,subscription_expires_at")
      .in("id", userIds);

    if (error) {
      console.log("Ticket profile lookup error:", error);
    }

    const profileMap = new Map((data || []).map((row) => [row.id, row]));

    if (profile?.id) profileMap.set(profile.id, profile);

    return ticketRows.map((ticket) => ({
      ...ticket,
      memberProfile: profileMap.get(ticket.user_id) || null,
    }));
  }

  async function loadTickets() {
    if (!user?.id) {
      setTickets([]);
      setActiveTicketId(null);
      return;
    }

    setTicketsLoading(true);

    let query = supabase
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    setTicketsLoading(false);

    if (error) {
      console.log("Ticket load error:", error);
      setTicketNotice(error.message);
      return;
    }

    const nextTickets = await attachProfilesToTickets(data || []);

    setTickets(nextTickets);

    if (isAdmin) {
      setAdminStats((stats) => ({
        ...stats,
        tickets: nextTickets.filter((ticket) => ticket.status === "open").length,
      }));
    }

    if (
      activeTicketIdRef.current &&
      nextTickets.some((ticket) => ticket.id === activeTicketIdRef.current)
    ) {
      return;
    }

    setActiveTicketId(nextTickets[0]?.id || null);
  }

  async function loadTicketMessages(ticketId) {
    if (!ticketId) {
      setTicketMessages([]);
      return;
    }

    const { data, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      console.log("Ticket messages load error:", error);
      setTicketNotice(error.message);
      return;
    }

    setTicketMessages(data || []);
  }

  async function createTicket(e) {
    e.preventDefault();
    setTicketNotice("");

    const subject = ticketForm.subject.trim();
    const body = ticketForm.body.trim();

    if (!user?.id) {
      setTicketNotice("Log in before creating a ticket.");
      return;
    }

    if (subject.length < 3 || body.length < 5) {
      setTicketNotice("Add a subject and a short message.");
      return;
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        user_id: user.id,
        subject,
        status: "open",
      })
      .select("*")
      .maybeSingle();

    if (ticketError) {
      console.log("Ticket create error:", ticketError);
      setTicketNotice(ticketError.message);
      return;
    }

    const { error: messageError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: "member",
        body,
      });

    if (messageError) {
      console.log("Ticket message create error:", messageError);
      setTicketNotice(messageError.message);
      return;
    }

    setTicketForm({ subject: "", body: "" });
    setActiveTicketId(ticket.id);
    setTicketNotice("Ticket created.");
    await loadTickets();
    await loadTicketMessages(ticket.id);
  }

  async function sendTicketMessage(ticketId) {
    setTicketNotice("");

    const body = ticketReply.trim();
    const activeTicket = tickets.find((ticket) => ticket.id === ticketId);

    if (!body) {
      setTicketNotice("Type a reply first.");
      return;
    }

    if (activeTicket?.status === "closed") {
      setTicketNotice("Open the ticket before replying.");
      return;
    }

    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_role: isAdmin ? "admin" : "member",
      body,
    });

    if (error) {
      console.log("Ticket reply error:", error);
      setTicketNotice(error.message);
      return;
    }

    setTicketReply("");
    await loadTickets();
    await loadTicketMessages(ticketId);
  }

  async function updateTicketStatus(ticketId, status) {
    setTicketNotice("");

    if (!isAdmin) return;

    const { error } = await supabase
      .from("tickets")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (error) {
      console.log("Ticket status error:", error);
      setTicketNotice(error.message);
      return;
    }

    setTicketNotice(`Ticket ${status}.`);
    await loadTickets();
  }

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await syncAuthUser(session?.user ?? null);

      loadAdminStats();
      loadEvents();
    }

    init();

    let authChangeTimer = null;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;

        const currentUser = session?.user ?? null;

        if (authChangeTimer) window.clearTimeout(authChangeTimer);

        authChangeTimer = window.setTimeout(() => {
          syncAuthUser(currentUser);
        }, 0);
      }
    );

    const focusRefresh = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (user) {
        setUser(user);
        await loadProfile(user);
        await loadAdminStats();
        await loadEvents();
      } else {
        await syncAuthUser(null);
      }
    };

    window.addEventListener("focus", focusRefresh);

    return () => {
      if (authChangeTimer) window.clearTimeout(authChangeTimer);
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", focusRefresh);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

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

  useEffect(() => {
    activeTicketIdRef.current = activeTicketId;
  }, [activeTicketId]);

  useEffect(() => {
    if (!user?.id) return;

    loadTickets();

    const channel = supabase
      .channel(`tickets-live-${user.id}-${isAdmin ? "admin" : "member"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
        },
        () => {
          loadTickets();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_messages",
        },
        (payload) => {
          const ticketId = payload.new?.ticket_id || payload.old?.ticket_id;

          loadTickets();

          if (ticketId && ticketId === activeTicketIdRef.current) {
            loadTicketMessages(ticketId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!activeTicketId) {
      setTicketMessages([]);
      return;
    }

    loadTicketMessages(activeTicketId);
  }, [activeTicketId]);

  const openFiveM = () => {
    window.location.href = `fivem://connect/${SERVER_IP}`;
  };

  const activeTicket =
    tickets.find((ticket) => ticket.id === activeTicketId) || null;

  const ticketProps = {
    user,
    profile,
    tickets,
    activeTicket,
    activeTicketId,
    setActiveTicketId,
    ticketMessages,
    ticketForm,
    setTicketForm,
    ticketReply,
    setTicketReply,
    ticketNotice,
    ticketsLoading,
    createTicket,
    sendTicketMessage,
    updateTicketStatus,
  };

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
                  profileLoading={profileLoading}
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
                  ticketProps={ticketProps}
                />
              }
            />

            <Route
              path="/admin"
              element={
                <AdminPage
                  isAdmin={isAdmin}
                  adminStats={adminStats}
                  ticketProps={ticketProps}
                />
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
        Support the Server and Play Faster.
      </p>

      <div className="cards">
        {SHOP_TIERS.map((tier) => {
          const subscription = SUBSCRIPTIONS[tier.key];

          return (
            <div
              className={`card shopCard ${tier.popular ? "popular" : ""}`}
              key={tier.key}
            >
              <div className="shopCardHeader">
                <h3>{tier.title}</h3>
                {tier.popular && <span className="popularBadge">Popular</span>}
              </div>

              <img
                className="tierImage"
                src={assetUrl(subscription.image)}
                alt={`${subscription.shortLabel} package`}
              />

              <p className="price">
                {tier.price} <small>/ monthly</small>
              </p>

              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <a href={tier.href} target="_blank" rel="noreferrer">
                <button type="button">Purchase</button>
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AccountPage({
  user,
  profile,
  profileLoading,
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
  ticketProps,
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
          <>
            <div className="accountPanel">
              <div className="accountInfo">
                <div>
                  <span>Username</span>
                  <strong>
                    {profileLoading ? "Loading..." : profile?.username || "Not set"}
                  </strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>

                <div>
                  <span>Active Subscription</span>
                  <SubscriptionBadge
                    subscription={profile?.subscription}
                    expiresAt={profile?.subscription_expires_at}
                    loading={profileLoading}
                  />
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

            <TicketWorkspace mode="member" {...ticketProps} />
          </>
        )}

        <p className="message">{message}</p>
      </div>
    </section>
  );
}

function SubscriptionBadge({
  subscription,
  expiresAt,
  loading = false,
  compact = false,
}) {
  const details = getSubscriptionDetails(subscription, expiresAt);

  if (loading) {
    return (
      <span className="subBadge none">
        <span>Loading...</span>
      </span>
    );
  }

  return (
    <span className={`subBadge ${details.key} ${compact ? "compact" : ""}`}>
      {details.image && (
        <img src={details.image} alt={`${details.shortLabel} subscription`} />
      )}
      <span>{compact ? details.shortLabel : details.label}</span>
    </span>
  );
}

function TicketWorkspace({
  mode,
  user,
  profile,
  tickets,
  activeTicket,
  activeTicketId,
  setActiveTicketId,
  ticketMessages,
  ticketForm,
  setTicketForm,
  ticketReply,
  setTicketReply,
  ticketNotice,
  ticketsLoading,
  createTicket,
  sendTicketMessage,
  updateTicketStatus,
}) {
  const isAdminMode = mode === "admin";
  const activeMember =
    activeTicket?.memberProfile ||
    (activeTicket?.user_id === profile?.id ? profile : null);
  const memberName =
    activeMember?.username || activeMember?.email || activeTicket?.user_id || "Member";

  return (
    <div className={`ticketDesk ${isAdminMode ? "adminDesk" : ""}`}>
      {!isAdminMode && (
        <form className="ticketCreate" onSubmit={createTicket}>
          <div>
            <p className="eyebrow">SUPPORT TICKETS</p>
            <h3>Create a Ticket</h3>
          </div>

          <input
            type="text"
            placeholder="Subject"
            value={ticketForm.subject}
            onChange={(e) =>
              setTicketForm((current) => ({
                ...current,
                subject: e.target.value,
              }))
            }
          />

          <textarea
            placeholder="Tell us what you need help with"
            value={ticketForm.body}
            onChange={(e) =>
              setTicketForm((current) => ({
                ...current,
                body: e.target.value,
              }))
            }
          />

          <button className="primaryBtn" type="submit">
            Create Ticket
          </button>
        </form>
      )}

      <div className="ticketLayout">
        <aside className="ticketListPanel">
          <div className="ticketListHeader">
            <h3>{isAdminMode ? "All Tickets" : "My Tickets"}</h3>
            <span>{ticketsLoading ? "Loading" : `${tickets.length} total`}</span>
          </div>

          <div className="ticketList">
            {tickets.length === 0 ? (
              <p className="emptyState">
                {isAdminMode
                  ? "No member tickets yet."
                  : "Create your first ticket to talk with staff."}
              </p>
            ) : (
              tickets.map((ticket) => {
                const member = ticket.memberProfile;

                return (
                  <button
                    type="button"
                    className={`ticketItem ${
                      activeTicketId === ticket.id ? "active" : ""
                    }`}
                    key={ticket.id}
                    onClick={() => setActiveTicketId(ticket.id)}
                  >
                    <span className={`statusBadge ${ticket.status}`}>
                      {ticket.status}
                    </span>
                    <strong>{ticket.subject}</strong>
                    {isAdminMode && (
                      <>
                        <small>{member?.username || member?.email || "Member"}</small>
                        <SubscriptionBadge
                          subscription={member?.subscription}
                          expiresAt={member?.subscription_expires_at}
                          compact
                        />
                      </>
                    )}
                    <time>{formatDateTime(ticket.updated_at || ticket.created_at)}</time>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="ticketConversation">
          {!activeTicket ? (
            <div className="emptyState conversationEmpty">
              Select a ticket to view the chat.
            </div>
          ) : (
            <>
              <div className="ticketHeader">
                <div>
                  <span className={`statusBadge ${activeTicket.status}`}>
                    {activeTicket.status}
                  </span>
                  <h3>{activeTicket.subject}</h3>
                  {isAdminMode && (
                    <div className="memberLine">
                      <span>{memberName}</span>
                      <SubscriptionBadge
                        subscription={activeMember?.subscription}
                        expiresAt={activeMember?.subscription_expires_at}
                        compact
                      />
                    </div>
                  )}
                </div>

                {isAdminMode && (
                  <button
                    type="button"
                    className="primaryBtn statusToggle"
                    onClick={() =>
                      updateTicketStatus(
                        activeTicket.id,
                        activeTicket.status === "open" ? "closed" : "open"
                      )
                    }
                  >
                    {activeTicket.status === "open" ? "Close Ticket" : "Open Ticket"}
                  </button>
                )}
              </div>

              <div className="chatWindow">
                {!isAdminMode && (
                  <div className="adminNotice">
                    <span>ADMIN</span>
                    <p>Your ticket has been recieved please wait while we find an Admin for you.</p>
                  </div>
                )}

                {ticketMessages.length === 0 ? (
                  <p className="emptyState">No messages yet.</p>
                ) : (
                  ticketMessages.map((message) => {
                    const fromAdmin = message.sender_role === "admin";

                    return (
                      <div
                        className={`chatMessage ${
                          fromAdmin ? "adminMessage" : "memberMessage"
                        }`}
                        key={message.id}
                      >
                        <span
                          className={`chatRole ${
                            fromAdmin ? "adminRole" : "memberRole"
                          }`}
                        >
                          {fromAdmin ? "ADMIN" : isAdminMode ? memberName : "You"}
                        </span>
                        <p>{message.body}</p>
                        <time>{formatDateTime(message.created_at)}</time>
                      </div>
                    );
                  })
                )}
              </div>

              {activeTicket.status === "closed" ? (
                <p className="closedNotice">
                  This ticket is closed. Admins can reopen it to continue chatting.
                </p>
              ) : (
                <form
                  className="ticketReplyBox"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendTicketMessage(activeTicket.id);
                  }}
                >
                  <textarea
                    placeholder={isAdminMode ? "Reply to member" : "Reply to admin"}
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                  />
                  <button className="primaryBtn" type="submit">
                    Send
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      {ticketNotice && <p className="message ticketNotice">{ticketNotice}</p>}
    </div>
  );
}

function AdminPage({ isAdmin, adminStats, ticketProps }) {
  if (!isAdmin) return <Navigate to="/account" replace />;

  return (
    <>
      <section className="section">
        <p className="eyebrow">ADMIN ACCESS</p>

        <h2>Website Control Panel</h2>

        <div className="adminGrid">
          <div>
            <span>Users</span>
            <b> = {adminStats.active_users}</b>
          </div>

          <div>
            <span>Open Tickets</span>
            <b> = {adminStats.tickets}</b>
          </div>

          <div>
            <span>Revenue</span>
            <b> = ${adminStats.revenue}</b>
          </div>

          <div>
            <span>Status</span>
            <b> = {adminStats.server_status}</b>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">SUPPORT DESK</p>
        <h2>Member Tickets</h2>
        <TicketWorkspace mode="admin" {...ticketProps} />
      </section>
    </>
  );
}

export default App;
