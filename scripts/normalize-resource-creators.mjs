import fs from 'node:fs';

const input = process.argv[2] || '/tmp/dhlv-resources-current.csv';
const output = process.argv[3] || '/tmp/dhlv-creator-columns.tsv';
const registryOutput = process.argv[4] || '/tmp/dhlv-creator-registry.tsv';
const registryJsonOutput = process.argv[5] || 'src/data/institutions.json';

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value); rows.push(row); row = []; value = ''; }
    else if (char !== '\r') value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

const registry = [
  ['lu', 'Latvijas Universitāte', 'University of Latvia', ['LU', 'UL']],
  ['lu-dhc', 'LU Digitālo humanitāro zinātņu centrs', 'University of Latvia Digital Humanities Center', ['UL Digital Humanities Center', 'LU Digital Humanities Centre', 'UL Digitālo humanitāro zinātņu centrs']],
  ['lu-lfmi', 'LU Literatūras, folkloras un mākslas institūts', 'University of Latvia – Institute of Literature Folklore and Art', ['LU LFMI', 'LFMI', 'Institute of Literature, Folklore and Art of the University of Latvia', 'Institute of Literature, Folklore and Art, University of Latvia']],
  ['lu-mii', 'LU Matemātikas un informātikas institūts', 'University of Latvia – Institute of Mathematics and Computer Science', ['MII', 'WMD', 'Latvijas Universitātes Matemātikas un informātikas institūts', 'Institute of Mathematics and Informatics of the University of Latvia', 'Institute of Mathematics and Computer Science, University of Latvia']],
  ['lu-fsi', 'LU Filozofijas un socioloģijas institūts', 'University of Latvia Institute of Philosophy and Sociology', ['FSI', 'Institute of Philosophy and Sociology of the University of Latvia', 'Institute of Philosophy and Sociology, University of Latvia']],
  ['lu-lavi', 'LU Latviešu valodas institūts', 'University of Latvia Institute of Latvian Language', ['LaVI', 'Institute of the Latvian Language, University of Latvia', 'Latvian Language Institute, University of Latvia']],
  ['lu-liv', 'LU Lībiešu institūts', 'University of Latvia Livonian Institute', ['Lībiešu institūts', 'Libyan Institute', 'Livonian Institute, University of Latvia']],
  ['lu-lvi', 'LU Latvijas vēstures institūts', 'University of Latvia Institute of Latvian History', ['LVI', 'Latvijas vēstures institūts', 'Institute of Latvian History, University of Latvia']],
  ['lnb', 'Latvijas Nacionālā bibliotēka', 'National Library of Latvia', ['LNB']],
  ['kisc', 'Kultūras informācijas sistēmu centrs', 'Culture Information Systems Centre', ['KISC']],
  ['rtu-rezekne', 'RTU Rēzekne', 'RTU Rēzekne', ['RTA', 'Rēzeknes Tehnoloģiju akadēmija']],
  ['lata', 'Latvijas Atvērto tehnoloģiju asociācija', 'Latvian Open Technology Association', ['Latvijas atvērto tehnoloģiju asociācija', 'Latvian Open Technologies Association']],
  ['unesco-lnk', 'UNESCO Latvijas Nacionālā komisija', 'Latvian National Commission for UNESCO', ['UNESCO LNK']],
  ['lva', 'Latviešu valodas aģentūra', 'Latvian Language Agency', ['LVA']],
  ['lbtu', 'Latvijas Biozinātņu un tehnoloģiju universitāte', 'Latvia University of Life Sciences and Technologies', ['LBTU']],
  ['liepu', 'Liepājas Universitāte', 'Liepāja University', ['LiepU']],
  ['lnkc', 'Latvijas Nacionālais kultūras centrs', 'Latvian National Centre for Culture', ['LNKC']],
  ['rmm', 'Latvijas Nacionālais rakstniecības un mūzikas muzejs', 'Latvian National Museum of Literature and Music', ['Rakstniecības un mūzikas muzejs']],
  ['tilde', 'Tilde', 'Tilde', ['SIA Tilde']],
  ['tieto', 'Tieto Latvia', 'Tieto Latvia', ['SIA "Tieto Latvia"']],
  ['europeana', 'Europeana', 'Europeana', []],
  ['lursoft', 'Lursoft', 'Lursoft', ['LURSOFT']],
  ['cemety', 'SIA “CEMETY”', 'CEMETY Ltd.', ['SIA "CEMETY"']],
  ['ciltskoki', 'SIA “Ciltskoki”', 'Ciltskoki Ltd.', ['SIA Ciltskoki']],
  ['sabiedriskie-mediji', 'Sabiedrisko mediju biedrība', 'Society for Public Media', []],
  ['dodies', 'dodies.lv', 'dodies.lv', []],
  ['eu', 'Eiropas Savienība', 'European Union', []],
  ['lna', 'Latvijas Nacionālais arhīvs', 'National Archives of Latvia', []],
  ['venta', 'Ventspils Augstskola', 'Ventspils University of Applied Sciences', ['Ventspils University']],
  ['vdaa', 'Valsts digitālās attīstības aģentūra', 'State Digital Development Agency', []],
  ['lka', 'Latvijas Kultūras akadēmija', 'Latvian Academy of Culture', []],
  ['du', 'Daugavpils Universitāte', 'Daugavpils University', []],
  ['lkm', 'Latgales Kultūrvēstures muzejs', 'Latgale Culture and History Museum', ['Latgale Cultural History Museum']],
  ['lgia', 'Latvijas Ģeotelpiskās informācijas aģentūra', 'Latvian Geospatial Information Agency', []],
  ['vdu', 'Vītauta Dižā Universitāte', 'Vytautas Magnus University', ['VDU', 'Vītauta Dižā Universitāte (Lietuva)']],
  ['lmic', 'Latvijas Mūzikas informācijas centrs', 'Latvian Music Information Centre', ['Latvijas Mūzikas Informācijas centrs', 'Latvian Music Information Center']],
  ['rpiva', 'Rīgas Pedagoģijas un izglītības vadības akadēmija', 'Riga Teacher Training and Educational Management Academy', ['Riga Academy of Pedagogy and Educational Management']],
  ['lu-hzf', 'LU Humanitāro zinātņu fakultāte', 'University of Latvia – Faculty of Humanities', ['LUHZF', 'Latvijas Universitātes Humanitāro zinātņu fakultāte', 'Faculty of Humanities of the University of Latvia', 'Faculty of Humanities at the University of Latvia']],
  ['uit', 'Norvēģijas Arktikas universitāte UiT', 'UiT The Arctic University of Norway', ['UiT']],
  ['uio', 'Oslo Universitāte', 'University of Oslo', ['UOslo']],
  ['dzivesstasts', 'Latvijas mutvārdu vēstures pētnieku asociācija “Dzīvesstāsts”', 'Association of Latvian Oral History Researchers “Life Story”', ['Latvijas mutvārdu vēstures pētnieku asociācija "Dzīvesstāsts"', 'Association of Latvian Oral History Researchers "Life Story"']],
  ['open-storage', 'Biedrība “Atvērtās krātuves”', 'Open Repositories Society', ['Biedrība Atvērtās krātuves']],
  ['lbtu-esaf', 'LBTU Ekonomikas un sabiedrības attīstības fakultāte', 'Faculty of Economics and Social Development at Latvia University of Life Sciences and Technologies', ['Ekonomikas un sabiedrības attīstības fakultāte']],
  ['lbtu-fb', 'LBTU Fundamentālā bibliotēka', 'Fundamental Library at Latvia University of Life Sciences and Technologies', ['Fundamentālā bibliotēka', 'Fundamental Library']],
  ['rtu', 'Rīgas Tehniskā universitāte', 'Riga Technical University', ['RTU']],
  ['timenote', 'Biedrība “Timenote.info”', 'Timenote.info Society', ['Biedrība "Timenote.info"', 'Society "Timenote.info"']],
  ['rsu', 'Rīgas Stradiņa universitāte', 'Rīga Stradiņš University', ['Riga Stradins University']],
  ['rtu-liepaja', 'RTU Liepāja', 'RTU Liepāja', []],
  ['lza', 'Latvijas Zinātņu akadēmija', 'Latvian Academy of Sciences', ['Latvijas Zinātņu Akadēmija']],
  ['jvlma', 'Jāzepa Vītola Latvijas Mūzikas akadēmija', 'Jāzeps Vītols Latvian Academy of Music', ['Jāzeps Vītolas Academy of Music of Latvia']],
];

