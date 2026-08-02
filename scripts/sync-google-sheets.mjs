import fs from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const publicId = process.env.GOOGLE_SHEETS_PUBLIC_ID
  || '2PACX-1vRl1YogjsToSsUwlSH8v_hOKgjUEZs96Hk7mW6m3kVJ16AzmskbiGbtPF8d2mmMdGnf7f3qF0IIWwL5';
const sheetGids = {
  newEntries: process.env.GOOGLE_SHEETS_NEW_ENTRIES_GID || '548994246',
  archive: process.env.GOOGLE_SHEETS_ARCHIVE_GID || '341542364',
};
const resourceSheetId = process.env.GOOGLE_SHEETS_RESOURCES_ID
  || '1fKTpcKvhtsettUbzM1WMG0yDszKd6smj';
const resourceSheetName = process.env.GOOGLE_SHEETS_RESOURCES_SHEET
  || 'Resursi&Tulkojumi';
const resourceAppsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_RESOURCES_URL
  || 'https://script.google.com/macros/s/AKfycbxJqkPGbYvxTeqfNSlm6Pue4QQzzrPkSUW9kSN3KPZp6LpQeZ4OcPuCHJWDtLJVW4Tk/exec';
const institutionRegistry = JSON.parse(await fs.readFile(new URL('src/data/institutions.json', projectRoot), 'utf8'));
const institutionByCode = new Map(institutionRegistry.map((item) => [item.code, item]));
const origin = 'https://digitalhumanities.lv';
const allowedLanguages = new Set(['lv', 'en']);
const allowedTypes = new Set(['news', 'event', 'seminar', 'podcast']);
const newEntryAdditions = {
  'bssdh-2026-starts:lv': '\n\n🎥 **Lekciju tiešraides būs skatāmas:**\n\n- [LU YouTube kanālā](https://www.youtube.com/@lutiesraides4477)\n- [LU LFMI Facebook lapā](https://www.facebook.com/lulfmi)',
  'bssdh-2026-starts:en': '\n\n🎥 **Lectures will be livestreamed at:**\n\n- [LU YouTube channel](https://www.youtube.com/@lutiesraides4477)\n- [LU LFMI Facebook page](https://www.facebook.com/lulfmi)',
};

function csvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/e/${publicId}/pub?gid=${gid}&single=true&output=csv`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows
    .filter(values => values.some(value => value.trim()))
    .map(values => Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() || ''])));
}

async function fetchSheet(gid, label) {
  const response = await fetch(csvUrl(gid));
  if (!response.ok) throw new Error(`${label}: Google Sheets atbildēja ar ${response.status}.`);
  const text = await response.text();
  const records = parseCsv(text);
  console.log(`${label}: saņemtas ${records.length} datu rindas.`);
  return records;
}

async function fetchResourceSheetDirectly() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${resourceSheetId}/gviz/tq`);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('sheet', resourceSheetName);
  url.searchParams.set('_', Date.now().toString());
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Resursi&Tulkojumi: Google Sheets atbildēja ar ${response.status}.`);
  const records = parseCsv(await response.text());
  console.log(`Resursi&Tulkojumi: saņemtas ${records.length} datu rindas.`);
  return records;
}

async function fetchResourceSheetFromAppsScript() {
  const url = new URL(resourceAppsScriptUrl);
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Apps Script atbildēja ar ${response.status}.`);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Apps Script neatgrieza JSON (${contentType || 'satura tips nav norādīts'}).`);
  }

  const payload = await response.json();
  if (!payload?.ok) throw new Error(payload?.error || 'Apps Script atgrieza kļūdu.');
  if (!Array.isArray(payload.data)) throw new Error('Apps Script atbildē nav data masīva.');
  console.log(`Resursi&Tulkojumi (Apps Script): saņemtas ${payload.data.length} datu rindas.`);
  return payload.data;
}

async function fetchResourceSheet() {
  try {
    return await fetchResourceSheetFromAppsScript();
  } catch (error) {
    console.warn(`Resursi&Tulkojumi: Apps Script nav pieejams (${error.message}) Izmantoju Google Sheets rezerves avotu.`);
    return fetchResourceSheetDirectly();
  }
}

function routeFor(language, contentType) {
  if (contentType === 'seminar') return language === 'lv' ? '/lv/seminari/' : '/en/workshop-series/';
  if (contentType === 'podcast') return language === 'lv' ? '/lv/raidieraksts/' : '/en/podcast/';
  return language === 'lv' ? '/lv/aktualitates/' : '/en/updates/';
}

function normalizeDate(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const localDateTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (localDateTime) return `${localDateTime[1]}T${localDateTime[2]}:${localDateTime[3] || '00'}`;
  return trimmed;
}

function normalizeBoolean(value = '') {
  return ['true', '1', 'yes', 'jā'].includes(String(value).trim().toLowerCase());
}

function localizeSiteImage(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.origin === origin ? `${url.pathname}${url.search}` : value;
  } catch {
    return value;
  }
}

function normalizeNewRecord(row, index) {
  const language = row.language.toLowerCase();
  const contentType = row.content_type.toLowerCase();
  const translationId = row.translation_id.trim();
  const slug = row.slug.trim().replace(/^#/, '');
  const recordId = row.record_id.trim() || (translationId && language ? `${translationId}-${language}` : '');
  const required = { record_id: recordId, language, content_type: contentType, title: row.title, slug, published_at: row.published_at };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);

  if (!allowedLanguages.has(language)) missing.push('valid language');
  if (!allowedTypes.has(contentType)) missing.push('valid content_type');
  if (missing.length) {
    console.warn(`Jaunumi&notikumi rinda ${index + 2} izlaista: ${[...new Set(missing)].join(', ')}.`);
    return null;
  }

  const base = routeFor(language, contentType);
  const addition = newEntryAdditions[`${translationId}:${language}`] || '';
  const bodyMarkdown = addition && !row.body_markdown.includes('youtube.com/@lutiesraides4477')
    ? `${row.body_markdown}${addition}`
    : row.body_markdown;
  return {
    record_id: recordId,
    language,
    translation_id: translationId,
    content_type: contentType,
    title: row.title,
    slug,
    published_at: normalizeDate(row.published_at),
    event_date: normalizeDate(row.event_date),
    summary: row.summary,
    body_markdown: bodyMarkdown,
    image_url: localizeSiteImage(row.image_url),
    image_alt: row.image_alt,
    external_url: row.external_url,
    featured: normalizeBoolean(row.featured),
    pinned: normalizeBoolean(row.pinned || row.featured),
    status: row.status.toLowerCase() || 'draft',
    archive_url: `${origin}${base}#${encodeURIComponent(slug)}`,
    share_url: `${origin}${base}${encodeURIComponent(slug)}/`,
  };
}

function normalizeArchiveRecord(row, index) {
  const language = row.language.toLowerCase();
  const contentType = row.content_type.toLowerCase();
  if (!row.record_id || !allowedLanguages.has(language) || !allowedTypes.has(contentType) || !row.slug) {
    console.warn(`Vecais arhīvs rinda ${index + 2} izlaista: trūkst obligāto lauku.`);
    return null;
  }

  return {
    ...row,
    language,
    content_type: contentType,
    published_at: normalizeDate(row.published_at),
    event_date: normalizeDate(row.event_date),
    image_url: localizeSiteImage(row.image_url_new || row.image_url_original),
    featured: normalizeBoolean(row.featured),
    pinned: normalizeBoolean(row.pinned || row.featured),
    status: row.status.toLowerCase() || 'published',
  };
}

function codeSet(value = '') {
  return new Set(String(value).split(/[|;,]/).map(code => code.trim().toLowerCase()).filter(Boolean));
}

function canonicalizeInstitutionLabels(value = '', language) {
  if (language !== 'en') return value;
  const replacements = new Map([
    ['University of Latvia – Institute of Philosophy and Sociology', 'University of Latvia Institute of Philosophy and Sociology'],
    ['Institute of Philosophy and Sociology of the University of Latvia', 'University of Latvia Institute of Philosophy and Sociology'],
    ['University of Latvia – Latvian Language Institute', 'University of Latvia Institute of Latvian Language'],
    ['Latvian Language Institute, University of Latvia', 'University of Latvia Institute of Latvian Language'],
    ['Institute of the Latvian Language, University of Latvia', 'University of Latvia Institute of Latvian Language'],
    ['University of Latvia – Livonian Institute', 'University of Latvia Livonian Institute'],
    ['Livonian Institute, University of Latvia', 'University of Latvia Livonian Institute'],
    ['University of Latvia – Institute of Latvian History', 'University of Latvia Institute of Latvian History'],
    ['Institute of Latvian History, University of Latvia', 'University of Latvia Institute of Latvian History'],
  ]);
  let result = value;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result;
}

