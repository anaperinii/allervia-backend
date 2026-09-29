# Allervia — explicação de cada campo do schema Prisma

> Atualização da autenticação em 29/09/2026: `AuthSession` e `User.authSessions` foram reintroduzidos para a sessão opaca. A definição atual e seu fluxo estão em [opaque-session-implementation.md](opaque-session-implementation.md). `RefreshFamily` e `RefreshToken` permanecem apenas para transição, sem autenticar requisições. A contagem e a descrição abaixo são históricas e não devem ser usadas como inventário do schema atual.

Leitura do código em 24/09/2026. Base: `prisma/schema.prisma`, migrations versionadas e serviços do backend. Este documento explica o estado encontrado; não altera o banco e não comprova que todas as migrations foram aplicadas em um ambiente específico.

O schema tem 31 models. A documentação segue sua ordem e cobre campos persistidos, relações, enums, índices e diferenças entre intenção e garantia efetiva.

## Como ler o schema

Um `model` representa uma entidade persistida. `String`, `Int`, `Float`, `Decimal`, `Boolean`, `DateTime`, `Json` e listas de escalares descrevem valores armazenados. Campos cujo tipo é outro model descrevem relações.

Por exemplo, `patientId` é a coluna que guarda a referência. `patient` permite navegar até o paciente pelo Prisma. `Patient.immunotherapies` permite fazer o caminho inverso: não existe uma coluna contendo uma lista de tratamentos dentro do paciente. Diferentemente disso, `reportedSideEffects String[]` é uma lista de textos efetivamente armazenada. [Referência de relações do Prisma](https://docs.prisma.io/docs/orm/v7/prisma-schema/data-model/relations).

| Notação | Significado no projeto |
|---|---|
| `@id` | Chave primária: identifica o registro de maneira única. |
| `@default(ulid())` | Gera identificador textual ULID no caminho de criação pelo Prisma. As migrations criam esses IDs como `TEXT` sem gerador SQL; inserção SQL direta precisa informar o ID. ID não substitui permissão de acesso. |
| `?` | Valor/relação pode estar ausente. Ausência não significa zero, string vazia ou falso. |
| `@unique` | Não permite repetir o valor informado. Em campos opcionais deste PostgreSQL, pode haver vários registros com `NULL`. |
| `@@unique([...])` | Proíbe repetir a combinação dos campos, não cada campo isoladamente. |
| `@@id([...])` | Chave primária composta: a identidade é a combinação. |
| `@@index([...])` | Estrutura para auxiliar consultas. Não proíbe duplicação nem aplica regra de negócio. |
| `@default(now())` | Preenche o instante inicial quando omitido. |
| `@updatedAt` | Prisma atualiza o instante ao modificar o registro; não é, por si só, um trigger para qualquer SQL externo. |
| `@relation(fields: [...], references: [...])` | Associa a referência persistida à chave do outro model. Relações nomeadas desambiguam vários vínculos entre os mesmos models. |
| `@db.Decimal(65, 30)` | Número decimal com até 65 algarismos no total e até 30 após a vírgula. Evita imprecisão binária de `Float`; não estabelece sozinho a precisão clínica permitida. |
| `@db.Uuid` | Armazenamento UUID nativo. Não gera o valor automaticamente sem um default. |

Os mecanismos `ulid()` e `@updatedAt` estão documentados na [referência do schema Prisma](https://docs.prisma.io/docs/orm/reference/prisma-schema-reference). As finalidades clínicas descritas abaixo vêm do código do Allervia.

`DateTime` representa data/hora; as migrations inspecionadas usam `TIMESTAMP(3)`. O nome de um campo não transforma esse tipo em data civil nem armazena um fuso junto do valor. O backend precisa normalizar instantes e usar o fuso pertinente nos cálculos. Isso merece cuidado especial com nascimento e agenda.

O `generator client` com `provider = "prisma-client-js"` configura geração do cliente usado pelo backend. O `datasource db` com `provider = "postgresql"` escolhe PostgreSQL. Não são tabelas nem campos de pacientes. A URL está em `prisma.config.ts`, lida de `DATABASE_URL`; a credencial não fica no schema. `SHADOW_DATABASE_URL` configura, quando necessário, o banco descartável usado para calcular migrations.

Os campos de autoria respondem quem criou, alterou ou arquivou; `updatedAt` não guarda o histórico completo. O histórico detalhado depende de `AuditLog` e dos registros clínicos específicos. `revision` também não é um contador de doses: em registros mutáveis, serve para detectar edição concorrente quando o serviço compara e incrementa esse valor.

## Organization

Representa a clínica/organização e delimita dados e configurações. A presença de `organizationId` nas tabelas não implementa isolamento automaticamente: consultas e autorização precisam respeitá-lo.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador estável da clínica, usado pelos vínculos e pelo contexto de acesso. |
| `name` | Nome exibido. É único globalmente no schema atual; isso é uma restrição efetiva, não mera apresentação. |
| `taxId` | Documento fiscal da organização, único. Evita dois cadastros com o mesmo valor; normalização/validação dependem da aplicação. |
| `isActive` | Permite desativar a organização sem apagar profissionais e histórico. Começa verdadeiro. |
| `createdAt` | Instante de criação do cadastro. |
| `updatedAt` | Última alteração registrada pelo Prisma. |
| `professionals` | Relação inversa dos profissionais vinculados à clínica. |
| `patients` | Relação inversa dos pacientes atendidos nessa organização. |
| `professionalInvites` | Convites de onboarding dessa organização. |
| `auditLogs` | Ações auditadas no contexto da clínica. |
| `treatmentProtocols` | Catálogo de protocolos pertencente à clínica. |
| `protocolDefaults` | Versões escolhidas como padrão por via de administração. |
| `appointments` | Compromissos de agenda da clínica. |
| `automationEnabled` | Habilitação organizacional da automação. Começa falsa para exigir configuração/ativação consciente; não reescreve prescrições já fixadas. |
| `timeZone` | Fuso usado para interpretar calendário clínico; padrão `America/Sao_Paulo`. Evita tratar “daqui a sete dias” sem contexto de calendário. |

`name` e `taxId` possuem unicidade separada. Duas clínicas distintas com o mesmo nome são impedidas pelo desenho atual, mesmo com documentos diferentes.

## ProfessionalRole

Representa uma concessão de permissão, com início, eventual revogação e responsáveis. Uma linha não é apenas “o papel atual”; também preserva uma concessão passada.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica a concessão individual. |
| `professionalId` | Profissional que recebeu o papel. |
| `professional` | Navegação ao titular; relação chamada `RoleHolder`. |
| `role` | Papel concedido, por exemplo médico ou administrador. Orienta autorização. |
| `grantedAt` | Quando o papel foi concedido. |
| `grantedById` | Profissional responsável pela concessão. |
| `grantedBy` | Navegação ao concedente, distinta do titular. |
| `revokedAt` | Quando deixou de valer; ausente enquanto não revogado. |
| `revokedById` | Quem revogou; opcional porque a concessão pode continuar ativa. |
| `revokedBy` | Relação ao profissional que executou a revogação. |

Índices por `(professionalId, role)`, `grantedById` e `revokedById` auxiliam consulta de permissões e autoria. Não há unicidade de papel ativo neste model: os índices não impedem duas concessões ativas iguais. Essa consistência precisa ser assegurada pelo fluxo e sua concorrência.

## Professional

Separa identidade profissional e vínculo institucional das credenciais de login. Profissão e papel não são sinônimos: um médico pode também administrar a clínica.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador do profissional, diferente do ID da conta. |
| `userId` | Conta utilizada por esse profissional. Único: a mesma conta não pode ter dois registros Professional neste schema. |
| `user` | Navegação às credenciais/status da conta. |
| `organizationId` | Clínica à qual o profissional está vinculado. |
| `organization` | Navegação à organização. |
| `fullName` | Nome profissional exibido em cadastro e autoria clínica. |
| `phoneNumber` | Contato telefônico. Texto preserva formatação/código de área sem tratá-lo como quantidade. |
| `profession` | Categoria profissional, distinta das permissões concedidas. |
| `councilNumber` | Registro no conselho quando aplicável; recepcionista, por exemplo, pode não possuir. |
| `councilUf` | Unidade federativa do registro profissional. Opcional junto ao contexto de conselho. |
| `createdAt` | Instante de cadastro do perfil profissional. |
| `updatedAt` | Última modificação do perfil. |
| `professionalRoles` | Papéis recebidos. |
| `professionalRolesGranted` | Papéis que este profissional concedeu a outros ou a si conforme o fluxo permitido. |
| `professionalRolesRevoked` | Revogações pelas quais foi responsável. |
| `patientsResponsible` | Pacientes para os quais foi indicado como médico responsável. |
| `internalUserInvites` | Convites associados ao profissional cadastrado. |

Índice `(organizationId, profession)` auxilia listas por clínica e profissão. O schema atual modela um vínculo profissional por conta, não uma lista de vínculos multi-clínica. Ser referenciado como médico responsável não verifica, sozinho, se a profissão é PHYSICIAN.

## Patient

Representa o cadastro clínico. Pode existir sem conta de acesso: a equipe consegue atender alguém que nunca entrou na web.

| Campo | Motivo e uso |
|---|---|
| `id` | Identidade do cadastro clínico. |
| `userId` | Conta opcional do paciente. Única quando informada, para não vincular uma conta a dois cadastros Patient. |
| `user` | Navegação à conta, quando houver. |
| `organizationId` | Clínica proprietária do cadastro. |
| `organization` | Relação à clínica. |
| `responsiblePhysicianId` | Profissional responsável pelo acompanhamento; necessário para responsabilidade e encaminhamentos. |
| `responsiblePhysician` | Navegação ao responsável. |
| `fullName` | Nome do paciente. |
| `birthDate` | Data de nascimento para idade/contexto clínico. Embora seja conceito de data civil, o tipo atual é DateTime. |
| `weightInKg` | Peso cadastrado em quilogramas. É um valor atual, não uma série histórica de pesagens. |
| `phoneNumber` | Telefone de contato. |
| `cpf` | Identificação documental opcional, normalizada em dígitos pela aplicação. Ausência representa documento desconhecido/legado, sem inventar número. |
| `isActive` | Indica cadastro operacionalmente ativo. |
| `isArchived` | Separa arquivamento lógico de mera inativação, preservando dados vinculados. |
| `createdAt` | Quando foi cadastrado. |
| `createdById` | Conta que cadastrou o paciente. |
| `createdBy` | Relação à conta autora. |
| `updatedAt` | Quando foi alterado pela última vez. |
| `updatedById` | Conta responsável pela última alteração. |
| `updatedBy` | Relação ao último editor. |
| `archivedAt` | Instante de arquivamento; ausente antes dele. |
| `archivedById` | Conta que arquivou. |
| `archivedBy` | Navegação ao responsável pelo arquivamento. |
| `immunotherapies` | Tratamentos associados ao paciente. |
| `appointments` | Compromissos de agenda do paciente. |

`@@unique([organizationId, cpf])` impede CPF repetido na mesma clínica quando preenchido, mas permite o mesmo CPF em clínicas diferentes e vários CPFs ausentes. Índices por clínica/status/arquivo, responsável e nome ajudam a localizar cadastros. Um índice simples em nome não garante bom desempenho de qualquer pesquisa textual, como busca por trecho ignorando acentos.

O comentário “documento protegido” não significa criptografia do CPF no banco: o campo é String. Controle de exposição e acesso está na aplicação.

## User

É a conta de acesso. Mantém credenciais, estado de autorização e autoria. Não precisa concentrar os dados profissionais ou clínicos que pertencem a outros models.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica a conta em sessões, permissões derivadas e registros de autoria. |
| `email` | Identificador de login e contato, único globalmente. Normalização de caixa/espaços é responsabilidade do fluxo. |
| `password` | Armazena o hash da senha gerado pelo serviço de hashing, não a senha legível. O tipo String não impõe isso sozinho. |
| `type` | Distingue conta profissional de conta de paciente. Não representa o papel ADMINISTRATOR/PHYSICIAN. |
| `isActive` | Permite bloquear acesso sem remover a conta. |
| `isArchived` | Marca arquivamento lógico e mantém referências históricas. |
| `tokenVersion` | Versão de autorização. Incrementá-la permite invalidar credenciais emitidas antes da mudança; usada também pela sessão opaca. |
| `createdAt` | Instante de criação da conta. |
| `createdById` | Conta criadora, opcional para fluxos iniciais/provisionamento sem autor previamente existente. |
| `createdBy` | Autorrelacionamento: aponta para outro User. |
| `updatedAt` | Última alteração da conta. |
| `updatedById` | Conta responsável pela última edição, quando conhecida. |
| `updatedBy` | Navegação ao editor. |
| `professional` | Perfil profissional opcional ligado à conta. |
| `patient` | Perfil de paciente opcional ligado à conta. |
| `patientsCreated` | Cadastros de pacientes criados por esta conta. |
| `patientsUpdated` | Pacientes que atualmente a apontam como último editor, não todas as edições históricas. |
| `patientsArchived` | Pacientes arquivados por esta conta. |
| `immunotherapiesCreated` | Terapias cadastradas pela conta. |
| `immunotherapiesUpdated` | Terapias que a apontam como último editor. |
| `immunotherapiesArchived` | Terapias arquivadas por ela. |
| `doses` | Doses executadas pelo profissional desta conta (`AdministeredBy`). O registrador é identificado no audit log. |
| `dosesCreated` | Doses/previsões criadas pela conta. |
| `dosesUpdated` | Doses que a apontam como último editor. |
| `dosesArchived` | Doses arquivadas por ela. |
| `invitesCreated` | Convites emitidos pela conta. |
| `lifecycleEventsCreated` | Suspensões, retomadas ou conclusões de terapia registradas por ela. |
| `addendaCreated` | Observações tardias adicionadas por ela. |
| `appointmentsCreated` | Compromissos cadastrados pela conta. |
| `appointmentsUpdated` | Compromissos em que é o último editor. |
| `notifications` | Notificações internas destinadas à conta. |
| `notificationPreferences` | Preferências de recebimento por tipo de notificação. |
| `supportRequests` | Solicitações de suporte abertas pela conta. |
| `auditLogs` | Ações atribuídas à conta na trilha de auditoria. |
| `usersCreated` | Outras contas que a apontam como criadora. |
| `usersUpdated` | Contas que a apontam como último editor. |
| `verificationTokens` | Tokens de operações como recuperação de senha. |
| `authSessions` | Sessões de navegador vinculadas à conta. |
| `mfaCredentials` | Fatores de autenticação cadastrados. |
| `mfaRecoveryCodes` | Códigos de recuperação do segundo fator. |
| `preAuthChallenges` | Desafios temporários pendentes ou já consumidos. |

Índice `(type, isActive, isArchived)` auxilia filtragem de contas. O schema não impõe uma restrição XOR entre `professional` e `patient`: `type` e os perfis precisam ser mantidos coerentes pelo serviço. As dezenas de listas acima são navegações, não dezenas de arrays gravados na tabela User.

## VerificationToken

Representa autorização temporária para uma operação específica. Não é sessão de login.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica a emissão do token. |
| `userId` | Conta à qual a autorização pertence. |
| `user` | Navegação à conta. |
| `purpose` | Separa recuperação de senha de mudança de email; um token não deve valer para qualquer finalidade. |
| `tokenHash` | Hash do segredo enviado ao usuário, para validar sem persistir o segredo. É opcional no schema, mas o fluxo de reset inspecionado o preenche. |
| `newEmail` | Destino pretendido em mudança de email; não substitui o email atual antes da confirmação. É opcional porque reset não precisa dele. |
| `expiresAt` | Limite de validade. A aplicação precisa consultá-lo; a linha não some automaticamente. |
| `consumedAt` | Registra uso, impedindo reutilização quando a atualização é feita atomicamente. |
| `createdAt` | Instante de emissão, também utilizado nas cotas atuais de emissão de reset. |
| `updatedAt` | Última alteração, por exemplo consumo. |

Índice `(userId, purpose)` ajuda a consultar emissões por conta e finalidade. `tokenHash` não é único nem possui índice próprio neste schema. `EMAIL_CHANGE` e `newEmail` modelam uma possibilidade; sua presença não comprova um fluxo público completo de troca de email. Na leitura feita, o uso confirmado é recuperação de senha.

Correção do diagnóstico anterior de rate limit: `PasswordResetRequestUseCase` já contém supressão de emissão por conta (1/minuto, 3/15 minutos e 5/hora), mantendo resposta genérica. Isso não equivale à proteção HTTP global e deve entrar no inventário R0 antes de qualquer substituição.

## Immunotherapy

Representa o tratamento longitudinal de um paciente, e não uma única aplicação. A terapia conserva identidade mesmo quando a prescrição muda por revisão clínica.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador permanente da terapia. |
| `patientId` | Paciente submetido ao tratamento. |
| `patient` | Relação ao paciente; também permite obter a organização. |
| `immunoType` | Classificação textual do tratamento. É String, não uma enumeração de tipos imposta pelo banco. |
| `administrationRoute` | Via de administração: subcutânea ou sublingual no schema. |
| `extract` | Identificação textual do extrato prescrito. Não é referência a um catálogo normalizado de medicamentos. |
| `inductionStartDate` | Marco de início da fase de indução registrado para a terapia. |
| `maintenanceStartDate` | Marco de entrada em manutenção, ausente antes disso. No fluxo configurado, pode ser preenchido pela administração de uma etapa de manutenção. |
| `targetConcentration` | Concentração-alvo na representação numérica compatível com o modelo anterior. Na automação subcutânea atual, concentração é denominador de diluição. Não assumir que este campo legado acompanha toda revisão posterior. |
| `targetVolume` | Volume-alvo na representação Float mantida por compatibilidade. A revisão clínica inspecionada atualiza `targetVolumeExact` e a prescrição, não este Float. |
| `status` | Estado clínico atual: em andamento, suspensa ou concluída. Não substitui o motivo da transição. |
| `isArchived` | Arquivamento lógico independente do estado clínico. |
| `createdAt` | Instante do cadastro. |
| `createdById` | Conta responsável pelo cadastro. |
| `createdBy` | Navegação ao autor. |
| `updatedAt` | Última alteração da terapia. |
| `updatedById` | Conta responsável pela última alteração. |
| `updatedBy` | Navegação ao último editor. |
| `archivedAt` | Quando foi arquivada. |
| `archivedById` | Quem realizou o arquivamento. |
| `archivedBy` | Relação ao autor do arquivamento. |
| `doses` | Histórico de previsões e aplicações da terapia. |
| `prescriptions` | Todas as prescrições fixadas, incluindo revisões anteriores. |
| `currentPrescriptionId` | Aponta qual prescrição está vigente. Opcional para acomodar legado; único para não ser vigente de duas terapias. |
| `currentPrescription` | Navegação direta à prescrição vigente, evitando inferir vigência apenas pela data. |
| `lifecycleEvents` | Histórico dos motivos e efeitos de suspensão, retomada e conclusão. |
| `revision` | Versão de concorrência do agregado; impede sobrescrever alterações quando comparada no comando. Não conta aplicações. |
| `targetVolumeExact` | Volume-alvo decimal exato do fluxo configurado, evitando usar Float como autoridade clínica. Opcional no legado. |

Índices `(patientId, status, isArchived)` e `administrationRoute` apoiam listas clínicas. Relação à prescrição vigente garante existência e unicidade, mas não comprova sozinha que ela pertence à mesma terapia; serviço e demais regras de integridade precisam preservar isso.

## TherapyLifecycleEvent

Mantém o fato clínico que explica uma mudança de status. Sem ele, seria possível saber que a terapia está suspensa, mas não por quem, por quê e com qual orientação.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador do evento. |
| `immunotherapyId` | Terapia afetada. |
| `immunotherapy` | Navegação ao tratamento. |
| `type` | Suspensão, retomada ou conclusão. |
| `category` | Classificação opcional do motivo para organização do registro. |
| `reason` | Justificativa textual obrigatória. |
| `expectedReturnAt` | Previsão de retorno/reavaliação após suspensão, quando informada; não é retomada automática. |
| `recommendations` | Orientações estruturadas, especialmente de encerramento; JSON precisa de validação na aplicação. |
| `archivedDoseIds` | IDs das previsões arquivadas pelo evento. Lista factual, não relação com FK individual por elemento. |
| `createdAt` | Instante em que a decisão foi registrada. |
| `createdById` | Conta que registrou a decisão. |
| `createdBy` | Navegação à autoria. |

Índice `(immunotherapyId, createdAt)` organiza a linha do tempo. O desenho é de histórico adicional; ausência de `updatedAt` não torna uma linha imutável por si só.

## DoseObservationAddendum

Registra uma observação tardia sem reescrever o que foi documentado na administração. Exemplo: reação comunicada horas depois.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o adendo. |
| `doseId` | Aplicação à qual se refere. |
| `dose` | Navegação à dose. |
| `reportedSideEffects` | Efeitos relatados nesse adendo; lista vazia por padrão. |
| `administeredMedications` | Medicamentos informados no contexto da observação; lista textual, não prontuário farmacológico estruturado. |
| `notes` | Complemento livre, opcional. |
| `observedAt` | Quando o fato foi observado, que pode ser anterior ao registro. |
| `conduct` | Conduta associada à observação, quando houver. |
| `conductJustification` | Motivo da conduta registrada. |
| `createdAt` | Quando o adendo entrou no sistema. Distingue ocorrência de documentação. |
| `createdById` | Conta autora do registro tardio. |
| `createdBy` | Relação à autoria. |

Índice `(doseId, observedAt)` permite ordenar o histórico por ocorrência. O comentário define intenção de imutabilidade; não existe uma anotação Prisma que, sozinha, proíba UPDATE ou DELETE.

## Appointment

É o compromisso de agenda. Uma falta ou cancelamento de compromisso não significa que uma dose foi administrada ou que a terapia foi encerrada.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o compromisso. |
| `organizationId` | Clínica cuja agenda está sendo ocupada. |
| `organization` | Navegação à clínica. |
| `patientId` | Paciente agendado. |
| `patient` | Navegação ao cadastro clínico. |
| `doseId` | Previsão clínica vinculada, se houver. Único: uma dose possui no máximo um Appointment associado no schema atual. |
| `dose` | Navegação à previsão/aplicação relacionada. |
| `title` | Título opcional de apresentação na agenda. |
| `startsAt` | Início do compromisso. |
| `endsAt` | Fim previsto; permite representar duração/ocupação. A ordem das datas depende de validação. |
| `status` | Agendado, concluído, cancelado ou falta. |
| `notes` | Observações do compromisso, distintas das observações clínicas da dose. |
| `statusReason` | Explicação de mudança de estado, como cancelamento. |
| `revision` | Controle de edição concorrente da agenda. |
| `createdAt` | Quando o agendamento foi registrado. |
| `createdById` | Conta que marcou o compromisso. |
| `createdBy` | Relação à conta criadora. |
| `updatedAt` | Última alteração do compromisso. |
| `updatedById` | Última conta editora. |
| `updatedBy` | Relação à conta editora. |

Índices por `(organizationId, startsAt)` e `(patientId, startsAt)` apoiam calendário da clínica e histórico do paciente. As FKs individuais não garantem que paciente, dose e organização sejam compatíveis entre si. A unicidade de `doseId` também vale para compromissos cancelados: reagendamento precisa respeitar esse desenho.

## Dose

Representa uma previsão ou um registro de administração. Guarda tanto o que estava planejado quanto o que efetivamente aconteceu, além do vínculo com a prescrição vigente naquele contexto.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador da dose/previsão. |
| `immunotherapyId` | Terapia à qual pertence. |
| `immunotherapy` | Relação ao tratamento. |
| `administeredById` | Conta do profissional que executou a aplicação. Quem registrou é identificado por AuditLog.userId. Ausente enquanto não administrada. |
| `administeredBy` | Navegação à conta do executor da aplicação. |
| `concentration` | Concentração em representação Int do modelo compatível. O contexto/unidade precisa vir do protocolo, não apenas do número. |
| `volume` | Volume em representação Float compatível; não deve substituir os valores exatos no fluxo configurado. |
| `scheduledAt` | Data/hora prevista clinicamente. Não equivale a uma confirmação de comparecimento. |
| `administeredAt` | Instante inicial real da aplicação, quando registrada. |
| `nextIntervalInDays` | Intervalo previsto a partir dessa etapa para orientar a próxima dose. Não conta quantas doses já ocorreram. |
| `betweenDosesReport` | Relato do período entre aplicações. É obrigatório como texto, mas a criação de previsão utiliza string vazia. |
| `administrationEndedAt` | Fim real da aplicação; separa duração clínica da duração do compromisso de agenda. |
| `immediateConduct` | Conduta imediata tomada no atendimento: manter, solicitar avaliação ou suspender. |
| `immediateConductJustification` | Fundamentação da conduta. Sua obrigatoriedade condicional depende do serviço. |
| `status` | Prevista, administrada no prazo, administrada fora do prazo ou registrada por engano. |
| `isArchived` | Retira logicamente uma previsão/registro do conjunto ativo sem apagar sua existência. |
| `createdAt` | Instante de criação da dose/previsão. |
| `createdById` | Conta responsável pela criação. |
| `createdBy` | Navegação ao autor. |
| `updatedAt` | Última alteração permitida. |
| `updatedById` | Conta responsável pela alteração. |
| `updatedBy` | Navegação ao editor. |
| `archivedAt` | Instante de arquivamento. |
| `archivedById` | Conta responsável pelo arquivamento. |
| `archivedBy` | Navegação ao autor do arquivamento. |
| `prescriptionId` | Prescrição que fundamenta a dose. Opcional para legado; permite interpretar aplicações antigas mesmo após revisão. |
| `prescription` | Navegação ao snapshot da prescrição. |
| `plannedStepId` | ID estável da etapa prevista dentro da definição do protocolo. Não é ordinal da sessão nem FK para uma tabela Step. |
| `administeredStepId` | Etapa efetivamente reconhecida na administração. Pode diferir da prevista se a alteração for válida no contexto prescrito. |
| `plannedValues` | Valores planejados em JSON, com concentração, volume, intervalo, fase, via e unidades. Preserva o contexto da previsão. |
| `administeredValues` | Valores efetivamente registrados, separados dos planejados para não reescrever a intenção original. |
| `plannedVolumeExact` | Volume previsto em decimal exato. |
| `administeredVolumeExact` | Volume aplicado em decimal exato. |
| `sourceDoseId` | Dose de origem que gerou esta sucessora. Único para impedir duas sucessoras apontando para a mesma origem. |
| `sourceDose` | Navegação à dose anterior na cadeia. |
| `successor` | Navegação inversa à dose que tem esta como origem. |
| `recommendation` | Resultado do motor: próxima etapa sugerida, fim da sequência ou impossibilidade de resolver. Explica a recomendação feita naquele momento. |
| `revision` | Controle de concorrência para edição/aplicação/correção, não número de sessão. |
| `observations` | Observações estruturadas pré e pós-administração registradas no atendimento. |
| `observationAddenda` | Complementos tardios com autoria/data próprias. |
| `appointment` | Compromisso de agenda opcional relacionado. |

Índices por `(immunotherapyId, scheduledAt)`, `(concentration, volume)`, `administeredById` e `scheduledAt` apoiam cronologia, consultas por valores, autoria e agenda clínica. A combinação concentração/volume **não é única** e não determina uma etapa sozinha.

Aqui está a ligação com a regra que você pediu: reconhecer o valor e a etapa configurada, em vez de avançar por “quarta aplicação”. Se a etapa prevista for C e a aplicação for editada legitimamente para B, o registro conserva `plannedStepId = C` e `administeredStepId = B`; o motor considera a etapa B efetivamente aplicada. O próximo passo vem da configuração (`nextStepId`), não de um contador fixo.

O label é o nome legível da etapa; a identidade técnica é seu `id`. Quando duas etapas compartilham valores, contexto e seleção explícita evitam adivinhar. Repetir uma etapa configurada pode ser válido; isso não significa aceitar qualquer valor fora da prescrição.

As migrations acrescentam regras que não aparecem como atributos neste model: uma única previsão configurada ativa por terapia; volumes exatos positivos; compatibilidade dose/prescrição/terapia; proteção de dose configurada já administrada. Essas regras não devem ser inferidas só pela lista de campos.

## DoseObservation

Representa observação inicial do atendimento, distinguindo antes e depois da aplicação.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador da observação. |
| `doseId` | Dose observada. |
| `dose` | Navegação à dose. |
| `phase` | Indica observação pré ou pós-administração. |
| `reportedSideEffects` | Lista de efeitos/relações relatadas no contexto da fase. |
| `administeredMedications` | Lista textual de medicamentos informados. |
| `notes` | Observação livre complementar. |
| `createdAt` | Instante de criação do registro. |
| `updatedAt` | Última alteração registrada. |

`@@unique([doseId, phase])` permite no máximo uma observação de cada fase por dose. Novos relatos tardios têm model próprio (`DoseObservationAddendum`) para não serem confundidos com a documentação inicial. Este model não tem autor próprio; a autoria do atendimento deve ser interpretada junto à dose e à auditoria.

## OutboxEvent

Registra uma consequência a processar depois do fato clínico, no mesmo commit do fato de origem. Assim, a aplicação não depende de conseguir entregar uma notificação durante a transação clínica.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o evento de saída, inclusive em reprocessamentos. |
| `organizationId` | Contexto institucional do evento. É String sem relação Organization declarada neste model. |
| `kind` | Tipo de notificação que o fato deve produzir. |
| `payload` | Dados necessários ao consumidor; atualmente inclui terapia, paciente, nome, motivo e profissional destinatário resolvido na origem, com dose opcional. |
| `createdAt` | Instante de produção do evento. |
| `processedAt` | Quando foi processado. Ausente significa ainda não finalizado, mas pode haver falha esgotada. |
| `attempts` | Contador de falhas/tentativas para interromper repetição infinita. No consumidor atual, só é incrementado no catch de falha. |
| `lastError` | Último erro de processamento para diagnóstico. Não é um campo destinado a dados clínicos extras ou segredos. |
| `notifications` | Notificações internas materializadas a partir desse evento. |

Índices `(processedAt, createdAt)` e `(organizationId, createdAt)` ajudam fila e acompanhamento. `processedAt` não prova que alguém recebeu email, leu ou sequer ganhou notificação: o consumidor atual também conclui eventos com destinatário inativo/ausente ou preferência desabilitada.

Este é o outbox de notificações clínicas internas. O envio de demonstrações usa estado próprio em DemoRequest; não presumir que existe uma única fila universal para todos os emails.

## Notification

É o item que aparece para um destinatário na interface. O evento de origem e a notificação são separados porque o processamento pode ser repetido e um evento pode ter materializações por destinatário.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o item para marcar leitura e navegar. |
| `organizationId` | Escopo institucional usado nos filtros de acesso; sem relação Organization declarada aqui. |
| `userId` | Conta destinatária. |
| `user` | Navegação ao destinatário. |
| `outboxEventId` | Evento que originou o item. |
| `outboxEvent` | Relação ao evento, permitindo rastrear origem. |
| `kind` | Tipo funcional para apresentação e preferências. |
| `title` | Título pronto para exibição. |
| `body` | Texto da notificação materializada; pode conter informação clínica e exige controle de acesso. |
| `entityType` | Tipo do recurso associado, por exemplo Immunotherapy. |
| `entityId` | Identificador do recurso para navegação. É referência genérica, não FK validada para todo tipo de entidade. |
| `readAt` | Instante da marcação de leitura; ausente significa não lida. Não é comprovante de ciência clínica. |
| `createdAt` | Instante de criação do item, que pode ser posterior ao evento de origem. |

Unicidade `(outboxEventId, userId)` evita duplicação para o mesmo destinatário em reprocessamento. Índices `(userId, readAt, createdAt)` e `(organizationId, createdAt)` suportam caixa de notificações, não lidas e paginação.

## NotificationPreference

Representa a escolha de recebimento por usuário e tipo. Não existe configuração por canal/email neste model.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador da preferência persistida. |
| `userId` | Dono da preferência. |
| `user` | Relação ao usuário. |
| `kind` | Tipo de notificação a que a escolha se aplica. |
| `enabled` | Se deve receber aquele tipo; padrão verdadeiro. |
| `updatedAt` | Última alteração da escolha. |

Unicidade `(userId, kind)` permite uma configuração por combinação. A ausência de linha é interpretada pelo serviço como habilitada; isso é regra de aplicação, diferente do default de uma linha existente.

## DemoRequest

É a solicitação do formulário de demonstração e também o registro durável do trabalho de email. Persistir ambos na mesma linha elimina o intervalo em que o pedido poderia ser salvo e o agendamento do email ser perdido.

| Campo | Motivo e uso |
|---|---|
| `id` | Protocolo interno do pedido; identifica o atendimento e o envio associado. |
| `requestId` | UUID enviado pelo frontend para idempotência. Repetir a mesma ação após falha de rede devolve o pedido original quando o payload coincide. É único. |
| `name` | Nome informado pelo interessado. |
| `lastName` | Sobrenome, separado porque o formulário captura dessa maneira. |
| `email` | Contato do interessado. Não é automaticamente o destinatário interno do email de aviso. |
| `phone` | Telefone para retorno comercial. |
| `role` | Perfil profissional/comercial informado. É String validada pelo DTO, não concede papel de segurança. |
| `solution` | Cenário de uso desejado, como uso individual, clínica ou rede. Ajuda a contextualizar a demonstração. |
| `specialty` | Especialidade/área de atuação informada. |
| `professionals` | Número de profissionais interessados/abrangidos. Dimensiona a demanda, não cria contas. |
| `sourceHash` | Hash do IP de origem usado na cota de aceitação. Evita persistir IP legível aqui, mas hash simples não equivale a anonimização irreversível. |
| `createdAt` | Quando a solicitação foi recebida; serve também às janelas de cotas. |
| `emailAttempts` | Quantas tentativas de envio foram assumidas pelo dispatcher. Começa em zero. |
| `emailNextAttemptAt` | Quando pode tentar novamente. Começa no instante atual; nulo interrompe seleção automática após sucesso ou esgotamento. |
| `emailLeaseUntil` | Reserva temporária de processamento. Outro worker aguarda até expirar para reduzir envio concorrente do mesmo pedido. |
| `emailAcceptedAt` | Quando o transporte SMTP aceitou o email. Não confirma entrega na caixa de entrada, leitura ou ausência de bounce posterior. |
| `emailErrorCode` | Código resumido de falha, sem copiar credenciais ou diagnóstico SMTP sensível para a linha. |

O email interno de destino fica em `DEMO_REQUEST_EMAIL_TO`, fora do schema. Não é preciso repetir essa configuração em cada solicitação no desenho atual; isso também significa que uma mudança de configuração pode afetar pedidos ainda pendentes.

Índices `(emailNextAttemptAt, emailLeaseUntil)`, `(sourceHash, createdAt)`, `(email, createdAt)` e `createdAt` atendem seleção de jobs, cota por IP, cota por email e cota total. A migration também exige `professionals` entre 1 e 9999.

O lease e a idempotência não tornam o SMTP “exatamente uma vez”: uma queda depois de o provedor aceitar e antes da gravação de `emailAcceptedAt` ainda pode provocar reenvio. O objetivo é entrega recuperável, com duplicação reduzida e rastreável.

## ContactRequest

Representa contato público genérico, diferente do formulário especializado de demonstração.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador do contato. |
| `name` | Nome do remetente. |
| `email` | Endereço para resposta. |
| `organization` | Nome livre da organização do interessado; não é relação com Organization nem prova vínculo institucional. |
| `message` | Conteúdo da solicitação. |
| `status` | Recebida ou tratada, começando em RECEIVED. Modelar o estado não comprova uma tela/endpoint de tratamento implementado. |
| `createdAt` | Quando o contato entrou. |

Índice `(status, createdAt)` apoia a fila de atendimento. O model não registra tentativas de email, responsável pelo tratamento ou instante de conclusão.

## SupportRequest

Representa suporte solicitado por usuário autenticado. Guarda contexto suficiente para associar o pedido à clínica e à conta.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador da solicitação. |
| `organizationId` | Clínica de origem; campo de escopo sem relação Organization declarada neste model. |
| `userId` | Conta autora. |
| `user` | Navegação ao solicitante. |
| `subject` | Resumo do problema para triagem. |
| `message` | Descrição detalhada. |
| `status` | Recebida ou tratada. Não modela conversa, prioridade ou SLA. |
| `createdAt` | Quando foi aberto o pedido. |

Índice `(organizationId, createdAt)` apoia histórico por clínica. Persistência de suporte não é, por si só, confirmação de email enviado.

## AuditLog

Registra quem fez qual ação sobre qual recurso. Complementa o estado atual das tabelas e os eventos clínicos específicos.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador do evento de auditoria. |
| `userId` | Conta autora da ação. |
| `user` | Navegação ao autor. |
| `organizationId` | Clínica na qual a ação ocorreu. |
| `organization` | Navegação à clínica. |
| `entityType` | Categoria do recurso alterado, como Patient ou Dose. |
| `entityId` | ID do recurso. É referência genérica, não FK para todas as tabelas possíveis. |
| `action` | Nome da ação auditada. String permite vocabulário centralizado no código sem enum SQL. |
| `oldValues` | Valores anteriores selecionados para auditoria, quando aplicável. Não precisa ser cópia integral da linha. |
| `newValues` | Valores posteriores selecionados. Deve excluir segredos e respeitar a política de dados auditáveis. |
| `changedFields` | Nomes dos campos modificados, para localizar rapidamente a mudança. |
| `sessionId` | Correlação opcional com sessão. Não é o segredo do cookie; não há relação AuthSession declarada aqui. |
| `timestamp` | Instante do evento auditado. |

Índices por entidade/ID/tempo, usuário/tempo, organização/tempo e tempo apoiam investigação. Uma migration adiciona triggers que bloqueiam UPDATE/DELETE de AuditLog; essa proteção vem do SQL, não do nome da tabela. Não é, por si só, uma prova criptográfica contra administrador do banco.

## InternalUserInvite

Controla convite de entrada na organização: destino, papel pretendido, validade e uso. O convidado ainda pode não ter perfil profissional quando o convite nasce.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador administrativo do convite. |
| `token` | Segredo único usado no link de aceite. Está persistido como token, diferentemente dos campos tokenHash dos outros fluxos. |
| `organizationId` | Clínica que está convidando. |
| `organization` | Navegação à clínica. |
| `professionalId` | Profissional associado, preenchido quando o fluxo estabelece esse vínculo; pode estar ausente antes do registro. |
| `professional` | Navegação ao profissional associado. |
| `email` | Destinatário esperado do convite. |
| `fullName` | Nome informado para o futuro integrante. |
| `role` | Papel a conceder no ingresso; não é profissão. |
| `expiresAt` | Prazo de validade do link. Não muda automaticamente `isActive` ao vencer. |
| `usedAt` | Instante do aceite/uso. Distingue usado de cancelado. |
| `isActive` | Habilitação administrativa do convite. Uso/cancelamento o desativam, mas com fatos diferentes em `usedAt`. |
| `createdAt` | Quando foi emitido. |
| `createdById` | Conta que convidou. |
| `createdBy` | Navegação ao autor do convite. |
| `updatedAt` | Última alteração de estado/vínculo. |

Índices por organização/atividade, expiração e profissional apoiam listas e validação.

**Atenção à unicidade atual:** `(email, organizationId, isActive)` permite no máximo uma linha ativa **e uma inativa** por email/clínica. Não significa “qualquer quantidade de convites antigos e somente um ativo”. Para esse segundo objetivo seria necessária outra restrição, como índice único parcial. Esse é um limite real da modelagem atual e merece revisão própria.

## TreatmentProtocol

É a identidade do protocolo no catálogo da clínica. Separar protocolo de suas versões permite alterar a configuração futura sem substituir o histórico prescrito.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador estável do protocolo ao longo das versões. |
| `organizationId` | Clínica proprietária. |
| `organization` | Relação à organização. |
| `name` | Nome reconhecível pela equipe. Não é único neste model. |
| `route` | Via à qual o protocolo se destina. |
| `available` | Disponibilidade no catálogo; retirar da oferta não apaga versões usadas no passado. |
| `createdById` | Conta autora. Não tem campo relacional no Prisma, mas a migration cria FK para User. |
| `createdAt` | Instante de criação do protocolo. |
| `versions` | Configurações versionadas desse protocolo. |

`@@unique([id, organizationId])` parece redundante porque `id` já é único, mas viabiliza referências compostas que também conferem a organização. Índice `(organizationId, route)` apoia escolha de catálogo por via.

## ProtocolVersion

É uma configuração concreta do protocolo. Rascunho pode ser editado; publicação fixa conteúdo para que prescrições antigas não mudem silenciosamente.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica essa configuração específica, não apenas a família de protocolo. |
| `protocolId` | Protocolo ao qual a versão pertence. |
| `organizationId` | Escopo redundante intencional para a FK composta conferir a clínica. |
| `protocol` | Relação ao catálogo por protocolo e organização conjuntamente. |
| `number` | Número legível da versão dentro do protocolo, como 1 ou 2. |
| `status` | DRAFT, PUBLISHED ou RETIRED; governa edição e disponibilidade de uso novo. |
| `definition` | JSON com etapas, valores, labels, unidades, fases e ligações de progressão. É onde a automação deixa de depender de uma sequência fixa no código. |
| `schemaVersion` | Versão do formato desse JSON, para saber como validá-lo e interpretá-lo. Não é a versão clínica do protocolo. |
| `engineVersion` | Identifica a versão do motor compatível com a definição. O campo sozinho não mantém executáveis antigos instalados. |
| `revision` | Contador de concorrência do registro, especialmente de edição/publicação de rascunho. Não substitui `number`. |
| `createdById` | Autor da versão. A migration cria FK User mesmo sem navegação declarada no Prisma. |
| `publishedById` | Autor da publicação, opcional enquanto rascunho. Não há relação User declarada no schema para este campo. |
| `createdAt` | Quando a versão foi criada. |
| `publishedAt` | Quando foi publicada. |
| `prescriptions` | Prescrições que adotaram esta versão. |
| `defaults` | Organizações/vias que a apontam como padrão; o vínculo composto restringe a organização correta. |

Unicidade `(protocolId, number)` impede duas versões com o mesmo número no mesmo protocolo. Unicidade `(id, organizationId)` permite vínculos compostos seguros. Migrations protegem conteúdo publicado e permitem aposentadoria controlada; alterar o default não migra prescrições existentes.

No contrato atual de `clinical-rules/protocol-definition.ts`, cada etapa inclui:

| Propriedade do JSON | Por que existe |
|---|---|
| `id` | Identidade técnica estável dentro da definição. |
| `label` | Nome legível para a equipe selecionar/reconhecer a etapa. |
| `phase` | BUILD_UP ou MAINTENANCE; define o contexto clínico da etapa. |
| `concentration` | Valor decimal textual da concentração no padrão de unidade declarado. |
| `volume` | Valor decimal textual para não depender de aritmética binária de Float. |
| `intervalDays` | Intervalo da etapa utilizado para previsão. |
| `nextStepId` | Próxima etapa explicitamente configurada, ou fim da sequência quando nulo. |

O contrato publicado também carrega `protocolId`, `versionId`, `version`, `status`, `route`, `schemaVersion`, `engineVersion`, `volumeUnit`, `concentrationUnit` e `steps`. Eles situam os valores. O código pode compor metadados a partir da linha persistida; não presumir que todo metadado é necessariamente duplicado literalmente em `definition`.

Há uma limitação relevante: o enum de via do banco admite SUBLINGUAL, mas o tipo de definição publicada do motor inspecionado aceita SUBCUTANEOUS, mL e denominador de diluição. Suporte no schema não comprova automação sublingual completa.

## OrganizationProtocolDefault

Resolve qual versão sugerir para novos tratamentos em determinada via. Evita escolher padrão por nome, primeiro registro ou data mais recente.

| Campo | Motivo e uso |
|---|---|
| `organizationId` | Clínica configurada. |
| `route` | Via para a qual o padrão vale. |
| `organization` | Navegação à organização. |
| `versionId` | Versão escolhida explicitamente. |
| `version` | Relação composta que exige versão da mesma organização. |

Chave primária `(organizationId, route)` permite no máximo um padrão por via em cada clínica, sem um ID artificial extra. Trigger exige versão publicada, protocolo disponível e via compatível. Nenhuma linha significa que não há padrão cadastrado; não é permissão para inventar um protocolo.

## ProtocolPrescription

Fixa o recorte do protocolo escolhido para uma terapia. É o vínculo clínico histórico: configuração da clínica pode evoluir, mas a prescrição continua apontando para a versão adotada.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador do snapshot individual da prescrição. |
| `immunotherapyId` | Terapia para a qual foi prescrita. |
| `immunotherapy` | Relação à terapia, no conjunto de todas as prescrições. |
| `organizationId` | Escopo institucional conferido com terapia e versão. |
| `versionId` | Versão exata do protocolo utilizada. |
| `version` | Navegação composta à versão na organização correta. |
| `resolved` | Recorte resolvido: protocolo/versão, via, etapas incluídas, etapa inicial, etapa-alvo; o fluxo persiste também o fuso. Não é simplesmente uma cópia de todos os dados do protocolo. |
| `revision` | Campo previsto para identificar a revisão do snapshot, com default 1. No serviço atual de revisão, a nova prescrição é criada sem informar incremento; portanto o campo não oferece hoje uma sequência confiável 1, 2, 3. A mudança histórica é identificada pelo novo ID e pelo ponteiro da terapia. |
| `revisionReason` | Justificativa quando substitui prescrição anterior; opcional na prescrição inicial. |
| `createdById` | Conta que fixou a prescrição. Possui FK SQL criada por migration, sem navegação correspondente neste model. |
| `createdAt` | Quando foi fixada. |
| `doses` | Doses fundamentadas nessa prescrição, preservando contexto histórico. |
| `currentOf` | Relação inversa à terapia que a aponta como vigente. Pode estar ausente em uma prescrição histórica. |

Índice `(immunotherapyId, createdAt)` auxilia histórico. Trigger impede alteração/exclusão do snapshot e verifica organização da terapia. A terapia pode ter várias prescrições; `currentPrescriptionId` escolhe a vigente. Versão do protocolo e revisão clínica de uma prescrição são conceitos distintos; a numeração desta última precisa de ajuste caso seja apresentada como sequencial ao usuário.

## RegistrationCommand

Guarda o resultado de um comando de cadastro idempotente. Existe para que duplo clique ou perda de resposta não crie duas terapias/prescrições.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador interno do registro de comando. |
| `organizationId` | Separa a chave por clínica. |
| `actorId` | Separa a chave pela conta que executou. Não é relação User declarada. |
| `key` | Chave idempotente estável gerada para a ação do cliente. |
| `requestHash` | Impressão do conteúdo normalizado para detectar reutilização da chave com dados diferentes. |
| `result` | Resposta original em JSON, devolvida em replay válido. |
| `createdAt` | Quando o comando foi registrado, útil também a uma futura política de retenção. |

Unicidade `(organizationId, actorId, key)` define o escopo de deduplicação. Ela não valida payload sozinha: o serviço compara `requestHash` e garante transação com o cadastro. O model não tem expiração automática.

## ClinicalCommand

Aplica a mesma ideia aos comandos sobre doses. Uma administração repetida por falha de rede não deve reaplicar o fato nem gerar outra sucessora.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o registro idempotente. |
| `organizationId` | Clínica em que a ação ocorre. |
| `actorId` | Conta autora; valor de escopo sem relação declarada. |
| `doseId` | Dose-alvo que delimita a deduplicação. É String sem relação Dose declarada aqui. |
| `key` | Chave da ação que deve permanecer igual nas tentativas de repetição. |
| `requestHash` | Detecta chave reutilizada com comando/conteúdo incompatível. |
| `result` | Resultado original para replay. |
| `createdAt` | Instante do comando persistido. |

Unicidade `(organizationId, actorId, doseId, key)` impede duplicação nesse escopo. A chave não substitui autorização, `revision` ou validação de negócio. Idempotência evita repetir a mesma ação; revisão impede que duas ações diferentes editem um estado desatualizado.

## AuthSession

É o estado de login do navegador. O cookie leva um segredo aleatório; no banco ficam seu hash e as condições de validade. Isso permite revogar um dispositivo sem depender só de expiração de token no cliente.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador administrativo da sessão. Pode ser usado na lista de dispositivos; não é o segredo que autentica. |
| `secretHash` | SHA-256 do segredo aleatório do cookie. Único, permite encontrar a sessão sem persistir a credencial em claro. |
| `csrfTokenHash` | Hash do token CSRF vinculado à sessão. Ajuda a exigir comprovação adicional em mutações quando o navegador envia cookie automaticamente. |
| `userId` | Conta autenticada. |
| `user` | Relação à conta e seu estado atual. |
| `authVersion` | Cópia da versão de autorização na criação, comparada à versão atual derivada de `User.tokenVersion`. Divergência invalida a sessão. |
| `createdAt` | Quando a sessão começou. |
| `expiresAt` | Término absoluto permitido, independentemente de atividade. |
| `lastInteractiveAt` | Última interação considerada relevante para timeout de inatividade. Não deve ser confundida com qualquer polling de fundo. |
| `mfaVerifiedAt` | Quando houve confirmação de segundo fator nesta sessão. |
| `reauthenticatedAt` | Última confirmação recente de identidade para operações sensíveis. Estar logado não basta para todas as ações. |
| `revokedAt` | Quando foi invalidada explicitamente ou por condição de expiração detectada. |
| `revokedReason` | Motivo estruturado da revogação para diagnóstico/dispositivos. |
| `userAgent` | Informação de navegador/dispositivo para apresentação. É dado fornecido pelo cliente, não prova de identidade. |
| `ipAddressHash` | Hash do IP associado; metadado reduzido, sem guardar o endereço legível neste campo. Não identifica uma pessoa com certeza. |

Índices `(userId, revokedAt)` e `expiresAt` ajudam listar sessões e localizar expiradas. As condições são complementares: `revokedAt = null` não basta para considerar a sessão válida. É necessário verificar expiração, inatividade, conta e versão.

Hash de segredo aleatório e hash de senha têm necessidades diferentes: os segredos de sessão são gerados com alta entropia; senhas humanas usam serviço de hashing apropriado. CSRF não é segundo fator nem limite de tráfego.

## MfaCredential

É um segundo fator TOTP cadastrado. O servidor precisa recuperar o segredo para verificar os códigos; por isso usa criptografia reversível autenticada, em vez de armazenar somente hash do segredo TOTP.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o fator para confirmação, uso e revogação. |
| `userId` | Conta proprietária. |
| `user` | Relação à conta. |
| `type` | Tipo de fator; atualmente apenas TOTP. |
| `label` | Nome legível do fator, ajudando a reconhecê-lo na interface. |
| `secretCiphertext` | Segredo TOTP cifrado; não é o código temporário de seis dígitos. |
| `secretIv` | Valor de inicialização aleatório utilizado na criptografia AES-GCM; necessário à abertura do ciphertext. |
| `secretAuthTag` | Tag de autenticação criptográfica que detecta alterações no material cifrado. |
| `keyVersion` | Identificação da versão da chave usada. Prepara rastreabilidade de rotação, mas não implementa rotação sozinho. |
| `confirmedAt` | Instante em que um código válido confirmou posse do fator; ausente durante enrollment incompleto. |
| `lastUsedAt` | Último uso aceito. |
| `lastUsedCounter` | Último contador temporal TOTP aceito. Impede reaproveitar um código da mesma janela quando a verificação/atualização é atômica. |
| `createdAt` | Quando começou o cadastro do fator. |
| `updatedAt` | Última atualização de confirmação/uso/revogação. |
| `revokedAt` | Quando o fator deixou de ser válido, preservando registro histórico. |

Índice `(userId, revokedAt)` ajuda localizar fatores vigentes. O serviço atual usa AES-256-GCM com chave externa `MFA_ENCRYPTION_KEY`; emite `keyVersion = 1` e lê uma chave configurada. Portanto, não existe evidência de um chaveiro multiversão completo só porque o campo existe. Uma rotação requer implementação e migração cuidadosas.

## MfaRecoveryCode

Representa um código alternativo de uso único para quem perdeu acesso ao autenticador. Não é a mesma coisa que redefinir a senha.

| Campo | Motivo e uso |
|---|---|
| `id` | Identificador interno do código. |
| `userId` | Conta proprietária. |
| `user` | Relação à conta. |
| `codeHash` | Hash único do código normalizado. O valor legível é exibido na emissão, sem precisar ser persistido. |
| `createdAt` | Quando foi emitido. |
| `consumedAt` | Quando foi usado; a atualização condicional é necessária para uso único sob concorrência. |

Índice `(userId, consumedAt)` auxilia localizar códigos ainda disponíveis. Não existe `expiresAt` neste model; validade depende de consumo e das regras de regeneração/revogação do fluxo.

## PreAuthChallenge

É uma autorização curta para concluir uma etapa de autenticação. Acertar a senha e receber esse desafio ainda não equivale a obter uma sessão com acesso clínico.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o desafio no servidor. |
| `secretHash` | Hash único do segredo temporário apresentado pelo cliente. |
| `userId` | Conta cuja autenticação está em andamento. |
| `user` | Navegação à conta. |
| `purpose` | Distingue verificação MFA, inscrição de fator e finalidade modelada de reautenticação. |
| `sessionId` | Vínculo opcional à sessão em desafio de reautenticação. É String sem FK/AuthSession declarada. |
| `credentialId` | Fator que está sendo confirmado no enrollment; não é relação Prisma com MfaCredential. |
| `attemptCount` | Tentativas feitas dentro desse desafio. É um contador de segurança, não contador clínico. |
| `expiresAt` | Prazo curto para concluí-lo. |
| `consumedAt` | Marca desafio finalizado/usado, impedindo criar novas sessões com o mesmo segredo quando o consumo é atômico. |
| `createdAt` | Instante de emissão. |

Índices `(userId, purpose)` e `expiresAt` ajudam consulta e manutenção. A enumeração prevê REAUTHENTICATION, mas o caso de uso atual de reautenticação inspecionado valida credenciais e marca a sessão diretamente; não concluir que todo valor possível já participa do mesmo fluxo de desafios.

## AuthAttempt

Registra tentativas de autenticação para limitar abuso por identificador e operação. Não conta todas as requisições HTTP da aplicação.

| Campo | Motivo e uso |
|---|---|
| `id` | Identifica o evento de tentativa persistido. |
| `identifierHash` | Hash do identificador com escopo, como conta/email ou IP, para agrupar tentativas sem armazenar o valor legível aqui. |
| `scope` | Indica se a tentativa está sendo contada por conta ou IP. É String; o código restringe os valores usados. |
| `operation` | Família de autenticação: login, verificação MFA ou reautenticação no serviço atual. Separa os orçamentos existentes. |
| `succeeded` | Diferencia sucesso de falha. O limiter atual conta falhas; sucesso não significa apagar tentativas anteriores. |
| `occurredAt` | Quando aconteceu; determina participação na janela de limitação. |

Índice `(identifierHash, operation, occurredAt)` atende a contagem por operação e tempo; índice `occurredAt` pode apoiar limpeza por retenção. Não há TTL automático no PostgreSQL por ter essa coluna. Um login pode gerar dois registros, um para conta e outro para IP; duas linhas não significam necessariamente duas requisições humanas.

O hash atual de identificadores é SHA-256 simples. Ele reduz exposição direta, mas identificadores previsíveis ainda podem ser testados por quem tiver acesso aos hashes. O HMAC proposto no plano de rate limiting é uma evolução planejada, não algo já implementado neste campo.

## Todos os enums e por que existem

Enums delimitam valores possíveis; não executam transições nem verificam permissões sozinhos.

| Enum | Valores e significado |
|---|---|
| `AdministrationRoute` | `SUBCUTANEOUS`: subcutânea; `SUBLINGUAL`: sublingual. Descreve via, não garante motor implementado para ambas. |
| `UserType` | `PROFESSIONAL`: conta de equipe; `PATIENT`: conta de paciente. |
| `Role` | `ADMINISTRATOR`: administração; `RECEPTIONIST`: recepção; `PHYSICIAN`: médico; `NURSE`: enfermagem. São papéis de autorização. |
| `Professiondos` | `PHYSICIAN`, `NURSE`, `NURSING_TECHNICIAN`, `RECEPTIONIST`: profissão declarada; técnico de enfermagem existe aqui sem um Role homônimo. |
| `VerificationPurpose` | `PASSWORD_RESET`: redefinir senha; `EMAIL_CHANGE`: finalidade modelada para confirmar mudança de endereço. |
| `TherapyStatus` | `IN_PROGRESS`: tratamento em andamento; `SUSPENDED`: temporariamente suspenso; `COMPLETED`: encerrado/concluído. |
| `DoseStatus` | `SCHEDULED`: previsão; `ADMINISTERED_ON_SCHEDULE`: aplicada no prazo; `ADMINISTERED_OFF_SCHEDULE`: aplicada fora do prazo; `ENTERED_IN_ERROR`: registro sinalizado como lançado por engano, sem apagar seus valores históricos. |
| `DoseObservationPhase` | `PRE_ADMINISTRATION`: antes; `POST_ADMINISTRATION`: depois da aplicação. |
| `DoseImmediateConduct` | `MAINTAIN`: manter conduta; `REQUEST_PHYSICIAN_REVIEW`: solicitar revisão médica; `SUSPEND_TREATMENT`: suspender. Efeitos concretos dependem do comando clínico. |
| `LifecycleEventType` | `SUSPENSION`, `RESUMPTION`, `COMPLETION`: fatos de suspender, retomar e concluir terapia. |
| `AppointmentStatus` | `SCHEDULED`, `COMPLETED`, `CANCELLED`, `MISSED`: agenda marcada, concluída, cancelada ou falta. |
| `NotificationKind` | `PHYSICIAN_REVIEW_REQUESTED` e `TREATMENT_SUSPENDED`: eventos clínicos atualmente modelados para notificação. |
| `ContactRequestStatus` | `RECEIVED` e `HANDLED`: solicitação recebida ou tratada. |
| `ProtocolVersionStatus` | `DRAFT`: editável; `PUBLISHED`: conteúdo fixado para uso; `RETIRED`: retirado de adoção nova, preservado historicamente. |
| `MfaFactorType` | `TOTP`: código temporário baseado em segredo e tempo. Não há enum de SMS, email ou passkey neste model. |
| `PreAuthPurpose` | `MFA_CHALLENGE`, `MFA_ENROLLMENT`, `REAUTHENTICATION`: finalidade do desafio temporário. |
| `AuthSessionRevokeReason` | `LOGOUT`: saída desta sessão; `LOGOUT_ALL`: saída geral; `DEVICE_REVOKED`: revogação individual; `PASSWORD_CHANGED`: senha alterada; `ACCOUNT_DISABLED`: conta desativada; `MFA_CHANGED`: segundo fator alterado; `IDLE_TIMEOUT`: inatividade; `ABSOLUTE_TIMEOUT`: duração máxima; `SUPERSEDED`: sessão substituída. Existência do valor não comprova que cada caminho já o emite. |

## O que merece atenção na interpretação e evolução

1. **Planejado e aplicado precisam coexistir.** Apagar `plannedValues` ao editar a administração destruiria evidência da mudança. Os campos não são duplicação acidental.
2. **Protocolo, versão e prescrição têm ciclos diferentes.** Editar catálogo futuro não modifica automaticamente tratamentos ativos. A revisão clínica cria novo snapshot e move a prescrição vigente.
3. **Existem diferentes números de versão.** `ProtocolVersion.number` identifica edição do protocolo; `schemaVersion` identifica formato; `engineVersion` identifica interpretador; `ProtocolPrescription.revision` foi previsto para revisão prescrita, mas não é incrementado no fluxo atual inspecionado; `Dose.revision` detecta concorrência; `User.tokenVersion` invalida credenciais.
4. **IDs terminados em Id nem sempre são FKs.** Campos genéricos de auditoria/comando, referências dentro de JSON e algumas referências de segurança não possuem relações declaradas. Por outro lado, três `createdById` de protocolos têm FKs adicionais em migrations SQL.
5. **A segurança não vem de nomes de campos.** CPF String não é cifrado; password String não força hash; segredo de convite está no campo token. Regras de serviço, seleção de resposta e migrations precisam ser consideradas.
6. **Flags não formam uma máquina de estados automática.** `isArchived`, `archivedAt` e `archivedById` precisam ser alterados coerentemente. O mesmo vale para `revokedAt`/motivo e timestamps de publicação/consumo.
7. **Legado explica parte dos campos opcionais e paralelos.** Floats/Ints convivem com valores exatos e snapshots para migrar com segurança. Remover a representação antiga exige inventário dos consumidores e plano de migração, não só apagar colunas parecidas.
8. **Persistência não significa entrega.** Outbox processado é diferente de email aceito; email aceito é diferente de entregue/lido. Os nomes dos campos devem ser respeitados nas mensagens ao usuário.
9. **Não há isolamento organizacional automático generalizado.** Algumas FKs compostas conferem organização; outras ligações dependem da aplicação. Não foi feita nesta leitura uma auditoria do banco em execução nem de políticas RLS.
10. **A modelagem tem limites reais.** Um Professional por User restringe vínculos multi-clínica; um Appointment por Dose restringe múltiplos compromissos; unicidade do convite limita histórico inativo. Explicar a motivação não significa declarar essas escolhas perfeitas para qualquer evolução.

## Regras SQL que complementam o arquivo Prisma

As migrations versionadas incluem proteção de AuditLog contra alteração/exclusão, imutabilidade de conteúdo publicado, imutabilidade de snapshots de prescrição, conferência de organização na prescrição, compatibilidade de dose configurada, padrão publicado/disponível da via correta, unicidade parcial de previsão configurada ativa e positividade de volumes exatos.

A migration de ciclo de vida permite a transição dedicada de uma dose configurada administrada para ENTERED_IN_ERROR mantendo os valores aplicados. A condição inspecionada olha o status anterior de administração; não se deve generalizar daí que qualquer estado histórico está protegido contra todo SQL arbitrário. Adendos e eventos também não ficam automaticamente imutáveis apenas pelo comentário no schema.

Por isso, reconstruir o banco exclusivamente com `db push` a partir deste arquivo não é equivalente a aplicar todo o histórico de migrations. Esta explicação considera o SQL versionado, sem afirmar que o ambiente de produção já o aplicou.

## Exemplo integrado

Uma clínica é criada em Organization. Uma conta User recebe perfil Professional, com profissão médica e um ProfessionalRole que lhe concede atuação como médico. Um Patient é cadastrado mesmo sem login próprio.

A clínica publica um TreatmentProtocol com uma ProtocolVersion e escolhe seu OrganizationProtocolDefault. Ao iniciar a Immunotherapy do paciente, o serviço fixa uma ProtocolPrescription e cria uma Dose prevista. A agenda pode associar um Appointment a ela.

Na aplicação, a conta do executor vai para administeredById; a conta registradora vai para AuditLog.userId. Valores previstos permanecem separados dos aplicados. Se a equipe escolher outra etapa válida, o motor reconhece essa etapa configurada e registra a recomendação correspondente. Uma revisão clínica posterior cria outra prescrição sem mudar a base histórica das doses anteriores.

Uma reação tardia produz DoseObservationAddendum; uma suspensão produz TherapyLifecycleEvent e muda o estado da terapia. Um OutboxEvent pode gerar uma Notification para o responsável. AuditLog registra as ações auditadas. AuthSession e os mecanismos de MFA controlam quem pode executar esses comandos; RegistrationCommand e ClinicalCommand ajudam a impedir duplicação em repetição de requisições.

## Fontes locais consultadas

- `prisma/schema.prisma` e `prisma.config.ts`.
- `prisma/migrations/20260917010000_configurable_protocols/migration.sql`.
- `prisma/migrations/20260917020000_protocol_integrity_guards/migration.sql`.
- `prisma/migrations/20260921120000_clinical_lifecycle/migration.sql`.
- Migrations de auditoria, notificações, autenticação, CPF, idempotência e demonstrações.
- `src/treatment-protocols/allergen-immunotherapy/clinical-rules/protocol-definition.ts`.
- `src/treatment-protocols/allergen-immunotherapy/dosing/configured-dose.service.ts`.
- Serviços de cadastro/revisão de prescrição, notificações e solicitações públicas.
- Serviços de recuperação de senha, sessões, criptografia e repositório de autenticação.

As observações sobre limitações são achados de leitura do código, não alterações implementadas nem uma revisão de segurança exaustiva.
