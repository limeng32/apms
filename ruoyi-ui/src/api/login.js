import request from '@/utils/request'

// 登录方法
export function login(username, password, code, uuid, sliderUuid) {
  const data = {
    username,
    password,
    code,
    uuid,
    sliderUuid
  }
  return request({
    url: '/login',
    headers: {
      isToken: false,
      repeatSubmit: false
    },
    method: 'post',
    data: data
  })
}

// 注册方法
export function register(data) {
  return request({
    url: '/register',
    headers: {
      isToken: false
    },
    method: 'post',
    data: data
  })
}

// 获取用户详细信息
export function getInfo() {
  return request({
    url: '/getInfo',
    method: 'get'
  })
}

// 退出方法
export function logout() {
  return request({
    url: '/logout',
    method: 'post'
  })
}

// 获取验证码
export function getCodeImg() {
  return request({
    url: '/captchaImage',
    headers: {
      isToken: false
    },
    method: 'get',
    timeout: 20000
  })
}

// 获取滑块拼图挑战（同时返回开关状态；关闭时仅返回 sliderEnabled=false）
export function getSliderCaptcha() {
  return request({
    url: '/captcha/slider',
    headers: { isToken: false },
    method: 'get',
    timeout: 20000
  })
}

// 校验滑块拖拽结果
export function checkSliderCaptcha(data) {
  return request({
    url: '/captcha/slider/check',
    headers: { isToken: false, repeatSubmit: false },
    method: 'post',
    data
  })
}