const listaEl = document.getElementById("listaPresentes");
const statusEl = document.getElementById("statusGeral");
const template = document.getElementById("presenteTemplate");
const btnAtualizar = document.getElementById("btnAtualizar");
const btnPixDonation = document.getElementById("btnPixDonation");
const filtroBusca = document.getElementById("filtroBusca");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroOrdem = document.getElementById("filtroOrdem");
const pixModal = document.getElementById("pixModal");
const pixModalClose = document.getElementById("pixModalClose");
const pixModalSubtitle = document.getElementById("pixModalSubtitle");
const pixForm = document.getElementById("pixForm");
const pixNomeInput = document.getElementById("pixNome");
const pixValorInput = document.getElementById("pixValor");
const pixStatus = document.getElementById("pixStatus");
const pixResult = document.getElementById("pixResult");
const pixQrCanvas = document.getElementById("pixQrCanvas");
const pixResumo = document.getElementById("pixResumo");
const pixPayload = document.getElementById("pixPayload");
const pixCopyBtn = document.getElementById("pixCopyBtn");
const btnOpenOnboarding = document.getElementById("btnOpenOnboarding");
const onboardingModal = document.getElementById("onboardingModal");
const onboardingClose = document.getElementById("onboardingClose");
const onboardingCaption = document.getElementById("onboardingCaption");
const onboardingTrack = document.getElementById("onboardingTrack");
const onboardingDots = document.getElementById("onboardingDots");
const onboardingPrev = document.getElementById("onboardingPrev");
const onboardingNext = document.getElementById("onboardingNext");
const onboardingDontShow = document.getElementById("onboardingDontShow");
const onboardingProgressBar = document.querySelector(".onboarding-progress-bar");
const appVersionEl = document.getElementById("appVersion");

const statTotal = document.getElementById("statTotal");
const statDisponivel = document.getElementById("statDisponivel");
const statReservado = document.getElementById("statReservado");
const adminMetricTotal = document.getElementById("adminMetricTotal");
const adminMetricReservados = document.getElementById("adminMetricReservados");
const adminMetricDisponiveis = document.getElementById("adminMetricDisponiveis");
const adminMetricPercentual = document.getElementById("adminMetricPercentual");
const adminMetricValorTotal = document.getElementById("adminMetricValorTotal");
const adminMetricValorReservado = document.getElementById("adminMetricValorReservado");
const adminMetricAdminsAtivos = document.getElementById("adminMetricAdminsAtivos");
const adminMetricPixTotal = document.getElementById("adminMetricPixTotal");
const adminMetricPixValorTotal = document.getElementById("adminMetricPixValorTotal");
const adminMetricNovosPendentes = document.getElementById("adminMetricNovosPendentes");
const adminMetricNovosConvidadosPendentes = document.getElementById("adminMetricNovosConvidadosPendentes");
const adminMetricConvidadosTotal = document.getElementById("adminMetricConvidadosTotal");
const adminMetricConvidadosConfirmados = document.getElementById("adminMetricConvidadosConfirmados");
const adminMetricConvidadosNaoVai = document.getElementById("adminMetricConvidadosNaoVai");
const adminMetricConvidadosPendentes = document.getElementById("adminMetricConvidadosPendentes");
const adminRecentList = document.getElementById("adminRecentList");
const adminPixRecentList = document.getElementById("adminPixRecentList");
const adminUnreserveRecentList = document.getElementById("adminUnreserveRecentList");
const adminPresenceHint = document.getElementById("adminPresenceHint");
const adminNewProductsHint = document.getElementById("adminNewProductsHint");

const adminForm = document.getElementById("adminForm");
const adminTokenInput = document.getElementById("adminToken");
const adminStatus = document.getElementById("adminStatus");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminAuthPanel = document.getElementById("adminAuthPanel");
const adminManagerPanel = document.getElementById("adminManagerPanel");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");
const adminSessionEmail = document.getElementById("adminSessionEmail");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminExportBtn = document.getElementById("adminExportBtn");
const adminSubmitBtn = document.getElementById("adminSubmitBtn");
const adminCancelEditBtn = document.getElementById("adminCancelEditBtn");
const adminFormTitle = document.getElementById("adminFormTitle");
const adminMetricsOnlyPage = document.getElementById("adminMetricsOnlyPage");

const adminNome = document.getElementById("adminNome");
const adminPreco = document.getElementById("adminPreco");
const adminCategoria = document.getElementById("adminCategoria");
const adminFoto = document.getElementById("adminFoto");
const adminVideo = document.getElementById("adminVideo");
const adminProdutoUrl = document.getElementById("adminProdutoUrl");
const adminDescricao = document.getElementById("adminDescricao");
const adminEspecificacoes = document.getElementById("adminEspecificacoes");
const adminConvidadosPanel = document.getElementById("adminConvidadosPanel");
const adminConvidadoForm = document.getElementById("adminConvidadoForm");
const adminConvidadoNome = document.getElementById("adminConvidadoNome");
const adminConvidadoGrupo = document.getElementById("adminConvidadoGrupo");
const adminConvidadoTipo = document.getElementById("adminConvidadoTipo");
const adminConvidadoPresenca = document.getElementById("adminConvidadoPresenca");
const adminConvidadoSubmitBtn = document.getElementById("adminConvidadoSubmitBtn");
const adminConvidadoCancelEditBtn = document.getElementById("adminConvidadoCancelEditBtn");
const adminConvidadoFormTitle = document.getElementById("adminConvidadoFormTitle");
const adminConvidadoStatus = document.getElementById("adminConvidadoStatus");
const adminConvidadosList = document.getElementById("adminConvidadosList");
const adminConvidadosExportBtn = document.getElementById("adminConvidadosExportBtn");
const adminNewGuestsHint = document.getElementById("adminNewGuestsHint");
const hasGiftListUI = Boolean(listaEl && statusEl && template && filtroBusca && filtroCategoria && filtroOrdem);
const hasAdminMetricsUI = Boolean(adminMetricTotal || adminRecentList || adminPresenceHint || adminPixRecentList || adminUnreserveRecentList);
const hasAdminConvidadosUI = Boolean(adminConvidadosPanel && adminConvidadoForm && adminConvidadosList);
const isAdminPage = Boolean(adminForm || adminMetricsOnlyPage || adminConvidadoForm);
let adminAuthenticated = !isAdminPage;
let editingPresenteId = null;
let editingConvidadoId = null;
let autoRefreshTimerId = null;
const AUTO_REFRESH_INTERVAL_MS = 15000;
const ONBOARDING_STORAGE_KEY = "lista_casamento_hide_onboarding";
const ADMIN_TAB_SESSION_KEY = "lista_casamento_admin_tab_session";
const ONBOARDING_AUTOPLAY_MS = 7000;
let pixReferenciaAtual = "Contribuicao em dinheiro";
let pixNomePresenteAtual = "";
let onboardingStepIndex = 0;
let onboardingTimerId = null;

const BRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

let presentesState = [];
let convidadosState = [];


function setAdminTabSessionFlag() {
	try {
		window.sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, "1");
	} catch (_error) {
		// Ignore storage failures and fall back to server-side session only.
	}
}


function clearAdminTabSessionFlag() {
	try {
		window.sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
	} catch (_error) {
		// Ignore storage failures.
	}
}


function hasAdminTabSessionFlag() {
	try {
		return window.sessionStorage.getItem(ADMIN_TAB_SESSION_KEY) === "1";
	} catch (_error) {
		return false;
	}
}


function formatPixValue(value) {
	return BRL.format(Number(value || 0));
}


