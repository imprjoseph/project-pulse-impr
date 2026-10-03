const SPREADSHEET_ID = '1Fckp1WwVp8WM7d3tuu-yNyXviDVBn1zr0huhHiJTAP8';
const SHEETS = {
  accounts: '網站_帳號',
  reports: '網站_週報',
  worklogs: '網站_工時明細',
  projects: '網站_專案進度',
  audit: '網站_系統紀錄',
};
const SESSION_SECONDS = 21600;

const PROJECT_SHEET_NAME_PATTERN = /^\d{3}_/;
const PROJECT_HEADER_ROW = 6;
const PROJECT_FIRST_DATA_ROW = 7;
const PROJECT_SYSTEM_COLUMN_COUNT = 3;
const PROJECT_LAST_COLUMN = 23;
const PROJECT_FORMAT_REFERENCE_SHEET = '013_國土署個資教育訓';

/**
 * Keep every per-project sheet consistent when the workbook is opened.
 * The structural-change trigger installed by installProjectSheetAutomation()
 * also runs this immediately after a project sheet is created or renamed.
 */
function onOpen() {
  normalizeProjectSheets_();
}

function installProjectSheetAutomation() {
  const handler = 'onProjectStructureChange_';
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(handler)
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();
  normalizeProjectSheets_();
  return '專案分頁自動整理已啟用';
}

function onProjectStructureChange_() {
  normalizeProjectSheets_();
}

/**
 * When a user starts entering a work item in columns D:W, generate the hidden
 * system fields in A:C. Existing task IDs are never replaced.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!isProjectSheet_(sheet)) return;

  normalizeProjectSheet_(sheet);
  if (e.range.getLastRow() < PROJECT_FIRST_DATA_ROW ||
      e.range.getColumn() > PROJECT_LAST_COLUMN ||
      e.range.getLastColumn() < 4) return;

  const firstRow = Math.max(PROJECT_FIRST_DATA_ROW, e.range.getRow());
  const lastRow = e.range.getLastRow();
  fillProjectSystemColumns_(sheet, firstRow, lastRow);
}

function normalizeProjectSheets_() {
  SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .filter(isProjectSheet_)
    .forEach(normalizeProjectSheet_);
}

function normalizeProjectSheet_(sheet) {
  sheet.setFrozenRows(PROJECT_HEADER_ROW);
  sheet.setHiddenGridlines(false);
  sheet.hideColumns(1, PROJECT_SYSTEM_COLUMN_COUNT);

  const reference = sheet.getParent().getSheetByName(PROJECT_FORMAT_REFERENCE_SHEET);
  if (!reference || reference.getSheetId() === sheet.getSheetId()) return;
  for (let column = 1; column <= sheet.getMaxColumns(); column += 1) {
    sheet.setColumnWidth(column, reference.getColumnWidth(column));
  }
  for (let row = 1; row <= PROJECT_HEADER_ROW; row += 1) {
    sheet.setRowHeight(row, reference.getRowHeight(row));
  }
}

function fillProjectSystemColumns_(sheet, firstRow, lastRow) {
  const rowCount = lastRow - firstRow + 1;
  if (rowCount < 1) return;

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const values = sheet.getRange(firstRow, 1, rowCount, PROJECT_LAST_COLUMN).getValues();
    const eventId = String(sheet.getRange('B3').getDisplayValue() || '').trim();
    const eventName = String(sheet.getRange('A1').getDisplayValue() || '')
      .replace(/^活動工作進度[｜|]\s*/, '')
      .trim();
    let nextNumber = getHighestTaskNumber_() + 1;
    let changed = false;

    values.forEach((row) => {
      const hasWorkData = row.slice(3).some((value) => value !== '' && value !== null);
      if (!hasWorkData) return;
      if (!row[0]) row[0] = 'T-' + String(nextNumber++).padStart(3, '0');
      if (row[1] !== eventId) row[1] = eventId;
      if (row[2] !== eventName) row[2] = eventName;
      changed = true;
    });

    if (changed) {
      sheet.getRange(firstRow, 1, rowCount, PROJECT_SYSTEM_COLUMN_COUNT)
        .setValues(values.map((row) => row.slice(0, PROJECT_SYSTEM_COLUMN_COUNT)));
    }
  } finally {
    lock.releaseLock();
  }
}

