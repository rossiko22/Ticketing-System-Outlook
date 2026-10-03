import express from "express";
import * as userRepository from "./modules/users/users.repository.js";
import { sessionMiddleware } from "./middleware/session.middleware.js";
import {createUserService} from "./modules/users/users.service.js";
import {createAuthMiddleware} from "./middleware/auth.middleware.js";
import {createAuthController} from "./modules/auth/auth.controller.js";
import {createUserController} from "./modules/users/users.controller.js";
import {createAuthRouter} from "./modules/auth/auth.routes.js";
import {createUserRouter} from "./modules/users/users.routes.js";
import {errorMiddleware} from "./middleware/error.middleware.js";

const app = express();

app.use(express.json());
app.use(sessionMiddleware);

const userService = createUserService(userRepository);
const authMiddleware = createAuthMiddleware(userRepository);

const authController = createAuthController(userService);
const userController = createUserController(userService);

app.use("/auth", createAuthRouter(authController));

app.use(
    "/users",
    createUserRouter(userController, authMiddleware)
)

app.use(errorMiddleware);