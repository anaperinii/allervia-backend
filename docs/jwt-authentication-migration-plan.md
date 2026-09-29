> **Histórico:** a autenticação web foi substituída por sessão opaca. Consulte [a implementação atual](opaque-session-implementation.md). Este documento registra a arquitetura JWT anterior.

# Allervia — migração da autenticação web para JWT

> Decisão atual (27/09/2026): opção B, com verificação central em toda requisição autenticada e remoção do caminho legado. A comparação e o plano abaixo são histórico da escolha anterior. Consulte [a implementação atual](jwt-authentication-implementation.md) para o comportamento vigente.

Data: 26/09/2026. Atualização: opção A escolhida pelo usuário e implementada no backend e frontend. Este arquivo preserva o desenho e os trade-offs; o estado técnico entregue está em [jwt-authentication-implementation.md](jwt-authentication-implementation.md).

## 1. Objetivo e decisão adotada

Usar access tokens JWT de curta duração para validar requisições comuns localmente, sem buscar AuthSession e recarregar todo o contexto do usuário a cada chamada. Manter autorização por recurso/organização, MFA, expiração, logout, dispositivos, reautenticação, auditoria e proteção contra abuso.

Alternativas avaliadas; opção A aprovada pelo usuário:

- **A — recomendação proposta:** access token de no máximo 5 minutos, refresh token rotativo/revogável e verificações atuais adicionais nas ações sensíveis. Uma credencial de acesso já emitida pode continuar válida em rotas comuns até expirar, mesmo após revogação do refresh.
- **B — revogação central em cada chamada:** validação criptográfica mais consulta de revogação/versão em armazenamento compartilhado. Mantém controle mais imediato, mas deixa de eliminar a consulta central de autenticação. Redis não significa ausência de estado.

A implementação adota TTL de até cinco minutos e tolerância de relógio zero. Revogação não desfaz operações já autorizadas/em andamento.

**Guardar refresh tokens revogáveis continua sendo manter estado de autenticação.** A mudança proposta retira esse estado do caminho de validação de cada pedido comum; não promete eliminar qualquer persistência de login. Se a exigência for zero estado de autenticação, este desenho não atende: seria preciso aceitar reautenticação frequente e limites de revogação mais fortes.

## Trade-offs das opções A e B

Esta comparação foi solicitada antes da escolha. A opção A foi posteriormente confirmada.

| Critério | A: JWT curto com revogação na renovação | B: JWT com consulta central por requisição |
|---|---|---|
| Requisição comum | Assinatura e claims verificadas localmente, sem lookup de sessão | Assinatura verificada e estado de revogação/versão consultado |
| Logout de um dispositivo | Revoga refresh e encerra interface; cópia do access continua utilizável até expirar nas rotas comuns | Revoga família; novas validações rejeitam access vinculado a ela |
| Bloqueio de usuário | Interrompe renovação; access anterior conserva janela residual nas rotas sem checagem atual | Pode bloquear próximas validações se o estado da conta/versão estiver incluído na consulta |
| Mudança de papéis | Claims antigas podem valer até expiração; ações sensíveis recebem checagem adicional | Invalidar versão de autorização impede uso de claims antigas; refresh obtém permissões atuais |
| Inatividade | Expiração do JWT deve respeitar prazo da família na emissão; controle fino consulta família em eventos específicos | Pode ser conferida centralmente em toda requisição, distinguindo polling de interação |
| Custo | Menos consultas de autenticação; mantém banco em login/refresh e verificações sensíveis | Consulta compartilhada adicional por pedido; otimização depende de benchmark |
| Escala horizontal | Verificadores independentes com chaves públicas confiáveis | Instâncias precisam alcançar um estado compartilhado consistente |
| Falha do controle de autenticação | Tokens já emitidos continuam verificáveis até expirar; refresh falha | Rotas protegidas precisam falhar sem liberar acesso, geralmente 503 |
| Complexidade específica | Refresh, várias abas e política de janela residual | Os mesmos itens mais sincronização, armazenamento e disponibilidade de revogação |
| Dado clínico | Leituras comuns podem continuar após bloqueio por até o restante do TTL | Reduz essa janela às próximas validações após commit/propagação |
| Benefício sobre sessão opaca | Redução real da dependência de lookup em chamadas comuns | Principalmente interoperabilidade de token; não elimina estado/lookup central |

### Exemplo de risco aceito em A

