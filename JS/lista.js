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

const adminForm = document.getElementById("adminForm");
const adminTokenInput = document.getElementById("adminToken");
const adminStatus = document.getElementById("adminStatus");

const adminNome = document.getElementById("adminNome");
const adminPreco = document.getElementById("adminPreco");
const adminCategoria = document.getElementById("adminCategoria");
const adminFoto = document.getElementById("adminFoto");
const adminDescricao = document.getElementById("adminDescricao");
const adminEspecificacoes = document.getElementById("adminEspecificacoes");
const isAdminPage = Boolean(adminForm);

const BRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

let presentesState = [];


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


function updateStats(presentes) {
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
	const email = inputEmail.value.trim();

	if (nome.length < 3) {
		alert("Informe um nome válido com pelo menos 3 caracteres.");
		inputCheck.checked = false;
		return;
	}

	if (!email) {
		alert("Informe um e-mail válido.");
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
		statusPresenteEl.textContent = `Reservado por ${nome}`;
		inputNome.disabled = true;
		inputEmail.disabled = true;

		await carregarPresentes();
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

	const confirmed = window.confirm("Deseja remover este presente da lista?");
	if (!confirmed) {
		return;
	}

	try {
		const response = await fetch(`/api/presentes/${presenteId}`, {
			method: "DELETE",
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

		card.style.animationDelay = `${Math.min(index * 40, 300)}ms`;

		nomeEl.textContent = presente.nome;
		precoEl.textContent = BRL.format(Number(presente.preco || 0));
		descricaoEl.textContent = presente.descricao || "Sem descricao informada.";
		categoriaEl.textContent = presente.categoria || "Geral";

		fotoEl.src = presente.foto_url;
		fotoEl.alt = `Foto do presente ${presente.nome}`;
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
				btnRemover.addEventListener("click", async () => {
					await removerPresente(presente.id);
				});
			}
		}

		listaEl.appendChild(node);
	});
}


async function carregarPresentes() {
	statusEl.textContent = "Carregando presentes...";

	try {
		const response = await fetch("/api/presentes");
		if (!response.ok) {
			throw new Error("Falha ao buscar presentes");
		}

		presentesState = await response.json();

		updateStats(presentesState);
		updateCategorias(presentesState);
		renderPresentes();
	} catch (error) {
		statusEl.textContent = "Erro ao carregar a lista de presentes.";
		console.error(error);
	}
}


if (isAdminPage) {
	adminForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		adminStatus.textContent = "Enviando...";

		const payload = {
			nome: adminNome.value.trim(),
			preco: Number(adminPreco.value),
			categoria: adminCategoria.value.trim() || "Geral",
			foto_url: adminFoto.value.trim(),
			descricao: adminDescricao.value.trim(),
			especificacoes: adminEspecificacoes.value
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean),
		};

		try {
			const response = await fetch("/api/presentes", {
				method: "POST",
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

			adminStatus.textContent = "Presente adicionado com sucesso.";
			adminForm.reset();
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

carregarPresentes();
