import type { User } from "../user.ts";

export const validateSignIn = (payload: any): payload is Pick<User, "email" | "password"> => {
    if (!payload) return false;
    if (!Object.hasOwn(payload, "email")) return false;
    if (!Object.hasOwn(payload, "password")) return false;

    return true;
}