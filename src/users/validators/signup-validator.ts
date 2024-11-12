import type { User } from "../user.ts";

export const validateSignup = (payload: any): payload is User => {
    if (!payload) return false;
    if (!Object.hasOwn(payload, "displayName")) return false;
    if (!Object.hasOwn(payload, "email")) return false;
    if (!Object.hasOwn(payload, "password")) return false;

    return true;
}