const peopleRegistry = [
  ['Sandis Zučiks', ['Sandis Zuciks']],
  ['Raitis Sondors', []],
  ['Linards Kalniņš', ['Linards Kalnins']],
  ['Toms Gaļinauskis', ['Toms Galinauskis']],
  ['Reinis Indāns', ['Reinis Indans']],
  ['Ģirts Dālbergs', ['Įrts Dahlbergs', 'Girts Dalbergs']],
  ['Valters Grīviņš', ['Valters Grivins']],
  ['Henrihs Soms', ['Henrihs Som']],
  ['Jānis Hartmanis', ['Janis Hartmanis']],
  ['Ilmārs Mežs', ['Ilmars Mezhs']],
  ['Armands Kociņš', ['Armands Kocins']],
  ['Ansis Ataols Bērziņš', ['Ansis Ataols Berzins']],
  ['Juris Žagariņš', ['Juris Žagarins']],
];

const registryByAlias = new Map();
for (const [code, lv, en, aliases] of registry) {
  for (const alias of [lv, en, ...aliases]) registryByAlias.set(alias.toLocaleLowerCase('lv'), { code, lv, en });
}

const replacements = [
  ['Latvijas Universitātes Matemātikas un informātikas institūts', 'LU Matemātikas un informātikas institūts'],
  ['Institute of Mathematics and Informatics of the University of Latvia', 'Institute of Mathematics and Computer Science, University of Latvia'],
  ['Center for Cultural Information Systems', 'Culture Information Systems Centre'],
  ['Latvijas vēstures institūta AMK', 'LU Latvijas vēstures institūta Arheoloģisko materiālu krātuve'],
  ['AMK of the Latvian Institute of History', 'Archaeological Material Repository, Institute of Latvian History, University of Latvia'],
  ['LU Literatūras, folkloras un mākslas institūts (LU LFMI)', 'LU Literatūras, folkloras un mākslas institūts'],
  ['Institute of Literature, Folklore and Art of the University of Latvia', 'Institute of Literature, Folklore and Art, University of Latvia'],
  ['UL Digital Humanities Center', 'University of Latvia Digital Humanities Center'],
  ['UL Digitālo humanitāro zinātņu centrs', 'LU Digitālo humanitāro zinātņu centrs'],
  ['Latvian Open Technologies Association', 'Latvian Open Technology Association'],
  ['Libyan Institute', 'Livonian Institute, University of Latvia'],
  ['Ilmars Mezhs', 'Ilmārs Mežs'],
];

