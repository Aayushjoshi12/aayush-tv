#!/usr/bin/env python3
"""Refresh episodes.json + the SNAPSHOT in entertainment.html from Desi Tashan.

Reads the public RSS feed (desitashan.su/feed.xml), keeps the 50 latest
episodes, and for each episode fetches its episode page to extract the
per-episode Freezod identifier ("v" token) used by the in-site player to
resolve a signed stream URL at tap time. Only the opaque "v" token is
stored -- never a resolved stream URL (those are signed for ~1h and are
resolved in the browser when the user taps Watch).

Usage: python3 refresh-episodes.py [--feed URL] [--out episodes.json]
Then rebuild entertainment.html's embedded SNAPSHOT from episodes.json.
"""
import argparse, json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import xml.etree.ElementTree as ET

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
NS = {"media": "http://search.yahoo.com/mrss/"}
TITLE_RE = re.compile(r"^(.*?)\s+(\d{1,2})(?:st|nd|rd|th)\s+(\w+)\s+(\d{4})\s+Full Episode\s+(.*?)\s*$", re.I)
TOKEN_RE = re.compile(r"getlink\.php\?v=([^&]+)&amp;part2=")

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def parse_feed(xml):
    root = ET.fromstring(xml)
    eps = []
    for item in root.iter("item"):
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        guid = (item.findtext("guid") or "").strip()
        pub = item.findtext("pubDate") or ""
        thumb = item.find("media:thumbnail", NS)
        poster = thumb.get("url") if thumb is not None else None
        m = TITLE_RE.match(title.strip())
        if not m:
            continue
        show, _d, month, _y, channel = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
        date = f"{_d} {month} {_y}"
        ep = {"channel": channel.strip(), "date": date, "episode": None,
              "guid": guid, "link": link, "poster": poster, "pubDate": pub,
              "show": show.strip()}
        eps.append(ep)
    return eps

def fetch_token(ep):
    try:
        html = fetch(ep["link"])
        m = TOKEN_RE.search(html)
        return ep["guid"], (m.group(1) if m else None)
    except Exception as e:
        print(f"  token fetch failed for {ep['show']}: {e}", file=sys.stderr)
        return ep["guid"], None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default="https://www.desitashan.su/feed.xml")
    ap.add_argument("--out", default="episodes.json")
    args = ap.parse_args()
    print(f"Fetching {args.feed} ...")
    eps = parse_feed(fetch(args.feed))
    print(f"{len(eps)} episodes in feed; fetching Freezod ids ...")
    with ThreadPoolExecutor(max_workers=8) as ex:
        tokens = dict(ex.map(fetch_token, eps))
    ok = 0
    for ep in eps:
        v = tokens.get(ep["guid"])
        if v:
            ep["v"] = v
            ok += 1
    print(f"Freezod ids: {ok}/{len(eps)}")
    data = {"domain_fallbacks": ["https://www.desitashan.su/", "https://desitashan.com.in/",
                                 "https://desitashantv.net/"],
            "episodes": eps,
            "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": args.feed,
            "source_note": "Snapshot of the 50-item RSS feed. Posters come straight from the feed's <media:thumbnail>. Each episode also carries 'v', the per-episode Freezod identifier extracted from its Desi Tashan episode page at refresh time; the signed stream URL is resolved from it at click time and is never stored or cached."}
    with open(args.out, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Wrote {args.out}")

if __name__ == "__main__":
    main()
