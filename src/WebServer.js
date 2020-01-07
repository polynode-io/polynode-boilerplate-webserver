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
const Ajv = require('ajv');

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

const ajv = new Ajv();

const addRequestContext = ({
  routeOptions,
  getServerHandler,
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
      routeOptions,
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

const addContextToRequestHandler = (
  handler: (context: GenericObject) => void
): express$Middleware => (
  req: ExpressRequestWithContext,
  res: express$Response,
  next: express$NextFunction
): void => handler(req._context);

const getHandlerForMainRequest = (
  mainRequestFunction: (context: GenericObject) => void
): express$Middleware => addContextToRequestHandler(mainRequestFunction);

const addContextToRequestHandlers = (
  handlers: Array<express$Middleware>
): Array<express$Middleware> =>
  handlers.map((handler: express$Middleware): express$Middleware =>
    addContextToRequestHandler(handler)
  );

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

  const reqHooks: {
    pre?: Array<express$Middleware>,
    post?: Array<express$Middleware>,
  } = webServerRequestHandle();

  const requestPipe: Array<express$Middleware> = [
    addRequestContext({ routeOptions, getServerHandler, log }),
    ...(reqHooks.pre ? addContextToRequestHandlers(reqHooks.pre) : []),
    getHandlerForMainRequest(mainRequestFunction),
    getErrorHandler(getServerHandler().getDepsContainer()),
  ];

  return requestHandlingPipe(uri, ...requestPipe);
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
  //
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

  const mainRouter = createRouter({
    getServerHandler: getServerHandlerForContext,
    webServerRequestHandle: depsContainer.webServerRequestHandle,
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
    validateBody: (
      uncompiledJsonSchema: {},
      controllerCallback: (context: {}, inputParams: Object) => any
    ) => {
      log.trace({}, 'Inside validateBody');
      const endpointValidator: EndpointValidatorType = ajv.compile(uncompiledJsonSchema);
      log.trace({}, 'after endpointValidator');
      try {
        return async context => {
          const reqBody = context.getRequest().body;
          try {
            const validData: any = await endpointValidator(reqBody);
            return controllerCallback(context, validData);
          } catch (err) {
            log.trace({ err }, 'Validation errors:');
            return context.reject(
              new UnprocessableEntityError('Invalid params', {
                type: 'ValidationError',
                errors: err.errors,
              })
            );
          }
        };
      } catch (err) {
        log.trace({ err }, 'validateBody.Exception');
      }
    },
    sendResponse,
    getConfig: () => config,
    getDepsContainer: () => depsContainer,
  };

  if (depsContainer.enhanceServerInstance) {
    // @todo: we need to find a way to affect getServerHandlerForContext() behavior efficiently
    console.log('enhacing server instance');
    depsContainer.enhanceServerInstance.call(instance);
  }

  console.log('final instance is. ', instance);

  return instance;
};