function clean(text = '') {
  let value = text.trim().replace(/\s+/g, ' ');
  for (const [from, to] of replacements) value = value.split(from).join(to);
  return value.replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/\s*;\s*/g, '; ');
}

function expandStandalone(value, lang) {
  const match = registryByAlias.get(clean(value).toLocaleLowerCase('lv'));
  return match ? match[lang] : clean(value);
}

function extractExtras(base, additional, unit, lang) {
  const extras = [];
  for (const raw of [unit, ...(additional ? additional.split(/\s*,\s*/) : [])]) {
    const value = expandStandalone(raw, lang);
    if (!value || value.length < 2) continue;
    if (!base.toLocaleLowerCase('lv').includes(value.toLocaleLowerCase('lv')) && !extras.some((x) => x.toLocaleLowerCase('lv') === value.toLocaleLowerCase('lv'))) extras.push(value);
  }
  return extras;
}

function detectCodes(text) {
  const codes = [];
  const lower = text.toLocaleLowerCase('lv');
  for (const [code, lv, en, aliases] of registry) {
    const found = [lv, en, ...aliases].some((alias) => {
      if (!alias) return false;
      const needle = alias.toLocaleLowerCase('lv');
      if (needle.length > 3) return lower.includes(needle);
      return new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u').test(lower);
    });
    if (found && !codes.includes(code)) codes.push(code);
  }
  if (codes.some((code) => code.startsWith('lu-'))) {
    const index = codes.indexOf('lu');
    if (index >= 0) codes.splice(index, 1);
  }
  if (codes.some((code) => code.startsWith('lbtu-'))) {
    const index = codes.indexOf('lbtu');
    if (index >= 0) codes.splice(index, 1);
  }
  return codes.join('; ');
}

