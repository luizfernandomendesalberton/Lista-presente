const listaEl = document.getElementById("listaPresentes");
const statusEl = document.getElementById("statusGeral");
const template = document.getElementById("presenteTemplate");
const btnAtualizar = document.getElementById("btnAtualizar");
const filtroBusca = document.getElementById("filtroBusca");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroOrdem = document.getElementById("filtroOrdem");

const statTotal = document.getElementById("statTotal");
const statDisponivel = document.getElementById("statDisponivel");
const statReservado = document.getElementById("statReservado");
const adminMetricTotal = document.getElementById("adminMetricTotal");
const adminMetricReservados = document.getElementById("adminMetricReservados");
const adminMetricDisponiveis = document.getElementById("adminMetricDisponiveis");
const adminMetricPercentual = document.getElementById("adminMetricPercentual");
const adminMetricValorTotal = document.getElementById("adminMetricValorTotal");
const adminMetricValorReservado = document.getElementById("adminMetricValorReservado");
const adminRecentList = document.getElementById("adminRecentList");

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

const adminNome = document.getElementById("adminNome");
const adminPreco = document.getElementById("adminPreco");
const adminCategoria = document.getElementById("adminCategoria");
const adminFoto = document.getElementById("adminFoto");
const adminProdutoUrl = document.getElementById("adminProdutoUrl");
const adminDescricao = document.getElementById("adminDescricao");
const adminEspecificacoes = document.getElementById("adminEspecificacoes");
const isAdminPage = Boolean(adminForm);
let adminAuthenticated = !isAdminPage;
let editingPresenteId = null;
let autoRefreshTimerId = null;
const AUTO_REFRESH_INTERVAL_MS = 15000;

const BRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

let presentesState = [];


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
	if (!adminMetricTotal) {
		return;
	}

	if (!metrics) {
		adminMetricTotal.textContent = "0";
		adminMetricReservados.textContent = "0";
		adminMetricDisponiveis.textContent = "0";
		adminMetricPercentual.textContent = "0%";
		adminMetricValorTotal.textContent = BRL.format(0);
		adminMetricValorReservado.textContent = BRL.format(0);
		if (adminRecentList) {
			adminRecentList.innerHTML = "<li>Nenhuma reserva recente.</li>";
		}
		return;
	}

	adminMetricTotal.textContent = String(metrics.total || 0);
	adminMetricReservados.textContent = String(metrics.reservados || 0);
	adminMetricDisponiveis.textContent = String(metrics.disponiveis || 0);
	adminMetricPercentual.textContent = `${Number(metrics.percentual_reservado || 0).toFixed(1)}%`;
	adminMetricValorTotal.textContent = BRL.format(Number(metrics.valor_total || 0));
	adminMetricValorReservado.textContent = BRL.format(Number(metrics.valor_reservado || 0));

	if (!adminRecentList) {
		return;
	}

	const ultimas = Array.isArray(metrics.ultimas_reservas) ? metrics.ultimas_reservas : [];
	adminRecentList.innerHTML = "";

	if (!ultimas.length) {
		adminRecentList.innerHTML = "<li>Nenhuma reserva recente.</li>";
		return;
	}

	ultimas.forEach((reserva) => {
		const li = document.createElement("li");
		li.textContent = `${reserva.nome} - ${BRL.format(Number(reserva.preco || 0))} - ${reserva.reservado_por_nome} (${formatReservationTime(reserva.reservado_em)})`;
		adminRecentList.appendChild(li);
	});
}


async function carregarMetricasAdmin() {
	if (!isAdminPage || !adminAuthenticated) {
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

		await carregarPresentes({ silent: true });
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


function renderPresentes() {
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

		listaEl.appendChild(node);
	});
}


async function carregarPresentes(options = {}) {
	const { silent = false } = options;

	if (!silent) {
		statusEl.textContent = "Carregando presentes...";
	}

	try {
		const response = await fetch("/api/presentes");
		if (!response.ok) {
			throw new Error("Falha ao buscar presentes");
		}

		presentesState = await response.json();

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

				adminStatus.textContent = "Arquivo JSON exportado com sucesso.";
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
	btnAtualizar.addEventListener("click", carregarPresentes);
}

async function initPage() {
	if (isAdminPage) {
		await syncAdminSession();
	}

	await carregarPresentes();
	startAutoRefresh();
}

initPage();
