/**
 * dsh-skill-digital-oracle —— 把 digital-oracle 技能作为 DSH bundle 分发。
 *
 * 契约与 DSH 第一方 skill 包 `@deepseek-ai/dsh-skill-office` 一致：本包是一个
 * Cordis 插件，向 `ctx.skills` 注册一个 bundled provider（rank 600），候选条目
 * 携带 `resourceBase` 目录，使 skill 正文里的相对引用（references/、scripts/）
 * 能按技能目录解析。
 *
 * 设计约束：**零第三方依赖、零 `@deepseek-ai/*` 导入**，只用 `node:` 内置模块。
 * 第一方包能直接 `import "@deepseek-ai/dsh-skill"` 是因为它们住在应用内的
 * node_modules 里；profile 侧安装的第三方插件没有这层保障，导入失败会让激活
 * 审计拒绝挂载整个插件。因此这里的 rank 常量取字面量 600，与
 * `@deepseek-ai/dsh-skill` 的 `BUNDLED_SKILL_RANK` 取值保持一致。
 */

import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Cordis 插件身份。 */
export const name = "skill-digital-oracle";

/** 本插件消费的技能注册表服务。 */
export const inject = ["skills"];

/** provider 名称，在技能注册表的一层内必须唯一。 */
const PROVIDER = "dsh-digital-oracle";

/** 与 `BUNDLED_SKILL_RANK` 相同的优先级：低于项目根(100)与用户根(400)。 */
const BUNDLED_SKILL_RANK = 600;

/** 技能名，必须是 kebab-case，并作为目录包的目录名。 */
const SKILL_NAME = "digital-oracle";

/** 目录包的入口文件。 */
const ENTRY = "SKILL.md";

/**
 * 目录条目的描述在编写期冻结，加载时不再解析 YAML。
 * 与 assets/digital-oracle/SKILL.md 的 frontmatter `description` 逐字一致。
 */
const DESCRIPTION = `Answer prediction questions using market trading data, not opinions. Use when the user asks probability questions about geopolitics, economics, markets, industries, or any topic where real money is being traded on the outcome. Examples: 'What's the probability of WW3?', 'Will there be a recession?', 'Is AI in a bubble?', 'When will the Russia-Ukraine war end?', 'Is it a good time to buy gold?', 'Will SPY drop 5% this month?', 'Is NVDA options premium overpriced?'. The skill reads prices from prediction markets, commodities, equities, options chains, derivatives, yield curves, and currencies, then cross-validates multiple signals to produce a structured probability report.`;

/** YAML frontmatter 块，用于剥掉后再把正文交给模型。 */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;

/**
 * 取 SKILL.md 的正文（去掉 frontmatter）。
 * @param raw - 文件全文。
 * @param path - 出错信息用的绝对路径。
 */
function skillBody(raw, path) {
	const match = FRONTMATTER.exec(raw);
	if (match?.[0] === undefined) {
		throw new Error(`skill-digital-oracle: ${path} has no YAML frontmatter`);
	}
	return raw.slice(match[0].length).trim();
}

/**
 * 随插件追加的运行时提示：把已落盘的绝对路径告诉模型，省掉一次探测。
 * 这是本插件自己的文字，不属于上游技能内容。
 * @param directory - 技能目录的绝对路径。
 */
function runtimeNote(directory) {
	return [
		"",
		"## Bundled resources (this plugin)",
		"",
		"This skill is shipped by the `dsh-skill-digital-oracle` DSH bundle. The absolute paths below already exist on disk — use them directly instead of searching for the package.",
		"",
		`- Skill directory: ${directory}`,
		`- Python package: ${join(directory, "digital_oracle")} — put the skill directory on \`PYTHONPATH\` (or \`sys.path\`) to \`import digital_oracle\`.`,
		`- Provider reference: ${join(directory, "references", "providers.md")}`,
		`- Symbol reference: ${join(directory, "references", "symbols.md")}`,
		"",
		"The Python package is stdlib-only for 13 of the 15 providers. `YahooPriceProvider` and `YFinanceProvider` additionally need `yfinance`; install it into a directory of your choosing and add that directory to `PYTHONPATH` if the task requires price history or US options chains.",
	].join("\n");
}

/**
 * 注册 digital-oracle 技能。
 * @param ctx - 携带技能注册表的上下文。
 * @param config - 可选，`assetRoot` 覆盖打包资源目录（用于打包应用）。
 */
export function apply(ctx, config = {}) {
	const assetRoot = config.assetRoot ?? fileURLToPath(new URL("../assets/", import.meta.url));
	if (!isAbsolute(assetRoot)) {
		throw new Error("skill-digital-oracle: assetRoot must be an absolute directory");
	}
	const directory = join(assetRoot, SKILL_NAME);
	const locator = join(directory, ENTRY);
	if (!statSync(locator).isFile()) {
		throw new Error(`skill-digital-oracle: assets must contain ${SKILL_NAME}/${ENTRY} (looked in ${assetRoot})`);
	}
	const note = runtimeNote(directory);
	const candidate = {
		name: SKILL_NAME,
		description: DESCRIPTION,
		invocation: {
			modelInvocable: true,
			userInvocable: true,
		},
		provider: PROVIDER,
		source: "bundled",
		rank: BUNDLED_SKILL_RANK,
		resourceBase: {
			kind: "directory",
			path: directory,
		},
		locator,
	};
	const provider = {
		name: PROVIDER,
		list: () => Promise.resolve([candidate]),
		async get(entry, options) {
			const { rank: _rank, locator: source, ...summary } = entry;
			const raw = await readFile(source, {
				encoding: "utf8",
				signal: options?.signal,
			});
			return {
				...summary,
				content: skillBody(raw, source) + note,
			};
		},
	};
	ctx.skills.registerProvider(() => provider);
}
