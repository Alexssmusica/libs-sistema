import camelCase from './camelcase';
import mapObject from './map-obj';
import QuickLRU from './quick-lru';

const has = (array, key) =>
	array.some((x) => {
		if (typeof x === 'string') {
			return x === key;
		}

		x.lastIndex = 0;
		return x.test(key);
	});

const cache = new QuickLRU({ maxSize: 10000 });

// Reproduces behavior from `map-obj`
const isObject = (value) =>
	typeof value === 'object' && value !== null && !(value instanceof RegExp) && !(value instanceof Error) && !(value instanceof Date);

const camelCaseConvert = (input, options) => {
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

	const makeMapper = (parentPath) => (key, value) => {
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

export default (input, options?) => {
	try {
		if (Array.isArray(input)) {
			return Object.keys(input).map((key) => camelCaseConvert(input[key], options));
		}
		return camelCaseConvert(input, options);
	} catch (error) {
		throw new Error(error);
	} finally {
		cache.clear();
	}
};
