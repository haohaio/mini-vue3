import { activeEffect, trackEffects, triggerEffects } from './effect';
import { Dep, createDep } from './dep';

declare const RefSymbol: unique symbol

export interface Ref<T = any> {
  value: T
  [RefSymbol]: true
}

type RefBase<T> = {
  dep?: Dep
  value: T
}

export function trackRefValue(ref: RefBase<any>) {
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

export function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}