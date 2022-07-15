import { TrackOpTypes } from './operations'

export let activeEffect: ReactiveEffect | undefined
export class ReactiveEffect<T = any> {
  active = true // effect 默认是激活状态
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

}

// 触发依赖
export function trigger() {

}