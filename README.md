# Digitalhumanities.lv Astro vietne

Statiskā LV/EN vietne ar gaišo/tumšo režīmu, piekļūstamības vadīklām, satura arhīviem un Google Sheets datu avotu.

```bash
pnpm install
pnpm sync:data
pnpm dev
pnpm build
```

`pnpm sync:data` nolasa publicētās Google Sheets cilnes `Jaunumi&notikumi` un `Vecais arhīvs`. `pnpm build` sinhronizāciju izpilda automātiski pirms statisko lapu ģenerēšanas.

Jaunam ierakstam jābūt derīgai valodai (`lv` vai `en`), satura tipam (`news`, `event`, `seminar` vai `podcast`), virsrakstam, slug, publicēšanas datumam un statusam. Vietnē parādās tikai ieraksti ar statusu `published`.

LV un EN tulkojumu rindām izmanto vienādu `translation_id`; valodas pārslēdzējs tad atver tieši attiecīgo tulkojumu arī tad, ja abām valodām ir atšķirīgi slug.

## Publicēšana GitHub Pages

Repozitorijā ir sagatavota GitHub Actions darbplūsma `.github/workflows/deploy.yml`. Tā:

- publicē vietni pēc izmaiņu nosūtīšanas uz `main` zaru;
- ļauj publicēšanu palaist manuāli GitHub sadaļā **Actions**;
- ik pēc sešām stundām pārbauda Google Sheets un pārbūvē vietni;
- veido statisku `dist` artefaktu un publicē to GitHub Pages.

### Jauna repozitorija izveide

1. GitHub izveido jaunu, tukšu repozitoriju bez automātiski ģenerēta README vai `.gitignore`.
2. Pievieno šo lokālo mapi kā repozitorija avotu un nosūti `main` zaru uz GitHub.
3. Repozitorija sadaļā **Settings → Pages → Source** izvēlies **GitHub Actions**.
4. Sadaļā **Actions** pārliecinies, ka darbplūsma **Publicēt Digitalhumanities.lv** ir veiksmīgi pabeigta.

### Pielāgotais domēns

Sākotnējā GitHub Pages adrese ir `https://ul-dhc.github.io/digitalhumanities.lv/`. Darbplūsmas mainīgais `BASE_PATH` nodrošina, ka šajā apakšceļā darbojas lapas, attēli, skripti un valodu pārslēgšana. `SITE_URL` jau norāda gala kanonisko domēnu, lai pagaidu Pages adresi neindeksētu kā atsevišķu vietni.

Kad tiek pieslēgts gala domēns, `.github/workflows/deploy.yml` jāmaina:

```yaml
env:
  SITE_URL: https://digitalhumanities.lv
  BASE_PATH: ""
```

Pēc tam domēns obligāti jānorāda arī GitHub sadaļā **Settings → Pages → Custom domain**. `CNAME` fails viens pats šo iestatījumu neveic.

Pirms DNS maiņas:

1. verificē domēnu GitHub kontā vai organizācijā;
2. Pages iestatījumos ievadi `digitalhumanities.lv`;
3. pārbaudi veiksmīgu Actions būvējumu;
4. tikai tad maini domēna DNS ierakstus un pēc sertifikāta izveides ieslēdz **Enforce HTTPS**.

Pēc darbplūsmas mainīgo nomaiņas vietne darbojas domēna saknē `digitalhumanities.lv` bez repozitorija apakšceļa.

### Automātiskā satura atjaunošana

Darbplūsma tiek palaista pēc katras izmaiņas `main` zarā, manuāli no **Actions** sadaļas un automātiski ik pēc sešām stundām. Katras būvēšanas laikā tiek ielasīti publicētie Google Sheets dati.

Pēc Astro būvējuma `scripts/generate-redirect-pages.mjs` pārvērš `public/_redirects` ierakstus statiskās HTML pāradresācijas lapās, jo GitHub Pages pats `_redirects` sintaksi neapstrādā. Tādējādi saglabājas veco vietnes saišu darbība.
