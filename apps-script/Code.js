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
const PROJECT_FORMAT_REFERENCE_BLANK_ROW = 14;

/**
 * Keep every per-project sheet's basic layout consistent when the workbook is
 * opened. Authorized installable triggers handle full formatting and tables.
 */
function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .filter(isProjectSheet_)
    .forEach(normalizeProjectSheetLayout_);
}

function ensureWeeklyReportColumns() {
  ensureColumns_(SHEETS.reports, ['report_date', 'week_status', 'status_note']);
  return '週報日期與週間狀態欄位已建立';
}

function installProjectSheetAutomation() {
  const handlers = new Set([
    'handleProjectSheetChange',
    'handleProjectSheetOpen',
    'handleProjectSheetEdit',
  ]);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => handlers.has(trigger.getHandlerFunction()))
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('handleProjectSheetChange')
    .forSpreadsheet(spreadsheet)
    .onChange()
    .create();
  ScriptApp.newTrigger('handleProjectSheetOpen')
    .forSpreadsheet(spreadsheet)
    .onOpen()
    .create();
  ScriptApp.newTrigger('handleProjectSheetEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
  repairAllProjectSheets();
  return '專案分頁格式、欄位與原生表格自動整理已啟用';
}

function handleProjectSheetOpen() {
  repairAllProjectSheets();
}

function handleProjectSheetChange() {
  repairAllProjectSheets();
}

function handleProjectSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!isProjectSheet_(sheet)) return;
  normalizeProjectSheet_(sheet);
  normalizeProjectNativeTables_([sheet]);
}

function repairAllProjectSheets() {
  const projectSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets()
    .filter(isProjectSheet_);
  projectSheets.forEach(normalizeProjectSheet_);
  normalizeProjectNativeTables_(projectSheets);
  return '所有專案分頁格式已完成同步';
}

