dataflo.ws task is a flow building block.

Tasks are described using configuration, which includes code reference to run,
input parameters, output parameter and meta.

### Example

```json
"tasks": [{
	"$promise": "fetchDBRecordById",
	"$args": {
		"id": "123"
	},
	"$set": "record",
	"$setOnEmpty": "noRecord"
}, {
	"task": "urlData",
	"if": "{$noRecord}",
	"url": "http://apiserver/db-records/123",
	"$set": "recordDataResponse"
}, {
	"$function": "JSON.parse",
	"$args": "{$recordDataResponse.data}",
	"$set": "recordData"
}, {
	"$promise": "insertDBRecord",
	"$args": {
		"id": "{$recordData.id}",
		"name": "{$recordData.name}"
	},
	"$set": "record"
}, {
	"$function": "console.log",
	"$args": "{$record}"
}]
```

### Variables

As you may noticed, there is some magic values within strings.
Main purpose of those magic values is task requirements declaration
and dataflow description. You can read it like:

```
recordDataResponse.data is a parameter of JSON.parse
urlData provides recordDataResponse
we need to launch JSON.parse after urlData is completed and recordDataResponse.data is true value
```

In the current stage we have only two expansions: true value (`{$key}`) and any value (`{*key}`);

### Task code

Task code reference can be:

1. function with immediate return value — synchronous, keys: `fn`, `$function`;
2. function with node-styled callback (errback) — asynchronous, keys: `errback`, `$errback`;
3. promise — asynchronous, keys: `promise`, `$promise`;
4. task class — asynchronous, `task`, `$class`, TODO: take a look into [TASKCLASS](TASKCLASS.md).
5. TODO: special case — every task;
5. TODO: special case — flow task;

Functions and promises is looked up in `require.main.exports`, tasks is a regular node modules
and usually lies within `node_modules/task` directory.

### Task requirements

Task requirements need to be fulfilled before task launch. Those requirements can be
input task parameters or just values in task configuration. Task will not receive second ones,
they're only evaluated at task launch stage. `urlData` task won't launch unless
key `{$noRecord}` is not set.

### Input parameters

Input parameters for tasks is defined by $args key. If value for that key
is object, string, boolean or number then object will be the first parameter of function arguments.
If $args is array, array items became function arguments

### Output parameters

When task return value, this value can be omited or used in flow data. You can:

1. Write value to the key in flow data when task succeeds with `$set`;
1. Merge returned object with key in flow data when task succeeds with `$mergeWith`;
1. Write value to the key in flow data when task succeeds, but don't provided a true value with `$setOnEmpty` (bad key name, I know);
1. Write value to the key in flow data when task fails, with `$setOnFail`;

Key name must be a plain string, not the expansion.

