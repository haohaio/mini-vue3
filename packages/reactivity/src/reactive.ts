import { isObject, def, toRawType } from '@vue/shared'
import { mutableHandlers, shallowReactiveHandlers, readonlyHandlers, shallowReadonlyHandlers } from "./baseHandlers";
import type { RawSymbol } from './ref'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean,
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()


function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}
function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

export function reactive(target: any) {
  return createReactiveObject(target, false, mutableHandlers, reactiveMap)
}

export declare const ShallowReactiveMarker: unique symbol

export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }
export function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T> {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowReactiveMap
  )
}

export function readonly(target: any) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyMap
  )
}

export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyMap
  )
}

function createReactiveObject(target: Target, isReadonly: boolean, baseHandlers: ProxyHandler<any>, proxyMap: WeakMap<Target, any>) {
  if (!isObject(target)) {
    console.warn(`value cannot be made reactive: ${String(target)}`)
    return target
  }

  // 当 target 是一个 proxy 对象时，直接返回 target 即可
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }

  // 多次调用 reactive(target) 时，同一个 target 无需生成新的 proxy
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const targetType = getTargetType(target)
  // 可通过 markRaw（Object.property 定义 [ReactiveFlags.SKIP]） 或 （判断 Object.isExtensible）Object.preventExtensions（不能新增）、Object.seal（不能新增、删除） Object.freeze （不能新增、删除、修改）等标记对象不可被代理
  if (targetType === TargetType.INVALID) {
    return target
  }

  const proxy = new Proxy(target, baseHandlers)
  proxyMap.set(target, proxy)
  return proxy
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_SHALLOW])
}

export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

export function markRaw<T extends object>(
  value: T
): T & { [RawSymbol]?: true } {
  def(value, ReactiveFlags.SKIP, true)
  return value
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value