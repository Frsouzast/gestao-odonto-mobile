# Worklog — Gestão Odonto-Radiológica (port Electron → Next.js 16)

## Estado atual do projeto

Estamos portando o app Electron original (`github.com/Frsouzast/Gest-o-Odonto-Radiol-gica`, branch `master`) para **Next.js 16 + App Router + TypeScript**, mantendo todas as features: multi-tenant com `clinica_id`, 3 papéis (dono/financeiro/recepção), precificação, agenda, módulo financeiro completo (convênios, contas, glosas, DRE, rentabilidade, lotes, conciliação).

App original está clonado em `/tmp/gestao-odonto` para consulta.

### Stack adotada
- **Next.js 16 + App Router** (rota única `/`, SPA por tabs internas)
- **Prisma + SQLite** em `/home/z/my-project/db/custom.db` (já configurado)
- **shadcn/ui** + Tailwind 4 (Nova York) + lucide-react + recharts
- **JWT + bcryptjs** (mesma lógica do app original; NextAuth disponível mas desnecessário)
- **Zustand** para sessão (com persist) + **TanStack Query** para dados de servidor

### Tema visual
- Vars CSS customizadas em `src/app/globals.css` sobrescrevem as defaults pra recriar a paleta "stone + teal" do app original
- Seletor de **cor de destaque** (teal/azul/roxo) via `data-accent`
- **next-themes** controla claro/escuro (classe `.dark`)

---

## Task ID: 1 — Fundação
**Agent:** main (Claude/Z.ai)

**Work Log:**
- Definido o **Prisma schema completo** em `prisma/schema.prisma` com 17 models (Clinica, Usuario, CapacidadeProdutiva, DespesaFixa, Ativo, Funcionario, Insumo, Procedimento, ProcedimentoInsumo, HistoricoPreco, Agendamento, Convenio, ConvenioTabelaPreco, DespesaRecorrente, ContaPagar, ContaReceber, Glosa, FinanceiroConfig, LoteFaturamento, MovimentoBancario) — mapeia fielmente os 4 migrations SQL originais
- Instalado `bcryptjs` + `jsonwebtoken` (auth)
- `bun run db:push` executado — schema sincronizado com SQLite local
- Criado `src/lib/auth.ts` com `hashSenha`, `conferirSenha`, `gerarToken`, `verificarToken`, `lerUsuarioDoHeader`, `authRequired`, `authPapel`, `podeEditar`
- Criado `src/lib/engine.ts` (motor de precificação — funções puras: `custoFixoTotal`, `horasEfetivas`, `custoFixoPorHora`, `custoFixoPorMinuto`, `calcProcedimento`)
- Criado `src/lib/financeiro.ts` (`calcularDRE`, `agruparRentabilidade`, `calcularFluxoProjetado`, `calcularPorHora`, `calcularConciliacao`)
- Criado `src/lib/auth-store.ts` — store Zustand persistido (`useAuth`, `apiFetch` helper com injeção de Bearer token e tratativa de erro)
- Atualizado `src/lib/utils.ts` (`brl`, `pct`, `num`, `hoje`, `mesAtual`, `dataBR`, `nomeMes`)
- Atualizado `src/app/globals.css` com vars de tema teal/blue/purple + dark mode + scrollbar custom
- Atualizado `src/app/layout.tsx` com metadata PT-BR + Providers (ThemeProvider + QueryClientProvider)
- Criado `src/components/providers.tsx` (wraps ThemeProvider + QueryClient)
- Criado `src/components/app/theme-applier.tsx` (`ThemeApplier`, `CORES_DISPONIVEIS`, `setCorDestaque`)
- Criado `src/components/auth/login-screen.tsx` (Login + Registrar em tabs, lembra último e-mail)
- Criado `src/components/app/app-shell.tsx` (header sticky com clínica+usuário+papel, seletor de tema, seletor de cor, tabs de navegação por papel)
- Criado `src/app/page.tsx` que escolhe entre `LoginScreen` e `AppShell`
- Criado **stubs** das 4 abas em `src/components/tabs/`: `custos-capacidade-tab.tsx`, `procedimentos-tab.tsx`, `agenda-tab.tsx`, `financeiro-tab.tsx`
- Diretórios criados em `src/app/api/` para todas as 20+ rotas (auth, despesas, capacidade, insumos, ativos, resumo, procedimentos, agendamentos, convenios, despesas-recorrentes, contas-pagar, contas-receber, glosas, financeiro, lotes, movimentos-bancarios, usuarios)
- `bun run lint` limpo (0 erros)

**Stage Summary:**
- App abre em `/` (200 OK no dev server) mostrando LoginScreen — porém sem usuários ainda (precisa da T2-a)
- Toda a fundação TypeScript + Prisma + estilos está pronta para os subagentes paralelos construírem as APIs e as tabs
- Padrão de erro do backend: `{ erro: string }` (preservado do app original)
- Padrão de resposta de auth: `{ token, usuario: { id, nome, email, papel }, clinica: { id, nome } }`
- Helper de API do client: `apiFetch<T>(path, opts)` em `src/lib/auth-store.ts` — injeta Bearer, lança Error com `body.erro` em caso de status não-2xx
- Store de sessão: `useAuth` (Zustand persist) com `token`, `usuario`, `setSessao`, `limpar`, `podeEditar()`

---

## Task ID: T2-a — Auth API Routes
**Agent:** general-purpose (backend auth)
**Task:** Authentication API routes (registrar/login/convidar/usuarios)

**Work Log:**
- Lido `worklog.md` (Task 1 — fundação completa) e `server/api.js` linhas 28–113 (referência Express do app Electron original) para alinhar formato de resposta/erros
- Confirmado helpers disponíveis em `src/lib/auth.ts`: `hashSenha`, `conferirSenha` (necessário para login), `gerarToken`, `verificarToken`, `lerUsuarioDoHeader`, `authRequired`, tipos `JwtPayload`/`Papel`. Confirmado `src/lib/db.ts` exporta `db` (PrismaClient singleton)
- Confirmado Prisma schema: `Clinica.id` e `Usuario.id` são `String @id` (sem auto-gen) → uso `crypto.randomUUID()` em ambas as inserções (compatibilidade com UUIDs v4 do app original)
- Criadas 4 rotas (Route Handlers) em TypeScript usando `NextRequest`/`NextResponse`:
  - `src/app/api/auth/registrar/route.ts` — POST cria Clinica+Usuario(dono) numa transação Prisma (`db.$transaction([clinica.create, usuario.create])`) para não deixar clínica órfã em caso de e-mail duplicado; detecta `Prisma.PrismaClientKnownRequestError` code `P2002` → 409
  - `src/app/api/auth/login/route.ts` — POST usa `db.usuario.findUnique({ where: { email }, include: { clinica: true } })` + `conferirSenha` (bcrypt); credenciais inválidas retornam 401 genérico (não revela se e-mail existe)
  - `src/app/api/auth/convidar/route.ts` — POST usa `authRequired(req)` (retorna `JwtPayload | { erro, status }`, distinguido via `"erro" in payload`); bloqueia `papel !== "dono"` com 403; valida `papel` ∈ {`financeiro`,`recepcao`} com 400; valida presença de nome/email/senha com 400; detecta P2002 → 409
  - `src/app/api/usuarios/route.ts` — GET usa `authRequired` + `db.usuario.findMany({ where: { clinicaId }, select: { id, nome, email, papel } })` — `senhaHash` jamais é selecionado do banco
- Padrões aplicados: normalização de e-mail via `.toLowerCase()`; IDs via `crypto.randomUUID()` (global disponível em Node 20+ e tipado pelo `lib: dom` do tsconfig); todo handler envolto em try/catch → 500 `{ erro: "Erro interno ao processar a requisição." }` + `console.error(err)`; parse de body tolerante (`req.json().catch(() => ({}))`) para não estourar 500 em JSON inválido
- `bun run lint` executado — 0 erros, exit 0

**Stage Summary:**
- **Files created:**
  - `src/app/api/auth/registrar/route.ts`
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/convidar/route.ts`
  - `src/app/api/usuarios/route.ts`
- **Endpoints:**
  - `POST /api/auth/registrar` — 201 `{ token, usuario: { id, nome, email, papel: "dono" }, clinica: { id, nome } }`; 400 `{ erro }` (campos faltando | senha < 8 chars); 409 `{ erro: "Já existe uma conta com esse e-mail." }`
  - `POST /api/auth/login` — 200 mesmo shape do registrar; 400 `{ erro }` (campos faltando); 401 `{ erro: "E-mail ou senha inválidos." }`
  - `POST /api/auth/convidar` — requer `Authorization: Bearer <token>` de um dono; 201 `{ id, nome, email, papel }`; 401 `{ erro }` (token ausente/inválido); 403 `{ erro: "Só o dono da clínica pode convidar novos usuários." }`; 400 `{ erro }` (papel inválido | campos faltando); 409 `{ erro: "Já existe uma conta com esse e-mail." }`
  - `GET /api/usuarios` — requer Bearer; 200 `[{ id, nome, email, papel }]` (ordenado por nome ASC; nunca inclui `senhaHash`); 401 `{ erro }` (token ausente/inválido)
- **Decisions:**
  - Usada `db.$transaction` no registrar (não estava no Express original, que deixava clínica órfã em duplicidade de e-mail) — melhoria sem mudar contrato observável (status/shape idênticos ao original)
  - `authRequired(req)` do `src/lib/auth.ts` reaproveitado para convidar/usuarios (em vez de reescrever o parsing do header) — diferença do original: mensagem de 401 é "Faça login: token ausente ou inválido no header Authorization." em vez de "Token ausente."/"Token inválido ou expirado." — semanticamente equivalente e consistente com o helper
  - `conferirSenha` importado de `@/lib/auth` (não listado explicitamente no briefing mas já exportado pelo auth.ts do Task 1) — necessário para o fluxo de login
  - Adicionada validação 400 de presença de `nome`/`email`/`senha` no convidar (original não tinha e estourava 500 SQL) — melhoria defensiva dentro do escopo do próprio arquivo
  - `crypto.randomUUID()` usado como global (Node 20+ requirement do Next.js 16 + `lib: dom` no tsconfig fornece o tipo) — sem necessidade de import explícito
- **Lint status:** PASS (0 erros, exit 0)

---

## Task ID: T2-b — Custos & Capacidade API Routes
**Agent:** general-purpose (backend custos)
**Task:** Custos & Capacidade API routes (despesas, capacidade, insumos, ativos, resumo)

Work Log:
- Lido `worklog.md` (Task 1 + T2-a) e `server/api.js` L141-302 (referência Express do app Electron original) para alinhar formato de resposta/erros e shape de cada endpoint
- Confirmados helpers disponíveis: `authRequired(req): JwtPayload | { erro, status }`, `podeEditar = authPapel("dono","financeiro")` retorna `{ ok, payload | erro, status }`, `db` (PrismaClient singleton), funções puras do engine `custoFixoTotal`/`horasEfetivas`/`custoFixoPorHora`/`custoFixoPorMinuto` com `Despesa = { valor }` e `Capacidade = { diasTrabalhados, horasPorDia, unidadesRenda, percentOcupacao }`
- Confirmado Prisma schema: `DespesaFixa.{id,clinicaId,nome,valor,ordem}`, `CapacidadeProdutiva.{clinicaId(@id),diasTrabalhados,horasPorDia,unidadesRenda,percentOcupacao}`, `Insumo.{id,clinicaId,nome,unidade,valorTotal,quantidade}`, `Ativo.{id,clinicaId,nome,dataAquisicao?,valorAquisicao,vidaUtilAnos}` — todos os campos do briefing batem
- Criadas 8 rotas (Route Handlers) TypeScript com `NextRequest`/`NextResponse`, params como `Promise<{ id: string }>` (App Router 16), `body = await req.json().catch(() => ({}))`, IDs via `crypto.randomUUID()`, try/catch → 500 `{ erro: "Erro interno ao processar a requisição." }` + `console.error(err)`:
  - `src/app/api/despesas/route.ts` — GET `findMany({where:{clinicaId}, orderBy:{ordem:"asc"}, select:{id,clinicaId,nome,valor,ordem}})`; POST (podeEditar) valida `nome`+`valor` (400) e cria com `ordem:0`; retorna 201 com shape `{ id, clinicaId, nome, valor, ordem: 0 }`
  - `src/app/api/despesas/[id]/route.ts` — PUT (podeEditar) `findFirst` por `{id, clinicaId}` → 404 se ausente; monta `data` só com campos providos (typeof checks, sem COALESCE) e `update`; DELETE (podeEditar) `deleteMany({where:{id,clinicaId}})` → 204 idempotente
  - `src/app/api/capacidade/route.ts` — GET `findUnique({where:{clinicaId}})` retorna a linha ou `null` (200 null body); PUT (podeEditar) valida os 4 numéricos (400) e faz `upsert` (clinicaId é PK de `capacidade_produtiva`)
  - `src/app/api/insumos/route.ts` — GET `findMany({where:{clinicaId}, orderBy:{nome:"asc"}})`; POST (podeEditar) valida `nome` (400); defaults `unidade="un"`, `valorTotal=0`, `quantidade=1`; retorna 201 com a linha criada
  - `src/app/api/insumos/[id]/route.ts` — PUT (podeEditar) monta `data` só com `nome`/`unidade`/`valorTotal`/`quantidade` providos (typeof checks); `findFirst` para 404; `update`; DELETE (podeEditar) `deleteMany` → 204 idempotente
  - `src/app/api/ativos/route.ts` — GET `findMany({where:{clinicaId}, orderBy:{nome:"asc"}})`; POST (podeEditar) valida `nome`; defaults `dataAquisicao=null`, `valorAquisicao=0`, `vidaUtilAnos=1` (fiel ao `|| 0`/`|| 1` do api.js L239); retorna 201 com a linha criada
  - `src/app/api/ativos/[id]/route.ts` — PUT (podeEditar) monta `data` só com `nome`/`dataAquisicao`/`valorAquisicao`/`vidaUtilAnos` providos (typeof checks); `findFirst` para 404; `update`; DELETE (podeEditar) `deleteMany` → 204 idempotente
  - `src/app/api/resumo/route.ts` — GET (authRequired only, read-only) faz `Promise.all` carregando `despesaFixa.findMany({select:{valor}})`, `ativo.findMany({select:{valorAquisicao,vidaUtilAnos}})` e `capacidadeProdutiva.findUnique({where:{clinicaId}})`; se capacidade ausente → 400 `{ erro: "Capacidade produtiva não configurada para esta clínica." }`; mapeia despesas → `{valor: Number(d.valor)}`, depreciacoes → `{valor: vidaUtilAnos>0 ? valorAquisicao/vidaUtilAnos/12 : 0}`; retorna `{ custoFixoTotal, depreciacaoMensalTotal, horasEfetivas, custoFixoPorHora, custoFixoPorMinuto }` usando as funções puras do `@/lib/engine` com `todosOsCustos = [...despesas, ...depreciacoes]`
- Criados os 3 subdiretórios `[id]` que não existiam (somente os diretórios pais estavam presentes da Task 1)
- `bun run lint` executado — 0 erros, exit 0

Stage Summary:
- **Files created:**
  - `src/app/api/despesas/route.ts`
  - `src/app/api/despesas/[id]/route.ts`
  - `src/app/api/capacidade/route.ts`
  - `src/app/api/insumos/route.ts`
  - `src/app/api/insumos/[id]/route.ts`
  - `src/app/api/ativos/route.ts`
  - `src/app/api/ativos/[id]/route.ts`
  - `src/app/api/resumo/route.ts`
- **Endpoints:**
  - `GET /api/despesas` — requer Bearer; 200 `[{ id, clinicaId, nome, valor, ordem }]` (ordenado por ordem ASC)
  - `POST /api/despesas` — requer dono|financeiro; 201 `{ id, clinicaId, nome, valor, ordem: 0 }`; 400 `{ erro }` (nome/valor ausentes ou inválidos)
  - `PUT /api/despesas/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Despesa não encontrada." }` se não pertencer à clínica
  - `DELETE /api/despesas/[id]` — requer dono|financeiro; 204 (idempotente — `deleteMany` por `{id, clinicaId}`)
  - `GET /api/capacidade` — requer Bearer; 200 com a linha única `capacidade_produtiva` da clínica ou `null`
  - `PUT /api/capacidade` — requer dono|financeiro; 200 com a linha (criada ou atualizada via `upsert` — `clinicaId` é PK); 400 `{ erro }` se algum dos 4 numéricos faltar
  - `GET /api/insumos` — requer Bearer; 200 `[insumo...]` (ordenado por nome ASC)
  - `POST /api/insumos` — requer dono|financeiro; 201 com a linha criada; 400 `{ erro }` se `nome` ausente
  - `PUT /api/insumos/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Insumo não encontrado." }`
  - `DELETE /api/insumos/[id]` — requer dono|financeiro; 204 (idempotente)
  - `GET /api/ativos` — requer Bearer; 200 `[ativo...]` (ordenado por nome ASC)
  - `POST /api/ativos` — requer dono|financeiro; 201 com a linha criada; 400 `{ erro }` se `nome` ausente
  - `PUT /api/ativos/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Ativo não encontrado." }`
  - `DELETE /api/ativos/[id]` — requer dono|financeiro; 204 (idempotente)
  - `GET /api/resumo` — requer Bearer; 200 `{ custoFixoTotal, depreciacaoMensalTotal, horasEfetivas, custoFixoPorHora, custoFixoPorMinuto }`; 400 `{ erro: "Capacidade produtiva não configurada para esta clínica." }` se `capacidade_produtiva` estiver ausente
- **Decisions:**
  - PUT/DELETE nos `[id]` routes usam `findFirst` + `deleteMany` (em vez de `update`/`delete` diretos por id) para garantir isolamento multi-tenant via `clinicaId` — `update({where:{id}})` sem `clinicaId` no `where` poderia tocar linha de outra clínica se o id colidisse; o `findFirst` prévio também dá o 404 correto sem estourar `P2025` do Prisma (que viraria 500 sem catch específico)
  - PUT usa checagem `typeof` em vez de `?? null` + COALESCE — atende ao briefing ("don't use COALESCE — just check what's in the body") e evita acidentalmente apagar campo quando o cliente manda `null` explícito (prisma interpretaria como NULL). Campo só é atualizado se vier com tipo correto no body
  - `resumo` retorna 400 em vez de 200 null quando capacidade ausente — fiel ao api.js L300 (original retornava 400 com erro). T2-a tinha optado por 200 null em `capacidade` GET individual (linha única), mas o agregado de `resumo` tem que falhar porque não dá pra calcular custo/minuto sem capacidade — e os clientes que chamam `/resumo` dependem do 400 para mostrar o banner de "configure capacidade"
  - POST de ativo respeita defaults `valorAquisicao=0`, `vidaUtilAnos=1` (não `0`) — vital porque `vidaUtilAnos=0` causaria divisão por zero no cálculo de depreciação em `/resumo`. Fiel ao `|| 1` do api.js L239
  - POST de insumo respeita defaults `unidade="un"`, `valorTotal=0`, `quantidade=1` — alinhado com `@default` do schema.prisma e comportamento típico do app original
  - `select` explícito no `despesas` GET e no `resumo` para despesas (só `valor`) minimiza dados trafegados e documenta a intenção; demais `findMany` retornam o model completo (compatível com o `select *` do api.js)
- **Lint status:** PASS (0 erros, exit 0)

---

Task ID: T2-c
Agent: general-purpose (backend procedimentos)
Task: Procedimentos API routes (CRUD + itens + cálculo + histórico + preco-final)

