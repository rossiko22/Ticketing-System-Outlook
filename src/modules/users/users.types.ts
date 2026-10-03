import type {UUID} from "node:crypto";

export enum Role {
    SOFTWARE_DEVELOPER = 1,
    IT_MANAGER = 2
}

export type User = {
    userId: UUID,
    email: string,
    passwordHash: string,
    role: Role,
    avatarPath: string,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
}

export type SafeUser = Omit<User, "passwordHash">