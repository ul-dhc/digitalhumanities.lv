#!/usr/bin/env python3
"""Import the Latvian Mozello blog entries hidden behind “Load more”."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
import html
import json
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://www.digitalhumanities.lv"
INDEX = "/notikumi/"
MONTHS = {
    "janv": 1, "janvāris": 1, "febr": 2, "februāris": 2, "marts": 3,
    "apr": 4, "aprīlis": 4, "maijs": 5, "jūn": 6, "jūnijs": 6,
    "jūl": 7, "jūlijs": 7, "aug": 8, "augusts": 8, "sept": 9,
    "septembris": 9, "okt": 10, "oktobris": 10, "nov": 11,
    "novembris": 11, "dec": 12, "decembris": 12,
}


def request(path, data=None):
    body = urllib.parse.urlencode(data, doseq=True).encode() if data else None
    req = urllib.request.Request(BASE + path, data=body, headers={"User-Agent": "digitalhumanities.lv archive migration"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8", "replace")


def clean_text(value):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


class MarkdownParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.links = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"script", "style"}:
            self.skip += 1
        elif not self.skip and tag == "a":
            self.links.append(attrs.get("href", ""))
            self.parts.append("[")
        elif not self.skip and tag in {"strong", "b"}:
            self.parts.append("**")
        elif not self.skip and tag in {"em", "i"}:
            self.parts.append("*")
        elif not self.skip and tag == "li":
            self.parts.append("\n- ")
        elif not self.skip and tag == "br":
            self.parts.append("\n")
        elif not self.skip and tag == "hr":
            self.parts.append("\n\n--\n\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        elif not self.skip and tag == "a":
            href = self.links.pop() if self.links else ""
            self.parts.append(f"]({href})" if href else "]")
        elif not self.skip and tag in {"strong", "b"}:
            self.parts.append("**")
        elif not self.skip and tag in {"em", "i"}:
            self.parts.append("*")
        elif not self.skip and tag in {"p", "div", "h2", "h3", "ul", "ol"}:
            self.parts.append("\n\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def markdown(self):
        text = "".join(self.parts).replace("\xa0", " ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r" *\n *", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def parse_date(value):
    normalized = clean_text(value).lower().replace(".", "")
    match = re.search(r"(\d{1,2})\s+([^\s,]+),?\s+(\d{4})", normalized)
    if not match:
        raise ValueError(f"Unrecognized date: {value!r}")
    day, month_name, year = match.groups()
    month = MONTHS[month_name]
    return datetime(int(year), month, int(day)).strftime("%Y-%m-%d")


def slugify(value):
    replacements = str.maketrans("āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ", "acegiklnsuzACEGIKLNSUZ")
    value = value.translate(replacements).lower()
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value))[:110]


def extract_record(path):
    page = request(path)
    main_match = re.search(r'<main class="moze-post-container[^>]*>([\s\S]*?)</main>', page, re.I)
    if not main_match:
        raise ValueError(f"Article body missing: {path}")
    main = main_match.group(1)
    title_match = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", main, re.I)
    date_match = re.search(r'<span class="unpublished moze-lighter">([\s\S]*?)</span>', main, re.I)
    if not title_match or not date_match:
        raise ValueError(f"Title or date missing: {path}")
    title = clean_text(title_match.group(1))
    published_at = parse_date(date_match.group(1))
    content = re.sub(r"^[\s\S]*?</div>\s*", "", main, count=1)
    image_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', content, re.I)
    alt_match = re.search(r'<img[^>]+alt=["\']([^"\']*)["\'][^>]*>', content, re.I)
    parser = MarkdownParser()
    parser.feed(content)
    body = parser.markdown()
    plain = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", body)
    plain = re.sub(r"[*#_-]+", " ", plain)
    summary = re.sub(r"\s+", " ", plain).strip()[:260].rstrip()
    pid = re.search(r"/post/(\d+)/", path).group(1)
    slug = slugify(title)
    old_url = BASE + path
    return {
        "record_id": f"mozello-lv-{pid}", "language": "lv",
        "translation_id": f"mozello-{pid}", "content_type": "news",
        "title": title, "slug": slug, "published_at": published_at,
        "event_date": "", "summary": summary, "body_markdown": body,
        "image_url_original": html.unescape(image_match.group(1)) if image_match else "",
        "image_url_new": "", "image_url": "",
        "image_alt": html.unescape(alt_match.group(1)) if alt_match else "",
        "external_url": "", "archive_url": f"/lv/aktualitates/#{slug}",
        "share_url": old_url, "status": "published", "pinned": False,
    }


def main():
    index = request(INDEX)
    pages = [index]
    for offset in range(20, 140, 20):
        pages.append(request("/m/mozlive/blog-load-more/", {
            "action": "blog-load-more", "url": INDEX, "src[id]": "11083265",
            "parameters[offset]": str(offset), "parameters[count]": "131",
        }))
    paths_by_pid = {}
    for document in pages:
        for path in re.findall(r'href=["\'](/?notikumi/params/post/[^"\']+)', document, re.I):
            path = "/" + path.lstrip("/")
            pid = re.search(r"/post/(\d+)/", path).group(1)
            paths_by_pid.setdefault(pid, path.removesuffix(".html"))
    existing = json.loads((ROOT / "src/data/archive.json").read_text())
    existing_ids = {item["record_id"] for item in existing}
    paths = [path for pid, path in paths_by_pid.items() if f"mozello-lv-{pid}" not in existing_ids]
    records = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(extract_record, path): path for path in paths}
        for future in as_completed(futures):
            records.append(future.result())
    records.sort(key=lambda item: item["published_at"], reverse=True)
    output = ROOT / "src/data/legacy-lv-archive.json"
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(records)} missing Latvian entries; oldest: {records[-1]['title']} ({records[-1]['published_at']})")


if __name__ == "__main__":
    main()
