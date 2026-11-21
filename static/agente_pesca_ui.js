/**
 * Agente IA de Pesca — Ligação Inteligente em 3 Níveis
 * Nível 1: VigilanteAI Local (http://127.0.0.1:8765/api/chat ou IP local configurável)
 * Nível 2: Motor Local Offline em JavaScript (análise direta do Diário no mar)
 * Nível 3: Copiar Pergunta + Contexto formatado para PocketPal AI / Gemini
 */
(() => {
  const CHAVE_URL_VIGILANTE = 'gps_nautico_vigilante_url';
  const URL_PADRAO = 'http://192.168.1.195:8765';

  function escaparHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function notificar(msg) {
    const toast = document.getElementById('toastNotificacao');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visivel');
      clearTimeout(window.__toastIaPescaTimer);
      window.__toastIaPescaTimer = setTimeout(() => toast.classList.remove('visivel'), 3200);
    }
  }

  function obterUrlVigilante() {
    try {
      const val = localStorage.getItem(CHAVE_URL_VIGILANTE);
      return val && val.trim() ? val.trim() : URL_PADRAO;
    } catch (_) {
      return URL_PADRAO;
    }
  }

  function obterEndpointChat() {
    const base = obterUrlVigilante().replace(/\/+$/, '');
    return base.endsWith('/api/chat') ? base : `${base}/api/chat`;
  }

  function guardarUrlVigilante(novaUrl) {
    const limpa = (novaUrl || '').trim() || URL_PADRAO;
    try {
      localStorage.setItem(CHAVE_URL_VIGILANTE, limpa);
    } catch (_) {}
    return limpa;
  }

  function obterContextoAtual() {
    let base = {
      dataHoje: new Date().toISOString().slice(0, 10),
      faseLuaAtual: 'Desconhecida',
      posicaoAtual: null,
      pesqueiroSelecionado: null,
      totalRegistosDiario: 0,
      ultimosRegistos: []
    };
    if (window.DiarioPesca && typeof window.DiarioPesca.obterContextoResumido === 'function') {
      base = window.DiarioPesca.obterContextoResumido(15);
    }
    if (window.MeteorologiaMaritima && typeof window.MeteorologiaMaritima.obterResumoParaIA === 'function') {
      base.meteorologia = window.MeteorologiaMaritima.obterResumoParaIA();
    }
    return base;
  }

  function obterTodosRegistos() {
    if (window.DiarioPesca && typeof window.DiarioPesca.obterRegistos === 'function') {
      return window.DiarioPesca.obterRegistos();
    }
    return [];
  }

  function formatarPromptCompleto(pergunta, ctx) {
    const posTxt = ctx.posicaoAtual
      ? `${ctx.posicaoAtual.lat.toFixed(5)}, ${ctx.posicaoAtual.lon.toFixed(5)}`
      : 'Sem fix GPS';
    const alvoTxt = ctx.pesqueiroSelecionado
      ? `${ctx.pesqueiroSelecionado.nome} (${ctx.pesqueiroSelecionado.lat.toFixed(4)}, ${ctx.pesqueiroSelecionado.lon.toFixed(4)})`
      : 'Nenhum selecionado';

    const linhasRegistos = (ctx.ultimosRegistos || []).map((r, i) => {
      const lembrete = r.lembrete ? ` | Lembrete: ${r.lembrete}${r.lembreteData ? ` (${r.lembreteData})` : ''}` : '';
      return `${i + 1}. [${r.data} ${r.hora || ''}] ${r.pesqueiro} | ${r.faseLua || '-'} | ${r.especie} (${r.quantidade || '-'}) | Arte: ${r.arte || '-'} | Maré: ${r.mare || '-'} | Mar: ${r.estadoMar || '-'} ${r.vento || ''}${lembrete}`;
    });

    const meteoLinha = ctx.meteorologia?.disponivel
      ? `\nCondições Marítimas & Hora do Peixe: ${ctx.meteorologia.textoResumo}\n`
      : '\n';

    return (
      `És um especialista em pesca marítima e navegação costeira em Portugal.\n` +
      `Data: ${ctx.dataHoje} | Lua: ${ctx.faseLuaAtual}\n` +
      `Posição Atual: ${posTxt} | Pesqueiro Alvo: ${alvoTxt}` +
      meteoLinha +
      `Últimos Registos do Diário (${linhasRegistos.length} de ${ctx.totalRegistosDiario}):\n` +
      (linhasRegistos.length ? linhasRegistos.join('\n') : '(Diário ainda sem registos)') +
      `\n\nPergunta do Mestre: ${pergunta}`
    );
  }

  // ==========================================
  // NÍVEL 2: MOTOR LOCAL OFFLINE (NO MAR)
  // ==========================================
  function analisarDiarioOffline(pergunta, ctx, registos) {
    const q = (pergunta || '').toLowerCase();
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const luaAtualNome = (ctx.faseLuaAtual || '').replace(/^[^\wÀ-ÿ]+\s*/, '').trim();

    const meteoBloco = ctx.meteorologia?.disponivel && ctx.meteorologia.atual
      ? `\n🌤️ **Mar & Tempo:** ${ctx.meteorologia.atual.ventoTexto} · Vaga ${ctx.meteorologia.atual.vagaTexto || '--'} · Água ${ctx.meteorologia.atual.tempAguaTexto || '--'} · Maré ${ctx.meteorologia.atual.mare.estado}` +
        `\n🎣 **Atividade Agora:** ${ctx.meteorologia.atual.indicePesca}% (${ctx.meteorologia.atual.nivelPesca})` +
        (ctx.meteorologia.janelasHoje?.length
          ? `\n🔥 **Melhores Janelas Hoje:** ${ctx.meteorologia.janelasHoje.map((j) => `${j.horario} (${j.indice}% ${j.motivo})`).join(' | ')}`
          : '')
      : '';

    if (!registos || registos.length === 0) {
      return (
        `Ainda não tens registos no Diário de Pesca.\n\n` +
        `📍 **Contexto Atual:** ${ctx.dataHoje} · ${ctx.faseLuaAtual}${meteoBloco}\n\n` +
        `💡 **Sugestão:** Cria alguns registos no botão "📓 Diário -> ➕ Novo Registo" (espécie, arte, maré e lembrete) para que o motor offline possa cruzar a lua, a época e os teus pesqueiros.`
      );
    }

    // Filtrar por espécie mencionada na pergunta, se houver
    const especiesConhecidas = ['lula', 'choco', 'pargo', 'safia', 'robalo', 'polvo', 'dourada', 'sargo', 'besugo', 'carapau', 'cavala'];
    const especiePedida = especiesConhecidas.find((esp) => q.includes(esp)) || null;

    const baseRegistos = especiePedida
      ? registos.filter((r) => `${r.especie} ${r.arte} ${r.lembrete}`.toLowerCase().includes(especiePedida))
      : registos;

    const candidatos = baseRegistos.length > 0 ? baseRegistos : registos;

    // Pontuar registos por relevância atual (lua, mês, qualidade, proximidade)
    const pontuados = candidatos.map((r) => {
      let score = 0;
      const motivos = [];
      if (r.qualidade === 'boa') {
        score += 3;
        motivos.push('Boa captura');
      }
      if (r.faseLua && luaAtualNome && r.faseLua.toLowerCase() === luaAtualNome.toLowerCase()) {
        score += 3;
        motivos.push(`Mesma lua (${r.faseLua})`);
      }
      const mesReg = Number(String(r.data || '').split('-')[1]);
      if (mesReg === mesAtual) {
        score += 2;
        motivos.push('Mesma época/mês');
      }
      let distKm = null;
      if (ctx.posicaoAtual && Number.isFinite(r.lat) && Number.isFinite(r.lon) && window.DiarioPesca) {
        distKm = window.DiarioPesca.calcularDistanciaMetros(ctx.posicaoAtual.lat, ctx.posicaoAtual.lon, r.lat, r.lon) / 1000;
        if (distKm <= 5) {
          score += 2;
          motivos.push(`Perto (${distKm.toFixed(1)} km)`);
        }
      }
      return { r, score, motivos, distKm };
    });

    pontuados.sort((a, b) => b.score - a.score);

    // Estatísticas gerais (para Análise ou Sugestão)
    const contEspecies = {};
    const contArtes = {};
    const contMares = {};
    const contLuas = {};

    candidatos.forEach((r) => {
      if (r.especie) contEspecies[r.especie] = (contEspecies[r.especie] || 0) + 1;
      if (r.arte) contArtes[r.arte] = (contArtes[r.arte] || 0) + 1;
      if (r.mare) contMares[r.mare] = (contMares[r.mare] || 0) + 1;
      if (r.faseLua) contLuas[r.faseLua] = (contLuas[r.faseLua] || 0) + 1;
    });

    const topKey = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
    const topEsp = topKey(contEspecies);
    const topArte = topKey(contArtes);
    const topMare = topKey(contMares);
    const topLua = topKey(contLuas);

    // Lembretes futuros relevantes
    const lembretes = registos
      .filter((r) => r.lembrete || r.lembreteData)
      .slice(0, 5);

    // Resposta adaptada ao tipo de pedido
    if (q.includes('plano') || q.includes('próxima saída') || q.includes('proxima saida')) {
      const linhasLemb = lembretes.length
        ? lembretes.map((r) => `• **${r.pesqueiro}** (${r.lembreteData || 'Sem data'}): ${r.lembrete || r.especie}`).join('\n')
        : '• Sem lembretes futuros agendados ainda.';
      const top1 = pontuados[0]?.r;
      return (
        `🔮 **Plano Offline para a Próxima Saída** (${ctx.dataHoje} · ${ctx.faseLuaAtual})\n\n` +
        `**1. Lembretes da Memória Futura:**\n${linhasLemb}\n\n` +
        `**2. Pesqueiro Prioritário para Hoje:**\n` +
        (top1
          ? `• **${top1.pesqueiro}** — Último sucesso: ${top1.especie} (${top1.quantidade || '-'}) com **${top1.arte || 'arte habitual'}** na maré **${top1.mare || '-'}**.`
          : '• Sem dados suficientes.') +
        `\n\n**3. Preparação Recomendada:**\n` +
        `• Arte principal: **${topArte ? topArte[0] : 'Toneiras / Cana'}**\n` +
        `• Melhor maré histórica: **${topMare ? topMare[0] : 'Enchente'}**`
      );
    }

    if (q.includes('analisa') || q.includes('padr') || q.includes('resum')) {
      return (
        `📊 **Análise Offline do Diário** (${candidatos.length} registos${especiePedida ? ` de ${especiePedida}` : ''})\n\n` +
        `• **Espécie mais frequente:** ${topEsp ? `${topEsp[0]} (${topEsp[1]}x)` : '-'}\n` +
        `• **Arte mais produtiva:** ${topArte ? `${topArte[0]} (${topArte[1]}x)` : '-'}\n` +
        `• **Maré dominante:** ${topMare ? `${topMare[0]} (${topMare[1]}x)` : '-'}\n` +
        `• **Fase lunar com mais registos:** ${topLua ? `${topLua[0]} (${topLua[1]}x)` : '-'}\n\n` +
        `**Top 3 Pesqueiros:**\n` +
        pontuados
          .slice(0, 3)
          .map((p, i) => `${i + 1}. **${p.r.pesqueiro}** — ${p.r.especie} (${p.r.quantidade || '-'}) · ${p.r.arte || '-'} [${p.motivos.join(', ') || p.r.data}]`)
          .join('\n')
      );
    }

    // Default: Sugerir Pesqueiro Hoje / Pergunta Livre
    const top3 = pontuados.slice(0, 3);
    return (
      `🎯 **Recomendação Offline para Hoje** (${ctx.dataHoje} · ${ctx.faseLuaAtual})\n\n` +
      top3
        .map(
          (p, i) =>
            `${i + 1}. **${p.r.pesqueiro}**${p.distKm !== null ? ` (${p.distKm.toFixed(1)} km)` : ''}\n` +
            `   🐟 ${p.r.especie} ${p.r.quantidade ? `(${p.r.quantidade})` : ''} · 🎣 ${p.r.arte || '-'} · 🌊 Maré ${p.r.mare || '-'}\n` +
            `   📌 Motivos: ${p.motivos.length ? p.motivos.join(' · ') : `Registo de ${p.r.data}`}` +
            (p.r.lembrete ? `\n   🔮 Lembrete: ${p.r.lembrete}` : '')
        )
        .join('\n\n') +
      `\n\n💡 **Padrão Geral:** Arte **${topArte ? topArte[0] : '-'}** na maré **${topMare ? topMare[0] : '-'}**.` +
      (meteoBloco ? `\n${meteoBloco}` : '')
    );
  }

  // ==========================================
  // EXECUÇÃO EM 3 NÍVEIS
  // ==========================================
  function formatarTextoRespostaHtml(texto) {
    return escaparHtml(texto)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');
  }

  function mostrarResposta(texto, nivel) {
    const resEl = document.getElementById('agentePescaResposta');
    const badgeEl = document.getElementById('agentePescaNivelBadge');
    if (badgeEl) {
      if (nivel === 1) {
        badgeEl.textContent = '🟢 VigilanteAI (Local)';
        badgeEl.className = 'agente-nivel-badge nivel-1';
      } else {
        badgeEl.textContent = '🟡 Motor Offline (No Mar)';
        badgeEl.className = 'agente-nivel-badge nivel-2';
      }
      badgeEl.style.display = 'inline-block';
    }
    if (resEl) {
      resEl.innerHTML = formatarTextoRespostaHtml(texto);
    }
  }

  async function perguntarAgente(perguntaTexto) {
    const pergunta = (perguntaTexto || '').trim();
    if (!pergunta) {
      notificar('✏️ Escreve uma pergunta ou usa um botão rápido.');
      return;
    }

    const inp = document.getElementById('agentePescaInput');
    if (inp && inp.value !== pergunta) inp.value = pergunta;

    const resEl = document.getElementById('agentePescaResposta');
    const badgeEl = document.getElementById('agentePescaNivelBadge');
    if (badgeEl) badgeEl.style.display = 'none';
    if (resEl) resEl.innerHTML = `<span style="color:#93c5fd;">⏳ A contactar VigilanteAI...</span>`;

    const ctx = obterContextoAtual();
    const registos = obterTodosRegistos();
    const url = obterEndpointChat();
    const promptCompleto = formatarPromptCompleto(pergunta, ctx);

    // Nível 1: Tentar VigilanteAI local/LAN
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: promptCompleto,
          contexto_pesca: ctx
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);

      if (resp.ok) {
        const dados = await resp.json();
        if (dados && dados.resposta) {
          mostrarResposta(dados.resposta, 1);
          return;
        }
      }
    } catch (_) {
      // Falhou rede/CORS/timeout -> fallback automático para Nível 2
    }

    // Nível 2: Motor Offline em JS
    const respostaOffline = analisarDiarioOffline(pergunta, ctx, registos);
    mostrarResposta(respostaOffline, 2);
  }

  // Nível 3: Copiar para PocketPal / Gemini
  async function copiarParaIaExterna() {
    const inp = document.getElementById('agentePescaInput');
    const pergunta = (inp?.value || '').trim() || 'Qual o melhor pesqueiro, arte e estratégia para hoje com base no meu Diário de Pesca?';
    const ctx = obterContextoAtual();
    const texto = formatarPromptCompleto(pergunta, ctx);

    try {
      await navigator.clipboard.writeText(texto);
      notificar('📋 Pergunta + Diário copiados! Cola no PocketPal AI ou Gemini.');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        notificar('📋 Pergunta + Diário copiados! Cola no PocketPal AI ou Gemini.');
      } catch (e) {
        notificar('⚠️ Não foi possível copiar automaticamente.');
      }
      document.body.removeChild(ta);
    }
  }

  // ==========================================
  // CONSTRUÇÃO DA UI & DEFINIÇÕES
  // ==========================================
  function construirPainelHtml() {
    if (document.getElementById('agentePescaPainel')) return;

    const painel = document.createElement('aside');
    painel.id = 'agentePescaPainel';
    painel.className = 'agente-pesca-painel';
    painel.style.display = 'none';
    painel.innerHTML = `
      <div class="agente-header">
        <div class="agente-header-titulo">🤖 Agente IA de Pesca</div>
        <button type="button" id="btnFecharAgentePesca" class="diario-btn-fechar">✖</button>
      </div>

      <div class="agente-body">
        <div class="agente-rapidos">
          <button type="button" class="agente-btn-rapido" data-pergunta="Sugere o melhor pesqueiro, isco e estratégia para hoje cruzando a data, fase da lua, maré e o meu Diário.">🎯 Sugerir Pesqueiro Hoje</button>
          <button type="button" class="agente-btn-rapido" data-pergunta="Analisa o meu Diário de Pesca e resume os padrões de capturas por lua, maré, arte e época.">📊 Analisar o Meu Diário</button>
          <button type="button" class="agente-btn-rapido" data-pergunta="Lê os lembretes da Memória Futura e prepara um plano prático para a próxima saída de pesca.">🔮 Plano para a Próxima Saída</button>
        </div>

        <div class="agente-input-wrap">
          <textarea id="agentePescaInput" rows="2" placeholder="Escreve uma pergunta (ex: Qual o melhor pesqueiro e isco para lula hoje?)"></textarea>
          <div class="agente-acoes-envio">
            <button type="button" id="btnEnviarAgentePesca" class="agente-btn-enviar">🚀 Perguntar à IA</button>
            <button type="button" id="btnCopiarIaExterna" class="agente-btn-copiar" title="Copiar para PocketPal AI ou Gemini">📋 Copiar Pergunta + Diário para IA</button>
          </div>
        </div>

        <div class="agente-resp-wrap">
          <span id="agentePescaNivelBadge" class="agente-nivel-badge" style="display:none;"></span>
          <div id="agentePescaResposta" class="agente-resposta">
            Escolhe um botão rápido acima ou escreve a tua pergunta. Em casa liga ao <b>VigilanteAI</b>; no mar ativa automaticamente o <b>Motor Offline</b>.
          </div>
        </div>
      </div>
    `;

    document.getElementById('app-container')?.appendChild(painel);

    document.getElementById('btnFecharAgentePesca').addEventListener('click', () => alternarPainel(false));
    document.getElementById('btnEnviarAgentePesca').addEventListener('click', () => {
      perguntarAgente(document.getElementById('agentePescaInput').value);
    });
    document.getElementById('btnCopiarIaExterna').addEventListener('click', copiarParaIaExterna);
    document.querySelectorAll('.agente-btn-rapido').forEach((btn) => {
      btn.addEventListener('click', () => perguntarAgente(btn.dataset.pergunta));
    });
  }

  function configurarDefinicoesVigilante() {
    const inp = document.getElementById('inputVigilanteAiUrl');
    const btnGuardar = document.getElementById('btnGuardarVigilanteAiUrl');
    if (!inp) return;
    inp.value = obterUrlVigilante();
    if (btnGuardar) {
      btnGuardar.addEventListener('click', () => {
        const salva = guardarUrlVigilante(inp.value);
        inp.value = salva;
        notificar('⚙️ Endereço do VigilanteAI guardado.');
      });
    }
    inp.addEventListener('change', () => guardarUrlVigilante(inp.value));
  }

  function alternarPainel(forcarEstado) {
    const painel = document.getElementById('agentePescaPainel');
    if (!painel) return;
    const abrir = typeof forcarEstado === 'boolean' ? forcarEstado : painel.style.display === 'none';

    if (abrir) {
      if (typeof window.alternarPastaEventos === 'function') window.alternarPastaEventos(false);
      if (window.DiarioPesca && typeof window.DiarioPesca.alternarPainel === 'function') {
        window.DiarioPesca.alternarPainel(false);
      }
      painel.style.display = 'flex';
    } else {
      painel.style.display = 'none';
    }
  }

  function inicializar() {
    construirPainelHtml();
    configurarDefinicoesVigilante();
  }

  window.AgentePescaUI = {
    alternarPainel,
    perguntarAgente,
    copiarParaIaExterna,
    obterUrlVigilante,
    guardarUrlVigilante
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
