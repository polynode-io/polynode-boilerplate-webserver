/*
 * polynode-boilerplate-webserver
 *
 * Released under MIT license. Copyright 2019 Jorge Duarte Rodriguez <info@malagadev.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies
 * or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * $Id:$
 *
 * @flow
 * @format
 *
 */

import type { ApplicationRouteFunction } from 'ApplicationTypes';

const Express = require('express');
const BodyParser = require('body-parser');
const http = require('http');
const cors = require('cors');

const RequestContext = require('./RequestContext');

type GenericObject = { [key: string]: any };

type ApplicationErrorType = {
  name: string,
  message?: string,
  stack: {},
};

type ApplicationRouteOptions = {
  allowAnonymous?: boolean,
  forceExecution?: boolean,
};

type RouteOptions = GenericObject;

type DependencyContainer = GenericObject;

type ExpressRequestWithContext = express$Request & { _context: GenericObject };

const addRequestContext = ({
  routeOptions,
  getServerHandler,
  log,
}: {
  routeOptions: RouteOptions,
  getServerHandler: Function,
}): express$Middleware => {
  // @TODO: definir comportamientos para error o para resolver (extraer toda esa logica de context).
  return (
    req: ExpressRequestWithContext,
    res: express$Response,
    next: express$NextFunction
  ): void => {
    log.trace('*** Request starts addRequestContext');
    req._context = new RequestContext({
      getRequest: (): express$Request => req,
      getResponse: (): express$Response => res,
      next: (...args): express$NextFunction => next(...args),
      getServerHandler,
      routeOptions,
      log,
    });
    log.trace('request context has been created');
    req._context.next();
  };
};

const getErrorHandler = ({ log }: DependencyContainer): express$Middleware => (
  err: ApplicationErrorType,
  req: express$Request,
  res: express$Response,
  next: express$NextFunction
) => {
  console.log('IN getErrorHandler!!!!!');
  req._context.resolveWithError(err);
  log.trace({ message: 'Request error: ' + err.message, error: err });
};

const addContextToRequestHandler = handler => {
  return (
    req: express$Request & { _context: GenericObject },
    res: express$Response,
    next: express$NextFunction
  ) => {
    return handler(req._context);
  };
};

const getHandlerForMainRequest = (
  mainRequestFunction: (context: GenericObject) => void
): express$Middleware => {
  return addContextToRequestHandler(async context => {
    context.resolve(await mainRequestFunction(context));
  });
};

const addContextToRequestHandlers = handlers => {
  return handlers.map(handler => addContextToRequestHandler(handler));
};

const bindEnhancedRouteToExpressRouter = ({
  expressRouter,
  methodName,
  uri,
  mainRequestFunction,
  getServerHandler,
  webServerRequestHandle,
  routeOptions,
  log,
}: {
  expressRouter: express$Router<any>,
  methodName: express$RouteMethodType<any>,
  uri: express$Path,
  mainRequestFunction: ApplicationRouteFunction,
  getServerHandler: Function,
  webServerRequestHandle: any,
  routeOptions: ApplicationRouteOptions,
  log: {},
}): express$RouteMethodType<any> => {
  const requestHandlingPipe: express$RouteMethodType<any> = expressRouter[methodName].bind(
    expressRouter
  );

  log.trace(
    'bindEnhancedRouteToExpressRouter: ',
    uri,
    'getServerHandler(): ',
    getServerHandler(),
    'webServerRequestHandle:',
    webServerRequestHandle
  );

  const reqHandlers = webServerRequestHandle();

  const requestPipe = [
    uri,
    addRequestContext({ routeOptions, getServerHandler, log }),
    ...addContextToRequestHandlers(reqHandlers.pre),
    getHandlerForMainRequest(mainRequestFunction),
    getErrorHandler(getServerHandler().getDepsContainer()),
  ];

  return requestHandlingPipe(...requestPipe);
};

const getBypassedRouterMethods = ({
  expressRouter,
  getServerHandler,
  webServerRequestHandle,
  log,
}: {
  expressRouter: express$Router<any>,
  getServerHandler: Function,
  webServerRequestHandle: { pre: Array<Function>, post: Array<Function> },
}): express$Router<any> => {
  const methods = ['get', 'post', 'patch', 'delete', 'put', 'all'];

  return methods.reduce((res, methodName) => {
    res[methodName] = (
      uri: string,
      mainRequestFunction: ApplicationRouteFunction,
      routeOptions: ApplicationRouteOptions = {}
    ): express$Middleware =>
      bindEnhancedRouteToExpressRouter({
        expressRouter,
        methodName,
        uri,
        mainRequestFunction,
        getServerHandler,
        webServerRequestHandle,
        routeOptions,
        log,
      });

    return res;
  }, {});
};

const configureExpressApp = (app: express$Application<any>): void => {
  app.use(BodyParser.json());
  app.use(cors());
};

const createRouter = ({
  getServerHandler,
  webServerRequestHandle,
  log,
}: {
  getServerHandler: Function,
  webServerRequestHandle: { pre?: Array<Function>, post?: Array<Function> },
}): {
  router: express$Router<any>,
  expressRouter: express$Router<any>,
} => {
  const expressRouter = Express.Router();
  const router = getBypassedRouterMethods({
    expressRouter,
    getServerHandler,
    webServerRequestHandle,
    log,
  });
  return { router, expressRouter };
};

const configureExpressRouting = (
  app: express$Application,
  { expressRouter }: { expressRouter: express$Router }
) => {
  app.use(expressRouter);
};

const serverListen = (server: express$Application, port: Number): Promise<any> =>
  new Promise((resolve, reject) => {
    server.listen(port, data => {
      resolve(data);
    });
  });

const sendResponse = ({
  res,
  log,
  httpStatusCode,
  responseContentType,
  outputObj,
}: {
  res: {},
  httpStatusCode: number,
  responseContentType: string,
  outputObj: any,
}): void => {
  log.trace(`sendResponse(HTTP ${httpStatusCode}): SEND OUTPUT`);
  log.trace(outputObj);
  res.setHeader('Content-Type', responseContentType);
  res
    .status(httpStatusCode)
    .json(outputObj)
    .end();
};

module.exports = (depsContainer: DependencyContainer) => {
  const log = depsContainer.log;
  log.info('[boilerplate-webserver] ##### Initializing... ');
  const config = depsContainer.config;
  log.debug(
    'web server config is: ',
    depsContainer.config,
    '.enhanceRequestContext: ',
    depsContainer.enhanceRequestContext
  );

  const expressHandler = Express();
  const getServerHandlerForContext = () => ({
    getConfig: () => config,
    getDepsContainer: () => depsContainer,
    sendResponse,
  });
  const mainRouter = createRouter({
    getServerHandler: getServerHandlerForContext,
    webServerRequestHandle: depsContainer.webServerRequestHandle,
    log,
  });

  configureExpressApp(expressHandler);
  configureExpressRouting(expressHandler, mainRouter);
  const server = http.createServer(expressHandler);

  return {
    getMainRouter: () => mainRouter.router,
    getServer: () => server,
    startServer: async () => {
      await serverListen(server, config.port);
      log.debug('*** Server listening in port: ' + config.port);
      return true;
    },
    sendResponse,
    getConfig: () => config,
    getDepsContainer: () => depsContainer,
  };
};
