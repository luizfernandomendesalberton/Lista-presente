const appVersionEl = document.getElementById("appVersion");
const guestLoginForm = document.getElementById("guestLoginForm");
const guestPasswordInput = document.getElementById("guestPassword");
const guestLoginStatus = document.getElementById("guestLoginStatus");
const adminDirectLoginForm = document.getElementById("adminDirectLoginForm");
const adminDirectEmailInput = document.getElementById("adminDirectEmail");
const adminDirectPasswordInput = document.getElementById("adminDirectPassword");
const adminDirectStatus = document.getElementById("adminDirectStatus");
const guestAccessPanel = document.getElementById("guestAccessPanel");
const adminAccessPanel = document.getElementById("adminAccessPanel");
const showGuestAccessBtn = document.getElementById("showGuestAccessBtn");
const showAdminAccessBtn = document.getElementById("showAdminAccessBtn");

const gruposList = document.getElementById("gruposList");
const presencaStatus = document.getElementById("presencaStatus");
const presencaHint = document.getElementById("presencaHint");
const btnGoPresentes = document.getElementById("btnGoPresentes");
const btnRefreshGrupos = document.getElementById("btnRefreshGrupos");
const presencaRulesPanel = document.getElementById("presencaRulesPanel");
const presencaRulesDismissBtn = document.getElementById("presencaRulesDismissBtn");
const presencaConfirmModal = document.getElementById("presencaConfirmModal");
const presencaConfirmClose = document.getElementById("presencaConfirmClose");
const presencaConfirmTitle = document.getElementById("presencaConfirmTitle");
const presencaConfirmSubtitle = document.getElementById("presencaConfirmSubtitle");
const presencaConfirmMessage = document.getElementById("presencaConfirmMessage");
const presencaConfirmNo = document.getElementById("presencaConfirmNo");
const presencaConfirmYes = document.getElementById("presencaConfirmYes");

const PRESENCA_RULES_HIDE_KEY = "lista_casamento_hide_presenca_rules";
let presencaConfirmResolver = null;

const isLoginPage = Boolean(guestLoginForm);
const isPresencaPage = Boolean(gruposList);

function animateLoginPanel(panel) {
	if (!panel) {
		return;
	}

	panel.classList.remove("login-panel-reveal");
	// Force reflow so animation replays when switching modes repeatedly.
	void panel.offsetWidth;
	panel.classList.add("login-panel-reveal");
}

function setLoginMode(mode) {
	if (!isLoginPage || !guestAccessPanel || !adminAccessPanel || !showGuestAccessBtn || !showAdminAccessBtn) {
		return;
	}

	const isGuestMode = mode !== "admin";
	guestAccessPanel.hidden = !isGuestMode;
	adminAccessPanel.hidden = isGuestMode;
	animateLoginPanel(isGuestMode ? guestAccessPanel : adminAccessPanel);

	showGuestAccessBtn.classList.toggle("is-active", isGuestMode);
	showAdminAccessBtn.classList.toggle("is-active", !isGuestMode);
	showGuestAccessBtn.setAttribute("aria-selected", isGuestMode ? "true" : "false");
	showAdminAccessBtn.setAttribute("aria-selected", isGuestMode ? "false" : "true");

	if (isGuestMode && guestPasswordInput) {
		guestPasswordInput.focus();
	}
	if (!isGuestMode && adminDirectEmailInput) {
		adminDirectEmailInput.focus();
	}
}

function formatDateTime(isoDate) {
	if (!isoDate) {
		return "";
	}

	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleString("pt-BR");
}

function setPresentesAccess(enabled) {
	if (!btnGoPresentes) {
		return;
	}

	btnGoPresentes.classList.toggle("is-disabled", !enabled);
	btnGoPresentes.setAttribute("aria-disabled", enabled ? "false" : "true");

	if (!enabled) {
		btnGoPresentes.title = "Confirme sua presenca para liberar a lista de presentes.";
	} else {
		btnGoPresentes.title = "";
	}
}

