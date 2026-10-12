# 来源与改动

## 上游

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/komako-workshop/digital-oracle |
| commit | `a63e4c19a2f3313d54914c44666febaf5ffb9d6f` |
| 许可 | MIT，Copyright (c) 2026 komako-workshop |

## 本包如何得到上游文件

上游仓库没有 `package.json`，因此不能按 DSH 插件直接安装。取文件的过程：

1. 宿主的 plugin manager 曾执行 `pnpm add github:komako-workshop/digital-oracle`，
   把该 commit 的 tarball（`codeload.github.com`）下载并通过 pnpm 完整性校验，
   落在 `~/.dsh/profiles/desktop/node_modules/digital-oracle`；
   随后因该包不是合法 bundle 而回滚登记，文件留在磁盘上。
2. 本工作区的网络受文件沙箱限制，`git clone` 与 `curl` 都以
   `schannel: SEC_E_NO_CREDENTIALS` 失败，因此改用上述**同一 commit 的
   pnpm 校验副本**作为文件来源。
3. 该副本被复制到 `.dsh/skills/digital-oracle`，再复制为本包的
   `assets/digital-oracle/`。两份内容一致。

## 相对上游的改动

- 删除了 pnpm 生成的占位文件 `package.json`
  （内容仅 `{"_pnpmPlaceholder":"..."}`，上游仓库并不存在此文件）。
- 未改动任何其他上游文件：`SKILL.md`、`README.md`、`README.en.md`、`ITERATION_PLAN.md`、
  `LICENSE`、`references/`、`scripts/`、`tests/`、`digital_oracle/` 均为原样。

## 本包新增的内容

| 文件 | 说明 |
|---|---|
| `package.json` | 外壳包元数据，声明 `dsh.bundle.patch` |
| `cordis.patch.yml` | 挂载声明，向 profile 配置树插入一条 entry |
| `lib/index.js` | Cordis 插件：向 `ctx.skills` 注册 bundled provider（rank 600），加载时剥掉 frontmatter 并追加一段注解 |
| `README.md` | 安装、验证、卸载与代价说明 |

`lib/index.js` 中 `DESCRIPTION` 常量的文字**逐字取自** `assets/digital-oracle/SKILL.md`
的 frontmatter `description`。它在编写期冻结，是为了让插件不依赖运行时 YAML 解析
（从而不引入任何第三方依赖）；`smoke.mjs` 会校验两者一致。