function normalizeResourceRecord(row, index) {
  const language = row.language.toLowerCase();
  const typeCodes = codeSet(row.resource_type_codes);
  const keywordCodes = codeSet(row.keyword_codes);
  const creatorCodes = [...codeSet(row.creator_codes)];
  const canonicalInstitutions = creatorCodes
    .map(code => institutionByCode.get(code)?.[language])
    .filter(Boolean)
    .join('; ');
  const institutions = canonicalizeInstitutionLabels(
    canonicalInstitutions || (language === 'lv' ? row.institutions_lv : row.institutions_en),
    language,
  );
  const required = ['record_id', 'translation_id', 'title', 'slug'];
  const missing = required.filter(key => !row[key]);
  if (!allowedLanguages.has(language)) missing.push('valid language');
  if (missing.length) {
    console.warn(`Resursi&Tulkojumi rinda ${index + 2} izlaista: ${[...new Set(missing)].join(', ')}.`);
    return null;
  }

  return {
    translation_id: row.translation_id,
    source_row: Number(row.source_row) || index + 2,
    status: row.status.toLowerCase() || 'review',
    featured: normalizeBoolean(row.featured),
    sort_order: Number(row.sort_order) || index + 1,
    slug: row.slug.replace(/^#/, ''),
    website_url: row.website_url,
    image_url: localizeSiteImage(row.image_url),
    type_repository: typeCodes.has('repository'),
    type_dataset: typeCodes.has('dataset'),
    type_tool: typeCodes.has('tool'),
    type_participation: typeCodes.has('participation'),
    topic_history: keywordCodes.has('history'),
    topic_literature: keywordCodes.has('literature'),
    topic_language: keywordCodes.has('language'),
    topic_folklore: keywordCodes.has('folklore'),
    topic_visual_arts: keywordCodes.has('visual_arts'),
    topic_performing_arts: keywordCodes.has('performing_arts'),
    access_model: row.access_model,
    access_requirements: row.access_requirements,
    data_availability: row.data_availability,
    downloadable_formats: row.downloadable_formats,
    machine_readable: row.machine_readable,
    license: row.license,
    metadata_quality: row.metadata_quality,
    documentation_quality: row.documentation_quality,
    persistent_identifier: row.persistent_identifier,
    citation_guidance: row.citation_guidance,
    research_readiness: row.research_readiness,
    reuse_readiness: row.reuse_readiness,
    readiness_notes: row.readiness_notes,
    content_languages: row.content_languages,
    geographic_scope: row.geographic_scope,
    target_audience: row.target_audience,
    last_checked: row.last_checked,
    internal_notes: row.internal_notes,
    record_id: row.record_id,
    language,
    translation_status: row.translation_status,
    title: row.title,
    long_title: row.long_title,
    summary: row.summary,
    description: row.description_markdown,
    image_alt: row.image_alt,
    institutions,
    creator_people: row.creator_people,
    creator: [institutions, row.creator_people]
      .filter(Boolean)
      .join(' · ') || (language === 'lv' ? (row.creators_lv || row.creator) : (row.creators_en || row.creator)),
    creator_codes: row.creator_codes,
  };
}

const [newRows, archiveRows, resourceRows] = await Promise.all([
  fetchSheet(sheetGids.newEntries, 'Jaunumi&notikumi'),
  fetchSheet(sheetGids.archive, 'Vecais arhīvs'),
  fetchResourceSheet(),
]);

const sortRecords = (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.published_at.localeCompare(a.published_at);
const newEntries = newRows.map(normalizeNewRecord).filter(Boolean).sort(sortRecords);
const archive = archiveRows.map(normalizeArchiveRecord).filter(Boolean).sort(sortRecords);
const resources = resourceRows
  .map(normalizeResourceRecord)
  .filter(Boolean)
  .sort((a, b) => a.sort_order - b.sort_order || a.language.localeCompare(b.language));

await Promise.all([
  fs.writeFile(new URL('src/data/new-entries.json', projectRoot), `${JSON.stringify(newEntries, null, 2)}\n`),
  fs.writeFile(new URL('src/data/archive.json', projectRoot), `${JSON.stringify(archive, null, 2)}\n`),
  fs.writeFile(new URL('src/data/resources.json', projectRoot), `${JSON.stringify(resources, null, 2)}\n`),
]);

console.log(`Sinhronizācija pabeigta: ${newEntries.length} jauni ieraksti, ${archive.length} arhīva ieraksti, ${resources.length} resursu ieraksti.`);
