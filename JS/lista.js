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
const adminProdutoUrl = document.getElementById("adminProdutoUrl");
const adminDescricao = document.getElementById("adminDescricao");
const adminEspecificacoes = document.getElementById("adminEspecificacoes");
const hasGiftListUI = Boolean(listaEl && statusEl && template && filtroBusca && filtroCategoria && filtroOrdem);
const hasAdminMetricsUI = Boolean(adminMetricTotal || adminRecentList || adminPresenceHint || adminPixRecentList || adminUnreserveRecentList);
const isAdminPage = Boolean(adminForm || adminMetricsOnlyPage);
let adminAuthenticated = !isAdminPage;
let editingPresenteId = null;
let autoRefreshTimerId = null;
const AUTO_REFRESH_INTERVAL_MS = 15000;
let pixReferenciaAtual = "Contribuicao em dinheiro";
let pixNomePresenteAtual = "";

const BRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

let presentesState = [];


function formatPixValue(value) {
	return BRL.format(Number(value || 0));
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

	if (!authenticated) {
		setEditingMode(null);
		renderAdminMetrics(null);
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
		if (adminNewProductsHint) {
			adminNewProductsHint.textContent = "Nenhum novo produto pendente de conferência.";
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

	if (adminPresenceHint) {
		const ttlSegundos = Number(metrics.admins_ativos_ttl_segundos || 0);
		const ttlMinutos = ttlSegundos > 0 ? Math.ceil(ttlSegundos / 60) : 0;
		const adminsAtivos = Array.isArray(metrics.admins_ativos) ? metrics.admins_ativos : [];

		if (!adminsAtivos.length) {
			adminPresenceHint.textContent = "Nenhum admin online no momento.";
		} else {
			const emails = adminsAtivos
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
		const response = await fetch("/api/admin/metrics", {
			method: "GET",
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
			await carregarPresentes({ silent: true });
			return;
		}

		if (isAdminPage && adminAuthenticated) {
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

		fotoEl.src = presente.foto_url;
		fotoEl.alt = `Foto do presente ${presente.nome}`;
		if (presente.produto_url) {
			fotoEl.style.cursor = "pointer";
			fotoEl.title = "Abrir página do produto";
			fotoEl.addEventListener("click", () => {
				window.open(presente.produto_url, "_blank", "noopener,noreferrer");
			});
		} else {
			fotoEl.style.cursor = "default";
			fotoEl.title = "";
		}
		fotoEl.addEventListener("error", () => {
			fotoEl.src = "https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=900&q=80";
		});

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
				await carregarMetricasAdmin();
			}
			return;
		}

		presentesState = nextPresentes;

		updateStats(presentesState);
		updateCategorias(presentesState);
		renderPresentes();

		if (isAdminPage && adminAuthenticated) {
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
				const response = await fetch("/api/admin/export", {
					method: "GET",
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

				setAdminMode(true, result.email || payload.email);
				adminLoginForm.reset();
				adminStatus.textContent = "Login realizado com sucesso.";
				await carregarPresentes();
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
				await carregarPresentes();
			} catch (error) {
				adminStatus.textContent = error.message;
			}
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
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && pixModal && !pixModal.hidden) {
		closePixModal();
	}
});

async function initPage() {
	if (isAdminPage) {
		await syncAdminSession();
	}

	if (hasGiftListUI) {
		await carregarPresentes();
	} else if (isAdminPage && adminAuthenticated) {
		await carregarMetricasAdmin();
	}

	startAutoRefresh();
}

initPage();
