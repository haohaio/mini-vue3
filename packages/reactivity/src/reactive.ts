import { isObject } from '@vue/shared'
import { mutableHandlers } from "./baseHandlers";

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
}

export interface Target {
  [ReactiveFlags.IS_REACTIVE]?: boolean
}

export const reactiveMap = new WeakMap<Target, any>()

export function reactive(target: object) {
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