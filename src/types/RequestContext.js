// @flow

import type { $Request, $Response, NextFunction, Middleware } from 'express';

declare module 'PolynodeWebserver' {
  declare export type RequestContextType = {
    req: $Request,
    res: $Response,
    next: NextFunction,
    resolve: (obj: any) => void,
    reject: (err: ApplicationErrorType) => void,
    reuseInstance: ({}) => RequestContextType,
    logger: Function => Middleware,
  };
}
