# Ambiente local de validação com Docker Compose

Este ambiente implementa a parte local de E10. Não cria hospedagem e não executa E11, que permanece roadmap futuro. O fluxo habitual de desenvolvimento continua disponível.

## Pré-requisitos

Docker Engine com containers Linux e Compose v2 em funcionamento. Os repositórios devem estar em diretórios irmãos `allervia-backend` e `allervia-web`, ou o caminho do frontend deve ser ajustado no arquivo privado. A porta 8443 do site e a porta 8025 do capturador devem estar livres. Ambas são publicadas somente em loopback.

As imagens têm tags explícitas em `compose.validation.yml` e nos Dockerfiles. Elas não representam publicação aprovada para produção. O backend usa Node 22.22.0 no container; a validação fora de Docker deve registrar sua própria versão.

## Primeira configuração

No diretório do backend:

```powershell
npm run local:init
docker compose --env-file .env.compose.local -f compose.validation.yml config --quiet
npm run local:up
docker compose --env-file .env.compose.local -f compose.validation.yml ps -a
```

O inicializador gera senhas e chaves aleatórias, não imprime os valores e recusa sobrescrever configuração existente. `.env.compose.local` é privado e ignorado pelo Git. O arquivo de exemplo documenta os campos. Não enviar o resultado de `docker compose config` sem `--quiet`, pois pode conter valores resolvidos.

A ordem é: certificados locais e banco; migration após banco saudável; capturador SMTP; backend após migration bem-sucedida; frontend após readiness da API. Uma migration que falha não deve ser contornada removendo a dependência. O runtime não contém seed automático.

O banco `allervia_demo` existe exclusivamente no volume deste projeto Compose. Não há porta de banco publicada. A rede interna não oferece saída externa aos serviços da aplicação; Google fica sem credenciais e não há acesso a Mailjet. O capturador não possui configuração de relay.

## HTTPS local

O site estará em `https://localhost:8443`. A autoridade certificadora é gerada exclusivamente para este projeto, com certificado de servidor válido por 90 dias. Node confia nessa autoridade via `NODE_EXTRA_CA_CERTS`; verificação TLS não é desligada. O mesmo certificado tem SAN para localhost e para o capturador SMTP.

Exportar somente o certificado público da autoridade:

```powershell
New-Item -ItemType Directory -Force artifacts | Out-Null
docker compose --env-file .env.compose.local -f compose.validation.yml cp backend:/certs/ca.crt artifacts/local-ca.crt
```

Para navegação sem alerta de certificado, revisar e importar essa autoridade no armazenamento de confiança do usuário/navegador de teste. Essa alteração de confiança não é feita automaticamente por scripts. Nunca importar nem compartilhar `ca.key` ou `server.key`. Ao encerrar definitivamente o uso desse ambiente, remover a autoridade local importada. Não ignorar erros de HTTPS para afirmar que a configuração de confiança foi validada.

O backend utiliza `NODE_ENV=production` com cookie Secure/HttpOnly e origem exata. MFA está explicitamente opcional para as contas sintéticas desta instalação; isso não define a política futura de produção. Não há confiança ampla em `X-Forwarded-For`: o proxy é local e a API não publica porta própria. O endereço registrado por limites de IP pode corresponder ao proxy nesta topologia restrita.

## Dados sintéticos e email

Depois de o banco e as migrations estarem prontos:

```powershell
npm run local:seed
```

O serviço de seed compartilha o namespace de rede do banco para utilizar localhost e preservar a guarda existente de banco demo. Ele carrega configurações próprias, força transporte de log e desativa dispatchers durante a carga. Não permite reset nem altera a base já usada no computador. O seed existente é versionado e recusa condições incompatíveis; não remover suas guardas.

A conta sintética de médico é `medico.aurora@demo.allervia.local`, com senha de demonstração definida no script de seed. Essas credenciais não podem ser utilizadas fora deste ambiente. O seed Compose não habilita MFA para as contas; a suíte MFA usa o ambiente demo separado do harness, com suas credenciais privadas.

