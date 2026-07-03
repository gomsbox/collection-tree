/**
 * 나의 수집 자랑하기 — Google Apps Script 백엔드
 *
 * 이 파일을 그대로 Google Sheets의 확장 프로그램 > Apps Script 편집기에 붙여넣고
 * 웹 앱으로 배포하면, app/config.js의 SHEET_API_URL에 배포 URL을 넣는 것만으로
 * 여러 기기/브라우저에서 같은 나무를 실시간으로 공유할 수 있다.
 *
 * 배포 방법은 app/BACKEND_SETUP.md 참고.
 *
 * 시트 구조
 * - Records:   id | name | category | characterStyle | productLink | review | photoUrl | recorder | order | createdAt
 * - Recorders: name | salt | hash | createdAt
 *
 * 인증 방식
 * - 비밀번호는 서버에만 저장하고(salt + SHA-256 해시), 평문은 저장하지 않는다.
 * - 로그인 성공 시 token = SHA256(name + "|" + storedHash)를 계산해 클라이언트에 내려준다.
 *   클라이언트는 이후 수정 요청마다 {recorder, token}을 함께 보내고,
 *   서버는 저장된 해시로 token을 다시 계산해 일치하는지 검증한다(별도 세션 저장소 불필요).
 */

var RECORDS_SHEET = "Records";
var RECORDERS_SHEET = "Recorders";
var RECORDS_HEADERS = ["id", "name", "category", "characterStyle", "productLink", "review", "photoUrl", "recorder", "order", "createdAt"];
var RECORDERS_HEADERS = ["name", "salt", "hash", "createdAt"];

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

/** 배포 전 수동 실행용(선택) — 시트를 미리 만들어 둔다. doGet/doPost도 자동으로 호출한다. */
function setup() {
  getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
  getSheet_(RECORDERS_SHEET, RECORDERS_HEADERS);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    })
    .join("");
}

function genSalt_() {
  return Utilities.getUuid().replace(/-/g, "");
}

function computeToken_(name, hash) {
  return sha256Hex_(name + "|" + hash);
}

function readAllRows_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .map(function (row, i) {
      var obj = {};
      headers.forEach(function (h, j) {
        obj[h] = row[j];
      });
      obj.__row = i + 2; // 실제 시트 행 번호(1-indexed, 헤더 포함)
      return obj;
    })
    .filter(function (obj) {
      return obj.id || obj.name; // 완전히 빈 행은 제외
    });
}

function findRecorderRow_(sheet, name) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (names[i][0] === name) return i + 2;
  }
  return -1;
}

function findRecordRow_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

function verifyToken_(name, token) {
  if (!name || !token) return false;
  var sheet = getSheet_(RECORDERS_SHEET, RECORDERS_HEADERS);
  var row = findRecorderRow_(sheet, name);
  if (row === -1) return false;
  var storedHash = sheet.getRange(row, 3).getValue();
  return computeToken_(name, storedHash) === token;
}

function authenticate_(payload) {
  var name = String(payload.name || "").trim().slice(0, 20);
  var password = String(payload.password || "");
  if (!name || !password) return { ok: false, reason: "invalid" };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(RECORDERS_SHEET, RECORDERS_HEADERS);
    var row = findRecorderRow_(sheet, name);
    if (row === -1) {
      var salt = genSalt_();
      var hash = sha256Hex_(salt + ":" + password);
      sheet.appendRow([name, salt, hash, new Date().toISOString()]);
      return { ok: true, isNew: true, name: name, token: computeToken_(name, hash) };
    }
    var existing = sheet.getRange(row, 1, 1, RECORDERS_HEADERS.length).getValues()[0];
    var existingSalt = existing[1];
    var storedHash = existing[2];
    var computedHash = sha256Hex_(existingSalt + ":" + password);
    if (computedHash !== storedHash) return { ok: false, reason: "wrong-password" };
    return { ok: true, isNew: false, name: name, token: computeToken_(name, storedHash) };
  } finally {
    lock.releaseLock();
  }
}

