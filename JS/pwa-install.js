(function () {
  const PROMPT_HIDE_UNTIL_KEY = "lista_casamento_pwa_hide_until";
  const HIDE_FOR_DAYS = 3;

  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
    return;
  }

  let deferredPromptEvent = null;
  let installCard = null;
  let installText = null;
  let installButton = null;

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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // Ignore registration errors to avoid breaking app flows.
      });
    }
  });
})();
