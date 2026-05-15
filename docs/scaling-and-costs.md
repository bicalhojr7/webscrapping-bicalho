# Limites de APIs e Estrutura para SaaS B2B

Este documento descreve os custos, limites das APIs envolvidas e o plano arquitetônico para transformar o motor de prospecção (Bicalho Ads Lab) em um SaaS comercializável, onde outros usuários possam inserir suas próprias chaves e usar o produto.

## 1. Google Maps (Places API)
- **Custo Padrão:** A requisição *Text Search* ou *Nearby Search* custa em média $17 (dólares) a cada 1.000 requisições (cerca de R$ 85,00). 
- **Limites / Rotação:** O Google fornece **$200 de crédito gratuito todo mês**. Isso permite realizar aproximadamente **11.764 buscas gratuitas por mês**.
- **Para escalar no SaaS:** É muito volume. Um usuário comum não estoura isso sozinho. Porém, num modelo SaaS com múltiplos usuários, a barra de $200 acaba rápido. 
- **Modelo ideal:** No seu SaaS pago, o próprio usuário cola a própria `GOOGLE_API_KEY` na tela de configurações da ferramenta. Assim, o custo vai para o cartão dele, não o seu. (Se você tem o plano PRO ou Google Cloud credits, os limites são os mesmos, mas o faturamento é maior.)

## 2. GitHub
- **Custo Padrão:** O plano gratuito do GitHub (Free) permite repositórios ilimitados (públicos e privados).
- **Limites de Repositórios:** O limite rígido global para contas "comuns" chega na casa de **100.000 repositórios** no total, o que é praticamente inalcançável para geração de sites. O limite por repositório é de 5GB.
- **Limites de API (Geração via código):** 5.000 requisições por hora para usuários autenticados (usando o PAT - Personal Access Token). E 50 requisições por hora (sem chave).
- **Para escalar:** A chave `GITHUB_TOKEN` que roda nos bastidores vai aguentar a criação contínua, mas se outros clientes logarem, a Vercel pode bloquear o GitHub se forem muitos deploys vindos da mesma conta de uma só vez (rate limit). Eles também precisarão colocar o próprio `GITHUB_TOKEN` ou um App OAuth (Logar com GitHub).

## 3. Vercel
- **Plano Hobby (Grátis):** 
  - Projetos máximos: Limitado a **200 projetos por conta**. (Ultrapassando, você precisará limpar, apagando via dashboard). 
  - Builds (Deploys): 100 builds por dia e 32 builds por hora.
- **Plano Pro ($20/mês):** 
  - Aumenta limites, mas proíbe explicitamente hospedar sites de clientes num plano Pro padrão a menos que se use contas "Team" ou pague taxa por site (eles focam em Enterprise para SaaS builder).
- **Para Escalar SaaS:** Vercel limita muito quem tenta criar sites para múltiplos clientes numa só conta grátis ou Pro. A exclusão de sites (`delete-site-btn`) resolve sua vida para prospectar. Para *comercializar* a ferramenta, é essencial criar a aba "Configurações Globais" e obrigar seus clientes a colocarem o `$VERCEL_TOKEN` próprio no painel. Assim, o SaaS cria projetos na Vercel "deles" (By-passando limites).

## 4. Stitch (Ponto Crítico)
- **Limites:** O "Stitch" faz o peso pesado de análise de tela, extração mental da paleta de cores, cópia, estrutura HTML/CSS. Independente do limite da IA por trás dele (ex: Gemini/Claude Visão = ~10 R$/hora dependendo dos tokens visuais).
- **Escala SaaS:** Modelos visuais e conversacionais de IA requerem pagamento por token (ou plano PRO no app). Para comercializar seu painel, você tem duas opções:
    1. **Assinatura Alta (Você Paga a API):** Você cobra do usuário do seu SaaS R$ 497/mês, e ele não precisa esquentar a cabeça com chave de API. Ele usa o seu saldo geral.
    2. **White Label "Traga sua Chave" (BYOK - Bring Your Own Key):** Você cobra mensalidades baratas (R$ 97/mês) só pelo sistema do Dashboard e exige que as pessoas coloquem a "Chave do Google/Stitch/Vercel". Dá atrito, mas você lucra livre de risco de fatura alta.

