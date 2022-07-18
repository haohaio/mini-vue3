import { createDep, Dep } from './dep'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { isArray } from "@vue/shared";

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let activeEffect: ReactiveEffect | undefined
export class ReactiveEffect<T = any> {
  active = true // effect 默认是激活状态
  deps: Dep[] = []
  parent: ReactiveEffect | undefined = undefined

  // public: 相当于 this.fn = fn
  constructor(public fn: () => T) {

  }

  run() {
    // 非激活的状态下，不需要进行依赖收集，直接执行函数即可
    if (!this.active) {
      return this.fn()
    }

    // 收集依赖
    try {
      // 处理 effect 嵌套问题
      this.parent = activeEffect
      activeEffect = this

      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined

      this.stop()
    }
  }

  stop() {
    this.active = false
  }
}


export function effect<T = any>(fn: () => T) {
  const _effect = new ReactiveEffect(fn)

  // 默认先执行一次
  _effect.run()
}

// 收集依赖
export function track(target: object, type: TrackOpTypes, key: string | symbol) {
  if (activeEffect) {
    let depsMap = targetMap.get(target)

    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    trackEffects(dep)
  }
}

function trackEffects(dep: Dep) {
  let shouldTrack = !dep.has(activeEffect!)

  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}

// 触发依赖
export function trigger(target: object, type: TriggerOpTypes, key?: unknown, newValue?: unknown, oldValue?: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  let deps: (Dep | undefined)[] = []

  // void 0 表示 undefined，因为 undefined 有被修改的可能性，但是 void 0 返回值一定是 undefined，并且 void 0 比 undefined 字符所占空间少。
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }
  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }

    triggerEffects(createDep(effects))
  }
}

function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]

  for (const effect of effects) {
    triggerEffect(effect)
  }
}

function triggerEffect(effect: ReactiveEffect) {
  effect.run()
}