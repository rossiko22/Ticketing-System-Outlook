import type { Request, Response, NextFunction } from "express";

export function errorMiddleware(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if(res.headersSent){
        next(error);
        return;
    }

    console.error("Request failed", error);

    res.status(500).json({
        message: "An unexpected server error occurred",
    });
}