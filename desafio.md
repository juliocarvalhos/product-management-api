# 🧩 Desafio Técnico: Aplicação Full Stack de Gestão de Produtos

## 🎯 Objetivo

Construir uma aplicação **full stack** para **gestão de produtos**, contendo autenticação, controle de acesso, documentação técnica e integração assíncrona com mensageria.

A proposta não é criar um sistema gigante.  
A proposta é avaliar se você consegue desenvolver uma solução **coesa, segura, organizada e com boa separação de responsabilidades**, como alguém que já atua com autonomia em ambiente profissional.

> **Entrega:** repositórios públicos no GitHub para frontend e backend  
> **Prazo sugerido:** até 5 dias corridos  
> **Foco:** qualidade de implementação, organização, clareza técnica e boas decisões de arquitetura

---

# ✅ O que será avaliado

- Organização da solução como um todo
- Qualidade da arquitetura e separação de responsabilidades
- Clareza e legibilidade do código
- Segurança básica aplicada no frontend e backend
- Boas práticas de API e persistência
- Uso consistente da mensageria no fluxo da aplicação
- Qualidade da documentação
- Capacidade de deixar o projeto fácil de rodar e entender
- Maturidade técnica nas decisões tomadas

---

# 🏗️ Escopo do projeto

A aplicação deve permitir:

- autenticação de usuários
- acesso protegido no frontend e backend
- cadastro, listagem, edição e remoção de produtos
- persistência em banco de dados
- publicação e/ou consumo de eventos via RabbitMQ
- documentação da API
- instruções claras de execução via README

---

# 🧱 Stack obrigatória

## Frontend
- **Angular**

## Backend
- **Python + FastAPI**

## Mensageria
- **RabbitMQ**

## Banco de dados
- **PostgreSQL e/ou MongoDB**

## Opcional como apoio
- **Redis** (cache, blacklist de token, rate limit, sessão auxiliar, etc.)

---

# 📦 Requisitos funcionais obrigatórios

## 1) Autenticação e autorização

A aplicação deve possuir autenticação de usuários.

### Obrigatório
- Login com credenciais
- Proteção de rotas no frontend
- Proteção de endpoints no backend
- Usuário autenticado deve conseguir acessar o CRUD de produtos
- Usuário não autenticado não deve acessar recursos protegidos

### Esperado
- JWT ou mecanismo equivalente
- Senha armazenada de forma segura
- Fluxo claro de autenticação
- Tratamento adequado para token inválido ou expirado

### Diferencial
- Refresh token
- Controle de perfil/permissão
- Logout invalidando sessão/token
- Estratégia de renovação automática no frontend

---

## 2) CRUD de produtos

A aplicação deve conter um CRUD completo de produtos.

### Entidade mínima sugerida: `Produto`

Campos obrigatórios:
- `id`
- `nome`
- `descricao`
- `preco`
- `quantidade`
- `ativo`
- `created_at`
- `updated_at`

### Operações obrigatórias
- **POST** criar produto
- **GET** listar produtos
- **GET** buscar produto por ID
- **PUT** atualizar produto
- **DELETE** remover produto

### Regras esperadas
- validação dos dados de entrada
- respostas HTTP coerentes
- tratamento de cenários de erro
- persistência real em banco

### Diferencial
- paginação
- filtros por nome, status ou faixa de preço
- ordenação
- soft delete
- busca textual
- auditoria básica de alterações

---

## 3) Frontend da aplicação

A aplicação Angular deve consumir a API real do backend.

### Funcionalidades mínimas
- tela de login
- tela de listagem de produtos
- tela ou modal para criação de produto
- tela ou modal para edição de produto
- ação de remoção com confirmação
- feedback de sucesso/erro para o usuário
- rotas protegidas
- tratamento básico de estados de carregamento

### Esperado
- organização por módulos, páginas, serviços, guards, interceptors e models
- uso de formulários reativos
- validações no frontend
- interceptor para envio do token
- tratamento de erro de autenticação e autorização