function getYouTubeEmbedUrl(rawUrl) {
	const input = String(rawUrl || "").trim();
	if (!input) {
		return "";
	}

	// Normalize copy/paste artifacts like spaces and line breaks around URL/query params.
	const compactInput = input.replace(/\s+/g, "");
	const regexMatch = compactInput.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
	if (regexMatch && regexMatch[1]) {
		const quickVideoId = regexMatch[1];
		const quickParams = new URLSearchParams({
			autoplay: "1",
			mute: "1",
			playsinline: "1",
			loop: "1",
			playlist: quickVideoId,
			rel: "0",
			modestbranding: "1",
		});

		return `https://www.youtube.com/embed/${quickVideoId}?${quickParams.toString()}`;
	}

	let parsed;
	try {
		parsed = new URL(compactInput);
	} catch (_error) {
		return "";
	}

	const host = parsed.hostname
		.replace(/^www\./i, "")
		.replace(/^m\./i, "")
		.toLowerCase();
	const segments = parsed.pathname.split("/").filter(Boolean);
	let videoId = "";

	if (host === "youtu.be") {
		videoId = segments[0] || "";
	} else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
		if (segments[0] === "watch") {
			videoId = parsed.searchParams.get("v") || "";
		} else if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
			videoId = segments[1] || "";
		}
	}

	if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
		return "";
	}

	const params = new URLSearchParams({
		autoplay: "1",
		mute: "1",
		playsinline: "1",
		loop: "1",
		playlist: videoId,
		rel: "0",
		modestbranding: "1",
	});

	return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}


async function carregarVersaoApp() {
	if (!appVersionEl) {
		return;
	}

	try {
		const response = await fetch("/api/version");
		if (!response.ok) {
			throw new Error("Falha ao buscar versão.");
		}

		const result = await response.json();
		const version = String(result.version || "--").trim();
		appVersionEl.textContent = `Versão ${version}`;
	} catch (_error) {
		appVersionEl.textContent = "Versão --";
	}
}


function closePixModal() {
	if (!pixModal) {
		return;
	}

	pixModal.hidden = true;
	if (pixResult) {
		pixResult.hidden = true;
	}
	if (pixStatus) {
		pixStatus.textContent = "";
	}
}


function getOnboardingSteps() {
	if (!onboardingTrack) {
		return [];
	}

	return Array.from(onboardingTrack.querySelectorAll(".onboarding-step"));
}


function clearOnboardingAutoplay() {
	if (!onboardingTimerId) {
		return;
	}

	window.clearInterval(onboardingTimerId);
	onboardingTimerId = null;
}


function restartOnboardingProgress() {
	if (!onboardingProgressBar) {
		return;
	}

	onboardingProgressBar.style.animation = "none";
	// Force reflow so CSS animation restarts from 0 on each slide.
	void onboardingProgressBar.offsetWidth;
	onboardingProgressBar.style.animation = `onboardingProgress ${ONBOARDING_AUTOPLAY_MS}ms linear forwards`;
}


function setOnboardingStep(index) {
	const steps = getOnboardingSteps();
	if (!steps.length) {
		return;
	}

	onboardingStepIndex = Math.max(0, Math.min(index, steps.length - 1));

	steps.forEach((step, currentIndex) => {
		step.classList.toggle("is-active", currentIndex === onboardingStepIndex);
	});

	restartOnboardingProgress();

	if (onboardingDots) {
		const dots = Array.from(onboardingDots.querySelectorAll("span"));
		dots.forEach((dot, currentIndex) => {
			dot.classList.toggle("is-active", currentIndex === onboardingStepIndex);
		});
	}

	if (onboardingCaption) {
		onboardingCaption.textContent = `Passo ${onboardingStepIndex + 1} de ${steps.length}`;
	}

	if (onboardingPrev) {
		onboardingPrev.disabled = onboardingStepIndex === 0;
	}

	if (onboardingNext) {
		onboardingNext.textContent = onboardingStepIndex >= steps.length - 1 ? "Finalizar" : "Próximo";
	}
}


function saveOnboardingPreference() {
	if (!onboardingDontShow) {
		return;
	}

	if (onboardingDontShow.checked) {
		window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
		return;
	}

	window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}


function closeOnboarding() {
	if (!onboardingModal) {
		return;
	}

	saveOnboardingPreference();
	clearOnboardingAutoplay();
	onboardingModal.hidden = true;

	if (onboardingProgressBar) {
		onboardingProgressBar.style.animation = "none";
	}
}


function startOnboardingAutoplay() {
	const steps = getOnboardingSteps();
	if (!steps.length || steps.length === 1) {
		return;
	}

	clearOnboardingAutoplay();
	onboardingTimerId = window.setInterval(() => {
		const isLastStep = onboardingStepIndex >= steps.length - 1;
		setOnboardingStep(isLastStep ? 0 : onboardingStepIndex + 1);
	}, ONBOARDING_AUTOPLAY_MS);
}


function openOnboarding(options = {}) {
	if (!onboardingModal) {
		return;
	}

	const { forceStart = false } = options;
	const shouldHide = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";

	if (!forceStart && shouldHide) {
		return;
	}

	if (onboardingDontShow) {
		onboardingDontShow.checked = shouldHide;
	}

	onboardingModal.hidden = false;
	setOnboardingStep(0);
	startOnboardingAutoplay();

	if (onboardingNext) {
		onboardingNext.focus();
	}
}


function openPixModal(referenceName = "") {
	if (!pixModal || !pixForm || !pixValorInput || !pixNomeInput) {
		return;
	}

	pixNomePresenteAtual = String(referenceName || "").trim();
	pixReferenciaAtual = pixNomePresenteAtual
		? `Contribuição para: ${pixNomePresenteAtual}`
		: "Contribuicao em dinheiro";

	if (pixModalSubtitle) {
		pixModalSubtitle.textContent = pixNomePresenteAtual
			? `Você está contribuindo para "${pixNomePresenteAtual}".`
			: "Informe seu nome e valor para gerar o QR Code.";
	}

	if (pixStatus) {
		pixStatus.textContent = "";
	}
	if (pixResult) {
		pixResult.hidden = true;
	}
	if (pixPayload) {
		pixPayload.value = "";
	}

	pixModal.hidden = false;
	pixNomeInput.focus();
}


async function renderPixQrCode(payload) {
	if (!pixQrCanvas || !payload) {
		return;
	}

	const qrLib = window.QRCode;
	if (!qrLib || typeof qrLib.toCanvas !== "function") {
		throw new Error("Biblioteca de QR Code indisponível no navegador.");
	}

	await qrLib.toCanvas(pixQrCanvas, payload, {
		width: 280,
		margin: 1,
		color: {
			dark: "#1b2a34",
			light: "#ffffff",
		},
	});
}


async function gerarPix(event) {
	event.preventDefault();

	if (!pixNomeInput || !pixValorInput || !pixStatus) {
		return;
	}

	const nome = pixNomeInput.value.trim();
	const valor = Number(pixValorInput.value);

	if (nome.length < 3) {
		pixStatus.textContent = "Informe seu nome com pelo menos 3 caracteres.";
		return;
	}

	if (!Number.isFinite(valor) || valor <= 0) {
		pixStatus.textContent = "Informe um valor maior que zero.";
		return;
	}

	pixStatus.textContent = "Gerando PIX...";

	try {
		const response = await fetch("/api/pix/gerar", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				nome,
				valor,
				referencia: pixReferenciaAtual,
			}),
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.erro || "Não foi possível gerar o PIX agora.");
		}

		await renderPixQrCode(result.pix_payload);

		if (pixPayload) {
			pixPayload.value = result.pix_payload || "";
		}
		if (pixResumo) {
			pixResumo.textContent = `${nome}, use o QR Code para pagar ${formatPixValue(result.valor)}.`;
		}
		if (pixResult) {
			pixResult.hidden = false;
		}

		if (result.email_status && result.email_status !== "notificacao_enviada") {
			pixStatus.textContent = `PIX gerado. Aviso: ${result.email_status}`;
		} else {
			pixStatus.textContent = "PIX gerado e notificação enviada aos noivos.";
		}
	} catch (error) {
		pixStatus.textContent = error.message;
	}
}


