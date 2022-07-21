export { makeMap } from './makeMap'

export const extend = Object.assign

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
export const isObject = (value: unknown) => {
  return value !== null && typeof value === 'object'
}
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]'
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]'
export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === '[object Object]'

const hasOwnProperty = Object.prototype.hasOwnProperty

export const hasOwn = (val: object, key: string | symbol): key is keyof typeof val => hasOwnProperty.call(val, key)

export const isArray = Array.isArray

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

// Object.is() 与 === 区别： 会区分 +0 和 -0（但是 BigInt 类型的 0n 和 -0n 会判断为 true），可判断 NaN 是否相等
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)

export const NOOP = () => { }

export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  })
}

export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}