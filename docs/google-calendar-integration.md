# Integração com o Google Calendar

Sincronização bidirecional entre os compromissos (`Appointment`) do Allervia e a
agenda Google pessoal de cada profissional. O Allervia é o sistema de registro:
toda regra clínica continua aqui; o Google Calendar é um espelho de agenda.

## Decisões de arquitetura

| Tema | Decisão |
| --- | --- |
| Autorização | OAuth2 por profissional (`access_type=offline`, `prompt=consent`) no calendário `primary`. Escopos: `https://www.googleapis.com/auth/calendar.events` (único que dá acesso a dados) mais `openid` e `userinfo.email`, que só servem para gravar qual conta Google foi conectada. |
| Armazenamento do refresh token | AES-256-GCM com chave dedicada (`GOOGLE_TOKEN_ENCRYPTION_KEY`, 32 bytes base64), colunas `refreshTokenCiphertext/Iv/AuthTag/keyVersion` no mesmo formato do `MfaCredential`. |
| Fila de sincronização | Tabela própria `CalendarSyncJob` no padrão outbox: o job é gravado na mesma transação do fato de origem e consumido pelo `CalendarSyncDispatcher` (`setInterval` de 15 s, desligado em testes). A coluna `pendingKey` (`PUSH:<appointmentId>` / `PULL:<connectionId>`, nula quando o job fecha) com índice único garante no máximo um job pendente por appointment e por conexão. |
| Retentativa | Backoff exponencial `min(30s * 2^tentativas, 1h)`, respeitando `Retry-After`; dead-letter em 8 tentativas (o job ganha `processedAt` e perde a `pendingKey` para liberar o slot de deduplicação, seguindo visível no status por `attempts >= 8`). |
| Cliente HTTP | `fetch` nativo em `GoogleCalendarFetchClient`, atrás da classe abstrata `GoogleCalendarClient` (substituída por fake nos testes). Nenhuma dependência nova. |
| Direção do vínculo | `Appointment.professionalId` (novo) identifica o dono da agenda. Backfill a partir de `createdById → Professional.userId`. |
| Correlação | `extendedProperties.private.allerviaAppointmentId` no evento + tabela `GoogleCalendarEventLink` (`appointmentId ↔ googleEventId`, `etag`, `lastSyncedHash`). |

## Conteúdo do evento (LGPD)

- `summary`: `title` do appointment ou `Consulta — <primeiro nome do paciente>`.
- `description`: as notas do appointment. **Risco aceito pela responsável pelo
  produto em 01/10/2026**: notas clínicas passam a residir também na
  infraestrutura do Google, sob a conta pessoal do profissional.
- Sem convidados (`attendees`): o paciente nunca é convidado nem notificado pelo
  Google.
- `visibility: private`.
- Mitigações: escopo mínimo, token cifrado com chave dedicada, webhook validado
  por token de canal com comparação em tempo constante, auditoria de toda
  mudança externa.

## Fluxos

### Conexão (OAuth)

1. `POST /integrations/google-calendar/connect` (capability
   `calendarConnections:manage`) devolve a URL de consentimento com `state`
   selado (AES-GCM, TTL de 10 min, nonce) contendo usuário, profissional e
   organização.
2. `GET /integrations/google-calendar/callback` (público, sem CSRF) abre o
   `state`, troca o `code`, exige `refresh_token`, valida que o escopo
   `calendar.events` foi de fato concedido (consentimento granular do Google),
   grava a conexão cifrada, cria o watch channel e redireciona para
   `FRONTEND_CALENDAR_SETTINGS_URL?status=connected|error&code=<ERRO>`.
3. `GET /connection` devolve status, e-mail, expiração do canal e contadores de
   jobs pendentes/dead-letter. `DELETE /connection?removeEvents=true|false`
   para o canal, revoga o token no Google, (opcionalmente) apaga eventos
   futuros e remove a conexão.