async function copyPixCode() {
	if (!pixPayload || !pixStatus) {
		return;
	}

	const text = pixPayload.value.trim();
	if (!text) {
		pixStatus.textContent = "Gere o código PIX antes de copiar.";
		return;
	}

	try {
		await navigator.clipboard.writeText(text);
		pixStatus.textContent = "Código PIX copiado para a área de transferência.";
	} catch (_error) {
		pixPayload.select();
		document.execCommand("copy");
		pixStatus.textContent = "Código PIX copiado.";
	}
}


function hasPresentesChanged(nextPresentes) {
	if (!Array.isArray(nextPresentes)) {
		return true;
	}

	if (nextPresentes.length !== presentesState.length) {
		return true;
	}

	for (let index = 0; index < nextPresentes.length; index += 1) {
		const current = presentesState[index];
		const next = nextPresentes[index];
		if (JSON.stringify(current) !== JSON.stringify(next)) {
			return true;
		}
	}

	return false;
}


function formatReservationTime(isoDate) {
	if (!isoDate) {
		return "data não informada";
	}

	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) {
		return "data inválida";
	}

	return date.toLocaleString("pt-BR");
}


function ensureAdminCategoryOption(category) {
	if (!adminCategoria) {
		return;
	}

	const value = String(category || "").trim();
	if (!value) {
		return;
	}

	const hasOption = Array.from(adminCategoria.options).some((option) => option.value === value);
	if (hasOption) {
		return;
	}

	const option = document.createElement("option");
	option.value = value;
	option.textContent = value;
	adminCategoria.appendChild(option);
}


function getAdminHeaders() {
	if (!isAdminPage) {
		return {};
	}
	if (!adminTokenInput) {
		return {};
	}

	const token = adminTokenInput.value.trim();
	if (!token) {
		return {};
	}

	return {
		"X-Admin-Token": token,
	};
}


function setAdminMode(authenticated, email = "") {
	adminAuthenticated = authenticated;

	if (authenticated) {
		setAdminTabSessionFlag();
	} else {
		clearAdminTabSessionFlag();
	}

	if (!isAdminPage) {
		return;
	}

	if (adminAuthPanel) {
		adminAuthPanel.hidden = authenticated;
	}
	if (adminManagerPanel) {
		adminManagerPanel.hidden = !authenticated;
	}
	if (adminSessionEmail) {
		adminSessionEmail.textContent = email || "-";
	}
	if (hasAdminConvidadosUI && adminConvidadosPanel) {
		adminConvidadosPanel.hidden = !authenticated;
	}

	if (!authenticated) {
		setEditingMode(null);
		setConvidadoEditingMode(null);
		renderAdminConvidados([]);
		renderAdminMetrics(null);
	}
}


function getConvidadoStatusLabel(status) {
	if (status === "confirmado") {
		return "Confirmado";
	}
	if (status === "nao_vai") {
		return "Não vai";
	}
	return "Pendente";
}


function setConvidadoEditingMode(convidado) {
	if (!hasAdminConvidadosUI || !adminConvidadoForm) {
		return;
	}

	if (!convidado) {
		editingConvidadoId = null;
		adminConvidadoForm.reset();
		if (adminConvidadoTipo) {
			adminConvidadoTipo.value = "convidado";
		}
		if (adminConvidadoPresenca) {
			adminConvidadoPresenca.value = "pendente";
		}
		if (adminConvidadoFormTitle) {
			adminConvidadoFormTitle.textContent = "Lista de Convidados";
		}
		if (adminConvidadoSubmitBtn) {
			adminConvidadoSubmitBtn.textContent = "Adicionar convidado";
		}
		if (adminConvidadoCancelEditBtn) {
			adminConvidadoCancelEditBtn.hidden = true;
		}
		return;
	}

	editingConvidadoId = Number(convidado.id);
	adminConvidadoNome.value = convidado.nome || "";
	adminConvidadoGrupo.value = convidado.grupo || "Sem grupo";
	adminConvidadoTipo.value = convidado.tipo || "convidado";
	adminConvidadoPresenca.value = convidado.status_presenca || "pendente";

	if (adminConvidadoFormTitle) {
		adminConvidadoFormTitle.textContent = `Editando convidado: ${convidado.nome || "Convidado"}`;
	}
	if (adminConvidadoSubmitBtn) {
		adminConvidadoSubmitBtn.textContent = "Salvar convidado";
	}
	if (adminConvidadoCancelEditBtn) {
		adminConvidadoCancelEditBtn.hidden = false;
	}

	if (adminConvidadoStatus) {
		adminConvidadoStatus.textContent = "Modo edição de convidado ativo.";
	}
}


function renderAdminConvidados(convidados) {
	if (!hasAdminConvidadosUI || !adminConvidadosList) {
		return;
	}

	adminConvidadosList.innerHTML = "";

	if (!Array.isArray(convidados) || !convidados.length) {
		adminConvidadosList.innerHTML = "<p>Nenhum convidado cadastrado.</p>";
		return;
	}

	convidados.forEach((convidado) => {
		const card = document.createElement("article");
		card.className = "convidado-admin-card";

		const main = document.createElement("div");
		main.className = "convidado-admin-main";

		const title = document.createElement("h4");
		title.textContent = convidado.nome || "Convidado";
		main.appendChild(title);

		const info = document.createElement("p");
		info.textContent = `Grupo: ${convidado.grupo || "Sem grupo"} | Tipo: ${convidado.tipo || "convidado"} | Presença: ${getConvidadoStatusLabel(convidado.status_presenca)}`;
		main.appendChild(info);

		if (convidado.presenca_confirmada_em) {
			const time = document.createElement("p");
			time.textContent = `Atualizado em ${formatReservationTime(convidado.presenca_confirmada_em)}`;
			main.appendChild(time);
		}

		card.appendChild(main);

		const actions = document.createElement("div");
		actions.className = "convidado-admin-actions";

		const btnEditar = document.createElement("button");
		btnEditar.type = "button";
		btnEditar.textContent = "Editar";
		btnEditar.addEventListener("click", () => {
			setConvidadoEditingMode(convidado);
			window.scrollTo({ top: 0, behavior: "smooth" });
		});
		actions.appendChild(btnEditar);

		const btnCorrigir = document.createElement("button");
		btnCorrigir.type = "button";
		btnCorrigir.className = "btn-secondary";
		btnCorrigir.textContent = "Corrigir para pendente";
		btnCorrigir.addEventListener("click", async () => {
			await salvarConvidadoAdmin(convidado, "pendente");
		});
		actions.appendChild(btnCorrigir);

		const btnRemoverConvidado = document.createElement("button");
		btnRemoverConvidado.type = "button";
		btnRemoverConvidado.className = "btn-remover";
		btnRemoverConvidado.textContent = "Remover";
		btnRemoverConvidado.addEventListener("click", async () => {
			await removerConvidadoAdmin(convidado.id);
		});
		actions.appendChild(btnRemoverConvidado);

		card.appendChild(actions);
		adminConvidadosList.appendChild(card);
	});
}


async function carregarConvidadosAdmin() {
	if (!hasAdminConvidadosUI || !adminAuthenticated) {
		return;
	}

	try {
		const response = await fetch(`/api/admin/convidados?t=${Date.now()}`, {
			method: "GET",
			cache: "no-store",
			credentials: "same-origin",
			headers: {
				...getAdminHeaders(),
			},
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.erro || "Falha ao carregar convidados.");
		}

		convidadosState = Array.isArray(result) ? result : [];
		renderAdminConvidados(convidadosState);
		await carregarResumoConvidadosAdmin();
	} catch (error) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = error.message;
		}
	}
}


