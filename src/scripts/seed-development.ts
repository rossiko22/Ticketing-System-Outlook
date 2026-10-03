import { readFile } from "node:fs/promises";
import {pool} from "../config/database.js";

async function main(): Promise<void> {
    try {
        if (process.env.NODE_ENV !== "development") {
            throw new Error(
                "Development seeding requires NODE_ENV=development.",
            );
        }

        const seedFile = new URL(
            "../../database/seeds/development.sql",
            import.meta.url,
        );

        const sql = await readFile(seedFile, "utf8");
        await pool.query(sql);

        console.log("Development seed completed.");
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
});