function listRecords_() {
  var sheet = getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
  var rows = readAllRows_(sheet, RECORDS_HEADERS).map(function (r) {
    delete r.__row;
    return r;
  });
  rows.sort(function (a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
  return { ok: true, records: rows };
}

function createRecord_(payload) {
  if (!verifyToken_(payload.recorder, payload.token)) return { ok: false, reason: "unauthorized" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
    var rows = readAllRows_(sheet, RECORDS_HEADERS);
    var maxOrder = rows.reduce(function (m, r) {
      return Math.max(m, Number(r.order) || 0);
    }, -1);

    var record = {
      id: "item_" + new Date().getTime().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36),
      name: String(payload.name || "").slice(0, 120),
      category: String(payload.category || "").slice(0, 40),
      characterStyle: String(payload.characterStyle || "").slice(0, 40),
      productLink: String(payload.productLink || "").slice(0, 2000),
      review: String(payload.review || "").slice(0, 200),
      photoUrl: payload.photoUrl ? String(payload.photoUrl).slice(0, 45000) : "",
      recorder: payload.recorder,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    sheet.appendRow(
      RECORDS_HEADERS.map(function (h) {
        return record[h];
      })
    );
    return { ok: true, record: record };
  } finally {
    lock.releaseLock();
  }
}

/** payload: { recorder, token, id, name, category, characterStyle, productLink, review, photoUrl } */
function updateRecord_(payload) {
  if (!verifyToken_(payload.recorder, payload.token)) return { ok: false, reason: "unauthorized" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
    var row = findRecordRow_(sheet, payload.id);
    if (row === -1) return { ok: false, reason: "not-found" };

    var existing = sheet.getRange(row, 1, 1, RECORDS_HEADERS.length).getValues()[0];
    var record = {};
    RECORDS_HEADERS.forEach(function (h, i) {
      record[h] = existing[i];
    });
    if (record.recorder !== payload.recorder) return { ok: false, reason: "forbidden" };

    record.name = String(payload.name || "").slice(0, 120);
    record.category = String(payload.category || "").slice(0, 40);
    record.characterStyle = String(payload.characterStyle || "").slice(0, 40);
    record.productLink = String(payload.productLink || "").slice(0, 2000);
    record.review = String(payload.review || "").slice(0, 200);
    record.photoUrl = payload.photoUrl ? String(payload.photoUrl).slice(0, 45000) : "";
    // id / recorder / order / createdAt은 그대로 유지한다.

    sheet.getRange(row, 1, 1, RECORDS_HEADERS.length).setValues([
      RECORDS_HEADERS.map(function (h) {
        return record[h];
      }),
    ]);
    return { ok: true, record: record };
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(payload) {
  if (!verifyToken_(payload.recorder, payload.token)) return { ok: false, reason: "unauthorized" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
    var row = findRecordRow_(sheet, payload.id);
    if (row === -1) return { ok: false, reason: "not-found" };
    var ownerCol = RECORDS_HEADERS.indexOf("recorder") + 1;
    var owner = sheet.getRange(row, ownerCol).getValue();
    if (owner !== payload.recorder) return { ok: false, reason: "forbidden" };
    sheet.deleteRow(row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** payload: { recorder, token, id, direction: 1 | -1 } — 등록 순서(겹침 순서) 앞/뒤 교환 */
function swapOrder_(payload) {
  if (!verifyToken_(payload.recorder, payload.token)) return { ok: false, reason: "unauthorized" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
    var rows = readAllRows_(sheet, RECORDS_HEADERS);
    rows.sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    var idx = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === payload.id) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return { ok: false, reason: "not-found" };
    if (rows[idx].recorder !== payload.recorder) return { ok: false, reason: "forbidden" };

    var targetIdx = idx + Number(payload.direction);
    if (targetIdx < 0 || targetIdx >= rows.length) {
      rows.forEach(function (r) {
        delete r.__row;
      });
      return { ok: true, records: rows };
    }

    var orderCol = RECORDS_HEADERS.indexOf("order") + 1;
    var tmpOrder = rows[idx].order;
    rows[idx].order = rows[targetIdx].order;
    rows[targetIdx].order = tmpOrder;
    sheet.getRange(rows[idx].__row, orderCol).setValue(rows[idx].order);
    sheet.getRange(rows[targetIdx].__row, orderCol).setValue(rows[targetIdx].order);

    rows.sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    rows.forEach(function (r) {
      delete r.__row;
    });
    return { ok: true, records: rows };
  } finally {
    lock.releaseLock();
  }
}

function clearMine_(payload) {
  if (!verifyToken_(payload.recorder, payload.token)) return { ok: false, reason: "unauthorized" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_(RECORDS_SHEET, RECORDS_HEADERS);
    var rows = readAllRows_(sheet, RECORDS_HEADERS);
    for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i].recorder === payload.recorder) {
        sheet.deleteRow(rows[i].__row);
      }
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  setup();
  var action = (e && e.parameter && e.parameter.action) || "listRecords";
  if (action === "listRecords") return jsonResponse_(listRecords_());
  return jsonResponse_({ ok: false, reason: "unknown-action" });
}

function doPost(e) {
  setup();
  var payload = {};
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, reason: "bad-request" });
  }
  switch (payload.action) {
    case "authenticate":
      return jsonResponse_(authenticate_(payload));
    case "createRecord":
      return jsonResponse_(createRecord_(payload));
    case "updateRecord":
      return jsonResponse_(updateRecord_(payload));
    case "deleteRecord":
      return jsonResponse_(deleteRecord_(payload));
    case "swapOrder":
      return jsonResponse_(swapOrder_(payload));
    case "clearMine":
      return jsonResponse_(clearMine_(payload));
    default:
      return jsonResponse_({ ok: false, reason: "unknown-action" });
  }
}