---

## 5. Estratégia de Desenvolvimento Futuro (Transformando em Produto Vendável)

Se quisermos faturar com outras pessoas comprando esse painel de você, o desenvolvimento envolverá um Banco de Dados de Usuários (ex: Supabase/Firebase) onde o painel ficará oculto através de Login.

1. **Tela de Login:** Autenticação padrão de e-mail/senha.
2. **Settings (Configurações):** Menu onde o usuário conecta as próprias contas de:
    - [ ] Conta GitHub (Token Pessoal)
    - [ ] Conta Vercel (Token de Acesso)
    - [ ] Chave de API de IA (Opcional - só se o modelo BYOK for adotado).
3. Essa estrutura zera 100% seus custos com infraestrutura do site gerado. Você lucra líquido com a venda do painel. A pessoa paga a você pela máquina de captar clientes.

---

## 6. 🚀 Plano VPS — Vendendo o SaaS Instalado (Modelo Atual)

> **Visão:** Você vende o acesso ao painel já instalado numa VPS. O cliente usa as credenciais dele, você garante a infraestrutura. BUMBA — ele já sai vendendo no dia 1.

### Modelo de Negócio
- Você compra 1 VPS (ex: Hostinger, DigitalOcean, Contabo) → **~R$ 30–80/mês**
- Instala este projeto Node.js na VPS com PM2 (process manager)
- Cada cliente acessa pelo domínio/IP da VPS + porta ou subdomínio
- O cliente preenche as credenciais dele no painel (Google, GitHub, Vercel, Evo)
- **Você cobra: R$ 197–497/mês por acesso**

### Estimativa de Custo vs Receita
| Item | Custo Mensal |
|---|---|
| VPS 2 vCPU / 4GB RAM | ~R$ 50 |
| Domínio (opcional) | ~R$ 5 |
| **Total fixo** | **~R$ 55/mês** |

| Clientes | Receita (R$ 297/cliente) | Lucro Líquido |
|---|---|---|
| 1 cliente | R$ 297 | R$ 242 |
| 5 clientes | R$ 1.485 | R$ 1.430 |
| 10 clientes | R$ 2.970 | R$ 2.915 |

### Stack de Deploy na VPS (próxima fase)
- [ ] `PM2` — manter o Node.js rodando 24/7 com auto-restart
- [ ] `Nginx` — proxy reverso + SSL (HTTPS gratuito via Certbot/Let's Encrypt)
- [ ] Tela de **Configurações** onde cada cliente cola suas chaves (sem editar `.env` manual)
- [ ] **Isolamento por usuário:** cada cliente tem sua própria `leads.json` separada
- [ ] Script de instalação 1-clique (`install.sh`) para você instalar rápido pra cada novo cliente

### Requisitos que já temos ✅
- [x] Backend Node.js/Fastify — roda perfeitamente em VPS
- [x] Frontend estático servido pelo próprio backend — sem build externo necessário
- [x] Todas as credenciais via `.env` — fácil de isolar por cliente
- [x] Geração automática + envio de WhatsApp — produto completo do dia 1

### Próximos passos para viabilizar o modelo VPS
1. **Tela de Configurações no frontend** — cliente digita as chaves diretamente no painel (salva em arquivo local por sessão/usuário)
2. **Autenticação simples** — senha de acesso por instância (não precisa ser multi-tenant completo)
3. **Script `install.sh`** — automatiza instalação do Node, PM2, Nginx e do projeto
4. **Domínios por cliente** — `cliente1.bicalhoads.com.br`, `cliente2.bicalhoads.com.br` via Nginx virtual hosts
