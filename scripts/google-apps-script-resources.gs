/**
 * Digitalhumanities.lv resursu JSON API.
 *
 * Ieteicams šo kodu ievietot Apps Script projektā, kas piesaistīts resursu
 * Google Sheets dokumentam. Ja izmanto atsevišķu Apps Script projektu,
 * aizpildi SPREADSHEET_ID.
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: '',
  SHEET_NAME: 'Resursi&Tulkojumi',
  CACHE_SECONDS: 300,
});

function doGet(event) {
  try {
    const parameters = event && event.parameter ? event.parameter : {};
    const language = normalizeFilter_(parameters.lang);
    const status = normalizeFilter_(parameters.status);
    const bypassCache = String(parameters.fresh || '') === '1';
    const cacheKey = ['dh-resources-v1', language || 'all', status || 'all'].join(':');
    const cache = CacheService.getScriptCache();

    if (!bypassCache) {
      const cached = cache.get(cacheKey);
      if (cached) return jsonResponse_(JSON.parse(cached));
    }

    const sheet = getResourceSheet_();
    const values = sheet.getDataRange().getValues();
    const headers = values.length ? normalizeHeaders_(values[0]) : [];
    validateHeaders_(headers);

    const data = values
      .slice(1)
      .filter(row => row.some(value => String(value).trim() !== ''))
      .map(row => rowToObject_(headers, row))
      .filter(record => !language || normalizeFilter_(record.language) === language)
      .filter(record => !status || normalizeFilter_(record.status) === status);

    const payload = {
      ok: true,
      sheet: CONFIG.SHEET_NAME,
      updated_at: new Date().toISOString(),
      count: data.length,
      data,
    };

    const serialized = JSON.stringify(payload);
    if (serialized.length < 95000) cache.put(cacheKey, serialized, CONFIG.CACHE_SECONDS);
    return jsonResponse_(payload);
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    });
  }
}

function getResourceSheet_() {
  const spreadsheet = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Google Sheets dokuments nav atrasts. Piesaisti scriptu dokumentam vai norādi SPREADSHEET_ID.');
  }

  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Tabula "' + CONFIG.SHEET_NAME + '" nav atrasta.');
  return sheet;
}

function normalizeHeaders_(headerRow) {
  const seen = {};
  return headerRow.map((value, index) => {
    const header = String(value).trim();
    if (!header) throw new Error('Kolonnai ' + (index + 1) + ' nav virsraksta.');
    if (seen[header]) throw new Error('Kolonnas virsraksts "' + header + '" atkārtojas.');
    seen[header] = true;
    return header;
  });
}

function validateHeaders_(headers) {
  const required = ['record_id', 'translation_id', 'language', 'title', 'slug'];
  const missing = required.filter(header => !headers.includes(header));
  if (missing.length) throw new Error('Trūkst obligāto kolonnu: ' + missing.join(', ') + '.');
}

function rowToObject_(headers, row) {
  return headers.reduce((record, header, index) => {
    record[header] = serializeCell_(row[index]);
    return record;
  }, {});
}

function serializeCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  }
  if (value === null || typeof value === 'undefined') return '';
  return value;
}

function normalizeFilter_(value) {
  return String(value || '').trim().toLowerCase();
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