async function loadAppVersion() {
	if (!appVersionEl) {
		return;
	}

	try {
		const response = await fetch("/api/version");
		if (!response.ok) {
			throw new Error("Erro ao carregar versao.");
		}

		const data = await response.json();
		const version = String(data.version || "--").trim() || "--";
		appVersionEl.textContent = `Versao ${version}`;
	} catch (_error) {
		appVersionEl.textContent = "Versao --";
	}
}

async function getGuestSession() {
	const response = await fetch("/api/guest/session", {
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error("Nao foi possivel validar a sessao.");
	}

	return response.json();
}

async function submitGuestLogin(event) {
	event.preventDefault();
	if (!guestPasswordInput || !guestLoginStatus) {
		return;
	}

	const password = guestPasswordInput.value.trim();
	if (!password) {
		guestLoginStatus.textContent = "Digite a senha para entrar.";
		return;
	}

	guestLoginStatus.textContent = "Validando senha...";

	try {
		const response = await fetch("/api/guest/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "same-origin",
			body: JSON.stringify({ password }),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.erro || "Senha invalida.");
		}

		guestLoginStatus.textContent = "Senha validada. Redirecionando...";
		window.location.href = "/presenca";
	} catch (error) {
		guestLoginStatus.textContent = error.message;
	}
}

async function submitAdminDirectLogin(event) {
	event.preventDefault();
	if (!adminDirectEmailInput || !adminDirectPasswordInput || !adminDirectStatus) {
		return;
	}

	const email = adminDirectEmailInput.value.trim().toLowerCase();
	const password = adminDirectPasswordInput.value;

	if (!email || !password) {
		adminDirectStatus.textContent = "Informe e-mail e senha.";
		return;
	}

	adminDirectStatus.textContent = "Validando acesso de administrador...";

	try {
		const response = await fetch("/api/admin/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "same-origin",
			body: JSON.stringify({ email, password }),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.erro || "Nao foi possivel entrar com acesso de administrador.");
		}

		adminDirectStatus.textContent = "Acesso total liberado. Redirecionando...";
		window.location.href = "/admin";
	} catch (error) {
		adminDirectStatus.textContent = error.message;
	}
}

async function confirmPresence(nome, vaiAoEvento) {
	if (!presencaStatus) {
		return;
	}

	const actionLabel = vaiAoEvento ? "confirmar presença" : "marcar como não vai";
	const confirmMessage = `Deseja ${actionLabel}? Esta escolha será aplicada para todo o grupo/família e depois só os noivos (admin) podem alterar.`;
	const confirmed = await askPresencaConfirmation(actionLabel, confirmMessage, {
		title: "Confirmar Escolha",
		subtitle: `Você escolheu ${actionLabel}.`,
		confirmLabel: "Continuar",
		cancelLabel: "Cancelar",
	});
	if (!confirmed) {
		return;
	}

	const finalMessage = vaiAoEvento
		? "Última confirmação: deseja salvar agora que TODO o grupo/família vai ao evento?"
		: "Última confirmação: deseja salvar agora que TODO o grupo/família não vai ao evento?";
	const finalConfirmed = await askPresencaConfirmation(actionLabel, finalMessage, {
		title: "Confirmação Final",
		subtitle: "Esta ação será gravada agora e ficará bloqueada para edição nesta tela.",
		confirmLabel: "Sim, salvar agora",
		cancelLabel: "Voltar",
	});
	if (!finalConfirmed) {
		return;
	}

	presencaStatus.textContent = "Salvando confirmacao...";

	try {
		const response = await fetch("/api/presenca/confirmar", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "same-origin",
			body: JSON.stringify({
				nome,
				vai_ao_evento: vaiAoEvento,
			}),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.erro || "Nao foi possivel confirmar.");
		}

		if (data.grupo) {
			presencaStatus.textContent = vaiAoEvento
				? `Grupo ${data.grupo} confirmado (${data.grupo_confirmados}/${data.grupo_total}).`
				: `Grupo ${data.grupo} marcado como nao vai (${data.grupo_confirmados}/${data.grupo_total}).`;
		} else {
			presencaStatus.textContent = vaiAoEvento
				? `Presenca confirmada para ${nome}.`
				: `Resposta registrada para ${nome}.`;
		}

		await loadGroups();
	} catch (error) {
		presencaStatus.textContent = error.message;
	}
}

