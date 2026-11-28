/* Aayush TV — Channels Plus layer.
   Additive features for channels.html only:
   - Favorite channels (star on each card, saved on this device)
   - "Favorites" filter chip
   - Recently watched strip (tap to play again)
   - Now-playing highlight on the card
   - "/" shortcut focuses search, back-to-top button
   It never touches the page's playback code — it only watches the
   grid the page renders and adds its own controls on top. */
(function () {
  "use strict";

  var FAV_KEY = "atv-favs";
  var RECENT_KEY = "atv-recent";
  var RECENT_MAX = 12;

  function loadJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var favs = loadJSON(FAV_KEY, []);            // [channelId, ...]
  var recents = loadJSON(RECENT_KEY, []);      // [{id, name}, ...] newest first
  var favFilterOn = false;
  var playingId = null;

  function isFav(id) { return favs.indexOf(id) !== -1; }

  function grid() { return document.getElementById("grid"); }

  /* ---------- favorites + now-playing decoration ---------- */

  function decorate() {
    var g = grid();
    if (!g) return;
    g.querySelectorAll(".card").forEach(function (card) {
      var id = card.getAttribute("data-id");
      if (!id) return;

      var star = card.querySelector(".cp-star");
      if (!star) {
        star = document.createElement("button");
        star.type = "button";
        star.className = "cp-star";
        star.setAttribute("aria-label", "Favorite this channel");
        star.addEventListener("click", function (ev) {
          ev.stopPropagation();
          ev.preventDefault();
          toggleFav(id);
        });
        card.appendChild(star);
      }
      star.textContent = isFav(id) ? "★" : "☆";
      star.classList.toggle("on", isFav(id));

      var live = card.querySelector(".cp-live");
      if (playingId === id) {
        card.classList.add("cp-playing");
        if (!live) {
          live = document.createElement("div");
          live.className = "cp-live";
          live.textContent = "LIVE";
          card.appendChild(live);
        }
      } else {
        card.classList.remove("cp-playing");
        if (live) live.remove();
      }

      card.style.display = favFilterOn && !isFav(id) ? "none" : "";
    });
    updateFavChip();
  }

  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i === -1) favs.push(id); else favs.splice(i, 1);
    saveJSON(FAV_KEY, favs);
    decorate();
  }

  /* ---------- favorites filter chip ---------- */

  var favChip = null;
  function updateFavChip() {
    if (!favChip) return;
    favChip.classList.toggle("active", favFilterOn);
    var count = favChip.querySelector(".cp-count");
    if (count) count.textContent = favs.length ? " (" + favs.length + ")" : "";
  }

  function buildBar() {
    var cats = document.getElementById("cats");
    if (!cats || document.getElementById("cp-bar")) return;
    var bar = document.createElement("div");
    bar.id = "cp-bar";
    favChip = document.createElement("button");
    favChip.type = "button";
    favChip.id = "cp-fav-chip";
    favChip.innerHTML = "★ Favorites<span class=\"cp-count\"></span>";
    favChip.addEventListener("click", function () {
      favFilterOn = !favFilterOn;
      decorate();
    });
    bar.appendChild(favChip);
    cats.insertAdjacentElement("afterend", bar);
    updateFavChip();
  }

  /* ---------- recently watched ---------- */

  function buildRecent() {
    var g = grid();
    if (!g || document.getElementById("cp-recent")) return;
    var wrap = document.createElement("div");
    wrap.id = "cp-recent";
    wrap.innerHTML = "<div class=\"cp-recent-label\">Recently watched</div>" +
      "<div class=\"cp-recent-row\"></div>";
    g.insertAdjacentElement("beforebegin", wrap);
    renderRecent();
  }

  function renderRecent() {
    var wrap = document.getElementById("cp-recent");
    if (!wrap) return;
    var row = wrap.querySelector(".cp-recent-row");
    wrap.classList.toggle("open", recents.length > 0);
    row.innerHTML = "";
    recents.forEach(function (r) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cp-recent-chip";
      chip.textContent = "↻ " + r.name;
      chip.addEventListener("click", function () { playById(r.id); });
      row.appendChild(chip);
    });
  }

  function noteRecent(id, name) {
    if (!id || !name) return;
    recents = recents.filter(function (r) { return r.id !== id; });
    recents.unshift({ id: id, name: name });
    recents = recents.slice(0, RECENT_MAX);
    saveJSON(RECENT_KEY, recents);
    renderRecent();
  }

  function findCard(id) {
    var g = grid();
    if (!g) return null;
    var cards = g.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-id") === id) return cards[i];
    }
    return null;
  }

  function playById(id) {
    var card = findCard(id);
    if (card && card.style.display !== "none") { card.click(); return; }
    // Not in the current view: clear search + favorites filter, pick
    // the first category, then click once the grid re-renders.
    favFilterOn = false;
    var search = document.getElementById("search");
    if (search && search.value) {
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var firstCat = document.querySelector("#cats button");
    if (firstCat) firstCat.click();
    setTimeout(function () {
      var c = findCard(id);
      if (c) c.click();
    }, 350);
  }

  /* ---------- grid watching ---------- */

  function watchGrid() {
    var g = grid();
    if (!g) return;

    // Capture-phase click: remember what is playing + recents,
    // without interfering with the page's own click handler.
    g.addEventListener("click", function (ev) {
      var card = ev.target.closest ? ev.target.closest(".card") : null;
      if (!card) return;
      playingId = card.getAttribute("data-id");
      noteRecent(playingId, card.getAttribute("data-name") || "");
      // The page does not re-render on play, so decorate right away.
      setTimeout(decorate, 0);
    }, true);

    // renderGrid() rebuilds the cards on search/category/load —
    // re-apply stars, highlight and the favorites filter each time.
    new MutationObserver(function () { decorate(); })
      .observe(g, { childList: true });
  }

  /* ---------- small extras ---------- */

  function extras() {
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "/") return;
      var t = ev.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      var search = document.getElementById("search");
      if (search) { ev.preventDefault(); search.focus(); }
    });

    var top = document.createElement("button");
    top.type = "button";
    top.id = "cp-top";
    top.textContent = "↑";
    top.setAttribute("aria-label", "Back to top");
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(top);
    window.addEventListener("scroll", function () {
      top.classList.toggle("open", window.scrollY > 700);
    }, { passive: true });
  }

  function init() {
    buildBar();
    buildRecent();
    watchGrid();
    extras();
    decorate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