Work Log:
- Lido `worklog.md` (Task 1 + T2-a + T2-b) e `server/api.js` L304-435 (referência Express do app Electron original) para alinhar formato de resposta/erros, shape de cada endpoint e helper pattern estabelecido em T2-b
- Confirmados helpers: `authRequired(req): JwtPayload | { erro, status }` (distinguir via `"erro" in auth`); `podeEditar = authPapel("dono","financeiro")` retorna `{ ok, payload } | { ok:false, erro, status }`; `db` (PrismaClient singleton); engine functions puras `calcProcedimento`, `custoFixoPorMinuto`, `insumoUnitCost` e interfaces `ProcedimentoInput`/`Despesa`/`Capacidade` em `@/lib/engine`
- Confirmado Prisma schema: `Procedimento.{id,clinicaId,nome,tempoMinutos,laudos,retrabalhoPct,comissaoPct,lucroDesejadoPct,inadimplenciaPct,impostosPct,taxaCartaoPct,outrosPct,precoConcorrencia?,precoFinal?,ativo,equipamentoId?}`; `ProcedimentoInsumo` com PK composta `[procedimentoId, insumoId]` via `@@id([procedimentoId, insumoId])` → accessar no where como `procedimentoId_insumoId: { procedimentoId, insumoId }`; `HistoricoPreco.{id,procedimentoId,usuarioId?,precoAnterior?,precoNovo?,alteradoEm}`
- Criadas 6 rotas (Route Handlers) TypeScript com `NextRequest`/`NextResponse`, `params: Promise<{ id: string }>` (ou `{ id, insumoId }` no caso do DELETE aninhado), `body = await req.json().catch(() => ({}))`, IDs via `crypto.randomUUID()`, try/catch → 500 `{ erro: "Erro interno ao processar a requisição." }` + `console.error(err)`:
  - `src/app/api/procedimentos/route.ts` — GET `findMany({where:{clinicaId,ativo:true},orderBy:{nome:"asc"}})`; POST (podeEditar) valida `nome` (400); defaults `tempoMinutos || 0`, `laudos || 0`, `retrabalhoPct ?? 0.03` (fiel ao api.js L316); retorna 201 com a linha criada
  - `src/app/api/procedimentos/[id]/route.ts` — PUT (podeEditar) `findFirst` por `{id, clinicaId}` → 404 se ausente; monta `data` só com 12 campos providos (typeof check — string para `nome`/`equipamentoId`, número via helper `isNum()` para os 10 campos Float); 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se data vazia (fiel ao api.js L346); `update({where:{id}})` retorna linha atualizada. DELETE (podeEditar) soft-delete via `updateMany({where:{id,clinicaId}, data:{ativo:false}})` → 204 idempotente
  - `src/app/api/procedimentos/[id]/itens/route.ts` — GET `findMany({where:{procedimentoId}, include:{insumo:{select:{nome:true}}}})` e mapeia para `[{ insumoId, quantidade, insumoNome }]` (forma achatada que a UI espera); POST (podeEditar) valida `insumoId` (400); `quantidade ?? 1`; usa `db.procedimentoInsumo.upsert({ where: { procedimentoId_insumoId: {...} }, create, update })` fiel ao `on conflict (procedimento_id, insumo_id) do update` do SQL original; retorna 201 `{ procedimentoId, insumoId, quantidade }`
  - `src/app/api/procedimentos/[id]/itens/[insumoId]/route.ts` — DELETE (podeEditar) `deleteMany({where:{procedimentoId, insumoId}})` → 204 idempotente (em vez de `delete` por chave composta, que lançaria P2025 se o vínculo não existisse)
  - `src/app/api/procedimentos/[id]/calculo/route.ts` — GET duplica a lógica do `/api/resumo` inline (Promise.all carregando despesas/ativos/capacidade → se capacidade null, 400 `{ erro: "Capacidade produtiva não configurada para esta clínica." }`; computa `custoFixoPorMinuto(todosOsCustos, capacidade)`); então `findFirst` por `{id, clinicaId}` → 404; carrega `procedimentoInsumo.findMany({include:{insumo:{select:{valorTotal,quantidade}}}})` e constrói lookup `custoUnitario: Record<string,number>` usando `insumoUnitCost` do engine; mapeia prisma→`ProcedimentoInput` com field renames (`retrabalhoPct → retrabalho`, `comissaoPct → comissao`, `lucroDesejadoPct → lucroDesejado`, `inadimplenciaPct → inadimplencia`, `impostosPct → impostos`, `taxaCartaoPct → taxaCartao`, `precoFinal || 0`); chama `calcProcedimento(proc, custoPorMinuto, (id)=>custoUnitario[id]||0)` e retorna `{ procedimento: nome, custoInsumos, rateio, retrabalhoValor, custoDireto, precoSugerido, pontoEquilibrio, lucratividadeFinal }`
  - `src/app/api/procedimentos/[id]/preco-final/route.ts` — PUT (podeEditar) valida `precoNovo` numérico (400); `findFirst` por `{id, clinicaId}` selecionando só `{id, precoFinal}` → 404; captura `precoAnterior = existente.precoFinal ?? null`; `update({where:{id}, data:{precoFinal:precoNovo}})`; `historicoPreco.create({data:{id:crypto.randomUUID(), procedimentoId, usuarioId:payload.usuarioId, precoAnterior, precoNovo}})`; retorna 204
- Criados os 4 subdiretórios aninhados necessários (`[id]`, `[id]/itens`, `[id]/itens/[insumoId]`, `[id]/calculo`, `[id]/preco-final`) via `mkdir -p` pois o Write tool exige que o diretório pai exista
- `bun run lint` executado — 0 erros, exit 0

Stage Summary:
- **Files created:**
  - `src/app/api/procedimentos/route.ts`
  - `src/app/api/procedimentos/[id]/route.ts`
  - `src/app/api/procedimentos/[id]/itens/route.ts`
  - `src/app/api/procedimentos/[id]/itens/[insumoId]/route.ts`
  - `src/app/api/procedimentos/[id]/calculo/route.ts`
  - `src/app/api/procedimentos/[id]/preco-final/route.ts`
- **Endpoints:**
  - `GET /api/procedimentos` — requer Bearer; 200 `[procedimento...]` (apenas ativos, ordenado por nome ASC)
  - `POST /api/procedimentos` — requer dono|financeiro; 201 com a linha criada; 400 `{ erro: "nome é obrigatório." }` se `nome` ausente/vazio
  - `PUT /api/procedimentos/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Procedimento não encontrado." }` se não pertencer à clínica; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se body não trouxer nenhum dos 12 campos aceitos (nome, tempoMinutos, laudos, retrabalhoPct, comissaoPct, lucroDesejadoPct, inadimplenciaPct, impostosPct, taxaCartaoPct, outrosPct, precoConcorrencia, equipamentoId)
  - `DELETE /api/procedimentos/[id]` — requer dono|financeiro; 204 (soft-delete via `ativo:false`, idempotente via `updateMany` com `clinicaId` no where)
  - `GET /api/procedimentos/[id]/itens` — requer Bearer; 200 `[{ insumoId, quantidade, insumoNome }]` (forma achatada com join do nome do insumo)
  - `POST /api/procedimentos/[id]/itens` — requer dono|financeiro; 201 `{ procedimentoId, insumoId, quantidade }` (upsert na PK composta, `quantidade ?? 1`); 400 `{ erro: "insumoId é obrigatório." }`
  - `DELETE /api/procedimentos/[id]/itens/[insumoId]` — requer dono|financeiro; 204 (idempotente via `deleteMany`)
  - `GET /api/procedimentos/[id]/calculo` — requer Bearer; 200 `{ procedimento: nome, custoInsumos, rateio, retrabalhoValor, custoDireto, precoSugerido, pontoEquilibrio, lucratividadeFinal }`; 400 `{ erro: "Capacidade produtiva não configurada para esta clínica." }` se `capacidade_produtiva` estiver ausente; 404 `{ erro: "Procedimento não encontrado." }`
  - `PUT /api/procedimentos/[id]/preco-final` — requer dono|financeiro; 204 (atualiza `precoFinal` e insere linha em `historico_preco` com `precoAnterior`, `precoNovo` e `usuarioId`); 400 `{ erro: "precoNovo é obrigatório e deve ser numérico." }`; 404 `{ erro: "Procedimento não encontrado." }`
- **Decisions:**
  - PUT em `/procedimentos/[id]` usa `findFirst` por `{id, clinicaId}` prévio (em vez de `update` direto por id) para garantir isolamento multi-tenant e devolver 404 limpo sem estourar P2025 — mesmo padrão de T2-b (`despesas/[id]`, `insumos/[id]`, `ativos/[id]`)
  - DELETE soft-delete usa `updateMany({where:{id,clinicaId}, data:{ativo:false}})` (em vez de `update` por id) — idempotente (não lança erro se a linha não existir) e mantém isolamento multi-tenant; fiel ao `ativo = 0` do SQL original, agora representado como Boolean false (schema Prisma definiu `ativo Boolean @default(true)`)
  - DELETE em `/itens/[insumoId]` usa `deleteMany` por chave composta em vez de `delete` — briefing pedia `delete` por composite, mas o Prisma `delete` lançaria `P2025` se o vínculo não existisse, transformando um 204 idempotente em 500. Mantém o mesmo princípio REST idempotente adotado em T2-b para todos os DELETEs
  - POST em `/procedimentos/[id]/itens` usa `upsert` na chave composta via sintaxe Prisma `procedimentoId_insumoId: { procedimentoId, insumoId }` (campo virtual gerado pelo `@@id([procedimentoId, insumoId])` do schema) — fiel ao `on conflict (procedimento_id, insumo_id) do update set quantidade = excluded.quantidade` do SQL original
  - GET em `/calculo` duplica a lógica de carregar `custoPorMinuto` (despesas + depreciação de ativos + capacidade produtiva) em vez de fazer `fetch("/api/resumo")` — evita custos de rede/serialização dupla e mantém o endpoint autônomo, conforme sugerido pelo briefing ("duplicate the calculation here")
  - `insumoUnitCost` importado do `@/lib/engine` (além dos 5 helpers listados no briefing) — função pura já existente no Task 1 que encapsula exatamente o `insumo.valorTotal / insumo.quantidade` com guarda contra `quantidade=0`, evitando reescrever a fórmula e garantindo consistência com outros usos futuros
  - Validação 400 de `nome` no POST de procedimento adicionada defensivamente (original não validava e estourava 500 SQL) — mesma melhoria adotada em T2-b para `insumos` POST; não altera o contrato observável (clientes válidos continuam funcionando, inválidos recebem 400 em vez de 500)
  - Validação 400 de `precoNovo` numérico no PUT `/preco-final` — necessária porque o `historico_preco` armazenaria NaN/undefined caso `precoNovo` não fosse número, corrompendo o histórico. Adicionada dentro do escopo do próprio arquivo
  - `equipamentoId` no PUT aceita apenas string (typeof check) — não permite limpar a FK enviando `null` explícito no body. Consistente com a diretriz do briefing ("typeof check") e com T2-b; se houver demanda futura para desvincular equipamento, adicionar um endpoint separado ou ampliar o PUT
  - `precoAnterior` no `historico_preco` armazenado como `null` quando o procedimento nunca teve preço (em vez de 0 ou string vazia) — fiel ao schema Prisma `precoAnterior Float?` e ao SQL original que inseria NULL (`atuais[0].preco_final` que seria NULL)
- **Lint status:** PASS (0 erros, exit 0)

---
Task ID: T2-d
Agent: general-purpose (backend agendamentos)
Task: Agendamentos API routes (CRUD + remarcar)

Work Log:
- Lido `worklog.md` (Task 1 + T2-a + T2-b + T2-c) e `server/api.js` L437-528 (referência Express do app Electron original) para alinhar formato de resposta/erros e shape de cada endpoint
- Confirmados helpers: `authRequired(req): JwtPayload | { erro, status }` (distinguir via `"erro" in auth`), `db` (PrismaClient singleton). Agendamentos são abertos a qualquer papel autenticado (briefing: "don't use podeEditar") — agendar não é ação financeira
- Confirmado Prisma schema: `Agendamento.{id,clinicaId,nome,telefone?,exame?,plano(Boolean default false),particular(Boolean default false),data(String YYYY-MM-DD),hora?,status(String default 'aguardando'),remarcadoParaId?,criadoEm}` com self-relation `"RemarcadoPara"` — `remarcadoPara Agendamento?` (muitos para um) e `remarcadoDe Agendamento[]` (um para muitos). Os campos do briefing batem com o schema
- Criadas 3 rotas (Route Handlers) TypeScript com `NextRequest`/`NextResponse`, `params: Promise<{ id: string }>` (App Router 16), `body = await req.json().catch(() => ({}))`, IDs via `crypto.randomUUID()`, try/catch → 500 `{ erro: "Erro interno ao processar a requisição." }` + `console.error(err)`:
  - `src/app/api/agendamentos/route.ts` — GET valida `?data=YYYY-MM-DD` (400 `{ erro: "Informe ?data=AAAA-MM-DD." }` se ausente); `findMany({where:{clinicaId,data}, include:{remarcadoPara:{select:{data:true,hora:true}}}})`; sort em JS com NULLs primeiro e hora ASC (SQLite+Prisma não suporta `nulls:'first'` de forma portável — briefing autoriza fallback "fetch unsorted and sort in JS"); mapeia para `[{...agendamento, remarcadoParaData, remarcadoParaHora}]` (rename do nested `remarcadoPara.{data,hora}` para camelCase — fiel ao `r.data as remarcado_para_data, r.hora as remarcado_para_hora` do SQL original). POST valida `nome`+`data` (400 `{ erro: "nome e data são obrigatórios." }`); `plano`/`particular` coeridos via `Boolean()` (fiel ao `? 1 : 0` do SQL original, agora Boolean no schema); defaults `telefone=null`, `exame=null`, `hora=null` quando ausentes; retorna 201 com a linha criada
  - `src/app/api/agendamentos/[id]/route.ts` — PUT faz `findFirst` por `{id, clinicaId}` prévio → 404 `{ erro: "Agendamento não encontrado." }` se ausente (mesmo padrão T2-b/T2-c — evita P2025); monta `data` só com 8 campos providos (`nome, telefone, exame, plano, particular, data, hora, status`) usando checks `body[key] !== undefined` (fiel ao `if (req.body[key] !== undefined)` do api.js L483); `telefone`/`exame`/`hora` aceitam `null` explícito (`body.telefone ?? null`) para limpar o campo; `plano`/`particular` coeridos via `Boolean()`; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se data vazia (fiel ao api.js L489); `update({where:{id}})` retorna linha atualizada. DELETE `deleteMany({where:{id,clinicaId}})` → 204 idempotente
  - `src/app/api/agendamentos/[id]/remarcar/route.ts` — PUT valida `novaData` (400 `{ erro: "novaData é obrigatória." }`); `findFirst` por `{id, clinicaId}` → 404; gera `novoId = crypto.randomUUID()`; usa `db.$transaction([create, update])` para criar o novo agendamento (com `nome`/`telefone`/`exame`/`plano`/`particular` copiados do original, `data: novaData`, `hora: novaHora ?? null`, `status: "aguardando"`) E marcar o original como `status: "remarcado"`, `remarcadoParaId: novoId` — atomicamente. Retorna 201 com o novo agendamento
- Criados os 2 subdiretórios aninhados necessários (`[id]`, `[id]/remarcar`) via `mkdir -p` pois o Write tool exige que o diretório pai exista
- `bun run lint` executado — 0 erros, exit 0

Stage Summary:
- **Files created:**
  - `src/app/api/agendamentos/route.ts`
  - `src/app/api/agendamentos/[id]/route.ts`
  - `src/app/api/agendamentos/[id]/remarcar/route.ts`
- **Endpoints:**
  - `GET /api/agendamentos?data=YYYY-MM-DD` — requer Bearer; 200 `[{...agendamento, remarcadoParaData, remarcadoParaHora}]` (NULLs primeiro, depois hora ASC); 400 `{ erro: "Informe ?data=AAAA-MM-DD." }` se `data` ausente
  - `POST /api/agendamentos` — requer Bearer (qualquer papel); 201 com a linha criada; 400 `{ erro: "nome e data são obrigatórios." }` se `nome` ou `data` ausente
  - `PUT /api/agendamentos/[id]` — requer Bearer (qualquer papel); 200 com linha atualizada; 404 `{ erro: "Agendamento não encontrado." }`; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se body não trouxer nenhum dos 8 campos aceitos (nome, telefone, exame, plano, particular, data, hora, status)
  - `DELETE /api/agendamentos/[id]` — requer Bearer (qualquer papel); 204 (idempotente via `deleteMany` por `{id, clinicaId}`)
  - `PUT /api/agendamentos/[id]/remarcar` — requer Bearer (qualquer papel); 201 com o NOVO agendamento criado (status `aguardando`); 400 `{ erro: "novaData é obrigatória." }`; 404 `{ erro: "Agendamento não encontrado." }`
- **Decisions:**
  - Sort em JS em vez de `orderBy: [{ hora: { sort: 'asc', nulls: 'first' } }]` — briefing autoriza fallback "fetch unsorted and sort in JS" caso `nulls: 'first'` não seja suportado no SQLite. Mais portátil e explícito (também garante ordenamento NULL-first idêntico em qualquer connector caso troquemos de DB no futuro). Lógica do sort: `aNull && bNull` → 0; `aNull` (e b não) → -1 (a primeiro); `bNull` → 1; caso contrário `localeCompare` entre strings "HH:MM" — estável para o caso comum
  - Nome dos campos remarcados em camelCase (`remarcadoParaData`/`remarcadoParaHora`) em vez do snake_case `remarcado_para_data`/`remarcado_para_hora` do SQL original — briefing explícito ("rename remarcadoPara fields to camelCase to match original API shape"); o frontend TS/JS espera camelCase; o Express original devolvia snake_case direto do SQL, mas a porta Prisma-first já entrega camelCase por padrão (fields `data`/`hora` no nested `remarcadoPara`), então só achatamos para top-level com nomes camelCase
  - `db.$transaction` no `/remarcar` (não estava no Express original, que fazia INSERT+UPDATE sequenciais sem transação) — melhoria defensiva consistente com T2-a (`/api/auth/registrar`): se o segundo UPDATE falhar (ex. FK violada em outro cenário, ou banco ocupado), o INSERT é roll-back automaticamente, evitando criar agendamento "órfão" sem link de volta do original. Não muda o contrato observável (status/shape idênticos ao original em sucesso)
  - PUT/DELETE nos `[id]` routes usam `findFirst` + `deleteMany` (em vez de `update`/`delete` diretos por id) para garantir isolamento multi-tenant via `clinicaId` — mesmo padrão de T2-b/T2-c. O `findFirst` prévio também dá o 404 limpo sem estourar `P2025` do Prisma (que viraria 500 sem catch específico)
  - POST de agendamento usa `telefone || null`, `exame || null`, `hora || null` em vez de `?? null` — coerção intencional para converter string vazia (`""`) em NULL também, fiel ao `telefone || null` do api.js L462. No PUT optamos por `body.telefone ?? null` (no-op após o check `!== undefined`, mas documenta intenção): se o cliente mandar `telefone: null` explícito no PUT, limpamos o campo; se mandar `""`, preservamos como `""` (o api.js original no PUT também não converte `""` para NULL — só faz o check de `!== undefined`). Como SQLite aceita empty strings sem erro e `telefone`/`exame`/`hora` são `String?`, ambas representações são válidas
  - PUT em `/[id]` aceita qualquer um dos 8 campos sem validação de tipo estrita (além do check `!== undefined`) — coerção para boolean só em `plano`/`particular` (fiel ao briefing "for plano/particular coerce to boolean"); demais campos vão direto pro Prisma, que lança erro tipado se o tipo estiver errado (capturado pelo try/catch → 500). Consistente com o briefing e com T2-b/T2-c
  - DELETE usa `deleteMany` (em vez de `delete` por id) — idempotente (não lança P2025 se a linha não existir), mantém isolamento multi-tenant via `clinicaId` no `where`. Mesmo padrão adotado em T2-b para `despesas`/`insumos`/`ativos` e em T2-c para `itens/[insumoId]`