function getHighestTaskNumber_() {
  let highest = 0;
  SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .filter(isProjectSheet_)
    .forEach((sheet) => {
      const lastRow = sheet.getLastRow();
      if (lastRow < PROJECT_FIRST_DATA_ROW) return;
      sheet.getRange(PROJECT_FIRST_DATA_ROW, 1, lastRow - PROJECT_FIRST_DATA_ROW + 1, 1)
        .getDisplayValues()
        .forEach((row) => {
          const match = String(row[0] || '').match(/^T-(\d+)$/);
          if (match) highest = Math.max(highest, Number(match[1]));
        });
    });
  return highest;
}

function isProjectSheet_(sheet) {
  return PROJECT_SHEET_NAME_PATTERN.test(sheet.getName());
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Project Pulse API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiCall(request) {
  if (!request || typeof request !== 'object') throw new Error('請求格式錯誤');
  const action = String(request.action || '');
  if (action === 'login') return login_(request.payload || {});
  const viewer = requireSession_(request.token);
  if (action === 'bootstrap') return bootstrap_(viewer);
  if (action === 'saveWeekly') return saveWeekly_(viewer, request.payload || {});
  if (action === 'updateProject') return updateProject_(viewer, request.payload || {});
  if (action === 'listAccounts') return listAccounts_(viewer);
  if (action === 'saveAccount') return saveAccount_(viewer, request.payload || {});
  if (action === 'logout') return logout_(request.token, viewer);
  throw new Error('不支援的操作');
}

function login_(payload) {
  const account = String(payload.account || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!account || !password) throw new Error('請輸入帳號與密碼');

  const sheet = sheet_(SHEETS.accounts);
  const data = table_(sheet);
  const rowIndex = data.rows.findIndex((row) => String(row.login_account || '').trim().toLowerCase() === account);
  if (rowIndex < 0) {
    audit_('', account, '登入', '帳號', '', '失敗', '帳號或密碼錯誤');
    throw new Error('帳號或密碼錯誤');
  }

  const row = data.rows[rowIndex];
  if (row.status !== '啟用') throw new Error('此帳號目前無法登入');
  const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) throw new Error('帳號暫時鎖定，請稍後再試');

  if (String(row.password || '') !== password) {
    const attempts = Number(row.failed_attempts || 0) + 1;
    const lockValue = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : '';
    sheet.getRange(rowIndex + 2, data.headers.failed_attempts + 1).setValue(attempts);
    sheet.getRange(rowIndex + 2, data.headers.locked_until + 1).setValue(lockValue);
    audit_(row.account_id, row.display_name, '登入', '帳號', row.account_id, '失敗', '密碼錯誤');
    throw new Error(attempts >= 5 ? '密碼錯誤次數過多，帳號已鎖定 15 分鐘' : '帳號或密碼錯誤');
  }

  const now = new Date();
  sheet.getRange(rowIndex + 2, data.headers.last_login_at + 1).setValue(now);
  sheet.getRange(rowIndex + 2, data.headers.failed_attempts + 1).setValue(0);
  sheet.getRange(rowIndex + 2, data.headers.locked_until + 1).clearContent();

  const viewer = publicAccount_(row);
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('session:' + token, JSON.stringify(viewer), SESSION_SECONDS);
  audit_(viewer.accountId, viewer.displayName, '登入', '帳號', viewer.accountId, '成功', '');
  return { ok: true, token: token, viewer: viewer };
}

function bootstrap_(viewer) {
  const projects = table_(sheet_(SHEETS.projects)).rows.map(projectForClient_);
  const reports = table_(sheet_(SHEETS.reports)).rows
    .filter((row) => row.account_id === viewer.accountId)
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
    .slice(0, 8);
  const worklogs = table_(sheet_(SHEETS.worklogs)).rows;

  const projectStats = projects.map((project) => {
    const logs = worklogs.filter((row) => row.project_id === project.id);
    return Object.assign({}, project, {
      regularHours: sum_(logs, 'regular_hours'),
      overtimeHours: sum_(logs, 'overtime_hours'),
      nextWeekHours: sum_(logs, 'next_week_hours'),
      contributorCount: new Set(logs.map((row) => row.account_id).filter(Boolean)).size,
    });
  });

  return {
    viewer: viewer,
    projects: projectStats,
    reports: reports.map((row) => ({
      id: row.report_id,
      weekStart: isoDate_(row.week_start),
      highlights: row.highlights || '',
      blockers: row.blockers || '',
      nextWeekFocus: row.next_week_focus || '',
      updatedAt: isoDateTime_(row.updated_at),
    })),
  };
}

