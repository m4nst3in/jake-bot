import { DatabaseManager } from '../db/manager.ts';
export class BaseRepo {
    protected get sqlite() { return DatabaseManager.getSqlite().connection; }
    protected get mongo() { return DatabaseManager.getMongo().database; }
    protected isSqlite() { return DatabaseManager.current === 'sqlite'; }
}
