# Bagaggio — Gestão de Produtos

Aplicação full stack para gestão de produtos com autenticação JWT, controle de acesso por perfil (RBAC), mensageria assíncrona via RabbitMQ e interface Angular com PrimeNG.

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
- **Separação leitura/escrita não aplicada**: o volume de dados e a infraestrutura de nó único não justificam o custo operacional de uma read replica. Os repositórios já isolam métodos de leitura dos de escrita, o que facilita uma futura migração.

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- Para desenvolvimento local: Python 3.12+ e Node.js 22+

---

## Como executar

### 1. Clonar e configurar variáveis de ambiente

```bash
git clone <url-do-repositorio>
cd bagaggio

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
| RabbitMQ Management | http://localhost:15672 |

### 3. Desenvolvimento local (sem Docker)

#### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure o .env com as URLs locais (ou exporte as variáveis)
export DATABASE_URL="postgresql+asyncpg://bagaggio:changeme@localhost:5432/bagaggio"
export REDIS_URL="redis://:changeme@localhost:6379/0"
export RABBITMQ_URL="amqp://bagaggio:changeme@localhost:5672/"
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

O entrypoint do Docker cria automaticamente um usuário admin, editor e leitor:

| Perfil | Email | Senha |
|--------|-------|-------|
| `admin`| `admin@bagaggio.com` | `admin123` |
| `editor`| `editor@bagaggio.com` | `editor123` |
| `leitor`| `leitor@bagaggio.com` | `leitor123` |

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
bagaggio/
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml           # lint + testes (backend) e build (frontend)
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

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

50 testes cobrindo: login, refresh token, logout, me, CRUD completo de produtos, paginação, filtros, soft delete, audit logs, notificações e cenários de erro (401, 403, 404, 422). Os testes usam PostgreSQL real via **testcontainers** (sem SQLite, sem mocks de banco).

O CI (GitHub Actions) executa `ruff check` + `pytest` no backend e `ng build --configuration production` no frontend a cada push ou PR para `main`.

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

Este projeto foi desenvolvido como desafio técnico e é disponibilizado sob a licença [MIT](https://opensource.org/licenses/MIT).
