/* 즐부 허브 — 탭 라우팅 · 설치 · 오프라인 캐시 */
(function () {
  "use strict";

  var TABS = ["home", "lecture", "store", "deed", "challenge"];
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-tab]"));
  var views = {
    home: document.getElementById("view-home"),
    lecture: document.getElementById("view-lecture"),
    store: document.getElementById("view-store"),
    deed: document.getElementById("view-deed"),
    challenge: document.getElementById("view-challenge")
  };

  function isValid(name) {
    return TABS.indexOf(name) !== -1;
  }

  function activate(name, opts) {
    if (!isValid(name)) name = "home";

    TABS.forEach(function (key) {
      var view = views[key];
      if (!view) return;
      var on = key === name;
      if (on && view.hidden) {
        view.hidden = false;
        view.classList.remove("is-entering");
        void view.offsetWidth; // 애니메이션 재생
        view.classList.add("is-entering");
      } else if (!on) {
        view.hidden = true;
        view.classList.remove("is-entering");
      }
    });

    buttons.forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === name;
      btn.classList.toggle("is-active", on);
      if (btn.getAttribute("role") === "tab") btn.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
      if (btn.classList.contains("tab")) btn.tabIndex = on ? 0 : -1;
    });

    var push = !opts || opts.push !== false;
    if (push) {
      var target = "#" + name;
      if (window.location.hash !== target) {
        try {
          history.replaceState(null, "", target);
        } catch (e) {
          window.location.hash = name;
        }
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      activate(btn.getAttribute("data-tab"));
    });
    btn.addEventListener("keydown", function (ev) {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      var group = Array.prototype.slice.call(
        btn.closest("nav").querySelectorAll("[data-tab]")
      );
      var i = group.indexOf(btn);
      var next = ev.key === "ArrowRight" ? (i + 1) % group.length : (i - 1 + group.length) % group.length;
      ev.preventDefault();
      group[next].focus();
      activate(group[next].getAttribute("data-tab"));
    });
  });

  document.querySelectorAll("[data-go]").forEach(function (el) {
    el.addEventListener("click", function () {
      activate(el.getAttribute("data-go"));
    });
  });

  window.addEventListener("hashchange", function () {
    var name = window.location.hash.replace("#", "");
    if (isValid(name)) activate(name, { push: false });
  });

  var initial = window.location.hash.replace("#", "");
  activate(isValid(initial) ? initial : "home", { push: false });

  /* ---------- 홈 화면 설치 ---------- */
  var deferredPrompt = null;
  var btnTop = document.getElementById("installBtn");
  var btnCard = document.getElementById("installBtn2");

  function showInstallButtons(show) {
    [btnTop, btnCard].forEach(function (b) {
      if (b) b.hidden = !show;
    });
  }

  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    deferredPrompt = ev;
    showInstallButtons(true);
  });

  function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      if (choice && choice.outcome === "accepted") showInstallButtons(false);
      deferredPrompt = null;
    });
  }

  [btnTop, btnCard].forEach(function (b) {
    if (b) b.addEventListener("click", promptInstall);
  });

  window.addEventListener("appinstalled", function () {
    showInstallButtons(false);
  });

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isIOS && !standalone) {
    var card = document.getElementById("installCard");
    if (card) {
      var p = card.querySelector("p");
      if (p) p.textContent = "사파리 하단의 공유 버튼 → ‘홈 화면에 추가’를 누르면 앱처럼 열립니다.";
    }
  }

  /* ---------- 서비스 워커 ---------- */
  if ("serviceWorker" in navigator) {
    var secure = window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (secure) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }
})();
