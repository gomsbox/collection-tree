/* 저장/불러오기 어댑터
 * F9(저장/불러오기) 요구사항의 목표 백엔드는 Google Sheets + Apps Script지만,
 * 정적 호스팅 MVP 단계에서는 동일한 인터페이스를 갖는 LocalStorageAdapter를 사용한다.
 * 추후 GoogleSheetsAdapter로 교체하더라도 main.js는 CT.storage.* 호출부를 바꿀 필요가 없다.
 */
window.CT = window.CT || {};

(function () {
  const STORAGE_KEY = "collectionTree.v1";

  const LocalStorageAdapter = {
    loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.records)) return null;
        return parsed;
      } catch (err) {
        console.warn("[storage] 불러오기 실패", err);
        return null;
      }
    },
    saveState(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (err) {
        console.warn("[storage] 저장 실패", err);
        return false;
      }
    },
    clearState() {
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  CT.storage = LocalStorageAdapter;
})();
