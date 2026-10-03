import type {createUserController} from "./users.controller.js";
import type {createAuthMiddleware} from "../../middleware/auth.middleware.js";
import {Router} from "express";
import {Role} from "./users.types.js";

type UserController = ReturnType<typeof createUserController>;
type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;

export function createUserRouter(
    userController: UserController,
    authMiddleware: AuthMiddleware
) {
    const router = Router();

    router.post(
        "/",
        authMiddleware.requireAuth,
        authMiddleware.requireRole(Role.IT_MANAGER),
        userController.create
    );

    return router;
}