/* 앱 진입점 — 상태 관리, 렌더링, 이벤트 바인딩
 * config.js에 SHEET_API_URL이 설정되어 있으면 Google Apps Script 백엔드(CT.remote)를 통해
 * 여러 기기가 실시간으로 같은 나무를 공유하고(usingRemote=true), 없으면 이 브라우저에만
 * 저장되는 로컬 모드(CT.storage/CT.auth)로 동작한다.
 */
window.CT = window.CT || {};

(function () {
  const $ = (id) => document.getElementById(id);
  const REMOTE_SESSION_KEY = "collectionTree.remoteSession.v1";

  // records는 여러 기록자가 함께 채우는 공용 나무 데이터. 로그인한 사람이 누구인지는
  // currentRecorder(세션)로 별도 관리하고, 항목별 recorder 필드로 소유자를 구분한다.
  let state = { records: [] };
  let usingRemote = false;
  let currentRecorder = null;
  let sessionToken = null; // 원격 모드에서만 사용
  let myItemsOnly = false;
  let readOnly = false;
  let prevRenderedCount = 0;
  let camera = { scale: 1, tx: 0, ty: 0 };
  let musicOn = false;
  let audioCtx = null;
  let musicNodes = null;

  const ACH_KEY = "collectionTree.achievements";
  const unlockedAchievements = new Set(JSON.parse(localStorage.getItem(ACH_KEY) || "[]"));

  // ---------- Toast ----------
  CT.toast = {
    show(message, opts = {}) {
      const root = $("toastRoot");
      const t = document.createElement("div");
      t.className = "toast" + (opts.achievement ? " achievement" : "");
      t.textContent = message;
      root.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    },
  };

  function generateId() {
    return "item_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function isValidUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function persist() {
    if (readOnly || usingRemote) return; // 원격 모드는 API 호출 자체가 곧 저장
    CT.storage.saveState(state);
  }

  function saveRemoteSession(name, token) {
    localStorage.setItem(REMOTE_SESSION_KEY, JSON.stringify({ name, token }));
  }
  function loadRemoteSession() {
    try {
      return JSON.parse(localStorage.getItem(REMOTE_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }
  function clearRemoteSession() {
    localStorage.removeItem(REMOTE_SESSION_KEY);
  }

  // ---------- Confetti ----------
  function burstConfetti() {
    const colors = CT.CATEGORIES.map((c) => c.color);
    const anchor = $("counterValue").getBoundingClientRect();
    for (let i = 0; i < 26; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const color = colors[Math.floor(Math.random() * colors.length)];
      piece.style.background = color;
      piece.style.left = anchor.left + Math.random() * 160 - 40 + "px";
      piece.style.top = Math.max(0, anchor.top - 10) + "px";
      piece.style.animationDuration = 1.1 + Math.random() * 0.9 + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 2200);
    }
  }

  // ---------- Achievements ----------
  function checkAchievements() {
    CT.ACHIEVEMENTS.forEach((a) => {
      if (!unlockedAchievements.has(a.id) && a.test(state.records)) {
        unlockedAchievements.add(a.id);
        localStorage.setItem(ACH_KEY, JSON.stringify([...unlockedAchievements]));
        CT.toast.show(`${a.icon} 업적 달성: ${a.label}`, { achievement: true });
        burstConfetti();
      }
    });
  }

  // ---------- Render: recorder / counter ----------
  function renderRecorderCard() {
    $("recorderName").textContent = currentRecorder || "-";
    $("recorderCard").classList.toggle("hidden", readOnly);
    $("logoutBtn").classList.toggle("hidden", readOnly);
    $("openModalBtn").classList.toggle("hidden", readOnly);
    $("loadBtn").classList.toggle("hidden", readOnly);
    $("clearBtn").classList.toggle("hidden", readOnly);
    $("readonlyBadge").classList.toggle("hidden", !readOnly);
    $("myItemsToggleWrap").classList.toggle("hidden", readOnly);

    const mode = $("modeIndicator");
    mode.className = "mode-indicator " + (usingRemote ? "remote" : "local");
    mode.textContent = usingRemote ? "☁️ 실시간 공유 모드" : "💾 이 브라우저에만 저장(로컬 모드)";
  }

  function renderCounter() {
    const count = state.records.length;
    $("counterValue").textContent = String(count);
    if (count !== prevRenderedCount) {
      $("counterValue").classList.remove("bump");
      $("counterParty").classList.remove("pop");
      void $("counterValue").offsetWidth;
      if (count > prevRenderedCount) {
        $("counterValue").classList.add("bump");
        $("counterParty").classList.add("pop");
      }
    }
  }

  // ---------- Render: list ----------
  async function moveRecord(index, direction) {
    const record = state.records[index];
    if (!record || record.recorder !== currentRecorder) {
      CT.toast.show("본인이 등록한 아이템만 순서를 바꿀 수 있어요. 🔒");
      return;
    }
    if (usingRemote) {
      try {
        const res = await CT.remote.swapOrder(currentRecorder, sessionToken, record.id, direction);
        if (!res || !res.ok) throw new Error(res && res.reason);
        if (res.records) state.records = res.records;
      } catch (err) {
        CT.toast.show("순서 변경에 실패했어요. 네트워크를 확인해 주세요. ⚠️");
        return;
      }
    } else {
      const target = index + direction;
      if (target < 0 || target >= state.records.length) return;
      const arr = state.records;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      arr.forEach((r, i) => (r.order = i));
      persist();
    }
    renderList();
    renderTree();
  }

  async function deleteRecord(index) {
    const record = state.records[index];
    if (!record || record.recorder !== currentRecorder) {
      CT.toast.show("본인이 등록한 아이템만 삭제할 수 있어요. 🔒");
      return;
    }
    if (!confirm(`'${record.name}' 항목을 삭제할까요?`)) return;

    if (usingRemote) {
      try {
        const res = await CT.remote.deleteRecord(currentRecorder, sessionToken, record.id);
        if (!res || !res.ok) throw new Error(res && res.reason);
      } catch (err) {
        CT.toast.show("삭제에 실패했어요. 네트워크를 확인해 주세요. ⚠️");
        return;
      }
    }
    state.records.splice(index, 1);
    if (!usingRemote) {
      state.records.forEach((r, i) => (r.order = i));
      persist();
    }
    renderAll();
  }

  function renderList() {
    const list = $("recordList");
    const empty = $("emptyHint");
    list.querySelectorAll(".record-item").forEach((n) => n.remove());

    let rendered = 0;
    state.records.forEach((record, index) => {
      if (myItemsOnly && !readOnly && record.recorder !== currentRecorder) return;
      rendered++;

      const category = CT.getCategory(record.category);
      const character = CT.getCharacter(record.characterStyle);
      const isMine = !readOnly && record.recorder === currentRecorder;

      const li = document.createElement("li");
      li.className = "record-item";

      const dot = document.createElement("span");
      dot.className = "record-dot";
      dot.style.background = category ? category.color : "#ccc";
      li.appendChild(dot);

      const thumb = document.createElement("img");
      thumb.className = "record-thumb";
      thumb.src = character ? character.img : "";
      thumb.alt = character ? character.label : "";
      li.appendChild(thumb);

      const nameSpan = document.createElement("span");
      nameSpan.className = "record-name";
      const label = `${record.recorder || ""}의 ${record.name || ""}`;
      nameSpan.textContent = label;
      nameSpan.title = label;
      li.appendChild(nameSpan);

      if (!readOnly) {
        if (isMine) {
          const actions = document.createElement("span");
          actions.className = "record-actions";
          actions.innerHTML = `
            <button type="button" data-action="forward" title="앞으로">앞</button>
            <button type="button" data-action="backward" title="뒤로">뒤</button>
            <button type="button" data-action="delete" class="delete-btn" title="삭제">x</button>
          `;
          actions.querySelector('[data-action="forward"]').addEventListener("click", () => moveRecord(index, 1));
          actions.querySelector('[data-action="backward"]').addEventListener("click", () => moveRecord(index, -1));
          actions.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecord(index));
          li.appendChild(actions);
        } else {
          const lock = document.createElement("span");
          lock.className = "record-lock";
          lock.title = "다른 기록자의 아이템이에요";
          lock.textContent = "🔒";
          li.appendChild(lock);
        }
      }
      list.appendChild(li);
    });

    if (rendered === 0) {
      empty.classList.remove("hidden");
      empty.innerHTML =
        myItemsOnly && !readOnly
          ? "아직 내가 등록한 수집품이 없어요.<br/>‘자랑하기’ 버튼을 눌러 첫 캐릭터를 매달아 보세요!"
          : "아직 등록된 수집품이 없어요.<br/>‘자랑하기’ 버튼을 눌러 첫 캐릭터를 매달아 보세요!";
    } else {
      empty.classList.add("hidden");
    }
  }

  // ---------- Render: tree ----------
  function renderTree() {
    CT.tree.render(state.records, {
      onCharmClick: (record) => showCharmDetail(record),
    });
    prevRenderedCount = state.records.length;
  }

  // ---------- Charm detail popup (F6 — 정보 + 구매처 링크 + 후기 출력) ----------
  function showCharmDetail(record) {
    const character = CT.getCharacter(record.characterStyle);
    const category = CT.getCategory(record.category);

    const charImg = $("detailCharacterImg");
    charImg.src = character ? character.img : "";
    charImg.alt = character ? character.label : "";

    const catBadge = $("detailCategoryBadge");
    catBadge.src = category ? category.img : "";
    catBadge.alt = category ? category.label : "";
    catBadge.style.borderColor = category ? category.color : "";

    const chip = $("detailCategoryChip");
    chip.textContent = category ? category.label : "";
    chip.style.borderColor = category ? category.color : "";

    $("detailTitle").textContent = `${record.recorder || ""}의 ${record.name || ""}`;
    $("detailRecorder").textContent = `기록자: ${record.recorder || ""}`;
    $("detailDate").textContent = record.createdAt
      ? new Date(record.createdAt).toLocaleDateString("ko-KR")
      : "";

    const photoWrap = $("detailPhotoWrap");
    if (record.photoUrl) {
      $("detailPhoto").src = record.photoUrl;
      photoWrap.classList.remove("hidden");
    } else {
      photoWrap.classList.add("hidden");
    }

    const reviewWrap = $("detailReviewWrap");
    if (record.review && record.review.trim()) {
      $("detailReview").textContent = record.review;
      reviewWrap.classList.remove("hidden");
    } else {
      reviewWrap.classList.add("hidden");
    }

    const linkBtn = $("detailLinkBtn");
    if (record.productLink && isValidUrl(record.productLink)) {
      linkBtn.href = record.productLink;
      linkBtn.classList.remove("hidden");
    } else {
      linkBtn.classList.add("hidden");
    }

    $("charmDetailOverlay").classList.remove("hidden");
  }

  function closeCharmDetail() {
    $("charmDetailOverlay").classList.add("hidden");
  }

  function wireCharmDetail() {
    $("detailClose").addEventListener("click", closeCharmDetail);
    $("charmDetailOverlay").addEventListener("click", (e) => {
      if (e.target.id === "charmDetailOverlay") closeCharmDetail();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("charmDetailOverlay").classList.contains("hidden")) closeCharmDetail();
    });
  }

  // ---------- Render: category carousel + legend ----------
  function renderCategoryCarousel() {
    const el = $("categoryCarousel");
    el.innerHTML = "";
    const counts = {};
    state.records.forEach((r) => (counts[r.category] = (counts[r.category] || 0) + 1));
    const active = CT.CATEGORIES.filter((c) => counts[c.id]);
    if (active.length === 0) {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    active.forEach((c) => {
      const chip = document.createElement("div");
      chip.className = "category-chip";
      chip.innerHTML = `<span class="dot" style="background:${c.color}"></span><img class="chip-thumb" src="${c.img}" alt="" />${c.label} · ${counts[c.id]}`;
      el.appendChild(chip);
    });
  }

  function renderLegend() {
    const el = $("legendItems");
    if (el.childElementCount) return;
    CT.CATEGORIES.forEach((c) => {
      const span = document.createElement("span");
      span.className = "legend-item";
      span.innerHTML = `<span class="dot" style="background:${c.color}"></span>${c.label}: ${c.example}`;
      el.appendChild(span);
    });
  }

  function renderAll() {
    renderRecorderCard();
    renderList();
    renderTree();
    renderCategoryCarousel();
    renderLegend();
    renderCounter();
  }

  // ---------- Record creation ----------
  async function handleAddRecord(partial) {
    if (!currentRecorder) {
      CT.toast.show("먼저 로그인해 주세요.");
      showLogin();
      return;
    }

    if (usingRemote) {
      try {
        const res = await CT.remote.createRecord(currentRecorder, sessionToken, partial);
        if (!res || !res.ok) throw new Error(res && res.reason);
        state.records.push(res.record);
      } catch (err) {
        CT.toast.show("등록에 실패했어요. 네트워크를 확인해 주세요. ⚠️");
        return;
      }
    } else {
      const record = {
        id: generateId(),
        name: partial.name,
        category: partial.category,
        characterStyle: partial.characterStyle,
        productLink: partial.productLink,
        review: partial.review || "",
        photoUrl: partial.photoUrl || null,
        recorder: currentRecorder,
        order: state.records.length,
        createdAt: new Date().toISOString(),
      };
      state.records.push(record);
      persist();
    }

    renderAll();
    checkAchievements();
    CT.toast.show("나무에 새 캐릭터를 매달았어요! ✨");
  }

  // ---------- Login / Logout (간단 로그인) ----------
  function showLogin() {
    $("onboardingOverlay").classList.remove("hidden");
    $("onboardingInput").value = "";
    $("onboardingPassword").value = "";
    $("onboardingError").textContent = "";
    $("onboardingInput").focus();
  }

  function hideLogin() {
    $("onboardingOverlay").classList.add("hidden");
  }

  async function attemptLogin() {
    const name = $("onboardingInput").value.trim();
    const password = $("onboardingPassword").value;
    if (!name || !password) {
      $("onboardingError").textContent = "이름과 비밀번호를 모두 입력해 주세요.";
      return;
    }

    let result;
    try {
      result = usingRemote ? await CT.remote.authenticate(name, password) : await CT.auth.authenticate(name, password);
    } catch (err) {
      $("onboardingError").textContent = "로그인에 실패했어요. 네트워크를 확인해 주세요.";
      return;
    }
    if (!result || !result.ok) {
      $("onboardingError").textContent = "비밀번호가 올바르지 않아요. 다시 확인해 주세요.";
      $("onboardingPassword").value = "";
      $("onboardingPassword").focus();
      return;
    }

    currentRecorder = result.name;
    sessionToken = result.token || null;
    if (usingRemote) saveRemoteSession(currentRecorder, sessionToken);
    hideLogin();
    renderAll();
    CT.toast.show(
      result.isNew ? `${result.name}님, 환영해요! 계정이 만들어졌어요 🌱` : `${result.name}님, 다시 오셨네요! 👋`
    );
  }

  function wireLogin() {
    $("onboardingConfirm").addEventListener("click", attemptLogin);
    [$("onboardingInput"), $("onboardingPassword")].forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") attemptLogin();
      });
    });
  }

  function wireLogout() {
    $("logoutBtn").addEventListener("click", () => {
      if (usingRemote) clearRemoteSession();
      else CT.auth.clearSession();
      currentRecorder = null;
      sessionToken = null;
      renderAll();
      showLogin();
    });
  }

  function wireMyItemsToggle() {
    $("myItemsToggle").addEventListener("change", (e) => {
      myItemsOnly = e.target.checked;
      renderList();
    });
  }

  // ---------- Camera (pan/zoom/reset — E3) ----------
  function applyCamera(animated) {
    const stage = $("treeStage");
    stage.style.transition = animated ? "transform 0.3s ease" : "none";
    stage.style.transform = `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.scale})`;
  }

  function wireCamera() {
    const viewport = $("treeViewport");
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    viewport.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.classList.add("dragging");
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      camera.tx += e.clientX - lastX;
      camera.ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      applyCamera(false);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((evt) =>
      viewport.addEventListener(evt, () => {
        dragging = false;
        viewport.classList.remove("dragging");
      })
    );
    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        camera.scale = Math.min(1.8, Math.max(0.6, camera.scale + delta));
        applyCamera(false);
      },
      { passive: false }
    );

    $("resetBtn").addEventListener("click", () => {
      camera = { scale: 1, tx: 0, ty: 0 };
      applyCamera(true);
    });
  }

  // ---------- Capture (E1) ----------
  function wireCapture() {
    $("captureBtn").addEventListener("click", () => {
      const name = currentRecorder || "나의";
      CT.tree.captureImage($("treeSvg"), `${name}-수집-트리.png`);
      CT.toast.show("트리 이미지를 저장했어요! 📸");
    });
  }

  // ---------- Ambient BGM (E2, Web Audio 합성 — 외부 오디오 파일 없이 은은한 패드음) ----------
  function toggleMusic() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicOn = !musicOn;
    $("musicBtn").classList.toggle("active", musicOn);
    if (musicOn) {
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.035;
      masterGain.connect(audioCtx.destination);
      const freqs = [261.6, 329.6, 392.0];
      const oscillators = freqs.map((f) => {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const gain = audioCtx.createGain();
        gain.gain.value = 1 / freqs.length;
        osc.connect(gain).connect(masterGain);
        osc.start();
        return osc;
      });
      musicNodes = { masterGain, oscillators };
    } else if (musicNodes) {
      musicNodes.oscillators.forEach((o) => o.stop());
      musicNodes = null;
    }
  }

  // ---------- Share (F10) ----------
  // 원격 모드에서는 사이트 주소 자체가 곧 실시간 공유 링크다(로그인 전엔 읽기 전용처럼 보이고,
  // 로그인하면 누구나 등록도 가능). 로컬 모드에서만 현재 상태를 스냅샷으로 URL에 담아 공유한다.
  function wireShare() {
    $("shareBtn").addEventListener("click", async () => {
      const url = usingRemote ? window.location.href.split("?")[0].split("#")[0] : CT.share.buildShareUrl(state);
      try {
        await navigator.clipboard.writeText(url);
        CT.toast.show(usingRemote ? "실시간 공유 링크를 복사했어요! ☁️🔗" : "공유 링크를 복사했어요! 🔗");
      } catch {
        window.prompt("아래 링크를 복사해 주세요:", url);
      }
    });
  }

  // ---------- Load / Clear ----------
  function wireLoadClear() {
    $("loadBtn").addEventListener("click", async () => {
      if (usingRemote) {
        try {
          const res = await CT.remote.listRecords();
          if (!res || !res.ok) throw new Error();
          state.records = res.records || [];
          renderAll();
          CT.toast.show("최신 기록을 불러왔어요! 📂");
        } catch {
          CT.toast.show("불러오기에 실패했어요. 네트워크를 확인해 주세요. ⚠️");
        }
        return;
      }
      const loaded = CT.storage.loadState();
      if (!loaded) {
        CT.toast.show("저장된 기록이 없어요.");
        return;
      }
      state = { records: loaded.records || [] };
      renderAll();
      CT.toast.show("기록을 불러왔어요! 📂");
    });

    $("clearBtn").addEventListener("click", async () => {
      const mine = state.records.filter((r) => r.recorder === currentRecorder);
      if (mine.length === 0) {
        CT.toast.show("삭제할 내 아이템이 없어요.");
        return;
      }
      if (!confirm(`내가 등록한 ${mine.length}개 항목을 모두 삭제할까요? 되돌릴 수 없어요.`)) return;

      if (usingRemote) {
        try {
          const res = await CT.remote.clearMine(currentRecorder, sessionToken);
          if (!res || !res.ok) throw new Error();
        } catch {
          CT.toast.show("삭제에 실패했어요. 네트워크를 확인해 주세요. ⚠️");
          return;
        }
      }
      state.records = state.records.filter((r) => r.recorder !== currentRecorder);
      if (!usingRemote) {
        state.records.forEach((r, i) => (r.order = i));
        persist();
      }
      renderAll();
      CT.toast.show("내 항목을 모두 비웠어요.");
    });
  }

  // ---------- Init ----------
  async function init() {
    usingRemote = !!(CT.remote && CT.remote.isConfigured());

    const shared = !usingRemote && CT.share.parseShareFromUrl();
    if (shared) {
      readOnly = true;
      state = { records: shared.records || [] };
    } else if (usingRemote) {
      try {
        const res = await CT.remote.listRecords();
        if (!res || !res.ok) throw new Error();
        state = { records: res.records || [] };
      } catch (err) {
        console.warn("[backend] 목록 불러오기 실패, 로컬 모드로 전환", err);
        usingRemote = false;
        CT.toast.show("백엔드 연결에 실패해 로컬 모드로 동작해요. app/config.js 설정을 확인해 주세요. ⚠️");
        const loaded = CT.storage.loadState();
        state = { records: (loaded && loaded.records) || [] };
      }
    } else {
      const loaded = CT.storage.loadState();
      state = { records: (loaded && loaded.records) || [] };
    }

    CT.tree.mount($("treeSvg"));
    CT.modal.init({ onSubmit: handleAddRecord, getRecorderName: () => currentRecorder || "기록자" });

    $("openModalBtn").addEventListener("click", () => {
      if (!currentRecorder) {
        showLogin();
        return;
      }
      CT.modal.open();
    });

    wireLogin();
    wireLogout();
    wireMyItemsToggle();
    wireCamera();
    wireCapture();
    wireShare();
    wireLoadClear();
    wireCharmDetail();
    $("musicBtn").addEventListener("click", toggleMusic);

    if (!readOnly) {
      if (usingRemote) {
        const sess = loadRemoteSession();
        if (sess) {
          currentRecorder = sess.name;
          sessionToken = sess.token;
        }
      } else {
        currentRecorder = CT.auth.getSession();
      }
    }

    renderAll();
    prevRenderedCount = state.records.length;

    if (!readOnly && !currentRecorder) {
      showLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