async function requestPresenceChange(convidado) {
	if (!presencaStatus || !convidado || !convidado.nome) {
		return;
	}

	const requestMessage = "Desejo trocar a resposta da confirmação de presença.";

	const statusAtual = convidado.vai_ao_evento ? "confirmado para ir" : "confirmado como não vai";
	const confirmMessage = `Deseja solicitar por e-mail uma alteração da resposta de ${convidado.nome}? Status atual: ${statusAtual}.`;
	const confirmed = await askPresencaConfirmation("solicitar alteração", confirmMessage, {
		title: "Solicitar Alteração",
		subtitle: "Os noivos receberão seu pedido por e-mail para ajustar no painel admin.",
		confirmLabel: "Enviar solicitação",
		cancelLabel: "Cancelar",
	});
	if (!confirmed) {
		return;
	}

	presencaStatus.textContent = "Enviando solicitação por e-mail...";

	try {
		const response = await fetch("/api/presenca/solicitar-alteracao", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "same-origin",
			body: JSON.stringify({
				nome: convidado.nome,
				mensagem: requestMessage,
			}),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.erro || "Não foi possível enviar a solicitação de alteração.");
		}

		presencaStatus.textContent = data.mensagem || "Solicitação enviada com sucesso.";
	} catch (error) {
		presencaStatus.textContent = error.message;
	}
}

async function bindGuestName(nome) {
	if (!presencaStatus) {
		return;
	}

	presencaStatus.textContent = "Vinculando sua sessão...";

	try {
		const response = await fetch("/api/guest/vincular", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "same-origin",
			body: JSON.stringify({ nome }),
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.erro || "Nao foi possivel vincular sua sessao.");
		}

		setPresentesAccess(Boolean(data.can_access_presentes));
		presencaStatus.textContent = data.can_access_presentes
			? "Sessao vinculada. A lista de presentes foi liberada."
			: "Sessao vinculada, mas a lista de presentes ainda nao esta liberada.";

		await loadGroups();
	} catch (error) {
		presencaStatus.textContent = error.message;
	}
}

function closePresencaConfirmModal(confirmed) {
	if (!presencaConfirmModal) {
		return;
	}

	presencaConfirmModal.hidden = true;
	if (typeof presencaConfirmResolver === "function") {
		presencaConfirmResolver(Boolean(confirmed));
		presencaConfirmResolver = null;
	}
}

function askPresencaConfirmation(actionLabel, message, options = {}) {
	if (!presencaConfirmModal || !presencaConfirmMessage) {
		return Promise.resolve(window.confirm(message));
	}

	const title = String(options.title || "Confirmar Escolha").trim() || "Confirmar Escolha";
	const subtitle = String(options.subtitle || `Você escolheu ${actionLabel}.`).trim() || `Você escolheu ${actionLabel}.`;
	const confirmLabel = String(options.confirmLabel || "Confirmar agora").trim() || "Confirmar agora";
	const cancelLabel = String(options.cancelLabel || "Cancelar").trim() || "Cancelar";

	presencaConfirmMessage.textContent = message;
	if (presencaConfirmTitle) {
		presencaConfirmTitle.textContent = title;
	}
	if (presencaConfirmSubtitle) {
		presencaConfirmSubtitle.textContent = subtitle;
	}
	if (presencaConfirmYes) {
		presencaConfirmYes.textContent = confirmLabel;
	}
	if (presencaConfirmNo) {
		presencaConfirmNo.textContent = cancelLabel;
	}
	presencaConfirmModal.hidden = false;

	if (presencaConfirmNo) {
		presencaConfirmNo.focus();
	}

	return new Promise((resolve) => {
		presencaConfirmResolver = resolve;
	});
}

