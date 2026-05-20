// Variável global do cliente Supabase
let supabase;

// Intercepta todas as requisições para a API e insere o token do Supabase
const originalFetch = window.fetch;
window.fetch = async function () {
    let [resource, config] = arguments;
    if (typeof resource === 'string' && resource.startsWith('/api/') && resource !== '/api/config') {
        config = config || {};
        config.headers = config.headers || {};
        if (supabase) {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                 config.headers['Authorization'] = `Bearer ${data.session.access_token}`;
            }
        }
    }
    return originalFetch.call(this, resource, config);
};

// Lógica principal do app
document.addEventListener("DOMContentLoaded", async () => {
    const loginOverlay = document.getElementById("login-overlay");
    const appShell = document.getElementById("app-shell");
    const loginForm = document.getElementById("login-form");
    const loginFeedback = document.getElementById("login-feedback");

    // Inicialização segura com credenciais protegidas via backend
    try {
        const configRes = await fetch("/api/config");
        const envConfig = await configRes.json();
        supabase = window.supabase.createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_ANON_KEY);
    } catch (e) {
        loginFeedback.textContent = "Erro crítico: não foi possível carregar as credenciais do servidor.";
        console.error(e);
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        loginOverlay.style.display = "none";
        appShell.style.display = "block";
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const btn = loginForm.querySelector("button");

        btn.disabled = true;
        btn.textContent = "Entrando...";
        loginFeedback.textContent = "";

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data.session) {
            loginFeedback.textContent = "Erro: " + (error?.message || "E-mail ou senha inválidos.");
            btn.disabled = false;
            btn.textContent = "Entrar";
            return;
        }

        loginOverlay.style.display = "none";
        appShell.style.display = "block";
        loadLeads().catch(console.error); // Carrega os leads após o login
    });

    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            if (supabase) await supabase.auth.signOut();
            appShell.style.display = "none";
            loginOverlay.style.display = "flex";
            document.getElementById("login-password").value = "";
        });
    }
});

const elements = {
  form: document.querySelector("#search-form"),
  query: document.querySelector("#query"),
  maxResults: document.querySelector("#maxResults"),
  feedback: document.querySelector("#feedback"),
  leadList: document.querySelector("#lead-list"),
  template: document.querySelector("#lead-card-template"),
  metrics: {
    total: document.querySelector("#metric-total"),
    pending: document.querySelector("#metric-pending"),
    approved: document.querySelector("#metric-approved"),
    rejected: document.querySelector("#metric-rejected")
  },
  btnClear: document.querySelector("#btn-clear")
};

const statusLabels = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado"
};

