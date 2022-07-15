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
  reactive,
  ReactiveFlags
} from './reactive'
import {
  activeEffect,
  track,
  trigger,
} from './effect'
import { isObject } from "@vue/shared";
import { TrackOpTypes } from './operations';

const get = createGetter()
const set = createSetter()

function createGetter() {
  return function get(target: object, key: string | symbol, receiver: object) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true
    }

    const res = Reflect.get(target, key, receiver)

    track(target, TrackOpTypes.GET, key)

    if (isObject(res)) {
      return reactive(res)
    }
    return res
  }
}
function createSetter() {
  return function set(target: object, key: string | symbol, value: unknown, receiver: object): boolean {
    const result = Reflect.set(target, key, value, receiver)
    return result
  }
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}