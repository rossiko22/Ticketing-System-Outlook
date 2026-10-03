import type {createAuthController} from "./auth.controller.js";
import {Router} from "express";

type AuthController = ReturnType<typeof createAuthController>;

export function createAuthRouter(authController: AuthController) {
    const router = Router();

    router.post("/login", authController.login);

    return router;
}