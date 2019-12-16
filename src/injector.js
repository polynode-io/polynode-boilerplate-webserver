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

const INJECTED_DEPENDENCY_NAME = 'webServer';

const WebServer = require('./WebServer');

module.exports = (composer, forwardOpts) =>
  composer
    .addStartHandler({
      [INJECTED_DEPENDENCY_NAME]: ({ dependency }) => {
        composer.log('[boilerplate-boilerplate-webserver] Start handler.');
        dependency.startServer();
      },
    })
    .registerDependency({
      [INJECTED_DEPENDENCY_NAME]: inject =>
        inject
          .asFunction(WebServer)
          .inject(() => ({
            config: { defaultOutputContentType: 'text/html', ...forwardOpts.webServerConfig },
            enhanceRequestContext: forwardOpts.enhanceRequestContext,
            webServerRequestHandle: forwardOpts.webServerRequestHandle,
          }))
          .singleton(),
    });
