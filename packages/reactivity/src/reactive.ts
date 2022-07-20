import { isObject } from '@vue/shared'
import { mutableHandlers } from "./baseHandlers";
import { Ref } from './ref';

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.IS_REACTIVE]?: boolean,
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()

export function reactive(target: any) {
  return createReactiveObject(target, mutableHandlers, reactiveMap)
}

function createReactiveObject(target: Target, baseHandlers: ProxyHandler<any>, proxyMap: WeakMap<Target, any>) {
  if (!isObject(target)) {
    console.warn(`value cannot be made reactive: ${String(target)}`)
    return target
  }

  // 当 target 是一个 proxy 对象时，直接返回 target 即可
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target
  }

  // 多次调用 reactive(target) 时，同一个 target 无需生成新的 proxy
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(target, baseHandlers)
  proxyMap.set(target, proxy)
  return proxy
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value