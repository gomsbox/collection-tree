/* 원격 백엔드(Google Apps Script) 클라이언트
 * config.js의 SHEET_API_URL이 설정된 경우에만 활성화된다.
 * POST는 Content-Type을 text/plain으로 보내 브라우저의 CORS 프리플라이트(OPTIONS)를 피한다.
 *
 * Apps Script 웹 앱은 실제 응답을 script.googleusercontent.com/macros/echo로 리다이렉트해서
 * 내려주는데, 이 echo 단계가 가끔(특히 트래픽이 적은 배포 초기) 엉뚱한 이전 응답을 반환하거나
 * 404를 내는 경우가 있다(Google 쪽 인프라 특성 — 우리 코드 버그 아님). 그래서 액션에 안 맞는
 * 응답이 오면 자동으로 재시도한다.
 */
window.CT = window.CT || {};

(function () {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 350;

  function getApiUrl() {
    return (window.CT_CONFIG && window.CT_CONFIG.SHEET_API_URL) || "";
  }

  function isConfigured() {
    return !!getApiUrl();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // echo 리다이렉트가 다른 요청(주로 listRecords)의 응답을 잘못 돌려주는 경우를 감지한다.
  // swapOrder/listRecords는 정상 응답에도 records 배열이 들어있으므로 검사 대상에서 제외한다.
  const NEVER_RETURNS_RECORDS = ["authenticate", "createRecord", "updateRecord", "deleteRecord", "clearMine"];
  function isMisroutedResponse(action, data) {
    return NEVER_RETURNS_RECORDS.includes(action) && !!data && Array.isArray(data.records);
  }

  async function callGet(action) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const url = new URL(getApiUrl());
        url.searchParams.set("action", action);
        // 브라우저가 이전 응답을 캐시해 다른 기록자가 추가한 최신 데이터를 놓치지 않도록
        // 매번 캐시를 건너뛰고, 캐시 히트를 막기 위한 타임스탬프도 함께 붙인다.
        url.searchParams.set("_", Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
        const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
        if (!res.ok) throw new Error("network-error");
        return await res.json();
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) throw err;
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  async function callPost(action, payload) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(getApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(Object.assign({ action }, payload)),
        });
        if (!res.ok) throw new Error("network-error");
        const data = await res.json();
        if (isMisroutedResponse(action, data)) throw new Error("misrouted-response");
        return data;
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) throw err;
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  function listRecords() {
    return callGet("listRecords");
  }
  function authenticate(name, password) {
    return callPost("authenticate", { name, password });
  }
  function createRecord(recorder, token, record) {
    return callPost("createRecord", Object.assign({ recorder, token }, record));
  }
  function updateRecord(recorder, token, id, fields) {
    return callPost("updateRecord", Object.assign({ recorder, token, id }, fields));
  }
  function deleteRecord(recorder, token, id) {
    return callPost("deleteRecord", { recorder, token, id });
  }
  function swapOrder(recorder, token, id, direction) {
    return callPost("swapOrder", { recorder, token, id, direction });
  }
  function clearMine(recorder, token) {
    return callPost("clearMine", { recorder, token });
  }

  CT.remote = { isConfigured, listRecords, authenticate, createRecord, updateRecord, deleteRecord, swapOrder, clearMine };
})();
