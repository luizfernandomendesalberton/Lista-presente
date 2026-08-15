(function () {
  const PROMPT_HIDE_UNTIL_KEY = "lista_casamento_pwa_hide_until";
  const HIDE_FOR_DAYS = 3;
  const REINSTALL_NOTICE_KEY = "lista_casamento_reinstall_notice_v4";
  const WHEEL_SCROLL_SMOOTHNESS = 0.11;
  const WHEEL_SCROLL_STRENGTH = 0.85;

  let deferredPromptEvent = null;
  let installCard = null;
  let installText = null;
  let installButton = null;

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        // Ignore registration errors to avoid breaking app flows.
      });
  }

  registerServiceWorker();

  function hasScrollableParent(target) {
    let element = target instanceof Element ? target : null;

    while (element && element !== document.body) {
      const styles = window.getComputedStyle(element);
      const canScrollVertically = styles.overflowY === "auto" || styles.overflowY === "scroll";
      if (canScrollVertically && element.scrollHeight > element.clientHeight) {
        return true;
      }
      element = element.parentElement;
    }

    return false;
  }

  function enableSmoothWheelScrolling() {
    let targetScroll = window.scrollY;
    let currentScroll = window.scrollY;
    let animationFrameId = null;

    function clampScroll(position) {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(position, maxScroll));
    }

    function animate() {
      const distance = targetScroll - currentScroll;
      currentScroll += distance * WHEEL_SCROLL_SMOOTHNESS;

      if (Math.abs(distance) < 0.35) {
        currentScroll = targetScroll;
        animationFrameId = null;
      }

      window.scrollTo(0, currentScroll);
      if (animationFrameId !== null) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    }

    window.addEventListener("wheel", (event) => {
      if (event.ctrlKey || event.metaKey || hasScrollableParent(event.target)) {
        return;
      }

      event.preventDefault();
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * window.innerHeight
          : event.deltaY;
      targetScroll = clampScroll(targetScroll + delta * WHEEL_SCROLL_STRENGTH);

      if (animationFrameId === null) {
        currentScroll = window.scrollY;
        animationFrameId = window.requestAnimationFrame(animate);
      }
    }, { passive: false });

    window.addEventListener("resize", () => {
      targetScroll = clampScroll(targetScroll);
      currentScroll = window.scrollY;
    });

    window.addEventListener("scroll", () => {
      if (animationFrameId === null) {
        targetScroll = window.scrollY;
        currentScroll = window.scrollY;
      }
    }, { passive: true });
  }

  enableSmoothWheelScrolling();

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);

  function showReinstallNotice() {
    if (!isStandalone || !isMobile) {
      return;
    }

    try {
      if (window.localStorage.getItem(REINSTALL_NOTICE_KEY) === "shown") {
        return;
      }
    } catch (_error) {
      return;
    }

    const notice = document.createElement("section");
    notice.className = "install-pwa-card";
    notice.setAttribute("aria-label", "Atualizacao do aplicativo");

    const title = document.createElement("h2");
    title.className = "install-pwa-title";
    title.textContent = "Atualizacao do aplicativo";

    const message = document.createElement("p");
    message.className = "install-pwa-text";
    message.textContent = "Para trocar o icone, remova este aplicativo da tela inicial e instale-o novamente pelo navegador.";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "btn-secondary";
    closeButton.textContent = "Entendi";
    closeButton.addEventListener("click", () => {
      try {
        window.localStorage.setItem(REINSTALL_NOTICE_KEY, "shown");
      } catch (_error) {
        // Ignore storage failures.
      }
      notice.remove();
    });

    notice.appendChild(title);
    notice.appendChild(message);
    notice.appendChild(closeButton);
    document.body.appendChild(notice);
  }

  if (isStandalone) {
    window.addEventListener("load", showReinstallNotice);
    return;
  }

  function hidePromptTemporarily() {
    const hideUntil = Date.now() + HIDE_FOR_DAYS * 24 * 60 * 60 * 1000;
    try {
      window.localStorage.setItem(PROMPT_HIDE_UNTIL_KEY, String(hideUntil));
    } catch (_error) {
      // Ignore storage failures.
    }

    if (installCard) {
      installCard.hidden = true;
    }
  }

  function shouldHidePrompt() {
    try {
      const rawValue = window.localStorage.getItem(PROMPT_HIDE_UNTIL_KEY);
      const timestamp = Number(rawValue || 0);
      return Number.isFinite(timestamp) && timestamp > Date.now();
    } catch (_error) {
      return false;
    }
  }

  function updateInstallUI() {
    if (!installCard || !installText || !installButton) {
      return;
    }

    if (!deferredPromptEvent) {
      installCard.hidden = true;
      return;
    }

    installCard.hidden = false;
    installText.textContent = "Instalar app para acesso rapido?";
    installButton.disabled = false;
    installButton.textContent = "Instalar";
  }

  function createInstallPrompt() {
    if (installCard) {
      return;
    }

    if (shouldHidePrompt()) {
      return;
    }

    installCard = document.createElement("section");
    installCard.className = "install-pwa-card";
    installCard.setAttribute("aria-label", "Instalacao do aplicativo");
    installCard.hidden = true;

    const title = document.createElement("h2");
    title.className = "install-pwa-title";
    title.textContent = "Alerta";

    installText = document.createElement("p");
    installText.className = "install-pwa-text";

    const actions = document.createElement("div");
    actions.className = "install-pwa-actions";

    installButton = document.createElement("button");
    installButton.type = "button";
    installButton.textContent = "Instalar";
    installButton.disabled = false;

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "btn-secondary";
    dismissButton.textContent = "Fechar";

    actions.appendChild(installButton);
    actions.appendChild(dismissButton);

    installCard.appendChild(title);
    installCard.appendChild(installText);
    installCard.appendChild(actions);

    document.body.appendChild(installCard);

    installButton.addEventListener("click", async () => {
      if (!deferredPromptEvent) {
        return;
      }

      deferredPromptEvent.prompt();
      const choice = await deferredPromptEvent.userChoice;
      deferredPromptEvent = null;

      if (choice.outcome === "accepted") {
        installCard.hidden = true;
      } else {
        updateInstallUI();
      }
    });

    dismissButton.addEventListener("click", hidePromptTemporarily);
    updateInstallUI();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPromptEvent = event;
    createInstallPrompt();
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    if (installCard) {
      installCard.hidden = true;
    }
  });

  window.addEventListener("load", () => {
    registerServiceWorker();
  });
})();