async function carregarResumoConvidadosAdmin() {
	if (!adminAuthenticated || !adminNewGuestsHint) {
		return;
	}

	try {
		const response = await fetch(`/api/admin/convidados/resumo?t=${Date.now()}`, {
			method: "GET",
			cache: "no-store",
			credentials: "same-origin",
			headers: {
				...getAdminHeaders(),
			},
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.erro || "Falha ao carregar resumo de convidados.");
		}

		const pendentes = Number(result.novos_convidados_pendentes_total || 0);
		if (pendentes > 0) {
			adminNewGuestsHint.textContent = `${pendentes} novo(s) convidado(s) adicionado(s) desde o último backup JSON.`;
		} else if (result.novos_convidados_ack_em) {
			adminNewGuestsHint.textContent = `Sem pendências. Última conferência: ${formatReservationTime(result.novos_convidados_ack_em)}.`;
		} else {
			adminNewGuestsHint.textContent = "Nenhum novo convidado pendente de backup.";
		}
	} catch (error) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = error.message;
		}
	}
}


async function salvarConvidadoAdmin(convidadoBase, forceStatus = "") {
	if (!adminAuthenticated) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = "Faça login para alterar convidados.";
		}
		return;
	}

	const isFormMode = !convidadoBase;
	const payload = isFormMode
		? {
			nome: adminConvidadoNome.value.trim(),
			grupo: adminConvidadoGrupo.value.trim() || "Sem grupo",
			tipo: adminConvidadoTipo.value,
			status_presenca: forceStatus || adminConvidadoPresenca.value,
		}
		: {
			nome: convidadoBase.nome,
			grupo: convidadoBase.grupo || "Sem grupo",
			tipo: convidadoBase.tipo || "convidado",
			status_presenca: forceStatus || convidadoBase.status_presenca || "pendente",
		};

	if (payload.nome.length < 3) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = "Nome do convidado precisa ter ao menos 3 caracteres.";
		}
		return;
	}

	const isEditing = Number.isInteger(editingConvidadoId) && isFormMode;
	const method = isEditing || !isFormMode ? "PUT" : "POST";
	const endpoint = !isFormMode
		? `/api/admin/convidados/${convidadoBase.id}`
		: isEditing
			? `/api/admin/convidados/${editingConvidadoId}`
			: "/api/admin/convidados";

	if (adminConvidadoStatus) {
		adminConvidadoStatus.textContent = "Salvando convidado...";
	}

	try {
		const response = await fetch(endpoint, {
			method,
			credentials: "same-origin",
			headers: {
				"Content-Type": "application/json",
				...getAdminHeaders(),
			},
			body: JSON.stringify(payload),
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.erro || "Falha ao salvar convidado.");
		}

		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = result.mensagem || "Convidado salvo com sucesso.";
		}

		if (isFormMode) {
			setConvidadoEditingMode(null);
		}

		await carregarConvidadosAdmin();
	} catch (error) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = error.message;
		}
	}
}


async function removerConvidadoAdmin(convidadoId) {
	if (!adminAuthenticated) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = "Faça login para remover convidados.";
		}
		return;
	}

	if (!window.confirm("Deseja remover este convidado da lista?")) {
		return;
	}

	try {
		const response = await fetch(`/api/admin/convidados/${convidadoId}`, {
			method: "DELETE",
			credentials: "same-origin",
			headers: {
				...getAdminHeaders(),
			},
		});

		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.erro || "Falha ao remover convidado.");
		}

		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = result.mensagem || "Convidado removido com sucesso.";
		}

		if (Number.isInteger(editingConvidadoId) && editingConvidadoId === convidadoId) {
			setConvidadoEditingMode(null);
		}

		await carregarConvidadosAdmin();
	} catch (error) {
		if (adminConvidadoStatus) {
			adminConvidadoStatus.textContent = error.message;
		}
	}
}