- **Lint status:** PASS (0 erros, exit 0)

---
Task ID: T2-e
Agent: general-purpose (backend financeiro core)
Task: Financeiro core API routes (convênios + tabela preços + contas + glosas + despesas recorrentes)

Work Log:
- Lido `worklog.md` (Task 1 + T2-a + T2-b + T2-c + T2-d) e `server/api.js` L530-786 (referência Express do app Electron original) para alinhar formato de resposta/erros e shape de cada endpoint, mantendo os patterns de T2-b/T2-c/T2-d (params como `Promise<{ id: string }>`, `body = await req.json().catch(() => ({}))`, IDs via `crypto.randomUUID()`, try/catch → 500 `{ erro: "Erro interno ao processar a requisição." }` + `console.error(err)`)
- Confirmados helpers: `authRequired(req): JwtPayload | { erro, status }` (distinguir via `"erro" in auth`), `podeEditar = authPapel("dono","financeiro")` retorna `{ ok, payload } | { ok:false, erro, status }`, `db` (PrismaClient singleton)
- Confirmado Prisma schema: `Convenio.{id,clinicaId,nome,cnpj?,telefone?,email?,responsavel?,prazoMedioDias(default 30),ativo(default true),criadoEm}`; `ConvenioTabelaPreco.{id,convenioId,procedimentoId,valor,vigenciaInicio(String YYYY-MM-DD),criadoEm}`; `DespesaRecorrente.{id,clinicaId,descricao,categoria?,fornecedor?,valor,diaVencimento(default 5),ativa(default true)}`; `ContaPagar.{id,clinicaId,descricao,categoria?,fornecedor?,valor,vencimento,status(default "aberto"),dataPagamento?,recorrenteId?,criadoEm}`; `ContaReceber.{id,clinicaId,pacienteNome?,procedimentoId?,convenioId?,dentistaSolicitante?,dataExame,valorFaturado,valorPago?,vencimento?,status(default "aberto"),dataRecebimento?,loteId?,criadoEm}`; `Glosa.{id,contaReceberId,valor,motivo?,status(default "glosada"),valorRecuperado?,criadoEm}` com relation `contaReceber` `onDelete: Cascade`
- Criadas 13 rotas (Route Handlers) TypeScript com `NextRequest`/`NextResponse`:
  - `src/app/api/convenios/route.ts` — GET `findMany({where:{clinicaId}, orderBy:{nome:"asc"}})`; POST (podeEditar) com defaults `prazoMedioDias ?? 30` (fiel ao api.js L546) e campos opcionais `cnpj`/`telefone`/`email`/`responsavel` virando null quando ausentes/vazios (`|| null` — coerção explícita para converter também string vazia em NULL); retorna 201 com a linha criada
  - `src/app/api/convenios/[id]/route.ts` — PUT (podeEditar) `findFirst` por `{id, clinicaId}` → 404; monta `data` só com 7 campos providos (typeof check para string em `nome`/`cnpj`/`telefone`/`email`/`responsavel`, `isNum()` para `prazoMedioDias`, `body.ativo !== undefined` + `Boolean(body.ativo)` para `ativo` — fiel ao `ativo ? 1 : 0` do api.js L560); 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se data vazia; `update({where:{id}})`. DELETE (podeEditar) `deleteMany({where:{id,clinicaId}})` → 204 idempotente
  - `src/app/api/convenios/[id]/precos/route.ts` — GET `findMany({where:{convenioId:id}, include:{procedimento:{select:{nome:true}}}, orderBy:[{procedimento:{nome:"asc"}},{vigenciaInicio:"desc"}]})` e mapeia para `[{...ctp, procedimentoNome}]`; POST (podeEditar) SEMPRE insere nova linha (nunca sobrescreve — preserva valor para exames antigos, "congelar a regra comercial" do mapa mestre); default `vigenciaInicio = new Date().toISOString().slice(0,10)` quando ausente (fiel ao api.js L591); retorna 201
  - `src/app/api/despesas-recorrentes/route.ts` — GET `findMany({where:{clinicaId}, orderBy:{descricao:"asc"}})`; POST (podeEditar) com default `diaVencimento ?? 5` (fiel ao api.js L620) e `valor ?? 0` (aceita 0 — validação por `?? null` em vez de `|| null`); `categoria`/`fornecedor` viram null quando ausentes/vazios; retorna 201
  - `src/app/api/despesas-recorrentes/[id]/route.ts` — DELETE (podeEditar) `deleteMany({where:{id,clinicaId}})` → 204 idempotente
  - `src/app/api/despesas-recorrentes/gerar/route.ts` — POST (podeEditar) valida `mes` ("YYYY-MM") obrigatório (400 `{ erro: "mes (AAAA-MM) é obrigatório." }` se ausente — fiel ao api.js L635); para cada `despesa_recorrente` ativa da clínica, checa idempotência via `findFirst({where:{recorrenteId:r.id, vencimento:{startsWith:mes}}})`; se não existe, cria `conta_pagar` com `vencimento = "${mes}-${String(r.diaVencimento).padStart(2,'0')}"`, snapshot de `descricao`/`categoria`/`fornecedor`/`valor` da recorrente e `recorrenteId = r.id`; retorna 201 `{ gerados: number }`
  - `src/app/api/contas-pagar/route.ts` — GET constrói `where` Prisma dinâmico a partir de `?status=` e `?mes=YYYY-MM` (mes → `vencimento: { startsWith: mes }`, fiel ao `vencimento like "${mes}%"` do SQL original); `orderBy: { vencimento: "asc" }`; POST (podeEditar) com `categoria`/`fornecedor` virando null quando ausentes/vazios; `valor ?? 0`, `vencimento ?? ""`; retorna 201
  - `src/app/api/contas-pagar/[id]/route.ts` — PUT (podeEditar) `findFirst` por `{id, clinicaId}` → 404; monta `data` só com `status`/`dataPagamento` providos (typeof string); 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se data vazia; `update`. DELETE (podeEditar) `deleteMany` → 204 idempotente
  - `src/app/api/contas-receber/route.ts` — GET constrói `where` dinâmico de `?status=`/`?mes=`/`?convenioId=` (mes → `dataExame: { startsWith: mes }`, fiel ao `data_exame like "${mes}%"` do SQL original); `include: { convenio: { select: { nome: true } }, procedimento: { select: { nome: true } } }`; `orderBy: { dataExame: "desc" }`; mapeia para `[{...cr, convenioNome, procedimentoNome}]`. POST (ABERTO a qualquer papel autenticado — NÃO usa podeEditar, fiel ao briefing "recepção pode lançar produção"): helper interno `precoVigente(convenioId, procedimentoId, data)` faz `db.convenioTabelaPreco.findFirst({where:{convenioId,procedimentoId,vigenciaInicio:{lte:data}}, orderBy:{vigenciaInicio:"desc"}, select:{valor:true}})` retornando `Number(row.valor)` ou null. Se `valorFaturado === undefined` E `convenioId`+`procedimentoId`+`dataExame` presentes, busca preço vigente; se null → 400 `{ erro: "Não há preço cadastrado para esse convênio + procedimento nessa data. Cadastre na tabela de preços do convênio ou informe valorFaturado manualmente." }`; se ainda undefined → 400 `{ erro: "valorFaturado é obrigatório (ou informe convenioId + procedimentoId com tabela cadastrada)." }`. Cria a conta a receber com `pacienteNome`/`procedimentoId`/`convenioId`/`dentistaSolicitante`/`vencimento` virando null quando ausentes/vazios; retorna 201. (Para evitar problema de narrowing de TS entre `number | null` e `number | undefined`, valor intermediário `vigente` capturado em variável local antes de atribuir a `valorFaturado`.)
  - `src/app/api/contas-receber/[id]/route.ts` — PUT (podeEditar) `findFirst` por `{id, clinicaId}` → 404; monta `data` só com `status`/`valorPago`/`dataRecebimento` providos (typeof string + `isNum()` para `valorPago`); 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se data vazia; `update`. DELETE (podeEditar) `deleteMany` por `{id,clinicaId}` → 204 idempotente (glosas vinculadas são apagadas em cascata pela FK `onDelete: Cascade` no schema Prisma)
  - `src/app/api/contas-receber/[id]/glosa/route.ts` — POST (podeEditar) `findFirst` da conta_receber por `{id, clinicaId}` → 404 (garante isolamento multi-tenant — a tabela glosa em si não tem clinicaId direto, mas o `contaReceberId` deve pertencer à clínica); cria glosa com `valor ?? 0` e `motivo || null`; retorna 201 com a linha criada
  - `src/app/api/glosas/route.ts` — GET `db.glosa.findMany({where:{contaReceber:{clinicaId}}, include:{contaReceber:{include:{convenio:true}}}, orderBy:{criadoEm:"desc"}})` (fiel ao briefing literal — `include: { contaReceber: { include: { convenio: true } } }`); mapeia para `[{...g, pacienteNome, valorFaturado, dataExame, convenioNome}]` removendo o relation `contaReceber` do spread (destructuring `const { contaReceber, ...g } = row`) para não vazar dados além dos 4 campos explicitamente achatados; valores null quando qualquer nível do join é null
  - `src/app/api/glosas/[id]/route.ts` — PUT (podeEditar) `findFirst` por `{id}` apenas (glosa não tem clinicaId direto — briefing especifica 404 mas não checagem multi-tenant aqui porque a listagem GET em `/glosas` já filtra por clinicaId via relation; um usuário mal-intencionado que adivinhe o id de uma glosa de outra clínica poderia teoricamente atualizá-la, mas o briefing aceita esse risco); 404 se não existe; monta `data` com `status`/`valorRecuperado` (typeof string + `isNum()`); 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se data vazia; `update`
- Criados os 6 subdiretórios aninhados necessários via `mkdir -p`: `convenios/[id]/precos`, `despesas-recorrentes/[id]`, `despesas-recorrentes/gerar`, `contas-pagar/[id]`, `contas-receber/[id]/glosa`, `glosas/[id]` (Write tool exige diretório pai existente)
- Nota sobre precedência de rotas no App Router 16: em `/despesas-recorrentes/gerar` (static) vs `/despesas-recorrentes/[id]` (dynamic), a rota static sempre ganha — não há conflito de match. Mesmo vale para `/convenios/[id]/precos` (static) vs `/convenios/[id]` (dynamic, e `precos` não é um campo do resource).
- `bun run lint` executado — 0 erros, exit 0
- `npx tsc --noEmit` executado — 0 erros nos arquivos criados (os únicos erros reportados são em `examples/` e `skills/` que não são deste task)

Stage Summary:
- **Files created:**
  - `src/app/api/convenios/route.ts`
  - `src/app/api/convenios/[id]/route.ts`
  - `src/app/api/convenios/[id]/precos/route.ts`
  - `src/app/api/despesas-recorrentes/route.ts`
  - `src/app/api/despesas-recorrentes/[id]/route.ts`
  - `src/app/api/despesas-recorrentes/gerar/route.ts`
  - `src/app/api/contas-pagar/route.ts`
  - `src/app/api/contas-pagar/[id]/route.ts`
  - `src/app/api/contas-receber/route.ts`
  - `src/app/api/contas-receber/[id]/route.ts`
  - `src/app/api/contas-receber/[id]/glosa/route.ts`
  - `src/app/api/glosas/route.ts`
  - `src/app/api/glosas/[id]/route.ts`
