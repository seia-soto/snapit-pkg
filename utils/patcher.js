/**
 *
 * @param {string} payload The raw binary
 */
export const patch = (payload) => {
  const findHookingIndex = () => {
    const index = payload.indexOf(statics.prelude)

    if (index < 0) {
      throw new Error('Failed to find a valid hooking point!')
    }

    return index
  }

  const hookingIndex = findHookingIndex()
  const fragments = {
    pre: payload.slice(0, hookingIndex - 1),
    inject: statics.hook,
    post: payload.slice(hookingIndex + statics.prelude.length)
  }

  if (fragments.inject.length > statics.prelude.length) {
    // If the length of injectable script is longer than original script,
    // the binary will likely to fail to launch.
    throw new Error('The length of hook is longer than original script!')
  }

  if (fragments.inject.length < statics.prelude.length) {
    for (; fragments.inject.length <= statics.prelude.length;) {
      fragments.inject += ' '
    }
  }

  return fragments.pre + fragments.inject + fragments.post
}