function renderAdminMetrics(metrics) {
	if (!hasAdminMetricsUI) {
		return;
	}

	if (!metrics) {
		adminMetricTotal.textContent = "0";
		adminMetricReservados.textContent = "0";
		adminMetricDisponiveis.textContent = "0";
		adminMetricPercentual.textContent = "0%";
		adminMetricValorTotal.textContent = BRL.format(0);
		adminMetricValorReservado.textContent = BRL.format(0);
		if (adminMetricAdminsAtivos) {
			adminMetricAdminsAtivos.textContent = "0";
		}
		if (adminMetricPixTotal) {
			adminMetricPixTotal.textContent = "0";
		}
		if (adminMetricPixValorTotal) {
			adminMetricPixValorTotal.textContent = BRL.format(0);
		}
		if (adminMetricNovosPendentes) {
			adminMetricNovosPendentes.textContent = "0";
		}
		if (adminMetricNovosConvidadosPendentes) {
			adminMetricNovosConvidadosPendentes.textContent = "0";
		}
		if (adminMetricConvidadosTotal) {
			adminMetricConvidadosTotal.textContent = "0";
		}
		if (adminMetricConvidadosConfirmados) {
			adminMetricConvidadosConfirmados.textContent = "0";
		}
		if (adminMetricConvidadosNaoVai) {
			adminMetricConvidadosNaoVai.textContent = "0";
		}
		if (adminMetricConvidadosPendentes) {
			adminMetricConvidadosPendentes.textContent = "0";
		}
		if (adminNewProductsHint) {
			adminNewProductsHint.textContent = "Nenhum novo produto pendente de conferência.";
		}
		if (adminNewGuestsHint) {
			adminNewGuestsHint.textContent = "Nenhum novo convidado pendente de backup.";
		}
		if (adminPresenceHint) {
			adminPresenceHint.textContent = "Nenhum admin online no momento.";
		}
		if (adminRecentList) {
			adminRecentList.innerHTML = "<li>Nenhuma reserva recente.</li>";
		}
		if (adminPixRecentList) {
			adminPixRecentList.innerHTML = "<li>Nenhuma contribuição PIX registrada.</li>";
		}
		if (adminUnreserveRecentList) {
			adminUnreserveRecentList.innerHTML = "<li>Nenhuma desmarcação registrada.</li>";
		}
		return;
	}

	adminMetricTotal.textContent = String(metrics.total || 0);
	adminMetricReservados.textContent = String(metrics.reservados || 0);
	adminMetricDisponiveis.textContent = String(metrics.disponiveis || 0);
	adminMetricPercentual.textContent = `${Number(metrics.percentual_reservado || 0).toFixed(1)}%`;
	adminMetricValorTotal.textContent = BRL.format(Number(metrics.valor_total || 0));
	adminMetricValorReservado.textContent = BRL.format(Number(metrics.valor_reservado || 0));
	if (adminMetricAdminsAtivos) {
		adminMetricAdminsAtivos.textContent = String(metrics.admins_ativos_total || 0);
	}
	if (adminMetricPixTotal) {
		adminMetricPixTotal.textContent = String(metrics.pix_contribuicoes_total || 0);
	}
	if (adminMetricPixValorTotal) {
		adminMetricPixValorTotal.textContent = BRL.format(Number(metrics.pix_contribuicoes_valor_total || 0));
	}
	if (adminMetricNovosPendentes) {
		adminMetricNovosPendentes.textContent = String(metrics.novos_produtos_pendentes_total || 0);
	}
	if (adminMetricNovosConvidadosPendentes) {
		adminMetricNovosConvidadosPendentes.textContent = String(metrics.novos_convidados_pendentes_total || 0);
	}
	if (adminMetricConvidadosTotal) {
		adminMetricConvidadosTotal.textContent = String(metrics.convidados_total || 0);
	}
	if (adminMetricConvidadosConfirmados) {
		adminMetricConvidadosConfirmados.textContent = String(metrics.convidados_confirmados_total || 0);
	}
	if (adminMetricConvidadosNaoVai) {
		adminMetricConvidadosNaoVai.textContent = String(metrics.convidados_nao_vai_total || 0);
	}
	if (adminMetricConvidadosPendentes) {
		adminMetricConvidadosPendentes.textContent = String(metrics.convidados_pendentes_total || 0);
	}

	if (adminNewProductsHint) {
		const novosPendentes = Number(metrics.novos_produtos_pendentes_total || 0);
		if (novosPendentes > 0) {
			adminNewProductsHint.textContent = `${novosPendentes} novo(s) produto(s) adicionado(s) desde o último backup JSON.`;
		} else if (metrics.novos_produtos_ack_em) {
			adminNewProductsHint.textContent = `Sem pendências. Última conferência: ${formatReservationTime(metrics.novos_produtos_ack_em)}.`;
		} else {
			adminNewProductsHint.textContent = "Nenhum novo produto pendente de conferência.";
		}
	}

	if (adminNewGuestsHint) {
		const novosConvidadosPendentes = Number(metrics.novos_convidados_pendentes_total || 0);
		if (novosConvidadosPendentes > 0) {
			adminNewGuestsHint.textContent = `${novosConvidadosPendentes} novo(s) convidado(s) adicionado(s) desde o último backup JSON de convidados.`;
		} else if (metrics.novos_convidados_ack_em) {
			adminNewGuestsHint.textContent = `Sem pendências de convidados. Última conferência: ${formatReservationTime(metrics.novos_convidados_ack_em)}.`;
		} else {
			adminNewGuestsHint.textContent = "Nenhum novo convidado pendente de backup.";
		}
	}

	if (adminPresenceHint) {
		const ttlSegundos = Number(metrics.admins_ativos_ttl_segundos || 0);
		const ttlMinutos = ttlSegundos > 0 ? Math.ceil(ttlSegundos / 60) : 0;
		const adminsAtivos = Array.isArray(metrics.admins_ativos) ? metrics.admins_ativos : [];
		const uniqueAdmins = Array.from(
			new Map(
				adminsAtivos
					.filter((item) => item && item.email)
					.map((item) => [String(item.email).trim().toLowerCase(), item])
			).values()
		);

		if (!uniqueAdmins.length) {
			adminPresenceHint.textContent = "Nenhum admin online no momento.";
		} else {
			const emails = uniqueAdmins
				.map((item) => item.email)
				.filter(Boolean)
				.join(", ");
			adminPresenceHint.textContent = `Online: ${emails}${ttlMinutos ? ` (atividade nos últimos ${ttlMinutos} min)` : ""}`;
		}
	}

	if (!adminRecentList) {
		return;
	}

	const ultimas = Array.isArray(metrics.ultimas_reservas) ? metrics.ultimas_reservas : [];
	adminRecentList.innerHTML = "";

	if (!ultimas.length) {
		adminRecentList.innerHTML = "<li>Nenhuma reserva recente.</li>";
	} else {
		ultimas.forEach((reserva) => {
			const li = document.createElement("li");
			li.textContent = `${reserva.nome} - ${BRL.format(Number(reserva.preco || 0))} - ${reserva.reservado_por_nome} (${formatReservationTime(reserva.reservado_em)})`;
			adminRecentList.appendChild(li);
		});
	}

	if (adminPixRecentList) {
		const ultimasPix = Array.isArray(metrics.ultimas_contribuicoes_pix) ? metrics.ultimas_contribuicoes_pix : [];
		adminPixRecentList.innerHTML = "";

		if (!ultimasPix.length) {
			adminPixRecentList.innerHTML = "<li>Nenhuma contribuição PIX registrada.</li>";
		} else {
			ultimasPix.forEach((contribuicao) => {
				const li = document.createElement("li");
				li.textContent = `${contribuicao.nome} - ${BRL.format(Number(contribuicao.valor || 0))} - ${contribuicao.referencia} (${formatReservationTime(contribuicao.criado_em)})`;
				adminPixRecentList.appendChild(li);
			});
		}
	}

	if (adminUnreserveRecentList) {
		const ultimasDesmarcacoes = Array.isArray(metrics.ultimas_desmarcacoes_reserva) ? metrics.ultimas_desmarcacoes_reserva : [];
		adminUnreserveRecentList.innerHTML = "";

		if (!ultimasDesmarcacoes.length) {
			adminUnreserveRecentList.innerHTML = "<li>Nenhuma desmarcação registrada.</li>";
		} else {
			ultimasDesmarcacoes.forEach((item) => {
				const li = document.createElement("li");
				li.textContent = `${item.presente_nome} - reservado por ${item.reservado_por_nome} - desmarcado por ${item.desmarcado_por} (${formatReservationTime(item.desmarcado_em)})`;
				adminUnreserveRecentList.appendChild(li);
			});
		}
	}
}


async function carregarMetricasAdmin() {
	if (!isAdminPage || !adminAuthenticated || !hasAdminMetricsUI) {
		renderAdminMetrics(null);
		return;
	}

	try {
		const response = await fetch(`/api/admin/metrics?t=${Date.now()}`, {
			method: "GET",
			cache: "no-store",
			credentials: "same-origin",
			headers: {
				...getAdminHeaders(),
			},
		});

		if (!response.ok) {
			let message = "Falha ao carregar métricas do painel.";
			try {
				const body = await response.json();
				message = body.erro || message;
			} catch (_error) {
				// Keep fallback message when response body is not JSON.
			}
			throw new Error(message);
		}

		const metrics = await response.json();
		renderAdminMetrics(metrics);
	} catch (error) {
		if (adminStatus) {
			adminStatus.textContent = error.message;
		}
	}
}


function startAutoRefresh() {
	if (autoRefreshTimerId) {
		clearInterval(autoRefreshTimerId);
	}

	autoRefreshTimerId = window.setInterval(async () => {
		if (document.visibilityState !== "visible") {
			return;
		}

		if (hasGiftListUI) {
			if (isAdminPage && !adminAuthenticated) {
				return;
			}

			await carregarPresentes({ silent: true });
			return;
		}

		if (isAdminPage && adminAuthenticated) {
			if (hasAdminConvidadosUI) {
				await carregarConvidadosAdmin();
			}
			await carregarMetricasAdmin();
		}
	}, AUTO_REFRESH_INTERVAL_MS);
}


function setEditingMode(presente) {
	if (!isAdminPage || !adminForm) {
		return;
	}

	if (!presente) {
		editingPresenteId = null;
		adminForm.reset();
		if (adminFormTitle) {
			adminFormTitle.textContent = "Cadastro de Presentes";
		}
		if (adminSubmitBtn) {
			adminSubmitBtn.textContent = "Adicionar Presente";
		}
		if (adminCancelEditBtn) {
			adminCancelEditBtn.hidden = true;
		}
		return;
	}

	editingPresenteId = Number(presente.id);
	adminNome.value = presente.nome || "";
	adminPreco.value = Number(presente.preco || 0);
	ensureAdminCategoryOption(presente.categoria || "Geral");
	adminCategoria.value = presente.categoria || "Geral";
	adminFoto.value = presente.foto_url || "";
	if (adminVideo) {
		adminVideo.value = presente.video_url || "";
	}
	adminProdutoUrl.value = presente.produto_url || "";
	adminDescricao.value = presente.descricao || "";
	adminEspecificacoes.value = (presente.especificacoes || []).join("\n");

	if (adminFormTitle) {
		adminFormTitle.textContent = `Editando: ${presente.nome || "Presente"}`;
	}
	if (adminSubmitBtn) {
		adminSubmitBtn.textContent = "Salvar Alterações";
	}
	if (adminCancelEditBtn) {
		adminCancelEditBtn.hidden = false;
	}
	adminStatus.textContent = "Modo edição ativo. Atualize os campos e clique em salvar.";
}


