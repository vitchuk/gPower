import { reactive } from 'vue'
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from './api.js'

export const auth = reactive({ user: null, ready: false })

export async function initAuth() {
  try {
    const { user } = await getMe()
    auth.user = user
  } catch {
    auth.user = null
  } finally {
    auth.ready = true
  }
}

export async function login(username, password) {
  const { user } = await apiLogin(username, password)
  auth.user = user
  return user
}

export async function register(username, password) {
  const { user } = await apiRegister(username, password)
  auth.user = user
  return user
}

export async function logout() {
  await apiLogout()
  auth.user = null
}
