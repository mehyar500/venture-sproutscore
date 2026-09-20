// functions/api/_lib/tokens.js
// Signed one-click unsubscribe tokens.
// Format: base64url(email) + "." + hex(HMAC_SHA256(email, secret))
// The SAME format + secret must be used by whatever mails SproutScore
// recipients (mehyar-web mailer) so email links verify here.
// Env: SPROUTSCORE_UNSUB_SECRET (shared with the mailer).

function b64urlEncode(bytes) {
  const bin = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

function hexOf(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret, email) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email));
  return hexOf(mac);
}

async function mintUnsubToken(email, secret) {
  email = email.trim().toLowerCase();
  const sig = await hmacHex(secret, email);
  return b64urlEncode(new TextEncoder().encode(email)) + "." + sig;
}

async function verifyUnsubToken(token, secret) {
  try {
    const dot = token.indexOf(".");
    if (dot < 1) return null;
    const email = b64urlDecode(token.slice(0, dot)).trim().toLowerCase();
    const sig = token.slice(dot + 1);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
    const expect = await hmacHex(secret, email);
    if (expect.length !== sig.length) return null;
    let d = 0;
    for (let i = 0; i < expect.length; i++) d |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
    return d === 0 ? email : null;
  } catch {
    return null;
  }
}

export { mintUnsubToken, verifyUnsubToken };