4. Administração: `GET /connections` lista as conexões visíveis ao usuário
   (todas as da organização para administradores; apenas a própria para os
   demais) e `DELETE /connections/:professionalId` encerra a conexão de outro
   profissional. Ambas passam pelo CASL — um colega sem papel de administrador
   recebe 404 ao tentar mexer na conexão alheia.

Desativar (`isActive: false`) ou arquivar um usuário desconecta a conta Google
dele automaticamente, com a mesma rotina de teardown (parar canal, revogar
token, limpar jobs e vínculos, auditar `GOOGLE_CALENDAR_DISCONNECTED`). Isso
impede que appointments continuem indo para a agenda pessoal de quem saiu da
clínica.

### Push (Allervia → Google)

`AppointmentsService.create/update` enfileira `PUSH_SYNC` dentro da própria
transação. O worker lê o estado atual do appointment (idempotente), compara o
`contentHash` com `lastSyncedHash` (supressão de eco) e então insere, altera ou
remove o evento. Sem conexão ou conexão `BROKEN`: o job conclui sem efeito.
`invalid_grant` marca a conexão como `BROKEN` (auditado) e interrompe novas
chamadas até reconexão. `CANCELLED`/`MISSED` removem o evento; `COMPLETED` não
mexe no evento.

### Pull (Google → Allervia)

`POST /integrations/google-calendar/webhook` (público, sem CSRF) valida o
`X-Goog-Channel-Token` contra o hash armazenado (`timingSafeEqual`), responde
200 sempre e apenas enfileira `PULL_INCREMENTAL` — nenhuma chamada ao Google no
request. O worker consome `events.list` com `syncToken` (410 GONE → limpa o
token e agenda `PULL_FULL_RESYNC`), ignora eventos sem
`allerviaAppointmentId` e aplica:

- **Mudança de horário**: aceita, com `revision++`, `updatedById` do usuário de
  sistema (`SYSTEM_USER_ID`) e auditoria `APPOINTMENT_UPDATED_FROM_GOOGLE`.
- **Evento apagado/cancelado no Google**: o appointment nunca é cancelado;
  o vínculo é desfeito e um `PUSH_SYNC` recria o evento (auditoria
  `GOOGLE_EVENT_RESTORED`).
- **Título ou descrição editados no Google**: o conteúdo canônico do Allervia
  é restaurado por um `PUSH_SYNC` (o `lastSyncedHash` é invalidado para forçar
  o patch).
- **Conflito (ambos os lados mudaram desde o último sync)**: o Allervia vence —
  o inbound é descartado e um `PUSH_SYNC` restaura o estado do Allervia no
  Google.

### Canal de notificações (watch)

Criado no callback; renovado pelo dispatcher quando `channelExpiresAt` está a
menos de 24 h (canal novo antes de parar o antigo); parado no disconnect. O
token do canal só existe em hash no banco.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | sim | Credenciais OAuth Web do projeto no Google Cloud (Calendar API habilitada). |
| `GOOGLE_OAUTH_REDIRECT_URL` | sim | URL pública de `GET /integrations/google-calendar/callback`, registrada no consent screen. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | sim | 32 bytes em base64; cifra refresh tokens e o `state` OAuth. Gerar com `openssl rand -base64 32`. |
| `GOOGLE_WEBHOOK_URL` | para o pull | URL HTTPS pública de `POST /integrations/google-calendar/webhook`. Sem ela o push funciona e o watch não é criado. |
| `FRONTEND_CALENDAR_SETTINGS_URL` | recomendada | Destino do redirect pós-callback (fallback: `APP_BASE_URL`). |
| `GOOGLE_OAUTH_STATE_TTL_MINUTES` | não (10) | Validade do `state` OAuth. |
| `SYSTEM_USER_ID` | para o pull | Ator das mudanças vindas do Google (já usado pelo provisionamento). |

Sem as variáveis obrigatórias o módulo sobe desativado: o dispatcher não inicia
e `POST /connect` responde 503 `GOOGLE_TOKEN_KEY_UNAVAILABLE`.

