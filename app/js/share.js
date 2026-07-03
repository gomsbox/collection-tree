/* 공유 링크(F10) — 읽기 전용 URL 생성/파싱
 * 별도 백엔드 없이 정적 호스팅 상에서도 동작해야 하므로,
 * 수집품 목록(사진은 용량 문제로 제외)을 쿼리 파라미터에 직렬화한다.
 * 나무는 여러 기록자가 함께 등록하는 공용 트리이므로 단일 recorderName은 두지 않고
 * 항목별 recorder 필드로 누가 등록했는지 구분한다.
 */
window.CT = window.CT || {};

(function () {
  function buildShareUrl(state) {
    const payload = {
      records: state.records.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        characterStyle: r.characterStyle,
        productLink: r.productLink,
        review: r.review || "",
        photoUrl: null, // 공유 링크 길이 문제로 사진은 생략
        recorder: r.recorder,
        order: r.order,
        createdAt: r.createdAt,
      })),
    };
    // URLSearchParams.set()이 값을 알아서 퍼센트 인코딩하므로 여기서 따로 encodeURIComponent를
    // 하면 이중 인코딩되어 링크만 쓸데없이 길어진다.
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("view", JSON.stringify(payload));
    return url.toString();
  }

  function parseShareFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("view");
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (!payload || !Array.isArray(payload.records)) return null;
      return payload;
    } catch (err) {
      console.warn("[share] 공유 링크 파싱 실패", err);
      return null;
    }
  }

  CT.share = { buildShareUrl, parseShareFromUrl };
})();
