import {Role, type User} from "./users.types.js";
import {pool} from "../../config/database.js";
import type {UUID} from "node:crypto";

export async function findByEmail(email: string): Promise<User | null>{
    const result = await pool.query<User>(
        `
            SELECT 
                user_id AS "userId",
                email,
                password_hash as "passwordHash",
                role,
                avatar_path as "avatarPath",
                is_active as "isActive",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM users
            WHERE lower(email) = lower($1)
        `,
        [email.trim()],
    )

    return result.rows[0] ?? null;
}

export async function findById(id: UUID): Promise<User | null>{
    const result = await pool.query<User>(
        `
            SELECT 
                user_id AS "userId",
                email,
                password_hash as "passwordHash",
                role,
                avatar_path as "avatarPath",
                is_active as "isActive",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM users
            WHERE user_id = $1
        `,
        [id.trim()],
    )

    return result.rows[0] ?? null;
}

export async function create(email: string, passwordHash: string, role: Role, avatarPath: string): Promise<User> {
    const user = await findByEmail(email);

    if (user) {
        throw new Error("User already exists");
    }


    const result = await pool.query<User>(
        `
            INSERT INTO users (
                    email,
                    password_hash,
                    role,
                    avatar_path
            )
            VALUES ($1, $2, $3, $4) 
            RETURNING
                user_id AS "userId",
                email,
                password_hash AS "passwordHash",
                role,
                avatar_path AS "avatarPath",
                is_active AS "isActive",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
        `,
        [
            email.trim(),
            passwordHash,
            role,
            avatarPath
        ]
    )

    const createdUser  = result.rows[0];

    if(!createdUser) {
        throw new Error("User creating returned no row");
    }

    return createdUser;

}
