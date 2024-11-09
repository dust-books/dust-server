import { createClient, type InStatement, type ResultSet } from '@libsql/client';


export interface Database {
    migrate(statements: Array<InStatement>): Promise<Array<ResultSet>>;
}
export class DustDatabase implements Database {
    private db = createClient({
        url: "file:dust.db"
    });

    migrate(statements: Array<InStatement>): Promise<Array<ResultSet>> {
        return this.db.migrate(statements);
    }

    execute<T>(statement: InStatement): Promise<ResultSet> {
        return this.db.execute(statement);
    }
}