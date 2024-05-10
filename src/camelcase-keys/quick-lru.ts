import { QuickLRUOptions } from './types';

export default class QuickLRU<KeyType extends unknown, ValueType extends unknown> extends Map implements Iterable<[KeyType, ValueType]> {
	#size = 0;
	#cache = new Map();
	#oldCache = new Map();
	#maxSize: number;
	#maxAge: number;
	#onEviction;

	constructor(options = {} as QuickLRUOptions) {
		super();
		if (!(options.maxSize && options.maxSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}
		if (typeof options.maxAge === 'number' && options.maxAge === 0) {
			throw new TypeError('`maxAge` must be a number greater than 0');
		}
		this.#maxSize = options.maxSize;
		this.#maxAge = options.maxAge || Number.POSITIVE_INFINITY;
		this.#onEviction = options.onEviction;
	}

	// For tests.
	get __oldCache() {
		return this.#oldCache;
	}

	#emitEvictions(cache: any) {
		if (typeof this.#onEviction !== 'function') {
			return;
		}

		for (const [key, item] of cache) {
			this.#onEviction(key, item.value);
		}
	}

	#deleteIfExpired(key: KeyType, item: any) {
		if (typeof item.expiry === 'number' && item.expiry <= Date.now()) {
			if (typeof this.#onEviction === 'function') {
				this.#onEviction(key, item.value);
			}

			return this.delete(key);
		}

		return false;
	}

	#getOrDeleteIfExpired(key: KeyType, item: any) {
		const deleted = this.#deleteIfExpired(key, item);
		if (deleted === false) {
			return item.value;
		}
	}

	#getItemValue(key: KeyType, item: any) {
		return item.expiry ? this.#getOrDeleteIfExpired(key, item) : item.value;
	}

	#peek(key: KeyType, cache: Map<KeyType, ValueType>) {
		const item = cache.get(key);

		return this.#getItemValue(key, item);
	}

	#set(key: KeyType, value: ValueType) {
		this.#cache.set(key, value);
		this.#size++;

		if (this.#size >= this.#maxSize) {
			this.#size = 0;
			this.#emitEvictions(this.#oldCache);
			this.#oldCache = this.#cache;
			this.#cache = new Map();
		}
	}

	#moveToRecent(key: KeyType, item: any) {
		this.#oldCache.delete(key);
		this.#set(key, item);
	}

	*#entriesAscending() {
		for (const item of this.#oldCache) {
			const [key, value] = item;
			if (!this.#cache.has(key)) {
				const deleted = this.#deleteIfExpired(key, value);
				if (deleted === false) {
					yield item;
				}
			}
		}

		for (const item of this.#cache) {
			const [key, value] = item;
			const deleted = this.#deleteIfExpired(key, value);
			if (deleted === false) {
				yield item;
			}
		}
	}

	get(key: KeyType): ValueType | undefined {
		if (this.#cache.has(key)) {
			const item = this.#cache.get(key);
			return this.#getItemValue(key, item);
		}

		if (this.#oldCache.has(key)) {
			const item = this.#oldCache.get(key);
			if (this.#deleteIfExpired(key, item) === false) {
				this.#moveToRecent(key, item);
				return item.value;
			}
		}
	}

	set(key: KeyType, value: ValueType, { maxAge = this.#maxAge } = {}): this {
		const expiry = typeof maxAge === 'number' && maxAge !== Number.POSITIVE_INFINITY ? Date.now() + maxAge : undefined;

		if (this.#cache.has(key)) {
			this.#cache.set(key, {
				value,
				expiry
			});
		} else {
			this.#set(key, { value, expiry } as ValueType);
		}

		return this;
	}

	has(key: KeyType): boolean {
		if (this.#cache.has(key)) {
			return !this.#deleteIfExpired(key, this.#cache.get(key));
		}

		if (this.#oldCache.has(key)) {
			return !this.#deleteIfExpired(key, this.#oldCache.get(key));
		}

		return false;
	}

	peek(key: KeyType): ValueType | undefined {
		if (this.#cache.has(key)) {
			return this.#peek(key, this.#cache);
		}

		if (this.#oldCache.has(key)) {
			return this.#peek(key, this.#oldCache);
		}
	}

	delete(key: KeyType): boolean {
		const deleted = this.#cache.delete(key);
		if (deleted) {
			this.#size--;
		}

		return this.#oldCache.delete(key) || deleted;
	}

	clear(): void {
		this.#cache.clear();
		this.#oldCache.clear();
		this.#size = 0;
	}

	resize(newSize: number) {
		if (!(newSize && newSize > 0)) {
			throw new TypeError('`maxSize` must be a number greater than 0');
		}

		const items = [...this.#entriesAscending()];
		const removeCount = items.length - newSize;
		if (removeCount < 0) {
			this.#cache = new Map(items);
			this.#oldCache = new Map();
			this.#size = items.length;
		} else {
			if (removeCount > 0) {
				this.#emitEvictions(items.slice(0, removeCount));
			}

			this.#oldCache = new Map(items.slice(removeCount));
			this.#cache = new Map();
			this.#size = 0;
		}

		this.#maxSize = newSize;
	}

	*keys(): IterableIterator<KeyType> {
		for (const [key] of this) {
			yield key;
		}
	}

	*values(): IterableIterator<ValueType> {
		for (const [, value] of this) {
			yield value;
		}
	}

	*[Symbol.iterator](): IterableIterator<[KeyType, ValueType]> {
		for (const item of this.#cache) {
			const [key, value] = item;
			const deleted = this.#deleteIfExpired(key, value);
			if (deleted === false) {
				yield [key, value.value];
			}
		}

		for (const item of this.#oldCache) {
			const [key, value] = item;
			if (!this.#cache.has(key)) {
				const deleted = this.#deleteIfExpired(key, value);
				if (deleted === false) {
					yield [key, value.value];
				}
			}
		}
	}

	*entriesDescending() {
		let items = [...this.#cache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i];
			const [key, value] = item;
			const deleted = this.#deleteIfExpired(key, value);
			if (deleted === false) {
				yield [key, value.value];
			}
		}

		items = [...this.#oldCache];
		for (let i = items.length - 1; i >= 0; --i) {
			const item = items[i];
			const [key, value] = item;
			if (!this.#cache.has(key)) {
				const deleted = this.#deleteIfExpired(key, value);
				if (deleted === false) {
					yield [key, value.value];
				}
			}
		}
	}

	*entriesAscending(): any {
		for (const [key, value] of this.#entriesAscending()) {
			yield [key, value.value];
		}
	}

	get size() {
		if (!this.#size) {
			return this.#oldCache.size;
		}

		let oldCacheSize = 0;
		for (const key of this.#oldCache.keys()) {
			if (!this.#cache.has(key)) {
				oldCacheSize++;
			}
		}

		return Math.min(this.#size + oldCacheSize, this.#maxSize);
	}

	get maxSize() {
		return this.#maxSize;
	}

	entries() {
		return this.entriesAscending();
	}

	forEach(callbackFunction: Function, thisArgument = this) {
		for (const [key, value] of this.entriesAscending()) {
			callbackFunction.call(thisArgument, value, key, this);
		}
	}

	get [Symbol.toStringTag]() {
		return JSON.stringify([...this.entriesAscending()]);
	}
}
