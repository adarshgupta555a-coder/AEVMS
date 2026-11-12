import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validateRequest = (schema: RequestValidationSchema) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        const parsedQuery = (await schema.query.parseAsync(req.query)) as Record<
          string,
          unknown
        >;
        try {
          req.query = parsedQuery as any;
        } catch {
          Object.assign(req.query, parsedQuery);
        }
      }
      if (schema.params) {
        const parsedParams = (await schema.params.parseAsync(req.params)) as Record<
          string,
          string
        >;
        Object.assign(req.params, parsedParams);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