async function syncAdminSession() {
	if (!isAdminPage) {
		return;
	}

	if (!hasAdminTabSessionFlag()) {
		try {
			await fetch("/api/admin/logout", {
				method: "POST",
				credentials: "same-origin",
			});
		} catch (_error) {
			// Ignore logout failure here; UI will still require fresh login.
		}

		setAdminMode(false);
		window.location.href = "/";
		return;
	}

	try {
		const response = await fetch("/api/admin/session", {
			credentials: "same-origin",
		});

		if (!response.ok) {
			throw new Error("Falha ao validar sessão.");
		}

		const result = await response.json();
		setAdminMode(Boolean(result.authenticated), result.email || "");
	} catch (error) {
		setAdminMode(false);
		if (adminStatus) {
			adminStatus.textContent = "Não foi possível validar sua sessão de administrador.";
		}
		window.location.href = "/";
	}
}


function updateStats(presentes) {
	if (!hasGiftListUI) {
		return;
	}

	if (!statTotal || !statDisponivel || !statReservado) {
		return;
	}

	const total = presentes.length;
	const reservado = presentes.filter((item) => item.reservado).length;
	const disponivel = total - reservado;

	statTotal.textContent = String(total);
	statDisponivel.textContent = String(disponivel);
	statReservado.textContent = String(reservado);
}


function updateCategorias(presentes) {
	if (!hasGiftListUI) {
		return;
	}

	const categories = [...new Set(presentes.map((item) => item.categoria || "Geral"))].sort();
	const current = filtroCategoria.value;

	filtroCategoria.innerHTML = '<option value="">Todas as categorias</option>';

	categories.forEach((cat) => {
		const option = document.createElement("option");
		option.value = cat;
		option.textContent = cat;
		filtroCategoria.appendChild(option);
	});

	if (categories.includes(current)) {
		filtroCategoria.value = current;
	}
}


function getFilteredPresentes() {
	if (!hasGiftListUI) {
		return [];
	}

	const search = filtroBusca.value.trim().toLowerCase();
	const category = filtroCategoria.value;
	const order = filtroOrdem.value;

	let filtered = presentesState.filter((item) => {
		const byCategory = !category || (item.categoria || "Geral") === category;
		const inText =
			!search ||
			item.nome.toLowerCase().includes(search) ||
			(item.descricao || "").toLowerCase().includes(search);
		return byCategory && inText;
	});

	if (order === "preco_asc") {
		filtered.sort((a, b) => Number(a.preco || 0) - Number(b.preco || 0));
	} else if (order === "preco_desc") {
		filtered.sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0));
	} else if (order === "nome") {
		filtered.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
	} else {
		filtered.sort((a, b) => Number(a.reservado) - Number(b.reservado));
	}

	return filtered;
}


async function reservarPresente(presente, card, statusPresenteEl, inputNome, inputEmail, inputCheck) {
	const nome = inputNome.value.trim();
	const email = inputEmail.value.trim().toLowerCase();

	if (nome.length < 3) {
		alert("Informe um nome válido com pelo menos 3 caracteres.");
		inputCheck.checked = false;
		return;
	}

	if (email && !inputEmail.checkValidity()) {
		alert("Se informar e-mail, ele precisa ser válido.");
		inputCheck.checked = false;
		return;
	}

	inputCheck.disabled = true;
	statusPresenteEl.textContent = "Reservando...";

	try {
		const response = await fetch(`/api/presentes/${presente.id}/reservar`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ nome, email }),
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.erro || "Nao foi possivel reservar este presente.");
		}

		card.classList.add("reservado");
		if (result.email_status === "notificacao_enviada") {
			statusPresenteEl.textContent = `Reservado por ${nome} (notificação enviada)`;
		} else {
			statusPresenteEl.textContent = `Reservado por ${nome} (notificação pendente)`;
		}
		inputNome.disabled = true;
		inputEmail.disabled = true;

		if (result.email_status && result.email_status !== "notificacao_enviada") {
			alert(`Reserva feita, mas houve falha no e-mail: ${result.email_status}`);
		}

		await carregarPresentes({ silent: true });
	} catch (error) {
		statusPresenteEl.textContent = "Falha ao reservar.";
		alert(error.message);
		inputCheck.checked = false;
		inputCheck.disabled = false;
	}
}


async function removerPresente(presenteId) {
	if (!isAdminPage) {
		return;
	}

	if (!adminAuthenticated) {
		adminStatus.textContent = "Faça login para remover presentes.";
		return;
	}

	const confirmed = window.confirm("Deseja remover este presente da lista?");
	if (!confirmed) {
		return;
	}

	try {
		const response = await fetch(`/api/presentes/${presenteId}`, {
			method: "DELETE",
			credentials: "same-origin",
			headers: {
				...getAdminHeaders(),
			},
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.erro || "Nao foi possivel remover o presente.");
		}

		adminStatus.textContent = "Presente removido com sucesso.";
		await carregarPresentes();
	} catch (error) {
		adminStatus.textContent = error.message;
	}
}


async function desreservarPresente(presenteId) {
	if (!isAdminPage) {
		return;
	}

	if (!adminAuthenticated) {
		adminStatus.textContent = "Faça login para desmarcar reservas.";
		return;
	}

	const confirmed = window.confirm("Deseja desmarcar essa reserva e deixar o presente disponível novamente?");
	if (!confirmed) {
		return;
	}

	try {
		const response = await fetch(`/api/presentes/${presenteId}/desreservar`, {
			method: "POST",
			credentials: "same-origin",
			headers: {
				...getAdminHeaders(),
			},
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.erro || "Nao foi possivel desmarcar a reserva.");
		}

		adminStatus.textContent = "Reserva removida com sucesso.";
		await carregarPresentes();
	} catch (error) {
		adminStatus.textContent = error.message;
	}
}


