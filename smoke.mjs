/**
 * dsh-skill-digital-oracle 冒烟测试。
 *
 * 不启动 DSH：用一个假的 ctx 模拟 `skills` 服务，验证插件的契约行为。
 * 运行：node smoke.mjs
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const failures = [];
function check(label, condition, detail = "") {
	if (condition) {
		console.log(`  ok   ${label}`);
	} else {
		failures.push(label);
		console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
	}
}

const { apply, inject, name } = await import(new URL("./lib/index.js", import.meta.url));

console.log("插件身份");
check("name 为 skill-digital-oracle", name === "skill-digital-oracle", name);
check("inject 声明 skills 服务", Array.isArray(inject) && inject.includes("skills"), JSON.stringify(inject));

let provider;
let invalidateCalls = 0;
const ctx = {
	skills: {
		registerProvider(create) {
			provider = create({
				signal: new AbortController().signal,
				invalidate: () => { invalidateCalls += 1; },
			});
		},
	},
};

console.log("\napply()");
apply(ctx);
check("注册了 provider", provider !== undefined);
check("provider 名唯一且非保留名", provider.name === "dsh-digital-oracle", provider?.name);
check("provider 未主动触发失效", invalidateCalls === 0, String(invalidateCalls));

console.log("\nlist()");
const candidates = await provider.list();
check("恰好一个候选", candidates.length === 1, String(candidates.length));
const candidate = candidates[0];
check("技能名 kebab-case", /^[a-z0-9]+(-[a-z0-9]+)*$/.test(candidate.name), candidate.name);
check("rank 为 600", candidate.rank === 600, String(candidate.rank));
check("source 为 bundled", candidate.source === "bundled", candidate.source);
check("provider 名一致", candidate.provider === "dsh-digital-oracle", candidate.provider);
check("model 与 user 均可调用",
	candidate.invocation.modelInvocable === true && candidate.invocation.userInvocable === true,
	JSON.stringify(candidate.invocation));
check("resourceBase 是目录", candidate.resourceBase?.kind === "directory", candidate.resourceBase?.kind);

console.log("\n落盘资源");
const dir = candidate.resourceBase.path;
check("resourceBase 路径存在且是目录", statSync(dir).isDirectory());
check("locator 指向 SKILL.md", candidate.locator === join(dir, "SKILL.md"));
check("SKILL.md 存在", statSync(candidate.locator).isFile());
check("references/providers.md 存在", statSync(join(dir, "references", "providers.md")).isFile());
check("references/symbols.md 存在", statSync(join(dir, "references", "symbols.md")).isFile());
check("digital_oracle/__init__.py 存在", statSync(join(dir, "digital_oracle", "__init__.py")).isFile());
check("上游 LICENSE 保留", statSync(join(dir, "LICENSE")).isFile());

console.log("\nget()");
const loaded = await provider.get(candidate, {});
check("返回对象不含 locator 与 rank",
	!("locator" in loaded) && !("rank" in loaded),
	Object.keys(loaded).join(","));
check("正文非空且以标题开头", loaded.content.startsWith("# digital-oracle"), loaded.content.slice(0, 40));
check("frontmatter 已剥离", !loaded.content.includes("name: digital-oracle\nversion:"), "frontmatter 仍存在");
check("附带了插件注解", loaded.content.includes("## Bundled resources (this plugin)"));
check("注解含绝对路径", loaded.content.includes(dir));
check("摘要字段被保留",
	loaded.name === candidate.name &&
	loaded.description === candidate.description &&
	loaded.provider === candidate.provider &&
	loaded.source === candidate.source,
	"summary 字段丢失");

console.log("\n冻结描述与上游 frontmatter 一致");
const raw = readFileSync(candidate.locator, "utf8");
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
const line = frontmatter[1].split(/\r?\n/).find((l) => l.startsWith("description:"));
const upstream = JSON.parse(line.slice("description:".length).trim());
check("DESCRIPTION 逐字等于上游 description", upstream === candidate.description,
	`上游 ${upstream.length} 字符 / 本包 ${candidate.description.length} 字符`);

console.log("\n取消信号贯穿读取");
const aborted = new AbortController();
aborted.abort();
let abortedRejected = false;
try {
	await provider.get(candidate, { signal: aborted.signal });
} catch {
	abortedRejected = true;
}
check("已取消的 signal 会让 get() 抛错", abortedRejected);

console.log(`\n${failures.length === 0 ? "全部通过" : `${failures.length} 项失败: ${failures.join(", ")}`}`);
process.exit(failures.length === 0 ? 0 : 1);