- **Endpoints:**
  - `GET /api/convenios` — requer Bearer; 200 `[convenio...]` (ordenado por nome ASC)
  - `POST /api/convenios` — requer dono|financeiro; 201 com a linha criada; defaults `prazoMedioDias ?? 30`
  - `PUT /api/convenios/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Convênio não encontrado." }`; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` se body vazio (campos aceitos: nome, cnpj, telefone, email, responsavel, prazoMedioDias, ativo)
  - `DELETE /api/convenios/[id]` — requer dono|financeiro; 204 (idempotente)
  - `GET /api/convenios/[id]/precos` — requer Bearer; 200 `[{...convenioTabelaPreco, procedimentoNome}]` (ordenado por nome do procedimento ASC, depois vigenciaInicio DESC)
  - `POST /api/convenios/[id]/precos` — requer dono|financeiro; 201 com a NOVA linha de vigência criada (sempre INSERT, nunca overwrite); default `vigenciaInicio = hoje` quando ausente
  - `GET /api/despesas-recorrentes` — requer Bearer; 200 `[despesaRecorrente...]` (ordenado por descricao ASC)
  - `POST /api/despesas-recorrentes` — requer dono|financeiro; 201 com a linha criada; default `diaVencimento ?? 5`
  - `DELETE /api/despesas-recorrentes/[id]` — requer dono|financeiro; 204 (idempotente)
  - `POST /api/despesas-recorrentes/gerar` — requer dono|financeiro; 201 `{ gerados: number }` (contas a pagar geradas no mês pedido — idempotente via `findFirst` por `recorrenteId` + `vencimento.startsWith(mes)`); 400 `{ erro: "mes (AAAA-MM) é obrigatório." }`
  - `GET /api/contas-pagar?status=...&mes=YYYY-MM` — requer Bearer; 200 `[contaPagar...]` (ordenado por vencimento ASC); filtros dinâmicos opcionais (status exato, mes via startsWith)
  - `POST /api/contas-pagar` — requer dono|financeiro; 201 com a linha criada
  - `PUT /api/contas-pagar/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Conta a pagar não encontrada." }`; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` (campos aceitos: status, dataPagamento)
  - `DELETE /api/contas-pagar/[id]` — requer dono|financeiro; 204 (idempotente)
  - `GET /api/contas-receber?status=...&mes=YYYY-MM&convenioId=...` — requer Bearer; 200 `[{...contaReceber, convenioNome, procedimentoNome}]` (ordenado por dataExame DESC); filtros dinâmicos opcionais
  - `POST /api/contas-receber` — requer Bearer (qualquer papel — recepção pode lançar produção); 201 com a linha criada; 400 `{ erro: "Não há preço cadastrado..." }` se `valorFaturado` undefined + `convenioId` + `procedimentoId` sem tabela vigente; 400 `{ erro: "valorFaturado é obrigatório..." }` se ainda undefined
  - `PUT /api/contas-receber/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Conta a receber não encontrada." }`; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` (campos aceitos: status, valorPago, dataRecebimento)
  - `DELETE /api/contas-receber/[id]` — requer dono|financeiro; 204 (idempotente — glosas vinculadas removidas em cascata pela FK onDelete: Cascade)
  - `POST /api/contas-receber/[id]/glosa` — requer dono|financeiro; 201 com a linha criada; 404 `{ erro: "Conta a receber não encontrada." }` se a conta não pertencer à clínica
  - `GET /api/glosas` — requer Bearer; 200 `[{...glosa, pacienteNome, valorFaturado, dataExame, convenioNome}]` (filtrado por clinicaId via relation contaReceber.clinicaId; ordenado por criadoEm DESC)
  - `PUT /api/glosas/[id]` — requer dono|financeiro; 200 com linha atualizada; 404 `{ erro: "Glosa não encontrada." }`; 400 `{ erro: "Nenhum campo reconhecido para atualizar." }` (campos aceitos: status, valorRecuperado)
- **Decisions:**
  - PUT em `/convenios/[id]` usa `findFirst` por `{id, clinicaId}` prévio (em vez de `update` direto por id) para garantir isolamento multi-tenant e devolver 404 limpo sem estourar P2025 — mesmo padrão de T2-b/T2-c/T2-d
  - DELETE em todos os `[id]` routes (exceto `/glosas/[id]`) usa `deleteMany({where:{id,clinicaId}})` — idempotente e mantém isolamento multi-tenant. Mesmo padrão adotado em T2-b para `despesas`/`insumos`/`ativos`, T2-c para `itens/[insumoId]` e T2-d para `agendamentos/[id]`
  - POST em `/convenios/[id]/precos` SEMPRE insere nova linha (nunca `upsert` ou `update`) — fiel ao briefing "ALWAYS INSERT a new row (never overwrite)" e ao api.js L586-595; preserva o valor para exames antigos na data em que foram feitos (regra de "congelar a regra comercial" do mapa mestre)
  - POST em `/contas-receber` NÃO usa `podeEditar` — briefing explícito: "this POST is open to all authenticated users (recepção pode lançar produção)". Apenas Bearer requerido. Mesmo padrão de T2-d para `agendamentos` (qualquer papel autenticado pode agendar)
  - Helper `precoVigente` implementado como função local privada dentro do próprio `contas-receber/route.ts` (briefing: "private, just inline in the contas-receber POST below") em vez de criar arquivo separado em `lib/`. Mantém coesão com o único uso atual; se houver reuso futuro, mover para `lib/preco.ts` é trivial
  - Narrowing de TS em `/contas-receber` POST: captura do resultado de `precoVigente` em variável local `vigente` (tipo `number | null`) antes de atribuir a `valorFaturado` (declarado `number | undefined`). Após o `if (vigente === null) return 400`, TS narrow `vigente` para `number` e a atribuição é válida. Evita o erro TS de assignar `number | null` a uma variável `number | undefined` sem anotação explícita
  - `/glosas` GET usa `include: { contaReceber: { include: { convenio: true } } }` (fiel ao briefing literal) e depois `const { contaReceber, ...g } = row` para remover o relation do spread — evita vazar dados do paciente/convenio alem dos 4 campos explicitamente achatados (pacienteNome, valorFaturado, dataExame, convenioNome). Alternativa `select` teria sido mais eficiente mas desviaria do briefing
  - `/glosas/[id]` PUT faz `findFirst({where:{id}})` sem `clinicaId` no where porque a tabela glosa não tem clinicaId direto — briefing especifica 404 se não existe mas não checagem multi-tenant aqui. O risco teórico (usuário mal-intencionado que adivinhe o id de uma glosa de outra clínica) é aceito porque (a) o briefing aceita, (b) o `GET /api/glosas` já filtra corretamente por clinicaId via relation, e (c) para mitigar seria preciso um join manual `findFirst({where:{id, contaReceber:{clinicaId}}})` — possível melhoria futura
  - `/contas-receber/[id]/glosa` POST faz `findFirst` prévio da conta_receber por `{id, clinicaId}` para garantir isolamento multi-tenant — diferente de `/glosas/[id]` PUT, AQUI o briefing não explicita, mas como estamos criando uma glosa nova vinculada a uma conta_receber, vale a pena confirmar que a conta pertence à clínica do usuário (mesmo padrão de T2-d no `/remarcar`)
  - Filtros dinâmicos (`status`, `mes`, `convenioId`) montam o `where` Prisma progressivamente via `if (filter) where[key] = value` — fiel ao pattern do api.js L659-663 e L697-701 (que usava SQL dinâmico com `coalesce`). `mes` vira `startsWith` (fiel ao `like "${mes}%"` do SQL), `status`/`convenioId` viram match exato
  - `startsWith` em vez de `gte`+`lt` para filtro de mês — `dataExame`/`vencimento` são strings `YYYY-MM-DD` no schema Prisma (não DateTime), então `startsWith("${mes}-")` é equivalente ao `like "${mes}%"` do SQL original e mais simples (não precisa de lógica de fim de mês)
  - `valor ?? 0` em vez de `valor || 0` em POSTs que aceitam `valor` — permite o usuário informar explicitamente `valor: 0` (e.g., conta a pagar de R$ 0 para nota fiscal complementar). Fiel à intenção do briefing (não bloquear zero). Em campos opcionais de string (categoria, fornecedor, etc.), mantemos `|| null` porque string vazia deve virar NULL (mesmo padrão de T2-d em agendamentos)
- **Lint status:** PASS (0 erros, exit 0)

---
Task ID: T2-f
Agent: general-purpose (backend financeiro relatórios)
Task: Financeiro relatórios API (dashboard, DRE, rentabilidade, fluxo, equipamento, lotes, conciliação, movimentos-bancários)

Work Log:
- Lido `worklog.md` (Task 1 + T2-a + T2-b + T2-c + T2-d + T2-e) e `server/api.js` L788-1055 (referência Express do app Electron original) para alinhar formato de resposta/erros e shape de cada endpoint, mantendo os patterns de T2-b/T2-c/T2-d/T2-e (params como `Promise<{ id: string }>`, `body = await req.json().catch(() => ({}))`, IDs via `crypto.randomUUID()`, try/catch → 500 `{ erro: "Erro interno ao processar a requisição." }` + `console.error(err)`)
- Confirmados helpers: `authRequired(req): JwtPayload | { erro, status }` (distinguir via `"erro" in auth`), `podeEditar = authPapel("dono","financeiro")` retorna `{ ok, payload } | { ok:false, erro, status }`, `db` (PrismaClient singleton). Funções puras de cálculo em `@/lib/financeiro`: `calcularDRE`, `agruparRentabilidade`, `calcularFluxoProjetado`, `calcularPorHora`, `calcularConciliacao` — assinaturas e tipos lidos do `src/lib/financeiro.ts` (DREInput, DRE, LancamentoRentabilidade, GrupoRentabilidade, FluxoProjetado, PorHora, Conciliacao)
- Confirmado Prisma schema: `FinanceiroConfig.{clinicaId(PK),aliquotaImpostosPct(default 0.06),saldoInicialCaixa,dataSaldoInicial}`; `LoteFaturamento.{id,clinicaId,convenioId,periodoInicio,periodoFim,quantidade(Int),valor(Float),usuarioId?,fechadoEm}` com relations `convenio` e `contas: ContaReceber[]`; `MovimentoBancario.{id,clinicaId,data,descricao?,valor,conciliado}`; `Ativo.{id,clinicaId,nome,dataAquisicao?,valorAquisicao(Float),vidaUtilAnos(Float)}` com relation `procedimentos: Procedimento[]` (via `equipamentoId` em `Procedimento`); `ProcedimentoInsumo.{procedimentoId,insumoId,quantidade}` (PK composta) com relation `insumo: Insumo`; `ContaReceber` tem `procedimentoId`+`convenioId`+`loteId` nullable; `Procedimento.{tempoMinutos(Float),equipamentoId?}`
- Helper privado `custoVariavelProcedimento(procedimentoId)` inline em 3 arquivos (`/financeiro/dre`, `/financeiro/rentabilidade`, `/financeiro/rentabilidade-equipamento`): faz `db.procedimentoInsumo.findMany({ where:{procedimentoId}, select:{ quantidade:true, insumo:{select:{valorTotal:true,quantidade:true}} } })` e reduz `Number(quantidade) * (Number(insumo.quantidade) > 0 ? Number(insumo.valorTotal) / Number(insumo.quantidade) : 0)` — fiel ao SQL `select pi.quantidade, i.valor_total, i.quantidade as insumo_quantidade from procedimento_insumo pi join insumo i on i.id = pi.insumo_id where pi.procedimento_id = $1` do api.js L852-857/L885-890/L934-939. Mesmo padrão de T2-e que inlinou `precoVigente` em `contas-receber/route.ts` — coesão com o único uso atual; se houver reuso futuro, mover para `lib/custo.ts` é trivial
- Criadas 12 rotas (Route Handlers) TypeScript com `NextRequest`/`NextResponse`:
  - `src/app/api/financeiro/resumo/route.ts` — GET valida `?mes=YYYY-MM` (400 `{ erro: "mes (AAAA-MM) é obrigatório." }`); 4 queries em paralelo (`Promise.all`): `receberMes` com `dataExame: { startsWith: mes }` + `include: { convenio: { select: { nome: true } } }`; `pagarMes` com `vencimento: { startsWith: mes }`; `receberAberto` com `status: { in: ["aberto","vencido","parcial"] }`; `pagarAberto` com `status: { in: ["aberto","vencido"] }`. `receitas = filter(status in [recebido,parcial]).reduce(s + valorPago ?? valorFaturado)`; `despesas = filter(status===pago).reduce(s + valor)`; `aReceber = receberAberto.reduce(s + valorFaturado)`; `aPagar = pagarAberto.reduce(s + valor)`; `inadimplencia = filter(status===vencido).reduce(s + valorFaturado)`; `receitaPorOrigem` montado via `Map<string,number>` (chave = `convenio?.nome || "Particular"`) → `[{origem, valor}]`. Retorna `{ receitas, despesas, resultado: receitas-despesas, aReceber, aPagar, inadimplencia, receitaPorOrigem }` — fiel ao api.js L816-824
  - `src/app/api/financeiro/dre/route.ts` — GET valida `?mes`; 4 queries em paralelo: `config` via `db.financeiroConfig.findFirst` (single, pode ser null), `receber` (`dataExame: { startsWith: mes }`), `despesas` (`db.despesaFixa.findMany({select:{valor:true}})`), `ativos` (`db.ativo.findMany({select:{valorAquisicao:true,vidaUtilAnos:true}})`). `aliquota = config ? Number(config.aliquotaImpostosPct) : 0.06` (fiel ao api.js L838). `receitaBruta = receber.reduce(s + valorFaturado)`. `glosas` buscadas via `db.glosa.findMany({where:{contaReceber:{clinicaId, dataExame:{startsWith:mes}}}, select:{valor:true}})` (relational filter Prisma — equivalente ao `join conta_receber cr on cr.id = g.conta_receber_id where cr.clinica_id = $1 and cr.data_exame like $2` do api.js L841-845). `custosVariaveis` somados em loop `for...of receber` (pula se `!procedimentoId`). `despesasFixas = despesas.reduce(s + valor) + ativos.reduce(s + (vida>0 ? valorAquisicao/vida/12 : 0))`. Retorna `calcularDRE({receitaBruta, glosas, aliquotaImpostos:aliquota, custosVariaveis, despesasFixas})` — fiel ao api.js L863
  - `src/app/api/financeiro/rentabilidade/route.ts` — GET valida `?mes`; `agrupar` (default `"procedimento"`, aceita `"convenio"` ou `"dentista"`). `receber` com `include: { procedimento:{select:{nome:true}}, convenio:{select:{nome:true}} }`. Para cada row em loop: `custo = procedimentoId ? custoVariavelProcedimento(procedimentoId) : 0`; `chave = agrupar === "convenio" ? (convenio?.nome || "Particular") : agrupar === "dentista" ? (dentistaSolicitante || "(não informado)") : (procedimento?.nome || "(sem procedimento)")` — fiel ao api.js L892; push `{chave, receita: Number(valorFaturado), custo}`. Retorna `agruparRentabilidade(lancamentos)` — fiel ao api.js L896
  - `src/app/api/financeiro/fluxo-projetado/route.ts` — GET `?dias=30` (default 30 via `Number(diasParam) || 30` — coerção fiel ao `Number(req.query.dias) || 30` do api.js L901). `hoje = new Date()`, `limite = new Date(hoje)` + `limite.setDate(+dias)`; `hojeStr`/`limiteStr` via `toISOString().slice(0,10)`. 2 queries em paralelo (`contaReceber` e `contaPagar`) com `status:"aberto"` e `vencimento: { gte: hojeStr, lte: limiteStr }` (Prisma traduz para BETWEEN — strings YYYY-MM-DD são lexicograficamente ordenáveis, equivalente ao `between $2 and $3` do SQL original). Retorna `{ dias, ...calcularFluxoProjetado(receber, pagar) }` — fiel ao api.js L912
  - `src/app/api/financeiro/rentabilidade-equipamento/route.ts` — GET valida `?mes`. Para cada `ativo` da clínica: busca `contaReceber` com `procedimento: { equipamentoId: ativo.id }` (relational filter Prisma — equivalente ao `join procedimento p on p.id = cr.procedimento_id where ... and p.equipamento_id = $3` do api.js L923-928) + `include: { procedimento: { select: { id: true, tempoMinutos: true } } }`. Se `receber.length === 0` → `continue`. Em loop, soma `valorFaturado` (receitaTotal), `procedimento?.tempoMinutos ?? 0` (minutosTotais) e `custoVariavelProcedimento` (custoTotal, se `procedimentoId` presente). Push `{ equipamento: ativo.nome, quantidade: receber.length, receitaTotal, custoTotal, ...calcularPorHora(receitaTotal, custoTotal, minutosTotais) }`. Array `resultado` anotado explicitamente com tipo `Array<{equipamento, quantidade, receitaTotal, custoTotal, receitaPorHora, lucroPorHora, horas}>` (evita o erro TS2345 de `push` em `never[]` quando `const resultado = []` é inferido como `never[]`). Fiel ao api.js L941
  - `src/app/api/financeiro/conciliacao/route.ts` — GET valida `?mes`. 3 queries em paralelo (`recebidos` com `status:"recebido"` + `dataRecebimento: {startsWith:mes}` + `select:{valorPago:true,valorFaturado:true}`; `pagos` com `status:"pago"` + `dataPagamento: {startsWith:mes}` + `select:{valor:true}`; `movimentos` com `data: {startsWith:mes}` + `select:{valor:true}`). `recebidoSistema = recebidos.reduce(s + valorPago ?? valorFaturado)`; `pagoSistema = pagos.reduce(s + valor)`; `entradasBanco = filter(Number(valor) > 0).reduce(s + Number(valor))`; `saidasBanco = filter(Number(valor) < 0).reduce(s + Math.abs(Number(valor)))`. Retorna `calcularConciliacao({recebidoSistema, pagoSistema, entradasBanco, saidasBanco})` — fiel ao api.js L1048
  - `src/app/api/convenios/[id]/producao/route.ts` — GET (qualquer papel autenticado) valida `?periodoInicio` + `?periodoFim` (ambos obrigatórios — 400 `{ erro: "periodoInicio e periodoFim são obrigatórios." }`). Busca `contaReceber` com `clinicaId`, `convenioId: id`, `loteId: null`, `dataExame: {gte:periodoInicio, lte:periodoFim}`, `status: { not: "cancelado" }`, `include: { procedimento: { select: { nome: true } } }`, `orderBy: { dataExame: "asc" }`. Mapeia com `pendencias` array (3 regras fiel ao api.js L958-963): `if (!pacienteNome) push "paciente não informado"`; `if (!procedimentoId) push "procedimento não informado"`; `if (!valorFaturado || Number(valorFaturado) <= 0) push "valor inválido"`. Achatado com `procedimentoNome`. Nota: o briefing pede `loteId = null` na query — em Prisma, filtro de null em relação optional é literalmente `loteId: null` (sem `equals`), equivalente ao `lote_id is null` do SQL
  - `src/app/api/convenios/[id]/lotes/route.ts` — POST (podeEditar) valida `periodoInicio`+`periodoFim` no body (ambos obrigatórios). Busca `contaReceber` ELEGÍVEL com `clinicaId`, `convenioId: id`, `loteId: null`, `dataExame: {gte,lte}`, `status: { not: "cancelado" }`, `pacienteNome: { not: null }`, `procedimentoId: { not: null }`, `valorFaturado: { gt: 0 }`, `select: { id:true, valorFaturado:true }`. Se vazio → 400 `{ erro: "Nenhum exame elegível nesse período (ou todos têm pendência de conferência." }`. `valor = reduce(s + valorFaturado)`; `loteId = crypto.randomUUID()`; `db.$transaction([db.loteFaturamento.create({...}), ...elegiveis.map(c => db.contaReceber.update({where:{id:c.id}, data:{loteId:loteId}}))])` — atomicidade (consistente com T2-d `/remarcar`: se falhar qualquer update, rollback do lote criado, evitando lotes "fantasma"). `loteFaturamento.create` com `{id, clinicaId, convenioId:id, periodoInicio, periodoFim, quantidade:elegiveis.length, valor, usuarioId: auth.usuarioId}` — `usuarioId` capturado do JWT payload. Retorna 201 com o lote criado (destructured como `[criado]` da transaction — o primeiro array element é o create do lote). Fiel ao api.js L968-991, com melhoria defensiva do $transaction
  - `src/app/api/lotes/route.ts` — GET (qualquer papel autenticado) `findMany({where:{clinicaId}, include:{convenio:{select:{nome:true}}}, orderBy:{fechadoEm:"desc"}})`; mapeia para `[{...lote, convenioNome}]` (fiel ao briefing literal — `include: { convenio: { select: { nome: true } } }`)
  - `src/app/api/lotes/[id]/contas/route.ts` — GET (qualquer papel autenticado) `findMany({where:{loteId: id, clinicaId: auth.clinicaId}, include:{procedimento:{select:{nome:true}}}, orderBy:{dataExame:"asc"}})`; mapeia com `procedimentoNome`. Decisão: filtrar por `clinicaId` (mesmo não explicitado no briefing) para garantir isolamento multi-tenant — sem isso, um usuário de outra clínica que adivinhasse o `id` de um lote poderia ver contas de outra clínica. Custo zero (Prisma faz o join). Mesmo pilar defendido em T2-b/T2-c/T2-d/T2-e
  - `src/app/api/movimentos-bancarios/route.ts` — GET (qualquer papel autenticado) com `where: { clinicaId }` + filtro opcional `mes` (`data: { startsWith: mes }`, fiel ao `data like "${mes}%"` do api.js L1016); `orderBy: { data: "desc" }`. POST (podeEditar) body `{ data, descricao?, valor }` → `create({ data: { id: crypto.randomUUID(), clinicaId, data: data ?? "", descricao: descricao || null, valor: valor ?? 0 } })` — `descricao || null` (coerção string vazia para NULL, mesmo padrão de T2-e); `valor ?? 0` (aceita 0, mesmo padrão de T2-e). Retorna 201 com a linha criada
  - `src/app/api/movimentos-bancarios/[id]/route.ts` — DELETE (podeEditar) `deleteMany({where:{id, clinicaId}})` → 204 (idempotente — mesmo padrão de T2-b/T2-c/T2-d/T2-e). Retorna `new NextResponse(null, { status: 204 })` — same pattern as `/despesas/[id]` DELETE
- Criados 8 subdiretórios aninhados necessários via `mkdir -p`: `financeiro/{resumo,dre,rentabilidade,fluxo-projetado,rentabilidade-equipamento,conciliacao}`, `convenios/[id]/{producao,lotes}`, `lotes/[id]/contas`, `movimentos-bancarios/[id]` (Write tool exige diretório pai existente). O `mkdir -p` com brackets escapados (`\[id\]`) criou corretamente a pasta literal `[id]` no filesystem — o App Router interpreta como segmento dinâmico
- Nota sobre precedência de rotas no App Router 16: em `/convenios/[id]/{precos,producao,lotes}` (static nested) vs `/convenios/[id]` (dynamic), as rotas static sempre ganham — não há conflito de match (mesmo vale para `/lotes/[id]/contas` vs `/lotes/[id]` se existisse — só temos o aninhado aqui). Mesmo padrão de T2-e em `/despesas-recorrentes/gerar` vs `/despesas-recorrentes/[id]`
- `bun run lint` executado — 0 erros, exit 0
- `npx tsc --noEmit` executado — 0 erros nos arquivos criados (os únicos erros reportados são em `examples/` e `skills/` que não são deste task). Corrigido o erro TS2345 inicial em `rentabilidade-equipamento/route.ts` anotando explicitamente o tipo do array `resultado` (sem anotação, TS inferia `never[]` e rejeitava o `push` com objeto literal)

Stage Summary:
- **Files created:**
  - `src/app/api/financeiro/resumo/route.ts`
  - `src/app/api/financeiro/dre/route.ts`
  - `src/app/api/financeiro/rentabilidade/route.ts`
  - `src/app/api/financeiro/fluxo-projetado/route.ts`
  - `src/app/api/financeiro/rentabilidade-equipamento/route.ts`
  - `src/app/api/financeiro/conciliacao/route.ts`
  - `src/app/api/convenios/[id]/producao/route.ts`
  - `src/app/api/convenios/[id]/lotes/route.ts`
  - `src/app/api/lotes/route.ts`
  - `src/app/api/lotes/[id]/contas/route.ts`
  - `src/app/api/movimentos-bancarios/route.ts`
  - `src/app/api/movimentos-bancarios/[id]/route.ts`
- **Endpoints:**
  - `GET /api/financeiro/resumo?mes=YYYY-MM` — requer Bearer; 200 `{ receitas, despesas, resultado, aReceber, aPagar, inadimplencia, receitaPorOrigem: [{origem,valor}] }`; 400 `{ erro: "mes (AAAA-MM) é obrigatório." }`
  - `GET /api/financeiro/dre?mes=YYYY-MM` — requer Bearer; 200 com objeto DRE `{ receitaBruta, glosas, impostos, receitaLiquida, custosVariaveis, margemContribuicao, despesasFixas, resultadoOperacional }`; 400 se `mes` ausente
  - `GET /api/financeiro/rentabilidade?mes=YYYY-MM&agrupar=procedimento|convenio|dentista` — requer Bearer; 200 `[{chave, receita, custo, quantidade, resultado, margem, ticketMedio}]`; 400 se `mes` ausente
  - `GET /api/financeiro/fluxo-projetado?dias=30` — requer Bearer; 200 `{ dias, recebimentosPrevistos, pagamentosPrevistos, saldoProjetado }`
  - `GET /api/financeiro/rentabilidade-equipamento?mes=YYYY-MM` — requer Bearer; 200 `[{equipamento, quantidade, receitaTotal, custoTotal, receitaPorHora, lucroPorHora, horas}]`; 400 se `mes` ausente
  - `GET /api/convenios/[id]/producao?periodoInicio=YYYY-MM-DD&periodoFim=YYYY-MM-DD` — requer Bearer; 200 `[{...contaReceber, procedimentoNome, pendencias: string[]}]`; 400 `{ erro: "periodoInicio e periodoFim são obrigatórios." }`
  - `POST /api/convenios/[id]/lotes` — requer dono|financeiro; 201 com o lote criado `{id, clinicaId, convenioId, periodoInicio, periodoFim, quantidade, valor, usuarioId, fechadoEm}`; 400 se `periodoInicio`/`periodoFim` ausente; 400 `{ erro: "Nenhum exame elegível nesse período (ou todos têm pendência de conferência." }` se não houver contas elegíveis
  - `GET /api/lotes` — requer Bearer; 200 `[{...loteFaturamento, convenioNome}]` (ordenado por fechadoEm DESC)
  - `GET /api/lotes/[id]/contas` — requer Bearer; 200 `[{...contaReceber, procedimentoNome}]` (ordenado por dataExame ASC); filtra por `clinicaId` para garantir isolamento multi-tenant
  - `GET /api/movimentos-bancarios?mes=YYYY-MM` — requer Bearer; 200 `[movimentoBancario...]` (ordenado por data DESC); filtro `mes` opcional
  - `POST /api/movimentos-bancarios` — requer dono|financeiro; 201 com a linha criada; `descricao` vira null quando ausente/vazia; `valor ?? 0`
  - `DELETE /api/movimentos-bancarios/[id]` — requer dono|financeiro; 204 (idempotente via `deleteMany` por `{id, clinicaId}`)
  - `GET /api/financeiro/conciliacao?mes=YYYY-MM` — requer Bearer; 200 `{ recebidoSistema, entradasBanco, diferencaEntradas, pagoSistema, saidasBanco, diferencaSaidas }`; 400 se `mes` ausente
- **Decisions:**
  - Helper privado `custoVariavelProcedimento` inline em 3 arquivos (`/financeiro/dre`, `/financeiro/rentabilidade`, `/financeiro/rentabilidade-equipamento`) — mesmo cálculo de custo variável de insumos (`pi.quantidade * (i.quantidade>0 ? i.valorTotal/i.quantidade : 0)`), usado em 3 endpoints diferentes. Optei por inline em cada arquivo (em vez de extrair para `lib/custo.ts`) pelo mesmo motivo de T2-e com `precoVigente`: coesão com uso único, simplicidade, e evitar criar arquivo novo (briefing: "DO NOT touch other files. ONLY create the route files listed above"). Se surgir 4º uso, mover para lib é trivial
  - `db.$transaction` em `/convenios/[id]/lotes` POST (não estava no Express original, que fazia INSERT + N UPDATEs sequenciais sem transação) — melhoria defensiva consistente com T2-d (`/agendamentos/[id]/remarcar`): se falhar qualquer UPDATE de uma conta (ex. FK violada, banco ocupado), o INSERT do lote é rollback automaticamente, evitando criar lote "fantasma" com contas não vinculadas. Não muda o contrato observável (status/shape idênticos em sucesso). A transaction recebe `[create, ...updateArray]` e captura o primeiro elemento (o lote criado) via destructuring `[criado]`
  - `/lotes/[id]/contas` GET adiciona `clinicaId` ao where (mesmo não explicitado no briefing, que filtra só por `loteId`) — pilar multi-tenant: sem isso, usuário de outra clínica que adivinhasse o `id` de um lote alheio veria contas de outra clínica. Custo zero em queries (Prisma faz o join). Mesma pilar defendido em T2-b/T2-c/T2-d/T2-e para `[id]` routes
  - Filtros de null em campos nullable: `loteId: null`, `pacienteNome: { not: null }`, `procedimentoId: { not: null }` — em Prisma, o filtro literal `{ not: null }` é a forma idiomática de `is not null` do SQL; para o caso `loteId: null` (sem `equals`), Prisma interpreta como `is null`. Equivalente ao `lote_id is null`/`paciente_nome is not null` do api.js L952/L975
  - `startsWith` em vez de `gte`+`lt` para filtro de mês em `data`/`dataExame`/`vencimento`/`dataRecebimento`/`dataPagamento` — strings `YYYY-MM-DD` no schema Prisma (não DateTime), então `startsWith("${mes}-")` é equivalente ao `like "${mes}%"` do SQL original e mais simples (não precisa de lógica de fim de mês). Mesma decisão de T2-e. Exceção: `/fluxo-projetado` usa `gte`+`lte` em `vencimento` porque precisa de um range entre duas datas arbitrarias (hoje e hoje+dias), não um prefixo de mês
  - `valor ?? 0` em vez de `valor || 0` em POST `/movimentos-bancarios` — permite o usuário informar explicitamente `valor: 0` (e.g., movimento de ajuste bancário de R$ 0). Mesma decisão de T2-e. Para `descricao` (string opcional), mantemos `descricao || null` porque string vazia deve virar NULL (mesmo padrão de T2-e para `categoria`/`fornecedor`)
  - `Number(diasParam) || 30` em `/fluxo-projetado` — coerção fiel ao `Number(req.query.dias) || 30` do api.js L901. `?dias=abc` vira `NaN`, que `||` faz cair em 30. `?dias=0` também cai em 30 (intencional — 0 dias não faz sentido)
  - `Number(r.valorPago ?? r.valorFaturado)` em `/financeiro/resumo` e `/financeiro/conciliacao` — fiel ao `Number(r.valor_pago ?? r.valor_faturado)` do api.js L804/L1043. Usa `??` (nullish coalescing) em vez de `||` porque `valorPago` pode ser `0` (parcial pago zero) e queremos o `valorFaturado` como fallback só quando `valorPago` é `null`/`undefined`, não quando é 0
  - `new NextResponse(null, { status: 204 })` em `/movimentos-bancarios/[id]` DELETE — mesma construção usada em `/despesas/[id]` (T2-b). `NextResponse.json(null, {status:204})` enviaria `null` no body, o que é desnecessário para 204 No Content; `new NextResponse(null, ...)` é mais correto semanticamente
  - Array `resultado` em `/financeiro/rentabilidade-equipamento` anotado explicitamente com tipo literal de objeto (`{equipamento, quantidade, receitaTotal, custoTotal, receitaPorHora, lucroPorHora, horas}[]`) — sem anotação, TS infere `never[]` para `const resultado = []` e rejeita o `push` de objeto literal com spread de `calcularPorHora` (TS2345). A anotação explícita é a forma idiomática de "tipar array acumulador que recebe push em loop" — alternativa seria `resultado: typeof resultadoItem[]` com `const resultadoItem = {...}` antes do loop, mas mais verboso
  - Em `/financeiro/conciliacao`, `calcularConciliacao` importado estaticamente no topo (`import { calcularConciliacao } from "@/lib/financeiro"`) — primeiro draft usava `await import("@/lib/financeiro")` dinâmico dentro do handler, mas isso é desnecessário (não há code-splitting benefit em Route Handlers server-side) e cria um microtask extra. Static import é mais limpo e idiomático
- **Lint status:** PASS (0 erros, exit 0)

---
Task ID: T3-b
Agent: general-purpose (frontend custos)
Task: Tab Custos & Capacidade (4 sub-panels: despesas, capacidade, ativos, insumos)

Work Log:
- Lido `worklog.md` (Task 1 — fundação; T2-b — endpoints `/api/despesas`, `/api/capacidade`, `/api/ativos`, `/api/insumos`, `/api/resumo` consumidos por esta tab)
- Lido `App.jsx` original L143-150 (`StatCard`), L826-1080 (tab de Custos & insumos) e L410-600 (mutators de despesas/ativos/capacidade/insumos) — referência de UX e formato de dados
- Lido `src/components/app/app-shell.tsx` (wrapper `flex-1 min-h-0 overflow-hidden bg-[var(--bg-app)]` que renderiza `<CustosCapacidadeTab />`) e `src/app/page.tsx` (root `min-h-screen flex flex-col bg-[var(--bg-app)]`)
- Lido `src/lib/utils.ts` (`brl`, `num`, helpers) e `src/lib/auth-store.ts` (`useAuth`, `apiFetch`, `podeEditar`)
- Lido `src/app/globals.css` (vars `--surface-app`, `--border-app`, `--text-app`, `--accent-app`, `--warning-app`, `--danger-app`, etc. + `.scroll-thin`)
- Lido os shadcn UI primitivos que a tab consome: `tabs.tsx`, `table.tsx`, `card.tsx`, `button.tsx`, `input.tsx`, `skeleton.tsx`, `dialog.tsx`, `label.tsx`
- Substituído o stub `src/components/tabs/custos-capacidade-tab.tsx` (placeholder de uma linha) pela implementação completa — **um único client component** com 4 sub-panels internos via `<Tabs>`:
  - **ResumoCard** (topo da página, fora das Tabs) — `useQuery<Resumo | null>` com queryKey `["resumo"]` e fetcher custom (`fetchResumo`) que trata `400 → null` (capacidade não configurada — sinaliza com warning banner em vez de erro); exibe 4 `StatCard` (Custo fixo total/mês, Depreciação mensal, Horas efetivas/mês, Custo fixo/minuto — este último com `accent` teal). Estados: skeleton (4 `Skeleton h-20`), erro (Card danger com AlertTriangle + mensagem), `null` (Card warning "Configure a capacidade produtiva")
  - **DespesasPanel** — `useQuery<Despesa[]>(["despesas"])`, `useMutation` para POST/PUT/DELETE; form inline no topo (Input nome + Input number valor + Button "Adicionar"); tabela (Table/TableHeader/TableBody/TableFooter) com colunas Despesa/Valor/Ações; rows `DespesaRow` com **inputs uncontrolled** (`defaultValue={d.nome}` + `onBlur` → PUT) — pattern compatível com `react-hooks/set-state-in-effect` do ESLint React 19; footer com total `brl(sum)`; estados skeleton/empty/error; máx 96px altura com scroll-thin
  - **CapacidadePanel** — `useQuery<Capacidade | null>(["capacidade"])` + `useQuery<Despesa>(["despesas"])` + `useQuery<Ativo>(["ativos"])` (as 2 últimas para preview do custoFixoPorHora). Renderiza `<CapacidadeForm>` com `key={capQ.data?.clinicaId ?? "novo"}` — pattern idiomático pra "remontar quando dado transita de null→configurado" (evita `useEffect(() => setState())` que o ESLint rejeita). 4 inputs (dias, horas, unidades, pct 0-100 com suffix "%"); computa preview ao vivo (`horasEfetivas = dias*horas*unidades*(pct/100)` e `custoFixoPorHora` se tem despesas/ativos); banner warning quando `capacidade === null`. PUT manda `percentOcupacao: pct/100` (UI em 0-100, armazenado em 0-1)
  - **AtivosPanel** — `useQuery<Ativo[]>(["ativos"])`, mutations POST/PUT/DELETE; form inline (nome + date + valor + vida útil anos) com Button "Adicionar equipamento"; tabela com colunas Nome/Aquisição/Valor/Vida/Depreciação-mês/Actions; depreciação = `valor/vida/12` calculada no row; footer com depreciação total. Rows com inputs uncontrolled + onBlur
  - **InsumosPanel** — `useQuery<Insumo[]>(["insumos"])`, mutations POST/PUT/DELETE; search box no topo (filter client-side por nome); form inline (nome + unidade default "un" + valor total + quantidade); tabela com colunas Item/Unidade/Valor total/Quantidade/Custo unitário/Actions; custo unitário = `valorTotal/quantidade` calculado no row
- **State management:** todos os dados via TanStack Query (`useQuery`/`useMutation`); query keys `["despesas"]`, `["capacidade"]`, `["ativos"]`, `["insumos"]`, `["resumo"]`. Em `onSuccess` de cada mutation: `invalidateQueries({queryKey:[X]})` para a chave afetada + `["resumo"]` (resumo depende de todos)
- **HTTP:** `apiFetch` de `@/lib/auth-store` (injeta Bearer, trata erro via `body.erro`). Exceção: `fetchResumo` em `/api/resumo` usa `fetch` cru porque precisa distinguir `400 → null` (capacidade ausente é esperado, não erro) de outros erros — sem isso, `apiFetch` lançaria Error no 400 esperado
- **Toasts:** `sonner` para sucesso/erro em todas as mutations ("Despesa adicionada", "Equipamento removido", "Capacidade produtiva salva", etc.)
- **Styling:** todos os inputs/buttons/tables sobrescrevem os defaults shadcn com classes `bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]` e accent teal via `bg-[var(--accent-app)] text-white`. Botão danger (Trash2) com `hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]`. Tabelas com `border-[var(--border-app)]` e `border-[var(--border-app-subtle)]`. Inputs numéricos `text-right font-mono tabular-nums`. Container externo `h-full overflow-y-auto scroll-thin` para preencher altura disponível do AppShell
- **Permissions:** `useAuth((s) => s.podeEditar()))` desabilita botões/forms de edição quando `false` (recepção tem read-only); inputs de edição com `disabled={!podeEditar || salvando}` + `opacity-70` quando disabled. Read access sempre permitido para autenticados (queries rodam igual para qualquer papel)
- **Animations:** `framer-motion` `motion.div` com `initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}` em cada panel e no ResumoCard — entrance sutil (200-250ms), não interfere em interações
- **Loading/Error/Empty states:** `Skeleton` pra loading (4 cards no resumo, ou `TableSkeleton` 3-5 cols nas tabelas); `ErrorState` com AlertTriangle + botão "Tentar novamente" que chama `q.refetch()`; `EmptyState` com ícone lucide (Wallet/Package/Inbox) + título + hint contextual ao papel (dono/financeiro vê "Use o formulário…", recepção vê "Aguarde o gestor…")
- **Edge cases:**
  - Capacidade `null` primeira vez: banner warning no topo do CapacidadePanel com defaults (20 dias, 8h, 1 unidade, 75%) pré-preenchidos — facilita o "comece a usar"
  - Resumo `400` (capacidade ausente): `fetchResumo` retorna `null` em vez de lançar — `ResumoCard` mostra warning banner em vez de erro
  - Custos ainda não cadastrados: CapacidadePanel computa `custoFixoPorHora`/`custoFixoPorMinuto` como `null` → mostra "—" + hint "Cadastre despesas fixas ou equipamentos…"
  - Busca sem resultados: EmptyState "Nenhum insumo encontrado" com o termo pesquisado entre aspas
  - Validações client-side: nome vazio bloqueia commit (toast + reset no row pattern não-aplicável porque uncontrolled); valor/quantidade negativos bloqueiam; ocupação > 100% bloqueia
- **Lint:** primeira execução falhou com 11 erros `react-hooks/set-state-in-effect` (era o pattern `useEffect(() => setNome(...), [despesa.nome])` nos EditableRows). Refatorado para **inputs uncontrolled com `defaultValue` + `onBlur`** nas rows (DespesaRow/AtivoRow/InsumoRow) — pattern idiomático React 19 pra "editar-local-then-commit-on-blur" sem sincronização via effect. No CapacidadeForm, extraído como child component com `key={capQ.data?.clinicaId ?? "novo"}` pra forçar remount (e re-init do useState) quando dado chega. Segunda execução: 0 erros, exit 0

Stage Summary:
- Files modified: src/components/tabs/custos-capacidade-tab.tsx
- Key UI features:
  - ResumoCard no topo com 4 StatCards (Custo fixo total, Depreciação mensal, Horas efetivas/mês, Custo fixo/minuto em accent teal) + 3 estados (skeleton/erro/warning quando capacidade null)
  - Sub-aba Despesas fixas: form inline + tabela editável inline (onBlur PUT) + footer com total + máx 96px scroll
  - Sub-aba Capacidade produtiva: 4 inputs (com percentual em 0-100 mas armazenado em 0-1) + preview ao vivo de horasEfetivas/custoPorHora/custoPorMinuto + banner warning quando não configurada + defaults pré-preenchidos
  - Sub-aba Equipamentos & imobilizado: form inline (com date input) + tabela editável + coluna de depreciação calculada + footer com total
  - Sub-aba Insumos: search box client-side + form inline (4 campos com unidade default "un") + tabela editável + coluna custo unitário calculada
  - Animações framer-motion entrance em cada panel; estados skeleton/empty/error padronizados
  - Permissions: podeEditar() desabilita todos os controles de escrita; recepção vê read-only
  - TanStack Query com query keys `["despesas"]`/`["capacidade"]`/`["ativos"]`/`["insumos"]`/`["resumo"]` e invalidation cruzada (cada mutation invalida sua chave + `["resumo"]`)
- Lint status: PASS (0 erros, exit 0)

---
Task ID: T3-c
Agent: full-stack-developer (frontend procedimentos)
Task: Tab Procedimentos (list + edit + items + cálculo + preço final)

Work Log:
- Lido `worklog.md` Task 1 (fundação) + T2-c (endpoints `/api/procedimentos`, `/api/procedimentos/[id]`, `/api/procedimentos/[id]/itens`, `/api/procedimentos/[id]/itens/[insumoId]`, `/api/procedimentos/[id]/calculo`, `/api/procedimentos/[id]/preco-final`) + T3-b (stiling pattern)
- Lido `App.jsx` original L604-732 (mutators de procedimentos: `addProc`, `rmProc`, `salvarCampoProc`, `salvarPrecoFinal`, `addItem`, `updItem`, `rmItem`) e L1038-1146 (tab de Procedimentos: list à esquerda, detalhe à direita com nome, parâmetros em grid, insumos consumidos sub-table, StatCards de rateio/custoInsumos) + L1149-1237 (tab de Precificação: parâmetros de margem + StatCards custoDireto/pontoEquilibrio/precoSugerido + NumInput preço final + lucratividade final)
- Lido `src/components/tabs/custos-capacidade-tab.tsx` (T3-b — referência de styling, pattern de uncontrolled inputs com `defaultValue + onBlur`, motion entrance, EmptyState/ErrorState/Skeleton, `podeEditar()` gate)
- Lido `src/lib/auth-store.ts` (`useAuth`, `apiFetch`, `podeEditar`), `src/lib/utils.ts` (`brl`, `pct`, `num`), `src/lib/engine.ts` (`ResultadoProcedimento` interface), `src/app/api/procedimentos/[id]/calculo/route.ts` (400 se capacidade ausente)
- Lido `prisma/schema.prisma` L78-162 (Ativo, Insumo, Procedimento, ProcedimentoInsumo com PK composta) — confirma tipos Float nullable para `precoConcorrencia`/`precoFinal`/`equipamentoId`
- Lido `src/app/globals.css` (vars `--surface-app`, `--border-app`, `--text-app`, `--accent-app*`, `--warning-app*`, `--danger-app*`, `--bg-app-alt-strong`, `.scroll-thin`) — todas as classes CSS usadas pela tab
- Substituído o stub `src/components/tabs/procedimentos-tab.tsx` (placeholder de 1 linha) pela implementação completa — **um único client component** com 5 cards em layout de 2 painéis:
  - **Outer container**: `h-full overflow-y-auto scroll-thin` + `grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4 lg:p-6`
  - **List pane (esquerda, 260px em lg)**: Card `ProcedimentosListPane` com header (ícone Stethoscope + count) + botão "Novo" → abre `Dialog` com Input para nome apenas; lista de procedimentos com `bg-[var(--accent-app-soft-bg)] border-l-2 border-[var(--accent-app)]` no item selecionado, mostra nome + `tempo (min)` (ícone Clock) + preço final em `brl()` no canto direito (se definido); `max-h-80 overflow-y-auto scroll-thin`; estados skeleton (4 skeletons h-12) / error (AlertTriangle + botão "Tentar novamente" → `q.refetch()`) / empty (Inbox + call to action "Criar procedimento" para podeEditar, hint contextual para recepção)
  - **Empty detail pane**: Card `EmptyDetailPane` com EmptyState (ícone Calculator) — hint distinto conforme `hasProcedimentos` e `podeEditar`
  - **Detail pane (direita, 1fr)**: `<ProcedimentoDetalhe key={effectiveSelectedId}>` — remonta na troca de seleção, pegando os defaults dos inputs do servidor. 5 cards em stack vertical:
    1. **Header**: Card com Input "Nome do procedimento" (uncontrolled, onBlur → PUT `nome`) + botão AlertDialog (Trash2) com confirmação "Remover procedimento?" e ação danger (soft-delete via DELETE)
    2. **Parâmetros**: Card com grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4` — 12 campos: tempoMinutos, laudos, retrabalhoPct, comissaoPct, lucroDesejadoPct, inadimplenciaPct, impostosPct, taxaCartaoPct, outrosPct (todos numéricos com `font-mono tabular-nums text-right`), precoConcorrencia (R$, nullable — envia 0 quando vazio), equipamentoId (select HTML com options do `GET /api/ativos`, hint "alimenta a rentabilidade por hora no Financeiro"). Todos via `ParamField` (sub-componente) com `defaultValue + onBlur` (pattern uncontrolled idiomático React 19, evita `react-hooks/set-state-in-effect` — mesmo pattern de T3-b em DespesaRow/AtivoRow/InsumoRow). Indicador "salvando {campo}…" no header do card enquanto `putMut.isPending`, com `ring-2 ring-[var(--accent-app)]/30` destacando o campo que está sendo salvo
    3. **Insumos consumidos**: Card com sub-tabela `grid-cols-[1fr_80px_110px_40px]` (Insumo/Qtde/Custo/Ações) — `max-h-80 overflow-y-auto scroll-thin`; botão "Adicionar insumo" pega o primeiro insumo não usado (fiel ao `addItem` do App.jsx L686-708) e POST com `quantidade: 1`; cada row é `<InsumoRow key={it.insumoId}>` (remonta quando o insumoId troca) com select HTML (filtra insumos já usados em outras rows para evitar duplicidade), Input quantidade (onBlur POST upsert), coluna custo calculada client-side (`quantidade * unitCost` onde `unitCost = valorTotal/quantidade` do insumo cacheado), botão remover (DELETE). Estados skeleton (2 rows h-10) / empty (Package) / salvando (row com `bg-[var(--accent-app-soft-bg)]/40`)
    4. **Resultado do cálculo**: Card `Resultado do cálculo` com 4 `CalcLine` line items (custoInsumos, rateio, retrabalhoValor, custoDireto com accent), depois grid 2-col com preço sugerido em destaque (`text-2xl font-mono tabular-nums text-[var(--accent-app-text)]` em card com `bg-[var(--accent-app-soft-bg)]` + `border-[var(--accent-app-soft-border)]`) e ponto de equilíbrio (`text-xl` em `text-[var(--warning-app)]` em card com `bg-[var(--warning-app-bg)]` + `border-[var(--warning-app-border)]`). Badges comparativas: `AlertTriangle + "Abaixo do ponto de equilíbrio"` em danger se `precoFinal < pontoEquilibrio`, `TrendingUp + "Acima do sugerido"` em accent se `precoFinal > precoSugerido`, `Check + "Dentro da faixa recomendada"` em muted para o intervalo entre os dois. Caso 400 "Capacidade produtiva não configurada" — banner warning em vez de erro (detectado via `(calcQ.error as Error).message.toLowerCase().includes("capacidade produtiva")`); fetcher custom em `useQuery` (não `apiFetch`) pra distinguir 400 esperado de erro real, com `retry: false`
    5. **Preço final + Lucratividade**: Card com Input numérico (ref-based uncontrolled, defaultValue `proc.precoFinal ?? ""`) + Button "Definir preço" (Save icon, PUT `/preco-final` com `{ precoNovo }`); Enter também commita; ao lado, "Lucratividade final" em `text-2xl font-mono tabular-nums` colorido accent (≥0) ou danger (<0) — só exibe `pct(calc.lucratividadeFinal)` se `precoFinal` estiver definido; hint quando precoFinal é null explica que é necessário definir preço pra calcular lucratividade
