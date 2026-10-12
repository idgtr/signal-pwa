// app.js
 
// ⚠️ Cambia questo con l'indirizzo reale del tuo backend su Render
const BACKEND_URL = "https://signal-backend-b1uz.onrender.com";
 
const signalsContainer = document.getElementById("signals-container");
const statusEl = document.getElementById("status");
const enableBtn = document.getElementById("enable-push-btn");
const refreshBtn = document.getElementById("refresh-btn");
 
function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}
 
function renderSignals(signals) {
  signalsContainer.innerHTML = "";
 
  if (!signals || signals.length === 0) {
    signalsContainer.innerHTML = '<p class="empty">Nessun segnale ricevuto ancora.</p>';
    return;
  }
 
  for (const s of signals) {
    const card = document.createElement("div");
    card.className = "signal-card " + (s.direction === "BUY" ? "buy" : "sell");
 
    card.innerHTML = `
      <div class="signal-header">
        <span class="symbol">${s.symbol}</span>
        <span class="direction ${s.direction === "BUY" ? "buy" : "sell"}">${s.direction}</span>
        <span class="tf">${s.exec_timeframe}</span>
      </div>
      <div class="signal-body">
        <div class="row"><span>Entry</span><span>${s.entry_price}</span></div>
        <div class="row"><span>Stop Loss</span><span>${s.stop_loss}</span></div>
        <div class="row"><span>Take Profit</span><span>${s.take_profit}</span></div>
        <div class="row"><span>R:R</span><span>${s.risk_reward}</span></div>
        ${s.pattern_type ? `<div class="row"><span>Pattern</span><span>${s.pattern_type}</span></div>` : ""}
        ${s.session ? `<div class="row"><span>Sessione</span><span>${s.session}</span></div>` : ""}
        <div class="row"><span>Bias HTF</span><span>${s.htf_bias_aligned ? "✅ allineato" : "⚠️ non allineato"}</span></div>
      </div>
      <div class="signal-footer">${formatTime(s.received_at)}</div>
    `;
    signalsContainer.appendChild(card);
  }
}
 
async function loadSignals() {
  statusEl.textContent = "Caricamento...";
  try {
    const res = await fetch(`${BACKEND_URL}/api/signals`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderSignals(data);
    statusEl.textContent = `Aggiornato · ${new Date().toLocaleTimeString("it-IT")}`;
  } catch (e) {
    statusEl.textContent = "Errore nel caricamento: " + e.message;
  }
}
 
function urlBase64ToUint8Array(base64String) {
  // converte la chiave pubblica VAPID (PEM) nel formato che il browser
  // si aspetta per PushManager.subscribe - qui gestiamo il caso in cui il
  // backend restituisca la chiave in formato PEM standard
  const pem = base64String
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  const raw = atob(pem);
  // La chiave PEM contiene un header ASN.1 prima dei 65 byte della chiave
  // pubblica EC grezza (formato P-256 non compresso, inizia con 0x04).
  // Cerchiamo il byte 0x04 seguito da 64 byte per isolare la chiave grezza.
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
 
  let start = -1;
  for (let i = 0; i < bytes.length - 64; i++) {
    if (bytes[i] === 0x04) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error("Formato chiave VAPID non riconosciuto");
  return bytes.slice(start, start + 65);
}
 
async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    statusEl.textContent = "Le notifiche push non sono supportate su questo browser/dispositivo.";
    return;
  }
 
  try {
    statusEl.textContent = "Attivazione notifiche...";
 
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      statusEl.textContent = "Permesso notifiche negato.";
      return;
    }
 
    const registration = await navigator.serviceWorker.ready;
 
    const keyRes = await fetch(`${BACKEND_URL}/api/vapid-public-key`);
    const { publicKey } = await keyRes.json();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
 
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
 
    const subRes = await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
 
    if (!subRes.ok) throw new Error(`HTTP ${subRes.status}`);
 
    statusEl.textContent = "✅ Notifiche attivate!";
    setPushButtonActive();
  } catch (e) {
    statusEl.textContent = "Errore attivazione notifiche: " + e.message;
    console.error(e);
  }
}
 
function setPushButtonActive() {
  enableBtn.textContent = "Notifiche attive";
  enableBtn.disabled = true;
}
 
// All'apertura dell'app: se il telefono ha gia' un'iscrizione push valida,
// la ri-registriamo in silenzio sul backend. Cosi' (1) il pulsante mostra lo
// stato reale e (2) se Render si e' riavviato e ha perso il database, il
// server ritrova da solo l'iscrizione appena apri l'app.
async function syncExistingSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const res = await fetch(`${BACKEND_URL}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (res.ok) setPushButtonActive();
  } catch (e) {
    console.error("Sincronizzazione iscrizione fallita", e);
  }
}
 
// Registra il service worker all'avvio
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((e) => console.error("SW registration failed", e));
}
 
enableBtn.addEventListener("click", enablePushNotifications);
refreshBtn.addEventListener("click", loadSignals);
 
loadSignals();
syncExistingSubscription();
















