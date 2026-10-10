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
import {fileURLToPath} from "node:url";
import { pool } from './config/database.js';
import { graphConfig } from './config/graph.js';
import { createOutlookConnection } from './integrations/outlook/connection.js';
import { env } from './config/env.js';
import { createEmailRepository } from './modules/emails/emails.repository.js';
import { createEmailService } from './modules/emails/emails.service.js';
import { createEmailRouter } from './modules/emails/emails.routes.js';

const app = express();

app.use(express.json({ limit: '64kb' }));
app.use(sessionMiddleware);

const userService = createUserService(userRepository);
const authMiddleware = createAuthMiddleware(userRepository);

const authController = createAuthController(userService);
const userController = createUserController(userService);

app.use("/auth", createAuthRouter(authController, authMiddleware));

app.use(
    "/users",
    createUserRouter(userController, authMiddleware)
)

const outlook = graphConfig();
const connection = outlook ? createOutlookConnection(pool, outlook, env.SESSION_SECRET) : undefined;
const emailService = outlook
    ? createEmailService(pool, createEmailRepository(pool), connection!, outlook.mailbox)
    : undefined;
app.use('/emails', createEmailRouter(authMiddleware, emailService, outlook?.authMode === 'access_token' ? outlook.ownerEmail : undefined, connection));

app.use(errorMiddleware);

const publicDirectory = fileURLToPath(
    new URL("../public/", import.meta.url),
);

app.use(express.static(publicDirectory, {
    setHeaders(res, path) {
        if (path.endsWith('.html') || path.endsWith('.js')) res.setHeader('Cache-Control', 'no-store');
    },
}));

app.listen(3000, () => {
    console.log("Server running on port 3000");
})