`ConfigService` lê o `.env` só na subida; mudar `GOOGLE_WEBHOOK_URL` exige
reiniciar o processo.

### Estabilidade do `GOOGLE_WEBHOOK_URL`

O canal de push é registrado com a URL vigente e dura até 7 dias. Se a URL
mudar, o canal antigo continua apontando para um host morto e o Google passa a
receber erro, sem que nada no Allervia quebre de forma visível — o pull
simplesmente para. Em desenvolvimento com túnel efêmero (ngrok gratuito), cada
reinício do túnel gera domínio novo; o procedimento é: atualizar
`GOOGLE_WEBHOOK_URL`, reiniciar o backend e zerar os canais das conexões
(`channelId`, `channelResourceId`, `channelExpiresAt`, `channelTokenHash`), que
`renewExpiring()` recria em até 5 minutos — ele já seleciona conexões com
`channelId: null`. Em homologação e produção a URL precisa ser um domínio
estável sob controle da equipe; não registramos domínio no Search Console
porque o Calendar aceitou o webhook sem verificação de domínio.

## Permissões

- Novo subject CASL `GoogleCalendarConnection`; capabilities
  `calendarConnections:read` e `calendarConnections:manage`.
- Médicos e enfermeiros gerenciam **apenas a própria** conexão
  (`professionalId` do usuário); administradores gerenciam qualquer conexão da
  própria organização (listar e encerrar).
- Médico acessa agendamento quando é o responsável pelo paciente **ou** quando o
  agendamento está na própria agenda (`professionalId`). A segunda condição é o
  que permite editar um agendamento criado por outra pessoa para a sua agenda.
- `POST /appointments` recarrega o registro recém-criado pelo filtro
  `accessibleBy(ability, 'create')` dentro da transação e devolve 403
  `APPOINTMENT_NOT_ACCESSIBLE` (desfazendo a inserção) quando o autor não
  conseguiria enxergar o que acabou de criar. Sem isso, um médico criava
  agendamento para paciente de outro médico e depois não conseguia ler nem
  editar — e o evento ia para a agenda Google errada.

## Impacto no cliente web (quebra de contrato)

`POST /appointments` passou a exigir `professionalId`. O cliente em
`allervia-web` ainda não envia esse campo — `src/shared/api/clinical.api.ts`
(assinatura de `createAppointment`) e
`src/features/scheduling/components/AppointmentModals.tsx` (montagem do
payload) —, então criar agendamento pela interface falha com
`APPOINTMENT_PROFESSIONAL_REQUIRED` até que o campo seja adicionado, junto de
um seletor de profissional no formulário (há o hook
`src/shared/hooks/useProfessionalDirectory.ts` para popular). O teste
`test/navigation/appointments.test.tsx` usa stub de `fetch` e continua
passando, portanto não cobre essa quebra.

Para a tela de conexão, as capabilities `calendarConnections:read` e
`calendarConnections:manage` chegam ao frontend em `GET /account/me`
(`capabilities`), e precisam ser mapeadas em `PERMISSION_CAPABILITIES`
(`src/shared/stores/useUserStore.ts`).

## Verificação em desenvolvimento

1. Projeto no Google Cloud Console com a Calendar API habilitada, consent
   screen em modo testing com o e-mail do profissional como test user e
   credencial OAuth Web com o redirect URI local.
2. `npx prisma migrate dev` (aplica `appointment_professional_link` e
   `google_calendar_integration`).
3. Conectar via `POST /connect` + navegador; conferir evento criado ao agendar,
   alterado ao reagendar e removido ao cancelar.
4. Para o pull, expor o webhook com túnel HTTPS (ex.: `cloudflared tunnel`) e
   definir `GOOGLE_WEBHOOK_URL`; arrastar o evento no Google e conferir o
   appointment atualizado com auditoria de sistema.
5. Testes: `npm run test:unit` e
   `npx jest --config jest.integration.config.ts src/integrations --runInBand`
   (fake do client; sem rede).