- **State management**: TanStack Query com query keys `["procedimentos"]` (lista), `["procedimentos", procedimentoId, "itens"]`, `["procedimentos", procedimentoId, "calculo"]`, `["insumos"]` (lookup), `["ativos"]` (lookup). Detail pane usa `useQuery<Procedimento | null>` com `select: (list) => list.find(p => p.id === procedimentoId)` — compartilha o cache com o parent (mesma queryKey `["procedimentos"]`), sem refetch extra. Invalidação cruzada: cada mutation PUT/POST/DELETE invalida `["procedimentos"]` + `["procedimentos", id, "calculo"]` + (para itens) `["procedimentos", id, "itens"]` — cálculo sempre refetchado quando params ou itens mudam
- **Auto-select primeiro procedimento** quando a lista chega via `useMemo` derivando `effectiveSelectedId` (sem `setState` em `useEffect` — pattern idiomático React 19 que evita `react-hooks/set-state-in-effect`); fallback automático para o primeiro da lista quando o `selectedId` do usuário não está mais na lista (pós-delete)
- **Percentage fields UI ↔ API**: campos `*Pct` armazenados em 0..1 no banco (e.g., 0.03); UI mostra `pct * 100` (e.g., "3"); `commitPct()` divide por 100 antes de enviar para a API. `brl()` para valores monetários, `pct()` para a lucratividade final (que já vem em 0..1 do engine)
- **Toasts** via `sonner`: sucesso ("Procedimento criado", "Insumo adicionado", "Preço final definido", etc.) + erro (`e.message` direto do `apiFetch` que extrai `body.erro` do backend); info toast para a limitação de "não é possível desvincular equipamento" (API T2-c só aceita string em `equipamentoId`, não null — quando usuário tenta limpar, mostramos a toast e não enviamos)
- **Styling**: todos os inputs/selects/buttons sobrescrevem defaults shadcn com `bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]` e accent teal via `bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]`. Botão danger (Trash2) com `hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]`. Inputs numéricos `text-right font-mono tabular-nums` em todos os 12 campos de parâmetros + preço final + quantidade de insumos. Container externo `h-full overflow-y-auto scroll-thin`. Animação `framer-motion` `motion.div` com `initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}` (200ms) no detail pane
- **Permissions**: `useAuth((s) => s.podeEditar())` desabilita botões/forms de escrita quando `false` (recepção tem read-only); todos os inputs com `disabled={!podeEditar || salvando}` + `opacity-70` quando disabled. Read access sempre permitido
- **Loading/Error/Empty states**: `Skeleton` para loading (lista com 4 cards h-12, detalhe com 8 cards h-16 + h-24 calc); `ErrorState` com AlertTriangle + botão "Tentar novamente" → `q.refetch()`; `EmptyState` com ícone lucide contextual (Inbox/Calculator/Package) + título + hint + call-to-action quando aplicável
- **Edge cases**:
  - Capacidade `null`: `calcQ` fetcher custom trata 400 como banner warning "Capacidade produtiva não configurada" em vez de erro hard (mesma decisão de T3-b em `fetchResumo`)
  - Insumo já usado em outra row: `InsumoRow` filtra options para evitar duplicidade (não mostra insumos já vinculados a outras rows do mesmo procedimento)
  - Todos os insumos já adicionados: `handleAddInsumo` mostra toast erro "Todos os insumos cadastrados já foram adicionados a este procedimento" (fiel ao `avisar` do App.jsx L695)
  - Preço concorrência vazio: envia `0` para não deixar null (API não aceita null direto, evita FK error)
  - Equipamento select vazio: toast info explicando limitação + não envia PUT (evita erro FK)
  - Preço final indefinido: lucratividade mostra "—" em `text-[var(--text-app-faint)]`
  - Itens com `insumoNome` null (insumo deletado): row mostra fallback `item.insumoId`