function buildGuestCard(convidado, guestNome) {
	const card = document.createElement("article");
	card.className = "grupo-convidado";

	if (convidado.presenca_confirmada) {
		card.classList.add(convidado.vai_ao_evento ? "is-confirmed" : "is-declined");
	}

	if (guestNome && guestNome === convidado.nome) {
		card.classList.add("is-current");
	}

	const title = document.createElement("h4");
	title.textContent = convidado.nome;
	card.appendChild(title);

	const subtitle = document.createElement("p");
	if (convidado.tipo === "noivos") {
		subtitle.textContent = "Noivos";
	} else if (convidado.presenca_confirmada) {
		subtitle.textContent = convidado.vai_ao_evento ? "Confirmado" : "Nao vai";
	} else {
		subtitle.textContent = "Pendente";
	}
	card.appendChild(subtitle);

	if (convidado.presenca_confirmada_em) {
		const time = document.createElement("small");
		time.textContent = `Atualizado em ${formatDateTime(convidado.presenca_confirmada_em)}`;
		card.appendChild(time);
	}

	const actions = document.createElement("div");
	actions.className = "grupo-convidado-actions";

	if (!convidado.presenca_confirmada) {
		const btnConfirm = document.createElement("button");
		btnConfirm.type = "button";
		btnConfirm.textContent = "Confirmar Presenca";
		btnConfirm.addEventListener("click", () => {
			confirmPresence(convidado.nome, true);
		});
		actions.appendChild(btnConfirm);

		const btnDecline = document.createElement("button");
		btnDecline.type = "button";
		btnDecline.className = "btn-secondary";
		btnDecline.textContent = "Nao Vou";
		btnDecline.addEventListener("click", () => {
			confirmPresence(convidado.nome, false);
		});
		actions.appendChild(btnDecline);

		card.appendChild(actions);
	} else {
		const lockedInfo = document.createElement("small");
		lockedInfo.textContent = "Para alterar sua resposta, fale com os noivos (admin).";
		card.appendChild(lockedInfo);

		if (!guestNome) {
			const btnBindGuest = document.createElement("button");
			btnBindGuest.type = "button";
			btnBindGuest.className = "btn-secondary";
			btnBindGuest.textContent = "Sou eu";
			btnBindGuest.addEventListener("click", () => {
				bindGuestName(convidado.nome);
			});
			card.appendChild(btnBindGuest);
		}

		if (guestNome && guestNome === convidado.nome) {
			const btnRequestChange = document.createElement("button");
			btnRequestChange.type = "button";
			btnRequestChange.className = "btn-secondary";
			btnRequestChange.textContent = "Quero trocar minha resposta";
			btnRequestChange.addEventListener("click", () => {
				requestPresenceChange(convidado);
			});
			card.appendChild(btnRequestChange);
		}
	}

	return card;
}

function renderGroups(payload) {
	if (!gruposList) {
		return;
	}

	gruposList.innerHTML = "";
	const grupos = Array.isArray(payload.grupos) ? payload.grupos : [];

	if (!grupos.length) {
		gruposList.innerHTML = "<p>Nenhum convidado encontrado.</p>";
		return;
	}

	grupos.forEach((grupoData) => {
		const section = document.createElement("section");
		section.className = "grupo-card";

		const title = document.createElement("h3");
		title.textContent = grupoData.grupo;
		section.appendChild(title);

		const wrap = document.createElement("div");
		wrap.className = "grupo-convidados";

		(grupoData.convidados || []).forEach((convidado) => {
			wrap.appendChild(buildGuestCard(convidado, payload.guest_nome || ""));
		});

		section.appendChild(wrap);
		gruposList.appendChild(section);
	});
}

