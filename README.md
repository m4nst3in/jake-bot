# Jake Bot

Bot modular para gestão de RPP, pontuação, blacklist e operações multi-servidor.

## Stack
- Node 18+
- TypeScript
- discord.js v14
- SQLite (default) ou MongoDB via adaptadores
- Pino para logs
- node-cron para agendamentos

## Scripts
- dev: execução com reload
- build: compila para `dist/`
- deploy:commands: registra slash commands
- migrate:sqlite / migrate:mongo (exemplo simples)

## Estrutura
```
src/
  commands/
  interactions/{buttons,modals,selects}
  events/
  db/{sqlite,mongo}
  repositories/
  services/
  scheduling/
  utils/
```

## Variáveis (.env)
Veja `.env.example`.

## Próximos Passos
- Completar serviços de pontuação, blacklist e painel.
- Implementar sincronização multi-servidor.
- Adicionar testes adicionais.

Mensagens ao usuário: sempre em pt-BR com tom profissional amigável.