function detectPeople(text) {
  const lower = text.toLocaleLowerCase('lv');
  return peopleRegistry
    .filter(([name, aliases]) => [name, ...aliases].some((alias) => lower.includes(alias.toLocaleLowerCase('lv'))))
    .map(([name]) => name);
}

const rows = parseCsv(fs.readFileSync(input, 'utf8'));
const pairs = new Map();
for (const row of rows) {
  const key = row.translation_id || row.record_id;
  if (!pairs.has(key)) pairs.set(key, {});
  pairs.get(key)[row.language] = row;
}

const registryMap = new Map(registry.map(([code, lv, en]) => [code, { lv, en }]));
const outputRows = [['institutions_lv', 'institutions_en', 'creator_people']];
for (const row of rows) {
  const pair = pairs.get(row.translation_id || row.record_id);
  const lvRow = pair.lv || row;
  const enRow = pair.en || row;
  const lvBase = clean(lvRow.creators_lv || lvRow.creator);
  const enBase = clean(enRow.creators_en || enRow.creator);
  const lv = [lvBase, ...extractExtras(lvBase, lvRow.additional_creators, lvRow.creator_unit, 'lv')].filter(Boolean).join('; ');
  const en = [enBase, ...extractExtras(enBase, enRow.additional_creators, enRow.creator_unit, 'en')].filter(Boolean).join('; ');
  const codes = detectCodes(`${lv}; ${en}`).split(';').map((value) => value.trim()).filter(Boolean);
  const institutionsLv = codes.map((code) => registryMap.get(code)?.lv).filter(Boolean);
  const institutionsEn = codes.map((code) => registryMap.get(code)?.en).filter(Boolean);
  const people = detectPeople(`${lv}; ${en}`);
  outputRows.push([institutionsLv.join(', '), institutionsEn.join(', '), people]);
}

const escapeTsv = (value) => String(value || '').replace(/[\t\r\n]+/g, ' ');
fs.writeFileSync(output, outputRows.map((row) => row.map(escapeTsv).join('\t')).join('\n'));
fs.writeFileSync(registryOutput, [
  ['institution_code', 'institution_lv', 'institution_en', 'aliases'],
  ...registry.map(([code, lv, en, aliases]) => [code, lv, en, aliases.join('; ')]),
].map((row) => row.map(escapeTsv).join('\t')).join('\n'));
fs.writeFileSync(registryJsonOutput, `${JSON.stringify(
  registry.map(([code, lv, en]) => ({ code, lv, en })),
  null,
  2,
)}\n`);

console.log(JSON.stringify({ rows: rows.length, pairs: pairs.size, registry: registry.length, output, registryOutput, registryJsonOutput }, null, 2));
