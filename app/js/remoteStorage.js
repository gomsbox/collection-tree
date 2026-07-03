/* 원격 백엔드(Google Apps Script) 클라이언트
 * config.js의 SHEET_API_URL이 설정된 경우에만 활성화된다.
 * POST는 Content-Type을 text/plain으로 보내 브라우저의 CORS 프리플라이트(OPTIONS)를
 * 피한다 — Apps Script 웹 앱은 프리플라이트 요청을 안정적으로 처리하지 못한다.
 */
window.CT = window.CT || {};

(function () {
  function getApiUrl() {
    return (window.CT_CONFIG && window.CT_CONFIG.SHEET_API_URL) || "";
  }

  function isConfigured() {
    return !!getApiUrl();
  }

  async function callGet(action) {
    const url = new URL(getApiUrl());
    url.searchParams.set("action", action);
    // 브라우저가 이전 응답을 캐시해 다른 기록자가 추가한 최신 데이터를 놓치지 않도록
    // 매번 캐시를 건너뛰고, 캐시 히트를 막기 위한 타임스탬프도 함께 붙인다.
    url.searchParams.set("_", Date.now().toString(36));
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error("network-error");
    return res.json();
  }

  async function callPost(action, payload) {
    const res = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, payload)),
    });
    if (!res.ok) throw new Error("network-error");
    return res.json();
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
  function deleteRecord(recorder, token, id) {
    return callPost("deleteRecord", { recorder, token, id });
  }
  function swapOrder(recorder, token, id, direction) {
    return callPost("swapOrder", { recorder, token, id, direction });
  }
  function clearMine(recorder, token) {
    return callPost("clearMine", { recorder, token });
  }

  CT.remote = { isConfigured, listRecords, authenticate, createRecord, deleteRecord, swapOrder, clearMine };
})();
