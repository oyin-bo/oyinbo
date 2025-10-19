# Page REPL: 17-vibe-1016-43

> This file is a REPL presented as a chat between you and a live page. Add a fenced JavaScript block at the bottom and the connected page will run it.

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43 at 10:18:05
```JS
// Test 1: console.log
console.log('Hello from console.log');
console.log({ foo: 'bar', num: 42 });
'test-console-log-complete'
```


> **17-vibe-1016-43** to agent at 10:18:05 (7ms)
```JSON
undefined
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43 at 10:18:38
```JS
// Test 1: console.log
console.log('Hello from console.log');
console.log({ foo: 'bar', num: 42 });
'test-console-log-complete'
```


> **17-vibe-1016-43** to agent at 10:18:39 (7ms)
```JSON
undefined
```
```Text console.log
Hello from console.log
```
```JSON console.log
{"foo":"bar","num":42}
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43 at 10:18:57
```JS
// Test 2: console.warn and console.info
console.warn('This is a warning');
console.info('This is info');
'test-console-warn-info-complete'
```


> **17-vibe-1016-43** to agent at 10:18:57 (6ms)
```JSON
undefined
```
```Text console.warn
This is a warning
```
```Text console.info
This is info
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43 at 10:19:12
```JS
// Test 3: console.error
console.error('This is an error message');
'test-console-error-complete'
```


> **17-vibe-1016-43** to agent at 10:19:13 (7ms)
```JSON
undefined
```
```Error console.error
This is an error message
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43 at 10:19:30
```JS
// Test 4: window.onerror - async error
setTimeout(() => { throw new Error('Async error from setTimeout'); }, 10);
// Give time for error to fire
await new Promise(r => setTimeout(r, 50));
'test-async-error-complete'
```


> **17-vibe-1016-43** to agent at 10:19:30 (55ms)
```JSON
undefined
```
```window.onerror
Error: Async error from setTimeout
    at eval (eval at clientMainFunction (http://localhost:8302/:213:32), <anonymous>:4:26)
```

----------------------------------------------------------------------

> **agent** to 17-vibe-1016-43 at 10:19:47
```JS
// Test 5: unhandledrejection
Promise.reject(new Error('Unhandled promise rejection'));
// Give time for rejection to fire
await new Promise(r => setTimeout(r, 50));
'test-unhandled-rejection-complete'
```


> **17-vibe-1016-43** to agent at 10:19:48 (57ms)
```JSON
undefined
```
```unhandledrejection
Error: Unhandled promise rejection
    at eval (eval at clientMainFunction (http://localhost:8302/:213:32), <anonymous>:4:16)
    at clientMainFunction (http://localhost:8302/:236:57)
```

----------------------------------------------------------------------
> Write code in a fenced JS block below to execute against this page.

