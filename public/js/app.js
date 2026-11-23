// Altere esta URL para o endpoint do seu servidor Express em sala (ex.: http://localhost:3000/produtos)
const API_URL = "http://localhost:3000/produtos";

const form = document.getElementById("item-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const refreshBtn = document.getElementById("refresh-btn");
const tbody = document.getElementById("items-tbody");
const feedbackEl = document.getElementById("feedback");

const idInput = document.getElementById("item-id");
const nomeInput = document.getElementById("nome");
const categoriaInput = document.getElementById("categoria");
const precoInput = document.getElementById("preco");
const quantidadeInput = document.getElementById("quantidade");

let cacheItens = [];

function showFeedback(message, type = "success") {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback ${type}`;
}

function hideFeedback() {
  feedbackEl.className = "feedback hidden";
  feedbackEl.textContent = "";
}

function resetForm() {
  form.reset();
  idInput.value = "";
  formTitle.textContent = "Novo Produto";
  submitBtn.textContent = "Salvar";
  cancelBtn.classList.add("hidden");
}

function getFormPayload() {
  return {
    nome: nomeInput.value.trim(),
    categoria: categoriaInput.value.trim(),
    preco: Number(precoInput.value),
    quantidade: Number(quantidadeInput.value),
  };
}

function validatePayload(payload) {
  if (!payload.nome || !payload.categoria) {
    return "Preencha nome e categoria.";
  }
  if (Number.isNaN(payload.preco) || payload.preco < 0) {
    return "Informe um preço válido maior ou igual a zero.";
  }
  if (!Number.isInteger(payload.quantidade) || payload.quantidade < 0) {
    return "Informe uma quantidade inteira válida maior ou igual a zero.";
  }
  return null;
}

async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors.map((err) => err.message || err).join(" | ");
    }
  } catch (_) {
    // Ignora falha ao ler corpo JSON de erro
  }
  return `Erro na requisição (HTTP ${response.status}).`;
}

function formatCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderTable(items) {
  if (!Array.isArray(items) || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Nenhum registro encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map(
      (item) => `
      <tr>
        <td>${item.id}</td>
        <td>${escapeHtml(item.nome)}</td>
        <td>${escapeHtml(item.categoria)}</td>
        <td>${formatCurrency(item.preco)}</td>
        <td>${item.quantidade}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-edit" data-action="edit" data-id="${item.id}">
            Editar
          </button>
          <button type="button" class="btn btn-delete" data-action="delete" data-id="${item.id}">
            Excluir
          </button>
        </td>
      </tr>
    `
    )
    .join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

// READ (GET)
async function fetchItems() {
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">Carregando registros...</td>
    </tr>
  `;

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    // Suporta tanto um array direto quanto { data: [...] }
    const list = Array.isArray(data) ? data : (data.data ?? []);
    cacheItens = list;
    renderTable(cacheItens);
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Não foi possível carregar os dados. Verifique se a API está rodando.</td>
      </tr>
    `;
    showFeedback(error.message || "Falha ao buscar registros.", "error");
  }
}

// CREATE (POST) / UPDATE (PUT)
async function handleFormSubmit(event) {
  event.preventDefault();
  hideFeedback();

  const payload = getFormPayload();
  const validationError = validatePayload(payload);
  if (validationError) {
    showFeedback(validationError, "error");
    return;
  }

  const id = idInput.value;
  const isEditing = Boolean(id);
  const url = isEditing ? `${API_URL}/${id}` : API_URL;
  const method = isEditing ? "PUT" : "POST";

  submitBtn.disabled = true;

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    showFeedback(
      isEditing ? "Registro atualizado com sucesso!" : "Registro cadastrado com sucesso!",
      "success"
    );
    resetForm();
    await fetchItems();
  } catch (error) {
    showFeedback(error.message || "Erro ao salvar registro.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

function startEdit(id) {
  const item = cacheItens.find((entry) => String(entry.id) === String(id));
  if (!item) return;

  hideFeedback();
  idInput.value = item.id;
  nomeInput.value = item.nome ?? "";
  categoriaInput.value = item.categoria ?? "";
  precoInput.value = item.preco ?? "";
  quantidadeInput.value = item.quantidade ?? "";

  formTitle.textContent = `Editando Produto #${item.id}`;
  submitBtn.textContent = "Atualizar";
  cancelBtn.classList.remove("hidden");
  nomeInput.focus();
}

// DELETE
async function deleteItem(id) {
  hideFeedback();

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    if (String(idInput.value) === String(id)) {
      resetForm();
    }

    showFeedback("Registro excluído com sucesso!", "success");
    await fetchItems();
  } catch (error) {
    showFeedback(error.message || "Erro ao excluir registro.", "error");
  }
}

function handleTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "edit") {
    startEdit(id);
  } else if (action === "delete") {
    deleteItem(id);
  }
}

form.addEventListener("submit", handleFormSubmit);
cancelBtn.addEventListener("click", resetForm);
refreshBtn.addEventListener("click", fetchItems);
tbody.addEventListener("click", handleTableClick);

document.addEventListener("DOMContentLoaded", fetchItems);