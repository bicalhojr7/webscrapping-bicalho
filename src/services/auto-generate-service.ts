import type { LeadRecord } from "../domain/lead.js";

// ────────────────────────────────────────────────────────────────────────────
// Mapeamento de setores → paleta de cores e diretrizes visuais
// ────────────────────────────────────────────────────────────────────────────

export type BusinessSector =
  | "restaurante"
  | "barbearia"
  | "clinica"
  | "academia"
  | "mecanica"
  | "juridico"
  | "construcao"
  | "imobiliaria"
  | "beleza"
  | "educacao"
  | "tecnologia"
  | "neutro";

interface SectorProfile {
  label: string;
  heroTagline: string;
  palette: string;
  imageContext: string;
  copyTone: string;
}

const SECTOR_PROFILES: Record<BusinessSector, SectorProfile> = {
  restaurante: {
    label: "Restaurante / Alimentação",
    heroTagline: "Sabor que transforma cada refeição numa experiência.",
    palette:
      "tons quentes e apetitosos: primário #C0392B (vermelho vinho), secundário #E67E22 (laranja), fundo #1A0A00 (marrom escuro), texto claro #FFF8F0. Transmite calor, apetite e aconchego.",
    imageContext:
      "fotografias de pratos gourmet em close, mesa bem posta com iluminação quente, ambiente do restaurante acolhedor. Qualidade editorial de revista gastronômica.",
    copyTone:
      "caloroso, sensorial, evoca experiência. Use palavras como 'sabor', 'ingredientes selecionados', 'momentos únicos'."
  },
  barbearia: {
    label: "Barbearia / Salão Masculino",
    heroTagline: "Estilo de respeito. Corte que define quem você é.",
    palette:
      "tema masculino premium: primário #1C1C1C (quase preto), secundário #B8960C (dourado), fundo #111111, texto #F5F5F5. Bordas e detalhes em dourado. Atmosfera de barbearia clássica americana.",
    imageContext:
      "ambiente de barbearia retro-clássica, cadeira vintage cromada, navalhas, produtos de barba premium, homem com corte impecável. Fotografia editorial masculina.",
    copyTone:
      "direto, confiante, viril. Use 'estilo', 'precisão', 'tradição', 'experiência premium'."
  },
  clinica: {
    label: "Clínica / Consultório / Saúde",
    heroTagline: "Sua saúde em boas mãos. Cuidado com quem você merece.",
    palette:
      "tons limpos de saúde: primário #0077B6 (azul profissional), secundário #48CAE4 (azul claro), fundo branco #FAFBFC, texto #1D3557. Transmite confiança, higiene e tecnicidade.",
    imageContext:
      "consultório moderno e limpo, médico ou profissional de saúde sorrindo, equipamentos modernos de fundo. Lighting claro e clínico. Fotografia profissional de saúde.",
    copyTone:
      "acolhedor mas técnico. Use 'cuidado personalizado', 'saúde em primeiro lugar', 'profissionais experientes', 'tecnologia de ponta'."
  },
  academia: {
    label: "Academia / Fitness / Personal",
    heroTagline: "Seu corpo. Sua transformação. Seus resultados.",
    palette:
      "energético e dark: primário #FF4500 (laranja intenso), secundário #222222, fundo #0D0D0D (preto absoluto), texto #FFFFFF e #FF4500 para destaques. Alta energia e adrenalina.",
    imageContext:
      "pessoas malhando com intensidade, pesos e equipamentos, ambiente de academia moderno, transformação corporal. Fotografia com alto contraste e energia.",
    copyTone:
      "motivador, direto, desafiador. Use 'transformação', 'disciplina', 'resultados reais', 'evolução', 'superação'."
  },
  mecanica: {
    label: "Mecânica / Oficina / Auto",
    heroTagline: "Diagnóstico preciso. Serviço que você pode confiar.",
    palette:
      "industrial robusto: primário #F39C12 (amarelo industrial), secundário #2C3E50 (cinza escuro aço), fundo #1A1A1A, texto #F5F5F5. Transmite robustez e confiança técnica.",
    imageContext:
      "ferramentas bem cuidadas em bancada, carro sendo revisado em elevador, técnico com EPI em ambiente limpo. Fotografia industrial profissional.",
    copyTone:
      "técnico mas acessível. Use 'diagnóstico preciso', 'garantia de serviço', 'revisão completa', 'atendimento rápido'."
  },
  juridico: {
    label: "Advocacia / Contabilidade / Jurídico",
    heroTagline: "Seus direitos protegidos. Nossa experiência. Sua segurança.",
    palette:
      "formal e premium: primário #1A237E (azul marinho escuro), secundário #B8860B (dourado), fundo #FAFAFA (quase branco), texto #1A1A1A. Transmite autoridade, seriedade e confiança.",
    imageContext:
      "mesa de madeira escura com cadernos e caneta mont blanc, estante de livros jurídicos, advogado em terno em escritório minimalista. Fotografia corporativa premium.",
    copyTone:
      "formal e autoritativo. Use 'experiência comprovada', 'resultado garantido', 'excelência jurídica', 'compromisso com a justiça'."
  },
  construcao: {
    label: "Construção / Reforma / Engenharia",
    heroTagline: "Do projeto à entrega. Construímos com quem entende.",
    palette:
      "robusto e confiável: primário #E67E22 (laranja construção), secundário #34495E (cinza ardósia), fundo #1C1C1C, texto #ECEFF1. Transmite solidez, expertise e confiabilidade.",
    imageContext:
      "obra moderna em andamento, trabalhador com capacete em estrutura, antes e depois de reforma premium, planta arquitetônica. Fotografia de engenharia e arquitetura.",
    copyTone:
      "sólido e técnico. Use 'fundação sólida', 'prazo cumprido', 'materiais premium', 'projeto personalizado', 'engenharia de confiança'."
  },
  imobiliaria: {
    label: "Imobiliária / Corretor de Imóveis",
    heroTagline: "O imóvel certo existe. Nós encontramos para você.",
    palette:
      "premium luxo: primário #2C3E50 (azul grafite), secundário #C9AA71 (bege dourado), fundo #FEFEF8 (off-white luxo), texto #1A1A1A. Sofisticado e confiável.",
    imageContext:
      "fachada de imóvel de alto padrão, interior sofisticado com design moderno, corretor com cliente em visita, panorama urbano de luxo. Fotografia imobiliária de alto padrão.",
    copyTone:
      "aspiracional e sofisticado. Use 'investimento seguro', 'exclusividade', 'lar dos seus sonhos', 'localização privilegiada'."
  },
  beleza: {
    label: "Salão / Estética / Nail Art / Sobrancelha",
    heroTagline: "Beleza que transforma. Arte que encanta.",
    palette:
      "feminino premium: primário #C2185B (rosa escuro elegante), secundário #F8BBD9 (rosa pêssego), fundo #FFF5F8 (branco rosado), texto #2D2D2D. Elegante, feminino e premium.",
    imageContext:
      "ambiente luxuoso de salão, produtos premium de beleza, resultado de tratamento antes e depois, profissional em ação com cliente satisfeita. Fotografia estética de alto padrão.",
    copyTone:
      "caloroso e inspirador. Use 'realce sua beleza', 'tratamento exclusivo', 'autoestima elevada', 'transformação completa'."
  },
  educacao: {
    label: "Escola / Curso / Educação",
    heroTagline: "Conhecimento que abre portas. Futuro que começa aqui.",
    palette:
      "inspirador e moderno: primário #2E86AB (azul confiança), secundário #F18F01 (laranja energia), fundo #F7F9FB, texto #1A1A2E. Transmite crescimento, otimismo e credibilidade.",
    imageContext:
      "alunos estudando com entusiasmo, professor dinâmico em sala moderna, certificados e conquistas, ambiente de aprendizado inovador. Fotografia educacional inspiradora.",
    copyTone:
      "motivador e acadêmico. Use 'transforme sua carreira', 'aprendizado prático', 'professores experts', 'resultados comprovados'."
  },
  tecnologia: {
    label: "TI / Software / Tecnologia / Reparos",
    heroTagline: "Soluções tecnológicas que simplificam o seu negócio.",
    palette:
      "tech dark: primário #00D2FF (ciano tech), secundário #7B2FBE (roxo inovação), fundo #0A0E1A (azul marinho escuro), texto #E8EAED. Moderno, inovador e confiável.",
    imageContext:
      "telas com código, hardware moderno, técnico trabalhando em servidor, dispositivos de última geração. Fotografia tech de revista especializada.",
    copyTone:
      "técnico e confiante. Use 'inovação', 'eficiência', 'solução completa', 'suporte especializado', 'tecnologia de ponta'."
  },
  neutro: {
    label: "Negócio em geral",
    heroTagline: "Profissionalismo e excelência em cada detalhe.",
    palette:
      "neutro premium: primário #2D2D2D (grafite), secundário #6B7280 (cinza médio), fundo #FFFFFF, texto #111111. Elegante, limpo e universal.",
    imageContext:
      "ambiente profissional moderno e limpo, equipe sorrindo e confiante, produto/serviço em destaque com boa iluminação. Fotografia corporativa clean.",
    copyTone:
      "profissional e direto. Use 'qualidade comprovada', 'atendimento personalizado', 'excelência no serviço', 'confie em quem entende'."
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Detector de setor por nome e tipo de negócio retornados pelo Google
// ────────────────────────────────────────────────────────────────────────────

const SECTOR_KEYWORDS: Record<BusinessSector, string[]> = {
  restaurante: [
    "restaurante", "lanchonete", "pizzaria", "churrascaria", "sushi", "padaria",
    "confeitaria", "delivery", "hamburger", "hamburguer", "café", "cafeteria",
    "bar", "boteco", "buffet", "food", "grill", "steakhouse", "salgaderia"
  ],
  barbearia: [
    "barbearia", "barba", "cabelereiro", "salão masculino", "navalha", "barber",
    "hair man", "estúdio masculino", "corte masculino", "barbershop"
  ],
  clinica: [
    "clínica", "clinica", "consultório", "consultorio", "médico", "medico",
    "dentista", "odontologia", "fisioterapia", "psicologia", "cardiologia",
    "dermatologia", "ortopedia", "pediatria", "nutrição", "nutricao",
    "farmácia", "farmacia", "saúde", "saude", "hospital", "laboratório", "laboratorio"
  ],
  academia: [
    "academia", "fitness", "personal", "crossfit", "musculação", "musculacao",
    "pilates", "yoga", "natação", "natacao", "ginástica", "ginastica",
    "spin", "funcional", "esporte", "sport"
  ],
  mecanica: [
    "mecânica", "mecanica", "oficina", "auto", "elétrica", "eletrica",
    "funilaria", "pintura automotiva", "alinhamento", "balanceamento",
    "freios", "suspensão", "suspensao", "troca de óleo", "troca de oleo"
  ],
  juridico: [
    "advocacia", "advogado", "advogada", "jurídico", "juridico", "escritório jurídico",
    "contabilidade", "contábil", "contabil", "contador", "contadora",
    "assessoria jurídica", "assessoria", "direito"
  ],
  construcao: [
    "construtora", "construção", "construcao", "reforma", "engenharia",
    "arquitetura", "obra", "pedreiro", "azulejista", "eletricista",
    "encanador", "pintor", "gesso", "drywall", "marmoraria", "serralheria"
  ],
  imobiliaria: [
    "imobiliária", "imobiliaria", "corretor", "corretora", "imóveis", "imoveis",
    "apartamento", "aluguel", "venda de imóvel", "loteamento"
  ],
  beleza: [
    "salão", "salao", "estética", "estetica", "beleza", "manicure", "pedicure",
    "sobrancelha", "cílios", "cilios", "depilação", "depilacao", "spa",
    "massagem", "nail", "unha", "maquiagem", "makeup"
  ],
  educacao: [
    "escola", "colégio", "colegio", "curso", "faculdade", "coaching",
    "treinamento", "capacitação", "capacitacao", "idioma", "inglês", "ingles",
    "reforço", "reforco", "aula", "educação", "educacao", "aprendizado"
  ],
  tecnologia: [
    "tecnologia", "software", "sistemas", "informática", "informatica",
    "computador", "notebook", "celular", "assistência técnica", "assistencia tecnica",
    "suporte técnico", "suporte tecnico", "ti ", "web", "desenvolvimento",
    "app", "aplicativo", "digital", "segurança", "seguranca", "rede"
  ],
  neutro: []
};

export function detectBusinessSector(
  companyName: string,
  businessType?: string
): BusinessSector {
  const searchText = `${companyName} ${businessType ?? ""}`.toLowerCase();

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS) as [BusinessSector, string[]][]) {
    if (sector === "neutro") continue;
    if (keywords.some((kw) => searchText.includes(kw))) {
      return sector;
    }
  }

  return "neutro";
}