Token emitido às 10:00 com expiração às 10:05. Às 10:01 o administrador bloqueia o usuário. A família não renova mais. Mesmo assim, uma cópia do access token pode continuar acessando as rotas comuns até 10:05. A interface esconder dados ou apagar seu token não invalida uma cópia externa.

Não é uma falha inesperada do JWT: é a consequência de validar sem perguntar se a decisão mudou. Na proposta A, escritas clínicas e ações classificadas como sensíveis verificam estado atual; isso limita o risco, mas não deve esconder a continuidade temporária das leituras comuns. Classificar toda leitura como sensível aproxima A de B e reduz seu benefício de consulta.

### Condições para a promessa de B

JWT sozinho mais uma tabela de IDs revogados não garante todas as propriedades da coluna B. Logout por dispositivo exige estado da família; bloqueio de conta exige estado/versão do usuário; mudança de organização e papéis precisa invalidar versão/contexto correspondente. Definir escopos e escritas atômicas antes de implementar.

Consultar Redis pode ser mais barato que carregar todo contexto pelo Prisma, mas só medição comprova o ganho. Um cache local de 30 segundos reintroduz até 30 segundos de atraso; réplica atrasada e propagação assíncrona também. Para rejeição na próxima validação após commit, usar fonte consistente e evitar cache obsoleto. Falha de sincronização PostgreSQL/Redis precisa bloquear ou usar fonte autoritativa, nunca validar silenciosamente com estado antigo.

### Custos comuns que não desaparecem

Ambas exigem controle de refresh, CSRF nos endpoints autenticados por cookie, prevenção de XSS, rotação de chaves, validação estrita de JWT, MFA, autorização por recurso, auditoria e idempotência de comandos. Ambas continuam dependentes do banco para operações clínicas. Nem A nem B desfazem operação que já passou pela autorização antes do bloqueio.

### Critério para decidir

- Escolher A se o objetivo principal for retirar lookup do caminho comum e houver aceitação explícita de poucos minutos de acesso residual, inclusive para leituras clínicas classificadas como comuns.
- Escolher B se bloquear acesso na próxima validação for requisito prioritário e for aceitável manter lookup e dependência operacional. JWT ainda pode ajudar integrações, mas não é automaticamente melhor que sessão opaca para esse requisito.
- Para o Allervia, a proposta A é condicionada à aceitação dessa janela; não é uma afirmação de segurança superior. Se essa janela for inaceitável, B é a escolha coerente e deve ser comparada também ao custo de corrigir a sessão atual.

## 2. Referências e limites da recomendação

A OWASP não recomenda trocar sessões por JWT indiscriminadamente. Sua orientação ressalta que invalidar JWTs exige mecanismos adicionais e pode reintroduzir estado. A preferência por JWT aqui é uma decisão do projeto, não uma exigência da OWASP. [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html).

