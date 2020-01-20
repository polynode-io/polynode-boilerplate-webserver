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

const { UnprocessableEntityError } = require('./Errors');

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

type EndpointValidatorType = (body: string) => Promise<any>;

type RequestHookDefinitions = {
  pre?: Array<express$Middleware>,
  post?: Array<express$Middleware>,
};

const addRequestContext = ({
  getServerHandler,
  getRouteOptions,
  log,
}: {
  routeOptions: RouteOptions,
  getServerHandler: Function,
  log: any,
}): express$Middleware => {
  // @TODO: definir comportamientos para error o para resolver (extraer toda esa logica de context).
  return (
    req: ExpressRequestWithContext,
    res: express$Response,
    next: express$NextFunction
  ): void => {
    // log.trace({}, 'Request starts addRequestContext');
    req._context = new RequestContext({
      getRequest: (): ExpressRequestWithContext => req,
      getResponse: (): express$Response => res,
      next: (...args): void => next(...args),
      getServerHandler,
      routeOptions: getRouteOptions(),
      log,
    });
    // req._context.log({}, 'Request Context has been created.');

    req._context.next();
  };
};

const getErrorHandler = ({ log }: DependencyContainer): express$Middleware => {
  return (
    err: ApplicationErrorType,
    req: express$Request,
    res: express$Response,
    next: express$NextFunction
  ): void => {
    req._context.resolveWithError(err);
    req._context.log({ err }, 'Request error: ' + err.message, 'debug');
  };
};

const getContextualisedMiddleware = (
  handler: (context: GenericObject) => void
): express$Middleware => (
  req: ExpressRequestWithContext,
  res: express$Response,
  next: express$NextFunction
): void => handler(req._context);

const getContextualizedRouteMiddlewares = (
  routeMiddlewares: Array<(context: GenericObject) => void>
): express$Middleware => routeMiddlewares.map(mw => getContextualisedMiddleware(mw));

const getEnhancedRouteMiddlewarePipe = ({
  serverRequestHooks,
  getServerHandler,

  getRouteOptions,
  log,
  specificRouteMiddlewares,
}): Array<express$Middleware> => [
  addRequestContext({ getServerHandler, getRouteOptions, log }),
  ...(serverRequestHooks.pre ? getContextualizedRouteMiddlewares(serverRequestHooks.pre) : []),
  ...getContextualizedRouteMiddlewares(specificRouteMiddlewares),
  getErrorHandler(getServerHandler().getDepsContainer()),
];

const getEnhancedRouteInstance = (
  methodName,
  uri,
  specificRouteMiddlewares,
  enhancedRouteHandlers,
  { expressRouter, serverRequestHooks, getServerHandler, log }
) => {
  const obj = {
    ...enhancedRouteHandlers,
    methodName,
    uri,
    expressRouter,
    serverRequestHooks,
    getServerHandler,
    _options: {},

    addRealExpressRoute: function(middlewares) {
      return this.expressRouter[this.methodName].bind(this.expressRouter)(this.uri, ...middlewares);
    },
    setOptions: function(opts: {}) {
      this._options = { ...this._options, ...opts };
      return this;
    },
    getOptions: function() {
      return this._options;
    },
    resolve: async function() {
      const middlewares = getEnhancedRouteMiddlewarePipe({
        serverRequestHooks,
        getServerHandler,
        log,
        specificRouteMiddlewares,
        getRouteOptions: () => this.getOptions(),
      });

      return this.addRealExpressRoute(middlewares);
    },
  };
  return obj;
};

const getBypassedRouterMethods = ({
  expressRouter,
  getServerHandler,
  serverRequestHooks,
  enhancedRouteHandlers,
  log,
}: {
  expressRouter: express$Router<any>,
  getServerHandler: Function,
  serverRequestHooks: { pre: Array<Function>, post: Array<Function> },
  enhancedRouteHandlers: {},
  log: any,
}): express$Router<any> => {
  const methods = ['get', 'post', 'patch', 'delete', 'put', 'all'];

  return methods.reduce((res, methodName) => {
    res[methodName] = (
      uri: string,
      ...specificRouteMiddlewares: ApplicationRouteFunction
    ): PolynodeEnhancedRoute => {
      return getEnhancedRouteInstance(
        methodName,
        uri,
        specificRouteMiddlewares,
        enhancedRouteHandlers,
        {
          getServerHandler,
          log,
          serverRequestHooks,
          expressRouter,
        }
      );
    };

    return res;
  }, {});
};

const configureExpressApp = (app: express$Application<any>): void => {
  app.use(BodyParser.json());
  //
  app.use(cors());
};

const createRouter = ({
  getServerHandler,
  serverRequestHooks,
  getEnhancedRouteHandlers,
  log,
}: {
  getServerHandler: Function,
  serverRequestHooks: { pre?: Array<Function>, post?: Array<Function> },
  getEnhancedRouteHandlers: () => {},
  log: any,
}): {
  router: express$Router<any>,
  expressRouter: express$Router<any>,
} => {
  const expressRouter = Express.Router();
  const router = getBypassedRouterMethods({
    expressRouter,
    getServerHandler,
    serverRequestHooks,
    enhancedRouteHandlers: getEnhancedRouteHandlers(),
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
  log: any,
}): void => {
  log({ outputObj }, `sendResponse(HTTP ${httpStatusCode}): SEND OUTPUT`);
  res.setHeader('Content-Type', responseContentType);
  res
    .status(httpStatusCode)
    .json(outputObj)
    .end();
};

module.exports = (depsContainer: DependencyContainer) => {
  const log = depsContainer.log;
  log.info({}, '[boilerplate-webserver] ##### Initializing... ');
  const config = depsContainer.config;
  log.debug(
    {},
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

  const enhancedRouteHandlers = {};

  const mainRouter = createRouter({
    getServerHandler: getServerHandlerForContext,
    serverRequestHooks: depsContainer.serverRequestHooks,
    getEnhancedRouteHandlers: () => enhancedRouteHandlers,
    log,
  });

  configureExpressApp(expressHandler);
  configureExpressRouting(expressHandler, mainRouter);

  const server = http.createServer(expressHandler);

  const instance = {
    getMainRouter: () => mainRouter.router,
    getServer: () => server,
    startServer: async () => {
      await serverListen(server, config.port);
      log.debug({}, '*** Server listening in port: ' + config.port);
      return true;
    },
    sendResponse,
    getConfig: () => config,
    getDepsContainer: () => depsContainer,
    registerEnhancedRouteHandlers: (newRouteHandlers: {}) => {
      const entries = Object.entries(newRouteHandlers);
      for (const [name, func] of entries) {
        enhancedRouteHandlers[name] = func;
      }
    },
  };

  if (depsContainer.enhanceServerInstance) {
    // @todo: we need to find a way to affect getServerHandlerForContext() behavior efficiently
    console.log('enhacing server instance');
    depsContainer.enhanceServerInstance.call(instance);
  }

  console.log('final instance is. ', instance);

  return instance;
};
