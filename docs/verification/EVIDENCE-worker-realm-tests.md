# Worker REPL: 17-vibe-1016-43-webworker

> This file is a REPL presented as a chat between you and a live worker. Add a fenced JavaScript block at the bottom and the connected worker will run it.

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43-webworker at 10:20:05
```JS
// Worker Test 1: console.log
console.log('Worker console.log message');
console.log({ worker: true, data: 123 });
'worker-console-log-complete'
```


> **17-vibe-1016-43-webworker** to agent at 10:20:05 (9ms)
```JSON
undefined
```
```Text console.log
Worker console.log message
```
```JSON console.log
{"worker":true,"data":123}
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43-webworker at 10:20:21
```JS
// Worker Test 2: console.warn
console.warn('Worker warning message');
console.info('Worker info message');
'worker-console-warn-info-complete'
```


> **17-vibe-1016-43-webworker** to agent at 10:20:21 (6ms)
```JSON
undefined
```
```Text console.warn
Worker warning message
```
```Text console.info
Worker info message
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43-webworker at 10:20:39
```JS
// Worker Test 3: self.onerror - async error
setTimeout(() => { throw new Error('Worker async error from setTimeout'); }, 10);
// Give time for error to fire
await new Promise(r => setTimeout(r, 50));
'worker-async-error-complete'
```


> **17-vibe-1016-43-webworker** to agent at 10:20:39 (54ms)
```JSON
undefined
```
```self.onerror
Error: Worker async error from setTimeout
    at eval (eval at <anonymous> (http://localhost:8302/oyinbo/worker-bootstrap.js:118:32), <anonymous>:4:26)
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43-webworker at 10:20:57
```JS
// Worker Test 4: unhandledrejection
Promise.reject(new Error('Worker unhandled promise rejection'));
// Give time for rejection to fire
await new Promise(r => setTimeout(r, 50));
'worker-unhandled-rejection-complete'
```


> **17-vibe-1016-43-webworker** to agent at 10:20:57 (56ms)
```JSON
undefined
```
```unhandledrejection
Error: Worker unhandled promise rejection
    at eval (eval at <anonymous> (http://localhost:8302/oyinbo/worker-bootstrap.js:118:32), <anonymous>:4:16)
    at http://localhost:8302/oyinbo/worker-bootstrap.js:118:57
```

----------------------------------------------------------------------
> Write code in a fenced JS block below to execute against this page.

