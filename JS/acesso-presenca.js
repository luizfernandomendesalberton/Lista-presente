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

		if (sessionData.authenticated) {
			window.location.href = "/presenca";
		}
	} catch (_error) {
		// Login page continues available even if session endpoint fails.
	}
}

async function initPresencaPage() {
	if (!isPresencaPage) {
		return;
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

initPage();
