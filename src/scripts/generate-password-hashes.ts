import {hashPassword} from "../security/password.js";

async function main(): Promise<void> {
    const developerHash = await hashPassword("Developer-Test-123!");
    const managerHash = await hashPassword("Manager-Test-123!");

    console.log("Developer hash:", developerHash);
    console.log("Manager hash:", managerHash);
}

main().catch((error: unknown) => {
    console.error("Could not generate password hashes:", error);
    process.exitCode = 1;
});