function renderPresentes() {
	if (!hasGiftListUI) {
		return;
	}

	const presentes = getFilteredPresentes();
	listaEl.innerHTML = "";

	if (!presentes.length) {
		statusEl.textContent = "Nenhum presente encontrado com os filtros atuais.";
		return;
	}

	statusEl.textContent = "";

	presentes.forEach((presente, index) => {
		const node = template.content.cloneNode(true);
		const card = node.querySelector(".card");
		const fotoEl = node.querySelector(".presente-foto");
		const videoEl = node.querySelector(".presente-video");
		const embedEl = node.querySelector(".presente-embed");
		const categoriaEl = node.querySelector(".badge-categoria");
		const nomeEl = node.querySelector(".presente-nome");
		const precoEl = node.querySelector(".presente-preco");
		const descricaoEl = node.querySelector(".presente-descricao");
		const especificacoesEl = node.querySelector(".presente-especificacoes");
		const statusPresenteEl = node.querySelector(".presente-status");
		const inputNome = node.querySelector(".input-nome");
		const inputEmail = node.querySelector(".input-email");
		const inputCheck = node.querySelector(".input-check");
		const form = node.querySelector(".reserve-form");
		const btnRemover = node.querySelector(".btn-remover");
		const btnEditar = node.querySelector(".btn-editar");
		const btnDesreservar = node.querySelector(".btn-desreservar");
		const btnPixPresente = node.querySelector(".btn-pix-presente");

		card.style.animationDelay = `${Math.min(index * 40, 300)}ms`;

		nomeEl.textContent = presente.nome;
		precoEl.textContent = BRL.format(Number(presente.preco || 0));
		descricaoEl.textContent = presente.descricao || "Sem descricao informada.";
		categoriaEl.textContent = presente.categoria || "Geral";
		const fallbackImageUrl = "https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=900&q=80";
		const videoUrl = String(presente.video_url || "").trim();
		const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl);

		const setupProdutoLink = (mediaEl) => {
			if (!mediaEl) {
				return;
			}

			if (presente.produto_url) {
				mediaEl.style.cursor = "pointer";
				mediaEl.title = "Abrir página do produto";
				mediaEl.addEventListener("click", () => {
					window.open(presente.produto_url, "_blank", "noopener,noreferrer");
				});
			} else {
				mediaEl.style.cursor = "default";
				mediaEl.title = "";
			}
		};

		fotoEl.hidden = false;
		fotoEl.src = presente.foto_url || fallbackImageUrl;
		fotoEl.alt = `Foto do presente ${presente.nome}`;
		setupProdutoLink(fotoEl);
		fotoEl.addEventListener("error", () => {
			fotoEl.src = fallbackImageUrl;
		});

		if (embedEl) {
			embedEl.hidden = true;
			embedEl.removeAttribute("src");
			embedEl.setAttribute("title", `Vídeo do presente ${presente.nome}`);
		}

		if (videoEl) {
			if (youtubeEmbedUrl && embedEl) {
				videoEl.pause();
				videoEl.removeAttribute("src");
				videoEl.load();
				videoEl.hidden = true;
				fotoEl.hidden = true;
				embedEl.hidden = false;
				embedEl.src = youtubeEmbedUrl;
			} else if (videoUrl) {
				videoEl.hidden = false;
				fotoEl.hidden = true;
				videoEl.src = videoUrl;
				videoEl.setAttribute("aria-label", `Vídeo do presente ${presente.nome}`);
				setupProdutoLink(videoEl);
				videoEl.addEventListener("error", () => {
					videoEl.hidden = true;
					fotoEl.hidden = false;
					fotoEl.src = presente.foto_url || fallbackImageUrl;
				});

				const autoplayAttempt = videoEl.play();
				if (autoplayAttempt && typeof autoplayAttempt.catch === "function") {
					autoplayAttempt.catch(() => {
						// Ignore autoplay errors from browser policies.
					});
				}
			} else {
				videoEl.pause();
				videoEl.removeAttribute("src");
				videoEl.load();
				videoEl.hidden = true;
				if (embedEl) {
					embedEl.hidden = true;
					embedEl.removeAttribute("src");
				}
			}
		}

		especificacoesEl.innerHTML = "";
		(presente.especificacoes || []).forEach((item) => {
			const li = document.createElement("li");
			li.textContent = item;
			especificacoesEl.appendChild(li);
		});

		if (!(presente.especificacoes || []).length) {
			const li = document.createElement("li");
			li.textContent = "Sem especificacoes adicionais.";
			especificacoesEl.appendChild(li);
		}

		if (presente.reservado) {
			card.classList.add("reservado");
			statusPresenteEl.textContent = `Reservado por ${presente.reservado_por_nome || "outra pessoa"}`;
			inputNome.value = presente.reservado_por_nome || "";
			inputEmail.value = presente.reservado_por_email || "";
			inputCheck.checked = true;
			inputCheck.disabled = true;
			inputNome.disabled = true;
			inputEmail.disabled = true;
		} else {
			statusPresenteEl.textContent = "Disponivel";

			inputCheck.addEventListener("change", async () => {
				if (!inputCheck.checked) {
					return;
				}
				await reservarPresente(presente, card, statusPresenteEl, inputNome, inputEmail, inputCheck);
			});
		}

		form.addEventListener("submit", (event) => {
			event.preventDefault();
		});

		if (btnRemover) {
			if (!isAdminPage) {
				btnRemover.remove();
			} else {
				btnRemover.disabled = !adminAuthenticated;
				btnRemover.addEventListener("click", async () => {
					await removerPresente(presente.id);
				});
			}
		}

		if (btnEditar) {
			if (!isAdminPage) {
				btnEditar.remove();
			} else {
				btnEditar.disabled = !adminAuthenticated;
				btnEditar.addEventListener("click", () => {
					if (!adminAuthenticated) {
						adminStatus.textContent = "Faça login para editar presentes.";
						return;
					}
					setEditingMode(presente);
					window.scrollTo({ top: 0, behavior: "smooth" });
				});
			}
		}

		if (btnDesreservar) {
			if (!isAdminPage) {
				btnDesreservar.remove();
			} else if (!presente.reservado) {
				btnDesreservar.remove();
			} else {
				btnDesreservar.disabled = !adminAuthenticated;
				btnDesreservar.addEventListener("click", async () => {
					await desreservarPresente(presente.id);
				});
			}
		}

		if (btnPixPresente) {
			if (isAdminPage) {
				btnPixPresente.remove();
			} else {
				btnPixPresente.addEventListener("click", () => {
					openPixModal(presente.nome || "");
					if (pixValorInput) {
						pixValorInput.value = Number(presente.preco || 0).toFixed(2);
					}
				});
			}
		}

		listaEl.appendChild(node);
	});
}


async function carregarPresentes(options = {}) {
	if (!hasGiftListUI) {
		if (isAdminPage && adminAuthenticated) {
			await carregarMetricasAdmin();
		}
		return;
	}

	const { silent = false } = options;

	if (!silent) {
		statusEl.textContent = "Carregando presentes...";
	}

	try {
		const response = await fetch("/api/presentes");
		if (!response.ok) {
			throw new Error("Falha ao buscar presentes");
		}

		const nextPresentes = await response.json();
		const changed = hasPresentesChanged(nextPresentes);

		if (silent && !changed) {
			if (isAdminPage && adminAuthenticated) {
				await carregarConvidadosAdmin();
				await carregarMetricasAdmin();
			}
			return;
		}

		presentesState = nextPresentes;

		updateStats(presentesState);
		updateCategorias(presentesState);
		renderPresentes();

		if (isAdminPage && adminAuthenticated) {
			await carregarConvidadosAdmin();
			await carregarMetricasAdmin();
		}
	} catch (error) {
		if (!silent) {
			statusEl.textContent = "Erro ao carregar a lista de presentes.";
		}
		console.error(error);
	}
}


