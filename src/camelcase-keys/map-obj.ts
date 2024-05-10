const isObject = (value: any) => typeof value === 'object' && value !== null;

// Customized for this use-case
const isObjectCustom = (value: any) =>
	isObject(value) &&
	!(value instanceof RegExp) &&
	!(value instanceof Error) &&
	!(value instanceof Date) &&
	!(globalThis.Blob && value instanceof globalThis.Blob);

export const mapObjectSkip: unique symbol = Symbol('mapObjectSkip');
const _mapObject = (object: any, mapper: any, options: any, isSeen = new WeakMap()) => {
	options = {
		deep: false,
		target: {},
		...options
	};
	if (isSeen.has(object)) {
		return isSeen.get(object);
	}
	isSeen.set(object, options.target);
	const { target } = options;
	delete options.target;
	const mapArray = (array: any) => array.map((element: any) => (isObjectCustom(element) ? _mapObject(element, mapper, options, isSeen) : element));
	if (Array.isArray(object)) {
		return mapArray(object);
	}

	for (const [key, value] of Object.entries(object)) {
		const mapResult = mapper(key, value, object);
		if (mapResult === mapObjectSkip) {
			continue;
		}
		// eslint-disable-next-line prefer-const
		let [newKey, newValue, { shouldRecurse = true } = {}] = mapResult;
		// Drop `__proto__` keys.
		if (newKey === '__proto__') {
			continue;
		}
		if (options.deep && shouldRecurse && isObjectCustom(newValue)) {
			newValue = Array.isArray(newValue) ? mapArray(newValue) : _mapObject(newValue, mapper, options, isSeen);
		}
		target[newKey] = newValue;
	}

	return target;
};

export default function mapObject(object: any, mapper: any, options?: any) {
	if (!isObject(object)) {
		throw new TypeError(`Expected an object, got \`${object}\` (${typeof object})`);
	}
	if (Array.isArray(object)) {
		throw new TypeError('Expected an object, got an array');
	}
	return _mapObject(object, mapper, options);
}
