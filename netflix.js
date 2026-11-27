// netflix.js — small Netflix-style helpers for Movies + TV Serials.
// Defensive throughout: if a page has no rows or header, it does nothing.
//  1. Header turns solid Netflix black once the page is scrolled.
//  2. Horizontal rows get Netflix-style hover chevron buttons that
//     scroll the row by most of a screen. Rows are rendered by the
//     pages' own scripts after load (and re-rendered on searches),
//     so a MutationObserver keeps watch and attaches buttons to any
//     row that overflows and does not have them yet.
(function () {
  "use strict";

  var header = document.querySelector("header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("nfx-solid", window.scrollY > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Scrollbar width, used by the billboard hero's full-width math.
  function setSbw() {
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--sbw", sbw + "px");
  }
  setSbw();
  window.addEventListener("resize", setSbw);

  function attachChevrons(row) {
    if (row.dataset.nfxChev) return;
    var host = row.parentElement;
    if (!host) return;
    if (host.querySelector(":scope > .nfx-chev")) {
      row.dataset.nfxChev = "1";
      return;
    }
    if (row.scrollWidth <= row.clientWidth + 12) return; // fits: no buttons needed (yet)
    row.dataset.nfxChev = "1";
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.classList.add("nfx-rowhost");
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "nfx-chev prev";
    prev.setAttribute("aria-label", "Scroll row back");
    prev.textContent = "‹";
    var next = document.createElement("button");
    next.type = "button";
    next.className = "nfx-chev next";
    next.setAttribute("aria-label", "Scroll row forward");
    next.textContent = "›";
    var step = function () {
      return Math.max(320, Math.floor(row.clientWidth * 0.85));
    };
    prev.addEventListener("click", function () {
      row.scrollBy({ left: -step(), behavior: "smooth" });
    });
    next.addEventListener("click", function () {
      row.scrollBy({ left: step(), behavior: "smooth" });
    });
    host.appendChild(prev);
    host.appendChild(next);
  }

  function scan() {
    // Movies' poster rows scroll on .grid-row elements inside the
    // row wraps; the plain .row scroller is used for search results
    // (and on the TV Serials page). Cover both.
    document.querySelectorAll(".row, .grid-row").forEach(function (row) {
      if (row.children.length) attachChevrons(row);
    });
  }

  var queued = false;
  function queueScan() {
    if (queued) return;
    queued = true;
    setTimeout(function () {
      queued = false;
      scan();
    }, 350);
  }

  if (document.body) {
    new MutationObserver(queueScan).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  window.addEventListener("resize", queueScan);
  scan();
  // Fallback sweep in case mutations are missed while data loads.
  var n = 0;
  var timer = setInterval(function () {
    scan();
    if (++n >= 30) clearInterval(timer);
  }, 1500);
})();
