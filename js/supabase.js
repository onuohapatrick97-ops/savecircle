// ===== SAVECIRCLE — SUPABASE CONNECTION =====

const SUPABASE_URL = "https://jewncbezljqqaycflthm.supabase.co";
const SUPABASE_KEY = "sb_publishable_C_PR3Bm6gnwDAMgZLe6A_A_l4NDJf9F";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== STATE =====
let currentUser = null;
let currentProfile = null;
let currentAccount = null;

// ===== AUTH HELPERS =====
async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function getProfile() {
  const u = await getUser();
  if (!u) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", u.id).single();
  return data;
}

async function getAccount() {
  const u = await getUser();
  if (!u) return null;
  const { data } = await supabase.from("accounts").select("*").eq("user_id", u.id).single();
  return data;
}

async function refreshAll() {
  currentUser = await getUser();
  if (!currentUser) return false;
  currentProfile = await getProfile();
  currentAccount = await getAccount();
  return true;
}

// ===== GUARDS =====
async function requireAuth() {
  const u = await getUser();
  if (!u) {
    window.location.href = "index.html";
    return false;
  }
  await refreshAll();
  return true;
}

async function requireAdmin() {
  await refreshAll();
  if (!currentProfile || !currentProfile.is_admin) {
    window.location.href = "dashboard.html";
    return false;
  }
  return true;
}

// ===== LOGOUT =====
async function logout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

// ===== ACCOUNT =====
async function updateBalance(newBalance) {
  if (!currentUser) return;
  await supabase.from("accounts").update({ balance: newBalance }).eq("user_id", currentUser.id);
  if (currentAccount) currentAccount.balance = newBalance;
}

async function incrementTransactionCount() {
  if (!currentUser || !currentAccount) return;
  const newCount = (currentAccount.transaction_count || 0) + 1;
  await supabase.from("accounts").update({ transaction_count: newCount }).eq("user_id", currentUser.id);
  currentAccount.transaction_count = newCount;
}

async function markDepositedBefore() {
  if (!currentUser || !currentAccount) return;
  await supabase.from("accounts").update({ deposited_before: true }).eq("user_id", currentUser.id);
  currentAccount.deposited_before = true;
}

// ===== NOTIFICATIONS =====
async function addNotification(userId, title, body) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title: title,
    body: body
  });
}

async function getNotifications() {
  const u = await getUser();
  if (!u) return [];
  const { data } = await supabase.from("notifications")
    .select("*")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return data || [];
}

// ===== TRANSACTIONS =====
async function addTransaction(data) {
  const u = await getUser();
  if (!u) return;
  await supabase.from("transactions").insert({
    user_id: u.id,
    other_user_id: data.other_user_id || null,
    other_user_name: data.other_user_name || null,
    other_bank_name: data.other_bank_name || null,
    amount: data.amount,
    type: data.type,
    description: data.description,
    category: data.category || "General",
    status: data.status || "completed"
  });
}

async function getTransactions() {
  const u = await getUser();
  if (!u) return [];
  const { data } = await supabase.from("transactions")
    .select("*")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false });
  return data || [];
}

// ===== PIN =====
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "_savecircle_salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPin(pin) {
  if (!currentProfile) return false;
  const hash = await hashPin(pin);
  return hash === currentProfile.pin_hash;
}

// ===== UTILS =====
function todayStr() {
  const now = new Date();
  return now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) { alert(msg); return; }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function showLoading(text) {
  const el = document.getElementById("loadingOverlay");
  if (!el) return;
  const t = el.querySelector(".loading-text");
  if (t) t.textContent = text || "Loading...";
  el.classList.add("show");
}

function hideLoading() {
  const el = document.getElementById("loadingOverlay");
  if (el) el.classList.remove("show");
}
