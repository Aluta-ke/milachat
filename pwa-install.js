(function () {
  "use strict";

  var STYLE_ID = "nc-pwa-install-styles";
  var ROOT_ID = "nc-pwa-root";

  var deferredPrompt = null;
  var root = null;

  function isStandalone() {
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    var ua = window.navigator.userAgent || "";
    var iOSDevice = /iPad|iPhone|iPod/.test(ua);
    var iPadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return (iOSDevice || iPadOs) && !window.MSStream;
  }

  function isLocalPreview() {
    var host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }

  function wantsForcedPreview() {
    try {
      return new URLSearchParams(window.location.search).has("preview-install");
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + ROOT_ID + "{position:fixed;z-index:80;top:50%;right:max(12px,env(safe-area-inset-right,0px));left:auto;bottom:auto;transform:translateY(-50%);display:flex;justify-content:flex-end;pointer-events:none}" +
      "#" + ROOT_ID + " .nc-pwa-card{pointer-events:auto;box-sizing:border-box;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:132px;height:132px;padding:.7rem .5rem .6rem;overflow:visible;text-align:center;background:radial-gradient(circle at 35% 28%,#1aa39a 0%,#0e7c7b 68%,#0a6463 100%);border:2px solid rgba(255,255,255,.35);border-radius:50%;box-shadow:0 10px 24px rgba(15,23,42,.16),0 0 0 1px rgba(14,124,123,.12),0 0 18px rgba(14,124,123,.12);animation:nc-pwa-in .38s ease-out,nc-pwa-float 3.2s ease-in-out .38s infinite}" +
      "#" + ROOT_ID + " .nc-pwa-card::before{content:\"\";position:absolute;left:-8px;top:58%;width:14px;height:14px;background:#0e7c7b;border-radius:4px 0 8px 0;box-shadow:-3px 4px 10px rgba(15,23,42,.08);transform:rotate(42deg)}" +
      "#" + ROOT_ID + " .nc-pwa-card::after{content:\"\";position:absolute;top:10px;left:22px;width:32px;height:14px;border-radius:50%;background:rgba(255,255,255,.7);pointer-events:none}" +
      "#" + ROOT_ID + " *{box-sizing:border-box}" +
      "#" + ROOT_ID + " .nc-pwa-logo{width:32px;height:32px;border-radius:999px;object-fit:cover;box-shadow:0 2px 8px rgba(14,124,123,.22)}" +
      "#" + ROOT_ID + " .nc-pwa-title{margin:.22rem 0 0;color:#fff;font-family:\"Plus Jakarta Sans\",Inter,system-ui,sans-serif;font-size:.64rem;font-weight:800;line-height:1.15}" +
      "#" + ROOT_ID + " .nc-pwa-sub{margin:.08rem 0 0;color:rgba(255,255,255,.88);font-family:Inter,system-ui,sans-serif;font-size:.48rem;font-weight:600}" +
      "#" + ROOT_ID + " .nc-pwa-ios{display:none;margin:.14rem 0 0;max-width:6.8rem;color:rgba(255,255,255,.85);font-family:Inter,system-ui,sans-serif;font-size:.44rem;font-weight:500;line-height:1.25}" +
      "#" + ROOT_ID + "[data-ios=\"true\"] .nc-pwa-ios{display:block}" +
      "#" + ROOT_ID + " .nc-pwa-install{display:inline-flex;align-items:center;justify-content:center;width:4.7rem;margin-top:.22rem;padding:.22rem .5rem;border:0;border-radius:999px;background:#ff6b5b;color:#fff;font-family:Inter,system-ui,sans-serif;font-size:.56rem;font-weight:800;cursor:pointer;box-shadow:0 8px 18px -8px rgba(255,107,91,.7)}" +
      "#" + ROOT_ID + " .nc-pwa-install:hover{transform:scale(1.03)}" +
      "#" + ROOT_ID + " .nc-pwa-install:active{transform:scale(.97)}" +
      "@keyframes nc-pwa-in{from{opacity:0;transform:translateY(10px) scale(.86)}to{opacity:1;transform:translateY(0) scale(1)}}" +
      "@keyframes nc-pwa-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}" +
      "@media (max-width:420px){#" + ROOT_ID + "{right:max(8px,env(safe-area-inset-right,0px))}#" + ROOT_ID + " .nc-pwa-card{width:116px;height:116px}#" + ROOT_ID + " .nc-pwa-logo{width:28px;height:28px}}" +
      "@media (prefers-reduced-motion:reduce){#" + ROOT_ID + " .nc-pwa-card{animation:none}}";
    document.head.appendChild(style);
  }

  function hide() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
  }

  function show() {
    if (root || isStandalone()) return;
    if (!document.body) return;

    injectStyles();

    var ios = isIos();
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "nc-pwa";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Install MilaChat");
    if (ios) root.setAttribute("data-ios", "true");

    root.innerHTML =
      '<div class="nc-pwa-card">' +
        '<img class="nc-pwa-logo" src="/favicon-192.png?v=milachat" width="32" height="32" alt="MilaChat">' +
        '<p class="nc-pwa-title">MilaChat</p>' +
        '<p class="nc-pwa-sub">Android • iPhone</p>' +
        '<p class="nc-pwa-ios">To install MilaChat:<br>Tap Share → Add to Home Screen</p>' +
        '<button type="button" class="nc-pwa-install">Install</button>' +
      "</div>";

    root.querySelector(".nc-pwa-install").addEventListener("click", function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
          if (choice && choice.outcome === "accepted") hide();
        }).catch(function () {});
        return;
      }
      if (ios) {
        var hint = root.querySelector(".nc-pwa-ios");
        if (hint) hint.style.display = "block";
      }
    });

    document.body.appendChild(root);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone()) show();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hide();
  });

  function start() {
    registerServiceWorker();
    if (isStandalone()) return;
    if (isIos() || isLocalPreview() || wantsForcedPreview()) {
      window.setTimeout(show, 700);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
