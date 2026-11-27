// netflix.js — small Netflix-style helpers for Movies + TV Serials.
// Defensive throughout: if a page has no rows or header, it does nothing.
//  1. Header turns solid Netflix black once the page is scrolled.
//  2. Horizontal rows get Netflix-style hover chevron buttons that
//     scroll the row by most of a screen. Rows are rendered by the
//     pages' own scripts after load, so this re-scans for a while.
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

  function attachChevrons(row) {
    if (row.dataset.nfxChev) return;
    if (row.scrollWidth <= row.clientWidth + 12) return;
    var host = row.parentElement;
    if (!host) return;
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

  var scans = 0;
  var timer = setInterval(function () {
    scans++;
    var rows = document.querySelectorAll(".row");
    var pending = false;
    rows.forEach(function (row) {
      if (!row.dataset.nfxChev && row.children.length) {
        attachChevrons(row);
        if (!row.dataset.nfxChev) pending = true;
      }
    });
    if (scans >= 40 || (scans > 6 && !pending && rows.length)) {
      clearInterval(timer);
    }
  }, 1200);
})();