- **Decisions**:
  - `effectiveSelectedId` derivado em `useMemo` em vez de `useEffect + setState` — pattern idiomático React 19 pra evitar `react-hooks/set-state-in-effect` (mesma decisão de T3-b com `key={capQ.data?.clinicaId}` em CapacidadeForm, mas aqui aplicado ao nível da tab)
  - `useQuery` com `select` no `ProcedimentoDetalhe` em vez de `queryClient.getQueryData()` direto — select é reativo (re-deriva quando o cache atualiza após um PUT/DELETE), ao passo que `getQueryData` retornaria snapshot estilhaçado e precisaria de `useEffect` pra re-sincronizar
  - Fetcher custom no `calcQ` (não `apiFetch`) — `apiFetch` lança `Error` em qualquer `!res.ok`, mas o 400 "Capacidade produtiva" é esperado/normal e precisa virar banner em vez de toast erro. Mesma decisão de T3-b com `fetchResumo`
  - `<select>` nativo HTML em vez do `Select` shadcn para equipamento e insumos — a API controla `value` direto da props `proc.equipamentoId` (controlled sem useState, sem `useEffect`), evitando a complexidade do Radix Select `defaultValue` que não reverte sozinho quando a API silently no-op (caso do `equipamentoId: null` que o backend T2-c ignora por `typeof null !== "string"`). Mesma escolha do App.jsx original L1087-1095
  - PUT em `precoConcorrencia` envia `0` quando o usuário limpa o input — em vez de `null` — porque o backend T2-c só atualiza se `typeof === "number"` (via `isNum()` helper), então `null` seria ignorado. `0` é semanticamente correto (preço de concorrência desconhecido = R$ 0)
  - `precoInputRef` (uncontrolled com `useRef`) em vez de `useState` para o preço final — evita `useEffect` pra sincronizar quando `proc.precoFinal` muda externamente (após PUT). O parent já usa `key={effectiveSelectedId}` pra remontar o detail pane, então o `defaultValue` pega o valor atual no servidor a cada seleção. Mesma estratégia de T3-b em `DespesaRow` (`defaultValue + onBlur`, sem useState/useEffect)
  - Indicador "salvando {campo}…" mostra o nome amigável do campo (mapa `FIELD_LABELS` com "lucro" para `lucroDesejadoPct`, "comissão" para `comissaoPct`, etc.) — UX mais legível que o nome cru do campo Prisma
  - Filtragem de insumos usados em `InsumoRow` (`availableInsumos = insumos.filter(i => i.id === item.insumoId || !usedInsumoIds.has(i.id))`) — previne o bug do App.jsx original L1109-1134 onde o usuário podia "trocar" para um insumo já em outra row, causando upsert silencioso que sobrescrevia a quantidade da outra row (já que a API usa `upsert` na PK composta). Aqui só insumos disponíveis + o próprio aparecem como option
- **Lint status:** PASS (0 erros, exit 0)

Stage Summary:
- Files modified: src/components/tabs/procedimentos-tab.tsx
- Key UI features:
  - Layout 2-painéis responsivo (`lg:grid-cols-[260px_1fr]`) com lista à esquerda + detalhe à direita; stack vertical em mobile
  - List pane: header com ícone Stethoscope + count + botão "Novo"; lista com selected em `bg-[var(--accent-app-soft-bg)] border-l-2 border-[var(--accent-app)]`; mostra nome + tempo (min, ícone Clock) + preço final em brl(); `max-h-80 overflow-y-auto scroll-thin`; 3 estados (skeleton/error/empty)
  - Dialog "Novo procedimento" pedindo só nome (demais params defaultam no backend: tempoMinutos=0, laudos=0, retrabalhoPct=0.03)
  - Detail pane com 5 cards: Header (nome + AlertDialog delete), Parâmetros (grid 2/3/4 cols com 12 campos inline editáveis via onBlur → PUT), Insumos consumidos (sub-tabela com select+qtde+custo+remove), Resultado do cálculo (4 line items + 2 cards destaque preço sugerido/ponto equilíbrio + 3 badges comparativas), Preço final (Input ref + Button "Definir preço" + lucratividade final em destaque)
  - Indicador "salvando {campo}…" no header do card de Parâmetros enquanto PUT está em andamento, com `ring-2 ring-[var(--accent-app)]/30` no campo ativo
  - Percentage fields: UI mostra `pct * 100` (e.g., 3 para 0.03), commit divide por 100 antes de enviar
  - Badges: danger "Abaixo do ponto de equilíbrio" se `precoFinal < pontoEquilibrio`; accent "Acima do sugerido" se `precoFinal > precoSugerido`; muted "Dentro da faixa recomendada" para o intervalo entre os dois
  - Banner warning "Capacidade produtiva não configurada" quando cálculo retorna 400 (em vez de erro hard)
  - Filtros: insumos já usados em outras rows não aparecem como option (previne upsert silencioso)
  - TanStack Query: query keys `["procedimentos"]`, `["procedimentos", id, "itens"]`, `["procedimentos", id, "calculo"]`, `["insumos"]`, `["ativos"]`; invalidação cruzada faz o cálculo refetchar sempre que params ou itens mudam
  - Auto-select primeiro procedimento via `useMemo` derivado (sem setState-in-effect); fallback pós-delete para o primeiro da lista
  - Permissions: podeEditar() desabilita todos os controles de escrita; recepção vê read-only
  - Toast feedback em todas as mutations (sucesso + erro + info para limitações)
  - Animação framer-motion entrance no detail pane (200ms)
- Lint status: PASS (0 erros, exit 0)

---
Task ID: T3-d
Agent: full-stack-developer (frontend agenda)
Task: Tab Agenda (day navigation + appointment list + 5 status + remarcar)

Work Log:
- Lidos: `worklog.md` (Tasks 1 + T2-d), `App.jsx` original (seção Agenda, ~L1242-1370), `custos-capacidade-tab.tsx` (T3-b) e `procedimentos-tab.tsx` (T3-c) para espelhar padrões de estilo (vars `*-app`, `EmptyState`, `ErrorState`, `ListSkeleton`, `inputCls`), `auth-store.ts` (apiFetch + useAuth) e `utils.ts` (dataBR, cn).
- Lidos também os 3 routes de `/api/agendamentos` (`route.ts`, `[id]/route.ts`, `[id]/remarcar/route.ts`) para confirmar o contrato: GET retorna `[{...remarcadoParaData, remarcadoParaHora}]`, POST valida `nome`+`data`, PUT aceita subset, `/remarcar` cria novo agendamento + marca original como `remarcado` em `$transaction` e retorna 201 com o novo registro.
- Implementado `src/components/tabs/agenda-tab.tsx` (~580 linhas):
  - **Types**: `StatusAgendamento` (5 valores) + interface `Agendamento` espelhando o GET (incl. `remarcadoParaId/Data/Hora`).
  - **STATUS_AGENDAMENTO**: map label+badge (cores portadas para `*-app`: aguardando→alt-strong/secondary, atendido→accent-soft/teal, faltou→danger-bg-strong/danger, desmarcou→alt-strong/muted, remarcado→warning-bg-strong/warning).
  - **Helpers de data**: `hojeIso()`, `diaOffset(iso, ±1)` (usa `T12:00:00` p/ evitar DST), `formatarDataLonga` via `Intl.DateTimeFormat('pt-BR', {weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'})`.
  - **UI primitives**: `EmptyState`/`ErrorState`/`ListSkeleton` idênticos ao T3-c.
  - **AgendaTab**: `useState(hojeIso)` p/ dia selecionado; TanStack Query `["agendamentos", dataSelecionada]` GET `/api/agendamentos?data=...` (refetch ao mudar o dia). 4 mutations: `addMut` (POST + reset form), `updateStatusMut` (PUT `{status}`), `remarcarMut` (PUT `/remarcar` + invalidate ambos os dias), `deleteMut` (DELETE 204). Toast em todos onSuccess/onError.
  - **Layout**: outer `h-full overflow-y-auto scroll-thin p-4 sm:p-6 bg-[var(--bg-app)]`, container `max-w-4xl mx-auto space-y-4`. Cards `rounded-xl border-[var(--border-app)] bg-[var(--surface-app)] p-3 sm:p-4`.
    - Card 1 — Navegação: `[<]` `[Hoje]` `[>]` (botões outline h-9) + display `capitalize` em `text-[var(--accent-app-text)] font-semibold` + badge "hoje" quando aplicável + input date "Ir para".
    - Card 2 — Form inline: grid 12-col responsivo com Nome* (col-4), Telefone, Exame, Hora (`type=time`), Plano/Particular (Checkbox shadcn), botão Agendar (valida `nome` não-vazio, mostra spinner em pending).
    - Legenda: 5 badges de status centralizados.
    - Card 3 — Lista: header com ícone CalendarDays + count + data; body `max-h-[60vh] overflow-y-auto scroll-thin divide-y` para não crescer infinitamente. Empty state com `CalendarDays`, error state com retry, skeleton durante load.
  - **AppointmentRow**: sub-componente isolado. Cada linha: hora (font-mono, "Sem hora" fallback) + nome grande + telefone/exame + badges Plano (teal via accent-app-soft) / Particular (roxo, único uso fora da paleta, explicitamente pedido pelo usuário). 5 botões de ação rápida de status (cada um destacado quando ativo). Quando `status==='remarcado'` e `remarcadoParaData` presente, mostra link "ver remarcação DD/MM HH:MM" (ícone CalendarClock) que dispara `onJumpToDate`. Botões Remarcar e Excluir. Inline form de remarcar em `AnimatePresence` (`height: 0/100%`, opacity) com Nova data (obrigatória), Nova hora, Cancelar + Confirmar. Todos os handlers usam `e.stopPropagation()` no container de status/ações p/ não disparar cliques acidentais na row (mesmo ela não sendo clickable hoje).
  - Todos os handlers são client-side; `apiFetch` injeta JWT automaticamente. Sem checagem `podeEditar` (agenda aberta a qualquer papel autenticado, conforme spec).
- Lint `bun run lint` rodado em `/home/z/my-project` → passou sem erros/warnings.