function setFeedback(message, tone = "neutral") {
  elements.feedback.textContent = message;
  elements.feedback.dataset.tone = tone;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function updateMetrics(leads) {
  const counts = leads.reduce(
    (accumulator, lead) => {
      accumulator.total += 1;
      accumulator[lead.status] += 1;
      return accumulator;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
  );

  elements.metrics.total.textContent = String(counts.total);
  elements.metrics.pending.textContent = String(counts.pending);
  elements.metrics.approved.textContent = String(counts.approved);
  elements.metrics.rejected.textContent = String(counts.rejected);
}

async function updateLeadStatus(id, status) {
  const response = await fetch(`/api/leads/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel atualizar o status.");
  }
}

function isFakeWebsite(url) {
  if (!url) return true;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes("instagram.com") || lowerUrl.includes("facebook.com") || lowerUrl.includes("linktr.ee") || lowerUrl.includes("wa.me");
}

function createLeadCard(lead) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".ticket");
  const status = fragment.querySelector(".ticket__status");
  const date = fragment.querySelector(".ticket__date");
  const title = fragment.querySelector(".ticket__title");
  const phone = fragment.querySelector(".ticket__phone");
  const meta = fragment.querySelector(".ticket__meta");
  const mapsContainer = fragment.querySelector(".maps-link-container");
  const buttons = fragment.querySelectorAll("[data-status], [data-generate], [data-manual], .edit-site-btn, .delete-site-btn");

  let websiteWarning = '';
  if (isFakeWebsite(lead.websiteUri)) {
     websiteWarning = `<span style="background:var(--red-soft); color:var(--red); padding: 2px 8px; border-radius:4px; font-size:11px; margin-left: 6px; vertical-align: middle; font-weight: 600; letter-spacing: 0.04em;">Sem site</span>`;
  }

  card.dataset.status = lead.status;
  status.textContent = statusLabels[lead.status];
  date.textContent = `Atualizado em ${formatDate(lead.updatedAt)}`;
  title.innerHTML = `${lead.companyName} ${websiteWarning}`;
  phone.textContent = lead.phoneNumber;
  meta.innerHTML = `<strong>Place ID:</strong> ${lead.placeId} <br/> <strong>Website:</strong> ${lead.websiteUri ? `<a href="${lead.websiteUri}" target="_blank" style="color:var(--accent);">${lead.websiteUri}</a>` : "Nenhum"}`;

  if (lead.googleMapsUri) {
    mapsContainer.innerHTML = `<a href="${lead.googleMapsUri}" target="_blank" class="button button--ghost">G. Maps</a>`;
  }

  const whatsappContainer = fragment.querySelector(".whatsapp-link-container");
  if (lead.phoneNumber && whatsappContainer) {
      let cleanPhone = lead.phoneNumber.replace(/\D/g, "");
      if (cleanPhone.length > 0) {
          if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) cleanPhone = "55" + cleanPhone;
          let msgUrl = lead.siteUrl || "[Ainda não geramos o site]";
          let waMsg = "Olá, tudo joia ?";
          whatsappContainer.innerHTML = `<a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}" target="_blank" class="button button--primary" style="background:#25D366; color:white; border-color:transparent;"><svg style="width:14px; margin-right:6px;" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>WhatsApp</a>`;
      }
  }

  // Botão "Enviar via Evo" — aparece somente se a Evo estiver configurada
  const evoContainer = fragment.querySelector(".evo-send-container");
  if (evoContainer && lead.phoneNumber && window._evoConfigured) {
    const siteLink = lead.siteUrl ?? "[Site sendo preparado]";
    const defaultMsg = "Olá, tudo joia ?";

    evoContainer.innerHTML = `<button class="button evo-send-btn" type="button" style="background:#128C7E; color:white; border-color:transparent; font-weight:600;">📲 Enviar via Evo</button>`;
    const evoBtn = evoContainer.querySelector(".evo-send-btn");
    if (evoBtn) {
      evoBtn.addEventListener("click", () => {
        document.getElementById("evo-lead-id").value = lead.id;
        document.getElementById("evo-lead-name").textContent = lead.companyName;
        document.getElementById("evo-message-text").value = defaultMsg;
        document.getElementById("evo-feedback").textContent = "";
        document.getElementById("evo-feedback").style.color = "";
        document.getElementById("evo-send-submit").disabled = false;
        document.getElementById("evo-send-submit").textContent = "Enviar agora";
        document.getElementById("evo-send-dialog").showModal();
      });
    }
  }

  const siteLinks = fragment.querySelector(".ticket__site_links");
  if (lead.siteUrl) {
     const isManual = !lead.stitchSessionId;
     const editBtnHtml = !isManual ? `<button class="button button--ghost edit-site-btn" style="font-size:12px; min-height:28px; padding:0 8px;">Editar</button>` : '';

     siteLinks.innerHTML = `
       <div style="background:var(--surface-alt); padding:8px 12px; border-radius:6px; margin:8px 0; font-size:13px; border:1px solid var(--border);">
         <strong style="color:var(--fg); font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Site ${isManual ? 'Manual' : 'Publicado'}</strong><br/>
         <a href="${lead.siteUrl}" target="_blank" style="color:var(--accent); font-size:13px;">${lead.siteUrl}</a>
         &nbsp;
         <a href="${lead.githubUrl}" target="_blank" style="color:var(--fg-tertiary); font-size:12px;">Repo</a>
         <div style="margin-top:8px; display:flex; gap:6px;">
           ${editBtnHtml}
           <button class="button button--ghost delete-site-btn" style="font-size:12px; min-height:28px; padding:0 8px; color:var(--red); border-color:var(--red-soft);">Excluir</button>
         </div>
       </div>
     `;
     
     if (!isManual) {
       const editBtn = siteLinks.querySelector(".edit-site-btn");
       if (editBtn) {
         editBtn.onclick = () => {
            document.getElementById("edit-lead-id").value = lead.id;
            document.getElementById("edit-lead-name").textContent = lead.companyName;
            document.getElementById("edit-prompt").value = "";
            document.getElementById("edit-feedback").textContent = "";
            document.getElementById("edit-dialog").showModal();
         }
       }
     }

     const deleteBtn = siteLinks.querySelector(".delete-site-btn");
     deleteBtn.onclick = async () => {
        if (!confirm("Tem certeza que deseja apagar o Repositório no Github e o Projeto na Vercel? Essa ação é IRREVERSÍVEL.")) return;
        
        deleteBtn.disabled = true;
        deleteBtn.textContent = "Apagando…";

        try {
          const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}/site`, {
            method: "DELETE"
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.message || "Erro ao deletar");

          // Remove the siteLinks UI
          siteLinks.innerHTML = "";
          setTimeout(() => loadLeads(), 500);
        } catch (err) {
          alert("Falha ao apagar site: " + err.message);
          deleteBtn.disabled = false;
          deleteBtn.textContent = "Excluir";
        }
     }
  }

  buttons.forEach((button) => {
    if (button.dataset.status === lead.status && !button.dataset.generate) {
      button.disabled = true;
    }

    if (button.dataset.generate) {
      button.addEventListener("click", () => {
        document.getElementById("generate-lead-id").value = lead.id;
        document.getElementById("generate-lead-name").textContent = lead.companyName;
        document.getElementById("generate-feedback").textContent = "";
        
        const brandingInput = document.getElementById("generate-branding");
        if (brandingInput) brandingInput.value = "";
        
        document.getElementById("generate-dialog").showModal();
      });
      return;
    }

    if (button.dataset.manual) {
      button.addEventListener("click", () => {
        document.getElementById("manual-lead-id").value = lead.id;
        document.getElementById("manual-lead-name").textContent = lead.companyName;
        document.getElementById("manual-html").value = "";
        document.getElementById("manual-feedback").textContent = "";
        document.getElementById("manual-dialog").showModal();
      });
      return;
    }

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await updateLeadStatus(lead.id, button.dataset.status);
        setFeedback(`Status de "${lead.companyName}" atualizado para ${statusLabels[button.dataset.status]}.`, "success");
        await loadLeads();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Erro inesperado.", "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  return fragment;
}

function renderLeads(leads) {
  elements.leadList.innerHTML = "";

  if (!leads.length) {
    elements.leadList.innerHTML = '<p class="empty-state">Nenhum lead salvo ainda. Rode uma busca para preencher a fila.</p>';
    updateMetrics([]);
    return;
  }

  const fragment = document.createDocumentFragment();
  leads.forEach((lead) => fragment.appendChild(createLeadCard(lead)));
  elements.leadList.appendChild(fragment);
  updateMetrics(leads);
}

// Variável global para armazenar temporariamente os leads e aplicar os filtros sem chamar a API toda vez
let allLeadsCache = [];

window.copyText = function(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => {
    // Busca o event target original para trocar o texto temporariamente
    const ev = window.event;
    if(ev && ev.target) {
       const btn = ev.target;
       const originalText = btn.textContent;
       btn.textContent = "✔ Copiado!";
       setTimeout(() => btn.textContent = originalText, 2000);
    }
  });
};

const navLeads = document.getElementById("nav-leads");
const navSales = document.getElementById("nav-sales");
const viewLeads = document.getElementById("view-leads");
const viewSales = document.getElementById("view-sales");

if (navLeads && navSales) {
  navLeads.addEventListener("click", () => {
    navLeads.classList.add("active");
    navSales.classList.remove("active");
    viewLeads.style.display = "block";
    viewSales.style.display = "none";
  });
  
  navSales.addEventListener("click", () => {
    navSales.classList.add("active");
    navLeads.classList.remove("active");
    viewSales.style.display = "block";
    viewLeads.style.display = "none";
  });
}

async function loadLeads() {
  const response = await fetch("/api/leads");

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a fila.");
  }

  const payload = await response.json();
  allLeadsCache = payload.leads;
  applyFilters();
}

function applyFilters() {
  const searchInput = document.getElementById("local-search");
  const siteFilter = document.getElementById("filter-no-site");
  
  const term = (searchInput ? searchInput.value : "").toLowerCase();
  const noSiteOnly = siteFilter ? siteFilter.checked : false;

  const filtered = allLeadsCache.filter(lead => {
    // Check filter: without website
    if (noSiteOnly) {
       // Se tem websiteUri "válido" (não os falsos/rede social), esconde.
       if (lead.websiteUri && !isFakeWebsite(lead.websiteUri)) return false;
    }

    // Check search term
    if (term) {
       const companyName = (lead.companyName || "").toLowerCase();
       const phoneNumber = (lead.phoneNumber || "").toLowerCase();
       if (!companyName.includes(term) && !phoneNumber.includes(term)) {
           return false;
       }
    }

    return true;
  });

  renderLeads(filtered);
}

// Attach listeners for filters
const searchInput = document.getElementById("local-search");
const siteFilter = document.getElementById("filter-no-site");
if (searchInput) searchInput.addEventListener("input", applyFilters);
if (siteFilter) siteFilter.addEventListener("change", applyFilters);

async function handleSearch(event) {
  event.preventDefault();
  const query = elements.query.value.trim();
  const maxResults = Number(elements.maxResults.value || 10);
  const submitBtn = elements.form.querySelector('button[type="submit"]');

  if (!query) {
    setFeedback("Digite uma busca antes de continuar.", "error");
    return;
  }

  setFeedback("Buscando e atualizando a fila local... (isso pode levar 1 minuto)", "neutral");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Buscando...";
  }

  try {
    const response = await fetch("/api/leads/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        maxResults,
        persist: true
      })
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textError = await response.text();
      throw new Error(`Erro no Servidor/Timeout Vercel (Status: ${response.status}). A busca demorou demais ou falhou gravemente.`);
    }

    const payload = await response.json();

    if (!response.ok) {
      setFeedback(payload.message || "Não foi possivel concluir a busca.", "error");
      return;
    }

    setFeedback(`Busca concluida. ${payload.total} lead(s) encontrados nesta rodada.`, "success");
    await loadLeads();
  } catch (error) {
    setFeedback(error.message || "Erro inesperado ou Timeout de conexão.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Buscar";
    }
  }
}

elements.form.addEventListener("submit", handleSearch);

if (elements.btnClear) {
  elements.btnClear.addEventListener("click", async () => {
    if(!confirm("Atenção: Isso vai apagar toda a sua base de empresas consultadas (leads.json). O Google voltará a achar essas mecânicas se você não usar a estratégia correta de bairro/cidades. Tem certeza que deseja limpar tudo?")) {
      return;
    }
    
    setFeedback("Esvaziando lista...", "neutral");
    
    try {
      const response = await fetch("/api/leads", { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao limpar dados");
      await loadLeads();
      setFeedback("Fila esvaziada com sucesso!", "success");
    } catch(err) {
      setFeedback("Erro ao esvaziar fila: " + err.message, "error");
    }
  });
}

// Verificação de status da Evo — busca uma vez no carregamento
window._evoConfigured = false;
fetch("/api/evolution/status")
  .then((r) => r.json())
  .then((data) => {
    window._evoConfigured = data.configured === true;
    if (window._evoConfigured) {
      console.info("[Evo] Evolution API conectada ✅");
    } else {
      console.warn("[Evo] Evolution API não configurada. Adicione as variáveis no .env para ativar o envio direto.");
    }
  })
  .catch(() => {
    window._evoConfigured = false;
  });

loadLeads().catch((error) => {
  setFeedback(error instanceof Error ? error.message : "Erro inesperado.", "error");
});
// ─────────────────────────────────────────────────────────────
// COMPRESSÃO E UPLOAD DE IMAGENS REMOVIDOS (Agora usa texto)
// ─────────────────────────────────────────────────────────────

const generateForm = document.getElementById("generate-form");

if (generateForm) {
  generateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const leadId = document.getElementById("generate-lead-id").value;
    const brandingInput = document.getElementById("generate-branding");
    const brandingText = brandingInput ? brandingInput.value : "";
    const feedback = document.getElementById("generate-feedback");
    const submitBtn = document.getElementById("generate-submit");
    const closeBtn = document.getElementById("generate-close");
    const abortBtn = document.getElementById("generate-abort");

    submitBtn.style.display = "none";
    closeBtn.style.display = "none";
    abortBtn.style.display = "block";
    
    feedback.innerHTML = `Fase 1/2: Solicitando criação do código à IA (Stitch)...`;
    feedback.style.color = "var(--fg-secondary)";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 310000); // 5 min

    const onAbortClick = () => {
       controller.abort();
    };
    abortBtn.addEventListener("click", onAbortClick, { once: true });

    try {
      // 1. Chamar endpoint generate-code (Fase 1)
      const resCode = await fetch(`/api/leads/${encodeURIComponent(leadId)}/generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: brandingText }),
        signal: controller.signal
      });

      if (!resCode.ok) {
        const payload = await resCode.json();
        throw new Error(payload.message || "Erro na geração do código com Stitch AI.");
      }

      const codeData = await resCode.json();
      
      // 2. Chamar endpoint publish-manual (Fase 2)
      feedback.innerHTML = `Fase 2/2: Código gerado! Publicando no GitHub e configurando deploy na Vercel...`;
      
      const resPublish = await fetch(`/api/leads/${encodeURIComponent(leadId)}/publish-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: codeData.html,
          stitchProjectId: codeData.stitchProjectId,
          stitchSessionId: codeData.stitchSessionId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      abortBtn.removeEventListener("click", onAbortClick);

      const publishData = await resPublish.json();
      if (!resPublish.ok) {
        throw new Error(publishData.message || "Erro na publicação do site.");
      }

      feedback.style.color = "var(--green)";
      feedback.innerHTML = `
        <strong>Site publicado com sucesso!</strong><br/>
        <a href="${publishData.deployUrl}" target="_blank" style="color:var(--accent)">${publishData.deployUrl}</a><br/>
        <a href="${publishData.githubUrl}" target="_blank" style="color:var(--fg-tertiary)">${publishData.githubUrl}</a>
      `;

      setTimeout(() => loadLeads(), 1500);
    } catch (err) {
      if (err.name === 'AbortError') {
         feedback.textContent = "Cancelado: A geração foi interrompida.";
      } else {
         feedback.textContent = "Falha: " + err.message;
      }
      feedback.style.color = "var(--red)";
    } finally {
      submitBtn.style.display = "block";
      closeBtn.style.display = "block";
      abortBtn.style.display = "none";
    }
  });

  const editForm = document.getElementById("edit-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const leadId = document.getElementById("edit-lead-id").value;
      const prompt = document.getElementById("edit-prompt").value;
      const feedback = document.getElementById("edit-feedback");
      const submitBtn = document.getElementById("edit-submit");

      submitBtn.disabled = true;
      submitBtn.textContent = "Aplicando…";
      feedback.textContent = `Fase 1/2: Enviando alteração à IA (Stitch)...`;
      feedback.style.color = "var(--fg-secondary)";

      try {
        // 1. Chamar endpoint edit-code (Fase 1)
        const resCode = await fetch(`/api/leads/${encodeURIComponent(leadId)}/edit-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        const codeData = await resCode.json();
        if (!resCode.ok) {
          throw new Error(codeData.message || "Erro na edição do código com Stitch AI.");
        }

        // 2. Chamar endpoint publish-manual (Fase 2)
        feedback.textContent = `Fase 2/2: Código alterado! Atualizando deploy na Vercel...`;
        
        const resPublish = await fetch(`/api/leads/${encodeURIComponent(leadId)}/publish-manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: codeData.html
          }),
        });

        const publishData = await resPublish.json();
        if (!resPublish.ok) {
          throw new Error(publishData.message || "Erro na publicação do site editado.");
        }

        feedback.style.color = "var(--green)";
        feedback.innerHTML = `
          <strong>Alteração aplicada!</strong><br/>
          <a href="${publishData.deployUrl}" target="_blank" style="color:var(--accent)">Abrir site</a>
        `;
        
        setTimeout(() => loadLeads(), 1500);
      } catch (err) {
        feedback.textContent = "Falha: " + err.message;
        feedback.style.color = "var(--red)";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Aplicar Mudança";
      }
    });
  }

  const manualForm = document.getElementById("manual-form");
  if (manualForm) {
    const manualDropzone = document.getElementById("manual-dropzone");
    const manualFile = document.getElementById("manual-file");
    const manualFileName = document.getElementById("manual-file-name");
    const manualHtml = document.getElementById("manual-html");
    const manualSubmit = document.getElementById("manual-submit");

    const checkSubmitState = () => {
      manualSubmit.disabled = !manualHtml.value.trim();
    };

    manualHtml.addEventListener("input", checkSubmitState);

    // Clique na dropzone dispara o input de arquivo
    manualDropzone.addEventListener("click", () => {
      manualFile.click();
    });

    // Ao arrastar arquivo sobre a dropzone
    manualDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      manualDropzone.style.background = "rgba(139, 92, 246, 0.08)";
      manualDropzone.style.borderColor = "var(--accent)";
    });

    manualDropzone.addEventListener("dragleave", () => {
      manualDropzone.style.background = "rgba(255, 255, 255, 0.01)";
      manualDropzone.style.borderColor = "var(--border-strong)";
    });

    const processFile = (file) => {
      if (!file) return;
      if (!file.name.endsWith(".html")) {
        alert("Por favor, selecione apenas arquivos .html");
        return;
      }
      manualFileName.textContent = `Selecionado: ${file.name}`;
      const reader = new FileReader();
      reader.onload = (e) => {
        manualHtml.value = e.target.result;
        checkSubmitState();
      };
      reader.readAsText(file);
    };

    manualDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      manualDropzone.style.background = "rgba(255, 255, 255, 0.01)";
      manualDropzone.style.borderColor = "var(--border-strong)";
      const file = e.dataTransfer.files[0];
      processFile(file);
    });

    manualFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      processFile(file);
    });

    manualForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const leadId = document.getElementById("manual-lead-id").value;
      const html = manualHtml.value;
      const feedback = document.getElementById("manual-feedback");
      const submitBtn = document.getElementById("manual-submit");

      if (!html) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Publicando…";
      feedback.textContent = `Enviando para Github e Vercel. Aguarde ~15s.`;
      feedback.style.color = "var(--fg-secondary)";

      try {
        const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/publish-manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.message || "Erro desconhecido ao subir HTML manual.");
        }

        feedback.style.color = "var(--green)";
        feedback.innerHTML = `
          <strong>Site publicado.</strong><br/>
          <a href="${payload.deployUrl}" target="_blank" style="color:var(--accent)">${payload.deployUrl}</a><br/>
          <a href="${payload.githubUrl}" target="_blank" style="color:var(--fg-tertiary)">${payload.githubUrl}</a>
        `;
        
        setTimeout(() => loadLeads(), 1500);
      } catch (err) {
        feedback.textContent = "Falha: " + err.message;
        feedback.style.color = "var(--red)";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Publicar Site";
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// MODO AUTOMÁTICO — SSE consumer + dialog logic
// ─────────────────────────────────────────────────────────────

const btnAutoGenerate = document.getElementById("btn-auto-generate");
const autoDialog = document.getElementById("auto-generate-dialog");
const autoForm = document.getElementById("auto-generate-form");
const autoCountInfo = document.getElementById("auto-count-info");
const autoLog = document.getElementById("auto-generate-log");
const autoProgressWrap = document.getElementById("auto-progress-wrap");
const autoProgressBar = document.getElementById("auto-progress-bar");
const autoProgressLabel = document.getElementById("auto-progress-label");
const autoProgressCount = document.getElementById("auto-progress-count");
const autoSubmitBtn = document.getElementById("auto-generate-submit");
const autoCancelBtn = document.getElementById("auto-cancel-btn");

function countLeadsWithoutSite() {
  const fakeDomains = ["instagram.com", "facebook.com", "linktr.ee", "wa.me"];
  return allLeadsCache.filter((l) => {
    if (l.status !== "approved") return false; // Apenas leads aprovados entram no funil automático
    if (l.siteUrl) return false;
    if (!l.websiteUri) return true;
    const u = l.websiteUri.toLowerCase();
    return fakeDomains.some((d) => u.includes(d));
  }).length;
}


function appendAutoLog(message, type = "info") {
  const colors = { info: "var(--fg-secondary)", success: "var(--green)", error: "var(--red)", progress: "var(--accent)" };
  const line = document.createElement("div");
  line.style.cssText = `color:${colors[type] ?? colors.info}; padding: 2px 0; border-bottom: 1px solid var(--border);`;
  line.textContent = message;
  autoLog.appendChild(line);
  autoLog.scrollTop = autoLog.scrollHeight;
}

function resetAutoDialog() {
  if (autoLog) { autoLog.innerHTML = ""; autoLog.style.display = "none"; }
  if (autoProgressWrap) autoProgressWrap.style.display = "none";
  if (autoProgressBar) autoProgressBar.style.width = "0%";
  if (autoProgressLabel) autoProgressLabel.textContent = "Aguardando…";
  if (autoProgressCount) autoProgressCount.textContent = "0/0";
  if (autoSubmitBtn) { autoSubmitBtn.disabled = false; autoSubmitBtn.textContent = "⚡ Iniciar Geração"; }
  if (autoCancelBtn) autoCancelBtn.onclick = () => autoDialog.close();
}

if (btnAutoGenerate) {
  btnAutoGenerate.addEventListener("click", () => {
    resetAutoDialog();
    const count = countLeadsWithoutSite();
    const batchSize = Math.min(count, 10);
    autoCountInfo.textContent = batchSize > 0
      ? `${count} empresa(s) aprovada(s) sem site na fila. Esta sessão processará até ${batchSize}.`
      : "Nenhuma empresa aprovada e sem site na fila. Aprove leads primeiro.";
    if (autoSubmitBtn) autoSubmitBtn.disabled = batchSize === 0;
    autoDialog.showModal();
  });
}


if (autoForm) {
  autoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const batchSize = Math.min(countLeadsWithoutSite(), 10);
    if (batchSize === 0) return;

    const abortController = new AbortController();

    autoLog.style.display = "block";
    autoLog.innerHTML = "";
    autoProgressWrap.style.display = "block";
    autoSubmitBtn.disabled = true;
    autoSubmitBtn.textContent = "Gerando…";
    
    autoCancelBtn.textContent = "Cancelar";
    autoCancelBtn.onclick = () => {
      abortController.abort();
      appendAutoLog("⚠️ Geração cancelada pelo usuário.", "error");
      autoSubmitBtn.disabled = false;
      autoSubmitBtn.textContent = "⚡ Tentar novamente";
      autoCancelBtn.textContent = "Fechar";
      autoCancelBtn.onclick = () => { autoDialog.close(); loadLeads(); };
    };

    const formData = new FormData();

    appendAutoLog(`⚡ Iniciando geração automática de até ${batchSize} sites...`, "info");

    try {
      const response = await fetch("/api/leads/auto-generate", {
        method: "POST",
        body: formData,
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ message: "Erro ao iniciar geração." }));
        appendAutoLog(`❌ ${err.message}`, "error");
        resetAutoDialog();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === "start") {
                autoProgressCount.textContent = `0/${data.total}`;
                appendAutoLog(data.message, "info");
              }

              if (eventType === "progress") {
                autoProgressLabel.textContent = data.message;
                autoProgressCount.textContent = `${data.index - 1}/${data.total}`;
                autoProgressBar.style.width = `${Math.round(((data.index - 1) / data.total) * 100)}%`;
                appendAutoLog(`⏳ ${data.message}`, "progress");
              }

              if (eventType === "done") {
                autoProgressBar.style.width = `${Math.round((data.index / data.total) * 100)}%`;
                autoProgressCount.textContent = `${data.index}/${data.total}`;
                if (data.status === "success") {
                  appendAutoLog(`✅ ${data.companyName} → ${data.deployUrl}`, "success");
                } else {
                  appendAutoLog(data.message, "error");
                }
                setTimeout(() => loadLeads(), 600);
              }

              if (eventType === "complete") {
                autoProgressBar.style.width = "100%";
                autoProgressLabel.textContent = data.message;
                appendAutoLog(`\n🏁 ${data.message}`, "success");
                autoSubmitBtn.disabled = false;
                autoSubmitBtn.textContent = "Concluído ✔";
                autoCancelBtn.textContent = "Fechar";
                autoCancelBtn.onclick = () => { autoDialog.close(); loadLeads(); };
              }
            } catch (_) { /* ignora linhas malformadas */ }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
         // handled by onclick
      } else {
        appendAutoLog(`❌ Falha na conexão: ${err.message}`, "error");
        autoSubmitBtn.disabled = false;
        autoSubmitBtn.textContent = "⚡ Tentar novamente";
        autoCancelBtn.textContent = "Fechar";
        autoCancelBtn.onclick = () => { autoDialog.close(); loadLeads(); };
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// ENVIO VIA EVOLUTION API — Handler do formulário
// ─────────────────────────────────────────────────────────────

const evoSendForm = document.getElementById("evo-send-form");
if (evoSendForm) {
  evoSendForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const leadId = document.getElementById("evo-lead-id").value;
    const messageText = document.getElementById("evo-message-text").value.trim();
    const feedbackEl = document.getElementById("evo-feedback");
    const submitBtn = document.getElementById("evo-send-submit");

    if (!messageText) {
      feedbackEl.textContent = "A mensagem não pode estar vazia.";
      feedbackEl.style.color = "var(--red)";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = "Enviando…";
    feedbackEl.textContent = "Conectando com a Evolution API…";
    feedbackEl.style.color = "var(--fg-secondary)";

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useCustomMessage: true,
          customMessage: messageText
        })
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.message || "Erro ao enviar via Evo.");
      }

      feedbackEl.style.color = "var(--green)";
      feedbackEl.innerHTML = `✅ Enviado! <strong>ID:</strong> ${payload.messageId} | <strong>Número:</strong> ${payload.number}`;
      submitBtn.textContent = "Enviado ✔";
      submitBtn.style.background = "#1a8d3a";

    } catch (err) {
      feedbackEl.textContent = `❌ Falha: ${err.message}`;
      feedbackEl.style.color = "var(--red)";
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg style="width:14px; margin-right:6px;" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>Tentar novamente`;
    }
  });
}
