// StastistikDompet — PWA helper (install prompt, offline, update notice)
// File terpisah dari Scrip.js supaya tidak mengganggu logika aplikasi yang sudah ada.
(function () {
  'use strict';

  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true; // iOS Safari
  var isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

  var installBtn = document.getElementById('installAppBtn');
  var installToast = document.getElementById('pwaInstallToast');
  var installTitle = document.getElementById('pwaInstallTitle');
  var installBody = document.getElementById('pwaInstallBody');
  var installAction = document.getElementById('pwaInstallAction');
  var closeInstallToast = document.getElementById('closePwaInstallToast');
  var updateToast = document.getElementById('pwaUpdateToast');
  var updateAction = document.getElementById('pwaUpdateAction');
  var closeUpdateToast = document.getElementById('closePwaUpdateToast');

  var DISMISS_KEY = 'pwaInstallDismissedAt';
  var DISMISS_DAYS = 7;

  function wasDismissedRecently() {
    var raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    var days = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }

  function hideInstallUi() {
    if (installBtn) installBtn.style.display = 'none';
    if (installToast) installToast.classList.remove('show');
  }

  // ---------- Register Service Worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Ada versi baru siap dipakai
              if (updateToast) updateToast.classList.add('show');
            }
          });
        });
      }).catch(function (err) {
        console.warn('Service worker gagal didaftarkan:', err);
      });

      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }

  if (updateAction) {
    updateAction.addEventListener('click', function () {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg && reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        else window.location.reload();
      });
    });
  }
  if (closeUpdateToast) {
    closeUpdateToast.addEventListener('click', function () {
      updateToast.classList.remove('show');
    });
  }

  // Sudah terpasang sebagai app -> tidak perlu ajakan install
  if (isStandalone) {
    hideInstallUi();
    return;
  }

  // ---------- Android / Desktop (Chrome, Edge, dll) ----------
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = '';
    if (!wasDismissedRecently()) {
      setTimeout(function () {
        if (installToast) installToast.classList.add('show');
      }, 2500);
    }
  });

  function triggerInstallPrompt() {
    if (!deferredPrompt) return;
    installToast && installToast.classList.remove('show');
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      if (installBtn) installBtn.style.display = 'none';
    });
  }

  if (installBtn) installBtn.addEventListener('click', triggerInstallPrompt);
  if (installAction) installAction.addEventListener('click', triggerInstallPrompt);

  window.addEventListener('appinstalled', function () {
    hideInstallUi();
    deferredPrompt = null;
  });

  // ---------- iOS Safari (tidak punya beforeinstallprompt, kasih panduan manual) ----------
  if (isIOS && !wasDismissedRecently()) {
    if (installTitle) installTitle.textContent = '📲 Pasang di Layar Utama';
    if (installBody) {
      installBody.innerHTML =
        'Buka menu <strong>Bagikan</strong> di Safari (ikon kotak dengan panah ke atas), lalu pilih <strong>"Tambah ke Layar Utama"</strong> untuk memasang StastistikDompet sebagai aplikasi.';
    }
    if (installAction) installAction.style.display = 'none';
    setTimeout(function () {
      if (installToast) installToast.classList.add('show');
    }, 2500);
  }

  if (closeInstallToast) {
    closeInstallToast.addEventListener('click', function () {
      installToast.classList.remove('show');
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    });
  }
})();
