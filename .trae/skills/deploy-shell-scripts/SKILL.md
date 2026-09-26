---
name: deploy-shell-scripts
description: APMS 部署脚本与 SQL 补丁编写规范。用户要求修改/新增 deploy 目录 shell(bash) 脚本、ry.sh、patches 补丁，或排查部署脚本报错（unbound variable、SQL 补丁、Redis 发版清理）时使用。不用于业务 Java/Vue 开发。
---

# APMS 部署脚本与补丁规范

适用文件：`deploy/deploy.sh`（生产）、`deploy/deploy-uat.sh`（本机 UAT）、`deploy/build.sh`、`ry.sh`、以及未来新增的任何 `.sh` 与 `patches/*.sql`。

## 1. 铁律：变量引用一律 `${name}`，禁止裸 `$name`

- 所有变量、位置参数、特殊参数都必须带花括号：
  - `${REDIS_DB}`、`${1}`、`${@}`、`${?}`、`${#}`、`${!}`、`${0}`；默认值/数组同理：`${x:-d}`、`${arr[${i}]}`（嵌套也不能裸）。
  - 例外（保持原样）：命令替换 `$(...)`、算术 `$((...))`、ANSI-C `$'...'`。
- 原因（真实事故 2026-09-26）：`set -u` 下写 `"Redis DB $REDIS_DB（保留...）"`，变量名后紧跟中文全角括号（UTF-8 首字节 0xEF）。UTF-8 locale 下 bash 能识别边界，但部署在 C/POSIX locale（或 SSH 非交互环境）时，非 ASCII 首字节被并入变量名 → `REDIS_DB\xef: unbound variable`，且部署在「已停服、替换产物前」中断。`${}` 显式界定，与后续字符无关。
- 规则衍生：**日志/提示语中变量后只要紧跟标点或中文，必须 `${}`**；不要指望 locale。
- 同源陷阱（真实事故 2026-09-26，UAT 部署 Step 2 备份连续失败，只留 20 字节空 gzip）：macOS 自带 `/bin/bash` 是 **3.2.57**，`set -u` 下**无参调用函数**时，函数体里的 `"${@}"` 会报 `@: unbound variable`（bash 4.4 才修复）。当时 `mysql_dump() { ... "${@}"; }` 备份时无参调用 → mysqldump 根本没启动，且 stderr 被 `2>/dev/null` 吞掉。
  - 正确写法：透传函数参数一律用 `${1+"${@}"}`（无参展开为零个参数，有参时各参数独立且保引号；**不要**写 `"${@:-}"`，无参会变成一个空串参数，mysql 会当成空库名报错）。
  - 注意 `mysql_cli < file` 这种**无参 + stdin 重定向**调用同样会踩中。
  - 定位手段：管道命令不要 `2>/dev/null` 吞 stderr；备份写临时文件 + `gzip -t` + 解压体积 ≥10KB 校验 + 原子改名 + 失败重试 3 次（两脚本 Step 2 已实现，照搬即可）。用 `/bin/bash`（不是 PATH 里可能更新的 bash）复现验证。
- 批量改造存量脚本：使用 `scripts/brace-vars.py <file...>`（引号/here-doc 感知，已验证于本仓 4 个脚本）。它**不会**动：
  - 单引号内内容（awk/sed 程序，如 `awk '{print $1}'`）；注意 `"$(... awk '$1' ...)"` 中外层双引号不影响 `$()` 内部新开的引号层级，awk 的 `$1` 仍须保留；
  - 引号 here-doc 正文（`<<'STARTSH'`/`<<'EOSQL'`，里面是逐字生成的脚本/SQL）；
  - 已加花括号的 `${...}`、`\$` 转义。
  - 它**会**转换无引号 here-doc 正文（如 `cat > env.conf <<EOF` 里的 `$JAVA_BIN`）。
  - `${...}` 体内的嵌套裸引用（如 `${BINDIR:-$X}`、`${arr[$k]}`）需手工补，跑完脚本用下面的审计方法复查。
- 改动后必做：
  1. `bash -n <file>` 语法检查；
  2. 在 C locale 下验证含变量+中文的行：`LANG=C LC_ALL=C bash -c 'set -u; ...'`；
  3. 抽查 awk/字面 here-doc 与改动前逐字节一致（`sed -n "/<<'X'/,/^X$/p"` 对比）；
  4. 活代码区裸引用审计：用 `scripts/brace-vars.py` 的 `scan()` 同源逻辑（引号状态栈）grep，单引号/引号 here-doc 内除外，结果必须为 0。

## 2. SQL 补丁规范（patches/）

- 命名 `patch-<apms.version>-<MMDDHHMMSS>.sql`，首行为 `--` 注释标题；部署脚本按 `apms_db_version.patch_name` 去重自动应用（生产/UAT 同一补丁链，`.uat/patches/` 由部署时从 repo 拷贝）。
- 必须幂等可重复执行：
  - MySQL 8 无 `ADD COLUMN IF NOT EXISTS`：先查 `information_schema.COLUMNS` 置 `@x`，再 `PREPARE/EXECUTE` 守卫式 ALTER（参考 patch-0.0.4-2609261555.sql）；
  - UPDATE 带旧值/主键守卫，不覆盖后续人工数据；INSERT 用 `INSERT IGNORE` 或显式列名；
  - 补丁文件放 repo `patches/`；紧急热修可先在目标库手工执行，再按 `sha256sum` 登记 `apms_db_version`（applied_by 记 `manual-hotfix`），避免下次部署重复执行。
- DDL 变更（如新列）只放补丁，**不要**只写在 `.trae/sql/` 注释里——dev 手工建过、UAT 不会有，曾因此导致 `Unknown column 'd.dept_type'`（全库 information_schema 比对可确认缺口范围）。
- 执行前确认部署脚本有 mysqldump 备份步骤；手工热修也要先 dump 涉及表到 `.uat/backup/manual_*/`。

## 3. 部署脚本结构约定（改动时不要破坏）

- `set -euo pipefail`；密码含 `!#$` 等特殊字符，统一走 `mysql_cli()` 函数传参，禁止裸写。
- env.conf 敏感变量缺失即 hard fail，禁止 fallback 到默认密码。
- 发版清缓存：版本号变化时**选择性清理** Redis（`flush_redis_keep "login_tokens:"`，SCAN→分批 DEL，失败零变更），**禁止恢复 FLUSHDB**——发版不踢在线用户。副作用须知晓：在线用户 login_token 内缓存的是旧权限集合，改了菜单/角色权限需在「在线用户」踢出或等其重登。
- 回滚靠 backup 目录旧产物；新增 Step 失败路径必须考虑「已停服」窗口，脚本错误应在停服前暴露（语法、变量未绑定都要本地先验）。
- 在 IDE agent 的 sandbox 内执行部署：前台命令结束后 nohup 的 Java 会被进程组回收（health 200 后随即退出，日志无异常）。验证持久运行需用户在自己的终端执行 `bash deploy/deploy-uat.sh start`；agent 只能做接口级瞬时验证。
