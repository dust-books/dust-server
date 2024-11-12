import type { Database } from "../../database.ts";
import { addUser, getUserByEmail } from "./data.ts";
import type { User } from "./user.ts";
import { hash, verify } from '@ts-rex/bcrypt';

export class UserService {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    async handleSignUp(user: User) {
        const encryptedUser = {
            ...user,
            password: hash(user.password)
        }

        await addUser(this.db, encryptedUser);
        return;
    }

    async handleSignIn(user: Pick<User, "email" | "password">) {
        const storedUser =  await getUserByEmail(this.db, user.email);
        return verify(user.password, storedUser.password);
    }
}