# dsh-skill-digital-oracle

把 [digital-oracle](https://github.com/komako-workshop/digital-oracle) 技能包装成 DSH bundle 插件，
以 **bundled provider（rank 600）** 的方式注册，装一次即可在**所有工作区**使用，不再依赖
当前工作目录下的 `.dsh/skills/`。

## 它做了什么

一个 Cordis 插件（`lib/index.js`）向 `ctx.skills` 注册一个 provider：

| 字段 | 值 |
|---|---|
| 技能名 | `digital-oracle` |
| provider | `dsh-digital-oracle` |
| source | `bundled` |
| rank | `600`（与 `@deepseek-ai/dsh-skill` 的 `BUNDLED_SKILL_RANK` 相同） |
| resourceBase | `assets/digital-oracle`（目录），使正文里的 `references/`、`scripts/` 相对引用可解析 |

技能文件（`SKILL.md`、`references/`、`scripts/`、`digital_oracle/`、`tests/`）在上游 commit
`a63e4c19a2f3313d54914c44666febaf5ffb9d6f` 上原样 vendored 进 `assets/`，见
[PROVENANCE.md](PROVENANCE.md)。

## 安装

### 从 GitHub（推荐，跨机器可用）

在 **添加插件** 对话框里填：

```
github:Rudi-486/dsh-skill-digital-oracle
```

或让 Agent（创造模式，preset `cordis`）执行
`plugin_manager add github:Rudi-486/dsh-skill-digital-oracle`。

安装会做两件事：把包写进 profile 的 `dsh.profile.bundles`，并把本包的
`cordis.patch.yml` 叠加进 `cordis.yml`（新增一条 `id: skill-digital-oracle`）。

### 本地目录（开发用）

改本包源码后想让改动立刻生效，用 link 方式指向本目录：

```
plugin_manager add "link:<本包目录的绝对路径>"
```

> `link:` 前缀不能省：省掉的话同一串输入既像已装的 bundle 名、又像安装 spec，
> 宿主服务会以 `ambiguous-install` 拒绝。
> 手动用 GUI 的「添加插件」不需要创造模式；创造模式只是为了让 **Agent** 拿到
> `plugin_manager` 工具（标准模式下 `tool-plugin-manager` 是 `disabled: true`，
> Agent 没有 `plugin_manager`，也没有 `cordis_inspect_*`）。

## 验证

1. 新建任务（任意 preset），确认技能目录里出现 `digital-oracle`。
2. 检查 `~/.dsh/profiles/desktop/cordis.yml` 出现：
   ```yaml
   - id: skill-digital-oracle
     name: dsh-skill-digital-oracle
   ```
3. 让 Agent 调 `skill` 工具加载 `digital-oracle`，返回正文且末尾带
   `## Bundled resources (this plugin)` 段落，即为生效。

## 卸载

```
plugin_manager remove dsh-skill-digital-oracle
```

## 装完之后请删掉手工那份

若此前已手工装过 `.dsh/skills/digital-oracle` 或 `~/.dsh/skills/digital-oracle`，
那两份是**项目根 rank 100 / 用户根 rank 400**，优先级高于本插件的 600，会遮蔽插件版本。
两者同名不冲突（按 rank 取一个），但重复一份没有意义，建议删掉手工的那份。

## 已知代价

- **权限升级**：作为 skill 时它只是惰性文本；作为插件，`lib/index.js` 会在宿主进程里随启动加载。
  本插件的 Node 侧只有约 150 行、零第三方依赖、只读磁盘上自己的 `assets/`，不执行上游 Python 代码；
  但"插件"这个身份本身意味着第三方代码执行权。
- **上游跟踪靠手工**：上游没有 `package.json`，本包是外壳。更新上游要重新 vendored `assets/`，
  并同步 `lib/index.js` 里的 `DESCRIPTION`（该描述在编写期冻结以避免运行时解析 YAML）。
- **Python 运行时仍需自备**：13/15 provider 只用标准库；`YahooPriceProvider` 与 `YFinanceProvider`
  需要 `yfinance`。插件只负责让技能可见，不代管 Python 环境。

## 许可

上游技能内容为 MIT（Copyright (c) 2026 komako-workshop），随 `assets/digital-oracle/LICENSE` 保留。
