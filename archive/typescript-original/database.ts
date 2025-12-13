import { createClient, type InStatement, type ResultSet } from '@libsql/client/node';


export interface Database {
    migrate(statements: Array<InStatement>): Promise<Array<ResultSet>>;
    execute(statement: InStatement): Promise<ResultSet>;
}
export class DustDatabase implements Database {
    // TODO: Make filepath configurable
    // TODO: Default filepath to an OS-specific application config dir
    // ie: "%APP_ROAMING%/dust/dust.db" for windows
    private db = createClient({
        url: Deno.env.get("DATABASE_URL") || "file:dust.db"
    });

    migrate(statements: Array<InStatement>): Promise<Array<ResultSet>> {
        return this.db.migrate(statements);
    }

    execute(statement: InStatement): Promise<ResultSet> {
        return this.db.execute(statement);
    }
}