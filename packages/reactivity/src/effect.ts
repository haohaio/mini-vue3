import { createDep, Dep } from './dep'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { extend, isArray } from "@vue/shared";

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export type EffectScheduler = (...args: any[]) => any

export let activeEffect: ReactiveEffect | undefined
export class ReactiveEffect<T = any> {
  active = true // effect 默认是激活状态
  deps: Dep[] = []
  parent: ReactiveEffect | undefined = undefined
  private deferStop?: boolean

  // public: 相当于 this.fn = fn
  constructor(public fn: () => T, public scheduler: EffectScheduler | null = null,) {

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

      // 考虑到分支切换（v-if），执行 fn 前需要将之前收集到的依赖清空，然后重新收集依赖
      cleanupEffect(this)

      return this.fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupEffect(this)
      this.active = false
    }
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0, len = deps.length; i < len; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  const _effect = new ReactiveEffect(fn)
  if (options) {
    extend(_effect, options)
  }

  // 默认先执行一次
  if (!options || !options.lazy) {
    _effect.run()
  }

  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
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

export function trackEffects(dep: Dep) {
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

  // 遍历执行 effect.run 时，会先清空 deps，然后在添加 dep，故需要维护一个新数组，不然会死循环
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

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]

  for (const effect of effects) {
    triggerEffect(effect)
  }
}

function triggerEffect(effect: ReactiveEffect) {
  // 防止在 effect 中修改 state，无限递归
  if (effect !== activeEffect) {

    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}