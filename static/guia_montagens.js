/**
 * Guia Completo de Montagens de Pesca de Barco — Costa de Lagos / Algarve (100% Offline)
 * Chave localStorage para notas pessoais: gps_nautico_notas_montagens_v1
 */
(() => {
  const CHAVE_NOTAS_MONTAGENS = 'gps_nautico_notas_montagens_v1';

  const ESPECIES = [
    'Lula e Choco',
    'Dourada',
    'Sargo',
    'Pargo e Bica',
    'Robalo',
    'Safia e Besugo',
    'Cavala e Carapau',
    'Polvo',
    'Corvina'
  ];

  const TECNICAS = [
    'Pesca ao Fundo / Chumbadinha',
    'Aparelho de 2 e 3 Anzóis',
    'Pesca à Lula com Toneiras/Palhaços',
    'Corrico Ligeiro',
    'Aparelho de Deriva / Boleia',
    'Palangre / Espinhel de Fundo'
  ];

  const MONTAGENS = [
    {
      id: 'lula_choco_toneiras',
      titulo: 'Lula e Choco — Toneira + Palhaço em Derivação',
      especie: 'Lula e Choco',
      tecnica: 'Pesca à Lula com Toneiras/Palhaços',
      tipoSvg: 'lula_palhacos',
      fundo: 'Areia, cascalho e bordas de pedra (10–35 m)',
      isca: 'Palhaço (Egi 2.5–3.0 laranja/rosa/branco) + Toneira chumbada na ponta (ou chumbada 40–80g)',
      mareIdeal: 'Enchente e estofo da preia-mar, ao amanhecer, entardecer ou noite',
      madre: '0,30 mm Mono (ou Multi 0,16 mm + chicote 0,30 mm)',
      destorcedor: '2 Destorcedores simples + 1 clip rápido para palhaço',
      estralho: '15–20 cm · 0,26 mm Fluorocarbono (ou ligação direta com nó de laçada)',
      anzol: 'Palhaço 2.5–3.0 + Toneira chumbada 30–60g',
      chumbada: 'Toneira chumbada na base (ou chumbada oliva 40–80g conforme deriva)',
      passos: [
        'Ata o chicote de 1,5 m de 0,30 mm à linha madre com destorcedor pequeno.',
        'A 50 cm acima da ponta, faz um nó de laçada (dropper loop) ou coloca um destorcedor triplo com estralho curto de 15–20 cm em fluorocarbono 0,26 mm.',
        'Engata o palhaço (tamanho 2.5 ou 3.0) no clip rápido desse estralho superior.',
        'Na extremidade inferior, prende uma toneira chumbada de 40–60g (ou chumbada pêra + 2.º palhaço a 25 cm).',
        'Pesca à deriva lenta (0,3–0,8 nós), dando toques suaves perto do fundo para a lula e arrastando ligeiramente para o choco.'
      ]
    },
    {
      id: 'dourada_fundo_2anzois',
      titulo: 'Dourada — Aparelho de Fundo de 2 Anzóis (Estralho Longo)',
      especie: 'Dourada',
      tecnica: 'Aparelho de 2 e 3 Anzóis',
      tipoSvg: 'fundo_2_3',
      numAnzois: 2,
      fundo: 'Areia grossa, cascalho e fundos mistos perto de pedra (8–28 m)',
      isca: 'Caranguejo verde inteiro, navalha (lingueirão), casulo, camarão ou amêijoa',
      mareIdeal: 'Enchente forte e primeiras horas da vazante (águas médias a vivas)',
      madre: '0,40 mm Monofilamento',
      destorcedor: 'Destorcedor de topo + 2 destorcedores triplos (ou cross-beads com missangas)',
      estralho: '70–100 cm · 0,33–0,35 mm Fluorocarbono',
      anzol: 'Anzol Chinu / Maruseigo Nº 1/0 a 2/0 (haste forte)',
      chumbada: 'Chumbada pirâmide ou pêra 60–120g em baixo',
      passos: [
        'Corta cerca de 1,6 m de linha 0,40 mm para a madre do aparelho e coloca um destorcedor forte no topo.',
        'Coloca o primeiro destorcedor triplo (ou missanga perfurada) a 30 cm do topo e o segundo a 15 cm acima da chumbada.',
        'Nos destorcedores, ata estralhos longos (70 a 100 cm) em fluorocarbono 0,35 mm para a dourada não desconfiar da chumbada.',
        'Empata anzóis fortes Nº 1/0 ou 2/0 (a dourada tem maxila muito dura).',
        'Prende uma chumbada de 60–120g na base; mantém a linha ligeiramente folgada no fundo para a dourada comer sem sentir peso.'
      ]
    },
    {
      id: 'sargo_chumbadinha_pedra',
      titulo: 'Sargo — Chumbadinha Ligeira na Pedra',
      especie: 'Sargo',
      tecnica: 'Pesca ao Fundo / Chumbadinha',
      tipoSvg: 'chumbadinha',
      fundo: 'Pedra alta, lajes e cabeços rochosos (6–25 m)',
      isca: 'Camarão, sardinha em posta, caranguejo, mexilhão ou minhoca americana',
      mareIdeal: 'Enchente com mar mexido/espuma ou estofo de preia-mar',
      madre: '0,35 mm Mono (ou Multi 0,14 mm + terminal 0,30 mm)',
      destorcedor: '1 Destorcedor simples nº 8 entre a madre e o estralho',
      estralho: '80–120 cm · 0,26–0,28 mm Fluorocarbono',
      anzol: 'Anzol Bico de Papagaio / Chinu Nº 2 a Nº 1',
      chumbada: 'Chumbada oliva passante 15–40g encostada ao destorcedor',
      passos: [
        'Passa uma chumbada oliva furada (15 a 40g, o mínimo para chegar ao fundo) diretamente pela linha madre.',
        'Coloca uma missanga de borracha para proteger o nó e ata um destorcedor simples.',
        'Do outro lado do destorcedor, ata um estralho único de 80–120 cm em fluorocarbono 0,26–0,28 mm.',
        'Empata um anzol Nº 2 ou Nº 1 bem afiado e esconde a ponta no isco (camarão descascado ou sardinha).',
        'Mantém o contacto direto com o fundo de pedra levantando 10 cm ao menor toque.'
      ]
    },
    {
      id: 'pargo_bica_fundo3',
      titulo: 'Pargo e Bica — Aparelho Reforçado de 3 Anzóis',
      especie: 'Pargo e Bica',
      tecnica: 'Aparelho de 2 e 3 Anzóis',
      tipoSvg: 'fundo_2_3',
      numAnzois: 3,
      fundo: 'Pedra funda, restinguas e cascalho largo (25–70 m)',
      isca: 'Sardinha fresca, lula em tiras, camarão inteiro com casca ou caranguejo',
      mareIdeal: 'Vazante e enchente moderada (águas mortas ou médias facilitam a prumada)',
      madre: '0,50 mm Monofilamento',
      destorcedor: 'Destorcedor rolamento no topo + 3 destorcedores triplos reforçados',
      estralho: '45–60 cm · 0,35–0,40 mm Fluorocarbono',
      anzol: 'Anzol Maruseigo / Octopus Nº 2/0 a 4/0',
      chumbada: 'Chumbada pêra ou torpedo 100–200g (conforme corrente e fundo)',
      passos: [
        'Prepara a madre com 2,0 m de nylon 0,50 mm e um destorcedor de rolamento no topo para evitar torções.',
        'Distribui 3 destorcedores triplos espaçados de 55 cm entre si, deixando 25 cm até à chumbada.',
        'Usa estralhos de 45–60 cm em fluorocarbono 0,35–0,40 mm para aguentar os arranques do pargo na pedra.',
        'Empata anzóis Nº 2/0 a 4/0; no anzol de baixo isca uma tira firme de lula ou sardinha atada com fio elástico.',
        'Prende chumbada de 100–200g com linha de fusível (0,30 mm) para não perder o aparelho todo se prender na pedra.'
      ]
    },
    {
      id: 'robalo_corrico_ligeiro',
      titulo: 'Robalo — Corrico Ligeiro de Costa / Ponta da Piedade',
      especie: 'Robalo',
      tecnica: 'Corrico Ligeiro',
      tipoSvg: 'corrico',
      fundo: 'Meia água junto a falésias, espumas e baixios de pedra (3–15 m)',
      isca: 'Amostra rígida (minnow 11–14 cm prateada/sardinha) ou vinil (raglou/shad) com chumbada ligeira',
      mareIdeal: 'Enchente matinal e final de tarde, com mar mexido ou água oxigenada',
      madre: '0,35 mm Mono ou Multi 0,16 mm',
      destorcedor: 'Destorcedor com alfinete (snap) forte + destorcedor a 2 m da amostra',
      estralho: '2,0–3,0 m · 0,33–0,35 mm Fluorocarbono (baixo invisível)',
      anzol: 'Fateixas da amostra ou Anzol Jig Head 15–25g no vinil',
      chumbada: 'Sem chumbada (amostra afundante) ou oliva de 20–40g a 2 m do vinil',
      passos: [
        'Ata um destorcedor simples na ponta da linha madre para absorver a torção da amostra.',
        'Coloca um baixo de 2,5 m em fluorocarbono 0,35 mm para manter total discrição em água limpa.',
        'Na ponta do baixo, coloca um clip rápido (sem destorcedor para não alterar o nado) e engata a amostra ou vinil.',
        'Se usares vinil, coloca uma chumbada oliva de 20–40g acima do destorcedor para baixar a 3–5 m.',
        'Navega a 2,5–3,5 nós paralelo às pontas de pedra, largando 35–50 m de linha atrás do barco.'
      ]
    },
    {
      id: 'robalo_boleia_deriva',
      titulo: 'Robalo — Aparelho de Deriva / Boleia com Isco Vivo ou Sardinha',
      especie: 'Robalo',
      tecnica: 'Aparelho de Deriva / Boleia',
      tipoSvg: 'deriva_boleia',
      fundo: 'Meia água / corrente sobre pedra e canais (5–20 m)',
      isca: 'Camarão vivo, cavala pequena viva, lula inteira ou meia sardinha',
      mareIdeal: 'Meia maré a encher ou vazar com corrente franca',
      madre: '0,35–0,40 mm Monofilamento',
      destorcedor: '1 Destorcedor simples + boia de correr (opcional) ou sem boia (boleia pura)',
      estralho: '1,5–2,2 m · 0,30–0,33 mm Fluorocarbono',
      anzol: 'Anzol Circle ou Octopus Nº 1/0 a 3/0',
      chumbada: 'Sem chumbada ou pequeno chumbo de fenda 5–15g no destorcedor',
      passos: [
        'Monta um destorcedor simples na madre (com ou sem pequeno chumbo de 5–15g consoante a corrente).',
        'Liga um estralho longo de 1,5–2,2 m em fluorocarbono 0,30–0,33 mm.',
        'Empata um anzol Nº 2/0 (ou montagem de 2 anzóis em tandem para sardinha/lula inteira).',
        'Isca o camarão vivo pelo dorso (sem ferir a mancha escura) ou a sardinha atada com fio elástico.',
        'Deixa derivar o isco livremente na corrente por trás do barco fundeado ou à deriva lenta, mantendo o carreto destravado/em espera.'
      ]
    },
    {
      id: 'safia_besugo_3anzois',
      titulo: 'Safia e Besugo — Aparelho Fino de 3 Anzóis (Pesca Ligeira)',
      especie: 'Safia e Besugo',
      tecnica: 'Aparelho de 2 e 3 Anzóis',
      tipoSvg: 'fundo_2_3',
      numAnzois: 3,
      fundo: 'Areia, vasa e bordas de cascalho (15–45 m)',
      isca: 'Camarão em pedaços, sardinha, lula em tirinhas finas ou minhoca',
      mareIdeal: 'Qualquer fase com corrente suave (excelente em águas mortas e médias)',
      madre: '0,32–0,35 mm Monofilamento',
      destorcedor: 'Destorcedor topo + 3 missangas perfuradas / micro-destorcedores triplos',
      estralho: '25–35 cm · 0,24–0,26 mm Fluorocarbono',
      anzol: 'Anzol Chinu / Cristal Nº 4 a Nº 2',
      chumbada: 'Chumbada pêra 50–100g na base',
      passos: [
        'Usa 1,5 m de nylon 0,32–0,35 mm para a madre.',
        'Coloca 3 micro-destorcedores triplos ou missangas de 4 furos espaçadas de 40 cm.',
        'Ata estralhos curtos de 25–35 cm em fluorocarbono fino 0,24–0,26 mm para transmitir rapidamente o toque.',
        'Empata anzóis Nº 4 a Nº 2 (ideais para a boca pequena da safia e do besugo).',
        'Isca pedaços pequenos de camarão ou lula; ferra ao primeiro tremor seco na ponta da cana.'
      ]
    },
    {
      id: 'cavala_carapau_deriva',
      titulo: 'Cavala e Carapau — Metralha / Pena em Deriva ou Meia Água',
      especie: 'Cavala e Carapau',
      tecnica: 'Aparelho de Deriva / Boleia',
      tipoSvg: 'deriva_boleia',
      fundo: 'Meia água e cardumes pelágicos (10–40 m)',
      isca: 'Penas/metralha (sabiki) de 3 a 5 anzóis ou tirinhas brancas de lula/cavala',
      mareIdeal: 'Amanhecer, entardecer e maré a encher com águas claras',
      madre: '0,35 mm Monofilamento',
      destorcedor: 'Destorcedor no topo + alfinete na base para chumbada/amostra',
      estralho: '12–15 cm · 0,28 mm Fluorocarbono (ramais espaçados de 25 cm)',
      anzol: 'Anzol Nº 6 a Nº 4 com pena branca/verde fluorescente',
      chumbada: 'Chumbada 40–80g ou amostra metálica (jig) 40g na ponta',
      passos: [
        'Ata o destorcedor superior da metralha à linha da cana.',
        'Verifica os 3 a 5 ramais curtos (12–15 cm em 0,28 mm) com penas brilhantes ou anzóis Nº 4–6 iscados com micro-tiras de lula.',
        'Prende uma chumbada de 40–80g (ou um jig metálico de 40g) no alfinete inferior.',
        'Baixa até à profundidade marcada na sonda onde está o cardume e faz movimentos verticais suaves (dente de serra).',
        'Quando sentires o primeiro peixe, aguarda 2–3 segundos antes de recolher para ferrar vários de uma vez.'
      ]
    },
    {
      id: 'polvo_fundo_chumbada',
      titulo: 'Polvo — Montagem Tradicional de Fundo (Pata/Caranguejo)',
      especie: 'Polvo',
      tecnica: 'Pesca ao Fundo / Chumbadinha',
      tipoSvg: 'polvo_toneira',
      fundo: 'Pedra baixa, cascalho e areia junto a rocha (8–30 m)',
      isca: 'Caranguejo branco/verde, sardinha ou cavala atada em toneira de polvo / arame',
      mareIdeal: 'Estofo e correntes fracas (águas mortas são excelentes)',
      madre: 'Multi 0,30 mm ou Linha de mão 0,80–1,00 mm',
      destorcedor: 'Destorcedor pesado (50 lb) com alfinete reforçado',
      estralho: '40 cm · 0,60 mm Monofilamento resistente à abrasão',
      anzol: 'Toneira de polvo (coroa de ganchos) + base chumbada 100–200g',
      chumbada: 'Chumbada integrada na toneira (100–200g) + pano branco atrativo',
      passos: [
        'Usa linha resistente (multifilar 0,30 mm na cana ou linha de mão 0,80–1,00 mm) com destorcedor reforçado.',
        'Liga um chicote anti-abrasão de 40 cm (0,60 mm) à toneira de polvo com coroa de ganchos.',
        'Amarra bem um caranguejo ou sardinha com fio elástico/arame fino sobre a base da toneira (podes juntar uma tira de pano branco).',
        'Deixa bater no fundo e vai levantando e pousando devagar enquanto o barco deriva lentamente.',
        'Quando sentires peso morto constante (como uma pedra elástica), dá um esticão firme e recolhe sem dar folga até ao barco.'
      ]
    },
    {
      id: 'corvina_fundo_estrangulado',
      titulo: 'Corvina — Aparelho Pesado de Fundo / Estralho Único',
      especie: 'Corvina',
      tecnica: 'Pesca ao Fundo / Chumbadinha',
      tipoSvg: 'chumbadinha',
      fundo: 'Canais de areia, vasa funda e bordas de laje (12–40 m)',
      isca: 'Lula inteira, choco inteiro pequeno, cavala viva/morta ou sardinhas em tandem',
      mareIdeal: 'Noite e crepúsculo durante a enchente ou vazante franca',
      madre: 'Multi 0,25–0,30 mm + chicote 0,50 mm',
      destorcedor: 'Destorcedor rolamento pesado (80 lb)',
      estralho: '120–150 cm · 0,45–0,50 mm Fluorocarbono',
      anzol: '2 Anzóis em tandem (Octopus 4/0 + 5/0) ou Circle 5/0',
      chumbada: 'Chumbada passante (ou em derivação) 80–150g',
      passos: [
        'Passa um clip deslizante (anti-embaraço) pela linha madre onde vais prender a chumbada de 80–150g.',
        'Protege o nó com missanga de borracha e ata um destorcedor de rolamento de 80 lb.',
        'Ata um estralho único longo (120–150 cm) de fluorocarbono 0,45–0,50 mm.',
        'Empata 2 anzóis em tandem (4/0 em cima e 5/0 na ponta) para segurar bem uma lula ou choco inteiro.',
        'Deixa a cana apoiada com a embraiagem afinada; deixa a corvina levar linha 2 segundos antes de ferrar firme.'
      ]
    },
    {
      id: 'palangre_espinhel_fundo',
      titulo: 'Pargo, Safia e Congro — Palangre / Espinhel Ligeiro de Fundo',
      especie: 'Pargo e Bica',
      tecnica: 'Palangre / Espinhel de Fundo',
      tipoSvg: 'palangre',
      fundo: 'Pedra plana, cascalho e fundos de areia (15–50 m)',
      isca: 'Sardinha em postas firmes, lula, cavala ou polvo em pedaços',
      mareIdeal: 'Lançar no estofo da maré e recolher após 1h30–2h30',
      madre: 'Cabo/Nylon 1,20–1,60 mm (madre principal)',
      destorcedor: 'Destorcedores de gancho (clips) a cada 2,5–3,0 m',
      estralho: '60–80 cm · 0,45–0,50 mm Monofilamento',
      anzol: 'Anzol Circle ou J-Hook Nº 1/0 a 3/0',
      chumbada: '2 Poitas/Pedras nas extremidades (2–3 kg) + boias de sinalização à superfície',
      passos: [
        'Prepara a linha madre (1,20–1,60 mm) com marcas/nós a cada 2,5–3,0 m para espaçar os estralhos e evitar emaranhados.',
        'Ata estralhos de 60–80 cm (0,45–0,50 mm) com anzóis Nº 1/0 a 3/0 em clips removíveis para facilitar o acondicionamento no cesto.',
        'Lança a primeira boia de sinalização com o cabo da poita inicial até assentar no fundo.',
        'Com o barco a avançar devagar contra a corrente, vai largando a madre esticada e engatando os estralhos já iscados.',
        'No final da madre, prende a segunda poita e a segunda boia de sinalização; respeita sempre a distância e o limite legal de anzóis da licença.'
      ]
    }
  ];

  // ==========================================
  // UTILITÁRIOS & NOTAS PESSOAIS (LOCALSTORAGE)
  // ==========================================
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
      clearTimeout(window.__toastMontagensTimer);
      window.__toastMontagensTimer = setTimeout(() => toast.classList.remove('visivel'), 3000);
    }
  }

  function lerNotas() {
    try {
      const raw = localStorage.getItem(CHAVE_NOTAS_MONTAGENS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function guardarNotas(notas) {
    try {
      localStorage.setItem(CHAVE_NOTAS_MONTAGENS, JSON.stringify(notas));
    } catch (_) {}
  }

  // ==========================================
  // GERADOR DE ESQUEMAS VISUAIS SVG (100% OFFLINE)
  // ==========================================
  function gerarSvgMontagem(m) {
    const fundoLabel = m.fundo.toLowerCase().includes('areia') && !m.fundo.toLowerCase().includes('pedra')
      ? '🏖️ Fundo de Areia'
      : m.fundo.toLowerCase().includes('meia água')
        ? '🌊 Meia Água'
        : '🪨 Fundo Pedra/Misto';

    if (m.tipoSvg === 'corrico') {
      return `
        <svg viewBox="0 0 340 130" class="montagem-svg" aria-label="Esquema de Corrico Ligeiro">
          <rect x="0" y="0" width="340" height="130" rx="8" fill="#071222"/>
          <path d="M0 24 Q 85 18 170 24 T 340 24" fill="none" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
          <text x="10" y="16" fill="#7dd3fc" font-size="9" font-weight="700">🌊 Superfície / Meia Água</text>
          <!-- Cana / Madre -->
          <line x1="22" y1="62" x2="128" y2="62" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="72" y="53" fill="#bae6fd" font-size="8.5" text-anchor="middle">Madre ${escaparHtml(m.madre.split(' ')[0])}</text>
          <!-- Destorcedor -->
          <circle cx="134" cy="62" r="5" fill="#fbbf24" stroke="#0f172a" stroke-width="1.5"/>
          <text x="134" y="82" fill="#fcd34d" font-size="8" text-anchor="middle">Destorcedor</text>
          <!-- Estralho FC -->
          <line x1="140" y1="62" x2="255" y2="62" stroke="#34d399" stroke-width="2" stroke-dasharray="4,2"/>
          <text x="198" y="53" fill="#6ee7b7" font-size="8.5" text-anchor="middle">2,5m FC 0,35mm</text>
          <!-- Amostra -->
          <ellipse cx="282" cy="62" rx="22" ry="8" fill="#f97316" stroke="#fed7aa" stroke-width="1.2"/>
          <polygon points="304,62 314,56 314,68" fill="#fdba74"/>
          <circle cx="268" cy="60" r="2" fill="#0f172a"/>
          <text x="284" y="84" fill="#fdba74" font-size="8.5" text-anchor="middle">Amostra / Vinil</text>
          <text x="170" y="116" fill="#94a3b8" font-size="8.5" text-anchor="middle">${fundoLabel} · Vel. 2,5–3,5 nós</text>
        </svg>
      `;
    }

    if (m.tipoSvg === 'palangre') {
      return `
        <svg viewBox="0 0 340 165" class="montagem-svg" aria-label="Esquema de Palangre de Fundo">
          <rect x="0" y="0" width="340" height="165" rx="8" fill="#071222"/>
          <path d="M0 24 Q 85 19 170 24 T 340 24" fill="none" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
          <!-- Boias -->
          <circle cx="34" cy="24" r="7" fill="#ef4444" stroke="#fecaca" stroke-width="1.2"/>
          <circle cx="306" cy="24" r="7" fill="#ef4444" stroke="#fecaca" stroke-width="1.2"/>
          <text x="34" y="13" fill="#fca5a5" font-size="8" text-anchor="middle">Boia</text>
          <text x="306" y="13" fill="#fca5a5" font-size="8" text-anchor="middle">Boia</text>
          <!-- Cabos poita -->
          <line x1="34" y1="31" x2="46" y2="128" stroke="#94a3b8" stroke-width="1.8"/>
          <line x1="306" y1="31" x2="294" y2="128" stroke="#94a3b8" stroke-width="1.8"/>
          <!-- Poitas -->
          <rect x="38" y="128" width="16" height="10" rx="2" fill="#64748b"/>
          <rect x="286" y="128" width="16" height="10" rx="2" fill="#64748b"/>
          <text x="46" y="150" fill="#cbd5e1" font-size="8" text-anchor="middle">Poita</text>
          <text x="294" y="150" fill="#cbd5e1" font-size="8" text-anchor="middle">Poita</text>
          <!-- Madre Fundo -->
          <line x1="54" y1="126" x2="286" y2="126" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="170" y="142" fill="#bae6fd" font-size="8.5" text-anchor="middle">Madre 1,2–1,6mm (2,5–3m entre estralhos)</text>
          <!-- Estralhos e Anzóis -->
          ${[95, 145, 195, 245].map((x) => `
            <circle cx="${x}" cy="126" r="3.5" fill="#fbbf24"/>
            <line x1="${x}" y1="122" x2="${x + 12}" y2="95" stroke="#34d399" stroke-width="1.7"/>
            <path d="M${x + 12} 95 C ${x + 18} 95, ${x + 18} 86, ${x + 11} 86" fill="none" stroke="#f8fafc" stroke-width="1.6"/>
          `).join('')}
          <text x="170" y="75" fill="#6ee7b7" font-size="8.5" text-anchor="middle">Estralhos 60–80cm (0,45mm) + Anzóis 1/0–3/0</text>
          <line x1="0" y1="156" x2="340" y2="156" stroke="#475569" stroke-width="2"/>
        </svg>
      `;
    }

    if (m.tipoSvg === 'chumbadinha') {
      return `
        <svg viewBox="0 0 340 155" class="montagem-svg" aria-label="Esquema Chumbadinha">
          <rect x="0" y="0" width="340" height="155" rx="8" fill="#071222"/>
          <!-- Fundo -->
          <path d="M0 132 Q 55 122 110 132 T 220 130 T 340 134 L 340 155 L 0 155 Z" fill="#1e293b"/>
          <text x="14" y="147" fill="#94a3b8" font-size="8.5">${fundoLabel}</text>
          <!-- Madre -->
          <line x1="25" y1="55" x2="145" y2="90" stroke="#38bdf8" stroke-width="2.4"/>
          <text x="72" y="58" fill="#bae6fd" font-size="8.5">Madre</text>
          <!-- Chumbada oliva passante -->
          <ellipse cx="122" cy="83" rx="12" ry="7" transform="rotate(16 122 83)" fill="#94a3b8" stroke="#e2e8f0" stroke-width="1.2"/>
          <text x="112" y="68" fill="#e2e8f0" font-size="8" text-anchor="middle">Oliva passante</text>
          <!-- Missanga + Destorcedor -->
          <circle cx="141" cy="89" r="3" fill="#ef4444"/>
          <circle cx="149" cy="91" r="4.5" fill="#fbbf24"/>
          <text x="150" y="110" fill="#fcd34d" font-size="8" text-anchor="middle">Destorcedor</text>
          <!-- Estralho -->
          <line x1="154" y1="92" x2="275" y2="115" stroke="#34d399" stroke-width="2" stroke-dasharray="4,2"/>
          <text x="218" y="92" fill="#6ee7b7" font-size="8.5" text-anchor="middle">${escaparHtml(m.estrLongoCurto || 'Estralho 1m FC')}</text>
          <!-- Anzol -->
          <path d="M275 115 L 289 117 C 296 117, 296 106, 287 107" fill="none" stroke="#f8fafc" stroke-width="2"/>
          <text x="292" y="128" fill="#f8fafc" font-size="8.5" text-anchor="middle">Anzol</text>
        </svg>
      `;
    }

    if (m.tipoSvg === 'deriva_boleia') {
      return `
        <svg viewBox="0 0 340 140" class="montagem-svg" aria-label="Esquema Deriva e Boleia">
          <rect x="0" y="0" width="340" height="140" rx="8" fill="#071222"/>
          <path d="M0 24 Q 85 18 170 24 T 340 24" fill="none" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
          <text x="10" y="16" fill="#7dd3fc" font-size="8.5" font-weight="700">🌊 Corrente / Meia Água</text>
          <line x1="25" y1="68" x2="128" y2="68" stroke="#38bdf8" stroke-width="2.4"/>
          <text x="76" y="58" fill="#bae6fd" font-size="8.5" text-anchor="middle">Madre 0,35mm</text>
          <circle cx="134" cy="68" r="5" fill="#fbbf24"/>
          <text x="134" y="87" fill="#fcd34d" font-size="8" text-anchor="middle">Destorcedor</text>
          <line x1="140" y1="68" x2="274" y2="74" stroke="#34d399" stroke-width="2" stroke-dasharray="4,2"/>
          <text x="208" y="58" fill="#6ee7b7" font-size="8.5" text-anchor="middle">Estralho / Ramais FC</text>
          <path d="M274 74 L 288 74 C 296 74, 296 63, 287 64" fill="none" stroke="#f8fafc" stroke-width="2"/>
          <text x="285" y="92" fill="#f8fafc" font-size="8.5" text-anchor="middle">Anzol / Pena</text>
          <text x="170" y="122" fill="#94a3b8" font-size="8.5" text-anchor="middle">${fundoLabel}</text>
        </svg>
      `;
    }

    if (m.tipoSvg === 'polvo_toneira') {
      return `
        <svg viewBox="0 0 340 165" class="montagem-svg" aria-label="Esquema Polvo">
          <rect x="0" y="0" width="340" height="165" rx="8" fill="#071222"/>
          <path d="M0 138 Q 90 128 180 138 T 340 136 L 340 165 L 0 165 Z" fill="#1e293b"/>
          <text x="14" y="155" fill="#94a3b8" font-size="8.5">${fundoLabel}</text>
          <line x1="170" y1="14" x2="170" y2="54" stroke="#38bdf8" stroke-width="2.6"/>
          <text x="180" y="34" fill="#bae6fd" font-size="8.5">Madre Multi / 0,80mm</text>
          <circle cx="170" cy="58" r="5" fill="#fbbf24"/>
          <text x="182" y="61" fill="#fcd34d" font-size="8">Destorcedor 50lb</text>
          <line x1="170" y1="63" x2="170" y2="96" stroke="#34d399" stroke-width="2.2"/>
          <text x="180" y="82" fill="#6ee7b7" font-size="8.5">Chicote 40cm 0,60mm</text>
          <!-- Toneira Polvo -->
          <rect x="155" y="96" width="30" height="22" rx="5" fill="#94a3b8" stroke="#e2e8f0" stroke-width="1.2"/>
          <path d="M155 118 L 148 128 M170 118 L 170 130 M185 118 L 192 128" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
          <text x="170" y="143" fill="#fde68a" font-size="8.5" text-anchor="middle">Toneira Polvo + Isco (100–200g)</text>
        </svg>
      `;
    }

    if (m.tipoSvg === 'lula_palhacos') {
      return `
        <svg viewBox="0 0 340 185" class="montagem-svg" aria-label="Esquema Lula e Choco">
          <rect x="0" y="0" width="340" height="185" rx="8" fill="#071222"/>
          <path d="M0 160 Q 90 154 180 160 T 340 158 L 340 185 L 0 185 Z" fill="#1e293b"/>
          <text x="12" y="176" fill="#94a3b8" font-size="8.5">${fundoLabel}</text>
          <!-- Linha vertical -->
          <line x1="95" y1="14" x2="95" y2="132" stroke="#38bdf8" stroke-width="2.2"/>
          <text x="86" y="30" fill="#bae6fd" font-size="8.5" text-anchor="end">Madre</text>
          <!-- Destorcedor topo -->
          <circle cx="95" cy="36" r="4.5" fill="#fbbf24"/>
          <text x="106" y="39" fill="#fcd34d" font-size="8">Destorcedor</text>
          <!-- Destorcedor triplo + Palhaço -->
          <circle cx="95" cy="78" r="4.5" fill="#fbbf24"/>
          <line x1="99" y1="78" x2="175" y2="78" stroke="#34d399" stroke-width="2" stroke-dasharray="3,2"/>
          <text x="137" y="70" fill="#6ee7b7" font-size="8" text-anchor="middle">15–20cm · 0,26 FC</text>
          <ellipse cx="196" cy="78" rx="18" ry="6.5" fill="#fb7185" stroke="#fecdd3" stroke-width="1"/>
          <path d="M214 78 L 222 74 M214 78 L 222 82" stroke="#f8fafc" stroke-width="1.5"/>
          <text x="230" y="81" fill="#fda4af" font-size="8.5">Palhaço 2.5–3.0</text>
          <!-- Toneira Chumbada fundo -->
          <ellipse cx="95" cy="142" rx="10" ry="12" fill="#f59e0b" stroke="#fde68a" stroke-width="1.2"/>
          <path d="M88 153 L 84 159 M95 154 L 95 160 M102 153 L 106 159" stroke="#f8fafc" stroke-width="1.5"/>
          <text x="114" y="145" fill="#fde68a" font-size="8.5">Toneira Chumbada (40–60g)</text>
        </svg>
      `;
    }

    // Default: fundo_2_3 (Aparelho de 2 ou 3 anzóis)
    const num = m.numAnzois || 3;
    const ys = num === 2 ? [64, 114] : [50, 86, 122];
    return `
      <svg viewBox="0 0 340 190" class="montagem-svg" aria-label="Esquema Aparelho de Fundo">
        <rect x="0" y="0" width="340" height="190" rx="8" fill="#071222"/>
        <path d="M0 166 Q 90 158 180 166 T 340 164 L 340 190 L 0 190 Z" fill="#1e293b"/>
        <text x="12" y="181" fill="#94a3b8" font-size="8.5">${fundoLabel}</text>
        <!-- Madre vertical -->
        <line x1="88" y1="14" x2="88" y2="148" stroke="#38bdf8" stroke-width="2.4"/>
        <circle cx="88" cy="22" r="4.5" fill="#fbbf24"/>
        <text x="100" y="25" fill="#fcd34d" font-size="8">Destorcedor Topo · Madre ${escaparHtml(m.madre.split(' ')[0])}</text>
        <!-- Estralhos e anzóis -->
        ${ys.map((y, idx) => `
          <circle cx="88" cy="${y}" r="4" fill="#fbbf24"/>
          <line x1="92" y1="${y}" x2="205" y2="${y + 8}" stroke="#34d399" stroke-width="1.9" stroke-dasharray="3,2"/>
          <path d="M205 ${y + 8} L 218 ${y + 8} C 224 ${y + 8}, 224 ${y - 2}, 216 ${y - 1}" fill="none" stroke="#f8fafc" stroke-width="1.8"/>
          ${idx === 0 ? `<text x="150" y="${y - 4}" fill="#6ee7b7" font-size="8" text-anchor="middle">${escaparHtml(m.estralho.split('(')[0])}</text>` : ''}
          <text x="230" y="${y + 10}" fill="#f8fafc" font-size="8">Anzol ${idx + 1}</text>
        `).join('')}
        <!-- Chumbada -->
        <polygon points="88,144 79,162 97,162" fill="#94a3b8" stroke="#e2e8f0" stroke-width="1.2"/>
        <text x="105" y="157" fill="#cbd5e1" font-size="8.5">${escaparHtml(m.chumbada.split('(')[0])}</text>
      </svg>
    `;
  }

  // ==========================================
  // INTERFACE HTML & ESTILOS SCOPED
  // ==========================================
  const estado = {
    painelAberto: false,
    aba: 'guia', // 'guia' | 'notas'
    filtroTexto: '',
    filtroEspecie: 'Todas',
    filtroTecnica: 'Todas',
    notas: []
  };

  function injetarEstilos() {
    if (document.getElementById('guiaMontagensCss')) return;
    const style = document.createElement('style');
    style.id = 'guiaMontagensCss';
    style.textContent = `
      .montagens-painel {
        position: fixed;
        top: 64px;
        right: 10px;
        width: 440px;
        max-width: calc(100vw - 20px);
        max-height: calc(100vh - 130px);
        background: rgba(9, 16, 29, 0.98);
        border: 1px solid #334155;
        border-radius: 12px;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.78);
        z-index: 1680;
        display: none;
        flex-direction: column;
        overflow: hidden;
        color: #f8fafc;
        font-family: system-ui, sans-serif;
      }
      @media (max-width: 480px) {
        .montagens-painel {
          top: calc(var(--safe-top, 0px) + 84px);
          left: 8px;
          right: 8px;
          width: auto;
          max-width: none;
          max-height: calc(100vh - var(--safe-top, 0px) - var(--safe-bottom, 0px) - 150px);
        }
      }
      .montagens-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: #1e293b;
        border-bottom: 1px solid #334155;
        gap: 8px;
        flex-shrink: 0;
      }
      .montagens-tabs {
        display: flex;
        gap: 6px;
        padding: 8px 12px 0;
        background: #0f172a;
        border-bottom: 1px solid #334155;
        flex-shrink: 0;
      }
      .montagem-tab-btn {
        flex: 1;
        padding: 7px 10px;
        border: none;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .montagem-tab-btn.ativo {
        color: #38bdf8;
        border-bottom-color: #38bdf8;
      }
      .montagens-body {
        padding: 10px 12px 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .montagens-filtros {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .montagens-filtros-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .montagens-input, .montagens-select, .montagens-textarea {
        width: 100%;
        box-sizing: border-box;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 7px 9px;
        font-size: 12px;
        font-family: inherit;
      }
      .montagem-card {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .montagem-card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .montagem-card-titulo {
        font-size: 13.5px;
        font-weight: 800;
        color: #f8fafc;
      }
      .montagem-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .montagem-badge {
        font-size: 10.5px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.14);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #7dd3fc;
      }
      .montagem-badge.tec {
        background: rgba(251, 191, 36, 0.14);
        border-color: rgba(251, 191, 36, 0.4);
        color: #fde68a;
      }
      .montagem-svg {
        width: 100%;
        height: auto;
        display: block;
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 8px;
      }
      .montagem-specs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        font-size: 11px;
      }
      .montagem-spec-box {
        background: #0b1220;
        border: 1px solid rgba(51, 65, 85, 0.7);
        border-radius: 7px;
        padding: 6px 7px;
      }
      .montagem-spec-box b {
        display: block;
        color: #94a3b8;
        font-size: 10px;
        margin-bottom: 2px;
      }
      .montagem-passos {
        margin: 0;
        padding-left: 18px;
        font-size: 11.5px;
        color: #cbd5e1;
        line-height: 1.45;
      }
      .montagem-passos li {
        margin-bottom: 3px;
      }
      .montagem-nota-form {
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .montagem-nota-card {
        background: #0b1220;
        border: 1px solid #334155;
        border-radius: 9px;
        padding: 9px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .montagem-nota-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .montagem-btn-del {
        background: rgba(239, 68, 68, 0.16);
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #fca5a5;
        border-radius: 6px;
        padding: 2px 7px;
        font-size: 11px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function construirPainelHtml() {
    if (document.getElementById('guiaMontagensPainel')) return;
    injetarEstilos();

    const painel = document.createElement('aside');
    painel.id = 'guiaMontagensPainel';
    painel.className = 'montagens-painel';
    painel.innerHTML = `
      <div class="montagens-header">
        <div style="font-weight:800;font-size:13.5px;">🎣 Guia de Montagens · Lagos / Algarve</div>
        <button type="button" id="btnFecharMontagens" class="diario-btn-fechar" title="Fechar">✖</button>
      </div>
      <div class="montagens-tabs">
        <button type="button" class="montagem-tab-btn ativo" data-aba="guia">📘 Montagens (Offline)</button>
        <button type="button" class="montagem-tab-btn" data-aba="notas">📝 Minhas Notas (<span id="montagensNotasCount">0</span>)</button>
      </div>
      <div id="montagensCorpo" class="montagens-body"></div>
    `;

    document.getElementById('app-container')?.appendChild(painel);
    document.getElementById('btnFecharMontagens').addEventListener('click', () => alternarPainel(false));
    painel.querySelectorAll('.montagem-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.aba = btn.dataset.aba;
        painel.querySelectorAll('.montagem-tab-btn').forEach((b) => b.classList.toggle('ativo', b === btn));
        renderizar();
      });
    });
  }

  function renderizarGuia(corpo) {
    const q = estado.filtroTexto.trim().toLowerCase();
    const filtradas = MONTAGENS.filter((m) => {
      if (estado.filtroEspecie !== 'Todas' && m.especie !== estado.filtroEspecie) return false;
      if (estado.filtroTecnica !== 'Todas' && m.tecnica !== estado.filtroTecnica) return false;
      if (q) {
        const blob = `${m.titulo} ${m.especie} ${m.tecnica} ${m.fundo} ${m.isca} ${m.mareIdeal}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    const especiesOpts = ['Todas', ...ESPECIES].map((e) =>
      `<option value="${escaparHtml(e)}" ${estado.filtroEspecie === e ? 'selected' : ''}>${e === 'Todas' ? '🐟 Todas as Espécies' : escaparHtml(e)}</option>`
    ).join('');
    const tecnicasOpts = ['Todas', ...TECNICAS].map((t) =>
      `<option value="${escaparHtml(t)}" ${estado.filtroTecnica === t ? 'selected' : ''}>${t === 'Todas' ? '⚙️ Todas as Técnicas' : escaparHtml(t)}</option>`
    ).join('');

    const cardsHtml = filtradas.length
      ? filtradas.map((m) => `
          <article class="montagem-card">
            <div class="montagem-card-head">
              <div class="montagem-card-titulo">${escaparHtml(m.titulo)}</div>
            </div>
            <div class="montagem-badges">
              <span class="montagem-badge">🐟 ${escaparHtml(m.especie)}</span>
              <span class="montagem-badge tec">⚙️ ${escaparHtml(m.tecnica)}</span>
            </div>
            ${gerarSvgMontagem(m)}
            <div class="montagem-specs">
              <div class="montagem-spec-box"><b>🧵 Linha Madre</b>${escaparHtml(m.madre)}</div>
              <div class="montagem-spec-box"><b>🔗 Destorcedores</b>${escaparHtml(m.destorcedor)}</div>
              <div class="montagem-spec-box"><b>📏 Estralhos</b>${escaparHtml(m.estralho)}</div>
              <div class="montagem-spec-box"><b>🪝 Anzóis &amp; Chumbada</b>${escaparHtml(m.anzol)} · ${escaparHtml(m.chumbada)}</div>
              <div class="montagem-spec-box"><b>🪨 Tipo de Fundo</b>${escaparHtml(m.fundo)}</div>
              <div class="montagem-spec-box"><b>🌊 Maré Ideal</b>${escaparHtml(m.mareIdeal)}</div>
            </div>
            <div class="montagem-spec-box" style="font-size:11px;">
              <b>🦐 Melhores Iscos</b>${escaparHtml(m.isca)}
            </div>
            <div>
              <div style="font-size:11px;font-weight:800;color:#fbbf24;margin-bottom:4px;">📋 Passo a passo como armar:</div>
              <ol class="montagem-passos">
                ${m.passos.map((p) => `<li>${escaparHtml(p)}</li>`).join('')}
              </ol>
            </div>
          </article>
        `).join('')
      : `<div style="text-align:center;color:#94a3b8;padding:24px;font-size:12.5px;">Nenhuma montagem encontrada para este filtro.</div>`;

    corpo.innerHTML = `
      <div class="montagens-filtros">
        <input type="text" id="inpBuscaMontagem" class="montagens-input" value="${escaparHtml(estado.filtroTexto)}" placeholder="🔍 Pesquisar espécie, fundo (pedra, areia), isco...">
        <div class="montagens-filtros-row">
          <select id="selEspecieMontagem" class="montagens-select">${especiesOpts}</select>
          <select id="selTecnicaMontagem" class="montagens-select">${tecnicasOpts}</select>
        </div>
      </div>
      <div style="font-size:11px;color:#94a3b8;">A mostrar <b>${filtradas.length}</b> de ${MONTAGENS.length} montagens (100% offline)</div>
      ${cardsHtml}
    `;

    document.getElementById('inpBuscaMontagem').addEventListener('input', (e) => {
      estado.filtroTexto = e.target.value || '';
      const pos = e.target.selectionStart;
      renderizarGuia(corpo);
      const inp = document.getElementById('inpBuscaMontagem');
      if (inp) {
        inp.focus();
        inp.setSelectionRange(pos, pos);
      }
    });
    document.getElementById('selEspecieMontagem').addEventListener('change', (e) => {
      estado.filtroEspecie = e.target.value;
      renderizarGuia(corpo);
    });
    document.getElementById('selTecnicaMontagem').addEventListener('change', (e) => {
      estado.filtroTecnica = e.target.value;
      renderizarGuia(corpo);
    });
  }

  function renderizarNotas(corpo) {
    const notasHtml = estado.notas.length
      ? estado.notas.map((n) => `
          <div class="montagem-nota-card">
            <div class="montagem-nota-head">
              <strong style="font-size:12.5px;color:#f8fafc;">${escaparHtml(n.titulo)}</strong>
              <button type="button" class="montagem-btn-del" data-id="${escaparHtml(n.id)}">🗑️ Apagar</button>
            </div>
            <div style="font-size:11px;color:#7dd3fc;">🐟 ${escaparHtml(n.especie || 'Geral')} · 🧵 ${escaparHtml(n.afina || '--')}</div>
            <div style="font-size:11.5px;color:#cbd5e1;white-space:pre-wrap;">${escaparHtml(n.texto)}</div>
            <div style="font-size:10px;color:#64748b;">Guardado em ${escaparHtml(n.data || '--')}</div>
          </div>
        `).join('')
      : `<div style="text-align:center;color:#94a3b8;padding:18px;font-size:12px;">Ainda sem notas pessoais. Regista aqui as tuas afinações de estralhos, anzóis ou chumbadas.</div>`;

    corpo.innerHTML = `
      <form id="formNotaMontagem" class="montagem-nota-form">
        <div style="font-size:12px;font-weight:800;color:#fbbf24;">➕ Nova Nota de Montagem</div>
        <input type="text" id="notaMontTitulo" class="montagens-input" placeholder="Título (ex: Dourada na Meia Praia)" required>
        <div class="montagens-filtros-row">
          <select id="notaMontEspecie" class="montagens-select">
            ${ESPECIES.map((e) => `<option value="${escaparHtml(e)}">${escaparHtml(e)}</option>`).join('')}
            <option value="Geral">Geral</option>
          </select>
          <input type="text" id="notaMontAfina" class="montagens-input" placeholder="Ex: FC 0,33 · Anzol 1/0 · 80g">
        </div>
        <textarea id="notaMontTexto" class="montagens-textarea" rows="3" placeholder="Detalhes da montagem, isco que funcionou, altura da maré..." required></textarea>
        <button type="submit" class="diario-btn-primario" style="align-self:flex-end;">💾 Guardar Nota Offline</button>
      </form>
      <div style="display:flex;flex-direction:column;gap:8px;">${notasHtml}</div>
    `;

    document.getElementById('formNotaMontagem').addEventListener('submit', (e) => {
      e.preventDefault();
      const titulo = document.getElementById('notaMontTitulo').value.trim();
      const especie = document.getElementById('notaMontEspecie').value;
      const afina = document.getElementById('notaMontAfina').value.trim();
      const texto = document.getElementById('notaMontTexto').value.trim();
      if (!titulo || !texto) return;

      estado.notas.unshift({
        id: `nota_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        titulo,
        especie,
        afina,
        texto,
        data: new Date().toLocaleDateString('pt-PT')
      });
      guardarNotas(estado.notas);
      atualizarContadorNotas();
      renderizarNotas(corpo);
      notificar('📝 Nota de montagem guardada offline.');
    });

    corpo.querySelectorAll('.montagem-btn-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        estado.notas = estado.notas.filter((n) => n.id !== id);
        guardarNotas(estado.notas);
        atualizarContadorNotas();
        renderizarNotas(corpo);
        notificar('🗑️ Nota removida.');
      });
    });
  }

  function atualizarContadorNotas() {
    const el = document.getElementById('montagensNotasCount');
    if (el) el.textContent = String(estado.notas.length);
  }

  function renderizar() {
    const corpo = document.getElementById('montagensCorpo');
    if (!corpo) return;
    atualizarContadorNotas();
    if (estado.aba === 'notas') renderizarNotas(corpo);
    else renderizarGuia(corpo);
  }

  function alternarPainel(forcarEstado) {
    const painel = document.getElementById('guiaMontagensPainel');
    if (!painel) return;
    const abrir = typeof forcarEstado === 'boolean' ? forcarEstado : painel.style.display !== 'flex';
    estado.painelAberto = abrir;
    painel.style.display = abrir ? 'flex' : 'none';
    if (abrir) renderizar();
  }

  function inicializar() {
    estado.notas = lerNotas();
    construirPainelHtml();
    atualizarContadorNotas();
  }

  window.GuiaMontagens = {
    alternarPainel,
    obterMontagens: () => MONTAGENS.slice()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
