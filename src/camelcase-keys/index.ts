import camelCase from './camelcase';
import mapObject from './map-obj';
import QuickLRU from './quick-lru';
import { CamelCaseKeysOptions } from './types';

const has = (array: any, key: any) =>
	array.some((x: any) => {
		if (typeof x === 'string') {
			return x === key;
		}

		x.lastIndex = 0;
		return x.test(key);
	});

const cache = new QuickLRU({ maxSize: 1000 });

// Reproduces behavior from `map-obj`
const isObject = (value: any) =>
	typeof value === 'object' && value !== null && !(value instanceof RegExp) && !(value instanceof Error) && !(value instanceof Date);

const camelCaseConvert = (input: any, options: any) => {
	if (!isObject(input)) {
		return input;
	}

	options = {
		deep: false,
		pascalCase: false,
		...options
	};

	const { exclude, pascalCase, stopPaths, deep } = options;

	const stopPathsSet = new Set(stopPaths);

	const makeMapper = (parentPath: any) => (key: any, value: any) => {
		if (deep && isObject(value)) {
			const path = parentPath === undefined ? key : `${parentPath}.${key}`;

			if (!stopPathsSet.has(path)) {
				value = mapObject(value, makeMapper(path));
			}
		}

		if (!(exclude && has(exclude, key))) {
			const cacheKey = pascalCase ? `${key}_` : key;

			if (cache.has(cacheKey)) {
				key = cache.get(cacheKey);
			} else {
				const ret = camelCase(key, { pascalCase });

				if (key.length < 100) {
					// Prevent abuse
					cache.set(cacheKey, ret);
				}

				key = ret;
			}
		}

		return [key, value];
	};

	return mapObject(input, makeMapper(undefined));
};

export default function camelCaseKeys<T extends ReadonlyArray<{ [key: string]: any } | { [key: string]: any }>>(
	input: T,
	options?: CamelCaseKeysOptions
) {
	if (Array.isArray(input)) {
		const retornoArray = Object.keys(input).map((key: any) => camelCaseConvert(input[key], options));
		cache.clear();
		return retornoArray;
	}
	const retornoObject = camelCaseConvert(input, options);
	cache.clear();
	return retornoObject;
}
