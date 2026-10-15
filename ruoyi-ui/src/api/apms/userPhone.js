import request from '@/utils/request'

// 我的登录手机号列表
export function listMyPhones() {
  return request({
    url: '/system/user/profile/phone/list',
    method: 'get'
  })
}

// 绑定新手机号（新手机号先通过 sendSmsCode(phone,'bind') 收码）
export function bindMyPhone(phonenumber, code) {
  return request({
    url: '/system/user/profile/phone/bind',
    method: 'post',
    data: { phonenumber, code }
  })
}

// 本人解绑
export function unbindMyPhone(id) {
  return request({
    url: '/system/user/profile/phone/unbind/' + id,
    method: 'delete'
  })
}

// 管理员：查看指定账号的绑定号码
export function listUserPhones(userId) {
  return request({
    url: '/system/user/phone/list/' + userId,
    method: 'get'
  })
}

// 管理员：强制解绑
export function adminUnbindPhone(id) {
  return request({
    url: '/system/user/phone/unbind/' + id,
    method: 'delete'
  })
}
