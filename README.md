# Lead Queue com Google Places

MVP backend em Node.js + TypeScript para buscar empresas via Google Places API, extrair `nome` e `telefone` e salvar tudo em uma fila local de revisao manual.

## Requisitos

- Node.js 22+
- Chave valida da Google Places API

## Configuracao

1. Crie um arquivo `.env` baseado em `.env.example`
2. Preencha `GOOGLE_PLACES_API_KEY`

Exemplo:

```env
PORT=3000
GOOGLE_PLACES_API_KEY=sua_chave_aqui
GOOGLE_PLACES_BASE_URL=https://places.googleapis.com/v1
```

## Comandos

```bash
npm install
npm run dev
```

Para validar:

```bash
npm test
npm run build
```

## Endpoints

### Health check

```bash
curl http://localhost:3000/health
```

### Buscar e salvar leads

```bash
curl -X POST http://localhost:3000/api/leads/search \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"academia em sao paulo\",\"regionCode\":\"BR\",\"maxResults\":5,\"persist\":true}"
```

### Listar leads salvos

```bash
curl http://localhost:3000/api/leads
```

### Atualizar status de um lead

```bash
curl -X PATCH http://localhost:3000/api/leads/PLACE_ID/status \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"approved\"}"
```

## Frontend local

Com o servidor rodando, abra:

```text
http://localhost:3000
```

Na interface voce pode:

- digitar a busca exatamente como quiser
- revisar leads na fila local
- aprovar ou rejeitar cada lead
- baixar um CSV dos leads aprovados

O CSV fica disponivel em:

```text
http://localhost:3000/api/leads/export.csv?status=approved
```

## Observacoes

- Os leads ficam salvos em `data/leads.json`
- O projeto nao envia mensagens e nao automatiza outreach
- Para subir no Vercel, a persistencia local precisa ser trocada por banco externo
