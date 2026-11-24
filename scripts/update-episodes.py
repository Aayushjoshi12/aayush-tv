#!/usr/bin/env python3
"""Refresh episodes.json from the Desi Tashan RSS feed.

Runs on a schedule (GitHub Actions). Fetches the 50-item RSS feed
(https://www.desitashan.su/feed.xml), parses each item into the same
episode shape the Entertainment page expects, fetches the episode
number from the episode page ONLY for episodes that are new (not
already in episodes.json), merges newest-first, caps at 50, and
writes episodes.json. Commits only when something actually changed.

The page (entertainment.html) fetches episodes.json first and falls
back to its embedded snapshot, so a fresh episodes.json is all it
takes for new episodes to appear on the site automatically.

Episode numbers: the RSS feed does not carry them, so they are taken
from the homepage's episode cards (guid -> number). The episode page
itself is NOT used for numbers: its first episode-number belongs to a
"latest episodes" sidebar, so every show would inherit the newest
show's number. If a number cannot be found, episode stays null (the
page handles null fine).
Never caches stream URLs; episode links are outbound links only.
"""

import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

FEED_URL = "https://www.desitashan.su/feed.xml"
HOME_URL = "https://www.desitashan.su/"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "episodes.json")
MAX_EPISODES = 50

# Title: "<Show> 24th November 2026 Full Episode | Zee TV"
TITLE_RE = re.compile(
    r"^(?P<show>.*?) (?P<day>\d{1,2})(?:st|nd|rd|th) (?P<month>\w+) (?P<year>\d{4}) Full Episode \| (?P<channel>.+)$"
)
GUID_RE = re.compile(r"/([a-f0-9]{16})/?$")


def fetch_text(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def parse_feed(xml_text):
    root = ET.fromstring(xml_text)
    ns = {"media": "http://search.yahoo.com/mrss/"}
    episodes = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        guid = (item.findtext("guid") or "").strip()
        thumb = item.find("media:thumbnail", ns)
        poster = thumb.get("url", "") if thumb is not None else ""
        m = TITLE_RE.match(title)
        if not m:
            continue
        g = GUID_RE.search(link)
        if not g:
            continue
        day = m.group("day")
        month = m.group("month")
        year = m.group("year")
        episodes.append({
            "channel": m.group("channel").strip(),
            "date": f"{day} {month} {year}",
            "episode": None,
            "guid": g.group(1),
            "link": link,
            "poster": poster,
            "pubDate": pub,
            "show": m.group("show").strip(),
        })
    return episodes


def episode_numbers_from_homepage():
    """guid -> episode number, from the homepage's episode cards.

    The homepage lists each latest episode in an <article> that carries
    BOTH its link (with the guid) and its episode-number-card, so the
    number is unambiguous there. (The episode page itself is NOT safe
    for this: its first episode-number belongs to a "latest episodes"
    sidebar, so every show would inherit the newest show's number.)
    """
    try:
        html = fetch_text(HOME_URL, timeout=25)
    except Exception:
        return {}
    numbers = {}
    blocks = re.findall(
        r'<article class="(?:spotlight-item|card has-date)"[^>]*>.*?</article>',
        html, re.S)
    for b in blocks:
        href = re.search(r'<a href="/[^"]+/([a-f0-9]{16})/"', b)
        num = re.search(r'episode-number-card"[^>]*>Episode (\d+)<', b)
        if href and num:
            numbers[href.group(1)] = int(num.group(1))
    return numbers


def main():
    # Load the current file so we only fetch episode pages for NEW guids.
    old = {"episodes": []}
    if os.path.exists(OUT):
        try:
            old = json.load(open(OUT, encoding="utf-8"))
        except Exception:
            old = {"episodes": []}
    old_by_guid = {e.get("guid"): e for e in old.get("episodes", [])}

    feed_eps = parse_feed(fetch_text(FEED_URL))
    if not feed_eps:
        print("feed parsed to zero episodes, refusing to overwrite", file=sys.stderr)
        return 1

    # Episode numbers come from the homepage cards (guid -> number).
    numbers = episode_numbers_from_homepage()

    merged = []
    for ep in feed_eps:
        prev = old_by_guid.get(ep["guid"])
        if prev is not None and prev.get("episode") is not None:
            ep["episode"] = prev["episode"]
        else:
            ep["episode"] = numbers.get(ep["guid"])
        merged.append(ep)

    # Keep the feed's newest-first order, cap at 50.
    merged = merged[:MAX_EPISODES]

    new_guids = [e["guid"] for e in merged if e["guid"] not in old_by_guid]
    old_guids = set(old_by_guid)
    if not new_guids and len(merged) == len(old.get("episodes", [])):
        # Nothing new and same length: still refresh pubDate/poster in
        # place only if a field actually differs, else leave the file.
        if merged == old.get("episodes", []):
            print("no changes, episodes.json untouched")
            return 0

    out = {
        "domain_fallbacks": old.get("domain_fallbacks", [
            "https://www.desitashan.su/",
            "https://desitashan.com.in/",
            "https://desitashantv.net/",
        ]),
        "episodes": merged,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": FEED_URL,
        "source_note": (
            "Snapshot of the 50-item RSS feed, refreshed automatically by "
            "scripts/update-episodes.py (GitHub Actions). Posters come from "
            "the feed's <media:thumbnail>. Episode numbers are taken from "
            "the homepage's episode cards (guid -> number); null means not "
            "found. Never cache resolved stream URLs; episode links are "
            "outbound links to Desi Tashan episode pages."
        ),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {OUT}: {len(merged)} episodes, {len(new_guids)} new")
    for g in new_guids:
        ep = next(e for e in merged if e["guid"] == g)
        print(f"  new: {ep['show']} — {ep['date']} (ep {ep['episode']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
