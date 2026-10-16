# Integração contínua local e GitHub

Os workflows não publicam a aplicação. E11 permanece fora do escopo. Os arquivos passam a executar remotamente somente depois de serem versionados e enviados pelo responsável; esta implementação não realizou push nem configurou a conta GitHub.

## Checks por repositório

Backend: instalação por lockfile, ambiente efêmero de teste, migrations, lint sem correção, build, unitários, integração, e2e HTTP e comparação do OpenAPI gerado com o versionado.

Frontend: instalação por lockfile, lint, tipos de testes, Vitest e build. Os jobs usam Node definido em `.node-version` e actions fixadas por commit. PostgreSQL do job backend é temporário e exposto somente ao runner. O helper de ambiente recusa sobrescrever arquivos locais e só funciona com `CI=true`.

Configurar os checks como obrigatórios nas regras da branch depois da primeira execução bem-sucedida, conforme os recursos disponíveis na conta. Workflow escrito não comprova execução no GitHub.

## Verificação integrada

Disparar `Fullstack validation (no deployment)` no backend com os SHAs completos dos dois repositórios. Os nomes remotos continuam `anaperinii/imunecare-backend` e `anaperinii/imunecare-web`; os checkouts são organizados como pastas `allervia-*` para compatibilidade com os scripts.

Informar também `contract_base_sha`, commit backend que contenha o contrato anterior revisado. O comparador recusa referência ausente em vez de passar silenciosamente. Na primeira adoção, registrar explicitamente o contrato inicial aprovado; comparação desse contrato consigo mesmo comprova funcionamento da ferramenta, não compatibilidade histórica. Downloads do oasdiff 1.11.7 são conferidos contra checksums oficiais versionados antes da extração e execução.

Se o frontend for privado, cadastrar `FULLSTACK_READ_TOKEN` com leitura de conteúdo limitada ao repositório do frontend, ou substituir por token temporário de GitHub App. Não utilizar token com permissão de publicação. O workflow é manual e restrito a responsáveis que possam selecionar código confiável; não é destinado a executar SHAs de contribuidores não confiáveis com acesso a segredos.

O harness backend já supervisiona o teste de contrato HTTP. Playwright supervisiona seus servidores e recusa reutilizar processos preexistentes. As jornadas são serializadas no job porque compartilham o banco demo. A comparação de tipos ocorre após exportação OpenAPI.

O ambiente sintético de navegador utiliza `RATE_LIMIT_EXPORT_MAX=1000` para permitir repetições sem esgotar quota de uma mesma fixture. Essa configuração não é aplicada ao Compose nem aos testes específicos de rate limit. A suite de navegador tem retries automáticos desativados; falhas precisam de diagnóstico antes de nova execução.

A suite ainda contém diagnóstico de reprodução separado das provas de aceite. Resultados de navegador e falhas devem ser examinados, não convertidos em sucesso por retries. O manifesto gerado por `npm run validation:manifest` registra SHA e digest da árvore local alterada, sem confundir HEAD com o conteúdo efetivamente testado.

## Verificação sem Docker

`node scripts/operations/validate-local-runtime.cjs` utiliza o banco demo já configurado e protegido, inicia API compilada na porta 3119 e frontend de desenvolvimento na 5179, executa as jornadas e encerra somente seus próprios processos. Recusa portas já ocupadas. Esse modo valida a inicialização compilada do Nest e as jornadas, mas não substitui o teste do frontend estático, TLS, SMTP e rede do Compose.

## Dependências e limitações

Auditorias locais ficam em `artifacts/dependency-audit-*.json`, ignoradas pelo Git. Seus resultados devem ser classificados por exposição e dependência, sem `npm audit fix --force`. As atualizações selecionadas precisam de revalidação. A existência de avisos não prova exploração, e aprovação de testes não elimina vulnerabilidades.