### Diferencial
- utilização da biblioteca de componentes [PrimeNG](https://primeng.org), em qualquer versão entre a **17** e a **21** (Com as versões 17 e 21 inclusas)
- layout limpo e responsivo
- componentização consistente
- cache local controlado
- paginação/filtros integrados à API
- tratamento elegante de loading/empty state

---

## 4) Uso obrigatório de RabbitMQ

RabbitMQ não deve entrar no projeto apenas para “cumprir tabela”.

É necessário existir pelo menos **um fluxo real** utilizando mensageria.

### Exemplos válidos
- publicar evento de criação, edição ou remoção de produto
- gerar log ou auditoria assíncrona
- atualização de estoque assíncrona
- notificação interna
- integração simulada entre serviços
- processamento desacoplado após ação do usuário

### Esperado
- producer e consumer organizados
- payload bem definido
- fluxo claro e justificável
- tratamento básico de falhas

### Diferencial
- retry
- dead-letter strategy
- idempotência
- desacoplamento mais refinado entre domínio principal e processamento assíncrono

---

# 🔐 Requisitos técnicos obrigatórios

## Backend
- FastAPI estruturado em camadas
- validação com Pydantic
- organização por módulos
- uso de variáveis de ambiente
- documentação automática disponível via Swagger/OpenAPI
- documentação organizada com **tags**, descrições e schemas claros

### Estrutura esperada

Exemplo (Abstrato):
- `app/entities`
- `app/functions`
- `app/logger`
- `app/managers`
- `app/routes`
- `app/workers`
- `app/messaging`

> Não é obrigatório seguir exatamente essa estrutura, mas a organização adotada deve demonstrar coerência arquitetural.

---

## Segurança mínima esperada
- hash de senha
- rotas protegidas
- validação de entrada
- cuidado com exposição de dados sensíveis
- CORS configurado conscientemente
- separação entre configuração sensível e código-fonte

### Diferencial
- rate limiting
- refresh token seguro
- blacklist de token com Redis
- logs estruturados
- headers ou middlewares de segurança
- observabilidade básica

---

## Banco de dados

Pode ser usado:
- **PostgreSQL**
- **MongoDB**
- ou ambos, se fizer sentido para a solução

### Esperado
- modelagem coerente
- persistência consistente
- integridade mínima dos dados

### Diferencial
- uso correto de índices
- versionamento de schema
- separação entre leitura e escrita quando fizer sentido

---

# 📘 Documentação obrigatória

## 1) Documentação da API

A API deve estar documentada via Swagger/OpenAPI do FastAPI, com:
- agrupamento por tags
- descrições claras
- exemplos de request e response, quando possível
- status codes coerentes

## 2) README obrigatório

O repositório deve conter um `README.md` com:

### Visão geral do projeto
- objetivo da aplicação
- arquitetura resumida
- tecnologias utilizadas
- justificativa breve das principais decisões

### Como executar
- pré-requisitos
- configuração de variáveis de ambiente
- como subir o backend
- como subir o frontend
- como subir dependências como banco e RabbitMQ
- comandos necessários

### Uso
- credenciais de teste, se houver
- fluxo principal de navegação
- endpoints principais
- prints ou descrição das telas

### Estrutura
- organização das pastas
- explicação resumida das responsabilidades principais

---

# 🐳 Diferencial fortemente valorizado

Mesmo não sendo 100% obrigatório, os itens abaixo serão considerados diferenciais relevantes:

- `Dockerfile` para frontend e backend
- `docker-compose.yml` para subir a stack completa
- testes automatizados
- pipeline simples de CI
- collection do Postman ou Insomnia
- monitoramento ou logs básicos

---

# 🧪 O que esperamos em termos de qualidade

Este desafio não busca um projeto excessivamente grande.

Queremos avaliar se você sabe construir uma aplicação com:
- começo, meio e fim
- responsabilidades bem separadas
- decisões técnicas justificáveis
- código sustentável
- preocupação real com segurança e manutenção

Em resumo:  
menos volume de funcionalidades por aparência,  
mais qualidade de implementação e clareza técnica.

---

# 🚫 O que evitar

- misturar regra de negócio diretamente em controller, router ou endpoint
- deixar autenticação improvisada
- usar RabbitMQ de forma artificial e sem propósito
- README superficial
- código excessivamente acoplado e difícil de entender
- respostas HTTP inconsistentes
- projeto difícil de executar por falta de instruções

---

# 📮 Entrega

O repositório deve conter, no mínimo:

- código do **frontend**
- código do **backend**
- `README.md`
- arquivo(s) de configuração de ambiente de exemplo
- dependências declaradas
- instruções claras para execução

### Formato sugerido
- monorepo com `/frontend` e `/backend`
  
**ou**

- dois repositórios separados, desde que bem documentados

---

# ⭐ Diferenciais que podem destacar a entrega

- arquitetura limpa e consistente
- autenticação bem implementada
- uso maduro de mensageria
- documentação excelente
- Docker funcionando corretamente
- testes cobrindo pontos críticos
- preocupação com experiência de desenvolvimento e manutenção

---

# 🧠 Observação final

* Não esperamos um sistema grande e excessivamente complexo.

* Esperamos uma aplicação **enxuta, profissional e bem executada**.

* Um CRUD full stack com autenticação, mensageria, documentação e boa arquitetura já é mais do que suficiente para demonstrar maturidade técnica, desde que esteja **bem feito**.

* **O uso de inteligência artificial não é proibido, desde que ocorra apenas como suporte pontual ao desenvolvimento, e não como substituição da capacidade técnica esperada do candidato.**

* **Informamos ainda que utilizamos ferramentas de detecção de código gerado por IA. Caso seja constatado que o projeto foi desenvolvido integralmente ou em sua maior parte com o uso dessas ferramentas, o candidato será desclassificado do processo seletivo.**