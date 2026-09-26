#!/usr/bin/env python3
# 把 bash 脚本中的裸变量引用 $VAR / $1 / $? 等统一改为 ${VAR} 形式。
# 严格不动的区域：单引号字符串（含 "$(awk '{print $1}')" 这种外层双引号内命令替换
# 里的单引号——$() 会开启全新的引号解析层级）、引号 heredoc（<<'EOF' 正文）、
# 已加花括号的 ${...}、$() / $(( )) 定界符、转义 \$、$'...' / $"..." 前缀。
# 无引号 heredoc 正文按「引号无语义」规则转换。
import re
import sys

VAR_RE = re.compile(r'^\$([A-Za-z_][A-Za-z0-9_]*|[0-9@#?*!$])')
HD_RE = re.compile(r"(?<!<)<<-?\s*(['\"]?)([A-Za-z_]\w*)\1")


def scan(line, heredoc_body=False):
    """扫描一行，返回 (转换结果, 单引号生效的字符位置集合)。"""
    # 引号状态栈：$ ( 开启全新层级（重置 sq/dq），普通 ( 复制当前层级，) 弹栈
    frames = [[False, False]]
    sq_pos = set()
    out = []
    i = 0
    while i < len(line):
        sq, dq = frames[-1]
        c = line[i]
        if c == '\\' and i + 1 < len(line):
            out.append(line[i:i + 2])
            i += 2
            continue
        if not heredoc_body:
            if c == '$' and line.startswith('$(', i):
                out.append('$(')
                frames.append([False, False])
                i += 2
                continue
            if c == '(' and not sq and not dq:
                out.append(c)
                frames.append([sq, dq])
                i += 1
                continue
            if c == ')' and not sq and not dq and len(frames) > 1:
                out.append(c)
                frames.pop()
                i += 1
                continue
            if c == "'" and not dq:
                frames[-1][0] = not sq
                out.append(c)
                i += 1
                continue
            if c == '"' and not sq:
                frames[-1][1] = not dq
                out.append(c)
                i += 1
                continue
        if c == '$' and not sq:
            if line.startswith('${', i):
                j = line.find('}', i + 2)
                j = len(line) if j == -1 else j + 1
                out.append(line[i:j])
                i = j
                continue
            if line.startswith("$'", i) or line.startswith('$"', i):
                out.append(c)
                i += 1
                continue
            m = VAR_RE.match(line[i:])
            if m and not (line.startswith('$(', i)):
                out.append('${' + m.group(1) + '}')
                i += 1 + len(m.group(1))
                continue
        if sq:
            sq_pos.add(i)
        out.append(c)
        i += 1
    return ''.join(out), sq_pos


def transform(text):
    result = []
    lines = text.splitlines(keepends=True)
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        nl = '\n' if line.endswith('\n') else ''
        body = line[:-1] if nl else line
        converted, sq_pos = scan(body)
        result.append(converted + nl)
        # 检测本行是否开启 heredoc：只要 << 操作符本身不在单引号区域即成立
        pending = None
        for m in HD_RE.finditer(body):
            if m.start() in sq_pos or m.start() + 1 in sq_pos:
                continue
            is_strip = body[m.start():m.start() + 3] == '<<-'
            pending = (m.group(1), m.group(2), is_strip)
            break
        idx += 1
        if pending:
            quote, word, strip = pending
            while idx < len(lines):
                raw = lines[idx]
                raw_body = raw[:-1] if raw.endswith('\n') else raw
                check = raw_body.lstrip('\t') if strip else raw_body.strip()
                if check == word:
                    result.append(raw)
                    idx += 1
                    break
                if quote:
                    result.append(raw)  # 引号 heredoc：正文逐字保留
                else:
                    rnl = '\n' if raw.endswith('\n') else ''
                    conv_body, _ = scan(raw_body, heredoc_body=True)
                    result.append(conv_body + rnl)
                idx += 1
    return ''.join(result)


for path in sys.argv[1:]:
    with open(path, encoding='utf-8') as f:
        src = f.read()
    dst = transform(src)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(dst)
    print(f'converted: {path}')