if (isAdminPage) {
	if (adminExportBtn) {
		adminExportBtn.addEventListener("click", async () => {
			if (!adminAuthenticated) {
				adminStatus.textContent = "Faça login para baixar o JSON.";
				return;
			}

			try {
				const response = await fetch(`/api/admin/export?t=${Date.now()}`, {
					method: "GET",
					cache: "no-store",
					credentials: "same-origin",
					headers: {
						...getAdminHeaders(),
					},
				});

				if (!response.ok) {
					let message = "Falha ao exportar JSON.";
					try {
						const body = await response.json();
						message = body.erro || message;
					} catch (_error) {
						// Keep fallback message when response body is not JSON.
					}
					throw new Error(message);
				}

				const blob = await response.blob();
				const contentDisposition = response.headers.get("Content-Disposition") || "";
				const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
				const fileName = match ? match[1] : "presentes-export.json";

				const fileUrl = window.URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = fileUrl;
				link.download = fileName;
				document.body.appendChild(link);
				link.click();
				link.remove();
				window.URL.revokeObjectURL(fileUrl);

				adminStatus.textContent = "Arquivo JSON exportado e status de novos produtos resetado.";
				await carregarMetricasAdmin();
			} catch (error) {
				adminStatus.textContent = error.message;
			}
		});
	}

	if (adminConvidadosExportBtn) {
		adminConvidadosExportBtn.addEventListener("click", async () => {
			if (!adminAuthenticated) {
				if (adminConvidadoStatus) {
					adminConvidadoStatus.textContent = "Faça login para baixar o JSON de convidados.";
				}
				return;
			}

			try {
				const response = await fetch(`/api/admin/convidados/export?t=${Date.now()}`, {
					method: "GET",
					cache: "no-store",
					credentials: "same-origin",
					headers: {
						...getAdminHeaders(),
					},
				});

				if (!response.ok) {
					let message = "Falha ao exportar JSON de convidados.";
					try {
						const body = await response.json();
						message = body.erro || message;
					} catch (_error) {
						// Keep fallback message when response body is not JSON.
					}
					throw new Error(message);
				}

				const blob = await response.blob();
				const contentDisposition = response.headers.get("Content-Disposition") || "";
				const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
				const fileName = match ? match[1] : "convidados-export.json";

				const fileUrl = window.URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = fileUrl;
				link.download = fileName;
				document.body.appendChild(link);
				link.click();
				link.remove();
				window.URL.revokeObjectURL(fileUrl);

				if (adminConvidadoStatus) {
					adminConvidadoStatus.textContent = "Arquivo JSON de convidados exportado e contador resetado.";
				}
				await carregarResumoConvidadosAdmin();
			} catch (error) {
				if (adminConvidadoStatus) {
					adminConvidadoStatus.textContent = error.message;
				}
			}
		});
	}

	if (adminLoginForm) {
		adminLoginForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			adminStatus.textContent = "Entrando...";

			const payload = {
				email: adminEmailInput.value.trim().toLowerCase(),
				password: adminPasswordInput.value,
			};

			try {
				const response = await fetch("/api/admin/login", {
					method: "POST",
					credentials: "same-origin",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.erro || "Falha ao realizar login.");
				}

				setAdminTabSessionFlag();
				setAdminMode(true, result.email || payload.email);
				adminLoginForm.reset();
				adminStatus.textContent = "Login realizado com sucesso.";
				await carregarPresentes();
				await carregarConvidadosAdmin();
			} catch (error) {
				adminStatus.textContent = error.message;
			}
		});
	}

	if (adminLogoutBtn) {
		adminLogoutBtn.addEventListener("click", async () => {
			try {
				const response = await fetch("/api/admin/logout", {
					method: "POST",
					credentials: "same-origin",
				});
				if (!response.ok) {
					throw new Error("Falha ao sair da sessão.");
				}

				setAdminMode(false);
				adminStatus.textContent = "Sessão encerrada.";
				if (hasAdminConvidadosUI) {
					convidadosState = [];
				}
				await carregarPresentes();
			} catch (error) {
				adminStatus.textContent = error.message;
			}
		});
	}

	if (adminConvidadoCancelEditBtn) {
		adminConvidadoCancelEditBtn.addEventListener("click", () => {
			setConvidadoEditingMode(null);
			if (adminConvidadoStatus) {
				adminConvidadoStatus.textContent = "Edição de convidado cancelada.";
			}
		});
	}

	if (adminConvidadoForm) {
		adminConvidadoForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			await salvarConvidadoAdmin(null);
		});
	}

	if (adminCancelEditBtn) {
		adminCancelEditBtn.addEventListener("click", () => {
			setEditingMode(null);
			adminStatus.textContent = "Edição cancelada.";
		});
	}

	if (adminForm) {
		adminForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!adminAuthenticated) {
			adminStatus.textContent = "Faça login para adicionar presentes.";
			return;
		}

		adminStatus.textContent = "Enviando...";

		const payload = {
			nome: adminNome.value.trim(),
			preco: Number(adminPreco.value),
			categoria: adminCategoria.value.trim() || "Geral",
			foto_url: adminFoto.value.trim(),
			video_url: adminVideo ? adminVideo.value.trim() : "",
			produto_url: adminProdutoUrl.value.trim(),
			descricao: adminDescricao.value.trim(),
			especificacoes: adminEspecificacoes.value
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean),
		};

		try {
			const isEditing = Number.isInteger(editingPresenteId);
			const endpoint = isEditing ? `/api/presentes/${editingPresenteId}` : "/api/presentes";
			const method = isEditing ? "PUT" : "POST";

			const response = await fetch(endpoint, {
				method,
				credentials: "same-origin",
				headers: {
					"Content-Type": "application/json",
					...getAdminHeaders(),
				},
				body: JSON.stringify(payload),
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.erro || "Falha ao criar presente.");
			}

			adminStatus.textContent = isEditing ? "Presente atualizado com sucesso." : "Presente adicionado com sucesso.";
			setEditingMode(null);
			await carregarPresentes();
		} catch (error) {
			adminStatus.textContent = error.message;
		}
		});
	}
}


if (filtroBusca) {
	filtroBusca.addEventListener("input", renderPresentes);
}
if (filtroCategoria) {
	filtroCategoria.addEventListener("change", renderPresentes);
}
if (filtroOrdem) {
	filtroOrdem.addEventListener("change", renderPresentes);
}
if (btnAtualizar) {
	btnAtualizar.addEventListener("click", async () => {
		if (hasGiftListUI) {
			await carregarPresentes();
			return;
		}

		await carregarMetricasAdmin();
	});
}
if (btnPixDonation) {
	btnPixDonation.addEventListener("click", () => {
		openPixModal();
		if (pixValorInput) {
			pixValorInput.value = "100.00";
		}
	});
}
if (pixForm) {
	pixForm.addEventListener("submit", gerarPix);
}
if (pixCopyBtn) {
	pixCopyBtn.addEventListener("click", copyPixCode);
}
if (pixModalClose) {
	pixModalClose.addEventListener("click", closePixModal);
}
if (pixModal) {
	pixModal.addEventListener("click", (event) => {
		const target = event.target;
		if (target instanceof HTMLElement && target.dataset.closePixModal === "true") {
			closePixModal();
		}
	});
}
if (btnOpenOnboarding) {
	btnOpenOnboarding.addEventListener("click", () => {
		openOnboarding({ forceStart: true });
	});
}
if (onboardingClose) {
	onboardingClose.addEventListener("click", closeOnboarding);
}
if (onboardingModal) {
	onboardingModal.addEventListener("click", (event) => {
		const target = event.target;
		if (target instanceof HTMLElement && target.dataset.closeOnboarding === "true") {
			closeOnboarding();
		}
	});
}
if (onboardingPrev) {
	onboardingPrev.addEventListener("click", () => {
		setOnboardingStep(onboardingStepIndex - 1);
		startOnboardingAutoplay();
	});
}
if (onboardingNext) {
	onboardingNext.addEventListener("click", () => {
		const steps = getOnboardingSteps();
		if (!steps.length) {
			closeOnboarding();
			return;
		}

		if (onboardingStepIndex >= steps.length - 1) {
			closeOnboarding();
			return;
		}

		setOnboardingStep(onboardingStepIndex + 1);
		startOnboardingAutoplay();
	});
}
if (onboardingDontShow) {
	onboardingDontShow.addEventListener("change", saveOnboardingPreference);
}
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && pixModal && !pixModal.hidden) {
		closePixModal();
		return;
	}

	if (event.key === "Escape" && onboardingModal && !onboardingModal.hidden) {
		closeOnboarding();
	}
});

async function initPage() {
	await carregarVersaoApp();

	if (isAdminPage) {
		await syncAdminSession();
	}

	if (hasGiftListUI) {
		if (isAdminPage && !adminAuthenticated) {
			statusEl.textContent = "Faça login para carregar os presentes.";
		} else {
			await carregarPresentes();
			if (isAdminPage && adminAuthenticated) {
				await carregarConvidadosAdmin();
			}
			if (!isAdminPage) {
				openOnboarding();
			}
		}
	} else if (isAdminPage && adminAuthenticated) {
		if (hasAdminConvidadosUI) {
			await carregarConvidadosAdmin();
		}
		await carregarMetricasAdmin();
	}

	startAutoRefresh();
}

initPage();
