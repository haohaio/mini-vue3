import { ReactiveEffect } from './effect'
import { isReactive } from './reactive'
import { isRef } from './ref'
import { isObject, NOOP, isArray, isFunction, isSet, isMap, isPlainObject } from '@vue/shared'

export interface WatchOptionsBase {
  flush?: 'pre' | 'post' | 'sync'
}

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup // 并发处理
) => any

type OnCleanup = (cleanupFn: () => void) => void

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
}

export function watch(source: any, cb: any, options: WatchOptions) {
  doWatch(source, cb, options)
}

// 当 source 为一个 proxy 时，由于 source 为引用数据类型，此时 newValue 和 oldValue 是一样的
// 当 source 为一个函数时，可以用来监控普通值，此时 newValue 和 oldValue 会有区别
function doWatch(source: any, cb: WatchCallback | null, { immediate, deep, flush }: WatchOptions = {}) {
  let getter: () => any

  if (isRef(source)) {
    getter = () => source.value
  } else if (isReactive(source)) {
    getter = () => source
    deep = true
  } else if (isFunction(source)) {
    getter = source
  } else {
    getter = NOOP
  }

  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = fn
  }

  let oldValue = {}
  const job = () => {
    if (cb) {
      // 执行调度器函数时，先指向上一个调度器函数的的 cleanup 函数
      if (cleanup) {
        cleanup()
      }

      const newValue = effect.run()
      cb(newValue, oldValue, onCleanup)
      oldValue = newValue
    } else {
      effect.run()
    }
  }

  const effect = new ReactiveEffect(getter, job)

  if (immediate) {
    job()
  } else {
    oldValue = effect.run()
  }
}

export function traverse(value: unknown, seen?: Set<unknown>) {
  if (!isObject(value)) {
    return value
  }

  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }

  seen.add(value)

  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse((value as any)[key], seen)
    }
  }
  return value
}