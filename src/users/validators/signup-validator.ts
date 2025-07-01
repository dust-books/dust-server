import type { User } from "../user.ts";

export const validateSignup = (payload: any): payload is User => {
    if (!payload) return false;
    if (!Object.hasOwn(payload, "display_name") && !Object.hasOwn(payload, "displayName")) return false;
    if (!Object.hasOwn(payload, "email")) return false;
    if (!Object.hasOwn(payload, "password")) return false;
    // username is optional for registration

    return true;
}