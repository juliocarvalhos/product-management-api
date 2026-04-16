# Product Management API

[![CI](https://github.com/juliocarvalhos/product-management-api/actions/workflows/ci.yml/badge.svg)](https://github.com/juliocarvalhos/product-management-api/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-FF6600?logo=rabbitmq&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Aplicação full stack de gestão de produtos com autenticação JWT + RBAC, auditoria assíncrona via RabbitMQ (retry, DLQ e idempotência) e notificações de estoque zerado. Backend em FastAPI totalmente assíncrono, frontend em Angular 19 + PrimeNG, tudo orquestrado com Docker Compose e validado por CI no GitHub Actions.

## Screenshots

![Lista de produtos](docs/screenshots/products.png)

| Login | Cadastro de produto |
|-------|---------------------|
| ![Login](docs/screenshots/login.png) | ![Cadastro de produto](docs/screenshots/product-form.png) |

| Notificações de estoque zerado | Logs de auditoria |
|--------------------------------|-------------------|
| ![Notificações](docs/screenshots/notifications.png) | ![Logs de auditoria](docs/screenshots/audit-logs.png) |

## Destaques

- **Mensageria resiliente**: eventos de domínio publicados numa topic exchange, consumer com retentativas, dead-letter queue e deduplicação por `event_id`.
- **Segurança**: access token de curta duração, refresh token rotativo em cookie `HttpOnly`, blacklist por JTI no Redis, rate limiting e security headers.
- **Arquitetura em camadas**: routes → services → repositories, async de ponta a ponta (SQLAlchemy async, asyncpg, aio-pika).
- **Testes reais**: testes de integração no backend contra PostgreSQL real via testcontainers e testes unitários no frontend, todos rodando no CI a cada push.

## Contexto

O projeto nasceu como um desafio técnico com prazo de 5 dias. O enunciado pedia CRUD de produtos com autenticação JWT, frontend Angular consumindo a API real, persistência em PostgreSQL e **pelo menos um fluxo real** usando RabbitMQ, com foco em arquitetura, segurança e clareza.

Além do obrigatório, foram implementados os itens listados como diferenciais:

- refresh token com rotação, logout com blacklist no Redis e renovação automática no frontend;
- RBAC com três perfis (`leitor`, `editor`, `admin`);
- paginação, filtros, ordenação e soft delete;
- auditoria assíncrona via RabbitMQ com retry, dead-letter queue e idempotência;
- rate limiting, security headers e logs estruturados;
- PrimeNG, testes automatizados e CI.

---

## Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Frontend | Angular 19 + PrimeNG 19 (tema Aura) |
| Backend | Python 3.12 + FastAPI |
| Banco de dados | PostgreSQL 16 |
| Cache / Blacklist / Rate limit | Redis 7 |
| Mensageria | RabbitMQ 3.13 |
| Containerização | Docker + Docker Compose |
| CI | GitHub Actions |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│  Angular (porta 4200)                               │
│  Login · Lista de Produtos · Notificações · Guards  │
└──────────────────────────┬──────────────────────────┘
                           │ HTTP REST
┌──────────────────────────▼──────────────────────────┐
│  FastAPI (porta 8000)                               │
│  routes → services → repositories → models         │
│                    │                                │
│            ┌───────▼────────┐                       │
│            │  RabbitMQ      │                       │
│            │  Publisher     │                       │
│            └───────┬────────┘                       │
│                    │ (background task)               │
│            ┌───────▼────────┐                       │
│            │  Consumer      │  → audit_logs (DB)    │
│            │                │  → notifier (Redis)   │
│            └────────────────┘                       │
└──────────────────────────────────────────────────────┘
         │                    │              │
   PostgreSQL               Redis        RabbitMQ
```

### Decisões arquiteturais

- **Separação em camadas**: routes (HTTP) → services (regras de negócio) → repositories (acesso a dados). Nenhuma query SQL em controllers.
- **Async end-to-end**: SQLAlchemy async + asyncpg + aio-pika. O event loop do FastAPI nunca é bloqueado.
- **Consumer como background task**: o consumer RabbitMQ roda como `asyncio.Task` dentro do lifespan do FastAPI. Escalável para serviço separado sem alterar a lógica.
- **Soft delete**: `deleted_at` em vez de DELETE físico preserva referência nos audit logs.
- **Refresh token rotation**: cada uso do refresh token gera um novo par e invalida o anterior via Redis (blacklist por JTI). O refresh token trafega exclusivamente via cookie `HttpOnly`.
- **RBAC via `require_roles`**: `Depends` reutilizável aplicado por rota. Perfis: `leitor` (leitura), `editor` (leitura + escrita), `admin` (acesso total incluindo audit logs).
- **Rate limiting**: slowapi + Redis. Login: 5 req/min por IP; refresh: 10 req/min por IP. Resposta padronizada HTTP 429.
- **Security headers**: middleware aplica `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy` e `Permissions-Policy` em todas as respostas.
- **Notificações de estoque zerado**: quando um produto atinge `quantidade = 0` o consumer persiste a notificação no Redis (até 100 entradas, LIFO). O frontend consulta a cada 10 segundos (polling). Para a escala do projeto é suficiente; em produção com múltiplos usuários seria substituído por SSE ou WebSocket.
- **Dual-write sem Transactional Outbox (trade-off consciente)**: o produto é gravado no banco e o evento é publicado no RabbitMQ logo após o commit. Se o broker estiver indisponível nesse instante, o evento se perde e a auditoria fica incompleta. Publicar antes do commit seria pior, porque geraria eventos de alterações que nunca aconteceram. A evolução natural é um **Transactional Outbox**: gravar o evento numa tabela `outbox` na mesma transação do produto e deixar um relay publicar no broker de forma assíncrona, garantindo entrega *at-least-once* (o consumer já é idempotente).
- **Senhas e tokens**: hashing com `bcrypt` direto e JWT com `PyJWT`, ambas bibliotecas mantidas ativamente. No login, quando o e-mail não existe, o servidor calcula um hash falso para manter o tempo de resposta igual e não revelar quais e-mails estão cadastrados.
- **Configuração segura por padrão**: URLs de conexão e `SECRET_KEY` não têm valor padrão no código e precisam vir do ambiente. Com `ENVIRONMENT=production`, a aplicação não sobe se a `SECRET_KEY` for curta ou um placeholder.
- **Container sem privilégios**: a imagem do backend roda com um usuário não-root (`app`) e tem `HEALTHCHECK` próprio.
- **Separação leitura/escrita não aplicada**: o volume de dados e a infraestrutura de nó único não justificam o custo operacional de uma read replica. Os repositórios já isolam métodos de leitura dos de escrita, o que facilita uma futura migração.

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- Para desenvolvimento local: Python 3.12+ e Node.js 22+

---

## Como executar

### 1. Clonar e configurar variáveis de ambiente

```bash
git clone https://github.com/juliocarvalhos/product-management-api.git
cd product-management-api

cp .env.example .env
# Edite o .env com valores seguros (especialmente SECRET_KEY)
```

Gere uma `SECRET_KEY` segura:
```bash
openssl rand -hex 32
```

### 2. Subir toda a stack com Docker

```bash
docker-compose up --build
```

Aguarde os health checks passarem (~30 segundos na primeira execução).

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:8000 |
| Swagger / OpenAPI | http://localhost:8000/docs |
| RabbitMQ Management | http://localhost:15673 |

### 3. Desenvolvimento local (sem Docker)

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure o .env com as URLs locais (ou exporte as variáveis)
export DATABASE_URL="postgresql+asyncpg://product_manager:changeme@localhost:5432/product_manager"
export REDIS_URL="redis://:changeme@localhost:6379/0"
export RABBITMQ_URL="amqp://product_manager:changeme@localhost:5672/"
export SECRET_KEY="seu-secret-aqui"

alembic upgrade head
python scripts/create_user.py
uvicorn app.main:app --reload
```

#### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
ng serve
```

---

## Credenciais de teste

Com `ENVIRONMENT=development` (padrão do `.env.example`), o entrypoint do Docker cria automaticamente um usuário admin, editor e leitor, além de 20 produtos de exemplo. Em outros ambientes isso só acontece com `SEED_DATA=true`, para que credenciais de demonstração nunca cheguem a produção.

| Perfil | Email | Senha |
|--------|-------|-------|
| `admin`| `admin@productmanager.dev` | `admin123` |
| `editor`| `editor@productmanager.dev` | `editor123` |
| `leitor`| `leitor@productmanager.dev` | `leitor123` |

Para criar outros usuários:
```bash
docker-compose exec backend python scripts/create_user.py email@exemplo.com usuario senha123
```

Para popular o banco com produtos de exemplo:
```bash
docker-compose exec backend python scripts/seed_products.py
```

---

## Endpoints

### Autenticação

| Método | Endpoint | Descrição | Perfil |
|--------|----------|-----------|--------|
| `POST` | `/api/v1/auth/login` | Login com email e senha (rate limit: 5/min) | — |
| `POST` | `/api/v1/auth/refresh` | Renovar tokens via cookie HttpOnly (rate limit: 10/min) | — |
| `POST` | `/api/v1/auth/logout` | Encerrar sessão (blacklist JWT) | autenticado |
| `GET` | `/api/v1/auth/me` | Dados do usuário autenticado | autenticado |

### Produtos

| Método | Endpoint | Descrição | Perfil |
|--------|----------|-----------|--------|
| `GET` | `/api/v1/products/` | Listar com paginação e filtros | qualquer |
| `POST` | `/api/v1/products/` | Criar produto | editor, admin |
| `GET` | `/api/v1/products/{id}` | Buscar por ID | qualquer |
| `PUT` | `/api/v1/products/{id}` | Atualizar produto | editor, admin |
| `DELETE` | `/api/v1/products/{id}` | Soft delete | editor, admin |

**Query params** para `GET /api/v1/products/`:

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `page` | int | Página (padrão: 1) |
| `size` | int | Itens por página (padrão: 20, máx: 100) |
| `nome` | string | Filtro parcial (ILIKE) |
| `ativo` | bool | Filtrar por status |
| `preco_min` / `preco_max` | decimal | Faixa de preço |
| `order_by` | string | `nome`, `preco`, `created_at`, `quantidade` |
| `order_dir` | string | `asc` ou `desc` |

### Audit Logs

| Método | Endpoint | Descrição | Perfil |
|--------|----------|-----------|--------|
| `GET` | `/api/v1/audit-logs/` | Listar logs de auditoria paginados | admin |

**Query params**:

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `page` / `size` | int | Paginação (padrão: 1/20, máx size: 100) |
| `entity_id` | UUID | Filtrar por produto |
| `action` | string | `CREATE`, `UPDATE` ou `DELETE` |
| `actor_id` | UUID | Filtrar por usuário |

### Notificações

| Método | Endpoint | Descrição | Perfil |
|--------|----------|-----------|--------|
| `GET` | `/api/v1/notifications/` | Listar notificações de estoque zerado | editor, admin |
| `PATCH` | `/api/v1/notifications/{id}/read` | Marcar notificação como lida | editor, admin |

### Health

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/health` | Status da aplicação |

Documentação interativa completa disponível em [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Fluxo RabbitMQ

Toda mutação de produto (criar, editar, deletar) publica um evento na exchange `product.events` (topic exchange). O consumer, rodando como background task, consome a fila `audit.product.events`, persiste o evento na tabela `audit_logs` e, quando `quantidade = 0`, aciona o notifier.

```
product.created → product.events (topic) → audit.product.events → audit_logs
product.updated ↗                                                ↗ notifier (Redis, se estoque zerado)
product.deleted ↗       [falha] → audit.product.events.dead (DLQ)
```

Estratégia de falha:
- **Erro de validação**: `nack` imediato → DLQ
- **Erro transitório**: até 3 retentativas (header `x-retry-count`), depois → DLQ
- **Idempotência**: `event_id` verificado no Redis (TTL 24h) — mensagens duplicadas são descartadas com `ack`

---

## Perfis de acesso (RBAC)

| Perfil | Leitura | Escrita | Audit logs | Notificações |
|--------|---------|---------|------------|--------------|
| `leitor` | ✓ | — | — | — |
| `editor` | ✓ | ✓ | — | ✓ |
| `admin` | ✓ | ✓ | ✓ | ✓ |

---

## Estrutura do projeto

```
product-management-api/
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml           # lint + testes + cobertura (backend), testes + build (frontend), build das imagens
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh        # migrations + seed + uvicorn
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── alembic/             # migrações versionadas
│   ├── scripts/
│   │   ├── create_user.py
│   │   └── seed_products.py
│   ├── tests/               # 50 testes (pytest-asyncio + testcontainers)
│   └── app/
│       ├── main.py          # factory, lifespan, CORS, security headers
│       ├── config.py        # pydantic-settings
│       ├── dependencies.py  # FastAPI Depends (CurrentUser, require_roles)
│       ├── core/
│       │   ├── security.py  # JWT, hashing
│       │   ├── limiter.py   # slowapi rate limiter
│       │   ├── exceptions.py
│       │   └── logging.py
│       ├── db/              # session, redis
│       ├── models/          # SQLAlchemy ORM (User, Product, AuditLog)
│       ├── schemas/         # Pydantic request/response
│       ├── repositories/    # acesso a dados
│       ├── services/        # regras de negócio
│       ├── routes/
│       │   ├── auth.py
│       │   ├── products.py
│       │   ├── audit_logs.py
│       │   └── notifications.py
│       └── messaging/
│           ├── publisher.py
│           ├── consumer.py
│           ├── handlers.py
│           ├── notifier.py  # notificações de estoque zerado (Redis)
│           └── connection.py
└── frontend/
    ├── Dockerfile           # multi-stage: node build → nginx
    ├── nginx.conf
    └── src/app/
        ├── core/            # guards, interceptors, services, models
        ├── features/
        │   ├── auth/          # login page
        │   ├── products/      # product list, service, models
        │   ├── audit-logs/    # listagem de logs de auditoria
        │   └── notifications/ # notificações de estoque zerado
        └── shared/            # product-form-modal
```

---

## Testes

### Backend

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

50 testes cobrindo: login, refresh token, logout, me, CRUD completo de produtos, paginação, filtros, soft delete, audit logs, notificações e cenários de erro (401, 403, 404, 422). Os testes usam PostgreSQL real via **testcontainers** (sem SQLite, sem mocks de banco).

### Frontend

```bash
cd frontend
npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox
```

66 testes unitários (Jasmine + Karma) cobrindo guards, interceptors, serviços de autenticação e de produtos, armazenamento de token e o componente de login.

O CI (GitHub Actions) roda a cada push ou PR para `main` em três jobs:

- **backend**: `ruff check` e `pytest` com relatório de cobertura, publicado no resumo da execução (~70% atualmente);
- **frontend**: `ng test` e `ng build --configuration production`;
- **docker**: `docker compose build`, para garantir que as imagens continuam sendo construídas.

---

## Variáveis de ambiente

Consulte [.env.example](.env.example) para a lista completa. As variáveis mínimas obrigatórias são:

```env
POSTGRES_PASSWORD=...
REDIS_PASSWORD=...
RABBITMQ_PASSWORD=...
SECRET_KEY=...     # openssl rand -hex 32
```

---

## Licença

Distribuído sob a licença [MIT](LICENSE).