function saveWeekly_(viewer, payload) {
  const weekStart = String(payload.weekStart || '');
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !entries.length || entries.length > 30) {
    throw new Error('請確認週次與工項內容');
  }
  const projectRows = table_(sheet_(SHEETS.projects)).rows;
  const projectMap = {};
  projectRows.forEach((row) => { projectMap[row.project_id] = row; });
  entries.forEach((entry) => {
    const regular = Number(entry.regularHours || 0);
    const overtime = Number(entry.overtimeHours || 0);
    if (!projectMap[entry.projectId] || !String(entry.taskName || '').trim() || regular + overtime <= 0) {
      throw new Error('每個工項都需選擇專案、填寫工作內容與工時');
    }
    if (overtime > 0 && !entry.overtimeReason) throw new Error('加班工項必須填寫加班原因');
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const reportId = viewer.accountId + ':' + weekStart;
    upsertByKey_(SHEETS.reports, 'report_id', reportId, {
      report_id: reportId,
      week_start: weekStart,
      account_id: viewer.accountId,
      user_name: viewer.displayName,
      user_email: viewer.email,
      highlights: clean_(payload.highlights, 1000),
      blockers: clean_(payload.blockers, 1000),
      next_week_focus: clean_(payload.nextWeekFocus, 1000),
      submitted_at: new Date(),
      updated_at: new Date(),
    });
    deleteByValue_(SHEETS.worklogs, 'report_id', reportId);
    const rows = entries.map((entry, index) => ({
      log_id: reportId + ':' + (index + 1),
      report_id: reportId,
      week_start: weekStart,
      account_id: viewer.accountId,
      project_id: entry.projectId,
      project_name: projectMap[entry.projectId].project_name,
      category: clean_(entry.category, 60),
      task_name: clean_(entry.taskName, 200),
      regular_hours: Number(entry.regularHours || 0),
      overtime_hours: Number(entry.overtimeHours || 0),
      overtime_reason: clean_(entry.overtimeReason, 100),
      progress: clean_(entry.progress, 100),
      difficulty_type: clean_(entry.difficultyType || '無', 100),
      difficulty_note: clean_(entry.difficultyNote, 500),
      support_needed: clean_(entry.supportNeeded, 500),
      next_week_hours: Number(entry.nextWeekHours || 0),
      created_at: new Date(),
    }));
    appendObjects_(SHEETS.worklogs, rows);
    audit_(viewer.accountId, viewer.displayName, '儲存週報', '週報', reportId, '成功', entries.length + ' 個工項');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function updateProject_(viewer, payload) {
  if (viewer.role !== '管理員' && viewer.role !== '專案主管') throw new Error('您沒有更新專案的權限');
  const projectId = String(payload.projectId || '');
  if (!projectId) throw new Error('請選擇專案');
  const updates = {
    activity_date: payload.activityDate || '',
    status: clean_(payload.status, 40),
    progress_note: clean_(payload.progressNote, 500),
    updated_by: viewer.displayName,
    updated_at: new Date(),
  };
  updateFieldsByKey_(SHEETS.projects, 'project_id', projectId, updates);
  const source = table_(sheet_(SHEETS.projects)).rows.find((row) => row.project_id === projectId);
  appendObjects_(SHEETS.projects, []);
  audit_(viewer.accountId, viewer.displayName, '更新專案', '專案', projectId, '成功', source ? source.project_name : '');
  return { ok: true };
}

function listAccounts_(viewer) {
  requireAdmin_(viewer);
  return table_(sheet_(SHEETS.accounts)).rows.map((row) => ({
    accountId: row.account_id,
    account: row.login_account,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    department: row.department,
    password: row.password,
    lastLoginAt: isoDateTime_(row.last_login_at),
    notes: row.notes || '',
  }));
}

function saveAccount_(viewer, payload) {
  requireAdmin_(viewer);
  const loginAccount = clean_(payload.account, 80).toLowerCase();
  const password = String(payload.password || '');
  const displayName = clean_(payload.displayName, 100);
  if (!loginAccount || !password || !displayName) throw new Error('帳號、密碼與姓名為必填');
  const accountId = payload.accountId || ('USR-' + Utilities.getUuid().slice(0, 8).toUpperCase());
  const existing = table_(sheet_(SHEETS.accounts)).rows.find((row) =>
    String(row.login_account || '').toLowerCase() === loginAccount && row.account_id !== accountId);
  if (existing) throw new Error('此登入帳號已存在');
  upsertByKey_(SHEETS.accounts, 'account_id', accountId, {
    account_id: accountId,
    login_account: loginAccount,
    display_name: displayName,
    email: clean_(payload.email, 160),
    role: payload.role || '一般同仁',
    status: payload.status || '啟用',
    department: clean_(payload.department, 100),
    password: password,
    updated_at: new Date(),
    created_at: payload.createdAt || new Date(),
    created_by: viewer.displayName,
    notes: clean_(payload.notes, 500),
  });
  audit_(viewer.accountId, viewer.displayName, '儲存帳號', '帳號', accountId, '成功', loginAccount);
  return { ok: true, accountId: accountId };
}

function logout_(token, viewer) {
  CacheService.getScriptCache().remove('session:' + token);
  audit_(viewer.accountId, viewer.displayName, '登出', '帳號', viewer.accountId, '成功', '');
  return { ok: true };
}

function requireSession_(token) {
  const value = token && CacheService.getScriptCache().get('session:' + token);
  if (!value) throw new Error('登入已逾時，請重新登入');
  CacheService.getScriptCache().put('session:' + token, value, SESSION_SECONDS);
  return JSON.parse(value);
}

function requireAdmin_(viewer) {
  if (viewer.role !== '管理員') throw new Error('僅管理員可使用帳號管理');
}

function publicAccount_(row) {
  return {
    accountId: row.account_id,
    account: row.login_account,
    displayName: row.display_name,
    email: row.email || '',
    role: row.role || '一般同仁',
    department: row.department || '',
  };
}

function projectForClient_(row) {
  return {
    id: row.project_id,
    name: row.project_name,
    client: row.client || '',
    pmName: row.pm_name || '',
    activityDate: isoDate_(row.activity_date),
    status: row.status || '規劃中',
    progressNote: row.progress_note || '',
    updatedBy: row.updated_by || '',
    updatedAt: isoDateTime_(row.updated_at),
  };
}

function sheet_(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('找不到後台分頁：' + name);
  return sheet;
}

function table_(sheet) {
  const values = sheet.getDataRange().getValues();
  const names = (values[0] || []).map(String);
  const headers = {};
  names.forEach((name, index) => { if (name) headers[name] = index; });
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => {
    const object = {};
    names.forEach((name, index) => { if (name) object[name] = row[index]; });
    return object;
  });
  return { names: names, headers: headers, rows: rows };
}

function appendObjects_(sheetName, objects) {
  if (!objects.length) return;
  const sheet = sheet_(sheetName);
  const data = table_(sheet);
  const values = objects.map((object) => data.names.map((name) => object[name] === undefined ? '' : object[name]));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, data.names.length).setValues(values);
}

