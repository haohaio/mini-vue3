/** 
 * 为什么要使用 Reflect ?
 * 
 * this 指向问题
 * 
 * const target ={
 *   name: '小火花',
 *   get alias() {
 *     return this.name 
 *   }
 * }
 * 
 * const proxy = new Proxy(target, {
 *   get(target, key) {
 *     return target[key]
 *   }
 * })
 * 
 * proxy.alias
 * 
 * 当不通过 Reflect.get 取值时，获取 this.name 时，不会通过 proxy 对象去获取 name，而是通过 target 去获取 name
 */

import {
  readonly,
  reactive,
  ReactiveFlags,
  reactiveMap,
  isReadonly,
  isShallow,
  toRaw
} from './reactive'
import {
  track,
  trigger,
} from './effect'
import { isObject, isArray, isIntegerKey, hasOwn, hasChanged, extend, isSymbol, makeMap } from "@vue/shared";
import { TrackOpTypes, TriggerOpTypes } from './operations';
import { isRef } from './ref'

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)
const builtInSymbols = new Set(
  /*#__PURE__*/
  Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)


const get = createGetter()
const shallowGet = createGetter(false, true)
const readonlyGet = createGetter(true, false)
const shallowReadonlyGet = createGetter(true, true)

function createGetter(isReadonly = false, shallow = false) {
  return function get(target: object, key: string | symbol, receiver: object) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow
    } else if (
      key === ReactiveFlags.RAW &&
      receiver === reactiveMap.get(target)
    ) {
      return target
    }

    const res = Reflect.get(target, key, receiver)

    // 在对 target 进行一些类型判断时，无需对这些 key 进行依赖收集
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }

    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    if (shallow) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    if (isObject(res)) {
      return reactive(res)
    }
    return res
  }
}

const set = createSetter()
const shallowSet = createSetter(true)

function createSetter(shallow = false) {
  return function set(target: object, key: string | symbol, value: unknown, receiver: object): boolean {
    let oldValue = (target as any)[key]

    if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
      return false
    }
    if (!shallow && !isReadonly(value)) {
      if (!isShallow(value)) {
        value = toRaw(value)
        oldValue = toRaw(oldValue)
      }
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
    }

    const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key)

    const result = Reflect.set(target, key, value, receiver)
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }

    return result
  }
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}

export const shallowReactiveHandlers = /*#__PURE__*/ extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    return true
  },
  deleteProperty(target, key) {
    return true
  }
}

export const shallowReadonlyHandlers = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)