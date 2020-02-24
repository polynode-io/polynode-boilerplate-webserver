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

const { NotFoundError } = require('./Errors');

const ROUTE_METHODS = ['get', 'post', 'patch', 'delete', 'put', 'all'];
const ROUTE_METHODS_CORS_NON_COMPLEX = ['get', 'head', 'post'];

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

const Constants = {
  DEFAULT_SUCCESS_HTTP_STATUS_CODE: 200,
  DEFAULT_ERROR_HTTP_STATUS_CODE: 500,
};

const CORS_OPTIONS = {
  origin: (origin, callback) => {
    const allowedByCors = true;

    if (allowedByCors) {
      callback(null, true);
    } else {
      callback(new Error(`${origin} not allowed by CORS`));
    }
  },
  credentials: true,
};

const enableCors = () => cors(CORS_OPTIONS);

const addRequestContext = ({
  getServerHandler,
  getRouteOptions,
  log,
}: {
  getRouteOptions: () => RouteOptions,
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

const resolveWithError = (
  err: ApplicationErrorType,
  responseContentType: string,
  res: express$Response,
  log: any
) => {
  const httpStatusCode = err.httpStatusCode || Constants.DEFAULT_ERROR_HTTP_STATUS_CODE;
  const outputObj = ('expose' in err && err.expose != null && err.expose) || {};

  return sendResponse({
    httpStatusCode,
    outputObj,
    responseContentType,
    log,
    res,
  });
};

const getErrorHandler = ({ log }: DependencyContainer): express$Middleware => {
  return (
    err: ApplicationErrorType,
    req: express$Request,
    res: express$Response,
    next: express$NextFunction
  ): void => {
    req._context.log({ err }, 'Request error: ' + err.message, 'debug');
    resolveWithError(
      err,
      req._context.getServerHandler().getConfig().defaultOutputContentType,
      res,
      log
    );
  };
};

const getContextualisedMiddleware = (
  handler: (query: {}, body: {}, context: GenericObject) => void
): express$Middleware => (
  req: ExpressRequestWithContext,
  res: express$Response,
  next: express$NextFunction
): void => {
  handler({ _unsafe: req.params }, { _unsafe: req.body }, req._context);
};

const getContextualizedRouteMiddlewares = (
  routeMiddlewares: Array<(context: GenericObject) => void>
): express$Middleware => routeMiddlewares.map(mw => getContextualisedMiddleware(mw));

const getNonFoundHandler = ({ log }): express$Middleware => {
  return (req: ExpressRequestWithContext, res: express$Response, next: express$NextFunction) => {
    resolveWithError(
      new NotFoundError(),
      req._context.getServerHandler().getConfig().defaultOutputContentType,
      res,
      log
    );
  };
};

const getEnhancedRouteMiddlewarePipe = ({
  serverRequestHooks,
  getServerHandler,
  mainMiddleware,
  getRouteOptions,
  log,
}): Array<express$Middleware> => [
  addRequestContext({ getServerHandler, getRouteOptions, log }),
  ...(serverRequestHooks.pre ? getContextualizedRouteMiddlewares(serverRequestHooks.pre) : []),
  getContextualisedMiddleware(mainMiddleware),
  getNonFoundHandler(getServerHandler().getDepsContainer()),
  getErrorHandler(getServerHandler().getDepsContainer()),
];

const getEnhancedRouteInstance = (
  methodName,
  uri,
  specificRouteMiddlewares,
  enhancedRouteHandlers,
  { expressRouter, serverRequestHooks, getServerHandler, log }
) => {
  // console.log('enhancedRouteHandlers: ', enhancedRouteHandlers);
  const obj = {
    enhancedRouteHandlers,
    compiledEnhancedRouteHandlers: {},
    applyEnhancedRouteHandlers: function() {
      enhancedRouteHandlers.forEach(erh => {
        //  console.log('this is: ', this);
        // console.log('process ERH: ', { [erh.name]: erh.handler });
        this[erh.name] = (...args) => {
          console.log('[' + erh.name + '] handler is: ', erh.handler, 'args:', args);
          try {
            const { handler } = erh;
            // console.log('- this is: ', this);
            // console.log('handler*: ', handler);
            console.log('replace this[' + erh.name + ']');
            this.compiledEnhancedRouteHandlers[erh.name] = handler.bind(this)(...args);
            console.log('OK: ');
          } catch (err) {
            console.log('ERH ERROR: ', err);
            return;
          }

          //  console.log('this is: ', this);
          return this;
        };
      }, {});
    },
    methodName,
    uri,
    expressRouter,
    serverRequestHooks,
    getServerHandler,
    _options: {},

    addRealExpressRoute: function(middlewares) {
      console.log('add real express route: ', middlewares);
      const mainResult = this.expressRouter[this.methodName].bind(this.expressRouter)(
        this.uri,
        ...middlewares
      );

      if (isComplexCorsMethod(this.methodName)) {
        this.expressRouter.options.bind(this.expressRouter)(this.uri, enableCors());
      }

      return mainResult;
    },
    setOptions: function(opts: {}) {
      this._options = { ...this._options, ...opts };
      return this;
    },
    getOptions: function() {
      return this._options;
    },
    resolve: async function() {
      const finalNext = async (query, body, context, transform) => {
        console.log('specificRouteMiddlewares: ', specificRouteMiddlewares);
        // @todo : en el caso de que "cur" no sea una función (o mas bien se haga una excepcion)
        // alertar de que hay una ruta mal configurada (apuntando hacia algo que no es una funcion)
        console.log('finalnext: ', query, body, transform);
        //  ;
        const result = await specificRouteMiddlewares.reduce(
          (last, cur) => last.then(() => cur(query, body, context)),
          Promise.resolve()
        );
        if (transform) {
          return transform(result);
        }
        console.log('Result: ', result);
        return result;
      };

      const middlewares = getEnhancedRouteMiddlewarePipe({
        serverRequestHooks,
        getServerHandler,
        log,
        mainMiddleware: async (query, body, context) => {
          const disableAutoFlush =
            'disableAutoFlush' in this.getOptions() && this.getOptions().disableAutoFlush === true;

          //  console.log('enhancedRouteHandlers.reduce starts:', [query, body, context]);
          try {
            const _x = await Object.keys(this.compiledEnhancedRouteHandlers).reduce(
              (last, cur, idx) => {
                return last.then(lastRes => {
                  //      console.log('Last result was: ', lastRes);
                  const params = lastRes || [query, body, context, null];
                  /*        console.log(
                    'Call handler "' +
                      cur +
                      '" (last: ' +
                      (idx - 1 in enhancedRouteHandlers && enhancedRouteHandlers[idx - 1].name) +
                      ') params: ',
                   params
                 ); */
                  // console.log('New params are: ', params);

                  console.log(
                    'going to exec: ',
                    cur,
                    'params: ',
                    params,
                    'context currentUser:',
                    params[2].currentUser
                  );
                  const result = this.compiledEnhancedRouteHandlers[cur].bind(this)(...params);
                  console.log('reuslt is : ', { result });
                  return result;
                });
              },

              Promise.resolve()
            );

            console.log('_x:', _x);
            const _r = await _x;
            console.log('_r: ', _r);

            const result = await finalNext(...(_r || [query, body, context, null]));
            //  console.log('r2: ', result);

            if (!disableAutoFlush) {
              context.resolve(result);
            }
          } catch (err) {
            return context.reject(err);
          }
        },
        getRouteOptions: () => this.getOptions(),
      });

      /*

*/
      return this.addRealExpressRoute(middlewares);
    },
  };
  // console.log('obj is: ', obj);
  obj.applyEnhancedRouteHandlers();
  return obj;
};

const isComplexCorsMethod = (methodName: string) =>
  methodName in ROUTE_METHODS_CORS_NON_COMPLEX === false;

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
  return ROUTE_METHODS.reduce((res, methodName) => {
    res[methodName] = (
      uri: string,
      ...specificRouteMiddlewares: ApplicationRouteFunction
    ): PolynodeEnhancedRoute => {
      return getEnhancedRouteInstance(
        methodName,
        uri,
        isComplexCorsMethod(methodName)
          ? [enableCors(), ...specificRouteMiddlewares]
          : specificRouteMiddlewares,
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
  app.use(enableCors());
  /*
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', 'camperalia.com'); // update to match the domain you will make the request from
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });
  */
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

  const enhancedRouteHandlers = [];

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
      for (const [name, handler] of entries) {
        enhancedRouteHandlers.push({ name, handler });
      }
    },
  };

  if (depsContainer.enhanceServerInstance) {
    // @todo: we need to find a way to affect getServerHandlerForContext() behavior efficiently

    depsContainer.enhanceServerInstance.call(instance);
  }

  return instance;
};
