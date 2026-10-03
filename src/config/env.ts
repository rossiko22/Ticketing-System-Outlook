import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];

    if (value === undefined || value.trim() === "") {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value;
}

const postgresPort = Number(required("POSTGRES_PORT"));

if (
    !Number.isInteger(postgresPort) ||
    postgresPort < 1 ||
    postgresPort > 65535
) {
    throw new Error("POSTGRES_PORT must be an integer between 1 and 65535");
}

export const env = {
    POSTGRES_HOST: required("POSTGRES_HOST"),
    POSTGRES_PORT: postgresPort,
    POSTGRES_DB: required("POSTGRES_DB"),
    POSTGRES_USER: required("POSTGRES_USER"),
    POSTGRES_PASSWORD: required("POSTGRES_PASSWORD"),
    NODE_ENV: required("NODE_ENV"),
    SESSION_SECRET: required("SESSION_SECRET"),
} as const;