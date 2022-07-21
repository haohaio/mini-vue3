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
  ITERATE_KEY,
  pauseTracking,
  resetTracking
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

const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {};

  // 设计到遍历的数组方法
  (['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any
      for (let i = 0, l = this.length; i < l; i++) {
        // 对组数下标进行依赖收集
        track(arr, TrackOpTypes.GET, i + '')
      }
      // 如果查找数组对象时查找不到，将查找对象转为原始值再查找一次
      const res = arr[key](...args)
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  });
  // 涉及到修改数组长度的方法，返回的是数组长度
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      // 暂停依赖收集
      pauseTracking()
      const res = (toRaw(this) as any)[key].apply(this, args)
      // 通过栈恢复之前的依赖收集状态
      resetTracking()
      return res
    }
  })
  return instrumentations
}

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

    const targetIsArray = isArray(target)

    // 还需对数组修改自身的5个方法（reverse 和 sort 无需处理）进行处理
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
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

// delete obj[name] / Reflect.deleteProperty(obj, name)
function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

// name in obj / Reflect.has(obj, name)
function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

// Reflect.ownKeys / Object.getOwnPropertyNames 和 Object.getOwnPropertySymbols 之和
function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
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