// ────────────────────────────────────────────────────────────────────────────
// Montagem do prompt final baseado no setor detectado
// ────────────────────────────────────────────────────────────────────────────

export function buildAutoPrompt(lead: LeadRecord, hasCustomImage: boolean): string {
  const sector = detectBusinessSector(lead.companyName, lead.businessType);
  const profile = SECTOR_PROFILES[sector];

  const businessDescription = lead.editorialSummary
    ? `Descrição do Google: "${lead.editorialSummary}"`
    : `Tipo de negócio detectado: ${lead.businessType ?? profile.label}`;

  const imageInstruction = hasCustomImage
    ? `Foi enviada uma imagem de referência visual do negócio. Use-a como base para a identidade visual, cores e estilo.`
    : `NÃO foi enviada imagem. Use obrigatoriamente a paleta definida abaixo e gere imagens de stock ultra-realistas do Unsplash que se encaixem perfeitamente no contexto.`;

  return `
Você é um Engenheiro Front-end Sênior especializado em Landing Pages de alto padrão para PMEs brasileiras.

═══════════════════════════════════════════════════════
🏢 DADOS REAIS DO NEGÓCIO (GOOGLE BUSINESS)
═══════════════════════════════════════════════════════
Nome Oficial: ${lead.companyName}
${businessDescription}
Telefone/WhatsApp: ${lead.phoneNumber}
Setor Detectado: ${profile.label}

═══════════════════════════════════════════════════════
🎯 MISSÃO
═══════════════════════════════════════════════════════
Gere o código HTML COMPLETO de uma Landing Page profissional para ${lead.companyName}.
Objetivo de conversão: fazer o visitante clicar para falar no WhatsApp.
Hero Tagline sugerida (adapte ao negócio real): "${profile.heroTagline}"

═══════════════════════════════════════════════════════
🎨 IDENTIDADE VISUAL OBRIGATÓRIA
═══════════════════════════════════════════════════════
${imageInstruction}

Paleta de cores para este setor (${profile.label}):
${profile.palette}

Contexto de imagens de stock que devem ser usadas:
${profile.imageContext}

Tom de voz da copy:
${profile.copyTone}

═══════════════════════════════════════════════════════
📋 ESTRUTURA OBRIGATÓRIA DA PÁGINA
═══════════════════════════════════════════════════════
1. Header: Logo/nome + botão WhatsApp fixo no topo
2. Hero Section: Headline poderosa + subheadline + CTA principal WhatsApp
3. Benefícios/Diferenciais: 3-4 cards com ícones
4. Serviços: Lista dos principais serviços (deduza do setor e nome)
5. Prova Social: Depoimentos fictícios mas realistas + estrelas Google (5★)
6. Galeria/Portfólio: Imagens do Unsplash do contexto correto
7. CTA Final: Bloco forte de conversão para WhatsApp
8. Footer: Nome, telefone, direitos reservados

═══════════════════════════════════════════════════════
📐 REGRAS TÉCNICAS INQUEBRÁVEIS
═══════════════════════════════════════════════════════
- HTML ÚNICO, completo, com Tailwind CSS via CDN
- Responsivo (mobile-first)
- Nunca invente outro nome de marca além de: ${lead.companyName}
- WhatsApp number para CTAs: ${lead.phoneNumber}
- Máx width de containers: max-w-6xl mx-auto com padding lateral
- Fontes: Google Fonts (Inter ou similar sem serifa)
- Scrolling suave e micro-animações de entrada (opacity + transform)
- PROIBIDO HTML sem estilo, sem layout completo ou sem conteúdo real
- ENTREGUE SOMENTE O CÓDIGO HTML PURO. Sem comentários introdutórios, sem markdown, sem texto fora do HTML.
`.trim();
}
