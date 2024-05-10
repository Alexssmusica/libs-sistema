export interface QuickLRUOptions {
	readonly onEviction?: Function;
	readonly maxAge?: number;
	/**
	The maximum number of items before evicting the least recently used items.
	*/
	readonly maxSize: number;
}

export interface CamelCaseKeysOptions {
	/**
	Recurse nested objects and objects in arrays.

	@default false
	*/
	readonly deep?: boolean;

	/**
	Exclude keys from being camel-cased.

	@default []
	*/
	readonly exclude?: ReadonlyArray<string | RegExp>;

	/**
	Exclude children at the given object paths in dot-notation from being camel-cased. For example, with an object like `{a: {b: '🦄'}}`, the object path to reach the unicorn is `'a.b'`.

	@default []

	@example
	```
	camelcaseKeys({
		a_b: 1,
		a_c: {
			c_d: 1,
			c_e: {
				e_f: 1
			}
		}
	}, {
		deep: true,
		stopPaths: [
			'a_c.c_e'
		]
	}),
	// {
	// 	aB: 1,
	// 	aC: {
	// 		cD: 1,
	// 		cE: {
	// 			e_f: 1
	// 		}
	// 	}
	// }
	```
	*/
	readonly stopPaths?: ReadonlyArray<string>;

	/**
	Uppercase the first character as in `bye-bye` → `ByeBye`.

	@default false
	*/
	readonly pascalCase?: boolean;
}