Validação deve fixar algoritmos e chaves confiáveis, conferir emissor/audiência e impedir confusão entre tipos de token. [RFC 8725 — JWT Best Current Practices](https://www.rfc-editor.org/info/rfc8725/).

Refresh tokens de clientes públicos em OAuth precisam de rotação ou vinculação criptográfica ao cliente para detectar reutilização. Aplicaremos os princípios pertinentes, sem chamar um login próprio por senha de servidor OAuth completo. [RFC 9700 — OAuth Security BCP](https://www.rfc-editor.org/info/rfc9700/).

As durações, endpoints, models, decisões de UX e fases abaixo são propostas específicas para o Allervia. Nenhuma escolha isolada comprova conformidade integral ou certificação OWASP.

## 3. Estado atual verificado

- Sessão web: cookie opaco, AuthSession no PostgreSQL, validação de conta/organização/papéis/MFA carregada pelo repositório.
- JWT legado: JwtStrategy consulta tokenVersion; SessionAuthGuard recarrega contexto. Portanto, ativar o bearer existente na web não entrega o objetivo proposto.
- CurrentSession, SessionService e operações diretas sobre authSession estão acoplados a senha, recuperação, MFA, acesso de membros e dispositivos.
- O guard atual registra atividade em toda chamada autenticada; polling pode renovar inatividade. A leitura de sessão rotaciona CSRF, com risco de conflito entre abas.
- Há alterações locais extensas em ambos os repositórios. Antes de implementação, registrar baseline/diffs e trabalhar sobre o estado atual, sem reset, checkout destrutivo ou sobrescrita de mudanças.

## 4. Contrato de credenciais

### Access token

- JWT assinado, proposta inicial RS256, algoritmo único permitido explicitamente. Confirmar compatibilidade das versões instaladas antes de adotar outra biblioteca.
- Chave privada fora do código, frontend, banco e logs; secret manager ou arquivo privado de ambiente. Chaves separadas por ambiente.
- `kid` seleciona exclusivamente uma chave pública de um conjunto confiável configurado. Nunca buscar URL indicada pelo token (`jku`, `x5u`) ou aceitar chave arbitrária enviada em header.
- Rotação: publicar nova chave pública, mudar emissor para a nova privada, manter verificação da antiga pelo máximo de vida dos tokens e tolerância, então removê-la. Procedimento emergencial separado para comprometimento.
- Claims mínimos: `iss`, `aud`, `sub`, `iat`, `nbf`, `exp`, `jti`; identificador da família de autenticação, organização, identificador profissional quando necessário, tipo da conta e capacidades/papéis estritamente necessários.
- Metadados de autenticação: instante real de autenticação e métodos utilizados (`auth_time`, `amr`), quando necessários ao contrato. Um refresh não representa nova prova de senha/MFA.
- Tipo explícito e validação distinta do JWT legado e de qualquer token de outra finalidade. Não aceitar refresh, desafio MFA ou ID token como credencial de API.
- Validar presença, tipo e limites de claims, validade máxima, assinatura, emissor, audiência e relógio. Não usar decode como autenticação. Rejeitar algoritmo não permitido, `none`, emissor/audiência ausentes ou diferentes e `kid` desconhecido.
- Não incluir nome, email, CPF, dados de paciente, prontuário, segredo ou informação clínica. JWT assinado comum é legível; não é criptografado.
- Credencial enviada em `Authorization: Bearer`. Não aceitar por query string nem usar token bruto como identificador de log.

### Refresh token

- Segredo opaco aleatório de pelo menos 256 bits; não há benefício necessário em torná-lo JWT.
- Apenas hash persistido, com família, validade, uso e revogação. Token bruto entregue somente por cookie.
- Cookie `HttpOnly`, `Secure` em produção, sem Domain, prefixo `__Host-`, Path `/` exigido pelo prefixo e SameSite definido para a topologia atual de mesma origem. Só endpoints de autenticação interpretam esse cookie, embora o navegador possa enviá-lo às demais rotas.
- Não expor refresh token ao JavaScript, JSON, localStorage, sessionStorage, IndexedDB, URL ou logs.
- Renovar exige conta/organização ativas, família válida, política MFA atual, versão de autorização compatível e proteção CSRF/origem.
- Proposta inicial preserva teto absoluto atual de 8 horas e inatividade de 15 minutos, configuráveis com validação. Não introduzir “lembrar por 30 dias” implicitamente.

## 5. Persistência mínima necessária

Preferir models novos explícitos a apenas renomear AuthSession e manter o mesmo caminho de consulta.

| Model proposto | Conteúdo e finalidade |
|---|---|
| RefreshFamily | id, userId, organizationId, createdAt, absoluteExpiresAt, lastInteractiveAt, revokedAt/reason, authVersion observada, informações de MFA/reautenticação quando necessárias, metadados mínimos de dispositivo |
| RefreshToken | id, familyId, secretHash único, createdAt, expiresAt, consumedAt, substituição/sucessor e eventual revogação; permite detectar uso de token já consumido |

Definir FKs, índices de lookup por hash, família, usuário e validade. Uma cadeia não pode produzir dois sucessores para o mesmo token. Manter histórico consumido até terminar a janela em que replay precisa ser detectado; não apagar o hash anterior imediatamente ao rotacionar.

Manter User, MFA, códigos de recuperação, desafios curtos, AuthAttempt e auditoria conforme suas finalidades. O JWT não substitui esses registros. Retenção e limpeza são tarefas explícitas; timestamps não implementam TTL no PostgreSQL.

Na opção B, projetar ainda estado compartilhado de revogação por família/conta e sua consistência. Não adicionar Redis como dependência silenciosa sem provisionamento e política de falha.

## 6. Fluxos ponta a ponta

### Login e MFA

1. Validar entrada, origem e limites de tentativa antes do trabalho custoso.
2. Verificar senha e situação atual da conta/clínica.
3. Se MFA for exigido, emitir somente desafio de curta duração, sem access/refresh de uso clínico.
4. Consumir desafio e código de forma concorrente segura; recovery code continua de uso único.
5. Após autenticação completa, criar família e primeiro refresh em transação; emitir access token limitado aos prazos dessa família.
6. Resposta contém access token e validade, nunca refresh. Enviar `Cache-Control: no-store`; configurar cookie no servidor.

### Requisição comum

1. Frontend usa access token em memória.
2. Guard valida assinatura e claims sem consultar AuthSession, refresh ou versão de conta a cada chamada na opção A.
3. Construir contexto tipado a partir de claims verificadas; não aceitar organização/papel do corpo como identidade.
4. PoliciesGuard e consultas de recurso continuam impondo organização, vínculo e autorização. Reduzir consulta de autenticação não elimina consultas clínicas.
5. Claims de papel podem ficar antigas até expiração; não simular atualização instantânea na opção A.

### Renovação

1. POST dedicado recebe refresh por cookie e defesa CSRF/origem. Não é uma mutação acionável por GET.
2. Buscar hash e família, bloquear/atualizar condicionalmente dentro de transação, verificar estado e consumir somente se ainda não consumido.
3. Criar um único sucessor; dados de autorização do novo JWT vêm do banco atual, não de claims arbitrárias do access token anterior.
4. Confirmar transação antes de emitir resposta/cookie. Falha da assinatura ou infraestrutura deve ter recuperação definida sem gerar duas cadeias válidas.
5. Token comprovadamente reutilizado revoga a família e gera evento de segurança. Token aleatório desconhecido retorna erro genérico sem revogar outras contas por identificador fornecido pelo cliente.
6. Na primeira versão, se houve rotação mas a resposta se perdeu e o cookie novo não chegou, exigir novo login. Não criar uma janela irrestrita que aceite novamente o refresh consumido. Documentar esse custo de UX e testar perda de resposta.

### Várias abas e concorrência

- Uma renovação por vez dentro de cada aba; demais pedidos aguardam a mesma promessa.
- Coordenar entre abas com mecanismo de lock suportado e comunicação entre contextos da mesma origem; não depender só de um booleano por componente.
- Bloquear corrida refresh/logout com geração local de autenticação e estado transacional no servidor. Resposta antiga de refresh não pode restaurar interface após logout.
- Não gravar tokens em armazenamento persistente para “resolver” concorrência. Se compartilhar access token por canal entre abas, tratar como segredo efêmero e limitar à mesma origem.
- Sem suporte ao mecanismo de coordenação, usar fallback explícito e testado; não autorizar múltiplas rotações com base em grace period genérico.
- Sem coordenação, duas chamadas legítimas com o mesmo refresh são indistinguíveis de reutilização hostil no servidor. Esse problema é requisito da migração, não detalhe posterior.

### Recarga de página e retorno à aplicação

Access token em memória desaparece no reload. A aplicação obtém proteção CSRF para autenticação e tenta refresh uma vez. Sem credencial válida, apresenta login; falha transitória de rede produz estado recuperável, sem loop infinito ou falso diagnóstico de senha incorreta.

Defesa CSRF de refresh/logout deve funcionar com cookie HttpOnly e com abas. Utilizar token assinado/vinculado à família ou mecanismo equivalente revisado, sem invalidar todas as abas a cada leitura. Exigir origem permitida e JSON; CORS isolado não substitui CSRF. Não remover proteção dos endpoints de cookie só porque as rotas clínicas passaram a bearer.

### Logout, bloqueio e senha/MFA

- Logout revoga a família, limpa cookie e access token local, interrompe timers e limpa dados/cache em todas as abas.
- Logout-all, troca/reset de senha e alterações de MFA/acesso revogam famílias pertinentes com auditoria. Sempre que possível, na mesma transação da mudança de segurança.
- Falha de comunicação não pode ser apresentada como confirmação de revogação no servidor. Permitir limpar a tela local, mas comunicar encerramento não confirmado e bloquear renovação automática nessa interface.
- Opção A: access token copiado anteriormente pode continuar válido nas rotas comuns até expirar. Essa limitação deve constar dos testes e documentação.
- Opção B: consultar revogação compartilhada em cada chamada; indisponibilidade desse controle não pode liberar acesso silenciosamente.

### Inatividade e duração absoluta

Polling e refresh automático não contam como atividade humana. Registrar interação em endpoint específico, limitado em frequência, e só atualizar atividade de família ainda válida. Não reanimar família expirada.

Emitir `exp` limitado por: agora + TTL do access token, prazo absoluto e prazo de inatividade conhecido na emissão. Assim, refresh perto da expiração não estende inadvertidamente o acesso além do contrato. Mudanças posteriores de política seguem a janela de revogação escolhida.

Essa política detecta inatividade da interface normal, não prova presença humana contra cliente comprometido. Os prazos finais precisam ser consistentes também nos validadores e na tolerância de relógio.

### Ações sensíveis e autorização atual

Inventariar explicitamente: administração/retração de dose, prescrição e ciclo de terapia, exportação clínica, alteração de senha/MFA, permissões, acesso de membros e provisionamento.

Na opção A, aplicar verificação atual de conta, organização, permissões e família nessas operações antes do efeito, além da assinatura. Reautenticação recente é exigida nas ações de maior impacto conforme política existente, sem exigir senha a cada aplicação de rotina.

Uma claim dizendo “MFA realizado” não substitui a verificação de frescor exigida por uma ação. Tokens emitidos durante reautenticação não podem elevar privilégios de forma permanente nem renovar automaticamente o instante da autenticação original em cada refresh.

## 7. Contratos HTTP e frontend

Proposta de endpoints a confirmar com inventário de consumidores:

| Operação | Contrato proposto |
|---|---|
| Login | POST `/auth/login` ou endpoint novo de migração; resultado autenticado com accessToken/expiresIn ou desafio MFA explícito |
| MFA | POST `/auth/mfa/verify`; só após sucesso emite credenciais clínicas |
| Renovação | POST `/auth/refresh`, cookie HttpOnly + CSRF/origem |
| Contexto | GET `/auth/me` autenticado; não rotaciona refresh nem CSRF como efeito colateral |
| Logout | POST `/auth/logout`; funciona pelo refresh válido mesmo com access token expirado, com CSRF |
| Dispositivos | GET de famílias vigentes; DELETE direcionado apenas às próprias famílias autorizadas |
| Atividade | POST específico para interação real, com limitação de frequência |
| Reautenticação | POST dedicado, vinculado à família e à finalidade sensível |

Manter códigos distintos para access expirado, token inválido, refresh expirado/revogado/reutilizado, MFA exigido e autorização negada. Não devolver detalhes sensíveis ao atacante; diagnósticos ficam no log seguro.

- `client.ts`: enviar bearer somente ao backend confiável. Não aceitar URL arbitrária com credencial anexada; validar origem/destino.
- Renovar somente quando o erro indicar expiração do access, nunca para todo 401/403/429.
- Repetir no máximo uma vez após refresh bem-sucedido. Mutação só pode ser repetida automaticamente quando a rejeição ocorreu no guard antes do efeito ou com contrato idempotente comprovado. Falha de rede após envio não autoriza recriar a ação.
- Preservar requestId/chave idempotente e corpo de comandos clínicos ao repetir. Não gerar chave nova no retry.
- 429 respeita Retry-After; 503/rede preserva formulário e separa indisponibilidade de logout. Evitar ciclos de refresh disparados por seus próprios erros.
- JWT apenas em memória; refresh apenas em cookie. Não usar dados decodificados como autorização no frontend. A interface pode apresentar claims verificadas pelo servidor, mas o backend sempre decide.
- CSP, prevenção de XSS, dependências e origem confiável continuam necessárias. HttpOnly protege leitura do refresh, não impede um script malicioso de agir na origem ou roubar access token em memória.

## 8. Impacto concreto no código

- Novo serviço de emissão/validação de access tokens e registro de chaves; configuração tipada que falha na inicialização se inválida.
- Novo serviço/repositório de famílias e rotação transacional; migração Prisma aditiva primeiro.
- Substituir SessionAuthGuard no caminho web por guard JWT dedicado, com contexto de claims e guard/verificador de estado atual nas ações classificadas.
- Rever `CurrentSession`, `CurrentAuthContext` e `account.controller.ts`: não fabricar uma StoredSession a partir de JWT sem equivalência semântica.
- Atualizar login, MFA, recuperação de senha, senha autenticada, acesso de membros, logout e dispositivos que atualmente escrevem em AuthSession.
- Manter auditoria ligada a usuário, organização e identificador não secreto da família/jti quando útil, sem armazenar bearer.
- `SessionProvider`, `auth.api.ts`, `client.ts`, contratos, telas MFA e testes do allervia-web precisam migrar juntos.
- JWT legado tem validação/capacidades diferentes: não ampliar sua aceitação para contornar MFA ou servir de fallback quando JWT novo falha. Desativar/remover após mapear consumidores, sem aceitar credenciais ambiguamente.
- Revisar gateway: Authorization permitido, cookies corretos, TLS, no-store, redação de headers e trust proxy. Frontend não recebe chave privada em variável VITE.

## 9. Migração, rollback e operação

1. Inventariar e registrar alterações atuais de ambos os repositórios; branch sugerida `feat/jwt-authentication` quando iniciada implementação.
2. Adicionar modelos e serviços sem remover AuthSession de imediato.
3. Testar novo fluxo em ambiente isolado, com chaves de teste e SMTP desabilitado.
4. Escolher transição explícita: proposta é exigir novo login no corte, em vez de converter silenciosamente todas as sessões antigas. Proteger dados locais não salvos e comunicar o corte.
5. Publicar frontend/backend compatíveis e invalidar o acesso antigo deliberadamente. Cookies antigos não podem sobrepor JWT válido ou funcionar como bypass.
6. Observar latência, frequência de refresh, conflitos, reutilização, expiração e 401/403 por rota, sem tokens/PII nos labels.
7. Remover tabela/código antigos apenas após estabilização, inventário de dependências e retenção aplicável. Não reativar sessões antigas em rollback; novo login é mais seguro que ressuscitar credenciais revogadas.

Indisponibilidade de banco bloqueia emissão/refresh/ações com verificação atual. Na opção A, tokens ainda válidos podem autenticar rotas locais, mas recursos clínicos podem continuar indisponíveis por dependência do próprio banco. Não anunciar disponibilidade total decorrente de JWT.

Rotação de chaves, limpeza de refresh consumido, recuperação de incidentes, limites de tamanho de token, relógio sincronizado e métricas de consulta devem fazer parte do runbook.

## 10. Etapas com critérios de saída

| Etapa | Entrega | Critério |
|---|---|---|
| J0 | Decisão A/B, inventário completo, baseline e classificação de ações sensíveis | Política de revogação explícita; nenhuma rota/consumidor sem destino |
| J1 | Configuração, chaves e validação JWT estrita | Tokens inválidos rejeitados; teste demonstra zero consultas de sessão no caminho comum da opção A |
| J2 | Família, refresh e rotação | Concorrência e replay testados com banco real; sem dois sucessores |
| J3 | Login, MFA, senha, revogação, dispositivos e autorização | Sem bypass por token antigo; efeitos sensíveis consultam estado atual |
| J4 | Web: memória, refresh, abas, CSRF, retries e logout | Sem loops, tokens persistidos no browser ou mutações duplicadas |
| J5 | Integração, carga e falhas | Relatório com regressões, consultas e latência comparadas à baseline |
| J6 | Corte coordenado, operação e remoção posterior do legado | Rollback ensaiado sem reativar credenciais; documentação atualizada |

## 11. Testes obrigatórios

- Algoritmo none/não permitido, assinatura alterada, chave errada, kid desconhecido, emissor/audiência/tipo trocados, claims ausentes e formatos malformados.
- Token expirado, futuro, com validade excessiva e limites exatos de relógio, inatividade e expiração absoluta.
- JWT de outra finalidade ou ambiente rejeitado; segredo em URL/log nunca aceito como credencial.
- Login sem MFA completo não acessa clínica; código MFA/recovery não é reutilizado sob concorrência.
- Refresh simultâneo, uso de token antigo, família revogada, conta/organização desativada e alteração de papéis.
- Reutilização comprovada invalida a família; valor aleatório não revoga outra conta.
- Queda antes/depois do commit e antes/depois de Set-Cookie; comportamento de novo login em resposta perdida é demonstrado.
- Reload, duas abas renovando, logout concorrente com refresh, aba antiga voltando do repouso e expiração com formulário preenchido.
- CSRF/origem/CORS: site externo não consegue renovar ou encerrar acesso em nome do usuário; permissões corretas para dev/gateway.
- Leitura comum na opção A não consulta AuthSession/refresh/tokenVersion; ações sensíveis aplicam verificação atual explicitamente.
- Logout e bloqueio seguem exatamente a janela escolhida; teste não afirma revogação imediata para token autocontido sem consulta.
- Retry preserva comando idempotente e nunca duplica aplicação clínica; 403/429/rede não inicia loops.
- Rotação normal/emergencial de chave, ausência de chave na inicialização, banco indisponível e logs sem segredos.
- Build/lint/tipos, suítes de autenticação/autorização/contrato e fluxos clínicos reais preservados.

Conclusão depende de evidências desses testes, não apenas da emissão bem-sucedida de um JWT.
