# 📋 Sistema de Histórico de Punições

## Visão Geral

O sistema de histórico de punições foi implementado para fornecer um registro completo e detalhado de todas as punições aplicadas pelos membros da staff. Esta funcionalidade permite rastrear, visualizar e analisar o histórico de moderação de forma eficiente.

## ✨ Funcionalidades

### 🔍 Visualização no Perfil
- **Botão no `/perfil`**: Aparece automaticamente quando um usuário possui histórico de punições
- **Contador de punições**: Mostra o número total de punições aplicadas
- **Acesso restrito**: Apenas staff pode visualizar históricos

### 📊 Resumo Estatístico
- **Estatísticas gerais**: Total, ativas, últimos 30 dias
- **Distribuição por tipo**: Breakdown detalhado dos tipos de punição
- **Punições recentes**: Lista das 3 punições mais recentes
- **Análise de atividade**: Classificação da atividade de moderação

### 📋 Histórico Detalhado
- **Paginação**: 5 punições por página para melhor visualização
- **Informações completas**: Data, usuário, motivo, duração, prova
- **Status atual**: Indica se a punição está ativa ou foi removida
- **Navegação intuitiva**: Botões para navegar entre páginas

### 📈 Estatísticas Avançadas
- **Gráficos visuais**: Barras de progresso para cada tipo de punição
- **Percentuais**: Distribuição percentual dos tipos de punição
- **Análise temporal**: Atividade nos últimos 30 dias
- **Métricas de eficiência**: Taxa de punições ativas vs removidas

## 🚀 Como Usar

### 1. Executar Migração
Antes de usar o sistema, execute a migração do banco de dados:

```bash
# Para SQLite
npm run tsx src/scripts/migrate-punishments.ts

# Para MongoDB, execute o script de migração manualmente
```

### 2. Acessar o Histórico
1. Use o comando `/perfil @usuario`
2. Se o usuário tiver histórico de punições, aparecerá um botão "📋 Histórico de Punições"
3. Clique no botão para ver o resumo
4. Use "Ver Histórico Completo" para detalhes paginados

### 3. Navegar pelo Histórico
- **◀️ Anterior**: Página anterior
- **Próxima ▶️**: Próxima página
- **🔄**: Atualizar dados
- **📊 Estatísticas Detalhadas**: Ver análise completa
- **❌**: Fechar o histórico

## 🔧 Estrutura Técnica

### Arquivos Criados/Modificados

#### Novos Arquivos:
- `src/repositories/punishmentRepository.ts` - Repository para gerenciar dados
- `src/services/punishmentHistoryService.ts` - Lógica de negócio
- `src/interactions/buttons/punishmentHistory.ts` - Handler de botões
- `src/db/sqlite/migrations/add_punishments_table.sql` - Migração SQLite
- `src/db/mongo/migrations/add_punishments_collection.js` - Migração MongoDB
- `src/scripts/migrate-punishments.ts` - Script de migração

#### Arquivos Modificados:
- `src/commands/perfil.ts` - Adicionado botão de histórico
- `src/utils/punishment.ts` - Integração com sistema de histórico

### Banco de Dados

#### Tabela/Collection: `punishments`
```sql
- id: Identificador único
- userId: ID do usuário punido
- executorId: ID do staff que aplicou
- punishmentType: Tipo técnico da punição
- punishmentName: Nome amigável da punição
- reason: Motivo da punição
- duration: Duração (se aplicável)
- durationType: Tipo de duração (minutes/hours/days)
- appliedAt: Data/hora da aplicação
- expiresAt: Data/hora de expiração
- active: Se a punição está ativa
- guildId: ID do servidor
- proofUrl: URL da prova
- removedAt: Data/hora da remoção
- removedBy: Quem removeu
- removalReason: Motivo da remoção
```

## 🔒 Permissões

### Quem Pode Ver Históricos:
- **Owners**: Acesso total
- **Liderança geral**: Acesso total
- **Líderes de área**: Acesso total
- **Staff com permissões especiais**: Conforme configuração

### Restrições:
- Membros comuns não podem ver históricos
- Apenas punições do servidor atual são mostradas (por padrão)
- Logs são mantidos mesmo se o usuário sair do servidor

## 📊 Métricas e Analytics

### Estatísticas Disponíveis:
- **Total de punições**: Contador geral
- **Punições ativas**: Quantas ainda estão em vigor
- **Atividade recente**: Últimos 30 dias
- **Distribuição por tipo**: Breakdown detalhado
- **Taxa de eficiência**: Ativas vs removidas

### Análise de Atividade:
- **🔥 Muito ativo**: 10+ punições/mês
- **📈 Moderadamente ativo**: 5-9 punições/mês
- **📊 Baixa atividade**: 1-4 punições/mês

## 🛠️ Configuração

### Variáveis de Ambiente
Nenhuma configuração adicional necessária. O sistema usa as configurações existentes do bot.

### Personalização
Para personalizar tipos de punição, edite a função `getPunishmentTypeName()` em:
- `src/services/punishmentHistoryService.ts`
- `src/interactions/buttons/punishmentHistory.ts`

## 🐛 Troubleshooting

### Problemas Comuns:

1. **Botão não aparece no perfil**
   - Verifique se o usuário tem punições aplicadas
   - Confirme se a migração foi executada
   - Verifique permissões do usuário

2. **Erro ao carregar histórico**
   - Verifique conexão com banco de dados
   - Confirme se os índices foram criados
   - Verifique logs do bot

3. **Punições não aparecem no histórico**
   - Confirme se o sistema está salvando novas punições
   - Verifique se a função `logPunishment` foi atualizada
   - Confirme se não há erros nos logs

### Logs Importantes:
```
'Punição salva no banco de dados' - Confirmação de salvamento
'Erro ao criar registro de punição' - Problema no repository
'Erro ao processar interação do histórico' - Problema na interface
```

## 🔄 Atualizações Futuras

### Funcionalidades Planejadas:
- [ ] Filtros por tipo de punição
- [ ] Exportação de relatórios
- [ ] Gráficos temporais
- [ ] Comparação entre staffers
- [ ] Alertas de atividade anômala
- [ ] Dashboard web

### Melhorias Técnicas:
- [ ] Cache de estatísticas
- [ ] Otimização de queries
- [ ] Compressão de dados antigos
- [ ] API REST para integrações

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do bot
2. Confirme se a migração foi executada
3. Teste com um usuário que sabidamente tem punições
4. Verifique permissões do usuário que está tentando acessar

---

**Desenvolvido para CDW** - Sistema de Histórico de Punições v1.0