/**
 * When a user starts entering a work item in columns D:W, generate the hidden
 * system fields in A:C. Existing task IDs are never replaced.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!isProjectSheet_(sheet)) return;

  normalizeProjectSheetLayout_(sheet);
  if (e.range.getLastRow() < PROJECT_FIRST_DATA_ROW ||
      e.range.getColumn() > PROJECT_LAST_COLUMN ||
      e.range.getLastColumn() < 4) return;

  const firstRow = Math.max(PROJECT_FIRST_DATA_ROW, e.range.getRow());
  const lastRow = e.range.getLastRow();
  fillProjectSystemColumns_(sheet, firstRow, lastRow);
}

function normalizeProjectSheet_(sheet) {
  normalizeProjectSheetLayout_(sheet);

  const reference = sheet.getParent().getSheetByName(PROJECT_FORMAT_REFERENCE_SHEET);
  if (!reference || reference.getSheetId() === sheet.getSheetId() ||
      !needsProjectFormatRepair_(sheet)) return;

  reference.getRange(1, 1, PROJECT_HEADER_ROW, PROJECT_LAST_COLUMN)
    .copyFormatToRange(
      sheet.getSheetId(),
      1,
      PROJECT_LAST_COLUMN,
      1,
      PROJECT_HEADER_ROW
    );
  reference.getRange(
    PROJECT_FORMAT_REFERENCE_BLANK_ROW,
    1,
    1,
    PROJECT_LAST_COLUMN
  ).copyFormatToRange(
    sheet.getSheetId(),
    1,
    PROJECT_LAST_COLUMN,
    PROJECT_FIRST_DATA_ROW,
    sheet.getMaxRows()
  );

  const validationTemplate = reference.getRange(
    PROJECT_FORMAT_REFERENCE_BLANK_ROW,
    1,
    1,
    PROJECT_LAST_COLUMN
  ).getDataValidations()[0];
  const validationRows = Array.from(
    { length: sheet.getMaxRows() - PROJECT_HEADER_ROW },
    () => validationTemplate.slice()
  );
  sheet.getRange(
    PROJECT_FIRST_DATA_ROW,
    1,
    validationRows.length,
    PROJECT_LAST_COLUMN
  ).setDataValidations(validationRows);

  const rules = reference.getConditionalFormatRules().map((rule) => {
    const targetRanges = rule.getRanges().map((range) => sheet.getRange(
      range.getRow(),
      range.getColumn(),
      range.getNumRows(),
      range.getNumColumns()
    ));
    return rule.copy().setRanges(targetRanges).build();
  });
  sheet.setConditionalFormatRules(rules);

  for (let column = 1; column <= sheet.getMaxColumns(); column += 1) {
    sheet.setColumnWidth(column, reference.getColumnWidth(column));
  }
  for (let row = 1; row <= PROJECT_HEADER_ROW; row += 1) {
    sheet.setRowHeight(row, reference.getRowHeight(row));
  }
}

function normalizeProjectSheetLayout_(sheet) {
  sheet.setFrozenRows(PROJECT_HEADER_ROW);
  sheet.setHiddenGridlines(false);
  sheet.hideColumns(1, PROJECT_SYSTEM_COLUMN_COUNT);
}

function needsProjectFormatRepair_(sheet) {
  const validations = sheet.getRange(
    PROJECT_FIRST_DATA_ROW,
    4,
    1,
    8
  ).getDataValidations()[0];
  return [0, 2, 3, 6, 7].some((index) => !validations[index]);
}

function normalizeProjectNativeTables_(projectSheets) {
  if (!projectSheets.length) return;
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const resource = Sheets.Spreadsheets.get(spreadsheet.getId(), {
    fields: 'sheets(properties(sheetId,title),tables)',
  });
  const tablesBySheetId = {};
  (resource.sheets || []).forEach((item) => {
    tablesBySheetId[item.properties.sheetId] = item.tables || [];
  });

  const referenceSheet = spreadsheet.getSheetByName(PROJECT_FORMAT_REFERENCE_SHEET);
  const referenceTable = referenceSheet
    ? (tablesBySheetId[referenceSheet.getSheetId()] || [])[0]
    : null;
  const requests = [];

  projectSheets.forEach((sheet) => {
    const tableRange = getProjectTableRange_(sheet);
    const tables = tablesBySheetId[sheet.getSheetId()] || [];
    if (tables.length) {
      requests.push({
        updateTable: {
          table: {
            tableId: tables[0].tableId,
            range: tableRange,
          },
          fields: 'range',
        },
      });
      return;
    }
    if (!referenceTable) return;
    requests.push({
      addTable: {
        table: {
          name: 'Project_' + sheet.getSheetId(),
          range: tableRange,
          rowsProperties: referenceTable.rowsProperties,
          columnProperties: referenceTable.columnProperties,
        },
      },
    });
  });

  if (requests.length) {
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, spreadsheet.getId());
  }
}

function getProjectTableRange_(sheet) {
  const scanLastRow = Math.max(sheet.getLastRow(), PROJECT_FIRST_DATA_ROW);
  const values = sheet.getRange(
    PROJECT_FIRST_DATA_ROW,
    4,
    scanLastRow - PROJECT_HEADER_ROW,
    PROJECT_LAST_COLUMN - 3
  ).getDisplayValues();
  let lastDataRow = PROJECT_FIRST_DATA_ROW;
  values.forEach((row, index) => {
    if (row.some((value) => value !== '')) {
      lastDataRow = PROJECT_FIRST_DATA_ROW + index;
    }
  });
  return {
    sheetId: sheet.getSheetId(),
    startRowIndex: PROJECT_HEADER_ROW - 1,
    endRowIndex: lastDataRow,
    startColumnIndex: 0,
    endColumnIndex: PROJECT_LAST_COLUMN,
  };
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

function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'portal') {
    return HtmlService.createHtmlOutputFromFile('Portal')
      .setTitle('人力投入管理｜Project Pulse')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (e && e.parameter && e.parameter.mode === 'poll') {
    const requestId = String(e.parameter.requestId || '');
    const callback = String(e.parameter.callback || '');
    if (!/^[a-zA-Z_$][0-9a-zA-Z_$]{0,100}$/.test(callback) ||
        !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return ContentService.createTextOutput('/* invalid poll request */')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    const cache = CacheService.getScriptCache();
    const key = 'response:' + requestId;
    const value = cache.get(key);
    if (value) cache.remove(key);
    return jsonp_(callback, value ? JSON.parse(value) : null);
  }
  return HtmlService.createHtmlOutputFromFile('Bridge')
    .setTitle('Project Pulse API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Receive GitHub Pages requests through a hidden form POST. The response is
 * kept briefly in Script Cache and retrieved with a JSONP poll. This avoids
 * Apps Script's nested iframe boundary without putting credentials in a URL.
 */
function doPost(e) {
  const allowedOrigins = [
    'https://imprjoseph.github.io',
    'https://project-pulse-impr.impr-joseph.chatgpt.site',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  const origin = String(e && e.parameter && e.parameter.origin || '');
  const requestId = String(e && e.parameter && e.parameter.requestId || '');
  let message;

  if (allowedOrigins.indexOf(origin) < 0) {
    message = {
      type: 'PROJECT_PULSE_RESPONSE',
      requestId: requestId,
      ok: false,
      error: '不允許的網站來源',
    };
  } else {
    try {
      const request = JSON.parse(String(e.parameter.request || '{}'));
      message = {
        type: 'PROJECT_PULSE_RESPONSE',
        requestId: requestId,
        ok: true,
        result: apiCall(request),
      };
    } catch (error) {
      message = {
        type: 'PROJECT_PULSE_RESPONSE',
        requestId: requestId,
        ok: false,
        error: error && error.message ? error.message : '後端服務暫時無法使用',
      };
    }
  }

  if (/^[0-9a-f-]{36}$/i.test(requestId)) {
    CacheService.getScriptCache().put(
      'response:' + requestId,
      JSON.stringify(message),
      60
    );
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><title>Project Pulse API</title>' +
    '<p>Request completed.</p>'
  ).setTitle('Project Pulse API')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonp_(callback, value) {
  const json = JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function apiCall(request) {
  if (!request || typeof request !== 'object') throw new Error('請求格式錯誤');
  const action = String(request.action || '');
  if (action === 'login') return login_(request.payload || {});
  if (action === 'loginAndBootstrap') return loginAndBootstrap_(request.payload || {});
  const viewer = requireSession_(request.token);
  if (action === 'bootstrap') return bootstrap_(viewer);
  if (action === 'saveWeekly') return saveWeekly_(viewer, request.payload || {});
  if (action === 'teamWeekly') return teamWeekly_(viewer, request.payload || {});
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
  const updatedRow = data.names.map((name) => row[name] === undefined ? '' : row[name]);
  updatedRow[data.headers.last_login_at] = now;
  updatedRow[data.headers.failed_attempts] = 0;
  updatedRow[data.headers.locked_until] = '';
  sheet.getRange(rowIndex + 2, 1, 1, updatedRow.length).setValues([updatedRow]);

  const viewer = publicAccount_(row);
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('session:' + token, JSON.stringify(viewer), SESSION_SECONDS);
  audit_(viewer.accountId, viewer.displayName, '登入', '帳號', viewer.accountId, '成功', '');
  return { ok: true, token: token, viewer: viewer };
}

function loginAndBootstrap_(payload) {
  const account = String(payload.account || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!account || !password) throw new Error('請輸入帳號與密碼');

  const tables = batchTables_([SHEETS.accounts, SHEETS.projects, SHEETS.reports, SHEETS.worklogs]);
  const accountTable = tables[SHEETS.accounts];
  const rowIndex = accountTable.rows.findIndex((row) =>
    String(row.login_account || '').trim().toLowerCase() === account);
  if (rowIndex < 0) throw new Error('帳號或密碼錯誤');

  const row = accountTable.rows[rowIndex];
  if (row.status !== '啟用') throw new Error('此帳號目前無法登入');
  const lockedUntil = row.locked_until ? new Date(row.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) throw new Error('帳號暫時鎖定，請稍後再試');
  if (String(row.password || '') !== password) {
    const attempts = Number(row.failed_attempts || 0) + 1;
    const lockValue = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : '';
    const accountSheet = sheet_(SHEETS.accounts);
    accountSheet.getRange(rowIndex + 2, accountTable.headers.failed_attempts + 1).setValue(attempts);
    accountSheet.getRange(rowIndex + 2, accountTable.headers.locked_until + 1).setValue(lockValue);
    throw new Error(attempts >= 5 ? '密碼錯誤次數過多，帳號已鎖定 15 分鐘' : '帳號或密碼錯誤');
  }
  if (Number(row.failed_attempts || 0) > 0 || row.locked_until) {
    const accountSheet = sheet_(SHEETS.accounts);
    accountSheet.getRange(rowIndex + 2, accountTable.headers.failed_attempts + 1).setValue(0);
    accountSheet.getRange(rowIndex + 2, accountTable.headers.locked_until + 1).setValue('');
  }

  const viewer = publicAccount_(row);
  const token = Utilities.getUuid() + Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put('session:' + token, JSON.stringify(viewer), SESSION_SECONDS);
  cache.put('last-login:' + viewer.accountId, isoDateTime_(new Date()), SESSION_SECONDS);
  return Object.assign({ token: token }, bootstrapFromTables_(viewer, tables));
}

function bootstrap_(viewer) {
  const tables = batchTables_([SHEETS.projects, SHEETS.reports, SHEETS.worklogs]);
  return bootstrapFromTables_(viewer, tables);
}

function bootstrapFromTables_(viewer, tables) {
  const projects = tables[SHEETS.projects].rows.map(projectForClient_);
  const reports = tables[SHEETS.reports].rows
    .filter((row) => row.account_id === viewer.accountId)
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
    .slice(0, 8);
  const worklogs = tables[SHEETS.worklogs].rows;
  const totalsByProject = {};
  worklogs.forEach((row) => {
    const projectId = row.project_id;
    if (!projectId) return;
    const totals = totalsByProject[projectId] || {
      regularHours: 0,
      overtimeHours: 0,
      nextWeekHours: 0,
      contributors: {},
    };
    totals.regularHours += Number(row.regular_hours || 0);
    totals.overtimeHours += Number(row.overtime_hours || 0);
    totals.nextWeekHours += Number(row.next_week_hours || 0);
    if (row.account_id) totals.contributors[row.account_id] = true;
    totalsByProject[projectId] = totals;
  });
  const projectStats = projects.map((project) => {
    const totals = totalsByProject[project.id] || {
      regularHours: 0,
      overtimeHours: 0,
      nextWeekHours: 0,
      contributors: {},
    };
    return Object.assign({}, project, {
      regularHours: totals.regularHours,
      overtimeHours: totals.overtimeHours,
      nextWeekHours: totals.nextWeekHours,
      contributorCount: Object.keys(totals.contributors).length,
    });
  });

  return {
    viewer: viewer,
    projects: projectStats,
    reports: reports.map((row) => ({
      id: row.report_id,
      weekStart: isoDate_(row.week_start),
      reportDate: isoDate_(row.report_date),
      weekStatus: row.week_status || '無請假／出差',
      statusNote: row.status_note || '',
      highlights: row.highlights || '',
      blockers: row.blockers || '',
      nextWeekFocus: row.next_week_focus || '',
      updatedAt: isoDateTime_(row.updated_at),
    })),
  };
}

function saveWeekly_(viewer, payload) {
  const weekStart = String(payload.weekStart || '');
  const reportDate = String(payload.reportDate || '');
  const weekStatus = String(payload.weekStatus || '無請假／出差');
  const allowedWeekStatuses = ['無請假／出差', '有請假', '有出差', '請假及出差'];
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate) ||
      !allowedWeekStatuses.includes(weekStatus) || !entries.length || entries.length > 30) {
    throw new Error('請確認週次與工項內容');
  }
  if (weekStatus !== '無請假／出差' && !String(payload.statusNote || '').trim()) {
    throw new Error('請填寫請假或出差的日期與說明');
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
    ensureWeeklyReportColumns();
    const reportId = viewer.accountId + ':' + weekStart;
    upsertByKey_(SHEETS.reports, 'report_id', reportId, {
      report_id: reportId,
      week_start: weekStart,
      report_date: reportDate,
      week_status: weekStatus,
      status_note: clean_(payload.statusNote, 500),
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
  const cache = CacheService.getScriptCache();
  return table_(sheet_(SHEETS.accounts)).rows.map((row) => ({
    accountId: row.account_id,
    account: row.login_account,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    department: row.department,
    password: row.password,
    lastLoginAt: cache.get('last-login:' + row.account_id) || isoDateTime_(row.last_login_at),
    notes: row.notes || '',
  }));
}

function teamWeekly_(viewer, payload) {
  requireAdmin_(viewer);
  const weekStart = String(payload.weekStart || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('請選擇正確的週次');

  const tables = batchTables_([SHEETS.accounts, SHEETS.reports, SHEETS.worklogs]);
  const accounts = tables[SHEETS.accounts].rows.filter((row) => row.status === '啟用');
  const reports = tables[SHEETS.reports].rows.filter((row) => isoDate_(row.week_start) === weekStart);
  const worklogs = tables[SHEETS.worklogs].rows.filter((row) => isoDate_(row.week_start) === weekStart);
  const reportMap = {};
  reports.forEach((row) => { reportMap[row.account_id] = row; });

  const members = accounts.map((account) => {
    const report = reportMap[account.account_id];
    const entries = worklogs.filter((row) => row.account_id === account.account_id).map((row) => ({
      projectId: row.project_id || '',
      projectName: row.project_name || '',
      category: row.category || '',
      taskName: row.task_name || '',
      regularHours: Number(row.regular_hours || 0),
      overtimeHours: Number(row.overtime_hours || 0),
      overtimeReason: row.overtime_reason || '',
      progress: row.progress || '',
      difficultyType: row.difficulty_type || '無',
      difficultyNote: row.difficulty_note || '',
      supportNeeded: row.support_needed || '',
      nextWeekHours: Number(row.next_week_hours || 0),
    }));
    return {
      accountId: account.account_id,
      displayName: account.display_name || account.login_account || '未命名',
      email: account.email || '',
      role: account.role || '一般同仁',
      department: account.department || '',
      submitted: Boolean(report),
      reportDate: report ? isoDate_(report.report_date) : '',
      weekStatus: report ? report.week_status || '無請假／出差' : '',
      statusNote: report ? report.status_note || '' : '',
      highlights: report ? report.highlights || '' : '',
      blockers: report ? report.blockers || '' : '',
      nextWeekFocus: report ? report.next_week_focus || '' : '',
      submittedAt: report ? isoDateTime_(report.submitted_at) : '',
      updatedAt: report ? isoDateTime_(report.updated_at) : '',
      regularHours: sum_(entries, 'regularHours'),
      overtimeHours: sum_(entries, 'overtimeHours'),
      nextWeekHours: sum_(entries, 'nextWeekHours'),
      entries: entries,
    };
  }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hant'));

  return {
    weekStart: weekStart,
    totalCount: members.length,
    submittedCount: members.filter((member) => member.submitted).length,
    regularHours: sum_(members, 'regularHours'),
    overtimeHours: sum_(members, 'overtimeHours'),
    nextWeekHours: sum_(members, 'nextWeekHours'),
    members: members,
  };
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

let spreadsheetCache_;

function sheet_(name) {
  if (!spreadsheetCache_) spreadsheetCache_ = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheetCache_.getSheetByName(name);
  if (!sheet) throw new Error('找不到後台分頁：' + name);
  return sheet;
}

function batchTables_(sheetNames) {
  const ranges = sheetNames.map((name) => "'" + name.replace(/'/g, "''") + "'!A:ZZ");
  const response = Sheets.Spreadsheets.Values.batchGet(SPREADSHEET_ID, {
    ranges: ranges,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const valueRanges = response.valueRanges || [];
  const result = {};
  sheetNames.forEach((name, index) => {
    result[name] = tableFromValues_((valueRanges[index] && valueRanges[index].values) || []);
  });
  return result;
}

function tableFromValues_(values) {
  const names = (values[0] || []).map(String);
  const headers = {};
  names.forEach((name, index) => { if (name) headers[name] = index; });
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => {
    const object = {};
    names.forEach((name, index) => { if (name) object[name] = row[index] === undefined ? '' : row[index]; });
    return object;
  });
  return { names: names, headers: headers, rows: rows };
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

function ensureColumns_(sheetName, requiredNames) {
  const sheet = sheet_(sheetName);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const names = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const missing = requiredNames.filter((name) => !names.includes(name));
  if (missing.length) sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
}

function appendObjects_(sheetName, objects) {
  if (!objects.length) return;
  const sheet = sheet_(sheetName);
  const names = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const values = objects.map((object) => names.map((name) => object[name] === undefined ? '' : object[name]));
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, names.length).setValues(values);
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
