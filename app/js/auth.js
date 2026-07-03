/* 간단 로그인 — 기록자 이름 + 비밀번호
 * 여러 기록자가 같은 나무(브라우저의 공유 저장소)에 접속해 각자의 키링을 등록할 수 있도록,
 * 이름별 비밀번호를 해시로 저장해 다른 사람이 남의 이름으로 함부로 수정/삭제하지 못하게 막는다.
 * (백엔드가 없는 정적 사이트이므로 이 저장소는 "이 브라우저를 함께 쓰는 사람들" 범위의 보호이며,
 *  서로 다른 기기 간 계정 동기화는 되지 않는다.)
 */
window.CT = window.CT || {};

(function () {
  const RECORDERS_KEY = "collectionTree.recorders.v1";
  const SESSION_KEY = "collectionTree.session.v1";

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function genSalt() {
    if (window.crypto && crypto.getRandomValues) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return bufToHex(arr.buffer);
    }
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  async function hashPassword(password, salt) {
    const text = `${salt}:${password}`;
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return bufToHex(digest);
    }
    // SubtleCrypto를 쓸 수 없는 환경을 위한 최소 폴백(암호학적으로 안전하지 않음)
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return "fnv" + (h >>> 0).toString(16);
  }

  function loadRecorders() {
    try {
      const list = JSON.parse(localStorage.getItem(RECORDERS_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
  function saveRecorders(list) {
    localStorage.setItem(RECORDERS_KEY, JSON.stringify(list));
  }

  function getSession() {
    return localStorage.getItem(SESSION_KEY) || null;
  }
  function setSession(name) {
    localStorage.setItem(SESSION_KEY, name);
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /** 이름이 처음이면 새 계정을 만들고, 있으면 비밀번호를 검증한다. */
  async function authenticate(name, password) {
    const trimmed = (name || "").trim();
    if (!trimmed || !password) return { ok: false, reason: "invalid" };

    const recorders = loadRecorders();
    const existing = recorders.find((r) => r.name === trimmed);

    if (!existing) {
      const salt = genSalt();
      const hash = await hashPassword(password, salt);
      recorders.push({ name: trimmed, salt, hash });
      saveRecorders(recorders);
      setSession(trimmed);
      return { ok: true, isNew: true, name: trimmed };
    }

    const hash = await hashPassword(password, existing.salt);
    if (hash !== existing.hash) {
      return { ok: false, reason: "wrong-password" };
    }
    setSession(trimmed);
    return { ok: true, isNew: false, name: trimmed };
  }

  CT.auth = { authenticate, getSession, clearSession };
})();
