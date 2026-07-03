/* 수집품 등록 모달 (F2/F3/F5/F6/F11) */
window.CT = window.CT || {};

(function () {
  let draft = emptyDraft();
  let editingId = null; // null이면 신규 등록, 값이 있으면 해당 id의 항목을 수정
  let onSubmitCallback = null;
  let getRecorderName = () => "기록자";

  function emptyDraft() {
    return { characterStyle: null, category: null, name: "", productLink: "", review: "", photoUrl: null };
  }

  function $(id) { return document.getElementById(id); }

  // 이미지가 없는 카테고리(예: 음식)는 이모지로 대체 표시한다.
  function thumbHtml(entity, className) {
    if (entity.img) return `<img class="${className}" src="${entity.img}" alt="${entity.label}" />`;
    return `<span class="${className} opt-thumb-emoji">${entity.emoji}</span>`;
  }

  function isValidUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function renderCharacterGrid() {
    const grid = $("characterGrid");
    grid.innerHTML = "";
    CT.CHARACTERS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "option-card" + (draft.characterStyle === c.id ? " selected" : "");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.innerHTML = `
        <div class="check-badge">✓</div>
        <img class="opt-thumb" src="${c.img}" alt="${c.label}" />
        <div class="opt-label">${c.label}</div>
      `;
      card.addEventListener("click", () => {
        draft.characterStyle = c.id;
        renderCharacterGrid();
        updatePreview();
      });
      grid.appendChild(card);
    });
  }

  function renderCategoryGrid() {
    const grid = $("categoryGrid");
    grid.innerHTML = "";
    CT.CATEGORIES.forEach((c) => {
      const card = document.createElement("div");
      card.className = "option-card" + (draft.category === c.id ? " selected" : "");
      card.style.setProperty("--accent", c.color);
      if (draft.category === c.id) card.style.borderColor = c.color;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.innerHTML = `
        <div class="check-badge" style="background:${c.color}">✓</div>
        ${thumbHtml(c, "opt-thumb opt-thumb-sm")}
        <div class="opt-label">${c.label}</div>
      `;
      card.addEventListener("click", () => {
        draft.category = c.id;
        renderCategoryGrid();
        updatePreview();
      });
      grid.appendChild(card);
    });
  }

  function updatePreview() {
    const chip = $("previewCategoryChip");
    const category = CT.getCategory(draft.category);
    if (category) {
      chip.innerHTML = `${thumbHtml(category, "")}${category.label}`;
      chip.style.borderColor = category.color;
    } else {
      chip.innerHTML = "카테고리를 선택해 주세요";
      chip.style.borderColor = "";
    }

    const photoEl = $("previewPhoto");
    const character = CT.getCharacter(draft.characterStyle);
    if (draft.photoUrl) {
      photoEl.innerHTML = `<img src="${draft.photoUrl}" alt="첨부 사진" />`;
    } else if (character) {
      photoEl.innerHTML = `<img src="${character.img}" alt="${character.label}" />`;
    } else {
      photoEl.textContent = "🐰";
    }

    $("previewName").textContent = draft.name.trim() || "수집품 설명을 입력해 주세요";
    $("previewRecorder").textContent = `기록자: ${getRecorderName()}`;

    const reviewEl = $("previewReview");
    if (draft.review.trim()) {
      reviewEl.textContent = `📝 ${draft.review.trim()}`;
      reviewEl.classList.remove("hidden");
    } else {
      reviewEl.classList.add("hidden");
    }
  }

  function resetForm(existingRecord) {
    editingId = existingRecord ? existingRecord.id : null;
    draft = existingRecord
      ? {
          characterStyle: existingRecord.characterStyle,
          category: existingRecord.category,
          name: existingRecord.name || "",
          productLink: existingRecord.productLink || "",
          review: existingRecord.review || "",
          photoUrl: existingRecord.photoUrl || null,
        }
      : emptyDraft();

    $("nameInput").value = draft.name;
    $("nameCount").textContent = String(draft.name.length);
    $("linkInput").value = draft.productLink;
    $("linkError").textContent = "";
    $("reviewInput").value = draft.review;
    $("photoInput").value = "";
    if (draft.photoUrl) {
      $("photoThumbImg").src = draft.photoUrl;
      $("photoThumb").classList.remove("hidden");
      $("photoDrop").classList.add("hidden");
    } else {
      $("photoThumb").classList.add("hidden");
      $("photoDrop").classList.remove("hidden");
    }

    $("modalTitle").textContent = editingId ? "✏️ 수집품 수정하기" : "✨ 수집품 자랑하기";
    $("modalSub").textContent = editingId
      ? "캐릭터와 카테고리, 정보를 수정해 주세요."
      : "캐릭터와 카테고리를 선택하고 정보를 입력해 주세요.";
    $("modalApply").textContent = editingId ? "✏️ 수정 완료" : "✨ 적용";

    renderCharacterGrid();
    renderCategoryGrid();
    updatePreview();
  }

  function handlePhotoFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("사진은 8MB 이하로 업로드해 주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 백엔드(Google Sheets 셀 용량 제한)와 로컬 저장 용량을 모두 고려해
        // 320px 이내로 축소 + JPEG 압축한다.
        const MAX_DIM = 320;
        let { width, height } = img;
        if (width >= height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > width && height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        let quality = 0.75;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 40000 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        draft.photoUrl = dataUrl;
        $("photoThumbImg").src = draft.photoUrl;
        $("photoThumb").classList.remove("hidden");
        $("photoDrop").classList.add("hidden");
        updatePreview();
      };
      img.onerror = () => alert("사진을 불러오지 못했어요. 다른 파일을 시도해 주세요.");
      img.src = e.target.result;
    };
    reader.onerror = () => alert("사진을 읽지 못했어요. 다시 시도해 주세요.");
    reader.readAsDataURL(file);
  }

  function validate() {
    let ok = true;
    $("linkError").textContent = "";
    if (!draft.characterStyle) ok = false;
    if (!draft.category) ok = false;
    if (!draft.name.trim()) ok = false;
    if (!draft.productLink.trim()) {
      ok = false;
    } else if (!isValidUrl(draft.productLink.trim())) {
      $("linkError").textContent = "올바른 URL 형식이 아니에요. (예: https://example.com)";
      ok = false;
    }
    return ok;
  }

  function open(existingRecord) {
    resetForm(existingRecord || null);
    $("modalOverlay").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function close() {
    $("modalOverlay").classList.add("hidden");
    document.body.style.overflow = "";
  }

  function wireEvents() {
    $("modalClose").addEventListener("click", close);
    $("modalCancel").addEventListener("click", close);
    $("modalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("modalOverlay").classList.contains("hidden")) close();
    });

    $("nameInput").addEventListener("input", (e) => {
      draft.name = e.target.value;
      $("nameCount").textContent = String(e.target.value.length);
      updatePreview();
    });
    $("linkInput").addEventListener("input", (e) => {
      draft.productLink = e.target.value;
      $("linkError").textContent = "";
    });
    $("reviewInput").addEventListener("input", (e) => {
      draft.review = e.target.value;
      updatePreview();
    });

    $("photoDrop").addEventListener("click", () => $("photoInput").click());
    $("photoInput").addEventListener("change", (e) => handlePhotoFile(e.target.files[0]));
    $("photoDrop").addEventListener("dragover", (e) => {
      e.preventDefault();
      $("photoDrop").classList.add("drag-over");
    });
    $("photoDrop").addEventListener("dragleave", () => $("photoDrop").classList.remove("drag-over"));
    $("photoDrop").addEventListener("drop", (e) => {
      e.preventDefault();
      $("photoDrop").classList.remove("drag-over");
      handlePhotoFile(e.dataTransfer.files[0]);
    });
    $("photoRemove").addEventListener("click", () => {
      draft.photoUrl = null;
      $("photoInput").value = "";
      $("photoThumb").classList.add("hidden");
      $("photoDrop").classList.remove("hidden");
      updatePreview();
    });

    $("modalApply").addEventListener("click", () => {
      if (!validate()) {
        renderCharacterGrid();
        renderCategoryGrid();
        if (!draft.characterStyle || !draft.category || !draft.name.trim()) {
          CT.toast && CT.toast.show("캐릭터·카테고리·설명을 모두 입력해 주세요.");
        }
        return;
      }
      const record = {
        id: editingId || undefined,
        characterStyle: draft.characterStyle,
        category: draft.category,
        name: draft.name.trim(),
        productLink: draft.productLink.trim(),
        review: draft.review.trim(),
        photoUrl: draft.photoUrl,
      };
      close();
      onSubmitCallback && onSubmitCallback(record);
    });
  }

  function init(options) {
    onSubmitCallback = options.onSubmit;
    getRecorderName = options.getRecorderName || getRecorderName;
    wireEvents();
  }

  CT.modal = { init, open, close };
})();