Consultar mensagens locais em `http://localhost:8025`. O backend envia por STARTTLS ao Mailpit com certificado local verificado. SMTP não é publicado para fora da rede Compose. Mensagens podem incluir links de acesso e devem continuar privadas. A interface do capturador usa HTTP somente em loopback; não expor essa porta na rede.

## Operação habitual

```powershell
docker compose --env-file .env.compose.local -f compose.validation.yml ps
docker compose --env-file .env.compose.local -f compose.validation.yml logs --tail 100 backend
npm run local:down
```

A parada normal preserva os volumes. Não utilizar `down -v` como parada habitual. Não há comando automático de destruição dos dados. A remoção deliberada de volume exige confirmar o nome do projeto, do volume e a ausência de dados que devam ser preservados.

Para atualizar código, registrar os dois SHAs, executar novamente `local:up` e conferir resultado da tarefa de migration e health checks. Alterações compiladas do frontend exigem rebuild. Se houver migrations novas sem rebuild da imagem de ferramentas, executar explicitamente a tarefa nova com a imagem atualizada; nunca presumir que reiniciar um container antigo aplicará arquivos novos.

## Saúde e diagnóstico

`/backend/health/live` verifica processo; `/backend/health/ready` consulta banco. Nenhum deles informa credenciais ou dados clínicos. A prontidão não depende de Google ou SMTP. Falha da fila deve ser diagnosticada separadamente.

`HTTP_METRICS_LOG=true` produz duração, método, rota parametrizada, status e request ID. Não inclui corpo, query string, cookie ou token. O backend não habilita logs SQL por padrão. Auditoria clínica continua separada dos logs técnicos.

O desligamento por sinal ativa hooks do Nest. Dispatchers de notificações e calendário aguardam a tentativa corrente; a conexão Prisma só fecha na fase de shutdown da aplicação. O Compose concede 45 segundos antes do encerramento forçado. Jobs com lease devem poder ser retomados se a operação ultrapassar esse prazo.

Para consultar contagens pendentes, data do item mais antigo e máximo de tentativas, sem payloads ou destinatários:

```powershell
docker compose --env-file .env.compose.local -f compose.validation.yml exec backend node scripts/operations/queue-status.cjs
```

Os agregados de itens ainda não processados incluem falhas terminais. Consultá-los junto aos critérios de retentativa do serviço; uma contagem isolada não diferencia trabalho elegível de falha que exige intervenção.

## Backup e exercício de restauração

```powershell
npm run local:backup
npm run local:restore-check
```

O backup é gravado em `artifacts/recovery/validation.dump`, fora do Git, com recusa de sobrescrita. O exercício restaura em banco novo `allervia_restore_<instante>`, no mesmo PostgreSQL local, sem substituir a base de validação. O relatório registra duração e contagens de paciente, dose, auditoria e migrations.

A conferência SQL é somente uma parte da recuperação. Antes de declarar recuperação funcional concluída, iniciar uma aplicação separada contra o banco restaurado, conter efeitos externos e validar leitura e autenticação. RPO/RTO de produção não são definidos por este exercício local. Nenhum resultado deve ser declarado sem executar o procedimento.

## Limites e evidências

A sintaxe do Compose pode ser validada sem motor Docker, mas build, TLS, SMTP e restauração dependem de execução real. Consultar o [relatório de E10](../integration/e10-execution-report.md) para distinguir verificações executadas das pendentes. A ausência de motor Docker funcionando impede certificar o conjunto, mesmo quando build e testes fora dos containers passam.

O encadeamento utiliza as condições documentadas pelo [Docker Compose](https://docs.docker.com/compose/how-tos/startup-order). O capturador utiliza as opções de certificado e STARTTLS do [Mailpit](https://mailpit.axllent.org/docs/configuration/smtp/).
