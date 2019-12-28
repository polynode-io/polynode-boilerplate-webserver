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

const Constants = {
  DEFAULT_SUCCESS_HTTP_STATUS_CODE: 200,
  DEFAULT_ERROR_HTTP_STATUS_CODE: 500,
};

const RequestContext = function({
  getRequest,
  getResponse,
  next,
  getServerHandler,
  routeOptions,
  log,
}: {
  getRequest: () => () => void,
  getResponse: () => () => void,
  next: () => () => void,
  getServerHandler: () => {},
  routeOptions: { responseContentType?: string },
}) {
  this.getRequest = getRequest;
  this.getResponse = getResponse;
  this.next = next;
  this.logger = log.child({ scope: 'polynode-webserver-context' }, true);
  this.log = (obj, message, logLevel = 'trace') =>
    this.logger[logLevel]({ ...obj, req: this.getRequest(), res: this.getResponse() }, message);

  this.log({}, 'inside RequestContext constructor.');

  this.defaultRouteOptions = {};

  this.getRouteOptions = () => ({ ...this.defaultRouteOptions, ...routeOptions });

  this.resolve = (
    outputObj: any,
    httpStatusCode: number = Constants.DEFAULT_SUCCESS_HTTP_STATUS_CODE
  ) => {
    const contentType =
      routeOptions.responseContentType || getServerHandler().getConfig().defaultOutputContentType;

    return getServerHandler().sendResponse({
      httpStatusCode,
      outputObj,
      responseContentType: contentType,
      log: this.log,
      res: this.getResponse(),
    });
  };

  this.resolveWithError = (err: ApplicationErrorType) => {
    console.log('resolveWithError');
    const httpStatusCode = err.httpStatusCode || Constants.DEFAULT_ERROR_HTTP_STATUS_CODE;
    const outputObj = 'expose' in err && err.expose != null ? err.expose : { internalError: true };

    return getServerHandler().sendResponse({
      httpStatusCode,
      outputObj,
      responseContentType: getServerHandler().getConfig().defaultOutputContentType,
      log: this.log,
      res: this.getResponse(),
    });
  };

  this.reject = (err: ApplicationErrorType) => this.next(err);

  this.getServerDependencies = () => getServerHandler().getDepsContainer();

  const getRequestInputData = (jsonSchema: {}, sourceObj: {}) =>
    Object.keys(params).reduce((obj, paramName) => {
      const paramValue = sourceObj[paramName];
      const paramValidation = params[paramName];

      const { validationResult, transformResult } = Validation.processSingleParam(
        paramName,
        paramValue,
        paramValidation
      );

      if (validationResult === false) {
        this.log('ValidationResult = false');

        throw new ValidationError(`getRequestInputData() failed validating param: ${paramName}`, {
          param: paramName,
        });
      }

      return { ...obj, [paramName]: transformResult };
    }, {});

  this.getPostData = params => getRequestInputData(params, this.getRequest().body);

  this.getReqParams = params => getRequestInputData(params, this.getRequest().params);

  getServerHandler()
    .getDepsContainer()
    .enhanceRequestContext.call(this, getServerHandler);
};

module.exports = RequestContext;