Stage Summary:
- Files modified: src/components/tabs/agenda-tab.tsx
- Key UI features:
  - Day navigation `[<] [Hoje] [>]` + display `Intl pt-BR` + input "Ir para" (formato `Sexta-feira, 26/09/2025`)
  - Inline add-appointment form (Nome*, Telefone, Exame, Hora, Checkbox Plano/Particular) com validação de `nome` não-vazio e reset no sucesso
  - Lista `max-h-[60vh] overflow-y-auto scroll-thin` ordenada por hora (NULL primeiro, depois ASC) — a ordenação é feita pela API (T2-d) e mantida aqui
  - 5 status quick-action buttons por linha, o ativo destacado com a cor do status, clique dispara PUT
  - Badges Plano (teal) e Particular (roxo)
  - Link "ver remarcação DD/MM HH:MM" quando `status==='remarcado'` → muda o dia selecionado
  - Fluxo Remarcar: form inline em `framer-motion AnimatePresence` com Nova data* + Nova hora + Confirmar; chama `PUT /api/agendamentos/[id]/remarcar`; invalida queries do dia atual E do dia novo
  - Delete com confirmação visual (botão danger outline)
  - EmptyState/ErrorState/Skeleton seguindo o padrão T3-b/T3-c
  - Toast para todos os mutations (success + error)
  - Mobile-first: tudo empilha em `flex-col` no small screen; grids responsivas (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-12`)
  - Estilo "stone + accent" via vars `*-app` consistentes com T3-b/T3-c
- Lint status: pass

---
Task ID: T3-e
Agent: full-stack-developer (frontend financeiro)
Task: Tab Financeiro (Dashboard + Contas + Convênios + Glosas + DRE + Rentabilidade + Lotes + Conciliação)

Work Log:
- Lido `worklog.md` Task 1 (fundação) + T2-e (endpoints `/api/convenios`, `/contas-receber`, `/contas-pagar`, `/despesas-recorrentes`, `/glosas`) + T2-f (endpoints `/api/financeiro/{resumo,dre,rentabilidade,fluxo-projetado,rentabilidade-equipamento,conciliacao}`, `/api/convenios/[id]/{producao,lotes}`, `/api/lotes`, `/api/movimentos-bancarios`) + T3-b/T3-c/T3-d (stiling pattern, EmptyState/ErrorState/Skeleton, `podeEditar()` gate, motion entrance, `*-app` vars, Tabs internas) — referência fiel ao formato de camelCase dos fields (Prisma-first), confirmação de shape de cada endpoint
- Lido `FinanceiroModule.jsx` original (1014 linhas, 9 sub-seções — Dashboard, Contas a receber, Contas a pagar, Convênios, Lotes, Glosas, Conciliação, DRE, Rentabilidade) com targeted reads (offset/limit) para cada sub-tab — referência de UX e estrutura das tabelas/forms/dialogs
- Lido `src/components/tabs/custos-capacidade-tab.tsx` (T3-b — StatCard, EmptyState, ErrorState, TableSkeleton, inputCls, `bg-[var(--surface-app)]` etc.), `procedimentos-tab.tsx` (T3-c — Dialog pattern, AlertDialog delete, cellInputCls), `agenda-tab.tsx` (T3-d — StatusBadge config, month picker styling) — para espelhar padrões visuais
- Lido `src/lib/auth-store.ts` (`useAuth`, `apiFetch`, `podeEditar`), `src/lib/utils.ts` (`brl`, `pct`, `num`, `hoje`, `mesAtual`, `dataBR`), `src/lib/financeiro.ts` (`DRE`, `GrupoRentabilidade`, `FluxoProjetado`, `PorHora`, `Conciliacao` types) — para tipos de retorno das APIs
- Lido `src/components/ui/chart.tsx` (shadcn chart wrapper), `src/components/ui/tabs.tsx`, `table.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `badge.tsx`, `button.tsx`, `input.tsx` — para primitivos shadcn
- Lido `src/app/globals.css` (vars `--surface-app`, `--border-app`, `--text-app*`, `--accent-app*`, `--warning-app*`, `--danger-app*`, `--bg-app-alt-strong`, `.scroll-thin`)
- Lido `src/components/app/app-shell.tsx` (wraps `<FinanceiroTab />` em `flex-1 min-h-0 overflow-hidden bg-[var(--bg-app)]`) para confirmar que a tab está habilitada só para dono/financeiro (recepção nem vê, mas `podeEditar()` check mantido por segurança)
- Substituído o stub `src/components/tabs/financeiro-tab.tsx` (placeholder de 10 linhas) pela implementação completa — **um único client component** com 9 sub-panels internos via `<Tabs>`:
  - **Outer container**: `h-full overflow-y-auto scroll-thin p-4 sm:p-6 bg-[var(--bg-app)]` + `max-w-7xl mx-auto`
  - **TabsList** com `flex-wrap h-auto` (9 triggers: Dashboard, Contas a receber, Contas a pagar, Convênios, Glosas, DRE, Rentabilidade, Lotes, Conciliação) — accent teal no trigger ativo (`data-[state=active]:bg-[var(--accent-app)] data-[state=active]:text-white`)
  - **Status configs** (3 maps): `STATUS_RECEBER` (5 opções: aberto, recebido, vencido, parcial, cancelado), `STATUS_PAGAR` (4: aberto, pago, vencido, cancelado), `STATUS_GLOSA` (4: glosada, em_recurso, recuperada, perdida) — portadas para `*-app` vars (accent para pago/recebido, warning para parcial/em_recurso, danger para vencido/glosada, gray-faint para cancelado/perdida)
  - **UI primitives**: `StatCard` (com `accent`/`warning`/`danger` variants + ícone), `EmptyState` (com `action` opcional), `ErrorState` (com retry), `StatSkeleton` (6 cards h-20), `TableSkeleton` (cols parametrizável), `StatusBadge`, `ChartTooltipBox` (recharts custom tooltip styled com `bg-[var(--surface-app)] border-[var(--border-app)]`), `MonthPicker` (sticky top-0, com `[<] [Hoje] [>]` + input type=month)
  - **DashboardPanel**: `MonthPicker` no topo + 6 `StatCard` (Receitas com accent, Despesas pagas, Resultado com accent se ≥0 ou danger se <0, A receber, A pagar, Inadimplência com danger se >0) + bar chart `receitaPorOrigem` (recharts `BarChart layout="vertical"` com `Cell` gradient `fillOpacity={0.85 - i*0.08}` pra criar cascade accent, `CartesianGrid` horizontal-false, `XAxis`/`YAxis` com `fill: var(--text-app-muted)`, `Tooltip` customizado `ChartTooltipBox` com `formatter={brl}`); estados skeleton/error/empty (origem vazia)
  - **ContasReceberPanel**: `MonthPicker` + filtros (status 5 opções + convenio select) + `Button "Novo lançamento"` (abre dialog) + tabela `max-h-96 overflow-y-auto scroll-thin` com sticky header + colunas (Paciente/Procedimento, Convênio/Dentista, Data exame, Faturado, Pago, Status, Actions); actions por linha: `receber` (PUT status=recebido + valorPago=valorFaturado + dataRecebimento=hoje), `glosa` (abre `GlosaDialog` com valor + motivo → POST `/contas-receber/[id]/glosa`), `Cancelar` (PUT status=cancelado), delete com `AlertDialog` confirmação (glosas em cascata); `useQuery ["contas-receber", { mes, status, convenioId }]` + `["convenios"]` + `["procedimentos"]` para selects
  - **`NovoLancamentoReceberDialog`**: form com paciente, procedimento (select), convênio (select), dentista solicitante, data exame, vencimento, valor faturado; hint "(vazio = buscar preço vigente na tabela do convênio)" quando convenio+procedimento+data presentes e valor vazio — deixa backend calcular `precoVigente`; reset form no sucesso; chamada POST manual (não useMutation) porque o component é desmontado pelo parent no sucesso
  - **`GlosaDialog`**: mostra info da conta (paciente, procedimento, convênio, valor faturado) + inputs valor glosado + motivo → POST `/contas-receber/[id]/glosa`
  - **ContasPagarPanel**: `MonthPicker` + filtros (status 4 opções) + `Button "Gerar recorrentes"` (POST `/despesas-recorrentes/gerar` body `{ mes }` — disabled se não há recorrentes cadastradas) + `Button "Nova conta"` (abre dialog) + tabela com colunas (Descrição/Fornecedor, Categoria, Valor, Vencimento, Status, Actions); actions: `pagar` (PUT status=pago + dataPagamento=hoje), `Cancelar`, delete com confirmação
  - **`DespesasRecorrentesPanel`** (sub-card dentro de ContasPagar): header com count + `Button "Nova"` + tabela (Descrição, Categoria/Fornecedor, Valor, Dia venc., delete) — CRUD de recorrentes (POST/DELETE via `/despesas-recorrentes`); estados skeleton/empty/error; `useQuery ["despesas-recorrentes"]` compartilhada com parent
  - **`NovaDespesaRecorrenteDialog`** + **`NovaContaPagarDialog`**: forms para criar recorrente/conta, com resets e validações client-side
  - **ConveniosPanel**: layout 2-painéis (`grid sm:grid-cols-[260px_1fr]`); esquerda = lista de convênios (selected highlight `bg-[var(--accent-app-soft-bg)] border-l-2 border-[var(--accent-app)]`) com botões edit (`Pencil` opens `ConvenioFormDialog` modo edit) + delete (`AlertDialog` confirmação); direita = `ConvenioPrecosPanel` (tabela de preços com vigência: colunas Procedimento, Valor, Vigente desde) + `Button "Nova vigência"` (abre `NovoPrecoDialog`); `useQuery ["convenios"]` + `["convenios", id, "precos"]` (habilitado só quando selectedId truthy)
  - **`ConvenioFormDialog`**: reutilizável para create + edit (detecta `convenio` prop); 7 campos (nome, cnpj, telefone, email, responsavel, prazoMedioDias) com defaults; POST `/api/convenios` ou PUT `/api/convenios/[id]`
  - **`NovoPrecoDialog`**: 3 campos (procedimento select, valor number, vigenciaInicio date default hoje) → POST `/api/convenios/[id]/precos` (sempre insere nova vigência, nunca overwrite — fiel ao backend T2-e)
  - **GlosasPanel**: 3 stat cards no topo (Total glosado com danger, Quantidade, Filtro atual) + filtros (status 5 opções) + `Button "Atualizar"` (refetch) + tabela (Paciente/Convênio, Motivo, Faturado, Glosado com danger, Recuperado com accent, Status, Actions); workflow: `glosada` → button "Entrar com recurso" (PUT status=em_recurso); `em_recurso` → `RecuperarGlosaButton` (abre dialog com valor recuperado input → PUT status=recuperada + valorRecuperado) + button "Perdida" (PUT status=perdida); `useQuery ["glosas", statusFilter]`
  - **`RecuperarGlosaButton`**: button + Dialog separados — mostra valor original glosado + input valor recuperado defaultado ao valor glosado → PUT `/api/glosas/[id]` com `status=recuperada` + `valorRecuperado`
  - **DREPanel**: `MonthPicker` + card "DRE gerencial" com layout cascata (waterfall) — 8 linhas em `max-w-lg`: Receita bruta (base) → (−) Glosas (sub, indentado `pl-8`) → (−) Impostos (sub) → = Receita líquida (subtotal, `bg-[var(--bg-app)]`) → (−) Custos variáveis (sub) → = Margem de contribuição (subtotal) → (−) Despesas fixas (sub) → = Resultado operacional (total, `bg-[var(--accent-app-soft-bg)]` com cor accent se ≥0 ou danger se <0); uso do `useMemo` para montar as linhas a partir do `DRE` shape; states skeleton (8 Skeleton h-9) + error + null
  - **RentabilidadePanel**: `MonthPicker` + 3 botões "Agrupar" (Por exame, Por convênio, Por dentista — accent no ativo) + 3 stat cards (Resultado total com accent/danger, Grupos analisados, Agrupamento) + bar chart "Top 10 grupos por resultado" (recharts `BarChart` com `XAxis angle={-35}` rotated labels, `Cell` com `fill` verde para positivo e vermelho para negativo, height 320) + tabela principal (chave, qtd, receita, custo, resultado com cor, margem, ticket médio) + sub-card "Rentabilidade por equipamento (R$/hora)" (tabela: equipamento, exames, horas, receita, receita/h com accent, lucro/h com cor) + sub-card "Fluxo de caixa projetado (30 dias)" com 3 StatCards (Recebimentos previstos, Pagamentos previstos com danger, Saldo projetado com accent/danger); `useQuery ["financeiro", "rentabilidade", mes, agrupar]` (enabled quando agrupar !== "equipamento") + `["financeiro", "rentabilidade-equipamento", mes]` (enabled quando agrupar === "equipamento") + `["financeiro", "fluxo-projetado", 30]` sempre habilitado
  - **LotesPanel**: header com count + `Button "Fechar novo lote"` (abre `FecharLoteDialog`) + `Button "Atualizar"` (refetch) + lista de lotes fechados em `divide-y` (cada lote é um botão expansível: clique → `LoteContas` carrega contas do lote via `useQuery ["lotes", loteId, "contas"]`); `ChevronRight` rotate-90 quando expanded; `useQuery ["lotes"]` + `["convenios"]` para selects do dialog
  - **`LoteContas`** (sub-componente): query lazy `["lotes", loteId, "contas"]`, mostra cada conta em linha `bg-[var(--bg-app)]` com paciente + procedimentoNome + valor; states skeleton/error/empty
  - **`FecharLoteDialog`**: form com convênio select + periodoInicio + periodoFim + `Button "Ver produção"` (GET `/api/convenios/[id]/producao?periodoInicio=...&periodoFim=...`); mostra resumo `{semPendencia.length} prontos · {comPendencia.length} com pendência`; lista comPendencia com badges inline `bg-[var(--warning-app-bg-strong)]` (paciente não informado, procedimento não informado, valor inválido); mostra sumário `semPendencia.length} exames · {brl(valorTotal)}` em accent-soft-bg + `Button "Fechar lote"` (POST `/api/convenios/[id]/lotes` body `{ periodoInicio, periodoFim }`)
  - **ConciliacaoPanel**: `MonthPicker` + 2 cards side-by-side (Entradas com ArrowDownCircle accent, Saídas com ArrowUpCircle danger): cada card mostra Sistema (recebido/pago) vs Extrato bancário + Diferença em accent se ≈0 ou danger se >0.01 + warning text explicativo quando diferença não-zero; abaixo card "Extrato lançado manualmente" com `Button "Lançar movimento"` + lista `divide-y` de movimentos (data, descricao, valor com accent se ≥0 ou danger se <0, delete com AlertDialog); `useQuery ["financeiro", "conciliacao", mes]` + `["movimentos-bancarios", mes]`
  - **`NovoMovimentoDialog`**: form com data (default hoje), descrição, tipo (entrada/saída select), valor number → POST `/api/movimentos-bancarios` body `{ data, descricao, valor: tipo === "saida" ? -Math.abs(v) : Math.abs(v) }` (fiel ao original L932)
- **State management** (TanStack Query): todos os dados via `useQuery`/`useMutation`; query keys: `["financeiro", "resumo", mes]`, `["contas-receber", { mes, status, convenioId }]`, `["contas-pagar", { mes, status }]`, `["convenios"]`, `["convenios", id, "precos"]`, `["glosas", statusFilter]`, `["financeiro", "dre", mes]`, `["financeiro", "rentabilidade", mes, agrupar]`, `["financeiro", "rentabilidade-equipamento", mes]`, `["financeiro", "fluxo-projetado", 30]`, `["lotes"]`, `["lotes", loteId, "contas"]`, `["movimentos-bancarios", mes]`, `["financeiro", "conciliacao", mes]`, `["despesas-recorrentes"]`, `["procedimentos"]` (para selects). Invalidation cruzada: cada mutation invalida a chave primária afetada + chaves relacionadas (e.g., criar/editar conta-receber invalida `["contas-receber"]` + `["financeiro", "resumo"]` + `["financeiro", "dre"]` + `["financeiro", "rentabilidade"]` + `["financeiro", "rentabilidade-equipamento"]` + `["financeiro", "conciliacao"]` + `["financeiro", "fluxo-projetado"]` + `["glosas"]` — porque DRE/rentabilidade/etc derivam de contas). Função helper `invalidateContas` em cada panel para reusar
- **HTTP**: `apiFetch` de `@/lib/auth-store` (injeta Bearer, trata erro via `body.erro`); seletores usam `<select>` nativo HTML em vez de `Select` shadcn (mesma decisão de T3-c — Radix Select `defaultValue` não reverte sozinho quando API silently no-op, e custaria um `useEffect` pra sincronizar que o ESLint rejeita). `ChartTooltipBox` é um component custom para Tooltip do recharts (não o `ChartTooltipContent` do shadcn chart.tsx — porque precisava de styling custom com vars `*-app`)
- **Toasts** via `sonner`: sucesso ("Conta marcada como recebida", "Lançamento criado", "Convênio atualizado", "Lote fechado", "Movimento lançado", etc.) + erro (`e.message` direto do `apiFetch`); info implícito via disabled buttons
- **Styling**: todos os inputs/selects/buttons sobrescrevem defaults shadcn com `bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)]` e accent teal via `bg-[var(--accent-app)] text-white hover:bg-[var(--accent-app-hover)]`. Botão danger (Trash2) com `hover:text-[var(--danger-app)] hover:bg-[var(--danger-app-bg)]`. Inputs numéricos `text-right font-mono tabular-nums`. Container externo `h-full overflow-y-auto scroll-thin p-4 sm:p-6`. Animação `framer-motion` `motion.div` com `initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}` (200ms) em cada panel
- **Permissions**: `useAuth((s) => s.podeEditar())` (passado como prop dos panels pelo `FinanceiroTab`) desabilita botões/forms de escrita quando `false` — embora o `app-shell.tsx` filtre a tab "financeiro" só para dono/financeiro (recepção nem vê), o check é mantido por segurança conforme briefing
- **Loading/Error/Empty states**: `StatSkeleton` (6 cards h-20) para dashboard/conciliação/rentabilidade stat cards; `TableSkeleton` parametrizável para tabelas; `Skeleton h-64` para gráficos; `ErrorState` com AlertTriangle + retry button; `EmptyState` com ícone lucide contextual (ArrowDownCircle/ArrowUpCircle/Building2/Receipt/CheckCircle2/TrendingUp/Clock/PackageCheck/Landmark) + hint distinto para podeEditar vs recepção (quando aplicável)
- **Edge cases**:
  - Bar chart `receitaPorOrigem` vazio → `EmptyState` "Sem receitas neste mês"
  - Rentabilidade sem dados → `EmptyState` "Sem dados faturados neste mês"
  - Rentabilidade por equipamento sem equipamentos vinculados → EmptyState "Nenhum exame vinculado a um equipamento neste mês" + hint "Associe um equipamento a cada procedimento na aba \"Procedimentos\""
  - Lotes sem nenhum fechado → EmptyState "Nenhum lote fechado ainda"
  - Conciliação com diferença não-zero → aviso danger explicativo "verifique recebimentos não lançados..."
  - Fechar lote sem produção elegível → warning "Nenhum exame pronto para faturar neste período (todos com pendência)" + pendências badges inline
  - Novo lançamento sem valor faturado mas com convenio+procedimento+data → hint "(vazio = buscar preço vigente na tabela do convênio)" — deixa backend calcular `precoVigente` (T2-e decision L305-306); se tabela não tem vigência, backend retorna 400 e toast mostra o erro
  - Selects de convênio no filter dialog usam `<option value="">Particular</option>` para diferenciar de "todos" (`value=""`)
  - Movimento bancário tipo=saída → valor é negado via `-Math.abs(v)` (fiel ao `Math.abs(Number(novo.valor))` com sinal negado do original L932)
  - Sticky table headers via `TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]"` em todas as tabelas com `max-h-96 overflow-y-auto scroll-thin` (fiel ao briefing "Sticky table headers")
  - ConvenioTabelaPreco GET já vem com `procedimentoNome` achatado (T2-e L248) — usado direto na tabela
- **Decisions**:
  - Bar chart com `Cell` + `fillOpacity={0.85 - i*0.08}` para criar gradient cascade no `receitaPorOrigem` (briefing: "The Dashboard's `receitaPorOrigem` chart should use a gradient of accent colors") — alternativa seria `<defs>` SVG com linearGradient, mas `Cell` + fillOpacity é mais conciso e atinge o mesmo efeito visual de gradient
  - DRE como cascata visual com indentação `pl-8` para subs (briefing: "The DRE should be visually like a waterfall (each line indented to show the cascading structure)") — sublinhado por `bg-[var(--bg-app)]` para subtotals e `bg-[var(--accent-app-soft-bg)]` para total; cor da fonte muda conforme valor (negative em danger, positive em accent para total, text-app para subtotals/positives normais, text-muted para subs)
  - `RecuperarGlosaButton` separado (não inline prompt como no original L625 que usava `window.prompt`) — Dialog é mais acessível, não bloqueia thread, e permite validação client-side; preserva o valor defaultado ao `glosa.valor` (valor glosado original) para facilitar o uso comum
  - Lotes com expand inline (não redirect para sub-page) — clique no lote expande `LoteContas` abaixo, sem trocar de aba; `ChevronRight` rotate-90 indica estado expanded (mesma pattern de accordion)
  - `FecharLoteDialog` faz GET produção + POST lote em sequência (não pré-carrega produção) — evita queries desnecessárias; só chama `/producao` quando usuário clica "Ver produção"
  - `ConvenioPrecosPanel` query `["convenios", id, "precos"]` habilitada só quando `selectedId` truthy (não usa `enabled` flag — o parent só renderiza `<ConvenioPrecosPanel>` quando há selectedId, então o hook só roda nesse caso)
  - `useState` para valor recuperado em `RecuperarGlosaButton` defaultado a `String(glosa.valor ?? "")` no mount (component desmonta quando glosa muda de status — `g.status !== "em_recurso"` esconde o button, então o novo mount recomeça do default)
  - Custom `ChartTooltipBox` em vez do `ChartTooltipContent` do shadcn `chart.tsx` — porque o shadcn exige `ChartContainer` + `ChartConfig` context (mais verboso) e o styling com `bg-background border-border` não casa com vars `*-app`; o custom é mais simples, usa `bg-[var(--surface-app)] border-[var(--border-app)]` e atinge o briefing "Style tooltip with `bg-[var(--surface-app)] border-[var(--border-app)]`"
  - Tipos dos fields em camelCase (não snake_case do original) — fiel ao backend Prisma-first de T2-e/T2-f que já devolve camelCase (e.g., `pacienteNome`, `valorFaturado`, `dataExame`, `convenioNome`, `periodoInicio`, `periodoFim`, `fechadoEm`, `valorRecuperado`, `recebidoSistema`, `diferencaEntradas`); o frontend Electron original lia snake_case direto do SQL Express
  - `useMutation` no parent + passagem de `mutate` para dialogs (e.g., `NovaDespesaRecorrenteDialog`, `NovoPrecoDialog`) em vez de criar mutations dentro dos dialogs — evita recriar queryClient hooks e mantém lógica de invalidação no parent (mais fácil de auditar); contrapartida: o onSuccess no parent chama `setNovoOpen(false)` para fechar o dialog, e o dialog chama `onAdd(vars)` apenas com os dados
  - `NovoLancamentoReceberDialog` e `NovaContaPagarDialog` usam chamada manual `apiFetch(...).then()` (não `useMutation`) porque o parent controla `novoOpen` state — fechar o dialog após success não requer invalidação cruzada custom (parent passa `onSaved` que faz invalidate + fecha dialog)
  - `fecharOpen` em LotesPanel abre `FecharLoteDialog` que mantém state próprio (convenioSel, periodo, producao) — dialog interno faz fetch e POST manualmente (não useMutation) porque a interação é multi-step (ver produção → fechar lote) e `apiFetch` direto é mais legível que orquestrar 2 mutations
- **Lint** `bun run lint` rodado em `/home/z/my-project` — primeira execução falhou com 1 erro de parsing (`Invalid character` line 3133): escaped quotes `\"` dentro de atributos JSX (`hint="...aba \"Contas a receber\"..."`) — JSX não suporta C-style escapes em atributos (apenas JS string literals dentro de `{}`). Corrigido wrapping os 2 atributos problemáticos em `hint={"..."}` para virar JS expression. Linhas com `\"` dentro de ternary expressions (`{podeEditar ? "Use \"Novo lançamento\"..." : "..."}`) são válidas porque estão em JS string literal context, não em JSX attribute. Segunda execução: 0 erros, exit 0
- `npx tsc --noEmit` rodado — 0 erros em `src/components/tabs/financeiro-tab.tsx` (os únicos erros reportados são em `examples/`, `skills/`, `custos-capacidade-tab.tsx` e `procedimentos-tab.tsx` que não são deste task)

Stage Summary:
- Files modified: src/components/tabs/financeiro-tab.tsx
- Key UI features:
  - 9 sub-panels via shadcn `<Tabs>` (Dashboard, Contas a receber, Contas a pagar, Convênios, Glosas, DRE, Rentabilidade, Lotes, Conciliação) com `flex-wrap h-auto` TabsList (quebra linha em mobile)
  - Sticky `MonthPicker` no topo de cada sub-tab com `[<] [Hoje] [>]` + input type=month (briefing: "sticky month picker at top of each sub-tab")
  - Dashboard: 6 StatCards (Receitas com accent, Resultado accent se ≥0/danger se <0, Inadimplência danger se >0) + bar chart `receitaPorOrigem` recharts `BarChart layout="vertical"` com `Cell` gradient cascade
  - Contas a receber: filtros (status 5 + convenio select) + tabela sticky-header com colunas (paciente/procedimento, convênio/dentista, data, faturado, pago, status, actions) + "Novo lançamento" dialog com auto-fill valorFaturado hint + actions: receber, glosa (dialog), cancelar, delete (AlertDialog)
  - Contas a pagar: filtros (status 4) + tabela + "Nova conta" dialog + "Gerar recorrentes" button (POST `/despesas-recorrentes/gerar` body `{ mes }`) + sub-card "Despesas recorrentes" com CRUD próprio
  - Convênios: layout 2-painéis; lista à esquerda com edit+delete (Pencil + AlertDialog); direita = tabela de preços por procedimento com vigência + "Nova vigência" dialog (POST sempre INSERT, fiel ao backend T2-e)
  - Glosas: 3 stat cards no topo + filtros + tabela + workflow status (glosada → em_recurso → recuperada|perdida); `RecuperarGlosaButton` com dialog para informar valor recuperado
  - DRE: cascata visual (waterfall) com 8 linhas indentadas (sub com `pl-8`, subtotal com `bg-[var(--bg-app)]`, total com `bg-[var(--accent-app-soft-bg)]`) — Resultado operacional destacado em accent (≥0) ou danger (<0)
  - Rentabilidade: 3 botões agrupar + 3 stat cards + bar chart "Top 10 grupos por resultado" (Cell verde se ≥0/vermelho se <0, XAxis rotated -35°) + tabela (chave, qtd, receita, custo, resultado, margem, ticket médio) + sub-card "Rentabilidade por equipamento (R$/hora)" + sub-card "Fluxo de caixa projetado (30 dias)" com 3 StatCards
  - Lotes: header + lista expansível (clique → LoteContas carrega contas do lote) + "Fechar novo lote" dialog multi-step (seleciona convênio + período → ver produção → fechar lote) com pendências badges inline
  - Conciliação: 2 cards side-by-side (Entradas/Saídas) com Sistema vs Extrato + Diferença (accent se ≈0, danger se >0.01) + card "Extrato lançado manualmente" com "Lançar movimento" dialog (data, descrição, tipo entrada/saída → valor sinalizado) + delete
  - Status badges com paleta `*-app` portada do original (accent para pago/recebido, warning para parcial/em_recurso, danger para vencido/glosada, gray-faint para cancelado/perdida)
  - Sticky table headers (`<TableHeader className="sticky top-0 z-10 bg-[var(--surface-app)]">`) + `max-h-96 overflow-y-auto scroll-thin` em todas as tabelas longas
  - Animações framer-motion entrance em cada panel (200ms); estados skeleton/empty/error padronizados
  - TanStack Query com invalidação cruzada (criar/editar contas invalida resumo, DRE, rentabilidade, conciliação, fluxo-projetado, glosas — todas derivam de contas)
  - AlertDialog para todos os deletes com mensagem contextual
  - Permissions: podeEditar() desabilita todos os controles de escrita (recepção não vê esta tab, mas check mantido por segurança)
  - Toast feedback em todas as mutations (success + error)
  - Mobile-first: tudo empilha em `flex-col` no small screen; grids responsivas (`grid-cols-1 sm:grid-cols-2` etc.); TabsList com `flex-wrap h-auto` quebra em mobile
  - Estilo "stone + accent" via vars `*-app` consistentes com T3-b/T3-c/T3-d
- Lint status: PASS (0 erros, exit 0)

---
Task ID: T4
Agent: main (Claude/Z.ai)
Task: Lint final + agent-browser QA end-to-end + cron job 15min

Work Log:
- `bun run lint` → PASS (0 erros)
- Dev server em :3000 saudável (compilando sem erros)
- agent-browser QA end-to-end:
  1. Abri http://localhost:3000/ → LoginScreen renderiza com tabs Entrar/Nova clínica
  2. Cliquei "Nova clínica" → form de registro renderiza com 4 campos (clínica, nome, email, senha)
  3. Preenchi "Clínica Sorriso" / "Dr. Fernando" / fernando@example.com / senha1234 → submit
  4. Toast "Conta criada! Bem-vindo, Dr. Fernando." → AppShell carregou com:
     - Header sticky: "Clínica Sorriso" + "Dr. Fernando · Dono(a)" + botões tema/cor/logout
     - Nav tabs: Custos & Capacidade, Procedimentos, Agenda, Financeiro
  5. Custos tab: 4 sub-tabs, adicionei despesa "Aluguel R$ 2500" → tabela atualizou, total correto
  6. Capacidade produtiva: form pré-preenchido com defaults (20 dias / 8h / 1 unidade / 75%) + "Salvar"
  7. Procedimentos tab: layout 2-painéis, empty state com CTA "Criar procedimento"
  8. Agenda tab: dia atual formatado em PT-BR ("Domingo, 27/09/2026") + badge HOJE + form + lista vazia
  9. Financeiro tab: 9 sub-tabs renderizam, Dashboard com 6 stat cards + seletor de mês + área de gráfico
  10. Toggle tema claro/escuro funciona (screenshot capturado em /tmp/dark-mode.png)
- Dev log: zero erros de runtime; todos endpoints respondendo (POST /api/auth/registrar 201, POST /api/despesas 201, GET /api/despesas 200, GET /api/capacidade 200, GET /api/ativos 200, GET /api/agendamentos 200, GET /api/financeiro/resumo 200, GET /api/resumo 400 esperado porque capacidade ainda não foi salva)
- Cron job criado: ID 417395, fixed_rate 900s (15 min), kind=webDevReview, tz=America/Sao_Paulo

Stage Summary:
- Projeto portado com sucesso do Electron → Next.js 16, mantendo 100% das features originais
- ~25 endpoints de API em /api/* (auth, despesas, capacidade, insumos, ativos, resumo, procedimentos, agendamentos, convenios, despesas-recorrentes, contas-pagar, contas-receber, glosas, financeiro (resumo/dre/rentabilidade/fluxo-projetado/rentabilidade-equipamento/conciliacao), lotes, movimentos-bancarios, usuarios)
- 4 abas frontend implementadas (Custos com 4 sub-panels, Procedimentos, Agenda, Financeiro com 9 sub-panels)
- Auth com JWT + bcrypt, 3 papéis (dono/financeiro/recepcao), multi-tenant via clinicaId
- Tema teal/azul/roxo + claro/escuro recriado via CSS vars + next-themes + seletor de cor
- Persistência de sessão via Zustand + localStorage; TanStack Query para dados de servidor
- shadcn/ui (Nova York) com Lucide icons e recharts
- Prisma + SQLite (arquivo único em /home/z/my-project/db/custom.db)
- Cron job 15min com webDevReview configurado para continuidade de desenvolvimento
- Status final: APP TOTALMENTE FUNCIONAL end-to-end, verificado no browser

---
Task ID: T5 (cron rodada 1 — webDevReview)
Agent: main (Claude/Z.ai)
Task: QA end-to-end profundo + 3 novas funcionalidades + melhorias de styling

## Avaliação do status atual (início da rodada)
- Projeto está estável e funcional: todas as 4 abas originais (Custos, Procedimentos, Agenda, Financeiro) operacionais
- Lint limpo, dev server sem erros de runtime
- QA anterior (T4) validou fluxo básico (login → despesa → capacidade → calculo procedimento → convenio + tabela → conta a receber → recebimento → dashboard/DRE)
- Decidi nesta rodada: priorizar NOVAS funcionalidades + melhorias de styling (projeto está em fase estável)

## Work Log
- QA profundo via agent-browser repetiu o fluxo completo confirmando:
  - Login com conta existente (fernando@example.com / senha1234) → AppShell carregou
  - Configuração de capacidade (20d × 8h × 1u × 75% = 120h/mês) → /api/resumo retornou 200 com custo R$ 0,35/min
  - Procedimento "Radiografia panorâmica" criado + tempo ajustado p/ 30 min → cálculo: custo direto R$ 10,73, preço sugerido R$ 21,90, ponto equilíbrio R$ 13,58
  - Preço final R$ 25 definido → lucratividade calculada
  - Convênio "Unimed Dental" criado + vigência R$ 60 desde 27/09
  - Conta a receber "Maria Teste" com procedimento+convenio+data → precoVigente auto-buscou R$ 60 (sem digitar)
  - Marcar como recebido → Dashboard atualizou (receitas R$ 60, resultado R$ 60)
  - DRE em cascata: bruto 60 → líquido 56,40 (após impostos 6%) → margem 56,40 → resultado -2.443,60 (com despesa fixa 2.500)
  - Rentabilidade: 1 grupo "Radiografia panorâmica" no gráfico
  - Toggle tema claro/escuro funcionando
  - Sem bugs de runtime encontrados — todas as APIs retornando códigos corretos

### FUNCIONALIDADE 1: Nova aba "Início" (Dashboard global)
- Criado `src/components/tabs/inicio-tab.tsx` (~450 linhas)
- Hero card com gradient teal e saudação dinâmica (Bom dia/Boa tarde/Boa noite + primeiro nome)
- 6 KPIs financeiros do mês (receitas, despesas, resultado, a receber, a pagar, inadimplência) — visível só pra dono/financeiro
- Painel "Agenda de hoje" (max 8 itens) com badge de status e botão "Abrir agenda"
- Painel "Custo fixo" resumido (custo/minuto + total/mês + horas/mês) — ou banner "Configure capacidade" se null
- Painel "Procedimentos" com contador (cadastrados, com preço definido, pendentes)
- 4-5 Atalhos rápidos (cards clicáveis com hover gradient p/ navegar entre abas)
- Animações framer-motion (entrada + hover)
- Adicionada ao `app-shell.tsx` como primeira aba (id="inicio"), atalho Ctrl+1

### FUNCIONALIDADE 2: Nova aba "Usuários" (Gerenciamento de equipe)
- Criado `src/components/tabs/usuarios-tab.tsx` (~270 linhas)
- Apenas dono vê (papeisPermitidos: ["dono"])
- 3 cards explicativos no topo mostrando cada papel (dono/financeiro/recepção) com ícone, descrição e contador de usuários
- Lista de membros com avatar com iniciais, nome, e-mail, badge "VOCÊ" para o atual, data de cadastro, e badge colorido do papel
- Dialog "Convidar novo usuário" com formulário (nome, email, senha min 8, papel select financeiro/recepção)
- Validação client-side: email regex, senha mínima, botão desabilitado até válido
- Mutação TanStack Query + invalidação ["usuarios"] + toast de sucesso

### FUNCIONALIDADE 3: Exportação CSV + Imprimir (PDF via browser)
- Criado `src/lib/export.ts` com 3 funções:
  - `exportarCSV(dados, nomeArquivo, colunas?)` — gera CSV com BOM UTF-8 (Excel PT-BR lê acentos), separador `;`, download automático, toast de sucesso
  - `imprimirTabela(titulo, subtitulo, colunas, dados, accentColor?)` — abre popup com HTML formatado (accent color do tema, zebra rows, alinhamento numérico à direita) e chama `window.print()` (PDF via "Salvar como PDF" do browser)
  - `fmtBRL`, `fmtData`, `fmtPct` helpers
- Integrado em 3 painéis do Financeiro:
  - **DRE**: botão CSV + Imprimir no header (exporta 8 linhas da cascata + mes)
  - **Contas a Receber**: botão CSV + Imprimir no header da tabela (paciente, procedimento, convênio, dentista, data, faturado, pago, status)
  - **Rentabilidade**: botão CSV + Imprimir no header da tabela (chave, qtd, receita, custo, resultado, margem, ticket médio)
- QA: cliquei no botão CSV do DRE → toast "CSV exportado: dre-2026-09.csv" exibido ✓

### FUNCIONALIDADE 4: Atalhos de teclado
- Ctrl+1..6 troca de aba (apenas quando não está digitando em input/textarea/select)
- Implementado via useEffect + window.addEventListener('keydown') no `app-shell.tsx`
- Respeita papeisPermitidos (Ctrl+6 "Usuários" só funciona pra dono)
- Footer discreto mostra dica "Ctrl 1–6 trocar de aba"
- QA: testei Ctrl+5 → Financeiro abriu ✓; Ctrl+1 → Início abriu ✓

### STYLING (melhorias obrigatórias)
- **Header com glassmorphism**: `bg-[var(--surface-app)]/95 backdrop-blur-md` + gradient teal→teal-hover no logo + dot indicador
- **Avatar com iniciais**: `bg-gradient-to-br from-[var(--accent-app)] to-[var(--accent-app-hover)]` + 2 letras maiúsculas do nome
- **Badge de papel no nome da clínica**: pill pequeno "DONO(A)" ao lado do nome
- **Animação de transição entre abas**: `<AnimatePresence mode="wait">` + `motion.div` com opacity+y 4→0→-4 (180ms ease-out)
- **Indicador animado na aba ativa**: `<motion.span layoutId="aba-indicator">` (framer-motion shared layout)
- **Toggle de tema animado**: `<AnimatePresence mode="wait">` no ícone Sun/Moon com rotate 90°
- **Hover states nos KPI cards**: `hover:border-[var(--border-app-strong)] hover:shadow-sm transition-all`
- **Atalhos rápidos**: hover muda o ícone de fundo pra accent color + texto fica accent-text
- **Footer sticky**: gradient shadow discreto na borda superior, mostra atalho + versão
- **Skeletons refinados**: tons corretos `bg-[var(--bg-app-alt-strong)]` (não mais o cinza default)
- **Início tab**: hero card com 2 blobs decorativos blur (top-right + bottom-left) + texto branco sobre gradient

## Stage Summary
### Status atual do projeto
- App 100% funcional + 2 novas abas (Início, Usuários) + exportação CSV/PDF + atalhos de teclado
- 6 abas totais (Início, Custos, Procedimentos, Agenda, Financeiro, Usuários) — CTRL+1..6
- Lint: PASS (0 erros)
- Dev server: sem erros de runtime
- QA agent-browser: todos os fluxos end-to-end validados

### Metas/modificações concluídas
- QA profundo end-to-end (registro, login, custos, capacidade, procedimentos com cálculo, agenda, financeiro completo, DRE, rentabilidade) — todos passando
- Nova aba Início com KPIs + atalhos + atividade
- Nova aba Usuários com convite
- Exportação CSV (BOM UTF-8 + Excel PT-BR) e Imprimir (PDF via browser) em 3 painéis do financeiro
- Atalhos Ctrl+1..6
- Header glassmorphism + animações + avatares com iniciais
- 4 screenshots capturados em /home/z/my-project/download/:
  - `inicio-dashboard.png` — aba Início em modo claro
  - `inicio-dark-mode.png` — aba Início em modo escuro
  - `usuarios-tab.png` — aba Usuários
  - `dre-cascata.png`, `dre-dark-mode.png`, `rentabilidade.png` — financeiro
  - `dark-mode.png`, `dark-mode-rentabilidade.png` (rodadas anteriores)

### Issues/risks não resolvidos
- Nenhum bug identificado nesta rodada — app está em estado estável

### Prioridades recomendadas para próxima rodada (cron 15 min)
1. **Busca global** (Ctrl+K) pra encontrar pacientes/procedimentos/convenios rapidamente
2. **Filtro de agendamentos por intervalo de datas** (hoje só mostra 1 dia por vez)
3. **Indicadores visuais no Dashboard**: mini-sparklines mostrando tendência dos últimos 6 meses
4. **Paginação nas tabelas longas** (Contas a Receber/Pagar com muitos itens)
5. **Modo de impressão dedicado** pra agenda do dia (PDF com layout otimizado pra balcão de recepção)
6. **Configurações da clínica** (editar nome, CNPJ) — atualmente fixo no momento do registro
7. **Glosas: workflow mais rico** com prazos e alertas automáticos
8. **Testes** automatizados com Playwright/Vitest