async function loadGroups() {
	if (!isPresencaPage || !presencaStatus) {
		return;
	}

	presencaStatus.textContent = "Carregando grupos...";

	try {
		const response = await fetch("/api/presenca/grupos", {
			credentials: "same-origin",
			cache: "no-store",
		});

		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.erro || "Nao foi possivel carregar a lista de presenca.");
		}

		renderGroups(data);
		setPresentesAccess(Boolean(data.can_access_presentes));

		if (presencaHint) {
			if (data.guest_nome) {
				presencaHint.textContent = `Sessao vinculada a ${data.guest_nome}.`;
			} else {
				presencaHint.textContent = "Toque no seu nome e confirme sua resposta.";
			}
		}

		presencaStatus.textContent = "";
	} catch (error) {
		presencaStatus.textContent = error.message;
	}
}

async function initLoginPage() {
	if (!isLoginPage) {
		return;
	}

	setLoginMode("guest");
	if (showGuestAccessBtn) {
		showGuestAccessBtn.addEventListener("click", () => {
			setLoginMode("guest");
		});
	}
	if (showAdminAccessBtn) {
		showAdminAccessBtn.addEventListener("click", () => {
			setLoginMode("admin");
		});
	}

	guestLoginForm.addEventListener("submit", submitGuestLogin);
	if (adminDirectLoginForm) {
		adminDirectLoginForm.addEventListener("submit", submitAdminDirectLogin);
	}

	try {
		const sessionData = await getGuestSession();
		if (sessionData.admin_authenticated) {
			window.location.href = "/admin";
			return;
		}
	} catch (_error) {
		// Login page continues available even if session endpoint fails.
	}
}

async function initPresencaPage() {
	if (!isPresencaPage) {
		return;
	}

	if (presencaRulesPanel) {
		const shouldHideRules = window.localStorage.getItem(PRESENCA_RULES_HIDE_KEY) === "1";
		presencaRulesPanel.hidden = shouldHideRules;
	}

	if (presencaRulesDismissBtn) {
		presencaRulesDismissBtn.addEventListener("click", () => {
			window.localStorage.setItem(PRESENCA_RULES_HIDE_KEY, "1");
			if (presencaRulesPanel) {
				presencaRulesPanel.hidden = true;
			}
		});
	}

	if (presencaConfirmYes) {
		presencaConfirmYes.addEventListener("click", () => {
			closePresencaConfirmModal(true);
		});
	}

	if (presencaConfirmNo) {
		presencaConfirmNo.addEventListener("click", () => {
			closePresencaConfirmModal(false);
		});
	}

	if (presencaConfirmClose) {
		presencaConfirmClose.addEventListener("click", () => {
			closePresencaConfirmModal(false);
		});
	}

	if (presencaConfirmModal) {
		presencaConfirmModal.addEventListener("click", (event) => {
			const target = event.target;
			if (target instanceof HTMLElement && target.dataset.closePresencaConfirm === "true") {
				closePresencaConfirmModal(false);
			}
		});
	}

	if (btnGoPresentes) {
		btnGoPresentes.addEventListener("click", async (event) => {
			const sessionData = await getGuestSession();
			if (!sessionData.can_access_presentes) {
				event.preventDefault();
				presencaStatus.textContent = "Confirme sua presenca para liberar a lista de presentes.";
			}
		});
	}

	if (btnRefreshGrupos) {
		btnRefreshGrupos.addEventListener("click", loadGroups);
	}

	try {
		const sessionData = await getGuestSession();
		if (!sessionData.authenticated) {
			window.location.href = "/";
			return;
		}
	} catch (_error) {
		window.location.href = "/";
		return;
	}

	await loadGroups();
}

async function initPage() {
	await loadAppVersion();
	await initLoginPage();
	await initPresencaPage();
}

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && presencaConfirmModal && !presencaConfirmModal.hidden) {
		closePresencaConfirmModal(false);
	}
});

initPage();
