/* 나무 시각화(F4) — 순수 SVG로 그려서
 * (1) DOM 오버레이 없이 캡처(E1)가 쉽고, (2) 애니메이션/호버/클릭이 벡터 좌표 기준으로 정확하다.
 */
window.CT = window.CT || {};

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const VIEW_W = 1200;
  const VIEW_H = 800;

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // 캐노피(잎사귀 뭉치) — 그림자 / 중간톤 / 하이라이트 3레이어로 부드러운 입체감 연출
  const CANOPY_SHADOW = [
    [380, 260, 120], [650, 205, 140], [860, 265, 120], [500, 325, 120],
    [480, 430, 45], [920, 485, 40],
  ];
  const CANOPY_MID = [
    [350, 220, 150], [480, 160, 170], [630, 150, 180], [780, 170, 165],
    [900, 235, 150], [620, 265, 190], [450, 295, 150], [760, 305, 150],
    [460, 412, 68], [600, 412, 68], [900, 470, 68], [990, 462, 58],
  ];
  const CANOPY_HILITE = [
    [320, 180, 80], [600, 120, 90], [860, 190, 80],
    [440, 390, 34], [880, 455, 28],
  ];

  function buildStaticScene(svg) {
    // 배경 하늘
    const sky = el("defs", {}, svg);
    const skyGrad = el("linearGradient", { id: "ct-sky", x1: "0", y1: "0", x2: "0", y2: "1" }, sky);
    el("stop", { offset: "0%", "stop-color": "#eaf4ff" }, skyGrad);
    el("stop", { offset: "100%", "stop-color": "#fdf8ec" }, skyGrad);

    const groundGrad = el("radialGradient", { id: "ct-ground", cx: "50%", cy: "30%", r: "75%" }, sky);
    el("stop", { offset: "0%", "stop-color": "#bfe08a" }, groundGrad);
    el("stop", { offset: "100%", "stop-color": "#8fc25e" }, groundGrad);

    const trunkGrad = el("linearGradient", { id: "ct-trunk", x1: "0", y1: "0", x2: "1", y2: "0" }, sky);
    el("stop", { offset: "0%", "stop-color": "#8a6642" }, trunkGrad);
    el("stop", { offset: "50%", "stop-color": "#a9855c" }, trunkGrad);
    el("stop", { offset: "100%", "stop-color": "#7c5b3a" }, trunkGrad);

    el("rect", { x: 0, y: 0, width: VIEW_W, height: VIEW_H, fill: "url(#ct-sky)" }, svg);

    // 구름
    [[160, 90, 55], [230, 105, 38], [1040, 70, 45], [1100, 95, 32]].forEach(([cx, cy, r]) => {
      el("circle", { cx, cy, r, fill: "#ffffff", opacity: 0.75 }, svg);
    });

    // 가지 (트렁크 -> 각 슬롯)
    const branchesLayer = el("g", { id: "ct-branches" }, svg);
    CT.TREE_SLOTS.forEach((slot) => {
      const startX = 600 + (slot.x - 600) * 0.12;
      const startY = 470 + (slot.y - 470) * 0.08;
      const path = `M ${startX} ${startY} Q ${(startX + slot.x) / 2} ${(startY + slot.y) / 2 - 30} ${slot.x} ${slot.y + 40}`;
      el("path", {
        d: path, fill: "none", stroke: "#8a6642", "stroke-width": 10,
        "stroke-linecap": "round", opacity: 0.9,
      }, branchesLayer);
    });

    // 트렁크
    el("path", {
      d: "M 565 760 C 558 630 566 510 590 405 C 595 383 605 383 610 405 C 632 510 642 630 635 760 Z",
      fill: "url(#ct-trunk)",
    }, svg);
    el("ellipse", { cx: 600, cy: 758, rx: 60, ry: 14, fill: "#6b4c2e", opacity: 0.4 }, svg);

    // 캐노피
    const canopy = el("g", { id: "ct-canopy" }, svg);
    CANOPY_SHADOW.forEach(([cx, cy, r]) => el("circle", { cx, cy, r, fill: "#5a9e42" }, canopy));
    CANOPY_MID.forEach(([cx, cy, r]) => el("circle", { cx, cy, r, fill: "#7cbe55" }, canopy));
    CANOPY_HILITE.forEach(([cx, cy, r]) => el("circle", { cx, cy, r, fill: "#a5db7d", opacity: 0.85 }, canopy));

    // 언덕 / 잔디
    el("ellipse", { cx: 600, cy: 762, rx: 480, ry: 90, fill: "url(#ct-ground)" }, svg);

    // 장식: 꽃, 버섯
    const deco = el("g", { id: "ct-deco" }, svg);
    [[260, 790], [340, 810], [900, 800], [1000, 785], [180, 815]].forEach(([x, y], i) => {
      const g = el("g", { transform: `translate(${x} ${y})` }, deco);
      const petColor = ["#ffffff", "#fff2b8", "#ffd9ec"][i % 3];
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2;
        el("circle", { cx: Math.cos(ang) * 7, cy: Math.sin(ang) * 7, r: 5, fill: petColor }, g);
      }
      el("circle", { cx: 0, cy: 0, r: 4, fill: "#f2b134" }, g);
    });
    // 버섯
    const mush = el("g", { transform: "translate(760 815)" }, deco);
    el("rect", { x: -5, y: 0, width: 10, height: 16, rx: 4, fill: "#fbeedd" }, mush);
    el("path", { d: "M -16 0 Q 0 -26 16 0 Z", fill: "#e2604f" }, mush);
    [[-7, -8], [3, -14], [9, -5]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 2.4, fill: "#fff" }, mush));

    // 안내 표지판
    const sign = el("g", { transform: "translate(600 700)" }, svg);
    el("rect", { x: -18, y: 0, width: 8, height: 46, fill: "#8a6642" }, sign);
    el("rect", { x: 18, y: 0, width: 8, height: 46, fill: "#8a6642" }, sign);
    el("rect", { x: -95, y: -34, width: 190, height: 46, rx: 8, fill: "#dcb98a", stroke: "#a9825a", "stroke-width": 3 }, sign);
    const signText = el("text", {
      x: 0, y: -6, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: "#5b4326",
      "font-family": "inherit",
    }, sign);
    signText.textContent = "나의 수집 트리 ♥";
  }

  function computeSlotTransform(index) {
    const base = CT.TREE_SLOTS[index % 8];
    const layer = Math.floor(index / 8);
    const spread = layer * 20 * (index % 2 === 0 ? -1 : 1);
    const scale = Math.max(0.55, Math.pow(0.85, layer));
    return {
      x: base.x + (layer ? spread : 0),
      y: base.y + layer * 78,
      r: Math.max(30, 56 * scale),
    };
  }

  function charmEmoji(record) {
    const character = CT.getCharacter(record.characterStyle);
    return character ? character.emoji : "✨";
  }

  let charmLayerRef = null;
  let defsRef = null;
  let onCharmClickRef = null;
  let prevCount = 0;

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  function render(records, handlers) {
    if (!charmLayerRef) return;
    onCharmClickRef = handlers && handlers.onCharmClick;
    charmLayerRef.innerHTML = "";
    defsRef.innerHTML = "";

    records.forEach((record, index) => {
      const pos = computeSlotTransform(index);
      const category = CT.getCategory(record.category);
      const character = CT.getCharacter(record.characterStyle);
      const color = (category && category.color) || "#6BAE45";

      const group = el("g", {
        class: "charm-group",
        style: `animation-delay:${(index % 6) * 0.18}s`,
        tabindex: "0",
        role: "button",
        "aria-label": `${record.recorder ? record.recorder + "의 " : ""}${record.name || "수집품"} — 클릭하면 자세히 볼 수 있어요`,
        "data-id": record.id,
      }, charmLayerRef);

      // 체인
      el("line", {
        x1: pos.x, y1: pos.y - pos.r - 34, x2: pos.x, y2: pos.y - pos.r,
        stroke: "#b89a6a", "stroke-width": 3, "stroke-dasharray": "3 4", "stroke-linecap": "round",
      }, group);
      el("circle", { cx: pos.x, cy: pos.y - pos.r - 34, r: 5, fill: "none", stroke: "#8a6642", "stroke-width": 3 }, group);

      const pop = el("g", {
        class: index >= prevCount ? "charm-pop drop-in" : "charm-pop",
      }, group);

      el("circle", { class: "charm-halo", cx: pos.x, cy: pos.y, r: pos.r + 12, fill: color, opacity: 0 }, pop);
      el("circle", {
        class: "charm-bg", cx: pos.x, cy: pos.y, r: pos.r, fill: "#fffdf6",
        stroke: color, "stroke-width": 4,
      }, pop);

      // 캐릭터 키링 이미지 (원형 클립)
      const charClipId = `ct-clip-char-${index}`;
      el("clipPath", { id: charClipId }, defsRef).appendChild(
        (() => { const c = document.createElementNS(SVG_NS, "circle"); c.setAttribute("cx", pos.x); c.setAttribute("cy", pos.y); c.setAttribute("r", pos.r - 3); return c; })()
      );
      if (character && character.img) {
        el("image", {
          href: character.img, x: pos.x - (pos.r - 3), y: pos.y - (pos.r - 3),
          width: (pos.r - 3) * 2, height: (pos.r - 3) * 2,
          "clip-path": `url(#${charClipId})`, preserveAspectRatio: "xMidYMid slice",
        }, pop);
      } else {
        const emojiText = el("text", {
          x: pos.x, y: pos.y + pos.r * 0.13, "text-anchor": "middle", "dominant-baseline": "middle",
          "font-size": pos.r * 1.15, class: "charm-emoji",
        }, pop);
        emojiText.textContent = charmEmoji(record);
      }

      // 카테고리 아이콘 배지 (번호 대신 대카테고리 아이콘)
      const badgeX = pos.x - pos.r * 0.72;
      const badgeY = pos.y - pos.r * 0.72;
      const badgeR = 16;
      const badge = el("g", {}, pop);
      el("circle", { cx: badgeX, cy: badgeY, r: badgeR + 2, fill: "#fff", stroke: color, "stroke-width": 2 }, badge);
      if (category && category.img) {
        const catClipId = `ct-clip-cat-${index}`;
        el("clipPath", { id: catClipId }, defsRef).appendChild(
          (() => { const c = document.createElementNS(SVG_NS, "circle"); c.setAttribute("cx", badgeX); c.setAttribute("cy", badgeY); c.setAttribute("r", badgeR); return c; })()
        );
        el("image", {
          href: category.img, x: badgeX - badgeR, y: badgeY - badgeR, width: badgeR * 2, height: badgeR * 2,
          "clip-path": `url(#${catClipId})`, preserveAspectRatio: "xMidYMid slice",
        }, badge);
      } else {
        const badgeText = el("text", {
          x: badgeX, y: badgeY + 4, "text-anchor": "middle", "font-size": 15,
        }, badge);
        badgeText.textContent = category ? category.emoji : "✨";
      }

      // 이름표: "기록자의" / "수집품 이름" 두 줄
      const line1 = `${truncate(record.recorder, 6)}의`;
      const line2 = truncate(record.name, 10);
      const tagWidth = Math.min(190, Math.max(70, Math.max(line1.length, line2.length) * 9 + 20));
      const tagHeight = 40;
      const tagY = pos.y + pos.r + 16;
      const fontFamily = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
      const tag = el("g", {}, pop);
      el("rect", {
        x: pos.x - tagWidth / 2, y: tagY, width: tagWidth, height: tagHeight, rx: 14,
        fill: "#fffdf6", stroke: color, "stroke-width": 1.4, opacity: 0.96,
      }, tag);
      const line1Text = el("text", {
        x: pos.x, y: tagY + 17, "text-anchor": "middle", "font-size": 11.5, "font-weight": 500,
        fill: "#7a7566", "font-family": fontFamily,
      }, tag);
      line1Text.textContent = line1;
      const line2Text = el("text", {
        x: pos.x, y: tagY + 32, "text-anchor": "middle", "font-size": 13, "font-weight": 700,
        fill: "#4a3f2c", "font-family": fontFamily,
      }, tag);
      line2Text.textContent = line2;

      group.addEventListener("click", () => onCharmClickRef && onCharmClickRef(record));
      group.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCharmClickRef && onCharmClickRef(record);
        }
      });
    });

    prevCount = records.length;
  }

  function mount(svgEl) {
    svgEl.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    svgEl.innerHTML = "";
    buildStaticScene(svgEl);
    defsRef = el("defs", { id: "ct-charm-clips" }, svgEl);
    charmLayerRef = el("g", { id: "ct-charms" }, svgEl);
  }

  function captureImage(svgEl, filename) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    // 명시적 width/height가 없으면 뷰박스 밖에서 독립 문서로 렌더링될 때
    // 기본 300x150 크기로 그려진 뒤 늘어나 이미지가 찌그러진다.
    clone.setAttribute("width", String(VIEW_W));
    clone.setAttribute("height", String(VIEW_H));
    // blob으로 직렬화하면 상대경로 기준(base URL)이 사라져 캐릭터/카테고리
    // <image> 리소스가 안 뜰 수 있으므로 캡처 직전에만 절대경로로 치환한다.
    clone.querySelectorAll("image").forEach((img) => {
      const href = img.getAttribute("href");
      if (href) img.setAttribute("href", new URL(href, document.baseURI).href);
    });
    const serialized = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = VIEW_W * scale;
      canvas.height = VIEW_H * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, VIEW_W, VIEW_H);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename || "나의-수집-트리.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, "image/png");
    };
    img.src = url;
  }

  CT.tree = { mount, render, captureImage, VIEW_W, VIEW_H };
})();