function upsertByKey_(sheetName, keyName, keyValue, object) {
  const sheet = sheet_(sheetName);
  const data = table_(sheet);
  const index = data.rows.findIndex((row) => String(row[keyName]) === String(keyValue));
  const values = data.names.map((name) => object[name] === undefined ? (index >= 0 ? data.rows[index][name] : '') : object[name]);
  sheet.getRange(index >= 0 ? index + 2 : sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
}

function updateFieldsByKey_(sheetName, keyName, keyValue, updates) {
  const sheet = sheet_(sheetName);
  const data = table_(sheet);
  const index = data.rows.findIndex((row) => String(row[keyName]) === String(keyValue));
  if (index < 0) throw new Error('找不到指定資料');
  Object.keys(updates).forEach((name) => {
    if (data.headers[name] === undefined) return;
    sheet.getRange(index + 2, data.headers[name] + 1).setValue(updates[name]);
  });
}

function deleteByValue_(sheetName, columnName, value) {
  const sheet = sheet_(sheetName);
  const data = table_(sheet);
  const kept = data.rows.filter((row) => String(row[columnName]) !== String(value));
  const bodyRows = Math.max(sheet.getLastRow() - 1, 0);
  if (bodyRows) sheet.getRange(2, 1, bodyRows, data.names.length).clearContent();
  if (kept.length) {
    sheet.getRange(2, 1, kept.length, data.names.length)
      .setValues(kept.map((row) => data.names.map((name) => row[name] === undefined ? '' : row[name])));
  }
}

function audit_(accountId, userName, action, entityType, entityId, result, details) {
  appendObjects_(SHEETS.audit, [{
    log_id: Utilities.getUuid(),
    timestamp: new Date(),
    account_id: accountId || '',
    user_name: userName || '',
    action: action,
    entity_type: entityType,
    entity_id: entityId || '',
    result: result,
    request_id: Utilities.getUuid(),
    details: details || '',
  }]);
}

function sum_(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

function clean_(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function isoDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value).slice(0, 10) : Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd');
}

function isoDateTime_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : Utilities.formatDate(date, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
}
