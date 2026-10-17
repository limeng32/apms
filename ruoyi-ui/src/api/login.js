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

// 发送短信验证码（scene: login=短信登录（匿名），bind=个人中心绑定新号（必须带登录 token），
// adminbind=部门管理员给目标用户代绑发码（必须带 token 且传 targetUserId）。
// 不设 isToken:false：未登录时本就无 token 可带；bind/adminbind 场景由拦截器自动附上 Authorization）
export function sendSmsCode(phonenumber, scene, sliderUuid, targetUserId) {
  const data = { phonenumber, scene, sliderUuid }
  if (targetUserId !== undefined && targetUserId !== null) {
    data.targetUserId = targetUserId
  }
  return request({
    url: '/sms/code',
    headers: {
      repeatSubmit: false
    },
    method: 'post',
    data
  })
}

// 短信验证码登录
// 返回两种形态：单账号 {token}；多账号 {selectToken, accounts:[...]}，需再调 smsLoginSelect
export function smsLogin(phonenumber, code) {
  return request({
    url: '/login/sms',
    headers: {
      isToken: false,
      repeatSubmit: false
    },
    method: 'post',
    data: { phonenumber, code }
  })
}

// 多账号短信登录：选择账号后凭一次性选择令牌兑换 token
export function smsLoginSelect(selectToken, userId) {
  return request({
    url: '/login/sms/select',
    headers: {
      isToken: false,
      repeatSubmit: false
    },
    method: 'post',
    data: { selectToken, userId }
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

// 获取彩色图形点选挑战（同时返回开关状态；关闭时仅返回 enabled=false）
export function getClickCaptcha() {
  return request({
    url: '/captcha/click',
    headers: { isToken: false },
    method: 'get',
    timeout: 20000
  })
}

// 校验图形点选结果：points 为按点击顺序回传的画布坐标 [{x,y},{x,y},{x,y}]
export function checkClickCaptcha(data) {
  return request({
    url: '/captcha/click/check',
    headers: { isToken: false, repeatSubmit: false },
    // silent：失败不弹全局通知，由验证组件在弹层内自行提示（全局通知会被遮罩盖住）
    silent: true,
    method: 'post',
    data
  })
}